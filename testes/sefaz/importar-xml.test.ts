import { beforeEach, describe, expect, it, vi } from "vitest";
import { validarXmlImportado } from "@/lib/sefaz/validar-importacao";

const chave = "3".repeat(44);
const cnpj = "12345678000199";
const xml = `<nfeProc><NFe><infNFe Id="NFe${chave}"><ide><mod>55</mod><tpAmb>1</tpAmb><dhEmi>2026-09-10T12:00:00-03:00</dhEmi></ide><emit><CNPJ>98765432000199</CNPJ><xNome>Fornecedor</xNome></emit><dest><CNPJ>${cnpj}</CNPJ></dest><det nItem="1"><prod><cProd>1</cProd><xProd>Queijo</xProd><uCom>KG</uCom><qCom>2</qCom><vUnCom>50</vUnCom><vProd>100</vProd></prod></det><total><ICMSTot><vNF>100</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${chave}</chNFe><tpAmb>1</tpAmb><cStat>100</cStat></infProt></protNFe></nfeProc>`;

const banco = vi.hoisted(() => ({ sessao: vi.fn(), buscar: vi.fn(), atualizar: vi.fn(), revalidar: vi.fn(), criar: vi.fn(), transacao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: banco.transacao, notaFiscalRecebida: { findUnique: banco.buscar, updateMany: banco.atualizar } } }));
vi.mock("@/lib/session", () => ({ getSession: banco.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: banco.revalidar }));
vi.mock("@/lib/sefaz/certificado", () => ({ obterCnpjConsulta: async () => "12345678000199" }));
import { importarXmlAvulsoAction, importarXmlNotaAction } from "@/app/(protegido)/notas-fiscais/importar-xml";

describe("validação de XML importado", () => {
  it("extrai o documento completo preservando o conteúdo original", () => {
    expect(validarXmlImportado(xml, chave, cnpj)).toMatchObject({ xmlCompleto: xml, tipo: "PROC_NFE", valorTotal: 100 });
  });
  it.each([
    ["outra chave", xml, "4".repeat(44), cnpj],
    ["outro destinatário", xml, chave, "0".repeat(14)],
    ["resumo", "<resNFe/>", chave, cnpj],
    ["documento truncado", xml.slice(0, -20), chave, cnpj],
    ["entidades", '<!DOCTYPE nfeProc [<!ENTITY x "x">]>' + xml, chave, cnpj],
    ["homologação", xml.replaceAll("<tpAmb>1</tpAmb>", "<tpAmb>2</tpAmb>"), chave, cnpj],
    ["protocolo divergente", xml.replace(`<chNFe>${chave}</chNFe>`, `<chNFe>${"4".repeat(44)}</chNFe>`), chave, cnpj],
    ["não autorizada", xml.replace("<cStat>100</cStat>", "<cStat>110</cStat>"), chave, cnpj],
  ])("rejeita %s", (_, conteudo, chaveEsperada, destinatario) => {
    expect(() => validarXmlImportado(conteudo, chaveEsperada, destinatario)).toThrow();
  });
});

describe("importação autenticada", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    banco.sessao.mockResolvedValue({ userId: "usuario" });
    banco.buscar.mockResolvedValue({ id: "nota", chaveAcesso: chave, xml: null });
    banco.atualizar.mockResolvedValue({ count: 1 });
    banco.criar.mockResolvedValue({ count: 1 });
    banco.transacao.mockImplementation(async (executar) => executar({ notaFiscalRecebida: { createMany: banco.criar, updateMany: banco.atualizar } }));
  });
  function formulario() { const dados = new FormData(); dados.set("arquivo", new File([xml], "nota.xml")); return dados; }
  it("salva somente o XML faltante sem alterar NSU, manifestação ou conciliação", async () => {
    expect(await importarXmlNotaAction("nota", formulario())).toEqual({ ok: true });
    expect(banco.atualizar).toHaveBeenCalledWith({ where: { id: "nota", xml: null }, data: {
      xml, tipo: "PROC_NFE", fornecedorCnpj: "98765432000199", fornecedorNome: "Fornecedor", valorTotal: 100, dataEmissao: expect.any(Date),
    } });
    expect(banco.revalidar).toHaveBeenCalledWith("/notas-fiscais");
  });
  it("exige sessão", async () => {
    banco.sessao.mockResolvedValue(null);
    expect(await importarXmlNotaAction("nota", formulario())).toHaveProperty("erro");
    expect(banco.buscar).not.toHaveBeenCalled();
  });
  it("não sobrescreve XML existente", async () => {
    banco.buscar.mockResolvedValue({ id: "nota", chaveAcesso: chave, xml });
    expect(await importarXmlNotaAction("nota", formulario())).toHaveProperty("erro");
    expect(banco.atualizar).not.toHaveBeenCalled();
  });
  it("informa quando uma sincronização preencheu o XML durante a importação", async () => {
    banco.atualizar.mockResolvedValue({ count: 0 });
    expect(await importarXmlNotaAction("nota", formulario())).toHaveProperty("erro");
  });
  it("importa nota nova pelo XML sem enviar evento ou alterar o cursor", async () => {
    expect(await importarXmlAvulsoAction(formulario())).toHaveProperty("mensagem");
    expect(banco.criar).toHaveBeenCalledWith({ data: [expect.objectContaining({ chaveAcesso: chave, nsu: "", xml, tipo: "PROC_NFE" })], skipDuplicates: true });
    const registro = banco.criar.mock.calls[0][0].data[0];
    expect(registro).not.toHaveProperty("ultimaManifestacao");
    expect(banco.atualizar).not.toHaveBeenCalled();
  });
  it("preenche resumo existente sem criar nota duplicada", async () => {
    banco.criar.mockResolvedValue({ count: 0 });
    expect(await importarXmlAvulsoAction(formulario())).toEqual({ mensagem: "XML adicionado à nota já existente." });
    expect(banco.atualizar).toHaveBeenCalledWith({ where: { chaveAcesso: chave, xml: null }, data: expect.objectContaining({ xml }) });
  });
  it("informa arquivo já existente sem substituir dados", async () => {
    banco.criar.mockResolvedValue({ count: 0 });
    banco.atualizar.mockResolvedValue({ count: 0 });
    expect(await importarXmlAvulsoAction(formulario())).toMatchObject({ mensagem: expect.stringContaining("Nenhum dado foi substituído") });
  });
  it("rejeita destinatário incorreto antes de gravar a importação avulsa", async () => {
    const dados = formulario(); dados.set("arquivo", new File([xml.replace(cnpj, "0".repeat(14))], "nota.xml"));
    expect(await importarXmlAvulsoAction(dados)).toHaveProperty("erro");
    expect(banco.transacao).not.toHaveBeenCalled();
  });
  it("exige sessão também na importação avulsa", async () => {
    banco.sessao.mockResolvedValue(null);
    expect(await importarXmlAvulsoAction(formulario())).toHaveProperty("erro");
    expect(banco.transacao).not.toHaveBeenCalled();
  });

});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
