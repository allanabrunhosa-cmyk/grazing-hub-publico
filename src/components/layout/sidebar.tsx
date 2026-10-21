"use client";

import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Settings,
  Truck,
  Users,
  Package,
  Receipt,
  FileText,
  Warehouse,
  ClipboardList,
  LineChart,
  CalendarRange,
  NotebookPen,
  Landmark,
  ListTree,
  Tags,
  ArrowUpRight,
  TriangleAlert,
  Palette,
  CreditCard,
  TableProperties,
  type LucideIcon,
} from "lucide-react";
import { CabecalhoMenuLateral, MenuLateral, RodapeMenuLateral } from "./menu-lateral";
import { useAcesso } from "./acesso-contexto";
import { NavLink } from "@/components/layout/nav-link";
import { GrupoNavegacao } from "@/components/layout/grupo-navegacao";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { findModuleByPathname } from "@/lib/modules";
import { CAMINHO_ETIQUETAS, HOST_ETIQUETAS, CAMINHO_PEDIDOS, HOST_PEDIDOS, HOST_ATENDIMENTO } from "@/lib/hosts";

// Itens de navegação por módulo. Módulos sem entrada aqui (ainda sem telas de
// verdade) caem no ModuleComingSoon, sem sub-itens.
const NAV_ITEMS_BY_MODULE: Record<string, { href: string; destino?: string; label: string; icon: LucideIcon; exact?: boolean }[]> = {
  vendas: [
    { href: "/vendas/bi", label: "Dashboard", icon: LineChart },
    { href: CAMINHO_PEDIDOS, destino: `https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}`, label: "Gestor de pedidos", icon: ClipboardList, exact: true },
    { href: "/vendas/atendimento", destino: `https://${HOST_ATENDIMENTO}`, label: "Atendimento", icon: Users, exact: true },
    { href: "/vendas/clientes", label: "Clientes", icon: Users },
  ],
  configuracoes: [
    { href: "/configuracoes/integracoes", label: "Integrações", icon: Settings },
    { href: "/configuracoes/usuarios", label: "Usuários & Permissões", icon: ShieldCheck },
    { href: "/configuracoes/empresa", label: "Dados da empresa", icon: Settings },
  ],
  suprimentos: [
    { href: "/fornecedores", label: "Fornecedores", icon: Truck },
    { href: "/insumos", label: "Insumos", icon: Package },
    { href: "/porcoes", label: "Tabela de Porções", icon: TableProperties },
    { href: "/notas-fiscais", label: "Manifesto de Notas", icon: Receipt },
  ],
  financeiro: [
    { href: "/financeiro", label: "DRE", icon: LineChart, exact: true },
    { href: "/financeiro/fluxo-de-caixa", label: "Fluxo de Caixa", icon: CalendarRange },
    { href: "/financeiro/movimentacoes", label: "Movimentações", icon: NotebookPen },
    { href: "/financeiro/manifesto-nfs", label: "Manifesto de NFS", icon: FileText },
    { href: "/financeiro/plano-de-contas", label: "Plano de Contas", icon: ListTree },
  ],
  producao: [
    { href: CAMINHO_ETIQUETAS, destino: `https://${HOST_ETIQUETAS}${CAMINHO_ETIQUETAS}`, label: "Controle de validades", icon: Tags },
  ],
};

const CARDAPIO_VENDAS = [
  { href: "/vendas/produtos", label: "Produtos", icon: Package },
  { href: "/vendas/catalogo", label: "Complementos", icon: ListTree },
];
const CONFIGURACOES_VENDAS = [
  { href: "/vendas/formas-pagamento", label: "Formas de pagamento", icon: CreditCard },
  { href: "/vendas/canais", label: "Canais de venda", icon: CreditCard },
  { href: "/vendas/horarios", label: "Horários de entrega", icon: CalendarRange },
  { href: "/vendas/area-entrega", label: "Entregas", icon: Package },
];
const FISCAL_FINANCEIRO = [
  { href: "/financeiro/fiscal", label: "Visão geral", icon: LineChart, exact: true },
  { href: "/financeiro/fiscal/grupos", label: "Grupos fiscais", icon: FileText },
  { href: "/financeiro/fiscal/vinculos", label: "Vínculos fiscais", icon: ListTree },
  { href: "/financeiro/fiscal/configuracoes", label: "Configurações", icon: Settings },
];

