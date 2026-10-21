import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { lerPreparacaoPilotosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/piloto-local";
import { obterPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos";
import { pendenciasHomologacaoBrasilNfe, lerResultadoHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/homologacao";
import { hojeCivilRegraBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { PilotosBrasilNfe } from "./pilotos-client";
import { baseHomologacaoControladaDisponivel } from "@/lib/fiscal-saida/brasilnfe/capacidade-homologacao";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
export default async function HomologacaoBrasilNfePage() {
  const sessao = await exigirPermissao("vendas.fiscal", "visualizar");
  await exigirPermissao("configuracoes.brasilnfe", "visualizar");
  if (!baseHomologacaoControladaDisponivel()) return <Card><CardHeader><CardTitle>Homologação individual bloqueada neste ambiente</CardTitle><CardDescription>Os cenários sintéticos e a execução controlada estão disponíveis somente no banco administrativo isolado. Produção, emissão automática e callback permanecem bloqueados.</CardDescription></CardHeader></Card>;
  const [pilotos, pre, editar] = await Promise.all([lerPreparacaoPilotosBrasilNfe(sessao), obterPreRequisitosBrasilNfe(sessao), podeAcessar("vendas.fiscal", "editar")]);
  const resultados = await Promise.all(pilotos.map(p => lerResultadoHomologacaoBrasilNfe(p.documentoId, sessao)));
  return <PilotosBrasilNfe pilotos={pilotos} editar={editar} resultados={resultados} pendenciasExternas={{ nfe: pendenciasHomologacaoBrasilNfe(pre, 55, hojeCivilRegraBrasilNfe()), nfce: pendenciasHomologacaoBrasilNfe(pre, 65, hojeCivilRegraBrasilNfe()) }} />;
}
