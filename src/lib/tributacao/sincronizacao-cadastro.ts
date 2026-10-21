import "server-only";
import { Prisma, type VersaoEstruturaFiscal } from "@/generated/prisma/client";
import { historicoFiscalJsonb, lerFiscalTexto, mesclarFiscalJsonb } from "@/lib/vendas/fiscal-jsonb";
import { lerAjustesOpcoes, opcoesEfetivas, validarComponentes } from "@/lib/vendas/dominio";
import type { ClassificacaoFiscal, ComportamentoFiscal, VersaoFiscalDto } from "./tipos";
import { ErroEstruturaFiscal } from "./validacao";
import { grupoOperacionalFiscal } from "./grupos-operacionais";

type Banco = Prisma.TransactionClient;
type Autor = { userId: string; nome: string };
export async function conferirVinculosCenariosNcm(tx: Banco, c: ClassificacaoFiscal, vigentes?: VersaoFiscalDto[]) {
  const cfg = c.configuracaoNcm;
  if (!cfg) return;
  if (!c.produtoId) throw new ErroEstruturaFiscal("Cenários discriminantes exigem produto comercial principal.");
  const grupos = [...cfg.grupoIds, ...(cfg.gruposEquivalentes?.map(g => g.grupoId) ?? [])];
  if (await tx.produtoGrupoVenda.count({ where: { produtoId: c.produtoId, grupoId: { in: grupos } } }) !== grupos.length) throw new ErroEstruturaFiscal("Grupo discriminante ou equivalente não pertence ao produto principal.");
  const ids = [...new Set([...cfg.cenarios.flatMap(s => s.opcaoIds), ...(cfg.gruposEquivalentes?.flatMap(g => g.opcaoIds) ?? [])])];
  const opcoes = await tx.opcaoComplementoVenda.findMany({ where: { id: { in: ids }, grupoId: { in: grupos } }, include: { produto: { select: { preco: true } }, grupo: { include: { produtos: { where: { produtoId: c.produtoId } } } } } });
  if (opcoes.length !== ids.length) throw new ErroEstruturaFiscal("Opção discriminante não pertence aos grupos declarados.");
  if (cfg.gruposEquivalentes?.some(g => g.opcaoIds.some(id => opcoes.find(o => o.id === id)?.grupoId !== g.grupoId)) || cfg.cenarios.some(s => s.opcaoIds.some(id => !cfg.grupoIds.includes(opcoes.find(o => o.id === id)!.grupoId)))) throw new ErroEstruturaFiscal("Opção deve pertencer ao grupo discriminante ou equivalente documentado.");
  if (!vigentes) return;
  for (const o of opcoes) {
    const vinculo = o.grupo.produtos[0];
    const efetiva = opcoesEfetivas([{ id: o.id, preco: (o.usarPrecoPadrao ? o.produto?.preco ?? o.preco : o.preco).toString(), ativo: o.ativo, composicao: o.composicao == null ? null : validarComponentes(o.composicao) }], { opcoesExcluidas: vinculo.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(vinculo.ajustesOpcoes) })[0];
    const b = vigentes.find(v => v.tipo === "COMPLEMENTO" && v.chave === o.id)?.dados as ComportamentoFiscal | undefined;
    const aliasComposicao = o.grupo.tipo === "COMPOSICAO" && !!efetiva.composicao?.length;
    if (!o.grupo.ativo || !efetiva?.ativo || o.produtoId && !aliasComposicao && !await tx.produtoVenda.count({ where: { id: o.produtoId, ativo: true } }) || !b || !["INCLUIDO", "INTEGRADO"].includes(b.comportamento) || b.comportamento === "INCLUIDO" && !new Prisma.Decimal(efetiva.preco).isZero()) throw new ErroEstruturaFiscal("Cenário NCM exige opções comercializáveis e comportamento integrado ao principal; não discriminar sabor como mercadoria artificial.");
  }
}
/** N/A exige uso real exclusivamente integrado; o nome e o preço isolado não comprovam isso. */
export async function conferirConfiguracaoSemNcm(tx: Banco, c: ClassificacaoFiscal, vigentes: VersaoFiscalDto[]) {
  if (c.ncmAplicabilidade !== "NAO_APLICAVEL" || c.tratamento !== "OPCAO_CONFIGURACAO") return;
  if (!c.produtoId) throw new ErroEstruturaFiscal("Configuração sem NCM exige produto comercial real.");
  const produto = await tx.produtoVenda.findUniqueOrThrow({ where: { id: c.produtoId }, select: { classificacao: true, classificacoes: true, preco: true } });
  if (produto.classificacoes.includes("PRINCIPAL") || produto.classificacao === "PRINCIPAL") throw new ErroEstruturaFiscal("NCM não aplicável à configuração exige ausência de venda como produto principal.");
  const opcoes = await tx.opcaoComplementoVenda.findMany({ where: { produtoId: c.produtoId, ativo: true, grupo: { ativo: true } }, include: { grupo: { include: { produtos: { where: { produto: { ativo: true, classificacoes: { has: "PRINCIPAL" } } } } } } } });
  let usos = 0;
  for (const o of opcoes) for (const vinculo of o.grupo.produtos) {
    const efetiva = opcoesEfetivas([{ id: o.id, preco: (o.usarPrecoPadrao ? produto.preco : o.preco).toString(), ativo: o.ativo }], { opcoesExcluidas: vinculo.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(vinculo.ajustesOpcoes) })[0];
    if (!efetiva?.ativo) continue;
    const comportamento = vigentes.find(v => v.tipo === "COMPLEMENTO" && v.chave === o.id)?.dados as ComportamentoFiscal | undefined;
    if (!comportamento || comportamento.produtoId != null && comportamento.produtoId !== c.produtoId || !["INCLUIDO", "INTEGRADO"].includes(comportamento.comportamento) || comportamento.comportamento === "INCLUIDO" && !new Prisma.Decimal(efetiva.preco).isZero()) throw new ErroEstruturaFiscal("Configuração sem NCM exige comportamento incluído ou integrado comprovado em todos os vínculos ativos, sem mercadoria independente.");
    usos++;
  }
  if (!usos) throw new ErroEstruturaFiscal("Configuração sem NCM não possui vínculo ativo integrado comprovado.");
}

