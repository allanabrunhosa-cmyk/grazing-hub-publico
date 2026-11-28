/** Operação única de 28/11/2026, pedida pelo responsável: abrevia para até 60 caracteres (limite
 * da NF-e) a razão social dos três clientes que ainda excediam, pelo serviço oficial do cadastro,
 * e o retrato de cobrança dos pedidos 98 e 99, do mesmo cliente já corrigido no pedido 100.
 * Não altera CNPJ, Nome Fantasia, endereço, valores nem documento fiscal; nada é transmitido.
 * Sem `--aplicar` desfaz tudo ao final (ensaio).
 * Executar: node --conditions=react-server --import tsx scripts/clientes-razao-social-60.ts <usuarioId> [--aplicar] */
import { createHash } from "node:crypto";

const CLIENTES = [
  { id: "cmvafupwd002i0qlwqlzc044a", antiga: "Associacao Juntos Pelos Delegados e Conselheiros do Cremesp - J.t.s.", nova: "Assoc. Juntos Pelos Delegados e Conselheiros do Cremesp" },
  { id: "cmvafupxs003a0qlwm4zxfz1h", antiga: "Archademy Company Consultoria e Desenvolvimento de Inovacao e Tecnologia Ltda", nova: "Archademy Company Cons. e Desenv. de Inov. e Tecnologia Ltda" },
  { id: "cmvafupy2003e0qlw19o1o2fp", antiga: "Transdev do Brasil Consultoria e Investimento em Mobilidade S.a", nova: "Transdev do Brasil Consult. e Investimento em Mobilidade S.A" },
];
const PEDIDOS = { clienteId: "cmv910sh300k2dtqtq5xh6rz4", numeros: [98, 99], antiga: "OPERADOR NACIONAL DO SISTEMA DE REGISTRO ELETRONICO DE IMOVEIS ( ONR )", nova: "OPERADOR NAC. DO SISTEMA DE REGISTRO ELETRONICO DE IMOVEIS" };
const MOTIVO = "Razão social abreviada para o limite de 60 caracteres da NF-e, a pedido do responsável.";
class Ensaio extends Error {}
type Registro = Record<string, unknown>;
const semVolateis = (r: Registro) => JSON.stringify({ ...r, razaoSocial: null, versao: null, updatedAt: null });

