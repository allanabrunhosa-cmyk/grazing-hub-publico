import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { lerAjustesOpcoes, opcoesEfetivas, validarComponentes } from "@/lib/vendas/dominio";
import type { ClassificacaoFiscal, ComportamentoFiscal, ComprovacaoFisicaFiscal, ConfiguracaoNcm, ItemComercialFiscal, MateriaisFiscaisFotografados, ReceitaFiscalDocumentada } from "./tipos";
import { ErroEstruturaFiscal, hojeFiscal } from "./validacao";
import { fotografarMateriais } from "./receita-material";
const D = Prisma.Decimal.clone({ precision: 80 });

type Componente = { insumoId: string; unidade: string; quantidade: string };
export type FotografiaReceitaFiscal = NonNullable<ConfiguracaoNcm["fotografiaTecnica"]>;
export function hashTecnico(v: unknown) {
  const ordenar = (x: unknown): unknown => Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenar(v)])) : x;
  return createHash("sha256").update(JSON.stringify(ordenar(v))).digest("hex");
}
function composicao(itens: Componente[]) {
  const totais = new Map<string, { insumoId: string; unidade: string; quantidade: Prisma.Decimal }>();
  for (const c of itens) {
    if (typeof c.insumoId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(c.insumoId) || !/^[A-Z0-9]{1,6}$/.test(c.unidade) || typeof c.quantidade !== "string" || c.quantidade.length > 100) throw new ErroEstruturaFiscal("Identidade física de ingrediente inválida na fotografia técnica.");
    const q = new D(c.quantidade);
    if (!q.isFinite() || q.lte(0) || q.gte("1000000000000") || q.decimalPlaces() > 18) throw new ErroEstruturaFiscal("Quantidade física não representável na fotografia técnica.");
    const chave = `${c.insumoId}:${c.unidade}`, anterior = totais.get(chave);
    totais.set(chave, { insumoId: c.insumoId, unidade: c.unidade, quantidade: q.plus(anterior?.quantidade ?? 0) });
  }
  return [...totais.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, c]) => ({ ...c, quantidade: c.quantidade.toString() }));
}
export const hashPrincipalTecnico = (unidade: string, componentes: Componente[], modoPreparo?: string | null) => hashTecnico({ unidade, componentes: composicao(componentes), ...(modoPreparo ? { modoPreparo } : {}) });
export const hashOpcaoTecnica = (produtoId: string | null, componentes: Componente[]) => hashTecnico({ produtoId, componentes: composicao(componentes) });
export const hashReceitaDocumentada = (r: ReceitaFiscalDocumentada) => hashTecnico({ componentesFixos: composicao(r.componentesFixos), opcoes: r.opcoes.map(o => ({ opcaoId: o.opcaoId, componentes: composicao(o.componentes) })).sort((a,b) => a.opcaoId.localeCompare(b.opcaoId)), justificativa: r.justificativa, fontes: [...r.fontes].sort() });
async function conferirIngredientesDocumentados(tx: Prisma.TransactionClient, ingredientes: Componente[]) {
  const ids = [...new Set(ingredientes.map(c => c.insumoId))];
  const insumos = await tx.insumo.findMany({ where: { id: { in: ids } }, select: { id: true, ativo: true, excluidoEm: true } });
  if (insumos.length !== ids.length || insumos.some(i => !i.ativo || i.excluidoEm)) throw new ErroEstruturaFiscal("Ingrediente da receita fiscal documentada inexistente, inativo ou excluído.");
  // A unidade final documentada pode diferir da unidade de estoque: nenhuma conversão é inferida.
  composicao(ingredientes);
}

