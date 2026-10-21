import "server-only";
import { descricaoProdutoNfe, PADRAO_DESCRICAO_PRODUTO_NFE } from "./texto-xml";
import { Prisma } from "@/generated/prisma/client";
import { validarSnapshotBrasilNfe } from "../brasil-nfe";
import { gtinFiscalBrasilNfeValido } from "./gtin";
import { normalizarCnpjBrasilNfe, prepararMapeamentoBrasilNfe, type ModeloDocumentoBrasilNfe } from "./mapeamento";
import type {
  CadastroEmitenteLocalBrasilNfe, DocumentoPreparacaoLocalBrasilNfe, EnderecoPayloadBrasilNfe,
  ImpostosPayloadLocalBrasilNfe, ParametrosPayloadLocalBrasilNfe, PayloadNotaLocalBrasilNfe,
  PendenciaPayloadLocalBrasilNfe, RegraItemFiscalLocal, ResultadoPayloadLocalBrasilNfe,
} from "./payload-local-tipos";

type Objeto = Record<string, unknown>;
const obj = (v: unknown): Objeto => v && typeof v === "object" && !Array.isArray(v) ? v as Objeto : {};
// Precisão própria, suficiente para produtos/rateios nos limites declarados, sem alterar o Prisma global.
const DecimalExato = Prisma.Decimal.clone({ precision: 60, rounding: Prisma.Decimal.ROUND_HALF_UP });
const dec = (s: string) => new DecimalExato(s);
const zero = () => dec("0");
const ufs = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const cfops65 = new Set([5101, 5102, 5103, 5104, 5115, 5405, 5656, 5667, 5933, 6108, 6109, 6110]);
const resultadosLocais = new WeakSet<ResultadoPayloadLocalBrasilNfe>();
function congelar(v: unknown): void {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return;
  Object.values(v).forEach(congelar);
  Object.freeze(v);
}
export class ErroPayloadLocalBrasilNfe extends Error {
  constructor() { super("Contexto de preparação fiscal local inválido. Nenhuma transmissão foi autorizada."); this.name = "ErroPayloadLocalBrasilNfe"; }
}
/** Rateia só parcelas ainda globais do snapshot. Desconto já rateado nunca passa aqui. */
function ratear(valor: Prisma.Decimal, pesos: Prisma.Decimal[]): string[] {
  const soma = pesos.reduce((s, p) => s.plus(p), zero());
  if (!pesos.length || pesos.length > 990 || soma.lte(0)) throw new ErroPayloadLocalBrasilNfe();
  const parcelas = pesos.map(p => soma.isZero() ? zero() : valor.mul(p).div(soma).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN));
  let residuo = valor.minus(parcelas.reduce((s, p) => s.plus(p), zero())).mul(100).toNumber();
  for (let i = 0; residuo > 0; i = (i + 1) % parcelas.length) { parcelas[i] = parcelas[i].plus("0.01"); residuo--; }
  return parcelas.map(p => p.toFixed(2));
}

