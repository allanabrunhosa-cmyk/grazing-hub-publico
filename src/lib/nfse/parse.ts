import { createHash } from "crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export const TAMANHO_MAXIMO_XML_NFSE = 1_500 * 1024;
export const DATA_MINIMA_NFSE = "2026-09-10";
export const DATA_MINIMA_NFSE_DATE = new Date(`${DATA_MINIMA_NFSE}T00:00:00.000Z`);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

type Registro = Record<string, unknown>;

function nomeSemNamespace(chave: string) {
  return chave.split(":").pop()!.toLowerCase();
}

function percorrer(valor: unknown, visita: (chave: string, valor: unknown, pai: Registro | null) => unknown): unknown {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const resultado = percorrer(item, visita);
      if (resultado !== undefined) return resultado;
    }
    return undefined;
  }
  if (!valor || typeof valor !== "object") return undefined;
  const registro = valor as Registro;
  for (const [chave, filho] of Object.entries(registro)) {
    const resultado = visita(chave, filho, registro);
    if (resultado !== undefined) return resultado;
    const descendente = percorrer(filho, visita);
    if (descendente !== undefined) return descendente;
  }
  return undefined;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" || typeof valor === "number") return String(valor).trim() || null;
  return null;
}

function primeiroTexto(documento: unknown, nomes: string[]): string | null {
  const aceitos = new Set(nomes.map(nome => nome.toLowerCase()));
  const valor = percorrer(documento, (chave, filho) => aceitos.has(nomeSemNamespace(chave)) ? texto(filho) : undefined);
  return texto(valor);
}

function registroPorNome(documento: unknown, nomes: string[]): Registro | null {
  const aceitos = new Set(nomes.map(nome => nome.toLowerCase()));
  const valor = percorrer(documento, (chave, filho) => {
    if (!aceitos.has(nomeSemNamespace(chave)) || !filho || typeof filho !== "object" || Array.isArray(filho)) return undefined;
    return filho;
  });
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : null;
}

function textoDoRegistro(registro: Registro | null, nomes: string[]) {
  if (!registro) return null;
  return primeiroTexto(registro, nomes);
}

// Identidade é lida somente no bloco da própria pessoa. Nunca atravessar
// irmãos (emit/prest/toma) nem usar o primeiro nome encontrado no documento.
function filhoDireto(registro: Registro | null, nomes: string[]): unknown {
  if (!registro) return undefined;
  const aceitos = new Set(nomes.map(nome => nome.toLowerCase()));
  return Object.entries(registro).find(([chave]) => aceitos.has(nomeSemNamespace(chave)))?.[1];
}

function blocoDireto(registro: Registro | null, nomes: string[]): Registro | null {
  const valor = filhoDireto(registro, nomes);
  if (Array.isArray(valor)) throw new Error("NFS-e com blocos de identificação duplicados.");
  return valor && typeof valor === "object" ? valor as Registro : null;
}

function campoPessoa(registro: Registro | null, nomes: string[]) {
  const identificacao = blocoDireto(registro, ["identificacaoPrestador", "identificacaoTomador", "identificacao"]);
  const documento = blocoDireto(registro, ["cpfCnpj"]) ?? blocoDireto(identificacao, ["cpfCnpj"]);
  return texto(filhoDireto(registro, nomes))
    ?? texto(filhoDireto(identificacao, nomes))
    ?? texto(filhoDireto(documento, nomes));
}

export type DadosPessoaNfse = {
  nome: string | null;
  cnpj: string | null;
  cpf: string | null;
  inscricaoMunicipal: string | null;
  email: string | null;
  telefone: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    municipio: string | null;
    codigoMunicipio: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
};

function dadosPessoa(registro: Registro | null): DadosPessoaNfse | null {
  if (!registro) return null;
  const cnpj = somenteDigitos(campoPessoa(registro, ["CNPJ"]));
  const cpf = somenteDigitos(campoPessoa(registro, ["CPF"]));
  const endereco = blocoDireto(registro, [
    "end", "ender", "endereco", "enderNac", "endNac", "enderecoPrestador", "enderecoTomador", "enderPrestador", "enderTomador",
  ]);
  const enderecoDados = endereco ? {
    logradouro: textoDoRegistro(endereco, ["xLgr", "logradouro", "endereco"]),
    numero: textoDoRegistro(endereco, ["nro", "numero", "numeroEndereco"]),
    complemento: textoDoRegistro(endereco, ["xCpl", "complemento", "complementoEndereco"]),
    bairro: textoDoRegistro(endereco, ["xBairro", "bairro"]),
    municipio: textoDoRegistro(endereco, ["xMun", "municipio", "cidade"]),
    codigoMunicipio: textoDoRegistro(endereco, ["cMun", "codigoMunicipio", "codigoIbge", "cidade"]),
    uf: textoDoRegistro(endereco, ["UF", "uf", "estado"]),
    cep: textoDoRegistro(endereco, ["CEP", "cep"]),
  } : null;
  const possuiEndereco = enderecoDados && Object.values(enderecoDados).some(Boolean);
  return {
    nome: campoPessoa(registro, ["xNome", "razaoSocial", "nome", "nomeRazaoSocial"]),
    cnpj,
    cpf,
    inscricaoMunicipal: campoPessoa(registro, ["IM", "inscricaoMunicipal", "inscricaoMunicipalPrestador"]),
    email: campoPessoa(registro, ["email"]),
    telefone: campoPessoa(registro, ["fone", "telefone", "telefoneContato"]),
    endereco: possuiEndereco ? enderecoDados : null,
  };
}

