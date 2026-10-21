import type { ItemNumeracaoDiagnosticoBrasilNfe } from "./diagnostico-http";
import type { NumeracoesBrasilNfeSanitizadas } from "./tipos-http";
import { MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE, type ComandoAtualizacaoNumeracaoBrasilNfe } from "./numeracao-dto";
import { ErroConfiguracaoBrasilNfe, validarVersaoBrasilNfe } from "./configuracao-dominio";

export const VALIDADE_CONSULTA_NUMERACAO_BRASILNFE_MS = 5 * 60_000;
export class ErroAtualizacaoNumeracaoBrasilNfe extends ErroConfiguracaoBrasilNfe {
  constructor(readonly motivo: keyof typeof MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE) { super(MOTIVOS_ATUALIZACAO_NUMERACAO_BRASILNFE[motivo]); }
}
export function validarAtualizacaoNumeracaoBrasilNfe(entrada: unknown): ComandoAtualizacaoNumeracaoBrasilNfe {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new ErroConfiguracaoBrasilNfe("Atualização de numeração inválida.");
  const e = entrada as Record<string, unknown>;
  validarVersaoBrasilNfe(e.versao);
  if (Object.keys(e).some(k => !["versao", "modelo", "ambiente", "serie", "proximoNumero", "padrao", "operacaoId", "consultadoEm", "confirmarAtualizacao"].includes(k))
    || ![55, 65].includes(e.modelo as number) || ![1, 2].includes(e.ambiente as number)
    || typeof e.serie !== "string" || !/^\d{1,3}$/.test(e.serie)
    || typeof e.proximoNumero !== "string" || !/^[1-9]\d{0,8}$/.test(e.proximoNumero)
    || typeof e.padrao !== "boolean" || e.confirmarAtualizacao !== true
    || typeof e.operacaoId !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(e.operacaoId)
    || typeof e.consultadoEm !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.consultadoEm) || !Number.isFinite(Date.parse(e.consultadoEm))) {
    throw new ErroConfiguracaoBrasilNfe("Confira modelo, ambiente, série (até 3 dígitos), próximo número (1 a 999999999), consulta e confirmação da atualização.");
  }
  return { versao: e.versao as number, modelo: e.modelo as 55 | 65, ambiente: e.ambiente as 1 | 2, serie: e.serie,
    proximoNumero: e.proximoNumero, padrao: e.padrao, operacaoId: e.operacaoId.toLowerCase(), consultadoEm: e.consultadoEm, confirmarAtualizacao: true };
}

export function conferirContadorAtualizacaoBrasilNfe(comando: ComandoAtualizacaoNumeracaoBrasilNfe, catalogo: NumeracoesBrasilNfeSanitizadas, maiorNumeroLocal: number): boolean {
  const atual = catalogo.numeracoes.find(n => n.ambiente === comando.ambiente && n.modelo === comando.modelo && Number(n.serie) === Number(comando.serie));
  const numero = Number(comando.proximoNumero);
  if (numero <= maiorNumeroLocal || atual && numero < Number(atual.numero)) throw new ErroAtualizacaoNumeracaoBrasilNfe("REDUCAO");
  if (!atual && (numero !== 1 || maiorNumeroLocal > 0)) throw new ErroAtualizacaoNumeracaoBrasilNfe("NOVA_SERIE");
  return !!atual && atual.numero === comando.proximoNumero && atual.padrao === comando.padrao;
}

/** Exige o alvo exato e preserva as demais séries; Padrao só muda dentro do contexto documentado. */
export function conferirCatalogoPosteriorBrasilNfe(comando: ComandoAtualizacaoNumeracaoBrasilNfe, antes: NumeracoesBrasilNfeSanitizadas, depois: NumeracoesBrasilNfeSanitizadas, aceitarAvanco = false): boolean {
  const chave = (n: NumeracoesBrasilNfeSanitizadas["numeracoes"][number]) => `${n.ambiente}:${n.modelo}:${Number(n.serie)}`;
  const alvo = `${comando.ambiente}:${comando.modelo}:${Number(comando.serie)}`;
  const posterior = new Map(depois.numeracoes.map(n => [chave(n), n]));
  const item = posterior.get(alvo);
  if (!item || (aceitarAvanco ? Number(item.numero) < Number(comando.proximoNumero) : item.numero !== comando.proximoNumero) || item.padrao !== comando.padrao) return false;
  const anteriores = new Set(antes.numeracoes.map(chave));
  if (depois.numeracoes.some(n => chave(n) !== alvo && !anteriores.has(chave(n)))) return false;
  return antes.numeracoes.every(n => {
    if (chave(n) === alvo) return true;
    const atual = posterior.get(chave(n));
    const padrao = comando.padrao && n.ambiente === comando.ambiente && n.modelo === comando.modelo ? false : n.padrao;
    return !!atual && (aceitarAvanco ? Number(atual.numero) >= Number(n.numero) : atual.numero === n.numero) && atual.padrao === padrao;
  });
}

