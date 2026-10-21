import { createRoot } from "react-dom/client";
import { Plus } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";
import { NotaFiscalDialog } from "@/app/(protegido)/notas-fiscais/nota-fiscal-dialog";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { findModuleByPathname } from "@/lib/modules";
import { notaTeste, opcoesTeste } from "../notas-fiscais/dados";
import { contagemTeste } from "../inventario/dados";
import { usePathname } from "./layout-navegacao";
import { Toaster } from "@/components/ui/sonner";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CAMINHO_PEDIDOS, HOST_ATENDIMENTO, HOST_PEDIDOS } from "@/lib/hosts";
import "@/app/globals.css";

const fornecedores: FornecedorRow[] = ["Laticínios Serra", "Armazém Central", "Padaria do Bairro"].map((nome, indice) => ({
  id: `fornecedor-${indice}`, tipoCadastro: "FORNECEDOR", nome, razaoSocial: `${nome} Comércio de Alimentos`, cnpj: null, cpf: null,
  contatoNome: "Equipe de atendimento", email: "contato@example.com", telefone: "(11) 0000-0000", site: null,
  prazoPagamentoDias: 14, prazoEntregaDias: 2, observacoes: "Entregas pela manhã. Confirmar disponibilidade antes do pedido.",
  ativo: true, createdAt: new Date(), updatedAt: new Date(), canaisPedido: [{ id: "canal", nome: "WhatsApp" }],
  formasPagamento: [{ id: "forma", nome: "Boleto" }], insumosVinculados: [{ id: "queijo", nome: "Queijo brie" }],
}));
fornecedores.push({
  id: "beneficiario-visual", tipoCadastro: "BENEFICIARIO", nome: "Marina Oliveira", razaoSocial: null,
  cnpj: null, cpf: "12345678901", contatoNome: null, email: null, telefone: "(11) 99999-1234", site: null,
  prazoPagamentoDias: null, prazoEntregaDias: null, observacoes: null, ativo: true, createdAt: new Date(), updatedAt: new Date(),
  canaisPedido: [], formasPagamento: [{ id: "pix", nome: "PIX" }], insumosVinculados: [],
});
const opcoes = { canaisPedidoOptions: fornecedores[0].canaisPedido, formasPagamentoOptions: fornecedores[0].formasPagamento };

function PreviaLayout() {
  const rota = usePathname();
  const titulo = rota.startsWith("/vendas") ? "Vendas & CRM" : rota.startsWith("/financeiro") ? "Demonstrativo de resultados" : rota.startsWith("/inventario") ? "Contagem de estoque" : rota === "/notas-fiscais" ? "Manifesto de Notas" : "Fornecedores";
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <div className="estrutura-sistema">
      <a href="#conteudo-principal" className="atalho-conteudo">Ir para o conteúdo</a>
      <Sidebar />
      <div className="painel-sistema">
        <CabecalhoConteudo sessao={{ nome: "Equipe Grazing", email: "equipe@example.com", admin: true }} />
        <main id="conteudo-principal" tabIndex={-1} className="conteudo-sistema">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h1 className="font-heading text-display">{titulo}</h1><p className="text-sm text-muted-foreground">Prévia visual com dados fictícios, sem gravação no banco.</p></div>
              {rota === "/fornecedores" && <FornecedorDialog {...opcoes} trigger={<Button><Plus className="size-4" />Novo</Button>} />}
            </div>
            {rota.startsWith("/vendas") ? <div className="flex flex-wrap gap-3">
              <a href={`https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}`} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>Abrir gestor de pedidos<ArrowUpRight aria-hidden="true" className="size-4" /></a>
              <a href={`https://${HOST_ATENDIMENTO}`} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>Atendimento<ArrowUpRight aria-hidden="true" className="size-4" /></a>
            </div> : rota === "/fornecedores" ? <>
              <div className="grid gap-4 sm:grid-cols-3"><KpiCard label="Fornecedores cadastrados" value="3" /><KpiCard label="Fornecedores ativos" value="3" badge="100%" /><KpiCard label="Prazo médio de entrega" value="2 dias" /></div>
              <FornecedoresTable fornecedores={fornecedores} {...opcoes} />
            </> : rota.startsWith("/financeiro") ? <DreView lancamentos={[]} />
              : rota.startsWith("/inventario") ? <ContagemForm contagem={contagemTeste} />
              : rota === "/notas-fiscais" ? <NotaFiscalDialog nota={notaTeste} {...opcoesTeste} trigger={<Button>Ver nota</Button>} />
              : <ModuleComingSoon module={findModuleByPathname(rota)} />}
          </div>
        </main>
      </div>
    </div><Toaster />
  </ProvedorAcesso></ThemeProvider>;
}

createRoot(document.getElementById("root")!).render(<PreviaLayout />);
