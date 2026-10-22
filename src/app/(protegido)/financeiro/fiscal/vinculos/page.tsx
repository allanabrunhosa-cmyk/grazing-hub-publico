import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { CadastrosFiscais } from "../cadastros-fiscais";
export default async function VinculosFiscaisPage({ searchParams }: { searchParams?: Promise<{ produto?: string }> }) { const sessao = await exigirPermissao("vendas.fiscal"); return <CadastrosFiscais painel={await consultarPainelFiscal(sessao)} produtoInicial={(await searchParams)?.produto} />; }
