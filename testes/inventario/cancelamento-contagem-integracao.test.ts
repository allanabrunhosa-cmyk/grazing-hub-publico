import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient } from "@/generated/prisma/client";
const simulacao = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return simulacao.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("server-only", () => ({}));
import { excluirContagemAction, finalizarContagemAction, salvarItemContagemAction } from "@/app/(protegido)/inventario/contagem/actions";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
const esquema = "teste_contagem_" + randomUUID().replaceAll("-", "");
let banco: Client | undefined;
let esquemaCriado = false;
const confirmacao = { confirmarEstorno: true as const, motivo: "Quantidades incorretas na conferência" };
const permissoes = { "inventario.contagem": ["visualizar", "editar", "excluir"] };
function conectar(admin = true) { simulacao.sessao.mockResolvedValue({ userId: admin ? "admin" : "equipe", nome: admin ? "Administrador atual" : "Equipe", admin, versao: 0, permissoes, excecoes: {} }); }
async function saldo(id = "a") { return Number((await simulacao.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: id, localId: "local" } } })).quantidadeAtual); }
async function criar(finalizar = true) {
  const c = await simulacao.prisma.inventarioContagem.create({ data: { localId: "local", responsavelId: "equipe", itens: { create: [
    { insumoId: "a", quantidadeSistema: 10, quantidadeContada: 13.125, contado: true },
    { insumoId: "b", quantidadeSistema: 10, quantidadeContada: 8, contado: true },
    { insumoId: "c", quantidadeSistema: 10, quantidadeContada: 10, contado: false },
  ] } }, include: { itens: true } });
  if (finalizar) expect(await finalizarContagemAction(c.id)).toEqual({ ok: true, ajustes: 2 });
  return c;
}
describe.skipIf(process.env.CONTAGEM_BANCO_TESTE !== "1")("cancelamento de contagem no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) {
      throw new Error("Os testes de contagem só podem executar no PostgreSQL local.");
    }
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    esquemaCriado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true }))
      .filter(pasta => pasta.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) {
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    simulacao.prisma = new PrismaClient({ adapter: new PrismaPg({
      connectionString: endereco.toString(), options: `-c search_path=${esquema}`,
    }, { schema: esquema }) });
    // As consultas SQL das travas precisam atingir o mesmo schema das consultas Prisma.
    expect(await simulacao.prisma.$queryRaw`SELECT current_schema() AS esquema`)
      .toEqual([{ esquema }]);
  }, 60_000);

  afterAll(async () => {
    await simulacao.prisma?.$disconnect();
    if (!banco) return;
    await banco.query("ROLLBACK");
    if (esquemaCriado) {
      if (!/^teste_contagem_[a-f0-9]{32}$/.test(esquema)) throw new Error("Schema de teste inválido.");
      await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    }
    await banco.end();
  });


  beforeEach(async () => {
    vi.clearAllMocks();
    await banco!.query('TRUNCATE "Usuario", "Insumo", "LocalEstoque" CASCADE');
    await simulacao.prisma.perfilAcesso.upsert({ where: { id: "perfil-administrador" }, create: { id: "perfil-administrador", nome: "Admin teste", sistema: "ADMINISTRADOR", permissoes: {} }, update: {} });
    await simulacao.prisma.perfilAcesso.upsert({ where: { id: "equipe-perfil" }, create: { id: "equipe-perfil", nome: "Equipe teste", permissoes }, update: {} });
    await simulacao.prisma.usuario.createMany({ data: [
      { id: "admin", nome: "Administrador atual", email: "admin@example.invalid", senhaHash: "sem-login", perfilAcessoId: "perfil-administrador" },
      { id: "equipe", nome: "Equipe", email: "equipe@example.invalid", senhaHash: "sem-login", perfilAcessoId: "equipe-perfil" },
    ] });
    await simulacao.prisma.localEstoque.create({ data: { id: "local", nome: "Local fictício" } });
    for (const id of ["a", "b", "c"]) {
      await simulacao.prisma.insumo.create({ data: { id, nome: id, unidade: "KG", custoMedio: 12 } });
      await simulacao.prisma.saldoEstoque.create({ data: { insumoId: id, localId: "local", quantidadeAtual: 10 } });
    }
    conectar();
  });
  it("estorna entrada e saída, preserva movimentos posteriores, custo, itens e autoria", async () => {
    const c = await criar();
    const originais = await simulacao.prisma.movimentacaoEstoque.findMany({ orderBy: { id: "asc" } });
    await registrarMovimentacao({ insumoId: "a", localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 12 });
    await registrarMovimentacao({ insumoId: "b", localId: "local", tipo: "ENTRADA_COMPRA", quantidade: 4 });
    expect(await excluirContagemAction(c.id, confirmacao)).toEqual({ ok: true });
    expect(await saldo()).toBe(-2);
    expect(await saldo("b")).toBe(14);
    expect(await saldo("c")).toBe(10);
    expect(await simulacao.prisma.movimentacaoEstoque.findMany({ where: { id: { in: originais.map(m => m.id) } }, orderBy: { id: "asc" } })).toEqual(originais);
    const historico = await simulacao.prisma.inventarioContagem.findUniqueOrThrow({ where: { id: c.id }, include: { itens: { include: { movimentoEstorno: true } } } });
    expect(historico).toMatchObject({ status: "EXCLUIDO", ajustesEstornados: true, excluidaPorId: "admin", excluidaPorNome: "Administrador atual", motivoExclusao: confirmacao.motivo });
    expect(historico.excluidaEm).toBeInstanceOf(Date);
    expect(historico.finalizadaEm).toBeInstanceOf(Date);
    expect(historico.itens.filter(i => i.movimentoEstorno?.criadoPorId === "admin")).toHaveLength(2);
    expect(historico.itens.filter(i => i.ajustado)).toHaveLength(2);
    expect(Number((await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: "a" } })).custoMedio)).toBe(12);
  });
  it("rejeita equipe com permissão de excluir e admin forjado no cookie", async () => {
    const c = await criar(); conectar(false);
    simulacao.sessao.mockResolvedValue({ userId: "equipe", admin: true, versao: 0 });
    expect(await excluirContagemAction(c.id, confirmacao)).toEqual({ erro: "Somente administradores podem cancelar contagens finalizadas." });
    expect(await saldo()).toBe(13.125);
  });
  it.each([{ ativo: false }, { excluidoEm: new Date() }, { sessaoVersao: 1 }, { perfilAcessoId: "equipe-perfil" }])("revalida o administrador após mudança no banco: %j", async dados => {
    const c = await criar();
    await simulacao.prisma.usuario.update({ where: { id: "admin" }, data: dados });
    expect(await excluirContagemAction(c.id, confirmacao)).toHaveProperty("erro");
    expect(await saldo()).toBe(13.125);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(2);
  });
  it("recusa chamada sem confirmação, motivo inválido ou contagem ausente sem alterar estoque", async () => {
    const c = await criar();
    for (const entrada of [undefined, { ...confirmacao, confirmarEstorno: false }, { ...confirmacao, motivo: "  " }, { ...confirmacao, motivo: "x".repeat(1001) }]) {
      expect(await excluirContagemAction(c.id, entrada as typeof confirmacao)).toHaveProperty("erro");
    }
    expect(await excluirContagemAction("ausente", confirmacao)).toHaveProperty("erro");
    expect(await saldo()).toBe(13.125);
  });
  it("duas confirmações simultâneas geram apenas um conjunto de estornos", async () => {
    const c = await criar();
    const resultados = await Promise.all([excluirContagemAction(c.id, confirmacao), excluirContagemAction(c.id, confirmacao)]);
    expect(resultados.filter(r => "ok" in r)).toHaveLength(1);
    expect(await saldo()).toBe(10);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(4);
    expect(await simulacao.prisma.atividadeUsuario.findMany({
      where: { entidade: "InventarioContagem", entidadeId: c.id, acao: "CONTAGEM_CANCELADA_COM_ESTORNO" },
    })).toEqual([expect.objectContaining({ autorId: "admin", autorNome: "Administrador atual", resultado: "SUCESSO" })]);
  });
  it("finalização concorrente aplica ajustes uma única vez e impede exclusão com aviso antigo", async () => {
    const c = await criar(false);
    const resultados = await Promise.all([finalizarContagemAction(c.id), finalizarContagemAction(c.id)]);
    expect(resultados.filter(r => "ok" in r)).toHaveLength(1);
    expect(await excluirContagemAction(c.id)).toHaveProperty("erro");
    expect(await salvarItemContagemAction(c.itens[0].id, 999)).toHaveProperty("erro");
    expect(await saldo()).toBe(13.125);
  });
  it("grava a fotografia completa da tela e os ajustes na mesma transação ao finalizar", async () => {
    const c = await criar(false);
    const ids = Object.fromEntries(c.itens.map(item => [item.insumoId, item.id]));

    expect(await finalizarContagemAction(c.id, [
      { id: ids.a, quantidadeContada: 15.25 },
      { id: ids.b, quantidadeContada: null },
      { id: ids.c, quantidadeContada: 6 },
    ])).toEqual({ ok: true, ajustes: 2 });

    expect(await saldo("a")).toBe(15.25);
    expect(await saldo("b")).toBe(10);
    expect(await saldo("c")).toBe(6);
    const itens = await simulacao.prisma.inventarioItem.findMany({ where: { contagemId: c.id }, orderBy: { insumoId: "asc" } });
    expect(itens.map(item => ({ insumoId: item.insumoId, contado: item.contado, quantidade: Number(item.quantidadeContada) }))).toEqual([
      { insumoId: "a", contado: true, quantidade: 15.25 },
      { insumoId: "b", contado: false, quantidade: 8 },
      { insumoId: "c", contado: true, quantidade: 6 },
    ]);
  });
  it("recusa uma fotografia incompleta sem gravar parte da contagem", async () => {
    const c = await criar(false);
    expect(await finalizarContagemAction(c.id, [{ id: c.itens[0].id, quantidadeContada: 99 }])).toHaveProperty("erro");
    expect(await saldo("a")).toBe(10);
    expect(await saldo("b")).toBe(10);
    expect(await saldo("c")).toBe(10);
    expect((await simulacao.prisma.inventarioContagem.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("EM_ANDAMENTO");
  });
  it("exclusão concorrente com finalização mantém estado e saldo consistentes", async () => {
    const c = await criar(false);
    await Promise.all([excluirContagemAction(c.id), finalizarContagemAction(c.id)]);
    const registro = await simulacao.prisma.inventarioContagem.findUniqueOrThrow({ where: { id: c.id } });
    expect(await saldo()).toBe(registro.status === "FINALIZADO" ? 13.125 : 10);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(registro.status === "FINALIZADO" ? 2 : 0);
  });
  it("preserva exclusão em andamento pela equipe e bloqueia edição/finalização posterior", async () => {
    const c = await criar(false); conectar(false);
    expect(await excluirContagemAction(c.id)).toEqual({ ok: true });
    expect(await salvarItemContagemAction(c.itens[0].id, 99)).toHaveProperty("erro");
    expect(await finalizarContagemAction(c.id)).toHaveProperty("erro");
    expect(await saldo()).toBe(10);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("cancela uma contagem sem divergências sem inventar movimentos", async () => {
    const c = await criar(false);
    await simulacao.prisma.inventarioItem.updateMany({ where: { contagemId: c.id }, data: { quantidadeContada: 10 } });
    expect(await finalizarContagemAction(c.id)).toEqual({ ok: true, ajustes: 0 });
    expect(await excluirContagemAction(c.id, confirmacao)).toEqual({ ok: true });
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("recupera vínculos de contagem antiga somente por correspondência exata", async () => {
    const c = await criar();
    await simulacao.prisma.inventarioItem.updateMany({ where: { contagemId: c.id }, data: { movimentoAjusteId: null, unidadeAjuste: null } });
    expect(await excluirContagemAction(c.id, confirmacao)).toEqual({ ok: true });
    expect(await saldo()).toBe(10);
    expect(await simulacao.prisma.inventarioItem.count({ where: { contagemId: c.id, movimentoAjusteId: { not: null }, movimentoEstornoId: { not: null } } })).toBe(2);
  });
  it("reverte toda a transação se o segundo ajuste antigo for ambíguo", async () => {
    const c = await criar();
    await simulacao.prisma.inventarioItem.updateMany({ where: { contagemId: c.id }, data: { movimentoAjusteId: null, unidadeAjuste: null } });
    await registrarMovimentacao({ insumoId: "b", localId: "local", tipo: "AJUSTE_SAIDA", quantidade: 2, observacao: `Ajuste de contagem ${c.id}` });
    const atividadesAntes = await simulacao.prisma.atividadeUsuario.findMany({ select: { id: true }, orderBy: { id: "asc" } });
    expect(await excluirContagemAction(c.id, confirmacao)).toHaveProperty("erro");
    expect(await saldo()).toBe(13.125);
    expect(await saldo("b")).toBe(6);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(3);
    expect(await simulacao.prisma.inventarioItem.count({ where: { movimentoEstornoId: { not: null } } })).toBe(0);
    expect((await simulacao.prisma.inventarioContagem.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("FINALIZADO");
    expect(await simulacao.prisma.atividadeUsuario.findMany({ select: { id: true }, orderBy: { id: "asc" } })).toEqual(atividadesAntes);
  });
  it("mudança de unidade impede estorno parcial e preserva ajustes originais", async () => {
    const c = await criar();
    await simulacao.prisma.insumo.update({ where: { id: "b" }, data: { unidade: "UN" } });
    expect(await excluirContagemAction(c.id, confirmacao)).toHaveProperty("erro");
    expect(await saldo()).toBe(13.125);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(2);
  });
});
