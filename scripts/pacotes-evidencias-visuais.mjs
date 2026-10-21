import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RETENCOES_VISUAIS = { relatorios: 3, diagnosticos: 7, revisao: 14 };
const suites = ['contratos', 'referencias', 'comparador'];
const verificacoes = ['registro', ...suites];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const salvar = (path, valor) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(valor, null, 2)); };
const html = texto => String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const relativo = (raiz, path) => relative(raiz, path).split(sep).join('/');
function falhas(suites, titulos = []) {
  return (suites ?? []).flatMap(s => [
    ...(s.specs ?? []).flatMap(spec => (spec.tests ?? []).flatMap(t => (t.results ?? []).filter(r => ['failed', 'timedOut', 'interrupted'].includes(r.status)).map(r => ({ titulo: [...titulos, s.title, spec.title], projeto: t.projectName, estado: r.status, erros: r.errors ?? (r.error ? [r.error] : []) })))),
    ...falhas(s.suites, [...titulos, s.title]),
  ]);
}
function arquivos(raiz) {
  if (!existsSync(raiz)) return [];
  if (lstatSync(raiz).isSymbolicLink()) throw Error('Link simbólico nas evidências.');
  return readdirSync(raiz, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => {
    const path = resolve(raiz, e.name);
    if (e.isSymbolicLink()) throw Error('Link simbólico nas evidências.');
    return e.isDirectory() ? arquivos(path) : e.isFile() ? [path] : [];
  });
}
export function prepararPacotesVisuais(raiz, resultados, origem = {}) {
  if (verificacoes.some(k => !['success', 'failure', 'skipped', 'cancelled'].includes(resultados[k]))) throw Error('Resultado de verificação inválido.');
  const destino = resolve(raiz, 'pacotes');
  if (existsSync(destino)) throw Error('Pacotes já existem; não sobrescrever evidências.');
  const sucesso = verificacoes.every(k => resultados[k] === 'success');
  if (!sucesso && !verificacoes.some(k => ['failure', 'cancelled'].includes(resultados[k])) && !['failure', 'cancelled'].includes(origem.resultadoAnterior)) throw Error('Verificação obrigatória não executada.');
  const resumo = { ...origem, verificacoes: resultados, suites: {}, politica: RETENCOES_VISUAIS };
  const relatorios = {};
  for (const suite of suites) {
    const path = resolve(raiz, suite, 'relatorio/resultados.json');
    if (existsSync(path)) {
      const r = json(path);
      relatorios[suite] = r;
      // O reporter JSON contém medições/anexos inline que não existem em resultados/.
      const compacto = resolve(destino, 'relatorios', suite, 'resultados.json');
      mkdirSync(dirname(compacto), { recursive: true });
      writeFileSync(compacto, JSON.stringify(r));
      resumo.suites[suite] = { estatisticas: r.stats, erros: r.errors ?? [], testesComFalha: falhas(r.suites) };
    } else if (resultados[suite] === 'success') throw Error('Relatório obrigatório ausente: ' + suite);
  }
  salvar(resolve(destino, 'relatorios/resumo.json'), resumo);
  const origens = arquivos(resolve(raiz, 'referencias/resultados')).filter(p => relativo(raiz, p).endsWith('/candidatas/origem.json'));
  const imagens = new Map(), casos = [];
  for (const path of origens) {
    const o = json(path), base = dirname(path), caso = relativo(resolve(raiz, 'referencias/resultados'), base);
    const entradas = [];
    for (const item of o.imagens ?? []) {
      if (!item.sha256) continue;
      if (!/^[a-z0-9-]+$/.test(item.secao) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw Error('Identidade de captura inválida.');
      const original = resolve(base, item.secao + '.png');
      if (lstatSync(original).isSymbolicLink()) throw Error('Link simbólico nas evidências.');
      const bytes = readFileSync(original);
      if (sha(bytes) !== item.sha256) throw Error('Hash da captura divergente.');
      const alvo = `imagens/${item.sha256}.png`;
      if (!imagens.has(item.sha256)) {
        mkdirSync(resolve(destino, 'revisao/imagens'), { recursive: true });
        writeFileSync(resolve(destino, 'revisao', alvo), bytes); imagens.set(item.sha256, alvo);
      }
      entradas.push({ ...item, arquivo: alvo });
    }
    const alvoOrigem = `origens/${caso}/origem.json`;
    mkdirSync(dirname(resolve(destino, 'revisao', alvoOrigem)), { recursive: true });
    copyFileSync(path, resolve(destino, 'revisao', alvoOrigem));
    casos.push({ caso, projeto: o.projeto, estado: o.caso, origem: alvoOrigem, imagens: entradas });
  }
  if (resultados.referencias === 'success' && (!casos.length || !imagens.size)) throw Error('Capturas obrigatórias ausentes.');
  const comparacoes = [];
  for (const path of arquivos(resolve(raiz, 'referencias/resultados'))) {
    const rel = relativo(resolve(raiz, 'referencias/resultados'), path);
    if (!/-(?:actual|expected|diff)\.png$/.test(rel) || rel.split('/').includes('candidatas')) continue;
    const alvo = resolve(destino, 'revisao/comparacoes', rel);
    mkdirSync(dirname(alvo), { recursive: true });
    copyFileSync(path, alvo); comparacoes.push(`comparacoes/${rel}`);
  }
  if (casos.length || comparacoes.length) {
    salvar(resolve(destino, 'revisao/manifesto.json'), { ...origem, estado: 'Em revisão', casos, comparacoes, imagensUnicas: imagens.size, aviso: 'Este pacote não aprova nem altera referências. Preserve as imagens necessárias antes da expiração.' });
    const lista = casos.map(c => `<li><h2>${html(c.projeto)} · ${html(c.estado)}</h2><a href="${html(encodeURI(c.origem))}">Origem e hashes</a><ul>${c.imagens.map(i => `<li>${html(i.secao)} · ${html(i.estado)} <a href="${i.arquivo}"><img src="${i.arquivo}" width="180" alt="${html(i.secao)}"></a></li>`).join('')}</ul></li>`).join('');
    const diffs = comparacoes.map(p => `<li><a href="${html(encodeURI(p))}">${html(p)}</a></li>`).join('');
    writeFileSync(resolve(destino, 'revisao/index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Capturas Em revisão</title><h1>Capturas Em revisão</h1><p>Imagens originais por hash. Nenhuma aprovação automática. Consulte o manifesto e preserve a seleção antes de expirar.</p><ul>${lista}</ul><h2>Comparações</h2><ul>${diffs}</ul></html>`);
  }
  if (!sucesso) {
    const copiados = [];
    for (const suite of suites.filter(s => resultados[s] === 'failure' || resultados[s] === 'cancelled')) {
      if (relatorios[suite]) {
        const alvo = resolve(destino, 'diagnosticos', suite, 'resultados.json');
        mkdirSync(dirname(alvo), { recursive: true });
        writeFileSync(alvo, JSON.stringify(relatorios[suite])); copiados.push(`${suite}/resultados.json`);
      }
      for (const path of arquivos(resolve(raiz, suite, 'resultados'))) {
        const rel = relativo(resolve(raiz, suite, 'resultados'), path);
        if (rel.split('/').some(p => p === 'candidatas' || p.startsWith('.')) || !/\.(?:png|json|md|txt|zip|webm)$/.test(rel)) continue;
        if (suite === 'referencias' && /-(?:actual|expected|diff)\.png$/.test(rel)) continue;
        if (path.endsWith('.png') && imagens.has(sha(readFileSync(path)))) continue;
        const alvo = resolve(destino, 'diagnosticos', suite, rel);
        mkdirSync(dirname(alvo), { recursive: true }); copyFileSync(path, alvo); copiados.push(`${suite}/${rel}`);
      }
    }
    salvar(resolve(destino, 'diagnosticos/manifesto.json'), { ...origem, verificacoes: resultados, arquivos: copiados, aviso: copiados.length ? 'Diagnósticos originais das suítes com falha. As candidatas ficam no pacote de revisão.' : 'A falha ocorreu antes de gerar diagnósticos de navegador. Consulte os logs da execução.' });
  }
  const pacotes = Object.fromEntries(Object.entries(RETENCOES_VISUAIS).map(([nome, dias]) => {
    const lista = arquivos(resolve(destino, nome));
    return [nome, { dias, arquivos: lista.length, bytes: lista.reduce((n, path) => n + lstatSync(path).size, 0) }];
  }));
  const manifesto = { ...resumo, pacotes, casos: casos.length, imagensUnicas: imagens.size };
  salvar(resolve(destino, 'manifesto.json'), manifesto);
  return manifesto;
}
export function resumoEvidenciasVisuais(manifesto, resultados, uploads) {
  const linhas = ['## Evidências visuais', '', '| Verificação | Resultado |', '| --- | --- |'];
  for (const k of verificacoes) linhas.push(`| ${k} | ${resultados[k] ?? 'não executada'} |`);
  linhas.push('', '| Pacote | Conteúdo original | Retenção | Envio |', '| --- | ---: | ---: | --- |');
  for (const nome of Object.keys(RETENCOES_VISUAIS)) {
    const p = manifesto?.pacotes[nome], u = uploads[nome];
    linhas.push(`| ${nome} | ${p ? `${p.arquivos} arquivos · ${p.bytes} bytes` : 'não gerado'} | ${RETENCOES_VISUAIS[nome]} dias | ${u?.resultado === 'success' && u.url ? `[success](${u.url})` : u?.resultado ?? 'não executado'} |`);
  }
  linhas.push('', 'Falha nos testes e falha no envio são estados distintos. Um upload recusado mantém a execução em falha.', 'O tamanho acima é anterior à compressão do GitHub. A cota é recalculada pelo provedor.', 'Imagens continuam Em revisão. Não há atualização automática de referências.', '');
  return linhas.join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const raiz = resolve('.tmp/qualidade-visual-automatizada');
  const resultados = JSON.parse(process.env.EVIDENCIAS_VERIFICACOES ?? '{}');
  if (process.argv[2] === 'preparar') {
    const m = prepararPacotesVisuais(raiz, resultados, { commit: process.env.GITHUB_SHA, execucao: process.env.GITHUB_RUN_ID, tentativa: process.env.GITHUB_RUN_ATTEMPT, ambiente: process.env.GRAZING_AMBIENTE_VISUAL, resultadoAnterior: process.env.EVIDENCIAS_ESTADO_ANTERIOR });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tem_diagnosticos=${m.pacotes.diagnosticos.arquivos > 0}\ntem_revisao=${m.pacotes.revisao.arquivos > 0}\n`);
    console.log(JSON.stringify({ pacotes: m.pacotes, casos: m.casos, imagensUnicas: m.imagensUnicas }));
  } else if (process.argv[2] === 'resumir') {
    const path = resolve(raiz, 'pacotes/manifesto.json'), m = existsSync(path) ? json(path) : null;
    const texto = resumoEvidenciasVisuais(m, resultados, JSON.parse(process.env.EVIDENCIAS_UPLOADS ?? '{}'));
    if (!process.env.GITHUB_STEP_SUMMARY) throw Error('Resumo da execução indisponível.');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto);
  } else throw Error('Uso: pacotes-evidencias-visuais.mjs preparar|resumir');
}
