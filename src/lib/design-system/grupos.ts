import type { ChaveTokenDesign } from "./registro";

export const GRUPOS_DESIGN = [
  { id: "fundamentos", nome: "Fundamentos", descricao: "Cores, tipografia, estrutura, superfícies e acessibilidade." },
  { id: "componentes", nome: "Componentes", descricao: "Controles reutilizáveis e seus estados de interação." },
  { id: "gestao", nome: "Gestão", descricao: "Referência de fábrica, adoção e publicação controlada." },
] as const;

export type GrupoDesign = typeof GRUPOS_DESIGN[number]["id"];

export function grupoDesignValido(valor: string): valor is GrupoDesign {
  return GRUPOS_DESIGN.some(grupo => grupo.id === valor);
}

export type EvidenciaDesign = {
  rotulo: string;
  valor: string;
  origem: string;
  uso: string;
};

export type PadraoDesign = {
  id: string;
  nome: string;
  grupo: GrupoDesign;
  resumo: string;
  termos: string[];
  estado: "referencia" | "pendente";
  evidencia: "observado" | "verificado" | "testado" | "pendente";
  fonte: string;
  escopo: string;
  diferencas: string;
  riscos: string;
  valores: EvidenciaDesign[];
  chavesEditaveis?: readonly ChaveTokenDesign[];
};

/**
 * Referência técnica concisa da interface existente. Os valores observados não
 * são um segundo catálogo: apontam para a fonte de verdade do produto.
 */
