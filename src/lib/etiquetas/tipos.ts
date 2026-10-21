export type ConservacaoEtiquetaValor = "SECO" | "REFRIGERADO" | "CONGELADO" | "APOS_ABERTO";
export const conservacoesEtiqueta: { valor: ConservacaoEtiquetaValor; rotulo: string; rotuloEtiqueta: string }[] = [
  { valor: "SECO", rotulo: "Ambiente", rotuloEtiqueta: "AMBIENTE" },
  { valor: "REFRIGERADO", rotulo: "Refrigerado", rotuloEtiqueta: "REFRIGERADO" },
  { valor: "CONGELADO", rotulo: "Congelado", rotuloEtiqueta: "CONGELADO" },
];

export function rotuloConservacaoEtiqueta(valor: ConservacaoEtiquetaValor) {
  return conservacoesEtiqueta.find((item) => item.valor === valor)?.rotulo ?? (valor === "APOS_ABERTO" ? "Após aberto" : valor);
}
export type TamanhoEtiquetaValor = "MM_60X40" | "MM_60X60";

export type DadosEtiqueta = {
  produtoNome: string;
  lojaNome: string;
  lojaCnpj: string | null;
  lojaEndereco?: string | null;
  conservacao: ConservacaoEtiquetaValor;
  quantidade: string | null;
  unidade: string;
  lote: string | null;
  marcaFornecedor?: string | null;
  sif?: string | null;
  validadeOriginal?: string | null;
  codigoRastreio?: string;
  responsavelManipulacao: string;
  manipuladoEm: string;
  validoAte: string;
  fusoHorario: string;
  resolucaoDpi: number;
  tamanho: TamanhoEtiquetaValor;
  mostrarHora: boolean;
  copias: number;
};

export type EntradaPrepararEtiqueta = {
  responsavelUsuarioId?: string;
  responsavelCadastroId?: string;
  chaveIdempotencia: string;
  insumoId: string;
  conservacao: ConservacaoEtiquetaValor;
  quantidade: string;
  lote: string;
  marcaFornecedor?: string;
  sif?: string;
  validadeOriginal?: string;
  responsavelManipulacao: string;
  tamanho: TamanhoEtiquetaValor;
  mostrarHora: boolean;
  copias: number;
};

export type TrabalhoEtiquetaPreparado = {
  id: string;
  zpl: string;
  nomeArquivo: string;
  dados: DadosEtiqueta;
  status: string;
  reutilizado: boolean;
};
