import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao, conferirAutorFiscal, consultarVersoesFiscais, dtoVersaoFiscal, salvarVersaoFiscalNaTransacao } from "./servico";
import { fotografarClassificacaoNormal, fotografarReceitaFiscal, hashTecnico } from "./fotografia-tecnica";
import { diferencasMateriais, type DiferencasMateriais } from "./revisao-ncm-dominio";
import { ErroEstruturaFiscal, hojeFiscal, textoFiscal } from "./validacao";
import { versoesVigentes } from "./vigencia";
import type { ClassificacaoFiscal, MateriaisFiscaisFotografados } from "./tipos";

/** Produto cuja composição mudou depois da análise fiscal. O NCM vigente continua valendo:
 * só muda quando o responsável salva nova versão (manter ou alterar). */
export type RevisaoNcmPendente = {
  versaoId: string; produtoId: string; nome: string; codigo: string | null;
  /** NCM único ou os NCMs dos cenários da classificação vigente. */
  ncms: string[]; analisadoEm: string; mudancas: string[]; assinatura: string;
};

function descrever(d: DiferencasMateriais, nomes: Map<string, string>, prefixo = "") {
  const nome = (id: string) => nomes.get(id) ?? "ingrediente sem cadastro";
  return [
    ...d.incluidos.map(id => `${prefixo}Ingrediente incluído: ${nome(id)}`),
    ...d.retirados.map(id => `${prefixo}Ingrediente retirado: ${nome(id)}`),
    ...d.preparacoesAlteradas.map(id => `${prefixo}Receita da preparação alterada: ${nome(id)}`),
  ];
}

/** Somente leitura. Compara a fotografia analisada com o cadastro atual, produto a produto;
 * falha em um produto não interrompe os demais. */
