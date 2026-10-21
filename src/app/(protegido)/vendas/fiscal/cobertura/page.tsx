import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { PainelEstruturaFiscal } from "./painel-fiscal";

export default async function CoberturaFiscalPage() {
  const sessao = await exigirPermissao("vendas.fiscal");
  const painel = await consultarPainelFiscal(sessao);
  return <PainelEstruturaFiscal painel={painel} />;
}