export class ErroItemNumeracaoBrasilNfe extends Error {
  constructor(readonly detalhe: ItemNumeracaoDiagnosticoBrasilNfe) {
    super("Item de numeração fora do contrato.");
    this.name = "ErroItemNumeracaoBrasilNfe";
  }
}
function tipoObservado(valor: unknown): ItemNumeracaoDiagnosticoBrasilNfe["tipoObservado"] {
  if (valor === undefined) return "AUSENTE";
  if (valor === null) return "NULO";
  if (typeof valor === "boolean") return "BOOLEANO";
  if (typeof valor === "number") return Number.isInteger(valor) ? "INTEIRO" : "NUMERO_NAO_INTEIRO";
  if (typeof valor === "string") return "TEXTO";
  if (Array.isArray(valor)) return "ARRAY";
  return typeof valor === "object" ? "OBJETO" : "OUTRO";
}
/** Valida o catálogo sem copiar objetos externos para diagnósticos ou DTOs. */
export function validarItensNumeracaoBrasilNfe(entradas: readonly unknown[]): Pick<NumeracoesBrasilNfeSanitizadas, "numeracoes" | "itensForaEscopo"> {
  const chaves = new Set<string>(), padroes = new Set<string>();
  const numeracoes: NumeracoesBrasilNfeSanitizadas["numeracoes"] = [];
  let itensForaEscopo = 0;
  for (const [indice, entrada] of entradas.entries()) {
    const falhar = (campo: ItemNumeracaoDiagnosticoBrasilNfe["campo"], valor: unknown, motivo: ItemNumeracaoDiagnosticoBrasilNfe["motivo"]): never => {
      throw new ErroItemNumeracaoBrasilNfe(Object.freeze({ posicao: indice + 1, campo, tipoObservado: tipoObservado(valor),
        motivo: valor === undefined ? "AUSENTE" : valor === null ? "NULO" : motivo }));
    };
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) falhar("ITEM", entrada, "TIPO_INCOMPATIVEL");
    const item = entrada as Record<string, unknown>;
    if (typeof item.ModeloDocumento !== "number" || !Number.isSafeInteger(item.ModeloDocumento)) falhar("ModeloDocumento", item.ModeloDocumento, "TIPO_INCOMPATIVEL");
    if ((item.ModeloDocumento as number) < 1) falhar("ModeloDocumento", item.ModeloDocumento, "FORA_LIMITE");
    // O catálogo pode conter outros modelos. Um identificador inteiro positivo
    // distinto de 55/65 comprova apenas que a linha está fora deste projeto.
    // Não valida esse modelo, seu ambiente ou seus contadores e não os publica.
    if (item.ModeloDocumento !== 55 && item.ModeloDocumento !== 65) { itensForaEscopo++; continue; }
    if (typeof item.TipoAmbiente !== "number" || !Number.isSafeInteger(item.TipoAmbiente)) falhar("TipoAmbiente", item.TipoAmbiente, "TIPO_INCOMPATIVEL");
    if (![1, 2].includes(item.TipoAmbiente as number)) falhar("TipoAmbiente", item.TipoAmbiente, "FORA_LISTA");
    if (typeof item.Serie !== "string") falhar("Serie", item.Serie, "TIPO_INCOMPATIVEL");
    const serie = item.Serie as string;
    if (!/^\d{1,3}$/.test(serie)) falhar("Serie", serie, "FORMATO_INCOMPATIVEL");
    if (typeof item.Numero !== "number") falhar("Numero", item.Numero, "TIPO_INCOMPATIVEL");
    const numero = item.Numero as number;
    if (!Number.isSafeInteger(numero) || numero < 1 || numero > 999999999) falhar("Numero", numero, "FORA_LIMITE");
    if (typeof item.Padrao !== "boolean") falhar("Padrao", item.Padrao, "TIPO_INCOMPATIVEL");
    const padrao = item.Padrao as boolean;
    const contexto = `${item.TipoAmbiente}:${item.ModeloDocumento}`, chave = `${contexto}:${Number(serie)}`;
    if (chaves.has(chave)) falhar("Serie", serie, "SERIE_DUPLICADA");
    if (padrao && padroes.has(contexto)) falhar("Padrao", padrao, "PADRAO_DUPLICADO");
    chaves.add(chave); if (padrao) padroes.add(contexto);
    numeracoes.push({ ambiente: item.TipoAmbiente as 1 | 2, modelo: item.ModeloDocumento, serie, numero: String(numero), padrao });
  }
  return { numeracoes, ...(itensForaEscopo ? { itensForaEscopo } : {}) };
}
