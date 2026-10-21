import { describe, expect, it } from "vitest";
import { enderecoDaEtiqueta } from "@/lib/etiquetas/endereco";
import { comporEtiqueta } from "@/lib/etiquetas/layout";
import { gerarZplEtiqueta, sanitizarTextoZpl } from "@/lib/etiquetas/zpl";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { dimensionarFonte0 } from "@/lib/etiquetas/fonte-zpl";

const endereco = "Avenida das Palmeiras, 123, sala 4, Jardim Fictício, Cidade Exemplo - SP, 12345-678, Brasil";
const dados: DadosEtiqueta = {
  produtoNome: "Produto fictício", lojaNome: "Empresa fictícia", lojaCnpj: "00.000.000/0001-00",
  lojaEndereco: endereco, conservacao: "REFRIGERADO", quantidade: "1.250", unidade: "KG",
  lote: "LOTE-1", marcaFornecedor: "Marca fictícia", sif: "123", codigoRastreio: "A1B2C3",
  responsavelManipulacao: "Pessoa fictícia", manipuladoEm: "2026-10-15T12:00:00.000Z",
  validoAte: "2026-10-17T12:00:00.000Z", fusoHorario: "America/Sao_Paulo",
  resolucaoDpi: 203, tamanho: "MM_60X60", mostrarHora: true, copias: 1,
};

describe("endereço completo da etiqueta", () => {
  it("preserva número, complemento, bairro e país sem alterar o cadastro", () => {
    expect(enderecoDaEtiqueta(endereco)).toEqual({
      cep: "CEP: 12345-678", endereco: "Av. das Palmeiras, 123, sala 4, Jardim Fictício",
      cidadeUf: "Cidade Exemplo - SP, Brasil",
    });
    expect(endereco).toContain("Avenida");
  });

  it("aceita o formato antigo com cidade e UF separados e CEP com prefixo", () => {
    expect(enderecoDaEtiqueta("Rua Exemplo, 10, Cidade Exemplo, sp, CEP: 12345678")).toEqual({
      cep: "CEP: 12345-678", endereco: "Rua Exemplo, 10", cidadeUf: "Cidade Exemplo - SP",
    });
  });

  it("preserva endereços sem CEP ou cidade reconhecível", () => {
    expect(enderecoDaEtiqueta("Rua Exemplo, 10, complemento")).toEqual({ cep: "", endereco: "Rua Exemplo, 10, complemento", cidadeUf: "" });
    expect(enderecoDaEtiqueta("")).toEqual({ cep: "", endereco: "", cidadeUf: "" });
  });

  it.each([203, 300, 600])("separa CEP, duas linhas de endereço e cidade sem sobreposição a %i dpi", (dpi) => {
    const entrada = { ...dados, resolucaoDpi: dpi };
    const composicao = comporEtiqueta(entrada);
    const linhas = composicao.linhas.filter((linha) => linha.chave.startsWith("endereco-"));
    expect(linhas.map((linha) => linha.chave)).toEqual(["endereco-cep", "endereco-0", "endereco-1", "endereco-cidade"]);
    expect(linhas[0].texto).toBe("CEP: 12345-678");
    expect(linhas.slice(1, -1).map((linha) => linha.texto).join(" ")).toBe(sanitizarTextoZpl("END.: Av. das Palmeiras, 123, sala 4, Jardim Fictício"));
    expect(linhas.at(-1)?.texto).toBe("Cidade Exemplo - SP, Brasil");
    const cnpj = composicao.linhas.find((linha) => linha.chave === "cnpj")!;
    const codigo = composicao.linhas.find((linha) => linha.chave === "codigo")!;
    expect(linhas[0].y).toBeGreaterThan(cnpj.y + cnpj.fonte);
    for (const [indice, linha] of linhas.entries()) {
      expect(linha.x + linha.texto.length * linha.larguraLetra).toBeLessThan(composicao.logo.x);
      expect(linha.fonte).toBeGreaterThanOrEqual(Math.round(1.25 * dpi / 25.4));
      expect(linha.y + linha.fonte).toBeLessThan(codigo.y);
      if (indice > 0) expect(linha.y).toBeGreaterThan(linhas[indice - 1].y + linhas[indice - 1].fonte);
    }
    const zpl = gerarZplEtiqueta(entrada);
    for (const linha of linhas) expect(zpl).toContain(`^FO${linha.x},${linha.y}\n^A0N,${linha.fonte},${dimensionarFonte0(linha.texto, linha.larguraLetra).larguraFonte}\n^FD${linha.texto}^FS`);
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
    expect(zpl).toContain("^PQ1,0,1,N");
  });

  it("mantém a proteção contra corte silencioso e comandos no endereço", () => {
    expect(() => comporEtiqueta({ ...dados, lojaEndereco: "Avenida " + "texto extenso ".repeat(30) })).toThrow(/endereço completo não cabe/);
    const zpl = gerarZplEtiqueta({ ...dados, lojaEndereco: "Avenida ^XZ ~HS, 10, Cidade - SP, 12345-678" });
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
    expect(zpl).not.toContain("~HS");
    expect(zpl).toContain("Av. XZ HS");
  });
});
