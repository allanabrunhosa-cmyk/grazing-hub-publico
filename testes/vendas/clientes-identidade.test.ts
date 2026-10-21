import { describe, expect, it } from "vitest";
import { alterarTipoClientePreservandoNomes, classificarNaturezaCliente, cnpjNumericoValido, formatarNomeCliente, formatarNomesClienteNovo, preservarNomesNaMudancaTipo } from "@/lib/vendas/clientes-identidade";
import type { ClienteEntrada } from "@/lib/vendas/dominio";

const cliente = (valores: Partial<ClienteEntrada> = {}): ClienteEntrada => ({ id: "", versao: 0, nome: "JOÃO DE OLIVEIRA DA SILVA", primeiroNome: "JOÃO", sobrenome: "DE OLIVEIRA DA SILVA", tipo: "PF", documento: null, email: null, telefone: null, contato: null, observacoes: null, enderecos: [], ativo: true, ...valores });

describe("formatação comum de nomes", () => {
  it.each([
    ["  JOÃO   DE OLIVEIRA DA SILVA  ", "João de Oliveira da Silva"],
    ["ANA-MARIA d’ÁVILA", "Ana-Maria D’Ávila"],
    ["de SOUZA e DOS SANTOS", "de Souza e dos Santos"],
    ["LUIGI DEL MONTE VAN DER MEER", "Luigi del Monte van Der Meer"],
    ["EMPRESA FICTÍCIA LTDA", "Empresa Fictícia Ltda"],
  ])("formata %s", (entrada, esperado) => expect(formatarNomeCliente(entrada)).toBe(esperado));
  it("preserva uma exceção humana inclusive espaços e caixa", () => expect(formatarNomeCliente("  McDonald DE Souza  ", true)).toBe("  McDonald DE Souza  "));
  it("normaliza cadastros novos, sem alterar e-mail ou dados atuais", () => {
    const entrada = cliente({ email: "Pessoa@exemplo.test" });
    expect(formatarNomesClienteNovo(entrada)).toMatchObject({ nome: "João de Oliveira da Silva", primeiroNome: "João", sobrenome: "de Oliveira da Silva", email: "Pessoa@exemplo.test" });
    const existente = cliente({ id: "cliente-existente", nome: "McDonald DE Souza" });
    expect(formatarNomesClienteNovo(existente)).toBe(existente);
    expect(entrada.nome).toBe("JOÃO DE OLIVEIRA DA SILVA");
  });
});

