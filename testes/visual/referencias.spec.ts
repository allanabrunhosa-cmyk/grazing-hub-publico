import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { ambienteVisual, casosVisuais, secoesVisuais, diferencaConsultiva } from "../../scripts/referencias-visuais.mjs";

type Referencia = { projeto: string; caso: string; secao: string; estado: "Em revisão" | "Aprovada"; arquivo: string; sha256: string; origem: { ambiente: string } };
const registro: { referencias: Referencia[] } = JSON.parse(readFileSync(resolve("docs/design-system/referencias-visuais.json"), "utf8"));
// No container, use a revisão imutável do checkout; não contorne a proteção de ownership do Git.
const emCI = process.env.CI === "true";
const commit = emCI ? process.env.GITHUB_SHA : execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(commit ?? "")) throw new Error("Captura sem revisão de origem verificável.");
const alteracoesLocais = emCI ? null : execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;

for (const caso of casosVisuais) {
  test(`capturas e referências: ${caso}`, async ({ page, browser }, info) => {
    const tema = String(info.project.metadata.tema);
    const externas: string[] = [], erros: string[] = [];
    await page.route("**/*", async rota => {
      const url = new URL(rota.request().url());
      if (["http:", "https:"].includes(url.protocol) && url.origin !== "http://127.0.0.1:4238") { externas.push(url.origin); await rota.abort(); }
      else await rota.continue();
    });
    page.on("pageerror", erro => erros.push(erro.message));
    await page.goto(`/qualidade.html?caso=${caso}&tema=${tema}`);
    await page.waitForFunction(() => window.grazingQualidade?.pronta === true);
    const ambiente = process.env.GRAZING_AMBIENTE_VISUAL ?? `${process.platform}-${process.arch}-playwright-1.64.0`;
    const layout = await page.evaluate(() => ({ largura: innerWidth, altura: innerHeight, dpr: devicePixelRatio, ponteiroGrosso: matchMedia("(pointer: coarse)").matches, fonte: getComputedStyle(document.body).fontFamily, fontes: document.fonts.status }));
    const imagens: { secao: string; estado: string; sha256?: string; motivo?: string; referencia?: { estado: string; sha256: string }; comparacao?: string }[] = [];
    const metadados = { commit, alteracoesLocais, projeto: info.project.name, caso, tema, ambiente, chromium: browser.version(), layout, imagens, aprovadas: registro.referencias.filter(r => r.estado === "Aprovada").length, execucao: process.env.GITHUB_RUN_ID ?? "local", aviso: "Toda nova captura é Em revisão; o estado da referência é registrado separadamente. Inspecione legibilidade, hierarquia, sobreposição e contraste. Origem local com alterações não representa o commit isoladamente." };
    const origem = info.outputPath("candidatas", "origem.json");
    mkdirSync(resolve(origem, ".."), { recursive: true });
    const gravarOrigem = () => writeFileSync(origem, JSON.stringify(metadados, null, 2));
    gravarOrigem();
    try {
    for (const secao of secoesVisuais) {
      if (secao === "dialogo-painel" && caso !== "salvando") await page.getByTestId("abrir-dialogo").click();
      const alvo = page.getByTestId(secao);
      const ref = registro.referencias.find(r => r.projeto === info.project.name && r.caso === caso && r.secao === secao);
      if (!await alvo.isVisible()) {
        if (ref?.estado === "Aprovada") throw new Error("Seção aprovada deixou de estar visível: " + secao);
        imagens.push({ secao, estado: "Não visível neste contexto", motivo: secao === "lateral" ? "Lateral oculta no layout móvel real" : "Estado não apresenta esta seção" });
        gravarOrigem();
        continue;
      }
      const imagem = await alvo.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      const caminho = info.outputPath("candidatas", `${secao}.png`);
      mkdirSync(resolve(caminho, ".."), { recursive: true }); writeFileSync(caminho, imagem);
      await info.attach(`Em revisão: ${secao}`, { path: caminho, contentType: "image/png" });
      const item = { secao, estado: "Em revisão", sha256: createHash("sha256").update(imagem).digest("hex"), referencia: ref ? { estado: ref.estado, sha256: ref.sha256 } : undefined, comparacao: "Sem referência registrada" };
      imagens.push(item); gravarOrigem();
      if (ref) {
        const compativel = ambiente === ambienteVisual && process.platform === "linux" && process.arch === "x64";
        if (!compativel) {
          item.comparacao = "Pendente: ambiente incompatível"; gravarOrigem();
          if (process.env.CI && ref.estado === "Aprovada") throw new Error("Referência aprovada executada fora do ambiente fixado.");
          info.annotations.push({ type: "Comparação pendente", description: `${secao}: requer ${ambienteVisual}; captura local não aprova referência.` });
        } else if (ref.estado === "Aprovada") {
          try { await expect(alvo).toHaveScreenshot([info.project.name, caso, `${secao}.png`], { animations: "disabled", caret: "hide", scale: "css" }); item.comparacao = "Idêntica à referência aprovada"; }
          catch (erro) { item.comparacao = "Falha bloqueante; inspecionar diferenças/erro"; gravarOrigem(); throw erro; }
        } else if (existsSync(resolve(ref.arquivo))) {
          const anexosAntes = info.attachments.length;
          try { await expect(alvo).toHaveScreenshot([info.project.name, caso, `${secao}.png`], { animations: "disabled", caret: "hide", scale: "css" }); item.comparacao = "Idêntica à candidata; aprovação pendente"; }
          catch (erro) {
            if (!diferencaConsultiva(erro, info.attachments.slice(anexosAntes))) { item.comparacao = "Erro operacional bloqueante"; gravarOrigem(); throw erro; }
            item.comparacao = "Diferença consultiva; aprovação pendente";
            info.annotations.push({ type: "Diferença Em revisão", description: `${secao}: comparação consultiva; inspecione actual/expected/diff nos artefatos.` });
          }
        }
        gravarOrigem();
      }
      if (secao === "dialogo-painel") await page.keyboard.press("Escape");
    }
    expect(externas, "a fixture não consulta serviços externos").toEqual([]);
    expect(erros, "a fixture não apresenta erros de execução").toEqual([]);
    gravarOrigem();
    if (registro.referencias.length === 0) info.annotations.push({ type: "Referências Em revisão", description: "Nenhum baseline visual humano aprovado. Contratos mecânicos são bloqueantes; estas imagens aguardam revisão." });
    } finally {
      // attach copia o arquivo imediatamente: anexar ao fim preserva os hashes/resultado.
      gravarOrigem();
      await info.attach("Origem e pendências visuais", { path: origem, contentType: "application/json" });
    }
  });
}
