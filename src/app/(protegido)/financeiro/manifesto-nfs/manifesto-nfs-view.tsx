"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";

import { SelecaoFormulario } from "@/components/ui/select";
import { ImportarMunicipalDialog } from "./importar-municipal-dialog";
import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, FileUp, KeyRound, Loader2, ReceiptText, RefreshCw, Search, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { CampoBusca } from "@/components/campo-busca";
import { periodoMesAteHoje } from "@/lib/financeiro/periodos";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { correspondeFiltroNfse, situacaoNfse } from "@/lib/nfse/filtros";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { formatarCpfCnpj } from "@/lib/documento-brasileiro";
import type { DadosPessoaNfse } from "@/lib/nfse/parse";
import type { GrupoDre } from "@/generated/prisma/client";
import { dataCalendarioValida, vencimentoCartao, type CartaoOption } from "@/lib/financeiro/cartoes";
import { dataParaIso, somarFrequencia } from "@/lib/financeiro/recorrencia";
import { MUNICIPIOS_NFSE, type MunicipioNfse } from "@/lib/nfse/municipios";

type Nota = {
  id: string; identificador: string; chaveAcesso: string | null; origem: string; status: string;
  numero: string | null; serie: string | null; codigoVerificacao: string | null;
  prestadorNome: string | null; prestadorCnpj: string | null; prestadorDados: DadosPessoaNfse | null;
  tomadorNome: string | null; tomadorCnpj: string | null; tomadorDados: DadosPessoaNfse | null;
  fornecedorNome: string | null; valorServico: number; valorLiquido: number; valorIss: number;
  dataEmissao: string | null; dataCompetencia: string | null; municipioNome: string | null; uf: string | null; lancada: boolean;
  temXml: boolean;
};
type Categoria = { id: string; nome: string; grupo: GrupoDre };
type FormaPagamentoNfse = "BOLETO" | "PIX" | "CARTAO";
type ParcelaNfse = { numero: string; valor: number; dataVencimento: string; formaPagamento: FormaPagamentoNfse; cartaoCreditoId?: string | null; dataCompra?: string | null; parcelaCartao?: number };

function SituacaoNota({ nota }: { nota: Nota }) {
  const situacao = situacaoNfse(nota);
  const rotulo = { PENDENTE: "Pendente", ACEITA: "Aceita", LANCADA: "Aceita", RECUSADA: "Recusada", IGNORADA: "Recusada", CANCELADA: "Cancelada" }[situacao] ?? situacao;
  return <Badge variant={situacao === "ACEITA" || situacao === "LANCADA" ? "success" : situacao === "RECUSADA" || situacao === "IGNORADA" ? "destructive" : situacao === "PENDENTE" ? "warning" : "muted"}>{rotulo}</Badge>;
}

