import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { UsuariosPermissoes } from "@/app/(protegido)/configuracoes/usuarios/usuarios-permissoes";
import { Toaster } from "@/components/ui/sonner";
import type { AtividadeRow, DetalheAtividade, PaginaAtividades } from "@/lib/atividades/types";
import { dados } from "./usuarios-acoes";
import "@/app/globals.css";

const dadosSinteticos = { ...dados, usuarios: dados.usuarios.map((u, i) => ({ ...u, nome: `Pessoa fictícia ${i + 1}`, email: `pessoa${i + 1}@example.invalid` })) };

// Esta prévia responde apenas a leituras fictícias; não utiliza o banco nem APIs de negócio.
const eventos: AtividadeRow[] = [
  { id: "evento-1", data: "2026-10-10T16:12:00Z", autor: "Marina fictícia", atorTipo: "USUARIO", origem: "INTERFACE", modulo: "pedidos", acao: "CONFIRMAR", entidade: "PedidoVenda", resumo: "Pedido confirmado", resultado: "SUCESSO" },
  { id: "evento-2", data: "2026-10-10T15:02:00Z", autor: "Marina fictícia", atorTipo: "USUARIO", origem: "MCP", modulo: "cadastros", acao: "EDITAR", entidade: "Fornecedor", resumo: "Cadastro de fornecedor atualizado", resultado: "SUCESSO" },
  { id: "evento-3", data: "2026-10-09T19:47:00Z", autor: "Marina fictícia", atorTipo: "USUARIO", origem: "INTERFACE", modulo: "etiquetas", acao: "SOLICITAR_IMPRESSAO", entidade: "TrabalhoEtiqueta", resumo: "Solicitação de impressão de etiquetas registrada", resultado: "SOLICITADO" },
  { id: "evento-4", data: "2026-10-09T12:30:00Z", autor: "Marina fictícia", atorTipo: "USUARIO", origem: "API", modulo: "estoque", acao: "CONTAGEM", entidade: "InventarioContagem", resumo: "Contagem de estoque finalizada", resultado: "SUCESSO" },
];
window.fetch = async (entrada, opcoes) => {
  if (opcoes?.signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  const url = new URL(String(entrada), window.location.origin);
  if (!url.pathname.startsWith("/api/usuarios/")) throw new Error("Somente consulta simulada de atividades nesta prévia.");
  const eventoId = url.pathname.split("/").at(-1);
  if (eventoId !== "atividades") {
    const evento = eventos.find(e => e.id === eventoId) ?? eventos[0];
    const detalhe: DetalheAtividade = { evento, alteracoes: [{ campo: "Situação", antes: "Em revisão", depois: "Confirmado" }, { campo: "Data de entrega", antes: "10/10/2026", depois: "11/10/2026" }], link: null, referenciaDisponivel: true };
    return new Response(JSON.stringify(detalhe), { headers: { "Content-Type": "application/json" } });
  }
  const lista = url.searchParams.get("perspectiva") === "cadastro"
    ? [{ ...eventos[0], id: "cadastro-1", autor: "Gestora fictícia", modulo: "acessos", acao: "ALTERAR_PERFIL", entidade: "Usuario", resumo: "Perfil do usuário atualizado" }]
    : eventos.filter(e => (!url.searchParams.get("modulo") || e.modulo === url.searchParams.get("modulo")) && (!url.searchParams.get("resultado") || e.resultado === url.searchParams.get("resultado")) && (!url.searchParams.get("origem") || e.origem === url.searchParams.get("origem")) && (!url.searchParams.get("acao") || e.acao.includes(url.searchParams.get("acao")!)));
  const pagina: PaginaAtividades = { eventos: lista, proximoCursor: null, inicioCobertura: "2026-10-01T12:00:00Z" };
  return new Response(JSON.stringify(pagina), { headers: { "Content-Type": "application/json" } });
};
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem><main className="min-h-dvh bg-background p-4 sm:p-6"><UsuariosPermissoes inicial={dadosSinteticos} podeVerAtividades /><Toaster /></main></ThemeProvider>);
