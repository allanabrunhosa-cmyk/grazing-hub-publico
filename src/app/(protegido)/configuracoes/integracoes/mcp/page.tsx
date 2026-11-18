import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { carregarAdministracaoMcp } from "@/lib/mcp/administracao";
import { CabecalhoIntegracoes } from "../seletor";
import { GestaoMcp } from "./gestao";

const ABAS = ["visao", "conexoes", "funcoes", "historico"];
export default async function McpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPermissao("configuracoes.mcp");
  const parametros = await searchParams;
  const [dados, editar, verUsuarios, brasilnfe] = await Promise.all([carregarAdministracaoMcp(parametros), podeAcessar("configuracoes.mcp", "editar"), podeAcessar("configuracoes.usuarios"), podeAcessar("configuracoes.brasilnfe")]);
  const aba = typeof parametros.aba === "string" && ABAS.includes(parametros.aba) ? parametros.aba : "visao";
  return <div className="space-y-6">
    <CabecalhoIntegracoes ativa="mcp" disponiveis={brasilnfe ? ["mcp", "brasilnfe"] : ["mcp"]} />
    <GestaoMcp dados={dados} editar={editar} verUsuarios={verUsuarios} abaInicial={aba} />
  </div>;
}
