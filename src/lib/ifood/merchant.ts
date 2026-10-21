import { exigirComandoLoja, recepcaoPermitida } from "./acompanhamento";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { acessoIfood, exigirConta } from "./acesso";
import { requisicaoAutorizada } from "./tokens";
import { ErroIfood, objeto, uuid } from "./dominio";
import { FalhaHttpIfood } from "./cliente";

import { hashIfood } from "./processamento";
import { lerHorariosMerchant, lerPausasMerchant, validarTurnosMerchant, horarioCivilMerchant, instanteParaMerchant } from "./merchant-dominio";
import { lerDetalhesMerchant } from "./merchant-detalhes";
const json = (v:unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const abertos=["PENDENTE","ENVIANDO","INCERTA","AGUARDANDO_CONFERENCIA","INTERVENCAO"];
async function lojaMerchant(lojaId:string,sessao:SessaoAtual,escrita=false) {
  return prisma.$transaction(async tx=>{
    await acessoIfood(tx,sessao,"configuracoes.loja",true);
    const l=await tx.lojaIfood.findUniqueOrThrow({where:{id:lojaId},include:{integracao:true}});exigirConta(l.integracao.contaId);
    if (escrita) await exigirComandoLoja(tx, lojaId);
    if (!l.autorizada || !recepcaoPermitida(l)) throw new ErroIfood("Confira a autorização da loja e a liberação do ambiente.");
    if (escrita && (l.ambiente!=="TESTE" || !l.ativa || !l.integracao.ativo)) throw new ErroIfood("Alterações Merchant liberadas somente na loja de teste ativa nesta etapa.");
    return l;
  });
}
async function lerOperacao(loja:{integracaoId:string;merchantId:string}) {
  const raiz="/merchant/v1.0/merchants/"+loja.merchantId;
  const [pausas,horarios]=await Promise.all([requisicaoAutorizada(loja.integracaoId,raiz+"/interruptions"),requisicaoAutorizada(loja.integracaoId,raiz+"/opening-hours")]);
  return { pausas:lerPausasMerchant(pausas.dados),horarios:lerHorariosMerchant(horarios.dados,loja.merchantId) };
}
export async function consultarOperacaoMerchant(lojaId:string,sessao:SessaoAtual) {
  const l=await lojaMerchant(lojaId,sessao);
  const r=await lerOperacao(l);
  const acoes=await prisma.acaoMerchantIfood.findMany({where:{lojaId},orderBy:{createdAt:"desc"},take:15,select:{id:true,acao:true,estado:true,erro:true,createdAt:true}});
  const config=await prisma.configuracaoLoja.findUnique({where:{id:"singleton"},select:{fusoHorario:true}});
  return { fusoHorario:config?.fusoHorario??"America/Sao_Paulo", ...r,hashHorarios:hashIfood(r.horarios),consultadoEm:new Date().toISOString(),acoes:acoes.map(a=>({...a,createdAt:a.createdAt.toISOString()})) };
}
export async function consultarDetalhesMerchant(lojaId: string, sessao: SessaoAtual) {
  const loja = await lojaMerchant(lojaId, sessao);
  const resposta = await requisicaoAutorizada(loja.integracaoId, "/merchant/v1.0/merchants/" + loja.merchantId);
  if (resposta.status !== 200) throw new ErroIfood("Consulta de detalhes fora do contrato iFood.");
  const atual = await lojaMerchant(lojaId, sessao);
  if (atual.integracaoId !== loja.integracaoId || atual.merchantId !== loja.merchantId) throw new ErroIfood("Vínculo da loja mudou; consulte novamente.");
  const config = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
  return { detalhes: lerDetalhesMerchant(resposta.dados, loja.merchantId), consultadoEm: new Date().toISOString(), fusoHorario: config?.fusoHorario ?? "America/Sao_Paulo" };
}
export async function solicitarMerchant(lojaId:string,acao:string,entrada:unknown,chave:string,sessao:SessaoAtual) {
  uuid(chave);const l=await lojaMerchant(lojaId,sessao,true),e=objeto(entrada);
  if (acao==="CONFERIR") return prisma.$transaction(async tx=>{
    const autor=await acessoIfood(tx,sessao,"configuracoes.loja",true);
    const anterior=await tx.historicoCadastroVenda.findUnique({where:{id:chave}});
    if(anterior){if(anterior.registroId!==lojaId||objeto(anterior.depois).acaoId!==e.id)throw new ErroIfood("Chave usada com outro conteúdo.");return{id:String(e.id)};}
    const a=await tx.acaoMerchantIfood.findUniqueOrThrow({where:{id:String(e.id)}});
    if(a.lojaId!==lojaId||a.estado!=="INTERVENCAO")throw new ErroIfood("Conferência indisponível neste estado/loja.");
    await tx.acaoMerchantIfood.update({where:{id:a.id},data:{estado:"INCERTA",tentativas:0,proximaTentativa:new Date(),erro:"Conferência retomada pelo responsável; somente leituras oficiais, sem reenvio"}});
    await tx.historicoCadastroVenda.create({data:{id:chave,entidade:"IFOOD_MERCHANT",registroId:lojaId,usuarioId:autor.id,usuarioNome:autor.nome,depois:{acaoId:a.id,acao:"CONFERIR",reenviado:false}}});return{id:a.id};
  });
  if (!["PAUSAR","RETOMAR","HORARIOS"].includes(acao)) throw new ErroIfood("Operação Merchant inválida.");
  const hash=hashIfood({lojaId,acao,entrada});
  const existente=await prisma.acaoMerchantIfood.findUnique({where:{chave}});
  if (existente) {if(existente.hash!==hash||existente.lojaId!==lojaId)throw new ErroIfood("Chave usada com outro conteúdo.");return {id:existente.id};}
  const atual=await lerOperacao(l);let corpo:unknown;
  if (acao==="PAUSAR") {
    if (!Number.isSafeInteger(e.minutos)||Number(e.minutos)<1||Number(e.minutos)>60) throw new ErroIfood("Pausa de teste: informe de 1 a 60 minutos inteiros.");
    // Converter o relógio civil uma vez; Interruptions ignora o offset do payload.
    const inicio=new Date(Date.now()+5000),fim=new Date(inicio.getTime()+Number(e.minutos)*60000);
    const config=await prisma.configuracaoLoja.findUnique({where:{id:"singleton"},select:{fusoHorario:true}});
    const fuso=config?.fusoHorario??"America/Sao_Paulo";
    corpo={id:chave,description:"Teste operacional Grazing HUB",start:instanteParaMerchant(inicio,fuso),end:instanteParaMerchant(fim,fuso)};
  } else if (acao==="RETOMAR") {
    const id=uuid(e.id);if(!atual.pausas.some(p=>p.id===id))throw new ErroIfood("Pausa ausente na consulta oficial.");corpo={id};
  } else {
    if (e.hashHorarios!==hashIfood(atual.horarios)||atual.horarios.shifts.some(t=>!t.enabled)) throw new ErroIfood("Horários mudaram ou incluem turnos desativados. Consulte novamente antes de salvar.");
    corpo={storeId:l.merchantId,shifts:validarTurnosMerchant(e.shifts)};
  }
  return prisma.$transaction(async tx=>{
    const autor=await acessoIfood(tx,sessao,"configuracoes.loja",true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-merchant:"+lojaId}))`;
    const repetida=await tx.acaoMerchantIfood.findUnique({where:{chave}});
    if(repetida){if(repetida.hash!==hash)throw new ErroIfood("Chave usada com outro conteúdo.");return{id:repetida.id};}
    if(await tx.acaoMerchantIfood.count({where:{lojaId,estado:{in:abertos}}}))throw new ErroIfood("Existe uma operação Merchant pendente; confira seu resultado antes de outra.");
    const a=await tx.acaoMerchantIfood.create({data:{lojaId,chave,hash,acao,corpo:json(corpo),antes:json(atual),autorId:autor.id,sessaoVersao:sessao.versao??0}});
    await tx.historicoCadastroVenda.create({data:{entidade:"IFOOD_MERCHANT",registroId:lojaId,usuarioId:autor.id,usuarioNome:autor.nome,depois:{acaoId:a.id,acao,estado:"PENDENTE"}}});return{id:a.id};
  });
}
export async function processarMerchant() {
  if(process.env.IFOOD_ATIVO!=="1")return false;
  await prisma.acaoMerchantIfood.updateMany({where:{estado:"ENVIANDO",enviadaEm:{lt:new Date(Date.now()-120000)}},data:{estado:"INCERTA",erro:"Envio interrompido; conferir leitura oficial antes de qualquer novo envio"}});
  const a=await prisma.$transaction(async tx=>{
    const ids=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "AcaoMerchantIfood" WHERE estado IN ('PENDENTE','INCERTA','AGUARDANDO_CONFERENCIA') AND "proximaTentativa"<=(now() AT TIME ZONE 'UTC') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if(!ids.length)return null;
    const a=await tx.acaoMerchantIfood.findUniqueOrThrow({where:{id:ids[0].id}});
    await tx.acaoMerchantIfood.update({where:{id:a.id},data:{estado:"ENVIANDO",enviadaEm:a.enviadaEm??new Date(),tentativas:{increment:1}}});return a;
  });
  if(!a)return false;
  let enviando=false;
  try {
    const l=await lojaMerchant(a.lojaId,{userId:a.autorId,versao:a.sessaoVersao} as SessaoAtual,true);
    const corpo=objeto(a.corpo),antes=objeto(a.antes),atual=await lerOperacao(l),raiz="/merchant/v1.0/merchants/"+l.merchantId;
    const resultadoAnterior=a.resultado?objeto(a.resultado):{};
    let interrupcaoId=typeof resultadoAnterior.interrupcaoId==="string"?resultadoAnterior.interrupcaoId:null;
    const conferir=(r:Awaited<ReturnType<typeof lerOperacao>>) => {
      if(a.acao==="PAUSAR") {
        const criadas=r.pausas.filter(p=>(!interrupcaoId||p.id===interrupcaoId)&&!(Array.isArray(antes.pausas)&&antes.pausas.some(v=>objeto(v).id===p.id))&&p.description===corpo.description&&horarioCivilMerchant(p.start)===horarioCivilMerchant(corpo.start)&&horarioCivilMerchant(p.end)===horarioCivilMerchant(corpo.end));
        if(criadas.length!==1)return false;interrupcaoId=criadas[0].id;return true;
      }
      return a.acao==="RETOMAR" ? !r.pausas.some(p=>p.id===corpo.id) : r.horarios.shifts.every(t=>t.enabled)&&hashIfood(validarTurnosMerchant(r.horarios.shifts))===hashIfood(validarTurnosMerchant(corpo.shifts));
    };
    let confirmado=(a.estado!=="PENDENTE"||a.tentativas>0)&&conferir(atual);
    if(!confirmado&&a.estado==="PENDENTE") {
      if(a.acao==="HORARIOS"&&hashIfood(atual.horarios)!==hashIfood(lerHorariosMerchant(antes.horarios,l.merchantId)))throw new ErroIfood("Horários alterados externamente antes do envio; nenhuma substituição realizada.");
      await lojaMerchant(a.lojaId,{userId:a.autorId,versao:a.sessaoVersao} as SessaoAtual,true);
      enviando=true;
      const r=await requisicaoAutorizada(l.integracaoId,raiz+(a.acao==="HORARIOS"?"/opening-hours":a.acao==="RETOMAR"?"/interruptions/"+uuid(corpo.id):"/interruptions"),{metodo:a.acao==="HORARIOS"?"PUT":a.acao==="RETOMAR"?"DELETE":"POST",...(a.acao!=="RETOMAR"?{corpo}: {})});
      if(r.status!==(a.acao==="RETOMAR"?204:201))throw new FalhaHttpIfood(0);
      if(a.acao==="PAUSAR")interrupcaoId=uuid(objeto(r.dados).id);
      await prisma.acaoMerchantIfood.update({where:{id:a.id},data:{resultado:json({httpAceite:r.status,interrupcaoId})}});
      confirmado=conferir(await lerOperacao(l));
    }
    await prisma.$transaction(async tx=>{
      await tx.acaoMerchantIfood.update({where:{id:a.id},data:{estado:confirmado?"CONFIRMADA":a.tentativas>=5?"INTERVENCAO":a.estado==="PENDENTE"?"AGUARDANDO_CONFERENCIA":"INCERTA",resultado:json({conferidoEm:new Date().toISOString(),observado:confirmado,interrupcaoId}),erro:confirmado?null:"Resultado ainda não comprovado na consulta oficial; não reenviado",proximaTentativa:new Date(Date.now()+Math.min(300000,30000*2**Math.min(a.tentativas,4)))}});
      if(confirmado)await tx.historicoCadastroVenda.create({data:{entidade:"IFOOD_MERCHANT",registroId:l.id,usuarioId:a.autorId,usuarioNome:"Integração iFood",depois:{acaoId:a.id,acao:a.acao,estado:"CONFIRMADA",evidencia:"Leitura oficial de pausas/horários"}}});
    });
  } catch(e) {
    const http=e instanceof FalhaHttpIfood,incerta=a.estado!=="PENDENTE"||enviando&&(!http||e.status===0||e.status>=500),repetir=http&&e.status===429&&a.tentativas<4;
    await prisma.acaoMerchantIfood.update({where:{id:a.id},data:{estado:incerta?(a.tentativas>=5?"INTERVENCAO":"INCERTA"):repetir?"PENDENTE":"RECUSADA",erro:e instanceof ErroIfood?e.message:"Falha local; conferir operação Merchant",proximaTentativa:new Date(Date.now()+(http?e.esperaMs:30000))}});
    if(http&&[401,403].includes(e.status))await prisma.lojaIfood.update({where:{id:a.lojaId},data:{autorizada:false,ultimoErro:e.message}});
  }
  return true;
}
