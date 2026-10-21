import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/sefaz/soap", () => ({ chamarNfeDistribuicaoDFe: vi.fn() }));
import { encontrarLacunas, formatarNsu } from "@/lib/sefaz/recuperacao-regras";
import { consultarDocumentoPontual, processarRespostaSoap } from "@/lib/sefaz/distribuicao";
import { chamarNfeDistribuicaoDFe } from "@/lib/sefaz/soap";
const n = (v:number) => formatarNsu(BigInt(v));
const envelope = '<soap:Envelope><soap:Body><nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult><retDistDFeInt><cStat>137</cStat></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>';
describe("lacunas e consultas pontuais", () => {
  it("preserva todos os intervalos sem confundir posição com quantidade de notas", () => {
    expect(encontrarLacunas(n(16776), n(16809), [n(16800), n(16778), n(16778)])).toEqual([
      { inicio:n(16777), fim:n(16777) }, { inicio:n(16779), fim:n(16799) }, { inicio:n(16801), fim:n(16809) },
    ]);
  });
  it("representa intervalo grande sem expandi-lo em milhões de linhas", () => {
    expect(encontrarLacunas(n(0), n(9000000), [])).toEqual([{ inicio:n(1), fim:n(9000000) }]);
  });
  it("rejeita sequência inválida ou documento fora do intervalo", () => {
    expect(() => encontrarLacunas(n(2), n(1), [])).toThrow();
    expect(() => encontrarLacunas(n(1), n(2), [n(3)])).toThrow();
  });
  it("distingue cursor ausente de uma indicação real da SEFAZ", () => {
    expect(processarRespostaSoap(envelope, n(4))).toMatchObject({ ultNSUPresente: false, ultNSU: n(4) });
  });
  it.each([['NSU', n(3), `<consNSU><NSU>${n(3)}</NSU></consNSU>`], ['CHAVE', '3'.repeat(44), `<consChNFe><chNFe>${'3'.repeat(44)}</chNFe></consChNFe>`]] as const)("monta %s com contrato e ambiente corretos", async (tipo, referencia, esperado) => {
    vi.mocked(chamarNfeDistribuicaoDFe).mockResolvedValue(envelope);
    await consultarDocumentoPontual('12345678000199', tipo, referencia);
    expect(chamarNfeDistribuicaoDFe).toHaveBeenLastCalledWith(expect.stringContaining(esperado));
    expect(chamarNfeDistribuicaoDFe).toHaveBeenLastCalledWith(expect.stringContaining('<tpAmb>1</tpAmb><cUFAutor>35</cUFAutor>'));
  });
});
