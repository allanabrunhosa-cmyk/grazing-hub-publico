"use client";
import { useId, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EstadoAsaas } from "@/lib/asaas/painel";
import { EnderecoWebhook, Pendencias, Presenca, quando, Situacao } from "../painel-conexao";

type Retorno<T> = ({ ok: true } & T) | { erro: string };
export function PainelAsaas({ inicial, webhook, editar, testar, reprocessar }: { inicial: EstadoAsaas; webhook: string; editar: boolean;
  testar: () => Promise<Retorno<{ ambiente: string }>>; reprocessar: () => Promise<Retorno<{ quantidade: number; estado: EstadoAsaas }>> }) {
  const id = useId(), [e, setE] = useState(inicial), [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [pendente, iniciar] = useTransition(), trava = useRef(false);
  function executar(tarefa: () => Promise<void>) {
    if (!editar || trava.current) return;
    trava.current = true; setErro(""); setAviso("");
    iniciar(async () => { try { await tarefa(); } catch { setErro("Operação indisponível no momento."); } finally { trava.current = false; } });
  }
  const pendencias = [
    ...(!e.chave ? [`Cadastrar no servidor a chave de API do Asaas (${e.ambiente === "PRODUCAO" ? "produção" : "ambiente de testes"}).`] : []),
    ...(!e.webhook ? ["Definir no servidor o token do webhook e cadastrar o webhook no painel do Asaas com o endereço abaixo."] : []),
    ...(!e.ligado ? ["Ligar a integração no servidor."] : []),
    ...(e.ambiente === "PRODUCAO" && !e.producaoAutorizada ? ["Autorizar o uso em produção no servidor."] : []),
  ];
  const fila = e.falhos + e.semVinculo;
  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">Cobranças pelo Asaas<Badge variant={e.ativo ? e.ambiente === "PRODUCAO" ? "success" : "warning" : "muted"}>{e.ativo ? e.ambiente === "PRODUCAO" ? "Ativo" : "Ativo em testes" : "Desativado"}</Badge></CardTitle>
      <CardDescription>O pedido confirmado ganha a opção de gerar Pix, boleto ou link de cartão. Quando o Asaas avisa o pagamento, o pedido passa a mostrar a cobrança como paga. Nenhum lançamento financeiro é criado automaticamente.</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      <Situacao itens={[
        { nome: "Ambiente", valor: e.ambiente === "PRODUCAO" ? "Produção" : "Testes (sandbox)" },
        { nome: "Chave de API", valor: <Presenca ok={e.chave} sim="Configurada" nao="Ausente" /> },
        { nome: "Token do webhook", valor: <Presenca ok={e.webhook} sim="Configurado" nao="Ausente" /> },
        { nome: "Último aviso recebido", valor: quando(e.ultimoEvento) },
        { nome: "Avisos na fila", valor: e.pendentes },
        { nome: "Avisos com falha ou sem pedido", valor: fila },
        { nome: "Cobranças em conferência", valor: e.incertas },
      ]} />
      <EnderecoWebhook id={`${id}-webhook`} endereco={webhook} descricao="Cadastre este endereço no painel do Asaas (Integrações › Webhooks), com os eventos de cobrança e o mesmo token configurado no servidor." />
      <Pendencias itens={pendencias} />
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
    </CardContent>
    <CardFooter className="flex flex-wrap justify-end gap-3">
      <Button variant="outline" disabled={!editar || pendente || fila === 0} onClick={() => executar(async () => { const r = await reprocessar(); if ("erro" in r) setErro(r.erro); else { setE(r.estado); setAviso(`${r.quantidade} ${r.quantidade === 1 ? "aviso voltou" : "avisos voltaram"} para a fila.`); } })}>Reprocessar avisos</Button>
      <Button variant="outline" disabled={!editar || pendente || !e.chave} onClick={() => executar(async () => { const r = await testar(); if ("erro" in r) setErro(r.erro); else setAviso(`Chave aceita pelo Asaas (${r.ambiente === "PRODUCAO" ? "produção" : "testes"}).`); })}>{pendente ? "Conferindo…" : "Testar conexão"}</Button>
    </CardFooter>
  </Card>;
}
