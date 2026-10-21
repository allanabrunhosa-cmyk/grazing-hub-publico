import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import { merchant, pedidoRemoto } from "./fixtures";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
import { persistirEventos, processarEvento } from "@/lib/ifood/processamento";
import { consultarDetalhesMerchant, consultarOperacaoMerchant, solicitarMerchant, processarMerchant } from "@/lib/ifood/merchant";
import { salvarFinanceiroConfigIfood, renovarAutorizacao, retomarEventos, consultarEstadoLoja } from "@/lib/ifood/configuracao";
import { coletarEventos } from "@/lib/ifood/coletor";
import { solicitarAcao, enviarAcao, consultarPedidoIfood } from "@/lib/ifood/acoes";
import { obterToken, cifrarIfood, iniciarVinculo, concluirVinculo } from "@/lib/ifood/tokens";
import { adaptarPedido } from "@/lib/ifood/adaptador";
import { recuperarAcoesIfood, registrarConferenciaIfood } from "@/lib/ifood/reconciliacao";
import { gerarTitulosIfood, projetarFinanceiro } from "@/lib/ifood/financeiro";
import { ESTADOS, type EventoRemoto } from "@/lib/ifood/dominio";
import { confirmarPedido, cancelarPedido, mudarEstadoDevolucaoPedido, concluirDevolucaoContextual } from "@/lib/vendas/pedidos";
const esquema = "teste_ifood_" + randomUUID().replaceAll("-", "");
let formaId: string;
let banco: Client, lojaId: string, integracaoId: string, sessao: SessaoAtual, leitor: SessaoAtual;
const remoto = pedidoRemoto();
let tokenStatus = 200;
let pausasMerchant: {id:string;start:string;end:string;description:string}[] = [];
let horariosMerchant={storeId:merchant,shifts:[{dayOfWeek:"MONDAY",start:"09:00:00",duration:60}]};
let escritasMerchant=0,timeoutMerchant=false;
let erros401 = 0, leituraStatus = 200, acks = 0;
let lote: EventoRemoto[] = [], ackFalha = false, detalhesFalha = false, postStatus = 202, posts = 0, tokens = 0;
const evento = (code: keyof typeof ESTADOS | "ZZZ", offset = 0): EventoRemoto => ({ id: randomUUID(), orderId: remoto.id, merchantId: merchant, code, fullCode: code === "ZZZ" ? "DESCONHECIDO" : ESTADOS[code], createdAt: new Date(Date.now() + offset), metadata: {} });
const resposta = (data: unknown, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
async function receber(e: EventoRemoto) { await persistirEventos(lojaId, [e]); await processarEvento(); return sim.prisma.pedidoIfood.findUniqueOrThrow({ where: { lojaId_externoId: { lojaId, externoId: e.orderId! } }, include: { pedido: true } }); }

describe.skipIf(process.env.IFOOD_BANCO_TESTE !== "1")("iFood com PostgreSQL isolado e HTTP simulado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("teste")) throw new Error("Exige banco local nomeado teste.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query('CREATE SCHEMA "' + esquema + '"'); await banco.query('SET search_path TO "' + esquema + '"');
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile("prisma/migrations/" + p.name + "/migration.sql", "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: "-c search_path=" + esquema }, { schema: esquema }) });
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Operador fictício", email: "ifood@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const r = await sim.prisma.perfilAcesso.create({ data: { nome: "Leitura iFood", permissoes: { "vendas.pedidos": ["visualizar"] } } });
    const v = await sim.prisma.usuario.create({ data: { nome: "Leitor fictício", email: "leitor-ifood@example.invalid", senhaHash: "inutil", perfilAcessoId: r.id } });
    sessao = { userId: u.id, nome: u.nome, versao: 0 } as SessaoAtual; leitor = { ...sessao, userId: v.id };
    formaId = (await sim.prisma.formaPagamentoVenda.create({data:{nome:"Recebível iFood sintético",tipo:"OUTRO"}})).id;
    const categoria = await sim.prisma.categoriaFinanceira.findFirstOrThrow({ where: { grupo: "RECEITA_BRUTA", ativo: true } });
    const canal = await sim.prisma.canalVenda.create({ data: { nome: "iFood sintético", categoriaReceitaId: categoria.id } });
    vi.stubEnv("AUTH_SECRET", "chave-exclusivamente-sintetica-para-testes-locais"); vi.stubEnv("IFOOD_ATIVO", "1"); vi.stubEnv("IFOOD_TESTE_CLIENT_ID", "cliente-sintetico"); vi.stubEnv("IFOOD_TESTE_CLIENT_SECRET", "segredo-sintetico");
    const i = await sim.prisma.integracaoIfood.create({ data: { ambiente: "TESTE", modalidade: "CENTRALIZADO", clientId: "cliente-sintetico", ativo: true, criadoPorId: u.id } }); integracaoId = i.id;
    lojaId = (await sim.prisma.lojaIfood.create({ data: { integracaoId, ambiente: "TESTE", merchantId: merchant, nome: "Loja sintética", canalId: canal.id, autorizada: true, ativa: true, ultimaAutorizacao: new Date() } })).id;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.includes("/oauth/userCode")) return resposta({userCode:"TESTE-CODE",authorizationCodeVerifier:"verificador-sintetico",verificationUrl:"https://portal.ifood.com.br/apps/code",expiresIn:300});
      if (path.includes("/oauth/token")) { tokens++; return resposta({ accessToken: "token-sintetico-" + tokens, expiresIn: 1234 }, tokenStatus); }
      if (erros401 > 0) { erros401--; return resposta({},401); }
      if (leituraStatus !== 200) return resposta({},leituraStatus,{"Retry-After":"60"});
      if (path === "/merchant/v1.0/merchants/" + merchant) return resposta({ id: merchant, name: "Loja sintética", corporateName: "Empresa sintética", address: { street: "Rua fictícia", number: "1" }, operations: [{ name: "DELIVERY", salesChannels: [{ name: "MARKETPLACE", enabled: true }] }], clientSecret: "campo-privado-nao-retornar" });
      if (path.endsWith("/status")) return resposta([{operation:"DELIVERY",salesChannel:"MARKETPLACE",state:"CLOSED",available:false,privateData:"não retornar"},{operation:"TAKEOUT",salesChannel:"MARKETPLACE",state:"FUTURO",available:false}]);
      if (path.endsWith("events:polling")) return resposta(lote.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })));
      if (path.endsWith("acknowledgment")) {
        const ids = (JSON.parse(String(init?.body)) as { id: string }[]).map(e => e.id);
        expect(await sim.prisma.eventoIfood.count({ where: { lojaId, externoId: { in: ids } } })).toBe(ids.length);
        acks++; if (ackFalha) throw new Error("Rede simulada"); return resposta(null, 202);
      }
      if (path.includes("/merchant/") && path.endsWith("/opening-hours")) {
        if(init?.method==="PUT"){escritasMerchant++;horariosMerchant=JSON.parse(String(init.body));return resposta(horariosMerchant,201);}
        return resposta(horariosMerchant);
      }
      if (path.includes("/merchant/") && path.includes("/interruptions")) {
        if(init?.method==="POST"){escritasMerchant++;const entrada=JSON.parse(String(init.body));expect(entrada.start).not.toMatch(/Z$/);const civil=(v:string)=>v.replace(/\.000$/, "").replace(/(\.\d*[1-9])0+$/, "$1");const p={...entrada,id:randomUUID(),start:civil(entrada.start),end:civil(entrada.end)};pausasMerchant.push(p);if(timeoutMerchant)throw new Error("Timeout após efeito externo simulado");return resposta(p,201);}
        if(init?.method==="DELETE"){escritasMerchant++;const id=path.split("/").at(-1);pausasMerchant=pausasMerchant.filter(p=>p.id!==id);return resposta(null,204);}
        return resposta(pausasMerchant);
      }
      if (init?.method === "POST") { posts++; if (!postStatus) throw new Error("Timeout simulado"); return resposta({}, postStatus, { "Retry-After": "60" }); }
      if (path.endsWith("cancellationReasons")) return resposta([{cancelCodeId:"501",description:"Motivo sintético"}]);
      if (path.includes("/order/")) return detalhesFalha ? resposta({}, 503) : resposta(remoto);
      return resposta([{ id: merchant, name: "Loja sintética" }]);
    }));
  }, 90000);
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (banco) { if (/^teste_ifood_[a-f0-9]{32}$/.test(esquema)) await banco.query('DROP SCHEMA "' + esquema + '" CASCADE'); await banco.end(); }
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
  it("consulta estado real da loja sem confundir HTTP 200 com disponibilidade e respeita acesso", async () => {
    await expect(consultarEstadoLoja(lojaId,leitor)).rejects.toThrow(/acesso/);
    const r=await consultarEstadoLoja(lojaId,sessao);
    expect(r.operacoes).toEqual([{operacao:"DELIVERY",canal:"MARKETPLACE",estado:"Fechada",disponivel:false,validacoes:[]},{operacao:"TAKEOUT",canal:"MARKETPLACE",estado:"Estado desconhecido",disponivel:false,validacoes:[]}]);
    expect(JSON.stringify(r)).not.toContain("privateData");
    // Deixa a próxima verificação exercitar efetivamente a renovação concorrente.
    await sim.prisma.integracaoIfood.update({where:{id:integracaoId},data:{tokenExpiraEm:new Date(0)}});
  });
  it("renova token uma única vez sob concorrência e usa expiresIn", async () => {
    const antes = tokens; const todos = await Promise.all(Array.from({ length: 5 }, () => obterToken(integracaoId)));
    expect(new Set(todos).size).toBe(1); expect(tokens - antes).toBe(1);
    const i = await sim.prisma.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } });
    expect(i.tokenCifrado).not.toContain("token-sintetico"); expect(i.tokenExpiraEm!.getTime() - Date.now()).toBeGreaterThan(1200000);
  });
  it("consulta detalhes com autorização vigente sem efeitos ou dados privados extras", async () => {
    const chamadas = vi.mocked(fetch).mock.calls.length;
    await expect(consultarDetalhesMerchant(lojaId, leitor)).rejects.toThrow(/acesso/);
    expect(vi.mocked(fetch).mock.calls.length).toBe(chamadas);
    const antes = await sim.prisma.acaoMerchantIfood.count();
    const r = await consultarDetalhesMerchant(lojaId, sessao);
    expect(r.detalhes).toMatchObject({ id: merchant, nome: "Loja sintética", razaoSocial: "Empresa sintética", endereco: { rua: "Rua fictícia" }, operacoes: [{ nome: "DELIVERY", canais: [{ nome: "MARKETPLACE", habilitado: true }] }] });
    expect(JSON.stringify(r)).not.toContain("campo-privado-nao-retornar");
    expect(await sim.prisma.acaoMerchantIfood.count()).toBe(antes);
  });
  it("persiste antes do ACK, recupera ACK perdido e processa após falha do worker", async () => {
    lote = [evento("PLC")]; ackFalha = true; await coletarEventos();
    expect(await sim.prisma.lojaIfood.findUnique({where:{id:lojaId},select:{ultimoErro:true}})).toEqual({ultimoErro:"Resposta iFood incerta; confira a reconciliação."});
    expect(await sim.prisma.eventoIfood.count({ where: { ackEm: null } })).toBe(1); expect(await sim.prisma.pedidoVenda.count()).toBe(0);
    ackFalha = false; await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { proximoPolling: new Date(0) } }); await coletarEventos();
    expect(await sim.prisma.eventoIfood.count({ where: { ackEm: { not: null } } })).toBe(1);
    detalhesFalha = true; await processarEvento(); expect(await sim.prisma.pedidoVenda.count()).toBe(0);
    detalhesFalha = false; await sim.prisma.eventoIfood.updateMany({ data: { proximaTentativa: new Date(0) } }); await processarEvento();
    expect(await sim.prisma.pedidoVenda.count()).toBe(1); expect(await sim.prisma.itemPedidoVenda.count({ where: { produtoId: null } })).toBe(1);
  });
  it("eventos paralelos e diferentes convergem para um pedido sem estoque e sem cliente inventado", async () => {
    const e = evento("CFM"); await Promise.all(Array.from({ length: 4 }, () => persistirEventos(lojaId, [e])));
    await persistirEventos(lojaId, [evento("PRS", 10)]); await Promise.all([processarEvento(), processarEvento()]);
    expect(await sim.prisma.pedidoVenda.count()).toBe(1); expect(await sim.prisma.eventoIfood.count({ where: { externoId: e.id } })).toBe(1);
    const p = await sim.prisma.pedidoVenda.findFirstOrThrow(); expect(p.clienteId).toBeNull(); expect(p.total.toFixed(2)).toBe("25.70"); expect(p.statusOperacional).toBe("EM_PREPARO");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0); expect(await sim.prisma.reservaPedido.count()).toBe(0); expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: p.id } })).toBe(0);
  });
  it("gera títulos existentes apenas uma vez sem repasse ou baixa e mantém projeção após novos eventos", async () => {
    const p = await sim.prisma.pedidoVenda.findFirstOrThrow(); const adaptado = adaptarPedido(remoto, merchant, "TESTE", p.fusoHorario);
    const ambienteNode = process.env.NODE_ENV;
    try {
      vi.stubEnv("NODE_ENV","production");
      await expect(sim.prisma.$transaction(tx => gerarTitulosIfood(tx,p.id,adaptado,new Date("2026-10-20T12:00:00Z"),{id:sessao.userId,nome:sessao.nome},{"0":formaId}))).rejects.toThrow(/teste não gera/);
      expect(await sim.prisma.lancamentoFinanceiro.count({where:{pedidoVendaId:p.id}})).toBe(0);
    } finally { vi.stubEnv("NODE_ENV",ambienteNode); }
    for (let n=0;n<2;n++) await sim.prisma.$transaction(tx => gerarTitulosIfood(tx,p.id,adaptado,new Date("2026-10-20T12:00:00Z"),{ id:sessao.userId,nome:sessao.nome }, {"0":formaId}));
    expect(await sim.prisma.lancamentoFinanceiro.count({ where:{pedidoVendaId:p.id} })).toBe(1);
    expect(await sim.prisma.pagamentoExternoPedido.count({ where:{pedidoId:p.id} })).toBe(1); expect(await sim.prisma.repassePagamentoPedido.count()).toBe(0);
    const atualizado = await receber(evento("RTP",20)); expect(atualizado.financeiroPendente).toBe(false); expect(atualizado.pedido.entregueEm).toBeNull();
  });
  it("bloqueia leitor, ação manual e estado proibido no servidor", async () => {
    const p = await sim.prisma.pedidoVenda.findFirstOrThrow();
    await expect(solicitarAcao(p.id,p.versao,"dispatch",{},randomUUID(),leitor)).rejects.toThrow(/acesso/);
    await expect(solicitarAcao(p.id,p.versao,"confirm",{},randomUUID(),sessao)).rejects.toThrow(/indisponível/);
    await expect(confirmarPedido(p.id,p.versao,randomUUID(),sessao)).rejects.toThrow(/iFood/);
  });
  it("timeout de ação não reenvia e evento posterior reconcilia o mesmo pedido", async () => {
    const p = await sim.prisma.pedidoVenda.findFirstOrThrow(); const key=randomUUID();
    await solicitarAcao(p.id,p.versao,"dispatch",{},key,sessao); await solicitarAcao(p.id,p.versao,"dispatch",{},key,sessao);
    postStatus=0; const antes=posts; await enviarAcao(); await enviarAcao(); expect(posts-antes).toBe(1);
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where:{chave:key} })).estado).toBe("INCERTA");
    await receber(evento("DSP",1000)); expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where:{chave:key} })).estado).toBe("CONFIRMADA"); postStatus=202;
  });
  it("evento desconhecido e atrasado não reabre concluído; cancelamento preserva título baixado", async () => {
    let p=await receber(evento("CON",2000)); await receber(evento("PLC",-60000));
    await persistirEventos(lojaId,[evento("ZZZ")]); await processarEvento();
    expect(await sim.prisma.eventoIfood.count({where:{estado:"DESCONHECIDO"}})).toBe(1);
    expect((await sim.prisma.pedidoIfood.findUniqueOrThrow({where:{id:p.id}})).estadoRemoto).toBe("CONCLUDED");
    await sim.prisma.lancamentoFinanceiro.updateMany({where:{pedidoVendaId:p.pedidoId},data:{status:"BAIXADO"}});
    p=await receber(evento("CAN",3000)); expect(p.pedido.status).toBe("CANCELADO"); expect(p.financeiroPendente).toBe(true);
    expect(await sim.prisma.lancamentoFinanceiro.count({where:{pedidoVendaId:p.pedidoId,status:"BAIXADO"}})).toBe(1);
  });
  it("pausa processamento com a chave desligada e não expõe segredos no DTO", async () => {
    vi.stubEnv("IFOOD_ATIVO","0"); expect(await processarEvento()).toBe(false); expect(await enviarAcao()).toBe(false);
    const p=await sim.prisma.pedidoVenda.findFirstOrThrow(); const dto=JSON.stringify(await consultarPedidoIfood(p.id,sessao));
    expect(dto).not.toMatch(/tokenCifrado|clientSecret|token-sintetico|snapshotCifrado/); vi.stubEnv("IFOOD_ATIVO","1");
    await sim.prisma.integracaoIfood.update({where:{id:integracaoId},data:{tokenCifrado:cifrarIfood("token-sintetico")}});
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("mostra o displayId e diagnostica horário agendado anterior à criação sem alterar o snapshot", async () => {
    const p = await sim.prisma.pedidoIfood.findFirstOrThrow();
    const anterior = new Date("2026-01-22T18:20:24Z");
    const cifra = cifrarIfood({ ...pedidoRemoto(), orderTiming: "SCHEDULED", preparationStartDateTime: anterior.toISOString() });
    try {
      await sim.prisma.pedidoIfood.update({ where: { id: p.id }, data: { snapshotCifrado: cifra, inicioPreparo: anterior } });
      const dto = await consultarPedidoIfood(p.pedidoId, sessao);
      expect(dto?.displayId).toBe("TESTE-01");
      expect(dto?.horarioInconsistente).toBe(true);
      expect(dto?.inicioPreparo).toBe(anterior.toISOString());
      expect((await sim.prisma.pedidoIfood.findUniqueOrThrow({ where: { id: p.id } })).snapshotCifrado).toBe(cifra);
    } finally {
      await sim.prisma.pedidoIfood.update({ where: { id: p.id }, data: { snapshotCifrado: p.snapshotCifrado, inicioPreparo: p.inicioPreparo } });
    }
  });
  it("distribuído vincula o verificador à sessão solicitante sem expô-lo",async()=>{
    await sim.prisma.integracaoIfood.update({where:{id:integracaoId},data:{modalidade:"DISTRIBUIDO"}});
    const inicio=await iniciarVinculo(integracaoId,sessao,"sessao-sintetica-a");
    expect(JSON.stringify(inicio)).not.toContain("verificador-sintetico");
    await expect(concluirVinculo(integracaoId,inicio.id,"TESTE_CODE",sessao,"sessao-sintetica-b")).rejects.toThrow(/sessão/);
    await concluirVinculo(integracaoId,inicio.id,"TESTE_CODE",sessao,"sessao-sintetica-a");
    expect((await sim.prisma.integracaoIfood.findUniqueOrThrow({where:{id:integracaoId}})).verificadorCifrado).toBeNull();
    await sim.prisma.integracaoIfood.update({where:{id:integracaoId},data:{modalidade:"CENTRALIZADO"}});
  });
  it("401 recupera uma vez; 403 revoga a loja sem apagar eventos", async () => {
    lote=[]; erros401=1; const antes=tokens;
    await sim.prisma.lojaIfood.update({where:{id:lojaId},data:{proximoPolling:new Date(0)}});
    await coletarEventos(); expect(tokens-antes).toBe(1);
    leituraStatus=403;
    await sim.prisma.lojaIfood.update({where:{id:lojaId},data:{proximoPolling:new Date(0)}});
    await coletarEventos();
    expect((await sim.prisma.lojaIfood.findUniqueOrThrow({where:{id:lojaId}})).autorizada).toBe(false);
    expect(await sim.prisma.eventoIfood.count()).toBeGreaterThan(0);
    leituraStatus=200;
    await sim.prisma.lojaIfood.update({where:{id:lojaId},data:{autorizada:true,proximoPolling:new Date(0)}});
  });
  it("falha de gravação impede ACK; nova coleta recupera o evento", async () => {
    remoto.id=randomUUID(); remoto.createdAt=new Date().toISOString(); lote=[evento("PLC")]; const antes=acks;
    await banco.query('ALTER TABLE "EventoIfood" ADD CONSTRAINT "teste_falha_gravacao" CHECK (false) NOT VALID');
    try { await coletarEventos(); expect(acks).toBe(antes); }
    finally { await banco.query('ALTER TABLE "EventoIfood" DROP CONSTRAINT "teste_falha_gravacao"'); }
    await sim.prisma.lojaIfood.update({where:{id:lojaId},data:{proximoPolling:new Date(0)}});
    await coletarEventos(); expect(acks).toBe(antes+1); await processarEvento();
    expect(await sim.prisma.pedidoIfood.count({where:{externoId:remoto.id}})).toBe(1);
  });
  it("429 aguarda Retry-After; revogação da sessão bloqueia envio pendente", async () => {
    const p=await sim.prisma.pedidoIfood.findUniqueOrThrow({where:{lojaId_externoId:{lojaId,externoId:remoto.id}},include:{pedido:true}});
    const chave=randomUUID(); await solicitarAcao(p.pedidoId,p.pedido.versao,"confirm",{},chave,sessao);
    postStatus=429; const antes=posts; await enviarAcao(); await enviarAcao(); expect(posts-antes).toBe(1);
    const a=await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave}}); expect(a.estado).toBe("PENDENTE"); expect(a.proximaTentativa.getTime()-Date.now()).toBeGreaterThan(55000);
    await sim.prisma.usuario.update({where:{id:sessao.userId},data:{sessaoVersao:{increment:1}}});
    await sim.prisma.acaoIfood.update({where:{id:a.id},data:{proximaTentativa:new Date(0)}});
    postStatus=202; await enviarAcao(); expect(posts-antes).toBe(1);
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("RECUSADA");
    await sim.prisma.usuario.update({where:{id:sessao.userId},data:{sessaoVersao:0}});
  });
  it("eventos sem orderId são persistidos e diagnosticados sem criar pedidos",async()=>{
    const antes=await sim.prisma.pedidoVenda.count();
    await persistirEventos(lojaId,[{...evento("ZZZ"),orderId:null}]); await processarEvento();
    expect(await sim.prisma.eventoIfood.count({where:{pedidoExternoId:null,estado:"DESCONHECIDO"}})).toBe(1);
    expect(await sim.prisma.pedidoVenda.count()).toBe(antes);
  });
  it("credencial recusada suspende a coleta; atualização administrativa recupera autorização",async()=>{
    await sim.prisma.integracaoIfood.update({where:{id:integracaoId},data:{tokenExpiraEm:new Date(0)}});tokenStatus=400;
    await expect(obterToken(integracaoId)).rejects.toMatchObject({status:400});
    expect((await sim.prisma.lojaIfood.findUniqueOrThrow({where:{id:lojaId}})).autorizada).toBe(false);
    expect(await coletarEventos()).toBe(false);tokenStatus=200;
    await renovarAutorizacao(integracaoId,sessao);
    expect((await sim.prisma.lojaIfood.findUniqueOrThrow({where:{id:lojaId}})).autorizada).toBe(true);
    const e=evento("ZZZ"); await persistirEventos(lojaId,[e]);
    await sim.prisma.eventoIfood.updateMany({where:{lojaId,externoId:e.id},data:{estado:"FALHOU"}});
    await expect(retomarEventos(lojaId,leitor)).rejects.toThrow(/acesso/);
    expect(await retomarEventos(lojaId,sessao)).toBe(1);await processarEvento();
  });
  it("alteração remota atualiza o mesmo pedido sem duplicar itens vigentes; negociação não suportada suspende comandos", async () => {
    remoto.items[0].unitPrice=11.1; remoto.items[0].price=22.2; remoto.items[0].totalPrice=24.2; remoto.total.subTotal=24.2; remoto.total.orderAmount=27.7; remoto.payments.prepaid=27.7; remoto.payments.methods[0].value=27.7;
    const e={...evento("ZZZ"),code:"OPA",fullCode:"ORDER_PATCHED"}; await receber(e);
    const p=await sim.prisma.pedidoIfood.findUniqueOrThrow({where:{lojaId_externoId:{lojaId,externoId:remoto.id}}});
    expect((await consultarPedidoIfood(p.pedidoId,sessao))?.total).toBe("27.70");
    const quantidade=await sim.prisma.itemPedidoVenda.count({where:{pedidoId:p.pedidoId}});
    await receber({...e,id:randomUUID()});
    expect(await sim.prisma.itemPedidoVenda.count({where:{pedidoId:p.pedidoId}})).toBe(quantidade);
    expect(await sim.prisma.itemPedidoVenda.count({where:{pedidoId:p.pedidoId,vigente:true}})).toBe(1);
    await receber({...evento("ZZZ"),code:"HSD",fullCode:"HANDSHAKE_DISPUTE",metadata:{id:randomUUID(),action:"PARTIAL_CANCELLATION",handshakeType:"AFTER_DELIVERY_PARTIALLY",expiresAt:new Date(Date.now()+60000).toISOString(),message:"Solicitação sintética"}});
    const dto=await consultarPedidoIfood(p.pedidoId,sessao); expect(dto?.negociacao?.compativel).toBe(false); expect(dto?.acoesPermitidas).toEqual([]);
  });
  it("aceite de disputa aguarda resultado correlacionado; cancelamento aguarda CAN",async()=>{
    const disputaId=randomUUID();
    let p=await receber({...evento("ZZZ"),code:"HSD",fullCode:"HANDSHAKE_DISPUTE",metadata:{id:disputaId,action:"CANCELLATION",handshakeType:"AFTER_DELIVERY",expiresAt:new Date(Date.now()+60000).toISOString()}});
    const chave=randomUUID(); await solicitarAcao(p.pedidoId,p.pedido.versao,"acceptDispute",{},chave,sessao);
    postStatus=201;await enviarAcao();
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("AGUARDANDO_EVENTO");
    await receber({...evento("ZZZ",1000),code:"HSS",fullCode:"HANDSHAKE_SETTLEMENT",metadata:{id:randomUUID(),disputeId:randomUUID(),status:"ACCEPTED"}});
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("AGUARDANDO_EVENTO");
    p=await receber({...evento("ZZZ",2000),code:"HSS",fullCode:"HANDSHAKE_SETTLEMENT",metadata:{id:randomUUID(),disputeId:disputaId,status:"ACCEPTED"}});
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("CONFIRMADA");expect(p.pedido.status).not.toBe("CANCELADO");
    const cancelamento=randomUUID();await solicitarAcao(p.pedidoId,p.pedido.versao,"requestCancellation",{codigo:"501",motivo:"Justificativa sintética"},cancelamento,sessao);
    postStatus=202;await enviarAcao();expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave:cancelamento}})).estado).toBe("AGUARDANDO_EVENTO");
    p=await receber(evento("CAN",3000));expect(p.pedido.status).toBe("CANCELADO");expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave:cancelamento}})).estado).toBe("CONFIRMADA");
  });

  it("parametrização gera títulos automaticamente e CAN solicita tratamento só dos valores recebidos", async () => {
    const original = await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: lojaId } });
    try {
      Object.assign(remoto, { ...pedidoRemoto(), id: randomUUID(), benefits: [], additionalFees: [] });
      await receber(evento("PLC")); const p = await receber(evento("CFM", 10));
      await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { ambiente: "PRODUCAO", financeiroConfig: Prisma.DbNull } });
      await sim.prisma.pedidoIfood.update({ where: { pedidoId: p.pedidoId }, data: { financeiroPendente: true, snapshotCifrado: cifrarIfood({ ...remoto, isTest: false }) } });
      await expect(salvarFinanceiroConfigIfood(lojaId, original.versaoFinanceiroConfig, { prazoDias: 7, contagem: "CORRIDOS", formas: { CREDIT: formaId } }, randomUUID(), leitor)).rejects.toThrow(/acesso/);
      const k = randomUUID(); const config = { prazoDias: 7, contagem: "CORRIDOS", formas: { CREDIT: formaId } };
      await salvarFinanceiroConfigIfood(lojaId, original.versaoFinanceiroConfig, config, k, sessao);
      await salvarFinanceiroConfigIfood(lojaId, original.versaoFinanceiroConfig, config, k, sessao);
      await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { ambiente: "PRODUCAO" } });
      const adaptado = adaptarPedido({ ...remoto, isTest: false }, merchant, "PRODUCAO", p.pedido.fusoHorario);
      for (let n=0;n<2;n++) await sim.prisma.$transaction(tx => projetarFinanceiro(tx, p.pedidoId, adaptado, false));
      const ts = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.pedidoId } });
      expect(ts).toHaveLength(1); expect(ts[0].status).toBe("PENDENTE");
      expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.pedidoId } } })).toBe(0);
      await expect(cancelarPedido(p.pedidoId,p.pedido.versao,"Não permite cancelamento local",randomUUID(),sessao)).rejects.toThrow(/ações iFood/);
      // Liquidação sintética para conferir ajuste após CAN; nenhuma transferência externa.
      await sim.prisma.lancamentoFinanceiro.update({ where: { id: ts[0].id }, data: { status: "BAIXADO" } });
      await sim.prisma.pagamentoExternoPedido.updateMany({ where: { pedidoId: p.pedidoId }, data: { status: "CANCELADO_EXTERNAMENTE" } });
      await sim.prisma.pedidoVenda.update({ where: { id: p.pedidoId }, data: { status: "CANCELADO" } });
      for (let n=0;n<2;n++) await sim.prisma.$transaction(tx => projetarFinanceiro(tx, p.pedidoId, adaptado, true));
      const dev = await sim.prisma.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: p.pedidoId } });
      expect(dev.status).toBe("SOLICITADA"); expect(await sim.prisma.tratamentoFinanceiroPedido.count({ where: { pedidoId: p.pedidoId } })).toBe(1);
      await expect(mudarEstadoDevolucaoPedido(p.pedidoId,dev.id,"PROCESSANDO","",randomUUID(),leitor)).rejects.toThrow(/acesso/);
      await mudarEstadoDevolucaoPedido(p.pedidoId,dev.id,"PROCESSANDO","",randomUUID(),sessao);
      await expect(concluirDevolucaoContextual(p.pedidoId,dev.id,"conta-inexistente","2026-10-08","Evidência sintética",randomUUID(),sessao)).rejects.toThrow(/cadastro do canal/);
      expect((await sim.prisma.tratamentoFinanceiroPedido.findUniqueOrThrow({ where: { id: dev.id } })).status).toBe("PROCESSANDO");
    } finally { await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { ambiente: original.ambiente, financeiroConfig: original.financeiroConfig ?? Prisma.DbNull, versaoFinanceiroConfig: original.versaoFinanceiroConfig } }); }
  }, 15000);
  it("financeiro isolado exclui receita iFood, soma subsídio uma vez e preserva baixas após cancelamento parcial",async()=>{
    const base=pedidoRemoto();
    Object.assign(remoto,{...base,id:randomUUID(),total:{...base.total,benefits:5,additionalFees:1,orderAmount:21.7},benefits:[{value:5,target:"CART",sponsorshipValues:[{name:"IFOOD",value:3},{name:"MERCHANT",value:2}]}],additionalFees:[{type:"SMALL_ORDER_FEE",value:1,liabilities:[{name:"IFOOD",percentage:100}]}],payments:{prepaid:21.7,pending:0,methods:[{...base.payments.methods[0],value:21.7}]}});
    await receber(evento("PLC"));let p=await receber(evento("CFM",10));
    const adaptado=adaptarPedido(remoto,merchant,"TESTE",p.pedido.fusoHorario);
    for(let n=0;n<2;n++)await sim.prisma.$transaction(tx=>gerarTitulosIfood(tx,p.pedidoId,adaptado,new Date("2026-10-20T12:00:00Z"),{id:sessao.userId,nome:sessao.nome},{"0":formaId}));
    const titulos=await sim.prisma.lancamentoFinanceiro.findMany({where:{pedidoVendaId:p.pedidoId}});
    expect(titulos).toHaveLength(1);expect(titulos[0].valor.toFixed(2)).toBe("23.70");expect(titulos[0].status).toBe("PENDENTE");
    expect(await sim.prisma.repassePagamentoPedido.count({where:{pagamento:{pedidoId:p.pedidoId}}})).toBe(0);
    await sim.prisma.lancamentoFinanceiro.update({where:{id:titulos[0].id},data:{status:"BAIXADO"}});
    const disputaId=randomUUID();
    p=await receber({...evento("ZZZ",20),code:"HSD",fullCode:"HANDSHAKE_DISPUTE",metadata:{id:disputaId,action:"PARTIAL_CANCELLATION",handshakeType:"AFTER_DELIVERY_PARTIALLY",expiresAt:new Date(Date.now()+60000).toISOString(),metadata:{items:[{id:base.items[0].id,uniqueId:randomUUID(),index:0,quantity:1,amount:{value:"1100",currency:"BRL"}}],acceptCancellationReasons:["PRODUCT_QUALITY"]}}});
    expect((await consultarPedidoIfood(p.pedidoId,sessao))?.negociacao?.compativel).toBe(true);
    await expect(solicitarAcao(p.pedidoId,p.pedido.versao,"acceptDispute",{},randomUUID(),sessao)).rejects.toThrow(/motivo/);
    const chave=randomUUID();await solicitarAcao(p.pedidoId,p.pedido.versao,"acceptDispute",{codigo:"PRODUCT_QUALITY",motivo:"Teste local"},chave,sessao);postStatus=201;await enviarAcao();
    p=await receber({...evento("ZZZ",1000),code:"HSS",fullCode:"HANDSHAKE_SETTLEMENT",metadata:{disputeId:disputaId,status:"ACCEPTED"}});
    expect(p.pedido.status).toBe("CONFIRMADO");expect(p.revisaoPendente).toBe(true);expect(p.pedido.total.toFixed(2)).toBe("21.70");
    p=await receber({...evento("ZZZ",1500),code:"OPA",fullCode:"ORDER_PATCHED"});
    expect(p.revisaoPendente).toBe(true);expect(p.pedido.total.toFixed(2)).toBe("21.70");
    remoto.items[0].quantity=1;remoto.items[0].price=10.1;remoto.items[0].totalPrice=12.1;remoto.total.subTotal=12.1;remoto.total.orderAmount=11.6;remoto.payments.prepaid=11.6;remoto.payments.methods[0].value=11.6;
    const opa={...evento("ZZZ",2000),code:"OPA",fullCode:"ORDER_PATCHED"};p=await receber(opa);await receber({...opa,id:randomUUID()});
    expect(p.revisaoPendente).toBe(false);expect(p.financeiroPendente).toBe(true);expect(p.pedido.total.toFixed(2)).toBe("11.60");
    expect(await sim.prisma.itemPedidoVenda.count({where:{pedidoId:p.pedidoId,vigente:true}})).toBe(1);
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({where:{id:titulos[0].id}})).valor.toFixed(2)).toBe("23.70");
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({where:{id:titulos[0].id}})).status).toBe("BAIXADO");
    expect(await sim.prisma.reservaPedido.count({where:{item:{pedidoId:p.pedidoId}}})).toBe(0);
  }, 15000);
  it("retoma ação incerta por evidência persistida e registra intervenção sem sucesso nem replay",async()=>{
    Object.assign(remoto,{...pedidoRemoto(),id:randomUUID(),benefits:[],additionalFees:[]});
    await receber(evento("PLC"));let p=await receber(evento("CFM",10));
    const chave=randomUUID();await solicitarAcao(p.pedidoId,p.pedido.versao,"startPreparation",{},chave,sessao);postStatus=0;await enviarAcao();
    const a=await sim.prisma.acaoIfood.findUniqueOrThrow({where:{chave}});expect(a.estado).toBe("INCERTA");const chamadas=posts;
    await expect(registrarConferenciaIfood(p.pedidoId,a.id,"SEM_EVIDENCIA","TESTE-01",randomUUID(),leitor)).rejects.toThrow(/acesso/);
    const registro=randomUUID();for(let n=0;n<2;n++)await registrarConferenciaIfood(p.pedidoId,a.id,"SEM_EVIDENCIA","TESTE-01",registro,sessao);
    expect(await sim.prisma.historicoPedidoVenda.count({where:{chaveOperacao:"ifood-conferencia:"+registro}})).toBe(1);
    await recuperarAcoesIfood();expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{id:a.id}})).estado).toBe("INCERTA");expect(posts).toBe(chamadas);
    p=await receber(evento("PRS",1000));await sim.prisma.acaoIfood.update({where:{id:a.id},data:{estado:"INCERTA"}});
    await recuperarAcoesIfood();await recuperarAcoesIfood();expect((await sim.prisma.acaoIfood.findUniqueOrThrow({where:{id:a.id}})).estado).toBe("CONFIRMADA");
    expect(await sim.prisma.historicoPedidoVenda.count({where:{chaveOperacao:"ifood-reconciliacao:"+a.id}})).toBe(1);expect(posts).toBe(chamadas);postStatus=202;
  });

  it("Merchant usa fila durável, bloqueia leitor e confere pausa, remoção e turnos sem navegador",async()=>{
    await expect(consultarOperacaoMerchant(lojaId,leitor)).rejects.toThrow(/acesso/);
    const chave=randomUUID();for(let n=0;n<2;n++)await solicitarMerchant(lojaId,"PAUSAR",{minutos:5},chave,sessao);
    expect(await sim.prisma.acaoMerchantIfood.count({where:{chave}})).toBe(1);expect(escritasMerchant).toBe(0);
    await processarMerchant();expect(escritasMerchant).toBe(1);expect((await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("CONFIRMADA");
    const consulta=await consultarOperacaoMerchant(lojaId,sessao);expect(consulta.pausas).toHaveLength(1);
    await solicitarMerchant(lojaId,"RETOMAR",{id:consulta.pausas[0].id},randomUUID(),sessao);await processarMerchant();expect((await consultarOperacaoMerchant(lojaId,sessao)).pausas).toEqual([]);
    const horario=await consultarOperacaoMerchant(lojaId,sessao);const turnos=[{dayOfWeek:"MONDAY",start:"09:00:00",duration:60},{dayOfWeek:"MONDAY",start:"11:00:00",duration:60}];
    const mudar=randomUUID();await solicitarMerchant(lojaId,"HORARIOS",{hashHorarios:horario.hashHorarios,shifts:turnos},mudar,sessao);await processarMerchant();
    expect((await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({where:{chave:mudar}})).estado).toBe("CONFIRMADA");expect((await consultarOperacaoMerchant(lojaId,sessao)).horarios.shifts).toHaveLength(2);
    await expect(solicitarMerchant(lojaId,"HORARIOS",{hashHorarios:horario.hashHorarios,shifts:turnos},randomUUID(),sessao)).rejects.toThrow(/mudaram/);
    await expect(solicitarMerchant(lojaId,"HORARIOS",{hashHorarios:(await consultarOperacaoMerchant(lojaId,sessao)).hashHorarios,shifts:[turnos[0],turnos[0]]},randomUUID(),sessao)).rejects.toThrow(/sobrepõem/);
  });
  it("Merchant recupera POST aplicado com timeout por GET e não reenvia após reinício",async()=>{
    timeoutMerchant=true;const chave=randomUUID(),antes=escritasMerchant;await solicitarMerchant(lojaId,"PAUSAR",{minutos:5},chave,sessao);await processarMerchant();
    expect((await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("INCERTA");expect(escritasMerchant).toBe(antes+1);
    timeoutMerchant=false;await sim.prisma.acaoMerchantIfood.update({where:{chave},data:{proximaTentativa:new Date(0)}});await processarMerchant();
    expect((await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("CONFIRMADA");expect(escritasMerchant).toBe(antes+1);
    const p=(await consultarOperacaoMerchant(lojaId,sessao)).pausas[0];await solicitarMerchant(lojaId,"RETOMAR",{id:p.id},randomUUID(),sessao);await processarMerchant();
    await sim.prisma.lojaIfood.update({where:{id:lojaId},data:{ambiente:"PRODUCAO"}});vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA","1");
    await expect(solicitarMerchant(lojaId,"PAUSAR",{minutos:5},randomUUID(),sessao)).rejects.toThrow(/somente na loja de teste/);
    await sim.prisma.lojaIfood.update({where:{id:lojaId},data:{ambiente:"TESTE"}});vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA","0");
  });

  it("Merchant interrompe conferências sem prova e permite retomada rastreável só por leitura",async()=>{
    const chave=randomUUID(),antes=escritasMerchant;
    await solicitarMerchant(lojaId,"PAUSAR",{minutos:5},chave,sessao);
    await sim.prisma.acaoMerchantIfood.update({where:{chave},data:{estado:"ENVIANDO",enviadaEm:new Date(Date.now()-180000),tentativas:5}});
    await processarMerchant();
    const a=await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({where:{chave}});
    expect(a.estado).toBe("INTERVENCAO");expect(escritasMerchant).toBe(antes);
    await expect(solicitarMerchant(lojaId,"CONFERIR",{id:a.id},randomUUID(),leitor)).rejects.toThrow(/acesso/);
    const conferir=randomUUID();for(let n=0;n<2;n++)await solicitarMerchant(lojaId,"CONFERIR",{id:a.id},conferir,sessao);
    await processarMerchant();
    expect((await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({where:{chave}})).estado).toBe("INCERTA");
    expect(escritasMerchant).toBe(antes);
    expect(await sim.prisma.historicoCadastroVenda.count({where:{id:conferir}})).toBe(1);
  });

  it("disputa atrasada ou reentregue com outro evento não reabre negociação já encerrada",async()=>{
    Object.assign(remoto,{...pedidoRemoto(),id:randomUUID(),benefits:[],additionalFees:[]});await receber(evento("PLC"));await receber(evento("CFM",10));
    const disputaId=randomUUID(),hsd={...evento("ZZZ",20),code:"HSD",fullCode:"HANDSHAKE_DISPUTE",metadata:{id:disputaId,action:"CANCELLATION",handshakeType:"AFTER_DELIVERY",expiresAt:new Date(Date.now()+60000).toISOString()}};
    await receber(hsd);let p=await receber({...evento("ZZZ",500),code:"HSS",fullCode:"HANDSHAKE_SETTLEMENT",metadata:{disputeId:disputaId,status:"FUTURO"}});expect(p.disputaId).toBe(disputaId);
    p=await receber({...evento("ZZZ",1000),code:"HSS",fullCode:"HANDSHAKE_SETTLEMENT",metadata:{disputeId:disputaId,status:"REJECTED"}});expect(p.disputaId).toBeNull();
    p=await receber({...hsd,id:randomUUID()});expect(p.disputaId).toBeNull();expect(p.pedido.status).toBe("CONFIRMADO");
    const nova=randomUUID();p=await receber({...hsd,id:randomUUID(),createdAt:new Date(Date.now()+2000),metadata:{...hsd.metadata,id:nova}});expect(p.disputaId).toBe(nova);
    p=await receber({...hsd,id:randomUUID()});expect(p.disputaId).toBe(nova);
  });

  it("limita ACK a 2.000 IDs duráveis e retoma o restante no próximo ciclo", async () => {
    lote = []; ackFalha = false;
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { proximoPolling: new Date(0) } }); await coletarEventos();
    expect(await sim.prisma.eventoIfood.count({ where: { lojaId, ackEm: null } })).toBe(0);
    const pendentes = Array.from({ length: 2001 }, () => evento("ZZZ")), ids = pendentes.map(e => e.id);
    // Massa sintética já durável: o cenário exercita ACK, sem repetir 2.001 derivações scrypt.
    const metadataCifrada = cifrarIfood({});
    await sim.prisma.eventoIfood.createMany({ data: pendentes.map(e => ({ lojaId, externoId: e.id, pedidoExternoId: e.orderId, codigo: e.code, codigoCompleto: e.fullCode, ocorridoEm: e.createdAt, metadataCifrada })) });
    const inicioChamadas = vi.mocked(fetch).mock.calls.length, inicioAcks = acks;
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { proximoPolling: new Date(0) } }); await coletarEventos();
    expect(await sim.prisma.eventoIfood.count({ where: { lojaId, externoId: { in: ids }, ackEm: { not: null } } })).toBe(2000);
    expect(await sim.prisma.eventoIfood.count({ where: { lojaId, externoId: { in: ids }, ackEm: null } })).toBe(1);
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { proximoPolling: new Date(0) } }); await coletarEventos();
    const corpos = vi.mocked(fetch).mock.calls.slice(inicioChamadas).filter(([url]) => new URL(String(url)).pathname.endsWith("acknowledgment")).map(([, op]) => JSON.parse(String(op?.body)) as { id: string }[]);
    expect(corpos.map(c => c.length)).toEqual([2000, 1]); expect(acks - inicioAcks).toBe(2);
    expect(new Set(corpos.flat().map(e => e.id))).toEqual(new Set(ids));
    expect(await sim.prisma.eventoIfood.count({ where: { lojaId, externoId: { in: ids }, ackEm: null } })).toBe(0);
  }, 15000);

});
