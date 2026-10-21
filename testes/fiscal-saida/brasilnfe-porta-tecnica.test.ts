import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sim = vi.hoisted(() => ({ usuario: null as unknown, documento: null as unknown, aprovado: null as unknown, buscarPlano: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (f: (tx: unknown) => Promise<unknown>) => f({
  $executeRaw: vi.fn().mockResolvedValue(0), usuario: { findUnique: vi.fn(async () => sim.usuario) }, documentoFiscalSaida: { findUnique: vi.fn(async () => sim.documento) },
}) } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regras-tributarias", () => ({ obterComplementosAprovadosDocumentoBrasilNfe: sim.buscarPlano }));
import { criarPortaTecnicaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/porta-tecnica";
import { prepararPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { sanitizarHtmlNfceBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/arquivos";
import { obterAdaptadorFiscalSaida } from "@/lib/fiscal-saida/provedor";
import type { SessaoAtual } from "@/lib/session";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { chaveFicticia } from "./brasilnfe-fixtures";

const sessao: SessaoAtual = { userId: "usuario-ficticio", versao: 1, nome: "Usuário fictício", email: "usuario@example.test", admin: false, permissoes: {}, excecoes: {}, perfilNome: "Teste" };
const identidade = { documentoId: "documento-ficticio", ambiente: "HOMOLOGACAO" as const, chaveIdempotencia: "documento-ficticio", emitenteCnpj: "00000000000000", modeloDocumento: 55 as const, referencia: null };
const usuario = () => ({ id: sessao.userId, ativo: true, excluidoEm: null, sessaoVersao: 1, perfilAcesso: { sistema: "PERSONALIZADO", permissoes: { "vendas.fiscal": ["visualizar", "editar"], "vendas.pedidos": ["visualizar"] } }, permissoesPersonalizadas: {} });
const documento = () => ({ ...massaPayloadLocal().documento, ambiente: "HOMOLOGACAO", modeloDocumento: 55, provedor: "BRASIL_NFE", status: "AUTORIZADO", chaveFiscal: chaveFicticia(), numero: "123", serie: "1", protocolo: "90071992547409930001", protocoloCancelamento: null, cancelamentoPendente: false, Token: "segredo-ficticio-nao-projetado" });
beforeEach(() => {
  sim.usuario = usuario(); sim.documento = documento();
  const m = massaPayloadLocal();
  sim.aprovado = { planoId: "plano-ficticio", modelo: 55, resultado: prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros) };
  sim.buscarPlano.mockImplementation(async () => sim.aprovado);
});
describe("Ponte técnica servidor sem liberação operacional", () => {
  it("devolve somente montagem original aprovada e vinculada à fotografia", async () => {
    const p = criarPortaTecnicaBrasilNfe(sessao), m = massaPayloadLocal();
    const r = await p.preparar(identidade, m.documento.payload);
    expect(r).toBe((sim.aprovado as { resultado: unknown }).resultado);
    expect(r).toMatchObject({ documentoId: identidade.documentoId, montagemConcluida: true, transmissaoPermitida: false });
    expect(sim.buscarPlano).toHaveBeenCalledExactlyOnceWith(identidade.documentoId, sessao);
  });
  it("ordem de propriedades JSONB não invalida o hash histórico nem reescreve fotografia", async () => {
    const p = criarPortaTecnicaBrasilNfe(sessao), m = massaPayloadLocal();
    const reordenada = Object.fromEntries(Object.entries(m.documento.payload).reverse());
    const hashAnterior = (sim.documento as { hashPayload: string }).hashPayload;
    expect((await p.preparar(identidade, reordenada)).montagemConcluida).toBe(true);
    expect((sim.documento as { hashPayload: string }).hashPayload).toBe(hashAnterior);
  });
  it("fotografia comercial divergente não chega ao plano nem recebe valores corrigidos", async () => {
    const m = massaPayloadLocal(); m.documento.payload.valores.total = "999.99";
    await expect(criarPortaTecnicaBrasilNfe(sessao).preparar(identidade, m.documento.payload)).rejects.toMatchObject({ codigo: "VINCULO_INVALIDO" });
    expect(sim.buscarPlano).not.toHaveBeenCalled();
  });
  it("plano ausente, incompleto ou vinculado a outro hash/modelo não é usado", async () => {
    const m = massaPayloadLocal(), r = prepararPayloadLocalBrasilNfe(m.documento, 55, m.cadastro, m.parametros);
    for (const caso of [null, { modelo: 55, resultado: { ...r, montagemConcluida: false } }, { modelo: 65, resultado: r }, { modelo: 55, resultado: { ...r, hashPayload: "a".repeat(64) } }]) {
      sim.aprovado = caso;
      await expect(criarPortaTecnicaBrasilNfe(sessao).preparar(identidade, m.documento.payload)).rejects.toMatchObject({ codigo: "PLANO_PENDENTE" });
    }
  });
  it.each(["sessao", "inativo", "excluido", "pedidos", "fiscal"])("revogação %s bloqueia provas no servidor apesar do admin recebido", async caso => {
    const u = usuario();
    if (caso === "sessao") u.sessaoVersao = 2;
    if (caso === "inativo") u.ativo = false;
    if (caso === "excluido") Object.assign(u, { excluidoEm: new Date() });
    if (caso === "pedidos") u.perfilAcesso.permissoes["vendas.pedidos"] = [];
    if (caso === "fiscal") u.perfilAcesso.permissoes["vendas.fiscal"] = [];
    sim.usuario = u;
    await expect(criarPortaTecnicaBrasilNfe({ ...sessao, admin: true }).obterAutorizacao(identidade)).rejects.toMatchObject({ codigo: "ACESSO_NEGADO" });
  });
  it("visualizador fiscal pode ler provas, mas não preparar montagem para operação", async () => {
    const u = usuario(); u.perfilAcesso.permissoes["vendas.fiscal"] = ["visualizar"]; sim.usuario = u;
    const p = criarPortaTecnicaBrasilNfe(sessao);
    expect(await p.obterAutorizacao(identidade)).toMatchObject({ protocolo: "90071992547409930001" });
    await expect(p.preparar(identidade, massaPayloadLocal().documento.payload)).rejects.toMatchObject({ codigo: "ACESSO_NEGADO" });
  });
  it("somente a regra central do administrador concede leitura, sem liberar transmissão", async () => {
    const u = usuario(); u.perfilAcesso.sistema = "ADMINISTRADOR"; u.perfilAcesso.permissoes["vendas.fiscal"] = []; sim.usuario = u;
    const p = criarPortaTecnicaBrasilNfe(sessao);
    expect(await p.obterAutorizacao(identidade)).toMatchObject({ chave: chaveFicticia() });
    for (const operacao of ["ENVIAR", "CANCELAR", "CONSULTAR", "DOCUMENTOS"] as const) await expect(p.autorizar(operacao, identidade)).rejects.toThrow("bloqueados");
    expect(obterAdaptadorFiscalSaida()).toBeNull();
  });
  it.each(["emitente", "modelo", "ambiente", "provedor"])("vínculo %s divergente impede reutilizar provas", async caso => {
    const d = documento();
    if (caso === "emitente") d.payload.emitente.cnpj = "11111111111111";
    if (caso === "modelo") d.modeloDocumento = 65;
    if (caso === "ambiente") d.ambiente = "PRODUCAO";
    if (caso === "provedor") d.provedor = "OUTRO";
    sim.documento = d;
    await expect(criarPortaTecnicaBrasilNfe(sessao).obterAutorizacao(identidade)).rejects.toMatchObject({ codigo: "VINCULO_INVALIDO" });
  });
  it("getter projeta protocolos e estado incerto sem payload, credenciais ou texto livre", async () => {
    sim.documento = { ...documento(), status: "PENDENTE_CONFERENCIA", cancelamentoPendente: true, protocoloCancelamento: "90071992547409930002", ultimoErro: "mensagem-privada-ficticia" };
    const dados = await criarPortaTecnicaBrasilNfe(sessao).obterAutorizacao(identidade);
    expect(dados).toEqual({ chave: chaveFicticia(), numero: "123", serie: "1", protocolo: "90071992547409930001", protocoloCancelamento: "90071992547409930002", cancelamentoPendente: true });
    expect(JSON.stringify(dados)).not.toMatch(/segredo|mensagem|payload|Token/);
  });
  it("pedido preparado/rejeitado/denegado ou prova incompleta nunca recebe autorização fabricada", async () => {
    const p = criarPortaTecnicaBrasilNfe(sessao);
    for (const status of ["SEM_EMISSOR", "PREPARADO", "REJEITADO", "DENEGADO", "INCERTO", "PENDENTE_CONFERENCIA"]) {
      sim.documento = { ...documento(), status }; expect(await p.obterAutorizacao(identidade)).toBeNull();
    }
    sim.documento = { ...documento(), protocolo: null }; expect(await p.obterAutorizacao(identidade)).toBeNull();
  });
  it("HTML estático pode ser sanitizado novamente no armazenamento sem mudar conteúdo/hash", () => {
    const bruto = `<html><body><table><tr><td colspan="2" class="destaque">NF&amp;C-e fictícia</td></tr></table><p>${chaveFicticia(65)}</p><br /></body></html>`;
    const primeira = sanitizarHtmlNfceBrasilNfe(Buffer.from(bruto), chaveFicticia(65));
    const segunda = sanitizarHtmlNfceBrasilNfe(Buffer.from(primeira), chaveFicticia(65));
    expect(segunda).toBe(primeira); expect(segunda).not.toContain('class="');
  });
});
