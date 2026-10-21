"use client";
import type { DadosProdutos, DadosCatalogo } from "@/lib/vendas/consultas";
import { classificacaoComercial } from "@/lib/vendas/classificacao";
import { disponibilidadeDoCadastro } from "@/lib/vendas/disponibilidade";
import { precoObrigatorioNaConfiguracao, type ProdutoEntrada, type GrupoEntrada } from "@/lib/vendas/dominio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vazio } from "../componentes";

export function DisponibilidadeCadastro({ produto, dados }: { produto: ProdutoEntrada; dados: DadosProdutos }) {
  const produtos = [...dados.produtos.filter(p => p.id !== produto.id), produto];
  const linhas = produto.id ? disponibilidadeDoCadastro(produto.id, produtos, dados.grupos) : [];
  const avulso = classificacaoComercial(produto) === "PRINCIPAL";
  const precoValido = Number(produto.preco) > 0 || precoObrigatorioNaConfiguracao(dados.grupos, produto.grupos);
  return <div className="space-y-4">
    <div className="space-y-2"><h3 className="text-sm font-semibold">Venda avulsa no site</h3><p className="text-sm text-muted-foreground">{!avulso ? "Complemento: disponível somente dentro de um produto." : !produto.ativo ? "Produto inativo." : !precoValido ? "Informe um preço ou uma escolha obrigatória paga para habilitar a venda." : "Produto habilitado no cadastro para venda avulsa."}</p>
      {avulso && <p className="text-sm text-muted-foreground">Categorias do site: {dados.categorias.filter(c => produto.categorias.includes(c.id) && (c.escopo ?? "PRODUTO") === "PRODUTO").map(c => c.nome + (c.ativo ? "" : " (inativa)")).join(", ") || "Sem categoria"}.</p>}
    </div>
    <h3 className="text-sm font-semibold">Grupos e produtos onde está cadastrado</h3>
    {linhas.length ? <Table><TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead>Produto</TableHead><TableHead>Disponibilidade</TableHead><TableHead>Composição</TableHead></TableRow></TableHeader><TableBody>{linhas.map(l => <TableRow key={`${l.grupoId}:${l.opcaoId}:${l.produtoId}`}><TableCell className="whitespace-normal">{l.grupoNome}</TableCell><TableCell className="whitespace-normal">{l.produtoNome}</TableCell><TableCell className="whitespace-normal">{l.motivo}</TableCell><TableCell className="whitespace-normal">{l.composicao}</TableCell></TableRow>)}</TableBody></Table> : <Vazio>{produto.id ? "Este cadastro ainda não pertence a um grupo." : "Salve o cadastro para consultar seus vínculos."}</Vazio>}
  </div>;
}

export function DisponibilidadeGrupo({ grupo, produtos }: { grupo: GrupoEntrada; produtos: DadosCatalogo["produtos"] }) {
  const destinos = produtos.filter(p => p.grupos.some(v => v.grupoId === grupo.id));
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">O grupo organiza as escolhas dentro dos produtos. A ordem e os limites são definidos em cada produto.</p>
    {grupo.id && destinos.length ? <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Disponibilidade</TableHead></TableRow></TableHeader><TableBody>{destinos.map(p => <TableRow key={p.id}><TableCell className="whitespace-normal">{p.nome}</TableCell><TableCell>{!grupo.ativo ? "Grupo inativo" : !p.ativo ? "Produto inativo" : "Vinculado"}</TableCell></TableRow>)}</TableBody></Table> : <Vazio>{grupo.id ? "Este grupo ainda não está vinculado a produtos." : "Salve o grupo para consultar seus vínculos."}</Vazio>}
  </div>;
}
