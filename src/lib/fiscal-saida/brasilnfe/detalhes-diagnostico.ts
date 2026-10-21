import "server-only";
import { LIMITE_STATUS_OBSERVADO_BRASILNFE } from "./diagnostico-http";
import type {
  CampoCodigoDiagnosticoBrasilNfe, CampoMotivoBrasilNfe, CampoTextoDiagnosticoBrasilNfe,
  DetalhesDiagnosticoServicosBrasilNfe, EstadoStatusFornecedorBrasilNfe, IndicadorMotivoBrasilNfe,
  MetadadosErroBrasilNfe, TipoStatusFornecedorBrasilNfe,
} from "./diagnostico-http";

export const LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE = Object.freeze({ itens: 5, codigo: 48, texto: 300, validadeMs: 300_000 });
const temporarios = new WeakMap<object, Readonly<{ detalhes: DetalhesDiagnosticoServicosBrasilNfe; expiraEm: number }>>();

/** Consumo único, no servidor. Não grava texto em Error, banco, evento, log ou causa. */
export function obterDetalhesTemporariosErroBrasilNfe(erro: unknown): DetalhesDiagnosticoServicosBrasilNfe | null {
  if (!erro || typeof erro !== "object") return null;
  const entrada = temporarios.get(erro);
  temporarios.delete(erro);
  return entrada && entrada.expiraEm > Date.now() ? entrada.detalhes : null;
}

export function guardarDetalhesTemporariosErroBrasilNfe(erro: object, detalhes: DetalhesDiagnosticoServicosBrasilNfe): void {
  temporarios.set(erro, Object.freeze({ detalhes, expiraEm: Date.now() + LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.validadeMs }));
}

type Objeto = Record<string, unknown>;
type Credenciais = Readonly<{ token: string; userToken?: string }>;
const normalizar = (texto: string) => texto.normalize("NFKC").toLowerCase();
const compactar = (texto: string) => normalizar(texto).replace(/[\s\p{C}\p{P}\p{S}]/gu, "");

function refleteCredencial(valor: string, credenciais: Credenciais): boolean {
  const texto = normalizar(valor), compacto = compactar(valor);
  return [credenciais.token, credenciais.userToken].some((segredo) => {
    if (!segredo) return false;
    const formas = [segredo, encodeURIComponent(segredo), Buffer.from(segredo).toString("base64"), Buffer.from(segredo).toString("base64url"), Buffer.from(segredo).toString("hex")];
    return formas.some((forma) => texto.includes(normalizar(forma)) || (compactar(forma).length > 0 && compacto.includes(compactar(forma))));
  });
}

// A projeção conserva contexto técnico; palavras desconhecidas não atravessam a fronteira.
const PALAVRAS_TECNICAS = new Set(("a ao aos as com da das de do dos e em entre esta este estes essa esse foi ha na nas no nos o os ou para pela pelo por que se sem sua seu suas seus um uma "
  + "acesso acessos acessar adquirir adicionar administrador administrativa administrativo assinatura assinaturas ativo ativa ativado ativada ativar atualizar atualizacao autenticacao autenticar autorizado autorizada autorizacao "
  + "bloqueado bloqueada bloqueio brasil brasilnfe cadastro cadastrado cadastrada certificado certificados chave chaves cliente clientes codigo codigos concluido concluida configuracao configuracoes configurar conexao consulta consultar conta contratado contratada contratar contrato correcao credencial credenciais "
  + "dados disponivel documento documentos emissao emitir empresa empresas erro erros executar existente expirado expirada falha fiscal fiscais formato homologacao http indisponivel incorreto incorreta informacao informacoes informado informada informar invalido invalida limite login modelo nao nfe nfce nf nfc nota notas numero numerico "
  + "obrigatorio obrigatoria operacao operacoes parametro parametros pendente permissao permissoes permite permitido permitida possui prazo preenchido preenchida problema processamento producao protocolo recebido recebida recusado recusada registro registradas registrados requisicao resposta restrito restrita retorne retornar sem senha senhas servico servicos sistema solicitacao solicitado solicitada status sucesso tempo tente tentativa token tokens usertoken usuario usuarios validar validacao valido valida verifique vinculo "
  + "access authentication authorization denied error invalid permission permissions service services unavailable forbidden required not configured token user company status request response failed timeout retry "
  + "disabled enabled credential credentials provider new unknown code codes unauthorized authorized active inactive operation license available registered found missing check account scope "
  + "habilitado habilitada habilitar desabilitado desabilitada encontrada encontrado habilitacao insuficiente incorretas incorretos inexistente necessario necessaria necessario novamente contratado contratacao identificador interno capacidade pagamento vencido vencida expiracao suprimido").split(/\s+/));
