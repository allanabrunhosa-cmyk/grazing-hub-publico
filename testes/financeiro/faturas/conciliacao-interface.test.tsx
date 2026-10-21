// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
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
function montar(admin=true){render(<ProvedorAcesso acesso={{admin,permissoes:{"financeiro.faturas":["visualizar","editar"],"financeiro.movimentacoes":["visualizar","adicionar"]},excecoes:{}}}><FaturaView dados={faturaVisual} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);}
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
it("classificação oferece fornecedor e não exibe responsável ou centro",()=>{montar();fireEvent.click(screen.getByRole("button",{name:"Classificar despesa"}));expect(screen.queryByRole("combobox",{name:"Responsável"})).toBeNull();expect(screen.queryByRole("combobox",{name:"Centro de custo"})).toBeNull();expect(screen.getByRole("textbox",{name:/Nome do lançamento/})).toHaveProperty("value","GOOGLE*GSUITE");fireEvent.click(screen.getByRole("button",{name:"Cadastrar fornecedor ou beneficiário"}));expect(screen.getByRole("combobox",{name:"Fornecedor ou beneficiário"})).toHaveProperty("value","Fornecedor criado");});
it("não oferece cadastro de fornecedor sem permissão",()=>{montar(false);fireEvent.click(screen.getByRole("button",{name:"Classificar despesa"}));expect(screen.queryByRole("button",{name:"Cadastrar fornecedor ou beneficiário"})).toBeNull();});

it("primeiro passo salva a saída sem finalizar e bloqueia classificação antes da escolha",async()=>{render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><FaturaView dados={{...faturaVisual,selecionada:null}} cadastros={cadastros} filtros={{}}/></ProvedorAcesso>);expect(screen.getByRole("button",{name:"Classificar despesa"})).toHaveProperty("disabled",true);expect(screen.getByRole("button",{name:"Criar despesas e finalizar"})).toHaveProperty("disabled",true);fireEvent.click(screen.getByRole("button",{name:"Selecionar saída"}));fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));await waitFor(()=>expect(a.pagar).toHaveBeenCalledWith("ficticia",1,"b","SELECIONAR"));});
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

it("busca despesas de outro cartão e exige correção explícita antes de vincular",async()=>{
 const outro={id:"outro",descricao:"NFS-e fictícia",valor:10000,data:"2026-09-01",vencimento:"2026-09-15",versao:"vo",cartaoId:"master",cartaoNome:"Mastercard fictício",podeCorrigirCartao:true,notaGrupo:null,correspondencia:null};
 a.correspondencias.mockResolvedValueOnce({candidatos:[],estornos:[],sugestao:null} as never).mockResolvedValueOnce({candidatos:[outro],estornos:[],sugestao:null} as never);
 montar();await waitFor(()=>expect(a.correspondencias).toHaveBeenCalled());
 fireEvent.click(screen.getByRole("checkbox",{name:"Mostrar despesas de outros cartões"}));await screen.findByText("NFS-e fictícia");
 expect(a.correspondencias).toHaveBeenLastCalledWith("ficticia","i0",true);
 expect(screen.getByRole("checkbox",{name:"Vincular NFS-e fictícia"}).getAttribute("aria-disabled")).toBe("true");
 fireEvent.click(screen.getByRole("button",{name:"Usar cartão desta fatura"}));const dialog=screen.getByRole("dialog");
 expect(dialog.textContent).toContain("Mastercard fictício");expect(dialog.textContent).toContain("1234");
 expect(within(dialog).getByRole("button",{name:"Confirmar"})).toHaveProperty("disabled",true);
 fireEvent.change(within(dialog).getByRole("textbox"),{target:{value:"Despesa pertence a este cartão"}});fireEvent.click(within(dialog).getByRole("button",{name:"Confirmar"}));
 await waitFor(()=>expect(a.corrigir).toHaveBeenCalledWith("ficticia",1,"outro","vo","Despesa pertence a este cartão"));expect(a.vincular).not.toHaveBeenCalled();expect(a.pagar).not.toHaveBeenCalled();
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
