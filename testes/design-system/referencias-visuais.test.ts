import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { comentarioAprova, mudancaExigeAprovacao, validarReferencias, ambienteVisual, diferencaConsultiva } from "../../scripts/referencias-visuais.mjs";

const vazio = { versao: 1, ambiente: ambienteVisual, referencias: [] };
const pastas: string[] = [];
function temporario() { const pasta = mkdtempSync(resolve(tmpdir(), "grazing-referencias-")); pastas.push(pasta); return pasta; }
afterEach(() => { for (const pasta of pastas.splice(0)) { if (!resolve(pasta).startsWith(resolve(tmpdir()) + sep)) throw new Error("Limpeza fora da pasta temporária"); rmSync(pasta, { recursive: true }); } });
describe("proteção da aprovação visual", () => {
  it("aceita registro inicial sem inventar aprovação", () => {
    expect(validarReferencias(vazio, process.cwd())).toEqual({ aprovadas: 0, emRevisao: 0 });
  });
  it("não transforma candidato em referência bloqueante", () => {
    expect(mudancaExigeAprovacao(vazio, { ...vazio, referencias: [{ estado: "Em revisão" }] })).toBe(false);
    expect(mudancaExigeAprovacao(vazio, { ...vazio, referencias: [{ estado: "Aprovada", arquivo: "a.png" }] })).toBe(true);
  });
  it("exige aprovação também para retirar ou substituir uma referência", () => {
    const base = { ...vazio, referencias: [{ estado: "Aprovada", arquivo: "a.png", sha256: "antes" }] };
    expect(mudancaExigeAprovacao(base, vazio)).toBe(true);
    expect(mudancaExigeAprovacao(base, { ...base, referencias: [{ ...base.referencias[0], sha256: "depois" }] })).toBe(true);
  });
  it("recusa caminho e aprovação sem origem antes de ler arquivos", () => {
    const ref = { projeto: "chromium-320-claro-fino", caso: "normal", secao: "controles", estado: "Aprovada", arquivo: "../fora.png" };
    expect(() => validarReferencias({ ...vazio, referencias: [ref] }, process.cwd())).toThrow("Caminho");
    expect(() => validarReferencias({ ...vazio, referencias: [{ ...ref, arquivo: "docs/design-system/referencias-visuais/chromium-320-claro-fino/normal/controles.png" }] }, process.cwd())).toThrow("Proveniência");
  });
  it("só aceita comentário humano do responsável para o commit exato", () => {
    const sha = "a".repeat(40);
    const comentario = { user: { login: "allanabrunhosa-cmyk", type: "User" }, body: `APROVO REFERÊNCIAS VISUAIS ${sha}` };
    expect(comentarioAprova([comentario], sha)).toBe(true);
    expect(comentarioAprova([comentario], "b".repeat(40))).toBe(false);
    expect(comentarioAprova([{ ...comentario, user: { ...comentario.user, type: "Bot" } }], sha)).toBe(false);
    expect(comentarioAprova([{ ...comentario, user: { ...comentario.user, login: "outro" } }], sha)).toBe(false);
  });
  it("verifica os bytes de referência aprovada e recusa alteração sem rastreabilidade", () => {
    const raiz = temporario();
    const arquivo = "docs/design-system/referencias-visuais/chromium-390-claro-fino/normal/controles.png";
    const caminho = resolve(raiz, arquivo);
    mkdirSync(resolve(caminho, ".."), { recursive: true });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lB0AAAAASUVORK5CYII=", "base64");
    writeFileSync(caminho, png);
    const ref = { projeto: "chromium-390-claro-fino", caso: "normal", secao: "controles", estado: "Aprovada", arquivo, sha256: createHash("sha256").update(png).digest("hex"), origem: { commit: "a".repeat(40), ambiente: ambienteVisual, execucao: "https://github.com/allanabrunhosa-cmyk/grazing-hub/actions/runs/123" }, aprovacao: { autor: "allanabrunhosa-cmyk", data: "2026-10-12", evidencia: "https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/10#issuecomment-123" } };
    expect(validarReferencias({ ...vazio, referencias: [ref] }, raiz)).toEqual({ aprovadas: 1, emRevisao: 0 });
    const publica = { ...ref, origem: { ...ref.origem, execucao: 'https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/actions/runs/123' }, aprovacao: { ...ref.aprovacao, evidencia: 'https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/pull/10#issuecomment-123' } };
    expect(validarReferencias({ ...vazio, referencias: [publica] }, raiz)).toEqual({ aprovadas: 1, emRevisao: 0 });
    expect(() => validarReferencias({ ...vazio, referencias: [{ ...publica, origem: { ...publica.origem, execucao: 'https://github.com/outro/grazing-hub-publico/actions/runs/123' } }] }, raiz)).toThrow('Proveniência');
    expect(() => validarReferencias({ ...vazio, referencias: [{ ...publica, aprovacao: { ...publica.aprovacao, autor: 'outro' } }] }, raiz)).toThrow('decisão humana');
    expect(() => validarReferencias({ ...vazio, referencias: [{ ...ref, aprovacao: null }] }, raiz)).toThrow("decisão humana");
    writeFileSync(caminho, Buffer.concat([png, Buffer.from("alterado")]));
    expect(() => validarReferencias({ ...vazio, referencias: [ref] }, raiz)).toThrow("Imagem modificada");
  });
  it("mantém decoder, captura e instabilidade como erros bloqueantes", () => {
    expect(diferencaConsultiva(new Error("Invalid PNG: unexpected end of buffer"), [])).toBe(false);
    expect(diferencaConsultiva(new Error("Timeout waiting for screenshot stability"), [])).toBe(false);
    expect(diferencaConsultiva(new Error("12 pixels (ratio 0.02 of all image pixels) are different."), [])).toBe(false);
    const arquivo = resolve(temporario(), "exemplo-diff.png"); writeFileSync(arquivo, "diff de teste");
    const anexo = { name: "controles-diff.png", contentType: "image/png", path: arquivo };
    expect(diferencaConsultiva(new Error("12 pixels (ratio 0.02 of all image pixels) are different."), [anexo])).toBe(true);
    expect(diferencaConsultiva(new Error("Invalid PNG"), [anexo])).toBe(false);
    expect(diferencaConsultiva(new Error("Could not take a stable screenshot. 12 pixels (ratio 0.02 of all image pixels) are different."), [anexo])).toBe(false);
    expect(diferencaConsultiva(new Error("12 pixels (ratio 0.02 of all image pixels) are different.\nCall log: captured a stable screenshot"), [anexo])).toBe(true);
  });
});
