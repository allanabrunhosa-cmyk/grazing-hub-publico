import { createHash } from "node:crypto";
import { ehSaldoDoDia, ErroExtrato, type ArquivoExtrato, type LinhaArquivo } from "./arquivo";

const hash = (texto: string) => createHash("sha256").update(texto).digest("hex");
const normalizar = (texto: string) => texto.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
export const impressaoTransacao = (linha: Pick<LinhaArquivo, "data" | "centavos" | "descricao">) =>
  hash(JSON.stringify([linha.data, linha.centavos, normalizar(linha.descricao)]));

// Nos OFXs do Itaú observados, FITID = dia + posição. A posição muda em novas
// exportações do mesmo dia; não é uma identidade permanente da movimentação.
function identificadorSequencial(identificador: string | null, data: string) {
  return !!identificador && new RegExp(`^${data.replaceAll("-", "")}\\d{3,}$`).test(identificador);
}
export function identificarLinhas(arquivo: ArquivoExtrato, hashArquivo: string) {
  const itau = arquivo.formato === "OFX" && /^0*341$/.test(arquivo.referenciaOfx?.split(" / ")[0] ?? "");
  const ocorrencias = new Map<string, number>();
  return arquivo.linhas.map(linha => {
    const impressao = impressaoTransacao(linha);
    const sequencialItau = itau && identificadorSequencial(linha.identificador, linha.data);
    const ocorrencia = (ocorrencias.get(impressao) ?? 0) + 1;
    ocorrencias.set(impressao, ocorrencia);
    const chave = sequencialItau
      ? hash(`ITAU:CONTEUDO:1:${impressao}:${ocorrencia}`)
      : linha.identificador ? hash(`ID:${arquivo.formato}:${linha.identificador}`) : hash(`ARQUIVO:${hashArquivo}:${linha.indice}`);
    return { ...linha, chave, impressao, sequencialItau };
  });
}

export type TransacaoAnterior = {
  id: string; chave: string; impressao: string; data: string; centavos: number;
  descricao: string; identificador: string | null; conciliada: boolean; formato: string;
};
type LinhaIdentificada = ReturnType<typeof identificarLinhas>[number];

export function compararImportacao(linhas: LinhaIdentificada[], existentes: TransacaoAnterior[]) {
  const porChave = new Map(existentes.map(linha => [linha.chave, linha]));
  // Reserva correspondências diretas antes de usar registros legados, inclusive
  // quando só parte das linhas idênticas de um arquivo anterior foi importada.
  const usados = new Set(linhas.flatMap(linha => {
    const anterior = porChave.get(linha.chave);
    return anterior ? [anterior.id] : [];
  }));
  const anterioresItau = existentes.filter(linha => linha.formato === "OFX" &&
    identificadorSequencial(linha.identificador, linha.data) && !ehSaldoDoDia(linha.descricao));
  const porConteudo = new Map<string, TransacaoAnterior[]>();
  const porDataValor = new Map<string, TransacaoAnterior>();
  for (const anterior of anterioresItau) {
    const impressao = impressaoTransacao(anterior);
    const grupo = porConteudo.get(impressao) ?? [];
    grupo.push(anterior);
    porConteudo.set(impressao, grupo);
    porDataValor.set(`${anterior.data}:${anterior.centavos}`, anterior);
  }
  const impressoes = new Set(existentes.map(item => item.impressao));
  return linhas.map(linha => {
    let anterior = porChave.get(linha.chave);
    let observacao: string | undefined;
    let possivelDuplicada = false;
    if (linha.sequencialItau) {
      anterior ??= porConteudo.get(linha.impressao)?.find(item => !usados.has(item.id));
      if (anterior) usados.add(anterior.id);
      else {
        // Data/valor iguais com descrição diferente não comprovam identidade.
        // Deixar desmarcada para conferência, sem bloquear as demais linhas.
        const semelhante = porDataValor.get(`${linha.data}:${linha.centavos}`);
        possivelDuplicada = !!semelhante;
        if (semelhante) observacao = `Já existe uma movimentação nesta data e com este valor: "${semelhante.descricao}". Importe somente se for outra transação.`;
      }
    } else {
      if (anterior && (anterior.centavos !== linha.centavos || anterior.data !== linha.data || anterior.descricao !== linha.descricao)) {
        throw new ErroExtrato(`Linha ${linha.indice + 1}: o identificador ${linha.identificador ?? ""} já foi importado com data, valor ou descrição diferentes. Confira esta movimentação no extrato do banco.`);
      }
      possivelDuplicada = impressoes.has(linha.impressao);
    }
    return { ...linha, conciliada: !!anterior?.conciliada, observacao,
      situacao: anterior ? "EXISTENTE" as const : possivelDuplicada ? "POSSIVEL_DUPLICADA" as const : "NOVA" as const };
  });
}
