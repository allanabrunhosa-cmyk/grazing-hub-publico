// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumeracaoFiscal } from "@/app/(protegido)/financeiro/fiscal/numeracao/numeracao-client";
import type { ComandoAtualizacaoNumeracaoBrasilNfe, NumeracaoFiscalBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
const fixture = (): NumeracaoFiscalBrasilNfeDto => ({ versaoConfiguracao: 3, emitente: { cnpj: "00000000000000", nome: "EMITENTE FICTÍCIO" }, consulta: { situacao: "CONCLUIDA", consultadoEm: "2026-10-14T12:00:00.000Z", httpStatus: 200, falha: null, avisosPresentes: false }, linhas: [{ ambiente: 2, modelo: 55, serie: "001", padrao: true, proximoNumero: "12", ultimaAutorizadaLocal: null, divergencia: null }, { ambiente: 1, modelo: 65, serie: "2", padrao: true, proximoNumero: "44", ultimaAutorizadaLocal: null, divergencia: null }], pendencias: ["Próximo número não reservado."] });
afterEach(cleanup);
describe("Séries e numeração: estados reais e ação manual", () => {
  it("mostra ambientes separados e filtra sem consultar ou reservar contador", async () => {
    const consultar = vi.fn(); render(<NumeracaoFiscal inicial={fixture()} podeConsultar consultar={consultar} />);
    expect(screen.getByText("Homologação · 2")).toBeTruthy(); expect(screen.getByText("Produção · 1")).toBeTruthy();
    expect(screen.getByText("Configurar ou consultar numeração não autoriza transmissão. Cada documento exige habilitação, revisão e autorização no pedido.")).toBeTruthy();
    expect(screen.queryByText(/Produção permanece bloqueada para transmissão/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Homologação (1)" }));
    expect(screen.queryByText("Produção · 1")).toBeNull(); expect(consultar).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Atualizar numeração|Emitir|Reservar/ })).toBeNull();
  });
  it("consulta uma vez por ação explícita com versão atual e mostra falha persistente", async () => {
    const dados = fixture(); dados.consulta = { ...dados.consulta, situacao: "FALHOU", falha: { categoria: "HTTP", httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null } }; dados.linhas = [];
    const consultar = vi.fn().mockResolvedValue({ ok: true, dados }); render(<NumeracaoFiscal inicial={fixture()} podeConsultar consultar={consultar} />);
    expect(consultar).not.toHaveBeenCalled(); await userEvent.click(screen.getByRole("button", { name: "Consultar numeração" }));
    await userEvent.click(screen.getByText("Detalhes da consulta", { exact: true }));
    await waitFor(() => expect(screen.getAllByRole("alert").some(el => el.textContent?.includes("HTTP 403"))).toBe(true));
    expect(consultar).toHaveBeenCalledExactlyOnceWith({ versao: 3 }); expect(screen.getByText("Consulta não concluída")).toBeTruthy();
    expect(screen.queryByText("12")).toBeNull();
  });
  it("oculta ação sem permissão e não apresenta consulta obsoleta como válida", () => {
    const dados = fixture(); dados.consulta.situacao = "OBSOLETA"; dados.consulta.consultadoEm = null; dados.linhas = [];
    render(<NumeracaoFiscal inicial={dados} podeConsultar={false} consultar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Consultar numeração" })).toBeNull(); expect(screen.getByText("Consulta anterior desatualizada")).toBeTruthy(); expect(screen.queryByText("12")).toBeNull();
  });
  it("nova identidade ou versão recebida elimina os contadores anteriores", () => {
    const consultar = vi.fn(), { rerender } = render(<NumeracaoFiscal inicial={fixture()} podeConsultar consultar={consultar} />);
    expect(screen.getByText("12")).toBeTruthy();
    const atual = fixture(); atual.versaoConfiguracao = 4; atual.linhas = []; atual.consulta.situacao = "OBSOLETA"; atual.consulta.consultadoEm = null;
    rerender(<NumeracaoFiscal inicial={atual} podeConsultar consultar={consultar} />);
    expect(screen.queryByText("12")).toBeNull(); expect(screen.getByText("Consulta anterior desatualizada")).toBeTruthy(); expect(consultar).not.toHaveBeenCalled();
  });
  it("apresenta posição, campo, tipo e motivo usando somente os rótulos locais", () => {
    const dados = fixture(); dados.linhas = []; dados.consulta.situacao = "FALHOU"; dados.consulta.falha = { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null,
      itemNumeracao: { posicao: 3, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL" } };
    const consultar = vi.fn(); render(<NumeracaoFiscal inicial={dados} podeConsultar consultar={consultar} />);
    const detalhe = screen.getByRole("region", { name: "Campo incompatível na numeração" });
    expect(detalhe.textContent).toContain("Item 3 da lista Numeracoes"); expect(detalhe.textContent).toContain("Serie"); expect(detalhe.textContent).toContain("número inteiro"); expect(detalhe.textContent).toContain("tipo incompatível com o contrato");
    expect(screen.getByText("Consulta não concluída")).toBeTruthy(); expect(consultar).not.toHaveBeenCalled();
  });
  it("informa a contagem descartada sem afirmar validação dos demais modelos", () => {
    const dados = fixture(); dados.consulta.itensForaEscopo = 6; const consultar = vi.fn(); render(<NumeracaoFiscal inicial={dados} podeConsultar consultar={consultar} />);
    expect(screen.getByText(/Entradas de outros modelos descartadas: 6/).textContent).toContain("seus contadores não foram validados");
    expect(consultar).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /Emitir|Reservar/ })).toBeNull();
  });
  it("campos livres e tipos externos nunca entram no HTML pelo novo detalhe", () => {
    const dados = fixture(); dados.linhas = []; dados.consulta.situacao = "FALHOU";
    dados.consulta.falha = { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null,
      itemNumeracao: { posicao: "TOKEN-SINTETICO-REFLETIDO", campo: "Serie", tipoObservado: "TEXTO", motivo: "TIPO_INCOMPATIVEL", valor: "USER-TOKEN-SINTETICO", descricao: "<a href='https://example.invalid'>Clique</a>" } } as unknown as NonNullable<NumeracaoFiscalBrasilNfeDto["consulta"]["falha"]>;
    const { container } = render(<NumeracaoFiscal inicial={dados} podeConsultar={false} consultar={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "Campo incompatível na numeração" })).toBeNull(); expect(container.innerHTML).not.toContain("TOKEN-SINTETICO"); expect(container.innerHTML).not.toContain("example.invalid");
  });
});

