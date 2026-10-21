import { prisma } from "@/lib/prisma";
import { obterCnpjConsulta } from "./certificado";
import { sincronizarDistribuicaoNFe } from "./sincronizar";
import { HORA } from "./recuperacao-regras";

export function inicioDoDiaEmBrasilia(agora: Date): Date {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return new Date(`${dia}T00:00:00-03:00`);
}

export async function agendarBusca(): Promise<{ agendada: true; mensagem: string }> {
  const cnpj = await obterCnpjConsulta();
  const estado = await prisma.sefazDistribuicaoEstado.upsert({ where: { cnpj }, create: { cnpj }, update: {} });
  const horario = new Date(Math.max(Date.now(), estado.bloqueadoAte?.getTime() ?? 0));
  // Cliques repetidos não criam novos trabalhos nem encurtam a espera externa.
  await prisma.sefazDistribuicaoEstado.updateMany({ where: { cnpj,
    OR: [{ proximaBuscaEm: null }, { proximaBuscaEm: { gt: horario } }],
  }, data: { proximaBuscaEm: horario } });
  return { agendada: true, mensagem: estado.emConsulta ? "A busca já está em andamento no servidor."
    : `O servidor processará a fila em até cinco minutos após ${horario.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Você pode continuar usando o sistema.` };
}

export async function executarBuscaAgendada(agora = new Date()): Promise<{ mensagem: string; erro: boolean }> {
  const cnpj = await obterCnpjConsulta();
  const estado = await prisma.sefazDistribuicaoEstado.upsert({ where: { cnpj }, create: { cnpj }, update: {} });
  const horaDiaria = new Date(inicioDoDiaEmBrasilia(agora).getTime() + (3 * 60 + 15) * 60_000);
  // Acordar a cada cinco minutos só processa trabalhos devidos. A descoberta
  // diária mantém 03h15; reiniciar o serviço não dispara uma busca adicional.
  const diaria = agora >= horaDiaria && agora.getTime() < horaDiaria.getTime() + 5 * 60_000
    && (!estado.ultimaBuscaAutomaticaEm || estado.ultimaBuscaAutomaticaEm < inicioDoDiaEmBrasilia(agora));
  const pendente = estado.proximaBuscaEm && estado.proximaBuscaEm <= agora;
  if (!diaria && !pendente) return { mensagem: "Nenhuma busca pendente neste horário.", erro: false };
  if (diaria) await prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: { ultimaBuscaAutomaticaEm: agora } });
  try {
    const resumo = await sincronizarDistribuicaoNFe(3);
    const mensagem = `${resumo.novos} nota(s) nova(s), ${resumo.xmlRecuperados} XML(s) recuperado(s). ${resumo.xMotivoFinal}`;
    if (diaria) await prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: { resultadoBuscaAutomatica: mensagem } });
    return { mensagem, erro: resumo.motivoParada === "ERRO" };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha na busca SEFAZ.";
    await prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: {
      resultadoExecucao: mensagem, proximaBuscaEm: new Date(agora.getTime() + HORA),
    } });
    return { mensagem, erro: true };
  }
}
