import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { MenuEtiquetas } from "@/components/layout/menu-etiquetas";
import { AtualizacaoTema } from "@/components/design-system/atualizacao-tema";
import { obterTemaPublicado } from "@/lib/design-system/servico";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  const [identidade, tema] = await Promise.all([identidadeDaInterface(), obterTemaPublicado()]);
  return (
    <ProvedorAcesso acesso={{ admin: sessao.admin, permissoes: sessao.permissoes, excecoes: sessao.excecoes }}>
    <div className="estrutura-sistema">
      <a href="#conteudo-principal" className="atalho-conteudo">Ir para o conteúdo</a>
      {identidade === "etiquetas" ? <MenuEtiquetas usuarioId={sessao.userId} /> : identidade === "hub" ? <Sidebar usuarioId={sessao.userId} /> : null}
      <div className="painel-sistema">
        <Header identidade={identidade} />
        <main id="conteudo-principal" tabIndex={-1} className="conteudo-sistema">{children}</main>
      </div>
    </div>
    <AtualizacaoTema revisao={tema.revisao} />
    </ProvedorAcesso>
  );
}
