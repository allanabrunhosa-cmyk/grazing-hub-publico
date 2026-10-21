// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import type {ComponentProps} from "react";
import {ProvedorAcesso} from "@/components/layout/acesso-contexto";
import {ConteudoMenuLateral} from "@/components/layout/sidebar";
vi.mock("next/navigation",()=>({usePathname:()=>"/financeiro/cartoes/faturas/f"}));
vi.mock("next/link",()=>({default:(p:ComponentProps<"a">)=><a {...p}/>}));
afterEach(cleanup);
it("agrupa contas, cartões e faturas, recolhe com teclado e respeita ACL",()=>{render(<ProvedorAcesso acesso={{admin:false,permissoes:{"financeiro.faturas":["visualizar"]},excecoes:{}}}><ConteudoMenuLateral/></ProvedorAcesso>);expect(screen.getByRole("link",{name:"Bancos"}).getAttribute("href")).toBe("/financeiro/cartoes");expect(screen.getByRole("link",{name:"Faturas"}).getAttribute("aria-current")).toBe("page");expect(screen.queryByRole("link",{name:"Contas e cartões"})).toBeNull();fireEvent.keyDown(screen.getByRole("button",{name:"Recolher Bancos"}),{key:"Escape"});expect(screen.queryByRole("link",{name:"Faturas"})).toBeNull();});
it("admin acessa as duas áreas pelo mesmo agrupamento",()=>{render(<ProvedorAcesso acesso={{admin:true,permissoes:{},excecoes:{}}}><ConteudoMenuLateral/></ProvedorAcesso>);expect(screen.getByRole("link",{name:"Contas e cartões"})).toBeTruthy();expect(screen.getByRole("link",{name:"Faturas"})).toBeTruthy();expect(screen.queryByRole("link",{name:"Cartões e Faturas"})).toBeNull();});
