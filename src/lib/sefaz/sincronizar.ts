import { prisma } from "@/lib/prisma";
import { obterCnpjConsulta } from "./certificado";
import { consultarDistribuicao, consultarDocumentoPontual, RespostaSefazInesperada } from "./distribuicao";
import { registrarCienciasPendentes } from "./ciencia-automatica";
import { aplicarLote, guardarLote, type TipoConsulta } from "./lotes";
import { HORA, LIMITE_PONTUAIS } from "./recuperacao-regras";

export type ResumoSincronizacao = {
  cienciasRegistradas: number; falhasCiencia: string[]; xmlRecuperados: number;
  novos: number; jaExistentes: number; ignorados: number; lotesConsultados: number;
  motivoParada: "LIMITE_LOTES" | "SEM_NOVIDADE" | "BLOQUEIO" | "CONCLUIDO_SEM_NOVIDADE" | "ERRO";
  cStatFinal: string; xMotivoFinal: string;
  notasNovas: { fornecedorNome: string | null; valorTotal: number | null; dataEmissao: Date | null }[];
};

export async function sincronizarDistribuicaoNFe(maxLotes = 3): Promise<ResumoSincronizacao> {
  const cnpj = await obterCnpjConsulta();
  const resumo: ResumoSincronizacao = {
    cienciasRegistradas: 0, falhasCiencia: [], xmlRecuperados: 0, novos: 0,
    jaExistentes: 0, ignorados: 0, lotesConsultados: 0, motivoParada: "CONCLUIDO_SEM_NOVIDADE",
    cStatFinal: "", xMotivoFinal: "", notasNovas: [],
  };
  await prisma.sefazDistribuicaoEstado.upsert({ where: { cnpj }, create: { cnpj }, update: {} });
  // A conexão que segura esta trava não processa os lotes. Cada lote tem sua
  // própria transação curta, durável mesmo se o processo cair depois da resposta.
  return prisma.$transaction(async (trava) => {
    const [lock] = await trava.$queryRaw<{ obtida: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtext('distribuicao-sefaz'), hashtext(${cnpj})) AS obtida
    `;
    if (!lock.obtida) return { ...resumo, motivoParada: "BLOQUEIO", xMotivoFinal: "Uma busca já está em andamento." };
    const inicio = Date.now();
    const estadoAtual = () => prisma.sefazDistribuicaoEstado.findUniqueOrThrow({ where: { cnpj } });
    const somar = (r: { novos: number; xmlRecuperados: number; jaExistentes: number; ignorados: number }) => {
      resumo.novos += r.novos; resumo.xmlRecuperados += r.xmlRecuperados;
      resumo.jaExistentes += r.jaExistentes; resumo.ignorados += r.ignorados;
    };
    let pendenciaRede = false;
    async function podeConsultar() {
      const estado = await estadoAtual();
      if (estado.bloqueadoAte && estado.bloqueadoAte.getTime() > Date.now()) {
        pendenciaRede = true;
        resumo.motivoParada = "BLOQUEIO";
        resumo.xMotivoFinal = `Próxima consulta permitida após ${estado.bloqueadoAte.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília).`;
        resumo.cStatFinal = estado.ultimoCStat ?? "";
        return false;
      }
      if (Date.now() - inicio >= 150_000) { pendenciaRede = true; return false; }
      return true;
    }
    async function consultar(tipo: TipoConsulta, referencia: string) {
      if (!(await podeConsultar())) return null;
      if (tipo !== "DISTRIBUICAO") {
        const usadas = await prisma.sefazConsultaPontual.count({ where: { cnpj, criadaEm: { gt: new Date(Date.now() - HORA) } } });
        if (usadas >= LIMITE_PONTUAIS) { pendenciaRede = true; return null; }
        // Reserva também em caso de timeout: a SEFAZ pode ter recebido a chamada.
        await prisma.sefazConsultaPontual.create({ data: { cnpj } });
      }
      const resposta = tipo === "DISTRIBUICAO" ? await consultarDistribuicao(cnpj, referencia)
        : await consultarDocumentoPontual(cnpj, tipo, referencia);
      const id = await guardarLote(cnpj, tipo, referencia, resposta);
      try { somar(await aplicarLote(id)); }
      catch (erro) {
        await prisma.sefazLoteRecebido.update({ where: { id }, data: { erro: erro instanceof Error ? erro.message : "Falha no processamento." } });
        throw erro;
      }
      resumo.cStatFinal = resposta.cStat; resumo.xMotivoFinal = resposta.xMotivo;
      if (tipo === "DISTRIBUICAO" && !["137", "138", "656"].includes(resposta.cStat)) resumo.motivoParada = "ERRO";
      return resposta;
    }
    await prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: { emConsulta: true, ultimaExecucaoEm: new Date() } });
    try {
      const lotes = await prisma.sefazLoteRecebido.findMany({ where: { cnpj, processadoEm: null }, orderBy: { recebidoEm: "asc" } });
      for (const lote of lotes) somar(await aplicarLote(lote.id));
      if (!(await podeConsultar())) return resumo;

      // Reconhece respostas 573 antigas sem reenviar o evento nem inventar protocolo.
      await prisma.notaFiscalRecebida.updateMany({ where: {
        cienciaJaExistenteEm: null, manifestacoes: { some: { tipo: "CIENCIA_DA_OPERACAO", cStat: "573" } },
      }, data: { cienciaJaExistenteEm: new Date() } });
      const ciencias = await registrarCienciasPendentes(1);
      resumo.cienciasRegistradas += ciencias.registradas;
      resumo.falhasCiencia.push(...ciencias.falhas);

      // Até três XMLs conhecidos por rodada; ordenação evita repetir sempre a mesma nota.
      const notas = await prisma.notaFiscalRecebida.findMany({ where: {
        xml: null, OR: [{ xmlProximaTentativaEm: null }, { xmlProximaTentativaEm: { lte: new Date() } }],
      }, orderBy: [{ xmlTentativas: "asc" }, { createdAt: "asc" }], take: 3 });
      for (const nota of notas) {
        const resposta = await consultar("CHAVE", nota.chaveAcesso);
        if (!resposta) break;
        await prisma.notaFiscalRecebida.updateMany({ where: { id: nota.id, xml: null }, data: {
          xmlTentativas: { increment: 1 }, xmlUltimoMotivo: `${resposta.cStat} — ${resposta.xMotivo}`,
          xmlProximaTentativaEm: new Date(Date.now() + Math.min(24, 2 ** Math.min(nota.xmlTentativas, 5)) * HORA),
        } });
        if (resposta.cStat === "656") break;
      }
      for (let tentativa = 0; tentativa < 6; tentativa++) {
        const lacuna = await prisma.sefazLacuna.findFirst({ where: { cnpj, concluidaEm: null, proximaTentativaEm: { lte: new Date() } },
        orderBy: [{ tentativas: "asc" }, { proximaTentativaEm: "asc" }] });
        if (!lacuna) break;
        const resposta = await consultar("NSU", lacuna.proximo);
        if (!resposta) break;
        await prisma.sefazLacuna.updateMany({ where: { id: lacuna.id, proximo: lacuna.proximo, concluidaEm: null }, data: {
          tentativas: { increment: 1 }, ultimoMotivo: `${resposta.cStat} — ${resposta.xMotivo}`,
          proximaTentativaEm: new Date(Date.now() + Math.min(24, 2 ** Math.min(lacuna.tentativas, 5)) * HORA),
        } });
        if (resposta.cStat === "656") break;
      }
      for (let lote = 0; lote < maxLotes; lote++) {
        const resposta = await consultar("DISTRIBUICAO", (await estadoAtual()).nsuConsulta);
        if (!resposta) break;
        resumo.lotesConsultados++;
        if (resposta.cStat !== "138" || resposta.ultNSU >= resposta.maxNSU) break;
        pendenciaRede = true;
        resumo.motivoParada = "LIMITE_LOTES";
        await new Promise(resolve => setTimeout(resolve, 2_000));
      }
      return resumo;
    } catch (erro) {
      resumo.motivoParada = "ERRO";
      resumo.xMotivoFinal = erro instanceof Error ? erro.message : "Falha ao consultar a SEFAZ.";
      // Uma falha de transporte tem resultado remoto incerto; esperar evita uso indevido.
      await prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: {
        ultimoMotivo: resumo.xMotivoFinal, bloqueadoAte: new Date(Date.now() + HORA),
        ...(erro instanceof RespostaSefazInesperada ? { ultimaRespostaXml: erro.envelopeXmlBruto } : {}),
      } });
      return resumo;
    } finally {
      const estado = await estadoAtual();
      const [xmlPendente, lacunaPendente] = await Promise.all([
        prisma.notaFiscalRecebida.findFirst({ where: { xml: null }, orderBy: { xmlProximaTentativaEm: { sort: "asc", nulls: "first" } }, select: { xmlProximaTentativaEm: true } }),
        prisma.sefazLacuna.findFirst({ where: { cnpj, concluidaEm: null }, orderBy: { proximaTentativaEm: "asc" }, select: { proximaTentativaEm: true } }),
      ]);
      const agora = Date.now();
      const datas = [xmlPendente ? (xmlPendente.xmlProximaTentativaEm?.getTime() ?? agora) : Infinity,
        lacunaPendente?.proximaTentativaEm.getTime() ?? Infinity,
        pendenciaRede || resumo.motivoParada === "ERRO" || resumo.cStatFinal === "656" ? agora + HORA : Infinity];
      const proxima = Math.min(...datas);
      await prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: {
        emConsulta: false, proximaBuscaEm: Number.isFinite(proxima) ? new Date(Math.max(proxima, agora + 5 * 60_000, estado.bloqueadoAte?.getTime() ?? 0)) : null,
        resultadoExecucao: `${resumo.novos} nota(s) nova(s), ${resumo.xmlRecuperados} XML(s) recuperado(s). ${resumo.xMotivoFinal}`,
      } });
    }
  }, { timeout: 480_000, maxWait: 5_000 });
}
