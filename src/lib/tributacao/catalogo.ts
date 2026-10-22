/** Auditoria do catálogo: sugere organização e conserva pendências por mercadoria.
 * NCM de um ingrediente nunca é convertido em NCM de uma preparação ou cesta. */
export type CodigoGrupoFiscal = `GF${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12"}`;
export type ClassificacaoCatalogoFiscal = {
  produtoId: string; grupo: CodigoGrupoFiscal | null;
  natureza: "PREPARADO" | "REVENDA" | "FRACIONADO" | "SERVICO";
  tratamento: "NORMAL" | "KIT_COMPOSTO" | "OPCAO_CONFIGURACAO";
  ncm: string | null; origem: string | null; cest: string | null; unidade: string;
  estado: "CONFIRMADO" | "PENDENTE"; evidencias: string[]; pendencias: string[];
  componentesKit?: { produtoId: string; quantidade: string; pesoRateio: string }[];
};
export type ComponenteAuditoriaFiscal = { insumoId: string; quantidade: string; unidade: string };
export type ProdutoAuditoriaFiscal = {
  id: string; codigo: string | null; nome: string; descricao?: string | null;
  especificacao?: string | null; tipo: string; classificacoes: string[];
  ativo: boolean; versao: number; unidade: string; modoPreparo?: string | null;
  fiscal: Record<string, unknown>; fiscalRevisado: boolean;
  categorias: { id: string; nome: string }[]; componentes: ComponenteAuditoriaFiscal[];
  grupos: { grupoId: string; opcoesExcluidas?: string[]; ajustesOpcoes?: unknown }[];
};
export type InsumoAuditoriaFiscal = {
  id: string; nome: string; especificacao?: string | null; tipo: string; unidade: string;
  ativo: boolean; excluidoEm?: string | null; marca?: string | null;
  codigoEan?: string | null; rendimentoQuantidade?: string | null;
  rendimentoUnidade?: string | null; modoPreparo?: unknown;
};
export type EvidenciaNcmEntrada = {
  itemNotaId: string; notaFiscalId: string; numeroItem: number;
  insumoId: string | null; descricaoProduto: string; ncm: string | null;
  codigoProdutoFornecedor?: string; codigoEan?: string | null;
  dataEmissao: string | null; origem?: string | null; cest?: string | null;
  cstIcms?: string | null; csosn?: string | null;
};
export type CatalogoAuditoriaFiscal = {
  geradoEm: string; origem: string; produtos: ProdutoAuditoriaFiscal[];
  insumos: InsumoAuditoriaFiscal[]; evidenciasNcmEntrada: EvidenciaNcmEntrada[];
  composicoesPreparacoes: { produtoId: string; componenteId: string; quantidade: string }[];
  gruposComplementos: { id: string; nome: string; tipo: string; ativo: boolean; versao?: number }[];
  opcoes: { id: string; grupoId: string; nome: string; produtoId: string | null;
    ativo: boolean; preco: string; quantidade: string; composicao?: ComponenteAuditoriaFiscal[] | null }[];
};
export type TabelaNcmAuditoria = {
  fonte: string; dataReferencia: string;
  Nomenclaturas: { Codigo: string; Descricao: string; Data_Inicio: string; Data_Fim: string }[];
};
export type ReferenciaNcmAuditoria = {
  codigo: string; descricao: string; hierarquia: { codigo: string; descricao: string }[];
  inicio: string; fim: string; vigente: boolean; fonte: string; dataReferencia: string;
};
export type DeclaracaoOperacionalFiscal = {
  produtoId: string; natureza: "PREPARADO"; apresentacao: "PRONTO_CONSUMO";
  descricao: string; fonte: string; data: string;
};
export type LinhaMatrizFiscal = {
  produtoId: string; sku: string | null; referencia: string; descricao: string;
  avisos: string[];
  categorias: string[]; classificacoes: string[]; versaoCadastro: number;
  composicao: { insumoId: string; nome: string; tipo: string; quantidade: string; unidade: string;
    ncmEntrada: string[]; evidencias: EvidenciaNcmEntrada[] }[];
  classificacao: ClassificacaoCatalogoFiscal;
  referenciasNcm: ReferenciaNcmAuditoria[];
  escolhas: { opcaoId: string; grupoId: string; grupo: string;
    comportamento: "INCLUIDO" | "INTEGRADO_A_ANALISAR" | "MERCADORIA" | "APRESENTACAO_A_ANALISAR";
    preco: string }[];
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const textoFiscal = (p: ProdutoAuditoriaFiscal, campo: string) => typeof p.fiscal[campo] === "string" ? (p.fiscal[campo] as string).trim() : "";
const valoresUnicos = (lista: (string | null | undefined)[]) => [...new Set(lista.filter((s): s is string => typeof s === "string" && !!s))];

/** Confronta código e vigência sem certificar que a mercadoria satisfaz a descrição. */
export function consultarNcmAuditoria(codigo: string, tabela: TabelaNcmAuditoria): ReferenciaNcmAuditoria | null {
  if (!/^\d{8}$/.test(codigo) || !/^\d{4}-\d{2}-\d{2}$/.test(tabela.dataReferencia)) return null;
  const limparCodigo = (s: string) => s.replace(/\D/g, "");
  const n = tabela.Nomenclaturas.find(n => limparCodigo(n.Codigo) === codigo);
  if (!n) return null;
  const data = (s: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
  const descricao = (s: string) => s.replace(/<[^>]*>/g, "");
  const inicio = data(n.Data_Inicio), fim = data(n.Data_Fim);
  return { codigo, descricao: descricao(n.Descricao), inicio, fim, fonte: tabela.fonte,
    dataReferencia: tabela.dataReferencia, vigente: !!inicio && !!fim && inicio <= tabela.dataReferencia && tabela.dataReferencia <= fim,
    hierarquia: tabela.Nomenclaturas.filter(p => { const cod = limparCodigo(p.Codigo); return cod.length < 8 && codigo.startsWith(cod); })
      .map(p => ({ codigo: p.Codigo, descricao: descricao(p.Descricao) })).sort((a, b) => a.codigo.length - b.codigo.length) };
}

/** Grupo operacional é sugestão, sem fornecer um código ou benefício tributário. */
export function sugerirGrupoFiscal(produto: ProdutoAuditoriaFiscal, insumos: InsumoAuditoriaFiscal[]): CodigoGrupoFiscal | null {
  const nomeProduto = normalizar(produto.nome);
  const nomes = normalizar(`${produto.nome} ${produto.categorias.map(c => c.nome).join(" ")}`);
  if (/servico|locacao|montagem de evento/.test(nomes)) return "GF12";
  if (/vinho|espumante|licor/.test(nomeProduto)) return "GF10";
  if (/cerveja|leopoldina|pilsner|pilsener/.test(nomeProduto)) return "GF09";
  if (/vinho|espumante|licor|carmen insigne|catena malbec/.test(nomes)) return "GF10";
  if (/suco|refrigerante|agua mineral|nao alcoolicos/.test(nomes)) return "GF07";
  if (/cafe preparado|cha preparado|drink|coquetel/.test(nomes)) return "GF08";
  if (/embalagem|utensilio|talher|tabua vazia/.test(nomes)) return "GF11";
  if (/grazing|grazings|granzing|bufala rolls|t[aá]bua de frios/.test(nomes)) return "GF01";
  if (/bolo|cookie|bombom/.test(nomes)) return "GF03";
  if (/torta|folhado|sanduiche|pao de queijo|paes de queijo/.test(nomes)) return "GF02";
  if (/frutas frescas|fruta fresca/.test(nomes)) return "GF05";
  const componentes = produto.componentes.map(c => insumos.find(i => i.id === c.insumoId));
  if (componentes.length === 1 && componentes[0]?.tipo === "PRODUTO_INTERMEDIARIO") return "GF04";
  if (componentes.length === 1 && componentes[0]?.tipo === "INSUMO") {
    return produto.componentes[0].unidade === "UN" && /^1(?:\.0+)?$/.test(produto.componentes[0].quantidade) ? "GF06" : "GF05";
  }
  return null;
}

function naturezaSugerida(p: ProdutoAuditoriaFiscal, grupo: CodigoGrupoFiscal | null, insumos: InsumoAuditoriaFiscal[]): ClassificacaoCatalogoFiscal["natureza"] {
  if (grupo === "GF12") return "SERVICO";
  if (grupo === "GF09" || grupo === "GF10" || grupo === "GF07" || grupo === "GF11") return "REVENDA";
  if (grupo === "GF01" || grupo === "GF02" || grupo === "GF03" || grupo === "GF04" || grupo === "GF08") return "PREPARADO";
  const simples = p.componentes.length === 1 && insumos.find(i => i.id === p.componentes[0].insumoId)?.tipo === "INSUMO";
  if (simples) return grupo === "GF06" ? "REVENDA" : "FRACIONADO";
  return "PREPARADO";
}

function escolhasProduto(p: ProdutoAuditoriaFiscal, catalogo: CatalogoAuditoriaFiscal): LinhaMatrizFiscal["escolhas"] {
  return catalogo.opcoes.filter(o => o.ativo && o.produtoId === p.id).flatMap(o => {
    const g = catalogo.gruposComplementos.find(g => g.id === o.grupoId && g.ativo);
    if (!g) return [];
    const apresentacao = /embalagem|pote|tabua|bandeja/.test(normalizar(g.nome));
    return [{ opcaoId: o.id, grupoId: g.id, grupo: g.nome, preco: o.preco,
      comportamento: apresentacao ? "APRESENTACAO_A_ANALISAR" as const :
        g.tipo === "COMPLEMENTAR" ? "MERCADORIA" as const :
          g.tipo === "EXTRAS" ? "INTEGRADO_A_ANALISAR" as const : "INCLUIDO" as const }];
  });
}

/** Toda pendência cita a característica ausente. A sugestão nunca ativa a emissão. */
export function criarMatrizFiscalCatalogo(catalogo: CatalogoAuditoriaFiscal, tabelaNcm?: TabelaNcmAuditoria, declaracoes: DeclaracaoOperacionalFiscal[] = []): LinhaMatrizFiscal[] {
  const insumos = new Map(catalogo.insumos.map(i => [i.id, i]));
  const evidenciaPorInsumo = new Map<string, EvidenciaNcmEntrada[]>();
  for (const e of catalogo.evidenciasNcmEntrada) if (e.insumoId) {
    evidenciaPorInsumo.set(e.insumoId, [...(evidenciaPorInsumo.get(e.insumoId) ?? []), e]);
  }
  return catalogo.produtos.filter(p => p.ativo).map(p => {
    const composicao = p.componentes.map(c => {
      const i = insumos.get(c.insumoId), evidencias = evidenciaPorInsumo.get(c.insumoId) ?? [];
      return { ...c, nome: i?.nome ?? "Insumo não encontrado", tipo: i?.tipo ?? "DESCONHECIDO", evidencias,
        ncmEntrada: valoresUnicos(evidencias.map(e => e.ncm)).filter(n => /^\d{8}$/.test(n)) };
    });
    const escolhas = escolhasProduto(p, catalogo);
    const grupo = sugerirGrupoFiscal(p, catalogo.insumos);
    const declaracao = declaracoes.find(d => d.produtoId === p.id && d.natureza === "PREPARADO" && d.apresentacao === "PRONTO_CONSUMO" && d.descricao.trim() && d.fonte.trim() && /^\d{4}-\d{2}-\d{2}$/.test(d.data));
    const natureza = declaracao ? "PREPARADO" : naturezaSugerida(p, grupo, catalogo.insumos);
    const soConfiguracao = !p.classificacoes.includes("PRINCIPAL") && escolhas.length > 0 && escolhas.every(e => e.comportamento === "INCLUIDO");
    // Nome comercial e receita não comprovam venda de mercadorias separadas.
    // Kits exigem classificação explícita; a auditoria não os cria por palavras no nome.
    const tratamento = soConfiguracao ? "OPCAO_CONFIGURACAO" : "NORMAL";
    const simples = composicao.length === 1 && composicao[0].tipo === "INSUMO" && natureza !== "PREPARADO";
    const candidatos = simples ? composicao[0].ncmEntrada : [];
    const atual = textoFiscal(p, "ncm");
    const ncm = /^\d{8}$/.test(atual) ? atual : candidatos.length === 1 ? candidatos[0] : null;
    const origemAtual = textoFiscal(p, "origem"), cestAtual = textoFiscal(p, "cest");
    const origem = /^[0-8]$/.test(origemAtual) ? origemAtual : null;
    const cest = /^\d{7}$/.test(cestAtual) ? cestAtual : null;
    const referenciasNcm = tabelaNcm ? valoresUnicos([...composicao.flatMap(c => c.ncmEntrada), ncm])
      .flatMap(c => { const r = consultarNcmAuditoria(c, tabelaNcm); return r ? [r] : []; }) : [];
    const pendencias: string[] = [];
    const evidencias = composicao.flatMap(c => c.evidencias.map(e => `NF_ENTRADA:${e.itemNotaId}:item=${e.numeroItem}:NCM=${e.ncm ?? "ausente"}`));
    evidencias.push(`CADASTRO:${p.id}:versao=${p.versao}`);
    const avisos = !p.codigo ? ["Código comercial/SKU ausente; usar ID para rastreio sem criar código artificial."] : [];
    if (!grupo) pendencias.push("Definir grupo operacional com base nas características do produto.");
    if (!p.componentes.length) pendencias.push("Composição base quantitativa ausente; discriminar ingredientes, mercadorias e embalagem, incluindo itens fixos fora das escolhas.");
    if (candidatos.length > 1) pendencias.push(`NCM divergente nas entradas do mesmo insumo: ${candidatos.join(", ")}; conferir identidade/características de cada mercadoria.`);
    if (!ncm && !soConfiguracao) pendencias.push(natureza === "PREPARADO" ? "NCM do produto final não comprovado; informar formulação, transformação/processo e apresentação, e confrontar notas legais/NESH." : "NCM sem evidência suficiente; obter XML vinculado ou características técnicas do produto comercializado.");
    if (simples && candidatos.length && !atual) pendencias.push("NCM da entrada é candidato; confirmar que a venda preserva as características e verificar o código vigente na tabela oficial.");
    if (ncm && tabelaNcm) {
      const referencia = consultarNcmAuditoria(ncm, tabelaNcm);
      if (!referencia || !referencia.vigente) pendencias.push(`NCM ${ncm} ausente ou não vigente na tabela oficial para ${tabelaNcm.dataReferencia}.`);
      else evidencias.push(`NCM_OFICIAL:${ncm}:vigencia=${referencia.inicio}..${referencia.fim}:consulta=${referencia.dataReferencia}:fonte=${referencia.fonte}`);
    }
    if (ncm && /^040690(10|20|30)$/.test(ncm)) pendencias.push("Comprovar teor de umidade em peso para o desdobramento 0406.90; o nome do queijo não determina sozinho 10, 20 ou 30.");
    if (ncm === "02101900" || ncm === "16024100") pendencias.push("Presunto: comprovar corte, presença de osso, cura/salga/secagem e eventual cozimento/preparação para distinguir posições 0210 e 1602.");
    if (!origem && !soConfiguracao) pendencias.push("Origem tributária da mercadoria vendida ausente; confirmar nacional/importada e modalidade da aquisição. Origem do fornecedor não é copiada automaticamente.");
    if (simples && valoresUnicos(composicao[0].evidencias.map(e => e.origem)).length > 1) pendencias.push("Entradas do mesmo insumo têm origens tributárias distintas; identificar lote/marca realmente vendido ou segregar o cadastro. Não escolher uma origem geral para o estoque misturado.");
    if (natureza !== "SERVICO" && !p.fiscalRevisado && !soConfiguracao) pendencias.push("Classificação fiscal individual ainda sem validação técnica interna registrada.");
    if (declaracao) evidencias.push(`DECLARACAO_OPERACIONAL:${declaracao.data}:${declaracao.fonte}:${declaracao.descricao}`);
    if (grupo === "GF01") pendencias.push(declaracao ? "Preparação pronta para consumo comprovada por declaração operacional; obter formulação quantitativa e características determinantes para aplicar RGI/notas legais/NESH ao produto final." :
      "Distinguir preparação alimentar final de conjunto de mercadorias: confirmar cortes, mistura/preparo, proporções e apresentação para classificação legal da tábua.");
    if (grupo === "GF12") pendencias.push("Definir serviço efetivamente prestado, município e código de serviço; separar alimentos e verificar emissor NFS-e real.");
    if (escolhas.some(e => e.comportamento === "INTEGRADO_A_ANALISAR")) pendencias.push("Definir por vínculo se extra cobrado integra a preparação ou constitui mercadoria vendida separadamente.");
    if (escolhas.some(e => e.comportamento === "APRESENTACAO_A_ANALISAR")) pendencias.push("Definir se apresentação/embalagem é acessória ao produto ou mercadoria separada, com valor correspondente.");
    if (simples && candidatos.includes("22041010")) pendencias.push("Entrada registra 22041010: comprovar método de produção e características de tipo champanha (champagne) versus outros vinhos espumantes; nome comercial e nacionalidade não resolvem o desdobramento.");
    if (composicao.some(c => c.tipo === "PRODUTO_INTERMEDIARIO")) {
      evidencias.push(...composicao.filter(c => c.tipo === "PRODUTO_INTERMEDIARIO").map(c => `FICHA_PREPARACAO:${c.insumoId}`));
      for (const c of composicao.filter(c => c.tipo === "PRODUTO_INTERMEDIARIO")) {
        const i = insumos.get(c.insumoId), receita = catalogo.composicoesPreparacoes.filter(r => r.produtoId === c.insumoId);
        if (!receita.length || !i?.rendimentoQuantidade) pendencias.push(`Preparação ${c.nome}: composição ou rendimento ausente.`);
        if (!Array.isArray(i?.modoPreparo) || !i.modoPreparo.length) pendencias.push(`Preparação ${c.nome}: processo de produção ausente.`);
      }
    }
    return { produtoId: p.id, sku: p.codigo, referencia: p.codigo || p.id, descricao: p.nome, avisos,
      categorias: p.categorias.map(c => c.nome), classificacoes: p.classificacoes, versaoCadastro: p.versao,
      composicao, escolhas, referenciasNcm, classificacao: { produtoId: p.id, grupo, natureza, tratamento, ncm, origem, cest,
        unidade: p.unidade, estado: "PENDENTE", evidencias: valoresUnicos(evidencias), pendencias: valoresUnicos(pendencias) } };
  });
}

/** Cobertura usa classificações vigentes previamente resolvidas no servidor. */
export function resumirCoberturaFiscal(
  produtos: { id: string; ativo: boolean; codigo?: string | null }[],
  classificacoes: ClassificacaoCatalogoFiscal[],
) {
  const porProduto = new Map(classificacoes.map(c => [c.produtoId, c]));
  const ativos = produtos.filter(p => p.ativo);
  const linhas = ativos.map(p => {
    const c = porProduto.get(p.id);
    const configuracao = c?.tratamento === "OPCAO_CONFIGURACAO";
    const pendente = !c || (!configuracao && (c.estado !== "CONFIRMADO" || c.pendencias.length > 0 || !c.grupo ||
      (c.natureza !== "SERVICO" && (!c.ncm || !/^\d{8}$/.test(c.ncm) || !c.origem))));
    return { produtoId: p.id, referencia: p.codigo || p.id, estado: configuracao ? "CONFIGURACAO" as const : pendente ? "PENDENTE" as const : "COBERTO" as const,
      grupo: c?.grupo ?? null, pendencias: c?.pendencias ?? ["Classificação fiscal vigente ausente."] };
  });
  return { totalAtivos: ativos.length, cobertos: linhas.filter(l => l.estado === "COBERTO").length,
    pendentes: linhas.filter(l => l.estado === "PENDENTE").length,
    opcoesConfiguracao: linhas.filter(l => l.estado === "CONFIGURACAO").length,
    semSku: ativos.filter(p => !p.codigo).length, linhas };
}
