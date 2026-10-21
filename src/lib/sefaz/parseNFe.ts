import { XMLParser } from "fast-xml-parser";
import type { TipoDocumentoSefaz } from "@/generated/prisma/client";
import type { DocumentoDistribuido } from "@/lib/sefaz/distribuicao";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

export type NFeExtraida = {
  chaveAcesso: string;
  tipo: TipoDocumentoSefaz;
  fornecedorCnpj: string | null;
  fornecedorNome: string | null;
  valorTotal: number | null;
  dataEmissao: Date | null;
  xmlCompleto: string | null;
};

function parseResNFe(xml: string): NFeExtraida {
  const parsed = parser.parse(xml);
  const res = parsed?.resNFe;
  if (!res) throw new Error("XML de resNFe em formato inesperado.");

  return {
    chaveAcesso: String(res.chNFe ?? ""),
    tipo: "RES_NFE",
    fornecedorCnpj: res.CNPJ ? String(res.CNPJ) : null,
    fornecedorNome: res.xNome ? String(res.xNome) : null,
    valorTotal: res.vNF != null ? Number(res.vNF) : null,
    dataEmissao: res.dhEmi ? new Date(String(res.dhEmi)) : null,
    xmlCompleto: null, // resumo — depende da manifestação e posterior distribuição do XML
  };
}

function parseProcNFe(xml: string): NFeExtraida {
  const parsed = parser.parse(xml);
  const infNFe = parsed?.nfeProc?.NFe?.infNFe;
  const infProt = parsed?.nfeProc?.protNFe?.infProt;
  if (!infNFe) throw new Error("XML de procNFe em formato inesperado.");

  const idComPrefixo = String(infNFe["@_Id"] ?? "");
  const chaveAcesso = infProt?.chNFe ? String(infProt.chNFe) : idComPrefixo.replace(/^NFe/, "");

  const emit = infNFe.emit ?? {};
  const vNF = infNFe.total?.ICMSTot?.vNF;
  const dhEmi = infNFe.ide?.dhEmi ?? infNFe.ide?.dEmi;

  return {
    chaveAcesso,
    tipo: "PROC_NFE",
    fornecedorCnpj: emit.CNPJ ? String(emit.CNPJ) : null,
    fornecedorNome: emit.xNome ? String(emit.xNome) : null,
    valorTotal: vNF != null ? Number(vNF) : null,
    dataEmissao: dhEmi ? new Date(String(dhEmi)) : null,
    xmlCompleto: xml,
  };
}

export type ItemNFeExtraido = {
  numeroItem: number;
  codigoProdutoFornecedor: string;
  descricaoProduto: string;
  codigoEan: string | null;
  ncm: string | null;
  cfop: string | null;
  unidadeComercial: string;
  quantidadeComercial: number;
  unidadeTributavel: string | null;
  quantidadeTributavel: number | null;
  valorUnitarioComercial: number | null;
  valorTotalItem: number;
};

// Extrai os itens (<det>/<prod>) de um XML de procNFe já persistido — só chamada sob
// demanda pela tela de conciliação de Notas Fiscais, nunca durante a sincronização
// com a SEFAZ (que só lê cabeçalho via parseProcNFe acima).
export function extrairItensNFe(xmlCompleto: string): ItemNFeExtraido[] {
  const parsed = parser.parse(xmlCompleto);
  const infNFe = parsed?.nfeProc?.NFe?.infNFe;
  if (!infNFe) throw new Error("XML de procNFe em formato inesperado.");

  // Com um único item, o fast-xml-parser devolve `det` como objeto, não array —
  // mesma normalização já usada pra `docZip` em distribuicao.ts.
  const detBruto = infNFe.det;
  const listaDet: Record<string, unknown>[] = detBruto == null ? [] : Array.isArray(detBruto) ? detBruto : [detBruto];

  return listaDet.map((det, indice) => {
    const prod = (det.prod ?? {}) as Record<string, unknown>;
    const cEan = prod.cEAN != null ? String(prod.cEAN) : null;
    return {
      numeroItem: Number(det["@_nItem"] ?? indice + 1),
      codigoProdutoFornecedor: String(prod.cProd ?? ""),
      descricaoProduto: String(prod.xProd ?? ""),
      codigoEan: cEan && cEan !== "SEM GTIN" ? cEan : null,
      ncm: prod.NCM != null ? String(prod.NCM) : null,
      cfop: prod.CFOP != null ? String(prod.CFOP) : null,
      unidadeComercial: String(prod.uCom ?? ""),
      quantidadeComercial: prod.qCom != null ? Number(prod.qCom) : 0,
      unidadeTributavel: prod.uTrib != null ? String(prod.uTrib) : null,
      quantidadeTributavel: prod.qTrib != null ? Number(prod.qTrib) : null,
      valorUnitarioComercial: prod.vUnCom != null ? Number(prod.vUnCom) : null,
      valorTotalItem: prod.vProd != null ? Number(prod.vProd) : 0,
    };
  });
}

