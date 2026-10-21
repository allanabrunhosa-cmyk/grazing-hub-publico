import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { categoriasComCaminho, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { incluirFatura, pendenciasCadastroFatura, pendenciasVinculoFatura, resumir } from "./servico";
import { dinheiro, ErroFatura } from "./dominio";

export type FiltrosFatura = { cartao?:string; competencia?:string; estado?:string; busca?:string; pagina?:string; de?:string; ate?:string; ordem?:string; destaque?:string };
export const numeroPagina = (valor?:string) => /^\d{1,5}$/.test(valor??"") ? Math.max(1,Number(valor)) : 1;
const c=(v:Prisma.Decimal)=>dinheiro(v.toFixed(2));
export async function cadastrosFaturas() {
  const [cartoes,contas,categorias,fornecedores,centros,responsaveis,formasPagamento]=await Promise.all([
    prisma.cartaoCredito.findMany({include:{contaBancaria:{select:{nome:true}}},orderBy:{nome:"asc"}}),
    prisma.contaBancaria.findMany({select:{id:true,nome:true,ativo:true},orderBy:{nome:"asc"}}),
    prisma.categoriaFinanceira.findMany({where:{ativo:true,excluidoEm:null},select:SELECAO_CATEGORIA_COM_CAMINHO,orderBy:{nome:"asc"}}),
    prisma.fornecedor.findMany({where:{ativo:true},select:{id:true,nome:true},orderBy:{nome:"asc"}}),
    prisma.centroCusto.findMany({select:{id:true,nome:true},orderBy:{nome:"asc"}}),
    prisma.usuario.findMany({where:{ativo:true,excluidoEm:null},select:{id:true,nome:true},orderBy:{nome:"asc"}}),
    prisma.formaPagamento.findMany({select:{id:true,nome:true},orderBy:{nome:"asc"}}),
  ]);
  return {formasPagamento,cartoes:cartoes.map(({contaBancaria,...cartao})=>({...cartao,contaBancariaNome:contaBancaria.nome,limite:cartao.limite?.toString()??null,createdAt:cartao.createdAt.toISOString(),updatedAt:cartao.updatedAt.toISOString()})),contas,categorias:categoriasComCaminho(categorias),fornecedores,centros,responsaveis};
}
export async function listarFaturas(f:FiltrosFatura) {
  const pagina=numeroPagina(f.pagina);
  const base:Prisma.FaturaCartaoWhereInput={...(f.cartao?{cartaoId:f.cartao}:{}),...(f.competencia?{competencia:f.competencia}:{}),
    ...(f.busca?{cartao:{OR:[{nome:{contains:f.busca,mode:"insensitive"}},{emissor:{contains:f.busca,mode:"insensitive"}}]}}:{}),
    ...((f.de||f.ate)?{vencimento:{...(f.de?{gte:new Date(f.de)}:{}),...(f.ate?{lte:new Date(f.ate)}:{})}}:{})};
  const where:Prisma.FaturaCartaoWhereInput={...base,...(f.estado?{estado:f.estado}:{})};
  const consultaContagens=prisma.faturaCartao.groupBy({by:["estado"],where:base,_count:{_all:true}});
  const [quantidade,faturas,porEstado]=await prisma.$transaction([prisma.faturaCartao.count({where}),prisma.faturaCartao.findMany({where,orderBy:[{vencimento:"desc"},{id:"desc"}],skip:(pagina-1)*30,take:30,include:{cartao:{select:{nome:true,final:true,emissor:true}},_count:{select:{itens:{where:{ignoradoEm:null}}}}}}),consultaContagens]);
  const ids=faturas.map(f=>f.id);
  const [somas,pagamentos]=await Promise.all([prisma.itemFaturaCartao.groupBy({by:["faturaId"],where:{faturaId:{in:ids},ignoradoEm:null},_sum:{valor:true}}),prisma.pagamentoFaturaCartao.groupBy({by:["faturaId"],where:{faturaId:{in:ids},revertidoEm:null},_sum:{valor:true}})]);
  const contagens:Record<string,number>={"":porEstado.reduce((total,g)=>total+g._count._all,0),...Object.fromEntries(porEstado.map(g=>[g.estado,g._count._all]))};
  return {pagina,quantidade,contagens,faturas:faturas.map(f=>({id:f.id,cartaoId:f.cartaoId,cartao:f.cartao.nome,final:f.cartao.final,emissor:f.cartao.emissor,competencia:f.competencia,fechamento:f.fechamento.toISOString().slice(0,10),vencimento:f.vencimento.toISOString().slice(0,10),estado:f.estado,itens:f._count.itens,total:c(f.totalInformado),calculado:c(somas.find(s=>s.faturaId===f.id)?._sum.valor??new Prisma.Decimal(0)),pago:c(pagamentos.find(p=>p.faturaId===f.id)?._sum.valor??new Prisma.Decimal(0))}))};
}
export async function detalheFatura(id:string,filtro:FiltrosFatura,podeVerPagamentos:boolean) {
  const f=await prisma.faturaCartao.findUnique({where:{id},include:{...incluirFatura,transacaoSelecionada:true}});
  if(!f)throw new ErroFatura("Fatura não encontrada.");
  const baseItens:Prisma.ItemFaturaCartaoWhereInput={faturaId:id,...(filtro.busca?{OR:[{descricaoOriginal:{contains:filtro.busca,mode:"insensitive"}},{estabelecimentoNormalizado:{contains:filtro.busca,mode:"insensitive"}}]}:{})};
  const where:Prisma.ItemFaturaCartaoWhereInput={...baseItens,...(filtro.estado==="IGNORADO"?{ignoradoEm:{not:null}}:filtro.estado?{ignoradoEm:null}:{}),...(filtro.estado&&filtro.estado!=="IGNORADO"?{estado:filtro.estado}:{})};
  const pagina=1;
  const [itens,quantidade,arquivos,historico,bancarias,semItem,porEstadoItens]=await Promise.all([
    prisma.itemFaturaCartao.findMany({where,orderBy:[{dataCompra:"asc"},{linha:"asc"},{id:"asc"}],include:{
      fornecedor:{select:{nome:true}},categoria:{select:{nome:true}},centroCusto:{select:{nome:true}},responsavel:{select:{nome:true}},
      lancamentos:{select:{id:true,descricao:true,valor:true}},
      parcelamento:{include:{itens:{select:{parcela:true,fatura:{select:{competencia:true}},valor:true},where:{ignoradoEm:null,fatura:{canceladaEm:null}},orderBy:{parcela:"asc"}}}},
    }}),
    prisma.itemFaturaCartao.count({where}),
    prisma.arquivoFaturaCartao.findMany({where:{faturaId:id},select:{id:true,nome:true,formato:true,createdAt:true},orderBy:{createdAt:"desc"}}),
    prisma.historicoCartao.findMany({where:{faturaId:id},orderBy:{createdAt:"desc"},take:100}),
    podeVerPagamentos?prisma.transacaoExtrato.findMany({where:{contaBancariaId:f.cartao.contaBancariaId,valor:{lt:0},conciliadaEm:null,pagamentoFatura:null,vinculos:{none:{}},data:{gte:new Date(f.vencimento.getTime()-45*86400000),lte:new Date(f.vencimento.getTime()+90*86400000)}},orderBy:{data:"asc"},take:1000}):[],
    prisma.lancamentoFinanceiro.count({where:{cartaoCreditoId:f.cartaoId,itemFaturaId:null,status:"PENDENTE",dataVencimento:{gte:new Date(f.competencia+"-01T00:00:00Z"),lt:new Date(Date.UTC(Number(f.competencia.slice(0,4)),Number(f.competencia.slice(5)),1))}}}),
    prisma.itemFaturaCartao.groupBy({by:["estado","ignoradoEm"],where:baseItens,_count:{_all:true}}),
  ]);
  const contagensItens:Record<string,number>={"":0,IGNORADO:0};
  for(const grupo of porEstadoItens){
    contagensItens[""]+=grupo._count._all;
    const chave=grupo.ignoradoEm?"IGNORADO":grupo.estado;
    contagensItens[chave]=(contagensItens[chave]??0)+grupo._count._all;
  }
  const pendenciasVinculo=await pendenciasVinculoFatura(f);
  return {contagensItens,selecionada:podeVerPagamentos&&f.transacaoSelecionada?{id:f.transacaoSelecionada.id,data:f.transacaoSelecionada.data.toISOString().slice(0,10),descricao:f.transacaoSelecionada.descricao,valor:-c(f.transacaoSelecionada.valor)}:null,porClassificar:f.itens.filter(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.revisado).length,pendenciasCadastro:pendenciasCadastroFatura(f),pendenciasVinculo,id:f.id,versao:f.versao,cartaoId:f.cartaoId,cartao:f.cartao.nome,final:f.cartao.final,competencia:f.competencia,inicio:f.inicio.toISOString().slice(0,10),fim:f.fim.toISOString().slice(0,10),fechamento:f.fechamento.toISOString().slice(0,10),vencimento:f.vencimento.toISOString().slice(0,10),total:c(f.totalInformado),resumo:resumir(f),cancelada:!!f.canceladaEm,pagina,quantidade,semItem,
    indicadores:{semFornecedor:f.itens.filter(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.fornecedorId).length,semCentro:f.itens.filter(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.centroCustoId).length,duplicidades:f.itens.filter(i=>i.estado==="DUPLICIDADE"&&!i.ignoradoEm).length,parcelados:f.itens.filter(i=>i.totalParcelas>1&&!i.ignoradoEm).length,creditos:f.itens.filter(i=>i.valor.isNegative()&&!i.ignoradoEm).length},
    itens:itens.map(i=>({id:i.id,linha:i.linha,descricao:i.descricaoOriginal,normalizada:i.estabelecimentoNormalizado,textoOriginal:i.textoOriginal,valor:c(i.valor),valorOriginal:c(i.valorOriginal),data:i.dataCompra.toISOString().slice(0,10),tipo:i.tipo,parcela:i.parcela,totalParcelas:i.totalParcelas,parcelasRecebidas:i.parcelamento?.itens.map(p=>({parcela:p.parcela,competencia:p.fatura.competencia,valor:c(p.valor)}))??[],estado:i.estado,ignorado:!!i.ignoradoEm,compensadoComId:i.compensadoComId,fornecedorId:i.fornecedorId,fornecedor:i.fornecedor?.nome??null,categoriaId:i.categoriaId,categoria:i.categoria?.nome??null,centroCustoId:i.centroCustoId,centro:i.centroCusto?.nome??null,responsavelId:i.responsavelId,responsavel:i.responsavel?.nome??i.portadorOriginal,observacoes:i.observacoes,descricaoLancamento:i.descricaoLancamento,sugestao:i.sugestao,lancamentos:i.lancamentos.map(l=>({...l,valor:c(l.valor)}))})),
    pagamentos:f.pagamentos.map(p=>({id:p.id,valor:c(p.valor),data:p.data.toISOString().slice(0,10),autor:p.autorNome})),
    bancarias:bancarias.slice(0,200).map(t=>({id:t.id,descricao:t.descricao,valor:-c(t.valor),data:t.data.toISOString().slice(0,10)})),
    arquivos:arquivos.map(a=>({...a,createdAt:a.createdAt.toISOString()})),historico:historico.map(h=>({id:h.id,acao:h.acao,autor:h.autorNome,data:h.createdAt.toISOString(),motivo:h.motivo,antes:h.antes,depois:h.depois}))};
}
export type DadosFatura = Awaited<ReturnType<typeof detalheFatura>>;
export type CadastrosFatura = Awaited<ReturnType<typeof cadastrosFaturas>>;
