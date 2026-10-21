import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { cadastrosFaturas } from "@/lib/financeiro/faturas/consultas";
import { RegrasFatura } from "./regras-view";
export default async function RegrasPage(){
  await exigirPermissao("financeiro.faturas");await exigirPermissao("financeiro.cartoes-regras");
  const [cadastros,regras]=await Promise.all([cadastrosFaturas(),prisma.regraCartao.findMany({orderBy:[{ativa:"desc"},{prioridade:"desc"},{nome:"asc"}],take:1000})]);
  return <RegrasFatura cadastros={cadastros} regras={regras.map(r=>({id:r.id,versao:r.versao,nome:r.nome,texto:r.texto,modo:r.modo as "EXATO"|"CONTEM",prioridade:r.prioridade,cartaoId:r.cartaoId,categoriaId:r.categoriaId,fornecedorId:r.fornecedorId,centroCustoId:r.centroCustoId,tipo:r.tipo,minimo:r.valorMinimo?.toString()??"",maximo:r.valorMaximo?.toString()??"",ativa:r.ativa,origem:r.origem}))}/>;
}
