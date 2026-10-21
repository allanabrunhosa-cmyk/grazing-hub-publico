"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxItem } from "@/components/ui/combobox";
import { paises } from "@/lib/paises";
import { Campo } from "../componentes";
import { buscarCepPedidoAction } from "./cadastro-cliente-actions";
import { codigoMunicipioCompativel } from "@/lib/vendas/municipio";
import { useMascaraDigitos } from "@/components/use-mascara-digitos";

export type EnderecoPedidoForm = Partial<import("@/lib/vendas/dominio").IdentidadeCobranca> & { pais?: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; codigoMunicipio?: string };
export const enderecoPedidoVazio = (): EnderecoPedidoForm => ({ pais: "Brasil", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
export const formatarCep = (valor: string) => { const digitos = valor.replace(/\D/g, "").slice(0, 8); return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos; };

type ConsultaCep = (cep: string) => Promise<{ endereco?: Partial<EnderecoPedidoForm>; erro?: string }>;
const camposPostais = ["logradouro", "bairro", "cidade", "uf"] as const;

export function CamposEnderecoPedido({ valor, alterar, obrigatorio = false, buscarCep = true, somenteLeitura = false, consultarCep = buscarCepPedidoAction, onConsultandoCepChange, mostrarPais = true, complementoObrigatorio = false }: { valor: EnderecoPedidoForm; alterar: (novo: EnderecoPedidoForm) => void; obrigatorio?: boolean; buscarCep?: boolean; somenteLeitura?: boolean; consultarCep?: ConsultaCep; onConsultandoCepChange?: (consultando: boolean) => void; mostrarPais?: boolean; complementoObrigatorio?: boolean }) {
  const [aviso, setAviso] = useState("");
  const [consultando, setConsultando] = useState(false);
  const atual = useRef(valor);
  const alterarAtual = useRef(alterar);
  const pedidoConsulta = useRef(0);
  const callbackConsulta = useRef(onConsultandoCepChange);
  useLayoutEffect(() => { atual.current = valor; alterarAtual.current = alterar; callbackConsulta.current = onConsultandoCepChange; }, [valor, alterar, onConsultandoCepChange]);
  useEffect(() => () => { pedidoConsulta.current++; callbackConsulta.current?.(false); }, []);
  const brasileiro = (valor.pais ?? "Brasil").trim().toLocaleLowerCase("pt-BR") === "brasil";
  const rotulo = (nome: string) => `${nome}${obrigatorio ? " *" : ""}`;
  const opcoesPais = paises.map(p => ({ value: p.nome, label: p.nome }));
  if (valor.pais && !opcoesPais.some(p => p.value === valor.pais)) opcoesPais.push({ value: valor.pais, label: valor.pais });
  function ocupado(estado: boolean) { setConsultando(estado); callbackConsulta.current?.(estado); }
  const campo = (chave: keyof EnderecoPedidoForm, texto: string) => {
    if (somenteLeitura) return;
    if (chave === "cep" || chave === "pais") { pedidoConsulta.current++; ocupado(false); }
    const limpar = (brasileiro && chave === "cep") || chave === "pais";
    const novo = { ...atual.current, ...(limpar ? { logradouro: "", bairro: "", cidade: "", uf: "", codigoMunicipio: undefined } : {}), ...(chave === "pais" ? { cep: "" } : {}), [chave]: texto };
    atual.current = novo;
    alterarAtual.current(novo); setAviso("");
  };
  const cepMascarado = useMascaraDigitos(valor.cep, "CEP", cep => campo("cep", cep));
  async function consultar() {
    if (!buscarCep || somenteLeitura || consultando || !brasileiro || !/^\d{8}$/.test(valor.cep.replace(/\D/g, ""))) return;
    const consulta = ++pedidoConsulta.current;
    const cep = valor.cep.replace(/\D/g, "");
    ocupado(true); setAviso("Consultando CEP…");
    try {
      const resposta = await consultarCep(cep);
      if (consulta !== pedidoConsulta.current || atual.current.cep.replace(/\D/g, "") !== cep || (atual.current.pais ?? "Brasil").trim().toLocaleLowerCase("pt-BR") !== "brasil") return;
      if (resposta.endereco) {
        const campos = camposPostais.filter(chave => typeof resposta.endereco?.[chave] === "string");
        const preenchidos = Object.fromEntries(campos.map(chave => [chave, resposta.endereco![chave]]));
        const uf = typeof preenchidos.uf === "string" ? preenchidos.uf : atual.current.uf;
        const codigoMunicipio = resposta.endereco.codigoMunicipio;
        const novo = { ...atual.current, ...preenchidos, codigoMunicipio: codigoMunicipioCompativel(codigoMunicipio, uf) ? codigoMunicipio : undefined };
        atual.current = novo; alterarAtual.current(novo);
        setAviso("Endereço preenchido pelo CEP. Informe número e complemento.");
      } else setAviso(resposta.erro ?? "Não foi possível consultar o CEP. Confira o CEP e tente novamente.");
    } catch {
      if (consulta === pedidoConsulta.current) setAviso("Consulta do CEP indisponível. Tente novamente.");
    } finally { if (consulta === pedidoConsulta.current) ocupado(false); }
  }
  return <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-12">
    {mostrarPais && <div className="lg:col-span-2"><Campo nome={rotulo("País")}><Combobox disabled={somenteLeitura} items={opcoesPais} value={opcoesPais.find(p => p.value === (valor.pais ?? "Brasil")) ?? null} onValueChange={p => { if (p) campo("pais", p.value); }}><ComboboxInputGroup><ComboboxInput data-endereco-campo="pais" required={obrigatorio} aria-label="País" /></ComboboxInputGroup><ComboboxContent>{p => <ComboboxItem key={p.value} value={p}>{p.label}</ComboboxItem>}</ComboboxContent></Combobox></Campo></div>}
    <div className="lg:col-span-2"><Campo nome={rotulo(brasileiro ? "CEP" : "Código postal")}><Input data-endereco-campo="cep" readOnly={somenteLeitura} required={obrigatorio} inputMode={brasileiro ? "numeric" : "text"} {...brasileiro ? cepMascarado : { value: valor.cep, maxLength: 30, onChange: (e: React.ChangeEvent<HTMLInputElement>) => campo("cep", e.target.value) }} onBlur={consultar} /></Campo></div>
    <div className={mostrarPais ? "sm:col-span-2 lg:col-span-6" : "sm:col-span-2 lg:col-span-8"}><Campo nome={rotulo("Logradouro")}><Input data-endereco-campo="logradouro" readOnly={somenteLeitura || brasileiro} required={obrigatorio} value={valor.logradouro} maxLength={200} onChange={e => { if (!brasileiro) campo("logradouro", e.target.value); }} /></Campo></div>
    <div className="lg:col-span-2"><Campo nome={rotulo("Número")}><Input data-endereco-campo="numero" readOnly={somenteLeitura} required={obrigatorio} value={valor.numero} maxLength={30} onChange={e => campo("numero", e.target.value)} /></Campo></div>
    <div className="lg:col-span-4"><Campo nome={obrigatorio && complementoObrigatorio ? "Complemento *" : "Complemento (opcional)"}><Input data-endereco-campo="complemento" readOnly={somenteLeitura} required={obrigatorio && complementoObrigatorio} value={valor.complemento} maxLength={160} onChange={e => campo("complemento", e.target.value)} /></Campo></div>
    <div className="lg:col-span-3"><Campo nome={rotulo("Bairro")}><Input data-endereco-campo="bairro" readOnly={somenteLeitura || brasileiro} required={obrigatorio} value={valor.bairro} maxLength={120} onChange={e => { if (!brasileiro) campo("bairro", e.target.value); }} /></Campo></div>
    <div className="lg:col-span-3"><Campo nome={rotulo("Cidade")}><Input data-endereco-campo="cidade" readOnly={somenteLeitura || brasileiro} required={obrigatorio} value={valor.cidade} maxLength={120} onChange={e => { if (!brasileiro) campo("cidade", e.target.value); }} /></Campo></div>
    <div className="lg:col-span-2"><Campo nome={rotulo(brasileiro ? "Estado / UF" : "Estado / região")}><Input data-endereco-campo="uf" readOnly={somenteLeitura || brasileiro} required={obrigatorio} value={valor.uf} maxLength={brasileiro ? 2 : 120} onChange={e => { if (!brasileiro) campo("uf", e.target.value); }} /></Campo></div>
    {aviso && <p role="status" aria-live="polite" className="self-end text-xs text-muted-foreground sm:col-span-2 lg:col-span-12">{consultando ? "Consultando CEP…" : aviso}</p>}
  </div>;
}
