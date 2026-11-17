import { CATALOGO, type SecaoCatalogo } from "./catalogo";
import { SECOES_ATENDIMENTO } from "./atendimento";

/**
 * Organização visual da matriz: módulo → seção → tema.
 * É somente apresentação: não cria recursos, não muda chaves e não concede acesso por herança.
 * `nome` e `descricao` substituem o texto do catálogo apenas na matriz; `termos` alimenta a busca.
 */
type Tema = { id: string; nome?: string; descricao?: string; termos?: string };
type Secao = { id: string; nome: string; temas: readonly Tema[] };
type Modulo = { id: string; nome: string; secoes: readonly Secao[] };

const so = "Editar libera a operação; Visualizar sozinho não permite executá-la.";

export const ORGANIZACAO_PERMISSOES: readonly Modulo[] = [
  { id: "suprimentos", nome: "Suprimentos", secoes: [
    { id: "fornecedores", nome: "Fornecedores", temas: [
      { id: "fornecedores", descricao: "Cadastro de fornecedores e beneficiários." },
    ] },
    { id: "insumos", nome: "Insumos e porções", temas: [
      { id: "insumos", descricao: "Cadastro de insumos, preparações e conversões de unidade." },
      { id: "suprimentos.porcoes", descricao: "A consulta também fica disponível para quem visualiza Insumos ou Produtos." },
    ] },
    { id: "compras", nome: "Compras", temas: [
      { id: "compras", descricao: "Criar, alterar e excluir pedidos de compra." },
      { id: "compras.receber", nome: "Receber pedidos", descricao: `Dar entrada das mercadorias de um pedido. ${so}` },
      { id: "compras.reabrir", nome: "Reabrir recebimentos", descricao: `Desfazer um recebimento já registrado. ${so}` },
      { id: "compras.cancelar", nome: "Cancelar pedidos", descricao: `Cancelar um pedido de compra. ${so}` },
    ] },
    { id: "notas", nome: "Notas fiscais de compra (NF-e)", temas: [
      { id: "notas", descricao: "Visualizar abre o Manifesto de Notas. Adicionar busca notas novas na SEFAZ. Importar por chave ou por XML exige Adicionar e Editar. Para baixar o XML de uma nota recebida, habilite também Financeiro › Fiscal › Visão geral das notas.", termos: "baixar download xml nota fiscal nfe danfe sefaz importar contabilidade" },
      { id: "notas.manifestar", descricao: `Manifestar, aceitar, editar e conciliar a nota com fornecedor, pedido e estoque. Exige também Visualizar em Manifesto de notas. ${so}`, termos: "ciência confirmação aceitar nota fiscal" },
    ] },
    { id: "estoque", nome: "Estoque", temas: [
      { id: "inventario", descricao: "Inventário, locais de armazenamento e movimentações de estoque." },
      { id: "inventario.entrada", descricao: "Entrada avulsa de insumo, sem pedido de compra." },
      { id: "inventario.contagem", nome: "Contagem de estoque" },
    ] },
    { id: "perdas", nome: "Perdas", temas: [
      { id: "inventario.perdas", nome: "Registro de perdas" },
      { id: "inventario.perdas.categorias" },
    ] },
  ] },
  { id: "financeiro", nome: "Financeiro", secoes: [
    { id: "dre", nome: "DRE", temas: [
      { id: "financeiro.dre", nome: "Consultar a DRE", termos: "resultado demonstrativo" },
    ] },
    { id: "fluxo", nome: "Fluxo de caixa", temas: [
      { id: "financeiro.fluxo", nome: "Consultar o fluxo de caixa" },
      { id: "financeiro.saldo", descricao: `Corrigir o saldo inicial das contas. ${so}` },
    ] },
    { id: "movimentacoes", nome: "Movimentações", temas: [
      { id: "financeiro.movimentacoes", nome: "Lançamentos", descricao: "Consultar, criar, alterar e excluir movimentações e lançamentos.", termos: "contas a pagar receber despesa receita" },
      { id: "financeiro.baixas", nome: "Pagamentos e recebimentos", descricao: `Registrar a baixa (pagamento ou recebimento) de uma conta. ${so}`, termos: "baixa pagar receber quitar" },
      { id: "financeiro.estornos", nome: "Reverter baixas", descricao: `Estornar um pagamento ou recebimento já registrado. ${so}`, termos: "estorno desfazer" },
      { id: "financeiro.conciliacao", nome: "Conciliação bancária", descricao: "Importar extrato, conciliar e desfazer conciliações.", termos: "extrato ofx banco" },
    ] },
    { id: "nfse", nome: "Manifesto de NFS-e", temas: [
      { id: "financeiro.nfse", nome: "Notas de serviço (NFS-e)", descricao: "Visualizar consulta as notas de serviço e permite baixar ou exportar seus XMLs. Adicionar busca e importa notas. Editar altera a situação e corrige o lançamento da nota (exige também Lançamentos em Movimentações).", termos: "baixar download exportar xml nota fiscal de serviço nfs nfse contabilidade" },
    ] },
    { id: "bancario", nome: "Contas e cartões", temas: [
      { id: "financeiro.bancario", nome: "Contas bancárias e cartões", descricao: "Cadastro das contas e dos cartões da empresa." },
      { id: "financeiro.faturas", nome: "Faturas de cartão", descricao: "Importar, classificar e cancelar faturas; consultar os arquivos importados." },
      { id: "financeiro.cartoes-pagamentos", nome: "Pagamento de faturas", descricao: "Conciliar o pagamento da fatura e desfazer a conciliação." },
      { id: "financeiro.cartoes-regras", nome: "Regras de classificação das faturas" },
    ] },
    { id: "plano", nome: "Plano de contas e custos", temas: [
      { id: "financeiro.plano" },
      { id: "financeiro.custos", descricao: "Mostra custos e margens nas telas que os exibem." },
    ] },
    { id: "fiscal", nome: "Fiscal", temas: [
      { id: "financeiro.fiscal.painel", nome: "Visão geral das notas", descricao: "Abre o painel fiscal, com as notas emitidas e recebidas. Para consultar e baixar cada tipo de nota, habilite também: notas de compra — Suprimentos › Notas fiscais de compra › Manifesto de notas; notas de serviço — Manifesto de NFS-e; notas emitidas — Grupos e vínculos fiscais e Vendas › Gestor de pedidos.", termos: "baixar download xml pdf danfe nota fiscal nfe contabilidade" },
      { id: "vendas.fiscal", nome: "Grupos e vínculos fiscais", descricao: "Grupos fiscais, vínculos dos produtos e dados fiscais da empresa. Visualizar também permite consultar e baixar as notas emitidas (XML e DANFE), junto com o Gestor de pedidos.", termos: "baixar download xml pdf danfe nota fiscal de saída emitida nfe nfce tributação ncm" },
    ] },
  ] },
  { id: "producao", nome: "Produção", secoes: [
    { id: "etiquetas", nome: "Validades e etiquetas", temas: [
      { id: "producao", nome: "Consultar validades e preparar etiquetas" },
      { id: "producao.imprimir", nome: "Imprimir e conferir etiquetas", descricao: "Imprimir, reimprimir e conferir etiquetas.", termos: "impressora reimpressão" },
    ] },
    { id: "prazos", nome: "Prazos de validade", temas: [
      { id: "producao.validades", nome: "Configurar prazos dos produtos" },
    ] },
  ] },
  { id: "vendas", nome: "Vendas", secoes: [
    { id: "dashboard", nome: "Dashboard", temas: [
      { id: "vendas.bi", nome: "Consultar o Dashboard", termos: "indicadores bi relatório" },
      { id: "vendas.bi.exportar", nome: "Exportar consultas", termos: "baixar download planilha csv excel" },
      { id: "vendas.bi.contatos", nome: "Identificar compradores" },
      { id: "vendas.bi.custos", nome: "Consultar custos" },
      { id: "vendas", nome: "Visão geral de Vendas", descricao: "Página inicial do módulo Vendas." },
    ] },
    { id: "clientes", nome: "Cadastro de clientes", temas: [
      { id: "vendas.clientes" },
    ] },
    { id: "cardapio", nome: "Cardápio e catálogo", temas: [
      { id: "vendas.produtos", descricao: "Produtos, composição, preços e canais de venda." },
      { id: "vendas.catalogo", nome: "Categorias e complementos" },
      { id: "vendas.importacao", nome: "Importação assistida" },
    ] },
    { id: "pagamento-entrega", nome: "Pagamentos e entregas", temas: [
      { id: "vendas.formas-pagamento" },
      { id: "vendas.horarios" },
      { id: "vendas.area-entrega", nome: "Área de entrega e simulador" },
    ] },
    { id: "pedidos", nome: "Gestor de pedidos", temas: [
      { id: "vendas.pedidos", nome: "Consultar pedidos e criar orçamentos", descricao: "Visualizar abre o Gestor de pedidos. Adicionar cria e edita orçamentos." },
      { id: "vendas.pedidos.confirmar", nome: "Confirmar pedidos", descricao: so },
      { id: "vendas.pedidos.producao", nome: "Equipe de produção", descricao: "Tela de produção dos pedidos. Editar permite operar o pedido." },
      { id: "vendas.pedidos.revisar", nome: "Revisar e registrar entrega", descricao: "Editar permite revisar o pedido, operá-lo e registrar a entrega." },
      { id: "vendas.pedidos.logistica", nome: "Registrar custos de entrega", descricao: so },
    ] },
    { id: "pedidos-excecoes", nome: "Pedidos: preços e exceções", temas: [
      { id: "vendas.pedidos.desconto", nome: "Conceder desconto", descricao: so },
      { id: "vendas.pedidos.preco", nome: "Alterar preço manualmente", descricao: so },
      { id: "vendas.pedidos.frete", nome: "Ajustar frete manualmente", descricao: so },
      { id: "vendas.pedidos.cobertura", nome: "Aprovar cobertura excepcional", descricao: so },
      { id: "vendas.pedidos.cancelar", nome: "Cancelar pedidos", descricao: so },
    ] },
  ] },
  { id: "atendimento", nome: "Atendimento", secoes: SECOES_ATENDIMENTO.map(secao => ({ id: secao.id, nome: secao.nome, temas: secao.recursos.map(id => ({ id })) })) },
  { id: "rh", nome: "RH", secoes: [
    { id: "rh", nome: "Acesso ao RH", temas: [{ id: "rh" }] },
  ] },
  { id: "patrimonio", nome: "Patrimônio", secoes: [
    { id: "patrimonio", nome: "Acesso ao Patrimônio", temas: [{ id: "patrimonio" }] },
  ] },
  { id: "configuracoes", nome: "Configurações", secoes: [
    { id: "usuarios", nome: "Usuários e acessos", temas: [
      { id: "configuracoes.usuarios", nome: "Usuários e perfis de acesso", descricao: "Cadastro de usuários, perfis e permissões." },
      { id: "configuracoes.usuarios.atividades", nome: "Consultar atividades dos usuários" },
    ] },
    { id: "empresa", nome: "Empresa", temas: [
      { id: "configuracoes.loja", termos: "cnpj certificado digital a1" },
    ] },
    { id: "integracoes", nome: "Integrações", temas: [
      { id: "configuracoes.brasilnfe", nome: "Emissor fiscal Brasil NFe", descricao: "Configuração e diagnóstico do emissor de notas." },
      { id: "configuracoes.mcp", nome: "Administrar MCP" },
    ] },
  ] },
];

