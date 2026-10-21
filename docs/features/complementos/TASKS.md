# Execução — Complementos

## Organização — 21/10/2026

Base pública inicial: `6de2cb6950848a82ccc884c3ce3d48d6a2120212`. Continuação em
`codex/complementos-organizacao-20261021`, criada em clone independente. Apenas
o diff funcional revisado foi portado; nenhum objeto Git privado foi importado.

- [x] Separar Produto/Complemento, categorias comerciais e categorias de grupos.
- [x] Implementar tags, Disponibilidade e seleção de cadastros nos grupos.
- [x] Preservar composição padrão e substituições específicas por produto.
- [x] Preparar migration manual com transferência de categorias e revisão de cadastros.
- [x] Revalidar o conjunto na base pública e registrar os resultados abaixo.
- [x] Publicar a branch e abrir PR de continuação.
- [ ] Integrar após a transição da origem e concluir o ritual de publicação.

Estado: [PR pública #4](https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/pull/4),
sem publicação produtiva. O usuário autorizou publicar ao final. A transição
do repositório exige aguardar a primeira publicação da origem pública antes de
integrar esta continuação ou acionar novo deploy. Backup íntegro e conferência
das migrations continuam obrigatórios antes da aplicação produtiva.

As evidências abaixo desta seção pertencem às implantações anteriores.

Validação da continuação pública, Node 22: Prisma generate/validate aprovados;
28 integrações de Vendas aprovadas em dois arquivos. Três cenários de Pedidos
aprovados; os outros 71 não foram executados nesta seleção. Todos usam schemas
efêmeros no banco sintético local. A primeira tentativa de conexão foi bloqueada
pela sandbox; a execução autorizada fora dessa restrição passou.

Navegador: 24 contratos aprovados em 320/390/768/1440 px, temas claro/escuro e
toque. Capturas consultivas de lista, Disponibilidade e grupo inspecionadas.
Sem aprovação de novas referências. Contratos MCP/autorização/arquivos: 526
testes aprovados; 63 opt-ins não executados. Interface/domínio: 98 de 99 passaram;
um cenário de Clientes falhou na execução conjunta e passou isolado. O cenário
de GTIN da base pública também passou isolado. Nenhuma asserção foi afrouxada.

Conciliação local com a main pública `4e95b639164b446b9f34e7107d207e1c21e99491`:
preservada a inclusão manual de opções no topo, com foco no primeiro campo;
a seleção de cadastros existentes mantém preço/composição por referência.
Tipos de rotas gerados pelo Next no clone limpo; a primeira tentativa de
typecheck identificou somente a ausência desses arquivos gerados.

Revisão funcional conciliada `39cc221b9770087a4ebd4cfef491851d6430235b`:
52 testes de interface/domínio em cinco arquivos e 28 integrações de Vendas
aprovados. O grupo passou novamente nos 12 contextos visuais, com capturas
separadas das 24 anteriores. ESLint e lint:design aprovados: oito bases/422
consumidores; qualidade visual com zero desvios novos. Build webpack/Node 22
aprovado, incluindo TypeScript e 106 páginas. Avisos legados de middleware e
APIs Edge da dependência jose permanecem. CI da PR em andamento.

A regressão global anterior à portabilidade não foi integralmente verde:
507 arquivos/6.546 testes passaram, 66 arquivos/1.047 testes foram ignorados e
cinco casos falharam. Os alvos com falhas foram revalidados por escopo, inclusive
consulta fiscal legada preservada, inventário de permissões, GTIN e arquivos.
Não declarar a suíte global original como aprovada nem como execução da revisão
pública conciliada.

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

- [x] Banco, validação e persistência; migration isolada e conflitos.
- [x] Lista, editor simples e grupos/produtos com composição expandida.
- [x] Precedência de preço/composição no cálculo e snapshots dos pedidos.
- [x] Pausa local/global, permissões e auditoria.
- [x] Testes focados, regressão, lint/design, tipos e build; limite da regressão registrado abaixo.
- [x] Prévia sintética desktop/celular.
- [x] Contrato/documentação e revisão do diff.
- [x] Publicação autorizada, estabilidade, migrations e HTTPS sem sessão.
- [ ] Conferência da UI em produção com sessão autenticada (aguardando login do usuário).

Estado: publicado; conferência autenticada pendente de acesso. Alteração alheia em docs/features/pedidos/EXECUCAO.md preservada e excluída dos commits.

## Evidências da implementação sobre 5308aa1d

Node 22.23.3: 56 testes focados aprovados em seis arquivos; 23 integrações de Vendas e 59 de Pedidos aprovadas em schemas temporários locais. Prisma validate/generate aprovados; migrate deploy aplicado integralmente em outro schema temporário, três colunas conferidas e schema removido ao finalizar. ESLint focado sem erros/avisos; lint:design aprovado (8 bases/318 consumidores). Tipos e build webpack aprovados; aviso legado de middleware/proxy conservado.

Prévia sintética 1280px/390px: editor/grupo com clientWidth=scrollWidth (766px/356px), página com scrollWidth=viewport, zero erros de página. Grade real de ingredientes, chevron discreto, botões e quebra no celular conferidos. Referência visual Em revisão. Gravações da prévia são simuladas.

Regressão global: 250 arquivos/2.090 testes aprovados; 28 arquivos/388 testes ignorados por flags/contratos próprios. Dois arquivos/8 testes falharam: timeouts de interface e expectativas anteriores de complementos avulsos. Expectativas atualizadas ao contrato solicitado; Pedidos passou na reexecução (20 testes). A interface de Vendas voltou a apresentar dois timeouts de 5s e uma falha posterior por ação pendente. O cenário de preço passou isolado (1,10s); as mesmas 22 asserções de interface passaram com `--maxWorkers=1 --testTimeout=15000` (44,27s de testes). Limite ampliado apenas na execução diagnóstica; configuração global e asserções preservadas. Não declarar a execução global original integralmente verde.

## Base integrada — 91beb2da

Integração de origin/main `cc707a34`, preservando Porções, Cadastros, Insumos e Notas. 197 testes em 12 arquivos aprovados; opt-ins `VENDAS_BANCO_TESTE=1` e `PEDIDOS_BANCO_TESTE=1` executados em schemas efêmeros locais. 27 testes dos consumidores de exclusão/revalidação de Insumos aprovados; asserção corrigida do pedido reexecutada e aprovada. Prisma validate/generate e migrate deploy completo em schema descartável aprovados. ESLint focado sem erros/avisos, lint:design (8 bases/319 consumidores) e typecheck aprovados. Prévia final repetida em 1280px/390px, sem overflow da página/diálogos ou erros de página. Build webpack/Node22 aprovado, incluindo tipos e 79 páginas; aviso preexistente middleware/proxy preservado.

Backup privado final `etiquetas-complementos-20261004-02` substitui a referência operacional anterior `...-01`, incluindo as publicações concorrentes: 59.455.823 bytes, 859 linhas no índice, leitura integral aprovada, SHA-256 `ee42c843078eee125bd6b7456ccb225aca916af191a15f95462bdd0df0538d39`. Imagem/configuração anterior preservadas na VPS; certificado no banco.

## Publicação — 04/10/2026 (Brasília)

Revisão funcional `74e70e7b` com ajustes `096faa2d`, integrada em `91beb2da`; revisão publicada `e8fee10bfddeb31cf6de2ce0350063c4fcf12213` confirmada na main remota e no checkout do Dokploy. Build oficial Docker/Node22/webpack aprovado. Tarefa `s7ybhfs31oou`, contêiner `f00e5feca7f4`, imagem `sha256:18783e74f01f530cf2fb7e9b9785539dec87ec0b198023e63bf1b580e8a45c83`, iniciado em `2026-10-05T02:25:44.965803163Z`; conferência observou 145s de estabilidade, zero reinícios. Prisma migrate status atualizado; ambiente/mount completos preservados, certificado no banco e agenda fiscal ativa. Auxiliar oficial reconferiu configuração fiscal, sem restaurar banco nem consultar serviço externo.

HTTPS: login 200; Complementos, Produtos, Pedidos e Insumos 307 para login sem sessão. Prévia sintética e integrações locais não substituem o smoke autenticado em produção: navegador de verificação permanece no login, solicitação de acesso enviada ao usuário. Nenhuma operação fictícia feita sobre dados reais. Registro pós-deploy enviado somente à branch de trabalho, sem novo deploy documental.

## Continuação — preços por canal e carga assistida (05/10/2026)

- [x] Retirar o seletor de complemento da composição; permitir ingredientes diretos sem vínculo.
- [x] Tabelas Site/iFood, herança explícita por grupo e substituições no produto/pedido.
- [x] Levantar os 38 preços públicos de Extras e preparar correspondências privadas: 116 cadastros para 121 opções/19 grupos, 75 novos e 41 reutilizados; 83 usam porções cadastradas e 15 preservam iFood existente.
- [x] Testar carga sintética: migrations completas, conflito após gravação com rollback integral, repetição sem novas alterações, quatro registros de auditoria e nenhuma movimentação de estoque.
- [x] Regressão global: 253 arquivos/2.129 testes passaram; 29 arquivos/401 testes ignorados. Uma falha de contrato de permissões para `consultarExclusaoInsumoAction`, já autorizado no servidor, corrigida com inclusão no inventário; reexecução dos 180 testes do contrato aprovada.
- [x] Integrações Pedidos/configuração: 74 testes aprovados após corrigir a expectativa de formatação monetária do novo teste. Lint focado, design (8 bases/319 consumidores), tipos e prévia 1280px/390px aprovados; sem overflow de página/diálogo ou erros de página.
- [x] Integrar a main `9522caef`: 306 testes de Vendas/Pedidos/permissões aprovados, lint/design e prévia desktop/celular repetidos sem falhas; build webpack/Node22 aprovado, com tipos e 79 páginas. Aviso legado de middleware/proxy preservado.
- [x] Backup novo verificado, publicação estável e migrations conferidas.
- [x] Aplicar carga autorizada e conferir preços/composições/auditoria sem repetir alterações.

Plano e resultado da carga real são operação de cadastro solicitada; dados sintéticos ficaram restritos ao banco local. Publicação e carga concluídas. Alteração alheia em `docs/features/pedidos/EXECUCAO.md` permanece fora dos commits.

Backup novo verificado antes da publicação: `etiquetas-complementos-tabelas-20261005-01`, 59.456.098 bytes, 859 linhas no índice, leitura integral e SHA-256 `01abcc265feffc5ed39bdad3ebfa6cad8239cd0687cebf3ed504fa7e65edd72d` aprovados. Imagem/configuração anterior preservadas; certificado no banco.

## Publicação e carga — 05/10/2026 (Brasília)

Revisão funcional `18c1d877`, integrada com a main `9522caef` em `ee48cf06`; revisão publicada `cdbc64863c4676bc42ccc9c5bd7228eb08573fc3`, confirmada na main remota e no checkout Dokploy. Build Docker/Node22/webpack aprovado. Tarefa `we4gizbkr1wx`, contêiner `8af607c1ed26`, imagem `sha256:b92952fa4a2d56463189c877977c9d5f8d511e412ccf7abccb04787e59469c79`, iniciado em `2026-10-05T04:52:24.56827133Z`; conferência com 118s de estabilidade e zero reinícios. Migrations em dia, ambiente/mount e configuração fiscal completos preservados; certificado no banco e agenda ativa. Auxiliar oficial reconferiu somente a configuração fiscal.

Carga administrativa autorizada `complementos-grupos-20261005-v1`: 75 cadastros criados e 41 reutilizados; os 116 possuem composição e preços Site/iFood. As 121 opções/19 grupos foram vinculadas e conferidas contra o manifesto, incluindo preço, composição e herança. Existem 116 auditorias de cadastro, 19 de grupo e uma da operação. Segunda conferência somente leitura confirmou todos os preços Site/iFood e vínculos; não foi reaplicada carga para testar em produção. A transação genérica e sua consulta de conferência passaram antes em schema sintético, inclusive rollback e idempotência.

Os 38 preços de Extras vieram do [site público Grazing Table](https://grazingtable.com.br/produto/tabua-frios-individual-grazing-para-1/). Cadastros equivalentes por nome recebem a referência correspondente; itens sem equivalente mantêm a referência dos grupos. iFood anterior preservado em 15 cadastros; demais iniciam pelo Site. 83 cadastros usam uma porção da tabela; nos demais foram usadas medidas do nome ou estimativas iniciais autorizadas. Composições específicas dos grupos foram preenchidas por contexto, como fruta versus suco; escolhas grátis e ajustes específicos de preço permanecem. Manifesto, SQL materializado, resultado e backup ficam privados na VPS, fora do Git.

HTTPS: login 200, Complementos/Produtos/Pedidos/Insumos 307 para login sem sessão. Prévia final sintética desktop/celular sem overflow/erros, referência Em revisão. A UI autenticada de produção permanece pendente do login do usuário; o navegador continua na tela de acesso. Este registro pós-deploy segue somente para a branch de trabalho, sem novo deploy documental.

## Cardápio e lista comercial — 05/10/2026

- [x] Cardápio agrupado em Vendas & Pedidos, com destinos/permissões existentes e comportamento desktop/móvel.
- [x] Complementos na mesma lista comercial de Produtos: foto, categorias, preços Site/iFood, desconto, CMV e confirmação explícita; sem Giuliana Flores ou ficha impressa.
- [x] Editor simples com foto/categorias, preservação de outros canais e composição sem FM; envio bloqueia Salvar até concluir.
- [x] Alinhamento compartilhado com/sem promoção; preço original com espaço reservado e controles no mesmo eixo.
- [x] Node22: 146 testes/17 arquivos aprovados, incluindo navegação completa, interface, preços/cancelamento, CMV, fotos/acesso, autorização e integração de Vendas em schema descartável local. Após ajuste final de alinhamento, 31 testes de interface/preço aprovados na reexecução.
- [x] ESLint focado sem erros/avisos, lint:design (8 bases/320 consumidores) e tipos aprovados.
- [x] Imagens sintéticas 1440px/390px conferidas; sem overflow da página/diálogo ou erros de página. Campos IFOOD/SITE com mesma coordenada Y (532,390625px), inclusive promoção em somente um canal. Porções simuladas somente na prévia; referência Em revisão.
- [x] Build webpack/Node22 final aprovado, incluindo tipos e 79 páginas; aviso legado de middleware/proxy preservado.
- [ ] Publicação estável.

Sem migration ou carga de dados reais nesta fase. Alteração alheia em `docs/features/pedidos/EXECUCAO.md` permanece preservada e excluída dos commits. Smoke autenticado de produção depende de login do usuário.

Backup pré-publicação `etiquetas-cardapio-20261005-01`: 59.512.508 bytes, 859 linhas no índice, leitura integral e SHA-256 `bc56808f8a58fec3abbd7c7288cfff0c3acd9e7c8c02e1c2d1d6c7e68e98074f` aprovados. Imagem/configuração anterior preservadas na VPS; certificado no banco.

## Novo Pedido: grupos obrigatórios e frete — 05/10/2026

- [x] Mostrar somente grupos com mínimo efetivo positivo no vínculo do produto; Extras ocultos. Snapshots/escolhas opcionais anteriores permanecem nos valores e salvamento.
- [x] Compartilhar `SlotComplemento` com Produtos: nome à esquerda, preço somente leitura e quantidade compacta; grupo expansível inicialmente aberto. Limite de escolhas acompanha o servidor (inteiro 0–1000).
- [x] Extrair `ConfirmacaoLocalEntrega` do resultado do simulador e exibir a confirmação junto ao frete. A pendência retornada por mapas antes ficava dentro de Detalhes; confirmar origem/destino agora conclui o cálculo no formulário, preservando tokens separados e sem escolher endereço automaticamente.
- [x] Conter o fieldset comercial em telas estreitas: popup de 342px em viewport de 390px, sem overflow lateral do diálogo; rolagem da linha permanece interna. Desktop 1280px também conferido.
- [x] Node22: 180 testes/16 arquivos aprovados entre Produtos, Complementos, Pedidos e Entregas. A primeira regressão identificou três expectativas antigas de UI; após atualizar o contrato solicitado e reforçar a preservação histórica, reexecução final dos 35 testes/2 consumidores aprovou. Falha inicial isolada de inicialização de worker foi resolvida por reexecução; não foi contada como aprovação.
- [x] ESLint focado, tipos do projeto e lint:design (8 bases/320 consumidores) aprovados. Client Prisma local gerado para a base vigente, sem conexão ao banco operacional. Sem alteração própria de schema/migration, autorização ou gravação de dados reais.
- [x] Imagens sintéticas desktop/celular conferidas; confirmação preenchendo frete de R$ 22,00 e total de R$ 242,00, sem diálogo adicional. Mapas/ações simulados; não representa homologação do provedor com endereço real. Sem nova primitiva/token; composição documentada na Central, Em revisão visual.
- [x] Build webpack/Node22 final aprovado. Smoke local: login 200; Novo Pedido, Entregas, Produtos e Central sem sessão redirecionam para login (307). Nenhum dado operacional alterado.
- [x] Publicação estável e conferência autenticada: revisão funcional `7e03b4ed48e9d465bc5156f76f77caa0b8c02ed9`; tarefa `registro-sintetico-1`, contêiner `aa9c13e12ea4`, nova imagem `sha256:f212c14d11845ba45d5ae2c0b328a19effecb42767dccd214f9541f5cc1f57b5`, Running por 107s com zero reinícios. Migrations em dia; configuração fiscal preservada e certificado no banco.

Backup privado anterior à publicação: `etiquetas-pedidos-complementos-frete-20261005-a`, 59.522.285 bytes, catálogo/conteúdo integral conferidos, SHA-256 `8b091ea4699a2f0ce56cec70418912cb797194f3356e8b502e5a25a0ae4c2b73`. Configuração fiscal e imagem anterior preservadas na VPS. Trabalho alheio da checkout principal permanece fora desta alteração.
Conferência pós-publicação: login 200 e rotas Novo Pedido, Entregas, Produtos e Central protegidas (307) no HUB; login 200/Novo Pedido 307 no host dedicado. Produtos retorna 404 no host dedicado de Pedidos, conforme allowlist existente, e permanece disponível no HUB. Na UI autenticada, Grazing para 1 não apresenta Bebidas opcional; Monte sua Grazing para 1 mostra apenas cinco grupos obrigatórios, 27 quantidades e preços somente leitura, linhas alinhadas e popup sem overflow. Não foram selecionados clientes, salvos orçamentos/confirmados pedidos ou consultados mapas reais para a conferência. Resultado do frete foi validado na prévia sintética e nos testes de consumidores/serviço. Registro pós-deploy enviado somente à branch de trabalho, sem novo deploy documental.
