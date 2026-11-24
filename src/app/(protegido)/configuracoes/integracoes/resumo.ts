import "server-only";
import { prisma } from "@/lib/prisma";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { resumirServidorMcp, type DadosAdministracaoMcp } from "@/lib/mcp/administracao";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";
import type { ResumoIntegracoes } from "./seletor";
import { estadoConfiguracaoAsaas } from "@/lib/asaas/configuracao";
import { siteAtivo, siteConfigurado } from "@/lib/site/cliente";

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
  let asaas: ResumoIntegracoes["asaas"] = null, site: ResumoIntegracoes["site"] = null;
  if (loja) {
    const a = estadoConfiguracaoAsaas();
    asaas = a.ativo ? { resumo: a.ambiente === "PRODUCAO" ? "Cobranças ativas" : "Ativo em ambiente de testes", tom: a.ambiente === "PRODUCAO" ? "verde" : "ambar" } : { resumo: "Desativado no servidor", tom: "neutro" };
    const integracao = await prisma.integracaoSite.findUnique({ where: { contaId: "singleton" }, select: { ativa: true, ultimoErro: true } });
    site = !siteConfigurado() ? { resumo: "Sem chave de acesso", tom: "neutro" } : !siteAtivo() ? { resumo: "Desativado no servidor", tom: "neutro" }
      : !integracao?.ativa ? { resumo: "Recepção pausada", tom: "ambar" } : integracao.ultimoErro ? { resumo: "Recebendo, com alerta", tom: "ambar" } : { resumo: "Recebendo pedidos", tom: "verde" };
  }
  return { mcp: servidor ? { ...servidor, editar: editarMcp } : null, brasilnfe, certificado, asaas, site };
}
