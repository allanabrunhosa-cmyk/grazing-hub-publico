# Insumos

A visualização expandida e a janela Editar Insumo/Preparação (`insumo-dialog.tsx`)
oferecem Dados do item e Movimentações, com Tabs oficiais. Na janela, o formulário
usa keepMounted para conservar o rascunho ao consultar; trocar aba não salva.
Novos cadastros e acessos sem visualização de Estoque não oferecem a aba de extrato.
A consulta utiliza os registros reais, filtra período/tipo, ordena cronologicamente
e pagina 25 resultados. Não grava nem
altera integrações. Contrato e caminhos em [Estoque](estoque.md#histórico-e-correção-de-entradas-avulsas--12102026).

Mapa conferido em 23/09/2026, base 2fac409. Cadastro único de insumos/preparações para Estoque, Compras, Vendas e Etiquetas.

## Rotas e componentes

Base: `src/app/(protegido)/insumos`. Nomes relativos abaixo pertencem a essa base.

- /insumos → page.tsx/actions.ts, insumos-table.tsx, insumo-form.tsx e insumo-dialog.tsx
- Composição: composicao-picker.tsx; conversoes-campos.tsx; etiqueta-cadastro-campos.tsx
- CSV: csv.ts; ficha: ficha-tecnica-button.tsx; fotos privadas: src/app/api/insumos/[id]/foto

## Serviços

- src/lib/insumos/conversoes.ts, custo-preparacao.ts, ficha-tecnica.ts, limites-preparacao.ts e marcas.ts
- src/lib/labels.ts: enums/rótulos; src/lib/estoque: quantidades e movimentos

## Banco de dados

Insumo → ConversaoInsumo, InsumoFornecedor, ComposicaoInsumo. Preparação é Insumo do tipo PRODUTO_INTERMEDIARIO, não outro catálogo.

## Regras importantes

- Não duplicar nome/produto para Etiquetas. Especificação e marcas são campos distintos.
- Conversão explícita por unidade/fator positivo; preservar snapshots dos pedidos e compatibilidade CSV. Não inferir fator pelo nome.
- Custo de preparação é recursivo por composição/rendimento; não sobrescreve custoMedio contábil. Ausência de custo/rendimento é pendência, não zero.
- Identificadores legados PRODUTO_INTERMEDIARIO/CSV permanecem; interface diz Preparação.
- Validades por conservação são cadastradas, nunca inferidas. Alteração de unidade exige revisar conversões e consumidores.

### Exclusão com vínculos

`insumo-actions-cell.tsx` consulta `consultarExclusaoInsumoAction` ao abrir a confirmação.
O rodapé mostra **Voltar** com a variante outline anterior e **Excluir** com a variante
destructive e nome acessível Confirmar exclusão, preservando o texto vermelho na
confirmação. O gatilho da listagem permanece o X oficial.

`src/lib/insumos/exclusao-servidor.ts` lista preparações e composições de `ProdutoVenda`,
incluindo cadastros inativos, múltiplos papéis e opções de grupos. Inclui composições JSON
de opções e ajustes particulares por produto. Ao confirmar, remove somente esse ingrediente
das composições atuais; conserva os demais ingredientes e as fotografias dos pedidos.

A exclusão é lógica: `Insumo.excluidoEm`, `excluidoPorId`, `exclusaoSnapshot` e `ativo=false`.
O item sai de todo o catálogo, inclusive inativos, sem apagar compras, perdas, saldos,
movimentos, contagens, produção, etiquetas, conversões ou reservas. Pedidos existentes
podem executar suas composições fotografadas; um ingrediente apenas inativo permanece
com a proteção operacional anterior. A auditoria guarda autor e vínculos/quantidades
retirados. Migration aditiva `20261006090000_insumos_exclusao_historico`.

Consulta e exclusão exigem `insumos/excluir`; a transação relê usuário, perfil e versão
da sessão sob a trava de acessos. A ordem das travas é acesso, cadastros de vendas,
composições e linha de Insumo. A revisão SHA-256 do popup é conferida novamente: mudança
retorna nova lista, sem remoção parcial, e exige outra confirmação. Repetição não regrava
a exclusão. Versões de produtos/grupos afetados avançam; guardar preparação, importar
cadastro ou alterar status não pode recolocar um ingrediente excluído. As listas dos
consumidores são revalidadas após sucesso. Contrato completo na
[feature](../features/insumos-exclusao-historico/SPEC.md).

Regressões: `testes/insumos/exclusao-interface.test.tsx`, `exclusao-integracao.test.ts` e
`fornecedores-revalidacao.test.ts`. Integração opt-in `EXCLUSAO_INSUMOS_BANCO_TESTE=1` com
`EXCLUSAO_INSUMOS_DATABASE_URL` exclusiva do PostgreSQL local `insumos_exclusao_teste`,
usando apenas fixtures em schema temporário. Prévia `testes/visual/exclusao-insumos.html`
com configuração Vite própria, dados/ações fictícios; referência visual **Em revisão**.

## Integrações e cuidados

ComposicaoPicker é reutilizado por Vendas. Conferir imagens de ficha/seletores com dados fictícios; não afirmar validação de impressão física.

## Testes relevantes

testes/insumos, testes/cadastros (status); testes/etiquetas e testes/vendas se composição/validade mudar; testes/compras para conversões.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Fotos em lote

`scripts/aplicar-fotos-insumos.ts` é uma operação administrativa por SSH, sem endpoint
público. Confere por padrão; exige manifesto privado, autorização humana registrada,
quantidade esperada e pasta privada de auditoria. `--aplicar` grava apenas bytes, MIME e
versão da foto; `--reverter` restaura somente fotos ainda iguais à imagem e versão do lote,
com nova versão para invalidar a URL. Ambos excluem `PRODUTO_INTERMEDIARIO` no banco.

O manifesto v1 identifica cada insumo por ID, nome, especificação, `updatedAt` UTC e
`fotoHashMd5` anterior (`md5(encode("fotoData", 'hex'))`); cada foto informa caminho
relativo, SHA-256, MIME e origem com licença/créditos ou prompt de geração. Os arquivos
devem permanecer dentro da pasta do manifesto e ser JPEG, PNG ou WebP até 5 MiB.
`src/lib/insumos/lote-fotos.ts` valida o contrato e as pré-condições. A aplicação trava
as linhas em transação Serializable, preserva os demais campos e ignora a mesma imagem
já aplicada. Backup das fotos anteriores e plano com versões futuras são gravados com
permissões privadas antes de alterar o banco; recibos registram aplicação/reversão e
permitem conferir o estado após interrupção. Não versionar manifesto, backup ou fotos
de catálogo reais. Testes de guardas e planejamento: `testes/insumos/lote-fotos.test.ts`.
Integração do CLI: `testes/insumos/lote-fotos-integracao.test.ts`, opt-in
`FOTOS_INSUMOS_BANCO_TESTE=1` e `FOTOS_INSUMOS_DATABASE_URL` exclusiva do banco descartável
`insumos_fotos_teste`; aceita localhost ou o host isolado documentado no teste e cria
somente um schema temporário fictício. Nunca fornecer a URL do banco da aplicação.

## Referências

[Estoque](estoque.md), [Compras](compras.md), [Produção](producao.md).

Seletores de insumos (CampoBuscaInsumo, Inventário, Compras e ComposicaoPicker) exibem apenas
o nome no campo e nas opções; especificação permanece em detalhes, listagem e composição
já adicionada somente em Suprimentos (cadastro, compras e estoque). `ComposicaoPicker`
exige `exibirEspecificacao` explícito no cadastro de preparações; Vendas não habilita
essa exibição nem o campo no cadastro rápido. Fichas de montagem de produtos e
Controle de validades mostram apenas o nome do insumo, sem especificação de compra.
Descrições e snapshots de porções permanecem disponíveis na montagem.
Não aumentar a altura do campo selecionado para acomodar especificação.

## Classificação financeira das compras

`Insumo.categoriaFinanceiraId` é independente da categoria operacional `categoriaId`.
Insumos e preparações usam `CategoriaFinanceiraCombobox` com despesas ativas e não
excluídas de todos os grupos, com o caminho completo de até três níveis do plano.
A gravação valida a categoria no servidor; formulários antigos sem esse campo
preservam a classificação existente. O padrão CMV só se aplica ao item sem classificação.
`src/lib/insumos/categoria-financeira.ts` resolve essa escolha para o aceite e a
conciliação de NF-e. Uma classificação inválida bloqueia o aceite antes da SEFAZ.
Mudanças no cadastro não reclassificam lançamentos ou notas já conciliados.

## Consulta da listagem

`insumos-table.tsx` mostra todos os vínculos de `InsumoFornecedor` na coluna Fornecedores.
`fornecedoresDoInsumo` põe o principal primeiro, inclui o principal legado sem duplicar e
ordena os demais em português. `marcasDoInsumo` prioriza a marca principal homologada,
ou a primeira cadastrada; as demais seguem A–Z. A lista exibida serve como chave da
ordenação. A busca considera nome, especificação, marcas homologadas/legada, EAN,
categoria e fornecedores homologados, sem diferenciar acentos.

A edição de insumos e preparações fica exclusivamente na coluna Ações da linha
principal, à esquerda do X de excluir, usando o mesmo `InsumoDialog` e as permissões
existentes. Abrir o formulário não expande a linha. O resumo expandido não duplica
a edição; a ficha técnica das preparações continua disponível nos detalhes.

## Tabela de Porções

`/porcoes` fica em Suprimentos, abaixo de Insumos. `porcoes/page.tsx` e
`porcoes-table.tsx` consultam/cadastram nomes e quantidades por insumo, com busca,
edição explícita e remoção confirmada pelo X oficial. Conteúdo centralizado com
largura máxima; não esticar campos apenas para ocupar a tela.

Nova porção e edição usam o mesmo Dialog oficial, com Quantidade do insumo e
1 porção (Qtd. + Un.), salvamento explícito e proteção de descarte. O formulário
não ocupa a tela principal. Busca e ordenação são imediatas: categorias/insumos
A–Z ou Z–A pelo seletor e cabeçalhos ordenáveis; a opção Ordem das categorias
restaura a sequência manual, com insumos em ordem alfabética dentro da categoria.

Ordenar categorias reutiliza `ListaOrdenavel` (arraste, toque e teclado), Dialog e
Salvar ordem. Inclui apenas categorias com pelo menos uma porção não removida,
independentemente da busca da tabela. A lista acompanha cadastro/remoção na mesma
tela; vazia, a ação fica desabilitada. Categorias sem porções conservam sua ordem e
versão. Não altera a ordem de Produtos nem os snapshots das composições. `Categoria.ordemPorcoes`
e `versaoOrdemPorcoes` pertencem apenas a essa tabela; novas categorias ficam ao
final, desempate por nome/id. Migration aditiva `20261004220000_ordem_categorias_porcoes`.
`ordem-categorias-porcoes.ts` valida conjunto/versões; `porcoes-servidor.ts` revalida
permissão editar vigente, bloqueia mudanças concorrentes nas categorias e grava a
sequência/auditoria `HistoricoOrdemCategoriasPorcoes` na mesma transação, somente
para o conjunto completo de categorias com porções conferido no banco. Alterações
desse conjunto exigem recarregar a página; metadados das demais categorias permanecem
no DTO para o primeiro cadastro de porção sem recarga. Repetir a
mesma sequência não duplica histórico; conjunto ou versão desatualizados são recusados.

`src/components/campo-numero-porcoes.tsx` é usado por `composicao-picker.tsx`, incluindo
seu consumidor de Vendas. O cadastro é exclusivo de `/porcoes`: Qtd. + Un. livre
representam 1 porção, associada à quantidade equivalente do insumo. Na composição,
a ordem é Ingrediente > Porção (multiplicador) > Descrição > Qtd. > Custo. O custo é
texto sem caixa em coluna própria; a unidade da Qtd. fica dentro do InputComSufixo oficial. O multiplicador aceita
frações e múltiplos; a referência permanece selecionada ao alterar esse número.
Cabeçalho, inclusão e linhas compartilham a grade compacta: Ingrediente recebe o
espaço restante; Porção, Descrição e Custo têm larguras limitadas e Qtd. conserva
espaço para o sufixo. O nome usa até duas linhas e título com o texto completo.
Em telas estreitas, os controles se reorganizam verticalmente. Esse contrato também
se aplica à composição de Produtos; não criar uma grade divergente nesse consumidor.
Margens laterais da composição e de cada linha usam 8px; o nome e FM têm 12px de
respiro, enquanto Custo fica compacto junto da remoção. O X oficial ocupa uma área
com a altura do controle, centralizado verticalmente; não alinhar seu botão compacto
pelo topo da linha. Cabeçalho conserva as mesmas margens e colunas das linhas.
Ao digitar Porção, a medida base cadastrada é carregada automaticamente e Descrição,
somente leitura, exibe o resultado proporcional (0,5 × 8 fatias → 4 fatias). Não há
seletor de descrição. Para novas referências, usa a primeira medida vigente por
`createdAt`/`id`; fichas com snapshot conservam sua base. A consulta não altera fichas
legadas nem preenche consumo antes da digitação. Qtd. permanece visível e editável;
editar diretamente limpa a referência e sua descrição, preservando o valor digitado.
Limpar Porção mantém o consumo convertido. Sem medida, preencher Qtd. diretamente.
O nome do ingrediente não recebe tipo nem unidade, inclusive em foco; `itemToStringLabel`
e `label` usam apenas o nome. A ficha de montagem permanece opcional. Em produtos, Button ghost/icon-sm com FM e
aria-pressed alterna a exibição, com tooltip; só Salvar grava a opção. A linha não
reserva uma segunda faixa para checkbox/custo. Qtd. manual aceita três casas e
completarZeroDecimal permite digitar ,5 ou .5 como 0,5/0.5, também em Porção.
O domínio conserva nove casas para conversões e histórico, sem arredondar valores salvos.

`src/lib/insumos/porcoes.ts` multiplica decimais exatamente e valida quantidade positiva,
menor que um bilhão, até nove casas; rejeita produtos que exigiriam arredondamento ou
perderiam precisão no DTO numérico. Unidade livre até 100 caracteres; nome derivado até
120. O servidor confere a igualdade entre multiplicador × base e a quantidade enviada,
além da unidade vigente. Porções de unidade antiga não são usadas como base.
`ComposicaoInsumo.porcao` guarda base, medida e multiplicador como snapshot independente;
`quantidade` alimenta consumo/custo e `observacaoPorcao` guarda a medida resultante.
Editar/excluir catálogo não reescreve fichas; composições legadas não recebem inferências.

`PorcaoInsumo` tem unicidade por insumo/unidade/nome normalizado, revisão e exclusão
lógica. Escritas e auditoria em `HistoricoPorcaoInsumo` são transacionais; repetição de
cadastro idêntico retorna a porção existente. Nome existente com outra quantidade não
é sobrescrito. `ComposicaoInsumo.quantidade` passa a Decimal(18,9), preservando os
nove dígitos inteiros anteriores. Migrations `20261002120000_tabela_porcoes` e
`20261002230000_porcoes_multiplicaveis`; a segunda apenas separa medidas antigas pelo
prefixo numérico textual e adiciona snapshots, sem mudar estoque ou quantidades de fichas.

Recurso próprio `suprimentos.porcoes`; página e operações exigem permissão no servidor.
Leitura de sugestões também aceita visualização de Insumos ou Produtos, sem conceder
direito de cadastrar porções. Perfis comuns precisam de concessão explícita para o
recurso novo. Não atribuir automaticamente permissões ao implantar.

[Especificação e evidências](../features/tabela-porcoes/SPEC.md). Referência visual
Em revisão humana; testes usam apenas fixtures e banco descartável.


## Entrada decimal localizada

Rendimento e limites de estoque reutilizam o Input decimal da Central: ,5 significa
0,5, com até três casas e sem arredondamento. saveInsumoAction normaliza vírgula/ponto
e o zero inicial, validando a precisão existente antes da transação; custo mantém
quatro casas no servidor. Testes: composicao-precisao e porcoes-integracao (schema
temporário local). O contrato comum e a proteção para novas telas estão em
[padrões de Design](../design-system/padroes.md#campos-delimitados-e-remoção--01102026).

### Consulta resiliente de medidas na composição

`CampoNumeroPorcoes` e `CampoPorcaoInsumo` usam `consulta-porcoes-cliente.ts` para GET
em `/api/insumos/[id]/porcoes`, URL estável sem IDs de Server Actions gerados por build.
Resposta privada/no-store; sessão e visualização de Porções, Insumos ou Produtos são
exigidas antes da consulta, com revalidação transacional existente no serviço.
Ausência de medida é lista vazia válida; erro de transporte não vira ausência de medida.
Snapshots compatíveis já salvos calculam localmente sem depender da consulta do catálogo.
Falha de rede tem alerta acessível e botão compacto com explicação ao passar o mouse;
nova tentativa conserva o rascunho, Qtd. direta e custo, sem esticar a linha ou salvar.
Após instalar essa correção, abas da implementação anterior devem ser recarregadas uma
vez. Novas consultas de porção usam a mesma URL nas publicações futuras.

### Especificações exclusivas de Suprimentos — 04/10/2026

- Correção funcional `2aa8a28`, reconciliada com a ficha publicada `c52680ac` em
  `a3986cb`; fixture final `4eae9a3`. Sem schema, migration ou escrita operacional.
- Node 22.23.3: 71 testes aprovados nos cinco consumidores finais de composição,
  interface/configuração de Vendas, ficha e Etiquetas; após completar a tipagem da
  fixture, os 16 testes de Etiquetas passaram novamente. ESLint dos arquivos
  alterados e `lint:design` aprovados (8 bases/316 consumidores).
  Build webpack integrado aprovado, incluindo a checagem completa de tipos.
- Bateria ampliada: 955 aprovados e 199 opt-ins ignorados. Duas falhas ocorreram
  durante a integração: fixture de prazos na seção errada e coleta da ficha antes
  da anotação jsdom trazida pelo remoto. Os dois consumidores passaram na revisão
  integrada acima; a bateria inicial não é registrada como integralmente aprovada.
  Não houve conexão ao banco operacional para testes.
- Prévia isolada `testes/visual/porcoes.tsx`: damasco fictício sem especificação em
  Vendas e com especificação em Suprimentos, mantendo descrição `8 un`. Imagem de
  desktop conferida; leitura do DOM móvel sem rolagem horizontal. Captura de imagem
  móvel indisponível por timeout do navegador. Referência visual Em revisão.
- Backup privado `etiquetas-especificacoes-suprimentos-20261004-a`: índice,
  conteúdo e checksum verificados. Configuração fiscal e imagem anterior fixada
  em `grazing-especificacoes-anterior:20261004-01` preservadas; nenhuma restauração.

## Acesso funcional a validades — 19/10/2026

A capacidade `producao.validades/editar` controla os mesmos prazos no portal de
Validades e no cadastro de Insumos/Preparações. `page.tsx` deixa de exigir
administrador para apresentar esses campos na edição completa. A edição completa
continua exigindo `insumos/editar` ou `insumos/adicionar`, conforme a operação.

Na interna da linha, a aba **Validades** usa `validades-insumo.tsx` e o mesmo
`EtiquetaCadastroCampos`. O perfil com consulta de Insumos e edição de validades
pode salvar somente habilitação e os três prazos, sem alterar nome, custo,
composição ou status. Consulta sem essa capacidade exibe os campos bloqueados.
A interna aberta por vínculo de auditoria continua somente leitura.

A ação existente `salvarConfiguracaoProdutoEtiquetaAction`, protegida no servidor,
continua validando os dias, atualizando versão/autoria e auditando em transação.
Revalida `/insumos` e `/producao/etiquetas`, para refletir as duas entradas. Nenhum
perfil ou dado operacional foi alterado para testar. Campos de dias reutilizam a
proteção inteira da Central e limite de quatro dígitos, inclusive colagem.

Validação local, árvore baseada na main a7e955d3 e merge 5e626d51: 724 testes
aprovados na bateria de Insumos, Etiquetas, Permissões e dois consumidores de
Cadastros; 94 opt-ins ignorados. Seis casos de gestão de perfis falharam nessa
execução e passaram em repetição isolada com um worker em threads e teto de
15 segundos. A configuração global e as asserções foram preservadas. Três
regressões adicionais da página passaram, incluindo a revogação por exceção.

Comando da bateria: `node node_modules/vitest/vitest.mjs run testes/insumos
 testes/etiquetas testes/permissoes testes/cadastros/acoes-edicao-listas.test.tsx
 testes/cadastros/status-listas.test.tsx --maxWorkers=1 --reporter=json
 --outputFile=.tmp/validades-permissoes-20261019/regressao.json`.
Repetição: `vitest run testes/permissoes/salvar-interface.test.tsx --maxWorkers=1
 --pool=threads --testTimeout=15000 --hookTimeout=15000`. Página: `vitest run
 testes/insumos/validades-pagina.test.tsx --maxWorkers=1`.

Tipos e lint focado passaram. `lint:design`: 92 desvios históricos, zero novos;
registro visual sem referências aprovadas. Oito cenas em 320/390/768/1440 CSS px,
claro/escuro, sem achados na auditoria parcial; imagens desktop, 320 e escuro
inspecionadas. Leitor e salvamento simulado conferidos. Prévia isolada:
`node node_modules/vite/bin/vite.js --config testes/visual/validades-insumo.vite.config.mts`,
porta 4253. Artefatos em `.tmp/validades-permissoes-20261019` e na .tmp da cópia
principal. Não houve teste em banco ou alteração de prazo real.

Build webpack integrado aprovado, incluindo a checagem completa de tipos. O recibo
de publicação será acrescentado após o deploy.

Ajuste final: os campos mantêm `min=1` na proteção inteira compartilhada para
recusar negativos na digitação/colagem. Os 27 testes focados de formulário,
composição e ação passaram; lint, tokens e novo build webpack passaram. A consulta
somente leitura ao perfil publicado Produção confirmou Insumos visualizar/editar/
adicionar e Validades visualizar/editar. Nenhuma permissão foi alterada.
