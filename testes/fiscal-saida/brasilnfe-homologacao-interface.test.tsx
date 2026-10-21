// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PilotosBrasilNfe } from "@/app/(protegido)/financeiro/fiscal/homologacao/pilotos-client";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";
import { hashRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
const a = vi.hoisted(() => ({ preparar: vi.fn(), aprovar: vi.fn(), transmitir: vi.fn(), consultar: vi.fn(), documentos: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: a.refresh }) }));
vi.mock("@/app/(protegido)/financeiro/fiscal/homologacao/actions", () => ({ separarIpiPilotoBrasilNfeAction: vi.fn(), prepararPilotosBrasilNfeAction: a.preparar, aprovarPilotosBrasilNfeAction: a.aprovar, transmitirPilotoBrasilNfeAction: a.transmitir, consultarPilotoBrasilNfeAction: a.consultar, documentosPilotoBrasilNfeAction: a.documentos }));
type P = Parameters<typeof PilotosBrasilNfe>[0];
function dados(aprovado = false, liberada = false): P {
  const pilotos = ([55, 65] as const).map(modelo => {
    const historicos = (["EMPRESA", "OPERACAO", "PRODUTO"] as const).map(alvo => {
      const d = rascunhoRegraSintetica(alvo, modelo), id = `${modelo}-${alvo}-ficticio`;
      const v = { id: `versao-${id}`, revisao: 1, estado: aprovado ? "APROVADA" : "PROPOSTA", conteudo: d.conteudo, fundamentacaoFiscal: d.fundamentacaoFiscal, conteudoHash: hashRegraFiscalBrasilNfe(d.conteudo), fundamentacaoHash: hashRegraFiscalBrasilNfe(d.fundamentacaoFiscal), aprovacaoHash: aprovado ? "a".repeat(64) : null };
      return { id, revisao: 1, modelo, alvo, versoes: [v] };
    });
    return { documentoId: `documento-${modelo}-ficticio`, modelo, ambiente: 2, total: "10.00", estado: "SEM_EMISSOR", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), revisaoPedido: 1, montagemConcluida: true, aprovacaoInterna: aprovado, transmissaoPermitida: false, liberacaoTransmissao: { liberada, motivo: liberada ? null : "Emissão ainda não liberada." }, pendencias: [], historicos, versoes: historicos.map(h => ({ regraId: h.id, versaoId: h.versoes[0].id, alvo: h.alvo, revisao: 1, conteudoHash: h.versoes[0].conteudoHash, fundamentacaoHash: h.versoes[0].fundamentacaoHash, aprovacaoHash: h.versoes[0].aprovacaoHash })) };
  });
  return { editar: true, pilotos, resultados: pilotos.map(p => ({ id: p.documentoId, status: "SEM_EMISSOR", tentativas: 0, arquivos: { xml: false, pdf: false, html: false }, liberacaoTransmissao: { liberada, motivo: liberada ? null : "Emissão ainda não liberada." } })), pendenciasExternas: { nfe: [], nfce: ["CSC não conferido"] } } as unknown as P;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("Interface da revisão e transmissão individual, ações somente simuladas", () => {
  it("prepara explicitamente; leitura e falta de permissão não criam cenário", async () => {
    const p = dados(); render(<PilotosBrasilNfe {...p} pilotos={[]} editar={false} />);
    expect(a.preparar).not.toHaveBeenCalled(); expect((screen.getByRole("button", { name: /Preparar pilotos/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("exige revisão e declaração factual separadas, não aprova por blur nem transmite ao aprovar", async () => {
    a.aprovar.mockResolvedValue({ ok: true }); render(<PilotosBrasilNfe {...dados()} />);
    const botao = screen.getByRole("button", { name: "Aprovar revisão interna do piloto" });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: /Conferi que o sanduíche/ }));
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: /Revisei as fontes/ }));
    fireEvent.blur(botao); expect(a.aprovar).not.toHaveBeenCalled(); await userEvent.click(botao);
    expect(a.aprovar).toHaveBeenCalledTimes(1); expect(a.aprovar.mock.calls[0][0].versoes).toHaveLength(6); expect(a.transmitir).not.toHaveBeenCalled();
  });
  it("autoriza documento55 específico com valor e hashes; CSC bloqueia somente65", async () => {
    a.transmitir.mockResolvedValue({ ok: true }); render(<PilotosBrasilNfe {...dados(true, true)} />);
    const enviar55 = screen.getByRole("button", { name: "Transmitir uma homologação 55" });
    expect((enviar55 as HTMLButtonElement).disabled).toBe(true);
    const autorizar = screen.getAllByRole("checkbox", { name: /Autorizo especificamente/ });
    expect(autorizar[1].getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(autorizar[1]);
    expect(a.transmitir).not.toHaveBeenCalled();
    await userEvent.click(autorizar[0]); await userEvent.click(enviar55);
    expect(a.transmitir).toHaveBeenCalledWith({ documentoId: "documento-55-ficticio", modelo: 55, ambiente: 2, hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), total: "10.00", autorizarUmaTransmissao: true });
    expect(a.consultar).not.toHaveBeenCalled(); expect(a.documentos).not.toHaveBeenCalled();
  });
  it("regras aprovadas, manifesto completo e CSC conferido não liberam autorização quando o gate está bloqueado", () => {
    const p = dados(true); p.pendenciasExternas.nfce = [];
    render(<PilotosBrasilNfe {...p} />);
    expect(screen.queryByRole("checkbox", { name: /Autorizo especificamente/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Transmitir uma homologação/ })).toBeNull();
    const botoes = screen.getAllByRole("button", { name: "Emissão ainda não liberada" });
    expect(botoes).toHaveLength(2); expect(botoes.every(b => b.hasAttribute("disabled"))).toBe(true);
    fireEvent.click(botoes[0]); expect(a.transmitir).not.toHaveBeenCalled();
    expect(screen.getAllByText("Bloqueada")).toHaveLength(2);
  });
  it("DTO histórico sem gate explícito continua bloqueado sem usar aprovação antiga como liberação", () => {
    const p = dados(true); Reflect.deleteProperty(p.pilotos[0], "liberacaoTransmissao"); Reflect.deleteProperty(p.resultados[0], "liberacaoTransmissao");
    render(<PilotosBrasilNfe {...p} />);
    expect(screen.queryByRole("checkbox", { name: /Autorizo especificamente/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Emissão ainda não liberada" }).every(b => b.hasAttribute("disabled"))).toBe(true);
    expect(a.transmitir).not.toHaveBeenCalled();
  });
  it("tentativa anterior remove o botão de envio e conserva mensagem segura", () => {
    const p = dados(true); p.resultados[0].tentativas = 1; p.resultados[0].status = "PENDENTE_CONFERENCIA"; p.resultados[0].ultimoErro = "Resultado incerto: conferir manualmente.";
    render(<PilotosBrasilNfe {...p} />);
    expect(screen.queryByRole("button", { name: "Transmitir uma homologação 55" })).toBeNull(); expect(screen.getByText("Resultado incerto: conferir manualmente.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Consultar este documento" })).toBeTruthy(); expect(a.transmitir).not.toHaveBeenCalled();
  });
  it("mostra categoria, HTTP e etapa locais sem chamar API ou permitir novo envio", () => {
    const p = dados(true); p.resultados[0].tentativas = 1; p.resultados[0].status = "PENDENTE_CONFERENCIA";
    p.resultados[0].falhaTecnica = { em: new Date("2026-10-13T12:00:00Z"), operacao: "CONSULTAR", metadados: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NOTA_CAMPOS", statusFornecedor: null, codigoFornecedor: null } };
    render(<PilotosBrasilNfe {...p} />);
    expect(screen.getByText(/Campo fora do contrato · HTTP 200/)).toBeTruthy();
    expect(screen.getByText(/Última falha técnica · Consulta/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Transmitir uma homologação 55" })).toBeNull();
    expect(a.consultar).not.toHaveBeenCalled(); expect(a.transmitir).not.toHaveBeenCalled();
  });
});
