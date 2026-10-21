import { describe, expect, it, vi } from "vitest";
import { validarCliente, type ClienteEntrada } from "@/lib/vendas/dominio";
import { normalizarEmailCliente } from "@/lib/vendas/cliente-identificadores";
import { conferirIdentidadeCliente, consultarConflitosIdentidadeCliente, resolverClienteCanonico } from "@/lib/vendas/clientes-unicidade";
import { validarClienteCadastro, validarClienteNovoPedido } from "@/lib/vendas/cliente-pedido";
import type { Prisma } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const endereco = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const entrada: ClienteEntrada = { id: "", versao: 0, nome: "Pessoa Fictícia", tipo: "PF", documento: null, email: "pessoa@example.invalid", telefone: "+5511999990000", contato: null, observacoes: null, ativo: true, enderecos: [endereco] };
function banco(linhas: object[] = [], vinculos: Record<string, string | null> = {}) {
  const query = vi.fn().mockResolvedValue(linhas);
  const ler = vi.fn(async ({ where }: { where: { id: string } }) => Object.hasOwn(vinculos, where.id) ? { id: where.id, unificadoEmId: vinculos[where.id] } : null);
  return { tx: { $queryRaw: query, clienteVenda: { findUnique: ler } } as unknown as Prisma.TransactionClient, query, ler };
}

describe("identidade canônica por e-mail", () => {
  it("normaliza caixa e espaços sem alterar pontos, sufixos ou domínio", () => {
    expect(normalizarEmailCliente("  Pessoa+Compras@Example.Invalid \n")).toBe("pessoa+compras@example.invalid");
    expect(normalizarEmailCliente(" ")).toBeNull();
    expect(validarCliente({ ...entrada, email: " Pessoa@Example.Invalid " }).email).toBe("pessoa@example.invalid");
  });
  it("exige e-mail para novo cadastro interativo e conserva o legado sem e-mail", () => {
    expect(() => validarClienteNovoPedido({ ...entrada, email: null })).toThrow(/e-mail/);
    expect(() => validarClienteCadastro({ ...entrada, email: null })).toThrow(/e-mail/);
    expect(validarClienteCadastro({ ...entrada, id: "legado", versao: 2, email: null }).email).toBeNull();
  });
  it("não busca documentos de cobranças adicionais para identificar o cliente", async () => {
    const { tx, query } = banco();
    await conferirIdentidadeCliente(tx, { ...entrada, email: null, enderecos: [endereco, { ...endereco, tipo: "PJ", documento: "11222333000181", razaoSocial: "Terceiro" }] });
    expect(query).not.toHaveBeenCalled();
  });
  it("recusa o mesmo e-mail em outro cadastro, inclusive inativo", async () => {
    const { tx } = banco([{ id: "existente", unificadoEmId: null, emailIgual: true, documentoIgual: false, documentoColunaIgual: false }]);
    await expect(conferirIdentidadeCliente(tx, entrada)).rejects.toThrow(/cliente com este e-mail/);
  });
  it("reserva e-mail e documento dos aliases para sua raiz", async () => {
    const linhas = [{ id: "alias", unificadoEmId: "raiz", emailIgual: true, documentoIgual: false, documentoColunaIgual: false }];
    const { tx } = banco(linhas, { raiz: null });
    await expect(conferirIdentidadeCliente(tx, entrada)).rejects.toThrow(/e-mail/);
    await expect(conferirIdentidadeCliente(tx, { ...entrada, id: "raiz", versao: 3 })).resolves.toBeUndefined();
  });
  it("recusa CPF/CNPJ do legado e conflito cruzado entre duas raízes", async () => {
    const { tx } = banco([{ id: "legado", unificadoEmId: null, emailIgual: false, documentoIgual: true, documentoColunaIgual: false }]);
    await expect(conferirIdentidadeCliente(tx, { ...entrada, documento: "12345678901" })).rejects.toThrow(/CPF\/CNPJ/);
    const duplo = banco([{ id: "a", emailIgual: true }, { id: "b", documentoIgual: true }]);
    await expect(conferirIdentidadeCliente(duplo.tx, { ...entrada, documento: "12345678901" })).rejects.toThrow(/cadastros diferentes/);
  });
  it("resolve alias com cadeia sem aceitar ciclos ou inventar destino ausente", async () => {
    const { tx } = banco([], { origem: "intermediario", intermediario: "raiz", raiz: null });
    expect(await resolverClienteCanonico(tx, "origem")).toBe("raiz");
    expect(await resolverClienteCanonico(tx, "ausente")).toBeNull();
    const ciclo = banco([], { a: "b", b: "a" });
    await expect(resolverClienteCanonico(ciclo.tx, "a")).rejects.toThrow(/vínculo/);
  });
});

