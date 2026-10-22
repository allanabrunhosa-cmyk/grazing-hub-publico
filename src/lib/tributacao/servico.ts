import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type VersaoEstruturaFiscal } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import type { ClassificacaoFiscal, ComportamentoFiscal, DadosVersaoFiscal, ImpactoFiscal, PainelFiscal, PerfilFiscal, RegraFiscal, SalvarVersaoFiscalEntrada, TipoVersaoFiscal, VersaoFiscalDto } from "./tipos";
import { dataFiscal, ErroEstruturaFiscal, hojeFiscal, textoFiscal, validarDadosFiscais, validarSalvarVersaoFiscal } from "./validacao";
import { versoesVigentes } from "./motor";
import { excecaoBaseLiquidaComprovada } from "./preco-rtc-politica";
import { conferirConfiguracaoSemNcm, conferirVinculosCenariosNcm, sincronizarClassificacaoCadastro } from "./sincronizacao-cadastro";
import { chaveFiscalClassificacao, conferirReferenciaInterna } from "./referencia-interna";
import { conferirRepasseFciFornecedor } from "./fci-fornecedor";
import { conferirFotografiaFiscal, fotografarClassificacaoNormal, fotografarComponentesKit, fotografarMercadoriaOpcao, fotografarReceitaFiscal } from "./fotografia-tecnica";
import { AVISO_DECLARACAO_FCI, PRODUTO_DECLARACAO_FCI_GRAZING1, selarDeclaracaoResponsavelFci } from "./declaracao-fci";
import { hashRevisaoConsolidadaGrazing1, type VersaoSelecionadaRevisaoFiscal } from "./revisao-consolidada";
import { PENDENCIA_ORIGEM_GRAZING1, REFERENCIA_INSTRUCAO_GRAZING1, REGRA_DECLARACAO_FCI_GRAZING1, type EntradaDeclaracaoGrazing1 } from "./declaracao-fci-contrato";
export { hashRevisaoConsolidadaGrazing1 } from "./revisao-consolidada";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function hashFiscal(v: unknown): string {
  const ordenar = (x: unknown): unknown => Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenar(v)])) : x;
  return createHash("sha256").update(JSON.stringify(ordenar(v))).digest("hex");
}
export async function conferirAutorFiscal(tx: Prisma.TransactionClient, sessao: SessaoAtual, administrar = false) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, select: { id: true, nome: true, ativo: true, excluidoEm: true, sessaoVersao: true, permissoesPersonalizadas: true, perfilAcesso: { select: { sistema: true, permissoes: true } } } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroEstruturaFiscal("Sua sessão foi encerrada.");
  const administrador = u.perfilAcesso?.sistema === "ADMINISTRADOR";
  if (administrar && !administrador || !administrador && !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, u.permissoesPersonalizadas as Excecoes, "vendas.fiscal", "visualizar")) throw new ErroEstruturaFiscal("Seu acesso não permite esta operação fiscal.");
  return { userId: u.id, nome: u.nome, administrador };
}
async function conferirAlvoInternoRegra(tx: Prisma.TransactionClient, regra: RegraFiscal) {
  if (!regra.produtoId?.startsWith("INSUMO:")) return;
  const id = regra.produtoId.slice("INSUMO:".length);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new ErroEstruturaFiscal("Referência interna da regra inválida.");
  const insumo = await tx.insumo.findUnique({ where: { id }, select: { ativo: true, excluidoEm: true } });
  if (!insumo?.ativo || insumo.excluidoEm) throw new ErroEstruturaFiscal("Referência interna da regra inexistente, inativa ou excluída.");
}
export function dtoVersaoFiscal(v: VersaoEstruturaFiscal): VersaoFiscalDto {
  return { id: v.id, tipo: v.tipo as TipoVersaoFiscal, chave: v.chave, versao: v.versao, vigenciaInicio: v.vigenciaInicio.toISOString().slice(0, 10), status: v.status as "ATIVO" | "RASCUNHO", dados: v.dados as unknown as DadosVersaoFiscal, justificativa: v.justificativa, fontes: v.fontes as string[], criadoPorNome: v.criadoPorNome, createdAt: v.createdAt.toISOString(), hash: v.hash };
}
export async function consultarVersoesFiscais(tx: Prisma.TransactionClient, tipos?: TipoVersaoFiscal[]): Promise<VersaoFiscalDto[]> {
  return (await tx.versaoEstruturaFiscal.findMany({ ...(tipos ? { where: { tipo: { in: tipos } } } : {}), orderBy: [{ tipo: "asc" }, { chave: "asc" }, { versao: "desc" }] })).map(dtoVersaoFiscal);
}
export async function conferirVigenciaSnapshotFiscal(tx: Prisma.TransactionClient, payload: Prisma.JsonValue) {
  const t = (payload as { tributacao?: { previa?: { contexto?: { data?: string }; linhas?: { versoes?: string[] }[] } } }).tributacao;
  const data = t?.previa?.contexto?.data;
  if (data !== hojeFiscal()) throw new ErroEstruturaFiscal("Data fiscal mudou. Reprepare uma nova revisão fiscal; a fotografia anterior permanece no histórico.");
  const vigentes = versoesVigentes(await consultarVersoesFiscais(tx), data); const idsAtivos = new Set(vigentes.map(v => v.id));
  const idsSnapshot = t?.previa?.linhas?.flatMap(l => l.versoes ?? []) ?? [];
  if (!idsSnapshot.length || idsSnapshot.some(id => !idsAtivos.has(id))) throw new ErroEstruturaFiscal("Classificação ou regra mudou após a prévia. Reprepare antes de enviar, preservando a fotografia anterior.");
}
export async function salvarVersaoFiscal(entrada: SalvarVersaoFiscalEntrada, sessao: SessaoAtual) {
  return prisma.$transaction(tx => salvarVersaoFiscalNaTransacao(tx, entrada, sessao), { timeout: 30000 });
}
/** Registra a instrução específica na sessão normal. Não aprova a tributação,
 * não ativa a proposta, não modifica pedido e não executa transmissão. */
