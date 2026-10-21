# Fiscal — Visão geral em Financeiro

Implementação original: `codex/fiscal-dashboard-financeiro`, commit `478b30b2`.
A publicação autorizada de 11/10/2026 e seus testes permanecem no histórico.
## Ajuste de layout — 16/10/2026

Branch `codex/fiscal-layout-20261016`, baseada na main `2c23fbb6`. A referência
confirmada pelo usuário é o padrão atual do HUB. As validações antigas abaixo
registram outras revisões; não comprovam esta entrega.

- Cartões clicáveis de Faturamento, Despesas, Canceladas e Ticket médio filtram
  Últimos documentos. Faturamento e Despesas informam a quantidade de notas.
- O período reutiliza `FiltroPeriodo`, o mesmo componente do DRE. Aplica datas
  completas ao sair do campo ou pressionar Enter. Intervalos invertidos ou inválidos
  não são aplicados. URLs inválidas apresentam uma mensagem de correção.
- Últimos documentos reúne NF entrada, NFC entrada, NF saída e NFS entrada.
  Mostra tipo, número, Data de emissão, situação e valor. Há abas por tipo e até
  oito documentos por seleção. A origem fiscal e o modelo continuam separados.
- Os slots Serviços contratados e Pendências fiscais foram removidos. O resumo
  de Configurações fiscais e certificado ocupa a lateral de Últimos documentos.
- Configurações reúne série/próximo número e certificado. Os campos recebem a
  última sequência confirmada para o modelo e ambiente. Sem consulta confirmada,
  ficam vazios. Uma leitura com mais de cinco minutos exige nova consulta para salvar.
- Consultar e salvar continuam ações explícitas. As travas, auditoria, confirmação
  posterior, idempotência e bloqueio contra redução/reinício permanecem no domínio.
- Certificado saiu de Dados da empresa. Mantém as ações existentes e as permissões
  `configuracoes.loja`: visualizar metadados, editar para upload/senha e excluir
  para remoção. Editar/excluir continuam restritos a administradores. Entrar na
  página também exige `financeiro.fiscal.painel`. Nenhum acesso foi concedido.
- Os painéis reutilizam `vidro-painel`, fontes, cores, componentes, lateral e
  cabeçalho existentes. A remoção do certificado usa o X oficial com nome acessível.
  A exceção histórica desse botão foi retirada do baseline porque foi corrigida;
  nenhuma referência visual foi aprovada ou atualizada automaticamente.

### Dados e limites desta revisão

Despesas soma NF-e/NFC-e recebidas e `NotaFiscalServico.valorServico`, com precisão
em centavos. NFS-e é apenas leitura das estruturas existentes, delimitada pelo
tomador. Mantém a regra de visibilidade do Manifesto: desde 10/09/2026 ou importada
manualmente. Usa a data escrita no XML ou sua projeção fiscal `dataEmissao`; nunca
`createdAt`, `updatedAt`, competência do serviço ou data de aceite.

NFS-e nacional obtida automaticamente pela integração existente comprova produção.
Arquivo manual exige ambiente explícito no XML. XML inválido, ambientes contraditórios,
data ou valor ausente tornam a soma afetada indisponível. Comentários XML não
comprovam data ou ambiente. Cancelamento fiscal exclui o valor; recusa/aceite interno
não substitui a situação fiscal. Não houve consulta externa, emissão, importação,
alteração de certificado/CSC ou mudança no fluxo de notas recebidas.

Datas vazias abrangem o histórico disponível. O gráfico preenche dias sem movimento
até 3.660 dias; em intervalos maiores, mostra os dias observados em escala temporal.
Os totais sempre conservam o período inteiro. Canceladas usa a data oficial do
evento; a lista usa a data de emissão. Cancelamento sem data comprovada mantém a
métrica indisponível. Os contadores das abas mostram traço quando a fonte não permite
confirmar a quantidade. Valores fiscais não representam pagamentos financeiros.

### Validação de 16/10/2026

Executada no worktree exclusivo em **Node 22.23.3**. Sem `.env` produtivo, dados
reais ou chamadas fiscais externas. PostgreSQL 17 exclusivo em `127.0.0.1:55439`,
banco `teste_fiscal_layout_20261016` e schemas efêmeros com as migrations existentes.
Nenhuma dependência nova, alteração de schema ou migration foi necessária.

