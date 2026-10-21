import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
vi.mock("server-only", () => ({})); vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { hashReconciliacao } from "@/lib/vendas/clientes-cobrancas-reconciliacao";
import { aplicarSaneamento, inspecionarCadastroSaneamento, prepararReversaoSaneamento, prepararSaneamento, reverterSaneamento, type ConfiguracaoSaneamento } from "@/lib/vendas/clientes-enderecos-saneamento";
import type { EnderecoVenda, EntregaCliente } from "@/lib/vendas/dominio";

const schema = `teste_saneamento_enderecos_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, db: PrismaClient | undefined, criado = false, clienteId: string, aliasId: string, pedidoId: string, fonteId: string, fiscalId: string;
const A = "11222333000181", B = "11444777000161";
function endereco(documento = A, numero = "1"): EnderecoVenda { return { nome: "Principal", tipo: "PJ", documento, nomeCompleto: "", razaoSocial: "Empresa sintética anterior", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "", destinatario: "Pessoa sintética", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" }; }
function entrega(numero = "1", nome = "Pessoa sintética"): EntregaCliente { return { destinatario: { nome, contato: "" }, endereco: endereco(A, numero) }; }
const consultar = vi.fn(async () => ({ cadastro: { razaoSocial: "Empresa pública sintética", endereco: { pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" } } }));
const evidencia = { aprovacaoSha256: "b".repeat(64), backupSha256: "c".repeat(64), artefatoSha256: "d".repeat(64) };
async function montar() {
  const a = entrega(), b = entrega("1", "Destinatário distinto"), incompleta = entrega("", "Destinatário original"), real = entrega("8", "Pessoa no destino real"); incompleta.textoOriginal = "Original sintético sem número comprovado";
  const cliente = await db!.clienteVenda.update({ where: { id: clienteId }, data: { razaoSocial: "Empresa sintética anterior", observacoes: "Preservar cadastro", versao: { increment: 1 }, enderecos: [endereco(), endereco(B, "9"), { ...endereco("", "7"), razaoSocial: "", inscricaoEstadual: "", titularPendente: true }], entregaPadrao: { ...b, enderecos: [a, b, incompleta, real], selecionado: 1 } } });
  const config: ConfiguracaoSaneamento = { versao: 1, modo: "SANEAR_ENDERECOS", operacaoId: `saneamento-sintetico-${randomUUID()}`, revisaoCodigo: "a".repeat(40), atorSistema: "teste-sintetico", alvo: { id: clienteId, versao: cliente.versao, estadoSha256: hashReconciliacao(cliente) }, politicaIncompletos: "REMOVER", copiarCobrancasParaEntrega: true };
  return { cliente, config, opcoes: { banco: db!, consultar } };
}
describe.skipIf(process.env.CLIENTES_SANEAMENTO_PG_TESTE !== "1")("saneamento no PostgreSQL local sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/.test(url.pathname) || process.env.CLIENTES_SANEAMENTO_AMBIENTE_ISOLADO !== "1") throw Error("Somente base local de teste explicitamente isolada.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await db.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const usuario = await db.usuario.create({ data: { nome: "Fixture sintética", email: "fixture-saneamento@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    clienteId = (await db.clienteVenda.create({ data: { nome: "Fantasia sintética", tipo: "PJ", documento: A, razaoSocial: "Empresa sintética anterior", email: "saneamento@example.invalid", enderecos: [endereco()] } })).id;
    aliasId = (await db.clienteVenda.create({ data: { nome: "Alias sintético", tipo: "PJ", documento: B, email: "saneamento@example.invalid", unificadoEmId: clienteId, ativo: false } })).id;
    pedidoId = (await db.pedidoVenda.create({ data: { clienteId, criadoPorId: usuario.id, chaveCriacao: randomUUID(), hashCriacao: "sintetico", status: "CONFIRMADO", compradorSnapshot: { nomeOriginal: "Não alterar" }, cobrancaSnapshot: endereco(B, "99"), total: "123.45" } })).id;
    fonteId = (await db.identidadeExternaVenda.create({ data: { origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "PEDIDO_HISTORICO", chave: pedidoId, destinoId: pedidoId, resumoOrigem: "original", dadosOrigem: { registro: { original: "Não alterar raw sintético" } }, versaoDestino: 1 } })).id;
    fiscalId = (await db.documentoFiscalSaida.create({ data: { pedidoId, versaoPedido: 1, payload: { original: "Não alterar fiscal sintético" }, hashPayload: "original", criadoPorId: usuario.id, criadoPorNome: usuario.nome } })).id;
    vi.stubEnv("CLIENTES_SANEAMENTO_AUTORIZADO", "SIM");
  }, 120_000);
  afterAll(async () => { vi.unstubAllEnvs(); await db?.$disconnect(); if (!banco) return; if (criado && /^teste_saneamento_enderecos_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); await banco.end(); });
  it("saneia somente cadastro, audita Sistema e preserva pedidos, aliases, raw e fiscal", async () => {
    const d = await montar(), antes = await Promise.all([db!.pedidoVenda.findUnique({ where: { id: pedidoId } }), db!.clienteVenda.findUnique({ where: { id: aliasId } }), db!.identidadeExternaVenda.findUnique({ where: { id: fonteId } }), db!.documentoFiscalSaida.findUnique({ where: { id: fiscalId } })]);
    const cadastro = await inspecionarCadastroSaneamento(clienteId, d.opcoes); expect(cadastro.estadoSha256).toBe(d.config.alvo.estadoSha256);
    const previa = await prepararSaneamento(d.config, d.opcoes); expect(previa).toMatchObject({ aplicavel: true, contagens: { cobrancasDepois: 1, cobrancasIncompletas: 1, cobrancasUnificadas: 1, entregasDepois: 2, entregasIncompletas: 1, entregasUnificadas: 1 } });
    await aplicarSaneamento(d.config, previa, evidencia, d.opcoes);
    expect(await Promise.all([db!.pedidoVenda.findUnique({ where: { id: pedidoId } }), db!.clienteVenda.findUnique({ where: { id: aliasId } }), db!.identidadeExternaVenda.findUnique({ where: { id: fonteId } }), db!.documentoFiscalSaida.findUnique({ where: { id: fiscalId } })])).toEqual(antes);
    expect(await db!.atividadeUsuario.findFirst({ where: { correlacaoId: d.config.operacaoId } })).toMatchObject({ atorTipo: "SISTEMA", autorId: null });
    const registro = await db!.identidadeExternaVenda.findFirstOrThrow({ where: { chave: `sanear:${d.config.operacaoId}` } }); expect(registro.dadosOrigem).toMatchObject({ antes: { enderecos: [{ documento: A }, { documento: B }, { titularPendente: true }] } });
    await expect(aplicarSaneamento(d.config, previa, evidencia, d.opcoes)).resolves.toMatchObject({ jaAplicado: true });
  });
  it("reversão restaura livros incompletos e raw privados sem impor contrato novo ao snapshot antigo", async () => {
    const d = await montar(), previa = await prepararSaneamento(d.config, d.opcoes); await aplicarSaneamento(d.config, previa, evidencia, d.opcoes);
    const reversao = await prepararReversaoSaneamento(d.config, d.opcoes); await reverterSaneamento(d.config, reversao.token, evidencia, d.opcoes);
    const atual = await db!.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } }); expect(atual).toEqual({ ...d.cliente, versao: d.cliente.versao + 2, updatedAt: atual.updatedAt });
    await expect(reverterSaneamento(d.config, reversao.token, evidencia, d.opcoes)).resolves.toMatchObject({ jaRevertido: true });
  });
  it("estado alterado após prévia bloqueia a aplicação atômica", async () => {
    const d = await montar(), previa = await prepararSaneamento(d.config, d.opcoes); await db!.clienteVenda.update({ where: { id: clienteId }, data: { observacoes: "Edição concorrente sintética", versao: { increment: 1 } } });
    await expect(aplicarSaneamento(d.config, previa, evidencia, d.opcoes)).rejects.toThrow("SANEAMENTO_ESTADO_DIVERGENTE"); expect(await db!.identidadeExternaVenda.count({ where: { chave: `sanear:${d.config.operacaoId}` } })).toBe(0);
  });
  it("concorrência grava somente uma operação e uma atividade", async () => {
    const d = await montar(), previa = await prepararSaneamento(d.config, d.opcoes);
    const tentativas = await Promise.allSettled([aplicarSaneamento(d.config, previa, evidencia, d.opcoes), aplicarSaneamento(d.config, previa, evidencia, d.opcoes)]); expect(tentativas.some(r => r.status === "fulfilled")).toBe(true);
    await expect(aplicarSaneamento(d.config, previa, evidencia, d.opcoes)).resolves.toMatchObject({ jaAplicado: true }); expect(await db!.identidadeExternaVenda.count({ where: { chave: `sanear:${d.config.operacaoId}` } })).toBe(1); expect(await db!.atividadeUsuario.count({ where: { correlacaoId: d.config.operacaoId } })).toBe(1);
  });
});
