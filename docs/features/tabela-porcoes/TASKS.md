# Execução — Tabela de Porções

Base isolada: `9cc6550f`, branch `codex/tabela-porcoes-20261002`.
Escopo e aceite em [SPEC](SPEC.md). Publicação autorizada em 02/10/2026.

- [x] Banco e domínio: migration aditiva, precisão, unicidade e histórico.
- [x] Backend: permissões, validações e proteção de concorrência.
- [x] Interface: tabela centralizada, busca, cadastro e edição explícita.
- [x] Composições: escolher preenche quantidade; alterar limpa porção; disquete salva.
- [x] Navegação e documentação dos contratos reutilizáveis.
- [x] Testes focados, integração PostgreSQL isolada e regressão necessária.
- [x] QA visual desktop/celular com fixtures; referência Em revisão.
- [x] Lint, lint:design, tipos, Prisma e build final.
- [ ] Backup privado verificado; GitHub, deploy e smoke sem operações reais.

## Evidências em 02/10/2026

Incremento funcional `fb993559`; base remota `50c9cdbd` integrada por `abf19ab9`.
Complemento final conserva quantidades comerciais legadas ao editar texto/ordem,
aplica quantidade decimal explícita da porção mesmo quando dois valores diferentes
se tornam o mesmo `number`, e revisa a unidade ao escolher uma porção atual.
`ComponenteRow.quantidadePorcao` é transitório; o produto persiste apenas seu contrato
comercial existente. Unidade antiga permanece visível e seu custo fica pendente até
revisão, sem interpretar quilogramas como gramas.

- Node 22.23.3; Prisma validate/generate aprovados. As 86 migrations foram aplicadas
  com migrate deploy exclusivamente em PostgreSQL descartável na porta local 55439.
- `porcoes.test.ts` + `porcoes-integracao.test.ts`: 34 testes aprovados, sendo 13 de
  integração real no banco descartável (incluindo concorrência, auditoria, revogação,
  unidade, precisão, rollback e preservação da escala anterior).
- `testes/permissoes/fronteiras.test.ts`: 165 aprovados. Um timeout na primeira rodada
  sob concorrência não se repetiu isoladamente; nenhum timeout foi ampliado.
- Regressão integral `vitest run --maxWorkers=2`: 224 arquivos e 1.891 testes aprovados,
  26 arquivos/344 testes opt-in ignorados, oito falhas em quatro arquivos. Três falhas
  de Perdas eram o relógio das fixtures antigas, corrigidas pelo commit já existente
  `bdecddb4` da main. As demais envolveram seletores/foco dos testes alterados e timeouts
  de interface; todas foram verificadas nas rodadas focadas após os ajustes abaixo.
- Rodadas finais: 18 testes de porções/composição (incluindo o consumidor comercial),
  17 de Vendas, dez de composição de preparações e dois de especificação aprovados.
  Nenhuma asserção removida nem timeout ampliado. Onze testes de tabela/página aprovados.
- Após integrar a main: 28 testes aprovados em Perdas, laboratório de Design, navegação
  de Porções e precisão da composição no servidor. Mudanças alheias foram preservadas.
- ESLint de todos os arquivos alterados e lint:design aprovados (8 bases/302 consumidores).
  Build webpack e tsc --noEmit finais aprovados após o complemento de precisão;
  sete verificações HTTP repetidas na versão final também aprovadas. Aviso existente
  de depreciação middleware/proxy permanece fora do escopo.
- Smoke HTTP local com três contas fictícias: sete verificações aprovadas, incluindo
  bloqueio anônimo e sem permissão, consulta sem botões de escrita, menu abaixo de
  Insumos e páginas de Insumos/Produtos. Nenhuma escrita ou chamada externa no smoke.
- Prévia `testes/visual/porcoes.html`: imagens desktop/celular examinadas pelo navegador;
  largura centralizada, campos empilhados e ausência de overflow global conferidos.
  Fluxo fictício: seis fatias preenchem 100 g; alterar para 75 limpa a porção; digitar
  outro nome, Tab, disquete e adicionar preservam a quantidade/nome; alterar a linha
  adicionada para 50 limpa novamente. Console sem erros. Referência Em revisão humana.
