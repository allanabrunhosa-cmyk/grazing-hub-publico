"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import { acompanhamentoCertificadoBrasilNfe, type PreRequisitosBrasilNfe, type ResultadoPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { CATEGORIAS_DIAGNOSTICO_BRASILNFE, ETAPAS_CONTRATO_BRASILNFE } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";
type EstadoEvidencia = { servicoAtivo: string; homologacaoInformada: string; certificadoValidade: string; ufEmitente: string; cscHomologacao: string; idCscHomologacao: string; cscProducao: string; idCscProducao: string };
const inicialEvidencia: EstadoEvidencia = { servicoAtivo: "", homologacaoInformada: "", certificadoValidade: "", ufEmitente: "", cscHomologacao: "", idCscHomologacao: "", cscProducao: "", idCscProducao: "" };
const nomes: Record<Exclude<keyof EstadoEvidencia, "certificadoValidade" | "ufEmitente">, string> = { servicoAtivo: "NF-e/NFC-e ativo no painel", homologacaoInformada: "Fornecedor informou liberação de homologação", cscHomologacao: "CSC de homologação preenchido", idCscHomologacao: "Identificador CSC de homologação preenchido", cscProducao: "CSC de produção preenchido", idCscProducao: "Identificador CSC de produção preenchido" };
const presenca = (v: boolean | null) => v === true ? "Configurado" : v === false ? "Ausente" : "Não conferido";
export function PreRequisitosBrasilNfeCard({ inicial, editar, registrar, verificar }: { inicial: PreRequisitosBrasilNfe; editar: boolean; registrar: (e: unknown) => Promise<ResultadoPreRequisitosBrasilNfe>; verificar: (e: unknown) => Promise<ResultadoPreRequisitosBrasilNfe> }) {
  const id = useId(), [dados, setDados] = useState(inicial), [evidencia, setEvidencia] = useState(inicialEvidencia), [erro, setErro] = useState("");
  const [origemEvidencia, setOrigemEvidencia] = useState("PAINEL_BRASIL_NFE");
  const [pendente, iniciar] = useTransition(), trava = useRef(false);
  const geracao = useRef(0);
  useEffect(() => { const atual = ++geracao.current; queueMicrotask(() => { if (atual === geracao.current) setDados(inicial); }); }, [inicial]);
  const validade = dados.certificado.validade ?? dados.evidenciaPainel?.certificadoValidade ?? null;
  const acompanhamento = acompanhamentoCertificadoBrasilNfe(validade), csc = dados.verificadoEm ? dados.csc : dados.evidenciaPainel?.csc;
  const alterado = Object.values(evidencia).some(v => v !== "");
  function executar(tipo: "registrar" | "verificar") {
    if (!editar || trava.current) return;
    if (tipo === "registrar" && Object.keys(nomes).some(k => !["SIM", "NAO"].includes(evidencia[k as keyof EstadoEvidencia]))) { setErro("Informe explicitamente todos os estados observados no painel, sem digitar códigos ou segredos."); return; }
    trava.current = true; setErro(""); const atual = geracao.current;
    iniciar(async () => {
      try {
        const r = tipo === "verificar" ? await verificar({ versao: dados.versaoConfiguracao }) : await registrar({ versao: dados.versaoConfiguracao, observadoEm: new Date().toISOString(), origemEvidencia, ...Object.fromEntries(Object.keys(nomes).map(k => [k, evidencia[k as keyof EstadoEvidencia] === "SIM"])), ufEmitente: evidencia.ufEmitente || null, certificadoValidade: evidencia.certificadoValidade || null });
        if (atual !== geracao.current) return;
        if (r.ok) { setDados(r.dados); if (tipo === "registrar") setEvidencia(inicialEvidencia); } else setErro(r.erro);
      } catch { setErro("Conferência indisponível. Nenhuma emissão foi autorizada."); }
      finally { trava.current = false; }
    });
  }
  return <Card>
    <CardHeader><CardTitle>Pré-requisitos de homologação</CardTitle><CardDescription>Evidência do painel, certificado e CSC são conferências separadas. Registrar estados ou consultar pré-requisitos não emite documentos.</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">Serviço no painel</p><p className="text-sm">{dados.evidenciaPainel ? dados.evidenciaPainel.servicoNfeNfceAtivo ? "Ativo — evidência do painel" : "Inativo — evidência do painel" : "Evidência ainda não registrada"}</p></div>
        <div><p className="text-xs text-muted-foreground">Consulta da API de serviços</p><p className="text-sm">Separada; status 1 continua sem significado confirmado.</p></div>
        <div><p className="text-xs text-muted-foreground">Certificado interno</p><p className="text-sm">{dados.certificado.situacao === "VALIDO" ? "Confirmado por consulta de leitura" : dados.certificado.situacao === "EXPIRADO" ? "Expirado" : "Consulta ainda não confirmada"}{dados.certificado.httpStatus && ` · HTTP ${dados.certificado.httpStatus}`}</p></div>
        <div><p className="text-xs text-muted-foreground">Validade / acompanhamento</p><p className="text-sm">{validade ? `${validade.split("-").reverse().join("/")} · ${dados.certificado.validade ? "consulta" : "painel"}` : "Não conferida"}</p>{acompanhamento.dias !== null && <Badge variant={acompanhamento.dias <= 30 ? "warning" : "outline"}>{acompanhamento.dias < 0 ? "Vencido: conferir renovação" : acompanhamento.dias === 0 ? "Vence hoje" : `${acompanhamento.dias} dias — ${acompanhamento.dias <= 30 ? "programar renovação" : "acompanhar validade"}`}</Badge>}</div>
        <div><p className="text-xs text-muted-foreground">NFC-e homologação</p><p className="text-sm">CSC: {presenca(csc?.homologacao.codigo ?? null)} · Identificador: {presenca(csc?.homologacao.identificador ?? null)}</p></div>
        <div><p className="text-xs text-muted-foreground">NFC-e produção · ambiente 1</p><p className="text-sm">CSC: {presenca(csc?.producao.codigo ?? null)} · Identificador: {presenca(csc?.producao.identificador ?? null)}</p></div>
      </div>
      {dados.evidenciaPainel && <p className="text-xs text-muted-foreground">Origem: {dados.evidenciaPainel.origem === "RELATO_USUARIO_PAINEL_BRASIL_NFE" ? "relato do usuário sobre o painel Brasil NFe" : "painel Brasil NFe"}. Observação: {new Date(dados.evidenciaPainel.observadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Liberação de homologação: {dados.evidenciaPainel.homologacaoInformadaPeloUsuario ? "informada pelo usuário" : "não informada"}. Isso não autoriza a primeira emissão.</p>}
      {dados.verificadoEm && <p className="text-xs text-muted-foreground">Última conferência de leitura: {new Date(dados.verificadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Emitente: {dados.empresaCorrespondente === true ? "correspondente" : dados.empresaCorrespondente === false ? "divergente" : "não confirmado"}.</p>}
      {dados.certificado.falha && <p className="text-xs text-muted-foreground">Certificado: {CATEGORIAS_DIAGNOSTICO_BRASILNFE[dados.certificado.falha.categoria]}{dados.certificado.falha.etapaContrato && ` · ${ETAPAS_CONTRATO_BRASILNFE[dados.certificado.falha.etapaContrato]}`}. Nenhum conteúdo da resposta foi armazenado.</p>}
      {dados.empresaFalha && <p className="text-xs text-muted-foreground">Última tentativa de BuscarEmpresa: {CATEGORIAS_DIAGNOSTICO_BRASILNFE[dados.empresaFalha.categoria]}{dados.empresaFalha.httpStatus && ` · HTTP ${dados.empresaFalha.httpStatus}`}{dados.empresaFalha.etapaContrato && ` · ${ETAPAS_CONTRATO_BRASILNFE[dados.empresaFalha.etapaContrato]}`}. Conferência anterior preservada, quando vinculada à mesma configuração; não confirma esta tentativa.</p>}
      <ul className="list-disc space-y-1 pl-5 text-sm">{dados.pendencias.map(p => <li key={p}>{p}</li>)}</ul>
      {editar && <div className="space-y-4"><p className="text-sm font-medium">Registrar conferência do painel</p><p className="text-xs text-muted-foreground">Informe apenas presença e validade. Não digite CSC, certificado, senha ou credenciais. O salvamento é local e mantém o diagnóstico anterior.</p>
        <div className="space-y-2"><Label htmlFor={`${id}-origem`}>Origem da evidência</Label><SelecaoFormulario id={`${id}-origem`} value={origemEvidencia} disabled={pendente} onValueChange={setOrigemEvidencia}><option value="PAINEL_BRASIL_NFE">Observação direta do painel</option><option value="RELATO_USUARIO_PAINEL_BRASIL_NFE">Relato do usuário sobre o painel</option></SelecaoFormulario></div>
        <div className="space-y-2"><Label htmlFor={`${id}-uf`}>UF do emitente observada no painel</Label><Input id={`${id}-uf`} maxLength={2} value={evidencia.ufEmitente} disabled={pendente || origemEvidencia !== "PAINEL_BRASIL_NFE"} onChange={e => { if (/^[A-Z]{0,2}$/.test(e.target.value)) setEvidencia(s => ({ ...s, ufEmitente: e.target.value })); }} /><p className="text-xs text-muted-foreground">Opcional. Informe somente a UF exibida no cadastro externo. O servidor compara com Dados da empresa; a evidência não altera a resposta da API nem autoriza emissão.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">{Object.entries(nomes).map(([k, nome]) => <div key={k} className="space-y-2"><Label htmlFor={`${id}-${k}`}>{nome}</Label><SelecaoFormulario id={`${id}-${k}`} value={evidencia[k as keyof EstadoEvidencia]} disabled={pendente} onValueChange={v => setEvidencia(s => ({ ...s, [k]: v }))}><option value="">Selecionar estado observado</option><option value="SIM">Sim</option><option value="NAO">Não</option></SelecaoFormulario></div>)}<div className="space-y-2"><Label htmlFor={`${id}-validade`}>Validade exibida do certificado</Label><Input id={`${id}-validade`} type="date" value={evidencia.certificadoValidade} maxLength={10} disabled={pendente} onInput={e => { const valor = e.currentTarget.value; setEvidencia(s => ({ ...s, certificadoValidade: valor })); }} onChange={e => setEvidencia(s => ({ ...s, certificadoValidade: e.target.value }))} /></div></div>
      </div>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </CardContent>
    <CardFooter className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={!editar || pendente || !alterado} onClick={() => executar("registrar")}>Registrar evidência</Button><Button variant="outline" disabled={!editar || pendente || alterado} onClick={() => executar("verificar")}>Conferir certificado e CSC</Button><p className="w-full text-xs text-muted-foreground">A conferência consulta somente BuscarEmpresa e VerificarCertificado interno. ConsultarServicos não é repetido. Produção e transmissão permanecem bloqueadas.</p></CardFooter>
  </Card>;
}
