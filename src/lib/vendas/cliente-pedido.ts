import { cobrancasDoCliente, LIMITE_COBRANCAS_CLIENTE } from "./cliente-cobranca";
import { ErroCadastroVenda, objeto, validarCliente, validarEntregasClienteCompletas, validarLivroEnderecosClienteCompleto, type ClienteEntrada } from "./dominio";

function informacoesClientePedido(entrada: ClienteEntrada, exigirEmail = false) {
  if (entrada.tipoEscolhido === false || !["PF", "PJ"].includes(entrada.tipo)) throw new ErroCadastroVenda("Escolha o tipo de cliente.");
  const nome = entrada.nome?.trim() || [entrada.primeiroNome, entrada.sobrenome].filter(Boolean).join(" ").trim();
  if (entrada.tipo === "PF" && !nome) throw new ErroCadastroVenda("Informe o Nome Completo.");
  if (entrada.tipo === "PJ" && !entrada.nome?.trim()) throw new ErroCadastroVenda("Informe o nome fantasia.");
  const telefone = (entrada.telefone ?? "").replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(telefone)) throw new ErroCadastroVenda("Informe DDI do Brasil, DDD e telefone com oito ou nove dígitos.");
  if (exigirEmail && !entrada.email?.trim()) throw new ErroCadastroVenda("Informe o e-mail para identificar o cliente. Busque antes um cadastro existente.");
  return { ...entrada, nome: entrada.tipo === "PF" ? nome : entrada.nome, telefone: `+${telefone}` };
}
function conferirCobrancaCliente(enderecos: ClienteEntrada["enderecos"]) {
  if (!Array.isArray(enderecos) || !enderecos.length || enderecos.length > LIMITE_COBRANCAS_CLIENTE) throw new ErroCadastroVenda(`Cadastre de um a ${LIMITE_COBRANCAS_CLIENTE} endereços de cobrança.`);
  for (const cobranca of enderecos) {
  if (!cobranca || [cobranca.pais, cobranca.cep, cobranca.logradouro, cobranca.numero, cobranca.bairro, cobranca.cidade, cobranca.uf].some(v => !v?.trim())) throw new ErroCadastroVenda("Preencha todos os campos obrigatórios do endereço de cobrança.");
  if (cobranca.pais?.toLocaleLowerCase("pt-BR") === "brasil" && !/^\d{8}$/.test(cobranca.cep.replace(/\D/g, ""))) throw new ErroCadastroVenda("Informe um CEP brasileiro com oito dígitos.");
  }
}
/** Cadastro novo solicitado ao salvar um pedido. */
export function validarClienteNovoPedido(entrada: ClienteEntrada, permitirLegadoSemEmail = false) {
  if (entrada.id || entrada.versao !== 0) throw new ErroCadastroVenda("Cadastro novo inválido.");
  const informado = informacoesClientePedido(entrada, !permitirLegadoSemEmail);
  conferirCobrancaCliente(entrada.enderecos);
  const cliente = validarCliente({ ...informado, enderecos: cobrancasDoCliente(informado).map((endereco, indice) => ({ ...endereco, nome: endereco.nome || `Endereço ${indice + 1}` })) });
  validarLivroEnderecosClienteCompleto(cliente);
  return cliente;
}

const camposClientePedido = ["id", "versao", "nome", "primeiroNome", "sobrenome", "tipo", "documento", "razaoSocial", "inscricaoEstadual", "telefone", "email", "contato", "nomeContato", "sobrenomeContato", "dataNascimento"] as const;
export type AtualizacaoClientePedido = Pick<ClienteEntrada, typeof camposClientePedido[number]> & { enderecos?: ClienteEntrada["enderecos"]; entregaPadrao?: ClienteEntrada["entregaPadrao"] };

/** Somente dados expostos no pedido; regras, status e observações vêm do cadastro salvo. */
export function validarAtualizacaoClientePedido(entrada: unknown): AtualizacaoClientePedido {
  const d = objeto(entrada);
  const valores = Object.fromEntries(camposClientePedido.filter(c => Object.hasOwn(d, c)).map(c => [c, d[c]]));
  const validado = validarCliente({ ...valores, tipoEscolhido: d.tipoEscolhido, ativo: true, observacoes: null, enderecos: d.enderecos ?? [], ...(d.entregaPadrao !== undefined ? { entregaPadrao: d.entregaPadrao } : {}) });
  if (!validado.id || validado.versao < 1) throw new ErroCadastroVenda("Selecione um cliente e reabra seu cadastro antes de atualizar.");
  const informado = informacoesClientePedido(validado);
  if (d.enderecos !== undefined) conferirCobrancaCliente(validado.enderecos);
  // A atualização parcial valida somente os livros fornecidos; a persistência confere o cadastro completo.
  if (d.enderecos !== undefined) validarLivroEnderecosClienteCompleto(validado);
  else if (d.entregaPadrao !== undefined) validarEntregasClienteCompletas(validado.entregaPadrao);
  return { ...Object.fromEntries(camposClientePedido.filter(c => Object.hasOwn(informado, c)).map(c => [c, informado[c]])),
    id: informado.id, versao: informado.versao, nome: informado.nome, tipo: informado.tipo, documento: informado.documento, email: informado.email, telefone: informado.telefone, contato: informado.contato,
    ...(d.enderecos !== undefined ? { enderecos: validado.enderecos } : {}), ...(d.entregaPadrao !== undefined ? { entregaPadrao: validado.entregaPadrao } : {}) };
}

/** Mesmas regras do cadastro no pedido, conservando identidade e todos os endereços. */
export function validarClienteCadastro(entrada: ClienteEntrada) {
  const partes = entrada.nome.trim().split(/\s+/);
  const identidade = {
    ...entrada,
    primeiroNome: entrada.primeiroNome ?? (entrada.tipo === "PF" ? partes[0] ?? "" : null),
    sobrenome: entrada.sobrenome ?? (entrada.tipo === "PF" ? partes.slice(1).join(" ") : null),
    enderecos: entrada.enderecos.map(endereco => ({ ...endereco, pais: endereco.pais ?? "Brasil" })),
  };
  const validado = validarClienteNovoPedido({ ...identidade, id: "", versao: 0 }, !!entrada.id);
  return validarCliente({ ...validado, id: entrada.id, versao: entrada.versao, enderecos: validado.enderecos });
}

/** Conserva a preferência legada; cadastros novos iniciam na primeira aba. */
export function indiceEnderecoCobrancaInicial(enderecos: unknown[]): number {
  const indice = enderecos.findIndex(e => e && typeof e === "object" && !Array.isArray(e) && "nome" in e && e.nome === "Cobrança");
  return indice < 0 ? 0 : indice;
}