/** Não inclui nome, preço, foto, ordem ou auditoria: apenas identidade, unidade e quantidade física. */
export async function fotografarReceitaFiscal(tx: Prisma.TransactionClient, c: ClassificacaoFiscal, validarDisponibilidade = true, opcaoIdsSelecionados?: string[]): Promise<FotografiaReceitaFiscal> {
  if (!c.produtoId || !c.configuracaoNcm) throw new ErroEstruturaFiscal("Fotografia técnica exige principal comercial e cenários declarados.");
  const ids = [...new Set([...c.configuracaoNcm.cenarios.flatMap(s => s.opcaoIds), ...(c.configuracaoNcm.gruposEquivalentes?.flatMap(g => g.opcaoIds) ?? [])])];
  if (c.receitaFiscalDocumentada && ids.some(id => !c.receitaFiscalDocumentada!.opcoes.some(o => o.opcaoId === id))) throw new ErroEstruturaFiscal("Porção fiscal documentada ausente para uma opção abrangida pela classificação.");
  return fotografarEscolhasProduto(tx, c.produtoId, ids.filter(id => !opcaoIdsSelecionados || opcaoIdsSelecionados.includes(id)).map(opcaoId => ({ opcaoId, quantidade: "1" })), validarDisponibilidade, c.baseSemIngredientesComprovada, c.receitaFiscalDocumentada);
}
async function fotografarEscolhasProduto(tx: Prisma.TransactionClient, produtoId: string, escolhas: { opcaoId: string; grupoId?: string; quantidade: string }[], validarDisponibilidade = true, baseSemIngredientesComprovada = false, documentada?: ReceitaFiscalDocumentada): Promise<FotografiaReceitaFiscal> {
  const p = await tx.produtoVenda.findUniqueOrThrow({ where: { id: produtoId }, include: { componentes: true, grupos: { include: { grupo: true } } } });
  if (validarDisponibilidade && !p.ativo) throw new ErroEstruturaFiscal("Mercadoria da fotografia técnica está inativa.");
  if (baseSemIngredientesComprovada && p.componentes.length) throw new ErroEstruturaFiscal("Declaração de base sem ingredientes diverge da composição fixa do principal.");
  const ids = escolhas.map(e => e.opcaoId);
  const opcoes = await tx.opcaoComplementoVenda.findMany({ where: { id: { in: ids } }, include: { produto: { include: { componentes: true } } } });
  if (opcoes.length !== ids.length) throw new ErroEstruturaFiscal("Opção ausente na fotografia técnica da receita.");
  const materiaisOpcoes: NonNullable<FotografiaReceitaFiscal["materiais"]>["opcoes"] = [];
  const opcaoHashes: FotografiaReceitaFiscal["opcaoHashes"] = [];
  for (const o of opcoes) {
    const vinculo = p.grupos.find(v => v.grupoId === o.grupoId);
    const escolha = escolhas.find(e => e.opcaoId === o.id)!;
    if (!vinculo || escolha.grupoId && escolha.grupoId !== o.grupoId) throw new ErroEstruturaFiscal("Grupo da receita não pertence ao principal.");
    const efetiva = opcoesEfetivas([{ ...o, preco: o.preco.toString(), composicao: o.composicao == null ? null : validarComponentes(o.composicao) }], { opcoesExcluidas: vinculo.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(vinculo.ajustesOpcoes) })[0];
    const componentes = efetiva.composicao ?? o.produto?.componentes ?? [];
    const aliasComposicao = vinculo.grupo.tipo === "COMPOSICAO" && !!efetiva.composicao?.length;
    if (validarDisponibilidade && (!vinculo.grupo.ativo || !efetiva.ativo || o.produto && !o.produto.ativo && !aliasComposicao)) throw new ErroEstruturaFiscal("Opção da receita técnica indisponível no catálogo atual.");
    const multiplicador = efetiva.composicao == null ? o.quantidade : new D(1);
    const hashCadastro = hashOpcaoTecnica(o.produtoId, componentes.map(k => ({ insumoId: k.insumoId, unidade: k.unidade, quantidade: new D(k.quantidade).mul(multiplicador).toString() })));
    const porcao = documentada?.opcoes.find(x => x.opcaoId === o.id);
    if (documentada && !porcao) throw new ErroEstruturaFiscal("Opção escolhida sem receita fiscal final documentada.");
    if (porcao) await conferirIngredientesDocumentados(tx, porcao.componentes);
    opcaoHashes.push({ opcaoId: o.id, hash: porcao ? hashTecnico({ cadastro: hashCadastro, documentada: hashOpcaoTecnica(o.produtoId, porcao.componentes) }) : hashCadastro });
    materiaisOpcoes.push({ opcaoId: o.id, materiais: await fotografarMateriais(tx, [...componentes.map(k => k.insumoId), ...(porcao?.componentes.map(k => k.insumoId) ?? [])]) });
  }
  if (documentada) await conferirIngredientesDocumentados(tx, documentada.componentesFixos);
  const hashCadastro = hashPrincipalTecnico(p.unidade, p.componentes.map(k => ({ insumoId: k.insumoId, unidade: k.unidade, quantidade: k.quantidade.toString() })), p.modoPreparo);
  return { algoritmo: "grazing.receita-fiscal.v1", principalHash: documentada ? hashTecnico({ cadastro: hashCadastro, documentada: hashPrincipalTecnico(p.unidade, documentada.componentesFixos, p.modoPreparo) }) : hashCadastro, opcaoHashes: opcaoHashes.sort((a,b) => a.opcaoId.localeCompare(b.opcaoId)), ...(documentada ? { documentacaoHash: hashReceitaDocumentada(documentada) } : {}), materiais: { principal: await fotografarMateriais(tx, [...p.componentes.map(k => k.insumoId), ...(documentada?.componentesFixos.map(k => k.insumoId) ?? [])]), opcoes: materiaisOpcoes.sort((a,b) => a.opcaoId.localeCompare(b.opcaoId)) } };
}
export async function fotografarClassificacaoNormal(tx: Prisma.TransactionClient, c: ClassificacaoFiscal): Promise<NonNullable<ClassificacaoFiscal["fotografiaTecnica"]>> {
  if (c.referenciaInternaInsumoId) {
    const ins = await tx.insumo.findUniqueOrThrow({ where: { id: c.referenciaInternaInsumoId }, select: { unidade: true } });
    return { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: hashPrincipalTecnico(c.unidade, [{ insumoId: c.referenciaInternaInsumoId, unidade: ins.unidade, quantidade: c.conversaoUnidade?.quantidadeEstoquePorUnidadeFiscal ?? "1" }]), materiais: await fotografarMateriais(tx, [c.referenciaInternaInsumoId]) };
  }
  if (!c.produtoId) throw new ErroEstruturaFiscal("Identidade física do produto ausente.");
  const p = await tx.produtoVenda.findUniqueOrThrow({ where: { id: c.produtoId }, include: { componentes: true } });
  if (c.receitaFiscalDocumentada) await conferirIngredientesDocumentados(tx, c.receitaFiscalDocumentada.componentesFixos);
  const cadastro = hashPrincipalTecnico(p.unidade, p.componentes.map(k => ({ insumoId: k.insumoId, unidade: k.unidade, quantidade: k.quantidade.toString() })), p.modoPreparo);
  return { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: c.receitaFiscalDocumentada ? hashTecnico({ cadastro, documentada: hashPrincipalTecnico(p.unidade, c.receitaFiscalDocumentada.componentesFixos, p.modoPreparo) }) : cadastro, ...(c.receitaFiscalDocumentada ? { documentacaoHash: hashReceitaDocumentada(c.receitaFiscalDocumentada) } : {}), materiais: await fotografarMateriais(tx, [...p.componentes.map(k => k.insumoId), ...(c.receitaFiscalDocumentada?.componentesFixos.map(k => k.insumoId) ?? [])]) };
}
/** O servidor sela a receita dos componentes comerciais declarados, sem criar SKU. */
export async function fotografarComponentesKit(tx: Prisma.TransactionClient, c: ClassificacaoFiscal, conferir = false, dataReferencia = hojeFiscal()) {
  for (const k of c.componentesKit ?? []) {
    let receita: NonNullable<ItemComercialFiscal["receitaFotografada"]>;
    if (k.produtoId) {
      const v = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: k.produtoId, status: "ATIVO", vigenciaInicio: { lte: new Date(`${dataReferencia}T00:00:00Z`) } }, orderBy: [{ vigenciaInicio: "desc" }, { versao: "desc" }] });
      const filho = v?.dados as unknown as ClassificacaoFiscal | undefined;
      const foto = filho?.configuracaoNcm ? await fotografarReceitaFiscal(tx, filho, true, (k.escolhas ?? []).map(e => e.opcaoId)) : await fotografarEscolhasProduto(tx, k.produtoId, k.escolhas ?? [], true, false, filho?.receitaFiscalDocumentada);
      receita = { principalHash: foto.principalHash, opcaoHashes: foto.opcaoHashes, materiais: foto.materiais, ...(foto.documentacaoHash ? { documentacaoHash: foto.documentacaoHash } : {}) };
    }
    else {
      const v = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: `INSUMO:${k.referenciaInternaInsumoId}`, status: "ATIVO", vigenciaInicio: { lte: new Date(`${dataReferencia}T00:00:00Z`) } }, orderBy: [{ vigenciaInicio: "desc" }, { versao: "desc" }] });
      if (!v) throw new ErroEstruturaFiscal("Referência interna do kit exige classificação individual ativada antes de fotografar a receita.");
      const foto = await fotografarClassificacaoNormal(tx, v.dados as unknown as ClassificacaoFiscal); receita = { principalHash: foto.principalHash, opcaoHashes: [], materiais: { principal: foto.materiais, opcoes: [] } };
    }
    if (conferir) {
      if (!k.receitaFotografada || hashTecnico(k.receitaFotografada) !== hashTecnico(receita)) throw new ErroEstruturaFiscal("Receita de componente do kit mudou após a análise; salvar nova versão antes de ativar.");
    } else k.receitaFotografada = receita;
  }
}
/** Vinculação explícita de alias a mercadoria configurada exige igualdade física documentada. */
export async function fotografarMercadoriaOpcao(tx: Prisma.TransactionClient, c: ComportamentoFiscal) {
  if (!c.produtoId || !c.escolhas?.length || c.comportamento !== "MERCADORIA") throw new ErroEstruturaFiscal("Mercadoria configurada exige identidade e escolhas documentadas.");
  const foto = await fotografarEscolhasProduto(tx, c.produtoId, c.escolhas);
  const origem = await tx.opcaoComplementoVenda.findUniqueOrThrow({ where: { id: c.opcaoId }, include: { produto: { include: { componentes: true } } } });
  const alvo = await tx.produtoVenda.findUniqueOrThrow({ where: { id: c.produtoId }, include: { componentes: true, grupos: true } });
  if (!origem.ativo || origem.produto && origem.produto.unidade !== alvo.unidade || !origem.produto && origem.composicao == null) throw new ErroEstruturaFiscal("Identidade/unidade da opção de origem não corresponde à mercadoria configurada.");
  const origemComposicao = origem.composicao == null ? origem.produto!.componentes : validarComponentes(origem.composicao);
  const fatorOrigem = origem.composicao == null ? origem.quantidade : "1";
  const fisicaOrigem = origemComposicao.map(k => ({ insumoId: k.insumoId, unidade: k.unidade, quantidade: new D(k.quantidade).mul(fatorOrigem).toString() }));
  const fisicaAlvo: Componente[] = alvo.componentes.map(k => ({ insumoId: k.insumoId, unidade: k.unidade, quantidade: k.quantidade.toString() }));
  for (const e of c.escolhas) {
    const o = await tx.opcaoComplementoVenda.findUniqueOrThrow({ where: { id: e.opcaoId }, include: { produto: { include: { componentes: true } } } });
    const vinculo = alvo.grupos.find(v => v.grupoId === e.grupoId)!;
    const efetiva = opcoesEfetivas([{ ...o, preco: o.preco.toString(), composicao: o.composicao == null ? null : validarComponentes(o.composicao) }], { opcoesExcluidas: vinculo.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(vinculo.ajustesOpcoes) })[0];
    const componentes = efetiva.composicao ?? o.produto?.componentes ?? [];
    fisicaAlvo.push(...componentes.map(k => ({ insumoId: k.insumoId, unidade: k.unidade, quantidade: new D(k.quantidade).mul(efetiva.composicao == null ? o.quantidade : "1").mul(e.quantidade).toString() })));
  }
  if (!fisicaOrigem.length || hashPrincipalTecnico(alvo.unidade, fisicaOrigem) !== hashPrincipalTecnico(alvo.unidade, fisicaAlvo)) throw new ErroEstruturaFiscal("Composição da opção de origem diverge da mercadoria configurada; não presumir equivalência pela descrição.");
  return { receitaFotografada: { principalHash: foto.principalHash, opcaoHashes: foto.opcaoHashes, materiais: foto.materiais }, fotografiaOpcaoOrigem: hashTecnico({ fisica: hashOpcaoTecnica(origem.produtoId, fisicaOrigem), materiais: await fotografarMateriais(tx, fisicaOrigem.map(k => k.insumoId)) }) };
}
export async function conferirFotografiaFiscal(tx: Prisma.TransactionClient, c: ClassificacaoFiscal) {
  if (!c.configuracaoNcm) {
    if ((c.analiseNcm || c.fci?.repasseFornecedor) && c.tratamento === "NORMAL" && (!c.fotografiaTecnica || hashTecnico(c.fotografiaTecnica) !== hashTecnico(await fotografarClassificacaoNormal(tx, c)))) throw new ErroEstruturaFiscal("Receita material ou identificação física mudou após a análise; salvar nova classificação fundamentada.");
    return;
  }
  const gravada = c.configuracaoNcm.fotografiaTecnica;
  if (!gravada) throw new ErroEstruturaFiscal("Cenários sem fotografia técnica registrada pelo servidor; salve nova versão fundamentada.");
  const atual = await fotografarReceitaFiscal(tx, c);
  if (hashTecnico(atual) !== hashTecnico(gravada)) throw new ErroEstruturaFiscal("Composição ou quantidade técnica mudou após a análise; revisar os cenários e salvar nova versão antes de ativar.");
}

