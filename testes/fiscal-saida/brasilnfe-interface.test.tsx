// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrasilNfeForm } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/brasilnfe-form";
import { configuracaoBrasilNfeFicticia, configuracaoBrasilNfeServicosPendentesFicticia, criarDetalhesDiagnosticoServicosFicticios } from "./brasilnfe-interface-dados";
import type { ConfiguracaoBrasilNfeDto, DetalhesDiagnosticoBrasilNfeDto, ResultadoConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dto";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function preparar(opcoes: { editar?: boolean; configurado?: boolean; dados?: ConfiguracaoBrasilNfeDto } = {}) {
  const dados = { ...(opcoes.dados ?? configuracaoBrasilNfeFicticia), ...(opcoes.configurado ? { tokenConfigurado: true, configuracaoSalva: true, versao: 2 } : {}) };
  const salvo = { ...dados, tokenConfigurado: true, configuracaoSalva: true, versao: dados.versao + 1 };
  const salvar = vi.fn(async () => ({ ok: true as const, dados: salvo }));
  const validar = vi.fn(async () => ({ ok: true as const, dados }));
  render(<BrasilNfeForm inicial={dados} editar={opcoes.editar ?? true} salvar={salvar} validar={validar} />);
  return { salvar, validar, dados };
}

function valorDiagnostico(rotulo: string) {
  return screen.getByText(rotulo, { selector: "dt" }).nextElementSibling?.textContent;
}

const nomeDetalhes = "Detalhes temporários de ConsultarServicos";
function prepararDetalhes(detalhes = criarDetalhesDiagnosticoServicosFicticios(), validarResposta?: () => Promise<ResultadoConfiguracaoBrasilNfe>) {
  const dados = configuracaoBrasilNfeServicosPendentesFicticia;
  const salvar = vi.fn(async (): Promise<ResultadoConfiguracaoBrasilNfe> => ({ ok: true, dados }));
  const validar = vi.fn(validarResposta ?? (async (): Promise<ResultadoConfiguracaoBrasilNfe> => ({ ok: true, dados, detalhesDiagnostico: detalhes })));
  const props = { inicial: dados, editar: true, salvar, validar };
  const resultado = render(<BrasilNfeForm {...props} />);
  return { ...resultado, props, salvar, validar, dados };
}
async function clicarValidar() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Validar conexão" })); });
}
function valorDetalhe(rotulo: string) {
  return within(screen.getByRole("region", { name: nomeDetalhes })).getByText(rotulo, { selector: "dt" }).nextElementSibling?.textContent;
}

it("lê somente a presença de credenciais e separa diagnóstico da habilitação manual por documento", () => {
  preparar({ configurado: true });
  expect((screen.getByLabelText("Token da empresa") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("UserToken") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("Configurado")).toBeTruthy();
  expect(screen.getByText("Sem emissão automática")).toBeTruthy();
  expect(screen.getAllByText("Conferir por modelo na habilitação manual")).toHaveLength(2);
  expect(valorDiagnostico("Produção")).toBe("Conferir habilitação manual abaixo");
  expect(screen.queryByText("Bloqueada neste marco")).toBeNull();
  expect(screen.getByText(/NF-e \(modelo 55\) e NFC-e \(modelo 65\)/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Emitir|Transmitir|Cancelar nota|Inutilizar/ })).toBeNull();
});

it("não grava ao perder foco e salva substituição explicitamente, sem consultar ou transmitir", async () => {
  const { salvar, validar } = preparar();
  const usuario = userEvent.setup();
  await usuario.type(screen.getByLabelText("Token da empresa"), "credencial-ficticia");
  await usuario.tab();
  expect(salvar).not.toHaveBeenCalled();
  expect(validar).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Validar conexão" }) as HTMLButtonElement).disabled).toBe(true);
  await usuario.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(salvar).toHaveBeenCalledWith({ versao: 0, tokenSubstituicao: "credencial-ficticia" }));
  await waitFor(() => expect((screen.getByLabelText("Token da empresa") as HTMLInputElement).value).toBe(""));
  expect(validar).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain("credencial-ficticia");
});

