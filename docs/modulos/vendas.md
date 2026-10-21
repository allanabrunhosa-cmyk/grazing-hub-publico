# Vendas

## Cadastro e Data da compra — 20/10/2026

CPF/CNPJ e CEP aceitam colagem formatada e mostram máscara; serviços recebem
dígitos. Cobranças adicionais têm telefone opcional próprio. A Principal usa o
telefone geral. Copiar cobrança leva endereço, nome e telefone da seleção para
a entrega escolhida. A gravação continua explícita.
Pedidos novos mostram Data da compra junto ao pagamento, com hoje da loja como
padrão e alteração no orçamento manual. Relatórios comerciais usam esse dia;
legados sem data conservam o critério anterior. A entrega permite escolher um
veículo ativo para aquele pedido, inclusive sem slots no produto.
[Contrato, validações e publicação](../features/pedidos/CADASTRO-COMPRA-20261020.md).

## Vendas & CRM — 09/10/2026

O módulo único **Vendas & CRM** substitui Vendas & Pedidos e o módulo separado CRM.
Atendimento fica logo após Gestor de pedidos na navegação compartilhada desktop/móvel;
ambos abrem seus hosts existentes em novas abas. `/crm` mantém a guarda e redireciona
para `/vendas/atendimento`. A chave de permissão histórica `crm` permanece como seção
**Atendimento** dentro de Vendas & CRM em Usuários & Permissões, preservando concessões
e exceções; não concede acesso automático a Clientes, Pedidos ou gestão de usuários.

`ClienteVenda` é a autoridade única do cadastro comercial, compartilhada com Pedidos.
Atendimento encaminha a gestão de Clientes para `/vendas/clientes` no HUB, sob a sessão
e permissões próprias desse destino. Contatos técnicos do histórico de conversas não
constituem outro cadastro comercial: conservar mensagens, autoria e IDs legados, sem
fusão por nome/e-mail/telefone. Vínculos operacionais futuros exigem identidade explícita,
não sincronização implícita de duas bases. Gestão de equipe pertence exclusivamente a
`/configuracoes/usuarios`; atribuição/filtros de responsáveis nas conversas são distintos.
O resumo comercial A4 conserva a marca oficial, sem slogan no cabeçalho ou rodapé.

## Apresentação dos canais no Dashboard — 17/10/2026

`src/lib/vendas/canais-apresentacao.ts` reúne os aliases exatos antes internos ao
selo `TagCanalVenda`. O selo e as opções do BI mostram Site, iFood e GF, preservando
os IDs de CanalVenda e nomes desconhecidos. Não classifica por substring, não une
canais e não infere canal comercial da origem de importação. O cadastro conserva
a grafia original; a consulta usa a mesma lista e ordem do lançamento de Pedidos.

## Experiência de pedidos — 09/10/2026