/** Constrói venda normal 55/65 apenas em memória. Completo localmente não significa homologado. */
export function prepararPayloadLocalBrasilNfe(documento: DocumentoPreparacaoLocalBrasilNfe, modelo: ModeloDocumentoBrasilNfe,
  cadastro: CadastroEmitenteLocalBrasilNfe, parametros: unknown, ambiente: "HOMOLOGACAO" | "PRODUCAO" = "HOMOLOGACAO"): ResultadoPayloadLocalBrasilNfe {
  if (!["HOMOLOGACAO", "PRODUCAO"].includes(ambiente) || ![55, 65].includes(modelo) || !/^[a-zA-Z0-9_-]{1,100}$/.test(documento.id)
    || !/^[a-f0-9]{64}$/.test(documento.hashPayload) || !Number.isSafeInteger(documento.versaoPedido) || documento.versaoPedido < 1) throw new ErroPayloadLocalBrasilNfe();
  const pendencias: PendenciaPayloadLocalBrasilNfe[] = [];
  const operacao = modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA";
  let referenciaItem: { itemId?: string; produtoId?: string } = {};
  const falha = (campo: string, codigo: PendenciaPayloadLocalBrasilNfe["codigo"], motivo: string, responsavel: "HUB" | "REVISAO_FISCAL" = "REVISAO_FISCAL") => {
    pendencias.push({ campo, codigo, motivo, responsavel, operacao, ...referenciaItem });
  };
  const texto = (v: unknown, campo: string, max: number, formato?: RegExp): string => {
    if (v == null || v === "") { falha(campo, "AUSENTE", "Preencher o campo na fonte indicada."); return ""; }
    if (typeof v !== "string" || !v.trim() || v.length > max || /[\p{C}<>]/u.test(v) || (formato && !formato.test(v))) {
      falha(campo, "FORMATO", "Revisar formato, caracteres e tamanho do campo."); return "";
    }
    return v.trim();
  };
  const numero = (v: unknown, campo: string, casas: number, positivo = false, inteiros = 12): string => {
    if (typeof v !== "string" || !new RegExp(`^(0|[1-9][0-9]{0,${inteiros - 1}})(\\.[0-9]{1,${casas}})?$`).test(v) || (positivo && !/[1-9]/.test(v))) {
      falha(campo, v == null ? "AUSENTE" : "FORMATO", "Informar decimal exato, não negativo, na precisão do campo.", "HUB"); return "0";
    }
    return v;
  };
  const inteiro = (v: unknown, campo: string, valores: readonly number[]): number => {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || !valores.includes(v)) { falha(campo, v == null ? "AUSENTE" : "FORMATO", "Selecionar um código explicitamente configurado."); return -1; }
    return v;
  };
  const booleano = (v: unknown, campo: string): boolean => {
    if (typeof v !== "boolean") falha(campo, v == null ? "AUSENTE" : "FORMATO", "Confirmar explicitamente a aplicabilidade/regra fiscal.");
    return v === true;
  };
  const endereco = (v: unknown, campo: string): EnderecoPayloadBrasilNfe => {
    const e = obj(v), uf = texto(e.uf, `${campo}.Uf`, 2, /^[A-Z]{2}$/);
    if (uf && !ufs.has(uf)) falha(`${campo}.Uf`, "FORMATO", "Selecionar UF válida.");
    const codigo = texto(e.codMunicipio, `${campo}.CodMunicipio`, 7, /^\d{7}$/);
    const codPais = inteiro(e.codPais, `${campo}.CodPais`, [1058]);
    if (e.pais != null && !["BRASIL", "Brasil", "BR"].includes(String(e.pais))) falha(`${campo}.Pais`, "NAO_SUPORTADO", "Este recorte atende somente venda nacional.");
    const pais = texto(e.pais, `${campo}.Pais`, 60);
    const r: EnderecoPayloadBrasilNfe = { Cep: texto(e.cep, `${campo}.Cep`, 8, /^\d{8}$/), Logradouro: texto(e.logradouro, `${campo}.Logradouro`, 60), Numero: texto(e.numero, `${campo}.Numero`, 60), Bairro: texto(e.bairro, `${campo}.Bairro`, 60), Municipio: texto(e.cidade, `${campo}.Municipio`, 60), Uf: uf, CodMunicipio: codigo, CodPais: codPais, Pais: pais };
    if (e.complemento) r.Complemento = texto(e.complemento, `${campo}.Complemento`, 60);
    return r;
  };
  const p = obj(documento.payload), c = obj(parametros), vinculo = obj(c.vinculo), fiscalEmitente = obj(c.emitente);
  if (p.schema !== "grazing.fiscal-saida" || p.versao !== 1 || obj(p.pedido).revisao !== documento.versaoPedido) falha("snapshot", "DIVERGENTE", "Fotografia ou revisão comercial não corresponde ao documento.", "HUB");
  if (vinculo.documentoId !== documento.id || vinculo.hashPayload !== documento.hashPayload || vinculo.revisaoPedido !== documento.versaoPedido) falha("parametros.vinculo", "DIVERGENTE", "Reaprovar os parâmetros fiscais para esta identidade, hash e revisão.", "HUB");
  // O plano novo referencia a versão aprovada internamente; legado permanece legível.
  const conferirReferencia = (valor: Objeto, prefixo: string) => valor.referenciaFundamentacao !== undefined
    ? texto(valor.referenciaFundamentacao, `${prefixo}.referenciaFundamentacao`, 100, /^[A-Za-z0-9_-]{1,100}$/)
    : valor.referenciaConfirp !== undefined
      ? texto(valor.referenciaConfirp, `${prefixo}.referenciaConfirp`, 100)
      : texto(undefined, `${prefixo}.referenciaFundamentacao`, 100);
  conferirReferencia(c, "parametros");
  try { if (normalizarCnpjBrasilNfe(obj(p.emitente).cnpj) !== normalizarCnpjBrasilNfe(cadastro.cnpj)) falha("emitente.Cnpj", "DIVERGENTE", "Emitente do cadastro diverge da fotografia; não trocar o esperado para aceitar.", "HUB"); }
  catch { falha("emitente.Cnpj", "FORMATO", "Completar CNPJ do emitente no cadastro da empresa.", "HUB"); }
  texto(cadastro.nome, "emitente.Nome", 60);
  texto(fiscalEmitente.ie, "emitente.Ie", 14, /^\d{2,14}$/);
  const crt = inteiro(fiscalEmitente.crt, "emitente.CRT", [1, 2, 3, 4]);
  endereco({ ...obj(cadastro.enderecoEstruturado), codMunicipio: fiscalEmitente.codMunicipio, codPais: fiscalEmitente.codPais, pais: fiscalEmitente.pais }, "emitente.Endereco");
  const op = obj(c.operacao);
  const natureza = texto(op.NaturezaOperacao, "operacao.NaturezaOperacao", 60);
  const finalidade = inteiro(op.Finalidade, "operacao.Finalidade", [1]);
  const presenca = inteiro(op.IndicadorPresenca, "operacao.IndicadorPresenca", [0, 1, 2, 3, 4, 5, 9]);
  const consumidor = booleano(op.ConsumidorFinal, "operacao.ConsumidorFinal"), ibpt = booleano(op.CalcularIBPT, "operacao.CalcularIBPT");
  const freteModalidade = inteiro(op.ModalidadeFrete, "operacao.ModalidadeFrete", [0, 1, 2, 3, 4, 9]);
  if (booleano(op.intermediadorAplicavel, "operacao.intermediadorAplicavel")) falha("operacao.Intermediador", "NAO_SUPORTADO", "Definir contrato do intermediador antes de montar esta operação.");
  if (modelo === 65 && !consumidor) falha("operacao.ConsumidorFinal", "DIVERGENTE", "NFC-e exige consumidor final neste recorte.");
  const valores = obj(p.valores);
  const comercial = Object.fromEntries(["subtotal", "desconto", "frete", "outrosCustos", "total"].map(k => [k, numero(valores[k], `valores.${k}`, 2, k === "total")])) as Record<string, string>;
  const entradas = Array.isArray(p.itens) ? p.itens : [];
  if (entradas.length < 1 || entradas.length > 990) falha("Produtos", "FORMATO", "Fotografia deve conter de 1 a 990 itens.", "HUB");
  const regras = Array.isArray(c.itens) ? c.itens.slice(0, 990) : [];
  if (Array.isArray(c.itens) && c.itens.length > 990) falha("parametros.itens", "FORMATO", "Limitar a 990 regras fiscais.");
  if (regras.length !== entradas.length) falha("parametros.itens", "DIVERGENTE", "Configurar uma regra fiscal por item da fotografia.");
  const vistos = new Set<string>();
  const brutos: Prisma.Decimal[] = [], descontos: Prisma.Decimal[] = [];
  const Produtos = entradas.slice(0, 990).map((entrada, indice) => {
    const i = obj(entrada), produto = obj(i.produto), ficha = obj(i.fiscal), fiscal = obj(ficha.produto);
    const referenciaValida = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v) ? v : undefined;
    referenciaItem = { itemId: referenciaValida(i.id), produtoId: referenciaValida(i.produtoId) };
    const prefixo = `Produtos[${indice}]`, itemId = texto(i.id, `${prefixo}.itemId`, 100, /^[a-zA-Z0-9_-]+$/);
    if (vistos.has(itemId)) falha(`${prefixo}.itemId`, "DIVERGENTE", "Item repetido na fotografia.", "HUB"); vistos.add(itemId);
    const encontradas = regras.filter(r => obj(r).itemId === i.id), regra = obj(encontradas[0]);
    if (encontradas.length !== 1 || regra.produtoId !== i.produtoId || regra.versaoCadastro !== ficha.versaoCadastro || !Number.isSafeInteger(ficha.versaoCadastro)) falha(`${prefixo}.regraFiscal`, "DIVERGENTE", "Regra ausente, repetida ou vinculada a outra revisão do produto.");
    conferirReferencia(regra, prefixo);
    const q = numero(i.quantidade, `${prefixo}.Quantidade`, 4, true, 11), preco = numero(i.preco, `${prefixo}.preco`, 2), acrescimos = numero(i.acrescimos, `${prefixo}.acrescimos`, 2);
    const desconto = dec(numero(i.desconto, `${prefixo}.ValorDesconto`, 2)), liquido = dec(numero(i.total, `${prefixo}.totalLinha`, 2));
    const unitario = dec(preco).plus(acrescimos), bruto = liquido.plus(desconto);
    numero(unitario.toFixed(2), `${prefixo}.ValorUnitario`, 2, false, 11);
    numero(bruto.toFixed(2), `${prefixo}.ValorTotal`, 2);
    if (!unitario.mul(q).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).eq(bruto) || desconto.gt(bruto)) falha(`${prefixo}.ValorTotal`, "DIVERGENTE", "Preço, complementos, quantidade, desconto e total da linha não fecham com o snapshot.", "HUB");
    brutos.push(bruto); descontos.push(desconto);
    const fator = numero(regra.fatorTributavel, `${prefixo}.fatorTributavel`, 6, true, 10);
    const qt = dec(q).mul(fator), vt = dec(fator).isZero() ? zero() : unitario.div(fator).toDecimalPlaces(10, Prisma.Decimal.ROUND_HALF_UP);
    numero(qt.toFixed(4), `${prefixo}.QuantidadeTributavel`, 4, true, 11);
    numero(vt.toFixed(10), `${prefixo}.ValorUnitarioTributavel`, 10, false, 11);
    if (qt.decimalPlaces() > 4 || !qt.mul(vt).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).eq(bruto)) falha(`${prefixo}.QuantidadeTributavel`, "DIVERGENTE", "Conversão tributável não preserva quantidade/valor na precisão fiscal; revisar unidade e fator.");
    const ncm = texto(fiscal.ncm, `${prefixo}.NCM`, 8, /^\d{8}$/), ean = texto(fiscal.ean, `${prefixo}.EAN`, 14, /^(\d{8}|\d{12,14}|SEM GTIN)$/);
    if (ean && !gtinFiscalBrasilNfeValido(ean)) falha(`${prefixo}.EAN`, "FORMATO", "Conferir GTIN e dígito verificador da unidade final; código preenchido só com zeros não identifica o produto.");
    const cfopTexto = texto(fiscal.cfop, `${prefixo}.CFOP`, 4, /^[5-7]\d{3}$/), cfop = cfopTexto ? Number(cfopTexto) : -1;
    if (cfop >= 7000) falha(`${prefixo}.CFOP`, "NAO_SUPORTADO", "Exportação exige construtor e dados próprios; este recorte atende venda nacional.");
    if (modelo === 65 && !cfops65.has(cfop)) falha(`${prefixo}.CFOP`, "DIVERGENTE", "CFOP não consta do contrato NFC-e; decidir operação/modelo mediante revisão fiscal fundamentada.");
    const origem = texto(fiscal.origem, `${prefixo}.OrigemProduto`, 1, /^[0-8]$/);
    if (["3", "5", "8"].includes(origem)) falha(`${prefixo}.nFCI`, "NAO_SUPORTADO", "Conteúdo de importação e FCI exigem decisão e apuração no motor fiscal versionado v2. Não adaptar nem reenviar o piloto legado.");
    const icmsCodigo = texto([1, 4].includes(crt) ? fiscal.csosn : fiscal.cstIcms, `${prefixo}.ICMS.CodSituacaoTributaria`, [1, 4].includes(crt) ? 3 : 2, [1, 4].includes(crt) ? /^\d{3}$/ : /^\d{2}$/);
    if (fiscal.csosn && fiscal.cstIcms) falha(`${prefixo}.ICMS`, "DIVERGENTE", "CSOSN e CST simultâneos; corrigir a ficha preservada.");
    const pis = texto(fiscal.pis, `${prefixo}.PIS.CodSituacaoTributaria`, 2, /^\d{2}$/), cofins = texto(fiscal.cofins, `${prefixo}.COFINS.CodSituacaoTributaria`, 2, /^\d{2}$/);
    const imposto: ImpostosPayloadLocalBrasilNfe = { ICMS: { CodSituacaoTributaria: icmsCodigo }, PIS: { CodSituacaoTributaria: pis }, COFINS: { CodSituacaoTributaria: cofins } };
    const icms = obj(regra.icms);
    if (icms.tratamento === "SEM_DESTAQUE") {
      if (!([1, 4].includes(crt) ? ["102", "103", "300", "400"] : ["40", "41"]).includes(icmsCodigo)) falha(`${prefixo}.ICMS.tratamento`, "NAO_SUPORTADO", "CST/CSOSN requer parâmetros tributários além do recorte sem destaque.");
    } else if (icms.tratamento === "TRIBUTADO") {
      if ([1, 4].includes(crt) || icmsCodigo !== "00") falha(`${prefixo}.ICMS.tratamento`, "NAO_SUPORTADO", "Tributação ICMS básica suporta CST00; outros enquadramentos exigem extensão fiscal explícita.");
      const base = numero(icms.BaseCalculo, `${prefixo}.ICMS.BaseCalculo`, 2), aliquota = numero(icms.AliquotaICMS, `${prefixo}.ICMS.AliquotaICMS`, 4, false, 3);
      if (dec(aliquota).gt(100)) falha(`${prefixo}.ICMS.AliquotaICMS`, "FORMATO", "Percentual deve estar entre zero e cem.");
      Object.assign(imposto.ICMS, { BaseCalculo: base, AliquotaICMS: aliquota, ValorIcms: dec(base).mul(aliquota).div(100).toFixed(2), modalidadeBcIcms: inteiro(icms.modalidadeBcIcms, `${prefixo}.ICMS.modalidadeBcIcms`, [0, 1, 2, 3]) });
    } else falha(`${prefixo}.ICMS.tratamento`, "AUSENTE", "Definir tratamento ICMS mediante revisão fiscal fundamentada.");
    for (const [chave, codigo] of [["PIS", pis], ["COFINS", cofins]] as const) {
      const tributo = obj(regra[chave.toLowerCase()]);
      if (tributo.tratamento === "SEM_DESTAQUE") {
        if (!["04", "05", "06", "07", "08", "09"].includes(codigo)) falha(`${prefixo}.${chave}.tratamento`, "DIVERGENTE", "Situação tributária não corresponde ao recorte sem destaque.");
      } else if (tributo.tratamento === "RECOLHIDO_DAS") {
        if (![1, 2, 4].includes(crt)) falha(`${prefixo}.${chave}.tratamento`, "DIVERGENTE", "Recolhimento pelo DAS exige CRT1/2/4 explicitamente confirmado; não aplicar ao regime normal.");
        if (!["49", "99"].includes(codigo)) falha(`${prefixo}.${chave}.CodSituacaoTributaria`, "DIVERGENTE", "Representação de recolhimento pelo DAS suporta somente CST49/99 escolhidos mediante revisão fiscal fundamentada.");
        if (Object.keys(tributo).some(campo => campo !== "tratamento")) falha(`${prefixo}.${chave}.tratamento`, "DIVERGENTE", "Recolhimento pelo DAS não recebe bases, alíquotas ou outros parâmetros monetários no perfil.");
        // Contrato do fornecedor: valores informativos zerados no XML, sem calcular tributo,
        // presumir isenção ou substituir a decisão fiscal sobre CST e recolhimento efetivo.
        Object.assign(imposto[chave], { BaseCalculo: "0.00", Aliquota: "0.0000" });
      } else if (tributo.tratamento === "TRIBUTADO") {
        if (!["01", "02"].includes(codigo)) falha(`${prefixo}.${chave}.tratamento`, "NAO_SUPORTADO", "Este recorte tributa PIS/COFINS somente por alíquota percentual nas situações01/02.");
        const base = numero(tributo.BaseCalculo, `${prefixo}.${chave}.BaseCalculo`, 2), aliquota = numero(tributo.Aliquota, `${prefixo}.${chave}.Aliquota`, 4, false, 3);
        if (dec(aliquota).gt(100)) falha(`${prefixo}.${chave}.Aliquota`, "FORMATO", "Percentual deve estar entre zero e cem.");
        Object.assign(imposto[chave], { BaseCalculo: base, Aliquota: aliquota });
      } else falha(`${prefixo}.${chave}.tratamento`, "AUSENTE", "Definir tratamento do tributo mediante revisão fiscal fundamentada.");
    }
    const ipiAplicavel = regra.ipiAplicavel === null && regra.representacaoIpi === "OMITIR_SIMPLES" ? null : booleano(regra.ipiAplicavel, `${prefixo}.ipiAplicavel`);
    if (regra.representacaoIpi !== undefined && regra.representacaoIpi !== "OMITIR_SIMPLES") falha(`${prefixo}.representacaoIpi`, "FORMATO", "Representação IPI desconhecida; revisar a decisão.");
    if (regra.representacaoIpi === "OMITIR_SIMPLES" && ![1, 2, 4].includes(crt)) falha(`${prefixo}.representacaoIpi`, "DIVERGENTE", "Omissão explicitamente aprovada para o Simples não se aplica ao regime normal.");
    if (ipiAplicavel && regra.representacaoIpi !== "OMITIR_SIMPLES") falha(`${prefixo}.ipiAplicavel`, "NAO_SUPORTADO", "IPI aplicável exige representação fiscal explicitamente aprovada; não presumir CST, enquadramento ou alíquota.");
    for (const campo of ["stAplicavel", "fcpAplicavel", "difalAplicavel", "ibsCbsAplicavel", "beneficioFiscalAplicavel"]) {
      if (booleano(regra[campo], `${prefixo}.${campo}`)) falha(`${prefixo}.${campo}`, "NAO_SUPORTADO", "Tributação aplicável exige construtor específico e reconciliação antes de concluir este recorte.");
    }
    if (fiscal.ipi || fiscal.fcp && dec(numero(fiscal.fcp, `${prefixo}.fcp`, 4, false, 3)).gt(0)) falha(`${prefixo}.Imposto`, "DIVERGENTE", "Ficha contém IPI/FCP; não descartar tributação preenchida.");
    const cestAplicavel = booleano(regra.cestAplicavel, `${prefixo}.cestAplicavel`);
    let cest: string | undefined;
    if (cestAplicavel) cest = texto(fiscal.cest, `${prefixo}.CEST`, 7, /^\d{7}$/);
    else if (fiscal.cest) falha(`${prefixo}.CEST`, "DIVERGENTE", "CEST preenchido contradiz a não aplicabilidade informada; revisar a decisão.");
    return { CodProdutoServico: texto(i.produtoId, `${prefixo}.CodProdutoServico`, 60, /^[a-zA-Z0-9_-]+$/), NmProduto: texto(typeof produto.nome === "string" ? descricaoProdutoNfe(produto.nome) : produto.nome, `${prefixo}.NmProduto`, 120, PADRAO_DESCRICAO_PRODUTO_NFE), UnidadeComercial: texto(i.unidade, `${prefixo}.UnidadeComercial`, 6, /^[A-Za-z0-9]{1,6}$/), Quantidade: q, ValorUnitario: unitario.toFixed(2), ValorTotal: bruto.toFixed(2), ValorDesconto: desconto.toFixed(2), ValorFrete: "0.00", ValorOutrasDespesas: "0.00", NCM: ncm, ...(cest ? { CEST: cest } : {}), EAN: ean, CFOP: cfop, OrigemProduto: origem ? Number(origem) : -1, UnidadeComercialTributavel: texto(fiscal.unidadeTributavel, `${prefixo}.UnidadeComercialTributavel`, 6, /^[A-Za-z0-9]{1,6}$/), QuantidadeTributavel: qt.toFixed(4), ValorUnitarioTributavel: vt.toFixed(10), Imposto: imposto };
  });
  referenciaItem = {};
  // RV I04-10 do MOC/NT2015.002: transformação somente fiscal do ambiente2.
  // Descrição comercial, classificação, valores e hash do pedido permanecem intactos.
  if (ambiente === "HOMOLOGACAO" && modelo === 65 && Produtos.length) Produtos[0].NmProduto = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";
  const somaBruta = brutos.reduce((s, v) => s.plus(v), zero()), somaDesconto = descontos.reduce((s, v) => s.plus(v), zero());
  if (!somaBruta.eq(comercial.subtotal)) falha("valores.subtotal", "DIVERGENTE", "Soma bruta dos itens diverge do subtotal preservado.", "HUB");
  if (!somaDesconto.eq(comercial.desconto)) falha("valores.desconto", "DIVERGENTE", "Desconto global já rateado não coincide com os descontos dos itens.", "HUB");
  if (!somaBruta.minus(somaDesconto).plus(comercial.frete).plus(comercial.outrosCustos).eq(comercial.total)) falha("valores.total", "DIVERGENTE", "Itens, descontos, frete e outros custos não fecham com o total preservado.", "HUB");
  if (Produtos.length && somaBruta.gt(0)) {
    const fretes = ratear(dec(comercial.frete), brutos), outros = ratear(dec(comercial.outrosCustos), brutos);
    Produtos.forEach((produto, i) => { produto.ValorFrete = fretes[i]; produto.ValorOutrasDespesas = outros[i]; });
  }
  let Cliente: PayloadNotaLocalBrasilNfe["Cliente"];
  const destinatario = obj(c.destinatario);
  const identificar = booleano(destinatario.identificar, "Cliente.identificar");
  if (!identificar && (modelo === 55 || presenca === 4)) falha("Cliente", "AUSENTE", "Identificar destinatário de NF-e ou NFC-e com entrega a domicílio.");
  if (identificar) {
    if (!["comprador", "cobranca", "destinatario"].includes(String(destinatario.origem))) falha("Cliente.origem", "FORMATO", "Selecionar explicitamente a fonte do destinatário fiscal.");
    const origem = obj(p[String(destinatario.origem)]), documentoCliente = texto(origem.documento, "Cliente.CpfCnpj", 14, /^(\d{11}|\d{14})$/);
    const ie = inteiro(destinatario.IndicadorIe, "Cliente.IndicadorIe", [1, 2, 9]);
    if (modelo === 65 && ie !== 9) falha("Cliente.IndicadorIe", "DIVERGENTE", "Este recorte NFC-e atende consumidor final não contribuinte.");
    Cliente = { CpfCnpj: documentoCliente, NmCliente: texto(origem.razaoSocial || origem.nome, "Cliente.NmCliente", 60), IndicadorIe: ie, Endereco: endereco(destinatario.endereco, "Cliente.Endereco") };
    if (ie === 1) Cliente.Ie = texto(origem.inscricaoEstadual, "Cliente.Ie", 14, /^\d{2,14}$/);
  }
  const pg = obj(c.pagamentos), mapas = Array.isArray(pg.mapeamentos) ? pg.mapeamentos.slice(0, 100) : [];
  if (mapas.length < 1 || Array.isArray(pg.mapeamentos) && pg.mapeamentos.length > 100) falha("Pagamentos.mapeamentos", "FORMATO", "Configurar códigos fiscais para as formas preservadas, até cem mapeamentos.");
  if (dec(numero(pg.troco, "Pagamentos.VlTroco", 2)).gt(0)) falha("Pagamentos.VlTroco", "NAO_SUPORTADO", "Snapshot não comprova valor entregue/troco; não acrescentar pagamento fictício.", "HUB");
  const parcelas = Array.isArray(p.parcelas) ? p.parcelas : [];
  const fontes = pg.fonte === "TOTAL" ? [{ formaPagamentoId: obj(p.pagamento).formaId, valor: comercial.total }]
    : pg.fonte === "PARCELAS" ? parcelas : [];
  if (fontes.length < 1 || fontes.length > 120) falha("Pagamentos.fonte", "AUSENTE", "Selecionar total com forma fotografada ou parcelas preservadas.", "HUB");
  const Pagamentos = fontes.slice(0, 120).map((fonte, indice) => {
    const f = obj(fonte), encontrados = mapas.filter(m => obj(m).formaId === f.formaPagamentoId), m = obj(encontrados[0]);
    if (!f.formaPagamentoId || encontrados.length !== 1) falha(`Pagamentos[${indice}].FormaPagamento`, "AUSENTE", "Configurar uma correspondência fiscal para a forma desta parcela/pedido.");
    const codigo = texto(m.FormaPagamento, `Pagamentos[${indice}].FormaPagamento`, 2, /^\d{2}$/);
    const r: PayloadNotaLocalBrasilNfe["Pagamentos"][number] = { FormaPagamento: codigo, IndicadorPagamento: inteiro(m.IndicadorPagamento, `Pagamentos[${indice}].IndicadorPagamento`, [0, 1]), VlPago: dec(numero(f.valor, `Pagamentos[${indice}].VlPago`, 2, true)).toFixed(2), VlTroco: "0.00" };
    if (m.Descricao || codigo === "99") r.Descricao = texto(m.Descricao, `Pagamentos[${indice}].Descricao`, 60);
    if (["03", "04"].includes(codigo)) {
      const cartao = obj(m.cartao);
      Object.assign(r, { TipoIntegracao: booleano(cartao.TipoIntegracao, `Pagamentos[${indice}].TipoIntegracao`), CNPJCredenciadora: texto(cartao.CNPJCredenciadora, `Pagamentos[${indice}].CNPJCredenciadora`, 14, /^\d{14}$/), BandeiraOperadora: texto(cartao.BandeiraOperadora, `Pagamentos[${indice}].BandeiraOperadora`, 2, /^\d{2}$/), NumeroAutorizacao: texto(cartao.NumeroAutorizacao, `Pagamentos[${indice}].NumeroAutorizacao`, 128, /^[A-Za-z0-9_-]+$/) });
    }
    return r;
  });
  if (!Pagamentos.reduce((s, v) => s.plus(v.VlPago), zero()).eq(comercial.total)) falha("Pagamentos.VlPago", "DIVERGENTE", "Pagamentos devem fechar com o total sem descontar taxas financeiras nem reaplicar descontos.", "HUB");
  const incluirCobranca = booleano(pg.incluirCobranca, "Cobranca.incluir");
  let Cobranca: PayloadNotaLocalBrasilNfe["Cobranca"];
  if (incluirCobranca) {
    if (modelo === 65) falha("Cobranca", "NAO_SUPORTADO", "Cobrança/fatura não integra este recorte NFC-e.");
    const Parcelas = parcelas.slice(0, 120).map((parcela, indice) => {
      const v = obj(parcela), vencimento = texto(v.dataVencimento, `Cobranca.Parcelas[${indice}].Vencimento`, 35, /^\d{4}-\d{2}-\d{2}T/);
      const dataCivil = vencimento.slice(0, 10), timestampCivil = Date.parse(`${dataCivil}T00:00:00Z`);
      if (!Number.isFinite(Date.parse(vencimento)) || !Number.isFinite(timestampCivil) || new Date(timestampCivil).toISOString().slice(0, 10) !== dataCivil) falha(`Cobranca.Parcelas[${indice}].Vencimento`, "FORMATO", "Conservar uma data de vencimento válida na fotografia.", "HUB");
      return { Vencimento: vencimento, Valor: dec(numero(v.valor, `Cobranca.Parcelas[${indice}].Valor`, 2, true)).toFixed(2) };
    });
    if (!Parcelas.length || parcelas.length > 120 || !Parcelas.reduce((s, v) => s.plus(v.Valor), zero()).eq(comercial.total)) falha("Cobranca.Parcelas", "DIVERGENTE", "Parcelas preservadas devem fechar com a fatura, sem nova distribuição.", "HUB");
    Cobranca = { Fatura: { Numero: documento.id, Valor: dec(comercial.total).toFixed(2), Desconto: "0.00", ValorLiquido: dec(comercial.total).toFixed(2) }, Parcelas };
  }
  // Confere também a base legada sem mudar seu contrato parcial ou suas fotografias.
  if (!pendencias.length) prepararMapeamentoBrasilNfe(documento.payload, { documentoId: documento.id, emitenteCnpj: cadastro.cnpj!, ambiente, modelo, crt: crt as 1 | 2 | 3 | 4 });
  const payload: PayloadNotaLocalBrasilNfe = { IdentificadorInterno: documento.id, ModeloDocumento: modelo, TipoAmbiente: ambiente === "PRODUCAO" ? 1 : 2, EnviarEmail: false, NaturezaOperacao: natureza, Finalidade: finalidade as 1, IndicadorPresenca: presenca, ConsumidorFinal: consumidor, CalcularIBPT: ibpt, ...([1, 2, 4].includes(crt) ? { Observacao: "DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE IPI." } : {}), ...(Cliente ? { Cliente } : {}), Produtos, Pagamentos, ...(Cobranca ? { Cobranca } : {}), Transporte: { ModalidadeFrete: freteModalidade }, ValorTotal: dec(comercial.total).toFixed(2) };
  const resultado: ResultadoPayloadLocalBrasilNfe = { documentoId: documento.id, hashPayload: documento.hashPayload, modelo, montagemConcluida: pendencias.length === 0, transmissaoPermitida: false, payload: pendencias.length ? null : payload, pendencias };
  congelar(resultado);
  resultadosLocais.add(resultado);
  return resultado;
}

