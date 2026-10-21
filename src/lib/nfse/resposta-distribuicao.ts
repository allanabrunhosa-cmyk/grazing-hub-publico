// Contrato oficial: /contribuintes/swagger/v1/swagger.json, GET /DFe/{NSU}.
// O HTTP 404 também usa LoteDistribuicaoNSUResponse; não basta olhar o HTTP.
type Registro = Record<string, unknown>;

function registro(valor: unknown): valor is Registro {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" ? valor.replace(/[\r\n\t]+/g, " ").slice(0, 500) : null;
}

function mensagens(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(registro).slice(0, 3).map(item => [
    texto(item.Codigo ?? item.codigo),
    texto(item.Descricao ?? item.descricao ?? item.Mensagem ?? item.mensagem),
    texto(item.Complemento ?? item.complemento),
  ].filter(Boolean).join(" — ")).filter(Boolean);
}

export function resumirRespostaAdn(http: number, corpo: string) {
  let resposta: Registro = {};
  try {
    const json: unknown = JSON.parse(corpo);
    if (registro(json)) resposta = json;
  } catch { /* HTML, corpo vazio ou JSON inválido nunca significam ausência de notas. */ }
  return {
    resposta,
    diagnostico: {
      http,
      status: texto(resposta.StatusProcessamento ?? resposta.statusProcessamento),
      erros: mensagens(resposta.Erros ?? resposta.erros),
      alertas: mensagens(resposta.Alertas ?? resposta.alertas),
    },
  };
}

export function interpretarRespostaAdn(http: number, corpo: string) {
  const { resposta, diagnostico } = resumirRespostaAdn(http, corpo);
  const lote = resposta.LoteDFe ?? resposta.loteDFe ?? resposta.Documentos ?? resposta.documentos;
  const semDocumentos = diagnostico.status === "NENHUM_DOCUMENTO_LOCALIZADO";
  const listaValida = lote == null || (Array.isArray(lote) && lote.every(registro));
  const erros = resposta.Erros ?? resposta.erros;
  const semErros = erros == null || (Array.isArray(erros) && erros.length === 0);
  if ((http === 200 || http === 404) && semDocumentos && listaValida
    && (lote == null || (lote as unknown[]).length === 0) && semErros) {
    return { resposta, documentos: [] as Registro[], nenhum: true, status: diagnostico.status! };
  }
  if (http === 200 && diagnostico.status === "DOCUMENTOS_LOCALIZADOS"
    && Array.isArray(lote) && lote.length > 0 && lote.every(registro) && semErros) {
    return { resposta, documentos: lote as Registro[], nenhum: false, status: diagnostico.status };
  }
  const detalhe = diagnostico.erros.join("; ");
  const orientacao = http === 401 || http === 403
    ? "O ADN recusou o acesso. Confira o certificado A1 e o CNPJ da empresa."
    : http === 429
      ? "O ADN limitou a frequência de consultas. Aguarde o horário indicado antes de tentar novamente."
      : http >= 500
        ? "O serviço nacional de NFS-e está indisponível no momento."
        : http === 404
          ? "O ADN retornou HTTP 404 sem confirmar ausência de documentos."
          : diagnostico.status === "REJEICAO"
            ? "O ADN rejeitou a consulta de NFS-e."
            : "O ADN retornou uma resposta de distribuição inválida.";
  throw new Error(`${orientacao}${detalhe ? ` ${detalhe}` : ""} Não foi possível verificar se há novas NFS-e. O cursor foi preservado.`);
}
