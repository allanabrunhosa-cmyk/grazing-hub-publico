
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { ContasBancariasView } from "@/app/(protegido)/financeiro/bancario/contas-bancarias-view";
import type { ContaBancariaRow, MovimentacaoBancariaRow } from "@/app/(protegido)/financeiro/types";
import { podeEditarSaldoInicial } from "@/lib/financeiro/permissao-saldo-inicial";
import { calcularSaldoContasAte } from "@/lib/financeiro/saldos-iniciais";

export default async function BancarioPage() {
  await exigirPermissao("financeiro.bancario");
  const podeEditarSaldo = await podeEditarSaldoInicial();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const contas = await prisma.contaBancaria.findMany({
    orderBy: { nome: "asc" },
    include: { movimentacoes: { orderBy: { data: "desc" }, include: { contaBancaria: { select: { nome: true } } } } },
  });

  const cartoes = await prisma.cartaoCredito.findMany({ include: { contaBancaria: true }, orderBy: { nome: "asc" } });
  const cartoesRows = cartoes.map(c => ({ id: c.id, nome: c.nome, contaBancariaId: c.contaBancariaId, contaBancariaNome: c.contaBancaria.nome, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento, ativo: c.ativo, emissor:c.emissor,bandeira:c.bandeira,final:c.final,limite:c.limite?.toString()??null,observacoes:c.observacoes,toleranciaDias:c.toleranciaDias,updatedAt:c.updatedAt.toISOString() }));
  const contasRows: ContaBancariaRow[] = contas.map((c) => {
    const saldoInicial = Number(c.saldoInicial);
    const dataSaldoInicial = c.dataSaldoInicial?.toISOString().slice(0, 10) ?? null;
    const saldoAtual = calcularSaldoContasAte([{ id: c.id, saldoInicial, dataSaldoInicial }], c.movimentacoes.map((m) => ({
      contaBancariaId: c.id, data: m.data.toISOString(), valor: (m.tipo === "SAIDA" ? -1 : 1) * Number(m.valor),
    })), hoje);
    return { id: c.id, nome: c.nome, saldoInicial, dataSaldoInicial, ativo: c.ativo, saldoAtual };
  });

  const movimentacoesRows: Record<string, MovimentacaoBancariaRow[]> = Object.fromEntries(
    contas.map((c) => [
      c.id,
      c.movimentacoes.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        valor: Number(m.valor),
        data: m.data.toISOString(),
        descricao: m.descricao,
        contaBancariaNome: m.contaBancaria.nome,
      })),
    ])
  );

  return <ContasBancariasView cartoes={cartoesRows} contas={contasRows} movimentacoesPorConta={movimentacoesRows} podeEditarSaldo={podeEditarSaldo} />;
}