const camposDecimais = new Set(["Quantidade", "QuantidadeTributavel", "ValorUnitario", "ValorUnitarioTributavel", "ValorTotal", "ValorDesconto", "ValorFrete", "ValorSeguro", "ValorOutrasDespesas", "BaseCalculo", "BaseCalculoFCP", "BaseCalculoFCPST", "AliquotaICMS", "AliquotaICMSST", "AliquotaMVA", "AliquotaCredito", "RedICMS", "RedICMSST", "AliquotaFCP", "AliquotaFCPST", "ValorIcms", "Aliquota", "AliquotaIBSUF", "AliquotaIBSMun", "AliquotaCBS", "PercentualReducaoIBS", "PercentualReducaoCBS", "PercentualDiferimento", "VlPago", "VlTroco", "Valor", "Desconto", "ValorLiquido"]);
/** Fotografia v2 calculada pelo motor único. Não procura regras do piloto nem
 * recalcula o comercial. O resultado recebe a mesma marca privada do serializador. */
export function prepararPayloadSnapshotBrasilNfeLocal(documento: DocumentoPreparacaoLocalBrasilNfe, modelo: ModeloDocumentoBrasilNfe, contexto: { cnpj: string; ambiente: "HOMOLOGACAO" | "PRODUCAO"; somentePrevia?: boolean }): ResultadoPayloadLocalBrasilNfe {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(documento.id) || !/^[a-f0-9]{64}$/.test(documento.hashPayload)) throw new ErroPayloadLocalBrasilNfe();
  const t = obj(obj(documento.payload).tributacao);
  if (t.apto !== true) return { documentoId: documento.id, hashPayload: documento.hashPayload, modelo, montagemConcluida: false, transmissaoPermitida: false, payload: null,
    pendencias: (Array.isArray(t.pendencias) ? t.pendencias : ["Recalcular a revisão fiscal pelo motor do HUB."]).filter(v => typeof v === "string" && v.length <= 2000).map(motivo => ({ campo: "tributacao", codigo: "AUSENTE", motivo: String(motivo), responsavel: "REVISAO_FISCAL", operacao: modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA" })) };
  const validado = validarSnapshotBrasilNfe(documento.payload as Prisma.JsonValue, contexto);
  if (validado.documento.ModeloDocumento !== modelo) throw new ErroPayloadLocalBrasilNfe();
  const exatos = (v: unknown, campo = ""): unknown => {
    if (camposDecimais.has(campo)) {
      const valor = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
      if (typeof valor !== "string" || !/^(0|[1-9]\d{0,13})(\.\d{1,10})?$/.test(valor)) throw new ErroPayloadLocalBrasilNfe();
      return valor;
    }
    if (Array.isArray(v)) return v.map(e => exatos(e));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, e]) => [k, exatos(e, k)]));
    return v;
  };
  const payload = { ...exatos(validado.documento) as PayloadNotaLocalBrasilNfe, IdentificadorInterno: documento.id, EnviarEmail: false as const };
  if (contexto.ambiente === "HOMOLOGACAO" && modelo === 65 && payload.Produtos.length) payload.Produtos[0].NmProduto = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";
  const resultado: ResultadoPayloadLocalBrasilNfe = { documentoId: documento.id, hashPayload: documento.hashPayload, modelo, montagemConcluida: true, transmissaoPermitida: false, payload, pendencias: [] };
  congelar(resultado); resultadosLocais.add(resultado); return resultado;
}
/** Corpo técnico exato para futura homologação. Não envia, não expõe credenciais, não usa float. */
export function serializarPayloadLocalBrasilNfe(resultado: ResultadoPayloadLocalBrasilNfe): string {
  if (!resultadosLocais.has(resultado) || !resultado.montagemConcluida || !resultado.payload || resultado.transmissaoPermitida !== false || ![1, 2].includes(resultado.payload.TipoAmbiente) || resultado.payload.EnviarEmail !== false) throw new ErroPayloadLocalBrasilNfe();
  if (["Serie", "Numero", "Lote"].some(campo => Object.hasOwn(resultado.payload!, campo))) throw new ErroPayloadLocalBrasilNfe();
  const serializar = (v: unknown, campo: string): string => {
    if (camposDecimais.has(campo)) {
      if (typeof v !== "string" || !/^(0|[1-9]\d{0,13})(\.\d{1,10})?$/.test(v)) throw new ErroPayloadLocalBrasilNfe();
      return v;
    }
    if (Array.isArray(v)) return `[${v.map(x => serializar(x, "")).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}:${serializar(x, k)}`).join(",")}}`;
    if (typeof v === "number" && !Number.isSafeInteger(v) || v === undefined) throw new ErroPayloadLocalBrasilNfe();
    return JSON.stringify(v);
  };
  return serializar(resultado.payload, "");
}

export type { ParametrosPayloadLocalBrasilNfe, RegraItemFiscalLocal };
