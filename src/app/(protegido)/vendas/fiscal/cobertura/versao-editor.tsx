"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelecaoFormulario } from "@/components/ui/select";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Campo, Check, EditorVenda, Texto } from "../../componentes";
import { GRUPOS_FISCAIS, type ClassificacaoFiscal, type ComportamentoFiscal, type DadosVersaoFiscal, type LayoutFiscalRTC, type PainelFiscal, type PerfilFiscal, type RegraFiscal, type TabelaFiscal, type TipoVersaoFiscal, type TributoConfigurado, type VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { registrarDeclaracaoGrazing1Action, salvarVersaoFiscalAction } from "../estrutura-actions";
import { PRODUTO_DECLARACAO_FCI_GRAZING1, REFERENCIA_INSTRUCAO_GRAZING1 } from "@/lib/tributacao/declaracao-fci-contrato";
import { AnaliseClassificacaoForm, ComponentesKitForm, EscolhasMercadoriaForm, ReferenciaClassificacaoForm } from "./classificacao-complementar-form";
import { ReceitaFiscalForm } from "./receita-fiscal-form";
import { FciClassificacaoForm } from "./fci-classificacao-form";
import { SeletorFiscal } from "@/components/fiscal/seletor-fiscal";
import type { ConsultaTabelaFiscal, TabelaFiscal as NomeTabelaOficial } from "@/lib/fiscal/catalogos/tipos";
const ContextoCatalogoFiscal = createContext<Omit<ConsultaTabelaFiscal, "tabela">>({ uf: "SP" });

const nomes: Record<TipoVersaoFiscal, string> = { CLASSIFICACAO: "Classificação do produto", PERFIL: "Perfil do estabelecimento", REGRA: "Regra tributária", TABELA: "Tabela oficial", COMPLEMENTO: "Tratamento de complemento" };
const naturezas = [["PREPARADO", "Preparado pela Grazing"], ["REVENDA", "Revenda sem preparo"], ["FRACIONADO", "Alimento fracionado"], ["SERVICO", "Serviço"]] as const;
const regimes = [["SIMPLES_NACIONAL", "Simples Nacional"], ["LUCRO_PRESUMIDO", "Lucro Presumido"]] as const;
const tabelas = ["NCM", "CFOP", "CSOSN", "CST_ICMS", "CST_PIS_COFINS", "CST_IPI", "CEST", "CST_IBSCBS", "CCLASSTRIB"] as const;
const linhas = (s: string) => s.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
const tributoVazio = (): TributoConfigurado => ({ cst: "", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "" });
function inicial(tipo: TipoVersaoFiscal, produtoId = ""): DadosVersaoFiscal {
  switch (tipo) {
    case "CLASSIFICACAO": return { produtoId, grupo: null, natureza: "PREPARADO", tratamento: "NORMAL", ncm: null, origem: null, cest: null, gtin: null, unidade: "UN", estado: "PENDENTE", evidencias: [], pendencias: [], componentesKit: [] };
    case "PERFIL": return { estabelecimento: "", cnpj: "", uf: "SP", codigoMunicipio: "", inscricaoEstadual: "", regime: "SIMPLES_NACIONAL", confirmado: false, evidenciaEnquadramento: "", modelos: ["55", "65"], emissor: "TAKEAT", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
    case "REGRA": return { estabelecimento: "", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: null, natureza: null, ncm: null, cfop: "", csosn: null, icms: tributoVazio(), pis: tributoVazio(), cofins: tributoVazio(), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "", reforma: null, seletivo: "NAO_APLICAVEL" };
    case "TABELA": return { tabela: "NCM", referencia: "", completa: false, linhas: [] };
    case "COMPLEMENTO": return { opcaoId: "", comportamento: "INCLUIDO", produtoId: null, justificativa: "" };
  }
}
function Selecao<Valor extends string>({ nome, valor, mudar, opcoes, vazio }: { nome: string; valor: Valor | null; mudar: (v: Valor | null) => void; opcoes: readonly (readonly [Valor, string])[]; vazio?: string }) {
  return <Campo nome={nome}><SelecaoFormulario aria-label={nome} value={valor ?? ""} onValueChange={v => mudar(v ? v as Valor : null)}>{vazio && <option value="">{vazio}</option>}{opcoes.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</SelecaoFormulario></Campo>;
}
function Codigo({ nome, valor, mudar, tamanho, required = false, ncm, cst, uso }: { nome: string; valor: string | null; mudar: (v: string | null) => void; tamanho: number; required?: boolean; ncm?: string | null; cst?: string; uso?: ConsultaTabelaFiscal["uso"] }) {
  const contexto = useContext(ContextoCatalogoFiscal);
  const tabela: NomeTabelaOficial | null = nome.startsWith("NCM") ? "ncm" : nome.startsWith("Origem") ? "origem" : nome.startsWith("CEST") ? "cest" : nome.startsWith("CFOP") ? "cfop" : nome.startsWith("CSOSN") ? "csosn" : nome === "CST ICMS" ? "cstIcms" : nome === "CST PIS" ? "pis" : nome === "CST COFINS" ? "cofins" : nome === "CST IPI" ? "ipi" : nome === "CST IBS/CBS" ? "cstIbsCbs" : nome === "cClassTrib" ? "cClassTrib" : null;
  if (tabela) return <div className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{nome}</span><SeletorFiscal nome={nome} valor={valor ?? ""} mudar={v => mudar(v || null)} requerido={required} contexto={{ ...contexto, tabela, ...(ncm ? { ncm } : {}), ...(cst ? { cst } : {}), ...(uso ? { uso } : {}) }} /></div>;
  return <Texto nome={nome} inputMode="numeric" restricao="digitos" maxLength={tamanho} pattern={`[0-9]{${tamanho}}`} required={required} value={valor ?? ""} onChange={e => mudar(e.target.value || null)} />;
}
function Decimal({ nome, valor, mudar, required = false, casas = 4 }: { nome: string; valor: string | null; mudar: (v: string | null) => void; required?: boolean; casas?: number }) {
  return <Texto nome={nome} inputMode="decimal" restricao="decimal" casasDecimais={casas} min={0} maxLength={casas === 6 ? 19 : 8} pattern={casas === 6 ? "[0-9]{1,12}([.][0-9]{1,6})?" : "[0-9]{1,3}([.][0-9]{1,4})?"} required={required} value={valor ?? ""} onChange={e => mudar(e.target.value ? e.target.value.replace(",", ".") : null)} />;
}
function Identificador({ nome, valor, mudar }: { nome: string; valor: string; mudar: (v: string) => void }) {
  return <Texto nome={nome} required maxLength={100} pattern="[a-zA-Z0-9_-]{1,100}" value={valor} onChange={e => mudar(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} />;
}
function ListaTexto({ nome, valores, mudar, limite = 5000 }: { nome: string; valores: string[]; mudar: (v: string[]) => void; limite?: number }) {
  const [texto, setTexto] = useState(valores.join("\n"));
  return <Campo nome={nome}><Textarea maxLength={limite} value={texto} onChange={e => { setTexto(e.target.value); mudar(linhas(e.target.value)); }} /></Campo>;
}

const padraoCaminhoApi = "[A-Za-z][A-Za-z0-9]*(\\.[A-Za-z][A-Za-z0-9]*){0,2}";
function aceitaCaminhoApiParcial(valor: string) {
  if (valor.length > 80) return false;
  if (!valor) return true;
  const partes = valor.split(".");
  return partes.length <= 3 && partes.every((p, i) => /^[A-Za-z][A-Za-z0-9]*$/.test(p) || !p && i > 0 && i === partes.length - 1);
}
function CaminhoApi({ nome, valor, mudar }: { nome: string; valor: string | null; mudar: (v: string | null) => void }) {
  const inserir = (el: HTMLInputElement, texto: string) => el.value.slice(0, el.selectionStart ?? el.value.length) + texto + el.value.slice(el.selectionEnd ?? el.value.length);
  return <Texto nome={nome} maxLength={80} pattern={padraoCaminhoApi} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={valor ?? ""}
    onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !aceitaCaminhoApiParcial(inserir(e.currentTarget, e.key))) e.preventDefault(); }}
    onPaste={e => { if (!aceitaCaminhoApiParcial(inserir(e.currentTarget, e.clipboardData.getData("text")))) e.preventDefault(); }}
    onChange={e => { if (!aceitaCaminhoApiParcial(e.target.value)) { e.target.value = valor ?? ""; return; } mudar(e.target.value || null); }} />;
}

function LeiauteRTCForm({ valor, mudar }: { valor: LayoutFiscalRTC | undefined; mudar: (v: LayoutFiscalRTC | undefined) => void }) {
  const [rascunho, setRascunho] = useState(valor);
  const campos = [["valorProdutoLiquido", "Campo da API para valor líquido do produto"], ["valorUnitarioLiquido", "Campo da API para valor líquido unitário"], ["valorLiquidoProdutosTotal", "Campo da API para total líquido dos produtos"], ["valorTotalItem", "Campo da API para total do item"], ["valorTotalDocumento", "Campo da API para total do documento"]] as const;
  const completo = !!valor && valor.evidenciaHomologacao.trim().length >= 15 && campos.every(([k]) => !!valor.campos[k] && new RegExp(`^${padraoCaminhoApi}$`).test(valor.campos[k]!));
  return <details className="space-y-3"><summary className="cursor-pointer font-medium">Avançado: leiaute RTC de 2027 no provedor</summary>
    <p className="text-xs text-muted-foreground">Prepare o mapeamento da NT 2026.008 somente com campos documentados e conferidos no XML real de homologação do provedor. Não há nomes de API presumidos.</p>
    <Check checked={!!valor} onChange={e => { if (!e.target.checked) { setRascunho(valor); mudar(undefined); } else mudar({ ...(rascunho ?? { codigo: "NT2026.008", evidenciaHomologacao: "", campos: { valorProdutoLiquido: null, valorUnitarioLiquido: null, valorLiquidoProdutosTotal: null, valorTotalItem: null, valorTotalDocumento: null } }), homologacaoComprovada: false }); }}>Preparar mapeamento do leiaute RTC</Check>
    {valor && <div className="space-y-3"><div className="grid gap-4 sm:grid-cols-2">{campos.map(([k, nome]) => <CaminhoApi key={k} nome={nome} valor={valor.campos[k]} mudar={v => mudar({ ...valor, homologacaoComprovada: false, campos: { ...valor.campos, [k]: v } })} />)}</div>
      <p className="text-xs text-muted-foreground">Até três segmentos com letras e dígitos, separados por ponto; cada segmento começa com letra. Sem espaços, até 80 caracteres.</p>
      <Campo nome="Evidência da homologação do leiaute no provedor"><Textarea maxLength={2000} value={valor.evidenciaHomologacao} onChange={e => mudar({ ...valor, homologacaoComprovada: false, evidenciaHomologacao: e.target.value })} /></Campo>
      <Check disabled={!completo} checked={valor.homologacaoComprovada} onChange={e => mudar({ ...valor, homologacaoComprovada: e.target.checked })}>Homologação do leiaute comprovada por evidência</Check>
      <p className="text-xs text-muted-foreground">A confirmação exige cinco caminhos completos e evidência com pelo menos 15 caracteres. Alterar campos ou evidência exige nova confirmação. CRT, enquadramento cadastral, operações permitidas e autorização para emissão continuam sendo verificações separadas.</p>
    </div>}
  </details>;
}

type Preco2027 = NonNullable<RegraFiscal["reforma"]>["preco2027"];
type ExcecaoBaseLiquida = NonNullable<NonNullable<Preco2027>["excecaoBaseLiquida"]>;
function ExcecaoBaseLiquidaForm({ valor, mudar }: { valor: ExcecaoBaseLiquida | undefined; mudar: (v: ExcecaoBaseLiquida) => void }) {
  const d = valor ?? { uf: "", vigenciaInicio: "", vigenciaFim: null, fonteNormativa: "", ato: "", justificativa: "" };
  const alterar = <K extends keyof ExcecaoBaseLiquida>(k: K, v: ExcecaoBaseLiquida[K]) => mudar({ ...d, [k]: v });
  const aceitaUrl = (v: string) => /^[A-Za-z0-9:/?#\[\]@!$&'()*+,;=._~%-]*$/.test(v);
  return <div className="space-y-3"><p className="font-medium">Exceção normativa para base ICMS líquida</p>
    <p className="text-xs text-muted-foreground">Registre o ato que permite excluir IBS/CBS para a UF e a data da operação. As RC 32931/2025 e 33083/2026 orientam base bruta e não comprovam essa exceção.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Selecao nome="UF alcançada pela exceção normativa" valor={d.uf || null} mudar={v => alterar("uf", v ?? "")} vazio="Selecione a UF comprovada" opcoes={["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => [uf, uf] as const)} />
      <Texto nome="Início da vigência da exceção" type="date" required maxLength={10} value={d.vigenciaInicio} onChange={e => alterar("vigenciaInicio", e.target.value)} />
      <Texto nome="Fim da vigência da exceção, quando houver" type="date" maxLength={10} min={d.vigenciaInicio || undefined} value={d.vigenciaFim ?? ""} onChange={e => alterar("vigenciaFim", e.target.value || null)} />
    </div>
    <Texto nome="Fonte oficial da norma para base ICMS líquida" type="url" required maxLength={2000} pattern="https://.+" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={d.fonteNormativa}
      onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !aceitaUrl(e.key)) e.preventDefault(); }}
      onPaste={e => { if (!aceitaUrl(e.clipboardData.getData("text"))) e.preventDefault(); }}
      onChange={e => { if (!aceitaUrl(e.target.value)) { e.target.value = d.fonteNormativa; return; } alterar("fonteNormativa", e.target.value); }} />
    <p className="text-xs text-muted-foreground">URL HTTPS de publicação oficial em gov.br ou fazenda.sp.gov.br. A fonte será incluída nas referências desta nova versão ao salvar; vigência e compatibilidade serão conferidas no servidor.</p>
    <Campo nome="Identificação do ato normativo da exceção"><Textarea required minLength={15} maxLength={2000} value={d.ato} onChange={e => alterar("ato", e.target.value)} /></Campo>
    <Campo nome="Fundamento da exceção para a operação"><Textarea required minLength={15} maxLength={2000} value={d.justificativa} onChange={e => alterar("justificativa", e.target.value)} /></Campo>
  </div>;
}
function Preco2027Form({ valor, mudar }: { valor: Preco2027; mudar: (v: Preco2027) => void }) {
  const [rascunho, setRascunho] = useState(valor);
  return <div className="space-y-3"><Check checked={!!valor} onChange={e => { if (!e.target.checked) { setRascunho(valor); mudar(undefined); } else mudar(rascunho ?? { baseIcms: "BRUTA", rateio: "SEM_ACRESCIMOS", justificativa: "" }); }}>Configurar decomposição do preço em 2027</Check>
    {valor && <div className="space-y-3"><p className="text-xs text-muted-foreground">O preço final conserva o total do pedido. A base IBS/CBS exclui os próprios tributos; valor líquido do produto e base tributária da operação são grandezas distintas.</p>
      <Selecao nome="Base do ICMS no preço de 2027" valor={valor.baseIcms} mudar={v => v && mudar({ ...valor, baseIcms: v })} opcoes={[["BRUTA", "Bruta final com IBS/CBS: orientação SEFAZ-SP"], ["LIQUIDA_RTC", "Líquida de IBS/CBS: somente com norma específica"]]} />
      <p className="text-xs text-muted-foreground">São Paulo inclui IBS/CBS exigíveis na base do ICMS conforme RC 32931/2025 e RC 33083/2026. Registre as fontes e a vigência aplicáveis; base líquida exige fundamento específico para a UF e a data.</p>
      {valor.baseIcms === "LIQUIDA_RTC" && <ExcecaoBaseLiquidaForm valor={valor.excecaoBaseLiquida} mudar={v => mudar({ ...valor, excecaoBaseLiquida: v })} />}
      <Selecao nome="Composição entre produto e acréscimos em 2027" valor={valor.rateio} mudar={v => v && mudar({ ...valor, rateio: v })} opcoes={[["SEM_ACRESCIMOS", "Operação sem frete ou outras despesas"], ["PROPORCIONAL_BRUTO", "Rateio proporcional aos valores brutos, fundamentado"]]} />
      <Campo nome="Fundamentação da decomposição do preço de 2027"><Textarea required minLength={15} maxLength={2000} value={valor.justificativa} onChange={e => mudar({ ...valor, justificativa: e.target.value })} /></Campo>
      <p className="text-xs text-muted-foreground">Esta opção salva um rascunho prospectivo. A prévia verifica política, tabelas e leiaute homologado antes de permitir emissão; o cadastro de 2026 conserva suas regras.</p>
    </div>}
  </div>;
}

export function EditorVersaoFiscal({ tipo, versao, produtoId, evidencia, ncm, painel, fechar }: { tipo: TipoVersaoFiscal; versao?: VersaoFiscalDto; produtoId?: string; evidencia?: string; ncm?: string; painel: PainelFiscal; fechar: () => void }) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosVersaoFiscal>(() => {
    const d = versao ? structuredClone(versao.dados) : inicial(tipo, produtoId);
    if (tipo === "CLASSIFICACAO" && evidencia) { const c = d as ClassificacaoFiscal; c.evidencias = [...new Set([...c.evidencias, evidencia])]; c.estado = "PENDENTE"; if (c.natureza === "REVENDA" || c.natureza === "FRACIONADO") c.ncm = ncm ?? c.ncm; }
    return d;
  });
  const [chave, setChave] = useState(versao?.chave ?? "");
  const [vigencia, setVigencia] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()));
  const [justificativa, setJustificativa] = useState("");
  const [fontes, setFontes] = useState(versao?.fontes ?? []);
  const [registrandoDeclaracao, iniciarDeclaracao] = useTransition(), [erroDeclaracao, setErroDeclaracao] = useState("");
  const travaDeclaracao = useRef(false);
  const [conteudoInicial] = useState(() => ({ dados: JSON.stringify(dados), fontes: JSON.stringify(fontes), vigencia }));
  const operacao = useRef("");
  const assinatura = useRef("");
  const baseDeclaracao = tipo === "CLASSIFICACAO" && painel.administrador ? painel.versoes.filter(v => v.tipo === "CLASSIFICACAO" && v.chave === PRODUTO_DECLARACAO_FCI_GRAZING1).sort((a, b) => b.versao - a.versao)[0] : undefined;
  const classificacaoBase = baseDeclaracao?.dados as ClassificacaoFiscal | undefined;
  const podeRegistrarDeclaracao = Boolean(baseDeclaracao && versao?.id === baseDeclaracao.id && /^[a-f0-9]{64}$/.test(baseDeclaracao.hash) && classificacaoBase?.produtoId === PRODUTO_DECLARACAO_FCI_GRAZING1 && classificacaoBase.tratamento === "NORMAL" && classificacaoBase.origem === null && classificacaoBase.fotografiaTecnica?.materiais && classificacaoBase.fci?.situacao !== "DISPENSADA_POR_DECLARACAO_RESPONSAVEL");
  const possuiEdicoes = JSON.stringify(dados) !== conteudoInicial.dados || JSON.stringify(fontes) !== conteudoInicial.fontes || vigencia !== conteudoInicial.vigencia || justificativa !== "";
  function registrarDeclaracao() {
    if (!podeRegistrarDeclaracao || !baseDeclaracao || possuiEdicoes || travaDeclaracao.current) return;
    travaDeclaracao.current = true; setErroDeclaracao("");
    iniciarDeclaracao(async () => {
      try {
        const r = await registrarDeclaracaoGrazing1Action({ baseId: baseDeclaracao.id, baseHash: baseDeclaracao.hash, referenciaInstrucao: REFERENCIA_INSTRUCAO_GRAZING1 });
        if ("erro" in r) setErroDeclaracao(r.erro ?? "Não foi possível registrar a declaração. Confira a versão atual antes de repetir.");
        else { fechar(); router.refresh(); }
      } catch { setErroDeclaracao("O registro não foi confirmado. Atualize o painel e confira o histórico antes de repetir."); }
      finally { travaDeclaracao.current = false; }
    });
  }
  async function salvar() {
    const classificacao = dados as ClassificacaoFiscal;
    const identificador = tipo === "CLASSIFICACAO" ? classificacao.referenciaInternaInsumoId ? `INSUMO:${classificacao.referenciaInternaInsumoId}` : classificacao.produtoId ?? "" : tipo === "PERFIL" ? (dados as PerfilFiscal).estabelecimento : tipo === "TABELA" ? (dados as TabelaFiscal).tabela : tipo === "COMPLEMENTO" ? (dados as ComportamentoFiscal).opcaoId : chave;
    const versaoBase = Math.max(0, ...painel.versoes.filter(v => v.tipo === tipo && v.chave === identificador).map(v => v.versao));
    const politica = tipo === "REGRA" ? (dados as RegraFiscal).reforma?.preco2027 : undefined;
    const fonteNormativa = politica?.baseIcms === "LIQUIDA_RTC" ? politica.excecaoBaseLiquida?.fonteNormativa.trim() : undefined;
    const fontesVersao = fonteNormativa ? [...new Set([...fontes, fonteNormativa])] : fontes;
    const conteudo = JSON.stringify({ tipo, identificador, versaoBase, vigencia, dados, justificativa, fontes: fontesVersao });
    if (!operacao.current || assinatura.current !== conteudo) { operacao.current = crypto.randomUUID(); assinatura.current = conteudo; }
    return salvarVersaoFiscalAction({ tipo, chave: identificador, versaoBase, vigenciaInicio: vigencia, dados, justificativa, fontes: fontesVersao, chaveOperacao: operacao.current });
  }
  return <EditorVenda titulo={nomes[tipo]} descricao="Salvar registra um rascunho. A análise de impacto precede a ativação; documentos anteriores mantêm suas versões." fechar={() => { if (!registrandoDeclaracao) fechar(); }} salvar={salvar} impedido={registrandoDeclaracao} varianteSalvar="entrada">
    <ContextoCatalogoFiscal.Provider value={{ dia: vigencia, uf: "SP" }}><Texto nome="Início da vigência" type="date" required maxLength={10} value={vigencia} onChange={e => setVigencia(e.target.value)} />
    {podeRegistrarDeclaracao && <section aria-label="Registrar declaração do responsável" className="space-y-3"><h3 className="font-medium">Declaração já informada pelo responsável</h3><p className="text-xs text-muted-foreground">Registre a instrução expressa de 15/10/2026: origem 5, FCI dispensada por declaração e SEM GTIN. O registro usa a versão arquivada {baseDeclaracao!.versao}, cria um novo rascunho e conserva seu histórico. Não comprova apuração CI/FCI, não aprova os demais parâmetros e não emite nota.</p><p className="text-xs text-muted-foreground">Alcance restrito a Grazing para 1, NF-e 55 e operação SP → SP. A revisão tributária final permanece no pedido.</p><Button type="button" variant="entrada" disabled={registrandoDeclaracao || possuiEdicoes} onClick={registrarDeclaracao}>{registrandoDeclaracao ? "Registrando declaração…" : "Registrar declaração do responsável"}</Button>{possuiEdicoes && <p role="status" className="text-xs text-muted-foreground">Há edições neste formulário. Salve ou descarte essas edições antes de registrar a declaração sobre a versão arquivada.</p>}{erroDeclaracao && <p role="alert" className="text-sm text-destructive">{erroDeclaracao}</p>}</section>}
    {tipo === "CLASSIFICACAO" && <ClassificacaoForm d={dados as ClassificacaoFiscal} mudar={setDados} painel={painel} />}
    {tipo === "PERFIL" && <PerfilForm d={dados as PerfilFiscal} mudar={setDados} />}
    {tipo === "REGRA" && <><Identificador nome="Identificador da regra (sem espaços)" valor={chave} mudar={setChave} /><RegraForm d={dados as RegraFiscal} mudar={setDados} painel={painel} /></>}
    {tipo === "TABELA" && <TabelaForm d={dados as TabelaFiscal} mudar={setDados} />}
    {tipo === "COMPLEMENTO" && <ComplementoForm d={dados as ComportamentoFiscal} mudar={setDados} painel={painel} />}
    <Campo nome="Justificativa técnica desta versão"><Textarea required minLength={15} maxLength={4000} value={justificativa} onChange={e => setJustificativa(e.target.value)} /></Campo>
    <ListaTexto nome="Fontes e referências (uma por linha)" valores={fontes} mudar={setFontes} />
    <p className="text-xs text-muted-foreground">A validação usa evidências e testes internos. Revisão contábil posterior poderá gerar uma nova versão prospectiva.</p></ContextoCatalogoFiscal.Provider>
  </EditorVenda>;
}