export async function sincronizarClassificacaoCadastro(tx: Banco, v: VersaoEstruturaFiscal, autor: Autor, hoje: string, vigentes: VersaoFiscalDto[]) {
  const c = v.dados as unknown as ClassificacaoFiscal;
  if (v.tipo === "CLASSIFICACAO" && c.referenciaInternaInsumoId) return { situacao: "REFERENCIA_INTERNA_SEM_CADASTRO_COMERCIAL" as const };
  if (v.tipo !== "CLASSIFICACAO" || !c.ncmAplicabilidade || !c.analiseNcm) return { situacao: "SEM_METADATA" as const };
  if (!c.produtoId) throw new ErroEstruturaFiscal("Identidade comercial ausente na classificação.");
  if (v.vigenciaInicio.toISOString().slice(0, 10) > hoje || vigentes.find(x => x.tipo === "CLASSIFICACAO" && x.chave === v.chave)?.id !== v.id) return { situacao: "VIGENCIA_ADIADA" as const };
  const fiscalAntesTexto = await lerFiscalTexto(tx, c.produtoId);
  const produto = await tx.produtoVenda.findUniqueOrThrow({ where: { id: c.produtoId }, select: { versao: true, ativo: true, fiscalRevisado: true, grupoFiscalId: true } });
  if (!produto.ativo) return { situacao: "PRODUTO_INATIVO_PRESERVADO" as const };
  const codigoGrupo = c.grupo ?? (c.tratamento === "KIT_COMPOSTO" ? "KIT_COMPOSTO" : c.tratamento === "OPCAO_CONFIGURACAO" ? "OPCAO_CONFIGURACAO" : null);
  // O grupo de cadastro é independente do enquadramento técnico GF01–GF12.
  // Uma revisão de NCM não deve desfazer uma organização operacional explícita.
  const operacional = produto.grupoFiscalId ? await tx.grupoFiscalVenda.findUnique({ where: { id: produto.grupoFiscalId }, select: { id: true, ativo: true, fiscal: true } }) : null;
  const legado = codigoGrupo && !(operacional?.ativo && grupoOperacionalFiscal(operacional.fiscal)) ? await tx.grupoFiscalVenda.findUnique({ where: { codigo: codigoGrupo }, select: { id: true, ativo: true, fiscal: true } }) : null;
  const sucessor = (legado?.fiscal as Record<string, unknown> | undefined)?.grupoFiscalSucessorId;
  const grupo = operacional?.ativo && grupoOperacionalFiscal(operacional.fiscal) ? operacional : legado?.ativo ? legado : typeof sucessor === "string" ? await tx.grupoFiscalVenda.findUnique({ where: { id: sucessor }, select: { id: true, ativo: true } }) : legado;
  if (codigoGrupo && !grupo?.ativo) throw new ErroEstruturaFiscal("Grupo fiscal da classificação indisponível; ativação integral revertida.");
  const patch: Record<string, string> = { ncmAplicabilidade: c.ncmAplicabilidade, ncmClassificacaoVersaoId: v.id, ncmConfianca: c.analiseNcm.confianca, ncmModo: c.configuracaoNcm ? "POR_CONFIGURACAO" : c.ncmAplicabilidade === "NAO_APLICAVEL" ? "NAO_APLICAVEL" : "INDIVIDUAL" };
  // A configuração pode preservar um NCM único fundamentado em todos os ramos;
  // confiança do NCM e aptidão global continuam distintas.
  const ncmConcluido = c.ncmAplicabilidade === "APLICAVEL" && c.analiseNcm.confianca !== "BAIXA" && !c.analiseNcm.pendenciasNcm.length && !!c.ncm;
  const ncmInvariavel = ncmConcluido && (!c.configuracaoNcm || c.configuracaoNcm.cenarios.every(s => s.ncm === c.ncm && s.analiseNcm.confianca !== "BAIXA" && !s.analiseNcm.pendenciasNcm.length));
  if (ncmInvariavel) patch.ncm = c.ncm!;
  const fiscalAtual = JSON.parse(fiscalAntesTexto) as { observacoes?: unknown; ncm?: unknown; ncmClassificacaoVersaoId?: unknown };
  if (fiscalAtual.observacoes !== undefined && typeof fiscalAtual.observacoes !== "string") throw new ErroEstruturaFiscal("Observações fiscais anteriores inválidas; preservar cadastro e corrigir sua estrutura.");
  const conteudoNota = `${c.ncmAplicabilidade === "NAO_APLICAVEL" ? "NCM fiscal não aplicável ao registro; " : c.configuracaoNcm ? ncmInvariavel ? "NCM final invariável nas configurações comprovadas; escolhas e receitas continuam sujeitas à validação versionada; " : "NCM final varia pelos cenários comprovados de configuração, sem código único universal; " : ""}${c.analiseNcm.justificativa}${c.ncmAplicabilidade === "NAO_APLICAVEL" && typeof fiscalAtual.ncm === "string" && fiscalAtual.ncm ? " Código NCM anterior preservado exclusivamente como identidade do registro/ingrediente; não cria linha fiscal independente." : ""}`;
  const anteriores = fiscalAtual.observacoes ?? "";
  const ultimaNota = anteriores.slice(anteriores.lastIndexOf("[Análise NCM "));
  // A versão e sua auditoria registram toda revisão. Repetir o mesmo texto no
  // cadastro esgotaria o campo ao corrigir apenas pendências operacionais.
  const analiseJaRegistrada = typeof fiscalAtual.ncmClassificacaoVersaoId === "string"
    && /^\[Análise NCM [A-Za-z0-9_-]{1,100}\] ([\s\S]*)$/.exec(ultimaNota)?.[1] === conteudoNota;
  const observacoes = analiseJaRegistrada ? anteriores : `${anteriores}${anteriores ? "\n\n" : ""}[Análise NCM ${v.id}] ${conteudoNota}`;
  if (observacoes.length > 2000) throw new ErroEstruturaFiscal("Observações fiscais excederiam 2000 caracteres; ajustar a justificativa preservando as notas anteriores.");
  patch.observacoes = observacoes;
  await mesclarFiscalJsonb(tx, c.produtoId, patch);
  const grupoFiscalId = grupo?.id ?? produto.grupoFiscalId;
  const atualizado = await tx.produtoVenda.updateMany({ where: { id: c.produtoId, versao: produto.versao, ativo: true }, data: { grupoFiscalId, versao: { increment: 1 } } });
  if (atualizado.count !== 1) throw new ErroEstruturaFiscal("Produto mudou durante a ativação; transação integral revertida.");
  const fonteId = await historicoFiscalJsonb(tx, autor, "FISCAL", c.produtoId, { revisado: produto.fiscalRevisado, grupoFiscalId: produto.grupoFiscalId, versao: produto.versao }, { revisado: produto.fiscalRevisado, grupoFiscalId, versao: produto.versao + 1, sincronizacaoEstruturaFiscal: { versaoId: v.id, hashVersao: v.hash, origem: "ATIVACAO_SERVICO" } }, fiscalAntesTexto);
  return { situacao: "APLICADA" as const, produtoId: c.produtoId, versaoCadastro: produto.versao + 1, fonteHistoricoId: fonteId };
}
