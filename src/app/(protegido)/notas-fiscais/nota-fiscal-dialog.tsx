"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldX, X } from "lucide-react";
import { BadgeNota as Badge } from "./badge-nota";
import { Button } from "@/components/ui/button";
import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
import { aceitarNotaAction } from "./aceitar-nota";
import { importarXmlPelaApi } from "@/lib/notas-fiscais/api-cliente";
import { ParcelasNota, type DuplicataLinha } from "./parcelas-nota";
import type { CartaoOption } from "@/lib/financeiro/cartoes";
import { CampoMonetario } from "./campo-monetario";
import { ResumoCustosNota, ComposicaoCustoItem } from "./custos-nota";
import { calcularCustosNota, centavos, totalCustoItem, type CustosNotaFiscal, type ModoDescontoNota, type DistribuicaoDesconto, type ComposicaoCusto } from "@/lib/notas-fiscais/custos";
import { EntradaEstoqueNota } from "./entrada-estoque-nota";
import { validarDataEntradaEstoque } from "@/lib/notas-fiscais/data-entrada";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReversaoCompraAviso } from "@/components/financeiro/reversao-compra-aviso";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InsumoCombobox } from "@/app/(protegido)/inventario/insumo-combobox";
import { InsumoDialog } from "@/app/(protegido)/insumos/insumo-dialog";
import {
  obterItensNotaFiscalAction,
  obterInsumoOptionAction,
  obterResumoCancelamentoNotaAction,
  manifestarAction,
  type ItemConciliacaoInput,
  type DuplicataInput,
} from "@/app/(protegido)/notas-fiscais/actions";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { mostrarErroPaginaDesatualizada } from "@/lib/erro-acao-cliente";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import { ComparativoCusto } from "./comparativo-custo";
import { ConciliacaoFornecedor } from "./conciliacao-fornecedor";
import {
  categoriaDaNota,
  categoriaNotaLabels,
  CATEGORIA_BADGE_VARIANT,
  type ItemConciliacaoRow,
  type LocalOption,
  type NotaFiscalRow,
  type StatusConciliacaoItem,
  type DestinoItemNota,
  type DetalhesFiscaisRow,
  type TipoManifestacao,
} from "@/app/(protegido)/notas-fiscais/types";
import type { InsumoOption } from "@/app/(protegido)/inventario/types";
import type { SimpleOption, FornecedorOption, InsumoOption as InsumoOptionCadastro } from "@/app/(protegido)/insumos/types";
import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

type LinhaConciliacao = {
  destino: DestinoItemNota;
  insumoId: string | null;
  quantidade: string;
  taxaConversao: string;
  categoriaFinanceiraId: string | null;
  valorTotal: string;
};



type EtapaManifestacao =
  | { nome: "escolher" }
  | { nome: "aceitar" }
  | { nome: "recusar" };

type MotivoRecusa = "DESCONHECIMENTO_DA_OPERACAO" | "OPERACAO_NAO_REALIZADA";

const STATUS_BADGE_VARIANT: Record<StatusConciliacaoItem, "warning" | "success" | "muted"> = {
  PENDENTE: "warning",
  CONCILIADO: "success",
  IGNORADO: "muted",
};

const STATUS_LABEL: Record<StatusConciliacaoItem, string> = {
  PENDENTE: "Pendente",
  CONCILIADO: "Conciliado",
  IGNORADO: "Ignorado",
};

function paraNumero(valor: string): number {
  return Number.parseFloat(valor.replace(",", "."));
}

function formatarDataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

