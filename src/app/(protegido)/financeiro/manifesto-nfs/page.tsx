import { exigirPermissao } from "@/lib/permissoes/servidor";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { prisma } from "@/lib/prisma";
import { SELECAO_CATEGORIA_COM_CAMINHO, categoriasComCaminho } from "@/lib/financeiro/caminho-categoria";
import { type DadosPessoaNfse } from "@/lib/nfse/parse";
import { horarioBuscaAutomaticaNfse } from "@/lib/nfse/agenda";
import { NOTAS_NFSE_VISIVEIS } from "@/lib/nfse/visibilidade";
import { ManifestoNfsView, AcaoBarra } from "./manifesto-nfs-view";
import type { CartaoOption } from "@/lib/financeiro/cartoes";

export default async function ManifestoNfsPage() {
  const sessao = await exigirPermissao("financeiro.nfse");
  const pode = (recurso: string, acao: "visualizar" | "adicionar" | "editar") => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, acao);
  const [notas, estado, categorias, cartoes] = await Promise.all([
    prisma.notaFiscalServico.findMany({ where: NOTAS_NFSE_VISIVEIS, orderBy: [{ dataEmissao: "desc" }, { createdAt: "desc" }], include: { fornecedor: { select: { nome: true } }, lancamentos: { select: { lancamentoFinanceiroId: true } } } }),
    prisma.nfseDistribuicaoEstado.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null }, orderBy: { nome: "asc" }, select: SELECAO_CATEGORIA_COM_CAMINHO }),
    prisma.cartaoCredito.findMany({ where: { ativo: true, contaBancaria: { ativo: true } }, include: { contaBancaria: true }, orderBy: { nome: "asc" } }),
  ]);
  return <div className="space-y-6">
    <BarraAcoes titulo="Manifesto de NFS" descricao="Notas fiscais de serviço recebidas e lançamentos no financeiro">
      <AcaoBarra podeBuscar={pode("financeiro.nfse", "adicionar")} />
    </BarraAcoes>
    <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
      <p>O sistema consulta o Ambiente de Dados Nacional NFS-e com o certificado A1 configurado na empresa. Municípios fora do padrão nacional podem ser importados pelo XML oficial.</p>
      {estado?.emConsulta && <p className="mt-1 font-medium text-foreground">Busca em andamento. Atualize a página para acompanhar.</p>}
      {estado?.ultimaExecucaoEm && <p role={estado.ultimoStatus === "FALHA_CONSULTA" ? "alert" : "status"} className={estado.ultimoStatus === "FALHA_CONSULTA" ? "mt-1 font-medium text-destructive" : "mt-1"}>Última busca: {estado.ultimaExecucaoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. {estado.resultadoExecucao}</p>}
      <p className="mt-1">Busca automática de NFS-e: diariamente às 03h15 (Brasília), com continuação dos lotes enquanto houver documentos.</p>
      <p className="mt-1">Próxima busca automática prevista: {horarioBuscaAutomaticaNfse(estado, new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. O servidor verifica a agenda a cada cinco minutos.</p>
      {estado?.ultimaBuscaAutomaticaEm && <p className="mt-1">Última busca automática: {estado.ultimaBuscaAutomaticaEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. {estado.resultadoBuscaAutomatica}</p>}
      {estado?.proximaBuscaEm && <p className="mt-1">Próxima consulta permitida a partir de {estado.proximaBuscaEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}
    </div>
    <ManifestoNfsView
      notas={notas.map(nota => ({ id: nota.id, identificador: nota.identificador, chaveAcesso: nota.chaveAcesso, origem: nota.origem, status: nota.status, numero: nota.numero, serie: nota.serie, prestadorNome: nota.prestadorNome, prestadorCnpj: nota.prestadorCnpj, prestadorDados: nota.prestadorDados as DadosPessoaNfse | null, tomadorNome: nota.tomadorNome, tomadorCnpj: nota.tomadorCnpj, tomadorDados: nota.tomadorDados as DadosPessoaNfse | null, fornecedorNome: nota.fornecedor?.nome ?? null, valorServico: Number(nota.valorServico ?? 0), valorLiquido: Number(nota.valorLiquido ?? 0), valorIss: Number(nota.valorIss ?? 0), dataEmissao: nota.dataEmissao?.toISOString() ?? null, dataCompetencia: nota.dataCompetencia?.toISOString() ?? null, municipioNome: nota.municipioNome, uf: nota.uf, codigoVerificacao: nota.codigoVerificacao, temXml: Boolean(nota.xml), lancada: nota.lancamentos.length > 0 }))}
      categorias={categoriasComCaminho(categorias)}
      cartoes={cartoes.map(cartao => ({ id: cartao.id, nome: cartao.nome, contaBancariaId: cartao.contaBancariaId, contaBancariaNome: cartao.contaBancaria.nome, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento, ativo: cartao.ativo })) satisfies CartaoOption[]}
      podeEditar={pode("financeiro.nfse", "editar")}
      podeImportar={pode("financeiro.nfse", "adicionar")}
      podeLancar={pode("financeiro.nfse", "editar") && pode("financeiro.movimentacoes", "adicionar")}
    />
  </div>;
}
