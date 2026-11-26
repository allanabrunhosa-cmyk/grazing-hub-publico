/** Operação única de 26/11/2026: a tentativa de NF-e do pedido 61 (nº 36, série 6) ficou em
 * PENDENTE_CONFERENCIA porque o emissor não conseguiu comunicar com a SEFAZ. O responsável
 * conferiu a chave no portal nacional da NF-e em 26/11/2026: não consta. A tentativa passa a
 * REJEITADO, o que permite preparar outra revisão; nada é transmitido por este script.
 * Antes de gravar, reconsulta o emissor (somente leitura) e exige a mesma evidência: situação 3,
 * não emitida, sem protocolo, mesma chave. Sem `--aplicar` desfaz tudo ao final (ensaio).
 * Executar: node --conditions=react-server --import tsx scripts/fiscal-saida-pedido61-tentativa-rejeitada.ts <usuarioId> [--aplicar] */
const DOCUMENTO = "cmww9g93t00gh2glfu8uzyg7y", PEDIDO = 61, NUMERO = "36", SERIE = "6";
const CHAVE = "35261134599471000180550060000000361040157376";
const ERRO = "O emissor não conseguiu comunicar com a SEFAZ nesta tentativa (nº 36, série 6). O responsável conferiu a chave no portal nacional da NF-e em 26/11/2026: não consta. Tentativa tratada como rejeitada; a nova emissão usa outra numeração. O nº 36 deve ser inutilizado na SEFAZ.";
class Ensaio extends Error {}

async function executar() {
  const [usuarioId, modo] = process.argv.slice(2), aplicar = modo === "--aplicar";
  if (!usuarioId || !process.env.DATABASE_URL) throw new Error("Informe o usuário administrador e a conexão explícita do alvo.");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { decifrar } = await import("../src/lib/crypto");
  const { rejeicaoFiscalCorrigivel } = await import("../src/lib/fiscal-saida/rejeicao");
  let relatorio: unknown;
  try {
    const c = await bancoPrincipal.configuracaoBrasilNfe.findUnique({ where: { id: "singleton" } });
    if (!c?.tokenCifrado) throw new Error("Emissor sem configuração.");
    const r = await fetch("https://api.brasilnfe.com.br/services/fiscal/ConsultarNotaFiscal", { method: "POST", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json", Token: decifrar(c.tokenCifrado, "grazing-hub-brasilnfe-token-v1") },
      body: JSON.stringify({ IdentificadorInterno: DOCUMENTO, ModeloDocumento: 55, TipoAmbiente: 1, RetornarArquivos: false }) });
    const e = await r.json() as { Encontrada?: boolean; Nota?: Record<string, unknown> | null; Historico?: unknown[] }, n = e.Nota;
    if (r.status !== 200 || e.Encontrada !== true || !n || e.Historico?.length !== 0 || n.Status !== 3 || n.Emitida !== false || n.NumeroProtocolo || n.CodStatusResposta !== 0
      || n.Chave !== CHAVE || String(n.Numero) !== NUMERO || String(n.Serie) !== SERIE || !/comunica..o com os servi.os da sefaz/i.test(String(n.DsStatusResposta))) throw new Error("O emissor não mostra mais a mesma evidência; nada foi alterado.");
    await bancoPrincipal.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, nome: true, ativo: true, perfilAcesso: { select: { sistema: true } } } });
      if (!u.ativo || u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new Error("Administrador ativo é obrigatório.");
      const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: DOCUMENTO }, include: { pedido: { select: { numero: true } } } });
      const outros = await tx.documentoFiscalSaida.count({ where: { pedidoId: d.pedidoId, id: { not: d.id }, ambiente: "PRODUCAO" } });
      if (d.pedido.numero !== PEDIDO || d.status !== "PENDENTE_CONFERENCIA" || d.provedor !== "BRASIL_NFE" || d.ambiente !== "PRODUCAO" || d.modeloDocumento !== 55 || d.tentativas !== 1
        || d.acao || d.leaseToken || d.protocolo || d.protocoloCancelamento || d.cancelamentoPendente || d.chaveFiscal || d.referenciaProvedor || outros) throw new Error("Documento diverge da auditoria; nada foi alterado.");
      const sequencia = Math.max(d.ultimaSequencia, d.ultimaSequenciaObservada) + 1;
      await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `conferencia-externa:${d.id}:rejeitado`, tipo: "RETORNO", dados: {
        documentoId: d.id, status: "REJEITADO", ordenacao: "LOCAL_OBSERVACAO", sequenciaLocal: sequencia, chave: CHAVE, referencia: CHAVE, numero: NUMERO, serie: SERIE, erro: ERRO,
        origem: "CONFERENCIA_EXTERNA_RESPONSAVEL", usuarioId: u.id, evidenciaEmissor: { situacao: 3, emitida: false, codigoResposta: 0, protocolo: null, motivo: "FALHA_COMUNICACAO_SEFAZ" }, evidenciaSefaz: "Portal nacional da NF-e em 26/11/2026: chave não consta (declarado pelo responsável)." } } });
      const novo = await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { status: "REJEITADO", ultimaSequencia: sequencia, ultimaSequenciaObservada: sequencia, referenciaProvedor: CHAVE, chaveFiscal: CHAVE, numero: NUMERO, serie: SERIE, ultimoErro: ERRO, acao: null, proximaTentativa: null } });
      relatorio = { pedido: PEDIDO, documento: d.id, status: `${d.status} → ${novo.status}`, sequencia: `${d.ultimaSequencia} → ${novo.ultimaSequencia}`, liberaNovaRevisao: rejeicaoFiscalCorrigivel(novo), autor: u.nome };
      if (!rejeicaoFiscalCorrigivel(novo)) throw new Error("Resultado não libera nova revisão; nada foi alterado.");
      if (!aplicar) throw new Ensaio();
    }, { timeout: 60000 });
  } catch (e) { if (!(e instanceof Ensaio)) throw e; }
  finally { await bancoPrincipal.$disconnect(); }
  console.log(JSON.stringify({ modo: aplicar ? "APLICADO" : "ENSAIO_DESFEITO", relatorio }, null, 1));
}
void executar().catch(e => { console.error(e instanceof Error ? e.message : "Operação não confirmada."); process.exitCode = 1; });
