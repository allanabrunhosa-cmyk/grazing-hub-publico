import { ErroFatura } from "./erros";

export type CandidatoFaturaBase = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  vencimento: string;
  cartaoId: string | null;
  cartaoNome: string | null;
  podeCorrigirCartao: boolean;
  fornecedorId: string | null;
  versao: string;
  notaGrupo: string | null;
  parcelaNota?: {
    id: string;
    valor: number;
    numero: string;
    chaveAcesso: string;
    fornecedorNome: string | null;
  };
};

export type CandidatoFaturaInteiro = CandidatoFaturaBase & {
  lancamentos: { id: string; versao: string }[];
  componentes: number;
};

function somarCentavos(valores: number[]): number | null {
  let total = 0;
  for (const valor of valores) {
    if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(total + valor)) return null;
    total += valor;
  }
  return total;
}

function agruparParcela(grupo: CandidatoFaturaBase[]): CandidatoFaturaInteiro | null {
  const ordenados = [...grupo].sort((a, b) => a.id.localeCompare(b.id));
  const primeiro = ordenados[0];
  const parcela = primeiro.parcelaNota;
  if (!parcela || parcela.id !== primeiro.notaGrupo || !Number.isSafeInteger(parcela.valor) || parcela.valor <= 0) return null;
  if (new Set(ordenados.map(l => l.id)).size !== ordenados.length) return null;
  const sinal = Math.sign(primeiro.valor);
  if (!sinal || ordenados.some(l => {
    const dados = l.parcelaNota;
    return !dados || dados.id !== primeiro.notaGrupo || dados.valor !== parcela.valor
      || dados.numero !== parcela.numero || dados.chaveAcesso !== parcela.chaveAcesso || dados.fornecedorNome !== parcela.fornecedorNome
      || Math.sign(l.valor) !== sinal || l.data !== primeiro.data || l.vencimento !== primeiro.vencimento
      || l.cartaoId !== primeiro.cartaoId || l.cartaoNome !== primeiro.cartaoNome || l.fornecedorId !== primeiro.fornecedorId;
  })) return null;
  const valor = somarCentavos(ordenados.map(l => l.valor));
  if (valor === null || Math.abs(valor) !== parcela.valor) return null;
  const fornecedor = parcela.fornecedorNome?.trim();
  return {
    ...primeiro,
    descricao: `NF-e ${parcela.chaveAcesso} · Parcela ${parcela.numero}${fornecedor ? ` · ${fornecedor}` : ""}`,
    valor,
    podeCorrigirCartao: false,
    lancamentos: ordenados.map(l => ({ id: l.id, versao: l.versao })),
    componentes: ordenados.length,
  };
}

/** O vínculo estrutural da duplicata reúne os componentes; nomes nunca unem despesas. */
export function agruparLancamentosInteirosFatura(lista: CandidatoFaturaBase[]): CandidatoFaturaInteiro[] {
  const parcelas = new Map<string, CandidatoFaturaBase[]>();
  const inteiros: CandidatoFaturaInteiro[] = [];
  for (const candidato of lista) {
    if (!candidato.notaGrupo) {
      inteiros.push({ ...candidato, lancamentos: [{ id: candidato.id, versao: candidato.versao }], componentes: 1 });
      continue;
    }
    const grupo = parcelas.get(candidato.notaGrupo) ?? [];
    grupo.push(candidato);
    parcelas.set(candidato.notaGrupo, grupo);
  }
  for (const grupo of parcelas.values()) {
    const inteiro = agruparParcela(grupo);
    if (inteiro) inteiros.push(inteiro);
  }
  return inteiros.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.id.localeCompare(b.id));
}

type SelecionadoNotaFatura = { id: string; notaGrupo: string | null; valor: number; valorParcela?: number };
type ComponenteAtivoNota = { id: string; notaGrupo: string; valor: number };

/** Recebe centavos brutos do ledger depois da releitura e das travas do servidor. */
export function validarSelecaoIntegralDeNotasFatura(selecionados: SelecionadoNotaFatura[], componentesAtivos: ComponenteAtivoNota[]): void {
  if (new Set(selecionados.map(l => l.id)).size !== selecionados.length) throw new ErroFatura("Seleção de despesas inválida.");
  const grupos = new Set(selecionados.map(l => l.notaGrupo ? `nota:${l.notaGrupo}` : `titulo:${l.id}`));
  if (grupos.size > 200) throw new ErroFatura("Seleção de despesas inválida. Escolha até 200 lançamentos inteiros.");
  const notas = new Map<string, SelecionadoNotaFatura[]>();
  for (const selecionado of selecionados) {
    if (!selecionado.notaGrupo) continue;
    const grupo = notas.get(selecionado.notaGrupo) ?? [];
    grupo.push(selecionado);
    notas.set(selecionado.notaGrupo, grupo);
  }
  for (const [notaGrupo, grupo] of notas) {
    const componentes = componentesAtivos.filter(l => l.notaGrupo === notaGrupo);
    const idsSelecionados = new Set(grupo.map(l => l.id));
    if (!componentes.length || new Set(componentes.map(l => l.id)).size !== componentes.length
      || componentes.length !== grupo.length || componentes.some(l => !idsSelecionados.has(l.id))) {
      throw new ErroFatura("Selecione o lançamento inteiro da parcela da NF-e, com todos os componentes.");
    }
    const valorParcela = grupo[0].valorParcela;
    const totalComponentes = somarCentavos(componentes.map(l => l.valor));
    const totalSelecionados = somarCentavos(grupo.map(l => l.valor));
    if (!Number.isSafeInteger(valorParcela) || grupo.some(l => l.valorParcela !== valorParcela)
      || totalComponentes === null || totalSelecionados === null
      || totalComponentes !== valorParcela || totalSelecionados !== valorParcela) {
      throw new ErroFatura("A composição dos lançamentos não fecha com o valor da parcela da NF-e. Revise a nota antes de conciliar.");
    }
  }
}
