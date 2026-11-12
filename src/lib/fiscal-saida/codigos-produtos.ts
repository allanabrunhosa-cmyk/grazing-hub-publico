import { codigoProdutoValido } from "@/lib/vendas/codigo-produto";

export type ReferenciaCodigoProdutoFiscal = { linhaId: string; produtoId: string; codigo: string };
type Linha = { id: string; produtoId: string; nome: string };
type Cadastro = { id: string; codigo?: string | null };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
// Referências internas de insumos discriminados não são SKUs de ProdutoVenda.
// Preserve o namespace já comprovado pelo motor; não converta EAN ou crie outro cadastro.
const referenciaInsumo = (v: unknown): v is string => typeof v === "string" && /^INSUMO:[A-Za-z0-9_-]{1,53}$/.test(v);
const codigoDaIdentidadeValido = (produtoId: unknown, codigo: unknown) => referenciaInsumo(produtoId) ? codigo === produtoId : codigoProdutoValido(codigo);

/** Fotografa o código cadastral para uma nova revisão fiscal. O ID continua sendo
 * a identidade das classificações, escolhas e vínculos comerciais. */
export function fotografarCodigosProdutosFiscais(linhas: Linha[], produtos: Cadastro[]) {
  const pendencias: string[] = [], usados = new Map<string, string>();
  const codigosProdutos = linhas.map(linha => {
    const cadastrado = produtos.find(p => p.id === linha.produtoId)?.codigo;
    let codigo = referenciaInsumo(linha.produtoId) ? linha.produtoId : codigoProdutoValido(cadastrado) ? cadastrado : "";
    if (!codigo) pendencias.push(`${linha.nome}: configurar código do produto com até oito letras maiúsculas ou números no cadastro.`);
    else if (usados.has(codigo) && usados.get(codigo) !== linha.produtoId) {
      pendencias.push(`${linha.nome}: código do item fiscal repetido em outro cadastro; configure um código único antes de emitir.`);
      codigo = "";
    }
    if (codigo) usados.set(codigo, linha.produtoId);
    return { linhaId: linha.id, produtoId: linha.produtoId, codigo };
  });
  return { codigosProdutos, pendencias };
}

/** Snapshots antigos continuam vinculados pelo código/ID originalmente enviado.
 * Os novos comprovam a associação por posição e pelas duas identidades internas. */
export function codigoFiscalCorrespondeProduto(tributacao: unknown, indice: number, produtoId: unknown, produtoFiscal?: unknown) {
  const t = objeto(tributacao), produtos = objeto(t.documento).Produtos;
  const produto = objeto(produtoFiscal ?? (Array.isArray(produtos) ? produtos[indice] : null));
  if (t.codigosProdutos === undefined) return typeof produtoId === "string" && produto.CodProdutoServico === produtoId;
  if (!Array.isArray(t.codigosProdutos)) return false;
  const referencia = objeto(t.codigosProdutos[indice]), linhas = objeto(t.previa).linhas;
  const linha = objeto(Array.isArray(linhas) ? linhas[indice] : null);
  return typeof produtoId === "string" && referencia.produtoId === produtoId && linha.produtoId === produtoId
    && typeof referencia.linhaId === "string" && referencia.linhaId.length > 0 && referencia.linhaId === linha.id
    && codigoDaIdentidadeValido(produtoId, referencia.codigo) && referencia.codigo === produto.CodProdutoServico;
}

export function referenciasCodigosProdutosFiscaisValidas(tributacao: unknown) {
  const t = objeto(tributacao);
  if (t.codigosProdutos === undefined) return true;
  const produtos = objeto(t.documento).Produtos, linhas = objeto(t.previa).linhas;
  if (!Array.isArray(t.codigosProdutos) || !Array.isArray(produtos) || !Array.isArray(linhas)
    || t.codigosProdutos.length !== produtos.length || linhas.length !== produtos.length) return false;
  const codigos = new Map<string, unknown>(), ids = new Map<unknown, string>();
  return t.codigosProdutos.every((v, indice) => {
    const referencia = objeto(v);
    if (!codigoFiscalCorrespondeProduto(t, indice, referencia.produtoId) || typeof referencia.codigo !== "string"
      || codigos.has(referencia.codigo) && codigos.get(referencia.codigo) !== referencia.produtoId
      || ids.has(referencia.produtoId) && ids.get(referencia.produtoId) !== referencia.codigo) return false;
    codigos.set(referencia.codigo, referencia.produtoId); ids.set(referencia.produtoId, referencia.codigo);
    return true;
  });
}
