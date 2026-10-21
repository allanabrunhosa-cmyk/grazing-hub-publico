import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { exigirDespesaSemCustoEntrega } from "@/lib/financeiro/custos-entrega";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { extrairArquivo, type MapaFatura } from "./arquivo";
import { identificarCartao } from "./cabecalho";
import { auditarFatura, autorFatura } from "./acesso";
import { chaveParcelamento, dataBanco, dataFinanceira, decimal, dinheiro, ErroFatura, identificarLinhas, normalizarEstabelecimento, normalizarTexto, pontuarCorrespondencia, sugerirVinculosFatura, ratearLiquidacao, resumoFatura, resumoHash, selecionarRegra } from "./dominio";

import { itensCompensados, parCompensavel } from "./compensacao";

const opcoes = { timeout: 60000, maxWait: 15000 };
const centavos = (d: Prisma.Decimal) => dinheiro(d.toFixed(2));
export const incluirFatura = { cartao: true, itens: { include: { lancamentos: true, categoria: { select: { ativo: true, excluidoEm: true } }, fornecedor: { select: { ativo: true } }, responsavel: { select: { ativo: true, excluidoEm: true } }, centroCusto: { select: { id: true } } } }, pagamentos: { where: { revertidoEm: null }, orderBy: [{ data: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }] } };
type FaturaCompleta = Prisma.FaturaCartaoGetPayload<{ include: typeof incluirFatura }>;
const itemCompensavel = (i: FaturaCompleta["itens"][number]) => ({ id:i.id, data:i.dataCompra.toISOString().slice(0,10), valor:centavos(i.valor), ignorado:!!i.ignoradoEm, compensadoComId:i.compensadoComId, lancamentos:i.lancamentos });
const compensacoesFatura = (f: FaturaCompleta) => itensCompensados(f.itens.map(itemCompensavel));
export function pendenciasCadastroFatura(f: FaturaCompleta) {
  return f.itens.filter(i => !i.ignoradoEm && !i.compensadoComId && i.revisado && !i.lancamentos.length).flatMap(i => {
    const motivos: string[] = [];
    if (!i.categoriaId || !i.categoria || !i.categoria.ativo || i.categoria.excluidoEm) motivos.push("Categoria financeira excluída ou inativa");
    if (i.fornecedorId && !i.fornecedor?.ativo) motivos.push("Fornecedor inativo ou inexistente");
    if (i.responsavelId && (!i.responsavel?.ativo || i.responsavel.excluidoEm)) motivos.push("Responsável inativo ou inexistente");
    if (i.centroCustoId && !i.centroCusto) motivos.push("Centro de custo inexistente");
    return motivos.length ? [{ id: i.id, linha: i.linha, descricao: i.descricaoOriginal, motivos }] : [];
  });
}
const valorNaFatura = (l: {tipo:string;valor:Prisma.Decimal}) => (l.tipo === "RECEITA" ? -1 : 1) * centavos(l.valor);

