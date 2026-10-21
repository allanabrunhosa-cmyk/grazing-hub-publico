import { validarIdentidadeCobranca } from "./dominio";
import { ErroPedidoVenda, exigirTelefoneDestinatario, validarEntradaPedido, type PedidoEntrada } from "./pedidos-dominio";

/** Apenas informações sem efeitos comerciais ou físicos entram neste comando. */
export type InformacoesPedidoEntrada = Partial<Pick<PedidoEntrada, "previsaoData" | "previsaoJanela" | "cobranca" | "destinatario">> & { motivo: string };

export const mensagemAlteracaoComercialPedido = "Para alterar produtos, quantidades, produção, preços, descontos, frete ou pagamento, cancele o pedido e crie um novo.";

export function validarInformacoesPedido(valor: unknown): InformacoesPedidoEntrada {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new ErroPedidoVenda("Informações do pedido inválidas.");
  const dados = valor as Record<string, unknown>;
  const permitidos = ["previsaoData", "previsaoJanela", "cobranca", "destinatario", "motivo"];
  if (Object.keys(dados).some(campo => !permitidos.includes(campo))) throw new ErroPedidoVenda(mensagemAlteracaoComercialPedido);
  const campos = permitidos.slice(0, -1).filter(campo => Object.hasOwn(dados, campo));
  if (!campos.length) throw new ErroPedidoVenda("Escolha as informações que deseja atualizar.");
  if (Object.hasOwn(dados, "previsaoData") !== Object.hasOwn(dados, "previsaoJanela")) throw new ErroPedidoVenda("Informe data e horário juntos.");
  const motivo = typeof dados.motivo === "string" ? dados.motivo.trim() : "";
  if (!motivo || motivo.length > 1000) throw new ErroPedidoVenda("Informe motivo de até 1000 caracteres.");
  const entrada = validarEntradaPedido({ ...dados, prazo: "AGENDADO", itens: [] });
  if (campos.includes("previsaoData") && Boolean(entrada.previsaoData) !== Boolean(entrada.previsaoJanela)) throw new ErroPedidoVenda("Informe data e horário juntos.");
  if (campos.includes("destinatario")) exigirTelefoneDestinatario(entrada);
  if (entrada.cobranca && [entrada.cobranca.pais, entrada.cobranca.cep, entrada.cobranca.logradouro, entrada.cobranca.numero, entrada.cobranca.bairro, entrada.cobranca.cidade, entrada.cobranca.uf].some(v => !v?.trim())) throw new ErroPedidoVenda("Preencha o endereço de cobrança deste pedido.");
  if (entrada.cobranca) {
    try { validarIdentidadeCobranca(entrada.cobranca, true); } catch (erro) { throw new ErroPedidoVenda(erro instanceof Error ? erro.message : "Cobrança inválida."); }
  }
  return { motivo, ...Object.fromEntries(campos.map(campo => [campo, entrada[campo as keyof PedidoEntrada]])) };
}
