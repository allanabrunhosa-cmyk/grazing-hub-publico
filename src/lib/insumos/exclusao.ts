type Vinculo = { id: string; nome: string };
export type VinculosExclusaoInsumo = {
  preparacoes: Vinculo[];
  complementos: Vinculo[];
  produtos: Vinculo[];
  outrosVinculos: boolean;
  revisao?: string;
};

export function temVinculosExclusaoInsumo(vinculos: VinculosExclusaoInsumo) {
  return vinculos.outrosVinculos || vinculos.preparacoes.length > 0
    || vinculos.complementos.length > 0 || vinculos.produtos.length > 0;
}