| Verificação | Resultado |
| --- | --- |
| Lint global (`npm run lint -- --ignore-pattern '.tmp/**'`) | Aprovado. |
| `npm run lint:design` | Aprovado: 8 bases, 407 consumidores; zero desvios novos. Uma exceção histórica de remoção foi corrigida e retirada. |
| `next typegen` e `tsc --noEmit` | Aprovados, sem relaxar tipos. Client Prisma gerado somente nesta cópia. |
| Fiscal, NFS-e, permissões, layout, Central e consumidor de emissão | **2.129 testes aprovados**, 194 opcionais desativados em 9 arquivos. Os opcionais desativados não são testes aprovados. Inclui **7 integrações PostgreSQL do dashboard executadas**. |
| Chromium: Visão geral e Configurações | **24 testes aprovados**, em 320/390/768/1440 px, claro/escuro. Inclui cartões, abas, datas, teclado, retorno de foco no diálogo, vazio e permissões. `auditarInterface` sem problemas nos estados capturados. |
| `lint:visual:referencias` e `test:visual:referencias` | Aprovados, **60 cenários**. Capturas consultivas; nenhuma imagem foi aprovada como referência humana. |
| `npm run build` | Aprovado com os avisos existentes de middleware/proxy e `jose` no runtime Edge; esses arquivos não foram alterados. |
| Aplicação compilada: HTTP local | **18 verificações aprovadas**, apenas GET: leitor, negado, sessão revogada, administrador, certificado fictício, ausência de arquivo/senha, período inválido, redirects e host. |

A inspeção visual identificou sobreposição das abas no celular. A grade foi corrigida
e recapturada. O formulário de numeração também foi compactado. Lateral, cabeçalho,
tema e componentes reais do HUB estão presentes nas duas prévias. As tabelas mantêm
a rolagem interna oficial e explicação no celular. A auditoria automatizada é parcial;
não certifica WCAG, leitores de tela ou integração fiscal externa.

Capturas sintéticas para revisão humana:

| Tela | Desktop | Mobile |
| --- | --- | --- |
| Visão geral | [1440 px](capturas/2026-10-16/visao-geral-desktop.png) | [390 px](capturas/2026-10-16/visao-geral-mobile.png) |
| Configurações | [1440 px](capturas/2026-10-16/configuracoes-desktop.png) | [390 px](capturas/2026-10-16/configuracoes-mobile.png) |

As imagens permanecem **Em revisão visual**. Logs, demais temas/larguras e banco
fictício permanecem privados em `.tmp/fiscal-layout-20261016`. Regressão:
`vitest run testes/fiscal-dashboard testes/fiscal-saida testes/nfse testes/permissoes testes/design-system testes/layout testes/financeiro/fiscal-dashboard-interface.test.tsx testes/vendas/emitir-nota-pedido-interface.test.tsx --maxWorkers=1`,
com `FISCAL_DASHBOARD_BANCO_TESTE=1` e conexão exclusiva local. Visual:
`playwright test --config testes/visual/fiscal-dashboard-operacao.playwright.config.ts`.

### Integração e publicação

A main remota continuava em `2c23fbb6` na conferência final. Esta revisão não altera
o trabalho paralelo de emissão. As rotas antigas de numeração e as rotas técnicas
fiscais permanecem compatíveis. Não há migração nem reconciliação de dados pendente.
Fontes sem comprovação continuam explicitamente indisponíveis até serem corrigidas
pelo fluxo operacional existente. A revisão foi enviada na branch
`codex/fiscal-layout-20261016`, pelo PR #28.

Na publicação autorizada em 16/10/2026, a main avançou para `4fa0db65`, com os ajustes
de Validades. A branch fiscal incorporou esse commit sem conflitos. O código do Fiscal
permaneceu idêntico ao da revisão `3dd42775`. A combinação passou por 893 testes
(52 ignorados), 24 cenários visuais fiscais, lint, lint:design, typecheck e build no
Node 22. O primeiro ciclo completo de validação permanece registrado acima.
A conferência HTTPS, a inspeção autenticada e os metadados da publicação são
registrados no ambiente privado de execução. Esse registro não integra dados reais
ao repositório nem exige nova publicação apenas para adicionar evidências.

## Navegação e acesso

Financeiro termina com **Bancos → Fiscal**, nesta ordem:

- Visão geral: `/financeiro/fiscal`.
- Grupos fiscais: `/financeiro/fiscal/grupos`.
- Vínculos fiscais: `/financeiro/fiscal/vinculos`.
- Configurações: `/financeiro/fiscal/configuracoes`.

