import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { consultarResumoPedido } from "@/lib/vendas/consultar-resumo-pedido";
import { pedidoResumoSintetico } from "./resumo-pedido.fixture";

const mocks = vi.hoisted(() => ({ buscar: vi.fn(), calcular: vi.fn(), transacao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transacao } }));
vi.mock("@/lib/vendas/pedidos", () => ({ calcularPedido: mocks.calcular }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transacao.mockImplementation(async fn => fn({ pedidoVenda: { findUnique: mocks.buscar } }));
});

it("usa valores/snapshots históricos confirmados sem recálculo ou escrita e inclui complementos no unitário", async () => {
  mocks.buscar.mockResolvedValue({ ...pedidoResumoSintetico, itens: [{ ...pedidoResumoSintetico.itens[0], precoAplicado: new Prisma.Decimal("180.00"), acrescimos: new Prisma.Decimal("20.00"), totalLinha: new Prisma.Decimal("385.71"), desconto: new Prisma.Decimal("14.29") }] });
  const dados = await consultarResumoPedido("pedido-sintetico");
  expect(dados.cliente.empresa).toBe("Empresa de exemplo Ltda.");
  expect(dados.total).toBe("575.00");
  expect(dados.itens[0]).toMatchObject({ precoUnitario: "200.00", total: "400.00" });
  expect(mocks.calcular).not.toHaveBeenCalled();
  expect(mocks.buscar).toHaveBeenCalledWith({ where: { id: "pedido-sintetico" }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
  expect(mocks.transacao).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 30000 });
});

it("orçamento completo sem pagamento usa cálculo oficial em leitura, ignorando totais zero persistidos no rascunho", async () => {
  const rascunho = { clienteId: "cliente-sintetico", canalId: "canal-sintetico", atendimento: "RETIRADA", prazo: "IMEDIATO", desconto: "0", frete: "0", observacoes: "", itens: [{ produtoId: "produto-sintetico", quantidade: "0.125", observacoes: "", escolhas: {}, precoManual: null }] };
  mocks.buscar.mockResolvedValue({ ...pedidoResumoSintetico, status: "RASCUNHO", total: "0", subtotal: "0", rascunho, itens: [] });
  mocks.calcular.mockResolvedValue({ compradorSnapshot: pedidoResumoSintetico.compradorSnapshot, subtotal: "12.51", total: "12.51", desconto: "0", frete: "0", outrosCustos: "0", atendimento: "RETIRADA", itens: [{ produtoSnapshot: { nome: "Produto calculado" }, quantidade: "0.125", unidadeSnapshot: "KG", precoAplicado: "100.00", acrescimos: "0.08", totalLinha: "12.51", desconto: "0.00" }] });
  const dados = await consultarResumoPedido("pedido-sintetico");
  expect(mocks.calcular).toHaveBeenCalledTimes(1);
  expect(mocks.calcular.mock.calls[0][1].pagamentoInformado ?? null).toBeNull();
  expect(dados).toMatchObject({ status: "RASCUNHO", total: "12.51", subtotal: "12.51" });
  expect(dados.itens[0]).toMatchObject({ nome: "Produto calculado", quantidade: "0,125", precoUnitario: "100.08", total: "12.51" });
});

it("pedido cancelado mantém o resumo comercial sem recalcular preços atuais", async () => {
  mocks.buscar.mockResolvedValue({ ...pedidoResumoSintetico, status: "CANCELADO", itens: [] });
  expect(await consultarResumoPedido("pedido-sintetico")).toMatchObject({ status: "CANCELADO", total: "575.00" });
  expect(mocks.calcular).not.toHaveBeenCalled();
});

it.each(["RETIRADA", "ENTREGA"])("orçamento %s usa o frete canônico da confirmação sem alterar o rascunho", async atendimento => {
  const rascunho = { clienteId: "cliente-sintetico", canalId: "canal-sintetico", atendimento, prazo: "IMEDIATO", destinatario: { nome: "Destinatário sintético" }, endereco: { pais: "Brasil", cep: "00000000", logradouro: "Rua sintética", numero: "1", bairro: "Centro", cidade: "Cidade sintética", uf: "SP" }, desconto: "20.02", frete: "50", outrosCustos: "5.03", observacoes: "", itens: [{ produtoId: "produto-sintetico", quantidade: "1", escolhas: {}, precoManual: null }] };
  const pedido = { ...pedidoResumoSintetico, status: "RASCUNHO", total: "0", subtotal: "0", rascunho, itens: [] };
  const antes = JSON.stringify(pedido);
  mocks.buscar.mockResolvedValue(pedido);
  mocks.calcular.mockResolvedValue({ compradorSnapshot: pedidoResumoSintetico.compradorSnapshot, atendimento, subtotal: "300.01", desconto: "20.02", frete: "50.00", outrosCustos: "5.03", total: "335.02", itens: [] });
  expect(await consultarResumoPedido("pedido-sintetico")).toMatchObject({
    atendimento, subtotal: "300.01", desconto: "20.02", outrosCustos: "5.03", frete: atendimento === "RETIRADA" ? "0.00" : "50.00", total: atendimento === "RETIRADA" ? "285.02" : "335.02",
  });
  expect(mocks.calcular).toHaveBeenCalledTimes(1);
  expect(mocks.calcular.mock.calls[0][1]).toMatchObject({ atendimento, frete: "50" });
  expect(JSON.stringify(pedido)).toBe(antes);
});

it.each(["RETIRADA", "LOCAL"])("resumo de pedido histórico %s preserva o frete sem aplicar regras atuais", async atendimento => {
  mocks.buscar.mockResolvedValue({ ...pedidoResumoSintetico, atendimento, frete: "35.00", total: "575.00", itens: [] });
  expect(await consultarResumoPedido("pedido-sintetico")).toMatchObject({ atendimento, frete: "35.00", total: "575.00" });
  expect(mocks.calcular).not.toHaveBeenCalled();
});

it("não introduz modalidade LOCAL em novos orçamentos", async () => {
  mocks.buscar.mockResolvedValue({ status: "RASCUNHO", rascunho: { atendimento: "LOCAL", itens: [] } });
  await expect(consultarResumoPedido("pedido-sintetico")).rejects.toThrow("Atendimento inválido");
  expect(mocks.calcular).not.toHaveBeenCalled();
});

it("rejeita ID inválido antes da consulta e informa pedido inexistente", async () => {
  await expect(consultarResumoPedido("")).rejects.toThrow("Pedido inválido");
  expect(mocks.transacao).not.toHaveBeenCalled();
  mocks.buscar.mockResolvedValue(null);
  await expect(consultarResumoPedido("ausente")).rejects.toThrow("Pedido não encontrado");
});