describe("troca de pessoa física e jurídica", () => {
  it("transporta nome e sobrenome para os campos de contato sem perder os originais", () => {
    const entrada = cliente({ primeiroNome: "Maria Clara", sobrenome: "de Souza", nome: "Maria Clara de Souza", documento: "52998224725" });
    const pj = alterarTipoClientePreservandoNomes(entrada, "PJ");
    expect(pj).toMatchObject({ tipo: "PJ", nome: "", primeiroNome: "Maria Clara", sobrenome: "de Souza", nomeContato: "Maria Clara", sobrenomeContato: "de Souza", contato: "Maria Clara de Souza", documento: null });
    expect(alterarTipoClientePreservandoNomes(pj, "PF")).toMatchObject({ nome: "Maria Clara de Souza", primeiroNome: "Maria Clara", sobrenome: "de Souza", documento: null });
    expect(entrada.documento).toBe("52998224725");
  });
  it("preserva nomes compostos já cadastrados e dados empresariais anteriores", () => {
    const pj = alterarTipoClientePreservandoNomes(cliente({ razaoSocial: "Empresa Fictícia Ltda", nomeContato: "Ana Maria", sobrenomeContato: "da Silva", inscricaoEstadual: "ISENTO" }), "PJ");
    expect(pj).toMatchObject({ nome: "Empresa Fictícia Ltda", nomeContato: "Ana Maria", sobrenomeContato: "da Silva", contato: "Ana Maria da Silva", inscricaoEstadual: "ISENTO" });
  });
  it("conserva uma identidade legada completa ao separar os nomes", () => {
    expect(alterarTipoClientePreservandoNomes(cliente({ primeiroNome: null, sobrenome: null }), "PJ")).toMatchObject({ nomeContato: "JOÃO", sobrenomeContato: "DE OLIVEIRA DA SILVA", contato: "JOÃO DE OLIVEIRA DA SILVA" });
  });
  it("o servidor recupera os nomes pessoais de um DTO antigo que os limpou", () => {
    const antes = cliente({ id: "cliente", primeiroNome: "Maria Clara", sobrenome: "de Souza", nome: "Maria Clara de Souza" });
    const atualizado = preservarNomesNaMudancaTipo(antes, cliente({ id: "cliente", tipo: "PJ", nome: "Empresa Fictícia", primeiroNome: "", sobrenome: "", nomeContato: "", sobrenomeContato: "" }));
    expect(atualizado).toMatchObject({ nome: "Empresa Fictícia", primeiroNome: "Maria Clara", sobrenome: "de Souza", nomeContato: "Maria Clara", sobrenomeContato: "de Souza", contato: "Maria Clara de Souza" });
  });
  it("não substitui um contato informado explicitamente nem reaplica formatação em edição humana", () => {
    const depois = preservarNomesNaMudancaTipo(cliente({ id: "cliente" }), cliente({ id: "cliente", tipo: "PJ", nome: "EMPRESA humana", nomeContato: "McDonald", sobrenomeContato: "DE Souza" }));
    expect(depois).toMatchObject({ nome: "EMPRESA humana", nomeContato: "McDonald", sobrenomeContato: "DE Souza", contato: "McDonald DE Souza" });
  });
});

describe("classificação por evidência empresarial", () => {
  it("considera empresa declarada e marcadores no nome ou sobrenome", () => {
    expect(classificarNaturezaCliente({ nome: "Ana Fictícia", empresa: "Empresa Exemplo" })).toMatchObject({ tipo: "PJ", motivos: ["EMPRESA_INFORMADA"] });
    expect(classificarNaturezaCliente({ nome: "Ana - Consultoria Exemplo" })).toMatchObject({ tipo: "PJ", motivos: ["NOME_EMPRESARIAL"] });
    expect(classificarNaturezaCliente({ sobrenome: "Empresa Exemplo Ltda" }).tipo).toBe("PJ");
    expect(classificarNaturezaCliente({ nome: "Empresa Fictícia S.A." }).tipo).toBe("PJ");
  });
  it("exige prova do domínio em vez de presumir que e-mail próprio é corporativo", () => {
    expect(classificarNaturezaCliente({ emails: ["ana@nome-pessoal.test"] }).tipo).toBe("PF");
    expect(classificarNaturezaCliente({ emails: ["ANA@EMPRESA.TEST"] }, new Set(["empresa.test"]))).toMatchObject({ tipo: "PJ", dominiosComprovados: ["empresa.test"] });
    expect(classificarNaturezaCliente({ nome: "João de Oliveira da Silva", emails: ["ana@gmail.com"] }).tipo).toBe("PF");
  });
  it("não infere natureza a partir do nome de usuário ou destinatário", () => {
    expect(classificarNaturezaCliente({ nome: "Maria Fictícia" })).toEqual({ tipo: "PF", motivos: [], empresaInformada: null, dominiosComprovados: [] });
  });
  it.each(["uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "me.com", "proton.me", "yahoo.co.uk"])("não usa o CNPJ de um provedor pessoal (%s) como empresa compradora", dominio => {
    expect(classificarNaturezaCliente({ emails: [`pessoa@${dominio}`] }, new Set([dominio])).tipo).toBe("PF");
  });
});

it("valida dígitos do CNPJ sem confundir isso com prova de propriedade", () => {
  expect(cnpjNumericoValido("11.222.333/0001-81")).toBe(true);
  expect(cnpjNumericoValido("11222333000182")).toBe(false);
  expect(cnpjNumericoValido("00000000000000")).toBe(false);
  expect(cnpjNumericoValido("ABCDEFGHIJKL12")).toBe(false);
});
