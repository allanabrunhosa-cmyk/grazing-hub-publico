// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,expect,it,vi} from "vitest";
import {FaturaView} from "@/app/(protegido)/financeiro/cartoes/fatura-view";
import type {DadosFatura} from "@/lib/financeiro/faturas/consultas";
import {ProvedorAcesso} from "@/components/layout/acesso-contexto";
import {cadastros,faturaVisual} from "./dados-interface";
const a=vi.hoisted(()=>({concluir:vi.fn(async()=>({ok:true})),corrigir:vi.fn(async()=>({ok:true})),vincular:vi.fn(async()=>({ok:true})),pagar:vi.fn(async()=>({ok:true})),correspondencias:vi.fn(async()=>({candidatos:[{id:"l",descricao:"Despesa já lançada",valor:10000,data:"2025-01-01",versao:"v",notaGrupo:null,correspondencia:null}],estornos:[],sugestao:null}))}));
const navegacao=vi.hoisted(()=>({refresh:vi.fn(),replace:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>navegacao}));
vi.mock("@/app/(protegido)/financeiro/cartoes/actions",()=>({concluirDespesasFaturaAction:a.concluir,corrigirCartaoDespesaAction:a.corrigir,vincularFaturaAction:a.vincular,correspondenciasFaturaAction:a.correspondencias,classificarFaturaAction:vi.fn(),ajustarItemFaturaAction:vi.fn(),cancelarFaturaAction:vi.fn(),desfazerPagamentoFaturaAction:vi.fn(),pagarFaturaAction:a.pagar}));
vi.mock("@/app/(protegido)/financeiro/cartoes/importar",()=>({ImportarFatura:()=>null}));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-dialog",()=>({FornecedorDialog:({aoSalvar,trigger}:{aoSalvar:(f:{id:string;nome:string})=>void;trigger:React.ReactNode})=><div onClick={()=>aoSalvar({id:"novo",nome:"Fornecedor criado"})}>{trigger}</div>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function montarCriacao(dados:DadosFatura={...faturaVisual,selecionada:null},acesso:Parameters<typeof ProvedorAcesso>[0]["acesso"]={admin:true,permissoes:{},excecoes:{}}){
 render(<ProvedorAcesso acesso={acesso}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
}
async function preencherNovaDespesa(){
 fireEvent.click(screen.getByRole("button",{name:"Criar despesa"}));
 const dialog=screen.getByRole("dialog");
 const usuario=userEvent.setup();
 await usuario.click(within(dialog).getByRole("combobox",{name:"Categoria financeira"}));
 await usuario.click(await screen.findByRole("option",{name:"Software e sistemas"}));
 return dialog;
}
it("cria e categoriza uma despesa sem selecionar pagamento ou possuir lancamento anterior",async()=>{
 a.correspondencias.mockResolvedValueOnce({candidatos:[],estornos:[],sugestao:null} as never);
 montarCriacao();
 const dialog=await preencherNovaDespesa();
 expect(within(dialog).getByRole("heading",{name:"Criar e conciliar lançamento"})).toBeTruthy();
 expect(within(dialog).getByText(/Nova despesa/).textContent).toMatch(/100,00/);
 expect(within(dialog).getByRole("textbox",{name:"Descrição"})).toHaveProperty("value","GOOGLE*GSUITE");
 expect(within(dialog).queryByRole("textbox",{name:/Nome do lançamento/})).toBeNull();
 expect(within(dialog).getByLabelText("Competência")).toHaveProperty("value","2026-09-01");
 expect(within(dialog).getByLabelText("Vencimento")).toHaveProperty("value","2026-09-20");
 fireEvent.change(within(dialog).getByRole("textbox",{name:"Descrição"}),{target:{value:"Assinatura de software"}});
 fireEvent.change(within(dialog).getByLabelText("Competência"),{target:{value:"2026-08-31"}});
 fireEvent.change(within(dialog).getByLabelText("Vencimento"),{target:{value:"2026-09-25"}});
 fireEvent.change(within(dialog).getByRole("textbox",{name:"Observações"}),{target:{value:"Compra identificada na fatura"}});
 fireEvent.click(within(dialog).getByRole("button",{name:"Criar e conciliar"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{
  criar:true,novo:{categoriaId:"cat",fornecedorId:null,centroCustoId:null,responsavelId:null,observacoes:"Compra identificada na fatura",descricao:"Assinatura de software",dataCompetencia:"2026-08-31",dataVencimento:"2026-09-25"},motivoDuplicidade:"",
 }));
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 expect(a.pagar).not.toHaveBeenCalled();expect(navegacao.refresh).toHaveBeenCalledOnce();
});
it("cancelar criacao preserva o item e nao cria despesa ou pagamento",async()=>{
 montarCriacao();await preencherNovaDespesa();
 fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Cancelar"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 expect(a.vincular).not.toHaveBeenCalled();expect(a.pagar).not.toHaveBeenCalled();expect(navegacao.refresh).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Classificar despesa"}));
 expect(screen.getByRole("heading",{name:"Classificar 1 item(ns)"})).toBeTruthy();
 expect(screen.queryByRole("button",{name:"Criar e conciliar"})).toBeNull();
});
it("mantem formulario e dados quando servidor rejeita a criacao por duplicidade",async()=>{
 a.vincular.mockResolvedValueOnce({erro:"Existe uma despesa correspondente. Confira e justifique."} as never);
 montarCriacao();const dialog=await preencherNovaDespesa();
 fireEvent.change(within(dialog).getByRole("textbox",{name:"Descrição"}),{target:{value:"Compra distinta"}});
 fireEvent.click(within(dialog).getByRole("button",{name:"Criar e conciliar"}));
 await waitFor(()=>expect(within(dialog).getByRole("alert").textContent).toContain("Existe uma despesa correspondente"));
 expect(screen.getByRole("dialog")).toBe(dialog);
 expect(within(dialog).getByRole("textbox",{name:"Descrição"})).toHaveProperty("value","Compra distinta");
 expect(a.pagar).not.toHaveBeenCalled();expect(navegacao.refresh).not.toHaveBeenCalled();
 fireEvent.change(within(dialog).getByRole("textbox",{name:"Justificativa se houver correspondência existente"}),{target:{value:"Compra distinta comprovada"}});
 fireEvent.click(within(dialog).getByRole("button",{name:"Criar e conciliar"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenLastCalledWith("ficticia",1,"i0",expect.objectContaining({motivoDuplicidade:"Compra distinta comprovada"})));
});
it.each(["editar-fatura","visualizar-movimentacoes","adicionar-movimentacoes"])("criacao respeita ausencia de permissao %s",(ausente)=>{
 montarCriacao(undefined,{admin:false,permissoes:{"financeiro.faturas":ausente==="editar-fatura"?["visualizar"]:["visualizar","editar"],"financeiro.movimentacoes":ausente==="visualizar-movimentacoes"?["adicionar"]:ausente==="adicionar-movimentacoes"?["visualizar"]:["visualizar","adicionar"]},excecoes:{}});
 const criar=screen.queryByRole("button",{name:"Criar despesa"});
 if(criar){expect(criar).toHaveProperty("disabled",true);fireEvent.click(criar);}
 expect(screen.queryByRole("dialog")).toBeNull();expect(a.vincular).not.toHaveBeenCalled();
});
it.each(["vinculado","ignorado","compensado","cancelado"])("nao cria despesa para item %s",(estado)=>{
 const dados={...faturaVisual,selecionada:null,cancelada:estado==="cancelado",itens:[{...faturaVisual.itens[0],ignorado:estado==="ignorado",compensadoComId:estado==="compensado"?"outro":null,lancamentos:estado==="vinculado"?[{id:"existente",descricao:"Despesa existente",valor:10000}]:[]}]} as DadosFatura;
 montarCriacao(dados);const criar=screen.queryByRole("button",{name:"Criar despesa"});
 if(criar){expect(criar).toHaveProperty("disabled",true);fireEvent.click(criar);}
 expect(screen.queryByRole("dialog")).toBeNull();expect(a.vincular).not.toHaveBeenCalled();
});
it("criacao de credito preserva sinal e nome revisado do item",()=>{
 montarCriacao({...faturaVisual,selecionada:null,itens:[{...faturaVisual.itens[0],valor:-10000,descricaoLancamento:"Reembolso revisado",tipo:"CREDITO"}]} as DadosFatura);
 fireEvent.click(screen.getByRole("button",{name:"Criar receita ou estorno"}));
 const dialog=screen.getByRole("dialog");
 expect(within(dialog).getByRole("textbox",{name:"Descrição"})).toHaveProperty("value","Reembolso revisado");
 expect(within(dialog).getByText(/Crédito \/ reembolso/).textContent).toMatch(/-.*100,00/);
 expect(within(dialog).getByRole("button",{name:"Criar e conciliar"})).toHaveProperty("disabled",true);
 expect(a.pagar).not.toHaveBeenCalled();
});
function montar(admin=true){render(<ProvedorAcesso acesso={{admin,permissoes:{"financeiro.faturas":["visualizar","editar"],"financeiro.movimentacoes":["visualizar","adicionar"]},excecoes:{}}}><FaturaView dados={faturaVisual} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);}
function parcelaInteiraVisual(){return {id:"produto-a",descricao:"NF-e fictícia — Parcela 001",valor:10000,data:"2026-09-01",vencimento:"2026-09-20",cartaoId:null,cartaoNome:null,podeCorrigirCartao:false,fornecedorId:null,versao:"v-a",notaGrupo:"duplicata",componentes:2,lancamentos:[{id:"produto-a",versao:"v-a"},{id:"produto-b",versao:"v-b"}],correspondencia:null};}
it("oferece uma despesa inteira da nota e vincula todos os componentes pela mesma seleção",async()=>{
 a.correspondencias.mockResolvedValueOnce({candidatos:[parcelaInteiraVisual()],estornos:[],sugestao:null} as never);
 montar();await screen.findByText("NF-e fictícia — Parcela 001");
 const painel=screen.getByRole("region",{name:"Lançamentos do HUB"});
 expect(within(painel).getAllByRole("checkbox",{name:/^Vincular /})).toHaveLength(1);
 expect(within(painel).queryByText(/Componente de nota/)).toBeNull();
 expect(within(painel).getByText(/Parcela completa da NF-e/)).toBeTruthy();
 fireEvent.click(within(painel).getByRole("checkbox",{name:"Vincular NF-e fictícia — Parcela 001"}));
 fireEvent.click(within(painel).getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{lancamentos:[{id:"produto-a",versao:"v-a"},{id:"produto-b",versao:"v-b"}]}));
 expect(a.pagar).not.toHaveBeenCalled();
});
it("a busca mantém valor e seleção integrais da parcela",async()=>{
 a.correspondencias.mockResolvedValueOnce({candidatos:[parcelaInteiraVisual()],estornos:[],sugestao:null} as never);
 montar();await screen.findByText("NF-e fictícia — Parcela 001");
 fireEvent.change(screen.getByRole("searchbox",{name:"Buscar lançamento do HUB"}),{target:{value:"Parcela 001"}});
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular NF-e fictícia — Parcela 001"}));
 const painel=screen.getByRole("region",{name:"Lançamentos do HUB"});
 expect(painel.textContent).toContain("100,00");
 fireEvent.click(within(painel).getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{lancamentos:[{id:"produto-a",versao:"v-a"},{id:"produto-b",versao:"v-b"}]}));
});
it("vincula despesa do HUB e envia versão, sem pagar no extrato",async()=>{montar();await screen.findByText("Despesa já lançada");fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa já lançada"}));fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{lancamentos:[{id:"l",versao:"v"}]}));});
it("mostra todas as movimentações no painel principal em ordem cronológica",()=>{montar();const fatura=screen.getByRole("region",{name:"Movimentações da fatura"});expect(within(fatura).getAllByRole("button",{name:/Conferir /}).map(b=>b.getAttribute("aria-label"))).toEqual(["Conferir GOOGLE*GSUITE","Conferir COMPRA DE EMBALAGENS"]);expect(fatura.textContent).toContain("01/09/2026");expect(fatura.textContent).toContain("02/09/2026");expect(screen.queryByRole("button",{name:"Próxima"})).toBeNull();expect(screen.getByRole("region",{name:"Lançamentos do HUB"})).toBeTruthy();});
it("mantém os lançamentos à vista ao trocar de item e permite somar duas despesas",async()=>{
 const candidatos=[{id:"a",descricao:"Despesa A",valor:5000,data:"2026-09-01",vencimento:"2026-09-20",versao:"va",notaGrupo:null,correspondencia:null},{id:"b",descricao:"Despesa B",valor:15000,data:"2026-09-01",vencimento:"2026-09-20",versao:"vb",notaGrupo:null,correspondencia:null}];
 let resolver!:(valor:{candidatos:typeof candidatos;estornos:never[];sugestao:null;sugestoesVinculo:never[]})=>void;
 a.correspondencias.mockResolvedValueOnce({candidatos,estornos:[],sugestao:null,sugestoesVinculo:[]} as never).mockImplementationOnce(()=>new Promise(resolve=>{resolver=resolve as typeof resolver;}));
 montar();await screen.findByText("Despesa A");fireEvent.click(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}));
 expect(screen.getByText("Despesa A")).toBeTruthy();expect(screen.getByText("Despesa B")).toBeTruthy();expect(screen.getByText("Atualizando sugestões deste item…")).toBeTruthy();
 resolver({candidatos,estornos:[],sugestao:null,sugestoesVinculo:[]});await waitFor(()=>expect(screen.queryByText("Atualizando sugestões deste item…")).toBeNull());
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa A"}));fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa B"}));expect(screen.getByText(/Diferença: R\$\s*0,00/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i1",{lancamentos:[{id:"a",versao:"va"},{id:"b",versao:"vb"}]}));
});
it("busca itens sem mover a página para o início",()=>{montar();fireEvent.change(screen.getByRole("textbox",{name:"Buscar item"}),{target:{value:"embalagens"}});fireEvent.click(screen.getByRole("button",{name:"Buscar"}));expect(navegacao.replace).toHaveBeenCalledWith("?busca=embalagens&pagina=1",{scroll:false});});
function correspondenciaVisual(valor=10000,versao="v-atual",descricao="Despesa compatível") {return {candidatos:[{id:"compativel",descricao,valor,data:"2026-09-03",versao,notaGrupo:null,correspondencia:null}],estornos:[],sugestao:null};}
function consultaPendenteVisual(){type Resposta=ReturnType<typeof correspondenciaVisual>|{erro:string};let resolver!:(resposta:Resposta)=>void;const promessa=new Promise<Resposta>(resolve=>{resolver=resolve;});return {promessa,resolver:(resposta:Resposta)=>resolver(resposta)};}
function uiConciliacao(dados:DadosFatura){return <ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>;}
it("marcar item de 25,95 abre esse item e permite conciliá-lo sem usar o detalhe de 2.833,37",async()=>{
 const dados={...faturaVisual,itens:[{...faturaVisual.itens[0],descricao:"Vindi fictícia",valor:283337,valorOriginal:283337},{...faturaVisual.itens[1],descricao:"Mercado fictício",valor:2595,valorOriginal:2595}]} as DadosFatura;
 a.correspondencias.mockResolvedValueOnce(correspondenciaVisual(2595,"v-marcador","NF-e fictícia — Marcador") as never).mockResolvedValueOnce(correspondenciaVisual(2595,"v-marcador","NF-e fictícia — Marcador") as never);
 render(uiConciliacao(dados));await screen.findByText("NF-e fictícia — Marcador");
 fireEvent.change(screen.getByRole("searchbox",{name:"Buscar lançamento do HUB"}),{target:{value:"marcador"}});
 fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar Mercado fictício para classificação"}));
 expect(screen.getByRole("button",{name:"Conferir Mercado fictício"}).getAttribute("aria-pressed")).toBe("true");
 expect(screen.getByRole("button",{name:"Conferir Vindi fictícia"}).getAttribute("aria-pressed")).toBe("false");
 expect(screen.getByText("Linha 3 · Mercado fictício")).toBeTruthy();
 await waitFor(()=>expect(screen.getByRole("checkbox",{name:"Vincular NF-e fictícia — Marcador"}).hasAttribute("data-disabled")).toBe(false));
 expect(screen.getByRole("searchbox",{name:"Buscar lançamento do HUB"})).toHaveProperty("value","marcador");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular NF-e fictícia — Marcador"}));
 expect(screen.getByText(/Diferença: R\$\s*0,00/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i1",{lancamentos:[{id:"compativel",versao:"v-marcador"}]}));
 expect(a.pagar).not.toHaveBeenCalled();
});
it("mantém a seleção em lote ao abrir o último item marcado e não muda o detalhe ao desmarcar outro",async()=>{
 montar();await screen.findByText("Despesa já lançada");
 fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar GOOGLE*GSUITE para classificação"}));
 fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar COMPRA DE EMBALAGENS para classificação"}));
 expect(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}).getAttribute("aria-pressed")).toBe("true");
 expect(screen.getByText("2 selecionados")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Classificar selecionados"}));
 expect(screen.getByRole("heading",{name:"Classificar 2 item(ns)"})).toBeTruthy();
 fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Cancelar"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar GOOGLE*GSUITE para classificação"}));
 expect(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}).getAttribute("aria-pressed")).toBe("true");
 expect(screen.getByText("1 selecionados")).toBeTruthy();
});
it("marcar pelo teclado abre o item sem perder o foco do checkbox",async()=>{
 montar();await screen.findByText("Despesa já lançada");
 const checkbox=screen.getByRole("checkbox",{name:"Selecionar COMPRA DE EMBALAGENS para classificação"});
 checkbox.focus();expect(document.activeElement).toBe(checkbox);
 await userEvent.setup().keyboard("[Space]");
 expect(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}).getAttribute("aria-pressed")).toBe("true");
 await waitFor(()=>expect(screen.queryByText("Atualizando sugestões deste item.")).toBeNull());
 expect(document.activeElement).toBe(checkbox);
 expect(checkbox.getAttribute("aria-checked")).toBe("true");
});
it("descarta a seleção de candidatos quando um filtro retira o item e depois o traz de volta",async()=>{
 a.correspondencias.mockResolvedValueOnce(correspondenciaVisual() as never).mockResolvedValueOnce(correspondenciaVisual(20000) as never).mockResolvedValueOnce(correspondenciaVisual() as never);
 const {rerender}=render(uiConciliacao(faturaVisual));await screen.findByText("Despesa compatível");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 expect(screen.getByRole("button",{name:"Vincular lançamentos selecionados"})).toHaveProperty("disabled",false);
 rerender(uiConciliacao({...faturaVisual,itens:[faturaVisual.itens[1]]}));
 await waitFor(()=>expect(a.correspondencias).toHaveBeenLastCalledWith("ficticia","i1"));
 rerender(uiConciliacao(faturaVisual));
 await waitFor(()=>expect(a.correspondencias).toHaveBeenLastCalledWith("ficticia","i0"));
 await waitFor(()=>expect(screen.queryByText("Atualizando sugestões deste item.")).toBeNull());
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).getAttribute("aria-checked")).toBe("false");
 expect(screen.getByRole("button",{name:"Vincular lançamentos selecionados"})).toHaveProperty("disabled",true);
});
it("uma nova versão exige selecionar de novo e usa só as versões novas dos candidatos",async()=>{
 const pendente=consultaPendenteVisual();
 a.correspondencias.mockResolvedValueOnce(correspondenciaVisual() as never).mockImplementationOnce(()=>pendente.promessa as never);
 const {rerender}=render(uiConciliacao(faturaVisual));await screen.findByText("Despesa compatível");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 rerender(uiConciliacao({...faturaVisual,versao:2}));
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).hasAttribute("data-disabled")).toBe(true);
 expect(screen.getByRole("button",{name:"Vincular lançamentos selecionados"})).toHaveProperty("disabled",true);
 pendente.resolver(correspondenciaVisual(10000,"v-nova"));
 await waitFor(()=>expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).hasAttribute("data-disabled")).toBe(false));
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).getAttribute("aria-checked")).toBe("false");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",2,"i0",{lancamentos:[{id:"compativel",versao:"v-nova"}]}));
});
it("voltar ao item antes da resposta intermediária mantém cache bloqueado mesmo se a nova consulta falhar",async()=>{
 const intermediaria=consultaPendenteVisual(),retorno=consultaPendenteVisual();
 a.correspondencias.mockResolvedValueOnce(correspondenciaVisual() as never).mockImplementationOnce(()=>intermediaria.promessa as never).mockImplementationOnce(()=>retorno.promessa as never);
 montar();await screen.findByText("Despesa compatível");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 fireEvent.click(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}));
 fireEvent.click(screen.getByRole("button",{name:"Conferir GOOGLE*GSUITE"}));
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).hasAttribute("data-disabled")).toBe(true);
 expect(screen.getByRole("button",{name:"Vincular lançamentos selecionados"})).toHaveProperty("disabled",true);
 retorno.resolver({erro:"Consulta atual indisponível"});await screen.findByText("Consulta atual indisponível");
 intermediaria.resolver(correspondenciaVisual(20000,"v-intermediaria","Resposta intermediária"));
 await waitFor(()=>expect(screen.queryByText("Resposta intermediária")).toBeNull());
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).hasAttribute("data-disabled")).toBe(true);
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));
 expect(a.vincular).not.toHaveBeenCalled();expect(a.pagar).not.toHaveBeenCalled();
});
it("ignora resposta atrasada de outro item e mantém a conciliação vinculada ao item aberto",async()=>{
 const anterior=consultaPendenteVisual(),atual=consultaPendenteVisual();
 a.correspondencias.mockImplementationOnce(()=>anterior.promessa as never).mockImplementationOnce(()=>atual.promessa as never);
 montar();fireEvent.click(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}));
 atual.resolver(correspondenciaVisual(20000,"v-nova","Despesa do item aberto"));await screen.findByText("Despesa do item aberto");
 anterior.resolver(correspondenciaVisual(10000,"v-antiga","Resposta do item anterior"));
 await waitFor(()=>expect(screen.queryByText("Resposta do item anterior")).toBeNull());
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa do item aberto"}));
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i1",{lancamentos:[{id:"compativel",versao:"v-nova"}]}));
});
it("atualizar candidatos sem mudar a versão da fatura exige conferir as versões novas",async()=>{
 const pendente=consultaPendenteVisual();
 a.correspondencias.mockResolvedValueOnce(correspondenciaVisual() as never).mockImplementationOnce(()=>pendente.promessa as never);
 const {rerender}=render(uiConciliacao(faturaVisual));await screen.findByText("Despesa compatível");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 rerender(uiConciliacao({...faturaVisual}));
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).hasAttribute("data-disabled")).toBe(true);
 expect(screen.getByRole("button",{name:"Vincular lançamentos selecionados"})).toHaveProperty("disabled",true);
 pendente.resolver(correspondenciaVisual(10000,"v-despesa-editada"));
 await waitFor(()=>expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).hasAttribute("data-disabled")).toBe(false));
 expect(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}).getAttribute("aria-checked")).toBe("false");
 expect(screen.getByRole("button",{name:"Vincular lançamentos selecionados"})).toHaveProperty("disabled",true);
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa compatível"}));
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{lancamentos:[{id:"compativel",versao:"v-despesa-editada"}]}));
});
it("um erro da versão anterior não permanece após a nova consulta bem-sucedida",async()=>{
 a.correspondencias.mockResolvedValueOnce({erro:"Consulta anterior falhou"} as never).mockResolvedValueOnce(correspondenciaVisual() as never);
 const {rerender}=render(uiConciliacao(faturaVisual));await screen.findByText("Consulta anterior falhou");
 rerender(uiConciliacao({...faturaVisual,versao:2}));await screen.findByText("Despesa compatível");
 expect(screen.queryByText("Consulta anterior falhou")).toBeNull();
});
it("classificação oferece fornecedor e não exibe responsável ou centro",()=>{montar();fireEvent.click(screen.getByRole("button",{name:"Classificar despesa"}));expect(screen.queryByRole("combobox",{name:"Responsável"})).toBeNull();expect(screen.queryByRole("combobox",{name:"Centro de custo"})).toBeNull();expect(screen.getByRole("textbox",{name:/Nome do lançamento/})).toHaveProperty("value","GOOGLE*GSUITE");fireEvent.click(screen.getByRole("button",{name:"Cadastrar fornecedor ou beneficiário"}));expect(screen.getByRole("combobox",{name:"Fornecedor ou beneficiário"})).toHaveProperty("value","Fornecedor criado");});
it("não oferece cadastro de fornecedor sem permissão",()=>{montar(false);fireEvent.click(screen.getByRole("button",{name:"Classificar despesa"}));expect(screen.queryByRole("button",{name:"Cadastrar fornecedor ou beneficiário"})).toBeNull();});