async function executar() {
  const [usuarioId, modo] = process.argv.slice(2), aplicar = modo === "--aplicar";
  if (!usuarioId || !process.env.DATABASE_URL) throw new Error("Informe o usuário administrador e a conexão explícita do alvo.");
  if ([...CLIENTES, PEDIDOS].some(c => c.nova.length > 60 || !c.nova.trim())) throw new Error("Razão social nova fora do limite de 60 caracteres.");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { salvarClienteNaTransacao } = await import("../src/lib/vendas/persistencia");
  const { resolverDestinatarioBrasilNfe } = await import("../src/lib/fiscal-saida/brasil-nfe-destinatario");
  const relatorio: unknown[] = [];
  try {
    await bancoPrincipal.$transaction(async tx => {
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, nome: true, ativo: true, perfilAcesso: { select: { sistema: true } } } });
      if (!u.ativo || u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new Error("Administrador ativo é obrigatório.");
      const autor = { userId: u.id, nome: u.nome };
      for (const alvo of CLIENTES) {
        const c = await tx.clienteVenda.findUniqueOrThrow({ where: { id: alvo.id } }), ends = c.enderecos as Registro[];
        if (c.tipo !== "PJ" || c.razaoSocial !== alvo.antiga || c.unificadoEmId || !Array.isArray(ends) || ends.length) throw new Error(`Cliente ${alvo.id} diverge da auditoria; nada foi alterado.`);
        await salvarClienteNaTransacao(tx as never, { id: c.id, versao: c.versao, tipo: "PJ", tipoEscolhido: true, nome: c.nome, razaoSocial: alvo.nova, inscricaoEstadual: c.inscricaoEstadual, documento: c.documento, email: c.email,
          telefone: c.telefone, contato: c.contato, observacoes: c.observacoes, ativo: c.ativo, enderecos: [] }, autor, "LEGADO");
        const c2 = await tx.clienteVenda.findUniqueOrThrow({ where: { id: alvo.id } });
        if (semVolateis(c as never) !== semVolateis(c2 as never) || c2.razaoSocial !== alvo.nova) throw new Error(`O cadastro ${alvo.id} mudou além da razão social; nada foi alterado.`);
        const abertos = await tx.pedidoVenda.count({ where: { clienteId: c.id, status: { in: ["RASCUNHO", "CONFIRMADO"] } } });
        relatorio.push({ cliente: c.nome.slice(0, 24), versao: `${c.versao} → ${c2.versao}`, caracteres: `${alvo.antiga.length} → ${alvo.nova.length}`, razaoSocial: c2.razaoSocial, pedidosAbertos: abertos });
      }
      // Retrato de cobrança dos pedidos 98 e 99: mesma gravação de "Editar informações", que não troca o titular Principal.
      for (const numero of PEDIDOS.numeros) {
        const achado = await tx.pedidoVenda.findFirstOrThrow({ where: { numero, clienteId: PEDIDOS.clienteId }, select: { id: true } });
        await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${achado.id} FOR UPDATE`;
        const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: achado.id } }), cob = p.cobrancaSnapshot as Registro | null;
        const fiscais = await tx.documentoFiscalSaida.findMany({ where: { pedidoId: p.id }, select: { status: true, tentativas: true, referenciaProvedor: true, protocolo: true, acao: true } });
        if (p.status !== "CONFIRMADO" || !cob || cob.tipo !== "PJ" || cob.razaoSocial !== PEDIDOS.antiga
          || fiscais.some(f => !["PREPARADO", "SEM_EMISSOR"].includes(f.status) || f.tentativas || f.referenciaProvedor || f.protocolo || f.acao)) throw new Error(`Pedido ${numero} diverge da auditoria; nada foi alterado.`);
        const lista = Array.isArray(cob.enderecos) ? (cob.enderecos as Registro[]).map(e => e?.razaoSocial === PEDIDOS.antiga ? { ...e, razaoSocial: PEDIDOS.nova } : e) : undefined;
        const novo = { ...cob, razaoSocial: PEDIDOS.nova, ...(lista ? { enderecos: lista } : {}) };
        const foto = (cobranca: unknown) => JSON.parse(JSON.stringify({ previsaoData: p.previsaoData, previsaoJanela: p.previsaoJanela, prazo: p.prazo, cobrancaSnapshot: cobranca, destinatarioSnapshot: p.destinatarioSnapshot }));
        const chave = `operacao-unica:razao-social-60:${p.id}`;
        if ((await tx.pedidoVenda.updateMany({ where: { id: p.id, versao: p.versao }, data: { cobrancaSnapshot: novo as never, versao: { increment: 1 } } })).count !== 1) throw new Error(`O pedido ${numero} mudou durante a operação; nada foi alterado.`);
        await tx.historicoPedidoVenda.create({ data: { pedidoId: p.id, tipo: "INFORMACOES_ATUALIZADAS", chaveOperacao: chave, hashOperacao: createHash("sha256").update(JSON.stringify([chave, PEDIDOS.antiga, PEDIDOS.nova, u.id])).digest("hex"),
          usuarioId: u.id, usuarioNome: u.nome, versaoAnterior: p.versao, versaoNova: p.versao + 1, motivo: MOTIVO, antes: foto(cob), depois: foto(novo) } });
        const d = resolverDestinatarioBrasilNfe({ modelo: 55, indicadorPresenca: 2, comprador: p.compradorSnapshot, cobranca: novo, consumidorFinal: true });
        if (d.pendencias.some(x => x.includes("razão social"))) throw new Error(`O pedido ${numero} ainda acusa a razão social; nada foi alterado.`);
        relatorio.push({ pedido: numero, versao: `${p.versao} → ${p.versao + 1}`, destinatario: d.cliente?.NmCliente ?? null, pendencias: d.pendencias });
      }
      if (!aplicar) throw new Ensaio();
    }, { timeout: 60000 });
  } catch (e) { if (!(e instanceof Ensaio)) throw e; }
  finally { await bancoPrincipal.$disconnect(); }
  console.log(JSON.stringify({ modo: aplicar ? "APLICADO" : "ENSAIO_DESFEITO", relatorio }, null, 1));
}
void executar().catch(e => { console.error(e instanceof Error ? e.message : "Operação não confirmada."); process.exitCode = 1; });
