export type GrupoTokenDesign = "identidade" | "tipografia" | "controles" | "superficies" | "estrutura" | "movimento";

type DefinicaoToken = {
  grupo: GrupoTokenDesign;
  rotulo: string;
  descricao: string;
  propriedadeCss: `--${string}`;
  opcoes: readonly string[];
  padrao: string;
};

/**
 * Registro fechado de propriedades editáveis. A Etapa 3 não aceita CSS livre:
 * toda opção daqui é revisada junto do código e pode ser serializada com segurança.
 */
export const REGISTRO_TOKENS = {
  "acao.salvarClaro": { grupo: "controles", rotulo: "Salvar · laranja claro", descricao: "Salvamento de orçamento, distinto de confirmação e cancelamento.", propriedadeCss: "--ds-salvar-claro", opcoes: ["#b65b00"], padrao: "#b65b00" },
  "acao.salvarEscuro": { grupo: "controles", rotulo: "Salvar · laranja escuro", descricao: "Salvamento no tema escuro com texto da marca em contraste.", propriedadeCss: "--ds-salvar-escuro", opcoes: ["#ffb45b"], padrao: "#ffb45b" },
  "controle.bloqueadoFundoClaro": { grupo: "controles", rotulo: "Campo bloqueado · fundo claro", descricao: "Cinza neutro para campos desabilitados e somente leitura nas três marcas.", propriedadeCss: "--ds-campo-bloqueado-fundo-claro", opcoes: ["#e5e7eb"], padrao: "#e5e7eb" },
  "controle.bloqueadoTextoClaro": { grupo: "controles", rotulo: "Campo bloqueado · texto claro", descricao: "Texto legível sem reduzir a opacidade do valor.", propriedadeCss: "--ds-campo-bloqueado-texto-claro", opcoes: ["#4b5563"], padrao: "#4b5563" },
  "controle.bloqueadoBordaClaro": { grupo: "controles", rotulo: "Campo bloqueado · borda clara", descricao: "Contorno neutro; foco e erro conservam seus indicadores.", propriedadeCss: "--ds-campo-bloqueado-borda-claro", opcoes: ["#9ca3af"], padrao: "#9ca3af" },
  "controle.bloqueadoFundoEscuro": { grupo: "controles", rotulo: "Campo bloqueado · fundo escuro", descricao: "Cinza neutro no tema escuro, independente da marca.", propriedadeCss: "--ds-campo-bloqueado-fundo-escuro", opcoes: ["#374151"], padrao: "#374151" },
  "controle.bloqueadoTextoEscuro": { grupo: "controles", rotulo: "Campo bloqueado · texto escuro", descricao: "Contraste para consulta de valores bloqueados no tema escuro.", propriedadeCss: "--ds-campo-bloqueado-texto-escuro", opcoes: ["#d1d5db"], padrao: "#d1d5db" },
  "controle.bloqueadoBordaEscuro": { grupo: "controles", rotulo: "Campo bloqueado · borda escura", descricao: "Contorno neutro no tema escuro.", propriedadeCss: "--ds-campo-bloqueado-borda-escuro", opcoes: ["#6b7280"], padrao: "#6b7280" },
  "cor.canal.site": { grupo: "identidade", rotulo: "Canal Site", descricao: "Canal selecionado: azul aprovado pelo usuário.", propriedadeCss: "--ds-canal-site", opcoes: ["#0865d5"], padrao: "#0865d5" },
  "cor.canal.ifood": { grupo: "identidade", rotulo: "Canal iFood", descricao: "Canal selecionado: vermelho aprovado pelo usuário.", propriedadeCss: "--ds-canal-ifood", opcoes: ["#b91c1c"], padrao: "#b91c1c" },
  "cor.canal.gf": { grupo: "identidade", rotulo: "Canal GF", descricao: "Giuliana Flores: roxo aprovado pelo usuário.", propriedadeCss: "--ds-canal-gf", opcoes: ["#6b21a8"], padrao: "#6b21a8" },
  "cor.canal.texto": { grupo: "identidade", rotulo: "Texto do canal selecionado", descricao: "Contraste sobre as cores de canal em ambos os temas.", propriedadeCss: "--ds-canal-texto", opcoes: ["#ffffff"], padrao: "#ffffff" },
  "acao.tamanho": {
    grupo: "controles", rotulo: "Tamanho das ações compactas", descricao: "Editar, excluir e status; toque mantém no mínimo 44px.",
    propriedadeCss: "--ds-acao-tamanho", opcoes: ["2.25rem", "2.5rem", "2.75rem"], padrao: "2.25rem",
  },
  "acoes.espaco": {
    grupo: "estrutura", rotulo: "Espaço entre ações", descricao: "Agrupamento compartilhado de ações de linha e cabeçalho.",
    propriedadeCss: "--ds-acoes-espaco", opcoes: ["0.5rem", "0.75rem", "1rem"], padrao: "0.5rem",
  },
  "cor.hub.primariaClara": {
    grupo: "identidade",
    rotulo: "Ação primária do HUB · claro",
    descricao: "Cor de botões, foco e chamadas primárias do HUB no modo claro.",
    propriedadeCss: "--ds-hub-primaria-clara",
    opcoes: ["#0865d5", "#0b5fc4", "#1a75e8"],
    padrao: "#0865d5",
  },
  "cor.hub.primariaEscura": {
    grupo: "identidade",
    rotulo: "Ação primária do HUB · escuro",
    descricao: "Cor de botões, foco e chamadas primárias do HUB no modo escuro.",
    propriedadeCss: "--ds-hub-primaria-escura",
    opcoes: ["#83b7ff", "#9bc5ff", "#70a9f5"],
    padrao: "#83b7ff",
  },
  "cor.etiquetas.primariaClara": {
    grupo: "identidade",
    rotulo: "Ação primária de Validades · claro",
    descricao: "Cor de botões, foco e chamadas primárias de Validades no modo claro.",
    propriedadeCss: "--ds-etiquetas-primaria-clara",
    opcoes: ["#b9430c", "#c84a10", "#a63b0a"],
    padrao: "#b9430c",
  },
  "cor.etiquetas.primariaEscura": {
    grupo: "identidade",
    rotulo: "Ação primária de Validades · escuro",
    descricao: "Cor de botões, foco e chamadas primárias de Validades no modo escuro.",
    propriedadeCss: "--ds-etiquetas-primaria-escura",
    opcoes: ["#ffab78", "#ffc19d", "#f7955e"],
    padrao: "#ffab78",
  },
  "cor.pedidos.primariaClara": {
    grupo: "identidade",
    rotulo: "Ação primária de Pedidos · claro",
    descricao: "Cor de botões, foco e chamadas primárias de Pedidos no modo claro.",
    propriedadeCss: "--ds-pedidos-primaria-clara",
    opcoes: ["#166534", "#15803d", "#047857"],
    padrao: "#166534",
  },
  "cor.pedidos.primariaEscura": {
    grupo: "identidade",
    rotulo: "Ação primária de Pedidos · escuro",
    descricao: "Cor de botões, foco e chamadas primárias de Pedidos no modo escuro.",
    propriedadeCss: "--ds-pedidos-primaria-escura",
    opcoes: ["#86efac", "#a7f3d0", "#6ee7b7"],
    padrao: "#86efac",
  },
  "tipografia.familia": {
    grupo: "tipografia",
    rotulo: "Família de texto",
    descricao: "Fonte de interface compartilhada. Não carrega fontes externas nem muda textos impressos.",
    propriedadeCss: "--ds-fonte-sans",
    opcoes: [
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      "ui-sans-serif, system-ui, sans-serif",
      "Arial, Helvetica, sans-serif",
    ],
    padrao: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  "controle.altura": {
    grupo: "controles",
    rotulo: "Altura dos controles",
    descricao: "Botões, campos, seletores e combobox na escala padrão.",
    propriedadeCss: "--ds-controle-altura",
    opcoes: ["2.5rem", "2.75rem", "3rem"],
    padrao: "2.75rem",
  },
  "controle.alturaCompacta": {
    grupo: "controles",
    rotulo: "Altura compacta",
    descricao: "Controles pequenos, sem reduzir a área de toque em telas táteis.",
    propriedadeCss: "--ds-controle-altura-compacta",
    opcoes: ["1.875rem", "2rem", "2.25rem"],
    padrao: "2rem",
  },
  "controle.raio": {
    grupo: "controles",
    rotulo: "Cantos de campos e seletores",
    descricao: "Campos, seleção simples, combobox e listas abertas.",
    propriedadeCss: "--ds-controle-raio",
    opcoes: ["0.25rem", "0.375rem", "0.5rem", "0.75rem"],
    padrao: "0.375rem",
  },
  "controle.checkboxRaio": {
    grupo: "controles",
    rotulo: "Cantos de checkboxes",
    descricao: "Formato visual do checkbox; a área de toque e o foco permanecem os mesmos.",
    propriedadeCss: "--ds-checkbox-raio",
    opcoes: ["2px", "4px", "6px"],
    padrao: "4px",
  },
  "botao.raio": {
    grupo: "controles",
    rotulo: "Formato dos botões",
    descricao: "Botões e chips de ação compartilhados.",
    propriedadeCss: "--ds-botao-raio",
    opcoes: ["0.5rem", "0.75rem", "1rem", "9999px"],
    padrao: "9999px",
  },
  "dialogo.raio": {
    grupo: "superficies",
    rotulo: "Cantos dos diálogos",
    descricao: "Janela principal e confirmação de descarte.",
    propriedadeCss: "--ds-dialogo-raio",
    opcoes: ["0.75rem", "1rem", "1.25rem", "1.5rem"],
    padrao: "0.75rem",
  },
  "popup.raio": {
    grupo: "superficies",
    rotulo: "Cantos de listas abertas",
    descricao: "Menus de seleção e resultados de combobox.",
    propriedadeCss: "--ds-popup-raio",
    opcoes: ["0.375rem", "0.5rem", "0.75rem", "1rem"],
    padrao: "0.5rem",
  },
  "cartao.raio": {
    grupo: "superficies",
    rotulo: "Cantos dos cartões",
    descricao: "Cartões compartilhados, inclusive cabeçalho e rodapé do mesmo cartão.",
    propriedadeCss: "--ds-cartao-raio",
    opcoes: ["0.5rem", "0.75rem", "1rem", "1.25rem"],
    padrao: "0.75rem",
  },
  "aba.raio": {
    grupo: "superficies",
    rotulo: "Cantos das abas",
    descricao: "Lista e item ativo das abas compartilhadas.",
    propriedadeCss: "--ds-aba-raio",
    opcoes: ["0.375rem", "0.5rem", "0.75rem", "1rem"],
    padrao: "0.5rem",
  },
  "vidro.desfoque": {
    grupo: "superficies",
    rotulo: "Desfoque do vidro",
    descricao: "Superfícies de diálogo, seleção e cabeçalho no laboratório.",
    propriedadeCss: "--ds-vidro-desfoque",
    opcoes: ["0px", "16px", "24px", "32px"],
    padrao: "24px",
  },
  "vidro.opacidade": {
    grupo: "superficies",
    rotulo: "Opacidade das superfícies",
    descricao: "Transparência de cartões de vidro em modo claro.",
    propriedadeCss: "--ds-vidro-opacidade",
    opcoes: ["0.7", "0.78", "0.86", "0.94"],
    padrao: "0.78",
  },
  "menu.largura": {
    grupo: "estrutura",
    rotulo: "Largura da lateral",
    descricao: "Largura compartilhada entre HUB e Validades em telas amplas.",
    propriedadeCss: "--ds-menu-largura",
    opcoes: ["14rem", "15rem", "16rem", "17rem", "18rem"],
    padrao: "16rem",
  },
  "movimento.rapido": {
    grupo: "movimento",
    rotulo: "Duração de transições",
    descricao: "Abertura de listas, diálogos e retorno de controles.",
    propriedadeCss: "--ds-movimento-rapido",
    opcoes: ["0ms", "100ms", "150ms", "200ms"],
    padrao: "150ms",
  },
} as const satisfies Record<string, DefinicaoToken>;

export type ChaveTokenDesign = keyof typeof REGISTRO_TOKENS;
export type ValoresTemaParciais = Partial<Record<ChaveTokenDesign, string>>;
export type ValoresTemaResolvidos = Record<ChaveTokenDesign, string>;

export const GRUPOS_TOKENS: { id: GrupoTokenDesign; nome: string; descricao: string }[] = [
  { id: "identidade", nome: "Identidade", descricao: "Cores de ação por marca e modo." },
  { id: "tipografia", nome: "Tipografia", descricao: "Família de texto da interface." },
  { id: "controles", nome: "Controles", descricao: "Botões, campos e seletores." },
  { id: "superficies", nome: "Superfícies", descricao: "Diálogos e acabamento de vidro." },
  { id: "estrutura", nome: "Estrutura", descricao: "Largura lateral compartilhada." },
  { id: "movimento", nome: "Movimento", descricao: "Durações já implementadas no produto." },
];

export const VALORES_FABRICA: ValoresTemaResolvidos = Object.fromEntries(
  Object.entries(REGISTRO_TOKENS).map(([chave, definicao]) => [chave, definicao.padrao]),
) as ValoresTemaResolvidos;

export function chavesDoGrupo(grupo: GrupoTokenDesign): ChaveTokenDesign[] {
  return (Object.keys(REGISTRO_TOKENS) as ChaveTokenDesign[]).filter(chave => REGISTRO_TOKENS[chave].grupo === grupo);
}
