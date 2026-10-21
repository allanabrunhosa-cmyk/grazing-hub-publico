/** Bootstrap administrativo versionado. Dry-run é o padrão; nunca emite documentos. */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { criarMatrizFiscalCatalogo, type CatalogoAuditoriaFiscal, type DeclaracaoOperacionalFiscal, type TabelaNcmAuditoria } from "../src/lib/tributacao/catalogo";
import { hojeFiscal, validarSalvarVersaoFiscal } from "../src/lib/tributacao/validacao";
import type { ComportamentoFiscal, DadosVersaoFiscal, PerfilFiscal, RegraFiscal, SalvarVersaoFiscalEntrada, TabelaFiscal, TipoVersaoFiscal } from "../src/lib/tributacao/tipos";

const FONTE_NCM = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
type PerfilBase = { cnpj: string; uf: string; codigoMunicipio: string; inscricaoEstadual: string;
  evidenciaEnquadramento: string; evidenciasCadastro: { notaFiscalId: string; uf: string; codigoMunicipio: string; inscricaoEstadual: string }[]; pendencias: string[] };
type TabelaComFonte = { dados: TabelaFiscal; fontes: string[] };
type RegraComFonte = { chave: string; dados: RegraFiscal; justificativa: string; fontes: string[]; ativavel: boolean };
type RegistroPlanejado = { entrada: SalvarVersaoFiscalEntrada; ativavel: boolean };
const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function lerJson<T>(arquivo: string): Promise<T> { return JSON.parse((await readFile(path.resolve(arquivo), "utf8")).replace(/^\uFEFF/, "")) as T; }

