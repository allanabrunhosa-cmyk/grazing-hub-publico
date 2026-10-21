import { describe, expect, it } from "vitest";
import { itensCompensados, parCompensavel, type ItemCompensavel } from "@/lib/financeiro/faturas/compensacao";
const despesa:ItemCompensavel={id:"d",data:"2026-09-05",valor:1875,ignorado:false,lancamentos:[]};
const credito:ItemCompensavel={...despesa,id:"c",valor:-1875};
describe("compensação de itens no mesmo dia",()=>{
  it("aceita somente valor líquido zero, sem alterar o saldo do dia",()=>{
    expect(parCompensavel(despesa,credito)).toBe(true);
    expect(parCompensavel(credito,despesa)).toBe(true);
    expect(12345+despesa.valor+credito.valor).toBe(12345);
  });
  it.each([
    {data:"2026-09-06"},{valor:-1874},{valor:1875},{valor:0},{valor:-1875.5},
    {id:"d"},{ignorado:true},{compensadoComId:"outro"},{lancamentos:[{id:"l"}]},
  ])("recusa par inelegível %j",alteracao=>expect(parCompensavel(despesa,{...credito,...alteracao})).toBe(false));
  it("reconhece ambos os lados e dispensa somente o par íntegro",()=>{
    expect([...itensCompensados([{...despesa,compensadoComId:"c"},{...credito,compensadoComId:"d"},{...despesa,id:"terceiro"}])]).toEqual(["d","c"]);
  });
  it.each([
    [{...despesa,compensadoComId:"c"},credito],
    [{...despesa,compensadoComId:"c"},{...credito,data:"2026-09-06",compensadoComId:"d"}],
    [{...despesa,compensadoComId:"c"},{...credito,valor:-1874,compensadoComId:"d"}],
    [{...despesa,compensadoComId:"ausente"}],
  ])("bloqueia finalização com compensação quebrada %#",(...itens)=>expect(()=>itensCompensados(itens)).toThrow("Compensação inválida"));
});