it("consulta somente a configuração salva e relata diagnóstico parcial sem chamar salvamento", async () => {
  const { salvar, validar } = preparar({ configurado: true });
  await userEvent.setup().click(screen.getByRole("button", { name: "Validar conexão" }));
  await waitFor(() => expect(validar).toHaveBeenCalledWith({ versao: 2 }));
  expect(salvar).not.toHaveBeenCalled();
  expect(screen.getByText("Consulta cadastral da empresa: UserToken não configurado.")).toBeTruthy();
  expect(valorDiagnostico("Acesso autenticado")).toBe("Não confirmado");
  expect(valorDiagnostico("Serviço NF-e/NFC-e pela API")).toBe("Não confirmado");
});

it("mantém pré-requisitos e homologação fiscal pendentes mesmo com empresa e assinatura do serviço conferidas", () => {
  const dados: ConfiguracaoBrasilNfeDto = { ...configuracaoBrasilNfeServicosPendentesFicticia, validacaoExterna: {
    ...configuracaoBrasilNfeServicosPendentesFicticia.validacaoExterna,
    situacao: "PARCIAL", preRequisitosConferidos: false, verificadaEm: "2026-10-10T12:30:00.000Z",
    servicosEmissao: { nfe: "ATIVO", nfce: "ATIVO", verificadosEm: "2026-10-10T12:30:00.000Z" },
    consultas: [
      { consulta: "BuscarEmpresa", situacao: "CONCLUIDA", verificadaEm: "2026-10-10T12:30:00.000Z", falha: null },
      { consulta: "ConsultarServicos", situacao: "CONCLUIDA", verificadaEm: "2026-10-10T12:30:00.000Z", falha: null },
    ],
  } };
  render(<BrasilNfeForm inicial={dados} editar salvar={vi.fn()} validar={vi.fn()} />);
  expect(valorDiagnostico("Pré-requisitos")).toBe("Conferência pendente");
  expect(valorDiagnostico("Acesso autenticado")).toBe("Confirmado");
  expect(valorDiagnostico("Serviço NF-e/NFC-e pela API")).toBe("Ativo no catálogo");
  expect(screen.getByText("O catálogo informa a assinatura do serviço; não confirma liberação de homologação ou produção.")).toBeTruthy();
  expect(screen.getAllByText("Conferir por modelo na habilitação manual")[0]).toBeTruthy();
  expect(screen.getByText("Último diagnóstico: 10/10/2026, 09:30 (Brasília).")).toBeTruthy();
});

it("exibe consultas indisponíveis e bloqueia diagnóstico quando o token não foi configurado", () => {
  const { validar } = preparar();
  const validarBotao = screen.getByRole("button", { name: "Validar conexão" }) as HTMLButtonElement;
  expect(validarBotao.disabled).toBe(true);
  fireEvent.click(validarBotao);
  expect(validar).not.toHaveBeenCalled();
  expect(screen.getByText("Configure o Token da empresa antes de validar a conexão.")).toBeTruthy();
});

