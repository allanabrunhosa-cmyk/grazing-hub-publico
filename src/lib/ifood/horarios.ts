import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";
import { instante, objeto } from "./dominio";

/** Campos independentes do contrato Food. O calendário usa o início da janela
 * apenas como referência civil; nunca como promessa de entrega em hora exata. */
export function horariosPedidoIfood(valor: unknown, fuso: string) {
  const p = objeto(valor), schedule = p.schedule ? objeto(p.schedule) : {};
  const inicioPreparo = p.preparationStartDateTime ? instante(p.preparationStartDateTime) : null;
  const janelaInicio = schedule.deliveryDateTimeStart ? instante(schedule.deliveryDateTimeStart) : null;
  const janelaFim = schedule.deliveryDateTimeEnd ? instante(schedule.deliveryDateTimeEnd) : null;
  const modalidade = p.orderType === "TAKEOUT" ? p.takeout : p.orderType === "DELIVERY" ? p.delivery : p.orderType === "INDOOR" ? p.indoor : p.dineIn;
  const m = modalidade ? objeto(modalidade) : {};
  const entregaRetirada = m.takeoutDateTime || m.deliveryDateTime ? instante(m.takeoutDateTime ?? m.deliveryDateTime) : null;
  const agendado = p.orderTiming === "SCHEDULED";
  const referencia = janelaInicio ?? entregaRetirada;
  const hora = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const dataHora = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const janela = janelaInicio && janelaFim
    ? diaNoFuso(janelaInicio, fuso) === diaNoFuso(janelaFim, fuso)
      ? `${hora(janelaInicio)}–${hora(janelaFim)}`
      : `${dataHora(janelaInicio)} – ${dataHora(janelaFim)}`
    : janelaInicio ? `A partir de ${hora(janelaInicio)}; fim não informado` : janelaFim ? `Até ${dataHora(janelaFim)}; início não informado` : referencia ? hora(referencia) : null;
  const problemas: string[] = [];
  if (agendado && (!inicioPreparo || !referencia)) problemas.push("Agendamento sem horários completos");
  if (agendado && inicioPreparo && inicioPreparo < instante(p.createdAt)) problemas.push("Início de preparo anterior à criação do pedido agendado");
  if (janelaInicio && janelaFim && janelaFim < janelaInicio) problemas.push("Fim da janela anterior ao início");
  if (inicioPreparo && (janelaFim ?? entregaRetirada) && inicioPreparo > (janelaFim ?? entregaRetirada)!) problemas.push("Preparo posterior à previsão de entrega/retirada");
  return { agendado, inicioPreparo, entregaRetirada, janelaInicio, janelaFim, referencia, janela, problemas };
}
