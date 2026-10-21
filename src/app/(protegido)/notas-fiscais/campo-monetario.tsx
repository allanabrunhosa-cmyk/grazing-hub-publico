"use client";

import type { ComponentProps } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";

export function CampoMonetario(propriedades: ComponentProps<typeof CurrencyInput>) {
  return <CurrencyInput {...propriedades} />;
}
