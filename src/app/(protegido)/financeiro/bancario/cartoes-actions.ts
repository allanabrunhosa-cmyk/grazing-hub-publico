"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { dinheiro,decimal } from "@/lib/financeiro/faturas/dominio";
export async function salvarCartaoAction(id: string | null, formulario: FormData): Promise<{ok:true}|{erro:string}> {
  const sessao = await exigirPermissao("financeiro.bancario", id ? "editar" : "adicionar");
  const nome = String(formulario.get("nome") ?? "").trim();
  const contaBancariaId = String(formulario.get("contaBancariaId") ?? "");
  const diaFechamento = Number(formulario.get("diaFechamento"));
  const diaVencimento = Number(formulario.get("diaVencimento"));
  if (!nome || nome.length > 120 || !contaBancariaId || ![diaFechamento,diaVencimento].every(d => Number.isInteger(d) && d >= 1 && d <= 31)) return {erro:"Informe nome, conta bancária e dias de 1 a 31."};
  try {
    const conta = await prisma.contaBancaria.findUnique({where:{id:contaBancariaId}});
    if (!conta?.ativo) return {erro:"Selecione uma conta bancária ativa."};
    const final = String(formulario.get("final")??"").trim();
    if (final && !/^\d{4}$/.test(final)) return {erro:"Informe somente os quatro últimos dígitos."};
    const emissor=String(formulario.get("emissor")??"").trim(),bandeira=String(formulario.get("bandeira")??"").trim(),observacoes=String(formulario.get("observacoes")??"").trim();
    if(emissor.length>120||bandeira.length>60||observacoes.length>2000)return {erro:"Emissor, bandeira ou observações muito extensos."};
    const toleranciaDias=formulario.has("toleranciaDias")?Number(formulario.get("toleranciaDias")):5;
    if(!Number.isInteger(toleranciaDias)||toleranciaDias<0||toleranciaDias>31)return {erro:"Tolerância de datas deve ser de 0 a 31 dias."};
    const limite=formulario.get("limite")?decimal(dinheiro(String(formulario.get("limite")))):null;
    if(limite&&limite.startsWith("-"))return {erro:"Limite não pode ser negativo."};
    const responsavelId=String(formulario.get("responsavelId")??"")||null;
    if(responsavelId&&!await prisma.usuario.findFirst({where:{id:responsavelId,ativo:true,excluidoEm:null}}))return {erro:"Responsável inexistente ou inativo."};
    const data = {nome,contaBancariaId,diaFechamento,diaVencimento,...(formulario.has("final")?{final:final||null,emissor:emissor||null,bandeira:bandeira||null,limite,observacoes:observacoes||null,toleranciaDias}:{}),...(formulario.has("responsavelId")?{responsavelId}:{})};
    await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro-cartoes'))`;
      const antes=id?await tx.cartaoCredito.findUnique({where:{id}}):null;
      if(id&&(!antes||(formulario.get("versao")&&antes.updatedAt.toISOString()!==formulario.get("versao"))))throw new Error("Cartão alterado. Atualize.");
      const cartao=id?await tx.cartaoCredito.update({where:{id},data}):await tx.cartaoCredito.create({data});
      await tx.historicoCartao.create({data:{alvoId:cartao.id,acao:id?"CARTAO_ALTERADO":"CARTAO_CRIADO",autorId:sessao.userId,autorNome:sessao.nome,antes:JSON.parse(JSON.stringify(antes??{})),depois:JSON.parse(JSON.stringify(data))}});
    });
    revalidatePath("/financeiro/bancario"); revalidatePath("/notas-fiscais");
    revalidatePath("/financeiro/cartoes");
    return {ok:true};
  } catch { return {erro:"Não foi possível salvar. Confira se já existe um cartão com esse nome."}; }
}
export async function alternarCartaoAction(id: string, ativo: boolean): Promise<{ok:true}|{erro:string}> {
  await exigirPermissao("financeiro.bancario", "editar");
  if (typeof id !== "string" || typeof ativo !== "boolean") return {erro:"Cartão inválido."};
  try { await prisma.cartaoCredito.update({where:{id},data:{ativo}}); }
  catch { return {erro:"Não foi possível alterar o cartão."}; }
  revalidatePath("/financeiro/bancario"); revalidatePath("/notas-fiscais");
  revalidatePath("/financeiro/cartoes");
  return {ok:true};
}
