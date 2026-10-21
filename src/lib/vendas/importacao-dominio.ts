import { ErroCadastroVenda, decimal, objeto, texto, validarGrupo, validarProduto, type ProdutoEntrada, type GrupoEntrada } from "./dominio";

export type CategoriaImportada = { chave: string; nome: string };
export type GrupoImportado = Omit<GrupoEntrada, "id" | "versao" | "opcoes"> & {
  chave: string;
  opcoes: { chave: string; nome: string; preco: string; produtoChave: string | null; quantidade: string; ativo: boolean }[];
};
export type ProdutoImportado = Pick<ProdutoEntrada, "nome" | "especificacao" | "descricao" | "tipo" | "unidade" | "categorias" | "preco"> & {
  chave: string;
  grupos: { chave: string; usarPadrao: boolean; minimo: number; maximo: number | null }[];
  pendencias: string[];
};
export type PacoteCatalogo = { formato: 1; origem: "IFOOD" | "TAKEAT" | "OUTRO"; loja: string; referencia: string; categorias: CategoriaImportada[]; grupos: GrupoImportado[]; produtos: ProdutoImportado[] };

function lista(v: unknown, nome: string, maximo: number): unknown[] {
  if (!Array.isArray(v) || v.length > maximo) throw new ErroCadastroVenda(`${nome}: lista inválida ou acima da capacidade de um lote.`);
  return v;
}
function chave(v: unknown) { return texto(v, "Identidade na origem", 100, true); }
function unicas(itens: { chave: string }[], nome: string) {
  if (new Set(itens.map(i => i.chave)).size !== itens.length) throw new ErroCadastroVenda(`${nome}: identidade externa repetida no mesmo contexto.`);
}

/** Pacote revisável: não é promessa de compatibilidade com exportações proprietárias. */
export function lerPacoteCatalogo(conteudo: unknown): PacoteCatalogo {
  if (typeof conteudo !== "string" || conteudo.length > 2_000_000) throw new ErroCadastroVenda("Envie um pacote JSON de catálogo de até 2 MB.");
  let bruto: unknown;
  try { bruto = JSON.parse(conteudo); } catch { throw new ErroCadastroVenda("O arquivo não contém JSON válido."); }
  const d = objeto(bruto);
  if (d.formato !== 1 || !["IFOOD", "TAKEAT", "OUTRO"].includes(String(d.origem))) throw new ErroCadastroVenda("Formato de pacote ou origem não suportado.");
  const categorias = lista(d.categorias, "Categorias", 100).map(v => { const c = objeto(v); return { chave: chave(c.chave), nome: texto(c.nome, "Nome da categoria", 120, true) }; });
  const grupos = lista(d.grupos, "Grupos", 200).map(v => {
    const g = objeto(v); const originais = lista(g.opcoes, "Opções", 500).map(objeto);
    const validado = validarGrupo({ ...g, id: "", versao: 0, ativo: true, opcoes: originais.map(o => ({ ...o, id: "", produtoId: null, quantidade: o.quantidade ?? "1", ativo: o.ativo ?? true })) });
    const { id: _id, versao: _versao, opcoes, ...dados } = validado;
    void _id; void _versao;
    const resultado = { ...dados, chave: chave(g.chave), opcoes: opcoes.map((o, i) => ({ chave: chave(originais[i].chave), nome: o.nome, preco: o.preco, quantidade: o.quantidade, ativo: o.ativo, produtoChave: originais[i].produtoChave == null ? null : chave(originais[i].produtoChave) })) };
    unicas(resultado.opcoes, `Opções de ${resultado.nome}`);
    return resultado;
  });
  if (grupos.filter(g => g.tipo === "EXTRAS").length > 1) throw new ErroCadastroVenda("Normalize as opções em um único grupo de Extras antes de importar. Limites são sempre opcionais e ilimitados.");
  const produtos = lista(d.produtos, "Produtos", 500).map(v => {
    const p = objeto(v);
    // Compatibilidade de entrada: a matriz externa é consolidada antes do cadastro.
    const { precos: legados, precoComplemento: legadoComplemento, ...produto } = p;
    let preco = p.preco;
    if (preco == null && legados != null) {
      const valores = lista(legados, "Preços da origem", 100).map(v => {
        const valor = objeto(v);
        const canal = texto(valor.canal, "Canal da origem", 60, true).toUpperCase();
        const base = decimal(valor.preco, "Preço da origem", true);
        const promocao = valor.precoPromocional == null ? null : decimal(valor.precoPromocional, "Preço promocional da origem", true);
        if (promocao !== null && Number(promocao) > Number(base)) throw new ErroCadastroVenda("O preço promocional da origem não pode exceder o preço-base.");
        return { canal, preco: promocao ?? base };
      });
      if (new Set(valores.map(v => v.canal)).size !== valores.length) throw new ErroCadastroVenda("Canal repetido na origem.");
      preco = valores.find(v => v.canal === "SITE")?.preco ?? legadoComplemento ?? valores.find(v => v.canal === "IFOOD")?.preco ?? valores[0]?.preco ?? "0";
    }
    preco ??= legadoComplemento ?? "0";
    const gs = lista(p.grupos, "Grupos do produto", 50).map(objeto).map(g => grupos.some(origem => origem.chave === g.chave && origem.tipo === "EXTRAS") ? { ...g, usarPadrao: true, minimo: 0, maximo: null } : g);
    const validado = validarProduto({ ...produto, preco, id: "", versao: 0, codigo: null, fotoUrl: null, ativo: false, unidade: p.unidade ?? "UN", componentes: [], observacoes: null, modoPreparo: null, grupos: gs.map(g => ({ ...g, grupoId: chave(g.chave) })) });
    return { chave: chave(p.chave), nome: validado.nome, especificacao: validado.especificacao, descricao: validado.descricao, tipo: validado.tipo, unidade: validado.unidade, categorias: validado.categorias, preco: validado.preco, grupos: validado.grupos.map(g => ({ chave: g.grupoId, usarPadrao: g.usarPadrao, minimo: g.minimo, maximo: g.maximo })), pendencias: lista(p.pendencias ?? [], "Pendências", 30).map(v => texto(v, "Pendência", 300, true)) };
  });
  unicas(categorias, "Categorias"); unicas(grupos, "Grupos"); unicas(produtos, "Produtos");
  for (const p of produtos) {
    if (p.categorias.some(c => !categorias.some(a => a.chave === c)) || p.grupos.some(g => !grupos.some(a => a.chave === g.chave))) throw new ErroCadastroVenda(`${p.nome}: categoria ou grupo não foi incluído no pacote.`);
  }
  for (const g of grupos) for (const o of g.opcoes) if (o.produtoChave) {
    const p = produtos.find(p => p.chave === o.produtoChave);
    if (!p || p.grupos.length) throw new ErroCadastroVenda(`${g.nome} / ${o.nome}: o produto de composição precisa estar no pacote e não pode ter grupos aninhados.`);
  }
  return { formato: 1, origem: d.origem as PacoteCatalogo["origem"], loja: texto(d.loja, "Identificação da loja na origem", 160, true), referencia: texto(d.referencia, "Referência da coleta", 500, true), categorias, grupos, produtos };
}
