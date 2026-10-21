import type { ClienteEntrada } from "@/lib/vendas/dominio";

export type ResumoPedidosCliente = {
  ultimoPedido: string | null;
  quantidadePedidos: number;
  valorTotalGasto: string;
};

export type ContatoClienteConsulta = { id: string; nome: string; primeiroNome: string | null; sobrenome: string | null; email: string | null; telefone: string | null };
export type ClienteConsulta = ClienteEntrada & { resumoPedidos?: ResumoPedidosCliente | null; contatosEmpresa?: ContatoClienteConsulta[]; emailsAlternativos?: string[]; documentosAlternativos?: string[] };

export type FormaPagamentoCliente = { id: string; nome: string; tipo: string; ativo: boolean };

export type HistoricoPedidosCliente = {
  pedidos: {
    id: string;
    numero: number;
    status: string;
    dataPedido: string;
    baseDataPedido: "COMPRA" | "CRIACAO_HISTORICA" | "CONFIRMACAO" | "CRIACAO";
    previsaoData: string | null;
    previsaoJanela: string | null;
    entregueEm: string | null;
    fusoHorario: string;
    total: string;
  }[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
};

export type CreditoClienteConsulta = {
  saldo: number;
  movimentos: {
    id: string;
    tipo: string;
    valor: number;
    data: string;
    pedidoNumero: number | null;
    motivo: string | null;
    referenciaComunicacao: string | null;
  }[];
};
