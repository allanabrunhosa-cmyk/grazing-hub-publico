import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { obterNumeracaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao";
import { consultarNumeracaoFiscalBrasilNfeAction, atualizarNumeracaoFiscalBrasilNfeAction } from "../numeracao/actions";
import { NumeracaoFiscal } from "../numeracao/numeracao-client";
import { CertificadoCard } from "@/app/(protegido)/configuracoes/certificado-card";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function ConfiguracoesFiscaisPage() {
  const sessao = await exigirPermissao("financeiro.fiscal.painel");
  const podeVerCertificado = await podeAcessar("configuracoes.loja");
  const [dados, podeConsultar, certificado] = await Promise.all([
    obterNumeracaoFiscalBrasilNfe(sessao), podeAcessar("configuracoes.brasilnfe", "editar"),
    podeVerCertificado ? prisma.certificadoDigital.findUnique({ where: { id: "singleton" }, select: { arquivoNome: true, titular: true, validoAte: true, updatedAt: true, atualizadoPor: { select: { nome: true } } } }) : null,
  ]);
  const validade = certificado ? resumirCertificadoDashboard(certificado, new Date()) : null;
  const certificadoInfo = certificado ? { arquivoNome: certificado.arquivoNome, titular: certificado.titular, validoAte: certificado.validoAte?.toISOString() ?? null, diasParaVencer: validade?.diasParaVencer ?? null, atualizadoPorNome: certificado.atualizadoPor?.nome ?? null, updatedAt: certificado.updatedAt.toISOString() } : null;
  const podeEditar = sessao.admin && await podeAcessar("configuracoes.loja", "editar");
  const podeExcluir = sessao.admin && await podeAcessar("configuracoes.loja", "excluir");
  return <NumeracaoFiscal inicial={dados} consultar={consultarNumeracaoFiscalBrasilNfeAction} atualizar={atualizarNumeracaoFiscalBrasilNfeAction} podeConsultar={podeConsultar}
    certificado={podeVerCertificado ? <CertificadoCard certificado={certificadoInfo} podeEditar={podeEditar} podeExcluir={podeExcluir} /> : <Card className="vidro-painel"><CardHeader><CardTitle>Certificado digital</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">A administração do certificado exige acesso aos dados da empresa.</p></CardContent></Card>} />;
}
