"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { obterConfiguracaoBrasilNfe, salvarConfiguracaoBrasilNfe, validarConexaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao";
import { ErroConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dominio";
import type { ResultadoConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dto";
import { obterPreRequisitosBrasilNfe, registrarEvidenciaPainelBrasilNfe, verificarPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos";
import type { ResultadoPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { configurarHabilitacaoEmissaoBrasilNfe, obterHabilitacaoEmissaoBrasilNfe, ErroEmissaoPedidoBrasilNfe, type ResultadoControleEmissaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
export async function obterConfiguracaoBrasilNfeAction(): Promise<ResultadoConfiguracaoBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "visualizar");
  try { return { ok: true, dados: await obterConfiguracaoBrasilNfe(sessao) }; }
  catch { return { ok: false, erro: "Configuração indisponível. Conferir a migration e o cadastro da empresa no ambiente autorizado." }; }
}
export async function salvarConfiguracaoBrasilNfeAction(entrada: unknown): Promise<ResultadoConfiguracaoBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  try { const dados = await salvarConfiguracaoBrasilNfe(entrada, sessao); revalidatePath("/configuracoes/integracoes/brasilnfe"); return { ok: true, dados }; }
  catch (e) { return { ok: false, erro: e instanceof ErroConfiguracaoBrasilNfe ? e.message : "Não foi possível salvar. Conferir migration, versão e chave externa de criptografia do servidor." }; }
}
export async function validarConexaoBrasilNfeAction(entrada: unknown): Promise<ResultadoConfiguracaoBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  try {
    const { detalhesDiagnostico, ...dados } = await validarConexaoBrasilNfe(entrada, sessao);
    revalidatePath("/configuracoes/integracoes/brasilnfe");
    return { ok: true, dados, ...(detalhesDiagnostico ? { detalhesDiagnostico } : {}) };
  }
  catch (e) { return { ok: false, erro: e instanceof ErroConfiguracaoBrasilNfe ? e.message : "Diagnóstico indisponível. Nenhuma transmissão foi autorizada." }; }
}
export async function obterPreRequisitosBrasilNfeAction(): Promise<ResultadoPreRequisitosBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "visualizar");
  try { return { ok: true, dados: await obterPreRequisitosBrasilNfe(sessao) }; }
  catch { return { ok: false, erro: "Pré-requisitos indisponíveis no ambiente autorizado." }; }
}
export async function registrarEvidenciaPainelBrasilNfeAction(entrada: unknown): Promise<ResultadoPreRequisitosBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  try { const dados = await registrarEvidenciaPainelBrasilNfe(entrada, sessao); revalidatePath("/configuracoes/integracoes/brasilnfe"); return { ok: true, dados }; }
  catch (e) { return { ok: false, erro: e instanceof ErroConfiguracaoBrasilNfe ? e.message : "Não foi possível registrar os estados do painel." }; }
}
export async function verificarPreRequisitosBrasilNfeAction(entrada: unknown): Promise<ResultadoPreRequisitosBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  try { const dados = await verificarPreRequisitosBrasilNfe(entrada, sessao); revalidatePath("/configuracoes/integracoes/brasilnfe"); return { ok: true, dados }; }
  catch (e) { return { ok: false, erro: e instanceof ErroConfiguracaoBrasilNfe ? e.message : "Conferência de leitura indisponível; nenhuma transmissão foi autorizada." }; }
}
export async function obterHabilitacaoEmissaoBrasilNfeAction(): Promise<ResultadoControleEmissaoBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "visualizar");
  await exigirPermissao("vendas.fiscal", "editar");
  try { return { ok: true, dados: await obterHabilitacaoEmissaoBrasilNfe(sessao) }; }
  catch { return { ok: false, erro: "Controle manual indisponível. Confira os pré-requisitos e a configuração protegida deste ambiente." }; }
}
export async function configurarHabilitacaoEmissaoBrasilNfeAction(entrada: unknown): Promise<ResultadoControleEmissaoBrasilNfe> {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  await exigirPermissao("vendas.fiscal", "editar");
  try {
    await configurarHabilitacaoEmissaoBrasilNfe(entrada, sessao);
    revalidatePath("/configuracoes/integracoes/brasilnfe"); revalidatePath("/financeiro/fiscal"); revalidatePath("/vendas/pedidos");
    return { ok: true, dados: await obterHabilitacaoEmissaoBrasilNfe(sessao) };
  } catch (e) { return { ok: false, erro: e instanceof ErroEmissaoPedidoBrasilNfe ? e.message : "Não foi possível atualizar a habilitação manual. Nenhuma nota foi transmitida." }; }
}
