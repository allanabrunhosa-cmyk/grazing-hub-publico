import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { RespostaDistribuicao } from "./distribuicao";
import { extrairDadosDocumento } from "./parseNFe";
import { encontrarLacunas, formatarNsu, nsuValido, HORA } from "./recuperacao-regras";

export type TipoConsulta = "DISTRIBUICAO" | "NSU" | "CHAVE";

// O diário sobrevive a falhas na gravação das notas. O cursor e os documentos
// são confirmados juntos; uma resposta já recebida pode ser reaplicada sem rede.
export async function guardarLote(cnpj: string, tipoConsulta: TipoConsulta, referencia: string, resposta: RespostaDistribuicao) {
  const id = randomUUID();
  await prisma.sefazLoteRecebido.upsert({ where: { id }, update: {}, create: {
    id, cnpj, tipoConsulta, referencia, resposta: resposta as unknown as Prisma.InputJsonValue,
  } });
  return id;
}

export async function aplicarLote(id: string) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.sefazLoteRecebido.findUniqueOrThrow({ where: { id } });
    const contagem = { novos: 0, xmlRecuperados: 0, jaExistentes: 0, ignorados: 0 };
    if (lote.processadoEm) return contagem;
    const resposta = lote.resposta as unknown as RespostaDistribuicao;
    const estado = await tx.sefazDistribuicaoEstado.findUniqueOrThrow({ where: { cnpj: lote.cnpj } });
    const documentos = resposta.cStat === "138" ? resposta.documentos : [];
    for (const doc of documentos) {
      // consChNFe pode devolver o XML sem NSU (NT 2014.002, versão 1.15+).
      if (!(lote.tipoConsulta === "CHAVE" && doc.nsu === "") && !nsuValido(doc.nsu)) throw new Error("Documento com NSU inválido; lote preservado para investigação.");
      if (lote.tipoConsulta === "NSU" && doc.nsu !== lote.referencia) throw new Error("A resposta não corresponde ao NSU solicitado.");
      if (lote.tipoConsulta === "DISTRIBUICAO" && (doc.nsu <= lote.referencia || doc.nsu > resposta.ultNSU)) throw new Error("Documento fora do intervalo de distribuição solicitado.");
      const dados = extrairDadosDocumento(doc);
      if (lote.tipoConsulta === "CHAVE" && dados?.chaveAcesso !== lote.referencia) throw new Error("A resposta não corresponde à chave solicitada.");
      if (doc.nsu) await tx.sefazDocumentoRecebido.upsert({ where: { cnpj_nsu: { cnpj: lote.cnpj, nsu: doc.nsu } },
        create: { cnpj: lote.cnpj, ...doc }, update: {} });
      if (!dados) { contagem.ignorados++; continue; }
      const existente = await tx.notaFiscalRecebida.findUnique({ where: { chaveAcesso: dados.chaveAcesso } });
      if (!existente) {
        await tx.notaFiscalRecebida.create({ data: {
          chaveAcesso: dados.chaveAcesso, nsu: doc.nsu, tipo: dados.tipo, xml: dados.xmlCompleto,
          fornecedorCnpj: dados.fornecedorCnpj, fornecedorNome: dados.fornecedorNome,
          valorTotal: dados.valorTotal, dataEmissao: dados.dataEmissao,
        } });
        contagem.novos++;
      } else {
        contagem.jaExistentes++;
        if (!existente.xml && dados.xmlCompleto) {
          await tx.notaFiscalRecebida.update({ where: { id: existente.id }, data: {
            tipo: dados.tipo, xml: dados.xmlCompleto, nsu: doc.nsu || existente.nsu,
            xmlProximaTentativaEm: null, xmlUltimoMotivo: null,
          } });
          contagem.xmlRecuperados++;
        }
      }
    }
    let nsuConsulta = estado.nsuConsulta;
    if (lote.tipoConsulta === "DISTRIBUICAO" && ["138", "137", "656"].includes(resposta.cStat)
      && resposta.ultNSUPresente && nsuValido(resposta.ultNSU) && resposta.ultNSU > nsuConsulta) {
      const recebidos = await tx.sefazDocumentoRecebido.findMany({
        where: { cnpj: lote.cnpj, nsu: { gt: nsuConsulta, lte: resposta.ultNSU } }, select: { nsu: true },
      });
      for (const falta of encontrarLacunas(nsuConsulta, resposta.ultNSU, recebidos.map(d => d.nsu))) {
        await tx.sefazLacuna.upsert({ where: { cnpj_inicio_fim: { cnpj: lote.cnpj, ...falta } },
          create: { cnpj: lote.cnpj, ...falta, proximo: falta.inicio }, update: {} });
      }
      nsuConsulta = resposta.ultNSU;
    }
    if (resposta.cStat === "138" && lote.tipoConsulta === "DISTRIBUICAO"
      && (!resposta.ultNSUPresente || !nsuValido(resposta.ultNSU) || resposta.ultNSU < lote.referencia)) {
      throw new Error("Cursor ausente ou regressivo; lote preservado sem avançar a sequência.");
    }
    // Avança cada intervalo somente sobre documentos efetivamente armazenados.
    const lacunas = await tx.sefazLacuna.findMany({ where: { cnpj: lote.cnpj, concluidaEm: null } });
    for (const lacuna of lacunas) {
      const recebidos = await tx.sefazDocumentoRecebido.findMany({
        where: { cnpj: lote.cnpj, nsu: { gte: lacuna.proximo, lte: lacuna.fim } }, orderBy: { nsu: "asc" }, select: { nsu: true },
      });
      let proximo = BigInt(lacuna.proximo);
      for (const doc of recebidos) { if (BigInt(doc.nsu) !== proximo) break; proximo++; }
      if (proximo !== BigInt(lacuna.proximo)) await tx.sefazLacuna.update({ where: { id: lacuna.id }, data: {
        proximo: formatarNsu(proximo), concluidaEm: proximo > BigInt(lacuna.fim) ? new Date() : null,
        tentativas: 0, ultimoMotivo: null, proximaTentativaEm: new Date(),
      } });
    }
    const primeira = await tx.sefazLacuna.findFirst({ where: { cnpj: lote.cnpj, concluidaEm: null }, orderBy: { proximo: "asc" } });
    const cobertura = primeira ? formatarNsu(BigInt(primeira.proximo) - BigInt(1)) : nsuConsulta;
    const espera = resposta.cStat === "656" || (lote.tipoConsulta === "DISTRIBUICAO" && resposta.cStat === "137")
      || (lote.tipoConsulta === "DISTRIBUICAO" && resposta.cStat === "138" && nsuValido(resposta.maxNSU) && nsuConsulta >= resposta.maxNSU);
    const bloqueadoAte = espera ? new Date(lote.recebidoEm.getTime() + HORA) : estado.bloqueadoAte;
    await tx.sefazDistribuicaoEstado.update({ where: { cnpj: lote.cnpj }, data: {
      nsuConsulta, ultNSU: cobertura > estado.ultNSU ? cobertura : estado.ultNSU,
      bloqueadoAte: estado.bloqueadoAte && bloqueadoAte && estado.bloqueadoAte > bloqueadoAte ? estado.bloqueadoAte : bloqueadoAte,
      ultimoCStat: resposta.cStat, ultimoMotivo: resposta.xMotivo, ultimaRespostaXml: resposta.envelopeXmlBruto,
      ultNSUResposta: resposta.ultNSUPresente ? resposta.ultNSU : null, maxNSUResposta: resposta.maxNSU,
    } });
    await tx.sefazLoteRecebido.update({ where: { id }, data: { processadoEm: new Date(), erro: null } });
    return contagem;
  }, { timeout: 30_000 });
}