export type TemaMatriz = SecaoCatalogo & { busca: string };
export type SecaoMatriz = { id: string; chave: string; nome: string; temas: TemaMatriz[] };
export type ModuloMatriz = { id: string; nome: string; secoes: SecaoMatriz[] };

/** Texto comparável: minúsculas e sem acentos. */
export function normalizarBusca(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const moduloDoRecurso = (id: string) => id === "crm" || id.startsWith("crm.atendimento.") ? "atendimento" : CATALOGO.find(m => m.secoes.some(s => s.id === id))?.id;

/** Matriz resolvida contra o catálogo. Recurso sem lugar definido cai em “Outras permissões” do seu módulo. */
export const MODULOS_MATRIZ: ModuloMatriz[] = (() => {
  const recursos = new Map(CATALOGO.flatMap(m => m.secoes).filter(s => !s.administradorApenas).map(s => [s.id, s]));
  const usados = new Set<string>();
  const modulos: ModuloMatriz[] = ORGANIZACAO_PERMISSOES.map(modulo => ({ id: modulo.id, nome: modulo.nome, secoes: modulo.secoes.map(secao => ({
    id: secao.id, chave: `${modulo.id}/${secao.id}`, nome: secao.nome,
    temas: secao.temas.flatMap(tema => {
      const recurso = recursos.get(tema.id);
      if (!recurso || usados.has(tema.id)) return [];
      usados.add(tema.id);
      const nomeMatriz = tema.nome ?? recurso.nomeMatriz ?? recurso.nome, descricao = tema.descricao ?? recurso.descricao;
      return [{ ...recurso, nomeMatriz, descricao, busca: normalizarBusca([modulo.nome, secao.nome, nomeMatriz, recurso.nome, descricao, tema.termos].filter(Boolean).join(" ")) }];
    }),
  })).filter(secao => secao.temas.length) }));
  for (const recurso of recursos.values()) {
    if (usados.has(recurso.id)) continue;
    const id = moduloDoRecurso(recurso.id) ?? "outros";
    let modulo = modulos.find(m => m.id === id);
    if (!modulo) modulos.push(modulo = { id, nome: CATALOGO.find(m => m.id === id)?.nome ?? "Outros", secoes: [] });
    let secao = modulo.secoes.find(s => s.id === "outras");
    if (!secao) modulo.secoes.push(secao = { id: "outras", chave: `${id}/outras`, nome: `Outras permissões de ${modulo.nome}`, temas: [] });
    secao.temas.push({ ...recurso, busca: normalizarBusca([modulo.nome, recurso.nomeMatriz, recurso.nome, recurso.descricao].filter(Boolean).join(" ")) });
  }
  return modulos.filter(m => m.secoes.length);
})();

/** Filtra por todas as palavras digitadas, em qualquer ordem. Busca vazia devolve a matriz inteira. */
export function filtrarMatriz(busca: string, modulos: ModuloMatriz[] = MODULOS_MATRIZ): ModuloMatriz[] {
  const palavras = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (!palavras.length) return modulos;
  return modulos.map(modulo => ({ ...modulo, secoes: modulo.secoes.map(secao => ({ ...secao, temas: secao.temas.filter(tema => palavras.every(p => tema.busca.includes(p))) })).filter(secao => secao.temas.length) })).filter(modulo => modulo.secoes.length);
}
