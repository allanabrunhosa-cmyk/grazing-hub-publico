import { Prisma } from "@/generated/prisma/client";
import type { ClassificacaoFiscal, ComportamentoFiscal, ContextoFiscal, ItemComercialFiscal, LinhaFiscalCalculada, PerfilFiscal, PreviaTributacao, RegraFiscal, TabelaFiscal, TributoConfigurado, VersaoFiscalDto } from "./tipos";
import { dataFiscal, ErroEstruturaFiscal } from "./validacao";
import { gtinValido } from "./gtin";
import { decomporOperacaoPrecoRtc, ErroPrecoRtc } from "./preco-rtc";
import { layoutRtcComprovado } from "./layout-rtc";
import { excecaoBaseLiquidaComprovada } from "./preco-rtc-politica";
import { resolverNcmConfiguracao } from "./ncm-configuracao";
import { hashTecnico, type FotografiaReceitaFiscal } from "./fotografia-tecnica";
import { resolverReferenciaInterna, type InsumoReferenciaFiscal } from "./referencia-interna";
import { conferirPoliticaKit } from "./fotografia-kit";
import { conferirFciFiscal } from "./fci";
import { AVISO_DECLARACAO_FCI } from "./declaracao-fci";
const D = Prisma.Decimal;
export function valorFiscal(v: string, quantidade = false) {
  if (typeof v !== "string" || !(quantidade ? /^\d{1,12}(\.\d{1,6})?$/ : /^\d{1,12}(\.\d{1,2})?$/).test(v)) throw new ErroEstruturaFiscal("Valor ou quantidade fora da precisão fiscal.");
  return new D(v);
}
/** Cada chave resolve a última versão ATIVA cuja vigência já chegou. Rascunhos
 * e versões futuras não alteram cálculos nem documentos históricos. */
