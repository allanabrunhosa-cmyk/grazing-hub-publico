import { beforeEach, describe, expect, it, vi } from "vitest";
const s=vi.hoisted(()=>({ usuario:vi.fn(), token:vi.fn() }));
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>({value:"token"})})}));
vi.mock("@/lib/session-token",()=>({SESSION_COOKIE_NAME:"sessao",verifySessionToken:s.token}));
vi.mock("@/lib/prisma",()=>({prisma:{usuario:{findUnique:s.usuario}}}));
import {getSession} from "@/lib/session";
beforeEach(()=>{vi.resetAllMocks();s.token.mockResolvedValue({userId:"u",admin:true});s.usuario.mockResolvedValue({id:"u",nome:"Atual",email:"atual@example.invalid",ativo:true,senhaDefinida:true,sessaoVersao:0,perfilAcesso:{sistema:null,nome:"Leitura",permissoes:{compras:["visualizar"]}},permissoesPersonalizadas:{}});});
describe("sessão com permissões atuais",()=>{
 it("ignora o admin antigo do cookie e relê o perfil no banco",async()=>expect(await getSession()).toMatchObject({admin:false,nome:"Atual",perfilNome:"Leitura"}));
 it("inativar usuário revoga acesso mesmo com token ainda válido",async()=>{s.usuario.mockResolvedValue({ativo:false});expect(await getSession()).toBeNull();});
 it("redefinir senha revoga tokens de versões anteriores",async()=>{s.usuario.mockResolvedValue({ativo:true,sessaoVersao:1});expect(await getSession()).toBeNull();});
 it("não consulta usuário sem token verificado",async()=>{s.token.mockResolvedValue(null);expect(await getSession()).toBeNull();expect(s.usuario).not.toHaveBeenCalled();});
});

it("convite pendente não aceita token anterior",async()=>{s.usuario.mockResolvedValue({ativo:true,senhaDefinida:false,sessaoVersao:0});expect(await getSession()).toBeNull();});
