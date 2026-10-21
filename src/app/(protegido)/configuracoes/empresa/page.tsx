import { exigirPermissao } from "@/lib/permissoes/servidor";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { prisma } from "@/lib/prisma";

import { DadosLojaForm } from "@/app/(protegido)/configuracoes/dados-loja-form";
import { validarEnderecoEntrega } from "@/lib/vendas/entregas-dominio";

export default async function ConfiguracoesPage() {
  await exigirPermissao("configuracoes.loja");

  const config = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });

  return (
    <div className="mx-auto max-w-4xl space-y-1">
      <BarraAcoes titulo="Dados da empresa" descricao="Personalize o comportamento do sistema." />
      <div className="space-y-6 pt-4">
        <DadosLojaForm
          config={{
            nome: config?.nome ?? "",
            cnpj: config?.cnpj ?? "",
            endereco: config?.endereco ?? "",
            enderecoEstruturado: config?.enderecoEstruturado ? validarEnderecoEntrega(config.enderecoEstruturado) : null,
            telefone: config?.telefone ?? "",
            emailContato: config?.emailContato ?? "",
          }}
        />
      </div>
    </div>
  );
}
