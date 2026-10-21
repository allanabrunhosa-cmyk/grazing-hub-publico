import { redirect } from "next/navigation";
import { HOST_PEDIDOS } from "@/lib/hosts";
import { rotaGestor, type GestorFiltros } from "../gestor-dominio";
import { exigirPermissao } from "@/lib/permissoes/servidor";
/** Compatibilidade de favoritos: calendário é um modo do gestor. */
export default async function CalendarioPage({ searchParams }: { searchParams: Promise<GestorFiltros> }) {
  await exigirPermissao("vendas.pedidos");
  redirect(`https://${HOST_PEDIDOS}${rotaGestor(await searchParams, { modo: "calendario" })}`);
}
