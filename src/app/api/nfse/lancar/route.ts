import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { lancarNfse } from "@/lib/nfse/servico";

export async function POST(requisicao: Request) {
  const sessao = await getSession();
  if (!sessao) return Response.json({ erro: "Sua sessão expirou. Atualize a página e entre novamente." }, { status: 401 });
  const [podeEditarNfse, podeAdicionarMovimentacao] = await Promise.all([podeAcessar("financeiro.nfse", "editar"), podeAcessar("financeiro.movimentacoes", "adicionar")]);
  if (!podeEditarNfse || !podeAdicionarMovimentacao) return Response.json({ erro: "Seu perfil não permite lançar NFS-e no financeiro." }, { status: 403 });
  try {
    const corpo = await requisicao.json() as { nfseId?: unknown; categoriaId?: unknown; descricao?: unknown; dataVencimento?: unknown; parcelas?: unknown };
    if (typeof corpo.nfseId !== "string" || typeof corpo.categoriaId !== "string" || typeof corpo.descricao !== "string" || typeof corpo.dataVencimento !== "string") return Response.json({ erro: "Dados do lançamento incompletos." }, { status: 400 });
    if (corpo.parcelas !== undefined && (!Array.isArray(corpo.parcelas) || corpo.parcelas.length < 1 || corpo.parcelas.length > 36)) return Response.json({ erro: "Informe entre 1 e 36 parcelas." }, { status: 400 });
    const parcelas = Array.isArray(corpo.parcelas) ? corpo.parcelas.map((parcela) => {
      if (!parcela || typeof parcela !== "object") return null;
      const dado = parcela as Record<string, unknown>;
      if (typeof dado.numero !== "string" || typeof dado.valor !== "number" || typeof dado.dataVencimento !== "string" || !["BOLETO", "PIX", "CARTAO"].includes(String(dado.formaPagamento))) return null;
      return { numero: dado.numero, valor: dado.valor, dataVencimento: dado.dataVencimento, formaPagamento: dado.formaPagamento as "BOLETO" | "PIX" | "CARTAO", cartaoCreditoId: typeof dado.cartaoCreditoId === "string" ? dado.cartaoCreditoId : null, dataCompra: typeof dado.dataCompra === "string" ? dado.dataCompra : null, parcelaCartao: typeof dado.parcelaCartao === "number" ? dado.parcelaCartao : undefined };
    }) : undefined;
    if (corpo.parcelas !== undefined && (!parcelas || parcelas.some(parcela => parcela === null))) return Response.json({ erro: "Há uma parcela com dados inválidos." }, { status: 400 });
    const parcelasValidas = parcelas?.filter((parcela): parcela is NonNullable<typeof parcela> => parcela !== null);
    const resultado = await lancarNfse({ nfseId: corpo.nfseId, categoriaId: corpo.categoriaId, descricao: corpo.descricao, dataVencimento: corpo.dataVencimento, parcelas: parcelasValidas, autorId: sessao.userId, autorNome: sessao.nome });
    if ("erro" in resultado) return Response.json(resultado, { status: 400 });
    revalidatePath("/financeiro/manifesto-nfs");
    revalidatePath("/financeiro/movimentacoes");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/fluxo-de-caixa");
    return Response.json(resultado);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Não foi possível lançar a NFS-e." }, { status: 400 });
  }
}
