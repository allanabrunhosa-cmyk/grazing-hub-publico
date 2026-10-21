import type { LinhaExtrato } from "./extrato";

export type MovimentoAgrupado = {
  id: string;
  titulo: string;
  subtitulo: string;
  valor: number;
  valorComponentes: number;
  status: LinhaExtrato["status"];
  categoria: string;
  conta: string | null;
  linhas: LinhaExtrato[];
};

// Agrupamento somente para apresentação, depois do cálculo dos saldos por conta.
// O vínculo real da NF define o grupo; nomes de fornecedor/produto nunca unem despesas.
export function agruparMovimentacoes(linhas: LinhaExtrato[]): MovimentoAgrupado[] {
  const grupos = new Map<string, MovimentoAgrupado>();
  for (const linha of linhas) {
    const nota = linha.lancamento?.notaFiscal;
    const fatura = linha.lancamento?.faturaId;
    const id = fatura ? JSON.stringify([fatura, linha.lancamento?.pagamentoFaturaId ?? null, linha.data, linha.status]) : nota ? JSON.stringify([nota.id, nota.parcela?.id ?? null, linha.data, linha.status, linha.lancamento?.tipo]) : linha.id;
    const existente = grupos.get(id);
    if (existente) {
      existente.linhas.push(linha);
      existente.valorComponentes = (Math.round(existente.valorComponentes * 100) + Math.round(linha.valor * 100)) / 100;
      if (!nota?.parcela) existente.valor = existente.valorComponentes;
      if (existente.categoria !== linha.categoria) existente.categoria = "Categorias diversas";
      if (existente.conta !== linha.conta) existente.conta = "Contas diversas";
    } else {
      grupos.set(id, {
        id,
        titulo: fatura ? `Fatura ${linha.lancamento?.cartaoNome ?? "do cartão"}` : nota?.fornecedorNome ?? linha.lancamento?.fornecedorNome ?? linha.descricao,
        subtitulo: fatura ? "Liquidação das despesas · sem despesa adicional" : nota ? `NF-e nº ${nota.numero} · Série ${nota.serie}`
          : linha.lancamento?.fornecedorNome ? linha.descricao : linha.contraparte ?? (linha.valor < 0 ? "Saída" : "Entrada"),
        valor: nota?.parcela ? (linha.valor < 0 ? -nota.parcela.valor : nota.parcela.valor) : linha.valor,
        valorComponentes: linha.valor,
        status: linha.status, categoria: linha.categoria, conta: linha.conta, linhas: [linha],
      });
    }
  }
  return [...grupos.values()];
}
