vi.mock("@/app/(protegido)/financeiro/fiscal/simples-actions", () => import("../visual/fiscal-unificado-simples-acoes"));
vi.mock("@/app/(protegido)/financeiro/fiscal/manutencao-actions", () => import("../visual/fiscal-unificado-acoes"));
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VinculosFiscais, type ItemFiscal } from "@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
beforeEach(() => { mockarCatalogoFiscal(); });
const sim = vi.hoisted(() => ({ salvar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("@/app/(protegido)/vendas/actions", () => ({ salvarFiscalVendaAction: sim.salvar }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const base: ItemFiscal = { id: "p", nome: "Tábua fictícia", codigo: "P01", fotoUrl: "/api/vendas/fotos/foto", categorias: [{ id: "cat", nome: "Tábuas", ativo: true }], classificacoes: ["PRINCIPAL"], ativo: true, versao: 1, fiscal: {}, fiscalRevisado: false, grupoFiscalId: null };
const complemento: ItemFiscal = { ...base, id: "c", nome: "Porção fictícia", codigo: "C01", classificacoes: ["OPCAO"], ativo: false, grupoFiscalId: "g" };
const grupo = { id: "g", nome: "Produção", ativo: true, fiscal: { ncm: "04069020", cfop: "5101" } };
function tela(produtos = [base, complemento], editar = true) { return render(<VinculosFiscais produtos={produtos} grupos={[grupo]} editar={editar} />); }
const campo = () => screen.getByRole("combobox", { name: `NCM de ${base.nome}` });
async function escolherNcm(u: ReturnType<typeof userEvent.setup>, codigo: string) { await u.click(campo()); await u.clear(campo()); await u.type(campo(), codigo); await u.click(await screen.findByRole("option", { name: new RegExp("^" + codigo + " ·") })); }
const check = () => screen.getByRole("button", { name: `Confirmar vínculos fiscais de ${base.nome}` });
const analiseNcm = { fundamento: "PESQUISA" as const, confianca: "ALTA" as const, descricaoNcm: null, dataAnalise: "2026-10-12", justificativa: "Escolha gratuita incorporada à preparação, sem mercadoria independente.", fontes: ["FICHA_TECNICA:teste"], pendenciasNcm: [] };
it("identifica configuração sem NCM fiscal e preserva o código anterior como identidade", async () => {
  const u = userEvent.setup(); tela([{ ...base, grupoFiscalId: "g", fiscal: { ncm: "04069020" }, analiseFiscal: { ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm } }]);
  expect(screen.getByText("NCM não aplicável")).toBeTruthy(); expect(screen.getByText("Identidade anterior: 04069020")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: `NCM de ${base.nome}` })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Preenchido (1)" }));
  await u.click(screen.getByText("Justificativa do NCM")); expect(screen.getByText(analiseNcm.justificativa)).toBeTruthy();
  expect(screen.getByText("Pesquisa fundamentada · confiança alta · análise em 12/10/2026")).toBeTruthy(); expect(sim.salvar).not.toHaveBeenCalled();
});
it("mostra NCM por escolha sem substituir as variantes por um código único", async () => {
  const u = userEvent.setup(); const a = { ...analiseNcm, descricaoNcm: "Mistura de sucos" };
  tela([{ ...base, grupoFiscalId: "g", analiseFiscal: { ncm: null, ncmAplicabilidade: "APLICAVEL", analiseNcm: a, configuracaoNcm: { grupoIds: ["sabores"], padraoSemEscolhasAutorizado: false, cenarios: [{ id: "uva", nome: "Uva com maçã", opcaoIds: ["opcao-uva"], ncm: "20099000", analiseNcm: a }] } } }]);
  expect(screen.getByText("Conforme escolha")).toBeTruthy(); expect(screen.queryByRole("combobox", { name: `NCM de ${base.nome}` })).toBeNull();
  await u.click(screen.getByText("Justificativa do NCM")); expect(screen.getByText("20099000")).toBeTruthy(); expect(screen.getByRole("button", { name: "Preenchido (1)" })).toBeTruthy(); expect(sim.salvar).not.toHaveBeenCalled();
});
it("conserva o NCM preenchido quando apresentações comprovadas usam o mesmo código", () => {
  tela([{...base,grupoFiscalId:"g",fiscal:{ncm:"19059090"},analiseFiscal:{ncm:"19059090",ncmAplicabilidade:"APLICAVEL",analiseNcm,configuracaoNcm:{grupoIds:["tamanhos"],padraoSemEscolhasAutorizado:false,cenarios:[{id:"apresentacao-sintetica",nome:"Apresentação fictícia",opcaoIds:["opcao-ficticia"],ncm:"19059090",analiseNcm}]}}}]);
  expect(campo()).toHaveProperty("value",expect.stringContaining("19059090"));
  expect(screen.queryByText("Conforme escolha")).toBeNull();
  expect(screen.getByRole("button",{name:"Preenchido (1)"})).toBeTruthy();
  expect(sim.salvar).not.toHaveBeenCalled();
});
it("não apresenta a análise anterior como fundamento da edição divergente", async () => {
  const u = userEvent.setup(); tela([{ ...base, fiscal: { ncm: "04069020" }, analiseFiscal: { ncm: "04069020", ncmAplicabilidade: "APLICAVEL", analiseNcm: { ...analiseNcm, descricaoNcm: "Queijo" } } }]);
  await escolherNcm(u, "04069090");
  expect(screen.getByText("O cadastro mudou após esta análise. Crie uma nova versão fiscal para fundamentar a correção.")).toBeTruthy(); expect(sim.salvar).not.toHaveBeenCalled();
});
it("mostra foto e categorias, separa papéis e pesquisa sem acento", async () => {
  const u = userEvent.setup(); tela();
  expect(screen.getByRole("img", { name: `Foto de ${base.nome}` }).getAttribute("src")).toBe(base.fotoUrl);
  expect(screen.getByRole("columnheader", { name: "Categoria" })).toBeTruthy(); expect(screen.getByText("Tábuas")).toBeTruthy();
  await u.click(screen.getByRole("tab", { name: "Complementos (1)" }));
  expect(screen.getByText("Porção fictícia")).toBeTruthy(); expect(screen.getByText("C01 · Inativo")).toBeTruthy();
  await u.type(screen.getByRole("textbox", { name: "Buscar vínculos fiscais" }), "producao"); expect(screen.getByText("Porção fictícia")).toBeTruthy();
});
it("busca por categoria, código e NCM e distingue vazio inicial de filtros", async () => {
  const u = userEvent.setup(); tela([{ ...base, fiscal: { ncm: "04069020" } }]); const busca = screen.getByRole("textbox", { name: "Buscar vínculos fiscais" });
  for (const termo of ["tabuas", "P01", "04069020"]) { await u.clear(busca); await u.type(busca, termo); expect(screen.getByText(base.nome)).toBeTruthy(); }
  await u.clear(busca); await u.type(busca, "inexistente"); expect(screen.getByText("Nenhum cadastro encontrado com estes filtros.")).toBeTruthy();
  await u.click(screen.getByRole("tab", { name: "Complementos (0)" })); expect(screen.getByText("Nenhum cadastro em complementos.")).toBeTruthy();
});
it("filtra pelo preenchimento dos dois campos, independentemente de revisado, e consulta não edita", async () => {
  const u = userEvent.setup(); tela([{ ...base, fiscal: grupo.fiscal, grupoFiscalId: "g" }, { ...base, id: "incompleto", nome: "Sem grupo", fiscal: grupo.fiscal, fiscalRevisado: true }], false);
  expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull(); expect(screen.queryByRole("button", { name: /Confirmar vínculos/ })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Preenchido (1)" })); expect(screen.getByText(base.nome)).toBeTruthy(); expect(screen.queryByText("Sem grupo")).toBeNull();
  await u.click(screen.getByRole("button", { name: "Pendentes (1)" })); expect(screen.queryByText(base.nome)).toBeNull(); expect(screen.getByText("Sem grupo")).toBeTruthy();
  expect(sim.salvar).not.toHaveBeenCalled();
});
it("sugere parâmetros sem impor NCM e só salva o código selecionado no check", async () => {
  const u = userEvent.setup(); tela();
  await u.click(screen.getByRole("combobox", { name: `Grupo fiscal de ${base.nome}` }));
  await u.click(await screen.findByRole("option", { name: "Produção" })); expect(campo()).toHaveProperty("value", "");
  await u.type(campo(), "mercadoria sem resultado"); await u.tab(); expect(sim.salvar).not.toHaveBeenCalled();
  await escolherNcm(u, "04069090"); sim.salvar.mockResolvedValue({ ok: true, versao: 2 }); await u.click(check());
  await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy()); expect(sim.salvar).toHaveBeenCalledWith("p", 1, expect.objectContaining({ ncm: "04069090", cfop: "5101" }), false, "g", undefined); expect(sim.refresh).toHaveBeenCalledOnce();
});

it("preserva observações e Enter seleciona NCM sem transmitir nem salvar", async () => {
 const u=userEvent.setup(); tela([{...base,fiscal:{ncm:"04069020",observacoes:"Conferir operação"},fiscalRevisado:true}]);
 await u.click(campo()); await u.clear(campo()); await u.type(campo(), "04069090");
 await screen.findByRole("option",{name:/^04069090 ·/}); await u.keyboard("{ArrowDown}{ArrowDown}{Enter}");
 expect(sim.salvar).not.toHaveBeenCalled();
 sim.salvar.mockResolvedValue({ok:true,versao:2}); await u.click(check());
 await waitFor(()=>expect(sim.salvar).toHaveBeenCalledWith("p",1,expect.objectContaining({ncm:"04069090",observacoes:"Conferir operação"}),false,null,undefined));
});

it("escolher grupo conserva NCM e exceções individuais sem gravar automaticamente", async () => {
  const u = userEvent.setup(); tela([{ ...base, fiscal: { ncm: "08061000", cfop: "5102", origem: "1" } }]);
  await u.click(screen.getByRole("combobox", { name: `Grupo fiscal de ${base.nome}` }));
  await u.click(await screen.findByRole("option", { name: "Produção" }));
  expect(campo()).toHaveProperty("value", expect.stringContaining("08061000")); expect(sim.salvar).not.toHaveBeenCalled();
  sim.salvar.mockResolvedValue({ ok: true, versao: 2 }); await u.click(check());
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith("p", 1, expect.objectContaining({ ncm: "08061000", cfop: "5102", origem: "1" }), false, "g", undefined));
});
it("compartilha rascunhos e revisão entre abas e filtros", async () => {
  const u = userEvent.setup(); tela([{ ...base, classificacoes: ["PRINCIPAL", "COMPLEMENTO"] }]);
  await u.click(screen.getByRole("combobox", { name: `Grupo fiscal de ${base.nome}` }));
  await u.click(await screen.findByRole("option", { name: "Produção" }));
  await escolherNcm(u, "04069020");
  await u.click(screen.getByRole("tab", { name: "Complementos (1)" })); expect(campo()).toHaveProperty("value", expect.stringContaining("04069020"));
  await u.click(screen.getByRole("button", { name: "Preenchido (0)" })); await u.click(screen.getByRole("button", { name: "Todos (1)" })); expect(campo()).toHaveProperty("value", expect.stringContaining("04069020"));
  sim.salvar.mockResolvedValueOnce({ ok: true, versao: 2 }); await u.click(check()); await screen.findByText("Salvo");
  await u.click(screen.getByRole("tab", { name: "Produtos (1)" })); await escolherNcm(u, "04069090"); sim.salvar.mockResolvedValueOnce({ ok: true, versao: 3 }); await u.click(check());
  await waitFor(() => expect(sim.salvar).toHaveBeenLastCalledWith("p", 2, expect.objectContaining({ ncm: "04069090", cfop: "5101" }), false, "g", undefined));
});
it("não duplica gravação e preserva a seleção em conflito", async () => {
 const u=userEvent.setup(); tela(); let concluir!: (r:{erro:string})=>void; sim.salvar.mockImplementation(()=>new Promise(resolve=>{concluir=resolve;}));
 await escolherNcm(u,"04069020"); fireEvent.click(check()); fireEvent.click(check());
 expect(sim.salvar).toHaveBeenCalledOnce(); expect(campo()).toHaveProperty("disabled",true); expect(screen.queryByText("Salvo")).toBeNull();
 await act(async()=>concluir({erro:"Cadastro alterado por outra tela. Reabra antes de salvar."}));
 expect(await screen.findByRole("alert")).toHaveProperty("textContent","Cadastro alterado por outra tela. Reabra antes de salvar."); expect(campo()).toHaveProperty("value",expect.stringContaining("04069020")); expect(sim.refresh).not.toHaveBeenCalled();
});

it("preserva campos em falha de rede e permite tentar novamente", async () => {
  const u = userEvent.setup(); tela(); await escolherNcm(u, "04069020"); sim.salvar.mockRejectedValueOnce(new Error("Rede")); await u.click(check());
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível salvar. Seu preenchimento foi mantido. Tente novamente."); expect(campo()).toHaveProperty("value", expect.stringContaining("04069020"));
  sim.salvar.mockResolvedValueOnce({ ok: true, versao: 2 }); await u.click(check()); expect(await screen.findByText("Salvo")).toBeTruthy();
});
it("conserva grupo inativo visível, sem permitir nova escolha, e sinaliza falta de foto/categoria", async () => {
  render(<VinculosFiscais produtos={[{ ...base, fotoUrl: null, categorias: [], grupoFiscalId: "inativo" }]} grupos={[{ ...grupo, id: "inativo", ativo: false }]} editar />);
  expect(within(screen.getByRole("combobox", { name: `Grupo fiscal de ${base.nome}` })).getByText("Produção (inativo)", { exact: true })).toBeTruthy();
  const u = userEvent.setup(); await u.click(screen.getByRole("combobox", { name: `Grupo fiscal de ${base.nome}` }));
  expect((await screen.findByRole("option", { name: "Produção (inativo)" })).getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("Sem categoria")).toBeTruthy(); expect(screen.queryByRole("img")).toBeNull();
});
it("pesquisa texto limitado e não aplica um código fora da seleção", async () => {
 const u=userEvent.setup(); tela(); await u.type(campo(),"mercadoria inexistente"); await u.tab(); expect(check()).toHaveProperty("disabled",true); expect(campo().getAttribute("maxLength")).toBe("100");
 await escolherNcm(u,"04069020"); expect(campo()).toHaveProperty("value",expect.stringContaining("04069020")); expect(check()).toHaveProperty("disabled",false); expect(sim.salvar).not.toHaveBeenCalled();
});

it("check destaca a seleção pendente e conserva a coluna sem texto no erro", async () => {
 const u=userEvent.setup(); tela(); expect(check().className).not.toContain("bg-success");
 await escolherNcm(u,"04069020"); expect(check().className).toContain("bg-success");
 sim.salvar.mockResolvedValueOnce({erro:"Conflito sintético"}); await u.click(check()); const erro=await screen.findByRole("alert");
 expect(erro.closest("td")).toBe(campo().closest("td")); expect(check().closest("td")).toHaveProperty("textContent","");
 sim.salvar.mockResolvedValueOnce({ok:true,versao:2}); await u.click(check()); await waitFor(()=>expect(check()).toHaveProperty("disabled",true)); expect(check().className).not.toContain("bg-success");
});

it("ordena Produto/Categoria nos dois sentidos, por teclado, com acentos, desempate e filtros nas duas abas", async () => {
  const u = userEvent.setup();
  const itens = [
    { nome: "Zulu", categoria: "Água" }, { nome: "banana", categoria: "Zebra" },
    { nome: "Árvore", categoria: "Água" }, { nome: "Coco", categoria: null },
  ].map((item, i) => ({ ...base, id: `ordem-${i}`, nome: item.nome, classificacoes: ["PRINCIPAL", "COMPLEMENTO"], categorias: item.categoria ? [{ id: `cat-${i}`, nome: item.categoria, ativo: true }] : [] }));
  tela(itens, false);
  const nomes = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map(linha => within(linha).getAllByRole("cell")[0].textContent?.replace(/P01$/, ""));
  expect(nomes()).toEqual(["Zulu", "banana", "Árvore", "Coco"]);
  await u.click(screen.getByRole("button", { name: "Produto" }));
  expect(nomes()).toEqual(["Árvore", "banana", "Coco", "Zulu"]);
  expect(screen.getByRole("columnheader", { name: "Produto" }).getAttribute("aria-sort")).toBe("ascending");
  screen.getByRole("button", { name: "Produto" }).focus(); await u.keyboard("{Enter}");
  expect(nomes()).toEqual(["Zulu", "Coco", "banana", "Árvore"]);
  await u.click(screen.getByRole("button", { name: "Categoria" }));
  expect(nomes()).toEqual(["Árvore", "Zulu", "Coco", "banana"]);
  expect(screen.getByRole("columnheader", { name: "Produto" }).getAttribute("aria-sort")).toBe("none");
  await u.click(screen.getByRole("button", { name: "Categoria" }));
  expect(nomes()).toEqual(["banana", "Coco", "Zulu", "Árvore"]);
  await u.type(screen.getByRole("textbox", { name: "Buscar vínculos fiscais" }), "agua");
  expect(nomes()).toEqual(["Zulu", "Árvore"]);
  await u.click(screen.getByRole("tab", { name: "Complementos (4)" }));
  expect(nomes()).toEqual(["Zulu", "Árvore"]);
  expect(screen.getByRole("columnheader", { name: "Categoria" }).getAttribute("aria-sort")).toBe("descending");
  expect(sim.salvar).not.toHaveBeenCalled();
});
it("ordenar não perde o rascunho fiscal nem grava alterações", async () => {
  const u = userEvent.setup(); tela([base, { ...base, id: "a", nome: "Abacate" }]);
  await escolherNcm(u, "04069020");
  await u.click(screen.getByRole("button", { name: "Produto" }));
  expect(campo()).toHaveProperty("value", expect.stringContaining("04069020")); expect(check()).toHaveProperty("disabled", false);
  await u.click(screen.getByRole("button", { name: "Categoria" }));
  expect(campo()).toHaveProperty("value", expect.stringContaining("04069020")); expect(sim.salvar).not.toHaveBeenCalled();
});
