// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EtiquetasClient, type ProdutoEtiquetaTela } from "@/app/(protegido)/producao/etiquetas/etiquetas-client";
import { PainelValidades, type GestaoValidadesTela } from "@/app/(protegido)/producao/etiquetas/gestao-validades";
import { FotoProduto } from "@/app/(protegido)/producao/etiquetas/foto-produto";
import { ListaProdutos } from "@/app/(protegido)/producao/etiquetas/lista-produtos";
import { ResponsaveisConfiguracao } from "@/app/(protegido)/producao/etiquetas/responsaveis-configuracao";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import type { PontoImpressaoTela } from "@/app/(protegido)/producao/etiquetas/pontos-impressao";
const sim = vi.hoisted(() => ({ preparar: vi.fn(), enviar: vi.fn(), detectar: vi.fn(), baixa: vi.fn(), usuario: vi.fn(), cadastro: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: sim.refresh }) }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/lib/etiquetas/browser-print", () => ({ detectarImpressoraPadrao: sim.detectar, enviarZpl: vi.fn() }));
vi.mock("@/app/(protegido)/producao/etiquetas/actions", () => ({ prepararEtiquetaAction: sim.preparar, iniciarEnvioEtiquetaAction: vi.fn(), finalizarTentativaEtiquetaAction: vi.fn(), registrarExportacaoEtiquetaAction: vi.fn(), confirmarImpressaoEtiquetaAction: vi.fn(), salvarConfiguracaoProdutoEtiquetaAction: vi.fn(), salvarConfiguracaoImpressoraAction: vi.fn() }));
vi.mock("@/app/(protegido)/producao/etiquetas/pontos-actions", () => ({ enfileirarPontoAction: sim.enviar, confirmarSaidaFisicaPontoAction: vi.fn(), criarPontoImpressaoAction: vi.fn(), atualizarPontoImpressaoAction: vi.fn(), emitirCodigoPontoAction: vi.fn(), imprimirTestePontoAction: vi.fn(), revogarPontoAction: vi.fn(), selecionarImpressoraPontoAction: vi.fn(), solicitarMudancaWifiPontoAction: vi.fn() }));
vi.mock("@/app/(protegido)/producao/etiquetas/operacao-actions", () => ({ baixarEtiquetaAction: sim.baixa, excluirPontoImpressaoAction: vi.fn(), restaurarPontoImpressaoAction: vi.fn(), configurarUsuarioResponsavelAction: sim.usuario, salvarResponsavelEtiquetaAction: sim.cadastro }));
const produto: ProdutoEtiquetaTela = { id: "produto", nome: "Produto fictício", tipo: "INSUMO", unidade: "KG", categoria: "Grupo fictício", ativo: true, etiquetaHabilitada: true, validadeSecoDias: 2, validadeRefrigeradoDias: 5, validadeCongeladoDias: null, validadeAposAbertoDias: null, conservacaoEtiquetaPadrao: "REFRIGERADO", versaoConfiguracaoEtiqueta: 1 };
const ponto: PontoImpressaoTela = { id: "padrao", nome: "Produção", ativo: true, padrao: true, icone: "impressora", situacao: "RECENTE", impressoraSelecionadaId: "usb", impressoraDetectada: true, vistoEm: null, impressoras: [], wifiSsid: null, wifiFrequenciaMhz: null, wifiEndereco: null, ethernetEndereco: null, wifiRedes: [], wifiMudancaEstado: null, hostname: null, modelo: null, pendentes: 0, incertos: 0 };
const acesso = { admin: true, permissoes: {}, excecoes: {} };
const dadosEtiqueta = { produtoNome: produto.nome, lojaNome: "Loja fictícia", lojaCnpj: null, conservacao: "REFRIGERADO" as const, quantidade: null, unidade: "KG", lote: null, responsavelManipulacao: "Ana", manipuladoEm: "2026-09-01T12:00:00Z", validoAte: "2026-09-06T12:00:00Z", fusoHorario: "America/Sao_Paulo", resolucaoDpi: 203, tamanho: "MM_60X60" as const, mostrarHora: true, copias: 2 };
function tela(produtoTela = produto) { return render(<ProvedorAcesso acesso={acesso}><EtiquetasClient dedicado pontos={[ponto]} produtos={[produtoTela]} historico={[]} responsaveis={[{ id: "ana", nome: "Ana" }, { id: "externa", nome: "Pessoa sem conta", origem: "CADASTRO" }]} admin caminhoBase="/producao/etiquetas" loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 30 }} perfil={null} paginaHistorico={{ pagina: 1, porPagina: 25, total: 0 }} abaInicial="imprimir" /></ProvedorAcesso>); }
async function revisar(pessoa = "Ana") { const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: pessoa })); await u.click(screen.getByRole("button", { name: /Grupo fictício/ })); await u.click(screen.getByRole("button", { name: /Produto fictício/ })); await u.click(screen.getByRole("button", { name: /Refrigerado/ })); return u; }
beforeEach(() => { vi.clearAllMocks(); sim.enviar.mockResolvedValue({ ok: true }); sim.baixa.mockResolvedValue({ ok: true }); sim.usuario.mockResolvedValue({ ok: true }); sim.cadastro.mockResolvedValue({ ok: true }); sim.preparar.mockResolvedValue({ ok: true, trabalho: { id: "trabalho", zpl: "^XA^XZ", nomeArquivo: "ficticia.zpl", dados: dadosEtiqueta, status: "PREPARADO", reutilizado: false } }); });
afterEach(cleanup);
it("Imprimir usa o ponto padrão uma vez e não chama Browser Print", async () => {
  tela(); const u = await revisar();
  expect(screen.queryByText("Enviar para a fila")).toBeNull(); expect(screen.queryByText("Imprimir pelo ponto")).toBeNull();
  await u.dblClick(screen.getByRole("button", { name: "Imprimir" }));
  await waitFor(() => expect(sim.enviar).toHaveBeenCalledTimes(1));
  expect(sim.preparar).toHaveBeenCalledTimes(1); expect(sim.detectar).not.toHaveBeenCalled();
  expect(sim.enviar).toHaveBeenCalledWith(expect.objectContaining({ pontoId: "padrao", trabalhoId: "trabalho", reimpressao: false }));
  expect(screen.getByRole("button", { name: "Imprimir" })).toHaveProperty("disabled", true);
  await u.click(screen.getByRole("button", { name: "Preparar nova etiqueta" }));
  expect(screen.getByRole("button", { name: "Imprimir" })).toHaveProperty("disabled", false);
});
it("Voltar fica junto às abas e as etapas anteriores são acionáveis", async () => {
  tela(); const u = await revisar();
  const voltar = screen.getByRole("button", { name: "Voltar" });
  expect(voltar.closest(".validades-fluxo")?.querySelector('[aria-label="Áreas de etiquetas"]')).not.toBeNull();
  await u.click(voltar); expect(screen.getByRole("textbox", {name:"Buscar produto"})).toBeDefined();
  await u.click(screen.getByRole("button", { name: "Voltar para Responsável" }));
  expect(screen.getByText("Quem manipulou ou preparou os produtos?")).toBeDefined();
  expect(screen.getByRole("button", { name: "Voltar para Etiqueta" })).toHaveProperty("disabled", true);
});
it("responsável sem conta usa o cadastro, sem se passar por usuário", async () => {
  tela(); const u = await revisar("Pessoa sem conta"); await u.click(screen.getByRole("button", { name: "Imprimir" }));
  await waitFor(() => expect(sim.preparar).toHaveBeenCalledTimes(1));
  expect(sim.preparar).toHaveBeenCalledWith(expect.objectContaining({ responsavelCadastroId: "externa", responsavelUsuarioId: undefined }));
});
it("Vencidas inclui meses anteriores e baixa retira cópias do acompanhamento após confirmar", async () => {
  const item = { id: "antiga", produtoNome: produto.nome, categoriaNome: null, lote: null, validoAte: dadosEtiqueta.validoAte, manipuladoEm: dadosEtiqueta.manipuladoEm, fusoHorario: "America/Sao_Paulo", responsavelManipulacao: "Ana", conservacao: "REFRIGERADO" as const, copias: 2, copiasBaixadas: 0, status: "PREPARADO", confirmado: false, dados: dadosEtiqueta };
  const dados: GestaoValidadesTela = { agora: "2026-10-16T12:00:00Z", filtro: "todas", pagina: 1, porPagina: 25, total: 1, vencidas: 1, proximas: 0, vigentes: 0, itens: [item] };
  render(<ProvedorAcesso acesso={acesso}><PainelValidades dados={dados} caminhoBase="/" /></ProvedorAcesso>); const u = userEvent.setup();
  expect(screen.queryByRole("button", { name: /Ontem/ })).toBeNull();
  await u.click(screen.getByRole("button", { name: "Vencidas" }));
  await u.click(screen.getByRole("button", { name: /Ver etiqueta de Produto fictício/ }));
  await u.click(screen.getByRole("button", { name: "Dar baixa" }));
  await u.clear(screen.getByLabelText("Quantidade de etiquetas")); await u.type(screen.getByLabelText("Quantidade de etiquetas"), "2");
  await u.click(screen.getByRole("button", { name: "Dar baixa" })); expect(sim.baixa).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar baixa" }));
  await waitFor(() => expect(sim.baixa).toHaveBeenCalledWith(expect.objectContaining({ trabalhoId: "antiga", quantidade: 2 })));
  await waitFor(() => expect(screen.getByText("Nenhuma etiqueta corresponde aos filtros.")).toBeDefined());
});
it("responsáveis só são persistidos após a confirmação e novos cadastros não criam contas", async () => {
  render(<ResponsaveisConfiguracao dados={{ usuarios: [{ id: "u", nome: "Ana", ativo: true }], cadastros: [] }} />); const u = userEvent.setup();
  await u.click(screen.getByRole("checkbox", { name: "Disponível" })); await u.tab(); expect(sim.usuario).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar responsável Ana" })); expect(sim.usuario).toHaveBeenCalledWith("u", false);
  await u.type(screen.getByLabelText("Nome do responsável"), "Pessoa da cozinha"); await u.click(screen.getByRole("button", { name: "Cadastrar responsável" }));
  expect(sim.cadastro).toHaveBeenCalledWith({ nome: "Pessoa da cozinha", ativo: true });
});

