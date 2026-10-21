import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { PedidosView } from "@/app/(protegido)/compras/pedidos-view";
import type { PedidoRow } from "@/app/(protegido)/compras/types";
import { Toaster } from "@/components/ui/sonner";
import { dataISO } from "@/app/(protegido)/compras/calendario";
import "@/app/globals.css";
const hoje = new Date();
const nomes = ["Laticínios Serra", "Armazém Central", "Padaria do Bairro", "Papelaria São Paulo", "Distribuidora de Alimentos", "Hortifruti da Vila"];
const pedidos: PedidoRow[] = nomes.map((nome, i) => ({
  id: "pedido-" + i, numero: 120 + i, fornecedorId: i === 3 ? null : "fornecedor-" + i, fornecedorNome: nome,
  fornecedorAvulso: i === 3 ? nome : null, usoConsumo: i === 3,
  dataPedido: hoje.toISOString(), previsaoEntrega: dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + (i === 1 ? -1 : i > 3 ? 1 : 0))) + "T12:00:00.000Z",
  status: i === 0 || i === 2 ? "RECEBIDO_TOTAL" : "CONFIRMADO", observacoes: null, temDivergencia: i === 2,
  itens: [{ id: "item-" + i, insumoId: i === 3 ? null : "insumo", insumoNome: i === 3 ? "Material de escritório" : "Queijo brie", unidadeCompra: "UN", quantidade: 3, precoUnitario: 30, precoTotal: 90 }],
  recebimentos: i === 0 || i === 2 ? [{ id: "recebimento-" + i, dataRecebimento: hoje.toISOString(), tipo: "TOTAL", responsavelNome: "Equipe Grazing", itens: [] }] : [], historico: [],
}));
for (let i = 0; i < 10; i++) pedidos.push({ ...pedidos[0], id: "lotado-" + i, numero: 200 + i, fornecedorNome: "Fornecedor " + (i + 1), status: "CONFIRMADO", recebimentos: [] });
pedidos.push({ ...pedidos[2], id: "excluido", numero: 88, fornecedorNome: "Fornecedor arquivado", excluidoEm: hoje.toISOString(), historico: [{ id: "hist-exclusao", acao: "EXCLUSAO", statusAnterior: "RECEBIDO_TOTAL", statusNovo: "RECEBIDO_TOTAL", motivo: "Pedido excluído da lista e do calendário. Histórico preservado.", usuarioNome: "Equipe Grazing", criadoEm: hoje.toISOString() }] });
createRoot(document.getElementById("root")!).render(<ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><ThemeProvider attribute="class" defaultTheme="light" enableSystem><div className="estrutura-sistema"><Sidebar /><div className="painel-sistema"><CabecalhoConteudo sessao={{ nome: "Equipe Grazing", email: "equipe@example.com", admin: true }} /><main className="conteudo-sistema"><p className="mb-4 text-xs text-muted-foreground">Prévia com dados fictícios. Ações simuladas, sem gravação.</p><PedidosView pedidos={pedidos} fornecedores={nomes.map((nome, i) => ({ id: "fornecedor-" + i, nome }))} insumos={[{ id: "insumo", nome: "Queijo brie", unidade: "UN", custoMedio: 30, fornecedorPrincipalId: "fornecedor-0", fornecedorIds: nomes.map((_, i) => "fornecedor-" + i) }]} cotacoes={[]} /></main></div></div><Toaster /></ThemeProvider></ProvedorAcesso>);
