/** Metadado consultivo autorizado. Não carrega .env nem reimporta pedidos. */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import { hashCanonico } from "../src/lib/vendas/historico-dominio";
import { validarFonteEntregasHistoricas, hashEntradaFonteEntregasHistoricas } from "../src/lib/vendas/entregas-historicas-dominio";
import { prepararEnriquecimentoEntregasHistoricas, aplicarEnriquecimentoEntregasHistoricas, prepararReversaoEntregasHistoricas, reverterEnriquecimentoEntregasHistoricas } from "../src/lib/vendas/entregas-historicas";
import { conferirCodigoEntregas, conferirGuardasEntregas, lerJsonEntregas, prepararSaidaEntregas, salvarJsonEntregas, shaArquivoEntregas } from "./entregas-historicas-arquivos";

export function argumentosEntregasHistoricas(valores: string[]) {
  const permitidos = ["modo", "fonte", "fonte-sha256", "postal", "postal-sha256", "guardas", "guardas-sha256", "usuario-id", "sessao-versao", "lote", "previa", "previa-sha256", "verificacoes", "revisao", "publicacao", "saida"], args = new Map<string, string>();
  for (const valor of valores) {
    const m = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(valor);
    if (!m || !permitidos.includes(m[1]) || args.has(m[1])) throw Error("ENTREGAS_HISTORICAS_CLI_ARGUMENTOS_INVALIDOS");
    args.set(m[1], m[2]);
  }
  const obrigatorio = (campo: string) => { const valor = args.get(campo); if (!valor) throw Error("ENTREGAS_HISTORICAS_CLI_ARGUMENTO_AUSENTE"); return valor; };
  const recebido = obrigatorio("modo"), modo = recebido === "planejar" ? "previa" : recebido;
  const lote = obrigatorio("lote"), usuario = obrigatorio("usuario-id"), versao = obrigatorio("sessao-versao");
  if (!["previa", "aplicar", "previa-reversao", "reverter"].includes(modo) || !/^[a-zA-Z0-9:_-]{8,160}$/u.test(lote) || !/^\d{1,8}$/u.test(versao) || !/^[a-zA-Z0-9_-]{1,100}$/u.test(usuario)) throw Error("ENTREGAS_HISTORICAS_CLI_CONTEXTO_INVALIDO");
  for (const campo of ["fonte", "fonte-sha256", "guardas", "guardas-sha256", "saida"]) obrigatorio(campo);
  for (const campo of ["fonte-sha256", "guardas-sha256"]) if (!/^[a-f0-9]{64}$/u.test(obrigatorio(campo))) throw Error("ENTREGAS_HISTORICAS_CLI_HASH_INVALIDO");
  if (args.has("postal") !== args.has("postal-sha256")) throw Error("ENTREGAS_HISTORICAS_CLI_POSTAL_INCOMPLETO");
  if (args.has("postal-sha256") && !/^[a-f0-9]{64}$/u.test(obrigatorio("postal-sha256"))) throw Error("ENTREGAS_HISTORICAS_CLI_HASH_INVALIDO");
  if (modo === "aplicar" || modo === "reverter") {
    for (const campo of ["previa", "previa-sha256", "verificacoes", "revisao", "publicacao"]) obrigatorio(campo);
    if (!/^[a-f0-9]{64}$/u.test(obrigatorio("previa-sha256")) || !/^[a-f0-9]{40}$/u.test(obrigatorio("revisao"))) throw Error("ENTREGAS_HISTORICAS_CLI_HASH_INVALIDO");
  }
  return { args, obrigatorio, modo, lote, usuario, versao: Number(versao) };
}

