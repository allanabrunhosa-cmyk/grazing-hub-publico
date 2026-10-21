import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ query: vi.fn(), sessao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: m.query } }));
vi.mock("@/lib/session", () => ({ getSession: m.sessao }));
import { consultarHistoricoImportado } from "@/lib/vendas/historico-consultas";
import { GET } from "@/app/api/vendas/historico/route";
const linha = () => ({ pedidoId: "historico-sintetico", numeroOriginal: "22851", linha: 2,
  registro: { data_criacao: { mes: "2026-08", local_exato: "2026-08-31T23:50:00" },
    totais: { subtotal_produtos_original: "2217.00", desconto_itens: "20.00", frete_ajuste_original: "22.00", total_original: "2219.00" },
    itens: [{ bloco: 1, quantidade: "2", liquido_linha: "1804.66" }, { bloco: 2, quantidade: "1", liquido_linha: "392.34" }] },
  consumo: [], pagamento: { dataLocal: "2026-09-01T00:10:00", mes: "2026-09", total: "2219.00" } });
beforeEach(() => { vi.clearAllMocks(); m.sessao.mockResolvedValue({ admin: true, permissoes: {}, excecoes: {} }); m.query.mockResolvedValue([linha()]); });
it("recusa consulta anônima antes de ler o banco", async () => {
  m.sessao.mockResolvedValue(null);
  const resposta = await GET(new Request("https://example.invalid/api/vendas/historico"));
  expect(resposta.status).toBe(401); expect(resposta.headers.get("Cache-Control")).toBe("private, no-store"); expect(m.query).not.toHaveBeenCalled();
});
it("exige permissão específica do financeiro e estoque", async () => {
  m.sessao.mockResolvedValue({ admin: false, permissoes: { "vendas.pedidos": ["visualizar"] }, excecoes: {} });
  await expect(consultarHistoricoImportado({ tipo: "pagamentos" })).rejects.toMatchObject({ status: 403 });
  await expect(consultarHistoricoImportado({ tipo: "consumo" })).rejects.toMatchObject({ status: 403 }); expect(m.query).not.toHaveBeenCalled();
});
it("totaliza cada pedido uma vez apesar de vários itens", async () => {
  const r = await consultarHistoricoImportado();
  expect(r.meses).toEqual([{ mes: "2026-08", pedidos: 1, itens: 2, itensFontePrincipal: 2, itensComplementares: 0, itensQuantidadeNaoApurada: 0, unidades: "3", bruto: "2217.00", descontos: "20.00", freteAjusteOriginal: "22.00", total: "2219.00" }]);
  expect(r.efeitoEstoque).toBe(false); expect(r.efeitoFinanceiro).toBe(false);
});
it("classifica pagamento de pedido de agosto em setembro sem entrada bancária", async () => {
  const r = await consultarHistoricoImportado({ tipo: "pagamentos", mes: "2026-09" });
  expect(r.meses[0].mes).toBe("2026-09"); expect(r.registros[0]).toMatchObject({ protegidoSetembro: true, efeitoOperacional: false, comprovacao: "FONTE_SEM_CONCILIACAO" });
  expect(r.aviso).toContain("Não comprova crédito bancário");
});
it("separa os itens recuperados sem repetir o valor do pedido", async () => {
  const l = linha();
  m.query.mockResolvedValue([{ ...l, registro: { ...l.registro, itens: [...l.registro.itens,
    { bloco: 11, quantidade: "2", liquido_linha: "100.00", origem: "WOOCOMMERCE_COMPLEMENTAR" }] } }]);
  const r = await consultarHistoricoImportado();
  expect(r.meses[0]).toMatchObject({ pedidos: 1, itens: 3, itensFontePrincipal: 2, itensComplementares: 1, unidades: "5", total: "2219.00" });
});
it("não inventa pagamento quando Paid Date está ausente", async () => {
  m.query.mockResolvedValue([{ ...linha(), pagamento: null }]);
  const r = await consultarHistoricoImportado({ tipo: "pagamentos" }); expect(r.total).toBe(0); expect(r.meses).toEqual([]);
});
it("preserva item com quantidade não apurada sem bloquear a consulta", async () => {
  const l = linha(); const incompleto = { ...l.registro.itens[0], quantidade: null };
  m.query.mockResolvedValue([{ ...l, registro: { ...l.registro, itens: [incompleto, l.registro.itens[1]] } }]);
  const r = await consultarHistoricoImportado(); expect(r.meses[0]).toMatchObject({ itens: 2, unidades: "1", itensQuantidadeNaoApurada: 1 });
});
it("mantém sinal negativo e total zero sem esconder corrupção numérica", async () => {
  const l = linha(); l.registro.totais.frete_ajuste_original = "-2197.00"; l.registro.totais.total_original = "0.00"; m.query.mockResolvedValue([l]);
  const r = await consultarHistoricoImportado(); expect(r.meses[0]).toMatchObject({ freteAjusteOriginal: "-2197.00", total: "0.00" });
  l.registro.totais.total_original = "desconhecido"; await expect(consultarHistoricoImportado()).rejects.toMatchObject({ status: 503 });
});
it("recusa filtros inválidos sem consultas e não devolve erros internos", async () => {
  await expect(consultarHistoricoImportado({ numero: "1; select" })).rejects.toMatchObject({ status: 400 });
  await expect(consultarHistoricoImportado({ mes: "2026-13" })).rejects.toMatchObject({ status: 400 }); expect(m.query).not.toHaveBeenCalled();
  m.query.mockRejectedValue(new Error("conexao-segredo-ficticio"));
  const r = await GET(new Request("https://example.invalid/api/vendas/historico")); expect(r.status).toBe(503); expect(await r.text()).not.toContain("segredo");
});
