import type { ClienteEntrada } from "./dominio";
import { cobrancasDoCliente } from "./cliente-cobranca";

// Mesmo contrato do normalizador de nomes do Atendimento. Dados originais e
// alterações humanas não passam por esta transformação automaticamente.
const PARTICULAS = new Set(["de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos", "para", "por", "com", "a", "ao", "aos", "à", "às", "della", "del", "di", "du", "van", "von"]);

export function formatarNomeCliente(valor: string, manual = false): string {
  if (manual) return valor;
  return valor.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR").split(" ")
    .map(palavra => PARTICULAS.has(palavra) ? palavra : palavra.replace(/(^|[-'’])(\p{L})/gu, (_, prefixo: string, letra: string) => prefixo + letra.toLocaleUpperCase("pt-BR")))
    .join(" ");
}

const CAMPOS_NOME = ["nome", "primeiroNome", "sobrenome", "razaoSocial", "contato", "nomeContato", "sobrenomeContato"] as const;
export function formatarNomesClienteNovo<T extends ClienteEntrada>(cliente: T): T {
  if (cliente.id) return cliente;
  const resultado = { ...cliente };
  for (const campo of CAMPOS_NOME) {
    const valor = resultado[campo];
    if (typeof valor === "string") Object.assign(resultado, { [campo]: formatarNomeCliente(valor) });
  }
  if (resultado.enderecos[0]?.tipo) resultado.enderecos = cobrancasDoCliente(resultado);
  return resultado;
}

/** Troca a natureza sem descartar os nomes pessoais ou levar CPF para o CNPJ. */
export function alterarTipoClientePreservandoNomes(cliente: ClienteEntrada, tipo: "PF" | "PJ"): ClienteEntrada {
  if (cliente.tipo === tipo) return { ...cliente, tipoEscolhido: true };
  const partes = cliente.nome.trim().split(/\s+/);
  if (tipo === "PJ") {
    const nomeContato = cliente.nomeContato || cliente.primeiroNome || partes[0] || "";
    const sobrenomeContato = cliente.sobrenomeContato || cliente.sobrenome || partes.slice(1).join(" ");
    return { ...cliente, tipo, tipoEscolhido: true, documento: null, nome: cliente.razaoSocial || "",
      nomeContato, sobrenomeContato, contato: [nomeContato, sobrenomeContato].filter(Boolean).join(" ") || cliente.contato };
  }
  const primeiroNome = cliente.nomeContato || cliente.primeiroNome || "";
  const sobrenome = cliente.sobrenomeContato || cliente.sobrenome || "";
  return { ...cliente, tipo, tipoEscolhido: true, documento: null, primeiroNome, sobrenome,
    nome: [primeiroNome, sobrenome].filter(Boolean).join(" ") };
}

type IdentidadeAnterior = Pick<ClienteEntrada, "tipo" | "nome" | "primeiroNome" | "sobrenome" | "nomeContato" | "sobrenomeContato" | "contato" | "razaoSocial">;
/** Proteção no servidor para clientes legados que ainda limpam os campos no DTO. */
export function preservarNomesNaMudancaTipo(antes: IdentidadeAnterior | null, entrada: ClienteEntrada): ClienteEntrada {
  if (!antes || antes.tipo === entrada.tipo) return entrada;
  const base = alterarTipoClientePreservandoNomes({ ...entrada, ...antes }, entrada.tipo);
  const campos = ["primeiroNome", "sobrenome", "nomeContato", "sobrenomeContato"] as const;
  const resultado = { ...entrada };
  for (const campo of campos) if (!resultado[campo] && base[campo]) resultado[campo] = base[campo];
  if (entrada.tipo === "PJ") resultado.contato = [resultado.nomeContato, resultado.sobrenomeContato].filter(Boolean).join(" ") || entrada.contato || base.contato;
  return resultado;
}

export type EvidenciaNaturezaCliente = {
  tipo: "PF" | "PJ";
  motivos: ("EMPRESA_INFORMADA" | "NOME_EMPRESARIAL" | "DOMINIO_CORPORATIVO_COMPROVADO")[];
  empresaInformada: string | null;
  dominiosComprovados: string[];
};
const MARCADOR_EMPRESA = /\b(?:ltda|limitada|eireli|s\.?\s*\/\s*a\.?|s\.a\.|epp|llc|inc|corporation|holding|grupo|associa[cç][aã]o|instituto|funda[cç][aã]o|prefeitura|universidade|hospital|hotel|restaurante|cl[ií]nica|engenharia|consultoria|ind[uú]stria|com[eé]rcio|construtora|arquitetura|tecnologia|ag[eê]ncia|banco)(?=$|[^\p{L}\p{N}])/iu;
const DOMINIOS_EMAIL_PESSOAL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br", "live.com", "live.com.br", "msn.com",
  "yahoo.com", "yahoo.com.br", "ymail.com", "rocketmail.com", "icloud.com", "me.com", "mac.com", "aol.com", "aim.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "ibest.com.br", "itelefonica.com.br", "superig.com.br", "r7.com", "globo.com", "globo.com.br", "globoemail.com",
  "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "mail.com", "yandex.com", "yandex.ru", "sapo.pt", "fastmail.com", "zoho.com", "zohomail.com",
]);
/** O titular de um provedor compartilhado não identifica a empresa compradora. */
export function dominioEmailPessoal(dominio: string): boolean {
  const valor = dominio.trim().toLowerCase();
  return DOMINIOS_EMAIL_PESSOAL.has(valor) || /^(?:gmail|googlemail|hotmail|outlook|live|yahoo|aol|protonmail|proton|gmx|yandex)\./.test(valor);
}

/** Domínio não gratuito sozinho não comprova empresa; exige prova do titular. */
export function classificarNaturezaCliente(fonte: { empresa?: string | null; nome?: string | null; primeiroNome?: string | null; sobrenome?: string | null; emails?: string[] }, dominiosEmpresariais: ReadonlySet<string> = new Set()): EvidenciaNaturezaCliente {
  const empresaInformada = fonte.empresa?.trim() || null;
  const motivos: EvidenciaNaturezaCliente["motivos"] = [];
  if (empresaInformada) motivos.push("EMPRESA_INFORMADA");
  if ([fonte.nome, fonte.primeiroNome, fonte.sobrenome].some(v => v && MARCADOR_EMPRESA.test(v))) motivos.push("NOME_EMPRESARIAL");
  const dominiosComprovados = [...new Set((fonte.emails ?? []).map(email => email.trim().toLocaleLowerCase("pt-BR").split("@")[1] ?? "").filter(dominio => !dominioEmailPessoal(dominio) && dominiosEmpresariais.has(dominio)))].sort();
  if (dominiosComprovados.length) motivos.push("DOMINIO_CORPORATIVO_COMPROVADO");
  return { tipo: motivos.length ? "PJ" : "PF", motivos, empresaInformada, dominiosComprovados };
}

/** Valida os dígitos verificadores; a prova cadastral continua sendo obrigatória. */
export function cnpjNumericoValido(valor: string): boolean {
  const cnpj = valor.replace(/[.\-/\s]/g, "");
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcular = (base: string) => {
    let peso = base.length - 7;
    const soma = [...base].reduce((acumulado, digito) => { const parcela = Number(digito) * peso; peso = peso === 2 ? 9 : peso - 1; return acumulado + parcela; }, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calcular(cnpj.slice(0, 12)) === Number(cnpj[12]) && calcular(cnpj.slice(0, 13)) === Number(cnpj[13]);
}
