/** O DTO já foi validado no servidor. Exibir relógio civil sem converter para Date
 * nem trazer dependências de banco para o navegador. */
export function exibirHorarioMerchant(valor:string) {
  return valor.slice(8,10)+"/"+valor.slice(5,7)+"/"+valor.slice(0,4)+", "+valor.slice(11,19);
}
