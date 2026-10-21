"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import { salvarRascunhoRegraBrasilNfeAction } from "./actions";
import { CAMPOS_CLASSIFICACAO, CAMPOS_CLASSIFICACAO_ADICIONAIS, camposIniciaisRegraBrasilNfe, mensagemCampoRegraBrasilNfe, montarRascunhoFormularioBrasilNfe } from "./formulario-dominio";
import type { CatalogosRegrasBrasilNfe, HistoricoRegraBrasilNfe } from "./tipos";
import { FundamentacaoFiscalFormulario } from "./fundamentacao-formulario";
import { aceitaEdicaoGtinFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/gtin";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
import { SeletorFiscal } from "@/components/fiscal/seletor-fiscal";

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return <section className="space-y-3"><h3 className="font-semibold">{titulo}</h3>{descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}<div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div></section>;
}
function CampoRegra({ nome, children }: { nome: string; children: ReactNode }) { return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{nome}{children}</label>; }
type Opcoes = readonly (readonly [string, string])[];
export function FormularioRegraBrasilNfe({ catalogos, historico, fechar }: { catalogos: CatalogosRegrasBrasilNfe; historico?: HistoricoRegraBrasilNfe; fechar: () => void }) {
  const [inicial] = useState(() => camposIniciaisRegraBrasilNfe(historico));
  const [campos, definirCampos] = useState(inicial.campos), [pagamentos, definirPagamentos] = useState(inicial.pagamentos);
  const [fundamentacao, definirFundamentacao] = useState(inicial.fundamentacao);
  const [salvando, definirSalvando] = useState(false), [erro, definirErro] = useState("");
  const router = useRouter(), idFormulario = useId(), trava = useRef(false);
  const alterado = JSON.stringify({ campos, pagamentos, fundamentacao }) !== JSON.stringify(inicial);
  const mudar = (campo: string, valor: string) => { definirCampos(c => ({ ...c, [campo]: valor })); definirErro(""); };
  const texto = (campo: string, nome: string, maximo: number, requerido = true, numerico: "digitos" | "decimal" | undefined = undefined, casas = 4) => <CampoRegra nome={nome}><Input aria-label={nome} aria-describedby={campo === "ean" ? `${idFormulario}-gtin` : undefined} value={campos[campo] ?? ""} maxLength={maximo} required={requerido} restricao={numerico} casasDecimais={casas} inputMode={numerico === "digitos" ? "numeric" : numerico === "decimal" ? "decimal" : undefined} min={numerico ? "0" : undefined}
    onKeyDown={e => { if (campo !== "ean" || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return; const el = e.currentTarget, proposta = el.value.slice(0, el.selectionStart ?? 0) + e.key + el.value.slice(el.selectionEnd ?? el.value.length); if (!aceitaEdicaoGtinFiscalBrasilNfe(proposta.toUpperCase())) e.preventDefault(); }}
    onPaste={e => { if (campo !== "ean") return; const el = e.currentTarget, proposta = el.value.slice(0, el.selectionStart ?? 0) + e.clipboardData.getData("text") + el.value.slice(el.selectionEnd ?? el.value.length); if (!aceitaEdicaoGtinFiscalBrasilNfe(proposta.toUpperCase())) e.preventDefault(); }}
    onChange={e => { const valor = campo === "ean" ? e.target.value.toUpperCase() : e.target.value; if (campo === "ean" && !aceitaEdicaoGtinFiscalBrasilNfe(valor)) { e.target.value = campos[campo] ?? ""; return; } mudar(campo, valor); }} /></CampoRegra>;
  const selecao = (campo: string, nome: string, opcoes: Opcoes, disabled = false) => <CampoRegra nome={nome}><SelecaoFormulario aria-label={nome} value={campos[campo] ?? ""} onValueChange={v => mudar(campo, v)} disabled={disabled} required><option value="">Selecione</option>{opcoes.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</SelecaoFormulario></CampoRegra>;
  const booleano = (campo: string, nome: string) => selecao(campo, nome, [["SIM", "Sim"], ["NAO", "Não"]]);
  const trocarCadastro = (campo: "produtoId" | "grupoId", valor: string) => {
    const cadastro = campo === "produtoId" ? catalogos.produtos.find(p => p.id === valor) : catalogos.grupos.find(g => g.id === valor);
    definirCampos(c => ({ ...c, [campo]: valor, ...Object.fromEntries([...CAMPOS_CLASSIFICACAO, ...CAMPOS_CLASSIFICACAO_ADICIONAIS].map(k => [k, cadastro?.fiscal[k] ?? ""])) }));
  };
  const tributo = (t: "icms" | "pis" | "cofins") => <Secao titulo={t.toUpperCase()}>
    {selecao(`${t}Tratamento`, `Tratamento de ${t.toUpperCase()}`, [["SEM_DESTAQUE", "Sem destaque"], ["TRIBUTADO", "Tributado"], ...(t === "icms" ? [] : [["RECOLHIDO_DAS", "Recolhido no DAS · CST 49/99"] as const])])}
    {t !== "icms" && campos[`${t}Tratamento`] === "RECOLHIDO_DAS" && <p className="text-sm text-muted-foreground sm:col-span-2">Exige regime e enquadramento confirmados para CRT 1, 2 ou 4, CST 49/99 informado e fundamentação aplicável. Este tratamento não recebe base ou alíquota de destaque; escolher a opção não preenche códigos fiscais.</p>}
    {campos[`${t}Tratamento`] === "TRIBUTADO" && texto(`${t}Aliquota`, `Alíquota de ${t.toUpperCase()} (%)`, 8, true, "decimal")}
    {t === "icms" && campos.icmsTratamento === "TRIBUTADO" && selecao("modalidadeBcIcms", "Modalidade da base ICMS", [["0", "0 · Margem de valor agregado"], ["1", "1 · Pauta"], ["2", "2 · Preço tabelado máximo"], ["3", "3 · Valor da operação"]])}
  </Secao>;
  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (trava.current) return;
    let entrada: unknown;
    try { entrada = montarRascunhoFormularioBrasilNfe(campos, pagamentos, historico, fundamentacao); }
    catch (erro) { definirErro(erro instanceof Error ? erro.message : "Confira os campos da decisão tributária."); return; }
    trava.current = true; definirSalvando(true); definirErro("");
    try {
      const resultado = await salvarRascunhoRegraBrasilNfeAction(entrada);
      if ("erro" in resultado) definirErro(mensagemCampoRegraBrasilNfe(resultado.erro, resultado.campo));
      else { fechar(); router.refresh(); }
    } catch { definirErro("Não foi possível salvar. Seu preenchimento foi mantido."); }
    finally { trava.current = false; definirSalvando(false); }
  }
  return <Dialog open alterado={alterado} protegerAlteracoes={!salvando} onOpenChange={aberto => { if (!aberto && !salvando) fechar(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{historico ? "Nova revisão tributária" : "Nova decisão tributária"}</DialogTitle><DialogDescription>Informe parâmetros com fundamentação verificável. Salvar cria uma proposta; a aprovação interna é separada e não habilita emissão.</DialogDescription></DialogHeader>
      <form id={idFormulario} onSubmit={salvar} className="space-y-5"><fieldset disabled={salvando} className="min-w-0 space-y-6">
        <Secao titulo="Decisão e vigência">
          {selecao("modelo", "Modelo", [["55", "NF-e · modelo 55"], ["65", "NFC-e · modelo 65"]], !!historico)}
          {selecao("alvo", "Aplicar a", [["EMPRESA", "Emitente"], ["OPERACAO", "Operação de venda"], ["PRODUTO", "Produto"], ["GRUPO", "Grupo fiscal"]], !!historico)}
          {campos.alvo === "PRODUTO" && <CampoRegra nome="Produto"><SelecaoFormulario aria-label="Produto" required disabled={!!historico} value={campos.produtoId ?? ""} onValueChange={v => trocarCadastro("produtoId", v)}><option value="">Selecione</option>{catalogos.produtos.map(p => <option key={p.id} value={p.id}>{p.nome}{!p.revisado ? " · ficha pendente de revisão" : ""}</option>)}</SelecaoFormulario></CampoRegra>}
          {campos.alvo === "GRUPO" && <CampoRegra nome="Grupo fiscal"><SelecaoFormulario aria-label="Grupo fiscal" required disabled={!!historico} value={campos.grupoId ?? ""} onValueChange={v => trocarCadastro("grupoId", v)}><option value="">Selecione</option>{catalogos.grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}</SelecaoFormulario></CampoRegra>}
          <CampoRegra nome="Início da vigência"><Input aria-label="Início da vigência" type="date" required value={campos.vigenteDesde ?? ""} min="2000-01-01" max="2199-12-31" onChange={e => mudar("vigenteDesde", e.target.value)} /></CampoRegra>
          <CampoRegra nome="Fim da vigência (opcional)"><Input aria-label="Fim da vigência (opcional)" type="date" value={campos.vigenteAte ?? ""} min={campos.vigenteDesde || "2000-01-01"} max="2199-12-31" onChange={e => mudar("vigenteAte", e.target.value)} /></CampoRegra>
        </Secao>
        {historico?.versoes[0]?.legado && <p className="text-sm text-muted-foreground">A revisão anterior usa o contrato legado. Sua referência e aprovação histórica serão preservadas; esta proposta exige fundamentação nova e revisão interna explícita.</p>}
        <FundamentacaoFiscalFormulario valor={fundamentacao} mudar={v => { definirFundamentacao(v); definirErro(""); }} modelo={campos.modelo} alvo={campos.alvo} />
        {campos.alvo === "EMPRESA" && <Secao titulo="Complementos do emitente" descricao="CNPJ, razão social e endereço são utilizados do cadastro da empresa. Esta decisão não altera o Brasil NFe.">
          {selecao("crt", "CRT", [["1", "1 · Simples Nacional"], ["2", "2 · Simples Nacional, excesso de sublimite"], ["3", "3 · Regime normal"], ["4", "4 · MEI"]])}
          {texto("ie", "Inscrição estadual", 14, true, "digitos")}{texto("codMunicipio", "Município IBGE", 7, true, "digitos")}{texto("codPais", "Código do país", 4, true, "digitos")}{texto("pais", "País", 60)}
        </Secao>}
        {campos.alvo === "OPERACAO" && <>
          <Secao titulo="Operação de venda">
            {texto("NaturezaOperacao", "Natureza da operação", 60)}{selecao("Finalidade", "Finalidade", [["1", "Normal"]])}
            {selecao("IndicadorPresenca", "Presença do comprador", [["0", "0 · Não se aplica"], ["1", "1 · Presencial"], ["2", "2 · Internet"], ["3", "3 · Teleatendimento"], ["4", "4 · NFC-e com entrega a domicílio"], ["5", "5 · Presencial fora do estabelecimento"], ["9", "9 · Outros"]])}
            {selecao("ModalidadeFrete", "Modalidade do frete", [["0", "0 · Por conta do remetente"], ["1", "1 · Por conta do destinatário"], ["2", "2 · Por conta de terceiros"], ["3", "3 · Transporte próprio do remetente"], ["4", "4 · Transporte próprio do destinatário"], ["9", "9 · Sem transporte"]])}
            {booleano("ConsumidorFinal", "Consumidor final")}{booleano("CalcularIBPT", "Calcular IBPT")}{booleano("intermediadorAplicavel", "Intermediador")}
          </Secao>
          <Secao titulo="Destinatário">
            {booleano("identificar", "Identificar destinatário")}
            {campos.identificar === "SIM" && <>{selecao("origemDestinatario", "Dados do destinatário", [["comprador", "Comprador"], ["cobranca", "Cobrança"], ["destinatario", "Destinatário da entrega"]])}{selecao("indicadorIe", "Indicador de IE", [["1", "1 · Contribuinte"], ["2", "2 · Isento"], ["9", "9 · Não contribuinte"]])}</>}
          </Secao>
          <Secao titulo="Pagamentos" descricao="Usa os valores preservados do pedido. Bases tributárias e autorizações de cartão são complementos de cada documento.">
            {selecao("fonte", "Valores dos pagamentos", [["TOTAL", "Total do pedido"], ["PARCELAS", "Parcelas fotografadas"]])}{booleano("incluirCobranca", "Incluir cobrança")}{selecao("troco", "Troco", [["0", "Sem troco"]])}
          </Secao>
          <section className="space-y-3" aria-label="Correspondências de pagamento"><h3 className="font-semibold">Correspondências de pagamento</h3><p className="text-sm text-muted-foreground">Selecione a forma existente e informe o código fiscal aprovado. O nome comercial não determina o código.</p>
            {pagamentos.map((p, indice) => <div key={indice} className="space-y-3 rounded-[var(--ds-cartao-raio)] border p-4"><div className="grid gap-4 sm:grid-cols-2">
              <CampoRegra nome="Forma de pagamento"><SelecaoFormulario aria-label={`Forma de pagamento ${indice + 1}`} required value={p.formaId} onValueChange={v => definirPagamentos(atuais => atuais.map((m, i) => i === indice ? { ...m, formaId: v } : m))}><option value="">Selecione</option>{catalogos.formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</SelecaoFormulario></CampoRegra>
              <CampoRegra nome="Código fiscal do pagamento"><SeletorFiscal nome={`Código fiscal do pagamento ${indice + 1}`} valor={p.codigo} requerido contexto={{ tabela: "pagamento", dia: campos.vigenteDesde || undefined }} mudar={codigo => definirPagamentos(atuais => atuais.map((m, i) => i === indice ? { ...m, codigo } : m))} /></CampoRegra>
              <CampoRegra nome="Indicador do pagamento"><SelecaoFormulario aria-label={`Indicador do pagamento ${indice + 1}`} required value={p.indicador} onValueChange={v => definirPagamentos(atuais => atuais.map((m, i) => i === indice ? { ...m, indicador: v } : m))}><option value="">Selecione</option><option value="0">À vista</option><option value="1">A prazo</option></SelecaoFormulario></CampoRegra>
              <CampoRegra nome="Descrição (obrigatória para código 99)"><Input aria-label={`Descrição do pagamento ${indice + 1}`} required={p.codigo === "99"} maxLength={60} value={p.descricao} onChange={e => definirPagamentos(atuais => atuais.map((m, i) => i === indice ? { ...m, descricao: e.target.value } : m))} /></CampoRegra>
            </div><GrupoAcoes><BotaoRemoverItem nome={`Remover correspondência de pagamento ${indice + 1}`} onClick={() => definirPagamentos(atuais => atuais.filter((_, i) => i !== indice))} /></GrupoAcoes></div>)}
            <Button type="button" variant="outline" disabled={pagamentos.length >= 100 || !catalogos.formas.length} onClick={() => definirPagamentos(atuais => [{ formaId: "", codigo: "", indicador: "", descricao: "" }, ...atuais])}>Adicionar correspondência</Button>
          </section>
        </>}
        {["PRODUTO", "GRUPO"].includes(campos.alvo) && <>
          <section className="space-y-3"><h3 className="font-semibold">Classificações</h3><p className="text-sm text-muted-foreground">Confira a mercadoria e a operação. A aprovação exige correspondência com o cadastro fiscal revisado.</p><CamposClassificacaoFiscal fiscal={campos} mudar={v => { definirCampos(v); definirErro(""); }} crt={campos.vigenteDesde && ((catalogos.vigenteDesde && campos.vigenteDesde < catalogos.vigenteDesde) || (catalogos.vigenteAte && campos.vigenteDesde > catalogos.vigenteAte)) ? null : catalogos.crt} dia={campos.vigenteDesde || undefined} modelo={campos.modelo === "55" ? 55 : campos.modelo === "65" ? 65 : undefined} aplicabilidade={{ cest: campos.cestAplicavel === "SIM", ipi: campos.ipiAplicavel === "SIM", fcp: campos.fcpAplicavel === "SIM", beneficio: campos.beneficioFiscalAplicavel === "SIM", ibsCbs: campos.ibsCbsAplicavel === "SIM" }} /></section>
          <Secao titulo="Conversão e aplicabilidade" descricao="Escolha Sim ou Não conforme a fundamentação verificada. Tributos adicionais aplicáveis podem exigir extensão da montagem antes da homologação.">
            {texto("fatorTributavel", "Fator tributável", 17, true, "decimal", 6)}{booleano("cestAplicavel", "CEST aplicável")}{selecao("ipiAplicavel", "Enquadramento do IPI", [["SIM", "Aplicável"], ["NAO", "Não aplicável"], ["NAO_DEFINIDO", "Não definido · representação independente pelo Simples"]])}{booleano("stAplicavel", "ST aplicável")}{booleano("fcpAplicavel", "FCP aplicável")}{booleano("difalAplicavel", "DIFAL aplicável")}{booleano("ibsCbsAplicavel", "IBS/CBS aplicável")}{booleano("beneficioFiscalAplicavel", "Benefício fiscal aplicável")}
          </Secao>
          <CampoRegra nome="Representação do IPI (opcional)"><SelecaoFormulario aria-label="Representação do IPI" value={campos.representacaoIpi ?? ""} onValueChange={v => mudar("representacaoIpi", v)}><option value="">Sem nova decisão de representação</option><option value="OMITIR_SIMPLES">Omitir grupo IPI na saída do Simples</option></SelecaoFormulario><p className="mt-1.5 text-sm text-muted-foreground">Exige fundamentação e aprovação interna. Não determina industrialização ou Anexo do DAS e não inventa CST ou enquadramento. CST IPI preenchido continua sendo uma divergência que precisa de revisão.</p></CampoRegra>
          {tributo("icms")}{tributo("pis")}{tributo("cofins")}
        </>}
      </fieldset>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes nome="Salvar decisão tributária" className="border-t pt-4"><DialogClose render={<Button type="button" variant="outline" disabled={salvando} />}>Cancelar</DialogClose><Button type="submit" disabled={salvando || !alterado}>{salvando ? "Salvando…" : "Salvar proposta"}</Button></GrupoAcoes></form>
    </DialogContent>
  </Dialog>;
}
