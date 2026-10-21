/** Consulta postal compartilhada; cada ação exige a permissão do seu próprio módulo. */
import { codigoMunicipioCompativel } from "./municipio";
export async function consultarCepVenda(cep: string) {
  const digitos = typeof cep === "string" ? cep.replace(/\D/g, "") : "";
  if (!/^\d{8}$/.test(digitos)) return { erro: "Informe os oito dígitos do CEP." };
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!resposta.ok) return { erro: "Consulta do CEP indisponível. Tente novamente." };
    const dados = await resposta.json() as Record<string, unknown>;
    if (dados.erro) return { erro: "CEP não encontrado. Confira o CEP e tente novamente." };
    const campo = (chave: string, limite: number) => typeof dados[chave] === "string" ? dados[chave].slice(0, limite) : "";
    const uf = campo("uf", 2).toUpperCase();
    const codigoMunicipio = campo("ibge", 20);
    return { endereco: { logradouro: campo("logradouro", 200), bairro: campo("bairro", 120), cidade: campo("localidade", 120), uf,
      ...(codigoMunicipioCompativel(codigoMunicipio, uf) ? { codigoMunicipio } : {}) } };
  } catch { return { erro: "Consulta do CEP indisponível. Tente novamente." }; }
}
