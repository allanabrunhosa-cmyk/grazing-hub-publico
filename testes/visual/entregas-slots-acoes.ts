export async function buscarCepEntregaAction() { return { endereco: { logradouro: "Rua sintética", bairro: "Centro fictício", cidade: "São Paulo", uf: "SP" } }; }
export const buscarCepPedidoAction = buscarCepEntregaAction;
export const buscarCepLojaAction = buscarCepEntregaAction;
export async function salvarConfiguracaoLojaAction() { return { ok: true }; }
export async function salvarEntregasAction(config: unknown, versao: number) { return { config, versao: versao + 1 }; }
export async function simularEntregaAction() { return { erro: "Prévia sintética sem chamadas de mapas." }; }
export async function calcularFretePedidoAction(dados?: { veiculoEntregaId?: string | null }) {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("erro-frete")) return { erro: "Falha sintética do cálculo. Tente novamente." };
  const id = dados?.veiculoEntregaId || "m", perfil = id === "c" ? "CARRO" : "MOTO", nome = id === "c" ? "Carro" : "Moto", frete = id === "c" ? "24.00" : "22.00";
  return { resultado: { memoria: { frete, estado: "PERMITIDO", motivo: "Frete sintético", precoFaixa: frete }, rota: null,
    recibo: "recibo-sintetico", calculadoEm: new Date().toISOString(), validoAte: new Date(Date.now() + 600000).toISOString(),
    versao: 1, origemInformada: "Origem sintética", veiculo: perfil,
    selecaoVeiculo: { id, nome, perfil, modelo: "SLOTS", escolha: dados?.veiculoEntregaId ? "OPERADOR" : "SLOTS", slotsOcupados: dados?.veiculoEntregaId ? null : 2, regraId: null, embalagens: [] } } };
}
