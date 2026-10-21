"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { completarPeriodo, periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { calcularDre, type LancamentoParaDre, type ModoDre } from "@/lib/financeiro/calcularDre";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { grupoDreLabels } from "@/lib/labels";
import { ExportarRelatorioButton } from "./exportar-relatorio-button";
import { montarExportacaoDre } from "@/lib/financeiro/exportacao-relatorios";

function primeiroDiaDoMes(): string {
  return periodoMesAteHoje().de;
}

function hojeIso(): string {
  return periodoMesAteHoje().ate;
}

function Linha({
  label,
  valor,
  destaque,
  negativo,
  categorias,
}: {
  label: string;
  valor: number;
  destaque?: boolean;
  negativo?: boolean;
  categorias?: { nome: string; valor: number }[];
}) {
  return (
    <div className={destaque ? "space-y-1 border-t pt-2" : "space-y-1"}>
      <div className="flex items-center justify-between">
        <span className={destaque ? "font-semibold" : "text-sm text-muted-foreground"}>
          {negativo ? "(−) " : destaque ? "" : "  "}
          {label}
        </span>
        <span className={destaque ? "font-heading text-lg" : "text-sm font-medium"}>{formatarMoeda(valor)}</span>
      </div>
      {categorias && categorias.length > 0 && (
        <div className="space-y-0.5 pl-4">
          {categorias.map((c) => (
            <div key={c.nome} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{c.nome}</span>
              <span>{formatarMoeda(c.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DreView({ lancamentos }: { lancamentos: LancamentoParaDre[] }) {
  const [de, setDe] = useState(primeiroDiaDoMes());
  const [ate, setAte] = useState(hojeIso());
  const [modo, setModo] = useState<ModoDre>("COMPETENCIA");

  const resultado = useMemo(() => {
    const limites = completarPeriodo({ de, ate }, lancamentos.flatMap(l => [l.dataCompetencia, l.dataPagamento]), hojeIso());
    const periodo = { de: new Date(`${limites.de}T00:00:00`), ate: new Date(`${limites.ate}T23:59:59.999`) };
    return calcularDre(lancamentos, periodo, modo);
  }, [lancamentos, de, ate, modo]);

  return (
    <div className="space-y-4">
      <FiltroPeriodo de={de} ate={ate} aoAlterar={(periodo) => { setDe(periodo.de); setAte(periodo.ate); }}
        acoes={<GrupoAcoes nome="Regime da DRE" alinhamento="inicio">
          <Button type="button" size="sm" className="h-9!" variant={modo === "COMPETENCIA" ? "default" : "outline"} onClick={() => setModo("COMPETENCIA")}>
            Competência
          </Button>
          <Button type="button" size="sm" className="h-9!" variant={modo === "CAIXA" ? "default" : "outline"} onClick={() => setModo("CAIXA")}>
            Caixa
          </Button>
        </GrupoAcoes>}
        acoesDireita={<ExportarRelatorioButton obterRelatorio={() => montarExportacaoDre(resultado, de, ate, modo)} />}
      />
      <p className="text-xs text-muted-foreground">
        {modo === "COMPETENCIA"
          ? "Competência: considera o mês do fato gerador de cada lançamento — é o que o contador fecha."
          : "Caixa: considera só o que já foi baixado (pago/recebido) dentro do período — o que efetivamente entrou/saiu do banco."}
      </p>

      <Card>
        <CardContent className="space-y-3 divide-y">
          <div className="space-y-3 pb-3">
            <Linha label="Faturamento Bruto" valor={resultado.faturamentoBruto} categorias={resultado.grupos.RECEITA_BRUTA.categorias} />
            <Linha label="Deduções de Receita" valor={resultado.deducoes} negativo categorias={resultado.grupos.DEDUCOES_RECEITA.categorias} />
            <Linha label="Faturamento Líquido" valor={resultado.faturamentoLiquido} destaque />
          </div>

          <div className="space-y-3 py-3">
            <Linha label="CMV" valor={resultado.cmv} negativo categorias={resultado.grupos.CMV.categorias} />
            <Linha label="Despesas Variáveis" valor={resultado.despesasVariaveis} negativo categorias={resultado.grupos.DESPESAS_VARIAVEIS.categorias} />
            <Linha label="Margem de Contribuição" valor={resultado.margemContribuicao} destaque />
          </div>

          <div className="space-y-3 py-3">
            <Linha label="Despesas com pessoal" valor={resultado.folhaPagamento} negativo categorias={resultado.grupos.FOLHA_PAGAMENTO.categorias} />
            <Linha label="Despesas Operacionais" valor={resultado.despesasOperacionais} negativo categorias={resultado.grupos.DESPESAS_OPERACIONAIS.categorias} />
            <Linha label="Lucro Operacional Antes dos Investimentos (LOAI)" valor={resultado.loai} destaque />
          </div>

          <div className="space-y-3 py-3">
            <Linha label="Investimentos" valor={resultado.investimentos} negativo categorias={resultado.grupos.INVESTIMENTOS.categorias} />
            <Linha label="Lucro Operacional (EBITDA)" valor={resultado.ebitda} destaque />
          </div>

          <div className="space-y-3 py-3">
            <Linha label="Despesas Financeiras" valor={resultado.despesasFinanceiras} negativo categorias={resultado.grupos.DESPESAS_FINANCEIRAS.categorias} />
            <Linha label={grupoDreLabels.RECEITAS_NAO_OPERACIONAIS} valor={resultado.receitasNaoOperacionais} categorias={resultado.grupos.RECEITAS_NAO_OPERACIONAIS.categorias} />
            <Linha label="Depreciação e Amortização" valor={resultado.depreciacaoAmortizacao} negativo categorias={resultado.grupos.DEPRECIACAO_AMORTIZACAO.categorias} />
            <Linha label="Despesas Não Operacionais" valor={resultado.despesasNaoOperacionais} negativo categorias={resultado.grupos.DESPESAS_NAO_OPERACIONAIS.categorias} />
          </div>

          <div className="pt-3">
            <div className="flex items-center justify-between rounded-lg bg-foreground px-4 py-3 text-background">
              <span className="font-semibold">Resultado Líquido</span>
              <span className="font-heading text-xl">{formatarMoeda(resultado.resultadoLiquido)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
