import { detalharValoresIfood } from "./valores";
import { Prisma } from "@/generated/prisma/client";
import { horariosPedidoIfood } from "./horarios";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";
import { ErroIfood, instante, moeda, objeto, texto, uuid } from "./dominio";

export function adaptarPedido(valor: unknown, merchantId: string, ambiente: string, fuso: string) {
  const p = objeto(valor), merchant = objeto(p.merchant), total = objeto(p.total), pagamentos = objeto(p.payments);
  if (p.category != null && p.category !== "FOOD") throw new ErroIfood("Categoria fora do fluxo Food autorizado.");
  if (uuid(merchant.id) !== merchantId) throw new ErroIfood("Pedido fora da loja autorizada.");
  if (typeof p.isTest !== "boolean") throw new ErroIfood("Identificação de ambiente do pedido ausente ou inválida.");
  if (ambiente === "TESTE" && !p.isTest) throw new ErroIfood("Pedido real bloqueado no ambiente de teste.");
  if (ambiente === "PRODUCAO" && p.isTest) throw new ErroIfood("Pedido de teste recebido em produção.");
  if (!["DELIVERY", "TAKEOUT", "DINE_IN", "INDOOR"].includes(String(p.orderType)) || !["IMMEDIATE", "SCHEDULED"].includes(String(p.orderTiming))) throw new ErroIfood("Modalidade iFood ainda desconhecida; pedido preservado para conferência.");
  const subtotal = moeda(total.subTotal), frete = moeda(total.deliveryFee), desconto = moeda(total.benefits), outrosCustos = moeda(total.additionalFees ?? 0), quantia = moeda(total.orderAmount);
  const itens = Array.isArray(p.items) ? p.items.map((v, ordem) => {
    const i = objeto(v), q = String(i.quantity);
    if (!/^\d{1,12}(\.\d{1,6})?$/.test(q) || new Prisma.Decimal(q).lte(0)) throw new ErroIfood("Quantidade do item iFood inválida.");
    const opcoes = Array.isArray(i.options) ? i.options.map(v => {
      const o = objeto(v);
      return { opcaoId: texto(o.id, 100), opcaoNome: texto(o.name, 300), grupoNome: texto(o.groupName, 300), quantidade: Number(o.quantity), preco: moeda(o.price).toFixed(2), unitPrice: moeda(o.unitPrice).toFixed(2), externalCode: texto(o.externalCode, 100), customization: Array.isArray(o.customization) ? o.customization : [] };
    }) : [];
    if (opcoes.some(o => !Number.isFinite(o.quantidade) || o.quantidade <= 0)) throw new ErroIfood("Quantidade de adicional inválida.");
    return { externoId: texto(i.id, 100), externalCode: texto(i.externalCode, 100), ordem, quantidade: q, observacoes: texto(i.observations) || null, unidadeSnapshot: texto(i.unit, 20) || "UN",
      produtoSnapshot: { nome: texto(i.name, 300), categorias: [], idExterno: texto(i.id, 100), codigo: texto(i.externalCode, 100), origem: "IFOOD" }, escolhasSnapshot: opcoes,
      estadoComposicao: "PENDENTE", precoOriginal: moeda(i.unitPrice).toFixed(2), precoAplicado: moeda(i.unitPrice).toFixed(2),
      acrescimos: moeda(i.optionsPrice ?? 0).toFixed(2), desconto: "0.00", totalLinha: moeda(i.totalPrice).toFixed(2) };
  }) : [];
  if (!itens.length) throw new ErroIfood("Pedido iFood sem itens; conferir detalhes.");
  const metodos = Array.isArray(pagamentos.methods) ? pagamentos.methods.map((v, indice) => {
    const m = objeto(v);
    if (m.currency !== "BRL" || typeof m.prepaid !== "boolean" || !["ONLINE", "OFFLINE"].includes(String(m.type))) throw new ErroIfood("Pagamento iFood fora do contrato.");
    return { indice, valor: moeda(m.value).toFixed(2), metodo: texto(m.method, 60), tipo: String(m.type), prePago: m.prepaid, recebedor: m.prepaid ? "IFOOD" : "A_CONFERIR", bandeira: m.card ? texto(objeto(m.card).brand, 80) : null, trocoPara: m.cash && objeto(m.cash).changeFor != null ? moeda(objeto(m.cash).changeFor).toFixed(2) : null };
  }) : [];
  const soma = (vs: string[]) => vs.reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
  const pendencias: string[] = [];
  if (!soma(itens.map(i => i.totalLinha)).eq(subtotal)) pendencias.push("Itens divergem do subtotal recebido");
  if (!Prisma.Decimal.max(0, subtotal.plus(frete).plus(outrosCustos).minus(desconto)).eq(quantia)) pendencias.push("Totais recebidos não reconciliados");
  if (!soma(metodos.map(m => m.valor)).eq(quantia)) pendencias.push("Pagamentos divergem do total recebido");
  if (!soma(metodos.filter(m => m.prePago).map(m => m.valor)).eq(moeda(pagamentos.prepaid)) || !soma(metodos.filter(m => !m.prePago).map(m => m.valor)).eq(moeda(pagamentos.pending))) pendencias.push("Somas de pagamentos divergentes");
  const cliente = p.customer ? objeto(p.customer) : {}, entrega = p.delivery ? objeto(p.delivery) : {}, end = entrega.deliveryAddress ? objeto(entrega.deliveryAddress) : null;
  const telefone = cliente.phone ? objeto(cliente.phone) : {};
  const horarios = horariosPedidoIfood(p, fuso), data = horarios.referencia;
  pendencias.push(...horarios.problemas);
  return {
    externoId: uuid(p.id), displayId: texto(p.displayId, 100), criadoEm: instante(p.createdAt), modalidade: String(p.orderType), entregaPor: texto(entrega.deliveredBy, 40) || null,
    valores: detalharValoresIfood(p), horarios, inicioPreparo: horarios.inicioPreparo, clienteExternoId: texto(cliente.id, 100), itens, metodos, pendencias,
    dados: { origem: "IFOOD", atendimento: p.orderType === "DELIVERY" ? "ENTREGA" : p.orderType === "TAKEOUT" ? "RETIRADA" : "LOCAL", prazo: p.orderTiming === "SCHEDULED" ? "AGENDADO" : "IMEDIATO",
      previsaoData: data ? new Date(diaNoFuso(data, fuso) + "T00:00:00Z") : null,
      previsaoJanela: horarios.janela,
      compradorSnapshot: { nome: texto(cliente.name, 300) || "Cliente não informado pelo iFood", documento: texto(cliente.documentNumber, 30) || null },
      destinatarioSnapshot: { nome: texto(cliente.name, 300), contato: texto(telefone.number, 40), localizador: texto(telefone.localizer, 80), localizadorExpiraEm: texto(telefone.localizerExpiration, 50) },
      enderecoSnapshot: end ? { logradouro: texto(end.streetName, 300), numero: texto(end.streetNumber, 30), complemento: texto(end.complement, 300), bairro: texto(end.neighborhood, 100), cidade: texto(end.city, 100), uf: texto(end.state, 20), cep: texto(end.postalCode, 20), referencia: texto(end.reference, 300) } : null,
      observacoes: texto(p.extraInfo) || null, formaPagamentoInformada: "IFOOD", pagamentoInformadoSnapshot: { origem: "IFOOD", metodos, prepaid: moeda(pagamentos.prepaid).toFixed(2), pending: moeda(pagamentos.pending).toFixed(2), repasseConfirmado: false },
      subtotal: subtotal.toFixed(2), frete: frete.toFixed(2), desconto: desconto.toFixed(2), outrosCustos: outrosCustos.toFixed(2), total: quantia.toFixed(2),
    },
    // Snapshot necessário para operação/reconciliação; cifra em repouso, nunca enviado bruto à UI.
    snapshot: { ...p, items: p.items, payments: p.payments, benefits: p.benefits ?? [] },
  };
}
export type PedidoAdaptado = ReturnType<typeof adaptarPedido>;
