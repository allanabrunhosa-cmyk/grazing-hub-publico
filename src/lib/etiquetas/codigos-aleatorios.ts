import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

function gerarCodigoEtiqueta() {
  for (let tentativa = 0; tentativa < 64; tentativa += 1) {
    const codigo = randomInt(36 ** 6).toString(36).toUpperCase().padStart(6, "0");
    if (/[A-Z]/.test(codigo) && /[0-9]/.test(codigo)) return codigo;
  }
  throw new Error("Não foi possível gerar um código de etiqueta. Tente novamente.");
}

export async function prepararComCodigosAleatorios<T>(
  copias: number,
  preparar: (codigos: string[]) => Promise<T>,
): Promise<T> {
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const codigos = Array.from({ length: copias }, gerarCodigoEtiqueta);
    if (new Set(codigos).size !== copias) continue;
    try {
      return await preparar(codigos);
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2002") throw erro;
      const alvo = erro.meta?.target;
      const adaptador = erro.meta?.driverAdapterError as { cause?: { constraint?: { index?: string; fields?: string[] } } } | undefined;
      const restricao = adaptador?.cause?.constraint;
      const campos = restricao?.fields ?? alvo;
      const colisao = restricao?.index === "CodigoEtiqueta_pkey" || alvo === "CodigoEtiqueta_pkey"
        || (Array.isArray(campos) && campos.length === 1 && campos[0] === "codigo");
      // Uma violação única aborta a transação. A próxima tentativa abre outra inteira.
      if (!colisao) throw erro;
    }
  }
  throw new Error("Não foi possível reservar códigos únicos de etiqueta. Tente novamente.");
}
