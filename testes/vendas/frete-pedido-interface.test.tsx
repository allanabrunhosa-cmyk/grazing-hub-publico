// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
import type { ResultadoEntrega } from "@/lib/vendas/entregas";
import { memoriaPendente } from "@/lib/vendas/entregas-dominio";
const mocks = vi.hoisted(() => ({ calcular: vi.fn(), alterar: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/entregas-actions", () => ({ calcularFretePedidoAction: mocks.calcular }));
vi.mock("next/link", () => ({ default: ({ children, href }: React.ComponentProps<"a">) => <a href={href}>{children}</a> }));
vi.mock("@/components/entregas/atribuicao-mapas", () => ({ AtribuicaoMapas: () => <span>Atribuição de mapas simulada</span> }));
import { FretePedido } from "@/app/(protegido)/vendas/pedidos/frete-pedido";

type Props = React.ComponentProps<typeof FretePedido>;
const config: NonNullable<Props["veiculos"]> = { veiculo: "CARRO", veiculoPadraoId: "moto", veiculos: [
  { id: "carro", nome: "Carro fictício", perfil: "CARRO", ativo: true },
  { id: "moto", nome: "Moto fictícia", perfil: "MOTO", ativo: true },
], regrasVeiculo: [{ id: "regra", tipoEmbalagemId: "caixa", veiculoId: "carro", prioridade: 10, ativo: true }] };
const configSlots: NonNullable<Props["veiculos"]> = { modelo: "SLOTS", veiculo: null, veiculos: [
  { id: "moto", nome: "Moto fictícia", perfil: "MOTO", ativo: true, slotsMinimos: 0, slotsMaximos: 3 },
  { id: "carro", nome: "Carro fictício", perfil: "CARRO", ativo: true, slotsMinimos: 4, slotsMaximos: 20 },
] };
const pedido = (): PedidoEntrada => ({ clienteId: "cliente-ficticio", canalId: "site-ficticio", atendimento: "ENTREGA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null,
  destinatario: { nome: "Destinatário fictício", contato: "11999990000" }, endereco: { cep: "00000000", logradouro: "Rua Fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" },
  observacoes: "", desconto: "0.00", frete: "0.00", outrosCustos: "0.00", itens: [{ produtoId: "produto-ficticio", quantidade: "1", escolhas: {}, precoManual: null }] });
const resposta = (frete: string | null = "22.00"): ResultadoEntrega => ({ memoria: { ...memoriaPendente(frete == null ? "FORA_AREA" : "PERMITIDO", "100.00"), frete }, rota: null, recibo: "recibo-ficticio",
  calculadoEm: new Date().toISOString(), validoAte: new Date(Date.now() + 600000).toISOString(), versao: 2, origemInformada: "Origem fictícia", veiculo: "CARRO" });
const props = (dados = pedido(), extra: Partial<Props> = {}): Props => ({ dados, alterar: mocks.alterar, manual: true, aprovarCobertura: true, configuracaoExistente: true, configuracaoAtiva: true, veiculos: config, embalagens: ["caixa"], mostrarConfiguracao: false, ...extra });
function Formulario({ inicial = pedido(), ...extra }: Partial<Props> & { inicial?: PedidoEntrada }) {
  const [dados, setDados] = useState(inicial);
  return <><FretePedido {...props(dados, extra)} alterar={valor => { mocks.alterar(valor); setDados(valor); }} /><output data-testid="pedido">{JSON.stringify(dados)}</output></>;
}
const valorSalvo = () => JSON.parse(screen.getByTestId("pedido").textContent!) as PedidoEntrada;
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
beforeEach(() => { mocks.calcular.mockImplementation(async () => ({ resultado: resposta() })); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("Linha compacta de veículo e frete", () => {
  it("libera escolha no modelo slots sem ocupação e recalcula com o veículo escolhido", async () => {
    const usuario = userEvent.setup(); render(<Formulario veiculos={configSlots} slotsOcupados={null} inicial={{ ...pedido(), entrega: { metodo: "AUTOMATICO", recibo: "antigo", motivo: "", excecaoCobertura: false, motivoCobertura: "" } }} />);
    const seletor = screen.getByRole("combobox", { name: "Tipo de veículo" }); expect((seletor as HTMLButtonElement).disabled).toBe(false); expect(screen.getByText("Slots não informados. Escolha um veículo para este pedido.")).toBeTruthy();
    seletor.focus(); await usuario.keyboard("{ArrowDown}"); await usuario.click(await screen.findByRole("option", { name: "Carro fictício" }));
    expect(valorSalvo()).toMatchObject({ veiculoEntregaId: "carro", entrega: null }); expect(screen.getByText("Slots não informados. Veículo escolhido para este pedido.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" })); await waitFor(() => expect(valorSalvo().entrega?.recibo).toBe("recibo-ficticio")); expect(mocks.calcular).toHaveBeenLastCalledWith(expect.objectContaining({ veiculoEntregaId: "carro" }));
  });
  it("distingue escolha explícita do próprio indicado e permite voltar ao automático", async () => {
    const usuario = userEvent.setup(); render(<Formulario veiculos={configSlots} slotsOcupados={1} />); const abrir = async () => { screen.getByRole("combobox", { name: "Tipo de veículo" }).focus(); await usuario.keyboard("{ArrowDown}"); };
    await abrir(); await usuario.click(await screen.findByRole("option", { name: "Moto fictícia" })); expect(valorSalvo().veiculoEntregaId).toBe("moto"); expect(screen.getByText("Alterado manualmente")).toBeTruthy();
    await abrir(); await usuario.click(await screen.findByRole("option", { name: "Moto fictícia · indicado" })); expect(valorSalvo().veiculoEntregaId).toBeNull();
  });
  it("preserva snapshot ao abrir e recalcula ao trocar veículo de uma revisão", async () => {
    const usuario = userEvent.setup(); render(<Formulario veiculos={configSlots} slotsOcupados={null} calculoAutomatico snapshot={{ metodo: "AUTOMATICO", freteCobrado: "22.00", selecaoVeiculo: { modelo: "SLOTS", id: "moto", nome: "Moto histórica", perfil: "MOTO", regraId: null, escolha: "SLOTS", slotsOcupados: 2, embalagens: [] } }} />);
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Moto histórica · registrado"); expect(mocks.calcular).not.toHaveBeenCalled();
    screen.getByRole("combobox", { name: "Tipo de veículo" }).focus(); await usuario.keyboard("{ArrowDown}"); await usuario.click(await screen.findByRole("option", { name: "Carro fictício" }));
    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledOnce()); expect(mocks.calcular.mock.calls[0][0].veiculoEntregaId).toBe("carro");
  });
  it("preseleciona o veículo indicado, mantém automático nulo e não mostra zero como cálculo pendente", () => {
    render(<Formulario />);
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Carro fictício · indicado");
    expect(valorSalvo().veiculoEntregaId).toBeUndefined();
    expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Frete pendente de cálculo.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Frete da entrega" })).toBeNull();
    expect(mocks.calcular).not.toHaveBeenCalled();
  });
  it("mostra mudança de veículo e restaura escolha automática ao selecionar o indicado", async () => {
    const usuario = userEvent.setup(); render(<Formulario />);
    screen.getByRole("combobox", { name: "Tipo de veículo" }).focus(); await usuario.keyboard("{ArrowDown}");
    await usuario.click(await screen.findByRole("option", { name: "Moto fictícia" }));
    expect(valorSalvo().veiculoEntregaId).toBe("moto");
    expect(screen.getByText("Alterado manualmente")).toBeTruthy(); expect(screen.getByText("Indicado: Carro fictício.")).toBeTruthy();
    const seletor = screen.getByRole("combobox", { name: "Tipo de veículo" }); seletor.focus(); await usuario.keyboard("{ArrowDown}");
    await usuario.click(await screen.findByRole("option", { name: "Carro fictício · indicado" }));
    expect(valorSalvo().veiculoEntregaId).toBeNull(); expect(screen.queryByText("Alterado manualmente")).toBeNull();
  });
  it("preserva opção histórica indisponível e não a substitui silenciosamente", () => {
    render(<Formulario inicial={{ ...pedido(), veiculoEntregaId: "inativo" }} />);
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Veículo salvo indisponível");
    expect(valorSalvo().veiculoEntregaId).toBe("inativo"); expect(screen.getByText("Alterado manualmente")).toBeTruthy();
  });
  it("exibe veículo automático histórico quando regras mudaram, sem criar override ao abrir", async () => {
    const usuario = userEvent.setup();
    render(<Formulario inicial={{ ...pedido(), frete: "22.00" }} snapshot={{ metodo: "AUTOMATICO", freteCobrado: "22.00", selecaoVeiculo: { id: "moto", nome: "Moto histórica", perfil: "MOTO", regraId: "regra-antiga", escolha: "REGRA", embalagens: ["caixa"] } }} />);
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Moto histórica · registrado");
    expect(mocks.alterar).not.toHaveBeenCalled(); expect(screen.queryByText("Alterado manualmente")).toBeNull();
    screen.getByRole("combobox", { name: "Tipo de veículo" }).focus(); await usuario.keyboard("{ArrowDown}");
    await usuario.click(await screen.findByRole("option", { name: "Carro fictício · indicado" }));
    expect(valorSalvo().veiculoEntregaId).toBeNull(); expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Carro fictício · indicado");
  });
  it("após recálculo explícito mostra veículo do recibo vigente acima do histórico, sem gravar override", async () => {
    mocks.calcular.mockResolvedValueOnce({ resultado: { ...resposta(), veiculo: "MOTO", selecaoVeiculo: { id: "moto", nome: "Moto indicada pelo cálculo", perfil: "MOTO", regraId: "regra-nova", escolha: "REGRA", embalagens: ["caixa"] } } });
    render(<Formulario inicial={{ ...pedido(), frete: "22.00" }} snapshot={{ metodo: "AUTOMATICO", freteCobrado: "22.00", selecaoVeiculo: { id: "carro", nome: "Carro histórico", perfil: "CARRO", regraId: "regra-antiga", escolha: "REGRA", embalagens: ["caixa"] } }} />);
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Carro histórico · registrado");
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    await waitFor(() => expect(valorSalvo().entrega?.recibo).toBe("recibo-ficticio"));
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Moto indicada pelo cálculo · indicado");
    expect(valorSalvo().veiculoEntregaId).toBeUndefined(); expect(screen.queryByText("Alterado manualmente")).toBeNull();
  });
  it("indica frete manual, conserva recibo e volta ao automático quando o valor coincide em centavos", async () => {
    render(<Formulario />); fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    await waitFor(() => expect(valorSalvo().frete).toBe("22.00"));
    fireEvent.change(screen.getByRole("textbox", { name: "Frete" }), { target: { value: "1900" } });
    expect(valorSalvo().entrega).toMatchObject({ metodo: "MANUAL", recibo: "recibo-ficticio" });
    expect(screen.getByText("Alterado manualmente")).toBeTruthy(); expect(screen.getByText(/Indicado: R\$/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Frete" }), { target: { value: "2200" } });
    expect(valorSalvo().entrega).toMatchObject({ metodo: "AUTOMATICO", recibo: "recibo-ficticio" });
    expect(screen.queryByText("Alterado manualmente")).toBeNull();
  });
  it("compara valores normalizados em centavos também no registro histórico", () => {
    render(<Formulario inicial={{ ...pedido(), frete: "0.3", entrega: { metodo: "MANUAL", recibo: "", motivo: "Ajuste registrado", excecaoCobertura: false, motivoCobertura: "" } }} snapshot={{ metodo: "MANUAL", memoria: { frete: "0.30" } }} />);
    expect(screen.queryByText("Alterado manualmente")).toBeNull();
  });
  it("restaura método automático ao informar o preço histórico indicado e pede recibo atualizado", () => {
    render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: { metodo: "MANUAL", recibo: "", motivo: "Ajuste registrado", excecaoCobertura: false, motivoCobertura: "" } }} snapshot={{ metodo: "MANUAL", memoria: { frete: "22.00" } }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Frete" }), { target: { value: "2200" } });
    expect(valorSalvo().entrega?.metodo).toBe("AUTOMATICO"); expect(screen.queryByText("Alterado manualmente")).toBeNull(); expect(screen.getByText("Frete pendente de cálculo.")).toBeTruthy();
  });
  it("mantém retirada em zero e nunca consulta mapas, com os dois campos presentes", async () => {
    vi.useFakeTimers(); render(<Formulario inicial={{ ...pedido(), atendimento: "RETIRADA", frete: "0.00" }} calculoAutomatico />); await tick(1200);
    const frete = screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement;
    expect(frete.value).toBe("0,00"); expect(frete.readOnly).toBe(true);
    expect((screen.getByRole("combobox", { name: "Tipo de veículo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Calcular frete por rota" })).toBeNull(); expect(mocks.calcular).not.toHaveBeenCalled();
  });
  it("preserva fluxo legado sem configuração e não cria instrução manual ao editar frete", () => {
    render(<Formulario configuracaoExistente={false} configuracaoAtiva={false} veiculos={undefined} manual={false} />);
    expect(screen.getByRole("combobox", { name: "Tipo de veículo" }).textContent).toContain("Pendente");
    fireEvent.change(screen.getByRole("textbox", { name: "Frete" }), { target: { value: "750" } });
    expect(valorSalvo()).toMatchObject({ frete: "7.50", entrega: null }); expect(screen.getByText("Alterado manualmente")).toBeTruthy();
  });
  it("respeita a permissão de ajuste manual", () => {
    render(<Formulario manual={false} />);
    expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).readOnly).toBe(true);
  });
});

describe("Cálculo com assinatura, debounce e proteção contra respostas antigas", () => {
  it("calcula uma vez após 600 ms e não entra em ciclo ao atualizar frete e recibo", async () => {
    vi.useFakeTimers(); render(<Formulario calculoAutomatico />); await tick(599); expect(mocks.calcular).not.toHaveBeenCalled();
    await tick(1); expect(mocks.calcular).toHaveBeenCalledTimes(1); expect(valorSalvo()).toMatchObject({ frete: "22.00", entrega: { metodo: "AUTOMATICO", recibo: "recibo-ficticio" } });
    await tick(3000); expect(mocks.calcular).toHaveBeenCalledTimes(1);
  });
  it("contato opcional não impede o cálculo de um destinatário identificado", async () => {
    vi.useFakeTimers(); render(<Formulario inicial={{ ...pedido(), destinatario: { nome: "Destinatário fictício", contato: "" } }} calculoAutomatico />); await tick(600); expect(mocks.calcular).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["endereço sem número", { endereco: { ...pedido().endereco!, numero: "" } }, {}], ["produtos ausentes", { itens: [] }, {}],
    ["configuração inativa", {}, { configuracaoAtiva: false }], ["configuração ausente", {}, { configuracaoExistente: false }],
    ["snapshot confirmado", {}, { snapshot: { metodo: "AUTOMATICO", freteCobrado: "22.00" } }],
  ] as [string, Partial<PedidoEntrada>, Partial<Props>][])("não calcula automaticamente com %s", async (_nome, dados, extra) => {
    vi.useFakeTimers(); render(<Formulario inicial={{ ...pedido(), ...dados }} calculoAutomatico {...extra} />); await tick(1200);
    expect(mocks.calcular).not.toHaveBeenCalled();
  });
  it("calcula automaticamente só com produtos e endereço, sem cadastro, canal, destinatário, agenda ou pagamento", async () => {
    vi.useFakeTimers(); render(<Formulario inicial={{ ...pedido(), clienteId: null, canalId: null, destinatario: null, prazo: null, cobranca: null }} calculoAutomatico />);
    await tick(600); expect(mocks.calcular).toHaveBeenCalledTimes(1);
    expect(valorSalvo().frete).toBe("22.00");
  });
  it("permite o recálculo manual sem cliente salvo e sem complemento", async () => {
    render(<Formulario inicial={{ ...pedido(), clienteId: null, canalId: null, destinatario: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    await waitFor(() => expect(valorSalvo().frete).toBe("22.00"));
  });
  it("não recalcula ao editar apenas canal ou destinatário", async () => {
    vi.useFakeTimers(); const inicial = pedido(); const { rerender } = render(<FretePedido {...props(inicial, { calculoAutomatico: true })} />);
    await tick(600); rerender(<FretePedido {...props({ ...inicial, canalId: "outro", destinatario: null }, { calculoAutomatico: true })} />);
    await tick(1200); expect(mocks.calcular).toHaveBeenCalledTimes(1);
  });
  it("reinicia debounce quando endereço muda e calcula somente os dados recentes", async () => {
    vi.useFakeTimers(); const inicial = pedido(), { rerender } = render(<FretePedido {...props(inicial, { calculoAutomatico: true })} />);
    await tick(300); const novo = { ...inicial, endereco: { ...inicial.endereco!, numero: "2" } };
    rerender(<FretePedido {...props(novo, { calculoAutomatico: true })} />); await tick(599); expect(mocks.calcular).not.toHaveBeenCalled();
    await tick(1); expect(mocks.calcular).toHaveBeenCalledTimes(1); expect(mocks.calcular.mock.calls[0][0].endereco.numero).toBe("2");
  });
  it.each(["endereco", "cliente", "produto", "veiculo"])("ignora resposta antiga após alteração de %s", async tipo => {
    let resolver!: (v: { resultado: ResultadoEntrega }) => void;
    mocks.calcular.mockReturnValue(new Promise(r => { resolver = r; }));
    const inicial = pedido(), { rerender } = render(<FretePedido {...props(inicial)} />);
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    const novo = { ...inicial, ...(tipo === "endereco" ? { endereco: { ...inicial.endereco!, numero: "2" } } : tipo === "cliente" ? { clienteId: "outro-cliente" } : tipo === "veiculo" ? { veiculoEntregaId: "moto" } : { itens: [{ ...inicial.itens[0], quantidade: "2" }] }) };
    rerender(<FretePedido {...props(novo)} />); await act(async () => resolver({ resultado: resposta() })); expect(mocks.alterar).not.toHaveBeenCalled();
  });
  it("não reverte custos, pagamento, observações ou ajuste manual feitos enquanto calcula", async () => {
    let resolver!: (v: { resultado: ResultadoEntrega }) => void; mocks.calcular.mockReturnValue(new Promise(r => { resolver = r; }));
    const inicial = pedido(), { rerender } = render(<FretePedido {...props(inicial)} />);
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    const editado: PedidoEntrada = { ...inicial, frete: "19.00", outrosCustos: "7.00", observacoes: "Observação recente", pagamentoInformado: { formaId: "pix", parcelas: 1, vencimentos: [] },
      entrega: { metodo: "MANUAL", recibo: "", motivo: "Acordo fictício recente", excecaoCobertura: false, motivoCobertura: "" } };
    rerender(<FretePedido {...props(editado)} />); await act(async () => resolver({ resultado: resposta() }));
    expect(mocks.alterar).toHaveBeenLastCalledWith(expect.objectContaining({ frete: "19.00", outrosCustos: "7.00", observacoes: "Observação recente", pagamentoInformado: editado.pagamentoInformado,
      entrega: expect.objectContaining({ metodo: "MANUAL", recibo: "recibo-ficticio", motivo: "Acordo fictício recente" }) }));
  });
  it("trava chamadas simultâneas e mantém preço/motivo manual ao recalcular", async () => {
    let resolver!: (v: { resultado: ResultadoEntrega }) => void; mocks.calcular.mockReturnValue(new Promise(r => { resolver = r; }));
    render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: { metodo: "MANUAL", recibo: "anterior", motivo: "Acordo fictício", excecaoCobertura: false, motivoCobertura: "" } }} />);
    const botao = screen.getByRole("button", { name: "Calcular frete por rota" }); fireEvent.click(botao); fireEvent.click(botao); expect(mocks.calcular).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ resultado: resposta() })); expect(valorSalvo()).toMatchObject({ frete: "19.00", entrega: { metodo: "MANUAL", recibo: "recibo-ficticio", motivo: "Acordo fictício" } });
  });
  it("preserva ajuste manual histórico ao recalcular sem instrução nova", async () => {
    render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: null }} snapshot={{ metodo: "MANUAL", motivo: "Acordo histórico fictício", memoria: { frete: "22.00" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    await waitFor(() => expect(valorSalvo().entrega?.recibo).toBe("recibo-ficticio"));
    expect(valorSalvo()).toMatchObject({ frete: "19.00", entrega: { metodo: "MANUAL", motivo: "Acordo histórico fictício" } });
  });
  it("não acusa motivo ausente quando o ajuste histórico já possui justificativa", () => {
    render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: null }} snapshot={{ metodo: "MANUAL", motivo: "Acordo histórico fictício", memoria: { frete: "22.00" } }} />);
    expect(screen.queryByText("Informe a justificativa em Detalhes do frete antes de confirmar.")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Frete" }), { target: { value: "1800" } }); expect(valorSalvo().entrega?.motivo).toBe("Acordo histórico fictício");
  });
  it("trocar veículo preserva preço/motivo histórico e invalida recibo e aprovação de cobertura", async () => {
    const usuario = userEvent.setup(); render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: null }} snapshot={{ metodo: "MANUAL", motivo: "Acordo histórico fictício", excepcional: true, motivoCobertura: "Aprovação antiga", memoria: { frete: "22.00" } }} />);
    screen.getByRole("combobox", { name: "Tipo de veículo" }).focus(); await usuario.keyboard("{ArrowDown}");
    await usuario.click(await screen.findByRole("option", { name: "Moto fictícia" }));
    expect(valorSalvo()).toMatchObject({ frete: "19.00", entrega: { metodo: "MANUAL", motivo: "Acordo histórico fictício", recibo: "", excecaoCobertura: false, motivoCobertura: "" } });
  });
  it("não transforma erro ou cobertura não permitida em frete zero válido", async () => {
    mocks.calcular.mockResolvedValueOnce({ erro: "Provedor fictício indisponível" }); render(<Formulario />);
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" })); await screen.findByRole("alert");
    expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).value).toBe(""); expect(valorSalvo().entrega).toBeUndefined();
    mocks.calcular.mockResolvedValueOnce({ resultado: resposta(null) }); fireEvent.click(screen.getByRole("button", { name: "Calcular frete por rota" }));
    await screen.findByText("Fora da distância máxima por rota"); expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).value).toBe("");
  });
  it("vence o cálculo sem consultar mapas em ciclo e exige recálculo explícito", async () => {
    vi.useFakeTimers(); render(<Formulario calculoAutomatico />); await tick(600); expect(valorSalvo().frete).toBe("22.00");
    await tick(600000); expect(screen.getByText("Cálculo vencido. Calcule novamente.")).toBeTruthy(); expect(mocks.calcular).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).value).toBe("");
  });
});

