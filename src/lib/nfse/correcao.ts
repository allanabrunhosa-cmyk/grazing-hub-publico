import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Acao, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { prepararPagamento } from "@/lib/notas-fiscais/pagamentos";
import { dataCalendarioValida } from "@/lib/financeiro/cartoes";
import { exigirDespesaSemCustoEntrega, travarCustosEntrega } from "@/lib/financeiro/custos-entrega";
import { GRUPOS_RECEITA } from "@/lib/labels";
import type { ParcelaNfseInput } from "./servico";

const incluirNota = {
  lancamentos: { orderBy: { lancamentoFinanceiroId: "asc" }, include: { lancamentoFinanceiro: {
    include: { formaPagamento: true, movimentacaoBancaria: true, vinculoExtrato: true, liquidacoesCartao: { include: { pagamento: { select: { revertidoEm: true } } } } },
  } } },
} satisfies Prisma.NotaFiscalServicoInclude;
type Nota = Prisma.NotaFiscalServicoGetPayload<{ include: typeof incluirNota }>;
type Parcela = ParcelaNfseInput & { id?: string };
export type CorrecaoNfseInput = { nfseId: string; categoriaId: string; descricao: string; dataVencimento: string; parcelas: Parcela[]; versao: string; motivo: string };

class ErroCorrecaoNfse extends Error {}
const json = (valor: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valor));
const chave = (id: string) => `NFSE:${id}`;
const dia = (data: Date) => data.toISOString().slice(0, 10);
function validarId(id: unknown): id is string { return typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id); }
function centavos(valor: number) { return Math.round(valor * 100); }

function versaoNota(nota: Nota) {
  return createHash("sha256").update(JSON.stringify({ id: nota.id, status: nota.status, updatedAt: nota.updatedAt,
    lancamentos: nota.lancamentos.map(({ lancamentoFinanceiro: l }) => ({ id: l.id, updatedAt: l.updatedAt, valor: l.valor.toString(), status: l.status, dataPagamento: l.dataPagamento,
      itemFaturaId: l.itemFaturaId, movimentacaoBancariaId: l.movimentacaoBancaria?.id, vinculoExtratoId: l.vinculoExtrato?.transacaoId,
      liquidacoes: l.liquidacoesCartao.map(p => ({ id: p.id, valor: p.valor.toString(), revertidoEm: p.pagamento.revertidoEm })) })),
  })).digest("hex");
}

