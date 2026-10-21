import type { DadosAdministracaoMcp } from "@/lib/mcp/administracao";
import { ESCOPOS_GERENCIAIS } from "@/lib/mcp/catalogo";
const data = "2026-10-07T12:00:00.000Z";
export const dadosMcpFicticios: DadosAdministracaoMcp = {
  endereco: "https://hub.example.invalid/api/mcp", ambiente: "Prévia isolada — dados fictícios", ativo: false, configurado: true, diagnostico: null, diagnosticadoEm: null,
  clientes: [{ id: "20000000-0000-4000-8000-000000000001", nome: "Cliente de demonstração", redirectUris: ["https://cliente.example.invalid/callback"], ativo: true }],
  usuarios: [{ id: "pessoa-ficticia", nome: "Pessoa fictícia", perfilAcesso: { nome: "Atendimento" } }],
  autorizacoes: [{ id: "30000000-0000-4000-8000-000000000001", nome: "Análises financeiras", clienteId: "20000000-0000-4000-8000-000000000001", clienteNome: "Cliente de demonstração", usuarioId: "pessoa-ficticia", usuarioNome: "Pessoa fictícia", perfilNome: "Atendimento", lojaId: "singleton", lojaNome: "Empresa fictícia", escopos: ESCOPOS_GERENCIAIS, efetivos: [], disponiveis: ESCOPOS_GERENCIAIS, restricoes: { contas: null, lancamentos: null }, situacao: "PREPARADA", versao: 0, createdAt: data, ultimoUsoEm: null }],
  eventos: [], totalEventos: 0, pagina: 1, filtros: { pagina: 1 },
};