const PALAVRAS_AUXILIARES = new Set("a ao aos as com da das de do dos e em entre esta este estes essa esse foi ha na nas no nos o os ou para pela pelo por que se sem sua seu suas seus um uma suprimido".split(" "));
const RAIZES_TECNICAS = /^(?:conced|confer|consult|vincul|pertenc|grupo|contrat|servic|configur|habilit|ativ|expir|invalid|valid|recus|process|transmit|consum|sincroniz|atualiz|execut|solicit|verific|corrig|reinici|integr|encerr|acess|devolv|document|certific|assin|emit|exced|preench|encontr)(?:a|o|e|as|os|es|s|ar|er|ir|ado|ada|ados|adas|ido|ida|idos|idas|ando|endo|indo|acao|acoes|ivel|iveis)?$/;
function palavraTecnica(palavra: string): boolean { return palavra.length <= 32 && (PALAVRAS_TECNICAS.has(palavra) || RAIZES_TECNICAS.test(palavra)); }

function projetarTextoTecnico(valor: string, codigo: boolean): string | null {
  if (/[\p{C}<>@\\]/u.test(valor) || /&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(valor)) return null;
  if (/(?:https?:|www\.|[a-z\d-]+\.(?:com|br|net|org|io)\b)/i.test(valor)) return null;
  if (valor.replace(/\D/g, "").length >= 7) return null;
  if (/\b(?:cnpj|cpf|telefone|celular|email|e-mail|nome|razao|fantasia|endereco|cep|contato)\b/i.test(valor)) return null;
  if (/\b(?:token|usertoken|senha|secret|password|chave|credencial)\s*[:=]/i.test(valor)) return null;
  if (/^eyJ[\w-]+\.[\w-]+(?:\.[\w-]+)?$/.test(valor) || /^[a-f\d]{16,}$/i.test(valor)) return null;
  const simples = valor.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  if (!/^[a-z\d\s.,:;!?()_/[\]-]+$/.test(simples)) return null;
  if (codigo && (/^(?:[a-z]{1,4}[-_:]?)?\d{1,6}$/i.test(valor) || (/^[A-Z][A-Z\d]*(?:[_:-][A-Z\d]+)+$/.test(valor)
    && valor.split(/[_:-]/).every((segmento) => segmento.length <= 20 && !/^[a-f\d]{16,}$/i.test(segmento)
      && (palavraTecnica(segmento.toLowerCase()) || /^(?:[A-Z]{1,4})?\d{1,6}$/.test(segmento)))))) return valor;
  const palavras = simples.match(/[a-z]+/g) ?? [];
  if (!palavras.length) return null;
  if (palavras.every(palavraTecnica)) return valor;
  if (codigo) return null;
  const uteis = palavras.filter((palavra) => palavraTecnica(palavra) && !PALAVRAS_AUXILIARES.has(palavra));
  if (uteis.length < 2) return null;
  return valor.replace(/[\p{L}\p{M}\d]+/gu, (palavra) => {
    const forma = palavra.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    return palavraTecnica(forma) ? palavra : "[suprimido]";
  }).replace(/(?:\[suprimido\]\s*){2,}/g, "[suprimido] ").trim();
}

