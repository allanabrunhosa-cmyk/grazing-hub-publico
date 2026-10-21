import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { auditarFatura, autorFatura } from "./acesso";
import { dinheiro, decimal, ErroFatura, normalizarTexto } from "./dominio";
export type EntradaRegra = { id?:string; versao?:number; nome:string; texto:string; modo:"EXATO"|"CONTEM"; prioridade:number; cartaoId:string|null; categoriaId:string; fornecedorId:string|null; centroCustoId:string|null; tipo:string|null; minimo:string; maximo:string; ativa:boolean };
export async function salvarRegra(d:EntradaRegra,sessao:SessaoAtual) {
  if(!d||typeof d.nome!=="string"||!d.nome.trim()||d.nome.length>120||typeof d.texto!=="string"||d.texto.trim().length<3||d.texto.length>250||!["EXATO","CONTEM"].includes(d.modo)||!Number.isInteger(d.prioridade)||Math.abs(d.prioridade)>1000||typeof d.ativa!=="boolean")throw new ErroFatura("Informe nome, texto (3 a 250 caracteres), modo e prioridade válidos.");
  const minimo=d.minimo?dinheiro(d.minimo):null,maximo=d.maximo?dinheiro(d.maximo):null;
  if(minimo!==null&&maximo!==null&&minimo>maximo)throw new ErroFatura("Valor mínimo maior que máximo.");
  if(d.tipo&&!['COMPRA','ESTORNO','CREDITO','JUROS','IOF','MULTA','TARIFA'].includes(d.tipo))throw new ErroFatura("Tipo inválido.");
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.cartoes-regras",d.id?"editar":"adicionar");
    const atual=d.id?await tx.regraCartao.findUnique({where:{id:d.id}}):null;
    if(d.id&&(!atual||atual.versao!==d.versao))throw new ErroFatura("A regra mudou. Atualize a tela.");
    const categoria=await tx.categoriaFinanceira.findFirst({where:{id:d.categoriaId,ativo:true,excluidoEm:null}});
    if(!categoria||GRUPOS_RECEITA.includes(categoria.grupo))throw new ErroFatura("Selecione categoria de despesa ativa.");
    if(d.cartaoId&&!await tx.cartaoCredito.findUnique({where:{id:d.cartaoId}}))throw new ErroFatura("Cartão inexistente.");
    if(d.fornecedorId&&!await tx.fornecedor.findFirst({where:{id:d.fornecedorId,ativo:true}}))throw new ErroFatura("Fornecedor inexistente ou inativo.");
    if(d.centroCustoId&&!await tx.centroCusto.findUnique({where:{id:d.centroCustoId}}))throw new ErroFatura("Centro de custo inexistente.");
    const dados={nome:d.nome.trim(),texto:normalizarTexto(d.texto),modo:d.modo,prioridade:d.prioridade,cartaoId:d.cartaoId||null,categoriaId:d.categoriaId,fornecedorId:d.fornecedorId||null,centroCustoId:d.centroCustoId||null,tipo:d.tipo||null,valorMinimo:minimo===null?null:decimal(minimo),valorMaximo:maximo===null?null:decimal(maximo),ativa:d.ativa,origem:"EXPLICITA"};
    const regra=atual?await tx.regraCartao.update({where:{id:atual.id},data:{...dados,versao:{increment:1}}}):await tx.regraCartao.create({data:dados});
    await auditarFatura(tx,autor,atual?"REGRA_ALTERADA":"REGRA_CRIADA",regra.id,null,atual,dados);return {ok:true as const,id:regra.id,versao:regra.versao};
  });
}
