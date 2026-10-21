import { prepararSqlMigrationFiscal } from "../../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {Client} from "pg";
import {PrismaPg} from "@prisma/adapter-pg";
import {randomUUID} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import {PrismaClient} from "@/generated/prisma/client";
import type {SessaoAtual} from "@/lib/session";
const estado=vi.hoisted(()=>({prisma:null as unknown as PrismaClient}));
vi.mock("@/lib/prisma",()=>({get prisma(){return estado.prisma;}}));
vi.mock("server-only",()=>({}));
import {compensarItensFatura,desfazerCompensacaoFatura,concluirDespesasFatura,corrigirCartaoDespesa,prepararImportacao,importarFatura,classificarItens,vincularItem,selecionarExtratoFatura,conciliarFatura,desconciliarFatura,ajustarItem,cancelarFatura,consultarCorrespondencias,incluirFatura,resumir} from "@/lib/financeiro/faturas/servico";
import {detalheFatura,listarFaturas} from "@/lib/financeiro/faturas/consultas";
import {baixarLancamento} from "@/lib/financeiro/baixarLancamento";
import {identificarDadosFatura} from "@/lib/financeiro/faturas/servico";
import {pdfFicticio} from "./pdf-fixture";
const esquema="teste_faturas_"+randomUUID().replaceAll("-","");
let banco:Client|undefined;let criado=false;
const sessao={userId:"admin",versao:0,admin:true,permissoes:{},excecoes:{}} as SessaoAtual;
function formulario(csv="Data;Descrição;Valor\n01/09/2026;GOOGLE*GSUITE;100,00\n02/09/2026;COMPRA ABC;200,00",total="300.00",competencia="2026-09") {
 const f=new FormData();f.set("arquivo",new File([csv],"fatura.csv"));f.set("cartaoId","cartao");f.set("competencia",competencia);f.set("inicio",competencia+"-01");f.set("fim",competencia+"-10");f.set("fechamento",competencia+"-10");f.set("vencimento",competencia+"-20");f.set("total",total);return f;
}
async function importar(form=formulario()) {const p=await prepararImportacao(form);form.set("token",p.token);form.set("confirmar","sim");return importarFatura(form,sessao);}
const atual=(id:string)=>estado.prisma.faturaCartao.findUniqueOrThrow({where:{id},include:incluirFatura});
async function classificar(id:string) {const f=await atual(id);await classificarItens(id,f.versao,{ids:f.itens.map(i=>i.id),categoriaId:"categoria",fornecedorId:"fornecedor",centroCustoId:"centro",responsavelId:"admin"},sessao);}
async function desdobrar(id:string) {await classificar(id);for(const i of (await atual(id)).itens)await vincularItem(id,(await atual(id)).versao,i.id,{criar:true},sessao);}
async function transacao(valor:number) {const lote=await estado.prisma.importacaoExtrato.create({data:{contaBancariaId:"banco",nomeArquivo:"extrato.csv",hashArquivo:randomUUID(),formato:"CSV",autorId:"admin",autorNome:"Teste"}});return estado.prisma.transacaoExtrato.create({data:{contaBancariaId:"banco",importacaoId:lote.id,chave:randomUUID(),impressao:randomUUID(),data:new Date("2026-09-20T00:00:00Z"),descricao:"PAGAMENTO FATURA",valor:-valor}});}
async function pagar(id:string,valor:number,tipoPagamento:"INTEGRAL"|"PARCIAL"="INTEGRAL"){const t=await transacao(valor);await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);await conciliarFatura(id,(await atual(id)).versao,t.id,sessao,tipoPagamento);return t;}
// Simula pagamento do fluxo antigo somente no schema fictício local, sem despesas ainda.
async function pagamentoLegado(id:string,valor:number) {
 const t=await transacao(valor);
 const movimento=await estado.prisma.movimentacaoBancaria.create({data:{contaBancariaId:"banco",tipo:"SAIDA",valor,data:t.data,descricao:"Pagamento fictício já conciliado"}});
 await estado.prisma.transacaoExtrato.update({where:{id:t.id},data:{conciliadaEm:new Date(),conciliadaPorNome:"Teste"}});
 const pagamento=await estado.prisma.pagamentoFaturaCartao.create({data:{faturaId:id,transacaoId:t.id,movimentoId:movimento.id,valor,data:t.data,contaIdOriginal:"banco",transacaoIdOriginal:t.id,autorId:"admin",autorNome:"Teste"}});
 return {t,movimento,pagamento};
}

