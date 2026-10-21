import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const s = vi.hoisted(() => ({ permissao: vi.fn(), acesso: vi.fn(), produto: vi.fn(), vinculados: vi.fn(), entrega: vi.fn(), transacao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: s.permissao }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: s.transacao } }));
vi.mock("@/lib/vendas/pedidos", () => ({ conferirAcesso: s.acesso }));
vi.mock("@/lib/vendas/entregas", () => ({ calcularEntrega: s.entrega }));
import { calcularFretePedidoAction } from "@/app/(protegido)/vendas/pedidos/entregas-actions";

const endereco = { pais: "Brasil", cep: "00000-000", logradouro: "Rua fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const entrada = () => ({ atendimento: "ENTREGA", endereco, itens: [{ produtoId: "p", quantidade: "1" }] });
const produto = () => ({ id: "p", ativo: true, classificacoes: ["PRINCIPAL"], unidade: "UN", preco: new Prisma.Decimal(100), slotsEntrega: 2, tipoEmbalagemId: "caixa", grupos: [] });
const opcao = { id: "o", nome: "Opção fictícia", ativo: true, preco: new Prisma.Decimal(5), quantidade: new Prisma.Decimal("0.5"), produtoId: "c", usarPrecoPadrao: true, composicao: null };
const grupo = () => ({ grupoId: "g", usarPadrao: true, minimo: 1, maximo: 1, opcoesExcluidas: [], ajustesOpcoes: [], grupo: { id: "g", nome: "Escolha obrigatória", tipo: "COMPOSICAO", ativo: true, repetir: true, minimo: 1, maximo: 1, opcoes: [opcao] } });
beforeEach(() => {
  vi.resetAllMocks(); s.permissao.mockResolvedValue({ userId: "u" }); s.produto.mockResolvedValue(produto()); s.vinculados.mockResolvedValue([]);
  s.transacao.mockImplementation(async f => f({ produtoVenda: { findUnique: s.produto, findMany: s.vinculados } }));
  s.entrega.mockResolvedValue({ memoria: { frete: "22.00" }, recibo: "simulado" });
});
describe("ação de frete com catálogo real e entrada mínima", () => {
  it("calcula só com produtos e endereço, ignorando cadastro, cobrança, agenda e pagamento incompletos", async () => {
    const r = await calcularFretePedidoAction({ ...entrada(), clienteNovo: { tipoEscolhido: false }, cobranca: {}, prazo: "AGENDADO", previsaoData: "inválida", referenciaPedido: "parcial", pagamentoInformado: { parcelas: "inválido" } });
    expect(r).toHaveProperty("resultado"); expect(s.permissao).toHaveBeenCalledWith("vendas.pedidos"); expect(s.acesso).toHaveBeenCalledWith(expect.anything(), { userId: "u" }, ["consultar"]);
    expect(s.entrega).toHaveBeenCalledWith(expect.objectContaining({ clienteId: null, endereco, subtotalProdutos: "100.00", slotsOcupados: 2, tiposEmbalagemIds: ["caixa"] }), { userId: "u" });
  });
  it("não exige concluir grupos obrigatórios nem preço positivo para simular a ocupação", async () => {
    s.produto.mockResolvedValue({ ...produto(), preco: new Prisma.Decimal(0), grupos: [grupo()] });
    expect(await calcularFretePedidoAction(entrada())).toHaveProperty("resultado");
    expect(s.entrega.mock.calls[0][0]).toMatchObject({ subtotalProdutos: "0.00", slotsOcupados: 2 });
  });
  it("aceita veículo explícito sem slots e ignora ocupação/preço enviados pelo navegador", async () => {
    s.produto.mockResolvedValue({ ...produto(), slotsEntrega: null });
    expect(await calcularFretePedidoAction({ ...entrada(), veiculoEntregaId: "carro-sintetico", slotsOcupados: 0, subtotalProdutos: "1" })).toHaveProperty("resultado");
    expect(s.entrega).toHaveBeenCalledWith(expect.objectContaining({ veiculoEntregaId: "carro-sintetico", slotsOcupados: null, subtotalProdutos: "100.00" }), { userId: "u" });
  });
  it("usa preço padrão, substituição local, desconto e slots das escolhas conforme o catálogo", async () => {
    s.produto.mockResolvedValue({ ...produto(), grupos: [{ ...grupo(), ajustesOpcoes: [{ opcaoId: "o", preco: "12.50" }] }] });
    s.vinculados.mockResolvedValue([{ id: "c", preco: new Prisma.Decimal(10), slotsEntrega: 3, ativo: true }]);
    expect(await calcularFretePedidoAction({ ...entrada(), desconto: "5", itens: [{ produtoId: "p", quantidade: "2", escolhas: { o: 1 }, precoManual: "80" }], slotsOcupados: 0, subtotal: "1" })).toHaveProperty("resultado");
    expect(s.entrega.mock.calls[0][0]).toMatchObject({ subtotalProdutos: "180.00", slotsOcupados: 7 });
  });
  it("composição substituta utiliza multiplicador um para slots", async () => {
    s.produto.mockResolvedValue({ ...produto(), grupos: [{ ...grupo(), grupo: { ...grupo().grupo, opcoes: [{ ...opcao, composicao: [] }] } }] });
    s.vinculados.mockResolvedValue([{ id: "c", preco: new Prisma.Decimal(10), slotsEntrega: 3, ativo: true }]);
    await calcularFretePedidoAction({ ...entrada(), itens: [{ produtoId: "p", quantidade: "1", escolhas: { o: 1 } }] });
    expect(s.entrega.mock.calls[0][0]).toMatchObject({ subtotalProdutos: "110.00", slotsOcupados: 5 });
  });
  it("arredonda dinheiro por linha e slots somente na soma final", async () => {
    s.produto.mockResolvedValue({ ...produto(), unidade: "KG", preco: new Prisma.Decimal("1.99"), slotsEntrega: 3 });
    await calcularFretePedidoAction({ ...entrada(), itens: [{ produtoId: "p", quantidade: "0.5" }, { produtoId: "p", quantidade: "0.5" }] });
    expect(s.entrega.mock.calls[0][0]).toMatchObject({ subtotalProdutos: "2.00", slotsOcupados: 3 });
  });
  it.each(["0", "abc", "1.2"])("recusa quantidade inválida %s antes de consultar mapas", async quantidade => {
    expect(await calcularFretePedidoAction({ ...entrada(), itens: [{ produtoId: "p", quantidade }] })).toHaveProperty("erro"); expect(s.entrega).not.toHaveBeenCalled();
  });
  it("recusa produto indisponível e seleção desconhecida", async () => {
    s.produto.mockResolvedValueOnce(null); expect(await calcularFretePedidoAction(entrada())).toEqual({ erro: "Produto indisponível." });
    expect(await calcularFretePedidoAction({ ...entrada(), itens: [{ produtoId: "p", quantidade: "1", escolhas: { desconhecida: 1 } }] })).toHaveProperty("erro"); expect(s.entrega).not.toHaveBeenCalled();
  });
  it("recusa acesso não autorizado sem calcular", async () => {
    s.acesso.mockRejectedValue(new Error("Negado")); expect(await calcularFretePedidoAction(entrada())).toHaveProperty("erro"); expect(s.produto).not.toHaveBeenCalled(); expect(s.entrega).not.toHaveBeenCalled();
  });
});
