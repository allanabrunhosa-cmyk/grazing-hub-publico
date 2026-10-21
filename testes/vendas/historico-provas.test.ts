import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { conferirProva, ARQUIVOS_CODIGO_HISTORICO } from "../../scripts/historico-importar";
const prova = () => ({ expected: { Sintetica: { count: 2, md5: "a".repeat(32) } }, restored: { Sintetica: { count: 2, md5: "a".repeat(32) } }, equal: true, containerNetwork: "none", portsPublished: [], jobsActivated: false });
it("exige prova dos dados restaurados, sem confiar somente na flag", () => {
  expect(() => conferirProva(prova())).not.toThrow();
  const p = prova(); p.restored.Sintetica.count = 3; expect(() => conferirProva(p)).toThrow("restauração isolada");
});
it.each([false, 0, []])("aceita ausência explícita de portas: %j", portas => {
  expect(() => conferirProva({ ...prova(), portsPublished: portas })).not.toThrow();
});
it.each([undefined, "0", {}, true, 1, [5432]])("recusa porta publicada ou prova ausente: %j", portas => {
  expect(() => conferirProva({ ...prova(), portsPublished: portas })).toThrow("restauração isolada");
});
it("recusa rede externa, trabalhos ativados e conteúdo não conferido", () => {
  expect(() => conferirProva({ ...prova(), containerNetwork: "bridge" })).toThrow();
  expect(() => conferirProva({ ...prova(), jobsActivated: true })).toThrow();
  expect(() => conferirProva({ ...prova(), equal: false })).toThrow();
});
it("inclui CLI, domínio, persistência, schema e migration no vínculo da revisão", () => {
  expect(ARQUIVOS_CODIGO_HISTORICO).toContain("scripts/historico-importar.ts");
  expect(ARQUIVOS_CODIGO_HISTORICO).toContain("src/lib/vendas/historico-importacao.ts");
  expect(ARQUIVOS_CODIGO_HISTORICO).toContain("prisma/migrations/20261015020000_pedidos_historicos/migration.sql");
});
