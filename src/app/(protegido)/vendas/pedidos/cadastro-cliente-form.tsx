"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { identidadePrincipalCliente, nomeAbaCobranca, LIMITE_COBRANCAS_CLIENTE } from "@/lib/vendas/cliente-cobranca";
import { buscarCnpjPedidoAction } from "./cadastro-cliente-actions";
import { consultarIdentidadeClientePedido } from "@/lib/vendas/cliente-identidade-http";
import { IdentidadeCobrancaForm } from "./identidade-cobranca-form";
import { validarIdentidadeCobranca } from "@/lib/vendas/dominio";
import { indiceEnderecoPostalDuplicado, pendenciaEnderecoPostal } from "@/lib/vendas/cliente-enderecos";
import { projetarOpcoesPostaisUnicas } from "@/lib/vendas/cliente-enderecos-opcoes";
import { Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Campo } from "../componentes";
import { CampoTelefone, CamposClientePedido, TipoClientePedido } from "./novo-cliente-pedido";
import { CamposEnderecoPedido, enderecoPedidoVazio, type EnderecoPedidoForm } from "./endereco-pedido-form";
import { ConfirmarRemocaoEndereco, DialogAdicionarEndereco, enderecoTemConteudo, rotuloEnderecoPostal, SeletorEnderecoCliente } from "./endereco-cliente-ui";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useIdentidadeCliente } from "./use-identidade-cliente";
import type { ConsultarIdentidadeCliente } from "@/lib/vendas/cliente-identidade-consulta";

export function CadastroClientePedido({ busca, aviso, rodape, consultarCnpj = buscarCnpjPedidoAction, consultarIdentidade = consultarIdentidadeClientePedido, onConsultandoCnpjChange, ...props }: ComponentProps<typeof CamposClientePedido> & { busca?: ReactNode; aviso?: ReactNode; rodape?: ReactNode; consultarCnpj?: typeof buscarCnpjPedidoAction; consultarIdentidade?: ConsultarIdentidadeCliente; onConsultandoCnpjChange?: (ocupado: boolean) => void }) {
  const principal = { ...enderecoPedidoVazio(), ...props.valor.enderecos[0], ...identidadePrincipalCliente(props.valor) };
  const identidade = useIdentidadeCliente({ ...props.valor, documento: principal.documento }, consultarIdentidade, props);
  return <section className="space-y-3"><h2 className="text-title">Informações gerais</h2><div className="space-y-3 rounded-2xl border bg-card p-4">
    {aviso}
    <div className="grid items-end gap-3 sm:grid-cols-2">{busca}<TipoClientePedido valor={props.valor} alterar={props.alterar} somenteLeitura={props.somenteLeitura} /></div>
    <CamposClientePedido {...props} mostrarTipo={false} avisoEmail={identidade.email} />
    <fieldset disabled={props.valor.tipoEscolhido === false} className="min-w-0"><IdentidadeCobrancaForm informacoesGerais obrigatorio={!props.somenteLeitura} valor={principal} somenteLeitura={props.somenteLeitura} avisoDocumento={identidade.documento} consultarCnpj={consultarCnpj} aoConsultar={ocupado => onConsultandoCnpjChange?.(ocupado)} alterar={valor => props.alterar({ ...props.valor, documento: valor.documento ?? "", razaoSocial: valor.razaoSocial, inscricaoEstadual: valor.inscricaoEstadual, enderecos: props.valor.enderecos.length ? props.valor.enderecos.map((e, n) => n === 0 ? { ...e, ...valor } : e) : [{ ...valor, nome: "Principal", destinatario: "" }] })} /></fieldset>
    {rodape}
  </div></section>;
}

