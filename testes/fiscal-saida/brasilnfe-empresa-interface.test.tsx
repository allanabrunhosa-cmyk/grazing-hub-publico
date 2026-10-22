// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PainelFiscal, PerfilFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { EditarPerfilEmpresa } from "@/app/(protegido)/financeiro/fiscal/empresa/editar-perfil";

const controles = vi.hoisted(() => ({ editor: vi.fn(), atualizar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: controles.atualizar }) }));
vi.mock("@/app/(protegido)/vendas/fiscal/cobertura/versao-editor", () => ({ dadosFiscaisIniciais: () => structuredClone(perfil) }));
vi.mock("@/app/(protegido)/financeiro/fiscal/edicao-versionada", () => ({
  EdicaoFiscalVersionada: (props: { versao?: VersaoFiscalDto; painel: PainelFiscal; fechar: () => void; atualizado: () => void }) => {
    controles.editor(props);
    return <><button onClick={props.fechar}>Fechar revisão sintética</button><button onClick={() => { props.atualizado(); props.fechar(); }}>Aplicar revisão sintética</button></>;
  },
}));

const perfil: PerfilFiscal = { estabelecimento: "singleton", cnpj: "00000000000000", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "000000000000", regime: "SIMPLES_NACIONAL", confirmado: true, evidenciaEnquadramento: "Evidência exclusivamente sintética", crt: 1, modelos: ["55", "65"], emissor: "BRASIL_NFE", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
const versao = (versao: number, alteracoes: Partial<VersaoFiscalDto> = {}): VersaoFiscalDto => ({ id: `perfil-sintetico-${versao}`, tipo: "PERFIL", chave: "singleton", versao, vigenciaInicio: "2026-10-12", status: "ATIVO", dados: perfil, justificativa: "Massa sintética", fontes: ["Fonte sintética"], criadoPorNome: "Administrador sintético", createdAt: "2026-10-12T12:00:00.000Z", hash: "a".repeat(64), ...alteracoes });
const abrir = async (versoes: VersaoFiscalDto[]) => {
  render(<EditarPerfilEmpresa versoes={versoes} />);
  expect(controles.editor).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /regime e vigência/ }));
  return controles.editor.mock.lastCall![0] as { versao?: VersaoFiscalDto; painel: PainelFiscal; tipo: string };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("Perfil fiscal da empresa: base vigente da revisão", () => {
  it("edita o perfil ativo sem antecipar a proposta futura e preserva todas as versões para o próximo número", async () => {
    const vigente = versao(1), futura = versao(2, { status: "RASCUNHO", vigenciaInicio: "2027-01-01", dados: { ...perfil, regime: "LUCRO_PRESUMIDO", crt: 3, reforma: "EXIGIR_REGRA" } });
    const versoes = [futura, vigente];
    const props = await abrir(versoes);
    expect(props.tipo).toBe("PERFIL");
    expect(props.versao).toBe(vigente);
    expect(props.painel.versoes).toBe(versoes);
    expect(props.painel.versoes.map(v => v.versao)).toEqual([2, 1]);
    expect(futura.status).toBe("RASCUNHO");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar revisão sintética" }));
    expect(controles.atualizar).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Fechar revisão sintética" })).toBeNull();
  });

  it("ordena pela vigência e só usa a revisão mais alta como desempate da mesma data", async () => {
    const antiga = versao(8), vigente = versao(3, { vigenciaInicio: "2026-10-15" });
    const anteriorMesmaData = versao(2, { vigenciaInicio: "2026-10-15" });
    const outroEstabelecimento = versao(10, { chave: "outro" });
    const outroTipo = versao(11, { tipo: "REGRA" });
    const props = await abrir([antiga, anteriorMesmaData, outroEstabelecimento, vigente, outroTipo]);
    expect(props.versao).toBe(vigente);
  });

  it("não usa rascunho ou versão ativa futura quando ainda não existe perfil vigente", async () => {
    const props = await abrir([versao(1, { status: "RASCUNHO" }), versao(2, { vigenciaInicio: "2027-01-01" })]);
    expect(props.versao).toBeUndefined();
    expect(props.painel.versoes).toHaveLength(2);
  });

  it("aplica a data civil de Brasília e só seleciona a versão futura após sua vigência chegar", async () => {
    const anterior = versao(1), proxima = versao(2, { vigenciaInicio: "2026-10-15" });
    vi.setSystemTime(new Date("2026-10-15T02:59:59.000Z"));
    expect((await abrir([proxima, anterior])).versao).toBe(anterior);
    cleanup(); controles.editor.mockClear();
    vi.setSystemTime(new Date("2026-10-15T03:00:00.000Z"));
    expect((await abrir([proxima, anterior])).versao).toBe(proxima);
  });
});
