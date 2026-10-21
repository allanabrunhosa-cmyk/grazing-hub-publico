import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { HOST_PEDIDOS } from "@/lib/hosts";
import { listarPedidos } from "@/lib/vendas/pedidos";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { TagCanalVenda } from "@/components/tag-canal-venda";
import { Eye } from "lucide-react";
import { rotaPopupPedido } from "../pedidos-navegacao";

export default async function PedidosCancelados({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirPermissao("vendas.pedidos");
  const { pagina } = await searchParams;
  if (await identidadeDaInterface() !== "pedidos") redirect(`https://${HOST_PEDIDOS}/vendas/pedidos/cancelados`);
  const resultado = await listarPedidos({ status: "CANCELADO", ordem: "data-asc", pagina: Number(pagina) || 1 });
  const retorno = `/vendas/pedidos/cancelados${resultado.pagina > 1 ? `?pagina=${resultado.pagina}` : ""}`;
  return <div className="space-y-4"><BarraAcoes titulo="Pedidos cancelados" descricao="Do pedido mais antigo para o mais recente."><Button variant="outline" nativeButton={false} render={<Link href="/vendas/pedidos" />}>Voltar aos pedidos</Button></BarraAcoes><Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Canal</TableHead><TableHead>Total</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader><TableBody>{resultado.pedidos.map(p => <TableRow key={p.id}><TableCell>#{p.numero}</TableCell><TableCell>{new Date(p.criadoEm).toLocaleString("pt-BR", { timeZone: p.fusoHorario })}</TableCell><TableCell>{p.cliente}</TableCell><TableCell><TagCanalVenda canal={p.canal} /></TableCell><TableCell className="tabular-nums">{Number(p.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell><TableCell><Button variant="ghost" size="icon-sm" nativeButton={false} aria-label={`Ver pedido cancelado #${p.numero}`} render={<Link href={rotaPopupPedido(`/vendas/pedidos/${p.id}`, retorno)} />}><Eye /></Button></TableCell></TableRow>)}{!resultado.pedidos.length && <TableRow><TableCell colSpan={6}>Nenhum pedido cancelado.</TableCell></TableRow>}</TableBody></Table><GrupoAcoes nome="Paginação dos cancelados"><Button nativeButton={false} variant="outline" disabled={resultado.pagina <= 1} render={<Link href={`?pagina=${resultado.pagina - 1}`} />}>Anterior</Button><span className="text-sm">{resultado.pagina} de {Math.max(1, resultado.paginas)}</span><Button nativeButton={false} variant="outline" disabled={resultado.pagina >= resultado.paginas} render={<Link href={`?pagina=${resultado.pagina + 1}`} />}>Próxima</Button></GrupoAcoes></div>;
}
