import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ guarda: vi.fn(), pode: vi.fn(), loja: vi.fn(), certificado: vi.fn(), servicos: vi.fn(), query: vi.fn(), habilitacoes: vi.fn(), tabelaOpcional: false,
  registroOpcional: null as unknown, secoes: [] as { id: string; rota: string }[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.guarda, podeAcessar: sim.pode }));
vi.mock("@/lib/permissoes/catalogo", () => ({ SECOES: sim.secoes }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoLoja: { findUnique: sim.loja }, notaFiscalServico: { findMany: sim.servicos }, certificadoDigital: { findUnique: sim.certificado }, eventoConfiguracaoBrasilNfe: { findMany: sim.habilitacoes }, $queryRaw: sim.query } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regime-empresa", () => ({ obterRegimeFiscalEmpresaBrasilNfe: vi.fn(async () => ({ dia: "2026-10-14", regime: null, crt: null, descricaoCrt: null, ie: null, vigenteDesde: null, vigenteAte: null, modelos: {55:null,65:null}, pendencias: [], verificacoes: [] })) }));
import { AgregadorDashboardFiscal } from "@/lib/fiscal-dashboard/agregacao";
import { normalizarNotaRecebidaDashboard, obterDashboardFiscal } from "@/lib/fiscal-dashboard/servidor";
import { cancelamentoDashboard, chaveDashboard, cnpjEmitenteDashboard, cnpjFornecedorDashboard, resumoCancelamentoDashboard, resumoDashboard, saidaDashboard, xmlDashboard } from "./fixtures";
const sqlDaConsulta = (consulta: unknown): string => Array.isArray(consulta) ? consulta.join("") : (consulta as { sql: string }).sql;
function configuracaoOpcionalMock(consulta: unknown): unknown[] | null {
  const sql = sqlDaConsulta(consulta);
  if (sql.includes("to_regclass")) return [{ existe: sim.tabelaOpcional }];
  if (sql.includes('FROM "ConfiguracaoBrasilNfe"')) return sim.registroOpcional ? [sim.registroOpcional] : [];
  return null;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("BRASIL_NFE_AMBIENTE", "");
  sim.guarda.mockResolvedValue({ admin: true }); sim.pode.mockResolvedValue(false);
  sim.loja.mockResolvedValue({ id: "singleton", nome: "Emitente sintético", cnpj: cnpjEmitenteDashboard, enderecoEstruturado: null });
  sim.certificado.mockResolvedValue(null); sim.servicos.mockResolvedValue([]);
  sim.habilitacoes.mockResolvedValue([]);
  sim.tabelaOpcional = false; sim.registroOpcional = null; sim.secoes.splice(0);
  sim.query.mockImplementation(async consulta => configuracaoOpcionalMock(consulta) ?? []);
});
const nota = (opcoes: Partial<Parameters<typeof normalizarNotaRecebidaDashboard>[0]> = {}) => ({
  id: "recebida-sintetica", chaveAcesso: chaveDashboard(55, cnpjFornecedorDashboard), xml: null,
  valorTotal: "999.99", dataEmissao: new Date("2026-10-03T15:00:00Z"), documentosSefaz: [resumoDashboard()], ...opcoes,
});
describe("Leitura autorizada e páginas fiscais", () => {
  it("inclui NFS-e apenas do tomador, ambiente comprovado e data de emissão", async () => {
    const base = { id: "nfs-sintetica", numero: "1", status: "ACEITA", origem: "NACIONAL", importadaManualmente: false, dataEmissao: new Date("2026-10-03T15:00:00Z"), valorServico: { toFixed: () => "32.17" }, xml: `<NFSe><infNFSe><dhEmi>2026-10-03T12:00:00-03:00</dhEmi><tpAmb>1</tpAmb><tomador><CNPJ>${cnpjEmitenteDashboard}</CNPJ></tomador></infNFSe></NFSe>` };
    sim.servicos.mockResolvedValue([base, { ...base, id: "homologacao", xml: base.xml.replace("<tpAmb>1", "<tpAmb>2") }, { ...base, id: "outro-mes", xml: base.xml.replace("2026-10-03", "2026-09-30") }, { ...base, id: "cancelada", status: "CANCELADA" }]);
    const dados = await obterDashboardFiscal({ de: "2026-10-01", ate: "2026-10-31" });
    expect(dados.metricas.entradas).toMatchObject({ valor: "32.17", quantidade: 1 });
    expect(dados.documentosPorTipo?.NFS_ENTRADA).toBe(2);
    expect(sim.servicos.mock.calls[0][0].where.AND).toContainEqual({ tomadorCnpj: cnpjEmitenteDashboard });
    expect(JSON.stringify(dados)).not.toContain("<NFSe");
  });
  it.each(["ambiente", "data", "xml", "falha"])("NFS-e com lacuna de %s não produz zero fictício", async lacuna => {
    const xml = `<NFSe><dhEmi>2026-10-03</dhEmi>${lacuna === "ambiente" ? "" : "<tpAmb>1</tpAmb>"}</NFSe>`;
    if (lacuna === "falha") sim.servicos.mockRejectedValue(new Error("DETALHE_PRIVADO_SINTETICO"));
    else sim.servicos.mockResolvedValue([{ id: "incompleta", numero: null, status: "PENDENTE", origem: "ARQUIVO", importadaManualmente: true, xml: lacuna === "xml" ? xml + "<invalido>" : lacuna === "data" ? xml.replace("2026-10-03", "2026-02-30") : xml, dataEmissao: null, valorServico: null }]);
    const dados = await obterDashboardFiscal({ mes: "2026-10" });
    expect(dados.metricas.entradas.valor).toBeNull();
    expect(JSON.stringify(dados)).not.toContain("DETALHE_PRIVADO_SINTETICO");
  });
  it("projeção do controle manual exige só a permissão do painel e não carrega credenciais nem cliente HTTP", async () => {
    sim.tabelaOpcional = true;
    const loja = await sim.loja(), emitenteHash = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
    sim.registroOpcional = { ambiente: "HOMOLOGACAO", versao: 3, tokenConfigurado: true, userTokenConfigurado: true, diagnostico: null, emitenteHash };
    sim.habilitacoes.mockResolvedValue([{ id: "habilitacao-ficticia", createdAt: new Date("2026-10-15T12:00:00.000Z"), dados: { revisao: 1, versaoConfiguracao: 3, emitenteHash, ambiente: "PRODUCAO", habilitada: true, modelos: [55], mensagemExterna: "TEXTO_PRIVADO_SINTETICO" } }]);
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(sim.guarda).toHaveBeenCalledExactlyOnceWith("financeiro.fiscal.painel");
    expect(sim.habilitacoes).toHaveBeenCalledExactlyOnceWith({ where: { configuracaoId: "singleton", tipo: "EMISSAO_MANUAL_HABILITACAO" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, dados: true, createdAt: true } });
    expect(dados.integracao.emissaoManual).toMatchObject({ nfe: true, nfce: false });
    expect(dados.pendencias.some(p => p.codigo === "EMISSAO_BLOQUEADA")).toBe(false);
    expect(dados.pendencias.some(p => p.codigo === "NFCE_MANUAL_BLOQUEADA")).toBe(true);
    expect(JSON.stringify(dados)).not.toContain("TEXTO_PRIVADO_SINTETICO");
  });
  it("nega acesso antes de tocar dados fiscais", async () => {
    sim.guarda.mockRejectedValue(new Error("Sem acesso"));
    await expect(obterDashboardFiscal({ mes: "2026-10" })).rejects.toThrow("Sem acesso");
    expect(sim.loja).not.toHaveBeenCalled(); expect(sim.query).not.toHaveBeenCalled(); expect(sim.certificado).not.toHaveBeenCalled();
  });
  it("exibe a validade de Dados da empresa sem ler ou devolver arquivo, senha ou identidade do certificado", async () => {
    sim.certificado.mockResolvedValue({ validoAte: new Date("2026-11-07T12:00:00Z"), arquivoData: "ARQUIVO_PRIVADO_SINTETICO", senhaCifrada: "SENHA_PRIVADA_SINTETICA", titular: "TITULAR_PRIVADO_SINTETICO" });
    const dados = await obterDashboardFiscal({ mes: "2026-09", ambiente: "HOMOLOGACAO" }, new Date("2026-10-12T12:00:00Z"));
    expect(sim.certificado).toHaveBeenCalledExactlyOnceWith({ where: { id: "singleton" }, select: { validoAte: true } });
    expect(dados.integracao.certificado).toEqual({ situacao: "A_VENCER", validoAte: "2026-11-07T12:00:00.000Z", diasParaVencer: 26 });
    expect(dados.integracao).toMatchObject({ configurada: false, situacao: "NAO_CONFIGURADA", emissaoHabilitada: false });
    for (const segredo of ["arquivoData", "senhaCifrada", "titular", "ARQUIVO_PRIVADO_SINTETICO", "SENHA_PRIVADA_SINTETICA", "TITULAR_PRIVADO_SINTETICO"]) expect(JSON.stringify(dados)).not.toContain(segredo);
  });
  it("falha na leitura da validade conserva o dashboard e não expõe erro ou data presumida", async () => {
    sim.certificado.mockRejectedValue(new Error("ERRO_PRIVADO_CERTIFICADO"));
    const dados = await obterDashboardFiscal({ mes: "2026-10" });
    expect(dados.integracao.certificado).toEqual({ situacao: "NAO_VERIFICADO", validoAte: null, diasParaVencer: null });
    expect(dados.metricas.faturamento.valor).toBe("0.00");
    expect(JSON.stringify(dados)).not.toContain("ERRO_PRIVADO_CERTIFICADO");
  });
  it("retorna somente o contrato agregado e links concedidos, sem dados comerciais ou credenciais", async () => {
    sim.query.mockImplementation(async consulta => configuracaoOpcionalMock(consulta)
      ?? (sqlDaConsulta(consulta).includes('"DocumentoFiscalSaida"') ? [saidaDashboard()]
        : sqlDaConsulta(consulta).includes('FROM "NotaFiscalRecebida"') ? [nota()]
        : [{ chave: chaveDashboard(55, cnpjFornecedorDashboard), xml: resumoDashboard() }]));
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.faturamento.valor).toBe("125.37"); expect(dados.metricas.entradas.valor).toBe("50.01");
    expect(dados.links).toEqual({ grupos: null, vinculos: null, notasRecebidas: null, configuracao: null });
    expect(dados.ultimosDocumentos.find(d => d.origem === "SAIDA")?.pedidoId).toBeNull();
    expect(dados.ultimosDocumentos.find(d => d.origem === "SAIDA")?.pedidoNumero).toBeNull();
    expect(JSON.stringify(dados)).not.toContain("<nfeProc");
    expect(JSON.stringify(dados)).not.toContain("999.99");
  });
  it("paginação não trunca o ambiente e aplica competência na fonte, sem datas ou totais comerciais", async () => {
    const documentos = Array.from({ length: 101 }, (_, i) => saidaDashboard({ id: `pagina-${String(i).padStart(3, "0")}` }));
    sim.query.mockImplementation(async consulta => {
      const configuracao = configuracaoOpcionalMock(consulta); if (configuracao) return configuracao;
      if (!sqlDaConsulta(consulta).includes('"DocumentoFiscalSaida"')) return [];
      return consulta.values[0] === "" ? documentos.slice(0, 100) : documentos.slice(100);
    });
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.faturamento).toMatchObject({ valor: "12662.37", quantidade: 101 });
    const consultasSaida = sim.query.mock.calls.map(([sql]) => sql).filter(sql => sqlDaConsulta(sql).includes('"DocumentoFiscalSaida"'));
    expect(consultasSaida).toHaveLength(2);
    expect(consultasSaida[1].values[0]).toBe("pagina-099");
    for (const sql of consultasSaida) {
      expect(sql.values).toContain("PRODUCAO"); expect(sql.values).toContain("%2026-10-%"); expect(sql.values).toContain(100);
      expect(sql.sql).not.toMatch(/createdAt|updatedAt|confirmadoEm|p\.total/);
    }
  });
  it("fonte SEFAZ de produção não apresenta zero fictício em homologação", async () => {
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "HOMOLOGACAO" });
    expect(dados.metricas.entradas).toMatchObject({ valor: null, quantidade: null });
    expect(dados.metricas.entradas.motivo).toContain("somente produção");
    expect(sim.query.mock.calls.some(([consulta]) => sqlDaConsulta(consulta).includes('FROM "NotaFiscalRecebida"'))).toBe(false);
  });
  it("falhas de fonte são indisponibilidade, sem exposição de mensagens internas", async () => {
    sim.query.mockImplementation(async consulta => {
      const configuracao = configuracaoOpcionalMock(consulta); if (configuracao) return configuracao;
      throw new Error("SEGREDO_CONEXAO_PRIVADA");
    });
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.faturamento.valor).toBeNull(); expect(dados.metricas.entradas.valor).toBeNull();
    expect(dados.metricas.canceladas.valor).toBeNull(); expect(JSON.stringify(dados)).not.toContain("SEGREDO_CONEXAO_PRIVADA");
  });
  it("links de operação exigem permissões próprias, independentemente da permissão do painel", async () => {
    sim.tabelaOpcional = true;
    sim.secoes.push({ id: "configuracoes.brasilnfe", rota: "/configuracoes/integracoes/brasilnfe" });
    sim.pode.mockImplementation(async recurso => ["vendas.fiscal", "configuracoes.brasilnfe", "vendas.pedidos"].includes(recurso));
    sim.query.mockImplementation(async consulta => configuracaoOpcionalMock(consulta) ?? (sqlDaConsulta(consulta).includes('"DocumentoFiscalSaida"') ? [saidaDashboard()] : []));
    const dados = await obterDashboardFiscal({ mes: "2026-10" });
    expect(dados.links.grupos).toBe("/financeiro/fiscal/grupos"); expect(dados.links.notasRecebidas).toBeNull();
    expect(dados.links.configuracao).toBe("/configuracoes/integracoes/brasilnfe"); expect(dados.ultimosDocumentos[0].pedidoId).toBe("pedido-sintetico");
  });
  it("a main sem módulo Brasil NFe funciona sem model Prisma, tabela ou link de configuração", async () => {
    sim.pode.mockResolvedValue(true);
    const dados = await obterDashboardFiscal({ mes: "2026-10" });
    expect(dados.integracao).toMatchObject({ configurada: false, situacao: "NAO_CONFIGURADA", credenciaisConfiguradas: false });
    expect(dados.links.configuracao).toBeNull();
    expect(dados.metricas.faturamento.valor).toBe("0.00");
    expect(sim.pode).not.toHaveBeenCalledWith("configuracoes.brasilnfe");
    expect(sim.query.mock.calls.some(([consulta]) => sqlDaConsulta(consulta).includes('FROM "ConfiguracaoBrasilNfe"'))).toBe(false);
  });
  it("tabela opcional presente permite leitura pública sem inventar rota ausente, inclusive para administrador", async () => {
    sim.tabelaOpcional = true; sim.pode.mockResolvedValue(true);
    sim.registroOpcional = { ambiente: "HOMOLOGACAO", tokenConfigurado: true, userTokenConfigurado: true, diagnostico: null, emitenteHash: null,
      tokenCifrado: "ciphertext-sintetico-nao-cliente", userTokenCifrado: "usertoken-sintetico-nao-cliente" };
    const dados = await obterDashboardFiscal({ mes: "2026-10" });
    expect(dados.integracao).toMatchObject({ configurada: true, credenciaisConfiguradas: true, situacao: "NAO_VERIFICADA" });
    expect(dados.links.configuracao).toBeNull();
    expect(sim.pode).not.toHaveBeenCalledWith("configuracoes.brasilnfe");
    const consulta = sim.query.mock.calls.map(([valor]) => sqlDaConsulta(valor)).find(sql => sql.includes('FROM "ConfiguracaoBrasilNfe"'))!;
    expect(consulta).toMatch(/NULLIF\(c\."tokenCifrado",\s*''\)\s+IS NOT NULL AS "tokenConfigurado"/);
    expect(consulta).toMatch(/NULLIF\(c\."userTokenCifrado",\s*''\)\s+IS NOT NULL AS "userTokenConfigurado"/);
    // A referência dentro de NULLIF produz apenas uma flag. Seleção direta,
    // inclusive com outro alias, ou SELECT * continuam proibidos.
    expect(consulta).not.toMatch(/SELECT\s+\*|(?:SELECT|,)\s*c\."(?:tokenCifrado|userTokenCifrado)"\s*(?:AS\s+"?[a-zA-Z_][a-zA-Z_0-9]*"?\s*)?(?:,|FROM)/);
    expect(Object.keys(dados.integracao).sort()).toEqual(["ambienteConfigurado", "configurada", "credenciaisConfiguradas", "situacao", "verificadaEm", "servicos", "certificado", "emissaoHabilitada"].sort());
    expect(JSON.stringify(dados)).not.toContain("tokenCifrado"); expect(JSON.stringify(dados)).not.toContain("userTokenCifrado");
    expect(JSON.stringify(dados)).not.toContain("ciphertext-sintetico-nao-cliente"); expect(JSON.stringify(dados)).not.toContain("usertoken-sintetico-nao-cliente");
  });
  it("credenciais no ambiente geram apenas presença, sem expor token nem presumir homologação ou emissão", async () => {
    vi.stubEnv("BRASIL_NFE_AMBIENTE", "HOMOLOGACAO");
    vi.stubEnv("BRASIL_NFE_TOKEN", "segredo-token-sintetico");
    vi.stubEnv("BRASIL_NFE_USER_TOKEN", "segredo-user-sintetico");
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "HOMOLOGACAO" });
    expect(dados.integracao).toMatchObject({ configurada: true, ambienteConfigurado: "HOMOLOGACAO", credenciaisConfiguradas: true, situacao: "NAO_VERIFICADA", emissaoHabilitada: false });
    expect(dados.links.configuracao).toBeNull();
    expect(JSON.stringify(dados)).not.toContain("segredo-");
    expect(sim.query.mock.calls.some(([consulta]) => sqlDaConsulta(consulta).includes('FROM "ConfiguracaoBrasilNfe"'))).toBe(false);
  });
  it("ambiente inválido não é configuração reconhecida", async () => {
    vi.stubEnv("BRASIL_NFE_AMBIENTE", "modo-inventado");
    const dados = await obterDashboardFiscal({ mes: "2026-10" });
    expect(dados.integracao.configurada).toBe(false);
  });
  it("recurso de integração central sem tabela instalada não gera link quebrado", async () => {
    sim.secoes.push({ id: "configuracoes.brasilnfe", rota: "/configuracoes/integracoes/brasilnfe" }); sim.pode.mockResolvedValue(true);
    const dados = await obterDashboardFiscal({ mes: "2026-10" }); expect(dados.links.configuracao).toBeNull();
  });
  it("recurso e tabela de integração presentes ainda exigem permissão própria para o link", async () => {
    sim.tabelaOpcional = true; sim.secoes.push({ id: "configuracoes.brasilnfe", rota: "/configuracoes/integracoes/brasilnfe" });
    const dados = await obterDashboardFiscal({ mes: "2026-10" }); expect(dados.links.configuracao).toBeNull();
    expect(sim.pode).toHaveBeenCalledWith("configuracoes.brasilnfe");
  });
});

