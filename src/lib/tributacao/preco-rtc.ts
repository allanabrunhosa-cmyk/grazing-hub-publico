import { Prisma } from "@/generated/prisma/client";

// A precisão desta matemática é isolada: nunca muda a configuração Decimal
// compartilhada pelo motor, pelo Prisma ou por outros cálculos do HUB.
const D = Prisma.Decimal.clone({ precision: 60, rounding: Prisma.Decimal.ROUND_HALF_UP });
type Decimal = Prisma.Decimal;
export type PoliticaBasePrecoRtc = "BRUTO_COMERCIAL" | "LIQUIDO_RTC";

export type TributoContidoNoPrecoRtc = {
  id: string;
  excluirDaBaseRtc: boolean;
} & ({
  modo: "VALOR_CONHECIDO";
  valor: string;
  fundamentoValor: string;
} | {
  modo: "ALIQUOTA";
  aliquotaEfetiva: string;
  politicaBase: PoliticaBasePrecoRtc;
  fundamentoBase: string;
});

export interface EntradaPrecoRtc {
  /** Total bruto apenas do produto. Não inclui componentes externos como frete. */
  valorComercial: string;
  quantidade: string;
  /** Percentuais efetivos já resolvidos pela configuração fiscal, até quatro casas. */
  aliquotasEfetivasRtc: { cbs: string; ibsUf: string; ibsMunicipio: string };
  /** Somente tributos comprovadamente contidos neste preço do produto. */
  tributosContidos: TributoContidoNoPrecoRtc[];
}

export interface ResultadoPrecoRtc {
  valorComercial: string;
  quantidade: string;
  vProd: string;
  vProdLiq: string;
  vUnComLiq: string;
  baseRtc: string;
  valorSemRtc: string;
  rtc: { cbs: { aliquotaEfetiva: string; valor: string }; ibsUf: { aliquotaEfetiva: string; valor: string }; ibsMunicipio: { aliquotaEfetiva: string; valor: string } };
  tributosContidos: { id: string; valor: string; base: string | null; politicaBase: PoliticaBasePrecoRtc | null; excluirDaBaseRtc: boolean }[];
  totalRtc: string;
  totalTributosContidos: string;
  diferencaMultiplicacaoUnitaria: string;
  arredondamento: { modo: "HALF_UP"; valores: 2; unitario: 10; aliquotasEfetivas: 4; fechamento: "BASE_E_TRIBUTOS_EM_CENTAVOS" };
}

export class ErroPrecoRtc extends Error {
  constructor(public readonly codigo: "CONFIGURACAO_INVALIDA" | "ARREDONDAMENTO_SEM_FECHAMENTO" | "UNITARIO_NAO_REPRESENTAVEL", mensagem: string) {
    super(mensagem);
    this.name = "ErroPrecoRtc";
  }
}

function invalida(mensagem: string): never { throw new ErroPrecoRtc("CONFIGURACAO_INVALIDA", mensagem); }
function decimal(v: string, casas: number, inteiros: number, nome: string): Decimal {
  if (typeof v !== "string" || !new RegExp(`^\\d{1,${inteiros}}(?:\\.\\d{1,${casas}})?$`).test(v)) invalida(`${nome}: valor fora da precisão configurada.`);
  return new D(v);
}
function valor(v: string, nome: string) { return decimal(v, 2, 13, nome); }
function taxa(v: string, nome: string) {
  const t = decimal(v, 4, 3, nome);
  if (t.gte(100)) invalida(`${nome}: percentual deve ser inferior a 100%.`);
  return t;
}
function fundamento(v: string, nome: string) {
  if (typeof v !== "string" || !v.trim() || v.length > 4000) invalida(`${nome}: fundamento explícito ausente ou fora do limite.`);
}
function soma(v: Decimal[]) { return v.reduce((a, b) => a.plus(b), new D(0)); }
function dinheiro(v: Decimal) { return v.toDecimalPlaces(2, D.ROUND_HALF_UP); }

