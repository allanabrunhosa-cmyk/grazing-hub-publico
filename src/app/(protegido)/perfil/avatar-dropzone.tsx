"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "cn";

export function AvatarDropzone({
  fotoAtualUrl,
  iniciais,
  onChange,
  disabled,
}: {
  fotoAtualUrl?: string | null;
  iniciais: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removida, setRemovida] = useState(false);

  function selecionar(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setPreview(URL.createObjectURL(file));
    setRemovida(false);
    onChange(file);
  }

  const imagemExibida = preview ?? (!removida ? fotoAtualUrl : null);

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="removerFoto" value={removida ? "on" : ""} />
      <button
        type="button"
        aria-label="Alterar foto de perfil"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={cn(
          "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-medium text-primary ring-1 ring-foreground/10 transition-opacity",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {imagemExibida ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagemExibida} alt="Foto de perfil" className="size-full object-cover" />
        ) : (
          iniciais
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 text-transparent transition-colors hover:bg-foreground/40 hover:text-background">
          <Camera className="size-5" />
        </span>
      </button>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Foto de Perfil</p>
        <p className="text-xs text-muted-foreground">Clique na foto pra alterar. JPG, PNG ou WebP. Máx. 5MB.</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="text-xs font-medium text-primary hover:underline"
        >
          Trocar foto
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        name="foto"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={(e) => selecionar(e.target.files?.[0])}
      />
    </div>
  );
}