async function executar() {
  const valores = new Map<string, string>(), flags = new Set<string>();
  for (const a of process.argv.slice(2)) {
    if (["--dryrun", "--aplicar", "--ativar"].includes(a)) { if (flags.has(a)) throw new Error("Argumento repetido."); flags.add(a); continue; }
    const m = /^--(arquivo|tabela-ncm|tabelas|perfil-base|revisoes|declaracoes|regras|usuario-id|backup-comprovante|vigencia|saida)=(.+)$/.exec(a);
    if (!m || valores.has(m[1])) throw new Error("Argumento desconhecido ou repetido."); valores.set(m[1], m[2]);
  }
  if (flags.has("--dryrun") && flags.has("--aplicar") || flags.has("--ativar") && !flags.has("--aplicar")) throw new Error("Ativar exige aplicação explícita; dry-run não escreve.");
  const arquivo = valores.get("arquivo"), arquivoNcm = valores.get("tabela-ncm");
  if (!arquivo || !arquivoNcm) throw new Error("Informe --arquivo da auditoria e --tabela-ncm oficial; nenhuma conexão foi aberta.");
  const inicio = valores.get("vigencia") ?? hojeFiscal();
  if (inicio < hojeFiscal()) throw new Error("A implantação exige vigência atual ou futura.");
  const catalogo = await lerJson<CatalogoAuditoriaFiscal>(arquivo);
  const tabelaOrigem = await lerJson<TabelaNcmAuditoria & { Data_Ultima_Atualizacao_NCM?: string }>(arquivoNcm);
  tabelaOrigem.fonte = FONTE_NCM; tabelaOrigem.dataReferencia = inicio;
  const declaracoes = valores.has("declaracoes") ? await lerJson<DeclaracaoOperacionalFiscal[]>(valores.get("declaracoes")!) : [];
  const matriz = criarMatrizFiscalCatalogo(catalogo, tabelaOrigem, declaracoes);
  const revisoes = valores.has("revisoes") ? await lerJson<{ fonteOrigem: string; casos: { produtoId: string; diagnostico: string; classificacaoRevisada: import("../src/lib/tributacao/tipos").ClassificacaoFiscal | null }[] }>(valores.get("revisoes")!) : null;
  const registros: RegistroPlanejado[] = [], pendencias: string[] = [];
  function adicionar(tipo: TipoVersaoFiscal, chave: string, dados: DadosVersaoFiscal, justificativa: string, fontes: string[], ativavel: boolean, vigencia = inicio) {
    const conteudo = { tipo, chave, dados, justificativa, fontes, vigenciaInicio: vigencia };
    const entrada = validarSalvarVersaoFiscal({ ...conteudo, versaoBase: 0, chaveOperacao: `implantacao-${sha(conteudo)}` });
    registros.push({ entrada, ativavel });
  }
  for (const linha of matriz) {
    const revisada = revisoes?.casos.find(c => c.produtoId === linha.produtoId && c.diagnostico === "IDENTIDADE_NCM_ORIGEM_SUFICIENTES")?.classificacaoRevisada;
    if (revisada && (revisada.produtoId !== linha.produtoId || revisada.ncm !== linha.classificacao.ncm || !linha.referenciasNcm.some(n => n.codigo === revisada.ncm && n.vigente))) throw new Error("Revisão técnica não corresponde à identidade e evidência oficial da auditoria.");
    adicionar("CLASSIFICACAO", linha.produtoId, revisada ?? linha.classificacao,
      revisada ? "Revisão técnica individual da mesma mercadoria adquirida: identidade, NCM e origem fundamentados em notas e tabela oficial. Regras/ST e capacidade de emissão são verificações independentes; cadastro legado preservado." :
        "Auditoria inicial individual: grupo/natureza sugeridos, NCM evidenciado quando disponível e pendências técnicas preservadas. Não aprova emissão nem altera cadastro fiscal legado.",
      [FONTE_NCM, `auditoria-catalogo:${sha(catalogo)}:versao-produto=${linha.versaoCadastro}`, ...(revisada && revisoes ? [revisoes.fonteOrigem, `revisao-tecnica:${sha(revisoes)}`] : [])], true);
  }

  const dataISO = (s: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
  const hierarquiaNcm = new Map(tabelaOrigem.Nomenclaturas.map(n => [n.Codigo.replace(/\D/g, ""), n.Descricao]));
  const tabelaNcm: TabelaFiscal = { tabela: "NCM", referencia: `Sistema Classif: ${tabelaOrigem.Data_Ultima_Atualizacao_NCM ?? inicio}; consulta oficial preservada.`, completa: true,
    linhas: tabelaOrigem.Nomenclaturas.filter(n => /^\d{4}\.\d{2}\.\d{2}$/.test(n.Codigo) && dataISO(n.Data_Inicio) <= inicio && inicio <= dataISO(n.Data_Fim)).map(n => {
      const codigo = n.Codigo.replace(/\D/g, "");
      const descricao = [...[2, 4, 5, 6, 7].map(t => hierarquiaNcm.get(codigo.slice(0, t))).filter((s): s is string => !!s), n.Descricao]
        .map(d => d.replace(/<[^>]*>/g, "")).join(" > ");
      return { codigo, descricao };
    }) };
  adicionar("TABELA", "NCM", tabelaNcm, "Importação da tabela oficial vigente sem inferir NCM de qualquer produto, benefício ou alíquota.", [FONTE_NCM], true);

  const tabelas: TabelaComFonte[] = valores.has("tabelas") ? await lerJson<TabelaComFonte[]>(valores.get("tabelas")!) : [];
  for (const t of tabelas) {
    if (t.dados.tabela === "NCM") throw new Error("NCM já tem fonte própria; não duplicar tabela.");
    adicionar("TABELA", t.dados.tabela, t.dados, "Coleção de códigos de fonte oficial conferida; cobertura parcial explicitada no cadastro da tabela.", t.fontes, true);
  }
  const temCodigo = (tabela: TabelaFiscal["tabela"], codigo: string) => tabelas.some(t => t.dados.tabela === tabela && t.dados.linhas.some(l => l.codigo === codigo));
  const base = valores.has("perfil-base") ? await lerJson<PerfilBase>(valores.get("perfil-base")!) : null;
  if (!base || base.pendencias?.length || !base.evidenciasCadastro?.length) pendencias.push("Perfil do estabelecimento não criado: obter CNPJ cadastrado e consenso documental de IE/UF/código do município do próprio destinatário.");
  else {
    const perfil: PerfilFiscal = { estabelecimento: "singleton", cnpj: base.cnpj, uf: base.uf,
      codigoMunicipio: base.codigoMunicipio, inscricaoEstadual: base.inscricaoEstadual,
      regime: "SIMPLES_NACIONAL", confirmado: true, evidenciaEnquadramento: base.evidenciaEnquadramento,
      modelos: ["55", "65"], emissor: "TAKEAT", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
    const fontes = base.evidenciasCadastro.slice(0, 40).map(e => `nfe-destinatario-proprio:${e.notaFiscalId}:IE-UF-cMun-conferidos`);
    adicionar("PERFIL", "singleton", perfil, "Regime 2026 declarado expressamente pelo administrador; identidade fiscal conferida em documentos recebidos do próprio estabelecimento. Emissor Takeat preservado.", fontes, true);
    adicionar("PERFIL", "singleton", { ...perfil, regime: "LUCRO_PRESUMIDO", confirmado: false,
      evidenciaEnquadramento: "", reforma: "EXIGIR_REGRA" }, "Preparação para 2027, sem mudança antecipada. Exige confirmação cadastral na data da transição e regras de ICMS/IBS/CBS vigentes.", fontes, false, "2027-01-01");
    const codigos = [["CFOP", "5101"], ["CFOP", "5102"], ["CSOSN", "102"], ["CST_ICMS", "00"], ["CST_PIS_COFINS", "49"]] as const;
    const faltantes = codigos.filter(([t, c]) => !temCodigo(t, c));
    if (faltantes.length) pendencias.push(`Modelos de regras 2026 não criados: importar fontes oficiais de ${faltantes.map(([t, c]) => `${t} ${c}`).join(", ")}.`);
    else {
      for (const natureza of ["PREPARADO", "REVENDA", "FRACIONADO"] as const) {
        const regra: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: base.uf,
          destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: null, natureza, ncm: null,
          cfop: natureza === "PREPARADO" ? "5101" : "5102", csosn: "102",
          icms: { cst: "00", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Modelo para operação do Simples sem permissão de crédito; efetiva compatibilidade e ST ainda devem ser comprovadas por mercadoria." },
          pis: { cst: "49", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Modelo sem destaque de PIS no Simples; segregação monofásica ou outra específica depende de evidência individual." },
          cofins: { cst: "49", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Modelo sem destaque de COFINS no Simples; não presume segregação monofásica." },
          ipi: null, st: "CALCULO_PENDENTE", cest: null, seletivo: "NAO_APLICAVEL", reforma: null,
          segregacaoReceita: natureza === "PREPARADO" ? "ALIMENTACAO_PREPARADA" : "REVENDA_MERCADORIAS" };
        adicionar("REGRA", `SN2026-${natureza}-${base.uf}-CONSUMIDOR`, regra,
          "Modelo conservador do Simples 2026, mantido em rascunho; falta avaliação ST/CEST/monofásico e elegibilidade da operação. Sem alíquotas fabricadas.",
          tabelas.flatMap(t => t.fontes).filter((v, i, a) => a.indexOf(v) === i).slice(0, 50), false);
      }
    }
  }

  const regras = valores.has("regras") ? await lerJson<RegraComFonte[]>(valores.get("regras")!) : [];
  if (new Set(regras.map(r => r.chave)).size !== regras.length) throw new Error("Coleção de regras contém chaves repetidas.");
  for (const r of regras) {
    const c = registros.find(p => p.entrada.tipo === "CLASSIFICACAO" && p.entrada.chave === r.dados.produtoId)?.entrada.dados as import("../src/lib/tributacao/tipos").ClassificacaoFiscal | undefined;
    if (!base || !c || c.estado !== "CONFIRMADO" || r.dados.regime !== "SIMPLES_NACIONAL" || r.dados.estabelecimento !== "singleton" || r.dados.ufDestino !== base.uf || r.dados.destinatario !== "CONSUMIDOR_FINAL" || r.dados.ncm !== c.ncm || r.dados.cest !== c.cest || r.dados.natureza !== c.natureza || r.dados.grupo !== c.grupo) throw new Error("Regra individual não corresponde ao perfil e classificação auditados.");
    if (r.ativavel && (r.dados.st === "CALCULO_PENDENTE" || r.dados.seletivo !== "NAO_APLICAVEL" || r.dados.icms.modalidade !== "SEM_DESTAQUE" || r.dados.pis.modalidade !== "SEM_DESTAQUE" || r.dados.cofins.modalidade !== "SEM_DESTAQUE" || r.dados.ipi !== null || r.dados.reforma !== null || !r.fontes.length)) throw new Error("Regra ativável exige tratamento 2026 comprovado, sem cálculo fabricado ou pendente.");
    const codigos = [["CFOP", r.dados.cfop], ["CSOSN", r.dados.csosn], ["CST_ICMS", r.dados.icms.cst], ["CST_PIS_COFINS", r.dados.pis.cst], ["CST_PIS_COFINS", r.dados.cofins.cst], ["CEST", r.dados.cest]] as const;
    if (r.ativavel && codigos.some(([t, codigo]) => codigo && !temCodigo(t, codigo))) throw new Error("Código da regra ativável sem tabela oficial conferida.");
    if (r.dados.cest && !tabelas.some(t => t.dados.tabela === "CEST" && t.dados.linhas.some(l => l.codigo === r.dados.cest && l.ncm?.includes(c.ncm!)))) throw new Error("CEST sem correspondência oficial da mercadoria/NCM.");
    adicionar("REGRA", r.chave, r.dados, r.justificativa, r.fontes, r.ativavel);
  }

  for (const o of catalogo.opcoes.filter(o => o.ativo && o.produtoId)) {
    const g = catalogo.gruposComplementos.find(g => g.id === o.grupoId && g.ativo);
    if (!g) continue;
    const gratis = /^0(?:\.0+)?$/.test(o.preco);
    if (g.tipo === "COMPOSICAO" && gratis && !/embalagem|pote|bandeja/i.test(g.nome)) {
      const complemento: ComportamentoFiscal = { opcaoId: o.id, comportamento: "INCLUIDO", produtoId: null,
        justificativa: "Escolha interna gratuita de grupo de composição: integra a preparação/estoque sem linha fiscal independente. Cobrança futura exige revisão do tratamento." };
      adicionar("COMPLEMENTO", o.id, complemento, complemento.justificativa, [`catalogo-grupo:${g.id}:tipo=COMPOSICAO:preco=0`], true);
    } else if (g.tipo === "COMPLEMENTAR" && !gratis) {
      const complemento: ComportamentoFiscal = { opcaoId: o.id, comportamento: "MERCADORIA", produtoId: o.produtoId,
        justificativa: "Mercadoria adicional de grupo complementar, com vínculo a produto e preço individual no catálogo. Mantida em rascunho para conferir total, descontos e classificação individual antes de ativar." };
      adicionar("COMPLEMENTO", o.id, complemento, complemento.justificativa, [`catalogo-opcao:${o.id}:grupo=${g.id}:preco-individual-existente`], false);
    } else pendencias.push(`Complemento ${o.id}: tratamento cobrado/embalagem requer análise individual e versão própria antes da emissão afetada.`);
  }
  const raiz = path.resolve(".tmp", "fiscal"), saida = path.resolve(valores.get("saida") ?? raiz);
  const relativo = path.relative(raiz, saida);
  if (relativo.startsWith("..") || path.isAbsolute(relativo)) throw new Error("Guardar o plano e recibos privados dentro de .tmp/fiscal.");
  await mkdir(saida, { recursive: true, mode: 0o700 });
  const resumo = { modo: flags.has("--aplicar") ? "APLICAR" : "DRY_RUN", vigencia: inicio,
    produtos: matriz.length, registros: registros.length, ativaveis: registros.filter(r => r.ativavel).length,
    classificacoesConfirmadas: registros.filter(r => r.entrada.tipo === "CLASSIFICACAO" && (r.entrada.dados as { estado: string }).estado === "CONFIRMADO").length,
    perfis: registros.filter(r => r.entrada.tipo === "PERFIL").length,
    regrasAtivaveis: registros.filter(r => r.entrada.tipo === "REGRA" && r.ativavel).length,
    regrasRascunho: registros.filter(r => r.entrada.tipo === "REGRA" && !r.ativavel).length,
    complementos: registros.filter(r => r.entrada.tipo === "COMPLEMENTO").length,
    pendencias: pendencias.length, hashPlano: sha(registros), emissor: "TAKEAT", documentosTransmitidos: 0 };
  await writeFile(path.join(saida, "plano-implantacao-fiscal.json"), JSON.stringify({ resumo, registros, pendencias }, null, 2), { mode: 0o600 });
  if (!flags.has("--aplicar")) { console.log(JSON.stringify(resumo, null, 2)); return; }
  const usuarioId = valores.get("usuario-id"), arquivoBackup = valores.get("backup-comprovante");
  if (!usuarioId || !arquivoBackup) throw new Error("Aplicar exige --usuario-id do administrador real e --backup-comprovante previamente verificado; nenhuma escrita foi iniciada.");
  const backup = await lerJson<{ verificado: boolean; autorizacaoImplantacao: boolean; hashDump: string; criadoEm: string }>(arquivoBackup);
  const idade = Date.now() - Date.parse(backup.criadoEm);
  if (!backup.verificado || !backup.autorizacaoImplantacao || !/^[a-f0-9]{64}$/.test(backup.hashDump) || !Number.isFinite(idade) || idade < 0 || idade > 86_400_000) throw new Error("Comprovante de backup/autorizaçāo ausente, inválido ou vencido. Nenhuma escrita foi iniciada.");
  const [{ prisma }, servico] = await Promise.all([import("../src/lib/prisma"), import("../src/lib/tributacao/servico")]);
  try {
    const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { perfilAcesso: true } });
    if (!u?.ativo || u.excluidoEm || u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new Error("Administrador vigente não comprovado.");
    const sessao = { userId: u.id, nome: u.nome, email: u.email, admin: true, versao: u.sessaoVersao,
      perfilNome: u.perfilAcesso.nome, permissoes: u.perfilAcesso.permissoes, excecoes: u.permissoesPersonalizadas } as import("../src/lib/session").SessaoAtual;
    const atuais = await prisma.produtoVenda.findMany({ where: { ativo: true }, select: { id: true, versao: true } });
    if (atuais.length !== matriz.length || atuais.some(p => !matriz.some(l => l.produtoId === p.id && l.versaoCadastro === p.versao))) throw new Error("Catálogo mudou depois da auditoria; refazer matriz antes de implantar.");
    const gruposAtuais = await prisma.grupoComplementoVenda.findMany({ select: { id: true, ativo: true, tipo: true, versao: true } });
    if (catalogo.gruposComplementos.some(g => !gruposAtuais.some(a => a.id === g.id && a.ativo === g.ativo && a.tipo === g.tipo && (g.versao === undefined || a.versao === g.versao)))) throw new Error("Grupo de complementos mudou depois da auditoria; refazer a análise antes de implantar.");
    const opcoesAtuais = await prisma.opcaoComplementoVenda.findMany({ where: { ativo: true }, select: { id: true, grupoId: true, produtoId: true, preco: true, quantidade: true } });
    const opcoesAuditadas = catalogo.opcoes.filter(o => o.ativo);
    if (opcoesAtuais.length !== opcoesAuditadas.length || opcoesAtuais.some(a => !opcoesAuditadas.some(o => o.id === a.id && o.grupoId === a.grupoId && o.produtoId === a.produtoId && a.preco.equals(o.preco) && a.quantidade.equals(o.quantidade)))) throw new Error("Complemento/preço mudou depois da auditoria; preservar o catálogo e refazer a análise fiscal.");
    const recibos: { id: string; tipo: TipoVersaoFiscal; chave: string; resultado: string }[] = [];
    for (const r of registros) {
      const pelaOperacao = await prisma.versaoEstruturaFiscal.findUnique({ where: { chaveOperacao: r.entrada.chaveOperacao } });
      const ultima = await prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: r.entrada.tipo, chave: r.entrada.chave }, orderBy: { versao: "desc" } });
      const existente = pelaOperacao ?? (ultima?.hash === servico.hashFiscal(r.entrada.dados) ? ultima : null);
      let id: string;
      if (existente) {
        if (existente.hash !== servico.hashFiscal(r.entrada.dados)) throw new Error("Versão fiscal existente diverge do bootstrap; revisar prospectivamente pela interface. Não sobrescrever configuração.");
        id = existente.id;
      } else {
        if (ultima && !registros.some(p => p.entrada.chaveOperacao === ultima.chaveOperacao && p.entrada.tipo === r.entrada.tipo && p.entrada.chave === r.entrada.chave)) throw new Error("Configuração fiscal já foi corrigida fora deste lote; revisar pela interface sem sobrescrever.");
        id = (await servico.salvarVersaoFiscal({ ...r.entrada, versaoBase: ultima?.versao ?? 0 }, sessao)).id;
      }
      if (flags.has("--ativar") && r.ativavel && existente?.status !== "ATIVO") {
        const impacto = await servico.analisarImpactoFiscal(id, sessao);
        await servico.ativarVersaoFiscal(id, impacto.hash, `ativacao-${sha({ id, hash: impacto.hash })}`, sessao);
      }
      recibos.push({ id, tipo: r.entrada.tipo, chave: r.entrada.chave, resultado: flags.has("--ativar") && r.ativavel ? "ATIVO" : existente?.status ?? "RASCUNHO" });
      await writeFile(path.join(saida, "recibo-implantacao-fiscal.json"), JSON.stringify({ resumo, recibos }, null, 2), { mode: 0o600 });
    }
    console.log(JSON.stringify({ ...resumo, registrosConferidos: recibos.length }, null, 2));
  } finally { await prisma.$disconnect(); }
}
void executar().catch((e: unknown) => {
  const mensagem = e instanceof Error ? e.message : "Implantação interrompida.";
  console.error(/credentials|password|postgres|database_url|token|prisma/i.test(mensagem) ? "Implantação interrompida; conferir ambiente sem revelar credenciais. Consulte o recibo privado antes de repetir." : mensagem);
  process.exitCode = 1;
});
