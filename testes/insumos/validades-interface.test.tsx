// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {ProvedorAcesso} from "@/components/layout/acesso-contexto";
import {ValidadesInsumo} from "@/app/(protegido)/insumos/validades-insumo";
import {insumoStatus} from "../cadastros/dados";
const mocks=vi.hoisted(()=>({salvar:vi.fn(),refresh:vi.fn()}));
vi.mock("@/app/(protegido)/producao/etiquetas/actions",()=>({salvarConfiguracaoProdutoEtiquetaAction:mocks.salvar}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
beforeEach(()=>{vi.clearAllMocks();mocks.salvar.mockResolvedValue({ok:true,versao:2});});
afterEach(cleanup);
function abrir(editar=true,somenteLeitura=false,tipo="INSUMO" as "INSUMO"|"PRODUTO_INTERMEDIARIO"){
 return render(<ProvedorAcesso acesso={{admin:false,permissoes:{insumos:["visualizar"],"producao.validades":editar?["visualizar","editar"]:["visualizar"]},excecoes:{}}}>
  <ValidadesInsumo somenteLeitura={somenteLeitura} insumo={{...insumoStatus,tipo,etiquetaHabilitada:true,validadeSecoDias:1,validadeRefrigeradoDias:3,validadeCongeladoDias:30}}/>
 </ProvedorAcesso>);
}
it.each(["INSUMO","PRODUTO_INTERMEDIARIO"] as const)("permite editar apenas validades de %s com o perfil funcional, sem edição de insumos",async(tipo)=>{
 const tela=abrir(true,false,tipo);fireEvent.change(screen.getByLabelText(/Refrigerado/),{target:{value:"5"}});fireEvent.click(screen.getByRole("button",{name:"Salvar validades"}));await screen.findByRole("status");
 expect(mocks.salvar).toHaveBeenCalledOnce();expect(mocks.salvar).toHaveBeenCalledWith({insumoId:insumoStatus.id,etiquetaHabilitada:true,validadeSecoDias:"1",validadeRefrigeradoDias:"5",validadeCongeladoDias:"30"});expect(mocks.refresh).toHaveBeenCalledOnce();expect(tela.container.querySelector('[name="nome"]')).toBeNull();
});
it.each([[false,false],[true,true]])("não permite salvar sem acesso ou em uma consulta somente leitura (%s,%s)",(editar,somenteLeitura)=>{abrir(editar,somenteLeitura);expect(screen.queryByRole("button",{name:"Salvar validades"})).toBeNull();expect(screen.getByLabelText(/Refrigerado/)).toHaveProperty("disabled",true);fireEvent.submit(screen.getByRole("form"));expect(mocks.salvar).not.toHaveBeenCalled();});
it("não anuncia sucesso antes da confirmação e impede envio duplicado",async()=>{let resolver:(r:unknown)=>void=()=>{};mocks.salvar.mockImplementation(()=>new Promise(r=>resolver=r));abrir();const formulario=screen.getByRole("form");fireEvent.submit(formulario);fireEvent.submit(formulario);expect(mocks.salvar).toHaveBeenCalledOnce();expect(screen.queryByRole("status")).toBeNull();expect(screen.getByRole("button",{name:"Salvando…"})).toHaveProperty("disabled",true);resolver({erro:"Seu acesso foi revogado."});await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("revogado"));expect(mocks.refresh).not.toHaveBeenCalled();});
it("limita os dias a quatro dígitos e recusa letras durante a entrada",()=>{abrir();const campo=screen.getByLabelText(/Refrigerado/);fireEvent.change(campo,{target:{value:"12abc345"}});expect(campo).toHaveProperty("value","3");fireEvent.change(campo,{target:{value:"1234"}});expect(campo).toHaveProperty("value","1234");fireEvent.change(campo,{target:{value:"12345"}});expect(campo).toHaveProperty("value","1234");fireEvent.change(campo,{target:{value:"-1"}});expect(campo).toHaveProperty("value","1234");});
