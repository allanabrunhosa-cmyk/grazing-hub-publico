import type { DetalhesDiagnosticoServicosBrasilNfe, MetadadosErroBrasilNfe } from "./diagnostico-http";

export type EstadoServicoEmissaoBrasilNfe = "ATIVO" | "INATIVO" | "NAO_CONFIRMADO";
export type ConsultaAdministrativaBrasilNfe = "BuscarEmpresa" | "ConsultarServicos";
export type ResultadoConsultaAdministrativaBrasilNfe = {
  consulta: ConsultaAdministrativaBrasilNfe;
  situacao: "NAO_REALIZADA" | "CONCLUIDA" | "FALHOU";
  verificadaEm: string | null;
  falha: MetadadosErroBrasilNfe | null;
};
/** Somente dados administrativos públicos; credenciais nunca pertencem ao DTO. */
export type ConfiguracaoBrasilNfeDto = {
  versao: number;
  ambiente: "HOMOLOGACAO";
  producaoBloqueada: true;
  emissaoHabilitada: false;
  tokenConfigurado: boolean;
  userTokenConfigurado: boolean;
  emitente: { id: "singleton"; nome: string | null; cnpj: string | null; enderecoCompleto: boolean };
  configuracaoSalva: boolean;
  validacaoExterna: {
    situacao: "NAO_REALIZADA" | "PARCIAL" | "VALIDADA" | "FALHOU" | "CONECTADO_SERVICOS_PENDENTES";
    verificadaEm: string | null;
    acessoAutenticado: boolean;
    emitenteCorrespondente: boolean | null;
    empresaVerificadaEm: string | null;
    servicosEmissao: { nfe: EstadoServicoEmissaoBrasilNfe; nfce: EstadoServicoEmissaoBrasilNfe; verificadosEm: string | null };
    consultas: ResultadoConsultaAdministrativaBrasilNfe[];
    preRequisitosConferidos: boolean;
    pendencias: string[];
    consultasIndisponiveis: string[];
  };
  homologacaoFiscal: "PENDENTE";
};
/** Projeção transitória devolvida somente à ação de validação autorizada; nunca integra o DTO de leitura. */
export type DetalhesDiagnosticoBrasilNfeDto = DetalhesDiagnosticoServicosBrasilNfe & {
  verificadaEm: string;
  expiraEm: string;
  versao: number;
};
export type ResultadoConfiguracaoBrasilNfe = { ok: true; dados: ConfiguracaoBrasilNfeDto; detalhesDiagnostico?: DetalhesDiagnosticoBrasilNfeDto } | { ok: false; erro: string };
