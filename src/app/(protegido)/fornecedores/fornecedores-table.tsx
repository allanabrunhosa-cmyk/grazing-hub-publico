"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight, Truck, UserRound } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FornecedorActionsCell } from "@/app/(protegido)/fornecedores/fornecedor-actions-cell";
import type { FornecedorRow, SimpleOption } from "@/app/(protegido)/fornecedores/types";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import { alterarStatusFornecedorAction } from "../status-cadastros-actions";
import { FornecedorDetalhes } from "./fornecedor-detalhes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarCpfCnpj } from "@/lib/documento-brasileiro";
import { useAcesso } from "@/components/layout/acesso-contexto";

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

export function FornecedoresTable({
  fornecedores,
  canaisPedidoOptions,
  formasPagamentoOptions,
  entidadeInicialId,
}: {
  fornecedores: FornecedorRow[];
  canaisPedidoOptions: SimpleOption[];
  formasPagamentoOptions: SimpleOption[];
  entidadeInicialId?: string;
}) {
  const cadastroInicial = fornecedores.find(f => f.id === entidadeInicialId);
  const inicialId = cadastroInicial?.id;
  const [query, setQuery] = useState("");
  const { pode } = useAcesso();
  const editar = pode("fornecedores", "editar");
  const [expandidoId, setExpandidoId] = useState<string | null>(inicialId ?? null);
  const [tipoCadastro, setTipoCadastro] = useState<"FORNECEDOR" | "BENEFICIARIO">(cadastroInicial?.tipoCadastro ?? "FORNECEDOR");
  useEffect(() => {
    if (!inicialId) return;
    const botao = document.getElementById(`expansao-fornecedor-${inicialId}`);
    botao?.scrollIntoView?.({ block: "center" });
    botao?.focus({ preventScroll: true });
  }, [inicialId]);

  function alternarLinha(id: string) {
    setExpandidoId((atual) => atual === id ? null : id);
  }
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATIVOS" | "INATIVOS">("TODOS");
  const [ordenacao, setOrdenacao] = useState<{ coluna: "nome" | "cnpj" | "status"; direcao: "asc" | "desc" } | null>(null);

  function alternarOrdenacao(coluna: "nome" | "cnpj" | "status") {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const CHAVE_ORDENACAO: Record<"nome" | "cnpj" | "status", (f: FornecedorRow) => string> = {
    nome: (f) => f.nome,
    cnpj: (f) => f.cpf ?? f.cnpj ?? "",
    status: (f) => (f.ativo ? "0" : "1"),
  };

  const encontrados = useMemo(() => {
    const termo = normalizar(query.trim());

    const resultado = fornecedores.filter((f) => {
      if (!termo) return true;
      const alvo = normalizar(
        [f.nome, f.razaoSocial, f.cpf, f.cnpj, f.email ?? "", f.contatoNome ?? "", f.telefone ?? ""].join(" ")
      );
      return alvo.includes(termo);
    });

    return resultado;
  }, [query, fornecedores]);

  const doTipo = encontrados.filter(f => f.tipoCadastro === tipoCadastro);
  const filtrados = useMemo(() => {
    const resultado = encontrados.filter(f => f.tipoCadastro === tipoCadastro &&
      (filtroStatus === "TODOS" || f.ativo === (filtroStatus === "ATIVOS")));
    if (!ordenacao) return resultado;
    const extrair = CHAVE_ORDENACAO[ordenacao.coluna];
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => sinal * extrair(a).localeCompare(extrair(b), "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encontrados, filtroStatus, ordenacao, tipoCadastro]);

  const ativosFornecedores = fornecedores.filter((item) => item.tipoCadastro === "FORNECEDOR" && item.ativo).length;
  const ativosBeneficiarios = fornecedores.filter((item) => item.tipoCadastro === "BENEFICIARIO" && item.ativo).length;
  const beneficiarios = tipoCadastro === "BENEFICIARIO";

  return (
    <Tabs value={tipoCadastro} onValueChange={(valor) => { setTipoCadastro(valor as typeof tipoCadastro); setExpandidoId(null); }}>
      <Card className="gap-4 py-4">
        <div className="flex flex-wrap items-center gap-2 px-4">
          <CampoBusca
            value={query}
            onChange={setQuery}
            placeholder={beneficiarios ? "Buscar por nome, CPF, CNPJ ou telefone..." : "Buscar por nome, CNPJ, e-mail..."}
          />
          <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={filtroStatus === "TODOS" ? "default" : "outline"}
            onClick={() => setFiltroStatus("TODOS")}
          >
            Todos ({doTipo.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filtroStatus === "ATIVOS" ? "default" : "outline"}
            onClick={() => setFiltroStatus("ATIVOS")}
          >
            Ativos ({doTipo.filter(f => f.ativo).length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filtroStatus === "INATIVOS" ? "default" : "outline"}
            onClick={() => setFiltroStatus("INATIVOS")}
          >
            Inativos ({doTipo.filter(f => !f.ativo).length})
          </Button>
          </div>
          <TabsList className="ml-auto">
            <TabsTrigger value="FORNECEDOR">Fornecedores ({ativosFornecedores})</TabsTrigger>
            <TabsTrigger value="BENEFICIARIO">Beneficiários ({ativosBeneficiarios})</TabsTrigger>
          </TabsList>
        </div>

        {filtrados.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            {beneficiarios ? <UserRound className="size-8 text-muted-foreground" /> : <Truck className="size-8 text-muted-foreground" />}
            <p className="font-medium">Nenhum {beneficiarios ? "beneficiário" : "fornecedor"} encontrado{query ? ` para "${query}"` : ""}.</p>
            <p className="text-sm text-muted-foreground">
              {beneficiarios ? "Cadastre beneficiários para usá-los nos lançamentos financeiros." : "Cadastre fornecedores para vinculá-los a compras e insumos."}
            </p>
          </CardContent>
        ) : (
          <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={ordenacao?.coluna === "nome"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("nome")}
                  >
                    Nome
                  </SortableTableHead>
                  {!beneficiarios && <TableHead className="text-center">Insumos</TableHead>}
                  <SortableTableHead
                    active={ordenacao?.coluna === "cnpj"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("cnpj")}
                  >
                    {beneficiarios ? "CPF / CNPJ" : "CNPJ"}
                  </SortableTableHead>
                  <TableHead>{beneficiarios ? "Telefone" : "Contato"}</TableHead>
                  <TableHead>{beneficiarios ? "Forma de pagamento" : "Canais"}</TableHead>
                  <SortableTableHead
                    active={ordenacao?.coluna === "status"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("status")}
                  >
                    Status
                  </SortableTableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((fornecedor) => (
                  <Fragment key={fornecedor.id}>
                  <TableRow className={expandidoId === fornecedor.id ? "cursor-pointer border-b-0" : "cursor-pointer"} onClick={() => alternarLinha(fornecedor.id)}>
                    <TableCell className="w-[28%] whitespace-normal">
                      <div className="flex items-center gap-2.5">
                        <button id={`expansao-fornecedor-${fornecedor.id}`} type="button" aria-expanded={expandidoId === fornecedor.id}
                          aria-controls={`detalhes-fornecedor-${fornecedor.id}`}
                          aria-label={`${expandidoId === fornecedor.id ? "Fechar" : "Abrir"} detalhes de ${fornecedor.nome}`}
                          onClick={(evento) => { evento.stopPropagation(); alternarLinha(fornecedor.id); }}
                          className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                          <ChevronRight className={`size-4 transition-transform duration-200 ${expandidoId === fornecedor.id ? "rotate-90" : ""}`} />
                        </button>
                        <div>
                      <div className="break-words font-medium">{fornecedor.nome}</div>
                      {!beneficiarios && <div className="text-xs text-muted-foreground">{fornecedor.razaoSocial}</div>}
                        </div>
                      </div>
                    </TableCell>
                    {!beneficiarios && <TableCell className="text-center tabular-nums">{fornecedor.quantidadeInsumos ?? fornecedor.insumosVinculados.length}</TableCell>}
                    <TableCell className="text-muted-foreground tabular-nums ">
                      {formatarCpfCnpj(fornecedor.cpf ?? fornecedor.cnpj ?? "") || "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words ">
                      {(beneficiarios ? fornecedor.telefone : fornecedor.contatoNome || fornecedor.email || fornecedor.telefone) || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {(beneficiarios ? fornecedor.formasPagamento : fornecedor.canaisPedido).length === 0 && <span className="text-muted-foreground">—</span>}
                        {(beneficiarios ? fornecedor.formasPagamento : fornecedor.canaisPedido).map((opcao) => (
                          <Badge key={opcao.id} variant="secondary" className="whitespace-nowrap">
                            {opcao.nome}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusAtivoSalvavel ativo={fornecedor.ativo} nome={fornecedor.nome} motivoBloqueio={!editar ? "Seu perfil permite apenas consultar." : undefined} salvar={ativo => alterarStatusFornecedorAction(fornecedor.id, ativo)} />
                    </TableCell>
                    <TableCell onClick={(evento) => evento.stopPropagation()}>
                      <FornecedorActionsCell
                        fornecedor={fornecedor}
                        canaisPedidoOptions={canaisPedidoOptions}
                        formasPagamentoOptions={formasPagamentoOptions}
                      />
                    </TableCell>
                  </TableRow>
                  {expandidoId === fornecedor.id && <FornecedorDetalhes fornecedor={fornecedor} somenteLeitura={inicialId === fornecedor.id}
                    onFechar={() => setExpandidoId(null)} />}
                  </Fragment>
                ))}
              </TableBody>
          </Table>
        )}
      </Card>
    </Tabs>
  );
}