function campoTexto(dados: Objeto, chave: string, limite: number, credenciais: Credenciais, codigo = false): CampoTextoDiagnosticoBrasilNfe {
  if (!Object.hasOwn(dados, chave)) return Object.freeze({ estado: "AUSENTE", valor: null });
  const valor = dados[chave];
  if (typeof valor !== "string") return Object.freeze({ estado: "FORMATO_INVALIDO", valor: null });
  if (valor.length > limite || /\p{C}/u.test(valor)) return Object.freeze({ estado: "SUPRIMIDO", valor: null });
  let texto = valor.trim();
  if (!texto) return Object.freeze({ estado: "VAZIO", valor: null });
  if (refleteCredencial(texto, credenciais)) {
    if (codigo) return Object.freeze({ estado: "SUPRIMIDO", valor: null });
    const segredos = [credenciais.token, credenciais.userToken].filter((segredo): segredo is string => !!segredo).sort((a, b) => b.length - a.length);
    if (segredos.some((segredo) => normalizar(texto) === normalizar(segredo))) return Object.freeze({ estado: "SUPRIMIDO", valor: null });
    for (const segredo of segredos) {
      if (!segredo) continue;
      texto = texto.replace(new RegExp(segredo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[suprimido]");
    }
    if (texto === "[suprimido]" || refleteCredencial(texto, credenciais)) return Object.freeze({ estado: "SUPRIMIDO", valor: null });
  }
  const projetado = projetarTextoTecnico(texto, codigo);
  if (!projetado || refleteCredencial(projetado, credenciais)) return Object.freeze({ estado: "SUPRIMIDO", valor: null });
  return Object.freeze({ estado: "EXIBIDO", valor: projetado });
}

function campoCodigo(dados: Objeto, credenciais: Credenciais): CampoCodigoDiagnosticoBrasilNfe {
  if (typeof dados.codigo !== "number") return campoTexto(dados, "codigo", LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.codigo, credenciais, true);
  if (refleteCredencial(String(dados.codigo), credenciais)) return Object.freeze({ estado: "SUPRIMIDO", valor: null });
  if (!Number.isSafeInteger(dados.codigo) || Math.abs(dados.codigo) > LIMITE_STATUS_OBSERVADO_BRASILNFE) return Object.freeze({ estado: "FORMATO_INVALIDO", valor: null });
  return Object.freeze({ estado: "EXIBIDO", valor: dados.codigo });
}

/** Metadados do envelope de ConsultarNotaFiscal. Nenhum texto, item de erro ou
 * configuração da empresa é extraído. A observação não altera a aceitação. */
export function observarEnvelopeConsultaNotaBrasilNfe(dados: Objeto, credenciais: Credenciais): Partial<MetadadosErroBrasilNfe> {
  const indicadores = new Set<IndicadorMotivoBrasilNfe>(), camposAusentes = new Set<CampoMotivoBrasilNfe>(), camposSuprimidos = new Set<CampoMotivoBrasilNfe>();
  const status = dados.status;
  let tipo: TipoStatusFornecedorBrasilNfe, estado: EstadoStatusFornecedorBrasilNfe, valor: number | boolean | null = null;
  if (!Object.hasOwn(dados, "status")) { tipo = "AUSENTE"; estado = "AUSENTE"; camposAusentes.add("STATUS"); }
  else if (status === null) { tipo = "NULO"; estado = "NULO"; }
  else if (typeof status === "number" || typeof status === "boolean") {
    tipo = typeof status === "number" ? "NUMERO" : "BOOLEANO";
    if (status === false) indicadores.add("STATUS_FALSE");
    if (typeof status === "number" && status !== 0) indicadores.add("STATUS_NUMERICO_NAO_ZERO");
    if (refleteCredencial(String(status), credenciais)) { estado = "SUPRIMIDO_SEGREDO"; camposSuprimidos.add("STATUS"); }
    else if (typeof status === "number" && !Number.isSafeInteger(status)) estado = "INCOMPATIVEL";
    else if (typeof status === "number" && Math.abs(status) > LIMITE_STATUS_OBSERVADO_BRASILNFE) estado = "FORA_LIMITE";
    else { valor = status; estado = status === false ? "FALSE" : status === true ? "TRUE" : status === 0 ? "ZERO" : "NUMERO_NAO_ZERO"; }
  } else { tipo = "OUTRO"; estado = "INCOMPATIVEL"; }
  if (!Object.hasOwn(dados, "Error")) camposAusentes.add("ERROR");
  if (typeof dados.Error === "string" && dados.Error.trim()) indicadores.add("ERROR_PREENCHIDO");
  if (!Object.hasOwn(dados, "erros")) camposAusentes.add("ERROS");
  if (Array.isArray(dados.erros) && dados.erros.length) indicadores.add("ERROS_PREENCHIDOS");
  if (tipo !== "NUMERO" || !Number.isSafeInteger(status) || !Array.isArray(dados.erros) || dados.erros.length > 1000 || (dados.Error != null && typeof dados.Error !== "string")) indicadores.add("FORMATO_INCOMPATIVEL");
  return { statusFornecedor: valor, tipoStatusFornecedor: tipo, estadoStatusFornecedor: estado, indicadores: [...indicadores], camposAusentes: [...camposAusentes], camposSuprimidos: [...camposSuprimidos] };
}

/** Projeção restrita exclusiva de ConsultarServicos; mantém a rejeição operacional original. */
export function prepararDiagnosticoServicosBrasilNfe(dados: Objeto, credenciais: Credenciais, contratoInvalido: boolean): Readonly<{
  metadados: Partial<MetadadosErroBrasilNfe>; detalhes: DetalhesDiagnosticoServicosBrasilNfe;
}> {
  const indicadores = new Set<IndicadorMotivoBrasilNfe>(), ausentes = new Set<CampoMotivoBrasilNfe>(), suprimidos = new Set<CampoMotivoBrasilNfe>();
  const registrar = (campo: CampoMotivoBrasilNfe, valor: CampoTextoDiagnosticoBrasilNfe | CampoCodigoDiagnosticoBrasilNfe) => {
    if (valor.estado === "AUSENTE") ausentes.add(campo);
    if (valor.estado === "FORMATO_INVALIDO") contratoInvalido = true;
    if (valor.estado === "SUPRIMIDO" || valor.estado === "FORMATO_INVALIDO" || (typeof valor.valor === "string" && valor.valor.includes("[suprimido]"))) suprimidos.add(campo);
  };
  const error = campoTexto(dados, "Error", LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.texto, credenciais);
  registrar("ERROR", error);
  if (typeof dados.Error === "string" && dados.Error.trim()) indicadores.add("ERROR_PREENCHIDO");
  if (dados.Error != null && typeof dados.Error !== "string") contratoInvalido = true;
  if (!Object.hasOwn(dados, "Servicos")) ausentes.add("SERVICOS");
  const lista = Array.isArray(dados.erros) ? dados.erros : [];
  if (!Object.hasOwn(dados, "erros")) ausentes.add("ERROS");
  if (lista.length) indicadores.add("ERROS_PREENCHIDOS");
  if (!Array.isArray(dados.erros) || lista.length > 1000 || lista.some((item) => !item || typeof item !== "object" || Array.isArray(item))) { contratoInvalido = true; suprimidos.add("ERROS"); }
  if (lista.length > LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.itens) suprimidos.add("ERROS");
  const erros = lista.slice(0, LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.itens).map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      const invalido = Object.freeze({ estado: "FORMATO_INVALIDO" as const, valor: null });
      for (const campo of ["ERROS_CODIGO", "ERROS_DESCRICAO", "ERROS_CORRECAO"] as const) registrar(campo, invalido);
      return Object.freeze({ codigo: invalido, descricao: invalido, correcao: invalido });
    }
    const registro: Objeto = item as Objeto;
    const codigo = campoCodigo(registro, credenciais), descricao = campoTexto(registro, "descricao", LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.texto, credenciais), correcao = campoTexto(registro, "correcao", LIMITES_DETALHES_DIAGNOSTICO_BRASILNFE.texto, credenciais);
    registrar("ERROS_CODIGO", codigo); registrar("ERROS_DESCRICAO", descricao); registrar("ERROS_CORRECAO", correcao);
    return Object.freeze({ codigo, descricao, correcao });
  });
  const status = dados.status;
  let tipo: TipoStatusFornecedorBrasilNfe, estado: EstadoStatusFornecedorBrasilNfe, statusFornecedor: number | boolean | null = null;
  if (!Object.hasOwn(dados, "status")) { tipo = "AUSENTE"; estado = "AUSENTE"; ausentes.add("STATUS"); }
  else if (status === null) { tipo = "NULO"; estado = "NULO"; }
  else if (typeof status === "number") {
    tipo = "NUMERO";
    if (status !== 0) indicadores.add("STATUS_NUMERICO_NAO_ZERO");
    if (refleteCredencial(String(status), credenciais)) { estado = "SUPRIMIDO_SEGREDO"; suprimidos.add("STATUS"); }
    else if (!Number.isSafeInteger(status)) estado = "INCOMPATIVEL";
    else if (Math.abs(status) > LIMITE_STATUS_OBSERVADO_BRASILNFE) estado = "FORA_LIMITE";
    else { estado = status === 0 ? "ZERO" : "NUMERO_NAO_ZERO"; statusFornecedor = status; }
  } else if (typeof status === "boolean") {
    tipo = "BOOLEANO";
    if (status === false) indicadores.add("STATUS_FALSE");
    if (refleteCredencial(String(status), credenciais)) { estado = "SUPRIMIDO_SEGREDO"; suprimidos.add("STATUS"); }
    else { estado = status ? "TRUE" : "FALSE"; statusFornecedor = status; }
  } else { tipo = "OUTRO"; estado = "INCOMPATIVEL"; }
  if (tipo !== "NUMERO" || !Number.isSafeInteger(status)) contratoInvalido = true;
  if (estado === "FORA_LIMITE" || estado === "INCOMPATIVEL") suprimidos.add("STATUS");
  if (contratoInvalido) indicadores.add("FORMATO_INCOMPATIVEL");
  const camposAusentes = Object.freeze([...ausentes]), camposSuprimidos = Object.freeze([...suprimidos]);
  return Object.freeze({
    metadados: Object.freeze({ statusFornecedor, tipoStatusFornecedor: tipo, estadoStatusFornecedor: estado, indicadores: Object.freeze([...indicadores]), camposAusentes, camposSuprimidos }),
    detalhes: Object.freeze({ error, erros: Object.freeze(erros), quantidadeErros: Array.isArray(dados.erros) && lista.length <= 1000 ? lista.length : null, camposAusentes, camposSuprimidos }),
  });
}
