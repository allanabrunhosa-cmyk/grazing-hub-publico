import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), acesso: vi.fn(), numeracao: vi.fn(), certificado: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.acesso }));
vi.mock("@/lib/prisma", () => ({ prisma: { certificadoDigital: { findUnique: sim.certificado } } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/numeracao", () => ({ obterNumeracaoFiscalBrasilNfe: sim.numeracao }));
vi.mock("@/app/(protegido)/financeiro/fiscal/numeracao/actions", () => ({ consultarNumeracaoFiscalBrasilNfeAction: vi.fn(), atualizarNumeracaoFiscalBrasilNfeAction: vi.fn() }));
vi.mock("@/app/(protegido)/financeiro/fiscal/numeracao/numeracao-client", () => ({ NumeracaoFiscal: () => null }));
vi.mock("@/app/(protegido)/configuracoes/certificado-card", () => ({ CertificadoCard: () => null }));
import ConfiguracoesFiscaisPage from "@/app/(protegido)/financeiro/fiscal/configuracoes/page";
beforeEach(() => { vi.resetAllMocks(); sim.guarda.mockResolvedValue({ admin: false }); sim.acesso.mockResolvedValue(false); sim.numeracao.mockResolvedValue({}); sim.certificado.mockResolvedValue(null); });
it("recusa acesso antes de ler numeração ou certificado", async () => {
  sim.guarda.mockRejectedValue(new Error("NEGADO"));
  await expect(ConfiguracoesFiscaisPage()).rejects.toThrow("NEGADO");
  expect(sim.guarda).toHaveBeenCalledExactlyOnceWith("financeiro.fiscal.painel");
  expect(sim.numeracao).not.toHaveBeenCalled(); expect(sim.certificado).not.toHaveBeenCalled();
});
it("consulta fiscal não concede metadados administrativos nem edição", async () => {
  const tela = await ConfiguracoesFiscaisPage();
  expect(tela.props.podeConsultar).toBe(false); expect(sim.certificado).not.toHaveBeenCalled();
  expect(sim.acesso).toHaveBeenCalledWith("configuracoes.loja");
});
it("consulta do certificado seleciona apenas metadados e não libera edição ao não administrador", async () => {
  sim.acesso.mockImplementation(async recurso => recurso === "configuracoes.loja");
  const tela = await ConfiguracoesFiscaisPage();
  expect(tela.props.certificado.props.podeEditar).toBe(false); expect(tela.props.certificado.props.podeExcluir).toBe(false);
  const selecao = sim.certificado.mock.calls[0][0].select;
  expect(selecao).not.toHaveProperty("senhaCifrada"); expect(selecao).not.toHaveProperty("arquivoData");
});
it("administrador conserva as permissões separadas de editar e excluir", async () => {
  sim.guarda.mockResolvedValue({ admin: true });
  sim.acesso.mockImplementation(async (recurso, acao) => recurso === "configuracoes.loja" && acao !== "excluir");
  const tela = await ConfiguracoesFiscaisPage();
  expect(tela.props.certificado.props.podeEditar).toBe(true); expect(tela.props.certificado.props.podeExcluir).toBe(false);
  expect(tela.props.podeConsultar).toBe(false);
});