/**
 * Decompõe um preço que já contém IBS/CBS; não determina incidência, alíquota,
 * regime, exclusão legal, evidência suficiente ou autorização para emissão.
 *
 * Seja P o preço, r a soma efetiva RTC, F as exclusões de valor conhecido,
 * g a soma das exclusões calculadas sobre P e n as exclusões sobre P−RTC:
 * B = [P(1−g−n)−F] / [1+r(1−n)]. Cada tributo é então HALF_UP em centavos.
 * Busca-se B em centavos que satisfaça B=P−RTC−exclusões exatamente; o limite
 * da busca decorre dos erros máximos de arredondamento de cada tributo. Entre
 * soluções escolhe a mais próxima da analítica, com empate para a maior base.
 * Não
 * se cria ajuste em alíquota, quantidade, preço ou tributo para obter fechamento.
 * Sem solução representável, somente o cálculo dependente deve ser bloqueado.
 *
 * vProdLiq retira TODOS os tributos contidos; pode diferir da base RTC quando
 * a regra exclui apenas um subconjunto. vUnComLiq tem dez casas e multiplicação
 * por qCom deve ficar dentro de ± R$0,01 do líquido, sem mudar qCom/vProdLiq.
 * NT2026.008 v1.00, I11b/I11c/I11c-20/W01a-20, fonte oficial:
 * https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=3&nomeArquivo=NT_2026.008_v1.00_RTC_ValorLiquidoProduto.pdf
 * Este helper isolado não prova suporte desses campos na API do emissor.
 */
