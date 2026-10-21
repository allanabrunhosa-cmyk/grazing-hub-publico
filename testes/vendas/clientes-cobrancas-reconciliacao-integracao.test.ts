import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { aplicarReconciliacao, hashReconciliacao, inspecionarFontesReconciliacao, prepararReconciliacao, prepararReversaoReconciliacao, reverterReconciliacao, type ConfiguracaoReconciliacao } from "@/lib/vendas/clientes-cobrancas-reconciliacao";
import type { EnderecoVenda } from "@/lib/vendas/dominio";

const schema = `teste_reconciliacao_cobrancas_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, db: PrismaClient | undefined, criado = false, usuarioId: string, sequencia = 0;
function endereco(documento: string, numero = "10"): EnderecoVenda { return { nome: "Principal", tipo: "PJ", documento, nomeCompleto: "", razaoSocial: "Empresa inteiramente sintética", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "12345", destinatario: "Empresa inteiramente sintética", pais: "Brasil", cep: "01001000", logradouro: "Rua de teste", numero, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" }; }
async function montar() {
  const indice = ++sequencia, velho = `${String(indice).padStart(5, "0")}111000199`, novo = `${String(indice).padStart(5, "0")}222000199`;
  const raiz = await db!.clienteVenda.create({ data: { nome: "Fantasia anterior sintética", tipo: "PJ", documento: velho, razaoSocial: "Empresa inteiramente sintética", email: `compras-${indice}@example.invalid`, enderecos: [endereco(velho, "15")] } });
  const alias = await db!.clienteVenda.create({ data: { nome: "Empresa inteiramente sintética", tipo: "PJ", documento: novo, razaoSocial: "Empresa inteiramente sintética", email: raiz.email, unificadoEmId: raiz.id, ativo: false, enderecos: [] } });
  const pedido = await db!.pedidoVenda.create({ data: { criadoPorId: usuarioId, chaveCriacao: randomUUID(), hashCriacao: "sintetico", clienteId: raiz.id, status: "CONFIRMADO", atendimento: "ENTREGA", cobrancaSnapshot: endereco(velho, "15"), destinatarioSnapshot: { nome: "Destinatário sintético", contato: "" }, enderecoSnapshot: { ...endereco(velho, "99"), tipo: undefined, documento: undefined }, total: "123.45" } });
  const fonte = await db!.identidadeExternaVenda.create({ data: { origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "PEDIDO_HISTORICO", chave: pedido.id, destinoId: pedido.id, resumoOrigem: "conteudo-preservado", versaoDestino: 1, dadosOrigem: { registro: { nomeOriginal: "Nome sintético que não pode mudar" } } } });
  const fiscal = await db!.documentoFiscalSaida.create({ data: { pedidoId: pedido.id, versaoPedido: 1, payload: { sintetico: true, documento: velho }, hashPayload: "preservar", criadoPorId: usuarioId, criadoPorNome: "Autor de teste sintético" } });
  const config: ConfiguracaoReconciliacao = { versao: 1, operacaoId: `operacao-sintetica-${randomUUID()}`, revisaoCodigo: "a".repeat(40), atorSistema: "teste-sintetico-reconciliacao", alvo: { id: raiz.id, email: raiz.email!, versao: raiz.versao }, nomeCliente: "Fantasia atualizada sintética", principal: endereco(novo), mapeamentos: [], copiarCobrancasParaEntrega: true,
    reservaPrincipal: { aliasId: alias.id, versao: alias.versao, sha256: hashReconciliacao(alias), titularComprovado: endereco(novo) } };
  return { raiz, alias, pedido, fonte, fiscal, config };
}
describe.skipIf(process.env.CLIENTES_RECONCILIACAO_PG_TESTE !== "1")("reconciliação no PostgreSQL local sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/.test(url.pathname) || process.env.CLIENTES_RECONCILIACAO_AMBIENTE_ISOLADO !== "1") throw Error("Somente base local de teste explicitamente isolada.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    expect((await banco.query("SELECT current_database() AS banco")).rows[0].banco).toBe(url.pathname.slice(1));
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await db.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    usuarioId = (await db.usuario.create({ data: { nome: "Autor fixture sintética", email: "fixture-reconciliacao@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } })).id;
    vi.stubEnv("CLIENTES_RECONCILIACAO_AUTORIZADA", "SIM");
  }, 120_000);
  afterAll(async () => {
    vi.unstubAllEnvs(); await db?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_reconciliacao_cobrancas_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`);
    await banco.end();
  });
  it("mantém whitelist e proveniência obrigatória das fontes técnicas e históricas", async () => {
    for (const contexto of [{ entidade: "RECONCILIACAO_COBRANCAS", origem: "origem-incorreta", loja: "grazing-hub" }, { entidade: "RECONCILIACAO_COBRANCAS", origem: "MANUTENCAO_CLIENTES_V1", loja: "loja-incorreta" }, { entidade: "INEXISTENTE", origem: "MANUTENCAO_CLIENTES_V1", loja: "grazing-hub" }, { entidade: "PEDIDO_HISTORICO", origem: "origem-incorreta", loja: "grazing-hub" }]) {
      await expect(db!.identidadeExternaVenda.create({ data: { ...contexto, chave: randomUUID(), destinoId: "sintetico", resumoOrigem: "sintetico", dadosOrigem: {}, versaoDestino: 1 } })).rejects.toThrow(/check constraint/);
    }
  });
  it("as três consultas usam transação de banco somente leitura", async () => {
    const d = await montar();
    const leitura = { $transaction: (executar: (tx: Prisma.TransactionClient) => Promise<unknown>, opcoes: object) => db!.$transaction(async tx => {
      const resultado = await executar(tx);
      expect(await tx.$queryRaw`SELECT current_setting('transaction_read_only') AS leitura`).toEqual([{ leitura: "on" }]);
      return resultado;
    }, opcoes) } as unknown as Parameters<typeof prepararReconciliacao>[1];
    await inspecionarFontesReconciliacao(d.config, leitura);
    const previa = await prepararReconciliacao(d.config, leitura); await aplicarReconciliacao(d.config, previa.token, db);
    await prepararReversaoReconciliacao(d.config, leitura);
  });
  it("transfere CNPJ reservado no mesmo grupo, registra ator Sistema e preserva pedidos, fontes e fiscal", async () => {
    const d = await montar(), cadastrosAntes = await db!.historicoCadastroVenda.count(), atividadesAntes = await db!.atividadeUsuario.count();
    const previa = await prepararReconciliacao(d.config, db); expect(previa.aplicavel).toBe(true); expect(await db!.atividadeUsuario.count()).toBe(atividadesAntes);
    await aplicarReconciliacao(d.config, previa.token, db);
    const alias = await db!.clienteVenda.findUniqueOrThrow({ where: { id: d.alias.id } }), raiz = await db!.clienteVenda.findUniqueOrThrow({ where: { id: d.raiz.id } });
    expect(alias.documento).toBeNull(); expect(alias.enderecos).toEqual([expect.objectContaining({ documento: d.alias.documento })]); expect(raiz.documento).toBe(d.alias.documento);
    expect(await db!.pedidoVenda.findUnique({ where: { id: d.pedido.id } })).toEqual(d.pedido);
    expect(await db!.identidadeExternaVenda.findUnique({ where: { id: d.fonte.id } })).toEqual(d.fonte);
    expect(await db!.documentoFiscalSaida.findUnique({ where: { id: d.fiscal.id } })).toEqual(d.fiscal);
    expect(await db!.historicoCadastroVenda.count()).toBe(cadastrosAntes);
    const atividade = await db!.atividadeUsuario.findFirstOrThrow({ where: { correlacaoId: d.config.operacaoId } });
    expect(atividade).toMatchObject({ atorTipo: "SISTEMA", autorId: null, atorReferencia: d.config.atorSistema });
    const total = await db!.identidadeExternaVenda.count(); await expect(aplicarReconciliacao(d.config, previa.token, db)).resolves.toMatchObject({ jaAplicada: true }); expect(await db!.identidadeExternaVenda.count()).toBe(total);
  });
  it("reverte reserva e cadastro atomicamente com versões crescentes", async () => {
    const d = await montar(), previa = await prepararReconciliacao(d.config, db); await aplicarReconciliacao(d.config, previa.token, db);
    const reversao = await prepararReversaoReconciliacao(d.config, db); await reverterReconciliacao(d.config, reversao.token, db);
    const raiz = await db!.clienteVenda.findUniqueOrThrow({ where: { id: d.raiz.id } }), alias = await db!.clienteVenda.findUniqueOrThrow({ where: { id: d.alias.id } });
    expect(raiz).toEqual({ ...d.raiz, versao: d.raiz.versao + 2, updatedAt: raiz.updatedAt }); expect(alias).toEqual({ ...d.alias, versao: d.alias.versao + 2, updatedAt: alias.updatedAt });
    expect(await db!.pedidoVenda.findUnique({ where: { id: d.pedido.id } })).toEqual(d.pedido);
  });
  it("recusa edição posterior à aplicação e mantém todo o estado atual", async () => {
    const d = await montar(), previa = await prepararReconciliacao(d.config, db); await aplicarReconciliacao(d.config, previa.token, db);
    await db!.clienteVenda.update({ where: { id: d.raiz.id }, data: { observacoes: "Edição posterior sintética", versao: { increment: 1 } } });
    await expect(prepararReversaoReconciliacao(d.config, db)).rejects.toThrow("RECONCILIACAO_REVERSAO_ESTADO_DIVERGENTE");
  });
  it("recusa fonte alterada depois da prévia sem mudar perfis", async () => {
    const d = await montar(), previa = await prepararReconciliacao(d.config, db);
    await db!.identidadeExternaVenda.update({ where: { id: d.fonte.id }, data: { resumoOrigem: "alteração sintética" } });
    await expect(aplicarReconciliacao(d.config, previa.token, db)).rejects.toThrow("RECONCILIACAO_PREVIA_DIVERGENTE");
    expect(await db!.clienteVenda.findUnique({ where: { id: d.raiz.id } })).toEqual(d.raiz); expect(await db!.clienteVenda.findUnique({ where: { id: d.alias.id } })).toEqual(d.alias);
  });
  it("concorrência não duplica operação ou atividade; repetição converge à aplicação existente", async () => {
    const d = await montar(), previa = await prepararReconciliacao(d.config, db);
    const resultados = await Promise.allSettled([aplicarReconciliacao(d.config, previa.token, db), aplicarReconciliacao(d.config, previa.token, db)]);
    expect(resultados.some(r => r.status === "fulfilled")).toBe(true);
    await expect(aplicarReconciliacao(d.config, previa.token, db)).resolves.toMatchObject({ jaAplicada: true });
    expect(await db!.identidadeExternaVenda.count({ where: { origem: "MANUTENCAO_CLIENTES_V1", chave: d.config.operacaoId } })).toBe(1);
    expect(await db!.atividadeUsuario.count({ where: { correlacaoId: d.config.operacaoId } })).toBe(1);
  });
});
