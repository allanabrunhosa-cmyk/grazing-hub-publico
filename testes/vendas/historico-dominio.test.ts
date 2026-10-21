import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ORIGEM_HISTORICA, LOJA_HISTORICA, conferirCalculosHistoricos, dataHistoricaSaoPaulo, ehPedidoHistorico, hashCanonico, identidadeComprador, normalizarNome, validarPacoteHistorico, itensHistoricosEfetivos, totaisHistoricosEfetivos, hashVersaoRegistro, type DataHistorica, type ItemHistorico, type PacoteHistorico, type RegistroHistorico } from "@/lib/vendas/historico-dominio";
import { validarComplementoRegistro } from "@/lib/vendas/historico-complemento";
import { fixtureComplementoHistorico } from "./historico-complemento.fixture";

const D = Prisma.Decimal;
const epoch = Date.UTC(1899, 11, 30);
const colunas = ["K L M N", "O P Q R", "S T U V", "W X Y Z", "AA AB AC AD", "AE AF AG AH", "AI AJ AK AL", "AM AN AO AP", "AQ AR AS AT", "AU AV AW AX"].map(v => v.split(" "));
function data(local = "2026-08-01T00:00:00"): DataHistorica {
  return {serial_original:new D(Date.parse(local + "Z") - epoch).div(86400000).toString(),local_exato:local,local_segundo:local,exibicao_minuto:local.slice(0,16).replace("T"," "),mes:local.slice(0,7),fuso_hipotese:"America/Sao_Paulo",conversao_fuso_aplicada:false,metodo:"fixture_serial_local"};
}
type Opcoes = {numero?:string;linha?:number;data?:DataHistorica;pago?:DataHistorica|null;itens?:{bloco:number;nome:string;quantidade:string|null;preco:string|null;desconto:string|null}[];frete?:string;subtotal?:string;total?:string;nome?:string;email?:string|null;emailAlternativo?:string|null;telefone?:string|null};
function registro(o: Opcoes = {}): RegistroHistorico {
  const linha=o.linha ?? 2,numero=o.numero ?? "22851",criado=o.data ?? data(),pago=o.pago === undefined ? data("2026-08-02T00:00:00") : o.pago;
  const valores: (string|null)[] = Array(59).fill(null);valores[0]="usuario-ficticio";valores[1]=o.nome ?? "Pessoa Fictícia";valores[2]="Endereço fictício de cobrança C";valores[4]=criado.serial_original;valores[5]=pago?.serial_original ?? null;valores[6]=o.telefone === undefined ? "+5511900000001" : o.telefone;valores[7]="Endereço fictício de cobrança H";valores[8]=numero;valores[9]="Não comprovado no banco";valores[53]="referencia-ficticia";valores[54]="Status do pedido alterado de Pago para Retirado.\nStatus do pedido alterado de Proposta negada para Pago.";valores[55]="Destinatária Fictícia";valores[56]=o.email === undefined ? "pessoa@example.invalid" : o.email;valores[58]=o.emailAlternativo ?? null;
  const origemItens=o.itens ?? [{bloco:1,nome:"Produto fictício maior",quantidade:"2",preco:"902.33",desconto:"13.34"},{bloco:2,nome:"Produto fictício menor",quantidade:"1",preco:"392.34",desconto:"6.66"}];
  let liquido=new D(0),descontos=new D(0);
  const itens:ItemHistorico[]=origemItens.map(i=>{
    const originais=[i.nome,i.quantidade,i.preco,i.desconto],inicio=10+(i.bloco-1)*4;originais.forEach((v,j)=>{valores[inicio+j]=v;});
    const net=i.quantidade!==null&&i.preco!==null?new D(i.quantidade).times(i.preco):null,desc=new D(i.desconto ?? 0);liquido=liquido.plus(net ?? 0);descontos=descontos.plus(desc);
    return {bloco:i.bloco,colunas:colunas[i.bloco-1],linha,originais,nome_original:i.nome,nome_normalizado:i.nome,chave_nome:i.nome.toLowerCase(),quantidade:i.quantidade,preco_unitario_liquido:i.preco,desconto_linha:i.desconto,desconto_ausente:i.desconto===null,liquido_linha:net?.toString() ?? null,bruto_linha_reconstruido:net?.plus(desc).toString() ?? null,incompleto:i.quantidade===null||i.preco===null,produto_externo_nao_identificado:false,consumo_apurado:null,custo_historico_comprovado:null};
  });
  const bruto=liquido.plus(descontos),frete=new D(o.frete ?? 22),subtotal=new D(o.subtotal ?? bruto),total=new D(o.total ?? liquido.plus(frete)),difProdutos=subtotal.minus(bruto),difTotal=total.minus(liquido).minus(frete),naoDetalhado=D.max(difProdutos,0);
  valores[50]=subtotal.toString();valores[51]=frete.toString();valores[52]=total.toString();
  const emails=[{origem:"BE",original:valores[56],normalizado:valores[56]?.toLowerCase() ?? null,valido_sintaticamente:!!valores[56]},{origem:"BG",original:valores[58],normalizado:valores[58]?.toLowerCase() ?? null,valido_sintaticamente:!!valores[58]}];
  const telefones=[{origem:"G",original:valores[6],digitos_preservados:valores[6]?.replace(/\D/g,"") ?? null,pais_explicito:valores[6]?"BR":null,e164:valores[6],normalizacao:"fixture_sem_inferencia",plausivel:!!valores[6]},{origem:"BF",original:null,digitos_preservados:null,pais_explicito:null,e164:null,normalizacao:"nao_informado",plausivel:false}];
  return {linha,numero_original:numero,origem:ORIGEM_HISTORICA,chave_deduplicacao:ORIGEM_HISTORICA+":"+numero,hash_linha:hashCanonico(valores),raw:{linha,valores,celulas:{}},data_criacao:criado,pagamento_informado:pago,liquidacao_comprovada:null,metodo_pagamento_original:valores[9],transaction_id_original:valores[53],itens,quantidade_blocos:itens.length,
    totais:{liquido_itens:liquido.toString(),desconto_itens:descontos.toString(),bruto_reconstruido:bruto.toString(),subtotal_produtos_original:subtotal.toString(),frete_ajuste_original:frete.toString(),total_original:total.toString(),total_calculado_itens_mais_frete:liquido.plus(frete).toString(),diferenca_produtos:difProdutos.toString(),diferenca_total:difTotal.toString(),valor_historico_nao_detalhado:naoDetalhado.toString(),diferenca_total_apos_nao_detalhado:difTotal.minus(naoDetalhado).toString(),frete_classificacao:frete.lt(0)?"ajuste_legado_a_classificar":"frete_cobrado_legado",custo_logistico:null,zero_final_preservado:total.isZero()},
    comprador:{nome_cobranca:valores[1],nome_usuario_original:valores[0],empresa:null,emails,telefones,identificavel:true,conflitos_identidade:[]},destinatario:{nome_entrega_original:valores[55],emails:[],telefones:[],contato_comprador_atribuido:false},enderecos:[{origem:"C",original:valores[2],texto:valores[2],finalidade:"cobranca_cabecalho",entrega_confirmada:false},{origem:"H",original:valores[7],texto:valores[7],finalidade:"cobranca_cabecalho",entrega_confirmada:false}],notas_originais:valores[54],status:{final_legado:"Retirado",regra:"ordem_reversa_validada_por_cadeia_completa",transicoes:[{de:"Pago",para:"Retirado"},{de:"Proposta negada",para:"Pago"}],nf_autenticada:false},excecoes:[],efeitos_operacionais_autorizados:false,estado_importacao:"preparado_sem_gravacao_operacional"};
}
function pacote(registros=[registro()]):PacoteHistorico {return {metadados:{sha256:"a".repeat(64),origem_identidade_estavel:ORIGEM_HISTORICA,lote_proposto:"lote-sintetico",registros:registros.length,pedidos_unicos:registros.length,itens:registros.reduce((n,r)=>n+r.itens.length,0),unidades:registros.flatMap(r=>r.itens).reduce((n,i)=>n.plus(i.quantidade ?? 0),new D(0)).toString()},registros,cabecalhos:{linha:1,valores:Array.from({length:59},(_,i)=>i===2||i===7?"Full Adress (Billing)":"Coluna "+i)}};}
function endereco(r:RegistroHistorico, valor:string) { r.raw.valores[2]=valor;r.raw.valores[7]=valor;for(const e of r.enderecos){e.original=valor;}r.hash_linha=hashCanonico(r.raw.valores); }
function notas(r:RegistroHistorico, valor:string) { r.raw.valores[54]=valor;r.notas_originais=valor;r.hash_linha=hashCanonico(r.raw.valores); }

