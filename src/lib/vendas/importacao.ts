import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroCadastroVenda } from "./dominio";
import { lerPacoteCatalogo, type PacoteCatalogo } from "./importacao-dominio";
import { historico, transacao, type Autor } from "./persistencia";

type Entidade = "CATEGORIA" | "GRUPO" | "PRODUTO";
type Situacao = "NOVO" | "ATUALIZAR" | "MANTER" | "CONFLITO";
export type LinhaImportacao = { entidade: Entidade; chave: string; nome: string; situacao: Situacao; motivo: string; destinoId: string | null; versao: number | null; resumo: string };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const identidade = (entidade: string, chave: string) => JSON.stringify([entidade, chave]);
const nomeNormal = (nome: string) => nome.trim().toLocaleLowerCase("pt-BR");
const chaveOpcao = (grupo: string, opcao: string) => JSON.stringify([grupo, opcao]);

async function preparar(tx: Prisma.TransactionClient, pacote: PacoteCatalogo) {
  const [fontes, categorias, grupos, produtos] = await Promise.all([
    tx.identidadeExternaVenda.findMany({ where: { origem: pacote.origem, loja: pacote.loja } }),
    tx.categoriaVenda.findMany(),
    tx.grupoComplementoVenda.findMany({ include: { _count: { select: { opcoes: true, produtos: true } } } }),
    tx.produtoVenda.findMany({ select: { id: true, nome: true, versao: true, _count: { select: { grupos: true, comoOpcao: true } } } }),
  ]);
  const fontesPorChave = new Map(fontes.map(f => [identidade(f.entidade, f.chave), f]));
  const linhas: LinhaImportacao[] = [];
  function linha(entidade: Entidade, dado: { chave: string; nome: string }, atuais: { id: string; nome: string; versao: number }[], extras = false) {
    const fonte = fontesPorChave.get(identidade(entidade, dado.chave));
    const atual = fonte ? atuais.find(a => a.id === fonte.destinoId) : null;
    const resumo = hash(dado);
    let situacao: Situacao = "NOVO", motivo = "Novo cadastro; produto será criado inativo para conferência.", destinoId = atual?.id ?? null, versao = atual?.versao ?? null;
    if (fonte && !atual) { situacao = "CONFLITO"; motivo = "A identidade externa aponta para cadastro indisponível. Revise o vínculo."; }
    else if (fonte && atual) {
      if (fonte.resumoOrigem === resumo) { situacao = "MANTER"; motivo = "Origem sem alterações. Edições locais serão preservadas."; }
      else if (fonte.versaoDestino !== atual.versao) { situacao = "CONFLITO"; motivo = "Origem e cadastro local mudaram. Nenhuma sobrescrita automática."; }
      else { situacao = "ATUALIZAR"; motivo = "Origem mudou; cadastro não foi editado desde a última importação."; }
    } else if (extras) {
      const canonico = grupos.find(g => g.tipo === "EXTRAS");
      if (canonico && canonico.versao === 1 && canonico._count.opcoes === 0) {
        destinoId = canonico.id; versao = canonico.versao;
        motivo = `Preencher Extras canônico vazio; opcional e ilimitado. ${canonico._count.produtos} produto(s) atualmente vinculado(s).`;
      } else { situacao = "CONFLITO"; motivo = "Extras já possui edição/opções locais. Compare as opções antes de unir as fontes."; }
    } else if (atuais.some(a => nomeNormal(a.nome) === nomeNormal(dado.nome))) {
      situacao = "CONFLITO"; motivo = "Há cadastro com o mesmo nome, sem vínculo com esta identidade. Não será unido por nome ou PDV.";
    }
    if (atuais.some(a => a.id !== destinoId && nomeNormal(a.nome) === nomeNormal(dado.nome))) {
      situacao = "CONFLITO"; motivo = "Outro cadastro já utiliza esse nome. Compare os registros antes de importar.";
    }
    if (entidade === "GRUPO" && fonte) {
      const destino = grupos.find(g => g.id === fonte.destinoId);
      if (destino && (destino.tipo === "EXTRAS") !== extras) { situacao = "CONFLITO"; motivo = "O grupo canônico de Extras não pode ser convertido nem duplicado por importação."; }
    }
    linhas.push({ entidade, chave: dado.chave, nome: dado.nome, situacao, motivo, destinoId, versao, resumo });
  }
  for (const c of pacote.categorias) linha("CATEGORIA", c, categorias);
  for (const g of pacote.grupos) linha("GRUPO", g, grupos, g.tipo === "EXTRAS");
  for (const p of pacote.produtos) linha("PRODUTO", p, produtos);
  for (const l of linhas) if (linhas.some(o => o !== l && o.entidade === l.entidade && nomeNormal(o.nome) === nomeNormal(l.nome))) {
    l.situacao = "CONFLITO"; l.motivo = "Mais de uma identidade no pacote utiliza esse nome. Conferir antes de criar duplicatas.";
  }
  const porChave = new Map(linhas.map(l => [identidade(l.entidade, l.chave), l]));
  for (const l of linhas.filter(l => l.entidade === "PRODUTO" && l.situacao === "ATUALIZAR")) {
    const atual = produtos.find(p => p.id === l.destinoId);
    const recebido = pacote.produtos.find(p => p.chave === l.chave)!;
    if (atual && atual._count.comoOpcao > 0 && recebido.grupos.length > 0) {
      l.situacao = "CONFLITO";
      l.motivo = "Este produto já compõe opções no HUB. Retire esses vínculos antes de acrescentar grupos; escolhas aninhadas não são permitidas.";
    }
  }
  // Um dependente novo/alterado não pode ignorar uma referência conflitante.
  // O grafo permitido tem três níveis: composição fixa -> grupo -> produto configurável.
  for (let rodada = 0; rodada < 3; rodada++) {
    for (const l of linhas.filter(l => l.situacao !== "CONFLITO" && l.situacao !== "MANTER")) {
      const dependencias = l.entidade === "PRODUTO" ? (() => {
        const p = pacote.produtos.find(p => p.chave === l.chave)!;
        return [...p.categorias.map(c => identidade("CATEGORIA", c)), ...p.grupos.map(g => identidade("GRUPO", g.chave))];
      })() : l.entidade === "GRUPO" ? pacote.grupos.find(g => g.chave === l.chave)!.opcoes.flatMap(o => o.produtoChave ? [identidade("PRODUTO", o.produtoChave)] : []) : [];
      if (dependencias.some(d => porChave.get(d)?.situacao === "CONFLITO")) { l.situacao = "CONFLITO"; l.motivo = "Uma categoria, grupo ou produto de composição tem conflito. Resolva a dependência primeiro."; }
      if (l.entidade === "GRUPO" && dependencias.some(d => { const ref = porChave.get(d); return ref?.situacao === "MANTER" && produtos.some(p => p.id === ref.destinoId && p._count.grupos > 0); })) {
        l.situacao = "CONFLITO"; l.motivo = "Um produto de composição foi editado localmente e agora possui grupos. Não é permitido criar escolhas aninhadas.";
      }
    }
  }
  const contagens = { novos: linhas.filter(l => l.situacao === "NOVO").length, atualizar: linhas.filter(l => l.situacao === "ATUALIZAR").length, manter: linhas.filter(l => l.situacao === "MANTER").length, conflitos: linhas.filter(l => l.situacao === "CONFLITO").length };
  const token = hash({ pacote, linhas });
  return { pacote, linhas, contagens, token, fontes };
}

