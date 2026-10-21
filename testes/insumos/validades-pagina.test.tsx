import {expect,it,vi} from "vitest";
import {isValidElement,type ReactNode} from "react";
vi.mock("server-only",()=>({}));
const sim=vi.hoisted(()=>({sessao:vi.fn()}));
vi.mock("@/lib/permissoes/servidor",()=>({exigirPermissao:sim.sessao}));
vi.mock("@/lib/prisma",()=>({prisma:Object.fromEntries(["insumo","categoria","centroCusto","fornecedor","categoriaFinanceira"].map(k=>[k,{findMany:vi.fn(async()=>[])}]))}));
vi.mock("@/app/(protegido)/insumos/insumo-dialog",()=>({InsumoDialog:()=>null}));
vi.mock("@/app/(protegido)/insumos/insumos-table",()=>({InsumosTable:()=>null}));
vi.mock("@/app/(protegido)/insumos/categorias-dialog",()=>({CategoriasDialog:()=>null}));
vi.mock("@/app/(protegido)/insumos/import-insumos-dialog",()=>({ImportInsumosDialog:()=>null}));
vi.mock("@/app/(protegido)/insumos/export-insumos-button",()=>({ExportInsumosButton:()=>null}));
import InsumosPage from "@/app/(protegido)/insumos/page";
function campos(no:ReactNode):boolean[]{
 if(Array.isArray(no))return no.flatMap(campos);
 if(!isValidElement<{podeConfigurarEtiqueta?:boolean;children?:ReactNode}>(no))return [];
 return [...(typeof no.props.podeConfigurarEtiqueta==="boolean"?[no.props.podeConfigurarEtiqueta]:[]),...campos(no.props.children)];
}
it.each([true,false])("usa a permissão funcional de validades nos dois cadastros, sem exigir administrador (%s)",async(editar)=>{
 sim.sessao.mockResolvedValue({admin:false,permissoes:{insumos:["visualizar","editar"],"producao.validades":editar?["visualizar","editar"]:["visualizar"]},excecoes:{}});
 expect(campos(await InsumosPage({}))).toEqual([editar,editar]);expect(sim.sessao).toHaveBeenCalledWith("insumos");
});
it("respeita a exceção que revoga a edição de validades",async()=>{
 sim.sessao.mockResolvedValue({admin:false,permissoes:{insumos:["visualizar","editar"],"producao.validades":["visualizar","editar"]},excecoes:{"producao.validades":{editar:false}}});expect(campos(await InsumosPage({}))).toEqual([false,false]);
});
