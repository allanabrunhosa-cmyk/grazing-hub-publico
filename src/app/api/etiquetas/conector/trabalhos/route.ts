import { autenticarDispositivo, reservarProximoEnvio } from "@/lib/etiquetas/pontos";
import { assinarFilaPonto } from "@/lib/etiquetas/pontos-espera";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) return new Response(null, { status: 401 });
  if (!dispositivo.ponto.impressoraSelecionadaId || !dispositivo.impressoraDetectada) return Response.json({ trabalho: null, motivo: "IMPRESSORA_INDISPONIVEL" }, { headers });
  const espera = new URL(request.url).searchParams.get("espera") === "20";
  // Assinar antes da consulta elimina a janela entre procurar e começar a esperar.
  const assinatura = espera ? await assinarFilaPonto(dispositivo.pontoId, request.signal) : null;
  if (espera && !assinatura) return new Response(null, { status: 429, headers: { ...headers, "Retry-After": "1" } });
  const limite = Date.now() + (espera ? 20_000 : 0);
  try {
    do {
      // Revalidar revogação e impressora após cada despertar; não confiar no início.
      const atual = espera ? await autenticarDispositivo(request) : dispositivo;
      if (!atual) return new Response(null, { status: 401, headers });
      if (!atual.ponto.impressoraSelecionadaId || !atual.impressoraDetectada) return Response.json({ trabalho: null, motivo: "IMPRESSORA_INDISPONIVEL" }, { headers });
      if (request.signal.aborted) return new Response(null, { status: 499, headers });
      const envio = await reservarProximoEnvio(atual.pontoId, atual.ponto.lojaId);
      if (envio || !assinatura || Date.now() >= limite) return Response.json({ trabalho: envio ? { id: envio.id, zpl: envio.zpl, impressoraId: atual.ponto.impressoraSelecionadaId } : null, esperaAtiva: espera }, { headers });
      // Reconferência de segurança recupera notificações perdidas após reconexão.
      await assinatura.aguardar(Math.min(assinatura.intervaloRevisao(), Math.max(0, limite - Date.now())));
    } while (!request.signal.aborted);
    return new Response(null, { status: 499, headers });
  } finally { assinatura?.fechar(); }
}