- Backup privado `etiquetas-porcoes-20261002-01`: índice com 813 linhas, leitura integral
  e checksum verificados. Imagem anterior preservada como
  `grazing-porcoes-anterior:20261002`; configuração fiscal original no banco, sem env/mount
  de fallback. Nenhuma restauração de banco ou operação em dados reais para testar.

Logs extensos permanecem na pasta privada de artefatos da tarefa, fora do Git.

## Base final para publicação

- Complemento funcional `4564fc3`; atualização concorrente `952800b5` incorporada em
  `6eb980e6`, preservando filtros e categorias. Oito arquivos/72 testes de integração
  aprovados na base combinada, incluindo Vendas, Insumos, Clientes e Central.
- Build webpack, tsc --noEmit e sete verificações HTTP repetidos e aprovados nessa
  base. lint:design aprovado com 8 bases/303 consumidores.
- Após a atualização paralela, novo backup `etiquetas-porcoes-20261002-02` foi criado
  e verificado: índice com 813 linhas, leitura integral e checksum aprovados. Imagem
  imediatamente anterior preservada em `grazing-porcoes-anterior:20261002-integrado`.

Próximo passo: enviar branch e main autorizada, acompanhar a tarefa nova por pelo
menos 1–2 minutos e confirmar migrations, HTTPS e UI autenticada sem gravar dados reais.

## Evolução: porções multiplicáveis — 02/10/2026

- [x] Qtd. + Un. como 1 porção, agrupadas separadamente do equivalente do insumo.
- [x] Composição em uma linha: ingrediente, porção, multiplicador, custo.
- [x] Cadastro exclusivo na tabela; frações/múltiplos preservam a referência.
- [x] Snapshot estruturado persistido em preparação/produto, conversão decimal exata
  e validação de consumo/unidade no servidor; legados preservados.
- [x] Migration aditiva testada com dados sintéticos; integração de Porções e Vendas.
- [x] Nível C: lint dos alterados, lint:design (303 consumidores), Prisma validate/generate,
  TypeScript e build webpack. Regressão: 233 arquivos aprovados, 1.959 testes aprovados,
  24 arquivos/313 testes opt-in não executados. PORCOES_BANCO_TESTE e VENDAS_BANCO_TESTE
  executados no PostgreSQL local descartável; após preservar decimal simples na consulta,
  28 testes de integração/precisão passaram (incluindo um novo caso de reabertura).
- [x] Prévia sintética em desktop/celular: grupos do cadastro proporcionais, linha de
  composição na ordem solicitada, 0,5 = metade do consumo/custo; 2 = dobro. Em revisão visual.
- [ ] Publicação com backup íntegro, tarefa estável e smoke autenticado.

## Ajuste dos campos da composição — 02/10/2026

- [x] Campos sempre visíveis: Ingrediente > Porção > Descrição > Qtd.; custo abaixo da Qtd.
- [x] Descrição proporcional à Porção; Qtd. direta limpa o snapshot sem cadastro inline.
- [x] Unidade fixa dentro do InputComSufixo e remoção da legenda de tipo do ingrediente.
- [x] Testes focados: 43 aprovados; domínio/consumidores: 196 aprovados, 19 opt-in ignorados.
  Integração PORCOES_BANCO_TESTE executada no PostgreSQL local descartável, sem dados reais.
- [x] Prévia fictícia desktop/celular: 0,5 × 8 fatias = 4 fatias, 50 g, R$ 5; 2 = 16 fatias,
  200 g, R$ 20. Campos alinhados na mesma linha em desktop, sem overflow global móvel.
  Referência Em revisão humana.
- [x] TypeScript, ESLint dos alterados, lint:design (8 bases/303 consumidores) e build webpack.
- [x] Integração de Vendas: 22 testes aprovados no PostgreSQL local isolado, incluindo
  salvamento/reabertura com precisão e snapshot, sem movimentação de estoque.
- [ ] Publicação e smoke autenticado do ajuste.

## Correção: Porção define os demais campos — 02/10/2026

Base `e29232a6`, branch `codex/porcao-define-campos`; publicar autorizado pelo usuário.

- [x] Porção numérica disponível ao escolher ingrediente, sem seleção de descrição.
  Campo somente leitura mostra medida proporcional; quantidade e custo acompanham.
