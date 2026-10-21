// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreRequisitosBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/pre-requisitos-card";
import { preRequisitosBrasilNfeVazios, type ResultadoPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
afterEach(cleanup);
const montar = (editar = true) => {
  const inicial = preRequisitosBrasilNfeVazios(1), registrar = vi.fn().mockResolvedValue({ ok: true, dados: inicial }), verificar = vi.fn().mockResolvedValue({ ok: true, dados: inicial });
  const ui = render(<PreRequisitosBrasilNfeCard inicial={inicial} editar={editar} registrar={registrar} verificar={verificar} />);
  return { inicial, registrar, verificar, ui };
};
describe("Pré-requisitos administrativos: ações explícitas e estados reais", () => {
  it("entrada da data civil permanece no estado ao editar outro campo, sem salvar automaticamente", async () => {
    const m = montar(); const data = screen.getByLabelText("Validade exibida do certificado") as HTMLInputElement;
    fireEvent.input(data, { target: { value: "2026-11-07" } });
    fireEvent.change(screen.getByLabelText("UF do emitente observada no painel"), { target: { value: "SP" } });
    fireEvent.blur(data);
    expect(data.value).toBe("2026-11-07"); expect(m.registrar).not.toHaveBeenCalled(); expect(m.verificar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Registrar evidência" }));
    expect(screen.getByRole("alert").textContent).toContain("explicitamente"); expect(data.value).toBe("2026-11-07");
  });
  it("leitura e falta de permissão não acionam consulta nem registro", () => {
    const m = montar(false); expect(m.verificar).not.toHaveBeenCalled(); expect(m.registrar).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Conferir certificado e CSC" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/status 1 continua sem significado/)).toBeTruthy();
    expect(screen.getByText("NFC-e produção · ambiente 1")).toBeTruthy();
    expect(screen.queryByText("NFC-e produção — bloqueada")).toBeNull();
  });
  it("edição não salva no blur; registro incompleto não cria estados presumidos", async () => {
    const m = montar(); const input = screen.getByLabelText("Validade exibida do certificado");
    fireEvent.change(input, { target: { value: "2026-11-07" } }); fireEvent.blur(input);
    expect(m.registrar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Registrar evidência" }));
    expect(screen.getByRole("alert").textContent).toContain("explicitamente"); expect(m.registrar).not.toHaveBeenCalled();
  });
  it("botão de leitura impede dupla execução e não registra painel", async () => {
    const m = montar(); let resolver!: (v: ResultadoPreRequisitosBrasilNfe) => void;
    m.verificar.mockImplementation(() => new Promise<ResultadoPreRequisitosBrasilNfe>(r => { resolver = r; }));
    await userEvent.click(screen.getByRole("button", { name: "Conferir certificado e CSC" }));
    await userEvent.click(screen.getByRole("button", { name: "Conferir certificado e CSC" }));
    expect(m.verificar).toHaveBeenCalledTimes(1); expect(m.registrar).not.toHaveBeenCalled();
    resolver({ ok: true, dados: { ...m.inicial, certificado: { situacao: "VALIDO", validade: "2026-11-07", verificadoEm: "2026-10-11T12:00:00.000Z", httpStatus: 200 } } });
    await waitFor(() => expect(screen.getByText(/Confirmado por consulta/)).toBeTruthy());
  });
  it("nova configuração remove evidência antiga e erro técnico não expõe conteúdo", async () => {
    const m = montar(); m.verificar.mockRejectedValue(new Error("TOKEN_PRIVADO"));
    await userEvent.click(screen.getByRole("button", { name: "Conferir certificado e CSC" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy()); expect(screen.getByRole("alert").textContent).not.toContain("TOKEN_PRIVADO");
    m.ui.rerender(<PreRequisitosBrasilNfeCard inicial={preRequisitosBrasilNfeVazios(2)} editar={false} registrar={m.registrar} verificar={m.verificar} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Conferir certificado e CSC" }) as HTMLButtonElement).disabled).toBe(true));
  });
});
