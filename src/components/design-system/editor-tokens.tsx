"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRUPOS_TOKENS, REGISTRO_TOKENS, chavesDoGrupo, type ChaveTokenDesign, type GrupoTokenDesign, type ValoresTemaParciais } from "@/lib/design-system/registro";
import { restaurarGrupo, restaurarToken, resolverTema } from "@/lib/design-system/resolver-tema";
import { validarValoresTema } from "@/lib/design-system/validacao";

type EditorTokensProps = {
  valores: ValoresTemaParciais;
  base?: ValoresTemaParciais;
  aoMudar: (valores: ValoresTemaParciais) => void;
  chaves?: readonly ChaveTokenDesign[];
  titulo?: string;
  descricao?: string;
};

/** Controles fechados: cada escolha é validada antes de chegar ao documento de prévia. */
export function EditorTokens({ valores, base = {}, aoMudar, chaves: chavesPermitidas, titulo = "Tokens do experimento", descricao = "Escolhas limitadas à referência mapeada. Restaurar remove somente o rascunho do laboratório." }: EditorTokensProps) {
  const resolvidos = resolverTema({ ...base, ...valores });

  function definir(chave: ChaveTokenDesign, valor: string | null) {
    if (!valor) return;
    const proximo = { ...valores, [chave]: valor };
    aoMudar(validarValoresTema(proximo));
  }

  function restaurarCampo(chave: ChaveTokenDesign) {
    aoMudar(restaurarToken(valores, chave));
  }

  function restaurarSecao(grupo: GrupoTokenDesign) {
    aoMudar(restaurarGrupo(valores, grupo));
  }

  function restaurarChaves(chaves: readonly ChaveTokenDesign[]) {
    aoMudar(chaves.reduce((atual, chave) => restaurarToken(atual, chave), valores));
  }

  const grupos = GRUPOS_TOKENS.filter(grupo => !chavesPermitidas || chavesPermitidas.some(chave => REGISTRO_TOKENS[chave].grupo === grupo.id));

  return (
    <section aria-labelledby="tokens-heading" className="space-y-4 rounded-xl border bg-muted/25 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="tokens-heading" className="text-sm font-semibold">{titulo}</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{descricao}</p>
        </div>
        <span className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">{Object.keys(valores).length} {Object.keys(valores).length === 1 ? "ajuste" : "ajustes"}</span>
      </div>

      <div className="grid gap-3">
        {grupos.map(grupo => <GrupoTokens key={grupo.id} grupo={grupo} chaves={chavesPermitidas?.filter(chave => REGISTRO_TOKENS[chave].grupo === grupo.id)} valores={valores} resolvidos={resolvidos} aoDefinir={definir} aoRestaurarCampo={restaurarCampo} aoRestaurarSecao={restaurarSecao} aoRestaurarChaves={restaurarChaves} />)}
      </div>
    </section>
  );
}

function GrupoTokens({ grupo, chaves, valores, resolvidos, aoDefinir, aoRestaurarCampo, aoRestaurarSecao, aoRestaurarChaves }: {
  grupo: (typeof GRUPOS_TOKENS)[number];
  chaves?: readonly ChaveTokenDesign[];
  valores: ValoresTemaParciais;
  resolvidos: Record<ChaveTokenDesign, string>;
  aoDefinir: (chave: ChaveTokenDesign, valor: string | null) => void;
  aoRestaurarCampo: (chave: ChaveTokenDesign) => void;
  aoRestaurarSecao: (grupo: GrupoTokenDesign) => void;
  aoRestaurarChaves: (chaves: readonly ChaveTokenDesign[]) => void;
}) {
  const chavesGrupo = chaves ?? chavesDoGrupo(grupo.id);
  const possuiRascunho = chavesGrupo.some(chave => Object.hasOwn(valores, chave));

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-sm font-medium">{grupo.nome}</p><p className="text-xs text-muted-foreground">{grupo.descricao}</p></div>
        {possuiRascunho && <Button type="button" size="xs" variant="ghost" onClick={() => chaves ? aoRestaurarChaves(chavesGrupo) : aoRestaurarSecao(grupo.id)}><RotateCcw className="size-3" />Restaurar grupo</Button>}
      </div>
      <div className="space-y-2.5">
        {chavesGrupo.map(chave => {
          const token = REGISTRO_TOKENS[chave];
          const personalizado = Object.hasOwn(valores, chave);
          return <div key={chave} className="grid min-w-0 gap-1.5">
            <div><label htmlFor={`token-${chave}`} className="text-xs font-medium">{token.rotulo}</label><p className="mt-0.5 text-xs text-muted-foreground">{token.descricao}</p></div>
            <Select value={resolvidos[chave]} onValueChange={valor => aoDefinir(chave, valor)}>
              <SelectTrigger id={`token-${chave}`} aria-label={token.rotulo} size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{token.opcoes.map(opcao => <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>)}</SelectContent>
            </Select>
            <p className="break-words text-[11px] text-muted-foreground">{personalizado ? "Experimento" : "Herdado do publicado"}: {resolvidos[chave]} · Fábrica: {token.padrao}</p>
            <Button type="button" size="xs" variant="ghost" disabled={!personalizado} onClick={() => aoRestaurarCampo(chave)} aria-label={`Restaurar ${token.rotulo}`}><RotateCcw className="size-3" />Restaurar</Button>
          </div>;
        })}
      </div>
    </div>
  );
}
