// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EtiquetaPreview } from "@/app/(protegido)/producao/etiquetas/etiqueta-preview";
import { gerarZplEtiqueta } from "@/lib/etiquetas/zpl";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";

const dados: DadosEtiqueta = {
  produtoNome: "Produto fictício",
  lojaNome: "Loja fictícia",
  lojaCnpj: null,
  lojaEndereco: "Rua fictícia, 10",
  conservacao: "REFRIGERADO",
  quantidade: null,
  unidade: "KG",
  lote: null,
  marcaFornecedor: null,
  sif: null,
  codigoRastreio: "A1B2C3",
  responsavelManipulacao: "Pessoa fictícia",
  manipuladoEm: "2026-10-14T12:00:00.000Z",
  validoAte: "2026-10-16T12:00:00.000Z",
  fusoHorario: "America/Sao_Paulo",
  resolucaoDpi: 203,
  tamanho: "MM_60X60",
  mostrarHora: true,
  copias: 1,
};
const enderecoCompleto = "Avenida das Palmeiras, 123, sala 4, Jardim Fictício, Cidade Exemplo - SP, 12345-678, Brasil";
const enderecoLongo = `Avenida ${"nome fictício muito extenso ".repeat(12)}, 123, Cidade Exemplo - SP, 12345-678, Brasil`;

afterEach(cleanup);

it("mostra o endereço completo em 60×60 com CEP, avenida abreviada e cidade separados", () => {
  render(<EtiquetaPreview dados={{ ...dados, lojaEndereco: enderecoCompleto }} />);
  const previa = screen.getByRole("img");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(previa.textContent).toContain("CEP: 12345-678");
  expect(previa.textContent).toContain("END.: Av. das Palmeiras, 123, sala 4,");
  expect(previa.textContent).toContain("Jardim Ficticio");
  expect(previa.textContent).toContain("Cidade Exemplo - SP, Brasil");
  expect(() => gerarZplEtiqueta({ ...dados, lojaEndereco: enderecoCompleto })).not.toThrow();
});

it.each(["MM_60X40", "MM_60X60"] as const)("mantém a tela acessível quando o endereço não cabe em %s", (tamanho) => {
  const invalido = { ...dados, tamanho, lojaEndereco: enderecoLongo };
  render(<><button type="button">Configurações</button><EtiquetaPreview dados={invalido} /></>);
  expect(screen.getByRole("button", { name: "Configurações" })).toBeDefined();
  expect(screen.getByRole("alert").textContent).toMatch(/endereço.*não cabe/i);
  expect(screen.queryByRole("img")).toBeNull();
  expect(() => gerarZplEtiqueta(invalido)).toThrow(/não cabe/);
});

it("recupera a prévia após corrigir o conteúdo, sem recarregar a página", () => {
  const { rerender } = render(<EtiquetaPreview dados={{ ...dados, lote: "X".repeat(80) }} />);
  expect(screen.getByRole("alert").textContent).toMatch(/lote.*não cabe/);
  rerender(<EtiquetaPreview dados={dados} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("img", { name: "Prévia de etiqueta 60 por 60 milímetros" })).toBeDefined();
});

it("recusa a largura mínima da fonte nativa sem derrubar a tela", () => {
  const invalido = { ...dados, tamanho: "MM_60X40" as const, lojaEndereco: "W".repeat(43) };
  render(<EtiquetaPreview dados={invalido} />);
  expect(screen.getByRole("alert").textContent).toMatch(/largura mínima da fonte/);
  expect(screen.queryByRole("img")).toBeNull();
  expect(() => gerarZplEtiqueta(invalido)).toThrow(/largura mínima da fonte/);
});

it("preserva erros inesperados em vez de apresentá-los como conteúdo longo", () => {
  expect(() => EtiquetaPreview({ dados: { ...dados, fusoHorario: "Fuso/inexistente" } })).toThrow(RangeError);
});
