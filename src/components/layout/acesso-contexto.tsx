"use client";
import { createContext, useContext } from "react";
import { permissaoEfetiva, recursoDaRota, type Permissoes, type Excecoes, type Acao, CATALOGO } from "@/lib/permissoes/catalogo";
type Acesso = { admin: boolean; permissoes: Permissoes; excecoes: Excecoes };
const Contexto = createContext<Acesso>({ admin: false, permissoes: {}, excecoes: {} });
export function ProvedorAcesso({ acesso, children }: { acesso: Acesso; children: React.ReactNode }) { return <Contexto.Provider value={acesso}>{children}</Contexto.Provider>; }
export function useAcesso() {
  const acesso = useContext(Contexto);
  const pode = (recurso: string, acao: Acao = "visualizar") => acesso.admin || permissaoEfetiva(acesso.permissoes, acesso.excecoes, recurso, acao);
  const podeRota = (rota: string) => { const recurso = recursoDaRota(rota); return !!recurso && pode(recurso); };
  const entradaModulo = (slug: string) => {
    const entrada = CATALOGO.find(m => m.id === slug)?.secoes.find(s => s.rota && pode(s.id))?.rota;
    return entrada && slug === "vendas" ? "/vendas" : entrada;
  };
  return { admin: acesso.admin, pode, podeRota, entradaModulo };
}
