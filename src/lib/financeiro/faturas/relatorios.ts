import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";
import { dinheiro, ratearLiquidacao } from "./dominio";
const centavos = (valor: { toString(): string }) => dinheiro(valor.toString());
import { projetarCaixaFatura } from "./projecoes";

// Apenas projeções de leitura. Nunca cria despesas para representar pagamentos.
export async function projetarRelatorioFaturas(linhas: LancamentoRow[], db: Pick<Prisma.TransactionClient, "faturaCartao"> = prisma) {
  const faturas = await db.faturaCartao.findMany({
    where: { canceladaEm: null },
    include: { cartao: true, itens: { where: { ignoradoEm: null }, include: { lancamentos: { include: { liquidacoesCartao: { where: { pagamento: { revertidoEm: null } }, include: { pagamento: true } } } } } }, pagamentos: { where: { revertidoEm: null }, include: { liquidacoes: true } } },
  });
  const projecoes = new Map<string, LancamentoRow[]>();
  const movimentosSubstituidos = new Set<string>();
  const extras: LancamentoRow[] = [];
  for (const f of faturas) {
    const despesas = f.itens.flatMap(i => i.lancamentos).sort((a,b) => a.id.localeCompare(b.id));
    const semRateio = f.pagamentos.filter(p => !p.liquidacoes.length);
    const total = centavos(f.totalInformado);
    const pagoSemRateio = semRateio.reduce((s,p) => s + centavos(p.valor), 0);
    const valores = despesas.map(l => (l.tipo === "RECEITA" ? -1 : 1) * centavos(l.valor));
    // Antes de terminar a revisão, abate a fração já paga da previsão conhecida.
    // A parcela não classificada fica fora do DRE e é explicitada no aviso.
    const previstoPago = pagoSemRateio > 0 && total > 0
      ? ratearLiquidacao([...valores, total - valores.reduce((s,v) => s+v,0)], pagoSemRateio)
      : valores.map(() => 0);
    despesas.forEach((l,indice) => {
      const linha = linhas.find(r => r.id === l.id);
      if (!linha) return;
      projecoes.set(l.id, projetarCaixaFatura({...linha,valor:(centavos(l.valor)-(l.tipo === "RECEITA" ? -1 : 1)*previstoPago[indice])/100}, {
        faturaId:f.id,cartao:f.cartao.nome,liquidacoes:l.liquidacoesCartao.map(q => ({id:q.id,valor:Number(q.valor),pagamento:{id:q.pagamento.id,data:q.pagamento.data.toISOString(),contaIdOriginal:q.pagamento.contaIdOriginal,revertidoEm:null}})),
      }));
    });
    for (const p of f.pagamentos) {
      if (p.movimentoId) movimentosSubstituidos.add(p.movimentoId);
      if (p.liquidacoes.length) continue;
      extras.push({id:`fatura:pagamento:${p.id}`,faturaId:f.id,pagamentoFaturaId:p.id,cartaoNome:f.cartao.nome,
        tipo:"DESPESA",descricao:`FATURA ${f.cartao.nome} — CLASSIFICAÇÃO PENDENTE`,valor:Number(p.valor),
        categoriaId:"faturas-sem-classificacao",categoriaNome:"Faturas a classificar",categoriaGrupo:"DESPESAS_OPERACIONAIS",semClassificacao:true,
        dataCompetencia:p.data.toISOString(),dataVencimento:p.data.toISOString(),dataPagamento:p.data.toISOString(),status:"BAIXADO",
        contaBancariaId:p.contaIdOriginal,contaBancariaNome:null,fornecedorId:null,fornecedorNome:null,formaPagamentoId:null,formaPagamentoNome:null,contraparteNome:null,observacoes:"Saída bancária sem classificação completa. Não é uma nova despesa no DRE."});
    }
  }
  return {linhas:[...linhas.flatMap(l => projecoes.get(l.id) ?? [l]),...extras],movimentosSubstituidos,
    pendentes:faturas.filter(f => f.estado === "REVISAO" || f.estado === "DIVERGENTE").length};
}
