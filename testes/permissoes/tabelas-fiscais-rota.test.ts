import { afterEach, describe, expect, it, vi } from "vitest";
const permissao = vi.hoisted(() => vi.fn());
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: permissao }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regime-empresa", () => ({ obterRegimeFiscalEmpresaBrasilNfe: vi.fn(async () => ({ crt: 1 })) }));
import { GET } from "@/app/api/fiscal/tabelas/route";
afterEach(() => vi.clearAllMocks());
describe("Consulta protegida de tabelas fiscais", () => {
  it("nega acesso sem permissão fiscal no servidor", async () => {
    permissao.mockResolvedValue(false);
    const r = await GET(new Request("http://localhost/api/fiscal/tabelas?tabela=ncm"));
    expect(r.status).toBe(403); expect(permissao).toHaveBeenCalledWith("vendas.fiscal", "visualizar");
  });
  it("retorna somente códigos públicos limitados com sessão autorizada", async () => {
    permissao.mockResolvedValue(true);
    const r = await GET(new Request("http://localhost/api/fiscal/tabelas?tabela=ncm&busca=19059090&dia=2026-10-14"));
    expect(r.status).toBe(200); const json = await r.json(); expect(json.opcoes).toHaveLength(1);
    expect(JSON.stringify(json)).not.toMatch(/Token|UserToken|Cookie|AUTH_SECRET|DATABASE_URL/);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["tabela=naoexiste", "tabela=ncm&crt=0", "tabela=cfop&modelo=99", "tabela=ncm&busca=" + "x".repeat(101), "tabela=cest&ncm=abcd", "tabela=ncm&dia=2026-02-30"])("rejeita pesquisa inválida: %s", async q => {
    permissao.mockResolvedValue(true); expect((await GET(new Request("http://localhost/api/fiscal/tabelas?" + q))).status).toBe(400);
  });
});