Empresa fiscal, Classificação fiscal, Regras de emissão e Homologação individual
saem do menu e da visão geral. As rotas e as guardas permanecem disponíveis aos
fluxos existentes. O perfil central continua como fonte da emissão, sem deduzir
CRT do rótulo Simples. A consulta ao Dashboard não libera edição desses cadastros.
`/financeiro/fiscal/numeracao` redireciona para Configurações e preserva parâmetros.

Fiscal deixa Vendas, inclusive no catálogo central. O ID histórico `vendas.fiscal`
e suas concessões continuam nos cadastros. O painel exige o recurso novo
`financeiro.fiscal.painel`, negado por padrão. Perfis somente com cadastros entram
por Grupos. Menu móvel e recolhido aplicam as mesmas regras. Nenhuma concessão nova
é criada automaticamente.

Redirects permanentes em `next.config.ts` preservam subrotas e parâmetros.
`/vendas/fiscal` continua correspondendo ao cadastro de Grupos; `/vendas/fiscal/vinculos`
vai a Vínculos. Destinos servem as páginas reais, sem ciclos. Ações dos cadastros
também invalidam os novos caminhos após alterações relevantes.

## Fontes e métricas

`src/lib/fiscal-dashboard/servidor.ts` exige autorização **antes** das leituras.
O DTO não contém XML, credenciais, endereço ou erros internos. Referências comerciais
e links administrativos dependem das permissões próprias. O dashboard não chama
Brasil NFe/SEFAZ nem grava dados fiscais.

Na publicação isolada, `configuracao-opcional.ts` verifica a presença da tabela
de integração antes da leitura. A projeção retorna somente flags de credenciais,
diagnóstico e vínculo ao emitente; ciphertext não é transferido para o dashboard.
Sem tabela ou ambiente de integração configurado, o estado é Não configurada.
A main atual pode informar a presença de credenciais pelo ambiente já existente,
sem devolver seus valores nem presumir conexão ou validade do certificado. O link administrativo
exige também recurso/rota central disponíveis e permissão própria. A publicação
não inclui a configuração Brasil NFe, schema ou migrations da branch de emissão.

| Indicador | Valor e competência |
| --- | --- |
| Faturamento | `vNF` de XML autorizado de `DocumentoFiscalSaida`, status local AUTORIZADO e coincidência de chave, protocolo, emitente, ambiente e modelo; data oficial `dhEmi`/`dEmi`. |
| Despesas | `NotaFiscalRecebida`, com evidência no XML/diário `SefazDocumentoRecebido` do CNPJ, e NFS-e do tomador conforme os limites acima. Data de emissão fiscal; não criação, caixa ou aceite interno. |
| Canceladas | Cancelamentos locais de saída com `dhRegEvento` de evento confirmado e vinculado à chave/ambiente/protocolo; excluídos da receita. |
| Ticket médio | Faturamento autorizado / quantidade dos documentos elegíveis, arredondado em centavos. Sem documentos, a média é indefinida: traço. |
| Movimento diário | Saídas e entradas por dia fiscal original; lacunas interrompem a série em vez de virar zero. |
| Receita por documento | Participação no valor autorizado dos modelos 55 (NF-e) e 65 (NFC-e), com valores e contagens separados. |

Agregação monetária em centavos `bigint`; apresentação sem converter totais a float.
Canvas usa números somente para desenhar proporções, sem recalcular métricas.
Competência conserva o dia escrito no XML, inclusive seu offset. Datas `YYYY-MM-DD`
não viram meia-noite UTC na exibição. Nenhum total do pedido, `createdAt`, `updatedAt`
ou timestamp interno substitui um dado fiscal ausente.

Consultas delimitam ambiente e candidatos da competência no servidor. AAMM da chave
somente amplia a candidatura para detectar lacunas; não substitui a data oficial.
Todas as páginas de 100 registros são percorridas: não existe o antigo teto de 15 mil.
Apenas Últimos documentos é limitado a oito registros. O diário é lido por página
de chaves; `chaveAcesso` única impede duplicar resumo e XML completo da mesma nota.

## Estados explícitos

- Produção e homologação são seleções exclusivas, sem opção Todos.
- A distribuição SEFAZ existente consulta produção. Entradas de homologação são
  indisponíveis; o fluxo de notas recebidas permanece intacto.
- Zero aparece após leitura elegível sem valores nem lacuna pertinente. Fonte,
  identidade/valor/data ausentes ou competência incerta deixam a métrica afetada
  indisponível e geram pendência.
- Canceladas e rejeitadas não compõem receita. Resumo de evento SEFAZ de cancelamento
  sem confirmação completa exige conferência e deixa entradas indisponíveis.
