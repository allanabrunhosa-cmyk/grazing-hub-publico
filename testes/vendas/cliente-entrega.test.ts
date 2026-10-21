import { describe, expect, it } from "vitest";
import { adicionarEntregaCliente, atualizarEntregaCliente, entregasDoCliente, indiceEntregaCliente, indiceEntregaCorrespondente, LIMITE_ENTREGAS_CLIENTE, removerEntregaCliente, rotuloEntregaCliente, selecionarEntregaCliente } from "@/lib/vendas/cliente-entrega";
import { validarEntregaPadraoCliente, validarEntregasClienteCompletas, type EntregaCliente } from "@/lib/vendas/dominio";
import { validarAtualizacaoClientePedido } from "@/lib/vendas/cliente-pedido";

const entrega = (numero = "10", nome = "Pessoa sintética"): EntregaCliente => ({ destinatario: { nome, contato: "11999990000" }, endereco: { pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
describe("livro de entregas do cliente", () => {
  it("lê o formato legado sem gravar nem descartar campos opcionais", () => {
    const legado = entrega();
    expect(entregasDoCliente(null)).toEqual([]); expect(entregasDoCliente(legado)).toEqual([legado]); expect(indiceEntregaCliente(legado)).toBe(0);
    expect(validarEntregaPadraoCliente(legado)).not.toHaveProperty("enderecos");
    expect(validarEntregaPadraoCliente(legado)?.destinatario.contato).toBe("+5511999990000");
    expect(legado.destinatario.contato).toBe("11999990000");
  });
  it("seleciona, edita, adiciona e remove uma opção sem alterar as demais", () => {
    const primeira = entrega(), segunda = entrega("20", "Outro destinatário"), livro = adicionarEntregaCliente(primeira, segunda);
    expect(indiceEntregaCliente(livro)).toBe(1); expect(livro.endereco.numero).toBe("20");
    const editado = atualizarEntregaCliente(livro, { ...segunda, endereco: { ...segunda.endereco, numero: "21" } });
    expect(editado.enderecos).toEqual([primeira, expect.objectContaining({ endereco: expect.objectContaining({ numero: "21" }) })]);
    expect(livro.enderecos?.[1].endereco.numero).toBe("20");
    expect(selecionarEntregaCliente(editado, 0)?.endereco.numero).toBe("10");
    const removido = removerEntregaCliente(editado, 0)!;
    expect(removido).toMatchObject({ selecionado: 0, endereco: { numero: "21" } }); expect(removido.enderecos).toHaveLength(1);
    expect(removerEntregaCliente(removido, 0)).toBeNull();
    expect(() => atualizarEntregaCliente(livro, primeira, 5)).toThrow(/Selecione/);
    expect(rotuloEntregaCliente(segunda, 1)).toContain("Entrega 2 · Outro destinatário · Rua Sintética, 20");
  });
  it("valida cada opção e usa o selecionado como espelho canônico do escalar", () => {
    const d = validarEntregaPadraoCliente({ ...entrega("999"), enderecos: [entrega(), entrega("20")], selecionado: 1 })!;
    expect(d).toMatchObject({ selecionado: 1, endereco: { numero: "20" }, destinatario: { contato: "+5511999990000" } });
    expect(d.enderecos?.[0].endereco.numero).toBe("10");
    expect(() => validarEntregaPadraoCliente({ ...d, enderecos: [entrega(), { ...entrega("20"), destinatario: { nome: "Outro", contato: "123" } }] })).toThrow(/telefone/);
    expect(() => validarEntregaPadraoCliente({ ...d, enderecos: [entrega(), { ...entrega("20"), endereco: { ...entrega().endereco, cep: "ABC" } }] })).toThrow(/CEP/);
  });
  it("recusa índice inválido e excesso sem truncar a lista", () => {
    for (const selecionado of [-1, 2, 0.5, "1"]) expect(() => validarEntregaPadraoCliente({ ...entrega(), enderecos: [entrega(), entrega("20")], selecionado })).toThrow();
    expect(() => validarEntregaPadraoCliente({ ...entrega(), enderecos: [] })).toThrow(/ao menos/);
    const enderecos = Array.from({ length: LIMITE_ENTREGAS_CLIENTE }, (_, n) => entrega(String(n)));
    expect(validarEntregaPadraoCliente({ ...entrega(), enderecos, selecionado: 249 })?.enderecos).toHaveLength(250);
    expect(() => validarEntregaPadraoCliente({ ...entrega(), enderecos: [...enderecos, entrega("251")] })).toThrow(/250/);
    expect(() => adicionarEntregaCliente({ ...entrega(), enderecos, selecionado: 0 }, entrega("251"))).toThrow(/250/);
  });
  it("a atualização inline do pedido preserva o livro completo e a seleção", () => {
    const livro = adicionarEntregaCliente(entrega(), entrega("20"));
    const c = validarAtualizacaoClientePedido({ id: "cliente-sintetico", versao: 2, tipo: "PF", nome: "Comprador sintético", documento: null, email: "teste@example.invalid", telefone: "+5511999990000", contato: null, entregaPadrao: livro });
    expect(c.entregaPadrao).toMatchObject({ selecionado: 1, endereco: { numero: "20" }, enderecos: [{ endereco: { numero: "10" } }, { endereco: { numero: "20" } }] });
  });
  it("preserva o texto original sem inventar dados postais e recusa texto extenso", () => {
    const textoOriginal = "  Destino sintético\nReferência sem CEP nem número  ";
    const parcial = { destinatario: { nome: "", contato: "" }, endereco: {}, textoOriginal };
    const validado = validarEntregaPadraoCliente(parcial)!;
    expect(validado.textoOriginal).toBe(textoOriginal); expect(validado.endereco).toMatchObject({ cep: "", numero: "" });
    const editado = atualizarEntregaCliente(validado, { destinatario: { nome: "Pessoa confirmada", contato: "" }, endereco: validado.endereco });
    expect(editado.textoOriginal).toBe(textoOriginal); expect(editado.enderecos?.[0].textoOriginal).toBe(textoOriginal);
    expect(() => validarEntregaPadraoCliente({ ...parcial, textoOriginal: "x".repeat(2001) })).toThrow(/2000/);
    expect(() => validarEntregaPadraoCliente({ ...parcial, textoOriginal: 123 })).toThrow(/Endereço original/);
  });
  it("só associa um pedido antigo a uma opção quando a correspondência é única", () => {
    const primeira = entrega(), livro = adicionarEntregaCliente(primeira, entrega("20"));
    expect(indiceEntregaCorrespondente(livro, entrega("20"))).toBe(1);
    expect(indiceEntregaCorrespondente(livro, entrega("999"))).toBeNull();
    expect(indiceEntregaCorrespondente({ ...livro, enderecos: [...livro.enderecos!, primeira] }, primeira)).toBeNull();
  });
  it("permite edição transitória incompleta, mas bloqueia inclusão e gravação incompletas ou repetidas", () => {
    const primeira = entrega(), parcial = { ...primeira, endereco: { ...primeira.endereco, numero: "" } };
    const editado = atualizarEntregaCliente(primeira, parcial);
    expect(editado.endereco.numero).toBe("");
    expect(() => validarEntregasClienteCompletas(editado)).toThrow(/obrigatórios/);
    expect(() => adicionarEntregaCliente(primeira, parcial)).toThrow(/obrigatórios/);
    expect(() => adicionarEntregaCliente(primeira, { ...primeira, destinatario: { nome: "Outro nome", contato: "" } })).toThrow(/já existe/);
  });
});
