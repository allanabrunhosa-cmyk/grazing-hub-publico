import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ClientesVenda } from "@/app/(protegido)/vendas/clientes/clientes-client";
import { CamposClienteVenda, novoClienteVenda } from "@/app/(protegido)/vendas/clientes/campos-cliente";
import type { ClienteConsulta } from "@/app/(protegido)/vendas/clientes/tipos";
import { CobrancaClientePedido } from "@/app/(protegido)/vendas/pedidos/cadastro-cliente-form";
import type { EnderecoPedidoForm } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";
import "@/app/globals.css";

if (new URLSearchParams(window.location.search).get("tema") === "escuro") document.documentElement.classList.add("dark");

const clientes: ClienteConsulta[] = [
  { id: "pessoa", versao: 1, nome: "Pessoa fictícia", tipo: "PF", documento: null, email: null, telefone: null, contato: null, observacoes: "Cadastro para conferência visual, sem dados reais.", ativo: true, enderecos: [{ nome: "Endereço fictício", destinatario: "Pessoa fictícia", cep: "00000-000", logradouro: "Rua de exemplo", numero: "10", complemento: "", bairro: "Bairro fictício", cidade: "Cidade fictícia", uf: "SP" }], resumoPedidos: { ultimoPedido: "2026-10-01T13:00:00Z", quantidadePedidos: 8, valorTotalGasto: "2400.50" }, regrasPagamento: { formasPagamentoIds: ["pix", "boleto"], boletoDiasAposEntrega: 7, limiteCreditoAberto: "500.00" } },
  { id: "empresa", versao: 1, nome: "Empresa fictícia com nome extenso para conferência da listagem", tipo: "PJ", documento: null, email: null, telefone: null, contato: "Contato fictício", observacoes: null, ativo: true, enderecos: [], contatosEmpresa: [{ id: "contato-1", nome: "Maria da Silva Sintética", primeiroNome: "Maria", sobrenome: "da Silva Sintética", email: "contato@example.invalid", telefone: "+5511900001234" }, { id: "contato-2", nome: "Nome Composto do Contato Sintético", primeiroNome: "Nome Composto", sobrenome: "do Contato Sintético", email: null, telefone: null }], resumoPedidos: { ultimoPedido: null, quantidadePedidos: 0, valorTotalGasto: "0.00" } },
  { id: "inativo", versao: 1, nome: "Cliente inativo fictício", tipo: "PF", documento: null, email: null, telefone: null, contato: null, observacoes: null, ativo: false, enderecos: [], resumoPedidos: { ultimoPedido: null, quantidadePedidos: 0, valorTotalGasto: "0.00" } },
];
clientes[0] = { ...clientes[0], email: "pessoa@example.invalid", telefone: "+5511900001234", enderecos: [
  { ...clientes[0].enderecos[0], nome: "Principal", pais: "Brasil", tipo: "PF", nomeCompleto: "Pessoa fictícia", documento: "" },
  { ...clientes[0].enderecos[0], nome: "Cobrança 2", pais: "Brasil", numero: "20", complemento: "Sala sintética 2", tipo: "PJ", documento: "11222333000181", razaoSocial: "Empresa Alternativa Sintética Ltda", inscricaoEstadual: "Isento", inscricaoMunicipal: "12345" },
] };
if (new URLSearchParams(location.search).has("cadastros-mascarados")) {
  clientes[0].documento = "12345678909";
  clientes[0].enderecos[1].telefone = "+5511999992222";
  clientes[0].enderecos.push({ ...clientes[0].enderecos[0], nome: "Cobrança 3", numero: "30", tipo: "PF", nomeCompleto: "Titular Adicional Sintética", documento: "11111111266", telefone: "+5511988883333" });
}
const quantidadeEntregas = new URLSearchParams(window.location.search).get("entregas") === "250" ? 250 : 2;
const entregasFicticias = Array.from({ length: quantidadeEntregas }, (_, indice) => ({ destinatario: { nome: `Destinatária sintética ${indice + 1}`, contato: "" }, endereco: { pais: "Brasil", cep: "00000-000", logradouro: `Rua sintética com nome extenso ${indice + 1}`, numero: String(indice + 1), complemento: "Sala de exemplo", bairro: "Bairro fictício", cidade: "Cidade fictícia", uf: "SP" } }));
clientes[0].entregaPadrao = { ...entregasFicticias[0], enderecos: entregasFicticias, selecionado: 0 };
if (new URLSearchParams(window.location.search).has("parcial")) {
  const parcial = { destinatario: { nome: "Destinatária parcial sintética", contato: "" }, endereco: { pais: "Brasil", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" }, textoOriginal: "Rua sintética sem número\nReferência incompleta preservada da origem." };
  clientes[0].entregaPadrao = { ...parcial, enderecos: [parcial, entregasFicticias[1]], selecionado: 0 };
}
if (new URLSearchParams(window.location.search).has("pendente")) clientes[0].enderecos.push({ ...clientes[0].enderecos[0], tipo: "PJ", documento: "", razaoSocial: "", titularPendente: true });
const fetchOriginal = window.fetch.bind(window);
window.fetch = (input, init) => String(input).startsWith("https://viacep.com.br/") ? Promise.resolve(new Response(JSON.stringify({ cep: "00000-000", logradouro: "Rua fictícia", bairro: "Bairro fictício", localidade: "Cidade fictícia", uf: "SP" }), { status: 200, headers: { "Content-Type": "application/json" } })) : fetchOriginal(input, init);
function ProjecaoCobrancaFixture() {
  const postal = { pais: "Brasil", cep: "01001000", logradouro: "Avenida de Demonstração", numero: "1000", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
  const [enderecos] = useState<EnderecoPedidoForm[]>([
    { ...postal, tipo: "PJ", documento: "11444777000161", razaoSocial: "Empresa Principal Sintética Ltda" },
    { ...postal, numero: "2000", tipo: "PF", documento: "11111111266", nomeCompleto: "Pessoa de Outro Endereço Sintético" },
    { ...postal, cep: "01001-000", logradouro: "AV. DE DEMONSTRACAO", tipo: "PJ", documento: "11222333000181", razaoSocial: "Empresa Histórica Selecionada Sintética Ltda" },
    { ...postal, complemento: "Sala 3", tipo: "PF", documento: "", nomeCompleto: "Pessoa de Outra Sala Sintética" },
  ]);
  const [selecionado, setSelecionado] = useState(2);
  return <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-8"><p className="text-xs text-muted-foreground">Prévia isolada · cobrança fotografada sintética · nenhuma gravação</p><CobrancaClientePedido enderecos={enderecos} selecionado={selecionado} alterar={(lista, indice) => { if (lista !== enderecos) throw new Error("A projeção não pode alterar a lista fotografada."); setSelecionado(indice); }} somenteLeitura /><output aria-label="Índice original selecionado">Índice original selecionado: {selecionado}</output></main>;
}
createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).has("projecao-cobranca") ? <ProjecaoCobrancaFixture /> : <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-8"><p className="text-xs text-muted-foreground">Prévia isolada · dados e ações fictícios</p>{new URLSearchParams(location.search).has("leitura") ? <CamposClienteVenda cliente={{ ...novoClienteVenda(), ...clientes[0], tipoEscolhido: true }} onChange={() => { throw new Error("A prévia de leitura não pode alterar o cadastro."); }} somenteLeitura /> : <ClientesVenda clientes={clientes} adicionar editar verPedidos formasPagamento={[{ id: "pix", nome: "Pix", tipo: "PIX", ativo: true }, { id: "boleto", nome: "Boleto", tipo: "BOLETO", ativo: true }]} creditos={{ pessoa: { saldo: 35, movimentos: [] } }} />}</main>);