type ResultadoMatematico = Omit<ResultadoPrecoRtc, "vUnComLiq" | "diferencaMultiplicacaoUnitaria">;
function resolverPrecoRtc(entrada: EntradaPrecoRtc): ResultadoMatematico {
  if (!entrada || typeof entrada !== "object" || !entrada.aliquotasEfetivasRtc || !Array.isArray(entrada.tributosContidos)) invalida("Configuração do preço e dos tributos ausente.");
  const preco = valor(entrada.valorComercial, "Preço comercial");
  const quantidade = decimal(entrada.quantidade, 6, 12, "Quantidade");
  if (quantidade.lte(0)) invalida("Quantidade deve ser positiva.");
  const taxasRtc = [taxa(entrada.aliquotasEfetivasRtc.cbs, "CBS"), taxa(entrada.aliquotasEfetivasRtc.ibsUf, "IBS UF"), taxa(entrada.aliquotasEfetivasRtc.ibsMunicipio, "IBS município")];
  const taxaRtc = soma(taxasRtc).div(100);
  if (taxaRtc.gte(1)) invalida("Soma das alíquotas efetivas RTC deve ser inferior a 100%.");
  if (entrada.tributosContidos.length > 16) invalida("A decomposição admite no máximo dezesseis tributos contidos.");
  const ids = new Set<string>();
  const tributos = entrada.tributosContidos.map(t => {
    if (!t || typeof t !== "object" || typeof t.id !== "string" || !/^[A-Z][A-Z0-9_]{0,31}$/.test(t.id) || ids.has(t.id) || ["CBS", "IBS", "IBS_UF", "IBS_MUNICIPIO"].includes(t.id) || typeof t.excluirDaBaseRtc !== "boolean") invalida("Tributo contido deve ter identificador único e exclusão explicitamente configurada; IBS/CBS têm campos próprios.");
    ids.add(t.id);
    if (t.modo === "VALOR_CONHECIDO") {
      fundamento(t.fundamentoValor, t.id);
      return { config: t, conhecido: valor(t.valor, t.id), taxa: new D(0) };
    }
    if (t.modo !== "ALIQUOTA" || !["BRUTO_COMERCIAL", "LIQUIDO_RTC"].includes(t.politicaBase)) invalida(`${t.id}: modo ou política de base explícita inválida.`);
    fundamento(t.fundamentoBase, t.id);
    return { config: t, conhecido: null, taxa: taxa(t.aliquotaEfetiva, t.id).div(100) };
  });
  if (soma(tributos.map(t => t.taxa)).gte(1)) invalida("Soma das alíquotas dos demais tributos contidos deve ser inferior a 100% neste solver.");
  const excluidos = tributos.filter(t => t.config.excluirDaBaseRtc);
  const fixo = soma(excluidos.map(t => t.conhecido ?? new D(0)));
  const bruto = soma(excluidos.filter(t => t.config.modo === "ALIQUOTA" && t.config.politicaBase === "BRUTO_COMERCIAL").map(t => t.taxa));
  const liquidoRtc = soma(excluidos.filter(t => t.config.modo === "ALIQUOTA" && t.config.politicaBase === "LIQUIDO_RTC").map(t => t.taxa));
  const denominador = new D(1).plus(taxaRtc.mul(new D(1).minus(liquidoRtc)));
  const numerador = preco.mul(new D(1).minus(bruto).minus(liquidoRtc)).minus(fixo);
  if (denominador.lte(0) || numerador.lt(0)) invalida("Tributos e exclusões não permitem uma base RTC não negativa.");
  const analitica = numerador.div(denominador);
  const semRtcAnalitico = preco.minus(analitica.mul(taxaRtc));
  const demaisAnaliticos = soma(tributos.map(t => t.conhecido ?? (t.config.modo === "ALIQUOTA" && t.config.politicaBase === "BRUTO_COMERCIAL" ? preco : semRtcAnalitico).mul(t.taxa)));
  if (semRtcAnalitico.minus(demaisAnaliticos).lt(0)) invalida("Tributos contidos excedem o preço; não permitem líquido do produto não negativo.");
  // Cada componente arredondado difere do exato no máximo R$0,005.
  const quantidadeRtcAtiva = taxasRtc.filter(t => !t.isZero()).length;
  const quantidadeExclusoesArredondadas = excluidos.filter(t => !t.conhecido && !t.taxa.isZero()).length;
  const erroMaximo = new D("0.005").mul(new D(quantidadeRtcAtiva).mul(new D(1).minus(liquidoRtc)).plus(quantidadeExclusoesArredondadas)).div(denominador);
  const inicio = D.max(0, analitica.minus(erroMaximo)).mul(100).ceil();
  const fim = D.min(preco, analitica.plus(erroMaximo)).mul(100).floor();
  const candidatos: { base: Decimal; rtc: Decimal[]; semRtc: Decimal; outros: { valor: Decimal; base: Decimal | null }[]; liquido: Decimal }[] = [];
  for (let centavos = inicio; centavos.lte(fim); centavos = centavos.plus(1)) {
    const base = centavos.div(100);
    const rtc = taxasRtc.map(t => dinheiro(base.mul(t).div(100)));
    const semRtc = preco.minus(soma(rtc));
    if (semRtc.lt(0)) continue;
    const outros = tributos.map(t => {
      const base = t.config.modo === "ALIQUOTA" ? t.config.politicaBase === "BRUTO_COMERCIAL" ? preco : semRtc : null;
      return { base, valor: t.conhecido ?? dinheiro(base!.mul(t.taxa)) };
    });
    const exclusoes = soma(outros.filter((_, i) => tributos[i].config.excluirDaBaseRtc).map(t => t.valor));
    const liquido = semRtc.minus(soma(outros.map(t => t.valor)));
    if (base.eq(semRtc.minus(exclusoes)) && liquido.gte(0)) candidatos.push({ base, rtc, semRtc, outros, liquido });
  }
  candidatos.sort((a, b) => a.base.minus(analitica).abs().comparedTo(b.base.minus(analitica).abs()) || b.base.comparedTo(a.base));
  const fechado = candidatos[0];
  if (!fechado) throw new ErroPrecoRtc("ARREDONDAMENTO_SEM_FECHAMENTO", "Preço, bases e tributos configurados não fecham simultaneamente em centavos; revisar a política explícita sem alterar o total comercial.");
  return {
    valorComercial: preco.toFixed(2), quantidade: quantidade.toFixed(6), vProd: preco.toFixed(2),
    vProdLiq: fechado.liquido.toFixed(2), baseRtc: fechado.base.toFixed(2), valorSemRtc: fechado.semRtc.toFixed(2),
    rtc: { cbs: { aliquotaEfetiva: taxasRtc[0].toFixed(4), valor: fechado.rtc[0].toFixed(2) }, ibsUf: { aliquotaEfetiva: taxasRtc[1].toFixed(4), valor: fechado.rtc[1].toFixed(2) }, ibsMunicipio: { aliquotaEfetiva: taxasRtc[2].toFixed(4), valor: fechado.rtc[2].toFixed(2) } },
    tributosContidos: tributos.map((t, i) => ({ id: t.config.id, valor: fechado.outros[i].valor.toFixed(2), base: fechado.outros[i].base?.toFixed(2) ?? null, politicaBase: t.config.modo === "ALIQUOTA" ? t.config.politicaBase : null, excluirDaBaseRtc: t.config.excluirDaBaseRtc })),
    totalRtc: soma(fechado.rtc).toFixed(2), totalTributosContidos: soma(fechado.rtc).plus(soma(fechado.outros.map(t => t.valor))).toFixed(2),
    arredondamento: { modo: "HALF_UP", valores: 2, unitario: 10, aliquotasEfetivas: 4, fechamento: "BASE_E_TRIBUTOS_EM_CENTAVOS" },
  };
}