describe("Detalhes e justificativas permanecem em popup local", () => {
  it("altera motivo somente no rascunho do popup e aplica sem perder valor/recibo", async () => {
    render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: { metodo: "MANUAL", recibo: "recibo-atual", motivo: "Motivo anterior", excecaoCobertura: false, motivoCobertura: "" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Detalhes do frete" }));
    const dialogo = await screen.findByRole("dialog"), campo = within(dialogo).getByRole("textbox", { name: "Justificativa do frete manual" });
    fireEvent.change(campo, { target: { value: "Acordo fictício novo" } }); fireEvent.blur(campo); expect(mocks.alterar).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aplicar ajustes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(valorSalvo()).toMatchObject({ frete: "19.00", entrega: { metodo: "MANUAL", recibo: "recibo-atual", motivo: "Acordo fictício novo" } });
  });
  it("protege justificativa não aplicada no mesmo popup e preserva o pedido ao descartar", async () => {
    const usuario = userEvent.setup(); render(<Formulario inicial={{ ...pedido(), frete: "19.00", entrega: { metodo: "MANUAL", recibo: "recibo-atual", motivo: "Motivo anterior", excecaoCobertura: false, motivoCobertura: "" } }} />);
    await usuario.click(screen.getByRole("button", { name: "Detalhes do frete" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Justificativa do frete manual" }), { target: { value: "Edição não aplicada" } });
    await usuario.keyboard("{Escape}"); await screen.findByText("Sair sem salvar?"); expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect((screen.getByRole("textbox", { name: "Justificativa do frete manual" }) as HTMLInputElement).value).toBe("Edição não aplicada");
    await usuario.keyboard("{Escape}"); await usuario.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(valorSalvo().entrega?.motivo).toBe("Motivo anterior"); expect(mocks.alterar).not.toHaveBeenCalled();
  });
  it("preenche o frete automaticamente sem confirmação de localização na linha ou no popup", async () => {
    vi.useFakeTimers(); render(<Formulario calculoAutomatico />); await tick(600);
    expect(valorSalvo()).toMatchObject({ frete: "22.00", entrega: { metodo: "AUTOMATICO", recibo: "recibo-ficticio" } });
    expect(mocks.calcular).toHaveBeenCalledTimes(1);
    expect(mocks.calcular.mock.calls[0]).toEqual([expect.objectContaining({ endereco: pedido().endereco })]);
    expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
    vi.useRealTimers(); fireEvent.click(screen.getByRole("button", { name: "Detalhes do frete" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).queryByRole("button", { name: /Confirmar/ })).toBeNull();
  });
});

it("ao completar o número calcula e exibe somente o frete, sem abrir popup nem solicitar confirmação", async () => {
  vi.useFakeTimers();
  const incompleto = { ...pedido(), endereco: { ...pedido().endereco!, numero: "" } };
  const { rerender } = render(<FretePedido {...props(incompleto, { calculoAutomatico: true })} />);
  await tick(600); expect(mocks.calcular).not.toHaveBeenCalled();
  rerender(<FretePedido {...props(pedido(), { calculoAutomatico: true })} />);
  await tick(600);
  expect(mocks.alterar).toHaveBeenLastCalledWith(expect.objectContaining({ frete: "22.00" }));
  const preenchido = mocks.alterar.mock.calls.at(-1)![0];
  rerender(<FretePedido {...props(preenchido, { calculoAutomatico: true })} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).value).toContain("22,00");
  expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
  expect(mocks.calcular).toHaveBeenCalledTimes(1);
});

it("rota indisponível permanece pendente sem aplicar zero nem pedir confirmação de endereço", async () => {
  vi.useFakeTimers();
  mocks.calcular.mockResolvedValueOnce({ resultado: { ...resposta(null), memoria: memoriaPendente("SEM_ROTA", "100.00") } });
  render(<Formulario calculoAutomatico />); await tick(600);
  expect(screen.getByText("Nenhuma rota encontrada")).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Frete" }) as HTMLInputElement).value).toBe("");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
});
