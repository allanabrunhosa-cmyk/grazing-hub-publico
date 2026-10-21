import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";
import { hashRegraFiscalBrasilNfe, validarConteudoRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
import { salvarRascunhoRegraTributariaBrasilNfe, aprovarRegraTributariaBrasilNfe, enviarRegraParaRevisaoBrasilNfe, bloquearRegraTributariaBrasilNfe, inativarRegraTributariaBrasilNfe, listarRegrasTributariasBrasilNfe, obterHistoricoRegraTributariaBrasilNfe, vincularRegrasDocumentoBrasilNfe, obterComplementosAprovadosDocumentoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias";
import { obterManifestoLocalNfe55BrasilNfe } from "@/lib/fiscal-saida/brasilnfe/manifesto-local";
const schema = `teste_regras_brasilnfe_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, editor: SessaoAtual, leitor: SessaoAtual;
const identidadeSessao = { nome: "Pessoa fictícia", email: "ficticio@example.invalid", admin: false, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Fictício" };
async function salvarEAprovar(d: ReturnType<typeof rascunhoRegraSintetica>) {
  const r = await salvarRascunhoRegraTributariaBrasilNfe(d, editor);
  const a = await aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor);
  return { ...a, conteudo: d.conteudo };
}
async function novaPropostaEmpresa() {
  const existente = await s.prisma.regraFiscalBrasilNfe.findFirst({ where: { modelo: 55, alvo: "EMPRESA" } });
  return { ...rascunhoRegraSintetica("EMPRESA"), ...(existente ? { regraId: existente.id, revisao: existente.revisao } : {}) };
}
async function massaDocumento(modelo: 55 | 65 = 55, grupo = false, recolhidoDas = false) {
  const m = massaPayloadLocal(), sufixo = randomUUID().replaceAll("-", ""), produtoId = `produto-${sufixo}`, itemId = `item-${sufixo}`, documentoId = `documento-${sufixo}`;
  const fiscal = m.documento.payload.itens[0].fiscal.produto;
  if (recolhidoDas) Object.assign(fiscal, { pis: "49", cofins: "49" });
  const g = grupo ? await s.prisma.grupoFiscalVenda.create({ data: { nome: `Grupo fictício ${sufixo}`, fiscal } }) : null;
  await s.prisma.produtoVenda.create({ data: { id: produtoId, nome: "Produto fictício", fiscal, fiscalRevisado: true, grupoFiscalId: g?.id } });
  await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { ...m.cadastro }, update: m.cadastro });
  const pedido = await s.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "sintetico-regras", criadoPorId: editor.userId, status: "CONFIRMADO", total: "24.53", subtotal: "26.50" } });
  Object.assign(m.documento.payload.itens[0], { id: itemId, produtoId });
  Object.assign(m.documento.payload.itens[0].fiscal, { grupoId: g?.id ?? null, versaoGrupo: g?.versao ?? null });
  Object.assign(m.documento.payload.pedido, { id: pedido.id });
  Object.assign(m.documento, { id: documentoId, hashPayload: createHash("sha256").update(JSON.stringify(m.documento.payload)).digest("hex") });
  const doc = await s.prisma.documentoFiscalSaida.create({ data: { id: documentoId, pedidoId: pedido.id, versaoPedido: 1, payload: m.documento.payload, hashPayload: m.documento.hashPayload, criadoPorId: editor.userId, criadoPorNome: "Autor fictício" } });
  const empresaD = rascunhoRegraSintetica("EMPRESA", modelo), opD = rascunhoRegraSintetica("OPERACAO", modelo);
  const regraEmpresa = await s.prisma.regraFiscalBrasilNfe.findFirst({ where: { modelo, alvo: "EMPRESA" } }), regraOperacao = await s.prisma.regraFiscalBrasilNfe.findFirst({ where: { modelo, alvo: "OPERACAO" } });
  if (regraEmpresa) Object.assign(empresaD, { regraId: regraEmpresa.id, revisao: regraEmpresa.revisao });
  if (regraOperacao) Object.assign(opD, { regraId: regraOperacao.id, revisao: regraOperacao.revisao });
  const empresa = await salvarEAprovar(empresaD), operacao = await salvarEAprovar(opD), itemD = rascunhoRegraSintetica(grupo ? "GRUPO" : "PRODUTO", modelo);
  if (grupo) itemD.grupoId = g!.id; else itemD.produtoId = produtoId;
  if (recolhidoDas && itemD.conteudo.tipo === "ITEM") {
    Object.assign(itemD.conteudo.perfil.classificacoes, { pis: "49", cofins: "49" });
    Object.assign(itemD.conteudo.perfil, { pis: { tratamento: "RECOLHIDO_DAS" }, cofins: { tratamento: "RECOLHIDO_DAS" } });
  }
  const item = await salvarEAprovar(itemD);
  const selecao = { documentoId, modelo, empresaVersaoId: empresa.id, operacaoVersaoId: operacao.id, itens: [{ itemId, versaoId: item.id }], complementos: { destinatario: m.parametros.destinatario.identificar ? m.parametros.destinatario.endereco : undefined, bases: [{ itemId }], cartoes: [] } };
  return { doc, m, empresa, operacao, item, produtoId, itemId, selecao, grupo: g };
}
describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Regras Brasil NFe em schema exclusivamente sintético", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T15:00:00.000Z"));
    const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Somente banco local fictício.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfis = await Promise.all([s.prisma.perfilAcesso.create({ data: { nome: "Editor fiscal fictício", permissoes: { "vendas.fiscal": ["visualizar", "editar"], "vendas.pedidos": ["visualizar"] } } }), s.prisma.perfilAcesso.create({ data: { nome: "Leitor fiscal fictício", permissoes: { "vendas.fiscal": ["visualizar"], "vendas.pedidos": ["visualizar"] } } })]);
    for (const [i, id] of ["editor-regra-ficticio", "leitor-regra-ficticio"].entries()) await s.prisma.usuario.create({ data: { id, nome: "Pessoa fictícia", email: `${id}@example.invalid`, senhaHash: "inutil", perfilAcessoId: perfis[i].id } });
    editor = { ...identidadeSessao, userId: "editor-regra-ficticio" }; leitor = { ...identidadeSessao, userId: "leitor-regra-ficticio" };
    await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { ...massaPayloadLocal().cadastro }, update: {} });
    await s.prisma.formaPagamentoVenda.create({ data: { id: "forma-ficticia", nome: "Forma de pagamento exclusivamente sintética", tipo: "DINHEIRO" } });
  }, 120000);
  afterAll(async () => { await s.prisma?.$disconnect(); if (banco) { if (criado && /^teste_regras_brasilnfe_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); await banco.end(); } vi.useRealTimers(); });
  it("sessão e permissão reais restringem escrita e leitura, sem confiar em admin do DTO", async () => {
    const d = rascunhoRegraSintetica("EMPRESA"), quantidade = await s.prisma.regraFiscalBrasilNfe.count();
    await expect(salvarRascunhoRegraTributariaBrasilNfe(d, { ...leitor, admin: true })).rejects.toThrow("acesso");
    await expect(listarRegrasTributariasBrasilNfe({ ...editor, versao: 99 })).rejects.toThrow("acesso");
    expect(await s.prisma.regraFiscalBrasilNfe.count()).toBe(quantidade);
  });
  it("proposta não aprova regra, confirmação interna é explícita e histórico é append-only", async () => {
    const r = await salvarRascunhoRegraTributariaBrasilNfe(rascunhoRegraSintetica("EMPRESA"), editor);
    const comando = { regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true };
    await expect(aprovarRegraTributariaBrasilNfe({ ...comando, aplicacaoConferida: false }, editor)).rejects.toThrow("Confirme");
    await expect(aprovarRegraTributariaBrasilNfe({ ...comando, fundamentacaoHash: "a".repeat(64) }, editor)).rejects.toThrow("fundamento apresentados");
    await expect(aprovarRegraTributariaBrasilNfe({ ...comando, conteudoHash: "a".repeat(64) }, editor)).rejects.toThrow("fundamento apresentados");
    await expect(aprovarRegraTributariaBrasilNfe(comando, leitor)).rejects.toThrow("acesso");
    const a = await aprovarRegraTributariaBrasilNfe(comando, { ...editor, nome: "Nome forjado do DTO" });
    expect(a.revisao).toBe(r.revisao + 1);
    const historico = await obterHistoricoRegraTributariaBrasilNfe(r.regraId, leitor); expect(historico.versoes.map(v => v.estado)).toEqual(["APROVADA", "PROPOSTA"]); expect(historico.versoes.every(v => v.responsavelId === editor.userId && v.referenciaConfirp === null)).toBe(true);
    expect(a.aprovacaoInterna).toMatchObject({ tipo: "APROVACAO_INTERNA", fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aprovador: { id: editor.userId, nome: "Pessoa fictícia" }, aprovadoEm: "2026-10-11T15:00:00.000Z" });
    expect(a.aprovacaoHash).toBe(hashRegraFiscalBrasilNfe(a.aprovacaoInterna)); expect(a.legado).toBe(false);
    await expect(s.prisma.versaoRegraFiscalBrasilNfe.update({ where: { id: a.id }, data: { estado: "INATIVA" } })).rejects.toThrow();
    await expect(s.prisma.versaoRegraFiscalBrasilNfe.delete({ where: { id: r.id } })).rejects.toThrow();
  });
  it.each([
    ["PRODUTO", ""], ["PRODUTO", "1234567890123"],
    ["GRUPO", ""], ["GRUPO", "1234567890123"],
  ] as const)("GTIN da unidade final impede nova aprovação %s com valor não conferido %s, preservando proposta e histórico", async (alvo, ean) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      const d = rascunhoRegraSintetica(alvo), id = `gtin-ficticio-${randomUUID()}`;
      if (d.conteudo.tipo !== "ITEM") throw new Error("Massa exclusivamente sintética inválida.");
      d.conteudo.perfil.classificacoes.ean = ean;
      const fiscal = d.conteudo.perfil.classificacoes;
      if (alvo === "PRODUTO") {
        d.produtoId = id;
        await s.prisma.produtoVenda.create({ data: { id, nome: "Produto GTIN exclusivamente fictício", fiscal, fiscalRevisado: true } });
      } else {
        d.grupoId = id;
        await s.prisma.grupoFiscalVenda.create({ data: { id, nome: `Grupo GTIN fictício ${id}`, fiscal } });
      }
      const proposta = await salvarRascunhoRegraTributariaBrasilNfe(d, editor);
      const comando = { regraId: proposta.regraId, revisao: proposta.revisao, conteudoHash: proposta.conteudoHash, fundamentacaoHash: proposta.fundamentacaoHash, aplicacaoConferida: true };
      await expect(aprovarRegraTributariaBrasilNfe(comando, editor)).rejects.toMatchObject({ campo: "classificacoes.ean" });
      const historico = await obterHistoricoRegraTributariaBrasilNfe(proposta.regraId, leitor);
      expect(historico.versoes).toHaveLength(1);
      expect(historico.versoes[0]).toMatchObject({ id: proposta.id, estado: "PROPOSTA", conteudoHash: proposta.conteudoHash, aprovacaoHash: null });
      expect(await s.prisma.regraFiscalBrasilNfe.findUnique({ where: { id: proposta.regraId }, select: { revisao: true } })).toEqual({ revisao: proposta.revisao });
      expect(await Promise.all([s.prisma.notaFiscalRecebida.count(), s.prisma.movimentacaoEstoque.count(), s.prisma.lancamentoFinanceiro.count()])).toEqual([0, 0, 0]);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("concorrência de revisão admite apenas uma escrita e mantém histórico antigo", async () => {
    const atual = await s.prisma.regraFiscalBrasilNfe.findFirstOrThrow({ where: { alvo: "EMPRESA", modelo: 55 } });
    const d = { ...rascunhoRegraSintetica("EMPRESA"), regraId: atual.id, revisao: atual.revisao };
    const resultados = await Promise.allSettled([salvarRascunhoRegraTributariaBrasilNfe(d, editor), salvarRascunhoRegraTributariaBrasilNfe(d, editor)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await obterHistoricoRegraTributariaBrasilNfe(atual.id, leitor)).versoes).toHaveLength(atual.revisao + 1);
  });
  it.each([55, 65] as const)("vincula e lê plano modelo%s, preserva hash/valores e não habilita fila nem efeitos alheios", async modelo => {
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      const d = await massaDocumento(modelo), antes = JSON.stringify(d.doc.payload), vinculo = await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
      expect(vinculo).toMatchObject({ montagemConcluida: true, transmissaoPermitida: false, pendencias: [] });
      const lido = await obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor);
      expect(lido?.resultado.montagemConcluida).toBe(true); expect(lido?.resultado.payload?.ModeloDocumento).toBe(modelo);
      const doc = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } });
      expect(JSON.stringify(doc.payload)).toBe(antes); expect(doc.hashPayload).toBe(d.doc.hashPayload); expect(doc).toMatchObject({ modeloDocumento: modelo, acao: null, tentativas: 0, ambiente: "NAO_CONFIGURADO" });
      const igual = await vincularRegrasDocumentoBrasilNfe(d.selecao, editor); expect(igual.planoId).toBe(vinculo.planoId);
      expect(await s.prisma.planoFiscalBrasilNfe.count({ where: { documentoId: d.doc.id } })).toBe(1);
      expect(await s.prisma.itemPlanoFiscalBrasilNfe.count({ where: { planoId: vinculo.planoId! } })).toBe(3);
      expect(await Promise.all([s.prisma.notaFiscalRecebida.count(), s.prisma.movimentacaoEstoque.count(), s.prisma.lancamentoFinanceiro.count()])).toEqual([0, 0, 0]);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("manifesto55 usa provas aprovadas na mesma leitura autorizada e não produz efeitos", async () => {
    const d = await massaDocumento(), fetch = vi.spyOn(globalThis, "fetch");
    try {
      await s.prisma.eventoFiscalSaida.create({ data: { documentoId: d.doc.id, chave: `preparado-ficticio:${randomUUID()}`, tipo: "PREPARADO", dados: { origem: "fixture-sintetica" } } });
      expect(await obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor)).toMatchObject({ estado: "PENDENTE", transmissaoPermitida: false });
      const vinculo = await vincularRegrasDocumentoBrasilNfe(d.selecao, editor), antes = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } });
      await expect(obterManifestoLocalNfe55BrasilNfe(d.doc.id, { ...leitor, versao: 99, admin: true })).rejects.toThrow("acesso");
      const r = await obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor);
      expect(r).toMatchObject({ estado: "PREPARADO_LOCALMENTE", transmissaoPermitida: false, manifesto: { planoId: vinculo.planoId, modelo: 55, ambiente: 2, documentoId: d.doc.id, hashSnapshot: d.doc.hashPayload, revisaoPedido: 1, total: "24.53", autorizacaoPrimeiraTransmissao: "PENDENTE" } });
      expect(r.manifesto?.hashPayloadFiscal).toMatch(/^[a-f0-9]{64}$/);
      expect(r.manifesto?.versoes.map(v => v.versaoId).sort()).toEqual([d.empresa.id, d.operacao.id, d.item.id].sort());
      for (const aprovada of [d.empresa, d.operacao, d.item]) expect(r.manifesto?.versoes).toContainEqual(expect.objectContaining({ versaoId: aprovada.id, revisao: aprovada.revisao, conteudoHash: aprovada.conteudoHash, fundamentacaoHash: aprovada.fundamentacaoHash, aprovacaoHash: aprovada.aprovacaoHash }));
      for (const privado of ["Pessoa fictícia", "Rua de teste", "Produtos", "Pagamentos", "00000000000"]) expect(JSON.stringify(r)).not.toContain(privado);
      expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).toEqual(antes);
      expect(await Promise.all([s.prisma.notaFiscalRecebida.count(), s.prisma.movimentacaoEstoque.count(), s.prisma.lancamentoFinanceiro.count()])).toEqual([0, 0, 0]); expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it.each([55, 65] as const)("DAS explicitamente aprovado persiste e monta modelo%s sem efeitos ou migração adicional", async modelo => {
    const d = await massaDocumento(modelo, false, true), fetch = vi.spyOn(globalThis, "fetch");
    try {
      const antes = JSON.stringify(d.doc.payload); await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
      const r = await obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, leitor);
      expect(r?.resultado.montagemConcluida).toBe(true); expect(r?.transmissaoPermitida).toBe(false);
      expect(r?.resultado.payload?.Produtos[0].Imposto.PIS).toEqual({ CodSituacaoTributaria: "49", BaseCalculo: "0.00", Aliquota: "0.0000" });
      expect(r?.resultado.payload?.Produtos[0].Imposto.COFINS).toEqual({ CodSituacaoTributaria: "49", BaseCalculo: "0.00", Aliquota: "0.0000" });
      expect(r?.resultado.payload?.ValorTotal).toBe("24.53");
      const historico = await obterHistoricoRegraTributariaBrasilNfe(d.item.regraId, leitor);
      expect(historico.versoes[0].conteudo).toMatchObject({ tipo: "ITEM", perfil: { pis: { tratamento: "RECOLHIDO_DAS" }, cofins: { tratamento: "RECOLHIDO_DAS" } } });
      expect(historico.versoes[0].aprovacaoHash).toBe(d.item.aprovacaoHash);
      expect(JSON.stringify((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).payload)).toBe(antes);
      if (modelo === 55) expect(await obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor)).toMatchObject({ estado: "PREPARADO_LOCALMENTE", transmissaoPermitida: false, manifesto: { total: "24.53" } });
      expect(await Promise.all([s.prisma.notaFiscalRecebida.count(), s.prisma.movimentacaoEstoque.count(), s.prisma.lancamentoFinanceiro.count()])).toEqual([0, 0, 0]); expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("manifesto não reutiliza fotografia de pedido alterado ou documento já tentado", async () => {
    const d = await massaDocumento(); await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    await s.prisma.pedidoVenda.update({ where: { id: d.doc.pedidoId }, data: { versao: 2 } });
    await expect(obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor)).rejects.toThrow("Não preparar primeira emissão");
    await s.prisma.pedidoVenda.update({ where: { id: d.doc.pedidoId }, data: { versao: 1 } });
    await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { tentativas: 1 } });
    await expect(obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor)).rejects.toThrow("Não preparar primeira emissão");
  });
  it("manifesto55 rejeita plano65 aprovado e conserva sua identidade", async () => {
    const d = await massaDocumento(65); await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    await expect(obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor)).rejects.toThrow("modelo 55");
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).modeloDocumento).toBe(65);
  });
  it.each(["ACAO_PENDENTE", "HISTORICO_INCERTO", "PEDIDO_CANCELADO", "PROTOCOLO", "PRODUCAO", "STATUS_INCERTO", "LEASE_RESIDUAL"] as const)("contador zero não prova primeira emissão: %s", async caso => {
    const d = await massaDocumento(); await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    if (caso === "ACAO_PENDENTE") await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { acao: "CONSULTAR", tentativas: 0 } });
    if (caso === "HISTORICO_INCERTO") {
      await s.prisma.eventoFiscalSaida.create({ data: { documentoId: d.doc.id, chave: `incerto-ficticio:${randomUUID()}`, tipo: "RESULTADO_INCERTO", dados: { acao: "ENVIAR", tentativa: 1 } } });
      await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { status: "PREPARADO", tentativas: 0, acao: null } });
    }
    if (caso === "PEDIDO_CANCELADO") await s.prisma.pedidoVenda.update({ where: { id: d.doc.pedidoId }, data: { status: "CANCELADO" } });
    if (caso === "PROTOCOLO") await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { protocolo: "12345678901234567" } });
    if (caso === "PRODUCAO") await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { ambiente: "PRODUCAO" } });
    if (caso === "STATUS_INCERTO") await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { status: "INCERTO" } });
    if (caso === "LEASE_RESIDUAL") await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { leaseAte: new Date("2026-10-11T16:00:00.000Z"), leaseToken: null } });
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).tentativas).toBe(0);
    await expect(obterManifestoLocalNfe55BrasilNfe(d.doc.id, leitor)).rejects.toThrow("Não preparar primeira emissão");
  });
  it("alteração de emitente invalida evidência e de produto invalida aprovação, sem override", async () => {
    const d = await massaDocumento(), vinculo = await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    await s.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { cnpj: "11111111111111" } });
    await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow("emitente");
    await s.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { cnpj: d.m.cadastro.cnpj } });
    await s.prisma.produtoVenda.update({ where: { id: d.produtoId }, data: { versao: 2 } });
    await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow("cadastro");
    expect((await s.prisma.planoFiscalBrasilNfe.findUniqueOrThrow({ where: { id: vinculo.planoId! } })).hashPayload).toBe(d.doc.hashPayload);
  });
  it("grupo é seleção explícita e exige classificações iguais à fotografia do produto", async () => {
    const d = await massaDocumento(55, true); expect((await vincularRegrasDocumentoBrasilNfe(d.selecao, editor)).montagemConcluida).toBe(true);
    const outro = await massaDocumento();
    await expect(vincularRegrasDocumentoBrasilNfe({ ...outro.selecao, itens: [{ itemId: outro.itemId, versaoId: d.item.id }] }, editor)).rejects.toThrow("fotografados");
  });
  it("grupo aprovado não dispensa revisão do produto nem conserva confirmação após alteração", async () => {
    const d = await massaDocumento(55, true); await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    await s.prisma.produtoVenda.update({ where: { id: d.produtoId }, data: { fiscalRevisado: false } });
    await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow("produto fotografado");
    await s.prisma.produtoVenda.update({ where: { id: d.produtoId }, data: { fiscalRevisado: true, versao: 2 } });
    await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow("produto fotografado");
  });
  it("plano, vínculos e modelo são imutáveis; referência válida não ativa produção", async () => {
    const d = await massaDocumento(), r = await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    await expect(s.prisma.planoFiscalBrasilNfe.update({ where: { id: r.planoId! }, data: { parametrosHash: "0".repeat(64) } })).rejects.toThrow();
    await expect(s.prisma.itemPlanoFiscalBrasilNfe.deleteMany({ where: { planoId: r.planoId! } })).rejects.toThrow();
    await expect(vincularRegrasDocumentoBrasilNfe({ ...d.selecao, modelo: 65 }, editor)).rejects.toThrow("modelo");
    await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { tentativas: 1 } });
    await expect(vincularRegrasDocumentoBrasilNfe(d.selecao, editor)).rejects.toThrow("processada");
  });
  it("inativação acrescenta versão, impede leitura operacional e preserva plano histórico", async () => {
    const d = await massaDocumento(); await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    const inativa = await inativarRegraTributariaBrasilNfe({ regraId: d.item.regraId, revisao: d.item.revisao }, editor);
    expect(inativa.estado).toBe("INATIVA"); expect(inativa.revisao).toBe(d.item.revisao + 1);
    await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow("aprovada");
    expect(await s.prisma.planoFiscalBrasilNfe.count({ where: { documentoId: d.doc.id } })).toBe(1);
  });
  it("bases ausentes são pendências do item, sem fabricar base monetária nem persistir plano", async () => {
    const d = await massaDocumento();
    await s.prisma.produtoVenda.update({ where: { id: d.produtoId }, data: { fiscal: { ...d.m.documento.payload.itens[0].fiscal.produto, csosn: "", cstIcms: "00" }, versao: 2 } });
    const novo = rascunhoRegraSintetica("PRODUTO"); novo.produtoId = d.produtoId; novo.regraId = d.item.regraId; novo.revisao = d.item.revisao;
    if (novo.conteudo.tipo !== "ITEM") throw new Error("Massa inválida"); novo.conteudo.perfil.classificacoes.csosn = ""; novo.conteudo.perfil.classificacoes.cstIcms = "00"; novo.conteudo.perfil.icms = { tratamento: "TRIBUTADO", AliquotaICMS: "18", modalidadeBcIcms: 3 };
    const regra = await salvarEAprovar(novo);
    // Outra fotografia sintética coerente. Nunca reescrever plano vinculado/real.
    const p = { ...d.m.documento.payload, itens: [{ ...d.m.documento.payload.itens[0], fiscal: { ...d.m.documento.payload.itens[0].fiscal, versaoCadastro: 2, produto: { ...d.m.documento.payload.itens[0].fiscal.produto, csosn: "", cstIcms: "00" } } }] };
    await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { payload: p, hashPayload: createHash("sha256").update(JSON.stringify(p)).digest("hex") } });
    const r = await vincularRegrasDocumentoBrasilNfe({ ...d.selecao, itens: [{ itemId: d.itemId, versaoId: regra.id }] }, editor);
    expect(r).toMatchObject({ planoId: null, montagemConcluida: false, transmissaoPermitida: false }); expect(r.pendencias).toContainEqual(expect.objectContaining({ itemId: d.itemId, produtoId: d.produtoId, campo: "Produtos[0].Imposto.ICMS.BaseCalculo", codigo: "AUSENTE", responsavel: "REVISAO_FISCAL" }));
    expect(await s.prisma.planoFiscalBrasilNfe.count({ where: { documentoId: d.doc.id } })).toBe(0);
  });
  it("POST de perfil operacional não aceita forma inexistente ou inativa no servidor", async () => {
    const atual = await s.prisma.regraFiscalBrasilNfe.findFirstOrThrow({ where: { alvo: "OPERACAO", modelo: 55 } });
    const entrada = { ...rascunhoRegraSintetica("OPERACAO"), regraId: atual.id, revisao: atual.revisao };
    if (entrada.conteudo.tipo !== "OPERACAO") throw new Error("Massa inválida");
    entrada.conteudo.pagamentos.mapeamentos[0].formaId = "forma-inexistente";
    const antes = await s.prisma.versaoRegraFiscalBrasilNfe.count({ where: { regraId: atual.id } });
    await expect(salvarRascunhoRegraTributariaBrasilNfe(entrada, editor)).rejects.toThrow("forma de pagamento ativa");
    entrada.conteudo.pagamentos.mapeamentos[0].formaId = "forma-ficticia";
    await s.prisma.formaPagamentoVenda.update({ where: { id: "forma-ficticia" }, data: { ativo: false } });
    try { await expect(salvarRascunhoRegraTributariaBrasilNfe(entrada, editor)).rejects.toThrow("forma de pagamento ativa"); }
    finally { await s.prisma.formaPagamentoVenda.update({ where: { id: "forma-ficticia" }, data: { ativo: true } }); }
    expect(await s.prisma.versaoRegraFiscalBrasilNfe.count({ where: { regraId: atual.id } })).toBe(antes);
  });
  it("inativação da forma entre rascunho e aprovação não conserva correspondência aprovada", async () => {
    const atual = await s.prisma.regraFiscalBrasilNfe.findFirstOrThrow({ where: { alvo: "OPERACAO", modelo: 55 } });
    const r = await salvarRascunhoRegraTributariaBrasilNfe({ ...rascunhoRegraSintetica("OPERACAO"), regraId: atual.id, revisao: atual.revisao }, editor);
    await s.prisma.formaPagamentoVenda.update({ where: { id: "forma-ficticia" }, data: { ativo: false } });
    try { await expect(aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor)).rejects.toThrow("forma de pagamento ativa"); }
    finally { await s.prisma.formaPagamentoVenda.update({ where: { id: "forma-ficticia" }, data: { ativo: true } }); }
    expect((await obterHistoricoRegraTributariaBrasilNfe(r.regraId, leitor)).versoes[0].estado).toBe("PROPOSTA");
  });
  it("forma inativada depois do plano bloqueia reutilização, sem reescrever histórico ou habilitar emissão", async () => {
    const d = await massaDocumento(), vinculo = await vincularRegrasDocumentoBrasilNfe(d.selecao, editor);
    await s.prisma.formaPagamentoVenda.update({ where: { id: "forma-ficticia" }, data: { ativo: false } });
    try {
      await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow("forma de pagamento ativa");
      await expect(vincularRegrasDocumentoBrasilNfe(d.selecao, editor)).rejects.toThrow("forma de pagamento ativa");
    } finally { await s.prisma.formaPagamentoVenda.update({ where: { id: "forma-ficticia" }, data: { ativo: true } }); }
    expect((await s.prisma.planoFiscalBrasilNfe.findUniqueOrThrow({ where: { id: vinculo.planoId! } })).hashPayload).toBe(d.doc.hashPayload);
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).acao).toBeNull();
  });
  it("fonte ausente não aprova; XML histórico ou sugestão continuam propostas insuficientes", async () => {
    for (const tipo of [null, "XML_HISTORICO", "SUGESTAO_IA", "EXEMPLO_API"] as const) {
      const d = await novaPropostaEmpresa();
      if (tipo) d.fundamentacaoFiscal.fontes[0].tipo = tipo;
      else { d.fundamentacaoFiscal.fontes = []; d.fundamentacaoFiscal.confianca = []; }
      const r = await salvarRascunhoRegraTributariaBrasilNfe(d, editor);
      await expect(aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor)).rejects.toThrow();
      expect((await obterHistoricoRegraTributariaBrasilNfe(r.regraId, editor)).versoes[0].estado).toBe("PROPOSTA");
    }
  });
  it("parecer especializado é fonte opcional, sem exigir prestador Confirp", async () => {
    const d = await novaPropostaEmpresa(); d.fundamentacaoFiscal.fontes[0].tipo = "PARECER_ESPECIALIZADO";
    const r = await salvarEAprovar(d); expect(r.estado).toBe("APROVADA"); expect(r.referenciaConfirp).toBeNull();
    expect(r.aprovacaoInterna?.aprovador.id).toBe(editor.userId);
  });
  it("revisão e bloqueio acrescentam versões e não emprestam aprovação a versão nova", async () => {
    const d = await novaPropostaEmpresa(), p = await salvarRascunhoRegraTributariaBrasilNfe(d, editor);
    const r = await enviarRegraParaRevisaoBrasilNfe({ regraId: p.regraId, revisao: p.revisao }, editor);
    expect(r.estado).toBe("EM_REVISAO"); expect(r.aprovacaoInterna).toBeNull();
    const a = await aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor);
    const b = await bloquearRegraTributariaBrasilNfe({ regraId: a.regraId, revisao: a.revisao }, editor);
    expect(b.estado).toBe("BLOQUEADA"); expect(b.aprovacaoInterna).toBeNull();
    const h = await obterHistoricoRegraTributariaBrasilNfe(p.regraId, editor);
    expect(h.versoes.slice(0, 4).map(v => v.estado)).toEqual(["BLOQUEADA", "APROVADA", "EM_REVISAO", "PROPOSTA"]);
    expect(h.versoes[1].aprovacaoHash).toBe(a.aprovacaoHash);
    const nova = await salvarRascunhoRegraTributariaBrasilNfe({ ...d, regraId: b.regraId, revisao: b.revisao }, editor);
    expect(nova.estado).toBe("PROPOSTA"); expect(nova.aprovacaoInterna).toBeNull(); expect(nova.aprovacaoHash).toBeNull();
  });
  it("cadastro alterado entre proposta e aprovação exige nova revisão, sem preservar confirmação obsoleta", async () => {
    const d = await massaDocumento(), entrada = rascunhoRegraSintetica(); entrada.produtoId = d.produtoId; entrada.regraId = d.item.regraId; entrada.revisao = d.item.revisao;
    const r = await salvarRascunhoRegraTributariaBrasilNfe(entrada, editor);
    await s.prisma.produtoVenda.update({ where: { id: d.produtoId }, data: { versao: 2 } });
    await expect(aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor)).rejects.toThrow("cadastro fiscal mudou");
    expect((await obterHistoricoRegraTributariaBrasilNfe(r.regraId, editor)).versoes[0].estado).toBe("PROPOSTA");
  });
  it("regra expirada e UF diversa não passam aprovação mesmo com confirmação e fonte", async () => {
    const d = await novaPropostaEmpresa(); d.vigenteAte = "2026-10-10";
    const r = await salvarRascunhoRegraTributariaBrasilNfe(d, editor);
    await expect(aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor)).rejects.toThrow("expirou");
    const outra = await novaPropostaEmpresa(); outra.fundamentacaoFiscal.contexto.uf = "RJ";
    const p = await salvarRascunhoRegraTributariaBrasilNfe(outra, editor);
    await expect(aprovarRegraTributariaBrasilNfe({ regraId: p.regraId, revisao: p.revisao, fundamentacaoHash: p.fundamentacaoHash, conteudoHash: p.conteudoHash, aplicacaoConferida: true }, editor)).rejects.toThrow("UF do fundamento");
  });
  it("ambiguidade material bloqueia o produto usado; outro produto fundamentado monta plano", async () => {
    const bom = await massaDocumento(), duvida = await massaDocumento();
    const entrada = rascunhoRegraSintetica(); Object.assign(entrada, { produtoId: duvida.produtoId, regraId: duvida.item.regraId, revisao: duvida.item.revisao });
    entrada.fundamentacaoFiscal.confianca.find(c => c.campo === "NCM")!.estado = "REVISAO_ESPECIALIZADA";
    const r = await salvarRascunhoRegraTributariaBrasilNfe(entrada, editor);
    await expect(aprovarRegraTributariaBrasilNfe({ regraId: r.regraId, revisao: r.revisao, fundamentacaoHash: r.fundamentacaoHash, conteudoHash: r.conteudoHash, aplicacaoConferida: true }, editor)).rejects.toThrow("NCM");
    await expect(vincularRegrasDocumentoBrasilNfe({ ...duvida.selecao, itens: [{ itemId: duvida.itemId, versaoId: r.id }] }, editor)).rejects.toThrow("aprovada");
    // Compartilhamento da regra EMPRESA/OPERACAO preserva a versão vigente do último documento.
    const selecaoBoa = { ...bom.selecao, empresaVersaoId: duvida.empresa.id, operacaoVersaoId: duvida.operacao.id };
    expect((await vincularRegrasDocumentoBrasilNfe(selecaoBoa, editor)).montagemConcluida).toBe(true);
  });
  it("fundamento interno não é reutilizado para endereço fiscal de outra UF", async () => {
    const d = await massaDocumento();
    const outraUf = { ...d.selecao, complementos: { ...d.selecao.complementos, destinatario: { ...d.selecao.complementos.destinatario!, uf: "RJ", codMunicipio: "3304557" } } };
    await expect(vincularRegrasDocumentoBrasilNfe(outraUf, editor)).rejects.toThrow("somente saídas internas");
    expect(await s.prisma.planoFiscalBrasilNfe.count({ where: { documentoId: d.doc.id } })).toBe(0);
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).tentativas).toBe(0);
    expect((await vincularRegrasDocumentoBrasilNfe(d.selecao, editor)).montagemConcluida).toBe(true);
  });
  it("legado Confirp permanece histórico e não é reavaliado como aprovação interna; planos antigos não são reescritos", async () => {
    const d = await massaDocumento(), dados = rascunhoRegraSintetica();
    const produto = await s.prisma.produtoVenda.create({ data: { nome: "Produto histórico exclusivamente sintético", fiscal: d.m.documento.payload.itens[0].fiscal.produto, fiscalRevisado: true } });
    const regra = await s.prisma.regraFiscalBrasilNfe.create({ data: { modelo: 55, operacao: "NF_E_VENDA", alvo: "PRODUTO", produtoId: produto.id, revisao: 1 } });
    const atual = await s.prisma.versaoRegraFiscalBrasilNfe.findUniqueOrThrow({ where: { id: d.item.id } });
    const conteudoLegado = validarConteudoRegraFiscalBrasilNfe(atual.conteudo, "PRODUTO");
    expect(hashRegraFiscalBrasilNfe(conteudoLegado)).toBe(atual.conteudoHash);
    const legada = await s.prisma.versaoRegraFiscalBrasilNfe.create({ data: { regraId: regra.id, revisao: 1, estado: "APROVADA", referenciaConfirp: "REFERENCIA-LEGADA-SOMENTE-TESTE", vigenteDesde: atual.vigenteDesde, vigenteAte: atual.vigenteAte, responsavelId: editor.userId, emitenteHash: atual.emitenteHash, versaoCadastro: 1, fiscalCadastroHash: atual.fiscalCadastroHash, conteudo: conteudoLegado, conteudoHash: atual.conteudoHash } });
    await expect(vincularRegrasDocumentoBrasilNfe({ ...d.selecao, itens: [{ itemId: d.itemId, versaoId: legada.id }] }, editor)).rejects.toThrow("Versão legada");
    const parametros = { ...d.m.parametros, vinculo: { documentoId: d.doc.id, hashPayload: d.doc.hashPayload, revisaoPedido: 1 } };
    const historicoPlano = await s.prisma.planoFiscalBrasilNfe.create({ data: { documentoId: d.doc.id, modelo: 55, hashPayload: d.doc.hashPayload, revisaoPedido: 1, emitenteHash: atual.emitenteHash, parametros, parametrosHash: hashRegraFiscalBrasilNfe(parametros), verificadoEm: "2026-10-10", responsavelId: editor.userId, versoes: { create: [{ papel: "ITEM:historico", versaoId: legada.id }] } } });
    await s.prisma.documentoFiscalSaida.update({ where: { id: d.doc.id }, data: { status: "AUTORIZADO", protocolo: "123456789012345", modeloDocumento: 55 } });
    Object.assign(dados, { regraId: regra.id, revisao: 1, produtoId: produto.id });
    const nova = await salvarEAprovar(dados);
    expect(nova.legado).toBe(false); expect(nova.referenciaConfirp).toBeNull();
    expect((await obterHistoricoRegraTributariaBrasilNfe(regra.id, editor)).versoes.at(-1)).toMatchObject({ id: legada.id, referenciaConfirp: "REFERENCIA-LEGADA-SOMENTE-TESTE", legado: true, fundamentacaoFiscal: null, aprovacaoInterna: null });
    expect((await s.prisma.planoFiscalBrasilNfe.findUniqueOrThrow({ where: { id: historicoPlano.id } })).parametrosHash).toBe(historicoPlano.parametrosHash);
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.doc.id } })).protocolo).toBe("123456789012345");
    await expect(obterComplementosAprovadosDocumentoBrasilNfe(d.doc.id, editor)).rejects.toThrow();
  });
});
