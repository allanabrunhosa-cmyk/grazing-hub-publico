# Execução — BI de vendas

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Dashboard e emissão no pedido — 20/10/2026

Branch `codex/dashboard-emissao-pedidos-20261020`, baseada na main `c4a51634`.
A pizza Pessoa física e jurídica ocupa o espaço anterior do ranking de produtos.
O seletor alterna Pedidos e Faturamento. Produtos que mais vendem passa para o
espaço de Oportunidades comerciais, removido da visão geral.

O cálculo usa a coorte filtrada do BI e o tipo do comprador no cadastro canônico.
Pedidos sem vínculo ou tipo ficam em Sem classificação. O faturamento inclui
descontos e frete, com agregação Decimal no servidor. Valores não apurados não
viram zero. A permissão central de contatos protege a distribuição.

Validações focadas: 63 testes de domínio, consulta e gráfico; 28 testes visuais
Playwright. Todos passaram em Node 22.23.3. O auditor visual não encontrou problemas
nas quatro larguras (320, 390, 768 e 1440), em temas claro e escuro. Capturas
inspecionadas e preservadas: [desktop](evidencias/20261020/dashboard-desktop.png)
e [mobile](evidencias/20261020/dashboard-mobile.png). Os dados são sintéticos.
Referências continuam Em revisão; nenhuma baseline aprovada foi substituída.

