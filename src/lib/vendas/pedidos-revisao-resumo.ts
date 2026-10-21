type Item = { quantidade?: string | number; produtoSnapshot?: { nome?: string }; escolhasSnapshot?: { opcaoNome: string; quantidade: number }[] };
type Foto = { itens?: Item[]; observacoes?: string | null };
/** Projeção da cozinha: sem endereço, CPF, preços ou dados de pagamento. */
export function resumirRevisaoProducao(antes: unknown, depois: unknown) {
  const a = (antes ?? {}) as Foto, d = (depois ?? {}) as Foto;
  const descrever = (itens?: Item[]) => (itens ?? []).map(i => `${i.quantidade} × ${i.produtoSnapshot?.nome ?? "Item"}${i.escolhasSnapshot?.length ? " (" + i.escolhasSnapshot.map(e => `${e.quantidade} × ${e.opcaoNome}`).join("; ") + ")" : ""}`).join("; ");
  const anterior = descrever(a.itens), atual = descrever(d.itens);
  const mudancas: string[] = [];
  if (anterior !== atual) mudancas.push(`Itens anteriores: ${anterior || "—"}. Itens atuais: ${atual || "—"}.`);
  if (a.observacoes !== d.observacoes) mudancas.push(`Instruções anteriores: ${a.observacoes || "—"}. Instruções atuais: ${d.observacoes || "—"}.`);
  return mudancas.join(" ") || "Revisão comercial sem alteração de itens ou instruções de preparo.";
}
