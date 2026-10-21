import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ErroPedidoVenda } from "./pedidos-dominio";

// A exceção é exclusiva de banco fictício local explicitamente selecionado pelo executor.
export function ambientePedidosIsolado() {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return process.env.PEDIDOS_AMBIENTE_ISOLADO === "1" && ["localhost", "127.0.0.1"].includes(u.hostname) && /^\/teste_[a-z0-9_]+$/.test(u.pathname);
  } catch { return false; }
}
export type AprovacaoPedidos = { responsavel: string; data: string; referencia: string; vigencia: string };
export type LiberacaoPedidos = {
  versao: 1; ativa: boolean; locais: string[];
  b05?: AprovacaoPedidos; b06?: AprovacaoPedidos; retencao?: AprovacaoPedidos;
  e01?: AprovacaoPedidos; cadastros?: AprovacaoPedidos; integracoes?: AprovacaoPedidos; publicacao?: AprovacaoPedidos;
};
export async function exigirLiberacaoPedidos(tx: Prisma.TransactionClient, localId?: string, contexto?: { pedidoId?: string; novoModo?: string; financeiro?: boolean }) {
  const pedido = contexto?.pedidoId ? await tx.pedidoVenda.findUniqueOrThrow({ where: { id: contexto.pedidoId }, select: { modoFinanceiro: true } }) : null;
  const externo = (pedido?.modoFinanceiro ?? contexto?.novoModo) === "EXTERNO";
  if (externo && contexto?.financeiro) throw new ErroPedidoVenda("Financeiro controlado externamente. Esta ação não pode gerar efeitos financeiros no HUB.");
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } });
  const c = loja?.pedidosLiberacao as LiberacaoPedidos | null;
  if (externo) {
    if (process.env.PEDIDOS_OPERACAO_EXTERNA === "0") throw new ErroPedidoVenda("Novas operações de Pedidos estão temporariamente suspensas; histórico disponível.");
    if (localId && c?.locais?.length && !c.locais.includes(localId)) throw new ErroPedidoVenda("Local fora do escopo configurado para Pedidos. A agenda e a consulta continuam disponíveis.");
    // Sem restrição específica, a escolha explícita de local ativo é validada pelo
    // serviço físico e exige permissão de estoque; nunca escolhe local/saldo sozinho.
    return;
  }
  if (ambientePedidosIsolado()) {
    if (localId && !c?.locais?.includes(localId)) throw new ErroPedidoVenda("Local não incluído no ensaio físico.");
    return;
  }
  // Gestão interna manual: confirmação valida categoria, competência, parcelas e
  // regras do comprador; cada recebimento valida o fato e a conta de destino.
  // Emissor, adquirente e estoque automático não são pré-requisitos financeiros.
  if (localId && c?.locais?.length && !c.locais.includes(localId)) throw new ErroPedidoVenda("Local fora do escopo configurado para Pedidos.");
}
