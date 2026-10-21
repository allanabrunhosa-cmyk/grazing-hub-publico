import { beforeEach, expect, it, vi } from "vitest";
import { configuracaoBrasilNfeFicticia } from "./brasilnfe-interface-dados";

const s = vi.hoisted(() => ({ autorizar: vi.fn(), validar: vi.fn(), obter: vi.fn(), salvar: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: s.revalidar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: s.autorizar }));
vi.mock("@/lib/fiscal-saida/brasilnfe/configuracao", () => ({ validarConexaoBrasilNfe: s.validar, obterConfiguracaoBrasilNfe: s.obter, salvarConfiguracaoBrasilNfe: s.salvar }));
import { obterConfiguracaoBrasilNfeAction, salvarConfiguracaoBrasilNfeAction, validarConexaoBrasilNfeAction } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe-actions";

beforeEach(() => { vi.resetAllMocks(); s.autorizar.mockResolvedValue({ userId: "administrador-ficticio" }); });

it("detalhes transitórios ficam separados do DTO persistente na resposta da ação autorizada", async () => {
  const detalhesDiagnostico = { error: { estado: "EXIBIDO", valor: "Consulta não permitida." }, erros: [], quantidadeErros: 0, camposAusentes: [], camposSuprimidos: [], versao: 2, verificadaEm: "2026-10-10T12:00:00.000Z", expiraEm: "2026-10-10T12:05:00.000Z" };
  s.validar.mockResolvedValue({ ...configuracaoBrasilNfeFicticia, detalhesDiagnostico });
  const resultado = await validarConexaoBrasilNfeAction({ versao: 1 });
  expect(s.autorizar).toHaveBeenCalledWith("configuracoes.brasilnfe", "editar");
  expect(resultado).toEqual({ ok: true, dados: configuracaoBrasilNfeFicticia, detalhesDiagnostico });
  expect(resultado.ok && resultado.dados).not.toHaveProperty("detalhesDiagnostico");
});

it("leitura e salvamento não reaproveitam detalhes de validação", async () => {
  s.obter.mockResolvedValue(configuracaoBrasilNfeFicticia); s.salvar.mockResolvedValue(configuracaoBrasilNfeFicticia);
  expect(await obterConfiguracaoBrasilNfeAction()).not.toHaveProperty("detalhesDiagnostico");
  expect(await salvarConfiguracaoBrasilNfeAction({ versao: 1 })).not.toHaveProperty("detalhesDiagnostico");
  expect(s.validar).not.toHaveBeenCalled();
});

it("guarda negada impede executar consulta ou entregar detalhes", async () => {
  s.autorizar.mockRejectedValue(new Error("Permissão negada"));
  await expect(validarConexaoBrasilNfeAction({ versao: 1 })).rejects.toThrow("Permissão negada");
  expect(s.validar).not.toHaveBeenCalled(); expect(s.revalidar).not.toHaveBeenCalled();
});

it("erro inesperado não serializa mensagem nem cause externos", async () => {
  s.validar.mockRejectedValue(new Error("segredo-ficticio-na-mensagem", { cause: { token: "segredo-ficticio-na-causa" } }));
  const resultado = await validarConexaoBrasilNfeAction({ versao: 1 });
  expect(resultado).toEqual({ ok: false, erro: "Diagnóstico indisponível. Nenhuma transmissão foi autorizada." });
  expect(JSON.stringify(resultado)).not.toContain("segredo-ficticio");
});