describe("consulta antecipada dos identificadores", () => {
  const consulta = { clienteId: "", email: " Pessoa@Example.Invalid ", documento: null, tipo: "PF" };
  it("retorna somente flags e normaliza o e-mail sem consultar dados de apresentação", async () => {
    const { tx, query } = banco([{ id: "inativo", unificadoEmId: null, emailIgual: true, documentoIgual: false, documentoColunaIgual: false }]);
    expect(await consultarConflitosIdentidadeCliente(tx, consulta)).toEqual({ email: true, documento: false });
    expect(query.mock.calls[0].slice(1)).toContain("pessoa@example.invalid");
    const sql = query.mock.calls[0][0].join(" ");
    expect(sql).not.toMatch(/ativo|nome|telefone/);
    expect(sql).toContain("enderecos->0");
  });
  it("aceita CPF/CNPJ formatados e detecta conflitos separados de duas raízes", async () => {
    const { tx, query } = banco([{ id: "a", emailIgual: true }, { id: "b", documentoIgual: true }]);
    expect(await consultarConflitosIdentidadeCliente(tx, { ...consulta, documento: "123.456.789-09" })).toEqual({ email: true, documento: true });
    expect(query.mock.calls[0].slice(1)).toContain("12345678909");
    expect(await consultarConflitosIdentidadeCliente(tx, { ...consulta, tipo: "PJ", documento: "11.222.333/0001-81" })).toEqual({ email: true, documento: true });
    expect(query.mock.calls[1].slice(1)).toContain("11222333000181");
  });
  it("preserva a própria raiz e recusa o documento reservado pelo alias", async () => {
    const { tx } = banco([{ id: "alias", unificadoEmId: "raiz", emailIgual: true, documentoIgual: false, documentoColunaIgual: false }], { raiz: null });
    expect(await consultarConflitosIdentidadeCliente(tx, { ...consulta, clienteId: "raiz" })).toEqual({ email: false, documento: false });
    const reservado = banco([{ id: "alias", unificadoEmId: "raiz", emailIgual: true, documentoIgual: true, documentoColunaIgual: true }], { raiz: null });
    expect(await consultarConflitosIdentidadeCliente(reservado.tx, { ...consulta, clienteId: "raiz", documento: "12345678909" })).toEqual({ email: false, documento: true });
  });
  it("não consulta se não há identificador e rejeita parâmetros inválidos antes do banco", async () => {
    const { tx, query } = banco();
    expect(await consultarConflitosIdentidadeCliente(tx, { ...consulta, email: null })).toEqual({ email: false, documento: false });
    for (const entrada of [null, [], { ...consulta, email: "a@" }, { ...consulta, email: "x".repeat(255) }, { ...consulta, documento: "123" }, { ...consulta, documento: "1234567890A" }, { ...consulta, clienteId: "x".repeat(161) }, { ...consulta, tipo: "invalido", documento: "12345678909" }]) {
      await expect(consultarConflitosIdentidadeCliente(tx, entrada)).rejects.toThrow();
    }
    expect(query).not.toHaveBeenCalled();
  });
});
