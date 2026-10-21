import type { RepasseFciFornecedor } from "./tipos";

export function dataRepasseFciValida(v: unknown): v is string {
  if (typeof v !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(v)) return false;
  const data = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === v;
}

export function validarRepasseFciFornecedor(entrada: unknown): RepasseFciFornecedor {
  const erro = () => { throw new Error("FCI: prova de entrada do fornecedor inválida."); };
  const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : erro();
  const id = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : erro();
  const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : erro();
  const d = objeto(entrada);
  if (Object.keys(d).some(k => !["insumoId", "registro"].includes(k))) erro();
  const r: RepasseFciFornecedor = { insumoId: id(d.insumoId) };
  if (d.registro !== undefined) {
    const p = objeto(d.registro);
    if (Object.keys(p).some(k => !["algoritmo", "natureza", "ncm", "origem", "materiaisHash", "documentos"].includes(k)) || p.algoritmo !== "grazing.fci-fornecedor.v1" || !["FRACIONADO", "REVENDA"].includes(String(p.natureza)) || typeof p.ncm !== "string" || !/^\d{8}$/.test(p.ncm) || !["3", "5", "8"].includes(String(p.origem)) || !Array.isArray(p.documentos) || !p.documentos.length || p.documentos.length > 100) erro();
    const documentos = (p.documentos as unknown[]).map(v => {
      const n = objeto(v);
      if (Object.keys(n).some(k => !["itemId", "numeroItem", "xmlHash", "dataEmissao"].includes(k)) || !Number.isInteger(n.numeroItem) || Number(n.numeroItem) < 1 || Number(n.numeroItem) > 990 || !dataRepasseFciValida(n.dataEmissao)) erro();
      return { itemId: id(n.itemId), numeroItem: n.numeroItem as number, xmlHash: hash(n.xmlHash), dataEmissao: n.dataEmissao as string };
    });
    if (new Set(documentos.map(n => n.itemId)).size !== documentos.length) erro();
    r.registro = { algoritmo: "grazing.fci-fornecedor.v1", natureza: p.natureza as "FRACIONADO" | "REVENDA", ncm: p.ncm as string, origem: p.origem as string, materiaisHash: hash(p.materiaisHash), documentos };
  }
  return r;
}