export async function executarEntregasHistoricasCli(valores: string[]) {
  const { args, obrigatorio, modo, lote, usuario, versao } = argumentosEntregasHistoricas(valores);
  const leitura = await lerJsonEntregas(path.resolve(obrigatorio("fonte")), 80_000_000);
  if (leitura.sha256 !== obrigatorio("fonte-sha256")) throw Error("ENTREGAS_HISTORICAS_CLI_FONTE_DIVERGENTE");
  const fonte = validarFonteEntregasHistoricas(leitura.conteudo), fonteSha256 = leitura.sha256;
  const leituraPostal = args.has("postal") ? await lerJsonEntregas(path.resolve(obrigatorio("postal"))) : undefined;
  if (leituraPostal && leituraPostal.sha256 !== obrigatorio("postal-sha256")) throw Error("ENTREGAS_HISTORICAS_CLI_POSTAL_DIVERGENTE");
  const postal = leituraPostal?.conteudo, postalSha256 = leituraPostal?.sha256;
  const entradaSha256 = hashEntradaFonteEntregasHistoricas(fonte, fonteSha256, postal, postalSha256);
  const guardasPath = path.resolve(obrigatorio("guardas")), guardas = await conferirGuardasEntregas(guardasPath, obrigatorio("guardas-sha256"), entradaSha256);
  if (modo === "aplicar" || modo === "reverter") {
    if (process.env.ENTREGAS_HISTORICAS_AUTORIZADAS !== "SIM") throw Error("ENTREGAS_HISTORICAS_CLI_AUTORIZACAO_EXIGIDA");
    await conferirCodigoEntregas(path.resolve(obrigatorio("verificacoes")), path.resolve(obrigatorio("publicacao")), obrigatorio("revisao"), entradaSha256);
  }
  const contexto = { usuarioId: usuario, sessaoVersao: versao, loteId: lote, guardas };
  const saida = path.resolve(obrigatorio("saida"));
  if (!saida.startsWith(path.dirname(guardasPath) + path.sep)) throw Error("ENTREGAS_HISTORICAS_CLI_SAIDA_FORA_DAS_GUARDAS");
  const liberar = await prepararSaidaEntregas(saida);
  try {
    let previa: Record<string, unknown> | undefined;
    if (modo === "aplicar" || modo === "reverter") {
      const plano = await lerJsonEntregas(path.resolve(obrigatorio("previa")));
      previa = plano.conteudo;
      if (plano.sha256 !== obrigatorio("previa-sha256") || previa.modo !== (modo === "aplicar" ? "previa" : "previa-reversao") || previa.loteId !== lote || previa.entradaSha256 !== entradaSha256 || typeof previa.token !== "string" || !/^[a-f0-9]{64}$/u.test(previa.token)) throw Error("ENTREGAS_HISTORICAS_CLI_PREVIA_DIVERGENTE");
    }
    let backupMetadadosSha256: string | undefined, backupArquivo: string | undefined, backupArquivoSha256: string | undefined;
    if (modo === "aplicar") {
      if (!previa?.backupMetadados || typeof previa.backupMetadados !== "object" || Array.isArray(previa.backupMetadados)) throw Error("ENTREGAS_HISTORICAS_CLI_BACKUP_METADADOS_INVALIDO");
      backupMetadadosSha256 = hashCanonico(previa.backupMetadados);
      backupArquivo = `backup-metadados-${Date.now()}-${randomUUID()}.json`;
      const arquivo = path.join(saida, backupArquivo);
      await salvarJsonEntregas(arquivo, previa.backupMetadados);
      const salvo = await lerJsonEntregas(arquivo);
      backupArquivoSha256 = salvo.sha256;
      if (hashCanonico(salvo.conteudo) !== backupMetadadosSha256 || (await shaArquivoEntregas(arquivo)).sha256 !== backupArquivoSha256) throw Error("ENTREGAS_HISTORICAS_CLI_BACKUP_METADADOS_DIVERGENTE");
    }
    const resultado = modo === "previa" ? await prepararEnriquecimentoEntregasHistoricas({ ...contexto, fonte, fonteSha256, postal, postalSha256 })
      : modo === "aplicar" ? await aplicarEnriquecimentoEntregasHistoricas({ ...contexto, fonte, fonteSha256, postal, postalSha256, tokenPrevia: previa!.token as string, backupMetadadosSha256: backupMetadadosSha256! })
      : modo === "previa-reversao" ? await prepararReversaoEntregasHistoricas(contexto)
      : await reverterEnriquecimentoEntregasHistoricas({ ...contexto, tokenPrevia: previa!.token as string });
    const nome = `${modo}-${Date.now()}-${randomUUID()}.json`, arquivoResultado = path.join(saida, nome);
    await salvarJsonEntregas(arquivoResultado, { ...resultado, modo, loteId: lote, entradaSha256, fonteSha256, ...(postalSha256 ? { postalSha256 } : {}), guardas, geradoEm: new Date().toISOString(), ...(backupArquivo ? { backupArquivo, backupArquivoSha256, backupMetadadosSha256 } : {}) });
    console.log(JSON.stringify({ modo, loteId: lote, arquivoGravado: nome, arquivoSha256: (await shaArquivoEntregas(arquivoResultado)).sha256, ...(backupArquivo ? { backupArquivo, backupArquivoSha256 } : {}), concluido: true }));
  } finally { await liberar(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) executarEntregasHistoricasCli(process.argv.slice(2)).catch(erro => {
  const codigo = erro instanceof Error && /^ENTREGAS_HISTORICAS_[A-Z0-9_]{1,100}$/u.test(erro.message) ? erro.message : "ENTREGAS_HISTORICAS_CLI_INTERROMPIDA";
  console.error(JSON.stringify({ codigo })); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
