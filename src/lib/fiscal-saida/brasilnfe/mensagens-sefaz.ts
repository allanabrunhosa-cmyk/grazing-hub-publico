/** Mensagens locais por código oficial. Não renderiza Error, XML ou texto livre
 * do fornecedor. O código explica o impedimento, mas não altera o estado fiscal.
 * Fontes: MOC7/Visão Geral, NT2019.001 e rejeições oficiais NF-e/NFC-e. */
const emissao: Record<number, string> = {
  181: "CNPJ do destinatário não cadastrado na Receita Federal. Confira o documento do cliente.",
  204: "Duplicidade de nota fiscal na SEFAZ. Consulte a nota existente e concilie o resultado antes de qualquer novo envio.",
  205: "A nota já consta como denegada na SEFAZ. Confira a nota existente; não repita a emissão.",
  209: "Inscrição estadual do emitente inválida. Confira os dados fiscais da empresa.",
  229: "Inscrição estadual do emitente não informada. Complete os dados fiscais da empresa.",
  230: "Inscrição estadual do emitente não cadastrada. Confira o cadastro estadual da empresa.",
  231: "Inscrição estadual do emitente não vinculada ao CNPJ. Confira os dados fiscais da empresa.",
  232: "A SEFAZ exige a inscrição estadual deste destinatário. Confira a IE e a condição tributária do cliente.",
  233: "Inscrição estadual do destinatário não cadastrada. Confira a IE do cliente.",
  234: "Inscrição estadual do destinatário não vinculada ao CNPJ. Confira o cadastro do cliente.",
  237: "CPF do destinatário inválido. Corrija o documento do cliente.",
  215: "O XML da nota não atende ao formato exigido. Confira a configuração fiscal.",
  225: "O XML do lote não atende ao formato exigido. Confira a configuração fiscal.",
  383: "CSOSN do item incompatível. Revise a classificação fiscal do produto.",
  386: "CFOP não permitido para o CSOSN informado. Revise a regra fiscal do produto.",
  462: "Identificador do CSC do QR-Code não cadastrado na SEFAZ. Confira o CSC e o ambiente da NFC-e nas configurações do emissor.",
  463: "Identificador do CSC do QR-Code revogado. Confira o CSC vigente e o ambiente da NFC-e nas configurações do emissor.",
  464: "Hash do QR-Code diferente do calculado pela SEFAZ. Confira o CSC e a configuração da NFC-e no emissor.",
  539: "Duplicidade de nota fiscal com diferença na chave de acesso. Consulte a nota já registrada na SEFAZ antes de qualquer novo envio.",
  591: "CSOSN incompatível com o regime tributário do emitente. Confira o regime da empresa e o ICMS do produto.",
  611: "Código de barras do produto inválido. Confira o cadastro do item.",
  725: "CFOP inválido para NFC-e. Revise a regra fiscal ou o modelo da nota.",
  777: "NCM completo do produto não informado. Complete a classificação fiscal do item.",
  778: "NCM do produto inexistente. Corrija a classificação fiscal do item.",
  787: "NFC-e sem identificação obrigatória do destinatário nesta operação. Complete o cadastro fiscal do destinatário.",
  788: "NFC-e de entrega sem endereço obrigatório do destinatário. Complete o endereço fiscal com CEP, município e UF.",
  789: "NFC-e para destinatário contribuinte de ICMS. Confira a condição tributária do cliente e o modelo fiscal da operação.",
  796: "Empresa sem chave de segurança para o QR-Code. Confira o CSC e o ambiente da NFC-e no emissor.",
};
const cancelamento: Record<number, string> = {
  218: "A SEFAZ informa que a nota já está cancelada. Consulte o evento para confirmar o resultado.",
  219: "A SEFAZ registrou circulação da mercadoria. Confira a operação com o responsável fiscal.",
  221: "O destinatário confirmou o recebimento da nota. Confira a operação com o responsável fiscal.",
  222: "O protocolo de autorização diverge do cadastrado na SEFAZ. Confira a nota original.",
  501: "Prazo de cancelamento superior ao permitido pela SEFAZ. Consulte o responsável fiscal sobre a regularização.",
};
export function mensagemCodigoSefaz(codigo: number | null, operacao: "EMISSAO" | "CANCELAMENTO") {
  if (codigo === null || !Number.isSafeInteger(codigo) || codigo < 100 || codigo > 9999) return null;
  const mensagem = (operacao === "CANCELAMENTO" ? cancelamento : emissao)[codigo];
  return mensagem ? `SEFAZ ${codigo}: ${mensagem}` : `SEFAZ retornou o código ${codigo}. O motivo ainda não possui tradução no HUB. Consulte o retorno no emissor antes de repetir a operação.`;
}
