import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
vi.mock("server-only", () => ({})); vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { hashReconciliacao } from "@/lib/vendas/clientes-cobrancas-reconciliacao";
import { aplicarEquivalencias, inspecionarFontesEquivalencias, prepararEquivalencias, prepararReversaoEquivalencias, reverterEquivalencias, type ConfiguracaoEquivalencias } from "@/lib/vendas/clientes-enderecos-equivalencias";
import type { EnderecoVenda, EntregaCliente } from "@/lib/vendas/dominio";

const schema = `teste_equivalencias_entregas_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, db: PrismaClient | undefined, criado = false, clienteId: string, aliasId: string, pedidoId: string, fonteId: string, fiscalId: string;
function endereco(complemento = ""): EnderecoVenda { return { nome: "Principal", tipo: "PF", documento: "", nomeCompleto: "Pessoa sintética", destinatario: "Pessoa sintética", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "100", complemento, bairro: "Centro", cidade: "São Paulo", uf: "SP" }; }
function entrega(complemento = "", nome = "Pessoa sintética"): EntregaCliente { return { destinatario: { nome, contato: "+5511900001111" }, endereco: endereco(complemento) }; }
const evidencia = { aprovacaoSha256: "b".repeat(64), backupSha256: "c".repeat(64), artefatoSha256: "d".repeat(64) };
async function montar() {
  const a = entrega("Bloco II", "Primeiro destinatário"), b = entrega("", "Destinatário selecionado"), fora = entrega("Prédio A", "Destinatário externo"); b.endereco.cep = "01002000"; b.endereco.bairro = "Jardim Teste"; b.textoOriginal = "Shipping original sintético"; fora.endereco.numero = "200";
  const cliente = await db!.clienteVenda.update({ where: { id: clienteId }, data: { observacoes: "Preservar cadastro", versao: { increment: 1 }, enderecos: [endereco()], entregaPadrao: { ...b, enderecos: [a, b, fora], selecionado: 1 } } });
  const config: ConfiguracaoEquivalencias = { versao: 1, modo: "UNIFICAR_ENTREGAS_EQUIVALENTES", operacaoId: `equivalencias-sinteticas-${randomUUID()}`, revisaoCodigo: "a".repeat(40), atorSistema: "teste-sintetico", alvo: { id: clienteId, versao: cliente.versao, estadoSha256: hashReconciliacao(cliente) }, grupos: [{ id: "grupo-sintetico", entradas: [a, b].map((e, indice) => ({ indice, sha256: hashReconciliacao(e) })), indiceManter: 0, motivo: "Mesmo imóvel em revisão sintética", complementoFinal: "Bloco II", permitirCodigosLojaComoReferencia: false }] };
  return { cliente, config, opcoes: { banco: db! } };
}
async function protegidos() { return Promise.all([db!.pedidoVenda.findUnique({ where: { id: pedidoId } }), db!.clienteVenda.findUnique({ where: { id: aliasId } }), db!.identidadeExternaVenda.findUnique({ where: { id: fonteId } }), db!.documentoFiscalSaida.findUnique({ where: { id: fiscalId } })]); }

describe.skipIf(process.env.CLIENTES_EQUIVALENCIAS_PG_TESTE !== "1")("equivalências no PostgreSQL local sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/.test(url.pathname) || process.env.CLIENTES_EQUIVALENCIAS_AMBIENTE_ISOLADO !== "1") throw Error("Somente base local de teste explicitamente isolada.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await db.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const usuario = await db.usuario.create({ data: { nome: "Fixture sintética", email: "fixture-equivalencias@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    clienteId = (await db.clienteVenda.create({ data: { nome: "Pessoa sintética", tipo: "PF", email: "equivalencias@example.invalid", enderecos: [endereco()] } })).id;
    aliasId = (await db.clienteVenda.create({ data: { nome: "Alias sintético", tipo: "PF", email: "equivalencias@example.invalid", unificadoEmId: clienteId, ativo: false } })).id;
    pedidoId = (await db.pedidoVenda.create({ data: { clienteId, criadoPorId: usuario.id, chaveCriacao: randomUUID(), hashCriacao: "sintetico", status: "CONFIRMADO", compradorSnapshot: { nomeOriginal: "Não alterar" }, cobrancaSnapshot: endereco("Sala 9"), enderecoSnapshot: endereco("Prédio B"), destinatarioSnapshot: { nome: "Entrega antiga selecionada", contato: "+5511900002222" }, total: "123.45" } })).id;
    fonteId = (await db.identidadeExternaVenda.create({ data: { origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "PEDIDO_HISTORICO", chave: pedidoId, destinoId: pedidoId, resumoOrigem: "original", dadosOrigem: { registro: { original: "Não alterar raw sintético" } }, versaoDestino: 1 } })).id;
    fiscalId = (await db.documentoFiscalSaida.create({ data: { pedidoId, versaoPedido: 1, payload: { original: "Não alterar fiscal sintético" }, hashPayload: "original", criadoPorId: usuario.id, criadoPorNome: usuario.nome } })).id;
    vi.stubEnv("CLIENTES_EQUIVALENCIAS_AUTORIZADAS", "SIM");
  }, 120_000);
  afterAll(async () => { vi.unstubAllEnvs(); await db?.$disconnect(); if (!banco) return; try { if (criado && /^teste_equivalencias_entregas_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); } finally { await banco.end(); } });
  it("muda somente entregas da raiz e preserva alias, pedidos/snapshots, raw e fiscal", async () => {
    const d = await montar(), antes = await protegidos(), fontes = await inspecionarFontesEquivalencias(clienteId, d.opcoes); expect(fontes.estadoSha256).toBe(d.config.alvo.estadoSha256);
    const previa = await prepararEquivalencias(d.config, d.opcoes); expect(previa).toMatchObject({ aplicavel: true, selecionadoDepois: 0, contagens: { entregasAntes: 3, entregasDepois: 2, entregasUnificadas: 1 } });
    await aplicarEquivalencias(d.config, previa, evidencia, d.opcoes); expect(await protegidos()).toEqual(antes);
    const atual = await db!.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } }), semEntrega = (p: typeof atual) => Object.fromEntries(Object.entries(p).filter(([k]) => !["entregaPadrao", "versao", "updatedAt"].includes(k))); expect(semEntrega(atual)).toEqual(semEntrega(d.cliente));
    expect(atual.entregaPadrao).toMatchObject({ selecionado: 0, destinatario: { nome: "Destinatário selecionado" }, textoOriginal: "Shipping original sintético", endereco: { complemento: "Bloco II" } });
    expect(await db!.atividadeUsuario.findFirst({ where: { correlacaoId: d.config.operacaoId } })).toMatchObject({ atorTipo: "SISTEMA", autorId: null });
    const registro = await db!.identidadeExternaVenda.findFirstOrThrow({ where: { chave: `equivalencias:${d.config.operacaoId}` } }); expect(registro.dadosOrigem).toMatchObject({ antes: { entregaPadrao: d.cliente.entregaPadrao }, depois: { entregaPadrao: atual.entregaPadrao }, evidencia });
    await expect(aplicarEquivalencias(d.config, previa, evidencia, d.opcoes)).resolves.toMatchObject({ jaAplicado: true });
  });
  it("reversão restaura livro e seleção completos, com versão crescente e replay idempotente", async () => {
    const d = await montar(), antes = await protegidos(), previa = await prepararEquivalencias(d.config, d.opcoes); await aplicarEquivalencias(d.config, previa, evidencia, d.opcoes);
    const reversao = await prepararReversaoEquivalencias(d.config, d.opcoes); await reverterEquivalencias(d.config, reversao.token, evidencia, d.opcoes);
    const atual = await db!.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } }); expect(atual).toEqual({ ...d.cliente, versao: d.cliente.versao + 2, updatedAt: atual.updatedAt }); expect(await protegidos()).toEqual(antes);
    await expect(reverterEquivalencias(d.config, reversao.token, evidencia, d.opcoes)).resolves.toMatchObject({ jaRevertido: true });
  });
  it("estado alterado após prévia bloqueia escrita integralmente", async () => {
    const d = await montar(), previa = await prepararEquivalencias(d.config, d.opcoes); await db!.clienteVenda.update({ where: { id: clienteId }, data: { observacoes: "Edição concorrente sintética", versao: { increment: 1 } } });
    await expect(aplicarEquivalencias(d.config, previa, evidencia, d.opcoes)).rejects.toThrow("EQUIVALENCIAS_ESTADO_DIVERGENTE"); expect(await db!.identidadeExternaVenda.count({ where: { chave: `equivalencias:${d.config.operacaoId}` } })).toBe(0);
  });
  it("concorrência grava somente uma operação e uma atividade", async () => {
    const d = await montar(), previa = await prepararEquivalencias(d.config, d.opcoes); const tentativas = await Promise.allSettled([aplicarEquivalencias(d.config, previa, evidencia, d.opcoes), aplicarEquivalencias(d.config, previa, evidencia, d.opcoes)]); expect(tentativas.some(r => r.status === "fulfilled")).toBe(true);
    await expect(aplicarEquivalencias(d.config, previa, evidencia, d.opcoes)).resolves.toMatchObject({ jaAplicado: true }); expect(await db!.identidadeExternaVenda.count({ where: { chave: `equivalencias:${d.config.operacaoId}` } })).toBe(1); expect(await db!.atividadeUsuario.count({ where: { correlacaoId: d.config.operacaoId } })).toBe(1);
  });
});
