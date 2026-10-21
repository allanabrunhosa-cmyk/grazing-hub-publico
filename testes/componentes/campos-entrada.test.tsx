// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { aceitaEdicaoCampo, completarZeroDecimal } from "@/lib/campos-entrada";
afterEach(cleanup);
function Campo() { const [v,s]=useState("1,501");return <Input aria-label="km" inputMode="decimal" restricao="decimal" casasDecimais={3} maxLength={8} min={0} value={v} onChange={e=>s(e.target.value)}/>; }
describe("Delimitação compartilhada de campos",()=>{
 it("rejeita letra, expoente, sinal indevido, excesso de casas e tamanho sem arredondar",()=>{render(<Campo/>);const el=screen.getByRole("textbox") as HTMLInputElement;for(const v of ["letra","1e3","-1","1,5019","123456789"]){fireEvent.change(el,{target:{value:v}});expect(el.value).toBe("1,501");}fireEvent.change(el,{target:{value:"0,001"}});expect(el.value).toBe("0,001");expect(fireEvent.keyDown(el,{key:"a"})).toBe(false);});
 it("valida colagem e preserva atalhos/edição parcial",()=>{render(<Campo/>);const el=screen.getByRole("textbox") as HTMLInputElement;el.setSelectionRange(0,el.value.length);expect(fireEvent.paste(el,{clipboardData:{getData:()=>"1km"}})).toBe(false);expect(fireEvent.paste(el,{clipboardData:{getData:()=>"7,125"}})).toBe(true);expect(fireEvent.keyDown(el,{key:"a",ctrlKey:true})).toBe(true);fireEvent.change(el,{target:{value:""}});expect(el.value).toBe("");});
 it("preserva precisão monetária e máscaras existentes, limita texto",()=>{expect(aceitaEdicaoCampo("1.234,56","mascara-numerica",40)).toBe(true);expect(aceitaEdicaoCampo("(11) 99999-8888","mascara-numerica",40)).toBe(true);expect(aceitaEdicaoCampo("01234-567","mascara-numerica",9)).toBe(true);expect(aceitaEdicaoCampo("abc01234567","mascara-numerica",40)).toBe(false);expect(aceitaEdicaoCampo("0.123456789012345678","decimal",40)).toBe(true);render(<Input aria-label="nome" maxLength={3}/>);const el=screen.getByRole("textbox");fireEvent.change(el,{target:{value:"abc"}});fireEvent.change(el,{target:{value:"abcd"}});expect((el as HTMLInputElement).value).toBe("abc");});
 it("inteiro bloqueia fração e decimal mantém consumidores numéricos",()=>{expect(aceitaEdicaoCampo("1.2","inteiro")).toBe(false);expect(aceitaEdicaoCampo("1.2","decimal")).toBe(true);const f=vi.fn();render(<Input type="number" aria-label="inteiro" min={0} onChange={f}/>);expect(fireEvent.keyDown(screen.getByRole("spinbutton"),{key:"e"})).toBe(false);expect(fireEvent.keyDown(screen.getByRole("spinbutton"),{key:"-"})).toBe(false);});
});
describe("Remoção oficial",()=>{
 it.each(["Remover faixa","Excluir registro","Retirar item"])("%s mantém ação e nome acessível, exibe somente X",nome=>{const acao=vi.fn();render(<Button variant="outline" onClick={acao}>{nome}</Button>);const b=screen.getByRole("button",{name:nome});expect(b.textContent).toBe("");expect(b.querySelector("svg.lucide-x")).toBeTruthy();expect(b.className).toContain("bg-destructive");expect(b.className).toContain("hover:bg-destructive/15");expect(b.className).not.toContain("text-muted-foreground");fireEvent.click(b);expect(acao).toHaveBeenCalledTimes(1);});
 it("mantém outras ações e confirmações sem convertê-las",()=>{render(<Button>Confirmar cancelamento</Button>);expect(screen.getByRole("button").textContent).toBe("Confirmar cancelamento");});
});

it.each([[",5", "0,5"], [".125", "0.125"], ["-,5", "-0,5"], [",", "0,"], ["1,5", "1,5"], ["1.234,56", "1.234,56"], ["abc", "abc"]])("zero decimal: %s → %s sem converter nem arredondar", (entrada, resultado) => {
 expect(completarZeroDecimal(entrada)).toBe(resultado);
});

describe("Atalho decimal em todo Input", () => {
 it("completa zero durante digitação controlada e preserva o cursor", async () => {
  render(<Campo />); const u=userEvent.setup(), campo=screen.getByRole("textbox") as HTMLInputElement;
  await u.clear(campo); await u.type(campo, ",5"); expect(campo.value).toBe("0,5"); expect(campo.selectionStart).toBe(3);
  await u.type(campo,"2"); expect(campo.value).toBe("0,52");
  campo.setSelectionRange(0,1); await u.keyboard("{Backspace}"); expect(campo.value).toBe("0,52");
 });
 it("normaliza colagem, envio não controlado e negativos permitidos sem perder precisão", async () => {
  const u=userEvent.setup(); const {container}=render(<form><Input aria-label="Decimal" name="decimal" inputMode="decimal" casasDecimais={18}/></form>);
  const campo=screen.getByRole("textbox") as HTMLInputElement; await u.click(campo); await u.paste(",123456789012345678");
  expect(campo.value).toBe("0,123456789012345678"); expect(new FormData(container.querySelector("form")!).get("decimal")).toBe(campo.value);
  await u.clear(campo); await u.type(campo,"-,5"); expect(campo.value).toBe("-0,5");
 });
 it("conta o zero acrescentado no limite e não normaliza texto, máscaras nem inteiros", () => {
  const f=vi.fn(); render(<Input aria-label="Curto" inputMode="decimal" maxLength={3} casasDecimais={2} onChange={f}/>);
  const campo=screen.getByRole("textbox") as HTMLInputElement; fireEvent.change(campo,{target:{value:",55"}}); expect(f).not.toHaveBeenCalled(); expect(campo.value).toBe("");
  campo.setSelectionRange(0,0); expect(fireEvent.paste(campo,{clipboardData:{getData:()=>",55"}})).toBe(false);
  cleanup(); render(<Input defaultValue="" />); fireEvent.change(screen.getByRole("textbox"),{target:{value:",5"}}); expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(",5");
  cleanup(); render(<Input inputMode="numeric" />); fireEvent.change(screen.getByRole("textbox"),{target:{value:"01234-567"}}); expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("01234-567");
 });
});
