/** Operação única de 25/11/2026: Grazing Espetinhos 24un e 48un passam a ter NCM único
 * 2106.90.90, decisão do responsável ("Composição não muda o NCM"). Não altera receita,
 * preço, cardápio nem documentos emitidos; grava nova versão da classificação pelo serviço
 * oficial (salvar → impacto → ativar). Sem `--aplicar` desfaz tudo ao final (ensaio).
 * Executar: node --conditions=react-server --import tsx scripts/estrutura-fiscal-espetinhos-ncm-unico.ts <usuarioId> [--aplicar] */
import { randomUUID } from "node:crypto";
import type { ClassificacaoFiscal, ConfiguracaoNcm } from "../src/lib/tributacao/tipos";
import type { SessaoAtual } from "../src/lib/session";

const NCM = "21069090", GRUPO_SABORES = "1219e0c1-29cb-4537-90bc-4d42105343bf";
const ALVOS = [
  { versaoId: "cmvi7rjxs00j54pquabnkshem" },
  { versaoId: "cmvi7s44000rd4pqutfzybi7r" },
];
class Ensaio extends Error {}

async function executar() {
  const [usuarioId, modo] = process.argv.slice(2), aplicar = modo === "--aplicar";
  if (!usuarioId || !process.env.DATABASE_URL) throw new Error("Informe o usuário administrador e a conexão explícita do alvo.");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { salvarVersaoFiscalNaTransacao, analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao } = await import("../src/lib/tributacao/servico");
  const { calcularPreviaPedido } = await import("../src/lib/tributacao/pedidos");
  const { listarRevisoesNcmPendentes } = await import("../src/lib/tributacao/revisao-ncm");
  const { hojeFiscal } = await import("../src/lib/tributacao/validacao");
  const relatorio: unknown[] = [];
  try {
    await bancoPrincipal.$transaction(async tx => {
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, sessaoVersao: true } });
      const sessao = { userId: u.id, versao: u.sessaoVersao } as unknown as SessaoAtual;
      const previas = async (produtoId: string) => {
        const pedidos = await tx.pedidoVenda.findMany({ where: { status: "CONFIRMADO", itens: { some: { vigente: true, produtoId } } }, orderBy: { createdAt: "desc" }, take: 3, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
        const saida = [];
        for (const p of pedidos) {
          try {
            const { previa } = await calcularPreviaPedido(tx, p as never);
            saida.push({ pedido: p.numero, linhas: previa.linhas.filter(l => l.nome.includes("Espetinhos")).map(l => ({ nome: l.nome, ncm: (l as unknown as { ncm?: string }).ncm, valor: l.valor })), pendencias: previa.pendencias.filter(x => x.includes("Espetinhos")), revisoes: (previa.revisoesNcm ?? []).filter(r => r.nome.includes("Espetinhos")).length });
          } catch (e) { saida.push({ pedido: p.numero, erro: e instanceof Error ? e.message : "falha" }); }
        }
        return saida;
      };
      for (const alvo of ALVOS) {
        const base = await tx.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: alvo.versaoId } });
        const ultima = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: base.chave }, orderBy: { versao: "desc" }, select: { id: true } });
        const d = structuredClone(base.dados) as unknown as ClassificacaoFiscal, cfg = d.configuracaoNcm;
        if (base.tipo !== "CLASSIFICACAO" || base.status !== "ATIVO" || ultima?.id !== base.id || !cfg || cfg.cenarios.length !== 6 || cfg.grupoIds.join() !== GRUPO_SABORES || d.ncm) throw new Error(`Classificação ${alvo.versaoId} diverge da auditoria; nada foi alterado.`);
        const produto = await tx.produtoVenda.findUniqueOrThrow({ where: { id: base.chave }, select: { nome: true } });
        const antes = await previas(base.chave);
        const referencia = cfg.cenarios.find(s => s.ncm === NCM)?.analiseNcm;
        const opcaoIds = [...new Set(cfg.cenarios.flatMap(s => s.opcaoIds))].sort();
        if (!referencia?.descricaoNcm || opcaoIds.length !== 3) throw new Error("Análise de referência do NCM 2106.90.90 ausente.");
        const analise = { ...referencia, dataAnalise: hojeFiscal(), pendenciasNcm: [], fontes: [...referencia.fontes, "Decisão do responsável em 25/11/2026: tipos de complemento (docs/features/complementos-tipos-fiscais/SPEC.md)"],
          justificativa: `Decisão do responsável em 25/11/2026: Composição não altera o NCM. Os Espetinhos passam a NCM único 2106.90.90 para qualquer combinação de sabores, o mesmo da Grazing para 2 Vegetariana. Fundamentação técnica do código na classificação anterior ${base.id}.` };
        d.ncm = NCM; d.analiseNcm = analise;
        d.configuracaoNcm = { cenarios: [], grupoIds: [], padraoSemEscolhasAutorizado: true, fotografiaTecnica: cfg.fotografiaTecnica,
          gruposEquivalentes: [{ grupoId: GRUPO_SABORES, opcaoIds, analiseNcm: analise, quantidadeMinima: "2", quantidadeMaxima: "2" }] } as ConfiguracaoNcm;
        const nova = await salvarVersaoFiscalNaTransacao(tx, { tipo: "CLASSIFICACAO", chave: base.chave, dados: d, versaoBase: base.versao, vigenciaInicio: hojeFiscal(), justificativa: "NCM único 2106.90.90 para os Espetinhos por decisão do responsável em 25/11/2026: Composição não altera o NCM.", fontes: ["Decisão do responsável em 25/11/2026 (tipos de complemento).", `Classificação anterior ${base.id}`], chaveOperacao: `espetinhos-ncm-unico-${base.id}` }, sessao);
        const impacto = await analisarImpactoFiscalNaTransacao(tx, nova.id, sessao);
        await ativarVersaoFiscalNaTransacao(tx, nova.id, impacto.hash, randomUUID(), sessao);
        const pendentes = (await listarRevisoesNcmPendentes(tx, { produtoIds: [base.chave] })).length;
        relatorio.push({ produto: produto.nome, versaoAnterior: base.id, versaoNova: nova.id, revisoesPendentes: pendentes, antes, depois: await previas(base.chave) });
      }
      if (!aplicar) throw new Ensaio();
    }, { timeout: 120000 });
  } catch (e) { if (!(e instanceof Ensaio)) throw e; }
  finally { await bancoPrincipal.$disconnect(); }
  console.log(JSON.stringify({ modo: aplicar ? "APLICADO" : "ENSAIO_DESFEITO", relatorio }, null, 1));
}
void executar().catch(e => { console.error(e instanceof Error ? e.message : "Operação não confirmada."); process.exitCode = 1; });