it("primeiro passo salva a saída sem finalizar e permite classificar antes da escolha",async()=>{render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={{...faturaVisual,selecionada:null}} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);expect(screen.getByRole("button",{name:"Classificar despesa"})).toHaveProperty("disabled",false);expect(screen.getByRole("button",{name:"Criar despesas e finalizar"})).toHaveProperty("disabled",true);fireEvent.click(screen.getByRole("button",{name:"Selecionar saída"}));fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));await waitFor(()=>expect(a.pagar).toHaveBeenCalledWith("ficticia",1,"b","SELECIONAR"));});
it("finalização só é liberada com todos os itens classificados",async()=>{render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={{...faturaVisual,porClassificar:0}} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);fireEvent.click(screen.getByRole("button",{name:"Criar despesas e finalizar"}));fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));await waitFor(()=>expect(a.pagar).toHaveBeenCalledWith("ficticia",1,"b","FINALIZAR"));});
it("aponta a linha com categoria excluída, bloqueia a baixa e abre sua reclassificação",()=>{
 const dados={...faturaVisual,porClassificar:0,pendenciasCadastro:[{id:"i0",linha:2,descricao:"GOOGLE*GSUITE",motivos:["Categoria financeira excluída ou inativa"]}],itens:faturaVisual.itens.map((i,indice)=>indice===0?{...i,categoriaId:"excluida",categoria:"Categoria excluída",estado:"CLASSIFICADO"}:i)} as typeof faturaVisual;
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 expect(screen.getByRole("button",{name:"Criar despesas e finalizar"})).toHaveProperty("disabled",true);
 expect(screen.getByText(/Linha 2 · GOOGLE\*GSUITE — Categoria financeira excluída ou inativa/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Reclassificar"}));
 expect(screen.getByRole("dialog")).toBeTruthy();
 expect(screen.getByRole("button",{name:"Confirmar classificação"})).toHaveProperty("disabled",true);
});

it("mostra vínculo pendente na linha e antes da finalização, e abre o item para conferência",async()=>{
 const dados={...faturaVisual,porClassificar:0,pendenciasVinculo:[{id:"i1",linha:70,descricao:"COMPRA DE EMBALAGENS",valor:20000,quantidade:1,lancamentos:["Despesa existente"]}]} as DadosFatura;
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 expect(screen.getByRole("button",{name:"Criar despesas e finalizar"})).toHaveProperty("disabled",true);
 expect(screen.getByText(/Linha 70 · COMPRA DE EMBALAGENS · R\$\s*200,00/)).toBeTruthy();
 expect(screen.getByText(/Vínculo pendente: confira 1 lançamento/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Conferir vínculo"}));
 expect(screen.getByRole("button",{name:"Conferir COMPRA DE EMBALAGENS"}).getAttribute("aria-pressed")).toBe("true");
 expect(a.pagar).not.toHaveBeenCalled();
});
it("limpa o filtro para abrir uma linha pendente que está fora da lista",()=>{
 const dados={...faturaVisual,porClassificar:0,pendenciasVinculo:[{id:"i1",linha:70,descricao:"COMPRA DE EMBALAGENS",valor:20000,quantidade:1,lancamentos:["Despesa existente"]}],itens:[faturaVisual.itens[0]]} as DadosFatura;
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{estado:"REVISAR",busca:"google"}}/></ProvedorAcesso>);
 fireEvent.click(screen.getByRole("button",{name:"Conferir vínculo"}));
 expect(navegacao.replace).toHaveBeenCalledWith("?destaque=i1",{scroll:false});
});

it("revisão divide fatura e HUB e permite somar dois lançamentos sugeridos",async()=>{
 a.correspondencias.mockResolvedValueOnce({candidatos:[{id:"a",descricao:"GOOGLE*GSUITE",valor:4000,data:"2025-01-01",vencimento:"2026-09-20",versao:"va",notaGrupo:null,correspondencia:null},{id:"b",descricao:"GOOGLE*GSUITE",valor:6000,data:"2025-01-01",vencimento:"2026-09-20",versao:"vb",notaGrupo:null,correspondencia:null}],sugestoesVinculo:[{ids:["a","b"],valor:10000,motivo:"Soma de despesas com mesmo nome e vencimento"}],estornos:[],sugestao:null} as never);
 montar();expect(screen.getByRole("region",{name:"Movimentações da fatura"})).toBeTruthy();expect(screen.getByRole("region",{name:"Lançamentos do HUB"})).toBeTruthy();
 await screen.findByText("Soma de despesas com mesmo nome e vencimento. 2 lançamentos compõem este item. Confira antes de confirmar.");
 fireEvent.click(screen.getByRole("button",{name:"Selecionar sugestão"}));expect(screen.getByText(/Diferença: R\$\s*0,00/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{lancamentos:[{id:"a",versao:"va"},{id:"b",versao:"vb"}]}));
});

it("troca vínculo de fatura paga somente após seleção e motivo",async()=>{
 const dados={...faturaVisual,selecionada:null,porClassificar:0,pagamentos:[{id:"pag",data:"2026-09-20",valor:30000,autor:"Teste"}],resumo:{...faturaVisual.resumo,pago:30000,pendente:0,pendencias:0,estado:"PAGA"},itens:faturaVisual.itens.map((i,idx)=>({...i,lancamentos:[{id:"antigo"+idx,descricao:"Vínculo anterior "+idx,valor:i.valor,status:"BAIXADO"}]}))} as DadosFatura;
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 await screen.findByText("Despesa já lançada");expect(screen.getByRole("checkbox",{name:"Vincular Despesa já lançada"}).getAttribute("aria-disabled")).toBe("true");
 fireEvent.click(screen.getByRole("button",{name:"Alterar vínculo"}));fireEvent.click(screen.getByRole("checkbox",{name:"Vincular Despesa já lançada"}));
 fireEvent.click(screen.getByRole("button",{name:"Confirmar troca de vínculo"}));expect(a.vincular).not.toHaveBeenCalled();
 const dialog=screen.getByRole("dialog");expect(dialog.textContent).toContain("Vínculo anterior 0");expect(dialog.textContent).toContain("Despesa já lançada");expect(within(dialog).getByRole("button",{name:"Confirmar"})).toHaveProperty("disabled",true);
 fireEvent.change(within(dialog).getByRole("textbox"),{target:{value:"Corrigir vínculo"}});fireEvent.click(within(dialog).getByRole("button",{name:"Confirmar"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{substituir:true,motivo:"Corrigir vínculo",lancamentos:[{id:"l",versao:"v"}]}));expect(a.pagar).not.toHaveBeenCalled();
});

it("seleciona despesa de outro cartão e confirma a correção no próprio vínculo",async()=>{
 const outro={id:"outro",descricao:"NF-e fictícia",valor:10000,data:"2026-09-01",vencimento:"2026-09-15",versao:"vo",cartaoId:"master",cartaoNome:"Mastercard fictício",podeCorrigirCartao:false,requerCorrecaoPagamento:true,notaGrupo:"parcela-nota",correspondencia:null};
 a.correspondencias.mockResolvedValueOnce({candidatos:[],estornos:[],sugestao:null} as never).mockResolvedValueOnce({candidatos:[outro],estornos:[],sugestao:null} as never);
 montar();await waitFor(()=>expect(a.correspondencias).toHaveBeenCalled());
 fireEvent.click(screen.getByRole("checkbox",{name:"Mostrar despesas de outros cartões"}));await screen.findByText("NF-e fictícia");
 expect(a.correspondencias).toHaveBeenLastCalledWith("ficticia","i0",true);
 expect(screen.getByRole("checkbox",{name:"Vincular NF-e fictícia"}).getAttribute("aria-disabled")).not.toBe("true");
 fireEvent.click(screen.getByRole("checkbox",{name:"Vincular NF-e fictícia"}));fireEvent.click(screen.getByRole("button",{name:"Vincular lançamentos selecionados"}));const dialog=screen.getByRole("dialog");
 expect(dialog.textContent).toContain("Mastercard fictício");expect(dialog.textContent).toContain("1234");
 expect(within(dialog).getByRole("button",{name:"Confirmar"})).toHaveProperty("disabled",true);
 fireEvent.change(within(dialog).getByRole("textbox"),{target:{value:"Despesa pertence a este cartão"}});fireEvent.click(within(dialog).getByRole("button",{name:"Confirmar"}));
 await waitFor(()=>expect(a.vincular).toHaveBeenCalledWith("ficticia",1,"i0",{motivo:"Despesa pertence a este cartão",lancamentos:[{id:"outro",versao:"vo"}]}));expect(a.corrigir).not.toHaveBeenCalled();expect(a.pagar).not.toHaveBeenCalled();
});

it("mantém correção de outro cartão bloqueada sem edição de movimentações",async()=>{
 a.correspondencias.mockResolvedValueOnce({candidatos:[{id:"outro",descricao:"Cartão errado",valor:10000,data:"2026-09-01",vencimento:"2026-09-15",versao:"vo",cartaoId:"master",cartaoNome:"Outro cartão",requerCorrecaoPagamento:true}],estornos:[],sugestao:null} as never);
 montar(false);await screen.findByText("Cartão errado");
 expect(screen.getByRole("checkbox",{name:"Vincular Cartão errado"}).getAttribute("aria-disabled")).toBe("true");
 expect(screen.getByText("É necessária permissão para editar movimentações e corrigir o pagamento.")).toBeTruthy();
});

it("conclui itens classificados de fatura paga sem pedir outra saída bancária",async()=>{
 const dados={...faturaVisual,selecionada:null,porClassificar:0,pagamentos:[{id:"pag",data:"2026-09-20",valor:30000,autor:"Teste"}],resumo:{...faturaVisual.resumo,pago:30000,pendente:0},itens:faturaVisual.itens.map(i=>({...i,estado:"CLASSIFICADO",categoriaId:"cat",categoria:"Software e sistemas"}))} as DadosFatura;
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 const concluir=screen.getByRole("button",{name:"Concluir despesas da fatura"});expect(concluir).toHaveProperty("disabled",false);
 fireEvent.click(concluir);const dialog=screen.getByRole("dialog");expect(dialog.textContent).toContain("pagamento já registrado");
 fireEvent.click(within(dialog).getByRole("button",{name:"Confirmar"}));
 await waitFor(()=>expect(a.concluir).toHaveBeenCalledWith("ficticia",1));expect(a.pagar).not.toHaveBeenCalled();
});
it.each(["classificacao","duplicidade","permissao"])("bloqueia conclusão de fatura paga por %s",(motivo)=>{
 const dados={...faturaVisual,selecionada:null,porClassificar:motivo==="classificacao"?1:0,pagamentos:[{id:"pag",data:"2026-09-20",valor:30000,autor:"Teste"}],resumo:{...faturaVisual.resumo,pago:30000,pendente:0},pendenciasVinculo:motivo==="duplicidade"?[{id:"i0",linha:2,descricao:"GOOGLE*GSUITE",valor:10000,quantidade:1,lancamentos:["Despesa existente"]}]:[]} as DadosFatura;
 render(<ProvedorAcesso acesso={{admin:motivo!=="permissao",permissoes:{"financeiro.faturas":["visualizar","editar"],"financeiro.movimentacoes":["visualizar","adicionar"]},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 expect(screen.getByRole("button",{name:"Concluir despesas da fatura"})).toHaveProperty("disabled",true);expect(a.concluir).not.toHaveBeenCalled();
});

it("baixa menor que o saldo exige escolha explícita de pagamento parcial",async()=>{
 const dados={...faturaVisual,porClassificar:0,selecionada:{...faturaVisual.selecionada!,valor:10000}};
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 const parcial=screen.getByRole("button",{name:"Registrar pagamento parcial"});
 expect(parcial).toHaveProperty("disabled",true);expect(a.pagar).not.toHaveBeenCalled();
 expect(screen.getByRole("alert").textContent).toMatch(/200,00/);
 fireEvent.click(screen.getByRole("checkbox",{name:"Este é um pagamento parcial da fatura"}));
 expect(parcial).toHaveProperty("disabled",false);fireEvent.click(parcial);
 const dialog=screen.getByRole("dialog");expect(dialog.textContent).toContain("Pagamento parcial");expect(dialog.textContent).toMatch(/200,00/);
 fireEvent.click(within(dialog).getByRole("button",{name:"Confirmar"}));
 await waitFor(()=>expect(a.pagar).toHaveBeenCalledWith("ficticia",1,"b","FINALIZAR_PARCIAL"));
});
it("confirmação parcial não vale para outra saída ou nova versão",()=>{
 const dados={...faturaVisual,porClassificar:0,selecionada:{...faturaVisual.selecionada!,valor:10000}};
 const ui=(d:DadosFatura)=><ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={d} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>;
 const {rerender}=render(ui(dados));fireEvent.click(screen.getByRole("checkbox",{name:"Este é um pagamento parcial da fatura"}));
 rerender(ui({...dados,versao:2}));expect(screen.getByRole("button",{name:"Registrar pagamento parcial"})).toHaveProperty("disabled",true);
 fireEvent.click(screen.getByRole("checkbox",{name:"Este é um pagamento parcial da fatura"}));
 rerender(ui({...dados,versao:2,selecionada:{...dados.selecionada,id:"outro"}}));expect(screen.getByRole("button",{name:"Registrar pagamento parcial"})).toHaveProperty("disabled",true);
});
it("saldo parcial indica preservação dos títulos e correção pela saída integral",()=>{
 const dados={...faturaVisual,porClassificar:0,selecionada:null,pagamentos:[{id:"pag",data:"2026-09-20",valor:10000,autor:"Teste"}],resumo:{...faturaVisual.resumo,pago:10000,pendente:20000,pendencias:0,estado:"PARCIAL"}};
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 expect(screen.getByText(/desfaça o pagamento incorreto/).textContent).toContain("despesas serão preservadas");
});

it("oferece a saída de valor exato antes das saídas menores",()=>{
 const dados={...faturaVisual,selecionada:null,bancarias:[{id:"menor",data:"2026-08-12",descricao:"PIX FICTÍCIO",valor:10000},faturaVisual.bancarias[0]]};
 render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={dados} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);
 const linhas=within(screen.getAllByRole("table")[1]).getAllByRole("row");expect(linhas[0].textContent).toContain("PAGAMENTO FATURA FICTÍCIA");expect(linhas[1].textContent).toContain("PIX FICTÍCIO");
});