function NovaCobrancaClienteDialog({ enderecos, consultarCnpj, consultarCep, confirmar, fechar }: { enderecos: EnderecoPedidoForm[]; consultarCnpj: typeof buscarCnpjPedidoAction; consultarCep?: ComponentProps<typeof CamposEnderecoPedido>["consultarCep"]; confirmar: (endereco: EnderecoPedidoForm) => void; fechar: () => void }) {
  const [valor, setValor] = useState<EnderecoPedidoForm>(() => ({ ...enderecoPedidoVazio(), tipo: "PF", nomeCompleto: "", documento: "" }));
  const [consultaCep, setConsultaCep] = useState(false), [consultaCnpj, setConsultaCnpj] = useState(false);
  function validar() {
    try { validarIdentidadeCobranca(valor, true); } catch (erro) { return erro instanceof Error ? erro.message : "Confira o titular da cobrança."; }
    const pendencia = pendenciaEnderecoPostal(valor);
    if (pendencia) return pendencia;
    const duplicado = indiceEnderecoPostalDuplicado(enderecos, valor);
    return duplicado === null ? null : `Este endereço já está cadastrado em ${nomeAbaCobranca(duplicado)}. Selecione o endereço existente.`;
  }
  return <DialogAdicionarEndereco titulo="Adicionar endereço de cobrança" ocupado={consultaCep || consultaCnpj} validar={validar} confirmar={() => confirmar(valor)} fechar={fechar}>
    <IdentidadeCobrancaForm obrigatorio valor={valor} alterar={setValor} consultarCnpj={consultarCnpj} aoConsultar={setConsultaCnpj} />
    <CamposEnderecoPedido obrigatorio valor={valor} alterar={setValor} consultarCep={consultarCep} onConsultandoCepChange={setConsultaCep} />
  </DialogAdicionarEndereco>;
}

