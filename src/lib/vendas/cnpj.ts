import { cnpjNumericoValido } from "./clientes-identidade";
import type { EnderecoVenda, IdentidadeCobranca } from "./dominio";
import { CODIGOS_UF_IBGE, codigoMunicipioCompativel } from "./municipio";

export type FonteConsultaCnpjVenda = "BRASILAPI_CNPJ_V1" | "MINHA_RECEITA_CNPJ_V1";
type ConsultaCnpjVenda = { erro?: string; aviso?: string; fonte?: FonteConsultaCnpjVenda; cadastro?: { razaoSocial: string; endereco: Omit<EnderecoVenda, "nome" | "destinatario" | keyof IdentidadeCobranca> } };
const INDISPONIVEL: ConsultaCnpjVenda = { erro: "Consulta do CNPJ indisponível. Tente novamente." };
const TEMPO_POR_FONTE_MS = 8000;

function normalizarCadastro(dados: unknown, documento: string, fonte: FonteConsultaCnpjVenda): ConsultaCnpjVenda {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return { erro: "Resposta do CNPJ inválida. Tente novamente." };
  const registro = dados as Record<string, unknown>;
  if (String(registro.cnpj).replace(/[.\-/\s]/g, "") !== documento) return { erro: "Resposta do CNPJ inválida. Tente novamente." };
  const campo = (chave: string, limite: number) => typeof registro[chave] === "string" ? registro[chave].trim().slice(0, limite) : "";
  const razaoSocial = campo("razao_social", 160);
  if (!razaoSocial) return { erro: "CNPJ sem razão social na consulta. Confira os dados." };
  const ufRecebida = campo("uf", 2).toUpperCase(), codigoMunicipio = String(registro.codigo_municipio_ibge ?? "");
  const uf = Object.hasOwn(CODIGOS_UF_IBGE, ufRecebida) ? ufRecebida : "";
  const cepRecebido = campo("cep", 9).replace(/\D/g, ""), cep = /^\d{8}$/.test(cepRecebido) ? cepRecebido : "";
  const logradouro = campo("logradouro", 160);
  const endereco = { pais: "Brasil", cep, logradouro: logradouro ? [campo("descricao_tipo_de_logradouro", 40), logradouro].filter(Boolean).join(" ").slice(0, 200) : "", numero: campo("numero", 30), complemento: campo("complemento", 160), bairro: campo("bairro", 120), cidade: campo("municipio", 120), uf,
    ...(codigoMunicipioCompativel(codigoMunicipio, uf) ? { codigoMunicipio } : {}) };
  const incompleto = ![endereco.cep, endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.uf].every(Boolean);
  return { fonte, cadastro: { razaoSocial, endereco }, ...(incompleto ? { aviso: "CNPJ consultado. O endereço está incompleto na fonte. Confira o CEP e complete os dados de cobrança." } : {}) };
}

/** null representa indisponibilidade; inconsistência cadastral encerra a consulta. */
async function consultarFonte(url: string, documento: string, fonte: FonteConsultaCnpjVenda, timeout: number): Promise<ConsultaCnpjVenda | null> {
  const controle = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const expirou = new Promise<null>(resolve => {
    temporizador = setTimeout(() => { controle.abort(); resolve(null); }, timeout);
  });
  const buscar = async (): Promise<ConsultaCnpjVenda | null> => { try {
    const resposta = await fetch(url, { cache: "no-store", signal: controle.signal, redirect: "error" });
    if (!resposta.ok) {
      if (resposta.status === 404) return { erro: "CNPJ não encontrado. Confira o número." };
      if (resposta.status === 403 || resposta.status === 429 || resposta.status >= 500) return null;
      return INDISPONIVEL;
    }
    // HTML de bloqueio ou corpo ilegível permite tentar a outra fonte fixa.
    let dados: unknown;
    try { dados = await resposta.json(); } catch { return null; }
    return normalizarCadastro(dados, documento, fonte);
  } catch { return null; } };
  // O prazo inclui a leitura do corpo, mesmo se o provedor não encerrar a resposta.
  try { return await Promise.race([buscar(), expirou]); }
  finally { if (temporizador !== undefined) clearTimeout(temporizador); }
}

/** Consulta pública, sem gravação. A ação chamadora autoriza o módulo. */
export async function consultarCnpjVenda(cnpj: string): Promise<ConsultaCnpjVenda> {
  const documento = typeof cnpj === "string" ? cnpj.replace(/[.\-/\s]/g, "") : "";
  if (!cnpjNumericoValido(documento)) return { erro: "Informe um CNPJ válido com 14 dígitos." };
  const prazo = Date.now() + TEMPO_POR_FONTE_MS * 2;
  // Minha Receita é também o upstream público usado pelo serviço CNPJ da BrasilAPI.
  const fontes: [FonteConsultaCnpjVenda, string][] = [
    ["BRASILAPI_CNPJ_V1", `https://brasilapi.com.br/api/cnpj/v1/${documento}`],
    ["MINHA_RECEITA_CNPJ_V1", `https://minhareceita.org/${documento}`],
  ];
  for (const [fonte, url] of fontes) {
    const restante = prazo - Date.now();
    if (restante <= 0) break;
    const resultado = await consultarFonte(url, documento, fonte, Math.min(TEMPO_POR_FONTE_MS, restante));
    if (resultado) return resultado;
  }
  return INDISPONIVEL;
}