export function ConteudoMenuLateral() {
  const pathname = usePathname();
  const { admin, podeRota } = useAcesso();
  const currentModule = findModuleByPathname(pathname);
  const navItems = (NAV_ITEMS_BY_MODULE[currentModule.slug] ?? []).filter(item => podeRota(item.href) || (item.href === "/configuracoes/integracoes" && podeRota("/configuracoes/integracoes/brasilnfe")));
  const temEstoque = currentModule.slug === "suprimentos" && ["/inventario", "/inventario/contagem", "/compras", "/inventario/perdas"].some(podeRota);
  const fiscal = FISCAL_FINANCEIRO.filter(item => podeRota(item.href) && (item.href !== "/financeiro/fiscal/homologacao" || podeRota("/configuracoes/integracoes/brasilnfe") && podeRota("/vendas/pedidos")));

  return (
    <>
      <CabecalhoMenuLateral />

      <div className="menu-seletor px-3 pb-5">
        <ModuleSwitcher />
      </div>

      <nav aria-label={`Navegação de ${currentModule.name}`} className="flex-1 space-y-1 px-3 pb-5">
        <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Área de trabalho</p>
        {navItems.length > 0 || temEstoque || (currentModule.slug === "vendas" && [...CARDAPIO_VENDAS, ...CONFIGURACOES_VENDAS].some(item => podeRota(item.href))) || (currentModule.slug === "financeiro" && (["/financeiro/bancario", "/financeiro/cartoes"].some(podeRota) || fiscal.length > 0)) ? (
          <>
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.destino ?? item.href} exact={item.exact} external={Boolean(item.destino)} novaAbaAcessivel={item.href === "/vendas/atendimento"}>
              <item.icon className="size-4" />
              {item.label}
              {item.destino && <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5 opacity-75" />}
            </NavLink>
          ))}
          {currentModule.slug === "vendas" && <>
            <GrupoNavegacao titulo="Cardápio" icon={NotebookPen} itens={CARDAPIO_VENDAS} pathname={pathname} podeRota={podeRota} />
            <GrupoNavegacao titulo="Configurações" icon={Settings} itens={CONFIGURACOES_VENDAS} pathname={pathname} podeRota={podeRota} />
          </>}
          {currentModule.slug === "financeiro" && <>
            <NavegacaoBancos pathname={pathname} podeRota={podeRota} />
            <GrupoNavegacao titulo="Fiscal" icon={FileText} itens={fiscal} pathname={pathname} podeRota={podeRota} href={fiscal[0]?.href} />
          </>}
          {currentModule.slug === "suprimentos" && <NavegacaoEstoque pathname={pathname} podeRota={podeRota} />}
          {currentModule.slug === "configuracoes" && admin && podeRota("/configuracoes/design") && <NavegacaoCentralDesign pathname={pathname} />}
          </>
        ) : (
          <p className="px-3 py-2 text-xs text-sidebar-foreground/50">Nenhum item disponível ainda.</p>
        )}
      </nav>
      <RodapeMenuLateral />
    </>
  );
}

function NavegacaoEstoque({ pathname, podeRota }: { pathname: string; podeRota: (rota: string) => boolean }) {
  const filhos = [
    { href: "/inventario", label: "Inventário", icon: Warehouse, exact: true },
    { href: "/inventario/movimentacoes", label: "Movimentações", icon: NotebookPen, exact: false },
    { href: "/inventario/producao", label: "Produção de preparações", icon: Package, exact: false },
    { href: "/inventario/contagem", label: "Contagem de estoque", icon: ClipboardList, exact: false },
    { href: "/compras", label: "Compras", icon: ClipboardList, exact: false },
    { href: "/inventario/perdas", label: "Perdas", icon: TriangleAlert, exact: false },
  ].filter(filho => podeRota(filho.href));
  return <GrupoNavegacao titulo="Estoque" icon={Warehouse} itens={filhos} pathname={pathname} podeRota={podeRota} href={filhos[0]?.href} />;
}

function NavegacaoBancos({ pathname, podeRota }: { pathname: string; podeRota: (rota: string) => boolean }) {
  const filhos = [
    { href: "/financeiro/bancario", label: "Contas e cartões", icon: Landmark, exact: true },
    { href: "/financeiro/cartoes", label: "Faturas", icon: CreditCard, exact: false },
  ].filter(filho => podeRota(filho.href));
  return <GrupoNavegacao titulo="Bancos" icon={Landmark} itens={filhos} pathname={pathname} podeRota={podeRota} href={filhos[0]?.href} />;
}

function NavegacaoCentralDesign({ pathname }: { pathname: string }) {
  const filhos = [
    { href: "/configuracoes/design/fundamentos", label: "Fundamentos", icon: Palette },
    { href: "/configuracoes/design/componentes", label: "Componentes", icon: ListTree },
    { href: "/configuracoes/design/gestao", label: "Gestão", icon: Settings },
  ];
  return <GrupoNavegacao titulo="Central de Design" icon={Palette} itens={filhos} pathname={pathname} podeRota={() => true} href="/configuracoes/design" />;
}

export function Sidebar({ usuarioId }: { usuarioId?: string }) {
  return <MenuLateral usuarioId={usuarioId}><ConteudoMenuLateral /></MenuLateral>;
}
