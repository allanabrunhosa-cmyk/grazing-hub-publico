"use client";
import { useId, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import type { EstadoSite } from "@/lib/site/configuracao";
import { EnderecoWebhook, Pendencias, Presenca, quando, Situacao } from "../painel-conexao";

type Retorno<T> = ({ ok: true } & T) | { erro: string };
type Teste = { pedidos: number; metas: string[]; dataEntrega: string | null; pagamento: string | null };
export function PainelSite({ inicial, webhook, editar, salvar, testar, reprocessar }: { inicial: EstadoSite; webhook: string; editar: boolean;
  salvar: (canalId: string, ativa: boolean) => Promise<Retorno<{ estado: EstadoSite }>>; testar: () => Promise<Retorno<Teste>>; reprocessar: () => Promise<Retorno<{ quantidade: number; estado: EstadoSite }>> }) {
  const id = useId(), [e, setE] = useState(inicial), [erro, setErro] = useState(""), [aviso, setAviso] = useState(""), [teste, setTeste] = useState<Teste | null>(null);
  const [canalId, setCanalId] = useState(inicial.integracao?.canalId ?? inicial.canais.find(c => c.nome.trim().toLowerCase() === "site")?.id ?? "");
  const [pendente, iniciar] = useTransition(), trava = useRef(false);
  function executar(tarefa: () => Promise<void>) {
    if (!editar || trava.current) return;
    trava.current = true; setErro(""); setAviso("");
    iniciar(async () => { try { await tarefa(); } catch { setErro("Operação indisponível no momento."); } finally { trava.current = false; } });
  }
  const ativa = !!e.integracao?.ativa, canalAlterado = !!e.integracao && canalId !== e.integracao.canalId;
  const gravar = (novaAtiva: boolean, mensagem: string) => executar(async () => { const r = await salvar(canalId, novaAtiva); if ("erro" in r) setErro(r.erro); else { setE(r.estado); setAviso(mensagem); } });
  const pendencias = [
    ...(!e.configurado ? ["Cadastrar no servidor o endereço do site e a chave de leitura do WooCommerce."] : []),
    ...(!e.webhook ? ["Definir no servidor o segredo do webhook e criar no WooCommerce os webhooks de pedido criado e atualizado com o endereço abaixo."] : []),
    ...(!e.ligado ? ["Ligar a integração no servidor."] : []),
    ...(e.configurado && !ativa ? ["Escolher o canal de venda e ativar a recepção."] : []),
  ];
  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">Pedidos do site<Badge variant={e.operando ? "success" : ativa ? "warning" : "muted"}>{e.operando ? "Recebendo" : ativa ? "Aguardando servidor" : "Pausado"}</Badge></CardTitle>
      <CardDescription>Cada pedido feito no site entra uma única vez em Pedidos, com itens, valores, frete e pagamento. Itens e valores continuam sendo alterados no site; pedidos anteriores à primeira ativação não são importados.</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      <Situacao itens={[
        { nome: "Endereço do site", valor: e.loja ?? "Não configurado" },
        { nome: "Chave de leitura", valor: <Presenca ok={e.configurado} sim="Configurada" nao="Ausente" /> },
        { nome: "Segredo do webhook", valor: <Presenca ok={e.webhook} sim="Configurado" nao="Ausente" /> },
        { nome: "Última conferência periódica", valor: quando(e.integracao?.ultimaColeta ?? null) },
        { nome: "Último pedido ou aviso recebido", valor: quando(e.integracao?.ultimoRecebimento ?? null) },
        { nome: "Pedidos recebidos", valor: e.pedidos },
        { nome: "Pedidos com pendência", valor: e.comPendencia },
        { nome: "Avisos na fila", valor: e.pendentes },
        { nome: "Avisos com falha", valor: e.falhos },
      ]} />
      {e.integracao?.ultimoErro && <p role="status" className="text-sm text-warning">{e.integracao.ultimoErro}</p>}
      <div className="space-y-1 sm:max-w-sm"><Label htmlFor={`${id}-canal`}>Canal de venda dos pedidos do site</Label>
        <SelecaoFormulario id={`${id}-canal`} value={canalId} disabled={!editar || pendente} onValueChange={setCanalId}><option value="">Selecionar canal</option>{e.canais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario>
        <p className="text-xs text-muted-foreground">Vale para os próximos pedidos recebidos.</p></div>
      <EnderecoWebhook id={`${id}-webhook`} endereco={webhook} descricao="Cadastre este endereço no WooCommerce (Configurações › Avançado › Webhooks) para os tópicos Pedido criado e Pedido atualizado, com o mesmo segredo configurado no servidor." />
      <Pendencias itens={pendencias} />
      {teste && <div className="space-y-1 text-sm"><p>Chave aceita pelo site. Pedidos existentes: {teste.pedidos}.{teste.pagamento ? ` Pagamento do último pedido: ${teste.pagamento}.` : ""}</p>
        <p>{teste.dataEntrega ? `Data de entrega reconhecida no campo ${teste.dataEntrega}.` : "Data de entrega não reconhecida no último pedido: os pedidos chegam com pendência até o campo ser informado no servidor."}</p>
        {teste.metas.length > 0 && <p className="break-words text-xs text-muted-foreground">Campos adicionais do último pedido (somente nomes): {teste.metas.join(", ")}</p>}</div>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
    </CardContent>
    <CardFooter className="flex flex-wrap justify-end gap-3">
      <Button variant="outline" disabled={!editar || pendente || e.falhos === 0} onClick={() => executar(async () => { const r = await reprocessar(); if ("erro" in r) setErro(r.erro); else { setE(r.estado); setAviso(`${r.quantidade} ${r.quantidade === 1 ? "aviso voltou" : "avisos voltaram"} para a fila.`); } })}>Reprocessar avisos</Button>
      <Button variant="outline" disabled={!editar || pendente || !e.configurado} onClick={() => executar(async () => { const r = await testar(); if ("erro" in r) { setTeste(null); setErro(r.erro); } else setTeste(r); })}>Testar conexão</Button>
      {ativa && canalAlterado && <Button variant="outline" disabled={!editar || pendente || !canalId} onClick={() => gravar(true, "Canal atualizado.")}>Salvar canal</Button>}
      {ativa ? <Button variant="outline" disabled={!editar || pendente} onClick={() => gravar(false, "Recepção pausada. Ao reativar, o HUB recupera os pedidos do intervalo.")}>Pausar recepção</Button>
        : <Button variant="entrada" disabled={!editar || pendente || !canalId || !e.configurado} onClick={() => gravar(true, "Recepção ativada.")}>Ativar recepção</Button>}
    </CardFooter>
  </Card>;
}
