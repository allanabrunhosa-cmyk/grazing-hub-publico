import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { obterConfiguracaoBrasilNfeAction, salvarConfiguracaoBrasilNfeAction, validarConexaoBrasilNfeAction, obterPreRequisitosBrasilNfeAction, registrarEvidenciaPainelBrasilNfeAction, verificarPreRequisitosBrasilNfeAction, obterHabilitacaoEmissaoBrasilNfeAction, configurarHabilitacaoEmissaoBrasilNfeAction } from "../brasilnfe-actions";
import { BrasilNfeForm } from "./brasilnfe-form";
import { PreRequisitosBrasilNfeCard } from "./pre-requisitos-card";
import { HabilitacaoEmissaoBrasilNfeCard } from "./habilitacao-emissao-card";

export default async function BrasilNfePage() {
  await exigirPermissao("configuracoes.brasilnfe");
  const resultado = await obterConfiguracaoBrasilNfeAction();
  const requisitos = await obterPreRequisitosBrasilNfeAction(), editar = await podeAcessar("configuracoes.brasilnfe", "editar");
  const fiscalEditar = await podeAcessar("vendas.fiscal", "editar"), controle = fiscalEditar ? await obterHabilitacaoEmissaoBrasilNfeAction() : null;
  return <div className="mx-auto max-w-4xl space-y-6">
    <BarraAcoes titulo="Brasil NFe" descricao="Configuração e diagnóstico da integração fiscal de saída." />
    {resultado.ok ? <BrasilNfeForm inicial={resultado.dados} editar={await podeAcessar("configuracoes.brasilnfe", "editar")} salvar={salvarConfiguracaoBrasilNfeAction} validar={validarConexaoBrasilNfeAction} /> : <p role="alert" className="text-sm text-destructive">{resultado.erro}</p>}
    {await podeAcessar("vendas.fiscal", "visualizar") && <Button variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal/cobertura?aba=regras" />}>Decisões tributárias e revisão interna</Button>}
    {requisitos.ok ? <PreRequisitosBrasilNfeCard inicial={requisitos.dados} editar={editar} registrar={registrarEvidenciaPainelBrasilNfeAction} verificar={verificarPreRequisitosBrasilNfeAction} /> : <p role="alert" className="text-sm text-destructive">{requisitos.erro}</p>}
    {controle && (controle.ok ? <HabilitacaoEmissaoBrasilNfeCard inicial={controle.dados} editar={editar && fiscalEditar} salvar={configurarHabilitacaoEmissaoBrasilNfeAction} /> : <p role="alert" className="text-sm text-destructive">{controle.erro}</p>)}
  </div>;
}
