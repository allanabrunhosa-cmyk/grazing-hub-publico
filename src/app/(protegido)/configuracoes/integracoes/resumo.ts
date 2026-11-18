import "server-only";
import { prisma } from "@/lib/prisma";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { resumirServidorMcp, type DadosAdministracaoMcp } from "@/lib/mcp/administracao";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";
import type { ResumoIntegracoes } from "./seletor";

/**
 * Conexões visíveis no seletor de Integrações, conforme as permissões centrais de quem consulta.
 * Não autoriza nada: cada página e cada ação continuam conferindo a própria permissão.
 * `dadosMcp` evita repetir a leitura quando a gestão do MCP já foi carregada.
 */
export async function carregarResumoIntegracoes(dadosMcp?: DadosAdministracaoMcp): Promise<ResumoIntegracoes> {
  const [mcp, editarMcp, brasilnfe, loja] = await Promise.all([podeAcessar("configuracoes.mcp"), podeAcessar("configuracoes.mcp", "editar"), podeAcessar("configuracoes.brasilnfe"), podeAcessar("configuracoes.loja")]);
  const [servidor, registro] = await Promise.all([
    !mcp ? null : dadosMcp ? { endereco: dadosMcp.endereco, ativo: dadosMcp.ativo, configurado: dadosMcp.configurado, conexoes: dadosMcp.autorizacoes.map(a => ({ id: a.id, nome: a.nome, clienteNome: a.clienteNome, situacao: a.situacao })) } : resumirServidorMcp(),
    loja ? prisma.certificadoDigital.findUnique({ where: { id: "singleton" }, select: { validoAte: true } }) : null,
  ]);
  let certificado: ResumoIntegracoes["certificado"] = null;
  if (loja) {
    const validade = registro ? resumirCertificadoDashboard(registro, new Date()) : null;
    const data = validade?.validoAte ? new Date(validade.validoAte).toLocaleDateString("pt-BR") : "";
    certificado = !registro ? { resumo: "Nenhum certificado enviado", tom: "neutro" }
      : validade?.situacao === "VENCIDO" ? { resumo: `Vencido em ${data}`, tom: "vermelho" }
      : validade?.situacao === "A_VENCER" ? { resumo: `Vence em ${data}`, tom: "ambar" }
      : validade?.situacao === "VIGENTE" ? { resumo: `Válido até ${data}`, tom: "roxo" }
      : { resumo: "Validade não verificada", tom: "neutro" };
  }
  return { mcp: servidor ? { ...servidor, editar: editarMcp } : null, brasilnfe, certificado };
}
