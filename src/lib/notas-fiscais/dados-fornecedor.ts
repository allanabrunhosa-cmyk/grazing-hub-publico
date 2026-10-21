import { XMLParser } from "fast-xml-parser";
import { paraCaixaAltaOpcional } from "@/lib/caixa-alta";

export const camposFornecedor = ["nome", "razaoSocial", "cnpj", "telefone"] as const;
export type CampoFornecedor = typeof camposFornecedor[number];
export const rotulosFornecedor: Record<CampoFornecedor, string> = {
  nome: "Nome", razaoSocial: "Razão social", cnpj: "CNPJ", telefone: "Telefone",
};
export type DadosFornecedorNota = Record<CampoFornecedor, string | null>;
export type PreviaFornecedorNota = {
  fornecedorId: string | null;
  fornecedores: { id: string; nome: string }[];
  atual: DadosFornecedorNota | null;
  nota: DadosFornecedorNota;
  campos: CampoFornecedor[];
  versao: string;
  vinculoAnterior: string | null;
};

export function extrairFornecedorNota(xml: string, cnpjNota: string | null, chave: string): DadosFornecedorNota {
  const documento = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true }).parse(xml);
  const inf = documento?.nfeProc?.NFe?.infNFe;
  const emitente = inf?.emit;
  const texto = (valor: unknown): string | null => typeof valor === "string" && valor.trim() ? valor.trim() : null;
  const cnpj = texto(emitente?.CNPJ);
  if (!cnpj || !/^\d{14}$/.test(cnpj) || cnpj !== cnpjNota || chave.slice(6, 20) !== cnpj || inf?.["@_Id"] !== `NFe${chave}`) {
    throw new Error("Não foi possível conferir o CNPJ do emitente no XML desta nota.");
  }
  const razaoSocial = paraCaixaAltaOpcional(texto(emitente?.xNome));
  if (!razaoSocial) throw new Error("O XML não informa a razão social do emitente.");
  return { cnpj, razaoSocial, nome: paraCaixaAltaOpcional(texto(emitente?.xFant)) ?? razaoSocial, telefone: texto(emitente?.enderEmit?.fone) };
}
