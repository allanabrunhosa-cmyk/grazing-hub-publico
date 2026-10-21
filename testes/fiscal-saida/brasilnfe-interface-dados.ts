import type { ConfiguracaoBrasilNfeDto, DetalhesDiagnosticoBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/configuracao-dto";

/** Emitente fictício; não contém credenciais nem dados da empresa real. */
export const configuracaoBrasilNfeFicticia: ConfiguracaoBrasilNfeDto = {
  versao: 0,
  ambiente: "HOMOLOGACAO",
  producaoBloqueada: true,
  emissaoHabilitada: false,
  tokenConfigurado: false,
  userTokenConfigurado: false,
  configuracaoSalva: false,
  emitente: { id: "singleton", nome: "EMPRESA FICTÍCIA DE TESTES", cnpj: "11222333000181", enderecoCompleto: false },
  validacaoExterna: {
    situacao: "NAO_REALIZADA", verificadaEm: null, acessoAutenticado: false, emitenteCorrespondente: null, empresaVerificadaEm: null,
    servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null },
    consultas: [
      { consulta: "BuscarEmpresa", situacao: "NAO_REALIZADA", verificadaEm: null, falha: null },
      { consulta: "ConsultarServicos", situacao: "NAO_REALIZADA", verificadaEm: null, falha: null },
    ],
    preRequisitosConferidos: false, pendencias: ["Token da empresa não configurado.", "Regras tributárias aguardam definição da Confirp."], consultasIndisponiveis: ["Consulta cadastral da empresa: UserToken não configurado."],
  },
  homologacaoFiscal: "PENDENTE",
};

/** Consulta de serviços recusada simulada; autenticação e emitente confirmados apenas nesta fixture. */
export const configuracaoBrasilNfeServicosPendentesFicticia: ConfiguracaoBrasilNfeDto = {
  ...configuracaoBrasilNfeFicticia,
  configuracaoSalva: true, tokenConfigurado: true, userTokenConfigurado: true, versao: 1,
  validacaoExterna: {
    ...configuracaoBrasilNfeFicticia.validacaoExterna,
    situacao: "CONECTADO_SERVICOS_PENDENTES", verificadaEm: "2026-10-10T12:30:01.000Z", acessoAutenticado: true,
    emitenteCorrespondente: true, empresaVerificadaEm: "2026-10-10T12:30:00.000Z",
    consultas: [
      { consulta: "BuscarEmpresa", situacao: "CONCLUIDA", verificadaEm: "2026-10-10T12:30:00.000Z", falha: null },
      { consulta: "ConsultarServicos", situacao: "FALHOU", verificadaEm: "2026-10-10T12:30:01.000Z", falha: { categoria: "HTTP", httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null } },
    ],
    pendencias: ["ConsultarServicos: acesso recusado; verificação do serviço de emissão pendente.", "Regras tributárias aguardam definição da Confirp."],
    consultasIndisponiveis: ["ConsultarServicos: consulta indisponível nesta validação."],
  },
};

/** Detalhes sintéticos transitórios; não reproduzem respostas ou dados reais. */
export function criarDetalhesDiagnosticoServicosFicticios(versao = 1, agora = Date.now()): DetalhesDiagnosticoBrasilNfeDto {
  return {
    versao, verificadaEm: new Date(agora).toISOString(), expiraEm: new Date(agora + 5 * 60 * 1000).toISOString(),
    error: { estado: "EXIBIDO", valor: "Mensagem fictícia do fornecedor." },
    erros: [{
      codigo: { estado: "EXIBIDO", valor: "FICTICIO-X001" },
      descricao: { estado: "EXIBIDO", valor: "Descrição fictícia para conferir a leitura do diagnóstico." },
      correcao: { estado: "SUPRIMIDO", valor: null },
    }],
    quantidadeErros: 1, camposAusentes: ["SERVICOS"], camposSuprimidos: ["ERROS_CORRECAO"],
  };
}
