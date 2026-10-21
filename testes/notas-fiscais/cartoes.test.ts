import { describe, it, expect } from "vitest";
import { vencimentoCartao } from "@/lib/financeiro/cartoes";
import { normalizarChaveAcesso } from "@/lib/sefaz/chave-acesso";
describe("vencimento das faturas",()=>{
 it.each([
 ["2026-09-09",10,20,1,"2026-09-20"], ["2026-09-10",10,20,1,"2026-10-20"],
 ["2026-09-11",10,20,1,"2026-10-20"], ["2026-09-09",25,5,1,"2026-10-05"],
 ["2026-12-26",25,5,1,"2027-02-05"], ["2026-01-30",31,31,1,"2026-02-28"],
 ["2028-01-30",31,31,1,"2028-02-29"], ["2026-09-09",10,20,3,"2026-11-20"],
 ] as const)("%s, fecha %i, vence %i, parcela %i",(data,f,v,p,esperado)=>expect(vencimentoCartao(data,f,v,p)).toBe(esperado));
 it("recusa datas inexistentes e configurações inválidas",()=>{expect(()=>vencimentoCartao("2026-02-30",10,20)).toThrow();expect(()=>vencimentoCartao("2026-02-20",0,20)).toThrow();expect(()=>vencimentoCartao("2026-02-20",10,20,0)).toThrow();});
});
it("valida o dígito verificador da chave e o modelo 55",()=>{
 const base="35260912345678000199550010000000011000000000".slice(0,43);
 let soma=0,peso=2;for(let i=42;i>=0;i--){soma+=Number(base[i])*peso;peso=peso===9?2:peso+1;}
 const resto=soma%11;const chave=base+(resto<2?0:11-resto);
 expect(normalizarChaveAcesso(chave)).toBe(chave);expect(normalizarChaveAcesso(chave.slice(0,-1)+((Number(chave[43])+1)%10))).toBeNull();expect(normalizarChaveAcesso("abc")).toBeNull();
});

it.each(["0206-10-10", "1900-01-01", "1999-12-31"])("não gera vencimento de compra anterior a 2000: %s", data => {
  expect(() => vencimentoCartao(data, 10, 20)).toThrow();
});
it("aceita compra no primeiro dia de 2000", () => expect(vencimentoCartao("2000-01-01", 10, 20)).toBe("2000-01-20"));