export async function registrarDeclaracaoGrazing1PelaInstrucao(entrada: EntradaDeclaracaoGrazing1, sessao: SessaoAtual) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada) || Object.keys(entrada).some(k => !["baseId", "baseHash", "referenciaInstrucao"].includes(k)) || typeof entrada.baseId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(entrada.baseId) || typeof entrada.baseHash !== "string" || !/^[a-f0-9]{64}$/.test(entrada.baseHash) || entrada.referenciaInstrucao !== REFERENCIA_INSTRUCAO_GRAZING1) throw new ErroEstruturaFiscal("Instrução específica de declaração administrativa inválida.");
  return prisma.$transaction(async tx => {
    await conferirAutorFiscal(tx, sessao, true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
    const base = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: PRODUTO_DECLARACAO_FCI_GRAZING1 }, orderBy: { versao: "desc" } });
    if (!base || base.id !== entrada.baseId || base.hash !== entrada.baseHash || hashFiscal(base.dados) !== base.hash) throw new ErroEstruturaFiscal("A proposta de Grazing para 1 mudou. Reabra a versão atual antes de registrar a declaração.");
    const c = validarDadosFiscais("CLASSIFICACAO", base.dados) as ClassificacaoFiscal, original = base.dados as unknown as ClassificacaoFiscal;
    if (!original.fotografiaTecnica || c.produtoId !== PRODUTO_DECLARACAO_FCI_GRAZING1 || c.tratamento !== "NORMAL") throw new ErroEstruturaFiscal("A declaração exige a identidade material já comprovada da apresentação Grazing para 1.");
    if (c.origem !== null) throw new ErroEstruturaFiscal("A origem fiscal deste produto já foi definida. A instrução antiga de 15/10/2026 não substitui a classificação atual; registre uma nova revisão fundamentada pelo formulário.");
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { cnpj: true } }), cnpj = loja?.cnpj?.replace(/\D/g, "");
    if (!cnpj || !/^\d{14}$/.test(cnpj)) throw new ErroEstruturaFiscal("Emitente cadastrado ausente para delimitar a declaração.");
    const vigencia = hojeFiscal();
    c.origem = "5"; c.gtin = "SEM GTIN"; c.pendencias = c.pendencias.filter(p => p !== PENDENCIA_ORIGEM_GRAZING1); c.estado = c.pendencias.length ? "PENDENTE" : "CONFIRMADO";
    c.fci = { ...(c.fci ?? { numero: null, periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, justificativa: AVISO_DECLARACAO_FCI, fontes: [], evidencias: [] }), situacao: "DISPENSADA_POR_DECLARACAO_RESPONSAVEL",
      declaracaoResponsavel: { tipo: "ORIGEM_FCI_GTIN", produtoId: c.produtoId, estabelecimento: "singleton", emitenteCnpj: cnpj, materiaisHash: hashFiscal(original.fotografiaTecnica.materiais), classificacaoBase: { id: base.id, hash: base.hash, versao: base.versao }, vigenciaInicio: vigencia, ufEmitente: "SP", ufDestino: "SP", modelos: ["55"], ambientes: ["HOMOLOGACAO", "PRODUCAO"], origem: "5", gtin: "SEM GTIN", reaproveitamento65: "EXIGE_HOMOLOGACAO_PROPRIA", referenciaInstrucao: entrada.referenciaInstrucao, executorModo: "AUTOMACAO_ASSISTIDA" } };
    if (c.fci.numero || c.fci.apuracaoCompleta || c.fci.dispensa) throw new ErroEstruturaFiscal("Existe decisão ou apuração anterior incompatível. Preserve sua revisão; não substituir pelo registro administrativo.");
    const classificacao = await salvarVersaoFiscalNaTransacao(tx, { tipo: "CLASSIFICACAO", chave: c.produtoId, versaoBase: base.versao, vigenciaInicio: vigencia, dados: c, justificativa: `${AVISO_DECLARACAO_FCI} Instrução expressa de 15/10/2026. Demais parâmetros aguardam revisão e aprovação interna consolidadas. Base preservada: ${base.id}.`, fontes: [...new Set([...(base.fontes as string[]), entrada.referenciaInstrucao])], chaveOperacao: randomUUID() }, sessao);
    const regra = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "REGRA", chave: REGRA_DECLARACAO_FCI_GRAZING1 }, orderBy: { versao: "desc" } });
    let regraId = regra?.id ?? null, regraProspectivaCriada = false;
    if (regra && regra.vigenciaInicio.toISOString().slice(0, 10) < vigencia) {
      const dados = validarDadosFiscais("REGRA", regra.dados) as RegraFiscal;
      if (regra.hash !== hashFiscal(regra.dados) || dados.produtoId !== PRODUTO_DECLARACAO_FCI_GRAZING1 || dados.estabelecimento !== "singleton" || dados.ufDestino !== "SP") throw new ErroEstruturaFiscal("A regra específica mudou ou não pertence à operação revisada. Preserve o histórico e confira a proposta atual.");
      const nova = await salvarVersaoFiscalInterna(tx, { tipo: "REGRA", chave: regra.chave, versaoBase: regra.versao, vigenciaInicio: vigencia, dados, justificativa: regra.justificativa, fontes: regra.fontes as string[], chaveOperacao: randomUUID() }, sessao, { propostaProspectiva: { baseId: regra.id, baseHash: regra.hash, vigenciaAnterior: regra.vigenciaInicio.toISOString().slice(0, 10), vigenciaInicio: vigencia, hashConteudo: regra.hash, historicoPreservado: true, aprovacaoInterna: false, referenciaInstrucao: entrada.referenciaInstrucao } });
      regraId = nova.id; regraProspectivaCriada = true;
    }
    return { ...classificacao, regraId, regraProspectivaCriada };
  }, { timeout: 30000 });
}
/** Uso interno de cargas administrativas: reutiliza todas as guardas e auditorias na transação do lote. */
export async function salvarVersaoFiscalNaTransacao(tx: Prisma.TransactionClient, entrada: SalvarVersaoFiscalEntrada, sessao: SessaoAtual) {
  return salvarVersaoFiscalInterna(tx, entrada, sessao);
}
type ContextoRascunhoFiscal = { propostaProspectiva: { baseId: string; baseHash: string; vigenciaAnterior: string; vigenciaInicio: string; hashConteudo: string; historicoPreservado: true; aprovacaoInterna: false; referenciaInstrucao: string } };
async function salvarVersaoFiscalInterna(tx: Prisma.TransactionClient, entrada: SalvarVersaoFiscalEntrada, sessao: SessaoAtual, contexto?: ContextoRascunhoFiscal) {
  const d = validarSalvarVersaoFiscal(entrada); const hashOperacao = hashFiscal(d);
  if (d.vigenciaInicio < hojeFiscal()) throw new ErroEstruturaFiscal("Correções fiscais exigem vigência atual ou futura; documentos históricos são preservados.");
    const autor = await conferirAutorFiscal(tx, sessao, true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
    const anterior = await tx.versaoEstruturaFiscal.findUnique({ where: { chaveOperacao: d.chaveOperacao } });
    if (anterior) { if (anterior.hashOperacao !== hashOperacao || anterior.criadoPorId !== autor.userId) throw new ErroEstruturaFiscal("Chave de operação reutilizada com conteúdo diferente."); return { id: anterior.id }; }
    const ultima = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: d.tipo, chave: d.chave }, orderBy: { versao: "desc" } });
    if ((ultima?.versao ?? 0) !== d.versaoBase) throw new ErroEstruturaFiscal("Existe uma versão mais recente. Atualize o painel antes de salvar.");
    let idDeclaracao: string | undefined;
    if (d.tipo === "CLASSIFICACAO") {
      const c = d.dados as ClassificacaoFiscal;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
      await conferirReferenciaInterna(tx, c);
      if (c.produtoId) {
        const produto = await tx.produtoVenda.findUnique({ where: { id: c.produtoId }, select: { unidade: true } });
        if (!produto) throw new ErroEstruturaFiscal("Produto fiscal inexistente.");
        if (c.estado === "CONFIRMADO" && c.tratamento === "NORMAL" && c.unidade !== produto.unidade) throw new ErroEstruturaFiscal("Unidade fiscal deve corresponder à unidade comercial; conversão distinta exige evidência e fator próprios antes de emitir.");
      }
      if (c.componentesKit) {
        const produtos = [...new Set(c.componentesKit.map(k => k.produtoId).filter((id): id is string => !!id))];
        const insumos = [...new Set(c.componentesKit.map(k => k.referenciaInternaInsumoId).filter((id): id is string => !!id))];
        if (await tx.produtoVenda.count({ where: { id: { in: produtos } } }) !== produtos.length || await tx.insumo.count({ where: { id: { in: insumos }, ativo: true, excluidoEm: null } }) !== insumos.length) throw new ErroEstruturaFiscal("Kit contém mercadoria ou referência interna inexistente/inativa.");
        await fotografarComponentesKit(tx, c, false, d.vigenciaInicio);
      }
      if (c.configuracaoNcm) { await conferirVinculosCenariosNcm(tx, c); c.configuracaoNcm.fotografiaTecnica = await fotografarReceitaFiscal(tx, c); }
      else if ((c.analiseNcm || c.fci?.repasseFornecedor) && c.tratamento === "NORMAL") c.fotografiaTecnica = await fotografarClassificacaoNormal(tx, c);
      if (c.fci?.repasseFornecedor) c.fci.repasseFornecedor = await conferirRepasseFciFornecedor(tx, c, d.vigenciaInicio);
      if (c.fci?.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL") {
        const declaracao = c.fci.declaracaoResponsavel!, base = ultima?.dados as unknown as ClassificacaoFiscal | undefined;
        const anterior = base?.fci?.declaracaoResponsavel;
        const reutilizada = !!anterior?.registro && declaracao.registro?.hashConteudo === anterior.registro.hashConteudo && hashFiscal(declaracao) === hashFiscal(anterior);
        if (!ultima || !base || declaracao.classificacaoBase.id !== ultima.id && !reutilizada || declaracao.classificacaoBase.hash !== ultima.hash && !reutilizada || declaracao.classificacaoBase.versao !== ultima.versao && !reutilizada
          || c.produtoId !== declaracao.produtoId || c.origem !== "5" || c.gtin !== "SEM GTIN" || d.vigenciaInicio < declaracao.vigenciaInicio || !c.fotografiaTecnica || hashFiscal(c.fotografiaTecnica.materiais) !== declaracao.materiaisHash) throw new ErroEstruturaFiscal("Declaração administrativa não corresponde à versão e identidade material deste produto.");
        const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { cnpj: true } });
        if (loja?.cnpj?.replace(/\D/g, "") !== declaracao.emitenteCnpj) throw new ErroEstruturaFiscal("Declaração administrativa não corresponde ao emitente cadastrado.");
        if (base.fci) for (const campo of ["periodoApuracao", "conteudoImportacao", "valorParcelaImportada", "valorSaidaReferencia", "apuracaoCompleta", "fontes", "evidencias"] as const) if (hashFiscal(c.fci[campo]) !== hashFiscal(base.fci[campo])) throw new ErroEstruturaFiscal("A declaração não pode substituir a memória de CI, fontes ou evidências anteriores.");
        if (!reutilizada && declaracao.registro) throw new ErroEstruturaFiscal("A autoria da declaração é registrada pelo servidor; não envie um selo de outra versão.");
        idDeclaracao = randomUUID();
        c.fci.declaracaoResponsavel = selarDeclaracaoResponsavelFci(declaracao, { id: idDeclaracao, numero: d.versaoBase + 1 }, autor, new Date().toISOString());
      }
    }
    if (d.tipo === "CLASSIFICACAO" || d.tipo === "REGRA") {
      const grupoId = (d.dados as ClassificacaoFiscal | RegraFiscal).grupoFiscalId;
      const encerrarRegra = d.tipo === "REGRA" && (d.dados as RegraFiscal).habilitada === false;
      if (grupoId && !await tx.grupoFiscalVenda.findFirst({ where: { id: grupoId, ...(encerrarRegra ? {} : { ativo: true }) }, select: { id: true } })) throw new ErroEstruturaFiscal("Grupo fiscal cadastrado inativo ou inexistente.");
    }
    if (d.tipo === "REGRA") await conferirAlvoInternoRegra(tx, d.dados as RegraFiscal);
    if (d.tipo === "COMPLEMENTO") {
      const c = d.dados as ComportamentoFiscal; const o = await tx.opcaoComplementoVenda.findUnique({ where: { id: c.opcaoId } });
      if (!o || c.comportamento === "MERCADORIA" && o.produtoId !== c.produtoId && !c.escolhas?.length) throw new ErroEstruturaFiscal("Complemento e mercadoria não correspondem ao catálogo.");
      if (c.escolhas) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`; Object.assign(c, await fotografarMercadoriaOpcao(tx, c)); }
    }
    if (d.tipo === "PERFIL") {
      const p = d.dados as PerfilFiscal; const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { cnpj: true } });
      if (p.estabelecimento !== "singleton" || loja?.cnpj?.replace(/\D/g, "") !== p.cnpj) throw new ErroEstruturaFiscal("Perfil deve corresponder ao estabelecimento cadastrado.");
      if (p.regime === "LUCRO_PRESUMIDO" && d.vigenciaInicio < "2027-01-01") throw new ErroEstruturaFiscal("Não antecipar o regime de 2027.");
    }
    const v = await tx.versaoEstruturaFiscal.create({ data: { ...(idDeclaracao ? { id: idDeclaracao } : {}), tipo: d.tipo, chave: d.chave, versao: d.versaoBase + 1, vigenciaInicio: new Date(`${d.vigenciaInicio}T00:00:00Z`), dados: json(d.dados), hash: hashFiscal(d.dados), justificativa: d.justificativa, fontes: json(d.fontes), criadoPorId: autor.userId, criadoPorNome: autor.nome, chaveOperacao: d.chaveOperacao, hashOperacao } });
    await tx.eventoEstruturaFiscal.create({ data: { versaoId: v.id, tipo: "RASCUNHO", chaveOperacao: `rascunho-${v.id}`, usuarioId: autor.userId, usuarioNome: autor.nome, dados: json({ hash: v.hash, vigenciaInicio: d.vigenciaInicio, versaoBase: d.versaoBase,
      ...(idDeclaracao ? { declaracaoResponsavel: { hashConteudo: v.hash, declaracao: (d.dados as ClassificacaoFiscal).fci!.declaracaoResponsavel, aviso: AVISO_DECLARACAO_FCI, aprovacaoDemaisParametros: false } } : {}), ...(contexto ? { propostaProspectiva: contexto.propostaProspectiva } : {}) }) } });
    return { id: v.id };
}
async function impacto(tx: Prisma.TransactionClient, id: string): Promise<ImpactoFiscal> {
  const v = await tx.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id } });
  const todos = await tx.produtoVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true, versao: true } });
  const cadastroFiscal = v.tipo === "CLASSIFICACAO" ? await tx.$queryRaw<{ fiscalTexto: string; grupoFiscalId: string | null; fiscalRevisado: boolean; versao: number }[]>`SELECT fiscal::text AS "fiscalTexto","grupoFiscalId","fiscalRevisado",versao FROM "ProdutoVenda" WHERE id=${v.chave}` : [];
  const vigentes = versoesVigentes(await consultarVersoesFiscais(tx, ["CLASSIFICACAO", "COMPLEMENTO"]), v.vigenciaInicio.toISOString().slice(0, 10));
  const classificacoes = vigentes.filter(v => v.tipo === "CLASSIFICACAO");
  const d = v.dados as Record<string, unknown>;
  let ids = todos.map(p => p.id);
  if (v.tipo === "CLASSIFICACAO") ids = [v.chave];
  if (v.tipo === "COMPLEMENTO") ids = (await tx.produtoGrupoVenda.findMany({ where: { grupo: { opcoes: { some: { id: v.chave } } } }, select: { produtoId: true } })).map(p => p.produtoId);
  if (v.tipo === "REGRA") {
    const anterior = versoesVigentes(await consultarVersoesFiscais(tx, ["REGRA"]), v.vigenciaInicio.toISOString().slice(0, 10)).find(a => a.chave === v.chave)?.dados as RegraFiscal | undefined;
    const alcances = [d as unknown as RegraFiscal, ...(anterior ? [anterior] : [])];
    ids = classificacoes.filter(x => { const c = x.dados as ClassificacaoFiscal; return alcances.some(r => (!r.produtoId || r.produtoId === chaveFiscalClassificacao(c)) && (!r.grupo || r.grupo === c.grupo) && (!r.grupoFiscalId || r.grupoFiscalId === c.grupoFiscalId) && (!r.ncm || r.ncm === c.ncm) && (!r.natureza || r.natureza === c.natureza)); }).map(x => x.chave);
  }
  // Inclui dependências comerciais indiretas, sem confundir ficha de insumos com kit.
  const afetados = new Set(ids);
  let expandiu = true;
  while (expandiu) {
    expandiu = false;
    for (const k of classificacoes) { const c = k.dados as ClassificacaoFiscal; if (c.produtoId && c.componentesKit?.some(p => afetados.has(p.produtoId ?? `INSUMO:${p.referenciaInternaInsumoId}`)) && !afetados.has(c.produtoId)) { afetados.add(c.produtoId); expandiu = true; } }
    const opcoes = vigentes.filter(v => v.tipo === "COMPLEMENTO" && (v.dados as ComportamentoFiscal).comportamento === "MERCADORIA" && afetados.has((v.dados as ComportamentoFiscal).produtoId ?? "")).map(v => v.chave);
    if (opcoes.length) for (const p of await tx.produtoGrupoVenda.findMany({ where: { grupo: { opcoes: { some: { id: { in: opcoes } } } } }, select: { produtoId: true } })) if (!afetados.has(p.produtoId)) { afetados.add(p.produtoId); expandiu = true; }
  }
  ids = [...afetados];
  const produtos = todos.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, nome: p.nome, motivos: [`${v.tipo.toLowerCase()} ${v.chave}, versão ${v.versao}, vigência ${v.vigenciaInicio.toISOString().slice(0, 10)}.`] }));
  const documentosPreservados = await tx.documentoFiscalSaida.count();
  const resumo = [`${produtos.length} produto(s) ativo(s) no alcance da alteração.`, `${documentosPreservados} fotografia(s) fiscal(is) preservada(s) integralmente.`, "Ativação não transmite documentos, altera preços, movimenta estoque ou habilita autoemissão."];
  const versoes = await tx.versaoEstruturaFiscal.findMany({ select: { id: true, hash: true, status: true } });
  if (v.tipo === "CLASSIFICACAO" && Object.hasOwn(d, "grupoFiscalId")) resumo.push("A ficha aplica a versão do motor. O cadastro comercial anterior permanece preservado para comparação, sem cópia dos parâmetros.");
  else if (v.tipo === "CLASSIFICACAO" && (v.dados as unknown as ClassificacaoFiscal).analiseNcm) resumo.push("Classificação vigente atualiza somente NCM concluído, aplicabilidade, vínculo de grupo e rastreabilidade no cadastro; parâmetros tributários e códigos antigos de identidade N/A são preservados.");
  return { hash: hashFiscal({ v: v.hash, status: v.status, todos, cadastroFiscal, versoes, documentosPreservados, produtos }), produtosAfetados: produtos.length, documentosPreservados, produtos, resumo };
}
export async function analisarImpactoFiscal(id: string, sessao: SessaoAtual) {
  return prisma.$transaction(tx => analisarImpactoFiscalNaTransacao(tx, id, sessao), { timeout: 30000 });
}
export async function analisarImpactoFiscalNaTransacao(tx: Prisma.TransactionClient, id: string, sessao: SessaoAtual) {
  textoFiscal(id, "Versão", 100);
  const a = await conferirAutorFiscal(tx, sessao, true); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`; const r = await impacto(tx, id); await tx.eventoEstruturaFiscal.create({ data: { versaoId: id, tipo: "IMPACTO", chaveOperacao: `impacto-${randomUUID()}`, usuarioId: a.userId, usuarioNome: a.nome, dados: json(r) } }); return r;
}
export async function ativarVersaoFiscal(id: string, hashImpacto: string, chaveOperacao: string, sessao: SessaoAtual) {
  return prisma.$transaction(tx => ativarVersaoFiscalNaTransacao(tx, id, hashImpacto, chaveOperacao, sessao), { timeout: 30000 });
}
/** Chamado somente pelo ato explícito de aprovação do usuário. Não é preparação
 * nem autorização de transmissão; preserva versões e todas as guardas existentes. */
