import { afterEach, describe, expect, it, vi } from "vitest";
import { validarCliente, validarIdentidadeCobranca } from "@/lib/vendas/dominio";
import { cobrancasDoCliente, copiarCobrancaParaEntrega, copiarEnderecoCobranca, identidadeFiscalCobranca, LIMITE_COBRANCAS_CLIENTE } from "@/lib/vendas/cliente-cobranca";
import { validarEntradaPedido, exigirPedidoConfirmavel } from "@/lib/vendas/pedidos-dominio";
import { resolverDestinatarioBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-destinatario";
import { consultarCnpjVenda } from "@/lib/vendas/cnpj";
import { formatarNomesClienteNovo } from "@/lib/vendas/clientes-identidade";

const endereco = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "42", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" };
const pf = { ...endereco, tipo: "PF" as const, nomeCompleto: "Pessoa de Cobrança", documento: "12345678901" };
const pj = { ...endereco, tipo: "PJ" as const, documento: "12345678000190", razaoSocial: "Empresa de Cobrança Ltda", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "123456" };
const comprador = { nome: "Cliente Comprador", tipo: "PF", documento: "99999999999", inscricaoEstadual: "999" };
afterEach(() => vi.unstubAllGlobals());

describe("titular independente por cobrança", () => {
  it("copia o nome e o telefone da cobrança adicional sem herdar o contato do comprador", () => {
    const adicional = { ...pf, telefone: "+5511988880000" };
    const cliente = { telefone: "+5511999990000", contato: "Contato do comprador" };
    const copia = copiarCobrancaParaEntrega(adicional, cliente, false);
    expect(copia).toMatchObject({ destinatario: { nome: pf.nomeCompleto, contato: adicional.telefone }, endereco: { numero: "42", codigoMunicipio: "3550308" } });
    expect(copia.endereco).not.toHaveProperty("documento");
    expect(copia.endereco).not.toHaveProperty("telefone");
    expect(copiarCobrancaParaEntrega(pf, cliente, false).destinatario.contato).toBe("");
    expect(copia.endereco).not.toBe(adicional);
    expect(adicional.nomeCompleto).toBe(pf.nomeCompleto);
  });
  it("Principal usa telefone geral e contato PJ; sem contato usa a razão social da cobrança", () => {
    const cliente = { telefone: "+5511999990000", contato: "Contato geral" };
    const principal = { ...pj, telefone: "+5511988880000" };
    expect(copiarCobrancaParaEntrega(principal, cliente, true).destinatario).toEqual({ nome: "Contato geral", contato: cliente.telefone });
    expect(copiarCobrancaParaEntrega(principal, { ...cliente, contato: null }, true).destinatario.nome).toBe(pj.razaoSocial);
    expect(copiarCobrancaParaEntrega(principal, cliente, false).destinatario).toEqual({ nome: pj.razaoSocial, contato: principal.telefone });
    const cadastro = { tipo: "PF" as const, nome: "Pessoa geral", documento: pf.documento, razaoSocial: null, inscricaoEstadual: null, telefone: cliente.telefone, enderecos: [{ ...pf, telefone: principal.telefone }, principal] };
    expect(cobrancasDoCliente(cadastro)[0]).toMatchObject({ nomeCompleto: cadastro.nome, telefone: cliente.telefone });
    expect(cobrancasDoCliente(cadastro)[1]).toBe(principal);
    const validado = validarCliente({ ...cadastro, id: "", versao: 0, ativo: true });
    expect(validado.enderecos[0].telefone).toBe(cliente.telefone);
    expect(validado.enderecos[1].telefone).toBe(principal.telefone);
  });
  it("conserva cobrança adicional PJ com titular pendente, mas exige CNPJ para confirmar e emitir NF", () => {
    const pendente = { ...pj, nome: "Cobrança 2", documento: "", titularPendente: true };
    const cliente = validarCliente({ id: "", versao: 0, nome: "Comprador sintético", tipo: "PF", ativo: true, enderecos: [pf, pendente] });
    expect(cliente.enderecos[1]).toMatchObject({ tipo: "PJ", documento: "", titularPendente: true, razaoSocial: pj.razaoSocial });
    const pedido = validarEntradaPedido({ clienteId: "cliente", canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", itens: [{ produtoId: "p", quantidade: "1" }], enderecosCobranca: cliente.enderecos, cobrancaSelecionada: 1 });
    expect(pedido.cobranca?.titularPendente).toBe(true);
    expect(() => exigirPedidoConfirmavel(pedido)).toThrow(/Titular pendente/);
    expect(resolverDestinatarioBrasilNfe({ modelo: 55, indicadorPresenca: 1, comprador, cobranca: pendente, consumidorFinal: true }).cliente).toBeUndefined();
    expect(() => validarCliente({ ...cliente, enderecos: [{ ...pf, titularPendente: true }] })).toThrow(/Principal/);
    expect(() => validarEntradaPedido({ enderecosCobranca: [{ ...pf, titularPendente: true }], itens: [] })).toThrow(/Principal/);
    expect(() => validarEntradaPedido({ cobranca: pendente, itens: [] })).toThrow(/Principal/);
    expect(() => validarCliente({ ...cliente, enderecos: [pf, { ...pf, titularPendente: true }] })).toThrow(/pessoa jurídica/);
    const resolvido = validarCliente({ ...cliente, enderecos: [pf, { ...pendente, documento: pj.documento }] });
    expect(resolvido.enderecos[1]).not.toHaveProperty("titularPendente");
    expect(() => validarCliente({ ...cliente, enderecos: [pf, { ...pendente, documento: pj.documento, razaoSocial: "" }] })).toThrow(/Razão social/);
  });
  it("aceita250 cobranças sem truncar e recusa251 no cadastro e no pedido", () => {
    const enderecos = Array.from({ length: LIMITE_COBRANCAS_CLIENTE }, (_, n) => ({ ...pf, nome: n ? `Cobrança ${n + 1}` : "Principal", numero: String(n + 1) }));
    const c = { id: "", versao: 0, nome: "Comprador sintético", tipo: "PF", ativo: true, enderecos };
    expect(validarCliente(c).enderecos).toHaveLength(250);
    expect(validarEntradaPedido({ enderecosCobranca: enderecos, cobrancaSelecionada: 249, itens: [] }).cobranca?.numero).toBe("250");
    expect(() => validarCliente({ ...c, enderecos: [...enderecos, pf] })).toThrow(/Endereços/);
    expect(() => validarEntradaPedido({ enderecosCobranca: [...enderecos, pf], itens: [] })).toThrow(/250/);
  });
  it("limpar explicitamente o CPF geral não restaura o documento antigo da Principal", () => {
    const cliente = validarCliente({ id: "", versao: 0, nome: "Nome do cadastro", tipo: "PF", documento: "", ativo: true, enderecos: [pf, pj] });
    expect(cliente.documento).toBeNull();
    expect(cliente.enderecos[0].documento).toBe("");
    expect(cliente.enderecos[1]).toMatchObject(pj);
  });
  it("conserva igualdade da Principal após formatar o nome do cadastro novo", () => {
    const cliente = formatarNomesClienteNovo(validarCliente({ id: "", versao: 0, nome: "ANA DE SOUZA", tipo: "PF", documento: "99999999999", ativo: true, enderecos: [pf, pj] }));
    expect(cliente.nome).toBe("Ana de Souza");
    expect(cliente.enderecos[0].nomeCompleto).toBe(cliente.nome);
    expect(cliente.enderecos[1]).toMatchObject(pj);
  });
  it("o servidor substitui titular forjado da Principal pelos dados gerais, sem mudar endereço ou terceiros", () => {
    const cliente = validarCliente({ id: "", versao: 0, nome: "Nome do cadastro", tipo: "PF", documento: "99999999999", ativo: true, enderecos: [pj, pj] });
    expect(cliente.enderecos[0]).toMatchObject({ tipo: "PF", nomeCompleto: "Nome do cadastro", documento: "99999999999", numero: "42", razaoSocial: "", inscricaoMunicipal: "" });
    expect(cliente.enderecos[1]).toMatchObject(pj);
  });
  it("Principal acompanha a razão social e CNPJ gerais; snapshot histórico explícito pode ser lido sem novo vínculo", () => {
    const cliente = { ...comprador, tipo: "PJ" as const, nome: "Fantasia", documento: "99999999000199", razaoSocial: "Razão geral", inscricaoEstadual: "888", enderecos: [pj, pf] };
    expect(cobrancasDoCliente(cliente)[0]).toMatchObject({ tipo: "PJ", documento: cliente.documento, razaoSocial: "Razão geral", inscricaoEstadual: "888", inscricaoMunicipal: "123456" });
    expect(cobrancasDoCliente(cliente)[1]).toBe(pf);
    expect(cobrancasDoCliente(cliente, false)[0]).toBe(pj);
    expect(cliente.enderecos[0]).toBe(pj);
  });
  it("copia apenas campos postais, conservando IBGE e sem transportar identidade fiscal", () => {
    expect(copiarEnderecoCobranca(pj)).toMatchObject({ numero: "42", codigoMunicipio: "3550308" });
    expect(copiarEnderecoCobranca(pj)).not.toHaveProperty("documento");
    expect(copiarEnderecoCobranca(pj)).not.toHaveProperty("tipo");
  });
  it("vincula Principal ao cadastro e conserva titulares adicionais", () => {
    const cliente = validarCliente({ id: "", versao: 0, nome: "Cliente comprador", tipo: "PF", ativo: true, enderecos: [pf, pj] });
    expect(cliente.documento).toBe(pf.documento);
    expect(cliente.enderecos).toMatchObject([{ tipo: "PF", nomeCompleto: "Cliente comprador" }, { tipo: "PJ", documento: pj.documento, inscricaoMunicipal: "123456" }]);
    expect(() => validarCliente({ ...cliente, enderecos: [pf, { ...pj, documento: "" }] })).toThrow(/CNPJ/);
    expect(() => validarIdentidadeCobranca({ ...pj, inscricaoMunicipal: "letras" })).toThrow(/Inscrição Municipal/);
    expect(() => validarIdentidadeCobranca({ ...pf, nomeCompleto: "" }, true)).toThrow(/Nome Completo/);
  });
  it("a lista/índice prevalecem sobre identidade fiscal divergente enviada no objeto avulso", () => {
    const pedido = validarEntradaPedido({ clienteId: "cliente", canalId: "site", atendimento: "RETIRADA", prazo: "IMEDIATO", itens: [{ produtoId: "p", quantidade: "1" }], cobranca: pf, enderecosCobranca: [pf, pj], cobrancaSelecionada: 1 });
    expect(pedido.cobranca).toMatchObject({ tipo: "PJ", documento: pj.documento, inscricaoMunicipal: "123456" });
    expect(validarEntradaPedido(JSON.parse(JSON.stringify(pedido)))).toEqual(pedido);
    expect(() => exigirPedidoConfirmavel(pedido)).not.toThrow();
    expect(() => exigirPedidoConfirmavel({ ...pedido, cobranca: { ...pj, documento: "" } })).toThrow(/CNPJ/);
  });
  it("NF-e usa titular da cobrança e não herda CPF ou inscrição do comprador", () => {
    const resultado = resolverDestinatarioBrasilNfe({ modelo: 55, indicadorPresenca: 1, comprador, cobranca: pj, consumidorFinal: true });
    expect(resultado.pendencias).toEqual([]);
    expect(resultado.cliente).toMatchObject({ CpfCnpj: pj.documento, NmCliente: pj.razaoSocial, IndicadorIe: 9, Endereco: { Numero: "42", CodMunicipio: "3550308" } });
    expect(identidadeFiscalCobranca(comprador, { ...pf, documento: "" })).toMatchObject({ nome: pf.nomeCompleto, documento: "", inscricaoEstadual: "" });
    const incompleto = resolverDestinatarioBrasilNfe({ modelo: 55, indicadorPresenca: 1, comprador, cobranca: { ...pj, documento: "" }, consumidorFinal: true });
    expect(incompleto.cliente).toBeUndefined();
  });
  it("preserva os formatos antigos sem gravar ao ler e mantém adicional explícita", () => {
    expect(identidadeFiscalCobranca(comprador, endereco)).toBe(comprador);
    const legado = { ...comprador, tipo: "PF" as const, enderecos: [endereco], documento: "12345678901" };
    expect(cobrancasDoCliente(legado)[0]).toMatchObject({ tipo: "PF", nomeCompleto: comprador.nome, documento: legado.documento });
    expect(legado.enderecos[0]).not.toHaveProperty("tipo");
    expect(cobrancasDoCliente({ ...legado, enderecos: [endereco, pj] })[1]).toBe(pj);
  });
});

describe("consulta pública de CNPJ sem gravação", () => {
  it("recusa entrada inválida antes da rede e não expõe resposta de erro", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await consultarCnpjVenda("123abc")).toHaveProperty("erro");
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue(new Response("erro privado", { status: 500 }));
    expect(await consultarCnpjVenda("11222333000181")).toEqual({ erro: "Consulta do CNPJ indisponível. Tente novamente." });
  });
  it("preenche razão social e endereço completo com limites e código IBGE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ cnpj: "11222333000181", razao_social: "Empresa Sintética", descricao_tipo_de_logradouro: "RUA", logradouro: "Sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", municipio: "São Paulo", uf: "SP", cep: "01001-000", codigo_municipio_ibge: 3550308 }))));
    expect(await consultarCnpjVenda("11222333000181")).toMatchObject({ cadastro: { razaoSocial: "Empresa Sintética", endereco: { cep: "01001000", logradouro: "RUA Sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } } });
  });
  it("não aplica retorno de outra empresa ou resposta sem razão social", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ cnpj: "99999999999999" }))); vi.stubGlobal("fetch", fetch);
    expect(await consultarCnpjVenda("11222333000181")).toHaveProperty("erro");
    fetch.mockResolvedValue(new Response(JSON.stringify({ cnpj: "11222333000181", razao_social: "" })));
    expect(await consultarCnpjVenda("11222333000181")).toHaveProperty("erro");
  });
});
