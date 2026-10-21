"use client";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campo } from "../componentes";
import type { ClienteEntrada } from "@/lib/vendas/dominio";
import { editarTelefone, formatarTelefone, TAMANHO_CAMPO_TELEFONE } from "@/lib/vendas/telefone";
import { alterarTipoClientePreservandoNomes } from "@/lib/vendas/clientes-identidade";
import type { AvisoIdentidadeCliente } from "@/lib/vendas/cliente-identidade-consulta";

export const novoClientePedido = (): ClienteEntrada => ({ id: "", versao: 0, nome: "", primeiroNome: "", sobrenome: "", razaoSocial: "", inscricaoEstadual: "", dataNascimento: "", tipo: "PF", tipoEscolhido: false, documento: null, email: null, telefone: null, contato: null, observacoes: null, enderecos: [], ativo: true });

/** DDI, DDD e número no mesmo campo; o valor guardado é +55 seguido apenas dos dígitos. */
export function CampoTelefone({ nome, valor, alterar, obrigatorio = false, somenteLeitura = false }: { nome: string; valor: string | null | undefined; alterar: (valor: string) => void; obrigatorio?: boolean; somenteLeitura?: boolean }) {
  return <Campo nome={obrigatorio ? `${nome} *` : nome}><Input type="tel" inputMode="tel" autoComplete="tel" readOnly={somenteLeitura} required={obrigatorio && !somenteLeitura} pattern="\+55 \([0-9]{2}\) [0-9]{4,5}-[0-9]{4}" title="DDI +55, DDD e telefone com oito ou nove dígitos" maxLength={TAMANHO_CAMPO_TELEFONE} placeholder="+55 (11) 99999-9999" value={formatarTelefone(valor)} onChange={e => alterar(editarTelefone(valor, e.target.value))} /></Campo>;
}

type PropriedadesCliente = { valor: ClienteEntrada; alterar: (valor: ClienteEntrada) => void; somenteLeitura?: boolean };

export function TipoClientePedido({ valor: d, alterar, somenteLeitura = false }: PropriedadesCliente) {
  const escolhido = d.tipoEscolhido !== false;
  return <Campo nome="Tipo *"><Select disabled={somenteLeitura} value={escolhido ? d.tipo : null} onValueChange={v => {
    if (v !== "PF" && v !== "PJ") return;
    alterar(alterarTipoClientePreservandoNomes(d, v));
  }}><SelectTrigger aria-label="Tipo de cliente" className="w-full"><SelectValue placeholder="Selecione o tipo">{() => escolhido ? d.tipo === "PF" ? "Pessoa Física" : "Pessoa Jurídica" : "Selecione o tipo"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent></Select></Campo>;
}

export function AvisoCampoIdentidade({ aviso, id }: { aviso?: AvisoIdentidadeCliente; id: string }) {
  return aviso?.mensagem ? <span id={id} role={aviso.invalido ? "alert" : "status"} className={aviso.invalido ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{aviso.mensagem}</span> : null;
}

export function CamposClientePedido({ valor: d, alterar, somenteLeitura = false, mostrarTipo = true, emailSomenteLeitura = false, avisoEmail }: PropriedadesCliente & { mostrarTipo?: boolean; emailSomenteLeitura?: boolean; avisoEmail?: AvisoIdentidadeCliente }) {
  const avisoEmailId = useId();
  const bloqueado = d.tipoEscolhido === false;
  const emailObrigatorio = !d.id && !somenteLeitura && !emailSomenteLeitura;
  const campo = <K extends keyof ClienteEntrada>(chave: K, valor: ClienteEntrada[K]) => alterar({ ...d, [chave]: valor });
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2"><Campo nome={emailObrigatorio ? "E-mail *" : "E-mail"}><Input aria-label="E-mail" aria-invalid={avisoEmail?.invalido || undefined} aria-describedby={avisoEmail?.mensagem ? avisoEmailId : undefined} ref={campo => campo?.setCustomValidity(avisoEmail?.invalido ? avisoEmail.mensagem : "")} readOnly={somenteLeitura || emailSomenteLeitura} required={emailObrigatorio} autoComplete="email" title={emailSomenteLeitura ? "E-mail vinculado à identificação do cliente; não pode ser alterado no pedido." : undefined} type="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]+" value={d.email ?? ""} maxLength={254} onBlur={avisoEmail?.verificarAgora} onChange={e => { if (!emailSomenteLeitura) campo("email", e.target.value); }} /><AvisoCampoIdentidade aviso={avisoEmail} id={avisoEmailId} /></Campo></div>
    {mostrarTipo && <div className="sm:max-w-xs"><TipoClientePedido valor={d} alterar={alterar} somenteLeitura={somenteLeitura} /></div>}
    {bloqueado && <p className="text-sm text-muted-foreground">Escolha o tipo para preencher os dados cadastrais.</p>}
    <fieldset disabled={bloqueado} className="grid min-w-0 items-start gap-3 sm:grid-cols-2 lg:grid-cols-12">
    <div className={d.tipo === "PF" ? "sm:col-span-2 lg:col-span-12" : "lg:col-span-8"}><Campo nome={d.tipo === "PF" ? "Nome Completo *" : "Nome Fantasia *"}><Input data-cliente-nome required={!somenteLeitura} readOnly={somenteLeitura} value={d.nome} maxLength={160} onChange={e => alterar({ ...d, nome: e.target.value, ...(d.tipo === "PF" ? { primeiroNome: e.target.value.trim().split(/\s+/)[0] ?? "", sobrenome: e.target.value.trim().split(/\s+/).slice(1).join(" ") } : {}) })} /></Campo></div>
    {d.tipo === "PJ" && <div className="lg:col-span-4"><Campo nome="Nome Completo do contato"><Input readOnly={somenteLeitura} value={d.contato ?? ""} maxLength={160} onChange={e => alterar({ ...d, contato: e.target.value, nomeContato: e.target.value.trim().split(/\s+/)[0] ?? "", sobrenomeContato: e.target.value.trim().split(/\s+/).slice(1).join(" ") })} /></Campo></div>}
    <div className="lg:col-span-6"><CampoTelefone nome="Telefone" obrigatorio somenteLeitura={somenteLeitura} valor={d.telefone} alterar={valor => campo("telefone", valor || null)} /></div>
    <div className="lg:col-span-6"><Campo nome="Data de nasc."><Input readOnly={somenteLeitura} title="Data de nascimento" type="date" value={d.dataNascimento ?? ""} onChange={e => campo("dataNascimento", e.target.value)} /></Campo></div>
    </fieldset>
  </div>;
}
