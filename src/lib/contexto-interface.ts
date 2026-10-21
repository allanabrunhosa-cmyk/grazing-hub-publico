import "server-only";
import { headers } from "next/headers";
import { contextoDoHost, type IdentidadeInterface } from "./hosts";

export async function identidadeDaInterface(): Promise<IdentidadeInterface> {
  return contextoDoHost(await headers())?.identidade ?? "hub";
}

export async function interfaceEtiquetasDedicada() {
  return await identidadeDaInterface() === "etiquetas";
}
