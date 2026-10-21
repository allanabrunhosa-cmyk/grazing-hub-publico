vi.mock("server-only", () => ({}));
import { beforeEach, expect, it, vi } from "vitest";
import JSZip from "jszip";

const simulacao = vi.hoisted(() => ({ sessao: vi.fn(), notas: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { notaFiscalRecebida: { findMany: simulacao.notas } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sefaz/busca-agendada", () => ({ agendarBusca: vi.fn() }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: vi.fn() }));
vi.mock("@/lib/estoque/registrarMovimentacao", () => ({ registrarMovimentacao: vi.fn() }));
import { exportarXmlPorDataAction } from "@/app/(protegido)/notas-fiscais/actions";

const chave = "1".repeat(44);
const xml = '<?xml version="1.0" encoding="UTF-8"?>\r\n<nfeProc><teste>Queijo &amp; açúcar</teste></nfeProc>';
beforeEach(() => {
  vi.resetAllMocks();
  simulacao.sessao.mockResolvedValue({ userId: "teste" });
  simulacao.notas.mockResolvedValue([{ chaveAcesso: chave, xml, tipo: "PROC_NFE" }]);
});

it("exporta todo o histórico sem datas e preserva exatamente o XML original no ZIP", async () => {
  const resultado = await exportarXmlPorDataAction("", "");
  expect(resultado).toMatchObject({ nomeArquivo: "notas-fiscais_todas.zip", quantidade: 1, semXml: 0 });
  expect(simulacao.notas).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  if ("erro" in resultado) throw Error(resultado.erro);
  const zip = await JSZip.loadAsync(resultado.conteudoBase64, { base64: true, checkCRC32: true });
  expect(Object.keys(zip.files)).toEqual([chave + ".xml"]);
  expect(await zip.file(chave + ".xml")!.async("string")).toBe(xml);
});

it("inclui todo o primeiro e último dia do período, inclusive fevereiro bissexto", async () => {
  expect(await exportarXmlPorDataAction("2024-02-01", "2024-02-29")).toMatchObject({ nomeArquivo: "notas-fiscais_2024-02-01_a_2024-02-29.zip" });
  expect(simulacao.notas).toHaveBeenCalledWith(expect.objectContaining({ where: { dataEmissao: {
    gte: new Date("2024-02-01T00:00:00.000Z"), lte: new Date("2024-02-29T23:59:59.999Z"),
  } } }));
});

it.each([["", "2026-09-11"], ["2026-09-01", ""], ["2026-02-29", "2026-03-01"], ["2026-09-31", "2026-10-01"], ["inválida", "2026-09-11"], ["2026-09-12", "2026-09-11"]])("rejeita o período inválido %s / %s antes de consultar notas", async (inicio, fim) => {
  expect(await exportarXmlPorDataAction(inicio, fim)).toHaveProperty("erro");
  expect(simulacao.notas).not.toHaveBeenCalled();
});

it("exige sessão antes de exportar", async () => {
  simulacao.sessao.mockResolvedValue(null);
  expect(await exportarXmlPorDataAction("", "")).toMatchObject({ erro: expect.stringContaining("sessão") });
  expect(simulacao.notas).not.toHaveBeenCalled();
});

it("conta ausências e resumos, sem colocá-los no ZIP", async () => {
  simulacao.notas.mockResolvedValue([
    { chaveAcesso: chave, xml, tipo: "PROC_NFE" },
    { chaveAcesso: "2".repeat(44), xml: null, tipo: "RES_NFE" },
    { chaveAcesso: "3".repeat(44), xml: "<resNFe/>", tipo: "RES_NFE" },
    { chaveAcesso: "4".repeat(44), xml: " ", tipo: "PROC_NFE" },
  ]);
  const resultado = await exportarXmlPorDataAction("", "");
  expect(resultado).toMatchObject({ quantidade: 1, semXml: 3 });
  if ("erro" in resultado) throw Error(resultado.erro);
  const zip = await JSZip.loadAsync(resultado.conteudoBase64, { base64: true });
  expect(Object.keys(zip.files)).toEqual([chave + ".xml"]);
});

it("informa quando não há notas ou nenhum XML completo", async () => {
  simulacao.notas.mockResolvedValue([]);
  expect(await exportarXmlPorDataAction("", "")).toMatchObject({ erro: "Nenhuma nota disponível para exportar." });
  simulacao.notas.mockResolvedValue([{ chaveAcesso: chave, xml: null, tipo: "RES_NFE" }]);
  expect(await exportarXmlPorDataAction("", "")).toMatchObject({ erro: expect.stringContaining("ainda não têm XML completo") });
});

it("trata falhas de leitura sem expor detalhes internos", async () => {
  simulacao.notas.mockRejectedValue(Error("detalhe interno"));
  expect(await exportarXmlPorDataAction("", "")).toEqual({ erro: "Não foi possível preparar os XMLs. Tente novamente." });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
