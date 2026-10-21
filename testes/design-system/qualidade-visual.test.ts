import { describe, expect, it } from "vitest";
import { analisarDesign, analisarQualidadeVisual } from "../../scripts/regras-design.mjs";

const imports = `import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";`;
const analisar = (codigo: string, arquivo = "src/app/exemplo.tsx") => analisarQualidadeVisual(arquivo, `${imports}\n${codigo}`);
const regras = (codigo: string) => analisar(codigo).map((p: { regra: string }) => p.regra);

describe("qualidade visual incremental baseada nos componentes reais", () => {
  it.each(["button", "input", "select", "textarea"])("cobra reutilização para %s nativo", nome => {
    expect(regras(`const ui = <${nome} />`)).toContain("controle-nativo");
  });

  it("preserva primitives oficiais e input oculto usado na submissão", () => {
    expect(analisar('<button className="bg-red-500" />', "src/components/ui/button.tsx")).toEqual([]);
    expect(analisar('<textarea />', "C:\\repo\\src\\components\\ui\\textarea.tsx")).toEqual([]);
    expect(regras('const ui = <input type="hidden" name="id" value="sintetico" />')).toEqual([]);
  });

  it("reconhece aliases e namespaces oficiais sem confundir bibliotecas externas", () => {
    const codigo = `import { Button as Acao } from "@/components/ui/button";
      import * as Botoes from "@/components/ui/button";
      const ui = <><Acao className="bg-[#ff0000]">Abrir</Acao><Botoes.Button className="bg-blue-500">Abrir</Botoes.Button></>;`;
    expect(regras(codigo).filter((r: string) => r === "cor-local-em-botao")).toHaveLength(2);
    expect(analisarQualidadeVisual("src/app/exemplo.tsx", 'import { Button } from "biblioteca-externa"; const ui = <Button className="bg-red-500" />;')).toEqual([]);
  });

  it("reconhece os campos oficiais por alias/namespace e protege decimal aliasado", () => {
    const codigo = `import { Input as Campo } from "@/components/ui/input";
      import * as Campos from "@/components/ui/input";
      import { SelectTrigger as Escolher } from "@/components/ui/select";
      import * as Textos from "@/components/ui/textarea";
      const ui = <><Campo type="number" step="0.001" /><Campos.Input type="number" step="any" /><Escolher /><Textos.Textarea /></>;`;
    expect(regras(codigo)).toEqual(["decimal-localizado", "decimal-localizado"]);
  });

  it("resolve imports relativos ao arquivo em vez de presumir ui oficial pelo sufixo", () => {
    expect(regras('import { Button as Acao } from "../components/ui/button"; const ui = <Acao className="bg-red-500">Abrir</Acao>;')).toContain("cor-local-em-botao");
    expect(analisarQualidadeVisual("src/app/exemplo.tsx", 'import { Button } from "./ui/button"; const ui = <Button className="bg-red-500">Abrir</Button>;')).toEqual([]);
  });

  it("respeita bindings locais que sombreiam imports e constantes de outro escopo", () => {
    expect(regras('function Exemplo(Button: any) { return <Button className="bg-red-500" />; }')).toEqual([]);
    expect(regras('const classe = "bg-red-500"; function Exemplo(classe: string) { return <Button className={classe}>Abrir</Button>; }')).toEqual([]);
  });

  it.each(["bg-red-500", "dark:hover:bg-blue-600/90", "text-emerald-700", "border-[#123456]", "bg-[rgb(255,0,0)]", "bg-[color:#123456]"])("detecta cor local %s", classe => {
    expect(regras(`<Button className="${classe}">Abrir</Button>`)).toContain("cor-local-em-botao");
  });

  it("resolve const, cn aliasado, concatenação e template estático", () => {
    const codigo = `import { cn as juntar } from "cn";
      const familia = "blue";
      const classe = \`bg-\${familia}-500\`;
      const borda = "border-" + "red-600";
      const ui = <Button className={juntar("ml-auto", classe, borda)}>Abrir</Button>;`;
    expect(regras(codigo)).toContain("cor-local-em-botao");
  });

  it("inspeciona ramos possíveis de cn e ignora ramos estaticamente falsos", () => {
    expect(regras('const ui = <Button className={cn("ml-auto", ativo && "bg-red-500")}>Abrir</Button>;')).toContain("cor-local-em-botao");
    expect(regras('const ui = <Button className={cn("ml-auto", false && "bg-red-500")}>Abrir</Button>;')).toEqual([]);
    expect(regras('const ui = <Button className={cn({ "bg-red-500": ativo })}>Abrir</Button>;')).toContain("cor-local-em-botao");
  });

  it("resolve estilo const e chaves computadas sem inspecionar constantes de negócio", () => {
    expect(regras('const propriedade = "backgroundColor"; const estilo = { [propriedade]: "#123456" }; const ui = <Button style={estilo}>Abrir</Button>;')).toContain("cor-local-em-botao");
    expect(regras('const fiscal = "#123456"; const zpl = "^PW480"; const ui = <Button style={{ width: 60 }}>Abrir</Button>;')).toEqual([]);
  });

  it("preserva tokens, layout e geometria interna dos ícones", () => {
    expect(regras('<Button variant="editar" aria-label="Editar item" className="ml-auto col-span-2 [&_svg]:size-4" />')).toEqual([]);
    expect(regras('<Button className="bg-[var(--primary)] text-primary-foreground">Abrir</Button>')).toEqual([]);
  });

  it.each(["h-12", "md:size-8", "rounded-md", "px-3", "text-blue-500"])("protege geometria/cor compacta %s", classe => {
    expect(regras(`<Button variant="editar" aria-label="Editar item" className="${classe}" />`)).toContain("geometria-acao-compacta");
  });

  it("reproduz a compactação real por rótulo mesmo com outra variante", () => {
    expect(regras('<Button variant="destructive" className="h-12">Excluir pedido</Button>')).toContain("geometria-acao-compacta");
    expect(regras('<Button variant="outline" aria-label="Remover item" className="rounded-md">Ação</Button>')).toContain("geometria-acao-compacta");
  });

  it("exige contexto nas ações compactas com fallback genérico", () => {
    for (const codigo of ['<Button variant="editar" />', '<Button variant="excluir" />', '<Button variant="editar">Editar item</Button>', '<Button variant="excluir" aria-label="Excluir" />']) {
      expect(regras(codigo)).toContain("acao-compacta-sem-contexto");
    }
    for (const codigo of ['<Button variant="editar" aria-label="Editar item" />', '<Button variant="excluir">Excluir pedido</Button>', '<Button variant="editar" aria-label={nomeDoItem} />', '<Button variant="editar" aria-labelledby="nome-item" />', '<Button variant="editar" title="Editar item" />']) {
      expect(regras(codigo)).toEqual([]);
    }
  });

  it("exige nome nos botões só de ícone e aceita texto oculto contextual", () => {
    expect(regras('<Button size="icon" />')).toContain("acao-compacta-sem-nome");
    expect(regras('<Button size="icon"><span className="sr-only">Abrir detalhes do item</span></Button>')).toEqual([]);
    expect(regras('<Button size="icon" aria-label="" />')).toContain("acao-compacta-sem-nome");
  });

  it("reconhece ícones aninhados, imports aliasados e namespaces", () => {
    const codigo = `import { Pencil as Lapiz } from "lucide-react";
      import * as Icones from "lucide-react";
      const ui = <><Button size="icon" aria-label="Editar item"><span><Lapiz /></span></Button><Button size="icon" aria-label="Apagar item"><Icones.Trash2 /></Button></>;`;
    expect(regras(codigo)).toEqual(["acao-compacta-duplicada", "acao-compacta-duplicada"]);
  });

  it("cobra semântica só para Confirmar literal sem variante semântica", () => {
    for (const variante of [undefined, "default", "outline", "ghost", "secondary"]) {
      expect(regras(`<Button ${variante ? `variant="${variante}"` : ""}>Confirmar</Button>`)).toContain("confirmacao-sem-semantica");
    }
    for (const variante of ["entrada", "entrada-outline", "saida", "saida-outline", "destructive"]) {
      expect(regras(`<Button variant="${variante}">Confirmar</Button>`)).toEqual([]);
    }
  });

  it("preserva salvar laranja, cancelar, intenção dinâmica e contratos existentes", () => {
    for (const codigo of ['<Button variant="salvar">Salvar</Button>', '<Button variant="default">Salvar alterações</Button>', '<Button variant="outline">Concluir</Button>', '<Button variant="ghost">Cancelar</Button>', '<Button variant={destrutiva ? "saida" : "entrada"}>Confirmar</Button>', '<Button>{pendente ? "Confirmando" : "Confirmar"}</Button>']) {
      expect(regras(codigo)).toEqual([]);
    }
  });

  it("não presume props sobrescritas por spread e verifica atributos posteriores", () => {
    expect(regras('<Button variant="outline" {...props}>Confirmar</Button>')).toEqual([]);
    expect(regras('<Button {...props} variant="outline">Confirmar</Button>')).toContain("confirmacao-sem-semantica");
    expect(regras('<Button size="icon" {...props} />')).toEqual([]);
  });

  it("mantém identidade quando linhas/ordem de atributos mudam e diferencia alterações", () => {
    const a = analisar('<Button variant="editar" className="h-12" />').find((p: { regra: string }) => p.regra === "geometria-acao-compacta");
    const b = analisar('\n\n<Button\n className="h-12"\n variant="editar" />').find((p: { regra: string }) => p.regra === "geometria-acao-compacta");
    const c = analisar('<Button variant="editar" className="h-14" />').find((p: { regra: string }) => p.regra === "geometria-acao-compacta");
    expect(a?.identidade).toBe(b?.identidade);
    expect(a?.linha).not.toBe(b?.linha);
    expect(a?.identidade).not.toBe(c?.identidade);
  });

  it("mantém a API e os resultados legados independentes da auditoria incremental", () => {
    const codigo = 'const ui = <Button variant="editar" className="ml-auto" />;';
    expect(analisarDesign("src/app/exemplo.tsx", codigo)).toEqual([]);
    expect(regras(codigo)).toContain("acao-compacta-sem-contexto");
  });

  it("muda identidade ao alterar cores em constantes parcialmente dinâmicas", () => {
    const a = analisar('const classe = cn(ativo && "bg-red-500"); const ui = <Button className={classe}>Abrir</Button>;')[0];
    const b = analisar('const classe = cn(ativo && "bg-blue-500"); const ui = <Button className={classe}>Abrir</Button>;')[0];
    expect(a?.identidade).not.toBe(b?.identidade);
  });
});
