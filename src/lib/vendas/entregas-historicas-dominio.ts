import { hashCanonico } from "./historico-dominio";

type Objeto = Record<string, unknown>;
export const SPREADSHEET_ENTREGAS_HISTORICAS = "1cnzdQX_6HL3fEtxFeF28B7PNOzL3_dDtOnT-YVM6e-Y";
export const SHEET_ENTREGAS_HISTORICAS = 923392872;
export type LinhaFonteEntregaHistorica = { linha: number; numero: string; endereco: string | null };
export type FonteEntregasHistoricas = {
  origem: "google-sheets-entrega"; spreadsheetId: string; sheetId: number; aba: "Orders";
  faixa: string; consultadoEm: string; colunas: { I: "Full Address (Shipping)"; J: "Número do pedido" };
  linhas: LinhaFonteEntregaHistorica[];
};
type ProvaPostal = { fragmento: number | null; regra: string; confirmado: true; origem?: "SHIPPING" | "VIACEP"; precisao?: "postal" };
export type PostalEntregasHistoricas = { versao: 1; origem: "VIACEP"; consultadoEm: string; resultados: Record<string, { cep: string; bairro: string; cidade: string; uf: string; consultadoEm: string } | { erro: string }> };
export type EntregaHistorica = {
  versao: 1; origem: "google-sheets-shipping"; modalidade: "ENTREGA_INFORMADA" | "RETIRADA";
  criterioModalidade: "CAMPO_FULL_ADDRESS_SHIPPING" | "USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE";
  enderecoOriginal: string | null; cep: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  provas: Partial<Record<"cep" | "bairro" | "cidade" | "uf", ProvaPostal>>;
  postal?: { origem: "VIACEP"; cep: string; consultadoEm: string; fonteSha256: string; resultadoSha256: string; compativel: boolean; conflitos: string[] };
  proveniencia: {
    spreadsheetId: string; sheetId: number; aba: "Orders"; colunaEndereco: "I"; cabecalhoEndereco: "Full Address (Shipping)";
    colunaNumero: "J"; linha: number; numeroOriginal: string; fonteSha256: string; conteudoSha256: string; linhaSha256: string; consultadoEm: string;
  };
};
const objeto = (v: unknown): Objeto => v && typeof v === "object" && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v)) ? v as Objeto : {};
function falhar(codigo: string): never { throw Error(`ENTREGAS_HISTORICAS_${codigo}`); }
const hex = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);
const normal = (v: string) => v.normalize("NFKD").replace(/\p{M}/gu, "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR");
const siglas = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const estados = new Map("Acre|Alagoas|Amapá|Amazonas|Bahia|Ceará|Distrito Federal|Espírito Santo|Goiás|Maranhão|Mato Grosso|Mato Grosso do Sul|Minas Gerais|Pará|Paraíba|Paraná|Pernambuco|Piauí|Rio de Janeiro|Rio Grande do Norte|Rio Grande do Sul|Rondônia|Roraima|Santa Catarina|São Paulo|Sergipe|Tocantins".split("|").map((nome, i) => [normal(nome), siglas[i]]));
const cepDoFragmento = (v: string) => /^(?:CEP\s*[:=-]?\s*)?(\d{5})-?(\d{3})$/iu.exec(v);

