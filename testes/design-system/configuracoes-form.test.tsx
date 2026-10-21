// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DadosLojaForm } from "@/app/(protegido)/configuracoes/dados-loja-form";
import { PerfilForm } from "@/app/(protegido)/perfil/perfil-form";
const sim = vi.hoisted(() => ({ salvar: vi.fn(), perfil: vi.fn(), senha: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/actions", () => ({ salvarConfiguracaoLojaAction: sim.salvar, buscarCepLojaAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({ buscarCepPedidoAction: vi.fn() }));
vi.mock("@/app/(protegido)/perfil/actions", () => ({ atualizarPerfilAction: sim.perfil, alterarSenhaAction: sim.senha }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("rótulos encontram campos; falha de transporte não apaga preenchimento nem anuncia sucesso", async () => {
  render(<DadosLojaForm config={{ nome: "Unidade fictícia", cnpj: "", endereco: "", telefone: "", emailContato: "" }} />);
  const nome = screen.getByLabelText("Nome da Unidade");
  for (const label of ["CNPJ", "CEP", "Logradouro", "Número", "Complemento (opcional)", "Bairro", "Cidade", "Estado / UF", "Telefone", "Email de Contato"]) expect(screen.getByLabelText(label)).toBeTruthy();
  for (const label of ["CEP", "Logradouro", "Número", "Complemento (opcional)", "Bairro", "Cidade", "Estado / UF"]) expect(screen.getByLabelText(label)).toHaveProperty("required", false);
  fireEvent.change(nome, { target: { value: "Edição preservada" } });
  sim.salvar.mockRejectedValueOnce(new Error("Rede indisponível"));
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await screen.findByRole("alert"); expect(nome).toHaveProperty("value", "Edição preservada");
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", false));
  sim.salvar.mockResolvedValueOnce({ ok: true });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledTimes(2));
  expect(sim.salvar.mock.calls[1][1].get("nome")).toBe("Edição preservada");
  expect(JSON.parse(sim.salvar.mock.calls[1][1].get("enderecoEstruturado"))).toMatchObject({cep:"",numero:"",complemento:""});
});
it("perfil preserva e-mail em erro e apresenta rótulos acessíveis de segurança", async () => {
  render(<PerfilForm usuario={{ id: "u", nome: "Pessoa fictícia", email: "antes@example.invalid", temFoto: false }} />);
  for (const label of ["Nome Completo", "E-mail", "Senha Atual", "Nova Senha", "Confirmar Nova Senha"]) expect(screen.getByLabelText(label)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Alterar foto de perfil" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "depois@example.invalid" } });
  sim.perfil.mockRejectedValueOnce(new Error("Rede indisponível"));
  fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("E-mail")).toHaveProperty("value", "depois@example.invalid");
  expect(sim.senha).not.toHaveBeenCalled();
});
