import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv"; import {Client} from "pg";
import {PrismaPg} from "@prisma/adapter-pg"; import {PrismaClient} from "@/generated/prisma/client";
import {readdir,readFile} from "node:fs/promises";
const s=vi.hoisted(()=>({prisma:null as unknown as PrismaClient,sessao:vi.fn(),enviar:vi.fn(),configurado:vi.fn()}));
vi.mock("@/lib/recuperacao-senha/email",()=>({emailConfigurado:s.configurado,enviarEmailRecuperacao:s.enviar}));
vi.mock("server-only",()=>({}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/session",()=>({getSession:s.sessao}));vi.mock("@/lib/prisma",()=>({get prisma(){return s.prisma;}}));
import {salvarPerfilAcesso,salvarUsuarioAcesso,excluirUsuarioAcesso,excluirPerfilAcesso,carregarAcessos,alterarStatusUsuarioAcesso,enviarLinkSenhaUsuarioAcesso} from "@/app/(protegido)/configuracoes/usuarios/actions";
import {concluirRecuperacao,linkRecuperacaoValido} from "@/lib/recuperacao-senha/servico";
import {verifyPassword} from "@/lib/password";
import { RECURSOS_ATENDIMENTO } from "@/lib/permissoes/atendimento";
import type { Acao, Permissoes } from "@/lib/permissoes/catalogo";
const executar=process.env.ACESSOS_BANCO_TESTE==='1';
describe.skipIf(!executar)("gestão de acessos no PostgreSQL isolado",()=>{
 let admin:Client;const schema=`teste_acessos_${Date.now()}`;
 beforeAll(async()=>{
  config({quiet:true});const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Somente banco local.');
  admin=new Client({connectionString:url.toString()});await admin.connect();await admin.query(`CREATE SCHEMA "${schema}"`);await admin.query(`SET search_path TO "${schema}"`);
  for(const pasta of (await readdir('prisma/migrations',{withFileTypes:true})).filter(d=>d.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
    if(pasta.name==='20260911090000_usuarios_permissoes')await admin.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash",admin,ativo,"updatedAt") VALUES ('legado-admin','Admin','legado-admin@example.invalid','hash-preservado',true,true,NOW()),('legado-equipe','Equipe','legado-equipe@example.invalid','hash-preservado',false,true,NOW())`);
    await admin.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`,'utf8')));
  }
  s.prisma=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString(),options:`-c search_path=${schema}`},{schema})});
  const legados=await s.prisma.usuario.findMany({orderBy:{id:'asc'}});
  expect(legados.map(u=>[u.perfilAcessoId,u.ativo,u.senhaHash])).toEqual([['perfil-administrador',true,'hash-preservado'],['perfil-equipe',true,'hash-preservado']]);
  const equipe=await s.prisma.perfilAcesso.findUniqueOrThrow({where:{id:'perfil-equipe'}});
  expect(equipe.permissoes).not.toHaveProperty('configuracoes.usuarios');
  expect(equipe.permissoes).not.toHaveProperty('financeiro.saldo');
 },60000);
 afterAll(async()=>{await s.prisma?.$disconnect();if(admin){if(!/^teste_acessos_\d+$/.test(schema))throw Error('Schema inválido');await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();}});
 beforeEach(async()=>{
  s.enviar.mockReset().mockResolvedValue(undefined);s.configurado.mockReset().mockResolvedValue(true);
  await admin.query('TRUNCATE "Usuario", "HistoricoAcesso" CASCADE');
  await s.prisma.perfilAcesso.deleteMany({where:{sistema:null}});
  await s.prisma.usuario.create({data:{id:'admin',nome:'Administrador de teste',email:'admin@example.invalid',senhaHash:'sem-acesso-real',admin:true,perfilAcessoId:'perfil-administrador'}});
  s.sessao.mockResolvedValue({userId:'admin',admin:true,versao:0,permissoes:{},excecoes:{}});
 });
 const perfil=()=>s.prisma.perfilAcesso.create({data:{nome:'Compras teste',permissoes:{compras:['visualizar','adicionar']}}});
 const entrada=(perfilAcessoId:string)=>({nome:'Pessoa de teste',email:'pessoa@example.invalid',ativo:true,perfilAcessoId,excecoes:{}});
 it("cria perfil e convite sem senha conhecida e com histórico sem segredo",async()=>{
  expect(await salvarPerfilAcesso({nome:'Compras',descricao:'Equipe',permissoes:{compras:['visualizar']}})).toEqual({ok:true});
  const p=await s.prisma.perfilAcesso.findUniqueOrThrow({where:{nome:'Compras'}});
  expect(await salvarUsuarioAcesso(entrada(p.id))).toEqual({ok:true});
  const u=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  expect(u.senhaDefinida).toBe(false); expect(u.emailVerificadoEm).toBeNull(); expect(await s.prisma.recuperacaoSenha.count({where:{usuarioId:u.id}})).toBe(1);expect(u.senhaHash).toMatch(/^\$2/);
  const logs=JSON.stringify(await s.prisma.historicoAcesso.findMany());expect(logs).not.toContain('senhaHash');expect(logs).not.toContain('SenhaInicialDeTeste123');
 });

 it("convite define senha e confirma e-mail atomicamente, com link de uso único",async()=>{
  const p=await perfil();expect(await salvarUsuarioAcesso(entrada(p.id))).toEqual({ok:true});
  const u=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  const token=s.enviar.mock.calls.at(-1)![1];
  expect(s.enviar.mock.calls.at(-1)![2]).toBe(true);expect(await linkRecuperacaoValido(token)).toBe(true);
  expect(await concluirRecuperacao(token,'abcdefgh!','abcdefgh!')).toHaveProperty('erro');
  expect((await s.prisma.usuario.findUniqueOrThrow({where:{id:u.id}})).senhaDefinida).toBe(false);
  expect(await concluirRecuperacao(token,'Abcdefg!','Abcdefg!')).toEqual({ok:true,email:u.email});
  const depois=await s.prisma.usuario.findUniqueOrThrow({where:{id:u.id}});
  expect(depois.senhaDefinida).toBe(true);expect(depois.emailVerificadoEm).toBeInstanceOf(Date);expect(depois.sessaoVersao).toBe(1);
  expect(await verifyPassword('Abcdefg!',depois.senhaHash)).toBe(true);expect(await linkRecuperacaoValido(token)).toBe(false);
 });
 it("falha SMTP mantém convite pendente, informa falha e permite reenvio autorizado",async()=>{
  const p=await perfil();s.enviar.mockRejectedValueOnce(Error('SMTP fictício'));
  expect(await salvarUsuarioAcesso(entrada(p.id))).toMatchObject({ok:true,aviso:expect.stringContaining('não foi enviado')});
  const u=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  expect(u.senhaDefinida).toBe(false);expect(await s.prisma.recuperacaoSenha.count()).toBe(0);
  expect(await enviarLinkSenhaUsuarioAcesso(u.id,u.updatedAt.toISOString())).toEqual({ok:true});
  expect(await s.prisma.recuperacaoSenha.count()).toBe(1);
  s.sessao.mockResolvedValue(null);expect(await enviarLinkSenhaUsuarioAcesso(u.id,u.updatedAt.toISOString())).toHaveProperty('erro');
  expect(s.enviar).toHaveBeenCalledTimes(2);
 });
 it("SMTP não configurado impede criação ativa sem fingir envio",async()=>{
  const p=await perfil();s.configurado.mockResolvedValue(false);
  expect(await salvarUsuarioAcesso(entrada(p.id))).toHaveProperty('erro');
  expect(await s.prisma.usuario.count({where:{email:'pessoa@example.invalid'}})).toBe(0);expect(s.enviar).not.toHaveBeenCalled();
 });
 it("salva somente exceções distintas e permite restaurar herança",async()=>{
  const p=await perfil();expect(await salvarUsuarioAcesso({...entrada(p.id),excecoes:{compras:{adicionar:false,editar:true}}})).toEqual({ok:true});
  const u=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  expect(u.permissoesPersonalizadas).toEqual({compras:{adicionar:false,editar:true}});
  expect(await salvarUsuarioAcesso({...entrada(p.id),id:u.id,versao:u.updatedAt.toISOString(),excecoes:{}})).toEqual({ok:true});
  expect((await s.prisma.usuario.findUniqueOrThrow({where:{id:u.id}})).permissoesPersonalizadas).toEqual({});
 });
 it("edição do perfil preserva personalizações e reflete acesso herdado",async()=>{
  const p=await perfil();await salvarUsuarioAcesso({...entrada(p.id),excecoes:{compras:{adicionar:false}}});
  expect(await salvarPerfilAcesso({id:p.id,versao:p.updatedAt.toISOString(),nome:p.nome,descricao:'',permissoes:{compras:['visualizar','editar','adicionar']}})).toEqual({ok:true});
  expect((await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}})).permissoesPersonalizadas).toEqual({compras:{adicionar:false}});
 });
 it("protege o último administrador e o perfil protegido",async()=>{
  const u=await s.prisma.usuario.findUniqueOrThrow({where:{id:'admin'}});
  expect(await alterarStatusUsuarioAcesso(u.id,u.updatedAt.toISOString(),false)).toEqual({erro:'Mantenha pelo menos um administrador ativo no sistema.'});
  expect(await excluirUsuarioAcesso(u.id,u.updatedAt.toISOString())).toHaveProperty('erro');
  expect(await salvarUsuarioAcesso({...entrada('perfil-administrador'),id:u.id,versao:u.updatedAt.toISOString(),ativo:false,email:u.email})).toHaveProperty('erro');
  const p=await s.prisma.perfilAcesso.findUniqueOrThrow({where:{id:'perfil-administrador'}});
  expect(await excluirPerfilAcesso(p.id,p.updatedAt.toISOString())).toHaveProperty('erro');
 });
 it("status direto preserva perfil, senha e exceções, revoga sessões e rejeita conflito",async()=>{
  const p=await perfil();await salvarUsuarioAcesso({...entrada(p.id),excecoes:{compras:{adicionar:false}}});
  const antes=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  expect(await alterarStatusUsuarioAcesso(antes.id,antes.updatedAt.toISOString(),false)).toEqual({ok:true});
  const depois=await s.prisma.usuario.findUniqueOrThrow({where:{id:antes.id}});
  expect(depois).toEqual({...antes,ativo:false,sessaoVersao:antes.sessaoVersao+1,updatedAt:depois.updatedAt});
  expect(await alterarStatusUsuarioAcesso(antes.id,antes.updatedAt.toISOString(),true)).toHaveProperty('erro');
  expect(await alterarStatusUsuarioAcesso(antes.id,depois.updatedAt.toISOString(),true)).toEqual({ok:true});
  expect(await s.prisma.historicoAcesso.count({where:{entidadeId:antes.id,acao:{in:['Usuário ativado','Usuário inativado']}}})).toBe(2);
 });
 it("status direto não permite ao gestor limitado alterar administrador ou ampliar alcance",async()=>{
  const p=await s.prisma.perfilAcesso.create({data:{nome:'Gestor status',permissoes:{'configuracoes.usuarios':['visualizar','editar']}}});
  await s.prisma.usuario.create({data:{id:'gestor-status',nome:'Gestor',email:'gestor-status@example.invalid',senhaHash:'sem-login',perfilAcessoId:p.id}});
  const adminAtual=await s.prisma.usuario.findUniqueOrThrow({where:{id:'admin'}});
  s.sessao.mockResolvedValue({userId:'gestor-status',versao:0});
  expect(await alterarStatusUsuarioAcesso('admin',adminAtual.updatedAt.toISOString(),false)).toEqual({erro:'Somente administradores podem alterar este usuário.'});
  s.sessao.mockResolvedValue(null);
  expect(await alterarStatusUsuarioAcesso('admin',adminAtual.updatedAt.toISOString(),false)).toEqual({erro:'Sua sessão expirou. Entre novamente.'});
 });
 it("impede gestor limitado de conceder privilégios que não possui",async()=>{
  const p=await s.prisma.perfilAcesso.create({data:{nome:'Gestor limitado',permissoes:{'configuracoes.usuarios':['visualizar','editar','adicionar'],compras:['visualizar']}}});
  await s.prisma.usuario.create({data:{id:'gestor',nome:'Gestor',email:'gestor@example.invalid',senhaHash:'sem-login',perfilAcessoId:p.id}});
  s.sessao.mockResolvedValue({userId:'gestor',versao:0});
  expect(await salvarPerfilAcesso({nome:'Escalada',descricao:'',permissoes:{compras:['visualizar','excluir']}})).toHaveProperty('erro');
  expect(await salvarUsuarioAcesso(entrada('perfil-administrador'))).toHaveProperty('erro');
 });
 it("administrador salva atender e configurar separadamente, com exceções e auditoria",async()=>{
  const permissoes={crm:['visualizar','editar'] as ('visualizar'|'editar')[],'crm.atendimento.configuracoes':['visualizar','editar'] as ('visualizar'|'editar')[]};
  expect(await salvarPerfilAcesso({nome:'Atendimento teste',descricao:'',permissoes})).toEqual({ok:true});
  const p=await s.prisma.perfilAcesso.findUniqueOrThrow({where:{nome:'Atendimento teste'}});
  expect(p.permissoes).toEqual(permissoes);
  expect(await salvarUsuarioAcesso({...entrada(p.id),excecoes:{crm:{editar:false},'crm.atendimento.configuracoes':{editar:false}}})).toEqual({ok:true});
  const u=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  expect(u.permissoesPersonalizadas).toEqual({crm:{editar:false},'crm.atendimento.configuracoes':{editar:false}});
  const registros=await s.prisma.historicoAcesso.findMany({where:{entidadeId:{in:[p.id,u.id]}}});
  expect(registros).toHaveLength(2);
  expect(JSON.stringify(registros)).not.toContain('senhaHash');
 });
 it.each<{recurso:string;acao:Acao}>([
  {recurso:'crm',acao:'editar'},
  {recurso:'crm.atendimento.mensagens',acao:'adicionar'},
  {recurso:'crm.atendimento.notas',acao:'adicionar'},
  {recurso:'crm.atendimento.agenda',acao:'editar'},
  {recurso:'crm.atendimento.duvidas',acao:'adicionar'},
  {recurso:'crm.atendimento.conhecimento',acao:'excluir'},
  {recurso:'crm.atendimento.skills',acao:'excluir'},
  {recurso:'crm.atendimento.configuracoes',acao:'editar'},
 ])("gestor sem $acao $recurso não pode conceder escrita no perfil nem no usuário",async ({recurso,acao})=>{
  const consulta:Permissoes=Object.fromEntries(RECURSOS_ATENDIMENTO.map(secao=>[secao.id,['visualizar']]));
  const permissoes={...consulta,'configuracoes.usuarios':['visualizar','adicionar','editar'] as Acao[]};
  const gestor=await s.prisma.perfilAcesso.create({data:{nome:'Gestor Atendimento limitado',permissoes}});
  await s.prisma.usuario.create({data:{id:'gestor-atendimento',nome:'Gestor fictício',email:'gestor-atendimento@example.invalid',senhaHash:'sem-login',perfilAcessoId:gestor.id}});
  const p=await s.prisma.perfilAcesso.create({data:{nome:'Consulta Atendimento',permissoes:consulta}});
  s.sessao.mockResolvedValue({userId:'gestor-atendimento',versao:0});
  const erro={erro:'Você só pode conceder ou alterar acessos que também possui.'};
  expect(await salvarPerfilAcesso({id:p.id,versao:p.updatedAt.toISOString(),nome:p.nome,descricao:'',permissoes:{...consulta,[recurso]:['visualizar',acao]}})).toEqual(erro);
  expect(await salvarUsuarioAcesso({...entrada(p.id),excecoes:{[recurso]:{[acao]:true}}})).toEqual(erro);
  expect((await s.prisma.perfilAcesso.findUniqueOrThrow({where:{id:p.id}})).permissoes).toEqual(consulta);
  expect(await s.prisma.usuario.count({where:{email:'pessoa@example.invalid'}})).toBe(0);
 });
 it("exclusão de usuário é lógica e revoga sessões",async()=>{
  const p=await perfil();await salvarUsuarioAcesso(entrada(p.id));const u=await s.prisma.usuario.findUniqueOrThrow({where:{email:'pessoa@example.invalid'}});
  expect(await excluirUsuarioAcesso(u.id,u.updatedAt.toISOString())).toEqual({ok:true});
  expect(await s.prisma.usuario.findUnique({where:{id:u.id}})).toMatchObject({ativo:false,sessaoVersao:1,excluidoEm:expect.any(Date)});
  expect(await excluirPerfilAcesso(p.id,p.updatedAt.toISOString())).toEqual({ok:true});
 });
 it("edição de perfil por gestor limitado não ativa exceções acima do seu próprio acesso",async()=>{
  const p=await s.prisma.perfilAcesso.create({data:{nome:'Perfil bloqueado',permissoes:{}}});
  await s.prisma.usuario.create({data:{nome:'Pessoa',email:'pessoa@example.invalid',senhaHash:'sem-login',perfilAcessoId:p.id,permissoesPersonalizadas:{notas:{editar:true}}}});
  const gestor=await s.prisma.perfilAcesso.create({data:{nome:'Gestor',permissoes:{'configuracoes.usuarios':['visualizar','editar'],notas:['visualizar']}}});
  await s.prisma.usuario.create({data:{id:'gestor',nome:'Gestor',email:'gestor@example.invalid',senhaHash:'sem-login',perfilAcessoId:gestor.id}});
  s.sessao.mockResolvedValue({userId:'gestor',versao:0});
  expect(await salvarPerfilAcesso({id:p.id,versao:p.updatedAt.toISOString(),nome:p.nome,descricao:'',permissoes:{notas:['visualizar']}})).toHaveProperty('erro');
  expect((await s.prisma.perfilAcesso.findUniqueOrThrow({where:{id:p.id}})).permissoes).toEqual({});
 });
 it("bloqueia exclusão de perfil em uso e edição com versão desatualizada",async()=>{
  const p=await perfil();await salvarUsuarioAcesso(entrada(p.id));expect(await excluirPerfilAcesso(p.id,p.updatedAt.toISOString())).toHaveProperty('erro');
  expect(await salvarPerfilAcesso({id:p.id,versao:'antiga',nome:p.nome,descricao:'',permissoes:{}})).toHaveProperty('erro');
 });
 it("serializa exclusões concorrentes de administradores preservando um ativo",async()=>{
  await salvarUsuarioAcesso(entrada('perfil-administrador'));const us=await s.prisma.usuario.findMany();
  const rs=await Promise.all(us.map(u=>excluirUsuarioAcesso(u.id,u.updatedAt.toISOString())));
  expect(rs.filter(r=>'ok'in r)).toHaveLength(1);expect(await s.prisma.usuario.count({where:{ativo:true,admin:true}})).toBe(1);
 });
 it("DTO de leitura não envia hashes, fotos nem dados brutos de auditoria",async()=>{
  const dados=await carregarAcessos();expect(dados).toHaveProperty('usuarios');expect(JSON.stringify(dados)).not.toContain('senhaHash');expect(JSON.stringify(dados)).not.toContain('sem-acesso-real');
 });
});