describe("Administração explícita dos contadores", () => {
  const instante = "2026-10-15T12:00:00.000Z";
  const leitura = (): NumeracaoFiscalBrasilNfeDto => ({ ...fixture(), consulta: { ...fixture().consulta, consultadoEm: instante } });
  const confirmado = (entrada: ComandoAtualizacaoNumeracaoBrasilNfe, situacao: "CONFIRMADA" | "PENDENTE_CONFERENCIA" = "CONFIRMADA"): NumeracaoFiscalBrasilNfeDto => {
    const dados = leitura();
    dados.consulta.consultadoEm = "2026-10-15T12:00:01.000Z";
    dados.atualizacao = { situacao, operacaoId: entrada.operacaoId, solicitadoEm: instante, confirmadoEm: situacao === "CONFIRMADA" ? dados.consulta.consultadoEm : null, modelo: entrada.modelo, ambiente: entrada.ambiente, serie: entrada.serie, proximoNumero: entrada.proximoNumero, padrao: entrada.padrao, falha: null, motivo: null };
    if (situacao === "CONFIRMADA") {
      dados.linhas = dados.linhas.filter(l => l.modelo !== entrada.modelo || l.ambiente !== entrada.ambiente || Number(l.serie) !== Number(entrada.serie));
      dados.linhas.push({ modelo: entrada.modelo, ambiente: entrada.ambiente, serie: entrada.serie, proximoNumero: entrada.proximoNumero, padrao: entrada.padrao, ultimaAutorizadaLocal: null, divergencia: null });
    }
    dados.historicoAtualizacoes = [dados.atualizacao];
    return dados;
  };
  async function preencher(modelo = "NF-e · modelo 55", ambiente = "Homologação · 2", serie = "6", numero = "1") {
    for (const [nome, valor] of [["Modelo a configurar", modelo], ["Ambiente a configurar", ambiente]]) {
      await userEvent.click(screen.getByRole("combobox", { name: nome }));
      await userEvent.click(await screen.findByRole("option", { name: new RegExp("^" + valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }));
    }
    await userEvent.clear(screen.getByRole("textbox", { name: /^Série$/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Série$/ }), serie);
    await userEvent.clear(screen.getByRole("textbox", { name: /^Próximo número$/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Próximo número$/ }), numero);
    await userEvent.click(screen.getByRole("combobox", { name: /^Definir como padrão$/ }));
    await userEvent.click(await screen.findByRole("option", { name: /^Sim$/ }));
  }
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(instante)); });
  afterEach(() => vi.useRealTimers());

  it("não salva ao abrir, digitar ou sair do campo; envia só a seleção explícita e conserva números como texto", async () => {
    const atualizar = vi.fn(async (entrada: ComandoAtualizacaoNumeracaoBrasilNfe) => ({ ok: true as const, dados: confirmado(entrada) }));
    const consultar = vi.fn();
    render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={consultar} atualizar={atualizar} />);
    expect(atualizar).not.toHaveBeenCalled();
    await preencher("NFC-e · modelo 65", "Produção · 1", "2", "999999999");
    await userEvent.tab();
    expect(atualizar).not.toHaveBeenCalled(); expect(consultar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Salvar numeração" }));
    await userEvent.click(screen.getByText("Histórico e contadores por série", { exact: true }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Resultado da atualização de numeração" }).textContent).toContain("Configuração confirmada"));
    expect(atualizar).toHaveBeenCalledExactlyOnceWith({ versao: 3, modelo: 65, ambiente: 1, serie: "2", proximoNumero: "999999999", padrao: true, consultadoEm: instante, confirmarAtualizacao: true, operacaoId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(consultar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("region", { name: "Resultado da atualização de numeração" }).textContent).toContain("Nenhum número foi reservado");
  });

  it("não oferece gravação sem a permissão administrativa", () => {
    const atualizar = vi.fn(); render(<NumeracaoFiscal inicial={leitura()} podeConsultar={false} consultar={vi.fn()} atualizar={atualizar} />);
    expect(screen.queryByRole("form", { name: "Configuração de série e próximo número" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar numeração" })).toBeNull(); expect(atualizar).not.toHaveBeenCalled();
  });

  it("rejeita letras e colagem inválida, limita série/número e não presume próximo zero", async () => {
    const atualizar = vi.fn(); render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={vi.fn()} atualizar={atualizar} />);
    await preencher("NF-e · modelo 55", "Homologação · 2", "a1234", "0");
    const serie = screen.getByRole("textbox", { name: /^Série$/ }) as HTMLInputElement;
    expect(serie.value).toBe("123"); expect(serie.maxLength).toBe(3);
    await userEvent.click(serie); await userEvent.paste("x9"); expect(serie.value).toBe("123");
    const numero = screen.getByRole("textbox", { name: /^Próximo número$/ }) as HTMLInputElement;
    expect(numero.maxLength).toBe(9);
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Configuração de série e próximo número" }));
    expect(atualizar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("sem zero inicial");
  });

  it("troca de modelo ou ambiente limpa os parâmetros para não reutilizar outra sequência", async () => {
    render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={vi.fn()} atualizar={vi.fn()} />);
    await preencher();
    await userEvent.click(screen.getByRole("combobox", { name: "Modelo a configurar" }));
    await userEvent.click(await screen.findByRole("option", { name: /^NFC-e · modelo 65$/ }));
    expect((screen.getByRole("textbox", { name: /^Série$/ }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: /^Próximo número$/ }) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("combobox", { name: "Definir como padrão" }).textContent).toContain("Selecione");
  });

  it("impede redução e salto em série ausente antes de chamar o servidor", async () => {
    const atualizar = vi.fn(); render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={vi.fn()} atualizar={atualizar} />);
    await preencher("NF-e · modelo 55", "Homologação · 2", "1", "1");
    expect(screen.getByText(/O próximo número não pode ser menor/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
    await userEvent.clear(screen.getByRole("textbox", { name: /^Série$/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Série$/ }), "6");
    await userEvent.clear(screen.getByRole("textbox", { name: /^Próximo número$/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Próximo número$/ }), "2");
    expect(screen.getByText(/Uma série não localizada na consulta só pode iniciar em 1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("não grava com leitura ausente/obsoleta e revalida os cinco minutos no envio do formulário", async () => {
    const atualizar = vi.fn(); const dados = leitura();
    const tela = render(<NumeracaoFiscal inicial={dados} podeConsultar consultar={vi.fn()} atualizar={atualizar} />);
    await preencher();
    vi.setSystemTime(new Date("2026-10-15T12:05:01.000Z"));
    fireEvent.submit(screen.getByRole("form", { name: "Configuração de série e próximo número" }));
    expect(atualizar).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain("cinco minutos");
    const obsoleta = leitura(); obsoleta.versaoConfiguracao = 4; obsoleta.consulta.situacao = "OBSOLETA"; obsoleta.consulta.consultadoEm = null; obsoleta.linhas = [];
    tela.rerender(<NumeracaoFiscal inicial={obsoleta} podeConsultar consultar={vi.fn()} atualizar={atualizar} />);
    expect((screen.getByRole("textbox", { name: /^Série$/ }) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
  });

  it("trava clique duplicado e a consulta concorrente durante a gravação", async () => {
    let resolver!: (r: { ok: true; dados: NumeracaoFiscalBrasilNfeDto }) => void;
    let entradaPendente!: ComandoAtualizacaoNumeracaoBrasilNfe;
    const atualizar = vi.fn((entrada: ComandoAtualizacaoNumeracaoBrasilNfe) => { entradaPendente = entrada; return new Promise<{ ok: true; dados: NumeracaoFiscalBrasilNfeDto }>(r => { resolver = r; }); });
    const consultar = vi.fn(); render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={consultar} atualizar={atualizar} />);
    await preencher(); await userEvent.click(screen.getByRole("button", { name: "Salvar numeração" }));
    expect(screen.getByRole("button", { name: "Consultar numeração" }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Configuração de série e próximo número" }));
    expect(atualizar).toHaveBeenCalledOnce(); expect(consultar).not.toHaveBeenCalled();
    await act(async () => resolver({ ok: true, dados: confirmado(entradaPendente) }));
  });

  it("mantém resultado incerto bloqueado, sem consulta automática, até a ação manual confirmar", async () => {
    let entrada!: ComandoAtualizacaoNumeracaoBrasilNfe;
    const atualizar = vi.fn(async (e: ComandoAtualizacaoNumeracaoBrasilNfe) => { entrada = e; return { ok: true as const, dados: confirmado(e, "PENDENTE_CONFERENCIA") }; });
    const consultar = vi.fn(async () => { const dados = confirmado(entrada); dados.consulta.consultadoEm = "2026-10-15T12:00:02.000Z"; return { ok: true as const, dados }; });
    render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={consultar} atualizar={atualizar} />);
    await preencher(); await userEvent.click(screen.getByRole("button", { name: "Salvar numeração" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Resultado da atualização de numeração" }).textContent).toContain("Resultado pendente de conferência"));
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true); expect(consultar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Consultar numeração" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Resultado da atualização de numeração" }).textContent).toContain("Configuração confirmada"));
    expect(atualizar).toHaveBeenCalledOnce(); expect(consultar).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
  });

  it("uma falha do navegador não afirma contador inalterado nem permite repetição sem conferência", async () => {
    const atualizar = vi.fn().mockRejectedValue(new Error("erro sintético da conexão"));
    render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={vi.fn()} atualizar={atualizar} />);
    await preencher(); await userEvent.click(screen.getByRole("button", { name: "Salvar numeração" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Resultado da atualização não confirmado"));
    expect(screen.getByRole("button", { name: "Salvar numeração" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(/Nenhum contador foi alterado/)).toBeNull(); expect(atualizar).toHaveBeenCalledOnce();
  });

  it("erros conhecidos preservam o rascunho e a mesma identidade da operação", async () => {
    const atualizar = vi.fn().mockResolvedValue({ erro: "Configuração alterada. Reabra a tela antes de salvar." });
    render(<NumeracaoFiscal inicial={leitura()} podeConsultar consultar={vi.fn()} atualizar={atualizar} />);
    await preencher(); await userEvent.click(screen.getByRole("button", { name: "Salvar numeração" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Configuração alterada");
    expect((screen.getByRole("textbox", { name: /^Série$/ }) as HTMLInputElement).value).toBe("6");
    await userEvent.click(screen.getByRole("button", { name: "Salvar numeração" }));
    expect(atualizar).toHaveBeenCalledTimes(2); expect(atualizar.mock.calls[0][0].operacaoId).toBe(atualizar.mock.calls[1][0].operacaoId);
  });

  it("histórico não renderiza motivos externos, erros livres, segredos ou links", () => {
    const dados = leitura(); dados.atualizacao = { situacao: "RECUSADA", operacaoId: "id-sintetico", solicitadoEm: instante, confirmadoEm: null, modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, falha: null, motivo: "TOKEN-SINTETICO <a href='https://example.invalid'>instrução</a>" }; dados.historicoAtualizacoes = [dados.atualizacao];
    const { container } = render(<NumeracaoFiscal inicial={dados} podeConsultar consultar={vi.fn()} atualizar={vi.fn()} />);
    expect(container.innerHTML).not.toContain("TOKEN-SINTETICO"); expect(container.innerHTML).not.toContain("example.invalid");
    expect(screen.getByText("Histórico das configurações de numeração")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Emitir|Reservar|Reiniciar|Cancelar nota/ })).toBeNull();
  });

  it("identifica confirmação anterior como registro datado, sem apresentá-la como prova atual", () => {
    const dados = leitura();
    dados.atualizacao = { contexto: "ANTERIOR", situacao: "CONFIRMADA", operacaoId: "historico-sintetico", solicitadoEm: "2026-10-14T12:00:00.000Z", confirmadoEm: "2026-10-14T12:00:01.000Z", modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, falha: null, motivo: null };
    dados.historicoAtualizacoes = [dados.atualizacao];
    render(<NumeracaoFiscal inicial={dados} podeConsultar consultar={vi.fn()} atualizar={vi.fn()} />);
    const anterior = screen.getByRole("region", { name: "Registro histórico da atualização de numeração" });
    expect(anterior.textContent).toContain("Configuração anterior — registro histórico");
    expect(anterior.textContent).toContain("Estado registrado: Configuração confirmada");
    expect(anterior.textContent).toContain("14/10/2026");
    expect(anterior.textContent).toContain("Não comprova o contador atual");
    expect(screen.queryByRole("region", { name: "Resultado da atualização de numeração" })).toBeNull();
    expect(screen.queryByText(/O fornecedor confirmou os parâmetros por uma nova leitura/)).toBeNull();
    expect(screen.getAllByText("Configuração anterior — registro histórico")).toHaveLength(2);
  });
});
