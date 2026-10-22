// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PainelEstruturaFiscal } from "@/app/(protegido)/vendas/fiscal/cobertura/painel-fiscal";
import type { ClassificacaoFiscal, PainelFiscal, RegraFiscal } from "@/lib/tributacao/tipos";
import { mockarCatalogoFiscal } from "../fiscal-saida/catalogo-fiscal-fixture";
beforeEach(() => { mockarCatalogoFiscal(); });
const sim = vi.hoisted(() => ({ salvar: vi.fn(), impacto: vi.fn(), ativar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("@/app/(protegido)/vendas/fiscal/estrutura-actions", () => ({ salvarVersaoFiscalAction: sim.salvar, analisarImpactoFiscalAction: sim.impacto, ativarVersaoFiscalAction: sim.ativar }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const painel: PainelFiscal = { administrador: true, grupos: [{ id: "grupo-emporio-ficticio", nome: "Empório e revenda alimentar", ativo: true }], opcoes: [], entradas: [], resumo: { ativos: 2, aptos: 1, pendentes: 1, configuracoes: 0 }, produtos: [{ id: "p", codigo: "TAB-SINT", nome: "Tábua sintética", tipo: "PREPARADO", papeis: ["PRINCIPAL"], grupo: "GF01", ncm: null, status: "PENDENTE", pendencias: ["Falta peso e preparo da formulação"], composicao: [], evidencias: [] }, { id: "r", codigo: "CER-SINT", nome: "Cerveja sintética", tipo: "REVENDA", papeis: ["PRINCIPAL"], grupo: "GF09", ncm: "22030000", status: "APTO", pendencias: [], composicao: [], evidencias: [] }], versoes: [{ id: "v", tipo: "PERFIL", chave: "demo", versao: 1, status: "RASCUNHO", vigenciaInicio: "2027-01-01", dados: { estabelecimento: "demo", cnpj: "00000000000000", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "", regime: "LUCRO_PRESUMIDO", confirmado: false, evidenciaEnquadramento: "", modelos: ["55"], emissor: "TAKEAT", reforma: "EXIGIR_REGRA", beneficioOpcional: null }, justificativa: "Perfil futuro sintético para teste.", fontes: [], criadoPorNome: "Autor sintético", createdAt: "2026-10-11T12:00:00Z", hash: "base" }] };
it("consulta não altera dados e filtros mantêm contagens do escopo pesquisado", async () => {
  const u = userEvent.setup(); render(<PainelEstruturaFiscal painel={{ ...painel, administrador: false }} />);
  expect(screen.queryByRole("button", { name: "Classificar" })).toBeNull();
  await u.type(screen.getByRole("textbox", { name: "Buscar cobertura fiscal" }), "tabua");
  expect(screen.getByRole("button", { name: "Todos (1)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirmados (0)" })).toBeTruthy();
  expect(screen.getByText("Falta peso e preparo da formulação")).toBeTruthy();
  expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.ativar).not.toHaveBeenCalled();
});
it("ativação exige a análise retornada pelo servidor e conserva a visão histórica", async () => {
  const u = userEvent.setup(); sim.impacto.mockResolvedValue({ ok: true, impacto: { hash: "analise-servidor", produtosAfetados: 2, documentosPreservados: 7, resumo: ["Nenhum documento emitido será reescrito"], produtos: [] } }); sim.ativar.mockResolvedValue({ ok: true });
  render(<PainelEstruturaFiscal painel={painel} />);
  expect(screen.queryByRole("button", { name: "Ativar versão" })).toBeNull();
  await u.click(screen.getByRole("tab", { name: "Regras e perfis" }));
  await u.click(screen.getByRole("button", { name: "Ver impacto" }));
  expect(await screen.findByText("2 produto(s) afetado(s) · 7 documento(s) preservado(s)")).toBeTruthy();
  await u.click(await screen.findByRole("button", { name: "Ativar versão" }));
  await waitFor(() => expect(sim.ativar).toHaveBeenCalledWith("v", "analise-servidor", expect.any(String)));
  expect(sim.refresh).toHaveBeenCalledOnce();
});
it("classificação é rascunho com vigência e ausência de NCM não é preenchida pelo grupo", async () => {
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ ok: true, id: "nova" }); render(<PainelEstruturaFiscal painel={painel} />);
  await u.click(within(screen.getByText("Tábua sintética").closest("tr")!).getByRole("button", { name: "Classificar" }));
  const dialogo = await screen.findByRole("dialog");
  const ncm = within(dialogo).getByRole("combobox", { name: "NCM individual" });
  expect(ncm).toHaveProperty("value", ""); await u.type(ncm, "mercadoria sem correspondencia"); await u.tab(); expect(sim.salvar).not.toHaveBeenCalled();
  fireEvent.change(within(dialogo).getByLabelText("Início da vigência"), { target: { value: "2027-01-01" } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Faltam características precisas para classificação individual." } });
  await u.click(within(dialogo).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "CLASSIFICACAO", chave: "p", vigenciaInicio: "2027-01-01", dados: expect.objectContaining({ estado: "PENDENTE", ncm: null }) })));
  expect(sim.ativar).not.toHaveBeenCalled();
});
it.each([["Sem GTIN comprovado", "SEM GTIN"], ["Não confirmado", null]] as const)("GTIN exige escolha explícita: %s conserva o cadastro como rascunho", async (opcao, esperado) => {
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ ok: true, id: "nova" }); render(<PainelEstruturaFiscal painel={painel} />);
  await u.click(within(screen.getByText("Cerveja sintética").closest("tr")!).getByRole("button", { name: "Classificar" }));
  const dialogo = await screen.findByRole("dialog");
  expect(within(dialogo).queryByRole("textbox", { name: "GTIN da unidade vendida" })).toBeNull();
  await u.click(within(dialogo).getByRole("combobox", { name: "Confirmação do GTIN" }));
  await u.click(await screen.findByRole("option", { name: "Código GTIN" }));
  const codigo = within(dialogo).getByRole("textbox", { name: "GTIN da unidade vendida" });
  await u.type(codigo, "12345670");
  await u.click(within(dialogo).getByRole("combobox", { name: "Confirmação do GTIN" }));
  await u.click(await screen.findByRole("option", { name: opcao }));
  expect(within(dialogo).queryByRole("textbox", { name: "GTIN da unidade vendida" })).toBeNull();
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Embalagem sintética analisada para o cadastro fiscal." } });
  await u.click(within(dialogo).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "CLASSIFICACAO", chave: "r", dados: expect.objectContaining({ gtin: esperado }) })));
  expect(sim.ativar).not.toHaveBeenCalled();
});
async function abrirClassificacaoComGtin() {
  const dados: ClassificacaoFiscal = { produtoId: "r", grupo: "GF09", natureza: "REVENDA", tratamento: "NORMAL", ncm: "22030000", origem: "0", cest: null, gtin: "12345670", unidade: "UN", estado: "CONFIRMADO", evidencias: ["Embalagem sintética conferida"], pendencias: [] };
  const anterior = { ...painel.versoes[0], id: "classificacao", tipo: "CLASSIFICACAO" as const, chave: "r", dados };
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ erro: "Falha sintética; mantenha o rascunho." }); render(<PainelEstruturaFiscal painel={{ ...painel, versoes: [anterior] }} />);
  await u.click(within(screen.getByText("Cerveja sintética").closest("tr")!).getByRole("button", { name: "Classificar" }));
  const dialogo = await screen.findByRole("dialog"); const codigo = within(dialogo).getByRole("textbox", { name: "GTIN da unidade vendida" });
  return { u, dialogo, codigo, dados };
}
it("GTIN individual rejeita letras e limita os formatos válidos sem salvar", async () => {
  const { u, codigo } = await abrirClassificacaoComGtin();
  expect(codigo).toHaveProperty("value", "12345670"); await u.type(codigo, "letras"); expect(codigo).toHaveProperty("value", "12345670");
  await u.clear(codigo); await u.type(codigo, "1234567890123456"); expect(codigo).toHaveProperty("value", "12345678901234");
  for (const valor of ["12345670", "123456789012", "1234567890123", "12345678901234"]) { await u.clear(codigo); await u.paste(valor); expect(codigo).toHaveProperty("value", valor); expect((codigo as HTMLInputElement).checkValidity()).toBe(true); }
  expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.ativar).not.toHaveBeenCalled();
});
it("GTIN individual conserva código, evidências e parâmetros ao alternar opções ou grupo", async () => {
  const { u, dialogo, dados } = await abrirClassificacaoComGtin();
  for (const valor of ["Sem GTIN comprovado", "Código GTIN"]) { await u.click(within(dialogo).getByRole("combobox", { name: "Confirmação do GTIN" })); await u.click(await screen.findByRole("option", { name: valor })); }
  expect(within(dialogo).getByRole("textbox", { name: "GTIN da unidade vendida" })).toHaveProperty("value", "12345670");
  await u.click(within(dialogo).getByRole("combobox", { name: "Grupo fiscal" })); await u.click(await screen.findByRole("option", { name: "Empório e revenda alimentar" }));
  expect(within(dialogo).getByRole("combobox", { name: "NCM individual" })).toHaveProperty("value", expect.stringContaining("22030000"));
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Ajuste prospectivo sintético do grupo sem alterar a mercadoria." } });
  await u.click(within(dialogo).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ dados: expect.objectContaining({ grupo: "GF09", grupoFiscalId: "grupo-emporio-ficticio", gtin: "12345670", ncm: "22030000", origem: "0", evidencias: ["Embalagem sintética conferida"] }) })));
  expect((await screen.findByRole("alert")).textContent).toContain("Falha sintética"); expect(within(dialogo).getByRole("textbox", { name: "GTIN da unidade vendida" })).toHaveProperty("value", "12345670"); expect(dados.grupo).toBe("GF09");
});
it("perfil RTC conserva caminhos sem nomes presumidos, protege colagem e exige evidência antes de confirmar homologação", async () => {
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ ok: true, id: "nova" }); render(<PainelEstruturaFiscal painel={painel} />);
  await u.click(screen.getByRole("tab", { name: "Regras e perfis" })); await u.click(screen.getByRole("button", { name: "Nova versão" }));
  const dialogo = await screen.findByRole("dialog"); await u.click(within(dialogo).getByText("Avançado: leiaute RTC de 2027 no provedor"));
  await u.click(within(dialogo).getByRole("checkbox", { name: "Preparar mapeamento do leiaute RTC" }));
  const nomes = ["Campo da API para valor líquido do produto", "Campo da API para valor líquido unitário", "Campo da API para total líquido dos produtos", "Campo da API para total do item", "Campo da API para total do documento"];
  for (const nome of nomes) expect(within(dialogo).getByRole("textbox", { name: nome })).toHaveProperty("value", "");
  const confirmado = within(dialogo).getByRole("checkbox", { name: "Homologação do leiaute comprovada por evidência" }) as HTMLInputElement;
  expect(confirmado.disabled).toBe(true); expect(confirmado.checked).toBe(false);
  const campo = within(dialogo).getByRole("textbox", { name: nomes[0] });
  await u.click(campo); await u.paste("Campo inválido"); expect(campo).toHaveProperty("value", "");
  await u.paste("Campo.Exemplo.Teste.Quarto"); expect(campo).toHaveProperty("value", "");
  await u.paste("A".repeat(81)); expect(campo).toHaveProperty("value", "");
  await u.type(campo, "Campo Exemplo_!"); expect(campo).toHaveProperty("value", "CampoExemplo");
  await u.clear(campo); await u.paste("Campo.Exemplo.Teste"); expect(campo).toHaveProperty("value", "Campo.Exemplo.Teste");
  for (const [i, nome] of nomes.entries()) fireEvent.change(within(dialogo).getByRole("textbox", { name: nome }), { target: { value: `CampoSintetico${i + 1}` } });
  expect(confirmado.disabled).toBe(true);
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Evidência da homologação do leiaute no provedor" }), { target: { value: "Evidência sintética do leiaute para teste sem emissão." } });
  expect(confirmado.disabled).toBe(false); await u.click(confirmado); expect(confirmado.checked).toBe(true);
  fireEvent.change(campo, { target: { value: "CampoSinteticoAlterado" } }); expect(confirmado.checked).toBe(false);
  await u.click(within(dialogo).getByRole("checkbox", { name: "Preparar mapeamento do leiaute RTC" }));
  await u.click(within(dialogo).getByRole("checkbox", { name: "Preparar mapeamento do leiaute RTC" }));
  expect(within(dialogo).getByRole("textbox", { name: nomes[0] })).toHaveProperty("value", "CampoSinteticoAlterado");
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Mapeamento futuro sintético salvo sem comprovação de homologação." } });
  expect(Array.from(dialogo.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).filter(c => c.willValidate && !c.validity.valid).map(c => ({ campo: c.getAttribute("aria-label") ?? c.closest("label")?.textContent, valor: c.value }))).toEqual([]);
  await u.click(within(dialogo).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "PERFIL", dados: expect.objectContaining({ estabelecimento: "demo", modelos: ["55"], layoutRTC: expect.objectContaining({ codigo: "NT2026.008", homologacaoComprovada: false, campos: expect.objectContaining({ valorProdutoLiquido: "CampoSinteticoAlterado" }) }) }) })));
  expect(sim.ativar).not.toHaveBeenCalled();
});
it("perfil padrão do Simples 2026 não exige opções avançadas de leiaute RTC", async () => {
  const u = userEvent.setup(); render(<PainelEstruturaFiscal painel={painel} />);
  await u.click(screen.getByRole("tab", { name: "Regras e perfis" })); await u.click(screen.getByRole("button", { name: "Novo perfil" }));
  expect(screen.queryByText("Avançado: leiaute RTC de 2027 no provedor")).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "Homologação do leiaute comprovada por evidência" })).toBeNull();
  expect(sim.salvar).not.toHaveBeenCalled();
});
const fontePreco2027 = "https://www.gov.br/fonte-sintetica-sem-efeito-fiscal";
const fundamentoPreco2027 = "Norma sintética para testar escolha, UF SP e vigência 2027, sem emissão.";
function regraPreco2027Sintetica(): RegraFiscal {
  const semDestaque = { cst: "49", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Fundamento sintético sem emissão." };
  return { estabelecimento: "demo", regime: "LUCRO_PRESUMIDO", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF09", produtoId: "r", natureza: "REVENDA", ncm: "22030000", cfop: "5102", csosn: null, icms: { ...semDestaque, cst: "40" }, pis: semDestaque, cofins: semDestaque, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "Revenda sintética", reforma: { cst: "000", cClassTrib: "000001", cbs: "0", ibsUf: "0", ibsMunicipio: "0", reducao: "0", justificativa: "Cenário sintético com alíquotas zero, sem emissão." }, seletivo: "NAO_APLICAVEL" };
}
async function abrirRegraPreco2027(dados = regraPreco2027Sintetica()) {
  const u = userEvent.setup(); sim.salvar.mockResolvedValue({ ok: true, id: "nova" }); render(<PainelEstruturaFiscal painel={{ ...painel, versoes: [{ ...painel.versoes[0], id: "regra", tipo: "REGRA", chave: "regra-sintetica", dados }] }} />);
  await u.click(screen.getByRole("tab", { name: "Regras e perfis" })); await u.click(screen.getByRole("button", { name: "Nova versão" }));
  const dialogo = await screen.findByRole("dialog"); await u.click(within(dialogo).getByText("IBS/CBS e Imposto Seletivo"));
  return { u, dialogo, dados };
}
async function escolherBasePreco2027(u: ReturnType<typeof userEvent.setup>, dialogo: HTMLElement, nome: string) {
  await u.click(within(dialogo).getByRole("combobox", { name: "Base do ICMS no preço de 2027" }));
  await u.click(await screen.findByRole("option", { name: nome }));
}
it("política de preço 2027 começa com base bruta e bloqueia base líquida sem exceção comprovada", async () => {
  const { u, dialogo } = await abrirRegraPreco2027();
  expect(within(dialogo).queryByRole("combobox", { name: "Base do ICMS no preço de 2027" })).toBeNull();
  await u.click(within(dialogo).getByRole("checkbox", { name: "Configurar decomposição do preço em 2027" }));
  expect(within(dialogo).getByRole("combobox", { name: "Base do ICMS no preço de 2027" }).textContent).toContain("Bruta final");
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Fundamentação da decomposição do preço de 2027" }), { target: { value: fundamentoPreco2027 } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Configuração prospectiva sintética para testar preservação." } });
  await escolherBasePreco2027(u, dialogo, "Líquida de IBS/CBS: somente com norma específica");
  await u.click(within(dialogo).getByRole("button", { name: "Salvar" })); expect(sim.salvar).not.toHaveBeenCalled();
  expect(within(dialogo).getByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" })).toHaveProperty("value", "");
  expect(within(dialogo).getByRole("combobox", { name: "UF alcançada pela exceção normativa" }).textContent).toContain("Selecione a UF comprovada");
  expect(sim.ativar).not.toHaveBeenCalled();
});
it("fonte da exceção de preço rejeita colagem inválida e conserva a URL válida", async () => {
  const dados = regraPreco2027Sintetica();
  dados.reforma!.preco2027 = { baseIcms: "LIQUIDA_RTC", rateio: "SEM_ACRESCIMOS", justificativa: fundamentoPreco2027 };
  const { u, dialogo } = await abrirRegraPreco2027(dados);
  const campoFonte = within(dialogo).getByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" });
  expect(campoFonte).toHaveProperty("value", "");
  await u.click(campoFonte); await u.paste("https://www.gov.br/norma com espaço"); expect(campoFonte).toHaveProperty("value", "");
  await u.paste(fontePreco2027); expect(campoFonte).toHaveProperty("value", fontePreco2027);
  fireEvent.change(campoFonte, { target: { value: "https://www.gov.br/inválida" } }); expect(campoFonte).toHaveProperty("value", fontePreco2027);
  expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.ativar).not.toHaveBeenCalled();
});
it("política de preço preserva a edição ao alternar base e recolher a configuração", async () => {
  const dados = regraPreco2027Sintetica();
  dados.reforma!.preco2027 = { baseIcms: "LIQUIDA_RTC", rateio: "SEM_ACRESCIMOS", justificativa: "Fundamento inicial da fixture.", excecaoBaseLiquida: { uf: "SP", vigenciaInicio: "2027-01-01", vigenciaFim: "2027-12-31", fonteNormativa: "https://www.gov.br/fonte-inicial-sintetica", ato: "Ato exclusivamente sintético para testar o formulário.", justificativa: "Fundamento exclusivamente sintético sem vigência legal ou emissão." } };
  const { u, dialogo } = await abrirRegraPreco2027(dados);
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Fundamentação da decomposição do preço de 2027" }), { target: { value: fundamentoPreco2027 } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" }), { target: { value: fontePreco2027 } });
  await escolherBasePreco2027(u, dialogo, "Bruta final com IBS/CBS: orientação SEFAZ-SP");
  expect(within(dialogo).queryByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" })).toBeNull();
  await escolherBasePreco2027(u, dialogo, "Líquida de IBS/CBS: somente com norma específica");
  expect(within(dialogo).getByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" })).toHaveProperty("value", fontePreco2027);
  await u.click(within(dialogo).getByRole("checkbox", { name: "Configurar decomposição do preço em 2027" }));
  await u.click(within(dialogo).getByRole("checkbox", { name: "Configurar decomposição do preço em 2027" }));
  expect(within(dialogo).getByRole("textbox", { name: "Fundamentação da decomposição do preço de 2027" })).toHaveProperty("value", fundamentoPreco2027);
  expect(within(dialogo).getByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" })).toHaveProperty("value", fontePreco2027);
  expect(within(dialogo).getByRole("combobox", { name: "UF alcançada pela exceção normativa" }).textContent).toContain("SP");
  expect(within(dialogo).getByLabelText("Início da vigência da exceção")).toHaveProperty("value", "2027-01-01");
  expect(within(dialogo).getByLabelText("Fim da vigência da exceção, quando houver")).toHaveProperty("value", "2027-12-31");
  expect(within(dialogo).getByRole("textbox", { name: "Identificação do ato normativo da exceção" })).toHaveProperty("value", "Ato exclusivamente sintético para testar o formulário.");
  expect(within(dialogo).getByRole("textbox", { name: "Fundamento da exceção para a operação" })).toHaveProperty("value", "Fundamento exclusivamente sintético sem vigência legal ou emissão.");
  expect(dados.reforma!.preco2027!.excecaoBaseLiquida!.fonteNormativa).toBe("https://www.gov.br/fonte-inicial-sintetica");
  expect(sim.salvar).not.toHaveBeenCalled(); expect(sim.ativar).not.toHaveBeenCalled();
});
it("salva somente o rascunho de preço com exceção completa sem modificar a versão de origem", async () => {
  const { u, dialogo, dados } = await abrirRegraPreco2027();
  await u.click(within(dialogo).getByRole("checkbox", { name: "Configurar decomposição do preço em 2027" }));
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Fundamentação da decomposição do preço de 2027" }), { target: { value: fundamentoPreco2027 } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Justificativa técnica desta versão" }), { target: { value: "Configuração prospectiva sintética para testar preservação." } });
  await escolherBasePreco2027(u, dialogo, "Líquida de IBS/CBS: somente com norma específica");
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Fonte oficial da norma para base ICMS líquida" }), { target: { value: fontePreco2027 } });
  await u.click(within(dialogo).getByRole("combobox", { name: "UF alcançada pela exceção normativa" })); await u.click(await screen.findByRole("option", { name: /^SP$/ }));
  fireEvent.change(within(dialogo).getByLabelText("Início da vigência da exceção"), { target: { value: "2027-01-01" } });
  fireEvent.change(within(dialogo).getByLabelText("Fim da vigência da exceção, quando houver"), { target: { value: "2027-12-31" } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Identificação do ato normativo da exceção" }), { target: { value: "Ato exclusivamente sintético para testar o formulário." } });
  fireEvent.change(within(dialogo).getByRole("textbox", { name: "Fundamento da exceção para a operação" }), { target: { value: "Fundamento exclusivamente sintético sem vigência legal ou emissão." } });
  await u.click(within(dialogo).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(sim.salvar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "REGRA", fontes: [fontePreco2027], dados: expect.objectContaining({ ncm: "22030000", reforma: expect.objectContaining({ cbs: "0", preco2027: expect.objectContaining({ baseIcms: "LIQUIDA_RTC", rateio: "SEM_ACRESCIMOS", excecaoBaseLiquida: { uf: "SP", vigenciaInicio: "2027-01-01", vigenciaFim: "2027-12-31", fonteNormativa: fontePreco2027, ato: "Ato exclusivamente sintético para testar o formulário.", justificativa: "Fundamento exclusivamente sintético sem vigência legal ou emissão." } }) }) }) })));
  expect(dados.reforma?.preco2027).toBeUndefined(); expect(sim.ativar).not.toHaveBeenCalled();
});
