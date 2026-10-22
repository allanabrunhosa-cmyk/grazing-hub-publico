import { redirect } from "next/navigation";
import { CentralConfiguracoesFiscais } from "./central";
import { RECURSOS_CONFIGURACAO_FISCAL } from "@/lib/permissoes/fiscal";
import { BlocoEmissorFiscal } from "./emissor";
import { EmpresaFiscalCard } from "./empresa-card";
import { OperacaoFiscal } from "./operacao";
import { exigirSessao, podeAcessar } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { obterNumeracaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao";
import { consultarNumeracaoFiscalBrasilNfeAction, atualizarNumeracaoFiscalBrasilNfeAction } from "../numeracao/actions";
import { NumeracaoFiscal } from "../numeracao/numeracao-client";
import { CertificadoCard } from "@/app/(protegido)/configuracoes/certificado-card";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function ConfiguracoesFiscaisPage() {
  const sessao = await exigirSessao();
  if (!(await Promise.all(RECURSOS_CONFIGURACAO_FISCAL.map(r => podeAcessar(r)))).some(Boolean)) redirect("/sem-acesso");
  const podeVerNumeracao = (await Promise.all(["vendas.fiscal", "financeiro.fiscal.painel", "configuracoes.brasilnfe"].map(r => podeAcessar(r)))).some(Boolean);
  const podeVerCertificado = await podeAcessar("configuracoes.loja");
  const [dados, podeConsultar, certificado] = await Promise.all([
    podeVerNumeracao ? obterNumeracaoFiscalBrasilNfe(sessao) : null, podeAcessar("configuracoes.brasilnfe", "editar"),
    podeVerCertificado ? prisma.certificadoDigital.findUnique({ where: { id: "singleton" }, select: { arquivoNome: true, titular: true, validoAte: true, updatedAt: true, atualizadoPor: { select: { nome: true } } } }) : null,
  ]);
  const validade = certificado ? resumirCertificadoDashboard(certificado, new Date()) : null;
  const certificadoInfo = certificado ? { arquivoNome: certificado.arquivoNome, titular: certificado.titular, validoAte: certificado.validoAte?.toISOString() ?? null, diasParaVencer: validade?.diasParaVencer ?? null, atualizadoPorNome: certificado.atualizadoPor?.nome ?? null, updatedAt: certificado.updatedAt.toISOString() } : null;
  const podeEditar = sessao.admin && await podeAcessar("configuracoes.loja", "editar");
  const podeExcluir = sessao.admin && await podeAcessar("configuracoes.loja", "excluir");
  return <CentralConfiguracoesFiscais
    operacao={<OperacaoFiscal administrarAcessos={await podeAcessar("configuracoes.usuarios")} administradorFiscal={sessao.admin && await podeAcessar("vendas.fiscal", "editar")} />}
    empresa={await podeAcessar("vendas.fiscal") ? <EmpresaFiscalCard /> : <AvisoAcesso titulo="Empresa" motivo="Consultar o regime fiscal exige acesso aos cadastros fiscais." />}
    emissor={await podeAcessar("configuracoes.brasilnfe") ? <BlocoEmissorFiscal /> : <AvisoAcesso titulo="Emissor e CSC" motivo="Consultar conexão, credenciais e CSC exige acesso à integração Brasil NFe." />}
    certificado={podeVerCertificado ? <CertificadoCard certificado={certificadoInfo} podeEditar={podeEditar} podeExcluir={podeExcluir} /> : <AvisoAcesso titulo="Certificado digital" motivo="A administração do certificado exige acesso aos dados da empresa." />}
    numeracao={dados ? <NumeracaoFiscal semCabecalho inicial={dados} consultar={consultarNumeracaoFiscalBrasilNfeAction} atualizar={atualizarNumeracaoFiscalBrasilNfeAction} podeConsultar={podeConsultar} /> : <AvisoAcesso titulo="Séries e numeração" motivo="Consultar os contadores exige acesso ao Fiscal ou à integração Brasil NFe." />}
  />;
}

function AvisoAcesso({ titulo, motivo }: { titulo: string; motivo: string }) { return <Card className="vidro-painel"><CardHeader><CardTitle>{titulo}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{motivo}</p></CardContent></Card>; }
