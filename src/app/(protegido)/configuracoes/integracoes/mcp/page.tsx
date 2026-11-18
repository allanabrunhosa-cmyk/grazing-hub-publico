import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { carregarAdministracaoMcp } from "@/lib/mcp/administracao";
import { carregarResumoIntegracoes } from "../resumo";
import { MolduraIntegracoes, conexaoMcpInicial } from "../seletor";
import { GestaoMcp } from "./gestao";

export default async function McpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPermissao("configuracoes.mcp");
  const { conexao, aba, ...filtros } = await searchParams;
  const dados = await carregarAdministracaoMcp(filtros);
  const [resumo, editar, verUsuarios] = await Promise.all([carregarResumoIntegracoes(dados), podeAcessar("configuracoes.mcp", "editar"), podeAcessar("configuracoes.usuarios")]);
  // `aba=historico` vem de links antigos; o histórico agora fica no detalhe do servidor.
  const pedida = typeof conexao === "string" ? conexao : aba === "historico" ? "servidor" : "";
  const selecao = pedida === "servidor" || (pedida === "nova" && editar) || dados.autorizacoes.some(a => a.id === pedida) ? pedida : conexaoMcpInicial(resumo.mcp!);
  return <MolduraIntegracoes resumo={resumo} ativa={`mcp:${selecao}`}>
    <GestaoMcp key={selecao} dados={dados} editar={editar} verUsuarios={verUsuarios} selecao={selecao} />
  </MolduraIntegracoes>;
}