describe("domínio da importação histórica",()=>{
  it("marca somente a origem histórica conhecida e conserva outras integrações",()=>{
    expect(ORIGEM_HISTORICA).toBe("grazing-legado-orders");expect(LOJA_HISTORICA).toBe("grazing-hub");
    expect(ehPedidoHistorico({origem:"HISTORICO_LEGADO"})).toBe(true);expect(ehPedidoHistorico({referenciaOrigem:ORIGEM_HISTORICA})).toBe(true);
    expect(ehPedidoHistorico({origem:"IFOOD",referenciaOrigem:"ifood-pedido-1"})).toBe(false);expect(ehPedidoHistorico({status:"CONFIRMADO"})).toBe(false);
  });
  it("22851: preço já líquido e desconto total da linha não recebem segundo desconto",()=>{
    const p=validarPacoteHistorico(pacote());expect(conferirCalculosHistoricos(p.registros[0])).toMatchObject({liquidoItens:"2197.00",descontoItens:"20.00",brutoReconstruido:"2217.00",freteOriginal:"22.00",totalOriginal:"2219.00"});
    const errado=pacote();errado.registros[0].totais.total_calculado_itens_mais_frete="2199";expect(()=>validarPacoteHistorico(errado)).toThrow("CALCULO_DIVERGENTE");
  });
  it("20138 mantém criação de 2025 e pagamento informado em 2026",()=>{
    const r=registro({numero:"20138",data:data("2025-12-30T00:00:00"),pago:data("2026-01-06T00:00:00")}),p=validarPacoteHistorico(pacote([r]));
    expect(p.registros[0].data_criacao.mes).toBe("2025-12");expect(p.registros[0].pagamento_informado?.mes).toBe("2026-01");
    expect(()=>validarPacoteHistorico(pacote([registro({numero:"20138"})]))).toThrow("CRIACAO_FORA_PERIODO");
  });
  it("rejeita eventos posteriores a setembro sem retrodatá-los",()=>{
    expect(()=>validarPacoteHistorico(pacote([registro({pago:data("2026-10-01T00:00:00")})]))).toThrow("PAGAMENTO_FORA_PERIODO");
    expect(()=>validarPacoteHistorico(pacote([registro({data:data("2026-10-01T00:00:00")})]))).toThrow("CRIACAO_FORA_PERIODO");
    expect(()=>validarPacoteHistorico(pacote([registro({numero:"20139",data:data("2025-12-30T00:00:00")})]))).toThrow("CRIACAO_FORA_PERIODO");
  });
  it("serial local conserva microsegundos apesar do metadado Los Angeles",()=>{
    const d:DataHistorica={...data(),serial_original:"46295.716273148",local_exato:"2026-09-30T17:11:25.999987",local_segundo:"2026-09-30T17:11:26",exibicao_minuto:"2026-09-30 17:11",mes:"2026-09"};
    const p=pacote([registro({data:d,pago:null})]);p.metadados.timeZone="America/Los_Angeles";
    expect(validarPacoteHistorico(p).registros[0].data_criacao.local_exato).toBe(d.local_exato);expect(dataHistoricaSaoPaulo(d).toISOString()).toBe("2026-09-30T20:11:25.999Z");
    p.registros[0].data_criacao.local_exato="2026-09-30T18:11:25.999987";p.registros[0].data_criacao.exibicao_minuto="2026-09-30 18:11";expect(()=>validarPacoteHistorico(p)).toThrow("SERIAL_DESLOCADO");
  });
  it("hora exata antes da meia-noite conserva dia e mês na persistência",()=>{
    const d:DataHistorica={...data(),serial_original:"46295.999999999988426",local_exato:"2026-09-30T23:59:59.999999",local_segundo:"2026-10-01T00:00:00",exibicao_minuto:"2026-09-30 23:59",mes:"2026-09"};
    expect(validarPacoteHistorico(pacote([registro({data:d,pago:null})])).registros[0].data_criacao.mes).toBe("2026-09");
    expect(dataHistoricaSaoPaulo(d).toISOString()).toBe("2026-10-01T02:59:59.999Z");
  });
  it("mantém 59 posições, C e H repetidos, HTML e campos desconhecidos como dados",()=>{
    const p=pacote();p.registros[0].campo_legado_sem_equivalente={observacao:"<script>nao executar</script>",formula:"=DDE(...)"};
    const validado=validarPacoteHistorico(p);expect(validado.registros[0].raw.valores).toHaveLength(59);expect(validado.registros[0].enderecos.map(e=>e.origem)).toEqual(["C","H"]);expect(validado.registros[0].campo_legado_sem_equivalente).toEqual(p.registros[0].campo_legado_sem_equivalente);
    p.registros[0].raw.valores.pop();expect(()=>validarPacoteHistorico(p)).toThrow("RAW_POSICOES_INVALIDAS");
  });
  it("lê o décimo bloco mesmo após vazios e preserva itens de mesmo nome",()=>{
    const r=registro({itens:[{bloco:1,nome:"Mini quiche",quantidade:"2",preco:"10",desconto:"0"},{bloco:10,nome:"Mini quiche",quantidade:"3",preco:"12",desconto:"0"}]}),p=validarPacoteHistorico(pacote([r]));
    expect(p.registros[0].itens.map(i=>i.bloco)).toEqual([1,10]);expect(p.registros[0].itens).toHaveLength(2);
    r.itens.pop();r.quantidade_blocos=1;expect(()=>validarPacoteHistorico(pacote([r]))).toThrow("BLOCO_OMITIDO");
  });
  it("dez blocos com diferença conservam parcela não detalhada sem criar produto",()=>{
    const itens=Array.from({length:10},(_,i)=>({bloco:i+1,nome:"Item fictício "+i,quantidade:"1",preco:"10",desconto:"0"}));
    const p=validarPacoteHistorico(pacote([registro({numero:"21923",itens,subtotal:"678",frete:"22",total:"700"})]));
    expect(conferirCalculosHistoricos(p.registros[0])).toMatchObject({valorNaoDetalhado:"578.00",ajusteLegadoAClassificar:"0.00"});expect(p.registros[0].itens).toHaveLength(10);
  });
  it("diferença final 54 vira ajuste legado, separado dos produtos",()=>{
    const r=registro({numero:"20261",itens:[{bloco:1,nome:"Item conhecido",quantidade:"1",preco:"100",desconto:"0"}],subtotal:"100",frete:"22",total:"176"});
    expect(conferirCalculosHistoricos(validarPacoteHistorico(pacote([r])).registros[0])).toMatchObject({valorNaoDetalhado:"0.00",ajusteLegadoAClassificar:"54.00"});
  });
  it("frete negativo e pedido gratuito mantêm sinal, zero e unidades atendidas",()=>{
    const r=registro({itens:[{bloco:1,nome:"Pedido gratuito",quantidade:"2",preco:"50",desconto:"0"}],frete:"-100",total:"0"}),p=validarPacoteHistorico(pacote([r]));
    expect(conferirCalculosHistoricos(p.registros[0])).toMatchObject({freteOriginal:"-100.00",totalOriginal:"0.00"});expect(p.metadados.unidades).toBe("2");expect(p.registros[0].status.final_legado).toBe("Retirado");
  });
  it("bloco incompleto conserva ausência e não inventa quantidade ou consumo",()=>{
    const r=registro({itens:[{bloco:1,nome:"Item incompleto",quantidade:null,preco:"10",desconto:null}],frete:"0",total:"0"});
    expect(validarPacoteHistorico(pacote([r])).registros[0].itens[0]).toMatchObject({quantidade:null,incompleto:true,liquido_linha:null,consumo_apurado:null});
    r.itens[0].liquido_linha="10";expect(()=>validarPacoteHistorico(pacote([r]))).toThrow("INCOMPLETO_COM_VALOR_INVENTADO");
  });
  it("valores devem ser finitos, monetários com 2 casas e quantidades com 6",()=>{
    for(const invalido of ["NaN","Infinity","-Infinity","1.001","1e3"]){const p=pacote();p.registros[0].totais.total_original=invalido;expect(()=>validarPacoteHistorico(p)).toThrow();}
    const fracionado=registro({itens:[{bloco:1,nome:"Porção",quantidade:"0.125",preco:"8",desconto:"0"}]});expect(validarPacoteHistorico(pacote([fracionado])).metadados.unidades).toBe("0.125");
    fracionado.itens[0].quantidade="0.1234567";expect(()=>conferirCalculosHistoricos(fracionado)).toThrow("QUANTIDADE_INVALIDA");
  });
  it("hash identifica conteúdo, mas não cria identidade nova na versão corrigida",()=>{
    const a=registro(),b=structuredClone(a);b.raw.valores[54]="Observação corrigida";b.notas_originais=b.raw.valores[54];b.hash_linha=hashCanonico(b.raw.valores);
    expect(a.hash_linha).not.toBe(b.hash_linha);expect(a.chave_deduplicacao).toBe(b.chave_deduplicacao);expect(identidadeComprador(a).chave).toBe(identidadeComprador(b).chave);expect(hashCanonico({b:2,a:1})).toBe(hashCanonico({a:1,b:2}));
    const adulterado=pacote();adulterado.registros[0].raw.valores[54]="Mudou sem atualizar hash";expect(()=>validarPacoteHistorico(adulterado)).toThrow("HASH_LINHA_DIVERGENTE");
  });
  it("rejeita pedido duplicado, hash da fonte inválido e totais de contagem divergentes",()=>{
    expect(()=>validarPacoteHistorico(pacote([registro(),registro({linha:3})]))).toThrow("PEDIDO_DUPLICADO");
    const p=pacote();p.metadados.sha256="invalido";expect(()=>validarPacoteHistorico(p)).toThrow("FONTE_INVALIDA");p.metadados.sha256="a".repeat(64);p.metadados.itens=9;expect(()=>validarPacoteHistorico(p)).toThrow("CONTAGENS_DIVERGENTES");
  });
  it("comprador, destinatário e endereço sem prova conservam papéis distintos",()=>{
    const p=pacote();expect(identidadeComprador(p.registros[0]).nome).toBe("Pessoa Fictícia");p.registros[0].destinatario.contato_comprador_atribuido=true;expect(()=>validarPacoteHistorico(p)).toThrow("DESTINATARIO_INFERIDO");
    const e=pacote();e.registros[0].enderecos[1].entrega_confirmada=true;expect(()=>validarPacoteHistorico(e)).toThrow("ENDERECO_ENTREGA_NAO_COMPROVADO");
  });
  it("nome conserva acentos e não é sozinho uma chave de pessoa",()=>{
    expect(normalizarNome("  JOÃO\tＤＡ  Silva ")).toBe("joão da silva");expect(normalizarNome("João")).not.toBe(normalizarNome("Joao"));
    const a=registro({email:null,telefone:null}),b=registro({numero:"22852",linha:3,email:null,telefone:null});expect(identidadeComprador(a).chave).not.toBe(identidadeComprador(b).chave);
    const vazio=registro({nome:"",email:null,telefone:null});expect(identidadeComprador(vazio).nome).toBe("");
  });
  it("e-mails divergentes ficam preservados e conflito de telefone bloqueia união",()=>{
    const r=registro({emailAlternativo:"alternativo@example.invalid"});expect(identidadeComprador(r)).toMatchObject({emails:["alternativo@example.invalid","pessoa@example.invalid"],regra:"identidade_por_documento_legado"});
    const p=validarPacoteHistorico(pacote([registro({email:null}),registro({numero:"22852",linha:3,nome:"Outra Pessoa",email:null})]));
    expect(p.registros.every(r=>identidadeComprador(r).conflitos.includes("telefone_associado_a_nomes_diferentes"))).toBe(true);expect(identidadeComprador(p.registros[0]).chave).not.toBe(identidadeComprador(p.registros[1]).chave);
  });
  it("reconcilia totais mensais uma vez por pedido e recusa soma repetida por item",()=>{
    const p=pacote(),r=p.registros[0];p.metadados.por_criacao=[{mes:"2026-08",pedidos:1,pedidos_unicos:1,itens:2,unidades:"3",pedidos_total_zero:0,fretes_negativos:0,valores:Object.fromEntries(["liquido_itens","desconto_itens","bruto_reconstruido","subtotal_produtos_original","frete_ajuste_original","total_original","diferenca_produtos","diferenca_total","valor_historico_nao_detalhado"].map(k=>[k,r.totais[k] as string]))}];
    expect(validarPacoteHistorico(p).registros).toHaveLength(1);p.metadados.por_criacao[0].valores.total_original="4438";expect(()=>validarPacoteHistorico(p)).toThrow("CALCULO_DIVERGENTE");
  });
  it("deriva emails e dígitos do raw mesmo quando as classificações são adulteradas",()=>{
    const r=registro(),esperada=identidadeComprador(r);r.comprador.emails[0].normalizado="outro@example.invalid";r.comprador.emails[0].valido_sintaticamente=false;r.comprador.telefones[0].digitos_preservados="999999999999";r.comprador.telefones[0].plausivel=false;
    expect(identidadeComprador(r)).toMatchObject({chave:esperada.chave,emails:esperada.emails,telefones:esperada.telefones});
    const validado=validarPacoteHistorico(pacote([r])).registros[0];expect(validado.comprador.emails[0]).toMatchObject({normalizado:"pessoa@example.invalid",valido_sintaticamente:true});expect(validado.comprador.telefones[0]).toMatchObject({digitos_preservados:"5511900000001",plausivel:true});
    expect(r.comprador.emails[0].normalizado).toBe("outro@example.invalid");
  });
  it("contato extra sem célula correspondente não entra na identidade",()=>{
    const r=registro();r.comprador.emails.push({...r.comprador.emails[0],origem:"EXTRA",normalizado:"injetado@example.invalid"});
    expect(()=>validarPacoteHistorico(pacote([r]))).toThrow("LISTA_INVALIDA");
    r.comprador.emails.pop();r.comprador.emails[0].original="mudou@example.invalid";expect(()=>validarPacoteHistorico(pacote([r]))).toThrow("EMAIL_ORIGEM_DIVERGENTE");
  });
  it("decodifica entidades de contato e produto sem executar conteúdo",()=>{
    const r=registro({email:"Pessoa&#64;example.invalid",itens:[{bloco:1,nome:"Pão &amp; queijo &#233;",quantidade:"1",preco:"10",desconto:"0"}]});
    const v=validarPacoteHistorico(pacote([r])).registros[0];expect(v.comprador.emails[0].normalizado).toBe("pessoa@example.invalid");expect(v.itens[0]).toMatchObject({nome_normalizado:"Pão & queijo é",chave_nome:"pao & queijo e"});expect(v.raw.valores[10]).toBe("Pão &amp; queijo &#233;");
  });
  it("produto externo e nome de catálogo são calculados da célula original",()=>{
    const r=registro({itens:[{bloco:1,nome:" PRODUTO   EXTERNO ",quantidade:"1",preco:"10",desconto:"0"}]});r.itens[0].nome_normalizado="Produto de catálogo";r.itens[0].chave_nome="catalogo";r.itens[0].produto_externo_nao_identificado=false;r.itens[0].incompleto=true;r.itens[0].consumo_apurado="inventado";r.itens[0].custo_historico_comprovado="1";
    const v=validarPacoteHistorico(pacote([r])).registros[0].itens[0];expect(v).toMatchObject({nome_normalizado:"PRODUTO EXTERNO",chave_nome:"produto externo",produto_externo_nao_identificado:true,incompleto:false,consumo_apurado:null,custo_historico_comprovado:null});
    const comum=registro();comum.itens[0].produto_externo_nao_identificado=true;expect(validarPacoteHistorico(pacote([comum])).registros[0].itens[0].produto_externo_nao_identificado).toBe(false);
  });
  it("flag de incompleto não autoriza omitir um número original",()=>{
    const r=registro();r.itens[0].incompleto=true;r.itens[0].quantidade=null;expect(()=>validarPacoteHistorico(pacote([r]))).toThrow("ITEM_ORIGEM_DIVERGENTE");
  });
  it("status adulterado não comprova atendimento e transição antiga não vence cadeia completa",()=>{
    const r=registro();notas(r,"Status do pedido alterado de Proposta negada para Pago.");r.status.final_legado="Retirado";r.status.regra="ordem_reversa_validada_por_cadeia_completa";r.status.nf_autenticada=true;
    const v=validarPacoteHistorico(pacote([r])).registros[0];expect(v.status).toMatchObject({final_legado:"Pago",regra:"transicao_unica",nf_autenticada:false});
    const original=validarPacoteHistorico(pacote()).registros[0];expect(original.status).toMatchObject({final_legado:"Retirado",regra:"ordem_reversa_validada_por_cadeia_completa"});
  });
  it("HTML em script e cadeias ambíguas não produzem estado final",()=>{
    const r=registro();notas(r,"<script>Status do pedido alterado de Pago para Retirado.</script><p>Sem comprovação de status.</p>");expect(validarPacoteHistorico(pacote([r])).registros[0].status).toMatchObject({final_legado:null,regra:"sem_transicao"});
    notas(r,"Status do pedido alterado de Pago para Retirado.\nStatus do pedido alterado de Rascunho para Proposta negada.");expect(validarPacoteHistorico(pacote([r])).registros[0].status).toMatchObject({final_legado:null,regra:"cadeia_inconsistente_ou_ambigua_nao_derivar_final"});
  });
  it("status direto e constante são calculados sem confiar na ordem declarada",()=>{
    const r=registro();notas(r,"Status do pedido alterado de Proposta negada para Pago.\nStatus do pedido alterado de Pago para Retirado.");expect(validarPacoteHistorico(pacote([r])).registros[0].status).toMatchObject({final_legado:"Retirado",regra:"ordem_direta_validada_por_cadeia_completa"});
    notas(r,"Status do pedido alterado de Retirado para Retirado.\nStatus do pedido alterado de Retirado para Retirado.");expect(validarPacoteHistorico(pacote([r])).registros[0].status).toMatchObject({final_legado:"Retirado",regra:"estado_constante"});
  });
  it("não acrescenta país ou nono dígito por flags ou pelo complemento AP",()=>{
    const r=registro({telefone:"(11) 2345-6789"});endereco(r,"Pessoa Fictícia\nRua Fictícia, 10\nAP 123\nBrasil\n12345-678");r.comprador.telefones[0].pais_explicito="BR";r.comprador.telefones[0].pais_verificado="BR";r.comprador.telefones[0].e164="+5511923456789";r.enderecos[0].uf="AP";
    const v=validarPacoteHistorico(pacote([r])).registros[0];expect(v.comprador.telefones[0]).toMatchObject({digitos_preservados:"1123456789",pais_explicito:null,pais_verificado:null,e164:null,codigo_pais_acrescentado:false});expect(v.enderecos[0].uf).toBeNull();
  });
  it("UF municipal com CEP comprova país e conserva o telefone nacional de dez dígitos",()=>{
    const r=registro({telefone:"(11) 2345-6789"});endereco(r,"Pessoa Fictícia\nRua Fictícia, 10\nSão Paulo - SP\n12345-678");const v=validarPacoteHistorico(pacote([r])).registros[0];
    expect(v.comprador.telefones[0]).toMatchObject({digitos_preservados:"1123456789",e164:"+551123456789",pais_explicito:null,pais_verificado:"BR",codigo_pais_acrescentado:true,evidencia_pais:{uf:"SP",cep:"12345678",origem:"C",ddi_ja_presente:false}});expect(identidadeComprador(v).telefones).toEqual(["1123456789"]);
  });
  it("estado extenso no bloco postal comprova campos por posição, sem inventar bairro",()=>{
    const r=registro({telefone:"(11) 2345-6789"});endereco(r,"Pessoa Fictícia\nRua Fictícia, 10\nAP 12345678\nCidade Fictícia\nSão Paulo\n12345-678");const v=validarPacoteHistorico(pacote([r])).registros[0];
    expect(v.enderecos[0]).toMatchObject({logradouro:"Rua Fictícia",numero:"10",complemento:"AP 12345678",municipio:"Cidade Fictícia",uf:"SP",cep:"12345678",bairro:null,localidade_conflitante:false,provas_campos:{municipio:{confirmado:true},uf:{regra:"nome_estado_extenso_em_bloco_postal_apos_comprador"}}});expect(v.comprador.telefones[0]).toMatchObject({e164:"+551123456789",evidencia_pais:{uf:"SP",cep:"12345678"}});
    const prova=(v.comprador.telefones[0].evidencia_pais as {posicao_uf:number[]}).posicao_uf;expect((v.enderecos[0].texto ?? "").slice(prova[0],prova[1])).toBe("São Paulo");
  });
  it("estado extenso sem comprador ou município com dígitos não comprova país",()=>{
    for(const texto of ["Outra Pessoa\nRua Fictícia, 10\nCidade Fictícia\nSão Paulo\n12345-678","Pessoa Fictícia\nRua Fictícia, 10\nCidade 123\nSão Paulo\n12345-678"]){const r=registro({telefone:"(11) 2345-6789"});endereco(r,texto);expect(validarPacoteHistorico(pacote([r])).registros[0].comprador.telefones[0].e164).toBeNull();}
  });
  it("país estrangeiro e UFs conflitantes impedem acrescentar DDI",()=>{
    for(const texto of ["País: Argentina\nSão Paulo - SP\n12345-678","UF: SP\nUF: RJ\n12345-678"]){const r=registro({telefone:"(11) 2345-6789"});endereco(r,texto);const v=validarPacoteHistorico(pacote([r])).registros[0];expect(v.comprador.telefones[0].e164).toBeNull();expect(v.enderecos[0].localidade_conflitante).toBe(true);}
  });
  it("prefixos internacionais exportados são preservados e DDD inválido não prova Brasil",()=>{
    for(const [original,digitos,e164,pais] of [["00442012345678","442012345678","+442012345678",null],["+5511900000001","5511900000001","+5511900000001","BR"],["+5500900000001","5500900000001",null,null]] as const){const r=registro({telefone:original});const t=validarPacoteHistorico(pacote([r])).registros[0].comprador.telefones[0];expect(t).toMatchObject({original,digitos_preservados:digitos,e164,pais_explicito:pais,codigo_pais_acrescentado:false});}
  });
  it("conflitos declarados não substituem os conflitos recalculados do pacote",()=>{
    const a=registro(),b=registro({numero:"22852",linha:3,nome:"Outra Pessoa"});a.comprador.conflitos_identidade=[];b.comprador.conflitos_identidade=[];
    const v=validarPacoteHistorico(pacote([a,b]));expect(v.registros.every(r=>identidadeComprador(r).conflitos.includes("email_associado_a_nomes_diferentes"))).toBe(true);
    const unico=registro();unico.comprador.conflitos_identidade=["flag_adulterada"];unico.conflitos_identidade_validados=["flag_adulterada"];expect(identidadeComprador(validarPacoteHistorico(pacote([unico])).registros[0]).conflitos).toEqual([]);
  });
  it("complemento detalha a parcela sem alterar fonte, receita final ou contagens primárias",()=>{
    const f=fixtureComplementoHistorico(),antes=structuredClone(f.registro);f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);const p=validarPacoteHistorico(f.pacote),r=p.registros[0];
    expect(p.metadados.itens).toBe(10);expect(r.itens).toEqual(antes.itens);expect(r.totais).toEqual(antes.totais);expect(r.raw).toEqual(antes.raw);expect(r.hash_linha).toBe(antes.hash_linha);
    expect(itensHistoricosEfetivos(r)).toHaveLength(11);expect(totaisHistoricosEfetivos(r)).toMatchObject({liquido_itens:"205",desconto_itens:"25",bruto_reconstruido:"230",total_original:"200.00",valor_historico_nao_detalhado:"0",diferenca_total_apos_nao_detalhado:"0"});expect(hashVersaoRegistro(r)).not.toBe(r.hash_linha);expect(hashVersaoRegistro(antes)).toBe(antes.hash_linha);
  });
  it("helpers revalidam extras adulterados e vinculam o complemento à fonte principal",()=>{
    const f=fixtureComplementoHistorico();f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);const versao=hashVersaoRegistro(f.registro);f.registro.complemento.itens[0].preco_unitario_liquido="999";
    expect(itensHistoricosEfetivos(f.registro)[10].preco_unitario_liquido).toBe("12.50");expect(hashVersaoRegistro(f.registro)).toBe(versao);
    f.registro.complemento.prova.fontePrincipal.sha256="f".repeat(64);expect(()=>validarPacoteHistorico(f.pacote)).toThrow("COMPLEMENTO_FONTE_DIVERGENTE");
  });
});
