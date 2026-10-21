import { exigirPermissao } from "@/lib/permissoes/servidor";
import { ACOES, permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { carregarAcessos } from "./actions";
import { UsuariosPermissoes } from "./usuarios-permissoes";
export default async function UsuariosPage() {
  const sessao = await exigirPermissao("configuracoes.usuarios");
  const dados = await carregarAcessos();
  if ("erro" in dados) return <p>{dados.erro}</p>;
  return <UsuariosPermissoes inicial={dados} capacidades={ACOES.filter(a => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios", a))} podeVerAtividades={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "configuracoes.usuarios.atividades", "visualizar")} />;
}
