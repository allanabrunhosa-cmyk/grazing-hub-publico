import { exigirPermissao, exigirSessao, podeAcessar } from "@/lib/permissoes/servidor";
import { estadoAsaas } from "@/lib/asaas/painel";
import { carregarResumoIntegracoes } from "../resumo";
import { MolduraIntegracoes } from "../seletor";
import { reprocessarAsaasAction, testarAsaasAction } from "../asaas-site-actions";
import { PainelAsaas } from "./painel";

/** Asaas: cobrança do pedido e aviso de pagamento. Chaves ficam no servidor; aqui só situação e conferência. */
export default async function AsaasIntegracaoPage() {
  await exigirPermissao("configuracoes.loja");
  const sessao = await exigirSessao();
  const [resumo, estado, editar] = await Promise.all([carregarResumoIntegracoes(), estadoAsaas(), podeAcessar("configuracoes.loja", "editar")]);
  return <MolduraIntegracoes resumo={resumo} ativa="asaas">
    <section aria-label="Asaas" className="space-y-3">
      <div><p className="text-label uppercase text-muted-foreground">Integração</p><h2 className="font-heading text-title">Asaas</h2><p className="text-sm text-muted-foreground">Cobrança por Pix, boleto ou cartão a partir do pedido, com o pagamento registrado automaticamente.</p></div>
      <PainelAsaas inicial={estado} webhook="https://grazinghub.com.br/api/integracoes/asaas/webhook" editar={sessao.admin && editar} testar={testarAsaasAction} reprocessar={reprocessarAsaasAction} />
    </section>
  </MolduraIntegracoes>;
}
