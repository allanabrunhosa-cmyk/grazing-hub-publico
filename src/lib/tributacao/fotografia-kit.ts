import { Prisma } from "@/generated/prisma/client";
import type { ClassificacaoFiscal, FotografiaKitFiscal, ItemComercialFiscal, MateriaisFiscaisFotografados } from "./tipos";
import { hashTecnico } from "./fotografia-tecnica";
import { ErroEstruturaFiscal } from "./validacao";

const D = Prisma.Decimal.clone({ precision: 80 });
type Componente = NonNullable<ClassificacaoFiscal["componentesKit"]>[number];
const idValido = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const hashValido = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function falha(): never { throw new ErroEstruturaFiscal("Kit sem fotografia íntegra da composição e do rateio vendidos; conferir somente esta operação."); }
function quantidade(v: unknown) {
  if (typeof v !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(v)) return falha();
  const d = new D(v);
  if (!d.isFinite() || d.lte(0)) return falha();
  return d.toString();
}
function texto(v: unknown, max: number, obrigatorio = false): string | null {
  if (v === undefined && !obrigatorio) return null;
  if (typeof v !== "string" || !v.trim() || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) return falha();
  return v.trim();
}
function materiaisValidos(v: unknown): v is MateriaisFiscaisFotografados {
  if (!objeto(v) || v.algoritmo !== "grazing.material-fiscal.v1" || !Array.isArray(v.insumos) || v.insumos.length > 2000) return false;
  const ids = new Set<string>();
  for (const i of v.insumos) {
    if (!objeto(i) || !idValido(i.insumoId) || ids.has(i.insumoId) || !hashValido(i.hash) || typeof i.transitiva !== "boolean") return false;
    ids.add(i.insumoId);
  }
  return true;
}
function conferirReceita(v: unknown, escolhas: NonNullable<Componente["escolhas"]>): asserts v is NonNullable<ItemComercialFiscal["receitaFotografada"]> {
  if (!objeto(v) || !hashValido(v.principalHash) || !Array.isArray(v.opcaoHashes) || v.opcaoHashes.length !== escolhas.length || !objeto(v.materiais) || !materiaisValidos(v.materiais.principal) || !Array.isArray(v.materiais.opcoes) || v.materiais.opcoes.length !== escolhas.length) return falha();
  const ids = new Set<string>(), materiaisIds = new Set<string>();
  for (const h of v.opcaoHashes) {
    if (!objeto(h) || !idValido(h.opcaoId) || ids.has(h.opcaoId) || !escolhas.some(e => e.opcaoId === h.opcaoId) || !hashValido(h.hash)) return falha();
    ids.add(h.opcaoId);
  }
  for (const m of v.materiais.opcoes) {
    if (!objeto(m) || !idValido(m.opcaoId) || materiaisIds.has(m.opcaoId) || !ids.has(m.opcaoId) || !materiaisValidos(m.materiais)) return falha();
    materiaisIds.add(m.opcaoId);
  }
}
function politica(componentes: unknown) {
  if (!Array.isArray(componentes) || !componentes.length || componentes.length > 100) return falha();
  const identidades = new Set<string>();
  const linhas = componentes.map((k: unknown) => {
    if (!objeto(k) || !!k.produtoId === !!k.referenciaInternaInsumoId || k.produtoId !== undefined && !idValido(k.produtoId) || k.referenciaInternaInsumoId !== undefined && !idValido(k.referenciaInternaInsumoId)) return falha();
    const interna = !!k.referenciaInternaInsumoId;
    const descricao = texto(k.descricao, 120, interna);
    if (interna && k.unidade === undefined || k.unidade !== undefined && (typeof k.unidade !== "string" || !/^[A-Z0-9]{1,6}$/.test(k.unidade))) return falha();
    if (k.escolhas !== undefined && (interna || !Array.isArray(k.escolhas) || k.escolhas.length > 20)) return falha();
    const escolhaIds = new Set<string>();
    const escolhas = ((k.escolhas ?? []) as unknown[]).map(e => {
      if (!objeto(e) || !idValido(e.opcaoId) || !idValido(e.grupoId) || escolhaIds.has(e.opcaoId)) return falha();
      escolhaIds.add(e.opcaoId);
      return { opcaoId: e.opcaoId, grupoId: e.grupoId, quantidade: quantidade(e.quantidade) };
    }).sort((a, b) => a.opcaoId.localeCompare(b.opcaoId));
    conferirReceita(k.receitaFotografada, escolhas);
    const referencia = interna ? { referenciaInternaInsumoId: k.referenciaInternaInsumoId } : { produtoId: k.produtoId };
    const identidade = hashTecnico({ referencia, escolhas });
    if (identidades.has(identidade)) return falha();
    identidades.add(identidade);
    return { referencia, descricao, unidade: k.unidade ?? null, quantidade: quantidade(k.quantidade), pesoRateio: quantidade(k.pesoRateio), escolhas };
  });
  // Reordenar o cadastro não muda o conteúdo vendido. O clone original mantém a
  // ordem do pedido, inclusive o desempate de centavos do seu rateio.
  return linhas.sort((a, b) => hashTecnico(a).localeCompare(hashTecnico(b)));
}
function hashPolitica(c: ClassificacaoFiscal) {
  if (!c || c.tratamento !== "KIT_COMPOSTO") return falha();
  return hashTecnico({ algoritmo: "grazing.kit-fiscal.v1", componentes: politica(c.componentesKit) });
}

/** Recebe somente dados já fotografados pelo servidor; não consulta ou modifica catálogo. */
export function fotografarPoliticaKit(c: ClassificacaoFiscal, versaoId: string): FotografiaKitFiscal {
  if (!idValido(versaoId)) return falha();
  const hash = hashPolitica(c);
  return { algoritmo: "grazing.kit-fiscal.v1", classificacaoVersaoId: versaoId, hashPolitica: hash, componentes: structuredClone(c.componentesKit!) };
}

/** A política deve continuar compatível; as receitas usadas continuam sendo as
 * fotografadas no pedido, nunca as de uma classificação futura. */
export function conferirPoliticaKit(c: ClassificacaoFiscal, foto: unknown): foto is FotografiaKitFiscal {
  try {
    if (!objeto(foto) || foto.algoritmo !== "grazing.kit-fiscal.v1" || !idValido(foto.classificacaoVersaoId) || !hashValido(foto.hashPolitica)) return false;
    const original = hashTecnico({ algoritmo: "grazing.kit-fiscal.v1", componentes: politica(foto.componentes) });
    return original === foto.hashPolitica && original === hashPolitica(c);
  } catch { return false; }
}
