export const prepararFaturaAction=async()=>({erro:"Prévia visual: use o ambiente de teste integrado para importar arquivos."});
export const identificarFaturaAction=async()=>({identificacao:{cartaoId:null,formato:"PDF",quantidade:3,cabecalho:{banco:"ITAU",conflitos:[],dados:Object.fromEntries(Object.entries({competencia:"2026-09",total:"150.00",inicio:"2026-08-03",fim:"2026-09-02",fechamento:"2026-09-02",vencimento:"2026-09-15",final:"1234"}).map(([k,v])=>[k,{valor:v,origem:"PDF",evidencia:"Simulação visual; não representa leitura do arquivo selecionado."}]))}}});
export const importarFaturaAction=prepararFaturaAction;
export const classificarFaturaAction=async()=>({ok:true});
export const correspondenciasFaturaAction=async(_id?:string,_item?:string,outrosCartoes=false)=>({candidatos:outrosCartoes?[{id:"outro",descricao:"NFS-e fictícia pendente",valor:10000,data:"2026-09-01",vencimento:"2026-09-15",versao:"visual",cartaoId:"outro-cartao",cartaoNome:"Cartão Mastercard fictício",podeCorrigirCartao:true,notaGrupo:null,correspondencia:null}]:new URLSearchParams(location.search).has("paga")?[{id:"pendente",descricao:"Despesa correta fictícia",valor:10000,data:"2026-09-01",vencimento:"2026-09-15",versao:"visual",notaGrupo:null,correspondencia:null}]:[],estornos:[],sugestao:{categoriaId:"cat",fornecedorId:"for",centroCustoId:"cc",motivo:"Regra Software (EXATO)",origem:"EXPLICITA"}});
export const vincularFaturaAction=classificarFaturaAction;
export const pagarFaturaAction=classificarFaturaAction;
export const desfazerPagamentoFaturaAction=classificarFaturaAction;
export const ajustarItemFaturaAction=classificarFaturaAction;
export const cancelarFaturaAction=classificarFaturaAction;
export const salvarRegraFaturaAction=classificarFaturaAction;

export const saveFornecedorAction=async()=>({error:null,fornecedor:{id:"novo",nome:"Fornecedor fictício",tipo:"FORNECEDOR"}});
export const salvarBeneficiarioAction=saveFornecedorAction;
export const createCanalPedidoAction=async()=>({error:null});
export const createFormaPagamentoAction=async()=>({error:null});

export const corrigirCartaoDespesaAction=classificarFaturaAction;

export const concluirDespesasFaturaAction=classificarFaturaAction;

export const compensarItensFaturaAction=classificarFaturaAction;
export const desfazerCompensacaoFaturaAction=classificarFaturaAction;