function unitarioLiquido(liquido: string, quantidade: string) {
  const q = new D(quantidade), v = new D(liquido);
  const unitario = v.div(q).toDecimalPlaces(10, D.ROUND_HALF_UP);
  const diferenca = unitario.mul(q).minus(v);
  if (unitario.gte("100000000000") || diferenca.abs().gt("0.01")) throw new ErroPrecoRtc("UNITARIO_NAO_REPRESENTAVEL", "Valor unitário líquido não representável em onze inteiros e dez decimais dentro da tolerância de R$0,01, sem alterar quantidade ou total.");
  return { vUnComLiq: unitario.toFixed(10), diferencaMultiplicacaoUnitaria: diferenca.toFixed(10) };
}

export function decomporPrecoRtc(entrada: EntradaPrecoRtc): ResultadoPrecoRtc {
  const r = resolverPrecoRtc(entrada);
  return { ...r, ...unitarioLiquido(r.vProdLiq, r.quantidade) };
}

export type PoliticaRateioPrecoRtc = { modo: "SEM_ACRESCIMOS" } | { modo: "PROPORCIONAL_BRUTO"; versaoId: string; justificativa: string };
export interface EntradaOperacaoPrecoRtc extends Omit<EntradaPrecoRtc, "valorComercial"> {
  produtoBruto: string;
  componentesExternos: { id: string; valorBruto: string }[];
  politicaRateio: PoliticaRateioPrecoRtc;
}
export interface ResultadoOperacaoPrecoRtc {
  valorOperacao: string;
  baseRtc: string;
  totalRtc: string;
  totalTributosContidos: string;
  rtc: ResultadoPrecoRtc["rtc"];
  tributosContidos: ResultadoPrecoRtc["tributosContidos"];
  produto: { vProd: string; vProdLiq: string; vUnComLiq: string; quantidade: string; diferencaMultiplicacaoUnitaria: string };
  componentes: { id: string; valorBruto: string; valorSemRtc: string; valorLiquido: string; rtc: { cbs: string; ibsUf: string; ibsMunicipio: string }; tributosContidos: { id: string; valor: string }[] }[];
  rateio: PoliticaRateioPrecoRtc & { metodoCentavos: "MAIORES_RESTOS_ORDEM_DOS_COMPONENTES" };
  arredondamento: ResultadoPrecoRtc["arredondamento"];
}

function ratearCentavos(total: string, pesos: Decimal[]) {
  const centavos = new D(total).mul(100), pesoTotal = soma(pesos);
  if (pesoTotal.isZero()) return pesos.map(() => "0.00");
  const parcelas = pesos.map((peso, indice) => { const v = centavos.mul(peso).div(pesoTotal); return { indice, inteiro: v.floor(), resto: v.minus(v.floor()) }; });
  let restantes = centavos.minus(soma(parcelas.map(p => p.inteiro))).toNumber();
  for (const p of [...parcelas].sort((a, b) => b.resto.comparedTo(a.resto) || a.indice - b.indice)) if (restantes-- > 0) p.inteiro = p.inteiro.plus(1);
  return parcelas.map(p => p.inteiro.div(100).toFixed(2));
}

