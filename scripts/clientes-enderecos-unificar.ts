/** Operação privada. Nunca carrega .env nem reprocessa pedidos/fontes históricas. */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import { hashReconciliacao, type EvidenciaReconciliacao } from "../src/lib/vendas/clientes-cobrancas-reconciliacao";
import { aplicarEquivalencias, inspecionarFontesEquivalencias, prepararEquivalencias, prepararReversaoEquivalencias, reverterEquivalencias, validarConfiguracaoEquivalencias, type ConfiguracaoEquivalencias, type PreviaEquivalencias } from "../src/lib/vendas/clientes-enderecos-equivalencias";
import { conferirAprovacaoReconciliacao, conferirArtefatoReconciliacao } from "./clientes-cobrancas-reconciliar";
import { lerJsonCorrecao, prepararSaidaCorrecao, salvarJsonCorrecao } from "./clientes-historicos-arquivos";
import { argumentosSaneamento } from "./clientes-enderecos-sanear";

export function argumentosEquivalencias(valores: string[]) {
  try { return argumentosSaneamento(valores); } catch { throw Error("EQUIVALENCIAS_CLI_ARGUMENTOS_INVALIDOS"); }
}
export function validarEnvelopePreviaEquivalencias(entrada: Record<string, unknown>, config: ConfiguracaoEquivalencias, modo: "aplicar" | "reverter") {
  const configuracaoSha256 = hashReconciliacao(config), resultado = entrada.resultado;
  if (entrada.modo !== (modo === "aplicar" ? "previa" : "previa-reversao") || entrada.operacaoId !== config.operacaoId || entrada.configuracaoSha256 !== configuracaoSha256 || typeof entrada.token !== "string" || !/^[a-f0-9]{64}$/.test(entrada.token) || !resultado || typeof resultado !== "object" || Array.isArray(resultado)) throw Error("EQUIVALENCIAS_CLI_PREVIA_DIVERGENTE");
  const r = resultado as Record<string, unknown>;
  if (r.token !== entrada.token || r.configuracaoSha256 !== configuracaoSha256 || r.operacaoId !== config.operacaoId || r.modo !== (modo === "aplicar" ? "UNIFICAR_ENTREGAS_EQUIVALENTES" : "REVERTER_ENTREGAS_EQUIVALENTES")) throw Error("EQUIVALENCIAS_CLI_ENVELOPE_DIVERGENTE");
  return { token: entrada.token, resultado: r };
}
async function main() {
  if (!process.env.DATABASE_URL) throw Error("EQUIVALENCIAS_CLI_BANCO_EXPLICITO_EXIGIDO");
  const { modo, obrigatorio } = argumentosEquivalencias(process.argv.slice(2)), saida = path.resolve(obrigatorio("saida"));
  if (modo === "fontes") {
    const liberar = await prepararSaidaCorrecao(saida);
    try { const resultado = await inspecionarFontesEquivalencias(obrigatorio("cliente-id")), arquivo = `fontes-${Date.now()}-${randomUUID()}.json`; await salvarJsonCorrecao(path.join(saida, arquivo), { modo, resultado, geradoEm: new Date().toISOString() }); console.log(JSON.stringify({ modo, arquivoGravado: arquivo, concluido: true })); } finally { await liberar(); }
    return;
  }
  const config = validarConfiguracaoEquivalencias(await lerJsonCorrecao(path.resolve(obrigatorio("configuracao")))), configuracaoSha256 = hashReconciliacao(config);
  let previa: ReturnType<typeof validarEnvelopePreviaEquivalencias> | undefined, evidencia: EvidenciaReconciliacao | undefined;
  if (modo === "aplicar" || modo === "reverter") {
    if (process.env.CLIENTES_EQUIVALENCIAS_AUTORIZADAS !== "SIM") throw Error("EQUIVALENCIAS_NAO_AUTORIZADO");
    const artefatoSha256 = await conferirArtefatoReconciliacao(path.resolve(obrigatorio("artefato")), obrigatorio("artefato-sha256"), config.revisaoCodigo);
    previa = validarEnvelopePreviaEquivalencias(await lerJsonCorrecao(path.resolve(obrigatorio("previa"))), config, modo);
    evidencia = await conferirAprovacaoReconciliacao(path.resolve(obrigatorio("aprovacao")), obrigatorio("aprovacao-sha256"), { modo, configuracaoSha256, token: previa.token, revisaoCodigo: config.revisaoCodigo, artefatoSha256 });
  }
  const liberar = await prepararSaidaCorrecao(saida);
  try {
    const resultado = modo === "previa" ? await prepararEquivalencias(config) : modo === "aplicar" ? await aplicarEquivalencias(config, previa!.resultado as PreviaEquivalencias, evidencia!) : modo === "previa-reversao" ? await prepararReversaoEquivalencias(config) : await reverterEquivalencias(config, previa!.token, evidencia!);
    const arquivo = `${modo}-${Date.now()}-${randomUUID()}.json`;
    await salvarJsonCorrecao(path.join(saida, arquivo), { modo, operacaoId: config.operacaoId, configuracaoSha256, token: resultado.token, resultado, ...(evidencia ? { evidencia } : {}), geradoEm: new Date().toISOString() }); console.log(JSON.stringify({ modo, arquivoGravado: arquivo, concluido: true }));
  } finally { await liberar(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(e => {
  const codigo = e instanceof Error && /^(EQUIVALENCIAS|RECONCILIACAO)_[A-Z0-9_]{1,100}$/.test(e.message) ? e.message : "EQUIVALENCIAS_CLI_INTERROMPIDO"; console.error(JSON.stringify({ codigo })); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
