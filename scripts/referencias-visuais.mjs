import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

export const ambienteVisual = "linux-amd64-playwright-1.64.0-noble";
export const secoesVisuais = ["controles", "formulario", "tabela", "filtros", "dialogo", "dialogo-painel", "lateral", "estados"];
export const casosVisuais = ["normal", "longo", "salvando", "erro", "vazio"];
export const repositoriosVisuais = ["allanabrunhosa-cmyk/grazing-hub", "allanabrunhosa-cmyk/grazing-hub-publico"];
const origemGitHub = (url, caminho) => repositoriosVisuais.some(repo => new RegExp(`^https://github[.]com/${repo}/${caminho}$`).test(url ?? ""));

/** Registro fechado; nenhuma execução de testes cria ou aprova referências. */
export function validarReferencias(registro, raiz) {
  if (registro?.versao !== 1 || registro.ambiente !== ambienteVisual || !Array.isArray(registro.referencias)) throw new Error("Registro/ambiente de referências inválido.");
  const ids = new Set();
  for (const ref of registro.referencias) {
    if (!ref || !/^chromium-(320|390|768|1440)-(claro|escuro)-(fino|toque)$/.test(ref.projeto) || !casosVisuais.includes(ref.caso) || !secoesVisuais.includes(ref.secao) || (ref.projeto.endsWith("-toque") && !/^chromium-(320|390)-/.test(ref.projeto))) throw new Error("Cenário de referência desconhecido.");
    const id = `${ref.projeto}/${ref.caso}/${ref.secao}`;
    if (ids.has(id)) throw new Error("Referência duplicada: " + id);
    ids.add(id);
    if (!["Em revisão", "Aprovada"].includes(ref.estado)) throw new Error("Estado de referência inválido.");
    const esperado = `docs/design-system/referencias-visuais/${id}.png`;
    if (ref.arquivo !== esperado) throw new Error("Caminho de referência inválido: " + id);
    if (!/^[a-f0-9]{64}$/.test(ref.sha256) || !/^[a-f0-9]{40}$/.test(ref.origem?.commit) || ref.origem?.ambiente !== ambienteVisual || !origemGitHub(ref.origem?.execucao, 'actions/runs/\\d+')) throw new Error("Proveniência da imagem inválida: " + id);
    if (ref.estado === "Aprovada" && (ref.aprovacao?.autor !== "allanabrunhosa-cmyk" || !/^\d{4}-\d{2}-\d{2}$/.test(ref.aprovacao?.data ?? "") || !origemGitHub(ref.aprovacao?.evidencia, 'pull/\\d+#issuecomment-\\d+'))) throw new Error("Referência aprovada sem decisão humana rastreável: " + id);
    const arquivo = resolve(raiz, ref.arquivo);
    const pasta = resolve(raiz, "docs/design-system/referencias-visuais") + sep;
    if (!arquivo.startsWith(pasta)) throw new Error("Referência fora da pasta oficial.");
    if (!realpathSync(arquivo).startsWith(realpathSync(pasta.slice(0, -1)) + sep)) throw new Error("Referência aponta para fora da pasta oficial.");
    const pixels = readFileSync(arquivo);
    if (!pixels.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Referência não é imagem PNG.");
    const hash = createHash("sha256").update(pixels).digest("hex");
    if (hash !== ref.sha256) throw new Error("Imagem modificada sem registro de origem: " + id);
  }
  return { aprovadas: registro.referencias.filter(r => r.estado === "Aprovada").length, emRevisao: registro.referencias.filter(r => r.estado === "Em revisão").length };
}

export function mudancaExigeAprovacao(base, atual) {
  const aprovadas = r => r.referencias.filter(x => x.estado === "Aprovada").sort((a, b) => a.arquivo.localeCompare(b.arquivo));
  return JSON.stringify(aprovadas(base)) !== JSON.stringify(aprovadas(atual));
}

export function comentarioAprova(comentarios, sha) {
  return comentarios.some(c => c.user?.login === "allanabrunhosa-cmyk" && c.user?.type === "User" && c.body?.trim() === `APROVO REFERÊNCIAS VISUAIS ${sha}`);
}

export function diferencaConsultiva(erro, anexos) {
  const mensagem = String(erro?.message ?? "");
  if (/Failed to take two consecutive stable screenshots|Could not take a stable screenshot|Timeout waiting for screenshot stability/i.test(mensagem)) return false;
  const pixels = /pixels \(ratio [\d.]+ of all image pixels\) are different\./.test(mensagem);
  const dimensoes = /Expected an image \d+px by \d+px, received \d+px by \d+px\./.test(mensagem);
  return (pixels || dimensoes) && anexos.some(a => /-diff(?:\.png)?$/.test(a.name) && a.contentType === "image/png" && a.path && existsSync(a.path));
}
