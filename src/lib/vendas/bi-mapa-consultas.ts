import "server-only";
import { consumirChamadaMapasEntrega } from "./entregas";
import { integracaoMapasPronta } from "./entregas-mapas";
import type { GrupoMapaBi, PontoMapaBi, ResultadoMapaBi } from "./bi-mapa-types";

type Objeto = Record<string, unknown>;
type DependenciasMapaBi = {
  requisitar?: typeof fetch; consumir?: (usuarioId: string) => Promise<void>;
  pronta?: () => boolean; chave?: string; agora?: () => Date; timeoutMs?: number;
};
type Consulta = { grupo: GrupoMapaBi; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null };
const objeto = (v: unknown): Objeto => v && typeof v === "object" && !Array.isArray(v) ? v as Objeto : {};
const normal = (v: string) => v.normalize("NFKD").replace(/\p{M}/gu, "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR");

/** Recebe grupos próprios do servidor, nunca uma consulta geográfica enviada pelo navegador. */
function validarGrupo(grupo: GrupoMapaBi): Consulta | null {
  if (!grupo || typeof grupo.chave !== "string" || !grupo.chave || grupo.chave.length > 500 || typeof grupo.consulta !== "string" || grupo.consulta.length > 450 || /[\u0000-\u001f]/u.test(grupo.consulta) || !Number.isSafeInteger(grupo.pedidos) || grupo.pedidos <= 0) return null;
  if (grupo.precisao === "cep") {
    const m = /^(?:CEP )?(\d{5})-?(\d{3})(?:,\s*([^,]+),\s*([A-Z]{2}))?,\s*Brasil$/iu.exec(grupo.consulta);
    return m ? { grupo, cep: `${m[1]}${m[2]}`, bairro: null, cidade: m[3]?.trim() || null, uf: m[4]?.toUpperCase() || null } : null;
  }
  if (grupo.precisao !== "bairro") return null;
  const m = /^([^,]+),\s*([^,]+?)(?:\s+-\s+|,\s*)([A-Z]{2}),\s*Brasil$/iu.exec(grupo.consulta);
  return m ? { grupo, bairro: m[1].trim(), cidade: m[2].trim(), uf: m[3].toUpperCase(), cep: null } : null;
}

function pontoComprovado(resposta: Objeto, consulta: Consulta): PontoMapaBi | null {
  if (!Array.isArray(resposta.results)) return null;
  const candidatos = resposta.results.map(objeto).filter(resultado => {
    if (resultado.partial_match === true || !Array.isArray(resultado.address_components) || !Array.isArray(resultado.types)) return false;
    const componentes = resultado.address_components.map(objeto);
    const corresponde = (tipos: string[], esperado: string, curto = false) => componentes.some(c => Array.isArray(c.types) && c.types.some(t => tipos.includes(String(t))) && typeof c[curto ? "short_name" : "long_name"] === "string" && normal(c[curto ? "short_name" : "long_name"] as string) === normal(esperado));
    if (!corresponde(["country"], "BR", true)) return false;
    if (consulta.uf && !corresponde(["administrative_area_level_1"], consulta.uf, true)) return false;
    if (consulta.cidade && !corresponde(["locality", "administrative_area_level_2"], consulta.cidade)) return false;
    if (consulta.cep) return resultado.types.includes("postal_code") && componentes.some(c => Array.isArray(c.types) && c.types.includes("postal_code") && typeof c.long_name === "string" && c.long_name.replace(/\D/gu, "") === consulta.cep);
    const tiposBairro = ["neighborhood", "sublocality", "sublocality_level_1", "sublocality_level_2", "sublocality_level_3"];
    return resultado.types.some(t => tiposBairro.includes(String(t))) && !!consulta.bairro && corresponde(tiposBairro, consulta.bairro);
  });
  // Um retorno ambíguo fica sem ponto. Nunca se escolhe uma cidade/bairro homônimo.
  if (candidatos.length !== 1) return null;
  const local = objeto(objeto(candidatos[0].geometry).location), latitude = local.lat, longitude = local.lng;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { chave: consulta.grupo.chave, nome: consulta.grupo.chave, latitude, longitude, pedidos: consulta.grupo.pedidos, precisao: consulta.grupo.precisao, origem: "GOOGLE_MAPS" };
}

