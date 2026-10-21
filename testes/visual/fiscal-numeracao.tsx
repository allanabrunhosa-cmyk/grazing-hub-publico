import { createRoot } from "react-dom/client";
import { FiscalPreviewLayout } from "./fiscal-layout";
import { NumeracaoFiscal } from "@/app/(protegido)/financeiro/fiscal/numeracao/numeracao-client";
import { CertificadoCard } from "@/app/(protegido)/configuracoes/certificado-card";
import { Toaster } from "sonner";
import type { ComandoAtualizacaoNumeracaoBrasilNfe, NumeracaoFiscalBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
import "@/app/globals.css";
const query = new URLSearchParams(location.search), estado = query.get("estado");
const dados: NumeracaoFiscalBrasilNfeDto = { versaoConfiguracao: 3, emitente: { nome: "EMPRESA FICTÍCIA PARA VALIDAÇÃO VISUAL ISOLADA", cnpj: "00000000000000" },
  consulta: { situacao: "CONCLUIDA", consultadoEm: new Date().toISOString(), httpStatus: 200, falha: null, avisosPresentes: false },
  linhas: [
    { modelo: 55, ambiente: 2, serie: "001", proximoNumero: "12", padrao: true, ultimaAutorizadaLocal: { documentoId: "documento-sintetico", numero: "12", autorizadaEm: "2026-10-14T11:00:00.000Z" }, divergencia: "CONTADOR_NAO_SUPERA_AUTORIZADA_LOCAL" },
    { modelo: 65, ambiente: 2, serie: "002", proximoNumero: "234", padrao: true, ultimaAutorizadaLocal: null, divergencia: null },
    { modelo: 55, ambiente: 1, serie: "001", proximoNumero: "98765", padrao: true, ultimaAutorizadaLocal: null, divergencia: null },
    { modelo: 65, ambiente: 1, serie: "001", proximoNumero: "88", padrao: true, ultimaAutorizadaLocal: null, divergencia: null },
  ], pendencias: ["Próximo número informativo, não reservado. Outros emissores podem consumir a mesma sequência após a consulta.", "O HUB não presume a última autorização de outros emissores. A comparação usa somente documentos locais comprovados."] };
if (estado === "vazio" || estado === "obsoleta" || estado === "falha") { dados.linhas = []; dados.consulta.situacao = estado === "vazio" ? "NAO_CONSULTADA" : estado === "obsoleta" ? "OBSOLETA" : "FALHOU"; if (estado !== "falha") dados.consulta.consultadoEm = null; }
if (estado === "falha") { dados.consulta.httpStatus = 403; dados.consulta.falha = { categoria: "HTTP", httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null }; }
if (estado === "contrato") { dados.linhas = []; dados.consulta.situacao = "FALHOU"; dados.consulta.falha = { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", statusFornecedor: null, codigoFornecedor: null, itemNumeracao: { posicao: 3, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL" } }; }
if (estado === "fora-escopo") dados.consulta.itensForaEscopo = 6;
if (estado === "desabilitado") dados.versaoConfiguracao = 0;
if (estado === "leitura-antiga") dados.consulta.consultadoEm = new Date(Date.now() - 360000).toISOString();
if (estado === "pendente") dados.atualizacao = { situacao: "PENDENTE_CONFERENCIA", operacaoId: "00000000-0000-4000-8000-000000000001", solicitadoEm: new Date().toISOString(), confirmadoEm: null, modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, falha: { categoria: "TIMEOUT", httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null }, motivo: null };
if (estado === "historico-anterior") dados.historicoAtualizacoes = [{ contexto: "ANTERIOR", situacao: "CONFIRMADA", operacaoId: "00000000-0000-4000-8000-000000000002", solicitadoEm: "2026-10-14T12:00:00.000Z", confirmadoEm: "2026-10-14T12:00:01.000Z", modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, falha: null, motivo: null }];
let simulado = structuredClone(dados);
async function atualizar(entrada: ComandoAtualizacaoNumeracaoBrasilNfe) {
  if (estado === "erro-salvar") return { erro: "Massa sintética: atualização não confirmada. Os campos foram preservados." };
  const r = structuredClone(simulado), agora = new Date().toISOString();
  r.consulta = { ...r.consulta, situacao: "CONCLUIDA", consultadoEm: agora };
  r.atualizacao = { situacao: estado === "incerta" ? "PENDENTE_CONFERENCIA" : "CONFIRMADA", operacaoId: entrada.operacaoId, solicitadoEm: agora, confirmadoEm: estado === "incerta" ? null : agora, modelo: entrada.modelo, ambiente: entrada.ambiente, serie: entrada.serie, proximoNumero: entrada.proximoNumero, padrao: entrada.padrao, falha: null, motivo: null };
  if (r.atualizacao.situacao === "CONFIRMADA") {
    r.linhas = r.linhas.filter(l => !(l.modelo === entrada.modelo && l.ambiente === entrada.ambiente && Number(l.serie) === Number(entrada.serie)))
      .map(l => l.modelo === entrada.modelo && l.ambiente === entrada.ambiente && entrada.padrao ? { ...l, padrao: false } : l);
    r.linhas.push({ modelo: entrada.modelo, ambiente: entrada.ambiente, serie: entrada.serie, proximoNumero: entrada.proximoNumero, padrao: entrada.padrao, ultimaAutorizadaLocal: null, divergencia: null });
  }
  r.historicoAtualizacoes = [r.atualizacao, ...(r.historicoAtualizacoes ?? [])];
  simulado = r;
  return { ok: true as const, dados: structuredClone(r) };
}
createRoot(document.getElementById("root")!).render(<FiscalPreviewLayout><NumeracaoFiscal inicial={dados} podeConsultar={estado !== "sem-permissao"} atualizar={atualizar} consultar={async () => { simulado = { ...simulado, consulta: { ...simulado.consulta, consultadoEm: new Date().toISOString() } }; return { ok: true, dados: structuredClone(simulado) }; }} certificado={<CertificadoCard podeEditar={estado !== "sem-permissao"} podeExcluir={estado !== "sem-permissao"} certificado={estado === "vazio" ? null : { arquivoNome: "certificado-ficticio.pfx", titular: "EMPRESA FICTÍCIA PARA VALIDAÇÃO", validoAte: "2026-11-07T12:00:00Z", diasParaVencer: 22, updatedAt: "2026-10-16T12:00:00Z", atualizadoPorNome: "Equipe fictícia" }} />} /><Toaster /></FiscalPreviewLayout>);
