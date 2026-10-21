import { getSession } from "@/lib/session";
import { CabecalhoConteudo } from "./cabecalho-conteudo";
import type { IdentidadeInterface } from "@/lib/hosts";

export async function Header({ dedicado = false, identidade = dedicado ? "etiquetas" : "hub" }: { dedicado?: boolean; identidade?: IdentidadeInterface }) {
  const sessao = await getSession();
  return <CabecalhoConteudo identidade={identidade} sessao={sessao ? { nome: sessao.nome, email: sessao.email, admin: sessao.admin, perfilNome: sessao.perfilNome } : null} />;
}
