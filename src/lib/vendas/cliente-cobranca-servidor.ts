import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ClienteVenda } from "@/generated/prisma/client";
import { cobrancasDoCliente } from "./cliente-cobranca";
import { chaveEnderecoPostal, camposEnderecoObrigatorios, pendenciaEnderecoPostal } from "./cliente-enderecos";
import { consultarCnpjVenda } from "./cnpj";
import { ErroCadastroVenda, validarCliente, validarLivroEnderecosClienteCompleto, type ClienteEntrada, type EnderecoVenda } from "./dominio";
import { formatarNomesClienteNovo, preservarNomesNaMudancaTipo } from "./clientes-identidade";

/** Só objetos emitidos neste processo comprovam consulta anterior à transação. */
export type ClientePreparado = { entrada: ClienteEntrada; comprovacao: object };
const comprovacoes = new WeakMap<object, { id: string; versao: number; assinatura: string }>();
const assinatura = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const cobrancasAnteriores = (antes: ClienteVenda | null) => antes ? cobrancasDoCliente({ ...antes, tipo: antes.tipo as "PF" | "PJ", enderecos: antes.enderecos as EnderecoVenda[] }) : [];
const identidadePostal = (e: EnderecoVenda) => JSON.stringify([e.tipo, e.documento ?? "", e.razaoSocial ?? "", e.inscricaoEstadual ?? "", e.inscricaoMunicipal ?? "", chaveEnderecoPostal(e), e.codigoMunicipio ?? ""]);
function cobrancasAlteradas(cliente: ClienteEntrada, antes: ClienteVenda | null) {
  const anteriores = new Set(cobrancasAnteriores(antes).map(identidadePostal));
  return cobrancasDoCliente(cliente).map(e => e.tipo === "PJ" && !anteriores.has(identidadePostal(e)));
}

export function normalizarClienteParaSalvar(entrada: unknown, antes: ClienteVenda | null): ClienteEntrada {
  let cliente = formatarNomesClienteNovo(validarCliente(entrada));
  if (antes?.unificadoEmId) throw new ErroCadastroVenda("Este cadastro foi unificado. Abra o cadastro da empresa para editar.");
  if (cliente.id && !antes) throw new ErroCadastroVenda("Cadastro não encontrado.");
  if (antes && antes.versao !== cliente.versao) throw new ErroCadastroVenda("Este cadastro foi alterado em outra tela. Reabra para conferir antes de salvar.");
  if (antes) cliente = validarCliente(preservarNomesNaMudancaTipo({ ...antes, tipo: antes.tipo === "PJ" ? "PJ" : "PF" }, cliente));
  return cliente;
}

/** Consulta CNPJ fora da transação. Não aceita prova ou endereço oficial enviados pelo navegador. */
export async function prepararClienteParaSalvar(entrada: unknown): Promise<ClientePreparado> {
  const inicial = validarCliente(entrada);
  const antes = inicial.id ? await prisma.clienteVenda.findUnique({ where: { id: inicial.id } }) : null;
  let cliente = normalizarClienteParaSalvar(entrada, antes);
  const alteradas = cobrancasAlteradas(cliente, antes);
  const consultas = new Map<string, Awaited<ReturnType<typeof consultarCnpjVenda>>>();
  const enderecos = [...cliente.enderecos];
  for (const [indice, endereco] of cobrancasDoCliente(cliente).entries()) {
    if (!alteradas[indice]) continue;
    const documento = endereco.documento ?? "";
    let resultado = consultas.get(documento);
    if (!resultado) {
      resultado = await consultarCnpjVenda(documento);
      consultas.set(documento, resultado);
    }
    if (!resultado.cadastro) throw new ErroCadastroVenda(resultado.erro || "Não foi possível conferir o endereço do CNPJ. Tente novamente antes de salvar.");
    const pendencia = pendenciaEnderecoPostal(resultado.cadastro.endereco);
    if (pendencia) throw new ErroCadastroVenda(`O cadastro oficial do CNPJ não possui endereço completo. ${pendencia}`);
    enderecos[indice] = { ...endereco, ...resultado.cadastro.endereco, razaoSocial: resultado.cadastro.razaoSocial };
    if (indice === 0) cliente = { ...cliente, razaoSocial: resultado.cadastro.razaoSocial };
  }
  cliente = normalizarClienteParaSalvar({ ...cliente, enderecos }, antes);
  // O parser histórico aceita país ausente. A escrita nova deve recebê-lo ou comprová-lo no CNPJ.
  const informado = entrada as ClienteEntrada;
  for (const [indice, endereco] of informado.enderecos.entries()) {
    if (!alteradas[indice] && camposEnderecoObrigatorios(endereco).includes("País")) throw new ErroCadastroVenda("Cobrança: preencha o campo obrigatório País.");
  }
  if (informado.entregaPadrao) {
    const entregas = informado.entregaPadrao.enderecos ?? [informado.entregaPadrao];
    if (entregas.some(e => camposEnderecoObrigatorios(e.endereco).includes("País"))) throw new ErroCadastroVenda("Entrega: preencha o campo obrigatório País.");
  }
  validarLivroEnderecosClienteCompleto(cliente);
  const comprovacao = {};
  comprovacoes.set(comprovacao, { id: cliente.id, versao: cliente.versao, assinatura: assinatura(cliente) });
  return { entrada: cliente, comprovacao };
}

/** Revalida a prova sob a trava e a versão do cliente, sem fazer rede nesta fase. */
export function conferirPreparacaoCliente(cliente: ClienteEntrada, antes: ClienteVenda | null, comprovacao?: object): void {
  validarLivroEnderecosClienteCompleto(cliente);
  const prova = comprovacao && comprovacoes.get(comprovacao);
  if (prova && prova.id === cliente.id && prova.versao === cliente.versao && prova.assinatura === assinatura(cliente)) return;
  if (cobrancasAlteradas(cliente, antes).some(Boolean)) throw new ErroCadastroVenda("Confira o endereço do CNPJ antes de salvar o cadastro.");
}
