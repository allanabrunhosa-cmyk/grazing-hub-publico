// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResumoCustosNota, ComposicaoCustoItem } from "@/app/(protegido)/notas-fiscais/custos-nota";
import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";
import { calcularCustosNota, totalCustoItem, type ModoDescontoNota } from "@/lib/notas-fiscais/custos";
import { xmlCmc, xmlCustos } from "./custos-dados";
afterEach(cleanup);
const custos = extrairCustosNFe(xmlCustos);

function Conferencia() {
  const [modo, definirModo] = useState<ModoDescontoNota>("NOTA");
  const [descontos, definirDescontos] = useState(["5.00", "15.00"]);
  const resultado = calcularCustosNota(custos, { modo, itens: custos.itens.map((item, i) => ({ numeroItem: item.numeroItem, desconto: Number(descontos[i]) })) });
  return <>
    <ResumoCustosNota custos={custos} modo={modo} aoMudarModo={definirModo} bloqueado={false} descontoDistribuido={descontos.reduce((soma, valor) => soma + Number(valor), 0)} erro={"erro" in resultado ? resultado.erro : null} />
    {custos.itens.map((item, i) => <ComposicaoCustoItem key={item.numeroItem} descricao={`Produto ${i + 1}`} custo={{ ...item, desconto: Number(descontos[i]), modoDesconto: modo, total: totalCustoItem(item, Number(descontos[i])) }}
      personalizado={modo === "PERSONALIZADO"} desconto={descontos[i]} bloqueado={false} aoMudarDesconto={valor => definirDescontos(atual => atual.map((antes, indice) => indice === i ? valor : antes))} />)}
  </>;
}
it("detalha encargos e permite distribuir desconto com a máscara de centavos", async () => {
  const usuario = userEvent.setup();
  render(<Conferencia />);
  expect(screen.getByRole("region", { name: "Composição do valor da nota" })).toBeTruthy();
  expect(screen.getAllByText(/IPI/).length).toBeGreaterThan(1);
  expect(screen.queryByRole("textbox", { name: "Desconto de Produto 1 em reais" })).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Personalizado" }));
  const desconto1 = screen.getByRole("textbox", { name: "Desconto de Produto 1 em reais" });
  const desconto2 = screen.getByRole("textbox", { name: "Desconto de Produto 2 em reais" });
  await usuario.clear(desconto1);
  await usuario.type(desconto1, "2000");
  expect((desconto1 as HTMLInputElement).value).toBe("20,00");
  expect(screen.getByText(/Distribuído a mais/)).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  await usuario.clear(desconto2);
  await usuario.type(desconto2, "0");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Desconto distribuído")).toBeTruthy();
  expect(screen.getByText(/Custo final.*98,00/)).toBeTruthy();
  expect(screen.getByText(/Custo final.*347,00/)).toBeTruthy();
});

it("explica que o ICMS próprio já está incluído sem reduzir o custo da CMC", () => {
  const custosCmc = extrairCustosNFe(xmlCmc);
  render(<ResumoCustosNota custos={custosCmc} modo="NOTA" aoMudarModo={() => {}} bloqueado={false} descontoDistribuido={0} erro={null} />);
  expect(screen.getByText("Impostos já incluídos no valor dos produtos")).toBeTruthy();
  expect(screen.getByText(/ICMS/).textContent).toMatch(/R\$\s281,51/);
  expect(screen.getByText(/não são somados novamente/)).toBeTruthy();
  expect(screen.getAllByText("R$ 4.021,77")).toHaveLength(2);
});
