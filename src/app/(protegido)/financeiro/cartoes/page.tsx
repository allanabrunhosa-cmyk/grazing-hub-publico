import { aplicarPeriodoPadrao } from "@/lib/financeiro/periodos";
import Link from "next/link";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { cadastrosFaturas,listarFaturas,type FiltrosFatura } from "@/lib/financeiro/faturas/consultas";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card,CardContent } from "@/components/ui/card";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { CartoesView } from "../bancario/cartoes-view";
import { ImportarFatura } from "./importar";
import { SituacaoFatura } from "./componentes";
import { dataFatura } from "@/lib/financeiro/faturas/data";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";

export default async function CartoesPage({searchParams}:{searchParams:Promise<FiltrosFatura>}){
  await exigirPermissao("financeiro.faturas");
  const filtros=aplicarPeriodoPadrao(await searchParams),[cadastros,lista]=await Promise.all([cadastrosFaturas(),listarFaturas(filtros)]);
  const pagina=(n:number)=>"?"+new URLSearchParams({...filtros,pagina:String(n)}).toString();
  return <div className="space-y-6"><BarraAcoes titulo="Cartões e Faturas" descricao="Compras individualizadas. Pagamentos sem duplicar despesas.">
    <Button variant="outline" nativeButton={false} render={<Link href="/financeiro/cartoes/regras"/>} role="link">Regras</Button><ImportarFatura cartoes={cadastros.cartoes}/>
  </BarraAcoes><CartoesView cartoes={cadastros.cartoes} contas={cadastros.contas}/>
    <Card><CardContent className="space-y-4 pt-6"><h2 className="text-title">Faturas</h2><form className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Cartão/emissor<Input name="busca" defaultValue={filtros.busca} placeholder="Buscar cartão ou instituição"/></label>
      <label className="text-sm">Competência<Input type="month" name="competencia" defaultValue={filtros.competencia}/></label>
      <label className="text-sm">Vencimento de<Input name="de" type="date" defaultValue={filtros.de}/></label><label className="text-sm">Até<Input name="ate" type="date" defaultValue={filtros.ate}/></label>
      <Button type="submit" variant="outline">Filtrar</Button><Button variant="ghost" nativeButton={false} role="link" render={<Link href="/financeiro/cartoes"/>}>Limpar</Button>
    </form><nav className="flex flex-wrap gap-2" aria-label="Situação das faturas">{[['','Todas'],['REVISAO','Revisão'],['DIVERGENTE','Divergências'],['PRONTA','Não pagas'],['PARCIAL','Parciais'],['CONCILIADA','Conciliadas'],['CANCELADA','Canceladas']].map(([estado,nome])=><Button key={estado} size="sm" variant={(filtros.estado??'')===estado?'default':'outline'} nativeButton={false} role="link" render={<Link href={'?'+new URLSearchParams({...filtros,estado,pagina:'1'})}/>}>{nome} <span className="tabular-nums">({(lista.contagens[estado]??0).toLocaleString("pt-BR")})</span></Button>)}</nav>
      <Table><TableHeader><TableRow>{['Cartão','Competência','Fechamento','Vencimento','Total / diferença','Itens','Pago','Situação',''].map(t=><TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>
        {lista.faturas.map(f=><TableRow key={f.id}><TableCell>{f.cartao}{f.final&&<span className="block text-xs text-muted-foreground">•••• {f.final}</span>}</TableCell><TableCell>{f.competencia}</TableCell><TableCell>{dataFatura(f.fechamento)}</TableCell><TableCell>{dataFatura(f.vencimento)}</TableCell><TableCell className="text-right">{formatarMoeda(f.total/100)}{f.calculado!==f.total&&<span className="block text-destructive">Dif.: {formatarMoeda((f.calculado-f.total)/100)}</span>}</TableCell><TableCell>{f.itens}</TableCell><TableCell>{formatarMoeda(f.pago/100)}</TableCell><TableCell><SituacaoFatura estado={f.estado}/></TableCell><TableCell><Button size="sm" variant="outline" nativeButton={false} role="link" render={<Link href={`/financeiro/cartoes/faturas/${f.id}`}/>}>Abrir</Button></TableCell></TableRow>)}
        {!lista.faturas.length&&<TableRow><TableCell colSpan={9}>Nenhuma fatura neste filtro. Importe um arquivo para começar.</TableCell></TableRow>}
      </TableBody></Table><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={lista.pagina<=1} nativeButton={false} role="link" render={<Link href={pagina(Math.max(1,lista.pagina-1))}/>}>Anterior</Button><p className="text-sm">Página {lista.pagina} · {lista.quantidade} faturas</p><Button variant="outline" size="sm" disabled={lista.pagina*30>=lista.quantidade} nativeButton={false} role="link" render={<Link href={pagina(lista.pagina+1)}/>}>Próxima</Button></div>
    </CardContent></Card>
  </div>;
}
