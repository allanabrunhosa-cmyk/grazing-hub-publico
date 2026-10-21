import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { gtinFiscalBrasilNfeValido } from "./gtin";

export type ModeloDocumentoBrasilNfe = 55 | 65;
export type PendenciaMapeamentoBrasilNfe = { campo: string; motivo: string; responsavel: "REVISAO_FISCAL" | "HUB" | "BRASIL_NFE" };
export type ProdutoParcialBrasilNfe = {
  CodProdutoServico: string; NmProduto: string; UnidadeComercial: string;
  Quantidade: string; ValorUnitario: string; ValorTotal: string; ValorDesconto: string;
  NCM?: string; CEST?: string; EAN?: string; CFOP?: number; OrigemProduto?: number;
  UnidadeComercialTributavel?: string;
  Imposto: { ICMS: { CodSituacaoTributaria?: string }; PIS: { CodSituacaoTributaria?: string }; COFINS: { CodSituacaoTributaria?: string }; IPI?: { CodSituacaoTributaria: string } };
};
export type PlanoMapeamentoBrasilNfe = {
  /** É um plano parcial, nunca um corpo apto a ser enviado à API. Decimais permanecem strings. */
  transmissaoPermitida: false;
  notaParcial: { IdentificadorInterno: string; ModeloDocumento: ModeloDocumentoBrasilNfe; TipoAmbiente: 1 | 2; EnviarEmail: false; Produtos: ProdutoParcialBrasilNfe[]; ValorTotal: string };
  comercial: { subtotal: string; desconto: string; frete: string; outrosCustos: string; total: string };
  pendencias: PendenciaMapeamentoBrasilNfe[];
};
export class ErroMapeamentoBrasilNfe extends Error {
  constructor() { super("Fotografia comercial ou contexto fiscal inválido para o Brasil NFe."); this.name = "ErroMapeamentoBrasilNfe"; }
}
const objeto = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroMapeamentoBrasilNfe();
  return v as Record<string, unknown>;
};
const texto = (v: unknown, limite: number): string => {
  if (typeof v !== "string" || !v.trim() || v.length > limite || /[\u0000-\u001f\u007f]/.test(v)) throw new ErroMapeamentoBrasilNfe();
  return v;
};
function decimal(v: unknown, inteiros: number, casas: number, positivo = false) {
  if (typeof v !== "string" || !new RegExp(`^(0|[1-9][0-9]{0,${inteiros - 1}})(\\.[0-9]{1,${casas}})?$`).test(v) || (positivo && !/[1-9]/.test(v))) throw new ErroMapeamentoBrasilNfe();
  return v;
}
export function normalizarCnpjBrasilNfe(v: unknown): string {
  if (typeof v !== "string" || !/^[0-9./-]{14,18}$/.test(v)) throw new ErroMapeamentoBrasilNfe();
  const cnpj = v.replace(/[./-]/g, "");
  if (!/^\d{14}$/.test(cnpj)) throw new ErroMapeamentoBrasilNfe();
  return cnpj;
}
const cfopsNfce = new Set(["5101", "5102", "5103", "5104", "5115", "5405", "5656", "5667", "5933", "6108", "6109", "6110"]);
/** Usa exclusivamente o snapshot preparado. Grupo fiscal é referência preservada,
 * não fallback silencioso. Natureza, enquadramento, tributos e destinatário exigem
 * decisão fiscal posterior; a função não calcula imposto nem reescreve o pedido. */
