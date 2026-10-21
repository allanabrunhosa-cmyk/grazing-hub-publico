"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Button } from "@/components/ui/button";
import type { ClienteEntrada, EnderecoVenda, EntregaCliente } from "@/lib/vendas/dominio";
import { cobrancasDoCliente, copiarCobrancaParaEntrega, nomeAbaCobranca } from "@/lib/vendas/cliente-cobranca";
import { adicionarEntregaCliente, atualizarEntregaCliente, entregasDoCliente, indiceEntregaCliente, LIMITE_ENTREGAS_CLIENTE, removerEntregaCliente, selecionarEntregaCliente } from "@/lib/vendas/cliente-entrega";
import { indiceEnderecoCobrancaInicial } from "@/lib/vendas/cliente-pedido";
import { novoClientePedido } from "../pedidos/novo-cliente-pedido";
import { CadastroClientePedido, CobrancaClientePedido, CamposDestinatarioCliente } from "../pedidos/cadastro-cliente-form";
import { CamposEnderecoPedido, enderecoPedidoVazio } from "../pedidos/endereco-pedido-form";
import { ConfirmarRemocaoEndereco, enderecoTemConteudo, rotuloEnderecoPostal, SeletorEnderecoCliente } from "../pedidos/endereco-cliente-ui";
import { NovaEntregaClienteDialog } from "../pedidos/nova-entrega-cliente-dialog";
import { buscarCepClienteAction, buscarCnpjClienteAction } from "./cadastro-actions";
import { consultarIdentidadeClienteCadastro } from "@/lib/vendas/cliente-identidade-http";

export const novoClienteVenda = (): ClienteEntrada => ({ ...novoClientePedido(), enderecos: [{ ...enderecoPedidoVazio(), nome: "Cobrança", destinatario: "" }], entregaPadrao: null });

