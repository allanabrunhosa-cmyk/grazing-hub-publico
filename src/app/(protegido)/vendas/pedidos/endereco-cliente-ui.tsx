"use client";

import { useState, type ReactNode } from "react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function rotuloEnderecoPostal(endereco: { pais?: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }) {
  return [endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro, endereco.cidade, endereco.uf, endereco.cep, endereco.pais].filter(Boolean).join(", ");
}

export function enderecoTemConteudo(endereco: Record<string, unknown>) {
  return ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "nomeCompleto", "razaoSocial", "documento", "textoOriginal"].some(campo => typeof endereco[campo] === "string" && endereco[campo].trim());
}

export function SeletorEnderecoCliente({ nome, opcoes, selecionado, alterar, disabled = false }: { nome: string; opcoes: { indice: number; rotulo: string; busca?: string }[]; selecionado: number | null; alterar: (indice: number) => void; disabled?: boolean }) {
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  return <Combobox items={opcoes} value={opcoes.find(opcao => opcao.indice === selecionado) ?? null} disabled={disabled} itemToStringLabel={opcao => opcao.rotulo} isItemEqualToValue={(opcao, valor) => opcao.indice === valor.indice} filter={(opcao, busca) => normalizar(`${opcao.rotulo} ${opcao.busca ?? ""}`).includes(normalizar(busca))} onValueChange={opcao => { if (opcao) alterar(opcao.indice); }}>
    <ComboboxInputGroup><ComboboxInput aria-label={nome} placeholder="Buscar titular, destinatário ou endereço" maxLength={250} /></ComboboxInputGroup>
    <ComboboxContent emptyLabel="Nenhum endereço encontrado.">{opcao => <ComboboxItem key={opcao.indice} value={opcao}><span className="whitespace-normal break-words">{opcao.rotulo}</span></ComboboxItem>}</ComboboxContent>
  </Combobox>;
}

export function DialogAdicionarEndereco({ titulo, children, ocupado, validar, confirmar, fechar }: { titulo: string; children: ReactNode; ocupado: boolean; validar: () => string | null; confirmar: () => void; fechar: () => void }) {
  const [origemFoco] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [aberto, setAberto] = useState(true);
  const [erro, setErro] = useState("");
  return <Dialog open={aberto} onOpenChange={proximo => { if (!proximo && !ocupado) setAberto(false); }} onOpenChangeComplete={proximo => { if (!proximo) fechar(); }} protegerAlteracoes={!ocupado}>
    <DialogContent finalFocus={() => origemFoco} showCloseButton={!ocupado} className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words sm:max-w-5xl">
      <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>Preencha os campos obrigatórios. O endereço será incluído ao confirmar e será gravado ao salvar o cadastro.</DialogDescription></DialogHeader>
      <form noValidate className="space-y-4" onInput={evento => evento.stopPropagation()} onChange={evento => { evento.stopPropagation(); setErro(""); }} onSubmit={evento => {
        evento.preventDefault(); evento.stopPropagation(); if (ocupado) return;
        const pendencia = validar();
        if (pendencia || !evento.currentTarget.checkValidity()) {
          setErro(pendencia ?? "Preencha os campos obrigatórios do endereço.");
          const campo = [...evento.currentTarget.querySelectorAll<HTMLInputElement>("input")].find(campo => campo.willValidate && !campo.validity.valid);
          campo?.focus(); return;
        }
        try { confirmar(); } catch (falha) { setErro(falha instanceof Error ? falha.message : "Confira os dados do endereço."); }
      }}>
        {children}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <DialogFooter><GrupoAcoes nome="Adicionar endereço"><Button type="button" variant="outline" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button><Button type="submit" variant="entrada" disabled={ocupado}>{ocupado ? "Aguarde a consulta…" : "Adicionar endereço"}</Button></GrupoAcoes></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function ConfirmarRemocaoEndereco({ nome, descricao, confirmar, fechar }: { nome: string; descricao: string; confirmar: () => void; fechar: () => void }) {
  const [origemFoco] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [aberto, setAberto] = useState(true);
  return <Dialog open={aberto} onOpenChange={proximo => setAberto(proximo)} onOpenChangeComplete={proximo => { if (!proximo) fechar(); }} protegerAlteracoes={false}><DialogContent finalFocus={() => origemFoco}><DialogHeader><DialogTitle>Remover {nome}?</DialogTitle><DialogDescription>{descricao} A remoção será aplicada ao salvar. O histórico dos pedidos será preservado.</DialogDescription></DialogHeader><DialogFooter><GrupoAcoes nome="Confirmação de remoção"><Button type="button" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button><BotaoRemoverItem nome={`Confirmar remoção de ${nome}`} onClick={confirmar} /></GrupoAcoes></DialogFooter></DialogContent></Dialog>;
}
