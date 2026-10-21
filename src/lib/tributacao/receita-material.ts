import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { ErroEstruturaFiscal } from "./validacao";

export type MaterialFiscalFotografado = { insumoId: string; hash: string; transitiva: boolean };
export type FotografiaMateriaisFiscal = { algoritmo: "grazing.material-fiscal.v1"; insumos: MaterialFiscalFotografado[] };
type Material = {
  id: string; tipo: string; unidade: string; especificacao: string | null; marca: string | null;
  marcasHomologadas: string[]; codigoEan: string | null; rendimentoQuantidade: string | null;
  rendimentoUnidade: string | null; modoPreparoTexto: string;
};
type Aresta = { produtoId: string; componenteId: string; quantidade: string };
const D = Prisma.Decimal.clone({ precision: 80 });
const MAX_NOS = 2000, MAX_NIVEIS = 20;
const idValido = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id);
function falha(motivo: string): never { throw new ErroEstruturaFiscal(`Receita material fiscal: ${motivo}`); }
function decimal(valor: string): string {
  if (typeof valor !== "string" || !/^\d{1,12}(\.\d{1,9})?$/.test(valor)) return falha("quantidade física inválida.");
  const d = new D(valor);
  if (!d.isFinite() || d.lte(0)) return falha("quantidade física precisa ser positiva.");
  return d.toString();
}
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** Somente leitura na transação autorizada do chamador; não consulta conexão global ou estoque. */
export async function fotografarMateriais(tx: Prisma.TransactionClient, insumoIds: string[]): Promise<FotografiaMateriaisFiscal> {
  if (!Array.isArray(insumoIds) || insumoIds.length > MAX_NOS || insumoIds.some(id => !idValido(id))) return falha("identidades de materiais inválidas ou excessivas.");
  const raizes = [...new Set(insumoIds)].sort();
  const nos = new Map<string, Material>(), arestas = new Map<string, Aresta[]>();
  let fronteira = raizes, bytes = 0, niveisLidos = 0;
  while (fronteira.length) {
    if (++niveisLidos > MAX_NIVEIS) return falha("receita excede vinte níveis de materiais.");
    if (nos.size + fronteira.length > MAX_NOS) return falha("grafo excede dois mil materiais.");
    const encontrados = await tx.$queryRaw<Material[]>(Prisma.sql`
      SELECT id, tipo::text AS tipo, unidade::text AS unidade, especificacao, marca,
             "marcasHomologadas", "codigoEan", "rendimentoQuantidade"::text AS "rendimentoQuantidade",
             "rendimentoUnidade"::text AS "rendimentoUnidade", "modoPreparo"::text AS "modoPreparoTexto"
        FROM "Insumo" WHERE id IN (${Prisma.join(fronteira)}) ORDER BY id`);
    if (encontrados.length !== fronteira.length || new Set(encontrados.map(n => n.id)).size !== fronteira.length || encontrados.some(n => !fronteira.includes(n.id))) return falha("material ou descendente ausente no cadastro.");
    for (const n of encontrados) {
      if (!Array.isArray(n.marcasHomologadas) || n.marcasHomologadas.some(m => typeof m !== "string") || typeof n.modoPreparoTexto !== "string") return falha("atributos materiais não representáveis.");
      // PostgreSQL fornece o JSONB canônico como texto: não arredondar números desconhecidos em JSON.parse.
      const material = { ...n, marcasHomologadas: [...new Set(n.marcasHomologadas)].sort(), rendimentoQuantidade: n.rendimentoQuantidade === null ? null : decimal(n.rendimentoQuantidade) };
      bytes += Buffer.byteLength(JSON.stringify(material));
      if (bytes > 16_000_000) return falha("grafo material excede o limite de leitura.");
      nos.set(n.id, material); arestas.set(n.id, []);
    }
    const composicoes = await tx.$queryRaw<Aresta[]>(Prisma.sql`
      SELECT "produtoId", "componenteId", quantidade::text AS quantidade
        FROM "ComposicaoInsumo" WHERE "produtoId" IN (${Prisma.join(fronteira)})
        ORDER BY "produtoId", "componenteId"`);
    const proximos = new Set<string>();
    for (const c of composicoes) {
      if (!arestas.has(c.produtoId) || !idValido(c.componenteId)) return falha("identidade de componente inválida.");
      const lista = arestas.get(c.produtoId)!;
      if (lista.some(a => a.componenteId === c.componenteId)) return falha("componente repetido na receita.");
      lista.push({ produtoId: c.produtoId, componenteId: c.componenteId, quantidade: decimal(c.quantidade) });
      if (!nos.has(c.componenteId)) proximos.add(c.componenteId);
    }
    fronteira = [...proximos].sort();
  }
  const calculados = new Map<string, { hash: string; niveis: number }>(), caminho = new Set<string>();
  function visitar(id: string): { hash: string; niveis: number } {
    if (caminho.has(id)) return falha("receita circular; conferir a composição afetada.");
    const pronto = calculados.get(id); if (pronto) return pronto;
    if (caminho.size >= MAX_NIVEIS) return falha("receita excede vinte níveis de materiais.");
    caminho.add(id);
    const filhos = [...arestas.get(id)!].sort((a, b) => a.componenteId < b.componenteId ? -1 : a.componenteId > b.componenteId ? 1 : 0).map(c => ({ componenteId: c.componenteId, quantidade: c.quantidade, descendente: visitar(c.componenteId) }));
    const niveis = 1 + Math.max(0, ...filhos.map(c => c.descendente.niveis));
    if (niveis > MAX_NIVEIS) return falha("receita excede vinte níveis de materiais.");
    const material = nos.get(id)!;
    const resultado = { hash: hash({ material: { id: material.id, tipo: material.tipo, unidade: material.unidade, especificacao: material.especificacao, marca: material.marca, marcasHomologadas: material.marcasHomologadas, codigoEan: material.codigoEan, rendimentoQuantidade: material.rendimentoQuantidade, rendimentoUnidade: material.rendimentoUnidade, modoPreparoTexto: material.modoPreparoTexto }, componentes: filhos.map(c => ({ componenteId: c.componenteId, quantidade: c.quantidade, hash: c.descendente.hash })) }), niveis };
    caminho.delete(id); calculados.set(id, resultado); return resultado;
  }
  return { algoritmo: "grazing.material-fiscal.v1", insumos: raizes.map(insumoId => ({ insumoId, hash: visitar(insumoId).hash, transitiva: !!arestas.get(insumoId)?.length })) };
}
