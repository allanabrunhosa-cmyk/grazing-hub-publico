import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteVenda } from "@/generated/prisma/client";
import { validarCliente, validarLivroEnderecosClienteCompleto, type ClienteEntrada } from "@/lib/vendas/dominio";
import { conferirPreparacaoCliente, normalizarClienteParaSalvar, prepararClienteParaSalvar } from "@/lib/vendas/cliente-cobranca-servidor";

const sim = vi.hoisted(() => ({ ler: vi.fn(), consultar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { clienteVenda: { findUnique: sim.ler } } }));
vi.mock("@/lib/vendas/cnpj", () => ({ consultarCnpjVenda: sim.consultar }));
const endereco = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "10", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const base: ClienteEntrada = { id: "", versao: 0, nome: "Fantasia sintética", tipo: "PJ", documento: "11222333000181", razaoSocial: "Razão digitada", email: "teste@example.invalid", telefone: "+5511999990000", contato: null, observacoes: null, ativo: true, enderecos: [endereco] };
const pf: ClienteEntrada = { ...base, tipo: "PF", nome: "Pessoa sintética", documento: null, razaoSocial: null };
const oficial = { razaoSocial: "Razão oficial sintética", endereco: { ...endereco, logradouro: "Avenida Oficial", numero: "42", codigoMunicipio: "3550308" } };
const salvo = (cliente: ClienteEntrada): ClienteVenda => ({ ...cliente, id: "cliente-sintetico", versao: 3, unificadoEmId: null } as unknown as ClienteVenda);

beforeEach(() => { vi.resetAllMocks(); sim.ler.mockResolvedValue(null); sim.consultar.mockResolvedValue({ cadastro: oficial }); });
describe("cobrança canônica conferida antes da transação", () => {
  it("usa o endereço e a razão oficiais sem mudar nome fantasia nem inscrições", async () => {
    const preparado = await prepararClienteParaSalvar({ ...base, inscricaoEstadual: "ISENTO", enderecos: [{ ...endereco, inscricaoMunicipal: "123" }] });
    expect(sim.consultar).toHaveBeenCalledExactlyOnceWith(base.documento);
    expect(preparado.entrada).toMatchObject({ nome: "Fantasia Sintética", razaoSocial: "Razão Oficial Sintética", inscricaoEstadual: "ISENTO", enderecos: [{ logradouro: "Avenida Oficial", numero: "42", codigoMunicipio: "3550308" }] });
    expect(() => conferirPreparacaoCliente(normalizarClienteParaSalvar(preparado.entrada, null), null, preparado.comprovacao)).not.toThrow();
  });
  it("a prova não pode ser forjada, transplantada, alterada nem usada em outra versão", async () => {
    const preparado = await prepararClienteParaSalvar(base);
    expect(() => conferirPreparacaoCliente(preparado.entrada, null, {})).toThrow(/Confira/);
    expect(() => conferirPreparacaoCliente({ ...preparado.entrada, id: "outro", versao: 3 }, null, preparado.comprovacao)).toThrow(/Confira/);
    expect(() => conferirPreparacaoCliente({ ...preparado.entrada, versao: 1 }, null, preparado.comprovacao)).toThrow(/Confira/);
    expect(() => conferirPreparacaoCliente({ ...preparado.entrada, enderecos: [{ ...preparado.entrada.enderecos[0], numero: "999" }] }, null, preparado.comprovacao)).toThrow(/Confira/);
    expect(sim.consultar).toHaveBeenCalledTimes(1);
  });
  it("revalida versão e alias antes de qualquer consulta", async () => {
    sim.ler.mockResolvedValue(salvo(base));
    await expect(prepararClienteParaSalvar({ ...base, id: "cliente-sintetico", versao: 2 })).rejects.toThrow(/outra tela/);
    sim.ler.mockResolvedValue({ ...salvo(base), unificadoEmId: "raiz" });
    await expect(prepararClienteParaSalvar({ ...base, id: "cliente-sintetico", versao: 3 })).rejects.toThrow(/unificado/);
    expect(sim.consultar).not.toHaveBeenCalled();
  });
  it("não exige rede para cobrança PJ inalterada nem cadastro PF", async () => {
    const atual = salvo(validarCliente(base)); sim.ler.mockResolvedValue(atual);
    const preparado = await prepararClienteParaSalvar({ ...atual, dataNascimento: null, nome: "Nome fantasia editado" });
    expect(() => conferirPreparacaoCliente(preparado.entrada, atual)).not.toThrow();
    await prepararClienteParaSalvar(pf);
    expect(sim.consultar).not.toHaveBeenCalled();
  });
  it("recusa fonte indisponível ou incompleta sem aproveitar endereço digitado", async () => {
    sim.consultar.mockResolvedValueOnce({ erro: "Consulta indisponível." });
    await expect(prepararClienteParaSalvar(base)).rejects.toThrow(/indisponível/);
    sim.consultar.mockResolvedValueOnce({ cadastro: { ...oficial, endereco: { ...oficial.endereco, numero: "" } } });
    await expect(prepararClienteParaSalvar(base)).rejects.toThrow(/oficial.*completo/);
  });
  it("confere também a alteração de código IBGE e vincula a prova à versão atual", async () => {
    const atual = salvo(validarCliente({ ...base, enderecos: [{ ...endereco, codigoMunicipio: "3550308" }] }));
    sim.ler.mockResolvedValue(atual);
    const preparado = await prepararClienteParaSalvar({ ...atual, enderecos: [{ ...endereco, codigoMunicipio: "3509502" }], dataNascimento: null });
    expect(sim.consultar).toHaveBeenCalledTimes(1);
    expect(preparado.entrada.enderecos[0].codigoMunicipio).toBe("3550308");
    expect(() => conferirPreparacaoCliente(normalizarClienteParaSalvar(preparado.entrada, atual), atual, preparado.comprovacao)).not.toThrow();
  });
  it("recusa duas cobranças que o CNPJ resolve para o mesmo postal", async () => {
    const terceiro = { ...endereco, tipo: "PJ", documento: "11444777000161", razaoSocial: "Outra empresa", numero: "99" };
    await expect(prepararClienteParaSalvar({ ...base, enderecos: [endereco, terceiro] })).rejects.toThrow(/mesmo endereço/);
    expect(sim.consultar).toHaveBeenCalledTimes(2);
  });
  it("mantém CPF opcional e recusa livro vazio, pendente ou sem campos obrigatórios", async () => {
    await expect(prepararClienteParaSalvar(pf)).resolves.toMatchObject({ entrada: { documento: null } });
    await expect(prepararClienteParaSalvar({ ...pf, enderecos: [] })).rejects.toThrow(/Principal/);
    await expect(prepararClienteParaSalvar({ ...pf, enderecos: [{ ...endereco, pais: undefined }] })).rejects.toThrow(/País/);
    await expect(prepararClienteParaSalvar({ ...pf, enderecos: [{ ...endereco, bairro: "" }] })).rejects.toThrow(/obrigatórios/);
    const pendente = { ...endereco, tipo: "PJ", documento: "", titularPendente: true, numero: "20" };
    expect(() => validarLivroEnderecosClienteCompleto(validarCliente({ ...pf, enderecos: [endereco, pendente] }))).toThrow(/pendente/);
  });
});
