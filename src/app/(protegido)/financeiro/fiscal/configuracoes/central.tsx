import type { ReactNode } from "react";
import { BarraAcoes } from "@/components/padroes-operacionais";

export function CentralConfiguracoesFiscais({ empresa, emissor, certificado, numeracao, operacao }: { empresa: ReactNode; emissor: ReactNode; certificado: ReactNode; numeracao: ReactNode; operacao?: ReactNode }) {
  return <div className="space-y-5">
    <BarraAcoes titulo="Configurações fiscais" descricao="Empresa, emissor, certificado e numeração no mesmo lugar." />
    <section id="empresa" aria-label="Empresa fiscal">{empresa}</section>
    <section id="emissor" aria-label="Emissor e CSC">{emissor}</section>
    <section id="certificado" aria-label="Certificado compartilhado"><p className="mb-3 text-xs text-muted-foreground">O certificado local é compartilhado. A situação no Brasil NFe e o CSC são conferidos separadamente por ambiente no bloco Emissor.</p>{certificado}</section>
    <section id="numeracao" aria-label="Séries e numeração">{numeracao}</section>
    {operacao && <section id="operacao" aria-label="Preferências e permissões operacionais">{operacao}</section>}
  </div>;
}
