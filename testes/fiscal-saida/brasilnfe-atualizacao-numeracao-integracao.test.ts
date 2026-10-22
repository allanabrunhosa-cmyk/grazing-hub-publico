import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import type { NumeracoesBrasilNfeSanitizadas } from "@/lib/fiscal-saida/brasilnfe/tipos-http";
import type { RequisicaoAtualizacaoNumeracaoBrasilNfeHttp } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
vi.mock("server-only", () => ({}));
const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, empresa: vi.fn(), consultar: vi.fn(), atualizar: vi.fn(), gate: false, catalogo: { numeracoes: [], avisosPresentes: false } as NumeracoesBrasilNfeSanitizadas }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao", async original => ({ ...await original<typeof import("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao")>(), transmissaoBrasilNfeLiberada: () => s.gate }));
vi.mock("@/lib/fiscal-saida/brasilnfe/cliente", async original => ({ ...await original<typeof import("@/lib/fiscal-saida/brasilnfe/cliente")>(), ClienteBrasilNfe: class { buscarEmpresa = s.empresa; consultarNumeracao = s.consultar; atualizarNumeracao = s.atualizar; } }));
import { ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { cifrar } from "@/lib/crypto";
import { atualizarNumeracaoFiscalBrasilNfe, consultarNumeracaoFiscalBrasilNfe, obterNumeracaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao";

const schema = `teste_num_update_${randomUUID().replaceAll("-", "")}`, CNPJ = "00000000000000";
const TOKEN = "token-sintetico-exclusivo-numeracao", USER = "user-sintetico-exclusivo-numeracao";
const linha = { ambiente: 2 as const, modelo: 55 as const, serie: "6", numero: "1", padrao: true };
let banco: Client | undefined, criado = false, editor: SessaoAtual, leitor: SessaoAtual;
async function novaConsulta() {
  await s.prisma.eventoConfiguracaoBrasilNfe.updateMany({ where: { tipo: "NUMERACAO_CONSULTA_INICIADA" }, data: { createdAt: new Date(Date.now() - 31000) } });
  return consultarNumeracaoFiscalBrasilNfe({ versao: 1 }, editor);
}
async function comando(mudanca: Record<string, unknown> = {}) {
  const dto = await obterNumeracaoFiscalBrasilNfe(editor);
  return { versao: 1, modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, operacaoId: randomUUID(), consultadoEm: dto.consulta.consultadoEm, confirmarAtualizacao: true, ...mudanca };
}
async function documento(numero = "9", status = "AUTORIZADO", ambiente = "HOMOLOGACAO", serie = "6") {
  const pedido = await s.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "apenas-ficticio", criadoPorId: editor.userId, status: "CONFIRMADO", total: 1, subtotal: 1 } });
  return s.prisma.documentoFiscalSaida.create({ data: { pedidoId: pedido.id, versaoPedido: 1, hashPayload: "a".repeat(64), payload: { emitente: { cnpj: CNPJ } }, criadoPorId: editor.userId, criadoPorNome: "Pessoa fictícia",
    provedor: "BRASIL_NFE", ambiente, modeloDocumento: 55, status, numero, serie, protocolo: "135260000000000000123",
    chaveFiscal: `352610${CNPJ}55${serie.padStart(3, "0")}${numero.padStart(9, "0")}1000000010` } });
}
describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Atualização administrativa em PostgreSQL exclusivamente sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Banco local exclusivamente sintético obrigatório.");
    vi.stubEnv("AUTH_SECRET", "chave-publica-exclusivamente-sintetica-numeracao");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede real proibida na suíte sintética."); }));
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(await prepararMigrationHubIsolada(banco, schema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await s.prisma.perfilAcesso.create({ data: { nome: "Administrador sintético de numeração", permissoes: { "configuracoes.brasilnfe": ["visualizar", "editar"] } } });
    const perfilLeitor = await s.prisma.perfilAcesso.create({ data: { nome: "Leitor sintético de numeração", permissoes: { "configuracoes.brasilnfe": ["visualizar"] } } });
    const base = { nome: "Pessoa fictícia", email: "ficticio@example.invalid", admin: false, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Fictício" };
    for (const [id, perfilAcessoId] of [["editor-num-ficticio", perfil.id], ["leitor-num-ficticio", perfilLeitor.id]]) await s.prisma.usuario.create({ data: { id, nome: base.nome, email: `${id}@example.invalid`, senhaHash: "inutil", perfilAcessoId } });
    editor = { ...base, userId: "editor-num-ficticio" }; leitor = { ...base, userId: "leitor-num-ficticio" };
    await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", nome: "Emitente fictício", cnpj: CNPJ }, update: { nome: "Emitente fictício", cnpj: CNPJ } });
  }, 120000);
  beforeEach(async () => {
    vi.clearAllMocks(); s.gate = false; s.catalogo = { numeracoes: [], avisosPresentes: false };
    await s.prisma.eventoConfiguracaoBrasilNfe.deleteMany(); await s.prisma.configuracaoBrasilNfe.deleteMany(); await s.prisma.documentoFiscalSaida.deleteMany(); await s.prisma.pedidoVenda.deleteMany();
    await s.prisma.usuario.update({ where: { id: editor.userId }, data: { ativo: true, sessaoVersao: 0 } });
    await s.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { cnpj: CNPJ } });
    await s.prisma.configuracaoBrasilNfe.create({ data: { tokenCifrado: cifrar(TOKEN, "grazing-hub-brasilnfe-token-v1"), userTokenCifrado: cifrar(USER, "grazing-hub-brasilnfe-usertoken-v1") } });
    s.empresa.mockReset().mockResolvedValue({ cnpj: CNPJ });
    s.consultar.mockReset().mockImplementation(async () => structuredClone(s.catalogo));
    s.atualizar.mockReset().mockImplementation(async (e: RequisicaoAtualizacaoNumeracaoBrasilNfeHttp) => {
      const alvo = { ambiente: e.TipoAmbiente, modelo: e.ModeloDocumento, serie: e.Serie, numero: String(e.Numero), padrao: e.Padrao };
      s.catalogo.numeracoes = s.catalogo.numeracoes.filter(n => !(n.ambiente === alvo.ambiente && n.modelo === alvo.modelo && Number(n.serie) === Number(alvo.serie))).map(n => e.Padrao && n.ambiente === e.TipoAmbiente && n.modelo === e.ModeloDocumento ? { ...n, padrao: false } : n);
      s.catalogo.numeracoes.push(alvo); return alvo;
    });
    await novaConsulta();
  });
  // Encerrar o schema completo pode exceder 10s sob pressão de memória no host.
  // O prazo local de limpeza é 30s. Os limites HTTP da aplicação não mudam.
  afterAll(async () => { await s.prisma?.$disconnect(); if (banco) { if (criado && /^teste_num_update_[a-f\d]{32}$/.test(schema)) { await limparIntegracaoHubIsolada(banco, schema); await banco.query(`DROP SCHEMA "${schema}" CASCADE`); } await banco.end(); } vi.unstubAllEnvs(); vi.unstubAllGlobals(); }, 30000);

  it("cria nova série1, confirma posterior e preserva estoque/financeiro/notas recebidas", async () => {
    const e = await comando(); const dto = await atualizarNumeracaoFiscalBrasilNfe(e, editor);
    expect(dto.atualizacao).toMatchObject({ situacao: "CONFIRMADA", operacaoId: e.operacaoId }); expect(dto.linhas[0]).toMatchObject({ modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true });
    expect(s.atualizar).toHaveBeenCalledExactlyOnceWith({ TipoAmbiente: 2, ModeloDocumento: 55, Serie: "6", Numero: 1, Padrao: true });
    expect(s.empresa).toHaveBeenCalledTimes(2); expect(s.consultar).toHaveBeenCalledTimes(3);
    for (const segredo of [TOKEN, USER, (await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } })).tokenCifrado!]) expect(JSON.stringify([dto, await s.prisma.eventoConfiguracaoBrasilNfe.findMany()])).not.toContain(segredo);
    expect(await s.prisma.movimentacaoEstoque.count()).toBe(0); expect(await s.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await s.prisma.notaFiscalRecebida.count()).toBe(0); expect(await s.prisma.documentoFiscalSaida.count()).toBe(0); expect(await s.prisma.eventoFiscalSaida.count()).toBe(0);
  });
  it.each([1, 2])("modelo65/série7 fica no ambiente solicitado: %i", async ambiente => {
    s.catalogo.numeracoes = [{ ...linha, ambiente: ambiente === 1 ? 2 : 1, numero: "80" }]; await novaConsulta();
    const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando({ ambiente, modelo: 65, serie: "7" }), editor);
    expect(dto.atualizacao?.situacao).toBe("CONFIRMADA"); expect(s.catalogo.numeracoes).toContainEqual({ ...linha, ambiente: ambiente === 1 ? 2 : 1, numero: "80" });
    expect(s.atualizar).toHaveBeenCalledWith({ TipoAmbiente: ambiente, ModeloDocumento: 65, Serie: "7", Numero: 1, Padrao: true });
  });
  it("muda padrão somente no contexto, sem remover série antiga ou copiar contador", async () => {
    const antiga = { ...linha, serie: "1", numero: "40" }, producao = { ...linha, ambiente: 1 as const, numero: "99" };
    s.catalogo.numeracoes = [antiga, producao]; await novaConsulta();
    const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor);
    expect(dto.atualizacao?.situacao).toBe("CONFIRMADA"); expect(s.catalogo.numeracoes).toEqual([{ ...antiga, padrao: false }, producao, linha]);
  });
  it("UUID repetido devolve resultado sem novas consultas ou mutação", async () => {
    const e = await comando(); await atualizarNumeracaoFiscalBrasilNfe(e, editor); const qtdConsultas = s.consultar.mock.calls.length, qtdEmpresa = s.empresa.mock.calls.length;
    expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao?.situacao).toBe("CONFIRMADA"); expect(s.atualizar).toHaveBeenCalledTimes(1); expect(s.consultar).toHaveBeenCalledTimes(qtdConsultas); expect(s.empresa).toHaveBeenCalledTimes(qtdEmpresa);
    await expect(atualizarNumeracaoFiscalBrasilNfe({ ...e, serie: "7" }, editor)).rejects.toThrow("outro conteúdo");
  });
  it("conflito concorrente não executa segunda atualização nem segundo preflight", async () => {
    let liberar!: () => void, avisar!: () => void;
    const entrou = new Promise<void>(r => { avisar = r; }), espera = new Promise<void>(r => { liberar = r; });
    s.empresa.mockImplementationOnce(async () => { avisar(); await espera; return { cnpj: CNPJ }; });
    const e = await comando(), primeiro = atualizarNumeracaoFiscalBrasilNfe(e, editor); await entrou;
    await expect(atualizarNumeracaoFiscalBrasilNfe({ ...e, operacaoId: randomUUID() }, editor)).rejects.toThrow("em andamento");
    expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao?.situacao).toBe("EM_ANDAMENTO"); liberar();
    expect((await primeiro).atualizacao?.situacao).toBe("CONFIRMADA"); expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it.each(["leitor", "sessao", "inativo"])("permissão central atual bloqueia escrita antes de HTTP: %s", async caso => {
    const e = await comando(); if (caso === "sessao") await s.prisma.usuario.update({ where: { id: editor.userId }, data: { sessaoVersao: 1 } }); if (caso === "inativo") await s.prisma.usuario.update({ where: { id: editor.userId }, data: { ativo: false } });
    await expect(atualizarNumeracaoFiscalBrasilNfe(e, caso === "leitor" ? leitor : editor)).rejects.toThrow("acesso"); expect(s.atualizar).not.toHaveBeenCalled(); expect(s.empresa).not.toHaveBeenCalled();
  });
  it("CNPJ externo divergente recusa antes do catálogo fresco e de AtualizarNumeracao", async () => {
    s.empresa.mockResolvedValue({ cnpj: "11111111111111" });
    const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor);
    expect(dto.atualizacao).toMatchObject({ situacao: "RECUSADA", motivo: expect.stringContaining("emitente consultado") }); expect(s.atualizar).not.toHaveBeenCalled(); expect(s.consultar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await s.prisma.eventoConfiguracaoBrasilNfe.findMany())).not.toContain("11111111111111");
  });
  it("consulta em cache não autoriza reduzir contador que avançou antes do preflight", async () => {
    s.catalogo.numeracoes = [{ ...linha, numero: "9" }]; await novaConsulta(); const e = await comando({ proximoNumero: "9" });
    s.catalogo.numeracoes[0].numero = "10";
    expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao?.situacao).toBe("RECUSADA"); expect(s.atualizar).not.toHaveBeenCalled();
  });
  it("documento próprio maior impede reutilização mesmo se fornecedor estiver atrasado", async () => {
    s.catalogo.numeracoes = [{ ...linha, numero: "8" }]; await novaConsulta(); const d = await documento("9");
    const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando({ proximoNumero: "9" }), editor);
    expect(dto.atualizacao?.situacao).toBe("RECUSADA"); expect(s.atualizar).not.toHaveBeenCalled();
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).protocolo).toBe("135260000000000000123");
  });
  it("nova série não aceita salto nem reset diante de documento local", async () => {
    await documento("1"); const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor);
    expect(dto.atualizacao?.situacao).toBe("RECUSADA"); expect(s.atualizar).not.toHaveBeenCalled();
  });
  it.each(["identidade", "serie"])("documento consumido sem prova local de %s impedePOST", async falta => {
    const d = await documento("9");
    await s.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: falta === "identidade" ? { chaveFiscal: null, payload: {} } : { chaveFiscal: null, serie: null } });
    const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor);
    expect(dto.atualizacao).toMatchObject({ situacao: "RECUSADA", motivo: expect.stringContaining("histórico local") }); expect(s.atualizar).not.toHaveBeenCalled();
  });
  it("documento comprovadamente de outro emitente não usa nem bloqueia sequência atual", async () => {
    const d = await documento("9"), outroCnpj = "11111111111111";
    await s.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: { payload: { emitente: { cnpj: outroCnpj } }, chaveFiscal: `${d.chaveFiscal!.slice(0, 6)}${outroCnpj}${d.chaveFiscal!.slice(20)}` } });
    const dto = await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor);
    expect(dto.atualizacao?.situacao).toBe("CONFIRMADA"); expect(s.atualizar).toHaveBeenCalledExactlyOnceWith({ TipoAmbiente: 2, ModeloDocumento: 55, Serie: "6", Numero: 1, Padrao: true });
  });
  it("rejeição181 sem protocolo não é número consumido e permanece preservada", async () => {
    const d = await documento("1", "REJEITADO"); await s.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: { protocolo: null, ultimoErro: "Rejeição181 sintética" } });
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao?.situacao).toBe("CONFIRMADA");
    expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "REJEITADO", protocolo: null, ultimoErro: "Rejeição181 sintética", numero: "1", serie: "6" });
  });
  it("ação/lease ou documento incerto bloqueia administração", async () => {
    const d = await documento("1", "INCERTO"); await s.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: "CONSULTAR", leaseToken: "lease-exclusivamente-sintetico" } });
    await expect(atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).rejects.toThrow("processamento"); expect(s.atualizar).not.toHaveBeenCalled();
  });
  it("gate de transmissão futuro habilitado bloqueia administração do contador", async () => {
    s.gate = true; await expect(atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).rejects.toThrow("transmissão estiver habilitada"); expect(s.atualizar).not.toHaveBeenCalled(); expect(s.empresa).not.toHaveBeenCalled();
  });
  it("cache obsoleto/incompleto e configuração alterada não iniciam preflight", async () => {
    await expect(atualizarNumeracaoFiscalBrasilNfe(await comando({ consultadoEm: new Date(Date.now() - 301000).toISOString() }), editor)).rejects.toThrow("consulta recente");
    await expect(atualizarNumeracaoFiscalBrasilNfe(await comando({ versao: 2 }), editor)).rejects.toThrow("Configuração alterada");
    expect(s.empresa).not.toHaveBeenCalled(); expect(s.atualizar).not.toHaveBeenCalled();
  });
  it("revogação durante preflight impede a intenção e a atualização", async () => {
    const e = await comando(); s.consultar.mockImplementationOnce(async () => { await s.prisma.usuario.update({ where: { id: editor.userId }, data: { sessaoVersao: 1 } }); return structuredClone(s.catalogo); });
    await expect(atualizarNumeracaoFiscalBrasilNfe(e, editor)).rejects.toThrow("acesso"); expect(s.atualizar).not.toHaveBeenCalled(); expect(await s.prisma.eventoConfiguracaoBrasilNfe.count({ where: { tipo: "NUMERACAO_ATUALIZACAO_ENVIO" } })).toBe(0);
  });
  it("troca de configuração antes do POST encerra tentativa sem manter bloqueio incerto", async () => {
    const e = await comando(); s.consultar.mockImplementationOnce(async () => { await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 2 } }); return structuredClone(s.catalogo); });
    const dto = await atualizarNumeracaoFiscalBrasilNfe(e, editor);
    expect(dto.atualizacao).toBeNull();
    expect(dto.historicoAtualizacoes?.[0]).toMatchObject({ situacao: "RECUSADA", contexto: "ANTERIOR", motivo: expect.stringContaining("Configuração") });
    expect(s.atualizar).not.toHaveBeenCalled(); expect(await s.prisma.eventoConfiguracaoBrasilNfe.count({ where: { tipo: "NUMERACAO_ATUALIZACAO_ENVIO" } })).toBe(0);
  });
  it("preflight suspenso não envia depois de encerrado sem intenção por consulta manual", async () => {
    let liberar!: () => void, avisar!: () => void;
    const entrou = new Promise<void>(r => { avisar = r; }), espera = new Promise<void>(r => { liberar = r; });
    s.consultar.mockImplementationOnce(async () => { avisar(); await espera; return structuredClone(s.catalogo); });
    const e = await comando(), executando = atualizarNumeracaoFiscalBrasilNfe(e, editor); await entrou;
    try {
      const evento = await s.prisma.eventoConfiguracaoBrasilNfe.findFirstOrThrow({ where: { tipo: "NUMERACAO_ATUALIZACAO_INICIADA" } });
      await s.prisma.eventoConfiguracaoBrasilNfe.update({ where: { id: evento.id }, data: { dados: { ...evento.dados as object, solicitadoEm: new Date(Date.now() - 91000).toISOString() } } });
      expect((await novaConsulta()).atualizacao).toMatchObject({ situacao: "RECUSADA", operacaoId: e.operacaoId });
    } finally { liberar(); }
    expect((await executando).atualizacao).toMatchObject({ situacao: "RECUSADA", operacaoId: e.operacaoId });
    expect(s.atualizar).not.toHaveBeenCalled();
    expect(await s.prisma.eventoConfiguracaoBrasilNfe.count({ where: { tipo: "NUMERACAO_ATUALIZACAO_ENVIO" } })).toBe(0);
  });
  it("intenção é durável e mutex administrativo permanece retido durante o único POST", async () => {
    let liberar!: () => void, avisar!: () => void;
    const entrou = new Promise<void>(r => { avisar = r; }), espera = new Promise<void>(r => { liberar = r; });
    s.atualizar.mockImplementationOnce(async () => { s.catalogo.numeracoes = [linha]; avisar(); await espera; return linha; });
    const e = await comando(), executando = atualizarNumeracaoFiscalBrasilNfe(e, editor); await entrou;
    try {
      await banco!.query("BEGIN");
      try {
        const intencao = await banco!.query('SELECT id FROM "EventoConfiguracaoBrasilNfe" WHERE tipo=$1 AND dados->>\'operacaoId\'=$2', ["NUMERACAO_ATUALIZACAO_ENVIO", e.operacaoId]);
        expect(intencao.rowCount).toBe(1);
        const mutex = await banco!.query<{ adquiriu: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext('brasilnfe-config')) AS adquiriu");
        expect(mutex.rows[0].adquiriu).toBe(false);
      } finally { await banco!.query("ROLLBACK"); }
    } finally { liberar(); await executando; }
    expect((await executando).atualizacao).toMatchObject({ situacao: "CONFIRMADA", operacaoId: e.operacaoId });
    expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("lease vencido no preflight encerra sem intenção nem POST mesmo sem consulta concorrente", async () => {
    s.consultar.mockImplementationOnce(async () => {
      const evento = await s.prisma.eventoConfiguracaoBrasilNfe.findFirstOrThrow({ where: { tipo: "NUMERACAO_ATUALIZACAO_INICIADA" } });
      await s.prisma.eventoConfiguracaoBrasilNfe.update({ where: { id: evento.id }, data: { dados: { ...evento.dados as object, solicitadoEm: new Date(Date.now() - 91000).toISOString() } } });
      return structuredClone(s.catalogo);
    });
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao).toMatchObject({ situacao: "RECUSADA", motivo: expect.stringContaining("prazo da operação") });
    expect(s.atualizar).not.toHaveBeenCalled();
    expect(await s.prisma.eventoConfiguracaoBrasilNfe.count({ where: { tipo: "NUMERACAO_ATUALIZACAO_ENVIO" } })).toBe(0);
  });
  it("resposta tardia não rebaixa reconciliação terminal já comprovada por consulta manual", async () => {
    let liberar!: () => void, avisar!: () => void;
    const entrou = new Promise<void>(r => { avisar = r; }), espera = new Promise<void>(r => { liberar = r; });
    s.consultar.mockResolvedValueOnce(structuredClone(s.catalogo)).mockImplementationOnce(async () => {
      avisar(); await espera; throw new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "HTTP", httpStatus: 403 });
    });
    const e = await comando(), executando = atualizarNumeracaoFiscalBrasilNfe(e, editor); await entrou;
    try {
      const eventos = await s.prisma.eventoConfiguracaoBrasilNfe.findMany({ where: { tipo: { in: ["NUMERACAO_ATUALIZACAO_INICIADA", "NUMERACAO_ATUALIZACAO_ENVIO"] } } });
      for (const evento of eventos) await s.prisma.eventoConfiguracaoBrasilNfe.update({ where: { id: evento.id }, data: { dados: { ...evento.dados as object, solicitadoEm: new Date(Date.now() - 91000).toISOString() } } });
      expect((await novaConsulta()).atualizacao?.situacao).toBe("CONFIRMADA");
    } finally { liberar(); }
    expect((await executando).atualizacao?.situacao).toBe("CONFIRMADA"); expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("consulta antiga não rebaixa resultado terminal gravado durante seu GET", async () => {
    s.atualizar.mockRejectedValueOnce(new ErroHttpBrasilNfe("TIMEOUT"));
    const e = await comando(); expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA");
    let liberar!: () => void, avisar!: () => void;
    const entrou = new Promise<void>(r => { avisar = r; }), espera = new Promise<void>(r => { liberar = r; });
    s.consultar.mockImplementationOnce(async () => { avisar(); await espera; return { numeracoes: [], avisosPresentes: false }; });
    const antiga = novaConsulta(); await entrou;
    try {
      s.catalogo.numeracoes = [linha];
      expect((await novaConsulta()).atualizacao?.situacao).toBe("CONFIRMADA");
    } finally { liberar(); }
    expect((await antiga).atualizacao).toMatchObject({ situacao: "CONFIRMADA", operacaoId: e.operacaoId });
    expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it.each(["credencial", "emitente"])("mudança de %s conserva histórico sem reaproveitar confirmação atual", async campo => {
    const e = await comando(); expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao).toMatchObject({ situacao: "CONFIRMADA", contexto: "ATUAL" });
    if (campo === "credencial") await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: { increment: 1 }, tokenCifrado: cifrar("outra-credencial-exclusivamente-sintetica", "grazing-hub-brasilnfe-token-v1") } });
    else await s.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { cnpj: "11111111111111" } });
    const dto = await obterNumeracaoFiscalBrasilNfe(editor);
    expect(dto.atualizacao).toBeNull(); expect(dto.consulta.situacao).toBe("OBSOLETA");
    expect(dto.historicoAtualizacoes?.[0]).toMatchObject({ situacao: "CONFIRMADA", contexto: "ANTERIOR", operacaoId: e.operacaoId });
    expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("timeout permanece pendente: mesma operação ou operação nova nunca reenviam", async () => {
    const e = await comando(); s.atualizar.mockRejectedValueOnce(new ErroHttpBrasilNfe("TIMEOUT"));
    expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA");
    expect((await atualizarNumeracaoFiscalBrasilNfe(e, editor)).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA");
    await expect(atualizarNumeracaoFiscalBrasilNfe({ ...e, operacaoId: randomUUID() }, editor)).rejects.toThrow("pendente");
    expect((await novaConsulta()).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA"); expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("consulta manual pode comprovar resposta incerta e contador avançado, sem retransmitir", async () => {
    s.atualizar.mockImplementationOnce(async () => { s.catalogo.numeracoes = [{ ...linha, numero: "2" }]; throw new ErroHttpBrasilNfe("TIMEOUT"); });
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA");
    const dto = await novaConsulta(); expect(dto.atualizacao?.situacao).toBe("CONFIRMADA"); expect(dto.linhas[0].proximoNumero).toBe("2"); expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("statusfalse do endpoint de atualização comprova recusa, sem mensagem externa", async () => {
    s.atualizar.mockRejectedValueOnce(new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "NEGOCIO", statusFornecedor: false, tipoStatusFornecedor: "BOOLEANO", estadoStatusFornecedor: "FALSE" }));
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao).toMatchObject({ situacao: "RECUSADA", motivo: expect.stringContaining("status false") });
    expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("statusfalse da pós-consulta não é negação da escrita anterior", async () => {
    s.consultar.mockResolvedValueOnce(structuredClone(s.catalogo)).mockRejectedValueOnce(new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "NEGOCIO", statusFornecedor: false, tipoStatusFornecedor: "BOOLEANO", estadoStatusFornecedor: "FALSE" }));
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA"); expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("resposta de escrita sem pós-leitura correspondente não vira confirmação", async () => {
    s.atualizar.mockResolvedValueOnce(linha);
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA");
    expect((await novaConsulta()).atualizacao?.situacao).toBe("PENDENTE_CONFERENCIA"); expect(s.atualizar).toHaveBeenCalledTimes(1);
  });
  it("mesmo contador e padrão já conferidos não geram atualização redundante", async () => {
    s.catalogo.numeracoes = [linha]; await novaConsulta();
    expect((await atualizarNumeracaoFiscalBrasilNfe(await comando(), editor)).atualizacao).toMatchObject({ situacao: "CONFIRMADA", motivo: expect.stringContaining("Nenhuma atualização") }); expect(s.atualizar).not.toHaveBeenCalled();
  });
});
