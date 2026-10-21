import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularDre } from "@/lib/financeiro/calcularDre";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { carregarFonteDre, carregarFonteFluxo } from "@/lib/financeiro/fontes-relatorios";
import { projetarRelatorioFaturas } from "@/lib/financeiro/faturas/relatorios";
import { calcularSaldoContasAte } from "@/lib/financeiro/saldos-iniciais";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";
import { FUNCOES_FINANCEIRAS_MCP as FUNCOES_MCP, LIMITES_MCP, type NomeFinanceiroMcp as NomeFuncaoMcp } from "./catalogo";
import { ErroMcp, registroPermitido, type RestricoesMcp } from "./politica";
import type { ContextoMcp } from "./servidor";

const data = z.string().refine(dataLancamentoValida, "Data inválida; use AAAA-MM-DD entre 2000 e 2200.");
const periodo = { de: data, ate: data };
const pagina = { pagina: z.number().int().min(1).max(1000).default(1), tamanho: z.number().int().min(1).max(LIMITES_MCP.pagina).default(50) };
const filtroRegistros = { ...periodo, ...pagina, tipo: z.enum(["RECEITA", "DESPESA"]).optional(), situacao: z.enum(["PENDENTE", "BAIXADO"]).optional(), contaId: z.string().max(120).optional(), categoriaId: z.string().max(120).optional() };
export const ENTRADAS_MCP = {
  financeiro_dre: z.object({ ...periodo, regime: z.enum(["COMPETENCIA", "CAIXA"]) }).strict(),
  financeiro_fluxo_caixa: z.object(periodo).strict(),
  financeiro_saldos: z.object({ data }).strict(),
  financeiro_lancamentos: z.object({ ...filtroRegistros, id: z.string().min(1).max(120).optional(), criterio: z.enum(["COMPETENCIA", "VENCIMENTO", "PAGAMENTO"]).default("COMPETENCIA") }).strict(),
  financeiro_contas: z.object(filtroRegistros).strict(),
  financeiro_plano_contas: z.object({ ...pagina, ativo: z.boolean().optional() }).strict(),
};
export const SAIDA_MCP = z.object({ estado: z.enum(["OK", "VAZIO", "INDISPONIVEL"]),
  contexto: z.object({ empresaId: z.literal("singleton"), moeda: z.literal("BRL"), fuso: z.string(), geradoEm: z.string(), filtros: z.record(z.string(), z.json()), regime: z.string(), restrito: z.boolean() }),
  dados: z.json(), limitacoes: z.array(z.string()) });