export function prepararMapeamentoBrasilNfe(payload: unknown, contexto: { documentoId: string; emitenteCnpj: string; modelo: ModeloDocumentoBrasilNfe; ambiente: "HOMOLOGACAO" | "PRODUCAO"; crt?: 1 | 2 | 3 | 4 }): PlanoMapeamentoBrasilNfe {
  if (!["HOMOLOGACAO", "PRODUCAO"].includes(contexto.ambiente) || ![55, 65].includes(contexto.modelo) || !/^[a-zA-Z0-9_-]{1,100}$/.test(contexto.documentoId) || (contexto.crt !== undefined && ![1, 2, 3, 4].includes(contexto.crt))) throw new ErroMapeamentoBrasilNfe();
  const p = objeto(payload);
  if (p.schema !== "grazing.fiscal-saida" || p.versao !== 1 || !Array.isArray(p.itens) || p.itens.length < 1 || p.itens.length > 990) throw new ErroMapeamentoBrasilNfe();
  if (normalizarCnpjBrasilNfe(objeto(p.emitente).cnpj) !== normalizarCnpjBrasilNfe(contexto.emitenteCnpj)) throw new ErroMapeamentoBrasilNfe();
  const valores = objeto(p.valores);
  const comercial = { subtotal: decimal(valores.subtotal, 12, 2), desconto: decimal(valores.desconto, 12, 2), frete: decimal(valores.frete, 12, 2), outrosCustos: decimal(valores.outrosCustos, 12, 2), total: decimal(valores.total, 12, 2, true) };
  const pendencias: PendenciaMapeamentoBrasilNfe[] = [];
  const pendente = (campo: string, motivo: string, responsavel: PendenciaMapeamentoBrasilNfe["responsavel"] = "REVISAO_FISCAL") => pendencias.push({ campo, motivo, responsavel });
  if (!contexto.crt) pendente("emitente.CRT", "Conferir CRT e inscrição estadual do emitente; cadastro comercial não define regime tributário.");
  pendente("NaturezaOperacao/Finalidade/IndicadorPresenca/ConsumidorFinal", "Definir enquadramento da operação por modelo, canal e destinatário, sem inferir pelos nomes comerciais.");
  pendente("Cliente", "Conferir CPF/CNPJ, indicador IE, IE e endereço fiscal com código IBGE; comprador, cobrança e entrega não são equivalentes.");
  pendente("Pagamentos/Cobranca", "Definir códigos SEFAZ, valores e troco; parcelas financeiras e rótulos de pagamento não fornecem o contrato fiscal.");
  pendente("ValorFrete/ValorDesconto/ValorTotal", "Definir rateio e reconciliação dos totais fiscais, complementos, acréscimos e tributos; não somar novamente desconto global e descontos dos itens.");
  pendente("IdentificadorInterno", "Fornecedor deve confirmar idempotência, latência de consulta e recuperação de todas as tentativas antes de habilitar emissão.", "BRASIL_NFE");
  pendente("eventos.sequencia", "Definir sequência monotônica e identificação estável dos resultados; contrato de consulta não comprova sequência de eventos.", "BRASIL_NFE");
  if (contexto.modelo === 65) pendente("NFCe.CSC", "Conferir CSC de homologação e regras de NFC-e diretamente na conta; não copiar CSC para o HUB.", "BRASIL_NFE");
  const Produtos = p.itens.map((entrada, indice) => {
    const item = objeto(entrada), produto = objeto(item.produto), ficha = objeto(item.fiscal);
    const fiscal = ficha.produto == null ? {} : objeto(ficha.produto);
    const prefixo = `Produtos[${indice}]`;
    const campo = (nome: string, formato: RegExp, obrigatorio: boolean) => {
      const valor = fiscal[nome];
      if (valor === undefined || valor === null || valor === "") { if (obrigatorio) pendente(`${prefixo}.${nome}`, "Classificação ausente no snapshot do produto; conferir mediante fundamentação fiscal."); return undefined; }
      if (typeof valor !== "string" || !formato.test(valor)) { pendente(`${prefixo}.${nome}`, "Classificação com formato inválido; revisar a fundamentação fiscal."); return undefined; }
      return valor;
    };
    const ncm = campo("ncm", /^\d{8}$/, true), cest = campo("cest", /^\d{7}$/, false), origem = campo("origem", /^[0-8]$/, true), cfop = campo("cfop", /^\d{4}$/, true);
    const csosn = campo("csosn", /^\d{3}$/, false), cst = campo("cstIcms", /^\d{2}$/, false), pis = campo("pis", /^\d{2}$/, true), cofins = campo("cofins", /^\d{2}$/, true), ipi = campo("ipi", /^\d{2}$/, false);
    let icms: string | undefined;
    if (csosn && cst) pendente(`${prefixo}.ICMS`, "CSOSN e CST simultâneos são ambíguos; definir a situação compatível com o CRT.");
    else if (!contexto.crt) pendente(`${prefixo}.ICMS`, "CRT não confirmado; não escolher CSOSN ou CST automaticamente.");
    else if ([1, 4].includes(contexto.crt) && csosn) icms = csosn;
    else if ([2, 3].includes(contexto.crt) && cst) icms = cst;
    else pendente(`${prefixo}.ICMS`, "CSOSN/CST ausente ou incompatível com o CRT confirmado.");
    if (contexto.modelo === 65 && cfop && !cfopsNfce.has(cfop)) pendente(`${prefixo}.CFOP`, "CFOP fora dos aceitos no contrato Brasil NFe para NFC-e; decidir operação/modelo mediante revisão fiscal fundamentada.");
    let ean = campo("ean", /^(\d{8}|\d{12,14}|SEM GTIN)$/, true);
    if (ean && !gtinFiscalBrasilNfeValido(ean)) { pendente(`${prefixo}.ean`, "Conferir GTIN e dígito verificador da unidade final; código preenchido só com zeros não identifica o produto."); ean = undefined; }
    const tributavel = campo("unidadeTributavel", /^[A-Za-z0-9]{1,6}$/, true);
    pendente(`${prefixo}.QuantidadeTributavel/ValorUnitarioTributavel`, "Definir unidade e conversão tributável; não assumir quantidade comercial igual à tributável.");
    pendente(`${prefixo}.Imposto`, "Conferir bases, alíquotas e valores ICMS/PIS/COFINS/IPI/FCP/ST, benefícios e IBS/CBS aplicáveis; cadastro atual só guarda classificações.");
    pendente(`${prefixo}.fiscalRevisado`, "Snapshot v1 não comprova aprovação fiscal da ficha; manter sua revisão e registrar a aprovação fiscal em marco posterior.", "HUB");
    pendente(`${prefixo}.CEST`, "Confirmar aplicabilidade de CEST e substituição tributária mesmo quando código estiver ausente.");
    const desconto = decimal(item.desconto, 12, 2);
    // totalLinha já é líquido do rateio de desconto e preco exclui complementos.
    // Mantém os acréscimos comerciais existentes, sem descontar a mesma parcela duas vezes.
    const unitarioBruto = new Prisma.Decimal(decimal(item.preco, 12, 2)).plus(decimal(item.acrescimos, 12, 2)).toFixed(2);
    const totalBruto = new Prisma.Decimal(decimal(item.total, 12, 2)).plus(desconto).toFixed(2);
    const mapeado: ProdutoParcialBrasilNfe = {
      CodProdutoServico: texto(item.produtoId, 100), NmProduto: texto(produto.nome, 120), UnidadeComercial: texto(item.unidade, 6),
      Quantidade: decimal(item.quantidade, 14, 6, true), ValorUnitario: decimal(unitarioBruto, 12, 2), ValorTotal: decimal(totalBruto, 12, 2), ValorDesconto: desconto,
      Imposto: { ICMS: { ...(icms ? { CodSituacaoTributaria: icms } : {}) }, PIS: { ...(pis ? { CodSituacaoTributaria: pis } : {}) }, COFINS: { ...(cofins ? { CodSituacaoTributaria: cofins } : {}) }, ...(ipi ? { IPI: { CodSituacaoTributaria: ipi } } : {}) },
      ...(ncm ? { NCM: ncm } : {}), ...(cest ? { CEST: cest } : {}), ...(ean ? { EAN: ean } : {}), ...(origem ? { OrigemProduto: Number(origem) } : {}), ...(cfop ? { CFOP: Number(cfop) } : {}), ...(tributavel ? { UnidadeComercialTributavel: tributavel } : {}),
    };
    return mapeado;
  });
  return { transmissaoPermitida: false, notaParcial: { IdentificadorInterno: contexto.documentoId, ModeloDocumento: contexto.modelo, TipoAmbiente: contexto.ambiente === "PRODUCAO" ? 1 : 2, EnviarEmail: false, Produtos, ValorTotal: comercial.total }, comercial, pendencias };
}