O Gestor mantém o shell e os filtros existentes, com Lista direta de nove colunas,
status/ações e itens visíveis sem expansão, além de cards operacionais no Kanban.
Cards priorizam data/janela de entrega e destinatário; próximo passo, impressora e
menu compartilham o cabeçalho. O seletor único de Quadros/Calendário/Lista fica à
esquerda da busca. Clicar no pedido abre o painel, sem botão de olho.
Filtros de status contam a consulta antes da paginação. O detalhe segue cliente,
agenda, entrega, cobrança, pagamento, itens, observações e histórico; edição é
explícita por seção. Após confirmação, só agenda, cobrança e destinatário
admitem edição local: alterações comerciais exigem cancelamento e novo pedido.
O menu separa **Resumo do pedido** (prévia A4 comercial Grazing Table & Co) da
impressão de produção. Orçamentos são calculados sem confirmação; pedidos fechados
usam os valores fotografados. Cancelamento no menu exige nome do responsável e
motivo, preservando autor autenticado, histórico e tratamento financeiro. A etapa
atual `ENTREGUE` bloqueia o cancelamento; retorno operacional autorizado permite
novamente cancelar um pedido local confirmado, mesmo com `entregueEm` histórico.
A primeira entrega, os apontamentos e os pagamentos permanecem registrados.
Salvar orçamento usa a variante laranja oficial `salvar`; a confirmação de
cancelamento usa o botão preenchido vermelho `saida`. Formulários
abertos sem alterações não bloqueiam o salvamento de outra seção. [Contrato](../features/pedidos/ARQUITETURA.md#gestão-de-pedidos--edição-segura-e-resumo-comercial-09102026)
e [padrões visuais](../design-system/padroes.md#gestão-de-pedidos--lista-kanban-e-detalhe-09102026).

## Detalhes após confirmação — 08/10/2026

O próprio pedido abre o painel lateral diretamente. Pedido/Histórico, próxima ação
por ícone, Voltar discreto, edição inline, pagamento operacional e cancelamento contextual
substituem os blocos técnicos do editor confirmado. Pedidos cancelados têm consulta
separada com data crescente. Parametrizações ficam nos cadastros; pedidos iFood mantêm
ações oficiais, pendências e confirmação remota. [Contrato atualizado](../features/pedidos/ARQUITETURA.md#operação-simplificada-e-cancelamento-contextual--08102026)
e [execução](../features/pedidos/EXECUCAO.md).

Mapa conferido em 23/09/2026, base 2fac409. Catálogo comercial, clientes, composição, fiscal cadastral e formas comerciais; não pressupor fluxo operacional de pedidos vendidos.

## Rotas e componentes

Base: `src/app/(protegido)/vendas`. Nomes relativos abaixo pertencem a essa base.

- Preço inline de Produtos/Complementos: `produtos/preco-produto.tsx` mantém campo
  compacto, check adjacente somente quando alterado e confirmação explícita. Blur
  para fora do conjunto campo/check ou Escape restaura o valor salvo. O clique no
  check não cancela o rascunho; trava, revisão e conflito continuam no servidor.
- `lib/vendas/escolhas-grupo.ts` limita a adição pelo saldo agregado do grupo e pela
  repetição permitida. Pedido e simulador reutilizam `QuantidadeEscolha`; domínio
  `simularConfiguracao` mantém a validação autoritativa de mínimo/máximo no servidor.
- `lib/vendas/pedidos-pendencias.ts` identifica pendências comerciais antes de
  confirmar. Editor ativa a cobrança pertinente e `MensagemPendenciaFormulario`
  abre detalhes, destaca e conduz foco/rolagem. Não persistir orçamento quando a
  confirmação já tem pendência conhecida; salvar orçamento continua sem pagamento.

- /vendas, /vendas/produtos, /vendas/catalogo, /vendas/clientes
- /vendas/fiscal, /vendas/formas-pagamento, /vendas/importacao
- actions.ts e componentes nas subpastas; importação acessada dentro de Produtos
- Categorias no editor Produto usam `MultiselecaoCombobox`: popup ancorado ao campo,
  check discreto, tags removíveis e busca. Categorias inativas já vinculadas continuam
  visíveis, e a criação rápida preserva o rascunho. A gravação acontece no Salvar.
- A ficha técnica está disponível na listagem e dentro do editor do produto, em
  qualquer aba. `PreviaFichaProduto` reutiliza o gerador A4/PDF com os dados atuais
  do rascunho, sem salvar o cadastro. É um diálogo descendente: a Central suspende
  o editor enquanto a prévia está aberta e devolve rascunho/foco ao fechar. O foco
  inicial fica em Imprimir / salvar PDF para que Escape funcione sem entrar no iframe.
- A ficha-mestre contém composição, porções, quantidades e referências de montagem,
  tempo de preparo e observações. Grupos e alternativas comerciais não aparecem na
  prévia nem na impressão/PDF. A ficha de configuração conserva somente as escolhas
  efetivas e sua composição resolvida; o cadastro comercial dos grupos é preservado.
- Na coluna da foto, a ordem é imagem, categorias do produto, tempo de preparo e
  observações. Foto ampliada para coluna de 90 mm, mantendo referência 4:5.
  Ingredientes têm nome em 13 pt e especificação abaixo; categoria ocupa coluna
  própria entre nome e porção, em 8 pt/cor secundária. Não há alteração cadastral.
- Todas as fichas de produtos, inclusive de configuração, usam uma folha A4 paisagem
  com margens de 8 mm. `ficha-a4.ts` mede o conteúdo completo e reduz a escala para
  encaixar largura/altura, sem cortar ingredientes ou observações. Recalcula após
  carregar foto/fontes e antes de imprimir. A prévia aplica o mesmo ajuste no iframe,
  mantendo scripts bloqueados pelo sandbox. Conteúdo muito extenso reduz a fonte;
  papel/orientação/escala escolhidos manualmente no driver podem sobrepor o formato.

## Serviços

### Dashboard

`/vendas/bi` é a primeira seção. `/vendas` abre essa seção para usuários com
`vendas.bi`; as rotas anteriores permanecem disponíveis. Exportação, identificação
de compradores e custos têm recursos próprios na matriz central. As guardas de
servidor também protegem os filtros e os arquivos exportados.

`src/lib/vendas/bi-consultas.ts` projeta somente os campos necessários de pedidos,
itens vigentes e identidades históricas. A transação usa `RepeatableRead` e
`READ ONLY`. O domínio em `bi-dominio.ts` agrega com Decimal, deduplica identidades
legadas e fornece os mesmos indicadores para gráficos, detalhes e CSV. Detalhes
enviados ao navegador têm páginas de 25 linhas. A exportação completa é montada no
servidor, com BOM, separador ponto e vírgula e proteção contra fórmulas em textos.

A base comercial inclui nativos CONFIRMADO e históricos HISTORICO vinculados à
origem validada. Exclui estados cancelados, estornados, orçamentos e testes
explicitamente marcados. Estado final histórico indeterminado permanece na base
com aviso. Valor zero não define cancelamento. Reduções comerciais reconhecidas
entram uma vez. Parcelas sem detalhamento ficam separadas, sem rateio arbitrário.

Filtros de produto/categoria selecionam os pedidos que contêm esses itens. O ticket
mantém a receita integral desses pedidos. Recorrência usa o comprador identificado
e o histórico disponível até a data final; não usa o destinatário nem compras
posteriores. Nomes iguais não criam vínculos. Chaves históricas por pedido sem
identidade suficiente ficam fora dos indicadores de pessoas.

Custos atuais, estimativas de composição e pagamento informado não comprovam
custo histórico ou repasse. Fretes negativos históricos conservam sua classificação
de ajuste comercial. Endereços históricos de cobrança não são destinos confirmados.
Sem coordenadas confiáveis, o card conserva a distribuição regional disponível.
Consultar e exportar não alteram saldos, estoque, títulos ou conciliações.

O nome visível é Dashboard; `/vendas/bi` e `vendas.bi*` mantêm compatibilidade.
O período reutiliza o filtro da DRE, inclusive limites vazios. Cabeçalhos de
Produtos, Clientes e Entregas ordenam antes da paginação no servidor. Tipo PF/PJ
vem do cadastro e não do nome. Descontos são informativos e já compõem o líquido;
o desconto rateado nos itens não é somado novamente. O tempo médio de recompra
usa intervalos consecutivos até a data final. Ranking de clientes conserva a
permissão específica. A geocodificação regional do mapa é explícita, limitada e
transitória no Google já autorizado, sem coordenadas persistidas ou exportadas.

[Contrato, fontes e validação](../features/bi-vendas/SPEC.md).

### Navegação e vínculos fiscais

- **Cardápio** reúne Produtos (`/vendas/produtos`) e Complementos (`/vendas/catalogo`)
  usando `GrupoNavegacao` na lateral e no menu móvel. É agrupamento sem página própria;
  destinos e permissões existentes são preservados, com filtro de filhos e indicação ativa.
- Na lateral e no menu móvel, **Configurações** reúne `/vendas/formas-pagamento`,
  `/vendas/horarios` (**Horários de entrega**) e `/vendas/area-entrega`. São grupos
  de divulgação; as URLs, permissões e regras de agenda anteriores são preservadas.
- **Fiscal** reúne Grupos fiscais (`/vendas/fiscal`) e Vínculos fiscais
  (`/vendas/fiscal/vinculos`). Ambos usam `vendas.fiscal`; leitura e edição são
  autorizadas no servidor. A nova consulta seleciona apenas o cadastro fiscal,
  sem carregar preços, clientes ou cálculo de composição.
- Classificação comercial única: Produto (`PRINCIPAL`) permite venda avulsa;
  Complemento participa de produtos. A leitura de `OPCAO` equivale a Complemento;
  cadastros antigos com `PRINCIPAL` e outros papéis são Produtos. O mesmo Produto
  também pode pertencer a grupos, preservando ID e revisão. Opções de grupo sem
  `ProdutoVenda` vinculado não são cadastros fiscais independentes.
- Vínculos fiscais preserva a consulta dos papéis antigos, inclusive o mesmo ID
  nas duas abas quando houver múltiplos papéis legados. Essa compatibilidade de
  conferência fiscal não oferece outra classificação no cadastro comercial.
- Vínculos fiscais consulta também `fotoUrl` e nomes/atividade das categorias do
  produto, sem carregar preços/composição. Foto privada aceita visualização de
  `vendas.produtos` ou `vendas.fiscal` no endpoint, mantendo sessão e cache privado.
- Busca por nome/código/categoria/NCM/grupo; filtros Todos/Preenchido/Pendentes seguem
  os botões default/outline de Fornecedores. Preenchido significa NCM de oito dígitos
  e grupo vinculado no cadastro salvo, independentemente de `fiscalRevisado`.
  Isso não certifica a classificação nem substitui a conferência tributária.
- NCM e grupo são editados diretamente na linha, com check único de confirmação.
  Escolher grupo sugere parâmetros gerais, preservando NCM e campos individuais;
  modificar apenas NCM conserva os demais campos.
  Alteração confirmada desmarca a conferência, como no editor fiscal existente.
  `salvarFiscalVendaAction` conserva versão, transação e auditoria. Rascunhos capturam
  a versão de origem e permanecem em abas/filtros; conflito não apaga preenchimento.
  Enter no NCM confirma, Escape cancela e blur não salva. Trava por ID impede duplicatas.
  Confirmação acessível de sucesso só ocorre após a resposta; a mesma revisão é usada
  na outra aba. Coluna Salvar tem apenas check, verde enquanto houver rascunho
  diferente da base; erros permanecem junto do NCM e não são ocultados pelo botão.
  NCM aceita apenas 0–9, até oito caracteres ao digitar/colar; se preenchido, o servidor
  continua exigindo oito dígitos. Não significa consulta ao cadastro de códigos válidos.
  [Regra oficial da Receita Federal](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/ncm).
  Cabeçalhos Produto/Categoria reutilizam SortableTableHead: primeiro clique A–Z,
  segundo Z–A, nova coluna começa A–Z. Ordenação de consulta em pt-BR, sem distinguir
  maiúsculas/acentos; categoria usa os nomes exibidos (ou Sem categoria), com desempate
  por produto/ID. Mantém seleção ao trocar abas, busca e filtros; não grava ordem no
  catálogo nem perde rascunhos. A ordem original é preservada até o primeiro clique.
  Busca/filtros compartilham linha no desktop. As duas abas usam o mesmo colgroup,
  tabela fixa e alinhamento esquerdo, com rolagem interna em telas pequenas.
- Testes focados: `testes/layout/vendas-navegacao.test.tsx`,
  `testes/vendas/vinculos-fiscais-interface.test.tsx` e `vinculos-fiscais-pagina.test.tsx`.

- src/lib/vendas/dominio.ts, consultas.ts, persistencia.ts, configuracao.ts, cmv.ts, ficha.ts, ordem.ts, foto.ts
- src/lib/vendas/importacao.ts, importacao-dominio.ts, formas-pagamento.ts, persistencia-formas-pagamento.ts

## Banco de dados

ProdutoVenda → categorias/grupos/opções/componentes/preço único; CanalVenda → origem dos pedidos; ClienteVenda, GrupoFiscalVenda, FormaPagamentoVenda, IdentidadeExternaVenda, FotoProdutoVenda, HistoricoCadastroVenda.

## Regras importantes

- Produtos e Complementos compartilham a listagem em `produtos/produtos-client.tsx`.
  A ordem das colunas é identificação, Preço, Status e Ações. Status ocupa a penúltima
  coluna. As ações compactas permanecem no mesmo eixo na última coluna, com as
  permissões e a impressão de ficha existentes. A seta `ChevronRight` aparece antes
  da foto, no botão oficial de expansão com nome acessível e teclado nativo.
  A tabela conserva largura mínima no desktop/tablet e rolagem interna; no celular,
  identificação e preço ficam acima do status e das ações. A expansão abrange as
  quatro colunas. Nenhum preço ou status muda ao expandir.
- Interface oferece somente as classificações Produto e Complemento. Tipos internos
  legados são preservados, sem seletor de classes.
- Mínimo/máximo ficam no vínculo produto/grupo; Extras opcional, ilimitado, repetível.
- Produto e complemento usam somente `ProdutoVenda.preco` (Decimal 12,2). Canal identifica origem e segmenta relatórios. Confirmar explicitamente, nunca salvar por blur.
- Fiscal tem permissão própria; alteração comercial não sobrescreve fiscal nem equivale a emissão/homologação.
- Só escolhas efetivas entram no consumo variável; ocultar ingrediente na ficha não tira seu custo. CMV pendente não vira zero.
- Importação versionada/idempotente usa origem/loja/chave, não funde por nome. Preserva alterações locais.
- FormaPagamentoVenda é comercial; não substitui FormaPagamento do Financeiro/fornecedores.

## Integrações e cuidados

Composição de produtos reutiliza a [Tabela de Porções](insumos.md#tabela-de-porções)
por `ComposicaoPicker`. Digitar Porção aplica automaticamente a medida cadastrada;
Descrição é somente leitura. O campo numérico aceita 0,5, 2 e outros multiplicadores
positivos, usando a primeira base vigente para novas referências e preservando snapshots.
A linha segue Ingrediente >
Porção > Descrição > Qtd. > Custo e mostra medida resultante e consumo equivalente.
A especificação de compra do insumo fica exclusivamente em Suprimentos: não aparece
na composição, no cadastro rápido aberto por Vendas ou nas fichas de montagem,
inclusive na configuração personalizada. Descrição da porção é informação de montagem
independente e continua visível. A especificação própria do produto comercial não muda.
A unidade fica fixa dentro da Qtd., com custo textual em coluna própria. Editar Qtd. diretamente limpa
a referência, mantendo quantidade e custo. O nome não tem tipo nem unidade, inclusive em foco.
FM reutiliza Button ghost/icon-sm do desconto: aria-pressed e tooltip indicam a
ficha de montagem; não salva ao clicar. Qtd. manual limita a três casas; Porção e Qtd.
completam o zero inicial de ,5. Conversões e histórico mantêm precisão exata até nove
casas, sem arredondamento. Cadastro de porções exclusivamente em Suprimentos. O JSON `ComponenteProdutoVenda.porcao` guarda
medida/base/multiplicador; servidor valida consumo derivado e unidade. Estoque e custo
continuam usando a quantidade efetiva, e `observacaoPorcao` acompanha a montagem.
Editar/excluir a referência não altera produtos salvos. Quantidades legadas com mais
casas e observações livres históricas são preservadas até uma edição explícita.
`ComponenteRow.quantidadePorcao` transporta a string decimal exata calculada, sem ser
campo de banco. Unidade alterada mantém custo pendente até revisar a linha; digitar
Porção com uma base na unidade atual confirma sua unidade e quantidade.

Scripts iFood são cargas assistidas, não sincronização/autoridade recorrente. Não inferir receita, custo, fiscal nem estoque. Reutilizar EXECUCAO existente, sem TASKS concorrente.

## Complementos — cadastro e substituições por vínculo

`/vendas/catalogo` chama-se **Complementos**, dentro de Cardápio, com abas Complementos e Grupos de complementos. `catalogo/complementos-client.tsx` reutiliza `ProdutosVenda`: categorias, filtros, foto, expansão, status, edição, ordenação comercial e `PrecoProduto` com preço único/CMV. O escopo mostra somente complementos, com coluna Categoria em tags coloridas, Preço e CMV, sem impressão de ficha. A listagem é única; categorias funcionam como organização e filtro. O editor simples em `catalogo/editor-complemento.tsx` tem nome, foto, categorias, preço único e `ComposicaoProduto` sem FM. `FotoCampo` reutiliza envio autenticado e X oficial; envio fica no rascunho e bloqueia Salvar enquanto pendente. Complementos podem existir antes de receber um grupo; preço zero é escolha grátis. Permissões de Produtos continuam governando o cadastro, enquanto grupos usam Catálogo.

Categorias de Produto pertencem ao cardápio do site. Categorias de Complemento são opcionais e internas, com cor selecionada entre as variantes existentes de Badge. `CategoriaVenda.escopo/cor` e a unicidade por escopo isolam essas finalidades no servidor. A migration manual `20261021210000_categorias_complementos` copia categorias antigas utilizadas por complementos e transfere somente seus vínculos, preservando nome, atividade e ordem; incrementa a revisão dos cadastros afetados. Categorias de grupos continuam em `CategoriaGrupoComplementoVenda`, com criação rápida no editor e salvamento explícito.

`EditorGrupo` seleciona Produtos e Complementos pelo MultiselecaoCombobox oficial. Escolhas novas herdam preço/composição do cadastro; edição no grupo cria substituição desse grupo. O produto mantém ordem, limites e substituições locais. A seleção evita a autorreferência direta na UI e o servidor a recusa em transação.

Produtos, Complementos e Grupos têm aba **Disponibilidade**. `catalogo/disponibilidade.tsx` e `lib/vendas/disponibilidade.ts` mostram vínculos, grupos pausados, cadastro inativo e exclusões locais, além da origem da composição. Habilitação cadastral para venda avulsa não certifica sincronização externa. Dados e ações fictícios são usados no QA; referências visuais permanecem Em revisão.

`ProdutoVenda.preco` é o valor comercial vigente. `precoComplemento` e `PrecoProdutoVenda` permanecem exclusivamente como arquivo legado, sem leitura/escrita nos fluxos de preço. A exclusão autorizada de produto remove também os preços legados vinculados. `OpcaoComplementoVenda.composicao` substitui a composição por escolha no grupo; ausência herda o produto e seu multiplicador legado. `ProdutoGrupoVenda.ajustesOpcoes` guarda preço, composição e pausa locais, com precedência vínculo > grupo > padrão. Composição substituta já é por escolha e não reaplica o multiplicador. Porções e quantidade seguem a validação de ingredientes no servidor; referências/unidade/atividade dos insumos são conferidas em transação. Migration SQL aditiva `20261005010000_complementos_composicao`.

`precosOpcoes` (`complementos.ts`) herda o preço único do complemento quando `OpcaoComplementoVenda.usarPrecoPadrao` está ligado, antes das substituições locais. Não recebe canal. A migration aditiva `20261005120000_preco_unico` consolida o Site vigente, inclusive promoção e zero explícito; depois usa o valor disponível, audita antes/depois e incrementa revisão. Pedidos e opções anteriores são preservados. [Contrato e validação](../features/preco-unico/SPEC.md). Editar o preço da opção desliga a herança, conservando escolhas grátis. Migration aditiva `20261005043000_complementos_preco_canal` inicia a flag desligada. Grupos exibem ingredientes diretamente, sem seletor “Complemento para composição”; composição explícita funciona também sem `produtoId`. O vínculo interno preserva identidade e preços dos cadastros existentes. Carga inicial autorizada usa Extras do site como fonte e porções cadastradas como medida inicial, com backup, revisões, auditoria, transação e idempotência; não é teste sobre produção.

`catalogo/linha-complemento.tsx` dispõe nome, preço, status e X na mesma linha compacta; chevron discreto abre composição abaixo. No produto, cabeçalho e conteúdo do grupo são separados: opções abertas ocupam toda a largura, sem competir com Obrigatório/Mín./Máx. Em telas estreitas, a rolagem horizontal fica dentro da linha, preservando os controles e o nome acessível completo. Abrir/fechar mantém o rascunho e funciona por teclado. Grupo ativo e opção ativa deixam de ser checkboxes internos. Remoção local usa exclusões e oferece restauração; remoção no grupo preserva a opção inativa e seu histórico. Grupos podem ser retirados sem apagar o cadastro independente do complemento.
Pausa no produto oferece apenas este produto ou todos. A decisão fica no rascunho até Salvar. Escopo global inativa as opções do mesmo complemento em todos os grupos, confere revisões do conjunto completo, relê sessão/permissões de Produtos/Catálogo sob trava de acessos, serializa os cadastros e audita antes/depois de cada grupo. Conflito ou perda de acesso desfaz também o salvamento do produto. Reativação global conserva pausas locais de outros vínculos.

`opcoesEfetivas` em `dominio.ts` centraliza preço/atividade; `configuracao.ts` e `pedidos.ts` aplicam composição resolvida e congelam preço/composição nas escolhas e consumo do pedido. Novos itens de Pedidos não vendem complementos isoladamente: escolhas opcionais/grátis ficam dentro do produto. Chaves e consultas de porções avulsas históricas continuam legíveis; revisão de uma porção já confirmada conserva a fronteira legada, sem abrir novos itens avulsos. Prévia sintética `testes/visual/vendas.html?secao=catalogo`; testes `complementos.test.ts`, `interface.test.tsx`, `configuracao.test.ts`, `integracao.test.ts` e `pedidos-integracao.test.ts`. Referência visual Em revisão.

## Testes relevantes

testes/vendas, VENDAS_BANCO_TESTE para integração local; consumidores de Insumos/Design ao alterar composição, ordenação ou edição.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Referências

### Ordenação alfabética de Vínculos fiscais — 01/10/2026

- Funcional `667390d` sobre `62594e9`: somente consumidor fiscal, testes e
  documentação; SortableTableHead existente, sem padrão novo, schema ou persistência.
- Node 22.23.3: build webpack com tipos aprovado, ESLint sem erros/avisos,
  lint:design aprovado (8 bases/267 consumidores). Dezenove testes fiscais aprovados;
  após corrigir opção de tipagem nos testes, os treze de interface passaram novamente.
  Sem banco operacional ou consultas externas; nenhuma integração opt-in executada.
- Prévia sintética 1280px/390px: cabeçalhos, indicadores e ordem A–Z/Z–A,
  alinhamento esquerdo e rolagem interna conferidos. Teclado, acentos, desempate,
  busca, duas abas e rascunhos cobertos em testes; ordenar não grava no catálogo.
- Backup privado `etiquetas-fiscal-ordem-20261001-01`: índice (807 linhas), leitura
  integral e checksum verificados; imagem `grazing-fiscal-ordem-anterior:20261001`.
  Evidência pós-publicação permanece local, sem outro deploy só documental.

### Ajuste de NCM e geometria fiscal — 01/10/2026

- Incremento funcional `2d45ed2`, integrado à base publicada `c3cddd1` de Entregas.
  Onze arquivos no escopo de UI, testes e documentação; sem alteração própria de
  schema, migrations, permissões ou gravação em dados reais.
- Na base `53dfbd8`: 344 testes aprovados em Vendas/Design/Layout, 67 opt-ins de
  banco ignorados. Após integrar Entregas: 95 testes aprovados nos 12 consumidores
  afetados, sem falhas; ESLint focado sem erros/avisos e lint:design aprovado
  (8 bases e 267 consumidores). Build webpack e checagem de tipos aprovados na
  revisão integrada. Client Prisma local atualizado à base, sem conexão
  operacional; schema validado. Opt-ins ignorados não equivalem a testes aprovados.
- Prévia sintética: desktop 1280px e celular 390px. Colunas das duas abas têm as
  mesmas posições/larguras; todos os cabeçalhos/células alinham à esquerda.
  Busca e filtros compartilham eixo/altura no desktop; tabela rola internamente no
  celular, com clientWidth/scrollWidth de 390px. Check verde pendente alinhado no
  início da célula; coluna Salvar sem texto. Abas e filtros usam botões com 44px,
  padding 20px e raio oficial de Button. Referência visual humana Em revisão.
- Regra de NCM conferida na Receita Federal: código numérico de oito dígitos.
  Testes cobrem letras ignoradas, zeros iniciais, limite, colagem formatada,
  nenhum salvamento no blur, confirmação e recuperação de erros/conflitos.
- Backup privado `etiquetas-fiscal-alinhamento-20261001-02`: índice (807 linhas),
  leitura integral e checksum verificados. Imagem `grazing-fiscal-alinhamento-anterior:20261001-integrado`
  preserva a base atual de Entregas; não houve restauração do banco.

### Conferência do ajuste publicado — 01/10/2026 (registro local)

- Publicado `62594e9` (funcional `2d45ed2`) sobre `c3cddd1`.
  Build e tipos do Dokploy aprovados; tarefa `qk7fy56dooxa`, contêiner
  `55a15833698e`, Running estável por cerca de dois minutos, zero reinícios.
- UI autenticada: colunas com posições/larguras idênticas entre Produtos e
  Complementos, tudo à esquerda, Salvar sem texto e check no início da célula.
  NCM numeric/[0-9]{8}/maxlength=8 conferidos nos campos; sem edição de registros.
  Busca/filtros no mesmo eixo; abas e filtros com altura 44px, padding 20px e
  raio oficial. Seleção azul e nenhuma mensagem de erro na página.
- Configuração fiscal preservada; migrations em dia. HTTPS login 200 e rotas
  fiscais/fotos sem sessão 307. Nenhuma restauração de banco ou operação real.
  Evidência pós-deploy mantida localmente, sem nova publicação apenas documental.

### Validação da edição fiscal na linha — 01/10/2026

- Incremento funcional `ec8215f`, integrado à base publicada `8ab9fed`, preservando
  as publicações concorrentes de Pedidos e Horários. Sem migration própria,
  dependências novas ou gravação de dados operacionais para teste.
- Node 22.23.3: build webpack e checagem de tipos aprovados na base final `8ab9fed`
  com o incremento `ec8215f`. ESLint focado aprovado, sem erros ou avisos;
  `lint:design` aprovado (8 bases e 257 consumidores).
- Regressão integral sobre `372c7c3`: 183 arquivos aprovados, 22 ignorados e um
  com falha; 1.348 testes aprovados, 284 ignorados e duas falhas de placeholders
  legados de Insumos em `testes/cadastros/status-listas.test.tsx`, também reproduzidas
  na base anterior. Integrações opt-in ignoradas não equivalem a testes aprovados.
- Integração sobre `41a1ab4`: 496 testes aprovados, 79 ignorados e dois timeouts
  de interface de Produtos/Perfis. Perfis passou isoladamente; em Produtos houve
  alternância dos cenários que excederam cinco segundos e falha ao iniciar worker.
  A tentativa diagnóstica com threads também excedeu o limite nos dois cenários.
  Nenhum limite ou teste foi afrouxado; esses consumidores não mudaram nesta tarefa.
- Base final `8ab9fed`: os cinco arquivos de vínculos fiscais, página, fotos,
  padrões e domínio de horários passaram (38 testes). A interface de horários,
  inalterada por este incremento e sem uso de AcoesEdicao/Tabs, apresentou quatro
  timeouts e uma falha de feedback. Essa limitação permanece registrada.
- Edição fiscal, filtros, foto/categoria, leitura sem edição, autorização das fotos,
  teclado, conflito, falha de rede, revisão compartilhada e bloqueio de duplicatas
  aprovados. Prévia isolada: check com salvamento fictício, abas/filtros azuis,
  desktop 1280px e celular 390px; tabela rola internamente, sem ampliar a página.
  Variantes documentadas na Central; referências visuais permanecem Em revisão.
- Backup privado `etiquetas-fiscal-inline-20261001-03` com índice, leitura integral
  e checksum verificados; imagem anterior fixada em
  `grazing-fiscal-inline-anterior:20261001-final`. Conferência pós-deploy fica
  registrada localmente, sem disparar nova publicação apenas para essa evidência.

### Conferência pós-publicação — 01/10/2026 (registro local)

- Publicado `32b88e2` (incremento funcional `ec8215f`), sobre `8ab9fed`.
  Dokploy: build e tipos aprovados; tarefa `lf2udpjsbr29`, contêiner `bb5d96b7983b`,
  Running por mais de dois minutos, zero reinícios, versão confirmada.
- Configuração fiscal preservada integralmente pelo helper; schema atualizado.
  Sem restauração de banco, alteração de vínculos reais ou consulta fiscal externa.
- UI autenticada: NCM/grupo editáveis na linha e check; colunas Categoria/Salvar,
  abas Produtos/Complementos, filtros Todos/Preenchido/Pendentes com seleção azul.
  Sem botão Editar ou checkbox; fotos carregadas e nenhuma rolagem horizontal da página.
- HTTPS: login 200; vínculos, grupos e fotos sem sessão redirecionam (307).
  Este registro local não dispara outra publicação.

### Validação de Configurações e Vínculos fiscais — 30/09/2026

- Código funcional `2a5addc`, sobre a base de produção `93ed64a`; alteração limitada
  à navegação, rótulo de horários, consulta/interface fiscal e documentação/prévia.
  Sem schema, migrations ou modificação de dados operacionais.
- Node 22.23.3: `next build --webpack`, `lint:design`, ESLint focado,
  `next typegen` e `tsc --noEmit --incremental false` aprovados.
- `npm test -- --maxWorkers=1`: 178 arquivos aprovados, 22 ignorados e um com falha;
  1.316 testes aprovados, 282 ignorados e duas falhas. As duas falhas de
  `testes/cadastros/status-listas.test.tsx` também ocorrem na base `93ed64a`
  (3 aprovados/2 falhas): o teste procura o placeholder antigo `Buscar insumo...`.
  Nenhum código ou teste de Insumos foi alterado nesta tarefa.
- Testes de navegação e vínculos fiscais passaram. Bateria final e reprodução da
  base anterior em contêineres com `NODE_ENV=test`, sem rede, sem banco operacional;
  integrações opt-in ignoradas não são consideradas aprovadas.
- Prévia `testes/visual/vinculos-fiscais.vite.config.mts`: desktop 1440×1000 e
  celular 390×844, abas, edição/salvamento simulado, Configurações expansível e menu
  móvel conferidos. Sem rolagem horizontal da página; tabela conserva rolagem interna.
  Referência visual humana permanece Em revisão.
- Preparação de publicação autorizada: backup privado `etiquetas-fiscal-20260930-01`,
  índice e leitura integral verificados; imagem anterior fixada em
  `grazing-fiscal-anterior:20260930`. Conferência pós-deploy deve ser registrada
  localmente, sem nova publicação somente para atualizar essa evidência.

[Execução vigente](../execucao-vendas.md), [análise inicial histórica](../analise-vendas-takeat-ifood-2026-09-22.md), [Insumos](insumos.md).

## Entregas por rota

Configuração e simulador somente em Vendas & Pedidos → Configurações → Entregas (`/vendas/area-entrega`); a rota antiga redireciona. `entregas.ts` compartilha o cálculo com Pedidos; `entregas-dominio.ts` define a matriz de frete por faixa/veículo em centavos; `entregas-veiculos.ts` soma slots e escolhe o único veículo com capacidade inclusiva aplicável; `entregas-mapas.ts` mantém Google privado. Confirmação/revisão verificam recibo vinculado e conservam snapshot comercial; custo logístico usa Fornecedor opcional e evento próprio, sem novo financeiro. Consulte [operação e limites](../features/entregas/OPERACAO.md) e [execução](../features/entregas/TASKS.md), incluindo retenção Google e contingência com permissões separadas.

## Pedidos, produção e agenda

- [Execução](../features/pedidos/EXECUCAO.md) e [contratos](../features/pedidos/ARQUITETURA.md) registram evidências e limites. Novos pedidos operacionais usam modo imutável `EXTERNO`: sem título, cobrança, caixa, crédito, devolução ou emissão no HUB. Pedidos anteriores permanecem `HUB`; M2 conserva suas validações e restrições de ativação.
- `src/lib/vendas/pedidos.ts` calcula valores no servidor e fotografa comprador, destinatário, itens e escolhas; revisão explícita preserva antes/depois. Produto usado não pode ser excluído fisicamente. Referência externa usa origem + estabelecimento + pedido, com unicidade no banco.
- Revisões após preparo usam `pedidos-revisao-operacional.ts`: preservam o ID da
  execução compatível e registram `OPERACAO_REVISAO` quando quantidade executada
  sai da encomenda. `pedidos-execucao-dominio.ts` é a projeção comum dos apontamentos
  menos esses ajustes; o consumo original permanece no estoque. O excedente exige
  destino em ocorrência, e um novo aumento precisa de nova execução. Composição
  incompatível cria novo item e conserva o anterior no histórico. A interface envia
  `itemOrigemId` para manter a identidade após remoções/reordenação; servidor valida
  pertencimento e duplicação. Pedido em rota exige retorno/falha antes da revisão;
  entregue continua no pós-venda. Alterações de instruções preservam antes/depois.
- Falha de entrega é ocorrência `FALHA_ENTREGA`, vinculada à rota ainda não
  concluída. `NOVA_TENTATIVA` exige conferência explícita dos produtos e resolve
  essa falha na mesma transação da nova saída. Correção sequencial de etapa não
  registra nova tentativa e conserva `entregueEm`. Devolução física anterior à
  primeira entrega ajusta a quantidade executada para exigir reposição/preparo e
  expedição correspondentes; o estoque mantém saídas/retornos anteriores. Ações
  ficam no detalhe do Gestor, em Ocorrências e reagendamento. Registros externos
  não ganham efeitos financeiros por causa dessas ações.
- Cancelamento comercial considera a etapa operacional atual, além de status,
  origem, permissão e versão: `ENTREGUE` bloqueia, enquanto um retorno autorizado
  permite cancelar sem apagar a primeira entrega. Isso não reabre execução física
  ou edição comercial e não representa estorno automático de pagamento ou consumo.
- Preço-base zero é permitido quando há configuração obrigatória paga válida; cadastro, consulta e confirmação compartilham essa regra. Total não positivo continua recusado na confirmação.
- No editor de Pedidos, cada produto novo apresenta somente grupos com mínimo
  efetivo maior que zero (`limitesEfetivos`). Escolhas opcionais já existentes no
  rascunho/pedido permanecem acessíveis como seleção anterior, sem exclusão silenciosa.
- `pedidos-catalogo.ts` oferece somente Produtos ativos, sem filtro por canal. Opções legadas são lidas como Complementos. Complementos são escolhas internas; porções avulsas aparecem apenas nos pedidos históricos. Grupo não recebe identidade de produto fictícia.
- A opção avulsa é vendida por unidade/porção, com preço do grupo. O servidor valida
  a origem (produto/grupo/opção), opcionalidade, exclusões e disponibilidade do cadastro,
  e calcula preço/composição sem confiar nos dados de preço enviados pelo navegador.
  O snapshot `produtoSnapshot.complementoAvulso` conserva origem, nomes, multiplicador
  e unidade do produto; a composição aplica o multiplicador uma vez por porção.
  Revisão, gestor e consulta agrupada preservam essa identidade e os pedidos anteriores.
- A confirmação exige preço único positivo ou configuração obrigatória paga. `PrecoProdutoVenda.ativo` é legado e não participa do contrato. Revisões preservam preços/composição de itens comerciais inalterados, usando `pedidos-preco-historico.ts`; mudar somente origem ou observação não renegocia uma venda antiga.
- Produção e calendário são modos do gestor dedicado. Os favoritos antigos redirecionam para o gestor; a consulta restrita de produção e a permissão `vendas.pedidos.producao` continuam nos serviços operacionais. Materiais exigem também Inventário. A agenda usa a data civil de entrega e o fuso do pedido; reagendamento é explícito e auditado.
- Impressão do Gestor/Quadros e comanda/resumo operacional usam `src/lib/vendas/impressao-pedido.ts`: 80 mm padrão, área útil de 72 mm, margens 4 mm e altura contínua do driver. Produção mantém A4 opcional. Número do pedido, data civil/janela, quantidade e observações gerais/dos itens têm destaque preto sólido. A comanda de produção seleciona explicitamente observações dos itens, sem expor snapshots pessoais/financeiros; revisão e avisos de não preparar são preservados. No navegador/driver escolher bobina 80 mm, escala 100% e desativar cabeçalhos/rodapés. Contrato visual em `docs/design-system/inventario.md` (EX-IMP-02), Em revisão. HTML pelo navegador não homologa impressão física nem usa o conector Raspberry de Etiquetas. Reserva e consumo continuam no livro de estoque existente; sem composição, venda/agenda são permitidas e execução física fica pendente.
- Novo Pedido abre como rota interceptada em `src/app/(protegido)/vendas/pedidos/@modal/(.)novo`, com o mesmo conteúdo de `novo/conteudo.tsx` usado pela URL direta. O cadastro rápido exige `vendas.clientes:adicionar` no servidor e salva o endereço de cobrança no cliente; a cobrança pode ser ajustada para um pedido sem alterar o cadastro, e a confirmação conserva seu snapshot, destinatário, entrega, observações por item, frete, outros custos e forma de pagamento informada. A busca do catálogo agrupa por primeira categoria, usando o Combobox oficial. CEP brasileiro consulta ViaCEP; Logradouro, Bairro, Cidade e UF são somente leitura, inclusive em falha de consulta (corrigir CEP/tentar novamente). Número e complemento permanecem manuais; endereço estrangeiro conserva preenchimento manual obrigatório. Respostas antigas são ignoradas ao trocar CEP/país ou ocultar entrega. Modo Retirada oculta o endereço de entrega e o envia nulo ao salvar; cobrança permanece. Copiar cobrança leva endereço, nome e telefone da seleção para a entrega escolhida, com feedback discreto. Qtd. usa InputComSufixo com unidade fixa. Cupom permanece indisponível até existir contrato comercial. No modo `EXTERNO`, a forma informada não cria cobrança nem quitação.

### Gestor e horários (27/09/2026)

- Selecionar Vendas abre `/vendas` no HUB, inclusive para quem tem somente acesso a Pedidos. A entrada aceita no servidor uma seção de Vendas efetivamente autorizada; não concede acesso aos outros cadastros. Reutiliza `BarraAcoes` e `buttonVariants`, como Produção. Somente clicar no atalho de Pedidos, indicado por seta externa e nova aba, abre `pedidos.grazinghub.com.br/vendas/pedidos`: cinco colunas iguais por etapa (Novo pedido, Em preparo, Pronto para entrega / retirada, A caminho, Entregue), com Kanban como padrão e modos Calendário/Lista. `?visao=lista` continua compatível. Entregues exibidos no quadro por sete dias; pedidos retornados à operação continuam visíveis. Calendário mantém mês/semana/dia e bloco explícito sem data. Busca, filtros e paginação são compartilhados.
- `listarPedidos`, em `pedidos.ts`, fornece o DTO seletivo do gestor após autorização `vendas.pedidos`. Orçamentos usam o JSON validado do rascunho; confirmados usam snapshots. A contagem é de **outros pedidos confirmados** do comprador, sem confundir destinatário com titular. `pedidos-gestor.ts` conserva a consulta anterior, e a projeção restrita de Produção permanece separada.
- `/vendas/horarios` configura os horários de entrega com permissão `vendas.horarios`: sete caixas horizontais (segunda a domingo), cópia independente de outro dia, fechamento e várias opções com início/término em passos de cinco minutos e/ou texto. Texto preenchido é o valor escolhido no pedido; a faixa numérica aparece como apoio no seletor. Sem texto, a opção é `HH:mm–HH:mm`. Término `24:00` é permitido, início e término pertencem ao mesmo dia. Datas desativadas bloqueiam entregas; datas especiais substituem a semana, inclusive dia fechado. Uma data não pode estar nas duas listas. Salvar/Cancelar são explícitos; blur não persiste.
- `horarios-entrega-dominio.ts` valida a estrutura `semana/desativadas/especiais`; `pedidos-horarios-dominio.ts` aceita também a grade anterior 30/60 (`dias` em ordem domingo a sábado). A leitura não regrava dados. `converterHorariosEntrega` preserva as opções anteriores ao abrir o editor e ao consultar pedidos; o novo formato usa segunda a domingo. `ConfiguracaoLoja.horariosPedidos` e `versaoHorariosPedidos` continuam sendo a única configuração, sem migration nova. Nulo mantém o comportamento anterior até o primeiro salvamento. Confirmações/reagendamentos e alterações de agenda externas são validados no servidor; histórico inalterado permanece válido.
- `pedidos-horarios.ts` grava com autorização transacional, versão otimista e trava compartilhada com a validação de pedidos. O formulário envia UUID reutilizado em tentativas do mesmo conteúdo; `HistoricoCadastroVenda` registra antes/depois, autor, versão e hash. Repetição não gera novo evento; chave com conteúdo/autor divergente é recusada. `HorarioEntregaCampo` usa o Select da Central em novo pedido e reagendamento e preserva o valor antigo visível, mesmo que indisponível na configuração atual.
- Na agenda, um único seletor por dia combina fechado/personalizar/copiar. `copiadoDe` opcional preserva o dia de origem (índice segunda a domingo); cópia é um retrato independente, sem sincronização futura com a fonte. Alterar/adicionar/remover/reordenar qualquer faixa limpa essa origem e muda para Personalizar. A ordem enviada pela `ListaOrdenavel` é preservada nos horários do pedido. Chaves locais de arraste são descartadas pelo validador e não são persistidas. Exceções por data vêm antes da semana; Salvar/Cancelar seguem explícitos, sem nova migration.
- `encerrarPedidoManual` permite DECLINADO apenas de orçamento e ESTORNADO de CONFIRMADO/CANCELADO, somente no modo EXTERNO, com permissão de cancelamento, motivo e referência obrigatória para devolução. Trava de pedido, versão, chave/hash e evento preservam histórico e impedem repetição. Libera apenas reservas não consumidas; não desfaz execução física nem gera/baixa títulos, caixa ou devolução bancária. HUB legado mantém seus tratamentos financeiros.
- Migration aditiva `20260927090000_pedidos_horarios` acrescenta configuração/versionamento e amplia a constraint dos estados comerciais, sem reclassificar registros existentes. Aplicação operacional permanece pendente de publicação autorizada.

## Gestor dedicado — 30/09/2026

O HUB oferece um único atalho Gestor de pedidos para `pedidos.grazinghub.com.br`.
Quadros (padrão), Calendário e Lista compartilham busca/filtros e as cinco etapas
Em preparo, Pronto, Em rota e Entregues. Produção e calendário antigos redirecionam
para os modos correspondentes; serviços e permissões existentes são preservados.
[Host/identidade](../pedidos-subdominio.md) · [Contrato operacional](../features/pedidos/ARQUITETURA.md)
· [Padrão visual](../design-system/padroes.md).

Configurações do Gestor abre popup com a chave **Movimentar estoque**, desligada por
padrão. Administrador pode ligar a baixa automática e escolher o local de origem;
saldo negativo é permitido. Consulta, permissões das etapas e financeiro permanecem
separados. A política, auditoria e ausência de baixa retroativa estão no
[contrato operacional](../features/pedidos/ARQUITETURA.md#chave-de-estoque-do-gestor--01102026).

### Cliente e pagamento comercial no orçamento

`cliente-pedido.ts` valida o cadastro inline; `salvarClienteNaTransacao` em
`persistencia.ts` permite que `pedidos.ts` salve cadastro, orçamento e auditorias
atomicamente, sob lock vendas-cadastros e permissão vendas.clientes/adicionar para
criação ou vendas.clientes/editar para atualização explícita de cadastro selecionado.
Idempotência é conferida antes de gravar cliente; falha do salvamento do pedido desfaz
o cadastro e sua auditoria. `PedidoEntrada.clienteAtualizacao` transporta ID/revisão,
dados gerais e somente os endereços efetivamente editados. E-mail é somente leitura
no pedido e conferido contra o banco; regras de pagamento, status e observações
cadastrais não podem ser sobrescritos por esse contrato. A revisão retornada, inclusive
em repetição idempotente, vem da operação salva, evitando reutilizar uma revisão mais
nova de outra tela. Confirmação usa os dados atualizados no salvamento do orçamento.
`pedidos-pagamento-comercial.ts` valida formas ativas de Vendas e snapshots em
PedidoVenda.pagamentoInformadoSnapshot (migration aditiva 20261001100000).
Snapshot é comercial; não cria título/caixa/DRE. Datas de boleto não dependem da
entrega. Revisão inalterada preserva nome/versão histórico, inclusive inativo.
`paises.ts` centraliza países ISO e nomes pt-BR sem nova dependência.

### Variante compacta do Gestor — 01/10/2026

Somente o host Pedidos utiliza o shell operacional sem lateral, com marca em box
e header fino. Vendas continua no HUB e somente o atalho externo abre o Gestor.
Toolbar reutiliza BarraAcoes compacta, CampoBusca arredondado, Popover de filtros
com somente canal e aplicação imediata por checkbox, e SeletorVisualizacaoOperacional
para Quadros/Calendário/Lista. A busca e o canal compartilham URL/paginação; o popup
permanece aberto após selecionar, sem Aplicar/Limpar. A cor muda só no gatilho do modo.
Cartões resumem cliente, canal, detalhe/impressão e Para: destinatário; esconder
itens não modifica snapshots, detalhe ou impressão. TagCanalVenda identifica
Site/iFood/GF (Giuliana Flores) por aliases explícitos, sem inferir status.
Contratos e exceção DS-PED-COMPACTO-01 na [Central](../design-system/padroes.md),
com referências Em revisão. Sem alteração dos serviços, cálculos ou permissões.

Slots de entrega: `ProdutoVenda.slotsEntrega` nullable, inteiro 0–999999 por unidade, editado em Composição. Vazio exige configuração; zero indica ausência de ocupação. Quantidades e produtos vinculados a opções/complementos entram na soma de precisão seis; apenas a soma final fracionária é arredondada para cima. Veículos ativos usam capacidades inclusivas sem sobreposição para a indicação automática; o operador pode escolher outro veículo ativo por pedido. Frete usa a última faixa de km como cobertura e um preço por veículo. Novo Pedido reúne veículo e frete após os produtos, com detalhes/justificativas no Dialog existente. Embalagens/prioridades antigas permanecem apenas para compatibilidade de dados e snapshots; não aparecem na configuração vigente. Revisões sem nova decisão preservam o histórico, inclusive slots por unidade registrados antes de mudança no catálogo. [Operação e requisitos](../features/entregas/OPERACAO.md).

Cálculo do frete: `pedidos-frete.ts` consulta somente catálogo/logística, separado de `calcularPedido` e suas regras de confirmação. Produtos/quantidades e endereço bastam, sem cliente salvo, canal, destinatário, cobrança, pagamento ou agenda. Escolhas obrigatórias podem estar incompletas durante a simulação; preços e slots são refeitos no servidor, nunca aceitos do navegador. Complemento é opcional em cobrança e entrega, em Clientes e Novo Pedido; limites de tamanho e demais campos obrigatórios são preservados. Recibo sem cliente aceita posterior cadastro com as mesmas entradas; recibo de cliente identificado continua vinculado a ele. Contrato detalhado em [Entregas](../features/entregas/SPEC.md).

## Clientes — cadastro, consultas e condições comerciais

- `clientes/clientes-client.tsx` compõe a experiência de Insumos com `CampoBusca`, filtros imediatos PF/PJ/Todos e status, `Card`/`Table`/`SortableTableHead`, ordenação em três estados, paginação local de 25 e uma linha expandida. Ações/status não expandem a linha. Dados, regras, histórico e crédito usam `Tabs`; edição salva explicitamente e abre a aba do campo inválido.
- PF/PJ/Todos usam `FiltroOpcoesContadas`; quantidades respeitam busca e status,
  antes da paginação, sem zerar a outra opção ao selecionar um tipo. As quantidades
  do status respeitam busca e tipo, ignorando apenas o status selecionado.
- Clientes alinha os conteúdos à esquerda, incluindo quantidade, valores monetários, estado vazio e histórico. Ações de linha usam `GrupoAcoes alinhamento="inicio"`; preservam-se algarismos tabulares e os controles compartilhados.
- `clientes/campos-cliente.tsx` reutiliza `CamposClientePedido` e `CamposEnderecoPedido`, com Nome Completo em PF, Nome Fantasia em PJ, contato e destinatário com nome completo, aniversário e telefone em campo único (`CampoTelefone`). A identidade da Principal acompanha as Informações gerais, com titular fixado e somente leitura na cobrança. Adicionais conservam identidade e telefone próprios. A Principal usa o telefone geral. `validarClienteCadastro` aplica as mesmas regras no servidor conservando ID, versão e todos os endereços; campos legados de nome/país recebem a representação compatível, sem regravar na leitura. O primeiro endereço é Principal e não pode ser removido. Endereços adicionais são Cobrança 2…250 e podem faturar para outro titular PF/PJ. O limite compartilhado fica em `LIMITE_COBRANCAS_CLIENTE`.
- Novo cliente e Novo pedido exigem a escolha explícita de Pessoa Física/Pessoa Jurídica antes de liberar o cadastro; `TipoClientePedido` fica ao lado da busca no pedido. `tipoEscolhido` é transitório, rejeitado quando falso na validação e nunca persistido. PF usa nome + sobrenome como `ClienteVenda.nome`; PJ usa nome fantasia, sem recompor a identidade pelos nomes pessoais. PJ apresenta razão social, CNPJ, I.E. e contato separado; PF não apresenta campos empresariais. Telefone, e-mail e nascimento são comuns. `CampoTelefone` (em `novo-cliente-pedido.tsx`) junta DDI +55, DDD e número de oito ou nove dígitos com máscara progressiva `+55 (11) 97658-6412`, aceita colagem com DDI/pontuação e grava `+55` seguido só dos dígitos; o telefone do destinatário usa o mesmo campo. Servidor: cliente exige DDI 55 + DDD + 8/9 dígitos; destinatário é opcional e, quando gravado, precisa estar completo (`exigirTelefoneDestinatario`), enquanto a leitura de rascunhos/snapshots antigos conserva o texto anterior. Formatação compartilhada em `src/lib/vendas/telefone.ts`. CPF, contato e aniversário conservam sua obrigatoriedade anterior.
- `nomeContato`/`sobrenomeContato` persistem separadamente para conservar nomes compostos; `contato` mantém o nome completo para buscas e snapshots. Cadastros antigos sem esses campos exibem representação do contato anterior, sem regravar nem reinterpretar `primeiroNome`/`sobrenome` de PJ. Entradas antigas que omitem os novos campos os preservam. Migration SQL aditiva `20261001220000_clientes_contato_identidade`; nenhuma transformação de dados anteriores.
- CEP brasileiro consulta ViaCEP ao sair do campo com oito dígitos; abrir cadastro não consulta nem reescreve dados. Em endereço brasileiro, logradouro, bairro, cidade e UF ficam somente leitura, conforme Novo Pedido. Trocar CEP limpa esses campos; trocar país limpa também CEP. Número e complemento ficam editáveis. Falha mantém as travas e permite tentar novamente; consultas antigas são descartadas e alterações simultâneas preservadas. País estrangeiro mantém preenchimento manual. `src/lib/vendas/cep.ts` compartilha a consulta, enquanto as ações de Clientes/Pedidos mantêm suas permissões próprias; salvar cliente aguarda consultas em andamento.
- `src/lib/vendas/clientes-consulta.ts` carrega todo o catálogo para busca/filtros locais completos. Métricas somam pedidos comerciais CONFIRMADO, inclusive entregues, e HISTORICO ativo com origem `HISTORICO_LEGADO` ou referência `grazing-legado-orders`. Cada pedido entra uma vez na contagem e na soma Decimal de `PedidoVenda.total`, sem usar itens, pagamentos informados ou lançamentos financeiros. Cancelados, declinados, estornados, rascunhos e HISTORICO_REVERTIDO não entram. Último pedido usa a maior data entre confirmação dos pedidos atuais e criação original (`createdAt`) dos históricos. O total é comercial, não comprova recebimento e não desconta devoluções/crédito. Sem permissão de consulta de Pedidos, métricas não são consultadas nem enviadas.
- `clientes/historico-actions.ts` exige consulta de Clientes e Pedidos antes da busca. Histórico carrega ao abrir a aba, com 25 registros por página e links ao detalhe; inclui cancelados/declinados/revertidos com status e exclui rascunhos. A ordenação ocorre no banco antes da paginação: data original de criação para históricos; confirmação, ou criação quando não confirmados, para os demais; ID decrescente desempata. O DTO informa data do pedido e base da data, separadas da entrega. Históricos mostram o número original positivo e não recebem confirmação ou entrega fictícia. Entrega realizada usa fuso do pedido; prevista conserva data civil e janela. Último pedido usa fuso da empresa. Carteira/extrato conserva suas permissões financeiras anteriores.
- Nomes novos usam `clientes-identidade.ts`: iniciais maiúsculas e preposições minúsculas. Cadastros existentes conservam a grafia humana. A correção histórica só formata automaticamente quando a criação está comprovada por auditoria de cadastro e atividade AUTOMACAO do lote, sem edição posterior ou diferença nos campos protegidos. Trocar PF/PJ preserva nome/sobrenome pessoais e os transporta para os campos de contato; não transporta CPF para CNPJ. Empresa informada, marcador empresarial no nome ou domínio corporativo comprovado permitem PJ com CNPJ pendente. Provedor pessoal de e-mail não comprova empresa. Documento e razão social não são inventados; uso fiscal continua sujeito à validação fiscal própria do pedido e seus snapshots.
- `ContatoClienteVenda` conserva cada comprador da empresa, inclusive nome/sobrenome, contato e proveniência. A aba Contatos consulta só filhos ativos e exibe Nome Completo, sem editar ao abrir nem apagar os campos legados de nome/sobrenome. A busca de Clientes também considera nome, e-mail e telefone desses contatos. CNPJ comprovado permite empresa canônica única; aliases preservados usam `unificadoEmId` e ficam fora da listagem cadastral, sem apagar registros. Histórico/gestores preservam a leitura dos aliases. Totais usam somente o cliente final de cada pedido, sem somar aliases novamente. Unificação só religa históricos comprovados por pedido; snapshots originais permanecem intactos e relações operacionais/crédito impedem desativar o cliente de origem.
- `ClienteEntrada.regrasPagamento`: `formasPagamentoIds: null` habilita todas as ativas, `[]` nenhuma; prazo e limite de crédito nulos não restringem. Todo cliente começa com R$ 50.000,00 de crédito total permitido em aberto (`LIMITE_CREDITO_ABERTO_PADRAO`, default da coluna); a migration `20261005210000_clientes_limite_credito_padrao` aplicou esse valor a todos os cadastros existentes, inclusive limites manuais, com histórico `CLIENTE_LIMITE_CREDITO_MIGRACAO` e versão incrementada (decisão do usuário em 05/10/2026). O cadastro pode alterar o limite depois. Zero dia exige boleto até a entrega; crédito zero impede aumento de dívida. Prazo aceita 0–3650 dias corridos. Edição legada que omite regras preserva as existentes. Versão/transação/auditoria são mantidas em `salvarClienteNaTransacao`.
- No modo financeiro HUB, `pedidos-regras-pagamento.ts` valida formas, prazo e dívida em confirmação, revisão, reagendamento, ajuste de vencimento e emissão de boleto. Trava compartilhada com o cadastro serializa a conferência; dívida usa precisão Decimal e exclui cartão já capturado (obrigação da intermediadora), sem confundir carteira de crédito. Redução da dívida existente é permitida mesmo acima do novo limite. EXTERNO conserva seu contrato comercial sem inferir cobrança ou dívida local.
- Migration SQL manual/aditiva: `prisma/migrations/20261001100000_clientes_regras_pagamento/migration.sql`. Testes: `testes/vendas/clientes-*`; prévia sintética `testes/visual/clientes.html` e `clientes.vite.config.mts`. Nenhum token ou variante novo; referência visual Em revisão.

### Contrato permanente de Clientes e Pedidos

Qualquer alteração em dados cadastrais, contatos, cobrança ou entrega deve atualizar todos os consumidores impactados (UI, contratos, validação, persistência, snapshots e integrações). Não manter campos divergentes ou sem destino. Antes de executar uma mudança que contradiga regras do negócio, bloquear a inconsistência e explicar o impacto; mudanças relevantes no fiscal/financeiro/estoque devem ser sinalizadas ao usuário. Pedidos históricos conservam seus snapshots: sincronizar o contrato não significa reescrever vendas anteriores ou salvar silenciosamente alterações no cadastro selecionado.

- `pedidos/cadastro-cliente-form.tsx`: `CadastroClientePedido`, `CobrancaClientePedido` e `CamposDestinatarioCliente` são compartilhados com `clientes/campos-cliente.tsx`. Título Informações gerais nos dois fluxos; mesmo popup `sm:max-w-5xl`, cartões, grades, identidade PF/PJ, telefone e endereço/CEP. Em Clientes, Tipo ocupa o lugar da busca; entrega cadastral tem destinatário, telefone e endereço opcionais, sem modo/data/horário. Observações/ativo permanecem na aba de regras. `ClienteVenda.entregaPadrao` é JSON opcional; entradas legadas que o omitem preservam o valor existente. Migration aditiva `20261002020000_clientes_entrega_padrao`.
- Cobrança usa abas `Principal`, `Cobrança 2…250` e botão + ao lado da última. Troca conserva os valores; remover afeta o rascunho e só persiste ao salvar. Durante consulta de CEP ou CNPJ, troca/adição/remoção e salvamento ficam bloqueados. Clientes valida todos os endereços salvos; pedido valida a cobrança selecionada na confirmação. Em Novo Pedido/orçamento, com permissão de editar Clientes, edição dos endereços também atualiza o cadastro no salvamento explícito. Trocar apenas a aba não grava o cadastro; abrir um pedido anterior não substitui endereços atuais por seus snapshots.
- `titularPendente: true` permite conservar uma cobrança adicional PJ sem CNPJ, com aviso explícito. A Principal nunca aceita essa marca. CNPJ completo e razão social válida resolvem a pendência; tipo, documento e demais campos continuam validados no servidor. Selecionar uma cobrança pendente não permite confirmar ou faturar o pedido. O cadastro não inventa CPF/CNPJ nem aproveita o documento de outro titular.
- `PedidoEntrada.enderecosCobranca` + `cobrancaSelecionada`: o servidor deriva `cobranca` da lista/índice, rejeita índice inválido e ignora objeto de cobrança divergente. Orçamento preserva lista/seleção no JSON; confirmação grava endereço escolhido em `cobrancaSnapshot` e guarda `enderecos`/`selecionado` nesse mesmo snapshot para reabertura. O snapshot inclui tipo, Nome Completo, CPF/CNPJ, razão social e inscrições da cobrança selecionada. `cliente-cobranca.ts` resolve essa identidade integralmente para tributação, Brasil NFe, prévia e resumo comercial; formatos anteriores conservam o comprador original como fallback. Editar só o endereço em consumidor antigo preserva o titular já fotografado. Consumidores fiscais/financeiros devem utilizar esse endereço histórico do pedido, nunca escolher novamente o primeiro endereço atual do cliente. Títulos continuam vinculados por `pedidoVendaId`; nenhuma emissão fiscal ou quitação externa é presumida.
- Entrega/Retirada usa Button default/outline + `aria-pressed`, com Entrega inicial. Copiar cobrança copia endereço postal, nome e telefone da seleção e altera somente a entrega escolhida. `indiceEnderecoCobrancaInicial` preserva a preferência legada por endereço identificado como Cobrança; sem essa identificação, inicia na primeira aba. Modo, data, janela, frete e pagamento continuam exclusivos do pedido.
- `cliente-entrega.ts` adapta a entrega única legada e o livro opcional `entregaPadrao.enderecos`, com até250 opções. Cada opção contém destinatário, endereço e `textoOriginal` opcional, de até2000 caracteres. `selecionado` referencia a opção e os campos escalares espelham essa seleção. O validador confere todas as opções e não trunca a lista. O texto original conserva o conteúdo recebido e aparece somente para leitura; campos postais ausentes não são inventados. Combobox busca destinatário, dados postais e texto original; adicionar/remover altera somente o rascunho, com os controles oficiais e salvamento explícito.
- Em Novo Pedido/orçamento, escolher uma entrega preenche o pedido. Com permissão e revisão cadastral, editar a opção escolhida preserva as demais ao salvar. Ao reabrir um pedido, o editor associa a entrega ao livro somente se houver correspondência única de destinatário/endereço. Sem correspondência, mostra Endereço deste pedido e conserva o snapshot; editar esses campos não substitui uma opção cadastral. A escolha ou adição explícita define qual opção pode ser atualizada. A seleção para o pedido continua permitida sem ampliar a permissão de editar Clientes.
- Orçamento pode ser salvo sem pagamento. Confirmação exige `pagamentoInformado` ativo/completo, inclusive no modo EXTERNO; em pedidos HUB atuais (`versaoFinanceiro=1`) não há condição financeira na confirmação: a categoria de receita vem do canal e as parcelas do pagamento informado; o saldo de crédito do cliente não é abatido na confirmação. Rascunhos HUB do contrato anterior (versão 0) ainda mostram e exigem a condição explícita. Ao fim de Informações gerais, `credito-cliente-pedido.tsx` mostra em letras pequenas o crédito disponível (limite − em aberto), via `consultarCreditoClientePedidoAction` (mesma permissão de confirmar); a confirmação revalida o limite na transação. Tipo legado isolado não basta. Forma habilitada por cliente e prazo máximo de boleto são conferidos no servidor. Revisão não pode retirar pagamento já registrado. No EXTERNO, saldo/limite de dívida continuam fora do HUB, sem inventar quitação ou obrigação local.

O detalhe do Gestor expõe `ApontamentosPedido` para quantidades parciais por item,
com a mesma projeção de execução do quadro e comandos transacionais existentes.
Preparo usa permissão de produção (ou revisão); expedição exige revisão. A action
confere consulta e o serviço revalida a capacidade específica dentro da transação.
Atualização de outra seção preserva os formulários do detalhe; venda em edição
mantém a versão de origem para recusar sobrescrita concorrente. Devolução sem
retenção também exige motivo visível; concluir uma ação só libera sua própria
proteção de rascunho financeiro.


Refinamento de 09/10/2026: Lista/Kanban compartilham miniaturas do catálogo, selos
de quantidade e detalhe lateral direito. Orçamentos/cancelados/encerramentos são
filtros discretos em Lista. Metadados sem impacto comercial editam inline com
Salvar alterações único e motivo; itens/preço/estoque exigem cancelar e criar novo.
O documento A4 e a impressão de produção continuam ações distintas.

## Código municipal nos endereços — 11/10/2026

`EnderecoVenda`, `EnderecoPedidoEntrada` e os formulários compartilhados conservam
`codigoMunicipio` opcional retornado pelo CEP. `src/lib/vendas/municipio.ts` valida
sete dígitos e prefixo compatível com a UF brasileira; não certifica existência na
tabela completa de municípios. Metadado inválido do serviço postal é omitido,
permitindo cadastro comercial; entrada administrativa incompatível é rejeitada
pelos validadores de Clientes e Pedidos. Ausência legada continua aceita.

`cep.ts` lê `ibge` sem truncá-lo a um código aparentemente válido. O formulário
limpa o código junto dos campos postais ao trocar CEP/país e ignora retorno antigo.
Clientes, entrega padrão e endereços de cobrança compartilham a proteção. Abrir
cadastro ou pedido antigo não dispara consulta nem preenche histórico. Snapshot
fiscal usa o metadado conservado no pedido; eventual ausência bloqueia somente a
operação fiscal que exige município, sem tornar o campo comercial obrigatório.
Testes sintéticos: `municipio-fiscal.test.ts` e `pedidos-endereco-interface.test.tsx`.

## Importação histórica segregada

O contrato, os caminhos e a reversão do legado estão na
[especificação da importação histórica](../features/importacao-historica/SPEC.md).
A consulta usa os pedidos vinculados à fonte e mantém financeiro e consumo segregados.

### Clientes e cobrança independente — 17/10/2026

O editor de cliente salvo oferece a aba Pedidos com a consulta histórica e os links existentes. Exige as mesmas permissões de Clientes e Pedidos no servidor; cadastro novo ainda sem ID não exibe histórico.

`vendas/cnpj.ts` consulta o [endpoint público da BrasilAPI](https://brasilapi.com.br/docs#tag/CNPJ), com timeout de oito segundos, URL fixa e validação de resposta. Ações `buscarCnpjClienteAction` e `buscarCnpjPedidoAction` autorizam seus módulos antes da rede. Completar CNPJ na cobrança consulta razão social, país, CEP, logradouro, número, complemento, bairro, cidade, UF e IBGE disponível. Não consulta ao abrir cadastro nem salva automaticamente. Resposta inválida/indisponível mantém o rascunho e permite tentar novamente. Inscrições sem fonte comprovada são manuais; resposta antiga não altera outro titular nem substitui campos editados durante a consulta.

Campos de identidade são aditivos no JSON de endereços/snapshot. Sem migration nem regravação em lote. Colunas fiscais legadas permanecem como compatibilidade, sem impor unicidade de CPF/CNPJ aos titulares de cobrança de terceiros. A busca cadastral inclui nomes, documentos e inscrições das cobranças. [Contrato e validação](../features/clientes-cobranca/SPEC.md).

### Principal vinculada ao cliente — 19/10/2026

Informações gerais é a fonte de tipo, CPF/CNPJ e nomes da Principal. Razão social e inscrições da Principal são editadas ali. O painel Principal repete a identidade com campos somente leitura, seletor desabilitado e botão de vínculo fixado. Endereço postal permanece editável. Cobrança 2…20 conserva identidade independente. Consulta do CNPJ geral preenche o endereço da Principal, com proteção de campos alterados e bloqueio de gravação durante a consulta.

`identidadePrincipalCliente`/`cobrancasDoCliente` centralizam o vínculo e a recuperação de documentos da versão de 17/10 guardados somente no JSON. `validarCliente` aplica o contrato no servidor, inclusive no salvamento indireto por Pedidos. Novos pedidos e orçamentos normalizam a Principal pela identidade do cadastro salvo, sem aceitar titular forjado no payload. Leitura de pedido confirmado usa sua fotografia; edição postal da Principal preserva o titular histórico. Cobranças legadas sem índice continuam sem inferência de origem. [Aceite e evidências](../features/clientes-cobranca/SPEC.md).

### Identidade por e-mail — 19/10/2026

O e-mail identifica o cadastro comercial. `cliente-identificadores.ts` normaliza espaços externos e caixa, sem alterar pontos ou sufixos. Novos cadastros por Clientes, Pedidos e MCP exigem e-mail. Legados sem e-mail permanecem editáveis; o modo auditado `LEGADO` conserva a ausência comprovada na importação. `clientes-unicidade.ts` recusa e-mail ou CPF/CNPJ primário reservado por outra raiz, inclusive inativos e aliases. Cobranças adicionais continuam independentes.

Clientes e Pedido avisam essa duplicidade junto ao campo durante o preenchimento.
`use-identidade-cliente.ts` espera 350 ms, verifica no blur e descarta respostas
antigas com AbortController. `POST /api/vendas/clientes/identidade` exige sessão,
origem e permissão do contexto, limita o JSON a 2 KB e devolve somente flags sem
cache. O transporte HTTP independe da fila da consulta externa de CNPJ. A edição
exclui o próprio cadastro, mas conserva documentos reservados por aliases. Falha
de consulta informa a limitação; a validação definitiva ao salvar permanece.
[Escopo e evidências](../features/pedidos/ENTREGA-IDENTIDADE-20261020.md).

A migration `20261019180000_clientes_identidade_email` consolida identidades exatas com auditoria, conserva aliases e move somente o vínculo cadastral dos pedidos e de seus rascunhos. Snapshots e valores permanecem intactos. Crédito existente, identidade ambígua ou cobranças acima do limite abortam toda a operação. Índices, triggers e a tabela técnica SQL `ClienteIdentidadeSerializacao` protegem concorrência, inclusive snapshots Repeatable Read. A tabela não contém dados pessoais nem é um cadastro Prisma.

Importação histórica e iFood resolvem fontes antigas para a raiz. Fontes e contatos mantêm sua proveniência; a consulta agrega os contatos ativos dos aliases. A busca de Pedidos aceita nome, e-mail e CPF/CNPJ. Consulta CNPJ aceita colagem mascarada e aproveita resposta parcial com aviso. [Contrato e validação](../features/clientes-identidade-email/SPEC.md).

### Endereços únicos e obrigatórios — 20/10/2026

O livro ativo do cliente não aceita dois endereços postais iguais na cobrança ou
na entrega. A comparação inclui complemento e exclui nome, CNPJ e contato.
`cliente-enderecos.ts` centraliza a normalização e a completude postal. Os parsers
legados continuam lendo fontes históricas sem inventar campos ausentes.

Cobrança e entrega usam o Combobox oficial com titular e endereço completos.
Adicionar abre um formulário temporário; só inclui a opção completa. Excluir uma
opção preenchida pede confirmação. Principal é fixa e não pode ser removida.
O salvamento do cadastro também valida obrigatórios e duplicados no servidor,
inclusive em Pedidos e MCP. A consulta CNPJ de cobrança PJ nova ou alterada ocorre
antes da transação e fica vinculada à versão do cadastro. Se a BrasilAPI estiver
indisponível ou retornar uma página, consulta diretamente a
[Minha Receita](https://docs.minhareceita.org/), a origem usada pela
[integração da BrasilAPI](https://github.com/BrasilAPI/BrasilAPI/blob/main/services/cnpj.js).
Cada tentativa tem limite de oito segundos. Uma resposta de outro CNPJ é recusada.
A auditoria do saneamento registra a fonte que respondeu.

A prévia fiscal em `fiscal-saida/brasilnfe/operacional.ts` usa
`identidadeFiscalCobranca`, como a emissão. Exibe razão social para PJ e nome para
PF. Não completa titular adicional ausente com dados da Principal.

O saneamento dirigido reconsulta os CNPJs, consolida duplicados e retira opções
incompletas conforme autorização explícita. Conserva pedidos, destinos históricos
e fontes. Mantém prova privada antes/depois, auditoria, versões e reversão protegida.
[Contrato e execução](../features/clientes-cobrancas-relatorios/SPEC.md).

### Variações dos destinos históricos — 20/10/2026

`cliente-enderecos.ts` normaliza pontuação periférica do número, títulos usuais e
número repetido no logradouro com separador explícito. A chave estrita conserva
CEP, bairro e unidades. `chaveLocalEnderecoPostal` reúne candidatos para revisão;
nunca autoriza duplicidade ou unificação automática.

`cliente-enderecos-opcoes.ts` projeta opções postais únicas sem alterar as listas
fotografadas. Conserva o objeto selecionado e mapeia cada opção aos índices
originais. `CobrancaClientePedido` continua emitindo lista e índice originais.

`clientes-enderecos-equivalencias.ts` e `scripts/clientes-enderecos-unificar.ts`
aplicam somente grupos revisados do livro ativo de entrega. A configuração privada
vincula membros, hashes, motivo, sobrevivente e complemento final. Requer backup,
manifesto, token, aprovação técnica, versão e estado exatos. Auditoria, idempotência
e reversão seguem a estrutura de manutenção existente. Unidades físicas distintas
bloqueiam a união. Pedidos, fontes, cobranças e Principal ficam preservados.