- [x] Primeira base vigente por data/id em novas referências; snapshots preservados.
  Consulta não reescreve fichas legadas. Quantidade direta permanece opcional.
- [x] Nome do ingrediente sem unidade, inclusive em foco e após seleção.
- [x] Testes focados: 47 aprovados. Domínio e consumidores: 197 aprovados, 19 ignorados
  de integrações fora do escopo. Opt-ins PORCOES_BANCO_TESTE (13) e VENDAS_BANCO_TESTE
  (22) executados em schemas locais descartáveis, sem operar dados reais.
- [x] Prévia fictícia: digitar 0,5 → 4 fatias padrão, 50 g, R$ 5; linha adicionada com
  2 → 16 fatias padrão, 200 g, R$ 20, desktop e celular. Referência Em revisão humana.
- [x] ESLint dos alterados, lint:design (8 bases/304 consumidores), TypeScript e build
  webpack aprovados. Avisos existentes: middleware/proxy e APIs Edge em jose.
- [x] Revisão final de Vendas: 19 aprovados em execução isolada, limite original 5 s.
  Rodada concorrente anterior: dois timeouts; ambiente jsdom 40,41 s contra 2,23 s
  na rodada isolada aprovada. Nenhuma asserção ou timeout foi afrouxado.
- [ ] Publicação estável e smoke autenticado.

## Composição compacta, FM e zero decimal — 02/10/2026

Base `19c3628f`; branch `codex/composicao-compacta-fm`.

- [x] FM com dimensão do botão de desconto, tooltip e estado aria-pressed; sem gravação inline.
- [x] Coluna Custo sem caixa, Qtd. reduzida e linha sem a faixa inferior do checkbox/custo.
- [x] Qtd. manual com três casas; ,5/.5 completa o zero em Qtd. e Porção. Referências e
  histórico com precisão maior permanecem exatos, inclusive ao alternar FM.
- [x] Referência isolada desktop/celular com fixtures: linha compacta, FM ligado/desligado,
  Custo sem input e digitação real de ,5/,125. Sem overflow; Em revisão humana.
- [x] Domínio/consumidores: 215 aprovados (213 na bateria + 2 na reexecução), 19 opt-ins
  de conversões/especificação/marcas/fotos fora do escopo ignorados. PORCOES_BANCO_TESTE
  e VENDAS_BANCO_TESTE executados em PostgreSQL local descartável, sem dados reais.
- [x] Vendas: 19 aprovados; caso de ordenar/FM/salvar também aprovado isoladamente em
  4,24 s com limite original. Reexecução final de Vendas + especificação: 21 aprovados.
  Diagnóstico de lentidão: memória livre ~1,6 GiB de 16 GiB; timeouts de 5 s variaram
  entre casos, inclusive render síncrono da tabela de marcas não alterada. Só a rodada
  final usou --testTimeout=15000; asserções e configuração versionada não foram alteradas.
- [x] ESLint dos alterados, lint:design (8 bases/304 consumidores), next typegen, tsc e build webpack aprovados. Avisos existentes de middleware/proxy e APIs Edge em jose.
- [ ] Publicação e smoke autenticado.

## Títulos à esquerda e eixos das colunas — 02/10/2026

Base cf2e7fa0; branch codex/titulos-campos-esquerda.

- [x] Composição força text-left e o cabeçalho reserva a mesma largura de ação da
  linha, incluindo a área mínima touch. Margem de 1 px reproduz a borda da linha.
  O título Ingrediente acompanha a alça opcional sem aumentar a altura do cabeçalho.
- [x] Regra de títulos à esquerda registrada na seção 5 dos padrões de Design.
- [x] Prévia isolada com dados fictícios: cinco colunas com text-align left e
  diferença entre início do título e coluna inferior <= 0,12 px de renderização.
  Captura privada titulos-esquerda-previa.jpg; referência Em revisão humana.
- [x] Consumidores: 21 testes de porções/composição + 19 de Vendas aprovados,
  sem mudar asserções ou ampliar o timeout original (40 aprovados em 42,41 s).
