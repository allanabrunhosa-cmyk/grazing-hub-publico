/** Regras do cadastro comercial; não movimentam estoque nem emitem documentos. */
import { telefoneOpcionalArmazenado } from "./telefone";
import { CORES_CATEGORIA, type CorCategoria, type EscopoCategoria } from "./classificacao";
import { preservarCodigoMunicipio } from "./municipio";
import { cobrancasDoCliente, identidadePrincipalCliente, LIMITE_COBRANCAS_CLIENTE } from "./cliente-cobranca";
import { normalizarEmailCliente } from "./cliente-identificadores";
import { entregasDoCliente, LIMITE_ENTREGAS_CLIENTE } from "./cliente-entrega";
import { chaveEnderecoPostal, pendenciaEnderecoPostal } from "./cliente-enderecos";
export class ErroCadastroVenda extends Error {}
/** Crédito total permitido em aberto com que todo cliente começa. */
export const LIMITE_CREDITO_ABERTO_PADRAO = "50000.00";
export type EntregaCliente = { destinatario: { nome: string; primeiroNome?: string; sobrenome?: string; contato: string }; endereco: Omit<EnderecoVenda, "nome" | "destinatario">; textoOriginal?: string };
export type EntregaPadraoCliente = EntregaCliente & { enderecos?: EntregaCliente[]; selecionado?: number };
export type IdentidadeCobranca = { tipo: "PF" | "PJ"; nomeCompleto: string; documento: string; razaoSocial: string; inscricaoEstadual: string; inscricaoMunicipal: string; telefone?: string; titularPendente?: boolean };
export type EnderecoVenda = Partial<IdentidadeCobranca> & { nome: string; destinatario: string; pais?: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; codigoMunicipio?: string };
export type RegrasPagamentoCliente = { formasPagamentoIds: string[] | null; boletoDiasAposEntrega: number | null; limiteCreditoAberto: string | null };
export type ClienteEntrada = { id: string; versao: number; nome: string; primeiroNome?: string | null; sobrenome?: string | null; razaoSocial?: string | null; inscricaoEstadual?: string | null; dataNascimento?: string | null; tipo: "PF" | "PJ"; documento: string | null; email: string | null; telefone: string | null; contato: string | null; observacoes: string | null; enderecos: EnderecoVenda[]; ativo: boolean; regrasPagamento?: RegrasPagamentoCliente;
  entregaPadrao?: EntregaPadraoCliente | null;
  nomeContato?: string | null; sobrenomeContato?: string | null;
  /** Estado transitório do formulário, removido pela validação antes de persistir. */
  tipoEscolhido?: boolean;
};
export type CategoriaEntrada = { id: string; versao: number; nome: string; ativo: boolean; escopo?: EscopoCategoria; cor?: CorCategoria };
export type ComposicaoComplemento = ProdutoEntrada["componentes"];
export type AjusteOpcao = { opcaoId: string; preco?: string; composicao?: ComposicaoComplemento | null; ativo?: boolean };
export type PausaComplemento = { opcaoId: string; ativo: boolean; grupos: { id: string; versao: number }[] };
export type OpcaoEntrada = { id: string; nome: string; preco: string; produtoId: string | null; quantidade: string; ativo: boolean; composicao?: ComposicaoComplemento | null; usarPrecoPadrao?: boolean };
export type GrupoEntrada = CategoriaEntrada & { tipo: "COMPOSICAO" | "EXTRAS" | "COMPLEMENTAR"; categoriaId?: string | null; minimo: number; maximo: number | null; repetir: boolean; opcoes: OpcaoEntrada[] };
export type VinculoGrupo = { grupoId: string; usarPadrao: boolean; minimo: number; maximo: number | null; opcoesExcluidas?: string[]; ajustesOpcoes?: AjusteOpcao[] };
export type ProdutoEntrada = {
  id: string; versao: number; nome: string; especificacao: string | null; descricao: string | null;
  tipo: "PADRAO" | "PERSONALIZADO" | "REVENDA"; codigo: string | null; unidade: string;
  fotoUrl: string | null; observacoes: string | null; modoPreparo: string | null; ativo: boolean;
  categorias: string[]; grupos: VinculoGrupo[];
  classificacao?: "PRINCIPAL" | "OPCAO" | "COMPLEMENTO";
  classificacoes?: ("PRINCIPAL" | "OPCAO" | "COMPLEMENTO")[];
  tempoPreparoMinutos?: number | null;
  tipoEmbalagemId?: string | null;
  slotsEntrega?: number | null;
  fiscal?: Record<string, string>;
  fiscalRevisado?: boolean;
  grupoFiscalId?: string | null;
  salvarFiscal?: boolean;
  novoVinculoComplemento?: { grupoId: string; preco: string } | null;
  pausasComplementos?: PausaComplemento[];
  preco: string;
  componentes: { insumoId: string; quantidade: string; unidade: string; observacaoPorcao?: string | null; porcao?: PorcaoComposicao | null; exibirFicha?: boolean }[];
};
export const CAMPOS_FISCAIS = ["ncm", "cest", "origem", "cfop", "csosn", "cstIcms", "pis", "cofins", "ipi", "fcp", "ean", "unidadeTributavel", "observacoes"] as const;
export const CAMPOS_FISCAIS_ADICIONAIS = ["cEnq", "cBenef", "cstIbsCbs", "cClassTrib"] as const;
export type FiscalVenda = Record<typeof CAMPOS_FISCAIS[number], string> & Partial<Record<typeof CAMPOS_FISCAIS_ADICIONAIS[number], string>>;
export function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new ErroCadastroVenda("Dados inválidos.");
  return valor as Record<string, unknown>;
}
export function texto(valor: unknown, campo: string, tamanho = 160, obrigatorio = false): string {
  if (valor == null && !obrigatorio) return "";
  if (typeof valor !== "string") throw new ErroCadastroVenda(`Informe ${campo}.`);
  const limpo = valor.trim();
  if ((obrigatorio && !limpo) || limpo.length > tamanho) throw new ErroCadastroVenda(`${campo}: preencha até ${tamanho} caracteres.`);
  return limpo;
}
function opcional(valor: unknown, campo: string, tamanho = 160) { return texto(valor, campo, tamanho) || null; }
function lista(valor: unknown, campo: string, limite = 250): unknown[] {
  if (!Array.isArray(valor) || valor.length > limite) throw new ErroCadastroVenda(`${campo}: lista inválida ou muito extensa.`);
  return valor;
}
function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== "boolean") throw new ErroCadastroVenda(`${campo}: valor inválido.`);
  return valor;
}
export function inteiro(valor: unknown, campo: string): number {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 0 || valor > 2147483647) throw new ErroCadastroVenda(`${campo}: informe um inteiro válido.`);
  return valor;
}
/** Quantidades preservam decimais; preços aceitam apenas centavos, sem arredondar entrada. */
export function decimal(valor: unknown, campo: string, monetario = false): string {
  const s = typeof valor === "number" ? String(valor) : texto(valor, campo, 40, true).replace(",", ".");
  if (!(monetario ? /^\d{1,10}(\.\d{1,2})?$/ : /^\d{1,10}(\.\d{1,18})?$/).test(s) || !Number.isFinite(Number(s)) || (!monetario && Number(s) <= 0)) throw new ErroCadastroVenda(`${campo}: informe ${monetario ? "um valor não negativo com até duas casas decimais" : "uma quantidade positiva"}.`);
  return s;
}
function semDuplicados(valores: string[], campo: string) {
  if (new Set(valores).size !== valores.length) throw new ErroCadastroVenda(`${campo}: há registros repetidos.`);
}
function identidade(d: Record<string, unknown>) {
  return { id: texto(d.id, "Identificador", 100), versao: inteiro(d.versao ?? 0, "Versão") };
}
export function validarLimites(minimo: unknown, maximo: unknown) {
  const min = inteiro(minimo, "Mínimo");
  const max = maximo === null ? null : inteiro(maximo, "Máximo");
  if (max !== null && max < min) throw new ErroCadastroVenda("O máximo não pode ser menor que o mínimo.");
  return { minimo: min, maximo: max };
}
export function validarIdentidadeCobranca(entrada: unknown, obrigatorio = false): Partial<IdentidadeCobranca> {
  const d = objeto(entrada);
  const telefone = telefoneOpcionalArmazenado(texto(d.telefone, "Telefone da cobrança", 100));
  if (telefone === null) throw new ErroCadastroVenda("Informe o telefone da cobrança com DDD e oito ou nove dígitos.");
  const contato = Object.hasOwn(d, "telefone") ? { telefone } : {};
  if (d.titularPendente !== undefined && typeof d.titularPendente !== "boolean") throw new ErroCadastroVenda("Titular pendente: valor inválido.");
  if (d.titularPendente === true && d.tipo !== "PJ") throw new ErroCadastroVenda("Titular pendente é permitido somente para cobrança de pessoa jurídica sem CNPJ.");
  // Identidade ausente identifica formato legado, preservado na leitura.
  if (d.tipo === undefined) return contato;
  if (d.tipo !== "PF" && d.tipo !== "PJ") throw new ErroCadastroVenda("Escolha o tipo da cobrança.");
  const documento = texto(d.documento, "CPF / CNPJ da cobrança", 30).replace(/[.\-/\s]/g, "");
  if (documento && !new RegExp(`^\\d{${d.tipo === "PF" ? 11 : 14}}$`).test(documento)) throw new ErroCadastroVenda("CPF / CNPJ da cobrança inválido.");
  if (obrigatorio && d.titularPendente === true && !documento) throw new ErroCadastroVenda("Titular pendente. Confirme o CNPJ antes de faturar.");
  const inscricao = (valor: unknown, nome: string) => {
    const s = texto(valor, nome, 40).toUpperCase();
    if (s && !/^(?:[0-9.\-/ ]+|ISENTO)$/.test(s)) throw new ErroCadastroVenda(`${nome}: use números ou ISENTO.`);
    return s;
  };
  const nomeCompleto = texto(d.nomeCompleto, "Nome Completo da cobrança", 160, obrigatorio && d.tipo === "PF");
  const razaoSocial = texto(d.razaoSocial, "Razão social da cobrança", 160, d.tipo === "PJ" && (obrigatorio || d.titularPendente === true && !!documento));
  if (obrigatorio && d.tipo === "PJ" && !documento) throw new ErroCadastroVenda("Informe o CNPJ da cobrança.");
  return { ...contato, tipo: d.tipo, nomeCompleto: d.tipo === "PF" ? nomeCompleto : "", documento, razaoSocial: d.tipo === "PJ" ? razaoSocial : "",
    inscricaoEstadual: d.tipo === "PJ" ? inscricao(d.inscricaoEstadual, "Inscrição Estadual") : "", inscricaoMunicipal: d.tipo === "PJ" ? inscricao(d.inscricaoMunicipal, "Inscrição Municipal") : "", ...(d.titularPendente === true && !documento ? { titularPendente: true } : {}) };
}
export function validarCliente(entrada: unknown): ClienteEntrada {
  let d = objeto(entrada);
  if (d.tipoEscolhido === false) throw new ErroCadastroVenda("Escolha o tipo de cliente.");
  if (d.tipo !== "PF" && d.tipo !== "PJ") throw new ErroCadastroVenda("Escolha pessoa física ou jurídica.");
  const enderecosInformados = lista(d.enderecos, "Endereços", LIMITE_COBRANCAS_CLIENTE).map(valor => objeto(valor));
  if (enderecosInformados[0]?.titularPendente === true) throw new ErroCadastroVenda("A cobrança Principal não pode ter titular pendente.");
  if (enderecosInformados[0]?.tipo) {
    const cliente = { ...d, enderecos: enderecosInformados } as unknown as ClienteEntrada;
    const principal = identidadePrincipalCliente(cliente);
    d = { ...d, documento: principal.documento, ...(d.tipo === "PJ" ? { razaoSocial: principal.razaoSocial, inscricaoEstadual: principal.inscricaoEstadual } : {}), enderecos: cobrancasDoCliente(cliente) };
  }
  const documento = texto(d.documento, "Documento", 30).replace(/[.\-/\s]/g, "");
  if (documento && !new RegExp(`^\\d{${d.tipo === "PF" ? 11 : 14}}$`).test(documento)) throw new ErroCadastroVenda(`Informe ${d.tipo === "PF" ? "11 dígitos de CPF" : "14 dígitos de CNPJ"}.`);
  const email = normalizarEmailCliente(opcional(d.email, "E-mail", 254));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroCadastroVenda("Informe um e-mail válido.");
  const enderecos = lista(d.enderecos, "Endereços", LIMITE_COBRANCAS_CLIENTE).map((valor, indice) => {
    const e = objeto(valor);
    const pais = texto(e.pais ?? "Brasil", "País", 80, true);
    const brasileiro = pais.toLocaleLowerCase("pt-BR") === "brasil";
    const cepInformado = texto(e.cep, "CEP / código postal", brasileiro ? 9 : 30);
    const cep = brasileiro ? cepInformado.replace(/[-\s]/g, "") : cepInformado;
    if (brasileiro && cep && !/^\d{8}$/.test(cep)) throw new ErroCadastroVenda("CEP: informe oito dígitos.");
    const uf = texto(e.uf, "Estado", brasileiro ? 2 : 120).toUpperCase();
    if (brasileiro && uf && !"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ").includes(uf)) throw new ErroCadastroVenda("UF inválida.");
    const identidadeLivre = validarIdentidadeCobranca(e);
    const identidadeCobranca = indice > 0 && identidadeLivre.titularPendente ? identidadeLivre : validarIdentidadeCobranca(e, true);
    return { ...identidadeCobranca, nome: texto(e.nome, "Nome do endereço", 80, true), destinatario: texto(e.destinatario, "Destinatário"), pais, cep,
      logradouro: texto(e.logradouro, "Logradouro", 200, true), numero: texto(e.numero, "Número", 30, true), complemento: texto(e.complemento, "Complemento"), bairro: texto(e.bairro, "Bairro"), cidade: texto(e.cidade, "Cidade", 120, true), uf,
      ...preservarCodigoMunicipio(e.codigoMunicipio, uf, pais, mensagem => new ErroCadastroVenda(mensagem)) };
  });
  const dataNascimento = texto(d.dataNascimento, "Data de nascimento", 10);
  if (dataNascimento) {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(dataNascimento) ? new Date(`${dataNascimento}T00:00:00Z`) : null;
    if (!data || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dataNascimento) throw new ErroCadastroVenda("Data de nascimento inválida.");
  }
  const contato = d.tipo === "PJ" && (d.nomeContato != null || d.sobrenomeContato != null)
    ? [texto(d.nomeContato, "Nome do contato", 80), texto(d.sobrenomeContato, "Sobrenome do contato", 80)].filter(Boolean).join(" ")
    : d.contato;
  return { ...identidade(d), nome: texto(d.nome, "Nome", 160, true),
    ...(Object.hasOwn(d, "primeiroNome") ? { primeiroNome: opcional(d.primeiroNome, "Primeiro nome", 160) } : {}),
    ...(Object.hasOwn(d, "sobrenome") ? { sobrenome: opcional(d.sobrenome, "Sobrenome", 160) } : {}),
    ...(Object.hasOwn(d, "nomeContato") ? { nomeContato: opcional(d.nomeContato, "Nome do contato", 80) } : {}),
    ...(Object.hasOwn(d, "sobrenomeContato") ? { sobrenomeContato: opcional(d.sobrenomeContato, "Sobrenome do contato", 80) } : {}),
    ...(Object.hasOwn(d, "razaoSocial") ? { razaoSocial: opcional(d.razaoSocial, "Razão social", 160) } : {}),
    ...(Object.hasOwn(d, "inscricaoEstadual") ? { inscricaoEstadual: opcional(d.inscricaoEstadual, "Inscrição estadual", 40) } : {}),
    ...(Object.hasOwn(d, "dataNascimento") ? { dataNascimento: dataNascimento || null } : {}),
    ...(Object.hasOwn(d, "entregaPadrao") ? { entregaPadrao: validarEntregaPadraoCliente(d.entregaPadrao) } : {}),
    tipo: d.tipo === "PJ" ? "PJ" : "PF", documento: documento || null, email,
    telefone: opcional(d.telefone, "Telefone", 40), contato: opcional(contato, "Contato"), observacoes: opcional(d.observacoes, "Observações", 2000), enderecos, ativo: booleano(d.ativo, "Ativo"),
    ...(d.regrasPagamento === undefined ? {} : { regrasPagamento: validarRegrasPagamentoCliente(d.regrasPagamento) }) };
}
function conferirPostaisCliente(enderecos: unknown[], livro: string) {
    const chaves = new Set<string>();
    for (const endereco of enderecos) {
      const pendencia = pendenciaEnderecoPostal(endereco);
      if (pendencia) throw new ErroCadastroVenda(`${livro}: ${pendencia}`);
      const chave = chaveEnderecoPostal(endereco)!;
      if (chaves.has(chave)) throw new ErroCadastroVenda(`${livro}: este endereço postal já existe no cadastro. Não repita o mesmo endereço.`);
      chaves.add(chave);
    }
}
export function validarEntregasClienteCompletas(padrao: EntregaPadraoCliente | null | undefined): void {
  const entregas = entregasDoCliente(padrao);
  for (const entrega of entregas) if (!entrega.destinatario.nome.trim()) throw new ErroCadastroVenda("Informe o nome do destinatário da entrega.");
  conferirPostaisCliente(entregas.map(entrega => entrega.endereco), "Entrega");
}
/** Fronteira de gravação interativa. Os parsers legados continuam preservando históricos. */
export function validarLivroEnderecosClienteCompleto(cliente: ClienteEntrada): void {
  if (!cliente.enderecos.length) throw new ErroCadastroVenda("Cadastre ao menos o endereço de cobrança Principal.");
  const cobrancas = cobrancasDoCliente(cliente);
  for (const cobranca of cobrancas) validarIdentidadeCobranca(cobranca, true);
  conferirPostaisCliente(cobrancas, "Cobrança");
  validarEntregasClienteCompletas(cliente.entregaPadrao);
}
/** Defaults cadastrais opcionais, sem data, horário ou modo de atendimento. */
export function validarEntregaPadraoCliente(entrada: unknown): EntregaPadraoCliente | null {
  if (entrada == null) return null;
  const d = objeto(entrada);
  if (!Object.hasOwn(d, "enderecos")) return validarOpcaoEntregaCliente(d);
  if (Array.isArray(d.enderecos) && d.enderecos.length > LIMITE_ENTREGAS_CLIENTE) throw new ErroCadastroVenda(`Cadastre no máximo ${LIMITE_ENTREGAS_CLIENTE} endereços de entrega.`);
  const listaEnderecos = lista(d.enderecos, "Endereços de entrega", LIMITE_ENTREGAS_CLIENTE);
  if (!listaEnderecos.length) throw new ErroCadastroVenda("Cadastre ao menos um endereço de entrega ou remova a entrega padrão.");
  const enderecos = listaEnderecos.map(valor => {
    const entrega = validarOpcaoEntregaCliente(valor);
    if (!entrega) throw new ErroCadastroVenda("Preencha o destinatário ou o endereço de cada entrega cadastrada.");
    return entrega;
  });
  const selecionado = d.selecionado === undefined ? 0 : inteiro(d.selecionado, "Entrega selecionada");
  if (selecionado >= enderecos.length) throw new ErroCadastroVenda("Selecione um endereço de entrega cadastrado.");
  return { ...enderecos[selecionado], enderecos, selecionado };
}
function validarOpcaoEntregaCliente(entrada: unknown): EntregaCliente | null {
  const d = objeto(entrada), pessoa = objeto(d.destinatario), endereco = objeto(d.endereco);
  texto(d.textoOriginal, "Endereço original", 2000);
  if (typeof d.textoOriginal === "string" && d.textoOriginal.length > 2000) throw new ErroCadastroVenda("Endereço original: preencha até 2000 caracteres.");
  const textoOriginal = typeof d.textoOriginal === "string" && d.textoOriginal.trim() ? d.textoOriginal : "";
  const contato = telefoneOpcionalArmazenado(texto(pessoa.contato, "Telefone da entrega", 100));
  if (contato === null) throw new ErroCadastroVenda("Informe o telefone da entrega com DDD e oito ou nove dígitos.");
  const destinatario = { nome: texto(pessoa.nome, "Destinatário", 160), primeiroNome: texto(pessoa.primeiroNome, "Nome do destinatário", 80), sobrenome: texto(pessoa.sobrenome, "Sobrenome do destinatário", 80), contato };
  const normalizado = { pais: texto(endereco.pais ?? "Brasil", "País", 80), cep: texto(endereco.cep, "CEP", 30), logradouro: texto(endereco.logradouro, "Logradouro", 200), numero: texto(endereco.numero, "Número", 30), complemento: texto(endereco.complemento, "Complemento", 160), bairro: texto(endereco.bairro, "Bairro", 120), cidade: texto(endereco.cidade, "Cidade", 120), uf: texto(endereco.uf, "Estado", 120).toUpperCase() };
  if (normalizado.pais.toLocaleLowerCase("pt-BR") === "brasil" && normalizado.cep && !/^\d{5}-?\d{3}$/.test(normalizado.cep)) throw new ErroCadastroVenda("Informe um CEP brasileiro com oito dígitos para entrega.");
  if (!textoOriginal && !destinatario.nome && !destinatario.contato && !Object.entries(normalizado).some(([chave, valor]) => chave !== "pais" && valor)) return null;
  return { destinatario, endereco: { ...normalizado, ...preservarCodigoMunicipio(endereco.codigoMunicipio, normalizado.uf, normalizado.pais, mensagem => new ErroCadastroVenda(mensagem)) }, ...(textoOriginal ? { textoOriginal } : {}) };
}
export function validarRegrasPagamentoCliente(entrada: unknown): RegrasPagamentoCliente {
  const d = objeto(entrada);
  const formasPagamentoIds = d.formasPagamentoIds === null ? null : lista(d.formasPagamentoIds, "Formas de pagamento", 100).map(id => texto(id, "Forma de pagamento", 100, true));
  if (formasPagamentoIds) semDuplicados(formasPagamentoIds, "Formas de pagamento");
  const boletoDiasAposEntrega = d.boletoDiasAposEntrega === null ? null : inteiro(d.boletoDiasAposEntrega, "Prazo máximo do boleto");
  if (boletoDiasAposEntrega !== null && boletoDiasAposEntrega > 3650) throw new ErroCadastroVenda("Prazo máximo do boleto: informe no máximo 3650 dias.");
  const limiteCreditoAberto = d.limiteCreditoAberto === null ? null : decimal(d.limiteCreditoAberto, "Limite de crédito em aberto", true);
  return { formasPagamentoIds, boletoDiasAposEntrega, limiteCreditoAberto };
}
export function validarCategoria(entrada: unknown): CategoriaEntrada {
  const d = objeto(entrada);
  return { ...identidade(d), nome: texto(d.nome, "Nome", 120, true), ativo: booleano(d.ativo, "Ativo") };
}
export function validarCategoriaComercial(entrada: unknown) {
  const d = objeto(entrada);
  if (d.escopo !== undefined && d.escopo !== "PRODUTO" && d.escopo !== "COMPLEMENTO") throw new ErroCadastroVenda("Escopo de categoria inválido.");
  if (d.cor !== undefined && (typeof d.cor !== "string" || !Object.hasOwn(CORES_CATEGORIA, d.cor))) throw new ErroCadastroVenda("Cor de categoria inválida.");
  return { ...validarCategoria(d), ...(d.escopo === undefined ? {} : { escopo: d.escopo as EscopoCategoria }), ...(d.cor === undefined ? {} : { cor: d.cor as CorCategoria }) };
}
export function validarComponentes(entrada: unknown): ComposicaoComplemento {
  const componentes = lista(entrada, "Composição").map(valor => {
    const c = objeto(valor), quantidade = decimal(c.quantidade, "Quantidade"), unidade = texto(c.unidade, "Unidade", 20, true);
    const validada = validarPorcaoComposicao(c.porcao, quantidade, unidade);
    if ("erro" in validada) throw new ErroCadastroVenda(validada.erro);
    const calculada = validada.porcao && calcularPorcao(validada.porcao);
    return { insumoId: texto(c.insumoId, "Insumo", 100, true), quantidade, unidade,
      observacaoPorcao: calculada && !("erro" in calculada) ? calculada.observacaoPorcao : opcional(c.observacaoPorcao, "Porção alternativa", 120),
      ...(validada.porcao ? { porcao: validada.porcao } : {}), exibirFicha: c.exibirFicha === undefined ? true : booleano(c.exibirFicha, "Exibir na ficha técnica") };
  });
  semDuplicados(componentes.map(c => c.insumoId), "Ingredientes");
  return componentes;
}
export function lerAjustesOpcoes(entrada: unknown): AjusteOpcao[] {
  if (entrada == null) return [];
  const ajustes = lista(entrada, "Ajustes de complementos", 500).map(valor => {
    const a = objeto(valor);
    return { opcaoId: texto(a.opcaoId, "Complemento", 100, true),
      ...(a.preco === undefined ? {} : { preco: decimal(a.preco, "Preço do complemento", true) }),
      ...(a.ativo === undefined ? {} : { ativo: booleano(a.ativo, "Complemento ativo") }),
      ...(a.composicao === undefined ? {} : { composicao: a.composicao === null ? null : validarComponentes(a.composicao) }) };
  });
  semDuplicados(ajustes.map(a => a.opcaoId), "Ajustes de complementos");
  return ajustes;
}
/** Substituições locais nunca reativam uma opção pausada no grupo. */
export function opcoesEfetivas<T extends { id: string; preco: string; ativo: boolean }>(opcoes: T[], vinculo: Pick<VinculoGrupo, "opcoesExcluidas" | "ajustesOpcoes">): (T & { composicao?: ComposicaoComplemento | null })[] {
  return opcoes.map(o => { const a = vinculo.ajustesOpcoes?.find(a => a.opcaoId === o.id); return { ...o,
    ...(a?.preco === undefined ? {} : { preco: a.preco }), ...(a?.composicao == null ? {} : { composicao: a.composicao }),
    ativo: o.ativo && a?.ativo !== false && !vinculo.opcoesExcluidas?.includes(o.id) }; });
}
export function validarGrupo(entrada: unknown): GrupoEntrada {
  const d = objeto(entrada);
  if (d.tipo !== "COMPOSICAO" && d.tipo !== "EXTRAS" && d.tipo !== "COMPLEMENTAR") throw new ErroCadastroVenda("Tipo de grupo inválido.");
  const limites = d.tipo === "EXTRAS" ? { minimo: 0, maximo: null } : validarLimites(d.minimo, d.maximo);
  const opcoes = lista(d.opcoes, "Opções", 500).map((valor) => {
    const o = objeto(valor);
    return { id: texto(o.id, "Identificador", 100), nome: texto(o.nome, "Nome da opção", 160, true), preco: decimal(o.preco, "Preço da opção", true), produtoId: opcional(o.produtoId, "Produto", 100), quantidade: decimal(o.quantidade, "Quantidade da composição"), ativo: booleano(o.ativo, "Opção ativa"), ...(o.usarPrecoPadrao === undefined ? {} : { usarPrecoPadrao: booleano(o.usarPrecoPadrao, "Preço do cadastro") }), ...(o.composicao === undefined ? {} : { composicao: o.composicao === null ? null : validarComponentes(o.composicao) }) };
  });
  semDuplicados(opcoes.map(o => o.id).filter(Boolean), "Opções");
  semDuplicados(opcoes.map(o => o.nome.toLocaleLowerCase("pt-BR")), "Nomes das opções");
  return { ...validarCategoria(d), tipo: d.tipo, categoriaId: opcional(d.categoriaId, "Categoria do grupo", 100), ...limites, repetir: d.tipo === "EXTRAS" ? true : booleano(d.repetir, "Repetir"), opcoes };
}
export function validarProduto(entrada: unknown): ProdutoEntrada {
  const d = objeto(entrada);
  if (d.tipo !== "PADRAO" && d.tipo !== "PERSONALIZADO" && d.tipo !== "REVENDA") throw new ErroCadastroVenda("Tipo de produto inválido.");
  const categorias = lista(d.categorias, "Categorias", 30).map(c => texto(c, "Categoria", 100, true));
  const grupos = lista(d.grupos, "Grupos", 50).map(valor => { const g = objeto(valor); const opcoesExcluidas = lista(g.opcoesExcluidas ?? [], "Opções excluídas", 500).map(o => texto(o, "Opção", 100, true)); semDuplicados(opcoesExcluidas, "Opções excluídas"); return { grupoId: texto(g.grupoId, "Grupo", 100, true), usarPadrao: booleano(g.usarPadrao, "Regra padrão"), ...validarLimites(g.minimo, g.maximo), opcoesExcluidas, ...(g.ajustesOpcoes === undefined ? {} : { ajustesOpcoes: lerAjustesOpcoes(g.ajustesOpcoes) }) }; });
  if (Object.hasOwn(d, "precos") || Object.hasOwn(d, "precoComplemento")) throw new ErroCadastroVenda("Reabra o cadastro: o catálogo agora usa preço único.");
  const preco = decimal(d.preco, "Preço", true);
  const componentes = validarComponentes(d.componentes);
  const classificacoes = lista(d.classificacoes ?? [d.classificacao ?? "PRINCIPAL"], "Classificações", 3).map(c => texto(c, "Classificação", 20, true)) as NonNullable<ProdutoEntrada["classificacoes"]>;
  if (classificacoes.length !== 1 || classificacoes.some(c => !["PRINCIPAL", "COMPLEMENTO"].includes(c))) throw new ErroCadastroVenda("Escolha uma classificação: Produto ou Complemento.");
  semDuplicados(classificacoes, "Classificações");
  if (!classificacoes.includes("PRINCIPAL") && grupos.length) throw new ErroCadastroVenda("Somente Produtos podem conter grupos próprios.");
  const tempoPreparoMinutos = d.tempoPreparoMinutos == null ? null : inteiro(d.tempoPreparoMinutos, "Tempo de preparo");
  const embalagem = Object.hasOwn(d, "tipoEmbalagemId") ? { tipoEmbalagemId: opcional(d.tipoEmbalagemId, "Tipo de embalagem", 100) } : {};
  const slots = Object.hasOwn(d, "slotsEntrega") ? { slotsEntrega: d.slotsEntrega == null ? null : inteiro(d.slotsEntrega, "Slots de entrega") } : {};
  if (slots.slotsEntrega != null && slots.slotsEntrega > 999999) throw new ErroCadastroVenda("Slots de entrega: máximo de 999999.");
  const vinculo = d.novoVinculoComplemento == null ? null : objeto(d.novoVinculoComplemento);
  const novoVinculoComplemento = vinculo ? { grupoId: texto(vinculo.grupoId, "Grupo do complemento", 100, true), preco: decimal(vinculo.preco, "Preço no grupo", true) } : null;
  semDuplicados(categorias, "Categorias"); semDuplicados(grupos.map(g => g.grupoId), "Grupos"); semDuplicados(componentes.map(c => c.insumoId), "Ingredientes");
  const fotoUrl = opcional(d.fotoUrl, "Foto", 2000);
  if (fotoUrl && !/^\/api\/vendas\/fotos\/[a-zA-Z0-9_-]+$/.test(fotoUrl)) throw new ErroCadastroVenda("Utilize uma foto enviada pelo cadastro de produtos.");
  return { ...identidade(d), ...embalagem, ...slots,
    pausasComplementos: lista(d.pausasComplementos ?? [], "Pausas de complementos", 500).map(valor => { const p = objeto(valor); const grupos = lista(p.grupos, "Grupos afetados", 500).map(valor => identidade(objeto(valor))); semDuplicados(grupos.map(g => g.id), "Grupos afetados"); return { opcaoId: texto(p.opcaoId, "Complemento", 100, true), ativo: booleano(p.ativo, "Complemento ativo"), grupos }; }),
    classificacao: classificacoes[0], classificacoes, tempoPreparoMinutos, novoVinculoComplemento, nome: texto(d.nome, "Nome", 160, true), especificacao: opcional(d.especificacao, "Especificação", 300), descricao: opcional(d.descricao, "Descrição", 3000), tipo: d.tipo, codigo: opcional(d.codigo, "Código interno", 80), unidade: texto(d.unidade, "Unidade", 10, true).toUpperCase(), fotoUrl, observacoes: opcional(d.observacoes, "Observações", 3000), modoPreparo: opcional(d.modoPreparo, "Modo de preparo", 5000), ativo: booleano(d.ativo, "Ativo"), categorias, grupos, preco, componentes };
}
export function validarFiscal(entrada: unknown, revisado: boolean): FiscalVenda {
  const d = objeto(entrada);
  const fiscal = Object.fromEntries(CAMPOS_FISCAIS.map(c => [c, texto(d[c], c, c === "observacoes" ? 2000 : 30)])) as FiscalVenda;
  const adicionais = { cEnq: /^\d{3}$/, cBenef: /^[A-Z]{2}\d{6}$/, cstIbsCbs: /^\d{3}$/, cClassTrib: /^\d{6}$/ };
  for (const campo of CAMPOS_FISCAIS_ADICIONAIS) if (d[campo] !== undefined && d[campo] !== "") {
    const valor = texto(d[campo], campo, 8);
    if (!adicionais[campo].test(valor)) throw new ErroCadastroVenda(`${campo}: código fiscal inválido.`);
    fiscal[campo] = valor;
  }
  const formatos: Partial<Record<keyof FiscalVenda, RegExp>> = { ncm: /^\d{8}$/, cest: /^\d{7}$/, origem: /^[0-8]$/, cfop: /^\d{4}$/, csosn: /^\d{3}$/, cstIcms: /^\d{2}$/, pis: /^\d{2}$/, cofins: /^\d{2}$/, ipi: /^\d{2}$/, ean: /^(\d{8}|\d{12,14}|SEM GTIN)$/ };
  for (const [campo, regra] of Object.entries(formatos)) { const valor = fiscal[campo as keyof FiscalVenda]; if (valor && !regra.test(valor)) throw new ErroCadastroVenda(`${campo.toUpperCase()}: formato inválido.`); }
  if (fiscal.fcp && (!/^\d{1,2}(\.\d{1,4})?$|^100(\.0{1,4})?$/.test(fiscal.fcp))) throw new ErroCadastroVenda("FCP: informe percentual entre 0 e 100.");
  if (revisado && (!fiscal.ncm || !fiscal.origem || !fiscal.cfop || (!fiscal.csosn && !fiscal.cstIcms) || !fiscal.pis || !fiscal.cofins)) throw new ErroCadastroVenda("Preencha NCM, origem, CFOP, CSOSN ou CST, PIS e COFINS antes de marcar como revisado.");
  return fiscal;
}

