import {
  Settings,
  ShoppingCart,
  ChefHat,
  Boxes,
  Wallet,
  IdCard,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type AppModule = {
  slug: string;
  name: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  href: string;
  active: boolean;
};

// Ordem compartilhada pelo seletor de módulos no computador e celular.
// Configurações permanece por último.
export const APP_MODULES: AppModule[] = [
  {
    slug: "suprimentos",
    name: "Suprimentos",
    subtitle: "Compras & Estoque",
    icon: Boxes,
    color: "#B3A369",
    href: "/fornecedores",
    active: true,
  },
  {
    slug: "vendas",
    name: "Vendas & CRM",
    subtitle: "Pedidos, Clientes & Atendimento",
    icon: ShoppingCart,
    color: "#D97706",
    href: "/vendas",
    active: true,
  },
  {
    slug: "producao",
    name: "Produção",
    subtitle: "Validades & Cozinha",
    icon: ChefHat,
    color: "#059669",
    href: "/producao",
    active: true,
  },
  {
    slug: "financeiro",
    name: "Financeiro",
    subtitle: "DRE, Caixa & Fiscal",
    icon: Wallet,
    color: "#2563EB",
    href: "/financeiro",
    active: true,
  },
  {
    slug: "rh",
    name: "RH",
    subtitle: "Colaboradores & Folha",
    icon: IdCard,
    color: "#7C3AED",
    href: "/rh",
    active: false,
  },
  {
    slug: "patrimonio",
    name: "Patrimônio",
    subtitle: "Ativos & Manutenção",
    icon: Building2,
    color: "#92400E",
    href: "/patrimonio",
    active: false,
  },
  { slug: "configuracoes", name: "Configurações", subtitle: "Usuários & Permissões", icon: Settings, color: "#64748B", href: "/configuracoes", active: true },
];

export function findModuleByPathname(pathname: string): AppModule {
  if (pathname === "/crm" || pathname.startsWith("/crm/")) return APP_MODULES.find(m => m.slug === "vendas")!;
  const bySpecificRoute = APP_MODULES.find(
    (m) => m.slug !== "suprimentos" && pathname.startsWith(m.href)
  );
  if (bySpecificRoute) return bySpecificRoute;

  const suprimentos = APP_MODULES.find((m) => m.slug === "suprimentos");
  if (
    pathname.startsWith("/fornecedores") ||
    pathname.startsWith("/insumos") ||
    pathname.startsWith("/porcoes") ||
    pathname.startsWith("/compras") ||
    pathname.startsWith("/notas-fiscais") ||
    pathname.startsWith("/inventario")
  ) {
    return suprimentos!;
  }

  return suprimentos!;
}