export function CamposClienteVenda({ cliente, onChange, onConsultandoCepChange, somenteLeitura = false }: {
  cliente: ClienteEntrada; onChange: (cliente: ClienteEntrada) => void; onConsultandoCepChange?: (consultando: boolean) => void; somenteLeitura?: boolean;
}) {
  const [selecionado, setSelecionado] = useState(() => indiceEnderecoCobrancaInicial(cliente.enderecos));
  const consultas = useRef({ geral: false, cobranca: false, entrega: false });
  const [consultandoGeral, setConsultandoGeral] = useState(false);
  const [consultandoCobranca, setConsultandoCobranca] = useState(false);
  const [consultandoEntrega, setConsultandoEntrega] = useState(false);
  const [entregaLeitura, setEntregaLeitura] = useState(() => indiceEntregaCliente(cliente.entregaPadrao));
  const [novaEntrega, setNovaEntrega] = useState<EntregaCliente | null>(null);
  const [removendoEntrega, setRemovendoEntrega] = useState(false), [erroEntrega, setErroEntrega] = useState("");
  const partes = cliente.nome.trim().split(/\s+/);
  const exibido = { ...cliente, primeiroNome: cliente.primeiroNome ?? (cliente.tipo === "PF" ? partes[0] ?? "" : null), sobrenome: cliente.sobrenome ?? (cliente.tipo === "PF" ? partes.slice(1).join(" ") : null) };
  const enderecos = cobrancasDoCliente({ ...cliente, enderecos: cliente.enderecos.length ? cliente.enderecos : novoClienteVenda().enderecos });
  const entregaVazia = (): EntregaCliente => ({ destinatario: { nome: "", contato: "" }, endereco: enderecoPedidoVazio() });
  const entregasCadastradas = entregasDoCliente(cliente.entregaPadrao);
  const entregas = entregasCadastradas.length ? entregasCadastradas : [entregaVazia()];
  const indiceEntrega = somenteLeitura ? Math.min(entregaLeitura, entregas.length - 1) : indiceEntregaCliente(cliente.entregaPadrao);
  const entrega = entregas[indiceEntrega];
  const opcoesEntrega = entregasCadastradas.map((item, indice) => ({ indice, rotulo: [`Entrega ${indice + 1}`, item.destinatario.nome, rotuloEnderecoPostal(item.endereco)].filter(Boolean).join(" · "), busca: item.textoOriginal }));
  function rascunhoEntrega(valor: EntregaCliente) {
    const enderecos = entregasCadastradas.map((anterior, n) => n === indiceEntrega ? valor : anterior);
    onChange({ ...cliente, entregaPadrao: { ...valor, enderecos, selecionado: indiceEntrega } });
  }
  function removerEntrega() { onChange({ ...cliente, entregaPadrao: removerEntregaCliente(cliente.entregaPadrao, indiceEntrega) }); setRemovendoEntrega(false); setErroEntrega(""); }
  function copiarCobranca() {
    const copia = copiarCobrancaParaEntrega(enderecos[selecionado], cliente, selecionado === 0);
    if (!entregasCadastradas.length) { setNovaEntrega(copia); return; }
    try { onChange({ ...cliente, entregaPadrao: atualizarEntregaCliente(cliente.entregaPadrao, { ...entrega, ...copia }, indiceEntrega) }); setErroEntrega(""); }
    catch (erro) { setErroEntrega(erro instanceof Error ? erro.message : "Confira o endereço de entrega."); }
  }
  function consultar(tipo: "geral" | "cobranca" | "entrega", ocupado: boolean) {
    if (tipo === "geral") setConsultandoGeral(ocupado); else if (tipo === "cobranca") setConsultandoCobranca(ocupado); else setConsultandoEntrega(ocupado);
    consultas.current[tipo] = ocupado;
    onConsultandoCepChange?.(consultas.current.geral || consultas.current.cobranca || consultas.current.entrega);
  }
  return <div className="space-y-5">
    <CadastroClientePedido consultarCnpj={buscarCnpjClienteAction} consultarIdentidade={consultarIdentidadeClienteCadastro} onConsultandoCnpjChange={ocupado => consultar("geral", ocupado)} valor={exibido} alterar={valor => onChange(valor.tipo === cliente.tipo && valor.nome === cliente.nome && valor.primeiroNome === exibido.primeiroNome && valor.sobrenome === exibido.sobrenome ? { ...valor, primeiroNome: cliente.primeiroNome, sobrenome: cliente.sobrenome } : valor)} somenteLeitura={somenteLeitura} />
    <fieldset disabled={cliente.tipoEscolhido === false || consultandoGeral} className="min-w-0 space-y-5">
      <CobrancaClientePedido enderecos={enderecos} selecionado={selecionado} obrigatorio={!somenteLeitura} somenteLeitura={somenteLeitura} consultarCep={buscarCepClienteAction} consultarCnpj={buscarCnpjClienteAction} onConsultandoCepChange={ocupado => consultar("cobranca", ocupado)} alterar={(lista, indice) => {
        setSelecionado(indice);
        if (lista !== enderecos) onChange({ ...cliente, enderecos: lista.map((endereco, n) => ({ ...endereco, nome: nomeAbaCobranca(n), destinatario: (endereco as EnderecoVenda).destinatario || "" })) });
      }} />
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-title">Entrega</h2><Button type="button" variant="ghost" size="sm" disabled={somenteLeitura || consultandoGeral || consultandoCobranca || consultandoEntrega} onClick={copiarCobranca}>Copiar endereço de cobrança</Button></div>
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex min-w-0 items-end gap-2">
            <label className="grid min-w-0 flex-1 gap-1 text-xs">Endereço de entrega<SeletorEnderecoCliente nome="Endereço de entrega" opcoes={opcoesEntrega} selecionado={entregasCadastradas.length ? indiceEntrega : null} disabled={cliente.tipoEscolhido === false || consultandoGeral || consultandoEntrega} alterar={indice => { if (somenteLeitura) setEntregaLeitura(indice); else if (indice !== indiceEntrega) onChange({ ...cliente, entregaPadrao: selecionarEntregaCliente(cliente.entregaPadrao, indice) }); }} /></label>
            <GrupoAcoes nome="Endereços de entrega">
              <Button type="button" variant="outline" size="icon" aria-label="Adicionar endereço de entrega" title="Adicionar endereço de entrega" disabled={somenteLeitura || consultandoEntrega || entregasCadastradas.length >= LIMITE_ENTREGAS_CLIENTE} onClick={() => setNovaEntrega(entregaVazia())}><Plus aria-hidden="true" /></Button>
              <BotaoRemoverItem discreto nome={`Remover entrega ${indiceEntrega + 1}`} disabled={somenteLeitura || consultandoEntrega || !entregasCadastradas.length} onClick={() => enderecoTemConteudo({ ...entrega.endereco, nomeCompleto: entrega.destinatario.nome, textoOriginal: entrega.textoOriginal }) ? setRemovendoEntrega(true) : removerEntrega()} />
            </GrupoAcoes>
          </div>
          {entregasCadastradas.length ? <>
            {entrega.textoOriginal && <dl className="space-y-1"><dt className="text-xs text-muted-foreground">Endereço original</dt><dd className="whitespace-pre-wrap break-words text-sm">{entrega.textoOriginal}</dd></dl>}
            <CamposDestinatarioCliente obrigatorio={!somenteLeitura} valor={entrega.destinatario} somenteLeitura={somenteLeitura} alterar={destinatario => rascunhoEntrega({ ...entrega, destinatario })} />
            <CamposEnderecoPedido obrigatorio={!somenteLeitura} key={indiceEntrega} valor={entrega.endereco} somenteLeitura={somenteLeitura} consultarCep={buscarCepClienteAction} onConsultandoCepChange={ocupado => consultar("entrega", ocupado)} alterar={endereco => rascunhoEntrega({ ...entrega, endereco })} />
          </> : <p className="text-sm text-muted-foreground">Nenhum endereço de entrega cadastrado. Use + para adicionar.</p>}
          {erroEntrega && <p role="alert" className="text-sm text-destructive">{erroEntrega}</p>}
        </div>
        {novaEntrega && <NovaEntregaClienteDialog entregas={entregasCadastradas} inicial={novaEntrega} consultarCep={buscarCepClienteAction} confirmar={valor => { onChange({ ...cliente, entregaPadrao: adicionarEntregaCliente(cliente.entregaPadrao, valor) }); setNovaEntrega(null); }} fechar={() => setNovaEntrega(null)} />}
        {removendoEntrega && <ConfirmarRemocaoEndereco nome={`Entrega ${indiceEntrega + 1}`} descricao="Este endereço de entrega deixará de aparecer no cadastro." confirmar={removerEntrega} fechar={() => setRemovendoEntrega(false)} />}
      </section>
    </fieldset>
  </div>;
}
