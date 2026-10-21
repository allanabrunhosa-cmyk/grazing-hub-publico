import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { montarResultadoBi, objetoBi, type ItemFonteBi, type PedidoFonteBi } from "./bi-dominio";
import { ErroBi, normalizarFiltrosBi } from "./bi-filtros";
import { exportarBiCsv } from "./bi-csv";
import { diaNoFuso, inicioDiaNoFuso, somarDias } from "./pedidos-agenda-dominio";
import { dataCompraCivil } from "./pedidos-data-compra";
import { geografiaPedidoBi } from "./bi-geografia";
import type { FiltrosBi, OpcaoBi, PermissoesBi } from "./bi-types";

type FonteSql = { dataCompra: Date | null; id: string; numero: number; status: string; origem: string; referenciaOrigem: string | null; referenciaEstabelecimento: string | null; referenciaPedido: string | null; createdAt: Date; entregueEm: Date | null; updatedAt: Date; fonteAtualizadaEm: Date | null; atualizadoComercialEm: Date | null; clienteId: string | null; clienteNome: string | null; clienteTipo: string | null; canalId: string | null; canalNomeSnapshot: string | null; atendimento: string | null; subtotal: string; desconto: string; frete: string; outrosCustos: string; total: string; custoEntrega: string | null; cep: string | null; cidade: string | null; bairro: string | null; uf: string | null; teste: boolean; itens: unknown; historico: unknown; reducoes: string };
const str = (v: unknown) => typeof v === "string" ? v : null;
const decimal = (v: unknown, padrao = "0") => { const texto = str(v); if (texto === null) return new Prisma.Decimal(padrao); if (!/^-?\d+(?:\.\d+)?$/u.test(texto)) throw new ErroBi("Há valores comerciais pendentes de conferência na fonte.", 503); return new Prisma.Decimal(texto); };
const objetos = (v: unknown) => Array.isArray(v) ? v.map(objetoBi) : [];

