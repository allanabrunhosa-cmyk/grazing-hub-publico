// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { dadosResumoPedido, moedaResumoPedido } from "@/lib/vendas/resumo-pedido";
import { htmlResumoComercialPedido } from "@/lib/vendas/resumo-pedido-a4";
import { dadosResumoSintetico, pedidoResumoSintetico } from "./resumo-pedido.fixture";

const documento = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("Resumo comercial A4", () => {
  it("preserva a marca oficial no cabeçalho e rodapé sem o slogan retirado", () => {
    const doc = documento(htmlResumoComercialPedido(dadosResumoSintetico));
    expect(doc.querySelector("header .logo")?.getAttribute("alt")).toBe("Grazing Table & Co");
    expect(doc.querySelector("footer p")?.textContent).toBe("Grazing Table & Co");
    expect(doc.querySelector(".slogan")).toBeNull();
    expect(doc.body.textContent).not.toMatch(/Boa comida|aproxima (as )?pessoas/i);
  });
  it("preserva snapshots PJ, cobrança, parcelas, quantidades e preços comerciais fornecidos pelo servidor", () => {
    const dados = dadosResumoPedido({ ...pedidoResumoSintetico, pagamentoInformadoSnapshot: { nome: "Boleto comercial", parcelas: 2, vencimentos: ["2026-10-15", "2026-11-15"] } });
    expect(dados.cliente.empresa).toBe("Empresa de exemplo Ltda.");
    expect(dados.itens[0]).toMatchObject({ precoUnitario: "200.00", total: "400.00" });
    const doc = documento(htmlResumoComercialPedido(dados));
    expect(doc.querySelector(".informacoes")?.textContent).toContain("CNPJ: 00.000.000/0000-00");
    expect(doc.querySelector(".cobranca")?.textContent).toContain("Avenida de exemplo, 200");
    expect(doc.querySelector(".informacoes")?.textContent).toContain("Boleto comercial · 2 parcelas");
    expect(doc.querySelector(".informacoes")?.textContent).toContain("15/10/2026 · 15/11/2026");
    expect(doc.querySelector(".total strong")?.textContent).toBe("R$ 575,00");
    expect(doc.querySelector(".totais")?.textContent).toContain("Desconto− R$ 20,00");
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(doc.querySelector(".observacoes")?.textContent).toContain("Montagem para o encontro.\nEntregar na recepção.");
  });
  it("distingue orçamento sem pagamento e não inventa validade, quitação, endereço ou contatos da marca", () => {
    const dados = dadosResumoPedido({ ...pedidoResumoSintetico, status: "RASCUNHO", compradorSnapshot: { nome: "Cliente de exemplo", tipo: "PF" }, atendimento: "RETIRADA", pagamentoInformadoSnapshot: null, enderecoSnapshot: null, cobrancaSnapshot: null, previsaoData: null, previsaoJanela: null });
    const doc = documento(htmlResumoComercialPedido(dados));
    expect(doc.querySelector(".situacao")?.textContent).toBe("Orçamento para aprovação");
    expect(doc.querySelector(".informacoes")?.textContent).toContain("RetiradaData a combinarHorário a combinar");
    expect(doc.querySelector(".informacoes")?.textContent).toContain("PagamentoNão informado");
    expect(doc.querySelector(".nota-orcamento")?.textContent).toContain("conferência e aprovação");
    expect(doc.body.textContent).not.toMatch(/Validade:|pago|www\.|@grazing|CNPJ:/i);
    expect(doc.querySelector(".cobranca")).toBeNull();
  });
  it("escapa todos os dados e não permite conteúdo executável no preview", () => {
    const perigoso = '<img src=x onerror="alert(1)"><script>alert(2)</script>&';
    const dados = { ...dadosResumoSintetico, observacoes: perigoso, cliente: { ...dadosResumoSintetico.cliente, nome: perigoso, empresa: perigoso }, itens: [{ ...dadosResumoSintetico.itens[0], nome: perigoso, escolhas: [perigoso], observacoes: perigoso }] };
    const doc = documento(htmlResumoComercialPedido(dados));
    expect(doc.querySelectorAll("script,[onerror],[onclick]")).toHaveLength(0);
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.querySelector(".produto")?.textContent).toBe(perigoso);
    expect(doc.querySelector(".observacoes")?.textContent).toContain(perigoso);
    expect(doc.querySelector(".logo")?.getAttribute("src")).toBe("/marca/grazing-table-co-monocromatica.png");
  });
  it("mantém precisão monetária e quantidade fracionária sem ponto flutuante", () => {
    expect(moedaResumoPedido("9007199254740993.19")).toBe("R$ 9.007.199.254.740.993,19");
    expect(moedaResumoPedido("0.1")).toBe("R$ 0,10");
    expect(moedaResumoPedido("NaN")).toBe("Não informado");
    const dados = dadosResumoPedido({ ...pedidoResumoSintetico, itens: [{ ...pedidoResumoSintetico.itens[0], quantidade: "0.000125" }] });
    expect(documento(htmlResumoComercialPedido(dados)).querySelector(".quantidade")?.textContent).toContain("0,000125");
  });
  it("usa A4 vertical, cabeçalhos repetidos e conteúdo sem limite artificial de itens", () => {
    const html = htmlResumoComercialPedido({ ...dadosResumoSintetico, itens: Array.from({ length: 100 }, (_, indice) => ({ ...dadosResumoSintetico.itens[0], nome: `Item ${indice + 1}` })) }, { impressao: true, origem: "https://pedidos.example.test" });
    const doc = documento(html);
    expect(html).toContain("size:A4 portrait");
    expect(html).toContain("thead{display:table-header-group}");
    expect(html).toContain("print-color-adjust:exact");
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(100);
    expect(doc.querySelectorAll("tbody tr")[99].textContent).toContain("Item 100");
    expect(doc.querySelector(".imprimir")?.textContent).toBe("Imprimir / salvar PDF");
    expect(doc.querySelector(".logo")?.getAttribute("src")).toBe("https://pedidos.example.test/marca/grazing-table-co-monocromatica.png");
  });
});
