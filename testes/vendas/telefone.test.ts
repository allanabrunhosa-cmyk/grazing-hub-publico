import { describe, expect, it } from "vitest";
import { editarTelefone, exibirTelefone, formatarTelefone, telefoneArmazenado, telefoneOpcionalArmazenado } from "@/lib/vendas/telefone";
import { validarEntregaPadraoCliente } from "@/lib/vendas/dominio";
import { exigirTelefoneDestinatario, validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";

describe("telefone em campo único", () => {
  it("formata progressivamente com DDI fixo, DDD e oito ou nove dígitos", () => {
    expect(formatarTelefone("")).toBe("");
    expect(formatarTelefone("1")).toBe("+55 (1");
    expect(formatarTelefone("11")).toBe("+55 (11");
    expect(formatarTelefone("119765")).toBe("+55 (11) 9765");
    expect(formatarTelefone("1197658")).toBe("+55 (11) 9765-8");
    expect(formatarTelefone("1134567890")).toBe("+55 (11) 3456-7890");
    expect(formatarTelefone("11976586412")).toBe("+55 (11) 97658-6412");
  });
  it("aceita colagem com DDI, espaços e pontuação, sem ultrapassar onze dígitos nacionais", () => {
    for (const colado of ["+55 (11) 97658-6412", "5511976586412", "(11) 97658-6412", "+55 (11) 97658-641299"]) expect(telefoneArmazenado(colado)).toBe("+5511976586412");
    expect(telefoneArmazenado("55976586412")).toBe("+5555976586412");
  });
  it("apagar separador remove o dígito anterior em vez de travar a edição", () => {
    expect(editarTelefone("+5511976586412", "+55 (11) 976586412")).toBe("+551197658641");
    expect(editarTelefone("+5511", "+55 (1")).toBe("+551");
    expect(editarTelefone("+551", "+55 (")).toBe("");
  });
  it("exibe valores antigos fora do padrão sem reinterpretá-los", () => {
    expect(exibirTelefone("+5511976586412")).toBe("+55 (11) 97658-6412");
    expect(exibirTelefone("Portaria")).toBe("Portaria");
    expect(exibirTelefone(null)).toBe("");
  });
  it("telefone opcional fica vazio ou completo", () => {
    expect(telefoneOpcionalArmazenado("  ")).toBe("");
    expect(telefoneOpcionalArmazenado("11 97658-6412")).toBe("+5511976586412");
    expect(telefoneOpcionalArmazenado("97658-6412")).toBeNull();
  });
  it("o servidor rejeita excesso de dígitos ou letras em vez de truncar silenciosamente", () => {
    expect(telefoneOpcionalArmazenado("+55 (11) 97658-641299")).toBeNull();
    expect(telefoneOpcionalArmazenado("551197658641299")).toBeNull();
    expect(telefoneOpcionalArmazenado("+55 (11) 97658-6412abc")).toBeNull();
    expect(telefoneOpcionalArmazenado("+1(11)97658-6412")).toBeNull();
    expect(telefoneOpcionalArmazenado("+55 (11) 3456-7890")).toBe("+551134567890");
  });
});

describe("telefone do destinatário no servidor", () => {
  const endereco = { pais: "Brasil", cep: "01001-000", logradouro: "Rua fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
  it("normaliza a entrega padrão do cliente e recusa número incompleto", () => {
    expect(validarEntregaPadraoCliente({ destinatario: { nome: "Pessoa fictícia", contato: "+55 (11) 97658-6412" }, endereco })?.destinatario.contato).toBe("+5511976586412");
    expect(validarEntregaPadraoCliente({ destinatario: { nome: "Pessoa fictícia", contato: "" }, endereco })?.destinatario.contato).toBe("");
    expect(() => validarEntregaPadraoCliente({ destinatario: { nome: "Pessoa fictícia", contato: "976586412" }, endereco })).toThrow("telefone da entrega");
  });
  it("normaliza o destinatário do pedido, lê texto antigo e recusa número incompleto ao gravar", () => {
    const pedido = { clienteId: null, canalId: null, atendimento: "ENTREGA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, endereco: null, cobranca: null, observacoes: "", desconto: "0", frete: "0", itens: [] };
    expect(validarEntradaPedido({ ...pedido, destinatario: { nome: "Pessoa fictícia", contato: "(11) 3456-7890" } }).destinatario?.contato).toBe("+551134567890");
    const antigo = validarEntradaPedido({ ...pedido, destinatario: { nome: "Pessoa fictícia", contato: "3456-7890" } });
    expect(antigo.destinatario?.contato).toBe("3456-7890");
    expect(() => exigirTelefoneDestinatario(antigo)).toThrow("telefone do destinatário");
    expect(() => exigirTelefoneDestinatario({ destinatario: { nome: "Pessoa fictícia", contato: "" } })).not.toThrow();
  });
});
