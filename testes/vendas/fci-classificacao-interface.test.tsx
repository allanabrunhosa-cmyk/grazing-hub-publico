// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FciClassificacaoForm } from "@/app/(protegido)/vendas/fiscal/cobertura/fci-classificacao-form";
import type { DecisaoFciFiscal } from "@/lib/tributacao/tipos";
import { fciFicticia } from "../tributacao/declaracao-fci-fixtures";
import { fciRepasseFicticia } from "../tributacao/fci-fornecedor-fixtures";

afterEach(cleanup);
const decidir = vi.fn();
it("repasse do fornecedor exibe documentos e ambos os modelos sem pedir CI própria; revisão é explícita", async () => {
  decidir.mockClear(); const inicial = fciRepasseFicticia(); render(<Cenario origem="5" inicial={inicial} />);
  expect(screen.getByRole("region", { name: "FCI recebida do fornecedor" })).toBeTruthy();
  expect(screen.getByText(inicial.numero!)).toBeTruthy(); expect(screen.getByText("NF-e 55 e NFC-e 65")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Conteúdo de importação (%)" })).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull();
  expect(decidir).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Revisar decisão de FCI" }));
  expect(decidir).toHaveBeenCalledWith(expect.objectContaining({ situacao: "PENDENTE", numero: null, apuracaoCompleta: false }));
  expect(decidir.mock.lastCall![0]).not.toHaveProperty("repasseFornecedor");
  expect(inicial.repasseFornecedor!.registro!.documentos).toHaveLength(1);
});
function Cenario({ origem, inicial }: { origem: string; inicial?: DecisaoFciFiscal }) {
  const [valor, setValor] = useState(inicial);
  return <FciClassificacaoForm origem={origem} valor={valor} mudar={v => { decidir(v); setValor(v); }} />;
}
it("declaração do responsável mostra alcance e autoria sem convertê-la em apuração ou edição de dispensa", async () => {
  decidir.mockClear(); const inicial = fciFicticia();
  render(<Cenario origem="5" inicial={inicial} />);
  expect(screen.getByRole("region", { name: "Declaração administrativa de origem e FCI" })).toBeTruthy();
  expect(screen.getByText(/Declarado pelo responsável, sem apuração CI\/FCI comprovada/)).toBeTruthy();
  expect(screen.getByText("SP → SP · Modelo 55")).toBeTruthy();
  expect(screen.getByText("Responsável exclusivamente sintético")).toBeTruthy();
  expect(screen.getByText(/Responsável exclusivamente sintético · Codex/)).toBeTruthy();
  expect(screen.getByText("SEM GTIN")).toBeTruthy();
  expect(screen.getByText(/NFC-e 65 exige homologação própria/)).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.queryByRole("textbox")).toBeNull();
  await userEvent.click(screen.getByText("Registro e justificativa da declaração"));
  expect(screen.getByText(/Versão classificacao-nova-ficticia · Revisão 4 · Hash/)).toBeTruthy();
  expect(decidir).not.toHaveBeenCalled(); expect(inicial.apuracaoCompleta).toBe(false);
});
it("declaração ainda sem selo não inventa autoria, aprovação nem oferece transformá-la em dispensa normativa", () => {
  decidir.mockClear(); render(<Cenario origem="5" inicial={fciFicticia(false)} />);
  expect(screen.getByText("Registro de autoria ainda não selado")).toBeTruthy();
  expect(screen.getByText("Registro ainda não selado")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull(); expect(decidir).not.toHaveBeenCalled();
});
it("origem 0 permite análise FCI explícita e recolhida, sem criar obrigação ou dados por padrão", async () => {
  decidir.mockClear();
  render(<Cenario origem="0" />);
  const resumo = screen.getByText("Avançado: Conteúdo de Importação e FCI");
  expect(resumo.closest("details")?.open).toBe(false);
  const u = userEvent.setup(); await u.click(resumo);
  const registrar = screen.getByRole("checkbox", { name: "Há insumos importados ou decisão FCI para este item" });
  expect(registrar.getAttribute("aria-checked")).toBe("false");
  expect(screen.queryByRole("textbox", { name: "Número de controle da FCI" })).toBeNull();
  expect(decidir).not.toHaveBeenCalled();
  await u.click(registrar);
  expect(decidir).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: "PENDENTE", numero: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false }));
  await u.click(registrar); expect(decidir).toHaveBeenLastCalledWith(undefined);
});
it("FCI exige registro explícito e aceita somente controle hexadecimal documentado", async () => {
  decidir.mockClear(); render(<Cenario origem="8" />); const u = userEvent.setup();
  await u.click(screen.getByText("Avançado: Conteúdo de Importação e FCI"));
  await u.click(screen.getByRole("checkbox", { name: "Registrar decisão de FCI deste item" }));
  expect(decidir).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: "PENDENTE", numero: null, conteudoImportacao: null, valorSaidaReferencia: null, apuracaoCompleta: false }));
  await u.click(screen.getByRole("combobox", { name: "Situação da decisão de FCI" }));
  await u.click(await screen.findByRole("option", { name: "FCI exigida nesta operação" }));
  const campo = screen.getByRole("textbox", { name: "Número de controle da FCI" });
  expect(campo).toHaveProperty("maxLength", 36);
  await u.type(campo, "Gz!"); expect(campo).toHaveProperty("value", "");
  await u.paste("12345678-abcd-abcd-abcd-1234567890ab");
  expect(campo).toHaveProperty("value", "12345678-ABCD-ABCD-ABCD-1234567890AB");
  await u.clear(campo); await u.paste("A".repeat(37)); expect(campo).toHaveProperty("value", "");
  expect(decidir).toHaveBeenLastCalledWith(expect.objectContaining({ numero: null, apuracaoCompleta: false }));
  expect(screen.getByRole("checkbox", { name: "Apuração normativa completa e documentada" }).getAttribute("aria-disabled")).toBe("true");
});
it("dispensa não presume UF ou modelo e alteração de apuração exige nova conferência", async () => {
  const inicial: DecisaoFciFiscal = { situacao: "DISPENSADA_COM_FUNDAMENTO", numero: null, periodoApuracao: "2026-09", conteudoImportacao: "30", valorParcelaImportada: "30", valorSaidaReferencia: "100", apuracaoCompleta: true, justificativa: "Fundamento exclusivamente sintético para a interação, sem efeito fiscal.", fontes: ["https://www.gov.br/fonte-sintetica-sem-efeito-fiscal"], evidencias: ["Evidência sintética"], dispensa: { ufEmitente: "", ufDestino: "", modelos: [] } };
  decidir.mockClear(); render(<Cenario origem="5" inicial={inicial} />); const u = userEvent.setup();
  await u.click(screen.getByText("Avançado: Conteúdo de Importação e FCI"));
  expect(screen.getByRole("combobox", { name: "UF do emitente na dispensa" }).textContent).toContain("Selecione a UF comprovada");
  expect(screen.getByRole("checkbox", { name: "Dispensa para NF-e 55" }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("checkbox", { name: "Dispensa para NFC-e 65" }).getAttribute("aria-checked")).toBe("false");
  await u.click(screen.getByRole("checkbox", { name: "Dispensa para NF-e 55" }));
  expect(decidir).toHaveBeenLastCalledWith(expect.objectContaining({ apuracaoCompleta: false, dispensa: { ufEmitente: "", ufDestino: "", modelos: ["55"] } }));
  const percentual = screen.getByRole("textbox", { name: "Conteúdo de importação (%)" });
  fireEvent.change(percentual, { target: { value: "101" } }); expect(percentual).toHaveProperty("value", "30");
  fireEvent.change(percentual, { target: { value: "30.12345" } }); expect(percentual).toHaveProperty("value", "30");
  fireEvent.change(percentual, { target: { value: "40,1234" } }); expect(percentual).toHaveProperty("value", "40.1234");
  expect(screen.getByRole("checkbox", { name: "Apuração normativa completa e documentada" }).getAttribute("aria-checked")).toBe("false");
  fireEvent.change(screen.getByRole("textbox", { name: "Fontes da decisão de FCI (uma por linha)" }), { target: { value: "https://gov.br.exemplo.invalid/fonte" } });
  expect(screen.getByRole("checkbox", { name: "Apuração normativa completa e documentada" }).getAttribute("aria-disabled")).toBe("true");
  expect(inicial.apuracaoCompleta).toBe(true); expect(inicial.dispensa?.modelos).toEqual([]);
});
