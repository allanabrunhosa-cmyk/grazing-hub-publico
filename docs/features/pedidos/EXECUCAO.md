# Pedidos — execução do Marco 1

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Cadastro e Data da compra — 20/10/2026

Contrato, tarefas e evidências deste incremento estão no
[registro específico](CADASTRO-COMPRA-20261020.md). A data comercial é separada
do instante técnico de criação. O incremento também trata máscaras, contato
da cobrança selecionada e escolha de veículo por entrega.

## Organização do detalhe e emissão fiscal — 20/10/2026

Branch `codex/dashboard-emissao-pedidos-20261020`, baseada em `c4a51634`.
O detalhe confirmado mantém a sequência Cliente → Itens do pedido → Frete e
entrega → Data e horário → Observações → histórico comercial recolhido →
Pagamento → Nota fiscal. O frete mostra o valor fotografado no pedido, inclusive
zero ou frete histórico de retirada. A consulta não recalcula valores comerciais.

`detalhe-pedido.tsx` reutiliza `Secao`, `PagamentoOperacionalPedido`,
`EmitirNotaPedido`, `GrupoAcoes`, `Button` e as superfícies existentes de
`pedidos-detalhe-vertical`. A conferência fiscal local sai deste detalhe.
O painel de emissão recebe NFC-e, modelo 65, como sugestão inicial. O rodapé de
edição aparece quando existe edição aberta ou mensagem; a consulta comum termina
na emissão. Agenda, cobrança e destinatário conservam salvamento explícito,
versão inicial, motivo, permissões e proteção contra descarte.

Validação focada em Node 22.23.3: 28 testes do detalhe e 33 testes dos popups
(interface e servidor) aprovados. ESLint dos dois arquivos alterados e
`git diff --check` passaram. Cobertura inclui ordem das seções, ausência da
prévia fiscal separada, sugestão do modelo 65, valor de frete e acesso fiscal.
A primeira execução não iniciou testes por restrição de escrita no temporário do
sandbox; a repetição usou uma pasta temporária local. Duas expectativas novas de
moeda precisaram normalizar o espaço não separável; a repetição passou.
Esta etapa não emitiu ou cancelou NF.

O resultado autorizado substitui o botão de emissão por sucesso, PDF/DANFE,
XML e cancelamento manual com justificativa e confirmação. Documentos de revisões
anteriores e histórico fiscal saem da tela; os registros e a auditoria permanecem.
A autorização produtiva anterior prevalece sobre uma preparação de revisão nova.
Uma nota homologada continua permitindo abrir explicitamente o contexto de produção.

O modelo inicial é NFC-e 65, com escolha de NF-e 55 no painel de emissão.
Novas preparações são de consumidor final. Snapshots anteriores não são reescritos.
Ausência de IE usa a condição de não contribuinte, quando aplicável; não comprova
isenção. Presença do comprador permanece explícita quando o pedido não a comprova.
Bloqueios de configuração, ambiente e aprovação continuam no servidor.

Cancelamento recusado ou ainda não confirmado conserva a autorização, o faturamento
e os arquivos. A nota só muda para Cancelada com evento fiscal confirmado.
Não há repetição automática de cancelamento; a consulta permanece disponível.
Código fiscal conhecido apresenta motivo e orientação local. Retornos desconhecidos
mostram código e necessidade de conferência, sem expor texto bruto do fornecedor.
Contrato e limites operacionais: [Fiscal](../../modulos/fiscal.md).

Capturas sintéticas da composição final: [desktop](evidencias/20261020/pedido-desktop.png),
[mobile](evidencias/20261020/pedido-mobile.png) e
[erro de cancelamento no celular](evidencias/20261020/cancelamento-mobile.png).
16 testes Playwright passaram em 320/390/768/1440, claro/escuro, com navegação por
teclado, ausência de nova emissão após autorização e erros persistentes.
37 testes da interface fiscal passaram. Aprovação visual humana continua pendente.

Fechamento integrado em Node 22.23.3: lint global, lint:design, typecheck e build
webpack aprovados. O design verificou 8 bases e 415 consumidores, sem desvio novo.
O sistema compilado passou em 20 verificações HTTP de sessão, permissões, hosts,
links antigos e arquivos. Mais 7 verificações da hidratação do pedido emitido
confirmaram sucesso, PDF, XML, cancelamento disponível e ausência de nova emissão
ou históricos fiscais. Banco, usuários, pedidos e documentos foram sintéticos.
Nenhum POST fiscal foi executado.

As primeiras tentativas encontraram restrições do sandbox para temporários/build,
uma corrida entre typegen/build e uma assinatura de retorno incompatível no
controlador da interface. As verificações finais usaram temporário próprio,
typecheck antes do build e o contrato corrigido. A comparação visual também
revalidou o foco após selecionar NF-e; o botão passa a ter o nome do modelo.
Logs de execução permanecem na pasta ignorada `.tmp/fiscal-emissao-20261020`.

Regressão ampliada: `vitest run testes/vendas testes/fiscal-saida
testes/fiscal-dashboard testes/permissoes testes/design-system --maxWorkers=1`.
A rodada inicial teve 3.871 aprovações, 24 falhas e 126 casos não executados.
Foram corrigidos dois contratos de teste: o registro da nova ação no catálogo
de permissões e a expectativa de consumo final. O ambiente da repetição incluiu
`PEDIDOS_AMBIENTE_ISOLADO=1` e `AUTH_SECRET` exclusivamente sintética.
Os oito arquivos afetados passaram com 363 testes e os limites de tempo originais.
Nenhum código de aplicação mudou após o build final.

Consolidado sem duplicar repetições: **3.917 testes aprovados e 105 não executados**.
Os não executados dependem de outros opt-ins/ambientes; incluem 8 casos de
`migrations-plano-publicacao-integracao`, que exigem o cluster isolado na porta
55449. Esta tarefa usou PostgreSQL17 local na porta 55439 e não alterou migrations.
As guardas foram preservadas. A suíte ampla inicial não é registrada como aprovada;
os resultados finais combinam a rodada e as repetições pertinentes.

Entrega em branch própria, com capturas sintéticas versionadas. Produção aguarda
autorização desta atualização e o ritual de deploy. Validação com HTTP simulado
não homologa emissão ou cancelamento perante a SEFAZ. Cancelamento incerto exige
consulta/conferência; não há repetição automática.

## Detalhes após confirmação — execução de 08/10/2026