describe("Notas recebidas sem duplicação ou efeitos operacionais", () => {
  it("resumo e XML da mesma chave contam uma única nota com vNF oficial", () => {
    const entrada = normalizarNotaRecebidaDashboard(nota({ xml: xmlDashboard({ cnpj: cnpjFornecedorDashboard, destinatario: cnpjEmitenteDashboard, valor: "77.13" }) }), cnpjEmitenteDashboard);
    const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard); a.adicionarEntrada(entrada);
    expect(a.concluir().metricas.entradas).toEqual({ valor: "77.13", quantidade: 1, motivo: null });
    expect(a.concluir().ultimosDocumentos).toHaveLength(1);
  });
  it.each(["resumo", "evento"])("cancelamento do fornecedor em %s exclui entrada autorizada", tipo => {
    const xml = xmlDashboard({ cnpj: cnpjFornecedorDashboard, destinatario: cnpjEmitenteDashboard });
    const evidenciaCancelamento = tipo === "resumo" ? resumoDashboard("3") : cancelamentoDashboard({ chave: chaveDashboard(55, cnpjFornecedorDashboard) });
    const entrada = normalizarNotaRecebidaDashboard(nota({ xml, documentosSefaz: [resumoDashboard(), evidenciaCancelamento] }), cnpjEmitenteDashboard);
    const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard); a.adicionarEntrada(entrada);
    expect(a.concluir().metricas.entradas.valor).toBe("0.00");
    expect(a.concluir().pendencias).toContainEqual(expect.objectContaining({ codigo: "ENTRADAS_CANCELADAS", quantidade: 1 }));
  });
  it("XML de destinatário ou ambiente diferentes não contamina as entradas", () => {
    for (const opcoes of [{ destinatario: "22222222222222" }, { ambiente: "2" as const, destinatario: cnpjEmitenteDashboard }]) {
      const entrada = normalizarNotaRecebidaDashboard(nota({ xml: xmlDashboard({ cnpj: cnpjFornecedorDashboard, ...opcoes }), documentosSefaz: null }), cnpjEmitenteDashboard);
      const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard); a.adicionarEntrada(entrada);
      expect(a.concluir().metricas.entradas.valor).toBe("0.00");
    }
  });
  it("resEvento de cancelamento não permite somar silenciosamente a nota como autorizada", () => {
    const entrada = normalizarNotaRecebidaDashboard(nota({ documentosSefaz: [resumoDashboard(), resumoCancelamentoDashboard()] }), cnpjEmitenteDashboard);
    const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard); a.adicionarEntrada(entrada);
    expect(a.concluir().metricas.entradas).toMatchObject({ valor: null, quantidade: null });
    expect(a.concluir().pendencias).toContainEqual(expect.objectContaining({ codigo: "ENTRADAS_CANCELAMENTO_PENDENTE", quantidade: 1 }));
    expect(a.concluir().movimentoDiario.every(d => d.entradas === null)).toBe(true);
  });
  it("nota sem XML e sem diário não presume ambiente/autorização a partir do valor normalizado", () => {
    const entrada = normalizarNotaRecebidaDashboard(nota({ documentosSefaz: null }), cnpjEmitenteDashboard);
    const a = new AgregadorDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" }, cnpjEmitenteDashboard); a.adicionarEntrada(entrada);
    expect(a.concluir().metricas.entradas.valor).toBeNull();
    expect(entrada.ambienteComprovado).toBe(false);
  });
});
