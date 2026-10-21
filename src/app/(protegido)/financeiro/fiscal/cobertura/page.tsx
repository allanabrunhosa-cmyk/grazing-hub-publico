import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { PainelEstruturaFiscal } from "@/app/(protegido)/vendas/fiscal/cobertura/painel-fiscal";

export default async function CoberturaFiscalPage({ searchParams }: { searchParams?: Promise<{ aba?: string }> }) {
  const sessao = await exigirPermissao("vendas.fiscal");
  const painel = await consultarPainelFiscal(sessao);
  const consulta = await searchParams;
  return <PainelEstruturaFiscal painel={painel} abaInicial={consulta?.aba === "regras" ? "regras" : "cobertura"} />;
}
