import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { fotografarMateriais } from "@/lib/tributacao/receita-material";

type MaterialFicticio = { id: string; tipo: string; unidade: string; especificacao: string | null; marca: string | null; marcasHomologadas: string[]; codigoEan: string | null; rendimentoQuantidade: string | null; rendimentoUnidade: string | null; modoPreparoTexto: string; [campo: string]: unknown };
function material(id: string, extra: Partial<MaterialFicticio> = {}): MaterialFicticio {
  return { id, tipo: "INSUMO", unidade: "KG", especificacao: null, marca: null, marcasHomologadas: [], codigoEan: null, rendimentoQuantidade: null, rendimentoUnidade: null, modoPreparoTexto: "[]", ...extra };
}
function banco(nos: ReturnType<typeof material>[], arestas: { produtoId: string; componenteId: string; quantidade: string }[] = []) {
  const consulta = vi.fn(async (sql: Prisma.Sql) => {
    const ids = sql.values as string[];
    return sql.text.includes('FROM "ComposicaoInsumo"') ? arestas.filter(c => ids.includes(c.produtoId)) : nos.filter(n => ids.includes(n.id));
  });
  return { tx: { $queryRaw: consulta } as unknown as Prisma.TransactionClient, consulta };
}
async function foto(nos: ReturnType<typeof material>[], arestas: { produtoId: string; componenteId: string; quantidade: string }[] = [], ids = [nos[0].id]) {
  return fotografarMateriais(banco(nos, arestas).tx, ids);
}

describe("fotografia material fiscal transitiva, somente fixtures fictícias", () => {
  it("alterar ingrediente, proporção, rendimento ou processo do intermediário invalida a raiz sem trocar seuID", async () => {
    const nos = [material("preparacao", { tipo: "PRODUTO_INTERMEDIARIO", rendimentoQuantidade: "3.000", rendimentoUnidade: "KG", modoPreparoTexto: '["Processar"]' }), material("queijo"), material("vegetal")];
    const cs = [{ produtoId: "preparacao", componenteId: "queijo", quantidade: "2.000000000" }, { produtoId: "preparacao", componenteId: "vegetal", quantidade: "1.000000000" }];
    const original = await foto(nos, cs);
    expect(original.insumos[0].transitiva).toBe(true);
    expect(await foto(nos, cs.map(c => c.componenteId === "queijo" ? { ...c, quantidade: "0.100000001" } : c))).not.toEqual(original);
    expect(await foto(nos.map(n => n.id === "queijo" ? { ...n, especificacao: "Mercadoria diferente" } : n), cs)).not.toEqual(original);
    expect(await foto(nos.map(n => n.id === "preparacao" ? { ...n, rendimentoQuantidade: "4" } : n), cs)).not.toEqual(original);
    expect(await foto(nos.map(n => n.id === "preparacao" ? { ...n, modoPreparoTexto: '["Assar"]' } : n), cs)).not.toEqual(original);
  });
  it("ordem de nós/raízes/arestas/marcas e representação decimal não alteram o hash", async () => {
    const ns = [material("pai"), material("a", { marcasHomologadas: ["A", "B"] }), material("b")];
    const cs = [{ produtoId: "pai", componenteId: "a", quantidade: "0.123456789" }, { produtoId: "pai", componenteId: "b", quantidade: "2.000000000" }];
    const a = await foto(ns, cs, ["pai", "a", "pai"]);
    const b = await foto([...ns].reverse().map(n => n.id === "a" ? { ...n, marcasHomologadas: ["B", "A"] } : n), [...cs].reverse().map(c => c.componenteId === "b" ? { ...c, quantidade: "2" } : c), ["a", "pai"]);
    expect(a).toEqual(b); expect(a.insumos.map(n => n.insumoId)).toEqual(["a", "pai"]);
  });
  it("ignora preços, nomes, fotos e auditoria; detecta identidade comercial/material", async () => {
    const n = material("a", { nome: "Nome inicial", custoMedio: "1", updatedAt: "data-inicial", foto: "bytes" });
    const original = await foto([n]);
    expect(await foto([{ ...n, nome: "Renomeado", custoMedio: "2", updatedAt: "outra-data", foto: "outra-foto" }])).toEqual(original);
    for (const extra of [{ tipo: "PRODUTO_INTERMEDIARIO" }, { unidade: "UN" }, { marca: "Marca alternativa" }, { codigoEan: "codigo-ficticio" }]) expect(await foto([{ ...n, ...extra }])).not.toEqual(original);
  });
  it("conserva precisão de texto JSONB e nove casas físicas sem Number nem precisão global20", async () => {
    const a = await foto([material("pai", { modoPreparoTexto: '{"legado":9007199254740993}' }), material("filho")], [{ produtoId: "pai", componenteId: "filho", quantidade: "999999999.123456789" }]);
    const b = await foto([material("pai", { modoPreparoTexto: '{"legado":9007199254740992}' }), material("filho")], [{ produtoId: "pai", componenteId: "filho", quantidade: "999999999.123456789" }]);
    const c = await foto([material("pai", { modoPreparoTexto: '{"legado":9007199254740993}' }), material("filho")], [{ produtoId: "pai", componenteId: "filho", quantidade: "999999999.123456788" }]);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });
  it("DAG compartilhado é aceito; ciclo, descendente ausente, receita repetida e quantidade inválida bloqueiam", async () => {
    const ns = [material("a"), material("b"), material("c")];
    const cs = [{ produtoId: "a", componenteId: "c", quantidade: "1" }, { produtoId: "b", componenteId: "c", quantidade: "2" }];
    expect((await foto(ns, cs, ["a", "b"])).insumos).toHaveLength(2);
    await expect(foto(ns, [...cs, { produtoId: "c", componenteId: "a", quantidade: "1" }])).rejects.toThrow("circular");
    await expect(foto(ns.slice(0, 2), cs)).rejects.toThrow("ausente");
    await expect(foto(ns, [...cs, cs[0]])).rejects.toThrow("repetido");
    for (const quantidade of ["0", "-1", "NaN", "0.0000000001"]) await expect(foto(ns, [{ ...cs[0], quantidade }])).rejects.toThrow("quantidade física");
  });
  it("limita grafo e profundidade mesmo quando descendente já está em cache por outra raiz", async () => {
    const ns = Array.from({ length: 21 }, (_, i) => material(`no-${i}`));
    const cs = ns.slice(0, -1).map((n, i) => ({ produtoId: n.id, componenteId: ns[i + 1].id, quantidade: "1" }));
    expect((await foto(ns, cs, ["no-1"])).insumos).toHaveLength(1);
    await expect(foto(ns, cs, ["no-0", "no-20"])).rejects.toThrow("vinte níveis");
    await expect(foto(ns, [], Array.from({ length: 2001 }, (_, i) => `id-${i}`))).rejects.toThrow("excessivas");
    const muitos = Array.from({ length: 2001 }, (_, i) => material(`id-${i}`));
    await expect(foto(muitos, muitos.slice(1).map(n => ({ produtoId: "id-0", componenteId: n.id, quantidade: "1" })))).rejects.toThrow("dois mil");
  });
  it("vazio não consulta banco e raízes inválidas são rejeitadas antes de qualquer leitura", async () => {
    const b = banco([]);
    expect(await fotografarMateriais(b.tx, [])).toEqual({ algoritmo: "grazing.material-fiscal.v1", insumos: [] });
    await expect(fotografarMateriais(b.tx, ["../segredo"])).rejects.toThrow("identidades");
    expect(b.consulta).not.toHaveBeenCalled();
  });
});
