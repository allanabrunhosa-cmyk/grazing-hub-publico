export const MODULOS = ["autenticacao", "acessos", "cadastros", "insumos", "pedidos", "compras", "financeiro", "estoque", "etiquetas", "design", "integracoes"] as const;
export const ORIGENS = ["INTERFACE", "API", "MCP", "AUTOMACAO", "NAO_IDENTIFICADA"] as const;
export const RESULTADOS = ["SUCESSO", "FALHA", "NEGADO", "SOLICITADO", "CONFIRMADO"] as const;
export type FiltrosAtividades = { usuarioId: string; de: string; ate: string; modulo?: string; acao?: string; resultado?: string; origem?: string; perspectiva?: "autor" | "cadastro"; cursor?: string };
export type AtividadeRow = { id: string; data: string; autor: string; atorTipo: string; origem: string; modulo: string; acao: string; entidade: string; resumo: string; resultado: string };
export type PaginaAtividades = { eventos: AtividadeRow[]; proximoCursor: string | null; inicioCobertura: string | null };
export type DetalheAtividade = { evento: AtividadeRow; alteracoes: { campo: string; antes: string; depois: string }[]; link: string | null; referenciaDisponivel: boolean };
