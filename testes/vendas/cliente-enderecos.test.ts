import { describe, expect, it } from "vitest";
import { camposEnderecoObrigatorios, chaveEnderecoPostal, chaveLocalEnderecoPostal, enderecoPostalCompleto, indiceEnderecoPostalDuplicado, pendenciaEnderecoPostal } from "@/lib/vendas/cliente-enderecos";

const endereco = { pais: "Brasil", cep: "01001000", logradouro: "Rua São José", numero: "10", complemento: "Sala 2", bairro: "Jardim Paulista", cidade: "São Paulo", uf: "SP" };
describe("identidade postal independente do titular", () => {
  it("iguala grafia, máscara, abreviações convencionais e espaços sem alterar o conteúdo", () => {
    const variacao = { pais: "BR", cep: "01001-000", logradouro: "  R.  SAO JOSE ", numero: "10", complemento: "SL.2", bairro: "Jd. Paulista", cidade: "SAO PAULO", uf: "s.p." };
    expect(chaveEnderecoPostal(variacao)).toBe(chaveEnderecoPostal(endereco));
    expect(variacao.logradouro).toBe("  R.  SAO JOSE ");
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Av. Brasil" })).toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Avenida Brasil" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "APTO101" })).toBe(chaveEnderecoPostal({ ...endereco, complemento: "Apartamento 101" }));
  });
  it("não usa CNPJ, nome, telefone, destinatário ou texto original para permitir duplicação", () => {
    const primeiro = { ...endereco, documento: "11222333000181", nome: "Um", destinatario: "Nome Um", contato: "111", textoOriginal: "Fonte Um" };
    const segundo = { ...endereco, documento: "11444777000161", nome: "Dois", destinatario: "Nome Dois", contato: "222", textoOriginal: "Fonte Dois" };
    expect(chaveEnderecoPostal(primeiro)).toBe(chaveEnderecoPostal(segundo));
    expect(indiceEnderecoPostalDuplicado([primeiro], segundo)).toBe(0); expect(indiceEnderecoPostalDuplicado([primeiro], segundo, 0)).toBeNull();
  });
  it("remove apenas vírgulas e pontos nas bordas do número", () => {
    for (const numero of ["10,", "10.", ".10", ",10,", " . 10 , . "]) expect(chaveEnderecoPostal({ ...endereco, numero })).toBe(chaveEnderecoPostal(endereco));
    for (const numero of ["10,5", "10.5", "10-12", "10/1"]) expect(chaveEnderecoPostal({ ...endereco, numero })).not.toBe(chaveEnderecoPostal(endereco));
    expect(chaveEnderecoPostal({ ...endereco, numero: "10,5" })).not.toBe(chaveEnderecoPostal({ ...endereco, numero: "105" }));
    expect(camposEnderecoObrigatorios({ ...endereco, numero: ". ," })).toEqual(["Número"]);
    expect(chaveEnderecoPostal({ ...endereco, numero: ". ," })).toBeNull();
  });
  it("reconhece número repetido no fim do logradouro somente com separador explícito e valor igual", () => {
    for (const logradouro of ["Rua São José, 10", "R. São José, nº 10", "Rua São José; 10.", "Rua São José - 10", "Rua São José, 10,"]) expect(chaveEnderecoPostal({ ...endereco, logradouro })).toBe(chaveEnderecoPostal(endereco));
    for (const logradouro of ["Rua São José 10", "Rua São José-10", "Rua São José, 11", "Rua São José, 10/1", "Rua São José, 10,5"]) expect(chaveEnderecoPostal({ ...endereco, logradouro })).not.toBe(chaveEnderecoPostal(endereco));
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Rua 10", numero: "10" })).not.toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Rua", numero: "10" }));
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Rua 10, 10", numero: "10" })).toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Rua 10", numero: "10" }));
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Rua São José, 10/1", numero: "10/1" })).toBe(chaveEnderecoPostal({ ...endereco, numero: "10/1" }));
  });
  it("expande Dr e Prof como termos inteiros sem alterar partes de nomes", () => {
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Rua Dr. Nome Sintético" })).toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Rua Doutor Nome Sintético" }));
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Av. Prof. Nome Sintético, 10" })).toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Avenida Professor Nome Sintético" }));
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Dr. Nome Sintético" })).toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Doutor Nome Sintético" }));
    expect(JSON.parse(chaveEnderecoPostal({ ...endereco, logradouro: "Rua Drive Adro Profissional" })!)[2]).toBe("RUA DRIVE ADRO PROFISSIONAL");
    expect(chaveEnderecoPostal({ ...endereco, logradouro: "Rua Dra. Nome Sintético" })).not.toBe(chaveEnderecoPostal({ ...endereco, logradouro: "Rua Doutor Nome Sintético" }));
  });
  it("iguala dois-pontos convencionais depois de marcadores de unidade sem apagar hífens ou barras", () => {
    for (const complemento of ["Apto:101", "AP: 101", "Apt.:101", "Apartamento:101"]) expect(chaveEnderecoPostal({ ...endereco, complemento })).toBe(chaveEnderecoPostal({ ...endereco, complemento: "Apartamento 101" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "SL:2" })).toBe(chaveEnderecoPostal(endereco));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "BL:A CJ:1/2" })).toBe(chaveEnderecoPostal({ ...endereco, complemento: "Bloco A Conjunto 1/2" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "Apto:101/2" })).not.toBe(chaveEnderecoPostal({ ...endereco, complemento: "Apto 1012" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "Apto:101-2" })).not.toBe(chaveEnderecoPostal({ ...endereco, complemento: "Apto 1012" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "Sala 1:2" })).not.toBe(chaveEnderecoPostal({ ...endereco, complemento: "Sala 12" }));
  });
  it("preserva números, salas, blocos, hífens, barras, CEP e países diferentes", () => {
    for (const campos of [{ numero: "11" }, { numero: "10-12" }, { numero: "10/1" }, { complemento: "Sala 3" }, { complemento: "Sala 2-3" }, { complemento: "Sala 2/3" }, { complemento: "Bloco 2" }, { cep: "01002000" }, { bairro: "Outro Bairro" }, { cidade: "Outra Cidade" }, { uf: "RJ" }, { pais: "Portugal" }]) expect(chaveEnderecoPostal({ ...endereco, ...campos })).not.toBe(chaveEnderecoPostal(endereco));
    expect(chaveEnderecoPostal({ ...endereco, numero: "10-12" })).not.toBe(chaveEnderecoPostal({ ...endereco, numero: "1012" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "Sala 1/2" })).not.toBe(chaveEnderecoPostal({ ...endereco, complemento: "Sala 12" }));
  });
  it("conserva complementos informais, telefones e nomes comerciais para revisão explícita", () => {
    const vazio = { ...endereco, complemento: "" };
    for (const complemento of ["Casa", "Fundos", "Nome Comercial Sintético", "Fone: 11900001234", "Sem complemento"]) expect(chaveEnderecoPostal({ ...vazio, complemento })).not.toBe(chaveEnderecoPostal(vazio));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "Prédio A" })).not.toBe(chaveEnderecoPostal({ ...endereco, complemento: "Prédio B" }));
    expect(chaveEnderecoPostal({ ...endereco, complemento: "Frente" })).not.toBe(chaveEnderecoPostal({ ...endereco, complemento: "Fundos" }));
  });
  it("não identifica dois parciais por campos que a fonte não comprovou", () => {
    expect(camposEnderecoObrigatorios({ ...endereco, numero: "", cep: "" })).toEqual(["CEP", "Número"]);
    expect(chaveEnderecoPostal({ ...endereco, numero: "" })).toBeNull(); expect(indiceEnderecoPostalDuplicado([{}], {})).toBeNull();
    expect(enderecoPostalCompleto({ ...endereco, complemento: "" })).toBe(true);
    expect(pendenciaEnderecoPostal({ ...endereco, cep: "123" })).toMatch(/oito dígitos/);
    expect(pendenciaEnderecoPostal({ ...endereco, uf: "XX" })).toMatch(/UF/);
    expect(enderecoPostalCompleto(null)).toBe(false);
  });
});

