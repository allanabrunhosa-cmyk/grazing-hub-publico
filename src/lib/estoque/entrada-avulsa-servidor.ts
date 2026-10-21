import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type EntradaAvulsaRegistro } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes, type Acao } from "@/lib/permissoes/catalogo";
import { registrarAjusteEntradaAvulsa } from "./registrarMovimentacao";
import { DecimalEstoque } from "./quantidade";
import { registrarAtividade } from "@/lib/atividades/registro";
import { calcularSnapshotEntrada, diferencasEntrada, planejarCorrecaoEntrada, validarItensEntrada, ErroCorrecaoEntrada,
  type EntradaSnapshot, type CorrecaoEntradaInput, type EntradaDetalheDTO, type VersaoEntradaDTO } from "@/lib/inventario/entrada-avulsa-historico";
import type { EntradaAvulsaInput } from "@/app/(protegido)/inventario/entrada-avulsa/actions";

import { numeroEntradaLegada } from "./numero-entrada";
import { cancelarObrigacoesEntradaAvulsa } from "@/lib/financeiro/cancelamento-compra";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const hashEntrada = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function validarChaveEntrada(chave: string) {
  if (typeof chave !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(chave)) throw new ErroCorrecaoEntrada("Reabra o formulário para gerar uma identificação válida da operação.");
}
export async function autorEntrada(tx: Prisma.TransactionClient, sessao: SessaoAtual, acao: Acao) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroCorrecaoEntrada("Sua sessão expirou. Entre novamente.");
  const recurso = acao === "adicionar" ? "inventario.entrada" : "inventario";
  if (u.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, (u.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao)) throw new ErroCorrecaoEntrada("Seu acesso atual não permite esta operação de estoque.");
  return u;
}

export async function prepararRegistroEntrada(tx: Prisma.TransactionClient, input: EntradaAvulsaInput, sessao: SessaoAtual) {
  validarChaveEntrada(input.chave);
  const autor = await autorEntrada(tx, sessao, "adicionar");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
  const hash = hashEntrada({ input, autorId: autor.id });
  const existente = await tx.entradaAvulsaRegistro.findUnique({ where: { chaveOperacao: input.chave }, include: { versoes: { where: { versao: 1 }, take: 1, select: { ajustes: true } } } });
  if (existente && existente.hashOperacao !== hash) throw new ErroCorrecaoEntrada("Esta identificação já foi usada com outros dados. Reabra e confira o lançamento.");
  const primeiroMovimentoId = existente ? (existente.versoes[0]?.ajustes as { movimentoId: string }[] | undefined)?.[0]?.movimentoId : undefined;
  if (existente && !primeiroMovimentoId) throw new ErroCorrecaoEntrada("A referência original desta operação está incompleta. Confira o histórico antes de repetir.");
  return { autor, hash, existente, primeiroMovimentoId };
}

export async function gravarRegistroEntrada(tx: Prisma.TransactionClient, input: EntradaAvulsaInput, autor: { id: string; nome: string }, hash: string, compraId: string | null, movimentos: string[]) {
  const [catalogo, locais, fornecedor] = await Promise.all([
    tx.insumo.findMany({ where: { id: { in: input.itens.map(i => i.insumoId) } }, select: { id: true, nome: true, unidade: true } }),
    tx.localEstoque.findMany({ where: { id: { in: input.itens.map(i => i.localId) } }, select: { id: true, nome: true } }),
    input.fornecedorId ? tx.fornecedor.findUnique({ where: { id: input.fornecedorId }, select: { nome: true } }) : null,
  ]);
  const snapshot = calcularSnapshotEntrada({ tipo: input.tipo, data: input.data, fornecedorId: input.fornecedorId, fornecedorNome: fornecedor?.nome ?? null,
    frete: input.frete, desconto: input.desconto, custosAdicionais: input.custosAdicionais, observacao: input.observacao,
    dadosOriginais: { dataVencimento: input.dataVencimento, pago: input.pago, dataPagamento: input.dataPagamento,
      formaPagamento: input.formaPagamento ?? "BOLETO", cartaoCreditoId: input.cartaoCreditoId ?? null, contaBancariaId: input.contaBancariaId,
      dataCompra: input.dataCompra ?? null, parcelaCartao: String(input.parcelaCartao ?? 1) } }, input.itens, catalogo, locais);
  const registro = await tx.entradaAvulsaRegistro.create({ data: { ...(compraId ? { numero: await numeroEntradaLegada(tx, `compra:${compraId}`) } : {}), compraId, tipo: input.tipo,
    dataEntrada: new Date(`${input.data}T12:00:00-03:00`), criadoPorId: autor.id, criadoPorNome: autor.nome,
    snapshot: json(snapshot), chaveOperacao: input.chave, hashOperacao: hash } });
  await tx.movimentacaoEstoque.updateMany({ where: { id: { in: movimentos } }, data: { entradaAvulsaRegistroId: registro.id } });
  await tx.entradaAvulsaVersao.create({ data: { registroId: registro.id, versao: 1, autorId: autor.id, autorNome: autor.nome,
    depois: json(snapshot), diferencas: [], ajustes: json(movimentos.map(movimentoId => ({ movimentoId }))), chaveOperacao: input.chave, hashOperacao: hash } });
  return registro;
}

