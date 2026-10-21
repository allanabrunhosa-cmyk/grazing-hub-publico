import { exigirPermissao } from "@/lib/permissoes/servidor";
import { redirect } from "next/navigation";

export default async function CrmPage() {
  await exigirPermissao("crm");
  redirect("/vendas/atendimento");
}
