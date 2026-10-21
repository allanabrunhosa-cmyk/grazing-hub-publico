// @vitest-environment jsdom
import {useState} from "react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {render,screen,cleanup,fireEvent} from "@testing-library/react";
vi.mock("@/app/(protegido)/configuracoes/usuarios/actions",()=>({carregarAcessos:vi.fn(),salvarPerfilAcesso:vi.fn(),salvarUsuarioAcesso:vi.fn(),excluirPerfilAcesso:vi.fn(),excluirUsuarioAcesso:vi.fn()}));
import {MatrizPermissoes,UsuariosPermissoes} from "@/app/(protegido)/configuracoes/usuarios/usuarios-permissoes";
import type {Excecoes,Permissoes} from "@/lib/permissoes/catalogo";
afterEach(cleanup);
function Exemplo(){const [excecoes,alterar]=useState<Excecoes>({});return <MatrizPermissoes base={{compras:['visualizar']}} excecoes={excecoes} aoPersonalizar={alterar}/>;}
describe("matriz amigável de permissões",()=>{
 it("destaca a exceção e restaura o perfil sem alterar a base",()=>{
  render(<Exemplo/>);const editar=screen.getByLabelText('Pedidos de compra: Editar') as HTMLInputElement;
  expect(editar.checked).toBe(false);fireEvent.click(editar);expect(editar.checked).toBe(true);expect(screen.getByText('Personalizada')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Restaurar perfil em Pedidos de compra'}));expect(editar.checked).toBe(false);expect(screen.queryByText('Personalizada')).toBeNull();
 });
 it("habilita visualizar junto com adicionar e bloqueia escrita ao retirar visualizar",()=>{
  function Perfil(){const [base,alterar]=useState<Permissoes>({});return <MatrizPermissoes base={base} aoMudar={alterar}/>;}
  render(<Perfil/>);const ver=screen.getByLabelText('Pedidos de compra: Visualizar') as HTMLInputElement;const criar=screen.getByLabelText('Pedidos de compra: Adicionar') as HTMLInputElement;
  fireEvent.click(criar);expect(ver.checked).toBe(true);fireEvent.click(ver);expect(criar.checked).toBe(false);
 });
 it("usuário com acesso de leitura não recebe botões de cadastro",()=>{
  render(<UsuariosPermissoes inicial={{usuarios:[],perfis:[],historico:[]}} capacidades={['visualizar']}/>);
  expect(screen.queryByRole('button',{name:'Novo usuário'})).toBeNull();fireEvent.click(screen.getByRole('tab',{name:'Perfis de acesso'}));expect(screen.queryByRole('button',{name:'Novo perfil'})).toBeNull();
 });
});
