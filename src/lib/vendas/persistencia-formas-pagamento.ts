import "server-only";
import { ErroCadastroVenda } from "./dominio";
import { validarFormaPagamentoVenda } from "./formas-pagamento";
import { historico, transacao, type Autor } from "./persistencia";

export async function salvarFormaPagamentoVenda(entrada: unknown, autor: Autor) {
  const { id, versao, ...dados } = validarFormaPagamentoVenda(entrada);
  return transacao(async tx => {
    const antes = id ? await tx.formaPagamentoVenda.findUnique({ where: { id } }) : null;
    if (id && !antes) throw new ErroCadastroVenda("Forma de pagamento não encontrada.");
    if (antes && antes.versao !== versao) throw new ErroCadastroVenda("Esta forma de pagamento foi alterada em outra tela. Reabra para conferir antes de salvar.");
    const homonimo = await tx.formaPagamentoVenda.findFirst({ where: { nome: { equals: dados.nome, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
    if (homonimo) throw new ErroCadastroVenda("Já existe uma forma de pagamento com esse nome.");
    const depois = id
      ? await tx.formaPagamentoVenda.update({ where: { id }, data: { ...dados, versao: { increment: 1 } } })
      : await tx.formaPagamentoVenda.create({ data: dados });
    await historico(tx, autor, "FORMA_PAGAMENTO", depois.id, antes, depois);
    return depois.id;
  });
}
