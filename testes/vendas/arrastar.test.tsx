// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ListaOrdenavel } from "@/app/(protegido)/vendas/lista-ordenavel";
afterEach(cleanup);
function Lista({ salvar, disabled = false }: { salvar: (v:string[]) => void; disabled?:boolean }) { const [itens,set] = useState(["A","B","C"]); return <ListaOrdenavel itens={itens} chave={v=>v} nome={v=>v} mudar={v=>{set(v);salvar(v);}} disabled={disabled}>{(v,_,alca)=><div>{alca}<span>{v}</span></div>}</ListaOrdenavel>; }
describe("arrastar listas comerciais",()=>{
  it("reordena com teclado, confirma e permite cancelar",()=>{
    const salvar=vi.fn();render(<Lista salvar={salvar}/>);
    const alca=screen.getByRole("button",{name:"Arrastar A"});
    fireEvent.keyDown(alca,{key:" "});fireEvent.keyDown(alca,{key:"ArrowDown"});expect(salvar).not.toHaveBeenCalled();fireEvent.keyDown(alca,{key:"Enter"});
    expect(salvar).toHaveBeenCalledWith(["B","A","C"]);
    fireEvent.keyDown(alca,{key:" "});fireEvent.keyDown(alca,{key:"ArrowDown"});fireEvent.keyDown(alca,{key:"Escape"});expect(salvar).toHaveBeenCalledTimes(1);
  });
  it("arrasta com ponteiro e não oferece alça sem permissão",()=>{
    const salvar=vi.fn();const r=render(<Lista salvar={salvar}/>);
    const alca=screen.getByRole("button",{name:"Arrastar A"});
    const raiz = r.container.firstElementChild as HTMLDivElement;
    raiz.setPointerCapture = vi.fn();
    const antigo=window.PointerEvent;window.PointerEvent=MouseEvent as typeof PointerEvent;
    const alvo=screen.getByRole("button",{name:"Arrastar C"});Object.defineProperty(document,"elementFromPoint",{configurable:true,value:()=>alvo});
    fireEvent.pointerDown(alca,{button:0,pointerId:1});fireEvent.pointerMove(raiz,{clientX:10,clientY:100});fireEvent.pointerUp(raiz);
    expect(raiz.setPointerCapture).toHaveBeenCalledOnce();
    expect(salvar).toHaveBeenCalledWith(["B","C","A"]);window.PointerEvent=antigo;
    r.rerender(<Lista salvar={salvar} disabled/>);expect(screen.queryByRole("button")).toBeNull();
    Reflect.deleteProperty(document, "elementFromPoint");
  });
});