- Solicitações preparadas, incertas e sem data são pendências operacionais do ambiente,
  sem atribuição silenciosa ao mês selecionado.
- Serviços usam diagnóstico administrativo persistido ligado ao emitente e ambiente.
  Credenciais não comprovam contratação ou certificado. Validade do certificado
  permanece **Não verificada** na ausência de evidência independente.
  Credenciais não comprovam contratação ou certificado. A validade do certificado
  **SEFAZ** vem de `CertificadoDigital.validoAte`, extraído do PFX no upload nas
  Configurações fiscais. O painel lê somente essa data, após a permissão fiscal;
  arquivo, senha, cifra e titular não são consultados nem enviados ao cliente.
  Prazo é calculado no servidor pelo instante atual, sem depender do período ou
  ambiente fiscal. Até 30 dias usa aviso, vencido usa estado destrutivo e acima
  disso usa sucesso. A data aparece em `America/Sao_Paulo`. Sem metadados válidos
  ou após falha de leitura, continua **Não verificada**. Essa informação local
  não comprova a disponibilidade do certificado no provedor de emissão.

## Interface e evidência visual

A captura fornecida mostra filtros, quatro cartões coloridos e dois gráficos iguais
lado a lado. Essa composição guia a implementação. O conteúdo segue o pedido:
serviços/certificado, valores mensais, movimento diário e receita por modelo.
Lateral, cabeçalho, fonte nativa e tokens do HUB foram preservados, sem marcas do fornecedor.

Card, Select, Badge, Button e Table reutilizam a Central. Canvas tem legenda,
consulta por teclado e equivalente textual. Nenhuma dependência nova. No mobile,
indicadores têm uma ou duas colunas conforme a largura, gráficos uma e tabelas rolagem própria.

Prévia: `node node_modules/vite/bin/vite.js --config testes/visual/fiscal-dashboard.vite.config.mts`.
URL `http://127.0.0.1:4448/fiscal-dashboard.html`; filtros usam fixtures sem Prisma,
configuração real ou chamadas externas. Links da moldura simulam navegação; destinos
reais são verificados separadamente por testes de páginas/permissões e smoke do Next.

[Capturas](evidencias/) · [QA visual](../../../design-qa.md).
Referência do consumidor **Em revisão**, até aprovação humana.

## Reconciliação futura e limitações reais

1. A emissão deve preservar XML autorizado/valor/data e evidência separada do evento
   de cancelamento. O retorno desta base não guarda todos esses dados; o painel apresenta
   lacunas sem estimativas. Esta branch não altera `fiscal-saida`.
2. Certificado e homologação operacional exigem evidência independente. Esta entrega
   não configura certificado/CSC, habilita fila/emissor ou homologa SEFAZ.
2. Disponibilidade do certificado no provedor e homologação operacional exigem
   evidência independente. Esta entrega não configura certificado/CSC, habilita
   fila/emissor ou homologa SEFAZ. A validade SEFAZ cadastrada é exibida separadamente.
3. Números representam documentos locais elegíveis, sem afirmar cobertura de notas
   fora do HUB. Nenhum dado produtivo foi usado nos testes.
4. Sem novas colunas/migrations, candidatos usam XML/chave e emissão normalizada das
   recebidas. Históricos grandes merecem projeção fiscal indexada na origem e medição
   própria; paginação remove truncamento, mas não substitui índices.
5. Reconciliar em branch própria conservando mudanças paralelas e conferindo contratos
   de retorno/diagnóstico. A projeção de hash reproduz o helper privado atual e deve
   ser conferida se ele evoluir. Não sobrescrever o trabalho da emissão.
6. Preservar a seção de atividades de `catalogo.ts` e contexto/auditoria de
   `permissoes/servidor.ts` em `origin/main` (`5c883c94`/`fedebea8`). Nenhum merge foi feito.
7. A branch já contém `20261010090000_brasilnfe_marco1`, que cria a configuração
   consumida pelo painel. Essa migration pertence à integração existente e não foi
   alterada nesta entrega. Coordenar sua aplicação no fluxo futuro de integração;
   somente os bancos sintéticos receberam migrations durante os testes desta tarefa.
7. A branch original contém `20261010090000_brasilnfe_marco1`, pertencente à emissão.
   A versão de publicação não importa essa migration nem altera o schema: lê a
   configuração somente quando a tabela já existe e apresenta Não configurada
   quando ausente. Permissão/link da integração dependem da existência do recurso
   central. Assim, a publicação do dashboard preserva a evolução separada da emissão.