export type GrupoSimulacao = { id: string; nome: string; tipo: string; minimo: number; maximo: number | null; repetir: boolean; ativo: boolean; opcoes: { id: string; nome: string; preco: string; ativo: boolean }[] };
export function limitesEfetivos(grupo: Pick<GrupoSimulacao, "tipo" | "minimo" | "maximo">, vinculo: Omit<VinculoGrupo, "ajustesOpcoes"> & { ajustesOpcoes?: unknown }) {
  return grupo.tipo === "EXTRAS" ? { minimo: 0, maximo: null } : vinculo.usarPadrao ? { minimo: grupo.minimo, maximo: grupo.maximo } : { minimo: vinculo.minimo, maximo: vinculo.maximo };
}
/** Base zero é vendável se uma escolha obrigatória válida puder formar preço positivo. */
export function precoObrigatorioNaConfiguracao(grupos: (Pick<GrupoSimulacao, "id" | "tipo" | "minimo" | "maximo" | "repetir" | "ativo"> & { opcoes: { id: string; preco: string; ativo: boolean }[] })[], vinculos: VinculoGrupo[]) {
  let configuracaoPagaPossivel = false;
  for (const vinculo of vinculos) {
    const grupo = grupos.find(g => g.id === vinculo.grupoId);
    if (!grupo) return false;
    const { minimo } = limitesEfetivos(grupo, vinculo);
    if (!minimo) continue;
    if (!grupo.ativo) return false;
    const valores = opcoesEfetivas(grupo.opcoes, vinculo).filter(o => o.ativo).map(o => Math.round(Number(o.preco) * 100));
    if (!valores.length || (!grupo.repetir && valores.length < minimo)) return false;
    if (valores.some(v => v > 0)) configuracaoPagaPossivel = true;
  }
  return configuracaoPagaPossivel;
}
export function simularConfiguracao(precoBase: string, grupos: (GrupoSimulacao & { vinculo: VinculoGrupo })[], escolhas: Record<string, number>) {
  grupos = grupos.map(g => ({ ...g, opcoes: opcoesEfetivas(g.opcoes, g.vinculo) }));
  let totalCentavos = Math.round(Number(decimal(precoBase, "Preço", true)) * 100);
  const erros: string[] = [];
  for (const grupo of grupos.filter(g => !g.ativo)) if (limitesEfetivos(grupo, grupo.vinculo).minimo > 0) erros.push(`${grupo.nome}: grupo obrigatório inativo. Revise o cadastro antes de configurar.`);
  const permitidas = new Set(grupos.flatMap(g => g.ativo ? g.opcoes.filter(o => o.ativo).map(o => o.id) : []));
  for (const [id, quantidade] of Object.entries(escolhas)) if (quantidade !== 0 && (!permitidas.has(id) || !Number.isSafeInteger(quantidade) || quantidade < 0)) erros.push("Seleção inválida ou opção indisponível.");
  for (const grupo of grupos.filter(g => g.ativo)) {
    const limites = limitesEfetivos(grupo, grupo.vinculo);
    let selecionadas = 0;
    for (const opcao of grupo.opcoes.filter(o => o.ativo)) {
      const quantidade = escolhas[opcao.id] ?? 0;
      if (!Number.isSafeInteger(quantidade) || quantidade < 0) continue;
      if (!grupo.repetir && quantidade > 1) erros.push(`${grupo.nome}: escolha cada opção no máximo uma vez.`);
      selecionadas += quantidade;
      totalCentavos += Math.round(Number(opcao.preco) * 100) * quantidade;
    }
    if (selecionadas < limites.minimo || (limites.maximo !== null && selecionadas > limites.maximo)) erros.push(`${grupo.nome}: escolha ${limites.minimo}${limites.maximo === null ? " ou mais" : limites.minimo === limites.maximo ? "" : ` a ${limites.maximo}`} opção(ões).`);
  }
  if (!Number.isSafeInteger(totalCentavos)) erros.push("O total excede a precisão suportada; reduza a quantidade.");
  return { valido: erros.length === 0, totalCentavos, erros };
}
import { calcularPorcao, validarPorcaoComposicao, type PorcaoComposicao } from "@/lib/insumos/porcoes";