it("expõe três etapas e busca global de produto logo após escolher o responsável", async () => {
  const outra = {...produto, id:"outro", nome:"Morango", categoria:"Frutas"};
  render(<ProvedorAcesso acesso={acesso}><EtiquetasClient dedicado produtos={[produto,outra]} historico={[]} responsaveis={[{id:"ana",nome:"Ana"}]} admin caminhoBase="/" loja={{fusoHorario:"America/Sao_Paulo",maximoCopiasEtiqueta:10}} perfil={null} paginaHistorico={{pagina:1,porPagina:25,total:0}} abaInicial="imprimir" /></ProvedorAcesso>);
  const u=userEvent.setup(), etapas=screen.getByRole("region",{name:"Etapas da emissão"});
  expect(within(etapas).getAllByRole("button")).toHaveLength(3);
  expect(within(etapas).getAllByRole("button").map(b=>b.textContent)).toEqual(["1Responsável","2Produto","3Etiqueta"]);
  await u.click(screen.getByRole("button",{name:"Ana"}));
  await u.click(screen.getByRole("button",{name:/Grupo fictício/}));
  await u.type(screen.getByRole("textbox",{name:"Buscar produto"}),"Morango");
  await u.click(screen.getByRole("button",{name:/Morango Insumo/}));
  expect(screen.getByRole("region",{name:"Conservação"})).toBeDefined();
  await u.click(screen.getByRole("button",{name:/Refrigerado/}));
  expect(screen.getByRole("button",{name:"Voltar para Etiqueta"}).getAttribute("aria-current")).toBe("step");
  expect(sim.preparar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button",{name:"Voltar para Produto"}));
  await u.click(screen.getByRole("button",{name:/Grupo fictício/}));
  expect(screen.queryByRole("region",{name:"Conservação"})).toBeNull();
});
it("lista prazos reais por tipo e cadastro sem permitir selecionar produto desabilitado", async () => {
  const selecionar=vi.fn(), sem={...produto,id:"sem",nome:"Preparação sem prazo",tipo:"PRODUTO_INTERMEDIARIO" as const,validadeSecoDias:null,validadeRefrigeradoDias:null};
  const inativo={...produto,id:"inativo",nome:"Insumo desabilitado",etiquetaHabilitada:false};
  render(<ListaProdutos produtos={[produto,sem,inativo]} selecionar={selecionar} />);
  const u=userEvent.setup();
  expect(screen.getByText("Com cadastro")).toBeDefined();expect(screen.getByText("Sem cadastro",{selector:'[data-slot="card-title"]'})).toBeDefined();
  expect(screen.getAllByRole("columnheader").slice(0,6).map(n=>n.textContent)).toEqual(["Nome","Tipo","Status","Ambiente","Refrigerado","Congelado"]);
  const linha=screen.getByRole("row",{name:/Produto fictício/});
  expect(within(linha).getByText("2 dia(s)")).toBeDefined();expect(within(linha).getByText("5 dia(s)")).toBeDefined();
  expect(screen.getByRole("row",{name:/Preparação sem prazo/}).textContent).toContain("Preparação");
  expect(screen.queryByRole("button",{name:"Insumo desabilitado"})).toBeNull();
  expect(screen.queryByRole("button",{name:"Preparação sem prazo"})).toBeNull();
  await u.click(screen.getByRole("button",{name:produto.nome}));expect(selecionar).toHaveBeenCalledExactlyOnceWith(produto);
  await u.type(screen.getByRole("textbox",{name:"Buscar na lista de produtos"}),"sem prazo");
  expect(screen.queryByText(produto.nome)).toBeNull();expect(screen.getByText("Preparação sem prazo")).toBeDefined();
});
function gestaoTeste() : GestaoValidadesTela {
 const item={id:"antiga",produtoNome:produto.nome,categoriaNome:"Grupo",lote:"L1",validoAte:dadosEtiqueta.validoAte,manipuladoEm:dadosEtiqueta.manipuladoEm,fusoHorario:"America/Sao_Paulo",responsavelManipulacao:"Ana",conservacao:"REFRIGERADO" as const,copias:2,copiasBaixadas:0,status:"PREPARADO",confirmado:false,dados:dadosEtiqueta};
 return {agora:"2026-10-16T12:00:00Z",filtro:"todas",pagina:1,porPagina:25,total:1,vencidas:1,proximas:0,vigentes:0,itens:[item]};
}
it("atalho de baixa abre a confirmação sem gravar e preserva quantidade no erro", async () => {
 sim.baixa.mockResolvedValue({erro:"Conflito: atualize a etiqueta."});
 render(<ProvedorAcesso acesso={acesso}><PainelValidades dados={gestaoTeste()} caminhoBase="/" /></ProvedorAcesso>);
 const u=userEvent.setup();await u.click(screen.getByRole("button",{name:/Dar baixa em Produto fictício/}));
 expect(screen.getByRole("dialog")).toBeDefined();expect(sim.baixa).not.toHaveBeenCalled();
 await u.clear(screen.getByLabelText("Quantidade de etiquetas"));await u.type(screen.getByLabelText("Quantidade de etiquetas"),"2");
 await u.click(screen.getByRole("button",{name:"Dar baixa"}));expect(sim.baixa).not.toHaveBeenCalled();
 await u.click(screen.getByRole("button",{name:"Confirmar baixa"}));
 expect(await screen.findByRole("alert")).toHaveProperty("textContent","Conflito: atualize a etiqueta.");
 expect(screen.getByLabelText("Quantidade de etiquetas")).toHaveProperty("value","2");
 expect(sim.refresh).not.toHaveBeenCalled();
});
it("leitor abre o detalhe pelo card e não recebe ações de baixa", async () => {
 render(<ProvedorAcesso acesso={{admin:false,permissoes:{producao:["visualizar"]},excecoes:{}}}><PainelValidades dados={gestaoTeste()} caminhoBase="/producao/etiquetas" /></ProvedorAcesso>);
 const u=userEvent.setup();expect(screen.queryByRole("button",{name:/Dar baixa/})).toBeNull();
 await u.click(screen.getByRole("button",{name:/Ver etiqueta de Produto fictício/}));
 const detalhe=screen.getByRole("dialog");expect(within(detalhe).getByText("Grupo",{selector:"dt"})).toBeDefined();
 expect(within(detalhe).getByText("L1")).toBeDefined();expect(within(detalhe).queryByRole("button",{name:"Dar baixa"})).toBeNull();
 expect(within(detalhe).getByRole("link",{name:"Histórico e reimpressão"}).getAttribute("href")).toBe("/producao/etiquetas?aba=historico");
 expect(sim.baixa).not.toHaveBeenCalled();
});

function renderGestao(dados: GestaoValidadesTela) {
 return render(<ProvedorAcesso acesso={acesso}><PainelValidades dados={dados} caminhoBase="/" /></ProvedorAcesso>);
}
it("agrupa por identidade do produto e só revela registros ao expandir", async()=>{
 const dados=gestaoTeste(), item={...dados.itens[0],insumoId:"produto-1"};
 dados.itens=[item,{...item,id:"novo",lote:"L2",validoAte:"2026-10-17T12:00:00Z"},{...item,id:"homonimo",insumoId:"produto-2",produtoNome:item.produtoNome}];
 renderGestao(dados); const u=userEvent.setup();
 expect(screen.getAllByRole("heading",{name:produto.nome})).toHaveLength(2);
 expect(screen.queryByRole("region",{name:`Etiquetas de ${produto.nome}`})).toBeNull();
 expect(screen.queryByText(/Lote: L2/)).toBeNull();
 const grupo=screen.getByRole("button",{name:`Ver etiquetas de ${produto.nome}`});
 expect(grupo.getAttribute("aria-expanded")).toBe("false");
 await u.click(grupo);
 expect(screen.getByRole("region",{name:`Etiquetas de ${produto.nome}`})).toBeDefined();
 expect(screen.getByText(/Lote: L2/)).toBeDefined();
 await u.click(screen.getByRole("button",{name:/Ver etiqueta de Produto fictício novo/}));
 expect(within(screen.getByRole("dialog")).getByText("L2")).toBeDefined();
 expect(sim.baixa).not.toHaveBeenCalled();
});
it("filtra registros antes de agrupá-los e não baixa um grupo inteiro pelo atalho",async()=>{
 const dados=gestaoTeste(),item={...dados.itens[0],insumoId:"mesmo"};
 dados.itens=[item,{...item,id:"outro",lote:"L2",validoAte:"2026-10-17T12:00:00Z"}];renderGestao(dados);
 const u=userEvent.setup();await u.click(screen.getByRole("button",{name:`Dar baixa em ${produto.nome}`}));
 expect(screen.getByRole("region",{name:`Etiquetas de ${produto.nome}`})).toBeDefined();expect(sim.baixa).not.toHaveBeenCalled();
 await u.click(screen.getByRole("button",{name:"Vencidas"}));
 expect(screen.queryByText(/Lote: L2/)).toBeNull();expect(screen.getByRole("button",{name:/Ver etiqueta de Produto fictício antiga/})).toBeDefined();
});
it("baixa a única cópia restante diretamente e protege clique duplo pendente",async()=>{
 const dados=gestaoTeste();dados.itens[0].copiasBaixadas=1;
 let concluir!:(v:{ok:true})=>void;sim.baixa.mockReturnValue(new Promise(resolve=>{concluir=resolve;}));
 renderGestao(dados);const u=userEvent.setup();const baixa=screen.getByRole("button",{name:/Dar baixa em Produto fictício/});
 await u.dblClick(baixa);expect(sim.baixa).toHaveBeenCalledTimes(1);expect(screen.queryByRole("dialog")).toBeNull();
 expect(sim.baixa).toHaveBeenCalledWith({trabalhoId:"antiga",quantidade:1,chaveIdempotencia:expect.any(String)});
 expect(baixa).toHaveProperty("disabled",true);expect(sim.refresh).not.toHaveBeenCalled();
 concluir({ok:true});await waitFor(()=>expect(screen.getByText("Nenhuma etiqueta corresponde aos filtros.")).toBeDefined());expect(sim.refresh).toHaveBeenCalledTimes(1);
});
it("baixa direta também funciona dentro do detalhe sem pedir confirmação extra",async()=>{
 const dados=gestaoTeste();dados.itens[0].copias=1;renderGestao(dados);const u=userEvent.setup();
 await u.click(screen.getByRole("button",{name:/Ver etiqueta de Produto fictício/}));
 await u.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Dar baixa"}));
 await waitFor(()=>expect(sim.baixa).toHaveBeenCalledTimes(1));expect(screen.queryByLabelText("Quantidade de etiquetas")).toBeNull();
});
it("falha de comunicação preserva etiqueta e chave idempotente para repetir a baixa direta",async()=>{
 const dados=gestaoTeste();dados.itens[0].copias=1;sim.baixa.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ok:true});
 renderGestao(dados);const u=userEvent.setup();await u.click(screen.getByRole("button",{name:/Dar baixa em Produto fictício/}));
 expect(await screen.findByRole("alert")).toHaveProperty("textContent",expect.stringContaining("solicitação será preservada"));
 expect(sim.refresh).not.toHaveBeenCalled();const primeira=sim.baixa.mock.calls[0][0];
 await waitFor(()=>expect(screen.getByRole("button",{name:/Dar baixa em Produto fictício/})).toHaveProperty("disabled",false));
 await u.click(screen.getByRole("button",{name:/Dar baixa em Produto fictício/}));await waitFor(()=>expect(sim.baixa).toHaveBeenCalledTimes(2));
 expect(sim.baixa.mock.calls[1][0]).toEqual(primeira);
});
it("não agrupa registros históricos sem identidade só porque o nome coincide",()=>{
 const dados=gestaoTeste();dados.itens=[dados.itens[0],{...dados.itens[0],id:"sem-vinculo"}];renderGestao(dados);
 expect(screen.queryByRole("button",{name:/Ver etiquetas de/})).toBeNull();expect(screen.getAllByRole("button",{name:/Ver etiqueta de/})).toHaveLength(2);
});

