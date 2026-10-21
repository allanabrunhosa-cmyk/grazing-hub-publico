import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { listarEntradas, type FiltrosEntradas } from "@/lib/estoque/consultar-entradas";
import { EntradasHistorico } from "./entradas-historico";
export default async function HistoricoEntradasPage({ searchParams }: { searchParams: Promise<FiltrosEntradas> }) {
  const sessao = await exigirPermissao("inventario");
  const parametros = await searchParams;
  const filtros = { busca: parametros.busca, de: parametros.de, ate: parametros.ate, pagina: parametros.pagina };
  const dados = await listarEntradas(filtros).catch(() => null);
  return <EntradasHistorico filtros={filtros} dados={dados} podeEditar={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario", "editar")} podeExcluir={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario", "excluir")} podeAdicionar={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "inventario.entrada", "adicionar")} />;
}