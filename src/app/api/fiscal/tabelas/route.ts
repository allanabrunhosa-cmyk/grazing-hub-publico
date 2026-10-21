import { podeAcessar } from "@/lib/permissoes/servidor";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";
import { TABELAS_FISCAIS, type ConsultaTabelaFiscal, type FiltroOperacaoFiscal } from "@/lib/fiscal/catalogos/tipos";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";

/** Pesquisa local de dados públicos. Sessão e permissão fiscal são obrigatórias. */
export async function GET(req: Request) {
  if (!await podeAcessar("vendas.fiscal", "visualizar")) return Response.json({ erro: "Consulta não permitida." }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const tabela = p.get("tabela"), crt = p.get("crt"), modelo = p.get("modelo"), operacao = p.get("operacao"), uso = p.get("uso");
  if (!TABELAS_FISCAIS.includes(tabela as ConsultaTabelaFiscal["tabela"]) || crt && !["1", "2", "3", "4"].includes(crt) || modelo && !["55", "65"].includes(modelo) || operacao && !["SAIDA", "INTERNA", "INTERESTADUAL", "EXTERIOR", "ENTRADA", "TODAS"].includes(operacao) || ["ncm", "cst", "ipi"].some(k => p.has(k) && !/^\d{0,8}$/.test(p.get(k)!)) || p.has("uf") && !/^[A-Z]{2}$/.test(p.get("uf")!)) return Response.json({ erro: "Pesquisa fiscal inválida." }, { status: 400 });
  try {
    if (uso && !["EMISSAO", "PARAMETRO_INTERNO"].includes(uso)) throw new Error("Uso fiscal inválido.");
    const regime = !crt && ["csosn", "cstIcms", "cBenef"].includes(tabela!) ? await obterRegimeFiscalEmpresaBrasilNfe(p.get("dia") ?? undefined) : null;
    const resultado = consultarTabelaFiscal({ tabela: tabela as ConsultaTabelaFiscal["tabela"], busca: p.get("busca") ?? "", selecionado: p.get("selecionado") ?? "", ...(p.has("dia") ? { dia: p.get("dia")! } : {}), crt: crt ? Number(crt) as 1 | 2 | 3 | 4 : regime?.crt ?? null, ...(modelo ? { modelo: Number(modelo) as 55 | 65 } : {}), ...(operacao ? { operacao: operacao as FiltroOperacaoFiscal } : {}), ...(uso ? { uso: uso as "EMISSAO" | "PARAMETRO_INTERNO" } : {}), ...(p.has("ncm") ? { ncm: p.get("ncm")! } : {}), ...(p.has("cst") ? { cst: p.get("cst")! } : {}), ...(p.has("ipi") ? { ipi: p.get("ipi")! } : {}), ...(p.has("uf") ? { uf: p.get("uf")! } : {}) });
    return Response.json(resultado, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ erro: "Pesquisa fiscal inválida." }, { status: 400 }); }
}
