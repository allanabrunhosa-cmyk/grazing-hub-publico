import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { carregarAdministracaoMcp } from "@/lib/mcp/administracao";
import { GestaoMcp } from "./gestao";
export default async function McpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPermissao("configuracoes.mcp");
  const parametros = await searchParams;
  const dados = await carregarAdministracaoMcp(parametros);
  return <GestaoMcp dados={dados} editar={await podeAcessar("configuracoes.mcp", "editar")} verUsuarios={await podeAcessar("configuracoes.usuarios")} abaInicial={parametros.aba === "historico" ? "historico" : "visao"} />;
}