export function resumir(f: FaturaCompleta) {
  const compensados = compensacoesFatura(f);
  return resumoFatura(centavos(f.totalInformado), f.itens.map(i => ({ valor: centavos(i.valor), ignorado: !!i.ignoradoEm, revisado: compensados.has(i.id) || i.revisado,
    vinculado: compensados.has(i.id) || i.lancamentos.length > 0 && i.lancamentos.filter(l => l.status !== "CANCELADO").reduce((s,l) => s+valorNaFatura(l),0) === centavos(i.valor) })), f.pagamentos.reduce((s,p) => s+centavos(p.valor),0), !!f.canceladaEm);
}
async function faturaAtual(tx: Prisma.TransactionClient, id: string, versao: number) {
  if (typeof id !== "string" || !Number.isInteger(versao)) throw new ErroFatura("Referência da fatura inválida.");
  await tx.$queryRaw`SELECT id FROM "FaturaCartao" WHERE id = ${id} FOR UPDATE`;
  const f = await tx.faturaCartao.findUnique({ where: { id }, include: incluirFatura });
  if (!f || f.canceladaEm) throw new ErroFatura("Fatura ausente ou cancelada.");
  if (f.versao !== versao) throw new ErroFatura("A fatura mudou. Atualize a tela e confira novamente.");
  return f;
}
async function atualizarResumo(tx: Prisma.TransactionClient, id: string) {
  const f = await tx.faturaCartao.findUniqueOrThrow({ where: { id }, include: incluirFatura });
  const r = resumir(f);
  await tx.faturaCartao.update({ where: { id }, data: { estado: r.estado, versao: { increment: 1 } } });
  return r;
}
function justificar(motivo: string) {
  if (typeof motivo !== "string" || motivo.trim().length < 3 || motivo.length > 1000) throw new ErroFatura("Informe um motivo de 3 a 1.000 caracteres.");
  return motivo.trim();
}
export async function identificarDadosFatura(form: FormData) {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size > 2 * 1024 * 1024) throw new ErroFatura("Selecione uma fatura de até 2 MB.");
  const extracao = await extrairArquivo(Buffer.from(await arquivo.arrayBuffer()), arquivo.name, undefined, String(form.get("senhaPdf") ?? ""));
  const cabecalho = extracao.cabecalho ?? { dados: {}, conflitos: [] };
  const cartoes = await prisma.cartaoCredito.findMany({ where: { ativo: true }, select: { id: true, final: true } });
  return { cabecalho, cartaoId: identificarCartao(cabecalho, cartoes), formato: extracao.formato, quantidade: extracao.linhas.length };
}
async function lerFormulario(form: FormData) {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size > 2 * 1024 * 1024) throw new ErroFatura("Selecione a fatura de até 2 MB.");
  const cartaoId = String(form.get("cartaoId") ?? ""), competencia = String(form.get("competencia") ?? "");
  if (!cartaoId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new ErroFatura("Selecione cartão e competência.");
  const inicio = dataBanco(String(form.get("inicio") ?? "")), fim = dataBanco(String(form.get("fim") ?? ""));
  const fechamento = dataBanco(String(form.get("fechamento") ?? "")), vencimento = dataBanco(String(form.get("vencimento") ?? ""));
  if (inicio > fim || fechamento < fim || vencimento < fechamento) throw new ErroFatura("Confira início, fim, fechamento e vencimento.");
  const total = dinheiro(String(form.get("total") ?? ""));
  let mapa: MapaFatura | undefined;
  try { mapa = form.get("mapa") ? JSON.parse(String(form.get("mapa"))) : undefined; } catch { throw new ErroFatura("Mapeamento inválido."); }
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const extracao = await extrairArquivo(bytes, arquivo.name, mapa, String(form.get("senhaPdf") ?? ""));
  if (!extracao.linhas.length) throw new ErroFatura("Nenhuma compra foi identificada. Confira o formato ou exporte CSV com Data, Descrição e Valor.");
  return { cartaoId, competencia, inicio, fim, fechamento, vencimento, total, bytes, nome: arquivo.name, hash: resumoHash(bytes), extracao, linhas: identificarLinhas(extracao.linhas) };
}
async function preparar(tx: Prisma.TransactionClient, a: Awaited<ReturnType<typeof lerFormulario>>) {
  const cartao = await tx.cartaoCredito.findUnique({ where: { id: a.cartaoId } });
  if (!cartao?.ativo) throw new ErroFatura("Selecione um cartão ativo.");
  const finalPdf = a.extracao.cabecalho?.dados.final?.valor;
  if (finalPdf && cartao.final && cartao.final !== finalPdf) throw new ErroFatura("Este PDF pertence a outro cartão principal. Selecione o cadastro com o final indicado no documento.");
  const f = await tx.faturaCartao.findUnique({ where: { cartaoId_competencia: { cartaoId:a.cartaoId,competencia:a.competencia } }, include: { itens: { select: { identidade:true } }, arquivos: { select: { hash:true } } } });
  if (f?.canceladaEm) throw new ErroFatura("A fatura desta competência foi cancelada. Restaure-a antes de reprocessar.");
  const identidades = new Set(f?.itens.map(i => i.identidade));
  const linhas = a.linhas.map(l => ({ ...l, existente: identidades.has(l.identidade) }));
  const token = resumoHash(JSON.stringify([a.hash,a.cartaoId,cartao.updatedAt,a.competencia,a.inicio,a.fim,a.fechamento,a.vencimento,a.total,f?.versao ?? 0,linhas]));
  return { token, faturaId: f?.id ?? null, versao: f?.versao ?? 0, arquivoRepetido: !!f?.arquivos.some(ar => ar.hash === a.hash), linhas,
    totalInformado: a.total, totalExtraido: a.linhas.reduce((s,l) => s+l.valor,0), naoReconhecidas:a.extracao.naoReconhecidas, avisos:a.extracao.avisos, cartao:cartao.nome };
}
export async function prepararImportacao(form: FormData) {
  const a = await lerFormulario(form);
  return prisma.$transaction(tx => preparar(tx,a), opcoes);
}
export async function importarFatura(form: FormData, sessao: SessaoAtual) {
  const a = await lerFormulario(form);
  if (form.get("confirmar") !== "sim") throw new ErroFatura("Confira a prévia e confirme a importação.");
  if (a.extracao.cabecalho?.banco) {
    const totalPdf = a.extracao.cabecalho.dados.total?.valor;
    if (!totalPdf || a.extracao.cabecalho.conflitos.includes("total") || dinheiro(totalPdf) !== a.total) throw new ErroFatura("O total informado deve corresponder ao total identificado no PDF. Confira o documento antes de importar.");
    if (a.extracao.naoReconhecidas.length || a.linhas.reduce((s,l)=>s+l.valor,0)!==a.total) throw new ErroFatura("O detalhamento não fecha com o total da fatura. Não importe parcialmente: confira as pendências do PDF.");
  }
  // Linhas tabulares inválidas não podem ser descartadas. PDF permite revisar cabeçalhos/totais explicitamente.
  if (a.extracao.naoReconhecidas.length && (a.extracao.formato !== "PDF" || form.get("conferirNaoReconhecidas") !== "sim")) throw new ErroFatura("Confira todas as linhas não reconhecidas. Corrija linhas inválidas da planilha antes de importar.");
  if (a.linhas.some(l => l.possivelDuplicada) && form.get("confirmarDuplicadas") !== "sim") throw new ErroFatura("Confirme as compras repetidas que realmente constam na fatura.");
  return prisma.$transaction(async tx => {
    const autor = await autorFatura(tx,sessao,"financeiro.faturas","adicionar");
    const p = await preparar(tx,a);
    if (p.token !== form.get("token")) throw new ErroFatura("Prévia vencida ou alterada. Gere novamente antes de confirmar.");
    if (p.arquivoRepetido) return { id: p.faturaId!, repetida: true };
    if (form.get("memorizarFinal") === "sim") {
      if (!autor.pode("financeiro.bancario","editar")) throw new ErroFatura("Sem permissão para associar o final ao cadastro do cartão.");
      const finalPdf = a.extracao.cabecalho?.dados.final?.valor;
      if (!finalPdf || a.extracao.cabecalho?.conflitos.includes("final")) throw new ErroFatura("O final do cartão não foi identificado com segurança.");
      const outro = await tx.cartaoCredito.findFirst({ where: { ativo:true,final:finalPdf,id:{not:a.cartaoId} }, select:{id:true} });
      if (outro) throw new ErroFatura("Este final já está associado a outro cartão. Confira o cadastro selecionado.");
      const anterior = await tx.cartaoCredito.findUniqueOrThrow({where:{id:a.cartaoId},select:{final:true}});
      await tx.cartaoCredito.update({where:{id:a.cartaoId},data:{final:finalPdf}});
      await auditarFatura(tx,autor,"FINAL_ASSOCIADO",a.cartaoId,null,anterior,{final:finalPdf});
    }
    const f = p.faturaId ? await faturaAtual(tx,p.faturaId,p.versao) : null;
    if (f?.pagamentos.length) throw new ErroFatura("Desfaça os pagamentos antes de alterar o conteúdo da fatura.");
    const dados = { inicio:a.inicio,fim:a.fim,fechamento:a.fechamento,vencimento:a.vencimento,totalInformado:decimal(a.total) };
    const fatura = f ? await tx.faturaCartao.update({ where:{id:f.id},data:dados }) : await tx.faturaCartao.create({ data:{...dados,cartaoId:a.cartaoId,competencia:a.competencia,autorId:autor.id,autorNome:autor.nome} });
    const arquivo = await tx.arquivoFaturaCartao.create({data:{faturaId:fatura.id,nome:a.nome,hash:a.hash,formato:a.extracao.formato,dados:a.bytes,autorId:autor.id}});
    const regras = await tx.regraCartao.findMany({ where:{ativa:true,categoria:{ativo:true,excluidoEm:null},OR:[{cartaoId:null},{cartaoId:a.cartaoId}]},take:1000 });
    for (const l of p.linhas.filter(l => !l.existente)) {
      const chave = chaveParcelamento(l,a.competencia);
      // Duas compras idênticas parceladas na mesma competência são ambíguas: não unir automaticamente.
      const parcelamento = chave && !l.possivelDuplicada ? await tx.parcelamentoCartao.upsert({where:{cartaoId_chave:{cartaoId:a.cartaoId,chave}},create:{cartaoId:a.cartaoId,chave,descricao:l.descricao,totalParcelas:l.totalParcelas},update:{}}) : null;
      const regra = selecionarRegra(regras.map(r => ({...r,valorMinimo:r.valorMinimo===null?null:centavos(r.valorMinimo),valorMaximo:r.valorMaximo===null?null:centavos(r.valorMaximo)})),{descricao:l.descricao,cartaoId:a.cartaoId,tipo:l.tipo,valor:l.valor});
      const escolhida = regras.find(r => r.id === regra?.id);
      await tx.itemFaturaCartao.create({data:{faturaId:fatura.id,arquivoId:arquivo.id,linha:l.linha,identidade:l.identidade,
        textoOriginal:l.textoOriginal,descricaoOriginal:l.descricao,descricaoNormalizada:normalizarTexto(l.descricao),estabelecimentoOriginal:l.estabelecimento,estabelecimentoNormalizado:normalizarEstabelecimento(l.estabelecimento),
        valorOriginal:decimal(l.valor),valor:decimal(l.valor),dataCompra:dataBanco(l.data),dataCompetencia:dataBanco(l.totalParcelas > 1 ? `${a.competencia}-01` : l.data),tipo:l.tipo,parcela:l.parcela,totalParcelas:l.totalParcelas,
        parcelamentoId:parcelamento?.id,portadorOriginal:l.portador,documento:l.documento,regraId:escolhida?.id,
        sugestao: escolhida ? {origem:escolhida.origem,motivo:`Regra ${escolhida.nome} (${escolhida.modo})`,categoriaId:escolhida.categoriaId,fornecedorId:escolhida.fornecedorId,centroCustoId:escolhida.centroCustoId} : Prisma.JsonNull,
        estado:l.possivelDuplicada?"DUPLICIDADE":"REVISAR"}});
    }
    await atualizarResumo(tx,fatura.id);
    await auditarFatura(tx,autor,f?"REPROCESSAMENTO":"IMPORTACAO",fatura.id,fatura.id,f?{versao:f.versao,total:f.totalInformado}:null,{arquivoId:arquivo.id,hash:a.hash,novas:p.linhas.filter(l=>!l.existente).length,preservadas:p.linhas.filter(l=>l.existente).length,naoReconhecidas:a.extracao.naoReconhecidas});
    return { id:fatura.id,repetida:false };
  },opcoes);
}

