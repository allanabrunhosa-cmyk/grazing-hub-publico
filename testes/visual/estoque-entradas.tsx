import { MovimentacoesTable } from "@/app/(protegido)/inventario/movimentacoes/movimentacoes-table";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Tabs, TabsList, TabsTriggerBotao, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EntradaAvulsaForm } from "@/app/(protegido)/inventario/entrada-avulsa/entrada-avulsa-form";
import { EntradaAvulsaDetalhe } from "@/app/(protegido)/inventario/entradas/entrada-avulsa-detalhe";
import { EntradasHistorico } from "@/app/(protegido)/inventario/entradas/entradas-historico";
import { MovimentacoesItem } from "@/app/(protegido)/insumos/movimentacoes-item";
import { InsumoDialog } from "@/app/(protegido)/insumos/insumo-dialog";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { insumoStatus } from "../cadastros/dados";
import { detalhe, insumos, locais, linhaHistorico } from "./estoque-entradas-dados";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";
import { gerarCssTema } from "@/lib/design-system/gerar-css";
import "@/app/globals.css";
const modo = new URLSearchParams(location.search).get("modo") ?? "entrada";
Object.assign(window, { auditarEstoque: () => auditarInterface(document) });
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem><style>{gerarCssTema()}</style><main className="mx-auto max-w-7xl space-y-4 p-4"><p className="text-xs text-muted-foreground">Prévia com dados fictícios, sem gravação.</p>
  {modo === "lista-movimentos" && <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><MovimentacoesTable linhas={[]} /></ProvedorAcesso>}
  {modo === "entrada" && <EntradaAvulsaForm insumos={insumos} locais={locais} fornecedores={[{ id: "fornecedor", nome: "FORNECEDOR FICTÍCIO" }]} contasBancarias={[]} insumoIdPreselecionado="brie" />}
  {(modo === "cadastro" || modo === "preparacao") && <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><InsumoDialog insumo={{ ...insumoStatus, id: "brie", nome: "Item fictício para conferência", tipo: modo === "preparacao" ? "PRODUTO_INTERMEDIARIO" : "INSUMO" }} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} trigger={<Button>Abrir cadastro</Button>} /></ProvedorAcesso>}
  {modo === "detalhe" && <EntradaAvulsaDetalhe detalhe={detalhe} insumos={insumos} locais={locais} podeEditar />}
  {modo.startsWith("historico") && <EntradasHistorico filtros={{ de: "2026-10-01", ate: "2026-10-12" }} podeAdicionar podeEditar podeExcluir dados={modo === "historico-erro" ? null : { linhas: modo === "historico-vazio" ? [] : [{ ...linhaHistorico, situacao: "Registrada" }], total: modo === "historico-vazio" ? 0 : 1, pagina: 1, paginas: 1, responsaveis: [detalhe.responsavel] }} />}
  {modo === "movimentos" && <Card><CardContent><Tabs defaultValue="movimentacoes"><TabsList variant="buttons" aria-label="Detalhes do item fictício"><TabsTriggerBotao value="dados">Dados do item</TabsTriggerBotao><TabsTriggerBotao value="movimentacoes">Movimentações</TabsTriggerBotao></TabsList><TabsContent value="dados">{insumos[0].nome}</TabsContent><TabsContent value="movimentacoes"><MovimentacoesItem insumoId="brie" unidade="kg" /></TabsContent></Tabs></CardContent></Card>}
</main></ThemeProvider>);