function ClassificacaoForm({ d, mudar, painel }: { d: ClassificacaoFiscal; mudar: (v: ClassificacaoFiscal) => void; painel: PainelFiscal }) {
  const alterar = <K extends keyof ClassificacaoFiscal>(k: K, v: ClassificacaoFiscal[K]) => mudar({ ...d, [k]: v });
  const [tipoGtin, setTipoGtin] = useState<"NAO_CONFIRMADO" | "SEM_GTIN" | "CODIGO">(() => d.gtin === "SEM GTIN" ? "SEM_GTIN" : d.gtin ? "CODIGO" : "NAO_CONFIRMADO");
  const [codigoGtin, setCodigoGtin] = useState(() => d.gtin && d.gtin !== "SEM GTIN" ? d.gtin : "");
  return <div className="space-y-4"><ReferenciaClassificacaoForm d={d} mudar={mudar} painel={painel} /><div className="grid gap-4 sm:grid-cols-2">
    <Selecao nome="Grupo fiscal" valor={d.grupo} mudar={v => alterar("grupo", v)} opcoes={GRUPOS_FISCAIS} vazio="Sem grupo" />
    <Selecao nome="Natureza da mercadoria" valor={d.natureza} mudar={v => v && alterar("natureza", v)} opcoes={naturezas} />
    {!d.referenciaInternaInsumoId && d.produtoId !== null && <Selecao nome="Classificação auxiliar" valor={d.tratamento} mudar={v => v && mudar({ ...d, tratamento: v, ...(v !== "KIT_COMPOSTO" ? { componentesKit: undefined } : {}), ...(v !== "NORMAL" ? { configuracaoNcm: undefined, baseSemIngredientesComprovada: undefined, receitaFiscalDocumentada: undefined } : {}) })} opcoes={[["NORMAL", "Mercadoria ou preparação"], ["KIT_COMPOSTO", "Kit de mercadorias distintas"], ["OPCAO_CONFIGURACAO", "Opção de configuração"]]} />}
    <Selecao nome="Estado da classificação" valor={d.estado} mudar={v => v && alterar("estado", v)} opcoes={[["PENDENTE", "Pendente de características/evidência"], ["CONFIRMADO", "Confirmado tecnicamente"]]} />
    {d.ncmAplicabilidade !== "NAO_APLICAVEL" && <Codigo nome={d.configuracaoNcm ? "NCM comprovado sem escolhas, quando houver" : "NCM individual"} tamanho={8} valor={d.ncm} mudar={v => alterar("ncm", v)} />}
    <Codigo nome="Origem fiscal" tamanho={1} valor={d.origem} mudar={v => alterar("origem", v)} />
    <Codigo nome="CEST, quando aplicável" ncm={d.ncm} tamanho={7} valor={d.cest} mudar={v => alterar("cest", v)} />
    <Campo nome="Unidade tributável"><SeletorFiscal nome="Unidade tributável" valor={d.unidade} mudar={v => alterar("unidade", v)} contexto={{ tabela: "unidadeTributavel" }} /></Campo>
  </div><div className="grid gap-4 sm:grid-cols-2"><Selecao nome="Confirmação do GTIN" valor={tipoGtin} mudar={v => { if (!v) return; setTipoGtin(v); alterar("gtin", v === "SEM_GTIN" ? "SEM GTIN" : v === "CODIGO" ? codigoGtin || null : null); }} opcoes={[["NAO_CONFIRMADO", "Não confirmado"], ["SEM_GTIN", "Sem GTIN comprovado"], ["CODIGO", "Código GTIN"]]} />{tipoGtin === "CODIGO" && <Texto nome="GTIN da unidade vendida" inputMode="numeric" restricao="digitos" maxLength={14} pattern="[0-9]{8}|[0-9]{12,14}" value={codigoGtin} onChange={e => { setCodigoGtin(e.target.value); alterar("gtin", e.target.value || null); }} />}</div>
    <p className="text-xs text-muted-foreground">Confira o GTIN de 8, 12, 13 ou 14 dígitos na embalagem da unidade vendida e registre a comprovação nas evidências. Confirme ausência de GTIN somente com prova. Não confirmado mantém a emissão da operação pendente.</p>
    <FciClassificacaoForm origem={d.origem} valor={d.fci} mudar={v => alterar("fci", v)} />
    <ListaTexto nome="Evidências da mercadoria (uma por linha)" valores={d.evidencias} mudar={v => alterar("evidencias", v)} /><ListaTexto nome="Características ou documentos faltantes (um por linha)" valores={d.pendencias} mudar={v => alterar("pendencias", v)} />
    <AnaliseClassificacaoForm d={d} mudar={mudar} painel={painel} />
    {d.tratamento === "NORMAL" && d.natureza === "PREPARADO" && !d.referenciaInternaInsumoId && <ReceitaFiscalForm d={d} mudar={mudar} painel={painel} />}
    {d.tratamento === "KIT_COMPOSTO" && <ComponentesKitForm d={d} mudar={mudar} painel={painel} />}
  </div>;
}

