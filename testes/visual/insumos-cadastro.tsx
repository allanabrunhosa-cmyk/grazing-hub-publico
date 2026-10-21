import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { InsumoForm } from "@/app/(protegido)/insumos/insumo-form";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { insumoStatus } from "../cadastros/dados";
import "@/app/globals.css";

const categorias = [{ id: "hortifruti", nome: "Hortifruti" }, { id: "bases", nome: "Bases e molhos" }];
const centrosCusto = [{ id: "cozinha", nome: "Cozinha" }];
const fornecedores = [{ id: "fornecedor-ficticio", nome: "Distribuidora Exemplo" }];
const cenas = ["sem-foto", "com-foto", "preparacao"] as const;
type Cena = typeof cenas[number];
const rotulos: Record<Cena, string> = { "sem-foto": "Insumo sem foto", "com-foto": "Insumo com foto", preparacao: "Preparação" };

function dadosDaCena(cena: Cena): InsumoRow {
  const preparacao = cena === "preparacao";
  return {
    ...insumoStatus,
    id: preparacao ? "preparacao-ficticia" : "abobrinha-ficticia",
    nome: preparacao ? "Molho da casa" : "Abobrinha",
    especificacao: preparacao ? "Receita própria · lote fictício" : "Fresca, tamanho médio",
    tipo: preparacao ? "PRODUTO_INTERMEDIARIO" : "INSUMO",
    temFoto: cena === "com-foto",
    marcasHomologadas: [],
    categoria: preparacao ? categorias[1] : categorias[0],
    centroCusto: centrosCusto[0],
    observacoes: preparacao ? "Preparação específica da empresa. Foto adicionada manualmente." : null,
    rendimentoQuantidade: preparacao ? 1 : null,
    rendimentoUnidade: preparacao ? "KG" : null,
    componentes: preparacao ? [{ componenteId: "abobrinha", nome: "Abobrinha", tipo: "INSUMO", unidade: "KG", quantidade: 1, custoUnitario: 5, observacaoPorcao: null }] : [],
  };
}

function PreviaCadastroInsumos() {
  const parametros = new URLSearchParams(location.search);
  const cenaInicial = parametros.get("cena");
  const [cena, definirCena] = useState<Cena>(cenas.includes(cenaInicial as Cena) ? cenaInicial as Cena : "sem-foto");
  const [dialogoAberto, definirDialogoAberto] = useState(parametros.has("dialogo"));

  const formulario = <InsumoForm key={cena} insumo={dadosDaCena(cena)} categorias={categorias} centrosCusto={centrosCusto}
    categoriasFinanceiras={[{ id: "cmv-hortifruti", nome: "Insumos › Hortifruti", grupo: "CMV" }]}
    fornecedores={fornecedores} todosInsumos={[{ id: "abobrinha", nome: "Abobrinha", tipo: "INSUMO", unidade: "KG", custoUnitario: 5 }]}
    podeCadastrarFornecedor podeCadastrarInsumo podeConfigurarEtiqueta
    renderFooter={({ pending }) => <DialogFooter><Button type="submit" disabled={pending}>Salvar cadastro simulado</Button></DialogFooter>} />;

  return <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Cadastro de insumos</h1>
        <p className="text-sm text-muted-foreground">Dados fictícios, imagem ilustrativa e ações simuladas. Nenhuma gravação no banco.</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Cenas da prévia">
        {cenas.map(opcao => <Button key={opcao} type="button" size="sm" variant={cena === opcao ? "default" : "outline"}
          onClick={() => definirCena(opcao)}>{rotulos[opcao]}</Button>)}
        <Button type="button" size="sm" variant="outline" onClick={() => definirDialogoAberto(true)}>Abrir no diálogo</Button>
      </div>
      {!dialogoAberto && formulario}
      <Dialog open={dialogoAberto} onOpenChange={definirDialogoAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{cena === "preparacao" ? "Editar Preparação" : "Editar Insumo"}</DialogTitle>
            <DialogDescription>Prévia isolada do formulário com dados fictícios.</DialogDescription>
          </DialogHeader>
          {dialogoAberto && formulario}
        </DialogContent>
      </Dialog>
      <Toaster />
    </main>
  </ProvedorAcesso>;
}

createRoot(document.getElementById("root")!).render(<PreviaCadastroInsumos />);
