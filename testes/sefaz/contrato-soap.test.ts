import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { XMLParser } from "fast-xml-parser";

vi.mock("https", () => ({ request: vi.fn() }));
vi.mock("@/lib/sefaz/certificado", () => ({ criarAgenteMTLS: vi.fn(async () => ({})) }));
vi.mock("@/lib/sefaz/assinatura", () => ({ assinarElemento: vi.fn() }));

import { request } from "https";
import { chamarNfeRecepcaoEvento, chamarNfeDistribuicaoDFe } from "@/lib/sefaz/soap";
import { processarRespostaEvento } from "@/lib/sefaz/evento";

const escrever = vi.fn();
const analisar = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockImplementation(((_opcoes: unknown, receber: (resposta: EventEmitter) => void) => {
    const requisicao = Object.assign(new EventEmitter(), {
      write: escrever,
      end: () => {
        const resposta = Object.assign(new EventEmitter(), { statusCode: 200 });
        receber(resposta);
        resposta.emit("data", Buffer.from("resposta simulada"));
        resposta.emit("end");
      },
    });
    return requisicao;
  }) as never);
});

// Contrato consultado com mTLS em 2026-09-10:
// https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx?WSDL
// Entrada: wsdl:part element="tns:nfeDadosMsg"; saída:
// wsdl:part element="tns:nfeRecepcaoEventoNFResult"; soap:body use="literal".
describe("contrato oficial da recepção de eventos", () => {
  it("envia nfeDadosMsg diretamente no Body, com o namespace do WSDL", async () => {
    const evento = '<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote></envEvento>';
    await chamarNfeRecepcaoEvento(evento);
    const corpo = analisar.parse(escrever.mock.calls[0][0])["soap12:Envelope"]["soap12:Body"];
    expect(Object.keys(corpo)).toEqual(["nfeDadosMsg"]);
    expect(corpo.nfeDadosMsg["@_xmlns"]).toBe("http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4");
    expect(corpo.nfeDadosMsg.envEvento.idLote).toBe("1");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF"' }),
    }), expect.any(Function));
  });
  it("mantém o envelope de distribuição inalterado", async () => {
    await chamarNfeDistribuicaoDFe('<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01" />');
    const corpo = analisar.parse(escrever.mock.calls[0][0])["soap12:Envelope"]["soap12:Body"];
    expect(Object.keys(corpo)).toEqual(["nfeDistDFeInteresse"]);
    expect(corpo.nfeDistDFeInteresse["@_xmlns"]).toBe("http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe");
    expect(corpo.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt).toBeDefined();
  });
  it.each(["soap", "soap12", "s"])("lê a resposta direta com prefixo %s", (prefixo) => {
    const resposta = `<${prefixo}:Envelope xmlns:${prefixo}="http://www.w3.org/2003/05/soap-envelope"><${prefixo}:Body><nfeRecepcaoEventoNFResult xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe"><cStat>128</cStat><retEvento><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><nProt>000123456</nProt></infEvento></retEvento></retEnvEvento></nfeRecepcaoEventoNFResult></${prefixo}:Body></${prefixo}:Envelope>`;
    expect(processarRespostaEvento(resposta)).toEqual({ sucesso: true, cStat: "135", xMotivo: "Evento registrado e vinculado a NF-e", protocolo: "000123456" });
  });
  it("lê rejeição fiscal na resposta direta sem confundir com sucesso", () => {
    const resposta = '<Envelope><Body><nfeRecepcaoEventoNFResult><retEnvEvento><cStat>225</cStat><xMotivo>Rejeicao: Falha no Esquema XML do lote de NF-e</xMotivo></retEnvEvento></nfeRecepcaoEventoNFResult></Body></Envelope>';
    expect(processarRespostaEvento(resposta)).toEqual({ sucesso: false, cStat: "225", xMotivo: "Rejeicao: Falha no Esquema XML do lote de NF-e", protocolo: null });
  });
});
