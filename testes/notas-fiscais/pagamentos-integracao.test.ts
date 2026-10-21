import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
const estado=vi.hoisted(()=>({banco:null as unknown as PrismaClient}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/prisma",()=>({get prisma(){return estado.banco;}}));
vi.mock("@/lib/session",()=>({getSession:async()=>({userId:"teste"})}));
vi.mock("@/lib/permissoes/servidor",()=>({exigirPermissao:vi.fn(async()=>({userId:"teste",nome:"Teste"}))}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { confirmarConciliacaoNotaAction as conciliar, obterItensNotaFiscalAction as obter } from "@/app/(protegido)/notas-fiscais/actions";
import { salvarCartaoAction } from "@/app/(protegido)/financeiro/bancario/cartoes-actions";
import { calcularPosicaoHistorica, chavePosicao } from "@/lib/estoque/posicao";
const esquema="teste_pagamentos_nota_"+Date.now();let conexao:Client;
let insumoId:string,localId:string,cartaoId:string,contaId:string,numero=0;
async function nota() {
 const n=await estado.banco.notaFiscalRecebida.create({data:{chaveAcesso:String(++numero).padStart(44,"0"),nsu:"",tipo:"PROC_NFE",ultimaManifestacao:"CONFIRMACAO_DA_OPERACAO",fornecedorCnpj:"12345678000199",dataEmissao:new Date("2026-09-09T12:00:00Z"),xml:'<nfeProc><NFe><infNFe><det nItem="1"><prod><vProd>90</vProd></prod></det><total><ICMSTot><vProd>90</vProd><vNF>90</vNF></ICMSTot></total></infNFe></NFe></nfeProc>'}});
 const item=await estado.banco.notaFiscalItem.create({data:{notaFiscalId:n.id,numeroItem:1,codigoProdutoFornecedor:"CAIXA",descricaoProduto:"Caixa de teste",unidadeComercial:"CX",quantidadeComercial:3,valorTotalItem:90,insumoId}});
 const d=await estado.banco.notaFiscalDuplicata.create({data:{notaFiscalId:n.id,numero:"001",valor:90,dataVencimento:new Date("2026-10-20T12:00:00Z")}});
 return {notaFiscalId:n.id,localId,dataEntradaEstoque:"2026-09-10",itens:[{notaFiscalItemId:item.id,acao:"CONCILIAR" as const,destino:"ESTOQUE" as const,insumoId,quantidade:7.5,fatorConversao:2.5,valorTotal:90,modoCusto:"MEDIA" as const}],duplicatas:[{id:d.id,numero:"001",valor:90,dataVencimento:"2026-10-20",formaPagamento:"CARTAO" as const,cartaoCreditoId:cartaoId,dataCompra:"2026-09-10",parcelaCartao:1}]};
}
describe.skipIf(process.env.NOTAS_PAGAMENTOS_BANCO_TESTE!=="1")("pagamentos e memória no PostgreSQL isolado",()=>{
 beforeAll(async()=>{
  if(!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))throw new Error("Somente PostgreSQL local.");
  conexao=new Client({connectionString:process.env.DATABASE_URL});await conexao.connect();
  await conexao.query('CREATE SCHEMA "'+esquema+'"');await conexao.query('SET search_path TO "'+esquema+'"');
  for(const pasta of (await readdir("prisma/migrations")).sort()) if(/^\d/.test(pasta)) await conexao.query(prepararSqlMigrationFiscal(pasta, await readFile("prisma/migrations/"+pasta+"/migration.sql","utf8")));
  estado.banco=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,options:"-c search_path="+esquema},{schema:esquema})});
  await estado.banco.usuario.create({data:{id:"teste",nome:"Teste",email:"teste@example.invalid",senhaHash:"nao-utilizada"}});
  insumoId=(await estado.banco.insumo.create({data:{nome:"Teste",unidade:"KG"}})).id;
  localId=(await estado.banco.localEstoque.create({data:{nome:"Teste"}})).id;
  await estado.banco.categoriaFinanceira.create({data:{nome:"CMV",grupo:"CMV"}});
  contaId=(await estado.banco.contaBancaria.create({data:{nome:"Banco teste"}})).id;
  const form=new FormData();for(const [k,v] of Object.entries({nome:"Cartão teste",contaBancariaId:contaId,diaFechamento:"10",diaVencimento:"20"}))form.set(k,v);
  expect(await salvarCartaoAction(null,form)).toEqual({ok:true});
  cartaoId=(await estado.banco.cartaoCredito.findFirstOrThrow()).id;
 },60000);
 afterAll(async()=>{await estado.banco?.$disconnect();if(conexao){await conexao.query('DROP SCHEMA IF EXISTS "'+esquema+'" CASCADE');await conexao.end();}});
 it("grava fatura, conta, forma, memória e mantém despesa pendente sem baixa",async()=>{
  const entrada=await nota();expect(await conciliar(entrada)).toEqual({ok:true,movimentacoesCriadas:1});
  const l=await estado.banco.lancamentoFinanceiro.findFirstOrThrow({include:{formaPagamento:true}});
  expect(l).toMatchObject({contaBancariaId:contaId,cartaoCreditoId:cartaoId,status:"PENDENTE",formaPagamento:{nome:"Cartão de crédito"}});
  expect(l.dataVencimento.toISOString().slice(0,10)).toBe("2026-10-20");expect(await estado.banco.movimentacaoBancaria.count()).toBe(0);
  const memoria=await estado.banco.insumoCodigoFornecedor.findFirstOrThrow();expect(Number(memoria.fatorConversao)).toBe(2.5);expect(memoria).toMatchObject({unidadeComercial:"CX",unidadeEstoque:"KG"});
  expect(Number((await estado.banco.saldoEstoque.findFirstOrThrow()).quantidadeAtual)).toBe(7.5);
  const movimento = await estado.banco.movimentacaoEstoque.findFirstOrThrow();
  expect(movimento.createdAt.toISOString()).toBe("2026-09-10T15:00:00.000Z");
  expect(l.dataCompetencia.toISOString().slice(0,10)).toBe("2026-09-09");
  const antesDaEntrada = await calcularPosicaoHistorica(new Date("2026-09-10T02:59:59Z"));
  const depoisDaEntrada = await calcularPosicaoHistorica(new Date("2026-09-11T02:59:59Z"));
  expect(antesDaEntrada.get(chavePosicao(insumoId,localId)) ?? 0).toBe(0);
  expect(depoisDaEntrada.get(chavePosicao(insumoId,localId))).toBe(7.5);
  const detalhe = await obter(entrada.notaFiscalId);
  expect(detalhe).toHaveProperty("itens.0.dataEntradaEstoque", "2026-09-10");
  expect(await conciliar(entrada)).toEqual({ok:true,movimentacoesCriadas:0});expect(await estado.banco.lancamentoFinanceiro.count()).toBe(1);
  expect(await conciliar({...entrada,duplicatas:[{...entrada.duplicatas[0],formaPagamento:"PIX"}]})).toHaveProperty("erro");
 });
 it("reaplica o fator só quando fornecedor, código e unidades correspondem",async()=>{
  const n=await nota();let r=await obter(n.notaFiscalId);expect(r).not.toHaveProperty("erro");if("itens" in r)expect(r.itens[0].fatorConversao).toBe(2.5);
  await estado.banco.notaFiscalItem.update({where:{id:n.itens[0].notaFiscalItemId},data:{unidadeComercial:"UN"}});
  r=await obter(n.notaFiscalId);if("itens" in r)expect(r.itens[0].fatorConversao).toBeNull();
 });
 it("rejeita cartão inativo e vencimento desatualizado sem mudar estoque ou financeiro",async()=>{
  const n=await nota();const antes=await estado.banco.movimentacaoEstoque.count();
  expect(await conciliar({...n,duplicatas:[{...n.duplicatas[0],dataVencimento:"2026-09-20"}]})).toHaveProperty("erro");
  await estado.banco.cartaoCredito.update({where:{id:cartaoId},data:{ativo:false}});
  expect(await conciliar(n)).toHaveProperty("erro");expect(await estado.banco.movimentacaoEstoque.count()).toBe(antes);
  await estado.banco.cartaoCredito.update({where:{id:cartaoId},data:{ativo:true}});
 });
 it("preserva boleto padrão e provisiona Pix sem marcar como pago",async()=>{
  for(const formaPagamento of [undefined,"PIX"] as const){const n=await nota();const d={id:n.duplicatas[0].id,numero:"001",valor:90,dataVencimento:"2026-09-15",formaPagamento};expect(await conciliar({...n,duplicatas:[d]})).toHaveProperty("ok");
  const l=await estado.banco.lancamentoFinanceiro.findFirstOrThrow({where:{notaFiscalItemLancamento:{is:{notaFiscalDuplicataId:d.id}}},include:{formaPagamento:true}});
  expect(l).toMatchObject({status:"PENDENTE",cartaoCreditoId:null,contaBancariaId:null,formaPagamento:{nome:formaPagamento ? "Pix":"Boleto"}});}
 });
 it("recusa vencimento anterior a 2000 antes de gerar estoque ou despesa",async()=>{
  const n=await nota();const estoque=await estado.banco.movimentacaoEstoque.count();const financeiro=await estado.banco.lancamentoFinanceiro.count();
  expect(await conciliar({...n,duplicatas:[{...n.duplicatas[0],formaPagamento:"PIX",dataVencimento:"1999-12-31"}]})).toHaveProperty("erro");
  expect(await estado.banco.movimentacaoEstoque.count()).toBe(estoque);
  expect(await estado.banco.lancamentoFinanceiro.count()).toBe(financeiro);
 });

});
