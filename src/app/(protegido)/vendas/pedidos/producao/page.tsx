import { redirect } from "next/navigation";
import { HOST_PEDIDOS } from "@/lib/hosts";
import { rotaGestor, type GestorFiltros } from "../gestor-dominio";
import { exigirPermissao } from "@/lib/permissoes/servidor";
/** Compatibilidade de favoritos: produção agora integra o gestor dedicado. */
export default async function ProducaoPedidosPage({ searchParams }: { searchParams: Promise<GestorFiltros> }) { await exigirPermissao("vendas.pedidos.producao"); redirect(`https://${HOST_PEDIDOS}${rotaGestor(await searchParams, { modo: "quadros" })}`); }