const REFERENCIAS_DESIGN: PadraoDesign[] = [
  {
    id: "cores-temas", nome: "Cores e temas", grupo: "fundamentos",
    resumo: "Paletas do HUB azul e Validades laranja, separadas por modo claro e escuro.",
    termos: ["azul", "laranja", "dark", "claro", "marca", "primaria", "primária"], estado: "referencia", evidencia: "observado",
    fonte: "src/app/globals.css (:root, .dark e [data-identidade=\"etiquetas\"])",
    escopo: "Variáveis CSS compartilhadas por componentes, lateral e cabeçalho.",
    diferencas: "HUB usa azul; Validades usa laranja. Estrutura e escalas permanecem compartilhadas.",
    riscos: "Cores de status fiscais e financeiros continuam locais por semântica de domínio.",
    valores: [
      { rotulo: "HUB · fundo claro", valor: "#f2f4f8", origem: "globals.css", uso: "Superfície principal" },
      { rotulo: "HUB · ação clara", valor: "#0865d5", origem: "--ds-hub-primaria-clara", uso: "Botões e foco" },
      { rotulo: "HUB · ação escura", valor: "#83b7ff", origem: "--ds-hub-primaria-escura", uso: "Botões e foco" },
      { rotulo: "Validades · ação clara", valor: "#b9430c", origem: "--ds-etiquetas-primaria-clara", uso: "Botões e foco" },
      { rotulo: "Validades · ação escura", valor: "#ffab78", origem: "--ds-etiquetas-primaria-escura", uso: "Botões e foco" },
    ],
    chavesEditaveis: ["cor.hub.primariaClara", "cor.hub.primariaEscura", "cor.etiquetas.primariaClara", "cor.etiquetas.primariaEscura"],
  },
  {
    id: "tipografia", nome: "Tipografia", grupo: "fundamentos",
    resumo: "Família de interface, pesos, tamanhos e entrelinhas da referência atual.",
    termos: ["fonte", "texto", "titulo", "título", "peso", "linha", "familia", "família"], estado: "referencia", evidencia: "observado",
    fonte: "src/app/globals.css (@theme inline)",
    escopo: "Fonte sans compartilhada; títulos usam a mesma família via --font-heading.",
    diferencas: "As marcas compartilham tipografia. A identidade muda apenas em cores.",
    riscos: "Tabelas e chips têm escalas locais para densidade; impressão usa fonte própria e não é alterada.",
    valores: [
      { rotulo: "Família sans", valor: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", origem: "--ds-fonte-sans", uso: "Interface" },
      { rotulo: "Display", valor: "clamp(1.6rem, 2.3vw, 2rem) / 1.2 / 600", origem: "@theme", uso: "Títulos de página" },
      { rotulo: "Título", valor: "1.125rem / 1.5rem / 600", origem: "@theme", uso: "Títulos de bloco" },
      { rotulo: "Rótulo", valor: "0.75rem / 1rem / 500", origem: "@theme", uso: "Labels e microtexto" },
    ],
    chavesEditaveis: ["tipografia.familia"],
  },
  {
    id: "estrutura", nome: "Estrutura e responsividade", grupo: "fundamentos",
    resumo: "Lateral expandida ou recolhida, marca no cabeçalho e controle no rodapé, reflow e menu móvel sobreposto.",
    termos: ["layout", "menu", "sidebar", "mobile", "largura", "responsivo"], estado: "referencia", evidencia: "observado",
    fonte: "src/app/globals.css e src/components/layout/{menu-lateral,sidebar,menu-etiquetas}.tsx",
    escopo: "HUB e Validades conservam a moldura com lateral; Pedidos usa a variante operacional compacta sem lateral e com marca separada.",
    diferencas: "Validades muda somente a paleta; DS-PED-COMPACTO-01 registra o shell compacto exclusivo de Pedidos, Em revisão visual.",
    riscos: "Tabelas extensas preservam rolagem horizontal dentro do próprio contêiner.",
    valores: [
      { rotulo: "Lateral", valor: "16rem", origem: "--ds-menu-largura", uso: "Telas amplas" },
      { rotulo: "Lateral recolhida", valor: "4.5rem", origem: "MenuLateral", uso: "Preferência por usuário; nomes por foco/hover e submenus em portal" },
      { rotulo: "Moldura", valor: "gap 1rem; padding 1rem", origem: ".estrutura-sistema", uso: "Layout protegido" },
      { rotulo: "Cabeçalho", valor: "min-height 4.5rem", origem: ".cabecalho-sistema", uso: "Topo fixo" },
      { rotulo: "Mobile", valor: "até 767px", origem: "@media", uso: "Menu móvel e espaçamento reduzido" },
    ],
    chavesEditaveis: ["menu.largura"],
  },
  {
    id: "superficies", nome: "Glassmorphism e superfícies", grupo: "fundamentos",
    resumo: "Transparência, bordas, desfoque e sombras observados no produto.",
    termos: ["vidro", "glass", "blur", "sombra", "borda", "cartao", "cartão"], estado: "referencia", evidencia: "observado",
    fonte: "src/app/globals.css (.vidro-painel) e src/components/ui/{card,dialog}.tsx",
    escopo: "Cabeçalho, lateral, cartões de vidro, diálogos, select e menu.",
    diferencas: "Select e menu usam vidro; combobox mantém borda, anel e sombra próprios.",
    riscos: "Unificar todos os popovers apagaria diferenças intencionais de contraste e hierarquia.",
    valores: [
      { rotulo: "Vidro claro", valor: "rgb(255 255 255 / 0.78)", origem: "--vidro-fundo", uso: "Painéis sobrepostos" },
      { rotulo: "Desfoque", valor: "24px + saturate(140%)", origem: "--ds-vidro-desfoque", uso: "Painéis de vidro" },
      { rotulo: "Cartão", valor: "0.75rem", origem: "--ds-cartao-raio", uso: "Card compartilhado" },
      { rotulo: "Diálogo", valor: "0.75rem", origem: "--ds-dialogo-raio", uso: "Dialog e confirmação" },
    ],
    chavesEditaveis: ["vidro.desfoque", "vidro.opacidade", "cartao.raio", "dialogo.raio", "popup.raio", "aba.raio"],
  },
  {
    id: "acessibilidade", nome: "Acessibilidade", grupo: "fundamentos",
    resumo: "Foco, teclado, contraste composto e preferência de movimento.",
    termos: ["foco", "teclado", "contraste", "movimento", "aria", "acessibilidade"], estado: "pendente", evidencia: "pendente",
    fonte: "src/app/globals.css e primitives de @base-ui/react",
    escopo: "Controles compartilhados, atalhos, diálogos e menus.",
    diferencas: "A marca altera o anel pela variável primária, sem remover o foco visível.",
    riscos: "Leitor de tela, zoom, alto contraste e navegação completa por teclado ainda exigem validação manual.",
    valores: [
      { rotulo: "Foco", valor: "outline 2px; offset 3px", origem: "globals.css", uso: "Navegação visível" },
      { rotulo: "Movimento", valor: "150ms", origem: "--ds-movimento-rapido", uso: "Transições de controles" },
      { rotulo: "Transparência", valor: "reduce / contrast / forced-colors", origem: "@media", uso: "Preferências do sistema" },
    ],
    chavesEditaveis: ["movimento.rapido"],
  },
  {
    id: "botoes", nome: "Botões", grupo: "componentes",
    resumo: "Variantes, dimensões e ações compartilhadas. Editar usa lápis amarelo em botão circular compacto, com nome acessível.",
    termos: ["botao", "botão", "primario", "primário", "destrutivo", "carregando"], estado: "referencia", evidencia: "observado",
    fonte: "src/components/ui/button.tsx e badge.tsx",
    escopo: "Botões, ações de formulário e chips em todos os módulos.",
    diferencas: "Ações fiscais e financeiras preservam variantes semânticas específicas do domínio.",
    riscos: "Não trocar cor de aceite, recusa ou movimentos financeiros sem revisão de significado.",
    valores: [
      { rotulo: "Padrão", valor: "2.75rem", origem: "--ds-controle-altura", uso: "Ações principais" },
      { rotulo: "Compacto", valor: "2rem", origem: "--ds-controle-altura-compacta", uso: "Ações secundárias" },
      { rotulo: "Formato", valor: "9999px", origem: "--ds-botao-raio", uso: "Botões e badges" },
      { rotulo: "Estados", valor: "foco, ativo, desabilitado, inválido", origem: "button.tsx", uso: "Interação" },
      { rotulo: "Editar", valor: "Lápis amarelo, círculo compacto, sem texto visível", origem: "Button variant=editar; --warning / --warning-bg", uso: "Ações de edição em todo o sistema" },
      { rotulo: "Salvar orçamento", valor: "Laranja; texto branco no claro e navy no escuro", origem: "Button variant=salvar; --ds-salvar-claro / --ds-salvar-escuro", uso: "Salvar sem confirmar ou cancelar o pedido" },
      { rotulo: "Cancelar edição — Em revisão", valor: "Fundo e borda neutros, texto legível e hover neutro em ambos os temas", origem: "Button variant=outline; data-acao=cancelar; --card / --border / --foreground", uso: "Cancelar edição ou fechar um diálogo sem confirmar a operação" },
      { rotulo: "Confirmar cancelamento", valor: "Botão preenchido vermelho", origem: "Button variant=saida; --destructive", uso: "Confirmação explícita do cancelamento com responsável e motivo" },
      { rotulo: "Remover/excluir", valor: "Somente X vermelho com fundo pastel fixo; efeito no hover e foco acessível", origem: "Button variant=excluir / ação remover; BotaoRemoverItem", uso: "Exclusões; confirmação, permissões e auditoria preservadas" },
      { rotulo: "Excluir com texto — Em revisão", valor: "X e rótulo visível, botão neutro e vermelho no hover", origem: "Button variant=excluir-rotulo", uso: "Solicitação explícita em Pontos de impressão; mantém confirmação, permissões e auditoria" },
      { rotulo: "Remoção pequena — Em revisão", valor: "Somente X cinza, fundo transparente; vermelho no hover", origem: "Button variant=excluir-discreto; BotaoRemoverItem discreto", uso: "Fotos e seleções do formulário; não altera confirmação ou gravação" },
    ],
    chavesEditaveis: ["controle.altura", "controle.alturaCompacta", "botao.raio", "acao.salvarClaro", "acao.salvarEscuro"],
  },
  {
    id: "campos", nome: "Campos e validação", grupo: "componentes",
    resumo: "Campos vazios, preenchidos ou em edição preservam as mesmas dimensões. Ações de confirmação têm espaço reservado para manter o alinhamento.",
    termos: ["input", "formulario", "formulário", "erro", "label", "checkbox", "moeda", "bloqueado", "acinzentado", "somente leitura", "desabilitado"], estado: "referencia", evidencia: "observado",
    fonte: "src/components/ui/{input,textarea,checkbox,currency-input}.tsx",
    escopo: "Campos, moeda, texto longo e checkbox compartilhados.",
    diferencas: "CurrencyInput adiciona máscara monetária; não cria uma regra visual independente.",
    riscos: "Máscaras e validações de negócio não devem ser alteradas pela Central de Design.",
    valores: [
      { rotulo: "Campo", valor: "2.75rem; raio 0.375rem", origem: "--ds-controle-*", uso: "Input e selectores" },
      { rotulo: "Textarea", valor: "min-height 4rem", origem: "textarea.tsx", uso: "Observações e motivos" },
      { rotulo: "Checkbox", valor: "16px; raio 4px", origem: "--ds-checkbox-raio", uso: "Escolhas booleanas" },
      { rotulo: "Erro", valor: "borda e anel destrutivos", origem: "input.tsx", uso: "aria-invalid" },
      { rotulo: "Não editável", valor: "Cinza neutro com texto legível nos temas claro e escuro", origem: "--ds-campo-bloqueado-* / globals.css", uso: "disabled e readOnly no HUB, Pedidos e Validades; preserva foco, cópia e envio de somente leitura" },
      { rotulo: "Delimitação", valor: "restricao, casasDecimais e maxLength; digitação e colagem validadas", origem: "Input / campos-entrada.ts", uso: "Campos numéricos sem letras; máscaras preservadas; limite explícito do domínio prevalece" },
    ],
    chavesEditaveis: ["controle.altura", "controle.raio", "controle.checkboxRaio", "controle.bloqueadoFundoClaro", "controle.bloqueadoTextoClaro", "controle.bloqueadoBordaClaro", "controle.bloqueadoFundoEscuro", "controle.bloqueadoTextoEscuro", "controle.bloqueadoBordaEscuro"],
  },
  {
    id: "selecao", nome: "Seleção e combobox", grupo: "componentes",
    resumo: "Seleção simples e múltipla com listas abaixo do campo, escolha marcada e grupos por categoria do domínio. Busca e opções extensas preservam o mesmo padrão.",
    termos: ["select", "multisselecao", "multisseleção", "multiseleção", "seleção múltipla", "lista", "busca", "combobox", "abaixo", "categoria", "agrupamento"], estado: "referencia", evidencia: "observado",
    fonte: "src/components/ui/{select,combobox}.tsx e src/components/multiselecao-combobox.tsx",
    escopo: "Select, SelecaoFormulario, Combobox, multisseleção e especializações em todos os módulos, incluindo a Central de Design.",
    diferencas: "Select e combobox compartilham fundo de popover, borda, anel e sombra. A busca, os chips e os grupos preservam a semântica do domínio.",
    riscos: "Inverter apenas sem espaço abaixo, sem sobrepor o campo. Preservar teclado, valores, envio do formulário e opções indisponíveis; grupos artificiais não ajudam listas simples.",
    valores: [
      { rotulo: "Gatilho", valor: "2.75rem; raio 0.375rem", origem: "--ds-controle-*", uso: "Select e combobox" },
      { rotulo: "Lista", valor: "raio 0.5rem", origem: "--ds-popup-raio", uso: "Resultados e opções" },
      { rotulo: "Abertura", valor: "abaixo, alinhada ao início, afastamento 4px; sem alinhar a opção ao campo", origem: "SelectContent / ComboboxContent", uso: "Seleção simples e múltipla; inversão somente por falta de espaço" },
      { rotulo: "Superfície", valor: "bg-popover, border-primary/30, ring-primary/15 e shadow-xl", origem: "ui/select.tsx / ui/combobox.tsx", uso: "Lista destacada do campo em HUB, Validades e Pedidos" },
      { rotulo: "Categorias", valor: "Group / GroupLabel; check da seleção distinto do destaque de navegação", origem: "Select / Combobox / MultiselecaoCombobox", uso: "Grupos reais do catálogo; PF/PJ e status permanecem listas simples" },
      { rotulo: "Formulários", valor: "SelecaoFormulario compõe opções declaradas com Select oficial", origem: "ui/select.tsx", uso: "Preserva name, defaultValue, required, disabled e integração de formulário sem lista nativa independente" },
      { rotulo: "Busca", valor: "ícone + placeholder + vazio", origem: "combobox.tsx", uso: "Combobox" },
    ],
    chavesEditaveis: ["controle.altura", "controle.alturaCompacta", "controle.raio", "popup.raio"],
  },
  {
    id: "dialogos", nome: "Diálogos e menus", grupo: "componentes",
    resumo: "Camadas, retorno de foco, Escape e menus contextuais.",
    termos: ["modal", "dialog", "diálogo", "menu", "escape", "popup"], estado: "referencia", evidencia: "observado",
    fonte: "src/components/ui/{dialog,dropdown-menu}.tsx",
    escopo: "Formulários, confirmações, conta, aparência e menus contextuais.",
    diferencas: "Diálogos têm larguras por fluxo; isso não é um valor global único.",
    riscos: "Proteção contra descarte e retorno de foco precisam continuar sendo testados em cada fluxo.",
    valores: [
      { rotulo: "Diálogo", valor: "max-width calc(100% - 2rem); raio 0.75rem", origem: "dialog.tsx", uso: "Janela modal" },
      { rotulo: "Menu", valor: "min-width 8rem; raio 0.5rem", origem: "dropdown-menu.tsx", uso: "Ações contextuais" },
      { rotulo: "Animação", valor: "150ms", origem: "--ds-movimento-rapido", uso: "Abertura e fechamento" },
    ],
    chavesEditaveis: ["dialogo.raio", "popup.raio", "movimento.rapido"],
  },
  {
    id: "dados-feedback", nome: "Tabelas e feedback", grupo: "componentes",
    resumo: "Abas, tabelas, estados vazios, alertas e mensagens de retorno.",
    termos: ["tabela", "tabs", "aba", "toast", "alerta", "feedback"], estado: "referencia", evidencia: "observado",
    fonte: "src/components/ui/{tabs,table,sonner}.tsx",
    escopo: "Tabelas e feedback reutilizáveis. Estados vazios e análises são locais dos módulos.",
    diferencas: "Tabelas preservam rolagem e largura conforme o domínio; abas não são a subnavegação de Inventário.",
    riscos: "Não remover rolagem de tabelas sem reorganizar as colunas e revisar telas compactas.",
    valores: [
      { rotulo: "Abas", valor: "raio 0.5rem; padding 3px", origem: "--ds-aba-raio", uso: "Tabs compartilhadas" },
      { rotulo: "Tabela", valor: "13px; cabeçalho 2.25rem", origem: "table.tsx", uso: "Leitura densa" },
      { rotulo: "Toast", valor: "popover, border e radius globais", origem: "sonner.tsx", uso: "Feedback temporário" },
    ],
    chavesEditaveis: ["aba.raio", "movimento.rapido"],
  },
  {
    id: "referencia-fabrica", nome: "Referência de fábrica", grupo: "gestao",
    resumo: "Valores iniciais preservados e versões publicadas auditáveis.",
    termos: ["padrao", "padrão", "versao", "versão", "publicado", "fabrica", "fábrica"], estado: "referencia", evidencia: "testado",
    fonte: "src/lib/design-system/{registro,servico}.ts e schema Prisma",
    escopo: "Rascunho compartilhado, versão imutável e aplicação no HTML inicial.",
    diferencas: "Os mesmos tokens estruturais se aplicam às duas marcas; as chaves de cor são separadas por marca e modo.",
    riscos: "Publicação alcança apenas componentes conectados; não representa autorização para alterar regras de negócio.",
    valores: [
      { rotulo: "Entrada", valor: "Registro fechado", origem: "registro.ts", uso: "Sem CSS livre" },
      { rotulo: "Persistência", valor: "rascunho + versão + evento", origem: "schema.prisma", uso: "Auditoria" },
      { rotulo: "Aplicação", valor: "style#tema-publicado-design", origem: "app/layout.tsx", uso: "HTML inicial" },
    ],
  },
  {
    id: "migracao", nome: "Adoção e pendências", grupo: "gestao",
    resumo: "Famílias conectadas, exceções justificadas e verificações que permanecem manuais.",
    termos: ["etapa", "token", "migracao", "migração", "risco", "adocao", "adoção"], estado: "referencia", evidencia: "observado",
    fonte: "docs/design-system/adocao-etapa-5.md e scripts/verificar-tokens-design.mjs",
    escopo: "Suprimentos, Financeiro, Produção/Validades e Configurações através dos componentes compartilhados.",
    diferencas: "Impressão, ZPL, gráficos e larguras de tabelas continuam exceções declaradas.",
    riscos: "A regra protege somente componentes base; módulos novos ainda precisam revisar usos locais no PR.",
    valores: [
      { rotulo: "Componentes", valor: "UI e layout compartilhados", origem: "src/components/ui", uso: "Adoção transversal" },
      { rotulo: "Regra", valor: "verificação de tokens", origem: "package.json", uso: "Revisão contínua" },
      { rotulo: "Exceções", valor: "impressão, gráfico e domínio", origem: "adocao-etapa-5.md", uso: "Preserva comportamento" },
    ],
  },
];

export const ESTADOS_DEMONSTRACAO = ["normal", "foco", "hover", "desabilitado", "somente-leitura", "carregando", "salvando", "sucesso", "erro", "sem-permissao", "vazio", "longo"] as const;
export type EstadoDemonstracao = typeof ESTADOS_DEMONSTRACAO[number];
export type ComponenteDemonstracao = "status" | "acoes" | "inline" | "slots" | "ordenacao" | "campos" | "selecao" | "dialogo" | "tipografia" | "cores" | "tabela" | "navegacao" | "mensagens" | "impressao" | "validades" | "processo" | "operacional-compacto" | "canais" | "filtros-contados" | "quantidade" | "validacao";
export type ContratoPadrao = PadraoDesign & {
  situacao: "Oficial" | "Em revisão" | "Legado" | "Exceção aprovada";
  componente: ComponenteDemonstracao;
  variantes: readonly string[];
  cenarios: readonly EstadoDemonstracao[];
  restricoes: string;
  consumidores: readonly string[];
};
const novos: { id: string; nome: string; componente: ComponenteDemonstracao; termos: string[]; resumo: string; consumidores: string[]; chaves?: ChaveTokenDesign[]; fonte?: string }[] = [
  { id: "bi-vendas", nome: "Dashboard de vendas", componente: "tabela", termos: ["Dashboard", "BI", "vendas", "indicadores", "gráfico", "ranking", "cobertura", "comparação"], resumo: "Composição de Card, Tabs line, Button, seleção, Table e Dialog painel-direito. Sete indicadores, evolução em colunas e ranking 60/40; distribuição, oportunidades e cobertura abaixo. Gráficos usam tokens e alternativa textual. Filtros de consulta preservam URL, dados parciais e permissões; detalhes paginados usam a identificação fixa oficial. Demonstração completa isolada em testes/visual/bi-vendas.html.", consumidores: ["Dashboard"], fonte: "src/components/vendas/bi/bi-vendas.tsx", chaves: ["cartao.raio", "controle.raio", "controle.altura", "aba.raio", "cor.hub.primariaClara", "cor.hub.primariaEscura"] },
  { id: "quantidade-escolha", nome: "Quantidade com diminuir e aumentar", componente: "quantidade", termos: ["quantidade", "complementos", "mínimo", "máximo", "mais", "menos", "repetir"], resumo: "QuantidadeEscolha compõe Button e Input: menos, inteiro e mais no mesmo eixo. O domínio fornece o teto restante do grupo e a regra de repetição; adição fica cinza/desabilitada ao atingir o teto. Remover uma unidade libera capacidade; digitação/colagem respeitam o limite.", consumidores: ["Novo Pedido", "Simulador de produtos"], fonte: "src/components/quantidade-escolha.tsx", chaves: ["controle.altura", "controle.raio", "botao.raio"] },
  { id: "pendencia-formulario", nome: "Erro junto ao campo com foco e rolagem", componente: "validacao", termos: ["erro", "campo", "validação", "rolagem", "scroll", "foco", "obrigatório"], resumo: "MensagemPendenciaFormulario associa texto e aria-invalid ao controle, abre detalhes e conduz foco/rolagem até a pendência. Endereços em abas devem ativar o painel antes de focar. Não apaga valores nem executa persistência; bloqueios sem campo continuam em resumo visível.", consumidores: ["Novo Pedido"], fonte: "src/components/pendencia-formulario.tsx", chaves: ["controle.altura", "controle.raio"] },
  { id: "filtros-contados", nome: "Filtros com contagem", componente: "filtros-contados", termos: ["filtro", "contagem", "quantidade", "pessoa física", "pessoa jurídica", "PF", "PJ", "status", "tipo"], resumo: "FiltroOpcoesContadas exige quantidade em cada opção. As contagens consideram busca e demais filtros, ignorando a própria seleção e a paginação. Zero permanece visível e selecionável; o filtro é imediato e não grava dados.", consumidores: ["Clientes", "Insumos", "Posição de estoque", "Gestor de pedidos"], fonte: "src/components/filtro-opcoes-contadas.tsx", chaves: ["controle.alturaCompacta", "botao.raio", "movimento.rapido"] },
  { id: "pedidos-vidro", nome: "Superfícies de vidro de Pedidos", componente: "slots", termos: ["glassmorphism", "vidro", "pedidos", "gestor"], resumo: "Painéis translúcidos da identidade Pedidos reutilizam opacidade, desfoque, borda e sombra oficiais. Painéis densos não acumulam blur por linha; transparência reduzida, alto contraste e impressão usam fundos estáveis.", consumidores: ["Gestor de pedidos", "Formulários de pedidos", "Login Pedidos"], fonte: "src/app/globals.css", chaves: ["vidro.desfoque", "vidro.opacidade"] },
  { id: "canais-venda", nome: "Seleção de canal de venda", componente: "canais", termos: ["canal", "site", "iFood", "GF", "Giuliana Flores"], resumo: "Botões de seleção única com aria-pressed; Site azul, iFood vermelho, GF roxo. Identidade do cadastro é preservada; somente a apresentação de Giuliana Flores é abreviada.", consumidores: ["Novo Pedido", "SelecaoCanalVenda"], fonte: "src/components/canais-venda.tsx", chaves: ["cor.canal.site", "cor.canal.ifood", "cor.canal.gf", "cor.canal.texto"] },
  { id: "busca-operacional", nome: "Busca automática arredondada", componente: "operacional-compacto", termos: ["busca", "pesquisa", "arredondado", "limpar", "automática"], resumo: "CampoBusca controlado com formato explícito; a consulta automática e o cancelamento de buscas pendentes pertencem ao consumidor, preservando filtros e paginação.", consumidores: ["Gestor de pedidos", "CampoBusca"], fonte: "src/components/campo-busca.tsx", chaves: ["controle.altura", "controle.raio", "botao.raio"] },
  { id: "filtro-canal-imediato", nome: "Canal com seleção imediata", componente: "operacional-compacto", termos: ["canal", "filtro", "checkbox", "imediato", "marcar", "desmarcar", "todos"], resumo: "FiltroCanalVenda em Popover compacto: clique marca um canal e aplica imediatamente; desmarcar ou Todos remove. Permanece aberto; selecionado fora do catálogo continua visível e removível. Sem rascunho ou Aplicar.", consumidores: ["Gestor de pedidos", "FiltroCanalVenda"], fonte: "src/components/filtro-canal-venda.tsx", chaves: ["popup.raio", "controle.alturaCompacta", "movimento.rapido"] },
  { id: "seletor-visualizacao-operacional", nome: "Visualização com cor de identificação", componente: "operacional-compacto", termos: ["quadros", "calendário", "lista", "modo", "verde", "azul", "violeta", "seletor"], resumo: "Seletor fechado de Quadros/Calendário/Lista sobre Select. Só a cor do gatilho muda: verde, azul e violeta; layout e cores dos status permanecem intactos.", consumidores: ["Gestor de pedidos", "SeletorVisualizacaoOperacional"], fonte: "src/components/seletor-visualizacao-operacional.tsx e src/app/globals.css (.ds-seletor-visualizacao)", chaves: ["controle.alturaCompacta", "controle.raio", "popup.raio"] },
  { id: "filtros-ancorados", nome: "Filtros em painel ancorado", componente: "operacional-compacto", termos: ["filtro", "popover", "popup", "aplicar", "limpar", "rolagem"], resumo: "Popover Base UI de 240px, até 400px disponíveis, sem deslocar conteúdo. Seleção simples aplica no clique; formulários complexos usam variante explícita de rascunho com Aplicar/Limpar.", consumidores: ["Gestor de pedidos", "Popover"], fonte: "src/components/ui/popover.tsx", chaves: ["popup.raio", "controle.alturaCompacta", "movimento.rapido"] },
  { id: "tags-canais-venda", nome: "Identificação do canal de venda", componente: "operacional-compacto", termos: ["canal", "site", "ifood", "gf", "giuliana flores", "origem", "tag"], resumo: "TagCanalVenda apresenta Site azul, iFood vermelho e GF roxo por aliases exatos; demais nomes ficam neutros. Identifica origem comercial, sem representar status ou ação.", consumidores: ["Gestor de pedidos", "TagCanalVenda"], fonte: "src/components/tag-canal-venda.tsx", chaves: ["botao.raio"] },
  { id: "barra-operacional-compacta", nome: "Barra operacional compacta", componente: "operacional-compacto", termos: ["toolbar", "barra", "compacta", "gestor", "cabeçalho", "sem lateral"], resumo: "BarraAcoes compacta reserva o título acessível e organiza busca, filtros, visualização e ações na mesma linha ampla, com quebra em telas pequenas. Shell dedicado de Pedidos preserva marca, aparência e conta.", consumidores: ["Gestor de pedidos", "BarraAcoes", "CabecalhoConteudo"], fonte: "src/components/padroes-operacionais.tsx e src/components/layout/cabecalho-conteudo.tsx", chaves: ["controle.alturaCompacta", "acoes.espaco", "menu.largura"] },
  { id: "visualizacoes-operacionais", nome: "Quadros, calendário e lista", componente: "processo", termos: ["pedidos", "gestor", "calendário", "quadros", "status", "avançar", "retornar"], resumo: "Cinco etapas delimitadas de mesma largura: Novo pedido, Em preparo, Pronto para entrega / retirada, A caminho e Entregue. Título visível, seletor único Quadros/Calendário/Lista à esquerda da busca e filtros ancorados; orçamento e encerramentos por filtro em Lista. Ações sequenciais são confirmadas pelo servidor, preservando preparação, estoque, financeiro e primeira entrega.", consumidores: ["Gestor de pedidos", "gestor-client.tsx", "gestor.css"], chaves: ["cor.pedidos.primariaClara", "cor.pedidos.primariaEscura", "cartao.raio", "controle.alturaCompacta", "acoes.espaco"] },
  { id: "pedidos-lista-expandida", nome: "Pedido em lista com ações diretas", componente: "processo", termos: ["pedidos", "lista", "criação", "canal", "status", "itens", "kanban"], resumo: "Lista sem expansão, com criação e canal visíveis; próximo passo, impressora e menu como ações diretas. Cards mostram cliente/destinatário, data completa/janela de entrega, miniaturas com quantidade e valor; ações no cabeçalho. Clicar no pedido abre o detalhe, sem olho ou ações no rodapé. Menu oferece resumo comercial e cancelamento elegível por último após separador, sem impressão duplicada. Usa Table, Card, Button, DropdownMenu e cores de processo existentes. O ID histórico da composição é preservado.", consumidores: ["Gestor de pedidos"], fonte: "src/app/(protegido)/vendas/pedidos/gestor-client.tsx", chaves: ["cartao.raio", "controle.alturaCompacta", "acoes.espaco"] },
  { id: "pedidos-detalhe-vertical", nome: "Detalhe vertical do pedido", componente: "dialogo", termos: ["pedido", "detalhe", "cliente", "entrega", "pagamento", "histórico"], resumo: "Painel lateral direito em Dialog oficial, não modal no desktop e modal no móvel. Cliente, agenda alinhada, endereço, pagamento, fotos dos itens, observações e histórico em sequência vertical. Edição inline valida só metadados alterados, com Salvar alterações único e descarte protegido. Cancelamento no menu exige nome e motivo; sem área redundante de operação.", consumidores: ["Detalhe do pedido"], fonte: "src/app/(protegido)/vendas/pedidos/detalhe-pedido.tsx", chaves: ["dialogo.raio", "cartao.raio", "controle.alturaCompacta"] },
  { id: "resumo-comercial-pedido", nome: "Resumo comercial A4", componente: "impressao", termos: ["resumo", "pedido", "A4", "PDF", "orçamento", "Grazing Table"], resumo: "Prévia em Dialog oficial e documento comercial com identidade Grazing Table & Co. EX-IMP-04 limita cores e dimensões físicas ao HTML impresso; consulta autorizada usa cálculo oficial do orçamento ou snapshots do confirmado.", consumidores: ["Gestor de pedidos", "Detalhe do pedido", "Orçamento"], fonte: "src/lib/vendas/resumo-pedido-a4.ts" },
  { id: "status-ativo", nome: "Ativar e inativar", componente: "status", termos: ["ativar", "inativar", "status", "ativo", "inativo", "situação"], resumo: "Status de cadastro binário, confirmado pelo servidor, com bloqueio e erro recuperável.", consumidores: ["Fornecedores", "Insumos", "Contas", "Produtos"], chaves: ["acao.tamanho"] },
  { id: "edicao-inline", nome: "Edição na listagem", componente: "inline", termos: ["editar preço", "porção", "quantidade", "desconto", "confirmar", "cancelar", "NCM", "vínculos fiscais"], resumo: "Campo estável com confirmação explícita e cancelamento, sem salvar ao perder foco. Variante de linha com check único e cancelamento por Escape. Preço de Produtos mostra o check ao lado apenas com alteração; sair do conjunto campo/check cancela sem gravar.", consumidores: ["Preço de Produtos", "Composição de produtos", "Vínculos fiscais"], chaves: ["controle.altura", "controle.raio", "acoes.espaco"] },
  { id: "slots", nome: "Cartões e slots", componente: "slots", termos: ["abrir box", "slot", "expandir", "complementos", "agrupar"], resumo: "Expansão independente das ações e grade que acompanha a largura do conteúdo.", consumidores: ["Grupos de complementos"], chaves: ["cartao.raio", "acao.tamanho", "acoes.espaco"] },
  { id: "ordenacao", nome: "Agrupamento e ordenação", componente: "ordenacao", termos: ["agrupar", "arrastar", "ordenar", "subir", "descer"], resumo: "Ordem explícita pela alça, com alternativa de teclado. O domínio determina o conjunto completo.", consumidores: ["Categorias", "Produtos", "Complementos", "Horários de entrega"], chaves: ["controle.alturaCompacta"] },
  { id: "navegacao", nome: "Navegação", componente: "navegacao", termos: ["menu", "submódulo", "inventário", "aba", "configurações", "fiscal", "recolher", "expandir"], resumo: "Grupos expansíveis, foco e indicação textual da seleção. Agrupamentos sem página própria usam um botão de divulgação.", consumidores: ["Sidebar", "GrupoNavegacao", "MenuEtiquetas", "Tabs", "Configurações de Vendas", "Fiscal de Vendas"], chaves: ["menu.largura", "aba.raio"] },
  { id: "mensagens", nome: "Mensagens e estados", componente: "mensagens", termos: ["alerta", "vazio", "erro", "sucesso", "carregando"], resumo: "Retorno textual além da cor, erro persistente e nova tentativa.", consumidores: ["Formulários", "Cadastros"], chaves: ["movimento.rapido"] },
  { id: "negocio", nome: "Padrões de negócio", componente: "inline", termos: ["porção", "fiscal", "canal", "composição"], resumo: "A interação é comum, mas precisão, permissão e validação continuam no domínio.", consumidores: ["Produtos", "Preparações", "Financeiro"], chaves: ["controle.altura", "controle.raio"] },
  { id: "validades-vidro", nome: "Validades — superfícies e operação", componente: "validades", termos: ["validades", "glassmorphism", "vidro", "etiqueta", "baixa", "responsável", "produto", "revisão"], resumo: "Superfícies sutis sem hero decorativo. Três etapas principais, cards totalmente acionáveis, atalho Dar baixa independente e detalhe em Dialog oficial. Componentes e tokens do HUB; transações, fila e ZPL pertencem ao domínio. Demonstração sintética, sem impressão ou persistência.", consumidores: ["Gestão de validades", "Emissão de etiquetas", "Configurações de Validades"], fonte: "src/app/(protegido)/producao/etiquetas/validades.css", chaves: ["cartao.raio", "vidro.desfoque", "controle.altura", "movimento.rapido"] },
  { id: "impressao", nome: "Fichas e impressão", componente: "impressao", termos: ["ZPL", "etiqueta", "ficha técnica", "impressora"], resumo: "Exemplo sem hardware. Dimensões físicas e regras ZPL são exceções do domínio.", consumidores: ["Validades", "Fichas de composição"] },
];
const componentes: Record<string, ComponenteDemonstracao> = { "cores-temas": "cores", tipografia: "tipografia", estrutura: "slots", superficies: "slots", acessibilidade: "campos", botoes: "acoes", campos: "campos", selecao: "selecao", dialogos: "dialogo", "dados-feedback": "tabela", "referencia-fabrica": "cores", migracao: "mensagens" };
/** Catálogo único: metadados da referência + contrato de demonstração, sem ações de negócio. */
export const PADROES_DESIGN: ContratoPadrao[] = [
  ...novos.map(item => ({ id: item.id, nome: item.nome, grupo: "componentes" as const, resumo: item.resumo, termos: item.termos, estado: "pendente" as const, evidencia: "pendente" as const, fonte: item.fonte ?? "src/components/{status-ativo,padroes-operacionais,lista-ordenavel}.tsx", escopo: item.consumidores.join(", "), diferencas: "Marca altera cor, não a regra de interação.", riscos: "Prévia sintética não valida persistência do domínio.", valores: [], chavesEditaveis: item.chaves, componente: item.componente, consumidores: item.consumidores })),
  ...REFERENCIAS_DESIGN.map(item => ({ ...item, termos: item.id === "botoes" ? [...item.termos, "lápis", "editar", "excluir", "lixeira", "remover item", "rascunho"] : item.termos, componente: componentes[item.id], consumidores: [item.escopo] })),
].map(item => ({ ...item, situacao: "Em revisão", variantes: ["HUB claro", "HUB escuro", "Validades claro", "Validades escuro", "Pedidos claro", "Pedidos escuro", ...(item.id === "validades-vidro" ? ["Indicadores de prazo", "Card com baixa independente", "Produtos agrupados e expansíveis", "Baixa direta de uma etiqueta", "Etapas compactas", "Subetapas sequenciais de produto", "Seleção de produto com foto", "Prévia ajustada à janela", "Detalhe de etiqueta", "Responsável / Produto / Etiqueta"] : []), ...(item.id === "botoes" ? ["Excluir com texto — uso explícito", "Remover item do rascunho (X)", "Atenção — salvar orçamento", "Formato de campo — consultas analíticas"] : []), ...(item.id === "navegacao" ? ["Link com expansor", "Agrupamento sem página própria", "Abas com geometria de botão", "Lateral recolhida com tooltip e submenu em portal"] : []), ...(item.id === "edicao-inline" ? ["Check único por linha", "Check verde com alteração pendente"] : []), ...(item.id === "dados-feedback" ? ["Abas com seleção primária", "Tabela responsiva com identificação fixa", "Seleção e identificação juntas", "Barra nativa na área visível"] : []), ...(item.id === "busca-operacional" ? ["Padrão", "Arredondada"] : []), ...(item.id === "filtros-ancorados" ? ["Consulta simples imediata", "Formulário complexo com Aplicar/Limpar"] : []), ...(item.id === "filtro-canal-imediato" ? ["Um canal", "Todos os canais", "Selecionado fora do catálogo"] : []), ...(item.id === "seletor-visualizacao-operacional" ? ["Quadros verde", "Calendário azul", "Lista violeta"] : []), ...(item.id === "tags-canais-venda" ? ["Site", "iFood", "GF", "Canal desconhecido", "Sem canal"] : []), ...(item.id === "barra-operacional-compacta" ? ["Título visível padrão", "Título acessível com marca no header"] : []), ...(item.id === "pedidos-detalhe-vertical" ? ["DialogContent painel-direito — desktop não modal", "DialogContent painel-direito — móvel modal"] : [])], cenarios: ESTADOS_DEMONSTRACAO, restricoes: item.riscos }));

export function buscarPadroes(consulta: string, grupo?: GrupoDesign) {
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  const termos = normalizar(consulta.trim()).split(/\s+/).filter(Boolean);
  return PADROES_DESIGN.filter(p => (!grupo || p.grupo === grupo) && termos.every(t => normalizar([p.nome, p.resumo, ...p.termos].join(" ")).includes(t)));
}
