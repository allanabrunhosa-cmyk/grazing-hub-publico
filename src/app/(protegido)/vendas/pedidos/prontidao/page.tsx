import Link from "next/link";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarProntidaoProdutos } from "@/lib/vendas/pedidos-prontidao";
import { redirect } from "next/navigation";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { retornoGestorSeguro } from "../pedidos-navegacao";

export default async function ProntidaoPage({ searchParams }: { searchParams: Promise<{ retorno?: string }> }) {
  await exigirPermissao("vendas.pedidos");
  if (await identidadeDaInterface() === "pedidos") redirect(retornoGestorSeguro((await searchParams).retorno));
  await exigirPermissao("vendas.produtos"); await exigirPermissao("inventario");
  const produtos = await consultarProntidaoProdutos();
  return <main className="space-y-6"><Link href="/vendas/pedidos" className="text-primary hover:underline">← Pedidos</Link><h1 className="font-heading text-display">Prontidão dos produtos</h1>
    <p>Consulta de cadastro; não comprova inventário físico nem aprovação de operação. Opções são verificadas individualmente, não somadas como consumo. Custo por movimentos e ativação permanecem pendentes.</p>
    <div className="flex gap-4"><Link href="/vendas/produtos" className="text-primary hover:underline">Revisar produtos e prévia da ficha</Link><Link href="/insumos" className="text-primary hover:underline">Revisar insumos e conversões</Link><Link href="/inventario" className="text-primary hover:underline">Conferir estoque</Link></div>
    {produtos.map(p => <article key={p.id} className="space-y-2 rounded-2xl border bg-card p-4"><h2 className="font-semibold">{p.nome}</h2><p className="text-sm text-muted-foreground">ID {p.id} · Versão {p.versao}</p>
      <p>Canal comercial habilitado: {p.vendavel ? "Sim; validar escolhas no pedido" : "Não"} · Composição: {p.composicaoValidada ? "Consistente nesta consulta" : "Pendente"} · Cadastro físico: {p.aptoFisicoCadastral ? "Consistente; disponibilidade deve ser conferida por local" : "Pendente"} · Custo estimado: {p.custoEstimadoDisponivel ? "Disponível" : "Pendente"}</p>
      {p.problemas.length > 0 && <ul className="list-disc pl-5">{p.problemas.map(v => <li key={v}>{v}</li>)}</ul>}<p className="text-sm">{p.acao}</p>
    </article>)}
  </main>;
}