/** Composição comercial é fotografada por unidade do item; nomes/preços não entram no hash. */
export function receitaDoSnapshot(unidade: string, itens: unknown, escolhas: { opcaoId: string; produtoId: string | null; quantidade?: number | string }[], conhecido: boolean, materiais?: MateriaisFiscaisFotografados, modoPreparo?: string | null, comprovacaoParcial?: ComprovacaoFisicaFiscal): ItemComercialFiscal["receitaFotografada"] {
  const parcial = !conhecido && comprovacaoParcial?.baseSemIngredientes === true && Array.isArray(comprovacaoParcial.opcaoIdsComComposicao) && materiais?.algoritmo === "grazing.material-fiscal.v1";
  if ((!conhecido && !parcial) || !Array.isArray(itens)) return undefined;
  try {
    const componentes = itens as (Componente & { origem: string })[];
    if (componentes.some(c => typeof c.origem !== "string" || c.origem !== "PRODUTO" && !escolhas.some(e => e.opcaoId === c.origem))) return undefined;
    if (parcial && componentes.some(c => c.origem === "PRODUTO")) return undefined;
    const selecionar = (origem: string): MateriaisFiscaisFotografados => ({ algoritmo: "grazing.material-fiscal.v1", insumos: materiais!.insumos.filter(i => componentes.some(c => c.origem === origem && c.insumoId === i.insumoId)).sort((a,b) => a.insumoId.localeCompare(b.insumoId)) });
    return { principalHash: hashPrincipalTecnico(unidade, componentes.filter(c => c.origem === "PRODUTO"), modoPreparo), opcaoHashes: escolhas.map(e => { const quantidade = new D(e.quantidade ?? "1"); if (!quantidade.isFinite() || quantidade.lte(0) || quantidade.decimalPlaces() > 6) throw new Error("Quantidade de escolha não comprovada."); return { opcaoId: e.opcaoId, hash: hashOpcaoTecnica(e.produtoId, componentes.filter(c => c.origem === e.opcaoId).map(c => ({ ...c, quantidade: new D(c.quantidade).div(quantidade).toString() }))) }; }).sort((a, b) => a.opcaoId.localeCompare(b.opcaoId)), ...(parcial ? { comprovacaoParcial: structuredClone(comprovacaoParcial) } : {}), ...(materiais?.algoritmo === "grazing.material-fiscal.v1" && Array.isArray(materiais.insumos) ? { materiais: { principal: selecionar("PRODUTO"), opcoes: escolhas.map(e => ({ opcaoId: e.opcaoId, materiais: selecionar(e.opcaoId) })).sort((a,b) => a.opcaoId.localeCompare(b.opcaoId)) } } : {}) };
  } catch { return undefined; }
}