export async function listarRevisoesNcmPendentes(tx: Prisma.TransactionClient, filtro?: { produtoIds?: string[] }): Promise<RevisaoNcmPendente[]> {
  // Com filtro (pedido), lê só as classificações desses produtos em vez de todo o histórico.
  const versoes = filtro?.produtoIds ? (await tx.versaoEstruturaFiscal.findMany({ where: { tipo: "CLASSIFICACAO", chave: { in: filtro.produtoIds } }, orderBy: [{ chave: "asc" }, { versao: "desc" }] })).map(dtoVersaoFiscal) : await consultarVersoesFiscais(tx, ["CLASSIFICACAO"]);
  const vigentes = versoesVigentes(versoes, hojeFiscal())
    .filter(v => v.tipo === "CLASSIFICACAO" && (!filtro?.produtoIds || filtro.produtoIds.includes(v.chave)));
  const bruto: { v: (typeof vigentes)[number]; c: ClassificacaoFiscal; textos: string[]; partes: { d: DiferencasMateriais; prefixo: string }[]; ids: Set<string>; opcoes: Set<string>; estado: unknown }[] = [];
  for (const v of vigentes) {
    const c = v.dados as ClassificacaoFiscal;
    if (!c.produtoId || c.tratamento !== "NORMAL") continue;
    const gravada = c.configuracaoNcm?.fotografiaTecnica, normal = c.configuracaoNcm ? undefined : c.fotografiaTecnica;
    if (!gravada && !normal) continue;
    const mudancas: string[] = [], ids = new Set<string>(), opcoes = new Set<string>(); let estado: unknown;
    const comparar = (analisado: MateriaisFiscaisFotografados | undefined, atual: MateriaisFiscaisFotografados | undefined, prefixo = "") => {
      const d = diferencasMateriais(analisado, atual);
      [...d.incluidos, ...d.retirados, ...d.preparacoesAlteradas].forEach(id => ids.add(id));
      return { d, prefixo };
    };
    const pendentes: ReturnType<typeof comparar>[] = [];
    try {
      if (normal) {
        const atual = await fotografarClassificacaoNormal(tx, c);
        const r = comparar(normal.materiais, atual.materiais); pendentes.push(r);
        if (normal.principalHash !== atual.principalHash && !r.d.incluidos.length && !r.d.retirados.length) mudancas.push("Quantidade, unidade ou modo de preparo de ingrediente alterado");
        estado = { principal: atual.principalHash, materiais: r.d.assinatura };
      } else if (gravada) {
        const atual = await fotografarReceitaFiscal(tx, c, false);
        const r = comparar(gravada.materiais?.principal, atual.materiais?.principal); if (gravada.materiais) pendentes.push(r);
        if (gravada.principalHash !== atual.principalHash && !r.d.incluidos.length && !r.d.retirados.length) mudancas.push("Quantidade, unidade ou modo de preparo de ingrediente alterado");
        const ramos: unknown[] = [];
        for (const o of gravada.opcaoHashes) {
          const hashAtual = atual.opcaoHashes.find(x => x.opcaoId === o.opcaoId)?.hash;
          const m = comparar(gravada.materiais?.opcoes.find(x => x.opcaoId === o.opcaoId)?.materiais, atual.materiais?.opcoes.find(x => x.opcaoId === o.opcaoId)?.materiais, `\u0000${o.opcaoId}\u0000`);
          const material = gravada.materiais ? m.d.diverge : false;
          if (hashAtual === o.hash && !material) continue;
          opcoes.add(o.opcaoId);
          if (material) pendentes.push(m);
          if (hashAtual !== o.hash && !m.d.incluidos.length && !m.d.retirados.length) mudancas.push(`\u0000${o.opcaoId}\u0000Composição ou quantidade da opção alterada`);
          ramos.push({ opcaoId: o.opcaoId, hash: hashAtual ?? null, materiais: m.d.assinatura });
        }
        estado = { principal: atual.principalHash, materiais: r.d.assinatura, ramos };
      }
    } catch (erro) {
      mudancas.push(`Composição atual não pôde ser conferida: ${erro instanceof ErroEstruturaFiscal ? erro.message : "falha ao ler o cadastro"}`);
      estado = { erro: true };
    }
    const partes = pendentes.filter(p => p.d.diverge);
    if (mudancas.length || partes.length) bruto.push({ v, c, textos: mudancas, partes, ids, opcoes, estado });
  }
  if (!bruto.length) return [];
  const [insumos, opcoes, produtos] = await Promise.all([
    tx.insumo.findMany({ where: { id: { in: [...new Set(bruto.flatMap(b => [...b.ids]))] } }, select: { id: true, nome: true } }),
    tx.opcaoComplementoVenda.findMany({ where: { id: { in: [...new Set(bruto.flatMap(b => [...b.opcoes]))] } }, select: { id: true, nome: true } }),
    tx.produtoVenda.findMany({ where: { id: { in: bruto.map(b => b.c.produtoId!) } }, select: { id: true, nome: true, codigo: true } }),
  ]);
  const nomes = new Map(insumos.map(i => [i.id, i.nome])), nomesOpcoes = new Map(opcoes.map(o => [o.id, o.nome]));
  const rotular = (texto: string) => texto.replace(/\u0000([^\u0000]+)\u0000/, (_, id: string) => `Opção ${nomesOpcoes.get(id) ?? "sem cadastro"} — `);
  return bruto.flatMap(b => {
    const produto = produtos.find(p => p.id === b.c.produtoId); if (!produto) return [];
    const mudancas = [...new Set([...b.textos, ...b.partes.flatMap(p => descrever(p.d, nomes, p.prefixo))].map(rotular))].slice(0, 20);
    const ncms = [...new Set([b.c.ncm, ...(b.c.configuracaoNcm?.cenarios.map(s => s.ncm) ?? [])].filter((n): n is string => !!n))];
    return [{ versaoId: b.v.id, produtoId: produto.id, nome: produto.nome, codigo: produto.codigo, ncms, analisadoEm: b.v.createdAt.slice(0, 10), mudancas, assinatura: hashTecnico({ versao: b.v.id, estado: b.estado }) }];
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function consultarRevisoesNcmPendentes(produtoIds?: string[]) {
  return prisma.$transaction(tx => listarRevisoesNcmPendentes(tx, produtoIds ? { produtoIds } : undefined), { timeout: 60000 });
}

/** Permissão explícita do responsável: registra nova versão com o mesmo NCM e a composição atual.
 * Usa o mesmo caminho de salvar, analisar impacto e ativar da ficha fiscal; nada é contornado. */
export async function manterNcmRevisado(entrada: { versaoId: string; assinatura: string; chaveOperacao: string }, sessao: SessaoAtual) {
  const versaoId = textoFiscal(entrada.versaoId, "Versão", 100), assinatura = textoFiscal(entrada.assinatura, "Revisão", 64), chave = textoFiscal(entrada.chaveOperacao, "Operação", 100);
  return prisma.$transaction(async tx => {
    await conferirAutorFiscal(tx, sessao, true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
    const repetida = await tx.versaoEstruturaFiscal.findUnique({ where: { chaveOperacao: `${chave}-manter-ncm` }, select: { status: true, criadoPorId: true } });
    if (repetida) { if (repetida.criadoPorId !== sessao.userId) throw new ErroEstruturaFiscal("Operação já utilizada por outro responsável."); return { ok: true as const }; }
    const base = await tx.versaoEstruturaFiscal.findUnique({ where: { id: versaoId } });
    if (!base || base.tipo !== "CLASSIFICACAO") throw new ErroEstruturaFiscal("Classificação fiscal não encontrada.");
    const ultima = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: base.chave }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
    if (ultima?.id !== base.id) throw new ErroEstruturaFiscal("Este produto já tem uma classificação mais recente ou um rascunho. Abra a ficha fiscal para concluir.");
    const pendente = (await listarRevisoesNcmPendentes(tx, { produtoIds: [base.chave] })).find(p => p.versaoId === base.id);
    if (!pendente) return { ok: true as const };
    if (pendente.assinatura !== assinatura) throw new ErroEstruturaFiscal("A composição mudou de novo depois deste aviso. Atualize a página e confira as alterações antes de manter o NCM.");
    const justificativa = `NCM mantido pelo responsável após alteração de composição. ${pendente.mudancas.join("; ")}`.slice(0, 1900);
    const nova = await salvarVersaoFiscalNaTransacao(tx, { tipo: "CLASSIFICACAO", chave: base.chave, dados: base.dados, versaoBase: base.versao, vigenciaInicio: hojeFiscal(), justificativa, fontes: ["Revisão de NCM confirmada pelo responsável no painel fiscal.", `Classificação anterior ${base.id}`], chaveOperacao: `${chave}-manter-ncm` }, sessao);
    const impacto = await analisarImpactoFiscalNaTransacao(tx, nova.id, sessao);
    await ativarVersaoFiscalNaTransacao(tx, nova.id, impacto.hash, randomUUID(), sessao);
    return { ok: true as const };
  }, { timeout: 60000 });
}

/** Aviso do pedido: somente os produtos deste pedido, sem dados do cliente. */
export async function consultarRevisoesNcmDoPedido(pedidoId: string) {
  return prisma.$transaction(async tx => {
    const itens = await tx.itemPedidoVenda.findMany({ where: { pedidoId, vigente: true, produtoId: { not: null } }, select: { produtoId: true } });
    const produtoIds = [...new Set(itens.map(i => i.produtoId!))];
    return produtoIds.length ? (await listarRevisoesNcmPendentes(tx, { produtoIds })).map(p => ({ produtoId: p.produtoId, nome: p.nome })) : [];
  }, { timeout: 30000 });
}

/** Identifica quais pendências ainda não foram avisadas por e-mail (tabela AlertaRevisaoNcm). */
export async function revisoesNcmSemAlerta(pendentes: RevisaoNcmPendente[]) {
  if (!pendentes.length) return [];
  const avisadas = await prisma.alertaRevisaoNcm.findMany({ where: { assinatura: { in: pendentes.map(p => p.assinatura) } }, select: { assinatura: true } });
  return pendentes.filter(p => !avisadas.some(a => a.assinatura === p.assinatura));
}
export async function registrarAlertaRevisoesNcm(pendentes: RevisaoNcmPendente[], destinatarios: number) {
  await prisma.alertaRevisaoNcm.createMany({ skipDuplicates: true, data: pendentes.map(p => ({ assinatura: p.assinatura, versaoId: p.versaoId, produtoId: p.produtoId, mudancas: p.mudancas, destinatarios })) });
}
