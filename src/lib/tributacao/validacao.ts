import type { ClassificacaoFiscal, ComportamentoFiscal, DadosVersaoFiscal, PerfilFiscal, RegraFiscal, SalvarVersaoFiscalEntrada, TabelaFiscal, TipoVersaoFiscal, TributoConfigurado } from "./tipos";
import { GRUPOS_FISCAIS } from "./tipos";
import { gtinValido } from "./gtin";
import { Prisma } from "@/generated/prisma/client";
import { validarDecisaoFciFiscal, ErroFciFiscal } from "./fci";
export class ErroEstruturaFiscal extends Error {}
const falha = (campo: string): never => { throw new ErroEstruturaFiscal(`${campo}: valor inválido ou informação obrigatória ausente.`); };
function objeto(v: unknown, campo: string): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : falha(campo); }
export function textoFiscal(v: unknown, campo: string, max = 200, obrigatorio = true): string {
  if (typeof v !== "string" || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v) || (obrigatorio && !v.trim())) return falha(campo);
  return v.trim();
}
function codigo(v: unknown, campo: string, regex: RegExp, opcional = false): string | null {
  if (opcional && (v === null || v === undefined || v === "")) return null;
  const s = textoFiscal(v, campo, 120); return regex.test(s) ? s : falha(campo);
}
function lista(v: unknown, campo: string, max = 100): unknown[] { return Array.isArray(v) && v.length <= max ? v : falha(campo); }
function enumValor<T extends string>(v: unknown, valores: readonly T[], campo: string): T { return typeof v === "string" && valores.includes(v as T) ? v as T : falha(campo); }
function booleano(v: unknown, campo: string): boolean { return typeof v === "boolean" ? v : falha(campo); }
const id = (v: unknown, campo: string, opcional = false) => codigo(v, campo, /^[a-zA-Z0-9_-]{1,100}$/, opcional);
const alvoRegra = (v: unknown) => typeof v === "string" && v.startsWith("INSUMO:") ? codigo(v, "Referência interna da regra", /^INSUMO:[a-zA-Z0-9_-]{1,100}$/) : id(v, "Produto", true);
const grupo = (v: unknown) => v == null || v === "" ? null : enumValor(v, GRUPOS_FISCAIS.map(g => g[0]), "Grupo fiscal");
const regime = (v: unknown) => enumValor(v, ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO"], "Regime");
const natureza = (v: unknown) => enumValor(v, ["PREPARADO", "REVENDA", "FRACIONADO", "SERVICO"], "Natureza");
export function percentualFiscal(v: unknown, campo: string): string {
  const s = codigo(v, campo, /^\d{1,3}(\.\d{1,4})?$/)!;
  if (Number(s) > 100) return falha(campo); return s;
}
function quantidade(v: unknown, campo: string): string { const s = codigo(v, campo, /^\d{1,12}(\.\d{1,6})?$/)!; return Number(s) > 0 ? s : falha(campo); }
export function dataFiscal(v: unknown): string {
  const s = codigo(v, "Vigência", /^\d{4}-\d{2}-\d{2}$/)!;
  const d = new Date(`${s}T00:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) return falha("Vigência"); return s;
}
export function hojeFiscal(agora = new Date()): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora); }
const strings = (v: unknown, campo: string, max = 100) => lista(v, campo, max).map(s => textoFiscal(s, campo, 2000));
function tributo(v: unknown, campo: string): TributoConfigurado {
  const d = objeto(v, campo); const modalidade = enumValor(d.modalidade, ["TRIBUTADO", "SEM_DESTAQUE"], campo);
  const aliquota = d.aliquota == null || d.aliquota === "" ? null : percentualFiscal(d.aliquota, campo);
  if (modalidade === "TRIBUTADO" && aliquota === null) return falha(`Alíquota ${campo}`);
  if (modalidade === "SEM_DESTAQUE" && aliquota !== null && Number(aliquota) !== 0) return falha(`Destaque ${campo}`);
  return { cst: codigo(d.cst, `CST ${campo}`, /^\d{2}$/)!, aliquota, reducaoBase: percentualFiscal(d.reducaoBase ?? "0", campo), modalidade, justificativa: textoFiscal(d.justificativa, `Justificativa ${campo}`, 2000) };
}
function analiseNcm(v: unknown) {
  const a = objeto(v, "Análise do NCM");
  const r = { fundamento: enumValor(a.fundamento, ["DOCUMENTAL", "PESQUISA"] as const, "Fundamento do NCM"), confianca: enumValor(a.confianca, ["ALTA", "MEDIA", "BAIXA"] as const, "Confiança do NCM"), descricaoNcm: a.descricaoNcm == null ? null : textoFiscal(a.descricaoNcm, "Descrição oficial do NCM", 2000), dataAnalise: dataFiscal(a.dataAnalise), justificativa: textoFiscal(a.justificativa, "Justificativa do NCM", 4000), fontes: strings(a.fontes, "Fontes da análise", 50), pendenciasNcm: strings(a.pendenciasNcm, "Pendências de NCM") };
  if (!r.fontes.length || r.dataAnalise > hojeFiscal() || r.confianca !== "BAIXA" && r.pendenciasNcm.length) return falha("Fontes, data e pendências da análise do NCM");
  return r;
}
export function validarDadosFiscais(tipo: TipoVersaoFiscal, entrada: unknown): DadosVersaoFiscal {
  const d = objeto(entrada, "Configuração fiscal");
  if (tipo === "CLASSIFICACAO") {
    const internaId = id(d.referenciaInternaInsumoId, "Referência interna de insumo", true);
    if (internaId && d.produtoId !== null) return falha("Identidade fiscal interna exclusiva");
    const r: ClassificacaoFiscal = { produtoId: internaId ? null : id(d.produtoId, "Produto")!, ...(internaId ? { referenciaInternaInsumoId: internaId } : {}), grupo: grupo(d.grupo), natureza: natureza(d.natureza), tratamento: enumValor(d.tratamento, ["NORMAL", "KIT_COMPOSTO", "OPCAO_CONFIGURACAO"], "Tratamento"), ncm: codigo(d.ncm, "NCM", /^\d{8}$/, true), origem: codigo(d.origem, "Origem", /^[0-8]$/, true), cest: codigo(d.cest, "CEST", /^\d{7}$/, true), unidade: codigo(d.unidade, "Unidade", /^[A-Z0-9]{1,6}$/)!, estado: enumValor(d.estado, ["CONFIRMADO", "PENDENTE"], "Situação"), evidencias: strings(d.evidencias, "Evidências"), pendencias: strings(d.pendencias, "Pendências") };
    if (d.grupoFiscalId !== undefined) r.grupoFiscalId = id(d.grupoFiscalId, "Grupo cadastrado", true);
    if (d.fci !== undefined) {
      try { r.fci = validarDecisaoFciFiscal(d.fci); } catch (erro) { throw new ErroEstruturaFiscal(erro instanceof ErroFciFiscal ? erro.message : "FCI: configuração inválida."); }
    }
    if (d.conversaoUnidade !== undefined) {
      const u = objeto(d.conversaoUnidade, "Conversão de unidade interna"), fator = codigo(u.quantidadeEstoquePorUnidadeFiscal, "Fator físico documentado", /^\d{1,9}(\.\d{1,9})?$/)!;
      if (!internaId || Number(fator) <= 0) return falha("Conversão de unidade fiscal interna");
      r.conversaoUnidade = { unidadeEstoque: codigo(u.unidadeEstoque, "Unidade de controle", /^[A-Z0-9]{1,6}$/)!, quantidadeEstoquePorUnidadeFiscal: fator, justificativa: textoFiscal(u.justificativa, "Justificativa da conversão", 2000), fontes: strings(u.fontes, "Fontes da conversão", 50) };
      if (!r.conversaoUnidade.fontes.length) return falha("Fontes da conversão interna");
    }
    if (d.gtin !== undefined) {
      r.gtin = d.gtin === null || d.gtin === "" ? null : textoFiscal(d.gtin, "GTIN", 14);
      if (r.gtin !== null && !gtinValido(r.gtin)) return falha("GTIN: formato ou dígito verificador");
    }
    if (r.fci?.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL" && (r.origem !== "5" || r.gtin !== "SEM GTIN" || r.produtoId !== r.fci.declaracaoResponsavel?.produtoId)) return falha("Alcance exclusivo da declaração de origem, FCI e GTIN");
    if (d.componentesKit !== undefined) r.componentesKit = lista(d.componentesKit, "Componentes do kit", 100).map(v => {
      const c = objeto(v, "Componente"), produtoId = id(c.produtoId, "Mercadoria do kit", true), insumoId = id(c.referenciaInternaInsumoId, "Insumo interno do kit", true);
      if (!!produtoId === !!insumoId) return falha("Referência exclusiva do componente do kit");
      const componente: NonNullable<ClassificacaoFiscal["componentesKit"]>[number] = { ...(produtoId ? { produtoId } : { referenciaInternaInsumoId: insumoId! }), quantidade: quantidade(c.quantidade, "Quantidade do kit"), pesoRateio: quantidade(c.pesoRateio, "Peso do rateio") };
      if (insumoId || c.descricao !== undefined) componente.descricao = textoFiscal(c.descricao, "Descrição do componente", 120);
      if (insumoId || c.unidade !== undefined) componente.unidade = codigo(c.unidade, "Unidade fiscal do componente", /^[A-Z0-9]{1,6}$/)!;
      if (c.escolhas !== undefined) {
        if (!produtoId) return falha("Escolhas de componente comercial");
        componente.escolhas = lista(c.escolhas, "Escolhas internas do componente", 20).map(x => { const e = objeto(x, "Escolha do componente"); return { opcaoId: id(e.opcaoId, "Opção do componente")!, grupoId: id(e.grupoId, "Grupo da escolha")!, quantidade: quantidade(e.quantidade, "Quantidade de escolha") }; });
        if (new Set(componente.escolhas.map(e => e.opcaoId)).size !== componente.escolhas.length) return falha("Escolhas distintas do componente");
      }
      return componente;
    });
    if (internaId && (r.tratamento !== "NORMAL" || r.natureza === "SERVICO" || d.configuracaoNcm !== undefined || r.componentesKit)) return falha("Tratamento da referência interna");
    if (d.configuracaoNcm !== undefined) {
      const cfg = objeto(d.configuracaoNcm, "NCM por configuração");
      const grupoIds = lista(cfg.grupoIds, "Grupos discriminantes", 20).map(x => id(x, "Grupo discriminante")!);
      const gruposEquivalentes = cfg.gruposEquivalentes === undefined ? undefined : lista(cfg.gruposEquivalentes, "Grupos equivalentes", 20).map(x => {
        const g = objeto(x, "Grupo equivalente");
        const minimo = codigo(g.quantidadeMinima, "Quantidade mínima documentada", /^\d{1,12}(\.\d{1,6})?$/)!;
        const maximo = quantidade(g.quantidadeMaxima, "Quantidade máxima documentada");
        const r = { grupoId: id(g.grupoId, "Grupo equivalente")!, opcaoIds: lista(g.opcaoIds, "Opções equivalentes", 200).map(o => id(o, "Opção equivalente")!).sort(), quantidadeMinima: minimo, quantidadeMaxima: maximo, analiseNcm: analiseNcm(g.analiseNcm) };
        if (!r.opcaoIds.length || new Set(r.opcaoIds).size !== r.opcaoIds.length || new Prisma.Decimal(minimo).gt(maximo) || r.analiseNcm.confianca === "BAIXA" || r.analiseNcm.pendenciasNcm.length || !r.analiseNcm.descricaoNcm) return falha("Equivalência NCM e limites fundamentados");
        return r;
      });
      const cenarios = lista(cfg.cenarios, "Cenários NCM", 100).map(x => {
        const s = objeto(x, "Cenário NCM"), opcaoIds = lista(s.opcaoIds, "Opções do cenário", 20).map(x => id(x, "Opção discriminante")!).sort();
        const quantidadesEscolhidas = s.quantidadesEscolhidas === undefined ? undefined : lista(s.quantidadesEscolhidas, "Quantidades exatas do cenário", 20).map(x => { const q = objeto(x, "Quantidade discriminante"); return { opcaoId: id(q.opcaoId, "Opção da quantidade exata")!, quantidade: quantidade(q.quantidade, "Quantidade exata documentada") }; }).sort((a,b) => a.opcaoId.localeCompare(b.opcaoId));
        if (quantidadesEscolhidas && (quantidadesEscolhidas.length !== opcaoIds.length || new Set(quantidadesEscolhidas.map(q => q.opcaoId)).size !== opcaoIds.length || quantidadesEscolhidas.some(q => !opcaoIds.includes(q.opcaoId)))) return falha("Quantidades exatas de todas as opções do cenário");
        return { id: id(s.id, "Identidade do cenário")!, nome: textoFiscal(s.nome, "Nome do cenário", 120), opcaoIds, ...(quantidadesEscolhidas ? { quantidadesEscolhidas } : {}), ncm: codigo(s.ncm, "NCM do cenário", /^\d{8}$/, true), analiseNcm: analiseNcm(s.analiseNcm) };
      });
      const seletor = (s: typeof cenarios[number]) => JSON.stringify(s.opcaoIds.map(id => [id, new Prisma.Decimal(s.quantidadesEscolhidas?.find(q => q.opcaoId === id)?.quantidade ?? "1").toString()]));
      if ((!grupoIds.length || !cenarios.length) && !(gruposEquivalentes?.length && !grupoIds.length && !cenarios.length) || new Set(grupoIds).size !== grupoIds.length || new Set(gruposEquivalentes?.map(g => g.grupoId)).size !== (gruposEquivalentes?.length ?? 0) || gruposEquivalentes?.some(g => grupoIds.includes(g.grupoId)) || new Set(cenarios.map(s => s.id)).size !== cenarios.length || new Set(cenarios.map(seletor)).size !== cenarios.length || cenarios.some(s => s.id === "PADRAO_SEM_ESCOLHAS" || !s.opcaoIds.length || new Set(s.opcaoIds).size !== s.opcaoIds.length || s.analiseNcm.confianca !== "BAIXA" && (!s.ncm || !s.analiseNcm.descricaoNcm) || s.analiseNcm.confianca === "BAIXA" && !s.analiseNcm.pendenciasNcm.length) || r.tratamento !== "NORMAL" || r.natureza === "SERVICO") return falha("Seletores e evidências dos cenários NCM");
      r.configuracaoNcm = { grupoIds, padraoSemEscolhasAutorizado: booleano(cfg.padraoSemEscolhasAutorizado, "Padrão sem escolhas autorizado"), cenarios, ...(gruposEquivalentes ? { gruposEquivalentes } : {}) };
      if (cfg.modoFiscal !== undefined) r.configuracaoNcm.modoFiscal = enumValor(cfg.modoFiscal, ["PREPARACAO_UNICA", "UNIDADES_SEPARADAS"] as const, "Modo fiscal das escolhas");
      if (r.configuracaoNcm.modoFiscal === "UNIDADES_SEPARADAS" && (gruposEquivalentes?.length || r.configuracaoNcm.padraoSemEscolhasAutorizado || cenarios.some(s => s.opcaoIds.length !== 1 || s.quantidadesEscolhidas?.some(q => !new Prisma.Decimal(q.quantidade).equals(1))))) return falha("Unidades separadas exigem cenário individual comprovado de uma unidade por opção");
      if (r.configuracaoNcm.padraoSemEscolhasAutorizado && !r.ncm) return falha("NCM padrão autorizado");
      if (gruposEquivalentes?.length && !r.configuracaoNcm.padraoSemEscolhasAutorizado) return falha("Equivalência exige NCM base expressamente autorizado");
    }
    if (d.ncmAplicabilidade !== undefined || d.analiseNcm !== undefined) {
      r.ncmAplicabilidade = enumValor(d.ncmAplicabilidade, ["APLICAVEL", "NAO_APLICAVEL"] as const, "Aplicabilidade do NCM");
      r.analiseNcm = analiseNcm(d.analiseNcm);
      if (r.analiseNcm.confianca === "BAIXA" && r.estado !== "PENDENTE" || r.analiseNcm.confianca !== "BAIXA" && r.analiseNcm.pendenciasNcm.length) return falha("Conclusão e pendências da análise do NCM");
      if (r.ncmAplicabilidade === "APLICAVEL" && (!r.configuracaoNcm && r.analiseNcm.confianca !== "BAIXA" && (!r.ncm || !r.analiseNcm.descricaoNcm) || !r.configuracaoNcm && r.analiseNcm.confianca === "BAIXA" && !r.analiseNcm.pendenciasNcm.length || r.tratamento !== "NORMAL" || r.natureza === "SERVICO")) return falha("NCM aplicável à mercadoria individual");
      if (r.ncmAplicabilidade === "NAO_APLICAVEL" && (r.ncm !== null || r.analiseNcm.descricaoNcm !== null || r.tratamento === "NORMAL" && r.natureza !== "SERVICO")) return falha("NCM não aplicável ao registro");
    }
    if (r.configuracaoNcm && (r.ncmAplicabilidade !== "APLICAVEL" || !r.analiseNcm || r.configuracaoNcm.padraoSemEscolhasAutorizado && (r.analiseNcm.confianca === "BAIXA" || !r.analiseNcm.descricaoNcm))) return falha("Análise do NCM por configuração e padrão autorizado");
    if (d.baseSemIngredientesComprovada !== undefined) {
      r.baseSemIngredientesComprovada = booleano(d.baseSemIngredientesComprovada, "Ausência documentada de ingredientes fixos");
      if (r.baseSemIngredientesComprovada && (!r.produtoId || r.tratamento !== "NORMAL" || !r.configuracaoNcm || !r.analiseNcm || !r.analiseNcm.fontes.length || !r.evidencias.length)) return falha("Base sem ingredientes exige configuração física e evidências documentadas");
    }
    if (d.receitaFiscalDocumentada !== undefined) {
      const receita = objeto(d.receitaFiscalDocumentada, "Receita fiscal documentada");
      const componentes = (v: unknown) => lista(v, "Ingredientes finais documentados", 200).map(v => { const c = objeto(v, "Ingrediente final"); return { insumoId: id(c.insumoId, "Insumo final")!, unidade: codigo(c.unidade, "Unidade final documentada", /^[A-Z0-9]{1,6}$/)!, quantidade: (() => { const q = codigo(c.quantidade, "Quantidade final documentada", /^\d{1,12}(\.\d{1,9})?$/)!; return new Prisma.Decimal(q).gt(0) ? q : falha("Quantidade final documentada"); })() }; });
      r.receitaFiscalDocumentada = { componentesFixos: componentes(receita.componentesFixos), opcoes: lista(receita.opcoes, "Porções físicas documentadas", 1000).map(v => { const o = objeto(v, "Porção física"); return { opcaoId: id(o.opcaoId, "Opção da porção")!, componentes: componentes(o.componentes) }; }), justificativa: textoFiscal(receita.justificativa, "Fundamentação da receita final fiscal", 2000), fontes: strings(receita.fontes, "Fontes da receita final fiscal", 50) };
      if (!r.produtoId || r.tratamento !== "NORMAL" || r.natureza !== "PREPARADO" || !r.analiseNcm || !r.receitaFiscalDocumentada.fontes.length || !r.evidencias.length || new Set(r.receitaFiscalDocumentada.opcoes.map(o => o.opcaoId)).size !== r.receitaFiscalDocumentada.opcoes.length || r.baseSemIngredientesComprovada) return falha("Receita fiscal documentada exige preparação própria, análise, evidências e opções únicas");
      if (!r.receitaFiscalDocumentada.componentesFixos.length && !r.receitaFiscalDocumentada.opcoes.some(o => o.componentes.length)) return falha("Ingredientes da receita fiscal documentada");
      if (!r.configuracaoNcm && r.receitaFiscalDocumentada.opcoes.length) return falha("Porções por escolha exigem configuração NCM versionada");
    }
    if (r.tratamento === "KIT_COMPOSTO" && (r.estado === "CONFIRMADO" && !r.componentesKit?.length || r.componentesKit && (r.componentesKit.some(c => !!c.produtoId && c.produtoId === r.produtoId) || new Set(r.componentesKit.map(c => JSON.stringify([c.produtoId ?? `INSUMO:${c.referenciaInternaInsumoId}`, c.escolhas ? [...c.escolhas].sort((a,b) => a.opcaoId.localeCompare(b.opcaoId)) : []]))).size !== r.componentesKit.length))) return falha("Mercadorias distintas do kit");
    if (r.estado === "CONFIRMADO" && (r.pendencias.length || !r.evidencias.length || !r.grupo && !r.grupoFiscalId && r.tratamento !== "KIT_COMPOSTO" || (r.tratamento === "NORMAL" && r.natureza !== "SERVICO" && (!r.ncm && !r.configuracaoNcm || r.origem === null)))) return falha("Evidências e classificação confirmada");
    if (JSON.stringify(r).length > 512000) return falha("Tamanho da classificação fiscal");
    return r;
  }
  if (tipo === "PERFIL") {
    const r: PerfilFiscal = { estabelecimento: id(d.estabelecimento, "Estabelecimento")!, cnpj: codigo(d.cnpj, "CNPJ", /^\d{14}$/)!, uf: codigo(d.uf, "UF", /^[A-Z]{2}$/)!, codigoMunicipio: codigo(d.codigoMunicipio, "Código IBGE", /^\d{7}$/)!, inscricaoEstadual: codigo(d.inscricaoEstadual, "Inscrição estadual", /^\d{2,14}$/)!, regime: regime(d.regime), confirmado: booleano(d.confirmado, "Enquadramento confirmado"), evidenciaEnquadramento: textoFiscal(d.evidenciaEnquadramento ?? "", "Evidência cadastral", 2000, false), modelos: lista(d.modelos, "Modelos", 2).map(v => enumValor(v, ["55", "65"], "Modelo")), emissor: enumValor(d.emissor, ["TAKEAT", "BRASIL_NFE", "MANUAL"], "Emissor responsável"), reforma: enumValor(d.reforma, ["DISPENSADO_SIMPLES_2026", "EXIGIR_REGRA"], "Reforma tributária"), beneficioOpcional: null };
    if (d.crt !== undefined) {
      if (typeof d.crt !== "number" || ![1, 2, 3, 4].includes(d.crt)) return falha("Código CRT");
      r.crt = d.crt as 1 | 2 | 3 | 4;
      if ((r.regime === "SIMPLES_NACIONAL") !== (r.crt !== 3)) return falha("Compatibilidade do regime e CRT");
    }
    if (r.confirmado && !r.evidenciaEnquadramento) return falha("Comprovação cadastral do regime");
    if (r.regime === "LUCRO_PRESUMIDO" && r.reforma !== "EXIGIR_REGRA") return falha("IBS/CBS no regime normal");
    if (d.beneficioOpcional != null) { const b = objeto(d.beneficioOpcional, "Benefício opcional"); r.beneficioOpcional = { codigo: textoFiscal(b.codigo, "Benefício", 100), elegibilidade: textoFiscal(b.elegibilidade, "Elegibilidade", 2000), opcaoComprovada: textoFiscal(b.opcaoComprovada, "Opção comprovada", 2000), fim: dataFiscal(b.fim) }; }
    if (d.layoutRTC != null) {
      const l = objeto(d.layoutRTC, "Leiaute RTC"), c = objeto(l.campos, "Campos comprovados no provedor");
      const caminho = (v: unknown) => {
        const s = codigo(v, "Caminho documentado no provedor", /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*){0,2}$/, true);
        if (s && (s.length > 80 || s.split(".").some(p => ["constructor", "prototype"].includes(p)))) return falha("Caminho do leiaute RTC");
        return s;
      };
      r.layoutRTC = { codigo: enumValor(l.codigo, ["NT2026.008"], "Leiaute oficial"), homologacaoComprovada: booleano(l.homologacaoComprovada, "Homologação do leiaute"), evidenciaHomologacao: textoFiscal(l.evidenciaHomologacao ?? "", "Evidência do leiaute no provedor", 2000, false), campos: { valorProdutoLiquido: caminho(c.valorProdutoLiquido), valorUnitarioLiquido: caminho(c.valorUnitarioLiquido), valorLiquidoProdutosTotal: caminho(c.valorLiquidoProdutosTotal), valorTotalItem: caminho(c.valorTotalItem), valorTotalDocumento: caminho(c.valorTotalDocumento) } };
      if (r.layoutRTC.homologacaoComprovada && (r.layoutRTC.evidenciaHomologacao.length < 15 || Object.values(r.layoutRTC.campos).some(v => !v))) return falha("Homologação e mapeamento completos do leiaute RTC");
      const { valorProdutoLiquido: produto, valorUnitarioLiquido: unitario, valorTotalItem: item, valorLiquidoProdutosTotal: produtos, valorTotalDocumento: total } = r.layoutRTC.campos;
      if ([produto, unitario, item].filter(Boolean).length !== new Set([produto, unitario, item].filter(Boolean)).size || produtos && produtos === total) return falha("Campos distintos do leiaute RTC");
      for (const caminhos of [[produto, unitario, item], [produtos, total]]) {
        const definidos = caminhos.filter((v): v is string => !!v);
        if (definidos.some((a, i) => definidos.some((b, j) => i !== j && (a.startsWith(b + ".") || b.startsWith(a + "."))))) return falha("Caminhos independentes do leiaute RTC");
      }
    }
    return r;
  }
  if (tipo === "REGRA") {
    const r: RegraFiscal = { estabelecimento: id(d.estabelecimento, "Estabelecimento")!, regime: regime(d.regime), operacao: enumValor(d.operacao, ["VENDA"], "Operação"), ufDestino: codigo(d.ufDestino, "UF destino", /^[A-Z]{2}$/)!, destinatario: enumValor(d.destinatario, ["CONSUMIDOR_FINAL", "CONTRIBUINTE"], "Destinatário"), grupo: grupo(d.grupo), produtoId: alvoRegra(d.produtoId), natureza: d.natureza == null || d.natureza === "" ? null : natureza(d.natureza), ncm: codigo(d.ncm, "NCM", /^\d{8}$/, true), cfop: codigo(d.cfop, "CFOP", /^[567]\d{3}$/)!, csosn: codigo(d.csosn, "CSOSN", /^\d{3}$/, true), icms: tributo(d.icms, "ICMS"), pis: tributo(d.pis, "PIS"), cofins: tributo(d.cofins, "COFINS"), ipi: d.ipi == null ? null : tributo(d.ipi, "IPI"), st: enumValor(d.st, ["NAO_APLICAVEL", "RETIDO_ANTERIORMENTE", "CALCULO_PENDENTE"], "ST"), cest: codigo(d.cest, "CEST", /^\d{7}$/, true), segregacaoReceita: textoFiscal(d.segregacaoReceita, "Segregação contábil", 120), reforma: null, seletivo: enumValor(d.seletivo, ["NAO_APLICAVEL", "ANALISE_PENDENTE"], "Imposto Seletivo") };
    if (r.regime === "SIMPLES_NACIONAL" && (!r.csosn || r.icms.modalidade !== "SEM_DESTAQUE")) return falha("CSOSN e ICMS do Simples");
    if (r.regime === "LUCRO_PRESUMIDO" && r.csosn) return falha("CST ICMS do regime normal");
    if (r.st === "RETIDO_ANTERIORMENTE" && !r.cest) return falha("CEST/ST comprovado");
    if (d.evidenciaSt !== undefined) r.evidenciaSt = textoFiscal(d.evidenciaSt, "Evidência de retenção ST", 2000);
    if (d.reforma != null) { const b = objeto(d.reforma, "IBS/CBS"); r.reforma = { cst: codigo(b.cst, "CST IBS/CBS", /^\d{3}$/)!, cClassTrib: codigo(b.cClassTrib, "cClassTrib", /^\d{6}$/)!, cbs: percentualFiscal(b.cbs, "CBS"), ibsUf: percentualFiscal(b.ibsUf, "IBS UF"), ibsMunicipio: percentualFiscal(b.ibsMunicipio, "IBS Município"), reducao: percentualFiscal(b.reducao, "Redução IBS/CBS"), justificativa: textoFiscal(b.justificativa, "Fundamentação IBS/CBS", 2000) }; }
    if (r.reforma && objeto(d.reforma, "IBS/CBS").preco2027 != null) {
      const p = objeto(objeto(d.reforma, "IBS/CBS").preco2027, "Preço final inclusivo de 2027");
      r.reforma.preco2027 = { baseIcms: enumValor(p.baseIcms, ["BRUTA", "LIQUIDA_RTC"], "Base ICMS com RTC"), rateio: enumValor(p.rateio, ["SEM_ACRESCIMOS", "PROPORCIONAL_BRUTO"], "Composição dos tributos no produto/acessórios"), justificativa: textoFiscal(p.justificativa, "Fundamentação da decomposição do preço", 2000) };
      if (r.reforma.preco2027.justificativa.length < 15) return falha("Fundamentação da decomposição do preço");
      if (p.excecaoBaseLiquida != null) {
        const e = objeto(p.excecaoBaseLiquida, "Exceção normativa da base líquida"), inicio = dataFiscal(e.vigenciaInicio), fim = e.vigenciaFim == null || e.vigenciaFim === "" ? null : dataFiscal(e.vigenciaFim);
        const fonte = textoFiscal(e.fonteNormativa, "Fonte normativa da exceção", 2000);
        let oficial = false;
        try { const u = new URL(fonte); oficial = u.protocol === "https:" && /(^|\.)(gov\.br|fazenda\.sp\.gov\.br)$/.test(u.hostname) && !u.username && !u.password; } catch {}
        if (!oficial || fim && fim < inicio) return falha("Fonte e vigência da exceção normativa");
        r.reforma.preco2027.excecaoBaseLiquida = { uf: codigo(e.uf, "UF da exceção", /^[A-Z]{2}$/)!, vigenciaInicio: inicio, vigenciaFim: fim, fonteNormativa: fonte, ato: textoFiscal(e.ato, "Identificação do ato normativo", 2000), justificativa: textoFiscal(e.justificativa, "Fundamento da exceção", 2000) };
        if (r.reforma.preco2027.excecaoBaseLiquida.ato.length < 15 || r.reforma.preco2027.excecaoBaseLiquida.justificativa.length < 15) return falha("Ato e fundamento da exceção");
      }
    }
    if (d.grupoFiscalId !== undefined) r.grupoFiscalId = id(d.grupoFiscalId, "Grupo cadastrado", true);
    if (d.modelo !== undefined) r.modelo = enumValor(d.modelo, ["55", "65"] as const, "Modelo da regra");
    if (d.habilitada !== undefined) r.habilitada = booleano(d.habilitada, "Habilitação da regra");
    return r;
  }
  if (tipo === "COMPLEMENTO") {
    const r: ComportamentoFiscal = { opcaoId: id(d.opcaoId, "Opção")!, comportamento: enumValor(d.comportamento, ["INCLUIDO", "INTEGRADO", "MERCADORIA", "APRESENTACAO"], "Comportamento"), produtoId: id(d.produtoId, "Produto fiscal", true), justificativa: textoFiscal(d.justificativa, "Tratamento do complemento", 2000) };
    if (r.comportamento === "MERCADORIA" && !r.produtoId) return falha("Mercadoria adicional");
    if (d.escolhas !== undefined) {
      r.escolhas = lista(d.escolhas, "Configuração da mercadoria adicional", 20).map(x => { const e = objeto(x, "Escolha da mercadoria"); return { opcaoId: id(e.opcaoId, "Opção fixa")!, grupoId: id(e.grupoId, "Grupo fixo")!, quantidade: quantidade(e.quantidade, "Quantidade fixa documentada") }; });
      if (r.comportamento !== "MERCADORIA" || !r.escolhas.length || new Set(r.escolhas.map(e => e.opcaoId)).size !== r.escolhas.length) return falha("Configuração explícita de mercadoria adicional");
    }
    return r;
  }
  const tabela = enumValor(d.tabela, ["NCM", "CFOP", "CSOSN", "CST_ICMS", "CST_PIS_COFINS", "CST_IPI", "CEST", "CST_IBSCBS", "CCLASSTRIB"], "Tabela oficial");
  const tamanhos = { NCM: 8, CFOP: 4, CSOSN: 3, CST_ICMS: 2, CST_PIS_COFINS: 2, CST_IPI: 2, CEST: 7, CST_IBSCBS: 3, CCLASSTRIB: 6 };
  const r: TabelaFiscal = { tabela, referencia: textoFiscal(d.referencia, "Referência/versionamento oficial", 1000), completa: booleano(d.completa, "Tabela completa"), linhas: lista(d.linhas, "Linhas oficiais", 20000).map(v => { const l = objeto(v, "Linha da tabela"); return { codigo: codigo(l.codigo, "Código oficial", new RegExp(`^\\d{${tamanhos[tabela]}}$`))!, descricao: textoFiscal(l.descricao, "Descrição oficial", 2000), ...(l.ncm !== undefined ? { ncm: lista(l.ncm, "Compatibilidade NCM", 100).map(v => codigo(v, "NCM da tabela", /^\d{8}$/)!) } : {}), ...(l.cst !== undefined ? { cst: codigo(l.cst, "Compatibilidade CST", /^\d{2,3}$/)! } : {}), ...(l.regimes !== undefined ? { regimes: lista(l.regimes, "Regimes", 2).map(regime) } : {}), ...(l.modelos !== undefined ? { modelos: lista(l.modelos, "Modelos", 2).map(v => enumValor(v, ["55", "65"], "Modelo")) } : {}), ...(l.aliquota !== undefined ? { aliquota: percentualFiscal(l.aliquota, "Alíquota oficial") } : {}), ...(l.reducao !== undefined ? { reducao: percentualFiscal(l.reducao, "Redução oficial") } : {}) }; }) };
  if (!r.linhas.length || new Set(r.linhas.map(l => l.codigo)).size !== r.linhas.length) return falha("Tabela vazia ou códigos repetidos"); return r;
}
export function validarSalvarVersaoFiscal(entrada: unknown): SalvarVersaoFiscalEntrada & { dados: DadosVersaoFiscal } {
  const d = objeto(entrada, "Versão fiscal");
  const tipo = enumValor(d.tipo, ["CLASSIFICACAO", "PERFIL", "REGRA", "TABELA", "COMPLEMENTO"], "Tipo");
  const dados = validarDadosFiscais(tipo, d.dados);
  const interna = tipo === "CLASSIFICACAO" ? (dados as ClassificacaoFiscal).referenciaInternaInsumoId : undefined;
  const chave = interna ? textoFiscal(d.chave, "Chave interna", 107) : id(d.chave, "Chave")!;
  if (!Number.isSafeInteger(d.versaoBase) || Number(d.versaoBase) < 0) return falha("Versão de base");
  const fontes = strings(d.fontes, "Fontes", 50); const justificativa = textoFiscal(d.justificativa, "Justificativa", 4000);
  if (tipo === "CLASSIFICACAO" && (interna ? `INSUMO:${interna}` : (dados as ClassificacaoFiscal).produtoId) !== chave || tipo === "COMPLEMENTO" && (dados as ComportamentoFiscal).opcaoId !== chave || tipo === "PERFIL" && (dados as PerfilFiscal).estabelecimento !== chave || tipo === "TABELA" && (dados as TabelaFiscal).tabela !== chave) return falha("Chave da configuração");
  if (tipo === "TABELA" && !fontes.some(f => { try { const u = new URL(f); return u.protocol === "https:" && /(^|\.)(gov\.br|fazenda\.sp\.gov\.br)$/.test(u.hostname); } catch { return false; } })) return falha("Fonte oficial da tabela");
  return { tipo, chave, dados, versaoBase: Number(d.versaoBase), vigenciaInicio: dataFiscal(d.vigenciaInicio), fontes, justificativa, chaveOperacao: id(d.chaveOperacao, "Chave de idempotência")! };
}
