// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
const sim = vi.hoisted(() => ({ listarPorcoes: vi.fn(async () => ({ porcoes: [] as { id: string; insumoId: string; nome: string; quantidade: string; unidade: string; versao: number }[], podeCadastrar: false })), salvar: vi.fn(), atualizar: vi.fn(), cep: vi.fn() }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/produtos/embalagens-actions",()=>({salvarTipoEmbalagemAction:vi.fn()}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.atualizar }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/app/(protegido)/insumos/actions", () => ({ saveInsumoAction: vi.fn() }));
vi.mock("@/lib/insumos/consulta-porcoes-cliente", () => ({ consultarPorcoesNoCliente: sim.listarPorcoes, salvarPorcaoAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/actions", () => ({ alterarSituacaoProdutoVendaAction: sim.salvar, alterarPrecoProdutoVendaAction: sim.salvar, criarCanalVendaAction: sim.salvar, salvarPrecoCanalVendaAction: sim.salvar, excluirCadastroVendaAction: sim.salvar, salvarClienteVendaAction: sim.salvar, salvarProdutoVendaAction: sim.salvar, salvarGrupoVendaAction: sim.salvar, salvarCategoriaVendaAction: sim.salvar, salvarCategoriaGrupoVendaAction: sim.salvar, reordenarCategoriasVendaAction: sim.salvar, reordenarProdutosVendaAction: sim.salvar, enviarFotoProdutoVendaAction: sim.salvar }));
vi.mock("@/app/(protegido)/vendas/clientes/credito-actions", () => ({ ajustarCreditoClienteAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/historico-actions", () => ({ consultarHistoricoPedidosClienteAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/cadastro-actions", () => ({  buscarCnpjClienteAction: vi.fn(), buscarCepClienteAction: sim.cep }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), buscarCepPedidoAction: vi.fn() }));
import { ClientesVenda } from "@/app/(protegido)/vendas/clientes/clientes-client";
import { ProdutosVenda } from "@/app/(protegido)/vendas/produtos/produtos-client";
import { CatalogoVenda, EditorGrupo } from "@/app/(protegido)/vendas/catalogo/catalogo-client";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); sim.listarPorcoes.mockResolvedValue({ porcoes: [], podeCadastrar: false }); });
const vazio = { tiposEmbalagem: [], canais: [], produtos: [], insumos: [], categorias: [], categoriasGrupos: [], grupos: [], gruposFiscais: [] };
describe("interface de cadastros de Vendas", () => {
  it("cliente inválido fica aberto; salva após preencher e preserva em erro", async () => {
    sim.salvar.mockResolvedValue({ erro: "Falha simulada" });
    sim.cep.mockResolvedValue({ endereco: { logradouro: "Rua fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
    render(<ClientesVenda clientes={[]} total={0} pagina={1} busca="" situacao="ativos" adicionar editar />);
    fireEvent.click(screen.getByRole("button", { name: "Novo cliente" }));
    const emailCliente = screen.getByRole("textbox", { name: "E-mail" }) as HTMLInputElement;
    expect(emailCliente.required).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).not.toHaveBeenCalled();
    expect(emailCliente.validity.valueMissing).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.change(emailCliente, { target: { value: "cliente.novo@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("tipo"));
    const usuarioCliente = userEvent.setup();
    await usuarioCliente.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await usuarioCliente.click(await screen.findByRole("option", { name: "Pessoa Física" }));
    const cobrancaCliente = within(screen.getByRole("group", { name: "Principal" }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "Nome Completo *" })[0], { target: { value: "Cliente fictício" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Telefone *" }), { target: { value: "11999991234" } });
    const cep = cobrancaCliente.getByRole("textbox", { name: "CEP *" });
    fireEvent.change(cep, { target: { value: "01001000" } });
    expect(cep).toHaveProperty("value", "01001-000");
    fireEvent.blur(cep);
    await waitFor(() => expect(cobrancaCliente.getByRole("textbox", { name: "Logradouro *" })).toHaveProperty("value", "Rua fictícia"));
    expect(sim.cep).toHaveBeenCalledWith("01001000");
    for (const nome of ["Logradouro *", "Bairro *", "Cidade *", "Estado / UF *"]) {
      expect(cobrancaCliente.getByRole("textbox", { name: nome })).toHaveProperty("readOnly", true);
    }
    fireEvent.change(cobrancaCliente.getByRole("textbox", { name: "Número *" }), { target: { value: "10" } });
    fireEvent.change(cobrancaCliente.getByRole("textbox", { name: "Complemento (opcional)" }), { target: { value: "Sala fictícia" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Falha simulada"));
    expect((screen.getAllByRole("textbox", { name: "Nome Completo *" })[0] as HTMLInputElement).value).toBe("Cliente fictício");
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Cliente fictício", email: "cliente.novo@example.invalid", telefone: "+5511999991234", enderecos: [expect.objectContaining({ pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP", complemento: "Sala fictícia" })] }));
    sim.salvar.mockResolvedValue({ ok: true, id: "novo" }); fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }, 15000);
  it("abre a aba que contém o campo obrigatório inválido", async () => {
    render(<ProdutosVenda dados={vazio} adicionar editar />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo produto" })); await u.click(screen.getByRole("button", { name: "Preço" }));
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).not.toHaveBeenCalled(); expect(await screen.findByRole("textbox", { name: "Nome *" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome *" }), { target: { value: "Produto novo" } });
    expect((screen.getByRole("textbox", { name: "Nome *" }) as HTMLInputElement).checkValidity()).toBe(true);
  });
  it("Extras não apresenta limite máximo editável", async () => {
    render(<CatalogoVenda dados={{ categorias: [], categoriasGrupos: [], produtos: [{ id: "produto-extra", nome: "Produto sintético", ativo: true, preco: "12", versao: 1, grupos: [] }], grupos: [{ id: "extras", nome: "Extras", tipo: "EXTRAS", categoriaId: null, versao: 1, ativo: true, minimo: 0, maximo: null, repetir: true, produtos: ["p"], opcoes: [] }] }} adicionar editar />);
    const u = userEvent.setup(); await u.click(screen.getByRole("tab", { name: "Grupos de complementos" })); await u.click(screen.getByRole("button", { name: "Editar Extras" }));
    expect(screen.queryByRole("spinbutton", { name: /Máximo/ })).toBeNull();
    expect(screen.getByText(/Extras é sempre opcional/)).toBeTruthy();
    await u.click(screen.getByRole("combobox", { name: "Produtos e complementos do grupo" }));
    await u.click(await screen.findByRole("option", { name: "Produto sintético" }));
    await u.keyboard("{Escape}");
    expect(screen.getByRole("textbox", { name: "Nome da opção 1" })).toBeTruthy();
  });
  it("inclui opções no topo, mantém o preenchimento e não salva até confirmar", async () => {
    render(<EditorGrupo inicial={{ id: "", versao: 0, nome: "Grupo fictício", tipo: "COMPOSICAO", categoriaId: null, minimo: 0, maximo: 1, repetir: false, ativo: true, opcoes: [] }} afetados={0} produtos={[]} insumos={[]} fechar={vi.fn()} />);
    const u = userEvent.setup();
    const adicionar = screen.getByRole("button", { name: "Adicionar opção" });
    await u.click(adicionar);
    await u.type(screen.getByRole("textbox", { name: "Nome da opção 1" }), "Primeira preenchida");
    await u.click(adicionar);
    const primeira = screen.getByRole("textbox", { name: "Nome da opção 1" });
    expect(primeira).toHaveProperty("value", "");
    expect(document.activeElement).toBe(primeira);
    expect(screen.getByRole("textbox", { name: "Nome da opção 2" })).toHaveProperty("value", "Primeira preenchida");
    await u.type(primeira, "Segunda preenchida");
    await u.click(adicionar);
    expect(screen.getAllByRole("textbox", { name: /Nome da opção/ }).map(e => (e as HTMLInputElement).value)).toEqual(["", "Segunda preenchida", "Primeira preenchida"]);
    expect(adicionar.compareDocumentPosition(screen.getByRole("textbox", { name: "Nome da opção 1" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("cria categoria dentro do produto e preserva o preenchimento sem salvar o pai", async () => {
    sim.salvar.mockResolvedValueOnce({ ok: true, id: "c", registro: { id: "c", versao: 1, nome: "Categoria nova", ativo: true, ordem: 0, produtos: [] } });
    render(<ProdutosVenda dados={vazio} adicionar editar adicionarCatalogo />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo produto" }));
    await u.type(screen.getByRole("textbox", { name: "Nome *" }), "Produto ainda não salvo");
    await u.click(screen.getByRole("button", { name: "Criar categoria" }));
    const categoria = within(screen.getByRole("dialog", { name: "Nova categoria" }));
    await u.type(categoria.getByRole("textbox", { name: "Nome *" }), "Categoria nova");
    await u.click(categoria.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova categoria" })).toBeNull());
    expect(sim.salvar).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox", { name: "Nome *" }) as HTMLInputElement).value).toBe("Produto ainda não salvo");
    expect(screen.getByRole("button", { name: "Remover Categoria nova" })).toBeTruthy();
    await u.click(screen.getByRole("combobox", { name: "Categorias do produto" }));
    expect(screen.getByRole("option", { name: "Categoria nova" }).getAttribute("aria-selected")).toBe("true");
  });
  it("não oferece cadastro rápido de catálogo sem permissão", async () => {
    render(<ProdutosVenda dados={vazio} adicionar editar />);
    await userEvent.click(screen.getByRole("button", { name: "Novo produto" }));
    expect(screen.queryByRole("button", { name: "Criar categoria" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Composição" }));
    expect(screen.queryByRole("button", { name: "Criar grupo de complementos" })).toBeNull();
  });
});

const catalogo = {
  tiposEmbalagem: [],
  categorias:[{id:"c",nome:"Tábuas",versao:1,ativo:true,ordem:0,produtos:[{produtoId:"p",ordem:0}]}],
  canais:["DIRETO","IFOOD"], categoriasGrupos:[], gruposFiscais:[],
  grupos:[{id:"g",nome:"Escolhas de queijo",versao:1,tipo:"COMPOSICAO" as const,categoriaId:null,minimo:1,maximo:2,repetir:false,ativo:true,produtos:["p"],opcoes:["Brie","Gouda"].map((nome,i)=>({id:"o"+i,grupoId:"g",nome,preco:"10",produtoId:null,quantidade:"1",ativo:true,ordem:i}))}],
  insumos:[{id:"i",nome:"Queijo",categoriaNome:"Laticínios",tipo:"INSUMO" as const,especificacao:null,unidade:"KG" as const,custo:20,ativo:true}],
  produtos:[{tipoEmbalagemId:null,slotsEntrega:null,id:"p",versao:1,nome:"Produto catálogo",especificacao:null,descricao:"Descrição detalhada",tipo:"PADRAO" as const,classificacao:"PRINCIPAL" as const,classificacoes:["PRINCIPAL" as const],tempoPreparoMinutos:12,codigo:null,unidade:"UN",fotoUrl:"/api/vendas/fotos/foto",observacoes:null,modoPreparo:null,ativo:true,fiscalRevisado:false,fiscal:{},grupoFiscalId:null,categorias:["c"],grupos:[{grupoId:"g",usarPadrao:true,minimo:1,maximo:2,opcoesExcluidas:[]}],preco: "80",componentes:[{insumoId:"i",quantidade:"0.1",unidade:"KG" as const,observacaoPorcao:null}]}],
};
describe("catálogo expansível e regras próprias",()=>{
  it("link da atividade mostra detalhes de produto inativo sem abrir editor ou liberar preço", () => {
    render(<ProdutosVenda dados={{ ...catalogo, produtos: [{ ...catalogo.produtos[0], ativo: false }] }} entidadeInicialId="p" adicionar={false} editar={false} />);
    expect(screen.getByText("Descrição detalhada")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Situação dos produtos" }).textContent).toContain("Inativos");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar Produto catálogo" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Preço de Produto catálogo" })).toHaveProperty("disabled", true);
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it.each([undefined, "ausente", "<p>", "x".repeat(161)])("ignora alvo inválido/ausente %s mantendo produtos recolhidos", entidadeInicialId => {
    render(<ProdutosVenda dados={catalogo} entidadeInicialId={entidadeInicialId} adicionar={false} editar={false} />);
    expect(screen.queryByText("Descrição detalhada")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("abre a ficha dentro do produto e retorna ao rascunho sem salvar", async () => {
    render(<ProdutosVenda dados={catalogo} adicionar editar />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Editar Produto catálogo" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome *" }), { target: { value: "Produto em edição" } });
    const imprimir = screen.getByRole("button", { name: "Imprimir ficha técnica" });
    await usuario.click(imprimir);
    const ficha = await screen.findByRole("dialog", { name: "Ficha técnica · Produto em edição" });
    const editor = screen.getByRole("dialog", { name: "Editar produto" });
    expect(editor.getAttribute("data-dialogo-suspenso")).toBe("true");
    expect(editor.hasAttribute("inert")).toBe(true);
    const html = within(ficha).getByTitle("Ficha técnica de Produto em edição").getAttribute("srcdoc");
    expect(html).toContain("Produto em edição");
    expect(html).toContain("Queijo");
    for (const texto of ["Grupos e alternativas", "Escolhas de queijo", "Brie", "Gouda"]) expect(html).not.toContain(texto);
    expect(within(ficha).getByText("Ficha-mestre: ingredientes, porções e informações de montagem. Nenhum estoque é movimentado.")).toBeTruthy();
    expect(within(ficha).getByRole("button", { name: "Imprimir / salvar PDF" })).toBeTruthy();
    await usuario.keyboard("{Escape}");
    await screen.findByRole("dialog", { name: "Editar produto" });
    await waitFor(() => expect(editor.hasAttribute("inert")).toBe(false));
    expect(screen.getByRole("textbox", { name: "Nome *" })).toHaveProperty("value", "Produto em edição");
    expect(sim.salvar).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(imprimir));
  });
  it("seleciona categorias no campo, preserva inativas vinculadas e salva apenas na confirmação", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    const categorias = [...catalogo.categorias,
      { id: "c2", nome: "Presentes", versao: 1, ativo: true, ordem: 1, produtos: [] },
      { id: "antiga", nome: "Coleção antiga", versao: 1, ativo: false, ordem: 2, produtos: [] },
      { id: "oculta", nome: "Outra categoria inativa", versao: 1, ativo: false, ordem: 3, produtos: [] },
    ];
    render(<ProdutosVenda dados={{ ...catalogo, categorias, produtos: [{ ...catalogo.produtos[0], categorias: ["c", "antiga"] }] }} adicionar editar />);
    const u = userEvent.setup();
    await u.click(screen.getAllByRole("button", { name: "Editar Produto catálogo" })[0]);
    const campo = screen.getByRole("combobox", { name: "Categorias do produto" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Remover Coleção antiga" })).toBeTruthy();
    await u.click(campo);
    expect(screen.getByRole("option", { name: "Tábuas" }).getAttribute("aria-selected")).toBe("true");
    const inativa = screen.getByRole("option", { name: /Coleção antiga/ });
    expect(inativa.getAttribute("aria-selected")).toBe("true");
    expect(within(inativa).getByText("Inativa")).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Outra categoria inativa/ })).toBeNull();
    await u.click(screen.getByRole("option", { name: "Presentes" }));
    expect(screen.getByRole("listbox")).toBeTruthy();
    await u.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Editar produto" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover Presentes" })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Remover Tábuas" }));
    expect(screen.queryByRole("button", { name: "Remover Tábuas" })).toBeNull();
    expect(sim.salvar).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ categorias: ["c2", "antiga"] }));
    expect(catalogo.produtos[0].categorias).toEqual(["c"]);
  });
  it("ordena ingredientes e oculta da ficha sem retirar da composição", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    const d = { ...catalogo, insumos: [...catalogo.insumos, { ...catalogo.insumos[0], id:"saco", nome:"Saco para embalar", unidade:"UN" as const, custo:1 }], produtos: [{ ...catalogo.produtos[0], componentes: [...catalogo.produtos[0].componentes, { insumoId:"saco",quantidade:"1",unidade:"UN" as const,observacaoPorcao:null }] }] };
    render(<ProdutosVenda dados={d} adicionar editar adicionarCatalogo />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button",{name:"Editar Produto catálogo"}));
    expect(screen.queryByRole("button",{name:"Complementos"})).toBeNull();
    await u.click(screen.getByRole("button",{name:"Composição"}));
    const alca = screen.getByRole("button",{name:"Arrastar Saco para embalar"});
    alca.focus(); await u.keyboard(" {ArrowUp}{Enter}");
    await u.click(screen.getByRole("button",{name:"Exibir Saco para embalar na ficha técnica"}));
    expect(screen.getByRole("button",{name:"Exibir Saco para embalar na ficha técnica"}).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("heading",{name:"Grupo de complementos"})).toBeTruthy();
    expect(screen.getByRole("combobox",{name:"Grupo de complementos"})).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Próximos grupos"})).toBeNull();
    await u.click(screen.getByRole("button",{name:"Salvar"}));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({componentes:[
      expect.objectContaining({insumoId:"saco",quantidade:"1",exibirFicha:false}),
      expect.objectContaining({insumoId:"i",quantidade:"0.1",exibirFicha:true}),
    ]}));
  });
  it("preço zero configurável mantém os controles e permite cancelar o rascunho", async () => {
    const dados = { ...catalogo, produtos: [{ ...catalogo.produtos[0], preco: "0" }] };
    render(<ProdutosVenda dados={dados} adicionar editar />);
    const campo = screen.getByRole("textbox", { name: "Preço de Produto catálogo" });
    fireEvent.change(campo, { target: { value: "500" } });
    fireEvent.blur(campo); expect(sim.salvar).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cancelar preço de Produto catálogo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar preço de Produto catálogo" })).toBeNull();
    expect(campo).toHaveProperty("value", "0,00");
    expect(screen.queryByRole("button", { name: /Desconto SITE/ })).toBeNull();
  });
  it("mostra preço único, foto e detalhes ao expandir",async()=>{
    render(<ProdutosVenda dados={catalogo} adicionar editar/>);
    expect(screen.getAllByRole("columnheader").map(v => v.textContent)).toEqual(["Produto", "Preço", "Status", "Ações"]);
    expect(screen.getByRole("textbox", { name: "Preço de Produto catálogo" })).toHaveProperty("value", "80,00");
    expect(screen.queryByRole("button",{name:/Desconto DIRETO/})).toBeNull();
    const imprimir = screen.getByRole("button",{name:"Imprimir ficha técnica de Produto catálogo"});
    const linha = imprimir.closest("tr")!;
    const celulas = within(linha).getAllByRole("cell");
    expect(celulas).toHaveLength(4);
    expect(within(celulas[2]).getByRole("switch", { name: "Status de Produto catálogo" })).toBeTruthy();
    expect(within(celulas[3]).queryByRole("switch")).toBeNull();
    expect(within(celulas[3]).getAllByRole("button").map(botao => botao.getAttribute("aria-label"))).toEqual(["Imprimir ficha técnica de Produto catálogo", "Editar Produto catálogo", "Excluir Produto catálogo"]);
    const expandir = screen.getByRole("button", { name: "Abrir detalhes de Produto catálogo" });
    expect(expandir.firstElementChild?.classList.contains("lucide-chevron-right")).toBe(true);
    expect(expandir.firstElementChild?.nextElementSibling?.querySelector("img")).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute("src")).toBe("/api/vendas/fotos/foto");
    expect(screen.queryByText("Descrição detalhada")).toBeNull();
    expandir.focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(screen.getByText("Descrição detalhada")).toBeTruthy();
    expect(document.getElementById("detalhes-p")?.querySelector("td")?.colSpan).toBe(4);
    await userEvent.click(screen.getByRole("switch",{name:"Status de Produto catálogo"}));
    expect(sim.salvar).toHaveBeenCalledWith("p",1,false);
    expect(expandir.getAttribute("aria-expanded")).toBe("true");
  });
  it("o preço único não apresenta promoção ou preços por canal", () => {
    render(<ProdutosVenda dados={catalogo} adicionar editar />);
    expect(screen.getAllByRole("textbox", { name: /Preço de/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Desconto/ })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "IFOOD" })).toBeNull();
  });
  it("exige confirmação para alterar preço pela lista",async()=>{
    sim.salvar.mockResolvedValue({ok:true,versao:2});render(<ProdutosVenda dados={catalogo} adicionar editar/>);
    fireEvent.change(screen.getByRole("textbox",{name:"Preço de Produto catálogo"}),{target:{value:"7000"}});
    expect(sim.salvar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button",{name:"Confirmar preço de Produto catálogo"}));
    await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith("p",1,"70.00"));
  });
  it("altera os limites e desmarca opção só no vínculo deste produto",async()=>{
    sim.salvar.mockResolvedValue({ok:true});render(<ProdutosVenda dados={catalogo} adicionar editar/>);
    const u=userEvent.setup();await u.click(screen.getByRole("button",{name:"Editar Produto catálogo"}));
    await u.click(screen.getByRole("button",{name:"Composição"}));
    const resumo = screen.getByRole("button",{name:"Abrir grupo Escolhas de queijo"});
    expect(resumo.getAttribute("aria-expanded")).toBe("false");
    const obrigatorio = screen.getByRole("checkbox",{name:"Obrigatório"});
    expect((obrigatorio as HTMLInputElement).checked).toBe(true);
    await u.click(obrigatorio);
    expect((screen.getByRole("spinbutton",{name:"Mínimo de Escolhas de queijo"}) as HTMLInputElement).value).toBe("0");
    await u.click(obrigatorio);
    expect((screen.getByRole("spinbutton",{name:"Mínimo de Escolhas de queijo"}) as HTMLInputElement).value).toBe("1");
    fireEvent.change(screen.getByRole("spinbutton",{name:/Máximo de Escolhas de queijo/}),{target:{value:"1"}});
    await u.click(resumo);
    await u.click(screen.getByRole("button",{name:"Remover Gouda"}));
    await u.click(screen.getByRole("button",{name:"Salvar"}));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({grupos:[expect.objectContaining({usarPadrao:false,minimo:1,maximo:1,opcoesExcluidas:["o1"]})]}));
    expect(catalogo.produtos[0].grupos[0].opcoesExcluidas).toEqual([]);
  });
  it("recolhe e reabre o grupo pelo teclado sem perder preço ou salvar o rascunho", async () => {
    render(<ProdutosVenda dados={catalogo} adicionar editar />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar Produto catálogo" }));
    await u.click(screen.getByRole("button", { name: "Composição" }));
    const grupo = screen.getByRole("button", { name: "Abrir grupo Escolhas de queijo" });
    grupo.focus(); await u.keyboard("{Enter}");
    expect(grupo.getAttribute("aria-expanded")).toBe("true");
    const preco = screen.getByRole("textbox", { name: "Preço de Brie" });
    fireEvent.change(preco, { target: { value: "12,50" } });
    grupo.focus(); await u.keyboard(" ");
    expect(grupo.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("textbox", { name: "Preço de Brie" })).toBeNull();
    await u.keyboard("{Enter}");
    expect((screen.getByRole("textbox", { name: "Preço de Brie" }) as HTMLInputElement).value).toBe("12,50");
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("seleciona grupos por categoria sem perder vínculos existentes", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    const outro = { ...catalogo.grupos[0], id: "g2", nome: "Acompanhamentos", categoriaId: "categoria-grupos", produtos: [], opcoes: [] };
    const dados = { ...catalogo, categoriasGrupos: [{ id: "categoria-grupos", nome: "Extras", versao: 1, ativo: true, ordem: 0 }], grupos: [...catalogo.grupos, outro] };
    render(<ProdutosVenda dados={dados} adicionar editar />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar Produto catálogo" }));
    await u.click(screen.getByRole("button", { name: "Composição" }));
    await u.click(screen.getByRole("combobox", { name: "Grupo de complementos" }));
    expect(screen.getByText("Extras", { exact: true })).toBeTruthy();
    expect(screen.getByText("Sem categoria", { exact: true })).toBeTruthy();
    await u.click(await screen.findByRole("option", { name: /Acompanhamentos/ }));
    await u.keyboard("{Escape}");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ grupos: [expect.objectContaining({ grupoId: "g" }), expect.objectContaining({ grupoId: "g2" })] }));
  }, 15000);
  it("remove um grupo vinculado pela própria linha e envia a composição sem ele", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    render(<ProdutosVenda dados={catalogo} adicionar editar />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar Produto catálogo" }));
    await u.click(screen.getByRole("button", { name: "Composição" }));
    await u.click(screen.getByRole("button", { name: "Remover grupo Escolhas de queijo do produto" }));
    expect(screen.queryByRole("button", { name: "Remover grupo Escolhas de queijo do produto" })).toBeNull();
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ grupos: [] }));
  });
  it("reutiliza composição de preparações sem rendimento, validade ou modo",async()=>{
    sim.salvar.mockResolvedValue({ok:true});
    sim.listarPorcoes.mockResolvedValue({ porcoes: [{ id: "fatia-teste", insumoId: "i", nome: "1 fatia", quantidade: "0.2", unidade: "KG", versao: 1 }], podeCadastrar: false });
    render(<ProdutosVenda dados={catalogo} adicionar editar/>);
    const u=userEvent.setup();await u.click(screen.getByRole("button",{name:"Editar Produto catálogo"}));await u.click(screen.getByRole("button",{name:"Composição"}));
    expect(screen.getByRole("button",{name:"Adicionar ingrediente"})).toBeTruthy();
    expect(screen.getByRole("textbox",{name:"Descrição da porção de Queijo"})).toBeTruthy();
    expect(screen.queryByLabelText(/Modo de preparo/)).toBeNull();expect(screen.queryByLabelText(/Rendimento/)).toBeNull();expect(screen.queryByLabelText(/Validade/)).toBeNull();
    fireEvent.change(screen.getByRole("spinbutton",{name:"Tempo de preparo (minutos)"}),{target:{value:"25"}});
    fireEvent.change(screen.getByRole("textbox",{name:"Quantidade de Queijo"}),{target:{value:"0.2"}});
    expect(screen.getAllByText(/R\$\s*4,00/)).toHaveLength(2);
    const numero = screen.getByRole("textbox", { name: "Quantidade de porções de Queijo" });
    await waitFor(() => expect(numero).not.toHaveProperty("disabled", true));
    fireEvent.change(numero, { target: { value: "1" } });
    expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo" })).toHaveProperty("value", "1 fatia");
    await u.click(screen.getByRole("button",{name:"Salvar"}));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({tempoPreparoMinutos:25,componentes:[expect.objectContaining({observacaoPorcao:"1 fatia",quantidade:"0.2"})]}));
  });
  it("abre fiscal diretamente, sugere grupo sem impor NCM e salva junto com o produto", async () => {
    mockarCatalogoFiscal();
    sim.salvar.mockResolvedValue({ ok: true });
    render(<ProdutosVenda dados={{ ...catalogo, gruposFiscais: [{ id: "gf", nome: "Produção", codigo: null, versao: 1, ativo: true, fiscal: { ncm: "04069020", cfop: "5101" } }] }} adicionar editar podeVerFiscal podeEditarFiscal />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar Produto catálogo" }));
    await u.click(screen.getByRole("button", { name: "Fiscal" }));
    expect(screen.queryByRole("button", { name: "Editar dados fiscais" })).toBeNull();
    await u.click(screen.getByRole("combobox", { name: "Grupo fiscal" }));
    await u.click(await screen.findByRole("option", { name: "Produção" }));
    expect(screen.getByRole("combobox", { name: "NCM" })).toHaveProperty("value", "");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ salvarFiscal: true, grupoFiscalId: "gf", fiscal: { cfop: "5101" }, fiscalRevisado: false }));
  });
  it("preço zero mantém os controles e só grava após confirmação", async () => {
    sim.salvar.mockResolvedValue({ ok: true, versao: 2 });
    render(<ProdutosVenda dados={{ ...catalogo, produtos: [{ ...catalogo.produtos[0], preco: "0" }] }} adicionar editar />);
    expect(screen.queryByRole("button", { name: "Confirmar preço de Produto catálogo" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Preço de Produto catálogo" }), { target: { value: "9000" } });
    expect(sim.salvar).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar preço de Produto catálogo" }));
    await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith("p", 1, "90.00"));
  });
  it("complemento pode ficar sem grupo e tem um único campo de preço", async () => {
    render(<ProdutosVenda dados={catalogo} adicionar editar />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo produto" }));
    await u.type(screen.getByRole("textbox", { name: "Nome *" }), "Novo complemento");
    await u.click(screen.getByRole("combobox", { name: "Classificação" }));
    await u.click(await screen.findByRole("option", { name: "Complemento" }));
    await u.click(screen.getByRole("button", { name: "Preço" }));
    expect(screen.getByRole("textbox", { name: "Preço do produto" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /Canal do preço/ })).toBeNull();
  });
});

describe("Complementos e escopo da pausa", () => {
  it("retorna à aba do campo obrigatório ao salvar pela disponibilidade", async () => {
    render(<CatalogoVenda dados={catalogo} dadosComplementos={catalogo} adicionar editar adicionarComplemento editarComplemento />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo complemento" }));
    await u.click(screen.getByRole("tab", { name: "Disponibilidade" }));
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).not.toHaveBeenCalled();
    expect(await screen.findByRole("textbox", { name: "Nome do complemento *" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Cadastro", selected: true })).toBeTruthy();
  });
  it("mostra tags internas e a disponibilidade do complemento sem salvar ao trocar abas", async () => {
    const complemento = { ...catalogo.produtos[0], id: "copa", nome: "Copa sintética", classificacoes: ["COMPLEMENTO" as const], grupos: [], categorias: ["interna"] };
    const dados = { ...catalogo, categorias: [...catalogo.categorias, { id: "interna", nome: "Charcutaria", escopo: "COMPLEMENTO" as const, cor: "verde" as const, versao: 1, ativo: true, ordem: 1, produtos: [] }], produtos: [...catalogo.produtos, complemento], grupos: [{ ...catalogo.grupos[0], opcoes: [{ ...catalogo.grupos[0].opcoes[0], produtoId: "copa" }] }] };
    render(<CatalogoVenda dados={dados} dadosComplementos={dados} adicionar editar adicionarComplemento editarComplemento />);
    expect(screen.getByRole("columnheader", { name: "Categoria" })).toBeTruthy();
    const linha = screen.getByRole("button", { name: "Editar Copa sintética" }).closest("tr")!;
    expect(within(linha).getByText("Charcutaria").getAttribute("data-slot")).toBe("badge");
    expect(screen.queryByRole("combobox", { name: /Classificação dos/ })).toBeNull();
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Editar Copa sintética" }));
    await u.click(screen.getByRole("tab", { name: "Disponibilidade" }));
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByText("Produto catálogo")).toBeTruthy();
    expect(dialogo.getByText("Disponível", { exact: true })).toBeTruthy();
    await u.click(dialogo.getByRole("tab", { name: "Cadastro" }));
    expect(dialogo.getByRole("textbox", { name: "Nome do complemento *" })).toHaveProperty("value", "Copa sintética");
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("adiciona Produto e Complemento a um grupo com herança do cadastro", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    const principal = { ...catalogo.produtos[0], grupos: [] };
    const complemento = { ...principal, id: "copa", nome: "Copa sintética", classificacoes: ["COMPLEMENTO" as const], classificacao: "COMPLEMENTO" as const };
    render(<EditorGrupo inicial={{ ...catalogo.grupos[0], id: "", versao: 0, opcoes: [] }} produtos={[principal, complemento]} afetados={0} fechar={() => {}} />);
    const u = userEvent.setup(); await u.click(screen.getByRole("combobox", { name: "Produtos e complementos do grupo" }));
    await u.click(await screen.findByRole("option", { name: "Produto catálogo" }));
    await u.click(screen.getByRole("option", { name: "Copa sintética" })); await u.keyboard("{Escape}");
    expect(sim.salvar).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ opcoes: expect.arrayContaining([expect.objectContaining({ produtoId: "p", usarPrecoPadrao: true, composicao: null, quantidade: "1" }), expect.objectContaining({ produtoId: "copa", usarPrecoPadrao: true, composicao: null, quantidade: "1" })]) }));
  }, 15000);
  it("mostra complemento com foto, preço único e CMV; salva explicitamente", async () => {
    const complemento = { ...catalogo.produtos[0], id: "compl", nome: "Salame", classificacoes: ["COMPLEMENTO" as const], grupos: [], preco: "10" };
    const dados = { ...catalogo, produtos: [complemento] };
    sim.salvar.mockResolvedValue({ ok: true, versao: 2 });
    render(<ProvedorAcesso acesso={{ admin: false, permissoes: { "financeiro.custos": ["visualizar"] }, excecoes: {} }}><CatalogoVenda dados={dados} dadosComplementos={dados} adicionar editar adicionarComplemento editarComplemento /></ProvedorAcesso>);
    expect(screen.getAllByRole("columnheader").map(v => v.textContent)).toEqual(["Complemento", "Categoria", "Preço", "Status", "Ações"]);
    const linha = screen.getByRole("button", { name: "Editar Salame" }).closest("tr")!;
    const celulas = within(linha).getAllByRole("cell");
    expect(within(celulas[3]).getByRole("switch", { name: "Status de Salame" })).toBeTruthy();
    expect(within(celulas[4]).getAllByRole("button").map(botao => botao.getAttribute("aria-label"))).toEqual(["Editar Salame", "Excluir Salame"]);
    const expandir = screen.getByRole("button", { name: "Abrir detalhes de Salame" });
    expect(expandir.firstElementChild?.classList.contains("lucide-chevron-right")).toBe(true);
    expect(expandir.firstElementChild?.nextElementSibling?.querySelector("img")).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute("src")).toBe("/api/vendas/fotos/foto");
    expect(screen.getAllByText(/CMV: R\$\s*2,00/)).toHaveLength(1);
    const campo = screen.getByRole("textbox", { name: "Preço de Salame" });
    fireEvent.change(campo, { target: { value: "800" } });
    expect(sim.salvar).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar preço de Salame" }));
    await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith("compl", 1, "8.00"));
  });
  it("omite CMV e bloqueia edição na consulta de complemento sem permissão", () => {
    const complemento = { ...catalogo.produtos[0], id: "compl", nome: "Sem receita", classificacoes: ["COMPLEMENTO" as const], grupos: [], componentes: [] };
    const dados = { ...catalogo, produtos: [complemento] };
    render(<CatalogoVenda dados={dados} dadosComplementos={dados} adicionar={false} editar={false} />);
    expect(screen.getAllByText("CMV: não autorizado")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Preço de Sem receita" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Editar Sem receita" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo complemento" })).toBeNull();
  });
  it("foto enviada fica no rascunho do complemento e salvar aguarda a conclusão do envio", async () => {
    let concluir!: (resultado: { ok: boolean; url: string }) => void;
    sim.salvar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
    render(<CatalogoVenda dados={catalogo} dadosComplementos={catalogo} adicionar editar adicionarComplemento editarComplemento />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo complemento" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do complemento *" }), { target: { value: "Salame" } });
    await u.upload(screen.getByLabelText("Escolher foto do complemento"), new File(["imagem sintética"], "foto.png", { type: "image/png" }));
    expect(screen.getByRole("button", { name: "Aguarde o envio…" })).toHaveProperty("disabled", true);
    expect(sim.salvar).toHaveBeenCalledTimes(1);
    concluir({ ok: true, url: "/api/vendas/fotos/foto-sintetica" });
    await waitFor(() => expect(screen.getByRole("img", { name: "Foto do complemento" }).getAttribute("src")).toBe("/api/vendas/fotos/foto-sintetica"));
    sim.salvar.mockResolvedValue({ ok: true });
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenLastCalledWith(expect.objectContaining({ fotoUrl: "/api/vendas/fotos/foto-sintetica", classificacoes: ["COMPLEMENTO"] }));
  });
  it("salva o preço único no cadastro do complemento", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    render(<CatalogoVenda dados={catalogo} dadosComplementos={catalogo} adicionar editar adicionarComplemento editarComplemento />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo complemento" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do complemento *" }), { target: { value: "Salame" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Preço do complemento" }), { target: { value: "1000" } });
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ preco: "10.00" }));
    expect(sim.salvar.mock.calls[0][0]).not.toHaveProperty("precos");
  });
  it("edita ingredientes diretamente sem seletor de complemento para composição", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    render(<EditorGrupo inicial={catalogo.grupos[0]} produtos={catalogo.produtos} insumos={catalogo.insumos} afetados={1} fechar={() => {}} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Abrir composição de Brie" }));
    expect(screen.queryByRole("combobox", { name: /Complemento para composição/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Nome da opção 1" })).toHaveProperty("value", "Brie");
    expect(screen.getByRole("combobox", { name: "Ingrediente" })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ opcoes: expect.arrayContaining([expect.objectContaining({ id: "o0", nome: "Brie", produtoId: null })]) }));
  });
  it("abre a primeira aba com lista e salva cadastro simples grátis sem grupo e sem FM", async () => {
    sim.salvar.mockResolvedValue({ ok: true });
    render(<CatalogoVenda dados={catalogo} dadosComplementos={catalogo} adicionar editar adicionarComplemento editarComplemento />);
    expect(screen.getByRole("tab", { name: "Complementos", selected: true })).toBeTruthy();
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Novo complemento" }));
    await u.type(screen.getByRole("textbox", { name: "Nome do complemento *" }), "Salame");
    expect(screen.queryByRole("button", { name: /ficha de montagem/i })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Grupo ativo" })).toBeNull();
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Salame", preco: "0", classificacoes: ["COMPLEMENTO"], grupos: [], componentes: [] }));
  });
  it.each(["Apenas neste produto", "Em todos os produtos"])("confirma alcance %s no rascunho, sem salvar ao clicar ou perder foco", async alcance => {
    sim.salvar.mockResolvedValue({ ok: true });
    render(<ProdutosVenda dados={catalogo} adicionar editar editarCatalogo />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Editar Produto catálogo" }));
    await u.click(screen.getByRole("button", { name: "Composição" }));
    await u.click(screen.getByRole("button", { name: "Abrir grupo Escolhas de queijo" }));
    await u.click(screen.getByRole("switch", { name: "Status de Brie" }));
    await u.click(screen.getByRole("button", { name: alcance }));
    expect(sim.salvar).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Status de Brie" }).getAttribute("aria-checked")).toBe("false");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    if (alcance === "Apenas neste produto") expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ grupos: [expect.objectContaining({ ajustesOpcoes: [{ opcaoId: "o0", ativo: false }] })] }));
    else expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ pausasComplementos: [{ opcaoId: "o0", ativo: false, grupos: [{ id: "g", versao: 1 }] }] }));
  }, 15000);
});
