import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao, salvarVersaoFiscalNaTransacao } from "./servico";
import type { AnaliseNcm, ClassificacaoFiscal, ConfiguracaoNcm, TabelaFiscal } from "./tipos";
import { ErroEstruturaFiscal, hojeFiscal } from "./validacao";

type Cenario = ConfiguracaoNcm["cenarios"][number];
export type OpcaoComNcm = { id: string; nome: string; ncm: string | null };

/** Cenários de NCM de um produto a partir dos itens de um complemento do tipo Opção.
 * Só cria ou troca o cenário do item cujo NCM foi informado no cadastro; cenários de itens
 * sem NCM no cadastro são preservados como estão. Devolve null quando nada muda. */
export function cenariosDaOpcao(atuais: Cenario[], opcoes: OpcaoComNcm[], analise: (o: OpcaoComNcm & { ncm: string }) => AnaliseNcm): Cenario[] | null {
  let mudou = false; const cenarios = [...atuais];
  for (const o of opcoes) {
    if (!o.ncm) continue;
    const i = cenarios.findIndex(s => s.opcaoIds.length === 1 && s.opcaoIds[0] === o.id);
    if (i >= 0 && cenarios[i].ncm === o.ncm) continue;
    const novo: Cenario = { id: i >= 0 ? cenarios[i].id : `cenario-opcao-${o.id}`.slice(0, 100), nome: o.nome.slice(0, 120), opcaoIds: [o.id], ncm: o.ncm, analiseNcm: analise({ ...o, ncm: o.ncm }) };
    if (i >= 0) cenarios[i] = novo; else cenarios.push(novo);
    mudou = true;
  }
  return mudou ? cenarios : null;
}

/** Leva o NCM informado nos itens de um complemento Opção à classificação fiscal de cada
 * produto que usa o complemento, pelo caminho oficial (salvar → impacto → ativar), uma
 * transação por produto. Falha em um produto vira aviso e não desfaz o cadastro nem os demais.
 * Exige administrador: o NCM só muda com a permissão do responsável.
 * `somenteProdutoId` restringe a um produto (usado ao salvar o produto que recebeu o vínculo). */
export async function sincronizarNcmDoComplementoOpcao(grupoId: string, sessao: SessaoAtual, somenteProdutoId?: string): Promise<{ atualizados: string[]; avisos: string[] }> {
  const grupo = await prisma.grupoComplementoVenda.findUnique({ where: { id: grupoId }, select: { id: true, nome: true, tipo: true, opcoes: { select: { id: true, nome: true, ncm: true, ativo: true } }, produtos: { select: { produtoId: true, produto: { select: { nome: true, ativo: true } } } } } });
  const atualizados: string[] = [], avisos: string[] = [];
  if (!grupo || grupo.tipo !== "OPCAO" || !grupo.opcoes.some(o => o.ncm)) return { atualizados, avisos };
  const semNcm = new Set<string>();
  for (const vinculo of grupo.produtos.filter(v => v.produto.ativo && (!somenteProdutoId || v.produtoId === somenteProdutoId))) {
    const nome = vinculo.produto.nome;
    try {
      const mudou = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
        const base = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: vinculo.produtoId }, orderBy: { versao: "desc" } });
        if (!base) throw new ErroEstruturaFiscal("ainda não tem classificação fiscal; preencha a aba Fiscal do produto.");
        if (base.status !== "ATIVO") throw new ErroEstruturaFiscal("tem um rascunho fiscal em aberto; conclua-o na ficha fiscal.");
        const d = structuredClone(base.dados) as unknown as ClassificacaoFiscal, cfg = d.configuracaoNcm;
        if (d.tratamento !== "NORMAL") throw new ErroEstruturaFiscal("não é mercadoria ou preparação comum; ajuste na ficha fiscal.");
        if (cfg && (cfg.modoFiscal !== "UNIDADES_SEPARADAS" || cfg.grupoIds.length !== 1 || cfg.grupoIds[0] !== grupo.id || cfg.gruposEquivalentes?.length)) throw new ErroEstruturaFiscal("já tem NCM configurado por outra regra de escolhas; ajuste na ficha fiscal.");
        const tabela = (await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "TABELA", chave: "NCM", status: "ATIVO", vigenciaInicio: { lte: new Date(`${hojeFiscal()}T00:00:00.000Z`) } }, orderBy: [{ vigenciaInicio: "desc" }, { versao: "desc" }] }))?.dados as unknown as TabelaFiscal | undefined;
        const analise = (o: OpcaoComNcm & { ncm: string }): AnaliseNcm => {
          const descricao = tabela?.linhas.find(l => l.codigo === o.ncm)?.descricao;
          if (!descricao) throw new ErroEstruturaFiscal(`NCM ${o.ncm} de ${o.nome} não consta da tabela oficial vigente.`);
          return { fundamento: "DOCUMENTAL", confianca: "MEDIA", descricaoNcm: descricao.slice(0, 2000), dataAnalise: hojeFiscal(), justificativa: `NCM informado pelo responsável no cadastro do complemento ${grupo.nome}, item ${o.nome}.`, fontes: [`Cadastro de complemento ${grupo.id}, item ${o.id}`], pendenciasNcm: [] };
        };
        const cenarios = cenariosDaOpcao(cfg?.cenarios ?? [], grupo.opcoes, analise);
        for (const o of grupo.opcoes) if (o.ativo && !(cenarios ?? cfg?.cenarios ?? []).some(s => s.opcaoIds.length === 1 && s.opcaoIds[0] === o.id)) semNcm.add(o.nome);
        if (!cenarios) return false;
        d.configuracaoNcm = { grupoIds: [grupo.id], modoFiscal: "UNIDADES_SEPARADAS", padraoSemEscolhasAutorizado: false, cenarios, ...(cfg?.fotografiaTecnica ? { fotografiaTecnica: cfg.fotografiaTecnica } : {}) };
        d.ncmAplicabilidade = "APLICAVEL";
        d.analiseNcm ??= { fundamento: "DOCUMENTAL", confianca: "MEDIA", descricaoNcm: null, dataAnalise: hojeFiscal(), justificativa: `NCM definido pela opção escolhida no complemento ${grupo.nome}.`, fontes: [`Cadastro de complemento ${grupo.id}`], pendenciasNcm: [] };
        delete d.fotografiaTecnica;
        const nova = await salvarVersaoFiscalNaTransacao(tx, { tipo: "CLASSIFICACAO", chave: base.chave, dados: d, versaoBase: base.versao, vigenciaInicio: hojeFiscal(), justificativa: `NCM por opção atualizado no cadastro do complemento ${grupo.nome}.`.slice(0, 1900), fontes: [`Cadastro de complemento ${grupo.id}`, `Classificação anterior ${base.id}`], chaveOperacao: `ncm-opcao-${randomUUID()}` }, sessao);
        const impacto = await analisarImpactoFiscalNaTransacao(tx, nova.id, sessao);
        await ativarVersaoFiscalNaTransacao(tx, nova.id, impacto.hash, randomUUID(), sessao);
        return true;
      }, { timeout: 60000 });
      if (mudou) atualizados.push(nome);
    } catch (e) {
      if (!(e instanceof ErroEstruturaFiscal)) throw e;
      avisos.push(`${nome}: ${e.message}`);
    }
  }
  if (semNcm.size) avisos.push(`Sem NCM: ${[...semNcm].join(", ")}. A nota fica bloqueada quando o cliente escolher ${semNcm.size === 1 ? "esse item" : "um desses itens"}.`);
  return { atualizados, avisos };
}
