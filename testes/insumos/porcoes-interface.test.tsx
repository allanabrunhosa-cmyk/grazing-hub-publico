// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PorcoesTable, type InsumoPorcaoOption } from "@/app/(protegido)/porcoes/porcoes-table";
import type { PorcaoInsumoOption } from "@/lib/insumos/porcoes";

const acoes = vi.hoisted(() => ({ salvar: vi.fn(), remover: vi.fn(), ordenar: vi.fn() }));
vi.mock("@/app/(protegido)/porcoes/actions", () => ({ salvarPorcaoAction: acoes.salvar, removerPorcaoAction: acoes.remover, reordenarCategoriasPorcoesAction: acoes.ordenar }));
const categorias = [{ id: "queijos", nome: "Queijos", ordem: 0, versao: 1 }, { id: "paes", nome: "Pães", ordem: 1, versao: 1 }];
const insumos: InsumoPorcaoOption[] = [{ id: "brie", nome: "Brie", unidade: "G", ativo: true, categoriaId: "queijos", categoriaNome: "Queijos" }, { id: "pao", nome: "Pão de ervas", unidade: "UN", ativo: true, categoriaId: "paes", categoriaNome: "Pães" }];
const porcao: PorcaoInsumoOption = { id: "fatia", insumoId: "brie", nome: "6 fatias padrão", quantidade: "100.000000001", unidade: "G", versao: 3 };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function montar(props: Partial<Parameters<typeof PorcoesTable>[0]> = {}) { return render(<PorcoesTable insumos={insumos} porcoes={[porcao]} categorias={categorias} podeCriar podeEditar podeExcluir {...props} />); }
async function preencher() {
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Nova porção" }));
  await usuario.click(screen.getByRole("combobox", { name: "Insumo" }));
  await usuario.click(await screen.findByRole("option", { name: /Brie/ }));
  fireEvent.change(screen.getByLabelText("Quantidade do insumo"), { target: { value: "12,345678901" } });
  fireEvent.change(screen.getByLabelText("Quantidade da medida da porção"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Unidade da medida da porção"), { target: { value: "fatias" } });
  return usuario;
}

it("cadastra explicitamente e preserva as nove casas decimais como texto", async () => {
  acoes.salvar.mockResolvedValue({ sucesso: true, porcao: { ...porcao, id: "nova", nome: "2 fatias", quantidade: "12.345678901" } });
  montar(); const usuario = await preencher();
  await usuario.tab(); expect(acoes.salvar).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Salvar porção" }));
  expect(acoes.salvar).toHaveBeenCalledWith(expect.objectContaining({ insumoId: "brie", nome: "2 fatias", quantidade: "12.345678901", unidade: "G" }));
  expect(await screen.findByText("Porção cadastrada.")).toBeDefined();
  expect(screen.getByText("12,345678901")).toBeDefined();
});

it("mantém os campos e erro após rejeição e permite tentar novamente", async () => {
  acoes.salvar.mockResolvedValueOnce({ erro: "Já existe uma porção com este nome." }).mockRejectedValueOnce(new Error("rede"));
  montar(); const usuario = await preencher();
  await usuario.click(screen.getByRole("button", { name: "Salvar porção" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Já existe uma porção com este nome.");
  expect(screen.getByLabelText("Unidade da medida da porção")).toHaveProperty("value", "fatias");
  await usuario.click(screen.getByRole("button", { name: "Salvar porção" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Não foi possível salvar"));
});

it("edita com versão, nunca salva ao perder foco e permite cancelar", async () => {
  acoes.salvar.mockResolvedValue({ sucesso: true, porcao: { ...porcao, nome: "6 Fatia fina", versao: 4 } });
  montar(); const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Editar 6 fatias padrão de Brie" }));
  expect(screen.getByLabelText("Quantidade do insumo")).toHaveProperty("value", "100,000000001");
  fireEvent.change(screen.getByLabelText("Unidade da medida da porção"), { target: { value: "Fatia fina" } });
  fireEvent.blur(screen.getByLabelText("Unidade da medida da porção"));
  expect(acoes.salvar).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));
  expect(acoes.salvar).toHaveBeenCalledWith(expect.objectContaining({ id: "fatia", versao: 3, nome: "6 Fatia fina", quantidade: "100.000000001" }));
  await usuario.click(await screen.findByRole("button", { name: "Editar 6 Fatia fina de Brie" }));
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(acoes.salvar).toHaveBeenCalledTimes(1);
});

it("remoção pede confirmação, exibe erro persistente e só retira após sucesso", async () => {
  acoes.remover.mockResolvedValueOnce({ erro: "A porção foi alterada. Atualize a página." }).mockResolvedValueOnce({ sucesso: true });
  montar(); const usuario = userEvent.setup();
  const botao = screen.getByRole("button", { name: "Remover 6 fatias padrão de Brie" });
  expect(botao.getAttribute("data-acao")).toBe("excluir");
  await usuario.click(botao); expect(acoes.remover).not.toHaveBeenCalled();
  const confirmar = screen.getByRole("button", { name: "Confirmar remoção da porção" });
  await usuario.click(confirmar);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "A porção foi alterada. Atualize a página.");
  expect(screen.getByText("6 fatias padrão")).toBeDefined();
  await usuario.click(confirmar);
  expect(acoes.remover).toHaveBeenCalledWith({ id: "fatia", versao: 3 });
  await waitFor(() => expect(screen.queryByText("6 fatias padrão")).toBeNull());
});

it("rejeita letras, colagem alfanumérica e décima casa decimal na quantidade", async () => {
  montar(); const usuario = await preencher(); const campo = screen.getByLabelText("Quantidade do insumo") as HTMLInputElement;
  await usuario.clear(campo); await usuario.type(campo, "10abc"); expect(campo.value).toBe("10");
  await usuario.paste("a20"); expect(campo.value).toBe("10");
  fireEvent.change(campo, { target: { value: "0,1234567890" } }); expect(campo.value).toBe("10");
  fireEvent.change(campo, { target: { value: "0" } });
  await usuario.click(screen.getByRole("button", { name: "Salvar porção" }));
  expect(await screen.findByRole("alert")).toBeDefined(); expect(acoes.salvar).not.toHaveBeenCalled();
});

it("bloqueia quantidade que perderia precisão no preenchimento da composição", async () => {
  montar(); const usuario = await preencher();
  fireEvent.change(screen.getByLabelText("Quantidade do insumo"), { target: { value: "999999999,999999999" } });
  await usuario.click(screen.getByRole("button", { name: "Salvar porção" }));
  expect(screen.getByRole("alert").textContent).toBe("Quantidade excede a precisão suportada pela composição.");
  expect(acoes.salvar).not.toHaveBeenCalled();
});

it("leitor consulta e busca sem receber comandos de escrita", () => {
  montar({ podeCriar: false, podeEditar: false, podeExcluir: false });
  expect(screen.queryByRole("form")).toBeNull(); expect(screen.queryByRole("button", { name: /Editar|Remover|Salvar/ })).toBeNull();
  fireEvent.change(screen.getByLabelText("Buscar porções"), { target: { value: "queijos" } });
  expect(screen.getByText("6 fatias padrão")).toBeDefined();
  fireEvent.change(screen.getByLabelText("Buscar porções"), { target: { value: "inexistente" } });
  expect(screen.getByText("Nenhuma porção encontrada para esta busca.")).toBeDefined();
});

it("exige nova quantidade quando a unidade do insumo mudou", async () => {
  montar({ insumos: [{ ...insumos[0], unidade: "KG" }] }); const usuario = userEvent.setup();
  expect(screen.getByText("Unidade alterada; revise a porção")).toBeDefined();
  await usuario.click(screen.getByRole("button", { name: "Editar 6 fatias padrão de Brie" }));
  expect(screen.getByLabelText("Quantidade do insumo")).toHaveProperty("value", "");
  expect(screen.getByRole("button", { name: "Salvar alterações" })).toHaveProperty("disabled", true);
});

it("bloqueia submissões repetidas durante a gravação", async () => {
  let concluir!: (valor: unknown) => void;
  acoes.salvar.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  montar(); await preencher();
  const form = screen.getByRole("form", { name: "Cadastrar porção" });
  fireEvent.submit(form); fireEvent.submit(form); expect(acoes.salvar).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true);
  expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  await userEvent.setup().keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "Nova porção" })).toBeDefined();
  concluir({ sucesso: true, porcao });
  await screen.findByText("Porção cadastrada.");
});

it("mantém a tabela limpa e protege o descarte do cadastro no popup", async () => {
  montar(); expect(screen.queryByRole("form")).toBeNull();
  const usuario = await preencher();
  expect(screen.getByRole("dialog", { name: "Nova porção" })).toBeDefined();
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  const alerta = await screen.findByRole("alertdialog");
  await usuario.click(within(alerta).getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByLabelText("Unidade da medida da porção")).toHaveProperty("value", "fatias");
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  await usuario.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sair sem salvar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(acoes.salvar).not.toHaveBeenCalled();
});

it("ordena categorias e insumos em ambos os sentidos sem gravar dados", async () => {
  const pao = { ...porcao, id: "pao-medida", insumoId: "pao", nome: "2 unidades" };
  montar({ porcoes: [porcao, pao] }); const usuario = userEvent.setup();
  const ordem = () => screen.getAllByRole("row").slice(1).map(r => within(r).getAllByRole("cell")[1].querySelector(".font-medium")?.textContent);
  expect(ordem()).toEqual(["Brie", "Pão de ervas"]);
  await usuario.click(screen.getByRole("button", { name: "Categoria" }));
  expect(ordem()).toEqual(["Pão de ervas", "Brie"]);
  await usuario.click(screen.getByRole("button", { name: "Categoria" }));
  expect(ordem()).toEqual(["Brie", "Pão de ervas"]);
  await usuario.click(screen.getByRole("combobox", { name: "Ordenação das porções" }));
  await usuario.click(await screen.findByRole("option", { name: "Insumos: Z–A" }));
  expect(ordem()).toEqual(["Pão de ervas", "Brie"]);
  await usuario.click(screen.getByRole("combobox", { name: "Ordenação das porções" }));
  await usuario.click(await screen.findByRole("option", { name: "Insumos: A–Z" }));
  expect(ordem()).toEqual(["Brie", "Pão de ervas"]);
  expect(screen.getByRole("columnheader", { name: "Insumo" }).getAttribute("aria-sort")).toBe("ascending");
  await usuario.click(screen.getByRole("button", { name: "Insumo" }));
  expect(ordem()).toEqual(["Pão de ervas", "Brie"]);
  expect(acoes.ordenar).not.toHaveBeenCalled(); expect(acoes.salvar).not.toHaveBeenCalled();
});

it("reordena pelo teclado, salva explicitamente e preserva a lista após erro", async () => {
  acoes.ordenar.mockResolvedValueOnce({ erro: "Conflito de ordem." }).mockResolvedValueOnce({ categorias: [{ ...categorias[1], ordem: 0, versao: 2 }, { ...categorias[0], ordem: 1, versao: 2 }] });
  montar({ porcoes: [porcao, { ...porcao, id: "pao-medida", insumoId: "pao", nome: "2 unidades" }] }); const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Ordenar categorias" }));
  screen.getByRole("button", { name: "Arrastar Queijos" }).focus();
  await usuario.keyboard(" {ArrowDown}{Enter}");
  expect(acoes.ordenar).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Salvar ordem" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Conflito de ordem.");
  expect(acoes.ordenar).toHaveBeenCalledWith([{ id: "paes", versao: 1 }, { id: "queijos", versao: 1 }]);
  await usuario.click(screen.getByRole("button", { name: "Salvar ordem" }));
  await screen.findByText("Ordem das categorias atualizada.");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("ordena apenas categorias com porções e mantém o escopo completo mesmo com busca", async () => {
  montar({ categorias: [...categorias, { id: "vazia", nome: "Sem porções", ordem: 2, versao: 1 }], porcoes: [porcao, { ...porcao, id: "pao-medida", insumoId: "pao", nome: "2 unidades" }] });
  fireEvent.change(screen.getByLabelText("Buscar porções"), { target: { value: "Brie" } });
  await userEvent.setup().click(screen.getByRole("button", { name: "Ordenar categorias" }));
  expect(screen.getByRole("button", { name: "Arrastar Queijos" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Arrastar Pães" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Arrastar Sem porções" })).toBeNull();
});

it("retira a categoria após remover sua última porção e desabilita a ordenação vazia", async () => {
  acoes.remover.mockResolvedValue({ sucesso: true }); montar(); const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Ordenar categorias" }));
  expect(screen.queryByRole("button", { name: "Arrastar Pães" })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  await usuario.click(screen.getByRole("button", { name: "Remover 6 fatias padrão de Brie" }));
  await usuario.click(screen.getByRole("button", { name: "Confirmar remoção da porção" }));
  await screen.findByText("Porção removida.");
  expect(screen.getByRole("button", { name: "Ordenar categorias" })).toHaveProperty("disabled", true);
});

it("inclui imediatamente a categoria ao salvar sua primeira porção", async () => {
  acoes.salvar.mockResolvedValue({ sucesso: true, porcao }); montar({ porcoes: [] });
  expect(screen.getByRole("button", { name: "Ordenar categorias" })).toHaveProperty("disabled", true);
  const usuario = await preencher(); await usuario.click(screen.getByRole("button", { name: "Salvar porção" }));
  await screen.findByText("Porção cadastrada.");
  await usuario.click(screen.getByRole("button", { name: "Ordenar categorias" }));
  expect(screen.getByRole("button", { name: "Arrastar Queijos" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Arrastar Pães" })).toBeNull();
});
