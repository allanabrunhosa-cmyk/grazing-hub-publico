"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelecaoFormulario } from "@/components/ui/select";
import type { IdentidadeCobranca } from "@/lib/vendas/dominio";
import type { consultarCnpjVenda } from "@/lib/vendas/cnpj";
import { Campo } from "../componentes";
import type { EnderecoPedidoForm } from "./endereco-pedido-form";
import { useMascaraDigitos } from "@/components/use-mascara-digitos";
import { AvisoCampoIdentidade, CampoTelefone } from "./novo-cliente-pedido";
import type { AvisoIdentidadeCliente } from "@/lib/vendas/cliente-identidade-consulta";

export type CobrancaForm = EnderecoPedidoForm & Partial<IdentidadeCobranca>;
export function IdentidadeCobrancaForm({ valor, alterar, consultarCnpj, aoConsultar, somenteLeitura = false, obrigatorio = false, informacoesGerais = false, avisoDocumento }: {
  valor: CobrancaForm; alterar: (valor: CobrancaForm) => void; consultarCnpj: typeof consultarCnpjVenda;
  aoConsultar: (ocupado: boolean) => void; somenteLeitura?: boolean; obrigatorio?: boolean; informacoesGerais?: boolean; avisoDocumento?: AvisoIdentidadeCliente;
}) {
  const avisoDocumentoId = useId();
  const atual = useRef(valor);
  const mudar = useRef(alterar);
  const consulta = useRef(0), ultimo = useRef("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState(false);
  const ocupadoAtual = useRef(false), aoConsultarAtual = useRef(aoConsultar);
  useLayoutEffect(() => { atual.current = valor; mudar.current = alterar; aoConsultarAtual.current = aoConsultar; }, [valor, alterar, aoConsultar]);
  useEffect(() => () => { consulta.current++; if (ocupadoAtual.current) aoConsultarAtual.current(false); }, []);
  function emitir(novo: CobrancaForm) {
    const pronto = { ...novo };
    if (pronto.titularPendente && (pronto.tipo === "PF" || /^\d{14}$/.test(pronto.documento ?? "") && pronto.razaoSocial?.trim())) pronto.titularPendente = false;
    atual.current = pronto; mudar.current(pronto);
  }
  async function buscar(documento: string) {
    if (somenteLeitura || documento.length !== 14) return;
    const id = ++consulta.current, antes = atual.current;
    ultimo.current = documento; setFalha(false); ocupadoAtual.current = true; setOcupado(true); aoConsultar(true); setAviso("Consultando CNPJ…");
    try {
      const resposta = await consultarCnpj(documento);
      if (id !== consulta.current) return;
      if (atual.current.documento !== documento || atual.current.tipo !== "PJ") { ultimo.current = ""; setFalha(false); setAviso(""); return; }
      if (!resposta.cadastro) { ultimo.current = ""; setFalha(true); setAviso(resposta.erro ?? "Consulta indisponível. Tente novamente."); return; }
      const recebidos = { ...resposta.cadastro.endereco, razaoSocial: resposta.cadastro.razaoSocial, codigoMunicipio: resposta.cadastro.endereco.codigoMunicipio };
      const preservados = Object.fromEntries(Object.entries(recebidos).filter(([chave]) => atual.current[chave as keyof CobrancaForm] === antes[chave as keyof CobrancaForm]));
      emitir({ ...atual.current, ...preservados });
      setAviso(resposta.aviso ?? "Dados preenchidos pelo CNPJ. Confira o endereço e informe as inscrições, quando aplicáveis.");
    } catch { if (id === consulta.current) { const mesmoTitular = atual.current.documento === documento && atual.current.tipo === "PJ"; ultimo.current = ""; setFalha(mesmoTitular); setAviso(mesmoTitular ? "Consulta do CNPJ indisponível. Tente novamente." : ""); } }
    finally { if (id === consulta.current) { ocupadoAtual.current = false; setOcupado(false); aoConsultar(false); } }
  }
  function campo<K extends keyof CobrancaForm>(chave: K, conteudo: CobrancaForm[K]) { emitir({ ...atual.current, [chave]: conteudo }); }
  const pj = valor.tipo === "PJ";
  function informarDocumento(documento: string) {
    if (somenteLeitura || ocupado) return;
    if (documento !== atual.current.documento) { ultimo.current = ""; setFalha(false); setAviso(""); }
    emitir({ ...atual.current, tipo: pj ? "PJ" : "PF", documento });
    if (pj && documento.length === 14 && documento !== ultimo.current) void buscar(documento);
  }
  const documento = useMascaraDigitos(valor.documento ?? "", pj ? "CNPJ" : "CPF", informarDocumento);
  const inscricao = (conteudo: string) => conteudo.toUpperCase().replace(/[^0-9ISENTO.\-/ ]/g, "").slice(0, 40);
  return <div className="space-y-3">
    {valor.titularPendente && <p role="status" className="text-xs text-muted-foreground">Titular pendente. Confirme o CNPJ antes de faturar.</p>}
    <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {!informacoesGerais && <Campo nome="Tipo da cobrança *"><SelecaoFormulario aria-label="Tipo da cobrança" value={valor.tipo ?? "PF"} disabled={somenteLeitura || ocupado} onValueChange={tipo => {
        if (tipo !== "PF" && tipo !== "PJ") return;
        ultimo.current = ""; setAviso(""); emitir({ ...atual.current, tipo, documento: "", nomeCompleto: "", razaoSocial: "", inscricaoEstadual: "", inscricaoMunicipal: "" });
      }}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></SelecaoFormulario></Campo>}
      <Campo nome={pj ? (obrigatorio ? "CNPJ *" : "CNPJ") : "CPF"}><Input aria-label={pj ? (obrigatorio ? "CNPJ *" : "CNPJ") : "CPF"} aria-invalid={avisoDocumento?.invalido || undefined} aria-describedby={avisoDocumento?.mensagem ? avisoDocumentoId : undefined} ref={campo => campo?.setCustomValidity(avisoDocumento?.invalido ? avisoDocumento.mensagem : "")} inputMode="numeric" readOnly={somenteLeitura || ocupado} required={obrigatorio && pj} {...documento} onBlur={() => { avisoDocumento?.verificarAgora(); if (pj && valor.documento?.length === 14 && valor.documento !== ultimo.current) void buscar(valor.documento); }} /><AvisoCampoIdentidade aviso={avisoDocumento} id={avisoDocumentoId} /></Campo>
      {(!informacoesGerais || pj) && <div className="sm:col-span-2"><Campo nome={`${pj ? "Razão social" : "Nome Completo"}${obrigatorio ? " *" : ""}`}><Input readOnly={somenteLeitura} required={obrigatorio} maxLength={160} value={pj ? valor.razaoSocial ?? "" : valor.nomeCompleto ?? ""} onChange={e => emitir({ ...atual.current, tipo: pj ? "PJ" : "PF", [pj ? "razaoSocial" : "nomeCompleto"]: e.target.value })} /></Campo></div>}
      {pj && <><Campo nome="Inscrição Estadual"><Input readOnly={somenteLeitura} maxLength={40} value={valor.inscricaoEstadual ?? ""} onChange={e => campo("inscricaoEstadual", inscricao(e.target.value))} /></Campo><Campo nome="Inscrição Municipal"><Input readOnly={somenteLeitura} maxLength={40} value={valor.inscricaoMunicipal ?? ""} onChange={e => campo("inscricaoMunicipal", inscricao(e.target.value))} /></Campo></>}
      {!informacoesGerais && <div className="sm:col-span-2"><CampoTelefone nome="Telefone da cobrança" valor={valor.telefone} alterar={telefone => campo("telefone", telefone)} somenteLeitura={somenteLeitura} /></div>}
    </div>
    {aviso && <div className="flex flex-wrap items-center gap-2"><p role="status" className="text-xs text-muted-foreground">{aviso}</p>{!ocupado && pj && falha && <Button type="button" variant="ghost" size="sm" disabled={somenteLeitura} onClick={() => void buscar(valor.documento ?? "")}>Consultar CNPJ novamente</Button>}</div>}
  </div>;
}