/** Composição explícita de preço final do produto e acessórios. O rateio
 * PROPORCIONAL_BRUTO é uma política matemática opt-in, nunca presunção legal:
 * exige versão/justificativa externas e resolve os tributos sobre toda a operação.
 * Seus valores são distribuídos proporcionalmente em centavos, mantendo cada
 * tributo e cada componente bruto. A base RTC é da operação; o líquido produto
 * retira somente os tributos alocados ao produto, sem incluir frete/despesas.
 */
export function decomporOperacaoPrecoRtc(entrada: EntradaOperacaoPrecoRtc): ResultadoOperacaoPrecoRtc {
  if (!entrada || !Array.isArray(entrada.componentesExternos) || entrada.componentesExternos.length > 16 || !entrada.politicaRateio || !["SEM_ACRESCIMOS", "PROPORCIONAL_BRUTO"].includes(entrada.politicaRateio.modo)) invalida("Composição externa e política de rateio devem ser explícitas.");
  const ids = new Set<string>();
  const componentes = [{ id: "PRODUTO", valorBruto: entrada.produtoBruto }, ...entrada.componentesExternos].map(c => {
    if (!c || typeof c.id !== "string" || !/^[A-Z][A-Z0-9_]{0,31}$/.test(c.id) || ids.has(c.id)) invalida("Componente externo deve ter identificador único; PRODUTO é reservado.");
    ids.add(c.id);
    return { id: c.id, bruto: valor(c.valorBruto, c.id) };
  });
  if (entrada.politicaRateio.modo === "SEM_ACRESCIMOS" && componentes.slice(1).some(c => c.bruto.gt(0))) invalida("Política SEM_ACRESCIMOS não admite frete ou despesas positivos.");
  if (entrada.politicaRateio.modo === "PROPORCIONAL_BRUTO") {
    if (typeof entrada.politicaRateio.versaoId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(entrada.politicaRateio.versaoId)) invalida("Rateio proporcional exige identificação da versão fundamentada.");
    fundamento(entrada.politicaRateio.justificativa, "Rateio proporcional");
  }
  const brutoTotal = soma(componentes.map(c => c.bruto));
  if (brutoTotal.gte("10000000000000")) invalida("Total da operação excede treze dígitos inteiros.");
  const r = resolverPrecoRtc({ ...entrada, valorComercial: brutoTotal.toFixed(2) });
  const pesos = componentes.map(c => c.bruto);
  const cbs = ratearCentavos(r.rtc.cbs.valor, pesos), ibsUf = ratearCentavos(r.rtc.ibsUf.valor, pesos), ibsMunicipio = ratearCentavos(r.rtc.ibsMunicipio.valor, pesos);
  const outros = r.tributosContidos.map(t => ({ id: t.id, valores: ratearCentavos(t.valor, pesos) }));
  const alocados = componentes.map((c, i) => {
    const rtc = { cbs: cbs[i], ibsUf: ibsUf[i], ibsMunicipio: ibsMunicipio[i] };
    const semRtc = c.bruto.minus(soma(Object.values(rtc).map(v => new D(v))));
    const tributosContidos = outros.map(t => ({ id: t.id, valor: t.valores[i] }));
    const liquido = semRtc.minus(soma(tributosContidos.map(t => new D(t.valor))));
    if (liquido.lt(0)) invalida("Rateio configurado produz líquido negativo em um componente; revisar a política sem alterar valores brutos.");
    return { id: c.id, valorBruto: c.bruto.toFixed(2), valorSemRtc: semRtc.toFixed(2), valorLiquido: liquido.toFixed(2), rtc, tributosContidos };
  });
  return {
    valorOperacao: brutoTotal.toFixed(2), baseRtc: r.baseRtc, totalRtc: r.totalRtc, totalTributosContidos: r.totalTributosContidos, rtc: r.rtc, tributosContidos: r.tributosContidos,
    produto: { vProd: alocados[0].valorBruto, vProdLiq: alocados[0].valorLiquido, quantidade: r.quantidade, ...unitarioLiquido(alocados[0].valorLiquido, r.quantidade) },
    componentes: alocados, rateio: { ...entrada.politicaRateio, metodoCentavos: "MAIORES_RESTOS_ORDEM_DOS_COMPONENTES" }, arredondamento: r.arredondamento,
  };
}
