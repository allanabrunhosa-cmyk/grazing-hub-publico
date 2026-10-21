import { consultarCepVenda } from "./cep";

export type BairroPorCepHistorico = {
  cep: string;
  bairro: string;
  cidade: string;
  uf: string;
  consultadoEm: string;
};

export type SnapshotBairrosPorCep = {
  versao: 1;
  origem: "VIACEP";
  consultadoEm: string;
  resultados: Record<string, BairroPorCepHistorico | { erro: string }>;
};

export type DependenciasConsultaBairrosPorCep = {
  consultarCep?: typeof consultarCepVenda;
  pausar?: (milissegundos: number) => Promise<void>;
  agora?: () => Date;
};

/** Prepara somente metadados postais. Não grava pedidos nem envia endereços pessoais. */
export async function consultarBairrosPorCep(ceps: string[], dependencias: DependenciasConsultaBairrosPorCep = {}): Promise<SnapshotBairrosPorCep> {
  // Valida o lote inteiro antes da primeira chamada. Hífen e espaços externos são formatação.
  if (!Array.isArray(ceps) || ceps.some(cep => typeof cep !== "string" || !/^\d{5}-?\d{3}$/u.test(cep.trim()))) {
    throw new Error("Informe somente CEPs com oito dígitos.");
  }
  const distintos = [...new Set(ceps.map(cep => cep.trim().replace("-", "")))];
  const consultar = dependencias.consultarCep ?? consultarCepVenda;
  const pausar = dependencias.pausar ?? (milissegundos => new Promise<void>(resolve => setTimeout(resolve, milissegundos)));
  const agora = dependencias.agora ?? (() => new Date());
  const snapshot: SnapshotBairrosPorCep = { versao: 1, origem: "VIACEP", consultadoEm: agora().toISOString(), resultados: {} };

  for (let indice = 0; indice < distintos.length; indice++) {
    if (indice > 0) await pausar(300);
    const cep = distintos[indice];
    try {
      // consultarCepVenda conserva o provedor existente e seu timeout de cinco segundos.
      const resposta = await consultar(cep);
      if (!resposta.endereco) {
        snapshot.resultados[cep] = { erro: resposta.erro || "Consulta postal indisponível." };
        continue;
      }
      const { bairro, cidade, uf } = resposta.endereco;
      const cidadePostal = cidade.trim().slice(0, 120), ufPostal = uf.trim().toUpperCase();
      if (!cidadePostal || !/^[A-Z]{2}$/u.test(ufPostal)) {
        snapshot.resultados[cep] = { erro: "Consulta postal sem cidade ou UF válidas." };
        continue;
      }
      // O bairro vazio é legítimo em CEPs genéricos. Não usa cidade como substituto.
      snapshot.resultados[cep] = { cep, bairro: bairro.trim().slice(0, 120), cidade: cidadePostal, uf: ufPostal, consultadoEm: agora().toISOString() };
    } catch {
      snapshot.resultados[cep] = { erro: "Consulta postal indisponível. Tente novamente." };
    }
  }
  return snapshot;
}