// Origens históricas explícitas são excluídas; nunca apresentar retornos/estornos como entrada manual.
export const whereEntradaSimplesLegada: Prisma.MovimentacaoEstoqueWhereInput = {
  tipo: "AJUSTE_ENTRADA", entradaAvulsaCompraId: null, entradaAvulsaRegistroId: null, producaoPreparacaoId: null,
  origemPerdaId: null, origemRecebimentoItemId: null, estornoDeId: null, estornoCompra: null,
  ajusteContagem: null, estornoContagem: null, exclusaoPerda: null, notaFiscalItem: null,
  criadoPorId: { not: null },
  NOT: [{ observacao: { startsWith: "Retorno físico Pedido " } }, { observacao: { startsWith: "Estorno de contagem " } }, { observacao: { startsWith: "Contagem " } }],
};
const movimentoInclude = { insumo: { select: { nome: true, unidade: true } }, local: { select: { nome: true } }, estornoCompra: true } as const;

async function detalheLegado(tx: Prisma.TransactionClient, id: string): Promise<EntradaDetalheDTO | null> {
  if (id.startsWith("compra:")) {
    const compra = await tx.entradaAvulsaCompra.findUnique({ where: { id: id.slice(7) }, include: { fornecedor: true, criadoPor: true, registro: true, movimentacoes: { include: movimentoInclude, orderBy: { id: "asc" } } } });
    if (!compra) return null;
    if (compra.registro) return detalheRegistro(tx, compra.registro);
    const bloqueio = compra.movimentacoes.some(m => m.estornoCompra || m.estornoDeId) ? "Esta compra possui estorno externo. Os movimentos foram preservados; a entrada pode ser consultada, mas não corrigida." : undefined;
    // O legado não guardava quantidades comerciais/fatores. Não inventar esses valores.
    const itens = compra.movimentacoes.map(m => ({ insumoId: m.insumoId, localId: m.localId, nome: m.insumo.nome, localNome: m.local.nome,
      unidade: m.insumo.unidade, unidadeEntrada: m.insumo.unidade, quantidade: Number(m.quantidade), fatorConversao: 1,
      quantidadeEstoque: m.quantidade.toString(), valorProdutos: Number(m.valorTotal ?? 0), valorFinal: Number(m.valorTotal ?? 0), custoUnitario: Number(m.custoUnitario ?? 0) }));
    return { id, identificador: String(await numeroEntradaLegada(tx, id)), versao: 0, criadoEm: compra.createdAt.toISOString(), responsavel: compra.criadoPor?.nome ?? "Não registrado", bloqueio,
      snapshot: { tipo: "COMPRA_SIMPLES", data: compra.dataEntrada.toISOString().slice(0, 10), fornecedorId: compra.fornecedorId, fornecedorNome: compra.fornecedor.nome,
        frete: 0, desconto: 0, custosAdicionais: [], observacao: compra.observacao, valorTotal: Number(compra.valorTotal), itens, reconstruida: true,
        dadosOriginais: { frete: compra.frete.toString(), desconto: compra.desconto.toString(), outrosCustos: JSON.stringify(compra.outrosCustos),
          dataVencimento: compra.dataVencimento?.toISOString().slice(0, 10) ?? null, pago: compra.pago, dataPagamento: compra.dataPagamento?.toISOString().slice(0, 10) ?? null } }, versoes: [] };
  }
  if (id.startsWith("movimento:")) {
    const m = await tx.movimentacaoEstoque.findFirst({ where: { id: id.slice(10) }, include: { ...movimentoInclude, criadoPor: true, registroAvulsoLegado: true } });
    if (!m) return null;
    if (m.registroAvulsoLegado) return detalheRegistro(tx, m.registroAvulsoLegado);
    if (!await tx.movimentacaoEstoque.findFirst({ where: { AND: [whereEntradaSimplesLegada, { id: m.id }] }, select: { id: true } })) return null;
    return { id, identificador: String(await numeroEntradaLegada(tx, id)), versao: 0, criadoEm: m.createdAt.toISOString(), responsavel: m.criadoPor?.nome ?? "Não registrado", versoes: [],
      snapshot: { tipo: "OUTRO_MOTIVO", data: m.createdAt.toISOString().slice(0, 10), fornecedorId: null, fornecedorNome: null, frete: 0, desconto: 0, custosAdicionais: [], observacao: m.observacao,
        valorTotal: Number(m.valorTotal ?? 0), reconstruida: true, itens: [{ insumoId: m.insumoId, localId: m.localId, nome: m.insumo.nome, localNome: m.local.nome, unidade: m.insumo.unidade,
          unidadeEntrada: m.insumo.unidade, quantidade: Number(m.quantidade), quantidadeEstoque: m.quantidade.toString(), fatorConversao: 1,
          valorProdutos: Number(m.valorTotal ?? 0), valorFinal: Number(m.valorTotal ?? 0), custoUnitario: Number(m.custoUnitario ?? 0) }] } };
  }
  return null;
}
async function detalheRegistro(tx: Prisma.TransactionClient, registro: EntradaAvulsaRegistro): Promise<EntradaDetalheDTO> {
  const versoes = await tx.entradaAvulsaVersao.findMany({ where: { registroId: registro.id }, orderBy: { versao: "desc" } });
  const estornada = await tx.movimentacaoEstoque.count({ where: { entradaAvulsaRegistroId: registro.id, estornoCompra: { isNot: null } } });
  return { id: registro.id, identificador: String(registro.numero), versao: registro.versao,
    criadoEm: registro.createdAt.toISOString(), responsavel: registro.criadoPorNome, snapshot: (registro.snapshot as EntradaSnapshot).cancelada ? { ...(versoes[0]?.antes as EntradaSnapshot ?? registro.snapshot as EntradaSnapshot), cancelada: true } : registro.snapshot as EntradaSnapshot,
    ...((registro.snapshot as EntradaSnapshot).cancelada ? { bloqueio: "Esta entrada foi excluída por estorno. O histórico permanece disponível para consulta." } : estornada ? { bloqueio: "Esta compra foi estornada no Financeiro. O histórico permanece disponível para consulta; não é possível corrigir uma entrada estornada." } : {}),
    versoes: versoes.map(v => ({ versao: v.versao, autorNome: v.autorNome, data: v.createdAt.toISOString(), diferencas: v.diferencas as VersaoEntradaDTO["diferencas"], ajustes: v.ajustes as VersaoEntradaDTO["ajustes"] })) };
}
export async function consultarEntrada(tx: Prisma.TransactionClient, id: string) {
  if (typeof id !== "string" || !/^(?:(?:compra|movimento):)?[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new ErroCorrecaoEntrada("Identificador de entrada inválido.");
  const registro = await tx.entradaAvulsaRegistro.findUnique({ where: { id } });
  return registro ? detalheRegistro(tx, registro) : detalheLegado(tx, id);
}

export async function corrigirEntradaAvulsa(input: CorrecaoEntradaInput, sessao: SessaoAtual) {
  return alterarEntradaAvulsa(input, sessao);
}
export async function excluirEntradaAvulsa(input: { id: string; versao: number; chave: string; motivo: string }, sessao: SessaoAtual) {
  if (typeof input?.motivo !== "string" || input.motivo.trim().length < 15 || input.motivo.trim().length > 255) throw new ErroCorrecaoEntrada("Informe um motivo de 15 a 255 caracteres.");
  return alterarEntradaAvulsa({ ...input, itens: [], observacao: input.motivo.trim(), frete: 0, desconto: 0, custosAdicionais: [] }, sessao, true);
}
async function alterarEntradaAvulsa(input: CorrecaoEntradaInput, sessao: SessaoAtual, excluir = false) {
  if (!input || !Number.isInteger(input.versao) || input.versao < 0) throw new ErroCorrecaoEntrada("Versão inválida. Reabra o lançamento.");
  validarChaveEntrada(input.chave);
  if (!excluir) validarItensEntrada(input.itens);
  const hash = hashEntrada(excluir ? { input, autorId: sessao.userId, acao: "EXCLUIR" } : { input, autorId: sessao.userId });
  return prisma.$transaction(async tx => {
    const autor = await autorEntrada(tx, sessao, excluir ? "excluir" : "editar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
    const repetida = await tx.entradaAvulsaVersao.findUnique({ where: { chaveOperacao: input.chave } });
    if (repetida) {
      if (repetida.hashOperacao !== hash || repetida.autorId !== autor.id) throw new ErroCorrecaoEntrada("Identificação da correção já usada com outros dados.");
      return repetida.registroId;
    }
    const detalhe = await consultarEntrada(tx, input.id);
    if (!detalhe) throw new ErroCorrecaoEntrada("Entrada não encontrada.");
    if (detalhe.bloqueio) throw new ErroCorrecaoEntrada(detalhe.bloqueio);
    if (detalhe.versao !== input.versao) throw new ErroCorrecaoEntrada("Este lançamento foi alterado por outra pessoa. Reabra o detalhe e confira a versão atual.");
    const antes = detalhe.snapshot;
    const ids = [...new Set([...antes.itens, ...input.itens].map(i => i.insumoId))].sort();
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Insumo" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
    const [catalogo, locais] = await Promise.all([
      tx.insumo.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, unidade: true, ativo: true, custoMedio: true } }),
      tx.localEstoque.findMany({ where: { id: { in: [...antes.itens, ...input.itens].map(i => i.localId) } }, select: { id: true, nome: true, ativo: true } }),
    ]);
    if (antes.itens.some(i => catalogo.find(c => c.id === i.insumoId)?.unidade !== i.unidade)) throw new ErroCorrecaoEntrada("A unidade de um produto mudou desde a entrada. Concilie a conversão antes de corrigir.");
    if (input.itens.some(i => (!catalogo.find(c => c.id === i.insumoId)?.ativo || !locais.find(l => l.id === i.localId)?.ativo) && !antes.itens.some(a => a.insumoId === i.insumoId && a.localId === i.localId))) throw new ErroCorrecaoEntrada("Selecione produtos e locais ativos para novos itens.");
    const depois: EntradaSnapshot = excluir ? { ...antes, cancelada: true, itens: [], valorTotal: 0, frete: 0, desconto: 0, custosAdicionais: [], observacao: input.observacao } : calcularSnapshotEntrada({ ...antes, observacao: input.observacao, frete: input.frete, desconto: input.desconto, custosAdicionais: input.custosAdicionais }, input.itens, catalogo, locais);
    if (!excluir && antes.tipo === "COMPRA_SIMPLES" && !new DecimalEstoque(antes.valorTotal).equals(depois.valorTotal)) throw new ErroCorrecaoEntrada("O total deve permanecer igual à obrigação financeira original. Redistribua os valores entre os itens; alterações do total exigem correção no Financeiro.");
    if (excluir && antes.tipo === "COMPRA_SIMPLES") {
      const registro = detalhe.versao > 0 ? await tx.entradaAvulsaRegistro.findUniqueOrThrow({ where: { id: detalhe.id } }) : null;
      const compraId = registro?.compraId ?? (input.id.startsWith("compra:") ? input.id.slice(7) : null);
      if (!compraId) throw new ErroCorrecaoEntrada("A referência financeira está incompleta. Nenhum estorno foi aplicado.");
      try { await cancelarObrigacoesEntradaAvulsa(tx, compraId, sessao, input.observacao!); }
      catch (erro) { throw new ErroCorrecaoEntrada(erro instanceof Error ? erro.message : "Não foi possível cancelar a obrigação financeira."); }
    }
    const diferencas = [...diferencasEntrada(antes, depois), ...(excluir ? [{ campo: "Status", anterior: "Registrada", novo: "Excluída por estorno" }] : [])];
    if (!diferencas.length) return detalhe.id;
    const deltas = planejarCorrecaoEntrada(antes, depois);
    // Na entrada simples, valor estimado ausente/zero não apurava custo no gravador.
    // Preserve essa semântica: corrigir quantidade sem valor não inventa uma compra gratuita.
    if (antes.tipo === "OUTRO_MOTIVO") for (const delta of deltas) {
      const custo = catalogo.find(c => c.id === delta.insumoId)!.custoMedio;
      const a = antes.itens.find(i => i.insumoId === delta.insumoId && i.localId === delta.localId);
      const b = depois.itens.find(i => i.insumoId === delta.insumoId && i.localId === delta.localId);
      const valor = (i: typeof a) => !i ? new DecimalEstoque(0) : i.valorFinal > 0 ? new DecimalEstoque(i.valorFinal) : new DecimalEstoque(i.quantidadeEstoque).times(custo);
      delta.valor = valor(b).minus(valor(a));
    }
    // Ledger deve continuar representando exatamente a versão vigente, inclusive no legado.
    const whereMovimentos: Prisma.MovimentacaoEstoqueWhereInput = detalhe.versao > 0 ? { entradaAvulsaRegistroId: detalhe.id }
      : input.id.startsWith("compra:") ? { entradaAvulsaCompraId: input.id.slice(7) } : { id: input.id.slice(10) };
    const ledger = await tx.movimentacaoEstoque.findMany({ where: whereMovimentos, include: { estornoCompra: true } });
    if (ledger.some(m => m.estornoCompra || m.estornoDeId)) throw new ErroCorrecaoEntrada("A entrada possui estorno externo. Consulte a origem antes da correção.");
    const pares = new Set([...antes.itens, ...ledger].map(i => `${i.insumoId}:${i.localId}`));
    for (const par of pares) {
      const soma = ledger.filter(m => `${m.insumoId}:${m.localId}` === par).reduce((s, m) => s.plus(new DecimalEstoque(m.quantidade).times(["ENTRADA_COMPRA", "AJUSTE_ENTRADA"].includes(m.tipo) ? 1 : -1)), new DecimalEstoque(0));
      const esperado = antes.itens.find(i => `${i.insumoId}:${i.localId}` === par)?.quantidadeEstoque ?? "0";
      if (!soma.equals(esperado)) throw new ErroCorrecaoEntrada("O histórico físico diverge da entrada. A correção foi bloqueada para preservar os saldos.");
    }
    const custos = [];
    for (const delta of deltas) {
      if (delta.quantidade.lt(0)) {
        const saldo = await tx.saldoEstoque.findUnique({ where: { insumoId_localId: { insumoId: delta.insumoId, localId: delta.localId } } });
        const reserva = await tx.reservaPedido.aggregate({ where: { insumoId: delta.insumoId, localId: delta.localId }, _sum: { reservada: true } });
        if (new DecimalEstoque(saldo?.quantidadeAtual ?? 0).minus(reserva._sum.reservada ?? 0).plus(delta.quantidade).lt(0)) throw new ErroCorrecaoEntrada(`Saldo disponível insuficiente para corrigir ${delta.nome}. A redução é maior que o estoque livre após consumos e reservas.`);
      }
    }
    for (const insumoId of [...new Set(deltas.map(d => d.insumoId))]) {
      const saldo = await tx.saldoEstoque.aggregate({ where: { insumoId }, _sum: { quantidadeAtual: true } });
      const produto = catalogo.find(c => c.id === insumoId)!;
      const quantidade = new DecimalEstoque(saldo._sum.quantidadeAtual ?? 0);
      const quantidadeNova = deltas.filter(d => d.insumoId === insumoId).reduce((s, d) => s.plus(d.quantidade), quantidade);
      const valorNovo = deltas.filter(d => d.insumoId === insumoId).reduce((s, d) => s.plus(d.valor), quantidade.times(produto.custoMedio));
      const semValorApurado = antes.tipo === "OUTRO_MOTIVO" && [...antes.itens, ...depois.itens].filter(i => i.insumoId === insumoId).every(i => i.valorFinal === 0);
      if (semValorApurado) {
        custos.push({ insumoId, anterior: produto.custoMedio.toString(), novo: produto.custoMedio.toString(), quantidadeAntes: quantidade.toString(), quantidadeDepois: quantidadeNova.toString(), valorResidual: "NAO_APURADO" });
        continue;
      }
      // O custo médio tem quatro casas; ao zerar o saldo, seu arredondamento pode
      // deixar uma diferença inferior ao quantum monetário, sem valor físico residual.
      const residuoDeArredondamento = quantidadeNova.isZero() && valorNovo.abs().lte("0.01");
      if (quantidadeNova.lt(0) || (!residuoDeArredondamento && valorNovo.lt(0)) || (quantidadeNova.isZero() && !residuoDeArredondamento)) throw new ErroCorrecaoEntrada(`O custo residual de ${produto.nome} não comporta esta correção com segurança. Confira o estoque e os custos antes de corrigir.`);
      const custoNovo = quantidadeNova.gt(0) ? valorNovo.div(quantidadeNova).toDecimalPlaces(4) : new DecimalEstoque(produto.custoMedio);
      if (!custoNovo.isFinite() || custoNovo.gte("100000000")) throw new ErroCorrecaoEntrada(`O custo médio resultante de ${produto.nome} ultrapassa o limite do cadastro. Confira os valores, a quantidade e a conversão.`);
      custos.push({ insumoId, anterior: produto.custoMedio.toString(), novo: custoNovo.toString(), quantidadeAntes: quantidade.toString(), quantidadeDepois: quantidadeNova.toString(), valorResidual: valorNovo.toString() });
    }
    let registroId = detalhe.id;
    if (detalhe.versao === 0) {
      const registro = await tx.entradaAvulsaRegistro.create({ data: { numero: await numeroEntradaLegada(tx, input.id), tipo: antes.tipo, compraId: input.id.startsWith("compra:") ? input.id.slice(7) : null,
        movimentoLegadoId: input.id.startsWith("movimento:") ? input.id.slice(10) : null, dataEntrada: new Date(`${antes.data}T12:00:00-03:00`),
        criadoPorId: ledger[0].criadoPorId ?? autor.id, criadoPorNome: detalhe.responsavel, snapshot: json(antes), versao: 1,
        createdAt: new Date(detalhe.criadoEm), chaveOperacao: `legado-${hashEntrada(input.id)}`, hashOperacao: hashEntrada(antes) } });
      registroId = registro.id;
      await tx.movimentacaoEstoque.updateMany({ where: whereMovimentos, data: { entradaAvulsaRegistroId: registroId } });
      await tx.entradaAvulsaVersao.create({ data: { registroId, versao: 1, autorId: registro.criadoPorId, autorNome: registro.criadoPorNome, depois: json(antes), diferencas: [], ajustes: [],
        chaveOperacao: registro.chaveOperacao, hashOperacao: registro.hashOperacao, createdAt: registro.createdAt } });
    }
    const ajustes = [];
    for (const delta of deltas) {
      if (delta.quantidade.isZero()) continue;
      const tipo = delta.quantidade.gt(0) ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA";
      const r = await registrarAjusteEntradaAvulsa({ tx, insumoId: delta.insumoId, localId: delta.localId, tipo,
        quantidade: delta.quantidade.abs().toFixed(), entradaAvulsaRegistroId: registroId, criadoPorId: autor.id,
        observacao: `${excluir ? "Estorno" : "Correção"} da entrada ${detalhe.identificador} · versão ${Math.max(1, detalhe.versao) + 1}` });
      ajustes.push({ movimentoId: r.movimentacaoId, quantidade: delta.quantidade.toString(), tipo, saldoAnterior: r.saldoAnterior, saldoPosterior: r.saldoNovo });
    }
    for (const custo of custos) await tx.insumo.update({ where: { id: custo.insumoId }, data: { custoMedio: custo.novo } });
    const novaVersao = Math.max(1, detalhe.versao) + 1;
    const atualizada = await tx.entradaAvulsaRegistro.updateMany({ where: { id: registroId, versao: Math.max(1, detalhe.versao) }, data: { snapshot: json(depois), versao: novaVersao } });
    if (atualizada.count !== 1) throw new ErroCorrecaoEntrada("Conflito de versão. Reabra a entrada.");
    await tx.entradaAvulsaVersao.create({ data: { registroId, versao: novaVersao, autorId: autor.id, autorNome: autor.nome, antes: json(antes), depois: json(depois),
      diferencas: json([...diferencas, ...custos.filter(c => c.anterior !== c.novo).map(c => ({ campo: `Custo residual · ${catalogo.find(p => p.id === c.insumoId)!.nome}`, anterior: c.anterior, novo: c.novo }))]),
      ajustes: json(ajustes), chaveOperacao: input.chave, hashOperacao: hash } });
    await registrarAtividade(tx, { userId: autor.id, nome: autor.nome }, { modulo: "estoque", recurso: "inventario", acao: excluir ? "EXCLUIR_ENTRADA" : "CORRIGIR_ENTRADA", entidade: "EntradaAvulsaRegistro", entidadeId: registroId, correlacaoId: registroId, resumo: excluir ? "Entrada avulsa excluída por estorno da versão atual, com histórico preservado." : "Entrada avulsa corrigida com ajustes compensatórios e versão preservada." });
    return registroId;
  }, { timeout: 30000, maxWait: 10000 });
}
