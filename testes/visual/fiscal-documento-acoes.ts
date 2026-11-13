import type { DetalheDocumentoDashboard } from "@/lib/fiscal-dashboard/documento";
export async function consultarDocumentoDashboardAction(tipo: string, id: string): Promise<DetalheDocumentoDashboard | { erro: string }> {
  if (new URLSearchParams(location.search).get("estado") === "erro-arquivo") return { erro: "Não foi possível consultar a nota sintética. Tente novamente." };
  const base = "/api/fiscal-saida/" + id + "/arquivo?tipo=";
  const html = id === "ficticio-1";
  return { campos: [{ nome: "Emitente", valor: "Empresa sintética" }, { nome: "Chave de acesso", valor: "3".repeat(44) }], itens: [{ numero: 1, descricao: "Produto sintético para conferência visual", quantidade: 2, unidade: "UN", valor: 120 }], aviso: null,
    arquivos: {
      xml: tipo === "NF_SAIDA" ? base + "xml" : tipo === "NFS_ENTRADA" ? "/api/nfse/exportar-xml?id=" + id : "/api/notas-fiscais/" + id + "/xml",
      impressao: tipo === "NF_SAIDA" ? { formato: html ? "HTML" : "PDF", abrir: base + (html ? "html" : "pdf") + "&visualizar=1", baixar: base + (html ? "html" : "pdf") } : null,
      cancelamento: null,
    } };
}
/** Ação inteiramente fictícia. Não importa cliente HTTP nem serviço fiscal. */
export async function recuperarArquivosDocumentoDashboardAction() {
  if (sessionStorage.getItem("fiscal-visual-tentativa") !== "1") {
    sessionStorage.setItem("fiscal-visual-tentativa", "1");
    return { erro: "Não foi possível obter o arquivo sintético. A nota continua autorizada." };
  }
  sessionStorage.setItem("fiscal-visual-recuperado", "1");
  return { ok: true as const };
}
