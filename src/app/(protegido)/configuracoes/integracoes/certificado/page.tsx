import { exigirPermissao, exigirSessao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";
import { CertificadoCard } from "@/app/(protegido)/configuracoes/certificado-card";
import { carregarResumoIntegracoes } from "../resumo";
import { MolduraIntegracoes } from "../seletor";

/** Certificado A1 local, separado da Brasil NFe. Mesma permissão e mesmas ações de Configurações fiscais. */
export default async function CertificadoIntegracaoPage() {
  await exigirPermissao("configuracoes.loja");
  const sessao = await exigirSessao();
  const [resumo, registro, editar, excluir] = await Promise.all([
    carregarResumoIntegracoes(),
    prisma.certificadoDigital.findUnique({ where: { id: "singleton" }, select: { arquivoNome: true, titular: true, validoAte: true, updatedAt: true, atualizadoPor: { select: { nome: true } } } }),
    podeAcessar("configuracoes.loja", "editar"), podeAcessar("configuracoes.loja", "excluir"),
  ]);
  const validade = registro ? resumirCertificadoDashboard(registro, new Date()) : null;
  const certificado = registro ? { arquivoNome: registro.arquivoNome, titular: registro.titular, validoAte: registro.validoAte?.toISOString() ?? null, diasParaVencer: validade?.diasParaVencer ?? null, atualizadoPorNome: registro.atualizadoPor?.nome ?? null, updatedAt: registro.updatedAt.toISOString() } : null;
  return <MolduraIntegracoes resumo={resumo} ativa="certificado">
    <section aria-label="Certificado A1" className="space-y-3">
      <div><p className="text-label uppercase text-muted-foreground">Integração</p><h2 className="font-heading text-title">Certificado A1</h2><p className="text-sm text-muted-foreground">Certificado digital local da empresa, compartilhado pelas rotinas fiscais. A situação do certificado no Brasil NFe é conferida na conexão Brasil NFe.</p></div>
      <CertificadoCard certificado={certificado} podeEditar={sessao.admin && editar} podeExcluir={sessao.admin && excluir} />
    </section>
  </MolduraIntegracoes>;
}