export type ClassificacaoFatura = { ids:string[]; categoriaId:string; fornecedorId:string|null; centroCustoId:string|null; responsavelId:string|null; observacoes?:string; descricaoLancamento?:string; memorizar?:boolean };
async function validarClassificacao(tx:Prisma.TransactionClient,d:ClassificacaoFatura) {
  if (!Array.isArray(d.ids) || !d.ids.length || d.ids.length>200 || new Set(d.ids).size!==d.ids.length || d.ids.some(id=>typeof id!=="string")) throw new ErroFatura("Selecione de 1 a 200 itens diferentes.");
  const categoria = await tx.categoriaFinanceira.findFirst({where:{id:d.categoriaId,ativo:true,excluidoEm:null}});
  if (!categoria) throw new ErroFatura("Selecione uma categoria ativa.");
  if (d.fornecedorId && !await tx.fornecedor.findFirst({where:{id:d.fornecedorId,ativo:true}})) throw new ErroFatura("Fornecedor inativo ou inexistente.");
  if (d.centroCustoId && !await tx.centroCusto.findUnique({where:{id:d.centroCustoId}})) throw new ErroFatura("Centro de custo inexistente.");
  if (d.responsavelId && !await tx.usuario.findFirst({where:{id:d.responsavelId,ativo:true,excluidoEm:null}})) throw new ErroFatura("Responsável inativo ou inexistente.");
  if(d.descricaoLancamento!==undefined&&(typeof d.descricaoLancamento!=="string"||!d.descricaoLancamento.trim()||d.descricaoLancamento.trim().length>500||d.ids.length!==1))throw new ErroFatura("Informe o nome de um único lançamento com até 500 caracteres.");
  if ((d.observacoes?.length??0)>2000) throw new ErroFatura("Observações excedem 2.000 caracteres.");
  return categoria;
}
export async function classificarItens(faturaId:string,versao:number,d:ClassificacaoFatura,sessao:SessaoAtual) {
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","editar");
    const f=await faturaAtual(tx,faturaId,versao);
    const categoria=await validarClassificacao(tx,d);
    const itens=f.itens.filter(i=>d.ids.includes(i.id));
    if(itens.length!==d.ids.length || itens.some(i=>i.ignoradoEm || i.compensadoComId || i.lancamentos.length)) throw new ErroFatura("Desvincule despesas antes de reclassificar. Itens ignorados ou compensados não são editáveis.");
    if (GRUPOS_RECEITA.includes(categoria.grupo) && itens.some(i=>!i.valor.isNegative())) throw new ErroFatura("Receita só pode ser usada em créditos da fatura.");
    const dados={categoriaId:d.categoriaId,fornecedorId:d.fornecedorId||null,centroCustoId:d.centroCustoId||categoria.centroCustoId,responsavelId:d.responsavelId||null,observacoes:d.observacoes?.trim()||null,...(d.descricaoLancamento!==undefined?{descricaoLancamento:d.descricaoLancamento.trim()}:{}),revisado:true,estado:"CLASSIFICADO"};
    await tx.itemFaturaCartao.updateMany({where:{id:{in:d.ids},faturaId},data:dados});
    if(d.memorizar){
      if(!autor.pode("financeiro.cartoes-regras","adicionar")) throw new ErroFatura("Sem permissão para criar regras.");
      for(const texto of new Set(itens.map(i=>i.estabelecimentoNormalizado))) {
        const regra=await tx.regraCartao.create({data:{nome:`Memória: ${texto}`.slice(0,120),texto,cartaoId:f.cartaoId,categoriaId:dados.categoriaId,fornecedorId:dados.fornecedorId,centroCustoId:dados.centroCustoId,origem:"HISTORICO"}});
        await auditarFatura(tx,autor,"REGRA_CRIADA",regra.id,faturaId,null,regra);
      }
    }
    await auditarFatura(tx,autor,"CLASSIFICACAO",faturaId,faturaId,itens.map(i=>({id:i.id,categoriaId:i.categoriaId,fornecedorId:i.fornecedorId,centroCustoId:i.centroCustoId,responsavelId:i.responsavelId,observacoes:i.observacoes})),{ids:d.ids,...dados});
    await atualizarResumo(tx,faturaId); return {ok:true as const};
  },opcoes);
}

