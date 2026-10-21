"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { consultarDetalhesMerchant } from "@/lib/ifood/merchant";
import { detalhesMerchantIfoodAction } from "./actions";

type Dados = Awaited<ReturnType<typeof consultarDetalhesMerchant>>;
const booleano = (v: boolean | null) => v === null ? null : v ? "Sim" : "Não";
function Informacao({ nome, valor }: { nome: string; valor: string | number | null }) {
  return <div className="grid min-w-0 gap-1"><dt className="text-sm text-muted-foreground">{nome}</dt><dd className="break-words">{typeof valor === "number" ? valor.toLocaleString("pt-BR", { maximumFractionDigits: 20, useGrouping: false }) : valor ?? "Não informado pelo iFood"}</dd></div>;
}
export function DetalhesMerchantIfood({ lojaId, permitido, bloqueado = false }: { lojaId: string; permitido: boolean; bloqueado?: boolean }) {
  const trava = useRef(false), [ocupado, iniciar] = useTransition();
  const [dados, definirDados] = useState<Dados | null>(null), [erro, definirErro] = useState("");
  function consultar() {
    if (trava.current || !permitido || bloqueado) return;
    trava.current = true; definirDados(null); definirErro("");
    iniciar(async () => {
      try {
        const r = await detalhesMerchantIfoodAction(lojaId);
        if ("dados" in r) definirDados(r.dados); else definirErro(r.erro);
      } catch { definirErro("Não foi possível consultar os detalhes. Confira a conexão e tente novamente."); }
      finally { trava.current = false; }
    });
  }
  const d = permitido ? dados?.detalhes : null;
  return <section className="grid min-w-0 gap-3" aria-label="Detalhes da loja iFood">
    <Button variant="outline" disabled={!permitido || bloqueado || ocupado} onClick={consultar}>{ocupado ? "Consultando detalhes…" : "Consultar detalhes da loja"}</Button>
    {!permitido && <p className="text-sm text-muted-foreground">Confira a autorização da loja e a liberação do ambiente para consultar.</p>}
    {ocupado && <p role="status">Aguardando os detalhes do iFood.</p>}
    {erro && <p role="alert">{erro}</p>}
    {dados && d && <Card><CardHeader><CardTitle role="heading" aria-level={4}>Detalhes da loja</CardTitle></CardHeader><CardContent className="grid min-w-0 gap-4">
      <p role="status" className="text-sm">Consulta: {new Date(dados.consultadoEm).toLocaleString("pt-BR", { timeZone: dados.fusoHorario })} · {dados.fusoHorario}</p>
      <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Informacao nome="Merchant ID" valor={d.id} /><Informacao nome="Nome da loja" valor={d.nome} />
        <Informacao nome="Razão social" valor={d.razaoSocial} /><Informacao nome="Tipo" valor={d.tipo} />
        <Informacao nome="Descrição" valor={d.descricao} /><Informacao nome="Status cadastral no iFood" valor={d.estadoCadastro} />
        <Informacao nome="Criação (horário recebido)" valor={d.criadoEm} /><Informacao nome="Exclusiva iFood" valor={booleano(d.exclusivo)} />
        <Informacao nome="Identificação de teste no iFood" valor={typeof d.teste === "boolean" ? booleano(d.teste) : d.teste} />
        <Informacao nome="Ticket médio informado" valor={d.ticketMedio} />
      </dl>
      <div className="grid min-w-0 gap-3"><h5 className="font-medium">Endereço da loja</h5>{d.endereco ? <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Informacao nome="País" valor={d.endereco.pais} /><Informacao nome="Estado" valor={d.endereco.estado} />
        <Informacao nome="Cidade" valor={d.endereco.cidade} /><Informacao nome="Bairro" valor={d.endereco.bairro} />
        <Informacao nome="Logradouro" valor={d.endereco.rua} /><Informacao nome="Número" valor={d.endereco.numero} />
        <Informacao nome="Complemento" valor={d.endereco.complemento} /><Informacao nome="CEP" valor={d.endereco.cep} />
        <Informacao nome="Latitude" valor={d.endereco.latitude} /><Informacao nome="Longitude" valor={d.endereco.longitude} />
      </dl> : <p>Nenhum endereço informado pelo iFood.</p>}</div>
      <div className="grid min-w-0 gap-3"><h5 className="font-medium">Operações e canais de venda</h5>
        {d.operacoes.length === 0 ? <p>Nenhuma operação informada pelo iFood.</p> : d.operacoes.map((o, n) => <div key={n} className="grid min-w-0 gap-1">
          <p className="font-medium break-words">{o.nome ?? "Operação não informada"}</p>
          {o.canais.length === 0 ? <p>Nenhum canal informado pelo iFood.</p> : o.canais.map((c, k) => <p key={k} className="break-words">{c.nome ?? "Canal não informado"} · {c.habilitado === null ? "Habilitação não informada" : c.habilitado ? "Habilitado" : "Desabilitado"}</p>)}
        </div>)}
      </div>
      <p className="text-sm text-muted-foreground">Dados cadastrais recebidos do iFood. Use “Consultar estado da loja” para conferir a disponibilidade atual.</p>
    </CardContent></Card>}
  </section>;
}