- [x] ESLint, lint:design (8 bases/304 consumidores), next typegen, tsc e build webpack aprovados. Avisos existentes de middleware/proxy e APIs Edge em jose.
- [x] Publicação ec77ee64 estável: tarefa mj6l5boltmye, contêiner 81d9e32ce1f2,
  imagem e8043ff37955, 183 s sem reinícios; migrations em dia e configuração fiscal
  idêntica ao snapshot privado etiquetas-titulos-esquerda-20261002-01.
  Smoke autenticado de Produtos/Composição: cinco títulos left e diferença <=0,07 px
  entre cabeçalho e colunas. Captura privada titulos-esquerda-publicado.jpg.
  Rotas Porções/Insumos/Produtos sem sessão redirecionam para login (307).
  Diálogo fechado sem salvar; nenhum dado real usado para testar.

## Correção de carregamento de porções

Base `40240050`; branch `codex/porcoes-carregamento`.

- [x] Diagnóstico: serviço registrou Server Action de versão anterior não encontrada.
  Consulta dos campos mudou para GET privado/no-store em URL estável, com as mesmas
  permissões e revalidação de sessão no serviço; ações de cadastro não foram alteradas.
- [x] Snapshot compatível calcula localmente, sem consulta dispensável. Lista vazia
  representa insumo sem porção, sem erro; Qtd. direta permanece habilitada.
- [x] Falha de transporte não vira catálogo vazio nem altera a ficha. Aviso acessível,
  tooltip e botão oficial compacto de nova tentativa mantêm a altura da linha.
- [x] Focados: 39 testes aprovados (cliente, endpoint e composição).
  Regressão: 207 aprovados em 25 arquivos; 19 opt-ins de outros recursos ignorados.
  Integrações Porções e Vendas executadas no PostgreSQL local descartável.
  Rodada final de Porções e fronteiras de acesso: 181 aprovados em dois arquivos.
  Timeout anterior de aceitarNotaAction passou na reexecução com o limite original;
  nenhuma asserção ou configuração de timeout foi afrouxada.
- [x] Prévia fictícia: sete linhas com 61,78 px, incluindo ausência de porção e falha
  simulada. Nova tentativa recupera sem editar o consumo. Celular mantém conteúdo
  dentro da largura disponível. Captura privada porcoes-carregamento-previa.jpg;
  referência visual Em revisão humana. Nenhum dado operacional usado para testar.
- [x] ESLint dos alterados, lint:design (8 bases/304 consumidores), next typegen e
  TypeScript aprovados. Cliente Prisma gerado localmente, sem alterar schema/migrations.
- [x] Build webpack final aprovado; branch preparada para sincronização. Avisos existentes de middleware/proxy e APIs Edge em jose.
- [ ] Autorização desta publicação, integração e smoke autenticado.

Após publicar, abas da implementação anterior precisam de uma recarga para receber
esta correção; as próximas consultas usam uma URL independente do ID gerado no build.

## Popups e ordenação — 04/10/2026

Base `bb8f1799`, incremento `64eb63a`, branch `codex/porcoes-dialogos-ordenacao-20261004`.
Incorporada a main `5308aa1d` por `e7f51478`, preservando os ajustes de especificações
em Suprimentos e ficha técnica publicados em paralelo.

- [x] Nova porção e Editar no mesmo Dialog; tabela principal sem formulário permanente.
- [x] Categorias/insumos A–Z/Z–A pelo seletor e cabeçalhos, sem gravar ao mudar filtro.
- [x] Ordenar categorias com ListaOrdenavel e salvamento explícito, exclusivo de Porções.
- [x] Migration aditiva, versões, permissão vigente e histórico transacional/idempotente.
- [x] PostgreSQL local descartável (55484): 95 migrations aplicadas por migrate deploy;
  20 integrações aprovadas, incluindo conjunto incompleto, versão antiga, revogação,
  concorrência, precisão e preservação de snapshots. Primeiro banco foi recriado em
  UTF8 após o initdb usar WIN1252; não houve alteração de migrations para contornar isso.
- [x] Prévia com fixtures: cadastro/edição, descarte, seleção abaixo do campo,
  ordenação alfabética e por teclado; desktop/celular sem overflow e retorno de foco.
  Console sem erros. Sem novo padrão/token/variante; referência Em revisão humana.
