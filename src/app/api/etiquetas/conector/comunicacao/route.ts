import { prisma } from "@/lib/prisma";
import { autenticarDispositivo } from "@/lib/etiquetas/pontos";
import { lerJsonLimitado } from "@/lib/etiquetas/pontos-payload";

const texto = (valor: unknown, maximo: number) => typeof valor === "string" ? valor.trim().slice(0, maximo) || null : null;
const endereco = (valor: unknown) => { const recebido = texto(valor, 45); return recebido && /^[0-9a-fA-F:.]+$/.test(recebido) ? recebido : null; };

export async function POST(request: Request) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) return new Response(null, { status: 401 });
  const corpo = await lerJsonLimitado(request, 4096);
  if (!corpo || typeof corpo !== "object") return new Response(null, { status: 400 });
  const usbImpressoras = Array.isArray(corpo.usbImpressoras) ? corpo.usbImpressoras.slice(0, 8).filter((item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const valor = item as Record<string, unknown>;
    return typeof valor.id === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/.test(valor.id) && typeof valor.nome === "string" && valor.nome.length <= 100;
  }).map((item: { id: string; nome: string }) => ({ id: item.id, nome: item.nome })) : [];
  const wifiRedes = Array.isArray(corpo.wifiRedes) ? corpo.wifiRedes.slice(0, 20).filter((item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const valor = item as Record<string, unknown>;
    return typeof valor.ssid === "string" && valor.ssid.length <= 100 && Number.isInteger(valor.frequenciaMhz) && Number(valor.frequenciaMhz) >= 2400 && Number(valor.frequenciaMhz) <= 2500;
  }).map((item: { ssid: string; frequenciaMhz: number }) => ({ ssid: item.ssid, frequenciaMhz: item.frequenciaMhz })) : [];
  const selecionada = dispositivo.ponto.impressoraSelecionadaId;
  const detectada = !!selecionada && usbImpressoras.some((item: { id: string }) => item.id === selecionada);
  const vistoEm = new Date();
  const frequencia = corpo.wifiFrequenciaMhz;
  await prisma.dispositivoImpressao.update({ where: { id: dispositivo.id }, data: {
    hostname: texto(corpo.hostname, 80), modelo: texto(corpo.modelo, 100), sistema: texto(corpo.sistema, 100), arquitetura: texto(corpo.arquitetura, 40),
    usbImpressoras, impressoraDetectada: detectada,
    wifiSsid: texto(corpo.wifiSsid, 100), wifiFrequenciaMhz: typeof frequencia === "number" && Number.isInteger(frequencia) && frequencia >= 2400 && frequencia <= 6000 ? frequencia : null, wifiRedes,
    wifiEndereco: endereco(corpo.wifiEndereco), ethernetEndereco: endereco(corpo.ethernetEndereco), vistoEm,
  } });
  return Response.json({ recebidoEm: vistoEm.toISOString(), impressoraSelecionadaId: selecionada, impressoraDetectada: detectada }, { headers: { "Cache-Control": "no-store" } });
}
