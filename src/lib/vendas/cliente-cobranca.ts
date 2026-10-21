import type { ClienteEntrada, EnderecoVenda, IdentidadeCobranca } from "./dominio";

export const LIMITE_COBRANCAS_CLIENTE = 250;

export const nomeAbaCobranca = (indice: number) => indice === 0 ? "Principal" : `Cobrança ${indice + 1}`;

export function copiarEnderecoCobranca(endereco: Omit<EnderecoVenda, "nome" | "destinatario">) {
  const { pais, cep, logradouro, numero, complemento, bairro, cidade, uf, codigoMunicipio } = endereco;
  return { pais, cep, logradouro, numero, complemento, bairro, cidade, uf, ...(codigoMunicipio ? { codigoMunicipio } : {}) };
}

type ClienteCobranca = Pick<ClienteEntrada, "tipo" | "nome" | "documento" | "razaoSocial" | "inscricaoEstadual" | "enderecos"> & Partial<Pick<ClienteEntrada, "telefone">>;

/** A cópia usa o titular e o telefone da cobrança selecionada. */
export function copiarCobrancaParaEntrega(cobranca: EnderecoVenda, cliente: Pick<ClienteEntrada, "telefone" | "contato">, principal: boolean) {
  const nome = cobranca.tipo === "PF" ? cobranca.nomeCompleto?.trim() ?? "" :
    (principal ? cliente.contato?.trim() : "") || cobranca.destinatario?.trim() || cobranca.razaoSocial?.trim() || "";
  return { endereco: copiarEnderecoCobranca(cobranca), destinatario: { nome, contato: (principal ? cliente.telefone : cobranca.telefone) ?? "" } };
}

/** Recupera dados da primeira versão sem apagar documentos guardados apenas no JSON. */
export function identidadePrincipalCliente(cliente: ClienteCobranca): IdentidadeCobranca {
  const principal = cliente.enderecos[0];
  const anterior = principal?.tipo === cliente.tipo ? principal : undefined;
  return { tipo: cliente.tipo, nomeCompleto: cliente.tipo === "PF" ? cliente.nome : "",
    documento: cliente.documento ?? anterior?.documento ?? "",
    razaoSocial: cliente.tipo === "PJ" ? cliente.razaoSocial || anterior?.razaoSocial || "" : "",
    inscricaoEstadual: cliente.tipo === "PJ" ? cliente.inscricaoEstadual || anterior?.inscricaoEstadual || "" : "",
    inscricaoMunicipal: cliente.tipo === "PJ" ? anterior?.inscricaoMunicipal || "" : "",
    ...("telefone" in cliente ? { telefone: cliente.telefone ?? "" } : anterior?.telefone === undefined ? {} : { telefone: anterior.telefone }) };
}

/** Principal acompanha o cadastro. Cobranças adicionais conservam titular próprio. */
export function cobrancasDoCliente(cliente: ClienteCobranca, vincularPrincipal = true): EnderecoVenda[] {
  return cliente.enderecos.map((endereco, indice) => indice === 0 && vincularPrincipal ? { ...endereco, ...identidadePrincipalCliente(cliente) } : endereco.tipo ? endereco : ({ ...endereco,
    tipo: cliente.tipo, nomeCompleto: cliente.tipo === "PF" ? cliente.nome : "", documento: cliente.documento ?? "", razaoSocial: cliente.razaoSocial ?? "", inscricaoEstadual: cliente.inscricaoEstadual ?? "", inscricaoMunicipal: "",
  }));
}

/** A identidade fiscal vem integralmente da cobrança selecionada. Sem mistura com o comprador. */
export function identidadeFiscalCobranca<T extends Record<string, unknown>>(comprador: T, cobranca: unknown): T & Partial<IdentidadeCobranca> {
  if (!cobranca || typeof cobranca !== "object" || Array.isArray(cobranca)) return comprador;
  const c = cobranca as Record<string, unknown>;
  if (c.tipo !== "PF" && c.tipo !== "PJ") return comprador;
  return { ...comprador, tipo: c.tipo, nome: String(c.tipo === "PF" ? c.nomeCompleto ?? "" : c.razaoSocial ?? ""), documento: String(c.documento ?? ""),
    razaoSocial: String(c.razaoSocial ?? ""), inscricaoEstadual: String(c.inscricaoEstadual ?? ""), inscricaoMunicipal: String(c.inscricaoMunicipal ?? "") };
}
