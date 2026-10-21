"use client";

import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";

import { useState, type ReactElement } from "react";
import { Loader2, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { InsumoForm } from "@/app/(protegido)/insumos/insumo-form";
import type { InsumoRow, SimpleOption, FornecedorOption, InsumoOption } from "@/app/(protegido)/insumos/types";
import { tipoProdutoGlobalLabels, unidadeMedidaAbreviada } from "@/lib/labels";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Tabs, TabsList, TabsTriggerBotao, TabsContent } from "@/components/ui/tabs";
import { MovimentacoesItem } from "./movimentacoes-item";

// Cadastro e edição de Insumo — usado tanto pelo botão "Novo" quanto pelo
// "Editar" da linha principal na tabela, e também embutido em outras telas (ex.:
// conciliação de itens de NF-e) pra criar um insumo novo sem sair do fluxo.
export function InsumoDialog({
  insumo,
  categorias,
  categoriasFinanceiras = [],
  centrosCusto,
  fornecedores,
  todosInsumos,
  trigger,
  onSaved,
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
  trigger: ReactElement;
  onSaved?: (insumoId?: string) => void;
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
  podeConfigurarEtiqueta?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const acesso = useAcesso();
  const consultarMovimentacoes = !!insumo && acesso.pode("insumos") && acesso.pode("inventario");
  const formulario = <InsumoForm
    key={open ? "aberto" : "fechado"}
    insumo={insumo}
    categorias={categorias}
    categoriasFinanceiras={categoriasFinanceiras}
    centrosCusto={centrosCusto}
    fornecedores={fornecedores}
    todosInsumos={todosInsumos}
    podeCadastrarFornecedor={podeCadastrarFornecedor}
    podeCadastrarInsumo={podeCadastrarInsumo}
    podeConfigurarEtiqueta={podeConfigurarEtiqueta}
    onSaved={(insumoId) => {
      setOpen(false);
      onSaved?.(insumoId);
    }}
    renderFooter={({ pending }) => (
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {insumo ? "Salvar alterações" : "Criar"}
          {!insumo && !pending && <ArrowRight className="size-4" />}
        </Button>
      </DialogFooter>
    )}
  />;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            {insumo ? `Editar ${tipoProdutoGlobalLabels[insumo.tipo]}` : "Novo cadastro"}
          </DialogTitle>
          <DialogDescription>
            {insumo
              ? "Atualize as propriedades deste item na rede."
              : "Escolha entre insumo e preparação e preencha os dados do novo item."}
          </DialogDescription>
        </DialogHeader>

        {consultarMovimentacoes && insumo ? <Tabs key={open ? "aberto" : "fechado"} defaultValue="dados" className="min-w-0">
          <TabsList variant="buttons" aria-label="Abas do cadastro">
            <TabsTriggerBotao value="dados">Dados do item</TabsTriggerBotao>
            <TabsTriggerBotao value="movimentacoes">Movimentações</TabsTriggerBotao>
          </TabsList>
          <TabsContent value="dados" keepMounted className="min-w-0">
            {formulario}
          </TabsContent>
          <TabsContent value="movimentacoes" className="min-w-0 space-y-4">
            <MovimentacoesItem insumoId={insumo.id} unidade={unidadeMedidaAbreviada[insumo.unidade]} />
            <DialogFooter><DialogClose render={<Button type="button" variant="outline" />}>Fechar</DialogClose></DialogFooter>
          </TabsContent>
        </Tabs> : formulario}
      </DialogContent>
    </Dialog>
  );
}
