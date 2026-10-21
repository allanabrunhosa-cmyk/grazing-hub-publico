import type { MapaCsv } from "@/lib/financeiro/conciliacao/arquivo";
export function ofxTeste(valor = "-125.55", id = "banco-001", conta = "12345") { return `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>001<BRANCHID>0001<ACCTID>${conta}<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260911120000[-3:BRT]<TRNAMT>${valor}<FITID>${id}<NAME>Fornecedor teste<MEMO>Compra de insumos</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`; }
export const mapaCsvTeste: MapaCsv = { cabecalho: 0, data: 0, descricao: 1, valor: 2, formatoData: "BR", formatoValor: "BR", modo: "SINAL", identificador: -1 };
export function ofxItauTeste(itens: { id: string; valor: string; descricao: string }[]) {
  const trechos = itens.map(item => ofxTeste(item.valor, item.id)
    .replace("20260911120000", item.id.slice(0, 8) + "120000")
    .replace("Fornecedor teste", item.descricao).match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/)![0]);
  return ofxTeste().replace("<BANKID>001", "<BANKID>341")
    .replace(/<STMTTRN>[\s\S]*?<\/STMTTRN>/, trechos.join("\n"));
}
export function formularioTeste(texto = ofxTeste(), nome = "extrato.ofx") {
  const f = new FormData(); f.set("arquivo", new File([texto], nome)); f.set("contaId", "banco"); f.set("mapa", JSON.stringify(mapaCsvTeste)); f.set("confirmarConta", "sim"); f.set("indices", "[0]"); return f;
}