function PerfilForm({ d, mudar }: { d: PerfilFiscal; mudar: (v: PerfilFiscal) => void }) {
  const alterar = <K extends keyof PerfilFiscal>(k: K, v: PerfilFiscal[K]) => mudar({ ...d, [k]: v });
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Identificador nome="Código do estabelecimento (sem espaços)" valor={d.estabelecimento} mudar={v => alterar("estabelecimento", v)} /><Codigo nome="CNPJ" tamanho={14} required valor={d.cnpj} mudar={v => alterar("cnpj", v ?? "")} /><Texto nome="UF do estabelecimento" required maxLength={2} pattern="[A-Z]{2}" value={d.uf} onChange={e => alterar("uf", e.target.value.toUpperCase())} /><Codigo nome="Código IBGE do município" tamanho={7} required valor={d.codigoMunicipio} mudar={v => alterar("codigoMunicipio", v ?? "")} /><Texto nome="Inscrição estadual" inputMode="numeric" restricao="digitos" maxLength={14} value={d.inscricaoEstadual} onChange={e => alterar("inscricaoEstadual", e.target.value)} /><Selecao nome="Regime tributário" valor={d.regime} mudar={v => v && alterar("regime", v)} opcoes={regimes} /><Selecao nome="CRT do estabelecimento" valor={d.crt === undefined ? null : String(d.crt)} vazio="Aguardar prova do CRT" mudar={v => alterar("crt", v ? Number(v) as 1 | 2 | 3 | 4 : undefined)} opcoes={[["1", "1 · Simples Nacional"], ["2", "2 · Simples Nacional com excesso de sublimite"], ["3", "3 · Regime normal"], ["4", "4 · Microempreendedor Individual (MEI)"]]} /><Selecao nome="Emissor responsável pelas operações" valor={d.emissor} mudar={v => v && alterar("emissor", v)} opcoes={[["TAKEAT", "Takeat"], ["BRASIL_NFE", "Brasil NFe"], ["MANUAL", "Emissão externa manual"]]} /><Selecao nome="Obrigações IBS/CBS" valor={d.reforma} mudar={v => v && alterar("reforma", v)} opcoes={[["DISPENSADO_SIMPLES_2026", "Simples 2026: sem alíquotas de teste"], ["EXIGIR_REGRA", "Exigir regra da Reforma Tributária"]]} /></div>
    <p className="text-sm text-muted-foreground">Confirme o regime e o CRT na vigência desta versão, com prova identificada. Ser optante pelo Simples não determina CRT 1: excesso de sublimite exige CRT 2 e tributação de ICMS do regime normal. A seleção não reclassifica apurações históricas nem aprova a versão.</p><Campo nome="Evidência do enquadramento empresarial"><Textarea maxLength={2000} value={d.evidenciaEnquadramento} onChange={e => alterar("evidenciaEnquadramento", e.target.value)} /></Campo><Check checked={d.confirmado} onChange={e => alterar("confirmado", e.target.checked)}>Enquadramento cadastral confirmado por evidência</Check><div className="flex flex-wrap gap-4">{(["55", "65"] as const).map(modelo => <Check key={modelo} checked={d.modelos.includes(modelo)} onChange={e => alterar("modelos", e.target.checked ? [...d.modelos, modelo] : d.modelos.filter(m => m !== modelo))}>{modelo === "55" ? "NF-e · modelo 55" : "NFC-e · modelo 65"}</Check>)}</div>
    {d.reforma === "EXIGIR_REGRA" && <LeiauteRTCForm valor={d.layoutRTC} mudar={v => alterar("layoutRTC", v)} />}
    <details className="space-y-3"><summary className="cursor-pointer font-medium">Benefício opcional fundamentado</summary><p className="text-xs text-muted-foreground">O regime paulista do Decreto 51.597/2007 exclui Simples e a vigência publicada termina em 31/12/2026. Benefício exige elegibilidade, opção formal e prazo.</p><Check checked={!!d.beneficioOpcional} onChange={e => alterar("beneficioOpcional", e.target.checked ? { codigo: "", elegibilidade: "", opcaoComprovada: "", fim: "" } : null)}>Registrar opção comprovada</Check>{d.beneficioOpcional && <div className="grid gap-4 sm:grid-cols-2">{(["codigo", "elegibilidade", "opcaoComprovada"] as const).map(k => <Texto key={k} nome={{ codigo: "Código do benefício", elegibilidade: "Evidência de elegibilidade", opcaoComprovada: "Registro formal da opção" }[k]} required maxLength={2000} value={d.beneficioOpcional![k]} onChange={e => alterar("beneficioOpcional", { ...d.beneficioOpcional!, [k]: e.target.value })} />)}<Texto nome="Fim da vigência do benefício" type="date" required maxLength={10} value={d.beneficioOpcional.fim} onChange={e => alterar("beneficioOpcional", { ...d.beneficioOpcional!, fim: e.target.value })} /></div>}</details>
  </div>;
}