/** Geocodifica até dez regiões; resposta transitória, sem cache, endereços pessoais ou gravações comerciais. */
export async function consultarMapaBi(grupos: GrupoMapaBi[], contexto: { usuarioId: string; totalEntregas: number }, dependencias: DependenciasMapaBi = {}): Promise<ResultadoMapaBi> {
  const agora = dependencias.agora ?? (() => new Date()), inicio = agora();
  const resultado: ResultadoMapaBi = { estado: "sem-dados", pontos: [], totalEntregas: contexto.totalEntregas, entregasLocalizadas: 0, totalGrupos: grupos.length, gruposConsultados: 0, limiteGrupos: 10, atualizadoEm: inicio.toISOString(), validoAte: new Date(inicio.getTime() + 600000).toISOString(), avisos: ["Áreas aproximadas por bairro ou CEP. Os pontos não são endereços de entrega confirmados. Dados Google disponíveis por dez minutos, sem retenção no HUB."] };
  const vistos = new Set<string>(), consultas = grupos.flatMap(grupo => {
    const c = validarGrupo(grupo);
    if (!c || vistos.has(grupo.chave)) return [];
    vistos.add(grupo.chave); return [c];
  }).sort((a, b) => b.grupo.pedidos - a.grupo.pedidos || a.grupo.chave.localeCompare(b.grupo.chave, "pt-BR")).slice(0, 10);
  if (!consultas.length) { resultado.avisos.push("Não há grupos de destinos com bairro/cidade/UF ou CEP suficientes nesta seleção. Endereços de cobrança não foram usados."); return resultado; }
  const chave = dependencias.chave ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!(dependencias.pronta ?? integracaoMapasPronta)() || !chave) { resultado.estado = "indisponivel"; resultado.avisos.push("Integração Google Maps indisponível. Nenhuma API ou configuração foi ativada pela consulta."); return resultado; }
  const consumir = dependencias.consumir ?? consumirChamadaMapasEntrega, requisitar = dependencias.requisitar ?? fetch;
  let proximo = 0, interromper = false, falhas = 0;
  const consultar = async (consulta: Consulta) => {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("key", chave); url.searchParams.set("language", "pt-BR"); url.searchParams.set("region", "br");
    url.searchParams.set("components", consulta.cep ? `country:BR|postal_code:${consulta.cep}` : "country:BR");
    if (!consulta.cep) url.searchParams.set("address", consulta.grupo.consulta);
    for (let tentativa = 0; tentativa < 2 && !interromper; tentativa++) {
      try { await consumir(contexto.usuarioId); } catch { interromper = true; falhas++; return; }
      if (tentativa === 0) resultado.gruposConsultados++;
      const abortar = new AbortController(), timer = setTimeout(() => abortar.abort(), dependencias.timeoutMs ?? 6000);
      try {
        // A URL privada e a resposta Google não integram logs, snapshots ou auditorias.
        const r = await requisitar(url.toString(), { cache: "no-store", signal: abortar.signal });
        if ((r.status === 429 || r.status >= 500) && tentativa === 0) continue;
        if (!r.ok) { falhas++; if (r.status === 401 || r.status === 403 || r.status === 429) interromper = true; return; }
        const corpo = objeto(await r.json());
        if (corpo.status === "UNKNOWN_ERROR" && tentativa === 0) continue;
        if (["OVER_DAILY_LIMIT", "OVER_QUERY_LIMIT", "REQUEST_DENIED", "INVALID_REQUEST"].includes(String(corpo.status))) { interromper = true; falhas++; return; }
        if (corpo.status !== "OK") { falhas++; return; }
        const ponto = pontoComprovado(corpo, consulta);
        if (ponto) resultado.pontos.push(ponto); else falhas++;
        return;
      } catch { if (tentativa === 1) falhas++; }
      finally { clearTimeout(timer); }
    }
  };
  const executar = async () => {
    while (!interromper && proximo < consultas.length) { const consulta = consultas[proximo++]; await consultar(consulta); }
  };
  await Promise.all([executar(), executar()]);
  resultado.pontos.sort((a, b) => b.pedidos - a.pedidos || a.chave.localeCompare(b.chave, "pt-BR"));
  resultado.entregasLocalizadas = resultado.pontos.reduce((soma, p) => soma + p.pedidos, 0);
  resultado.estado = !resultado.pontos.length ? "indisponivel" : falhas || grupos.length > consultas.length || resultado.entregasLocalizadas < contexto.totalEntregas ? "parcial" : "pronto";
  if (grupos.length > consultas.length) resultado.avisos.push("O mapa consulta no máximo dez grupos por solicitação, em ordem de quantidade de pedidos.");
  if (falhas || interromper) resultado.avisos.push("Parte das regiões não foi localizada com segurança ou a cota/integração está indisponível. Nenhum ponto foi estimado para preencher a cobertura.");
  return resultado;
}
