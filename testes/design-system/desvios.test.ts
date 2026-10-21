import { describe, expect, it } from "vitest";
import { analisarDesign } from "../../scripts/regras-design.mjs";

const analisar = (codigo: string) => analisarDesign("src/app/exemplo.tsx", codigo).map((p: { regra: string }) => p.regra);
describe("proteções permanentes de design", () => {
  it("exige o campo decimal compartilhado nas futuras telas e mantém inteiros", () => {
    for (const campo of ['<Input type="number" step="0.001" />', '<InputComSufixo type="number" inputMode="decimal" />', '<Texto type="number" step="any" />']) expect(analisar(campo)).toContain("decimal-localizado");
    expect(analisar('<Input inputMode="decimal" casasDecimais={3} maxLength={13} />')).toEqual([]);
    expect(analisar('<Input type="number" step={1} />')).toEqual([]);
    expect(analisar('<Input type="number" step={2} />')).toEqual([]);
  });
  it("detecta lápis avulso, inclusive importado com alias", () => {
    expect(analisar('import { Pencil as Editar } from "lucide-react"; const ui = <Button size="icon-sm"><Editar /></Button>;')).toContain("acao-duplicada");
    expect(analisar('const ui = <button aria-label="Excluir"><Trash2 /></button>;')).toContain("acao-duplicada");
  });
  it("detecta regressão de tamanho/círculo/cor da ação oficial", () => {
    for (const classe of ["size-7", "h-8", "rounded-md", "bg-yellow-100", "md:w-6"]) {
      expect(analisar(`<Button variant="editar" className="${classe}" />`)).toContain("acao-geometria");
    }
  });
  it("detecta cor de marca avulsa no botão", () => {
    expect(analisar('<Button className="bg-[#ff0000]">Salvar</Button>')).toContain("cor-avulsa");
    expect(analisar('<Button style={{ backgroundColor: "#123456" }}>Salvar</Button>')).toContain("cor-avulsa");
  });
  it("preserva layout, ações principais com texto, conteúdo e constantes de negócio", () => {
    expect(analisar('const fiscal = "#123456"; const zpl = "^PW480"; const ui = <><Button variant="editar" className="ml-auto col-span-2" /><Button variant="destructive" size="sm"><Trash2 />Excluir pedido</Button><span style={{width:60}}>60×40</span></>;')).toEqual([]);
  });
  it("protege variantes dentro do render de diálogos sem confundir dimensões dos ícones", () => {
    expect(analisar('<DialogTrigger render={<Button variant="editar" />}><Pencil className="size-4" /></DialogTrigger>')).toEqual([]);
  });
});
