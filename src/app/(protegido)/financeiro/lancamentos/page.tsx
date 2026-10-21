
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { redirect } from "next/navigation";

export default async function PaginaAnterior() {
  await exigirPermissao("financeiro.movimentacoes");
  redirect("/financeiro/movimentacoes");
}
