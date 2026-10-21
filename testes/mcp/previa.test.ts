import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/mcp/servidor",()=>({hashCredencial:(s:string)=>s}));
vi.mock("@/lib/ifood/tokens",()=>({decifrarIfood:(s:string)=>s}));
import { transacaoDePrevia } from "@/lib/mcp/previa";

async function fotografar(opcoes: { novoId?:string; valor?:string; antigoId?:string; vencimento?:string; instante?:string } = {}) {
  const { novoId="novo-1", valor="12.34", antigoId="antigo-1", vencimento="2026-10-20", instante="2026-10-08T10:00:00Z" }=opcoes;
  const banco = { lancamentoFinanceiro:{create:async (a:{data:unknown})=>({...(a.data as object),id:novoId}),update:async (a:{where:{id:string};data:unknown})=>({id:a.where.id,...(a.data as object)})} } as unknown as Prisma.TransactionClient;
  const p=transacaoDePrevia(banco,true);
  await p.tx.lancamentoFinanceiro.create({data:{descricao:"Fictício",tipo:"DESPESA",valor,categoriaId:"categoria",dataVencimento:new Date(vencimento),dataCompetencia:new Date(vencimento),createdAt:new Date(instante)}});
  await p.tx.lancamentoFinanceiro.update({where:{id:antigoId},data:{observacoes:`Referência criada ${novoId}`,updatedAt:new Date(instante)}});
  return p.resumo();
}
describe("Assinatura da prévia humana",()=>{
  it("aceita apenas a variação de IDs novos e relógios técnicos da mesma operação",async()=>{
    expect((await fotografar()).assinatura).toBe((await fotografar({novoId:"novo-2",instante:"2026-10-08T10:01:00Z"})).assinatura);
  });
  it.each([{valor:"12.35"},{antigoId:"antigo-2"},{vencimento:"2026-10-21"}])("conserva alteração de negócio ou identidade existente %j",async alternativa=>{
    expect((await fotografar()).assinatura).not.toBe((await fotografar(alternativa)).assinatura);
  });
  it("normaliza somente datas automáticas de crédito, preservando concessão e vencimentos comuns", async () => {
    const assinatura = async (tipo: string, instante: string, titulo = false) => {
      const banco = { creditoClienteMovimento: { create: async (a: {data: object}) => ({...a.data, id: "novo"}) }, lancamentoFinanceiro: { create: async (a: {data: object}) => ({...a.data, id: "novo"}) } } as unknown as Prisma.TransactionClient;
      const p = transacaoDePrevia(banco, true);
      if (titulo) await p.tx.lancamentoFinanceiro.create({data:{ tipo:"RECEITA",valor:"10",descricao:"Fictício",categoriaId:"categoria",pedidoQuitadoCredito:tipo==="APLICACAO",dataCompetencia:new Date("2026-10-01"),dataVencimento:new Date(instante),dataPagamento:new Date(instante)}});
      else await p.tx.creditoClienteMovimento.create({data:{tipo,clienteId:"existente",valor:"10",data:new Date(instante),chaveOperacao:"ficticia",hashOperacao:"ficticio",criadoPorId:"existente"}} as never);
      return p.resumo().assinatura;
    };
    for (const tipo of ["AJUSTE_DEBITO", "AJUSTE_CREDITO", "LIBERACAO", "APLICACAO"]) expect(await assinatura(tipo,"2026-10-08T10:00:00Z")).toBe(await assinatura(tipo,"2026-10-08T10:01:00Z"));
    expect(await assinatura("CONCESSAO","2026-10-08T12:00:00Z")).not.toBe(await assinatura("CONCESSAO","2026-10-09T12:00:00Z"));
    expect(await assinatura("APLICACAO","2026-10-08T10:00:00Z",true)).toBe(await assinatura("APLICACAO","2026-10-08T10:01:00Z",true));
    expect(await assinatura("NORMAL","2026-10-08T12:00:00Z",true)).not.toBe(await assinatura("NORMAL","2026-10-09T12:00:00Z",true));
  });
  it("vincula versões anteriores e identifica somente versão produzida e lote de importação novo", async () => {
    const assinatura = async (instante: string, anterior = "2026-10-01T12:00:00Z") => {
      const banco = { faturaCartao: { update: async () => ({id:"existente", updatedAt:new Date(instante)}) }, historicoCadastroVenda: { create: async (a:{data:object})=>({...a.data,id:crypto.randomUUID()}) } } as unknown as Prisma.TransactionClient;
      const p=transacaoDePrevia(banco);
      const salvo=await p.tx.faturaCartao.update({where:{id:"existente"},data:{}});
      await p.tx.historicoCadastroVenda.create({data:{entidade:"IMPORTACAO",registroId:crypto.randomUUID(),usuarioId:"existente",usuarioNome:"Fictício",antes:{versao:anterior},depois:{versao:salvo.updatedAt.toISOString()},createdAt:new Date(instante)}});
      return p.resumo().assinatura;
    };
    expect(await assinatura("2026-10-08T10:00:00Z")).toBe(await assinatura("2026-10-08T10:01:00Z"));
    expect(await assinatura("2026-10-08T10:00:00Z")).not.toBe(await assinatura("2026-10-08T10:01:00Z","2026-10-02T12:00:00Z"));
  });
  it("identifica lotes novos sem atribuir IDs a vínculos de chave natural",async()=>{
    const capturados:unknown[]=[];
    const banco={itemPedidoVenda:{createMany:async(a:unknown)=>{capturados.push(a);return {count:1};}},vinculoExtrato:{createMany:async(a:unknown)=>{capturados.push(a);return {count:1};}}} as unknown as Prisma.TransactionClient;
    const a=transacaoDePrevia(banco), b=transacaoDePrevia(banco);
    const lote={data:[{pedidoId:"existente",quantidade:"1"}]};
    await a.tx.itemPedidoVenda.createMany(lote as never);await b.tx.itemPedidoVenda.createMany(lote as never);
    expect(a.resumo().assinatura).toBe(b.resumo().assinatura);
    expect(capturados[0]).toMatchObject({data:[{id:expect.any(String)}]});
    await a.tx.vinculoExtrato.createMany({data:[{lancamentoId:"existente"}]} as never);
    expect(capturados[2]).toEqual({data:[{lancamentoId:"existente"}]});
  });
});