it("não oferece alteração ou diagnóstico a quem só pode visualizar", () => {
  preparar({ editar: false, configurado: true });
  expect(document.querySelectorAll("input")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Validar conexão" })).toBeNull();
  expect(screen.getByText(/Seu acesso permite consultar a configuração/)).toBeTruthy();
});

it("limita credenciais na digitação e colagem, preservando caixa e símbolos válidos", () => {
  preparar();
  const token = screen.getByLabelText("Token da empresa") as HTMLInputElement;
  expect(token.maxLength).toBe(512);
  fireEvent.change(token, { target: { value: "AbC-._=123" } });
  expect(token.value).toBe("AbC-._=123");
  fireEvent.change(token, { target: { value: "abc espaço" } });
  expect(token.value).toBe("AbC-._=123");
  fireEvent.change(token, { target: { value: "x".repeat(513) } });
  expect(token.value).toBe("AbC-._=123");
  const evento = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(evento, "clipboardData", { value: { getData: () => "valor\ninválido" } });
  token.dispatchEvent(evento);
  expect(evento.defaultPrevented).toBe(true);
});

it("preserva o rascunho em falhas e permite cancelar sem modificar a configuração", async () => {
  const salvar = vi.fn(async () => ({ ok: false as const, erro: "Configuração alterada por outro usuário. Recarregue a página." }));
  render(<BrasilNfeForm inicial={configuracaoBrasilNfeFicticia} editar salvar={salvar} validar={vi.fn()} />);
  const usuario = userEvent.setup();
  await usuario.type(screen.getByLabelText("UserToken"), "substituicao-ficticia");
  await usuario.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Configuração alterada por outro usuário. Recarregue a página.");
  expect((screen.getByLabelText("UserToken") as HTMLInputElement).value).toBe("substituicao-ficticia");
  await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
  expect((screen.getByLabelText("UserToken") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("Sem emissão automática")).toBeTruthy();
  expect(salvar).toHaveBeenCalledTimes(1);
});

it("conserva autenticação e emitente confirmados quando a consulta de serviços falha, sem declarar homologação", () => {
  preparar({ editar: false, dados: configuracaoBrasilNfeServicosPendentesFicticia });
  expect(screen.getByText("Conectado — verificação de serviços pendente")).toBeTruthy();
  expect(valorDiagnostico("Acesso autenticado")).toBe("Confirmado");
  expect(valorDiagnostico("Correspondência do emitente")).toBe("Corresponde ao cadastro da empresa");
  expect(valorDiagnostico("Serviço NF-e/NFC-e pela API")).toBe("Não confirmado");
  expect(valorDiagnostico("Pré-requisitos")).toBe("Conferência pendente");
  expect(valorDiagnostico("Produção")).toBe("Conferir habilitação manual abaixo");
  expect(screen.getAllByText("Conferir por modelo na habilitação manual")[0]).toBeTruthy();
  expect(screen.getByText("Empresa consultada: 10/10/2026, 09:30 (Brasília).")).toBeTruthy();
  expect(screen.queryByText(/Serviços consultados:/)).toBeNull();
  expect(screen.getByText(/HTTP 403/)).toBeTruthy();
  expect(screen.getByText("ConsultarServicos: acesso recusado; verificação do serviço de emissão pendente.")).toBeTruthy();
  expect(screen.getByText("BuscarEmpresa")).toBeTruthy();
  expect(screen.getByText("Concluída")).toBeTruthy();
  expect(screen.queryByText(/Token inválido|Credencial inválida/i)).toBeNull();
  expect(screen.queryByRole("button", { name: /Emitir|Transmitir|Cancelar nota|Inutilizar/ })).toBeNull();
});

it.each(["ATIVO", "INATIVO", "NAO_CONFIRMADO"] as const)("apresenta o serviço combinado %s separado da autenticação e dos pré-requisitos", estado => {
  const dados: ConfiguracaoBrasilNfeDto = { ...configuracaoBrasilNfeServicosPendentesFicticia, validacaoExterna: {
    ...configuracaoBrasilNfeServicosPendentesFicticia.validacaoExterna,
    situacao: "PARCIAL", servicosEmissao: { nfe: estado, nfce: estado, verificadosEm: estado === "NAO_CONFIRMADO" ? null : "2026-10-10T12:30:01.000Z" },
    consultas: estado === "NAO_CONFIRMADO" ? configuracaoBrasilNfeServicosPendentesFicticia.validacaoExterna.consultas : [
      { consulta: "BuscarEmpresa", situacao: "CONCLUIDA", verificadaEm: "2026-10-10T12:30:00.000Z", falha: null },
      { consulta: "ConsultarServicos", situacao: "CONCLUIDA", verificadaEm: "2026-10-10T12:30:01.000Z", falha: null },
    ],
  } };
  preparar({ dados });
  expect(valorDiagnostico("Acesso autenticado")).toBe("Confirmado");
  expect(valorDiagnostico("Serviço NF-e/NFC-e pela API")).toBe({ ATIVO: "Ativo no catálogo", INATIVO: "Inativo", NAO_CONFIRMADO: "Não confirmado" }[estado]);
  expect(valorDiagnostico("Pré-requisitos")).toBe("Conferência pendente");
  expect(Boolean(screen.queryByText("Serviços consultados: 10/10/2026, 09:30 (Brasília)."))).toBe(estado !== "NAO_CONFIRMADO");
  expect(screen.getByText("Sem emissão automática")).toBeTruthy();
});

it("não infere identidade ou serviço para uma evidência cadastral antiga preservada", () => {
  const dados: ConfiguracaoBrasilNfeDto = { ...configuracaoBrasilNfeFicticia, validacaoExterna: {
    ...configuracaoBrasilNfeFicticia.validacaoExterna,
    situacao: "PARCIAL", acessoAutenticado: true, empresaVerificadaEm: "2026-10-10T12:30:00.000Z", verificadaEm: "2026-10-10T12:30:00.000Z",
    pendencias: ["Repita a validação para conferir emitente e serviços nesta configuração."],
  } };
  preparar({ dados });
  expect(valorDiagnostico("Acesso autenticado")).toBe("Confirmado");
  expect(valorDiagnostico("Correspondência do emitente")).toBe("Não conferida");
  expect(valorDiagnostico("Serviço NF-e/NFC-e pela API")).toBe("Não confirmado");
  expect(screen.queryByText("Conectado — verificação de serviços pendente")).toBeNull();
  expect(screen.getByText("Repita a validação para conferir emitente e serviços nesta configuração.")).toBeTruthy();
});

it("mantém autenticação separada da divergência do emitente", () => {
  preparar({ dados: { ...configuracaoBrasilNfeServicosPendentesFicticia, validacaoExterna: {
    ...configuracaoBrasilNfeServicosPendentesFicticia.validacaoExterna, situacao: "FALHOU", emitenteCorrespondente: false,
  } } });
  expect(valorDiagnostico("Acesso autenticado")).toBe("Confirmado");
  expect(valorDiagnostico("Correspondência do emitente")).toBe("Divergente do cadastro da empresa");
  expect(screen.queryByText("Conectado — verificação de serviços pendente")).toBeNull();
});

it("não apresenta campos externos extras anexados ao detalhe tipado da consulta", () => {
  const falhaComCampoExtra = { categoria: "HTTP" as const, httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null, body: "CONTEUDO_EXTERNO_FICTICIO" };
  preparar({ editar: false, dados: { ...configuracaoBrasilNfeServicosPendentesFicticia, validacaoExterna: {
    ...configuracaoBrasilNfeServicosPendentesFicticia.validacaoExterna,
    consultas: [{ consulta: "ConsultarServicos", situacao: "FALHOU", verificadaEm: "2026-10-10T12:30:01.000Z", falha: falhaComCampoExtra }],
  } } });
  expect(document.body.textContent).not.toContain("CONTEUDO_EXTERNO_FICTICIO");
  expect(screen.getByText("ConsultarServicos")).toBeTruthy();
});

it("recebe detalhes apenas da ação autorizada, exibe texto escapado e mantém códigos sem interpretação automática", async () => {
  const original = criarDetalhesDiagnosticoServicosFicticios();
  const detalhes: DetalhesDiagnosticoBrasilNfeDto = { ...original, erros: [{ ...original.erros[0], descricao: { estado: "EXIBIDO", valor: '<img src=x onerror="alert(1)"><script>ficticio()</script> https://ficticio.invalid' } }] };
  const { salvar } = prepararDetalhes(detalhes);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  await clicarValidar();
  const regiao = screen.getByRole("region", { name: nomeDetalhes });
  expect(valorDetalhe("Error da resposta")).toBe("Mensagem fictícia do fornecedor.");
  expect(valorDetalhe("Código informado")).toBe("FICTICIO-X001");
  expect(valorDetalhe("Descrição informada")).toBe(detalhes.erros[0].descricao.valor);
  expect(regiao.querySelectorAll("img, script, a")).toHaveLength(0);
  expect(within(regiao).getByText(/dados externos, não instruções/)).toBeTruthy();
  expect(within(regiao).getByText(/Códigos informados não têm interpretação automática/)).toBeTruthy();
  expect(salvar).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Emitir|Transmitir/ })).toBeNull();
});