describe("chave local apenas para sugestão e revisão", () => {
  it("agrupa variações locais mesmo com CEP, bairro e unidade diferentes sem tornar esses endereços duplicados", () => {
    const variacao = { ...endereco, pais: "BR", logradouro: "R. São José, 10", numero: "10,", cidade: "  SAO PAULO ", uf: "s.p.", cep: "01002000", bairro: "Outro Bairro", complemento: "Prédio B" };
    expect(chaveLocalEnderecoPostal(variacao)).toBe(chaveLocalEnderecoPostal(endereco));
    expect(chaveEnderecoPostal(variacao)).not.toBe(chaveEnderecoPostal(endereco));
    expect(indiceEnderecoPostalDuplicado([endereco], variacao)).toBeNull();
    expect(chaveLocalEnderecoPostal({ ...endereco, complemento: "Prédio A" })).toBe(chaveLocalEnderecoPostal({ ...endereco, complemento: "Prédio B" }));
  });
  it("permite sugestão sem CEP ou bairro sem completar esses campos nem habilitar a chave estrita", () => {
    const parcial = { ...endereco, cep: "", bairro: "" }, antes = { ...parcial };
    expect(chaveLocalEnderecoPostal(parcial)).toBe(chaveLocalEnderecoPostal(endereco));
    expect(chaveEnderecoPostal(parcial)).toBeNull();
    expect(parcial).toEqual(antes);
  });
  it("não reúne números, logradouros, cidades, UFs ou países distintos", () => {
    for (const campos of [{ numero: "11" }, { numero: "10/1" }, { logradouro: "Avenida São José" }, { cidade: "Outra Cidade" }, { uf: "RJ" }, { pais: "Portugal" }]) expect(chaveLocalEnderecoPostal({ ...endereco, ...campos })).not.toBe(chaveLocalEnderecoPostal(endereco));
  });
  it("recusa sugestão quando falta identidade local ou a UF brasileira é inválida", () => {
    for (const campo of ["pais", "logradouro", "numero", "cidade", "uf"]) expect(chaveLocalEnderecoPostal({ ...endereco, [campo]: "" })).toBeNull();
    expect(chaveLocalEnderecoPostal({ ...endereco, numero: ".," })).toBeNull();
    expect(chaveLocalEnderecoPostal({ ...endereco, uf: "XX" })).toBeNull();
    expect(chaveLocalEnderecoPostal(null)).toBeNull();
  });
});
