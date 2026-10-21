import { exigirPermissao } from "@/lib/permissoes/servidor";
import { EntradaCrm } from "@/components/atendimento/entrada-crm";

export default async function AtendimentoPage() {
  await exigirPermissao("crm");
  return <EntradaCrm disponivel />;
}
