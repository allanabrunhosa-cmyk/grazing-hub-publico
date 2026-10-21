import type { RegistroHistorico } from "@/lib/vendas/historico-dominio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModalPedido } from "./modal-pedido";

const moeda = (v: string | null) => v === null ? "Não informado" : Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
function data(v: string | undefined) {
  if (!v) return "Não informada";
  const [ano, mes, dia] = v.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano} ${v.slice(11, 19)}`;
}
const informado = (v: string | null | undefined) => v?.trim() ? v : "Não informado";
export type EntregaOriginalHistorica = { modalidade: "ENTREGA" | "RETIRADA"; enderecoOriginal: string | null };

/** Composição de consulta. Não importa ações, banco, integrações ou formatação HTML. */
export function ConteudoHistoricoPedido({ registro:r, itensComplementares = 0, entregaOriginal }: { registro:RegistroHistorico; itensComplementares?:number; entregaOriginal?:EntregaOriginalHistorica }) {
  const t = r.totais;
  const valores = [
    ["Líquido dos itens conhecidos", t.liquido_itens], ["Subtotal bruto exportado", t.subtotal_produtos_original],
    ["Descontos históricos das linhas", t.desconto_itens], ["Frete ou ajuste legado exportado", t.frete_ajuste_original],
    ["Parcela histórica não detalhada", t.valor_historico_nao_detalhado], ["Diferença final a classificar", t.diferenca_total_apos_nao_detalhado],
  ];
  return <div className="pedido-detalhe" data-pedido-detalhe="historico">
    <div className="pedido-detalhe-topo"><p className="text-sm text-muted-foreground">Somente leitura. Este histórico não movimenta caixa ou estoque e não entra nas filas operacionais.</p></div>
    <div className="pedido-detalhe-secoes">
      <section aria-label="Datas e atendimento" className="pedido-detalhe-secao"><h2 className="font-semibold">Datas e atendimento</h2>
        <p>Criação: {data(r.data_criacao.local_exato)}</p>
        <p>Pagamento informado na fonte: {data(r.pagamento_informado?.local_exato)}</p>
        <p className="text-sm text-muted-foreground">Horários locais em America/Sao_Paulo, por hipótese operacional.</p>
        <p>Liquidação bancária: não comprovada.</p>
        {entregaOriginal ? <><p>Data da entrega: não informada.</p><p>Modalidade de entrega: {entregaOriginal.modalidade === "RETIRADA" ? "Retirada" : "Entrega informada na origem"}.</p></> : <p>Data e modalidade de entrega: não informadas.</p>}
        <p>Status legado: {r.status.final_legado || "Não apurado"}.</p>
        <p className="text-sm text-muted-foreground">“Retirado” não define a modalidade de entrega.</p>
      </section>
      <section aria-label="Comprador e destinatário" className="pedido-detalhe-secao"><h2 className="font-semibold">Comprador e destinatário</h2>
        <p>Comprador: {informado(r.comprador.nome_cobranca)}</p>
        {r.comprador.empresa && <p>Empresa de cobrança: {r.comprador.empresa}</p>}
        <p>Destinatário: {informado(r.destinatario.nome_entrega_original)}</p>
        {r.comprador.nome_usuario_original && <p>Usuário na fonte: {r.comprador.nome_usuario_original}</p>}
        {r.comprador.emails.filter(e => e.original).map((e, indice) => <p className="break-words" key={`${e.origem}-${indice}`}>E-mail ({e.origem}): {e.original}</p>)}
        {r.comprador.telefones.filter(e => e.original).map((e, indice) => <p className="break-words" key={`${e.origem}-${indice}`}>Telefone ({e.origem}): {e.original}</p>)}
        <p className="text-sm text-muted-foreground">Os contatos acima pertencem ao comprador. O contato do destinatário não foi informado.</p>
      </section>
      <section aria-label="Endereços de cobrança" className="pedido-detalhe-secao"><h2 className="font-semibold">Endereços de cobrança</h2>
        {r.enderecos.map((e, indice) => <div key={`${e.origem}-${indice}`} className="space-y-1"><p className="font-medium">Endereço original {e.origem}</p><p className="whitespace-pre-wrap break-words">{informado(e.original)}</p></div>)}
        <p className="text-sm text-muted-foreground">Os dois endereços têm cabeçalho de cobrança.{!entregaOriginal && " O destino da entrega não está confirmado."}</p>
      </section>
      {entregaOriginal && <section aria-label="Entrega original" className="pedido-detalhe-secao"><h2 className="font-semibold">Entrega original</h2>
        {entregaOriginal.modalidade === "RETIRADA" ? <p>Retirada conforme a fonte histórica.</p> : <p className="whitespace-pre-wrap break-words">{entregaOriginal.enderecoOriginal}</p>}
      </section>}
      <section aria-label="Itens conhecidos" className="pedido-detalhe-secao"><h2 className="font-semibold">Itens conhecidos</h2>
        {itensComplementares > 0 && <p className="text-sm text-muted-foreground">Inclui {itensComplementares} {itensComplementares === 1 ? "item recuperado" : "itens recuperados"} no WooCommerce. Os blocos originais da planilha permanecem preservados.</p>}
        {r.itens.length ? <Table aria-label="Itens históricos conhecidos" identificationColumn={1}>
          <TableHeader><TableRow><TableHead>Bloco</TableHead><TableHead>Descrição original</TableHead><TableHead>Quantidade</TableHead><TableHead>Preço líquido unitário</TableHead><TableHead>Desconto histórico da linha</TableHead><TableHead>Líquido da linha</TableHead></TableRow></TableHeader>
          <TableBody>{r.itens.map(i => <TableRow key={i.bloco}><TableCell className="tabular-nums">{i.bloco > 10 ? `WooCommerce ${i.bloco - 10}` : i.bloco}</TableCell><TableCell>{informado(i.nome_original)}</TableCell><TableCell className="tabular-nums">{i.quantidade ?? "Não informada"}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{moeda(i.preco_unitario_liquido)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{moeda(i.desconto_linha)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{moeda(i.liquido_linha)}</TableCell></TableRow>)}</TableBody>
        </Table> : <p>Não há itens detalhados na fonte.</p>}
        <p className="text-sm text-muted-foreground">Os preços unitários já incluem o desconto. O desconto histórico não é aplicado novamente.</p>
      </section>
      <section aria-label="Valores originais" className="pedido-detalhe-secao"><h2 className="font-semibold">Valores originais</h2>
        <dl className="grid gap-2">{valores.map(([nome, valor]) => <div className="flex flex-wrap justify-between gap-x-3 gap-y-1" key={nome}><dt>{nome}</dt><dd className="tabular-nums">{moeda(valor)}</dd></div>)}
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-semibold"><dt>Total original</dt><dd className="tabular-nums">{moeda(t.total_original)}</dd></div>
        </dl>
        <p>Forma de pagamento informada: {r.metodo_pagamento_original || "Não informada"}</p>
        <p className="break-words">Referência da transação: {informado(r.transaction_id_original)}</p>
        <p className="text-sm text-muted-foreground">A referência da transação não comprova entrada no banco. Custo logístico e custo histórico de produção não foram apurados. As parcelas sem detalhamento não são produtos físicos.</p>
      </section>
      {r.excecoes.length > 0 && <section aria-label="Exceções da fonte" className="pedido-detalhe-secao"><h2 className="font-semibold">Exceções da fonte</h2><ul className="list-disc space-y-1 pl-5">{r.excecoes.map((e, indice) => <li className="break-words" key={indice}>{e.codigo}</li>)}</ul></section>}
      <section aria-label="Observações originais" className="pedido-detalhe-secao"><h2 className="font-semibold">Observações originais</h2><p className="whitespace-pre-wrap break-words">{r.notas_originais || "Sem observações"}</p></section>
    </div>
  </div>;
}

export function PainelHistoricoPedido({ registro, retorno, itensComplementares, entregaOriginal }: { registro:RegistroHistorico; retorno?:string; itensComplementares?:number; entregaOriginal?:EntregaOriginalHistorica }) {
  return <ModalPedido detalhe titulo={`Pedido histórico #${registro.numero_original}`} descricao="Retrato do sistema anterior. Somente leitura." retorno={retorno}><ConteudoHistoricoPedido registro={registro} itensComplementares={itensComplementares} entregaOriginal={entregaOriginal} /></ModalPedido>;
}