async function buscarLancamentosCandidatos(tx:Prisma.TransactionClient,f:FaturaCompleta,sinais:Prisma.LancamentoFinanceiroWhereInput,outrosCartoes=false) {
  const encontrados=await tx.lancamentoFinanceiro.findMany({where:{status:"PENDENTE",itemFaturaId:null,movimentacaoBancaria:null,vinculoExtrato:null,pedidoVendaId:null,AND:[...(outrosCartoes?[]:[{OR:[{cartaoCreditoId:f.cartaoId},{cartaoCreditoId:null}]}]),sinais]},include:{cartaoCredito:{select:{nome:true}},notaFiscalItemLancamento:{select:{notaFiscalDuplicataId:true}},fornecedor:{select:{nome:true}}},orderBy:[{dataVencimento:"asc"},{id:"asc"}],take:1001});
  if(encontrados.length>1000) throw new ErroFatura("Há muitos lançamentos candidatos. Revise os lançamentos pendentes antes de continuar.");
  return encontrados;
}
function avaliarCandidatos(f:FaturaCompleta,item:FaturaCompleta["itens"][number],encontrados:Awaited<ReturnType<typeof buscarLancamentosCandidatos>>) {
  return encontrados.map(l=>({id:l.id,descricao:l.descricao,valor:valorNaFatura(l),data:l.dataCompetencia.toISOString().slice(0,10),vencimento:l.dataVencimento.toISOString().slice(0,10),cartaoId:l.cartaoCreditoId,cartaoNome:l.cartaoCredito?.nome??null,podeCorrigirCartao:!l.notaFiscalItemLancamento,fornecedorId:l.fornecedorId,versao:l.updatedAt.toISOString(),notaGrupo:l.notaFiscalItemLancamento?.notaFiscalDuplicataId??null,
    correspondencia:pontuarCorrespondencia({valor:centavos(item.valor),data:item.dataCompra.toISOString().slice(0,10),vencimento:f.vencimento.toISOString().slice(0,10),descricao:item.descricaoOriginal,cartaoId:f.cartaoId,fornecedorId:item.fornecedorId},{id:l.id,valor:valorNaFatura(l),data:l.dataCompetencia.toISOString().slice(0,10),vencimento:l.dataVencimento.toISOString().slice(0,10),descricao:l.descricao,cartaoId:l.cartaoCreditoId,fornecedorId:l.fornecedorId},f.cartao.toleranciaDias)}));
}
async function candidatos(tx:Prisma.TransactionClient,f:FaturaCompleta,item:FaturaCompleta["itens"][number],todosSinais=false,outrosCartoes=false) {
  const sinais:Prisma.LancamentoFinanceiroWhereInput=todosSinais?{OR:[{tipo:"DESPESA",valor:{not:0}},{tipo:"RECEITA",valor:{gt:0}}]}:item.valor.isNegative()?{OR:[{tipo:"RECEITA",valor:{gt:0}},{tipo:"DESPESA",valor:{lt:0}}]}:{tipo:"DESPESA",valor:{gt:0}};
  return avaliarCandidatos(f,item,await buscarLancamentosCandidatos(tx,f,sinais,outrosCartoes));
}
function lancamentosCorrespondentes(lista:Awaited<ReturnType<typeof candidatos>>,valor:number,cartaoId:string,dataCompra:string,toleranciaDias:number) {
  const grupos=new Map<string,{soma:number;ids:string[];descricoes:string[]}>();
  // Soma de nota só é indício de duplicidade quando a parcela foi atribuída ao
  // mesmo cartão e a compra ocorreu perto da emissão. Valor igual isolado é comum.
  for(const l of lista)if(l.notaGrupo&&l.cartaoId===cartaoId&&Math.sign(l.valor)===Math.sign(valor)&&Math.abs(Date.parse(l.data)-Date.parse(dataCompra))<=toleranciaDias*86400000){
    const grupo=grupos.get(l.notaGrupo)??{soma:0,ids:[],descricoes:[]};
    grupo.soma+=l.valor;grupo.ids.push(l.id);grupo.descricoes.push(l.descricao);grupos.set(l.notaGrupo,grupo);
  }
  const fortes=lista.filter(l=>l.correspondencia?.forte);
  const grupo=[...grupos.values()].find(g=>g.soma===valor);
  return grupo&&fortes.length===0?{ids:grupo.ids,descricoes:grupo.descricoes}:fortes.length?{ids:fortes.map(l=>l.id),descricoes:fortes.map(l=>l.descricao)}:null;
}
export async function pendenciasVinculoFatura(f:FaturaCompleta) {
  const faltantes=f.itens.filter(i=>!i.ignoradoEm&&!i.compensadoComId&&i.revisado&&!i.lancamentos.length);
  if(!faltantes.length)return [];
  return prisma.$transaction(async tx=>{
    const encontrados=await buscarLancamentosCandidatos(tx,f,{OR:[{tipo:"DESPESA",valor:{not:0}},{tipo:"RECEITA",valor:{gt:0}}]});
    const resultado=[];
    for(const item of faltantes){
      const lista=avaliarCandidatos(f,item,encontrados).filter(l=>item.valor.isNegative()?l.valor<0:l.valor>0);
      const pendencia=lancamentosCorrespondentes(lista,centavos(item.valor),f.cartaoId,item.dataCompra.toISOString().slice(0,10),f.cartao.toleranciaDias);
      if(pendencia)resultado.push({id:item.id,linha:item.linha,descricao:item.descricaoOriginal,valor:centavos(item.valor),lancamentos:pendencia.descricoes.slice(0,3),quantidade:pendencia.ids.length});
    }
    return resultado;
  },opcoes);
}
export async function consultarCorrespondencias(faturaId:string,itemId:string,outrosCartoes=false) {
  if(typeof outrosCartoes!=="boolean")throw new ErroFatura("Filtro de cartões inválido.");
  return prisma.$transaction(async tx=>{
    const f=await tx.faturaCartao.findUniqueOrThrow({where:{id:faturaId},include:incluirFatura});
    const item=f.itens.find(i=>i.id===itemId);if(!item)throw new ErroFatura("Item não encontrado.");
    const lista=await candidatos(tx,f,item,true,outrosCartoes);
    const historico=await tx.itemFaturaCartao.findFirst({where:{id:{not:item.id},estabelecimentoNormalizado:item.estabelecimentoNormalizado,revisado:true,ignoradoEm:null,categoria:{ativo:true,excluidoEm:null},fatura:{canceladaEm:null}},orderBy:{updatedAt:"desc"},select:{categoriaId:true,fornecedorId:true,centroCustoId:true}});
    const fornecedores=await tx.fornecedor.findMany({where:{ativo:true,nome:{equals:item.estabelecimentoNormalizado,mode:"insensitive"}},select:{id:true,nome:true},take:2});
    const estornos=centavos(item.valor)<0?await tx.itemFaturaCartao.findMany({where:{id:{not:item.id},fatura:{cartaoId:f.cartaoId,canceladaEm:null},valor:{gt:0},dataCompra:{lte:item.dataCompra},ignoradoEm:null,compensadoComId:null},orderBy:{dataCompra:"desc"},select:{id:true,descricaoOriginal:true,valor:true,dataCompra:true},take:50}):[];
    return {candidatos:lista,sugestoesVinculo:sugerirVinculosFatura({descricao:item.descricaoOriginal,valor:centavos(item.valor),vencimento:f.vencimento.toISOString().slice(0,10),cartaoId:f.cartaoId,data:item.dataCompra.toISOString().slice(0,10),toleranciaDias:f.cartao.toleranciaDias},lista.filter(l=>!l.cartaoId||l.cartaoId===f.cartaoId)),sugestao:item.sugestao??(historico?{...historico,origem:"HISTORICO",motivo:"Classificação confirmada anterior, mesmo estabelecimento"}:fornecedores.length===1?{fornecedorId:fornecedores[0].id,origem:"FORNECEDOR",motivo:"Nome exato do fornecedor"}:null),estornos:estornos.map(e=>({...e,valor:centavos(e.valor),dataCompra:e.dataCompra.toISOString().slice(0,10)}))};
  },opcoes);
}

// Correção explícita do cadastro; vincularItem continua recusando outro cartão.
export async function corrigirCartaoDespesa(faturaId:string,versaoFatura:number,lancamentoId:string,versaoLancamento:string,motivo:string,sessao:SessaoAtual) {
  const justificativa=justificar(motivo);
  if(typeof lancamentoId!=="string"||!lancamentoId||lancamentoId.length>100||typeof versaoLancamento!=="string")throw new ErroFatura("Referência da despesa inválida.");
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","editar");
    if(!autor.pode("financeiro.movimentacoes","editar"))throw new ErroFatura("Sem permissão para corrigir o cartão da despesa.");
    const f=await faturaAtual(tx,faturaId,versaoFatura);
    const cartao=await tx.cartaoCredito.findUnique({where:{id:f.cartaoId},include:{contaBancaria:true}});
    if(!cartao?.ativo||!cartao.contaBancaria.ativo)throw new ErroFatura("Cartão ou conta bancária inativos.");
    await exigirDespesaSemCustoEntrega(tx,{id:lancamentoId});
    await tx.$queryRaw`SELECT id FROM "LancamentoFinanceiro" WHERE id = ${lancamentoId} FOR UPDATE`;
    const l=await tx.lancamentoFinanceiro.findUnique({where:{id:lancamentoId},include:{movimentacaoBancaria:true,vinculoExtrato:true,notaFiscalItemLancamento:true,liquidacoesCartao:true}});
    if(!l||l.status!=="PENDENTE"||l.tipo!=="DESPESA"||!l.valor.isPositive()||l.itemFaturaId||l.pedidoVendaId||l.dataPagamento||l.movimentacaoBancaria||l.vinculoExtrato||l.liquidacoesCartao.length)throw new ErroFatura("Só é possível corrigir o cartão de uma despesa pendente, sem baixa ou vínculo.");
    if(l.notaFiscalItemLancamento)throw new ErroFatura("Corrija o cartão pela parcela da NF-e de origem.");
    if(l.cartaoCreditoId===f.cartaoId)return {ok:true as const};
    if(!l.cartaoCreditoId||l.updatedAt.toISOString()!==versaoLancamento)throw new ErroFatura("Despesa alterada. Atualize e confira o cartão antes de corrigir.");
    const antes={cartaoCreditoId:l.cartaoCreditoId,versao:l.updatedAt.toISOString()};
    const depois=await tx.lancamentoFinanceiro.update({where:{id:l.id},data:{cartaoCreditoId:f.cartaoId},select:{cartaoCreditoId:true,updatedAt:true}});
    await auditarFatura(tx,autor,"CARTAO_CORRIGIDO",l.id,f.id,antes,{cartaoCreditoId:depois.cartaoCreditoId,versao:depois.updatedAt.toISOString()},justificativa);
    await atualizarResumo(tx,f.id);
    return {ok:true as const};
  },opcoes);
}

