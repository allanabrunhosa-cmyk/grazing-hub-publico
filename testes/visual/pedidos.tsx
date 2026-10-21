import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { EditorPedido } from "@/app/(protegido)/vendas/pedidos/editor-pedido";
import { ModalNovoPedido } from "@/app/(protegido)/vendas/pedidos/@modal/(.)novo/modal-novo-pedido";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import "@/app/globals.css";

const produto: DadosProdutos["produtos"][number] = { tipoEmbalagemId: "caixa-media-ficticia", slotsEntrega: 2,
  id: "produto-ficticio", versao: 1, nome: "Caixa Grazing fictícia", especificacao: null, descricao: null, tipo: "PADRAO", classificacao: "PRINCIPAL", classificacoes: ["PRINCIPAL"],
  tempoPreparoMinutos: null, codigo: "SINT-1", unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, ativo: true, fiscalRevisado: false, fiscal: {}, grupoFiscalId: null,
  categorias: [], grupos: [{ grupoId: "grupo-ficticio", usarPadrao: true, minimo: 1, maximo: 1, opcoesExcluidas: [] }, { grupoId: "extras-ficticios", usarPadrao: false, minimo: 0, maximo: 2, opcoesExcluidas: [] }],
  preco: "100", componentes: [],
};
const catalogo = { tiposEmbalagem: [], canais: ["SITE", "iFood", "Giuliana Flores"], categorias: [], categoriasGrupos: [], gruposFiscais: [], insumos: [], produtos: [produto], grupos: [{ id: "grupo-ficticio", versao: 1, nome: "Tamanho", tipo: "COMPOSICAO", categoriaId: null, minimo: 1, maximo: 1, repetir: false, ativo: true, produtos: [produto.id], opcoes: [{ id: "opcao-ficticia", grupoId: "grupo-ficticio", nome: "Caixa média", preco: "120", quantidade: "1", produtoId: null, ordem: 0, ativo: true }] }] } as DadosProdutos;
catalogo.produtos.push({ ...produto, id: "queijo-ficticio", nome: "Queijo fictício", unidade: "KG", classificacao: "COMPLEMENTO", classificacoes: ["COMPLEMENTO"], grupos: [], preco: "50" });
catalogo.grupos[0].opcoes.push({ ...catalogo.grupos[0].opcoes[0], id: "opcao-pequena-ficticia", nome: "Caixa pequena", preco: "100", ordem: 1 });
catalogo.grupos.push({ id: "extras-ficticios", versao: 1, nome: "Porções adicionais", tipo: "COMPLEMENTAR", categoriaId: null, minimo: 1, maximo: 2, repetir: false, ativo: true, produtos: [produto.id], opcoes: [
  { id: "porcao-ficticia", grupoId: "extras-ficticios", nome: "Porção de queijo fictícia", preco: "7.25", quantidade: "0.3", produtoId: "queijo-ficticio", ordem: 0, ativo: true },
  { id: "sem-produto-ficticio", grupoId: "extras-ficticios", nome: "Opção sem produto vinculado", preco: "5", quantidade: "1", produtoId: null, ordem: 1, ativo: true },
] });
const livroEntregasFicticio = [
  { destinatario: { nome: "Primeira destinatária sintética", contato: "" }, endereco: { pais: "Brasil", cep: "00000000", logradouro: "Rua sintética da primeira entrega", numero: "11", complemento: "Casa sintética", bairro: "Bairro fictício", cidade: "Cidade fictícia", uf: "SP" } },
  { destinatario: { nome: "Segunda destinatária sintética", contato: "" }, endereco: { pais: "Brasil", cep: "00000000", logradouro: "Avenida sintética da segunda entrega", numero: "22", complemento: "Sala sintética", bairro: "Bairro fictício", cidade: "Cidade fictícia", uf: "SP" } },
];
const dados = { catalogo, clientes: [{ id: "cliente-ficticio", versao: 1, nome: "Cliente Fictício", primeiroNome: "Cliente", sobrenome: "Fictício", tipo: "PF", documento: null, telefone: "+5511999990000", razaoSocial: null, inscricaoEstadual: null, email: "cliente@example.invalid", ...(new URLSearchParams(location.search).has("livro-entregas") ? { entregaPadrao: { ...livroEntregasFicticio[0], enderecos: livroEntregasFicticio, selecionado: 0 } } : {}), dataNascimento: "2000-01-01", contato: null, nomeContato: null, sobrenomeContato: null, enderecos: [{ nome: "Cobrança", pais: "Brasil", destinatario: "Destinatária Fictícia", cep: "00000000", logradouro: "Rua Exemplo", numero: "1", complemento: "Casa", bairro: "Centro", cidade: "São Paulo", uf: "SP" }] }], canais: [{ id: "site-ficticio", nome: "SITE" }, { id: "ifood-ficticio", nome: "iFood" }, { id: "gf-ficticio", nome: "Giuliana Flores" }], formas: [{ id: "pix-ficticio", nome: "Pix fictício", tipo: "PIX", permiteParcelamento: false, maximoParcelas: 1 }, { id: "boleto-ficticio", nome: "Boleto fictício", tipo: "BOLETO", permiteParcelamento: true, maximoParcelas: 4 }, { id: "credito-ficticio", nome: "Crédito fictício", tipo: "CARTAO_CREDITO", permiteParcelamento: true, maximoParcelas: 4 }], categorias: [{ id: "receita-ficticia", nome: "Receita sintética" }], contas: [{ id: "conta-ficticia", nome: "Conta sintética" }], categoriasTaxa: [], categoriasDevolucao: [], creditos: {} as Record<string, number> };
if (new URLSearchParams(location.search).has("cadastros-mascarados")) {
  const principal = dados.clientes[0].enderecos[0];
  Object.assign(dados, { dataCompraPadrao: "2026-10-20" });
  Object.assign(dados.clientes[0], { documento: "12345678909", enderecos: [
    { ...principal, tipo: "PF", nomeCompleto: "Cliente Fictício", documento: "12345678909" },
    { ...principal, nome: "Cobrança 2", numero: "20", tipo: "PJ", documento: "11222333000181", razaoSocial: "Empresa Alternativa Sintética Ltda", telefone: "+5511999992222" },
    { ...principal, nome: "Cobrança 3", numero: "30", tipo: "PF", documento: "11111111266", nomeCompleto: "Titular Adicional Sintética", telefone: "+5511988883333" },
  ] });
}
document.body.dataset.identidade = "pedidos";
const entregasFicticias = {
  existente: true, ativo: true, pendencias: [], configuracaoHref: "/configuracoes/entregas",
  veiculo: "MOTO" as const, veiculoPadraoId: "moto-ficticia",
  veiculos: [
    { id: "moto-ficticia", nome: "Moto fictícia", perfil: "MOTO" as const, ativo: true },
    { id: "carro-ficticio", nome: "Carro fictício", perfil: "CARRO" as const, ativo: true },
  ],
  regrasVeiculo: [{ id: "regra-caixa-ficticia", tipoEmbalagemId: "caixa-media-ficticia", slotsEntrega: 2, veiculoId: "carro-ficticio", prioridade: 2, ativo: true }],
};
const freteMinimo = new URLSearchParams(location.search).has("frete-minimo");
const enderecoFicticio = { pais: "Brasil", cep: "00000000", logradouro: "Rua Exemplo", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const rascunhoFrete = {
  id: "rascunho-frete-ficticio", numero: 0, versao: 1, status: "RASCUNHO", modoFinanceiro: "EXTERNO",
  itens: [], historico: [], historicoFinanceiro: [],
  rascunho: {
    clienteId: freteMinimo ? null : "cliente-ficticio", canalId: freteMinimo ? null : "site-ficticio", atendimento: "ENTREGA", prazo: "IMEDIATO",
    previsaoData: null, previsaoJanela: null,
    destinatario: freteMinimo ? null : { nome: "Destinatária Fictícia", primeiroNome: "Destinatária", sobrenome: "Fictícia", contato: "11999990000" },
    endereco: enderecoFicticio, cobranca: enderecoFicticio, observacoes: "", desconto: "0.00", frete: "0.00", outrosCustos: "0.00",
    itens: [{ produtoId: produto.id, quantidade: "1", observacoes: "", escolhas: freteMinimo ? {} : { "opcao-ficticia": 1 }, precoManual: null }],
  },
};
function PreviaPedido() {
  const [aberto, setAberto] = useState(true);
  useEffect(() => { const fechar = () => setAberto(false); window.addEventListener("gestor-consulta-simulada", fechar); return () => window.removeEventListener("gestor-consulta-simulada", fechar); }, []);
  return <ThemeProvider attribute="class" defaultTheme={new URLSearchParams(location.search).has("escuro") ? "dark" : "light"}><div className="mx-auto max-w-5xl p-6"><button onClick={() => setAberto(true)}>Abrir Novo Pedido fictício</button>{aberto && <ModalNovoPedido><EditorPedido emDialogo pedido={new URLSearchParams(location.search).has("frete") ? rascunhoFrete : undefined} dados={{ ...dados, horarios: null, entregas: entregasFicticias, permissoesEntrega: { manual: true, cobertura: true, logistica: false } }} capacidades={{ rascunho: true, confirmar: true, revisar: true, desconto: true, preco: true, cancelar: true, receber: true, condicao: true, criarCliente: true, editarCliente: true }} /></ModalNovoPedido>}</div></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<PreviaPedido />);
