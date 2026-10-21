// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorVersaoFiscal } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import { EscolhasMercadoriaForm } from "@/app/(protegido)/vendas/fiscal/cobertura/classificacao-complementar-form";
import type { AnaliseNcm, ClassificacaoFiscal, PainelFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
beforeEach(() => { mockarCatalogoFiscal(); });
const sim = vi.hoisted(() => ({ salvar: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/fiscal/estrutura-actions", () => ({ salvarVersaoFiscalAction: sim.salvar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const analise: AnaliseNcm = { fundamento: "PESQUISA", confianca: "MEDIA", descricaoNcm: null, dataAnalise: "2026-10-12", justificativa: "Configuração exclusivamente sintética documentada para teste.", fontes: ["https://www.gov.br/referencia-sintetica"], pendenciasNcm: [] };
const base: ClassificacaoFiscal = { produtoId: "produto-sintetico", grupo: "GF03", natureza: "PREPARADO", tratamento: "OPCAO_CONFIGURACAO", ncm: null, origem: null, unidade: "UN", cest: null, estado: "PENDENTE", evidencias: ["Ficha fictícia de escolha integrada"], pendencias: [], ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: analise };
function abrir(dados: ClassificacaoFiscal) {
  const versao: VersaoFiscalDto = { id: "versao-sintetica", tipo: "CLASSIFICACAO", chave: dados.referenciaInternaInsumoId ? `INSUMO:${dados.referenciaInternaInsumoId}` : dados.produtoId!, versao: 3, vigenciaInicio: "2026-10-12", status: "ATIVO", dados, justificativa: "Versão sintética anterior.", fontes: analise.fontes, criadoPorNome: "Autor fictício", createdAt: "2026-10-12T12:00:00Z", hash: "ficticio" };
  const painel: PainelFiscal = { administrador: true, produtos: [{ id: "produto-sintetico", codigo: null, nome: "Produto fictício", tipo: "PREPARADO", papeis: ["PRINCIPAL"], grupo: "GF03", ncm: null, status: "PENDENTE", pendencias: [], composicao: [], evidencias: [] }], insumos: [{ id: "preparo-sintetico", nome: "Preparação fictícia", tipo: "PREPARO", unidade: "KG" }], grupos: [], entradas: [], resumo: { ativos: 1, aptos: 0, pendentes: 1, configuracoes: 0 }, opcoes: [{ id: "escolha-sintetica", nome: "Sabor fictício", produtoId: null, grupo: "Sabores", grupoId: "grupo-sintetico", produtoPrincipalIds: ["produto-sintetico"] }], versoes: [versao] };
  render(<EditorVersaoFiscal tipo="CLASSIFICACAO" versao={versao} painel={painel} fechar={vi.fn()} />);
  return screen.getByRole("dialog");
}
async function salvar(dialogo: HTMLElement) {
  sim.salvar.mockResolvedValue({ ok: true });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Correção sintética prospectiva sem modificar documentos anteriores." } });
  await userEvent.setup().click(within(dialogo).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledOnce());
}
it("manutenção de NCM não aplicável conserva fundamentação e gera nova versão prospectiva", async () => {
  const dialogo = abrir(base);
  expect(within(dialogo).queryByRole("combobox", { name: "NCM individual" })).toBeNull();
  fireEvent.change(within(dialogo).getByLabelText("Início da vigência"), { target: { value: "2027-01-01" } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Análise do NCM: justificativa" }), { target: { value: "Escolha de sabor sintética incorporada ao alimento, sem venda independente." } });
  expect(sim.salvar).not.toHaveBeenCalled();
  await salvar(dialogo);
  expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ chave: "produto-sintetico", versaoBase: 3, vigenciaInicio: "2027-01-01", dados: expect.objectContaining({ ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: expect.objectContaining({ fundamento: "PESQUISA", confianca: "MEDIA", fontes: analise.fontes }) }) }));
  expect(base.analiseNcm!.justificativa).toBe(analise.justificativa);
});
it("referência fiscal interna utiliza a identidade existente e mantém a conversão comprovada", async () => {
  const d: ClassificacaoFiscal = { ...base, produtoId: null, referenciaInternaInsumoId: "preparo-sintetico", tratamento: "NORMAL", ncm: "19059090", ncmAplicabilidade: "APLICAVEL", unidade: "UN", analiseNcm: { ...analise, descricaoNcm: "Descrição fiscal exclusivamente fictícia" }, conversaoUnidade: { unidadeEstoque: "KG", quantidadeEstoquePorUnidadeFiscal: "0.023125", justificativa: "Massa física fictícia documentada por unidade pronta.", fontes: ["Ficha fictícia"] } };
  const dialogo = abrir(d); const fator = within(dialogo).getByRole("textbox", { name: "Quantidade de controle por unidade fiscal" });
  const u = userEvent.setup(); await u.type(fator, "abc"); expect(fator).toHaveProperty("value", "0.023125");
  await salvar(dialogo);
  expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ chave: "INSUMO:preparo-sintetico", versaoBase: 3, dados: expect.objectContaining({ produtoId: null, referenciaInternaInsumoId: "preparo-sintetico", conversaoUnidade: d.conversaoUnidade }) }));
});
it("cenário sem código mantém a pendência específica, escolhas exatas e evidências ao editar", async () => {
  const d: ClassificacaoFiscal = { ...base, tratamento: "NORMAL", ncmAplicabilidade: "APLICAVEL", configuracaoNcm: { grupoIds: ["grupo-sintetico"], padraoSemEscolhasAutorizado: false, cenarios: [{ id: "cenario-sintetico", nome: "Formulação fictícia incompleta", opcaoIds: ["escolha-sintetica"], ncm: null, analiseNcm: { ...analise, confianca: "BAIXA", pendenciasNcm: ["Peso final do ingrediente não determinado"] } }] } };
  const dialogo = abrir(d); const ncm = within(dialogo).getByRole("combobox", { name: "NCM do cenário 1" });
  const u = userEvent.setup(); await u.type(ncm, "sem correspondencia"); await u.tab(); expect(sim.salvar).not.toHaveBeenCalled();
  await salvar(dialogo);
  expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ dados: expect.objectContaining({ ncm: null, configuracaoNcm: expect.objectContaining({ grupoIds: ["grupo-sintetico"], cenarios: [expect.objectContaining({ opcaoIds: ["escolha-sintetica"], ncm: null, analiseNcm: expect.objectContaining({ confianca: "BAIXA", pendenciasNcm: ["Peso final do ingrediente não determinado"] }) })] }) }) }));
});
it("quantidade exata de uma escolha repetida conserva o cenário fiscal ao salvar", async () => {
  const d: ClassificacaoFiscal = { ...base, tratamento: "NORMAL", ncmAplicabilidade: "APLICAVEL", configuracaoNcm: { grupoIds: ["grupo-sintetico"], padraoSemEscolhasAutorizado: false, cenarios: [{ id: "cenario-quantidade", nome: "Escolha repetida fictícia", opcaoIds: ["escolha-sintetica"], quantidadesEscolhidas: [{ opcaoId: "escolha-sintetica", quantidade: "2" }], ncm: "08061000", analiseNcm: { ...analise, descricaoNcm: "Descrição fictícia" } }] } };
  const dialogo = abrir(d);
  expect(within(dialogo).getByRole("textbox", { name: "Quantidade exata de Sabor fictício no cenário 1" })).toHaveProperty("value", "2");
  await salvar(dialogo);
  expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({dados:expect.objectContaining({configuracaoNcm:expect.objectContaining({cenarios:[expect.objectContaining({quantidadesEscolhidas:[{opcaoId:"escolha-sintetica",quantidade:"2"}]})]})})}));
});
it("unidades separadas mantêm o modo fiscal sem sugerir quantidade discriminante de preparação", async () => {
  const d: ClassificacaoFiscal = { ...base, tratamento: "NORMAL", ncmAplicabilidade: "APLICAVEL", configuracaoNcm: { modoFiscal: "UNIDADES_SEPARADAS", grupoIds: ["grupo-sintetico"], padraoSemEscolhasAutorizado: false, cenarios: [{ id: "unidade-sintetica", nome: "Frasco fictício", opcaoIds: ["escolha-sintetica"], ncm: "20099000", analiseNcm: { ...analise, descricaoNcm: "Descrição fictícia" } }] } };
  const dialogo=abrir(d);
  expect(within(dialogo).getByRole("combobox", {name:"Apresentação das escolhas"}).textContent).toContain("Unidades entregues separadamente");
  expect(within(dialogo).queryByRole("textbox",{name:"Quantidade exata de Sabor fictício no cenário 1"})).toBeNull();
  await salvar(dialogo);
  expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({dados:expect.objectContaining({configuracaoNcm:expect.objectContaining({modoFiscal:"UNIDADES_SEPARADAS"})})}));
});
it("porção adicional permite manter sua apresentação fixa sem recalcular o preço", () => {
  const mudar=vi.fn();
  const painel={opcoes:[{id:"opcao-porcao",nome:"Porção fictícia 120g",produtoId:null,grupo:"Tamanhos",grupoId:"grupo-tamanho",produtoPrincipalIds:["mercadoria-ficticia"]}]} as PainelFiscal;
  render(<EscolhasMercadoriaForm produtoId="mercadoria-ficticia" escolhas={[{opcaoId:"opcao-porcao",grupoId:"grupo-tamanho",quantidade:"1"}]} mudar={mudar} painel={painel} />);
  fireEvent.change(screen.getByRole("textbox",{name:"Quantidade fixa de Porção fictícia 120g"}),{target:{value:"2"}});
  expect(mudar).toHaveBeenCalledWith([{opcaoId:"opcao-porcao",grupoId:"grupo-tamanho",quantidade:"2"}]);
  expect(screen.getByText(/preço já cobrado pelo complemento/)).toBeTruthy();
});
it("manutenção da receita fiscal preserva unidade final documentada e referências em várias linhas", async () => {
  const d: ClassificacaoFiscal={...base,tratamento:"NORMAL",natureza:"PREPARADO",ncmAplicabilidade:"APLICAVEL",ncm:"19059090",receitaFiscalDocumentada:{componentesFixos:[{insumoId:"preparo-sintetico",unidade:"KG",quantidade:"0.125"}],opcoes:[],justificativa:"Conteúdo final exclusivamente fictício documentado pela ficha de teste.",fontes:["Ficha fictícia versão1"]}};
  const dialogo=abrir(d),u=userEvent.setup();
  const quantidade=within(dialogo).getByRole("textbox",{name:"Composição fixa: quantidade final 1"});
  await u.type(quantidade,"abc");expect(quantidade).toHaveProperty("value","0.125");
  await u.type(within(dialogo).getByRole("textbox",{name:"Documentos da composição fiscal, uma referência por linha"}),"{End}{Enter}Declaração exclusivamente fictícia");
  expect(sim.salvar).not.toHaveBeenCalled();
  await salvar(dialogo);
  expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({dados:expect.objectContaining({receitaFiscalDocumentada:expect.objectContaining({componentesFixos:[{insumoId:"preparo-sintetico",unidade:"KG",quantidade:"0.125"}],fontes:["Ficha fictícia versão1","Declaração exclusivamente fictícia"]})})}));
  expect(d.receitaFiscalDocumentada?.fontes).toEqual(["Ficha fictícia versão1"]);
});
