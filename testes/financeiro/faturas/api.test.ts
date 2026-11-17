import { expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({sessao:vi.fn(),arquivo:vi.fn()}));
vi.mock("@/lib/session",()=>({getSession:mocks.sessao}));
vi.mock("@/lib/prisma",()=>({prisma:{arquivoFaturaCartao:{findUnique:mocks.arquivo}}}));
import { GET } from "@/app/api/financeiro/faturas/arquivos/[id]/route";
const pedido=()=>GET(new Request("http://localhost/api/financeiro/faturas/arquivos/f"),{params:Promise.resolve({id:"f"})});
it("não lê documentos sem sessão ou permissão",async()=>{
  mocks.sessao.mockResolvedValue(null);expect((await pedido()).status).toBe(401);
  mocks.sessao.mockResolvedValue({admin:false,permissoes:{},excecoes:{}});expect((await pedido()).status).toBe(403);
  expect(mocks.arquivo).not.toHaveBeenCalled();
});
it("download autorizado é privado, attachment e sem sniffing",async()=>{
  mocks.sessao.mockResolvedValue({admin:true});mocks.arquivo.mockResolvedValue({nome:"fatura.csv",dados:Buffer.from("ficticio")});
  const r=await pedido();expect(r.headers.get("cache-control")).toContain("no-store");expect(r.headers.get("content-disposition")).toBe(`attachment; filename="Grazing - Fatura cartao - fatura.csv"; filename*=UTF-8''Grazing%20-%20Fatura%20cart%C3%A3o%20-%20fatura.csv`);expect(r.headers.get("x-content-type-options")).toBe("nosniff");expect(await r.text()).toBe("ficticio");
});
