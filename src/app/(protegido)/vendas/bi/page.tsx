import { exigirPermissao } from "@/lib/permissoes/servidor";
import { BiVendas } from "@/components/vendas/bi/bi-vendas";
import { consultarBiAction } from "./actions";
import { BiIndisponivel } from "./indisponivel";
import { entradaBiDaUrl } from "@/lib/vendas/bi-url";

export default async function BiVendasPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await exigirPermissao("vendas.bi");
  const entrada = entradaBiDaUrl(await searchParams);
  const resultado = await consultarBiAction(entrada);
  if ("erro" in resultado) return <BiIndisponivel mensagem={resultado.erro} />;
  return <BiVendas dados={resultado} consultar={consultarBiAction} usuarioId={sessao.userId} />;
}
