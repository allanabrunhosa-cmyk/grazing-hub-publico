import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient, Prisma } from "@/generated/prisma/client";

const simulacao = vi.hoisted(() => ({
  prisma: null as unknown as PrismaClient,
  sessao: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return simulacao.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

import { excluirPerdaAction, registrarPerdaAction } from "@/app/(protegido)/inventario/perdas/actions";
import { adicionarCategoriaPerdaAction, alterarCategoriaPerdaAction, removerCategoriaPerdaAction } from "@/app/(protegido)/inventario/perdas/categorias-actions";
import { consultarPerdas } from "@/lib/estoque/consultar-perdas";

type EntradaPerda = Parameters<typeof registrarPerdaAction>[0];
const esquema = `teste_perdas_${randomUUID().replaceAll("-", "")}`;
const usuarioId = "documentador-teste";
const administradorId = "administrador-teste";
const outroUsuarioId = "outro-documentador-teste";
const insumoId = "insumo-perdas-teste";
const localId = "local-perdas-teste";
const motivoExclusao = "Lançamento duplicado na conferência de estoque";
let banco: Client | undefined;
let esquemaCriado = false;

function conectarComo(id = usuarioId, admin = false) {
  simulacao.sessao.mockResolvedValue({
    userId: id, nome: "Nome antigo da sessão", email: "sessao@example.invalid", admin,
  });
}

function entrada(alteracoes: Partial<EntradaPerda> = {}): EntradaPerda {
  return {
    insumoId, localId, motivo: "QUEBRA", quantidade: 2.125,
    valorEstimado: 25.5, observacao: "Embalagem danificada", data: "2026-09-10",
    ...alteracoes,
  };
}

async function registrar(alteracoes: Partial<EntradaPerda> = {}) {
  const resultado = await registrarPerdaAction(entrada(alteracoes));
  if ("erro" in resultado) throw new Error(resultado.erro);
  return resultado;
}

async function saldo() {
  const registro = await simulacao.prisma.saldoEstoque.findUniqueOrThrow({
    where: { insumoId_localId: { insumoId, localId } },
  });
  return Number(registro.quantidadeAtual);
}

async function contagens() {
  const [perdas, movimentos, exclusoes] = await Promise.all([
    simulacao.prisma.perda.count(), simulacao.prisma.movimentacaoEstoque.count(),
    simulacao.prisma.perdaExclusao.count(),
  ]);
  return { perdas, movimentos, exclusoes };
}

describe.skipIf(process.env.PERDAS_BANCO_TESTE !== "1")("perdas e estornos no PostgreSQL local isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) {
      throw new Error("Os testes de perdas só podem executar no PostgreSQL local.");
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
      if (!/^teste_perdas_[a-f0-9]{32}$/.test(esquema)) throw new Error("Schema de teste inválido.");
      await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    }
    await banco.end();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await banco!.query('TRUNCATE "Usuario", "Insumo", "LocalEstoque" CASCADE');
    await simulacao.prisma.usuario.createMany({ data: [
      { id: usuarioId, nome: "Pessoa que documentou", email: "documentador@example.invalid", senhaHash: "sem-login-de-teste" },
      { id: administradorId, nome: "Administrador da auditoria", email: "administrador@example.invalid", senhaHash: "sem-login-de-teste", admin: true },
      { id: outroUsuarioId, nome: "Pessoa que corrigiu", email: "corretor@example.invalid", senhaHash: "sem-login-de-teste" },
    ] });
    await simulacao.prisma.insumo.create({ data: {
      id: insumoId, nome: "Insumo fictício para perdas", unidade: "KG", custoMedio: 12,
    } });
    await simulacao.prisma.localEstoque.create({ data: { id: localId, nome: "Local fictício de perdas" } });
    await simulacao.prisma.saldoEstoque.create({ data: { insumoId, localId, quantidadeAtual: 10 } });
    conectarComo();
  });

  it("registra motivo livre, quantidade e autoria atual do banco sem confiar no nome enviado", async () => {
    const resultado = await registrarPerdaAction({
      ...entrada({ motivo: "OUTRO", motivoPersonalizado: "  Falha na refrigeração  " }),
      responsavelId: administradorId, responsavelNome: "Identidade fornecida pelo cliente",
    } as EntradaPerda);
    expect(resultado).not.toHaveProperty("erro");
    if ("erro" in resultado) return;
    const perda = await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: resultado.perdaId } });
    expect(perda).toMatchObject({
      motivo: "OUTRO", motivoPersonalizado: "Falha na refrigeração", unidade: "KG",
      responsavelId: usuarioId, responsavelNome: "Pessoa que documentou", excluidaEm: null,
    });
    expect(Number(perda.quantidade)).toBe(2.125);
    expect(Number(perda.valorEstimado)).toBe(25.5);
    expect(perda.data.toISOString().slice(0, 10)).toBe("2026-09-10");
    const movimento = await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: resultado.movimentacaoId } });
    expect(movimento).toMatchObject({ origemPerdaId: perda.id, insumoId, localId, tipo: "SAIDA_PERDA", criadoPorId: usuarioId });
    expect(Number(movimento.quantidade)).toBe(2.125);
    expect(await saldo()).toBe(7.875);
    await simulacao.prisma.usuario.update({ where: { id: usuarioId }, data: { nome: "Nome alterado depois" } });
    const consulta = await consultarPerdas();
    if ("erro" in consulta) throw new Error(consulta.erro);
    expect(consulta.linhas[0]).toMatchObject({ responsavelNome: "Pessoa que documentou", motivoPersonalizado: "Falha na refrigeração", unidade: "KG" });
  });

  it("preserva categorias usadas, inativa para novos lançamentos e remove somente as não usadas", async () => {
    conectarComo(administradorId, true);
    const criada = await adicionarCategoriaPerdaAction("  Transporte danificado  ");
    expect(criada).toHaveProperty("categoria.nome", "Transporte danificado");
    if (!("categoria" in criada) || !criada.categoria) return;
    conectarComo();
    const registrada = await registrarPerdaAction(entrada({ motivo: "OUTRO", categoriaPerdaId: criada.categoria.id, motivoPersonalizado: null }));
    expect(registrada).toHaveProperty("perdaId");
    if (!("perdaId" in registrada)) return;
    expect(await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: registrada.perdaId } })).toMatchObject({
      categoriaPerdaId: criada.categoria.id, motivo: "OUTRO", motivoPersonalizado: "Transporte danificado",
    });
    conectarComo(administradorId, true);
    expect(await removerCategoriaPerdaAction(criada.categoria.id)).toHaveProperty("erro");
    expect(await alterarCategoriaPerdaAction(criada.categoria.id, false)).toEqual({ ok: true });
    conectarComo();
    expect(await registrarPerdaAction(entrada({ motivo: "OUTRO", categoriaPerdaId: criada.categoria.id, motivoPersonalizado: null }))).toHaveProperty("erro");
    conectarComo(administradorId, true);
    const nuncaUsada = await adicionarCategoriaPerdaAction("Categoria temporária");
    if (!("categoria" in nuncaUsada) || !nuncaUsada.categoria) throw new Error("Categoria de teste não criada.");
    expect(await removerCategoriaPerdaAction(nuncaUsada.categoria.id)).toEqual({ ok: true });
  });

  it("calcula o valor pelo custo médio mesmo quando o cliente envia outro valor", async () => {
    const resultado = await registrar({ motivo: "VALIDADE_VENCIDA", valorEstimado: 0, motivoPersonalizado: "Texto de outro motivo que não deve permanecer" });
    const perda = await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: resultado.perdaId } });
    expect(perda).toMatchObject({ motivo: "VALIDADE_VENCIDA", motivoPersonalizado: null });
    expect(Number(perda.valorEstimado)).toBe(25.5);
  });

  it("rejeita motivos livres vazios ou excessivos e números, datas e motivos inválidos sem gravar", async () => {
    const invalidas: Partial<EntradaPerda>[] = [
      { motivo: "OUTRO" }, { motivo: "OUTRO", motivoPersonalizado: "  " },
      { motivo: "OUTRO", motivoPersonalizado: "ab" },
      { motivo: "OUTRO", motivoPersonalizado: "x".repeat(501) },
      { motivo: "INVENTADO" as EntradaPerda["motivo"] },
      { quantidade: 0 }, { quantidade: -1 }, { quantidade: Infinity }, { quantidade: NaN },
      { quantidade: 1_000_000_000 },
      { data: "2026-02-30" }, { data: "2026-02-29" }, { data: "10/09/2026" }, { data: "" },
    ];
    for (const alteracao of invalidas) {
      expect(await registrarPerdaAction(entrada(alteracao)), JSON.stringify(alteracao)).toHaveProperty("erro");
    }
    expect(await contagens()).toEqual({ perdas: 0, movimentos: 0, exclusoes: 0 });
    expect(await saldo()).toBe(10);
  });

  it("aceita data bissexta existente e quantidades com três casas decimais", async () => {
    const resultado = await registrar({ data: "2024-02-29", quantidade: 0.001, valorEstimado: 0.01 });
    const perda = await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: resultado.perdaId } });
    expect(perda.data.toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(await saldo()).toBe(9.999);
  });

  it.each([0.5, 0.01, 0.0875, 0.0001, 0.00000001, 1e-30, Number.MIN_VALUE])("preserva perda positiva %s e seu estorno sem arredondar no banco", async (quantidade) => {
    const resultado = await registrar({ quantidade, valorEstimado: 0 });
    const perda = await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: resultado.perdaId } });
    const movimento = await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: resultado.movimentacaoId } });
    expect(perda.quantidade.equals(quantidade)).toBe(true);
    expect(movimento.quantidade.equals(quantidade)).toBe(true);
    const diferenca = await banco!.query('SELECT (10 - "quantidadeAtual")::text AS diferenca FROM "SaldoEstoque" WHERE "insumoId" = $1', [insumoId]);
    expect(new Prisma.Decimal(diferenca.rows[0].diferenca).equals(quantidade)).toBe(true);
    expect(await excluirPerdaAction({ perdaId: perda.id, motivo: motivoExclusao })).toEqual({ ok: true });
    const exclusao = await simulacao.prisma.perdaExclusao.findUniqueOrThrow({ where: { perdaId: perda.id }, include: { movimentacao: true } });
    expect(exclusao.quantidade.equals(quantidade)).toBe(true);
    expect(exclusao.movimentacao.quantidade.equals(quantidade)).toBe(true);
    expect(await saldo()).toBe(10);
  });

  it.each(["sem sessão", "usuário inexistente", "usuário inativo"])("bloqueia registro, exclusão e consulta com %s", async (caso) => {
    const perda = await registrar();
    if (caso === "sem sessão") simulacao.sessao.mockResolvedValue(null);
    if (caso === "usuário inexistente") conectarComo("usuario-ausente", true);
    if (caso === "usuário inativo") {
      await simulacao.prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
      conectarComo(usuarioId, true);
    }
    expect(await registrarPerdaAction(entrada())).toHaveProperty("erro");
    expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao })).toHaveProperty("erro");
    expect(await consultarPerdas()).toHaveProperty("erro");
    expect(await contagens()).toEqual({ perdas: 1, movimentos: 1, exclusoes: 0 });
    expect(await saldo()).toBe(7.875);
  });

  it("exige motivo de exclusão válido e uma perda existente", async () => {
    const perda = await registrar();
    for (const motivo of ["", "  ", "ab", "x".repeat(1001)]) {
      expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo })).toHaveProperty("erro");
    }
    expect(await excluirPerdaAction({ perdaId: "ausente", motivo: motivoExclusao })).toHaveProperty("erro");
    expect(await contagens()).toEqual({ perdas: 1, movimentos: 1, exclusoes: 0 });
    expect(await saldo()).toBe(7.875);
  });

  it("devolve o estoque, preserva o lançamento original e registra motivo e responsável da correção", async () => {
    const perda = await registrar();
    const original = await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: perda.perdaId } });
    const movimentoOriginal = await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: perda.movimentacaoId } });
    await simulacao.prisma.insumo.update({ where: { id: insumoId }, data: { custoMedio: 18.1234 } });
    conectarComo(outroUsuarioId);
    const inicio = Date.now();
    expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: `  ${motivoExclusao}  ` })).toEqual({ ok: true });
    const atualizada = await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: perda.perdaId } });
    expect(atualizada).toEqual({ ...original, excluidaEm: expect.any(Date) });
    expect(await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: perda.movimentacaoId } })).toEqual(movimentoOriginal);
    const exclusao = await simulacao.prisma.perdaExclusao.findUniqueOrThrow({ where: { perdaId: perda.perdaId } });
    expect(exclusao).toMatchObject({ motivo: motivoExclusao, responsavelId: outroUsuarioId, responsavelNome: "Pessoa que corrigiu", unidade: "KG" });
    expect(Number(exclusao.quantidade)).toBe(2.125);
    expect(exclusao.createdAt.getTime()).toBeGreaterThanOrEqual(inicio);
    const estorno = await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: exclusao.movimentacaoId } });
    expect(estorno).toMatchObject({ insumoId, localId, tipo: "AJUSTE_ENTRADA", criadoPorId: null, origemPerdaId: null });
    expect(Number(estorno.quantidade)).toBe(2.125);
    expect(estorno.createdAt.getTime()).toBeGreaterThanOrEqual(inicio);
    expect(estorno.observacao ?? "").not.toContain(motivoExclusao);
    expect(estorno.observacao ?? "").not.toContain("Pessoa que corrigiu");
    expect(await saldo()).toBe(10);
    expect(Number((await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).custoMedio)).toBe(18.1234);
  });

  it("serializa duas exclusões concorrentes e devolve a quantidade apenas uma vez", async () => {
    const perda = await registrar();
    const respostas = await Promise.all([
      excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao }),
      excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao }),
    ]);
    expect(respostas.filter(resposta => "ok" in resposta)).toHaveLength(1);
    expect(respostas.filter(resposta => "erro" in resposta)).toHaveLength(1);
    expect(await contagens()).toEqual({ perdas: 1, movimentos: 2, exclusoes: 1 });
    expect(await saldo()).toBe(10);
    expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao })).toHaveProperty("erro");
    expect(await saldo()).toBe(10);
  });

  it("desfaz marcação, estorno e saldo se a auditoria falhar dentro da transação", async () => {
    const perda = await registrar();
    await banco!.query('ALTER TABLE "PerdaExclusao" ADD CONSTRAINT falha_auditoria_teste CHECK (false)');
    try {
      expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao })).toHaveProperty("erro");
      expect(await contagens()).toEqual({ perdas: 1, movimentos: 1, exclusoes: 0 });
      expect(await saldo()).toBe(7.875);
      expect(await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: perda.perdaId } })).toHaveProperty("excluidaEm", null);
    } finally {
      await banco!.query('ALTER TABLE "PerdaExclusao" DROP CONSTRAINT falha_auditoria_teste');
    }
    expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao })).toEqual({ ok: true });
    expect(await saldo()).toBe(10);
  });

  it("bloqueia estorno se a unidade principal mudou após o registro", async () => {
    const perda = await registrar();
    await simulacao.prisma.insumo.update({ where: { id: insumoId }, data: { unidade: "UN" } });
    expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao })).toHaveProperty("erro");
    expect(await saldo()).toBe(7.875);
    expect(await simulacao.prisma.perdaExclusao.count()).toBe(0);
    const consulta = await consultarPerdas();
    if ("erro" in consulta) throw new Error(consulta.erro);
    expect(consulta.linhas[0].unidade).toBe("KG");
  });

  it.each(["ausente", "quantidade divergente", "tipo divergente", "local divergente", "insumo divergente"])("bloqueia estorno com movimento original %s", async (caso) => {
    const perda = await registrar();
    const filtro = { where: { id: perda.movimentacaoId } };
    if (caso === "ausente") await simulacao.prisma.movimentacaoEstoque.delete(filtro);
    if (caso === "quantidade divergente") await simulacao.prisma.movimentacaoEstoque.update({ ...filtro, data: { quantidade: 1 } });
    if (caso === "tipo divergente") await simulacao.prisma.movimentacaoEstoque.update({ ...filtro, data: { tipo: "SAIDA_CONSUMO" } });
    if (caso === "local divergente") {
      const local = await simulacao.prisma.localEstoque.create({ data: { nome: "Outro local fictício" } });
      await simulacao.prisma.movimentacaoEstoque.update({ ...filtro, data: { localId: local.id } });
    }
    if (caso === "insumo divergente") {
      const insumo = await simulacao.prisma.insumo.create({ data: { nome: "Outro insumo fictício", unidade: "KG" } });
      await simulacao.prisma.movimentacaoEstoque.update({ ...filtro, data: { insumoId: insumo.id } });
    }
    expect(await excluirPerdaAction({ perdaId: perda.perdaId, motivo: motivoExclusao })).toHaveProperty("erro");
    expect(await saldo()).toBe(7.875);
    expect(await simulacao.prisma.perdaExclusao.count()).toBe(0);
    expect(await simulacao.prisma.perda.findUniqueOrThrow({ where: { id: perda.perdaId } })).toHaveProperty("excluidaEm", null);
  });

  it("entrega histórico somente ao administrador ativo do banco e conserva nomes históricos", async () => {
    const excluida = await registrar({ motivo: "OUTRO", motivoPersonalizado: "Motivo documentado na perda" });
    conectarComo(outroUsuarioId);
    expect(await excluirPerdaAction({ perdaId: excluida.perdaId, motivo: motivoExclusao })).toEqual({ ok: true });
    const ativa = await registrar();
    await simulacao.prisma.usuario.update({ where: { id: outroUsuarioId }, data: { nome: "Nome atualizado da pessoa" } });

    // Uma alegação antiga de admin na sessão não concede acesso após mudança no banco.
    conectarComo(usuarioId, true);
    const comum = await consultarPerdas();
    if ("erro" in comum) throw new Error(comum.erro);
    expect(comum.usuario).toMatchObject({ id: usuarioId, admin: false, nome: "Pessoa que documentou" });
    expect(comum.linhas.map(linha => linha.id)).toEqual([ativa.perdaId]);
    expect(comum).not.toHaveProperty("historico");
    expect(JSON.stringify(comum)).not.toContain(motivoExclusao);
    expect(JSON.stringify(comum)).not.toContain(excluida.perdaId);

    conectarComo(administradorId, false);
    const administrador = await consultarPerdas();
    if ("erro" in administrador) throw new Error(administrador.erro);
    expect(administrador.usuario.admin).toBe(true);
    expect(administrador.linhas.map(linha => linha.id)).toEqual([ativa.perdaId]);
    expect(administrador.historico).toEqual([expect.objectContaining({
      id: excluida.perdaId, motivoExclusao, motivoPersonalizado: "Motivo documentado na perda",
      responsavelNome: "Pessoa que documentou", responsavelExclusaoNome: "Pessoa que corrigiu",
      quantidadeEstornada: 2.125, unidadeEstornada: "KG", excluidaEm: expect.any(String),
    })]);
    await simulacao.prisma.usuario.update({ where: { id: administradorId }, data: { ativo: false } });
    expect(await consultarPerdas()).toHaveProperty("erro");
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