function TributoForm({ nome, d, mudar }: { nome: string; d: TributoConfigurado; mudar: (v: TributoConfigurado) => void }) {
  return <fieldset className="min-w-0 space-y-3 rounded-xl border p-3"><legend className="px-1 font-medium">{nome}</legend><div className="grid gap-3 sm:grid-cols-2"><Codigo nome={`CST ${nome}`} uso={nome === "ICMS" ? "PARAMETRO_INTERNO" : "EMISSAO"} tamanho={2} required valor={d.cst} mudar={v => mudar({ ...d, cst: v ?? "" })} /><Selecao nome={`Destaque ${nome}`} valor={d.modalidade} mudar={v => v && mudar({ ...d, modalidade: v })} opcoes={[["SEM_DESTAQUE", "Sem destaque fundamentado"], ["TRIBUTADO", "Tributado"]]} /><Decimal nome={`Alíquota ${nome} (%)`} valor={d.aliquota} required={d.modalidade === "TRIBUTADO"} mudar={v => mudar({ ...d, aliquota: v })} /><Decimal nome={`Redução da base ${nome} (%)`} valor={d.reducaoBase} required mudar={v => mudar({ ...d, reducaoBase: v ?? "" })} /></div><Campo nome={`Fundamento ${nome}`}><Textarea maxLength={2000} required value={d.justificativa} onChange={e => mudar({ ...d, justificativa: e.target.value })} /></Campo></fieldset>;
}