export type EmitenteEnderecoNFe = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
};

export type DetalhesFiscaisNFe = {
  naturezaOperacao: string | null;
  modelo: string | null;
  serie: string | null;
  numero: string | null;
  codigoUnico: string | null;
  versao: string | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  emitenteEndereco: EmitenteEnderecoNFe;
};

// Dados de cabeçalho pra exibição na tela de conciliação — nunca persistidos, sempre
// reparseados do XML sob demanda (é barato, e evita ficar defasado de mudanças no XML).
export function extrairDetalhesFiscaisNFe(xmlCompleto: string): DetalhesFiscaisNFe {
  const parsed = parser.parse(xmlCompleto);
  const infNFe = parsed?.nfeProc?.NFe?.infNFe;
  if (!infNFe) throw new Error("XML de procNFe em formato inesperado.");

  const ide = (infNFe.ide ?? {}) as Record<string, unknown>;
  const emit = (infNFe.emit ?? {}) as Record<string, unknown>;
  const enderEmit = (emit.enderEmit ?? {}) as Record<string, unknown>;

  return {
    naturezaOperacao: ide.natOp != null ? String(ide.natOp) : null,
    modelo: ide.mod != null ? String(ide.mod) : null,
    serie: ide.serie != null ? String(ide.serie) : null,
    numero: ide.nNF != null ? String(ide.nNF) : null,
    codigoUnico: ide.cNF != null ? String(ide.cNF) : null,
    versao: infNFe["@_versao"] != null ? String(infNFe["@_versao"]) : null,
    emitenteCnpj: emit.CNPJ != null ? String(emit.CNPJ) : null,
    emitenteNome: emit.xNome != null ? String(emit.xNome) : null,
    emitenteEndereco: {
      logradouro: enderEmit.xLgr != null ? String(enderEmit.xLgr) : null,
      numero: enderEmit.nro != null ? String(enderEmit.nro) : null,
      bairro: enderEmit.xBairro != null ? String(enderEmit.xBairro) : null,
      municipio: enderEmit.xMun != null ? String(enderEmit.xMun) : null,
      uf: enderEmit.UF != null ? String(enderEmit.UF) : null,
    },
  };
}

export type DuplicataNFeExtraida = {
  numero: string;
  dataVencimento: Date;
  valor: number;
};

// Extrai as parcelas de pagamento (<cobr>/<dup>) do XML. Notas sem <cobr> (pagamento
// à vista simples) não têm duplicata nenhuma no XML — nesse caso sintetiza uma única
// parcela com o valor total da nota, vencendo na data de emissão.
export function extrairDuplicatasNFe(xmlCompleto: string): DuplicataNFeExtraida[] {
  const parsed = parser.parse(xmlCompleto);
  const infNFe = parsed?.nfeProc?.NFe?.infNFe;
  if (!infNFe) throw new Error("XML de procNFe em formato inesperado.");

  const dupBruto = infNFe.cobr?.dup;
  if (dupBruto == null) {
    const dhEmi = infNFe.ide?.dhEmi ?? infNFe.ide?.dEmi;
    const vNF = infNFe.total?.ICMSTot?.vNF;
    return [
      {
        numero: "001",
        dataVencimento: dhEmi ? new Date(String(dhEmi)) : new Date(),
        valor: vNF != null ? Number(vNF) : 0,
      },
    ];
  }

  const listaDup: Record<string, unknown>[] = Array.isArray(dupBruto) ? dupBruto : [dupBruto];

  return listaDup.map((dup, indice) => {
    const dVenc = dup.dVenc != null ? String(dup.dVenc) : null;
    return {
      numero: dup.nDup != null ? String(dup.nDup) : String(indice + 1).padStart(3, "0"),
      // "YYYY-MM-DD" -> meio-dia, pra nunca virar o dia anterior por causa de timezone.
      dataVencimento: dVenc ? new Date(`${dVenc}T12:00:00`) : new Date(),
      valor: dup.vDup != null ? Number(dup.vDup) : 0,
    };
  });
}

// Detecta o tipo pelo prefixo do schema (ex.: "resNFe_v1.01.xsd", "procNFe_v4.00.xsd")
// em vez de comparar a versão exata — a SEFAZ evolui a versão do schema com o tempo.
export function extrairDadosDocumento(documento: DocumentoDistribuido): NFeExtraida | null {
  if (documento.schema.startsWith("resNFe")) {
    return parseResNFe(documento.xml);
  }
  if (documento.schema.startsWith("procNFe")) {
    return parseProcNFe(documento.xml);
  }
  // resEvento / procEventoNFe (eventos de cancelamento, carta de correção, etc.) —
  // fora do escopo desta primeira entrega (só notas, não eventos).
  return null;
}
