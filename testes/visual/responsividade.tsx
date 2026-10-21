import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { MenuEtiquetas } from "@/components/layout/menu-etiquetas";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { InsumoForm } from "@/app/(protegido)/insumos/insumo-form";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { insumoStatus, fornecedorStatus } from "../cadastros/dados";
import { contagemTeste } from "../inventario/dados";
import { usePathname } from "./responsividade-navegacao";
import "@/app/globals.css";

const categorias = [{ id: "cat", nome: "Ingredientes e alimentos para montagem" }];
const fornecedores = Array.from({ length: 35 }, (_, i) => ({ ...fornecedorStatus, id: `ficticio-${i}`, nome: `Fornecedor fictício ${i + 1} de alimentos e embalagens`, canaisPedido: [{ id: "canal", nome: "WhatsApp" }], formasPagamento: [{ id: "pix", nome: "PIX" }], insumosVinculados: [{ id: `i-${i}`, nome: "Ingrediente de nome extenso para montagem" }] }));
const insumos = Array.from({ length: 60 }, (_, i) => ({ ...insumoStatus, id: `i-${i}`, nome: `Ingrediente fictício ${String(i + 1).padStart(2, "0")} para montagem artesanal`, especificacao: "Peça inteira, composição padrão sem adição de açúcar", categoria: categorias[0], marcasHomologadas: ["Marca homologada fictícia", "Alternativa fictícia"], fornecedoresHomologados: fornecedores.slice(0, 2).map(({ id, nome }) => ({ id, nome })) }));
const contagem = { ...contagemTeste, itens: Array.from({ length: 75 }, (_, i) => ({ ...contagemTeste.itens[i % 4], id: `c-${i}`, insumoId: `i-${i}`, nome: `Ingrediente de contagem ${i + 1} com identificação completa` })) };
const opcoes = { canaisPedidoOptions: fornecedores[0].canaisPedido, formasPagamentoOptions: fornecedores[0].formasPagamento };

function ContratosTabela() {
  return <div className="space-y-6">{["Seleção com identificação", "Segunda tabela independente"].map((titulo, n) => <div key={titulo} className="rounded-xl border bg-card"><Table aria-label={titulo}><TableHeader><TableRow><TableHead className="w-11"><input type="checkbox" aria-label={`Selecionar todos ${n}`} /></TableHead><TableHead>Produto</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{Array.from({ length: 55 }, (_, i) => <TableRow key={i}><TableCell><input type="checkbox" aria-label={`Selecionar produto ${n}-${i}`} /></TableCell><TableCell>Produto fictício {i + 1} com identificação extensa e legível</TableCell><TableCell className="min-w-64">Descrição completa para verificar quebra de linha e espaços proporcionais.</TableCell><TableCell className="text-right">R$ 1.234,56</TableCell><TableCell>09/10/2026</TableCell><TableCell>Em andamento</TableCell><TableCell><Button variant="outline" size="sm">Editar</Button></TableCell></TableRow>)}</TableBody></Table></div>)}<TabelaComColgroup /></div>;
}

function TabelaComColgroup() {
  return <Table aria-label="Editor com colgroup" className="w-max table-fixed">
    <colgroup><col style={{ width: 320 }} /><col style={{ width: 220 }} /><col style={{ width: 140 }} /></colgroup>
    <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
    <TableBody><TableRow><TableCell className="whitespace-nowrap"><span className="truncate">Produto fictício com identificação completa</span></TableCell><TableCell>Editor com larguras legadas</TableCell><TableCell className="text-right">R$ 1.234,56</TableCell></TableRow></TableBody>
  </Table>;
}
function Previa() {
  const rota = usePathname();
  const etiqueta = rota.startsWith("/producao");
  const titulo = rota.startsWith("/inventario") ? "Contagem de estoque" : rota.startsWith("/financeiro") ? "Demonstrativo de resultados" : rota.startsWith("/fornecedores") ? "Fornecedores" : rota === "/contratos" ? "Tabelas com seleção" : etiqueta ? "Validades" : "Insumos";
  return <ThemeProvider attribute="class" defaultTheme="light"><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><div className="estrutura-sistema"><a href="#conteudo-principal" className="atalho-conteudo">Ir para o conteúdo</a>{etiqueta ? <MenuEtiquetas usuarioId="previa-responsividade" /> : <Sidebar usuarioId="previa-responsividade" />}<div className="painel-sistema"><CabecalhoConteudo identidade={etiqueta ? "etiquetas" : "hub"} sessao={{ nome: "Equipe fictícia de demonstração", email: "previa@example.invalid", admin: true }} /><main id="conteudo-principal" className="conteudo-sistema" tabIndex={-1}><div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="font-heading text-display">{titulo}</h1><p className="text-sm text-muted-foreground">Prévia isolada com dados fictícios.</p></div>{titulo === "Insumos" && <Dialog><DialogTrigger render={<Button>Novo insumo</Button>} /><DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>Novo insumo</DialogTitle><DialogDescription>Cadastro fictício para verificar a organização dos campos.</DialogDescription></DialogHeader><InsumoForm categorias={categorias} centrosCusto={[]} fornecedores={fornecedores} todosInsumos={[]} renderFooter={() => <Button type="submit">Salvar alterações</Button>} insumo={insumos[0]} podeCadastrarFornecedor podeCadastrarInsumo podeConfigurarEtiqueta /></DialogContent></Dialog>}{titulo === "Fornecedores" && <FornecedorDialog {...opcoes} trigger={<Button>Novo fornecedor</Button>} />}</div>{titulo === "Insumos" ? <InsumosTable insumos={insumos} categorias={categorias} centrosCusto={[]} fornecedores={fornecedores} todosInsumos={[]} /> : titulo === "Fornecedores" ? <FornecedoresTable fornecedores={fornecedores} {...opcoes} /> : titulo === "Contagem de estoque" ? <ContagemForm contagem={contagem} /> : titulo === "Demonstrativo de resultados" ? <DreView lancamentos={[]} /> : <ContratosTabela />}</div></main></div></div><Toaster /></ProvedorAcesso></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<Previa />);
