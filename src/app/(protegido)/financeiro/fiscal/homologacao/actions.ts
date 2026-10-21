"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prepararCenariosPilotoBrasilNfe, separarRepresentacaoIpiPilotoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/piloto-local";
import { aprovarRevisaoPilotoBrasilNfe, concluirVinculosPilotoBrasilNfe, ErroVinculoPilotoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/revisao-piloto";
import { transmitirUmaHomologacaoBrasilNfe, consultarHomologacaoBrasilNfe, baixarDocumentosHomologacaoBrasilNfe, ErroHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/homologacao";
import { ErroRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { ErroXmlHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/xml-homologacao";
async function agir(operacao: (sessao: Awaited<ReturnType<typeof exigirPermissao>>) => Promise<unknown>) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try {
    await operacao(sessao);
    for (const path of ["/financeiro/fiscal", "/financeiro/fiscal/homologacao", "/financeiro/fiscal/regras-brasilnfe", "/vendas/pedidos"]) revalidatePath(path);
    return { ok: true as const };
  } catch (e) {
    revalidatePath("/financeiro/fiscal/homologacao");
    return { erro: e instanceof ErroHomologacaoBrasilNfe || e instanceof ErroRegraFiscalBrasilNfe || e instanceof ErroXmlHomologacaoBrasilNfe || e instanceof ErroVinculoPilotoBrasilNfe ? e.message : "A ação não foi concluída. Confira as pendências e o histórico; não repetir transmissão." };
  }
}
export async function prepararPilotosBrasilNfeAction() { return agir(prepararCenariosPilotoBrasilNfe); }
export async function separarIpiPilotoBrasilNfeAction() { return agir(separarRepresentacaoIpiPilotoBrasilNfe); }
export async function aprovarPilotosBrasilNfeAction(entrada: unknown) { return agir(s => aprovarRevisaoPilotoBrasilNfe(entrada, s)); }
export async function concluirManifestosPilotoBrasilNfeAction() { return agir(concluirVinculosPilotoBrasilNfe); }
export async function transmitirPilotoBrasilNfeAction(entrada: unknown) { return agir(s => transmitirUmaHomologacaoBrasilNfe(entrada, s)); }
export async function consultarPilotoBrasilNfeAction(id: string) { return agir(s => consultarHomologacaoBrasilNfe(id, s)); }
export async function documentosPilotoBrasilNfeAction(id: string) { return agir(s => baixarDocumentosHomologacaoBrasilNfe(id, s)); }
