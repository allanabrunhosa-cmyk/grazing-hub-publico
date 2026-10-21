"use client";

import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Check, Plus } from "lucide-react";
import { IconeInsumo, IconePreparacao } from "@/components/icones-insumos";
import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoStatusAtivo } from "@/components/status-ativo";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveInsumoAction, createCategoriaAction, createCentroCustoAction } from "@/app/(protegido)/insumos/actions";
import { CreatableSelect } from "@/app/(protegido)/insumos/creatable-select";
import { FotoDropzone } from "@/app/(protegido)/insumos/foto-dropzone";
import { ComposicaoPicker } from "@/app/(protegido)/insumos/composicao-picker";
import { ModoPreparoCampos } from "@/app/(protegido)/insumos/modo-preparo-campos";
import { EtiquetaCadastroCampos } from "@/app/(protegido)/insumos/etiqueta-cadastro-campos";
import { ConversoesCampos } from "./conversoes-campos";
import { MarcasCampo } from "./marcas-campo";
import { marcasDoInsumo } from "@/lib/insumos/marcas";
import type { InsumoRow, SimpleOption, FornecedorOption, InsumoOption, ComponenteRow } from "@/app/(protegido)/insumos/types";
import { TipoProdutoGlobal, UnidadeMedida, TipoEstoque } from "@/generated/prisma/browser";
import { unidadeMedidaLabels, tipoEstoqueLabels, tipoProdutoGlobalLabels } from "@/lib/labels";
import { cn } from "cn";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { CampoMonetario } from "@/app/(protegido)/notas-fiscais/campo-monetario";
import { calcularCustoReceita } from "@/lib/insumos/custo-preparacao";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import type { ConversaoInsumo } from "@/lib/insumos/conversoes";

const SECAO = "space-y-3 rounded-lg border p-4";
const TITULO_SECAO = "text-xs font-medium tracking-wide text-muted-foreground uppercase";