it("Produto avança por abas sem empilhar grupo, produto e conservação", async () => {
  tela(); const u = userEvent.setup();
  const areas = screen.getByRole("tablist", {name:"Áreas de etiquetas"});
  expect(areas.parentElement?.querySelector('[aria-label="Etapas da emissão"]')).not.toBeNull();
  await u.click(screen.getByRole("button", {name:"Ana"}));
  const abas = screen.getByRole("tablist", {name:"Escolha do produto"});
  expect(within(abas).getByRole("tab", {name:"Grupo"}).getAttribute("aria-selected")).toBe("true");
  expect(within(abas).getByRole("tab", {name:"Produto"}).getAttribute("aria-disabled")).toBe("true");
  expect(screen.queryByRole("button", {name:/Produto fictício/})).toBeNull();
  await u.click(screen.getByRole("button", {name:/Grupo fictício/}));
  expect(within(abas).getByRole("tab", {name:"Produto"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("region", {name:"Grupo"})).toBeNull();
  await waitFor(()=>expect(document.activeElement).not.toBe(document.body));
  await u.click(screen.getByRole("button", {name:/Produto fictício/}));
  expect(within(abas).getByRole("tab", {name:"Conservação"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("region", {name:"Produto"})).toBeNull();
  await u.click(within(abas).getByRole("tab", {name:"Produto"}));
  expect(screen.getByRole("button", {name:/Produto fictício/})).toBeDefined();
  await u.click(within(abas).getByRole("tab", {name:"Conservação"}));
  await u.click(screen.getByRole("button", {name:/Refrigerado/}));
  expect(screen.getByRole("button",{name:"Voltar para Etiqueta"}).getAttribute("aria-current")).toBe("step");
  await u.click(screen.getByRole("button", {name:"Voltar"}));
  await u.click(screen.getByRole("button", {name:"Voltar"}));
  expect(screen.getByRole("textbox", {name:"Buscar responsável"})).toBeDefined();
  expect(sim.preparar).not.toHaveBeenCalled();
});
it("busca no Grupo mostra produtos enquanto digita, preserva foco e volta ao Grupo ao apagar", async () => {
  tela(); const u = userEvent.setup();
  await u.click(screen.getByRole("button",{name:"Ana"}));
  const busca = screen.getByRole("textbox", {name:"Buscar produto"});
  await u.type(busca,"Produto");
  expect(document.activeElement).toBe(busca);
  expect(screen.getByRole("tab", {name:"Produto"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("button", {name:/Produto fictício/})).toBeDefined();
  await u.type(busca," inexistente");
  expect(screen.getByText(/Nenhum produto encontrado/)).toBeDefined();
  await u.clear(busca);
  expect(document.activeElement).toBe(busca);
  expect(screen.getByRole("tab", {name:"Grupo"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("button", {name:/Grupo fictício/})).toBeDefined();
  expect(screen.getByRole("tab", {name:"Conservação"}).getAttribute("aria-disabled")).toBe("true");
});
it("Histórico continua acessível e retorna ao fluxo sem duplicar as abas", async () => {
  tela(); const u = userEvent.setup();
  await u.click(screen.getByRole("tab", {name:"Histórico"}));
  expect(screen.getAllByRole("tablist", {name:"Áreas de etiquetas"})).toHaveLength(1);
  await u.click(screen.getByRole("tab", {name:"Imprimir"}));
  expect(screen.getAllByRole("tablist", {name:"Áreas de etiquetas"})).toHaveLength(1);
  expect(screen.getByRole("textbox",{name:"Buscar responsável"})).toBeDefined();
});

it("Todos os grupos libera a aba Produto e o preparo em grupo permanece disponível", async () => {
  tela(); const u = userEvent.setup();
  await u.click(screen.getByRole("button", {name:"Ana"}));
  await u.click(screen.getByRole("button", {name:"Todos os grupos"}));
  expect(screen.getByRole("tab",{name:"Produto"}).getAttribute("aria-disabled")).not.toBe("true");
  await u.click(screen.getByRole("tab", {name:"Grupo"}));
  await u.click(screen.getByRole("button", {name:/Grupo fictício/}));
  await u.click(screen.getByRole("button", {name:"Imprimir grupo"}));
  await u.click(screen.getByRole("button", {name:"Aumentar cópias de Produto fictício"}));
  await u.click(screen.getByRole("button", {name:"Preparar grupo"}));
  await waitFor(()=>expect(sim.preparar).toHaveBeenCalledTimes(1));
  expect(sim.preparar).toHaveBeenCalledWith(expect.objectContaining({insumoId:produto.id,copias:1}));
  expect(screen.getByRole("button",{name:"Voltar para Etiqueta"}).getAttribute("aria-current")).toBe("step");
  expect(sim.enviar).not.toHaveBeenCalled();
});

it("envio pendente bloqueia retorno e navegação das etapas até a resposta", async () => {
  let responder!: (resultado:{erro:string})=>void;
  sim.preparar.mockImplementationOnce(()=>new Promise(resolve=>{responder=resolve;}));
  tela(); const u=await revisar();
  await u.click(screen.getByRole("button",{name:"Imprimir"}));
  await waitFor(()=>expect(sim.preparar).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button",{name:"Voltar"})).toHaveProperty("disabled",true);
  expect(screen.getByRole("button",{name:"Voltar para Responsável"})).toHaveProperty("disabled",true);
  expect(screen.getByRole("spinbutton", { name: "Quantidade de etiquetas" })).toHaveProperty("disabled", true);
  responder({erro:"Falha simulada. Nenhuma impressão enviada."});
  await waitFor(()=>expect(screen.getByRole("button",{name:"Voltar"})).toHaveProperty("disabled",false));
  expect(sim.enviar).not.toHaveBeenCalled();
});

it("permite digitar 30 etiquetas, mantém o foco e envia a quantidade exata uma vez", async () => {
  tela(); const u = await revisar();
  const campo = screen.getByRole("spinbutton", { name: "Quantidade de etiquetas" });
  await u.clear(campo);
  expect(screen.getByRole("button", { name: "Imprimir" })).toHaveProperty("disabled", true);
  await u.type(campo, "30");
  expect(document.activeElement).toBe(campo);
  expect(campo).toHaveProperty("value", "30");
  expect(screen.getByRole("button", { name: "Aumentar cópias" })).toHaveProperty("disabled", true);
  await u.tab(); expect(sim.preparar).not.toHaveBeenCalled();
  await u.dblClick(screen.getByRole("button", { name: "Imprimir" }));
  await waitFor(() => expect(sim.enviar).toHaveBeenCalledOnce());
  expect(sim.preparar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ copias: 30 }));
});

it("recusa vazio, zero e excesso sem imprimir e permite corrigir por digitação ou setas", async () => {
  tela(); const u = await revisar();
  const campo = screen.getByRole("spinbutton", { name: "Quantidade de etiquetas" });
  for (const invalido of ["", "0", "31"]) {
    await u.clear(campo); if (invalido) await u.type(campo, invalido);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("button", { name: "Imprimir" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Informe um número inteiro de 1 a 30.")).toBeDefined();
  }
  expect(sim.preparar).not.toHaveBeenCalled(); expect(sim.enviar).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Diminuir cópias" }));
  expect(campo).toHaveProperty("value", "30");
  expect(screen.getByRole("button", { name: "Imprimir" })).toHaveProperty("disabled", false);
});

it("protege digitação e colagem de letras, frações e expoentes no campo de etiquetas", async () => {
  tela(); const u = await revisar();
  const campo = screen.getByRole("spinbutton", { name: "Quantidade de etiquetas" });
  await u.clear(campo); await u.type(campo, "abc"); expect(campo).toHaveProperty("value", "");
  for (const texto of ["1.5", "1,5", "1e2", "-1", "123", "texto"]) {
    await u.paste(texto); expect(campo).toHaveProperty("value", "");
  }
  await u.paste("30"); expect(campo).toHaveProperty("value", "30");
  expect(sim.preparar).not.toHaveBeenCalled();
});

it("permite digitar cópias do grupo e usa zero para deixar o produto fora da seleção", async () => {
  tela(); const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Ana" }));
  await u.click(screen.getByRole("button", { name: /Grupo fictício/ }));
  await u.click(screen.getByRole("button", { name: "Imprimir grupo" }));
  const campo = screen.getByRole("spinbutton", { name: "Quantidade de etiquetas de Produto fictício" });
  expect(campo).toHaveProperty("value", "0");
  expect(screen.getByRole("button", { name: "Preparar grupo" })).toHaveProperty("disabled", true);
  await u.clear(campo); await u.type(campo, "31");
  expect(screen.getByRole("button", { name: "Preparar grupo" })).toHaveProperty("disabled", true);
  await u.clear(campo); await u.type(campo, "30");
  await u.click(screen.getByRole("button", { name: "Preparar grupo" }));
  await waitFor(() => expect(sim.preparar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ copias: 30 })));
  expect(sim.enviar).not.toHaveBeenCalled();
});

it("reutiliza a foto na seleção individual e no preparo em grupo sem mudar o nome acessível", async () => {
  tela({...produto,fotoUrl:"/api/etiquetas/produtos/produto/foto"}); const u=userEvent.setup();
  await u.click(screen.getByRole("button",{name:"Ana"}));
  await u.click(screen.getByRole("button",{name:/Grupo fictício/}));
  const cartao=screen.getByRole("button",{name:"Produto fictício Insumo · KG"});
  expect(new URL(cartao.querySelector("img")!.getAttribute("src")!, "http://localhost").pathname).toBe("/api/etiquetas/produtos/produto/foto");
  expect(cartao.querySelector("img")?.getAttribute("alt")).toBe("");
  await u.click(screen.getByRole("button",{name:"Imprimir grupo"}));
  expect(new URL(document.querySelector(".validades-opcao-grupo img")!.getAttribute("src")!, "http://localhost").pathname).toBe("/api/etiquetas/produtos/produto/foto");
  expect(sim.preparar).not.toHaveBeenCalled();
});
it("foto ausente ou com erro usa apoio visual e uma URL nova pode carregar", () => {
  const view=render(<FotoProduto />);
  expect(view.container.querySelector("img")).toBeNull();
  view.rerender(<FotoProduto url="/api/etiquetas/produtos/a/foto" />);
  fireEvent.error(view.container.querySelector("img")!);
  expect(view.container.querySelector("img")).toBeNull();
  expect(view.container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  view.rerender(<FotoProduto url="/api/etiquetas/produtos/b/foto" />);
  expect(new URL(view.container.querySelector("img")!.getAttribute("src")!, "http://localhost").pathname).toBe("/api/etiquetas/produtos/b/foto");
});
it("a etapa final chama Etiqueta e a prévia mantém nome acessível sem cabeçalho repetido", async () => {
  tela(); await revisar();
  expect(screen.getByRole("button",{name:"Voltar para Etiqueta"}).getAttribute("aria-current")).toBe("step");
  expect(screen.queryByText("A prévia acompanha os campos preenchidos.")).toBeNull();
  const previa=screen.getByRole("region",{name:"Prévia da etiqueta"});
  expect(within(previa).queryByRole("heading")).toBeNull();
  expect(within(previa).getByRole("img",{name:"Prévia de etiqueta 60 por 60 milímetros"})).toBeDefined();
  expect(sim.preparar).not.toHaveBeenCalled();
});
