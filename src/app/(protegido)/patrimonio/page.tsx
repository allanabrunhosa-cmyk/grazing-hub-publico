
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { APP_MODULES } from "@/lib/modules";

export default async function PatrimonioPage() {
  await exigirPermissao("patrimonio");
  return <ModuleComingSoon module={APP_MODULES.find((m) => m.slug === "patrimonio")!} />;
}
