import "server-only";
import { prisma } from "@/lib/prisma";
import { listarPedidos } from "./pedidos";
import { diaNoFuso, diaValido, periodoCalendario } from "./pedidos-agenda-dominio";

export async function consultarCalendario(data?: string, visao = "mes") {
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
  const fuso = loja?.fusoHorario ?? "America/Sao_Paulo";
  const dia = diaValido(data) ? data : diaNoFuso(new Date(), fuso);
  const periodo = periodoCalendario(dia, visao);
  const filtro = { baseData: "entrega", de: periodo.inicio, ate: periodo.fim, status: "CONFIRMADO" };
  const primeiro = await listarPedidos(filtro);
  const pedidos = [...primeiro.pedidos];
  for (let pagina = 2; pagina <= primeiro.paginas; pagina++) pedidos.push(...(await listarPedidos({ ...filtro, pagina })).pedidos);
  pedidos.sort((a, b) => (a.previsaoJanela ?? "").localeCompare(b.previsaoJanela ?? "") || a.numero - b.numero);
  return { ...periodo, fuso, dia, pedidos };
}
