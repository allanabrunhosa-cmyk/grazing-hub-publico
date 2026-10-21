import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

const CORES: Partial<Record<NonNullable<ComponentProps<typeof Badge>["variant"]>, string>> = {
  success: "border-emerald-700 bg-emerald-700 text-white",
  warning: "border-yellow-500 bg-yellow-400 text-yellow-950",
  destructive: "border-red-700 bg-red-700 text-white dark:bg-red-700",
  secondary: "border-blue-700 bg-blue-700 text-white",
  default: "border-blue-700 bg-blue-700 text-white",
  muted: "border-gray-600 bg-gray-600 text-white",
};

export function BadgeNota({ variant = "default", className, ...props }: ComponentProps<typeof Badge>) {
  return <Badge variant={variant} className={cn("font-semibold", CORES[variant ?? "default"], className)} {...props} />;
}
