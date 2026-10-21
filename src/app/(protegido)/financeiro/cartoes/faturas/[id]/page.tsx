import { exigirPermissao,podeAcessar } from "@/lib/permissoes/servidor";
import { cadastrosFaturas,detalheFatura,type FiltrosFatura } from "@/lib/financeiro/faturas/consultas";
import { FaturaView } from "../../fatura-view";
export default async function FaturaPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<FiltrosFatura>}) {
  await exigirPermissao("financeiro.faturas");
  const {id}=await params,filtros=await searchParams;
  const [dados,cadastros]=await Promise.all([detalheFatura(id,filtros,await podeAcessar("financeiro.conciliacao")),cadastrosFaturas()]);
  return <FaturaView key={`${dados.id}:${dados.versao}:${dados.pagina}:${filtros.estado}:${filtros.busca}:${filtros.destaque}`} dados={dados} cadastros={cadastros} filtros={filtros}/>;
}
