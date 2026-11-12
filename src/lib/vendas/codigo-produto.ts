/** Código comercial; nunca substitui o identificador técnico do cadastro. */
export const LIMITE_CODIGO_PRODUTO = 8;
export function codigoProdutoValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^[A-Z0-9]{1,8}$/.test(valor);
}
export class ErroCodigoProduto extends Error {}
type Escopo = "PRODUTO" | "COMPLEMENTO";
export type CategoriaCodigo = { id: string; escopo: string; nome: string; ordem: number };
export type EstadoCodigosProdutos = {
  versao: 1;
  categorias: Record<string, { escopo: Escopo; numero: number }>;
  ultimos: Record<string, number>;
};
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const falha = () => { throw new ErroCodigoProduto("A organização dos códigos precisa de conferência administrativa. Nenhum código foi alterado."); };
export function lerEstadoCodigosProdutos(valor: unknown): EstadoCodigosProdutos {
  if (valor == null) return { versao: 1, categorias: {}, ultimos: {} };
  if (!objeto(valor) || valor.versao !== 1 || !objeto(valor.categorias) || !objeto(valor.ultimos) || Object.keys(valor.categorias).length > 198 || Object.keys(valor.ultimos).length > 200) return falha();
  const categorias: EstadoCodigosProdutos["categorias"] = {}, ultimos: Record<string, number> = {}, usados = new Set<string>();
  for (const [id, item] of Object.entries(valor.categorias)) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || ["__proto__", "constructor", "prototype"].includes(id) || !objeto(item) || !["PRODUTO", "COMPLEMENTO"].includes(String(item.escopo)) || !Number.isInteger(item.numero) || Number(item.numero) < 1 || Number(item.numero) > 99) return falha();
    const escopo = item.escopo as Escopo, numero = Number(item.numero), chave = `${escopo}:${numero}`;
    if (usados.has(chave)) return falha();
    usados.add(chave); categorias[id] = { escopo, numero };
  }
  for (const [prefixo, ultimo] of Object.entries(valor.ultimos)) {
    if (!/^[PC]\d{2}$/.test(prefixo) || !Number.isInteger(ultimo) || Number(ultimo) < 0 || Number(ultimo) > 99999) return falha();
    ultimos[prefixo] = Number(ultimo);
  }
  return { versao: 1, categorias, ultimos };
}
export function prepararFamiliasCodigos(estado: EstadoCodigosProdutos, categorias: CategoriaCodigo[]): EstadoCodigosProdutos {
  const copia = lerEstadoCodigosProdutos(estado);
  const ordenadas = [...categorias].sort((a, b) => a.escopo.localeCompare(b.escopo) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
  for (const c of ordenadas) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(c.id) || ["__proto__", "constructor", "prototype"].includes(c.id)) return falha();
    if (c.escopo !== "PRODUTO" && c.escopo !== "COMPLEMENTO") return falha();
    if (copia.categorias[c.id]) { if (copia.categorias[c.id].escopo !== c.escopo) return falha(); continue; }
    const maior = Math.max(0, ...Object.values(copia.categorias).filter(v => v.escopo === c.escopo).map(v => v.numero));
    if (maior >= 99) throw new ErroCodigoProduto("Limite de 99 famílias por classificação atingido. Nenhum código foi reutilizado.");
    copia.categorias[c.id] = { escopo: c.escopo, numero: maior + 1 };
  }
  return copia;
}
export function registrarCodigosExistentes(estado: EstadoCodigosProdutos, codigos: (string | null)[]) {
  for (const codigo of codigos) {
    const m = codigo && /^([PC]\d{2})(\d{5})$/.exec(codigo);
    if (m) estado.ultimos[m[1]] = Math.max(estado.ultimos[m[1]] ?? 0, Number(m[2]));
  }
}
export function proximoCodigoProduto(estado: EstadoCodigosProdutos, classificacao: string, categorias: string[]): string {
  const escopo: Escopo = classificacao === "COMPLEMENTO" ? "COMPLEMENTO" : "PRODUTO";
  const familias = categorias.map(id => estado.categorias[id]).filter(c => c?.escopo === escopo).sort((a, b) => a.numero - b.numero);
  const prefixo = `${escopo === "PRODUTO" ? "P" : "C"}${String(familias[0]?.numero ?? 0).padStart(2, "0")}`;
  const numero = (estado.ultimos[prefixo] ?? 0) + 1;
  if (numero > 99999) throw new ErroCodigoProduto("A família atingiu 99999 itens. Nenhum código foi reutilizado.");
  estado.ultimos[prefixo] = numero;
  return `${prefixo}${String(numero).padStart(5, "0")}`;
}
