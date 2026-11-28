/** Operação única de 27/11/2026, pedida pelo responsável: a razão social do cliente do pedido 100
 * tinha 70 caracteres e a NF-e aceita 60. Abrevia a razão social no cadastro (serviço oficial) e
 * no retrato de cobrança do pedido 100, que não acompanha o cadastro. Não altera CNPJ, endereço,
 * valores nem documento fiscal; nada é transmitido. Sem `--aplicar` desfaz tudo ao final (ensaio).
 * Executar: node --conditions=react-server --import tsx scripts/cliente-razao-social-60-pedido100.ts <usuarioId> [--aplicar] */
import { createHash } from "node:crypto";

const CLIENTE = "cmv910sh300k2dtqtq5xh6rz4", PEDIDO = "cmwz06znf005z2dp232znjx8y", NUMERO = 100;
const ANTIGA = "OPERADOR NACIONAL DO SISTEMA DE REGISTRO ELETRONICO DE IMOVEIS ( ONR )";
const NOVA = "OPERADOR NAC. DO SISTEMA DE REGISTRO ELETRONICO DE IMOVEIS";
const MOTIVO = "Razão social abreviada para o limite de 60 caracteres da NF-e, a pedido do responsável.";
class Ensaio extends Error {}
type Registro = Record<string, unknown>;
const semVolateis = (r: Registro) => JSON.stringify({ ...r, razaoSocial: null, enderecos: null, versao: null, updatedAt: null });

async function executar() {
  const [usuarioId, modo] = process.argv.slice(2), aplicar = modo === "--aplicar";
  if (!usuarioId || !process.env.DATABASE_URL) throw new Error("Informe o usuário administrador e a conexão explícita do alvo.");
  if (NOVA.length > 60) throw new Error("Razão social nova acima de 60 caracteres.");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { salvarClienteNaTransacao } = await import("../src/lib/vendas/persistencia");
  const { resolverDestinatarioBrasilNfe } = await import("../src/lib/fiscal-saida/brasil-nfe-destinatario");
  let relatorio: unknown;
  try {
    await bancoPrincipal.$transaction(async tx => {
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, nome: true, ativo: true, perfilAcesso: { select: { sistema: true } } } });
      if (!u.ativo || u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new Error("Administrador ativo é obrigatório.");
      const autor = { userId: u.id, nome: u.nome };
      // Cadastro do cliente, pelo serviço oficial.
      const c = await tx.clienteVenda.findUniqueOrThrow({ where: { id: CLIENTE } }), ends = c.enderecos as Registro[];
      if (c.tipo !== "PJ" || c.razaoSocial !== ANTIGA || !Array.isArray(ends) || ends.length !== 1 || ends[0].razaoSocial !== ANTIGA) throw new Error("Cliente diverge da auditoria; nada foi alterado.");
      await salvarClienteNaTransacao(tx as never, { id: c.id, versao: c.versao, tipo: "PJ", tipoEscolhido: true, nome: c.nome, razaoSocial: NOVA, inscricaoEstadual: c.inscricaoEstadual, documento: c.documento, email: c.email,
        telefone: c.telefone, contato: c.contato, observacoes: c.observacoes, ativo: c.ativo, enderecos: [{ ...ends[0], razaoSocial: NOVA }] }, autor, "LEGADO");
      const c2 = await tx.clienteVenda.findUniqueOrThrow({ where: { id: CLIENTE } }), ends2 = c2.enderecos as Registro[];
      const { razaoSocial: r1, ...resto1 } = ends[0], { razaoSocial: r2, ...resto2 } = ends2[0];
      if (semVolateis(c as never) !== semVolateis(c2 as never) || c2.razaoSocial !== NOVA || r1 !== ANTIGA || r2 !== NOVA || ends2.length !== 1 || JSON.stringify(resto1) !== JSON.stringify(resto2)) throw new Error("O cadastro mudou além da razão social; nada foi alterado.");
      // Retrato de cobrança do pedido 100: mesma gravação de "Editar informações", que não troca o titular Principal.
      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${PEDIDO} FOR UPDATE`;
      const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: PEDIDO } }), cob = p.cobrancaSnapshot as Registro | null;
      const fiscais = await tx.documentoFiscalSaida.findMany({ where: { pedidoId: PEDIDO }, select: { status: true, tentativas: true, referenciaProvedor: true, protocolo: true, acao: true } });
      if (p.numero !== NUMERO || p.clienteId !== CLIENTE || p.status !== "CONFIRMADO" || !cob || cob.tipo !== "PJ" || cob.razaoSocial !== ANTIGA
        || fiscais.some(f => !["PREPARADO", "SEM_EMISSOR"].includes(f.status) || f.tentativas || f.referenciaProvedor || f.protocolo || f.acao)) throw new Error("Pedido diverge da auditoria; nada foi alterado.");
      const lista = Array.isArray(cob.enderecos) ? (cob.enderecos as Registro[]).map(e => e?.razaoSocial === ANTIGA ? { ...e, razaoSocial: NOVA } : e) : undefined;
      const novo = { ...cob, razaoSocial: NOVA, ...(lista ? { enderecos: lista } : {}) };
      const foto = (cobranca: unknown) => JSON.parse(JSON.stringify({ previsaoData: p.previsaoData, previsaoJanela: p.previsaoJanela, prazo: p.prazo, cobrancaSnapshot: cobranca, destinatarioSnapshot: p.destinatarioSnapshot }));
      const chave = `operacao-unica:razao-social-60:${PEDIDO}`;
      if ((await tx.pedidoVenda.updateMany({ where: { id: PEDIDO, versao: p.versao }, data: { cobrancaSnapshot: novo as never, versao: { increment: 1 } } })).count !== 1) throw new Error("O pedido mudou durante a operação; nada foi alterado.");
      await tx.historicoPedidoVenda.create({ data: { pedidoId: PEDIDO, tipo: "INFORMACOES_ATUALIZADAS", chaveOperacao: chave, hashOperacao: createHash("sha256").update(JSON.stringify([chave, ANTIGA, NOVA, u.id])).digest("hex"),
        usuarioId: u.id, usuarioNome: u.nome, versaoAnterior: p.versao, versaoNova: p.versao + 1, motivo: MOTIVO, antes: foto(cob), depois: foto(novo) } });
      const destinatario = (indicadorPresenca: number) => resolverDestinatarioBrasilNfe({ modelo: 55, indicadorPresenca, comprador: p.compradorSnapshot, cobranca: novo, consumidorFinal: true });
      const d = destinatario(2);
      relatorio = { cliente: { versao: `${c.versao} → ${c2.versao}`, caracteres: `${ANTIGA.length} → ${NOVA.length}` }, pedido: { numero: p.numero, versao: `${p.versao} → ${p.versao + 1}`, enderecosNoRetrato: lista?.length ?? 0 },
        destinatarioFiscal: { nome: d.cliente?.NmCliente ?? null, pendencias: d.pendencias } };
      if (d.pendencias.some(x => x.includes("razão social"))) throw new Error("O destinatário fiscal ainda acusa a razão social; nada foi alterado.");
      if (!aplicar) throw new Ensaio();
    }, { timeout: 60000 });
  } catch (e) { if (!(e instanceof Ensaio)) throw e; }
  finally { await bancoPrincipal.$disconnect(); }
  console.log(JSON.stringify({ modo: aplicar ? "APLICADO" : "ENSAIO_DESFEITO", relatorio }, null, 1));
}
void executar().catch(e => { console.error(e instanceof Error ? e.message : "Operação não confirmada."); process.exitCode = 1; });
