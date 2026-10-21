import fs from 'node:fs'; import path from 'node:path'; import ts from 'typescript';
import {recursoDaRota} from '../src/lib/permissoes/catalogo.ts';
const mapa={
 prepararImportacaoVendaAction:['vendas.importacao','visualizar'],aplicarImportacaoVendaAction:['vendas.importacao','adicionar'],
 reordenarProdutosVendaAction:['vendas.catalogo','editar'],
 alterarSituacaoProdutoVendaAction:['vendas.produtos','editar'],
 salvarFormaPagamentoVendaAction:['vendas.formas-pagamento','entrada?.id ? "editar" : "adicionar"'],
 adicionarCategoriaPerdaAction:['inventario.perdas','editar'],alterarCategoriaPerdaAction:['inventario.perdas','editar'],removerCategoriaPerdaAction:['inventario.perdas','editar'],
 enviarFotoProdutoVendaAction:['vendas.produtos','formulario?.get?.("produtoId") ? "editar" : "adicionar"'],
 salvarClienteVendaAction:['vendas.clientes','entrada?.id ? "editar" : "adicionar"'],salvarCategoriaVendaAction:['vendas.catalogo','entrada?.id ? "editar" : "adicionar"'],reordenarCategoriasVendaAction:['vendas.catalogo','editar'],salvarGrupoVendaAction:['vendas.catalogo','entrada?.id ? "editar" : "adicionar"'],salvarProdutoVendaAction:['vendas.produtos','entrada?.id ? "editar" : "adicionar"'],salvarFiscalVendaAction:['vendas.fiscal','editar'],
 prepararEtiquetaAction:['producao','adicionar'],iniciarEnvioEtiquetaAction:['producao','adicionar'],finalizarTentativaEtiquetaAction:['producao','adicionar'],registrarExportacaoEtiquetaAction:['producao','adicionar'],confirmarImpressaoEtiquetaAction:['producao','adicionar'],salvarConfiguracaoProdutoEtiquetaAction:['producao','visualizar'],salvarConfiguracaoImpressoraAction:['producao','visualizar'],
 prepararExtratoAction:['financeiro.conciliacao','adicionar'],importarExtratoAction:['financeiro.conciliacao','adicionar'],conciliarExtratoAction:['financeiro.conciliacao','editar'],desfazerConciliacaoAction:['financeiro.conciliacao','excluir'],
 alterarStatusFornecedorAction:['fornecedores','editar'],alterarStatusInsumoAction:['insumos','editar'],
 prepararConciliacaoFornecedorAction:['notas','visualizar'],conciliarFornecedorNotaAction:['notas.manifestar','editar'],
 salvarPedidoAction:['compras','input.pedidoId ? "editar" : "adicionar"'], confirmarRecebimentoAction:['compras.receber','editar'],reabrirPedidoAction:['compras.receber','editar'],cancelarPedidoAction:['compras','editar'],excluirPedidoAction:['compras','excluir'],reagendarPedidoAction:['compras','editar'],
 salvarConfiguracaoLojaAction:['configuracoes.loja','editar'],uploadCertificadoAction:['configuracoes.loja','editar'],removerCertificadoAction:['configuracoes.loja','excluir'],obterSenhaCertificadoAction:['configuracoes.loja','editar'],
 editarSaldoInicialAction:['financeiro.saldo','editar'],criarContaBancariaAction:['financeiro.bancario','adicionar'],alternarAtivoContaBancariaAction:['financeiro.bancario','editar'],
 baixarLancamentoAction:['financeiro.baixas','editar'],estornarBaixaLancamentoAction:['financeiro.baixas','editar'],baixarNotaFiscalAction:['financeiro.baixas','editar'],
 criarLancamentoAction:['financeiro.movimentacoes','adicionar'],atualizarLancamentoAction:['financeiro.movimentacoes','editar'],obterResumoExclusaoLancamentoAction:['financeiro.movimentacoes','visualizar'],excluirLancamentoAction:['financeiro.movimentacoes','excluir'],
 criarCategoriaFinanceiraAction:['financeiro.plano','adicionar'],atualizarCategoriaFinanceiraAction:['financeiro.plano','editar'],alternarAtivoCategoriaFinanceiraAction:['financeiro.plano','editar'],
 saveFornecedorAction:['fornecedores','String(formData.get("id") ?? "").trim() ? "editar" : "adicionar"'],deleteFornecedorAction:['fornecedores','excluir'],createCanalPedidoAction:['fornecedores','adicionar'],createFormaPagamentoAction:['fornecedores','adicionar'],importFornecedoresAction:['fornecedores','adicionar'],
 saveInsumoAction:['insumos','String(formData.get("id") ?? "").trim() ? "editar" : "adicionar"'],deleteInsumoAction:['insumos','excluir'],createCategoriaAction:['insumos','adicionar'],renameCategoriaAction:['insumos','editar'],deleteCategoriaAction:['insumos','excluir'],createCentroCustoAction:['insumos','adicionar'],importInsumosAction:['insumos','adicionar'],
 createLocalAction:['inventario','adicionar'],renameLocalAction:['inventario','editar'],deleteLocalAction:['inventario','excluir'],iniciarContagemAction:['inventario.contagem','adicionar'],salvarItemContagemAction:['inventario.contagem','editar'],excluirContagemAction:['inventario.contagem','excluir'],finalizarContagemAction:['inventario.contagem','editar'],
 registrarEntradaAvulsaAction:['inventario.entrada','adicionar'],registrarPerdaAction:['inventario.perdas','adicionar'],excluirPerdaAction:['inventario.perdas','excluir'],
 aceitarNotaAction:['notas.manifestar','editar'],sincronizarAction:['notas','adicionar'],manifestarAction:['notas.manifestar','editar'],exportarXmlPorDataAction:['notas','visualizar'],obterItensNotaFiscalAction:['notas','visualizar'],confirmarConciliacaoNotaAction:['notas.manifestar','editar'],obterInsumoOptionAction:['insumos','visualizar'],importarXmlAvulsoAction:['notas','adicionar'],importarXmlNotaAction:['notas','editar'],
};
// Recuperação é pública, mas só o segredo de uso único permite alterar a senha.
const isentas=['loginAction','logoutAction','solicitarRecuperacaoAction','verificarLinkRecuperacaoAction','redefinirSenhaAction','atualizarPerfilAction','alterarSenhaAction','salvarPerfilAcesso','excluirPerfilAcesso','salvarUsuarioAcesso','excluirUsuarioAcesso','carregarAcessos'];
function arquivos(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?arquivos(path.join(p,d.name)):[path.join(p,d.name)]);}
const contrato=[];
for(const p of arquivos('src/app').filter(p=>/\.tsx?$/.test(p))){
 let s=fs.readFileSync(p,'utf8'); const arvore=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true); const edicoes=[];
 if(/^['"]use server['"];/.test(s))for(const n of arvore.statements)if(ts.isFunctionDeclaration(n)&&n.body&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
   const nome=n.name.text;if(isentas.includes(nome))continue;
   if(!mapa[nome])throw Error('Mapear ação: '+nome);
   const [recurso,acao]=mapa[nome];const valor=acao.includes('?')?acao:JSON.stringify(acao);
   contrato.push({arquivo:p.replaceAll('\\','/'),funcao:nome,recurso,acao});
   if(n.body.getText(arvore).includes('await exigirPermissao('))continue;
   let texto=`\n  await exigirPermissao(${JSON.stringify(recurso)}, ${valor});`;
   if(recurso==='notas.manifestar')texto+='\n  await exigirPermissao("notas", "visualizar");';
   if(nome==='conciliarFornecedorNotaAction')texto+='\n  await exigirPermissao("fornecedores", "editar");';
   if(recurso==='compras.receber')texto+='\n  await exigirPermissao("compras", "visualizar");';
   if(['importFornecedoresAction','importInsumosAction','importarXmlAvulsoAction'].includes(nome))texto+=`\n  await exigirPermissao(${JSON.stringify(recurso)}, "editar");`;
   edicoes.push([n.body.getStart(arvore)+1,texto]);
 }
 if(p.endsWith('page.tsx')&&p.includes('(protegido)')&&!p.includes('/perfil/')&&!p.includes('\\perfil\\')&&!p.includes('sem-acesso')){
   const rota='/'+path.relative('src/app/(protegido)',path.dirname(p)).replaceAll('\\','/').replace('/[id]','');
   const recurso=rota==='/configuracoes'?null:recursoDaRota(rota);
   for(const n of arvore.statements)if(ts.isFunctionDeclaration(n)&&n.body&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)&&recurso&&!n.body.getText(arvore).includes('exigirPermissao(')){
     edicoes.push([n.body.getStart(arvore)+1,`\n  await exigirPermissao(${JSON.stringify(recurso)});`]);
     if(!n.modifiers.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))edicoes.push([n.getStart(arvore)+n.getText(arvore).indexOf('function'),'async ']);
   }
 }
 if(edicoes.length){for(const [pos,txt] of edicoes.sort((a,b)=>b[0]-a[0]))s=s.slice(0,pos)+txt+s.slice(pos); if(!s.includes('import { exigirPermissao }')) {const pos=s.startsWith('"use server";')?13:0;s=s.slice(0,pos)+'\nimport { exigirPermissao } from "@/lib/permissoes/servidor";\n'+s.slice(pos);}fs.writeFileSync(p,s);}
}
fs.writeFileSync('testes/permissoes/contrato-acoes.json',JSON.stringify(contrato,null,2));
console.log(`${contrato.length} ações protegidas.`);
