import { describe, expect, it } from "vitest";
import { hashCanonico } from "@/lib/vendas/historico-dominio";
import { aplicarComplementoPacote, validarComplementoRegistro, validarPacoteComplementarHistorico } from "@/lib/vendas/historico-complemento";
import { fixtureComplementoHistorico, rehashComplementoSintetico } from "./historico-complemento.fixture";

describe("complemento Woo comprovado e segregado", () => {
  it("revalida dez conhecidos e fecha bruto AY e líquido+frete BA sem segundo desconto", () => {
    const f = fixtureComplementoHistorico(), antes = structuredClone(f.registro), c = validarComplementoRegistro(f.registro, f.complemento);
    expect(c.itens).toHaveLength(1); expect(c.itens[0]).toMatchObject({ bloco: 11, quantidade: "2", preco_unitario_liquido: "12.50", desconto_linha: "5.00", liquido_linha: "25.00", bruto_linha_reconstruido: "30.00", consumo_apurado: null });
    expect(c.cotejo).toMatchObject({ subtotalBruto: "230.00", liquidoItens: "205.00", descontoItens: "25.00", totalComFrete: "200.00" });
    expect(c.cotejo.correspondencias).toHaveLength(10); expect(f.registro).toEqual(antes);
  });
  it("preserva dez sabores repetidos como linhas distintas e aceita quatro extras", () => {
    const f = fixtureComplementoHistorico({ extras: 4, repetidos: true }), c = validarComplementoRegistro(f.registro, f.complemento);
    expect(new Set(c.cotejo.correspondencias.map(v => v.wooItemId)).size).toBe(10); expect(c.itens.map(v => v.bloco)).toEqual([11, 12, 13, 14]);
    expect(c.raw.line_items[0].meta_data).toEqual([{ key: "sabor", value: "variante sintética 0" }]);
  });
  it("aceita fração comprovada com seis casas ou menos e preço unitário exato", () => {
    const f = fixtureComplementoHistorico({ fracionario: true });
    expect(validarComplementoRegistro(f.registro, f.complemento).itens[0]).toMatchObject({ quantidade: "0.125", preco_unitario_liquido: "8.00", liquido_linha: "1.00" });
  });
  it("normaliza nome NFKC e espaços sem misturar produtos de acentos diferentes", () => {
    const f = fixtureComplementoHistorico(); f.complemento.raw.line_items[0].name = " ＰＲＯＤＵＴＯ  SINTÉTICO 1 "; rehashComplementoSintetico(f.complemento);
    expect(validarComplementoRegistro(f.registro, f.complemento).cotejo.correspondencias).toHaveLength(10);
    f.complemento.raw.line_items[0].name = "Produto sintetico 1"; rehashComplementoSintetico(f.complemento);
    expect(() => validarComplementoRegistro(f.registro, f.complemento)).toThrow("CONHECIDO_NAO_COMPROVADO");
  });
  it.each(["name", "quantity", "total", "subtotal", "price"])("não confia em flags quando %s de conhecido diverge", campo => {
    const f = fixtureComplementoHistorico(); f.complemento.raw.line_items[0][campo] = campo === "name" ? "Outro produto" : campo === "quantity" ? 3 : "17.00";
    rehashComplementoSintetico(f.complemento); expect(() => validarComplementoRegistro(f.registro, f.complemento)).toThrow();
  });
  it("não inventa unitário por arredondamento", () => {
    const f = fixtureComplementoHistorico(), extra = f.complemento.raw.line_items[10]; extra.quantity = 3; extra.total = "10.00"; extra.price = "3.33";
    rehashComplementoSintetico(f.complemento); expect(() => validarComplementoRegistro(f.registro, f.complemento)).toThrow("UNITARIO_NAO_REPRESENTAVEL");
  });
  it.each(["NaN", "Infinity", "1e3", "1.001", "-1"])("recusa valor monetário inválido %s", valor => {
    const f = fixtureComplementoHistorico(); f.complemento.raw.line_items[10].total = valor; rehashComplementoSintetico(f.complemento);
    expect(() => validarComplementoRegistro(f.registro, f.complemento)).toThrow("VALOR_INVALIDO");
  });
  it("recusa quantidade excessiva, ausência de ID comprovado e tributo sem representação", () => {
    for (const alteracao of [ { quantity: "0.1234567" }, { product_id: 0 }, { total_tax: "0.01" } ]) {
      const f = fixtureComplementoHistorico(); Object.assign(f.complemento.raw.line_items[10], alteracao); rehashComplementoSintetico(f.complemento);
      expect(() => validarComplementoRegistro(f.registro, f.complemento)).toThrow();
    }
  });
  it("preserva Produto Externo comprovado como legado não identificado sem custo ou consumo", () => {
    const f = fixtureComplementoHistorico(); f.complemento.raw.line_items[10].name = "  PRODUTO   EXTERNO  "; rehashComplementoSintetico(f.complemento);
    const c = validarComplementoRegistro(f.registro, f.complemento);
    expect(c.itens[0]).toMatchObject({ nome_original: "  PRODUTO   EXTERNO  ", quantidade: "2", preco_unitario_liquido: "12.50", desconto_linha: "5.00", liquido_linha: "25.00", bruto_linha_reconstruido: "30.00", produto_externo_nao_identificado: true, consumo_apurado: null, custo_historico_comprovado: null });
    expect(c.cotejo.totalComFrete).toBe("200.00");
    c.itens[0].produto_externo_nao_identificado = false;
    expect(validarComplementoRegistro(f.registro, c).itens[0].produto_externo_nao_identificado).toBe(true);
  });
  it("recusa item omitido, duplicado, hash alterado e vínculo de outro pedido", () => {
    const a = fixtureComplementoHistorico(); a.complemento.raw.line_items.splice(0, 1); rehashComplementoSintetico(a.complemento); expect(() => validarComplementoRegistro(a.registro, a.complemento)).toThrow("ITENS_INVALIDOS");
    const b = fixtureComplementoHistorico(); b.complemento.raw.line_items[10].id = 1; rehashComplementoSintetico(b.complemento); expect(() => validarComplementoRegistro(b.registro, b.complemento)).toThrow("ITEM_DUPLICADO");
    const c = fixtureComplementoHistorico(); c.complemento.raw.line_items[10].name = "Mudou sem hash"; expect(() => validarComplementoRegistro(c.registro, c.complemento)).toThrow("RAW_DIVERGENTE");
    const d = fixtureComplementoHistorico(); d.complemento.prova.numeroOriginal = "99999"; expect(() => validarComplementoRegistro(d.registro, d.complemento)).toThrow("VINCULO_PRINCIPAL_DIVERGENTE");
  });
  it("recusa fechamento financeiro divergente mesmo com conhecidos perfeitos", () => {
    const f = fixtureComplementoHistorico(); f.registro.raw.valores[50] = "999"; f.registro.hash_linha = hashCanonico(f.registro.raw.valores); f.complemento.prova.hashLinhaPrincipal = f.registro.hash_linha;
    expect(() => validarComplementoRegistro(f.registro, f.complemento)).toThrow("FECHAMENTO_DIVERGENTE");
  });
  it("recalcula itens derivados e torna repetição estável apesar de nova leitura", () => {
    const f = fixtureComplementoHistorico(), a = validarComplementoRegistro(f.registro, f.complemento), b = structuredClone(a);
    b.itens[0].preco_unitario_liquido = "999"; b.prova.fonteComplementar.lidoEm = "2026-10-16T12:00:00Z"; b.prova.fonteComplementar.snapshotId = "outra-leitura"; b.prova.fonteComplementar.arquivoSha256 = "c".repeat(64);
    const validado = validarComplementoRegistro(f.registro, b); expect(validado.itens[0].preco_unitario_liquido).toBe("12.50"); expect(validado.hash_sha256).toBe(a.hash_sha256);
    b.hash_sha256 = "d".repeat(64); expect(() => validarComplementoRegistro(f.registro, b)).toThrow("HASH_VERSAO_DIVERGENTE");
  });
  it("preserva HTML e fórmulas como texto no snapshot sem executar conteúdo", () => {
    const f = fixtureComplementoHistorico(); f.complemento.raw.line_items[10].name = "<script>texto sintético</script> =SUM(1)"; rehashComplementoSintetico(f.complemento);
    const c = validarComplementoRegistro(f.registro, f.complemento); expect(c.itens[0].nome_original).toBe("<script>texto sintético</script> =SUM(1)");
  });
  it("verifica hashes dos arquivos e mantém contagens primárias separadas", async () => {
    const f = fixtureComplementoHistorico({ extras: 4 }), antes = structuredClone(f.pacote), resultado = await validarPacoteComplementarHistorico(f);
    expect(resultado.contagens).toEqual({ pedidosPrimarios: 1, itensPrimarios: 10, unidadesPrimarias: "20", pedidosComplementados: 1, itensComplementares: 4, unidadesComplementares: "8" });
    expect(resultado.pacote.registros[0].itens).toEqual(antes.registros[0].itens); expect(resultado.pacote.registros[0].raw).toEqual(antes.registros[0].raw); expect(resultado.pacote.metadados).toEqual(antes.metadados);
    f.envelope.fontePrincipal.pacoteSha256 = "f".repeat(64); await expect(validarPacoteComplementarHistorico({ pacotePrincipalJson: f.pacotePrincipalJson, complementoJson: JSON.stringify(f.envelope) })).rejects.toThrow("HASH_FONTE_DIVERGENTE");
  });
  it("não duplica pedido nem aceita pacote já complementado como primário", async () => {
    const f = fixtureComplementoHistorico(); f.envelope.pedidos.push(f.envelope.pedidos[0]); await expect(validarPacoteComplementarHistorico({ ...f, complementoJson: JSON.stringify(f.envelope) })).rejects.toThrow();
    f.pacote.registros[0].complemento = validarComplementoRegistro(f.registro, f.complemento); await expect(validarPacoteComplementarHistorico({ pacotePrincipalJson: JSON.stringify(f.pacote), complementoJson: f.complementoJson })).rejects.toThrow("PRINCIPAL_JA_COMPLEMENTADO");
  });
  it("aplicação síncrona exige os hashes esperados e devolve cópia independente", () => {
    const f = fixtureComplementoHistorico(), antes = structuredClone(f.pacote), contexto = { fonteSha256: f.pacote.metadados.sha256, pacoteSha256: f.envelope.fontePrincipal.pacoteSha256 };
    const p = aplicarComplementoPacote(f.pacote, f.envelope, contexto); expect(f.pacote).toEqual(antes); expect(p.registros[0].complemento).toBeDefined();
    expect(() => aplicarComplementoPacote(f.pacote, f.envelope, { ...contexto, fonteSha256: "c".repeat(64) })).toThrow("HASH_FONTE_DIVERGENTE");
    expect(() => aplicarComplementoPacote(f.pacote, f.envelope, { ...contexto, pacoteSha256: "c".repeat(64) })).toThrow("HASH_FONTE_DIVERGENTE");
  });
});