### Atualização paralela verificada no fechamento

O fetch final encontrou `origin/codex/fiscal-brasilnfe-m1` em **`e64ffcac`**, após
`90d7b470`. O delta foi examinado somente por leitura. Esta entrega permanece na
base própria; a reconciliação deverá tratar estes contratos antes da integração:

| Mudança na emissão paralela | Reconciliação necessária |
| --- | --- |
| `xmlCancelamento`, `protocoloCancelamento`, autorização original preservada | Loader/agregador deverão ler as evidências separadas: competência por `dhRegEvento`, valor por `vNF` original. Ausência continua indisponível. |
| `cancelamentoPendente` | Expor a incerteza mesmo quando houver XML autorizado preservado, com pendência e tratamento explícito do valor. |
| Novo terminal `DENEGADO` | Classificação própria fora do faturamento, sem confundir com fila pendente ou sugerir reenvio. |
| `preRequisitos`, `preRequisitosEmitenteHash`, `preRequisitosIniciadoEm` | Usar o contrato `restaurarPreRequisitosBrasilNfe` após validar emitente, ambiente, versão e data; distinguir evidência manual de consulta confirmada e vencimento. |
| Nova `/vendas/fiscal/regras-brasilnfe` | Criar o destino real em Financeiro e redirect específico antes do genérico. Sugestão: `/financeiro/fiscal/regras-brasilnfe`, mapeada explicitamente a `vendas.fiscal`, conservando os três itens de menu pedidos. Atualizar link da integração, três `revalidatePath` das ações e testar permissões/alias sem 404 ou ciclo. |
| Schema e documentação | Conciliar as três migrations aditivas novas (`20261011090000_brasilnfe_regras_tributarias`, `20261011100000_brasilnfe_preparacao_operacional`, `20261011110000_brasilnfe_denegacao`), client e `docs/modulos/fiscal.md`, preservando ambas as entregas e testando em banco isolado. |

O redirect genérico desta branch interceptaria a nova rota de regras e a levaria
a um destino inexistente se as branches fossem simplesmente combinadas. Os campos
atuais e as estruturas SEFAZ permanecem compatíveis; as novas evidências precisam
de adaptação explícita do dashboard e de seus testes. Planos/regras preparados
continuam sem substituir valores autorizados. A emissão permanece bloqueada no
delta remoto: adaptador operacional nulo, autorização negada e callback ausente.
As validações abaixo se referem à versão desta branch, não ao resultado de uma
reconciliação futura.

## Validação desta revisão
## Validação da branch original — `478b30b2`

Executada em **Node 22.23.3**, no worktree exclusivo da branch, em 11/10/2026.
PostgreSQL 17 escuta somente em `127.0.0.1:55437`, com banco e pessoas fictícios.
Não foi carregado `.env` produtivo nem feita chamada fiscal externa. Dependências
existentes foram reutilizadas; o client Prisma foi gerado somente neste worktree.

| Verificação | Resultado |
| --- | --- |
| Lint global, `npm run lint -- --ignore-pattern '.tmp/**'` | Aprovado, sem erros/avisos. Exclusão apenas dos temporários desta tarefa. Lint focado repetido após ajustes finais. |
| `npm run lint:design` | Aprovado: 8 bases e 360 consumidores TSX. |
| `next typegen` e `tsc --noEmit` integrais | Aprovados; nenhum tipo ou configuração relaxado. |
| Fiscal, fontes/precisão e consumidor | 45 testes de backend + 7 de UI aprovados, incluindo 5 integrações SQL reais locais. UI repetida após os últimos ajustes: 7/7. |
| Integrações opt-in pertinentes | 4 arquivos, 65 testes aprovados, zero skips, com `FISCAL_DASHBOARD_BANCO_TESTE`, `BRASILNFE_BANCO_TESTE`, `PEDIDOS_BANCO_TESTE` e `ACESSOS_BANCO_TESTE`. |
| Navegação, redirecionamento e permissões | Testes de páginas reais e guardas centrais, menus por perfil e invalidação das novas rotas aprovados; incluídos também na regressão geral. |
| `npm test -- --maxWorkers=1 --testTimeout=15000` | **317 arquivos / 3.365 testes aprovados**, zero falhas; **37 arquivos / 618 testes ignorados**. Os ignorados não são declarados aprovados. Duração 1.159,21 s. |
| `npm run build` (webpack) | Aprovado: compilação, TypeScript e 91/91 páginas estáticas. As três rotas constam no artefato; grade final de quatro colunas confirmada no JS compilado. |
| Smoke HTTP da aplicação compilada | **17/17 GET aprovados**, somente localhost. Três páginas: leitor 200; anônimo e sessão revogada 307 para login; perfil sem permissão 307 para sem-acesso. Três aliases 308 com query preservada; login 200; host indevido 421. |
| QA visual em browser | Desktop, tablet e mobile 320–1440 px; claro/escuro, filtros, teclado do gráfico, menu e estados. Comparação conjunta com a referência, recapturas finais e console sem erros/avisos. [Relatório](../../../design-qa.md). |