it.each([
  ["AUSENTE", "Ausente"], ["VAZIO", "Vazio"], ["SUPRIMIDO", "Suprimido por segurança"], ["FORMATO_INVALIDO", "Formato inválido"],
] as const)("distingue o estado %s sem tentar apresentar seu conteúdo", async (estado, rotulo) => {
  const detalhes: DetalhesDiagnosticoBrasilNfeDto = { ...criarDetalhesDiagnosticoServicosFicticios(), error: { estado, valor: null } };
  prepararDetalhes(detalhes);
  await clicarValidar();
  expect(valorDetalhe("Error da resposta")).toBe(rotulo);
  expect(valorDetalhe("Correção informada")).toBe("Suprimido por segurança");
  expect(within(screen.getByRole("region", { name: nomeDetalhes })).getByText("Campos ausentes: Servicos.")).toBeTruthy();
  expect(within(screen.getByRole("region", { name: nomeDetalhes })).getByText("Campos suprimidos: erros.correcao.")).toBeTruthy();
});

it.each([
  { valor: false, tipo: "BOOLEANO", estado: "FALSE", texto: "Booleano", indicador: "STATUS_FALSE" },
  { valor: 0, tipo: "NUMERO", estado: "ZERO", texto: "Número", indicador: "ERROS_PREENCHIDOS" },
] as const)("preserva a distinção do status $valor e seu tipo em indicadores locais fixos", ({ valor, tipo, estado, texto, indicador }) => {
  preparar({ dados: { ...configuracaoBrasilNfeServicosPendentesFicticia, validacaoExterna: {
    ...configuracaoBrasilNfeServicosPendentesFicticia.validacaoExterna,
    consultas: [{ consulta: "ConsultarServicos", situacao: "FALHOU", verificadaEm: null, falha: {
      categoria: "NEGOCIO", httpStatus: 200, etapaContrato: "SERVICOS_AVISOS", statusFornecedor: valor, codigoFornecedor: null,
      tipoStatusFornecedor: tipo, estadoStatusFornecedor: estado, indicadores: [indicador], camposAusentes: ["SERVICOS"], camposSuprimidos: ["ERROR"],
    } }],
  } } });
  expect(screen.getByText(new RegExp(`Status recebido: ${String(valor)} · Tipo: ${texto}`))).toBeTruthy();
  expect(screen.getByText(valor === false ? "Indicadores locais: Status booleano false observado." : "Indicadores locais: Lista de erros preenchida.")).toBeTruthy();
  expect(screen.getByText("Campos suprimidos: Error.")).toBeTruthy();
});

