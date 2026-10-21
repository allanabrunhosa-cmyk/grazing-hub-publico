import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
const s = vi.hoisted(() => ({ loja: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoLoja: { findUnique: s.loja } } }));
import { calcularEntrega, validarFretePedido } from "@/lib/vendas/entregas";
import { entregasVazias, type ConfiguracaoEntregas } from "@/lib/vendas/entregas-dominio";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
const endereco = { cep: "01234567", logradouro: "Rua sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const config = (): ConfiguracaoEntregas => ({ ...entregasVazias(), modelo: "SLOTS", ativo: true, origemTipo: "PERSONALIZADA", origem: endereco,
  veiculos: [{ id: "m", nome: "Moto sintética", perfil: "MOTO", ativo: true, slotsMinimos: 0, slotsMaximos: 3 }, { id: "c", nome: "Carro sintético", perfil: "CARRO", ativo: true, slotsMinimos: 4, slotsMaximos: 20 }, { id: "c2", nome: "Outro carro sintético", perfil: "CARRO", ativo: true, slotsMinimos: 21, slotsMaximos: 30 }], faixas: [{ id: "a", limiteMetros: 2000, preco: "0", precos: { m: "22.00", c: "24.00", c2: "28.00" } }] });
const sessao = { userId: "u", versao: 0 } as SessaoAtual;
const entrada = (veiculoEntregaId: string | null = "c", slotsOcupados: number | null = null) => ({ clienteId: "cliente-sintetico", atendimento: "ENTREGA" as const, endereco, subtotalProdutos: "100.00", veiculoEntregaId, slotsOcupados });
const rota = { provedor: "GOOGLE_MAPS" as const, distanciaMetros: 1500, duracaoSegundos: 120, origem: { placeId: "o", descricao: "Origem sintética", precisao: "ROOFTOP" }, destino: { placeId: "d", descricao: "Destino sintético", precisao: "ROOFTOP" }, polyline: "transitoria" };
const tx = () => ({ $executeRaw: vi.fn(), $queryRaw: vi.fn(), configuracaoLoja: { findUnique: s.loja }, usuario: { findUnique: vi.fn(async () => null) } }) as unknown as Prisma.TransactionClient;
function pedido(recibo: string, veiculoEntregaId: string | null = "c", frete = "24"): PedidoEntrada { return { clienteId: "cliente-sintetico", atendimento: "ENTREGA", endereco, prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, observacoes: "", desconto: "0", frete, canalId: "canal", itens: [], veiculoEntregaId, entrega: { metodo: "AUTOMATICO", recibo, motivo: "", excecaoCobertura: false, motivoCobertura: "" } }; }
beforeEach(() => { vi.stubEnv("AUTH_SECRET", "segredo-sintetico-testes-veiculo-operador"); vi.stubEnv("GOOGLE_MAPS_API_KEY", "sintetica"); vi.stubEnv("GOOGLE_MAPS_ENTREGAS_ATIVADO", "1"); s.loja.mockResolvedValue({ versaoEntregas: 1, entregas: config() }); });
afterEach(() => vi.unstubAllEnvs());

