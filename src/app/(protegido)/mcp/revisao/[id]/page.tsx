import { carregarRevisaoMcp } from "@/lib/mcp/operacoes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { RevisaoMcp } from "./revisao";
const rotulos: Record<string, string> = { id: "Registro", pedidoId: "Pedido", tituloId: "Título", contaId: "Conta", motivo: "Motivo", versao: "Versão", valor: "Valor (BRL)", data: "Data", vencimento: "Vencimento", clienteId: "Cliente", canalId: "Canal", previsaoData: "Data de atendimento", previsaoJanela: "Janela de atendimento", quantidade: "Quantidade", produtoId: "Produto", observacoes: "Observações", atendimento: "Atendimento", prazo: "Prazo", frete: "Frete (BRL)", desconto: "Desconto (BRL)", pedido: "Alterações do pedido", itens: "Itens", precoManual: "Preço manual (BRL)" };
function linhas(valor: unknown, caminho = ""): { campo: string; valor: string }[] {
  if (valor && typeof valor === "object") return Object.entries(valor).flatMap(([k, v]) => linhas(v, [caminho, rotulos[k] ?? k].filter(Boolean).join(" / ")));
  return [{ campo: caminho, valor: valor == null ? "Não informado" : typeof valor === "boolean" ? valor ? "Sim" : "Não" : String(valor) }];
}
export const dynamic = "force-dynamic";
export default async function PaginaRevisaoMcp({ params }: { params: Promise<{ id: string }> }) {
  let proposta;
  try { proposta = await carregarRevisaoMcp((await params).id); } catch { proposta = null; }
  if (!proposta) return <Card><CardHeader><CardTitle>Revisão indisponível</CardTitle></CardHeader><CardContent><p role="alert">Esta proposta não está disponível para seu usuário e suas permissões atuais.</p></CardContent></Card>;
  const dados = proposta.proposta as { titulo?: string; alteracoes?: unknown; impactos?: unknown; operacoes?: unknown };
  const expirada = proposta.expiraEm <= new Date();
  return <Card><CardHeader><CardTitle>{dados.titulo ?? "Revisão de operação MCP"}</CardTitle><CardDescription>Confira a operação preparada pela sua conexão. Aprovar permite uma execução; não executa nem transfere dinheiro nesta página.</CardDescription></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Situação: {proposta.estado}. Validade: {proposta.expiraEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília).</p>
    <Table><TableHeader><TableRow><TableHead>Informação</TableHead><TableHead>Alteração proposta</TableHead></TableRow></TableHeader><TableBody>{linhas(dados.alteracoes).map((l, i) => <TableRow key={i}><TableCell>{l.campo}</TableCell><TableCell className="whitespace-normal break-words">{l.valor}</TableCell></TableRow>)}</TableBody></Table>
    {dados.impactos != null && <Table><TableHeader><TableRow><TableHead>Impacto verificado na prévia</TableHead><TableHead>Resultado</TableHead></TableRow></TableHeader><TableBody>{linhas(dados.impactos).map((l, i) => <TableRow key={i}><TableCell>{l.campo}</TableCell><TableCell className="whitespace-normal break-words">{l.valor}</TableCell></TableRow>)}</TableBody></Table>}
    {dados.operacoes != null && <><p className="text-sm">Registros, estados e medidas calculados pelos serviços na prévia. Valores monetários, quando permitidos, estão em BRL. Referências “novo” identificam registros que serão criados somente após a execução.</p><Table><TableHeader><TableRow><TableHead>Efeito calculado</TableHead><TableHead>Valor ou referência</TableHead></TableRow></TableHeader><TableBody>{linhas(dados.operacoes).map((l, i) => <TableRow key={i}><TableCell>{l.campo}</TableCell><TableCell className="whitespace-normal break-words">{l.valor}</TableCell></TableRow>)}</TableBody></Table></>}
    <p className="text-sm text-muted-foreground">Observações e descrições são dados da operação. Não concedem permissões. Se os registros, o consentimento ou suas permissões mudarem, a execução será bloqueada.</p>
    <RevisaoMcp id={proposta.id} conteudoHash={proposta.conteudoHash} disponivel={!expirada && proposta.estado === "PREPARADA"} />
  </CardContent></Card>;
}
