import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';
import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import contrato from './contrato-acoes.json';
const s=vi.hoisted(()=>({sessao:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/session',()=>({getSession:s.sessao}));
vi.mock('next/navigation',()=>({redirect:(p:string)=>{throw new Error(`REDIRECT:${p}`);}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({}, {get:()=>{throw new Error('BANCO_NAO_DEVE_SER_ACESSADO');}})}));
import {exigirPermissao} from '@/lib/permissoes/servidor';
import OperacaoPage from '@/app/(protegido)/vendas/pedidos/[id]/operacao/page';
import {ConteudoGestaoPedidos} from '@/app/(protegido)/vendas/pedidos/gestao/conteudo';
import ProducaoPage from '@/app/(protegido)/vendas/pedidos/producao/page';
import CalendarioPage from '@/app/(protegido)/vendas/pedidos/calendario/page';
import {ConteudoComanda} from '@/app/(protegido)/vendas/pedidos/[id]/comanda/conteudo';
function arquivos(p:string):string[]{return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?arquivos(path.join(p,d.name)):[path.join(p,d.name)]);}
beforeEach(()=>s.sessao.mockResolvedValue({userId:'leitor',admin:false,permissoes:{compras:['visualizar']},excecoes:{}}));
describe('autorização real nas fronteiras do servidor',()=>{
 beforeAll(async()=>{
  // Esses imports incluem os SDKs MCP/fiscal. Separe a transformação fria da
  // verificação de recusa (que continua com o timeout padrão de 5 segundos).
  for (const funcao of ['aprovarMcpAction','obterResumoCancelamentoNotaAction','prepararPilotosBrasilNfeAction']) {
   const entrada=contrato.find(c=>c.funcao===funcao)!;
   await import('../../'+entrada.arquivo);
  }
 },60_000);
 it('acesso de leitura rejeita escrita e permissão ausente rejeita leitura',async()=>{
  await expect(exigirPermissao('compras','editar')).rejects.toThrow('REDIRECT:/sem-acesso');
  await expect(exigirPermissao('insumos','visualizar')).rejects.toThrow('REDIRECT:/sem-acesso');
  await expect(exigirPermissao('compras','visualizar')).resolves.toHaveProperty('userId');
 });
 it('toda ação operacional exportada tem guarda explícita antes de executar a operação',()=>{
  const revisadas=new Set(contrato.map(c=>`${c.arquivo}:${c.funcao}`));
  for(const p of arquivos('src/app/(protegido)').filter(p=>p.endsWith('.ts')&&!p.includes('configuracoes/usuarios')&&!p.includes('configuracoes\\usuarios')&&!p.includes('/perfil/')&&!p.includes('\\perfil\\'))){
   const codigo=fs.readFileSync(p,'utf8');if(!/^['"]use server['"];/.test(codigo))continue;
   const arvore=ts.createSourceFile(p,codigo,ts.ScriptTarget.Latest,true);
   for(const f of arvore.statements)if(ts.isFunctionDeclaration(f)&&f.body&&f.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
    const caminho=p.replaceAll('\\','/');
    expect(revisadas.has(`${caminho}:${f.name!.text}`),`${caminho}:${f.name!.text}`).toBe(true);
    const entrada = contrato.find(c => c.arquivo === caminho && c.funcao === f.name!.text)!;
    if (entrada.guardaDelegada) {
      // Somente as sete fachadas literais revisadas podem delegar ao helper local.
      // Nenhum outro prelúdio/operação pode preceder o retorno ou a guarda do helper.
      expect(entrada.arquivo).toBe('src/app/(protegido)/financeiro/fiscal/homologacao/actions.ts');
      expect(entrada.guardaDelegada).toBe('agir');
      expect(entrada.recurso).toBe('vendas.fiscal');
      expect(entrada.acao).toBe('editar');
      expect(f.body.statements).toHaveLength(1);
      expect(f.body.statements[0].getText(arvore).replace(/\s+/g,' ')).toBe(entrada.chamadaDelegada);
      const helper=arvore.statements.find(d=>ts.isFunctionDeclaration(d)&&d.name?.text===entrada.guardaDelegada);
      expect(helper&&ts.isFunctionDeclaration(helper)&&helper.body).toBeTruthy();
      if(!helper||!ts.isFunctionDeclaration(helper)||!helper.body)throw new Error('Guarda delegada local ausente.');
      expect(helper.body.statements[0].getText(arvore).replace(/\s+/g,' ')).toBe('const sessao = await exigirPermissao("vendas.fiscal", "editar");');
      continue;
    }
    // Só aceita os dois prelúdios puros revisados literalmente no contrato.
    // Qualquer acesso ao banco/operação inserida antes da guarda continua falhando.
    if (entrada.preGuarda) expect(f.body.statements[0].getText(arvore).replace(/\s+/g, ' '), f.name!.text).toBe(entrada.preGuarda);
    expect(f.body.statements[entrada.preGuarda ? 1 : 0].getText(arvore),f.name!.text).toContain('guardaIndividual' in entrada ? 'await exigirSessao(' : 'await exigirPermissao(');
   }
  }
 });
 it.each(contrato)('$funcao impede chamada direta sem permissão e sem tocar no banco',async c=>{
   s.sessao.mockResolvedValue('guardaIndividual' in c ? null : {userId:'bloqueado',admin:false,permissoes:{},excecoes:{}});
   const modulo=await import('../../'+c.arquivo);
   if ('gestaoAcessos' in c) { s.sessao.mockResolvedValue(null); expect(await modulo[c.funcao](...(c.argumentos ?? []))).toHaveProperty('erro'); return; }
   const dados=new FormData();dados.set('id','existente');
   const argumentos=c.argumentos ?? (c.funcao==='salvarBeneficiarioAction'?[dados]:c.funcao==='saveInsumoAction'||c.funcao==='saveFornecedorAction'?[{},dados]:[{pedidoId:'existente'},dados]);
   await expect(modulo[c.funcao](...argumentos)).rejects.toThrow('guardaIndividual' in c ? 'REDIRECT:/login' : 'REDIRECT:/sem-acesso');
 });
 it('rotas de fotos rejeitam acesso sem permissão antes de consultar arquivos',async()=>{
   s.sessao.mockResolvedValue({userId:'bloqueado',admin:false,permissoes:{},excecoes:{}});
   const fotoInsumo=await import('@/app/api/insumos/[id]/foto/route');
   const fotoUsuario=await import('@/app/api/usuarios/[id]/foto/route');
   const pedido=new Request('http://localhost/api/foto');
   expect((await fotoInsumo.GET(pedido,{params:Promise.resolve({id:'insumo'})})).status).toBe(403);
   expect((await fotoUsuario.GET(pedido,{params:Promise.resolve({id:'outra-pessoa'})})).status).toBe(403);
   s.sessao.mockResolvedValue(null);
   expect((await fotoUsuario.GET(pedido,{params:Promise.resolve({id:'outra-pessoa'})})).status).toBe(401);
 });
 it('operação e gestão de pedidos rejeitam páginas sem permissão antes do banco',async()=>{
   s.sessao.mockResolvedValue({userId:'bloqueado',admin:false,permissoes:{},excecoes:{}});
   await expect(OperacaoPage({params:Promise.resolve({id:'ficticio'})})).rejects.toThrow('REDIRECT:/sem-acesso');
   s.sessao.mockResolvedValue({userId:'leitor',admin:false,permissoes:{'vendas.pedidos':['visualizar']},excecoes:{}});
   // Consulta recusada permanece fechável no popup; o proxy de banco ainda proíbe qualquer leitura.
   expect((await ConteudoGestaoPedidos({searchParams:Promise.resolve({})})).props.mensagem).toContain('não possui permissão');
 });
 it('produção, calendário e comanda recusam acesso sem consultar o banco', async()=>{
   s.sessao.mockResolvedValue({userId:'bloqueado',admin:false,permissoes:{},excecoes:{}});
   await expect(ProducaoPage({searchParams:Promise.resolve({})})).rejects.toThrow('REDIRECT:/sem-acesso');
   await expect(CalendarioPage({searchParams:Promise.resolve({})})).rejects.toThrow('REDIRECT:/sem-acesso');
   expect((await ConteudoComanda({params:Promise.resolve({id:'ficticio'})})).props.mensagem).toContain('não possui permissão');
 });

});
