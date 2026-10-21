import { estadosOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import { htmlComandaPedido, type FormatoComanda } from "@/lib/vendas/impressao-pedido";
import type { ResumoOperacional } from "./operacao-client";
export function htmlResumoPedido(p: ResumoOperacional, formato: FormatoComanda = "80mm", geradoEm = new Date()) {
  return htmlComandaPedido({
    numero: p.numero, versao: p.versao, titulo: "COMANDA DE PRODUÇÃO",
    situacao: ["CANCELADO", "ESTORNADO", "DECLINADO"].includes(p.status) ? `PEDIDO ${p.status} — NÃO PREPARAR` : p.status === "RASCUNHO" ? "Em orçamento — não iniciar produção" : estadosOperacao[p.statusOperacional] ?? p.statusOperacional,
    inicioPreparo: p.inicioPreparoIfood ? new Date(p.inicioPreparoIfood).toLocaleString("pt-BR", { timeZone: p.fusoHorario ?? "America/Sao_Paulo" }) : null,
    data: p.previsaoData, horario: p.previsaoJanela, atendimento: p.atendimento,
    referencia: p.referenciaPedido ?? "Sem referência externa",
    geradoEm: `${geradoEm.toLocaleString("pt-BR", { timeZone: p.fusoHorario ?? "America/Sao_Paulo" })} · ${p.fusoHorario ?? "America/Sao_Paulo"}`,
    observacoes: p.observacoes, revisoes: p.revisoesProducao,
    itens: p.itens.map(i => ({ nome: i.produtoSnapshot.nome, quantidade: i.quantidade, unidade: i.unidadeSnapshot, escolhas: i.escolhasSnapshot.map(e => `${e.quantidade} × ${e.opcaoNome}`), observacoes: i.observacoes })),
    rodape: "Comanda operacional. Não comprova pagamento, consumo de estoque ou emissão fiscal. Reimpressão não substitui conferência da revisão vigente.",
  }, formato);
}
export function imprimirResumoPedido(p: ResumoOperacional, formato: FormatoComanda = "80mm") {
  const janela = window.open("", "_blank", "width=500,height=800");
  if (!janela) return false;
  janela.opener = null;
  janela.document.write(htmlResumoPedido(p, formato)); janela.document.close(); janela.focus(); janela.print(); return true;
}