async function autorizar(tx: Prisma.TransactionClient, sessao: SessaoAtual, escrita: boolean) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || !usuario.senhaDefinida || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroCorrecaoNfse("Sua sessão expirou. Entre novamente.");
  const pode = (recurso: string, acao: Acao) => usuario.perfilAcesso?.sistema === "ADMINISTRADOR" || permissaoEfetiva(
    (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, (usuario.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao);
  if (!pode("financeiro.nfse", "visualizar") || !pode("financeiro.nfse", "editar") || !pode("financeiro.movimentacoes", escrita ? "editar" : "visualizar")) throw new ErroCorrecaoNfse("Seu perfil não permite corrigir os lançamentos desta NFS-e.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro-cartoes'))`;
  await travarCustosEntrega(tx);
  return { id: usuario.id, nome: usuario.nome, pode };
}

function conferirNota(nota: Nota | null): asserts nota is Nota {
  if (!nota) throw new ErroCorrecaoNfse("NFS-e não encontrada.");
  if (nota.canceladaEm || !["ACEITA", "LANCADA"].includes(nota.status)) throw new ErroCorrecaoNfse("Somente uma NFS-e aceita pode ter os dados locais corrigidos.");
  if (!nota.lancamentos.some(v => v.lancamentoFinanceiro.status !== "CANCELADO")) throw new ErroCorrecaoNfse("Esta NFS-e ainda não tem despesa ativa. Use Lançar despesa.");
}

type Metadados = { id: string; numero: string; dataCompra: string | null; parcelaCartao: number };
async function metadadosAtuais(tx: Prisma.TransactionClient, nfseId: string) {
  const historico = await tx.historicoAcesso.findFirst({ where: { entidade: "COMPRA", entidadeId: chave(nfseId), acao: "CORRECAO_NFSE" }, orderBy: { createdAt: "desc" } });
  const dado = historico?.depois as { parcelas?: Metadados[] } | null;
  return Array.isArray(dado?.parcelas) ? dado.parcelas : [];
}
function parcelasDaNota(nota: Nota, memoria: Metadados[]) {
  const ativas = nota.lancamentos.map(v => v.lancamentoFinanceiro).filter(l => l.status !== "CANCELADO").sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime() || a.id.localeCompare(b.id));
  return ativas.map((l, i) => {
    const anterior = memoria.find(p => p.id === l.id);
    return { id: l.id, numero: anterior?.numero ?? String(i + 1).padStart(3, "0"), valor: Number(l.valor), dataVencimento: dia(l.dataVencimento),
      formaPagamento: l.cartaoCreditoId ? "CARTAO" as const : l.formaPagamento?.nome.toLocaleUpperCase("pt-BR") === "PIX" ? "PIX" as const : "BOLETO" as const,
      cartaoCreditoId: l.cartaoCreditoId, dataCompra: anterior?.dataCompra ?? null, parcelaCartao: anterior?.parcelaCartao ?? i + 1 };
  });
}

export async function obterCorrecaoNfse(nfseId: string, sessao: SessaoAtual) {
  if (!validarId(nfseId)) return { erro: "Identificador de NFS-e inválido." };
  try {
    return await prisma.$transaction(async tx => {
      await autorizar(tx, sessao, false);
      const nota = await tx.notaFiscalServico.findUnique({ where: { id: nfseId }, include: incluirNota });
      conferirNota(nota);
      const parcelas = parcelasDaNota(nota, await metadadosAtuais(tx, nfseId));
      const primeira = nota.lancamentos.find(v => v.lancamentoFinanceiro.id === parcelas[0].id)!.lancamentoFinanceiro;
      return { versao: versaoNota(nota), categoriaId: primeira.categoriaId, descricao: primeira.descricao.replace(/ \(\d{3}\/\d+\)$/, ""), dataVencimento: parcelas[0].dataVencimento, parcelas };
    });
  } catch (erro) { return { erro: erro instanceof ErroCorrecaoNfse ? erro.message : "Não foi possível carregar a correção da NFS-e." }; }
}

function validarEntrada(input: CorrecaoNfseInput) {
  if (!validarId(input.nfseId) || !validarId(input.categoriaId) || typeof input.versao !== "string" || !/^[a-f0-9]{64}$/.test(input.versao)) return "Reabra a nota para carregar a versão atual.";
  if (typeof input.motivo !== "string" || input.motivo.trim().length < 15 || input.motivo.trim().length > 255 || /[\u0000-\u001f]/.test(input.motivo)) return "Informe um motivo de 15 a 255 caracteres para a correção.";
  if (typeof input.descricao !== "string" || !input.descricao.trim() || input.descricao.trim().length > 160 || /[\u0000-\u001f]/.test(input.descricao)) return "Informe uma descrição de até 160 caracteres.";
  if (!dataCalendarioValida(input.dataVencimento) || !Array.isArray(input.parcelas) || input.parcelas.length < 1 || input.parcelas.length > 36) return "Informe entre 1 e 36 parcelas válidas.";
  const ids = new Set<string>(), numeros = new Set<string>();
  for (const p of input.parcelas) {
    if (!p || typeof p !== "object" || (p.id !== undefined && (!validarId(p.id) || ids.has(p.id))) || typeof p.numero !== "string" || !/^\d{3}$/.test(p.numero) || numeros.has(p.numero)
      || !Number.isFinite(p.valor) || p.valor <= 0 || p.valor >= 1e12 || new Prisma.Decimal(p.valor).decimalPlaces() > 2 || !dataCalendarioValida(p.dataVencimento)
      || !["BOLETO", "PIX", "CARTAO"].includes(p.formaPagamento) || (p.parcelaCartao !== undefined && (!Number.isInteger(p.parcelaCartao) || p.parcelaCartao < 1 || p.parcelaCartao > 36))) return "Confira os identificadores, valores, números e vencimentos das parcelas.";
    if (p.id) ids.add(p.id);
    numeros.add(p.numero);
  }
  return null;
}

function exigirPagamentoEditavel(l: Nota["lancamentos"][number]["lancamentoFinanceiro"]) {
  if (l.status !== "PENDENTE" || l.dataPagamento || l.movimentacaoBancaria || l.vinculoExtrato || l.itemFaturaId || l.liquidacoesCartao.some(p => !p.pagamento.revertidoEm) || l.pedidoVendaId) throw new ErroCorrecaoNfse("A parcela já possui pagamento ou vínculo financeiro. Desfaça esse vínculo na origem antes de alterar seu valor ou pagamento.");
}

export async function corrigirNfse(input: CorrecaoNfseInput, sessao: SessaoAtual) {
  const erroValidacao = validarEntrada(input);
  if (erroValidacao) return { erro: erroValidacao };
  try {
    return await prisma.$transaction(async tx => {
      const autor = await autorizar(tx, sessao, true);
      await tx.$queryRaw`SELECT id FROM "NotaFiscalServico" WHERE id = ${input.nfseId} FOR UPDATE`;
      const leitura = await tx.notaFiscalServico.findUnique({ where: { id: input.nfseId }, include: incluirNota });
      conferirNota(leitura);
      const ids = leitura.lancamentos.map(v => v.lancamentoFinanceiroId).sort();
      await tx.$queryRaw`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const nota = await tx.notaFiscalServico.findUnique({ where: { id: input.nfseId }, include: incluirNota });
      conferirNota(nota);
      if (versaoNota(nota) !== input.versao) throw new ErroCorrecaoNfse("A NFS-e ou seus lançamentos mudaram. Reabra a nota antes de corrigir.");
      const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: input.categoriaId } });
      if (!categoria?.ativo || categoria.excluidoEm || GRUPOS_RECEITA.includes(categoria.grupo)) throw new ErroCorrecaoNfse("Selecione uma categoria de despesa ativa.");
      const valorNota = Number(nota.valorLiquido ?? nota.valorServico ?? 0);
      if (!Number.isFinite(valorNota) || valorNota <= 0 || input.parcelas.reduce((t, p) => t + centavos(p.valor), 0) !== centavos(valorNota)) throw new ErroCorrecaoNfse("A soma das parcelas precisa fechar com o valor da NFS-e.");
      const atuais = parcelasDaNota(nota, await metadadosAtuais(tx, nota.id));
      const titulos = nota.lancamentos.map(v => v.lancamentoFinanceiro).filter(l => l.status !== "CANCELADO");
      if (input.parcelas.some(p => p.id && !titulos.some(l => l.id === p.id))) throw new ErroCorrecaoNfse("Há uma parcela de outra nota ou cancelada. Reabra o painel.");
      const removidos = titulos.filter(l => !input.parcelas.some(p => p.id === l.id));
      if (removidos.length && !autor.pode("financeiro.movimentacoes", "excluir")) throw new ErroCorrecaoNfse("Seu perfil não permite remover parcelas financeiras.");
      if (input.parcelas.some(p => !p.id) && !autor.pode("financeiro.movimentacoes", "adicionar")) throw new ErroCorrecaoNfse("Seu perfil não permite adicionar parcelas financeiras.");
      // Validate the complete plan before writing any title or payment registration.
      for (const removido of removidos) { exigirPagamentoEditavel(removido); await exigirDespesaSemCustoEntrega(tx, { id: removido.id }); }
      const planos = [];
      for (const parcela of input.parcelas) {
        const atual = titulos.find(l => l.id === parcela.id);
        const dtoAtual = atuais.find(p => p.id === parcela.id);
        const mudouPagamento = !dtoAtual || dtoAtual.formaPagamento !== parcela.formaPagamento || (dtoAtual.cartaoCreditoId ?? null) !== (parcela.formaPagamento === "CARTAO" ? parcela.cartaoCreditoId ?? null : null)
          || dtoAtual.dataVencimento !== parcela.dataVencimento || centavos(dtoAtual.valor) !== centavos(parcela.valor);
        const mudouMetadados = !!dtoAtual && parcela.formaPagamento === "CARTAO" && (dtoAtual.dataCompra !== (parcela.dataCompra ?? null) || dtoAtual.parcelaCartao !== (parcela.parcelaCartao ?? 1));
        if (atual && (mudouPagamento || mudouMetadados)) exigirPagamentoEditavel(atual);
        const descricaoEsperada = input.parcelas.length > 1 ? `${input.descricao.trim()} (${parcela.numero}/${input.parcelas.length})` : input.descricao.trim();
        if (atual && (mudouPagamento || atual.categoriaId !== input.categoriaId || atual.descricao !== descricaoEsperada)) await exigirDespesaSemCustoEntrega(tx, { id: atual.id });
        let preparado;
        if (mudouPagamento || (parcela.formaPagamento === "CARTAO" && mudouMetadados)) {
          try { preparado = await prepararPagamento(tx, parcela); } catch (erro) { throw new ErroCorrecaoNfse(erro instanceof Error ? erro.message : "Pagamento inválido."); }
        }
        planos.push({ parcela, atual, preparado, mudouPagamento });
      }
      for (const removido of removidos) await tx.lancamentoFinanceiro.update({ where: { id: removido.id }, data: { status: "CANCELADO" } });
      const parcelasSalvas = [];
      for (const { parcela, atual, preparado, mudouPagamento } of planos) {
        const descricao = input.parcelas.length > 1 ? `${input.descricao.trim()} (${parcela.numero}/${input.parcelas.length})` : input.descricao.trim();
        let dadosPagamento: { formaPagamentoId: string; cartaoCreditoId: string | null; contaBancariaId: string | null; dataVencimento: Date } | undefined;
        if (preparado && mudouPagamento) {
          const nome = preparado.formaPagamento === "CARTAO" ? "Cartão de crédito" : preparado.formaPagamento === "PIX" ? "Pix" : "Boleto";
          const forma = await tx.formaPagamento.upsert({ where: { nome }, create: { nome }, update: {} });
          dadosPagamento = { formaPagamentoId: forma.id, cartaoCreditoId: preparado.cartaoCreditoId, contaBancariaId: preparado.contaBancariaId, dataVencimento: preparado.dataVencimento };
        }
        const salvo = atual ? await tx.lancamentoFinanceiro.update({ where: { id: atual.id }, data: { descricao, categoriaId: categoria.id, ...(mudouPagamento ? { valor: parcela.valor, ...dadosPagamento } : {}) } })
          : await tx.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao, categoriaId: categoria.id, valor: parcela.valor, ...dadosPagamento!, dataCompetencia: nota.dataCompetencia ?? nota.dataEmissao ?? new Date(`${input.dataVencimento}T12:00:00Z`), fornecedorId: nota.fornecedorId, contraparteNome: nota.fornecedorId ? null : nota.prestadorNome, criadoPorId: autor.id } });
        if (!atual) await tx.notaFiscalServicoLancamento.create({ data: { notaFiscalServicoId: nota.id, lancamentoFinanceiroId: salvo.id, criadoPorId: autor.id, criadoPorNome: autor.nome } });
        parcelasSalvas.push({ ...parcela, id: salvo.id });
      }
      const primeiroVencimento = input.parcelas.map(p => p.dataVencimento).sort()[0];
      await tx.notaFiscalServico.update({ where: { id: nota.id }, data: { status: "LANCADA", dataVencimento: new Date(`${primeiroVencimento}T00:00:00Z`) } });
      await tx.historicoAcesso.create({ data: { autorId: autor.id, entidade: "COMPRA", entidadeId: chave(nota.id), acao: "CORRECAO_NFSE", antes: json({ versao: input.versao, parcelas: atuais, lancamentos: titulos.map(l => ({ id: l.id, descricao: l.descricao, categoriaId: l.categoriaId })) }), depois: json({ motivo: input.motivo.trim(), categoriaId: categoria.id, descricao: input.descricao.trim(), parcelas: parcelasSalvas, cancelados: removidos.map(l => l.id) }) } });
      return { ok: true as const };
    }, { timeout: 30_000, maxWait: 5_000 });
  } catch (erro) { return { erro: erro instanceof ErroCorrecaoNfse ? erro.message : "Não foi possível corrigir a NFS-e. Nenhuma alteração foi gravada." }; }
}