As contagens das suítes focadas se sobrepõem: não devem ser somadas à regressão
geral. Logs extensos e banco ficam ignorados em `.tmp/fiscal-dashboard/`, sem
secrets ou dados reais versionados.

Os 618 skips pertencem a blocos condicionais de integrações de banco/HTTP:
39 arquivos contêm 31 flags opt-in; 37 ficaram inteiramente ignorados, enquanto
`financeiro/plano-contas-pessoal` e `mcp/multimodulo` também têm casos normais
executados. Não foram encontrados `it.skip`, `test.skip` ou `describe.skip`
explícitos. Somente os quatro opt-ins pertinentes desta entrega foram ativados
separadamente; os demais continuam sem validação nesta tarefa.

O smoke usou três pessoas fictícias. O leitor tinha somente visualização de
`financeiro.fiscal.painel`, `vendas.fiscal` e `notas`; o negado nenhuma concessão;
o revogado versão de sessão incompatível com o banco. Todos os tokens alegavam
administração, e o servidor aplicou as permissões reais. Header Host simulado no
Next local não gerou acesso ao domínio produtivo. A primeira tentativa do harness
omitiu a permissão do painel e recebeu o bloqueio correto; somente a fixture foi
corrigida antes dos 17/17 finais, sem alterar o gate.

Reprodução das integrações, após configurar `DATABASE_URL` exclusivamente local
com as guardas dos testes e as quatro flags acima em `1`:

```text
node node_modules/vitest/vitest.mjs run testes/fiscal-dashboard/integracao.test.ts testes/fiscal-saida/brasilnfe-configuracao-integracao.test.ts testes/vendas/fiscal-saida-integracao.test.ts testes/permissoes/integracao.test.ts --maxWorkers=1 --testTimeout=15000
node node_modules/vitest/vitest.mjs run testes/fiscal-dashboard testes/financeiro/fiscal-dashboard-interface.test.tsx --maxWorkers=1 --testTimeout=15000
```

TEMP/TMP apontaram para os temporários do worktree. O smoke foi executado com
`node .tmp/fiscal-dashboard/smoke-fiscal.mjs` contra Next em `127.0.0.1:3819`;
script/log são privados ignorados. Next do smoke e PostgreSQL de teste são
encerrados ao concluir; a prévia Vite sintética permanece disponível para revisão.

Limitações de execução investigadas: uma rodada sob carga concorrente excedeu o
limite de tempo em um teste de Kanban alheio ao escopo; o mesmo arquivo passou
isolado com o mesmo limite de 15 s, e a bateria geral final sequencial passou.
Importações frias de duas fronteiras centrais excederam o padrão de 5 s; passaram
isoladas nesse padrão e a suíte de 212 fronteiras passou com limite explícito de
15 s, sem alterar configuração ou asserções. A desmontagem de schema SQL recebeu
30 s após um timeout sob concorrência; as cinco integrações foram repetidas com
sucesso e o schema temporário foi removido pelo próprio teste.

Avisos preexistentes do build: convenção `middleware` depreciada e
`jose`/`CompressionStream` no runtime Edge. As fontes correspondentes não foram
alteradas nesta tarefa; esses avisos não impediram a compilação. A primeira versão
anterior não tinha compilação/QA visual: esta revisão substitui essas pendências
históricas, sem representar homologação externa.

## Validação da publicação isolada sobre a main

Base `fedebea8`, branch `codex/fiscal-dashboard-publicacao-20261011`.
Node **22.23.3**, PostgreSQL **17** em `127.0.0.1:55437`, banco exclusivo
`teste_fiscal_publicacao`. As **119 migrations existentes** foram aplicadas apenas
nesse banco fictício. `ConfiguracaoBrasilNfe` está ausente nessa base, como na
produção; os testes criam a relação opcional somente em schema sintético guardado.

