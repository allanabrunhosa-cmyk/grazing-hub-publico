"use client";

import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { salvarConfiguracaoLojaAction } from "@/app/(protegido)/configuracoes/actions";
import { buscarCepLojaAction } from "./actions";
import { CamposEnderecoPedido } from "../vendas/pedidos/endereco-pedido-form";
import { enderecoEntregaVazio, type EnderecoEntrega } from "@/lib/vendas/entregas-dominio";

export function DadosLojaForm({
  config,
}: {
  config: { nome: string; cnpj: string; endereco: string; telefone: string; emailContato: string; enderecoEstruturado?: EnderecoEntrega | null };
}) {
  const [salvando, startSalvar] = useTransition();
  const id = useId();
  const [erro, definirErro] = useState("");
  const trava = useRef(false);
  const [endereco, setEndereco] = useState(config.enderecoEstruturado ?? { ...enderecoEntregaVazio });
  const [consultandoCep, setConsultandoCep] = useState(false);

  function handleSubmit(formData: FormData) {
    if (trava.current || consultandoCep) return;
    formData.set("enderecoEstruturado", JSON.stringify(endereco));
    trava.current = true; definirErro("");
    startSalvar(async () => {
      try {
        const resultado = await salvarConfiguracaoLojaAction(null, formData);
        if ("erro" in resultado) { definirErro(resultado.erro); toast.error(resultado.erro); return; }
        toast.success("Dados da loja salvos.");
      } catch { definirErro("Não foi possível confirmar. Seus campos foram mantidos para conferência."); }
      finally { trava.current = false; }
    });
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSubmit(new FormData(e.currentTarget)); }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            Dados da Loja
          </CardTitle>
          <CardDescription>Informações visíveis em relatórios e pedidos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-nome`}>Nome da Unidade</Label>
            <Input id={`${id}-nome`} name="nome" maxLength={160} defaultValue={config.nome} placeholder="Grazing Table & Co" disabled={salvando} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-cnpj`}>CNPJ</Label>
            <Input id={`${id}-cnpj`} name="cnpj" maxLength={30} defaultValue={config.cnpj} placeholder="00.000.000/0000-00" disabled={salvando} />
          </div>
          <section className="space-y-3" aria-label="Endereço da empresa">
            <h3 className="text-sm font-medium">Endereço da empresa</h3>
            {!config.enderecoEstruturado && config.endereco && <p className="text-xs text-muted-foreground">Endereço anterior: {config.endereco}. Complete os campos para usar a empresa como origem de entrega.</p>}
            <input type="hidden" name="endereco" value={config.endereco} />
            <CamposEnderecoPedido valor={endereco} alterar={setEndereco} mostrarPais={false} complementoObrigatorio={false} consultarCep={buscarCepLojaAction} somenteLeitura={salvando} onConsultandoCepChange={setConsultandoCep} />
          </section>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-telefone`}>Telefone</Label>
            <Input id={`${id}-telefone`} name="telefone" maxLength={40} defaultValue={config.telefone} placeholder="(00) 00000-0000" disabled={salvando} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-emailContato`}>Email de Contato</Label>
            <Input id={`${id}-emailContato`} name="emailContato" maxLength={254} type="email" defaultValue={config.emailContato} placeholder="contato@exemplo.com" disabled={salvando} />
          </div>
        </CardContent>
        <CardFooter className="justify-end bg-transparent border-t-0 pt-0">
          <Button type="submit" disabled={salvando || consultandoCep}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
