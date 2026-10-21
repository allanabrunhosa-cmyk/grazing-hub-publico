import { beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ sessao: vi.fn(), pode: vi.fn(), consultar: vi.fn(), mapa: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: sim.pode }));
vi.mock("@/lib/vendas/bi-consultas", () => ({ consultarBiVendas: sim.consultar }));
vi.mock("@/lib/vendas/bi-mapa-consultas", () => ({ consultarMapaBi: sim.mapa }));
import { POST } from "@/app/api/vendas/bi/mapa/route";
import * as rota from "@/app/api/vendas/bi/mapa/route";
import { ErroBi, normalizarFiltrosBi } from "@/lib/vendas/bi-filtros";

const url = "https://grazinghub.com.br/api/vendas/bi/mapa";
const requisicao = (endereco = url, cabecalhos: Record<string, string> = {}) => new Request(endereco, { method: "POST", headers: { host: "grazinghub.com.br", origin: "https://grazinghub.com.br", "sec-fetch-site": "same-origin", ...cabecalhos } });
beforeEach(() => {
  vi.resetAllMocks(); sim.sessao.mockResolvedValue({ userId: "usuario-sintetico" });
  sim.pode.mockImplementation(async (recurso: string) => recurso === "vendas.bi");
  sim.consultar.mockResolvedValue({ locaisEntrega: [{ chave: "Bairro sintético", consulta: "Bairro sintético, Cidade sintética - SP, Brasil", pedidos: 4, precisao: "bairro" }], cobertura: { entregas: 5 } });
  sim.mapa.mockResolvedValue({ estado: "parcial", pontos: [], avisos: [] });
});
describe("BI: acesso ao mapa regional", () => {
  it("não consulta o HUB ou o provedor sem sessão", async () => {
    sim.sessao.mockResolvedValue(null);
    const r = await POST(requisicao()); expect(r.status).toBe(401); expect(sim.pode).not.toHaveBeenCalled(); expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.mapa).not.toHaveBeenCalled();
  });
  it("exige permissão BI no servidor", async () => {
    sim.pode.mockResolvedValue(false);
    const r = await POST(requisicao()); expect(r.status).toBe(403); expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.mapa).not.toHaveBeenCalled();
  });
  it("usa filtros da seleção e permissões próprias, sem aceitar consultas/contatos arbitrários", async () => {
    const r = await POST(requisicao(`${url}?de=2026-01-01&ate=2026-09-30&agrupamentoRegiao=cep&consulta=Rua+indevida+100&contatos=true&custos=true`));
    expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(sim.consultar).toHaveBeenCalledWith({ de: "2026-01-01", ate: "2026-09-30", agrupamentoRegiao: "cep" }, { contatos: false, custos: false, pedidos: false });
    expect(sim.mapa).toHaveBeenCalledWith((await sim.consultar.mock.results[0].value).locaisEntrega, { usuarioId: "usuario-sintetico", totalEntregas: 5 });
  });
  it.each(["cliente", "tipoCliente"])("restrição do filtro %s impede a consulta ao provedor", async filtro => {
    sim.consultar.mockRejectedValue(new ErroBi("Seu acesso não permite consultar compradores identificados.", 403));
    const r = await POST(requisicao(`${url}?${filtro}=PJ`)); expect(r.status).toBe(403); expect(sim.mapa).not.toHaveBeenCalled();
  });
  it("erro de filtro numérico não chega ao provedor", async () => {
    sim.consultar.mockImplementation(async entrada => { normalizarFiltrosBi(entrada); return {}; });
    const r = await POST(requisicao(`${url}?diasSemRecompra=1e2`)); expect(r.status).toBe(400); expect(sim.mapa).not.toHaveBeenCalled();
  });
  it("oculta falhas internas e não devolve nomes, payload ou credenciais", async () => {
    sim.consultar.mockRejectedValue(new Error("credencial privada e nome pessoal"));
    const r = await POST(requisicao()); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toMatch(/privada|pessoal/u); expect(sim.mapa).not.toHaveBeenCalled();
  });
  it.each([
    { origin: "https://externo.invalid" }, { origin: "null" }, { "sec-fetch-site": "cross-site" },
    { host: "externo.invalid" }, { "x-forwarded-host": "externo.invalid" },
    { host: "pedidos.grazinghub.com.br", origin: "https://pedidos.grazinghub.com.br" },
  ] as Record<string, string>[])("recusa origem/host não autorizado antes de consumir cota: %j", async cabecalhos => {
    const r = await POST(requisicao(url, cabecalhos)); expect(r.status).toBe(403); expect(sim.sessao).not.toHaveBeenCalled(); expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.mapa).not.toHaveBeenCalled();
  });
  it("não exporta GET: o Route Handler do Next recusa esse método com405", () => {
    expect("GET" in rota).toBe(false); expect("POST" in rota).toBe(true);
  });
});
