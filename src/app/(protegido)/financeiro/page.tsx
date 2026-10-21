
import { BarraAcoes } from "@/components/padroes-operacionais";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { DreView } from "@/app/(protegido)/financeiro/dre-view";
import { AvisoFaturas } from "./cartoes/aviso";
import { carregarFonteDre } from "@/lib/financeiro/fontes-relatorios";

export default async function FinanceiroDrePage() {
  await exigirPermissao("financeiro.dre");
  const { linhas } = await carregarFonteDre();

  return (
    <div className="space-y-6">
      <BarraAcoes titulo="DRE" descricao="Demonstrativo de resultado, por competência ou caixa" />
      <AvisoFaturas />
      <DreView lancamentos={linhas} />
    </div>
  );
}
