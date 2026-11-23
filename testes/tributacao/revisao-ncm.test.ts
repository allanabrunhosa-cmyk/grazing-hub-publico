import { describe, expect, it, vi } from "vitest";
import { diferencasMateriais } from "@/lib/tributacao/revisao-ncm-dominio";
import type { MateriaisFiscaisFotografados } from "@/lib/tributacao/tipos";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { montarEmailRevisaoNcm } from "@/lib/tributacao/revisao-ncm-alerta";

// Identidades e hashes exclusivamente fictícios.
const materiais = (...insumos: [string, string, boolean][]): MateriaisFiscaisFotografados => ({ algoritmo: "grazing.material-fiscal.v1", insumos: insumos.map(([insumoId, hash, transitiva]) => ({ insumoId, hash, transitiva })) });

describe("Revisão de NCM: diferenças de composição", () => {
  it("marca de insumo simples não diverge nem muda a assinatura", () => {
    const d = diferencasMateriais(materiais(["queijo", "a", false], ["pate", "p1", true]), materiais(["queijo", "marca-nova", false], ["pate", "p1", true]));
    expect(d).toMatchObject({ diverge: false, incluidos: [], retirados: [], preparacoesAlteradas: [] });
    expect(d.assinatura).toBe(diferencasMateriais(undefined, materiais(["pate", "p1", true], ["queijo", "outra-marca", false])).assinatura);
  });
  it("identifica ingrediente incluído, retirado, preparação alterada e insumo que virou preparação", () => {
    const d = diferencasMateriais(materiais(["queijo", "a", false], ["pate", "p1", true], ["salame", "s", false], ["molho", "m", false]), materiais(["pate", "p2", true], ["salame", "s", false], ["tender", "t", false], ["molho", "m2", true]));
    expect(d).toMatchObject({ diverge: true, incluidos: ["tender"], retirados: ["queijo"], preparacoesAlteradas: ["molho", "pate"] });
    expect(d.assinatura).not.toBe(diferencasMateriais(undefined, materiais(["pate", "p1", true], ["salame", "s", false], ["tender", "t", false], ["molho", "m2", true])).assinatura);
  });
  it("fotografia ausente de um lado aparece como inclusão ou retirada integral", () => {
    expect(diferencasMateriais(undefined, materiais(["queijo", "a", false]))).toMatchObject({ diverge: true, incluidos: ["queijo"] });
    expect(diferencasMateriais(materiais(["queijo", "a", false]), undefined)).toMatchObject({ diverge: true, retirados: ["queijo"] });
  });
});

describe("Revisão de NCM: e-mail de alerta", () => {
  const pendente = (n: number, nome = `Produto fictício ${n}`) => ({ versaoId: `v${n}`, produtoId: `p${n}`, nome, codigo: null, ncms: ["08061000"], analisadoEm: "2026-10-21", mudancas: ["Ingrediente incluído: Insumo fictício"], assinatura: String(n).padStart(64, "0") });
  it("explica que o NCM é mantido, lista as mudanças e aponta para o painel", () => {
    const m = montarEmailRevisaoNcm([pendente(1)], "https://exemplo.invalid");
    expect(m.subject).toBe("1 produto precisa de revisão de NCM — Grazing HUB");
    expect(m.text).toContain("Produto fictício 1 (NCM 08061000)"); expect(m.text).toContain("Ingrediente incluído: Insumo fictício");
    expect(m.text).toContain("ele só muda com a sua decisão"); expect(m.text).toContain("https://exemplo.invalid/financeiro/fiscal#revisao-ncm");
    expect(m.html).toContain('href="https://exemplo.invalid/financeiro/fiscal#revisao-ncm"');
  });
  it("escapa nomes no HTML e resume listas longas", () => {
    const m = montarEmailRevisaoNcm([pendente(0, `<script>alert("x")</script> & Cia`), ...Array.from({ length: 34 }, (_, n) => pendente(n + 1))], "https://exemplo.invalid");
    expect(m.subject).toContain("35 produtos precisam");
    expect(m.html).not.toContain("<script>"); expect(m.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Cia");
    expect(m.text).toContain("e mais 5 produto(s) no painel.");
  });
});
