type Referencia = { id: string; nome: string };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function referenciasFiscaisPedido(itens: { produtoId: string | null; produtoSnapshot: unknown }[], linhas: { produtoId: string; nome: string }[]): Referencia[] {
  const r = linhas.map(l => ({ id: l.produtoId, nome: l.nome }));
  for (const i of itens) {
    const p = objeto(i.produtoSnapshot);
    if (i.produtoId && typeof p.nome === "string") r.push({ id: i.produtoId, nome: p.nome });
    const ks = objeto(p.fotografiaKitFiscal).componentes;
    if (Array.isArray(ks)) for (const k of ks) {
      const c = objeto(k), id = typeof c.produtoId === "string" ? c.produtoId : typeof c.referenciaInternaInsumoId === "string" ? `INSUMO:${c.referenciaInternaInsumoId}` : null;
      if (id && typeof c.descricao === "string") r.push({ id, nome: c.descricao });
    }
  }
  return r;
}
export function atalhoPendenciaFiscal(mensagem: string, referencias: Referencia[]) {
  const diretas = referencias.filter(r => mensagem.includes(`${r.nome}:`));
  const candidatos = diretas.length ? diretas : referencias.filter(r => mensagem.includes(`${r.nome} /`));
  const encontrados = [...new Set(candidatos.map(r => r.id))];
  if (encontrados.length === 1) return `/financeiro/fiscal/vinculos?produto=${encodeURIComponent(encontrados[0])}#ficha-fiscal`;
  if (/\b(CRT|perfil fiscal|perfil do estabelecimento|enquadramento cadastral)\b/i.test(mensagem)) return "/financeiro/fiscal/configuracoes#empresa";
  if (/\b(série|numeração|contador)\b/i.test(mensagem)) return "/financeiro/fiscal/configuracoes#numeracao";
  if (/\b(certificado|CSC|token|integração|emissor)\b/i.test(mensagem)) return "/financeiro/fiscal/configuracoes#emissor";
  return "/financeiro/fiscal/vinculos";
}