it("não mostra detalhes anexados à leitura da configuração ou ao salvamento", async () => {
  const dados = { ...configuracaoBrasilNfeServicosPendentesFicticia, detalhesDiagnostico: criarDetalhesDiagnosticoServicosFicticios() };
  const salvar = vi.fn(async (): Promise<ResultadoConfiguracaoBrasilNfe> => ({ ok: true, dados, detalhesDiagnostico: dados.detalhesDiagnostico }));
  render(<BrasilNfeForm inicial={dados} editar salvar={salvar} validar={vi.fn()} />);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  fireEvent.change(screen.getByLabelText("Token da empresa"), { target: { value: "substituicao-ficticia" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar" })); });
  expect(salvar).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  expect(document.body.textContent).not.toContain("Mensagem fictícia do fornecedor.");
});

it.each(["versao", "expirado", "data-invalida", "prazo-invalido"] as const)("não aceita detalhes com %s incompatível", async caso => {
  const detalhes = criarDetalhesDiagnosticoServicosFicticios();
  if (caso === "versao") detalhes.versao++;
  if (caso === "expirado") detalhes.expiraEm = new Date(Date.now() - 1).toISOString();
  if (caso === "data-invalida") detalhes.verificadaEm = "invalida";
  if (caso === "prazo-invalido") detalhes.expiraEm = "invalida";
  prepararDetalhes(detalhes);
  await clicarValidar();
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it.each(["Token da empresa", "UserToken"])("limpa os detalhes ao alterar %s e não os recupera ao cancelar", async campo => {
  prepararDetalhes();
  await clicarValidar();
  fireEvent.change(screen.getByLabelText(campo), { target: { value: "rascunho-ficticio" } });
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it("oculta os detalhes pelo botão X oficial e conserva o diagnóstico persistente", async () => {
  prepararDetalhes();
  await clicarValidar();
  const ocultar = screen.getByRole("button", { name: "Ocultar detalhes temporários" });
  expect(ocultar.getAttribute("data-acao")).toBe("remover-item");
  fireEvent.click(ocultar);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  expect(screen.getByText("Conectado — verificação de serviços pendente")).toBeTruthy();
});

it("descarta o detalhe anterior ao iniciar nova tentativa e não o recupera em falha", async () => {
  let concluir!: (resultado: ResultadoConfiguracaoBrasilNfe) => void;
  const { validar } = prepararDetalhes();
  await clicarValidar();
  validar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  await clicarValidar();
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  await act(async () => { concluir({ ok: false, erro: "Falha fictícia saneada." }); });
  expect(screen.getByRole("alert").textContent).toBe("Falha fictícia saneada.");
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it("perda da permissão de edição limpa detalhes e não os restaura na volta da permissão", async () => {
  const { rerender, props } = prepararDetalhes();
  await clicarValidar();
  rerender(<BrasilNfeForm {...props} editar={false} />);
  await act(async () => {});
  rerender(<BrasilNfeForm {...props} />);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it("limpa detalhes quando chega uma versão externa nova da configuração", async () => {
  const { rerender, props } = prepararDetalhes();
  await clicarValidar();
  rerender(<BrasilNfeForm {...props} inicial={{ ...props.inicial, versao: props.inicial.versao + 1 }} />);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
  await act(async () => {});
  rerender(<BrasilNfeForm {...props} />);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it("conserva detalhes na atualização de página da própria versão retornada pela validação", async () => {
  const dados = { ...configuracaoBrasilNfeServicosPendentesFicticia, versao: 2 };
  const detalhes = criarDetalhesDiagnosticoServicosFicticios(dados.versao);
  const { rerender, props } = prepararDetalhes(detalhes, async () => ({ ok: true, dados, detalhesDiagnostico: detalhes }));
  await clicarValidar();
  rerender(<BrasilNfeForm {...props} inicial={dados} />);
  expect(screen.getByRole("region", { name: nomeDetalhes })).toBeTruthy();
});

it.each(["pagehide", "permissao", "versao"] as const)("ignora resposta transitória tardia após %s", async motivo => {
  let concluir!: (resultado: ResultadoConfiguracaoBrasilNfe) => void;
  const detalhes = criarDetalhesDiagnosticoServicosFicticios();
  const { rerender, props, dados } = prepararDetalhes(detalhes, () => new Promise(resolve => { concluir = resolve; }));
  await clicarValidar();
  if (motivo === "pagehide") act(() => { window.dispatchEvent(new Event("pagehide")); });
  if (motivo === "permissao") rerender(<BrasilNfeForm {...props} editar={false} />);
  if (motivo === "versao") rerender(<BrasilNfeForm {...props} inicial={{ ...dados, versao: dados.versao + 1 }} />);
  await act(async () => { concluir({ ok: true, dados, detalhesDiagnostico: detalhes }); });
  if (motivo === "permissao") rerender(<BrasilNfeForm {...props} />);
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it.each([60_000, 600_000])("expira no menor prazo entre o limite do servidor (%i ms) e cinco minutos locais", async prazoServidor => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const detalhes = criarDetalhesDiagnosticoServicosFicticios();
  detalhes.expiraEm = new Date(Date.now() + prazoServidor).toISOString();
  prepararDetalhes(detalhes);
  await clicarValidar();
  const prazo = Math.min(prazoServidor, 300_000);
  await act(async () => { await vi.advanceTimersByTimeAsync(prazo - 1); });
  expect(screen.getByRole("region", { name: nomeDetalhes })).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it("confere prazo ao retomar a aba mesmo antes da execução do temporizador", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  prepararDetalhes();
  await clicarValidar();
  vi.setSystemTime(Date.now() + 300_001);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.queryByRole("region", { name: nomeDetalhes })).toBeNull();
});

it("não grava nem lê detalhes em armazenamento persistente do navegador", async () => {
  const gravar = vi.spyOn(Storage.prototype, "setItem");
  const ler = vi.spyOn(Storage.prototype, "getItem");
  prepararDetalhes();
  await clicarValidar();
  expect(screen.getByRole("region", { name: nomeDetalhes })).toBeTruthy();
  expect(gravar).not.toHaveBeenCalled();
  expect(ler).not.toHaveBeenCalled();
});
