/** Manutenção privada. Não carrega .env nem reprocessa fontes históricas. */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import { hashReconciliacao, type EvidenciaReconciliacao } from "../src/lib/vendas/clientes-cobrancas-reconciliacao";
import { aplicarSaneamento, inspecionarCadastroSaneamento, prepararReversaoSaneamento, prepararSaneamento, reverterSaneamento, validarConfiguracaoSaneamento, type ConfiguracaoSaneamento, type PreviaSaneamento } from "../src/lib/vendas/clientes-enderecos-saneamento";
import { conferirAprovacaoReconciliacao, conferirArtefatoReconciliacao } from "./clientes-cobrancas-reconciliar";
import { lerJsonCorrecao, prepararSaidaCorrecao, salvarJsonCorrecao } from "./clientes-historicos-arquivos";

export function argumentosSaneamento(valores: string[]) {
  const args = new Map<string, string>(), permitidos = ["modo", "cliente-id", "configuracao", "saida", "previa", "aprovacao", "aprovacao-sha256", "artefato", "artefato-sha256"];
  for (const valor of valores) {
    const m = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(valor);
    if (!m || !permitidos.includes(m[1]) || args.has(m[1])) throw Error("SANEAMENTO_CLI_ARGUMENTOS_INVALIDOS"); args.set(m[1], m[2]);
  }
  const obrigatorio = (campo: string) => { const v = args.get(campo); if (!v) throw Error("SANEAMENTO_CLI_ARGUMENTO_AUSENTE"); return v; };
  const modo = args.get("modo") ?? "previa";
  if (!["fontes", "previa", "aplicar", "previa-reversao", "reverter"].includes(modo)) throw Error("SANEAMENTO_CLI_MODO_INVALIDO");
  if (modo !== "fontes" && args.has("cliente-id")) throw Error("SANEAMENTO_CLI_ALVO_AMBIGUO");
  return { modo, obrigatorio };
}
export function validarEnvelopePreviaSaneamento(entrada: Record<string, unknown>, config: ConfiguracaoSaneamento, modo: "aplicar" | "reverter") {
  const configuracaoSha256 = hashReconciliacao(config), resultado = entrada.resultado;
  if (entrada.modo !== (modo === "aplicar" ? "previa" : "previa-reversao") || entrada.operacaoId !== config.operacaoId || entrada.configuracaoSha256 !== configuracaoSha256 || typeof entrada.token !== "string" || !/^[a-f0-9]{64}$/.test(entrada.token) || !resultado || typeof resultado !== "object" || Array.isArray(resultado)) throw Error("SANEAMENTO_CLI_PREVIA_DIVERGENTE");
  const r = resultado as Record<string, unknown>;
  if (r.token !== entrada.token || r.configuracaoSha256 !== configuracaoSha256 || r.operacaoId !== config.operacaoId || r.modo !== (modo === "aplicar" ? "SANEAR_ENDERECOS" : "REVERTER_SANEAMENTO_ENDERECOS")) throw Error("SANEAMENTO_CLI_ENVELOPE_DIVERGENTE");
  return { token: entrada.token, resultado: r };
}
async function main() {
  if (!process.env.DATABASE_URL) throw Error("SANEAMENTO_CLI_BANCO_EXPLICITO_EXIGIDO");
  const { modo, obrigatorio } = argumentosSaneamento(process.argv.slice(2));
  const saida = path.resolve(obrigatorio("saida"));
  if (modo === "fontes") {
    const liberar = await prepararSaidaCorrecao(saida);
    try {
      const resultado = await inspecionarCadastroSaneamento(obrigatorio("cliente-id")), arquivo = `fontes-${Date.now()}-${randomUUID()}.json`;
      await salvarJsonCorrecao(path.join(saida, arquivo), { modo, resultado, geradoEm: new Date().toISOString() });
      console.log(JSON.stringify({ modo, arquivoGravado: arquivo, concluido: true }));
    } finally { await liberar(); }
    return;
  }
  const config = validarConfiguracaoSaneamento(await lerJsonCorrecao(path.resolve(obrigatorio("configuracao"))));
  const configuracaoSha256 = hashReconciliacao(config);
  let previa: ReturnType<typeof validarEnvelopePreviaSaneamento> | undefined, evidencia: EvidenciaReconciliacao | undefined;
  if (modo === "aplicar" || modo === "reverter") {
    if (process.env.CLIENTES_SANEAMENTO_AUTORIZADO !== "SIM") throw Error("SANEAMENTO_NAO_AUTORIZADO");
    const artefatoSha256 = await conferirArtefatoReconciliacao(path.resolve(obrigatorio("artefato")), obrigatorio("artefato-sha256"), config.revisaoCodigo);
    previa = validarEnvelopePreviaSaneamento(await lerJsonCorrecao(path.resolve(obrigatorio("previa"))), config, modo);
    evidencia = await conferirAprovacaoReconciliacao(path.resolve(obrigatorio("aprovacao")), obrigatorio("aprovacao-sha256"), { modo, configuracaoSha256, token: previa.token, revisaoCodigo: config.revisaoCodigo, artefatoSha256 });
  }
  const liberar = await prepararSaidaCorrecao(saida);
  try {
    const resultado = modo === "previa" ? await prepararSaneamento(config)
      : modo === "aplicar" ? await aplicarSaneamento(config, previa!.resultado as PreviaSaneamento, evidencia!)
      : modo === "previa-reversao" ? await prepararReversaoSaneamento(config)
      : await reverterSaneamento(config, String(previa!.token), evidencia!);
    const arquivo = `${modo}-${Date.now()}-${randomUUID()}.json`;
    await salvarJsonCorrecao(path.join(saida, arquivo), { modo, operacaoId: config.operacaoId, configuracaoSha256, token: resultado.token, resultado, ...(evidencia ? { evidencia } : {}), geradoEm: new Date().toISOString() });
    console.log(JSON.stringify({ modo, arquivoGravado: arquivo, concluido: true }));
  } finally { await liberar(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(e => {
  const codigo = e instanceof Error && /^(SANEAMENTO|RECONCILIACAO)_[A-Z0-9_]{1,100}$/.test(e.message) ? e.message : "SANEAMENTO_CLI_INTERROMPIDO";
  console.error(JSON.stringify({ codigo })); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
