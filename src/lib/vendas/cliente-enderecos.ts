import { CODIGOS_UF_IBGE } from "./municipio";

const CAMPOS_POSTAIS = ["pais", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"] as const;
const OBRIGATORIOS = ["pais", "cep", "logradouro", "numero", "bairro", "cidade", "uf"] as const;
const ROTULOS = { pais: "País", cep: "CEP", logradouro: "Logradouro", numero: "Número", bairro: "Bairro", cidade: "Cidade", uf: "UF" };
const registro = (valor: unknown): Record<string, unknown> => valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : "";
const base = (valor: unknown) => texto(valor).normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/gu, " ");
const palavras = (valor: unknown) => base(valor).replace(/[.,'’`´\-]+/gu, " ").replace(/\s+/gu, " ").trim();
const paisNormalizado = (valor: unknown) => ["BR", "BRASIL", "BRAZIL"].includes(base(valor)) ? "BRASIL" : palavras(valor);
const cepNormalizado = (valor: unknown) => base(valor).replace(/[.\s\-]/gu, "");
const numeroNormalizado = (valor: unknown) => base(valor).replace(/^[.,\s]+|[.,\s]+$/gu, "");

/** A comparação não altera os valores exibidos nem infere dados ausentes. */
export function camposEnderecoObrigatorios(endereco: unknown): string[] {
  const e = registro(endereco);
  return OBRIGATORIOS.filter(campo => !(campo === "numero" ? numeroNormalizado(e[campo]) : texto(e[campo]))).map(campo => ROTULOS[campo]);
}

export function pendenciaEnderecoPostal(endereco: unknown): string | null {
  const faltantes = camposEnderecoObrigatorios(endereco);
  if (faltantes.length) return `Preencha os campos obrigatórios do endereço: ${faltantes.join(", ")}.`;
  const e = registro(endereco);
  if (paisNormalizado(e.pais) === "BRASIL") {
    if (!/^[\d.\s\-]+$/u.test(texto(e.cep)) || !/^\d{8}$/u.test(cepNormalizado(e.cep))) return "Informe um CEP brasileiro com oito dígitos.";
    if (!Object.hasOwn(CODIGOS_UF_IBGE, base(e.uf).replace(/[.\s]/gu, ""))) return "Informe uma UF brasileira válida.";
  }
  return null;
}

export const enderecoPostalCompleto = (endereco: unknown): boolean => pendenciaEnderecoPostal(endereco) === null;

function logradouroSemNumeroRepetido(valor: unknown, numero: unknown) {
  const logradouro = base(valor), numeroCampo = numeroNormalizado(numero);
  if (!numeroCampo) return logradouro;
  const separadores = [...logradouro.matchAll(/[,;]|\s+[-–—]\s+/gu)];
  for (const separador of separadores.reverse()) {
    const inicio = separador.index;
    const sufixo = logradouro.slice(inicio + separador[0].length).trim().replace(/^(?:NUMERO|N(?:\.?[O°])?\.?)(?=\s|:|\d)\s*:?\s*/u, "");
    if (inicio > 0 && numeroNormalizado(sufixo) === numeroCampo) return logradouro.slice(0, inicio).trim();
  }
  return logradouro;
}
function logradouroNormalizado(valor: unknown, numero: unknown) {
  const aliases: Record<string, string> = { R: "RUA", AV: "AVENIDA", AL: "ALAMEDA", TV: "TRAVESSA", ROD: "RODOVIA", EST: "ESTRADA", PC: "PRACA", PCA: "PRACA" };
  const titulos: Record<string, string> = { DR: "DOUTOR", PROF: "PROFESSOR" };
  return palavras(logradouroSemNumeroRepetido(valor, numero)).split(" ").map((termo, indice) => (indice === 0 ? aliases[termo] : undefined) ?? titulos[termo] ?? termo).join(" ");
}
function bairroNormalizado(valor: unknown) {
  const aliases: Record<string, string> = { JD: "JARDIM", VL: "VILA", PQ: "PARQUE" };
  return palavras(valor).replace(/^\S+/u, prefixo => aliases[prefixo] ?? prefixo);
}
function complementoNormalizado(valor: unknown) {
  const aliases: Record<string, string> = { AP: "APARTAMENTO", APT: "APARTAMENTO", APTO: "APARTAMENTO", SL: "SALA", CJ: "CONJUNTO", BL: "BLOCO" };
  return base(valor).replace(/[.,]/gu, " ").replace(/\b(AP|APT|APTO|SL|CJ|BL|APARTAMENTO|SALA|CONJUNTO|BLOCO)\s*:\s*/gu, "$1 ").replace(/\b(AP|APT|APTO|SL|CJ|BL)(?=\d)/gu, "$1 ").replace(/\s+/gu, " ").trim().replace(/\b(?:AP|APT|APTO|SL|CJ|BL)\b/gu, termo => aliases[termo]);
}

function camposLocaisNormalizados(e: Record<string, unknown>) {
  return { pais: paisNormalizado(e.pais), logradouro: logradouroNormalizado(e.logradouro, e.numero), numero: numeroNormalizado(e.numero), cidade: palavras(e.cidade), uf: base(e.uf).replace(/[.\s]/gu, "") };
}

/** Apenas sugere grupos para revisão. Pode reunir unidades distintas e postais incompletos. Nunca identifica duplicidade automática. */
export function chaveLocalEnderecoPostal(endereco: unknown): string | null {
  const local = camposLocaisNormalizados(registro(endereco));
  if (Object.values(local).some(valor => !valor)) return null;
  if (local.pais === "BRASIL" && !Object.hasOwn(CODIGOS_UF_IBGE, local.uf)) return null;
  return JSON.stringify([local.pais, local.logradouro, local.numero, local.cidade, local.uf]);
}

/** Só endereços completos têm chave. Identidade, contato e texto original não participam. */
export function chaveEnderecoPostal(endereco: unknown): string | null {
  if (!enderecoPostalCompleto(endereco)) return null;
  const e = registro(endereco);
  const normalizado: Record<typeof CAMPOS_POSTAIS[number], string> = {
    ...camposLocaisNormalizados(e), cep: cepNormalizado(e.cep), complemento: complementoNormalizado(e.complemento), bairro: bairroNormalizado(e.bairro),
  };
  return JSON.stringify(CAMPOS_POSTAIS.map(campo => normalizado[campo]));
}

export function indiceEnderecoPostalDuplicado(lista: readonly unknown[], endereco: unknown, ignorarIndice?: number): number | null {
  const chave = chaveEnderecoPostal(endereco);
  if (chave === null) return null;
  const indice = lista.findIndex((candidato, n) => n !== ignorarIndice && chaveEnderecoPostal(candidato) === chave);
  return indice < 0 ? null : indice;
}