function somenteDigitos(valor: string | null) {
  return valor?.replace(/\D/g, "") || null;
}

function numero(valor: string | null): number | null {
  if (!valor) return null;
  const limpo = valor.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const resultado = Number(limpo);
  return Number.isFinite(resultado) ? resultado : null;
}

function data(valor: string | null): Date | null {
  if (!valor) return null;
  const normalizado = valor.trim();
  const resultado = /^\d{4}-\d{2}-\d{2}/.test(normalizado)
    ? new Date(`${normalizado.slice(0, 10)}T12:00:00.000Z`)
    : new Date(normalizado);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

function pessoaDoResumoMunicipal(nota: Registro | null, papel: "Prestador" | "Tomador", chave: Registro | null) {
  if (!nota) return null;
  const documento = blocoDireto(nota, [`CPFCNPJ${papel}`]);
  const nome = texto(filhoDireto(nota, [`RazaoSocial${papel}`]));
  if (!documento && !nome) return null;
  return {
    CPFCNPJ: documento,
    RazaoSocial: nome,
    InscricaoMunicipal: papel === "Prestador"
      ? texto(filhoDireto(chave, ["InscricaoPrestador"]))
      : texto(filhoDireto(nota, ["InscricaoMunicipalTomador"])),
    Endereco: blocoDireto(nota, [`Endereco${papel}`]),
    Email: texto(filhoDireto(nota, [`Email${papel}`])),
  } satisfies Registro;
}

function valorLiquidoDoResumoMunicipal(nota: Registro | null) {
  if (!nota) return null;
  const servicos = numero(texto(filhoDireto(nota, ["ValorServicos"])));
  if (servicos === null) return null;
  const retencoes = ["ValorPIS", "ValorCOFINS", "ValorINSS", "ValorIR", "ValorCSLL"]
    .reduce((total, campo) => total + (numero(texto(filhoDireto(nota, [campo]))) ?? 0), 0);
  const issRetido = ["1", "true", "s", "sim"].includes((texto(filhoDireto(nota, ["ISSRetido"])) ?? "").toLowerCase());
  const iss = issRetido ? numero(texto(filhoDireto(nota, ["ValorISS"]))) ?? 0 : 0;
  const liquido = Math.round((servicos - retencoes - iss) * 100) / 100;
  return liquido >= 0 ? liquido : null;
}

export type DadosNfse = {
  identificador: string;
  dpsIdentificador: string | null;
  dpsNumero: string | null;
  dpsSerie: string | null;
  dpsMunicipioCodigo: string | null;
  chaveAcesso: string | null;
  numero: string | null;
  serie: string | null;
  codigoVerificacao: string | null;
  prestadorCnpj: string | null;
  prestadorNome: string | null;
  tomadorCnpj: string | null;
  tomadorNome: string | null;
  prestadorDados: DadosPessoaNfse | null;
  tomadorDados: DadosPessoaNfse | null;
  valorServico: number | null;
  valorLiquido: number | null;
  valorIss: number | null;
  dataEmissao: Date | null;
  dataCompetencia: Date | null;
  municipioCodigo: string | null;
  municipioNome: string | null;
  uf: string | null;
};

export function extrairDadosNfse(xml: string, cnpjTomador?: string): DadosNfse {
  if (!xml.trim() || Buffer.byteLength(xml, "utf8") > TAMANHO_MAXIMO_XML_NFSE) throw new Error("Selecione um XML de NFS-e de até 1,5 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("O arquivo não contém um XML válido de NFS-e.");
  const documento = parser.parse(xml) as Registro;
  const identificadorXml = primeiroTexto(documento, ["chaveAcesso", "chaveNfse", "chNfse", "chaveNotaNacional", "Id", "@_Id"]);
  const chaveSemPrefixo = identificadorXml?.replace(/^NFS(?:e)?/i, "") ?? "";
  const chaveAcesso = /^\d{40,60}$/.test(chaveSemPrefixo) ? chaveSemPrefixo : null;
  const nfse = blocoDireto(documento, ["NFSe"]);
  const infNfse = blocoDireto(nfse, ["infNFSe"]);
  const infDps = blocoDireto(blocoDireto(infNfse, ["DPS"]), ["infDPS"]);
  const resumoMunicipal = registroPorNome(documento, ["NFe"]);
  const chaveMunicipal = blocoDireto(resumoMunicipal, ["ChaveNFe"]);
  const dpsIdentificador = texto(filhoDireto(infDps, ["@_id", "Id"]));
  const emitente = blocoDireto(infNfse, ["emit"]);
  const prestadorDps = blocoDireto(infDps, ["prest"]);
  const prestadorMunicipal = pessoaDoResumoMunicipal(resumoMunicipal, "Prestador", chaveMunicipal);
  const tomadorMunicipal = pessoaDoResumoMunicipal(resumoMunicipal, "Tomador", chaveMunicipal);
  const prestador = emitente ?? prestadorDps ?? prestadorMunicipal ?? registroPorNome(documento, ["prest", "prestador", "prestadorServico"]);
  const tomador = blocoDireto(infDps, ["toma"]) ?? tomadorMunicipal ?? registroPorNome(documento, ["toma", "tomador", "tomadorServico", "tomadorDoServico"]);
  const prestadorDados = dadosPessoa(prestador);
  const tomadorDados = dadosPessoa(tomador);
  const prestadorCnpj = prestadorDados?.cnpj ?? prestadorDados?.cpf ?? null;
  const tomadorCnpjExtraido = tomadorDados?.cnpj ?? tomadorDados?.cpf ?? null;
  const documentoDps = somenteDigitos(campoPessoa(prestadorDps, ["CNPJ", "CPF"]));
  if (emitente && prestadorDps && (!prestadorCnpj || !documentoDps || prestadorCnpj !== documentoDps)) {
    throw new Error("O CPF/CNPJ do emitente difere do prestador informado no DPS. Confira o XML da NFS-e.");
  }
  if (emitente && (!prestadorCnpj || !prestadorDados?.nome)) {
    throw new Error("O bloco do prestador da NFS-e não contém nome e CPF/CNPJ completos.");
  }
  const cnpjNormalizado = cnpjTomador?.replace(/\D/g, "") || null;
  if (cnpjNormalizado && tomadorCnpjExtraido && tomadorCnpjExtraido !== cnpjNormalizado) {
    throw new Error("Esta NFS-e não está emitida para o CNPJ configurado no sistema.");
  }

  const xmlHash = createHash("sha256").update(xml).digest("hex");
  const id = chaveAcesso ? `NFS${chaveAcesso}` : identificadorXml || `XML-${xmlHash}`;
  const valorServico = numero(primeiroTexto(documento, ["vServ", "valorServicos", "valorServico", "vlrServ"]));
  const valorLiquido = numero(primeiroTexto(documento, ["vLiq", "valorLiquidoNfse", "valorLiquido", "vlrLiq"]))
    ?? valorLiquidoDoResumoMunicipal(resumoMunicipal);
  const valorIss = numero(primeiroTexto(documento, ["vISSQN", "valorIss", "valorIssqn", "vlrIss"]));
  const dataEmissao = data(primeiroTexto(documento, ["dhEmi", "dataEmissao", "dataEmissaoNfe", "dataEmissaoNfse", "dtEmissao"]));
  const dataCompetencia = data(primeiroTexto(documento, ["dCompet", "competencia", "dataCompetencia", "dataFatoGeradorNFe"]));
  const numeroNota = primeiroTexto(documento, ["nNFSe", "numero", "numeroNfe", "numeroNfse", "numeroNota"]);
  const municipio = registroPorNome(documento, ["locEmi", "localEmissao", "municipioEmissao"]);
  const municipioCodigo = primeiroTexto(municipio ?? documento, ["cMun", "codigoMunicipio", "codigoIbge", "municipioPrestacao"])
    ?? chaveAcesso?.slice(0, 7) ?? null;

  return {
    identificador: id,
    dpsIdentificador,
    dpsNumero: textoDoRegistro(infDps, ["nDPS", "nDps", "numeroDps"]),
    dpsSerie: textoDoRegistro(infDps, ["serie", "serieDps"]),
    dpsMunicipioCodigo: textoDoRegistro(infDps, ["cLocEmi", "cMun", "codigoMunicipio", "codigoIbge"]),
    chaveAcesso,
    numero: numeroNota,
    serie: primeiroTexto(documento, ["serie", "serieNfse"]),
    codigoVerificacao: primeiroTexto(documento, ["cVerif", "codigoVerificacao", "codigoVerificacaoNfse"]),
    prestadorCnpj,
    prestadorNome: prestadorDados?.nome ?? null,
    tomadorCnpj: tomadorCnpjExtraido,
    tomadorNome: tomadorDados?.nome ?? null,
    prestadorDados,
    tomadorDados,
    valorServico,
    valorLiquido,
    valorIss,
    dataEmissao,
    dataCompetencia,
    municipioCodigo,
    municipioNome: primeiroTexto(municipio ?? documento, ["xMun", "municipio", "nomeMunicipio"]),
    uf: primeiroTexto(municipio ?? documento, ["UF", "uf", "siglaUf"]),
  };
}