describe("veículo escolhido somente para este pedido", () => {
  it.each([null, 1, 99])("calcula e confirma veículo explícito com ocupação %s sem modificar catálogo", async slots => {
    const c = config(), antes = structuredClone(c); s.loja.mockResolvedValue({ versaoEntregas: 1, entregas: c }); const provedor = { calcular: vi.fn(async () => rota) };
    const calculo = await calcularEntrega(entrada("c", slots), sessao, provedor); expect(calculo).toMatchObject({ veiculo: "CARRO", selecaoVeiculo: { id: "c", escolha: "OPERADOR", slotsOcupados: slots }, memoria: { frete: "24.00" } }); expect(provedor.calcular).toHaveBeenCalledWith(expect.any(String), endereco, "CARRO", expect.any(Function));
    const confirmado = await validarFretePedido(tx(), pedido(calculo.recibo), "100", sessao, undefined, [], slots); expect(confirmado).toMatchObject({ frete: "24.00", snapshot: { veiculoEntregaId: "c", selecaoVeiculo: { id: "c", escolha: "OPERADOR", slotsOcupados: slots } } }); expect(c).toEqual(antes);
  });
  it("permite cálculo sem capacidade cadastrada no veículo explicitamente ativo", async () => { const c = config(); c.veiculos![1].slotsMinimos = null; c.veiculos![1].slotsMaximos = null; s.loja.mockResolvedValue({ versaoEntregas: 1, entregas: c }); const calculo = await calcularEntrega(entrada(), sessao, { calcular: vi.fn(async () => rota) }); expect(calculo.memoria.frete).toBe("24.00"); expect((await validarFretePedido(tx(), pedido(calculo.recibo), "100", sessao, undefined, [], null)).frete).toBe("24.00"); });
  it("sem escolha mantém automático e pendência por ausência de slots", async () => { const provedor = { calcular: vi.fn(async () => rota) }; const calculo = await calcularEntrega(entrada(null, null), sessao, provedor); expect(calculo.memoria.frete).toBeNull(); expect(provedor.calcular).not.toHaveBeenCalled(); await expect(validarFretePedido(tx(), pedido(calculo.recibo, null), "100", sessao, undefined, [], null)).rejects.toThrow("slots"); });
  it.each(["m", "c2", null])("recusa recibo ao trocar o veículo para %s, inclusive mesmo perfil", async escolhido => { const calculo = await calcularEntrega(entrada("c", 1), sessao, { calcular: vi.fn(async () => rota) }); await expect(validarFretePedido(tx(), pedido(calculo.recibo, escolhido), "100", sessao, undefined, [], 1)).rejects.toThrow("outras entradas"); });
  it("recusa recibo automático para seleção explícita do mesmo veículo", async () => { const calculo = await calcularEntrega(entrada(null, 4), sessao, { calcular: vi.fn(async () => rota) }); await expect(validarFretePedido(tx(), pedido(calculo.recibo, "c"), "100", sessao, undefined, [], 4)).rejects.toThrow("outras entradas"); });
  it("não reutiliza recibo após perfil, slots ou versão mudarem", async () => {
    const calculo = await calcularEntrega(entrada("c", null), sessao, { calcular: vi.fn(async () => rota) }); await expect(validarFretePedido(tx(), pedido(calculo.recibo), "100", sessao, undefined, [], 1)).rejects.toThrow("outras entradas");
    const c = config(); c.veiculos![1].perfil = "MOTO"; s.loja.mockResolvedValue({ versaoEntregas: 1, entregas: c }); await expect(validarFretePedido(tx(), pedido(calculo.recibo), "100", sessao, undefined, [], null)).rejects.toThrow("outras entradas"); s.loja.mockResolvedValue({ versaoEntregas: 2, entregas: config() }); await expect(validarFretePedido(tx(), pedido(calculo.recibo), "100", sessao, undefined, [], null)).rejects.toThrow("outras entradas");
  });
  it("recusa veículo inexistente ou inativo antes da rota", async () => { const provedor = { calcular: vi.fn(async () => rota) }; await expect(calcularEntrega(entrada("desconhecido"), sessao, provedor)).rejects.toThrow("indisponível"); const c = config(); c.veiculos![1].ativo = false; s.loja.mockResolvedValue({ versaoEntregas: 1, entregas: c }); await expect(calcularEntrega(entrada(), sessao, provedor)).rejects.toThrow("indisponível"); expect(provedor.calcular).not.toHaveBeenCalled(); });
  it("mantém snapshot anterior sem recálculo em revisão não comercial e exige cálculo na troca", async () => {
    const calculo = await calcularEntrega(entrada("c", null), sessao, { calcular: vi.fn(async () => rota) }), d = pedido(calculo.recibo), confirmado = await validarFretePedido(tx(), d, "100", sessao, undefined, [], null); const snapshotPersistido = JSON.parse(JSON.stringify(confirmado.snapshot)) as Prisma.JsonValue; const anterior = { entregaSnapshot: snapshotPersistido, frete: new Prisma.Decimal(confirmado.frete) };
    s.loja.mockResolvedValue({ versaoEntregas: 9, entregas: { ...config(), veiculos: config().veiculos!.map(v => ({ ...v, ativo: false })) } }); const preservado = await validarFretePedido(tx(), { ...d, entrega: null }, "100", sessao, anterior, [], null); expect(preservado.snapshot).toEqual(confirmado.snapshot);
    s.loja.mockResolvedValue({ versaoEntregas: 9, entregas: config() }); await expect(validarFretePedido(tx(), { ...d, veiculoEntregaId: "m", entrega: null }, "100", sessao, anterior, [], null)).rejects.toThrow("Calcule o frete");
  });
  it("não libera cobertura, preço divergente nem ajuste manual sem autorização", async () => {
    const calculo = await calcularEntrega(entrada(), sessao, { calcular: vi.fn(async () => ({ ...rota, distanciaMetros: 2001 })) }); await expect(validarFretePedido(tx(), pedido(calculo.recibo), "100", sessao, undefined, [], null)).rejects.toThrow("limitada"); const permitido = await calcularEntrega(entrada(), sessao, { calcular: vi.fn(async () => rota) }); await expect(validarFretePedido(tx(), pedido(permitido.recibo, "c", "1"), "100", sessao, undefined, [], null)).rejects.toThrow("Frete divergente"); const d = pedido(permitido.recibo); d.entrega!.metodo = "MANUAL"; d.entrega!.motivo = "Acordo sintético"; await expect(validarFretePedido(tx(), d, "100", sessao, undefined, [], null)).rejects.toThrow("acesso");
  });
});
