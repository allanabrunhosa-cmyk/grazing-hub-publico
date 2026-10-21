import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { executarBuscaAgendada, inicioDoDiaEmBrasilia } from "@/lib/sefaz/busca-agendada";
import { executarBuscaAutomaticaNfse } from "@/lib/nfse/busca-agendada";
import { obterCnpjConsulta } from "@/lib/sefaz/certificado";

async function executar() {
  try {
    if (process.argv.includes("--verificar")) {
      const cnpj = await obterCnpjConsulta();
      await prisma.sefazDistribuicaoEstado.findUnique({ where: { cnpj }, select: { ultimaBuscaAutomaticaEm: true } });
      await prisma.nfseDistribuicaoEstado.findUnique({ where: { cnpj }, select: { ultimaBuscaAutomaticaEm: true, proximaBuscaAutomaticaEm: true } });
      console.log("Rotinas NF-e e NFS-e carregadas; banco e configuração disponíveis. Nenhuma chamada à SEFAZ.", inicioDoDiaEmBrasilia(new Date()).toISOString());
      return;
    }
    // Falha em uma integração não impede a outra de executar sua própria agenda.
    const resultados = await Promise.allSettled([executarBuscaAgendada(), executarBuscaAutomaticaNfse()]);
    resultados.forEach((resultado, indice) => {
      const nome = indice === 0 ? "NF-e" : "NFS-e";
      if (resultado.status === "rejected") {
        console.error(`${nome}: ${resultado.reason instanceof Error ? resultado.reason.message : "Falha na busca automática."}`);
        process.exitCode = 1;
      } else {
        console.log(`${nome}: ${resultado.value.mensagem}`);
        if (resultado.value.erro) process.exitCode = 1;
      }
    });
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : "Falha ao executar a busca diária de notas.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void executar();
