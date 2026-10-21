import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import { getSession } from "@/lib/session";
import { SECOES, permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { identidadeDaInterface } from "@/lib/contexto-interface";
export default async function SemAcessoPage() {
  const sessao = await getSession();
  const identidade = await identidadeDaInterface();
  if (identidade !== "hub") return <div className="mx-auto max-w-xl rounded-3xl border bg-card p-10 text-center"><ShieldAlert className="mx-auto mb-5 size-10 text-primary" /><h1 className="text-2xl font-semibold">Acesso não permitido</h1><p className="mt-3 text-sm text-muted-foreground">Peça ao administrador para revisar suas permissões de {identidade === "pedidos" ? "Pedidos" : "Produção"}. Para trocar de conta, use Sair no menu acima.</p><Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>{identidade === "pedidos" ? "Voltar ao gestor de pedidos" : "Voltar às etiquetas"}</Link></div>;
  const destinos = SECOES.filter(s => s.rota && sessao && (sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, s.id, "visualizar")));
  return <div className="mx-auto max-w-xl rounded-3xl border bg-card p-10 text-center"><ShieldAlert className="mx-auto mb-5 size-10 text-primary" /><h1 className="text-2xl font-semibold">Acesso não permitido</h1><p className="mt-3 text-sm text-muted-foreground">Seu perfil não permite abrir esta seção ou realizar esta ação. Peça ao administrador para revisar suas permissões.</p><div className="mt-6 flex flex-wrap justify-center gap-3">{destinos.slice(0,4).map(s => <Link key={s.id} className={buttonVariants({ variant: "outline" })} href={s.rota}>{s.nome}</Link>)}<Link href="/perfil" className={buttonVariants({ variant: "outline" })}>Meu perfil</Link></div></div>;
}
