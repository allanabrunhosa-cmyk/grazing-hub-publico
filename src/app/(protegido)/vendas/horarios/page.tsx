import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { consultarHorariosPedidos } from "@/lib/vendas/pedidos-horarios";
import { HorariosForm } from "./horarios-form";
export default async function HorariosPage() {
  await exigirPermissao("vendas.horarios");
  return <main className="space-y-6"><HorariosForm inicial={await consultarHorariosPedidos()} editar={await podeAcessar("vendas.horarios", "editar")} /></main>;
}
