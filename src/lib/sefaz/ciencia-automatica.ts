import { prisma } from "@/lib/prisma";
import { manifestarNotaFiscal } from "@/lib/sefaz/manifestar";

// Autorização de Allan em 2026-09-10: Ciência ao buscar notas sem XML.
// Executada sob a trava de distribuição do CNPJ nas buscas manuais e diárias.
export async function registrarCienciasPendentes(limite: number) {
  const resultado = { tentativas: 0, registradas: 0, falhas: [] as string[] };
  if (limite <= 0) return resultado;
  const desde = new Date(Date.now() - 60 * 60 * 1000);
  const filtro = {
    xml: null,
    cienciaJaExistenteEm: null,
    ultimaManifestacao: null,
    manifestacoes: { none: { OR: [
      { sucesso: true },
      { tipo: "CIENCIA_DA_OPERACAO" as const, createdAt: { gte: desde } },
    ] } },
  };
  const notas = await prisma.notaFiscalRecebida.findMany({
    where: filtro, orderBy: { createdAt: "asc" }, take: limite,
    select: { id: true, chaveAcesso: true },
  });
  for (const nota of notas) {
    try {
      await prisma.$transaction(async (transacao) => {
        // Mesma trava do aceite: não registrar Ciência enquanto uma decisão está em voo.
        const [trava] = await transacao.$queryRaw<{ obtida: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${nota.id})) AS obtida
        `;
        if (!trava.obtida) return;
        const pendente = await transacao.notaFiscalRecebida.findFirst({ where: { id: nota.id, ...filtro } });
        if (!pendente) return;
        resultado.tentativas++;
        const envio = await manifestarNotaFiscal(nota.chaveAcesso, "CIENCIA_DA_OPERACAO");
        if (envio.sucesso) resultado.registradas++;
        else resultado.falhas.push(`Nota ${nota.chaveAcesso.slice(25, 34)}: ${envio.mensagem}`);
      }, { timeout: 90_000, maxWait: 5_000 });
    } catch (erro) {
      resultado.falhas.push(`Nota ${nota.chaveAcesso.slice(25, 34)}: ${erro instanceof Error ? erro.message : "Falha ao registrar Ciência."}`);
    }
  }
  return resultado;
}
