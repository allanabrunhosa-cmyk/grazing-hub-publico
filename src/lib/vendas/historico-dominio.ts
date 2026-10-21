import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { validarComplementoRegistro, type ComplementoRegistro } from "./historico-complemento";

export const ORIGEM_HISTORICA = "grazing-legado-orders";
export const LOJA_HISTORICA = "grazing-hub";
const Decimal = Prisma.Decimal.clone({ precision: 50 });
type Json = null | boolean | number | string | Json[] | { [chave: string]: Json };
type Aberto = { [campo: string]: unknown };
export type DataHistorica = Aberto & {
  serial_original: string; local_exato: string; local_segundo: string; exibicao_minuto: string;
  mes: string; fuso_hipotese: string; conversao_fuso_aplicada: boolean; metodo: string;
};
export type ItemHistorico = Aberto & {
  bloco: number; colunas: string[]; linha: number; originais: (string | null)[];
  nome_original: string | null; nome_normalizado: string; chave_nome: string;
  quantidade: string | null; preco_unitario_liquido: string | null; desconto_linha: string | null;
  desconto_ausente: boolean; liquido_linha: string | null; bruto_linha_reconstruido: string | null;
  incompleto: boolean; produto_externo_nao_identificado: boolean;
  consumo_apurado: unknown; custo_historico_comprovado: unknown;
};
export type TotaisHistoricos = Aberto & {
  liquido_itens: string; desconto_itens: string; bruto_reconstruido: string;
  subtotal_produtos_original: string; frete_ajuste_original: string; total_original: string;
  total_calculado_itens_mais_frete: string; diferenca_produtos: string; diferenca_total: string;
  valor_historico_nao_detalhado: string; diferenca_total_apos_nao_detalhado: string;
  frete_classificacao: string; custo_logistico: unknown; zero_final_preservado: boolean;
};
export type EmailHistorico = Aberto & { origem: string; original: string | null; normalizado: string | null; valido_sintaticamente: boolean };
export type TelefoneHistorico = Aberto & {
  origem: string; original: string | null; digitos_preservados: string | null;
  pais_explicito: string | null; e164: string | null; normalizacao: string; plausivel: boolean;
};
export type CompradorHistorico = Aberto & {
  nome_cobranca: string | null; nome_usuario_original: string | null; empresa: string | null;
  emails: EmailHistorico[]; telefones: TelefoneHistorico[]; identificavel: boolean;
  identidade_candidata?: string; regra_identidade?: string; conflitos_identidade?: string[];
};
export type EnderecoHistorico = Aberto & { origem: string; original: string | null; texto: string | null; finalidade: string; entrega_confirmada: boolean };
export type RegistroHistorico = Aberto & {
  linha: number; numero_original: string; origem: string; chave_deduplicacao: string; hash_linha: string;
  raw: Aberto & { linha: number; valores: (string | null)[]; celulas?: Record<string, unknown> };
  data_criacao: DataHistorica; pagamento_informado: DataHistorica | null; liquidacao_comprovada: unknown;
  metodo_pagamento_original: string | null; transaction_id_original: string | null;
  itens: ItemHistorico[]; quantidade_blocos: number; totais: TotaisHistoricos; comprador: CompradorHistorico;
  destinatario: Aberto & { nome_entrega_original: string | null; emails: unknown[]; telefones: unknown[]; contato_comprador_atribuido: boolean };
  enderecos: EnderecoHistorico[]; notas_originais: string | null;
  status: Aberto & { final_legado: string | null; regra: string };
  excecoes: (Aberto & { codigo: string })[]; efeitos_operacionais_autorizados: boolean; estado_importacao: string;
  conflitos_identidade_validados?: string[];
  complemento?: ComplementoRegistro;
};
export type ResumoMensalHistorico = Aberto & {
  mes: string; pedidos: number; pedidos_unicos: number; itens: number; unidades: string;
  pedidos_total_zero: number; fretes_negativos: number; valores: Record<string, string>;
};
export type MetadadosHistoricos = Aberto & {
  sha256: string; origem_identidade_estavel: string; lote_proposto: string;
  registros: number; pedidos_unicos: number; itens: number; unidades: string;
  por_criacao?: ResumoMensalHistorico[]; por_pagamento_informado?: ResumoMensalHistorico[]; date1904?: boolean;
};
export type PacoteHistorico = Aberto & {
  metadados: MetadadosHistoricos; registros: RegistroHistorico[];
  cabecalhos?: Aberto & { linha: number; valores: (string | null)[]; celulas?: Record<string, unknown> };
};

