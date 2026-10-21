// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MensagemPendenciaFormulario } from "@/components/pendencia-formulario";

afterEach(cleanup);
it("abre o grupo recolhido, destaca o controle, associa mensagem e rola até ele", async () => {
  const scroll = vi.fn(); HTMLElement.prototype.scrollIntoView = scroll;
  const { rerender } = render(<details><summary>Escolhas</summary><label>Quantidade<input aria-label="Quantidade" aria-describedby="ajuda" /></label></details>);
  const alvo = screen.getByLabelText("Quantidade");
  const estrutura = <details><summary>Escolhas</summary><label>Quantidade<input aria-label="Quantidade" aria-describedby="ajuda" /></label></details>;
  rerender(<>{estrutura}<MensagemPendenciaFormulario pendencia={{ alvo, mensagem: "Escolha ao menos um complemento." }} /></>);
  await waitFor(() => expect(document.activeElement).toBe(alvo));
  expect(alvo.closest("details")?.open).toBe(true);
  expect(alvo.getAttribute("aria-invalid")).toBe("true");
  const mensagem = screen.getByRole("alert");
  expect(alvo.getAttribute("aria-describedby")).toContain(mensagem.id);
  expect(mensagem.parentElement).toBe(alvo.closest("label")?.parentElement);
  expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  rerender(<>{estrutura}<MensagemPendenciaFormulario pendencia={null} /></>);
  expect(alvo.hasAttribute("aria-invalid")).toBe(false);
  expect(alvo.getAttribute("aria-describedby")).toBe("ajuda");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("resolve o controle do grupo depois que termina a operação e o fieldset é liberado", async () => {
  const estrutura = (disabled: boolean) => <fieldset disabled={disabled}><details data-erro-container><summary>Grupo obrigatório</summary><input aria-label="Quantidade" type="number" defaultValue={0} /></details></fieldset>;
  const { container, rerender } = render(<>{estrutura(true)}<MensagemPendenciaFormulario pendencia={null} /></>);
  const alvo = container.querySelector("details")!;
  const pendencia = { alvo, mensagem: "Preencha o grupo." };
  rerender(<>{estrutura(true)}<MensagemPendenciaFormulario pendencia={pendencia} bloqueado /></>);
  rerender(<>{estrutura(false)}<MensagemPendenciaFormulario pendencia={pendencia} /></>);
  const campo = screen.getByLabelText("Quantidade");
  await waitFor(() => expect(document.activeElement).toBe(campo));
  expect(alvo.open).toBe(true);
  expect(campo.getAttribute("aria-invalid")).toBe("true");
});
