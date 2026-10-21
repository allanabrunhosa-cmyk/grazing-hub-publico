/** Exibição de datas bancárias; valores dos inputs e filtros permanecem em ISO. */
export function dataFatura(valor:string):string {
  const partes=/^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return partes?`${partes[3]}/${partes[2]}/${partes[1]}`:valor;
}
