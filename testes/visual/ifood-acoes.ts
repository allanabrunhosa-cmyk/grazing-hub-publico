export const prepararAcompanhamentoIfoodAction = async () => ({ erro: "Simulação: acompanhamento permanece pausado." });
const falha = async () => ({ erro: "Simulação: sem conexão com iFood. Confira a autorização no Portal." });
export const configurarIfoodAction=falha, iniciarVinculoIfoodAction=falha, concluirVinculoIfoodAction=falha, listarLojasIfoodAction=falha, vincularLojaIfoodAction=falha, ativarLojaIfoodAction=falha, acaoPedidoIfoodAction=falha, gerarFinanceiroIfoodAction=falha;
export async function motivosIfoodAction() { return {ok:true,motivos:[{codigo:"501",descricao:"Motivo sintético para teste de interface"}]}; }

export const renovarAutorizacaoIfoodAction=falha,retomarEventosIfoodAction=falha;
export const estadoLojaIfoodAction=falha;

export const solicitarMerchantIfoodAction=falha,conferirAcaoIfoodAction=falha;
export async function consultarMerchantIfoodAction(){return{ok:true,dados:{fusoHorario:"America/Sao_Paulo",consultadoEm:"2026-10-07T02:40:00Z",hashHorarios:"sintetico",pausas:[],horarios:{storeId:"sintetico",shifts:[{dayOfWeek:"MONDAY",start:"09:00:00",duration:120,enabled:true},{dayOfWeek:"MONDAY",start:"14:00:00",duration:120,enabled:true}]},acoes:[]}};}
export const salvarFinanceiroConfigIfoodAction = falha;
export async function detalhesMerchantIfoodAction() {
  if (location.search.includes("detalhes-carregando")) await new Promise(r => setTimeout(r, 10000));
  if (location.search.includes("detalhes-erro")) return { erro: "Falha simulada. Confira a autorização e tente novamente." };
  const vazio = location.search.includes("detalhes-vazio");
  return { ok: true, dados: { consultadoEm: "2026-10-12T23:30:00Z", fusoHorario: "America/Sao_Paulo", detalhes: {
    id: "11111111-1111-4111-8111-111111111111", nome: vazio ? null : "Loja sintética de homologação com nome longo para conferir a quebra no celular",
    razaoSocial: vazio ? null : "Empresa sintética de alimentos e serviços", descricao: vazio ? null : "Descrição sintética. Nenhuma chamada ao iFood neste ambiente visual.",
    tipo: vazio ? null : "RESTAURANT", estadoCadastro: vazio ? null : "AVAILABLE", criadoEm: vazio ? null : "2026-10-12T10:30:00", teste: vazio ? null : "TEST", ticketMedio: vazio ? null : 85.5, exclusivo: vazio ? null : false,
    endereco: vazio ? null : { pais: "BR", estado: "SP", cidade: "Cidade sintética", bairro: "Bairro de demonstração", rua: "Rua sintética com identificação longa", numero: "100", complemento: "Sala de demonstração", cep: "00000-000", latitude: -23.5, longitude: -46.3 },
    operacoes: vazio ? [] : [{ nome: "DELIVERY", canais: [{ nome: "MARKETPLACE", habilitado: true }, { nome: "WHATSAPP", habilitado: false }] }],
  } } };
}
