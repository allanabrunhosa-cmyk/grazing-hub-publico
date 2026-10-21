import type { Permissoes, Excecoes } from "@/lib/permissoes/catalogo";
export type PerfilRow = { id: string; nome: string; descricao: string | null; sistema: string | null; permissoes: Permissoes; usuarios: number; versao: string };
export type UsuarioRow = { id: string; nome: string; email: string; ativo: boolean; perfilAcessoId: string | null; excecoes: Excecoes; versao: string };
export type HistoricoRow = { id: string; autor: string; entidade: string; nome: string; acao: string; data: string };
export type DadosAcessos = { perfis: PerfilRow[]; usuarios: UsuarioRow[]; historico: HistoricoRow[] };
