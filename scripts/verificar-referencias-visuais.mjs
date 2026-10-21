import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { comentarioAprova, mudancaExigeAprovacao, validarReferencias, repositoriosVisuais } from "./referencias-visuais.mjs";

const raiz = process.cwd();
const atual = JSON.parse(readFileSync(resolve(raiz, "docs/design-system/referencias-visuais.json"), "utf8"));
const resumo = validarReferencias(atual, raiz);
if (process.env.GRAZING_REFERENCIAS_BASE) {
  const base = existsSync(process.env.GRAZING_REFERENCIAS_BASE) ? JSON.parse(readFileSync(process.env.GRAZING_REFERENCIAS_BASE, "utf8")) : { ...atual, referencias: [] };
  if (mudancaExigeAprovacao(base, atual)) {
    let sha = process.env.GRAZING_HEAD_SHA;
    let numero = process.env.GRAZING_PR_NUMERO;
    const repo = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !repositoriosVisuais.includes(repo) || !token) throw new Error("Mudança de referência aprovada exige aprovação humana vinculada ao head atual da PR.");
    async function consultar(caminho) {
      const resposta = await fetch(`https://api.github.com/repos/${repo}/${caminho}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } });
      if (!resposta.ok) throw new Error("Não foi possível verificar aprovação humana (HTTP " + resposta.status + ").");
      return resposta.json();
    }
    if (!numero) {
      // Push main: reconfirma a PR efetivamente integrada, sem aceitar promoção direta.
      const prs = await consultar(`commits/${sha}/pulls?per_page=100`);
      const pr = prs.find(p => p.merged_at && p.merge_commit_sha === sha);
      if (!pr) throw new Error("Mudança de referência aprovada em main sem PR integrada e aprovação rastreável.");
      numero = String(pr.number); sha = pr.head.sha;
    }
    if (!/^\d+$/.test(numero) || !/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("PR/commit de aprovação inválido.");
    // Consulta somente leitura. Não publica comentários, não atualiza imagem ou baseline.
    const comentarios = [];
    for (let pagina = 1; ; pagina++) {
      const lote = await consultar(`issues/${numero}/comments?per_page=100&page=${pagina}`); comentarios.push(...lote);
      if (lote.length < 100) break;
    }
    if (!comentarioAprova(comentarios, sha)) throw new Error(`Referências aprovadas alteradas. O responsável deve registrar na PR: APROVO REFERÊNCIAS VISUAIS ${sha}, após inspecionar as evidências, e reexecutar o CI.`);
  }
}
console.log(`Referências: ${resumo.aprovadas} aprovadas, ${resumo.emRevisao} em revisão. Capturas históricas não foram promovidas.`);