export async function previaImportacao(conteudo: string) {
  const pacote = lerPacoteCatalogo(conteudo);
  const { fontes: _fontes, ...previa } = await preparar(prisma, pacote);
  void _fontes;
  return previa;
}

export async function aplicarImportacao(conteudo: string, token: string, autor: Autor) {
  const pacote = lerPacoteCatalogo(conteudo);
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new ErroCadastroVenda("Confira a prévia antes de importar.");
  return transacao(async tx => {
    const previa = await preparar(tx, pacote);
    if (previa.token !== token) {
      if (!previa.contagens.novos && !previa.contagens.atualizar && !previa.contagens.conflitos) return { ...previa.contagens, aplicados: 0 };
      throw new ErroCadastroVenda("O catálogo mudou depois da prévia. Gere a conferência novamente; nada foi importado.");
    }
    const processar = previa.linhas.filter(l => l.situacao === "NOVO" || l.situacao === "ATUALIZAR");
    const ids = new Map(previa.linhas.filter(l => l.situacao !== "CONFLITO").map(l => [identidade(l.entidade, l.chave), l.destinoId ?? randomUUID()]));
    const id = (entidade: Entidade, chave: string) => { const encontrado = ids.get(identidade(entidade, chave)); if (!encontrado) throw new ErroCadastroVenda("Dependência indisponível no lote."); return encontrado; };
    async function gravarFonte(entidade: string, chave: string, destinoId: string, dado: unknown, versaoDestino: number) {
      const where = { origem_loja_entidade_chave: { origem: pacote.origem, loja: pacote.loja, entidade, chave } };
      const valores = { destinoId, resumoOrigem: hash(dado), dadosOrigem: json(dado), versaoDestino };
      await tx.identidadeExternaVenda.upsert({ where, create: { ...where.origem_loja_entidade_chave, ...valores }, update: valores });
    }
    let proximaOrdem = ((await tx.categoriaVenda.aggregate({ _max: { ordem: true } }))._max.ordem ?? -1) + 1;
    for (const l of processar.filter(l => l.entidade === "CATEGORIA")) {
      const c = pacote.categorias.find(c => c.chave === l.chave)!;
      const antes = l.destinoId ? await tx.categoriaVenda.findUnique({ where: { id: l.destinoId } }) : null;
      const depois = antes ? await tx.categoriaVenda.update({ where: { id: antes.id }, data: { nome: c.nome, versao: { increment: 1 } } }) : await tx.categoriaVenda.create({ data: { id: id("CATEGORIA", c.chave), nome: c.nome, ordem: proximaOrdem++ } });
      await gravarFonte("CATEGORIA", c.chave, depois.id, c, depois.versao);
      await historico(tx, autor, "CATEGORIA", depois.id, antes, depois);
    }
    const anteriores = new Map<string, unknown>();
    for (const l of processar.filter(l => l.entidade === "PRODUTO")) {
      const p = pacote.produtos.find(p => p.chave === l.chave)!;
      const antes = l.destinoId ? await tx.produtoVenda.findUnique({ where: { id: l.destinoId }, include: { categorias: true, grupos: true, componentes: true } }) : null;
      anteriores.set(p.chave, antes);
      const campos = { nome: p.nome, especificacao: p.especificacao, descricao: p.descricao, tipo: p.tipo, unidade: p.unidade, preco: p.preco };
      if (antes) await tx.produtoVenda.update({ where: { id: antes.id }, data: { ...campos, versao: { increment: 1 } } });
      else { const classificacao = !p.categorias.length && pacote.grupos.some(g => g.opcoes.some(o => o.produtoChave === p.chave)) ? "OPCAO" : "PRINCIPAL"; await tx.produtoVenda.create({ data: { ...campos, classificacao, classificacoes: [classificacao], id: id("PRODUTO", p.chave), ativo: false, observacoes: [`Importado de ${pacote.origem}. Conferir antes de ativar.`, ...p.pendencias].join("\n").slice(0, 3000) } }); }
    }
    for (const l of processar.filter(l => l.entidade === "GRUPO")) {
      const g = pacote.grupos.find(g => g.chave === l.chave)!;
      const grupoId = id("GRUPO", g.chave);
      const antes = l.destinoId ? await tx.grupoComplementoVenda.findUnique({ where: { id: grupoId }, include: { opcoes: true } }) : null;
      const campos = { nome: g.nome, tipo: g.tipo, minimo: g.minimo, maximo: g.maximo, repetir: g.repetir };
      const depois = antes ? await tx.grupoComplementoVenda.update({ where: { id: grupoId }, data: { ...campos, versao: { increment: 1 } } }) : await tx.grupoComplementoVenda.create({ data: { ...campos, id: grupoId } });
      const atuais: string[] = [];
      for (const [ordem, o] of g.opcoes.entries()) {
        const chave = chaveOpcao(g.chave, o.chave);
        const fonte = previa.fontes.find(f => f.entidade === "OPCAO" && f.chave === chave);
        if (fonte && !antes?.opcoes.some(a => a.id === fonte.destinoId)) throw new ErroCadastroVenda("Identidade de opção inconsistente. Nada foi importado.");
        const opcaoId = fonte?.destinoId ?? randomUUID(); atuais.push(opcaoId);
        const valores = { nome: o.nome, preco: o.preco, produtoId: o.produtoChave ? id("PRODUTO", o.produtoChave) : null, quantidade: o.quantidade, ativo: o.ativo, ordem };
        await tx.opcaoComplementoVenda.upsert({ where: { id: opcaoId }, create: { id: opcaoId, grupoId, ...valores }, update: valores });
        await gravarFonte("OPCAO", chave, opcaoId, o, depois.versao);
      }
      await tx.opcaoComplementoVenda.updateMany({ where: { grupoId, id: { notIn: atuais } }, data: { ativo: false } });
      if (g.tipo === "EXTRAS") await tx.produtoGrupoVenda.updateMany({ where: { grupoId }, data: { usarPadrao: true, minimo: 0, maximo: null } });
      await gravarFonte("GRUPO", g.chave, grupoId, g, depois.versao);
      await historico(tx, autor, "GRUPO", grupoId, antes, await tx.grupoComplementoVenda.findUnique({ where: { id: grupoId }, include: { opcoes: true } }));
    }
    for (const l of processar.filter(l => l.entidade === "PRODUTO")) {
      const p = pacote.produtos.find(p => p.chave === l.chave)!; const produtoId = id("PRODUTO", p.chave);
      const vinculosAnteriores = await tx.produtoCategoriaVenda.findMany({ where: { produtoId } });
      await tx.produtoCategoriaVenda.deleteMany({ where: { produtoId } });
      await tx.produtoGrupoVenda.deleteMany({ where: { produtoId } });
      for (const categoria of p.categorias) {
        const categoriaId = id("CATEGORIA", categoria);
        const anterior = vinculosAnteriores.find(v => v.categoriaId === categoriaId);
        const ordem = anterior?.ordem ?? (((await tx.produtoCategoriaVenda.aggregate({ where: { categoriaId }, _max: { ordem: true } }))._max.ordem ?? -1) + 1);
        await tx.produtoCategoriaVenda.create({ data: { produtoId, categoriaId, ordem } });
      }
      for (const [ordem, vinculo] of p.grupos.entries()) {
        const g = pacote.grupos.find(g => g.chave === vinculo.chave)!;
        await tx.produtoGrupoVenda.create({ data: { produtoId, grupoId: id("GRUPO", g.chave), ordem, usarPadrao: g.tipo === "EXTRAS", minimo: g.tipo === "EXTRAS" ? 0 : vinculo.usarPadrao ? g.minimo : vinculo.minimo, maximo: g.tipo === "EXTRAS" ? null : vinculo.usarPadrao ? g.maximo : vinculo.maximo } });
      }
      const depois = await tx.produtoVenda.findUniqueOrThrow({ where: { id: produtoId }, include: { categorias: true, grupos: true, componentes: true } });
      await gravarFonte("PRODUTO", p.chave, produtoId, p, depois.versao);
      await historico(tx, autor, "PRODUTO", produtoId, anteriores.get(p.chave), depois);
    }
    if (processar.length) await historico(tx, autor, "IMPORTACAO", randomUUID(), null, { origem: pacote.origem, loja: pacote.loja, referencia: pacote.referencia, resumoPacote: hash(pacote), contagens: previa.contagens, registros: processar.map(l => ({ entidade: l.entidade, chave: l.chave, destinoId: id(l.entidade, l.chave) })) });
    return { ...previa.contagens, aplicados: processar.length };
  }, 90000);
}
