import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { PedidoOAuthSchema } from "@/lib/mcp/oauth";

const pedido = {
  response_type: "code",
  client_id: "ecb17c1f-5c99-4ef8-9c01-58e659a9ead2",
  redirect_uri: "https://cliente.example.invalid/oauth/callback",
  resource: "https://grazinghub.com.br/api/mcp",
  scope: "financeiro:dre:ler",
  state: "estado-oauth-ficticio-0123456789",
  code_challenge: "a".repeat(43),
  code_challenge_method: "S256",
};

describe("Parâmetros OAuth enviados pelo cliente", () => {
  it("aceita ui_locales pt-BR do ChatGPT sem alterar os parâmetros de segurança", () => {
    expect(PedidoOAuthSchema.parse({ ...pedido, ui_locales: "pt-BR" })).toEqual({ ...pedido, ui_locales: "pt-BR" });
  });

  it("mantém compatibilidade sem preferência de idioma e aceita lista BCP 47", () => {
    expect(PedidoOAuthSchema.parse(pedido)).toEqual(pedido);
    expect(PedidoOAuthSchema.parse({ ...pedido, ui_locales: "pt-BR en-US" }).ui_locales).toBe("pt-BR en-US");
  });

  it.each(["", "pt_BR", "pt-BR\n", "pt--BR", "a".repeat(257), Array(11).fill("pt-BR").join(" ")])("recusa preferência de idioma inválida ou excessiva: %j", ui_locales => {
    expect(() => PedidoOAuthSchema.parse({ ...pedido, ui_locales })).toThrow();
  });

  it("idioma não torna PKCE, resource ou escopos opcionais nem libera outros parâmetros", () => {
    for (const campo of ["code_challenge", "resource", "scope"]) {
      const entrada: Record<string, unknown> = { ...pedido, ui_locales: "pt-BR" };
      delete entrada[campo];
      expect(() => PedidoOAuthSchema.parse(entrada)).toThrow();
    }
    expect(() => PedidoOAuthSchema.parse({ ...pedido, ui_locales: "pt-BR", code_challenge_method: "plain" })).toThrow();
    expect(() => PedidoOAuthSchema.parse({ ...pedido, ui_locales: "pt-BR", client_secret: "valor-ficticio" })).toThrow();
  });
});