describe.skipIf(process.env.FATURAS_BANCO_TESTE!=="1")("faturas: PostgreSQL isolado",()=>{
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);if(!["localhost","127.0.0.1"].includes(url.hostname))throw new Error("Somente PostgreSQL local de teste.");
  banco=new Client({connectionString:url.toString()});await banco.connect();await banco.query(`CREATE SCHEMA "${esquema}"`);criado=true;await banco.query(`SET search_path TO "${esquema}"`);
  for(const p of (await readdir("prisma/migrations",{withFileTypes:true})).filter(p=>p.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`,"utf8")));
  estado.prisma=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString(),options:`-c search_path=${esquema}`},{schema:esquema})});
  expect(await estado.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{esquema}]);
 },60000);
 afterAll(async()=>{await estado.prisma?.$disconnect();if(!banco)return;await banco.query("ROLLBACK");if(criado){if(!/^teste_faturas_[a-f0-9]{32}$/.test(esquema))throw new Error("Schema inesperado");await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);}await banco.end();});
 beforeEach(async()=>{
  await banco!.query('TRUNCATE "FaturaCartao", "Usuario", "ContaBancaria", "Fornecedor", "CentroCusto", "RegraCartao", "ParcelamentoCartao" CASCADE');
  await estado.prisma.usuario.create({data:{id:"admin",nome:"Teste Fictício",email:"fatura@example.invalid",senhaHash:"sem-login",perfilAcessoId:"perfil-administrador"}});
  await estado.prisma.contaBancaria.create({data:{id:"banco",nome:"Banco fictício"}});await estado.prisma.cartaoCredito.create({data:{id:"cartao",nome:"Cartão fictício",contaBancariaId:"banco",diaFechamento:10,diaVencimento:20}});
  await estado.prisma.centroCusto.create({data:{id:"centro",nome:"Centro fictício"}});await estado.prisma.fornecedor.create({data:{id:"fornecedor",nome:"GOOGLE WORKSPACE"}});
  await estado.prisma.categoriaFinanceira.upsert({where:{id:"categoria"},create:{id:"categoria",nome:"Categoria fictícia",grupo:"DESPESAS_OPERACIONAIS"},update:{ativo:true}});
 });


 async function importarCompensacao(dataCredito="01/09/2026",valorCredito="-18,75",competencia="2026-09"){
   return importar(formulario(`Data;Descrição;Valor\n01/09/2026;ANUIDADE FICTÍCIA;18,75\n${dataCredito};CRÉDITO FICTÍCIO;${valorCredito}\n02/09/2026;OUTRA COMPRA FICTÍCIA;100,00`,valorCredito==="-18,75"?"100.00":"100.01",competencia));
 }
 async function parFatura(id:string){const f=await atual(id);return {f,d:f.itens.find(i=>i.descricaoOriginal==="ANUIDADE FICTÍCIA")!,c:f.itens.find(i=>i.descricaoOriginal==="CRÉDITO FICTÍCIO")!};}
 it("compensa par do mesmo dia, finaliza só a compra restante e conserva um pagamento bancário",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id);
   await compensarItensFatura(id,f.versao,d.id,c.id,"Estorno integral no mesmo dia",sessao);
   expect(resumir(await atual(id))).toMatchObject({calculado:10000,diferenca:0,pendencias:1});
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);
   const detalhe=await detalheFatura(id,{},false);
   expect(detalhe.porClassificar).toBe(1);expect(detalhe.pendenciasCadastro).toEqual([]);expect(detalhe.pendenciasVinculo).toEqual([]);
   expect(detalhe.itens.filter(i=>i.compensadoComId)).toHaveLength(2);
   const restante=(await atual(id)).itens.find(i=>!i.compensadoComId)!;
   await classificarItens(id,(await atual(id)).versao,{ids:[restante.id],categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null},sessao);
   await pagar(id,100);
   expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",pago:10000,pendente:0,pendencias:0});
   expect(await estado.prisma.lancamentoFinanceiro.findMany({select:{itemFaturaId:true,valor:true,status:true}})).toEqual([{itemFaturaId:restante.id,valor:expect.anything(),status:"BAIXADO"}]);
   expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
   expect(await estado.prisma.liquidacaoCartao.count()).toBe(1);
   expect(await estado.prisma.historicoCartao.count({where:{acao:"ITENS_COMPENSADOS"}})).toBe(1);
 });
 it.each([["02/09/2026","-18,75"],["01/09/2026","-18,74"]])("recusa datas ou centavos diferentes sem efeitos (%s %s)",async(data,valor)=>{
   const {id}=await importarCompensacao(data,valor),{f,d,c}=await parFatura(id);
   await expect(compensarItensFatura(id,f.versao,d.id,c.id,"Compensação fictícia",sessao)).rejects.toThrow("mesma data");
   expect((await atual(id)).versao).toBe(f.versao);expect((await atual(id)).itens.every(i=>!i.compensadoComId)).toBe(true);
   expect(await estado.prisma.historicoCartao.count({where:{acao:"ITENS_COMPENSADOS"}})).toBe(0);
 });
 it("recusa item de outra fatura, item repetido, sinais iguais e item ignorado",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id),outro=await importar(formulario(undefined,undefined,"2026-10")),externo=(await atual(outro.id)).itens[0];
   await expect(compensarItensFatura(id,f.versao,d.id,externo.id,"Compensação fictícia",sessao)).rejects.toThrow("mesma fatura");
   await expect(compensarItensFatura(id,f.versao,d.id,d.id,"Compensação fictícia",sessao)).rejects.toThrow("valores iguais");
   const positivo=f.itens.find(i=>i.id!==d.id&&i.valor.isPositive())!;
   await expect(compensarItensFatura(id,f.versao,d.id,positivo.id,"Compensação fictícia",sessao)).rejects.toThrow("valores iguais");
   await estado.prisma.itemFaturaCartao.update({where:{id:c.id},data:{ignoradoEm:new Date()}});
   await expect(compensarItensFatura(id,f.versao,d.id,c.id,"Compensação fictícia",sessao)).rejects.toThrow("valores iguais");
 });
 it("preserva lançamentos existentes, exige versão e motivo e bloqueia ajustes no par",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id);
   await expect(compensarItensFatura(id,f.versao,d.id,c.id,"x",sessao)).rejects.toThrow("motivo");
   await expect(compensarItensFatura(id,f.versao-1,d.id,c.id,"Compensação fictícia",sessao)).rejects.toThrow("mudou");
   await compensarItensFatura(id,f.versao,d.id,c.id,"Compensação fictícia",sessao);
   const nova=(await atual(id)).versao;
   await compensarItensFatura(id,nova,c.id,d.id,"Repetição fictícia",sessao);
   expect((await atual(id)).versao).toBe(nova);
   await expect(vincularItem(id,nova,d.id,{criar:true},sessao)).rejects.toThrow("indisponível");
   await expect(ajustarItem(id,nova,d.id,"VALOR","Ajuste fictício","20.00",sessao)).rejects.toThrow("compensação");
   await desfazerCompensacaoFatura(id,nova,c.id,"Revisar as duas linhas",sessao);
   expect((await atual(id)).itens.filter(i=>[d.id,c.id].includes(i.id)).every(i=>!i.compensadoComId&&!i.revisado)).toBe(true);
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);
   await classificarItens(id,(await atual(id)).versao,{ids:[d.id],categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null},sessao);
   await vincularItem(id,(await atual(id)).versao,d.id,{criar:true},sessao);
   await expect(compensarItensFatura(id,(await atual(id)).versao,d.id,c.id,"Compensação fictícia",sessao)).rejects.toThrow("sem vínculo");
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);
 });
 it("duas confirmações concorrentes só persistem um par e uma auditoria",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id);
   const resultados=await Promise.allSettled([compensarItensFatura(id,f.versao,d.id,c.id,"Confirmação fictícia",sessao),compensarItensFatura(id,f.versao,c.id,d.id,"Confirmação fictícia",sessao)]);
   expect(resultados.filter(r=>r.status==="fulfilled")).toHaveLength(1);
   expect(await estado.prisma.historicoCartao.count({where:{acao:"ITENS_COMPENSADOS"}})).toBe(1);
 });
 it("compensa e desfaz em fatura já paga sem tocar no movimento nem criar títulos",async()=>{
   const {id}=await importarCompensacao(),{d,c}=await parFatura(id),legado=await pagamentoLegado(id,100);
   await compensarItensFatura(id,(await atual(id)).versao,d.id,c.id,"Estorno no mesmo dia",sessao);
   expect(await estado.prisma.movimentacaoBancaria.findUnique({where:{id:legado.movimento.id}})).toEqual(legado.movimento);
   await desfazerCompensacaoFatura(id,(await atual(id)).versao,d.id,"Conferir novamente",sessao);
   expect(await estado.prisma.movimentacaoBancaria.findUnique({where:{id:legado.movimento.id}})).toEqual(legado.movimento);
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.pagamentoFaturaCartao.count()).toBe(1);
 });
 it("permissão é relida no servidor e sessão expirada não pode compensar",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id);
   await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:null,permissoesPersonalizadas:{"financeiro.faturas":{visualizar:true,editar:false}}}});
   await expect(compensarItensFatura(id,f.versao,d.id,c.id,"Compensação fictícia",sessao)).rejects.toThrow("acesso");
   await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:"perfil-administrador",sessaoVersao:1}});
   await expect(compensarItensFatura(id,f.versao,d.id,c.id,"Compensação fictícia",sessao)).rejects.toThrow("sessão");
 });

 it("conclui despesas de pagamento legado sem lançar o par compensado",async()=>{
   const {id}=await importarCompensacao(),{d,c}=await parFatura(id),legado=await pagamentoLegado(id,100);
   await compensarItensFatura(id,(await atual(id)).versao,d.id,c.id,"Estorno fictício no mesmo dia",sessao);
   const restante=(await atual(id)).itens.find(i=>!i.compensadoComId)!;
   await classificarItens(id,(await atual(id)).versao,{ids:[restante.id],categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null},sessao);
   await concluirDespesasFatura(id,(await atual(id)).versao,sessao);
   expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",pendencias:0,pago:10000});
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);
   expect(await estado.prisma.movimentacaoBancaria.findUnique({where:{id:legado.movimento.id}})).toEqual(legado.movimento);
 });
 it("pagamentos parciais conservam centavos e a compensação não recebe liquidação",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id);
   await compensarItensFatura(id,f.versao,d.id,c.id,"Estorno fictício no mesmo dia",sessao);
   const restante=(await atual(id)).itens.find(i=>!i.compensadoComId)!;
   await classificarItens(id,(await atual(id)).versao,{ids:[restante.id],categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null},sessao);
   await pagar(id,40,"PARCIAL");expect(resumir(await atual(id))).toMatchObject({estado:"PARCIAL",pendente:6000});
   await pagar(id,60);expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",pendente:0});
   expect(Number((await estado.prisma.liquidacaoCartao.aggregate({_sum:{valor:true}}))._sum.valor)).toBe(100);
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);
   expect(await estado.prisma.movimentacaoBancaria.count()).toBe(2);
 });
 it("fatura composta só pelo par termina com zero, sem pagamento artificial",async()=>{
   const {id}=await importar(formulario("Data;Descrição;Valor\n01/09/2026;ANUIDADE;18,75\n01/09/2026;ESTORNO;-18,75","0.00")),f=await atual(id);
   await compensarItensFatura(id,f.versao,f.itens[0].id,f.itens[1].id,"Compensação integral fictícia",sessao);
   expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",calculado:0,pago:0,pendente:0,pendencias:0});
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);expect(await estado.prisma.pagamentoFaturaCartao.count()).toBe(0);
 });
 it("vínculo quebrado não permite finalizar nem criar as despesas restantes",async()=>{
   const {id}=await importarCompensacao(),{f,d,c}=await parFatura(id);
   await compensarItensFatura(id,f.versao,d.id,c.id,"Compensação fictícia",sessao);
   await estado.prisma.itemFaturaCartao.update({where:{id:c.id},data:{dataCompra:new Date("2026-09-02T00:00:00Z")}});
   expect(()=>resumir({...(f),itens:f.itens.map(i=>i.id===d.id?{...i,compensadoComId:c.id}:i)})).toThrow("Compensação inválida");
   const t=await transacao(100);
   await expect(selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao)).rejects.toThrow("Compensação inválida");
   expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);
 });
 it.each([300,150])("substitui vínculo preservando pagamento de %s e despesas de 15/09",async(valor)=>{
  const {id}=await importar();await desdobrar(id);const t=await pagar(id,valor,valor===300?"INTEGRAL":"PARCIAL");
  const f=await atual(id),item=f.itens.find(i=>i.valor.toNumber()===100)!;
  const antigos=item.lancamentos.map(l=>l.id);
  const novos=await Promise.all([40,60].map((v,indice)=>estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:"Despesa aberta "+indice,valor:v,categoriaId:"categoria",cartaoCreditoId:"cartao",dataCompetencia:new Date("2026-09-01"),dataVencimento:new Date("2026-09-15"),criadoPorId:"admin"}})));
  expect((await consultarCorrespondencias(id,item.id)).candidatos.map(l=>l.id)).toEqual(expect.arrayContaining(novos.map(l=>l.id)));
  const entrada={substituir:true,motivo:"Corrigir despesas vinculadas",lancamentos:novos.map(l=>({id:l.id,versao:l.updatedAt.toISOString()}))};
  await vincularItem(id,f.versao,item.id,entrada,sessao);
  expect((await atual(id)).pagamentos.map(p=>p.transacaoId)).toEqual([t.id]);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:t.id}})).conciliadaEm).not.toBeNull();
  expect(await estado.prisma.lancamentoFinanceiro.findMany({where:{id:{in:antigos}},select:{status:true,itemFaturaId:true,dataPagamento:true}})).toEqual(antigos.map(()=>({status:"PENDENTE",itemFaturaId:null,dataPagamento:null})));
  expect(await estado.prisma.liquidacaoCartao.count({where:{lancamentoId:{in:antigos},pagamento:{revertidoEm:null}}})).toBe(0);
  expect((await estado.prisma.liquidacaoCartao.aggregate({_sum:{valor:true},where:{pagamento:{faturaId:id,revertidoEm:null}}}))._sum.valor?.toNumber()).toBe(valor);
  expect((await atual(id)).itens.find(i=>i.id===item.id)!.lancamentos.map(l=>l.status)).toEqual([valor===300?"BAIXADO":"PENDENTE",valor===300?"BAIXADO":"PENDENTE"]);
  expect(await estado.prisma.historicoCartao.count({where:{acao:"VINCULO_SUBSTITUIDO",motivo:entrada.motivo}})).toBe(1);
  await expect(vincularItem(id,f.versao,item.id,entrada,sessao)).rejects.toThrow("fatura mudou");
  await desconciliarFatura(id,(await atual(id)).versao,(await atual(id)).pagamentos[0].id,"Correção fictícia",sessao);
  expect((await atual(id)).itens.find(i=>i.id===item.id)!.lancamentos.every(l=>l.status==="PENDENTE")).toBe(true);
 });
 it("corrige cartão das despesas pendentes e preserva conciliação e nota",async()=>{
  const {id}=await importar();await desdobrar(id);await pagar(id,300);
  await estado.prisma.cartaoCredito.create({data:{id:"outro-cartao",nome:"Mastercard fictício",contaBancariaId:"banco",diaFechamento:10,diaVencimento:20}});
  const l=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:"NFS-e fictícia",valor:100,categoriaId:"categoria",cartaoCreditoId:"outro-cartao",dataCompetencia:new Date("2026-09-01"),dataVencimento:new Date("2026-09-15")}});
  const f=await atual(id),item=f.itens[0];
  expect((await consultarCorrespondencias(id,item.id)).candidatos.map(x=>x.id)).not.toContain(l.id);
  expect((await consultarCorrespondencias(id,item.id,true)).candidatos.find(x=>x.id===l.id)?.cartaoNome).toBe("Mastercard fictício");
  await expect(vincularItem(id,f.versao,item.id,{substituir:true,motivo:"Correção fictícia",lancamentos:[{id:l.id,versao:l.updatedAt.toISOString()}]},sessao)).rejects.toThrow("Despesa alterada");
  await expect(corrigirCartaoDespesa(id,f.versao,l.id,l.updatedAt.toISOString(),"",sessao)).rejects.toThrow("motivo");
  await expect(corrigirCartaoDespesa(id,f.versao,l.id,"versao-antiga","Corrigir cartão",sessao)).rejects.toThrow("Despesa alterada");
  await corrigirCartaoDespesa(id,f.versao,l.id,l.updatedAt.toISOString(),"Corrigir cartão",sessao);
  const corrigido=await estado.prisma.lancamentoFinanceiro.findUniqueOrThrow({where:{id:l.id}});
  expect(corrigido).toMatchObject({cartaoCreditoId:"cartao",status:"PENDENTE",itemFaturaId:null,dataPagamento:null,dataCompetencia:l.dataCompetencia,dataVencimento:l.dataVencimento});expect(corrigido.valor.toString()).toBe(l.valor.toString());
  expect((await atual(id)).pagamentos.map(p=>p.id)).toEqual(f.pagamentos.map(p=>p.id));expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect((await consultarCorrespondencias(id,item.id)).candidatos.map(x=>x.id)).toContain(l.id);
  await corrigirCartaoDespesa(id,(await atual(id)).versao,l.id,l.updatedAt.toISOString(),"Corrigir cartão",sessao);
  expect(await estado.prisma.historicoCartao.count({where:{acao:"CARTAO_CORRIGIDO",alvoId:l.id}})).toBe(1);
  const versao=(await atual(id)).versao;
  await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:null,permissoesPersonalizadas:{"financeiro.faturas":{visualizar:true,editar:true}}}});
  await expect(corrigirCartaoDespesa(id,versao,l.id,corrigido.updatedAt.toISOString(),"Corrigir cartão",sessao)).rejects.toThrow("permissão");
 });
 it("recusa corrigir cartão de despesa realizada ou vinculada",async()=>{
  const {id}=await importar();await desdobrar(id);await pagar(id,300);const f=await atual(id),l=f.itens[0].lancamentos[0];
  await expect(corrigirCartaoDespesa(id,f.versao,l.id,l.updatedAt.toISOString(),"Corrigir cartão",sessao)).rejects.toThrow("despesa pendente");
  expect(await estado.prisma.historicoCartao.count({where:{acao:"CARTAO_CORRIGIDO"}})).toBe(0);
 });
 it("troca inválida preserva vínculos e liquidações integralmente",async()=>{
  const {id}=await importar();await desdobrar(id);await pagar(id,300);const f=await atual(id),item=f.itens[0];
  const novo=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:"Valor incorreto",valor:1,categoriaId:"categoria",dataCompetencia:new Date("2026-09-01"),dataVencimento:new Date("2026-09-15"),criadoPorId:"admin"}});
  const entrada={substituir:true,motivo:"Correção fictícia",lancamentos:[{id:novo.id,versao:novo.updatedAt.toISOString()}]};
  await expect(vincularItem(id,f.versao,item.id,{...entrada,motivo:""},sessao)).rejects.toThrow("motivo");
  await expect(vincularItem(id,f.versao,item.id,entrada,sessao)).rejects.toThrow("soma");
  expect((await atual(id)).versao).toBe(f.versao);expect((await atual(id)).itens.find(i=>i.id===item.id)!.lancamentos.map(l=>l.id)).toEqual(item.lancamentos.map(l=>l.id));
  expect(await estado.prisma.liquidacaoCartao.count({where:{pagamento:{faturaId:id,revertidoEm:null}}})).toBe(2);
  await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:null,permissoesPersonalizadas:{"financeiro.faturas":{visualizar:true,editar:true},"financeiro.movimentacoes":{visualizar:true,editar:true}}}});
  await expect(vincularItem(id,f.versao,item.id,entrada,sessao)).rejects.toThrow("permissão");
 });
 it("aplica migration aditiva e importa sem despesa/saída bancária",async()=>{const {id}=await importar();expect((await atual(id)).itens).toHaveLength(2);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);});
 function pdfForm(totalPdf="20,00",total="20.00") {
  const f=formulario(undefined,total);
  f.set("arquivo",new File([new Uint8Array(pdfFicticio(["Resumo da fatura","bancointer.com.br","Cartão 1234****1234","Total da sua fatura",`R$ ${totalPdf}`,"Vencimento: 20/09/2026","DATA DOCUMENTO","10/09/2026","Despesas da fatura","01 de set. 2026 COMPRA FICTICIA - R$ 20,00","Total CARTÃO 20,00"]))],"ficticia.pdf"));
  return f;
 }
 it("identifica PDF sem gravar e reconhece somente final único",async()=>{
  await estado.prisma.cartaoCredito.update({where:{id:"cartao"},data:{final:"1234"}});
  expect(await identificarDadosFatura(pdfForm())).toMatchObject({cartaoId:"cartao",quantidade:1,cabecalho:{banco:"INTER",dados:{total:{valor:"20.00"}}}});
  expect(await estado.prisma.faturaCartao.count()).toBe(0);expect(await estado.prisma.historicoCartao.count()).toBe(0);
 });
 it("final diferente impede associar PDF a outro cartão",async()=>{
  await estado.prisma.cartaoCredito.update({where:{id:"cartao"},data:{final:"9999"}});
  await expect(prepararImportacao(pdfForm())).rejects.toThrow("outro cartão");
 });
 it("associação explícita memoriza final e registra auditoria, sem despesa pelo total",async()=>{
  const f=pdfForm();f.set("memorizarFinal","sim");await importar(f);
  expect((await estado.prisma.cartaoCredito.findUniqueOrThrow({where:{id:"cartao"}})).final).toBe("1234");
  expect(await estado.prisma.historicoCartao.count({where:{acao:"FINAL_ASSOCIADO"}})).toBe(1);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);
 });
 it("não memoriza final sem autorização bancária e desfaz integralmente a operação",async()=>{
  await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:null,permissoesPersonalizadas:{"financeiro.faturas":{visualizar:true,adicionar:true}}}});
  const f=pdfForm();f.set("memorizarFinal","sim");await expect(importar(f)).rejects.toThrow("permissão");
  expect(await estado.prisma.faturaCartao.count()).toBe(0);expect((await estado.prisma.cartaoCredito.findUniqueOrThrow({where:{id:"cartao"}})).final).toBeNull();
 });
 it("total editado não pode ocultar diferença do PDF",async()=>{
  await expect(importar(pdfForm("25,00","20.00"))).rejects.toThrow("total identificado no PDF");
  await expect(importar(pdfForm("25,00","25.00"))).rejects.toThrow("não fecha");
  expect(await estado.prisma.faturaCartao.count()).toBe(0);
 });
 it("alteração de cartão invalida a prévia",async()=>{
  const f=pdfForm();f.set("token",(await prepararImportacao(f)).token);f.set("confirmar","sim");
  await estado.prisma.cartaoCredito.update({where:{id:"cartao"},data:{nome:"Atualizado",updatedAt:new Date(Date.now()+1000)}});
  await expect(importarFatura(f,sessao)).rejects.toThrow("Prévia");expect(await estado.prisma.faturaCartao.count()).toBe(0);
 });
 it("parcela antiga conserva compra original e usa competência da fatura",async()=>{
  const {id}=await importar(formulario("Data;Descrição;Valor\n01/12/2025;COMPRA 10/12;20,00","20.00"));const i=(await atual(id)).itens[0];
  expect(i.dataCompra.toISOString().slice(0,10)).toBe("2025-12-01");expect(i.dataCompetencia.toISOString().slice(0,10)).toBe("2026-09-01");
 });
 it("arquivo repetido não duplica",async()=>{const a=await importar(),b=await importar();expect(b).toEqual({id:a.id,repetida:true});expect(await estado.prisma.itemFaturaCartao.count()).toBe(2);});
 it("importações concorrentes só criam uma fatura",async()=>{const a=formulario(),b=formulario();for(const f of [a,b]){f.set("token",(await prepararImportacao(f)).token);f.set("confirmar","sim");}const r=await Promise.allSettled([importarFatura(a,sessao),importarFatura(b,sessao)]);expect(r.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(await estado.prisma.faturaCartao.count()).toBe(1);expect(await estado.prisma.itemFaturaCartao.count()).toBe(2);});
 it("cartão inativo impede importação",async()=>{await estado.prisma.cartaoCredito.update({where:{id:"cartao"},data:{ativo:false}});await expect(importar()).rejects.toThrow("ativo");});
 it("permissão relida no banco bloqueia chamada direta",async()=>{await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:null}});await expect(importar()).rejects.toThrow("acesso");expect(await estado.prisma.faturaCartao.count()).toBe(0);});
 it("arquivo original é imutável no banco",async()=>{const {id}=await importar(),i=(await atual(id)).itens[0];await expect(estado.prisma.itemFaturaCartao.update({where:{id:i.id},data:{valorOriginal:1}})).rejects.toThrow();});
 it("normalização e fornecedor conhecido não classificam silenciosamente",async()=>{const {id}=await importar(),i=(await atual(id)).itens.find(i=>i.descricaoOriginal.startsWith("GOOGLE"))!;expect(i.estabelecimentoNormalizado).toBe("GOOGLE WORKSPACE");expect((await consultarCorrespondencias(id,i.id)).sugestao).toMatchObject({origem:"FORNECEDOR",fornecedorId:"fornecedor"});expect(i.categoriaId).toBeNull();});
 it("regra conhecida vira sugestão e não lançamento",async()=>{await estado.prisma.regraCartao.create({data:{nome:"Software",texto:"GOOGLE WORKSPACE",categoriaId:"categoria"}});const {id}=await importar(),i=(await atual(id)).itens.find(i=>i.descricaoOriginal.startsWith("GOOGLE"))!;expect(i.sugestao).toMatchObject({origem:"EXPLICITA",categoriaId:"categoria"});expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);});
 it("memória confirmada pode virar regra histórica",async()=>{const {id}=await importar(),f=await atual(id);await classificarItens(id,f.versao,{ids:[f.itens[0].id],categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null,memorizar:true},sessao);expect(await estado.prisma.regraCartao.count({where:{origem:"HISTORICO"}})).toBe(1);});
 it("vincula lançamento existente sem duplicar",async()=>{const {id}=await importar();const f=await atual(id),i=f.itens[0];const l=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento,cartaoCreditoId:"cartao"}});await vincularItem(id,f.versao,i.id,{lancamentos:[{id:l.id,versao:l.updatedAt.toISOString()}]},sessao);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);await expect(baixarLancamento({lancamentoId:l.id,contaBancariaId:"banco"})).rejects.toThrow("Faturas");});

 it("encontra despesa de competência antiga fora da tolerância sem buscar no extrato",async()=>{
  const {id}=await importar(),f=await atual(id),i=f.itens[0];
  const l=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:new Date("2025-01-01"),dataVencimento:f.vencimento}});
  expect((await consultarCorrespondencias(id,i.id)).candidatos.some(c=>c.id===l.id)).toBe(true);
  await vincularItem(id,f.versao,i.id,{lancamentos:[{id:l.id,versao:l.updatedAt.toISOString()}]},sessao);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);
 });
 it("conta situações de faturas antes da página e sem o próprio filtro",async()=>{
  await estado.prisma.faturaCartao.createMany({data:Array.from({length:31},(_,n)=>({
    cartaoId:"cartao",competencia:new Date(Date.UTC(2026,n,1)).toISOString().slice(0,7),
    inicio:new Date("2026-09-01"),fim:new Date("2026-09-10"),fechamento:new Date("2026-09-10"),vencimento:new Date("2026-09-20"),
    totalInformado:100,estado:n===30?"PARCIAL":"REVISAO",autorId:"admin",autorNome:"Teste",
  }))});
  const lista=await listarFaturas({estado:"REVISAO",pagina:"2",busca:"fictício",de:"2026-09-01",ate:"2026-09-30"});
  expect(lista.faturas).toHaveLength(0);
  expect(lista.quantidade).toBe(30);
  expect(lista.contagens).toEqual({"":31,REVISAO:30,PARCIAL:1});
  expect((await listarFaturas({pagina:"2"})).faturas).toHaveLength(1);
  expect((await listarFaturas({de:"2026-10-01"})).contagens).toEqual({"":0});
 });
 it("conta todos os estados dos itens na busca, separando ignorados",async()=>{
  const {id}=await importar(),f=await atual(id);
  await estado.prisma.itemFaturaCartao.update({where:{id:f.itens[0].id},data:{ignoradoEm:new Date()}});
  await estado.prisma.itemFaturaCartao.update({where:{id:f.itens[1].id},data:{estado:"CLASSIFICADO"}});
  const todos=await detalheFatura(id,{estado:"CLASSIFICADO"},false);
  expect(todos.itens).toHaveLength(1);
  expect(todos.contagensItens).toEqual({"":2,IGNORADO:1,CLASSIFICADO:1});
  const busca=await detalheFatura(id,{estado:"CLASSIFICADO",busca:"GOOGLE"},false);
  expect(busca.itens).toHaveLength(0);
  expect(busca.contagensItens).toEqual({"":1,IGNORADO:1});
 });
 it("consulta oferece saídas importadas pendentes sem depender da descrição bancária",async()=>{const {id}=await importar();const pagamento=await transacao(300),boleto=await transacao(50);await estado.prisma.transacaoExtrato.update({where:{id:boleto.id},data:{descricao:"BOLETO PAGO ITAU UNIBANCO"}});const conciliada=await transacao(50);await estado.prisma.transacaoExtrato.update({where:{id:conciliada.id},data:{conciliadaEm:new Date()}});const ids=(await detalheFatura(id,{},true)).bancarias.map(t=>t.id);expect(ids).toHaveLength(2);expect(ids).toContain(pagamento.id);expect(ids).toContain(boleto.id);await selecionarExtratoFatura(id,(await atual(id)).versao,boleto.id,sessao);expect((await atual(id)).transacaoSelecionadaId).toBe(boleto.id);});
 it("painel carrega mais de cinquenta itens em ordem de compra sem paginação",async()=>{const linhas=Array.from({length:55},(_,n)=>`${String((n%28)+1).padStart(2,"0")}/09/2026;ITEM ${String(n).padStart(2,"0")};1,00`);const {id}=await importar(formulario(`Data;Descrição;Valor\n${linhas.reverse().join("\n")}`,"55.00"));const painel=await detalheFatura(id,{pagina:"2",ordem:"valor"},false);expect(painel.itens).toHaveLength(55);expect(painel.quantidade).toBe(55);expect(painel.itens.map(i=>i.data)).toEqual([...painel.itens.map(i=>i.data)].sort());});
 it("filtro geral mantém também as linhas ignoradas à vista",async()=>{const {id}=await importar(),item=(await atual(id)).itens[0];await estado.prisma.itemFaturaCartao.update({where:{id:item.id},data:{ignoradoEm:new Date()}});expect((await detalheFatura(id,{},false)).itens).toHaveLength(2);expect((await detalheFatura(id,{estado:"IGNORADO"},false)).itens).toHaveLength(1);});
 it("lançamentos pendentes aparecem por vencimento, inclusive créditos elegíveis",async()=>{const {id}=await importar(),f=await atual(id),i=f.itens[0];const dados=[{descricao:"Despesa posterior",tipo:"DESPESA" as const,dataVencimento:new Date("2026-09-22T00:00:00Z")},{descricao:"Crédito intermediário",tipo:"RECEITA" as const,dataVencimento:new Date("2026-09-21T00:00:00Z")},{descricao:"Despesa anterior",tipo:"DESPESA" as const,dataVencimento:new Date("2026-09-19T00:00:00Z")}];for(const linha of dados)await estado.prisma.lancamentoFinanceiro.create({data:{...linha,valor:10,categoriaId:"categoria",dataCompetencia:i.dataCompra}});expect((await consultarCorrespondencias(id,i.id)).candidatos.map(l=>l.descricao)).toEqual(["Despesa anterior","Crédito intermediário","Despesa posterior"]);});
 it("vincula duas despesas para fechar um item",async()=>{const {id}=await importar(),f=await atual(id),i=f.itens[0];const despesas=await Promise.all([40,60].map(valor=>estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento}})));const sugestoes=(await consultarCorrespondencias(id,i.id)).sugestoesVinculo;expect(sugestoes.find(s=>s.ids.length===2)?.valor).toBe(10000);await vincularItem(id,f.versao,i.id,{lancamentos:despesas.map(l=>({id:l.id,versao:l.updatedAt.toISOString()}))},sessao);expect((await atual(id)).itens.find(x=>x.id===i.id)?.lancamentos).toHaveLength(2);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);});
 it("nome classificado altera só o novo lançamento e preserva a descrição original",async()=>{const {id}=await importar(),f=await atual(id),i=f.itens[0];await classificarItens(id,f.versao,{ids:[i.id],categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null,descricaoLancamento:"  Assinatura mensal  "},sessao);const gravado=(await atual(id)).itens.find(x=>x.id===i.id)!;expect(gravado.descricaoOriginal).toBe(i.descricaoOriginal);expect(gravado.descricaoLancamento).toBe("Assinatura mensal");await vincularItem(id,(await atual(id)).versao,i.id,{criar:true},sessao);expect(await estado.prisma.lancamentoFinanceiro.findFirstOrThrow()).toMatchObject({descricao:"Assinatura mensal"});});
 it("cria despesa no mesmo formulário e impede categoria de receita em compra",async()=>{
  const {id}=await importar(),f=await atual(id),i=f.itens[0];
  const novo={categoriaId:"categoria",fornecedorId:"fornecedor",centroCustoId:null,responsavelId:null,descricao:"Despesa informada",dataCompetencia:"2026-08-31",dataVencimento:"2026-09-20"};
  await estado.prisma.categoriaFinanceira.upsert({where:{id:"receita"},create:{id:"receita",nome:"Receita fictícia",grupo:"RECEITA_BRUTA"},update:{ativo:true}});
  await expect(vincularItem(id,f.versao,i.id,{criar:true,novo:{...novo,categoriaId:"receita"}},sessao)).rejects.toThrow("Receita só");
  expect((await atual(id)).itens.find(x=>x.id===i.id)?.categoriaId).toBeNull();
  await vincularItem(id,f.versao,i.id,{criar:true,novo},sessao);
  expect(await estado.prisma.lancamentoFinanceiro.findFirst()).toMatchObject({descricao:"Despesa informada",fornecedorId:"fornecedor",tipo:"DESPESA"});
 });
 it.each([false,true])("crédito concilia receita positiva, criação=%s, sem duplicar saída",async criar=>{
  await estado.prisma.categoriaFinanceira.upsert({where:{id:"receita"},create:{id:"receita",nome:"Receita fictícia",grupo:"RECEITA_BRUTA"},update:{ativo:true}});
  const {id}=await importar(formulario("Data;Descrição;Valor\n01/09/2026;COMPRA;100,00\n02/09/2026;REEMBOLSO;-20,00","80.00"));
  const f=await atual(id),compra=f.itens.find(i=>i.valor.isPositive())!,credito=f.itens.find(i=>i.valor.isNegative())!;
  await vincularItem(id,f.versao,compra.id,{criar:true,novo:{categoriaId:"categoria",fornecedorId:null,centroCustoId:null,responsavelId:null,descricao:"Compra fictícia",dataCompetencia:"2026-09-01",dataVencimento:"2026-09-20"}},sessao);
  if(criar)await vincularItem(id,(await atual(id)).versao,credito.id,{criar:true,novo:{categoriaId:"receita",fornecedorId:null,centroCustoId:null,responsavelId:null,descricao:"Reembolso fictício",dataCompetencia:"2026-09-02",dataVencimento:"2026-09-20"}},sessao);
  else {
   const l=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"RECEITA",descricao:"Reembolso existente",valor:20,categoriaId:"receita",dataCompetencia:new Date("2026-09-02"),dataVencimento:f.vencimento}});
   expect((await consultarCorrespondencias(id,credito.id)).candidatos.find(c=>c.id===l.id)?.valor).toBe(-2000);
   await vincularItem(id,(await atual(id)).versao,credito.id,{lancamentos:[{id:l.id,versao:l.updatedAt.toISOString()}]},sessao);
  }
  expect(resumir(await atual(id)).pendencias).toBe(0);await pagar(id,80);
  const r=await estado.prisma.lancamentoFinanceiro.findFirstOrThrow({where:{tipo:"RECEITA"},include:{liquidacoesCartao:true}});
  expect(Number(r.valor)).toBe(20);expect(r.liquidacoesCartao.reduce((s,q)=>s+Number(q.valor),0)).toBe(20);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
 });
 it("matching forte exige justificativa antes de duplicar",async()=>{const {id}=await importar();await classificar(id);const f=await atual(id),i=f.itens[0];await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento,cartaoCreditoId:"cartao"}});await expect(vincularItem(id,f.versao,i.id,{criar:true},sessao)).rejects.toThrow("motivo");expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);});
 it("criação concorrente/direta do mesmo item não duplica",async()=>{const {id}=await importar();await classificar(id);const f=await atual(id),i=f.itens[0];await Promise.allSettled([vincularItem(id,f.versao,i.id,{criar:true},sessao),vincularItem(id,f.versao,i.id,{criar:true},sessao)]);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);});
 it("segunda parcela encontra o grupo do mês anterior",async()=>{await importar(formulario("Data;Descrição;Valor\n01/09/2026;APPLE 01/03;100,00","100.00"));await importar(formulario("Data;Descrição;Valor\n01/10/2026;APPLE 02/03;100,00","100.00","2026-10"));expect(await estado.prisma.parcelamentoCartao.count()).toBe(1);expect((await estado.prisma.itemFaturaCartao.findMany()).map(i=>i.parcela).sort()).toEqual([1,2]);});
 it("crédito gera despesa negativa, nunca receita",async()=>{const {id}=await importar(formulario("Data;Descrição;Valor\n01/09/2026;COMPRA;100,00\n02/09/2026;ESTORNO COMPRA;-20,00","80.00"));await desdobrar(id);await pagar(id,80);const l=await estado.prisma.lancamentoFinanceiro.findMany();expect(l.every(l=>l.tipo==="DESPESA")).toBe(true);expect(l.reduce((s,l)=>s+Number(l.valor),0)).toBe(80);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);});
 it.each([300,150])("conclui despesas classificadas preservando pagamento legado de %s",async(valor)=>{
  const {id}=await importar();await classificar(id);const legado=await pagamentoLegado(id,valor),f=await atual(id);
  await concluirDespesasFatura(id,f.versao,sessao);
  const depois=await atual(id);
  expect(resumir(depois)).toMatchObject({estado:valor===300?"CONCILIADA":"PARCIAL",pendencias:0,pago:valor*100,pendente:(300-valor)*100});
  expect(depois.pagamentos).toEqual([legado.pagamento]);
  expect(await estado.prisma.movimentacaoBancaria.findMany()).toEqual([legado.movimento]);
  expect(await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:legado.t.id}})).toMatchObject({conciliadaEm:expect.any(Date)});
  expect(depois.itens.flatMap(i=>i.lancamentos)).toHaveLength(2);
  expect(depois.itens.flatMap(i=>i.lancamentos).every(l=>l.status===(valor===300?"BAIXADO":"PENDENTE"))).toBe(true);
  if(valor===300)expect(depois.itens.flatMap(i=>i.lancamentos).every(l=>l.dataPagamento?.getTime()===legado.t.data.getTime())).toBe(true);
  expect((await estado.prisma.liquidacaoCartao.aggregate({_sum:{valor:true}}))._sum.valor?.toNumber()).toBe(valor);
  expect(await estado.prisma.historicoCartao.count({where:{acao:"DESPESAS_CONCLUIDAS"}})).toBe(1);
  await expect(concluirDespesasFatura(id,f.versao,sessao)).rejects.toThrow("mudou");
  await concluirDespesasFatura(id,depois.versao,sessao);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);expect(await estado.prisma.historicoCartao.count({where:{acao:"DESPESAS_CONCLUIDAS"}})).toBe(1);
 });
 it("conclui 11 itens do fluxo legado uma única vez sob confirmação concorrente",async()=>{
  const csv="Data;Descrição;Valor\n"+Array.from({length:11},(_,i)=>`${String(i+1).padStart(2,"0")}/09/2026;COMPRA FICTICIA ${i+1};20,00`).join("\n");
  const {id}=await importar(formulario(csv,"220.00"));await classificar(id);await pagamentoLegado(id,220);const f=await atual(id);
  const resultados=await Promise.allSettled([concluirDespesasFatura(id,f.versao,sessao),concluirDespesasFatura(id,f.versao,sessao)]);
  expect(resultados.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(await estado.prisma.lancamentoFinanceiro.count({where:{status:"BAIXADO"}})).toBe(11);
  expect(await estado.prisma.pagamentoFaturaCartao.count()).toBe(1);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",pendencias:0,pendente:0});
 });
 it("conclusão legada preserva despesa já vinculada e cria somente faltantes",async()=>{
  const {id}=await importar();await classificar(id);await pagamentoLegado(id,300);const f=await atual(id),i=f.itens[0];
  const l=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:"Despesa existente fictícia",valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento}});
  await vincularItem(id,f.versao,i.id,{lancamentos:[{id:l.id,versao:l.updatedAt.toISOString()}]},sessao);
  await concluirDespesasFatura(id,(await atual(id)).versao,sessao);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);expect(await estado.prisma.lancamentoFinanceiro.findUniqueOrThrow({where:{id:l.id}})).toMatchObject({descricao:l.descricao,dataCompetencia:l.dataCompetencia,status:"BAIXADO"});
  expect(await estado.prisma.historicoCartao.count({where:{acao:"DESPESA_CRIADA"}})).toBe(1);
 });
 it("conclusão legada rejeita falta de pagamento, classificação e categoria inválida",async()=>{
  const {id}=await importar();await expect(concluirDespesasFatura(id,(await atual(id)).versao,sessao)).rejects.toThrow("pagamento");
  await pagamentoLegado(id,300);await expect(concluirDespesasFatura(id,(await atual(id)).versao,sessao)).rejects.toThrow("Classifique");
  await classificar(id);await estado.prisma.categoriaFinanceira.update({where:{id:"categoria"},data:{ativo:false}});
  await expect(concluirDespesasFatura(id,(await atual(id)).versao,sessao)).rejects.toThrow("classificação pendente");
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
 });
 it("duplicidade na conclusão legada desfaz os títulos novos e preserva o pagamento",async()=>{
  const {id}=await importar();await classificar(id);const legado=await pagamentoLegado(id,300),f=await atual(id),i=f.itens.at(-1)!;
  await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento,cartaoCreditoId:"cartao"}});
  await expect(concluirDespesasFatura(id,f.versao,sessao)).rejects.toThrow(`Linha ${i.linha}: existe lançamento pendente correspondente`);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);expect((await atual(id)).pagamentos).toEqual([legado.pagamento]);expect((await atual(id)).versao).toBe(f.versao);
  expect(await estado.prisma.liquidacaoCartao.count()).toBe(0);expect(await estado.prisma.historicoCartao.count({where:{acao:"DESPESAS_CONCLUIDAS"}})).toBe(0);
 });
 it("conclusão legada bloqueia baixa independente em título já vinculado",async()=>{
  const {id}=await importar();await classificar(id);await pagamentoLegado(id,300);const f=await atual(id),i=f.itens[0];
  await vincularItem(id,f.versao,i.id,{criar:true},sessao);const l=(await atual(id)).itens.find(x=>x.id===i.id)!.lancamentos[0];
  await estado.prisma.movimentacaoBancaria.create({data:{lancamentoId:l.id,contaBancariaId:"banco",tipo:"SAIDA",valor:l.valor,data:f.vencimento,descricao:"Baixa independente fictícia"}});
  const versao=(await atual(id)).versao;await expect(concluirDespesasFatura(id,versao,sessao)).rejects.toThrow("baixa bancária independente");
  expect((await atual(id)).versao).toBe(versao);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);expect(await estado.prisma.liquidacaoCartao.count()).toBe(0);
 });
 it("conclusão legada rejeita total divergente sem alterar pagamento",async()=>{
  const {id}=await importar();await classificar(id);await pagamentoLegado(id,300);await estado.prisma.faturaCartao.update({where:{id},data:{totalInformado:301}});
  await expect(concluirDespesasFatura(id,(await atual(id)).versao,sessao)).rejects.toThrow("diferença");expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
 });
 it.each(["financeiro.faturas","financeiro.movimentacoes","financeiro.baixas"])("conclusão legada relê a permissão de %s no servidor",async(recurso)=>{
  const {id}=await importar();await classificar(id);await pagamentoLegado(id,300);
  const permissoes={"financeiro.faturas":{visualizar:true,editar:recurso!=="financeiro.faturas"},"financeiro.movimentacoes":{visualizar:true,adicionar:recurso!=="financeiro.movimentacoes"},"financeiro.baixas":{editar:recurso!=="financeiro.baixas"}};
  await estado.prisma.usuario.update({where:{id:"admin"},data:{perfilAcessoId:null,permissoesPersonalizadas:permissoes}});
  await expect(concluirDespesasFatura(id,(await atual(id)).versao,sessao)).rejects.toThrow(/acesso|permissão|permissões/);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
 });

 it("saída menor não finaliza integralmente nem cria títulos ou baixa",async()=>{
  const {id}=await importar();await classificar(id);const t=await transacao(100);
  await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);
  const f=await atual(id);
  await expect(conciliarFatura(id,f.versao,t.id,sessao)).rejects.toThrow("não quita o saldo");
  expect((await atual(id)).versao).toBe(f.versao);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);
  expect(await estado.prisma.pagamentoFaturaCartao.count()).toBe(0);
  expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:t.id}})).conciliadaEm).toBeNull();
 });
 it("corrige pagamento parcial incorreto pelo integral e preserva despesas e compensação",async()=>{
  const {id}=await importar(formulario("Data;Descrição;Valor\n01/09/2026;ANUIDADE;18,75\n01/09/2026;ESTORNO ANUIDADE;-18,75\n02/09/2026;COMPRA FICTICIA;4165,14","4165.14"));
  let f=await atual(id);const debito=f.itens.find(i=>i.valor.toNumber()===18.75)!,credito=f.itens.find(i=>i.valor.toNumber()===-18.75)!;
  await compensarItensFatura(id,f.versao,debito.id,credito.id,"Estorno integral fictício",sessao);
  f=await atual(id);await classificarItens(id,f.versao,{ids:f.itens.filter(i=>!i.compensadoComId).map(i=>i.id),categoriaId:"categoria",fornecedorId:"fornecedor",centroCustoId:"centro",responsavelId:"admin"},sessao);
  const errada=await pagar(id,100,"PARCIAL");f=await atual(id);const lancamentos=f.itens.flatMap(i=>i.lancamentos.map(l=>l.id));
  expect(resumir(f)).toMatchObject({estado:"PARCIAL",pago:10000,pendente:406514});
  await desconciliarFatura(id,f.versao,f.pagamentos[0].id,"Corrigir saída selecionada",sessao);
  expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:errada.id}})).conciliadaEm).toBeNull();
  const integral=await pagar(id,4165.14);f=await atual(id);
  expect(f.itens.flatMap(i=>i.lancamentos.map(l=>l.id))).toEqual(lancamentos);
  expect(f.itens.find(i=>i.id===debito.id)?.compensadoComId).toBe(credito.id);
  expect(resumir(f)).toMatchObject({estado:"CONCILIADA",pago:416514,pendente:0,pendencias:0});
  expect(await estado.prisma.lancamentoFinanceiro.count({where:{status:"BAIXADO"}})).toBe(1);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect(await estado.prisma.pagamentoFaturaCartao.count({where:{revertidoEm:null,transacaoId:integral.id}})).toBe(1);
  expect(await estado.prisma.pagamentoFaturaCartao.count({where:{revertidoEm:{not:null}}})).toBe(1);
  expect(Number((await estado.prisma.liquidacaoCartao.aggregate({where:{pagamento:{revertidoEm:null}},_sum:{valor:true}}))._sum.valor)).toBe(4165.14);
 });
 it("tipo inválido ou parcial por valor integral é recusado sem baixa",async()=>{
  const {id}=await importar();await classificar(id);const t=await transacao(300);await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);
  const f=await atual(id);
  await expect(conciliarFatura(id,f.versao,t.id,sessao,"DESCONHECIDO" as "INTEGRAL")).rejects.toThrow("Tipo de pagamento inválido");
  await expect(conciliarFatura(id,f.versao,t.id,sessao,"PARCIAL")).rejects.toThrow("saldo integral");
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);
 });
 it("pagamento total cria um movimento, sem despesa adicional",async()=>{const {id}=await importar();await desdobrar(id);await pagar(id,300);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",pendente:0});});
 it("pagamento parcial e segundo pagamento fecham as alocações",async()=>{const {id}=await importar();await desdobrar(id);await pagar(id,100,"PARCIAL");expect(resumir(await atual(id))).toMatchObject({estado:"PARCIAL",pendente:20000});await pagar(id,200);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(2);expect(Number((await estado.prisma.liquidacaoCartao.aggregate({_sum:{valor:true}}))._sum.valor)).toBe(300);expect(await estado.prisma.lancamentoFinanceiro.count({where:{status:"BAIXADO"}})).toBe(2);});
 it("pagamento antes da classificação é bloqueado sem efeitos financeiros",async()=>{const {id}=await importar();await expect(pagar(id,300)).rejects.toThrow("Classifique");expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);});
 it("seleção persiste sem baixa e finalização cria apenas faltantes",async()=>{const {id}=await importar();const t=await transacao(300);await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);expect((await atual(id)).transacaoSelecionadaId).toBe(t.id);expect((await detalheFatura(id,{},false)).selecionada).toBeNull();expect((await detalheFatura(id,{},true)).selecionada?.id).toBe(t.id);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);expect(await estado.prisma.pagamentoFaturaCartao.count()).toBe(0);await classificar(id);const f=await atual(id),i=f.itens[0];const l=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:new Date("2025-01-01"),dataVencimento:f.vencimento}});expect((await consultarCorrespondencias(id,i.id)).candidatos.find(c=>c.id===l.id)?.correspondencia?.forte).toBe(true);await vincularItem(id,f.versao,i.id,{lancamentos:[{id:l.id,versao:l.updatedAt.toISOString()}]},sessao);const v=(await atual(id)).versao;await conciliarFatura(id,v,t.id,sessao);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);expect(await estado.prisma.lancamentoFinanceiro.count({where:{status:"BAIXADO"}})).toBe(2);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);await expect(conciliarFatura(id,v,t.id,sessao)).rejects.toThrow("mudou");expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);});
 it("finaliza a fatura com saída BOLETO PAGO selecionada e mantém baixa única",async()=>{const {id}=await importar();const t=await transacao(300);await estado.prisma.transacaoExtrato.update({where:{id:t.id},data:{descricao:"BOLETO PAGO ITAU UNIBANCO"}});await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);await classificar(id);await conciliarFatura(id,(await atual(id)).versao,t.id,sessao);expect((await atual(id)).transacaoSelecionadaId).toBeNull();expect(await estado.prisma.pagamentoFaturaCartao.count({where:{transacaoId:t.id,revertidoEm:null}})).toBe(1);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:t.id}})).conciliadaEm).not.toBeNull();});
 it("categoria excluída aparece por linha, bloqueia a baixa e permite concluir após reclassificação",async()=>{
  const {id}=await importar();const t=await transacao(300);
  await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);
  await classificar(id);
  const item=(await atual(id)).itens[0];
  await estado.prisma.categoriaFinanceira.update({where:{id:"categoria"},data:{ativo:false,excluidoEm:new Date()}});
  const painel=await detalheFatura(id,{},true);
  expect(painel.porClassificar).toBe(0);
  expect(painel.pendenciasCadastro).toEqual(expect.arrayContaining([{id:item.id,linha:item.linha,descricao:item.descricaoOriginal,motivos:["Categoria financeira excluída ou inativa"]}]));
  await expect(conciliarFatura(id,(await atual(id)).versao,t.id,sessao)).rejects.toThrow(`linhas ${item.linha}`);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);
  expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:t.id}})).conciliadaEm).toBeNull();
  await estado.prisma.categoriaFinanceira.create({data:{id:"categoria-corrigida",nome:"Categoria corrigida",grupo:"DESPESAS_OPERACIONAIS"}});
  await classificarItens(id,(await atual(id)).versao,{ids:[item.id],categoriaId:"categoria-corrigida",fornecedorId:null,centroCustoId:null,responsavelId:null},sessao);
  const outro=(await atual(id)).itens.find(i=>i.id!==item.id)!;
  await classificarItens(id,(await atual(id)).versao,{ids:[outro.id],categoriaId:"categoria-corrigida",fornecedorId:null,centroCustoId:null,responsavelId:null},sessao);
  expect((await detalheFatura(id,{},true)).pendenciasCadastro).toEqual([]);
  await conciliarFatura(id,(await atual(id)).versao,t.id,sessao);
  expect(await estado.prisma.lancamentoFinanceiro.count({where:{status:"BAIXADO",categoriaId:"categoria-corrigida"}})).toBe(2);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:t.id}})).conciliadaEm).not.toBeNull();
 });
 it("finaliza fatura fictícia com 53 itens, cria cada despesa uma vez e baixa uma única saída",async()=>{
  const linhas=Array.from({length:53},(_,n)=>`${String((n%28)+1).padStart(2,"0")}/09/2026;COMPRA FICTICIA ${String(n+1).padStart(2,"0")};1,00`);
  const {id}=await importar(formulario(`Data;Descrição;Valor\n${linhas.join("\n")}`,"53.00"));
  const t=await transacao(53);
  await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);
  await classificar(id);
  expect((await detalheFatura(id,{},true)).pendenciasCadastro).toEqual([]);
  await conciliarFatura(id,(await atual(id)).versao,t.id,sessao);
  expect(await estado.prisma.lancamentoFinanceiro.count({where:{status:"BAIXADO"}})).toBe(53);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect(await estado.prisma.pagamentoFaturaCartao.count({where:{revertidoEm:null}})).toBe(1);
  expect(resumir(await atual(id))).toMatchObject({estado:"CONCILIADA",pendente:0,pendencias:0});
 });
 it("saída utilizada após seleção bloqueia finalização sem criar despesas",async()=>{const {id}=await importar();const t=await transacao(300);await selecionarExtratoFatura(id,(await atual(id)).versao,t.id,sessao);await classificar(id);await estado.prisma.transacaoExtrato.update({where:{id:t.id},data:{conciliadaEm:new Date()}});await expect(conciliarFatura(id,(await atual(id)).versao,t.id,sessao)).rejects.toThrow("já conciliado");expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(0);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);});
 it("duplicidade na finalização identifica a linha e desfaz integralmente os lançamentos criados",async()=>{const {id}=await importar();await classificar(id);const f=await atual(id),i=f.itens.at(-1)!;await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento}});await expect(pagar(id,300)).rejects.toThrow(`Linha ${i.linha}: existe lançamento pendente correspondente`);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(1);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);});
 it("aponta o vínculo antes da confirmação e finaliza após vincular a despesa existente",async()=>{
  const {id}=await importar();await classificar(id);const f=await atual(id),i=f.itens.at(-1)!;
  const lancamento=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento}});
  const detalhe=await detalheFatura(id,{},true);
  expect(detalhe.pendenciasVinculo).toMatchObject([{id:i.id,linha:i.linha,quantidade:1,lancamentos:[i.descricaoOriginal]}]);
  await vincularItem(id,f.versao,i.id,{lancamentos:[{id:lancamento.id,versao:lancamento.updatedAt.toISOString()}]},sessao);
  expect((await detalheFatura(id,{},true)).pendenciasVinculo).toEqual([]);
  await pagar(id,300);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);
  expect(await estado.prisma.movimentacaoBancaria.count()).toBe(1);
  expect((await atual(id)).pagamentos).toHaveLength(1);
 });
 it("permite criar despesa distinta com justificativa e então concluir a fatura",async()=>{
  const {id}=await importar();await classificar(id);const f=await atual(id),i=f.itens.at(-1)!;
  await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:i.descricaoOriginal,valor:i.valor,categoriaId:"categoria",dataCompetencia:i.dataCompra,dataVencimento:f.vencimento}});
  expect((await detalheFatura(id,{},true)).pendenciasVinculo).toHaveLength(1);
  await vincularItem(id,f.versao,i.id,{criar:true,motivoDuplicidade:"Compra distinta comprovada no cartão"},sessao);
  expect((await detalheFatura(id,{},true)).pendenciasVinculo).toEqual([]);
  await pagar(id,300);
  expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(3);
  expect((await atual(id)).pagamentos).toHaveLength(1);
 });
 it("não confunde soma coincidente de nota alheia com compra do cartão",async()=>{
  const {id}=await importar();await classificar(id);const f=await atual(id),i=f.itens.at(-1)!;
  const nota=await estado.prisma.notaFiscalRecebida.create({data:{chaveAcesso:"1".repeat(44),nsu:"nota-ficticia",tipo:"PROC_NFE"}});
  const duplicata=await estado.prisma.notaFiscalDuplicata.create({data:{notaFiscalId:nota.id,numero:"1",valor:200,dataVencimento:f.vencimento}});
  const lancamentos=[];
  for(const [indice,valor] of [80,120].entries()){
    const itemNota=await estado.prisma.notaFiscalItem.create({data:{notaFiscalId:nota.id,numeroItem:indice+1,codigoProdutoFornecedor:`item-${indice}`,descricaoProduto:`Produto fictício ${indice}`,unidadeComercial:"UN",quantidadeComercial:1,valorTotalItem:valor}});
    const lancamento=await estado.prisma.lancamentoFinanceiro.create({data:{tipo:"DESPESA",descricao:`Nota fictícia — produto ${indice}`,valor,categoriaId:"categoria",dataCompetencia:new Date("2026-07-02T00:00:00Z"),dataVencimento:f.vencimento}});
    await estado.prisma.notaFiscalItemLancamento.create({data:{notaFiscalItemId:itemNota.id,notaFiscalDuplicataId:duplicata.id,lancamentoFinanceiroId:lancamento.id,valor}});
    lancamentos.push(lancamento);
  }
  expect((await detalheFatura(id,{},true)).pendenciasVinculo).toEqual([]);
  await estado.prisma.lancamentoFinanceiro.updateMany({where:{id:{in:lancamentos.map(l=>l.id)}},data:{cartaoCreditoId:f.cartaoId}});
  expect((await detalheFatura(id,{},true)).pendenciasVinculo).toEqual([]);
  await estado.prisma.lancamentoFinanceiro.updateMany({where:{id:{in:lancamentos.map(l=>l.id)}},data:{dataCompetencia:i.dataCompra}});
  expect((await detalheFatura(id,{},true)).pendenciasVinculo).toMatchObject([{id:i.id,linha:i.linha,quantidade:2}]);
  const atuais=await estado.prisma.lancamentoFinanceiro.findMany({where:{id:{in:lancamentos.map(l=>l.id)}}});
  await vincularItem(id,f.versao,i.id,{lancamentos:atuais.map(l=>({id:l.id,versao:l.updatedAt.toISOString()}))},sessao);
  await pagar(id,300);
  expect((await atual(id)).pagamentos).toHaveLength(1);
 });
 it("divergência bloqueia conciliação sem ajustar valor",async()=>{const {id}=await importar(formulario(undefined,"301.00"));await desdobrar(id);await expect(pagar(id,300)).rejects.toThrow("diferença");expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);});
 it("juros e tarifa ficam discriminados",async()=>{const {id}=await importar(formulario("Data;Descrição;Valor\n01/09/2026;JUROS;5,00\n02/09/2026;TARIFA;3,00","8.00"));expect((await atual(id)).itens.map(i=>i.tipo).sort()).toEqual(["JUROS","TARIFA"]);});
 it("desconciliação preserva despesas e histórico, reabre extrato",async()=>{const {id}=await importar();await desdobrar(id);const t=await pagar(id,300),f=await atual(id);await desconciliarFatura(id,f.versao,f.pagamentos[0].id,"Teste de reversão",sessao);expect(await estado.prisma.movimentacaoBancaria.count()).toBe(0);expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);expect((await estado.prisma.transacaoExtrato.findUniqueOrThrow({where:{id:t.id}})).conciliadaEm).toBeNull();expect(await estado.prisma.pagamentoFaturaCartao.count({where:{revertidoEm:{not:null}}})).toBe(1);expect(resumir(await atual(id)).estado).toBe("PRONTA");});
 it("cancelamento exige desvincular e conserva despesas",async()=>{const {id}=await importar();await desdobrar(id);let f=await atual(id);await expect(cancelarFatura(id,f.versao,"Duplicidade",false,sessao)).rejects.toThrow("desvincule");for(const i of f.itens){f=await atual(id);await ajustarItem(id,f.versao,i.id,"DESVINCULAR","Duplicidade",null,sessao);}f=await atual(id);await cancelarFatura(id,f.versao,"Duplicidade",false,sessao);expect((await atual(id)).estado).toBe("CANCELADA");expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(2);});
 it("fatura sem pagamento correspondente permanece pronta",async()=>{const {id}=await importar();await desdobrar(id);expect(resumir(await atual(id))).toMatchObject({estado:"PRONTA",pendente:30000});});
});
