import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";
import { agruparMovimentacoes, type MovimentoAgrupado } from "../agrupar-movimentacoes";
import { montarLinhasExtrato } from "../extrato";
import type { ExtratoBancarioRow } from "./types";

export const TOLERANCIA_VENCIMENTO_CONCILIACAO_DIAS = 7;

export type GrupoConciliacao = MovimentoAgrupado & { lancamentos: LancamentoRow[] };
export type SugestaoConciliacao = { grupoId: string; ids: string[]; motivo: string };

// Reutiliza o agrupamento da tela normal. A busca deve ocorrer depois, para nunca
// transformar o valor de uma nota no subtotal dos itens encontrados pelo texto.
export function agruparParaConciliacao(linhas: LancamentoRow[]): GrupoConciliacao[] {
  return agruparMovimentacoes(montarLinhasExtrato(linhas, [])).map(grupo => ({
    ...grupo, lancamentos: grupo.linhas.map(l => l.lancamento!),
  }));
}

const centavos = (valor: number) => Math.round(valor * 100);
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const genericas = new Set(["pix", "pagamento", "recebimento", "transferencia", "enviado", "recebido", "ltda", "eireli", "comercio", "banco", "conta", "fornecedor", "cliente", "servicos", "nota", "fiscal"]);
function contraparteCompativel(grupo: GrupoConciliacao, descricao: string) {
  const texto = ` ${normalizar(descricao)} `;
  return grupo.lancamentos.some(l => {
    const nome = l.notaFiscal?.fornecedorNome ?? l.fornecedorNome ?? l.contraparteNome ?? "";
    const palavras = normalizar(nome).split(" ").filter(p => p.length >= 4 && !genericas.has(p) && !/^\d+$/.test(p));
    return palavras.length > 0 && palavras.every(p => texto.includes(` ${p} `));
  });
}

// Somente uma proposta de apresentação: o servidor continua revalidando valor,
// versões, vínculos e permissões quando o usuário confirma a conciliação.
export function sugerirConciliacoes(grupos: GrupoConciliacao[], transacoes: ExtratoBancarioRow[], podeBaixar: boolean) {
  const candidatos = new Map<string, { grupo: GrupoConciliacao; motivo: string }[]>();
  const usos = new Map<string, number>();
  for (const transacao of transacoes.filter(t => !t.conciliadaEm)) {
    const opcoes = grupos.flatMap(grupo => {
      if (centavos(grupo.valor) !== centavos(transacao.valor) || grupo.lancamentos.some(l =>
        l.transacaoExtratoId || l.status === "CANCELADO" ||
        (l.status === "BAIXADO" && l.contaBancariaId !== transacao.contaBancariaId) ||
        (l.contaBancariaId && l.contaBancariaId !== transacao.contaBancariaId) ||
        (l.status === "PENDENTE" && (!podeBaixar || !!l.pedidoVendaId)))) return [];
      const data = grupo.linhas[0].data;
      const dias = Math.abs(Date.parse(transacao.data) - Date.parse(data)) / 86_400_000;
      if (!Number.isFinite(dias) || dias > TOLERANCIA_VENCIMENTO_CONCILIACAO_DIAS || (grupo.status === "BAIXADO" && dias !== 0)) return [];
      if (dias !== 0 && !contraparteCompativel(grupo, transacao.descricao)) return [];
      return [{ grupo, motivo: dias === 0 ? "Valor e data coincidem; conta compatível." : "Mesmo valor e contraparte; vencimento a até 7 dias da transação." }];
    });
    candidatos.set(transacao.id, opcoes);
    for (const { grupo } of opcoes) usos.set(grupo.id, (usos.get(grupo.id) ?? 0) + 1);
  }
  const sugestoes = new Map<string, SugestaoConciliacao>();
  for (const [id, opcoes] of candidatos) {
    if (opcoes.length !== 1 || usos.get(opcoes[0].grupo.id) !== 1) continue;
    const { grupo, motivo } = opcoes[0];
    sugestoes.set(id, { grupoId: grupo.id, ids: grupo.lancamentos.map(l => l.id), motivo });
  }
  return { sugestoes, ambiguas: new Set([...candidatos].filter(([id, opcoes]) => opcoes.length > 0 && !sugestoes.has(id)).map(([id]) => id)) };
}
