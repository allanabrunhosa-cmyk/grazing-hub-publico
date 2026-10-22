import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";



import { obterConfiguracaoBrasilNfeAction, salvarConfiguracaoBrasilNfeAction, validarConexaoBrasilNfeAction, obterPreRequisitosBrasilNfeAction, registrarEvidenciaPainelBrasilNfeAction, verificarPreRequisitosBrasilNfeAction, obterHabilitacaoEmissaoBrasilNfeAction, configurarHabilitacaoEmissaoBrasilNfeAction } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe-actions";
import { BrasilNfeForm } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/brasilnfe-form";
import { PreRequisitosBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/pre-requisitos-card";
import { HabilitacaoEmissaoBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/habilitacao-emissao-card";

export async function BlocoEmissorFiscal() {
  await exigirPermissao("configuracoes.brasilnfe");
  const resultado = await obterConfiguracaoBrasilNfeAction();
  const requisitos = await obterPreRequisitosBrasilNfeAction(), editar = await podeAcessar("configuracoes.brasilnfe", "editar");
  const fiscalEditar = await podeAcessar("vendas.fiscal", "editar"), controle = fiscalEditar ? await obterHabilitacaoEmissaoBrasilNfeAction() : null;
  return <div className="space-y-6">

    {resultado.ok ? <BrasilNfeForm compacto inicial={resultado.dados} editar={await podeAcessar("configuracoes.brasilnfe", "editar")} salvar={salvarConfiguracaoBrasilNfeAction} validar={validarConexaoBrasilNfeAction} /> : <p role="alert" className="text-sm text-destructive">{resultado.erro}</p>}

    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Certificado da emissora e CSC por ambiente</summary><div className="mt-3">{requisitos.ok ? <PreRequisitosBrasilNfeCard inicial={requisitos.dados} editar={editar} registrar={registrarEvidenciaPainelBrasilNfeAction} verificar={verificarPreRequisitosBrasilNfeAction} /> : <p role="alert" className="text-sm text-destructive">{requisitos.erro}</p>}
    </div></details><details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Habilitação de emissão por modelo</summary><div className="mt-3">{controle && (controle.ok ? <HabilitacaoEmissaoBrasilNfeCard inicial={controle.dados} editar={editar && fiscalEditar} salvar={configurarHabilitacaoEmissaoBrasilNfeAction} /> : <p role="alert" className="text-sm text-destructive">{controle.erro}</p>)}
    </div></details>
  </div>;
}
