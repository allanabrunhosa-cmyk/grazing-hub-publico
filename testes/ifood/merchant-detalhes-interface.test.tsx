// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/ifood/actions", () => ({ detalhesMerchantIfoodAction: sim.consultar }));
import { DetalhesMerchantIfood } from "@/app/(protegido)/vendas/pedidos/ifood/merchant-detalhes-ifood";
import { lerDetalhesMerchant } from "@/lib/ifood/merchant-detalhes";
const id = "11111111-1111-4111-8111-111111111111";
const dados = { detalhes: lerDetalhesMerchant({ id, name: "Loja sintética", corporateName: "Empresa sintética", averageTicket: 0, exclusive: false, status: "AVAILABLE", address: { street: "Rua sintética", number: "1", complement: "Sala", postalCode: "00000-000", latitude: 0 }, operations: [{ name: "DELIVERY", salesChannels: [{ name: "MARKETPLACE", enabled: true }, { name: "WHATSAPP", enabled: false }] }] }, id), consultadoEm: "2026-10-12T23:30:00Z", fusoHorario: "America/Sao_Paulo" };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("exibe detalhes, endereço completo e canais sem confundir cadastro com disponibilidade", async () => {
  sim.consultar.mockResolvedValue({ ok: true, dados }); render(<DetalhesMerchantIfood lojaId="loja" permitido />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Consultar detalhes da loja" })));
  expect(sim.consultar).toHaveBeenCalledWith("loja");
  for (const valor of ["Loja sintética", "Empresa sintética", "Rua sintética", "Sala", "00000-000", "MARKETPLACE · Habilitado", "WHATSAPP · Desabilitado", "AVAILABLE"]) expect(screen.getByText(valor)).toBeTruthy();
  expect(screen.getByText(/Use “Consultar estado da loja”/)).toBeTruthy();
  expect(screen.queryByText("Aceita pedidos")).toBeNull();
});
it("impede consultas duplicadas, mostra carregamento e remove resultado antigo no erro", async () => {
  sim.consultar.mockResolvedValueOnce({ ok: true, dados }); render(<DetalhesMerchantIfood lojaId="loja" permitido />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Consultar detalhes da loja" })));
  let resolver!: (v: { erro: string }) => void;
  sim.consultar.mockImplementation(() => new Promise(r => { resolver = r; }));
  const botao = screen.getByRole("button", { name: "Consultar detalhes da loja" });
  fireEvent.click(botao); fireEvent.click(botao); expect(sim.consultar).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Aguardando os detalhes do iFood.")).toBeTruthy();
  await act(async () => resolver({ erro: "Autorização revogada" }));
  expect(screen.getByRole("alert").textContent).toBe("Autorização revogada"); expect(screen.queryByText("Rua sintética")).toBeNull();
});
it("trata dados ausentes e falha de rede, e respeita bloqueio de autorização", async () => {
  sim.consultar.mockResolvedValue({ ok: true, dados: { ...dados, detalhes: lerDetalhesMerchant({ id }, id) } });
  const { rerender } = render(<DetalhesMerchantIfood lojaId="loja" permitido />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Consultar detalhes da loja" })));
  expect(screen.getByText("Nenhum endereço informado pelo iFood.")).toBeTruthy(); expect(screen.getByText("Nenhuma operação informada pelo iFood.")).toBeTruthy();
  sim.consultar.mockRejectedValue(new Error("rede")); await act(async () => fireEvent.click(screen.getByRole("button", { name: "Consultar detalhes da loja" })));
  expect(screen.getByRole("alert").textContent).toContain("Confira a conexão");
  rerender(<DetalhesMerchantIfood lojaId="loja" permitido={false} />);
  expect(screen.getByRole("button", { name: "Consultar detalhes da loja" }).matches(":disabled")).toBe(true);
});
