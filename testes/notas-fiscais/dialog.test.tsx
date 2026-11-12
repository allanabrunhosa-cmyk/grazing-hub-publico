// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navegacao = vi.hoisted(() => ({ atualizar: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navegacao.atualizar }),
  unstable_isUnrecognizedActionError: () => false,
}));
vi.mock("@/app/(protegido)/notas-fiscais/actions", () => ({
  obterItensNotaFiscalAction: vi.fn(), confirmarConciliacaoNotaAction: vi.fn(), obterInsumoOptionAction: vi.fn(), manifestarAction: vi.fn(),
  obterResumoCancelamentoNotaAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/insumos/insumo-dialog", () => ({ InsumoDialog: () => null }));
vi.mock("@/components/cadastro-rapido-insumo-dialog", () => ({ CadastroRapidoInsumoDialog: () => null }));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-dialog", () => ({ FornecedorDialog: () => null }));
vi.mock("@/app/(protegido)/notas-fiscais/tratamento-local-actions", () => ({ tratarOutraOperacaoNotaAction: vi.fn() }));
vi.mock("@/app/(protegido)/notas-fiscais/aceitar-nota", () => ({ aceitarNotaAction: vi.fn() }));
vi.mock("@/lib/notas-fiscais/api-cliente", () => ({ importarXmlPelaApi: vi.fn() }));
vi.mock("@/app/(protegido)/notas-fiscais/conciliar-fornecedor-actions", () => ({ prepararConciliacaoFornecedorAction: vi.fn(), conciliarFornecedorNotaAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { aceitarNotaAction } from "@/app/(protegido)/notas-fiscais/aceitar-nota";
import { importarXmlPelaApi } from "@/lib/notas-fiscais/api-cliente";
import { toast } from "sonner";
import { NotaFiscalDialog } from "@/app/(protegido)/notas-fiscais/nota-fiscal-dialog";
import { manifestarAction, obterItensNotaFiscalAction, confirmarConciliacaoNotaAction, obterResumoCancelamentoNotaAction } from "@/app/(protegido)/notas-fiscais/actions";
import { xmlCustos } from "./custos-dados";
import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";
import { calcularCustosNota } from "@/lib/notas-fiscais/custos";
import { notaTeste, opcoesTeste, detalhesTeste } from "./dados";
import { compraFicticia } from "../visual/cancelamento-compra-dados";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(obterItensNotaFiscalAction).mockResolvedValue(detalhesTeste as never);
  vi.mocked(obterResumoCancelamentoNotaAction).mockResolvedValue({ resumo: null });
  vi.mocked(manifestarAction).mockResolvedValue({ sucesso: true, mensagem: "135 — Registrado", protocolo: "123" });
  vi.mocked(aceitarNotaAction).mockResolvedValue({ ok: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

async function abrir(nota = notaTeste) {
  const usuario = userEvent.setup();
  render(<NotaFiscalDialog nota={nota} {...opcoesTeste} trigger={<button>Ver nota</button>} />);
  await usuario.click(screen.getByRole("button", { name: "Ver nota" }));
  await screen.findByRole("dialog");
  return usuario;
}

async function preencherDataEntrada() {
  fireEvent.change(await screen.findByLabelText("Data de entrada no estoque"), { target: { value: "2026-09-10" } });
}

describe("Ver nota", () => {
  function detalhesComDesconto() {
    return { ...detalhesTeste, custos: extrairCustosNFe(xmlCustos),
      itens: [detalhesTeste.itens[0], { ...detalhesTeste.itens[0], id: "segundo", numeroItem: 2, descricaoProduto: "Outro queijo", valorTotalItem: 300 }],
      duplicatas: [{ ...detalhesTeste.duplicatas[0], valor: 445 }],
    };
  }
  it("exige escolha explícita do desconto antes do aceite, mesmo com os outros campos completos", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue(detalhesComDesconto() as never);
    const usuario = await abrir({ ...notaTeste, valorTotal: 445 });
    for (const nome of ["Conforme a nota", "Proporcional", "Personalizado"]) expect((await screen.findByRole("button", { name: nome })).getAttribute("aria-pressed")).toBe("false");
    await preencherDataEntrada();
    await usuario.click(screen.getByRole("button", { name: "Aceitar nota" }));
    expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Escolha a distribuição do desconto.")).toBeTruthy();
    expect(aceitarNotaAction).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Conforme a nota" }));
    expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(false);
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    await waitFor(() => expect(aceitarNotaAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ distribuicaoDesconto: { modo: "NOTA", itens: [{ numeroItem: 1, desconto: 5 }, { numeroItem: 2, desconto: 15 }] } })));
  });
  it("descarta escolha não salva ao reabrir a nota pendente", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue(detalhesComDesconto() as never);
    const usuario = await abrir({ ...notaTeste, valorTotal: 445 });
    await usuario.click(await screen.findByRole("button", { name: "Proporcional" }));
    expect(screen.getByRole("button", { name: "Proporcional" }).getAttribute("aria-pressed")).toBe("true");
    await usuario.click(screen.getByRole("button", { name: "Fechar nota" }));
    await usuario.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await usuario.click(screen.getByRole("button", { name: "Ver nota" }));
    for (const nome of ["Conforme a nota", "Proporcional", "Personalizado"]) expect((await screen.findByRole("button", { name: nome })).getAttribute("aria-pressed")).toBe("false");
    expect(aceitarNotaAction).not.toHaveBeenCalled();
  });
  it("mantém a escolha já persistida em itens conciliados sem permitir redistribuição", async () => {
    const detalhes = detalhesComDesconto();
    const calculo = calcularCustosNota(detalhes.custos, { modo: "PERSONALIZADO", itens: [{ numeroItem: 1, desconto: 20 }, { numeroItem: 2, desconto: 0 }] });
    if ("erro" in calculo) throw new Error(calculo.erro);
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhes, itens: detalhes.itens.map((item, indice) => ({ ...item, status: "CONCILIADO", composicaoCusto: calculo.itens[indice] })) } as never);
    await abrir({ ...notaTeste, valorTotal: 445, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
    const personalizado = await screen.findByRole("button", { name: "Personalizado" });
    expect(personalizado.getAttribute("aria-pressed")).toBe("true");
    for (const nome of ["Conforme a nota", "Proporcional", "Personalizado"]) expect((screen.getByRole("button", { name: nome }) as HTMLButtonElement).disabled).toBe(true);
    expect(aceitarNotaAction).not.toHaveBeenCalled();
  });
  it("preserva a proteção de outros campos quando o modo de desconto não muda", async () => {
    const usuario = await abrir();
    await preencherDataEntrada();
    await usuario.click(screen.getByRole("button", { name: "Fechar nota" }));
    expect(await screen.findByRole("button", { name: "Sair sem salvar" })).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect((screen.getByLabelText("Data de entrada no estoque") as HTMLInputElement).value).toBe("2026-09-10");
    expect(aceitarNotaAction).not.toHaveBeenCalled();
  });
  it("pede escolha em legado parcialmente conciliado sem inventar uma decisão anterior", async () => {
    const detalhes = detalhesComDesconto();
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhes, itens: [{ ...detalhes.itens[0], status: "CONCILIADO" }, detalhes.itens[1]] } as never);
    const usuario = await abrir({ ...notaTeste, valorTotal: 445, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
    const conforme = await screen.findByRole("button", { name: "Conforme a nota" });
    expect(conforme.getAttribute("aria-pressed")).toBe("false");
    expect((conforme as HTMLButtonElement).disabled).toBe(false);
    await usuario.click(conforme);
    expect(conforme.getAttribute("aria-pressed")).toBe("true");
    expect(aceitarNotaAction).not.toHaveBeenCalled();
  });
  it("envia custo líquido e distribuição junto do aceite, mantendo o fator de conversão", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhesTeste, custos: extrairCustosNFe(xmlCustos),
      itens: [{ ...detalhesTeste.itens[0], fatorConversao: 2 }, { ...detalhesTeste.itens[0], id: "segundo", numeroItem: 2, descricaoProduto: "Outro queijo", valorTotalItem: 300 }],
      duplicatas: [{ ...detalhesTeste.duplicatas[0], valor: 445 }],
    } as never);
    const usuario = await abrir({ ...notaTeste, valorTotal: 445 });
    await usuario.click(await screen.findByRole("button", { name: "Personalizado" }, { timeout: 5000 }));
    const primeiro = screen.getByRole("textbox", { name: "Desconto de Queijo de teste em reais" });
    await usuario.clear(primeiro); await usuario.type(primeiro, "2000");
    await preencherDataEntrada();
    await usuario.click(screen.getByRole("button", { name: "Aceitar nota" }));
    expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(true);
    const segundo = screen.getByRole("textbox", { name: "Desconto de Outro queijo em reais" });
    await usuario.clear(segundo); await usuario.type(segundo, "0");
    await usuario.click(screen.getByRole("button", { name: /Confirmar aceite/ }));
    await waitFor(() => expect(aceitarNotaAction).toHaveBeenCalled());
    expect(vi.mocked(aceitarNotaAction).mock.calls[0][0]).toMatchObject({ distribuicaoDesconto: { modo: "PERSONALIZADO", itens: [{numeroItem: 1, desconto: 20}, {numeroItem: 2, desconto: 0}] },
      itens: [{ valorTotal: 98, fatorConversao: 2, quantidade: 4 }, { valorTotal: 347 }] });
  });
  it("envia a data de entrada escolhida sem alterar vencimento", async () => {
    const usuario = await abrir();
    const data = await screen.findByLabelText("Data de entrada no estoque");
    expect((data as HTMLInputElement).value).toBe("");
    fireEvent.change(data, { target: { value: "2024-02-29" } });
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(aceitarNotaAction).toHaveBeenCalledWith(expect.objectContaining({ dataEntradaEstoque: "2024-02-29", duplicatas: [expect.objectContaining({ dataVencimento: "2026-10-10" })] }));
  });
  it("mostra a data efetiva de itens já conciliados", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhesTeste, itens: [{ ...detalhesTeste.itens[0], status: "CONCILIADO", dataEntradaEstoque: "2024-02-29" }] } as never);
    await abrir();
    expect(await screen.findByText("Entrada no estoque: 29/02/2024")).toBeTruthy();
    expect(screen.queryByLabelText("Data de entrada no estoque")).toBeNull();
  });
  it("destaca a data vazia e normaliza o campo assim que ela é preenchida", async () => {
    const usuario = await abrir();
    const data = await screen.findByLabelText("Data de entrada no estoque") as HTMLInputElement;
    expect(data.value).toBe("");
    expect(data.getAttribute("aria-invalid")).toBe("false");
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    expect(data.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(data, { target: { value: "2026-09-10" } });
    expect(data.getAttribute("aria-invalid")).toBe("false");
    expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(false);
    expect(aceitarNotaAction).not.toHaveBeenCalled();
  });
  it("mostra o peso do XML e usa a quantidade em kg ao conciliar com insumo em kg", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({
      ...detalhesTeste,
      itens: [{ ...detalhesTeste.itens[0], unidadeComercial: "CX", quantidadeComercial: 3, unidadeTributavel: "KG", quantidadeTributavel: 56.41, fatorConversao: 56.41 / 3 }],
    } as never);
    await abrir();
    expect(await screen.findByText("Peso informado no XML: 56,41 kg")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Quantidade de Queijo de teste em kg" }) as HTMLInputElement).value).toBe("56.41");
  });
  it("mostra o valor unitário da nota e recalcula o valor pela quantidade de estoque", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhesTeste, itens: [{ ...detalhesTeste.itens[0], valorUnitarioComercial: 49.9876 }] } as never);
    const usuario = await abrir();
    expect(await screen.findByText(/Valor unitário na nota:.*49,9876.*por KG/)).toBeTruthy();
    expect(screen.getByText(/^Nova compra:/).textContent).toMatch(/50,00.*por kg/);
    expect(screen.queryByRole("button", { name: "Média" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo" })).toBeNull();
    const total = screen.getByRole("textbox", { name: "Valor total de Queijo de teste em reais" });
    await usuario.clear(total);
    await usuario.type(total, "12000");
    expect(screen.getByText(/^Nova compra:/).textContent).toMatch(/60,00.*por kg/);
  });
  it("mostra somente aceite e recusa como decisões e mantém conciliação", async () => {
    await abrir();
    expect(screen.getByRole("button", { name: /Aceitar nota/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Recusar nota/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Ciência da Operação|Desconhecimento da Operação|Operação não Realizada/ })).toBeNull();
    expect(await screen.findByText("Queijo de teste", { selector: "p" })).toBeDefined();
    expect(manifestarAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar conciliação" })).toBeNull();
    const produto = screen.getByText("Queijo de teste", { selector: "p" });
    expect(produto.compareDocumentPosition(screen.getByRole("button", { name: /Aceitar nota/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("só envia confirmação após o segundo clique explícito", async () => {
    const usuario = await abrir();
    await preencherDataEntrada();
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    expect(manifestarAction).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(aceitarNotaAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ notaFiscalId: notaTeste.id, itens: [expect.objectContaining({ acao: "CONCILIAR", insumoId: "insumo-teste" })], duplicatas: [expect.objectContaining({ valor: 100 })] }));
    expect(manifestarAction).not.toHaveBeenCalled();
    expect(confirmarConciliacaoNotaAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("exige motivo e envia desconhecimento sem justificativa", async () => {
    const usuario = await abrir();
    await usuario.click(screen.getByRole("button", { name: /Recusar nota/ }));
    expect((screen.getByRole("button", { name: "Confirmar recusa" }) as HTMLButtonElement).disabled).toBe(true);
    await usuario.click(screen.getByRole("radio", { name: "Não reconheço esta compra" }));
    await usuario.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    expect(manifestarAction).toHaveBeenCalledExactlyOnceWith(notaTeste.chaveAcesso, "DESCONHECIMENTO_DA_OPERACAO", undefined);
  });
  it("exige justificativa de 15 caracteres para compra não realizada", async () => {
    const usuario = await abrir();
    await usuario.click(screen.getByRole("button", { name: /Recusar nota/ }));
    await usuario.click(screen.getByRole("radio", { name: "Reconheço a compra, mas ela não foi realizada" }));
    const campo = screen.getByRole("textbox", { name: /Justificativa/ });
    await usuario.type(campo, "Curta");
    expect((screen.getByRole("button", { name: "Confirmar recusa" }) as HTMLButtonElement).disabled).toBe(true);
    await usuario.clear(campo);
    await usuario.type(campo, "Mercadoria não foi entregue.");
    await usuario.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    expect(manifestarAction).toHaveBeenCalledExactlyOnceWith(notaTeste.chaveAcesso, "OPERACAO_NAO_REALIZADA", "Mercadoria não foi entregue.");
  });
  it("mantém o painel aberto e exibe erro da SEFAZ", async () => {
    vi.mocked(aceitarNotaAction).mockResolvedValue({ erro: "Object reference not set to an instance of an object" });
    const usuario = await abrir();
    await preencherDataEntrada();
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(toast.error).toHaveBeenCalledWith("Object reference not set to an instance of an object");
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("informa falha de transporte e libera o botão sem fechar", async () => {
    vi.mocked(aceitarNotaAction).mockRejectedValue(new Error("Sem rede"));
    const usuario = await abrir();
    await preencherDataEntrada();
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Confira o status da nota"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(false));
  });
  it("bloqueia o aceite quando falta conciliar um item", async () => {
    vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhesTeste, itens: detalhesTeste.itens.map((item) => ({ ...item, insumoId: null })) } as never);
    const usuario = await abrir();
    const insumo = await screen.findByPlaceholderText("Buscar insumo...");
    expect(insumo.getAttribute("aria-invalid")).toBe("false");
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    expect(insumo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert").some((alerta) => alerta.textContent?.includes("preencha todos os itens"))).toBe(true);
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(aceitarNotaAction).not.toHaveBeenCalled();
  });
  it("nota sem XML não envia ciência automaticamente nem busca itens", async () => {
    await abrir({ ...notaTeste, temXmlCompleto: false, tipo: "RES_NFE" });
    expect(screen.getByText("Aguardando XML completo")).toBeDefined();
    expect(obterItensNotaFiscalAction).not.toHaveBeenCalled();
    expect(manifestarAction).not.toHaveBeenCalled();
  });
  it("importa o XML selecionado sem aceitar a nota", async () => {
    vi.mocked(importarXmlPelaApi).mockResolvedValue({ ok: true });
    const usuario = await abrir({ ...notaTeste, temXmlCompleto: false, tipo: "RES_NFE" });
    await usuario.upload(screen.getByLabelText(/Importar XML do fornecedor/), new File(["<nfeProc/>"], "nota.xml", { type: "text/xml" }));
    await waitFor(() => expect(importarXmlPelaApi).toHaveBeenCalledWith(expect.any(FormData), notaTeste.id));
    expect(navegacao.atualizar).toHaveBeenCalledTimes(1);
    expect(aceitarNotaAction).not.toHaveBeenCalled();
    expect(manifestarAction).not.toHaveBeenCalled();
  });
  it("identifica valores em reais e preserva os centavos no aceite", async () => {
    const usuario = await abrir();
    const campo = await screen.findByRole("textbox", { name: "Valor total de Queijo de teste em reais" });
    await preencherDataEntrada();
    expect(campo.parentElement?.textContent).toContain("R$");
    await usuario.clear(campo);
    await usuario.type(campo, "685,88");
    await usuario.click(screen.getByRole("button", { name: /Aceitar nota/ }));
    await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    expect(aceitarNotaAction).toHaveBeenCalledWith(expect.objectContaining({ itens: [expect.objectContaining({ valorTotal: 685.88 })] }));
  });

});

it("recusa de nota aceita exige conferir a reversão de todos os itens", async () => {
 vi.mocked(obterResumoCancelamentoNotaAction).mockResolvedValue({ resumo: compraFicticia });
 const usuario = await abrir({ ...notaTeste, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
 await usuario.click(screen.getByRole("button", { name: /Recusar nota/ }));
 await screen.findByText("Detergente de teste");
 await usuario.click(screen.getByRole("radio", { name: "Não reconheço esta compra" }));
 const confirmar = screen.getByRole("button", { name: "Confirmar recusa" }); expect((confirmar as HTMLButtonElement).disabled).toBe(true);
 await usuario.type(screen.getByLabelText(/Motivo da reversão local/), "Correção fictícia de compra duplicada");
 await usuario.click(confirmar);
 expect(manifestarAction).toHaveBeenCalledWith(notaTeste.chaveAcesso, "DESCONHECIMENTO_DA_OPERACAO", undefined, { token: compraFicticia.token, motivo: "Correção fictícia de compra duplicada" });
});

it("exige recebimento no uso e consumo e envia a data sem alterar o vencimento", async () => {
  vi.mocked(obterItensNotaFiscalAction).mockResolvedValue({ ...detalhesTeste, itens: [{ ...detalhesTeste.itens[0], destino: "USO_E_CONSUMO", categoriaFinanceiraId: "consumo" }] } as never);
  const usuario = await abrir();
  const campo = await screen.findByLabelText("Data de recebimento dos produtos");
  expect(screen.queryByLabelText("Local de estoque")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Aceitar nota" }));
  expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(campo, { target: { value: "2024-02-29" } });
  await usuario.click(screen.getByRole("button", { name: "Confirmar aceite" }));
  expect(aceitarNotaAction).toHaveBeenCalledWith(expect.objectContaining({ dataEntradaEstoque: "2024-02-29", itens: [expect.objectContaining({ destino: "USO_E_CONSUMO" })], duplicatas: [expect.objectContaining({ dataVencimento: "2026-10-10" })] }));
});
