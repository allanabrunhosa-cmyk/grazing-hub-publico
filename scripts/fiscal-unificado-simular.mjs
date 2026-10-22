/** Somente leitura. O manifesto privado não substitui o backup integral do banco. */
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { prepararDestinoPrivado } from "./estrutura-fiscal-vinculos.mjs";
import { compararCadastroFiscal, valoresClassificacao, valoresRegra } from "../src/lib/tributacao/ficha.ts";
import { versoesVigentes } from "../src/lib/tributacao/vigencia.ts";

export function compararFontesFiscais({ produtos, grupos, versoes }, dia) {
  const vigentes = versoesVigentes(versoes.map(v => ({ ...v, vigenciaInicio: String(v.vigenciaInicio).slice(0, 10) })), dia);
  return produtos.map(p => {
    const c = vigentes.find(v => v.tipo === "CLASSIFICACAO" && v.chave === p.id)?.dados;
    return { produtoId: p.id, nome: p.nome, grupoCadastro: grupos.find(g => g.id === p.grupoFiscalId)?.nome ?? null, grupoMotor: grupos.find(g => g.id === c?.grupoFiscalId)?.nome ?? c?.grupo ?? null,
      diferencas: compararCadastroFiscal(p.fiscal, valoresClassificacao(c)),
      regras: vigentes.filter(v => v.tipo === "REGRA" && v.dados.produtoId === p.id).map(v => ({ chave: v.chave, modelo: v.dados.modelo ?? "55/65", uf: v.dados.ufDestino, destinatario: v.dados.destinatario, diferencas: compararCadastroFiscal(p.fiscal, valoresRegra(v.dados)) })),
      classificacaoAusente: !c };
  });
}
export async function capturarConciliacaoFiscal(banco, dia) {
  await banco.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const produtos = (await banco.query('SELECT id,nome,fiscal,"grupoFiscalId",versao FROM "ProdutoVenda" ORDER BY id')).rows;
    const grupos = (await banco.query('SELECT id,codigo,nome,fiscal,ativo,versao FROM "GrupoFiscalVenda" ORDER BY id')).rows;
    const versoes = (await banco.query(`SELECT id,tipo,chave,versao,status,to_char("vigenciaInicio",'YYYY-MM-DD') AS "vigenciaInicio",dados,hash FROM "VersaoEstruturaFiscal" ORDER BY id`)).rows;
    const documentos = (await banco.query('SELECT id,encode(sha256(convert_to(row_to_json(d)::text,\'UTF8\')),\'hex\') AS hash FROM "DocumentoFiscalSaida" d ORDER BY id')).rows;
    const dados = { dia, produtos, grupos, versoes, documentos };
    return { formato: "grazing.fiscal.unificacao.simulacao.v1", somenteLeitura: true, hash: createHash("sha256").update(JSON.stringify(dados)).digest("hex"), dados, comparacao: compararFontesFiscais(dados, dia) };
  } finally { await banco.query("ROLLBACK"); }
}
export function argumentosSimulacaoFiscal(args) {
  const r = { schema: "public", saida: ".tmp/fiscal/unificacao", dia: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()) };
  for (const a of args) {
    const m = /^--(schema|saida|dia)=(.+)$/.exec(a);
    if (!m) throw new Error("Use somente --schema, --saida e --dia. Este comando não aplica alterações.");
    r[m[1]] = m[2];
  }
  if (!/^[a-zA-Z0-9_]{1,63}$/.test(r.schema) || !/^\d{4}-\d{2}-\d{2}$/.test(r.dia) || new Date(`${r.dia}T00:00:00Z`).toISOString().slice(0, 10) !== r.dia) throw new Error("Schema ou data inválidos.");
  return r;
}
async function main() {
  const args = argumentosSimulacaoFiscal(process.argv.slice(2));
  const destino = await prepararDestinoPrivado(args.saida);
  if (!process.env.DATABASE_URL) throw new Error("Informe a conexão privada do ambiente que será somente consultado.");
  const banco = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await banco.connect(); await banco.query(`SET search_path TO "${args.schema}"`);
    const manifesto = await capturarConciliacaoFiscal(banco, args.dia), nome = `simulacao-${randomUUID()}.json`;
    await writeFile(path.join(destino, nome), JSON.stringify(manifesto, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ somenteLeitura: true, produtos: manifesto.dados.produtos.length, grupos: manifesto.dados.grupos.length, documentosPreservados: manifesto.dados.documentos.length, hash: manifesto.hash, arquivoPrivado: path.join(destino, nome) }));
  } finally { await banco.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error("Simulação não concluída. Nenhuma alteração fiscal foi aplicada. Confira os argumentos, o destino privado e a conexão."); process.exitCode = 1; });
