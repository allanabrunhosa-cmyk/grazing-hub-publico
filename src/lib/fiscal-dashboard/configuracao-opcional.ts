import "server-only";
import { prisma } from "@/lib/prisma";
import type { ConfiguracaoIntegracaoDashboard } from "./integracao";

/** Só retorna presença de credenciais; nenhum token sai desta fronteira do servidor. */
function configuracaoDoAmbiente(): ConfiguracaoIntegracaoDashboard | null {
  const ambiente = process.env.BRASIL_NFE_AMBIENTE;
  if (!ambiente || !["HOMOLOGACAO", "PRODUCAO"].includes(ambiente)) return null;
  return { ambiente, tokenConfigurado: !!process.env.BRASIL_NFE_TOKEN?.trim(), userTokenConfigurado: !!process.env.BRASIL_NFE_USER_TOKEN?.trim(), diagnostico: null, emitenteHash: null };
}
export async function lerConfiguracaoOpcionalDashboard(): Promise<{
  tabelaDisponivel: boolean; configuracao: ConfiguracaoIntegracaoDashboard | null;
}> {
  const [presenca] = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT to_regclass('"ConfiguracaoBrasilNfe"') IS NOT NULL AS existe
  `;
  if (!presenca?.existe) return { tabelaDisponivel: false, configuracao: configuracaoDoAmbiente() };
  // A consulta à relação é feita somente depois da confirmação. CASE sobre uma
  // tabela ausente não impediria o PostgreSQL de tentar resolvê-la no planejamento.
  const [configuracao] = await prisma.$queryRaw<ConfiguracaoIntegracaoDashboard[]>`
    SELECT c.ambiente, NULLIF(c."tokenCifrado", '') IS NOT NULL AS "tokenConfigurado",
      NULLIF(c."userTokenCifrado", '') IS NOT NULL AS "userTokenConfigurado",
      c.diagnostico, c."emitenteHash", c.versao,
      c."preRequisitos", c."preRequisitosEmitenteHash"
    FROM "ConfiguracaoBrasilNfe" c WHERE c.id = 'singleton'
  `;
  return { tabelaDisponivel: true, configuracao: configuracao ?? configuracaoDoAmbiente() };
}
