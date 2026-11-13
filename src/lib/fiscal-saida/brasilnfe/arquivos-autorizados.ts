import "server-only";
import type { SessaoAtual } from "@/lib/session";
import type { AdaptadorFiscalSaida } from "../contrato";
import { consultarFiscalSaida, obterArquivosFiscalSaidaManual } from "../servico";

type DocumentoPedido = Awaited<ReturnType<typeof consultarFiscalSaida>>[number];
export type DocumentoPedidoComArquivos = DocumentoPedido & { avisoArquivos?: string };

export function informarArquivosPendentes(documento: DocumentoPedido): DocumentoPedidoComArquivos {
  if (documento.status !== "AUTORIZADO") return documento;
  const faltaXml = documento.xmlDisponivel === false;
  if (!faltaXml && documento.formatoImpressao) return documento;
  return { ...documento, avisoArquivos: faltaXml
    ? "A nota está autorizada. O XML ainda não está disponível no HUB. Use Obter documentos para tentar baixar os arquivos novamente; não emita outra nota."
    : "A nota está autorizada e o XML está disponível. A impressão ainda não está disponível. Use Obter documentos para tentar novamente." };
}

/** Completa apenas os arquivos de uma autorização existente. Não transmite ou cancela. */
export async function completarArquivosAposAutorizacao(adaptador: AdaptadorFiscalSaida, documento: DocumentoPedido, sessao: SessaoAtual): Promise<DocumentoPedidoComArquivos> {
  if (documento.status !== "AUTORIZADO" || documento.xmlDisponivel && documento.formatoImpressao) return documento;
  try {
    await obterArquivosFiscalSaidaManual(adaptador, documento.id, sessao);
    const atualizado = (await consultarFiscalSaida(documento.pedidoId, sessao)).find(d => d.id === documento.id);
    if (!atualizado) throw new Error("Documento indisponível após a obtenção de arquivos.");
    return informarArquivosPendentes(atualizado);
  } catch {
    // A falha de download não desfaz o resultado fiscal nem libera um novo envio.
    return { ...documento, avisoArquivos: "A nota está autorizada, mas não foi possível baixar todos os arquivos agora. Use Obter documentos para tentar novamente; não emita outra nota." };
  }
}