/** A seleção não grava. Novos endereços entram somente depois de completos. */
export function CobrancaClientePedido({ enderecos, selecionado, alterar, consultarCnpj = buscarCnpjPedidoAction, ...props }: Omit<ComponentProps<typeof CamposEnderecoPedido>, "valor" | "alterar"> & {
  consultarCnpj?: typeof buscarCnpjPedidoAction; enderecos: EnderecoPedidoForm[]; selecionado: number; alterar: (enderecos: EnderecoPedidoForm[], selecionado: number) => void;
}) {
  const consultas = useRef({ cep: false, cnpj: false });
  const atual = useRef(enderecos);
  const mudar = useRef(alterar);
  useLayoutEffect(() => { atual.current = enderecos; mudar.current = alterar; }, [enderecos, alterar]);
  function consultar(tipo: "cep" | "cnpj", valor: boolean) { consultas.current[tipo] = valor; const ocupado = consultas.current.cep || consultas.current.cnpj; setOcupado(ocupado); props.onConsultandoCepChange?.(ocupado); }
  const [ocupado, setOcupado] = useState(false);
  const [adicionando, setAdicionando] = useState(false), [removendo, setRemovendo] = useState<number | null>(null);
  const lista = enderecos.length ? enderecos : [enderecoPedidoVazio()];
  const indice = Math.min(selecionado, lista.length - 1);
  const endereco = lista[indice];
  const opcoes = projetarOpcoesPostaisUnicas(lista, indice).opcoes.map(({ endereco: e, indiceOriginal: n }) => ({ indice: n, rotulo: [nomeAbaCobranca(n), e.tipo === "PJ" ? e.razaoSocial : e.nomeCompleto, e.documento, rotuloEnderecoPostal(e)].filter(Boolean).join(" · ") }));
  function remover(n: number) { alterar(atual.current.filter((_, indice) => indice !== n), Math.min(n, atual.current.length - 2)); setRemovendo(null); }
  return <section className="space-y-3"><h2 className="text-title">Cobrança</h2><div className="space-y-3 rounded-2xl border bg-card p-4">
    <div className="flex min-w-0 items-end gap-2"><div className="min-w-0 flex-1"><Campo nome="Endereço de cobrança"><SeletorEnderecoCliente nome="Endereço de cobrança" opcoes={opcoes} selecionado={indice} alterar={n => alterar(lista, n)} disabled={ocupado} /></Campo></div><GrupoAcoes nome="Endereços de cobrança">
      <Button type="button" size="icon" variant="outline" aria-label="Adicionar endereço de cobrança" title="Adicionar endereço de cobrança" disabled={props.somenteLeitura || ocupado || lista.length >= LIMITE_COBRANCAS_CLIENTE} onClick={() => setAdicionando(true)}><Plus aria-hidden="true" /></Button>
      {!props.somenteLeitura && indice > 0 && <BotaoRemoverItem discreto nome={`Remover cobrança ${indice + 1}`} disabled={ocupado} onClick={() => enderecoTemConteudo(endereco) ? setRemovendo(indice) : remover(indice)} />}
    </GrupoAcoes></div>
    <div role="group" aria-label={nomeAbaCobranca(indice)} className="space-y-3" data-cobranca-indice={indice} key={indice}>
      {indice === 0 && <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon-sm" disabled aria-pressed="true" aria-label="Titular da Principal fixado às Informações gerais" title="Titular da Principal fixado às Informações gerais"><Pin aria-hidden="true" className="size-4" /></Button><p className="text-xs text-muted-foreground">Titular vinculado às Informações gerais.</p></div>}
      <IdentidadeCobrancaForm valor={endereco} somenteLeitura={props.somenteLeitura || indice === 0} obrigatorio={props.obrigatorio} consultarCnpj={consultarCnpj} aoConsultar={ocupado => consultar("cnpj", ocupado)} alterar={valor => mudar.current(atual.current.map((e, i) => i === indice ? { ...e, ...valor } : e), indice)} />
      <CamposEnderecoPedido {...props} valor={endereco} alterar={valor => mudar.current(atual.current.map((e, i) => i === indice ? { ...e, ...valor } : e), indice)} onConsultandoCepChange={ocupado => consultar("cep", ocupado)} />
    </div>
    {adicionando && <NovaCobrancaClienteDialog enderecos={lista} consultarCep={props.consultarCep} consultarCnpj={consultarCnpj} confirmar={novo => { alterar([...atual.current, novo], atual.current.length); setAdicionando(false); }} fechar={() => setAdicionando(false)} />}
    {removendo !== null && <ConfirmarRemocaoEndereco nome={nomeAbaCobranca(removendo)} descricao="Este endereço de cobrança deixará de aparecer no cadastro." confirmar={() => remover(removendo)} fechar={() => setRemovendo(null)} />}
  </div></section>;
}

export type DestinatarioClienteForm = { nome: string; primeiroNome?: string; sobrenome?: string; contato: string };
export function CamposDestinatarioCliente({ valor, alterar, antesNome, depoisSobrenome, antesTelefone, somenteLeitura = false, obrigatorio = false }: {
  valor: DestinatarioClienteForm | null; alterar: (valor: DestinatarioClienteForm) => void; antesNome?: ReactNode; depoisSobrenome?: ReactNode; antesTelefone?: ReactNode; somenteLeitura?: boolean; obrigatorio?: boolean;
}) {
  const nome = valor?.nome ?? [valor?.primeiroNome, valor?.sobrenome].filter(Boolean).join(" ");
  return <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {antesNome}
    <div className="lg:col-span-2"><Campo nome={obrigatorio ? "Nome Completo *" : "Nome Completo"}><Input data-destinatario-nome readOnly={somenteLeitura} required={obrigatorio} value={nome} maxLength={160} onChange={e => alterar({ nome: e.target.value, primeiroNome: e.target.value.trim().split(/\s+/)[0] ?? "", sobrenome: e.target.value.trim().split(/\s+/).slice(1).join(" "), contato: valor?.contato ?? "" })} /></Campo></div>
    {depoisSobrenome}{antesTelefone}
    <CampoTelefone nome="Telefone" somenteLeitura={somenteLeitura} valor={valor?.contato} alterar={contato => alterar({ ...valor, nome, contato })} />
  </div>;
}