function RegraForm({ d, mudar, painel }: { d: RegraFiscal; mudar: (v: RegraFiscal) => void; painel: PainelFiscal }) {
  const alterar = <K extends keyof RegraFiscal>(k: K, v: RegraFiscal[K]) => mudar({ ...d, [k]: v });
  const referencia = d.produtoId?.startsWith("INSUMO:") ? (painel.insumos ?? []).find(i => `INSUMO:${i.id}` === d.produtoId) : undefined;
  const produtos = [...painel.produtos.map(p => [p.id, p.nome] as const), ...(d.produtoId?.startsWith("INSUMO:") ? [[d.produtoId, `Referência do kit · ${referencia?.nome ?? "Cadastro indisponível"}`] as const] : [])];
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Identificador nome="Código do estabelecimento da regra" valor={d.estabelecimento} mudar={v => alterar("estabelecimento", v)} /><Selecao nome="Regime da regra" valor={d.regime} mudar={v => v && alterar("regime", v)} opcoes={regimes} /><Texto nome="UF de destino" required maxLength={2} pattern="[A-Z]{2}" value={d.ufDestino} onChange={e => alterar("ufDestino", e.target.value.toUpperCase())} /><Selecao nome="Destinatário" valor={d.destinatario} mudar={v => v && alterar("destinatario", v)} opcoes={[["CONSUMIDOR_FINAL", "Consumidor final"], ["CONTRIBUINTE", "Contribuinte ICMS"]]} /><Selecao nome="Grupo abrangido" valor={d.grupo} mudar={v => alterar("grupo", v)} opcoes={GRUPOS_FISCAIS} vazio="Todos os grupos compatíveis" /><Selecao nome="Produto específico" valor={d.produtoId} mudar={v => alterar("produtoId", v)} opcoes={produtos} vazio="Sem restrição por produto" /><Selecao nome="Natureza abrangida" valor={d.natureza} mudar={v => alterar("natureza", v)} opcoes={naturezas} vazio="Todas as naturezas compatíveis" /><Codigo nome="NCM específico, se necessário" tamanho={8} valor={d.ncm} mudar={v => alterar("ncm", v)} /><Codigo nome="CFOP de venda" tamanho={4} required valor={d.cfop} mudar={v => alterar("cfop", v ?? "")} /><Codigo nome="CSOSN, quando Simples" tamanho={3} valor={d.csosn} mudar={v => alterar("csosn", v)} /><Selecao nome="Tratamento ICMS-ST" valor={d.st} mudar={v => v && alterar("st", v)} opcoes={[["NAO_APLICAVEL", "Não aplicável nesta operação"], ["RETIDO_ANTERIORMENTE", "Retido anteriormente, comprovado"], ["CALCULO_PENDENTE", "Cálculo ST pendente: impedir emissão"]]} /><Codigo nome="CEST desta regra" ncm={d.ncm} tamanho={7} valor={d.cest} mudar={v => alterar("cest", v)} /></div>
    <Campo nome="Evidência de retenção ICMS-ST (opcional)"><Textarea maxLength={2000} value={d.evidenciaSt ?? ""} onChange={e => alterar("evidenciaSt", e.target.value || undefined)} /></Campo>
    <p className="text-xs text-muted-foreground">Identifique a nota de entrada e o item que comprovam o ICMS-ST retido. O CEST, sozinho, não comprova retenção.</p>
    <Texto nome="Segregação da receita" required maxLength={120} value={d.segregacaoReceita} onChange={e => alterar("segregacaoReceita", e.target.value)} />
    {(["icms", "pis", "cofins"] as const).map(k => <TributoForm key={k} nome={k.toUpperCase()} d={d[k]} mudar={v => alterar(k, v)} />)}
    <Check checked={!!d.ipi} onChange={e => alterar("ipi", e.target.checked ? tributoVazio() : null)}>Parametrizar IPI desta operação</Check>{d.ipi && <TributoForm nome="IPI" d={d.ipi} mudar={v => alterar("ipi", v)} />}
    <details className="space-y-3"><summary className="cursor-pointer font-medium">IBS/CBS e Imposto Seletivo</summary><Check checked={!!d.reforma} onChange={e => alterar("reforma", e.target.checked ? { cst: "", cClassTrib: "", cbs: "", ibsUf: "", ibsMunicipio: "", reducao: "0", justificativa: "" } : null)}>Informar tributação IBS/CBS por vigência</Check>{d.reforma && <div className="space-y-3"><div className="grid gap-4 sm:grid-cols-2"><Codigo nome="CST IBS/CBS" tamanho={3} required valor={d.reforma.cst} mudar={v => alterar("reforma", { ...d.reforma!, cst: v ?? "" })} /><Codigo nome="cClassTrib" cst={d.reforma.cst} tamanho={6} required valor={d.reforma.cClassTrib} mudar={v => alterar("reforma", { ...d.reforma!, cClassTrib: v ?? "" })} />{(["cbs", "ibsUf", "ibsMunicipio", "reducao"] as const).map(k => <Decimal key={k} nome={{ cbs: "CBS (%)", ibsUf: "IBS estadual (%)", ibsMunicipio: "IBS municipal (%)", reducao: "Redução IBS/CBS (%)" }[k]} required valor={d.reforma![k]} mudar={v => alterar("reforma", { ...d.reforma!, [k]: v ?? "" })} />)}</div><Campo nome="Fundamento IBS/CBS"><Textarea required maxLength={2000} value={d.reforma.justificativa} onChange={e => alterar("reforma", { ...d.reforma!, justificativa: e.target.value })} /></Campo><Preco2027Form valor={d.reforma.preco2027} mudar={v => alterar("reforma", { ...d.reforma!, preco2027: v })} /></div>}<Selecao nome="Imposto Seletivo" valor={d.seletivo} mudar={v => v && alterar("seletivo", v)} opcoes={[["NAO_APLICAVEL", "Não aplicável à operação, fundamentado"], ["ANALISE_PENDENTE", "Análise de incidência pendente"]]} /></details>
  </div>;
}