export function ehPedidoHistorico(pedido: { origem?: string | null; referenciaOrigem?: string | null; status?: string | null }): boolean {
  return pedido.referenciaOrigem === ORIGEM_HISTORICA || pedido.origem === "HISTORICO_LEGADO";
}
export function normalizarNome(valor: string): string { return valor.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR"); }
/** A hipótese São Paulo fica explícita. O serial e o horário local não são regravados. */
export function dataHistoricaSaoPaulo(data: DataHistorica): Date {
  if (data.fuso_hipotese !== "America/Sao_Paulo" || !/^202[56]-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(data.local_exato)) throw Error("HISTORICO_DATA_INVALIDA");
  // Date conserva milissegundos. Truncar a fração evita mover o evento para
  // o próximo dia por usar o segundo arredondado de exibição.
  const resultado = new Date(`${data.local_exato.slice(0, 23)}-03:00`);
  if (!Number.isFinite(resultado.getTime())) throw Error("HISTORICO_DATA_INVALIDA");
  return resultado;
}

function jsonCanonico(valor: unknown, ancestrais = new Set<object>()): Json {
  if (valor === null || typeof valor === "boolean" || typeof valor === "string") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (!valor || typeof valor !== "object" || ancestrais.has(valor)) throw Error("HISTORICO_HASH_JSON_INVALIDO");
  ancestrais.add(valor);
  let resultado: Json;
  if (Array.isArray(valor)) resultado = valor.map(v => jsonCanonico(v, ancestrais));
  else {
    if (Object.getPrototypeOf(valor) !== Object.prototype && Object.getPrototypeOf(valor) !== null) throw Error("HISTORICO_HASH_JSON_INVALIDO");
    resultado = Object.fromEntries(Object.keys(valor).sort().map(chave => [chave, jsonCanonico((valor as Aberto)[chave], ancestrais)]));
  }
  ancestrais.delete(valor); return resultado;
}
export function hashCanonico(valor: unknown): string { return createHash("sha256").update(JSON.stringify(jsonCanonico(valor))).digest("hex"); }
function objeto(valor: unknown): Aberto { if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw Error("HISTORICO_OBJETO_INVALIDO"); return valor as Aberto; }
function lista(valor: unknown, maximo: number): unknown[] { if (!Array.isArray(valor) || valor.length > maximo) throw Error("HISTORICO_LISTA_INVALIDA"); return valor; }
function inteiro(valor: unknown, minimo = 0): number { if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < minimo) throw Error("HISTORICO_CONTAGEM_INVALIDA"); return valor; }
function texto(valor: unknown, maximo = 100000, vazio = true): string { if (typeof valor !== "string" || valor.length > maximo || !vazio && !valor.trim()) throw Error("HISTORICO_TEXTO_INVALIDO"); return valor; }
function opcional(valor: unknown): void { if (valor !== null && typeof valor !== "string") throw Error("HISTORICO_TEXTO_INVALIDO"); }
function monetario(valor: unknown, negativo = true): Prisma.Decimal {
  if (typeof valor !== "string" || !(negativo ? /^-?\d{1,12}(?:\.\d{1,2})?$/ : /^\d{1,12}(?:\.\d{1,2})?$/).test(valor)) throw Error("HISTORICO_MONETARIO_INVALIDO");
  const numero = new Decimal(valor); if (!numero.isFinite()) throw Error("HISTORICO_MONETARIO_INVALIDO"); return numero;
}
function quantidade(valor: unknown, zero = false): Prisma.Decimal {
  if (typeof valor !== "string" || !/^\d{1,12}(?:\.\d{1,6})?$/.test(valor)) throw Error("HISTORICO_QUANTIDADE_INVALIDA");
  const numero = new Decimal(valor); if (!numero.isFinite() || (zero ? numero.lt(0) : numero.lte(0))) throw Error("HISTORICO_QUANTIDADE_INVALIDA"); return numero;
}
function conferir(valor: unknown, esperado: Prisma.Decimal): void { if (!monetario(valor).eq(esperado)) throw Error("HISTORICO_CALCULO_DIVERGENTE"); }
function coluna(indice: number): string { let n = indice + 1, s = ""; while (n) { const resto = (n - 1) % 26; s = String.fromCharCode(65 + resto) + s; n = Math.floor((n - 1) / 26); } return s; }
const ocupado = (valor: unknown) => valor !== null && valor !== "";