- [x] Backup privado `etiquetas-porcoes-interface-20261004-a`, 41.668.158 bytes;
  catálogo e conteúdo conferidos sem restaurar banco ou consultar serviços fiscais.
- [x] Regressão integral: 251 arquivos/2.113 testes aprovados; 27 arquivos/371 opt-ins
  de outros domínios ignorados. Única falha: ação nova ausente do catálogo de fronteiras.
  Acrescentada ao contrato, sem afrouxar guardas/asserções. Rodada final em `214457b8`:
  dez arquivos/307 testes aprovados, incluindo 20 integrações reais de Porções,
  composição, consulta/página e 179 fronteiras de acesso. Nenhum timeout ampliado.
- [x] Prisma validate/generate, ESLint dos alterados, lint:design (8 bases/317 consumidores),
  TypeScript completo e diff aprovados. Busca e ordenação têm 44 px e limites iguais
  no navegador; grupo label/Select usa flex com gap para evitar margem no campo oculto.
- [x] Build webpack Node 22 aprovado em `214457b8`; smoke da versão compilada:
  login 200, Porções/Insumos/Produtos/Central 307 para login sem sessão, cinco verificações.
  Aviso existente de middleware/proxy preservado; nenhuma operação em dados reais.
- [x] Publicado `be714602` por fast-forward autorizado. Tarefa `bg7ovfhq46ym5c8h4016rdghd`,
  contêiner `5b1b5a8fcd52`, nova imagem/tarefa Running por 94 segundos na conferência,
  sem reinícios. Schema atualizado e migration nova confirmada no PostgreSQL;
  configuração fiscal/certificado preservados, sem consultas fiscais externas.
- [x] HTTPS: login 200; Porções/Insumos/Produtos/Central protegidos sem sessão (307).
  UI autenticada: Nova porção, Editar e Ordenar categorias abriram os popups oficiais;
  fechamento sem alterações aprovado. Busca e ordenação com os mesmos limites verticais.
  Nenhum cadastro, remoção ou ordem real foi salvo para testar. Captura privada
  `.tmp-porcoes-publicado.png`. Evidência pós-deploy enviada somente à branch de trabalho,
  sem provocar outra publicação apenas documental.

## Categorias com porções — 04/10/2026

Correção solicitada e publicação autorizada: `codex/porcoes-categorias-cadastradas-20261004`.
Base remota `fe5765f9` incorporada, preservando a correção paralela de manifestação.

- [x] Popup mostra somente categorias com alguma porção não removida; independente
  da busca. Primeira inclusão/última remoção atualiza o conjunto imediatamente.
- [x] Servidor exige todas as participantes atuais, com autorização/versões/auditoria
  existentes. Ordem e revisão de categorias sem porções são preservadas; nenhum schema
  ou migration alterado. Metadados completos permitem cadastrar porção sem recarga.
- [x] Dez arquivos/312 testes aprovados: 22 integrações reais em PostgreSQL local
  descartável (55484), 15 testes de interface, consumidores de composição e fronteiras.
  Cobertura de porção removida, conjunto desatualizado, categoria vazia, filtro de busca,
  primeira inclusão, última remoção e salvamento da ordem. Sem timeout ampliado.
- [x] ESLint focado, lint:design (8 bases/317 consumidores), tipos completos e diff.
  Prévia desktop/celular com categoria sem porções excluída; teclado/Salvar/reabrir
  preservam a sequência. Sem overflow; mesmos Dialog/ListaOrdenavel, nenhum novo padrão.
- [x] Backup privado `etiquetas-porcoes-categorias-20261004-a`, 41.671.002 bytes;
  catálogo e conteúdo verificados, sem restauração ou chamada fiscal externa.
- [x] Build webpack da revisão `a709e37` e smoke local compilado aprovados: login 200,
  Porções/Insumos/Produtos/Central protegidos sem sessão (307), cinco verificações.
- [x] Antes do envio, incorporada a main `6be26474` (edição de listas de cadastros)
  em `da49bd1a`, sem conflitos. Quatro arquivos/34 testes, tipos completos, build webpack
  e cinco verificações HTTP repetidos e aprovados nessa base combinada.
- [ ] Publicação e conferência autenticada final.
