"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { compensarItensFatura,desfazerCompensacaoFatura,concluirDespesasFatura,corrigirCartaoDespesa,ajustarItem, cancelarFatura, classificarItens, selecionarExtratoFatura, conciliarFatura, consultarCorrespondencias, desconciliarFatura, identificarDadosFatura, importarFatura, prepararImportacao, vincularItem, type ClassificacaoFatura } from "@/lib/financeiro/faturas/servico";
import { salvarRegra, type EntradaRegra } from "@/lib/financeiro/faturas/regras";
import { ErroFatura } from "@/lib/financeiro/faturas/dominio";
import { SenhaPdfNecessaria } from "@/lib/financeiro/faturas/arquivo";

async function executar<T>(nome:string,funcao:()=>Promise<T>) {
  try { const resultado=await funcao();revalidatePath("/financeiro","layout");return resultado; }
  catch(erro){if(!(erro instanceof ErroFatura))console.error("Falha em faturas:",nome,erro instanceof Error?erro.name:"desconhecida");return {erro:erro instanceof ErroFatura?erro.message:"Não foi possível concluir. Atualize e confira o histórico antes de tentar novamente."};}
}
export async function identificarFaturaAction(form:FormData){
  await exigirPermissao("financeiro.faturas","adicionar");
  // Somente leitura: não invalida relatórios nem grava o arquivo antes da confirmação.
  try { return { identificacao: await identificarDadosFatura(form) }; }
  catch(erro){return {erro:erro instanceof ErroFatura?erro.message:"Não foi possível identificar o arquivo. Tente novamente ou preencha os dados manualmente.", senhaNecessaria:erro instanceof SenhaPdfNecessaria};}
}
export async function prepararFaturaAction(form:FormData){
  await exigirPermissao("financeiro.faturas","adicionar");
  return executar("previa",async()=>({previa:await prepararImportacao(form)}));
}
export async function importarFaturaAction(form:FormData){
  const sessao=await exigirPermissao("financeiro.faturas","adicionar");
  return executar("importacao",()=>importarFatura(form,sessao));
}
export async function classificarFaturaAction(id:string,versao:number,d:ClassificacaoFatura){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  return executar("classificacao",()=>classificarItens(id,versao,d,sessao));
}
export async function correspondenciasFaturaAction(id:string,item:string,outrosCartoes=false){
  await exigirPermissao("financeiro.faturas","visualizar");
  await exigirPermissao("financeiro.movimentacoes","visualizar");
  return executar("correspondencias",()=>consultarCorrespondencias(id,item,outrosCartoes));
}
export async function vincularFaturaAction(id:string,versao:number,item:string,entrada:Parameters<typeof vincularItem>[3]){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  await exigirPermissao("financeiro.movimentacoes","visualizar");
  return executar("vinculo",()=>vincularItem(id,versao,item,entrada,sessao));
}
export async function concluirDespesasFaturaAction(id:string,versao:number){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  await exigirPermissao("financeiro.movimentacoes","visualizar");
  await exigirPermissao("financeiro.baixas","editar");
  return executar("conclusao-despesas",()=>concluirDespesasFatura(id,versao,sessao));
}
export async function pagarFaturaAction(id:string,versao:number,transacao:string,modo:"SELECIONAR"|"FINALIZAR"|"FINALIZAR_PARCIAL"="FINALIZAR"){
  const sessao=await exigirPermissao("financeiro.cartoes-pagamentos","editar");
  await exigirPermissao("financeiro.faturas","visualizar");
  return executar("pagamento",()=>{
    if(!["SELECIONAR","FINALIZAR","FINALIZAR_PARCIAL"].includes(modo))throw new ErroFatura("Tipo de pagamento inválido.");
    return modo==="SELECIONAR"?selecionarExtratoFatura(id,versao,transacao,sessao):conciliarFatura(id,versao,transacao,sessao,modo==="FINALIZAR_PARCIAL"?"PARCIAL":"INTEGRAL");
  });
}
export async function desfazerPagamentoFaturaAction(id:string,versao:number,pagamento:string,motivo:string){
  const sessao=await exigirPermissao("financeiro.cartoes-pagamentos","excluir");
  await exigirPermissao("financeiro.faturas","visualizar");
  return executar("desconciliacao",()=>desconciliarFatura(id,versao,pagamento,motivo,sessao));
}
export async function ajustarItemFaturaAction(id:string,versao:number,item:string,operacao:Parameters<typeof ajustarItem>[3],motivo:string,valor:string|null){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  return executar("ajuste",()=>ajustarItem(id,versao,item,operacao,motivo,valor,sessao));
}
export async function cancelarFaturaAction(id:string,versao:number,motivo:string,restaurar:boolean){
  const sessao=await exigirPermissao("financeiro.faturas","excluir");
  return executar("cancelamento",()=>cancelarFatura(id,versao,motivo,restaurar,sessao));
}
export async function salvarRegraFaturaAction(d:EntradaRegra){
  const sessao=await exigirPermissao("financeiro.cartoes-regras",d?.id?"editar":"adicionar");
  return executar("regra",()=>salvarRegra(d,sessao));
}

export async function corrigirCartaoDespesaAction(id:string,versao:number,lancamento:string,versaoLancamento:string,motivo:string){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  await exigirPermissao("financeiro.movimentacoes","editar");
  return executar("correcao-cartao",()=>corrigirCartaoDespesa(id,versao,lancamento,versaoLancamento,motivo,sessao));
}

export async function compensarItensFaturaAction(id:string,versao:number,item:string,outro:string,motivo:string){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  return executar("compensacao",()=>compensarItensFatura(id,versao,item,outro,motivo,sessao));
}
export async function desfazerCompensacaoFaturaAction(id:string,versao:number,item:string,motivo:string){
  const sessao=await exigirPermissao("financeiro.faturas","editar");
  return executar("desfazer-compensacao",()=>desfazerCompensacaoFatura(id,versao,item,motivo,sessao));
}
