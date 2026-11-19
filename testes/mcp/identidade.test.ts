import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/app/(protegido)/configuracoes/integracoes/mcp/actions", () => ({ salvarMcpAction: vi.fn(), diagnosticarMcpAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { identidadeServidorMcp } from "@/lib/mcp/metadados";
import { recursoEstatico } from "@/lib/hosts";
import { itensDoSeletor, logoDaAplicacao, monogramaDaAplicacao } from "@/app/(protegido)/configuracoes/integracoes/seletor";

describe("MCP: identificação do servidor e das conexões", () => {
  it("apresenta nome de exibição, site e ícones PNG públicos que existem no projeto", () => {
    const identidade = identidadeServidorMcp();
    expect(identidade).toMatchObject({ name: "grazing-hub", title: "Grazing HUB", websiteUrl: "https://grazinghub.com.br" });
    expect(identidade.icons).toHaveLength(2);
    for (const icone of identidade.icons) {
      const url = new URL(icone.src);
      expect(url.origin).toBe("https://grazinghub.com.br");
      expect(icone.mimeType).toBe("image/png");
      expect(recursoEstatico(url.pathname), "ícone precisa ser servido sem sessão").toBe(true);
      expect(existsSync(`public${url.pathname}`), url.pathname).toBe(true);
    }
  });

  it("gera iniciais da aplicação para distinguir as conexões", () => {
    expect(monogramaDaAplicacao("OpenBot")).toBe("OB");
    expect(monogramaDaAplicacao("ChatGPT — Allan")).toBe("CG");
    expect(monogramaDaAplicacao("claude")).toBe("C");
    expect(monogramaDaAplicacao("Ágil 2")).toBe("Á2");
    expect(monogramaDaAplicacao("—")).toBe("");
  });

  it("no seletor, conexões levam iniciais e o Servidor MCP leva a marca do HUB", () => {
    const itens = itensDoSeletor({ mcp: { endereco: "https://grazinghub.com.br/api/mcp", ativo: true, configurado: true, editar: true,
      conexoes: [{ id: "c1", nome: "Assistente fictício", clienteNome: "OpenBot", situacao: "ATIVA" }] }, brasilnfe: true, certificado: null });
    expect(itens.find(i => i.id === "mcp:c1")).toMatchObject({ monograma: "OB" });
    expect(itens.find(i => i.id === "mcp:servidor")).toMatchObject({ marca: "hub" });
    expect(itens.find(i => i.id === "brasilnfe")).not.toHaveProperty("monograma");
  });

  it("usa o logo de sistemas conhecidos, servido sem sessão, e recai nas iniciais para os demais", () => {
    expect(logoDaAplicacao("OpenBot")).toBe("/marca/integracoes/openbot.png");
    expect(logoDaAplicacao("ChatGPT — Allan")).toBe("/marca/integracoes/chatgpt.png");
    expect(logoDaAplicacao("Cliente de demonstração")).toBeUndefined();
    const itens = itensDoSeletor({ mcp: { endereco: "https://grazinghub.com.br/api/mcp", ativo: true, configurado: true, editar: false,
      conexoes: [{ id: "c1", nome: "Assistente fictício", clienteNome: "OpenBot", situacao: "ATIVA" }, { id: "c2", nome: "Outro fictício", clienteNome: "Cliente fictício", situacao: "ATIVA" }] }, brasilnfe: true, certificado: null });
    expect(itens.find(i => i.id === "mcp:c2")?.logo).toBeUndefined();
    const logos = itens.map(i => i.logo).filter((l): l is string => !!l);
    expect(logos).toEqual(["/marca/integracoes/openbot.png", "/marca/integracoes/brasilnfe.png"]);
    for (const logo of [...logos, "/marca/integracoes/chatgpt.png"]) {
      expect(recursoEstatico(logo)).toBe(true);
      expect(existsSync(`public${logo}`), logo).toBe(true);
    }
  });
});