function ExportarXml({ id, de = "", ate = "", disabled = false }: { id?: string; de?: string; ate?: string; disabled?: boolean }) {
  const [exportando, setExportando] = useState(false);
  async function exportar() {
    setExportando(true);
    try {
      const parametros = new URLSearchParams(id ? { id } : { de, ate });
      const resposta = await fetch("/api/nfse/exportar-xml?" + parametros.toString());
      if (!resposta.ok) {
        const resultado = await resposta.json();
        throw new Error(resultado.erro);
      }
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = resposta.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? (id ? "nfse.xml" : "nfse-xmls.zip");
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível exportar o XML.");
    } finally { setExportando(false); }
  }
  return <Button type="button" size="sm" variant="outline" disabled={disabled || exportando} onClick={() => void exportar()}>
    {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Exportar XML
  </Button>;
}

function AcoesDecisao({ nota }: { nota: Nota }) {
  const router = useRouter();
  const [decisao, setDecisao] = useState<"ACEITAR" | "RECUSAR" | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function alterar() {
    if (!decisao) return;
    setSalvando(true);
    try {
      const resposta = await fetch("/api/nfse/situacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nfseId: nota.id, decisao }) });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro);
      toast.success(decisao === "ACEITAR" ? "NFS-e aceita." : "NFS-e recusada.");
      setDecisao(null); router.refresh();
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível alterar a nota."); }
    finally { setSalvando(false); }
  }
  if (situacaoNfse(nota) !== "PENDENTE") return null;
  return <>
    <div className="flex min-w-64 gap-2">
      <Button type="button" size="sm" variant="destructive" className="w-32 justify-center" disabled={salvando} onClick={() => setDecisao("RECUSAR")}><ShieldX className="size-4" />Recusar</Button>
      <Button type="button" size="sm" className="w-32 justify-center border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800" disabled={salvando} onClick={() => setDecisao("ACEITAR")}><ShieldCheck className="size-4" />Aceitar</Button>
    </div>
    <Dialog open={decisao !== null} onOpenChange={valor => { if (!valor && !salvando) setDecisao(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{decisao === "ACEITAR" ? "Aceitar NFS-e?" : "Recusar NFS-e?"}</DialogTitle>
        <DialogDescription>{decisao === "ACEITAR" ? `A NFS-e ${nota.numero ?? ""} de ${nota.prestadorNome ?? "prestador não identificado"} ficará aceita e poderá ser lançada no financeiro.` : `A NFS-e ${nota.numero ?? ""} de ${nota.prestadorNome ?? "prestador não identificado"} ficará recusada e não poderá gerar uma despesa.`} Esta decisão fica registrada no histórico do HUB.</DialogDescription>
      </DialogHeader><DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={() => setDecisao(null)}>Cancelar</Button>
        <Button type="button" variant={decisao === "RECUSAR" ? "destructive" : "default"} disabled={salvando} onClick={() => void alterar()}>{salvando && <Loader2 className="size-4 animate-spin" />}{decisao === "ACEITAR" ? "Confirmar aceite" : "Confirmar recusa"}</Button>
      </DialogFooter></DialogContent>
    </Dialog>
  </>;
}

function dataBr(data: string | null) { return data ? new Date(data).toLocaleDateString("pt-BR") : "—"; }
function documentoDaPessoa(pessoa: DadosPessoaNfse | null, fallback: string | null) { const numero = pessoa?.cnpj || pessoa?.cpf || fallback; return numero ? formatarCpfCnpj(numero) : null; }
function enderecoDaPessoa(pessoa: DadosPessoaNfse | null) {
  if (!pessoa?.endereco) return null;
  const endereco = pessoa.endereco;
  const linha = [endereco.logradouro, endereco.numero, endereco.complemento].filter(Boolean).join(", ");
  const local = [endereco.bairro, endereco.municipio, endereco.uf].filter(Boolean).join(" · ");
  const cep = endereco.cep ? `CEP ${endereco.cep}` : null;
  return [linha, local, cep].filter(Boolean).join(" — ") || null;
}
function PessoaResumo({ titulo, pessoa, nome, documento }: { titulo: string; pessoa: DadosPessoaNfse | null; nome: string | null; documento: string | null }) {
  const nomeExibido = pessoa?.nome || nome || "Não identificado";
  const documentoExibido = documentoDaPessoa(pessoa, documento);
  const endereco = enderecoDaPessoa(pessoa);
  return <section className="rounded-lg border bg-muted/20 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p><p className="mt-1 break-words font-medium">{nomeExibido}</p>{documentoExibido && <p className="text-sm text-muted-foreground">{documentoExibido}</p>}{pessoa?.inscricaoMunicipal && <p className="text-sm text-muted-foreground">Inscrição municipal: {pessoa.inscricaoMunicipal}</p>}{pessoa?.email && <p className="break-all text-sm text-muted-foreground">{pessoa.email}</p>}{pessoa?.telefone && <p className="text-sm text-muted-foreground">{pessoa.telefone}</p>}{endereco && <p className="mt-1 break-words text-sm text-muted-foreground">{endereco}</p>}</section>;
}

export function AcaoBarra({ podeBuscar }: { podeBuscar: boolean }) {
  const input = useRef<HTMLInputElement>(null); const router = useRouter(); const [carregando, setCarregando] = useState<"importar" | "buscar" | null>(null); const [dpsAberto, setDpsAberto] = useState(false); const [chaveAberta, setChaveAberta] = useState(false); const [municipalAberta, setMunicipalAberta] = useState(false);
  async function importar(arquivo: File) {
    setCarregando("importar"); const form = new FormData(); form.set("arquivo", arquivo);
    try { const resposta = await fetch("/api/nfse/importar-xml", { method: "POST", body: form }); const resultado = await resposta.json(); if (!resposta.ok) throw new Error(resultado.erro); toast.success(resultado.mensagem); router.refresh(); }
    catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e."); }
    finally { setCarregando(null); if (input.current) input.current.value = ""; }
  }
  async function buscar() {
    setCarregando("buscar");
    try {
      const resposta = await fetch("/api/nfse/buscar", { method: "POST" });
      const resultado = await resposta.json().catch(() => { throw new Error("O servidor não retornou uma resposta válida. Atualize a página para conferir o resultado da busca antes de tentar novamente."); });
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível concluir a busca de NFS-e.");
      toast.success(resultado.motivo);
    } catch (erro) {
      toast.error(erro instanceof TypeError
        ? "A comunicação com o servidor foi interrompida. Atualize a página para conferir o resultado antes de tentar novamente."
        : erro instanceof Error ? erro.message : "Não foi possível buscar NFS-e.");
    }
    finally { setCarregando(null); router.refresh(); }
  }
  return <><ImportarMunicipalDialog aberto={municipalAberta} aoFechar={valor => { setMunicipalAberta(false); if (valor) router.refresh(); }} /><ImportarDpsDialog aberto={dpsAberto} aoFechar={valor => { setDpsAberto(false); if (valor) router.refresh(); }} /><ImportarChaveNfseDialog aberto={chaveAberta} aoFechar={valor => { setChaveAberta(false); if (valor) router.refresh(); }} /><div className="flex flex-wrap gap-2"><input ref={input} className="hidden" type="file" accept=".xml,text/xml,application/xml" onChange={evento => { const arquivo = evento.target.files?.[0]; if (arquivo) void importar(arquivo); }} /><Button type="button" variant="outline" disabled={Boolean(carregando)} onClick={() => setDpsAberto(true)}><Search className="size-4" />Importar por DPS</Button><Button type="button" variant="outline" disabled={Boolean(carregando)} onClick={() => setMunicipalAberta(true)}><ReceiptText className="size-4" />Importar municipal</Button><Button type="button" variant="outline" disabled={Boolean(carregando)} onClick={() => setChaveAberta(true)}><KeyRound className="size-4" />Importar por chave</Button><Button type="button" variant="outline" disabled={Boolean(carregando)} onClick={() => input.current?.click()}>{carregando === "importar" ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}Importar XML</Button>{podeBuscar && <Button type="button" disabled={Boolean(carregando)} onClick={() => void buscar()}>{carregando === "buscar" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Buscar novas NFS</Button>}</div></>;
}

function ImportarDpsDialog({ aberto, aoFechar }: { aberto: boolean; aoFechar: (importada: boolean) => void }) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");
  const [municipioCodigo, setMunicipioCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const documentoValido = [11, 14].includes(cpfCnpj.replace(/\D/g, "").length);
  const podeEnviar = documentoValido && /^\d{1,5}$/.test(serie.trim()) && /^\d{1,15}$/.test(numero) && /^\d{7}$/.test(municipioCodigo);
  const municipios = MUNICIPIOS_NFSE.map((municipio) => ({
    value: municipio.codigo,
    label: `${municipio.nome} - ${municipio.uf}`,
    municipio,
  }));
  const selecionado = municipios.find((municipio) => municipio.value === municipioCodigo) ?? null;
  function filtrarMunicipio(item: { value: string; label: string; municipio: MunicipioNfse }, consulta: string) {
    const texto = consulta.trim();
    if (!texto) return MUNICIPIOS_NFSE.indexOf(item.municipio) < 100;
    const normalizado = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    const busca = normalizado(texto);
    return normalizado(`${item.label} ${item.value}`).includes(busca);
  }
  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (!podeEnviar) return; setCarregando(true);
    try {
      const resposta = await fetch("/api/nfse/importar-dps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpfCnpj, serie, numero, municipioCodigo }) });
      const resultado = await resposta.json(); if (!resposta.ok) throw new Error(resultado.erro);
      toast.success(resultado.mensagem); aoFechar(true); setCpfCnpj(""); setSerie(""); setNumero(""); setMunicipioCodigo("");
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e pelos dados da DPS."); }
    finally { setCarregando(false); }
  }
  return <Dialog open={aberto} protegerAlteracoes={false} onOpenChange={valor => { if (!valor && !carregando) aoFechar(false); }}>
    <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Importar NFS-e por dados da DPS</DialogTitle><DialogDescription>Informe os dados que identificam a DPS. A consulta busca a chave de acesso e baixa o XML oficial da NFS-e no ambiente nacional.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={importar}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dps-cpf-cnpj">CPF/CNPJ do emitente *</Label><Input id="dps-cpf-cnpj" value={formatarCpfCnpj(cpfCnpj)} onChange={evento => setCpfCnpj(evento.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="00.000.000/0000-00" aria-invalid={cpfCnpj.length > 0 && !documentoValido} /></div><div className="space-y-1.5"><Label htmlFor="dps-serie">Série da DPS *</Label><Input id="dps-serie" inputMode="numeric" pattern="[0-9]{1,5}" maxLength={5} value={serie} onChange={evento => setSerie(evento.target.value)} placeholder="Ex.: 000" aria-invalid={serie.length > 0 && !/^\d{1,5}$/.test(serie)} aria-describedby="dps-serie-ajuda" /><p id="dps-serie-ajuda" className="text-xs text-muted-foreground">Use a série numérica da DPS nacional. Para RPS municipais de São Paulo, use Importar municipal. Para outros municípios, use a chave nacional ou o XML oficial.</p></div><div className="space-y-1.5"><Label htmlFor="dps-numero">Número da DPS *</Label><Input id="dps-numero" inputMode="numeric" value={numero} onChange={evento => setNumero(evento.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="Ex.: 123" /></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dps-municipio">Município de emissão *</Label><Combobox items={municipios} value={selecionado} onValueChange={valor => setMunicipioCodigo(valor ? (valor as { value: string }).value : "")} itemToStringLabel={valor => (valor as { label: string } | null)?.label ?? ""} filter={filtrarMunicipio} disabled={carregando}><ComboboxInputGroup><ComboboxInput id="dps-municipio" placeholder="Buscar cidade, UF ou código IBGE..." aria-describedby="dps-municipio-ajuda" /></ComboboxInputGroup><ComboboxContent className="max-h-72" emptyLabel="Nenhum município encontrado.">{(item: { value: string; label: string; municipio: MunicipioNfse }) => <ComboboxItem key={item.value} value={item} className="items-start py-2"><span className="flex min-w-0 flex-col"><span className="font-medium">{item.label}</span><span className="text-xs text-muted-foreground">Código IBGE: {item.value}</span></span></ComboboxItem>}</ComboboxContent></Combobox>{selecionado && <p className="text-xs text-muted-foreground">Código IBGE selecionado: <span className="font-medium tabular-nums text-foreground">{selecionado.value}</span></p>}<p id="dps-municipio-ajuda" className="text-xs text-muted-foreground">Lista oficial com 5.571 municípios. Digite o nome da cidade, a UF ou o código IBGE e selecione uma opção.</p></div></div><DialogFooter><Button type="button" variant="outline" disabled={carregando} onClick={() => aoFechar(false)}>Cancelar</Button><Button type="submit" disabled={!podeEnviar || carregando}>{carregando && <Loader2 className="size-4 animate-spin" />}Consultar e importar</Button></DialogFooter></form>
    </DialogContent></Dialog>;
}

function ImportarChaveNfseDialog({ aberto, aoFechar }: { aberto: boolean; aoFechar: (importada: boolean) => void }) {
  const [chave, setChave] = useState("");
  const [carregando, setCarregando] = useState(false);
  const chaveLimpa = chave.replace(/\D/g, "").slice(0, 50);
  const podeEnviar = /^\d{50}$/.test(chaveLimpa);
  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (!podeEnviar) return; setCarregando(true);
    try {
      const resposta = await fetch("/api/nfse/importar-chave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave: chaveLimpa }) });
      const resultado = await resposta.json(); if (!resposta.ok) throw new Error(resultado.erro);
      toast.success(resultado.mensagem); aoFechar(true); setChave("");
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e pela chave."); }
    finally { setCarregando(false); }
  }
  return <Dialog open={aberto} protegerAlteracoes={false} onOpenChange={valor => { if (!valor && !carregando) aoFechar(false); }}>
    <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Importar NFS-e pela chave</DialogTitle><DialogDescription>Informe a chave de acesso de 50 dígitos exibida na consulta pública da NFS-e. O HUB baixará o XML oficial na Sefin Nacional.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={importar}><div className="space-y-1.5"><Label htmlFor="nfse-chave">Chave de acesso *</Label><Input id="nfse-chave" value={chaveLimpa} onChange={evento => setChave(evento.target.value)} inputMode="numeric" maxLength={50} placeholder="Digite os 50 dígitos" aria-describedby="nfse-chave-ajuda" /></div><p id="nfse-chave-ajuda" className="text-xs text-muted-foreground">A consulta depende do certificado digital do HUB estar vinculado ao prestador, tomador ou intermediário da nota.</p><DialogFooter><Button type="button" variant="outline" disabled={carregando} onClick={() => aoFechar(false)}>Cancelar</Button><Button type="submit" disabled={!podeEnviar || carregando}>{carregando && <Loader2 className="size-4 animate-spin" />}Consultar e importar</Button></DialogFooter></form>
    </DialogContent></Dialog>;
}

function VerNotaDialog({ nota, categorias, cartoes, aberto, podeLancar, podeEditar, aoFechar }: { nota: Nota | null; categorias: Categoria[]; cartoes: CartaoOption[]; aberto: boolean; podeLancar: boolean; podeEditar: boolean; aoFechar: (atualizar: boolean) => void }) {
  const router = useRouter();
  const [categoriaId, setCategoriaId] = useState("");
  const [descricao, setDescricao] = useState(() => nota ? `NFS-e ${nota.numero ?? nota.chaveAcesso ?? nota.identificador.slice(0, 18)}${nota.prestadorNome ? ` — ${nota.prestadorNome}` : ""}` : "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoNfse>("BOLETO");
  const [cartaoCreditoId, setCartaoCreditoId] = useState("");
  const [dataCompra, setDataCompra] = useState(nota?.dataEmissao?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const valor = nota ? (nota.valorLiquido || nota.valorServico) : 0;
  const cartao = cartoes.find(item => item.id === cartaoCreditoId);
  const parcelas: ParcelaNfse[] = Array.from({ length: quantidadeParcelas }, (_, indice) => {
    const parcelaCartao = indice + 1;
    let vencimento = dataVencimento;
    if (formaPagamento === "CARTAO" && cartao && dataCalendarioValida(dataCompra)) {
      try { vencimento = vencimentoCartao(dataCompra, cartao.diaFechamento, cartao.diaVencimento, parcelaCartao); } catch { vencimento = ""; }
    } else if (quantidadeParcelas > 1 && dataCalendarioValida(dataVencimento)) {
      vencimento = dataParaIso(somarFrequencia(new Date(`${dataVencimento}T12:00:00`), "MENSAL", indice));
    }
    const centavosBase = Math.floor((valor * 100) / quantidadeParcelas);
    const centavos = indice === quantidadeParcelas - 1 ? Math.round(valor * 100) - centavosBase * (quantidadeParcelas - 1) : centavosBase;
    return { numero: String(indice + 1).padStart(3, "0"), valor: centavos / 100, dataVencimento: vencimento, formaPagamento, cartaoCreditoId: formaPagamento === "CARTAO" ? cartaoCreditoId : null, dataCompra: formaPagamento === "CARTAO" ? dataCompra : null, parcelaCartao: formaPagamento === "CARTAO" ? parcelaCartao : undefined };
  });
  async function salvar() {
    if (!nota || !categoriaId || !descricao.trim() || parcelas.some(parcela => !parcela.dataVencimento)) return;
    setSalvando(true);
    try {
      const resposta = await fetch("/api/nfse/lancar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nfseId: nota.id, categoriaId, descricao, dataVencimento, parcelas }) });
      const resultado = await resposta.json(); if (!resposta.ok) throw new Error(resultado.erro);
      toast.success("NFS-e lançada no financeiro."); aoFechar(true); router.refresh();
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível lançar a NFS-e."); }
    finally { setSalvando(false); }
  }
  const podeLancarNota = nota && podeLancar && situacaoNfse(nota) === "ACEITA";
  return <Dialog open={aberto} onOpenChange={abertoAtual => { if (!abertoAtual && !salvando) aoFechar(false); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Ver nota</DialogTitle><DialogDescription>{nota ? `NFS-e ${nota.numero ?? nota.chaveAcesso ?? nota.identificador}` : "Selecione uma NFS-e."}</DialogDescription></DialogHeader>{nota && <div className="space-y-5"><div className="flex flex-wrap items-center gap-2"><SituacaoNota nota={nota} /><Badge variant="outline">{nota.origem === "NACIONAL" ? "Padrão nacional" : "Importada"}</Badge>{nota.serie && <span className="text-sm text-muted-foreground">Série {nota.serie}</span>}</div><div className="grid gap-3 sm:grid-cols-2"><PessoaResumo titulo="Fornecedor ou beneficiário" pessoa={nota.prestadorDados} nome={nota.prestadorNome} documento={nota.prestadorCnpj} /><PessoaResumo titulo="Tomador" pessoa={nota.tomadorDados} nome={nota.tomadorNome} documento={nota.tomadorCnpj} /></div><section className="space-y-3"><p className="text-sm font-semibold">Dados da nota</p><div className="grid gap-3 sm:grid-cols-2"><div><Label>Valor</Label><p className="mt-1 font-medium tabular-nums">{formatarMoeda(valor)}</p></div><div><Label>Valor do serviço</Label><p className="mt-1 tabular-nums">{formatarMoeda(nota.valorServico)}</p></div><div><Label>ISS</Label><p className="mt-1 tabular-nums">{formatarMoeda(nota.valorIss)}</p></div><div><Label>Emissão</Label><p className="mt-1">{dataBr(nota.dataEmissao)}</p></div><div><Label>Competência</Label><p className="mt-1">{dataBr(nota.dataCompetencia)}</p></div>{nota.codigoVerificacao && <div><Label>Código de verificação</Label><p className="mt-1 break-all">{nota.codigoVerificacao}</p></div>}</div></section>{podeLancarNota && <section className="space-y-3 border-t pt-4"><p className="text-sm font-semibold">Lançamento financeiro</p><div className="space-y-1.5"><Label>Descrição</Label><Input aria-label="Descrição" value={descricao} onChange={evento => setDescricao(evento.target.value)} maxLength={160} placeholder="Descrição da despesa" disabled={salvando} /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Valor total</Label><Input aria-label="Valor total" value={formatarMoeda(valor)} readOnly /></div><div><Label>Categoria</Label><CategoriaFinanceiraCombobox categorias={categorias} value={categoriaId} onChange={setCategoriaId} disabled={salvando} ariaLabel="Categoria" placeholder="Buscar categoria..." /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Forma de pagamento</Label><SelecaoFormulario aria-label="Forma de pagamento" value={formaPagamento} onValueChange={novoValor => setFormaPagamento(novoValor as FormaPagamentoNfse)} disabled={salvando}><option value="BOLETO">Boleto</option><option value="PIX">Pix</option><option value="CARTAO">Cartão de crédito</option></SelecaoFormulario></div><div className="space-y-1.5"><Label>Quantidade de parcelas</Label><Input aria-label="Quantidade de parcelas" type="number" min={1} max={36} value={quantidadeParcelas} onChange={evento => setQuantidadeParcelas(Math.max(1, Math.min(36, Number(evento.target.value) || 1)))} disabled={salvando} /></div></div>{formaPagamento === "CARTAO" ? <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Cartão</Label><SelecaoFormulario aria-label="Cartão" value={cartaoCreditoId} onValueChange={novoValor => setCartaoCreditoId(novoValor)} disabled={salvando}><option value="">Selecione o cartão</option>{cartoes.filter(item => item.ativo).map(item => <option key={item.id} value={item.id}>{item.nome} · {item.contaBancariaNome}</option>)}</SelecaoFormulario></div><div className="space-y-1.5"><Label>Data da compra</Label><Input aria-label="Data da compra" type="date" value={dataCompra} onChange={evento => setDataCompra(evento.target.value)} disabled={salvando} /></div><p className="text-xs text-muted-foreground sm:col-span-2">Vencimento calculado pela fatura. O dia do fechamento entra na próxima fatura; dias inexistentes usam o último dia do mês.</p></div> : <div className="space-y-1.5"><Label>Primeiro vencimento</Label><Input aria-label="Primeiro vencimento" type="date" value={dataVencimento} onChange={evento => setDataVencimento(evento.target.value)} disabled={salvando} /></div>}<div className="rounded-md border bg-muted/20 p-3 text-sm"><p className="font-medium">Parcelas previstas</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{parcelas.map(parcela => <div key={parcela.numero} className="flex justify-between gap-2"><span>{parcela.numero}/{quantidadeParcelas} · {parcela.dataVencimento ? dataBr(parcela.dataVencimento) : "Confira os dados"}</span><span className="tabular-nums">{formatarMoeda(parcela.valor)}</span></div>)}</div></div></section>}{nota.status === "PENDENTE" && <p className="rounded-md bg-muted p-3 text-sm">Aceite ou recuse a NFS-e antes de lançar a despesa.</p>}</div>}<DialogFooter className="sm:flex-wrap"><div className="flex min-w-64 flex-1 flex-wrap gap-2">{podeEditar && nota && <AcoesDecisao nota={nota} />}</div><Button type="button" variant="outline" className="w-32 justify-center" disabled={salvando} onClick={() => aoFechar(false)}>Fechar</Button>{podeLancarNota && <Button type="button" className="w-32 justify-center" disabled={salvando || !categoriaId || !descricao.trim() || parcelas.some(parcela => !parcela.dataVencimento)} onClick={() => void salvar()}>{salvando && <Loader2 className="size-4 animate-spin" />}Lançar despesa</Button>}</DialogFooter></DialogContent></Dialog>;
}

const FILTROS = [
  ["TODAS", "Todas"], ["PENDENTE", "Pendentes"], ["ACEITA", "Aceitas"], ["RECUSADA", "Recusadas"],
] as const;

export function ManifestoNfsView({ notas, categorias, cartoes, podeImportar, podeLancar, podeEditar }: {
  notas: Nota[]; categorias: Categoria[]; cartoes: CartaoOption[]; podeImportar: boolean; podeLancar: boolean; podeEditar: boolean;
}) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<string>("PENDENTE");
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState(periodoMesAteHoje);
  const selecionada = notas.find(nota => nota.id === selecionadaId) ?? null;
  const pendentes = notas.filter(nota => situacaoNfse(nota) === "PENDENTE").length;
  const porBuscaEPeriodo = notas.filter(nota => correspondeFiltroNfse(nota, { situacao: "TODAS", busca, ...periodo }));
  const filtradas = porBuscaEPeriodo.filter(nota => situacao === "TODAS" || situacaoNfse(nota) === situacao);
  return <>
    {!podeImportar && <p className="text-sm text-muted-foreground">Seu perfil pode consultar as NFS-e, mas não importar novos documentos.</p>}
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div><p className="text-sm font-medium">Total de notas pendentes</p><p className="text-xs text-muted-foreground">Em todas as notas recebidas, independentemente dos filtros.</p></div>
        <Badge variant="warning">{pendentes}</Badge>
      </div>
      <div className="space-y-3 border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <CampoBusca value={busca} onChange={setBusca} placeholder="Buscar por fornecedor, CNPJ ou chave de acesso..." aria-label="Buscar notas" containerClassName="w-full sm:w-96" />
          <FiltroOpcoesContadas nome="Situação das notas" valor={situacao} onValueChange={setSituacao} opcoes={FILTROS.map(([valor, nome]) => ({ valor, nome, quantidade: porBuscaEPeriodo.filter(nota => valor === "TODAS" || situacaoNfse(nota) === valor).length }))} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FiltroPeriodo de={periodo.de} ate={periodo.ate} aoAlterar={setPeriodo} />
          <ExportarXml {...periodo} disabled={Boolean(periodo.de && periodo.ate && periodo.de > periodo.ate)} />
        </div>
        <p className="text-xs text-muted-foreground">Período pela emissão. A exportação reúne os XMLs de todas as situações no período, independentemente da busca. Buscas automáticas desde 10/09/2026. Importações manuais podem incluir notas anteriores.</p>
      </div>
      <CardContent className="p-0">
        {filtradas.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
          <ReceiptText className="size-10 opacity-50" /><p>{notas.length ? "Nenhuma nota encontrada com estes filtros." : "Nenhuma NFS-e recebida ou importada manualmente."}</p>
        </div> : <Table><TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Valor</TableHead><TableHead>Emissão</TableHead><TableHead>Manifestação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filtradas.map(nota => <TableRow key={nota.id}><TableCell><div className="font-medium">{nota.fornecedorNome ?? nota.prestadorNome ?? "—"}</div><div className="text-xs text-muted-foreground">{documentoDaPessoa(nota.prestadorDados, nota.prestadorCnpj) ?? "—"}</div></TableCell><TableCell className="font-medium tabular-nums">{formatarMoeda(nota.valorLiquido || nota.valorServico)}</TableCell><TableCell>{dataBr(nota.dataEmissao)}</TableCell><TableCell><SituacaoNota nota={nota} /></TableCell><TableCell className="text-right"><Button type="button" size="sm" variant="outline" className="w-32 justify-center" onClick={() => setSelecionadaId(nota.id)}><FileText className="size-4" />Ver nota</Button></TableCell></TableRow>)}</TableBody></Table>}
      </CardContent>
    </Card>
    <VerNotaDialog key={selecionada?.id ?? "nenhuma"} nota={selecionada} categorias={categorias} cartoes={cartoes} podeLancar={podeLancar} podeEditar={podeEditar} aberto={Boolean(selecionada)} aoFechar={() => setSelecionadaId(null)} />
  </>;
}
