import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { validarPedidoOAuth } from "@/lib/mcp/oauth";
import { exigirMcpAtivo, escoposParaConsentimento, INCLUIR_AUTORIZACAO, revisaoConsentimento } from "@/lib/mcp/servidor";
import { retornoOAuthLogin } from "@/lib/mcp/retorno-login";
import { FUNCOES_MCP } from "@/lib/mcp/catalogo";
import { RestricoesSchema } from "@/lib/mcp/politica";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConsentimentoMcp } from "./consentimento";
export const dynamic = "force-dynamic";

export default async function AutorizarMcpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const id = retornoOAuthLogin(query.solicitacao);
  let erro = "";
  try {
    await exigirMcpAtivo();
    if (!id) erro = "Inicie a conexão OAuth pelo cliente para abrir o consentimento.";
  } catch { erro = "Solicitação indisponível. Confira a configuração OAuth e a situação do MCP com o administrador."; }
  if (erro || !id) return <main className="mx-auto w-full max-w-2xl p-6"><Card><CardHeader><CardTitle>Não foi possível iniciar a autorização</CardTitle></CardHeader><CardContent><p role="alert">{erro}</p></CardContent></Card></main>;
  const sessao = await getSession();
  if (!sessao) redirect(`/login?retornoOAuth=${id}`);
  if (query.solicitacao !== id) redirect(`/oauth/autorizar?solicitacao=${id}`);
  const solicitacao = await prisma.mcpSolicitacaoOAuth.findUnique({ where: { id } });
  if (!solicitacao || solicitacao.consumidaEm || solicitacao.expiraEm <= new Date()) return <main className="p-6"><p role="alert">Solicitação expirada ou já utilizada. Reinicie a conexão no cliente.</p></main>;
  let pedido;
  try { pedido = await validarPedidoOAuth(solicitacao.parametros); } catch { return <main className="p-6"><p role="alert">Aplicação indisponível. Reinicie a conexão.</p></main>; }
  const solicitados = pedido.parametros.scope.split(" ");
  const politicas = (await prisma.mcpAutorizacao.findMany({ where: { usuarioId: sessao.userId, clienteId: pedido.cliente.id, situacao: { in: ["PREPARADA", "ATIVA"] }, lojaId: "singleton" }, include: INCLUIR_AUTORIZACAO }))
    .filter(a => escoposParaConsentimento(a).some(s => solicitados.includes(s)))
    .map(a => { const r = RestricoesSchema.parse(a.restricoes); return { id: a.id, nome: a.nome, revisao: revisaoConsentimento(a), escopos: escoposParaConsentimento(a).filter(s => solicitados.includes(s)), detalhe: `Perfil do HUB: ${a.usuario.perfilAcesso?.nome ?? "Sem perfil"}; ${r.contas === null ? "contas permitidas no HUB" : `${r.contas.length} conta(s)`}; ${r.lancamentos === null ? "registros financeiros permitidos" : `${r.lancamentos.length} lançamento(s)`}` }; });
  return <main className="mx-auto w-full max-w-2xl p-6"><Card><CardHeader><CardTitle>Autorizar acesso ao Grazing HUB</CardTitle><CardDescription>Responsável: {sessao.nome}. Empresa desta instalação do HUB.</CardDescription></CardHeader><CardContent className="space-y-5">
    <div className="space-y-1 text-sm"><p>Aplicação cadastrada: <strong>{pedido.cliente.nome}</strong></p><p className="break-all">Identificador: {pedido.cliente.id}</p><p className="break-all">Destino do retorno: {pedido.parametros.redirect_uri}</p><p className="text-muted-foreground">O nome amigável não comprova a identidade da aplicação. Confira o identificador e o destino.</p></div>
    <p className="text-sm text-muted-foreground">A aplicação solicita: {FUNCOES_MCP.filter(f => solicitados.includes(f.escopo)).map(f => f.titulo).join(", ")}. Somente as funções permitidas pela política escolhida abaixo serão consentidas.</p>
    {!politicas.length && <p role="alert" className="text-sm text-destructive">Nenhuma política preparada para você permite as funções solicitadas. O administrador precisa preparar a política; suas permissões centrais continuam obrigatórias.</p>}
    <ConsentimentoMcp solicitacao={id} politicas={politicas} />
  </CardContent></Card></main>;
}
