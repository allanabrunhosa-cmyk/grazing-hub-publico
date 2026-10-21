// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { htmlComandaPedido, type DadosComandaPedido } from "@/lib/vendas/impressao-pedido";
import { ComandaPedido } from "@/app/(protegido)/vendas/pedidos/[id]/comanda/comanda-client";
import type { ResumoOperacional } from "@/app/(protegido)/vendas/pedidos/[id]/operacao/operacao-client";
afterEach(cleanup);
const dados: DadosComandaPedido = { numero: 1234, titulo: "COMANDA DO PEDIDO", situacao: "Confirmado", data: "2026-10-03", horario: "14:00–16:00", comprador: '<img src=x onerror="alert(1)">', observacoes: "Não tocar campainha\nEntregar na portaria", itens: [{ nome: "Kit & companhia", quantidade: "0.125", unidade: "KG", escolhas: ["1 × Extra <especial>"], observacoes: "Sem cebola" }], rodape: "Conferir" };
it("destaca número, data civil, janela, quantidades exatas e observações sem HTML executável", () => {
  const html = htmlComandaPedido(dados);
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector(".numero.destaque")?.textContent).toBe("#1234");
  expect(doc.querySelector(".entrega.destaque")?.textContent).toContain("03/10/2026");
  expect(doc.querySelector(".entrega.destaque")?.textContent).toContain("14:00–16:00");
  expect(doc.querySelector(".quantidade.destaque")?.textContent).toBe("0,125 KG");
  expect([...doc.querySelectorAll(".observacao.destaque")].map(el => el.textContent)).toEqual(["OBS.: Não tocar campainha\nEntregar na portaria", "OBS.: Sem cebola"]);
  expect(doc.querySelectorAll("img,script")).toHaveLength(0);
  expect(doc.querySelector(".complemento")?.textContent).toBe("1 × Extra <especial>");
  expect(html).toContain("print-color-adjust:exact"); expect(html).toContain("width:72mm"); expect(html).not.toContain("80mm auto");
});
it("não inventa agenda, distingue retirada e omite observações vazias", () => {
  const doc = new DOMParser().parseFromString(htmlComandaPedido({ ...dados, atendimento: "RETIRADA", data: null, horario: null, observacoes: " ", itens: [] }), "text/html");
  expect(doc.querySelector(".entrega")?.textContent).toBe("Retirada: Sem dataHorário: Sem horário");
  expect(doc.querySelectorAll(".observacao")).toHaveLength(0);
});
it("produção inicia em 80 mm e conserva escolha explícita por A4", () => {
  const pedido: ResumoOperacional = { id: "p", numero: 1234, versao: 1, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", previsaoData: null, previsaoJanela: null, observacoes: null, destinatarioSnapshot: null, enderecoSnapshot: null, historico: [], itens: [] };
  render(<ComandaPedido pedido={pedido} geradoEm="2026-10-03T12:00:00Z" />);
  expect(screen.getByRole("button", { name: "80 mm" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByTitle("Comanda de produção 80mm").getAttribute("srcdoc")).toContain("width:72mm");
  fireEvent.click(screen.getByRole("button", { name: "A4" }));
  expect(screen.getByRole("button", { name: "A4" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByTitle("Comanda de produção A4").getAttribute("srcdoc")).toContain("size:A4");
});

it("comanda distingue início de preparo da janela recebida e conserva pedido manual com hora única",()=>{
 const doc = new DOMParser().parseFromString(htmlComandaPedido({...dados,inicioPreparo:"07/10/2026, 23:00",horario:"07/10/2026, 23:30 – 08/10/2026, 01:30"}),"text/html");
 expect(doc.querySelector("header")?.textContent).toContain("Início de preparo iFood: 07/10/2026, 23:00");
 expect(doc.querySelector(".entrega")?.textContent).toContain("08/10/2026, 01:30");
 const manual=htmlComandaPedido({...dados,horario:"14:00"});expect(manual).toContain("Horário: 14:00");expect(manual).not.toContain("Início de preparo iFood:");
});
