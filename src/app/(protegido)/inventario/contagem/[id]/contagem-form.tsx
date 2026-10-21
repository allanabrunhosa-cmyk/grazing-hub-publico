"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, Trash2, Printer } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { AcoesEdicao } from "@/components/padroes-operacionais";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TipoEstoqueBadge } from "@/components/tipo-estoque-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  salvarItemContagemAction,
  finalizarContagemAction,
  type ItemContagemParaFinalizar,
} from "@/app/(protegido)/inventario/contagem/actions";
import { tipoEstoqueLabels, unidadeMedidaLabels } from "@/lib/labels";
import type { ContagemDetalhe } from "@/app/(protegido)/inventario/types";
import { colunasContagem, ordenarItensContagem, type OrdenacaoContagem } from "../ordenacao";
import { imprimirContagem } from "../impressao";
import { ExcluirContagemDialog } from "../excluir-contagem-dialog";
import { ReferenciasConversao } from "@/components/referencias-conversao";

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

function converterQuantidade(valorTexto: string): number | null | undefined {
  const texto = valorTexto.trim();
  if (!texto) return null;
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(texto)) return undefined;
  const valor = Number(texto.replace(",", "."));
  return Number.isFinite(valor) && valor >= 0 && valor <= 999_999_999.999 ? valor : undefined;
}

