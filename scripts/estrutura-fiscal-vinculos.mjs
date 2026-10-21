/** Projeção administrativa conservadora: não emite documentos nem resolve tributação. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const AUXILIARES = [
  { id: "fiscal-aux-kit-composto", codigo: "KIT_COMPOSTO", nome: "Kit composto — organização fiscal" },
  { id: "fiscal-aux-opcao-configuracao", codigo: "OPCAO_CONFIGURACAO", nome: "Opção de configuração — organização fiscal" },
];
export class ErroVinculosFiscais extends Error {}
const erro = mensagem => { throw new ErroVinculosFiscais(mensagem); };
const canonico = valor => Array.isArray(valor) ? valor.map(canonico) : valor && typeof valor === "object" ? Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonico(v)])) : valor;
const hash = valor => createHash("sha256").update(JSON.stringify(canonico(valor))).digest("hex");
const objeto = valor => !!valor && typeof valor === "object" && !Array.isArray(valor);
const esquemaValido = valor => typeof valor === "string" && /^[a-z_][a-z0-9_]{0,62}$/.test(valor) && !valor.startsWith("pg_") && valor !== "information_schema";
const identificador = valor => typeof valor === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(valor);

export function argumentosVinculos(args) {
  const opcoes = { aplicar: false, schema: "public" };
  const vistos = new Set();
  for (const argumento of args) {
    if (argumento === "--aplicar") { if (vistos.has("aplicar")) erro("Argumento repetido."); vistos.add("aplicar"); opcoes.aplicar = true; continue; }
    const m = /^--(schema|data|saida|hash-plano|usuario-id|backup-comprovante)=(.+)$/.exec(argumento);
    if (!m || vistos.has(m[1])) erro("Argumento desconhecido ou repetido.");
    vistos.add(m[1]); opcoes[m[1]] = m[2];
  }
  if (!esquemaValido(opcoes.schema)) erro("Schema inválido.");
  if (opcoes.data !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(opcoes.data)) erro("Data fiscal inválida.");
  if (opcoes["usuario-id"] !== undefined && !identificador(opcoes["usuario-id"])) erro("Identidade administrativa inválida.");
  if (opcoes["hash-plano"] !== undefined && !/^[a-f0-9]{64}$/.test(opcoes["hash-plano"])) erro("Hash do plano inválido.");
  return opcoes;
}

export function montarPlanoVinculos(produtos, versoes, grupos, data, schema = "public") {
  const vigentes = new Map();
  for (const v of versoes) {
    if (v.tipo !== "CLASSIFICACAO" || v.status !== "ATIVO" || v.vigenciaInicio > data) continue;
    const anterior = vigentes.get(v.chave);
    if (!anterior || v.vigenciaInicio > anterior.vigenciaInicio || v.vigenciaInicio === anterior.vigenciaInicio && v.versao > anterior.versao) vigentes.set(v.chave, v);
  }
  const gruposCriar = [], conflitosGrupos = [], disponiveis = [...grupos];
  for (const auxiliar of AUXILIARES) {
    const codigo = grupos.find(g => g.codigo === auxiliar.codigo), id = grupos.find(g => g.id === auxiliar.id), nome = grupos.find(g => g.nome === auxiliar.nome);
    if (id && id.codigo !== auxiliar.codigo) { conflitosGrupos.push({ codigo: auxiliar.codigo, motivo: "ID_AUXILIAR_OCUPADO" }); continue; }
    if (!codigo && nome && nome.id !== auxiliar.id) { conflitosGrupos.push({ codigo: auxiliar.codigo, motivo: "NOME_AUXILIAR_OCUPADO" }); continue; }
    if (codigo) continue;
    gruposCriar.push(auxiliar); disponiveis.push({ ...auxiliar, ativo: true, fiscal: {}, versao: 1 });
  }
  const linhas = [...produtos].filter(p => p.ativo).sort((a, b) => a.id.localeCompare(b.id)).map(p => {
    const v = vigentes.get(p.id), c = v?.dados;
    const base = { produtoId: p.id, nome: p.nome, versaoBase: p.versao, fiscalAntesTexto: p.fiscalTexto ?? JSON.stringify(p.fiscal), antes: { fiscal: p.fiscal, revisado: p.fiscalRevisado, grupoFiscalId: p.grupoFiscalId }, fonte: v ? { id: v.id, versao: v.versao, hash: v.hash, vigenciaInicio: v.vigenciaInicio } : null };
    const conflito = motivo => ({ ...base, situacao: "CONFLITO", motivo });
    if (!v) return { ...base, situacao: "SEM_CLASSIFICACAO" };
    if (!objeto(c) || c.produtoId !== p.id || !["CONFIRMADO", "PENDENTE"].includes(c.estado) || !["NORMAL", "KIT_COMPOSTO", "OPCAO_CONFIGURACAO"].includes(c.tratamento) || !Array.isArray(c.pendencias) || c.pendencias.some(x => typeof x !== "string")) return conflito("CLASSIFICACAO_INVALIDA");
    if (!objeto(p.fiscal) || p.fiscal.ncm !== undefined && typeof p.fiscal.ncm !== "string" || p.fiscal.observacoes !== undefined && typeof p.fiscal.observacoes !== "string") return conflito("JSON_FISCAL_INVALIDO");
    if (p.fiscalRevisado) return conflito("REVISAO_MANUAL_PRESERVADA");
    const codigo = c.grupo ?? (c.tratamento === "KIT_COMPOSTO" ? "KIT_COMPOSTO" : null);
    if (codigo && !/^(GF(?:0[1-9]|1[0-2])|KIT_COMPOSTO)$/.test(codigo)) return conflito("GRUPO_CLASSIFICACAO_INVALIDO");
    const grupo = codigo ? disponiveis.find(g => g.codigo === codigo && g.ativo) : null;
    if (codigo && !grupo) return conflito("GRUPO_INDISPONIVEL");
    if (grupo && p.grupoFiscalId && p.grupoFiscalId !== grupo.id) return conflito("GRUPO_EXISTENTE_DIVERGENTE");
    const ncm = c.ncm;
    if (ncm != null && (typeof ncm !== "string" || !/^\d{8}$/.test(ncm))) return conflito("NCM_CLASSIFICACAO_INVALIDO");
    const confirmado = c.estado === "CONFIRMADO" && ncm != null && c.tratamento !== "KIT_COMPOSTO";
    if (confirmado && p.fiscal.ncm && p.fiscal.ncm !== ncm) return conflito("NCM_EXISTENTE_DIVERGENTE");
    const depois = { fiscal: { ...p.fiscal }, revisado: p.fiscalRevisado, grupoFiscalId: grupo?.id ?? p.grupoFiscalId };
    if (confirmado && !p.fiscal.ncm) depois.fiscal.ncm = ncm;
    const marcador = `[Estrutura fiscal ${v.id}]`;
    if (!(p.fiscal.observacoes ?? "").includes(marcador)) {
      const notas = [marcador, `Classificação versão ${v.versao}, vigência ${v.vigenciaInicio}.`];
      if (c.estado === "PENDENTE") notas.push(ncm ? `NCM de entrada candidato ${ncm}; sem confirmação para produto final.` : "NCM não confirmado para o produto final.");
      else if (confirmado) notas.push(`NCM ${ncm} confirmado na classificação de referência; demais parâmetros fiscais têm conferência própria.`);
      else if (ncm && c.tratamento === "KIT_COMPOSTO") notas.push(`NCM ${ncm} declarado na referência não projetado ao conjunto; discriminar os componentes na emissão.`);
      if (c.tratamento === "OPCAO_CONFIGURACAO") notas.push("Opção de configuração: identidade do registro; não produz linha fiscal independente.");
      if (c.tratamento === "KIT_COMPOSTO") notas.push("Kit composto: organização auxiliar; não atribuir NCM genérico ao conjunto.");
      const anterior = p.fiscal.observacoes ?? "", obrigatoria = `${anterior}${anterior ? "\n\n" : ""}${notas.join(" ")}`;
      if (obrigatoria.length > 2000) return conflito("LIMITE_OBSERVACOES_PRESERVADAS");
      let observacoes = obrigatoria;
      if (c.pendencias.length) {
        const completas = ` Pendências: ${c.pendencias.join("; ")}.`, curta = ` Pendências: ${c.pendencias.length} registradas na classificação de referência; conferir antes de emitir.`;
        if (observacoes.length + completas.length <= 2000) observacoes += completas;
        else if (observacoes.length + curta.length <= 2000) observacoes += curta;
        else return conflito("LIMITE_OBSERVACOES_PRESERVADAS");
      }
      depois.fiscal.observacoes = observacoes;
    }
    const alterar = hash(base.antes) !== hash(depois);
    const fiscalPatch = Object.fromEntries(["ncm", "observacoes"].filter(k => depois.fiscal[k] !== p.fiscal[k]).map(k => [k, depois.fiscal[k]]));
    return { ...base, situacao: alterar ? "ALTERAR" : "SEM_ALTERACAO", depois, fiscalPatch, grupoCodigo: grupo?.codigo ?? null, grupoNome: grupo?.nome ?? null, ncmConfirmado: confirmado, ncmCandidato: c.estado === "PENDENTE" ? ncm : null };
  });
  const conteudo = { schema, data, gruposCriar, conflitosGrupos, linhas };
  return { ...conteudo, hashPlano: hash(conteudo), resumo: { alterar: linhas.filter(l => l.situacao === "ALTERAR").length, comGrupo: linhas.filter(l => l.depois?.grupoFiscalId).length, ncmConfirmado: linhas.filter(l => l.ncmConfirmado).length, ncmCandidato: linhas.filter(l => l.ncmCandidato).length, conflitos: linhas.filter(l => l.situacao === "CONFLITO").length + conflitosGrupos.length, semClassificacao: linhas.filter(l => l.situacao === "SEM_CLASSIFICACAO").length, semAlteracao: linhas.filter(l => l.situacao === "SEM_ALTERACAO").length, gruposCriar: gruposCriar.length, produtosAtivos: linhas.length } };
}

async function conferirBackup(arquivo) {
  let b;
  try { b = JSON.parse((await readFile(arquivo, "utf8")).replace(/^\uFEFF/, "")); } catch { erro("Comprovante privado de backup indisponível."); }
  const idade = Date.now() - Date.parse(b.criadoEm);
  if (b.verificado !== true || b.autorizacaoImplantacao !== true || !/^[a-f0-9]{64}$/.test(b.hashDump ?? "") || !Number.isFinite(idade) || idade < 0 || idade > 86400000) erro("Comprovante de backup não verificado, inválido ou vencido.");
}
async function conferirAplicacao(opcoes, ambiente) {
  if (!opcoes.aplicar) return;
  if (ambiente.VINCULOS_FISCAIS_APLICACAO_AUTORIZADA !== "SIM" || !identificador(opcoes["usuario-id"]) || !/^[a-f0-9]{64}$/.test(opcoes["hash-plano"] ?? "") || !opcoes["backup-comprovante"]) erro("Aplicação exige autorização explícita, administrador, hash e comprovante de backup.");
  await conferirBackup(opcoes["backup-comprovante"]);
}
export async function executarVinculos(client, opcoes, ambiente = process.env) {
  if (!esquemaValido(opcoes.schema)) erro("Schema inválido.");
  await conferirAplicacao(opcoes, ambiente);
  let iniciado = false;
  try {
    await client.query(opcoes.aplicar ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); iniciado = true;
    await client.query(`SET LOCAL search_path TO "${opcoes.schema}", pg_catalog`);
    await client.query("SET LOCAL DateStyle='ISO,YMD'");
    await client.query("SET LOCAL statement_timeout='30000ms'");
    await client.query("SET LOCAL lock_timeout='10000ms'");
    let autor;
    if (opcoes.aplicar) {
      for (const trava of ["gestao-acessos", "estrutura-fiscal", "vendas-cadastros"]) await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [trava]);
      autor = (await client.query(`SELECT u.id,u.nome FROM "Usuario" u JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE u.id=$1 AND u.ativo AND u."excluidoEm" IS NULL AND p.sistema='ADMINISTRADOR'`, [opcoes["usuario-id"]])).rows[0];
      if (!autor) erro("Administrador vigente não comprovado; nenhum vínculo foi aplicado.");
      const trigger = await client.query(`SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass($1) AND tgname='atividades_projetar_insert' AND tgenabled IN ('O','A') AND NOT tgisinternal) AS ativo`, [`"${opcoes.schema}"."HistoricoCadastroVenda"`]);
      if (trigger.rows[0]?.ativo !== true) erro("Projeção transacional de atividades indisponível.");
    }
    const data = (await client.query("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS data")).rows[0].data;
    if (opcoes.data !== undefined && opcoes.data !== data) erro("Data informada difere do dia atual de São Paulo; refazer o plano.");
    const produtos = (await client.query(`SELECT id,nome,ativo,versao,fiscal,fiscal::text AS "fiscalTexto","fiscalRevisado","grupoFiscalId" FROM "ProdutoVenda" WHERE ativo ORDER BY id${opcoes.aplicar ? " FOR UPDATE" : ""}`)).rows;
    const versoes = (await client.query(`SELECT id,tipo,chave,versao,status,"vigenciaInicio"::text AS "vigenciaInicio",hash,dados FROM "VersaoEstruturaFiscal" WHERE tipo='CLASSIFICACAO' AND status='ATIVO' AND "vigenciaInicio"<=$1::date ORDER BY chave,"vigenciaInicio",versao`, [data])).rows;
    const grupos = (await client.query(`SELECT id,codigo,nome,ativo,fiscal,fiscal::text AS "fiscalTexto",versao FROM "GrupoFiscalVenda" ORDER BY id${opcoes.aplicar ? " FOR UPDATE" : ""}`)).rows;
    const plano = montarPlanoVinculos(produtos, versoes, grupos, data, opcoes.schema);
    if (!opcoes.aplicar) { await client.query("ROLLBACK"); iniciado = false; return { plano, aplicado: false, alterados: 0, gruposCriados: 0 }; }
    if (plano.hashPlano !== opcoes["hash-plano"]) {
      const anteriores = (await client.query(`SELECT entidade,"registroId",depois,(depois->'fiscal')::text AS "fiscalTexto" FROM "HistoricoCadastroVenda" WHERE depois#>>'{sincronizacaoEstruturaFiscal,hashPlano}'=$1`, [opcoes["hash-plano"]])).rows;
      const equivalente = anteriores.length > 0 && anteriores.every(a => {
        if (a.entidade === "FISCAL") {
          const p = produtos.find(p => p.id === a.registroId), linha = plano.linhas.find(l => l.produtoId === a.registroId);
          return p && linha?.fonte?.id === a.depois.sincronizacaoEstruturaFiscal.versaoId && p.versao === a.depois.versao && p.fiscalTexto === a.fiscalTexto && p.fiscalRevisado === a.depois.revisado && p.grupoFiscalId === a.depois.grupoFiscalId;
        }
        const g = a.entidade === "GRUPO_FISCAL" ? grupos.find(g => g.id === a.registroId) : null;
        return g && g.fiscalTexto === a.fiscalTexto && hash({ codigo: g.codigo, nome: g.nome, ativo: g.ativo, versao: g.versao }) === hash({ codigo: a.depois.codigo, nome: a.depois.nome, ativo: a.depois.ativo, versao: a.depois.versao });
      });
      if (!plano.resumo.alterar && !plano.gruposCriar.length && !plano.resumo.conflitos && !plano.resumo.semClassificacao && equivalente) { await client.query("COMMIT"); iniciado = false; return { plano, aplicado: true, aplicadoAnteriormente: true, alterados: 0, gruposCriados: 0 }; }
      erro("Plano mudou desde a prévia; nenhuma alteração foi aplicada. Gere e confira um novo hash.");
    }
    await client.query("SELECT set_config('grazing.atividade',$1,true)", [JSON.stringify({ origem: "AUTOMACAO", correlacaoId: `vinculos-${plano.hashPlano}` })]);
    async function auditar(entidade, id, antes, depois, fiscalAntesTexto = null, fiscalDepoisTexto = null) {
      const fonteId = randomUUID();
      // Fotografias fiscais usam o texto original do JSONB, sem arredondar números legados em JavaScript.
      await client.query(`INSERT INTO "HistoricoCadastroVenda" (id,entidade,"registroId","usuarioId","usuarioNome",antes,depois) VALUES ($1,$2,$3,$4,$5,CASE WHEN $8::text IS NULL THEN $6::jsonb ELSE jsonb_set($6::jsonb,'{fiscal}',$8::jsonb) END,CASE WHEN $9::text IS NULL THEN $7::jsonb ELSE jsonb_set($7::jsonb,'{fiscal}',$9::jsonb) END)`, [fonteId, entidade, id, autor.id, autor.nome, antes === null ? null : JSON.stringify(antes), JSON.stringify(depois), fiscalAntesTexto, fiscalDepoisTexto]);
      const atividade = await client.query(`SELECT count(*)::int AS total FROM "AtividadeUsuario" WHERE "fonteTabela"='HistoricoCadastroVenda' AND "fonteId"=$1 AND "autorId"=$2 AND "recurso"='vendas.fiscal'`, [fonteId, autor.id]);
      if (atividade.rows[0].total !== 1) erro("Auditoria fiscal não projetada; transação integral revertida.");
    }
    for (const grupo of plano.gruposCriar) {
      await client.query(`INSERT INTO "GrupoFiscalVenda" (id,codigo,nome,fiscal,ativo,versao) VALUES ($1,$2,$3,'{}'::jsonb,true,1)`, [grupo.id, grupo.codigo, grupo.nome]);
      await auditar("GRUPO_FISCAL", grupo.id, null, { ...grupo, ativo: true, fiscal: {}, versao: 1, sincronizacaoEstruturaFiscal: { hashPlano: plano.hashPlano, origem: "CLASSIFICACOES_AUXILIARES" } });
    }
    const recibos = [];
    for (const l of plano.linhas.filter(l => l.situacao === "ALTERAR")) {
      const atualizado = await client.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal || $1::jsonb,"grupoFiscalId"=$2,versao=versao+1,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$3 AND versao=$4 AND ativo RETURNING versao,fiscal::text AS "fiscalTexto"`, [JSON.stringify(l.fiscalPatch), l.depois.grupoFiscalId, l.produtoId, l.versaoBase]);
      if (atualizado.rowCount !== 1) erro("Produto mudou durante a aplicação; transação integral revertida.");
      await auditar("FISCAL", l.produtoId, { ...l.antes, fiscal: null, versao: l.versaoBase }, { ...l.depois, fiscal: null, versao: atualizado.rows[0].versao, sincronizacaoEstruturaFiscal: { hashPlano: plano.hashPlano, versaoId: l.fonte.id, hashVersao: l.fonte.hash, origem: "CLASSIFICACAO_ATIVA" } }, l.fiscalAntesTexto, atualizado.rows[0].fiscalTexto);
      recibos.push({ produtoId: l.produtoId, versao: atualizado.rows[0].versao, fonteVersaoId: l.fonte.id });
    }
    const diaFinal = (await client.query("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS data")).rows[0].data;
    if (diaFinal !== data) erro("Data fiscal mudou durante a operação; transação revertida para nova prévia.");
    await client.query("COMMIT"); iniciado = false;
    return { plano, aplicado: true, alterados: recibos.length, gruposCriados: plano.gruposCriar.length, recibos };
  } catch (e) { if (iniciado) await client.query("ROLLBACK").catch(() => {}); throw e; }
}

export async function prepararDestinoPrivado(saida) {
  const raiz = path.resolve(".tmp/fiscal"), destino = path.resolve(saida ?? ".tmp/fiscal/vinculos-cadastro");
  const dentro = (base, p) => { const r = path.relative(base, p); return !r.startsWith("..") && !path.isAbsolute(r); };
  if (!dentro(raiz, destino)) erro("Guardar planos e recibos somente dentro de .tmp/fiscal.");
  await mkdir(raiz, { recursive: true, mode: 0o700 });
  let existente = destino;
  while (true) { try { await stat(existente); break; } catch (e) { if (e.code !== "ENOENT") throw e; existente = path.dirname(existente); } }
  if (!dentro(await realpath(raiz), await realpath(existente))) erro("Destino privado resolve fora de .tmp/fiscal.");
  await mkdir(destino, { recursive: true, mode: 0o700 });
  return destino;
}
async function guardarPrivado(saida, nome, dados) {
  const destino = await prepararDestinoPrivado(saida);
  const arquivo = path.join(destino, nome), texto = JSON.stringify(dados, null, 2);
  try { await writeFile(arquivo, texto, { mode: 0o600, flag: "wx" }); }
  catch (e) { if (e.code !== "EEXIST" || await readFile(arquivo, "utf8") !== texto) erro("Artefato privado existente diverge; preservar e conferir a auditoria antes de repetir."); }
}
async function cli() {
  const opcoes = argumentosVinculos(process.argv.slice(2));
  if (!process.env.DATABASE_URL) erro("DATABASE_URL explícita é obrigatória; não imprimir credenciais.");
  await conferirAplicacao(opcoes, process.env);
  opcoes.saida = await prepararDestinoPrivado(opcoes.saida);
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const previa = await executarVinculos(client, { ...opcoes, aplicar: false });
    await guardarPrivado(opcoes.saida, `plano-${previa.plano.hashPlano}.json`, previa.plano);
    const resultado = opcoes.aplicar ? await executarVinculos(client, opcoes) : previa;
    let reciboArquivoGravado = false;
    if (resultado.aplicado && !resultado.aplicadoAnteriormente) {
      try { await guardarPrivado(opcoes.saida, `recibo-${resultado.plano.hashPlano}.json`, { hashPlano: resultado.plano.hashPlano, usuarioId: opcoes["usuario-id"], alterados: resultado.alterados, gruposCriados: resultado.gruposCriados, recibos: resultado.recibos }); reciboArquivoGravado = true; }
      catch { console.error("Aplicação confirmada na auditoria; arquivo de recibo indisponível. Conferir a auditoria e não reaplicar cegamente."); process.exitCode = 1; }
    }
    console.log(JSON.stringify({ modo: opcoes.aplicar ? "APLICAR" : "DRY_RUN", data: resultado.plano.data, hashPlano: resultado.plano.hashPlano, ...resultado.plano.resumo, alterados: resultado.alterados, gruposCriados: resultado.gruposCriados, aplicado: resultado.aplicado, aplicadoAnteriormente: resultado.aplicadoAnteriormente ?? false, reciboArquivoGravado, documentosTransmitidos: 0 }));
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void cli().catch(e => { console.error(e instanceof ErroVinculosFiscais ? e.message : "Operação fiscal não confirmada; conferir ambiente, plano e auditoria privados antes de repetir, sem revelar credenciais."); process.exitCode = 1; });
}