// Recalcula somente alocações do módulo de faturas; pagamentos revertidos permanecem auditáveis.
async function liquidar(tx:Prisma.TransactionClient,faturaId:string) {
  const f=await tx.faturaCartao.findUniqueOrThrow({where:{id:faturaId},include:incluirFatura});
  const r=resumir(f), lancamentos=f.itens.filter(i=>!i.ignoradoEm).flatMap(i=>i.lancamentos).sort((a,b)=>a.id.localeCompare(b.id));
  if(!lancamentos.length || r.pendencias || r.diferenca) return;
  await tx.liquidacaoCartao.deleteMany({where:{pagamento:{faturaId,revertidoEm:null}}});
  let pago=0, anterior=lancamentos.map(()=>0);
  for(const pagamento of f.pagamentos){
    pago+=centavos(pagamento.valor);
    const acumulado=ratearLiquidacao(lancamentos.map(l=>valorNaFatura(l)),pago);
    await tx.liquidacaoCartao.createMany({data:lancamentos.map((l,i)=>({pagamentoId:pagamento.id,lancamentoId:l.id,valor:decimal((l.tipo==="RECEITA"?-1:1)*(acumulado[i]-anterior[i]))}))});
    anterior=acumulado;
  }
  const quitada=r.pendente===0;
  await tx.lancamentoFinanceiro.updateMany({where:{id:{in:lancamentos.map(l=>l.id)}},data:{status:quitada?"BAIXADO":"PENDENTE",dataPagamento:quitada?(f.pagamentos.at(-1)?.data??dataFinanceira(f.vencimento.toISOString().slice(0,10))):null}});
}
async function criarDespesaItem(tx:Prisma.TransactionClient,f:FaturaCompleta,item:FaturaCompleta["itens"][number],autorId:string,novo?:{descricao:string;dataCompetencia:string;dataVencimento:string},motivo="") {
  if(item.compensadoComId)throw new ErroFatura("Desfaça a compensação antes de criar um lançamento para este item.");
  if(!item.revisado||!item.categoriaId)throw new ErroFatura("Classifique e revise o item antes de criar uma despesa.");
  const categoria = await validarClassificacao(tx,{ids:[item.id],categoriaId:item.categoriaId,fornecedorId:item.fornecedorId,centroCustoId:item.centroCustoId,responsavelId:item.responsavelId});
  const receita = GRUPOS_RECEITA.includes(categoria.grupo);
  if(receita && !item.valor.isNegative()) throw new ErroFatura("Receita só pode ser usada em créditos da fatura.");
  const lista=await candidatos(tx,f,item);
  // Também protege notas discriminadas cujo total coincida com a compra.
  if(lancamentosCorrespondentes(lista,centavos(item.valor),f.cartaoId,item.dataCompra.toISOString().slice(0,10),f.cartao.toleranciaDias)) {
    if (!motivo.trim()) throw new ErroFatura(`Linha ${item.linha}: existe lançamento pendente correspondente. Vincule-o ao item ou crie a despesa individualmente com um motivo de duplicidade.`);
    justificar(motivo);
  }
  await tx.lancamentoFinanceiro.create({data:{tipo:receita?"RECEITA":"DESPESA",descricao:novo?.descricao.trim()??item.descricaoLancamento??item.descricaoNormalizada,valor:receita?item.valor.abs():item.valor,categoriaId:item.categoriaId,fornecedorId:item.fornecedorId,
    contraparteNome:item.estabelecimentoNormalizado,cartaoCreditoId:f.cartaoId,contaBancariaId:f.cartao.contaBancariaId,itemFaturaId:item.id,
    dataCompetencia:dataFinanceira(novo?.dataCompetencia??item.dataCompetencia.toISOString().slice(0,10)),dataVencimento:dataFinanceira(novo?.dataVencimento??f.vencimento.toISOString().slice(0,10)),criadoPorId:autorId,observacoes:item.observacoes??"Origem: fatura de cartão."}});
}
export async function vincularItem(faturaId:string,versao:number,itemId:string,entrada:{lancamentos?:{id:string;versao:string}[];substituir?:boolean;motivo?:string;criar?:boolean;motivoDuplicidade?:string;novo?:Omit<ClassificacaoFatura,"ids"|"memorizar"> & {descricao:string;dataCompetencia:string;dataVencimento:string}},sessao:SessaoAtual) {
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","editar"),f=await faturaAtual(tx,faturaId,versao);
    if(!autor.pode("financeiro.movimentacoes","visualizar"))throw new ErroFatura("Sem permissão para consultar despesas.");
    let item=f.itens.find(i=>i.id===itemId);
    if(!item||item.ignoradoEm||item.compensadoComId||(item.lancamentos.length&&!entrada.substituir))throw new ErroFatura("Item indisponível ou já vinculado.");
    const anteriores=item.lancamentos;
    if(entrada.substituir){
      justificar(entrada.motivo??"");
      if(!anteriores.length||entrada.criar)throw new ErroFatura("Selecione lançamentos existentes para substituir o vínculo atual.");
      if(!autor.pode("financeiro.movimentacoes","editar")||(f.pagamentos.length&&!autor.pode("financeiro.baixas","editar")))throw new ErroFatura("Sem permissão para alterar os lançamentos e suas baixas.");
      if(f.pagamentos.length&&(resumir(f).pendencias||resumir(f).diferenca))throw new ErroFatura("Conclua a revisão da fatura antes de substituir vínculos com pagamento.");
    }
    if(Boolean(entrada.criar)===Boolean(entrada.lancamentos?.length))throw new ErroFatura("Escolha vincular despesas existentes ou criar uma nova.");
    if(entrada.criar){
      if(!autor.pode("financeiro.movimentacoes","adicionar"))throw new ErroFatura("Sem permissão para criar despesas.");
      if(entrada.novo){
        const n=entrada.novo;
        const categoria=await validarClassificacao(tx,{...n,ids:[item.id]});
        if(GRUPOS_RECEITA.includes(categoria.grupo)&&!item.valor.isNegative())throw new ErroFatura("Receita só pode ser usada em créditos da fatura.");
        if(typeof n.descricao!=="string"||!n.descricao.trim()||n.descricao.length>500)throw new ErroFatura("Informe uma descrição de até 500 caracteres.");
        dataFinanceira(n.dataCompetencia);dataFinanceira(n.dataVencimento);
        item=await tx.itemFaturaCartao.update({where:{id:item.id},data:{categoriaId:n.categoriaId,fornecedorId:n.fornecedorId||null,centroCustoId:n.centroCustoId||categoria.centroCustoId,responsavelId:n.responsavelId||null,observacoes:n.observacoes?.trim()||null,revisado:true},include:incluirFatura.itens.include});
      }

      await criarDespesaItem(tx,f,item,autor.id,entrada.novo,entrada.motivoDuplicidade);
    } else {
      const escolhidos=entrada.lancamentos!;
      if(escolhidos.length>200||new Set(escolhidos.map(l=>l.id)).size!==escolhidos.length)throw new ErroFatura("Seleção de despesas inválida.");
      const idsTravados=[...new Set([...escolhidos.map(l=>l.id),...anteriores.map(l=>l.id)])].sort();
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(idsTravados)}) ORDER BY id FOR UPDATE`);
      const despesas=await tx.lancamentoFinanceiro.findMany({where:{id:{in:escolhidos.map(l=>l.id)}},include:{movimentacaoBancaria:true,vinculoExtrato:true}});
      const valorItem=item.valor;
      if(despesas.length!==escolhidos.length||despesas.some(l=>l.status!=="PENDENTE"||(valorItem.isNegative()?valorNaFatura(l)>=0:l.tipo!=="DESPESA"||!l.valor.isPositive())||l.pedidoVendaId||l.itemFaturaId||l.movimentacaoBancaria||l.vinculoExtrato||(l.cartaoCreditoId&&l.cartaoCreditoId!==f.cartaoId)||escolhidos.find(e=>e.id===l.id)?.versao!==l.updatedAt.toISOString()))throw new ErroFatura("Despesa alterada, já paga ou vinculada. Atualize e confira.");
      if(despesas.reduce((s,l)=>s+valorNaFatura(l),0)!==centavos(item.valor))throw new ErroFatura("A soma das despesas deve ser igual ao valor do item.");
      if(entrada.substituir){
        const idItem=item.id;
        const antigos=await tx.lancamentoFinanceiro.findMany({where:{id:{in:anteriores.map(l=>l.id)}},include:{movimentacaoBancaria:true,vinculoExtrato:true}});
        if(antigos.length!==anteriores.length||antigos.some(l=>l.itemFaturaId!==idItem||l.status==="CANCELADO"||l.pedidoVendaId||l.movimentacaoBancaria||l.vinculoExtrato))throw new ErroFatura("Vínculo anterior possui alteração ou baixa independente. Confira antes de substituir.");
        await tx.lancamentoFinanceiro.updateMany({where:{id:{in:antigos.map(l=>l.id)}},data:{itemFaturaId:null,status:"PENDENTE",dataPagamento:null}});
      }
      await tx.lancamentoFinanceiro.updateMany({where:{id:{in:despesas.map(l=>l.id)},itemFaturaId:null,status:"PENDENTE"},data:{itemFaturaId:item.id,cartaoCreditoId:f.cartaoId}});
    }
    await tx.itemFaturaCartao.update({where:{id:item.id},data:{revisado:true,estado:"VINCULADO"}});
    await liquidar(tx,faturaId);await atualizarResumo(tx,faturaId);
    await auditarFatura(tx,autor,entrada.substituir?"VINCULO_SUBSTITUIDO":entrada.criar?"DESPESA_CRIADA":"VINCULACAO",item.id,faturaId,entrada.substituir?anteriores:null,entrada,entrada.substituir?entrada.motivo:entrada.motivoDuplicidade);
    return {ok:true as const};
  },opcoes);
}

export async function selecionarExtratoFatura(faturaId:string,versao:number,transacaoId:string,sessao:SessaoAtual) {
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.cartoes-pagamentos","editar");
    if(!autor.pode("financeiro.conciliacao","editar"))throw new ErroFatura("Sem permissão de conciliação bancária.");
    const f=await faturaAtual(tx,faturaId,versao),r=resumir(f);
    const t=await tx.transacaoExtrato.findUnique({where:{id:transacaoId},include:{vinculos:true,pagamentoFatura:true,contaBancaria:true}});
    if(!t||t.conciliadaEm||t.vinculos.length||t.pagamentoFatura)throw new ErroFatura("Selecione uma saída pendente do extrato importado.");
    if(!t.contaBancaria.ativo||t.contaBancariaId!==f.cartao.contaBancariaId||centavos(t.valor)>=0||-centavos(t.valor)>r.pendente)throw new ErroFatura("Escolha uma saída da conta do cartão até o saldo pendente da fatura.");
    await tx.faturaCartao.update({where:{id:faturaId},data:{transacaoSelecionadaId:t.id,versao:{increment:1}}});
    await auditarFatura(tx,autor,"EXTRATO_SELECIONADO",faturaId,faturaId,{transacaoId:f.transacaoSelecionadaId},{transacaoId:t.id});
    return {ok:true as const};
  },opcoes);
}
// Completa despesas de faturas pagas no fluxo anterior, sem movimentar o banco novamente.
export async function concluirDespesasFatura(faturaId:string,versao:number,sessao:SessaoAtual) {
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","editar");
    if(!autor.pode("financeiro.movimentacoes","visualizar")||!autor.pode("financeiro.baixas","editar"))throw new ErroFatura("São necessárias permissões de consulta de movimentações e edição de baixas.");
    let f=await faturaAtual(tx,faturaId,versao);
    if(!f.pagamentos.length)throw new ErroFatura("Selecione e concilie o pagamento da fatura antes de concluir as despesas.");
    const ids=f.itens.filter(i=>!i.ignoradoEm).flatMap(i=>i.lancamentos.map(l=>l.id)).sort();
    if(ids.length)await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
    f=await tx.faturaCartao.findUniqueOrThrow({where:{id:faturaId},include:incluirFatura});
    const r=resumir(f);
    if(r.diferenca)throw new ErroFatura("Corrija a diferença entre o total e os itens antes de concluir.");
    if(r.pago<=0||r.pendente<0)throw new ErroFatura("Confira os pagamentos registrados antes de concluir as despesas.");
    if(f.itens.some(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.revisado))throw new ErroFatura("Classifique ou vincule todos os itens antes de concluir.");
    const pendencias=pendenciasCadastroFatura(f);
    if(pendencias.length)throw new ErroFatura(`Corrija a classificação pendente nas linhas ${pendencias.map(p=>p.linha).join(", ")} antes de concluir.`);
    for(const item of f.itens.filter(i=>!i.ignoradoEm&&i.lancamentos.length)){
      if(item.lancamentos.some(l=>l.status==="CANCELADO"||l.pedidoVendaId||l.cartaoCreditoId!==f.cartaoId)||item.lancamentos.reduce((s,l)=>s+valorNaFatura(l),0)!==centavos(item.valor))throw new ErroFatura(`Confira o vínculo da linha ${item.linha} antes de concluir.`);
    }
    const independentes=ids.length?await tx.lancamentoFinanceiro.count({where:{id:{in:ids},OR:[{movimentacaoBancaria:{isNot:null}},{vinculoExtrato:{isNot:null}}]}}):0;
    if(independentes)throw new ErroFatura("Há lançamentos com baixa bancária independente. Confira os vínculos antes de concluir.");
    if(!r.pendencias)return {ok:true as const};
    const faltantes=f.itens.filter(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.lancamentos.length);
    if(faltantes.length&&!autor.pode("financeiro.movimentacoes","adicionar"))throw new ErroFatura("Sem permissão para criar os lançamentos restantes.");
    for(const item of faltantes){
      await criarDespesaItem(tx,f,item,autor.id);
      await tx.itemFaturaCartao.update({where:{id:item.id},data:{estado:"VINCULADO"}});
      await auditarFatura(tx,autor,"DESPESA_CRIADA",item.id,faturaId,null,{origem:"PAGAMENTO_EXISTENTE"});
    }
    if(resumir(await tx.faturaCartao.findUniqueOrThrow({where:{id:faturaId},include:incluirFatura})).pendencias)throw new ErroFatura("Revise os vínculos dos itens antes de concluir.");
    await liquidar(tx,faturaId);
    const depois=await atualizarResumo(tx,faturaId);
    await auditarFatura(tx,autor,"DESPESAS_CONCLUIDAS",faturaId,faturaId,{estado:r.estado,pendencias:r.pendencias},{estado:depois.estado,despesasCriadas:faltantes.length,pagamentos:f.pagamentos.map(p=>p.id)});
    return {ok:true as const};
  },opcoes);
}
export async function conciliarFatura(faturaId:string,versao:number,transacaoId:string,sessao:SessaoAtual,tipoPagamento:"INTEGRAL"|"PARCIAL"="INTEGRAL") {
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.cartoes-pagamentos","editar");
    if(!autor.pode("financeiro.conciliacao","editar")||!autor.pode("financeiro.baixas","editar"))throw new ErroFatura("São necessárias permissões de conciliação bancária e baixas.");
    const f=await faturaAtual(tx,faturaId,versao),r=resumir(f);
    if(f.transacaoSelecionadaId!==transacaoId)throw new ErroFatura("Selecione a saída do extrato antes de finalizar.");
    if(f.itens.some(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.revisado))throw new ErroFatura("Classifique ou vincule todos os itens antes de finalizar.");
    const pendencias=pendenciasCadastroFatura(f);
    if(pendencias.length)throw new ErroFatura(`Corrija a classificação pendente nas linhas ${pendencias.map(p=>p.linha).join(", ")} antes de finalizar.`);
    await tx.$queryRaw`SELECT id FROM "TransacaoExtrato" WHERE id = ${transacaoId} FOR UPDATE`;
    const t=await tx.transacaoExtrato.findUnique({where:{id:transacaoId},include:{vinculos:true,pagamentoFatura:true,contaBancaria:true}});
    if(!t||t.conciliadaEm||t.vinculos.length||t.pagamentoFatura)throw new ErroFatura("Pagamento de fatura ausente ou já conciliado.");
    if(!t.contaBancaria.ativo||t.contaBancariaId!==f.cartao.contaBancariaId)throw new ErroFatura("Use a conta de pagamento configurada no cartão.");
    const valor=-centavos(t.valor);
    if(valor<=0||valor>r.pendente)throw new ErroFatura("O pagamento deve ser uma saída bancária até o saldo pendente da fatura.");
    if(r.diferenca)throw new ErroFatura("Corrija a diferença entre o total e os itens antes de conciliar.");
    if(tipoPagamento!=="INTEGRAL"&&tipoPagamento!=="PARCIAL")throw new ErroFatura("Tipo de pagamento inválido.");
    if(tipoPagamento==="INTEGRAL"&&valor!==r.pendente)throw new ErroFatura("A saída selecionada não quita o saldo da fatura. Escolha a saída integral ou confirme explicitamente um pagamento parcial.");
    if(tipoPagamento==="PARCIAL"&&valor===r.pendente)throw new ErroFatura("A saída quita o saldo integral. Atualize e confirme a baixa integral.");
    const faltantes=f.itens.filter(i=>!i.ignoradoEm&&!i.compensadoComId&&!i.lancamentos.length);
    if(faltantes.length&&(!autor.pode("financeiro.movimentacoes","adicionar")||!autor.pode("financeiro.movimentacoes","visualizar")||!autor.pode("financeiro.faturas","editar")))throw new ErroFatura("Sem permissão para criar e vincular os lançamentos restantes.");
    for(const item of faltantes){
      await criarDespesaItem(tx,f,item,autor.id);
      await tx.itemFaturaCartao.update({where:{id:item.id},data:{estado:"VINCULADO"}});
      await auditarFatura(tx,autor,"DESPESA_CRIADA",item.id,faturaId,null,{origem:"FINALIZACAO"});
    }
    if(resumir(await tx.faturaCartao.findUniqueOrThrow({where:{id:faturaId},include:incluirFatura})).pendencias)throw new ErroFatura("Revise os vínculos dos itens antes de finalizar.");
    const movimento=await tx.movimentacaoBancaria.create({data:{contaBancariaId:t.contaBancariaId,tipo:"SAIDA",valor:decimal(valor),data:dataFinanceira(t.data.toISOString().slice(0,10)),descricao:`PAGAMENTO FATURA ${f.cartao.nome} ${f.competencia}`}});
    const pagamento=await tx.pagamentoFaturaCartao.create({data:{faturaId,transacaoId:t.id,movimentoId:movimento.id,valor:decimal(valor),data:t.data,contaIdOriginal:t.contaBancariaId,transacaoIdOriginal:t.id,autorId:autor.id,autorNome:autor.nome}});
    await tx.transacaoExtrato.update({where:{id:t.id},data:{conciliadaEm:new Date(),conciliadaPorNome:autor.nome}});
    await tx.faturaCartao.update({where:{id:faturaId},data:{transacaoSelecionadaId:null}});
    await liquidar(tx,faturaId);await atualizarResumo(tx,faturaId);
    await auditarFatura(tx,autor,"CONCILIACAO",pagamento.id,faturaId,null,{transacaoId:t.id,movimentoId:movimento.id,valor:decimal(valor),tipoPagamento,saldoAntes:r.pendente,saldoDepois:r.pendente-valor,despesasCriadas:faltantes.length});
    await tx.historicoConciliacao.create({data:{transacaoId:t.id,acao:"FATURA_CARTAO",autorId:autor.id,autorNome:autor.nome,detalhes:{faturaId,pagamentoId:pagamento.id,valor:decimal(valor)}}});
    return {ok:true as const};
  },opcoes);
}
export async function desconciliarFatura(faturaId:string,versao:number,pagamentoId:string,motivo:string,sessao:SessaoAtual) {
  justificar(motivo);
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.cartoes-pagamentos","excluir");
    if(!autor.pode("financeiro.conciliacao","excluir")||!autor.pode("financeiro.baixas","editar"))throw new ErroFatura("Sem permissão para desfazer conciliação e baixa.");
    const f=await faturaAtual(tx,faturaId,versao),p=f.pagamentos.find(p=>p.id===pagamentoId);
    if(!p?.transacaoId||!p.movimentoId)throw new ErroFatura("Pagamento ausente ou já revertido.");
    await tx.$queryRaw`SELECT id FROM "TransacaoExtrato" WHERE id = ${p.transacaoId} FOR UPDATE`;
    // Conserva pagamento/alocações históricas; exclui somente o movimento gerado por esta baixa.
    await tx.pagamentoFaturaCartao.update({where:{id:p.id},data:{revertidoEm:new Date(),transacaoId:null,movimentoId:null}});
    await tx.movimentacaoBancaria.delete({where:{id:p.movimentoId}});
    await tx.transacaoExtrato.update({where:{id:p.transacaoId},data:{conciliadaEm:null,conciliadaPorNome:null}});
    await liquidar(tx,faturaId);await atualizarResumo(tx,faturaId);
    await auditarFatura(tx,autor,"DESCONCILIACAO",p.id,faturaId,p,{revertido:true},motivo);
    await tx.historicoConciliacao.create({data:{transacaoId:p.transacaoId,acao:"DESCONCILIACAO_FATURA",autorId:autor.id,autorNome:autor.nome,motivo,detalhes:{faturaId,pagamentoId:p.id}}});
    return {ok:true as const};
  },opcoes);
}

export async function ajustarItem(faturaId:string,versao:number,itemId:string,operacao:"DESVINCULAR"|"IGNORAR"|"RESTAURAR"|"VALOR"|"ESTORNO",motivo:string,valor:string|null,sessao:SessaoAtual) {
  justificar(motivo);
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas",operacao==="IGNORAR"?"excluir":"editar");
    const f=await faturaAtual(tx,faturaId,versao),item=f.itens.find(i=>i.id===itemId);
    if(!item)throw new ErroFatura("Item não encontrado.");
    if(item.compensadoComId)throw new ErroFatura("Desfaça a compensação antes de ajustar este item.");
    if(f.pagamentos.length)throw new ErroFatura("Desfaça os pagamentos antes de modificar vínculos ou valores.");
    if(operacao==="DESVINCULAR") {
      await tx.lancamentoFinanceiro.updateMany({where:{itemFaturaId:itemId},data:{itemFaturaId:null}});
      await tx.itemFaturaCartao.update({where:{id:itemId},data:{estado:"REVISAR"}});
    } else {
      if(item.lancamentos.length)throw new ErroFatura("Desvincule os lançamentos primeiro; eles serão preservados.");
      if(operacao==="IGNORAR"||operacao==="RESTAURAR")await tx.itemFaturaCartao.update({where:{id:itemId},data:{ignoradoEm:operacao==="IGNORAR"?new Date():null,estado:"REVISAR",revisado:false}});
      else if(operacao==="VALOR") {const quantia=dinheiro(valor??"");if(!quantia)throw new ErroFatura("Valor não pode ser zero.");await tx.itemFaturaCartao.update({where:{id:itemId},data:{valor:decimal(quantia),revisado:false,estado:"REVISAR"}});}
      else if(operacao==="ESTORNO") {
        const original=await tx.itemFaturaCartao.findFirst({where:{id:valor??"",fatura:{cartaoId:f.cartaoId,canceladaEm:null},ignoradoEm:null,compensadoComId:null,valor:{gt:0}}});
        if(!original||centavos(item.valor)>=0||Math.abs(centavos(item.valor))>centavos(original.valor))throw new ErroFatura("Selecione uma compra positiva compatível com o crédito.");
        const anteriores=await tx.itemFaturaCartao.aggregate({where:{estornoDeId:original.id,id:{not:item.id},ignoradoEm:null,fatura:{canceladaEm:null}},_sum:{valor:true}});
        if(Math.abs(centavos(anteriores._sum.valor??new Prisma.Decimal(0))+centavos(item.valor))>centavos(original.valor))throw new ErroFatura("Estornos acumulados excedem a compra original.");
        await tx.itemFaturaCartao.update({where:{id:item.id},data:{estornoDeId:original.id,categoriaId:original.categoriaId,fornecedorId:original.fornecedorId,centroCustoId:original.centroCustoId,tipo:"ESTORNO",estado:"REVISAR",revisado:false}});
      } else throw new ErroFatura("Operação desconhecida.");
    }
    await atualizarResumo(tx,faturaId);await auditarFatura(tx,autor,operacao,item.id,faturaId,{valor:item.valor,ignoradoEm:item.ignoradoEm,lancamentos:item.lancamentos.map(l=>l.id),estornoDeId:item.estornoDeId},{valor},motivo);
    return {ok:true as const};
  },opcoes);
}
export async function cancelarFatura(faturaId:string,versao:number,motivo:string,restaurar:boolean,sessao:SessaoAtual) {
  justificar(motivo);
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","excluir");
    const f=await tx.faturaCartao.findUnique({where:{id:faturaId},include:incluirFatura});
    if(!f||f.versao!==versao)throw new ErroFatura("Fatura alterada ou inexistente.");
    if(f.pagamentos.length||f.itens.some(i=>i.lancamentos.length))throw new ErroFatura("Desfaça pagamentos e desvincule os itens antes de cancelar. As despesas serão preservadas.");
    await tx.faturaCartao.update({where:{id:f.id},data:{canceladaEm:restaurar?null:new Date(),estado:restaurar?"REVISAO":"CANCELADA",versao:{increment:1}}});
    await auditarFatura(tx,autor,restaurar?"RESTAURACAO":"CANCELAMENTO",f.id,f.id,{canceladaEm:f.canceladaEm},{restaurar},motivo);
    return {ok:true as const};
  },opcoes);
}

// Não cria título, baixa ou movimento: os valores originais seguem no total.
export async function compensarItensFatura(faturaId:string,versao:number,itemId:string,outroId:string,motivo:string,sessao:SessaoAtual) {
  motivo=justificar(motivo);
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","editar");
    const f=await faturaAtual(tx,faturaId,versao);
    if(f.pagamentos.length&&!autor.pode("financeiro.baixas","editar"))throw new ErroFatura("Sem permissão para revisar uma fatura com pagamento.");
    const item=f.itens.find(i=>i.id===itemId),outro=f.itens.find(i=>i.id===outroId);
    if(!item||!outro)throw new ErroFatura("Selecione dois itens da mesma fatura.");
    compensacoesFatura(f);
    if(item.compensadoComId===outro.id&&outro.compensadoComId===item.id)return {ok:true as const};
    if(!parCompensavel(itemCompensavel(item),itemCompensavel(outro)))throw new ErroFatura("Selecione uma cobrança e um crédito da mesma data, com valores iguais, sem vínculo ou compensação anterior.");
    const positivos=[item,outro].filter(i=>i.valor.isPositive()).map(i=>i.id);
    if(await tx.itemFaturaCartao.count({where:{estornoDeId:{in:positivos},id:{notIn:[item.id,outro.id]},ignoradoEm:null,fatura:{canceladaEm:null}}}))throw new ErroFatura("A cobrança já possui outro estorno vinculado. Confira os itens antes de compensar.");
    for(const [a,b] of [[item,outro],[outro,item]])await tx.itemFaturaCartao.update({where:{id:a.id},data:{compensadoComId:b.id,estado:"COMPENSADO",revisado:true}});
    await liquidar(tx,faturaId);await atualizarResumo(tx,faturaId);
    await auditarFatura(tx,autor,"ITENS_COMPENSADOS",item.id,faturaId,{itens:[item,outro].map(i=>({id:i.id,estado:i.estado,revisado:i.revisado}))},{itens:[item.id,outro.id],data:item.dataCompra.toISOString().slice(0,10),valores:[centavos(item.valor),centavos(outro.valor)],saldo:0},motivo);
    return {ok:true as const};
  },opcoes);
}
export async function desfazerCompensacaoFatura(faturaId:string,versao:number,itemId:string,motivo:string,sessao:SessaoAtual) {
  motivo=justificar(motivo);
  return prisma.$transaction(async tx=>{
    const autor=await autorFatura(tx,sessao,"financeiro.faturas","editar");
    const f=await faturaAtual(tx,faturaId,versao);
    if(f.pagamentos.length&&!autor.pode("financeiro.baixas","editar"))throw new ErroFatura("Sem permissão para revisar uma fatura com pagamento.");
    const item=f.itens.find(i=>i.id===itemId),outro=f.itens.find(i=>i.id===item?.compensadoComId);
    if(!item||!outro||outro.compensadoComId!==item.id)throw new ErroFatura("Compensação não encontrada. Atualize a fatura.");
    await tx.itemFaturaCartao.updateMany({where:{id:{in:[item.id,outro.id]},faturaId},data:{compensadoComId:null,estado:"REVISAR",revisado:false}});
    await atualizarResumo(tx,faturaId);
    await auditarFatura(tx,autor,"COMPENSACAO_DESFEITA",item.id,faturaId,{itens:[item.id,outro.id],valores:[centavos(item.valor),centavos(outro.valor)]},{revisaoPendente:true},motivo);
    return {ok:true as const};
  },opcoes);
}