// Estes derivados são calculados novamente no servidor. O hash da linha cobre
// as células originais, não as classificações declaradas no arquivo intermediário.
const entidadesHtml: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: "\u00a0",
  aacute: "á", Aacute: "Á", agrave: "à", Agrave: "À", acirc: "â", Acirc: "Â", atilde: "ã", Atilde: "Ã", auml: "ä", Auml: "Ä",
  eacute: "é", Eacute: "É", egrave: "è", Egrave: "È", ecirc: "ê", Ecirc: "Ê", euml: "ë", Euml: "Ë",
  iacute: "í", Iacute: "Í", igrave: "ì", Igrave: "Ì", icirc: "î", Icirc: "Î", iuml: "ï", Iuml: "Ï",
  oacute: "ó", Oacute: "Ó", ograve: "ò", Ograve: "Ò", ocirc: "ô", Ocirc: "Ô", otilde: "õ", Otilde: "Õ", ouml: "ö", Ouml: "Ö",
  uacute: "ú", Uacute: "Ú", ugrave: "ù", Ugrave: "Ù", ucirc: "û", Ucirc: "Û", uuml: "ü", Uuml: "Ü", ccedil: "ç", Ccedil: "Ç", szlig: "ß",
};
function decodificarHtml(valor: string): string {
  return valor.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/giu, (original, entidade: string) => {
    if (!entidade.startsWith("#")) return entidadesHtml[entidade] ?? original;
    const codigo = entidade[1].toLowerCase() === "x" ? parseInt(entidade.slice(2), 16) : parseInt(entidade.slice(1), 10);
    return codigo > 0 && codigo <= 0x10ffff && !(codigo >= 0xd800 && codigo <= 0xdfff) ? String.fromCodePoint(codigo) : "\ufffd";
  });
}
function textoNormalizado(valor: unknown): string { return decodificarHtml(String(valor ?? "")).replace(/\s+/gu, " ").trim(); }
function chaveTexto(valor: unknown): string { return textoNormalizado(valor).toLowerCase().replace(/ß/gu, "ss").replace(/ς/gu, "σ").normalize("NFKD").replace(/\p{M}/gu, ""); }
function textoSemHtml(valor: unknown): string {
  let bloqueado = 0, resultado = "";
  const partes = String(valor ?? "").match(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>|[^<]+|</giu) ?? [];
  for (const parte of partes) {
    if (parte.startsWith("<!--")) continue;
    const tag = /^<(\/?)([a-z][\da-z]*)\b[^>]*>$/iu.exec(parte);
    if (tag) {
      const nome = tag[2].toLowerCase(), fim = !!tag[1];
      if (nome === "script" || nome === "style") bloqueado = fim ? Math.max(0, bloqueado - 1) : bloqueado + 1;
      else if (!bloqueado && (fim ? ["p", "div", "li"] : ["br", "p", "div", "li"]).includes(nome)) resultado += "\n";
    } else if (!bloqueado) resultado += decodificarHtml(parte);
  }
  return decodificarHtml(resultado).split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/u).map(l => l.trim()).filter(Boolean).join("\n");
}
function emailDaCelula(original: string | null, origem: string): EmailHistorico {
  const normalizado = textoNormalizado(original).toLowerCase().replace(/ß/gu, "ss").replace(/ς/gu, "σ");
  return { origem, original, normalizado: normalizado || null, valido_sintaticamente: /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizado) };
}
const dddsBrasil = new Set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" "));
function nacionalBrasilValido(digitos: string): boolean { return dddsBrasil.has(digitos.slice(0, 2)) && (digitos.length === 11 ? /^9\d{8}$/u : /^[2-5]\d{7}$/u).test(digitos.slice(2)); }
function telefoneDaCelula(original: string | null, origem: string, pais: Aberto | null): TelefoneHistorico {
  const texto = textoNormalizado(original), digitos = texto.replace(/\D/gu, "").slice(texto.startsWith("00") ? 2 : 0);
  const compativel = /^[+\d().\s-]+$/u.test(texto) && (texto.match(/\+/gu)?.length ?? 0) <= 1 && (!texto.includes("+") || texto.startsWith("+"));
  const prefixoBrasil = compativel && [12, 13].includes(digitos.length) && digitos.startsWith("55") && nacionalBrasilValido(digitos.slice(2));
  const nacional = compativel && pais?.pais === "BR" && nacionalBrasilValido(digitos);
  let e164: string | null = null, evidencia: Aberto | null = null, regra = "digitos_sem_acrescentar_pais";
  if (prefixoBrasil) { e164 = "+" + digitos; regra = "prefixo_55_exportado_validado_sem_acrescentar_digitos"; evidencia = {pais:"BR",regra:"prefixo_55_ja_exportado_validado",origem,ddi_ja_presente:true,ddd_assinante_validados:true}; }
  else if (nacional) { e164 = "+55" + digitos; regra = "ddi_55_com_evidencia_de_pais; numero_nacional_preservado_sem_inserir_nono_digito"; evidencia = {...pais,ddi_ja_presente:false,ddd_assinante_validados:true}; }
  else if (compativel && (texto.startsWith("+") || texto.startsWith("00")) && /^[1-9]\d{7,14}$/u.test(digitos) && !digitos.startsWith("55")) { e164 = "+" + digitos; regra = "formato_internacional_exportado; pais_nao_classificado"; }
  return {origem,original,digitos_preservados:digitos || null,pais_explicito:prefixoBrasil ? "BR" : null,pais_verificado:evidencia ? "BR" : null,evidencia_pais:evidencia,codigo_pais_acrescentado:!!nacional && !prefixoBrasil,e164,normalizacao:regra,plausivel:digitos.length >= 8 && digitos.length <= 15};
}
const ufsBrasil = "(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)";
const estadosBrasil = new Map("Acre|Alagoas|Amapá|Amazonas|Bahia|Ceará|Distrito Federal|Espírito Santo|Goiás|Maranhão|Mato Grosso|Mato Grosso do Sul|Minas Gerais|Pará|Paraíba|Paraná|Pernambuco|Piauí|Rio de Janeiro|Rio Grande do Norte|Rio Grande do Sul|Rondônia|Roraima|Santa Catarina|São Paulo|Sergipe|Tocantins".split("|").map((nome, i)=>[chaveTexto(nome),"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ")[i]]));
function enderecoDaCelula(original: string | null, origem: string, nomeComprador: string | null): EnderecoHistorico {
  const texto = textoSemHtml(original), ceps = new Set([...texto.matchAll(/(?<!\d)(\d{5})-?(\d{3})(?!\d)/gu)].map(m => m[1] + m[2]));
  const fragmentos = [...texto.matchAll(/[^\n;]+/gu)].filter(m => !!m[0].trim()).map(m => { const valor = m[0].trim(), inicio = m.index + m[0].length - m[0].trimStart().length; return {texto:valor,inicio,fim:inicio + valor.length}; });
  const postais = new Map<number, string>();
  fragmentos.forEach((f, i) => { const m = /^\s*(?:CEP\s*[:=-]?\s*)?(\d{5})[ -]?(\d{3})\s*$/iu.exec(f.texto); if (m) postais.set(i, m[1] + m[2]); });
  const estruturado: Record<string, string | null> = {logradouro:null,numero:null,complemento:null,bairro:null,municipio:null}, provasCampos: Record<string, Aberto> = {};
  const compradorPrimeiro = !!fragmentos.length && !!textoNormalizado(nomeComprador) && textoNormalizado(fragmentos[0].texto) === textoNormalizado(nomeComprador);
  const ufExtensa = fragmentos.length >= 5 ? estadosBrasil.get(chaveTexto(fragmentos.at(-2)!.texto)) : undefined;
  const caudaPostal = compradorPrimeiro && fragmentos.length >= 5 && postais.has(fragmentos.length-1) && ufExtensa && fragmentos.at(-3)!.texto && !/\d/u.test(fragmentos.at(-3)!.texto) ? {cep:postais.get(fragmentos.length-1)!,uf:ufExtensa,municipio:fragmentos.at(-3)!.texto,indiceEstado:fragmentos.length-2,indiceMunicipio:fragmentos.length-3,indiceCep:fragmentos.length-1} : null;
  function provar(campo: string, valor: string, indice: number, regra: string, inicio = fragmentos[indice].inicio, fim = fragmentos[indice].fim) { provasCampos[campo] = {origem,fragmento_indice:indice,inicio,fim,regra,confirmado:true}; if (campo in estruturado) estruturado[campo] = valor; }
  if (compradorPrimeiro && fragmentos.length > 1) {
    const rua = /^(.+?),\s*(\d[\dA-Za-z/-]{0,29}|[Ss]\/[Nn])\s*$/u.exec(fragmentos[1].texto);
    if (rua && rua[1].trim().length <= 200) { const inicioRua = fragmentos[1].inicio + rua[0].indexOf(rua[1]), inicioNumero = fragmentos[1].inicio + rua[0].lastIndexOf(rua[2]); provar("logradouro",rua[1].trim(),1,"linha_apos_nome_comprador_com_logradouro_numero_delimitados",inicioRua,inicioRua+rua[1].length); provar("numero",rua[2].trim(),1,"linha_apos_nome_comprador_com_logradouro_numero_delimitados",inicioNumero,inicioNumero+rua[2].length); }
  }
  if (caudaPostal && [6,7].includes(fragmentos.length) && /^(?:(?:ap(?:to)?\.?|apartamento|bloco|torre|andar|sala|cj\.?|conjunto|loja|cobertura)\s*(?:[-:.]\s*)?(?:\d|[A-Z]\b)|(?:casa|fundos|sobrado)(?:\s+(?:\d.*|fundos|frente))?\s*$)/iu.test(fragmentos[2].texto)) provar("complemento",fragmentos[2].texto,2,"marcador_explicito_complemento_apos_logradouro_em_bloco_postal");
  fragmentos.forEach((f,i)=>{const bairro=/^\s*Bairro\s*:\s*(.+?)\s*$/iu.exec(f.texto); if(bairro) { const inicio=f.inicio+bairro[0].indexOf(bairro[1]); provar("bairro",bairro[1],i,"rotulo_bairro_explicito",inicio,inicio+bairro[1].length); }});
  type Candidata = {valor:string;inicio:number;fim:number;confirmada:boolean;regra:string;complemento_aparente:boolean;texto_original?:string};
  const candidatas: Candidata[] = [...texto.matchAll(new RegExp(`\\b${ufsBrasil}\\b`, "gu"))].map(m => ({valor:m[0],inicio:m.index,fim:m.index+m[0].length,confirmada:false,regra:"sigla_sem_posicao_inequivoca",complemento_aparente:m[0] === "AP" && /^\s*[.:-]?\s*\d/u.test(texto.slice(m.index+m[0].length))}));
  const evidencias: Aberto[] = [];
  function confirmar(uf: string, inicio: number, fim: number, regra: string, cep?: string) {
    let candidata = candidatas.find(c => c.inicio === inicio && c.fim === fim);
    if (!candidata) { candidata = {valor:uf.toUpperCase(),inicio,fim,confirmada:false,regra:"sigla_sem_posicao_inequivoca",complemento_aparente:false}; candidatas.push(candidata); }
    Object.assign(candidata, {valor:uf.toUpperCase(),confirmada:true,regra,texto_original:texto.slice(inicio,fim)});
    if (cep) evidencias.push({pais:"BR",regra:"uf_e_cep_em_posicao_inequivoca",origem,uf:uf.toUpperCase(),cep,posicao_uf:[inicio,fim],inferido_pelo_endereco_cobranca:true});
  }
  function cepProximo(indice: number): string | undefined {
    if (caudaPostal && Math.abs(indice-caudaPostal.indiceCep) <= 2) return caudaPostal.cep;
    for (let outro = Math.max(0, indice-2); outro < Math.min(fragmentos.length, indice+3); outro++) {
      if (!postais.has(outro)) continue;
      if (fragmentos.slice(Math.min(indice,outro)+1, Math.max(indice,outro)).some(f => /\d|\b(?:ap|apto|apartamento|complemento|bloco)\b/iu.test(f.texto))) continue;
      if (fragmentos[Math.max(indice,outro)].fim - fragmentos[Math.min(indice,outro)].inicio <= 160) return postais.get(outro);
    }
  }
  const cidadeInvalida = /\b(?:rua|avenida|estrada|rodovia|logradouro|ap|apto|apartamento|complemento|bloco|casa|quadra|lote|cep)\b/iu;
  fragmentos.forEach((f, indice) => {
    for (const m of f.texto.matchAll(new RegExp(`\\b(?:UF|Estado)\\s*[:=-]\\s*(${ufsBrasil})\\b`, "giu"))) { const inicio = f.inicio + m.index + m[0].length-m[1].length; confirmar(m[1], inicio, inicio+m[1].length, "rotulo_uf_explicito", cepProximo(indice)); }
    const municipal = new RegExp(`^\\s*([^\\d\\n;]+?)\\s*[-/]\\s*(${ufsBrasil})\\s*$`, "iu").exec(f.texto), cep = cepProximo(indice);
    if (municipal && municipal[1].trim().length >= 2 && !cidadeInvalida.test(municipal[1]) && cep) { const inicio = f.inicio+municipal[0].lastIndexOf(municipal[2]); confirmar(municipal[2], inicio, inicio+municipal[2].length, "sufixo_municipal_com_cep_postal", cep); }
    const unica = new RegExp(`^\\s*(${ufsBrasil})\\s*$`, "iu").exec(f.texto);
    if (unica && indice > 0 && !/\d/u.test(fragmentos[indice-1].texto) && !cidadeInvalida.test(fragmentos[indice-1].texto) && cep) { const inicio = f.inicio+unica[0].indexOf(unica[1]); confirmar(unica[1], inicio, inicio+unica[1].length, "uf_em_fragmento_municipal_com_cep_postal", cep); }
  });
  if (caudaPostal) { const f = fragmentos[caudaPostal.indiceEstado]; confirmar(caudaPostal.uf,f.inicio,f.fim,"nome_estado_extenso_em_bloco_postal_apos_comprador",caudaPostal.cep); }
  const paises = [...texto.matchAll(/\b(?:Pa[ií]s|Country)\s*[:=-]\s*([^\n;]+)/giu)], paisEstrangeiro = paises.some(m => !["brasil","brazil","br"].includes(chaveTexto(m[1])));
  for (const m of paises) if (["brasil","brazil","br"].includes(chaveTexto(m[1]))) { const inicio = m.index+m[0].length-m[1].length; evidencias.push({pais:"BR",regra:"pais_br_rotulado_explicitamente",origem,posicao:[inicio,inicio+m[1].length],inferido_pelo_endereco_cobranca:false}); }
  if (fragmentos.length > 1 && ["brasil","brazil"].includes(chaveTexto(fragmentos.at(-1)!.texto)) && postais.has(fragmentos.length-2)) evidencias.push({pais:"BR",regra:"pais_br_terminal_apos_cep",origem,inferido_pelo_endereco_cobranca:false});
  const confirmadas = new Set(candidatas.filter(c => c.confirmada).map(c => c.valor)), conflito = paisEstrangeiro || confirmadas.size > 1 || ceps.size > 1 && !caudaPostal, provas = conflito ? [] : evidencias;
  const cepSelecionado = caudaPostal?.cep ?? (ceps.size === 1 ? [...ceps][0] : null), ufSelecionada = confirmadas.size === 1 && !conflito ? [...confirmadas][0] : null;
  if (caudaPostal && !conflito) {
    let cidade = caudaPostal.municipio; const sufixo = new RegExp(`\\s*[-/]\\s*(${ufsBrasil})\\s*$`,"iu").exec(cidade); if (sufixo && sufixo[1].toUpperCase() === ufSelecionada) cidade = cidade.slice(0,sufixo.index).trim();
    provar("municipio",cidade,caudaPostal.indiceMunicipio,"municipio_antes_de_estado_extenso_e_cep_em_bloco_comprador"); provar("cep",cepSelecionado!,caudaPostal.indiceCep,"cep_terminal_em_bloco_postal_com_estado_extenso");
  } else if (cepSelecionado) { const m = [...texto.matchAll(/(?<!\d)(\d{5})-?(\d{3})(?!\d)/gu)].find(m=>m[1]+m[2] === cepSelecionado)!; provasCampos.cep = {origem,inicio:m.index,fim:m.index+m[0].length,regra:"padrao_de_cep_sem_confirmacao_de_finalidade_postal",confirmado:false}; }
  if (ufSelecionada) {const c=candidatas.find(c=>c.confirmada && c.valor===ufSelecionada)!;provasCampos.uf={origem,inicio:c.inicio,fim:c.fim,regra:c.regra,confirmado:true};}
  return {origem,original,texto:texto || null,finalidade:"cobranca_cabecalho",entrega_confirmada:false,fragmentos:fragmentos.map(f=>f.texto),cep:cepSelecionado,uf:ufSelecionada,uf_candidatas:candidatas,pais_evidencias:provas,localidade_conflitante:conflito,termo_brasil_sem_papel_confirmado:/\b(?:brasil|brazil)\b/iu.test(texto) && !provas.some(e=>!e.inferido_pelo_endereco_cobranca),...estruturado,provas_campos:provasCampos,regra:"campos_por_rotulo_ou_formato_cobranca_com_nome_comprador_e_bloco_postal_comprovavel; bairro_sem_template_nao_inferido; candidatos_nao_confirmam_UF"};
}
function statusDasNotas(valor: string | null): RegistroHistorico["status"] {
  const texto = textoSemHtml(valor), transicoes = [...texto.matchAll(/Status do pedido alterado de ([^.\n]+?) para ([^.\n]+?)\./gu)].map(m => ({de:textoNormalizado(m[1]),para:textoNormalizado(m[2]),offset_inicio:m.index,offset_fim:m.index + m[0].length}));
  const arestas = Math.max(0, transicoes.length - 1), direta = transicoes.slice(1).filter((t, i) => transicoes[i].para === t.de).length, reversa = transicoes.slice(1).filter((t, i) => transicoes[i].de === t.para).length;
  let final: string | null = null, regra = "sem_transicao";
  if (transicoes.length === 1) { final = transicoes[0].para; regra = "transicao_unica"; }
  else if (arestas && reversa === arestas && direta < arestas) { final = transicoes[0].para; regra = "ordem_reversa_validada_por_cadeia_completa"; }
  else if (arestas && direta === arestas && reversa < arestas) { final = transicoes.at(-1)!.para; regra = "ordem_direta_validada_por_cadeia_completa"; }
  else if (arestas && direta === arestas && reversa === arestas && new Set(transicoes.map(t => t.para)).size === 1) { final = transicoes[0].para; regra = "estado_constante"; }
  else if (arestas) regra = "cadeia_inconsistente_ou_ambigua_nao_derivar_final";
  return {transicoes,arestas,continuidade_direta:direta,continuidade_reversa:reversa,final_legado:final,regra,evidencia_atendimento:final === "Retirado" ? "status_legado_retirado" : "nao_comprovado",modalidade_entrega:null,data_entrega:null,adicoes_itens_em_notas:(texto.match(/Itens? de linha adicionados?/giu) ?? []).length,exclusoes_itens_em_notas:(texto.match(/(?:exclu[ií]dos?|removidos?)/giu) ?? []).length,referencias_nf:[...texto.matchAll(/\bNF\s*[-:#.]?\s*(\d{2,10})\b/giu)].map(m => m[1]),nf_autenticada:false,texto_seguro:texto};
}

/** Confere o serial como relógio local. Nenhuma conversão de fuso é aplicada. */
function validarData(valor: unknown, original: unknown, date1904: boolean): DataHistorica {
  const d = objeto(valor), serial = texto(d.serial_original, 40, false), exato = texto(d.local_exato, 40, false);
  if (original !== serial || !/^\d{1,6}(?:\.\d{1,18})?$/.test(serial) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(exato) || d.fuso_hipotese !== "America/Sao_Paulo" || d.conversao_fuso_aplicada !== false || d.mes !== exato.slice(0, 7) || d.exibicao_minuto !== exato.slice(0, 16).replace("T", " ")) throw Error("HISTORICO_DATA_INVALIDA");
  const integral = exato.split(".")[0], milissegundos = Date.parse(integral + "Z");
  if (!Number.isFinite(milissegundos) || new Date(milissegundos).toISOString().slice(0, 19) !== integral) throw Error("HISTORICO_DATA_INVALIDA");
  const micros = new Decimal((exato.split(".")[1] ?? "").padEnd(6, "0") || "0");
  const epoch = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30);
  const esperado = new Decimal(serial).times("86400000000").toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const obtido = new Decimal(milissegundos - epoch).times(1000).plus(micros);
  if (!obtido.eq(esperado)) throw Error("HISTORICO_SERIAL_DESLOCADO");
  const segundo = new Date(milissegundos + (micros.gte(500000) ? 1000 : 0)).toISOString().slice(0, 19);
  if (d.local_segundo !== segundo) throw Error("HISTORICO_SEGUNDO_DIVERGENTE");
  texto(d.metodo, 500, false);
  return d as DataHistorica;
}

/** Valores não detalhados e o resíduo são monetários. Nunca se tornam produtos. */
export function conferirCalculosHistoricos(registro: RegistroHistorico): {
  liquidoItens: string; descontoItens: string; brutoReconstruido: string; freteOriginal: string;
  totalOriginal: string; valorNaoDetalhado: string; ajusteLegadoAClassificar: string;
} {
  let liquido = new Decimal(0), descontos = new Decimal(0);
  for (const item of registro.itens) {
    const q = item.quantidade === null ? null : quantidade(item.quantidade);
    const preco = item.preco_unitario_liquido === null ? null : monetario(item.preco_unitario_liquido, false);
    const desconto = item.desconto_linha === null ? new Decimal(0) : monetario(item.desconto_linha, false);
    if (item.desconto_ausente !== (item.desconto_linha === null)) throw Error("HISTORICO_DESCONTO_AUSENTE_DIVERGENTE");
    if (item.incompleto !== (!item.nome_normalizado.trim() || q === null || preco === null)) throw Error("HISTORICO_ITEM_INCOMPLETO_DIVERGENTE");
    if (q !== null && preco !== null) {
      const linha = q.times(preco); conferir(item.liquido_linha, linha); conferir(item.bruto_linha_reconstruido, linha.plus(desconto)); liquido = liquido.plus(linha);
    } else if (item.liquido_linha !== null || item.bruto_linha_reconstruido !== null) throw Error("HISTORICO_ITEM_INCOMPLETO_COM_VALOR_INVENTADO");
    descontos = descontos.plus(desconto);
  }
  const t = registro.totais, bruto = liquido.plus(descontos), subtotal = monetario(t.subtotal_produtos_original), frete = monetario(t.frete_ajuste_original), total = monetario(t.total_original);
  conferir(t.liquido_itens, liquido); conferir(t.desconto_itens, descontos); conferir(t.bruto_reconstruido, bruto);
  conferir(t.total_calculado_itens_mais_frete, liquido.plus(frete)); conferir(t.diferenca_produtos, subtotal.minus(bruto)); conferir(t.diferenca_total, total.minus(liquido).minus(frete));
  const naoDetalhado = Decimal.max(subtotal.minus(bruto), 0), residual = total.minus(liquido).minus(frete).minus(naoDetalhado);
  conferir(t.valor_historico_nao_detalhado, naoDetalhado); conferir(t.diferenca_total_apos_nao_detalhado, residual);
  if (t.zero_final_preservado !== total.isZero() || t.frete_classificacao !== (frete.lt(0) ? "ajuste_legado_a_classificar" : "frete_cobrado_legado")) throw Error("HISTORICO_AJUSTE_CLASSIFICACAO_DIVERGENTE");
  return {liquidoItens:liquido.toFixed(2),descontoItens:descontos.toFixed(2),brutoReconstruido:bruto.toFixed(2),freteOriginal:frete.toFixed(2),totalOriginal:total.toFixed(2),valorNaoDetalhado:naoDetalhado.toFixed(2),ajusteLegadoAClassificar:residual.toFixed(2)};
}

/** A fonte primária permanece intacta. Só provas revalidadas acrescentam itens. */
export function itensHistoricosEfetivos(registro: RegistroHistorico): ItemHistorico[] {
  return registro.complemento === undefined ? registro.itens : [...registro.itens,...validarComplementoRegistro(registro,registro.complemento).itens];
}
export function hashVersaoRegistro(registro: RegistroHistorico): string {
  return registro.complemento === undefined ? registro.hash_linha : hashCanonico({hashLinhaPrincipal:registro.hash_linha,complemento:validarComplementoRegistro(registro,registro.complemento).hash_sha256});
}
/** AY e BA são os valores finais da fonte. Os extras apenas detalham a parcela. */
export function totaisHistoricosEfetivos(registro: RegistroHistorico): TotaisHistoricos {
  if (registro.complemento === undefined) return registro.totais;
  const itens=itensHistoricosEfetivos(registro),liquido=itens.reduce((n,i)=>n.plus(i.liquido_linha??"0"),new Decimal(0)),descontos=itens.reduce((n,i)=>n.plus(i.desconto_linha??"0"),new Decimal(0)),bruto=liquido.plus(descontos);
  const subtotal=monetario(registro.totais.subtotal_produtos_original),frete=monetario(registro.totais.frete_ajuste_original),total=monetario(registro.totais.total_original),diferencaProdutos=subtotal.minus(bruto),diferencaTotal=total.minus(liquido).minus(frete),naoDetalhado=Decimal.max(diferencaProdutos,0);
  return {...registro.totais,liquido_itens:liquido.toString(),desconto_itens:descontos.toString(),bruto_reconstruido:bruto.toString(),total_calculado_itens_mais_frete:liquido.plus(frete).toString(),diferenca_produtos:diferencaProdutos.toString(),diferenca_total:diferencaTotal.toString(),valor_historico_nao_detalhado:naoDetalhado.toString(),diferenca_total_apos_nao_detalhado:diferencaTotal.minus(naoDetalhado).toString()};
}

function validarRegistro(valor: unknown, date1904: boolean): RegistroHistorico {
  const r = objeto(valor), raw = objeto(r.raw), valores = lista(raw.valores, 59);
  inteiro(r.linha, 2); if (raw.linha !== r.linha || valores.length !== 59 || valores.some(v => v !== null && typeof v !== "string")) throw Error("HISTORICO_RAW_POSICOES_INVALIDAS");
  const numero = texto(r.numero_original, 30, false);
  if (!/^\d+$/.test(numero) || String(valores[8]).trim() !== numero || r.origem !== ORIGEM_HISTORICA || r.chave_deduplicacao !== `${ORIGEM_HISTORICA}:${numero}`) throw Error("HISTORICO_IDENTIDADE_INVALIDA");
  if (typeof r.hash_linha !== "string" || !/^[a-f0-9]{64}$/.test(r.hash_linha) || r.hash_linha !== hashCanonico(valores)) throw Error("HISTORICO_HASH_LINHA_DIVERGENTE");
  const criacao = validarData(r.data_criacao, valores[4], date1904);
  if (numero === "20138" ? criacao.local_exato.slice(0, 10) !== "2025-12-30" : criacao.local_exato < "2026-01-01" || criacao.local_exato >= "2026-10-01") throw Error("HISTORICO_CRIACAO_FORA_PERIODO");
  if (r.pagamento_informado !== null) {
    const pago = validarData(r.pagamento_informado, valores[5], date1904);
    if (pago.local_exato < "2026-01-01" || pago.local_exato >= "2026-10-01") throw Error("HISTORICO_PAGAMENTO_FORA_PERIODO");
  } else if (ocupado(valores[5])) throw Error("HISTORICO_PAGAMENTO_OMITIDO");
  if (r.efeitos_operacionais_autorizados !== false || r.liquidacao_comprovada !== null) throw Error("HISTORICO_EFEITO_OPERACIONAL_RECUSADO");
  const itens = lista(r.itens, 10), blocos = new Set<number>();
  for (const valor of itens) {
    const i = objeto(valor), bloco = inteiro(i.bloco, 1), inicio = 10 + (bloco - 1) * 4;
    if (bloco > 10 || blocos.has(bloco) || i.linha !== r.linha || hashCanonico(lista(i.colunas, 4)) !== hashCanonico(Array.from({length:4}, (_, j) => coluna(inicio + j))) || hashCanonico(lista(i.originais, 4)) !== hashCanonico(valores.slice(inicio, inicio + 4)) || i.nome_original !== valores[inicio]) throw Error("HISTORICO_BLOCO_INVALIDO");
    blocos.add(bloco); opcional(i.nome_original);
    i.nome_normalizado = textoNormalizado(valores[inicio]); i.chave_nome = chaveTexto(valores[inicio]);
    texto(i.nome_normalizado, 2000); texto(i.chave_nome, 2000);
    i.produto_externo_nao_identificado = i.chave_nome === "produto externo";
    i.incompleto = !i.nome_normalizado || i.quantidade === null || i.preco_unitario_liquido === null;
    i.desconto_ausente = i.desconto_linha === null;
    i.consumo_apurado = null; i.custo_historico_comprovado = null;
    for (const [campo, deslocamento] of [["quantidade", 1], ["preco_unitario_liquido", 2], ["desconto_linha", 3]] as const) {
      const v = i[campo], original = valores[inicio + deslocamento];
      if (v === null && !ocupado(original)) continue;
      if (typeof original !== "string" || typeof v !== "string" || !/^-?\d+(?:\.\d+)?$/.test(original.trim()) || !new Decimal(original.trim()).eq(new Decimal(v))) throw Error("HISTORICO_ITEM_ORIGEM_DIVERGENTE");
    }
  }
  for (let b = 1; b <= 10; b++) if (valores.slice(10 + (b - 1) * 4, 14 + (b - 1) * 4).some(ocupado) !== blocos.has(b)) throw Error("HISTORICO_BLOCO_OMITIDO");
  if (r.quantidade_blocos !== itens.length) throw Error("HISTORICO_BLOCOS_CONTAGEM_DIVERGENTE");
  const totais = objeto(r.totais);
  for (const [campo, posicao] of [["subtotal_produtos_original", 50], ["frete_ajuste_original", 51], ["total_original", 52]] as const) conferir(totais[campo], monetario(valores[posicao]));
  const comprador = objeto(r.comprador);
  for (const campo of ["nome_cobranca", "nome_usuario_original", "empresa"] as const) opcional(comprador[campo]);
  if (comprador.nome_cobranca !== valores[1] || comprador.nome_usuario_original !== valores[0] || comprador.empresa !== valores[3]) throw Error("HISTORICO_COMPRADOR_ORIGEM_DIVERGENTE");
  if (lista(comprador.emails, 2).length !== 2 || lista(comprador.telefones, 2).length !== 2) throw Error("HISTORICO_CONTATOS_ORIGINAIS_INVALIDOS");
  for (const [origem, posicao] of [["BE", 56], ["BG", 58]] as const) if ((comprador.emails as EmailHistorico[]).filter(e => e.origem === origem && e.original === valores[posicao]).length !== 1) throw Error("HISTORICO_EMAIL_ORIGEM_DIVERGENTE");
  for (const [origem, posicao] of [["G", 6], ["BF", 57]] as const) if ((comprador.telefones as TelefoneHistorico[]).filter(t => t.origem === origem && t.original === valores[posicao]).length !== 1) throw Error("HISTORICO_TELEFONE_ORIGEM_DIVERGENTE");
  const destinatario = objeto(r.destinatario);
  if (destinatario.nome_entrega_original !== valores[55] || destinatario.contato_comprador_atribuido !== false || lista(destinatario.emails, 20).length || lista(destinatario.telefones, 20).length) throw Error("HISTORICO_DESTINATARIO_INFERIDO");
  const enderecos = lista(r.enderecos, 20).map(objeto);
  if (enderecos.length !== 2) throw Error("HISTORICO_ENDERECOS_ORIGINAIS_AUSENTES");
  for (const [col, indice] of [["C", 2], ["H", 7]] as const) if (enderecos.filter(e => e.origem === col && e.original === valores[indice]).length !== 1) throw Error("HISTORICO_ENDERECOS_ORIGINAIS_AUSENTES");
  for (const e of enderecos) if (e.entrega_confirmada !== false || e.finalidade !== "cobranca_cabecalho") throw Error("HISTORICO_ENDERECO_ENTREGA_NAO_COMPROVADO");
  const enderecosVerificados = [enderecoDaCelula(valores[2] as string | null, "C", valores[1] as string | null), enderecoDaCelula(valores[7] as string | null, "H", valores[1] as string | null)];
  const evidencias = enderecosVerificados.flatMap(e => e.pais_evidencias as Aberto[]), pais = evidencias.length && !enderecosVerificados.some(e => e.localidade_conflitante) ? evidencias[0] : null;
  // Conserva os campos sem equivalente, mas troca as classificações pela prova raw.
  r.enderecos = enderecosVerificados.map(e => ({...enderecos.find(d=>d.origem === e.origem),...e}));
  comprador.emails = [emailDaCelula(valores[56] as string | null, "BE"), emailDaCelula(valores[58] as string | null, "BG")];
  comprador.telefones = [telefoneDaCelula(valores[6] as string | null, "G", pais), telefoneDaCelula(valores[57] as string | null, "BF", pais)];
  comprador.identificavel = !!textoNormalizado(valores[1]) || !!valores[3] || (comprador.emails as EmailHistorico[]).some(e=>e.valido_sintaticamente) || (comprador.telefones as TelefoneHistorico[]).some(t=>t.plausivel);
  comprador.nome_usuario_e_nome_civil = false;
  comprador.conflitos_identidade = []; r.conflitos_identidade_validados = [];
  if (r.notas_originais !== valores[54] || r.metodo_pagamento_original !== valores[9] || r.transaction_id_original !== valores[53]) throw Error("HISTORICO_ORIGINAL_DIVERGENTE");
  r.status = {...objeto(r.status),...statusDasNotas(valores[54] as string | null)};
  for (const e of lista(r.excecoes, 100)) texto(objeto(e).codigo, 200, false);
  const resultado = r as RegistroHistorico; conferirCalculosHistoricos(resultado);
  if (r.complemento !== undefined) resultado.complemento=validarComplementoRegistro(resultado,r.complemento);
  return resultado;
}

const camposMensais = ["liquido_itens", "desconto_itens", "bruto_reconstruido", "subtotal_produtos_original", "frete_ajuste_original", "total_original", "diferenca_produtos", "diferenca_total", "valor_historico_nao_detalhado"] as const;
function conferirMensal(valor: unknown, registros: RegistroHistorico[], campo: "data_criacao" | "pagamento_informado"): void {
  const grupos = new Map<string, RegistroHistorico[]>();
  for (const r of registros) { const mes = r[campo]?.mes ?? "nao_informado"; grupos.set(mes, [...(grupos.get(mes) ?? []), r]); }
  const linhas = lista(valor, 20).map(objeto), meses = new Set<string>();
  if (linhas.length !== grupos.size) throw Error("HISTORICO_MENSAL_CONTAGEM_DIVERGENTE");
  for (const m of linhas) {
    const mes = texto(m.mes, 20, false), linhas = grupos.get(mes); if (!linhas || meses.has(mes)) throw Error("HISTORICO_MENSAL_INVALIDO"); meses.add(mes);
    if (m.pedidos !== linhas.length || m.pedidos_unicos !== new Set(linhas.map(r => r.numero_original)).size || m.itens !== linhas.reduce((n, r) => n + r.itens.length, 0) || m.pedidos_total_zero !== linhas.filter(r => monetario(r.totais.total_original).isZero()).length || m.fretes_negativos !== linhas.filter(r => monetario(r.totais.frete_ajuste_original).lt(0)).length) throw Error("HISTORICO_MENSAL_CONTAGEM_DIVERGENTE");
    const unidades = linhas.flatMap(r => r.itens).reduce((n, i) => n.plus(i.quantidade === null ? 0 : quantidade(i.quantidade)), new Decimal(0));
    if (!quantidade(m.unidades, true).eq(unidades)) throw Error("HISTORICO_MENSAL_UNIDADES_DIVERGENTES");
    const valores = objeto(m.valores);
    for (const c of camposMensais) conferir(valores[c], linhas.reduce((n, r) => n.plus(monetario(r.totais[c])), new Decimal(0)));
  }
}

/** Valida e devolve uma cópia. O arquivo, o raw e os campos sem equivalente ficam preservados. */
export function validarPacoteHistorico(valor: unknown): PacoteHistorico {
  // A cópia também recusa ciclos, valores não finitos e instâncias executáveis.
  const p = objeto(jsonCanonico(valor)), m = objeto(p.metadados);
  if (typeof m.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(m.sha256) || m.origem_identidade_estavel !== ORIGEM_HISTORICA) throw Error("HISTORICO_FONTE_INVALIDA");
  texto(m.lote_proposto, 200, false);
  const registros = lista(p.registros, 100000).map(v => validarRegistro(v, m.date1904 === true));
  for (const r of registros) if (r.complemento && r.complemento.prova.fontePrincipal.sha256 !== m.sha256) throw Error("HISTORICO_COMPLEMENTO_FONTE_DIVERGENTE");
  if (!registros.length || new Set(registros.map(r => r.numero_original)).size !== registros.length || new Set(registros.map(r => r.linha)).size !== registros.length) throw Error("HISTORICO_PEDIDO_DUPLICADO");
  if (inteiro(m.registros) !== registros.length || inteiro(m.pedidos_unicos) !== registros.length || inteiro(m.itens) !== registros.reduce((n, r) => n + r.itens.length, 0)) throw Error("HISTORICO_CONTAGENS_DIVERGENTES");
  const unidades = registros.flatMap(r => r.itens).reduce((n, i) => n.plus(i.quantidade === null ? 0 : quantidade(i.quantidade)), new Decimal(0));
  if (!quantidade(m.unidades, true).eq(unidades)) throw Error("HISTORICO_UNIDADES_DIVERGENTES");
  if (m.por_criacao !== undefined) conferirMensal(m.por_criacao, registros, "data_criacao");
  if (m.por_pagamento_informado !== undefined) conferirMensal(m.por_pagamento_informado, registros, "pagamento_informado");
  if (p.cabecalhos !== undefined) { const c = objeto(p.cabecalhos); if (lista(c.valores, 59).length !== 59) throw Error("HISTORICO_CABECALHOS_INVALIDOS"); }
  const emailNomes = new Map<string, Set<string>>(), telefoneNomes = new Map<string, Set<string>>(), emailsFonte = new Map<string, Set<string>>(), telefonesFonte = new Map<string, Set<string>>();
  function acumular(mapa: Map<string, Set<string>>, chave: string, nome: string) { const nomes = mapa.get(chave) ?? new Set<string>(); if (nome) nomes.add(nome); mapa.set(chave, nomes); }
  for (const r of registros) {
    const identidade = identidadeComprador(r), nome = normalizarNome(identidade.nome), nomeFonte = chaveTexto(r.raw.valores[1]);
    for (const e of identidade.emails) { acumular(emailNomes,e,nome); acumular(emailsFonte,e,nomeFonte); }
    for (const t of identidade.telefones) { acumular(telefoneNomes,t,nome); acumular(telefonesFonte,t,nomeFonte); }
  }
  for (const r of registros) {
    const identidade = identidadeComprador(r), conflitos: string[] = [], conflitosFonte: string[] = [];
    if (identidade.emails.some(e => (emailNomes.get(e)?.size ?? 0) > 1)) conflitos.push("email_associado_a_nomes_diferentes");
    if (identidade.telefones.some(t => (telefoneNomes.get(t)?.size ?? 0) > 1)) conflitos.push("telefone_associado_a_nomes_diferentes");
    if (identidade.emails.some(e => (emailsFonte.get(e)?.size ?? 0) > 1)) conflitosFonte.push("email_associado_a_nomes_diferentes");
    if (identidade.telefones.some(t => (telefonesFonte.get(t)?.size ?? 0) > 1)) conflitosFonte.push("telefone_associado_a_nomes_diferentes");
    r.comprador.conflitos_identidade = conflitosFonte; r.conflitos_identidade_validados = conflitos;
    const recalculada = identidadeComprador(r); r.comprador.identidade_candidata = recalculada.chave; r.comprador.regra_identidade = recalculada.regra;
  }
  return { ...p, metadados:m as MetadadosHistoricos, registros } as PacoteHistorico;
}

/** Papéis de comprador e destinatário nunca se misturam. O arquivo não define a identidade. */
export function identidadeComprador(r: RegistroHistorico): {
  chave: string; nome: string; emails: string[]; telefones: string[]; regra: string; conflitos: string[];
} {
  const c = r.comprador, valores = r.raw.valores, nome = (valores[1] ?? "").trim() || (valores[3] ?? "").trim();
  const emailsRaw = [emailDaCelula(valores[56],"BE"),emailDaCelula(valores[58],"BG")], telefonesRaw = [telefoneDaCelula(valores[6],"G",null),telefoneDaCelula(valores[57],"BF",null)];
  const emails = [...new Set(emailsRaw.filter(e=>e.valido_sintaticamente).map(e=>e.normalizado!))].sort();
  const telefones = [...new Set(telefonesRaw.filter(t=>t.plausivel).map(t=>t.digitos_preservados!))].sort();
  const conflitos = [...new Set([...(c.conflitos_identidade ?? []), ...(r.conflitos_identidade_validados ?? []), ...(emails.length > 1 ? ["emails_alternativos_divergentes"] : []), ...(telefones.length > 1 ? ["telefones_alternativos_divergentes"] : [])])];
  const normalizado = normalizarNome(nome);
  const regra = normalizado && emails.length === 1 && !conflitos.length ? "nome_email_exatos" : normalizado && !emails.length && telefones.length === 1 && !conflitos.length ? "nome_telefone_sem_conflito" : "identidade_por_documento_legado";
  const componentes = regra === "nome_email_exatos" ? [regra, normalizado, emails[0]] : regra === "nome_telefone_sem_conflito" ? [regra, normalizado, telefones[0]] : [regra, r.chave_deduplicacao];
  return {chave:`${ORIGEM_HISTORICA}:cliente:${hashCanonico(componentes)}`,nome,emails,telefones,regra,conflitos};
}
