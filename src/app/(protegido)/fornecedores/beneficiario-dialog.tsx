"use client";

import { useState, useTransition, type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoStatusAtivo } from "@/components/status-ativo";
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
import { salvarBeneficiarioAction } from "@/app/(protegido)/fornecedores/actions";
import type { FornecedorRow, SimpleOption } from "@/app/(protegido)/fornecedores/types";
import { formatarCpfCnpj } from "@/lib/documento-brasileiro";
import { aplicarCaixaAltaNoCampo } from "@/lib/caixa-alta";

const NENHUMA = "__nenhuma__";

export function BeneficiarioDialog({
  beneficiario,
  formasPagamentoOptions,
  trigger,
  aoSalvar,
}: {
  beneficiario?: FornecedorRow;
  formasPagamentoOptions: SimpleOption[];
  trigger: ReactElement;
  aoSalvar?: (beneficiario: { id: string; nome: string; formaPagamentoId: string | null }) => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{beneficiario ? "Editar beneficiário" : "Novo beneficiário"}</DialogTitle>
          <DialogDescription>
            Cadastro simplificado para pagamentos e lançamentos financeiros. Apenas o nome é obrigatório.
          </DialogDescription>
        </DialogHeader>

        <FormularioBeneficiario
          key={aberto ? "aberto" : "fechado"}
          beneficiario={beneficiario}
          formasPagamentoOptions={formasPagamentoOptions}
          onSaved={(beneficiarioSalvo) => {
            aoSalvar?.(beneficiarioSalvo);
            setAberto(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function FormularioBeneficiario({
  beneficiario,
  formasPagamentoOptions,
  onSaved,
}: {
  beneficiario?: FornecedorRow;
  formasPagamentoOptions: SimpleOption[];
  onSaved: (beneficiario: { id: string; nome: string; formaPagamentoId: string | null }) => void;
}) {
  const documentoInicial = formatarCpfCnpj(beneficiario?.cpf ?? beneficiario?.cnpj ?? "");
  const formaInicial = beneficiario?.formasPagamento[0]?.id ?? NENHUMA;
  const [documento, setDocumento] = useState(documentoInicial);
  const [formaPagamentoId, setFormaPagamentoId] = useState(formaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function salvar(formData: FormData) {
    iniciarTransicao(async () => {
      const resultado = await salvarBeneficiarioAction(formData);
      if ("erro" in resultado) {
        setErro(resultado.erro);
        toast.error(resultado.erro);
        return;
      }
      toast.success(beneficiario ? "Beneficiário atualizado." : "Beneficiário cadastrado.");
      onSaved(resultado.beneficiario);
    });
  }

  const formaSelecionada = formasPagamentoOptions.find((forma) => forma.id === formaPagamentoId)?.nome;

  return (
    <form action={salvar} onSubmit={(evento) => evento.stopPropagation()} className="space-y-5">
          {beneficiario && <input type="hidden" name="id" value={beneficiario.id} />}
          <input type="hidden" name="formaPagamentoId" value={formaPagamentoId === NENHUMA ? "" : formaPagamentoId} />

          <div className="space-y-2">
            <Label htmlFor={`nome-beneficiario-${beneficiario?.id ?? "novo"}`}>Nome *</Label>
            <Input
              id={`nome-beneficiario-${beneficiario?.id ?? "novo"}`}
              name="nome"
              defaultValue={beneficiario?.nome}
              required
              disabled={pendente}
              autoComplete="name"
              autoCapitalize="characters"
              onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`documento-beneficiario-${beneficiario?.id ?? "novo"}`}>CPF ou CNPJ</Label>
              <Input
                id={`documento-beneficiario-${beneficiario?.id ?? "novo"}`}
                name="documento"
                value={documento}
                onChange={(evento) => setDocumento(formatarCpfCnpj(evento.target.value))}
                inputMode="numeric"
                placeholder="CPF ou CNPJ"
                disabled={pendente}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`telefone-beneficiario-${beneficiario?.id ?? "novo"}`}>Telefone</Label>
              <Input
                id={`telefone-beneficiario-${beneficiario?.id ?? "novo"}`}
                name="telefone"
                type="tel"
                defaultValue={beneficiario?.telefone ?? ""}
                disabled={pendente}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={formaPagamentoId} onValueChange={(valor) => setFormaPagamentoId(valor ?? NENHUMA)} disabled={pendente}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhuma">{() => formaSelecionada ?? "Nenhuma"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Nenhuma</SelectItem>
                {formasPagamentoOptions.map((forma) => (
                  <SelectItem key={forma.id} value={forma.id}>{forma.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CampoStatusAtivo
            ativoInicial={beneficiario?.ativo ?? true}
            nome={beneficiario?.nome ?? "novo beneficiário"}
            disabled={pendente}
          />

          {erro && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendente}>
              {pendente && <Loader2 className="size-4 animate-spin" />}
              {beneficiario ? "Salvar alterações" : "Cadastrar beneficiário"}
            </Button>
          </DialogFooter>
    </form>
  );
}
