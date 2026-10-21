import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

vi.mock("@/lib/sefaz/soap", () => ({ chamarNfeRecepcaoEvento: vi.fn(), chamarNfeDistribuicaoDFe: vi.fn() }));
vi.mock("@/lib/sefaz/assinatura", () => ({ assinarElemento: vi.fn(async (xml: string) => xml) }));

import { chamarNfeRecepcaoEvento } from "@/lib/sefaz/soap";
import { processarRespostaEvento, enviarManifestacao, formatarDataHoraComFuso } from "@/lib/sefaz/evento";
import { processarRespostaSoap } from "@/lib/sefaz/distribuicao";
import { extrairDadosDocumento, extrairItensNFe, extrairDuplicatasNFe } from "@/lib/sefaz/parseNFe";

function respostaEvento(codigo: string, prefixo = "soap", escapado = false) {
  let conteudo = `<retEnvEvento><cStat>128</cStat><retEvento><infEvento><cStat>${codigo}</cStat><xMotivo>Resultado simulado</xMotivo><nProt>000123</nProt></infEvento></retEvento></retEnvEvento>`;
  if (escapado) conteudo = conteudo.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<${prefixo}:Envelope><${prefixo}:Body><nfeRecepcaoEventoNFResponse><nfeRecepcaoEventoNFResult>${conteudo}</nfeRecepcaoEventoNFResult></nfeRecepcaoEventoNFResponse></${prefixo}:Body></${prefixo}:Envelope>`;
}

describe("respostas e eventos da SEFAZ, sem conexão externa", () => {
  it.each([
    ["2026-09-10T18:30:00.999Z", "2026-09-10T15:30:00-03:00"],
    ["2026-09-10T15:30:00-03:00", "2026-09-10T15:30:00-03:00"],
    ["2026-01-01T01:30:00Z", "2025-12-31T22:30:00-03:00"],
  ])("preserva o instante do evento em Brasília, inclusive na virada do dia (%s)", (instante, esperado) => {
    expect(formatarDataHoraComFuso(new Date(instante))).toBe(esperado);
    expect(Math.abs(new Date(formatarDataHoraComFuso(new Date(instante))).getTime() - new Date(instante).getTime())).toBeLessThan(1000);
  });
  it.each(["135", "136"])("reconhece registro %s e preserva protocolo", (codigo) => {
    expect(processarRespostaEvento(respostaEvento(codigo))).toMatchObject({ sucesso: true, protocolo: "000123", cStat: codigo });
  });
  it.each(["573", "580", "999"])("não considera rejeição %s como aceite", (codigo) => {
    expect(processarRespostaEvento(respostaEvento(codigo)).sucesso).toBe(false);
  });
  it("interpreta SOAP 1.2 e conteúdo escapado", () => {
    expect(processarRespostaEvento(respostaEvento("135", "soap12", true)).sucesso).toBe(true);
  });
  it("não transforma o erro conhecido do servidor em sucesso", () => {
    expect(() => processarRespostaEvento('<soap:Envelope><soap:Body><soap:Fault><faultstring>Object reference not set to an instance of an object</faultstring></soap:Fault></soap:Body></soap:Envelope>')).toThrow();
  });
  it.each([
    ["CONFIRMACAO_DA_OPERACAO", "210200"],
    ["DESCONHECIMENTO_DA_OPERACAO", "210220"],
    ["OPERACAO_NAO_REALIZADA", "210240"],
  ] as const)("envia %s com o código correto e órgão nacional", async (tipo, codigo) => {
    vi.mocked(chamarNfeRecepcaoEvento).mockResolvedValue(respostaEvento("135"));
    const justificativa = 'Mercadoria recusada: avaria & embalagem <aberta> "danificada".';
    await enviarManifestacao({ cnpj: "00000000000000", chaveAcesso: "0".repeat(44), tipo, justificativa });
    const xml = vi.mocked(chamarNfeRecepcaoEvento).mock.calls[0][0];
    const evento = new XMLParser().parse(xml).envEvento.evento.infEvento;
    expect(evento.tpEvento).toBe(Number(codigo));
    expect(evento.cOrgao).toBe(91);
    expect(evento.detEvento.xJust).toBe(tipo === "OPERACAO_NAO_REALIZADA" ? justificativa : undefined);
  });
  it("descompacta uma NF-e e extrai itens e parcelas sem presumir pagamento à vista", () => {
    const xml = '<nfeProc><NFe><infNFe Id="NFe000123"><emit><CNPJ>000123</CNPJ><xNome>Fornecedor de teste</xNome></emit><det nItem="1"><prod><cProd>001</cProd><xProd>Queijo</xProd><uCom>CX</uCom><qCom>2.5</qCom><uTrib>KG</uTrib><qTrib>37.75</qTrib><vProd>100.01</vProd></prod></det><cobr><dup><nDup>001</nDup><dVenc>2026-10-10</dVenc><vDup>60</vDup></dup><dup><nDup>002</nDup><dVenc>2026-11-10</dVenc><vDup>40.01</vDup></dup></cobr></infNFe></NFe></nfeProc>';
    const comprimido = gzipSync(xml).toString("base64");
    const resposta = `<soap:Envelope><soap:Body><nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult><retDistDFeInt><cStat>138</cStat><ultNSU>000000000000001</ultNSU><maxNSU>000000000000001</maxNSU><loteDistDFeInt><docZip NSU="000000000000001" schema="procNFe_v4.00.xsd">${comprimido}</docZip></loteDistDFeInt></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`;
    const resultado = processarRespostaSoap(resposta, "000000000000000");
    expect(resultado.documentos[0].xml).toBe(xml);
    expect(resultado.ultNSU).toBe("000000000000001");
    expect(extrairDadosDocumento(resultado.documentos[0])).toMatchObject({ tipo: "PROC_NFE", fornecedorCnpj: "000123" });
    expect(extrairItensNFe(xml)[0]).toMatchObject({ codigoProdutoFornecedor: "001", quantidadeComercial: 2.5, unidadeComercial: "CX", quantidadeTributavel: 37.75, unidadeTributavel: "KG", valorTotalItem: 100.01 });
    expect(extrairDuplicatasNFe(xml).map((parcela) => parcela.valor)).toEqual([60, 40.01]);
  });
});
