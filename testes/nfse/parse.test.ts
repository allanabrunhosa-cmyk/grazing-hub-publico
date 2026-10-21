// CNPJ exclusivamente fictício, com dígitos verificadores válidos para a fixture.
import { describe, expect, it } from "vitest";
import { extrairDadosNfse } from "@/lib/nfse/parse";

describe("leitura do XML de NFS-e", () => {
  it("extrai os campos do leiaute nacional", () => {
    const xml = `<NFSe><infNFSe Id="NFS35200000000000000000000000000000000000000000000001"><nNFSe>42</nNFSe><dhEmi>2026-09-17T10:00:00-03:00</dhEmi><dCompet>2026-09-01</dCompet><emit><CNPJ>12345678000195</CNPJ><xNome>Prestador Nacional</xNome><email>financeiro@prestador.test</email><fone>11999990000</fone><enderNac><xLgr>Rua das Flores</xLgr><nro>42</nro><xBairro>Centro</xBairro><xMun>São Paulo</xMun><UF>SP</UF><CEP>01001000</CEP></enderNac></emit><toma><CNPJ>11222333000181</CNPJ><xNome>Grazing Table</xNome></toma><serv><com><vServ>742,50</vServ></com></serv><valores><vLiq>700.00</vLiq><vISSQN>42.50</vISSQN></valores></infNFSe></NFSe>`;
    const dados = extrairDadosNfse(xml, "11.222.333/0001-81");
    expect(dados.identificador).toBe("NFS35200000000000000000000000000000000000000000000001");
    expect(dados.numero).toBe("42");
    expect(dados.prestadorNome).toBe("Prestador Nacional");
    expect(dados.prestadorDados?.nome).toBe(dados.prestadorNome);
    expect(dados.prestadorDados?.cnpj).toBe(dados.prestadorCnpj);
    expect(dados.prestadorCnpj).toBe("12345678000195");
    expect(dados.tomadorCnpj).toBe("11222333000181");
    expect(dados.valorServico).toBe(742.5);
    expect(dados.valorLiquido).toBe(700);
    expect(dados.prestadorDados?.email).toBe("financeiro@prestador.test");
    expect(dados.prestadorDados?.endereco?.logradouro).toBe("Rua das Flores");
  });

  it("aceita o formato municipal e rejeita tomador de outro CNPJ", () => {
    const xml = `<CompNfse><Nfse><InfNfse><Numero>7</Numero><DataEmissao>2026-09-17T11:00:00</DataEmissao><PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>12345678000195</Cnpj></CpfCnpj><RazaoSocial>Prestador Municipal</RazaoSocial></IdentificacaoPrestador></PrestadorServico><TomadorServico><IdentificacaoTomador><CpfCnpj><Cnpj>11222333000181</Cnpj></CpfCnpj><RazaoSocial>Grazing Table</RazaoSocial></IdentificacaoTomador><ValoresNfse><ValorServicos>100,00</ValorServicos></ValoresNfse></TomadorServico></InfNfse></Nfse></CompNfse>`;
    const dados = extrairDadosNfse(xml, "11222333000181");
    expect(dados.numero).toBe("7");
    expect(dados.prestadorCnpj).toBe("12345678000195");
    expect(dados.valorServico).toBe(100);
    expect(() => extrairDadosNfse(xml.replace("11222333000181", "11111111000111"), "11222333000181")).toThrow("não está emitida");
  });

  it("lê o registro oficial da consulta paulistana e calcula o líquido pelas retenções", () => {
    const chave = "35503081234538625000123000000001251026091654841760";
    const xml = `<p:RetornoConsulta xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="2"><Sucesso>true</Sucesso></Cabecalho><NFe>
      <ChaveNFe><InscricaoPrestador>01479466</InscricaoPrestador><NumeroNFe>00012510</NumeroNFe><CodigoVerificacao>RBCMLYGJ</CodigoVerificacao><ChaveNotaNacional>${chave}</ChaveNotaNacional></ChaveNFe>
      <DataEmissaoNFe>2026-09-04T17:17:25</DataEmissaoNFe><DataFatoGeradorNFe>2026-09-04T17:17:25</DataFatoGeradorNFe>
      <CPFCNPJPrestador><CNPJ>34538625000123</CNPJ></CPFCNPJPrestador><RazaoSocialPrestador>LALAMOVE TECNOLOGIA (BRASIL) LTDA.</RazaoSocialPrestador>
      <EnderecoPrestador><Logradouro>R WERNER VON SIEMENS</Logradouro><NumeroEndereco>111</NumeroEndereco><Cidade>3550308</Cidade><UF>SP</UF><CEP>05069000</CEP></EnderecoPrestador>
      <CPFCNPJTomador><CNPJ>11222333000181</CNPJ></CPFCNPJTomador><RazaoSocialTomador>Empresa Fictícia Teste</RazaoSocialTomador>
      <ValorServicos>1794.36</ValorServicos><ValorPIS>0.00</ValorPIS><ValorCOFINS>0.00</ValorCOFINS><ValorINSS>0.00</ValorINSS><ValorIR>26.92</ValorIR><ValorCSLL>0.00</ValorCSLL><ValorISS>35.88</ValorISS><ISSRetido>false</ISSRetido><StatusNFe>N</StatusNFe>
    </NFe></p:RetornoConsulta>`;
    const dados = extrairDadosNfse(xml, "11222333000181");
    expect(dados).toMatchObject({
      identificador: `NFS${chave}`, chaveAcesso: chave, numero: "00012510", codigoVerificacao: "RBCMLYGJ",
      prestadorCnpj: "34538625000123", prestadorNome: "LALAMOVE TECNOLOGIA (BRASIL) LTDA.",
      tomadorCnpj: "11222333000181", valorServico: 1794.36, valorLiquido: 1767.44, valorIss: 35.88,
      dataEmissao: new Date("2026-09-04T12:00:00.000Z"),
    });
    expect(dados.prestadorDados?.endereco).toMatchObject({ logradouro: "R WERNER VON SIEMENS", numero: "111", codigoMunicipio: "3550308" });
  });
});

