import { expect, it } from "vitest";
import { gerarHtmlFichaTecnica } from "@/lib/insumos/ficha-tecnica";
import { insumoStatus } from "../cadastros/dados";

it("gera ficha técnica A4 com ingredientes, porções, passos e validades", () => {
  const html = gerarHtmlFichaTecnica({
    ...insumoStatus,
    nome: "Creme <especial>",
    especificacao: "Base sem <lactose>",
    tipo: "PRODUTO_INTERMEDIARIO",
    rendimentoQuantidade: 2,
    rendimentoUnidade: "KG",
    componentes: Array.from({ length: 16 }, (_, indice) => ({ componenteId: `ingrediente-${indice + 1}`, nome: indice === 0 ? "Açúcar" : `Ingrediente ${indice + 1}`, especificacao: indice === 0 ? "Cristal fino" : null, tipo: "INSUMO" as const, unidade: "KG" as const, quantidade: 0.2, observacaoPorcao: indice === 0 ? "2 colheres" : null })),
    modoPreparo: Array.from({ length: 11 }, (_, indice) => indice === 0 ? "Misture bem" : indice === 1 ? "Leve para gelar" : `Passo ${indice + 1}`),
    etiquetaHabilitada: true,
    validadeRefrigeradoDias: 3,
  }, "https://grazinghub.com.br/api/insumos/preparacao/foto");
  expect(html).toContain("@page { size: 297mm 210mm; margin: 8mm; }");
  expect(html).toContain('class="pagina"');
  expect(html).toContain("window.ajustarFichaTecnica = ajustarFichaTecnica");
  expect(html).toContain("--escala");
  expect(html).toContain("grid-template-columns: 94mm minmax(0, 1fr)");
  expect(html).toContain("font-size: 9.5pt");
  expect(html).toContain("Creme &lt;especial&gt;");
  expect(html).toContain("Base sem &lt;lactose&gt;");
  expect(html).toContain("Cristal fino");
  expect(html).toContain("0,2 kg");
  expect(html).toContain("2 colheres");
  expect(html).toContain("Misture bem");
  expect(html).toContain("Ingrediente 15");
  expect(html).not.toContain("Ingrediente 16");
  expect(html).toContain("Passo 10");
  expect(html).not.toContain("Passo 11");
  expect(html).toContain('class="conteudo"');
  expect(html).toContain('class="numero-passo">1');
  expect(html).toContain('src="https://grazinghub.com.br/api/insumos/preparacao/foto"');
  expect(html).toContain("<strong>Refrigerado</strong><small>3 dias após aberto</small>");
  expect(html).toContain('class="validade-lateral"');
  expect(html.indexOf('class="validade-lateral"')).toBeLessThan(html.indexOf('<div class="receita">'));
  expect(html).not.toContain("Estoque seco / ambiente");
});