| Verificação | Resultado desta base |
| --- | --- |
| Prisma generate local e Next typegen | Aprovados. Sem arquivo `.env` privado, instalação ou alteração de dependências. |
| Lint global e lint:design | Aprovados; 8 bases e **359 consumidores TSX**. |
| Typecheck integral | Aprovado, inclusive após as correções das fixtures. |
| Domínio, UI, layout, permissões e atividades | **542 testes distintos aprovados**, 22 opt-ins desativados. Os desativados não são aprovação. |
| Backend fiscal e UI | **44 unitários + 7 SQL + 7 UI** aprovados. Inclui ausência da tabela de emissão, flags sem ciphertext e preservação das capacidades centrais. |
| Integrações opt-in pertinentes da main | **26 testes aprovados**: dashboard 7, emissão local simulada 7, acessos 12. Flags `FISCAL_DASHBOARD_BANCO_TESTE`, `PEDIDOS_BANCO_TESTE`, `ACESSOS_BANCO_TESTE`. Nenhuma integração fiscal externa. |
| Regressão geral final | **318 arquivos / 3.039 testes aprovados**, zero falhas; **39 arquivos / 599 testes opt-in desativados**, não aprovados. Total 357 arquivos / 3.638 casos. Duração 1.460,75 s. |
| Build de produção webpack | **Aprovado**, código de saída 0; **90/90 páginas estáticas**, incluindo as três rotas fiscais. Webpack 3,0 min, TypeScript integrado 2,8 min e geração estática 11,8 s. |
| Smoke da aplicação compilada | **17/17 GETs aprovados**, código de saída 0, sem erro no log Next; somente `127.0.0.1:3819`, banco, usuários e chave fictícios. |

Correções específicas da validação: o teste de privacidade passou a distinguir a
referência a uma coluna dentro de `NULLIF` da seleção do seu valor, exigindo flags
booleanas e ausência das cifras no DTO. A fixture de acessos agora define
`search_path` no PrismaPg para resolver os gatilhos de atividades no próprio schema
isolado, como as demais fixtures. Aplicação, migrations e asserções de acesso
permanecem intactas; os dois arquivos afetados passaram novamente (**28/28**).

A revisão independente de escopo confirmou preservação do recurso de atividades,
da auditoria `AUTORIZACAO_NEGADA`, de SEFAZ, emissão, configurações, schema,
migrations e dependências da main. Os quatro arquivos principais da interface
coincidem com os usados nas capturas `478b30b2`, e os componentes/tokens da Central
são iguais nas duas bases. A evidência visual continua correspondente.

Inventário de produção pré-publicação, somente metadados: imagem anterior e
fingerprints de configuração preservados em snapshot privado, um certificado no
banco, ausência de fallback fiscal no ambiente/mount e nenhuma migration pendente,
extra ou falhada em relação à main. Validade/conteúdo do certificado não foram
consultados; a existência local não comprova o certificado do provedor de emissão.
Logs e snapshots ficam ignorados em `.tmp/fiscal-publicacao/`.

Comando da regressão final desta base:

```text
npm test -- --maxWorkers=1 --testTimeout=15000 --reporter=verbose
```

O reporter detalhado ficou em arquivo privado, permitindo acompanhar casos
efetivamente executados. A bateria geral foi executada uma vez, sequencialmente,
após o diagnóstico e revalidação dos dois arquivos de testes corrigidos.

Os 599 casos desativados usam flags opt-in de banco/HTTP. Os 26 pertinentes foram
executados separadamente com as guardas locais; os outros 573 não foram executados
nesta tarefa. Nenhum `it.skip` permanente foi identificado nesses arquivos.

O smoke desta base confirmou 308 com busca preservada nas três entradas legadas;
nas três novas rotas, anônimo 307/login, leitor 200 com título renderizado, negado
307/sem-acesso e revogado 307/login. Login retornou 200 e host inválido 421.
O `Host: grazinghub.com.br` foi simulado apenas no Next local; isso não representa
teste produtivo. Next e PostgreSQL próprios foram encerrados após a execução.
O build apresentou somente os avisos preexistentes de `middleware` e de
`CompressionStream`/`DecompressionStream` de `jose` no Edge Runtime.

## Correção da validade do certificado — 12/10/2026

Base atualizada para `origin/main` `f833bcaf`, preservando as mudanças de estrutura
fiscal e qualidade visual já integradas. O painel passa a usar o metadado real de
Dados da empresa, em vez de apresentar sempre Não verificada. A data não é fixada
a partir de captura ou informação manual. O cenário de 07/11/2026 nos testes é
fictício e serve para verificar a leitura/projeção do vencimento.

