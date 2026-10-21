import { Badge } from "@/components/ui/badge";
import type { AnaliseNcm, ClassificacaoFiscal } from "@/lib/tributacao/tipos";

export type AnaliseCadastroNcm = Pick<ClassificacaoFiscal, "ncm" | "ncmAplicabilidade" | "analiseNcm" | "configuracaoNcm"> & {
  versao?: { numero: number; inicio: string; autor: string; atualizadaEm: string };
};
const confianca = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
const data = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
export function ncmDiscriminadoPorEscolha(valor?: Pick<ClassificacaoFiscal, "ncm" | "configuracaoNcm">): boolean {
  const cenarios = valor?.configuracaoNcm?.cenarios ?? [];
  return cenarios.length > 0 && (!valor?.ncm || cenarios.some(c => c.ncm !== valor.ncm));
}

function Fundamento({ analise }: { analise: AnaliseNcm }) {
  return <div className="space-y-2 break-words">
    {analise.descricaoNcm && <p>{analise.descricaoNcm}</p>}
    <p>{analise.justificativa}</p>
    <p className="text-muted-foreground">{analise.fundamento === "DOCUMENTAL" ? "Documentação específica" : "Pesquisa fundamentada"} · confiança {confianca[analise.confianca].toLocaleLowerCase("pt-BR")} · análise em {data(analise.dataAnalise)}</p>
    {analise.pendenciasNcm.length > 0 && <ul className="list-disc space-y-1 pl-5">{analise.pendenciasNcm.map((p, i) => <li key={i}>{p}</li>)}</ul>}
    <ul className="space-y-1">{analise.fontes.map((fonte, i) => <li key={i}>{/^https:\/\/[^\s]+$/.test(fonte) ? <a href={fonte} target="_blank" rel="noreferrer" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{fonte}</a> : fonte}</li>)}</ul>
  </div>;
}

export function DetalhesAnaliseNcm({ valor, divergente = false }: { valor?: AnaliseCadastroNcm; divergente?: boolean }) {
  if (!valor?.analiseNcm) return null;
  const analise = valor.analiseNcm;
  return <div className="mt-2 space-y-2 text-xs">
    <Badge variant={analise.confianca === "BAIXA" ? "warning" : "secondary"} className="whitespace-normal">{analise.fundamento === "DOCUMENTAL" ? "Documentação" : "Pesquisa"} · {confianca[analise.confianca]}</Badge>
    {divergente && <p className="text-warning">O cadastro mudou após esta análise. Crie uma nova versão fiscal para fundamentar a correção.</p>}
    <details><summary className="flex min-h-8 cursor-pointer items-center font-medium focus-visible:outline-2 focus-visible:outline-ring">Justificativa do NCM</summary>
      <div className="mt-2 space-y-3"><Fundamento analise={analise} />
        {valor.configuracaoNcm?.cenarios.map(c => <div key={c.id} className="space-y-2 border-t pt-2"><p className="font-medium">{c.nome} · <span className="font-mono">{c.ncm ?? "Classificação pendente"}</span></p><Fundamento analise={c.analiseNcm} /></div>)}
        {valor.configuracaoNcm?.gruposEquivalentes?.map((g, i) => <div key={g.grupoId} className="space-y-2 border-t pt-2"><p className="font-medium">Equivalência {i + 1} · {g.opcaoIds.length} opções comprovadas · quantidade de {g.quantidadeMinima} a {g.quantidadeMaxima}</p><Fundamento analise={g.analiseNcm} /></div>)}
        {valor.versao && <p className="text-muted-foreground">Versão {valor.versao.numero} · vigência {data(valor.versao.inicio)} · {valor.versao.autor} · registro em {data(valor.versao.atualizadaEm)}</p>}
      </div>
    </details>
  </div>;
}
