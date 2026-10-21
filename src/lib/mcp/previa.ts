import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { hashCredencial } from "./servidor";
import { decifrarIfood } from "@/lib/ifood/tokens";

const ESCRITAS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);
// Lotes dos serviços expostos cujo schema possui id String gerado.
// Vínculos com chaves compostas/naturais não recebem um ID artificial.
const LOTES_COM_ID = new Set(["itemPedidoVenda", "conversaoInsumo", "composicaoInsumo", "insumoFornecedor", "recebimentoDivergencia", "historicoConciliacao", "transacaoExtrato", "liquidacaoCartao"]);
const TECNICOS = new Set(["mcpEvento", "mcpOperacao", "mcpLimite", "mcpConfiguracao", "mcpAutorizacao", "mcpToken"]);
// Captura apenas dentro da transação isolada de prévia. Não é um dispatcher
// público nem registro de parâmetros em logs. IDs criados são normalizados para
// que duas simulações da mesma operação possam ser comparadas sem ignorar valores.
export function transacaoDePrevia(banco: Prisma.TransactionClient, mostrarFinanceiro = false, mostrarCustos = false) {
  const eventos: { modelo: string; operacao: string; entrada: unknown; saida: unknown }[] = [];
  const novos = new Map<string, string>();
  const versoesGeradas = new Set<string>();
  const instantesDaOperacao = new Set(["createdAt", "updatedAt", "atualizadoEm", "criadoEm", "emitidoEm", "confirmadoEm", "aprovadaEm", "entregueEm", "canceladoEm", "canceladaEm", "excluidoEm", "excluidaEm", "estornadoEm", "revertidoEm", "reabertoEm", "conciliadaEm", "conciliadoEm", "conferidoEm", "finalizadaEm", "finalizadoEm", "corrigidoEm", "concluidoEm", "observadoEm", "desvinculadoEm", "usadoEm", "ignoradoEm", "calculadoEm", "proximaTentativa"]);
  const modelos = new Map<PropertyKey, unknown>();
  const capturarIds = (valor: unknown) => {
    if (Array.isArray(valor)) { valor.forEach(capturarIds); return; }
    if (valor && typeof valor === "object") {
      for (const campo of ["id", "recorrenciaGrupoId"]) if (campo in valor) { const v = (valor as Record<string, unknown>)[campo]; if (typeof v === "string" && !novos.has(v)) novos.set(v, `novo:${novos.size + 1}`); }
    }
  };
  const normalizar = (v: unknown, campo = ""): unknown => {
    if (campo === "corpoCifrado" && typeof v === "string") return normalizar(decifrarIfood(v));
    if (v instanceof Date) return instantesDaOperacao.has(campo) ? "instante-da-operacao" : v.toISOString();
    if (instantesDaOperacao.has(campo) && typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return "instante-da-operacao";
    if (typeof v === "string") {
      if (campo === "versao" && versoesGeradas.has(v)) return "versao-gerada-na-operacao";
      if (novos.has(v)) return novos.get(v);
      if (/^(chaveOperacao|chaveIdempotencia|hashOperacao|loteExecucao)$/.test(campo)) return "identificador-da-operacao";
      // Referências geradas também aparecem nos textos técnicos dos serviços,
      // como “Produção <id>: consumo real”. Conserva o texto e substitui somente
      // IDs de registros criados nesta simulação, sem ignorar conteúdo ou valores.
      let texto = v;
      for (const [id, referencia] of novos) texto = texto.replaceAll(id, referencia);
      return texto;
    }
    if (Array.isArray(v)) return v.map(x => normalizar(x, campo));
    if (v && typeof v === "object") {
      if ("toJSON" in v && typeof v.toJSON === "function") return normalizar(v.toJSON(), campo);
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalizar(x, k)]));
    }
    return v;
  };
  const tx = new Proxy(banco, { get(alvo, propriedade) {
    const original = Reflect.get(alvo, propriedade);
    if (typeof original === "function") return original.bind(alvo);
    if (typeof propriedade !== "string" || propriedade.startsWith("$") || !original || typeof original !== "object" || TECNICOS.has(propriedade)) return original;
    if (!modelos.has(propriedade)) modelos.set(propriedade, new Proxy(original, { get(delegate, metodo) {
      const fn = Reflect.get(delegate, metodo);
      if (typeof fn !== "function") return fn;
      if (typeof metodo !== "string" || !ESCRITAS.has(metodo)) return fn.bind(delegate);
      return async (entrada: unknown) => {
        // createMany devolve apenas a contagem. Na simulação, atribuir IDs aos
        // modelos que já possuem ID String permite reconhecer as referências
        // desses novos itens nas fotografias posteriores. Não muda IDs existentes
        // nem valores de negócio; toda a simulação é revertida no savepoint.
        if (metodo.startsWith("createMany") && entrada && typeof entrada === "object" && "data" in entrada) {
          if (LOTES_COM_ID.has(propriedade)) {
            const identificar = (d: unknown) => d && typeof d === "object" ? { ...d, id: "id" in d ? d.id : randomUUID() } : d;
            entrada = { ...entrada, data: Array.isArray(entrada.data) ? entrada.data.map(identificar) : identificar(entrada.data) };
          }
        }
        const criarViaUpsert = metodo === "upsert" && entrada && typeof entrada === "object" && "where" in entrada && typeof Reflect.get(delegate, "findUnique") === "function"
          ? !await Reflect.get(delegate, "findUnique").call(delegate, { where: entrada.where, select: { id: true } }) : false;
        if (metodo.startsWith("create") && entrada && typeof entrada === "object" && "data" in entrada) {
          capturarIds(entrada.data);
          // O importador nativo gera uma referência de lote somente para seu
          // evento de auditoria; não é identificador de um cadastro preexistente.
          if (propriedade === "historicoCadastroVenda" && entrada.data && typeof entrada.data === "object" && "entidade" in entrada.data && entrada.data.entidade === "IMPORTACAO" && "registroId" in entrada.data && typeof entrada.data.registroId === "string") capturarIds({ id: entrada.data.registroId });
        }
        const saida = await fn.call(delegate, entrada);
        if (saida && typeof saida === "object" && "updatedAt" in saida && saida.updatedAt instanceof Date) versoesGeradas.add(saida.updatedAt.toISOString());
        if (metodo.startsWith("create") || criarViaUpsert) capturarIds(saida);
        eventos.push({ modelo: propriedade, operacao: metodo, entrada, saida }); return saida;
      };
    } }));
    return modelos.get(propriedade);
  } });
  // Datas automáticas de crédito são produzidas pelo serviço na execução;
  // a concessão conserva a data escolhida e títulos normais conservam vencimentos.
  const eventoAssinavel = (e: typeof eventos[number]) => {
    if (e.operacao !== "create" || !e.entrada || typeof e.entrada !== "object" || !("data" in e.entrada)) return e;
    const dados = e.entrada.data;
    if (!dados || typeof dados !== "object") return e;
    const campos = e.modelo === "creditoClienteMovimento" && "tipo" in dados && ["AJUSTE_DEBITO", "AJUSTE_CREDITO", "LIBERACAO", "APLICACAO"].includes(String(dados.tipo)) ? ["data"]
      : e.modelo === "lancamentoFinanceiro" && "pedidoQuitadoCredito" in dados && dados.pedidoQuitadoCredito === true ? ["dataVencimento", "dataPagamento"] : [];
    if (!campos.length) return e;
    const automatico = (v: unknown) => !v || typeof v !== "object" ? v : Object.fromEntries(Object.entries(v).map(([k, valor]) => [k, campos.includes(k) && valor instanceof Date ? "data-gerada-no-momento-da-execucao" : valor]));
    return { ...e, entrada: { ...e.entrada, data: automatico(dados) }, saida: automatico(e.saida) };
  };
  const referencias = new Set(["id", "pedidoVendaId", "lancamentoFinanceiroId", "lancamentoId", "contaBancariaId", "insumoId", "localEstoqueId", "produtoVendaId", "trabalhoId", "pontoImpressaoId"]);
  const estados = new Set(["status", "estado", "tipo", "ativo", "quantidade", "quantidadeContada", "saldoAtual", "data", "dataPagamento", "dataCompetencia", "dataVencimento", "vencimento", "copias", "unidade", "canceladoEm", "entregueEm"]);
  const valores = new Set(["valor", "saldoInicial", "saldo", "total", "subtotal", "frete", "desconto", "preco"]);
  const custos = new Set(["custoUnitario", "custoTotal", "custoMedio"]);
  // Apenas identificadores, estados e medidas necessários à revisão. Nunca
  // copiar descrições, documentos, snapshots, etiquetas ZPL ou respostas inteiras.
  const projetar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.slice(0, 100).map(projetar);
    if (!v || typeof v !== "object") return {};
    return Object.fromEntries(Object.entries(v).filter(([k]) => referencias.has(k) || estados.has(k) || mostrarFinanceiro && valores.has(k) || mostrarCustos && custos.has(k)).map(([k, valor]) => [k, normalizar(valor, k)]));
  };
  return { tx, resumo: () => ({ assinatura: hashCredencial(JSON.stringify(normalizar(eventos.map(eventoAssinavel)))), operacoes: eventos.map(e => ({ registro: e.modelo, operacao: e.operacao,
    referencia: projetar(e.entrada && typeof e.entrada === "object" && "where" in e.entrada ? e.entrada.where : {}),
    alteracoes: projetar(e.entrada && typeof e.entrada === "object" && "data" in e.entrada ? e.entrada.data : {}), resultado: projetar(e.saida) })) }) };
}
