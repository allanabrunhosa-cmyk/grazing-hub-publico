
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { APP_MODULES } from "@/lib/modules";

export default async function RhPage() {
  await exigirPermissao("rh");
  return <ModuleComingSoon module={APP_MODULES.find((m) => m.slug === "rh")!} />;
}
