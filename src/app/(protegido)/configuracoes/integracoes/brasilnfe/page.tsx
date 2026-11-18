import { exigirPermissao } from "@/lib/permissoes/servidor";
import { BlocoEmissorFiscal } from "@/app/(protegido)/financeiro/fiscal/configuracoes/emissor";
import { carregarResumoIntegracoes } from "../resumo";
import { MolduraIntegracoes } from "../seletor";

/** Brasil NFe como integração própria. O certificado A1 local fica na conexão Certificado A1. */
export default async function BrasilNfePage() {
  await exigirPermissao("configuracoes.brasilnfe");
  return <MolduraIntegracoes resumo={await carregarResumoIntegracoes()} ativa="brasilnfe">
    <section aria-label="Brasil NFe" className="space-y-3">
      <div><p className="text-label uppercase text-muted-foreground">Integração</p><h2 className="font-heading text-title">Brasil NFe</h2><p className="text-sm text-muted-foreground">Conexão, credenciais, CSC por ambiente e habilitação de emissão de NF-e e NFC-e.</p></div>
      <BlocoEmissorFiscal />
    </section>
  </MolduraIntegracoes>;
}
