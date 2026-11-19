import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { validarRedirectCliente } from "@/lib/mcp/administracao";

describe("MCP: redirecionamento aceito no cadastro de aplicação", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("em produção aceita HTTPS e o retorno local de aplicativo instalado em 127.0.0.1 com porta", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const valor of ["https://cliente.example.invalid/oauth/callback", "http://127.0.0.1:28417/mcp-auth", "http://127.0.0.1:8080/"]) {
      expect(validarRedirectCliente(valor)).toBe(valor);
    }
  });

  it("em produção recusa HTTP fora de 127.0.0.1, sem porta, por nome ou por grafias alternativas do IP", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const valor of [
      "http://cliente.example.invalid/callback",
      "http://localhost:28417/mcp-auth",
      "http://127.0.0.1/mcp-auth",
      "http://127.0.0.1:80/mcp-auth",
      "http://127.1:28417/mcp-auth",
      "http://2130706433:28417/mcp-auth",
      "http://0.0.0.0:28417/mcp-auth",
      "http://192.168.0.10:28417/mcp-auth",
      "http://[::1]:28417/mcp-auth",
      "http://127.0.0.1.example.invalid:28417/mcp-auth",
      "http://usuario@127.0.0.1:28417/mcp-auth",
      "http://127.0.0.1:28417/mcp-auth#fragmento",
      "http://127.0.0.1:28417/mcp-auth?code=abc",
      "ftp://127.0.0.1:28417/mcp-auth",
      "aplicativo://retorno",
    ]) {
      expect(() => validarRedirectCliente(valor), valor).toThrow();
    }
  });

  it("fora de produção mantém localhost para desenvolvimento", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(validarRedirectCliente("http://localhost:3000/callback")).toBe("http://localhost:3000/callback");
  });
});
