import { apresentacaoCanalVenda } from "./canais-apresentacao";
import { Prisma } from "@/generated/prisma/client";
import { diaNoFuso, somarDias } from "./pedidos-agenda-dominio";
import { normalizarFiltrosBi, periodoComparacaoBi } from "./bi-filtros";
import { ErroBi } from "./bi-filtros";
import { completarPeriodo } from "@/lib/financeiro/periodos";
import { locaisEntregasBi, ordenarLinhasBi, regiaoDoPedidoBi, tempoRecompraBi } from "./bi-analises";
import type { CategoriaBi, ClienteBi, CoberturaBi, FiltrosBi, IndicadoresBi, OpcaoBi, PermissoesBi, ProdutoBi, RegiaoBi, ResultadoBi, SerieBi, VariacaoBi } from "./bi-types";
export { normalizarFiltrosBi, periodoComparacaoBi, ErroBi } from "./bi-filtros";

type Objeto = Record<string, unknown>;
export type ItemFonteBi = { id: string; produtoId: string | null; nome: string; unidade: string; quantidade: string | null; receita: string; categorias: OpcaoBi[] };
export type PedidoFonteBi = {
  id: string; numero: string; status: string; origem: "historico" | "nativo"; identidade: string | null;
  data: string; dataEntrega: string | null; atualizadoEm: string; clienteId: string | null; clienteNome: string | null;
  clienteIdentificavel: boolean; canalId: string | null; canalNome: string | null; modalidade: string | null;
  regiao: string | null; enderecoEstado: "confirmado" | "aproximado" | "nao-validado" | "ausente";
  itens: ItemFonteBi[]; receita: string; naoDetalhado: string; frete: string; ajusteFrete: string;
  custoEntrega: string | null; statusHistorico: string | null; fonteHistorica: boolean; teste: boolean; ajusteComercial?: string; reducaoSemComponente?: string;
  clienteTipo?: "PF" | "PJ" | null; descontos?: string | null;
  cep?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null;
  coordenadas?: { latitude: number; longitude: number; precisao: "destino" | "bairro" | "cep"; origem: string } | null;
  freteOriginalRetirada?: string;
  totalOriginalHistorico?: string | null;
};
const D = Prisma.Decimal;
const zero = () => new D(0);
const valor = (v: string | number) => new D(v);
const moeda = (v: Prisma.Decimal) => Number(v.toFixed(2));
const soma = (linhas: PedidoFonteBi[], campo: "receita" | "frete" | "naoDetalhado") => linhas.reduce((n, p) => n.plus(p[campo]), zero());
const receitaApurada = (p: PedidoFonteBi) => valor(p.reducaoSemComponente ?? "0").isZero();
const faturamentoPedido = (p: PedidoFonteBi) => valor(p.receita).plus(p.frete);
const vendasApuradas = (linhas: PedidoFonteBi[]) => linhas.every(receitaApurada) ? linhas.reduce((n, p) => n.plus(faturamentoPedido(p)), zero()) : null;
// Frete explicitamente zero continua conhecido: não havia cobrança a reduzir.
const freteApurado = (p: PedidoFonteBi) => receitaApurada(p) || valor(p.frete).isZero();
const normal = (v: string) => v.normalize("NFKD").replace(/\p{M}/gu, "").trim().replace(/\s+/gu, " ").toLowerCase();
export const DEFINICOES_BI = [
  "Vendas válidas: pedidos nativos CONFIRMADO e históricos HISTORICO vinculados à fonte. Orçamentos, cancelados, estornados, histórico revertido e marcações explícitas de teste ficam fora. Valor zero não implica cancelamento.",
  "Histórico: excluem-se estados finais comprovados de cancelamento, reembolso integral, falha, orçamento e teste. Estado não recuperado é incluído com cobertura explícita. A origem técnica da importação não é um canal comercial.",
  "Faturamento: líquido comercial dos produtos mais o frete efetivamente cobrado, com linhas vigentes e parcelas históricas sem detalhamento. Preços históricos já líquidos não recebem novo desconto. Frete não é rateado entre produtos: o ranking conserva a receita de produtos e sua soma mais o frete reconcilia com o faturamento. Ajustes negativos históricos de frete a classificar permanecem separados. Redução de pós-venda sem alocação comprovada entre componentes deixa receita afetada e ticket Não apurado.",
  "Total original na fonte histórica: soma dos valores total_original comprovados dos pedidos históricos da seleção. Não é recalculado pelo faturamento nem pelos ajustes. A ausência desse valor em qualquer pedido histórico deixa o total Não apurado. Ajustes históricos de frete permanecem separados das vendas e não são classificados como desconto.",
  "Descontos: descontos comerciais registrados nos mesmos pedidos. No pedido nativo, os descontos das linhas são o rateio do desconto do pedido e não são somados novamente. No histórico, usa desconto_itens da fonte validada. O valor é informativo e já está incorporado ao faturamento; ausência de comprovação fica Não apurado.",
  "Pedidos válidos: pedidos distintos na mesma coorte comercial. Devolução parcial conserva o pedido; devolução integral em pedido ainda CONFIRMADO conserva sua contagem. ESTORNADO e reembolso integral histórico comprovado são excluídos.",
  "Ticket médio: faturamento, incluindo o frete cobrado, dividido pelos pedidos válidos. Filtros de produto e categoria selecionam pedidos que contêm o item; os indicadores conservam o faturamento integral desses pedidos. Participação dos produtos usa somente a receita de produtos, sem rateio de frete.",
  "Categorias mais vendidas: receita líquida dos itens, sem frete, e pedidos distintos que contêm a categoria. Um produto pode pertencer a mais de uma categoria; sua receita participa de cada vínculo, sem rateio inventado. As categorias podem se sobrepor e não devem ser somadas como faturamento. Sem categoria e Sem detalhamento permanecem explícitos.",
  "Clientes compradores: comprador identificado pelo vínculo explícito ao cadastro canônico de ClienteVenda, com o nome atual. Pedidos sem esse vínculo não identificam comprador. Destinatários nunca contam como compradores.",
  "Pessoa física e jurídica: pedidos e faturamento da mesma seleção, classificados pelo tipo atual do comprador no cadastro canônico. Cada pedido conta uma vez. Sem vínculo identificável ou tipo cadastrado, permanece Sem classificação. Faturamento inclui o frete cobrado e conserva reduções não apuradas; não é uma contagem de clientes únicos. A consulta exige permissão de contatos.",
  "Recorrência: compradores identificados no período com pelo menos duas compras válidas em todo o histórico disponível até a data final. Não considera compras posteriores. O histórico anterior à primeira data pode estar incompleto.",
  "Tempo médio de recompra: média em dias entre pedidos válidos consecutivos dos compradores recorrentes presentes na seleção, no histórico disponível até a data final. Cada intervalo recebe o mesmo peso; compras no mesmo dia têm intervalo zero. Compras futuras e destinatários não participam. O histórico anterior à primeira data pode estar incompleto.",
  "Frete: frete efetivamente cobrado; ajuste histórico negativo fica separado, sem reclassificar como custo logístico. Redução sem componente definido impede apurar o frete líquido positivo afetado. Frete explicitamente zero continua zero. Custo e subsídio usam somente entregas com frete e custo efetivo conhecidos; estimativa e campo ausente não viram zero.",
  "Data do pedido: data civil da compra quando informada; pedidos anteriores conservam a criação comercial no fuso America/Sao_Paulo. Data de entrega: entrega realizada, sem substituição pela compra. Intervalos incluem o dia final completo.",
  "Custos de produção históricos não comprovados ficam Não apurado. Composição ou custo atual não comprovam custo histórico. Nenhum resultado representa lucro líquido ou conciliação financeira.",
  "Marco financeiro e de estoque: 01/09/2026. O BI consulta vendas anteriores sem gerar efeitos financeiros, físicos, fiscais ou de integração.",
];
export function vendaValidaBi(p: PedidoFonteBi): boolean {
  if (p.teste) return false;
  if (p.origem === "nativo") return p.status === "CONFIRMADO";
  if (p.status !== "HISTORICO" || !p.fonteHistorica) return false;
  return !/^(cancelad[oa]|cancelled|canceled|reembolsad[oa]|refunded|falh[ao]|failed|orcamento|teste|rascunho|pendente de pagamento)$/u.test(normal(p.statusHistorico ?? ""));
}
function deduplicar(linhas: PedidoFonteBi[]) {
  const ids = new Map<string, PedidoFonteBi>(), origens = new Set<string>(); let duplicadas = 0;
  for (const p of [...linhas].sort((a, b) => Number(a.origem === "historico") - Number(b.origem === "historico"))) {
    if (ids.has(p.id) || p.identidade && origens.has(p.identidade)) { duplicadas++; continue; }
    ids.set(p.id, p); if (p.identidade) origens.add(p.identidade);
  }
  return { linhas: [...ids.values()], duplicadas };
}
function pertence(p: PedidoFonteBi, f: FiltrosBi, ignorarData = false): boolean {
  const data = f.baseData === "entrega" ? p.dataEntrega : p.data;
  return (ignorarData || !!data && data >= f.de && data <= f.ate) &&
    (!f.canal || (p.canalId ?? "nao-identificado") === f.canal) &&
    (!f.categoria || p.itens.some(i => f.categoria === "sem-categoria" ? !i.categorias.length : i.categorias.some(c => c.id === f.categoria)) || f.categoria === "sem-detalhamento" && !valor(p.naoDetalhado).isZero()) &&
    (!f.produto || f.produto === "sem-detalhamento" ? !f.produto || !valor(p.naoDetalhado).isZero() : p.itens.some(i => (i.produtoId ?? `historico:${i.id}`) === f.produto)) &&
    (!f.cliente || p.clienteIdentificavel && p.clienteId === f.cliente) && (!f.regiao || normal(regiaoDoPedidoBi(p, f)) === normal(f.regiao)) &&
    (f.aba !== "clientes" || f.tipoCliente === "todos" || p.clienteIdentificavel && p.clienteTipo === f.tipoCliente) &&
    (!f.cepDe || !!p.cep && p.cep >= f.cepDe) && (!f.cepAte || !!p.cep && p.cep <= f.cepAte) &&
    (!f.modalidade || (p.modalidade ?? "NAO_INFORMADO") === f.modalidade) && (f.origem === "todas" || p.origem === f.origem) &&
    (!f.somenteConfirmados || p.enderecoEstado === "confirmado");
}
function indicadores(linhas: PedidoFonteBi[], historico: PedidoFonteBi[], fim: string): IndicadoresBi {
  const compradores = new Set(linhas.filter(p => p.clienteIdentificavel && p.clienteId).map(p => p.clienteId!));
  const compras = new Map<string, number>(); for (const p of historico) if (p.clienteId && p.clienteIdentificavel && p.data <= fim) compras.set(p.clienteId, (compras.get(p.clienteId) ?? 0) + 1);
  const recorrentes = [...compradores].filter(c => (compras.get(c) ?? 0) >= 2).length;
  const vendas = vendasApuradas(linhas);
  return { vendas: vendas === null ? null : moeda(vendas), descontos: linhas.every(p => p.descontos != null) ? moeda(linhas.reduce((n, p) => n.plus(p.descontos!), zero())) : null, pedidos: linhas.length, ticket: vendas !== null && linhas.length ? moeda(vendas.div(linhas.length)) : null, compradores: compradores.size, recorrencia: compradores.size ? recorrentes * 100 / compradores.size : null, frete: linhas.every(freteApurado) ? moeda(soma(linhas, "frete")) : null };
}
function ranking(linhas: PedidoFonteBi[]): ProdutoBi[] {
  const mapa = new Map<string, { id: string; nome: string; unidade: string; receita: Prisma.Decimal; quantidade: Prisma.Decimal | null; pedidos: Set<string>; totalPedidos: Prisma.Decimal; naoApurada: boolean }>();
  for (const p of linhas) {
    const itens: ItemFonteBi[] = [...p.itens, ...(!valor(p.naoDetalhado).isZero() ? [{ id: "sem-detalhamento", produtoId: "sem-detalhamento", nome: "Sem detalhamento", unidade: "Não informada", quantidade: null, receita: p.naoDetalhado, categorias: [] }] : [])];
    for (const item of itens) {
      const id = item.produtoId ?? `historico:${item.id}`, chave = JSON.stringify([id, item.unidade]);
      const g = mapa.get(chave) ?? { id, nome: item.nome.replace(/\s+/gu, " ").trim(), unidade: item.unidade, receita: zero(), quantidade: item.quantidade === null ? null : zero(), pedidos: new Set<string>(), totalPedidos: zero(), naoApurada: false };
      g.naoApurada ||= !receitaApurada(p);
      g.receita = g.receita.plus(item.receita); g.quantidade = g.quantidade === null || item.quantidade === null ? null : g.quantidade.plus(item.quantidade);
      if (!g.pedidos.has(p.id)) { g.pedidos.add(p.id); g.totalPedidos = g.totalPedidos.plus(faturamentoPedido(p)); }
      mapa.set(chave, g);
    }
  }
  const receita = linhas.every(receitaApurada) ? soma(linhas, "receita") : null;
  return [...mapa.values()].map(g => ({ id: g.id, nome: g.nome, unidade: g.unidade, receita: g.naoApurada ? null : moeda(g.receita), quantidade: g.quantidade?.toNumber() ?? null, pedidos: g.pedidos.size, participacao: g.naoApurada || receita === null || receita.isZero() ? null : g.receita.div(receita).mul(100).toNumber(), ticket: !g.naoApurada && g.pedidos.size ? moeda(g.totalPedidos.div(g.pedidos.size)) : null }));
}
function agruparRegioes(linhas: PedidoFonteBi[], custos: boolean, f: FiltrosBi): RegiaoBi[] {
  const grupos = new Map<string, { nome: string; pedidos: number; frete: Prisma.Decimal; custo: Prisma.Decimal | null; custosConhecidos: number; confirmados: number; aproximados: number; naoValidados: number; freteNaoApurado: boolean }>();
  for (const p of linhas.filter(p => p.modalidade === "ENTREGA")) {
    const nome = regiaoDoPedidoBi(p, f), chave = normal(nome), g = grupos.get(chave) ?? { nome, pedidos: 0, frete: zero(), custo: null, custosConhecidos: 0, confirmados: 0, aproximados: 0, naoValidados: 0, freteNaoApurado: false };
    g.freteNaoApurado ||= !freteApurado(p);
    g.pedidos++; g.frete = g.frete.plus(p.frete); if (custos && p.custoEntrega !== null) { g.custo = (g.custo ?? zero()).plus(p.custoEntrega); g.custosConhecidos++; }
    if (p.enderecoEstado === "confirmado") g.confirmados++; else if (p.enderecoEstado === "aproximado") g.aproximados++; else g.naoValidados++;
    grupos.set(chave, g);
  }
  return [...grupos.values()].map(g => ({ nome: g.nome, pedidos: g.pedidos, custosConhecidos: g.custosConhecidos, confirmados: g.confirmados, aproximados: g.aproximados, naoValidados: g.naoValidados, frete: g.freteNaoApurado ? null : moeda(g.frete), custo: g.custo === null ? null : moeda(g.custo) })).sort((a, b) => b.pedidos - a.pedidos || a.nome.localeCompare(b.nome, "pt-BR"));
}
function primeira(linhas: PedidoFonteBi[]) { return linhas.reduce<string | null>((a, p) => !a || p.data < a ? p.data : a, null); }
function ultima(linhas: PedidoFonteBi[]) { return linhas.reduce<string | null>((a, p) => !a || p.data > a ? p.data : a, null); }
function clientes(linhas: PedidoFonteBi[], historico: PedidoFonteBi[], f: FiltrosBi): ClienteBi[] {
  const grupos = new Map<string, { nome: string; tipo: ClienteBi["tipo"]; pedidos: number; vendas: Prisma.Decimal | null; primeira: string | null; ultima: string | null; comprasHistoricas: number }>();
  for (const p of linhas) {
    if (!p.clienteIdentificavel || !p.clienteId) continue;
    const grupo = grupos.get(p.clienteId) ?? { nome: p.clienteNome ?? "Comprador identificado", tipo: null, pedidos: 0, vendas: zero(), primeira: null, ultima: null, comprasHistoricas: 0 };
    grupo.pedidos++;
    grupo.tipo ??= p.clienteTipo ?? null;
    grupo.vendas = grupo.vendas === null || !receitaApurada(p) ? null : grupo.vendas.plus(faturamentoPedido(p));
    grupos.set(p.clienteId, grupo);
  }
  for (const p of historico) {
    if (!p.clienteIdentificavel || !p.clienteId || p.data > f.ate) continue;
    const grupo = grupos.get(p.clienteId);
    if (!grupo) continue;
    grupo.comprasHistoricas++;
    if (grupo.primeira === null || p.data < grupo.primeira) grupo.primeira = p.data;
    if (grupo.ultima === null || p.data > grupo.ultima) grupo.ultima = p.data;
  }
  return [...grupos].map(([id, grupo]) => {
    return { id, nome: grupo.nome, tipo: grupo.tipo, compras: grupo.pedidos, valor: grupo.vendas === null ? null : moeda(grupo.vendas), ticket: grupo.vendas === null ? null : moeda(grupo.vendas.div(grupo.pedidos)), primeira: grupo.primeira!, ultima: grupo.ultima!, recorrente: grupo.comprasHistoricas >= 2, diasSemCompra: Math.floor((Date.parse(f.ate) - Date.parse(grupo.ultima!)) / 86400000) };
  }).sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity) || a.nome.localeCompare(b.nome, "pt-BR"));
}