export async function aprovarRevisaoConsolidadaNaTransacao(tx: Prisma.TransactionClient, selecionadas: VersaoSelecionadaRevisaoFiscal[], hashRevisao: string, sessao: SessaoAtual) {
  if (hashRevisaoConsolidadaGrazing1(selecionadas) !== hashRevisao) throw new ErroEstruturaFiscal("A revisão consolidada mudou. Confira novamente os parâmetros e versões.");
  await conferirAutorFiscal(tx, sessao, true);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
  const versoes = await tx.versaoEstruturaFiscal.findMany({ where: { id: { in: selecionadas.map(v => v.id) } } });
  if (versoes.length !== selecionadas.length || new Set(versoes.map(v => v.tipo)).size !== versoes.length) throw new ErroEstruturaFiscal("Selecionar somente uma classificação e uma regra específicas do produto.");
  for (const v of versoes) {
    const dados = v.dados as unknown as ClassificacaoFiscal | RegraFiscal;
    if (!["CLASSIFICACAO", "REGRA"].includes(v.tipo) || dados.produtoId !== PRODUTO_DECLARACAO_FCI_GRAZING1 || v.hash !== selecionadas.find(s => s.id === v.id)?.hash || hashFiscal(v.dados) !== v.hash) throw new ErroEstruturaFiscal("A revisão consolidada não abrange outra mercadoria ou conteúdo alterado.");
    if (v.tipo === "REGRA" && ((dados as RegraFiscal).estabelecimento !== "singleton" || (dados as RegraFiscal).ufDestino !== "SP")) throw new ErroEstruturaFiscal("A regra da revisão consolidada exige estabelecimento singleton e venda interna em SP.");
    if (v.status === "RASCUNHO" && v.vigenciaInicio.toISOString().slice(0, 10) < hojeFiscal()) throw new ErroEstruturaFiscal("Proposta com vigência passada: salvar nova versão prospectiva antes da revisão consolidada; não reescrever o histórico.");
    const ultima = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: v.tipo, chave: v.chave }, orderBy: { versao: "desc" } });
    if (ultima?.id !== v.id) throw new ErroEstruturaFiscal("Existe proposta mais recente. Atualize a revisão consolidada.");
  }
  for (const v of versoes.sort((a, b) => a.tipo.localeCompare(b.tipo))) {
    if (v.status === "ATIVO") continue;
    const analise = await analisarImpactoFiscalNaTransacao(tx, v.id, sessao);
    await ativarVersaoFiscalNaTransacao(tx, v.id, analise.hash, randomUUID(), sessao, { hash: hashRevisao, versoes: selecionadas, transmissaoAutorizada: false });
  }
  return { hash: hashRevisao, versoes: selecionadas };
}
type ContextoRevisaoConsolidadaFiscal = { hash: string; versoes: VersaoSelecionadaRevisaoFiscal[]; transmissaoAutorizada: false };
export async function ativarVersaoFiscalNaTransacao(tx: Prisma.TransactionClient, id: string, hashImpacto: string, chaveOperacao: string, sessao: SessaoAtual, contextoRevisao?: ContextoRevisaoConsolidadaFiscal) {
  textoFiscal(id, "Versão", 100); if (!/^[a-f0-9]{64}$/.test(hashImpacto) || !/^[a-zA-Z0-9_-]{1,100}$/.test(chaveOperacao)) throw new ErroEstruturaFiscal("Análise de impacto ou chave de operação inválida.");
    if (contextoRevisao && (contextoRevisao.transmissaoAutorizada !== false || hashRevisaoConsolidadaGrazing1(contextoRevisao.versoes) !== contextoRevisao.hash)) throw new ErroEstruturaFiscal("Contexto de revisão consolidada inválido.");
    const a = await conferirAutorFiscal(tx, sessao, true); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
    const anterior = await tx.eventoEstruturaFiscal.findUnique({ where: { chaveOperacao } });
    if (anterior) { if (anterior.versaoId !== id || (anterior.dados as { hashImpacto?: string }).hashImpacto !== hashImpacto || anterior.usuarioId !== a.userId) throw new ErroEstruturaFiscal("Operação de ativação divergente."); return { id }; }
    const v = await tx.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id } });
    if (contextoRevisao && !contextoRevisao.versoes.some(s => s.id === id && s.hash === v.hash)) throw new ErroEstruturaFiscal("A versão não corresponde à revisão consolidada aprovada.");
    if (["CLASSIFICACAO", "REGRA"].includes(v.tipo)) {
      const grupoId = (v.dados as unknown as ClassificacaoFiscal | RegraFiscal).grupoFiscalId;
      const encerrarRegra = v.tipo === "REGRA" && (v.dados as unknown as RegraFiscal).habilitada === false;
      if (grupoId && !await tx.grupoFiscalVenda.findFirst({ where: { id: grupoId, ...(encerrarRegra ? {} : { ativo: true }) }, select: { id: true } })) throw new ErroEstruturaFiscal("Grupo fiscal cadastrado inativo ou inexistente. Revise a ficha antes de aplicar.");
    }
    const dataAtivacao = hojeFiscal();
    if (v.status !== "RASCUNHO" || v.vigenciaInicio.toISOString().slice(0, 10) < dataAtivacao) throw new ErroEstruturaFiscal("A versão deve ser um rascunho de vigência atual ou futura.");
    if (v.tipo === "CLASSIFICACAO") await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    const atual = await impacto(tx, id); if (atual.hash !== hashImpacto) throw new ErroEstruturaFiscal("Catálogo ou configuração mudou. Execute novamente a análise de impacto.");
    const p = v.dados as unknown as PerfilFiscal;
    if (v.tipo === "REGRA") {
      const regra = v.dados as unknown as RegraFiscal;
      await conferirAlvoInternoRegra(tx, regra);
      const data = v.vigenciaInicio.toISOString().slice(0, 10);
      const perfil = versoesVigentes(await consultarVersoesFiscais(tx, ["PERFIL"]), data).find(p => p.tipo === "PERFIL" && p.chave === regra.estabelecimento)?.dados as PerfilFiscal | undefined;
      if (regra.reforma?.preco2027?.baseIcms === "LIQUIDA_RTC" && (!perfil || !excecaoBaseLiquidaComprovada(regra, perfil.uf, data, v.fontes as string[]))) throw new ErroEstruturaFiscal("Base ICMS líquida exige exceção normativa oficial com UF e vigência antes de ativar.");
    }
    if (v.tipo === "PERFIL" && (!p.confirmado || !p.evidenciaEnquadramento)) throw new ErroEstruturaFiscal("Confirme o enquadramento cadastral antes de ativar este perfil.");
    // O perfil seleciona o provedor das operações do HUB, com aprovação auditada.
    // Não altera a integração Takeat nem habilita envio. A liberação pertence às
    // guardas operacionais por ambiente/documento e ao bloqueio de transmissão.
    if (v.tipo === "CLASSIFICACAO") {
      const c = v.dados as unknown as ClassificacaoFiscal;
      if (c.fci?.repasseFornecedor && hashFiscal(await conferirRepasseFciFornecedor(tx, c, v.vigenciaInicio.toISOString().slice(0, 10))) !== hashFiscal(c.fci.repasseFornecedor)) throw new ErroEstruturaFiscal("A prova FCI do fornecedor mudou. Salve nova versão e refaça a análise de impacto.");
      const declaracao = (v.dados as unknown as ClassificacaoFiscal).fci?.declaracaoResponsavel;
      if (declaracao) {
        const evento = await tx.eventoEstruturaFiscal.findFirst({ where: { versaoId: v.id, tipo: "RASCUNHO" }, orderBy: { createdAt: "desc" } });
        const prova = (evento?.dados as { declaracaoResponsavel?: { hashConteudo?: unknown; declaracao?: unknown } } | undefined)?.declaracaoResponsavel;
        if (declaracao.registro?.versaoId !== v.id || declaracao.registro.versao !== v.versao || prova?.hashConteudo !== v.hash || !prova?.declaracao || hashFiscal(prova.declaracao) !== hashFiscal(declaracao)) throw new ErroEstruturaFiscal("A declaração do responsável exige registro auditado correspondente à versão e ao conteúdo.");
      }
      const vigentes = versoesVigentes(await consultarVersoesFiscais(tx, ["CLASSIFICACAO", "COMPLEMENTO"]), v.vigenciaInicio.toISOString().slice(0, 10));
      await conferirConfiguracaoSemNcm(tx, v.dados as unknown as ClassificacaoFiscal, vigentes);
      await conferirVinculosCenariosNcm(tx, v.dados as unknown as ClassificacaoFiscal, vigentes);
      await conferirReferenciaInterna(tx, v.dados as unknown as ClassificacaoFiscal);
      await conferirFotografiaFiscal(tx, v.dados as unknown as ClassificacaoFiscal);
      if ((v.dados as unknown as ClassificacaoFiscal).analiseNcm) await fotografarComponentesKit(tx, v.dados as unknown as ClassificacaoFiscal, true, v.vigenciaInicio.toISOString().slice(0,10));
    }
    if (v.tipo === "COMPLEMENTO" && (v.dados as unknown as ComportamentoFiscal).escolhas) {
      const c = v.dados as unknown as ComportamentoFiscal;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
      const atual = await fotografarMercadoriaOpcao(tx, c);
      if (hashFiscal(atual.receitaFotografada) !== hashFiscal(c.receitaFotografada) || atual.fotografiaOpcaoOrigem !== c.fotografiaOpcaoOrigem) throw new ErroEstruturaFiscal("Receita da mercadoria adicional mudou; salvar nova versão fundamentada.");
    }
    const ativada = await tx.versaoEstruturaFiscal.update({ where: { id }, data: { status: "ATIVO" } });
    const sincronizacaoCadastro = await sincronizarClassificacaoCadastro(tx, ativada, a, dataAtivacao, versoesVigentes(await consultarVersoesFiscais(tx, ["CLASSIFICACAO", "COMPLEMENTO"]), dataAtivacao));
    await tx.eventoEstruturaFiscal.create({ data: { versaoId: id, tipo: "ATIVACAO", chaveOperacao, usuarioId: a.userId, usuarioNome: a.nome, dados: json({ hashImpacto, hashConteudo: v.hash, produtosAfetados: atual.produtosAfetados, documentosPreservados: atual.documentosPreservados, sincronizacaoCadastro, ...(contextoRevisao ? { revisaoConsolidada: contextoRevisao } : {}) }) } });
    if (hojeFiscal() !== dataAtivacao) throw new ErroEstruturaFiscal("Data fiscal mudou durante a ativação; refazer a análise de impacto.");
    return { id };
}
export async function consultarPainelFiscal(sessao: SessaoAtual, opcoesLeitura: { tabelas?: boolean; evidenciasEntrada?: boolean } = {}): Promise<PainelFiscal> {
  return prisma.$transaction(async tx => {
    const a = await conferirAutorFiscal(tx, sessao); const versoes = await consultarVersoesFiscais(tx, opcoesLeitura.tabelas === false ? ["PERFIL", "CLASSIFICACAO", "REGRA", "COMPLEMENTO"] : undefined); const vigentes = versoesVigentes(versoes, hojeFiscal());
    const produtosDb = await tx.produtoVenda.findMany({ where: { ativo: true }, include: { componentes: { include: { insumo: { select: { nome: true, tipo: true } } } } }, orderBy: { nome: "asc" } });
    const grupos = await tx.grupoFiscalVenda.findMany({ select: { id: true, nome: true, ativo: true, codigo: true }, orderBy: { nome: "asc" } });
    const produtos: PainelFiscal["produtos"] = produtosDb.map(p => { const v = vigentes.find(v => v.tipo === "CLASSIFICACAO" && v.chave === p.id); const c = v?.dados as ClassificacaoFiscal | undefined; const config = c?.tratamento === "OPCAO_CONFIGURACAO"; const pendencias = c ? [...c.pendencias, ...(c.estado === "CONFIRMADO" || c.pendencias.length ? [] : ["Conferência técnica individual pendente."])] : ["Classificação fiscal versionada ausente."]; return { id: p.id, codigo: p.codigo, nome: p.nome, tipo: p.tipo, papeis: p.classificacoes, grupo: c?.grupo ?? null, ncm: c?.ncm ?? null, ncmAplicabilidade: c?.ncmAplicabilidade, analiseNcm: c?.analiseNcm, configuracaoNcm: c?.configuracaoNcm, status: config ? "CONFIGURACAO" : c?.estado === "CONFIRMADO" && !pendencias.length ? "APTO" : "PENDENTE", pendencias, evidencias: c?.evidencias ?? [], composicao: p.componentes.map(k => ({ insumoId: k.insumoId, nome: k.insumo.nome, tipo: k.insumo.tipo, quantidade: k.quantidade.toString(), unidade: k.unidade })) }; });
    const insumoIds = [...new Set(produtosDb.flatMap(p => p.componentes.map(c => c.insumoId)))];
    const notas = opcoesLeitura.evidenciasEntrada === false ? [] : await tx.notaFiscalItem.findMany({ where: { insumoId: { in: insumoIds }, ncm: { not: null } }, select: { id: true, insumoId: true, ncm: true, descricaoProduto: true }, orderBy: { id: "asc" } });
    const entradas: PainelFiscal["entradas"] = produtosDb.flatMap(p => p.componentes.flatMap(c => notas.filter(n => n.insumoId === c.insumoId && /^\d{8}$/.test(n.ncm ?? "")).map(n => ({ produtoId: p.id, insumoId: c.insumoId, insumo: c.insumo.nome, ncm: n.ncm!, descricao: n.descricaoProduto, evidencia: `nfe-item:${n.id}` }))));
    const opcoes = (await tx.opcaoComplementoVenda.findMany({ where: { ativo: true }, select: { id: true, nome: true, produtoId: true, grupoId: true, grupo: { select: { nome: true, produtos: { where: { produto: { ativo: true } }, select: { produtoId: true } } } } }, orderBy: { nome: "asc" } })).map(o => ({ id: o.id, nome: o.nome, produtoId: o.produtoId, grupo: o.grupo.nome, grupoId: o.grupoId, produtoPrincipalIds: o.grupo.produtos.map(p => p.produtoId) }));
    const insumos = await tx.insumo.findMany({ where: { ativo: true, excluidoEm: null }, select: { id: true, nome: true, tipo: true, unidade: true }, orderBy: { nome: "asc" } });
    return { produtos, versoes, grupos, entradas, administrador: a.administrador, opcoes, insumos, resumo: { ativos: produtos.length, aptos: produtos.filter(p => p.status === "APTO").length, pendentes: produtos.filter(p => p.status === "PENDENTE").length, configuracoes: produtos.filter(p => p.status === "CONFIGURACAO").length } };
  }, { timeout: 30000 });
}
/** Importa códigos declarados no documento oficial, sem inferir classificação de produto. */
export function converterTabelaNcmOficial(entrada: unknown, naData: string) {
  dataFiscal(naData); const d = entrada as { Data_Ultima_Atualizacao_NCM?: string; Nomenclaturas?: { Codigo: string; Descricao: string; Data_Inicio: string; Data_Fim: string }[] };
  if (!d || !Array.isArray(d.Nomenclaturas)) throw new ErroEstruturaFiscal("Arquivo oficial NCM inválido.");
  const data = (s: string) => { const [dia, mes, ano] = s.split("/"); return `${ano}-${mes}-${dia}`; };
  return { tabela: "NCM" as const, referencia: `Sistema Classif, atualização ${d.Data_Ultima_Atualizacao_NCM ?? "informada no arquivo"}`, completa: true, linhas: d.Nomenclaturas.filter(l => /^\d{4}\.\d{2}\.\d{2}$/.test(l.Codigo) && data(l.Data_Inicio) <= naData && data(l.Data_Fim) >= naData).map(l => ({ codigo: l.Codigo.replace(/\D/g, ""), descricao: l.Descricao.replace(/<[^>]*>/g, "").trim() })) };
}
