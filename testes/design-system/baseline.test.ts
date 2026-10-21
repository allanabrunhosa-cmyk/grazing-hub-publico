import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { criarBaseline, compararBaseline } from "../../scripts/baseline-design.mjs";
import { analisarQualidadeVisual } from "../../scripts/regras-design.mjs";

const desvio = { arquivo: "src/components/exemplo.tsx", linha: 2, regra: "cor-local", identidade: '<Button className="bg-red-500" />' };
it("preserva dívida existente quando a linha muda, mas barra novas cores, arquivos e duplicações", () => {
  const baseline = criarBaseline([desvio]);
  expect(compararBaseline([{ ...desvio, linha: 30 }], baseline).novos).toEqual([]);
  for (const novo of [
    { ...desvio, identidade: '<Button className="bg-blue-500" />' },
    { ...desvio, arquivo: "src/components/nova-tela.tsx" },
  ]) expect(compararBaseline([novo], baseline).novos).toEqual([novo]);
  expect(compararBaseline([desvio, desvio], baseline).novos).toHaveLength(1);
});
it("reduz a dívida e rejeita referências malformadas", () => {
  expect(compararBaseline([], criarBaseline([desvio])).resolvidos).toMatchObject([{ quantidade: 1 }]);
  expect(() => compararBaseline([], { versao: 2 })).toThrow();
  expect(() => compararBaseline([], { versao: 1, ocorrencias: { falsa: { quantidade: -1 } } })).toThrow();
});

it("CLI bloqueia dívida nova e exige retirar exceção resolvida antes de permitir reintrodução", () => {
  const pasta = mkdtempSync(join(tmpdir(), "grazing-design-cli-"));
  const arquivo = "src/app/exemplo.tsx", codigo = '<button type="button">Abrir</button>';
  try {
    for (const caminho of ["src/app", "src/components", "docs/design-system"]) mkdirSync(join(pasta, caminho), { recursive: true });
    const baseline = join(pasta, "docs/design-system/desvios-baseline.json");
    writeFileSync(join(pasta, arquivo), codigo);
    writeFileSync(baseline, JSON.stringify(criarBaseline(analisarQualidadeVisual(arquivo, codigo))));
    const executar = () => spawnSync(process.execPath, [fileURLToPath(new URL("../../scripts/verificar-qualidade-visual.mjs", import.meta.url))], { cwd: pasta, encoding: "utf8" });
    expect(executar().status).toBe(0);
    writeFileSync(join(pasta, arquivo), codigo + codigo);
    expect(executar().status).toBe(1);
    writeFileSync(join(pasta, arquivo), "");
    expect(executar().status).toBe(1);
    writeFileSync(baseline, JSON.stringify(criarBaseline([])));
    expect(executar().status).toBe(0);
    writeFileSync(join(pasta, arquivo), codigo);
    expect(executar().status).toBe(1);
  } finally {
    // Exclui somente a pasta privada criada acima, nunca o destino de uma ligação.
    if (dirname(resolve(pasta)) !== resolve(tmpdir()) || !basename(pasta).startsWith("grazing-design-cli-")) throw new Error("Pasta temporária inesperada");
    rmSync(pasta, { recursive: true, force: true });
  }
}, 15000);
