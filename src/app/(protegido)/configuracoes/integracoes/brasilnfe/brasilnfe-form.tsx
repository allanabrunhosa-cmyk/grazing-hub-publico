"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import type { ConfiguracaoBrasilNfeDto, DetalhesDiagnosticoBrasilNfeDto, ResultadoConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dto";
import { CAMPOS_MOTIVO_BRASILNFE, CATEGORIAS_DIAGNOSTICO_BRASILNFE, ESTADOS_CAMPO_DIAGNOSTICO_BRASILNFE, ESTADOS_STATUS_FORNECEDOR_BRASILNFE, ETAPAS_CONTRATO_BRASILNFE, INDICADORES_MOTIVO_BRASILNFE, TIPOS_STATUS_FORNECEDOR_BRASILNFE, sanitizarMetadadosErroBrasilNfe, type CampoCodigoDiagnosticoBrasilNfe, type CampoTextoDiagnosticoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";

type Substituicoes = { tokenSubstituicao?: string; userTokenSubstituicao?: string; versao: number };
const credencialPermitida = (valor: string) => valor.length <= 512 && /^[\x21-\x7e]*$/.test(valor);
const situacoes = { NAO_REALIZADA: "Não realizado", PARCIAL: "Parcial", VALIDADA: "Diagnóstico registrado", FALHOU: "Falhou", CONECTADO_SERVICOS_PENDENTES: "Conectado — verificação de serviços pendente" };
const situacoesServicos = { ATIVO: "Ativo no catálogo", INATIVO: "Inativo", NAO_CONFIRMADO: "Não confirmado" };
const situacoesConsultas = { CONCLUIDA: "Concluída", FALHOU: "Falhou", NAO_REALIZADA: "Não realizada" };
const duracaoMaximaDetalhes = 5 * 60 * 1000;

function textoCampo(campo: CampoTextoDiagnosticoBrasilNfe | CampoCodigoDiagnosticoBrasilNfe) {
  return campo.estado === "EXIBIDO" && campo.valor !== null ? String(campo.valor) : ESTADOS_CAMPO_DIAGNOSTICO_BRASILNFE[campo.estado];
}

function dataDiagnostico(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor));
}

