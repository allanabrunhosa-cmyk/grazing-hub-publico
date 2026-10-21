import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Acao, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { baixarLancamento } from "../baixarLancamento";
import { dataLancamentoValida } from "../data-lancamento";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { ehSaldoDoDia, ErroExtrato, lerArquivoExtrato, LIMITE_ARQUIVO, type MapaCsv } from "./arquivo";
import type { EntradaConciliacao, PreviaExtrato } from "./types";
import { paraCaixaAlta, paraCaixaAltaOpcional } from "@/lib/caixa-alta";
import { compararImportacao, identificarLinhas } from "./identidade";
import { parecePagamentoCartao } from "../faturas/dominio";

const hash = (texto: string | Buffer) => createHash("sha256").update(texto).digest("hex");
const dataBanco = (dia: string) => new Date(`${dia}T12:00:00-03:00`);
const dia = (data: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
const centavos = (valor: Prisma.Decimal) => Number(valor.mul(100));
const opcoesTransacao = { timeout: 30_000, maxWait: 10_000 };

async function ator(tx: Prisma.TransactionClient, sessao: SessaoAtual, acao: Acao) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroExtrato("Sua sessão foi encerrada. Entre novamente.");
  const pode = (recurso: string, operacao: Acao) => usuario.perfilAcesso?.sistema === "ADMINISTRADOR" || permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, usuario.permissoesPersonalizadas as Excecoes, recurso, operacao);
  if (!pode("financeiro.movimentacoes", "visualizar") || !pode("financeiro.conciliacao", acao)) throw new ErroExtrato("Seu acesso não permite esta operação de conciliação.");
  return { usuario, pode };
}
async function arquivoFormulario(formulario: FormData) {
  const file = formulario.get("arquivo");
  if (!(file instanceof File) || file.size <= 0 || file.size > LIMITE_ARQUIVO || file.name.length > 255) throw new ErroExtrato("Selecione um OFX ou CSV de até 2 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  let texto: string;
  try { texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { texto = new TextDecoder("windows-1252").decode(bytes); }
  let mapa: MapaCsv | undefined;
  try { mapa = formulario.get("mapa") ? JSON.parse(String(formulario.get("mapa"))) : undefined; } catch { throw new ErroExtrato("Mapeamento CSV inválido."); }
  const arquivo = lerArquivoExtrato(texto, file.name, mapa);
  const hashArquivo = hash(bytes);
  const linhas = identificarLinhas(arquivo, hashArquivo);
  return { ...arquivo, linhas, hashArquivo, nomeArquivo: file.name, contaId: String(formulario.get("contaId") ?? "") };
}
async function previa(tx: Prisma.TransactionClient, arquivo: Awaited<ReturnType<typeof arquivoFormulario>>) {
  const conta = await tx.contaBancaria.findUnique({ where: { id: arquivo.contaId } });
  if (!conta?.ativo) throw new ErroExtrato("Selecione uma conta bancária ativa.");
  if (arquivo.referenciaOfx && conta.referenciaOfx && arquivo.referenciaOfx !== conta.referenciaOfx) throw new ErroExtrato("O OFX pertence a outra conta. Selecione a conta correta; nenhum dado foi importado.");
  if (arquivo.referenciaOfx && await tx.contaBancaria.findFirst({ where: { referenciaOfx: arquivo.referenciaOfx, id: { not: conta.id } } })) throw new ErroExtrato("Este OFX já está associado a outra conta do HUB.");
  const datasItau = [...new Set(arquivo.linhas.filter(l => l.sequencialItau).map(l => l.data))];
  const existentes = await tx.transacaoExtrato.findMany({
    where: { contaBancariaId: conta.id, OR: [
      { chave: { in: arquivo.linhas.map(l => l.chave) } },
      { impressao: { in: arquivo.linhas.map(l => l.impressao) } },
      ...(datasItau.length ? [{ data: { in: datasItau.map(data => new Date(`${data}T00:00:00Z`)) } }] : []),
    ] },
    include: { importacao: { select: { formato: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const linhas = compararImportacao(arquivo.linhas, existentes.map(l => ({
    ...l, data: l.data.toISOString().slice(0, 10), centavos: centavos(l.valor),
    conciliada: !!l.conciliadaEm, formato: l.importacao.formato,
  })));
  return { conta, linhas };
}
export async function prepararExtrato(formulario: FormData): Promise<PreviaExtrato> {
  const arquivo = await arquivoFormulario(formulario);
  const resultado = await prisma.$transaction(tx => previa(tx, arquivo));
  return { nomeArquivo: arquivo.nomeArquivo, referenciaOfx: arquivo.referenciaOfx, contaNome: resultado.conta.nome, linhasSaldoIgnoradas: arquivo.linhasSaldoIgnoradas, linhas: resultado.linhas.map(({ indice, data, descricao, centavos, identificador, situacao, conciliada, observacao }) => ({ indice, data, descricao, centavos, identificador, situacao, conciliada, observacao })) };
}
export async function importarExtrato(formulario: FormData, sessao: SessaoAtual) {
  const arquivo = await arquivoFormulario(formulario);
  if (formulario.get("confirmarConta") !== "sim") throw new ErroExtrato("Confirme a conta de destino do extrato.");
  let indices: unknown;
  try { indices = JSON.parse(String(formulario.get("indices"))); } catch { throw new ErroExtrato("Selecione as transações para importar."); }
  const indicesValidos = new Set(arquivo.linhas.map(l => l.indice));
  if (!Array.isArray(indices) || !indices.length || indices.length > 2000 || indices.some(i => !Number.isInteger(i) || !indicesValidos.has(i as number)) || new Set(indices).size !== indices.length) throw new ErroExtrato("Seleção de transações inválida.");
  const escolhidos = new Set(indices as number[]);
  return prisma.$transaction(async tx => {
    const { usuario } = await ator(tx, sessao, "adicionar");
    await tx.$queryRaw`SELECT id FROM "ContaBancaria" WHERE id = ${arquivo.contaId} FOR UPDATE`;
    const resultado = await previa(tx, arquivo);
    const selecionadas = resultado.linhas.filter(l => escolhidos.has(l.indice) && l.situacao !== "EXISTENTE");
    if (selecionadas.some(l => l.situacao === "POSSIVEL_DUPLICADA") && formulario.get("confirmarDuplicadas") !== "sim") throw new ErroExtrato("Há possíveis duplicadas. Confira a prévia antes de importá-las explicitamente.");
    if (!selecionadas.length) { const datas = arquivo.linhas.map(l => l.data).sort(); return { importadas: 0, linhasSaldoIgnoradas: arquivo.linhasSaldoIgnoradas, de: datas[0], ate: datas.at(-1)! }; }
    if (arquivo.referenciaOfx && !resultado.conta.referenciaOfx) await tx.contaBancaria.update({ where: { id: arquivo.contaId }, data: { referenciaOfx: arquivo.referenciaOfx } });
    const lote = await tx.importacaoExtrato.upsert({ where: { contaBancariaId_hashArquivo: { contaBancariaId: arquivo.contaId, hashArquivo: arquivo.hashArquivo } }, update: {}, create: {
      contaBancariaId: arquivo.contaId, nomeArquivo: arquivo.nomeArquivo, hashArquivo: arquivo.hashArquivo, formato: arquivo.formato,
      referenciaOfx: arquivo.referenciaOfx, autorId: usuario.id, autorNome: usuario.nome,
    } });
    const dados = selecionadas.map(l => ({ id: randomUUID(), importacaoId: lote.id, contaBancariaId: arquivo.contaId, chave: l.chave, impressao: l.impressao,
      identificador: l.identificador, data: new Date(`${l.data}T00:00:00Z`), descricao: l.descricao, valor: new Prisma.Decimal(l.centavos).div(100) }));
    await tx.transacaoExtrato.createMany({ data: dados });
    await tx.historicoConciliacao.createMany({ data: dados.map(l => ({ transacaoId: l.id, acao: "IMPORTACAO", autorId: usuario.id, autorNome: usuario.nome, detalhes: { arquivo: arquivo.nomeArquivo } })) });
    const datas = selecionadas.map(l => l.data).sort();
    return { importadas: dados.length, linhasSaldoIgnoradas: arquivo.linhasSaldoIgnoradas, de: datas[0], ate: datas.at(-1)! };
  }, opcoesTransacao);
}
export async function conciliarExtrato(input: EntradaConciliacao, sessao: SessaoAtual) {
  if (!input || typeof input.transacaoId !== "string" || Boolean(input.novo) === Boolean(input.lancamentos?.length)) throw new ErroExtrato("Escolha lançamentos existentes ou crie um novo.");
  if (input.lancamentos && (input.lancamentos.length > 100 || input.lancamentos.some(l => typeof l?.id !== "string" || typeof l.versao !== "string") || new Set(input.lancamentos.map(l => l.id)).size !== input.lancamentos.length)) throw new ErroExtrato("Seleção de lançamentos inválida.");
  return prisma.$transaction(async tx => {
    const { usuario, pode } = await ator(tx, sessao, "editar");
    await tx.$queryRaw`SELECT id FROM "TransacaoExtrato" WHERE id = ${input.transacaoId} FOR UPDATE`;
    const extrato = await tx.transacaoExtrato.findUnique({ where: { id: input.transacaoId }, include: { contaBancaria: true, vinculos: true } });
    if (!extrato || extrato.conciliadaEm || extrato.vinculos.length) throw new ErroExtrato("Transação ausente ou já conciliada. Atualize a tela.");
    if (parecePagamentoCartao(extrato.descricao)) throw new ErroExtrato("Este pagamento parece ser de fatura de cartão. Use Cartões e Faturas para vincular a liquidação, sem criar outra despesa.");
    if (ehSaldoDoDia(extrato.descricao)) throw new ErroExtrato("Saldo do dia é uma informação do extrato e não pode ser conciliado como movimentação.");
    if (!extrato.contaBancaria.ativo) throw new ErroExtrato("A conta bancária está inativa.");
    const tipo = extrato.valor.isPositive() ? "RECEITA" : "DESPESA";
    if (!dataLancamentoValida(extrato.data.toISOString().slice(0, 10))) throw new ErroExtrato("Data da transação inválida. O ano deve ser de 2000 a 2200.");
    const data = dataBanco(extrato.data.toISOString().slice(0, 10));
    let ids = input.lancamentos?.map(l => l.id) ?? [];
    if (input.novo) {
      if (!pode("financeiro.movimentacoes", "adicionar") || !pode("financeiro.baixas", "editar")) throw new ErroExtrato("Você precisa de acesso para adicionar lançamentos e realizar baixas.");
      const novo = input.novo;
      if (typeof novo.descricao !== "string" || !novo.descricao.trim() || novo.descricao.length > 500 || !dataLancamentoValida(novo.dataCompetencia) || !dataLancamentoValida(novo.dataVencimento)) throw new ErroExtrato("Preencha descrição, competência e vencimento válidos.");
      const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: novo.categoriaId } });
      if (!categoria?.ativo || GRUPOS_RECEITA.includes(categoria.grupo) !== (tipo === "RECEITA")) throw new ErroExtrato("Escolha uma categoria ativa compatível com a receita ou despesa.");
      if (novo.fornecedorId && !await tx.fornecedor.findFirst({ where: { id: novo.fornecedorId, ativo: true } })) throw new ErroExtrato("Fornecedor inválido ou inativo.");
      if (novo.formaPagamentoId && !await tx.formaPagamento.findUnique({ where: { id: novo.formaPagamentoId } })) throw new ErroExtrato("Forma de pagamento inválida.");
      if ((novo.contraparteNome?.length ?? 0) > 250 || (novo.observacoes?.length ?? 0) > 2000) throw new ErroExtrato("Contraparte ou observação excede o tamanho permitido.");
      const lancamento = await tx.lancamentoFinanceiro.create({ data: { tipo, valor: extrato.valor.abs(), descricao: paraCaixaAlta(novo.descricao), categoriaId: categoria.id,
        dataCompetencia: dataBanco(novo.dataCompetencia), dataVencimento: dataBanco(novo.dataVencimento), fornecedorId: novo.fornecedorId || null,
        contraparteNome: paraCaixaAltaOpcional(novo.contraparteNome), formaPagamentoId: novo.formaPagamentoId || null, observacoes: novo.observacoes?.trim() || null, criadoPorId: usuario.id } });
      ids = [lancamento.id];
    }
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`);
    const lancamentos = await tx.lancamentoFinanceiro.findMany({ where: { id: { in: ids } }, include: {
      vinculoExtrato: true,
      movimentacaoBancaria: true,
      notaFiscalItemLancamento: { select: { notaFiscalDuplicata: { select: { id: true, valor: true } } } },
    } });
    if (lancamentos.length !== ids.length || lancamentos.some(l => l.status === "CANCELADO" || l.vinculoExtrato)) throw new ErroExtrato("Há lançamentos indisponíveis ou já conciliados.");
    if (lancamentos.some(l => l.itemFaturaId)) throw new ErroExtrato("Há despesas vinculadas a faturas. Concilie o pagamento em Cartões e Faturas.");
    if (lancamentos.some(l => l.pedidoVendaId && l.status === "PENDENTE")) throw new ErroExtrato("Registre primeiro o recebimento no Pedido; a conciliação reconhecerá a baixa existente.");
    if (input.lancamentos && lancamentos.some(l => input.lancamentos!.find(i => i.id === l.id)?.versao !== l.updatedAt.toISOString())) throw new ErroExtrato("Um lançamento foi alterado. Atualize a tela e confira novamente.");
    const duplicatas = new Map(lancamentos.flatMap(l => l.notaFiscalItemLancamento
      ? [[l.notaFiscalItemLancamento.notaFiscalDuplicata.id, l.notaFiscalItemLancamento.notaFiscalDuplicata.valor] as const]
      : []));
    if (duplicatas.size) {
      const componentes = await tx.notaFiscalItemLancamento.findMany({
        where: {
          notaFiscalDuplicataId: { in: [...duplicatas.keys()] },
          lancamentoFinanceiro: { status: { not: "CANCELADO" } },
        },
        select: { notaFiscalDuplicataId: true, lancamentoFinanceiroId: true, valor: true },
      });
      const selecionados = new Set(ids);
      if (componentes.some(componente => !selecionados.has(componente.lancamentoFinanceiroId))) throw new ErroExtrato("Selecione a linha completa da parcela da nota fiscal, com todos os itens discriminados.");
      for (const [duplicataId, valorFinal] of duplicatas) {
        const totalItens = componentes.filter(componente => componente.notaFiscalDuplicataId === duplicataId)
          .reduce((total, componente) => total + centavos(componente.valor), 0);
        if (totalItens !== centavos(valorFinal)) throw new ErroExtrato("A composição dos itens não fecha com o valor final da parcela da nota fiscal. Revise a nota antes de conciliar.");
      }
    }
    const valorLiquidoLancamentos = lancamentos.reduce((s, l) => s + (l.tipo === "RECEITA" ? centavos(l.valor) : -centavos(l.valor)), 0);
    if (valorLiquidoLancamentos !== centavos(extrato.valor)) throw new ErroExtrato("O valor líquido dos lançamentos precisa ser exatamente igual ao valor do extrato.");
    for (const l of lancamentos) {
      if (l.status === "PENDENTE") {
        if (!pode("financeiro.baixas", "editar")) throw new ErroExtrato("Você precisa de permissão para realizar baixas.");
        await baixarLancamento({ lancamentoId: l.id, contaBancariaId: extrato.contaBancariaId, dataPagamento: data, tx, auditoriaOrigem: true });
      } else if (l.contaBancariaId !== extrato.contaBancariaId || !l.dataPagamento || dia(l.dataPagamento) !== dia(data) ||
        !l.movimentacaoBancaria || l.movimentacaoBancaria.contaBancariaId !== extrato.contaBancariaId || dia(l.movimentacaoBancaria.data) !== dia(data) || !l.movimentacaoBancaria.valor.equals(l.valor) || l.movimentacaoBancaria.tipo !== (l.tipo === "RECEITA" ? "ENTRADA" : "SAIDA")) throw new ErroExtrato("O lançamento realizado precisa ter a mesma conta, data e valor da respectiva movimentação. Revise a baixa antes de conciliar.");
    }
    await tx.vinculoExtrato.createMany({ data: ids.map(lancamentoId => ({ lancamentoId, transacaoId: extrato.id })) });
    await tx.transacaoExtrato.update({ where: { id: extrato.id }, data: { conciliadaEm: new Date(), conciliadaPorNome: usuario.nome } });
    await tx.historicoConciliacao.create({ data: { transacaoId: extrato.id, acao: input.novo ? "CRIACAO_E_CONCILIACAO" : "CONCILIACAO", autorId: usuario.id, autorNome: usuario.nome,
      detalhes: { lancamentos: lancamentos.map(l => ({ id: l.id, descricao: l.descricao, tipo: l.tipo, valor: l.valor.toString(), statusAnterior: l.status, competencia: l.dataCompetencia.toISOString(), categoriaId: l.categoriaId })), valorLiquidoConciliado: (valorLiquidoLancamentos / 100).toFixed(2), contaBancariaId: extrato.contaBancariaId, dataPagamento: data.toISOString() } } });
    return { ok: true as const };
  }, opcoesTransacao);
}
export async function desfazerConciliacao(transacaoId: string, motivo: string, sessao: SessaoAtual) {
  if (typeof transacaoId !== "string" || typeof motivo !== "string" || motivo.trim().length < 3 || motivo.length > 1000) throw new ErroExtrato("Informe o motivo para desfazer a conciliação (3 a 1.000 caracteres).");
  return prisma.$transaction(async tx => {
    const { usuario } = await ator(tx, sessao, "excluir");
    await tx.$queryRaw`SELECT id FROM "TransacaoExtrato" WHERE id = ${transacaoId} FOR UPDATE`;
    const extrato = await tx.transacaoExtrato.findUnique({ where: { id: transacaoId }, include: { vinculos: true } });
    if (!extrato?.conciliadaEm || !extrato.vinculos.length) throw new ErroExtrato("Esta transação não está conciliada.");
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(extrato.vinculos.map(l => l.lancamentoId).sort())}) ORDER BY id FOR UPDATE`);
    await tx.vinculoExtrato.deleteMany({ where: { transacaoId } });
    await tx.transacaoExtrato.update({ where: { id: transacaoId }, data: { conciliadaEm: null, conciliadaPorNome: null } });
    await tx.historicoConciliacao.create({ data: { transacaoId, acao: "DESCONCILIACAO", autorId: usuario.id, autorNome: usuario.nome, motivo: motivo.trim(), detalhes: { lancamentoIds: extrato.vinculos.map(l => l.lancamentoId), baixasPreservadas: true } } });
    return { ok: true as const };
  }, opcoesTransacao);
}