export function InsumoForm({
  insumo,
  categorias,
  categoriasFinanceiras = [],
  centrosCusto,
  fornecedores,
  todosInsumos,
  onSaved,
  renderFooter,
  className,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
  podeConfigurarEtiqueta,
}: {
  insumo?: InsumoRow;
  categorias: SimpleOption[];
  categoriasFinanceiras?: CategoriaOption[];
  centrosCusto: SimpleOption[];
  fornecedores: FornecedorOption[];
  todosInsumos: InsumoOption[];
  onSaved?: (insumoId?: string) => void;
  renderFooter: (estado: { pending: boolean }) => ReactNode;
  className?: string;
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
  podeConfigurarEtiqueta?: boolean;
}) {
  const podeConsultarCustos = useAcesso().pode("financeiro.custos", "visualizar");
  const [categoriaFinanceiraId, definirCategoriaFinanceiraId] = useState(insumo?.categoriaFinanceiraId ?? "");
  const opcoesFinanceiras = insumo?.categoriaFinanceira && !categoriasFinanceiras.some(c => c.id === insumo.categoriaFinanceiraId)
    ? [...categoriasFinanceiras, { ...insumo.categoriaFinanceira, nome: `${insumo.categoriaFinanceira.nome} (inativa ou excluída)` }] : categoriasFinanceiras;
  const [tipo, setTipo] = useState<TipoProdutoGlobal>(insumo?.tipo ?? TipoProdutoGlobal.INSUMO);
  const [unidadePrincipal, definirUnidadePrincipal] = useState<UnidadeMedida>(insumo?.unidade ?? UnidadeMedida.UN);
  const [conversoes, definirConversoes] = useState<ConversaoInsumo[]>(insumo?.conversoes ?? []);
  const [rendimentoQuantidade, definirRendimentoQuantidade] = useState(insumo?.rendimentoQuantidade?.toString() ?? "");
  const [rendimentoUnidade, definirRendimentoUnidade] = useState<UnidadeMedida>(insumo?.rendimentoUnidade ?? UnidadeMedida.KG);
  const [homologadosIds, setHomologadosIds] = useState<Set<string>>(
    new Set(insumo?.fornecedoresHomologados.map((f) => f.id) ?? [])
  );
  const [principalId, setPrincipalId] = useState<string | null>(insumo?.fornecedorPrincipalId ?? null);
  const [componentes, setComponentes] = useState<ComponenteRow[]>(insumo?.componentes ?? []);
  const [modoPreparo, setModoPreparo] = useState<string[]>(insumo?.modoPreparo ?? []);
  const [error, setError] = useState<string | null>(null);
  const [fornecedoresCriados, setFornecedoresCriados] = useState<FornecedorOption[]>([]);
  const [pending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);

  const candidatos = todosInsumos.filter((i) => i.id !== insumo?.id);
  const ehProdutoIntermediario = tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO;
  const custoReceita = calcularCustoReceita(
    componentes.map((item) => {
      const candidato = todosInsumos.find((opcao) => opcao.id === item.componenteId);
      return { quantidade: item.quantidade, custoUnitario: candidato ? candidato.custoUnitario ?? null : item.custoUnitario ?? null };
    }),
    Number(rendimentoQuantidade.replace(",", ".")) || null,
    rendimentoUnidade,
    unidadePrincipal,
    conversoes,
  );
  const fornecedoresDisponiveis = [...fornecedores, ...fornecedoresCriados.filter((criado) => !fornecedores.some((fornecedor) => fornecedor.id === criado.id))];
  const fornecedoresHomologadosSelecionados = fornecedoresDisponiveis.filter((f) => homologadosIds.has(f.id));

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveInsumoAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setError(null);
      toast.success(insumo ? "Item atualizado." : "Item criado na rede global.");
      onSaved?.(result.insumoId);
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      onKeyDown={(e) => {
        // Atalho de quem digita rápido: salva sem tirar a mão do teclado.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
      className={cn("@container space-y-4", className)}
    >
      {insumo && <input type="hidden" name="id" value={insumo.id} />}
      <input type="hidden" name="tipo" value={tipo} />

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className={TITULO_SECAO}>Classificação</Label>
          {insumo ? (
            // O tipo é travado depois de criado — Insumo e Preparação têm
            // implicações diferentes demais (composição, rendimento) pra permitir troca
            // por engano. Pra mudar de verdade, exclui e cadastra de novo.
            <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 p-3">
              {tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO ? (
                <IconePreparacao className="size-5" />
              ) : (
                <IconeInsumo className="size-5" />
              )}
              <div>
                <div className="text-sm font-medium">{tipoProdutoGlobalLabels[tipo]}</div>
                <div className="text-xs text-muted-foreground">
                  Não é possível mudar o tipo depois de criado. Pra transformar, exclua este item e cadastre um novo.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
              <button
                type="button"
                onClick={() => setTipo(TipoProdutoGlobal.INSUMO)}
                disabled={pending}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors",
                  tipo === TipoProdutoGlobal.INSUMO
                    ? "border-foreground bg-foreground text-background"
                    : "border-input hover:bg-accent/40"
                )}
              >
                <IconeInsumo className="size-5" monocromatico={tipo === TipoProdutoGlobal.INSUMO} />
                <div>
                  <div className="text-sm font-medium">Insumo</div>
                  <div className={cn("text-xs", tipo === TipoProdutoGlobal.INSUMO ? "text-background/70" : "text-muted-foreground")}>
                    Matéria-prima
                  </div>
                </div>
                {tipo === TipoProdutoGlobal.INSUMO && <Check className="absolute top-2 right-2 size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setTipo(TipoProdutoGlobal.PRODUTO_INTERMEDIARIO)}
                disabled={pending}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors",
                  tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO
                    ? "border-foreground bg-foreground text-background"
                    : "border-input hover:bg-accent/40"
                )}
              >
                <IconePreparacao className="size-5" monocromatico={tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO} />
                <div>
                  <div className="text-sm font-medium">{tipoProdutoGlobalLabels[TipoProdutoGlobal.PRODUTO_INTERMEDIARIO]}</div>
                  <div
                    className={cn(
                      "text-xs",
                      tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    Base para receitas
                  </div>
                </div>
                {tipo === TipoProdutoGlobal.PRODUTO_INTERMEDIARIO && <Check className="absolute top-2 right-2 size-4" />}
              </button>
            </div>
          )}
        </div>

        <section className={SECAO}>
          <p className={TITULO_SECAO}>Identificação</p>
          <div className="grid items-start gap-4 @lg:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="min-w-0 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`nome-${insumo?.id ?? "novo"}`}>Nome Oficial *</Label>
                <Input
                  id={`nome-${insumo?.id ?? "novo"}`}
                  name="nome"
                  defaultValue={insumo?.nome}
                  required
                  disabled={pending}
                  placeholder="Ex: Filé Mignon Suíno..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`especificacao-${insumo?.id ?? "novo"}`}>Especificação</Label>
                <Input
                  id={`especificacao-${insumo?.id ?? "novo"}`}
                  name="especificacao"
                  defaultValue={insumo?.especificacao ?? ""}
                  maxLength={300}
                  disabled={pending}
                  placeholder="Ex.: sem lactose, calibre 90/110, receita padrão da casa"
                />
                <p className="text-xs text-muted-foreground">Complemento exibido abaixo do nome em todo o sistema.</p>
              </div>
              {ehProdutoIntermediario ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`observacoes-${insumo?.id ?? "novo"}`}>Observações da preparação</Label>
                  <Textarea id={`observacoes-${insumo?.id ?? "novo"}`} name="observacoes" rows={3} defaultValue={insumo?.observacoes ?? ""} disabled={pending} placeholder="Informações gerais da receita" />
                </div>
              ) : (
                <MarcasCampo marcasIniciais={marcasDoInsumo(insumo)} desabilitado={pending} />
              )}
            </div>

            <aside className="mx-auto w-full max-w-52 space-y-1.5 @lg:mx-0">
              <Label>{ehProdutoIntermediario ? "Foto da preparação" : "Foto do insumo"}</Label>
              <FotoDropzone
                fotoAtualUrl={
                  insumo?.temFoto ? `/api/insumos/${insumo.id}/foto?v=${new Date(insumo.updatedAt).getTime()}` : null
                }
                onChange={() => {}}
                disabled={pending}
              />
            </aside>
          </div>

          <div className={cn("grid items-start gap-3 @md:grid-cols-2", ehProdutoIntermediario ? "@xl:grid-cols-3" : "@2xl:grid-cols-4")}>
            {!ehProdutoIntermediario && (
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`codigoEan-${insumo?.id ?? "novo"}`}>Cód. / EAN</Label>
                <Input
                  id={`codigoEan-${insumo?.id ?? "novo"}`}
                  name="codigoEan"
                  defaultValue={insumo?.codigoEan ?? ""}
                  disabled={pending}
                  placeholder="OPCIONAL"
                />
              </div>
            )}
            <div className="min-w-0 space-y-1.5">
              <Label>Categoria do insumo</Label>
              <CreatableSelect
                name="categoriaId"
                initialOptions={categorias}
                selectedId={insumo?.categoria?.id ?? null}
                onCreate={createCategoriaAction}
                placeholder="Nenhuma"
                addLabel="Adicionar categoria..."
                disabled={pending}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label>Categoria financeira</Label>
              <input type="hidden" name="categoriaFinanceiraId" value={categoriaFinanceiraId} />
              <CategoriaFinanceiraCombobox categorias={opcoesFinanceiras} value={categoriaFinanceiraId}
                onChange={definirCategoriaFinanceiraId} disabled={pending} placeholder="Padrão do grupo CMV" />
              <p className="text-xs text-muted-foreground">Plano de contas usado nas novas notas enviadas ao estoque. Sem classificação, usa o padrão CMV.</p>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Centro de Custo (DRE)</Label>
              <CreatableSelect
                name="centroCustoId"
                initialOptions={centrosCusto}
                selectedId={insumo?.centroCusto?.id ?? null}
                onCreate={createCentroCustoAction}
                placeholder="Nenhum"
                emptyLabel="Nenhum"
                addLabel="Adicionar centro de custo..."
                disabled={pending}
              />
            </div>
          </div>
        </section>

        {ehProdutoIntermediario && (
          <section className={SECAO}>
            <p className={TITULO_SECAO}>Composição da receita</p>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
                  <IconePreparacao className="size-4" />Ingredientes
                </Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Busque insumos ou preparações já produzidas e informe a quantidade usada na receita.
                </p>
                <ComposicaoPicker
                  exibirEspecificacao
                  candidatos={candidatos}
                  itens={componentes}
                  onChange={setComponentes}
                  disabled={pending}
                  podeCadastrarInsumo={podeCadastrarInsumo}
                />
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <Label className="flex items-center gap-1.5 text-sm"><IconePreparacao className="size-4" />Rendimento Final</Label>
                <p className="text-xs text-muted-foreground">Quanto essa receita produz. Ex: 10 KG.</p>
                <div className="flex gap-2">
                  <Input
                    name="rendimentoQuantidade"
                    aria-label="Quantidade do rendimento final"
                    inputMode="decimal" restricao="decimal" casasDecimais={3} maxLength={13}
                    min={0}
                    value={rendimentoQuantidade}
                    onChange={(evento) => definirRendimentoQuantidade(evento.target.value)}
                    disabled={pending}
                    className="flex-1"
                  />
                  <Select name="rendimentoUnidade" value={rendimentoUnidade} onValueChange={(valor) => valor && definirRendimentoUnidade(valor as UnidadeMedida)} disabled={pending}>
                    <SelectTrigger className="w-36" aria-label="Unidade do rendimento final">
                      <SelectValue placeholder="Quilograma (kg)">
                        {(value: string) => (value ? unidadeMedidaLabels[value as UnidadeMedida] : "Quilograma (kg)")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(UnidadeMedida).map((unidade) => (
                        <SelectItem key={unidade} value={unidade}>
                          {unidadeMedidaLabels[unidade]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>
        )}

        {ehProdutoIntermediario && (
          <section className={SECAO}>
            <p className={TITULO_SECAO}>Modo de preparo</p>
            <div className="max-w-64 space-y-1.5"><Label htmlFor="tempo-preparo-minutos">Tempo de preparo (minutos)</Label><Input id="tempo-preparo-minutos" name="tempoPreparoMinutos" type="number" min={0} step={1} max={999999} defaultValue={insumo?.tempoPreparoMinutos ?? ""} disabled={pending} /></div>
            <p className="text-xs text-muted-foreground">Cadastre as etapas na ordem em que devem ser executadas.</p>
            <ModoPreparoCampos passos={modoPreparo} onChange={setModoPreparo} disabled={pending} />
          </section>
        )}

        {!ehProdutoIntermediario && <section className={SECAO}>
          <p className={TITULO_SECAO}>Fornecimento</p>

          <div className="space-y-1.5">
            <Label>Fornecedores homologados</Label>
            <p className="text-xs text-muted-foreground">
              Marque todos que podem fornecer este item — o principal fica em destaque nos pedidos de compra.
            </p>
            <MultiselecaoCombobox
              opcoes={fornecedoresDisponiveis}
              selecionadosIds={[...homologadosIds]}
              aoMudar={(ids) => {
                const novos = new Set(ids);
                setHomologadosIds(novos);
                if (principalId && !novos.has(principalId)) setPrincipalId(null);
              }}
              name="fornecedorIds"
              placeholder="Buscar fornecedor homologado..."
              ariaLabel="Fornecedores homologados"
              vazio="Nenhum fornecedor ativo cadastrado."
              disabled={pending}
            />
            {podeCadastrarFornecedor && !pending && <FornecedorDialog
              canaisPedidoOptions={[]}
              formasPagamentoOptions={[]}
              tipoInicial="FORNECEDOR"
              tipoFixo
              aoSalvar={(cadastro) => {
                const criado = { id: cadastro.id, nome: cadastro.nome };
                setFornecedoresCriados((atuais) => [...atuais.filter((item) => item.id !== criado.id), criado]);
                setHomologadosIds((atuais) => new Set([...atuais, criado.id]));
                setPrincipalId((atual) => atual ?? criado.id);
              }}
              trigger={<button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="size-3.5" />Cadastrar novo fornecedor</button>}
            />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`fornecedorPrincipalId-${insumo?.id ?? "novo"}`}>Fornecedor principal</Label>
            <Select
              name="fornecedorPrincipalId"
              value={principalId ?? "__nenhum__"}
              onValueChange={(v) => setPrincipalId(!v || v === "__nenhum__" ? null : String(v))}
              disabled={pending || fornecedoresHomologadosSelecionados.length === 0}
            >
              <SelectTrigger id={`fornecedorPrincipalId-${insumo?.id ?? "novo"}`} className="w-full">
                <SelectValue placeholder="Nenhum">
                  {(value: string) =>
                    !value || value === "__nenhum__"
                      ? "Nenhum"
                      : (fornecedoresHomologadosSelecionados.find((f) => f.id === value)?.nome ?? "Nenhum")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">Nenhum</SelectItem>
                {fornecedoresHomologadosSelecionados.map((fornecedor) => (
                  <SelectItem key={fornecedor.id} value={fornecedor.id}>
                    {fornecedor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`observacoes-${insumo?.id ?? "novo"}`}>Observações</Label>
            <Textarea
              id={`observacoes-${insumo?.id ?? "novo"}`}
              name="observacoes"
              rows={3}
              defaultValue={insumo?.observacoes ?? ""}
              disabled={pending}
              placeholder="Pedido mínimo, condições especiais, etc."
            />
          </div>
        </section>}

        <section className={SECAO}>
          <p className={TITULO_SECAO}>Estoque e custo</p>

          <div className="grid gap-3 @md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`unidade-${insumo?.id ?? "novo"}`}>Unidade Escopo</Label>
              <Select name="unidade" value={unidadePrincipal} onValueChange={(valor) => valor && definirUnidadePrincipal(valor as UnidadeMedida)} disabled={pending}>
                <SelectTrigger id={`unidade-${insumo?.id ?? "novo"}`} className="w-full">
                  <SelectValue placeholder="Unidade (un)">
                    {(value: string) => (value ? unidadeMedidaLabels[value as UnidadeMedida] : "Unidade (un)")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UnidadeMedida).map((unidade) => (
                    <SelectItem key={unidade} value={unidade}>
                      {unidadeMedidaLabels[unidade]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tipoEstoque-${insumo?.id ?? "novo"}`}>Tipo de estoque</Label>
              <Select name="tipoEstoque" defaultValue={insumo?.tipoEstoque ?? "__nenhum__"} disabled={pending}>
                <SelectTrigger id={`tipoEstoque-${insumo?.id ?? "novo"}`} className="w-full">
                  <SelectValue placeholder="Não especificado">
                    {(value: string) =>
                      !value || value === "__nenhum__" ? "Não especificado" : tipoEstoqueLabels[value as TipoEstoque]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">Não especificado</SelectItem>
                  {Object.values(TipoEstoque).map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {tipoEstoqueLabels[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ConversoesCampos key={unidadePrincipal} unidadePrincipal={unidadePrincipal} conversoes={unidadePrincipal === insumo?.unidade ? insumo.conversoes : []} desabilitado={pending} onChange={definirConversoes} />
          {insumo && unidadePrincipal !== insumo.unidade && <p className="text-xs text-muted-foreground">A unidade principal foi alterada. Cadastre novamente os fatores para essa unidade antes de salvar.</p>}

          <div className="grid gap-3 @md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`estoqueMinimo-${insumo?.id ?? "novo"}`}>Estoque mín.</Label>
              <Input
                id={`estoqueMinimo-${insumo?.id ?? "novo"}`}
                name="estoqueMinimo"
                inputMode="decimal" restricao="decimal" casasDecimais={3} maxLength={13}
                min={0}
                defaultValue={insumo?.estoqueMinimo ?? 0}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`estoqueMaximo-${insumo?.id ?? "novo"}`}>Estoque máx.</Label>
              <Input
                id={`estoqueMaximo-${insumo?.id ?? "novo"}`}
                name="estoqueMaximo"
                inputMode="decimal" restricao="decimal" casasDecimais={3} maxLength={13}
                min={0}
                defaultValue={insumo?.estoqueMaximo ?? ""}
                disabled={pending}
              />
            </div>
            {ehProdutoIntermediario ? (
              <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Custo médio ({unidadeMedidaAbreviada[unidadePrincipal]})</p>
                {"unitario" in custoReceita ? (
                  <p className="text-sm font-semibold">{custoReceita.unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 })}/{unidadeMedidaAbreviada[unidadePrincipal]}</p>
                ) : <p className="text-xs text-muted-foreground">{custoReceita.motivo}</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`custoMedio-${insumo?.id ?? "novo"}`}>Custo médio ({unidadeMedidaAbreviada[unidadePrincipal]})</Label>
                {podeConsultarCustos ? <CampoMonetario id={`custoMedio-${insumo?.id ?? "novo"}`} name="custoMedio" defaultValue={insumo?.custoMedio ?? 0} disabled={pending} /> : <Input id={`custoMedio-${insumo?.id ?? "novo"}`} value="Indisponível para este acesso" disabled readOnly />}
              </div>
            )}
          </div>

          <CampoStatusAtivo ativoInicial={insumo?.ativo ?? true} nome={insumo?.nome ?? "novo cadastro"} disabled={pending} />
        </section>

        {podeConfigurarEtiqueta && (
          <EtiquetaCadastroCampos
            habilitadaInicial={insumo?.etiquetaHabilitada}
            validadeSecoDias={insumo?.validadeSecoDias}
            validadeRefrigeradoDias={insumo?.validadeRefrigeradoDias}
            validadeCongeladoDias={insumo?.validadeCongeladoDias}
            disabled={pending}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {renderFooter({ pending })}
    </form>
  );
}