export function BrasilNfeForm({ inicial, editar, salvar, validar }: {
  inicial: ConfiguracaoBrasilNfeDto;
  editar: boolean;
  salvar: (dados: Substituicoes) => Promise<ResultadoConfiguracaoBrasilNfe>;
  validar: (dados: { versao: number }) => Promise<ResultadoConfiguracaoBrasilNfe>;
}) {
  const id = useId();
  const [dados, definirDados] = useState(inicial);
  const [token, definirToken] = useState("");
  const [userToken, definirUserToken] = useState("");
  const [erro, definirErro] = useState("");
  const [detalhes, definirDetalhes] = useState<{ dados: DetalhesDiagnosticoBrasilNfeDto; limite: number; versaoInicial: number } | null>(null);
  const [executando, iniciar] = useTransition();
  const [operacao, definirOperacao] = useState<"salvar" | "validar" | null>(null);
  const trava = useRef(false);
  const geracaoDetalhes = useRef(0);
  const versaoInicial = useRef(inicial.versao);
  const alterado = token !== "" || userToken !== "";
  const diagnostico = dados.validacaoExterna;
  const servicos = diagnostico.servicosEmissao;
  const servicoEmissao = servicos.nfe === servicos.nfce ? situacoesServicos[servicos.nfe] : `NF-e: ${situacoesServicos[servicos.nfe]}; NFC-e: ${situacoesServicos[servicos.nfce]}`;
  const detalhesCorrespondentes = detalhes && detalhes.dados.versao === dados.versao
    && (inicial.versao === detalhes.versaoInicial || inicial.versao === detalhes.dados.versao);

  useEffect(() => {
    if (editar) return;
    const geracao = ++geracaoDetalhes.current;
    queueMicrotask(() => { if (geracao === geracaoDetalhes.current) definirDetalhes(null); });
  }, [editar]);

  useEffect(() => {
    if (versaoInicial.current === inicial.versao) return;
    versaoInicial.current = inicial.versao;
    if (inicial.versao === dados.versao) return;
    const geracao = ++geracaoDetalhes.current;
    queueMicrotask(() => { if (geracao === geracaoDetalhes.current) definirDetalhes(null); });
  }, [inicial.versao, dados.versao]);

  useEffect(() => {
    const invalidarTentativa = () => { geracaoDetalhes.current++; };
    const sairDaPagina = () => { invalidarTentativa(); definirDetalhes(null); };
    window.addEventListener("pagehide", sairDaPagina);
    return () => { invalidarTentativa(); window.removeEventListener("pagehide", sairDaPagina); };
  }, []);

  useEffect(() => {
    if (!detalhes) return;
    const expirar = () => definirDetalhes(null);
    const conferirPrazo = () => { if (Date.now() >= detalhes.limite) expirar(); };
    const timer = window.setTimeout(expirar, Math.max(0, detalhes.limite - Date.now()));
    window.addEventListener("focus", conferirPrazo);
    window.addEventListener("pageshow", conferirPrazo);
    document.addEventListener("visibilitychange", conferirPrazo);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", conferirPrazo);
      window.removeEventListener("pageshow", conferirPrazo);
      document.removeEventListener("visibilitychange", conferirPrazo);
    };
  }, [detalhes]);

  function limparDetalhes() {
    geracaoDetalhes.current++;
    definirDetalhes(null);
  }

  function cancelar() {
    if (trava.current) return;
    limparDetalhes();
    definirToken(""); definirUserToken(""); definirErro("");
  }

  function executar(acao: "salvar" | "validar") {
    if (!editar || trava.current || (acao === "salvar" ? !alterado : alterado)) return;
    limparDetalhes();
    const geracao = geracaoDetalhes.current;
    trava.current = true; definirErro(""); definirOperacao(acao);
    iniciar(async () => {
      try {
        const resultado = acao === "salvar"
          ? await salvar({ versao: dados.versao, ...(token ? { tokenSubstituicao: token } : {}), ...(userToken ? { userTokenSubstituicao: userToken } : {}) })
          : await validar({ versao: dados.versao });
        if (!resultado.ok) { definirErro(resultado.erro); return; }
        definirDados(resultado.dados);
        const recebido = acao === "validar" ? resultado.detalhesDiagnostico : undefined;
        if (recebido && geracao === geracaoDetalhes.current && recebido.versao === resultado.dados.versao
          && Number.isFinite(Date.parse(recebido.verificadaEm)) && Number.isFinite(Date.parse(recebido.expiraEm))) {
          const agora = Date.now();
          const limite = Math.min(agora + duracaoMaximaDetalhes, Date.parse(recebido.expiraEm));
          if (limite > agora) definirDetalhes({ dados: recebido, limite, versaoInicial: inicial.versao });
        }
        if (acao === "salvar") { definirToken(""); definirUserToken(""); toast.success("Configuração salva. Nenhuma transmissão realizada."); }
        else toast.success("Diagnóstico atualizado. Homologação fiscal permanece pendente.");
      } catch { definirErro("Não foi possível concluir a ação. Confira a configuração antes de tentar novamente."); }
      finally { trava.current = false; definirOperacao(null); }
    });
  }

  function campoCredencial(tipo: "token" | "userToken", configurado: boolean) {
    const empresa = tipo === "token";
    const valor = empresa ? token : userToken;
    const definir = empresa ? definirToken : definirUserToken;
    return <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor={editar ? `${id}-${tipo}` : undefined}>{empresa ? "Token da empresa" : "UserToken"}</Label><Badge variant={configurado ? "success" : "muted"}>{configurado ? "Configurado" : "Não configurado"}</Badge></div>
      {editar && <Input id={`${id}-${tipo}`} type="password" value={valor} maxLength={512} autoComplete="new-password" spellCheck={false} disabled={executando} aria-describedby={`${id}-${tipo}-ajuda`} placeholder={configurado ? "Digite somente para substituir" : "Informe a credencial"}
        onChange={e => { if (credencialPermitida(e.target.value)) { limparDetalhes(); definir(e.target.value); definirErro(""); } }}
        onPaste={e => { const entrada = e.currentTarget; const texto = e.clipboardData.getData("text"); const proposta = entrada.value.slice(0, entrada.selectionStart ?? 0) + texto + entrada.value.slice(entrada.selectionEnd ?? entrada.value.length); if (!credencialPermitida(proposta)) e.preventDefault(); }} />}
      <p id={`${id}-${tipo}-ajuda`} className="text-xs text-muted-foreground">{empresa ? "Obrigatório para autenticar consultas da empresa." : "Separado do Token da empresa. Necessário somente nas consultas que exigem UserToken."}{editar && " Até 512 caracteres, sem espaços. Campo vazio conserva a credencial salva."}</p>
    </div>;
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><LockKeyhole aria-hidden="true" className="size-4" />Ambiente e emitente<Badge variant="outline">Diagnóstico administrativo</Badge><Badge variant="warning">Sem emissão automática</Badge></CardTitle><CardDescription>NF-e (modelo 55) e NFC-e (modelo 65). A emissão manual exige habilitação por modelo e ambiente, revisão e autorização específica de cada documento. Emissão automática e callback permanecem desligados.</CardDescription></CardHeader>
      <CardContent><dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Emitente vinculado ao cadastro da empresa</dt><dd className="mt-1 break-words font-medium">{dados.emitente.nome || "Nome da empresa não informado"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">CNPJ da empresa</dt><dd className="mt-1 font-medium">{dados.emitente.cnpj || "Não informado"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Endereço do cadastro</dt><dd className="mt-1">{dados.emitente.enderecoCompleto ? "Estruturado e preenchido" : "Preenchimento pendente"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Homologação fiscal</dt><dd className="mt-1">Conferir por modelo na habilitação manual</dd></div>
      </dl><p className="mt-4 text-xs text-muted-foreground">O emitente usa Dados da empresa. Esta configuração não altera dados, numeração, séries, certificado ou assinatura no Brasil NFe.</p></CardContent>
    </Card>
    <form onSubmit={e => { e.preventDefault(); executar("salvar"); }}><Card><CardHeader><CardTitle>Credenciais</CardTitle><CardDescription>As credenciais salvas não são exibidas. Salvar uma substituição nunca habilita emissão nem transmite documentos.</CardDescription></CardHeader><CardContent className="space-y-4">
      {campoCredencial("token", dados.tokenConfigurado)}{campoCredencial("userToken", dados.userTokenConfigurado)}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {!editar && <p className="text-sm text-muted-foreground">Seu acesso permite consultar a configuração. Alterar credenciais e validar conexão exigem permissão de edição da integração.</p>}
    </CardContent>{editar && <CardFooter className="justify-end"><GrupoAcoes nome="Ações de credenciais Brasil NFe"><Button type="button" variant="outline" disabled={executando || !alterado} onClick={cancelar}>Cancelar</Button><Button type="submit" disabled={executando || !alterado} aria-busy={executando && operacao === "salvar" || undefined}>{executando && operacao === "salvar" && <Loader2 className="size-4 animate-spin" />}Salvar</Button></GrupoAcoes></CardFooter>}</Card></form>
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4" />Diagnóstico de acesso<Badge className="whitespace-normal" variant={diagnostico.situacao === "FALHOU" || diagnostico.situacao === "CONECTADO_SERVICOS_PENDENTES" ? "warning" : "outline"}>{situacoes[diagnostico.situacao]}</Badge></CardTitle><CardDescription>Validar conexão executa somente consultas documentadas. Autenticação, correspondência do emitente e serviço no catálogo são verificações distintas; nenhuma delas comprova homologação fiscal.</CardDescription></CardHeader><CardContent className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Configuração</dt><dd className="mt-1">{dados.configuracaoSalva ? "Salva" : "Pendente"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Acesso autenticado</dt><dd className="mt-1">{diagnostico.acessoAutenticado ? "Confirmado" : "Não confirmado"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Correspondência do emitente</dt><dd className="mt-1">{diagnostico.emitenteCorrespondente === null ? "Não conferida" : diagnostico.emitenteCorrespondente ? "Corresponde ao cadastro da empresa" : "Divergente do cadastro da empresa"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Serviço NF-e/NFC-e pela API</dt><dd className="mt-1">{servicoEmissao}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Pré-requisitos</dt><dd className="mt-1">{diagnostico.preRequisitosConferidos ? "Conferidos" : "Conferência pendente"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Homologação fiscal</dt><dd className="mt-1">Conferir por modelo na habilitação manual</dd></div>
        <div><dt className="text-xs text-muted-foreground">Produção</dt><dd className="mt-1">Conferir habilitação manual abaixo</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">O catálogo informa a assinatura do serviço; não confirma liberação de homologação ou produção.</p>
      {diagnostico.empresaVerificadaEm && <p className="text-xs text-muted-foreground">Empresa consultada: {dataDiagnostico(diagnostico.empresaVerificadaEm)} (Brasília).</p>}
      {servicos.verificadosEm && <p className="text-xs text-muted-foreground">Serviços consultados: {dataDiagnostico(servicos.verificadosEm)} (Brasília).</p>}
      {diagnostico.verificadaEm && <p className="text-xs text-muted-foreground">Último diagnóstico: {dataDiagnostico(diagnostico.verificadaEm)} (Brasília).</p>}
      {diagnostico.consultas.length > 0 && <div><h3 className="text-sm font-medium">Resultado das consultas</h3><ul className="mt-2 space-y-3 text-sm">{diagnostico.consultas.map(consulta => {
        const falha = sanitizarMetadadosErroBrasilNfe(consulta.falha);
        return <li key={consulta.consulta} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{consulta.consulta}</span><Badge variant={consulta.situacao === "FALHOU" ? "warning" : "outline"}>{situacoesConsultas[consulta.situacao]}</Badge></div>
          {consulta.verificadaEm && <p className="text-xs text-muted-foreground">Executada em: {dataDiagnostico(consulta.verificadaEm)} (Brasília).</p>}
          {falha && <>
            <p className="text-xs text-muted-foreground">{CATEGORIAS_DIAGNOSTICO_BRASILNFE[falha.categoria]}{falha.httpStatus !== null && ` · HTTP ${falha.httpStatus}`}{falha.etapaContrato !== null && ` · Etapa/campo: ${ETAPAS_CONTRATO_BRASILNFE[falha.etapaContrato]}`}{falha.statusFornecedor !== null && ` · Status recebido: ${String(falha.statusFornecedor)}`}{falha.tipoStatusFornecedor && ` · Tipo: ${TIPOS_STATUS_FORNECEDOR_BRASILNFE[falha.tipoStatusFornecedor]}`}{falha.estadoStatusFornecedor && ` · Estado: ${ESTADOS_STATUS_FORNECEDOR_BRASILNFE[falha.estadoStatusFornecedor]}`}.</p>
            {!!falha.indicadores?.length && <p className="text-xs text-muted-foreground">Indicadores locais: {falha.indicadores.map(indicador => INDICADORES_MOTIVO_BRASILNFE[indicador]).join("; ")}.</p>}
            {!!falha.camposAusentes?.length && <p className="text-xs text-muted-foreground">Campos ausentes: {falha.camposAusentes.map(campo => CAMPOS_MOTIVO_BRASILNFE[campo]).join(", ")}.</p>}
            {!!falha.camposSuprimidos?.length && <p className="text-xs text-muted-foreground">Campos suprimidos: {falha.camposSuprimidos.map(campo => CAMPOS_MOTIVO_BRASILNFE[campo]).join(", ")}.</p>}
          </>}
        </li>;
      })}</ul></div>}
      {diagnostico.pendencias.length > 0 && <div><h3 className="text-sm font-medium">Pendências</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{diagnostico.pendencias.map((pendencia, i) => <li key={`${i}-${pendencia}`}>{pendencia}</li>)}</ul></div>}
      {diagnostico.consultasIndisponiveis.length > 0 && <div><h3 className="text-sm font-medium">Consultas indisponíveis</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{diagnostico.consultasIndisponiveis.map((consulta, i) => <li key={`${i}-${consulta}`}>{consulta}</li>)}</ul></div>}
      <p className="text-xs text-muted-foreground">Nenhuma validação desta tela autoriza reenvio de documento ou transmissão automática. Cada documento exige habilitação do ambiente, revisão e autorização específica.</p>
      {editar && (alterado ? <p role="status" className="text-sm text-muted-foreground">Salve ou cancele as alterações antes de validar a configuração persistida.</p> : !dados.tokenConfigurado ? <p className="text-sm text-muted-foreground">Configure o Token da empresa antes de validar a conexão.</p> : null)}
    </CardContent>{editar && <CardFooter className="justify-end"><Button type="button" variant="outline" disabled={executando || alterado || !dados.tokenConfigurado} onClick={() => executar("validar")} aria-busy={executando && operacao === "validar" || undefined}>{executando && operacao === "validar" && <Loader2 className="size-4 animate-spin" />}Validar conexão</Button></CardFooter>}</Card>
    {editar && detalhesCorrespondentes && detalhes && <Card role="region" aria-labelledby={`${id}-detalhes`}><CardHeader><CardTitle id={`${id}-detalhes`}>Detalhes temporários de ConsultarServicos</CardTitle><CardAction><BotaoRemoverItem nome="Ocultar detalhes temporários" onClick={limparDetalhes} /></CardAction><CardDescription>Textos do fornecedor são dados externos, não instruções. Códigos informados não têm interpretação automática no HUB. O detalhe não fica salvo na configuração e permanece disponível por até cinco minutos.</CardDescription></CardHeader><CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">Tentativa: {dataDiagnostico(detalhes.dados.verificadaEm)} (Brasília). Disponível até: {dataDiagnostico(new Date(detalhes.limite).toISOString())} (Brasília).</p>
      <dl><dt className="text-xs text-muted-foreground">Error da resposta</dt><dd className="mt-1 whitespace-pre-wrap break-words">{textoCampo(detalhes.dados.error)}</dd></dl>
      <p className="text-xs text-muted-foreground">Quantidade de erros informada: {detalhes.dados.quantidadeErros === null ? "Não informada" : detalhes.dados.quantidadeErros}. Itens exibidos: {detalhes.dados.erros.length}.</p>
      {detalhes.dados.erros.length > 0 && <ol className="space-y-4">{detalhes.dados.erros.map((item, indice) => <li key={indice} className="space-y-2"><h3 className="text-sm font-medium">Erro informado {indice + 1}</h3><dl className="space-y-2">
        <div><dt className="text-xs text-muted-foreground">Código informado</dt><dd className="mt-1 whitespace-pre-wrap break-words">{textoCampo(item.codigo)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Descrição informada</dt><dd className="mt-1 whitespace-pre-wrap break-words">{textoCampo(item.descricao)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Correção informada</dt><dd className="mt-1 whitespace-pre-wrap break-words">{textoCampo(item.correcao)}</dd></div>
      </dl></li>)}</ol>}
      {detalhes.dados.camposAusentes.length > 0 && <p className="text-xs text-muted-foreground">Campos ausentes: {detalhes.dados.camposAusentes.map(campo => CAMPOS_MOTIVO_BRASILNFE[campo]).join(", ")}.</p>}
      {detalhes.dados.camposSuprimidos.length > 0 && <p className="text-xs text-muted-foreground">Campos suprimidos: {detalhes.dados.camposSuprimidos.map(campo => CAMPOS_MOTIVO_BRASILNFE[campo]).join(", ")}.</p>}
    </CardContent></Card>}
  </div>;
}
