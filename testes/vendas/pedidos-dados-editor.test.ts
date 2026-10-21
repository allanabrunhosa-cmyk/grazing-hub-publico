import { beforeEach, expect, it, vi } from "vitest";

const sim = vi.hoisted(() => ({ clientes: vi.fn(), loja: vi.fn(), horarios: vi.fn(), produtos: vi.fn(), entregas: vi.fn(), acesso: vi.fn(), identidade: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoLoja: { findUnique: sim.loja }, clienteVenda: { findMany: sim.clientes }, canalVenda: { findMany: async () => [] }, formaPagamentoVenda: { findMany: async () => [] } } }));
vi.mock("@/lib/vendas/pedidos-horarios", () => ({ consultarHorariosPedidos: sim.horarios }));
vi.mock("@/lib/vendas/consultas", () => ({ consultarProdutos: sim.produtos }));
vi.mock("@/lib/vendas/entregas", () => ({ consultarEntregas: sim.entregas }));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: sim.acesso }));
vi.mock("@/lib/contexto-interface", () => ({ identidadeDaInterface: sim.identidade }));
import { dadosEditorPedido } from "@/app/(protegido)/vendas/pedidos/dados-editor";

const raiz = { id: "cliente-raiz", versao: 7, nome: "Empresa Canônica", tipo: "PJ", documento: "11444777000161", razaoSocial: "Empresa Canônica Ltda", email: "principal@example.invalid", dataNascimento: new Date("2001-05-09T00:00:00Z"), enderecos: [{ nome: "Principal", tipo: "PJ", documento: "11444777000161", logradouro: "Rua Principal", numero: "10", cep: "01001000" }], entregaPadrao: null };
beforeEach(() => {
  vi.clearAllMocks();
  sim.horarios.mockResolvedValue({ horarios: null });
  sim.produtos.mockResolvedValue({ produtos: [] });
  sim.entregas.mockResolvedValue({ versao: 0, config: { ativo: false, veiculos: [], regrasVeiculo: [], veiculoPadraoId: null, veiculo: "MOTO" }, pendencias: [] });
  sim.acesso.mockResolvedValue(false);
  sim.identidade.mockResolvedValue("hub");
  sim.loja.mockResolvedValue({ fusoHorario: "America/Sao_Paulo" });
});

it("data inicial da compra usa o fuso da loja, inclusive antes da meia-noite local", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-10-21T01:30:00Z"));
    sim.clientes.mockResolvedValue([]);
    expect((await dadosEditorPedido()).dataCompraPadrao).toBe("2026-10-20");
    expect(sim.loja).toHaveBeenCalledWith({ where: { id: "singleton" }, select: { fusoHorario: true } });
  } finally { vi.useRealTimers(); }
});

it("editor recebe identificadores dos aliases e conserva o titular principal, sem enviar JSON bruto da relação", async () => {
  const aliases = [{ email: " ALTERNATIVO@EXAMPLE.INVALID ", tipo: "PF", documento: "123.456.789-01", enderecos: [{ tipo: "PF", documento: "123.456.789-01", logradouro: "Endereço privado do alias" }] }, { email: "alternativo@example.invalid", tipo: "PJ", documento: null, enderecos: [{ tipo: "PJ", documento: "11.222.333/0001-81", logradouro: "Outro endereço privado do alias" }, { tipo: "PJ", documento: "99999999999999" }] }];
  sim.clientes.mockResolvedValue([{ ...raiz, clientesUnificados: aliases }]);
  const resposta = await dadosEditorPedido(), cliente = resposta.clientes[0];
  expect(sim.clientes).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true, unificadoEmId: null }, select: expect.objectContaining({ clientesUnificados: { select: { email: true, tipo: true, documento: true, enderecos: true } } }) }));
  expect(cliente).toMatchObject({ id: raiz.id, versao: raiz.versao, nome: raiz.nome, documento: raiz.documento, email: raiz.email, dataNascimento: "2001-05-09", emailsAlternativos: ["alternativo@example.invalid"], documentosAlternativos: ["12345678901", "11222333000181"], enderecos: raiz.enderecos });
  expect(cliente).not.toHaveProperty("clientesUnificados");
  expect(JSON.stringify(cliente)).not.toContain("Endereço privado do alias");
  expect(JSON.stringify(cliente)).not.toContain("Outro endereço privado do alias");
  expect(cliente.documentosAlternativos).not.toContain("99999999999999");
});

it("cadastro sem aliases recebe listas vazias sem alterar os campos e endereços da raiz", async () => {
  sim.clientes.mockResolvedValue([{ ...raiz, clientesUnificados: [] }]);
  const cliente = (await dadosEditorPedido()).clientes[0];
  expect(cliente).toMatchObject({ nome: raiz.nome, documento: raiz.documento, email: raiz.email, emailsAlternativos: [], documentosAlternativos: [], enderecos: raiz.enderecos, entregaPadrao: null });
  expect(cliente).not.toHaveProperty("clientesUnificados");
  expect(cliente.enderecos).not.toBe(raiz.enderecos);
});
