import { prepararDependenciaAtendimento } from "../vendas/dependencia-atendimento";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { xmlCustos } from "./custos-dados";
import type { DistribuicaoDesconto } from "@/lib/notas-fiscais/custos";

vi.mock("server-only", () => ({}));
const estado = vi.hoisted(() => ({ banco: null as unknown as PrismaClient, manifestar: vi.fn(), sessao: { userId: "teste-custos", nome: "Teste", email: "custos@example.invalid", admin: true, versao: 0, perfilNome: "Administrador", permissoes: {}, excecoes: {} } }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: estado.manifestar }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.banco; } }));
vi.mock("@/lib/session", () => ({ getSession: async () => estado.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// O usuário sintético abaixo recebe o perfil central Administrador no beforeAll.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => estado.sessao) }));
import { saveInsumoAction } from "@/app/(protegido)/insumos/actions";
import { confirmarConciliacaoNotaAction, obterItensNotaFiscalAction, manifestarAction } from "@/app/(protegido)/notas-fiscais/actions";
import { consultarCancelamentoCompra, cancelarCompra, chaveCompra } from "@/lib/financeiro/cancelamento-compra";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { editarNotaAceitaAction } from "@/app/(protegido)/notas-fiscais/editar-nota";
import { consultarCorrecaoNota } from "@/lib/notas-fiscais/correcao-nota";

const esquema = "teste_custos_" + randomUUID().replaceAll("-", "");
let banco: Client | undefined;
let criado = false;
async function preparar() {
  const id = randomUUID();
  const nota = await estado.banco.notaFiscalRecebida.create({ data: { id, chaveAcesso: id.replaceAll("-", "").padEnd(44, "0"), tipo: "PROC_NFE", nsu: id, xml: xmlCustos, valorTotal: 445, dataEmissao: new Date("2026-09-11"), ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" } });
  const insumo = await estado.banco.insumo.create({ data: { nome: "Queijo " + id, unidade: "KG", custoMedio: 20 } });
  await estado.banco.saldoEstoque.create({ data: { insumoId: insumo.id, localId: "local", quantidadeAtual: 2 } });
  const itens = await Promise.all([1, 2].map(numeroItem => estado.banco.notaFiscalItem.create({ data: { notaFiscalId: nota.id, numeroItem, codigoProdutoFornecedor: String(numeroItem), descricaoProduto: "Produto " + numeroItem, unidadeComercial: "KG", quantidadeComercial: 2, valorTotalItem: numeroItem === 1 ? 100 : 300 } })));
  const parcelas = await Promise.all([1, 2].map(numero => estado.banco.notaFiscalDuplicata.create({ data: { notaFiscalId: nota.id, numero: String(numero), dataVencimento: new Date(`2026-${numero + 9}-11T12:00:00Z`), valor: 222.5 } })));
  const distribuicaoDesconto: DistribuicaoDesconto = { modo: "PERSONALIZADO", itens: [{ numeroItem: 1, desconto: 20 }, { numeroItem: 2, desconto: 0 }] };
  const entrada = { dataEntradaEstoque: "2026-09-11", notaFiscalId: nota.id, localId: "local", distribuicaoDesconto,
    itens: [
      { notaFiscalItemId: itens[0].id, acao: "CONCILIAR" as const, destino: "ESTOQUE" as const, insumoId: insumo.id, quantidade: 2, valorTotal: 98, modoCusto: "MEDIA" as const },
      { notaFiscalItemId: itens[1].id, acao: "CONCILIAR" as const, destino: "USO_E_CONSUMO" as const, categoriaFinanceiraId: "consumo", valorTotal: 347 },
    ], duplicatas: parcelas.map(p => ({ id: p.id, numero: p.numero, dataVencimento: p.dataVencimento.toISOString().slice(0, 10), valor: Number(p.valor) })) };
  return { nota, itens, insumo, entrada };
}
describe.skipIf(process.env.CUSTOS_NOTA_BANCO_TESTE !== "1")("custos da nota no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await prepararDependenciaAtendimento(banco, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"))));
    }
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: endereco.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await estado.banco.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    await estado.banco.usuario.create({ data: { id: "teste-custos", nome: "Teste", email: "custos@example.invalid", senhaHash: "sem-login" } });
    const perfil = await estado.banco.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    await estado.banco.usuario.update({ where: { id: "teste-custos" }, data: { perfilAcessoId: perfil.id } });
    await estado.banco.localEstoque.create({ data: { id: "local", nome: "Local de teste" } });
    await estado.banco.categoriaFinanceira.create({ data: { id: "consumo", nome: "Consumo de teste", grupo: "DESPESAS_OPERACIONAIS" } });
  }, 60_000);
  afterAll(async () => {
    await estado.banco?.$disconnect();
    if (banco) {
      await banco.query("ROLLBACK");
      if (criado && /^teste_custos_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await banco.end();
    }
  });
  it("corrige pagamento da nota aceita preservando títulos, estoque, aceite fiscal e replay idempotente", async () => {
    const { nota, entrada, insumo } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const antes = await estado.banco.lancamentoFinanceiro.findMany({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } } }, orderBy: { id: "asc" } });
    const movimentos = await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } });
    const versao = (await consultarCorrecaoNota(estado.banco, nota.id)).versao;
    const correcao = { ...entrada, versao, motivo: "Correção fictícia da forma de pagamento", duplicatas: entrada.duplicatas.map(d => ({ ...d, formaPagamento: "PIX" as const })) };
    expect(await editarNotaAceitaAction(correcao)).toEqual({ ok: true });
    expect(await editarNotaAceitaAction(correcao)).toEqual({ ok: true });
    const depois = await estado.banco.lancamentoFinanceiro.findMany({ where: { id: { in: antes.map(l => l.id) } }, include: { formaPagamento: true }, orderBy: { id: "asc" } });
    expect(depois.map(l => l.id)).toEqual(antes.map(l => l.id));
    expect(depois.every(l => l.formaPagamento?.nome === "Pix")).toBe(true);
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(movimentos);
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, acao: "CORRECAO_LOCAL" } })).toBe(1);
    expect(await estado.banco.manifestacaoNFe.count({ where: { notaFiscalId: nota.id } })).toBe(0);
    expect(await editarNotaAceitaAction({ ...correcao, motivo: "Outra alteração usando uma versão antiga" })).toMatchObject({ erro: expect.stringContaining("alterados") });
  });
  it("corrige quantidade com saldo líquido, custo residual e cancelamento da entrada vigente", async () => {
    const { nota, entrada, insumo, itens } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const original = await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id } });
    const versao = (await consultarCorrecaoNota(estado.banco, nota.id)).versao;
    const acao = entrada.itens[0];
    expect(acao.destino).toBe("ESTOQUE");
    const correcao = { ...entrada, versao, motivo: "Correção fictícia da quantidade recebida", itens: [{ ...acao, quantidade: 3 }, entrada.itens[1]] };
    expect(await editarNotaAceitaAction(correcao)).toEqual({ ok: true });
    expect(await editarNotaAceitaAction(correcao)).toEqual({ ok: true });
    const item = await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id }, include: { movimentacaoEstoque: true } });
    expect(item.movimentacaoEstoqueId).not.toBe(original.movimentacaoEstoqueId);
    expect(Number(item.movimentacaoEstoque?.quantidade)).toBe(3);
    expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: "local" } } })).quantidadeAtual)).toBe(5);
    expect(Number((await estado.banco.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).custoMedio)).toBe(27.6);
    expect(await estado.banco.movimentacaoEstoque.count({ where: { estornoDeId: original.movimentacaoEstoqueId! } })).toBe(1);
    const origem = { tipo: "NOTA" as const, id: nota.id };
    const previa = await consultarCancelamentoCompra(origem, estado.sessao);
    expect(previa.itens[0].quantidade).toBe("3");
    await cancelarCompra(origem, { token: previa.token, motivo: "Cancelamento fictício da entrada corrigida" }, estado.sessao);
    expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: "local" } } })).quantidadeAtual)).toBe(2);
  });
  it("preserva custos legados sem composição ao corrigir pagamento e recebimento de uso e consumo", async () => {
    const { nota, entrada, itens } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    await estado.banco.notaFiscalItem.updateMany({ where: { notaFiscalId: nota.id }, data: { composicaoCusto: Prisma.DbNull } });
    const versao = (await consultarCorrecaoNota(estado.banco, nota.id)).versao;
    expect(await editarNotaAceitaAction({ ...entrada, distribuicaoDesconto: undefined, versao, motivo: "Correção fictícia de nota aceita legada", dataEntradaEstoque: "2026-09-10", duplicatas: entrada.duplicatas.map(d => ({ ...d, formaPagamento: "PIX" as const })) })).toEqual({ ok: true });
    const uso = await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[1].id } });
    expect(uso.dataRecebimento?.toISOString().slice(0, 10)).toBe("2026-09-10");
    expect(Number(uso.valorTotalConciliado)).toBe(347);
    expect(uso.composicaoCusto).toBeNull();
  });
  it("exige adicionar e excluir do financeiro somente quando a revisão cria ou cancela títulos", async () => {
    const { nota, entrada } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const usuario = await estado.banco.usuario.findUniqueOrThrow({ where: { id: estado.sessao.userId } });
    const perfil = await estado.banco.perfilAcesso.create({ data: { nome: "Editor sem criação ou exclusão " + randomUUID(), permissoes: {
      notas: ["visualizar"], "notas.manifestar": ["visualizar", "editar"], "financeiro.movimentacoes": ["visualizar", "editar"], inventario: ["visualizar", "editar"],
    } } });
    const versao = (await consultarCorrecaoNota(estado.banco, nota.id)).versao;
    const dados = { ...entrada, versao, motivo: "Reestruturação fictícia sem permissão financeira" };
    try {
      await estado.banco.usuario.update({ where: { id: usuario.id }, data: { perfilAcessoId: perfil.id } });
      const novasParcelas = [...entrada.duplicatas.map(d => ({ ...d, valor: 200 })), { numero: "3", valor: 45, dataVencimento: "2026-12-11" }];
      expect(await editarNotaAceitaAction({ ...dados, duplicatas: novasParcelas })).toMatchObject({ erro: expect.stringContaining("adicionar os novos lançamentos") });
      expect(await editarNotaAceitaAction({ ...dados, duplicatas: [{ ...entrada.duplicatas[0], valor: 445 }] })).toMatchObject({ erro: expect.stringContaining("cancelar os lançamentos") });
      expect(await estado.banco.notaFiscalDuplicata.count({ where: { notaFiscalId: nota.id } })).toBe(2);
      expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } } } })).toBe(4);
      expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } }, status: "CANCELADO" } })).toBe(0);
      expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, acao: "CORRECAO_LOCAL" } })).toBe(0);
      // Uma correção de pagamento existente continua autorizada apenas por editar.
      expect(await editarNotaAceitaAction({ ...dados, duplicatas: entrada.duplicatas.map(d => ({ ...d, formaPagamento: "PIX" as const })) })).toEqual({ ok: true });
    } finally {
      await estado.banco.usuario.update({ where: { id: usuario.id }, data: { perfilAcessoId: usuario.perfilAcessoId } });
    }
  });
  it("corrige só recebimento e vínculo do insumo mesmo com título pago, sem mudar pagamento", async () => {
    const { nota, entrada, insumo, itens } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    await estado.banco.lancamentoFinanceiro.updateMany({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } } }, data: { status: "BAIXADO" } });
    const movimentos = await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } });
    const antes = await consultarCorrecaoNota(estado.banco, nota.id);
    expect(await editarNotaAceitaAction({ ...entrada, versao: antes.versao, dataEntradaEstoque: "2026-09-10", motivo: "Correção fictícia da data do recebimento" })).toEqual({ ok: true });
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(movimentos);
    expect((await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id } })).dataRecebimento?.toISOString().slice(0, 10)).toBe("2026-09-10");
    const novoInsumo = await estado.banco.insumo.create({ data: { nome: "Insumo corrigido " + randomUUID(), unidade: "KG" } });
    const novaVersao = (await consultarCorrecaoNota(estado.banco, nota.id)).versao;
    const itemEstoque = entrada.itens[0];
    if (itemEstoque.destino !== "ESTOQUE") throw new Error("Fixture de estoque inválida.");
    expect(await editarNotaAceitaAction({ ...entrada, versao: novaVersao, motivo: "Correção fictícia do vínculo do insumo", itens: [{ ...itemEstoque, insumoId: novoInsumo.id }, entrada.itens[1]] })).toEqual({ ok: true });
    expect((await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id } })).insumoId).toBe(novoInsumo.id);
    expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: novoInsumo.id, localId: "local" } } })).quantidadeAtual)).toBe(2);
    const versaoAtual = (await consultarCorrecaoNota(estado.banco, nota.id)).versao;
    expect(await editarNotaAceitaAction({ ...entrada, versao: versaoAtual, motivo: "Pagamento fictício já protegido por baixa", duplicatas: entrada.duplicatas.map(d => ({ ...d, formaPagamento: "PIX" as const })) })).toMatchObject({ erro: expect.stringContaining("pagamento ou vínculo") });
  });
  it("rejeita correção sem sessão vigente, nota recusada e estoque insuficiente sem efeitos parciais", async () => {
    const { nota, entrada, insumo } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const consultar = () => consultarCorrecaoNota(estado.banco, nota.id);
    const versao = (await consultar()).versao;
    const dados = { ...entrada, versao, motivo: "Correção fictícia que exige rollback" };
    await estado.banco.usuario.update({ where: { id: estado.sessao.userId }, data: { sessaoVersao: 1 } });
    expect(await editarNotaAceitaAction(dados)).toMatchObject({ erro: expect.stringContaining("sessão") });
    await estado.banco.usuario.update({ where: { id: estado.sessao.userId }, data: { sessaoVersao: 0 } });
    await registrarMovimentacao({ tx: estado.banco, insumoId: insumo.id, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 3.9 });
    const antes = await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } });
    const itemEstoque = entrada.itens[0];
    if (itemEstoque.destino !== "ESTOQUE") throw new Error("Fixture de estoque inválida.");
    expect(await editarNotaAceitaAction({ ...dados, itens: [{ ...itemEstoque, quantidade: .01 }, entrada.itens[1]] })).toHaveProperty("erro");
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(antes);
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, acao: "CORRECAO_LOCAL" } })).toBe(0);
    await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: {
      tratamentoLocal: "DEVOLUCAO_REGISTRADA", dataDevolucao: new Date("2026-09-12T12:00:00Z"),
      motivoTratamentoLocal: "Devolução fictícia registrada para validar a proteção", tratamentoLocalEm: new Date(), tratamentoLocalVersao: 1,
    } });
    expect(await editarNotaAceitaAction({ ...dados, versao: (await consultar()).versao })).toMatchObject({ erro: expect.stringContaining("tratamento local") });
    await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: {
      tratamentoLocal: null, dataDevolucao: null, motivoTratamentoLocal: null, tratamentoLocalEm: null, tratamentoLocalVersao: 2,
      ultimaManifestacao: "OPERACAO_NAO_REALIZADA",
    } });
    expect(await editarNotaAceitaAction({ ...dados, versao: (await consultar()).versao })).toMatchObject({ erro: expect.stringContaining("Somente uma nota aceita") });
  });
  it("salva classificação e rejeita receita, categoria inativa ou excluída no cadastro", async () => {
    const categoria = await estado.banco.categoriaFinanceira.create({ data: { nome: "Classificação cadastro", grupo: "CMV" } });
    const form = new FormData(); form.set("nome", "Salame cadastro " + randomUUID()); form.set("unidade", "KG"); form.set("tipo", "INSUMO"); form.set("ativo", "on"); form.set("categoriaFinanceiraId", categoria.id);
    const salvo = await saveInsumoAction({ error: null }, form);
    expect(salvo.error).toBeNull();
    expect((await estado.banco.insumo.findUniqueOrThrow({ where: { id: salvo.insumoId } })).categoriaFinanceiraId).toBe(categoria.id);
    for (const dados of [{ ativo: false }, { ativo: true, excluidoEm: new Date() }, { ativo: true, excluidoEm: null, grupo: "RECEITA_BRUTA" as const }]) {
      await estado.banco.categoriaFinanceira.update({ where: { id: categoria.id }, data: dados });
      expect(await saveInsumoAction({ error: null }, form)).toMatchObject({ error: expect.stringContaining("despesa ativa") });
    }
  });
  it.each(["CMV", "DESPESAS_OPERACIONAIS"] as const)("classifica estoque na categoria detalhada %s e preserva o lançamento ao mudar o cadastro", async grupo => {
    const { itens, insumo, entrada } = await preparar();
    const raiz = await estado.banco.categoriaFinanceira.create({ data: { nome: "Raiz de teste", grupo } });
    const pai = await estado.banco.categoriaFinanceira.create({ data: { nome: "Subcategoria", grupo, paiId: raiz.id } });
    const folha = await estado.banco.categoriaFinanceira.create({ data: { nome: "Charcutaria / alimentação", grupo, paiId: pai.id } });
    await estado.banco.insumo.update({ where: { id: insumo.id }, data: { categoriaFinanceiraId: folha.id } });
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const vinculos = await estado.banco.notaFiscalItemLancamento.findMany({ where: { notaFiscalItemId: itens[0].id }, include: { lancamentoFinanceiro: true } });
    const despesas = vinculos.map(v => v.lancamentoFinanceiro);
    expect(despesas).toHaveLength(2);
    expect(despesas.every(d => d.categoriaId === folha.id)).toBe(true);
    expect(despesas.reduce((total, d) => total + Number(d.valor), 0)).toBe(98);
    expect((await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id } })).categoriaFinanceiraId).toBe(folha.id);
    await estado.banco.insumo.update({ where: { id: insumo.id }, data: { categoriaFinanceiraId: raiz.id } });
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    expect(await estado.banco.lancamentoFinanceiro.count({ where: { id: { in: despesas.map(d => d.id) }, categoriaId: folha.id } })).toBe(2);
  });
  it("grava custo líquido, média ponderada, despesas e composição sem duplicar ao reenviar", async () => {
    const { nota, itens, insumo, entrada } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const salvo = await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id } });
    const consumo = await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[1].id } });
    expect(salvo.dataRecebimento?.toISOString().slice(0, 10)).toBe(entrada.dataEntradaEstoque);
    expect(consumo.dataRecebimento?.toISOString().slice(0, 10)).toBe(entrada.dataEntradaEstoque);
    const datasFinanceiras = await estado.banco.notaFiscalItemLancamento.findMany({ where: { notaFiscalItem: { notaFiscalId: nota.id } }, include: { lancamentoFinanceiro: true } });
    expect(datasFinanceiras.every(vinculo => vinculo.lancamentoFinanceiro.dataCompetencia.toISOString() === nota.dataEmissao?.toISOString())).toBe(true);
    expect([...new Set(datasFinanceiras.map(vinculo => vinculo.lancamentoFinanceiro.dataVencimento.toISOString().slice(0, 10)))].sort()).toEqual(entrada.duplicatas.map(parcela => parcela.dataVencimento).sort());
    expect(Number(salvo.valorTotalConciliado)).toBe(98);
    expect(salvo.composicaoCusto).toMatchObject({ frete: 10, ipi: 8, desconto: 20, total: 98, modoDesconto: "PERSONALIZADO" });
    expect(Number((await estado.banco.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).custoMedio)).toBe(34.5);
    const despesas = await estado.banco.notaFiscalItemLancamento.findMany({ where: { notaFiscalItem: { notaFiscalId: nota.id } } });
    expect(despesas.reduce((soma, d) => soma + Number(d.valor), 0)).toBe(445);
    expect(despesas.map(d => Number(d.valor)).sort((a, b) => a - b)).toEqual([49, 49, 173.5, 173.5]);
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(1);
    const reaberta = await obterItensNotaFiscalAction(nota.id);
    expect(reaberta).toMatchObject({ itens: [{ dataEntradaEstoque: entrada.dataEntradaEstoque, composicaoCusto: { desconto: 20 } }, { dataEntradaEstoque: entrada.dataEntradaEstoque, composicaoCusto: { desconto: 0 } }] });
  });
  it("inclui produtos integralmente descontados no custo médio", async () => {
    const { nota, itens, insumo, entrada } = await preparar();
    const xml = '<nfeProc><NFe><infNFe><det nItem="1"><prod><vProd>100</vProd><vDesc>100</vDesc></prod></det><det nItem="2"><prod><vProd>300</vProd></prod></det><total><ICMSTot><vProd>400</vProd><vDesc>100</vDesc><vNF>300</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
    await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: { xml, valorTotal: 300 } });
    expect(await confirmarConciliacaoNotaAction({ ...entrada,
      distribuicaoDesconto: { modo: "NOTA", itens: [] },
      itens: [{ ...entrada.itens[0], valorTotal: 0 }, { ...entrada.itens[1], valorTotal: 300 }],
      duplicatas: entrada.duplicatas.map(p => ({ ...p, valor: 150 })),
    })).toMatchObject({ ok: true });
    expect(Number((await estado.banco.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).custoMedio)).toBe(10);
    expect((await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: itens[0].id } })).composicaoCusto).toMatchObject({ total: 0, desconto: 100 });
    expect(await estado.banco.notaFiscalItemLancamento.count({ where: { notaFiscalItemId: itens[0].id } })).toBe(0);
  });
  it("rejeita desconto inválido antes de gravar qualquer movimento", async () => {
    const { nota, insumo, entrada } = await preparar();
    const resultado = await confirmarConciliacaoNotaAction({ ...entrada, distribuicaoDesconto: { modo: "PERSONALIZADO", itens: [{ numeroItem: 1, desconto: 2 }, { numeroItem: 2, desconto: 0 }] } });
    expect(resultado).toHaveProperty("erro");
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(0);
    expect(await estado.banco.notaFiscalItem.count({ where: { notaFiscalId: nota.id, status: "CONCILIADO" } })).toBe(0);
  });
  it.each([null, "CIENCIA_DA_OPERACAO", "DESCONHECIMENTO_DA_OPERACAO", "OPERACAO_NAO_REALIZADA"] as const)("não integra nota pendente/recusada (%s) por chamada direta", async ultimaManifestacao => {
    const { nota, insumo, entrada } = await preparar();
    await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: { ultimaManifestacao } });
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("Use Aceitar nota") });
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(0);
    expect(await estado.banco.notaFiscalItemLancamento.count({ where: { notaFiscalItem: { notaFiscalId: nota.id } } })).toBe(0);
  });
  it("cancela compra integral, preserva outra nota paga e estorna uma única vez na data original", async () => {
    const primeira = await preparar(), segunda = await preparar();
    expect(await confirmarConciliacaoNotaAction(primeira.entrada)).toMatchObject({ ok: true });
    expect(await confirmarConciliacaoNotaAction(segunda.entrada)).toMatchObject({ ok: true });
    await estado.banco.lancamentoFinanceiro.updateMany({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: primeira.nota.id } } }, data: { status: "BAIXADO" } });
    const origem = { tipo: "NOTA" as const, id: segunda.nota.id }, sessao = { userId: "teste-custos", email: "custos@example.invalid", nome: "Teste", admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    const previa = await consultarCancelamentoCompra(origem, sessao);
    expect(previa.quantidadeLancamentos).toBe(4); expect(previa.valor).toBe("445.00");
    expect(previa.itens).toHaveLength(1); expect(previa.itens[0].data.slice(0, 10)).toBe("2026-09-11");
    const confirmacao = { token: previa.token, motivo: "Correção fictícia de entrada duplicada" };
    const resultados = await Promise.all([cancelarCompra(origem, confirmacao, sessao), cancelarCompra(origem, confirmacao, sessao)]);
    expect(resultados.map(r => r.quantidade).sort()).toEqual([0, 4]);
    expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: segunda.nota.id } }, status: "CANCELADO" } })).toBe(4);
    expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: primeira.nota.id } }, status: "BAIXADO" } })).toBe(4);
    const original = await estado.banco.movimentacaoEstoque.findUniqueOrThrow({ where: { id: previa.itens[0].movimentoId }, include: { estornoCompra: true } });
    expect(original.estornoCompra?.tipo).toBe("AJUSTE_SAIDA");
    expect(original.estornoCompra?.quantidade.equals(original.quantidade)).toBe(true);
    expect(original.estornoCompra?.createdAt).toEqual(original.createdAt);
    expect(original.estornoCompra?.localId).toBe(original.localId);
    expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: segunda.insumo.id, localId: "local" } } })).quantidadeAtual)).toBe(2);
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: chaveCompra(origem), acao: "CANCELAMENTO_INTEGRAL" } })).toBe(1);
    expect(await estado.banco.movimentacaoBancaria.count({ where: { lancamento: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: segunda.nota.id } } } } })).toBe(0);
    expect(await confirmarConciliacaoNotaAction(segunda.entrada)).toMatchObject({ erro: expect.stringContaining("cancelada") });
    await expect(consultarCancelamentoCompra({ tipo: "NOTA", id: primeira.nota.id }, sessao)).rejects.toThrow("pagamento");
  });
  it("rejeita fotografia alterada e sessão revogada sem efeitos parciais", async () => {
    const { nota, insumo, entrada } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const origem = { tipo: "NOTA" as const, id: nota.id }, sessao = { userId: "teste-custos", email: "custos@example.invalid", nome: "Teste", admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    const previa = await consultarCancelamentoCompra(origem, sessao);
    const titulo = await estado.banco.lancamentoFinanceiro.findFirstOrThrow({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } } } });
    await estado.banco.lancamentoFinanceiro.update({ where: { id: titulo.id }, data: { valor: titulo.valor.plus(1) } });
    const confirmacao = { token: previa.token, motivo: "Teste fictício de estado alterado" };
    await expect(cancelarCompra(origem, confirmacao, sessao)).rejects.toThrow("mudou");
    await expect(consultarCancelamentoCompra(origem, { ...sessao, versao: 1 })).rejects.toThrow("sessão");
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id, tipo: "AJUSTE_SAIDA" } })).toBe(0);
    expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } }, status: "CANCELADO" } })).toBe(0);
  });
  it("revalida permissão de estoque no servidor e bloqueia cancelamento sem edição", async () => {
    const { nota, insumo, entrada } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const origem = { tipo: "NOTA" as const, id: nota.id }, sessao = { userId: "teste-custos", email: "custos@example.invalid", nome: "Teste", admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    const previa = await consultarCancelamentoCompra(origem, sessao);
    const usuario = await estado.banco.usuario.findUniqueOrThrow({ where: { id: sessao.userId } });
    const perfil = await estado.banco.perfilAcesso.create({ data: { nome: "Sem edição de estoque " + randomUUID(), permissoes: { "financeiro.movimentacoes": ["visualizar", "excluir"], notas: ["visualizar"], inventario: ["visualizar"] } } });
    try {
      await estado.banco.usuario.update({ where: { id: usuario.id }, data: { perfilAcessoId: perfil.id } });
      await expect(cancelarCompra(origem, { token: previa.token, motivo: "Tentativa fictícia sem permissão" }, sessao)).rejects.toThrow("estoque");
      expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id, tipo: "AJUSTE_SAIDA" } })).toBe(0);
      expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } }, status: "PENDENTE" } })).toBe(4);
    } finally { await estado.banco.usuario.update({ where: { id: usuario.id }, data: { perfilAcessoId: usuario.perfilAcessoId } }); }
  });
  it.each(["AVULSA", "MOVIMENTO"] as const)("estorna a compra %s e seu financeiro mantendo o histórico", async tipo => {
    const insumo = await estado.banco.insumo.create({ data: { nome: "Compra fictícia " + randomUUID(), unidade: "UN" } });
    const data = new Date("2026-09-12T15:00:00Z");
    const fornecedor = await estado.banco.fornecedor.create({ data: { nome: "Fornecedor fictício " + randomUUID() } });
    const compra = tipo === "AVULSA" ? await estado.banco.entradaAvulsaCompra.create({ data: { fornecedorId: fornecedor.id, dataEntrada: data, valorProdutos: 10, valorTotal: 10, outrosCustos: [] } }) : null;
    const movimento = await registrarMovimentacao({ insumoId: insumo.id, localId: "local", tipo: "ENTRADA_COMPRA", quantidade: 3.25, data, entradaAvulsaCompraId: compra?.id });
    const titulo = await estado.banco.lancamentoFinanceiro.create({ data: { descricao: "Compra fictícia", tipo: "DESPESA", categoriaId: "consumo", valor: 10, dataCompetencia: data, dataVencimento: data, ...(compra ? { origemEntradaAvulsaCompraId: compra.id } : { origemMovimentacaoEstoqueId: movimento.movimentacaoId }) } });
    const origem = { tipo, id: compra?.id ?? movimento.movimentacaoId }, sessao = { userId: "teste-custos", email: "custos@example.invalid", nome: "Teste", admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    const previa = await consultarCancelamentoCompra(origem, sessao);
    expect(await cancelarCompra(origem, { token: previa.token, motivo: "Cancelamento fictício de compra" }, sessao)).toMatchObject({ quantidade: 1 });
    expect((await estado.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } })).status).toBe("CANCELADO");
    expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: "local" } } })).quantidadeAtual)).toBe(0);
    expect(await estado.banco.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(2);
  });
  it("rollback de todos os títulos quando falha a gravação do estorno", async () => {
    const { nota, insumo, entrada } = await preparar();
    expect(await confirmarConciliacaoNotaAction(entrada)).toMatchObject({ ok: true });
    const origem = { tipo: "NOTA" as const, id: nota.id }, sessao = { userId: "teste-custos", email: "custos@example.invalid", nome: "Teste", admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    const previa = await consultarCancelamentoCompra(origem, sessao);
    await banco!.query('CREATE FUNCTION falha_estorno() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tipo::text = \'AJUSTE_SAIDA\' THEN RAISE EXCEPTION \'Falha simulada do estorno\'; END IF; RETURN NEW; END $$');
    await banco!.query('CREATE TRIGGER falha_estorno BEFORE INSERT ON "MovimentacaoEstoque" FOR EACH ROW EXECUTE FUNCTION falha_estorno()');
    try {
      estado.manifestar.mockReset();
      estado.manifestar.mockImplementation(async () => {
        await estado.banco.manifestacaoNFe.create({ data: { notaFiscalId: nota.id, tipo: "DESCONHECIMENTO_DA_OPERACAO", sucesso: true, cStat: "135" } });
        await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: { ultimaManifestacao: "DESCONHECIMENTO_DA_OPERACAO" } });
        return { sucesso: true, mensagem: "Recusa simulada", protocolo: "FICTICIO" };
      });
      const confirmacao = { token: previa.token, motivo: "Cancelamento fictício para rollback" };
      expect(await manifestarAction(nota.chaveAcesso, "DESCONHECIMENTO_DA_OPERACAO", undefined, confirmacao)).toMatchObject({ sucesso: false, mensagem: expect.stringContaining("reversão local ficou pendente") });
      expect(estado.manifestar).toHaveBeenCalledTimes(1);
      expect((await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { id: nota.id } })).ultimaManifestacao).toBe("DESCONHECIMENTO_DA_OPERACAO");
      expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } }, status: "PENDENTE" } })).toBe(4);
      expect(await estado.banco.cancelamentoCompra.count({ where: { chaveOrigem: chaveCompra(origem) } })).toBe(0);
      expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: "local" } } })).quantidadeAtual)).toBe(4);
    } finally {
      await banco!.query('DROP TRIGGER falha_estorno ON "MovimentacaoEstoque"');
      await banco!.query('DROP FUNCTION falha_estorno()');
    }
    expect(await manifestarAction(nota.chaveAcesso, "DESCONHECIMENTO_DA_OPERACAO", undefined, { token: previa.token, motivo: "Cancelamento fictício para rollback" })).toMatchObject({ sucesso: true });
    expect(estado.manifestar).toHaveBeenCalledTimes(1);
    expect(await estado.banco.lancamentoFinanceiro.count({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: nota.id } }, status: "CANCELADO" } })).toBe(4);
  });
});
