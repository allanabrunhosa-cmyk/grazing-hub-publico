import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";

const sim = vi.hoisted(() => ({
  emTransacao: false, antes: null as Record<string, unknown> | null, antesTx: null as Record<string, unknown> | null,
  consultar: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), auditar: vi.fn(), transacionar: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/vendas/cnpj", () => ({ consultarCnpjVenda: sim.consultar }));
const tx = {
  $queryRaw: vi.fn(async () => []),
  clienteVenda: { findUnique: vi.fn(async () => sim.antesTx), create: sim.criar, update: sim.atualizar },
  historicoCadastroVenda: { create: sim.auditar },
};
vi.mock("@/lib/prisma", () => ({ prisma: {
  clienteVenda: { findUnique: async () => sim.antes },
  $transaction: async (executar: (banco: unknown) => unknown) => {
    sim.transacionar(); sim.emTransacao = true;
    try { return await executar(tx); } finally { sim.emTransacao = false; }
  },
} }));
import { salvarCliente, salvarClienteNaTransacao } from "@/lib/vendas/persistencia";
const endereco = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "10", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const entrada = { id: "", versao: 0, nome: "Fantasia sintética", tipo: "PJ", documento: "11222333000181", razaoSocial: "Razão digitada", email: "teste@example.invalid", telefone: "+5511999990000", contato: null, observacoes: null, ativo: true, enderecos: [endereco] };
const autor = { userId: "operador-sintetico", nome: "Operador sintético" };
beforeEach(() => {
  vi.clearAllMocks(); sim.emTransacao = false; sim.antes = null; sim.antesTx = null;
  sim.consultar.mockImplementation(async () => {
    expect(sim.emTransacao).toBe(false);
    return { cadastro: { razaoSocial: "Razão oficial sintética", endereco: { ...endereco, logradouro: "Avenida Oficial", numero: "42", codigoMunicipio: "3550308" } } };
  });
  sim.criar.mockImplementation(async ({ data }) => ({ ...data, id: "cliente-sintetico", versao: 1 }));
});
describe("fronteiras de gravação dos livros de endereços", () => {
  it("consulta antes da transação e grava somente o endereço oficial com auditoria", async () => {
    await expect(salvarCliente(entrada, autor)).resolves.toBe("cliente-sintetico");
    expect(sim.consultar).toHaveBeenCalledTimes(1);
    expect(sim.criar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ enderecos: [expect.objectContaining({ numero: "42", logradouro: "Avenida Oficial", codigoMunicipio: "3550308" })] }) }));
    expect(sim.auditar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "CLIENTE", usuarioId: autor.userId, depois: expect.objectContaining({ enderecos: [expect.objectContaining({ numero: "42" })] }) }) }));
  });
  it("recusa cadastro sem Principal ou entrega incompleta antes de escrever", async () => {
    const pf = { ...entrada, tipo: "PF", documento: null };
    await expect(salvarCliente({ ...pf, enderecos: [] }, autor)).rejects.toThrow(/Principal/);
    await expect(salvarCliente({ ...pf, entregaPadrao: { destinatario: { nome: "Pessoa sintética", contato: "" }, endereco: { ...endereco, bairro: "" } } }, autor)).rejects.toThrow(/obrigatórios/);
    expect(sim.transacionar).not.toHaveBeenCalled(); expect(sim.criar).not.toHaveBeenCalled(); expect(sim.auditar).not.toHaveBeenCalled();
  });
  it("recusa chamada transacional direta com PJ nova e prova enviada pelo cliente", async () => {
    await expect(salvarClienteNaTransacao(tx as unknown as Prisma.TransactionClient, entrada, autor, "CADASTRO", {})).rejects.toThrow(/Confira/);
    expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.criar).not.toHaveBeenCalled(); expect(sim.auditar).not.toHaveBeenCalled();
  });
  it("recusa versão concorrente depois da consulta, sem gravar nem auditar", async () => {
    sim.antes = { ...entrada, id: "cliente-sintetico", versao: 3, enderecos: [{ ...endereco, numero: "1" }] };
    sim.antesTx = { ...sim.antes, versao: 4 };
    await expect(salvarCliente({ ...entrada, id: "cliente-sintetico", versao: 3 }, autor)).rejects.toThrow(/outra tela/);
    expect(sim.consultar).toHaveBeenCalledTimes(1); expect(sim.atualizar).not.toHaveBeenCalled(); expect(sim.auditar).not.toHaveBeenCalled();
  });
  it("preserva origem LEGADO explícita para a importação histórica sem criar endereço falso", async () => {
    await expect(salvarClienteNaTransacao(tx as unknown as Prisma.TransactionClient, { ...entrada, enderecos: [] }, autor, "LEGADO")).resolves.toBe("cliente-sintetico");
    expect(sim.consultar).not.toHaveBeenCalled();
    expect(sim.criar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ enderecos: [] }) }));
  });
});