/** Um SELECT por lote; fontes/itens são projetados no PostgreSQL sem JSON pessoal. */
async function carregarFontes(filtros: FiltrosBi, permissoes: PermissoesBi) {
  const inicio = performance.now();
  const limite = inicioDiaNoFuso(somarDias(filtros.ate || diaNoFuso(new Date(), "America/Sao_Paulo"), 1), "America/Sao_Paulo");
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const canais = await tx.canalVenda.findMany({ select: { id: true, nome: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    const cadastros = permissoes.contatos ? await tx.clienteVenda.findMany({ select: { id: true, nome: true, unificadoEmId: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] }) : [];
    const clientes = cadastros.filter(c => !c.unificadoEmId).map(({ id, nome }) => ({ id, nome }));
    const porId = new Map(cadastros.map(c => [c.id, c]));
    let clienteSelecionado = filtros.cliente;
    const visitados = new Set<string>();
    while (porId.get(clienteSelecionado)?.unificadoEmId && !visitados.has(clienteSelecionado)) {
      visitados.add(clienteSelecionado); clienteSelecionado = porId.get(clienteSelecionado)!.unificadoEmId!;
    }
    const resultado: PedidoFonteBi[] = []; let cursor = "";
    for (;;) {
      const lote = await tx.$queryRaw<FonteSql[]>`
        SELECT p.id,p.numero,p.status,p.origem,p."referenciaOrigem",p."referenciaEstabelecimento",p."referenciaPedido",
          p."dataCompra",p."createdAt",p."entregueEm",p."updatedAt",h."updatedAt" AS "fonteAtualizadaEm",c.id AS "clienteId",
          GREATEST(p."updatedAt",h."updatedAt",c."updatedAt",
            (SELECT max(t."updatedAt") FROM "TratamentoFinanceiroPedido" t WHERE t."pedidoId"=p.id AND t."reduzVenda"),
            (SELECT max(m."createdAt") FROM "CreditoClienteMovimento" m WHERE m."pedidoAplicacaoId"=p.id AND m.tipo='LIBERACAO' AND m."reduzVenda")) AS "atualizadoComercialEm",
          CASE WHEN ${permissoes.contatos} THEN COALESCE(c.nome,p."compradorSnapshot"->>'nome') ELSE NULL END AS "clienteNome",
          CASE WHEN ${permissoes.contatos} AND c.tipo IN ('PF','PJ') THEN c.tipo ELSE NULL END AS "clienteTipo",
          p."canalId",CASE WHEN p.origem='HISTORICO_LEGADO' AND p."canalId" IS NULL THEN NULL ELSE COALESCE(p."canalNomeSnapshot",canal.nome) END AS "canalNomeSnapshot",
          p.atendimento,p.subtotal::text,p.desconto::text,p.frete::text,p."outrosCustos"::text,p.total::text,
          CASE WHEN ${permissoes.custos} THEN p."custoEntregaEfetivo"::text ELSE NULL END AS "custoEntrega",
          CASE WHEN p.atendimento='ENTREGA' THEN p."enderecoSnapshot"->>'cep' ELSE NULL END AS cep,
          CASE WHEN p.atendimento='ENTREGA' THEN p."enderecoSnapshot"->>'cidade' ELSE NULL END AS cidade,
          CASE WHEN p.atendimento='ENTREGA' THEN p."enderecoSnapshot"->>'bairro' ELSE NULL END AS bairro,
          CASE WHEN p.atendimento='ENTREGA' THEN p."enderecoSnapshot"->>'uf' ELSE NULL END AS uf,
          (p.origem IN ('TESTE','TEST','DEMONSTRACAO','AMOSTRA') OR COALESCE(p.rascunho->>'teste','false')='true'
            OR COALESCE(p."compradorSnapshot"->>'teste','false')='true'
            OR COALESCE(p.observacoes,'') ~* '^\\s*\\[(TESTE|AMOSTRA|EXEMPLO|DEMONSTRAÇÃO)\\]') AS teste,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'produtoId',i."produtoId",'nome',COALESCE(prod.nome,i."produtoSnapshot"->>'nome','Produto histórico não identificado'),
            'unidade',i."unidadeSnapshot",'quantidade',i.quantidade::text,'receita',i."totalLinha"::text,
            'categorias',CASE WHEN jsonb_typeof(i."produtoSnapshot"->'categorias')='array' AND jsonb_array_length(i."produtoSnapshot"->'categorias')>0 THEN i."produtoSnapshot"->'categorias'
              ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('id',cat.id,'nome',cat.nome)) FROM "ProdutoCategoriaVenda" pc JOIN "CategoriaVenda" cat ON cat.id=pc."categoriaId" WHERE pc."produtoId"=i."produtoId"),'[]'::jsonb) END))
            FROM "ItemPedidoVenda" i LEFT JOIN "ProdutoVenda" prod ON prod.id=i."produtoId" WHERE i."pedidoId"=p.id AND i.vigente),'[]'::jsonb) AS itens,
          CASE WHEN h.id IS NULL THEN NULL ELSE jsonb_build_object('totais',COALESCE(h."dadosOrigem"->'hub'->'consulta'->'totais',h."dadosOrigem"->'registro'->'totais'),
            'status',h."dadosOrigem"->'registro'->'status'->>'final_legado','regraIdentidade',h."dadosOrigem"->'registro'->'comprador'->>'regra_identidade',
            'freteOriginal',h."dadosOrigem"->'hub'->>'freteOriginal','parcelaNaoDetalhada',h."dadosOrigem"->'hub'->'parcelaNaoDetalhada'->>'valor',
            'entrega',CASE WHEN eh.dados->>'origem'='google-sheets-shipping' THEN jsonb_build_object(
              'versao',eh.dados->'versao','origem',eh.dados->'origem','modalidade',eh.dados->'modalidade','criterioModalidade',eh.dados->'criterioModalidade',
              'temShipping',COALESCE((eh.dados->>'enderecoOriginal') ~ '[^[:space:]]',false),
              'cep',eh.dados->'cep','bairro',eh.dados->'bairro','cidade',eh.dados->'cidade','uf',eh.dados->'uf',
              'provas',jsonb_build_object('cep',jsonb_build_object('confirmado',eh.dados#>'{provas,cep,confirmado}','origem',eh.dados#>'{provas,cep,origem}'),'bairro',jsonb_build_object('confirmado',eh.dados#>'{provas,bairro,confirmado}','origem',eh.dados#>'{provas,bairro,origem}'),'cidade',jsonb_build_object('confirmado',eh.dados#>'{provas,cidade,confirmado}','origem',eh.dados#>'{provas,cidade,origem}'),'uf',jsonb_build_object('confirmado',eh.dados#>'{provas,uf,confirmado}','origem',eh.dados#>'{provas,uf,origem}')),
              'postal',jsonb_build_object('origem',eh.dados#>'{postal,origem}','cep',eh.dados#>'{postal,cep}','compativel',eh.dados#>'{postal,compativel}','fonteSha256',eh.dados#>'{postal,fonteSha256}','resultadoSha256',eh.dados#>'{postal,resultadoSha256}'),
              'proveniencia',jsonb_build_object('spreadsheetId',eh.dados#>'{proveniencia,spreadsheetId}','sheetId',eh.dados#>'{proveniencia,sheetId}','aba',eh.dados#>'{proveniencia,aba}','colunaEndereco',eh.dados#>'{proveniencia,colunaEndereco}','cabecalhoEndereco',eh.dados#>'{proveniencia,cabecalhoEndereco}','colunaNumero',eh.dados#>'{proveniencia,colunaNumero}','numeroOriginal',eh.dados#>'{proveniencia,numeroOriginal}','linha',eh.dados#>'{proveniencia,linha}','fonteSha256',eh.dados#>'{proveniencia,fonteSha256}','conteudoSha256',eh.dados#>'{proveniencia,conteudoSha256}','linhaSha256',eh.dados#>'{proveniencia,linhaSha256}')) ELSE NULL END) END AS historico,
          (COALESCE((SELECT sum(t.valor) FROM "TratamentoFinanceiroPedido" t WHERE t."pedidoId"=p.id AND t."reduzVenda" AND t.status IN ('SOLICITADA','PROCESSANDO','CONCLUIDA')),0)
            + COALESCE((SELECT sum(m.valor) FROM "CreditoClienteMovimento" m WHERE m."pedidoAplicacaoId"=p.id AND m.tipo='LIBERACAO' AND m."reduzVenda"),0))::text AS reducoes
        FROM "PedidoVenda" p
        LEFT JOIN LATERAL (
          WITH RECURSIVE cliente_atual AS (
            SELECT cad.id,cad.nome,cad.tipo,cad."unificadoEmId",cad."updatedAt",ARRAY[cad.id]::text[] AS caminho
            FROM "ClienteVenda" cad WHERE cad.id=p."clienteId"
            UNION ALL
            SELECT prox.id,prox.nome,prox.tipo,prox."unificadoEmId",GREATEST(ant."updatedAt",prox."updatedAt"),ant.caminho||prox.id
            FROM cliente_atual ant JOIN "ClienteVenda" prox ON prox.id=ant."unificadoEmId"
            WHERE NOT prox.id=ANY(ant.caminho)
          ) SELECT id,nome,tipo,"updatedAt" FROM cliente_atual WHERE "unificadoEmId" IS NULL LIMIT 1
        ) c ON true
        LEFT JOIN "CanalVenda" canal ON canal.id=p."canalId"
        LEFT JOIN LATERAL (SELECT i.id,i."dadosOrigem",i."updatedAt" FROM "IdentidadeExternaVenda" i WHERE i."destinoId"=p.id AND i.entidade='PEDIDO_HISTORICO'
          AND i.origem='grazing-legado-orders' AND i.loja='grazing-hub' ORDER BY i."updatedAt" DESC LIMIT 1) h ON true
        LEFT JOIN LATERAL (SELECT h."dadosOrigem"->'hub'->'entregaHistorica' AS dados) eh ON true
        WHERE p.id>${cursor} AND ((p."dataCompra" IS NULL AND p."createdAt"<${limite}) OR p."dataCompra"<${somarDias(filtros.ate || diaNoFuso(new Date(), "America/Sao_Paulo"), 1)}::date)
        ORDER BY p.id ASC LIMIT 500`;
      for (const p of lote) {
        const historico = p.origem === "HISTORICO_LEGADO" || p.referenciaOrigem === "grazing-legado-orders", h = objetoBi(p.historico), totais = objetoBi(h.totais);
        const itens: ItemFonteBi[] = objetos(p.itens).map(i => ({ id: str(i.id)!, produtoId: str(i.produtoId), nome: str(i.nome) ?? "Produto histórico não identificado", unidade: str(i.unidade) ?? "Não informada", quantidade: str(i.quantidade), receita: decimal(i.receita).toFixed(2), categorias: objetos(i.categorias).filter(c => str(c.id) && str(c.nome)).map(c => ({ id: str(c.id)!, nome: str(c.nome)! } satisfies OpcaoBi)) }));
        const receitaItens = itens.reduce((n, i) => n.plus(i.receita), new Prisma.Decimal(0));
        const naoDetalhadoHistorico = decimal(h.parcelaNaoDetalhada ?? totais.valor_historico_nao_detalhado);
        const baseProdutos = decimal(p.subtotal).minus(p.desconto), reducoes = decimal(p.reducoes);
        // O pós-venda existente aloca por pagamento, sem indicar produto ou frete.
        // Só um pedido cujo total comprovado é exclusivamente produto permite a dedução.
        const somenteProdutos = decimal(p.frete).isZero() && decimal(p.outrosCustos).isZero() && typeof p.total === "string" && baseProdutos.eq(decimal(p.total));
        const reducaoSemComponente = !historico && reducoes.gt(0) && !somenteProdutos ? reducoes : new Prisma.Decimal(0);
        const receita = historico ? decimal(totais.liquido_itens, receitaItens.toString()).plus(naoDetalhadoHistorico) : Prisma.Decimal.max(0, baseProdutos.minus(somenteProdutos ? reducoes : 0));
        const freteOriginal = historico ? decimal(h.freteOriginal ?? totais.frete_ajuste_original) : decimal(p.frete);
        const geografia = geografiaPedidoBi({ historico, atendimento: p.atendimento, cep: p.cep, bairro: p.bairro, cidade: p.cidade, uf: p.uf, entregaHistorica: h.entrega, numeroOriginal: p.referenciaPedido });
        const retiradaHistorica = historico && geografia.modalidade === "RETIRADA";
        const clienteTipo = permissoes.contatos && (p.clienteTipo === "PF" || p.clienteTipo === "PJ") ? p.clienteTipo : null;
        // O vínculo explícito ao cadastro canônico vale para fontes nativas e históricas.
        const clienteIdentificavel = !!p.clienteId;
        const descontoFonte = historico ? str(totais.desconto_itens) : str(p.desconto);
        const descontos = descontoFonte === null ? null : decimal(descontoFonte).toFixed(2);
        const totalOriginalHistorico = historico ? str(totais.total_original) || null : null;
        const atualizado = [p.updatedAt, p.fonteAtualizadaEm, p.atualizadoComercialEm].filter((d): d is Date => d instanceof Date).sort((a, b) => a.getTime() - b.getTime()).at(-1)!;
        resultado.push({ id: p.id, numero: p.referenciaPedido ?? String(p.numero), status: p.status, origem: historico ? "historico" : "nativo", identidade: p.referenciaOrigem && p.referenciaEstabelecimento && p.referenciaPedido ? JSON.stringify([p.referenciaOrigem, p.referenciaEstabelecimento, p.referenciaPedido]) : null,
          data: dataCompraCivil(p.dataCompra) ?? diaNoFuso(p.createdAt, "America/Sao_Paulo"), dataEntrega: p.entregueEm ? diaNoFuso(p.entregueEm, "America/Sao_Paulo") : null, atualizadoEm: atualizado.toISOString(), clienteId: p.clienteId, clienteNome: p.clienteNome, clienteIdentificavel, clienteTipo, descontos, totalOriginalHistorico: totalOriginalHistorico === null ? null : decimal(totalOriginalHistorico).toFixed(2),
          canalId: p.canalId, canalNome: p.canalNomeSnapshot, ...geografia,
          itens, receita: receita.toFixed(2), naoDetalhado: receita.minus(receitaItens).toFixed(2), reducaoSemComponente: reducaoSemComponente.toFixed(2), frete: retiradaHistorica || historico && freteOriginal.lt(0) ? "0.00" : freteOriginal.toFixed(2), ajusteFrete: historico && freteOriginal.lt(0) ? freteOriginal.toFixed(2) : "0.00", freteOriginalRetirada: retiradaHistorica ? freteOriginal.toFixed(2) : undefined, ajusteComercial: historico ? decimal(totais.diferenca_total_apos_nao_detalhado).toFixed(2) : "0.00", custoEntrega: p.custoEntrega, statusHistorico: str(h.status), fonteHistorica: !!p.historico, teste: p.teste });
      }
      if (lote.length < 500) break;
      cursor = lote[lote.length - 1].id;
    }
    return { fontes: resultado, canais, clientes, clienteSelecionado, duracaoMs: Math.round(performance.now() - inicio) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}
function conferirFiltros(f: FiltrosBi, p: PermissoesBi) {
  if ((f.cliente || f.somenteSemRecompra || f.tipoCliente !== "todos") && !p.contatos) throw new ErroBi("Seu acesso não permite consultar compradores identificados.", 403);
  if (f.aba === "clientes" && !p.contatos) throw new ErroBi("Seu acesso não permite o detalhamento de clientes.", 403);
  if (f.aba === "rentabilidade" && !p.custos) throw new ErroBi("Seu acesso não permite consultar custos e margens.", 403);
}
export async function consultarBiVendas(entrada: Partial<FiltrosBi> = {}, permissoes: PermissoesBi) {
  const filtros = normalizarFiltrosBi(entrada); conferirFiltros(filtros, permissoes);
  const { fontes, canais, clientes, clienteSelecionado, duracaoMs } = await carregarFontes(filtros, permissoes);
  const resultado = montarResultadoBi(fontes, { ...filtros, cliente: clienteSelecionado }, permissoes, new Date(), { canais, clientes }); resultado.duracaoMs += duracaoMs; return resultado;
}
export async function exportarConsultaBiCsv(entrada: Partial<FiltrosBi>, permissoes: PermissoesBi) {
  if (!permissoes.exportar) throw new ErroBi("Seu acesso não permite exportar o Dashboard.", 403);
  const filtros = normalizarFiltrosBi(entrada); conferirFiltros(filtros, permissoes);
  const { fontes, canais, clientes, clienteSelecionado } = await carregarFontes(filtros, permissoes);
  // Uma leitura consistente abastece todas as páginas. A base nunca vai ao navegador.
  const primeiro = montarResultadoBi(fontes, { ...filtros, cliente: clienteSelecionado, pagina: 1 }, permissoes, new Date(), { exportacao: true, canais, clientes });
  return exportarBiCsv(primeiro);
}
