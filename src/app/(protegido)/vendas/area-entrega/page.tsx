import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { consultarEntregas } from "@/lib/vendas/entregas";
import { EntregasForm } from "./entregas-form";
export default async function AreaEntregaPage() {
  await exigirPermissao("vendas.area-entrega");
  return <main className="space-y-6"><EntregasForm inicial={await consultarEntregas()} editar={await podeAcessar("vendas.area-entrega", "editar")} /></main>;
}
