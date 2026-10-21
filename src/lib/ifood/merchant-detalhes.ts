import { ErroIfood, objeto, texto, uuid } from "./dominio";

const opcional = (v: unknown, limite = 200) => texto(v, limite).trim() || null;
const numero = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
function lista(v: unknown) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 100) throw new ErroIfood("Detalhes da loja fora do contrato.");
  return v.map(objeto);
}

// Projeção explícita: não enviar o payload completo, campos extras ou credenciais ao navegador.
export function lerDetalhesMerchant(entrada: unknown, merchantId: string) {
  const m = objeto(entrada), id = uuid(m.id);
  if (id !== uuid(merchantId)) throw new ErroIfood("Detalhes recebidos de outra loja; consulte novamente.");
  const a = m.address == null ? null : objeto(m.address);
  return {
    id, nome: opcional(m.name), razaoSocial: opcional(m.corporateName), descricao: opcional(m.description, 4000),
    tipo: opcional(m.type, 80), estadoCadastro: opcional(m.status, 80), criadoEm: opcional(m.createdAt, 80),
    ticketMedio: numero(m.averageTicket), exclusivo: typeof m.exclusive === "boolean" ? m.exclusive : null,
    teste: typeof m.test === "boolean" ? m.test : opcional(m.test, 80),
    endereco: a ? {
      pais: opcional(a.country, 80), estado: opcional(a.state, 80), cidade: opcional(a.city), bairro: opcional(a.district),
      rua: opcional(a.street), numero: typeof a.number === "number" && Number.isSafeInteger(a.number) ? String(a.number) : opcional(a.number, 80),
      complemento: opcional(a.complement), cep: opcional(a.postalCode, 32), latitude: numero(a.latitude), longitude: numero(a.longitude),
    } : null,
    operacoes: lista(m.operations).map(o => ({
      nome: opcional(o.name, 80), canais: lista(o.salesChannels).map(c => ({ nome: opcional(c.name, 80), habilitado: typeof c.enabled === "boolean" ? c.enabled : null })),
    })),
  };
}
export type DetalhesMerchant = ReturnType<typeof lerDetalhesMerchant>;
