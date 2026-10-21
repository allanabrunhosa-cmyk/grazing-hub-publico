import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, empresa: vi.fn(), certificado: vi.fn(), servicos: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/cliente", async original => {
  const real = await original<typeof import("@/lib/fiscal-saida/brasilnfe/cliente")>();
  return { ...real, ClienteBrasilNfe: class { buscarEmpresa = sim.empresa; verificarCertificadoInterno = sim.certificado; consultarServicos = sim.servicos; } };
});
import { cifrar } from "@/lib/crypto";
import { salvarConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao";
import { obterPreRequisitosBrasilNfe, registrarEvidenciaPainelBrasilNfe, verificarPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos";
import { ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
const schema = `teste_brasilnfe_pre_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, sessao: SessaoAtual;
const empresa = () => ({ cnpj: "00000000000000", razaoSocial: "EMPRESA_FICTICIA_PRIVADA", inscricaoEstadual: "123456789", crt: 1, endereco: { cep: "00000000", logradouro: "Rua sintética", numero: "1", bairro: "Bairro fictício", codigoMunicipio: "3550308", municipio: "São Paulo", uf: "SP" }, nfceHomologacao: { cscConfigurado: false, idCscConfigurado: false }, nfceProducao: { cscConfigurado: false, idCscConfigurado: false } });
const evidencia = () => ({ versao: 1, observadoEm: new Date().toISOString(), servicoAtivo: true, homologacaoInformada: true, certificadoValidade: "2026-11-07", cscHomologacao: false, idCscHomologacao: false, cscProducao: false, idCscProducao: false });
describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Pré-requisitos reais no servidor, HTTP exclusivamente simulado", () => {
  it("falha posterior da empresa preserva a confirmação datada da mesma configuração", async () => {
    const anterior = await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao);
    await sim.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitosIniciadoEm: null } });
    sim.empresa.mockRejectedValueOnce(new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", "EMPRESA_CEP", { categoria: "CONTRATO", httpStatus: 200 }));
    const atual = await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao);
    expect(atual.empresaCorrespondente).toBe(true);
    expect(atual.empresaVerificadaEm).toBe(anterior.empresaVerificadaEm);
    expect(atual.empresaFalha).toMatchObject({ httpStatus: 200, etapaContrato: "EMPRESA_CEP" });
    expect(atual.certificado).toEqual(anterior.certificado); expect(sim.certificado).toHaveBeenCalledTimes(1);
    expect(sim.servicos).not.toHaveBeenCalled();
  });
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Somente banco sintético local");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Admin fictício", email: "pre-m2@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, versao: 0, admin: true, email: u.email, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", nome: "Empresa fictícia", cnpj: "00000000000000" }, update: { nome: "Empresa fictícia", cnpj: "00000000000000" } });
  }, 90000);
  beforeEach(async () => {
    vi.clearAllMocks(); sim.empresa.mockResolvedValue(empresa()); sim.certificado.mockResolvedValue({ valido: true, expirado: false, dataExpiracao: "2026-11-07" });
    await sim.prisma.configuracaoBrasilNfe.upsert({ where: { id: "singleton" }, create: { id: "singleton", tokenCifrado: cifrar("TOKEN_SO_TESTE", "grazing-hub-brasilnfe-token-v1"), userTokenCifrado: cifrar("USERTOKEN_SO_TESTE", "grazing-hub-brasilnfe-usertoken-v1") }, update: { versao: 1, preRequisitos: Prisma.DbNull, preRequisitosEmitenteHash: null, preRequisitosIniciadoEm: null } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { nome: "Empresa fictícia", cnpj: "00000000000000" } });
  });
  afterAll(async () => { await sim.prisma?.$disconnect(); if (banco) { if (criado && /^teste_brasilnfe_pre_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); await banco.end(); } });
  it("registrar painel não chama API, altera segredo ou habilita emissão", async () => {
    const antes = await sim.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    const r = await registrarEvidenciaPainelBrasilNfe(evidencia(), sessao);
    expect(r.evidenciaPainel?.servicoNfeNfceAtivo).toBe(true); expect(r.certificado.situacao).toBe("NAO_CONFERIDO");
    expect(sim.empresa).not.toHaveBeenCalled(); expect(sim.servicos).not.toHaveBeenCalled(); expect(sim.certificado).not.toHaveBeenCalled();
    const depois = await sim.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } }); expect(depois.tokenCifrado).toBe(antes.tokenCifrado); expect(r.transmissaoAutorizada).toBe(false);
  });
  it("consulta apenas empresa/certificado; metadados salvos não incluem cadastro bruto nem segredos", async () => {
    const r = await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao);
    expect(r.certificado).toMatchObject({ situacao: "VALIDO", validade: "2026-11-07", httpStatus: 200 }); expect(r.empresaCorrespondente).toBe(true);
    expect(sim.empresa).toHaveBeenCalledTimes(1); expect(sim.certificado).toHaveBeenCalledTimes(1); expect(sim.servicos).not.toHaveBeenCalled();
    const s = await sim.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(JSON.stringify(s.preRequisitos)).not.toMatch(/TOKEN_SO_TESTE|EMPRESA_FICTICIA_PRIVADA|123456789|Rua sintética/);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0); expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0);
  });
  it("CNPJ divergente impede a verificação do certificado sem trocar o esperado", async () => {
    sim.empresa.mockResolvedValue({ ...empresa(), cnpj: "11111111111111" });
    expect((await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao)).empresaCorrespondente).toBe(false); expect(sim.certificado).not.toHaveBeenCalled();
    expect((await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } })).cnpj).toBe("00000000000000");
  });
  it("falha de certificado conserva empresa confirmada e registra só HTTP numérico", async () => {
    sim.certificado.mockRejectedValue(new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", undefined, { categoria: "CONTRATO", httpStatus: 200 }));
    const r = await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao);
    expect(r.empresaCorrespondente).toBe(true); expect(r.certificado).toMatchObject({ situacao: "NAO_CONFIRMADO", httpStatus: 200 });
  });
  it("certificado expirado e CSC ausente são pendências, nunca liberação", async () => {
    sim.certificado.mockResolvedValue({ valido: false, expirado: true, dataExpiracao: "2020-01-01" });
    const r = await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao); expect(r.certificado.situacao).toBe("EXPIRADO"); expect(r.csc.homologacao.codigo).toBe(false); expect(r.producaoBloqueada).toBe(true);
  });
  it("releitura rejeita sessão revogada e invalida evidência após cadastro/credencial alterados", async () => {
    await registrarEvidenciaPainelBrasilNfe(evidencia(), sessao);
    await expect(obterPreRequisitosBrasilNfe({ ...sessao, versao: 99 })).rejects.toThrow("acesso");
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { nome: "Empresa fictícia revista" } });
    expect((await obterPreRequisitosBrasilNfe(sessao)).evidenciaPainel).toBeNull();
    await registrarEvidenciaPainelBrasilNfe(evidencia(), sessao); await salvarConfiguracaoBrasilNfe({ versao: 1, tokenSubstituicao: "TOKEN_NOVO_TESTE" }, sessao);
    expect((await obterPreRequisitosBrasilNfe(sessao)).evidenciaPainel).toBeNull();
  });
  it("intervalo e whitelist de campos impedem repetição/registro de conteúdo externo", async () => {
    await verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao);
    await expect(verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao)).rejects.toThrow("30 segundos");
    await expect(registrarEvidenciaPainelBrasilNfe({ ...evidencia(), Token: "NAO_GRAVAR" }, sessao)).rejects.toThrow("inválida");
    expect(sim.empresa).toHaveBeenCalledTimes(1);
  });
  it("evidência mais recente registrada durante HTTP é preservada na conclusão da consulta", async () => {
    let liberar!: (valor: ReturnType<typeof empresa>) => void;
    sim.empresa.mockImplementation(() => new Promise(resolve => { liberar = resolve; }));
    const leitura = verificarPreRequisitosBrasilNfe({ versao: 1 }, sessao);
    await vi.waitFor(() => expect(sim.empresa).toHaveBeenCalledTimes(1));
    const painel = await registrarEvidenciaPainelBrasilNfe({ ...evidencia(), certificadoValidade: "2026-12-31" }, sessao);
    liberar(empresa()); const final = await leitura;
    expect(final.evidenciaPainel).toEqual(painel.evidenciaPainel);
    expect((await obterPreRequisitosBrasilNfe(sessao)).evidenciaPainel?.certificadoValidade).toBe("2026-12-31");
  });
});
