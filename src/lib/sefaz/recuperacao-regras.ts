export const HORA = 60 * 60 * 1000;
export const LIMITE_PONTUAIS = 10; // Margem frente ao limite externo compartilhado de 20/h.
export const nsuValido = (valor: string) => /^\d{15}$/.test(valor);
export const formatarNsu = (valor: bigint) => valor.toString().padStart(15, "0");

export function encontrarLacunas(antes: string, depois: string, recebidos: string[]) {
  if (!nsuValido(antes) || !nsuValido(depois) || depois < antes) throw new Error("Sequência NSU inválida na resposta.");
  let proximo = BigInt(antes) + BigInt(1);
  const fim = BigInt(depois);
  const lacunas: { inicio: string; fim: string }[] = [];
  for (const nsu of [...new Set(recebidos)].sort()) {
    if (!nsuValido(nsu) || nsu <= antes || nsu > depois) throw new Error("Documento fora do intervalo consultado.");
    const numero = BigInt(nsu);
    if (numero > proximo) lacunas.push({ inicio: formatarNsu(proximo), fim: formatarNsu(numero - BigInt(1)) });
    proximo = numero + BigInt(1);
  }
  if (proximo <= fim) lacunas.push({ inicio: formatarNsu(proximo), fim: depois });
  return lacunas;
}