function validarPeriodo(de: string, ate: string) {
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000 + 1;
  if (dias < 1 || dias > LIMITES_MCP.dias) throw new ErroMcp("invalid_request", 400, `Período deve conter de 1 a ${LIMITES_MCP.dias} dias.`);
}
export function monetario(n: number | string | Prisma.Decimal): string {
  const d = new Prisma.Decimal(n);
  if (!d.isFinite() || d.abs().mul(100).greaterThan(Number.MAX_SAFE_INTEGER)) throw new ErroMcp("volume_excedido", 422, "Valor fora da precisão suportada pelo relatório.");
  return d.toFixed(2);
}
function validarVolume(n: number) { if (n > LIMITES_MCP.registros) throw new ErroMcp("volume_excedido", 422, "Consulta indisponível: o volume excede o limite seguro do relatório."); }
// Os calculadores compartilhados são lineares. Alimentá-los em centavos inteiros
// mantém suas regras e evita acumular frações binárias em totais financeiros.
const centavos = (n: number) => new Prisma.Decimal(n).mul(100).toNumber();
function dinheiroCentavos(n: number) {
  if (!Number.isSafeInteger(n)) throw new ErroMcp("volume_excedido", 422, "Total fora da precisão suportada.");
  return new Prisma.Decimal(n).div(100).toFixed(2);
}
function verificarSomaSegura(valores: number[], fatorInterno = 1) {
  const absoluto = valores.reduce((s, n) => s.plus(new Prisma.Decimal(n).abs()), new Prisma.Decimal(0));
  if (absoluto.mul(fatorInterno * 4).greaterThan(Number.MAX_SAFE_INTEGER) || valores.some(n => !Number.isSafeInteger(n))) throw new ErroMcp("volume_excedido", 422, "Consulta indisponível: valores excedem a precisão segura do cálculo.");
}
function filtroAutorizado(r: RestricoesMcp): Prisma.LancamentoFinanceiroWhereInput {
  return { ...(r.contas === null ? {} : { contaBancariaId: { in: r.contas } }), ...(r.lancamentos === null ? {} : { id: { in: r.lancamentos } }) };
}
// A tela DRE considera instantes no calendário local. O MCP fixa o fuso da loja,
// independentemente do fuso do servidor/cliente. Não presume UTC ou um offset fixo.
function instanteNoFuso(dia: string, fuso: string, fim = false): Date {
  const base = Date.parse(`${dia}T${fim ? "23:59:59.999" : "00:00:00.000"}Z`);
  let valor = base;
  for (let i = 0; i < 3; i++) {
    const offset = new Intl.DateTimeFormat("en", { timeZone: fuso, timeZoneName: "longOffset" }).formatToParts(new Date(valor)).find(p => p.type === "timeZoneName")!.value;
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
    valor = base - (m ? (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0);
  }
  return new Date(valor);
}
const mapaDinheiro = (valores: Record<string, number>) => Object.fromEntries(Object.entries(valores).map(([chave, n]) => [chave, dinheiroCentavos(n)]));
async function carregarProjecaoLimitada(db: Prisma.TransactionClient) {
  const origem = await carregarFonteFluxo(db, LIMITES_MCP.registros + 1); validarVolume(origem.length);
  for (const quantidade of await Promise.all([db.faturaCartao.count({ where: { canceladaEm: null } }), db.itemFaturaCartao.count(), db.liquidacaoCartao.count()])) validarVolume(quantidade);
  const projecao = await projetarRelatorioFaturas(origem, db); validarVolume(projecao.linhas.length);
  return { origem, linhas: projecao.linhas };
}

export async function consultarFinanceiroMcp(nome: NomeFuncaoMcp, entrada: unknown, acesso: ContextoMcp) {
  const ferramenta = FUNCOES_MCP.find(f => f.nome === nome);
  if (acesso.lojaId !== "singleton" || !ferramenta || !acesso.escopos.includes(ferramenta.escopo)) throw new ErroMcp("insufficient_scope", 403, "Função não autorizada.");
  const filtros = ENTRADAS_MCP[nome].parse(entrada);
  if ("de" in filtros) validarPeriodo(filtros.de, filtros.ate);
  return prisma.$transaction(async db => {
    // Primeiras instruções: qualquer INSERT/UPDATE financeiro falha no PostgreSQL.
    await db.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await db.$executeRawUnsafe("SET LOCAL statement_timeout = '8000ms'");
    const loja = await db.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
    if (!loja) throw new ErroMcp("temporarily_unavailable", 503, "Empresa não configurada.");
    const r = acesso.restricoes;
    const limitacoes: string[] = [];
    const restrito = r.contas !== null || r.lancamentos !== null;
    const contexto = { empresaId: "singleton" as const, moeda: "BRL" as const, fuso: loja.fusoHorario, geradoEm: new Date().toISOString(), filtros, regime: "NAO_APLICAVEL", restrito };
    let dados: z.infer<typeof SAIDA_MCP>["dados"] = null;
    let vazio = false;

    if (nome === "financeiro_dre") {
      const p = ENTRADAS_MCP.financeiro_dre.parse(entrada); contexto.regime = p.regime;
      const fonte = await carregarFonteDre(db, LIMITES_MCP.registros + 1);
      if (fonte.excedido) validarVolume(LIMITES_MCP.registros + 1);
      // Competência já foi projetada com o conjunto completo de títulos do pedido.
      const linhas = fonte.linhas.filter(l => r.lancamentos === null || r.lancamentos.includes(l.id)).flatMap(l => {
        if (p.regime === "CAIXA" && l.liquidacoesCartao) return [{ ...l, liquidacoesCartao: l.liquidacoesCartao.filter(q => r.contas === null || r.contas.includes(q.contaBancariaId)) }];
        return registroPermitido(r, l.id, l.contaBancariaId) ? [l] : [];
      });
      const precisas = linhas.map(l => ({ ...l, valor: centavos(l.valor), valorCompetencia: l.valorCompetencia === undefined ? undefined : centavos(l.valorCompetencia),
        ...(l.liquidacoesCartao ? { liquidacoesCartao: l.liquidacoesCartao.map(q => ({ ...q, valor: centavos(q.valor) })) } : {}) }));
      verificarSomaSegura(precisas.flatMap(l => [l.valor, l.valorCompetencia ?? 0, ...(l.liquidacoesCartao?.map(q => q.valor) ?? [])]));
      const limites = { de: instanteNoFuso(p.de, loja.fusoHorario), ate: instanteNoFuso(p.ate, loja.fusoHorario, true) };
      const resultado = calcularDre(precisas, limites, p.regime);
      const { grupos, ...totais } = resultado;
      dados = { totais: mapaDinheiro(totais), grupos: Object.values(grupos).map(g => ({ grupo: g.grupo, nome: g.label, total: dinheiroCentavos(g.total), categorias: g.categorias.map(c => ({ ...c, valor: dinheiroCentavos(c.valor) })) })) };
      // Zero monetário pode ser cancelamento entre receitas/despesas; não significa vazio.
      vazio = !linhas.some(l => p.regime === "COMPETENCIA" ? new Date(l.dataCompetencia) >= limites.de && new Date(l.dataCompetencia) <= limites.ate :
        !l.pedidoQuitadoCredito && (l.liquidacoesCartao ?? (l.status === "BAIXADO" && l.dataPagamento ? [{ data: l.dataPagamento }] : [])).some(q => new Date(q.data) >= limites.de && new Date(q.data) <= limites.ate));
      limitacoes.push("A DRE não inclui pagamentos de faturas ainda sem classificação. Ausência de classificação não é estimada como despesa.");
    } else if (nome === "financeiro_fluxo_caixa") {
      const p = ENTRADAS_MCP.financeiro_fluxo_caixa.parse(entrada); contexto.regime = "CAIXA_REALIZADO_E_PREVISTO";
      const projecao = await carregarProjecaoLimitada(db);
      const permitidas = projecao.linhas.filter(l => registroPermitido(r, l.id, l.contaBancariaId));
      const precisas = permitidas.map(l => ({ ...l, valor: centavos(l.valor) }));
      const contas = await db.contaBancaria.findMany({ where: r.contas === null ? {} : { id: { in: r.contas } }, select: { id: true, saldoInicial: true, dataSaldoInicial: true }, take: LIMITES_MCP.registros + 1 }); validarVolume(contas.length);
      const bases = contas.map(c => ({ id: c.id, saldoInicial: centavos(Number(c.saldoInicial)), dataSaldoInicial: c.dataSaldoInicial?.toISOString().slice(0, 10) ?? null }));
      verificarSomaSegura([...precisas.map(l => l.valor), ...bases.map(c => c.saldoInicial)], 100);
      const total = calcularPlanilhaFluxoCaixa(bases.reduce((s, c) => s + c.saldoInicial, 0), precisas, p, bases);
      const realizado = calcularPlanilhaFluxoCaixa(0, precisas.filter(l => l.status === "BAIXADO"), p, []);
      const previsto = calcularPlanilhaFluxoCaixa(0, precisas.filter(l => l.status === "PENDENTE"), p, []);
      dados = { dias: total.dias.map(dia => ({ dia, receitasRealizadas: dinheiroCentavos(realizado.totalReceitasPorDia[dia] ?? 0), despesasRealizadas: dinheiroCentavos(realizado.totalDespesasPorDia[dia] ?? 0), receitasPrevistas: dinheiroCentavos(previsto.totalReceitasPorDia[dia] ?? 0), despesasPrevistas: dinheiroCentavos(previsto.totalDespesasPorDia[dia] ?? 0), saldoProjetado: r.lancamentos === null ? dinheiroCentavos(total.saldoPorDia[dia] ?? 0) : null })), totalReceitas: dinheiroCentavos(total.totalReceitasGeral), totalDespesas: dinheiroCentavos(total.totalDespesasGeral), saldoFinalProjetado: r.lancamentos === null ? dinheiroCentavos(total.saldoFinal) : null };
      vazio = !permitidas.some(l => !l.pedidoQuitadoCredito && ((l.status === "BAIXADO" ? l.dataPagamento : null) ?? l.dataVencimento).slice(0, 10) >= p.de && ((l.status === "BAIXADO" ? l.dataPagamento : null) ?? l.dataVencimento).slice(0, 10) <= p.ate);
      if (permitidas.some(l => l.semClassificacao)) limitacoes.push("Há pagamentos de fatura sem classificação entre os registros autorizados.");
      if (r.lancamentos !== null) limitacoes.push("Saldo indisponível: a restrição por lançamento não permite atribuir saldos iniciais bancários ao subconjunto.");
    } else if (nome === "financeiro_saldos") {
      const p = ENTRADAS_MCP.financeiro_saldos.parse(entrada); contexto.regime = "SALDO_BANCARIO_REALIZADO";
      if (r.lancamentos !== null) return SAIDA_MCP.parse({ estado: "INDISPONIVEL", contexto, dados: null, limitacoes: ["Saldo bancário não pode ser calculado com restrição por lançamento."] });
      const contas = await db.contaBancaria.findMany({ where: r.contas === null ? {} : { id: { in: r.contas } }, select: { id: true, saldoInicial: true, dataSaldoInicial: true }, take: LIMITES_MCP.registros + 1 }); validarVolume(contas.length);
      const movimentos = await db.movimentacaoBancaria.findMany({ where: { contaBancariaId: { in: contas.map(c => c.id) } }, select: { contaBancariaId: true, tipo: true, valor: true, data: true }, take: LIMITES_MCP.registros + 1 }); validarVolume(movimentos.length);
      contas.forEach(c => monetario(c.saldoInicial)); movimentos.forEach(m => monetario(m.valor));
      verificarSomaSegura([...contas.map(c => centavos(Number(c.saldoInicial))), ...movimentos.map(m => centavos(Number(m.valor)))]);
      dados = { saldo: monetario(calcularSaldoContasAte(contas.map(c => ({ id: c.id, saldoInicial: Number(c.saldoInicial), dataSaldoInicial: c.dataSaldoInicial?.toISOString().slice(0, 10) ?? null })), movimentos.map(m => ({ contaBancariaId: m.contaBancariaId, data: m.data.toISOString(), valor: (m.tipo === "SAIDA" ? -1 : 1) * Number(m.valor) })), p.data)) }; vazio = !contas.length;
    } else if (nome === "financeiro_plano_contas") {
      const p = ENTRADAS_MCP.financeiro_plano_contas.parse(entrada);
      const where: Prisma.CategoriaFinanceiraWhereInput = { excluidoEm: null, ...(p.ativo === undefined ? {} : { ativo: p.ativo }), ...(restrito ? { lancamentos: { some: filtroAutorizado(r) } } : {}) };
      const [total, categorias] = await Promise.all([db.categoriaFinanceira.count({ where }), db.categoriaFinanceira.findMany({ where, select: { id: true, nome: true, grupo: true, paiId: true, ativo: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (p.pagina - 1) * p.tamanho, take: p.tamanho })]);
      // Um pai fora da restrição não é exposto por referência.
      const pais = new Set((await db.categoriaFinanceira.findMany({ where: { AND: [where, { id: { in: categorias.flatMap(c => c.paiId ? [c.paiId] : []) } }] }, select: { id: true } })).map(c => c.id));
      dados = { registros: categorias.map(c => ({ ...c, paiId: c.paiId && pais.has(c.paiId) ? c.paiId : null })), total, pagina: p.pagina, tamanho: p.tamanho }; vazio = !categorias.length;
    } else {
      const p = nome === "financeiro_contas" ? { ...ENTRADAS_MCP.financeiro_contas.parse(entrada), criterio: "VENCIMENTO" as const, id: undefined } : ENTRADAS_MCP.financeiro_lancamentos.parse(entrada);
      contexto.regime = p.criterio;
      const campo = p.criterio === "COMPETENCIA" ? "dataCompetencia" : p.criterio === "PAGAMENTO" ? "dataPagamento" : "dataVencimento";
      // A tela Movimentações usa esta mesma projeção: uma fatura parcialmente paga
      // separa a liquidação realizada do saldo pendente, sem duplicar a despesa.
      const projecao = await carregarProjecaoLimitada(db);
      const registros = projecao.linhas.filter(l => {
        const dia = l[campo]?.slice(0, 10);
        return registroPermitido(r, l.id, l.contaBancariaId) && dia && dia >= p.de && dia <= p.ate &&
          (!p.id || l.id === p.id || l.id.startsWith(`fatura:${p.id}:`)) && (!p.tipo || l.tipo === p.tipo) &&
          (!p.situacao || l.status === p.situacao) && (!p.contaId || l.contaBancariaId === p.contaId) && (!p.categoriaId || l.categoriaId === p.categoriaId);
      }).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.id.localeCompare(b.id));
      const fatia = registros.slice((p.pagina - 1) * p.tamanho, p.pagina * p.tamanho);
      dados = { registros: fatia.map(l => ({ id: l.id, lancamentoId: projecao.origem.find(o => l.id === o.id || l.id.startsWith(`fatura:${o.id}:`))?.id ?? null,
        tipo: l.tipo, valor: monetario(l.valor), categoriaId: l.categoriaId, status: l.status, contaBancariaId: l.contaBancariaId,
        dataCompetencia: l.dataCompetencia.slice(0, 10), dataVencimento: l.dataVencimento.slice(0, 10), dataPagamento: l.dataPagamento?.slice(0, 10) ?? null,
        quitadoComCredito: l.pedidoQuitadoCredito ?? false, faturaId: l.faturaId ?? null, pagamentoFaturaId: l.pagamentoFaturaId ?? null, semClassificacao: l.semClassificacao ?? false,
      })), total: registros.length, pagina: p.pagina, tamanho: p.tamanho }; vazio = !fatia.length;
      limitacoes.push("Projeções de leitura da tela Movimentações; um título de fatura pode ter partes pagas e pendentes. Não somar estas partes novamente aos títulos originais. Cancelados, descrições livres e dados pessoais foram omitidos.");
    }
    return SAIDA_MCP.parse({ estado: vazio ? "VAZIO" : "OK", contexto, dados, limitacoes });
  }, { isolationLevel: "RepeatableRead", timeout: LIMITES_MCP.timeoutMs, maxWait: 2000 });
}
