/** Operação única de 26/11/2026: os complementos "Sabores das tortas" e "Sabor do suco" passam
 * ao tipo Opção, com o NCM de cada item copiado da classificação fiscal vigente do produto.
 * Decisão do responsável ("Opção: escolhe apenas 1 item, NCM da opção"). Usa o serviço oficial
 * do cadastro; não altera preço, receita, classificação fiscal nem documentos emitidos.
 * Sem `--aplicar` desfaz tudo ao final (ensaio).
 * Executar: node --conditions=react-server --import tsx scripts/complementos-torta-suco-opcao.ts <usuarioId> [--aplicar] */
import type { ClassificacaoFiscal } from "../src/lib/tributacao/tipos";
import type { SessaoAtual } from "../src/lib/session";

const GRUPOS = ["13c184ac-4e84-4eef-aa2d-b826503405de", "29b92caf-e421-45e6-863f-73286d20fa47"];
class Ensaio extends Error {}

async function executar() {
  const [usuarioId, modo] = process.argv.slice(2), aplicar = modo === "--aplicar";
  if (!usuarioId || !process.env.DATABASE_URL) throw new Error("Informe o usuário administrador e a conexão explícita do alvo.");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { salvarGrupoNaTransacao } = await import("../src/lib/vendas/persistencia");
  const { calcularPreviaPedido } = await import("../src/lib/tributacao/pedidos");
  const { listarRevisoesNcmPendentes } = await import("../src/lib/tributacao/revisao-ncm");
  const { cenariosDaOpcao, sincronizarNcmDoComplementoOpcao } = await import("../src/lib/tributacao/ncm-opcao");
  const { limitesEfetivos } = await import("../src/lib/vendas/dominio");
  const relatorio: unknown[] = []; let sessao: SessaoAtual | undefined;
  try {
    await bancoPrincipal.$transaction(async tx => {
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, nome: true, sessaoVersao: true, ativo: true, perfilAcesso: { select: { sistema: true } } } });
      if (!u.ativo || u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new Error("Administrador ativo é obrigatório.");
      sessao = { userId: u.id, nome: u.nome, versao: u.sessaoVersao, admin: true } as unknown as SessaoAtual;
      for (const grupoId of GRUPOS) {
        const g = await tx.grupoComplementoVenda.findUniqueOrThrow({ where: { id: grupoId }, include: { opcoes: { orderBy: [{ ordem: "asc" }, { id: "asc" }] }, produtos: { include: { produto: { select: { nome: true } } } } } });
        if (g.tipo !== "COMPOSICAO" || g.produtos.length !== 1) throw new Error(`Complemento ${g.nome} diverge da auditoria; nada foi alterado.`);
        const v = g.produtos[0], produtoId = v.produtoId;
        const base = await tx.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "CLASSIFICACAO", chave: produtoId }, orderBy: { versao: "desc" } });
        const cfg = (base.dados as unknown as ClassificacaoFiscal).configuracaoNcm;
        if (base.status !== "ATIVO" || cfg?.modoFiscal !== "UNIDADES_SEPARADAS" || cfg.grupoIds.join() !== g.id) throw new Error(`Classificação de ${v.produto.nome} diverge da auditoria; nada foi alterado.`);
        const ncmDe = (opcaoId: string) => cfg.cenarios.find(s => s.opcaoIds.length === 1 && s.opcaoIds[0] === opcaoId)?.ncm ?? null;
        if (g.opcoes.some(o => o.ativo && !ncmDe(o.id))) throw new Error(`Item ativo de ${g.nome} sem NCM na classificação; nada foi alterado.`);
        const previas = async () => {
          const pedidos = await tx.pedidoVenda.findMany({ where: { status: "CONFIRMADO", itens: { some: { vigente: true, produtoId } } }, orderBy: { createdAt: "desc" }, take: 3, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
          const saida = [];
          for (const p of pedidos) {
            try { const { previa } = await calcularPreviaPedido(tx, p as never); saida.push({ pedido: p.numero, linhas: previa.linhas.filter(l => l.produtoId === produtoId).map(l => `${l.nome} | ${(l as unknown as { ncm?: string }).ncm} | ${l.valor}`), pendencias: previa.pendencias.filter(x => x.includes(v.produto.nome)).length, revisoes: (previa.revisoesNcm ?? []).filter(r => r.produtoId === produtoId).length }); }
            catch (e) { saida.push({ pedido: p.numero, erro: e instanceof Error ? e.message : "falha" }); }
          }
          return saida;
        };
        const antes = await previas(), limitesAntes = limitesEfetivos(g, v);
        await salvarGrupoNaTransacao(tx, { id: g.id, versao: g.versao, nome: g.nome, tipo: "OPCAO", categoriaId: g.categoriaId, minimo: g.minimo, maximo: g.maximo, repetir: g.repetir, ativo: g.ativo,
          opcoes: g.opcoes.map(o => ({ id: o.id, nome: o.nome, preco: o.preco.toString(), produtoId: o.produtoId, quantidade: o.quantidade.toString(), ativo: o.ativo, usarPrecoPadrao: o.usarPrecoPadrao, ncm: ncmDe(o.id) })) }, { userId: u.id, nome: u.nome });
        const d = await tx.grupoComplementoVenda.findUniqueOrThrow({ where: { id: g.id }, include: { opcoes: { orderBy: [{ ordem: "asc" }, { id: "asc" }] } } });
        const iguais = g.opcoes.every(o => { const n = d.opcoes.find(x => x.id === o.id); return !!n && n.ativo === o.ativo && n.preco.equals(o.preco) && n.produtoId === o.produtoId && JSON.stringify(n.composicao) === JSON.stringify(o.composicao) && n.ordem === o.ordem; });
        if (!iguais || d.opcoes.length !== g.opcoes.length) throw new Error(`Itens de ${g.nome} mudaram além do tipo e do NCM; nada foi alterado.`);
        const fiscalMudaria = cenariosDaOpcao(cfg.cenarios, d.opcoes, () => { throw new Error("não deveria criar análise"); }) !== null;
        relatorio.push({ complemento: g.nome, produto: v.produto.nome, tipo: `${g.tipo} → ${d.tipo}`, limiteNoProduto: `${limitesAntes.minimo}-${limitesAntes.maximo} → ${limitesEfetivos(d, v).minimo}-${limitesEfetivos(d, v).maximo}`, itens: d.opcoes.map(o => `${o.nome}: ${o.ncm}`), classificacaoMudaria: fiscalMudaria, revisoesPendentes: (await listarRevisoesNcmPendentes(tx, { produtoIds: [produtoId] })).length, antes, depois: await previas() });
      }
      if (!aplicar) throw new Ensaio();
    }, { timeout: 120000 });
    if (aplicar) for (const grupoId of GRUPOS) relatorio.push({ sincronizacao: grupoId, ...(await sincronizarNcmDoComplementoOpcao(grupoId, sessao!)) });
  } catch (e) { if (!(e instanceof Ensaio)) throw e; }
  finally { await bancoPrincipal.$disconnect(); }
  console.log(JSON.stringify({ modo: aplicar ? "APLICADO" : "ENSAIO_DESFEITO", relatorio }, null, 1));
}
void executar().catch(e => { console.error(e instanceof Error ? e.message : "Operação não confirmada."); process.exitCode = 1; });
