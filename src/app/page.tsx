import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SECOES, permissaoEfetiva } from "@/lib/permissoes/catalogo";
export default async function Home() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  const destino = SECOES.find(s => s.rota && (sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, s.id, "visualizar")));
  redirect(destino?.rota ?? "/sem-acesso");
}