`certificado.ts` resume somente `validoAte`; `servidor.ts` seleciona essa coluna
do singleton após a guarda fiscal. O DTO contém estado, ISO e dias restantes, sem
arquivo, senha, cifra, titular ou identidade privada. Falha de leitura não derruba
as métricas nem expõe erro interno. O instante de vencimento prevalece sobre o
arredondamento: expirado há minutos já aparece Vencido, mesmo quando o prazo
arredondado seria zero. Conexão, serviços e habilitação da emissão não são inferidos
da validade local. Nenhuma ação de Dados da empresa ou fluxo SEFAZ foi alterado.

Consumidor de referência: `configuracoes/certificado-card.tsx`, com Card/Badge
oficiais e variantes success/warning/destructive. A moldura e os demais componentes
do painel foram preservados. A prévia mantém o atalho de Pedidos simulado e fixa
o tema solicitado para não depender de preferência salva; isso não altera produção.

| Verificação desta correção | Resultado |
| --- | --- |
| Node e banco | **22.23.3**; PostgreSQL local exclusivo `teste_fiscal_certificado_dashboard`, com **122 migrations da main**, sem migration nova. |
| Domínio, servidor, UI, SQL, navegação e permissões | **113/113 aprovados**, 9 arquivos, nenhum desativado; inclui **8 integrações PostgreSQL**. Duração 48,51 s. |
| Lint focado | Aprovado em 13 arquivos de código/teste. |
| Lint:design | Aprovado: 8 bases/364 consumidores; verificação visual em 365 arquivos, 98 desvios históricos e nenhum novo. Baseline não alterado. |
| Next typegen e typecheck integral | Aprovados, códigos de saída 0. |
| Build webpack da correção | **Aprovado**, código de saída 0; **92/92 páginas**, incluindo as quatro rotas fiscais atuais da main. Compilação 85 s, TypeScript 66 s e páginas 6,7 s. Somente aviso preexistente de `middleware` depreciado. |
| Smoke compilado | **17/17 GETs aprovados**, código de saída 0; validade fictícia de 07/11/2026 e identificação SEFAZ/Dados da empresa presentes. Leitor, negado, revogado, aliases e host conferidos; sem arquivo/senha e sem erro no log Next. |
| Evidência visual isolada | **11 cenários inspecionados**: 320/390/768/1440, claro/escuro, mais ausência, vigente e vencido; `auditarInterface(document)` sem problemas em todos. |

[Desktop](evidencias/certificado-1440-claro.jpg) ·
[Celular](evidencias/certificado-390-claro.jpg) ·
[Diagnóstico visual](evidencias/certificado-responsividade.json).
Comparação visual com o cartão fornecido: formato e aviso de vencimento preservados,
com identificação explícita da origem SEFAZ no dashboard. Capturas correspondem a
esta correção, com dados fictícios. Referência permanece Em revisão humana;
diagnóstico DOM e imagens não certificam WCAG, leitor de tela ou hardware de toque.

A regressão global anterior não foi reapresentada como resultado desta correção.
A validação é proporcional à leitura de metadado e seu consumidor; schema,
dependências, permissões, layouts compartilhados e ações fiscais não mudaram.

## Correção do Dashboard — 17/10/2026

Faturamento usa success (verde), Despesas warning (amarelo) e Canceladas destructive
(vermelho). As linhas do movimento diário e suas legendas seguem Faturamento/Despesas.
Cards, geometria e estados permanecem nos componentes oficiais.

Últimos documentos oferece um Button outline icon-sm com Eye e nome acessível.
Ele abre o Dialog painel-direito oficial, sem navegar nem perder os filtros.
`documento-actions.ts` exige a permissão do painel antes de delegar ao serviço
`src/lib/fiscal-dashboard/documento.ts`. O serviço revalida a permissão da fonte:
notas para NF-e/NFC-e recebidas, financeiro.nfse para serviços e vendas.fiscal mais
vendas.pedidos para saídas. A lista desabilita a ação sem esse acesso.

A consulta usa somente registros locais e os extratores oficiais de parseNFe.
Mostra dados conhecidos, itens disponíveis, ausência de XML, carregamento e erro
com nova tentativa. O retorno não contém XML, contatos, endereços ou credenciais.
Resposta de um painel fechado não preenche outro. Abrir detalhes não manifesta,
não consulta o provedor, não obtém novos arquivos nem lança despesas.
