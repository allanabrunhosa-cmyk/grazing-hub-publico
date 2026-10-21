import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { exigirBaseHomologacaoControlada } from "./capacidade-homologacao";
import { lerPreparacaoPilotosBrasilNfe, vincularPilotoAprovadoBrasilNfe } from "./piloto-local";
import { aprovarConjuntoRegrasBrasilNfe, salvarRascunhoRegraTributariaBrasilNfe } from "./regras-tributarias";
import { hashRegraFiscalBrasilNfe, hojeCivilRegraBrasilNfe } from "./regras-tributarias-dominio";
export class ErroVinculoPilotoBrasilNfe extends Error {
  constructor() { super("A revisão interna foi preservada. O vínculo do manifesto não foi concluído. Use Conferir manifesto aprovado; não repetir aprovação nem transmitir."); this.name = "ErroVinculoPilotoBrasilNfe"; }
}
export async function concluirVinculosPilotoBrasilNfe(sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada();
  const pilotos = await lerPreparacaoPilotosBrasilNfe(sessao);
  if (pilotos.length !== 2 || pilotos.some(p => !p.aprovacaoInterna)) throw new Error("Aprovação interna ausente.");
  for (const p of pilotos) await vincularPilotoAprovadoBrasilNfe(p.documentoId, sessao);
}

/** Declaração factual e aprovação somente por action de usuário autenticado.
 * Não chamada pelo preparo nem pela leitura; não concede transmissão. */
export async function aprovarRevisaoPilotoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada();
  const e = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada as Record<string, unknown> : {};
  if (Object.keys(e).length !== 3 || Object.keys(e).some(k => !["versoes", "origemNacionalConferida", "aplicacaoConferida"].includes(k)) || e.origemNacionalConferida !== true || e.aplicacaoConferida !== true || !Array.isArray(e.versoes) || e.versoes.length !== 6) throw new Error("Confira origem nacional do acabado, fontes e aplicação das seis propostas antes da revisão consolidada.");
  const pilotos = await lerPreparacaoPilotosBrasilNfe(sessao);
  if (pilotos.length !== 2 || pilotos.some(p => !p.montagemConcluida || p.aprovacaoInterna)) throw new Error("Confira os dois cenários e as propostas atuais; não duplicar aprovação.");
  const apresentadas = pilotos.flatMap(p => p.versoes);
  const assinatura = (v: unknown) => hashRegraFiscalBrasilNfe(v);
  if (assinatura(e.versoes) !== assinatura(apresentadas)) throw new Error("As versões apresentadas mudaram. Atualize antes de aprovar.");
  const comandos = await prisma.$transaction(async tx => {
    const aprovacao = [];
    for (const p of pilotos) for (const h of p.historicos) {
      const atual = h.versoes[0];
      let versao = { regraId: h.id, revisao: h.revisao, fundamentacaoHash: atual.fundamentacaoHash, conteudoHash: atual.conteudoHash };
      if (h.alvo === "PRODUTO") {
        const fundamento = structuredClone(atual.fundamentacaoFiscal);
        if (!fundamento || atual.conteudo.tipo !== "ITEM" || atual.conteudo.perfil.classificacoes.origem !== "0") throw new Error("A declaração de origem não corresponde ao perfil apresentado.");
        const hoje = hojeCivilRegraBrasilNfe();
        fundamento.fontes.push({ id: "responsavel_origem", tipo: "DECLARACAO_RESPONSAVEL", titulo: "Origem nacional conferida pelo responsável interno", referencia: "Ato explícito na revisão consolidada do piloto; autor e instante na prova de aprovação", uri: null, consultadoEm: hoje, trechoAplicavel: "Responsável autenticado confirmou origem0 do sanduíche acabado, incluindo verificação de que insumos importados não exigem código de origem diverso.", limitesAplicabilidade: "Somente o produto acabado dos dois sabores e este recorte; não comprova origem de outros produtos ou ingredientes isolados." });
        const confianca = fundamento.confianca.find(c => c.campo === "ORIGEM");
        if (!confianca) throw new Error("Conferência de origem ausente.");
        confianca.estado = "COMPROVADO"; confianca.fontes = ["responsavel_origem", "processo"]; confianca.justificativa = "Origem0 do acabado declarada e conferida explicitamente pelo responsável interno nesta revisão, incluindo tratamento dos insumos importados; fato e ato auditáveis.";
        const nova = await salvarRascunhoRegraTributariaBrasilNfe({ regraId: h.id, revisao: h.revisao, modelo: h.modelo, operacao: h.operacao, alvo: h.alvo, produtoId: h.produtoId, fundamentacaoFiscal: fundamento, vigenteDesde: atual.vigenteDesde, vigenteAte: atual.vigenteAte, conteudo: atual.conteudo }, sessao, tx);
        versao = { regraId: nova.regraId, revisao: nova.revisao, fundamentacaoHash: nova.fundamentacaoHash, conteudoHash: nova.conteudoHash };
      }
      aprovacao.push({ ...versao, aplicacaoConferida: true, conferirCadastro: h.alvo === "PRODUTO" });
    }
    // Mesmo transaction client: qualquer falta de fundamento/permissão reverte
    // todas as versões, declarações e marcadores de conferência deste ato.
    await aprovarConjuntoRegrasBrasilNfe(aprovacao, sessao, tx);
    return aprovacao;
  }, { timeout: 30000 });
  try { await concluirVinculosPilotoBrasilNfe(sessao); } catch { throw new ErroVinculoPilotoBrasilNfe(); }
  return { aprovadas: comandos.length, pilotos: await lerPreparacaoPilotosBrasilNfe(sessao), transmissaoPermitida: false as const };
}
