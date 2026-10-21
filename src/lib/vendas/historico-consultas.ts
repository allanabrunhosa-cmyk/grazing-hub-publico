import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { ORIGEM_HISTORICA, LOJA_HISTORICA } from "./historico-dominio";

export class ErroConsultaHistorica extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export type FiltroHistorico = { tipo?: string; mes?: string; numero?: string; pagina?: number };
type Linha = { pedidoId: string; numeroOriginal: string; linha: number; registro: Record<string, unknown>; consumo: unknown; pagamento: unknown };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const lista = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const decimal = (v: unknown) => {
  if (typeof v !== "string" || !/^-?\d+(\.\d+)?$/.test(v)) throw new ErroConsultaHistorica("O histórico contém um valor que exige conferência.", 503);
  return new Prisma.Decimal(v);
};
const texto = (v: unknown) => typeof v === "string" ? v : null;
function referenciaConsumo(v: unknown) {
  return lista(v).map(x => {
    const r = objeto(x);
    return { bloco: typeof r.bloco === "number" ? r.bloco : null, produtoId: texto(r.produtoId), estado: texto(r.estado), motivo: texto(r.motivo),
      baseTemporal: texto(r.baseTemporal), regraTemporal: texto(r.regraTemporal), quantidadeComercial: texto(r.quantidadeComercial),
      operacional: false, movimentacaoGerada: false, composicaoHistoricaComprovada: false, custoHistoricoComprovado: false,
      componentes: lista(r.componentes).map(x => { const c = objeto(x); return { insumoId: texto(c.insumoId), nome: texto(c.nome), unidade: texto(c.unidade),
        quantidadePorProduto: texto(c.quantidadePorProduto), quantidadeEstimada: texto(c.quantidadeEstimada), custoUnitarioReferencia: texto(c.custoUnitarioReferencia),
        custoEstimado: texto(c.custoEstimado), referenciaAtualizadaEm: texto(c.referenciaAtualizadaEm), preparacaoExplodida: false }; }) };
  });
}
function totaisPermitidos(t: Record<string, unknown>) {
  return Object.fromEntries(["liquido_itens", "desconto_itens", "bruto_reconstruido", "subtotal_produtos_original", "frete_ajuste_original", "total_original", "diferenca_produtos", "diferenca_total", "valor_historico_nao_detalhado", "diferenca_total_apos_nao_detalhado"].map(c => [c, texto(t[c])]));
}

