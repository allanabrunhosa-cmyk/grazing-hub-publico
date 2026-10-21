import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { lerAjustesOpcoes, opcoesEfetivas, simularConfiguracao } from "./dominio";
import { precosOpcoes } from "./complementos";
import { ErroPedidoVenda, quantidadeComercial, validarEntradaPedido, type PedidoEntrada } from "./pedidos-dominio";
import { slotsDosItens, slotsPorUnidade } from "./entregas-veiculos";

/** Frete não valida cadastro, cobrança, agenda, pagamento ou a conclusão das escolhas. */
export function validarEntradaFretePedido(valor: unknown): PedidoEntrada {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new ErroPedidoVenda("Dados do frete inválidos.");
  const d = valor as Record<string, unknown>;
  const itens = Array.isArray(d.itens) ? d.itens.map(v => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroPedidoVenda("Produto inválido.");
    const i = v as Record<string, unknown>;
    return { produtoId: i.produtoId, quantidade: i.quantidade, escolhas: i.escolhas, precoManual: i.precoManual,
      ...(i.complementoAvulso ? { complementoAvulso: i.complementoAvulso } : {}),
      ...(Object.hasOwn(i, "tipoEmbalagemId") ? { tipoEmbalagemId: i.tipoEmbalagemId } : {}) };
  }) : d.itens;
  const entrada = validarEntradaPedido({ clienteId: d.clienteId, atendimento: d.atendimento, endereco: d.endereco,
    itens, desconto: d.desconto, veiculoEntregaId: d.veiculoEntregaId });
  if (!entrada.itens.length) throw new ErroPedidoVenda("Selecione ao menos um produto para calcular o frete.");
  if (entrada.atendimento !== "ENTREGA" && entrada.atendimento !== "RETIRADA") throw new ErroPedidoVenda("Escolha entrega ou retirada.");
  return entrada;
}

/** Consulta apenas o catálogo comercial/logístico, com preços e slots refeitos no servidor. */
export async function calcularItensFretePedido(tx: Prisma.TransactionClient, d: PedidoEntrada) {
  let subtotal = new Prisma.Decimal(0);
  const itens: { quantidade: string; produtoSnapshot: { slotsEntrega: string | null } }[] = [];
  const embalagens = new Set<string>();
  for (const entrada of d.itens) {
    const produto = await tx.produtoVenda.findUnique({ where: { id: entrada.produtoId }, include: {
      grupos: { include: { grupo: { include: { opcoes: true } } } },
    } });
    if (!produto?.ativo || !produto.classificacoes.some(c => ["PRINCIPAL", "OPCAO", "COMPLEMENTO"].includes(c))) throw new ErroPedidoVenda("Produto indisponível.");
    let base = produto.preco, multiplicador = "1";
    // Itens avulsos históricos mantêm o preço e o multiplicador da opção. A confirmação continua validando sua origem.
    if (entrada.complementoAvulso) {
      const origem = entrada.complementoAvulso;
      const principal = await tx.produtoVenda.findUnique({ where: { id: origem.produtoOrigemId }, include: { grupos: { include: { grupo: { include: { opcoes: true } } } } } });
      const vinculo = principal?.grupos.find(v => v.grupoId === origem.grupoId);
      const opcao = vinculo?.grupo.opcoes.find(o => o.id === origem.opcaoId);
      if (!principal?.ativo || !vinculo?.grupo.ativo || !opcao?.ativo || opcao.produtoId !== produto.id || vinculo.opcoesExcluidas.includes(opcao.id)) throw new ErroPedidoVenda("Complemento opcional indisponível.");
      base = opcao.preco; multiplicador = opcao.quantidade.toString();
    }
    const quantidade = quantidadeComercial(entrada.quantidade, entrada.complementoAvulso ? "UN" : produto.unidade);
    const vinculados = await tx.produtoVenda.findMany({ where: { id: { in: produto.grupos.flatMap(v => v.grupo.opcoes.flatMap(o => o.produtoId ? [o.produtoId] : [])) } }, select: { id: true, preco: true, slotsEntrega: true, ativo: true } });
    const grupos = entrada.complementoAvulso ? [] : produto.grupos.map(v => {
      const vinculo = { grupoId: v.grupoId, usarPadrao: false, minimo: 0, maximo: null, opcoesExcluidas: v.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(v.ajustesOpcoes) };
      const opcoes = opcoesEfetivas(precosOpcoes(v.grupo.opcoes.map(o => ({ ...o, preco: o.preco.toString(), quantidade: o.quantidade.toString() })), vinculados.map(p => ({ id: p.id, preco: p.preco.toString() }))), vinculo);
      return { ...v.grupo, minimo: 0, opcoes, vinculo };
    });
    const simulacao = simularConfiguracao(base.toString(), grupos, entrada.escolhas);
    if (!simulacao.valido) throw new ErroPedidoVenda(simulacao.erros[0]);
    const acrescimos = new Prisma.Decimal(simulacao.totalCentavos).div(100).minus(base);
    const preco = entrada.precoManual === null ? base : new Prisma.Decimal(entrada.precoManual);
    subtotal = subtotal.plus(preco.plus(acrescimos).mul(quantidade).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
    const escolhas = grupos.filter(g => g.ativo).flatMap(g => g.opcoes.filter(o => o.ativo && entrada.escolhas[o.id] && o.produtoId).map(o => {
      const produto = vinculados.find(p => p.id === o.produtoId);
      if (!produto?.ativo) throw new ErroPedidoVenda("Complemento vinculado indisponível.");
      return { slots: produto.slotsEntrega, quantidade: entrada.escolhas[o.id], multiplicador: o.composicao == null ? o.quantidade : "1" };
    }));
    itens.push({ quantidade, produtoSnapshot: { slotsEntrega: slotsPorUnidade(produto.slotsEntrega, multiplicador, escolhas) } });
    const embalagem = entrada.tipoEmbalagemId === undefined ? produto.tipoEmbalagemId : entrada.tipoEmbalagemId;
    if (embalagem) embalagens.add(embalagem);
  }
  if (subtotal.gt("999999999999.99")) throw new ErroPedidoVenda("Subtotal excede o limite permitido.");
  // Uma configuração ainda incompleta pode ter preço zero; sua ocupação já permite simular a rota.
  const liquido = Prisma.Decimal.max(0, subtotal.minus(d.desconto));
  return { subtotalProdutos: liquido.toFixed(2), tiposEmbalagemIds: [...embalagens], slotsOcupados: slotsDosItens(itens) };
}
