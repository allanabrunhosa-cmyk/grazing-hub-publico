/** Exportador privado/dry-run. Não abre conexão nem grava cadastros/documentos. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { criarMatrizFiscalCatalogo, resumirCoberturaFiscal, type CatalogoAuditoriaFiscal, type ClassificacaoCatalogoFiscal, type DeclaracaoOperacionalFiscal, type TabelaNcmAuditoria } from "../src/lib/tributacao/catalogo";

async function executar() {
  const argumentos = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const partes = /^--(arquivo|saida|tabela-ncm|declaracoes|revisoes)=(.+)$/.exec(a);
    if (!partes || argumentos.has(partes[1])) throw new Error("Use somente --arquivo=<export privado>, --tabela-ncm=<tabela oficial>, --declaracoes=<evidências operacionais>, --revisoes=<revisão individual> e --saida=<pasta privada .tmp/fiscal>.");
    argumentos.set(partes[1], partes[2]);
  }
  const entrada = argumentos.get("arquivo");
  if (!entrada) throw new Error("Informe --arquivo com a auditoria autorizada somente leitura; nenhum banco é consultado.");
  const raizPrivada = path.resolve(".tmp", "fiscal"), saida = path.resolve(argumentos.get("saida") ?? raizPrivada);
  const relativo = path.relative(raizPrivada, saida);
  if (relativo.startsWith("..") || path.isAbsolute(relativo)) throw new Error("A saída deve ficar dentro de .tmp/fiscal, ignorada pelo Git.");
  const bytes = await readFile(path.resolve(entrada));
  const catalogo = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")) as CatalogoAuditoriaFiscal;
  if (!Array.isArray(catalogo.produtos) || !Array.isArray(catalogo.insumos) || !Array.isArray(catalogo.evidenciasNcmEntrada) || !Array.isArray(catalogo.opcoes) || !Array.isArray(catalogo.gruposComplementos) || !Array.isArray(catalogo.composicoesPreparacoes)) throw new Error("Contrato do export de auditoria incompleto.");
  const caminhoTabela = argumentos.get("tabela-ncm");
  const tabela = caminhoTabela ? JSON.parse((await readFile(path.resolve(caminhoTabela), "utf8")).replace(/^\uFEFF/, "")) as TabelaNcmAuditoria : undefined;
  if (tabela) {
    tabela.fonte = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
    tabela.dataReferencia = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(catalogo.geradoEm));
    if (!Array.isArray(tabela.Nomenclaturas)) throw new Error("Tabela NCM oficial inválida.");
  }
  const declaracoes = argumentos.has("declaracoes") ? JSON.parse((await readFile(path.resolve(argumentos.get("declaracoes")!), "utf8")).replace(/^\uFEFF/, "")) as DeclaracaoOperacionalFiscal[] : [];
  const matriz = criarMatrizFiscalCatalogo(catalogo, tabela, declaracoes);
  if (argumentos.has("revisoes")) {
    const revisoes = JSON.parse((await readFile(path.resolve(argumentos.get("revisoes")!), "utf8")).replace(/^\uFEFF/, "")) as { casos: { produtoId: string; diagnostico: string; classificacaoRevisada: ClassificacaoCatalogoFiscal | null }[] };
    for (const linha of matriz) {
      const revisada = revisoes.casos.find(c => c.produtoId === linha.produtoId && c.diagnostico === "IDENTIDADE_NCM_ORIGEM_SUFICIENTES")?.classificacaoRevisada;
      if (!revisada) continue;
      if (revisada.produtoId !== linha.produtoId || revisada.ncm !== linha.classificacao.ncm || revisada.unidade !== linha.classificacao.unidade || !linha.referenciasNcm.some(r => r.codigo === revisada.ncm && r.vigente)) throw new Error("Revisão não corresponde à evidência de identidade/NCM/unidade auditada.");
      linha.classificacao = revisada;
    }
  }
  const classificacoes = matriz.map(l => l.classificacao);
  const cobertura = resumirCoberturaFiscal(catalogo.produtos, classificacoes);
  const resumo = { geradoEm: new Date().toISOString(), origemGeradoEm: catalogo.geradoEm,
    hashOrigem: createHash("sha256").update(bytes).digest("hex"), modo: "DRY_RUN_SEM_ESCRITA_BANCO",
    totalAtivos: cobertura.totalAtivos, cobertos: cobertura.cobertos, pendentes: cobertura.pendentes,
    opcoesConfiguracao: cobertura.opcoesConfiguracao, semSku: cobertura.semSku,
    classificacoesConfirmadas: classificacoes.filter(c => c.estado === "CONFIRMADO").length,
    comNcmCandidato: matriz.filter(l => !!l.classificacao.ncm).length,
    composicaoBaseAusente: matriz.filter(l => !l.composicao.length).length,
    preparacoesAtivas: catalogo.insumos.filter(i => i.ativo && !i.excluidoEm && i.tipo === "PRODUTO_INTERMEDIARIO").length,
    tabelaNcmConferida: !!tabela, dataTabelaNcm: tabela?.dataReferencia ?? null };
  await mkdir(saida, { recursive: true, mode: 0o700 });
  const campo = (v: unknown) => { const s = String(v ?? ""); return `"${(/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`; };
  const linhas = [["produtoId", "sku", "referenciaRastreio", "descricao", "grupo", "natureza", "tratamento", "ncm", "origem", "cest", "unidade", "estado", "composicao", "evidencias", "pendencias"],
    ...matriz.map(l => [l.produtoId, l.sku, l.referencia, l.descricao, l.classificacao.grupo, l.classificacao.natureza,
      l.classificacao.tratamento, l.classificacao.ncm, l.classificacao.origem, l.classificacao.cest, l.classificacao.unidade, l.classificacao.estado,
      l.composicao.map(c => `${c.nome}: ${c.quantidade} ${c.unidade}`).join(" | "),
      l.classificacao.evidencias.join(" | "), l.classificacao.pendencias.join(" | ")])];
  await writeFile(path.join(saida, "matriz-produtos-ativos.json"), JSON.stringify({ resumo, matriz }, null, 2), { mode: 0o600 });
  await writeFile(path.join(saida, "matriz-produtos-ativos.csv"), `\uFEFF${linhas.map(l => l.map(campo).join(";")).join("\r\n")}\r\n`, { mode: 0o600 });
  await writeFile(path.join(saida, "classificacoes-propostas.json"), JSON.stringify({ resumo, classificacoes }, null, 2), { mode: 0o600 });
  const preparacoes = catalogo.insumos.filter(i => i.ativo && !i.excluidoEm && i.tipo === "PRODUTO_INTERMEDIARIO")
    .map(i => ({ id: i.id, nome: i.nome, rendimento: i.rendimentoQuantidade, unidade: i.rendimentoUnidade, modoPreparo: i.modoPreparo,
      composicao: catalogo.composicoesPreparacoes.filter(c => c.produtoId === i.id).map(c => ({ ...c,
        nome: catalogo.insumos.find(i => i.id === c.componenteId)?.nome ?? "Insumo não encontrado" })),
      produtosVinculados: matriz.filter(l => l.composicao.some(c => c.insumoId === i.id)).map(l => l.produtoId) }));
  await writeFile(path.join(saida, "preparacoes-ativas.json"), JSON.stringify({ resumo, preparacoes }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(resumo, null, 2));
}
executar().catch(() => { console.error("Não foi possível gerar a matriz privada; confira o arquivo e os argumentos. Nenhum cadastro foi alterado."); process.exitCode = 1; });