function TabelaForm({ d, mudar }: { d: TabelaFiscal; mudar: (v: TabelaFiscal) => void }) {
  const [erro, setErro] = useState("");
  async function importar(arquivo?: File) {
    if (!arquivo) return; setErro("");
    if (arquivo.size > 450_000) { setErro("Arquivo acima de 450 KB. Importe um recorte oficial dos códigos necessários."); return; }
    try {
      const obj: unknown = JSON.parse(await arquivo.text());
      const itens = Array.isArray(obj) ? obj : typeof obj === "object" && obj && "linhas" in obj ? (obj as { linhas: unknown }).linhas : null;
      if (!Array.isArray(itens) || itens.length > 20000 || itens.some(v => !v || typeof v !== "object" || typeof v.codigo !== "string" || typeof v.descricao !== "string")) throw new Error();
      mudar({ ...d, linhas: itens as TabelaFiscal["linhas"], completa: false });
    } catch { setErro("Use JSON com uma lista de linhas contendo codigo e descricao. Campos opcionais: ncm, cst, regimes, modelos, aliquota e reducao."); }
  }
  return <div className="space-y-4"><Selecao nome="Tipo da tabela oficial" valor={d.tabela} mudar={v => v && mudar({ ...d, tabela: v })} opcoes={tabelas.map(v => [v, v] as const)} /><Texto nome="Referência e versão da publicação oficial" required maxLength={300} value={d.referencia} onChange={e => mudar({ ...d, referencia: e.target.value })} /><Campo nome="Importar códigos oficiais em JSON"><Input type="file" accept=".json,application/json" onChange={e => { void importar(e.target.files?.[0]); e.target.value = ""; }} /></Campo><p className="text-xs text-muted-foreground">Até 450 KB; permita recorte de códigos usados pelo catálogo. Declare carga completa somente quando todo o arquivo oficial tiver sido conferido. As fontes e a vigência ficam no histórico.</p><Check checked={d.completa} onChange={e => mudar({ ...d, completa: e.target.checked })}>Esta versão contém a tabela oficial completa conferida</Check>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<p className="font-medium">{d.linhas.length} código(s) no rascunho · prévia dos primeiros 100</p><Button type="button" variant="outline" onClick={() => mudar({ ...d, linhas: [{ codigo: "", descricao: "" }, ...d.linhas] })}><Plus className="size-4" />Adicionar código oficial</Button>
    <div className="max-h-64 space-y-2 overflow-auto">{d.linhas.slice(0, 100).map((l, i) => <div key={i} className="flex gap-2"><Input aria-label={`Código da linha ${i + 1}`} inputMode="numeric" restricao="digitos" maxLength={8} value={l.codigo} onChange={e => mudar({ ...d, linhas: d.linhas.map((a, j) => j === i ? { ...a, codigo: e.target.value } : a) })} /><Input aria-label={`Descrição da linha ${i + 1}`} maxLength={2000} value={l.descricao} onChange={e => mudar({ ...d, linhas: d.linhas.map((a, j) => j === i ? { ...a, descricao: e.target.value } : a) })} /><BotaoRemoverItem nome={`Remover código ${l.codigo || i + 1}`} onClick={() => mudar({ ...d, linhas: d.linhas.filter((_, j) => j !== i) })} /></div>)}</div></div>;
}