function categoriasMaisVendidas(linhas: PedidoFonteBi[]): CategoriaBi[] {
  const grupos = new Map<string, { nome: string; receita: Prisma.Decimal | null; pedidos: Set<string> }>();
  for (const p of linhas) {
    const itens = [...p.itens, ...(!valor(p.naoDetalhado).isZero() ? [{ receita: p.naoDetalhado, categorias: [{ id: "sem-detalhamento", nome: "Sem detalhamento" }] }] : [])];
    for (const item of itens) {
      const categorias = new Map((item.categorias.length ? item.categorias : [{ id: "sem-categoria", nome: "Sem categoria" }]).map(c => [c.id, c]));
      for (const categoria of categorias.values()) {
        const grupo = grupos.get(categoria.id) ?? { nome: categoria.nome, receita: zero(), pedidos: new Set<string>() };
        grupo.receita = grupo.receita === null || !receitaApurada(p) ? null : grupo.receita.plus(item.receita);
        grupo.pedidos.add(p.id);
        grupos.set(categoria.id, grupo);
      }
    }
  }
  return [...grupos].map(([id, grupo]) => ({ id, nome: grupo.nome, receita: grupo.receita === null ? null : moeda(grupo.receita), pedidos: grupo.pedidos.size }))
    .sort((a, b) => (b.receita ?? -Infinity) - (a.receita ?? -Infinity) || a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
}
function inicioGrupo(dia: string, modo: FiltrosBi["agrupamento"]) { if (modo === "mes") return dia.slice(0, 7) + "-01"; if (modo === "semana") return somarDias(dia, -((new Date(dia + "T12:00:00Z").getUTCDay() + 6) % 7)); return dia; }
type IntervaloCobertura = { de: string; ate: string };
function diaCoberto(dia: string, intervalos: IntervaloCobertura[]) { return intervalos.some(i => dia >= i.de && dia <= i.ate); }
function periodoCoberto(de: string, ate: string, intervalos: IntervaloCobertura[]) { for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) if (!diaCoberto(dia, intervalos)) return false; return true; }
function intervalosCobertura(linhas: PedidoFonteBi[], f: FiltrosBi, hoje: string): IntervaloCobertura[] {
  return (["historico", "nativo"] as const).flatMap(origem => {
    const datas = linhas.filter(p => p.origem === origem).map(p => f.baseData === "entrega" ? p.dataEntrega : p.data).filter((d): d is string => !!d).sort();
    return datas.length ? [{ de: datas[0], ate: origem === "nativo" && f.baseData === "pedido" ? hoje : datas.at(-1)! }] : [];
  });
}
function serie(linhas: PedidoFonteBi[], anterior: PedidoFonteBi[], f: FiltrosBi, cobertura: IntervaloCobertura[]): SerieBi[] {
  const grupos = new Map<string, SerieBi>();
  const naoApurados = new Set<string>(), anterioresNaoApurados = new Set<string>();
  for (let dia = f.de; dia <= f.ate; dia = somarDias(dia, 1)) {
    const chave = inicioGrupo(dia, f.agrupamento), coberto = diaCoberto(dia, cobertura);
    if (grupos.has(chave)) { const g = grupos.get(chave)!; g.ate = dia; g.parcial = g.parcial || !coberto || !g.coberto; if (coberto && !g.coberto) { g.coberto = true; g.vendas = 0; g.pedidos = 0; } continue; }
    const rotulo = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...(f.agrupamento === "mes" ? { month: "short", year: f.de.slice(0, 4) === f.ate.slice(0, 4) ? undefined : "2-digit" } : { day: "2-digit", month: "short" }) }).format(new Date(dia + "T12:00:00Z")).replace(".", "");
    grupos.set(chave, { de: dia, ate: dia, rotulo, vendas: coberto ? 0 : null, pedidos: coberto ? 0 : null, anteriorVendas: null, anteriorPedidos: null, coberto, parcial: !coberto });
  }
  for (const p of linhas) { const dia = (f.baseData === "entrega" ? p.dataEntrega : p.data)!, chave = inicioGrupo(dia, f.agrupamento), g = grupos.get(chave); if (g) { g.vendas = moeda(valor(g.vendas ?? 0).plus(faturamentoPedido(p))); g.pedidos = (g.pedidos ?? 0) + 1; g.coberto = true; if (!receitaApurada(p)) naoApurados.add(chave); } }
  const comparacao = periodoComparacaoBi(f);
  // Ausência de pedidos em um dia coberto é zero. Fora da cobertura permanece null.
  if (comparacao) for (let dia = comparacao.de; dia <= comparacao.ate; dia = somarDias(dia, 1)) {
    const distancia = Math.round((Date.parse(dia) - Date.parse(comparacao.de)) / 86400000), correspondente = somarDias(f.de, distancia);
    if (correspondente > f.ate) break;
    const g = grupos.get(inicioGrupo(correspondente, f.agrupamento));
    if (g && diaCoberto(dia, cobertura)) { g.anteriorVendas ??= 0; g.anteriorPedidos ??= 0; }
  }
  if (comparacao) for (const p of anterior) {
    const dia = (f.baseData === "entrega" ? p.dataEntrega : p.data)!;
    const distancia = Math.round((Date.parse(dia) - Date.parse(comparacao.de)) / 86400000), correspondente = somarDias(f.de, distancia), g = grupos.get(inicioGrupo(correspondente, f.agrupamento));
    if (g) { g.anteriorVendas = moeda(valor(g.anteriorVendas ?? 0).plus(faturamentoPedido(p))); g.anteriorPedidos = (g.anteriorPedidos ?? 0) + 1; if (!receitaApurada(p)) anterioresNaoApurados.add(inicioGrupo(correspondente, f.agrupamento)); }
  }
  for (const chave of naoApurados) grupos.get(chave)!.vendas = null;
  for (const chave of anterioresNaoApurados) grupos.get(chave)!.anteriorVendas = null;
  return [...grupos.values()];
}
const paginar = <T>(linhas: T[], pagina: number, completo = false) => ({ linhas: completo ? linhas : linhas.slice((pagina - 1) * 25, pagina * 25), total: linhas.length, pagina, paginas: Math.ceil(linhas.length / 25) });
function opcoes(linhas: PedidoFonteBi[], contatos: boolean, f: FiltrosBi) {
  const unicas = (valores: OpcaoBi[]) => [...new Map(valores.map(v => [v.id, v])).values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { canais: unicas(linhas.map(p => ({ id: p.canalId ?? "nao-identificado", nome: p.canalNome ?? "Não identificado" }))), categorias: unicas(linhas.flatMap(p => p.itens.flatMap(i => i.categorias.length ? i.categorias : [{ id: "sem-categoria", nome: "Sem categoria" }])).concat(linhas.some(p => !valor(p.naoDetalhado).isZero()) ? [{ id: "sem-detalhamento", nome: "Sem detalhamento" }] : [])), produtos: unicas(linhas.flatMap(p => p.itens.map(i => ({ id: i.produtoId ?? `historico:${i.id}`, nome: i.nome }))).concat(linhas.some(p => !valor(p.naoDetalhado).isZero()) ? [{ id: "sem-detalhamento", nome: "Sem detalhamento" }] : [])), clientes: contatos ? unicas(linhas.filter(p => p.clienteIdentificavel && p.clienteId).map(p => ({ id: p.clienteId!, nome: p.clienteNome ?? "Comprador identificado" }))) : [], regioes: agruparRegioes(linhas, false, f).map(g => ({ id: g.nome, nome: g.nome })), modalidades: unicas(linhas.map(p => ({ id: p.modalidade ?? "NAO_INFORMADO", nome: p.modalidade === "ENTREGA" ? "Entrega" : p.modalidade === "RETIRADA" ? "Retirada" : "Não informada" }))) };
}
export function montarResultadoBi(fontes: PedidoFonteBi[], entrada: Partial<FiltrosBi>, permissoes: PermissoesBi, agora = new Date(), opcoesConsulta: { exportacao?: boolean; canais?: OpcaoBi[]; clientes?: OpcaoBi[] } = {}): ResultadoBi {
  const inicio = performance.now(), filtrosSolicitados = normalizarFiltrosBi(entrada, agora);
  const dedup = deduplicar(fontes), validos = dedup.linhas.filter(vendaValidaBi);
  const periodoEfetivo = completarPeriodo(filtrosSolicitados, validos.map(p => filtrosSolicitados.baseData === "entrega" ? p.dataEntrega : p.data), diaNoFuso(agora, "America/Sao_Paulo"));
  if ((Date.parse(periodoEfetivo.ate) - Date.parse(periodoEfetivo.de)) / 86400000 > 3660) throw new ErroBi("Consulte até dez anos por vez.");
  const f = { ...filtrosSolicitados, ...periodoEfetivo }, linhas = validos.filter(p => pertence(p, f));
  const periodoAnterior = periodoComparacaoBi(f), linhasAnteriores = periodoAnterior ? validos.filter(p => pertence(p, { ...f, ...periodoAnterior })) : [];
  const atual = indicadores(linhas, validos, f.ate), anterior = periodoAnterior ? indicadores(linhasAnteriores, validos, periodoAnterior.ate) : null;
  const primeiraData = primeira(validos), ultimaData = ultima(validos), hoje = diaNoFuso(agora, "America/Sao_Paulo");
  const intervalos = intervalosCobertura(validos, f, hoje);
  const baseComparavel = !!anterior?.pedidos && !!periodoAnterior && periodoCoberto(periodoAnterior.de, periodoAnterior.ate, intervalos) && periodoCoberto(f.de, f.ate, intervalos);
  const variacoes = Object.fromEntries((Object.keys(atual) as (keyof IndicadoresBi)[]).map(chave => {
    const antes = anterior?.[chave], atualValor = atual[chave], taxa = chave === "recorrencia";
    const estado: VariacaoBi["estado"] = !anterior ? "desativada" : !baseComparavel || antes == null || atualValor == null || !taxa && antes === 0 ? "sem-base" : "comparavel";
    return [chave, { valor: estado === "comparavel" ? taxa ? atualValor! - antes! : (atualValor! - antes!) / Math.abs(antes!) * 100 : null, unidade: taxa ? "p.p." : "%", estado }];
  })) as ResultadoBi["variacoes"];
  const pagina = <T>(itens: T[]) => paginar(itens, f.pagina, opcoesConsulta.exportacao);
  const produtos = ranking(linhas).sort((a, b) => (f.ranking === "quantidade" ? (b.quantidade ?? -Infinity) - (a.quantidade ?? -Infinity) : (b.receita ?? -Infinity) - (a.receita ?? -Infinity)) || a.nome.localeCompare(b.nome, "pt-BR"));
  const regioes = agruparRegioes(linhas, permissoes.custos, f), clientesPeriodo = permissoes.contatos ? clientes(linhas, validos, f) : [];
  const entregas = linhas.filter(p => p.modalidade === "ENTREGA"), custosConhecidos = entregas.filter(p => p.custoEntrega !== null), comCusto = custosConhecidos.filter(freteApurado);
  const custoEntrega = permissoes.custos && comCusto.length ? moeda(comCusto.reduce((n, p) => n.plus(p.custoEntrega!), zero())) : null;
  const freteCoberto = permissoes.custos && comCusto.length ? moeda(soma(comCusto, "frete")) : null;
  const historicosSelecionados = linhas.filter(p => p.origem === "historico");
  const cobertura: CoberturaBi = {
    primeiraData, ultimaData, pedidosHistoricos: validos.filter(p => p.origem === "historico").length,
    pedidosNativos: validos.filter(p => p.origem === "nativo").length,
    importacao: validos.some(p => p.origem === "historico") ? "registros-disponiveis" : "sem-registros", importacaoCompletaComprovada: false,
    pedidosSemCliente: linhas.filter(p => !p.clienteId || !p.clienteIdentificavel).length,
    clientesIdentificados: linhas.filter(p => p.clienteId && p.clienteIdentificavel).length,
    datasEntrega: 0, ajustesComerciaisNaoClassificados: 0, pedidosComAjusteComercial: 0,
    pedidosComReducaoSemComponente: 0, reducaoComercialSemComponente: 0, pedidosComReceitaApurada: 0, vendasProdutosConhecidas: 0,
    pedidosComFreteApurado: 0, freteCobradoConhecido: 0, entregasComFreteECusto: permissoes.custos ? comCusto.length : null,
    pedidosComDescontoApurado: linhas.filter(p => p.descontos != null).length,
    descontosConhecidos: moeda(linhas.reduce((n, p) => n.plus(p.descontos ?? "0"), zero())),
    retiradasSemEndereco: linhas.filter(p => p.freteOriginalRetirada !== undefined).length,
    freteOriginalRetiradas: moeda(linhas.reduce((n, p) => n.plus(p.freteOriginalRetirada ?? "0"), zero())),
    pedidosSemData: f.baseData === "entrega" ? validos.filter(p => !p.dataEntrega && pertence(p, f, true)).length : 0,
    pedidosSemCanal: linhas.filter(p => !p.canalId).length, pedidosSemDetalhamento: linhas.filter(p => !valor(p.naoDetalhado).isZero()).length,
    valorSemDetalhamento: moeda(soma(linhas, "naoDetalhado")), statusHistoricoNaoInformado: linhas.filter(p => p.origem === "historico" && !p.statusHistorico).length,
    entregas: entregas.length, localizadas: entregas.filter(p => p.regiao && p.enderecoEstado !== "ausente").length,
    confirmadas: entregas.filter(p => p.enderecoEstado === "confirmado").length, aproximadas: entregas.filter(p => p.enderecoEstado === "aproximado").length,
    semEndereco: entregas.filter(p => !p.regiao).length, modalidadeNaoInformada: linhas.filter(p => !p.modalidade).length,
    custosEntrega: permissoes.custos ? custosConhecidos.length : null, custosProdutos: permissoes.custos ? 0 : null,
    fretesNegativos: linhas.filter(p => valor(p.ajusteFrete).lt(0) || valor(p.frete).lt(0)).length,
    ajustesFrete: moeda(linhas.reduce((n, p) => n.plus(p.ajusteFrete), zero())),
    pedidosTotalOriginalHistorico: historicosSelecionados.length,
    totalOriginalHistorico: historicosSelecionados.length && historicosSelecionados.every(p => p.totalOriginalHistorico != null) ? moeda(historicosSelecionados.reduce((n, p) => n.plus(p.totalOriginalHistorico!), zero())) : null,
    duplicidadesExcluidas: dedup.duplicadas, excluidos: dedup.linhas.length - validos.length, parcial: false, avisos: [],
  };
  cobertura.avisos.push(cobertura.pedidosHistoricos ? "Há registros históricos no HUB. A conclusão integral da importação não é comprovada apenas pela presença desses registros." : "Nenhum pedido histórico vinculado está disponível nesta consulta. A importação não foi executada pelo BI.");
  if (primeiraData) cobertura.avisos.push(`Histórico disponível desde ${primeiraData.split("-").reverse().join("/")}; períodos anteriores podem estar incompletos.`);
  if (cobertura.pedidosSemCliente) cobertura.avisos.push(`${cobertura.pedidosSemCliente} pedidos sem comprador identificável ficam fora das métricas de clientes.`);
  if (cobertura.statusHistoricoNaoInformado) cobertura.avisos.push(`${cobertura.statusHistoricoNaoInformado} pedidos históricos sem estado final recuperável. Zero não foi usado como cancelamento.`);
  if (cobertura.pedidosSemData) cobertura.avisos.push(`${cobertura.pedidosSemData} pedidos sem data de entrega realizada ficam fora do período.`);
  cobertura.avisos.push("Coordenadas confiáveis não são persistidas pelo provedor autorizado. A distribuição usa somente destinos de entrega informados; endereços históricos de cobrança ficam fora.", "Custos históricos de produção não comprovados: margem não apurada. O marco de 01/09/2026 não comprova conciliação.");
  cobertura.datasEntrega = validos.filter(p => p.dataEntrega !== null && p.dataEntrega <= f.ate).length;
  if (cobertura.retiradasSemEndereco) cobertura.avisos.push(`${cobertura.retiradasSemEndereco} pedidos sem endereço de entrega na planilha foram classificados como retirada e sem frete no Dashboard, conforme instrução do usuário. Valores originais permanecem preservados; a fonte desses pedidos registrava ${cobertura.freteOriginalRetiradas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de frete/ajustes, sem alteração financeira.`);
  if (cobertura.pedidosComDescontoApurado < linhas.length) cobertura.avisos.push(`${linhas.length - cobertura.pedidosComDescontoApurado} de ${linhas.length} pedidos sem desconto comprovado. Descontos fica Não apurado; os descontos conhecidos somam ${cobertura.descontosConhecidos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} e já estão incorporados ao faturamento.`);
  cobertura.ajustesComerciaisNaoClassificados = moeda(linhas.reduce((n, p) => n.plus(p.ajusteComercial ?? "0"), zero()));
  cobertura.pedidosComAjusteComercial = linhas.filter(p => !valor(p.ajusteComercial ?? "0").isZero()).length;
  cobertura.pedidosComReducaoSemComponente = linhas.filter(p => !receitaApurada(p)).length;
  cobertura.reducaoComercialSemComponente = moeda(linhas.reduce((n, p) => n.plus(p.reducaoSemComponente ?? "0"), zero()));
  cobertura.pedidosComReceitaApurada = linhas.filter(receitaApurada).length;
  cobertura.vendasProdutosConhecidas = moeda(soma(linhas.filter(receitaApurada), "receita"));
  cobertura.pedidosComFreteApurado = linhas.filter(freteApurado).length;
  cobertura.freteCobradoConhecido = moeda(soma(linhas.filter(freteApurado), "frete"));
  cobertura.parcial = cobertura.pedidosComDescontoApurado < linhas.length || !periodoCoberto(f.de, f.ate, intervalos) || cobertura.pedidosSemCliente > 0 || cobertura.pedidosSemData > 0 || cobertura.pedidosSemCanal > 0 || cobertura.pedidosSemDetalhamento > 0 || cobertura.statusHistoricoNaoInformado > 0 || cobertura.semEndereco > 0 || cobertura.modalidadeNaoInformada > 0 || cobertura.pedidosComAjusteComercial > 0 || (permissoes.custos && linhas.length > 0 && cobertura.custosProdutos === 0);
  if (cobertura.pedidosComAjusteComercial) cobertura.avisos.push(`${cobertura.pedidosComAjusteComercial} pedidos contêm ajustes comerciais históricos a classificar. Esses valores não foram distribuídos entre produtos nem incluídos nas vendas de produtos.`);
  if (cobertura.pedidosComReducaoSemComponente) { cobertura.parcial = true; cobertura.avisos.push(`${cobertura.pedidosComReducaoSemComponente} pedidos contêm reduções de pós-venda sem separação comprovada entre produtos, frete e outros valores. A receita líquida afetada, o ticket e a reconciliação ficam Não apurado. O frete positivo afetado também fica Não apurado e não entra no cálculo de subsídio. A cobertura separa o ajuste, a receita e o frete dos demais pedidos conhecidos.`); }
  if (anterior && !baseComparavel) cobertura.avisos.push("Sem base comparável: o período anterior não contém vendas ou um dos períodos contém dias fora dos intervalos disponíveis.");
  const pares = new Map<string, { produtoA: string; produtoB: string; pedidos: number }>();
  for (const p of linhas) { const itens = [...new Map(p.itens.filter(i => i.produtoId).map(i => [i.produtoId!, i])).values()].sort((a, b) => a.produtoId!.localeCompare(b.produtoId!)); for (let a = 0; a < itens.length; a++) for (let b = a + 1; b < itens.length; b++) { const chave = JSON.stringify([itens[a].produtoId, itens[b].produtoId]); const par = pares.get(chave) ?? { produtoA: itens[a].nome, produtoB: itens[b].nome, pedidos: 0 }; par.pedidos++; pares.set(chave, par); } }
  const serieTemporal = serie(linhas, linhasAnteriores, f, intervalos), rankingTotal = produtos.reduce((n, p) => n.plus(p.receita ?? 0), zero()), temporalTotal = serieTemporal.reduce((n, p) => n.plus(p.vendas ?? 0), zero());
  const reconciliacao: ResultadoBi["reconciliacao"] = atual.vendas === null ? { vendas: null, serie: null, ranking: null, frete: null, pedidos: null, confere: false, naoApurado: true } : { vendas: atual.vendas, serie: moeda(temporalTotal), ranking: moeda(rankingTotal), frete: atual.frete, pedidos: moeda(vendasApuradas(linhas)!), confere: temporalTotal.eq(atual.vendas) && rankingTotal.plus(atual.frete ?? 0).eq(atual.vendas) };
  const atualizados = dedup.linhas.filter(p => pertence(p, f)).map(p => p.atualizadoEm).filter(Boolean).sort();
  const todosClientes = permissoes.contatos ? clientes(validos.filter(p => p.data <= f.ate && pertence(p, f, true)), validos, f) : [];
  const clientesSemTipo = permissoes.contatos ? clientes(validos.filter(p => pertence(p, { ...f, tipoCliente: "todos" })), validos, f) : [];
  const baseClientes = f.somenteSemRecompra ? todosClientes.filter(c => c.diasSemCompra >= f.diasSemRecompra) : clientesPeriodo;
  const contados = f.somenteSemRecompra ? clientes(validos.filter(p => p.data <= f.ate && pertence(p, { ...f, tipoCliente: "todos" }, true)), validos, f).filter(c => c.diasSemCompra >= f.diasSemRecompra) : clientesSemTipo;
  const opcoesResultado = opcoes(validos, permissoes.contatos, f);
  if (opcoesConsulta.canais) {
    const ids = new Set(opcoesConsulta.canais.map(c => c.id));
    opcoesResultado.canais = [...opcoesConsulta.canais, ...opcoesResultado.canais.filter(c => !ids.has(c.id))];
  }
  if (permissoes.contatos && opcoesConsulta.clientes) opcoesResultado.clientes = opcoesConsulta.clientes;
  opcoesResultado.canais = opcoesResultado.canais.map(canal => ({ ...canal, nome: apresentacaoCanalVenda(canal.nome).nome }));
  const distribuicaoClientes: ResultadoBi["distribuicaoClientes"] = permissoes.contatos
    ? (["PF", "PJ", "nao-informado"] as const).map(tipo => {
      const pedidos = linhas.filter(p => (p.clienteId && p.clienteIdentificavel && p.clienteTipo ? p.clienteTipo : "nao-informado") === tipo);
      const faturamento = vendasApuradas(pedidos);
      return { tipo, pedidos: pedidos.length, faturamento: faturamento === null ? null : moeda(faturamento), ticket: faturamento === null || !pedidos.length ? null : moeda(faturamento.div(pedidos.length)) };
    })
    : null;
  return { filtros: filtrosSolicitados, periodoEfetivo, atualizadoEm: atualizados.at(-1) ?? null, consultadoEm: agora.toISOString(), duracaoMs: Math.round(performance.now() - inicio), permissoes,
    distribuicaoClientes, rankingCategorias: categoriasMaisVendidas(linhas),
    recompra: tempoRecompraBi(linhas, validos, f.ate), rankingClientes: clientesPeriodo.slice(0, 5),
    tiposClientes: { todos: contados.length, PF: contados.filter(c => c.tipo === "PF").length, PJ: contados.filter(c => c.tipo === "PJ").length, naoInformado: contados.filter(c => c.tipo === null).length },
    locaisEntrega: locaisEntregasBi(linhas, f).slice(0, 200),
    indicadores: atual, anterior, variacoes, serie: serieTemporal, ranking: produtos.slice(0, 5), regioes: regioes.slice(0, 8), produtos: pagina(ordenarLinhasBi(produtos, f.ordemProdutos, f.direcaoProdutos)),
    clientes: pagina(ordenarLinhasBi(baseClientes, f.ordemClientes, f.direcaoClientes)), entregas: pagina(ordenarLinhasBi(regioes, f.ordemEntregas, f.direcaoEntregas)),
    pedidos: pagina(linhas.map(p => ({ id: p.id, numero: p.numero, data: (f.baseData === "entrega" ? p.dataEntrega : p.data)!, receita: receitaApurada(p) ? moeda(faturamentoPedido(p)) : null,
      frete: freteApurado(p) ? moeda(valor(p.frete)) : null, origem: p.origem, cliente: permissoes.contatos ? p.clienteNome : null, canal: p.canalNome ?? "Não identificado", modalidade: p.modalidade,
      ...(!receitaApurada(p) ? { ajusteNaoClassificado: moeda(valor(p.reducaoSemComponente!)) } : {}) }))),
    rentabilidade: { receitaCoberta: null, custoProdutos: null, margem: null, baseCustos: "Custo histórico de produção não comprovado; custo atual não aplicado a vendas antigas.", cobertura: permissoes.custos ? 0 : null, freteCoberto, custoEntrega, subsidio: custoEntrega !== null && freteCoberto !== null ? moeda(valor(custoEntrega).minus(freteCoberto)) : null },
    oportunidades: { semRecompra: todosClientes.filter(c => c.diasSemCompra >= f.diasSemRecompra).length, dias: f.diasSemRecompra, combinacoes: [...pares.values()].sort((a, b) => b.pedidos - a.pedidos).slice(0, 20).map(p => ({ ...p, participacao: linhas.length ? p.pedidos * 100 / linhas.length : 0 })), freteCoberto, custoEntrega, entregasComCusto: permissoes.custos ? comCusto.length : null },
    cobertura, opcoes: opcoesResultado, reconciliacao, definicoes: DEFINICOES_BI };
}

/** Projeção explícita: nenhum JSON de contato, cobrança ou nota integra o DTO. */
export function objetoBi(v: unknown): Objeto { return v && typeof v === "object" && !Array.isArray(v) ? v as Objeto : {}; }
