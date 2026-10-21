import { cn } from "cn";

type PropriedadesIcone = { className?: string; monocromatico?: boolean };

export function IconeInsumo({ className, monocromatico = false }: PropriedadesIcone) {
  return <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" className={cn("shrink-0", !monocromatico && "text-[#184778] dark:text-[#82b7ec]", className)}>
    <path d="M18 2.5 33 11v15L18 34.5 3 26V11Z" />
    <path d="m3 11 15 8.5L33 11M18 19.5v15M10.5 15.25l15-8.5" />
  </svg>;
}

export function IconePreparacao({ className, monocromatico = false }: PropriedadesIcone) {
  return <svg viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" className={cn("shrink-0", !monocromatico && "text-[#b95f35] dark:text-[#ef9d70]", className)}>
    <g fill="currentColor" stroke="none"><circle cx="3.5" cy="5.5" r="2.7" /><circle cx="3.5" cy="14" r="2.7" /><circle cx="3.5" cy="22.5" r="2.7" /><circle cx="31" cy="14" r="5" /></g>
    <path d="M8.3 5.5h1C16 5.5 12.5 14 20.5 14H23M8.3 14H23M8.3 22.5h1C16 22.5 12.5 14 20.5 14m1.7-1.9 1.9 1.9-1.9 1.9" />
  </svg>;
}