const cnpjPrestador = "24626495000127";
const cnpjTomador = "11222333000181";
function xmlComDps(emitente: string, documentoPrestador = cnpjPrestador) {
  // Ordem proposital: DPS antes de emit. A posição no XML não define a pessoa.
  return `<n:NFSe xmlns:n="http://www.sped.fazenda.gov.br/nfse"><n:infNFSe>
    <n:nNFSe>137802</n:nNFSe>
    <n:DPS><n:infDPS><n:dhEmi>2026-09-15T15:21:11-03:00</n:dhEmi>
      <n:prest><n:CNPJ>${documentoPrestador}</n:CNPJ><n:IM>56175200197</n:IM></n:prest>
      <n:toma><n:CNPJ>${cnpjTomador}</n:CNPJ><n:xNome>GRAZING TABLE</n:xNome>
        <n:email>tomador@example.test</n:email>
        <n:end><n:endNac><n:cMun>3550308</n:cMun><n:CEP>00000000</n:CEP></n:endNac>
          <n:xLgr>Rua do tomador</n:xLgr><n:nro>973</n:nro></n:end>
      </n:toma>
    </n:infDPS></n:DPS>
    <n:emit>${emitente}</n:emit>
  </n:infNFSe></n:NFSe>`;
}

describe("separação entre prestador e tomador no XML nacional", () => {
  it("mantém nome, CNPJ e endereço do mesmo prestador, mesmo com DPS antes do emitente", () => {
    const xml = xmlComDps(`<n:CNPJ>${cnpjPrestador}</n:CNPJ>
      <n:xNome>PRESTADOR &amp; CO</n:xNome><n:IM>56175200197</n:IM>
      <n:enderNac><n:xLgr>Rua do prestador</n:xLgr><n:nro>1672</n:nro>
        <n:cMun>2927408</n:cMun><n:UF>BA</n:UF><n:CEP>41820020</n:CEP>
      </n:enderNac>`);
    const dados = extrairDadosNfse(xml, cnpjTomador);
    expect(dados.prestadorNome).toBe("PRESTADOR & CO");
    expect(dados.prestadorCnpj).toBe(cnpjPrestador);
    expect(dados.prestadorDados).toMatchObject({
      nome: "PRESTADOR & CO", cnpj: cnpjPrestador, email: null, telefone: null,
      endereco: { logradouro: "Rua do prestador", numero: "1672", codigoMunicipio: "2927408", complemento: null },
    });
    expect(dados.tomadorNome).toBe("GRAZING TABLE");
    expect(dados.tomadorCnpj).toBe(cnpjTomador);
    expect(dados.tomadorDados?.endereco?.logradouro).toBe("Rua do tomador");
    expect(dados.tomadorDados?.endereco?.cep).toBe("00000000");
  });

  it("recusa CNPJ do tomador no emitente quando o DPS identifica outro prestador", () => {
    expect(() => extrairDadosNfse(xmlComDps(`<n:CNPJ>${cnpjTomador}</n:CNPJ><n:xNome>GRAZING TABLE</n:xNome>`), cnpjTomador))
      .toThrow("difere do prestador");
  });

  it("não completa nome ausente com o tomador nem com um bloco aninhado de outra pessoa", () => {
    for (const complemento of ["", "<n:toma><n:xNome>GRAZING TABLE</n:xNome></n:toma>"]) {
      expect(() => extrairDadosNfse(xmlComDps(`<n:CNPJ>${cnpjPrestador}</n:CNPJ>${complemento}`), cnpjTomador))
        .toThrow("não contém nome");
    }
  });

  it("recusa documento ausente ou divergente no DPS sem mesclar as identidades", () => {
    for (const documento of ["", "23465964000100"]) {
      expect(() => extrairDadosNfse(xmlComDps(`<n:CNPJ>${cnpjPrestador}</n:CNPJ><n:xNome>PRESTADOR</n:xNome>`, documento), cnpjTomador))
        .toThrow("difere do prestador");
    }
  });

  it("mantém a identidade quando o prestador usa CPF", () => {
    const xml = xmlComDps("<n:CPF>12345678909</n:CPF><n:xNome>PRESTADOR PESSOA FISICA</n:xNome>")
      .replace(`<n:CNPJ>${cnpjPrestador}</n:CNPJ>`, "<n:CPF>12345678909</n:CPF>");
    const dados = extrairDadosNfse(xml, cnpjTomador);
    expect(dados.prestadorDados).toMatchObject({ cpf: "12345678909", cnpj: null, nome: "PRESTADOR PESSOA FISICA" });
    expect(dados.prestadorCnpj).toBe("12345678909");
  });
});
