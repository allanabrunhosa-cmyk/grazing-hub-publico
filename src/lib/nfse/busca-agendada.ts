import { prisma } from "@/lib/prisma";
import { obterCnpjConsulta } from "@/lib/sefaz/certificado";
import { buscaAutomaticaNfseDevida } from "./agenda";
import { sincronizarNfse } from "./servico";

export async function executarBuscaAutomaticaNfse(agora = new Date()) {
  const cnpj = await obterCnpjConsulta();
  const estado = await prisma.nfseDistribuicaoEstado.findUnique({ where: { cnpj } });
  if (!buscaAutomaticaNfseDevida(estado, agora)) return { mensagem: "Nenhuma busca automática de NFS-e devida neste horário.", erro: false };
  // A sincronização confere novamente agenda e cooldown sob a trava do CNPJ.
  const resultado = await sincronizarNfse("Busca automática", { automatica: true });
  return "erro" in resultado ? { mensagem: resultado.erro, erro: true } : { mensagem: resultado.motivo, erro: false };
}
