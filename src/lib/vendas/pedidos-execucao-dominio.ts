import { DecimalEstoque as D } from "@/lib/estoque/quantidade";

export type AjusteExecucao = { itemId: string; preparar: string; expedir: string; prepararSemEstoque: string; expedirSemEstoque: string };
type Fato = { depois: unknown };
export function materialDestinado(fatos: Fato[], reservaId: string) {
  return fatos.reduce((s, f) => {
    const d = f.depois as { destinoFisico?: { materiais?: { reservaId: string; quantidade: string }[] } };
    return s.plus(d.destinoFisico?.materiais?.filter(m => m.reservaId === reservaId).reduce((q, m) => q.plus(m.quantidade), new D(0)) ?? 0);
  }, new D(0));
}
/** Revisão reduz a execução atribuída à encomenda, sem apagar o fato físico original. */
export function quantidadeExecucao(fatos: Fato[], itemId: string, tipo: string, somenteSemEstoque = false) {
  return fatos.reduce((total, fato) => {
    const d = fato.depois as { comando?: { tipo: string; itemId?: string; quantidade?: string }; ajusteExecucao?: AjusteExecucao; validacaoFisica?: boolean };
    if (d.comando?.tipo === tipo && d.comando.itemId === itemId && (!somenteSemEstoque || d.validacaoFisica === false)) total = total.plus(d.comando.quantidade ?? 0);
    if (d.ajusteExecucao?.itemId === itemId) {
      const a = d.ajusteExecucao;
      total = total.minus(tipo === "PREPARAR" ? somenteSemEstoque ? a.prepararSemEstoque : a.preparar : somenteSemEstoque ? a.expedirSemEstoque : a.expedir);
    }
    return total;
  }, new D(0));
}

export function ajusteDevolucaoExecucao(fatos: Fato[], itemId: string, quantidade: string): AjusteExecucao {
  const reduzir = (tipo: string) => D.min(quantidadeExecucao(fatos, itemId, tipo), quantidade);
  const semEstoque = (tipo: string) => D.max(0, reduzir(tipo).minus(quantidadeExecucao(fatos, itemId, tipo).minus(quantidadeExecucao(fatos, itemId, tipo, true))));
  return { itemId, preparar: reduzir("PREPARAR").toString(), expedir: reduzir("EXPEDIR").toString(), prepararSemEstoque: semEstoque("PREPARAR").toString(), expedirSemEstoque: semEstoque("EXPEDIR").toString() };
}
