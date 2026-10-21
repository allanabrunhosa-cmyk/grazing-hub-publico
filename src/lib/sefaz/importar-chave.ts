import { prisma } from "@/lib/prisma";
import { obterCnpjConsulta } from "./certificado";
import { consultarDocumentoPontual } from "./distribuicao";
import { guardarLote, aplicarLote } from "./lotes";
import { HORA, LIMITE_PONTUAIS } from "./recuperacao-regras";
import { validarXmlImportado } from "./validar-importacao";

export async function importarPelaChave(chave: string): Promise<{mensagem:string}|{erro:string}> {
  const existente = await prisma.notaFiscalRecebida.findUnique({where:{chaveAcesso:chave}});
  if (existente?.xml) return {mensagem:"Esta nota já tem XML completo. Abra Ver nota para conferir."};
  const cnpj = await obterCnpjConsulta();
  await prisma.sefazDistribuicaoEstado.upsert({where:{cnpj},create:{cnpj},update:{}});
  return prisma.$transaction(async trava => {
    const [lock] = await trava.$queryRaw<{obtida:boolean}[]>`SELECT pg_try_advisory_xact_lock(hashtext('distribuicao-sefaz'), hashtext(${cnpj})) AS obtida`;
    if (!lock.obtida) return {erro:"Há uma busca de notas em andamento. Aguarde sua conclusão."};
    const estado = await prisma.sefazDistribuicaoEstado.findUniqueOrThrow({where:{cnpj}});
    if (estado.bloqueadoAte && estado.bloqueadoAte.getTime() > Date.now()) return {erro:"A SEFAZ está em intervalo de espera. Tente após " + estado.bloqueadoAte.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}) + " (Brasília)."};
    const recente = await prisma.sefazLoteRecebido.findFirst({where:{cnpj,tipoConsulta:"CHAVE",referencia:chave,recebidoEm:{gt:new Date(Date.now()-HORA)}}});
    if (recente) { if (!recente.processadoEm) await aplicarLote(recente.id); return {mensagem:"Esta chave já foi consultada recentemente. Confira a lista; se o XML ainda não estiver disponível, aguarde uma hora ou importe o arquivo XML."}; }
    const usadas = await prisma.sefazConsultaPontual.count({where:{cnpj,criadaEm:{gt:new Date(Date.now()-HORA)}}});
    if (usadas >= LIMITE_PONTUAIS) return {erro:"Limite local de consultas por hora atingido. Aguarde ou importe o arquivo XML."};
    await prisma.sefazConsultaPontual.create({data:{cnpj}});
    try {
      const resposta = await consultarDocumentoPontual(cnpj,"CHAVE",chave);
      for (const doc of resposta.documentos) if (doc.schema.startsWith("procNFe")) validarXmlImportado(doc.xml,chave,cnpj);
      const loteId = await guardarLote(cnpj,"CHAVE",chave,resposta);
      await aplicarLote(loteId);
      const nota = await prisma.notaFiscalRecebida.findUnique({where:{chaveAcesso:chave}});
      if (nota?.xml) return {mensagem:"Nota importada pela chave. Abra Ver nota para conferir os itens e decidir o aceite."};
      if (nota) return {mensagem:"Resumo da nota localizado. O XML completo ainda depende de liberação pela SEFAZ; você também pode importar o arquivo XML."};
      return {erro:resposta.cStat === "137" ? "A SEFAZ não disponibilizou esta nota. Confira a chave e a janela de até 90 dias; solicite o XML ao fornecedor se necessário." : "A SEFAZ não disponibilizou o XML nesta consulta (código " + resposta.cStat + "). Confira a chave ou importe o arquivo XML."};
    } catch {
      await prisma.sefazDistribuicaoEstado.update({where:{cnpj},data:{bloqueadoAte:new Date(Date.now()+HORA),ultimoMotivo:"Consulta manual por chave sem conclusão confirmada."}});
      return {erro:"Não foi possível concluir a consulta. Aguarde uma hora antes de repetir ou importe o arquivo XML."};
    }
  },{timeout:90000,maxWait:5000});
}
