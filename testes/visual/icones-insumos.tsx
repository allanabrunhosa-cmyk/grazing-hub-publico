import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { InsumoDialog } from "@/app/(protegido)/insumos/insumo-dialog";
import { Button } from "@/components/ui/button";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import "@/app/globals.css";
const insumo: InsumoRow = { id: "insumo", nome: "Farinha de trigo", tipo: "INSUMO", unidade: "KG", marca: null, codigoEan: null, perecivel: false, validadePadraoDias: null, estoqueMinimo: 0, estoqueMaximo: null, custoMedio: 5, fornecedorPrincipalId: null, tipoEstoque: "SECO", observacoes: null, rendimentoQuantidade: null, rendimentoUnidade: null, ativo: true, createdAt: new Date(), updatedAt: new Date(), categoria: null, centroCusto: null, fornecedorPrincipal: null, fornecedoresHomologados: [], componentes: [], temFoto: false, conversoes: [] };
const insumos: InsumoRow[] = [insumo, { ...insumo, id: "preparacao", nome: "Massa artesanal", tipo: "PRODUTO_INTERMEDIARIO", custoUnitarioPreparacao: 2.5, rendimentoQuantidade: 1, rendimentoUnidade: "KG", modoPreparo: ["Misture os ingredientes", "Sove até obter uma massa lisa"], componentes: [{ componenteId: "insumo", nome: "Farinha de trigo", tipo: "INSUMO", unidade: "KG", quantidade: 0.5, observacaoPorcao: "4 xícaras" }] }];
const opcoes = {
  categorias: [],
  centrosCusto: [],
  fornecedores: [],
  todosInsumos: insumos.map(({ id, nome, tipo, unidade, custoMedio, custoUnitarioPreparacao }) => ({ id, nome, tipo, unidade, custoMedio, custoUnitario: tipo === "INSUMO" ? custoMedio : custoUnitarioPreparacao })),
};
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem><div className="estrutura-sistema"><Sidebar /><div className="painel-sistema"><CabecalhoConteudo sessao={{ nome: "Equipe Grazing", email: "equipe@example.com", admin: true }} /><main className="conteudo-sistema space-y-6"><p className="text-xs text-muted-foreground">Prévia com dados fictícios. Ações simuladas, sem gravação.</p><div className="flex items-center justify-between"><h1 className="font-heading text-display">Insumos</h1><InsumoDialog {...opcoes} podeConfigurarEtiqueta trigger={<Button>Novo</Button>} /></div><InsumosTable insumos={insumos} {...opcoes} podeConfigurarEtiqueta /></main></div></div></ThemeProvider>);