export function versoesVigentes(versoes: VersaoFiscalDto[], data: string): VersaoFiscalDto[] {
  dataFiscal(data); const r = new Map<string, VersaoFiscalDto>();
  for (const v of versoes) {
    if (v.status !== "ATIVO" || v.vigenciaInicio > data) continue;
    const k = `${v.tipo}:${v.chave}`, a = r.get(k);
    if (!a || v.vigenciaInicio > a.vigenciaInicio || v.vigenciaInicio === a.vigenciaInicio && v.versao > a.versao) r.set(k, v);
  }
  return [...r.values()];
}
export function ratearFiscal(total: string, pesos: string[]): string[] {
  const centavos = valorFiscal(total).mul(100); const ps = pesos.map(p => valorFiscal(p, true));
  const soma = ps.reduce((a, b) => a.plus(b), new D(0));
  if (!pesos.length || ps.some(p => p.lte(0))) throw new ErroEstruturaFiscal("Rateio exige pesos positivos.");
  const parcelas = ps.map((p, i) => { const v = centavos.mul(p).div(soma); const inteiro = v.floor(); return { i, inteiro, resto: v.minus(inteiro) }; });
  let restantes = centavos.minus(parcelas.reduce((a, p) => a.plus(p.inteiro), new D(0))).toNumber();
  for (const p of [...parcelas].sort((a, b) => b.resto.comparedTo(a.resto) || a.i - b.i)) if (restantes-- > 0) p.inteiro = p.inteiro.plus(1);
  return parcelas.map(p => p.inteiro.div(100).toFixed(2));
}
type LinhaComercial = { id: string; produtoId: string; nome: string; quantidade: string; unidade: string; valor: string; referenciaInternaInsumoId?: string; contextoKit?: boolean; valorEscolhasDiscriminado?: boolean; unidadeSeparadaResolvida?: boolean; versoes: string[]; justificativas: string[]; escolhas?: ItemComercialFiscal["escolhas"]; receitaFotografada?: ItemComercialFiscal["receitaFotografada"]; fotografiaKitFiscal?: ItemComercialFiscal["fotografiaKitFiscal"]; classificacaoResolvida?: ClassificacaoFiscal; cenarioNcm?: LinhaFiscalCalculada["cenarioNcm"] };
export function calcularTributacao(contexto: ContextoFiscal, itens: ItemComercialFiscal[], versoes: VersaoFiscalDto[], catalogo: { id: string; nome: string; unidade: string }[] = [], tecnicasAtuais: { produtoId: string; fotografia: FotografiaReceitaFiscal }[] = [], insumos: InsumoReferenciaFiscal[] = []): PreviaTributacao {
  const vs = versoesVigentes(versoes, contexto.data); const pendencias: string[] = [];
  const adicionar = (s: string) => { if (!pendencias.includes(s)) pendencias.push(s); };
  const perfilV = vs.find(v => v.tipo === "PERFIL" && v.chave === contexto.estabelecimento);
  const perfil = perfilV?.dados as PerfilFiscal | undefined;
  const r: PreviaTributacao = { apto: false, pendencias, contexto, perfilId: perfilV?.id ?? null, regime: perfil?.regime ?? null, linhas: [], totalMercadorias: "0.00", justificativas: [] };
  if (!perfil) adicionar("Perfil do estabelecimento ausente na vigência da operação.");
  else {
    if (!perfil.confirmado || !perfil.evidenciaEnquadramento) adicionar("Confirmação cadastral do enquadramento ausente.");
    if (!perfil.modelos.includes(contexto.modelo)) adicionar("Modelo fiscal não habilitado neste perfil.");
    if (perfil.regime === "LUCRO_PRESUMIDO" && contexto.data < "2027-01-01") adicionar("Lucro Presumido de 2027 não pode ser antecipado.");
    if (perfil.reforma === "DISPENSADO_SIMPLES_2026" && (perfil.regime !== "SIMPLES_NACIONAL" || !contexto.data.startsWith("2026-"))) adicionar("Dispensa de IBS/CBS do Simples 2026 não se aplica a esta data/regime.");
    if (perfil.beneficioOpcional) adicionar("Regime opcional declarado exige apuração própria e elegibilidade vigente; o cálculo por item não ativa esse benefício.");
    if (contexto.data >= "2027-01-01" && perfil.reforma === "EXIGIR_REGRA" && !layoutRtcComprovado(perfil.layoutRTC)) adicionar("Layout RTC 2027 do provedor sem campos e homologação comprovados; configurar a versão NT2026.008 antes de emitir.");
    if (contexto.modelo === "65" && (contexto.ufDestino !== perfil.uf || contexto.destinatario !== "CONSUMIDOR_FINAL" || !(contexto.consumidorFinal ?? true))) adicionar("NFC-e exige consumidor final não contribuinte e operação interna compatível; utilize NF-e para a operação afetada.");
    if (perfil.regime === "LUCRO_PRESUMIDO" && contexto.ufDestino !== perfil.uf && contexto.destinatario === "CONSUMIDOR_FINAL") adicionar("Operação interestadual do regime normal exige DIFAL/FCP de destino parametrizados e cálculo próprio; não delegar cálculo automático ao emissor.");
    r.justificativas.push(`Perfil ${perfilV!.id}: ${perfil.regime}, vigência ${perfilV!.vigenciaInicio}.`);
  }
  const classificar = (produtoId: string) => vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId);
  const linhas: LinhaComercial[] = [];
  const composta = (a: string, b: string, nome: string) => {
    const q = valorFiscal(a, true).mul(valorFiscal(b, true));
    if (q.lte(0) || q.decimalPlaces() > 6 || q.gte("1000000000000")) { adicionar(`${nome}: quantidade composta não é representável na precisão fiscal de seis casas; confirmar conversão e unidade.`); return null; }
    return q.toFixed(6);
  };
  function expandir(linha: LinhaComercial, caminho: string[] = []) {
    const v = classificar(linha.produtoId); const c = v?.dados as ClassificacaoFiscal | undefined;
    if (!c) { adicionar(`${linha.nome}: classificação individual ausente.`); return; }
    if (c.estado !== "CONFIRMADO" || c.pendencias.length) adicionar(`${linha.nome}: ${c.pendencias.join("; ") || "características e evidências não confirmadas"}.`);
    if (c.tratamento === "OPCAO_CONFIGURACAO") { adicionar(`${linha.nome}: opção de configuração não é mercadoria independente; integrar à composição do produto principal.`); return; }
    if (c.natureza === "SERVICO" || c.grupo === "GF12") { adicionar(`${linha.nome}: serviço exige operação NFS-e própria, capacidade e município confirmados; não enviar como NF-e/NFC-e.`); return; }
    if (c.tratamento === "KIT_COMPOSTO") {
      if (!c.componentesKit?.length || caminho.includes(linha.produtoId) || caminho.length >= 10) { adicionar(`${linha.nome}: composição comercial do kit ausente ou circular.`); return; }
      if (!conferirPoliticaKit(c, linha.fotografiaKitFiscal)) { adicionar(`${linha.nome}: composição fiscal do kit não fotografada no pedido ou política de itens/quantidades/rateio alterada; conferir somente esta operação sem substituir o histórico pela composição atual.`); return; }
      const componentes = linha.fotografiaKitFiscal.componentes;
      const valores = ratearFiscal(linha.valor, componentes.map(x => x.pesoRateio));
      componentes.forEach((k, i) => {
        const quantidade = composta(linha.quantidade, k.quantidade, linha.nome);
        let mercadoria: { id: string; nome: string; unidade: string } | undefined;
        if (k.referenciaInternaInsumoId) {
          const id = `INSUMO:${k.referenciaInternaInsumoId}`, classificacao = classificar(id)?.dados as ClassificacaoFiscal | undefined;
          if (!classificacao) { adicionar(`${linha.nome}: classificação individual da referência interna ${k.referenciaInternaInsumoId} ausente.`); return; }
          try { const ref = resolverReferenciaInterna(classificacao, insumos.find(x => x.id === k.referenciaInternaInsumoId), k); mercadoria = { id: ref.codigo, nome: ref.nome, unidade: ref.unidade }; }
          catch (e) { adicionar(`${linha.nome}: ${e instanceof Error ? e.message : "Referência interna inválida."}`); return; }
        } else {
          const p = catalogo.find(p => p.id === k.produtoId);
          if (p && k.unidade && k.unidade !== p.unidade) { adicionar(`${linha.nome}: unidade documentada do componente diverge da unidade comercial; comprovar conversão antes de emitir.`); return; }
          if (p) mercadoria = { ...p, nome: k.descricao ?? p.nome };
        }
        if (!mercadoria) { adicionar(`${linha.nome}: descrição e unidade individuais da mercadoria ${k.produtoId ?? k.referenciaInternaInsumoId} ausentes.`); return; }
        const escolhas: ItemComercialFiscal["escolhas"] = (k.escolhas ?? []).map(e => ({ ...e, quantidadeEscolhida: e.quantidade, produtoId: null, nome: "Escolha documentada do componente", valor: "0.00" }));
        const fontesEscolhas: string[] = [];
        for (const e of escolhas) { const b = vs.find(v => v.tipo === "COMPLEMENTO" && v.chave === e.opcaoId); const comportamento = b?.dados as ComportamentoFiscal | undefined; if (!comportamento || !["INCLUIDO", "INTEGRADO"].includes(comportamento.comportamento)) adicionar(`${mercadoria.nome}: escolha do componente sem integração comprovada ao principal.`); else fontesEscolhas.push(b!.id); }
        if (quantidade) expandir({ ...linha, fotografiaKitFiscal: undefined, contextoKit: true, unidadeSeparadaResolvida: false, id: `${linha.id}:kit:${i}`, produtoId: mercadoria.id, nome: mercadoria.nome, unidade: mercadoria.unidade, quantidade, valor: valores[i], referenciaInternaInsumoId: k.referenciaInternaInsumoId, escolhas, receitaFotografada: k.receitaFotografada, versoes: [...linha.versoes, v!.id, ...fontesEscolhas], justificativas: [...linha.justificativas, `Kit fotografado originalmente na classificação ${linha.fotografiaKitFiscal!.classificacaoVersaoId}; ${linha.nome} discriminado em ${mercadoria.nome}; rateio de ${valores[i]} pelo peso ${k.pesoRateio}, sem alterar o total.`] }, [...caminho, linha.produtoId]);
      });
      return;
    }
    if (c.configuracaoNcm?.modoFiscal === "UNIDADES_SEPARADAS" && !linha.unidadeSeparadaResolvida) {
      const todas = linha.escolhas ?? [], es = todas.filter(e => c.configuracaoNcm!.grupoIds.includes(e.grupoId ?? ""));
      const valorDiscriminado = linha.contextoKit || linha.valorEscolhasDiscriminado;
      if (!es.length || valorDiscriminado && es.length !== 1) { adicionar(`${linha.nome}: unidades separadas exigem opções individualizadas; configuração multissabor exige componentes/rateios documentados separados.`); return; }
      const valores = es.map(e => valorDiscriminado ? linha.valor : e.valor);
      if (!valores.reduce((t,v) => t.plus(valorFiscal(v)), new D(0)).equals(linha.valor)) { adicionar(`${linha.nome}: valores das unidades separadas não fecham com o total comercial; base ou custo não discriminado exige análise, sem rateio presumido.`); return; }
      for (const [n,e] of es.entries()) {
        const quantidade = e.quantidadeEscolhida && composta(linha.quantidade, e.quantidadeEscolhida, linha.nome);
        if (!quantidade) { adicionar(`${linha.nome}: quantidade escolhida por unidade separada ausente.`); continue; }
        expandir({ ...linha, id: `${linha.id}:unidade:${e.opcaoId}`, nome: valorDiscriminado ? linha.nome : `${linha.nome} — ${e.nome}`, quantidade, valor: valores[n], unidadeSeparadaResolvida: true, escolhas: [{ ...e, quantidadeEscolhida: "1" }, ...todas.filter(x => !c.configuracaoNcm!.grupoIds.includes(x.grupoId ?? ""))], justificativas: [...linha.justificativas, `Opção ${e.opcaoId} representa mercadoria individual, quantidade do pedido ${linha.quantidade} × ${e.quantidadeEscolhida}, conforme análise versionada; valores comerciais preservados.`] }, caminho);
      }
      return;
    }
    if (linha.unidade !== c.unidade) adicionar(`${linha.nome}: unidade comercial ${linha.unidade || "ausente"} diverge da unidade fiscal ${c.unidade}; comprovar unidade e conversão antes de emitir.`);
    const resolucao = resolverNcmConfiguracao(c, linha.escolhas ?? [], v!.id, linha.receitaFotografada, tecnicasAtuais.find(t => t.produtoId === linha.produtoId)?.fotografia);
    for (const p of resolucao.pendencias) adicionar(`${linha.nome}: ${p}`);
    linhas.push({ ...linha, classificacaoResolvida: resolucao.classificacao, cenarioNcm: resolucao.cenarioNcm, justificativas: [...linha.justificativas, ...resolucao.justificativas], versoes: [...linha.versoes, v!.id] });
  }
  for (const item of itens) {
    const quantidade = valorFiscal(item.quantidade, true); if (quantidade.lte(0)) throw new ErroEstruturaFiscal("Quantidade fiscal deve ser positiva.");
    let principal = valorFiscal(item.total); const separado: LinhaComercial[] = [];
    const versoesIntegradas: string[] = []; const justificativasIntegradas: string[] = [];
    for (const e of item.escolhas) {
      const valor = valorFiscal(e.valor); const v = vs.find(v => v.tipo === "COMPLEMENTO" && v.chave === e.opcaoId); const b = v?.dados as ComportamentoFiscal | undefined;
      if (!b) { if (valor.gt(0) || e.produtoId) adicionar(`${item.nome} / ${e.nome}: definir integração ao principal, mercadoria adicional ou apresentação; gratuidade não comprova o tratamento de uma mercadoria vinculada.`); continue; }
      if (b.comportamento === "INCLUIDO" && valor.gt(0)) { adicionar(`${item.nome} / ${e.nome}: escolha incluída recebeu cobrança; revisar tratamento fiscal.`); continue; }
      if (b.comportamento === "MERCADORIA") {
        if (!b.produtoId || !b.escolhas && b.produtoId !== e.produtoId || valor.lte(0)) { adicionar(`${item.nome} / ${e.nome}: mercadoria adicional exige vínculo e valor individual comprovados.`); continue; }
        const origemFotografada = item.receitaFotografada?.opcaoHashes.find(h => h.opcaoId === e.opcaoId)?.hash;
        const materiaisOrigem = item.receitaFotografada?.materiais?.opcoes.find(m => m.opcaoId === e.opcaoId)?.materiais;
        const origemComprovada = b.receitaFotografada?.materiais ? origemFotografada && materiaisOrigem ? hashTecnico({ fisica: origemFotografada, materiais: materiaisOrigem }) : null : origemFotografada;
        if (b.escolhas && (!b.receitaFotografada || !b.fotografiaOpcaoOrigem || b.fotografiaOpcaoOrigem !== origemComprovada || b.fotografiaOpcaoOrigem !== tecnicasAtuais.find(t => t.produtoId === `OPCAO:${e.opcaoId}`)?.fotografia.principalHash)) { adicionar(`${item.nome} / ${e.nome}: opção e mercadoria configurada divergem da equivalência física comprovada; revisar somente este complemento.`); continue; }
        const q = composta(e.quantidade, item.quantidade, e.nome); if (!q) continue;
        principal = principal.minus(valor);
        separado.push({ id: `${item.id}:${e.opcaoId}`, produtoId: b.produtoId, nome: e.nome, quantidade: q, unidade: b.escolhas ? catalogo.find(p => p.id === b.produtoId)?.unidade ?? "" : e.unidade ?? "", valor: valor.toFixed(2), valorEscolhasDiscriminado: !!b.escolhas, escolhas: b.escolhas?.map(x => ({ ...x, quantidadeEscolhida: x.quantidade, produtoId: null, nome: e.nome, valor: "0.00" })), receitaFotografada: b.escolhas ? b.receitaFotografada : e.receitaFotografada, versoes: [v!.id], justificativas: [b.justificativa] });
      } else { versoesIntegradas.push(v!.id); justificativasIntegradas.push(`${e.nome}: ${b.justificativa}`); }
    }
    if (principal.lt(0)) { adicionar(`${item.nome}: adicionais fiscais excedem o total comercial; corrigir discriminação e descontos.`); continue; }
    const escolhasIntegradas = item.escolhas.filter(e => !["MERCADORIA", "APRESENTACAO"].includes((vs.find(v => v.tipo === "COMPLEMENTO" && v.chave === e.opcaoId)?.dados as ComportamentoFiscal | undefined)?.comportamento ?? ""));
    expandir({ id: item.id, produtoId: item.produtoId, nome: item.nome, quantidade: quantidade.toFixed(6), unidade: item.unidade, valor: principal.toFixed(2), escolhas: escolhasIntegradas, receitaFotografada: item.receitaFotografada, fotografiaKitFiscal: item.fotografiaKitFiscal, versoes: versoesIntegradas, justificativas: ["Escolhas incluídas e adicionais integrados conservam o total do produto principal.", ...justificativasIntegradas] });
    separado.forEach(l => expandir(l));
  }
  function oficial(tabela: TabelaFiscal["tabela"], cod: string | null, produto: string) {
    if (!cod) { adicionar(`${produto}: código ${tabela} ausente.`); return undefined; }
    const v = vs.find(v => v.tipo === "TABELA" && v.chave === tabela); const t = v?.dados as TabelaFiscal | undefined;
    const l = t?.linhas.find(l => l.codigo === cod);
    if (!l) adicionar(`${produto}: ${tabela} ${cod} não consta da tabela oficial importada vigente.`);
    return l ? { linha: l, versao: v!.id } : undefined;
  }
  function imposto(t: TributoConfigurado, valor: string) { const base = valorFiscal(valor).mul(new D(100).minus(t.reducaoBase)).div(100).toDecimalPlaces(2, D.ROUND_HALF_UP); return { cst: t.cst, base: t.modalidade === "SEM_DESTAQUE" ? "0.00" : base.toFixed(2), aliquota: t.aliquota, valor: t.modalidade === "SEM_DESTAQUE" ? "0.00" : base.mul(t.aliquota!).div(100).toFixed(2, D.ROUND_HALF_UP) }; }
  const pesos = linhas.map(l => new D(l.valor).gt(0) ? l.valor : "0.000001");
  const acrescimos = (valor?: string) => pesos.length && valorFiscal(valor ?? "0").gt(0) ? ratearFiscal(valor!, pesos) : pesos.map(() => "0.00");
  const fretes = acrescimos(contexto.frete), custos = acrescimos(contexto.outrosCustos);
  for (const [indice, l] of linhas.entries()) {
    if (new D(l.quantidade).decimalPlaces() > 4 || new D(l.quantidade).gte("100000000000")) adicionar(`${l.nome}: quantidade fiscal exige até 11 inteiros e 4 casas decimais; comprovar conversão de unidade antes de emitir, sem arredondar a quantidade comercial.`);
    if (new D(l.valor).div(l.quantidade).gte("100000000000")) adicionar(`${l.nome}: valor unitário fiscal excede 11 inteiros e 10 casas decimais; comprovar unidade/conversão sem alterar preço ou quantidade comerciais.`);
    const c = l.classificacaoResolvida ?? classificar(l.produtoId)!.dados as ClassificacaoFiscal;
    const faltantes = [!c.ncm ? "NCM (8 dígitos)" : null, c.origem == null ? "Origem ICMS" : null, !c.grupo ? "grupo fiscal" : null, !perfil ? "perfil fiscal da empresa" : null].filter(Boolean);
    if (!perfil || !c.ncm || c.origem == null || !c.grupo) { adicionar(`${l.nome}: falta preencher ${faltantes.join(" e ")}. Corrija a configuração fiscal antes de tentar novamente.`); continue; }
    if (!gtinValido(c.gtin)) adicionar(`${l.nome}: confirmar GTIN da unidade vendida e tributável, ou ausência comprovada de GTIN. Código de ingrediente/embalagem de compra não comprova o produto final.`);
    const classificacaoV = classificar(l.produtoId)!;
    const declaracao = c.fci?.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL";
    const repasse = !!c.fci?.repasseFornecedor;
    const classificacaoVersao = (declaracao || repasse) && c.fotografiaTecnica ? { id: classificacaoV.id, versao: classificacaoV.versao, materiaisHash: hashTecnico(c.fotografiaTecnica.materiais), ...(repasse ? { natureza: c.natureza, ncm: c.ncm } : {}) } : undefined;
    const fci = conferirFciFiscal(c.origem, c.fci, { data: contexto.data, ufEmitente: perfil.uf, ufDestino: contexto.ufDestino, modelo: contexto.modelo,
      ...(declaracao || repasse ? { produtoId: l.produtoId, estabelecimento: contexto.estabelecimento, emitenteCnpj: perfil.cnpj, gtin: c.gtin, ambiente: contexto.ambiente, materiaisHash: classificacaoVersao?.materiaisHash, classificacaoVersaoId: classificacaoVersao?.id, classificacaoVersaoNumero: classificacaoVersao?.versao } : {}), ...(repasse ? { natureza: c.natureza, ncm: c.ncm } : {}) });
    fci.pendencias.forEach(p => adicionar(`${l.nome}: ${p}`));
    if (declaracao) l.justificativas.push(AVISO_DECLARACAO_FCI);
    const candidatas = vs.filter(v => { if (v.tipo !== "REGRA") return false; const regra = v.dados as RegraFiscal; return regra.estabelecimento === contexto.estabelecimento && regra.regime === perfil.regime && regra.operacao === contexto.operacao && regra.ufDestino === contexto.ufDestino && regra.destinatario === contexto.destinatario && (!regra.produtoId || regra.produtoId === l.produtoId) && (!regra.ncm || regra.ncm === c.ncm) && (!regra.grupo || regra.grupo === c.grupo) && (!regra.natureza || regra.natureza === c.natureza); });
    const peso = (v: VersaoFiscalDto) => { const d = v.dados as RegraFiscal; return (d.produtoId ? 8 : 0) + (d.ncm ? 4 : 0) + (d.grupo ? 2 : 0) + (d.natureza ? 1 : 0); };
    candidatas.sort((a, b) => peso(b) - peso(a));
    if (!candidatas.length || candidatas[1] && peso(candidatas[0]) === peso(candidatas[1])) { adicionar(`${l.nome}: ${candidatas.length ? "regras concorrentes com a mesma especificidade" : "regra tributária vigente ausente"}.`); continue; }
    const rv = candidatas[0], regra = rv.dados as RegraFiscal; const usadas = [...l.versoes, perfilV!.id, rv.id];
    const valorBase = new D(l.valor).plus(fretes[indice]).plus(custos[indice]).toFixed(2);
    const conferir = (t: TabelaFiscal["tabela"], cod: string | null) => { const x = oficial(t, cod, l.nome); if (x) { usadas.push(x.versao); if (x.linha.regimes && !x.linha.regimes.includes(perfil.regime) || x.linha.modelos && !x.linha.modelos.includes(contexto.modelo)) adicionar(`${l.nome}: ${t} ${cod} incompatível com regime/modelo.`); } return x?.linha; };
    conferir("NCM", c.ncm); conferir("CFOP", regra.cfop); conferir("CST_ICMS", regra.icms.cst); conferir("CST_PIS_COFINS", regra.pis.cst); conferir("CST_PIS_COFINS", regra.cofins.cst);
    if (perfil.regime === "SIMPLES_NACIONAL") { conferir("CSOSN", regra.csosn); if (!["102", "103", "300", "400", "500"].includes(regra.csosn ?? "") && !(regra.csosn === "900" && regra.icms.cst === "40" && regra.icms.modalidade === "SEM_DESTAQUE")) adicionar(`${l.nome}: CSOSN requer crédito/ST ou apuração ainda não implementada; configurar operação específica.`); }
    else if (!["00", "20", "40", "41", "60"].includes(regra.icms.cst)) adicionar(`${l.nome}: CST ICMS requer diferimento/ST ou apuração específica.`);
    if (perfil.regime !== "SIMPLES_NACIONAL" && (regra.icms.cst === "00" && new D(regra.icms.reducaoBase).gt(0) || regra.icms.cst === "20" && new D(regra.icms.reducaoBase).lte(0))) adicionar(`${l.nome}: CST ICMS e redução de base incompatíveis.`);
    const cstIcmsTributado = ["00", "20"].includes(regra.icms.cst);
    if (perfil.regime !== "SIMPLES_NACIONAL" && (cstIcmsTributado !== (regra.icms.modalidade === "TRIBUTADO"))) adicionar(`${l.nome}: CST ICMS e destaque incompatíveis.`);
    for (const [nome, t] of [["PIS", regra.pis], ["COFINS", regra.cofins]] as const) if (t.modalidade === "TRIBUTADO" && !["01", "02"].includes(t.cst) || t.modalidade === "SEM_DESTAQUE" && ["01", "02", "03"].includes(t.cst)) adicionar(`${l.nome}: CST ${nome} e modalidade de cálculo incompatíveis.`);
    const primeiro = contexto.ufDestino === perfil.uf ? "5" : "6"; if (!regra.cfop.startsWith(primeiro)) adicionar(`${l.nome}: CFOP incompatível com origem/destino.`);
    // Este resolver suporta venda de produção própria, revenda e mercadoria com
    // retenção anterior. Demais operações requerem regra/cálculo específicos.
    const sufixo = regra.st === "RETIDO_ANTERIORMENTE" ? "405" : c.natureza === "PREPARADO" ? "101" : "102";
    if (regra.cfop !== `${primeiro}${sufixo}`) adicionar(`${l.nome}: CFOP exige enquadramento próprio para a natureza/ST desta venda.`);
    if (regra.st === "CALCULO_PENDENTE" || regra.seletivo === "ANALISE_PENDENTE") adicionar(`${l.nome}: cálculo de ST/Imposto Seletivo depende de parâmetros e enquadramento comprovados.`);
    if (c.cest) { const cest = conferir("CEST", c.cest); if (!cest?.ncm?.includes(c.ncm)) adicionar(`${l.nome}: CEST individual não é compatível com o NCM na tabela oficial vigente.`); }
    if (regra.st === "RETIDO_ANTERIORMENTE") { const cest = conferir("CEST", regra.cest); if (!cest?.ncm?.includes(c.ncm) || c.cest !== regra.cest || perfil.regime === "SIMPLES_NACIONAL" && regra.csosn !== "500" || perfil.regime !== "SIMPLES_NACIONAL" && regra.icms.cst !== "60") adicionar(`${l.nome}: CEST, NCM, retenção e CST/CSOSN devem ser compatíveis e comprovados.`); if (!(contexto.ufDestino === "SP" && perfil.uf === "SP" && (contexto.consumidorFinal ?? contexto.destinatario === "CONSUMIDOR_FINAL") && regra.evidenciaSt)) adicionar(`${l.nome}: informar base, imposto retido e FCP/ST efetivamente aplicáveis; CEST e NCM não comprovam a retenção.`); }
    if (regra.ipi) { conferir("CST_IPI", regra.ipi.cst); adicionar(`${l.nome}: IPI exige enquadramento e base específicos antes da emissão.`); }
    let reforma: LinhaFiscalCalculada["reforma"] = null;
    let valoresRTC: LinhaFiscalCalculada["valoresRTC"];
    let icmsCalculado = imposto(regra.icms, valorBase);
    if (perfil.reforma === "EXIGIR_REGRA") {
      const b = regra.reforma;
      if (!b) adicionar(`${l.nome}: classificação/alíquotas IBS/CBS da vigência ausentes.`);
      else { conferir("CST_IBSCBS", b.cst); const cc = conferir("CCLASSTRIB", b.cClassTrib);
        if (!cc || cc.cst !== b.cst || cc.ncm && !cc.ncm.includes(c.ncm) || cc.reducao !== undefined && new D(cc.reducao).comparedTo(b.reducao) !== 0) adicionar(`${l.nome}: cClassTrib/CST/redução IBS/CBS incompatíveis com tabela oficial.`);
        if (!["000", "200"].includes(b.cst)) adicionar(`${l.nome}: CST IBS/CBS exige grupos de diferimento/monofasia/crédito específicos.`);
        if (b.cst === "000" && new D(b.reducao).gt(0)) adicionar(`${l.nome}: tributação integral não admite redução.`);
        const fator = new D(100).minus(b.reducao).div(100);
        const efetiva = (a: string) => new D(a).mul(fator).toFixed(4);
        const identidade = { cst: b.cst, cClassTrib: b.cClassTrib, cbs: efetiva(b.cbs), ibsUf: efetiva(b.ibsUf), ibsMunicipio: efetiva(b.ibsMunicipio), aliquotaNominalCBS: b.cbs, aliquotaNominalIbsUf: b.ibsUf, aliquotaNominalIbsMunicipio: b.ibsMunicipio, reducao: b.reducao };
        if (contexto.data >= "2027-01-01") {
          const politica = b.preco2027;
          if (!politica) adicionar(`${l.nome}: política de preço final e rateio RTC 2027 ausente; não acrescentar IBS/CBS novamente ao preço comercial.`);
          else if (!excecaoBaseLiquidaComprovada(regra, perfil.uf, contexto.data, rv.fontes)) adicionar(`${l.nome}: excluir IBS/CBS da base de ICMS exige exceção normativa específica, fonte oficial, UF e vigência comprovadas; as orientações paulistas atuais exigem base bruta.`);
          else if (imposto(regra.pis, valorBase).valor !== "0.00" || imposto(regra.cofins, valorBase).valor !== "0.00") adicionar(`${l.nome}: PIS/COFINS legados com destaque em 2027 exigem revisão; não acumular automaticamente esses tributos com CBS.`);
          else {
            try {
              const calculo = decomporOperacaoPrecoRtc({
                produtoBruto: l.valor, quantidade: l.quantidade,
                componentesExternos: [{ id: "FRETE", valorBruto: fretes[indice] }, { id: "OUTROS", valorBruto: custos[indice] }],
                aliquotasEfetivasRtc: { cbs: efetiva(b.cbs), ibsUf: efetiva(b.ibsUf), ibsMunicipio: efetiva(b.ibsMunicipio) },
                tributosContidos: regra.icms.modalidade !== "TRIBUTADO" ? [] : politica.baseIcms === "BRUTA" ? [{ id: "ICMS", excluirDaBaseRtc: true, modo: "VALOR_CONHECIDO", valor: icmsCalculado.valor, fundamentoValor: politica.justificativa }] : [{ id: "ICMS", excluirDaBaseRtc: true, modo: "ALIQUOTA", aliquotaEfetiva: new D(regra.icms.aliquota!).mul(new D(100).minus(regra.icms.reducaoBase)).div(100).toFixed(4), politicaBase: "LIQUIDO_RTC", fundamentoBase: politica.justificativa }],
                politicaRateio: politica.rateio === "SEM_ACRESCIMOS" ? { modo: "SEM_ACRESCIMOS" } : { modo: "PROPORCIONAL_BRUTO", versaoId: rv.id, justificativa: politica.justificativa },
              });
              const icms = calculo.tributosContidos.find(t => t.id === "ICMS");
              if (icms?.base) {
                icmsCalculado = imposto(regra.icms, icms.base);
                if (icmsCalculado.valor !== icms.valor) adicionar(`${l.nome}: arredondamento da base reduzida de ICMS diverge da decomposição RTC; confirmar política específica antes de emitir.`);
              }
              reforma = { ...identidade, base: calculo.baseRtc, valorCbs: calculo.rtc.cbs.valor, valorIbsUf: calculo.rtc.ibsUf.valor, valorIbsMunicipio: calculo.rtc.ibsMunicipio.valor };
              valoresRTC = { produtoLiquido: calculo.produto.vProdLiq, unitarioLiquido: calculo.produto.vUnComLiq, totalItem: valorBase, explicacao: ["Preço comercial final contém IBS/CBS; exclusão dos próprios tributos da base, LC214 art.12 e NT2026.008.", `ICMS: base ${politica.baseIcms}; acessórios: ${politica.rateio}; regra ${rv.id}.`, politica.justificativa, "Arredondamento HALF_UP em centavos; unitário líquido com dez casas; nenhum ajuste de preço ou quantidade."] };
            } catch (erro) {
              if (!(erro instanceof ErroPrecoRtc)) throw erro;
              adicionar(`${l.nome}: preço RTC 2027: ${erro.message}`);
            }
          }
        } else {
          const base = valorFiscal(valorBase).minus(icmsCalculado.valor).minus(imposto(regra.pis, valorBase).valor).minus(imposto(regra.cofins, valorBase).valor);
          if (base.lt(0)) adicionar(`${l.nome}: exclusões da base IBS/CBS excedem o valor da operação.`);
          reforma = { ...identidade, base: base.toFixed(2), valorCbs: base.mul(efetiva(b.cbs)).div(100).toFixed(2, D.ROUND_HALF_UP), valorIbsUf: base.mul(efetiva(b.ibsUf)).div(100).toFixed(2, D.ROUND_HALF_UP), valorIbsMunicipio: base.mul(efetiva(b.ibsMunicipio)).div(100).toFixed(2, D.ROUND_HALF_UP) };
        }
      }
    }
    const baseLinha = { id: l.id, produtoId: l.produtoId, nome: l.nome, quantidade: l.quantidade, unidade: l.unidade, valor: l.valor, ...(c.fci ? { fci: structuredClone(c.fci) } : {}), ...(classificacaoVersao ? { classificacaoVersao } : {}), ...(l.cenarioNcm ? { cenarioNcm: l.cenarioNcm } : {}), ...(l.referenciaInternaInsumoId ? { referenciaInternaInsumoId: l.referenciaInternaInsumoId } : {}) };
    r.linhas.push({ ...baseLinha, frete: fretes[indice], outrasDespesas: custos[indice], ncm: c.ncm, gtin: c.gtin ?? null, origem: c.origem, cest: c.cest, cfop: regra.cfop, csosn: regra.csosn, impostos: { icms: { ...icmsCalculado, reducaoBase: regra.icms.reducaoBase }, pis: imposto(regra.pis, valorBase), cofins: imposto(regra.cofins, valorBase), ipi: null }, reforma, ...(valoresRTC ? { valoresRTC } : {}), segregacaoReceita: regra.segregacaoReceita, versoes: [...new Set(usadas)], justificativas: [...l.justificativas, `Base da operação: mercadoria ${l.valor}, frete ${fretes[indice]}, despesas ${custos[indice]}.`, ...c.evidencias, rv.justificativa, regra.icms.justificativa, regra.pis.justificativa, regra.cofins.justificativa, ...(regra.reforma ? [regra.reforma.justificativa] : []), ...(valoresRTC?.explicacao ?? []), ...(regra.evidenciaSt ? [regra.evidenciaSt] : [])] });
  }
  r.totalMercadorias = r.linhas.reduce((a, l) => a.plus(l.valor), new D(0)).toFixed(2);
  const totalComercial = itens.reduce((a, l) => a.plus(valorFiscal(l.total)), new D(0));
  if (!new D(r.totalMercadorias).equals(totalComercial)) adicionar("A discriminação fiscal ainda não fecha com o total comercial; resolver as linhas pendentes antes de emitir.");
  if (!r.linhas.length) adicionar("Nenhuma mercadoria fiscal válida para esta operação.");
  r.apto = !pendencias.length; return r;
}