export function ContagemForm({ contagem, administrador = false }: { contagem: ContagemDetalhe; administrador?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [somenteContados, setSomenteContados] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoContagem>({ coluna: "nome", direcao: "asc" });
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(contagem.itens.map((item) => [item.id, item.quantidadeContada != null ? String(item.quantidadeContada) : ""]))
  );
  const [confirmados, setConfirmados] = useState<Record<string, string>>(() => Object.fromEntries(contagem.itens.map(item => [item.id, item.quantidadeContada != null ? String(item.quantidadeContada) : ""])));
  const travas = useRef(new Set<string>());
  const [salvandoIds, setSalvandoIds] = useState<Set<string>>(new Set());
  const [errosIds, setErrosIds] = useState<Set<string>>(new Set());
  const [erroFinalizacao, setErroFinalizacao] = useState<string | null>(null);
  const [confirmarAberto, setConfirmarAberto] = useState(false);
  const [confirmarExclusaoAberto, setConfirmarExclusaoAberto] = useState(false);
  const [finalizando, startFinalizar] = useTransition();
  const chaveRascunho = `contagem-estoque:${contagem.id}`;

  useEffect(() => {
    let ativo = true;
    try {
      const salvo = sessionStorage.getItem(chaveRascunho);
      if (!salvo) return () => { ativo = false; };
      const rascunho = JSON.parse(salvo) as Record<string, unknown>;
      const idsValidos = new Set(contagem.itens.map((item) => item.id));
      const valoresValidos = Object.fromEntries(
        Object.entries(rascunho).filter(([id, valor]) => idsValidos.has(id) && typeof valor === "string"),
      ) as Record<string, string>;
      if (Object.keys(valoresValidos).length > 0) {
        queueMicrotask(() => {
          if (ativo) setValores((atuais) => ({ ...atuais, ...valoresValidos }));
        });
      }
    } catch {
      try { sessionStorage.removeItem(chaveRascunho); } catch { /* armazenamento indisponível */ }
    }
    return () => { ativo = false; };
  }, [chaveRascunho, contagem.itens]);

  function guardarRascunho(itemId: string, valor: string) {
    setValores((atuais) => ({ ...atuais, [itemId]: valor }));
    try {
      const salvo = sessionStorage.getItem(chaveRascunho);
      const rascunho = salvo ? JSON.parse(salvo) as Record<string, string> : {};
      sessionStorage.setItem(chaveRascunho, JSON.stringify({ ...rascunho, [itemId]: valor }));
    } catch {
      // A contagem continua preservada no estado da tela mesmo se o armazenamento do navegador estiver indisponível.
    }
    setErrosIds((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(itemId);
      return proximos;
    });
  }

  function removerDoRascunho(itemId: string) {
    try {
      const salvo = sessionStorage.getItem(chaveRascunho);
      if (!salvo) return;
      const rascunho = JSON.parse(salvo) as Record<string, string>;
      delete rascunho[itemId];
      if (Object.keys(rascunho).length === 0) sessionStorage.removeItem(chaveRascunho);
      else sessionStorage.setItem(chaveRascunho, JSON.stringify(rascunho));
    } catch {
      try { sessionStorage.removeItem(chaveRascunho); } catch { /* armazenamento indisponível */ }
    }
  }

  function limparRascunho() {
    try { sessionStorage.removeItem(chaveRascunho); } catch { /* armazenamento indisponível */ }
  }

  const porBusca = contagem.itens.filter(item => !query.trim() || normalizar([item.nome, item.especificacao ?? "", ...(item.marcas ?? []), ...item.fornecedores, item.tipoEstoque ? tipoEstoqueLabels[item.tipoEstoque] : ""].join(" ")).includes(normalizar(query.trim())));
  const contado = (item: (typeof contagem.itens)[number]) => contagem.status === "EM_ANDAMENTO" ? (valores[item.id] ?? "").trim() !== "" : item.contado;
  const quantidadeContados = porBusca.filter(item => contado(item) || editandoId === item.id).length;
  const itensFiltrados = ordenarItensContagem(porBusca.filter(item => !somenteContados || contado(item) || editandoId === item.id), ordenacao);
  const emAndamento = contagem.status === "EM_ANDAMENTO";
  const excluida = contagem.status === "EXCLUIDO";
  const colunas: OrdenacaoContagem["coluna"][] = ["nome", "marcas", "fornecedores", "tipoEstoque", "unidade",
    ...(emAndamento ? ["quantidadeContada" as const] : ["quantidadeSistema", "quantidadeContada", "diferenca", "ajustado"] as const)];

  function alternarOrdenacao(coluna: OrdenacaoContagem["coluna"]) {
    setOrdenacao((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === "asc" ? "desc" : "asc" }));
  }

  async function confirmarItem(itemId: string, valorTexto: string) {
    if (travas.current.has(itemId)) return;
    const valor = converterQuantidade(valorTexto);
    if (valor === undefined) {
      setErrosIds((atuais) => new Set(atuais).add(itemId));
      toast.error("Quantidade inválida.");
      return;
    }
    travas.current.add(itemId);
    setSalvandoIds((prev) => new Set(prev).add(itemId));
    try {
      const resultado = await salvarItemContagemAction(itemId, valor);
      if ("erro" in resultado) {
        setErrosIds((atuais) => new Set(atuais).add(itemId));
        toast.error(`${resultado.erro} O valor continua preenchido nesta tela.`);
        return;
      }
      setConfirmados(atuais => ({ ...atuais, [itemId]: valorTexto }));
      removerDoRascunho(itemId);
      setEditandoId(atual => atual === itemId ? null : atual);
      setErrosIds((atuais) => {
        const proximos = new Set(atuais);
        proximos.delete(itemId);
        return proximos;
      });
    } catch {
      setErrosIds((atuais) => new Set(atuais).add(itemId));
      toast.error("Não foi possível salvar agora. O valor continua preenchido nesta tela.");
    } finally {
      travas.current.delete(itemId);
      setSalvandoIds((prev) => {
        const proximo = new Set(prev);
        proximo.delete(itemId);
        return proximo;
      });
    }
  }

  function cancelarItem(itemId: string) {
    if (travas.current.has(itemId)) return;
    guardarRascunho(itemId, confirmados[itemId] ?? "");
    removerDoRascunho(itemId);
    setEditandoId(atual => atual === itemId ? null : atual);
  }

  function handleFinalizar() {
    const itensDaTela: ItemContagemParaFinalizar[] = [];
    for (const item of contagem.itens) {
      const quantidadeContada = converterQuantidade(valores[item.id] ?? "");
      if (quantidadeContada === undefined) {
        const mensagem = `Revise a quantidade informada para ${item.nome}.`;
        setErroFinalizacao(mensagem);
        setErrosIds((atuais) => new Set(atuais).add(item.id));
        toast.error(mensagem);
        return;
      }
      itensDaTela.push({ id: item.id, quantidadeContada });
    }

    setErroFinalizacao(null);
    startFinalizar(async () => {
      try {
        const resultado = await finalizarContagemAction(contagem.id, itensDaTela);
        if ("erro" in resultado) {
          setErroFinalizacao(`${resultado.erro} Os valores continuam preenchidos para uma nova tentativa.`);
          toast.error(resultado.erro);
          return;
        }
        limparRascunho();
        setConfirmarAberto(false);
        toast.success(resultado.ajustes > 0 ? `Contagem finalizada — ${resultado.ajustes} ajuste(s) aplicado(s).` : "Contagem finalizada — nenhum ajuste necessário.");
        router.refresh();
      } catch {
        const mensagem = "Não foi possível finalizar agora. Os valores continuam preenchidos para uma nova tentativa.";
        setErroFinalizacao(mensagem);
        toast.error(mensagem);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-1">
          <Button type="button" variant="outline" size="sm" nativeButton={false} render={<Link href="/inventario/contagem" />} className="gap-1.5">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
          <CampoBusca value={query} onChange={setQuery} placeholder="Buscar na contagem..." aria-label="Buscar na contagem"
            containerClassName="lg:min-w-40! lg:basis-44!" />
          <Button type="button" size="sm" variant={somenteContados ? "default" : "outline"}
            aria-pressed={somenteContados} onClick={() => setSomenteContados(atual => !atual)}>
            Contados ({quantidadeContados.toLocaleString("pt-BR")})
          </Button>
        </div>
        <Button type="button" variant="outline" disabled={itensFiltrados.length === 0} onClick={() => {
          if (!imprimirContagem(contagem, itensFiltrados, query)) toast.error("Permita abrir uma nova janela para imprimir a contagem.");
        }}>
          <Printer className="size-4" /> Imprimir contagem
        </Button>
        {(emAndamento || (administrador && contagem.status === "FINALIZADO")) && <Button type="button" variant="outline" onClick={() => setConfirmarExclusaoAberto(true)} className="text-destructive">
          <Trash2 className="size-4" /> Excluir contagem
        </Button>}
        {confirmarExclusaoAberto && <ExcluirContagemDialog contagem={contagem} aoFechar={() => setConfirmarExclusaoAberto(false)} aoExcluir={() => router.push("/inventario/contagem")} />}
        {emAndamento && (
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={confirmarAberto} onOpenChange={setConfirmarAberto}>
              <Button type="button" disabled={salvandoIds.size > 0} onClick={() => setConfirmarAberto(true)} className="gap-1.5">
                <CheckCircle2 className="size-4" />
                Finalizar contagem
              </Button>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Finalizar contagem?</DialogTitle>
                  <DialogDescription>
                    Itens não contados mantêm o saldo atual do sistema. Para os demais, qualquer diferença vira um
                    ajuste de estoque automático. Somente um administrador poderá cancelar a contagem e estornar esses ajustes.
                  </DialogDescription>
                </DialogHeader>
                {erroFinalizacao && <p role="alert" className="text-sm text-destructive">{erroFinalizacao}</p>}
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" disabled={finalizando} />}>Cancelar</DialogClose>
                  <Button type="button" disabled={finalizando} onClick={handleFinalizar}>
                    {finalizando && <Loader2 className="size-4 animate-spin" />}
                    Sim, finalizar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {excluida && (
        <div className="rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {contagem.exclusao?.ajustesEstornados
            ? "Contagem cancelada após a finalização. Os ajustes originais foram estornados; o histórico foi preservado."
            : "Esta contagem foi excluída antes de ser finalizada — nenhum ajuste de estoque foi aplicado."}
          {contagem.exclusao && <div className="mt-2 space-y-1">
            <p><strong>{contagem.exclusao.autor}</strong> · {new Date(contagem.exclusao.data).toLocaleString("pt-BR")}</p>
            {contagem.exclusao.motivo && <p className="whitespace-pre-wrap break-words">Motivo: {contagem.exclusao.motivo}</p>}
          </div>}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {itensFiltrados.length} de {contagem.itens.length} itens · Clique nos títulos para ordenar esta tela. A impressão respeita a busca e ordena por tipo de estoque, fornecedor e insumo, com campos em branco para contagem manual.
      </p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {colunas.map((coluna) => (
                  <SortableTableHead key={coluna} className="whitespace-normal" active={ordenacao.coluna === coluna} direction={ordenacao.direcao}
                    aria-sort={ordenacao.coluna === coluna ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"}
                    onClick={() => alternarOrdenacao(coluna)}>{colunasContagem[coluna]}</SortableTableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensFiltrados.length === 0 && <TableRow><TableCell colSpan={colunas.length} className="py-10 text-center text-muted-foreground">Nenhum item encontrado.</TableCell></TableRow>}
              {itensFiltrados.map((item) => {
                if (emAndamento) {
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal break-words">
                        <IdentificacaoInsumo nome={item.nome} especificacao={item.especificacao} nomeClassName="font-medium" />
                        <ReferenciasConversao conversoes={item.conversoes} unidade={item.unidade} />
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal">{item.marcas?.join(", ") || "Não informado"}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal">{item.fornecedores.join(", ") || "Não informado"}</TableCell>
                      <TableCell>{item.tipoEstoque ? <TipoEstoqueBadge tipo={item.tipoEstoque} /> : "Não informado"}</TableCell>
                      <TableCell className="whitespace-normal">{unidadeMedidaLabels[item.unidade]}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            value={valores[item.id] ?? ""}
                            onFocus={() => setEditandoId(item.id)}
                            onChange={(e) => guardarRascunho(item.id, e.target.value)}
                            disabled={salvandoIds.has(item.id) || finalizando}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void confirmarItem(item.id, valores[item.id] ?? ""); } if (e.key === "Escape") { e.preventDefault(); cancelarItem(item.id); } }}
                            placeholder="Contar..."
                            aria-label={`Quantidade contada de ${item.nome}`}
                            inputMode="decimal"
                            className="w-32"
                          />
                          <AcoesEdicao nome={`contagem de ${item.nome}`} alterado={(valores[item.id] ?? "") !== (confirmados[item.id] ?? "")} salvando={salvandoIds.has(item.id)} invalido={finalizando} confirmar={() => void confirmarItem(item.id, valores[item.id] ?? "")} cancelar={() => cancelarItem(item.id)} />
                          {errosIds.has(item.id) && <span role="alert" className="text-xs text-destructive">Não salvo</span>}
                        </div>
                        <ReferenciasConversao conversoes={item.conversoes} unidade={item.unidade} quantidade={valores[item.id] ?? ""} />
                      </TableCell>
                    </TableRow>
                  );
                }

                const diferenca = item.contado && item.quantidadeSistema != null ? (item.quantidadeContada ?? 0) - item.quantidadeSistema : null;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal break-words">
                      <IdentificacaoInsumo nome={item.nome} especificacao={item.especificacao} nomeClassName="font-medium" />
                      <ReferenciasConversao conversoes={item.conversoes} unidade={item.unidade} />
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal">{item.marcas?.join(", ") || "Não informado"}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal">{item.fornecedores.join(", ") || "Não informado"}</TableCell>
                    <TableCell>{item.tipoEstoque ? <TipoEstoqueBadge tipo={item.tipoEstoque} /> : "Não informado"}</TableCell>
                    <TableCell className="whitespace-normal">{unidadeMedidaLabels[item.unidade]}</TableCell>
                    <TableCell>{item.quantidadeSistema ?? "—"}</TableCell>
                    <TableCell>{item.contado ? item.quantidadeContada : <span className="text-muted-foreground">Não contado</span>}</TableCell>
                    <TableCell>
                      {diferenca == null ? (
                        "—"
                      ) : (
                        <span className={diferenca === 0 ? "text-muted-foreground" : diferenca > 0 ? "text-emerald-600" : "text-destructive"}>
                          {diferenca > 0 ? "+" : ""}
                          {diferenca}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.ajustado ? <Badge variant={contagem.exclusao?.ajustesEstornados ? "muted" : "default"}>{contagem.exclusao?.ajustesEstornados ? "Estornado" : "Sim"}</Badge> : <Badge variant="secondary">Não</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
