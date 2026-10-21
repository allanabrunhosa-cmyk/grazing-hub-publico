"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "cn";
import { BotaoRemoverItem } from "@/components/remover-item";

export function FotoDropzone({
  fotoAtualUrl,
  onChange,
  disabled,
}: {
  fotoAtualUrl?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [removida, setRemovida] = useState(false);

  function selecionar(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      return;
    }
    setPreview(URL.createObjectURL(file));
    setRemovida(false);
    onChange(file);
  }

  function remover() {
    setPreview(null);
    setRemovida(true);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const imagemExibida = preview ?? (!removida ? fotoAtualUrl : null);

  return (
    <div className="space-y-1.5">
      <input type="hidden" name="removerFoto" value={removida ? "on" : ""} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          selecionar(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex aspect-[4/5] min-h-52 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed text-center transition-colors",
          dragOver ? "border-ring bg-accent/50" : "border-input hover:bg-accent/30",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {imagemExibida ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagemExibida} alt="Foto do produto" className="h-full w-full rounded-lg object-cover" />
            <span className="absolute top-1.5 right-1.5">
              <BotaoRemoverItem discreto nome="Remover foto" disabled={disabled} onClick={(e) => {
                e.stopPropagation();
                remover();
              }} />
            </span>
          </>
        ) : (
          <>
            <Camera className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Clique ou arraste uma foto</p>
            <p className="max-w-48 text-xs leading-relaxed text-muted-foreground">
              Formato vertical 4:5 para aparecer corretamente na ficha técnica.
            </p>
            <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
              4:5 vertical
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name="foto"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => selecionar(e.target.files?.[0])}
      />
    </div>
  );
}