A validação integrada e o estado de entrega desta mesma branch ficam no
[registro de Pedidos](../pedidos/EXECUCAO.md#organização-do-detalhe-e-emissão-fiscal--20102026).

## Ajustes do Dashboard — solicitação de 15/10/2026

Branch `codex/dashboard-ajustes-20261015`, baseada na main `d0ac2255`.
Reutiliza a cópia anterior, preserva a branch original e não instala dependências.
Espaço inicial: 22,64 GB livres. Alterações alheias no checkout principal preservadas.

- [x] Inspeção da Central, filtro da DRE, ordenação, cadastro atual e fontes históricas.
- [x] Concluir composição, nomes, Descontos, recompra, ranking e Tipo.
- [x] Reconciliação, testes de domínio/consulta/SQL e permissões.
- [x] Conferência visual isolada e regressão do carregador de mapas compartilhado.
- [ ] Tipos, lint, build e CI antes de integrar.
- [ ] Publicação autorizada e smoke autenticado da nova revisão.
- [ ] Encerramento dos processos próprios e verificação de armazenamento.

Os endereços anteriores eram rotulados `Full Adress (Billing)`. O usuário forneceu
outra planilha com `Full Address (Shipping)`. A leitura conectada confirmou 1.711
números distintos, 1.658 endereços de entrega e 53 vazios. O usuário definiu esses
vazios como retiradas sem frete. Nenhum endereço de cobrança foi promovido.
A fonte bruta privada fica fora do Git. O enriquecimento consultivo será conferido
por vínculo legado exato, sem criar pedidos ou alterar dados operacionais.

A revisão automática bloqueou inicialmente a consulta dos 1.091 CEPs ao ViaCEP por
falta de autorização explícita para o payload de localização. Nenhuma consulta
foi executada nessa tentativa. O usuário autorizou expressamente o envio somente
dos CEPs. A execução posterior usa o provedor já existente; não envia nome, rua,
número, contato ou valor. O mapa Google permanece explícito, limitado e transitório.

Testes focados iniciais: 38/38 de domínio e novas análises aprovados. A rodada
integrada de navegação, permissões e consumidores do carregador aprovou 349 casos
em 12 arquivos. Contratos visuais: 20/20; refinamentos finais: cinco geometrias,
mapa com token convertido para hexadecimal e estado de erro aprovados.

Conclusão técnica: 152 testes em 11 arquivos de backend aprovados, incluindo
nove casos de SQL real. A revisão posterior corrigiu a permanência do filtro
PF/PJ fora de Clientes; 33 casos afetados passaram. A integração do enriquecimento
aprovou sete casos em PostgreSQL sintético, com READ ONLY, idempotência, CAS,
reversão e preservação das quinze tabelas protegidas. Um trigger sintético que
tentava alterar frete provocou rollback integral. Nenhum teste usou dados reais.

O build oficial com Node 22 passou. A primeira tentativa pelo wrapper npm local
encerrou na etapa TypeScript sem diagnóstico; a execução com o binário Node 22
explícito concluiu compilação, tipos e geração. O arquivo novo de integração
passou também na checagem global posterior, sem casts no evento SQL. Lint final
passou sem avisos; lint:design manteve zero desvios novos. A revisão visual corrigiu o
enquadramento do mapa e o corte de moeda em 1.800 px; os testes afetados passaram.

Preparação privada: snapshot de Shipping e retorno postal preservados fora do
Git. Foram encontrados 1.590 bairros compatíveis, 46 divergências postais e
16 entregas sem bloco postal suficiente. Nenhuma divergência foi corrigida por
suposição. Backup integral do HUB (119.815.952 bytes) validado com listagem e
leitura completa por pg_restore, sem restauração de banco. Configuração anterior
salva em diretório root privado. A aplicação dos metadados depende da revisão
publicada, prévia e guardas. Não deve ser confundida com importação de pedidos.

## Entrega inicial

Referência de produto: [SPEC.md](SPEC.md). Pedido de 15/10/2026 autoriza publicação
após validação, sem operar dados reais para teste.

- [x] Preparar branch isolada sobre main atual e preservar alterações locais anteriores.
  Base: `7a8e874ecdaf6698ff8fce68fc9a6fac4ab21ec5`.
  Espaço inicial: 25,77 GB. Dependências existentes compartilhadas sem reinstalação.
- [x] Ler contratos do domínio, Design System, testes, permissões e publicação.
- [x] Backend somente leitura, definições, filtros e exportação.
- [x] Navegação e permissões verificadas: 36 testes focados aprovados.
- [x] Interface operacional e detalhes paginados implementados.
- [x] Confirmar cobertura real da importação por consulta somente leitura.
  Contagens, classificações e limites registrados em [FONTES.md](FONTES.md).
- [x] Testes e reconciliação em ambiente isolado.
- [x] Conferência dos dados reais e medição do serviço publicado.
- [x] Revisão visual isolada e correções. Relatório em `design-qa.md`.
- [x] Nível C, revisão final e sincronização Git.
- [ ] Publicação autorizada e smoke.
- [ ] Encerramento do ambiente e avaliação restrita de armazenamento.

## Evidências e pendências

Revisão final das regras: 52 testes do BI e 3 da variante oficial do botão aprovados
nas execuções pertinentes. A última repetição de domínio e acesso aprovou 40 casos,
incluindo formato numérico na URL e no domínio.
PostgreSQL sintético real: 7 testes aprovados sobre as regras finais;
hashes de dez tabelas conservados e escrita recusada pelo banco. Consulta em
RepeatableRead/READ ONLY. Acesso e endpoint CSV: 9 testes aprovados em Node 22.
Interface: 12 contratos Playwright aprovados, incluindo toque e auditoria oficial
do DOM. Após o ajuste dos rótulos móveis, os sete cenários afetados passaram novamente.
Capturas em 1672/1280/768/390/320 px; conferência visual final aprovada.
Typecheck inicial e lint:design aprovados. A tentativa com heap de 1536 MB atingiu
esse limite. A execução com 4096 MB identificou quatro erros de tipo no teste de
pixels do canvas. O teste agora verifica HTMLCanvasElement antes de ler o contexto;
a checagem final completa do projeto passou com heap de 4096 MB, sem diagnósticos.

O CI existente passou no commit `3c7008435275632333e2910b40a5248d33b35b71`:
128 testes da Central aprovados (7 opt-ins ignorados), 252 contratos de interface,
60 cenários de referências e 6 verificações do comparador aprovados. Alterações
posteriores serão verificadas novamente antes da integração.
As revisões `3482cae7eafa9fd2308adc06ee5958ba6b17fe32` e
`55d01934345dd9d61053b3408c0fb512c2695fee` também passaram nos dois jobs.

A bateria ampla foi iniciada em Node 22, um worker. Apresentou timeouts em interfaces
existentes. Não foram relaxados limites ou asserções. A máquina chegou a 0,53 GB de
memória livre; validações simultâneas próprias foram encerradas após identificação.
Os arquivos relevantes às primeiras falhas têm hashes iguais à base. Isso não
substitui a investigação ou o resultado final da bateria.
O reporter `agent` do Vitest 4 mostra somente falhas durante a execução. A bateria
com forks terminou em 3295,47 s: 406 arquivos/5019 testes aprovados, 54 arquivos/
861 testes opt-in ignorados, 18 arquivos/24 testes com falhas e dois arquivos sem
iniciar o worker. Três falhas eram contratos antigos de ordem/registro corrigidos;
20 foram timeouts de 5 s e uma foi falha encadeada após timeout.
A repetição cobre os 20 arquivos falhos/não iniciados e três arquivos afetados
pela última correção dos filtros. Usa um worker e prazo temporário de 15 s por
teste, mantendo as asserções e a configuração do repositório. O limite temporário
decorre da pressão de memória e dos timeouts de inicialização confirmados no log;
não constitui ajuste de desempenho do produto. Todos os 20 arquivos que falharam
ou não iniciaram passaram na repetição. Nos três arquivos do BI acrescentados,
um caso novo de formato numérico falhou durante edição concorrente à execução;
os arquivos de domínio e acesso passaram novamente após concluir as alterações.
Não há falha de teste pendente nesta revisão. A bateria inicial permanece
registrada como falha, com os resultados das repetições acima.

Lint global final aprovado. A revisão visual final aprovou as cinco larguras,
toque e estados. Margem do eixo e rótulos móveis foram corrigidos e recapturados.
O contrato de escopo do segmento sem recompra passou após a correção final.
Três contratos finais passaram em 11,7 segundos: reabertura dos pedidos na página
1 com filtros preservados, período entre anos sem recorte e navegação por abas/painéis.

O token Git recusou a adição de um job de aplicação por ausência de escopo
`workflow`. A proposta de workflow foi retirada antes de publicar a branch.
As permissões da credencial foram preservadas. O CI visual existente permanece
ativo na PR; a bateria da aplicação será concluída localmente em sequência.

Nenhuma migration nova. A revisão automática recusou executar a candidata diretamente
no contêiner de produção por SSH. A medição e a reconciliação final usarão o BI
autenticado e o CSV oficial após publicação. Não houve tentativa de contornar a guarda.

## Revisão integrada e publicação

A main avançou para `86927a664f514dfca41c64cdb819a253f54b108e` durante a tarefa.
O merge na branch do BI preservou a entrega fiscal; só o manifesto de ações teve
mesclagem automática. Nenhum schema, migration ou dependência mudou nessa integração.

Head funcional validado: `e8c751efe00cd8e126ec0ad10863b43cfd3bd2f1`.
Sobre ele passaram 344 testes em dez arquivos, 47 testes dos consumidores de Pedidos
e sete testes PostgreSQL reais com opt-in (8,30 s). O cluster sintético foi encerrado.
Tipos completos, lint global e build webpack passaram em Node 22, em sequência.
O build compilou em 2,1 minutos e conservou avisos existentes de middleware e jose
no Edge Runtime. Não há diagnóstico de tipo ou erro de build pendente.

O CI #59 aprovou ambos os jobs. A PR 23 foi integrada sem bypass de proteção em
`821e71ddf1b58cb61db7dc37c9abaa554254ee60`, às 15h49 de 15/10/2026, São Paulo.
O merge acionou o fluxo Dokploy existente. O primeiro rollout foi conferido
separadamente, conforme os registros abaixo.

O primeiro rollout entrou em execução na tarefa `t6ptly3cslkxmxtzzdalz0n0p`,
contêiner `2607e2e28699`, desde 15:59:39, São Paulo, sem reinícios. Os quatro hashes
das fontes do BI coincidiram com o head validado. As 133 migrations estão aplicadas.
O CI #60 da main também passou.

O BI autenticado, os dois CSVs oficiais e a tabela textual do gráfico reconciliaram os mesmos totais e a mesma coorte. Os valores e as quantidades observados permanecem no registro privado.
Evidências agregadas e limites em FONTES.md; arquivos reais ficam privados em `.tmp`.

O smoke encontrou rótulos que confundiam região informada com destino validado.
A revisão pontual da interface separa os conceitos, sem alterar as fontes ou as
contas. Seis contratos passaram. Tipos/lint/build da correção e seu rollout final
serão conferidos antes de concluir a tarefa.

## Correção de 17/10/2026 — em validação

Branch própria codex/dashboard-frete-canais-20261017, baseada na main 4bc3cb79.
Reutilizado o worktree anterior limpo. Checkout principal e alterações alheias
preservados. Espaço inicial no C: 13,53 GB; sem instalação ou nova cópia.

Implementados os canais do cadastro de Pedidos, faturamento com frete e sua
reconciliação, cores semânticas e detalhes locais das notas no painel fiscal.
Sem schema, migration, importação ou gravação operacional.

A primeira tentativa de testes encontrou bloqueio de cache temporário do sandbox
(EPERM), sem executar casos. A repetição com cache na pasta da tarefa e pool threads
passou: 432 testes; sete integrações fiscais opcionais não ativadas nessa bateria.
A rodada final de SQL e consumidores afetados passou 100 testes, incluindo sete
integrações PostgreSQL verdadeiras na base sintética local teste_dashboard_bi.
A primeira revisão de tipos detectou o cliente Prisma local anterior à main;
foi regenerado do schema vigente, sem alteração do banco.

A primeira matriz fiscal passou sete cenários e excedeu 30 s no primeiro cenário
320 claro durante auditoria inicial. Repetição focada passou em 6,2 s, sem ampliar
limites ou mudar asserções. Matrizes finais, build e publicação ainda em conferência.

### Validação local final desta correção

- 435 testes aprovados na bateria final de domínio, UI e permissões. Sete opt-ins
  de integração fiscal não foram ativados; não são contabilizados como aprovados.
- 100 testes aprovados na rodada SQL/consumidores, incluindo sete integrações
  PostgreSQL sintéticas do BI. Cluster encerrado após concluir a reconciliação.
- Lint dos arquivos alterados e lint:design aprovados; zero desvios visuais novos.
- Build webpack aprovado: compilação 63 s, TypeScript 2,4 min. Aviso existente de
  middleware depreciado permanece. Nenhum erro de build ou tipos nessa compilação.
- Vendas: 22 contratos cobertos pela rodada principal e repetição focada. A única
  falha principal usava o título anterior Faturamento na coluna de produtos;
  o contrato foi atualizado para Receita líquida e passou, sem retirar a ordenação.
- Fiscal: oito cenários finais aprovados (320/390/768/1440, claro/escuro), incluindo
  abertura dos detalhes por Eye, Escape, retorno de foco e auditor oficial sem problemas.
- Capturas isoladas inspecionadas em desktop, notebook, tablet e celular. Faturamento
  verde, despesas warning e canceladas vermelhas; grade, laterais e filtros preservados.
  Referências continuam Em revisão. Nenhum baseline foi atualizado.
- Backup privado oficial etiquetas-dashboard-frete-20261017-0032 preservado na VPS:
  121.783.623 bytes, íntegro por leitura completa com pg_restore, sem restauração.

A publicação ainda depende do CI, merge e conferência do rollout desta revisão.

### Publicação inicial e ajuste dos rótulos

PR 29 integrada em d8c6ea3fd76f22fd0dc0fc10e117a055cab7b9a7 após os dois jobs
aprovados no CI 38999402686. Rollout ok6ho7avz8oc149n895lby7mq, contêiner
3b3c7384984e desde 17/10/2026 03:50:14 UTC, sem reinícios. As 136 migrations
aparecem aplicadas; a configuração fiscal foi preservada. Nenhuma migration nova.

A conferência autenticada confirmou a consistência dos indicadores comerciais. Os valores e a coorte reais permanecem no registro privado.
Abertura até os indicadores visíveis: 3.587 ms, incluindo automação/navegador.
O teste real encontrou rótulos brutos IFOOD, SITE e GIULIANA FLORES no cadastro.
A consulta carregava todos os IDs corretos, mas a apresentação faltava abreviar GF.

A correção final extrai a regra exata já usada em TagCanalVenda para
canais-apresentacao.ts. O selo conserva seus nomes, aliases e cores. O BI aplica
a mesma apresentação às opções. Não altera nem une IDs, pedidos ou cadastros;
nomes desconhecidos permanecem como informados. O teste de consulta passa a usar
os nomes brutos reais, e o contrato visual confere seleção GF, URL e exportação.

A conferência real da primeira publicação aprovou os detalhes de NF-e completa,
resumo sem XML e NFS-e, sem executar ações fiscais. Os dois CSVs oficiais, a série temporal e a soma dos pedidos exportados reconciliaram os mesmos totais, em centavos exatos. A conferência numérica original permanece privada. Arquivos reais permanecem privados.
A revisão final também troca os rótulos Produtos/em produtos do painel de pedidos
por Faturamento/inclui frete e o cabeçalho textual do gráfico por Faturamento.

### Validação final dos rótulos e integração

A main avançou para 48bff635 com fotos da prévia de Etiquetas. Merge sem conflitos
em 995f8d4e preservou essa entrega. Não houve alteração de schema ou permissões.
Sobre a revisão integrada passaram 135 testes do BI/consumidores (nove opt-ins não
ativados), 58 testes do Gestor e os testes visuais focados do canal, gráfico e pedidos.
A rodada de desenvolvimento passou 61 testes, incluindo os nomes brutos do cadastro.
Build integrado aprovado: compilação 61 s, TypeScript 95 s, 105 páginas geradas.
Lint focado e contratos da Central aprovados, sem novos desvios. Os rótulos não
alteram identidades nem valores. Backup privado etiquetas-dashboard-rotulos-20261017-0101
verificado por leitura completa, sem restauração.

### Correção da prévia isolada após integração

O CI 39001295413 falhou no head 09bc75d7: 19 contratos aguardaram a inicialização
por 30 s, 233 não rodaram e a página registrou process is not defined. A reprodução
local do primeiro caso confirmou a falha. A demonstração de Validades passou a
importar FotoProduto/Next Image na main 48bff635; o Vite da Central não tinha o
adaptador de imagem já usado nas prévias de Pedidos. Não era falha de métrica do BI.

As configurações qualidade.vite.config.mts e vite.config.mts agora reutilizam
imagem-simulada.tsx somente nessa fronteira. Os 21 contratos do projeto 320 claro
passaram em 31,3 s após a correção. Nenhuma asserção, timeout, captura aprovada,
baseline ou código de produção foi alterado. O build de produção anterior continua
correspondendo exatamente às fontes do aplicativo; esta correção afeta só a prévia.
A matriz completa e as referências serão novamente exigidas no CI.

### Integração com a main de Clientes

A main avançou para 648dba4a durante a revisão. Merge em e136df49 preservou o
contrato de cobrança independente. O único conflito era documental em Vendas;
ambos os textos foram mantidos. A descrição dos canais foi colocada junto ao mapa
de Vendas & CRM para evitar colisões de anexos no fim do documento.

A combinação passou novo build webpack, com compilação em 39,3 s e tipos completos,
e 439 testes de BI, canais, Gestor, cobrança e permissões; nove opt-ins não ativados.
Os 21 contratos da Central em 320 claro passaram novamente, agora nessa combinação,
em 44,4 s. Sem migration ou alteração adicional de fonte/cálculo do Dashboard.
O cache existente foi reutilizado; espaço medido após o build: 10,85 GB.