export function NotaFiscalDialog({
  nota,
  locais,
  insumos,
  categoriasInsumo,
  centrosCustoInsumo,
  fornecedoresInsumo,
  todosInsumosCadastro,
  categoriasFinanceiras,
  trigger,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
}: {
  nota: NotaFiscalRow;
  locais: LocalOption[];
  insumos: InsumoOption[];
  categoriasInsumo: SimpleOption[];
  centrosCustoInsumo: SimpleOption[];
  fornecedoresInsumo: FornecedorOption[];
  todosInsumosCadastro: InsumoOptionCadastro[];
  categoriasFinanceiras: CategoriaOption[];
  trigger: ReactElement;
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [itens, setItens] = useState<ItemConciliacaoRow[] | null>(null);
  const [cartoes, setCartoes] = useState<CartaoOption[]>([]);
  const [duplicatas, setDuplicatas] = useState<DuplicataLinha[]>([]);
  const [detalhes, setDetalhes] = useState<DetalhesFiscaisRow | null>(null);
  const [custos, setCustos] = useState<CustosNotaFiscal | null>(null);
  const [modoDesconto, setModoDesconto] = useState<ModoDescontoNota>("NOTA");
  const [descontos, setDescontos] = useState<Record<number, string>>({});
  const [localId, setLocalId] = useState(locais[0]?.id ?? "");
  const [dataEntradaEstoque, setDataEntradaEstoque] = useState("");
  const [linhas, setLinhas] = useState<Record<string, LinhaConciliacao>>({});
  const [insumosExtras, setInsumosExtras] = useState<InsumoOption[]>([]);
  const [carregando, startCarregamento] = useTransition();
  const [importando, iniciarImportacao] = useTransition();

  function importarXml(arquivo?: File) {
    if (!arquivo) return;
    if (arquivo.size > 800 * 1024) { toast.error("Selecione um XML de até 800 KB."); return; }
    iniciarImportacao(async () => {
      try {
        const formulario = new FormData();
        formulario.set("arquivo", arquivo);
        const resultado = await importarXmlPelaApi(formulario, nota.id);
        if ("erro" in resultado) { toast.error(resultado.erro); return; }
        toast.success("XML importado. Abra a nota para conferir os itens.");
        setItens(null);
        setOpen(false);
        router.refresh();
      } catch (erro) {
        if (!mostrarErroPaginaDesatualizada(erro)) {
          toast.error("Não foi possível importar o XML.", { description: "Verifique sua conexão e tente novamente." });
        }
      }
    });
  }

  const [etapaManifestacao, setEtapaManifestacao] = useState<EtapaManifestacao>({ nome: "escolher" });
  const [justificativa, setJustificativa] = useState("");
  const [motivoRecusa, setMotivoRecusa] = useState<MotivoRecusa | null>(null);
  const [mostrarCamposInvalidos, setMostrarCamposInvalidos] = useState(false);
  const [previaRecusa, setPreviaRecusa] = useState<import("@/lib/financeiro/cancelamento-compra-tipos").ResumoCancelamentoCompra | null>(null);
  const [motivoReversao, setMotivoReversao] = useState("");
  const [erroRecusa, setErroRecusa] = useState("");
  const [conferindoRecusa, iniciarConferenciaRecusa] = useTransition();
  const [pendingManifestacao, startManifestacao] = useTransition();
  const [overrideSecaoManifestacao, setOverrideSecaoManifestacao] = useState<boolean | null>(null);

  const insumosDisponiveis = [...insumos, ...insumosExtras];
  const ultimaCiencia = nota.manifestacoes.find((manifestacao) => manifestacao.tipo === "CIENCIA_DA_OPERACAO");
  const secaoAberta = overrideSecaoManifestacao ?? (categoriaDaNota(nota.ultimaManifestacao) === "PENDENTE" || !!itens?.some((item) => item.status === "PENDENTE"));

  function resetarManifestacao() {
    setEtapaManifestacao({ nome: "escolher" });
    setJustificativa("");
    setMotivoRecusa(null);
    setMostrarCamposInvalidos(false);
  }

  function enviarManifestacao(tipo: TipoManifestacao, justificativaTexto?: string) {
    startManifestacao(async () => {
      try {
        const resultado = previaRecusa && !previaRecusa.cancelada
          ? await manifestarAction(nota.chaveAcesso, tipo, justificativaTexto, { token: previaRecusa.token, motivo: motivoReversao.trim() })
          : await manifestarAction(nota.chaveAcesso, tipo, justificativaTexto);
        if (resultado.sucesso) {
          toast.success(`Manifestação enviada: ${resultado.mensagem}`);
          setOpen(false);
          resetarManifestacao();
        } else {
          toast.error(resultado.mensagem);
        }
      } catch (erro) {
        if (!mostrarErroPaginaDesatualizada(erro)) {
          toast.error("Não foi possível confirmar o envio. Confira o status da nota antes de tentar novamente.");
        }
      }
    });
  }

  const justificativaValida = justificativa.trim().length >= 15 && justificativa.trim().length <= 255;
  const podeRecusar = !conferindoRecusa && !erroRecusa && motivoRecusa !== null && (motivoRecusa !== "OPERACAO_NAO_REALIZADA" || justificativaValida)
    && (!previaRecusa || previaRecusa.cancelada || (motivoReversao.trim().length >= 15 && motivoReversao.trim().length <= 255));

  function prepararRecusa() {
    setPreviaRecusa(null); setMotivoReversao(""); setErroRecusa("");
    setEtapaManifestacao({ nome: "recusar" });
    iniciarConferenciaRecusa(async () => {
      try {
        const resultado = await obterResumoCancelamentoNotaAction(nota.id);
        if ("erro" in resultado) setErroRecusa(resultado.erro);
        else setPreviaRecusa(resultado.resumo);
      } catch { setErroRecusa("Não foi possível conferir os itens. Reabra a confirmação."); }
    });
  }

  function alternarAbertura(aberto: boolean) {
    if (pendingManifestacao || importando || salvandoFornecedor) return;
    setOpen(aberto);
    if (!aberto) {
      resetarManifestacao();
      setItens(null);
      return;
    }
    setDataEntradaEstoque("");
    if (!nota.temXmlCompleto || itens !== null) return;
    startCarregamento(async () => {
      let resultado: Awaited<ReturnType<typeof obterItensNotaFiscalAction>>;
      try {
        resultado = await obterItensNotaFiscalAction(nota.id);
      } catch (erro) {
        if (!mostrarErroPaginaDesatualizada(erro)) {
          toast.error("Não foi possível carregar os itens da nota.", { description: "Verifique sua conexão, feche o painel e tente novamente." });
        }
        return;
      }
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      setItens(resultado.itens);
      setCustos(resultado.custos ?? null);
      setModoDesconto(resultado.itens.find(item => item.composicaoCusto)?.composicaoCusto?.modoDesconto ?? "NOTA");
      setDescontos(Object.fromEntries((resultado.custos?.itens ?? []).map(custo => [custo.numeroItem,
        (resultado.itens.find(item => item.numeroItem === custo.numeroItem)?.composicaoCusto?.desconto ?? custo.desconto).toFixed(2)])));
      setDetalhes(resultado.detalhes);
      setCartoes(resultado.cartoes ?? []);
      setDuplicatas(
        resultado.duplicatas.map((d) => ({ ...d, formaPagamento: d.formaPagamento ?? "BOLETO", valor: d.valor.toFixed(2) }))
      );
      const iniciais: Record<string, LinhaConciliacao> = {};
      for (const item of resultado.itens) {
        iniciais[item.id] = {
          destino: item.destino,
          insumoId: item.insumoId,
          quantidade: String(Math.round(item.quantidadeComercial * (item.fatorConversao ?? 1) * 1000) / 1000),
          taxaConversao: String(item.fatorConversao ?? 1),
          categoriaFinanceiraId: item.categoriaFinanceiraId,
          valorTotal: item.valorTotalItem.toFixed(2),
        };
      }
      setLinhas(iniciais);
    });
  }

  function atualizarLinha(itemId: string, dados: Partial<LinhaConciliacao>) {
    setLinhas((atual) => ({ ...atual, [itemId]: { ...atual[itemId], ...dados } }));
  }

  function atualizarTaxaConversao(item: ItemConciliacaoRow, taxaConversao: string) {
    const taxa = paraNumero(taxaConversao);
    const dados: Partial<LinhaConciliacao> = { taxaConversao };
    if (Number.isFinite(taxa) && taxa > 0) {
      dados.quantidade = String(Math.round(item.quantidadeComercial * taxa * 1000) / 1000);
    }
    atualizarLinha(item.id, dados);
  }

  async function aoCriarInsumo(itemId: string, insumoId?: string) {
    if (!insumoId) return;
    const info = await obterInsumoOptionAction(insumoId);
    if (info) {
      setInsumosExtras((atual) => [...atual, { ...info, custoMedio: 0 }]);
    }
    atualizarLinha(itemId, { insumoId });
  }

  const distribuicaoDesconto: DistribuicaoDesconto = { modo: modoDesconto,
    itens: (custos?.itens ?? []).map(item => ({ numeroItem: item.numeroItem, desconto: paraNumero(descontos[item.numeroItem] ?? "0") || 0 })) };
  const calculoCustos = custos ? calcularCustosNota(custos, distribuicaoDesconto) : null;
  const erroCustos = calculoCustos && "erro" in calculoCustos ? calculoCustos.erro
    : calculoCustos && custos && centavos(calculoCustos.total) !== centavos(custos.totalNota)
      ? "A composição dos produtos difere do total da nota. Confira o XML antes do aceite." : null;
  function composicaoParaItem(item: ItemConciliacaoRow): ComposicaoCusto | null {
    if (item.status !== "PENDENTE") return item.composicaoCusto ?? null;
    if (calculoCustos && "itens" in calculoCustos) return calculoCustos.itens.find(custo => custo.numeroItem === item.numeroItem) ?? null;
    const original = custos?.itens.find(custo => custo.numeroItem === item.numeroItem);
    if (!original) return null;
    const desconto = modoDesconto === "PERSONALIZADO" ? paraNumero(descontos[item.numeroItem] ?? "0") || 0 : original.desconto;
    const custo = { ...original, desconto };
    return { ...custo, modoDesconto, total: totalCustoItem(custo) };
  }
  function totalParaItem(item: ItemConciliacaoRow): number {
    return composicaoParaItem(item)?.total ?? paraNumero(linhas[item.id]?.valorTotal ?? "");
  }
  function mudarModoDesconto(modo: ModoDescontoNota) {
    if (modo === "PERSONALIZADO" && calculoCustos && "itens" in calculoCustos) {
      setDescontos(Object.fromEntries(calculoCustos.itens.map(item => [item.numeroItem, item.desconto.toFixed(2)])));
    }
    setModoDesconto(modo);
  }
  const itensPendentes = (itens ?? []).filter((i) => i.status === "PENDENTE");
  const haAlgoAConciliar = itensPendentes.length > 0;
  const haItemEstoque = itensPendentes.some((i) => linhas[i.id]?.destino === "ESTOQUE");

  const somaDuplicatas = duplicatas.reduce((acc, d) => acc + (paraNumero(d.valor) || 0), 0);
  const duplicatasValidas = duplicatas.filter((d) => {
    const dadosBasicosValidos = d.numero.trim() !== "" && d.dataVencimento !== "" && Number.isFinite(paraNumero(d.valor)) && paraNumero(d.valor) > 0;
    if (!dadosBasicosValidos || d.formaPagamento !== "CARTAO") return dadosBasicosValidos;
    return !!d.cartaoCreditoId && !!d.dataCompra && Number.isInteger(d.parcelaCartao ?? 1) && (d.parcelaCartao ?? 1) > 0;
  });

  const podeConfirmar =
    !erroCustos && nota.temXmlCompleto && itens !== null && itens.length > 0 &&
    (!haAlgoAConciliar || (!haItemEstoque || (!!localId && "data" in validarDataEntradaEstoque(dataEntradaEstoque)))) &&
    (!haAlgoAConciliar || (duplicatasValidas.length > 0 && duplicatasValidas.length === duplicatas.length)) &&
    itensPendentes.every((item) => {
      const linha = linhas[item.id];
      if (!linha) return false;
      const valorTotal = totalParaItem(item);
      if (!Number.isFinite(valorTotal) || valorTotal < 0) return false;
      if (linha.destino === "ESTOQUE") {
        const quantidade = paraNumero(linha.quantidade);
        const fatorConversao = paraNumero(linha.taxaConversao);
        return !!linha.insumoId && Number.isFinite(quantidade) && quantidade > 0 && Number.isFinite(fatorConversao) && fatorConversao > 0;
      }
      return !!linha.categoriaFinanceiraId;
    });

  function confirmarAceite() {
    if (!podeConfirmar || salvandoFornecedor) {
      setMostrarCamposInvalidos(true);
      return;
    }
    startManifestacao(async () => {
      try {
        const itensInput: ItemConciliacaoInput[] = itensPendentes.map((item) => {
          const linha = linhas[item.id];
          if (linha.destino === "ESTOQUE") {
            return {
              notaFiscalItemId: item.id,
              acao: "CONCILIAR",
              destino: "ESTOQUE",
              insumoId: linha.insumoId!,
              quantidade: paraNumero(linha.quantidade),
              fatorConversao: paraNumero(linha.taxaConversao),
              valorTotal: totalParaItem(item),
              modoCusto: "MEDIA",
            };
          }
          return {
            notaFiscalItemId: item.id,
            acao: "CONCILIAR",
            destino: "USO_E_CONSUMO",
            categoriaFinanceiraId: linha.categoriaFinanceiraId!,
            valorTotal: totalParaItem(item),
          };
        });
        const duplicatasInput: DuplicataInput[] = duplicatasValidas.map((d) => ({
          formaPagamento: d.formaPagamento, cartaoCreditoId: d.cartaoCreditoId, dataCompra: d.dataCompra, parcelaCartao: d.parcelaCartao,
          id: d.id,
          numero: d.numero,
          dataVencimento: d.dataVencimento,
          valor: paraNumero(d.valor),
        }));
        const resultado = await aceitarNotaAction({
          notaFiscalId: nota.id,
          localId,
          dataEntradaEstoque: haItemEstoque ? dataEntradaEstoque : undefined,
          itens: itensInput,
          duplicatas: duplicatasInput,
          ...(custos ? { distribuicaoDesconto } : {}),
        });
        if ("erro" in resultado) {
          toast.error(resultado.erro);
          return;
        }
        toast.success("Nota aceita — conciliação concluída, estoque e financeiro atualizados.");
        resetarManifestacao();
        setOpen(false);
        setItens(null); // força reler na próxima abertura, já refletindo os status atualizados
      } catch (erro) {
        if (!mostrarErroPaginaDesatualizada(erro)) {
          toast.error("Não foi possível concluir o aceite. Confira o status da nota antes de tentar novamente.");
        }
      }
    });
  }

  const categoriaAtual = categoriaDaNota(nota.ultimaManifestacao);

  return (
    <Dialog open={open} onOpenChange={alternarAbertura}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" showCloseButton={false}>
        <DialogHeader className="pr-14">
          <DialogTitle>Nota fiscal</DialogTitle>
          <DialogDescription>
            {nota.fornecedorNome ?? "Fornecedor não identificado"} — chave {nota.chaveAcesso}
          </DialogDescription>
        </DialogHeader>
        <DialogClose
          aria-label="Fechar nota"
          title="Fechar nota (Esc)"
          render={<Button type="button" variant="outline" size="icon" className="absolute top-4 right-4 z-10 size-10 border-border bg-background shadow-md ring-1 ring-foreground/5 hover:shadow-lg" disabled={pendingManifestacao || importando || salvandoFornecedor} />}
        >
          <X className="size-5" strokeWidth={2.5} />
        </DialogClose>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Manifestação:</span>
            <Badge variant={CATEGORIA_BADGE_VARIANT[categoriaAtual]}>{categoriaNotaLabels[categoriaAtual]}</Badge>
            {nota.ultimaManifestacao === "CIENCIA_DA_OPERACAO" && (
              <span className="text-xs text-muted-foreground">(Ciência já registrada)</span>
            )}
          </div>

        </div>

        <fieldset disabled={pendingManifestacao || importando || salvandoFornecedor} className="min-w-0">
        {!nota.temXmlCompleto ? (
          <div className="space-y-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Aguardando XML completo</p>
            <p>A SEFAZ enviou apenas o resumo desta nota. Ao usar Buscar novas notas, o sistema registra
              Ciência automaticamente quando necessário e recebe os XMLs liberados, respeitando o intervalo de consulta.
              A Ciência mantém o aceite da nota pendente.</p>
            <p>Você também pode importar o XML do fornecedor para preencher todos os itens antes do aceite.
              A recusa continua disponível abaixo.</p>
            {ultimaCiencia && !ultimaCiencia.sucesso && nota.ultimaManifestacao === null && (
              <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                A última tentativa de Ciência não foi registrada: {ultimaCiencia.xMotivo ?? "não foi possível confirmar o envio"}.
                {" "}O sistema tenta novamente na próxima busca permitida.
              </p>
            )}
            <Label htmlFor={`xml-${nota.id}`}>Importar XML do fornecedor (até 800 KB)</Label>
            <Input id={`xml-${nota.id}`} type="file" accept=".xml,text/xml,application/xml" disabled={importando}
              onChange={(evento) => { importarXml(evento.target.files?.[0]); evento.target.value = ""; }} />
            {importando && <p role="status">Importando XML...</p>}
          </div>
        ) : carregando || itens === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando itens da nota...
          </div>
        ) : (
          <div className="space-y-5">
            {detalhes && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{detalhes.emitenteNome ?? nota.fornecedorNome ?? "Emitente"}</p>
                  {detalhes.fornecedorCadastrado ? (
                    <Badge variant="success">Fornecedor cadastrado: {detalhes.fornecedorCadastrado.nome}</Badge>
                  ) : (
                    <Badge variant="muted">Fornecedor não cadastrado</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-4">
                  <span>Natureza: {detalhes.naturezaOperacao ?? "—"}</span>
                  <span>Valor: {nota.valorTotal != null ? formatarMoeda(nota.valorTotal) : "—"}</span>
                  <span>Emissão: {formatarDataCurta(nota.dataEmissao)}</span>
                  <span className="truncate" title={nota.chaveAcesso}>
                    Chave: {nota.chaveAcesso}
                  </span>
                  <span>Série: {detalhes.serie ?? "—"}</span>
                  <span>Número: {detalhes.numero ?? "—"}</span>
                  <span>Modelo: {detalhes.modelo ?? "—"}</span>
                  <span>Código único: {detalhes.codigoUnico ?? "—"}</span>
                  <span>Versão: {detalhes.versao ?? "—"}</span>
                  <span className="sm:col-span-2">
                    Endereço:{" "}
                    {[detalhes.emitenteEndereco.logradouro, detalhes.emitenteEndereco.numero, detalhes.emitenteEndereco.bairro]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                  <span>
                    {detalhes.emitenteEndereco.municipio ?? "—"}
                    {detalhes.emitenteEndereco.uf ? `/${detalhes.emitenteEndereco.uf}` : ""}
                  </span>
                </div>
              </div>
            )}

            <ConciliacaoFornecedor notaId={nota.id} fornecedor={detalhes?.fornecedorCadastrado ?? null}
              bloqueado={pendingManifestacao || importando} onOcupado={setSalvandoFornecedor}
              podeCadastrarFornecedor={podeCadastrarFornecedor}
              onConciliado={fornecedor => setDetalhes(atual => atual ? { ...atual, fornecedorCadastrado: fornecedor } : atual)} />

            {custos && <ResumoCustosNota custos={custos} modo={modoDesconto} aoMudarModo={mudarModoDesconto}
              bloqueado={pendingManifestacao || itens.some(item => item.status !== "PENDENTE")}
              descontoDistribuido={distribuicaoDesconto.itens.reduce((soma, item) => soma + item.desconto, 0)} erro={erroCustos} />}
            <ParcelasNota parcelas={duplicatas} cartoes={cartoes} dataEmissao={nota.dataEmissao ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nota.dataEmissao)) : ""} bloqueado={pendingManifestacao || importando || salvandoFornecedor} mostrarErros={mostrarCamposInvalidos} onChange={setDuplicatas} />
            {duplicatas.length > 0 && nota.valorTotal != null && Math.abs(somaDuplicatas - nota.valorTotal) > 0.01 && <p className="text-xs text-amber-600">Soma das parcelas ({formatarMoeda(somaDuplicatas)}) diferente do valor da nota ({formatarMoeda(nota.valorTotal)}).</p>}

            {haItemEstoque && <EntradaEstoqueNota locais={locais} localId={localId} onLocalChange={setLocalId}
              dataEntrada={dataEntradaEstoque} onDataChange={setDataEntradaEstoque} bloqueado={pendingManifestacao || salvandoFornecedor} mostrarErros={mostrarCamposInvalidos} />}
            <div className="space-y-3">
              {itens.map((item) => {
                const linha = linhas[item.id];
                const processado = item.status !== "PENDENTE";
                const composicao = composicaoParaItem(item);
                const valorUnitarioNota = item.valorUnitarioComercial ?? (item.quantidadeComercial > 0 ? item.valorTotalItem / item.quantidadeComercial : null);
                const observacaoUnitaria = valorUnitarioNota != null && Number.isFinite(valorUnitarioNota)
                  ? `Valor unitário na nota: ${valorUnitarioNota.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 })} por ${item.unidadeComercial}` : null;
                const quantidadeKgNoXml = item.unidadeTributavel?.trim().toUpperCase() === "KG" &&
                  item.quantidadeTributavel != null && Number.isFinite(item.quantidadeTributavel)
                    ? item.quantidadeTributavel
                    : null;
                const mostrarPesoKg = quantidadeKgNoXml != null &&
                  (item.unidadeComercial.trim().toUpperCase() !== "KG" || Math.abs(item.quantidadeComercial - quantidadeKgNoXml) > 0.0001);

                if (processado) {
                  const insumoConciliado = insumosDisponiveis.find(i => i.id === item.insumoId);
                  return (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                      <div>
                        <p className="font-medium">{item.descricaoProduto}</p>
                        {observacaoUnitaria && <p className="text-xs text-muted-foreground">{observacaoUnitaria}</p>}
                        {mostrarPesoKg && (
                          <p className="text-xs font-medium text-foreground">
                            Peso informado no XML: {quantidadeKgNoXml.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} kg
                          </p>
                        )}
                        {item.status === "CONCILIADO" && item.destino === "ESTOQUE" && item.insumoNome ? (
                          <div className="text-xs">
                            <IdentificacaoInsumo nome={item.insumoNome} especificacao={item.insumoEspecificacao} nomeClassName="font-medium text-foreground" />
                            <span className="text-muted-foreground">{formatarMoeda(item.valorTotalConciliado ?? 0)}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {item.status === "CONCILIADO"
                              ? `Uso e consumo: ${item.categoriaFinanceiraNome} — ${formatarMoeda(item.valorTotalConciliado ?? 0)}`
                              : "Marcado como ignorado"}
                          </p>
                        )}
                      </div>
                      {composicao && <div className="w-full"><ComposicaoCustoItem custo={composicao} descricao={item.descricaoProduto}
                        desconto={composicao.desconto.toFixed(2)} aoMudarDesconto={() => {}} personalizado={false} bloqueado /></div>}
                      {item.status === "CONCILIADO" && item.destino === "ESTOQUE" && <p className="text-xs font-medium">
                        Entrada no estoque: {formatarDataCurta(item.dataEntradaEstoque ?? null)}
                      </p>}
                      <Badge variant={STATUS_BADGE_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      {item.status === "CONCILIADO" && item.destino === "ESTOQUE" && insumoConciliado?.custoMedio !== undefined && <div className="w-full"><ComparativoCusto custoMedio={insumoConciliado.custoMedio}
                        quantidade={item.quantidadeConciliada ?? 0} valorTotal={item.valorTotalConciliado ?? 0} unidade={unidadeMedidaAbreviada[insumoConciliado.unidade]} /></div>}
                    </div>
                  );
                }

                const insumoSelecionado = insumosDisponiveis.find((i) => i.id === linha?.insumoId);
                const quantidadeConvertida = paraNumero(linha?.quantidade ?? "");
                const totalConvertido = totalParaItem(item);
                const fatorConversao = paraNumero(linha?.taxaConversao ?? "");
                const insumoInvalido = mostrarCamposInvalidos && linha?.destino === "ESTOQUE" && !linha?.insumoId;
                const conversaoInvalida = mostrarCamposInvalidos && linha?.destino === "ESTOQUE" && (!Number.isFinite(fatorConversao) || fatorConversao <= 0);
                const quantidadeInvalida = mostrarCamposInvalidos && linha?.destino === "ESTOQUE" && (!Number.isFinite(quantidadeConvertida) || quantidadeConvertida <= 0);
                const categoriaInvalida = mostrarCamposInvalidos && linha?.destino === "USO_E_CONSUMO" && !linha?.categoriaFinanceiraId;
                const valorTotalInvalido = mostrarCamposInvalidos && (!Number.isFinite(totalConvertido) || totalConvertido < 0);

                return (
                  <div key={item.id} className="space-y-2.5 rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.descricaoProduto}</p>
                        <p className="text-xs text-muted-foreground">
                          Cód. {item.codigoProdutoFornecedor} · {item.quantidadeComercial} {item.unidadeComercial} ·{" "}
                          {formatarMoeda(item.valorTotalItem)}
                          {item.ncm && ` · NCM ${item.ncm}`}
                        </p>
                        {mostrarPesoKg && (
                          <p className="mt-1 text-xs font-medium text-foreground">
                            Peso informado no XML: {quantidadeKgNoXml.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} kg
                          </p>
                        )}
                        {observacaoUnitaria && <p className="mt-1 text-xs text-muted-foreground">{observacaoUnitaria}</p>}
                      </div>

                    </div>

                    {composicao && <ComposicaoCustoItem custo={composicao} descricao={item.descricaoProduto}
                      desconto={descontos[item.numeroItem] ?? "0.00"} aoMudarDesconto={valor => setDescontos(atual => ({ ...atual, [item.numeroItem]: valor }))}
                      personalizado={modoDesconto === "PERSONALIZADO"} bloqueado={pendingManifestacao} />}
                    {(
                      <div className="space-y-2.5">
                        <div className="grid max-w-xs grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={linha?.destino === "ESTOQUE" ? "default" : "outline"}
                            onClick={() => atualizarLinha(item.id, { destino: "ESTOQUE" })}
                          >
                            Estoque
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={linha?.destino === "USO_E_CONSUMO" ? "default" : "outline"}
                            onClick={() => atualizarLinha(item.id, { destino: "USO_E_CONSUMO" })}
                          >
                            Uso e consumo
                          </Button>
                        </div>

                        {linha?.destino === "ESTOQUE" ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[14rem] flex-1 space-y-1 [&_[data-slot=combobox-input]]:h-11">
                              <Label className="text-xs">Insumo</Label>
                              <InsumoCombobox
                                insumos={insumosDisponiveis}
                                value={linha?.insumoId ?? null}
                                invalido={insumoInvalido}
                                onChange={(insumoId) => {
                                  const insumo = insumosDisponiveis.find((opcao) => opcao.id === insumoId);
                                  const fatorKg = insumo?.unidade === "KG" && quantidadeKgNoXml != null && quantidadeKgNoXml > 0 && item.quantidadeComercial > 0
                                    ? quantidadeKgNoXml / item.quantidadeComercial
                                    : null;
                                  const fator = fatorKg ?? (insumoId === item.insumoId ? item.fatorConversao ?? 1 : 1);
                                  atualizarLinha(item.id, { insumoId, taxaConversao: String(fator), quantidade: String(Math.round(item.quantidadeComercial * fator * 1000) / 1000) });
                                }}
                              />
                            </div>
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">Conversão</Label>
                              <Input
                                aria-label={`Conversão de ${item.descricaoProduto}`}
                                aria-invalid={conversaoInvalida}
                                className="aria-invalid:bg-destructive/10"
                                value={linha?.taxaConversao ?? "1"}
                                onChange={(e) => atualizarTaxaConversao(item, e.target.value)}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="w-28 space-y-1">
                              <Label className="text-xs">
                                Qtd.{insumoSelecionado ? ` (${unidadeMedidaAbreviada[insumoSelecionado.unidade]})` : ""}
                              </Label>
                              <Input
                                aria-label={`Quantidade de ${item.descricaoProduto}${insumoSelecionado ? ` em ${unidadeMedidaAbreviada[insumoSelecionado.unidade]}` : ""}`}
                                aria-invalid={quantidadeInvalida}
                                className="aria-invalid:bg-destructive/10"
                                value={linha?.quantidade ?? ""}
                                onChange={(e) => atualizarLinha(item.id, { quantidade: e.target.value, taxaConversao: String(paraNumero(e.target.value) / item.quantidadeComercial) })}
                                inputMode="decimal"
                                placeholder="0,000"
                              />
                            </div>
                            <div className="w-28 space-y-1">
                              <Label className="text-xs">Valor total</Label>
                              <CampoMonetario
                                aria-label={`Valor total de ${item.descricaoProduto} em reais`}
                                aria-invalid={valorTotalInvalido}
                                className="aria-invalid:bg-destructive/10"
                                value={composicao ? composicao.total.toFixed(2) : linha?.valorTotal ?? ""}
                                readOnly={!!composicao}
                                onValueChange={(valorTotal) => atualizarLinha(item.id, { valorTotal })}
                                inputMode="decimal"
                                placeholder="0,00"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[14rem] flex-1 space-y-1">
                              <Label className="text-xs">Categoria financeira</Label>
                              <CategoriaFinanceiraCombobox
                                categorias={categoriasFinanceiras}
                                value={linha?.categoriaFinanceiraId ?? ""}
                                onChange={(categoriaFinanceiraId) => atualizarLinha(item.id, { categoriaFinanceiraId })}
                                ariaLabel={`Categoria financeira de ${item.descricaoProduto}`}
                                placeholder="Buscar categoria de despesa..."
                                invalid={categoriaInvalida}
                              />
                            </div>
                            <div className="w-28 space-y-1">
                              <Label className="text-xs">Valor total</Label>
                              <CampoMonetario
                                aria-label={`Valor total de ${item.descricaoProduto} em reais`}
                                aria-invalid={valorTotalInvalido}
                                className="aria-invalid:bg-destructive/10"
                                value={composicao ? composicao.total.toFixed(2) : linha?.valorTotal ?? ""}
                                readOnly={!!composicao}
                                onValueChange={(valorTotal) => atualizarLinha(item.id, { valorTotal })}
                                inputMode="decimal"
                                placeholder="0,00"
                              />
                            </div>
                          </div>
                        )}
                        {linha?.destino === "ESTOQUE" && insumoSelecionado?.custoMedio !== undefined && <ComparativoCusto custoMedio={insumoSelecionado.custoMedio}
                          quantidade={quantidadeConvertida} valorTotal={totalConvertido} unidade={unidadeMedidaAbreviada[insumoSelecionado.unidade]} />}
                        {linha?.destino === "ESTOQUE" && podeCadastrarInsumo && <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-1">
                          <InsumoDialog
                            categoriasFinanceiras={categoriasFinanceiras}
                            categorias={categoriasInsumo}
                            centrosCusto={centrosCustoInsumo}
                            fornecedores={fornecedoresInsumo}
                            todosInsumos={todosInsumosCadastro}
                            podeCadastrarFornecedor={podeCadastrarFornecedor}
                            podeCadastrarInsumo={podeCadastrarInsumo}
                            onSaved={(insumoId) => aoCriarInsumo(item.id, insumoId)}
                            trigger={<Button type="button" variant="link" size="sm">Criar novo insumo</Button>}
                          />
                        </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </fieldset>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pendingManifestacao || salvandoFornecedor}
            onClick={() => setOverrideSecaoManifestacao(!secaoAberta)}
          >
            {secaoAberta ? "Ocultar ações" : "Aceitar / Recusar nota"}
          </Button>
        </div>
        {secaoAberta && (
          <DialogFooter className="block space-y-3">
            {etapaManifestacao.nome === "escolher" && (
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-700 px-4 text-white shadow-sm hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-800"
                  disabled={pendingManifestacao || salvandoFornecedor}
                  onClick={prepararRecusa}
                >
                  <ShieldX className="size-4" />
                  Recusar nota
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-700 bg-emerald-700 px-4 text-white shadow-sm hover:bg-emerald-800 dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                  disabled={pendingManifestacao || salvandoFornecedor}
                  onClick={() => {
                    setMostrarCamposInvalidos(true);
                    setEtapaManifestacao({ nome: "aceitar" });
                  }}
                >
                  <ShieldCheck className="size-4" />
                  Aceitar nota
                </Button>
              </div>
            )}

            {etapaManifestacao.nome === "aceitar" && (
              <div className="space-y-3">
                <p className="rounded-md bg-muted p-3 text-sm">
                  Ao aceitar, você declara à SEFAZ que <strong>a compra aconteceu e a mercadoria foi recebida</strong>.
                  O aceite também confirma os itens e as parcelas preenchidos acima, atualizando estoque e financeiro.
                  {haItemEstoque && dataEntradaEstoque && <strong className="mt-2 block">Entrada no estoque em {formatarDataCurta(dataEntradaEstoque)}.</strong>}
                </p>
                {!podeConfirmar && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {nota.temXmlCompleto ? "Antes de aceitar, preencha todos os itens com insumo ou categoria financeira, confira quantidades, valores, local e data de entrada no estoque e todas as parcelas." : "Importe o XML completo e preencha todos os itens antes de aceitar a nota."}
                </p>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingManifestacao || salvandoFornecedor}
                    onClick={() => setEtapaManifestacao({ nome: "escolher" })}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    className="bg-emerald-700 text-white hover:bg-emerald-800"
                    disabled={pendingManifestacao || salvandoFornecedor || !podeConfirmar}
                    onClick={confirmarAceite}
                  >
                    {pendingManifestacao && <Loader2 className="size-4 animate-spin" />}
                    Confirmar aceite
                  </Button>
                </div>
              </div>
            )}

            {etapaManifestacao.nome === "recusar" && (
              <div className="space-y-3">
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Informe o motivo para registrar a recusa na SEFAZ. Isso não cancela a nota fiscal do fornecedor.
                </p>
                {conferindoRecusa && <p role="status">Conferindo estoque e lançamentos da nota…</p>}
                {erroRecusa && <p role="alert" className="text-sm text-destructive">{erroRecusa}</p>}
                {previaRecusa && !previaRecusa.cancelada && <>
                  <ReversaoCompraAviso resumo={previaRecusa} />
                  <Label htmlFor="motivo-reversao-nota">Motivo da reversão local (15 a 255 caracteres)</Label>
                  <Textarea id="motivo-reversao-nota" value={motivoReversao} onChange={e => setMotivoReversao(e.target.value)} maxLength={255} disabled={pendingManifestacao} />
                </>}
                {previaRecusa?.cancelada && <p>Os efeitos desta compra já foram cancelados.</p>}
                <fieldset className="space-y-2" disabled={pendingManifestacao || salvandoFornecedor}>
                  <legend className="mb-2 text-sm font-medium">Motivo da recusa</legend>
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="radio"
                      name={`motivo-recusa-${nota.id}`}
                      className="mt-1"
                      checked={motivoRecusa === "DESCONHECIMENTO_DA_OPERACAO"}
                      onChange={() => setMotivoRecusa("DESCONHECIMENTO_DA_OPERACAO")}
                    />
                    Não reconheço esta compra
                  </label>
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="radio"
                      name={`motivo-recusa-${nota.id}`}
                      className="mt-1"
                      checked={motivoRecusa === "OPERACAO_NAO_REALIZADA"}
                      onChange={() => setMotivoRecusa("OPERACAO_NAO_REALIZADA")}
                    />
                    Reconheço a compra, mas ela não foi realizada
                  </label>
                </fieldset>
                {motivoRecusa === "OPERACAO_NAO_REALIZADA" && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`justificativa-${nota.id}`}>Justificativa (15 a 255 caracteres)</Label>
                    <Textarea
                      id={`justificativa-${nota.id}`}
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      disabled={pendingManifestacao || salvandoFornecedor}
                      rows={3}
                      maxLength={255}
                      placeholder="Explique por que essa operação não foi realizada..."
                    />
                    <p className="text-xs text-muted-foreground">{justificativa.trim().length}/255 caracteres — mínimo de 15</p>
                  </div>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingManifestacao || salvandoFornecedor}
                    onClick={() => setEtapaManifestacao({ nome: "escolher" })}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pendingManifestacao || salvandoFornecedor || !podeRecusar}
                    onClick={() => {
                      if (motivoRecusa && podeRecusar) {
                        enviarManifestacao(motivoRecusa, motivoRecusa === "OPERACAO_NAO_REALIZADA" ? justificativa.trim() : undefined);
                      }
                    }}
                  >
                    {pendingManifestacao && <Loader2 className="size-4 animate-spin" />}
                    Confirmar recusa
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
