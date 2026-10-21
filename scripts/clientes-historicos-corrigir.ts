/** Manutenção autorizada. Não carrega .env nem inicia serviços ou integrações. */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import { hashCanonico, validarPacoteHistorico } from "../src/lib/vendas/historico-dominio";
import { aplicarComplementoPacote } from "../src/lib/vendas/historico-complemento";
import { validarManifestoEmpresasHistoricas } from "../src/lib/vendas/clientes-correcao-dominio";
import { prepararCorrecaoClientesHistoricos, executarCorrecaoClientesHistoricos, prepararReversaoClientesHistoricos, reverterCorrecaoClientesHistoricos } from "../src/lib/vendas/clientes-correcao";
import { conferirCodigoCorrecao, conferirGuardasCorrecao, conferirProvasEmpresas, lerJsonCorrecao, prepararSaidaCorrecao, salvarJsonCorrecao, shaArquivoCorrecao } from "./clientes-historicos-arquivos";

export function argumentosCorrecao(valores: string[]) {
  const permitidos = ["modo", "pacote", "fonte", "complemento", "manifesto", "inventario", "provas", "guardas", "guardas-sha256", "usuario-id", "sessao-versao", "lote", "previa", "verificacoes", "revisao", "publicacao", "saida"], args = new Map<string, string>();
  for (const valor of valores) {
    const m = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(valor);
    if (!m || !permitidos.includes(m[1]) || args.has(m[1])) throw Error("CORRECAO_CLI_ARGUMENTOS_INVALIDOS"); args.set(m[1], m[2]);
  }
  const obrigatorio = (campo: string) => { const v = args.get(campo); if (!v) throw Error("CORRECAO_CLI_ARGUMENTO_AUSENTE"); return v; };
  const modo = obrigatorio("modo"), lote = obrigatorio("lote"), versao = obrigatorio("sessao-versao"), usuario = obrigatorio("usuario-id");
  if (!["previa", "aplicar", "previa-reversao", "reverter"].includes(modo) || !/^[a-zA-Z0-9:_-]{8,160}$/.test(lote) || !/^\d{1,8}$/.test(versao) || !/^[a-zA-Z0-9_-]{1,100}$/.test(usuario)) throw Error("CORRECAO_CLI_CONTEXTO_INVALIDO");
  return { args, obrigatorio, modo, lote, usuario, versao: Number(versao) };
}
async function main() {
  const { args, obrigatorio, modo, lote, usuario, versao } = argumentosCorrecao(process.argv.slice(2));
  const pacotePath = path.resolve(obrigatorio("pacote")), pacoteSha256 = (await shaArquivoCorrecao(pacotePath)).sha256;
  const principal = validarPacoteHistorico(await lerJsonCorrecao(pacotePath, 80_000_000));
  const complementoPath = args.has("complemento") ? path.resolve(obrigatorio("complemento")) : null;
  const complementoSha256 = complementoPath ? (await shaArquivoCorrecao(complementoPath)).sha256 : null;
  const pacote = complementoPath ? aplicarComplementoPacote(principal, await lerJsonCorrecao(complementoPath), { fonteSha256: principal.metadados.sha256, pacoteSha256 }) : principal;
  if ((await shaArquivoCorrecao(path.resolve(obrigatorio("fonte")))).sha256 !== pacote.metadados.sha256) throw Error("CORRECAO_CLI_EXCEL_DIVERGENTE");
  const manifestoPath = path.resolve(obrigatorio("manifesto")), manifestoSha256 = (await shaArquivoCorrecao(manifestoPath)).sha256;
  const manifesto = validarManifestoEmpresasHistoricas(await lerJsonCorrecao(manifestoPath));
  const inventarioSha256 = (await shaArquivoCorrecao(path.resolve(obrigatorio("inventario")))).sha256;
  if (inventarioSha256 !== manifesto.inventarioSha256 || lote === manifesto.loteHistoricoId) throw Error("CORRECAO_CLI_INVENTARIO_DIVERGENTE");
  await conferirProvasEmpresas(manifesto, path.resolve(obrigatorio("provas")));
  const entradaSha256 = hashCanonico({ fonteSha256: pacote.metadados.sha256, pacoteSha256, complementoSha256, manifestoSha256, inventarioSha256 });
  const guardasPath = path.resolve(obrigatorio("guardas"));
  const guardas = await conferirGuardasCorrecao(guardasPath, obrigatorio("guardas-sha256"), entradaSha256);
  if (modo === "aplicar" || modo === "reverter") {
    if (process.env.CLIENTES_CORRECAO_AUTORIZADA !== "SIM") throw Error("CORRECAO_CLI_AUTORIZACAO_EXIGIDA");
    await conferirCodigoCorrecao(path.resolve(obrigatorio("verificacoes")), path.resolve(obrigatorio("publicacao")), obrigatorio("revisao"), entradaSha256);
  }
  const contexto = { usuarioId: usuario, sessaoVersao: versao, loteId: lote, guardas };
  const saida = path.resolve(obrigatorio("saida"));
  if (!saida.startsWith(path.dirname(guardasPath) + path.sep)) throw Error("CORRECAO_CLI_SAIDA_FORA_DAS_GUARDAS");
  const liberar = await prepararSaidaCorrecao(saida);
  try {
    let tokenPrevia: string | undefined;
    if (modo === "aplicar" || modo === "reverter") {
      const previa = await lerJsonCorrecao(path.resolve(obrigatorio("previa")));
      if (previa.loteId !== lote || previa.entradaSha256 !== entradaSha256 || typeof previa.token !== "string" || !/^[a-f0-9]{64}$/.test(previa.token)) throw Error("CORRECAO_CLI_PREVIA_DIVERGENTE");
      tokenPrevia = previa.token;
    }
    const resultado = modo === "previa" ? await prepararCorrecaoClientesHistoricos({ ...contexto, pacote, manifesto })
      : modo === "aplicar" ? await executarCorrecaoClientesHistoricos({ ...contexto, pacote, manifesto, tokenPrevia: tokenPrevia! })
      : modo === "previa-reversao" ? await prepararReversaoClientesHistoricos(contexto)
      : await reverterCorrecaoClientesHistoricos({ ...contexto, tokenPrevia: tokenPrevia! });
    const nome = `${modo}-${Date.now()}-${randomUUID()}.json`;
    await salvarJsonCorrecao(path.join(saida, nome), { ...resultado, loteId: lote, entradaSha256, fonteSha256: pacote.metadados.sha256, pacoteSha256, complementoSha256, manifestoSha256, inventarioSha256, guardas, geradoEm: new Date().toISOString() });
    console.log(JSON.stringify({ modo, loteId: lote, arquivoGravado: nome, concluido: true }));
  } finally { await liberar(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(erro => {
  const codigo = erro instanceof Error && /^CORRECAO_[A-Z0-9_]{1,100}$/.test(erro.message) ? erro.message : "CORRECAO_CLI_INTERROMPIDA";
  console.error(JSON.stringify({ codigo })); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
