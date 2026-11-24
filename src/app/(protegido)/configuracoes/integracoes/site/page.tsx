import { exigirPermissao, exigirSessao, podeAcessar } from "@/lib/permissoes/servidor";
import { estadoSite } from "@/lib/site/configuracao";
import { carregarResumoIntegracoes } from "../resumo";
import { MolduraIntegracoes } from "../seletor";
import { reprocessarSiteAction, salvarSiteAction, testarSiteAction } from "../asaas-site-actions";
import { PainelSite } from "./painel";

/** Site (WooCommerce): recepção dos pedidos. Chaves ficam no servidor; aqui canal, ativação e conferência. */
export default async function SiteIntegracaoPage() {
  await exigirPermissao("configuracoes.loja");
  const sessao = await exigirSessao();
  const [resumo, estado, editar] = await Promise.all([carregarResumoIntegracoes(), estadoSite(), podeAcessar("configuracoes.loja", "editar")]);
  return <MolduraIntegracoes resumo={resumo} ativa="site">
    <section aria-label="Site" className="space-y-3">
      <div><p className="text-label uppercase text-muted-foreground">Integração</p><h2 className="font-heading text-title">Site</h2><p className="text-sm text-muted-foreground">Pedidos da loja virtual recebidos automaticamente em Pedidos, no canal escolhido.</p></div>
      <PainelSite inicial={estado} webhook="https://grazinghub.com.br/api/integracoes/site/webhook" editar={sessao.admin && editar} salvar={salvarSiteAction} testar={testarSiteAction} reprocessar={reprocessarSiteAction} />
    </section>
  </MolduraIntegracoes>;
}
