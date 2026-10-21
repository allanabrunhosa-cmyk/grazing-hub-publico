import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export function InputComSufixo({
  sufixo,
  className,
  containerClassName,
  ...propriedades
}: ComponentProps<typeof Input> & {
  sufixo: ReactNode;
  containerClassName?: string;
}) {
  return (
    <div className={cn("relative min-w-0", containerClassName)}>
      <Input {...propriedades} className={cn("pr-14", className)} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
        {sufixo}
      </span>
    </div>
  );
}
