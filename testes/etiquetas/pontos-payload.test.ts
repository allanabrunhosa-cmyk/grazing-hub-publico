import { expect, it } from "vitest";
import { lerJsonLimitado } from "@/lib/etiquetas/pontos-payload";

it("limita corpo do conector mesmo sem Content-Length", async () => {
  const curto = new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ estado: "INCERTO" }) });
  expect(await lerJsonLimitado(curto, 100)).toEqual({ estado: "INCERTO" });
  const longo = new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ lixo: "x".repeat(200) }) });
  expect(await lerJsonLimitado(longo, 100)).toBeNull();
});
