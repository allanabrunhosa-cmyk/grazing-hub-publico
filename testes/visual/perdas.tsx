import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { PerdaDialog } from "@/app/(protegido)/inventario/perdas/perda-dialog";
import { PerdasTable } from "@/app/(protegido)/inventario/perdas/perdas-table";
import type { PerdaExcluidaRow, PerdaRow } from "@/app/(protegido)/inventario/types";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

const linhas: PerdaRow[] = [
  { id: "perda-1", insumoNome: "Queijo brie", localNome: "Câmara fria", motivo: "OUTRO", motivoPersonalizado: "Falha no equipamento de refrigeração durante a madrugada", data: "2026-09-11T12:00:00Z", quantidade: 1.25, unidade: "KG", valorEstimado: 89.9, observacao: "Produto descartado após conferência da equipe.", responsavelNome: "Mariana de Souza" },
  { id: "perda-2", insumoNome: "Pote para salada 500 ml", localNome: "Estoque de embalagens", motivo: "QUEBRA", motivoPersonalizado: null, data: "2026-09-10T12:00:00Z", quantidade: 8, unidade: "UN", valorEstimado: 12.5, observacao: null, responsavelNome: "João da Silva" },
  { id: "perda-3", insumoNome: "Tomate cereja", localNome: "Câmara fria", motivo: "VALIDADE_VENCIDA", motivoPersonalizado: null, data: "2026-09-09T12:00:00Z", quantidade: 0.75, unidade: "KG", valorEstimado: 10.9, observacao: null, responsavelNome: null },
];
const historico: PerdaExcluidaRow[] = [{ ...linhas[0], id: "excluida-1", motivo: "ERRO_PRODUCAO", motivoPersonalizado: null, quantidade: 0.5, valorEstimado: 36, observacao: "Separação da produção da manhã.", excluidaEm: "2026-09-11T15:30:00Z", motivoExclusao: "Registro duplicado. A perda já havia sido documentada pela equipe no turno anterior.", responsavelExclusaoNome: "Allan Abrunhosa", quantidadeEstornada: 0.5, unidadeEstornada: "KG" }];
const parametros = new URLSearchParams(window.location.search);
const admin = !parametros.has("usuario");

createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
  <div className="estrutura-sistema"><Sidebar /><div className="painel-sistema"><CabecalhoConteudo sessao={{ nome: "Allan Abrunhosa", email: "equipe@example.com", admin }} /><main className="conteudo-sistema">
    <p className="mb-4 text-xs text-muted-foreground">Prévia com dados fictícios. Ações simuladas, sem gravação.</p>
    <div className="mb-6"><h1 className="text-2xl font-semibold">Registro de perdas</h1><p className="text-sm text-muted-foreground">Documente as baixas e consulte os registros de perdas.</p></div>
    <PerdasTable linhas={parametros.has("vazio") ? [] : parametros.has("zero") ? linhas.map(linha => ({ ...linha, valorEstimado: 0 })) : linhas} historico={admin ? historico : undefined} responsavelNome="Allan Abrunhosa" acaoRegistrar={<PerdaDialog responsavelNome="Allan Abrunhosa" insumos={linhas.map((linha) => ({ id: linha.id, nome: linha.insumoNome, unidade: linha.unidade, custoMedio: 71.92 }))} locais={[{ id: "local", nome: "Câmara fria" }]} insumoIdPreselecionado="perda-1" trigger={<Button size="sm" className="h-10! bg-red-600 text-white hover:bg-red-700">Registrar perda</Button>} />} />
  </main></div></div><Toaster />
</ThemeProvider>);
