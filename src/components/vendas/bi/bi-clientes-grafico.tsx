import type { DistribuicaoClienteBi } from "@/lib/vendas/bi-types";
import s from "./bi-vendas.module.css";

const NOMES = { PF: "Pessoa física", PJ: "Pessoa jurídica", "nao-informado": "Sem classificação" };
const CLASSES = { PF: s.pessoaFisica, PJ: s.pessoaJuridica, "nao-informado": s.pessoaSemTipo };
const numero = new Intl.NumberFormat("pt-BR");
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function GraficoClientes({ distribuicao, metrica }: {
  distribuicao: DistribuicaoClienteBi[] | null;
  metrica: "pedidos" | "faturamento";
}) {
  if (distribuicao === null) return <p className={s.vazio}>Consulta restrita à permissão de clientes.</p>;
  const valores = distribuicao.map(grupo => grupo[metrica]);
  const total = valores.reduce<number>((soma, valor) => soma + (valor ?? 0), 0);
  const naoApurado = valores.some(valor => valor === null);
  const negativo = valores.some(valor => valor !== null && valor < 0);
  const podeComparar = !naoApurado && !negativo && total > 0;
  const formato = metrica === "pedidos" ? numero : moeda;
  const fatias = distribuicao.map((grupo, indice) => {
    const fracao = podeComparar ? (valores[indice] ?? 0) / total : 0;
    const acumulado = podeComparar ? valores.slice(0, indice).reduce<number>((soma, valor) => soma + (valor ?? 0), 0) / total : 0;
    const inicio = acumulado * Math.PI * 2 - Math.PI / 2;
    const fim = (acumulado + fracao) * Math.PI * 2 - Math.PI / 2;
    return { grupo, fracao, caminho: `M 100 100 L ${100 + 96 * Math.cos(inicio)} ${100 + 96 * Math.sin(inicio)} A 96 96 0 ${fracao > .5 ? 1 : 0} 1 ${100 + 96 * Math.cos(fim)} ${100 + 96 * Math.sin(fim)} Z` };
  });
  const motivo = naoApurado
    ? "Faturamento não apurado em parte dos pedidos. A comparação fica disponível quando os valores estiverem completos."
    : negativo ? "Há valores negativos na seleção. Consulte os totais por tipo abaixo."
      : metrica === "pedidos" ? "Nenhum pedido válido nesta seleção." : "Faturamento total zero nesta seleção.";

  return <div className={s.distribuicaoClientes}>
    <div className={s.pizzaConteudo}>
      {podeComparar ? <svg className={s.pizza} viewBox="0 0 200 200" role="img" aria-label={`Distribuição de ${metrica === "pedidos" ? "pedidos" : "faturamento"} por tipo de pessoa. Valores na legenda.`}>
        {fatias.filter(fatia => fatia.fracao > 0).map(({ grupo, fracao, caminho }) => fracao === 1
          ? <circle key={grupo.tipo} className={CLASSES[grupo.tipo]} cx="100" cy="100" r="96" />
          : <path key={grupo.tipo} className={CLASSES[grupo.tipo]} d={caminho} />)}
      </svg> : <p className={s.pizzaVazia}>{motivo}</p>}
    </div>
    <div className={s.pizzaResumo}>
      <p className={s.pizzaTotal}><strong>{naoApurado ? "Não apurado" : formato.format(total)}</strong><span>{metrica === "pedidos" ? "pedidos na seleção" : "faturamento na seleção"}</span></p>
      <dl className={s.pizzaLegenda} aria-label={`Valores por tipo de pessoa: ${metrica}`}>
        {distribuicao.map((grupo, indice) => <div key={grupo.tipo} className={s.pizzaLegendaLinha}>
          <dt><i className={CLASSES[grupo.tipo]} aria-hidden="true" />{NOMES[grupo.tipo]}</dt>
          <dd><strong>{valores[indice] === null ? "Não apurado" : formato.format(valores[indice])}</strong>{podeComparar && <span>{percentual.format((valores[indice] ?? 0) / total)}</span>}</dd>
          <dd className={s.pizzaTicket}><span>Ticket médio</span><strong>{grupo.ticket === null ? "Não apurado" : moeda.format(grupo.ticket)}</strong></dd>
        </div>)}
      </dl>
    </div>
    <p className={s.pizzaNota}>Tipo do comprador no cadastro. Sem classificação inclui pedidos sem vínculo ou tipo informado. Ticket médio: faturamento com frete dividido pelos pedidos de cada tipo.</p>
  </div>;
}