function ComplementoForm({ d, mudar, painel }: { d: ComportamentoFiscal; mudar: (v: ComportamentoFiscal) => void; painel: PainelFiscal }) {
  const apresentacao = d.comportamento === "MERCADORIA" && !!d.produtoId && <EscolhasMercadoriaForm produtoId={d.produtoId} escolhas={d.escolhas} mudar={v => mudar({ ...d, escolhas: v })} painel={painel} />;
  return <div className="space-y-4"><Selecao nome="Alternativa do catálogo" valor={d.opcaoId} mudar={v => mudar({ ...d, opcaoId: v ?? "" })} opcoes={painel.opcoes.map(o => [o.id, `${o.grupo} · ${o.nome}`] as const)} vazio="Selecione a alternativa" /><Selecao nome="Tratamento fiscal da escolha" valor={d.comportamento} mudar={v => v && mudar({ ...d, comportamento: v, ...(v !== "MERCADORIA" ? { escolhas: undefined } : {}) })} opcoes={[["INCLUIDO", "Escolha incluída: composição do produto"], ["INTEGRADO", "Extra cobrado integrado ao alimento"], ["MERCADORIA", "Mercadoria adicional com linha fiscal"], ["APRESENTACAO", "Adicional de apresentação/embalagem"]]} /><Selecao nome="Mercadoria vinculada, quando independente" valor={d.produtoId} mudar={v => mudar({ ...d, produtoId: v, escolhas: undefined })} opcoes={painel.produtos.map(p => [p.id, p.nome] as const)} vazio="Sem mercadoria independente" />{apresentacao}<Campo nome="Justificativa da relação com o produto principal"><Textarea required minLength={15} maxLength={2000} value={d.justificativa} onChange={e => mudar({ ...d, justificativa: e.target.value })} /></Campo><p className="text-xs text-muted-foreground">Sabor, quantidade, ausência de ingrediente e embalagem padrão não viram mercadorias automaticamente. O total comercial continua sendo a origem do valor fiscal.</p></div>;
}
