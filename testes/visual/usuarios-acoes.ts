import {todasPermissoes} from "@/lib/permissoes/catalogo";
import type {DadosAcessos} from "@/app/(protegido)/configuracoes/usuarios/types";
import type * as Acoes from "@/app/(protegido)/configuracoes/usuarios/actions";
export const dados:DadosAcessos={perfis:[
 {id:'admin',nome:'Administrador',descricao:'Gestão completa do HUB e dos acessos da equipe.',sistema:'ADMINISTRADOR',permissoes:todasPermissoes(),usuarios:1,versao:'1'},
 {id:'compras',nome:'Compras',descricao:'Fornecedores, pedidos e acompanhamento das entregas.',sistema:null,permissoes:{compras:['visualizar','adicionar','editar'],fornecedores:['visualizar'],insumos:['visualizar']},usuarios:2,versao:'1'},
 {id:'consulta',nome:'Consulta',descricao:'Acompanhamento da operação, sem alterações.',sistema:null,permissoes:{compras:['visualizar'],notas:['visualizar']},usuarios:1,versao:'1'}],usuarios:[
 {id:'1',nome:'Allan Abrunhosa',email:'allan@example.invalid',ativo:true,perfilAcessoId:'admin',excecoes:{},versao:'1'},
 {id:'2',nome:'Marina Oliveira',email:'marina@example.invalid',ativo:true,perfilAcessoId:'compras',excecoes:{compras:{excluir:true}},versao:'1'},
 {id:'3',nome:'Lucas Santos',email:'lucas@example.invalid',ativo:true,perfilAcessoId:'compras',excecoes:{},versao:'1'},
 {id:'4',nome:'Camila Martins',email:'camila@example.invalid',ativo:false,perfilAcessoId:'consulta',excecoes:{},versao:'1'}],historico:[]};
export async function carregarAcessos(){return structuredClone(dados);}
export async function carregarHistoricoAcessos(){return structuredClone(dados.historico);}
export async function carregarUsuariosExcluidos(busca = ""){return [{ id: "excluido-ficticio", nome: "Pessoa fictícia excluída" }].filter(u => u.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));}
export async function alterarStatusUsuarioAcesso(id: string, versao: string, ativo: boolean) { const usuario = dados.usuarios.find(u => u.id === id); if (!usuario || usuario.versao !== versao) return { erro: "Conflito simulado de revisão." }; usuario.ativo = ativo; usuario.versao = String(Number(versao) + 1); return { ok: true as const }; }
export async function salvarPerfilAcesso(p:Parameters<typeof Acoes.salvarPerfilAcesso>[0]){const novo={...p,id:p.id||'novo',sistema:null,usuarios:0,versao:'2'};dados.perfis=[...dados.perfis.filter(x=>x.id!==novo.id),novo];return {ok:true as const};}
export async function salvarUsuarioAcesso(u:Parameters<typeof Acoes.salvarUsuarioAcesso>[0]){const novo={...u,id:u.id||'novo',versao:'2'};dados.usuarios=[...dados.usuarios.filter(x=>x.id!==novo.id),novo];return {ok:true as const};}
export async function excluirPerfilAcesso(id:string){dados.perfis=dados.perfis.filter(p=>p.id!==id);return {ok:true as const};}
export async function excluirUsuarioAcesso(id:string){dados.usuarios=dados.usuarios.filter(p=>p.id!==id);return {ok:true as const};}

export async function enviarLinkSenhaUsuarioAcesso(){return {ok:true as const};}
