"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizarEmailCliente } from "@/lib/vendas/cliente-identificadores";
import type { AvisoIdentidadeCliente, ConflitosIdentidadeCliente, ConsultarIdentidadeCliente } from "@/lib/vendas/cliente-identidade-consulta";
import type { ClienteEntrada } from "@/lib/vendas/dominio";

/** Consulta somente identificadores completos. Nunca grava nem substitui a guarda transacional. */
export function useIdentidadeCliente(cliente: ClienteEntrada, consultar: ConsultarIdentidadeCliente, { somenteLeitura = false, emailSomenteLeitura = false }: { somenteLeitura?: boolean; emailSomenteLeitura?: boolean } = {}) {
  const informado = normalizarEmailCliente(cliente.email);
  const email = !somenteLeitura && !emailSomenteLeitura && informado && informado.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(informado) ? informado : null;
  const documentoInformado = cliente.documento ?? "", digitos = documentoInformado.replace(/[.\-/\s]/g, "");
  const documento = !somenteLeitura && cliente.tipoEscolhido !== false && new RegExp(`^\\d{${cliente.tipo === "PF" ? 11 : 14}}$`).test(digitos) ? digitos : null;
  const clienteId = cliente.id, tipo = cliente.tipo;
  const chave = JSON.stringify([clienteId, tipo, email, documento]);
  const atual = useRef(chave), verificar = useRef<(() => void) | null>(null);
  const [resposta, setResposta] = useState<{ chave: string; conflitos?: ConflitosIdentidadeCliente; falha?: boolean } | null>(null);
  useLayoutEffect(() => { atual.current = chave; }, [chave]);
  useEffect(() => {
    if (!email && !documento) { verificar.current = null; return; }
    let cancelada = false, iniciada = false;
    const controle = new AbortController();
    function executar() {
      clearTimeout(espera);
      if (cancelada || iniciada) return;
      iniciada = true;
      const limite = setTimeout(() => controle.abort(), 8000);
      void consultar({ clienteId, email, documento, tipo }, controle.signal).then(conflitos => {
          if (!cancelada && atual.current === chave) setResposta({ chave, conflitos });
        }).catch(() => {
          if (!cancelada && atual.current === chave) setResposta({ chave, falha: true });
        }).finally(() => clearTimeout(limite));
    }
    const espera = setTimeout(executar, 350);
    verificar.current = executar;
    return () => { cancelada = true; clearTimeout(espera); controle.abort(); verificar.current = null; };
  }, [chave, clienteId, tipo, email, documento, consultar]);
  const verificarAgora = useCallback(() => verificar.current?.(), []);
  function aviso(campo: "email" | "documento", valor: string | null): AvisoIdentidadeCliente {
    if (!valor) return { mensagem: "", invalido: false, verificarAgora };
    const resultado = resposta?.chave === chave ? resposta : null;
    if (resultado?.falha) return { mensagem: "Não foi possível verificar o cadastro. A conferência será feita ao salvar.", invalido: false, verificarAgora };
    const invalido = resultado?.conflitos?.[campo] === true;
    return { mensagem: invalido ? `Já existe um cliente com este ${campo === "email" ? "e-mail" : tipo === "PF" ? "CPF" : "CNPJ"}. Busque e selecione o cadastro existente.` : "", invalido, verificarAgora };
  }
  return { email: aviso("email", email), documento: aviso("documento", documento) };
}
