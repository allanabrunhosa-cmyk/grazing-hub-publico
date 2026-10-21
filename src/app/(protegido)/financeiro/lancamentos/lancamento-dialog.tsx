"use client";

import { CategoriaFinanceiraCombobox } from "@/components/categoria-financeira-combobox";
import { useMemo, useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { criarLancamentoAction, atualizarLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { estilosNaturezaFinanceira, naturezaFinanceiraDoTipo } from "@/lib/financeiro/natureza-financeira";
import { frequenciaRecorrenciaLabels, somarFrequencia, dataParaIso, type FrequenciaRecorrencia } from "@/lib/financeiro/recorrencia";
import type {
  CategoriaOption,
  ContaBancariaOption,
  FormaPagamentoOption,
  FornecedorOption,
  LancamentoRow,
} from "@/app/(protegido)/financeiro/types";
import type { TipoLancamento } from "@/generated/prisma/client";
import { aplicarCaixaAltaNoCampo } from "@/lib/caixa-alta";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";

import { dataLancamentoValida, DATA_LANCAMENTO_MIN, DATA_LANCAMENTO_MAX } from "@/lib/financeiro/data-lancamento";

const NENHUM = "__nenhum__";

function hojeIso(): string {
  return dataParaIso(new Date());
}

// Função pura (não é hook, apesar de parecer) — resolve o nome de exibição de uma
// opção selecionada, pro SelectValue mostrar o rótulo certo (não o id).
function nomeDaOpcao<T extends { id: string; nome: string }>(opcoes: T[], id: string) {
  return opcoes.find((o) => o.id === id)?.nome;
}

export function LancamentoDialog({
  categorias,
  fornecedores,
  formasPagamento,
  contasBancarias,
  lancamento,
  trigger,
  podeCadastrarBeneficiario = false,
  aoSalvar,
}: {
  categorias: CategoriaOption[];
  fornecedores: FornecedorOption[];
  formasPagamento: FormaPagamentoOption[];
  contasBancarias: ContaBancariaOption[];
  lancamento?: LancamentoRow;
  trigger?: ReactElement;
  podeCadastrarBeneficiario?: boolean;
  aoSalvar?: () => void;
}) {
  const editando = lancamento != null;

  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo ?? "DESPESA");
  const [categoriaId, setCategoriaId] = useState(lancamento?.categoriaId ?? "");
  const [fornecedorId, setFornecedorId] = useState(lancamento?.fornecedorId ?? NENHUM);
  const [beneficiariosCriados, setBeneficiariosCriados] = useState<FornecedorOption[]>([]);
  const [formaPagamentoId, setFormaPagamentoId] = useState(lancamento?.formaPagamentoId ?? NENHUM);
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [jaBaixado, setJaBaixado] = useState(false);
  const [dataCompetencia, setDataCompetencia] = useState(lancamento ? lancamento.dataCompetencia.slice(0, 10) : hojeIso());
  const [dataVencimentoBase, setDataVencimentoBase] = useState(lancamento ? lancamento.dataVencimento.slice(0, 10) : "");
  const [repetirPor, setRepetirPor] = useState(1);
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>("MENSAL");
  const [vencimentosParcelas, setVencimentosParcelas] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const estiloTipo = estilosNaturezaFinanceira[naturezaFinanceiraDoTipo(tipo)];

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => (tipo === "RECEITA" ? GRUPOS_RECEITA.includes(c.grupo) : !GRUPOS_RECEITA.includes(c.grupo))),
    [categorias, tipo]
  );

  const opcoesFornecedores = useMemo(() => {
    const opcoes = new Map(fornecedores.map((fornecedor) => [fornecedor.id, fornecedor]));
    for (const beneficiario of beneficiariosCriados) opcoes.set(beneficiario.id, beneficiario);
    return Array.from(opcoes.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [fornecedores, beneficiariosCriados]);

  const fornecedorNome = fornecedorId === NENHUM ? "Nenhum" : nomeDaOpcao(opcoesFornecedores, fornecedorId);
  const formaPagamentoNome = formaPagamentoId === NENHUM ? "Nenhuma" : nomeDaOpcao(formasPagamento, formaPagamentoId);
  const contaBancariaNome = nomeDaOpcao(contasBancarias, contaBancariaId);

  // Recalcula o preview de parcelas quando quantidade, frequência ou a data-base mudam —
  // chamado direto nos onChange desses campos (não em useEffect) pra não gerar uma
  // segunda renderização em cascata; depois disso cada data fica livre pra ajuste fino
  // individual (o próprio input da parcela escreve direto no estado, sem passar por aqui).
  function regenerarParcelas(qtd: number, freq: FrequenciaRecorrencia, vencimentoBase: string, competenciaBase: string) {
    if (qtd <= 1) {
      setVencimentosParcelas([]);
      return;
    }
    const dataBase = vencimentoBase || competenciaBase;
    if (!dataLancamentoValida(dataBase)) { setVencimentosParcelas([]); return; }
    const base = new Date(`${dataBase}T12:00:00`);
    setVencimentosParcelas(Array.from({ length: qtd }, (_, i) => dataParaIso(somarFrequencia(base, freq, i))));
  }

  function resetar() {
    setTipo(lancamento?.tipo ?? "DESPESA");
    setCategoriaId(lancamento?.categoriaId ?? "");
    setFornecedorId(lancamento?.fornecedorId ?? NENHUM);
    setFormaPagamentoId(lancamento?.formaPagamentoId ?? NENHUM);
    setContaBancariaId("");
    setJaBaixado(false);
    setDataCompetencia(lancamento ? lancamento.dataCompetencia.slice(0, 10) : hojeIso());
    setDataVencimentoBase(lancamento ? lancamento.dataVencimento.slice(0, 10) : "");
    setRepetirPor(1);
    setFrequencia("MENSAL");
    setVencimentosParcelas([]);
  }

  function handleSubmit(formData: FormData) {
    for (const data of vencimentosParcelas) formData.append("parcelaVencimento", data);

    startTransition(async () => {
      const resultado = editando
        ? await atualizarLancamentoAction(lancamento!.id, formData)
        : await criarLancamentoAction(null, formData);
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(editando ? "Lançamento atualizado." : tipo === "RECEITA" ? "Receita lançada." : "Despesa lançada.");
      setOpen(false);
      resetar();
      aoSalvar?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetar();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button className="gap-1.5">
              <Plus className="size-4" />
              Novo Lançamento
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          <DialogDescription>
            {editando ? "Ajuste os dados deste lançamento." : "Registre uma receita ou despesa. Ela fica pendente em Movimentações até ser realizada."}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="categoriaId" value={categoriaId} />
          <input type="hidden" name="fornecedorId" value={fornecedorId} />
          <input type="hidden" name="formaPagamentoId" value={formaPagamentoId} />
          {!editando && <input type="hidden" name="jaBaixado" value={jaBaixado ? "on" : ""} />}
          {!editando && <input type="hidden" name="contaBancariaId" value={contaBancariaId} />}
          {!editando && <input type="hidden" name="frequencia" value={frequencia} />}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={tipo === "DESPESA" ? "saida" : "saida-outline"} aria-pressed={tipo === "DESPESA"} onClick={() => { setTipo("DESPESA"); if (tipo !== "DESPESA") setCategoriaId(""); }} disabled={pending}>
              Despesa
            </Button>
            <Button type="button" variant={tipo === "RECEITA" ? "entrada" : "entrada-outline"} aria-pressed={tipo === "RECEITA"} onClick={() => { setTipo("RECEITA"); if (tipo !== "RECEITA") setCategoriaId(""); }} disabled={pending}>
              Receita
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input name="descricao" placeholder="Aluguel de setembro, venda do dia..." defaultValue={lancamento?.descricao} disabled={pending} required autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput name="valor" defaultValue={lancamento?.valor} disabled={pending} required />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <CategoriaFinanceiraCombobox
                categorias={categoriasFiltradas}
                value={categoriaId}
                onChange={setCategoriaId}
                disabled={pending}
                ariaLabel={tipo === "DESPESA" ? "Categoria de despesa" : "Categoria de receita"}
                placeholder={tipo === "DESPESA" ? "Buscar categoria de despesa..." : "Buscar categoria de receita..."}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Competência</Label>
              <Input
                name="dataCompetencia"
                type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX}
                value={dataCompetencia}
                onChange={(e) => {
                  setDataCompetencia(e.target.value);
                  if (!editando) regenerarParcelas(repetirPor, frequencia, dataVencimentoBase, e.target.value);
                }}
                disabled={pending}
                required
              />
              <p className="text-xs text-muted-foreground">Mês do fato gerador — é o que o DRE usa.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                name="dataVencimento"
                type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX}
                value={dataVencimentoBase}
                onChange={(e) => {
                  setDataVencimentoBase(e.target.value);
                  if (!editando) regenerarParcelas(repetirPor, frequencia, e.target.value, dataCompetencia);
                }}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Vazio = mesma da competência.</p>
            </div>
          </div>

          {tipo === "DESPESA" && (
            <div className="space-y-1.5">
              <Label>Fornecedor ou beneficiário</Label>
              <Select value={fornecedorId} onValueChange={(value) => setFornecedorId(value ?? NENHUM)} disabled={pending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum">{() => fornecedorNome ?? "Nenhum"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Nenhum</SelectItem>
                  {opcoesFornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editando && podeCadastrarBeneficiario && (
                <FornecedorDialog
                  canaisPedidoOptions={[]}
                  formasPagamentoOptions={formasPagamento}
                  aoSalvar={(cadastro) => {
                    setBeneficiariosCriados((atuais) => [...atuais.filter((item) => item.id !== cadastro.id), cadastro]);
                    setFornecedorId(cadastro.id);
                    if (cadastro.formaPagamentoId) setFormaPagamentoId(cadastro.formaPagamentoId);
                  }}
                  trigger={(
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <UserPlus className="size-3.5" />
                      Cadastrar fornecedor ou beneficiário
                    </button>
                  )}
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{tipo === "RECEITA" ? "Cliente / Contraparte (opcional)" : "Contraparte, se não houver cadastro"}</Label>
            <Input name="contraparteNome" placeholder="Nome" defaultValue={lancamento?.contraparteNome ?? ""} disabled={pending} autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} />
          </div>

          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamentoId} onValueChange={(value) => setFormaPagamentoId(value ?? NENHUM)} disabled={pending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhuma">{() => formaPagamentoNome ?? "Nenhuma"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhuma</SelectItem>
                {formasPagamento.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!editando && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={jaBaixado} onCheckedChange={(checked) => setJaBaixado(checked === true)} disabled={pending} />
                {tipo === "RECEITA" ? "Já foi recebida" : "Já foi paga"}
              </label>

              {jaBaixado && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                  <div className="space-y-1.5">
                    <Label>Data do pagamento</Label>
                    <Input name="dataPagamento" type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} defaultValue={hojeIso()} disabled={pending} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta Bancária</Label>
                    <Select value={contaBancariaId} onValueChange={(value) => setContaBancariaId(value ?? "")} disabled={pending}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Escolha">{() => contaBancariaNome ?? "Escolha"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {contasBancarias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {!jaBaixado && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Quantidade de vezes</Label>
                      <Input
                        type="number"
                        min={1}
                        max={36}
                        value={repetirPor}
                        onChange={(e) => {
                          const novaQtd = Math.max(1, Math.min(36, Number.parseInt(e.target.value, 10) || 1));
                          setRepetirPor(novaQtd);
                          regenerarParcelas(novaQtd, frequencia, dataVencimentoBase, dataCompetencia);
                        }}
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Recorrência</Label>
                      <Select
                        value={frequencia}
                        onValueChange={(value) => {
                          const nova = (value as FrequenciaRecorrencia) ?? "MENSAL";
                          setFrequencia(nova);
                          regenerarParcelas(repetirPor, nova, dataVencimentoBase, dataCompetencia);
                        }}
                        disabled={pending || repetirPor <= 1}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Mensal">{() => frequenciaRecorrenciaLabels[frequencia]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(frequenciaRecorrenciaLabels) as FrequenciaRecorrencia[]).map((f) => (
                            <SelectItem key={f} value={f}>
                              {frequenciaRecorrenciaLabels[f]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {vencimentosParcelas.length > 1 && (
                    <div className="space-y-1.5">
                      <Label>Vencimentos das parcelas (ajuste fino, se precisar)</Label>
                      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {vencimentosParcelas.map((data, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-xs text-muted-foreground">
                              {i + 1}/{vencimentosParcelas.length}
                            </span>
                            <Input
                              type="date" min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX}
                              value={data}
                              onChange={(e) =>
                                setVencimentosParcelas((prev) => prev.map((d, idx) => (idx === i ? e.target.value : d)))
                              }
                              disabled={pending}
                              className="h-9"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea name="observacoes" defaultValue={lancamento?.observacoes ?? ""} disabled={pending} rows={2} />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button type="submit" variant={estiloTipo.varianteBotao} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {editando ? "Salvar alterações" : `Lançar ${tipo === "RECEITA" ? "receita" : "despesa"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
