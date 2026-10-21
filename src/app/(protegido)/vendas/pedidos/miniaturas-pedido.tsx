"use client";

import { useState } from "react";
import Image from "next/image";
import Decimal from "decimal.js";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ItemMiniatura = { id: string; produtoId?: string | null; nome: string; quantidade: string; fotoUrl?: string | null };

function Miniatura({ item }: { item: ItemMiniatura }) {
  const [fotoComErro, setFotoComErro] = useState<string | null>(null);
  const quantidade = new Decimal(item.quantidade).toString().replace(".", ",");
  const foto = item.fotoUrl && fotoComErro !== item.fotoUrl;
  return <li className="gestor-miniatura" title={`${quantidade} × ${item.nome}`}>
    {foto ? <Image src={item.fotoUrl!} alt={item.nome} width={36} height={36} unoptimized onError={() => setFotoComErro(item.fotoUrl!)} /> : <span className="gestor-miniatura-sem-foto" role="img" aria-label={`Foto não cadastrada: ${item.nome}`}><ImageOff aria-hidden /></span>}
    {quantidade !== "1" && <Badge variant="secondary" className="gestor-miniatura-quantidade" aria-label={`${quantidade} unidades de ${item.nome}`}>{quantidade}</Badge>}
  </li>;
}

/** A foto atual identifica o produto; valores e composição continuam nos snapshots. */
export function MiniaturasPedido({ itens, numero, limite = 3 }: { itens: readonly ItemMiniatura[]; numero: number; limite?: number }) {
  const agrupados = new Map<string, ItemMiniatura>();
  for (const item of itens) {
    const chave = item.produtoId || item.id;
    const anterior = agrupados.get(chave);
    agrupados.set(chave, anterior ? { ...anterior, quantidade: new Decimal(anterior.quantidade).plus(item.quantidade).toString() } : { ...item });
  }
  const produtos = [...agrupados.values()];
  return <ul className="gestor-miniaturas" aria-label={`Itens do pedido #${numero}`}>
    {produtos.slice(0, limite).map(item => <Miniatura key={item.produtoId || item.id} item={item} />)}
    {produtos.length > limite && <li className="gestor-miniatura-mais" aria-label={`Mais ${produtos.length - limite} produtos no detalhe`}>+{produtos.length - limite}</li>}
  </ul>;
}