/** Projeção técnica da mesma fonte vinculada a PedidoVenda. Não é caixa bancário. */
export async function consultarHistoricoImportado(filtro: FiltroHistorico = {}) {
  const sessao = await getSession();
  if (!sessao) throw new ErroConsultaHistorica("Entre no HUB para consultar o histórico.", 401);
  const tipo = filtro.tipo ?? "pedidos";
  if (!["pedidos", "pagamentos", "consumo"].includes(tipo)) throw new ErroConsultaHistorica("Consulta histórica inválida.", 400);
  for (const recurso of ["vendas.pedidos", ...(tipo === "pagamentos" ? ["financeiro.fluxo"] : tipo === "consumo" ? ["inventario"] : [])]) {
    if (!sessao.admin && !permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "visualizar")) throw new ErroConsultaHistorica("Seu acesso não permite esta consulta.", 403);
  }
  if (filtro.mes && !/^202[56]-(0[1-9]|1[0-2])$/.test(filtro.mes)) throw new ErroConsultaHistorica("Informe o mês como AAAA-MM.", 400);
  if (filtro.numero && !/^\d{1,9}$/.test(filtro.numero)) throw new ErroConsultaHistorica("Número original inválido.", 400);
  const pagina = Number.isSafeInteger(filtro.pagina) && filtro.pagina! > 0 ? Math.min(filtro.pagina!, 10000) : 1;
  // JSON projetado no banco: notas, contatos e endereços não saem desta API.
  const linhas = await prisma.$queryRaw<Linha[]>`
    SELECT p.id AS "pedidoId", p."referenciaPedido" AS "numeroOriginal",
      (i."dadosOrigem"->'registro'->>'linha')::int AS linha,
      jsonb_build_object('data_criacao',i."dadosOrigem"->'registro'->'data_criacao',
        'totais',COALESCE(i."dadosOrigem"->'hub'->'consulta'->'totais',i."dadosOrigem"->'registro'->'totais'),
        'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object('bloco',x->'bloco',
          'nome_original',x->'nome_original','quantidade',x->'quantidade',
          'preco_unitario_liquido',x->'preco_unitario_liquido','desconto_linha',x->'desconto_linha',
          'liquido_linha',x->'liquido_linha','origem',x->'origem')) FROM jsonb_array_elements(COALESCE(i."dadosOrigem"->'hub'->'consulta'->'itens',i."dadosOrigem"->'registro'->'itens')) x),'[]'::jsonb)) AS registro,
      i."dadosOrigem"->'hub'->'consumo' AS consumo,
      i."dadosOrigem"->'hub'->'pagamento' AS pagamento
    FROM "IdentidadeExternaVenda" i JOIN "PedidoVenda" p ON p.id=i."destinoId"
    WHERE i.origem=${ORIGEM_HISTORICA} AND i.loja=${LOJA_HISTORICA} AND i.entidade='PEDIDO_HISTORICO'
      AND p.status='HISTORICO'
      AND (${filtro.numero ?? ""}='' OR p."referenciaPedido"=${filtro.numero ?? ""})
      AND (${filtro.mes ?? ""}='' OR CASE WHEN ${tipo}='pagamentos'
        THEN i."dadosOrigem"->'hub'->'pagamento'->>'mes'
        ELSE i."dadosOrigem"->'registro'->'data_criacao'->>'mes' END=${filtro.mes ?? ""})
    ORDER BY p."referenciaPedido",p.id`;
  const meses = new Map<string, { pedidos: number; itens: number; itensFontePrincipal: number; itensComplementares: number; itensQuantidadeNaoApurada: number; unidades: Prisma.Decimal; bruto: Prisma.Decimal; descontos: Prisma.Decimal; freteAjusteOriginal: Prisma.Decimal; total: Prisma.Decimal }>();
  const eventos: Record<string, unknown>[] = linhas.flatMap<Record<string, unknown>>(l => {
    const r = l.registro, t = objeto(r.totais), d = objeto(r.data_criacao), pagamento = objeto(l.pagamento), itens = lista(r.itens).map(objeto);
    const mes = texto(tipo === "pagamentos" ? pagamento.mes : d.mes);
    if (!mes || tipo === "pagamentos" && !l.pagamento) return [];
    const m = meses.get(mes) ?? { pedidos: 0, itens: 0, itensFontePrincipal: 0, itensComplementares: 0, itensQuantidadeNaoApurada: 0, unidades: decimal("0"), bruto: decimal("0"), descontos: decimal("0"), freteAjusteOriginal: decimal("0"), total: decimal("0") };
    m.pedidos++; m.itens += itens.length;
    for (const i of itens) { if (i.origem === "WOOCOMMERCE_COMPLEMENTAR") m.itensComplementares++; else m.itensFontePrincipal++; if (i.quantidade === null) m.itensQuantidadeNaoApurada++; else m.unidades = m.unidades.plus(decimal(i.quantidade)); }
    m.bruto = m.bruto.plus(decimal(t.subtotal_produtos_original)); m.descontos = m.descontos.plus(decimal(t.desconto_itens));
    m.freteAjusteOriginal = m.freteAjusteOriginal.plus(decimal(t.frete_ajuste_original));
    m.total = m.total.plus(decimal(tipo === "pagamentos" ? pagamento.total : t.total_original)); meses.set(mes, m);
    const base = { pedidoId: l.pedidoId, numeroOriginal: l.numeroOriginal, linha: l.linha, mes };
    if (tipo === "pagamentos") return [{ ...base, dataLocal: texto(pagamento.dataLocal), valor: texto(pagamento.total), base: "PAGAMENTO_INFORMADO", comprovacao: "FONTE_SEM_CONCILIACAO", protegidoSetembro: mes >= "2026-09", efeitoOperacional: false }];
    if (tipo === "consumo") return [{ ...base, referencia: referenciaConsumo(l.consumo), efeitoOperacional: false }];
    return [{ ...base, dataCriacaoLocal: texto(d.local_exato), itens, totais: totaisPermitidos(t) }];
  });
  return { origem: ORIGEM_HISTORICA, base: tipo, fuso: "America/Sao_Paulo", camada: "HISTORICA_SEGREGADA",
    aviso: tipo === "pagamentos" ? "Pagamento informado pela fonte. Não comprova crédito bancário, saldo ou lucro. Setembro sem efeitos operacionais." : tipo === "consumo" ? "Referências congeladas. Consumo estimado ou não apurado; não altera estoque disponível." : "Datas, valores e itens preservados da fonte. Detalhamento parcial permanece identificado.",
    efeitoFinanceiro: false, efeitoEstoque: false, total: eventos.length, pagina, tamanhoPagina: 50,
    meses: [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => ({ mes, ...m, unidades: m.unidades.toString(), bruto: m.bruto.toFixed(2), descontos: m.descontos.toFixed(2), freteAjusteOriginal: m.freteAjusteOriginal.toFixed(2), total: m.total.toFixed(2) })),
    registros: eventos.slice((pagina - 1) * 50, pagina * 50) };
}