/** Só campos rotulados ou bloco postal terminal. Rua, destinatário e bairro solto não são inferidos. */
export function analisarEnderecoShippingHistorico(original: string | null) {
  const saida: Pick<EntregaHistorica, "modalidade" | "criterioModalidade" | "cep" | "bairro" | "cidade" | "uf" | "provas"> = { modalidade: original?.trim() ? "ENTREGA_INFORMADA" : "RETIRADA", criterioModalidade: original?.trim() ? "CAMPO_FULL_ADDRESS_SHIPPING" : "USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE", cep: null, bairro: null, cidade: null, uf: null, provas: {} };
  if (!original?.trim()) return saida;
  const fragmentos = original.replace(/<br\s*\/?\s*>/giu, "\n").split(/\r?\n/gu).map(s => s.trim()).filter(Boolean);
  if (fragmentos.length > 40) return saida;
  const prova = (campo: "cep" | "bairro" | "cidade" | "uf", valor: string, fragmento: number, regra: string) => { saida[campo] = valor; saida.provas[campo] = { fragmento, regra, confirmado: true }; };
  const rotulos = (campo: "bairro" | "cidade", re: RegExp) => {
    const achados = fragmentos.flatMap((texto, indice) => { const m = re.exec(texto); return m && m[1].trim().length <= 120 ? [{ texto: m[1].trim(), indice }] : []; });
    if (new Set(achados.map(a => normal(a.texto))).size === 1) prova(campo, achados[0].texto, achados[0].indice, `rotulo_${campo}_shipping`);
  };
  rotulos("bairro", /^Bairro\s*[:=-]\s*(.+)$/iu); rotulos("cidade", /^(?:Cidade|Munic[ií]pio)\s*[:=-]\s*(.+)$/iu);
  let fim = fragmentos.length - 1;
  if (/^(?:Brasil|Brazil)$/iu.test(fragmentos[fim])) fim--;
  const cep = fim >= 0 ? cepDoFragmento(fragmentos[fim]) : null;
  if (!cep) return saida;
  const estadoTexto = fragmentos[fim - 1], ufExtensa = estadoTexto ? estados.get(normal(estadoTexto)) : null;
  const ufRotulada = estadoTexto ? /^(?:UF|Estado)\s*[:=-]\s*([A-Z]{2})$/iu.exec(estadoTexto)?.[1].toUpperCase() : null;
  const municipioUf = estadoTexto ? /^([\p{L} .'-]{2,120})\s*[-–,]\s*([A-Z]{2})$/iu.exec(estadoTexto) : null;
  const uf = ufExtensa ?? (ufRotulada && siglas.includes(ufRotulada) ? ufRotulada : null) ?? (municipioUf && siglas.includes(municipioUf[2].toUpperCase()) ? municipioUf[2].toUpperCase() : null);
  // O CEP terminal é postal quando há UF inequívoca imediatamente antes dele.
  if (!uf) return saida;
  prova("cep", `${cep[1]}${cep[2]}`, fim, "cep_terminal_shipping_com_uf"); prova("uf", uf, fim - 1, "uf_terminal_shipping");
  const cidadeIndice = municipioUf ? fim - 1 : fim - 2;
  const cidadeOriginal = municipioUf?.[1].trim() ?? fragmentos[cidadeIndice];
  const cidadeComUf = cidadeOriginal ? /^([\p{L} .'-]{2,120})\s*[-–,]\s*([A-Z]{2})$/iu.exec(cidadeOriginal) : null;
  const cidade = cidadeComUf ? cidadeComUf[1].trim() : cidadeOriginal;
  if (cidadeComUf && cidadeComUf[2].toUpperCase() !== uf || saida.cidade && cidade && /^[\p{L} .'-]{2,120}$/u.test(cidade) && normal(saida.cidade) !== normal(cidade)) return { ...saida, cep: null, bairro: null, cidade: null, uf: null, provas: {} };
  if (!saida.cidade && cidadeIndice >= 2 && cidade && /^[\p{L} .'-]{2,120}$/u.test(cidade) && !/^(?:Brasil|Brazil)$/iu.test(cidade) && (!cidadeComUf || cidadeComUf[2].toUpperCase() === uf)) prova("cidade", cidade, cidadeIndice, "municipio_no_bloco_terminal_shipping");
  return saida;
}

export function validarFonteEntregasHistoricas(valor: unknown): FonteEntregasHistoricas {
  const v = objeto(valor), colunas = objeto(v.colunas);
  if (v.origem !== "google-sheets-entrega" || v.spreadsheetId !== SPREADSHEET_ENTREGAS_HISTORICAS || v.sheetId !== SHEET_ENTREGAS_HISTORICAS || v.aba !== "Orders" || typeof v.faixa !== "string" || !/^I2:J[0-9]{1,7}$/u.test(v.faixa) || typeof v.consultadoEm !== "string" || !/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/u.test(v.consultadoEm) || !Number.isFinite(Date.parse(v.consultadoEm)) || colunas.I !== "Full Address (Shipping)" || colunas.J !== "Número do pedido" || Object.keys(colunas).length !== 2 || !Array.isArray(v.linhas) || !v.linhas.length || v.linhas.length > 100000) falhar("FONTE_INVALIDA");
  const fim = Number(v.faixa.slice(4)), numeros = new Set<string>(), posicoes = new Set<number>();
  const linhas = v.linhas.map(valorLinha => {
    const linha = objeto(valorLinha);
    if (Object.keys(linha).some(k => !["linha", "numero", "endereco"].includes(k)) || !Number.isSafeInteger(linha.linha) || Number(linha.linha) < 2 || Number(linha.linha) > fim || typeof linha.numero !== "string" || !/^[1-9][0-9]{0,29}$/u.test(linha.numero) || linha.endereco !== null && (typeof linha.endereco !== "string" || linha.endereco.length > 6000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(linha.endereco)) || numeros.has(linha.numero) || posicoes.has(Number(linha.linha))) return falhar("LINHA_INVALIDA_OU_DUPLICADA");
    numeros.add(linha.numero); posicoes.add(Number(linha.linha));
    return { linha: Number(linha.linha), numero: linha.numero, endereco: linha.endereco as string | null };
  });
  return { origem: "google-sheets-entrega", spreadsheetId: SPREADSHEET_ENTREGAS_HISTORICAS, sheetId: SHEET_ENTREGAS_HISTORICAS, aba: "Orders", faixa: v.faixa, consultadoEm: v.consultadoEm, colunas: { I: "Full Address (Shipping)", J: "Número do pedido" }, linhas };
}
export function validarPostalEntregasHistoricas(valor: unknown): PostalEntregasHistoricas {
  const p = objeto(valor), resultados = objeto(p.resultados);
  if (p.versao !== 1 || p.origem !== "VIACEP" || typeof p.consultadoEm !== "string" || !Number.isFinite(Date.parse(p.consultadoEm)) || !Object.keys(resultados).length || Object.keys(resultados).length > 100000) falhar("POSTAL_INVALIDO");
  const validados: PostalEntregasHistoricas["resultados"] = {};
  for (const [cep, bruto] of Object.entries(resultados)) {
    if (!/^[0-9]{8}$/u.test(cep)) falhar("POSTAL_CEP_INVALIDO");
    const r = objeto(bruto);
    if (typeof r.erro === "string" && r.erro.length <= 500) { validados[cep] = { erro: r.erro }; continue; }
    if (r.cep !== cep || typeof r.bairro !== "string" || r.bairro.length > 120 || typeof r.cidade !== "string" || !r.cidade.trim() || r.cidade.length > 120 || typeof r.uf !== "string" || !siglas.includes(r.uf) || typeof r.consultadoEm !== "string" || !Number.isFinite(Date.parse(r.consultadoEm)) || /[\u0000-\u001f]/u.test(`${r.bairro}${r.cidade}`)) falhar("POSTAL_RESULTADO_INVALIDO");
    validados[cep] = { cep, bairro: r.bairro.trim(), cidade: r.cidade.trim(), uf: r.uf, consultadoEm: r.consultadoEm };
  }
  return { versao: 1, origem: "VIACEP", consultadoEm: p.consultadoEm, resultados: validados };
}
export function hashEntradaFonteEntregasHistoricas(fonte: unknown, fonteSha256: string, postal?: unknown, postalSha256?: string) {
  if (!hex(fonteSha256)) falhar("HASH_FONTE_INVALIDO");
  if ((postal === undefined) !== (postalSha256 === undefined) || postalSha256 !== undefined && !hex(postalSha256)) falhar("HASH_POSTAL_INVALIDO");
  return hashCanonico({ fonte: validarFonteEntregasHistoricas(fonte), fonteSha256, postal: postal === undefined ? null : validarPostalEntregasHistoricas(postal), postalSha256: postalSha256 ?? null });
}
export function criarEntregaHistorica(fonte: FonteEntregasHistoricas, linha: LinhaFonteEntregaHistorica, fonteSha256: string, postal?: PostalEntregasHistoricas, postalSha256?: string, conteudoSha256 = hashCanonico(fonte)): EntregaHistorica {
  if (!hex(fonteSha256)) falhar("HASH_FONTE_INVALIDO");
  const entrega: EntregaHistorica = { versao: 1, origem: "google-sheets-shipping", enderecoOriginal: linha.endereco, ...analisarEnderecoShippingHistorico(linha.endereco), proveniencia: { spreadsheetId: fonte.spreadsheetId, sheetId: fonte.sheetId, aba: "Orders", colunaEndereco: "I", cabecalhoEndereco: "Full Address (Shipping)", colunaNumero: "J", linha: linha.linha, numeroOriginal: linha.numero, fonteSha256, conteudoSha256, linhaSha256: hashCanonico(linha), consultadoEm: fonte.consultadoEm } };
  const referencia = entrega.cep ? postal?.resultados[entrega.cep] : null;
  if (entrega.cep && referencia && "cep" in referencia && postalSha256 && hex(postalSha256)) {
    const conflitos = [entrega.uf && entrega.uf !== referencia.uf ? "UF_DIVERGENTE" : null, entrega.cidade && normal(entrega.cidade) !== normal(referencia.cidade) ? "CIDADE_DIVERGENTE" : null, entrega.bairro && referencia.bairro && normal(entrega.bairro) !== normal(referencia.bairro) ? "BAIRRO_DIVERGENTE" : null].filter((v): v is string => v !== null);
    entrega.postal = { origem: "VIACEP", cep: entrega.cep, consultadoEm: referencia.consultadoEm, fonteSha256: postalSha256, resultadoSha256: hashCanonico(referencia), compativel: !conflitos.length, conflitos };
    if (!conflitos.length) for (const campo of ["bairro", "cidade", "uf"] as const) if (!entrega[campo] && referencia[campo]) {
      entrega[campo] = referencia[campo]; entrega.provas[campo] = { fragmento: null, regra: `${campo}_postal_viacep`, confirmado: true, origem: "VIACEP", precisao: "postal" };
    }
  }
  return entrega;
}

/** Leitura da projeção segura do banco. Nunca recebe/copia o endereço pessoal para o DTO BI. */
export function entregaHistoricaProjetadaValida(valor: unknown, numeroOriginal: string | null) {
  const e = objeto(valor), p = objeto(e.proveniencia), provas = objeto(e.provas);
  if (e.versao !== 1 || e.origem !== "google-sheets-shipping" || !["ENTREGA_INFORMADA", "RETIRADA"].includes(String(e.modalidade)) || p.spreadsheetId !== SPREADSHEET_ENTREGAS_HISTORICAS || p.sheetId !== SHEET_ENTREGAS_HISTORICAS || p.aba !== "Orders" || p.colunaEndereco !== "I" || p.cabecalhoEndereco !== "Full Address (Shipping)" || p.colunaNumero !== "J" || p.numeroOriginal !== numeroOriginal || !Number.isSafeInteger(p.linha) || Number(p.linha) < 2 || !hex(p.fonteSha256) || !hex(p.conteudoSha256) || !hex(p.linhaSha256)) return null;
  if (e.modalidade === "RETIRADA") return e.temShipping === false && e.criterioModalidade === "USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE" ? { modalidade: "RETIRADA" as const, cep: null, bairro: null, cidade: null, uf: null, bairroPostal: false } : null;
  if (e.temShipping !== true || e.criterioModalidade !== "CAMPO_FULL_ADDRESS_SHIPPING") return null;
  const postal = objeto(e.postal);
  const campo = (chave: "cep" | "bairro" | "cidade" | "uf", limite: number) => {
    const prova = objeto(provas[chave]);
    if (typeof e[chave] !== "string" || (e[chave] as string).length > limite || prova.confirmado !== true) return null;
    if (prova.origem === "VIACEP" && (postal.origem !== "VIACEP" || postal.compativel !== true || postal.cep !== e.cep || !hex(postal.fonteSha256) || !hex(postal.resultadoSha256))) return null;
    return e[chave] as string;
  };
  const cep = campo("cep", 8), uf = campo("uf", 2), bairro = campo("bairro", 120), cidade = campo("cidade", 120);
  const postalCompativel = postal.origem === "VIACEP" && postal.compativel === true && postal.cep === cep && hex(postal.fonteSha256) && hex(postal.resultadoSha256);
  return { modalidade: "ENTREGA" as const, cep: cep && /^[0-9]{8}$/u.test(cep) ? cep : null, bairro, cidade, uf: uf && siglas.includes(uf) ? uf : null, bairroPostal: !!(bairro || cidade) && postalCompativel };
}
