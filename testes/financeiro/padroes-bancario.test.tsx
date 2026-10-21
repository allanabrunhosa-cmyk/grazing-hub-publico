// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { ContasBancariasView } from "@/app/(protegido)/financeiro/bancario/contas-bancarias-view";
const acoes = vi.hoisted(() => ({ criar: vi.fn(), conta: vi.fn(), cartao: vi.fn(), salvar: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/bancario/actions", () => ({ criarContaBancariaAction: acoes.criar, alternarAtivoContaBancariaAction: acoes.conta, editarSaldoInicialAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/bancario/cartoes-actions", () => ({ salvarCartaoAction: acoes.salvar, alternarCartaoAction: acoes.cartao }));
const conta = { id: "conta", nome: "Conta fictícia", ativo: true, saldoInicial: 0, saldoAtual: 0, dataSaldoInicial: null };
const cartao = { id: "cartao", nome: "Cartão fictício", ativo: true, contaBancariaId: "conta", contaBancariaNome: conta.nome, diaFechamento: 10, diaVencimento: 20 };
function Tela({ admin = true }: { admin?: boolean }) { return <ProvedorAcesso acesso={{ admin, permissoes: {}, excecoes: {} }}><ContasBancariasView contas={[conta]} cartoes={[cartao]} movimentacoesPorConta={{}} /></ProvedorAcesso>; }
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("mantém campos da nova conta após erro sem alegar criação", async () => {
  const usuario = userEvent.setup(); acoes.criar.mockResolvedValue({ erro: "Falha controlada" });
  render(<Tela />); await usuario.click(screen.getByRole("button", { name: "Nova Conta" }));
  const nome = screen.getByLabelText("Nome") as HTMLInputElement;
  await usuario.click(nome); await usuario.paste("Conta de demonstração");
  await usuario.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha controlada");
  expect(nome.value).toBe("Conta de demonstração");
  expect(acoes.criar.mock.calls[0][1].get("nome")).toBe("Conta de demonstração");
});

it("edita cartão pelo lápis e preserva o valor digitado quando falha", async () => {
  const usuario = userEvent.setup(); acoes.salvar.mockResolvedValue({ erro: "Falha controlada" });
  render(<Tela />);
  const editar = screen.getByRole("button", { name: "Editar cartão Cartão fictício" });
  expect(editar.getAttribute("data-acao")).toBe("editar");
  await usuario.click(editar);
  const nome = screen.getByLabelText("Nome do cartão") as HTMLInputElement;
  await usuario.clear(nome); await usuario.paste("Cartão alterado");
  await usuario.click(screen.getByRole("button", { name: "Salvar cartão" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha controlada");
  expect(nome.value).toBe("Cartão alterado");
  expect(acoes.salvar.mock.calls[0][1].get("contaBancariaId")).toBe("conta");
});

it("status só muda após confirmação do servidor e leitor não pode alterar", async () => {
  const usuario = userEvent.setup(); acoes.cartao.mockResolvedValueOnce({ erro: "Permissão revogada" }).mockResolvedValue({ ok: true });
  const tela = render(<Tela />);
  const status = screen.getByRole("switch", { name: "Status de Cartão fictício" });
  await usuario.click(status);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Permissão revogada");
  expect(status.getAttribute("aria-checked")).toBe("true");
  await usuario.click(status);
  await waitFor(() => expect(status.getAttribute("aria-checked")).toBe("false"));
  tela.rerender(<Tela admin={false} />);
  expect((status as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("switch", { name: "Status de Conta fictícia" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Nova Conta" }) as HTMLButtonElement).disabled).toBe(true);
});
