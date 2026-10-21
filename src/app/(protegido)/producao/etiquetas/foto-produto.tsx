"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

/** Foto já cadastrada. A ausência/falha mantém a identificação por nome. */
export function FotoProduto({ url, className }: { url?: string | null; className?: string }) {
  const [urlComFalha, setUrlComFalha] = useState<string | null>(null);
  return <span className={cn("validades-foto", className)}>{url && url !== urlComFalha
    ? <Image src={url} alt="" width={112} height={112} unoptimized onError={() => setUrlComFalha(url)} />
    : <Package aria-hidden="true" className="size-7 text-muted-foreground" />}</span>;
}