Branch isolada `codex/pedidos-detalhes-20261007`, inicialmente sobre `a49f33a6`.
Trabalho alheio em `codex/cardapio` preservado. Registro vigente: [SPEC](SPEC.md#detalhes-após-confirmação--08102026).

- [x] Diagnóstico: detalhes próprios/iFood, pagamentos, cancelamentos, permissões,
  Central de Design e documentação oficial Order/Handshake.
- [x] Banco e backend: migration aditiva aplicada em PostgreSQL17 exclusivo,
  cancelamento/tratamento atômicos, boleto tardio, retomada, autorização e auditoria.
- [x] Interface: abas, olho direto, ações textuais, cancelados separados, parcelas com
  valor/total e Salvar orçamento laranja; configurações removidas do pedido confirmado.
- [x] iFood: projeção automática por cadastro e recuperação de configuração pendente;
  ações/prazos/negociações e estados remotos preservados; flags inalteradas.
- [x] QA sintético: desktop1366×900 e celular390×844, sem rolagem horizontal;
  leitura, histórico e cancelamento contextual. Nenhuma operação real de teste.
- [x] Validações finais da combinação com a main atual, lint/design/tipos/build/smoke.
- [x] Backup privado íntegro e imagem/configuração anteriores preservados na VPS.
- [ ] Commit/push, deploy autorizado e smoke em leitura.

Main `d07b25ad` incorporada no merge `bb39a54`, preservando a proteção de campos,
pendências e complementos. Bateria global combinada:283 arquivos aprovados,
2.509 testes aprovados,375 ignorados por opt-ins não ativados e uma falha no mock
antigo de responsável/estrutura do detalhe. Esse contrato foi atualizado e revalidado:
73/73 no foco gestor/interface/servidor/navegação. Após a correção do retorno de
Cancelados e do resumo de crédito/retenção,27/27 em três arquivos finais.
Integrações isoladas Pedidos/Financeiro28/28 e iFood25/25, incluindo títulos
automáticos, permissão e recuperação sem duplicação; opt-ins desses domínios também
ativos na bateria global. Não somar as rodadas como testes únicos nem declarar os
375 ignorados como aprovados. Duas rodadas anteriores identificaram chaves internas
incompatíveis e mensagem de falha fora do Dialog, corrigidas.
O caso financeiro iFood com múltiplos eventos excedeu5s na execução simultânea com
compilação, passou isolado; limite15s apenas desse teste, sem ajuste global.

Smoke compilado autenticado com banco e dados fictícios: olho abre diretamente as
abas, Cancelados abre sem intercept indevido, ordem #3(05/10)→#2(06/10), detalhe
cancelado exibe solicitação de R$90 e fechar retorna à lista. Capturas adicionais
desktop/celular dessa lista. Nenhuma operação de teste em produção.
Lint global1.184 arquivos:0 erros/2 avisos de vendor ignorado; design8 bases/343
consumidores; tipos e build webpack/Node22 aprovados na revisão final. HTTP compilado:
7/7 controles existentes e leitura de gestor/cancelados/detalhe200, sem sessão307,
host inválido421. Conteúdo do Dialog depende de hidratação; validado pela UI, sem
confundir o HTML inicial com a tela final.

Backup privado `etiquetas-pedidos-detalhes-20261008-01`:59.774.908 bytes,
949 linhas no catálogo; leitura integral por pg_restore e SHA256
`db7a41112eae67bafff2f647c8c04d8cfcf2c98d1ab5b5a2409baefa4980d9d7`
conferidos. Imagem anterior preservada em `grazing-pedidos-anterior:20261008-01`;
configuração completa privada e certificado fiscal no banco conferidos. Migration
aditiva `20261008010000_pedidos_fluxo_contextual`, sem backfill de dados reais.

Limites reais: NF permanece provisão desabilitada. UI e HTTP de iFood são simulados;
isso não homologa integração externa, impressora ou reembolso do provedor. Solicitação
automática não comprova devolução realizada. Novas referências visuais Em revisão humana.

Capturas sintéticas: [desktop](evidencias/2026-10-08-detalhes/pedido-desktop.png),
[celular](evidencias/2026-10-08-detalhes/pedido-mobile.png),
[cancelamento](evidencias/2026-10-08-detalhes/cancelamento-mobile.png),
[histórico](evidencias/2026-10-08-detalhes/pedido-historico.png),
[iFood desktop](evidencias/2026-10-08-detalhes/ifood-desktop.png),
[iFood celular](evidencias/2026-10-08-detalhes/ifood-mobile.png),
[cancelados desktop](evidencias/2026-10-08-detalhes/cancelados-desktop.png),
[cancelados celular](evidencias/2026-10-08-detalhes/cancelados-mobile.png).
## Missão de fechamento operacional e financeiro — 02/10/2026

Estado: implementação e validação isolada concluídas; publicação em preparação.
03/10: usuário restabeleceu a sessão autenticada de administrador. Bloqueio de acesso
resolvido. A tarefa de porções recebeu autorização própria e publicou `f71164e8`;
janela desta missão aguarda sua estabilização. Correção incorporada sem conflito no
merge `d0ff4154`; regressões afetadas e checks finais da combinação em execução.
Revisão funcional anteriormente validada: `7089be6` (base integrada `40240050`).
Branch de preservação: `origin/codex/fechamento-operacional-financeiro`.
Main/produção não alteradas por esta missão.
Decisão adicional do usuário: categoria de receita definida no Canal de venda;
vincular canais existentes às categorias correspondentes já cadastradas, após
conferência. Receita reconhecida na confirmação comercial do pedido. Não inferir
classificação de despesas, retenções ou tributos a partir dessa decisão.
Fonte de escopo vigente: instrução do usuário e seção inicial da SPEC. Este é o
registro único; registros anteriores abaixo conservam sua revisão e limites.

### Preparação da publicação — 03/10/2026, 02h47

Revisão combinada `d0ff4154`, com `f71164e8` da tarefa de porções, validada:
154/154 testes em oito arquivos, incluindo integrações de Pedidos/Financeiro;
23/23 em dois arquivos, sendo16 de porções em banco próprio e7 HTTP do build.
Opt-ins de Pedidos/Financeiro e Porções explicitamente ativos, bases locais
exclusivas; nenhuma operação de teste em produção. A tentativa inicial sob
sandbox falhou em spawn EPERM antes de executar testes; repetição autorizada
executou normalmente. Bateria global anterior mantém seus resultados/revisão;
não houve nova bateria global, apenas revalidação do impacto combinado.
Lint global1022 arquivos:0 erros/2 avisos de vendor ignorado; design8 bases/315
consumidores; tipos, Prisma validate/generate,93 migrations locais e build
Node22/webpack aprovados. Smoke compilado executado após o build dessa combinação.

Backup privado `etiquetas-fechamento-operacional-20261003-01`:41.568.250 bytes,
823 linhas de catálogo; leitura integral e SHA256
`b065b98862afffa3bb1c2df52fa6dee24901e7856dfc0f5587af94a9f0e3405a`
conferidos na VPS. Imagem imediatamente anterior
`sha256:18100b0722e05f83d2d140650563e2f3a8503659129d4954f736aaff0a95edd3`
preservada em `grazing-fechamento-anterior:20261003-01`; configuração completa
privada e fonte fiscal banco capturadas. Migrations são seis aditivas; preservam
pedidos existentes na versão0, sem backfill. Recuperação prefere correção de código
compatível com os dados novos; não restaurar o banco sobre transações posteriores.
Janela de publicação aguarda encerramento da conferência da tarefa de porções.
Após liberação: fetch, fast-forward autorizado, acompanhar Dokploy, preservar
env/mount e verificar migrations, canais/categorias e smoke autenticado em leitura.

### Fase 0 — base e proteção

Ensaio real de estoque ON na UI compilada: #6, R$120 quitados com crédito,
preparação 1+1 e revenda 2, expedição revenda 1+1 e preparação 2, retirada.
Saldos conferidos em persistência: ingrediente 8KG inalterado, preparação
1→0,75→0,50KG, revenda 10→9→8UN somente na expedição. Voltar automático para
OFF preservou os quatro consumos. Com OFF, retorno explícito da revenda elevou
8→9UN; perda de 0,25KG já consumido não criou segunda saída. Entrega preservada.
Tabela física inspecionada: hash técnico alongava coluna sem auxiliar seleção.
Mapeamento antes da correção visual: Table/TableCell da Central, quebra de texto
como clientes-historico e vínculos fiscais; mesma numeração de lotes do seletor,
sem alterar identificadores persistidos. Revalidação visual após build pendente.

Checkpoint incremental de pós-venda em 03/10: resumo financeiro agora distingue
crédito aplicado histórico, já restaurado e ainda restaurável. A interface oculta
a ação esgotada e preserva a informação histórica. Mapeamento Central: mesmos
Campo/Input/CurrencyInput/Button e GrupoAcoes do bloco de crédito existente;
nenhuma variante visual nova. Integração financeira 28/28 e consumidor do editor
8/8 aprovados; primeira execução do novo teste omitia versaoFinanceiro da fixture,
corrigida para o contrato HUB atual sem retirar assertivas.
UI fictícia compilada anterior à correção: pedido #4 teve restauração de R$250,
devolução efetiva de R$100, concessão de R$250 e retorno de 2UN, destinado em
1UN recuperável e 1UN perda. Entrega original preservada; ocorrência resolvida.
Imagens pos-venda-destino-desktop/mobile.jpg conferidas. Recompilação e conferência
visual do saldo restaurável corrigido ainda pendentes.

- Pasta: `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/Downloads/grazing-hub`, árvore versionada inicialmente limpa.
- Branch anterior preservada: `codex/porcoes-multiplicaveis`.
- `git fetch origin` concluído; HEAD e origin/main: `f34a26a84c849ef0a8b29e41cc3383797f202759`.
- Branch própria: `codex/fechamento-operacional-financeiro`, criada da origin/main.
- Worktrees existentes inventariadas, sem modificação. Temporários anteriores preservados.
- Guias de versionamento, deploy, testes, banco, acesso, Vendas/Pedidos, Compras,
  Financeiro, Estoque, Insumos e Fiscal consultados; Central consultada por seção.
- Comandos oficiais: Vitest, ESLint, lint:design, TypeScript, build webpack e migrations
  manuais/aditivas. PostgreSQL 17 instalado; ambiente exclusivo em preparação em
  `.tmp-fechamento`, ignorado pelo Git. Nenhuma conexão produtiva para teste.
- Evidências antigas não são resultados desta revisão. Baseline e validação visual
  autenticada ainda precisam ser executados.

### Decisões e lacunas verificadas

- `pedidos-liberacao.ts` bloqueia genericamente HUB fora de ambiente fictício;
  `pedidos.ts` já gera títulos, recebimentos parciais, captura/repasse, devolução e
  crédito. Reutilizar; não apenas retirar o bloqueio.
- `calcularDre.ts` inclui títulos por dataCompetencia. Usuário aprovou nesta missão
  receita na confirmação comercial, classificada pelo canal; reduções retornam à
  competência original da venda, ajustando aquele mês. Caixa conserva datas reais.
- Perguntado: categorias existentes escolhidas explicitamente para receita, frete,
  taxa, devolução e entrega; custo físico analítico sem duplicar CMV de compras.
  Ausência de resposta não autoriza política contábil.

### Controles parciais e preservação de formulário — em implementação

Mapeamento anterior à alteração: SlotExpansivel e GrupoAcoes de
padroes-operacionais, Input/Button oficiais; referência de contrato de quantidade
em operacao-client (precisão por unidade), diálogo NovaTentativaEntrega e cartões
já usados no popup. Apontamentos expostos no próprio detalhe do Gestor,
sem novo módulo. Devolução reutiliza Campo/Input e o motivo já exigido
pelo servidor, inclusive quando não há retenção. Atualizações entre seções devem
preservar campos em edição e a proteção de saída.
Validação incremental: integrações M1/M2 e três consumidores 100/100, zero
falhos/ignorados (parciais-integracao.log); após corrigir popup retido na lista,
quatro consumidores 34/34 (parciais-navegacao.log). Tipos e design 314 aprovados.
Primeira execução UI teve dois seletores de teste incorretos (label monetário e
nome do botão); corrigidos conforme nomes acessíveis, sem retirar assertivas.
Teste do servidor exigiu mock de headers e identificação atual dos consumidores;
a autorização e preservação da versão continuam verificadas.
UI real fictícia: #2 solicitou R$100 sem retenção, PROCESSANDO e CONCLUIDA com
evidência de saída; concedeu R$250 de crédito, preservando campo em edição entre
ações. #4 criado na interface por R$600: crédito R$250 + obrigação Pix R$350.
Cobrança incompleta foi recusada e corrigida sem perder preenchimento.
Apontamento de 3 em lote de 2 foi recusado, preservando entrada, seguido de 1+1.
Imagens parciais-erro-desktop/mobile.jpg conferidas; texto longo e erro cabem.
Atualizar após o primeiro parcial preservou motivo de crédito ainda não salvo.
Fechamento revelou slot retido do Next: usePathname limita popups à rota correta,
com teste de retorno e reabertura. HMR também repete intercepts inválidos ao
recompilar; navegação compilada permanece critério obrigatório antes de publicar.

Revisão de canal: identificada classificação financeira antiga após trocar canal.
Correção exige permissão financeira, categoria ativa no destino e reclassifica os
próprios títulos com auditoria; conserva competência, valores, baixas e extrato.
Não reaplica alterações de cadastro a vendas antigas nem modifica EXTERNO/versão0.
28/28 integrações financeiras aprovadas; revisão idempotente com sinal R$90,
nova categoria, aumento para R$350/saldo R$260 e legado preservado.
#4 terminou preparo 1+1 e expedição 1+1, seguido de retirada com R$350 em aberto.

Validação ampliada em Node22: 2.278 aprovados, 11 falhos, 57 ignorados;
7 arquivos falharam (incluindo 3 falhas de preparação), 258 passaram, 4 ignorados.
Log `regressao-ampla-node22.log`. Fixture Entregas não informava pagamento
comercial exigido pelo contrato atual; adicionada forma Pix fictícia, preservando
EXTERNO e todas as assertivas de ausência de efeitos financeiros. Mock da sessão
em pagamentos de NF não retornava autor para auditoria do cartão; corrigido.
Porções exige PORCOES_DATABASE_URL própria; banco porcoes_teste criado em 55432.
Porta55439 ocupada por cluster de outra tarefa, preservado. Central usa banco e
usuário exclusivos em55432 através de DESIGN_DATABASE_URL, com guardas mantidas.
Primeira repetição sofreu reinício do PostgreSQL local às23:48 e falhas de worker;
seus59 aprovados/21 falhos não constituem aceite (regressao-reparo.log).
Prévia desta missão desligada para liberar cerca de2GB de memória; demais processos
preservados. Repetição UI sem prévia:55/55, zero ignorados, mesmos limites/asserções
(ui-conciliacao-sem-previa.log). Inclui os novos bloqueios de formulário ocupado,
rascunho conservado após falha e retorno ao pedido pelo Financeiro.

Mapeamento UI Financeiro: Button oficial e detalhes existentes; referência de
encaminhamento à origem já usada nas faturas. Título vinculado ao pedido oferece
Abrir pedido, sem edição/exclusão/baixa genérica. Conciliação mantém títulos pagos
selecionáveis e explica por que o pendente deve ser recebido no pedido primeiro;
sugestões automáticas obedecem ao mesmo contrato. Fieldset de ocupado reutiliza
o padrão de custo-entrega, destino-fisico e importação de faturas.
UI sintética #5: captura300, repasses100/taxa3 e200/taxa6 em03/04out. Extrato CSV
importado pela interface:97,194,350 e-100. Primeiro repasse conciliado; consulta
após recuperação confirmou vínculo e8 movimentos líquidos981, sem nova baixa.
Demais três conciliações e imagens finais ainda pendentes. Navegador e prévia
devem ser reabertos; não declarar o ciclo de conciliação integral validado ainda.
Após desligar a prévia: seis suítes de integração87/87 aprovadas, zero
falhos/ignorados (`integracoes-sem-previa.log`), incluindo faturas, Entregas,
pagamentosNF, porções e Central com banco explícito. Consumidores caixa/Gestor/editor
45/45 (`caixa-gestor-consumidores.log`). Lint global de1014 arquivos versionados:
zero erros, dois avisos de minificados de terceiro já ignorados pelo projeto.
O comando inicial eslint . foi interrompido por incluir worktrees/temporários;
nenhuma regra foi desabilitada. Repetição usa ESLint sobre git ls-files.
Fetch remoto encontrou cinco novos commits emmain até40240050; incorporar à branch
após checkpoint e revalidar a combinação, sobretudo composição/campos fracionários.
Outras cobranças explicita valor cobrado ao cliente, separado da despesa da empresa;
campo, total e lista mantêm componentes e contratos existentes. Caixa usa o link
de origem já adotado para faturas, sem oferecer correção genérica de título do pedido.
Editor:7/7 preservação de rascunhos/seleção de pagamento, tipos aprovados e
lint focado sem erros antes do checkpoint3093c386. Main40240050 incorporada
sem conflito; merge preserva o novo contrato de campos fracionários e composição.
Primeira regressão combinada de campos/editor:48/48 (quatro arquivos;
apontamentos não incluído por caminho digitado incorretamente, deve integrar
a bateria seguinte). Design315 aprovado. Imagens anteriores de repasse concluído
e expedição parcial em celular inspecionadas, sem corte de conteúdo longo.
Texto de retenção/taxa agora solicita os dados aplicáveis, sem aviso genérico de
uso real; não aprova ou inventa política/tributo/categoria. Aceite visual final pendente.

### Fases e próximo passo

Fechamento isolado de03/10,01h57: revisão funcional7089be6, incluindo o ajuste final
de rótulos/lotes. Lint global0 erros/2 avisos de vendor,
design315, tipos e build Node22/webpack aprovados; HTTP7/7 após esse build.
Regressões afetadas: extrato/caixa/conciliação81/81; financeiro em banco28/28;
editor11/11; operação física5/5. Imagens finais de cartão desktop/mobile conferidas.
Resultados amplos e reexecuções anteriores continuam abaixo com suas revisões;
não se atribui uma nova execução global a este último ajuste de apresentação.
Após devolução do cartão:10 movimentos bancários (nova saída300),4 conciliações
originais preservadas, competência do #5 zerada; caixa total esperado581.

Retomada exata após login humano em grazinghub.com.br no navegador integrado:
1. Conferir sessão, branch/status, fetch e janela de publicação; correção de porções
   `f71164e8` incorporada em `d0ff4154`. Aguardar estabilidade do deploy anterior.
2. Antes do push main, preparar backup privado íntegro e recuperação pelo ritual,
   preservar imagem/configuração/certificado; conferir compatibilidade das migrations.
3. Integrar fast-forward a revisão validada, acompanhar Dokploy e migrações.
4. Vincular Site/iFood/Giuliana Flores às categorias existentes já verificadas,
   pelo cadastro de Canais; nenhuma carga histórica. Concluir o smoke: conferir
   novo pedido HUB/versão1, legado EXTERNO/versão0, automático OFF e emissor ausente,
   sem criar pedido/recebimento/nota fictícios em produção. Registrar evidência sem
   deploy documental. Se a base mudar, revalidar somente o impacto combinado.
Prévia local compilada: .tmp-fechamento/serve-compilado.cjs em127.0.0.1:3107;
ponte local4302; banco fictício55432. Comandos por Node22 e wrappers sanitizados.
Dados fictícios e imagens permanecem em .tmp-fechamento, fora do Git.

03/10 às01h51: #5 cancelado pela interface depois de captura300/repasse100+200,
taxa3+6 e conciliação. Solicitação300→PROCESSANDO→CONCLUIDA com comprovante,
conta/data/categoria sintéticos; nenhuma entrada/repasse/taxa original removida.
Imagem cartao-devolvido-desktop expôs rótulo fixo "repasse pendente" apesar da
liquidação integral. Correção mínima no texto existente distingue pendente/parcial/
concluído, sem componente ou token novo. Teste inicial tinha fixture sem títulos;
corrigida, reproduziu2 falhas/9 aprovados. Após ajuste:11/11 aprovados.
Preparação fiscal sob bloqueio transacional controlado de20s na base fictícia:
botão desabilitado "Preparando…", sem sucesso antecipado; depois SEM_EMISSOR,
ambiente NAO_CONFIGURADO,0 tentativas/nenhuma ação enfileirada. Imagens de espera
desktop/mobile inspecionadas. Consulta dos três documentos confirma esses estados.
Produtivo somente leitura às01h52: serviço Running desde02h08UTC,0 reinícios,
agenda fiscal ativa. Nenhuma publicação/configuração desta missão realizada.

03/10 às01h40, revisão0056368f + ajuste mínimo da tabela física: lint global
1.018 arquivos (0 erros, 2 avisos de fornecedor ignorado), design315 consumidores,
tipos e novo build Node22/webpack aprovados. Consumidor físico5/5, smoke HTTP7/7.
Imagens atuais conferidas: materiais-corrigido-desktop/mobile,
credito-restaurado-desktop/mobile, caixa-sem-credito-desktop/mobile e
dre-competencia-desktop/mobile. Capturas iniciais de desktop com dimensão antiga
foram descartadas e refeitas; nenhuma referência visual alterada.
UI DRE: competência total770, despesa entrega50+taxas9, resultado711;
modo caixa: entradas1090, devoluções200+taxas9, resultado881. Movimentações
realizadas também881, fluxo projetado1091 incluindo recebível260 e despesa50
pendentes. Crédito aplicado120 no #6 e250 no #4 não aparece como caixa.
Persistência:9 movimentos bancários,4 transações conciliadas; #4 receita de
competência zerada após pós-venda integral, mantendo primeira entrega e origens.
Fetch remoto às01h41 mantém main40240050, já integrado nesta branch; outra tarefa
local de porções ociosa. Login produtivo ainda pendente, sem alteração da produção.

Retomada de 03/10: regressão integrada em `9b8940e` concluída às00h47,
com opt-ins de banco e bases exclusivas:2.372 aprovados,3 falhos,14 ignorados;
265 arquivos aprovados,3 falhos,2 ignorados (regressao-integrada-9b8940e.log/json).
Falhas: recuperação sem AUTH_SECRET fictício após sanitização; timeout de5s no
parser PDF; checkbox de fornecedor permaneceu selecionado no ensaio amplo.
Repetição dos três arquivos, com segredo fictício e mesmas asserções/tempos:
19/19 aprovados, zero ignorados (repeticao-falhas-integrada.log). Sem alterar código
ou testes para a repetição. Resultado amplo original preservado, não declarado verde.
Os14 ignorados são7 HTTP de build (próxima etapa) e7 CLI de fotos fora deste escopo.
Lint global dos1.018 arquivos versionados:0 erros/2 avisos de arquivos de fornecedor
ignorados pela configuração existente. Tipos e Prisma validate aprovados;93 migrations
aplicadas e sem pendência na base fictícia. Build em andamento, ainda sem aceite.
Alteração posterior limitada ao empacotamento: Dockerfile agora copia o executor
fiscal para a imagem final. CLI real em Node22, ambiente sanitizado e banco fictício,
encerrou com código0 e “Emissor não configurado”; nenhum adaptador/envio ativado.
Essa diferença exige verificação no build, sem alterar a revisão dos testes em curso.
Pré-flight produtivo somente leitura: estoque automático false; um pedido EXTERNO;
Site/iFood/Giuliana Flores têm categorias ativas correspondentes, ainda não vinculadas.
Sessão do navegador produtivo desconectada; solicitado login humano para smoke e
configuração auditada. Trabalho independente segue na base fictícia.
Saldo físico sintético conferido antes de continuar: ingrediente8KG, preparação1KG;
fixture de produto consome0,25KG da preparação e revenda possui10UN exclusivamente
fictícias. Estoque do ensaio aindaOFF; próximo ciclo ON será realizado na interface.
Conciliação interrompida anteriormente: somente o repasse1 ficou conciliado;
continuar os outros três vínculos, sem repetir a primeira operação.

Build Node22/webpack e smoke HTTP7/7 aprovados na revisão9b8940e com empacotamento
do worker. Prévia compilada ligada em loopback3107, ponte exclusiva4302 simula
Host/Origin do proxy com destino fixo local; nenhuma solicitação vai à produção.
Interface revelou crédito aplicado entrando indevidamente no extrato de Movimentações.
Dois testes novos reproduziram o defeito (29 aprovados/2 falhos); filtro na projeção
compartilhada `montarLinhasExtrato` exclui quitações por carteira, preservando títulos
na origem/competência e eliminando candidatos bancários. Regressão de7 arquivos:
81/81 aprovados (credito-caixa-depois.log), sem alteração de componente/identidade.
Esse ajuste é posterior ao build acima: exige novo build e imagem do saldo corrigido.
Na prévia compilada, conciliação completou4/4 transações fictícias, preservando os8
movimentos e líquido981,00 (consulta posterior somente leitura). Imagens reais:
conciliacao-concluida-desktop.jpg e conciliacao-concluida-mobile.jpg, sem corte lateral.

- [x] 0: ambiente exclusivo, baseline e acesso visual autenticado disponíveis.
- [x] 1: matriz evento/efeito e rastreabilidade dos campos.
- [x] 2: controles oficiais e imagens desktop/celular; sem aprovação humana inventada.
- [x] 3: financeiro de novos pedidos implementado/testado; ativação produtiva na fase9.
- [x] 4: revisão, cancelamento, pós-venda, devoluções e crédito validados isoladamente.
- [x] 5: operação integrada e resoluções acessíveis validadas.
- [x] 6: estoque ON/OFF e produção de intermediários isolados.
- [x] 7: plug fiscal de saída implementado/testado; emissão real fora do aceite.
- [x] 8: validação integrada, regressões afetadas e imagens; contagens/limites registrados.
- [ ] 9: checkpoints, integração, backup, publicação e smoke.

Baseline em `f34a26a8`: PostgreSQL 17 novo, exclusivo, 127.0.0.1:55432,
base `teste_fechamento_20261002`; fixtures sintéticas em schemas temporários.
`PEDIDOS_BANCO_TESTE=1 PEDIDOS_AMBIENTE_ISOLADO=1 vitest run
testes/vendas/pedidos-integracao.test.ts testes/vendas/pedidos-financeiro-integracao.test.ts
--maxWorkers=1`: 60/60 aprovados, zero falhos/ignorados. Isso comprova somente o
baseline dos serviços existentes, não aceite da missão ou da revisão posterior.
Início no sandbox falhou por subprocessos; execução autorizada fora dele passou.
Aviso existente do driver pg sobre consultas concorrentes permanece registrado.

### Matriz de eventos — implementação atual, aceite final ainda pendente

Financeiro, operação, comercial e fiscal são independentes. Todos os efeitos
abaixo exigem sessão/permissão conferidas no servidor, versão e chave idempotente.
Evidências incrementais estão registradas acima/abaixo; não substituem a revisão final.

| Evento / pré-condição | Estado anterior → novo / comercial | Financeiro / físico / fiscal | Reversão / permissão / teste |
| --- | --- | --- | --- |
| Orçamento válido | novo → RASCUNHO, sem obrigação | Sem caixa, físico ou emissão | Excluir somente sem efeitos; adicionar/editar/excluir; M1/interface |
| Confirmar com canal classificado e condição fechada | RASCUNHO → CONFIRMADO/PENDENTE | Títulos + crédito = total; receita na confirmação; sem recebimento presumido; fiscal separado | Cancelar auditável; confirmar + condição quando configurada; M2/condição/UI #1/#4/#5 |
| Receber/capturar/repassar | Comercial e operação conservados | Baixa parcial/direta ou captura separada de repasse/taxa/líquido; caixa na data real | Correção auditável de registro, devolução de dinheiro separada; receber; M2/UI |
| Conciliar | Sem transição comercial | Vincula extrato a baixas existentes; líquido de receitas−taxas; sem nova receita/baixa | Desconciliação conserva fatos; financeiro.conciliacao; integrações + UI parcial |
| Preparar | PENDENTE → EM_PREPARO → PRONTO | Parciais explícitos; ON consome composição fotografada, OFF só execução | Retorno de etapa conserva fatos; revisar/produção; M1/UI #1/#4 |
| Expedir/entregar/retirar | PRONTO → EM_ENTREGA → ENTREGUE; retirada direta | ON expede revenda; OFF sem estoque; recebido independente; primeira entrega preservada | Falha+nova tentativa com integridade ou retorno físico; revisar; M1/UI #3/#4 |
| Revisar valor/quantidade/pagamento/canal | CONFIRMADO → nova revisão, fora de rota/entregue | Ajusta somente saldo elegível, preserva pagos/capturas; canal reclassifica com auditoria; excesso físico vira pendência | Redução abaixo do pago exige tratamento; revisar+condição; M2 R$300/90→350/260 e execução |
| Cancelar após efeitos | CONFIRMADO → CANCELADO/INTERROMPIDO | Pendentes elegíveis cancelados; entradas preservadas; destino de preparado explícito | Não excluir; cancelar; M1/M2/UI #2 |
| Pós-venda | ENTREGUE permanece, tratamento separado | Devolução/crédito ajustam competência original sem apagar entrega; retorno físico explícito | Sem retenção automática; cancelar+receber+condição conforme ação; M2 |
| Devolver dinheiro | SOLICITADA → PROCESSANDO → CONCLUIDA | Reserva elegibilidade; conclusão registra saída comprovada, sem apagar entrada | Erro/cancelamento de solicitação antes de concluir; evidência/autor/data; M2/UI #2 |
| Conceder/aplicar/restaurar crédito | Extrato da carteira, sem caixa | Origem e utilização vinculadas, trava do comprador; mistura dinheiro/crédito | Restauração explícita idempotente; condição+receber/cancelar; M2/UI #2→#4 |
| Produzir intermediário estocado | Lote físico registrado | Consome ingredientes e entra rendimento; venda consome preparação; custo observado ou não apurado | Correção/perda preserva origem; estoque/produção; integração física |
| Preparar fiscal | Solicitação de saída por revisão | Snapshot/payload versionados; sem emissor → SEM_EMISSOR, sem tentativa | Adaptador durável consulta após incerteza, não apaga autorizado; fiscal; integração simulada |

Rastreamento de campos atual:

| Interface → validação | Persistência/snapshot → consumidor/consequência |
| --- | --- |
| PagamentoPedidoForm → validarPagamentoComercial/condicaoDoPagamento | pagamentoInformadoSnapshot/condição → títulos, parcelas, regras do cliente, captura/repasse |
| Canal/categoria → salvarCanalReceita e confirmação/revisão | categoria no título e histórico → DRE, competência original, sem reclassificação em massa |
| Parcelas/vencimentos/crédito → validarCondicao, regrasClientePedido, trava comprador | títulos/creditoClienteMovimento → saldo exato, boleto por pedido, limite concorrente |
| Recebimento/captura/repasse/taxa → serviços específicos de pedidos | baixa/movimento/pagamento externo/repasse com autor e evidência → caixa/conciliação; captura não é dinheiro na conta |
| Cobrança/comprador/destinatário → validarEntradaPedido/calcularPedido | snapshots da revisão → detalhe/comanda/plug fiscal; não envia comunicação |
| Frete/desconto/outras cobranças → cálculo comercial em centavos | total/revisão → obrigação e receita do canal; rótulo explicita cobrança ao cliente |
| Custo da entrega/vínculo → entregas-custos/pedidos-despesas | estimado/efetivo são informação auditada; rateio vincula despesa existente → sem criar despesa duplicada |
| Horários/observações/ocorrências → serviços de operação | eventos e snapshots → Gestor/lista/calendário/comanda; falha exige resolução acessível |
| Quantidades/composição/conversão → execução/físico/produção de preparo | fotografia/ajustes/movimentos/reservas/custo → ON físico, OFF execução; não reescreve custo histórico |
| Referências externas → validação de tamanho/unicidade/origem | referência manual é informativa; comprovante sustenta fato manual; nunca confirma autorização fiscal por si |
| Devolução/crédito/retenção → elegibilidade e justificativas explícitas | tratamento + carteira/saída → competência original e caixa real; pendente não é concluído |

### Matriz preservada do confronto inicial (histórica)

| Evento / pré-condição | Transição e efeitos | Reversão / permissão / evidência |
| --- | --- | --- |
| Orçamento válido | RASCUNHO; sem título/caixa/físico/fiscal | Edição explícita; pedidos/adicionar; M1 baseline |
| Confirmação com pagamento e canal classificado | CONFIRMADO/PENDENTE; títulos uma vez, DRE na confirmação; sem caixa/fiscal | Não apagar histórico; confirmar; novo corte versaoFinanceiro=1 em implementação |
| Recebimento direto | Baixa integral/parcial, entrada bancária; etapa comercial independente | Correção não é devolução; financeiro.baixas; M2 baseline |
| Captura / repasse | Captura não é dinheiro na conta; repasse bruto/taxa/líquido | Evidência externa manual, sem gateway; M2 baseline |
| Preparo / pronto | Quantidades parciais/integral; OFF sem movimentos, ON consome montagem | Voltar preserva execução; produção/revisar; M1 baseline |
| Expedição / entrega | Revenda sai na expedição ON; primeira entrega preservada | Ocorrências exigem resolução; revisar; retirada direta ainda a completar |
| Revisão | Preserva pagos/executado; hoje só um saldo simples reajustável | Lacunas: múltiplas parcelas, redução abaixo do pago, captura/crédito; revisar |
| Cancelamento | CANCELADO/INTERROMPIDO; cancela pendentes elegíveis, preserva entradas e material usado | Destino físico explícito; cancelar; M1/M2 baseline |
| Pós-venda | Hoje devolução/crédito exigem CANCELADO e entregue não pode cancelar | Lacuna real; ampliar tratamento próprio, sem apagar entrega |
| Devolução / crédito | Solicitação reserva elegibilidade; conclusão externa gera saída; crédito sem caixa | Autor/data/origem/idempotência; cancelar + financeiro; M2 baseline |
| Fiscal de saída | Só referência manual existente; não comprova autorização | Plug durável e adaptador ainda ausentes; fiscal |

Rastreamento inicial: `pagamento-pedido-form` → validarPagamentoComercial →
pagamentoInformadoSnapshot, até então apenas informativo; conexão a títulos em
implementação em `pedidos-condicao`. Cobrança/endereço selecionado conservados no
snapshot; canal fornece categoria só para títulos novos. Frete/outros custos
integram total cobrado; custo efetivo de entrega tem evento separado, ligação à
despesa ainda precisa fechar. Ocorrências e quantidades usam eventos do pedido.

Mapeamento UI antes da implementação: Canais usa BarraAcoes, Card/Table,
Button/GrupoAcoes, Dialog com alterado e CategoriaFinanceiraCombobox (referência:
classificação financeira de Insumos). Pedido conserva Campo, CurrencyInput,
SelecaoFormulario e Input date; remoção de parcela passa ao BotaoRemoverItem.
Nenhum token/variante visual novo; aprovação visual humana não presumida.

Checkpoint de implementação (ainda sem aceite integrado): canal/categoria com
versão, auditoria e trava; novos rascunhos da interface usam HUB/versaoFinanceiro=1,
migration conserva anteriores em zero. Pagamento informado deriva obrigações,
categoria vem do canal e competência da confirmação no fuso do pedido. Retirada
conclui de Pronto diretamente, preservando primeira entrega e expedição idempotente.

Validações incrementais nesta árvore: 211/211 em cinco arquivos de condição,
financeiro com PostgreSQL opt-in, interfaces e fronteiras; depois 83/83 em quatro
arquivos de canais, M1 opt-in, operação e Gestor. Zero falhos/ignorados nesses
comandos. TypeScript aprovado após correção de callbacks; lint focado e lint:design
aprovados. Migrations aplicadas apenas ao PostgreSQL fictício. Imagens autenticadas
de Canais inspecionadas desktop/celular; validação de todos os estados ainda aberta.
Logs locais em `.tmp-fechamento`, não versionados. Resultados incrementais não
substituem bateria final. Build, regressão C, smoke final e deploy não executados.

Incremento posterior ao checkpoint: projeção de competência dos próprios títulos
por `valoresCompetenciaPedidos`, sem segundo livro. Versão zero conserva regra
histórica; versão um limita receita ao valor comercial revisado, reduz pós-venda
na competência original e zera competência da saída de devolução para não deduzir
novamente. Caixa continua usando valores/datas reais. Novo campo `reduzVenda`
distingue pós-venda de liquidação de excedente de revisão. Concessão/restauração
de crédito preserva a origem. Sem retenção presumida.

Revisões novas redistribuem saldo elegível em centavos; pagos/capturas preservados.
Devolução/crédito agora também tratam excedente ou pós-venda, mantendo a entrega.
27/27 testes passaram nesse incremento (M2 opt-in, projeção DRE, Canais). Os primeiros
ensaios detectaram erro de escrita da direção do teste e contaminação entre fixtures
de compradores; corrigidos com contrato correto e compradores exclusivos, sem
afrouxar asserções. A última alteração força a competência da saída à venda e ainda
está em revalidação no comando de produção/financeiro.

UI autenticada em `pedidos.localhost:4302`: pedido fictício #1 confirmado em HUB,
recebimento R$90, revisão R$300→R$350, título liquidado R$90 preservado e saldo R$260.
Inspeção visual desktop 1280×900 e móvel 390×844, evidência local
`.tmp-fechamento/pedido-revisao-mobile.jpg`; nenhum teste na produção. A tentativa
inicial usando host local HUB redirecionou ao login produtivo: nenhuma entrada de
dados lá; corrigida navegação para host dedicado local. Next dev teve erro transitório
de interceptação durante recompilação; a rota recompilou e ciclo funcionou, mas
reavaliar no build final. Validação de endereço incompleto preservou o rascunho.

Operação parcial da interface passa pela mesma política OFF/ON do quadro, sem
alterar o serviço físico explícito. 225/225 testes passaram (M1 opt-in, interface,
fronteiras); prova OFF parcial→ON parcial sem baixa retroativa e sem duplicidade.

Produção física de preparação em implementação: `/inventario/producao`, acessível
por Insumos e Estoque; usa BarraAcoes, Card/Table, Dialog/rascunho, Input com seis
casas e SelecaoFormulario; referência Canais/entrada avulsa. Quantidades reais
explicitamente preenchidas, consumo e entrada na mesma transação; composição,
conversão/rendimento e custo observado fotografados. Custo apurado permanece nulo;
nenhuma despesa/CMV nova. Correção administrativa exclusiva de administrador mantém
originais e ajustes, não representa retorno físico de preparação aos ingredientes.
Migration aditiva aplicada somente no banco fictício; schema/types aprovados.
Integração inicial: 238/238 em M1/M2, competência e fronteiras, opt-in real em
PostgreSQL fictício; zero falhos/ignorados. Tipos, lint focado e design aprovados.
Revalidação da produção: 48/48 (M1 e nova interface), incluindo saldo insuficiente
sem registro parcial, recuperação, precisão, repetição, sessão revogada e correção.
O ensaio visual descobriu consumo acima do saldo no novo fluxo e transbordamento
no celular; corrigidos no serviço de preparação e no fieldset, sem mudar a exceção
do Gestor. Registro fictício incorreto foi corrigido pela interface, preservando
movimentos. Novo lote válido consumiu 2 KG e produziu 1 KG. Evidência desktop de erro:
`.tmp-fechamento/preparacao-erro-desktop.jpg`. Validação móvel e correção auditada
conferidas; proteção de rascunho também abrange edição isolada de data.

Incremento fiscal posterior a `583b1f5`: DocumentoFiscalSaida/EventoFiscalSaida,
payload versionado e fotografado, adaptador separado, trabalho durável com lease,
consulta antes de reenvio incerto, idempotência e retorno autenticado/deduplicado.
Documentos e downloads exigem sessão/permissão. Emissor de produção permanece nulo;
simulador existe exclusivamente nos testes. UI no detalhe prepara a solicitação e
mostra “Emissor não configurado”, sem emitir/enfileirar. Instruções do adaptador em
`docs/modulos/fiscal.md`. Migrations 005/006 aplicadas somente à base fictícia.
Central: Card, Button, Dialog com proteção de rascunho, GrupoAcoes e Input; referência
da interação: recebimentos existentes. Nenhuma variante visual nova.
Fiscal incremental: 257/257 em integração, interface, host e fronteiras; nova rodada
13/13 fiscal/preparação. Tipos, lint focado e design aprovados. Revisões posteriores
ainda exigem bateria integrada. Imagens `.tmp-fechamento/fiscal-{desktop,mobile}.jpg`.

Despesa da entrega: vínculo/rateio de lançamento existente, mesmo já pago/conciliado,
sem nova despesa, baixa ou movimento; snapshot, autor, razão e desvinculação auditada.
Trava compartilhada impede rateio excedente e alteração/cancelamento de despesa
vinculada. Pagamento/conciliação preservados. UI usa CampoBusca, Select, CurrencyInput,
Dialog e X oficial; referência: custo logístico e busca financeira existentes.
M1/Financeiro/fronteiras: 232 aprovados e um timeout de importação de action; repetição
sem alterar asserções/timeout passou 175/175 (fronteiras e UI de despesas). Tipos,
lint e design aprovados. Fixture de entrega #2 usada somente para este teste visual,
sem alegar criação ponta a ponta. Erro de rateio de R$60 sobre despesa de R$50
preservou os dados; R$40 vinculados e saldo não vinculado zerado. Desktop 1280×720
e celular 390×844 inspecionados; `.tmp-fechamento/despesa-erro-{desktop,mobile}.jpg`
e `despesa-mobile.jpg`. Corrigidos rótulo do histórico e semântica de link em Button.

Incremento posterior a `d665c910`: correção explícita de recebimento direto, com
versão, justificativa, fotografia integral da baixa/entrada anterior, autor e chave
idempotente. Reutiliza o contrato de correção técnica da baixa: reabre a obrigação e
retira o registro equivocado do caixa, sem criar saída fictícia. Conciliação ou
devolução/crédito dependentes impedem apagar sua origem. Interface oferece ação
separada da devolução de dinheiro. Central: Button/outline, Dialog com rascunho,
Input/Label e GrupoAcoes, referência de confirmação de despesas/fiscal. No ensaio
fictício #1, corrigiu R$90 e registrou novamente o fato certo; saldo voltou a R$260
e ambos os fatos ficaram visíveis. Imagens `correcao-mobile.jpg` e
`correcao-resultado-desktop.jpg` em `.tmp-fechamento`. Revisão do rastreamento de
rascunhos distingue formulário comercial, financeiro e diálogo filho; não salvar por blur.

Revisão financeira: mudança do pagamento comercial substitui somente obrigações
elegíveis, mantendo categoria/competência originais e fatos pagos/externos. Crédito
integral admite saldo adicional na forma informada. Limite do cliente compara saldo
real anterior/posterior, conservando redução de dívida antiga acima do limite.
Teste descobriu chamada incorreta dessa regra, corrigida; 26/26 M2 passaram.
Na suite agregada, uma expectativa antiga de produtos não subtraía Outros custos;
corrigida a decomposição e adicionada asserção total = itens + frete + outros, sem
remover asserções. Timeouts transitórios foram repetidos sem elevar limites.

Boleto: registro de cancelamento externo comprovado e entrada tardia com conta,
data e evidência. Não executam ação no banco. Entrada tardia preserva cancelamento
comercial, não reconhece nova venda e disponibiliza tratamento do valor. Central:
mesmo Dialog/Input/Select/GrupoAcoes, referência correção de recebimento.
33/33 passaram em M2, correção UI, fiscal UI e despesas UI. UI específica de boleto
passou 2/2; popup/editor teve um timeout e passou na repetição, sem ampliar limites.
Bateria corrigida (`testes/permissoes/fronteiras.test.ts`, editor e boleto): 180/180
aprovados. Teste adicional com modal real protege o rascunho comercial sem marcar
o motivo de correção financeira como edição comercial: editor 3/3. Tipos, lint
focado e lint:design (8 bases/311 consumidores) aprovados nesta árvore. Zero
ignorados nessas execuções. Nenhum resultado atribuído a main ou aceite final.

Checkpoint adicional `d28ca597acf00f8bf64f93d68eaa6c069c28139e` enviado e conferido
no remoto. Revisão comercial Pix → boleto de R$350 concluída pela UI fictícia:
título anterior cancelado auditavelmente e vencimento novo em 03/10. Diálogo de
cancelamento externo conferido em desktop/celular, inclusive carregamento.

Destino físico em implementação: reutiliza eventos/ocorrências, sem novo módulo.
Central antes da UI: Dialog/Input numérico (seis casas ou inteiro conforme unidade),
Label, SelecaoFormulario e GrupoAcoes; consumidor de referência TratamentoBoleto.
O cancelamento após execução abre pendência; a resolução conserva produto,
quantidades recuperáveis/perdidas, destino real, autor e data, sem desfazer consumo.
Revenda/material retirado exige tratamento na reserva antes de resolver; o detalhe
reutiliza FisicoPedido para retorno/perda, inclusive com automático OFF. Preparo de
outro item não impede devolver material íntegro ainda não preparado. Lotes de
origem são alocados em ordem de execução, sem origem fictícia para etapas OFF.

Validações incrementais: 54/54, depois 58/58 (M1 opt-in, destino, operação e popup)
e 76/76 (M1/M2 opt-in com precisão de estoque), zero falhos/ignorados. A primeira
execução teve cinco falhas por novas fixtures físicas antecederem asserções de
baseline sem movimentos; novas fixtures movidas ao fim, sem retirar asserções.
Tipos, lint focado e lint:design (312 consumidores) aprovados; os últimos ajustes
de campos de material/histórico passaram em 9/9 testes de interface e tipos/lint.
Após corrigir o transbordamento do botão de crédito no celular, popup/destino
passaram 4/4; tipos, lint focado e design aprovados. Vitest inicialmente impedido
pelo sandbox (subprocesso); repetição autorizada passou, sem alterar testes.

UI fictícia: boleto cancelado externamente seguido de entrada tardia de R$350
preservou títulos anteriores, deixou saldo devido zero e histórico explícito.
Pedido #2 passou por início/conclusão de preparo OFF e cancelamento pago: abriu
destino de 1 UN. Soma 0+0 foi recusada preservando os campos; 1 recuperável + 0
perda resolveu com destino e autor. Imagens de erro desktop/celular inspecionadas.
HMR do Next apresentou uma rota interceptada inválida; abertura completa da rota
recuperou a prévia. Navegação na aplicação compilada permanece no aceite final.
Crédito usa GrupoAcoes oficial (referência CustoEntrega) com rótulo conciso;
imagens `destino-concluido-mobile-corrigido.jpg` e `destino-concluido-desktop.jpg`
em `.tmp-fechamento` mostram o histórico e o formulário sem transbordamento.

Revisão após preparo em validação incremental: mantém IDs de itens compatíveis,
pagamentos e fatos originais; quantidade excedente gera ajuste auditado da execução
atribuída ao pedido e pendência de destino. Novo aumento exige novo preparo e,
quando ON, novo consumo somente do necessário. OFF→ON não baixa etapas OFF
retroativamente. Material íntegro excedente do mesmo item preparado parcialmente
pode retornar sem reconstruir os ingredientes do produto pronto. A resolução de
revenda/material confere retorno e perda separadamente com os registros físicos.
Matriz ON/OFF e financeiro: 81/81 integrações aprovadas, sem ignorados. A primeira
rodada teve 5 falhas: comparação de snapshots JSON, regravação desnecessária de
versão, fixture duplicada e expectativa histórica que bloqueava revisão de
instruções. Corrigidos; a expectativa agora comprova revisão, histórico e execução
preservados, sem retirar a proteção de quantidades/permissões. Último ajuste da
disponibilidade manual passou na regressão com interfaces: 89/89, zero falhos ou
ignorados. Tipos e lint:design aprovados; lint focado aprovado antes desse ajuste
e repetido no fechamento do checkpoint. São validações incrementais, não aceite C.
UI real fictícia: pedido #1 preparado, ampliado de 1 para 2 unidades, produzido
o adicional e reduzido a 1; R$90 preservados, saldo voltou a R$260. A revisão
abriu destino de 1 UN; diálogo conferido em desktop/celular, inclusive carregando.
Evidências `revisao-destino-desktop.jpg` / `revisao-destino-mobile.jpg` no diretório
temporário exclusivo. Nenhuma alteração produtiva.
Retirada do pedido #1 concluída pelo Gestor, sem rota/transporte fictício. Detalhe
após retirada conserva recebido R$90 e saldo R$260; evidência
`retirada-saldo-mobile.jpg`. Revisão/destino não geraram estoque com a chave OFF.

Tentativas de entrega em implementação: ocorrência tipada de falha exige rota
ativa e entrega ainda não concluída; nova saída exige conferência explícita dos
produtos, autor, motivo e referência à falha. Retorno físico anterior à primeira
entrega reduz a execução atribuída à encomenda e exige novo preparo/expedição;
correção de etapa conserva primeira entrega e não cria tentativa real. Sem novo
financeiro/transporte automático. UI compõe Dialog, Input/Label, Checkbox e
GrupoAcoes oficiais: referências DestinoFisico e checkbox do simulador Entregas.
Não cria variante/tokens. Testes de concorrência, permissão revogada, retorno de
revenda e virada de mês com relógio controlado: 56/56 integrações, seguidas por
6/6 interfaces e 89/89 na regressão combinada M1/M2/interface; zero ignorados.
Tipos, lint focado e design (313 consumidores) aprovados. Última composição de
GrupoAcoes da ocorrência em rechecagem visual/focada. UI autenticada: fixture #3
EXTERNO foi preparada, expedida, teve falha registrada e nova saída confirmada
com guarda/integridade explícitas. Desktop/celular conferidos, histórico conserva
tentativa anterior; imagens `tentativa-mobile.jpg`, `tentativa-desktop.jpg` e
`tentativa-historico-desktop.jpg`. Erro/retry do diálogo testados no consumidor;
erro transacional validado em integração. Validar ainda erro na UI persistente.
Entrega da segunda tentativa concluída no Gestor (fixture #3); primeira entrega
preservada no teste com relógio controlado. Composição final passou 6/6 interfaces,
tipos/lint/design. Próximas lacunas confirmadas na UI: apontamentos parciais existem
no consumidor antigo, mas precisam estar no detalhe do Gestor; motivo de devolução
sem retenção está oculto e precisa ficar sempre acessível. Resolver também
preservação de rascunhos entre seções após atualizações do pedido.

Próximo passo: validar serviço/interface de tentativas
de entrega e demais cenários integrados pendentes. Conferir
também rascunhos simultâneos entre seções financeiras, comerciais e operacionais.
Categorias de despesas continuam dependendo de escolha explícita; pergunta enviada
ao usuário. Build/regressão final/backup/deploy não executados. Não integrar main.

## Publicação do Novo Pedido — 30/09/2026, 23h19 (São Paulo)

**PUBLICADO: SIM.** Commit `372c7c355735e42b6151ac7a93870ab20c40ca61` enviado por fast-forward a `main` e confirmado no checkout do Dokploy. Build oficial Docker/Node 22/Webpack aprovado; imagem `sha256:87f30d2dd9827369861a334c4bdd716bd2b01f44bec7e45ee90d7745f819df52`. Tarefa `m1fkovbs5d1y`, contêiner `cf535058060ae1fe9ce02db110985f8e857c2c4980998a0d6b6f0ef8a5da29c0`, iniciado em `2026-10-01T02:13:41Z`, observado Running por mais de seis minutos, zero reinícios. `prisma migrate status` no contêiner: 79 migrations e banco atualizado, exit 0. O auxiliar confirmou a configuração fiscal integralmente preservada, sem consulta externa.

- HTTPS autenticado: `/vendas/pedidos/novo` carregou; a partir do Gestor, “Novo pedido” abriu um `dialog` na rota interceptada, preservando a navegação de fundo. `/vendas/horarios` carregou com o título “Horários de entrega”. Conferência somente de leitura, sem criar pedido, cliente, horário ou movimentação operacional.
- Sem sessão, Gestor, Novo Pedido e Horários retornaram HTTP 307 para login, com TLS validado. O smoke da aplicação compilada antes do envio usou apenas usuário e banco fictícios; o navegador automatizado local bloqueou localhost, mas o HTTPS autenticado de produção foi conferido no navegador.
- Backup vigente `etiquetas-pedidos-novo-20261001-03` com índice/leitura integral verificados e imagem anterior preservada, conforme preparação abaixo. Nenhuma restauração operacional foi feita. O contêiner e a rede PostgreSQL fictícios e o túnel local foram encerrados após a validação.
- O cupom continua indisponível por decisão do usuário; esta publicação não cria cobrança, quitação ou operação fiscal no modo financeiro externo. Pendências de configuração financeira/contábil, integrações e homologações do modo HUB não foram encerradas. A bateria global inicial manteve duas falhas preexistentes de teste de Insumos, documentadas abaixo. Esta evidência pós-deploy fica local para evitar outra publicação apenas documental.


## Simplificação dos slots de entrega — 30/09/2026

Usuário pediu simplificar e autorizou publicar ao concluir. Trabalho na mesma
branch/worktree isolada; checkout original e alterações alheias preservados.
Exceções por data vêm primeiro. Um Select ao lado do dia reúne fechado,
personalizar e cópia; `copiadoDe` opcional conserva a origem após recarga, como
retrato independente. Editar/adicionar/remover/reordenar torna o dia personalizado.
Horários em linhas, cabeçalhos únicos de Início/Término, campos Hora/Min. de 80px
e altura compacta; no móvel, as duas partes se empilham dentro da mesma coluna.
`ListaOrdenavel` conserva alça e teclado; chaves locais não chegam ao JSON salvo.
Sem numeração visual nem o texto explicativo retirado pelo usuário.

Central: Card, Select compacto, Input, BarraAcoes/GrupoAcoes e ListaOrdenavel
existentes; `BotaoRemoverItem` compõe Button ghost e X, com hover destrutivo e
dimensões das ações compactas. Nova variante reutilizável registrada no catálogo,
documentação e demonstração sintética de Botões, Em revisão visual. Sem novos
tokens, dependências ou migration.

Node 22.23.3: 193 testes focados de interface/domínio/Central/fronteiras e 19 de
integração PostgreSQL local aprovados. Um timeout de importação em fronteira fiscal
passou na repetição, sem alterar limite; uma seleção passou a aguardar a abertura
assíncrona, sem relaxar a asserção. A asserção de persistência foi corrigida para
comparar a semana completa (sete dias); integração repetida 19/19. Lint focado,
lint:design (8 bases/254 consumidores), TypeScript e build Webpack aprovados.
Avisos preexistentes de middleware/Edge/jose/pg permanecem. Smoke compilado em
loopback: login 200 e Horários sem sessão 307. Imagens sintéticas desktop/móvel
inspecionadas no Chrome; largura móvel efetiva 434px, página 417px, campos de 80px
preenchidos ou vazios. Ordenação coberta por ponteiro no componente e teclado no
consumidor; tentativa de arraste manual no Chrome excedeu o tempo da leitura DOM.
Integrado `origin/main` `41a1ab4`, preservando Gestor/identidade Pedidos e o catálogo
de suas variantes. Nova bateria integrada: **216/216** (9 arquivos, incluindo
PostgreSQL fictício e fronteiras); build Webpack e TypeScript aprovados,
lint:design **8 bases/257 consumidores**. Publicação ainda em preparação.
Smoke compilado integrado repetido em loopback: login 200, Horários sem sessão 307.

Backup privado atual em `<BACKUP_PRIVADO>`;
leitura integral por pg_restore sem destino de banco aprovada e configuração fiscal
confirmada preservada por comparação somente leitura.

## Preparação da publicação do Novo Pedido — 30/09/2026

O usuário autorizou “pode publicar” após a entrega local do formulário. A candidata integra o Novo Pedido em popup e a revisão visual focada de Pedidos com o `origin/main` `03ba67d`. As atualizações remotas chegaram durante a preparação: a primeira agrupou navegação e vínculos fiscais; a segunda implementou horários de entrega por dia e data. Na integração final, o formulário completo de Horários do remoto foi preservado, os selects oficiais de Canal/Atendimento/Prazo permaneceram no Novo Pedido e a janela agendada passou a usar `HorarioEntregaCampo`. O checkout principal e os arquivos temporários preexistentes permanecem fora do commit. A revisão visual já havia sido testada no navegador fictício; o formulário foi confirmado e recarregado no banco fictício na etapa anterior, conforme seção própria abaixo.

**Validação da revisão integrada:** Node 22.23.3, Next 16.3.4, Webpack `next build --webpack` aprovado, incluindo TypeScript e geração de páginas. ESLint global, `lint:design` (8 bases/249 consumidores) e `prisma validate` passaram. A migration aditiva foi aplicada com `prisma migrate deploy` somente no contêiner PostgreSQL fictício separado, banco `teste_pedidos_cand_20260930`, acessível por túnel localhost; todas as migrations passaram. Os 18 testes integrados de Pedidos passaram nesse banco, com a flag de isolamento e timeout de 30 segundos para acomodar a latência do túnel. Cinco arquivos focados de interface/domínio passaram (11 testes); o contrato de duas novas ações foi incluído na verificação global de permissões, que passou com 153 testes.

A bateria geral inicial teve 1.310 aprovações, 283 testes ignorados e três falhas. Uma falha era a ausência das duas ações novas no catálogo de testes de permissões e foi corrigida/testada. As duas restantes pertencem a `testes/cadastros/status-listas.test.tsx`: a expectativa `Buscar insumo...` diverge do placeholder `Insumo, marca, categoria ou fornecedor...` já presente em `origin/main`; nem o componente nem esse teste foram alterados pela candidata. Não se declara a bateria geral integralmente verde nem se altera Insumos fora deste escopo.

**Aplicação compilada:** login retornou 200; Gestor sem sessão retornou 307 para login; Gestor e `/vendas/pedidos/novo` retornaram 200 com sessão e banco fictícios. O navegador automatizado bloqueou o acesso a localhost nesta rodada (`ERR_BLOCKED_BY_CLIENT`); esse smoke foi HTTP autenticado, não inspeção visual da revisão integrada. Nenhuma cobrança, dado operacional real ou publicação havia ocorrido até esta preparação.

**Preparação operacional:** backup privado `<BACKUP_PRIVADO>` criado antes de qualquer envio; 13.010.107 bytes, SHA-256 `6ec7a699426e2665167b8793e708a076afe14ac0a617e9ebf74dcbb64ef7adf5`, índice e leitura integral com `pg_restore` em contêiner sem rede e montagem somente leitura aprovados. Imagem anterior `app-copy-auxiliary-microchip-9hhwdm:latest` preservada na tag `grazing-pedidos-anterior:20261001`; configuração fiscal capturada sem expor segredos. O certificado permanece com origem no banco. Nenhuma restauração operacional foi realizada.

**Revalidação após o merge com `4bb148d`:** build Webpack/Node 22 e TypeScript aprovados; `lint:design` passou com 8 bases/252 consumidores, ESLint focado passou. Nove arquivos de interface, Horários, navegação de Vendas e vínculos fiscais passaram com 26 testes; um caso de fronteira excedeu cinco segundos sob execução paralela e a mesma bateria passou isoladamente com 153/153, sem afrouxar as asserções. A integração de Pedidos passou com 18/18 em execução única no banco fictício; uma expectativa textual foi atualizada para “horários de entrega” após o merge, mantendo a recusa da janela inválida. O túnel SSH temporário caiu em uma tentativa intermediária e foi restabelecido com keepalive; `prisma migrate status` no banco fictício confirmou 79 migrations atualizadas. A aplicação compilada final repetiu login 200, bloqueio sem sessão 307, Gestor 200 e Novo Pedido 200 com sessão fictícia. A bateria global não foi repetida depois do merge; a revisão remota registra suas próprias validações em `docs/modulos/vendas.md`.

**Backup intermediário:** `<BACKUP_PRIVADO>`, criado após a primeira revisão remota estabilizar; 13.010.107 bytes, SHA-256 `51888d5824164923705b433faef2cd715ae473fbb61e1423dc0c8f95357d8859`. Índice e leitura integral aprovados em contêiner sem rede. Imagem anterior preservada em `grazing-pedidos-anterior:20261001-02`; origem do certificado conferida no banco. Este backup foi sucedido pelo `-03` após a revisão de Horários.

**Revalidação após o merge com `03ba67d`:** Webpack/Node 22 e TypeScript aprovados; `lint:design` (8 bases/253 consumidores) e ESLint focado aprovados. Nove arquivos de interface/domínio passaram com 34/34, fronteiras de permissão 153/153 e integração de Pedidos e horários 19/19 no banco fictício. A versão compilada retornou login 200, Gestor sem sessão 307, Gestor/Novo Pedido/Horários autenticados 200, todos com usuário fictício. Esse smoke foi HTTP em localhost; a restrição do navegador automatizado continua. O conteúdo remoto de Horários foi preservado sem regravar dados existentes.

**Backup mais recente e vigente:** `<BACKUP_PRIVADO>`, criado após a agenda remota estabilizar; 13.010.107 bytes, SHA-256 `078765f849717676445918261d41ce18163a8e4e13aad897a76bf03d60641525`. Índice e leitura integral aprovados em contêiner sem rede; imagem imediatamente anterior preservada em `grazing-pedidos-anterior:20261001-03`; certificado com origem no banco. Os backups `-01` e `-02` são registros anteriores. Qualquer recuperação deve avaliar transações posteriores ao `-03` antes de restaurar dados.

## Revisão visual focada — 28/09/2026 (local, não publicada)

Comparação com `docs/design-system/padroes.md`, `inventario.md` e componentes oficiais em `src/components/ui`/`src/components/padroes-operacionais.tsx`, seguida de inspeção no navegador com dados fictícios. Divergências encontradas: catálogos de comprador/produto sem busca; seleções de canal, atendimento, prazo, janela e grade com aparência/comportamento nativos; tabelas de histórico, gestão e reservas sem o componente oficial; ações de navegação e setas com estilos locais; status e feedback sem semântica visual consistente; cabeçalho e ações secundárias da lista desalinhados.

Foram aplicados `Combobox`, `Select`, `Input`, `Button`, `Badge`, `Table`, `DialogHeader`/`DialogFooter` e `BarraAcoes`. A navegação entre vistas permanece acessível e ativa; a seleção mostra nomes legíveis; estados de carregamento e feedback foram sinalizados. O preview visual fictício recebeu stubs das ações já existentes para voltar a renderizar. Regras, ações do servidor e persistência de Pedidos não foram alteradas.

Exceções mantidas: seletores de filtros enviados por formulário GET e seletores financeiros/operacionais dinâmicos continuam nativos com `classeSelecao`/`ds-selecao-nativa`, padrão compartilhado no sistema, para preservar submissão e contratos existentes; a comanda de impressão conserva HTML próprio por exigir layout de impressão. A Central de Design permanece fonte de verdade para futuras evoluções.

Validação local: TypeScript sem erros; `lint:design` e ESLint focado aprovados; 29 testes focados aprovados (seis arquivos) após o ajuste da tabela de reservas, além da rodada anterior de nove testes após ajustes dos cartões e feedback; navegador autenticado em banco fictício confirmou lista, quadros, resumo modal, editor e Horários, sem operar dados reais. Publicação e homologação visual humana não foram realizadas nesta revisão.

## Publicação do Gestor — 27/09/2026, 23h55 (São Paulo)

**PUBLICADO: SIM.** Commit `b26d34f5b0144988b239086042b981a0d207ae47` enviado por fast-forward e confirmado no checkout do Dokploy. Build oficial Docker/Node 22/Webpack aprovado. Tarefa `aqr8n7vmxrccsnldm0x124wqb`, contêiner `e3c00e98d94e`, início `2026-09-28T02:55:31Z`, zero reinícios durante a observação de aproximadamente dois minutos. Imagem `sha256:900c6b1d61d1e4e1f3011eab076ead6eeb2483f5519854ff34bf0d82c93c57b8`. Migration de horários aplicada pelo procedimento versionado; `prisma migrate status` atualizado, exit 0. Auxiliar confirmou configuração fiscal integralmente preservada, sem consulta externa.

- HTTPS autenticado: Gestor com quatro dias e quatro etapas, menu sem Visão geral, Grupos fiscais por último, Horários com grade padrão de uma hora e nenhum funcionamento presumido, Área de entrega vazia, calendário mensal/semanal e Produção acessíveis. Conferência operacional somente de leitura; nenhum pedido, horário real ou movimentação criado para testar.
- Sem sessão, Gestor, Horários, Área de entrega e Calendário retornaram HTTP 307 para login, TLS validado. Flags de ensaio ausentes; conexão operacional distinta do banco fictício. Contêineres fictícios e túnel/proxy local encerrados após o ensaio. Logs e backup privados preservados.
- Backup verificado e imagem anterior: conforme preparação abaixo. Não houve restauração operacional. Evidência pós-deploy mantida localmente para não disparar nova publicação só por documentação.
- Limites preservados: horários reais dependem de cadastro; área aguarda definição; estorno manual declara devolução externa sem transferência bancária automática. Esta publicação não homologa integração bancária/fiscal nem encerra pendências contábeis do modo HUB. Falha intermitente histórica WasmHash continua sem causa comprovada; builds Node 22/Docker desta revisão aprovados.

## Horários de entrega — 30/09/2026

**Publicado em 30/09/2026, 22:57 BRT (01/10 UTC):** commit funcional
`03ba67d6f20413906191a5b70c7b5f46fa5f326f`, push fast-forward de `4bb148d`.
Build Docker aprovado; tarefa `q7tbme7nq975`, contêiner `f57ae6f39525`, iniciada
às 01:57:40 UTC e conferida após mais de três minutos, sem reinício.
`prisma migrate status`: 78 migrations, banco atualizado. Comparação somente
leitura confirmou configuração fiscal preservada; não foi necessário restaurá-la.
HTTPS sem sessão redirecionou Horários ao login (307). Chrome autenticado confirmou
sete caixas semanais, cópia/fechamento, listas de exceções, início/término/texto,
minutos 00/05/10 até 55 e Cancelar descartando o rascunho. Novo pedido agendado
apresentou o Select compartilhado e orientação para escolher a data. Sem salvar
configurações ou criar pedidos reais. Captura de imagem do Chrome excedeu o tempo
limite; imagens da prévia sintética já haviam sido inspecionadas em desktop/móvel.
Banco fictício e servidores locais exclusivos encerrados; cliente gerado do
checkout original restaurado ao seu schema. Esta evidência pós-deploy foi incorporada
ao incremento funcional seguinte, sem publicação apenas documental.

Usuário solicitou sete caixas semanais, múltiplas faixas em passos de cinco minutos,
opções em texto, cópia/fechamento e exceções por data; autorizou publicar ao concluir.
Candidata em `.worktrees/horarios-entrega`, branch `codex/horarios-entrega`, sobre
`origin/main` `4bb148d`, incorporando a navegação agrupada e os vínculos fiscais
publicados durante a execução. A árvore local anterior foi preservada.

- Estende `/vendas/horarios`, `vendas.horarios` e o JSON/versionamento existentes.
  Configurações 30/60 anteriores continuam legíveis e são convertidas em opções
  equivalentes no formulário, sem regravação ao consultar. Sem nova migration.
- Central: BarraAcoes/GrupoAcoes, Card, Input, Label, Checkbox e Select; nenhum token
  ou variante nova. Referência visual Em revisão. Salvar/Cancelar explícitos, erros
  persistentes; Select compartilhado com novo pedido e reagendamento.
- Node 22.23.3: testes focados e navegação **195/195** (11 arquivos); integração
  PostgreSQL local exclusiva `teste_horarios_entrega_20260930`: **36/36**, incluindo
  texto, exceções, autorização, sessão revogada, conflito, idempotência e preservação
  de agenda histórica; interface operacional **4/4**. A mensagem já alterada na base
  remota exigiu atualizar as expectativas de erro: os 18 testes da integração
  passaram novamente. Aviso conhecido do pg sobre consultas concorrentes permanece.
- Imagens desktop 1440 px e móvel 390 px inspecionadas na prévia sintética; sem
  rolagem horizontal da página. Cópia, seleção, data especial e data desativada
  conferidas no navegador. Nenhum dado operacional alterado para testar.
- A primeira tentativa de compilação usou dependências locais incompletas e falhou
  por módulos de Faturas ausentes; `npm ci` do lockfile vigente corrigiu o ambiente,
  sem atualização de dependências. Testes iniciados durante a instalação falharam;
  a repetição após sua conclusão passou integralmente, sem relaxar asserções.
- Backup privado e configuração anterior preservados na VPS em
  `<BACKUP_PRIVADO>`; leitura integral
  por pg_restore aprovada. Comparação somente leitura confirmou a configuração
  fiscal preservada. A revisão automática recusou envio de pacote amplo e rotina
  potencial de restauração; ambos foram substituídos por validação local e leitura.
  Sem envio de pacote à VPS ou restauração executada.
- Lint focado, lint:design (244 consumidores), TypeScript e build Webpack da versão
  integrada aprovados. O retorno da ação
  de salvar recebeu tipo explícito após a checagem apontar inferência ambígua;
  interface e fronteiras passaram novamente (155 testes). Aplicação compilada em
  loopback com banco fictício: Horários sem sessão redireciona ao login (307), login
  responde 200. Publicação e smoke HTTPS autenticado
  ainda em andamento. Após novos salvamentos,
  eventual retorno de código precisa entender o novo formato JSON; não restaurar
  dump sobre operações posteriores nem converter opções em texto por suposição.

## Preparação da publicação autorizada — 27/09/2026

Usuário autorizou: “pode publicar”. A candidata incorpora por rebase as seis atualizações de `origin/main` até `182b9df`, sem conflito e sem descartar mudanças publicadas. Commit funcional integrado: `3e88fe6d484677c9da0042641335dd2e15d96dfd`.

- Node 22.23.3 local: Prisma generate/validate, lint dos arquivos alterados, lint:design e build previsto Webpack aprovados, incluindo TypeScript. Avisos de middleware/proxy e APIs do jose no Edge não impediram o build nem o login. Isso não é ensaio Docker desta revisão.
- Bateria geral: 198 arquivos, 1318 testes aprovados, 235 ignorados por opt-ins/condições e duas falhas. Integrações de Pedidos executadas com PEDIDOS_BANCO_TESTE=1 em banco fictício; testes ignorados não contam como homologação.
- Falhas localizadas: o teste de Entrada avulsa ainda exigia especificação no seletor, contrariando a seleção compacta já publicada e documentada em `docs/modulos/insumos.md` e `docs/design-system/padroes.md`; ajustado para validar nome e ausência da especificação nesse campo. Perdas exigia opção antes da abertura assíncrona terminar; passou a aguardar a mesma opção, mantendo todas as asserções. Nenhum código funcional de Estoque alterado. Os três arquivos de teste diretamente envolvidos passaram depois (4/4); a bateria global não foi repetida após esses ajustes exclusivos de testes.
- Aplicação compilada iniciada em localhost:4403 com banco fictício `teste_pedidos_operacao_20260926`; proxy somente loopback:4404 adapta Host/Origin sem contatar o domínio público. Sem sessão, Pedidos redirecionou ao login. Login fictício, acesso ao Gestor, leitura dos quadros e alteração dos horários foram conferidos no navegador. Recarga preservou a grade salva. App e proxy de ensaio encerrados ao final. Migrations da base incorporada foram aplicadas somente nesse banco de teste.

**Autorização confirmada:** após a solicitação específica sobre envio à VPS, o usuário respondeu “nao entendi o que devo fazer, mas pode publicar”. Transferência do código, ensaio e preparação autorizados e executados; a rejeição automática anterior foi superada.

**Ensaio final Docker, 27/09 à noite (28/09 UTC):** revisão `d39d62d`, Dockerfile/lockfile preservados, Node 22.23.3 e build Webpack aprovados. O primeiro ensaio compilou mas TypeScript rejeitou `exact` nas opções de `findByRole` de um teste; removido o parâmetro inválido, typecheck local e novo build completos aprovados. Não houve WasmHash; ocorrência anterior continua sem causa comprovada. Seis arquivos/42 testes aprovados no executor Docker, incluindo M1, financeiro M2, horários, quadros e os dois testes corrigidos de Estoque. Rede Docker interna `pedidos-ensaio-20260926`, banco fictício exclusivo, sem volume/conexão operacional. Túnel loopback aponta ao IP dessa rede; proxy ajusta somente o host do ensaio. Navegador: login fictício, quatro dias/quatro etapas, grade padrão de 1 hora; alteração para 30 minutos salva e preservada após recarga. Nenhum dado operacional usado para testes. Logs privados em `/root/gestor-ensaio-20260927`. Um retorno final do shell continha CR residual depois dos comandos concluídos; resultados de build, testes e partida foram conferidos nos logs e no contêiner.

**Preparação operacional:** backup privado `<BACKUP_PRIVADO>`, índice e leitura integral do dump verificados, SHA-256 e imagem/configuração anterior preservados. Imagem anterior fixada em `grazing-gestor-anterior:20260928`. Certificado tem origem no banco, sem inventar fallback. Reversão exige avaliar registros DECLINADO/ESTORNADO gravados após publicação, pois código anterior não os interpreta; não restaurar dump sobre transações novas. Publicação seguirá o procedimento existente e smoke HTTPS somente de leitura. Este complemento de registro não altera a revisão funcional ensaiada.

## Gestor de pedidos e horários — 27/09/2026 (local, não publicado)

**Escopo confirmado:** duas telas de quatro colunas, primeira por data de entrega (hoje + 3), segunda Em preparo/Pronto/Em rota/Entregue; até dois dias de antecedência para iniciar preparo. Grade de 60 minutos padrão ou 30, funcionamento semanal, Área de entrega vazia, menu Gestor de pedidos sem Visão geral e Grupos fiscais por último. Calendário semanal/mensal existente preservado. Decisão posterior do usuário: Estornado manual nesta etapa; integração bancária e efeitos financeiros automáticos ficam para configuração futura.

**Base preservada:** `.worktrees/pedidos-operacao-agenda`, branch `codex/pedidos-operacao-agenda`, HEAD `2c590890ce79fceb878c2ee3f1be66637f760f84`. Evidência anterior de publicação já estava modificada neste arquivo e foi mantida. Checkout principal e alterações alheias preservados; sem nova worktree, alteração de dependências, Dockerfile ou compilador.

**Implementado:** cartões com número, comprador, contagem de outros pedidos confirmados, endereço, destinatário diferente, impressão e resumo de itens/escolhas/observações. Em preparo/Pronto agrupados por entrega; pedidos fora dos quatro dias/sem data acessíveis em seção explícita; entregues no quadro por 7 dias e histórico integral na lista. Horários com salvamento explícito, validação de intervalos/grade no servidor, versão e auditoria; sem presumir abertura real antes de configuração. Janelas históricas inalteradas preservadas. DECLINADO para orçamento; ESTORNADO manual somente para modo EXTERNO, com permissão, motivo/referência, concorrência/idempotência e histórico. Não cria/baixa títulos nem movimenta dinheiro; libera só reservas ainda não consumidas. Comanda identifica encerramento para não preparar. Contratos do modo HUB preservados.

**Isolamento e migration:** aplicação local em `127.0.0.1:4401`; conexão limitada a localhost e banco `teste_pedidos_operacao_20260926`, usuários `@example.invalid` e pedidos fictícios. Executor limpa variáveis das integrações externas; worktree tem apenas `.env.example`. Integrações usam schemas temporários separados nesse banco; nenhum banco operacional acessado. Migration manual `20260927090000_pedidos_horarios` aplicada somente na cadeia isolada. Não houve cobrança, transferência, emissão, deploy, push, merge ou migration operacional.

**Validações aprovadas (211 testes distintos):**
- Integração M1/externo/novos contratos: 17; regressão financeira: 18; agenda/comanda: 4; horários: 2.
- Quadros: 2 (quatro colunas, resumo, agrupamento e impressão simulada com escape); editor: 1; interface operacional: 4.
- Fronteiras de permissão: 151; navegação/menu: 12.
- Prisma generate, geração de tipos de rotas, TypeScript sem emissão, ESLint focado, `lint:design` (240 consumidores) e `git diff --check` aprovados. Uma edição inicial incorreta do contrato de testes e um helper ausente foram corrigidos; respectivas suítes passaram novamente, sem desativar validações. Aviso do pg sobre consultas concorrentes permanece aviso, não falha.
- Navegador autenticado: quatro dias/quatro etapas e resumo inspecionados visualmente; grade padrão de uma hora conferida, grade de meia hora salva e preservada após recarga; janelas de 30 minutos visíveis no editor mantendo horário anterior; Área de entrega vazia; estorno fictício salvo/recarregado com motivo, responsável e referência, formulário comercial bloqueado e pedido removido da fila ativa. Impressão física não executada.

**Limites desta revisão:** validação de navegador em servidor de desenvolvimento Webpack/Node 24.19.0. Não houve novo build de publicação ou ensaio Docker desta revisão; o build/deploy da seção anterior pertence ao commit anterior. Não foi reaberta a investigação WasmHash, cuja causa segue não confirmada. Para publicar estas alterações, ainda é necessário o ritual C com build/smoke da revisão final e aplicação controlada da migration. Horários reais não foram cadastrados; Área de entrega aguarda definição do usuário. Estorno é declaração de devolução externa, não integração bancária. Pendências contábeis/fiscais e do financeiro HUB não são encerradas por esta entrega.

## Operação com financeiro externo, produção e calendário — 26/09/2026

Nova fonte: `FEATURE_PEDIDOS_OPERACAO_PRODUCAO_AGENDA.md`, lida integralmente. Substitui o bloqueio global por capacidades: novos pedidos deste lançamento usam gestão operacional com financeiro externo; Takeat permanece responsável pelo processo externo. M2 anterior não é convertido, nem recebe backfill. B05 já aprovado. Base local preservada: branch `codex/manifesto-nfs-publicacao`, HEAD `465b1cd492b2fc42da01eb96d6db846127ee78ab`, alterações anteriores presentes.

**Autorização atual:** usuário confirmou “Publicar após validar a nova feature”. Destino: HUB existente, `https://grazinghub.com.br`; somente capacidade operacional externa. Commit funcional `2c590890ce79fceb878c2ee3f1be66637f760f84` enviado por fast-forward para main; acompanhamento de publicação descrito abaixo.

### Candidata e compatibilidade

- Integração em `codex/pedidos-operacao-agenda`, diretório `.worktrees/pedidos-operacao-agenda`, sobre `origin/main` `cdce0400df810a6120917fcb5f8c1081928e17ba`. A árvore original e seus arquivos alheios foram preservados. Conflitos com Faturas, catálogo e permissões resolvidos mantendo ambos os contratos. Lockfile, dependências, Dockerfile e compilador da base remota preservados.
- Novos pedidos: modo `EXTERNO` persistido e imutável; referência opcional completa origem/estabelecimento/código com unicidade; confirmação/revisão/cancelamento sem título, recebimento, crédito, taxa, repasse, caixa ou documento fiscal automático. Guardas no servidor impedem atalhos financeiros. Pedidos anteriores mantêm `HUB`, sem conversão. Não há job financeiro novo.
- Central, produção com permissão própria, comanda A4/80 mm e calendário mensal/semanal/diário usam os mesmos pedidos. Reagendamento explícito e auditado; fuso da empresa nas datas operacionais. Produção não entrega preços/endereço/contatos ao perfil restrito. Estoque usa serviços existentes, local escolhido explicitamente e permissão adicional; não inventa composição/saldo.
- Migration adicional `20260926090000_pedidos_operacao_externa`; cadeia anterior de M1/M2 preservada. Novas permissões constam do catálogo, sem ampliar perfis existentes automaticamente.

### Validação isolada desta entrega

- Dockerfile versionado, Node **22.23.3**, Next **16.3.4**, Prisma **7.10**, React **19.2.8**. `npm ci`, Prisma generate/validate e build Webpack com verificação TypeScript aprovados. Falha antiga WasmHash não reapareceu; causa segue **não confirmada**, sem correção especulativa. Typecheck avulso local antes de gerar rotas apontou `LayoutProps` ausente; a compilação Docker gerou e verificou esses tipos.
- Rede Docker `pedidos-ensaio-20260926` interna, Postgres próprio sem volumes/redes operacionais, bancos `teste_pedidos_operacao_20260926` e `teste_pedidos_recuperacao_20260926`. App, migrations e testes compartilham somente a rede do banco fictício, com credenciais sintéticas. Acesso por túnel privado/localhost; proxy de ensaio ajusta host/cookie somente localmente. Esse smoke não comprova TLS público.
- Bateria ampla: 1.387 aprovados, 7 falhas e 105 ignorados por seus opt-ins. As sete falhas foram tratadas: três expectativas de exclusão passaram a preservar também vínculos de Pedidos; três mocks de plano de contas foram ajustados para distinguir títulos vinculados; catálogo passou a encaminhar a propriedade de configuração obrigatória paga. Regressão focada posterior: **37/37**, incluindo duas novas recusas de exclusão/mudança indevida de categoria. Não se apresenta a primeira bateria como integralmente verde.
- M1/M2 em Docker: **33/33**; agenda/comanda/interface: **7/7** na revisão de fuso e aviso de cancelamento. Ensaio no navegador encontrou data agendada invisível ao mudar para imediato; servidor/interface limpam a previsão e a fila inclui imediatos antigos com previsão residual, sem backfill. Regressão desse ajuste: **36/36** (33 integrações anteriores + 3 de agenda/comanda). Uma tentativa intermediária montou teste novo com comanda antiga do executor; corrigida a montagem da fonte, sem relaxar asserções.
- ESLint global sem erros; aviso da propriedade de catálogo corrigido e lint focado aprovado. `lint:design`: 8 bases/235 consumidores. Avisos conhecidos de pg/middleware não foram ocultados.
- Navegador autenticado na aplicação compilada: criação pelo calendário com data preenchida; pedido fictício #1, 2 kits/R$300, referência externa; confirmação e revisão comercial; reserva de 2; consumo/preparo de 1+1; recusa de preparar além do consumido; pronto, reagendamento, expedição, saída e entrega persistida após recarga. Calendário nas três visões, tela móvel 390 px sem transbordamento horizontal, prévias A4/80 mm. Impressora física não homologada.
- Pedido #2 sem composição foi confirmado comercialmente e apresentou pendência física, sem composição inventada. Perfil de produção autenticado vê somente seu menu; acesso direto à central recusado. Na imagem final, o mesmo perfil iniciou preparação, teve preparo sem composição recusado (quantidade digitada preservada) e acessou comanda sem dados comerciais/pessoais. Administrador cancelou com motivo; histórico preservado e comanda exibiu “PEDIDO CANCELADO — NÃO PREPARAR”. Saldo físico 98 de 100, nenhum título/caixa.
- Backup fictício em formato custom restaurado em banco separado com `pg_restore --exit-on-error`: ambos com 2 pedidos, **0 títulos e 0 movimentos bancários**. SHA-256 do dump: `8c8d24453ea2c27e94e12b64311bd4d9da5cba71606cbde6c551770ae034ae65`. Artefatos/logs privados em `/root/pedidos-ensaio-20260926`; sem dados operacionais.

- Conferência byte a byte de **553 arquivos funcionais** entre candidata e fonte da imagem sem divergência também após o último ajuste. Ajuste de fuso abrange apresentação e filtros de confirmação, sem mudar datas civis de entrega; regressão **41/41**, com dia de 23 horas e borda UTC/empresa. `tsc --noEmit` no executor Docker aprovado. Smoke da última imagem confirmou os pedidos em 26/09 no fuso da empresa e a exclusão no filtro de 27/09; cancelamento persistido. Build Webpack repetido somente após mudanças funcionais identificadas.
- Backup operacional privado criado antes da publicação pelo auxiliar: `<BACKUP_PRIVADO>`. Índice e leitura integral por `pg_restore --file=/dev/null` aprovados; hash, imagem/configuração anterior e conteúdo mantidos privados na VPS. Nenhuma restauração operacional executada.

### Resultado da publicação — 26/09/2026, 22h18 (São Paulo)

**PUBLICADO: SIM**, capacidade operacional com financeiro externo. Commit `2c590890ce79fceb878c2ee3f1be66637f760f84`, confirmado no checkout usado pelo Dokploy e em main. Build oficial Node 22/Webpack aprovado, sem mudança de dependências/Dockerfile. Tarefa `ngtcw06rylxo`, contêiner `e7eb6b137c4e`, início `2026-09-27T01:18:06Z`, observado estável por mais de 7 minutos, zero reinícios. `prisma migrate status`: atualizado, exit 0. Configuração fiscal preservada integralmente pelo auxiliar, sem consultas fiscais.

- HTTPS autenticado: `/vendas/pedidos`, `/vendas/pedidos/producao` e `/vendas/pedidos/calendario` acessíveis; links no menu Vendas. Formulário aberto a partir do dia 27/09 com data preenchida, delivery/agendado selecionados e mensagem de financeiro externo. **Nenhum rascunho/pedido fictício gravado em produção.** DRE e catálogo também renderizados após a publicação, sem operações reais.
- Sem cookies: as três rotas retornaram HTTP 307 para `/login`, com TLS validado. Permissões restritas exercitadas no ensaio; nenhum perfil operacional foi ampliado automaticamente.
- Flags de ensaio ausentes no serviço operacional; banco distinto do fictício. Os dois contêineres de ensaio foram encerrados, dumps/logs privados preservados. Backup pré-migration verificado, nenhuma restauração operacional necessária.
- Uso: Vendas → Calendário → “+ Agendar pedido”; completar cliente/canal/itens/data/janela e confirmar explicitamente. Na tela do pedido ou da Produção, “Comanda” → A4/80 mm → imprimir pelo navegador, conferindo revisão. Impressora física não homologada nesta execução.
- Limites: financeiro e fiscal continuam externos; referência Takeat não é integração. Sem captura de pagamentos, boletos, devoluções, crédito ou CMV automático neste modo. Composição/saldo/local insuficientes bloqueiam a execução física correspondente; cadastro real não foi preenchido por suposição. M2/HUB não declarado integralmente liberado.
- **Retomada:** a revisão publicada está no worktree `.worktrees/pedidos-operacao-agenda`, branch `codex/pedidos-operacao-agenda`. A árvore original continua com suas alterações anteriores preservadas e não foi substituída pelo checkout de main. Este registro pós-publicação fica local; nenhum novo deploy apenas para evidência documental.

### Publicação, transição e recuperação

1. Encerrar smoke da imagem final e revisar diff/migrations. Conferir remoto ainda na base integrada; commit apenas do escopo, sem temporários/segredos. Não usar force push.
2. Executar `scripts/deploy-etiquetas.py preparar` com identificador novo; manter imagem/configuração anterior e dump privados. Verificar integridade do dump antes de migrar. O script não consulta SEFAZ.
3. Push fast-forward autorizado dispara Dokploy no serviço existente. Partida aplica a cadeia validada de migrations e inicia Next. Exigir tarefa nova estável, migrations atualizadas, HTTPS, bloqueio sem sessão e navegação autenticada. Nenhuma venda fictícia em produção.
4. Conferir preservação fiscal pelo modo `restaurar` do auxiliar (não restaura banco). Novos pedidos manuais têm modo externo; não importar Takeat nem converter legado. Cadastros incompletos ficam sinalizados; operação física depende de composição/local/saldo reais conferidos pela operação.
5. Se houver falha após publicação, suspender novas mutações por `PEDIDOS_OPERACAO_EXTERNA=0`, preservar histórico e avaliar retorno à imagem anterior registrada. As tabelas/colunas aditivas podem permanecer; nunca remover dados nem restaurar dump sobre transações novas. Restauração de banco exige janela controlada e avaliação dos registros posteriores, não é rollback automático.
6. Financeiro integrado, política contábil/CMV, gateway, retenção e procedimento fiscal externo continuam pendentes para suas capacidades. Não bloqueiam genericamente este modo operacional, nem são declarados resolvidos. Comanda via navegador não é homologação de impressora térmica.


## Liberação operacional — entrega parcial validada, 24–25/09/2026

Fonte: feature de liberação operacional fornecida em 24/09/2026, lida integralmente. Base preservada: `465b1cd492b2fc42da01eb96d6db846127ee78ab`, branch `codex/manifesto-nfs-publicacao`, 69 migrations locais; estado operacional não consultado. Aprovações não inferidas da autorização para desenvolver.

| Pendência | Evidência atual | Implementação necessária | Entrada externa / responsável | Encerramento | Situação |
|---|---|---|---|---|---|
| F1/B05 | Regra aprovada na conversa; núcleo físico testado | Completar tratamentos dependentes do cadastro/condição real de preparados | IDs dos locais e correspondência do material recuperável / operação | Escopo físico completo homologado | APROVADO; IMPLEMENTADO/VALIDADO parcialmente |
| F2 | Cobertura e estimativa existentes | Prontidão acionável e origem dos movimentos | Exportação autorizada, escopo e saldos / cadastro e estoque | Cadastros conferidos pelos responsáveis | PENDENTE |
| F3/B06 | Título afeta DRE de competência | Proteção de ativação e matriz de eventos | Política, contas, vigência e retenção / contador | Política configurada e exemplos entre períodos aprovados | PENDENTE |
| F4 | Controle interno; sem conector identificado | Conectores específicos após definição | Fornecedor/canais/contratos/sandbox / plataforma | Sandbox efetivo e reconciliação | BLOQUEADO externamente |
| F5/F6 | Operação e 168 testes da revisão anterior | Revisões controladas e critérios T01–T16 | Decisões dependentes acima | Evidência da nova revisão por critério | PENDENTE |
| F7 | Node 24 local; Node 22/Docker não validado | Ensaio migration/backup/restauração e runbook | Runner isolado autorizado / infraestrutura | Build cache novo/reutilizado, persistência e recuperação | PENDENTE |
| E01/virada | Sem aprovação externa registrada | Referência externa e checklist de transição | Emissor, momento, conferência, responsáveis / operação e contador | Procedimento aprovado; nenhuma emissão nesta execução | PENDENTE |

Sequência: F1 físico sob proposta → F2 prontidão → F3 controles contábeis independentes → F4 somente conectores identificados → F5 revisões/consultas → F6 testes → F7 ensaio onde houver ambiente. Dependência externa bloqueia somente sua parte. O runbook existente acima/abaixo será ampliado, sem especificação paralela.

**Aprovação recebida:** usuário confirmou “Aprovo a regra proposta para o estoque” após explicação em linguagem operacional; B05 atualizado em DECISOES_PENDENTES. Nenhum local ou saldo real foi escolhido, e ativação não foi autorizada.

**F1 — núcleo implementado, validação incremental:** `ReservaPedido` identifica item/versionamento, componente/local, lote lógico da liberação e quantidades reservadas/consumidas/liberadas/retornadas/perdidas. Lote lógico não é lote físico com validade: o estoque existente não mantém lotes físicos rastreados; essa cobertura não é alegada. O gravador compartilhado de estoque usa trava conjunta e recusa saída sobre reservas; cancelamento libera o não usado; perda de material retirado registra destino sem segunda saída. Retorno exige componente original e condição informada, com recusa de devolver ingredientes após preparo. Revenda sai somente na expedição. Tela de materiais ligada ao serviço, autorização e idempotência no servidor. Migration `20260925090000_pedidos_reserva` aditiva, sem alteração de movimentos antigos. Primeiro conjunto: 23/23 integrações Pedidos; regressão seguinte: **275/275** Pedidos/Estoque/fronteiras, com opt-ins de contagem, perda e entrada avulsa ativos. Dados exclusivamente fictícios; as novas verificações posteriores exigem bateria final.

**F2 — consulta implementada:** `/vendas/pedidos/prontidao` verifica canais (inclui base zero com opção obrigatória), composição, opções vinculadas, conversões, ciclos, rendimento, locais e origem dos custos. Exibe IDs e problemas concretos, encaminhando à edição/prévia existentes. Não aplica correções nem lê dados reais fora do ambiente autorizado. Custo por movimentos permanece nulo sem método aprovado; estimativa e apontamento não são medição física. Conferência do catálogo real continua pendente.

**F3 — proteção independente:** todas as mutações do núcleo de Pedidos verificam liberação no servidor dentro da releitura de acesso. Esta revisão mantém uso real bloqueado; nem preenchimento de booleano nem aprovação documental isolada habilitam contratos contábeis/conectores incompletos. Ensaio exige `PEDIDOS_AMBIENTE_ISOLADO=1` e URL exclusivamente localhost com banco `teste_*`. Matriz preenchível de 14 eventos em `pedidos-politica.ts`; validação rejeita aprovação incompleta. Nenhum evento recebeu categoria/competência real inventada. DRE e caixa dos outros módulos preservados. O desacoplamento definitivo depende do evento de reconhecimento aprovado; o título continua tendo o comportamento contábil documentado somente nos cenários sintéticos. Não foi localizado fechamento contábil de períodos no escopo Financeiro consultado (fechamento de cartão não é fechamento contábil); não alegar essa proteção como existente.

**F4 — bloqueado externamente:** não houve resposta identificando intermediador/canais/conta/contrato/sandbox. Nada permite implementar ou homologar um fornecedor real; nenhum adaptador hipotético foi acrescentado. Controle interno não é integração automática.

**F5 — revisão controlada:** desconto/frete após início podem ser revistos mantendo os mesmos itens, instruções e histórico físico, com ajuste do saldo pelo Financeiro existente. Alterar itens/instruções executadas continua exigindo ocorrência/tratamento específico; não declarar todos os casos de revisão física concluídos. Teste R$ 300 + R$ 90 recebido → R$ 350/R$ 260 de saldo revelou comparação sensível à ordem de JSONB; corrigida para comparação canônica sem reescrever snapshots. Regressão financeira após a correção: 15/15.

**F5 — complemento validado:** iniciar etapa sem consumo/preparo não congela a revisão: reservas anteriores são liberadas e itens versionados. Depois de execução, também é possível acrescentar itens ao final, preservando IDs/quantidades/histórico dos existentes e retomando preparação. Redução/substituição do executado permanece encaminhada a ocorrência/tratamento; não é sobrescrita. Fotografia anterior permanece no histórico; consulta não mostra estimativa global completa quando os itens já não correspondem à fotografia. Saída/entrega exigem ocorrências resolvidas; com configuração física do ensaio, item sem reserva/consumo não pode ser dado como preparado/expedido. Agenda indica itens com demanda ainda não reservada/composição pendente.

### F6 — evidências da revisão atual

Revisão: HEAD `465b1cd492b2fc42da01eb96d6db846127ee78ab` + alterações locais preservadas e desta tarefa. Impressão SHA-256 de 802 arquivos ordenados (`src`, exceto gerados; `prisma`; `testes`; package/lockfile/Dockerfile/next.config/tsconfig): `8668d262afe0a7fb60655f4a9025a28418dbb0d2c9bb341d7d7c6f43fdfc81bb`. Não é commit, imagem ou versão já publicada.

- **289 testes únicos aprovados** nas execuções focadas desta tarefa. Bateria conjunta intermediária: 285/285; após novos cenários, conjunto focado 160/160; interface final 3/3; integrações finais 31/31 (M1: 13, M2: 18). As execuções sobrepostas não são somadas como testes novos. Os 127 testes de Estoque aprovados não foram repetidos após mudanças restritas aos contratos de Pedidos; gravador compartilhado permaneceu igual desde essa bateria.
- Comandos: `vitest run --maxWorkers=1` nos arquivos `pedidos-integracao`, `pedidos-financeiro-integracao`, `pedidos-liberacao`, `pedidos-operacao-interface`, `permissoes/fronteiras` e diretório `testes/inventario`. Opt-ins `PEDIDOS_BANCO_TESTE`, `CONTAGEM_BANCO_TESTE`, `ENTRADA_AVULSA_BANCO_TESTE`, `PERDAS_BANCO_TESTE` ativos; nenhum skip na bateria de Estoque. Executor substituiu `DATABASE_URL` para banco exclusivo `teste_pedidos_liberacao_20260924` em localhost e esvaziou variáveis externas do arquivo local. Prisma validate/generate, TypeScript, ESLint focado e `lint:design` aprovados (8 bases/222 consumidores). Aviso pg de query concorrente continua conhecido, sem mascaramento.
- Navegador autenticado no servidor local Webpack de desenvolvimento: reserva de 2 UN; consumo de 1+1 KG; recusa de preparar 2 quando só 1 estava consumido; preparação de 1+1 UN; expedição, saída e entrega. Login, recarga, tela de prontidão e imagens inspecionadas. Documento sintético externo vinculado, sem emissão. Saldo físico final 8 de 10 KG; reserva zero; 2 KG consumidos. Pedido comercial R$ 300, títulos R$ 90 baixado/R$ 210 pendente, uma movimentação bancária, três de estoque (entrada fictícia + duas saídas). Dados de seed e banco reais, sem mocks de operações internas. O custo cadastral observado no consumo é preservado com fonte/data e `valorizacaoAprovada=false`; não é custo apurado nem competência aprovada.

| Critério | Evidência e limite |
|---|---|
| T01 | Integração única com reserva, consumo/preparo parciais, entrega e conciliação: R$ 300/90/210, um recebimento; navegador confirmou fluxo físico. |
| T02 | Revisão 300→350 mantém recebimento 90/saldo260; adição de novo item preserva o anterior. Redução/substituição do executado não homologada. |
| T03 | Disputa simultânea pela mesma disponibilidade, repetição de comando e saída direta recusada sobre reserva. |
| T04 | Preparação já estocada sai sem novo consumo dos ingredientes; produção anterior representada por movimentos sintéticos do serviço existente, não por módulo industrial novo. |
| T05 | Liberação no cancelamento, perda sem segunda retirada e retorno idempotente do componente original recuperado. Reaproveitamento de alimento transformado não homologado. |
| T06 | Base zero com opção obrigatória preservada; ausência de composição/custo identificada, sem valor inventado. Cadastro real não conferido. |
| T07 | Snapshots antigos preservados; primeiras conversões da reserva reutilizadas; estimativa incompleta após revisão não vira margem/custo definitivo. Valorização por movimentos pendente. |
| T08 | Regressão interna 1–4x/débito, captura/repasse/taxa. Sem homologação de adquirente. |
| T09 | Regressão interna boleto/vencimento/Pix/conciliação; nenhuma alteração externa alegada como efetuada. |
| T10 | Regressão interna de elegibilidade, solicitações e evidências; nenhuma devolução real. |
| T11 | Teste único: pedido450 = crédito300 + Pix150, caixa novo150, consumo físico integral de 3 KG. |
| T12 | BLOQUEADO: política contábil não recebida. Matriz de eventos pendente e teste que rejeita aprovação incompleta; consumo não gera lançamento de CMV. |
| T13 | BLOQUEADO: fornecedor/contrato/sandbox não identificado. Não alegar mocks como homologação. |
| T14 | Guardas de ações, serviço direto, concorrência e bloqueio operacional real. Loja única existente; sem alegação de multitenancy. |
| T15 | Ensaio de migration/recuperação com fixtures; corte, saldos reais e autoridade das integrações ainda não definidos. |
| T16 | Referência exata de emissor/documento deduplicada por chave única e permissão, sem nota/receita nova. Autenticidade e procedimento E01 não aprovados. |

### F7 — publicação e recuperação: executado versus pendente

**Executado somente em bases fictícias:** 70 migrations em banco vazio; ensaio separado 69→70 com local/insumo/saldo7,25/movimento relacionados preservados. `pg_dump` e `pg_restore` PostgreSQL 17 em outra base exclusiva, com `--exit-on-error`; contagens e hashes de oito tabelas (Pedido, Item, Histórico, Título, Movimento bancário, Reserva, Saldo, Movimento de estoque) iguais antes/depois. A base restaurada e o schema de atualização foram removidos após conferência. Não é ensaio sobre cópia operacional, nem comprovação dos saldos de virada reais.

**Não executado:** build/cache novo e reutilizado e aplicação compilada na revisão atual em Node 22/Dockerfile, pois Docker/Node 22/runner autorizado não estão disponíveis. Node 24.19.0 foi usado somente nos testes/desenvolvimento desta rodada, não declarado equivalente. Build local anterior pertence à revisão anterior. WasmHash continua intermitente sem causa comprovada; nenhuma troca de compilador, dependência, junção, worktree ou Dockerfile nesta tarefa.

**Rotina exata a executar no runner isolado, quando disponibilizado:** preparar contexto de código revisado, incluindo migrations e arquivos novos, excluindo `.env*`, `.tmp*`, dumps, `.worktrees`, `.git`, `node_modules` e caches. A `.dockerignore` atual não cobre todas essas exclusões; não enviar a pasta de trabalho inteira ao runner. Fixar o commit/manifesto aprovado e o digest de imagem. Construir pelo Dockerfile existente com `docker build --no-cache --target builder -t grazing-pedidos-hml-builder .`; o primeiro `RUN npm run build` testa cache novo. Executar `docker run --rm --entrypoint sh grazing-pedidos-hml-builder -c 'npm run build'` sobre o builder para testar cache Webpack reutilizado sem depender do cache de camadas. Depois construir/testar a imagem runner pelo mesmo Dockerfile. Exigir logs de ambas execuções; esses comandos estão preparados, não executados aqui.

Banco de homologação separado, nome `teste_*`, credenciais exclusivas em arquivo protegido fora do contexto; app e auxiliares apontam somente para ele. Para usar a guarda localhost em Docker, app/testes podem compartilhar o namespace de rede do contêiner PostgreSQL de homologação (`--network container:<banco-hml>`), sem acesso ao banco operacional. Publicar porta somente em loopback no contêiner que detém o namespace, se necessário ao navegador. Não enfraquecer a guarda para alcançar produção. Executar migrations e testes opt-in, carregar fixtures, testar login/criação/confirmação/pagamento fictício/reserva/consumo/histórico na imagem, confirmar HTTPS/Host/cookies no ambiente previsto e registrar o digest realmente exercitado.

**Transição futura, condicionada a nova autorização:** responsáveis devem conferir escopo/cadastros, locais/saldos, créditos, títulos, pagamentos e pedidos em aberto na data de corte. Registrar para cada ID externo a única origem responsável, impedindo nova cobrança/reprocessamento histórico. Importação de histórico deve ter modo sem efeitos, ainda dependente do conector real; não converter um CSV de catálogo em importação de pedidos. Não executar seed fictício no destino. Confirmar políticas/vigência, E01, evidências e permissões antes de liberar novas escritas. Não habilitar produção apenas alterando a flag de ensaio; esta revisão mantém bloqueio real deliberado.

**Recuperação:** backup privado do destino antes das migrations futuras, restaurado em base separada e comparado antes de autorizar a virada. Guardar digest/configuração anteriores. Com reservas, código antigo sem essa proteção não é rollback seguro com escrita habilitada; suspender novas escritas e preferir correção progressiva compatível. Preservar os fatos gravados após o corte e reconciliar; não restaurar dump antigo sobre operações novas. Leituras/histórico devem continuar disponíveis. Quando existirem conectores, a suspensão de novos pedidos precisa preservar recepção durável/reconciliação de notificações financeiras em trânsito; essa rotina externa ainda não existe e não está homologada. Logs sem segredos, fila de exceções, health check autenticado e alertas precisam constar do ensaio do conector/runner antes da autorização final.

**Encerramento do ambiente fictício:** servidor e navegador de ensaio encerrados; porta 4397 sem resposta. Banco exclusivo `teste_pedidos_liberacao_20260924` removido, assim como a base restaurada e o schema de atualização já conferidos. Os 18 arquivos temporários próprios desta rodada, incluindo dump e executores, foram removidos após registrar as evidências. Artefatos e alterações anteriores preservados.

**Classificação desta entrega:** IMPLEMENTAÇÃO CONCLUÍDA: **parcial**; HOMOLOGAÇÃO TÉCNICA CONCLUÍDA: **parcial**; PRONTO PARA PUBLICAÇÃO OPERACIONAL: **não**; AUTORIZAÇÃO DE PUBLICAÇÃO RECEBIDA: **não**; PUBLICADO E OPERAÇÃO ATIVADA: **não**. A aprovação de B05 não aprova contabilidade, cadastros, integrações, E01 nem publicação. Não há versão candidata operacional homologada para solicitar autorização final.

## Continuação não fiscal — partes independentes concluídas, 24/09/2026

### Validação final e ponto de retomada

**Encerramento do ambiente isolado:** processos temporários encerrados; conexões às portas locais 4395 e 4396 recusadas após a validação. Banco exclusivo `teste_pedidos_continuacao_20260924` removido com sucesso e os sete arquivos temporários desta rodada (executor, seed, proxy e logs) removidos. Evidências consolidadas abaixo; cache Webpack anterior preservado no caminho indicado para eventual diagnóstico. Trabalho preexistente mantido.

**Incremento 5 — partes independentes verificadas:** 22 testes de integração PostgreSQL (M1: 8; M2: 14), 22 de interface Vendas/Pedidos (incluindo 2 novos de operação/impressão) e 124 de fronteiras de autorização: **168 testes únicos aprovados** nas execuções focadas. A execução final conjunta de operação/interface nova/integrações/fronteiras passou 148/148; os outros 20 testes de interface passaram na bateria anterior sem alteração posterior desses consumidores. A primeira verificação de fronteiras revelou que 12 ações de M2 preexistentes não estavam no contrato; foram adicionadas, preservando as guardas e testando chamadas diretas. Não houve afrouxamento de asserções. TypeScript, Prisma validate/generate, ESLint focado, `lint:design` (219 consumidores) e diff sem erros de whitespace aprovados. Aviso do pg sobre chamadas concorrentes de query permanece; não foi convertido em falha funcional nem ocultado.

**Banco e navegador:** 69 migrations aplicadas via `prisma migrate deploy` somente ao banco exclusivo localhost `teste_pedidos_continuacao_20260924`; integrações usam schemas temporários dentro dele. Aplicação e auxiliares receberam a URL desse banco, segredo sintético e variáveis externas de `.env` vazias; nenhuma consulta à base operacional. Login real, pedido fictício de R$ 300 com sinal R$ 90/saldo R$ 210, início, preparação parcial 1+1, recusa de conclusão incompleta, pronto, reagendamento de 01/10 para 02/10, expedição de 2 unidades, saída, entrega, ocorrência posterior e resolução foram exercitados no navegador. Recarga preservou estado/quantidades. Relatório confirmou R$ 300 comercial, R$ 90 recebido, R$ 210 a receber e R$ 20 de estimativa fotografada, sem margem/CMV. Imagens da operação e gestão foram inspecionadas. Impressão tem teste de conteúdo/escape, sem homologação física.

**Build final — evidência delimitada:** Node instalado 24.19.0; lockfile e instalados Next 16.3.4, React 19.2.8, Prisma/client/adapter 7.10.0 e TypeScript 5.9.3 conferidos. `npm run build` continua `next build --webpack`. A primeira tentativa desta revisão falhou novamente com a pilha abaixo. Para discriminar participação do cache, o servidor local foi encerrado e **somente** `.next/cache/webpack` foi movido para `.next/cache/webpack-preservado-pedidos-20260924`, dentro da raiz verificada, preservando o conteúdo. Uma execução com cache novo passou compilação, TypeScript e 58 páginas estáticas, incluindo as rotas novas. Isso não prova causa raiz nem correção permanente: houve alterações finais de apresentação/consulta entre as tentativas, e a influência do contexto exato de Webpack não foi instrumentada. Nenhuma alteração em worktrees, junções, compilador, Dockerfile ou dependências. A ocorrência intermitente segue **sem causa comprovada**. Próximo teste discriminante se necessário: reproduzir em Node 22 isolado e comparar cache preservado/novo com registro do contexto de hash que recebe valor inválido, sem alterar dependências por hipótese.

```text
TypeError: Cannot read properties of undefined (reading 'length')
    at WasmHash._updateWithBuffer (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1435171)
    at WasmHash.update (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1434506)
    at BatchedHash.update (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1430867)
    at <repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:303529
    at processQueue (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1448866)
    at process.processTicksAndRejections (node:internal/process/task_queues:85:11)
Node.js v24.19.0
Next.js build worker exited with code: 1 and signal: null
```

**Aplicação compilada:** `next start` em localhost:4395, banco fictício; proxy somente localhost:4396 adaptou Host/Origin/redirecionamentos/cookie para testar o host de produção aceito sem contatar o domínio público. Logout/login, acesso autorizado à operação e agenda filtrada, nova ocorrência na compilação e recarga passaram. Inspeção confirmou pedido entregue, versão 13, 11 eventos operacionais, um título baixado de R$ 90 e um pendente de R$ 210, com vencimentos originais; uma movimentação bancária e zero movimentos de estoque/notas recebidas. O proxy adapta HTTP local: não comprova HTTPS/cookies do destino. Docker/Node 22 não disponível nesta estação; o contrato do Dockerfile permanece **não validado**. Build apresentou avisos existentes de middleware deprecado e APIs Node/Edge no encadeamento Next/jose; nenhuma validação foi desativada.

**Limites dos cenários solicitados:** agenda/sinal/entrega/conciliação, revisão antes do preparo, recusa rastreável de revisão após início, ausência de composição, snapshots, permissões, repetição/concorrência e reconciliação de relatórios foram cobertos. M2 preserva crédito+Pix e devoluções. **Não testados como realizados:** baixa de intermediário/ingredientes, reserva, retorno/perda, consumo ligado a crédito+Pix e ajustes físicos após preparo, pois não foram ativados sem B05; eventos de fornecedor/sandbox não foram simulados como conector existente. Não declarar todos os cenários físicos/integrados aceitos. G04/M2/M3 e escopo não fiscal integral permanecem abertos.

**Retomada exata:** continuar a partir de `pedidos.ts` (execução operacional), `pedidos-composicao.ts` (fotografia analítica) e `pedidos-gestao.ts` (consultas). Antes dos efeitos físicos, resolver B05 em [DECISOES_PENDENTES](DECISOES_PENDENTES.md); implementar reserva/consumo/tratamento físico nos serviços existentes e validar cenários físicos 2/4/6/7/8. Fornecedor/canal/contrato/sandbox de E04 habilitam conectores, eventos autenticados e importação separada. B06 e competência/classificação habilitam integração contábil aprovada. Não reconstruir M1/M2 nem a operação já verificada.

### Implantação e reversão — procedimento para avaliação, não executado

1. Fechar gates de operação/cadastro/contabilidade/integrações/E01 e definir permissões reais; revisar o diff completo, inclusive alterações locais anteriores. Não publicar esta árvore indiscriminadamente.
2. Em homologação Node 22/Dockerfile, com banco fictício e integrações sandbox identificadas, executar instalação pelo lockfile, geração do Prisma, migrations aditivas pendentes, testes, `npm run build` e aplicação compilada com persistência. Conferir volumes, variáveis, jobs auxiliares, HTTPS e isolamento; aprovação em Node 24 não substitui esta etapa.
3. Somente com autorização futura de publicação: seguir [Deploy](../../contexto/deploy.md), guardar imagem/configuração anteriores e backup privado com restauração verificada; conferir migrations realmente pendentes no destino. O Dockerfile executa migrations na partida, portanto revisar a sequência antes de iniciar a imagem. Não executar seed fictício no destino. Validar acesso, agenda/financeiro e integridade sem cobranças ou vendas de teste reais.
4. Reversão: suspender novas escritas/integrações e manter o serviço indisponível para operações afetadas; preferir correção de código compatível. Não remover coluna/eventos, apagar snapshots ou desfazer recebimentos para voltar versão. Código antigo que ignora as novas transições não é reversão segura com escrita habilitada. Preservar fatos novos; restaurar backup apenas em plano específico de recuperação, nunca sobre transações posteriores sem reconciliação. O cache preservado é artefato local de diagnóstico, não correção a publicar.

**Uso real: NÃO LIBERADO.** Sem deploy, push, merge, alteração operacional ou integração real. Fiscal permanece fora da implementação e E01 continua obrigatório antes de vendas reais.

**Incremento 4 — consultas implementadas:** `/vendas/pedidos/gestao` exige Pedidos e Financeiro no servidor, filtra cliente/canal e base de confirmação ou previsão de entrega, com paginação de 50. Por pedido: comercial, desconto/frete, recebido, taxa, crédito usado, saldo cliente, captura/repasse, devolução concluída/pendente, retenção, atraso e ocorrências. Valores financeiros são acumulados até a consulta para a coorte selecionada, não caixa do período nem DRE. Agrupamentos do **filtro completo**, percorridos em lotes e paginados separadamente dos pedidos, usam itens vigentes/snapshots por produto/variação/conjunto de categorias/canal; não somam versões nem duplicam múltiplas categorias. Histórico do cliente acessa essa consulta e preserva extrato de crédito existente. Custo estimado é fotografia no início, custo apurado/CMV pendentes, sem margem inventada. Integração financeira ampliada: **14/14** aprovadas, incluindo agenda+sinal+preparo+entrega+conciliação, vencimentos inalterados e reconciliação das consultas com as fontes de M2.

**Incremento 3 — bloqueio externo confirmado no escopo consultado:** `src/lib/vendas/importacao.ts` importa catálogo por origem/loja/chave, não pedidos. Scripts iFood são cargas assistidas de catálogo; Takeat consta como referência comparativa em `docs/analise-vendas-takeat-ifood-2026-09-22.md`, sem contrato de entrada de pedidos/pagamentos. `src/app/api`, `src/lib/vendas` e `.env.example` não fornecem conector/sandbox de intermediador ou canal de pedidos identificado. Nenhum serviço externo ou base operacional foi consultado. Mantido o controle interno manual de M2; integração automática **não implementada, não configurada, não homologada**. Faltam fornecedor/conta/loja, canal/plataforma efetivo, contrato/API e acesso de sandbox autorizado, autenticação de notificações e mapeamentos. Sem isso, captura/repasse/devolução por webhook e importação operacional/histórica de pedidos continuam bloqueados; não foi criado adaptador hipotético nem importação retroativa.

**Incremento 2 — parcela independente:** cobertura por item da composição comercial fotografada; conversões explícitas reutilizadas de Insumos; estimativa pela ficha e rendimento usando o serviço existente, distinta do custo apurado e do CMV. Início da preparação preserva fotografia da estimativa/conversões/instruções, inclusive após alterações cadastrais. Intermediário aparece como necessidade própria, sem baixa recursiva. Produto sem ficha continua vendável e mostra custo/disponibilidade pendentes, nunca zero. Testes M1 ampliados: **8/8** no banco fictício, incluindo preservação após mudança de custo/composição e ausência de estoque/fiscal. **Não implementados/ativados por B05:** reserva, consumo, liberação, retorno físico/perda de Pedido, ajuste de itens após preparação e custo apurado. A definição de evento/local, saldo negativo/reserva e modo das preparações é necessária antes de implementar esses contratos; B06 bloqueia integração contábil de CMV. Não considerar M3/G11/G12 concluídos.

**Incremento 1 — implementação e validação de domínio:** estado operacional separado; quantidades preparadas/expedidas por item versionado; início/pronto/saída/entrega; ocorrências e resolução após entrega; reagendamento com motivo, sem efeitos financeiros; resumo imprimível e agenda filtrável. Autorização, versão e idempotência no servidor. Após início, revisão de itens bloqueada até definição do ajuste físico; cancelamento interrompe sem reposição automática. Migração aditiva `20260924210000_pedidos_operacao`. Integrações M1/M2: **19/19** aprovadas no banco exclusivo `teste_pedidos_continuacao_20260924`, incluindo concorrência e quantidades parciais. Navegador e validação final ainda serão executados no incremento 5; impressão física não homologada.

Preservar M1/M2 e todas as alterações locais. Sequência: (1) agenda e execução operacional com histórico, quantidades e ocorrências; (2) cobertura de composição, rastreabilidade física e custos analíticos nas partes independentes de B05/B06; (3) identificar integrações efetivamente existentes e implementar somente com contrato e sandbox autorizados; (4) histórico e consultas de gestão reconciliáveis; (5) integração em banco fictício, navegador, build Webpack final e ambiente Node 22 quando disponível. Registrar resultado após cada incremento.

B05 ainda não define evento/local de consumo, reserva, saldo negativo nem modo das preparações; nenhuma transição comercial, financeira ou de entrega passa a movimentar estoque por suposição. Competência, intermediador, retenção, E01 e publicação permanecem bloqueios. Build local anterior aprovado em duas execuções Node 24; ocorrência intermitente WasmHash sem causa comprovada, sem correção aplicada. A revisão nova exige novo build. Uso real: **NÃO LIBERADO**.

Base inicial: branch `codex/manifesto-nfs-publicacao`, HEAD `465b1cd492b2fc42da01eb96d6db846127ee78ab` em 24/09/2026. O workspace já contém alterações alheias e `docs/features/pedidos/` não rastreado; preservá-las. Fonte de requisitos: [SPEC](SPEC.md), [decisões](DECISOES_PENDENTES.md), [arquitetura](ARQUITETURA.md), [gaps](GAPS.md) e [roadmap](ROADMAP.md).

## Sequência curta

1. Persistência: modelos e migration manual/aditiva de Pedido, Item e Histórico; validar schema e, se houver banco local isolado confirmado, aplicar/testar somente nele.
2. Servidor: cálculo e regras comerciais, transições, revisão, cancelamento, autorização, idempotência e testes focados.
3. Interface: lista/detalhe/editor de Pedidos dentro de Vendas, com confirmação explícita e componentes existentes.
4. Integração: testes dos fluxos e efeitos ausentes de M2/M3/M4; validações estáticas e visuais proporcionais.

**Incremento atual:** 4 concluído para os contratos de M1 em ambiente isolado. O marco ainda não foi aplicado ao banco operacional nem liberado para vendas reais.

**Arquivos alterados nesta execução:** `prisma/schema.prisma`; `prisma/migrations/20260924160000_pedidos_venda_m1/migration.sql`; `src/lib/vendas/{dominio,consultas,persistencia,pedidos-dominio,pedidos}.ts`; `src/lib/permissoes/catalogo.ts`; `src/app/(protegido)/vendas/page.tsx`, `pedidos/` e ajustes pontuais em `produtos/{preco-canal,produtos-client}.tsx`; `testes/permissoes/contrato-acoes.json`; `testes/vendas/pedidos-integracao.test.ts`, `testes/vendas/pedidos-interface.test.tsx`, `testes/vendas/interface.test.tsx`; `testes/visual/pedidos*`; este registro e atualização pontual dos documentos da feature. Arquivos de outros trabalhos já presentes no workspace foram preservados.

**Testes executados:** `npx prisma validate` e `npx prisma generate` aprovados; `npx tsc --noEmit`, ESLint dos arquivos afetados e `npm run lint:design` aprovados após a interface. A migration nova foi aplicada junto com as anteriores exclusivamente em schemas temporários no PostgreSQL localhost; o harness os remove ao encerrar. Teste integrado de Pedidos: 6/6. Teste do detalhe histórico: 1/1. Bateria pertinente de Vendas/permissões: 170 testes, 168 aprovados inicialmente e 2 expectativas antigas ajustadas para a regra aprovada de base zero; repetição focada: 20/20. O fluxo visual de preencher cliente/canal, atendimento agendado, item com configuração paga, desconto/frete e confirmação foi exercitado no navegador em prévia local com ações simuladas; isso valida a interação da interface, enquanto o serviço real foi validado pelo teste de integração. Nenhuma migration foi aplicada ao schema público ou a produção.

**Critérios A–L:** A, B, C, D, E, F, G, H, I, J, K e L exercitados por testes de integração no schema temporário, com a ressalva de que o navegador usou ações simuladas e não uma sessão autenticada ligada ao mesmo schema. Não existe modelo de empresa/unidade no domínio atual para aplicar isolamento adicional. G01–G03 e o aceite comercial de M1 de G04 foram implementados e testados; o vínculo financeiro e a prevenção de duplicidade entre Pedido, títulos e DRE continuam para M2. G05/G07/G08/G09 tiveram apenas suas parcelas comerciais de M1 atendidas. Cadastros reais, migração no destino operacional, homologação financeira/fiscal e uso real permanecem fora desta validação.

**Fechamento técnico anterior:** M1 implementado e validado no escopo isolado autorizado. Após o ajuste do resumo histórico e da proteção contra exclusão de produto usado, repetição final dos dois testes de Pedidos: 7/7; TypeScript, ESLint focado e `lint:design` aprovados. Naquele ponto ainda não havia build nem smoke da aplicação compilada. Tecnicamente é possível iniciar M2 sem liberar M1 para operação real.

**Próximo passo concreto:** iniciar M2 em tarefa separada, definindo primeiro B04 e competência financeiro-contábil, e então implementar o vínculo Pedido → títulos/recebimentos com reconciliação. Antes de qualquer venda real, confirmar o caminho fiscal E01 e validar cadastros/dados no ambiente de destino. Não publicar M1 isolado.

## Validação integrada complementar — 24/09/2026

**Ambiente e isolamento:** raiz `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado\Downloads\grazing-hub`, branch `codex/manifesto-nfs-publicacao`, HEAD `465b1cd492b2fc42da01eb96d6db846127ee78ab`. Alterações preexistentes mantidas. Um executor temporário conferiu que `DATABASE_URL` de origem apontava para PostgreSQL em `localhost`/`127.0.0.1`, criou o banco exclusivo `teste_pedidos_e2e_29aa9125b84244c78e1f58e94db9bf54`, aplicou nele as 64 migrations existentes e carregou apenas dois usuários, um cliente, um canal e um produto fictícios. O processo Next foi iniciado com `DATABASE_URL` substituída pela desse banco, segredo de sessão sintético, `APP_URL` local e integrações externas desativadas. Nenhum dado ou credencial operacional foi copiado. Servidores encerrados e banco temporário removido após a verificação.

**Comandos e fluxo:** `npx tsx .tmp-pedidos-e2e.ts setup`, `dev`, `inspect`, `build`, `build-turbo`, `start`, `cleanup` foram usados com executor temporário específico desta validação; os comandos `grant-cancel`/`revoke-cancel` alteraram somente o perfil sintético no banco isolado para testar revogação de permissão com formulário aberto. O executor e os logs temporários desta rodada foram removidos ao fim. O navegador acessou o Next local em `127.0.0.1:4387` com login real da aplicação, sem mocks de Pedidos ou bypass de autorização.

**Navegador autenticado e banco real isolado — passou:** o administrador criou e salvou o rascunho #1, reabriu após recarga e confirmou a venda. Revisou quantidade/desconto/frete: total confirmado R$ 205,00, depois R$ 210,00, mantendo o mesmo número e somente uma venda ativa na carteira. Cancelou antes da retirada com motivo, que permaneceu no histórico; o resumo passou a zero vendas ativas, preservando a linha cancelada. Criou e confirmou o pedido #2 de R$ 100,00. O usuário restrito consultou a lista, teve a rota de criação negada e, após revogação da permissão de cancelar com a tela do pedido #2 já aberta, tentou o cancelamento pelo formulário: a ação do servidor redirecionou para acesso negado. A inspeção posterior mostrou #2 `CONFIRMADO`, versão 2, somente eventos `CRIADO` e `CONFIRMADO`, sem cancelamento. O pedido #1 permaneceu `CANCELADO`, versão 5, com cinco eventos e o motivo informado. Havia sete eventos no total e **zero** `LancamentoFinanceiro`, `MovimentacaoEstoque` e `NotaFiscalRecebida` no banco isolado. Isso é validação ponta a ponta, distinta da prévia visual com ações simuladas registrada acima.

**Build previsto — falhou; build alternativo — passou:** `npx tsx .tmp-pedidos-e2e.ts build` executou `next build --webpack` com o banco isolado e terminou durante a compilação com `TypeError: Cannot read properties of undefined (reading 'length')` em `WasmHash._updateWithBuffer` do Webpack compilado pelo Next. O ambiente dispõe de Node 24.19.0; a causa exata da exceção não foi comprovada e ela também aparece em tentativa de build anterior no workspace. Não houve alteração de código para mascará-la. Com `next build --turbopack` no mesmo ambiente, a compilação, TypeScript, geração das 57 páginas estáticas e finalização passaram; as três rotas de Pedidos aparecem como rotas dinâmicas. Esse build alternativo não substitui o aceite do comando `npm run build`, que usa Webpack.

**Aplicação compilada — smoke básico passou com limite:** `next start` subiu localmente a compilação alternativa. Em modo de produção, a proteção existente de Host responde `421 Host não permitido` para `127.0.0.1`; portanto o smoke foi feito por HTTP local com cabeçalho `Host: grazinghub.com.br`, sem acessar esse domínio nem fazer deploy. `GET /login` respondeu 200; `GET /vendas/pedidos`, `/vendas/pedidos/novo` e `/vendas/pedidos/[id]` responderam 307 para login sem sessão. Isso confirma disponibilidade das rotas e guarda de autenticação na aplicação compilada; não foi executado fluxo autenticado na compilação. O fluxo autenticado completo acima ocorreu no servidor de desenvolvimento ligado ao mesmo banco isolado.

**Correções e limites:** nenhuma correção pontual de M1 foi necessária nesta rodada. O build Webpack continua falhando neste ambiente e requer investigação separada antes de qualquer publicação. Não houve teste com dados/cadastros operacionais, homologação externa, deploy, push, merge ou liberação de vendas reais. G04/G06/G09 seguem abertos para M2; B04, competência financeiro-contábil e E01 continuam sendo gates de integração/liberação nos termos dos documentos de decisão.

## Primeiro incremento de M2 — vínculo financeiro direto, 24/09/2026

**Implementado:** a confirmação integrada exige categoria ativa de receita bruta, data de competência explícita e distribuição de valores/vencimentos cuja soma coincide com o total do Pedido. Na mesma transação, gera títulos `LancamentoFinanceiro` vinculados ao Pedido, com chave única de efeito, snapshot da forma comercial e histórico do responsável. Não usa recorrência. Recebimento efetivo baixa o título na conta e data informadas; o parcial desdobra valor recebido e saldo pendente, mantendo raiz e valor original. O detalhe apresenta recebido, saldo, títulos e histórico financeiro. Revisões com um único saldo pendente ajustam esse saldo e preservam baixas; cancelamento sem recebimento cancela pendentes. Revisão abaixo do recebido, redistribuição de vários saldos e cancelamento com recebimento são recusados atomicamente. Vencimento pendente pode ser alterado com permissão e histórico, sem ser afetado por mudança de entrega.

**Proteções e modalidades:** o Financeiro genérico não edita, cancela, baixa ou estorna títulos de Pedido; transferência de categoria com esses títulos é recusada. A conciliação vincula lançamento de Pedido já baixado e com conta/data/valor coincidentes, sem segunda baixa ou receita; título pendente exige registro do recebimento no Pedido. Neste incremento, apenas Pix, transferência e dinheiro cadastrados, ativos e sem taxa são elegíveis. Cartões, modalidades com taxa, captura versus repasse, reembolso, retenção e crédito continuam fora do fluxo; B04 não foi concluída.

**Dependência contábil exata:** `src/lib/financeiro/calcularDre.ts` inclui todo lançamento não cancelado por `dataCompetencia` na DRE por competência, inclusive título pendente; no regime de caixa, apenas baixados pela `dataPagamento`. `src/lib/financeiro/fluxoCaixa.ts` considera pagamento de baixados e vencimento de pendentes. Logo, gerar título com uma data de competência já reconhece receita nessa visão. O teste usou data e categoria sintéticas explícitas, mas não estabelece quando a venda real deve ser reconhecida. A política contábil precisa ser definida e homologada antes do uso real; não foi mudada globalmente a DRE.

**Evidência isolada:** migrations aditivas aplicadas apenas em schemas/banco local temporários. Testes de integração cobriram 300→90+210, repetição sem novos títulos, baixa 90, revisão para 350 com saldo 260, conciliação de 90 sem nova movimentação, parcial 100→40 recebido+60 pendente, ajuste de vencimento, permissões, recusas atômicas, DRE de competência 350/caixa 90, fluxo 350 e ausência de estoque/fiscal. O navegador autenticado contra banco PostgreSQL exclusivo e dados fictícios confirmou criação, títulos, baixa 90, revisão e parcial 40/60, com histórico visível. TypeScript, ESLint focado, `lint:design` e testes focados aprovados. O banco de navegação foi removido após a validação.

**Próximo incremento mínimo:** aprovar a política de competência e as partes ainda abertas de B04, então implementar e testar as exceções de revisão/cancelamento com pagamento, cartões/taxas apenas se forem meios reais escolhidos, e os cenários financeiros correspondentes. E01 e validação dos cadastros no destino continuam gates do primeiro uso real. M2 não está completo. Nenhuma migration operacional, venda real, cobrança, devolução, deploy, push ou merge foi realizada. A falha conhecida do build Webpack permanece pendência de publicação e não foi investigada nesta rodada.

## Investigação do build previsto — 24/09/2026

**Ambiente e comando:** raiz `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado\Downloads\grazing-hub`, branch `codex/manifesto-nfs-publicacao`, HEAD `465b1cd492b2fc42da01eb96d6db846127ee78ab`; alterações preexistentes preservadas. `package.json` define `npm run build` como `next build --webpack`; `package-lock.json` v3 fixa Next 16.3.4, React 19.2.8, Prisma 7.10.0 e TypeScript 5.9.3, iguais aos pacotes instalados pertinentes. A estação executa Node 24.19.0. O `Dockerfile` versionado usa `node:22-slim`, `npm ci`, `prisma generate`, o mesmo `npm run build` e, na partida, `prisma migrate deploy` seguido de `npm run start`. Não havia Docker disponível nesta estação, portanto o ambiente do contêiner/publicação não foi reproduzido.

**Exceção anterior preservada:** o log da validação anterior, sem dados operacionais, registrou a seguinte pilha (caminho absoluto abreviado):

```text
TypeError: Cannot read properties of undefined (reading 'length')
    at WasmHash._updateWithBuffer (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1435171)
    at WasmHash.update (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1434506)
    at BatchedHash.update (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1430867)
    at <repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:303529
    at processQueue (<repo>/node_modules/next/dist/compiled/webpack/bundle5.js:29:1448866)
    at processTicksAndRejections (node:internal/process/task_queues:85:11)
    at runNextTicks (node:internal/process/task_queues:69:3)
    at process.processImmediate (node:internal/timers:502:9)
Node.js v24.19.0
Next.js build worker exited with code: 1 and signal: null
```

**Reprodução e teste discriminante:** foi criado exclusivamente um banco PostgreSQL local `teste_build_webpack_*`, com as 65 migrations atuais e dados fictícios. Os processos de build e da aplicação receberam `DATABASE_URL` desse banco, segredo sintético, integrações externas vazias e telemetria desativada. A execução inicial de `npm run build` passou: compilação Webpack, TypeScript, 57 páginas estáticas e rotas de Pedidos. Uma segunda execução, agora com o cache de Webpack preenchido para testar a hipótese de revalidação de contexto, também passou. O erro anterior **não foi reproduzido** e nenhuma correção de código/configuração foi aplicada. Não se conclui que a falha tenha desaparecido.

**Hipótese delimitada, sem diagnóstico:** o ponto `bundle5.js:29:303529` da pilha anterior corresponde ao cálculo de hashes de contexto do Webpack. Há 11 junções absolutas de `node_modules` dentro de `.worktrees`, apontando para o `node_modules` da raiz. A cópia do Webpack embutida no Next 16.3.4 ainda concatena o destino absoluto de `readlink` ao diretório do link em `lstatReadlinkAbsolute`, sem a guarda para caminhos absolutos. O [issue #21636 do Webpack](https://github.com/webpack/webpack/issues/21636) descreve a mesma exceção em `WasmHash` quando um contexto em cache contém esse tipo de link; o [PR #21647](https://github.com/webpack/webpack/pull/21647), incorporado ao projeto original em 09/08/2026, corrige esse defeito. Nesta execução, não foi observado qual contexto exato o Webpack tentou hashear na falha anterior; os dois builds com as junções presentes passaram. A diferença Node 24 local versus Node 22 do Docker também não foi testada como causa. Não mover worktrees nem alterar Webpack/Next com base apenas nessa correlação.

**Aplicação compilada:** `next start` iniciou em `127.0.0.1:4393` com o banco fictício. O Host local direto recebeu 421, como exige a proteção de produção. Um proxy restrito a localhost adaptou Host/Origin e redirecionamentos para o nome público aceito pela aplicação, sem contatar o domínio real: `/login` retornou 200 e `/vendas/pedidos` sem sessão retornou 307. Pelo navegador, o usuário sintético fez login, abriu Pedidos, confirmou o pedido #1 de R$ 100, recarregou o detalhe e viu o título de R$ 100 em aberto. Inspeção do banco temporário confirmou um Pedido `CONFIRMADO`, um título `PENDENTE` e zero movimentações bancárias. Isso valida a persistência da compilação local; não equivale a teste do contêiner Node 22, deploy ou homologação operacional. O navegador, proxy, servidor e banco temporário foram encerrados/removidos ao final.

**Pendência objetiva:** executar `npm ci`, `prisma generate` e o build previsto em contêiner Node 22 com snapshot isolado dos worktrees, comparando com uma execução em que as junções absolutas estejam presentes. Se a exceção reaparecer, instrumentar temporariamente o cálculo de contexto para registrar somente o caminho problemático; então aplicar a correção local mínima comprovada e repetir build e smoke. O build Webpack passou localmente nesta rodada, mas a causa da falha intermitente permanece não confirmada. Nenhuma publicação ou venda real foi autorizada.

## M2 — pagamentos externos, devoluções e crédito, 24/09/2026

**Regras comerciais recebidas:** a operação é delivery. Em Pedidos, os meios necessários são Pix, boleto com vencimento individual, débito on-line em 1x e crédito on-line em 1–4x. Captura do cliente, repasse do intermediador e parcela do cliente são fatos distintos. Após cancelamento e pagamento, o responsável pode solicitar devolução integral, devolução parcial com retenção explícita e justificada, ou crédito escolhido pelo cliente. Não há taxa, juros, multa, prazo de cancelamento nem validade de crédito presumidos. Essas regras constam de [DECISOES_PENDENTES](DECISOES_PENDENTES.md) e dos contratos em [ARQUITETURA](ARQUITETURA.md); não aprovam política contábil ou retenção para uso real.

**A — pagamentos on-line e boleto:** a condição financeira limita no servidor crédito a 1–4x e débito a 1x, sem criar títulos por parcela do cartão. Captura externa exige referência e evidência; quita a obrigação do cliente, mantendo o repasse pendente e sem entrada bancária. Repasses parciais ou integrais registram bruto, taxa e líquido por efeito existente do Financeiro, sem nova venda. Taxa conhecida na captura e taxa efetiva de repasse ficam discriminadas; desconhecida permanece pendente. O boleto interno, a emissão externa e o pagamento evidenciado têm estados próprios, com vencimentos independentes; mudança interna sinaliza divergência do boleto externo. Pagamento tardio após cancelamento vira exceção. Pix e conciliação anterior permanecem. Não foi criado checkout nem conector de cobrança.

**B — devolução e retenção:** cancelar preserva recebimentos e capturas; não executa saída. Solicitação reserva somente o valor pago/capturado ainda elegível, ligado aos pagamentos originais. Devolução parcial exige valor devolvido, valor retido, motivo, responsável, referência à política e comunicação; pendente, em processamento, falha/cancelada e concluída são distinguíveis. Conclusão exige evidência, conta, data, categoria de dedução e competência explícitas, gerando saída por mecanismos do Financeiro. Devolução de cartão antes de seu repasse está bloqueada até definição operacional do intermediador. O tratamento de retenção real depende de validação aplicável.

**C — crédito do cliente:** concessão após cancelamento e escolha comunicada do comprador reserva origem paga; aplicação em novo Pedido usa movimentos rastreáveis e bloqueio transacional do saldo por cliente. Pode ser parcial, integral ou combinada com Pix; mantém preço comercial, vínculo com pedido original e novo, e não movimenta caixa na conversão/aplicação. Extrato e saldo aparecem no cadastro do cliente. Liberação de crédito usado exige decisão explícita, motivo e referência; ajustes exigem origem e permissão. Valores reservados/devolvidos não viram crédito, nem crédito consumido vira devolução. O título quitado com crédito entra uma única vez na DRE de competência e fica fora da visão de caixa/fluxo, sujeito à política contábil pendente.

**Evidência isolada:** migrations aditivas aplicadas somente em banco PostgreSQL local temporário, com host verificado e usuários, conta, produtos e comprovantes inteiramente fictícios. Testes de integração de Pedidos cobriram 1x/4x e recusa de 5x/débito parcelado, cartão R$ 400 com taxa R$ 12 e repasse R$ 388, boletos independentes, limite de R$ 90 pagos em pedido de R$ 300, devoluções de R$ 300 e R$ 240 com R$ 60 retidos, crédito R$ 300 em pedido de R$ 450 com Pix R$ 150, saldo remanescente, concorrência/idempotência/reversão, permissões e ausência de estoque/fiscal. No navegador autenticado contra outro banco local temporário, quatro pedidos fictícios exercitaram captura de R$ 300 em 4x, repasse bruto R$ 300 com taxa R$ 12/líquido R$ 288, conversão em crédito de R$ 300, aplicação desse crédito em pedido de R$ 450 e recebimento Pix de R$ 150, devolução solicitada e concluída de R$ 240 com R$ 60 retidos, emissão fictícia de boleto e divergência visível após mudar apenas o vencimento interno. Recarga confirmou a persistência. Inspeção do banco: quatro pedidos, uma captura, um repasse, dois tratamentos concluídos, concessão/aplicação de crédito correspondentes, cinco movimentos bancários esperados e zero registros de movimentação de estoque ou emissão fiscal. Nenhuma fronteira externa foi acionada.

**Validação técnica:** `prisma validate` e `prisma generate`, TypeScript, ESLint focado, `lint:design` e testes focados passaram. Na execução conjunta de cinco arquivos houve 36 testes aprovados e dois timeouts de interface durante carga paralela; o arquivo afetado passou isoladamente com 14/14 testes, sem mudança funcional para resolver o timeout. O build desta alteração não foi executado: as duas aprovações locais de `npm run build` em Node 24.19.0 pertencem à investigação anterior e não comprovam esta alteração. A ocorrência anterior de WasmHash continua intermitente e sem causa confirmada; a validação em Node 22/Dockerfile segue pendente antes da publicação.

**Bloqueios de liberação:** B04 tem regras comerciais informadas e funções isoladas implementadas/testadas, mas a configuração efetiva do intermediador, automação e homologação de cobranças/devoluções externas continuam faltando. Competência e classificação contábil de receita, taxa, devolução e retenção precisam de política aprovada; datas/categorias sintéticas não a substituem. A retenção parcial requer validação aplicável. E01 e a verificação do ambiente de publicação permanecem abertos. G04 e M2 não estão concluídos para uso real. **Uso real de Pedidos: NÃO LIBERADO.** Não houve cobrança, boleto, devolução ou dado operacional real, migration operacional, deploy, push ou merge.

## Novo Pedido em popup — 30/09/2026 (candidato local)

Rota interceptada abre Novo Pedido em `Dialog` a partir do Gestor, preservando a URL direta. Cadastro rápido do comprador com permissão própria, cobrança editável por pedido e entrega separada, CEP brasileiro com fallback manual, busca de produtos por categoria, observações por item, frete, outros custos, desconto e forma de pagamento informada foram ligados ao contrato comercial existente. A confirmação conserva os novos campos em snapshots/histórico sem alterar o endereço cadastrado do cliente; o cálculo final permanece no servidor. Cupom está visível e indisponível por decisão do usuário, sem regra de desconto presumida. No modo financeiro `EXTERNO`, a forma informada não cria pagamento ou quitação.

Migration SQL aditiva `20260930100000_pedidos_novo_formulario` aplicada somente ao banco local fictício `teste_pedidos_operacao_20260926`. A integração isolada de Pedidos passou com 18/18 cenários, incluindo snapshot de cobrança, outros custos e observação; testes focados de interface/domínio e verificação de design complementam a evidência. No navegador autenticado no mesmo tipo de ambiente isolado, o popup abriu sobre o Gestor, o comprador fictício foi criado e o pedido fictício #8 foi confirmado e recarregado com item R$ 150, frete R$ 10 e outros custos R$ 5, total R$ 165, sem cobrança no HUB. Nenhum dado operacional, migration operacional ou publicação foi realizado nesta mudança. O formulário agendado exibiu data e janela, mas o banco de teste não tinha horários configurados para exercitar a escolha de uma janela.

## Novo Pedido — cadastro inline e organização, 01/10/2026

Autorização do usuário: ajustar o popup e publicar ao final. Trabalho no worktree
`pedidos-operacao-agenda`; checkout principal e temporários preexistentes preservados.
Base inicial publicada 372c7c3; gestor dedicado 41a1ab4 incorporado antes de validar.

Cliente, Cobrança, Entrega e Pedido passaram a ocupar seções próprias. Todos os
campos do cliente aparecem desde a abertura; seleção preenche dados/cobrança e
sinaliza discretamente. + ghost/icon junto à busca inicia cadastro inline, com
salvamento explícito pela ação existente e permissão própria. Cadastro selecionado
é consultado; cobrança/entrega continuam snapshots editáveis por pedido. Origem,
estabelecimento externo, código externo, Atendimento e Prazo saíram dos controles;
referências históricas não foram apagadas. Data determina o prazo, delivery é o
padrão de novos rascunhos, e a configuração vigente de horários é reutilizada.
Telefone preserva número ao editar DDD e suporta oito/nove dígitos. Campo CEP
formata também endereços selecionados. Grades responsivas mantêm alinhamento e
alturas oficiais, com largura menor para telefone, número e UF.

Proteção de saída foi mantida como aviso inline no único Dialog, incluindo foco,
Continuar editando e descarte explícito. Não abre confirmação sobre o formulário.
Central: reutilizados Dialog, Button, Input, Select, Combobox, CurrencyInput,
Textarea, Campo e HorarioEntregaCampo. Exceção DS-PED-NOVO-01 documentada no
manual/inventário; não foram criados tokens nem variantes globais. Sem schema,
migration, dependências, compilador ou efeitos financeiros novos.

Validação sobre 41a1ab4: ESLint focado e lint:design passaram; TypeScript e build
Webpack final passaram em Node 22.23.3, Next 16.3.4, React 19.2.8, Prisma 7.10.0.
Navegador fictício: preenchimento, indicação visual, + sem outra janela e proteção
de saída conferidos; desktop e 390px, um diálogo e sem overflow horizontal da
página. Captura local novo-pedido-ajustado.jpg salva na pasta de visualizações.

A bateria Windows teve timeouts de cinco segundos e um worker não iniciado.
Repetição com 15s passou nos consumidores, mas duas importações fiscais em testes
de fronteira ainda excederam o limite. Não foram alteradas asserções nem os testes
existentes para esconder essas ocorrências. A mesma candidata foi validada em
contêiner temporário Linux, rede none, sem DATABASE_URL/credenciais operacionais,
com dependências da imagem instalada e NODE_ENV=test: 410 aprovados, 60 opt-ins
com banco desativados, 36 arquivos aprovados/3 desativados. Primeira tentativa
herdou NODE_ENV=production e falhou por React.act ausente; foi descartada como
execução inadequada. Testes sintéticos não substituem integração de persistência;
os serviços/migrations já validados permanecem sem mudança. Tar da candidata:
SHA256 894349eaf11210e9e74a47e89f9850fc472b22a20da6b8372d9d0c76a85339b6.

Pré-publicação: backup privado etiquetas-pedidos-inline-20261001-01, 13.010.643
bytes, SHA256 4e9ed033f33c0be0c08d61fa1f5a6b82b8261f688f2868fba982c8cca296375c,
índice e leitura completa pg_restore aprovados; imagem anterior preservada em
`grazing-pedidos-anterior:20261001-inline-01`, configuração fiscal/certificado no
banco preservados. Nenhuma operação comercial/fiscal/financeira foi executada.

**Integração final com 8ab9fed:** atualização publicada de slots preservada; conflito
somente documental resolvido mantendo ambos os registros. Cinco arquivos afetados
passaram com 48/48 testes em contêiner sem rede/banco, Node 22.23.3; lint:design
8 bases/257 consumidores aprovado. Duas seleções do teste remoto de horários agora
aguardam a opção aparecer (findByRole), conservando a mesma opção e asserções.
Build Docker integrado com o Dockerfile oficial, Webpack e TypeScript aprovado.
Aplicação candidata iniciada por npm start, contêiner rede none, sem DATABASE_URL,
segredo exclusivamente fictício: login 200 e Novo Pedido sem sessão 307 para login
no hostname de Pedidos. Contêiner encerrado após o smoke. Sem persistência real
nessa rodada, pois serviços e schema não mudaram; não se apresenta preview ou mocks
como integração com banco. Regras e efeitos comerciais/financeiros preservados.

Backup vigente depois da atualização de slots: etiquetas-pedidos-inline-20261001-02,
13.010.643 bytes, SHA256 e09c5ab2088014dd71b1a180a5e385f9f5aafe830efefe0cbe7b987d816e8bb3,
índice e leitura integral aprovados, imagem anterior preservada em
`grazing-pedidos-anterior:20261001-inline-02`, certificado com origem no banco.
O -01 permanece como evidência anterior, não é a imagem imediatamente anterior à
publicação integrada. Logs/artefatos fictícios da validação isolada na VPS são
privados. Nenhuma conexão de teste ao banco operacional ou operação real.

**Revisão definitiva:** commits remotos ec8215f/43477cd/32b88e2 incorporados sem
conflito de código, preservando a edição fiscal e componentes compartilhados já
publicados. Candidata funcional 45a87da41812687043feb4de2f1849b748c05f43:
428/428 testes executados em 37 arquivos; 60 opt-ins com banco continuam desativados
(3 arquivos). ESLint focado e lint:design 8 bases/257 consumidores aprovados.
Build completo Docker/Node 22/Webpack/TypeScript aprovado; imagem candidata privada
`grazing-pedidos-candidata:20261001-inline-final`. Smoke final sem rede/banco:
login 200, Novo Pedido sem sessão 307; contêiner fictício encerrado. Alterações
seguintes neste registro são documentais, sem mudança de código executável.

Recuperação imediatamente antes do envio: backup privado vigente
`etiquetas-pedidos-inline-20261001-03`, 13.010.643 bytes,
SHA256 9e8b250b6dedd3ccdefda77d23fd1d0730aede357f192ae84f7a19311ec09121,
leitura integral/indexação aprovadas. Imagem imediatamente anterior preservada em
`grazing-pedidos-anterior:20261001-inline-03`, configuração fiscal e certificado
no banco mantidos. Registros -01/-02 são evidências anteriores. Publicação autorizada
pelo usuário; não autoriza operações reais para smoke nem encerra os bloqueios do
modo financeiro HUB, integrações/homologações bancárias/fiscais ou competência.

**Última integração de navegação:** 3f119a8 incorporado em f75616f, preservando
o acesso ao Gestor pelo atalho externo. Os quatro consumidores afetados passaram
com 44/44 testes em Linux isolado, sem rede/banco: entrada-vendas, entradas,
pedidos-interface e pedidos-gestor-interface. A bateria de domínio imediatamente
anterior permanece com 428 aprovados/60 opt-ins desativados. Nenhuma mudança
funcional própria foi feita durante essa integração.

Backup anterior atualizado após a publicação remota de 3f119a8:
`etiquetas-pedidos-inline-20261001-04`, 13.010.643 bytes,
SHA256 cf42cf2dac1b4c669b36f04314fe8bc4b887315a9bd4467ac72df449726a7f4e;
índice e leitura integral aprovados, imagem
`grazing-pedidos-anterior:20261001-inline-04` preservada. As evidências anteriores
permanecem no registro; nenhuma restauração de banco foi realizada.

Imagem final de f75616f: `grazing-pedidos-candidata:20261001-inline-publicacao`,
Dockerfile oficial/Node 22/Webpack/TypeScript aprovados. Smoke compilado em
contêiner sem rede/banco: login 200 e Novo Pedido sem sessão 307 para login.
Contêiner encerrado após a conferência. Esta atualização do registro não altera
código executável e não exige repetir o mesmo build.

**Publicação efetiva — 01/10/2026:** push fast-forward autorizado de
53dfbd87b6affdbf430aeaf83d95e8d2a51edbfb; webhook/Dockerfile oficial aprovados.
Checkout publicado conferido nesse commit; tarefa `infaydoelbdf`, contêiner
`84104fd7049a`, início 03:53:24 UTC, Running por mais de quatro minutos,
zero reinícios. Imagem publicada
`sha256:ad2f125cf1683d0faf7be58d1ee16fe087452b9a387e9e0eb644dc6c9d50ffbe`.
Prisma migrate status: exit 0, 79 migrations, schema atualizado; nenhuma migration
nova nesta alteração. HTTPS: login 200 e Novo Pedido sem sessão 307.

A revisão automática bloqueou o modo restaurar porque poderia alterar configuração
de produção. Substituído por inspeção estritamente somente leitura: configuração
fiscal integralmente preservada, origem do certificado banco; nada reaplicado.
Nenhuma pendência desse passo permanece e nenhum dump foi restaurado.

Navegador autenticado em pedidos.grazinghub.com.br: Gestor → Novo Pedido abriu
um único diálogo; Cliente/Cobrança/Entrega/Pedido e campos pessoais presentes;
controles de origem externa, códigos, atendimento/estabelecimento e prazo ausentes.
Novo cliente (+) manteve um diálogo; preenchimento exclusivamente fictício local,
Fechar exibiu aviso inline; Continuar preservou o texto e Sair sem salvar descartou
e retornou ao Gestor, zero diálogos. Nenhum cliente/pedido/pagamento foi persistido
em produção para testes. Captura de produção pelo Chrome excedeu o prazo da API;
evidência visual salva é a prévia isolada fictícia, não uma captura de produção.
Conferência de autofill/persistência de payload continua comprovada pelos testes
focados e preview sintético, sem apresentar mocks como banco integrado.

Registro pós-deploy mantido localmente para não disparar nova publicação só por
documentação. As limitações contábeis, financeiras e externas anteriormente
registradas não foram alteradas por esta entrega de interface.

### Gestor — cadastro, canais e pagamento comercial, 01/10/2026

Escopo: títulos externos, Dados Cadastrais, Cliente/limpar, países pesquisáveis,
CPF/CNPJ numéricos e e-mail validado, cadastro novo junto do orçamento sem botão
separado. Site azul, iFood vermelho e GF roxo conforme resposta do usuário. Linhas
compactas com preço somente leitura/tag autorizada, adicionar após os itens e
rótulos solicitados. Formas ativas de Vendas; boleto com parcelas e datas explícitas.
Snapshot comercial aditivo, sem cobrança/recebimento automático. Regras financeiras
e pendências externas preservadas; melhorias Entregas/Fiscal incorporadas da base.
Publicação autorizada pelo usuário, condicionada às validações abaixo.

**Validação local concluída (publicação ainda pendente):** base origin/main
`dc0ad92` incorporada em `061dcca`, implementação inicial `8bc72e8`.
Node efetivamente usado: 22.23.3; Next 16.3.4, React 19.2.8, Prisma 7.10.0,
lockfile preservado. Sem atualização de dependências ou mudança de compilador.

- Regressão Vendas/Central/permissões: 541 aprovados em 58 arquivos; 90 opt-ins
  ignorados em seis arquivos. Três opt-ins afetados executados separadamente:
  Pedidos M1 25/25, M2 financeiro 18/18 e Vendas 20/20 (63 no total). A rodada
  final M1 passou 25/25 após corrigir CPF repetido na fixture, sem mudar guardas.
- Primeira tentativa de integração usou nome de banco fora do padrão teste_; a
  guarda bloqueou corretamente o modo HUB. Selecionado novo banco fictício com
  nome admitido; nenhum teste foi aprovado com a guarda relaxada.
- Após ajuste de alinhamento: 49 testes UI/Central aprovados (7 opt-ins distintos
  ignorados); título de frete externo e consumidores: 14/14. ESLint focado,
  TypeScript e lint:design aprovados (8 bases/270 consumidores TSX). Prisma
  generate e todas as 81 migrations aplicadas no banco fictício, incluindo a
  nova coluna JSON comercial. Warning pré-existente de pg query concorrente
  e de convenção middleware do Next, sem mudanças fora do escopo.
- Build previsto Webpack aprovado em Node 22.23.3 na revisão final com título
  de frete externo. Não atribuir causa/correção à ocorrência histórica WasmHash.
  Validação específica do Dockerfile antes desta publicação permanece pendente.

Banco novo exclusivo: cluster em .tmp-form-pgdata no worktree, PostgreSQL 17.11,
127.0.0.1:55437/teste_pedidos_form_20261001, somente dados fictícios; processos
de testes e aplicação recebem esta URL explicitamente, sem .env operacional.
Schemas temporários dos opt-ins são removidos pelos próprios testes.

Smoke HTTP da aplicação compilada: login real por Server Action com usuário
fictício, sessão válida, Novo Pedido 200 e sem sessão 307; criação do orçamento
com cliente novo + repetição da mesma chave, confirmação e recarga 200. Inspeção:
1 cliente, 1 pedido confirmado, snapshot de boleto 2x/datas explícitas, 0 títulos
e 0 movimentos bancários. Transporte exclusivamente loopback com Host dedicado;
nenhum redirect externo seguido e nenhuma credencial operacional usada. A revisão
final visual recompilada foi iniciada em NODE_ENV=production; login/acesso/recarga
e título externo de frete reconferidos somente leitura.

Navegador: prévia Vite sintética, um Dialog, seleção/limpeza de cliente, canais e
cores, tag de preço, parcelamento e datas de boleto independentes da entrega.
Desktop e 390x844 sem overflow horizontal (documento=390). Imagens em área local
de visualizações: pedido-cadastro-ajustado.png, pedido-itens-ajustados.png e
pedido-cadastro-mobile.png. A prévia simula fronteiras, não prova persistência;
a persistência é comprovada pelos opt-ins e pelo smoke HTTP compilado acima.
O navegador não abriu o host local da aplicação compilada (ERR_BLOCKED_BY_CLIENT);
não se apresenta a prévia como validação visual de produção.

A revisão automática rejeitou enviar o arquivo de código da candidata para
179.199.142.19 por exigir autorização explícita de destino/payload. Necessidade
apresentada ao usuário numa única pergunta; envio e build isolado na VPS não
executados. Sem push, deploy ou migration operacional desta revisão. Depois da
autorização pendente: revalidar base remota, Dockerfile oficial, backup privado
e imagem/configuração imediatamente anteriores, publicação fast-forward e smoke
HTTPS/autenticado somente leitura conforme docs/contexto/deploy.md. Migration
é aditiva e compatível com o código anterior; recuperação nunca sobrescreve
transações novas com dump. Aprovações/configurações contábeis, bancárias, fiscais
e demais limites existentes não foram inventados nem ativados por esta entrega.

Encerramento do ensaio: servidores locais nas portas 4235/4237 e cluster fictício
55437 encerrados; tabs temporárias fechadas. Fixture permanece local e não operacional.
Código final preservado em c51b552; nenhuma alteração rastreada restante no worktree.

## Gestor compacto — candidata de 01/10/2026

Base origin/main 53dfbd8, branch codex/pedidos-layout-compacto. Escopo visual:
shell exclusivo de Pedidos sem lateral, header fino/marca separada, toolbar única
responsiva, busca arredondada automática, filtros ancorados e seletor de visualização,
cartões resumidos com canal e Para: destinatário. HUB/Etiquetas preservados.
Componentes compartilhados: Popover Base UI, CampoBusca formato arredondado,
BarraAcoes variante compacta e TagCanalVenda. Contratos/demonstração/catalogação
na Central, **Em revisão visual**. Nenhum novo token editável ou mudança de domínio.
Integração com origin/main 62594e9 em 0e96b66 preservou Entregas e os ajustes
fiscais publicados; 82412eb acrescentou os testes do consumidor. Validação final
com Node 22: 26/26 testes focados de interface/domínio, 150/150 de layout/hosts e
14/14 da Central durante desenvolvimento. A bateria completa integrada executou
221 arquivos: 1.559 testes aprovados, 295 testes ignorados e cinco falhas prévias.
As duas falhas de `cadastros/status-listas` procuram placeholder antigo; as três
de `inventario/perdas-interface` usam fixtures de setembro fora do filtro padrão
de outubro. Ambas reproduzidas sem alteração na baseline 62594e9 e na candidata;
não são declaradas aprovadas nem foram modificadas fora deste escopo.

ESLint dos arquivos alterados, lint:design (8 bases/269 consumidores), TypeScript,
build Webpack e diffcheck aprovados. Smoke compilado sem sessão/banco: 6/6 GETs,
login 200 e proteção 307 dos três modos, Vendas e Etiquetas no respectivo host.
Prévia isolada com dados fictícios: busca/foco, seletor, resumo, filtros ancorados,
temas claro/escuro e medidas de reflow móvel; quatro colunas com largura igual.
Novos padrões permanecem **Em revisão visual** até aprovação humana.

Última integração: origin/main dc0ad92 (ordenação fiscal) incorporado em 1f10dee,
sem conflito de código ou alteração dos componentes do Gestor. Regressão de impacto
com Gestor/domínio, Vínculos fiscais e Central: 54/54 testes em cinco arquivos.
Build completo, TypeScript, ESLint do impacto novo e lint:design novamente aprovados.

Recuperação imediatamente anterior ao envio: backup privado
`etiquetas-pedidos-compacto-20261001-02`, 13.014.696 bytes, índice/leitura integral
aprovados, SHA256 a57b513da716357848cc46bb0b203c4bacfa8b1300096f4b5e48772cbe7bc859.
Imagem anterior preservada em `grazing-pedidos-anterior:20261001-compacto-02`;
o backup/tag -01 preserva a evidência anterior de 62594e9. Configuração fiscal
com certificado no banco, sem env/mount de fallback. Publicação autorizada pelo
usuário; evidência de estabilidade/HTTPS pós-publicação será guardada no registro
privado sem outro deploy apenas para documentação. Nenhuma mudança de schema ou
operação real foi feita para testar este incremento.

### Publicação do formulário comercial — retomada autorizada, 01/10/2026

Usuário autorizou prosseguir após a explicação do bloqueio automático. Envio
da candidata à VPS existente autorizado e executado, sem .env/credenciais/dados
reais. Base origin/main 755c104 integrada em 66cbde9; conflitos do catálogo e
documentos conciliados preservando Gestor compacto, controles e ambos os históricos.
Nenhum serviço comercial/financeiro foi alterado durante esta integração.

Revisão integrada: 597 testes aprovados em 66 arquivos, 90 opt-ins ignorados em
6 arquivos (três opt-ins de domínio já executados 63/63 na rodada anterior).
TypeScript, ESLint dos arquivos conciliados e lint:design (8 bases/272 consumidores)
aprovados. Dockerfile oficial Node 22/Webpack aprovado; imagem privada candidata
grazing-pedidos-candidata:20261001-form-publicacao. Smoke compilado em contêiner
network=none, sem DATABASE_URL: login 200, Novo Pedido sem sessão 307; contêiner
encerrado. Evidência isolada anterior com persistência fictícia continua válida
para os serviços inalterados. Ocorrência histórica WasmHash permanece sem causa
comprovada; build aprovado não é diagnóstico/correção daquela ocorrência.

Recuperação pré-publicação: backup privado etiquetas-pedidos-form-20261001-01,
13.122.613 bytes, SHA256 7ed6d92c780aafe8ffcecedaf8e6bc05a8266cf0042a811c4788077354e32ed9.
Índice e leitura integral aprovados. Imagem imediatamente anterior preservada
em grazing-pedidos-anterior:20261001-form-01. Configuração fiscal capturada e
preservada, certificado no banco. Migration nova é aditiva/nullable, sem alterar
registros existentes; código anterior permanece compatível com a coluna extra.
Restaurar dump sobre transações novas não faz parte do procedimento.

Autorização para publicação não autoriza cobrança, notas, testes com dados reais
ou ativação do modo financeiro HUB e de políticas pendentes. Estabilidade,
migration status, HTTPS e UI autenticada somente leitura serão registrados
após a publicação, sem novo deploy apenas para documentação.

#### Evidência pós-publicação — 01/10/2026

Publicado o commit `0fd0396f3a702a8a57799a6e65f11a07755d2749` por push
fast-forward autorizado. Checkout Dokploy confirmado nesse commit; Dockerfile
oficial Node 22/Webpack concluído. Imagem publicada
`sha256:29bad57b0bbca9838e12a698a7115334dc1430e741c0696a34374b53af6e0237`.
Tarefa nova `p2iohwo3itlyyd2luksrcoumo`, contêiner `8c088bbbd7ce`, iniciada
às 14:09:26 UTC, permaneceu Running por mais de quatro minutos, sem reinícios.
Tarefa anterior encerrada normalmente durante a atualização.

Partida aplicou a migration aditiva pelo procedimento oficial. Conferência
somente leitura: `prisma migrate status` exit 0, 81 migrations, schema atualizado.
Configuração fiscal/env/mount corresponde ao snapshot anterior, certificado no
banco; nenhuma reaplicação de configuração foi necessária. HTTPS: login 200 e
Novo Pedido sem sessão 307. Backup e imagem anteriores continuam preservados.

Chrome com sessão existente: acesso autorizado ao Gestor e formulário novo;
abertura pelo Gestor apresentou exatamente um Dialog. Dados Cadastrais,
Cobrança, Entrega, Pedido e Frete com títulos externos; Cliente com limpeza,
País como combobox, ausência dos botões de criação/salvamento separado de cliente,
novos rótulos de desconto, pagamento, total, orçamento e confirmação presentes.
Seleção dos canais confirmada por estado aria-pressed e cor calculada: Site azul,
iFood vermelho e GF roxo. Fechamento com alterações mostra confirmação no próprio
Dialog; descarte encerrou o Dialog, sem salvar cliente ou pedido. Nenhuma cobrança,
operação financeira, emissão fiscal ou teste de persistência real em produção.
Persistência/idempotência permanecem demonstradas no banco fictício da validação
anterior. Imagem local do formulário publicado vazio: `pedido-publicado.png` na
área de visualizações; captura recortada do popup teve timeout, sem ser apresentada
como evidência aprovada. Captura da rota direta vazia concluída.

Evidência pós-publicação registrada localmente, sem novo push/deploy documental.
Este resultado não ativa o financeiro HUB nem resolve políticas contábeis,
configurações bancárias, homologações fiscais ou outros bloqueios preexistentes.

### Marca do Gestor com vidro — 01/10/2026

Solicitação e referência visual do usuário: vidro verde escuro, ícone mais escuro,
Grazing Pedidos branco e by Grazing Table & Co cinza, sem cápsula. Ajuste localizado
em CabecalhoConteudo e CSS da marca dedicada. Reutiliza LogoMark e o acabamento
oficial do menu (paleta verde existente, gradiente/opacidade 86%, blur 32px,
borda/sombra e fallback opaco), preservando a especificidade dos seletores do
HUB/Etiquetas com `:where`. Geometria, navegação e regras comerciais preservadas;
sem schema, migration ou nova variante de componente. Contrato DS-PED-COMPACTO-01
atualizado na Central, sem duplicar especificação.

Base origin/main 0fd0396, worktree/branch pedidos-operacao-agenda; alterações
alheias do checkout principal preservadas. Node 22.23.3, lockfile/Next 16.3.4
inalterados. Layout/Central: 86 testes aprovados, 7 opt-ins ignorados. ESLint,
TypeScript, lint:design (8 bases/272 consumidores), diffcheck e build Webpack
aprovados. Smoke compilado local em loopback, sem DATABASE_URL/.env operacional:
login 200 e Novo Pedido sem sessão 307. Processo encerrado.

Bateria completa: 1.566 aprovações, 298 ignorados, oito falhas. Três foram timeouts
de 5s durante execução concorrente com o build. Reexecução somente dos quatro
arquivos envolvidos, sem concorrência e sem relaxar limites: 188 aprovações e
cinco falhas. Timeouts não reapareceram; as cinco restantes são as duas expectativas
antigas de placeholder em cadastros/status-listas e as três fixtures de setembro
fora do filtro de outubro em inventario/perdas-interface, já reproduzidas/documentadas
na rodada do Gestor compacto. Arquivos e consumidores desses casos permanecem
inalterados ante 0fd0396. Bateria geral não é declarada integralmente verde.

Prévia isolada com dados fictícios: título branco, subtítulo branco a 72% (cinza
composto), ícone rgb(9 31 18), vidro da paleta verde e blur/saturação confirmados
por estilo calculado e imagens dos temas claro/escuro. Evidências locais
marca-pedidos-claro.png e marca-pedidos-escuro.png; servidor/aba encerrados.

Publicação autorizada pelo usuário. Recuperação: imagem imediatamente anterior
preservada em grazing-pedidos-anterior:20261001-marca-01, snapshot privado
etiquetas-pedidos-marca-20261001-01, configuração fiscal conferida sem alterações.
Sem mudança de banco; backup integral validado da rodada anterior permanece
preservado. Estabilidade/HTTPS/UI serão registrados após publicação, sem novo
deploy apenas para evidências.

Pós-publicação da marca: commit `ef0c9edc493ea89ceecc3bedf49191ede50bd238`
confirmado no checkout Dokploy; Dockerfile oficial Node 22/Webpack aprovado.
Imagem `sha256:894e56ee996550a407aed658a9ce999fa3967f8333e9c49f51da244aa085b925`.
Tarefa `rszt88cb8iod80d0xeskjsyf1`, contêiner `373afa15bbdc`, iniciado
15:04:48 UTC, mesma tarefa Running/zero reinícios conferida até 15:07:52 UTC.
Configuração fiscal preservada, certificado no banco. Status de migrations
exit 0/schema atualizado com as mesmas 81 migrations; nenhuma migration nova.
HTTPS login 200 e Novo Pedido sem sessão 307. Chrome autenticado na rota vazia:
estilos calculados correspondem à prévia — gradiente verde/transparência 86%,
blur 32px/saturação 160%, ícone rgb(9 31 18), título branco e subtítulo branco
a 72%, fundo do subtítulo transparente. Evidência `marca-pedidos-publicada.png`
na área local de visualizações; captura integral concluída após timeout da
captura recortada do Chrome. Sem gravar pedidos/clientes ou operar dados para
teste; aba temporária encerrada. Registro pós-publicação somente local,
sem outro push/deploy documental. Regras e bloqueios de operação anteriores
permanecem preservados.

## Canal imediato, status e popups — candidata de 01/10/2026

Incremento iniciado sobre a marca publicada em 755c104 e integrado com o formulário
comercial de 0fd0396: popup do Gestor oferece somente canal, com check e aplicação
imediatos. FiltroCanalVenda é controlado e reutiliza Popover/Checkbox, permanece
aberto, permite remover e preserva selecionado fora do catálogo. O consumidor
protege busca, canal e modo contra respostas anteriores. SeletorVisualizacaoOperacional
muda só a cor do gatilho; status e disposição das três visualizações preservados.
Destaque tipográfico de identificação reutiliza text-title/text-sm/font-semibold.
Contratos/catalogação/demonstração na Central, Em revisão. Sem schema próprio,
multisseleção, operações reais de teste ou concessões de acesso.

Detalhe, Novo, histórico e comanda reutilizam ModalPedido com retorno validado à
mesma visualização/filtros/página. ShellPopupsPedidos lê o slot no layout e
PopupDiretoPedido suprime o fallback quando há interceptação, mantendo o fundo.
Preparação/entrega e prontidão deixam de ser destinos no host Pedidos. Ocorrências
e reagendamento permanecem no detalhe com proteção granular de alterações.
O usuário autorizou confirmação integral da preparação ao marcar Pronto e da
expedição ao marcar Em rota; uma transação registra os restantes, uma revisão e
auditoria por item, sem criar consumo físico ou flexibilizar suas guardas.

Durante desenvolvimento: 25/25 testes do Gestor, oito de FiltroCanalVenda, 48 dos
consumidores de popup/editor/servidor e 25 M1 + 18 M2 em banco local fictício.
Prévia Next real isolada sem banco/auth/Server Actions confirmou acesso direto
Novo→detalhe, Gestão→filtro/recarregamento/Novo, detalhe alterado→comanda com aviso
inline e retorno preservado, sempre um dialog aberto ou zero após fechar. A fixture
foi preservada fora do tsconfig do produto e seu servidor encerrado. Validação
final integrada e recuperação são registradas após execução, antes do envio.

#### Integração com a base publicada — 01/10/2026

Fonte congelada em `18a225144bc8b2dc3e924ccbdb481a4ad3588025`, incorporando
`e9177bb59b287bf5ccc5e85bd8ffc4c0f5f97087`. Preservados o vidro verde da marca,
o formulário comercial e o incremento de embalagens/veículos de Entregas.
Os conflitos de editor/frete mantêm a proteção de alterações do popup, a seleção
de veículo por embalagem e os snapshots comerciais. A remoção oficial com X
permanece dentro do Badge de filtro, com rótulo/valor visíveis fora do botão.
CampoBusca declara 160 caracteres, conforme limite já existente no servidor.

Schema/client 82 validados/regenerados; sem migration própria neste incremento.
Em banco localhost efêmero fictício, M1 28/28, M2 18/18 e Entregas 9/9: 55/55.
Provedores de mapa injetados/sintéticos; banco removido ao concluir. Editor/popup/
frete: 31/31 em seis consumidores. Central/componentes/Gestor: 89/89 aprovados e
sete opt-ins ignorados; lint:design aprovado com oito bases/294 consumidores.
Não somar execuções sobrepostas ao total da bateria geral.

Prévia isolada final confirma quatro colunas preservadas, destaque de identificação,
marca verde, canal com check/aplicação imediatos e nome do filtro junto ao X.
Calendário azul e Lista violeta confirmados por estilo calculado somente no gatilho.
Imagens fictícias locais `gestor-final-quadros.png` e `gestor-final-filtro.png`;
aba/servidor encerrados. Nenhum pedido real foi alterado ou impresso.

Recuperação imediatamente anterior à candidata: snapshot privado
`etiquetas-pedidos-status-simples-20261001-02`, dump 13.125.451 bytes,
SHA256 `4fe4acca4e0ac1931558d8554df8b08cc35eec6fbeda05e70807930e3fd4d5ff`.
Índice e leitura integral aprovados, acesso privado root. Imagem anterior
`sha256:fcf7f871e6be4036a367e721506c572c2ff39b6f333cba0e0f2bd67f9a46db78`
preservada em `grazing-pedidos-anterior:20261001-status-simples-02`.
Configuração fiscal preservada, certificado no banco/env zero/mount zero;
banco contínuo, sem restauração ou alteração de serviço durante a preparação.
Snapshot 01 sobre 0fd0396 permanece histórico; não confundir com a imagem atual.

#### Validação C da fonte final — 01/10/2026

Node 22.23.3, dependências/lockfile preservados. ESLint global aprovado, excluindo
somente artefatos privados work/.cache; TypeScript separado aprovado. Build oficial
Webpack aprovado, incluindo TypeScript integrado e rotas interceptadas/diretas;
BUILD_ID `RnigSjDvhp8tBp36MZNei`. Aviso preexistente de middleware depreciado mantido
sem refatoração fora do escopo. Smoke compilado local fictício 10/10: login 200,
três modos, HUB Vendas/Etiquetas e quatro rotas de popup sem sessão 307 para login.
Servidor encerrado; sem banco, sessão ou operação comercial real.

Bateria final sobre 18a2251: inventário de 230 arquivos integralmente coberto.
Primeira etapa em threads/um worker terminou por interrupção nativa do Node
0xC0000005 após 18 arquivos concluídos, sem footer/JSON final. Não afirmar causa
ou aprovação dessa execução interrompida. Seis falhas então observadas: as cinco
preexistentes e uma de Horários, sem stack recuperável. Horários passou 6/6 isolado
sem alteração de fonte; não houve regressão reproduzível nesse consumidor.
Continuação executou somente os 212 restantes em forks/um worker: 189 arquivos
aprovados, 23 opt-ins ignorados; 1.287 testes aprovados, 302 ignorados, exit 0,
sem falhas/erros de worker. JSON confrontado com inventário: zero faltantes/extras.

Resultados únicos considerando a repetição completa de Horários: 1.631 aprovados,
cinco falhas preexistentes e 302 ignorados, total 1.938. As cinco são duas
expectativas antigas de placeholder em cadastros/status-listas e três fixtures de
setembro fora do filtro de outubro em inventario/perdas-interface, já reproduzidas
na base e sem edição nesses arquivos. Bateria geral não é declarada toda verde.
Logs, inventário e JSON privados preservam a execução dividida e o diagnóstico;
repetições anteriores não são somadas aos resultados únicos.

Publicação autorizada pelo usuário, por push fast-forward após conferir novamente
origin/main em e9177bb. Estabilidade, configuração fiscal, 82 migrations, HTTPS e
UI autenticada sem alterar pedidos serão conferidos após envio. Registrar evidência
localmente, sem novo deploy apenas para documentação.

## Novo Pedido — endereço, alinhamento e saída, 01/10/2026

Escopo solicitado: campos brasileiros derivados de CEP somente leitura; exterior
manual obrigatório (resposta do usuário); Modo Entrega/Retirada com endereço oculto
e não enviado na retirada; Nome/Sobrenome/Telefone; cópia discreta somente do endereço
de cobrança; Qtd. com unidade fixa; alinhamento dos controles pelo topo.
Reutilizados Input, Campo, Combobox, Select, Button, InputComSufixo e tokens oficiais.
A confirmação de descarte do Dialog passou a usar o mesmo aviso no próprio painel
de Pedidos, sem nova janela sobreposta. Mantidos foco, edição, salvamento explícito,
retorno do Gestor, detecção independente por formulário e fechamento de seletores.
Não foram enviados dados operacionais nem alteradas regras financeiras/migrations.
Os prints de desalinhamento mencionados não foram anexados; a conferência usa a
prévia isolada responsiva do formulário real com fixtures sintéticas.
Validação da candidata integrada a origin/main 0bc064b (vidro e CSS otimizados
preservados): lint global, lint:design, tsc --noEmit e build Webpack aprovados no
Node 22.23.3 / Next 16.3.4, sem alterações de dependências/compilador/Dockerfile.
O primeiro typecheck encontrou um dado fictício com propriedade CEP fora do contrato
e tipos gerados de rota já removida; corrigida a fixture e regeneradas somente as
pastas geradas .next/types e .next/dev/types via next typegen. Build antes da
integração também passou. Tentativa adicional durante a compilação integrada foi
recusada pela trava do Next; a execução original terminou com exit 0.
Não houve reprodução de WasmHash nem diagnóstico/correção de sua causa histórica.

230 arquivos do inventário cobertos, zero faltantes/extras: 1.642 testes aprovados,
cinco falhas preexistentes e 302 opt-ins ignorados (1.949 únicos). Execuções amplas
sem footer/JSON foram continuadas apenas nos arquivos restantes em 11 blocos;
interrupções não são declaradas aprovadas nem têm causa presumida. JSON e logs
locais consolidam resultados únicos, incluindo a repetição focada final de cinco
arquivos/44 testes aprovados após a integração. Falhas mantidas: status-listas (2,
placeholder antigo Buscar insumo...) e perdas-interface (3, fixtures de setembro
fora do filtro de outubro), já registradas na base, sem edição desses consumidores.

Navegador com formulário real e fixtures isoladas: CEP automático/somente leitura,
cópia somente do endereço sem mudar destinatário, Retirada sem campos de endereço,
alinhamento desktop e 390x844, quantidade com unidade fixa, saída/continuar sem
janela sobreposta. Imagens locais preservadas; referências continuam Em revisão.
A combinação com o vidro foi reconferida no navegador após a integração.

Aplicação compilada iniciada com next start no loopback 127.0.0.1:4239; aplicação,
Prisma e auxiliares apontaram exclusivamente para PostgreSQL fictício
127.0.0.1:55449/teste_pedidos_campos_20261001, usuário pedidos_ficticios. As 82
migrations existentes foram aplicadas somente nessa base nova. Ensaio de Host em
127.0.0.1:4240 encaminha somente ao app local, sem destinos externos, mantendo
sessão e checagem de origem. Login fictício no navegador e quatro asserções da
interface hidratada aprovados. A verificação inicial no HTML sem hidratação
falhou; substituída por verificação dos mesmos rótulos realmente visíveis no
navegador, sem dispensar asserções. Revisão automática rejeitou a tentativa de
substituir asserções por logs; essa alternativa não foi executada.

Smoke HTTP compilado exit 0: login 200, acesso 200, sem sessão 307, orçamento
RETIRADA salvo e recarregado (200), endereço null/frete zero; mesma chave retorna
o mesmo pedido. Inspeção: um cliente fictício, um pedido RASCUNHO, zero títulos e
zero movimentos bancários. Nenhuma confirmação comercial ou operação real no ensaio.

Publicação novamente autorizada pelo usuário ao finalizar. Imagem anterior e
configuração privada preservadas em etiquetas-pedidos-campos-20261001-02; tag
grazing-pedidos-anterior:20261001-campos-02. Nenhuma migration nova neste incremento.
Push fast-forward e estabilidade/HTTPS/configuração serão registrados após envio;
não gerar outro deploy apenas para evidência documental.

Publicação concluída: commit c7efb85af490684a7dd51f1591442de87b0bcf43 enviado por
fast-forward sobre 0bc064b. Build oficial Docker/Webpack aprovado, Node 22.23.3 e
Next 16.3.4 efetivamente verificados no contêiner 0d9a54b4c37d, imagem
sha256:3d284bf48870af507f723f6a4725616bbfc415bb0f58325fc53411a8fe0ca0d3.
Tarefa zma74zw37pqc Running, mesma instância observada por 257 segundos, zero
reinícios. Env e mounts idênticos ao snapshot privado; nenhuma reaplicação de
configuração fiscal. Prisma migrate status exit 0, 82 migrations/schema em dia.
HTTPS login 200 e Novo Pedido sem sessão 307.

Chrome autenticado: popup vazio carregado, oito campos brasileiros derivados
somente leitura (cobrança/entrega), Modo e rótulos corretos; Retirada oculta endereço
e deixa apenas o País da cobrança. Clique externo mostra confirmação no mesmo
painel (um diálogo); continuar conserva Retirada. Nenhum formulário foi salvo em
produção, nem houve consulta de CEP/mapas, pagamento ou confirmação comercial.
Auxiliares locais do ensaio encerrados, cluster fictício parado após conferir
PID/caminho/porta, fixtures preservadas. Alterações alheias da raiz permanecem.
Evidência pós-publicação registrada localmente, sem segundo push/deploy documental.
## Chave de estoque do Gestor — 01/10/2026

Usuário autorizou chave inicialmente desligada, baixa automática quando ligada,
saldo negativo e publicação ao concluir. OFF controla etapas sem ficha/reserva/baixa;
ON consome montagem em Pronto e revenda em Em rota. Administrador escolhe explicitamente
o local ativo e salva no popup. Não há baixa retroativa, duplicação ao voltar/avançar
nem alteração de financeiro/fiscal. Contrato e cuidados ficam em
[ARQUITETURA](ARQUITETURA.md#chave-de-estoque-do-gestor--01102026).

Central reutilizada: Button ghost/icon-sm, GrupoAcoes, Dialog, StatusAtivo, Label,
Select/SelectItem e confirmação de descarte oficial. A extensão opcional `Dialog alterado`
cobre campos controlados/em portal sem alterar consumidores que omitem a propriedade;
documentada em padrões/inventário, composição Em revisão. Preservadas as publicações
de vidro/CSS e Novo Pedido até origin/main c7efb85, incluindo o aviso no mesmo painel.
O escopo da chave não acrescenta migration ou dependência.

Integrações isoladas aprovadas: 109 testes em seis arquivos (M1, M2, Entregas,
perdas, entrada avulsa e cancelamento de contagem), com flags explícitas e banco
temporário fictício `teste_gestor_chave_*` em localhost removido ao terminar.
Casos incluem negativo Decimal, reserva alheia, consumo prévio, liberação parcial/total
de componente sem repetir outro, fotografia/local, permissão/revogação, repetição,
alternância OFF/ON/manual, ausência de retroatividade e rollback integral.
Primeiras tentativas detectaram dois erros de fixture (FK da composição de insumo
e perfil sem Visualizar); corrigidos somente nos dados fictícios, sem relaxar guardas.

A rodada UI anterior à integração teve timeouts sob pressão de memória; não é
declarada aprovada. Bateria final usa Node 22.23.3, forks e um worker, heap limitado
apenas no processo de validação. Na revisão integrada, os testes novos de descarte
foram alinhados ao aviso inline atual e a ação de configuração foi incluída no
contrato de fronteiras, mantendo asserções de acesso sem tocar banco.

Recuperação privada verificada antes do envio: etiquetas-pedidos-estoque-chave-20261001-02,
dump 13.129.955 bytes, SHA256
21452c969465cca493ae797d9b0f2b1dc40f7e16213f1f6a748091b57b6c6110,
índice e leitura integral aprovados. Imagem anterior imutável
sha256:3d284bf48870af507f723f6a4725616bbfc415bb0f58325fc53411a8fe0ca0d3
preservada na tag grazing-pedidos-anterior:20261001-estoque-chave-02;
fonte fiscal banco, zero env/mount de fallback, arquivos restritos ao root.
Não houve restauração de dados ou operação fiscal.

Bateria geral antes da última integração: 233 arquivos confrontados com o inventário, zero faltantes/extras.
Resultados únicos após reteste dos três consumidores afetados: 1.677 aprovados,
cinco falhas preexistentes e 312 opt-ins ignorados (1.994 testes). Reteste 180/180;
sem ampliar timeouts ou alterar configuração global. Falhas mantidas: status-listas
(2, placeholder antigo Buscar insumo...) e perdas-interface (3, fixtures de setembro
fora do filtro de outubro); mesmos erros já documentados na base e arquivos intactos.
Não declarar a suíte geral toda verde, nem somar repetição aos resultados únicos.

lint:design aprovado (8 bases, 295 consumidores). Prévia real com fixtures sintéticas:
OFF, ON exigindo local explícito, aviso negativo/sem retroatividade, Salvar simulado,
valor preservado ao reabrir, Cancelar/Continuar dentro do mesmo popup. Imagens locais
preservadas e Vite 4355 encerrado. Nenhuma operação ou configuração real usada nesse
ensaio; referências continuam Em revisão.

Integração final de origin/main 927d8c3 preserva Clientes e sua migration aditiva
já publicada. Prisma validate/generate aprovados; 83 migrations aplicadas somente
na base nova de integração. Pedidos M1/M2 e regras de Clientes: 65/65 aprovados,
banco fictício removido. Domínio completo Vendas/fronteiras: 632 aprovados e 94
opt-ins ignorados em 61 arquivos; os opt-ins citados acima foram executados
separadamente. Consolidação com a bateria geral e reteste, por arquivo e sem somar
repetições: 239 arquivos, zero faltantes/extras, 1.735 aprovados, as mesmas cinco
falhas preexistentes e 321 ignorados. lint:design integrado: 8 bases/298 consumidores.
Typecheck inicial encontrou duas asserções acessando propriedade além do tipo
inferido do pedido; asserções conservaram a mesma verificação de status, usando
toMatchObject. Nenhuma regra de produção ou guarda foi relaxada.

Recuperação imediatamente anterior atualizada sem sobrescrever a anterior:
etiquetas-pedidos-estoque-chave-20261001-03, fonte publicada 927d8c3, dump
13.130.623 bytes, SHA256
2706ab02857e58f535c1ec5d3b147fad817c2534ea39f8eb1ef514503d5466a4;
índice/leitura integral/acesso privado aprovados. Imagem
sha256:4972f06321062a30f0a994427f4e8ba32a5765d90d24c94bd5251fceabba6bea
na tag grazing-pedidos-anterior:20261001-estoque-chave-03. Fiscal banco e zero
env/mount preservados. Esta passa a ser a referência de recuperação da publicação.

Lint de todas as fontes/scripts/testes/configurações aprovado; na revisão integrada,
lint dos consumidores Vendas e do escopo alterado também aprovado. Diretórios
temporários/cache da prévia não compõem esse comando. tsc --noEmit da versão
integrada aprovado; git diff --check aprovado. Não houve alteração de timeout
global, dependências, compilador ou Dockerfile para obter esses resultados.

Build Webpack final aprovado na fonte 228bd63, Next 16.3.4/Node 22.23.3,
BUILD_ID nFbg361tF_71m3mJ4S4G7. Smoke compilado local 10/10 aprovado:
login 200; Quadros/Calendário/Lista, HUB Vendas, Etiquetas e quatro rotas de popup
307/login sem sessão. Ambiente reduzido com valores fictícios, sem .env real,
sem criar banco/sessão, somente GET no loopback; servidor encerrado ao concluir.
O aviso já existente de depreciação de middleware foi preservado fora do escopo.

Envio autorizado por fast-forward após reconferir origin/main em 927d8c3 e diff
limpo. A estabilidade da tarefa nova, configuração fiscal/83 migrations, HTTPS
e consulta autenticada da chave OFF serão registradas localmente após o envio,
sem outro deploy apenas para acrescentar evidência documental.

### Correção da cor do seletor em repouso — 01/10/2026

O acabamento de vidro alcançava `bg-card` do SelectTrigger e, com a mesma
especificidade e ordem posterior, deixava o fundo branco com texto branco.
A variante oficial `ds-seletor-visualizacao` agora prioriza o gatilho sólido:
Quadros verde, Calendário azul e Lista violeta. Mantém geometria e comportamento
do Select; alto contraste usa ButtonFace/ButtonText. Contrato registrado na
Central de Design, sem padrão ou token novo.

Regressão verifica fundo/texto/borda e token escolhido em todos os modos com CSS
real antes/depois do otimizador. Central e consumidor Gestor: 69 aprovados e sete
opt-ins ignorados, com reteste final de identidade 9/9 após ajuste do ambiente
JSDOM existente, sem instalar dependências. Lint focado, lint:design (8 bases,
298 consumidores), typecheck final e diff aprovados. Prévia fictícia confirmou
cores em repouso, foco pelo teclado e modo escuro; nenhum pedido real alterado.

Build Webpack aprovado, BUILD_ID H-uBdGbTDoBcPubLn7BVn. Recuperação privada
etiquetas-pedidos-seletor-cor-20261001-01: dump e leitura integral conferidos,
imagem anterior imutável preservada; fonte fiscal banco, sem env/mount de fallback.
Smoke compilado e evidência de publicação serão registrados localmente após
confirmar a revisão, sem novo deploy apenas para acrescentar resultados.

### Novo Pedido — embalagem cadastral e linha de frete — 01/10/2026

Retirado o campo de embalagem do item e do resumo comercial. Novos itens herdam
o cadastro do produto; snapshots internos anteriores permanecem preservados.
O erro de embalagem indisponível orienta corrigir o cadastro do produto.
Veículo e frete ficam juntos após os produtos e antes dos ajustes comerciais,
com a indicação selecionada e diferenças manuais sinalizadas. Detalhes,
localização e justificativas usam popup local, sem navegação para outra tela.

Reutilizados EscolhaEntrega/CampoEntrega, Select, CurrencyInput, Button, Badge
warning, Dialog com descarte/foco e ResultadoCalculoEntrega. A composição foi
registrada no padrão de formulário comercial compacto da Central, sem nova
primitiva ou token; referências visuais continuam Em revisão. Contratos de
embalagem, veículo, cálculo e permissões na [operação de Entregas](../entregas/OPERACAO.md).
A indicação usa as regras existentes de embalagem/prioridade, sem inventar
capacidade volumétrica. Cálculo automático depende de configuração ativa e dados
completos; pendência/erro/expiração não são tratados como gratuidade.

Confirmados conservam veículo, preço e motivo históricos antes de alterações;
recálculo explícito usa o veículo do recibo novo. Mudanças de entrada invalidam
recibo e aprovação de cobertura, preservando ajuste manual pertinente. O servidor
mantém autorização, precisão, assinatura, cobertura e justificativa.

Prévia real do formulário com ações simuladas confirmou posição dos campos,
indicação automática, dois avisos manuais, popup/aplicação e retorno de foco.
Viewport pequeno não apresentou transbordamento horizontal; override e servidor
Vite foram encerrados. Nenhum cliente, pedido, configuração ou mapa real usado.
Integração Entregas: 9/9 em PostgreSQL local temporário, removido ao concluir.
Bateria Vendas: 61 arquivos, resultado consolidado de 506 aprovados e 94 opt-ins
ignorados, com os nove de Entregas executados separadamente. A única falha inicial
era consulta síncrona da opção antes de abrir o Select; o harness passou a usar
abertura pelo teclado e espera pela opção, sem relaxar asserções ou timeout.
Reteste final dos seis consumidores: 58/58, incluindo os 35 cenários novos.
Lint focado, lint:design (8 bases/298 consumidores), typecheck e diff aprovados.

Build Webpack aprovado em Node 22/Next 16.3.4, BUILD_ID -q3nGaufuLJBzmYpUjmaT.
Aviso preexistente de depreciação de middleware preservado fora do escopo.
Recuperação privada etiquetas-pedidos-frete-linha-20261001-01: fonte anterior
fc7116e, dump 13.131.072 bytes, índice/leitura integral/acesso privado aprovados,
SHA256 c6652b1e5c658cbab77575daa90c65ff732eccf67d34ec165e2187c830fc298f.
Imagem imutável sha256:d6e2a6a9c92638741580eea6acccfa4a8200a6183c6c96fe0da4b91c37f7eb12
preservada na tag grazing-pedidos-anterior:20261001-frete-linha-01;
fonte fiscal banco e zero env/mount de fallback. Sem restauração de dados.
Smoke compilado e evidência pós-publicação serão registrados localmente, sem
outro deploy apenas para acrescentar resultados.

## Amostra pública de Pedidos/Clientes — 01/10/2026

**Autorização específica:** o usuário declarou Pedidos/Clientes do sistema público como área de teste e solicitou excluir os registros existentes, depois deixar um cliente e um pedido fictícios completos para avaliação. Compras continua operacional; essa autorização não abrange testes ou limpeza de outros módulos, nem aprova políticas financeiras ou operação real de vendas.

**Limpeza:** versão publicada conferida `fc7116ec67487ce99a7c1523f1ef256c68cf6e8a`, sem substituir pelo código local em desenvolvimento. Existiam um cliente e um pedido confirmado no modo EXTERNO, com um item e três eventos comerciais. Não havia título vinculado, pagamento externo, tratamento, crédito ou reserva de estoque. Backup PostgreSQL privado de 13.131.072 bytes, SHA-256 registrado no servidor; catálogo e leitura integral do dump aprovados. Identificador de recuperação: `pedidos-clientes-amostra-20261001`, em `<BACKUP_PRIVADO>`. Exclusão por IDs exatos em uma transação, com guardas contra mudança do escopo e vínculos; conferência de conteúdo por hash de 18 tabelas de Compras, Financeiro, Estoque, Fiscal, catálogo e fornecedores antes/depois da limpeza. Resultado intermediário: zero PedidoVenda e zero ClienteVenda. Usuários de acesso preservados; histórico cadastral independente preservado; registros comerciais removidos arquivados no backup privado. Recuperação deve ser seletiva dos registros removidos; não restaurar toda a base sobre novas compras.

**Amostra mantida:** `Cliente Teste Grazing`, ID `registro-sintetico-30`; orçamento **#2**, ID `registro-sintetico-31`, modo EXTERNO. Criado pelo formulário publicado autenticado, com nome/sobrenome, CPF sintético, I.E., telefone sintético, e-mail `example.invalid`, nascimento, cobrança completa e destinatário/endereço de entrega completos. Data 03/10/2026, janela 10:00–11:00, canal Site, duas unidades de `Grazing para 1 (tabua de frios)` ao preço já cadastrado de R$ 139,00; observação por item e aviso explícito de não produzir, entregar ou cobrar. Valores demonstrativos: subtotal R$ 278,00, desconto R$ 10,00, outros custos R$ 5,00, frete manual R$ 20,00 com justificativa; total estimado R$ 293,00. Boleto apenas informado em 1x, vencimento 02/10/2026, sem emissão ou cobrança. Cobertura não foi homologada nem aprovada excepcionalmente. Cupom permanece indisponível conforme decisão anterior. A sequência numérica foi preservada.

**Validação:** recarga/reabertura do orçamento confirmou campos e valores persistidos; Clientes mostra apenas a amostra ativa. Inspeção confirmou um cliente, um orçamento completo e zero títulos, pagamentos externos, créditos e reservas do exemplo. Totais preservados: 49 compras, 497 lançamentos financeiros, 186 movimentações bancárias, 613 movimentações de estoque, 220 saldos e 159 NFS-e recebidas. Nenhuma confirmação comercial, movimentação financeira/física, emissão fiscal, migration ou publicação de código nesta tarefa.

**Orientação para próximas mudanças:** quando uma alteração autorizada modificar a estrutura do cadastro ou do pedido, atualizar também esta amostra pelos fluxos existentes, mantendo dados fictícios e os avisos de teste. Reutilizar os IDs acima para não gerar amostras duplicadas; conferir se continuam sendo a amostra e se não ganharam vínculos operacionais antes de alterar. Adaptar o formulário ao contrato aprovado e reabrir o exemplo para conferir persistência e apresentação. Não inventar políticas, pagamentos, cadastros ou composições para preencher campos novos; indicar dependências externas. Se algum dia houver confirmação ou efeitos reais, respeitar os contratos de revisão/snapshots e não reescrever histórico diretamente. Esta orientação não autoriza futuras exclusões em massa, automações financeiras ou alterações em Compras.

### Gestor — orçamentos visíveis e destaque de atenção, 01/10/2026

Correção solicitada após a amostra #2 não aparecer na abertura do Gestor. Causa
confirmada: ConteudoGestorPedidos impunha status CONFIRMADO e a interface ocultava
esse filtro padrão. Abertura passa a todas as situações em Quadros, Calendário e
Lista; filtro explícito continua respeitado, agora visível/removível. Removido o
corte implícito dos entregues por idade; busca, paginação e período continuam.
Orçamentos ficam acima das quatro etapas, sem duplicação nas colunas de produção;
calendário e lista preservam o rótulo Em orçamento e o destaque de atenção.

Reutilizados Card, Table, Badge warning e tokens warning/warning-bg. A especificidade
do destaque foi conferida contra o acabamento de vidro, sem important, HEX local
ou novo token. Alto contraste e impressão preservam seus tratamentos existentes.
Orçamento não ganha ações rápidas de produção, confirmação, cobrança ou estoque.
Nenhum serviço de gravação, regra financeira, schema ou migration foi alterado.

Base publicada 9f956f21 integrada preservando ambos os registros de execução.
70 testes focados aprovados em seis arquivos (Gestor: consulta, domínio, conteúdo,
interface, ações e estoque na interface). Lint focado, lint:design (8 bases/298
consumidores), typecheck, diff e build Webpack em Node 22 aprovados. Cliente Prisma
local estava desatualizado após a sincronização; gerado novamente a partir do
schema vigente, sem editar código gerado. Duas migrations preexistentes aplicadas
somente ao PostgreSQL fictício de loopback, total 84. Nenhuma migration nova.

Prévia com orçamento e confirmados fictícios validou os três modos. Navegador
autenticado no next start compilado mostrou o orçamento persistido na abertura
sem filtros; CSS computado confirmou fundo/borda dos tokens de atenção mesmo
após otimização. Isolamento: aplicativo 127.0.0.1:4239, adaptador 4240→4239, prévia
sem banco 4245 e PostgreSQL fictício 127.0.0.1:55449, banco teste_pedidos_campos_20261001.
Sem conexão operacional durante testes; fronteiras financeiras/estoque externas
não acionadas. A amostra pública #2 permanece orçamento e será conferida somente
em leitura após publicar; não é necessário recriar cliente/pedido para este ajuste.

Recuperação privada preparada em etiquetas-pedidos-orcamentos-20261001-01:
dump de 13.130.770 bytes, índice/leitura integral/SHA256 conferidos; imagem anterior
na tag grazing-pedidos-anterior:20261001-orcamentos-01; configuração privada
capturada, fonte fiscal banco. Preservar configuração efetiva, sem reaplicação
cega. Não restaurar banco sobre novas compras. Publicação previamente autorizada
pelo usuário; estabilidade, HTTPS e pedido #2 serão registrados após envio,
sem um segundo deploy apenas para evidência documental.

Publicação concluída: 1548911439b655de542cb384e18e98015012374d enviado por
fast-forward. Build oficial Docker/Webpack aprovado, Node 22.23.3/Next 16.3.4
verificados no contêiner 7d65fcf4e308; imagem
sha256:cbe7baccc8a085d9772a9427a5aae63716b6d23c40215745aa6115f813ec18cc.
Tarefa 56t3yizrs2ewebilm962ss5wt Running por 180 segundos, zero reinícios;
env e mounts idênticos ao snapshot privado. Prisma migrate status aprovado;
login HTTPS 200 e Gestor sem sessão 307 para login. Nenhuma configuração fiscal
reaplicada, dado comercial editado, migration nova ou operação financeira/física.

Chrome autenticado no sistema publicado, URL do Gestor sem filtros: um pedido,
Cliente Teste Grazing, orçamento #2 na seção superior Em orçamento, data 03/10 e
janela 10:00–11:00. CSS computado confirma fundo warning-bg e borda warning após
compilação. A amostra anterior foi preservada. Evidência em
.cache/gestor-orcamentos/publicado.png (local/ignorada; não publicar captura).
Auxiliares do ensaio encerrados, quatro portas conferidas sem listener; cluster
fictício parado após validar caminho. Dados fictícios preservados para retomada.
Registro pós-publicação local, sem novo push/deploy só por documentação.

### Calendário — slots compactos, 01/10/2026

Base publicada 15489114, worktree codex/pedidos-operacao-agenda; alterações locais
alheias preservadas. Slots datados mostram somente número, cliente em uma linha,
janela e canal. Clique abre o Card completo num Popover oficial; olho abre o Dialog
existente somente após a transição de fechamento, preservando destinatário,
endereço, impressão, status e ações autorizadas. Orçamento conserva warning;
Quadros, Lista e pedidos sem data conservam sua apresentação. Reutilizados
Button, Popover, Card, Dialog, TagCanalVenda e tokens existentes; nenhuma variante
compartilhada, regra financeira, schema ou migration criada.

72 testes aprovados em seis consumidores/domínio do Gestor, incluindo slot,
abertura por teclado, Escape/foco, fechamento externo, resumo sem sobreposição e
orçamento sem produção. Lint focado, lint:design (8 bases/298 consumidores),
typecheck, diff e build Webpack Node 22.23.3 aprovados. Prévia fictícia sem banco
conferiu cartão e largura reduzida: painel 320px, contido na área visível.
Escape foi validado por evento no teste automatizado; o envio da tecla pela
automação do navegador não confirmou fechamento, sem atribuir causa ao produto.
Fechamento por interação externa e transição para resumo conferidos no navegador.

Smoke autenticado no next start 127.0.0.1:4239, via adaptador local 4240→4239:
orçamento persistido #1, slot com quatro informações, Card/Resumo e recarga
aprovados. PostgreSQL fictício 127.0.0.1:55449,
teste_pedidos_campos_20261001; prévia 4245 sem banco. Nenhuma conexão operacional
ou gravação financeira/física nos testes. Amostra pública #2 será conferida em
leitura; ajuste visual não requer recriar ou editar cliente/pedido.

Publicação autorizada anteriormente pelo usuário. Recuperação privada
etiquetas-pedidos-calendario-20261001-01: dump 26.482.654 bytes, catálogo/leitura
integral/SHA256 aprovados; imagem anterior preservada na tag
grazing-pedidos-anterior:20261001-calendario-01; env/mounts capturados, fonte
fiscal banco. Não reaplicar configuração cegamente nem restaurar banco sobre
novas compras. Resultado oficial e estabilidade serão registrados após publicar.

Publicação concluída: 8eadae528c3a5404a8d3f579abffbb0d13a27bd2 por fast-forward.
Build Docker/Webpack aprovado; Node 22.23.3/Next 16.3.4, contêiner a248e04cf353,
tarefa oujm85lamycmxcgqpfh93gn5o Running por 135 segundos, zero reinícios;
imagem sha256:1deaa04c0fa79252fe639231b49774d8b9e64f4b00f86c099042ae5547f4540e.
Env/mounts idênticos ao snapshot privado, migrations em dia; login HTTPS 200 e
Gestor sem sessão 307 para login. Nenhuma configuração fiscal reaplicada.

Chrome autenticado publicado, calendário semanal 28/09–04/10: orçamento #2
com as quatro informações, slot 80px de altura, fundo warning-bg. Clique abriu
Card completo com destinatário, endereço, status, resumo e impressão; olho abriu
um único Dialog, sem Popover aberto por baixo. Consulta em leitura, sem imprimir,
confirmar ou modificar a amostra. Captura local/ignorada em
.cache/calendario-compacto/publicado-expandido.png. Auxiliares de loopback
encerrados; portas 4239/4240/4245/55449 sem listeners, banco fictício preservado.
Registro pós-publicação local; sem novo push/deploy apenas para documentação.

### Calendário — duas linhas por pedido, 02/10/2026

Solicitação: número e cliente na linha 1; horário e canal na linha 2. Composição
dos spans do Button existente ajustada, mantendo truncamento/nome completo no
title, Popover/Card e ações. Sem novo padrão, token, serviço, schema ou migration.
Base publicada 4b96ee41 incorporada; conflito apenas no registro de execução,
resolvido preservando os dois relatos. Alterações alheias da raiz preservadas.

Prévia isolada 127.0.0.1:4245, sem banco e com dados fictícios: duas linhas de
20px, slot aproximadamente 62px (antes 80px), cartão completo preservado. Captura
local em .cache/calendario-duas-linhas/previa.png. Lint focado, lint:design e
typecheck aprovados. Primeira regressão: 81/83; dois testes excederam 5 segundos
durante verificações concorrentes, sem falha de asserção. Repetição em série,
sem ampliar o limite: 33/33 no consumidor do Gestor, incluindo os dois testes;
total dos sete arquivos aprovados 83/83 após a repetição. Build Webpack Node
22.23.3 aprovado. next start restrito a 127.0.0.1:4239 iniciou, login HTTP 200;
configuração exclusivamente fictícia, sem banco ativo/conexão operacional.
Cliente Prisma regenerado do schema já publicado após integrar a base; nenhuma
migration aplicada nesta tarefa. Smoke autenticado ocorrerá na publicação em
leitura da amostra fictícia, sem gravação ou confirmação comercial.

Recuperação privada etiquetas-pedidos-calendario-linhas-20261002-01: dump
26.527.768 bytes, catálogo/leitura integral/SHA256 aprovados, env/mounts e imagem
anterior preservados; fonte fiscal banco. Nenhuma operação comercial/financeira
nos testes. Publicação expressamente autorizada nesta solicitação.

## 01/10/2026 — Clientes e Pedidos sincronizados, abas de cobrança

Implementação em branch `codex/clientes-cobranca-sincronizados`, inicialmente sobre main `15489114`, integrada à atualização `8eadae52`. Componentes compartilhados de cadastro/cobrança/destinatário, largura comum de popup, entrega padrão cadastral opcional (migration aditiva), seleção de cobrança revalidada pelo servidor e persistida no snapshot; Entrega/Retirada por botões oficiais; pagamento obrigatório na confirmação, orçamento permitido sem pagamento. Contrato permanente registrado no documento dono, Vendas; composição das abas registrada na Central de Design. Validação local: 88 integrações PostgreSQL aprovadas (pedidos, financeiro, regras por cliente e cadastro), migration aditiva aplicada no banco fictício UTF-8 de loopback, Prisma validate/generate e build Webpack em Node 22 aprovados. Regressão de Vendas executada; falhas de consumidores e timeouts concorrentes com build foram diagnosticados e os seis consumidores repetidos em série: 85/85 aprovados, sem ampliar timeout. Lint global aprovado excluindo somente artefatos temporários `.tmp-*/**`; lint:design aprovado (8 bases, 299 consumidores), typecheck e diff aprovados. A primeira tentativa de teste sem elevação foi impedida por spawn EPERM, sem execução de testes.

Prévia sem banco com dados e CEP fictícios: popups de Clientes/Pedidos com 1024px no desktop (1280px), campos PF/PJ alinhados; mobile 390px sem overflow horizontal. Seis abas mantêm títulos legíveis, + junto da última, valores preservados e seleção por teclado/Enter. Entrega inicial e alternância para Retirada conferidas. Nenhuma gravação operacional, pagamento, emissão fiscal ou alteração de dados reais nos testes. Imagens isoladas preservadas localmente. Atualização remota do Gestor preservada; publicação em andamento; não presumir deploy ou homologação fiscal.

Último ajuste das abas (títulos sem compressão): 28/28 testes de Clientes/campos/Pedidos aprovados em execução serial.

Revisão integrada sobre `8eadae52`: 42/42 testes do Gestor/contrato de sincronização aprovados, sem mudança adicional no backend validado pelas 88 integrações. Build Webpack final integrado aprovado. Backup privado `etiquetas-clientes-cobranca-20261001`, 26.482.654 bytes, catálogo/leitura integral e SHA256 `c92fb30e8e84cf6722e569ef7418d4c6433a0afdf59397bfd7070a5c9c56e666` conferidos na própria VPS. Imagem anterior preservada em `grazing-clientes-anterior:20261002-cobranca-01`, configuração capturada, fonte fiscal banco. Não restaurar dump sobre transações novas. Autorização de publicação reiterada pelo usuário; estabilidade e smoke serão registrados após a implantação, sem segundo deploy documental.
Tipos, lint dos consumidores integrados e lint:design final (8 bases/299 consumidores) aprovados. Diff sem erros; nenhuma mudança funcional após a revisão final.

## 09/10/2026 — Lista, Kanban, detalhe vertical e resumo comercial

Implementação em `codex/pedidos-experiencia-20261009`, baseada em `origin/main`
`34b4d946`, com checkout isolado e alterações alheias da raiz preservadas.
Lista reduzida a sete colunas com expansão de largura inteira para status, ações,
itens e informações de atendimento. Kanban conserva as quatro etapas operacionais,
com cards compactos, produtos visíveis, cores de processo e ações por ícones.
Contagens por status antecedem a paginação e preservam os demais filtros.
Shell, Calendário, canais, autorizações e fluxos iFood existentes permanecem.

Detalhe vertical: cliente, agenda, entrega/destinatário, cobrança, pagamento, itens,
observações e histórico. Edição explícita por seção; agenda, cobrança e destinatário
podem ser atualizados em qualquer estado local. Valores, itens, composição, preço,
desconto, frete e produção de pedidos confirmados exigem cancelar e criar outro
pedido. O servidor preserva autorização, versão, transação, idempotência, auditoria,
primeira entrega e os efeitos financeiros/físicos. Pedido externo iFood mantém sua
autoridade própria. Ocorrências repetidas de agenda foram removidas; pós-venda e
pagamento continuam em seus fluxos específicos.

Menu separa **Resumo do pedido** de **Impressão de produção**. Preview usa Dialog
oficial e iframe sem scripts; impressão/PDF usa A4 comercial da Grazing Table & Co,
logo oficial, identidade discreta, dados PF/PJ, entrega, cobrança, itens e totais.
Pedido fechado usa snapshots; orçamento calcula em leitura, sem gerar títulos ou
reserva. Retirada normaliza frete a zero como no fechamento. Não há contatos,
validade comercial ou quitação inventados. Documento longo admite várias páginas.

Referências visuais novas registradas **Em revisão** na Central; acabamento conferido
em prévias sintéticas de desktop e 390 px, sem dados operacionais. Lista e Kanban
rolam dentro da superfície em telas pequenas; detalhe e documento reorganizam a
leitura. Capturas e relatório locais/ignorados em `.tmp/pedidos-experiencia`; PDFs
de orçamento, confirmado e 35 itens preservados em `.tmp-resumo`. Impressão física,
aprovação visual humana e publicação em produção não foram realizadas.

Base reconciliada com `origin/main` `a236899b` durante a tarefa, por merge na branch.
Modo de acompanhamento iFood/Takeat, schema e migration aditiva já existentes na
main foram preservados; não houve migration própria desta experiência. Cliente
Prisma regenerado e schema validado, sem operação de banco produtivo. Produção e
ações locais continuam bloqueadas para acompanhamento; consulta e resumo comercial
permanecem disponíveis. Fotos do detalhe foram incluídas na allowlist estrita do
host de Pedidos, conservando sessão, permissões e vínculo a item vigente.

Validação final em Node 22.23.3:

- Lint de todos os arquivos de código alterados e lint focado do último ajuste de
  host aprovados sem erros/avisos. `lint:design`: 8 bases e 350 consumidores TSX.
- Typecheck completo aprovado antes e depois do ajuste de host. Prisma validate e
  generate aprovados; nenhuma dependência/lockfile alterada.
- Regressão Vendas/Design/fronteiras: 99 arquivos, inicialmente 948 aprovados,
  10 falhas e 147 opt-ins ignorados. Cinco falhas eram timeouts de 5 segundos;
  as outras eram contratos de catálogo/ação e seleção simulada de horário que
  precisavam acompanhar a implementação. Repetição serial dos seis consumidores
  pertinentes: 300/300 aprovados, sem ampliar timeout ou retirar asserções.
- Os 147 opt-ins foram executados no PostgreSQL fictício: Pedidos, Financeiro,
  Entregas e regras de clientes 115/115; fiscal simulado, catálogo e migrations
  históricas de preço/frete 32/32. Schemas exclusivos criados/removidos pelos testes.
- Após integrar a main: dez arquivos de consumidores iFood/Gestor/edição/fotos e
  fronteiras, 318 cenários cobertos. Nove arquivos/315 passaram; o menu do novo
  consumidor Acompanhamento passou nos três modos após aguardar sua montagem real
  (3/3 na repetição). HTTP iFood exclusivamente simulado, sem envio externo.
- Regressão de foto no host comprovada antes da correção; Pedidos, Etiquetas e
  autorização de fotos: 122/122 aprovados após a allowlist restrita.
- Build Webpack final aprovado com tipos e geração de páginas. Aviso preexistente
  sobre convenção middleware permanece; o primeiro build também mostrou avisos
  legados de CompressionStream/DecompressionStream em jose/Edge.
- Smoke do build em loopback com configuração fictícia e Host explícito: login de
  HUB/Pedidos e logo 200; Gestor, detalhe e foto sem sessão 307 para login; catálogo
  e caminho extra da foto 404; host local não permitido em produção 421.

Captura final `11-final-lista-desktop.jpg` e relatório de revisão preservados localmente.
Sem gravações comerciais, financeiras, fiscais ou físicas reais. Branch pronta para
revisão visual e integração autorizada; não confundir o smoke local com deploy.

## Refinamento de fidelidade — 09/10/2026

Referência primária do usuário: Kanban com cinco colunas e painel na lateral direita.
Branch `codex/pedidos-fidelidade-20261009`, sobre a `origin/main` `c7dced62`;
cópia existente reutilizada. Alterações de outras tarefas na cópia principal foram
preservadas. Publicação desta etapa expressamente autorizada pelo usuário.

Kanban começa em **Novo pedido**, seguido de preparo, pronto, rota e entregue.
Orçamento, cancelamento e outros encerramentos são filtros de consulta em Lista,
sem blocos acima/abaixo do quadro. A coorte operacional é aplicada antes da
paginação e do total; filtros/contadores mantêm busca, canal, cliente, produto e
data. Contrato geral de `listarPedidos` fora do Gestor permanece compatível.

Topo com título visível, abas Lista/Kanban, busca, filtros e chips contados.
Cards compactos exibem hora/tempo relativo, cliente, entrega/retirada, quantidade
de linhas, total e miniaturas agrupadas por ID com quantidades decimais precisas.
URLs de foto permanecem privadas/autorizadas. Horário externo iFood vem do
snapshot válido; fallback conserva o instante local. Relógio de consulta evita
divergência de hidratação e avança no cliente sem alterar dados comerciais.

Detalhe usa variante `painel-direito` do Dialog oficial: 488 px no desktop,
corpo rolável e reflow modal no móvel. Sete blocos verticais, itens com fotos,
histórico e total detalhado recolhíveis, ícones de fluxo/produção e menu do resumo.
Metadados têm edição inline e um único **Salvar alterações**, sem gravação no blur.
Agenda, cobrança e destinatário usam versão/chave idempotente, descarte e trava
durante envio/CEP. Navegação do Gestor, calendário, marca e configuração iFood
respeita rascunho pendente. Itens/valores/estoque permanecem fora dessa edição:
alteração comercial exige cancelar e criar outro pedido, conforme regra existente.
Seleção de novo horário mantém a opção histórica estável para o Select oficial.

Resumo A4 comercial preservado, separado de produção, com preview e impressão/PDF.
Catálogo tipado e documentação atualizados; referências seguem **Em revisão**.
Revisão técnica visual em `design-qa.md`: cinco superfícies, comparação explícita
com anexos e nenhum P0/P1/P2 remanescente em desktop, 390 px, tema escuro e A4.
Evidências sintéticas em `.tmp/pedidos-fidelidade`; fotos fictícias somente nas
fixtures. O harness agora posiciona identidade no BODY como o layout real.

Sem schema, migration ou dependência nova. Validações e fechamento operacional
desta etapa são registrados abaixo após a conclusão, separando teste local de deploy.

Validação final da implementação em Node 22.23.3:

- Lint de todos os arquivos de código alterados e dos últimos ajustes aprovado,
  sem erros/avisos. `lint:design`: 8 bases, 352 consumidores TSX. Typecheck completo
  final aprovado; o build também concluiu sua verificação de tipos.
- Bateria geral: 329 arquivos, 2687 casos aprovados, 16 falhas e 561 opt-ins
  ignorados. As falhas abrangeram limites de 5 s/interações sob carga e um contrato
  antigo que esperava orçamento na abertura do quadro. Repetição serial dos seis
  consumidores compartilhados: 65/65. Delta de sete consumidores do domínio,
  navegação protegida, horário e Central: 90/90. Após mover configuração iFood para
  o menu, dois arquivos completos: 59/59. Nenhum limite ampliado ou asserção removida;
  o teste de menu aguarda sua montagem real. Não alegar bateria global única verde.
- PostgreSQL isolado: oito arquivos de Pedidos, Entregas, catálogo, iFood simulado
  e migrations históricas, 166/166 sem skips; regras de edição, 3/3. Schemas
  exclusivos removidos, cluster encerrado, porta liberada. Sem rede iFood real.
- Build Webpack de produção aprovado via script oficial, Node 22, configuração
  local fictícia e armazenamento conferido (25,64 GB livres antes do build final).
  Aviso preexistente sobre convenção middleware permanece; não houve migração de
  infraestrutura fora do escopo. Uma compilação anterior foi interrompida para
  incluir o último ajuste administrativo e não conta como validação final.
- Smoke do build local: 10/10. Login e marca 200; Gestor/detalhe/foto sem sessão
  307 para login; catálogo/caminho extra da foto 404; host local não autorizado 421.
  Servidor de teste usa banco fictício e nenhuma gravação comercial.
- Configuração iFood agora fica no menu de 224 px, sem linha extra no topo;
  servidor fornece a capacidade só ao admin autorizado. URL e descarte protegido
  preservados. Capturas 18 e 20 complementam a revisão final aprovada.

Integração/publicação autorizada, sem pendência funcional de validação. Backup
privado fresco `etiquetas-pedidos-fidelidade-20261009-1800` verificado na VPS:
arquivo completo legível, checksum salvo e imagem anterior preservada para reversão.
Configuração fiscal real mantida, sem consulta SEFAZ nem restauração de banco.
Evidências de PR/commit, tarefa, contêiner, estabilização, migrations e HTTPS após
o deploy ficam no registro operacional local, sem novo deploy apenas para logs.

Antes da publicação, `main` avançou para `c912177d` com ajuste de cabeçalho lateral
de HUB/Validades. Integração sem conflitos; a moldura de Pedidos não foi alterada
por esse ajuste. Na combinação final: 33/33 testes de layout, navegação, Central e
link protegido; `lint:design` aprovado; build oficial e typecheck interno aprovados;
novo smoke local 10/10. A primeira tentativa desses testes foi impedida pelo cache
temporário do sandbox, sem executar casos; a execução permitida passou sem alterar
testes. A base integrada e seus arquivos alheios foram preservados.

## Ajustes operacionais de cards, agenda e cancelamento — 09/10/2026

Etapa em `codex/pedidos-ajustes-operacionais-20261009`, sobre `0aeaa95b`.
Sete capturas adicionais do usuário orientam esta correção: card e topo do painel,
agenda com campos cortados, barra de consulta e seletor/menu de visualização.
Não reproduzir nomes ou dados reais das capturas nas fixtures ou nas evidências.

Escopo: ações compactas na mesma linha do número do card, na ordem próximo status,
impressão e menu; data/janela de entrega e destinatário com leitura operacional;
seletor oficial de visualização antes da busca; salvamento explícito de metadados
e cancelamento com nome digitado e motivo. Preservar as regras comerciais, a
autorização, os efeitos de cancelamento e os componentes/tokens oficiais.

Harness de Gestor possui estado compartilhado exclusivamente sintético entre
consulta e simuladores. A edição usa o validador de metadados do domínio e
responde com ID/versão corretos; cancelamento simulado confere nome, motivo,
versão e estado permitido. O cenário de referência contém destinatária diferente
do comprador, entrega seis dias após a consulta e as fotos/quantidades 2/3 já
existentes. Fixtures padrão usadas pelos testes anteriores foram preservadas.

Validação visual e funcional concluída em prévia isolada: `design-qa.md` registra
`passed`, sem P0/P1/P2 remanescente, com imagens em `.tmp/pedidos-ajustes`.
Cards, seletor oficial, painel e agenda desktop/mobile foram comparados às sete
fontes adicionais. Cobrança aberta e inalterada permite salvar nova janela com
motivo; consulta e detalhe refletem o retorno correto do simulador. Cancelamento
exige nome e motivo, distingue operador autenticado e fecha após sucesso sem
guard indevido; rascunho não salvo continua protegido. O X focado do menu recebeu
o estilo oficial já existente, com item e SVG vermelhos. Resumo A4 foi revisto no
preview e no HTML exato do iframe: dados PJ, itens 2/3, observações, total e rodapé
preservados; impressão/PDF habilitado, sem gerar novo PDF nesta regressão.

Captura integral apresentou uma limitação técnica do navegador após mudança de
viewport; imagens com artefatos não sustentam aprovação. Topo/rodapé do A4 foram
registrados pela captura alternativa suportada, com conferência do DOM e da
imagem integral anterior aprovada. Testes e publicação ficam a cargo do
responsável pela integração; não confundir essa simulação com dados reais ou
homologação externa. Referências da Central permanecem Em revisão humana.
Chrome foi liberado, viewport restaurado e Vite encerrado antes do build final.

Validação de integração desta revisão (Node 22): lint dos arquivos alterados sem
avisos; lint:design aprovado em 8 bases/352 consumidores; typecheck completo e
build oficial webpack aprovados na versão final. Bateria de domínio/consumidores:
49 arquivos, 536 casos, sem skips. M1/M2 com PostgreSQL local isolado: 95/95,
sem skips; cluster encerrado e esquemas de teste removidos pelo próprio harness.
Após corrigir fechamento pós-cancelamento, nova rodada dos consumidores afetados:
90/90 em 5 arquivos, incluindo três regressões novas. Smoke da compilação final:
10/10 rotas, hosts e proteção sem sessão. Nenhum pedido real foi alterado para testar.

Publicação autorizada pelo usuário. Backup privado fresco
`etiquetas-pedidos-ajustes-20261009-1940` na VPS verificado por catálogo, leitura
completa e checksum; imagem anterior e configuração fiscal preservadas.
Sem migration nova, consulta SEFAZ ou restauração de banco. PR/commit integrado,
tarefa, contêiner, estabilidade, migrations e HTTPS serão registrados no arquivo
operacional local após o deploy, sem publicar novamente apenas para acrescentar logs.

## Lista direta e cancelamento no menu — 09/10/2026

Etapa em `codex/pedidos-lista-cancelamento-20261009`, orientada por duas capturas
adicionais do usuário: impressão duplicada/ausência de cancelamento no card e
expansão com ações ocultas na Lista. Fontes abertas antes da revisão integrada.

Escopo: Lista com nove colunas (Pedido, Criação, Cliente, Canal, Itens,
Entrega / retirada, Total, Status, Ações), data/hora de criação no fuso correto e
ações principais diretas, sem expansão. Menus oferecem retorno quando aplicável,
Resumo do pedido e Cancelar pedido por último, após separador; impressão fica no
ícone próprio. Cancelamento autorizado de pedido local confirmado permanece
visível e desabilitado quando entregue, com explicação da restrição existente.
Documentação do padrão e entrada do catálogo atualizadas, mantendo o ID histórico
`pedidos-lista-expandida` para preservar referências e sem criar primitive nova.

QA visual integrada concluída: `design-qa.md` registra passed, sem P0/P1/P2
remanescente. Fontes e capturas abertas juntas; evidências sintéticas em
`.tmp/pedidos-lista-cancelamento`. Lista desktop, card Kanban, detalhe e menus
confirmados sem expansão/impressão duplicada, com cancelamento último. Entrega
registrada conserva bloqueio após retorno a A caminho, com motivo acessível na
Lista e no detalhe. Aviso Antes de confirmar distingue efeitos financeiros e
de estoque sem prometer estorno ou retorno automático de consumo/preparo.

Mobile medido em 390 × 844 CSS px, sem overflow horizontal da página; tabela com
rolagem própria. Diálogo de cancelamento 358 × 736 px cabe inteiro, com campos,
aviso e confirmador visíveis. Captura recuperada em aba própria estável após duas
falhas iniciais do navegador; provas atuais 10/11, sem usar imagem antiga como
prova desta versão. A4 intacto e impressão/PDF habilitado, sem novo PDF ou
impressão física. Chrome/viewport restaurados e Vite encerrado antes do build.

Checks de integração informados pelo responsável: 225/225 casos em 13 arquivos;
lint dos dez caminhos aprovados, typecheck completo aprovado e lint:design em
8 bases/352 consumidores aprovado. Build e smoke serão registrados pelo
responsável após a QA; não são declarados concluídos neste registro. Nenhum dado
real foi operado para testar. Referências da Central continuam Em revisão humana.

Fechamento desta rodada: build de produção com Node 22 aprovado; smoke local em
10 rotas/hosts aprovado, incluindo bloqueios de acesso sem sessão e foto protegida.
Prévia, abas próprias e servidor local encerrados. A publicação foi autorizada
pelo usuário. Backup fresco privado `etiquetas-pedidos-lista-menu-20261009-2028`
conferido por catálogo, leitura integral e checksum; imagem/configuração anteriores
preservadas. Sem alteração de schema, migration nova ou consulta à SEFAZ.
PR, commit integrado, tarefa, contêiner, estabilidade, migrations, HTTPS e UI
autenticada serão registrados no arquivo operacional local após o deploy, sem
nova publicação apenas para acrescentar evidências.

## Salvamento laranja e cancelamento após retorno — 09/10/2026

Etapa em `codex/pedidos-retorno-cancelamento-20261009`, base `944a0936`, autorizada
por nova correção do usuário. Três fontes adicionais mostram cor do salvamento,
cancelamento bloqueado por entrega histórica e confirmação sem botão preenchido.
O contrato atual substitui o bloqueio por primeira entrega da rodada anterior:
`ENTREGUE` bloqueia; retorno operacional autorizado permite cancelar novamente
um pedido local confirmado, conservando `entregueEm`, apontamentos, pagamentos
e auditoria. O retorno não libera edição comercial ou nova execução física.

Servidor e UI consideram a etapa atual com as permissões, origem, versão e
idempotência existentes. Nome do responsável, motivo e consequências continuam
antes da confirmação. A Central recebeu variante aditiva oficial `Button salvar`,
com tokens tipados `acao.salvarClaro`/`acao.salvarEscuro`, independentes da marca;
confirmador reutiliza `Button saida` preenchido vermelho. Não há paleta local
nem alteração dos demais botões. Referências permanecem Em revisão humana.

QA integrada registra passed em `design-qa.md`, sem P0/P1/P2 remanescente no escopo
desktop/mobile claro. Evidências em `.tmp/pedidos-retorno-cancelamento`: Lista,
Kanban e detalhe habilitam cancelamento após retorno com primeira entrega
preservada; confirmador habilitado inteiro vermelho; EditorPedido real mostra
Salvar orçamento laranja distinto de Confirmar pedido verde. Salvamento e
cancelamento sintéticos retornam sucesso; fechamento pós-cancelamento não pede
descarte. Mobile medido em 390 × 844 CSS px, sem overflow horizontal no orçamento.
Enquadramento parcial do topo da captura móvel do cancelamento foi documentado,
sem afirmar captura integral ou aprovação visual nova do tema escuro.

Chrome/viewport restaurados, abas próprias fechadas e Vite encerrado antes das
verificações finais. Nenhum dado real foi operado para testar. Checks focados
informados pelo integrador: Gestor/Central 74/74, detalhe 39/39 e editor 17/17;
lint:design aprovado em 8 bases/353 consumidores. Bateria de domínio/banco, lint,
typecheck, build e smoke desta versão serão registrados pelo integrador após QA;
não são antecipados neste registro.

Fechamento desta correção: lint dos caminhos alterados e typecheck completo
aprovados; build de produção Node 22 e smoke local de dez rotas/hosts aprovados.
Integrações em PostgreSQL isolado: 72/72 pedidos e 31/31 financeiro, sem casos
ignorados; cluster encerrado ao concluir. Foram verificados retorno de etapa,
concorrência com entrega, primeira entrega preservada, pagamentos/capturas,
crédito restaurado uma vez e destinações de estoque sem recriação de consumo.
A chave numérica sintética também cobre a referência interna segmentada do crédito.

Regressão geral: 296 arquivos e 2808 casos passaram; 35 arquivos/570 casos
condicionais ficaram ignorados. Houve uma única falha de sincronização no teste de
reenvio, que procurava a confirmação enquanto o envio ainda estava em andamento.
A correção foi exclusivamente no teste, aguardando o botão habilitado e as
contagens exatas; os dois arquivos de detalhe/cancelamento passaram novamente,
39/39. Não se declara uma segunda execução global integral inexistente.

Publicação autorizada pelo usuário. Backup privado fresco
`etiquetas-pedidos-retorno-cancelamento-20261009-2119` verificado por catálogo,
leitura integral e checksum; imagem/configuração anteriores preservadas. Sem
schema ou migrations novas e sem operar pedidos reais para testar. PR, commit
integrado, runtime, estabilidade, migrations, HTTPS e UI autenticada serão
registrados no arquivo operacional local após o deploy, sem nova publicação
apenas para acrescentar evidências.

## Ações fiscais e pagamento na interna — 20/10/2026

`emitir-nota-pedido.tsx` reutiliza `Button` e `GrupoAcoes` da Central. XML usa
`entrada-outline` verde e ícone de código. PDF/DANFE usa `atencao` laranja e
ícone de documento. Cancelar NF usa `saida-outline` vermelho e ícone de
cancelamento. Consulta e obtenção de arquivos também têm ícones. Permissões,
links, estados pendentes e confirmação com justificativa foram preservados.
Não há novo token, variante ou alteração na base compartilhada de botões.

`PagamentoOperacionalPedido` agora mostra somente a forma, as parcelas, a data
da compra e os valores. O botão de registro e seu formulário foram removidos.
A proteção comercial existente no servidor permanece em `pedidos-edicao.ts`
e `exigirComercialPreservado` de `pedidos.ts`. Mudar pagamento de pedido
confirmado exige cancelar e criar outro pedido. Sem mudança de banco ou migration.

A prévia isolada de Pedidos cobre as ações fiscais e a ausência do botão de
pagamento em 320, 390, 768 e 1440 px, nos temas claro e escuro. Os 16 testes
Playwright passaram. Capturas locais inspecionadas permanecem **Em revisão**.
O catálogo tem zero referências aprovadas; a captura consultiva de cinco estados
em 390 px com toque passou, sem criar ou aprovar baselines.

Validação final em Node 22.23.3: lint dos caminhos alterados, `lint:design`,
typecheck, build Webpack e 81 testes em cinco arquivos aprovados. O teste de
retenção excedeu cinco segundos durante a execução concorrente com o build;
a bateria completa passou na repetição sem esse build, sem mudar limites ou
asserções. Smoke local: oito rotas/hosts aprovados, com configuração sintética
e bloqueio sem sessão. A primeira tentativa de typecheck exigiu gerar os tipos
do Next na cópia nova; `next typegen`, build e typecheck final passaram.

Publicação autorizada pelo usuário. Backup privado
`etiquetas-pedidos-acoes-20261020-2316` verificado por catálogo, leitura integral
e SHA-256. Imagem anterior preservada por identificador imutável e tag de
reversão. Os resultados pós-deploy ficam em `.tmp/pedidos-acoes`, sem novo
deploy apenas para registrar evidências. Nenhuma operação fiscal ou financeira
real foi usada para testar.

## Composição da interna por cartões — 20/10/2026

A referência de painel orienta o detalhe com largura de 44 rem e cabeçalho
com ícone do pedido. A modalidade existente foi preservada: fundo interativo
no desktop e diálogo modal em telas menores. Fechar, descarte e bloqueios de
operações continuam no `ModalPedido` real.

`DetalhePedido` reutiliza Card, CardHeader e CardContent. A ordem é Cliente,
Frete e entrega com agenda, Itens, Observações quando presentes, Resumo
financeiro, Pagamento, Fiscal e Histórico. Entrega usa três colunas somente
quando a largura do painel permite. Contatos têm ícones próprios. O resumo
exibe os valores históricos e destaca o total, sem recalcular a venda.

As edições de cobrança, destinatário e agenda conservam seus controles,
salvamento explícito, motivo e versão. Não há edição de comprador nem de
pagamento. O cartão fiscal mantém seus estados reais, documentos e permissões;
erros e cancelamento pendente aparecem em bloco próprio, sem repetir envios.

A fixture `testes/visual/pedido-detalhe.tsx` agora usa o `ModalPedido` real.
Os 24 cenários Playwright passaram em 320, 390, 768 e 1440 px, claro/escuro,
com abertura e retorno de foco da emissão, recusa de cancelamento e pendência
com arquivos disponíveis. Auditoria local sem problemas nos casos medidos.
Capturas em `.tmp/fiscal-emissao-20261020/visual`, inspecionadas e **Em revisão**.

Validação final da integração com o seletor NF-e/NFC-e: 110 casos em seis
arquivos aprovados, além dos 24 cenários de navegador. O seletor permanece ao
lado de Emitir no cartão fiscal, com suas guardas de resultado e retorno de
foco. Lint dos caminhos alterados, `lint:design`, build Webpack, typecheck e
smoke de oito rotas/hosts passaram em Node 22.23.3. Dados e ações de teste
são sintéticos. Não há mudança de schema, migration ou emissão fiscal real.

A imagem que já contém o seletor também foi preservada antes da publicação
do painel integrado. Evidências finais de integração e pós-deploy ficam em
`.tmp/pedidos-acoes`, sem nova publicação apenas para registrar o resultado.


## Emissão direta e erros fiscais claros — 21/10/2026

Branch `codex/emissao-direta-fiscal-20261021`, iniciada em `b2212dee`.
O pedido usa a action direta, sem painel intermediário de emissão. NFC-e (65)
permanece o padrão e NF-e (55) pode ser escolhida antes do clique. A aplicação
informa que a emissão é produtiva. Reutiliza Card, Button entrada, Label,
SelecaoFormulario, GrupoAcoes e os estilos de vidro/alerta de Pedidos. Não há
componente-base, token, dependência ou migration nova. A prévia sintética usa
somente callbacks fictícios e bloqueia rede fora da própria origem.

A preparação e as validações fiscais permanecem no servidor. A nova orquestração
fixa produção e transmite pelo executor manual existente. Não habilita automação,
não aprova rascunhos fiscais e não altera credenciais ou certificado. O retorno
mostra a situação no próprio cartão. Uma resposta perdida exige consultar o
pedido; a consulta nunca transforma incerteza em autorização para reenviar.

O contexto de cartão não integrado é explícito, limitado a NFC-e/SP e preservado
no snapshot/revalidação. O contrato não inventa credenciadora, bandeira ou código
de autorização. Fontes e limites estão em
[BRASIL_NFE](../estrutura-fiscal/BRASIL_NFE.md#nfc-e-com-cartão-não-integrado--21102026).
A correção também preserva rejeições anteriores quando uma nova revisão válida
pode ser preparada. Erros seguros de produto, campo, HTTP e códigos SEFAZ são
exibidos sem conteúdo livre do fornecedor.

Diagnóstico produtivo fez somente leitura de metadados locais. A habilitação
manual produtiva inclui 55/65 e há CSC produtivo configurado. As tentativas de
65 verificadas também têm pendências reais: classificações sem GTIN, regras
ausentes e declaração FCI restrita ao modelo 55. O código não inventou esses dados,
não copiou aprovações e não transmitiu nota real para testar.

Validação executada no Node 22.23.3:

- 28 testes do consumidor direto passaram. A rodada dos quatro consumidores
  (emissão, detalhe, popup/servidor e navegação fiscal) passou em 93 testes.
- Regressão fiscal/tributária: 1.969 testes passaram na rodada ampla. Um teste
  ainda esperava o texto antigo de código SEFAZ sem tradução. A expectativa
  passou a exigir a nova orientação completa, preservando a separação entre
  emissão e cancelamento. A repetição final dos três arquivos passou em 87/87,
  incluindo os 21 testes desse arquivo e os 66 de emissão direta/actions.
  A rodada ampla ignorou 249 testes opt-in; não foram contados como aprovados.
- Foram executados separadamente 37 testes de integração SQL/HTTP sintéticos,
  com PostgreSQL local, schema efêmero e API simulada. Cobriram 55/65 em produção
  sintética, cartão não integrado, concorrência, rejeição e nova revisão, erro
  HTTP 403 e recuperação. Regras em rascunho não são ativadas pelo clique.
  Não houve efeitos em financeiro, estoque ou notas recebidas. O schema foi
  removido pela própria suíte e o cluster local foi encerrado.
- 32 cenários Playwright passaram em 320/390/768/1440 px e claro/escuro. A
  emissão não abriu outro painel. Foram verificados resultado, erro por produto,
  cartão inline, atalhos, XML/PDF, cancelamento e auditoria parcial da interface.
- Lint dos arquivos alterados e lint:design passaram, com zero novos desvios
  e 92 registros históricos. Typecheck e build final seguem na rodada final.

Falha ambiental inicial: o sandbox recusou a renomeação de cache do Vitest.
A mesma suíte passou com acesso ao cache local autorizado. Nenhuma proteção da
aplicação foi reduzida para os testes.

Capturas permanecem consultivas, **Em revisão**. Resultados de build, smoke e
publicação serão completados neste registro antes do encerramento.
