import { prisma } from "@/lib/prisma";
import type { TipoManifestacao } from "@/generated/prisma/client";
import { obterCnpjConsulta } from "@/lib/sefaz/certificado";
import { enviarManifestacao } from "@/lib/sefaz/evento";

export type ResultadoManifestarNota = {
  sucesso: boolean;
  mensagem: string;
  protocolo: string | null;
};

const CIENCIA_DA_OPERACAO: TipoManifestacao = "CIENCIA_DA_OPERACAO";

function mensagemEventoJaRegistrado() {
  return "573 — Evento já registrado anteriormente na SEFAZ. O status local foi recuperado.";
}

// Manifesta uma nota fiscal já recebida (por chave de acesso). Grava o resultado
// no histórico (ManifestacaoNFe) mesmo quando falha, e só atualiza o "cache"
// ultimaManifestacao quando a SEFAZ aceita (135/136) ou confirma, por 573, que
// o mesmo evento definitivo já havia sido registrado.
export async function manifestarNotaFiscal(
  chaveAcesso: string,
  tipo: TipoManifestacao,
  justificativa?: string
): Promise<ResultadoManifestarNota> {
  if (!["CONFIRMACAO_DA_OPERACAO", "CIENCIA_DA_OPERACAO", "DESCONHECIMENTO_DA_OPERACAO", "OPERACAO_NAO_REALIZADA"].includes(tipo)) {
    return { sucesso: false, mensagem: "Tipo de manifestação inválido.", protocolo: null };
  }
  if (tipo === "OPERACAO_NAO_REALIZADA") {
    const texto = (justificativa ?? "").trim();
    if (texto.length < 15) {
      return { sucesso: false, mensagem: "A justificativa precisa ter pelo menos 15 caracteres.", protocolo: null };
    }
    if (texto.length > 255) {
      return { sucesso: false, mensagem: "A justificativa deve ter no máximo 255 caracteres.", protocolo: null };
    }
    justificativa = texto;
  }

  const nota = await prisma.notaFiscalRecebida.findUnique({
    where: { chaveAcesso },
    include: { manifestacoes: true },
  });
  if (!nota) {
    return { sucesso: false, mensagem: "Nota fiscal não encontrada.", protocolo: null };
  }

  // A NT 2020.001 determina nSeqEvento=1 para todos os eventos de Manifestação
  // do Destinatário. O cStat 573 comprova que a mesma combinação de tipo, chave
  // e sequência já existe na SEFAZ, mesmo que tenha sido enviada por outro sistema.
  const duplicidadeAnterior = nota.manifestacoes.some(
    (manifestacao) => manifestacao.tipo === tipo && manifestacao.cStat === "573"
  );
  if (duplicidadeAnterior) {
    if (tipo === CIENCIA_DA_OPERACAO) {
      if (!nota.cienciaJaExistenteEm) {
        await prisma.notaFiscalRecebida.update({ where: { id: nota.id }, data: { cienciaJaExistenteEm: new Date() } });
      }
      return { sucesso: false, mensagem: mensagemEventoJaRegistrado(), protocolo: null };
    }
    if (nota.ultimaManifestacao !== tipo) {
      await prisma.notaFiscalRecebida.update({ where: { id: nota.id }, data: { ultimaManifestacao: tipo } });
    }
    return { sucesso: true, mensagem: mensagemEventoJaRegistrado(), protocolo: null };
  }

  let resultado: Awaited<ReturnType<typeof enviarManifestacao>>;
  try {
    const cnpj = await obterCnpjConsulta();
    resultado = await enviarManifestacao({
      cnpj,
      chaveAcesso,
      tipo,
      justificativa,
      nSeqEvento: 1,
    });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Erro desconhecido ao chamar a SEFAZ.";
    await prisma.manifestacaoNFe.create({
      data: { notaFiscalId: nota.id, tipo, justificativa, sucesso: false, xMotivo: mensagemErro },
    });
    return { sucesso: false, mensagem: mensagemErro, protocolo: null };
  }

  await prisma.manifestacaoNFe.create({
    data: {
      notaFiscalId: nota.id,
      tipo,
      justificativa,
      sucesso: resultado.sucesso,
      protocolo: resultado.protocolo,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
    },
  });

  const eventoDefinitivoJaRegistrado = tipo !== CIENCIA_DA_OPERACAO && resultado.cStat === "573";

  if (resultado.sucesso || eventoDefinitivoJaRegistrado) {
    await prisma.notaFiscalRecebida.update({
      where: { id: nota.id },
      data: { ultimaManifestacao: tipo },
    });
  }

  if (tipo === CIENCIA_DA_OPERACAO && resultado.cStat === "573") {
    await prisma.notaFiscalRecebida.update({ where: { id: nota.id }, data: { cienciaJaExistenteEm: new Date() } });
  }

  return {
    sucesso: resultado.sucesso || eventoDefinitivoJaRegistrado,
    mensagem: eventoDefinitivoJaRegistrado ? mensagemEventoJaRegistrado() : `${resultado.cStat} — ${resultado.xMotivo}`,
    protocolo: resultado.protocolo,
  };
}
