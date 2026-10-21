import { createHash } from "node:crypto";

/** Identidade por arquivo/regra/expressão; deslocar uma linha não renova a dívida. */
export function chaveDesvio(problema) {
  return createHash("sha256").update(JSON.stringify([
    problema.arquivo.replaceAll("\\", "/"), problema.regra, problema.identidade,
  ])).digest("hex");
}

export function criarBaseline(problemas) {
  const ocorrencias = {};
  for (const problema of problemas) {
    const chave = chaveDesvio(problema);
    ocorrencias[chave] ??= { arquivo: problema.arquivo, regra: problema.regra, quantidade: 0 };
    ocorrencias[chave].quantidade++;
  }
  return { versao: 1, origem: "Auditoria inicial; dívida técnica, não aprovação visual", ocorrencias };
}

export function compararBaseline(problemas, baseline) {
  if (baseline?.versao !== 1 || !baseline.ocorrencias || typeof baseline.ocorrencias !== "object") {
    throw new Error("Baseline de design inválido; não recrie a referência para esconder falhas.");
  }
  for (const [chave, valor] of Object.entries(baseline.ocorrencias)) {
    if (!/^[a-f0-9]{64}$/.test(chave) || !Number.isInteger(valor?.quantidade) || valor.quantidade < 1) {
      throw new Error("Ocorrência inválida no baseline de design.");
    }
  }
  const vistos = new Map();
  const novos = [];
  for (const problema of problemas) {
    const chave = chaveDesvio(problema), numero = (vistos.get(chave) ?? 0) + 1;
    vistos.set(chave, numero);
    if (numero > (baseline.ocorrencias[chave]?.quantidade ?? 0)) novos.push(problema);
  }
  const resolvidos = Object.entries(baseline.ocorrencias).flatMap(([chave, valor]) => {
    const quantidade = valor.quantidade - (vistos.get(chave) ?? 0);
    return quantidade > 0 ? [{ chave, ...valor, quantidade }] : [];
  });
  return { novos, resolvidos, existentes: problemas.length - novos.length };
}
