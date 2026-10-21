# Atividades por usuário — medição PostgreSQL e reprodução

Medição real em **10/10/2026 às 19:14, America/Sao_Paulo**. Não representa produção
nem homologação externa. A carga usa exclusivamente dados sintéticos em PostgreSQL
local dedicado e não lê `.env` operacional. Não houve migration produtiva, expurgo,
ativação de integração nem operação real.

## Ambiente e método

- Windows x64, PostgreSQL **17.11**, Node **22.23.3**, 8 CPUs lógicas e 16,89 GB de RAM.
  A memória livre ao fim era 2,15 GB; outros processos da máquina podem influenciar os tempos.
- Cluster exclusivo: `127.0.0.1:55441/teste_atividades_usuarios`, usuário `atividades_teste`.
  Autenticação SCRAM, `shared_buffers=64MB`, `max_connections=30`, timezone UTC,
  `fsync=on` e `synchronous_commit=on`.
- Dois schemas aleatórios `teste_atividades_antes_*` e `teste_atividades_depois_*`, com
  todas as migrations manuais aplicadas. O controle conserva `HistoricoAcesso` e desativa
  somente seu trigger novo de projeção. Na variante depois, a mesma inserção aciona o
  trigger da migration `20261010090000_atividades_usuarios`.
- **100.000 registros idênticos por variante**: 100 autores sintéticos, 20.000 eventos
  para um autor, período de aproximadamente 347 dias, valores antes/depois limitados e
  origem homogênea API. Não são 100.000 usuários nem cópias de payloads reais.
- 20 aquecimentos e 200 amostras por variante, executadas em ordem alternada. As consultas
  retornam os mesmos 50 IDs da fonte; incluem período inicial de 30 dias, cursor profundo
  por data/id e filtros. Não há OFFSET nem contagem integral por abertura.
- A operação medida é `BEGIN`, alteração de um usuário sintético, auditoria original e
  `COMMIT`. Mede SQL e ida/volta ao PostgreSQL; não mede autenticação, validação completa,
  Server Action, HTTP, renderização ou serviço externo.
- A fonte original possui os índices atuais `HistoricoAcesso_pkey` e
  `HistoricoAcesso_entidade_entidadeId_createdAt_idx`, **sem índice autor/data**. A central
  possui seu índice autor/data/id. A comparação de consultas usa fontes/índices distintos;
  não isola o efeito de um único índice nem sustenta um percentual universal de melhoria.

## Armazenamento efetivo

As funções `pg_relation_size`, `pg_table_size`, `pg_indexes_size` e
`pg_total_relation_size` foram executadas antes das amostras de operações. O tamanho
inclui páginas alocadas e, em `pg_table_size`, TOAST e estruturas associadas.

| Relação / condição | Dados e TOAST (bytes) | Índices (bytes) | Total (bytes) |
| --- | ---: | ---: | ---: |
| Auditoria original, controle, 100.000 registros | 21.045.248 | 13.246.464 | 34.291.712 |
| Auditoria original, com projeção, mesmos 100.000 | 21.045.248 | 13.246.464 | 34.291.712 |
| Central vazia | 8.192 | 49.152 | 57.344 |
| Central, 100.000 referências | 34.177.024 | 43.089.920 | 77.266.944 |

Média incremental da central: **772,096 bytes/evento**, calculada como
`(77.266.944 - 57.344) / 100.000`. Média total alocada: 772,66944 bytes/evento.
A auditoria original continua existindo e não está incluída nessa média incremental.

| Índice central | Bytes |
| --- | ---: |
| Autor + data/hora + id | 15.114.240 |
| Usuário afetado + data/hora + id | 12.189.696 |
| Chave primária | 7.864.320 |
| Fonte + identificador | 4.997.120 |
| Sequência de snapshot | 2.260.992 |
| Deduplicação | 663.552 |

Projeção linear para 365 dias, usando a média incremental da central:

| Eventos por dia | Eventos em 365 dias | Central: dados + índices (bytes) | GB decimal |
| --- | ---: | ---: | ---: |
| 1.000 | 365.000 | 281.815.040 | 0,282 |
| 5.000 | 1.825.000 | 1.409.075.200 | 1,409 |
| 10.000 | 3.650.000 | 2.818.150.400 | 2,818 |

Essa projeção **exclui** o crescimento das auditorias de origem, WAL, réplicas e backups.
Outras distribuições, eventos nativos com diferenças, tamanhos de resumos, ocupação de
páginas e fragmentação podem mudar a média.

## WAL e carga

WAL foi medido por diferença de `pg_current_wal_insert_lsn()` usando `pg_wal_lsn_diff`,
durante cada carga; foi mantido separado dos tamanhos de relação. O cluster estava
dedicado ao benchmark, sem outras suítes de escrita concorrentes.

| Carga de 100.000 registros | Tempo (s) | WAL gerado (bytes) |
| --- | ---: | ---: |
| Somente auditoria original | 3,523 | 45.659.568 |
| Auditoria original + projeção central | 36,698 | 159.260.128 |

A carga em massa é mais cara com projeção síncrona. Uma eventual recuperação retroativa
deve ser administrativa, em lotes, com pausas e acompanhamento; não é executada pela
migration nem pela abertura da aba. Não foi medido tamanho de backup, compressão,
arquivamento de WAL ou replicação; não inferir esses custos apenas pelo tamanho da tabela.

## Latências absolutas

Milissegundos por amostra, com caches aquecidos. Os planos completos
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` foram preservados no relatório JSON sintético.

| Cenário | p50 antes | p95 antes | p50 depois | p95 depois |
| --- | ---: | ---: | ---: | ---: |
| Mudança + auditoria em transação | 0,877 | 1,310 | 1,256 | 1,917 |
| Consulta de 50 eventos, últimos 30 dias | 14,217 | 30,012 | 0,767 | 1,319 |
| Consulta por cursor profundo | 28,241 | 34,330 | 1,060 | 1,408 |
| Período + ação + resultado + origem | 18,379 | 21,386 | 1,109 | 1,594 |

Uma rodada local não demonstra latência fria, concorrência/hardware/rede de produção,
SLA nem percentuais gerais de impacto. O filtro por origem/resultado compara um dataset
homogêneo API/sucesso, pois a fonte original não possui esses campos. Os schemas de
controle e medição são removidos de forma restrita ao terminar a suíte; o cluster não
é excluído automaticamente.

## Reprodução segura

1. Conferir espaço livre conforme o contrato de armazenamento e selecionar Node 22.
2. Preparar **novo** cluster PostgreSQL sintético, bind `127.0.0.1`, porta 55441, banco
   `teste_atividades_usuarios`, usuário `atividades_teste`, SCRAM, configurações acima.
   Usar senha aleatória descartável e mantê-la somente em `.tmp` ignorado. Não reutilizar
   base existente nem copiar `.env` operacional. A suíte confirma host, porta, banco,
   usuário, protocolo e identidade real do servidor antes de criar qualquer schema.
3. Nesta execução, o inicializador local preservado é
   `.tmp/atividades-usuarios/ambiente.ps1`; o cluster final está em `pg-data-2` na mesma
   pasta. A primeira inicialização no sandbox foi interrompida após travar na sondagem
   de memória; seus arquivos incompletos `pg-data` foram preservados. O cluster final
   foi iniciado escondido, fora do sandbox, exclusivamente para esta tarefa.
4. `Start-Process -Wait` aguarda toda a árvore de processos no Windows. Para `pg_ctl start`,
   usar `-WindowStyle Hidden -PassThru` e `WaitForExit()` do processo direto para não
   aguardar o servidor PostgreSQL permanente. Não mudar serviços do Windows.
5. Executar na raiz do worktree, sem outros consumidores do cluster durante a medição:

```powershell
# Arquivo temporário desta execução; não imprimir seu conteúdo.
$credenciaisTeste = Get-Content .tmp/atividades-usuarios/credenciais.json -Raw | ConvertFrom-Json
$env:DATABASE_URL = $credenciaisTeste.DATABASE_URL
$env:ATIVIDADES_BANCO_TESTE = '1'
$env:TZ = 'UTC'
node node_modules/vitest/vitest.mjs run testes/atividades/integracao.test.ts --maxWorkers=1
node node_modules/vitest/vitest.mjs run testes/atividades/negocio-integracao.test.ts --maxWorkers=1
node node_modules/vitest/vitest.mjs run testes/atividades/desempenho.test.ts --maxWorkers=1
```

O Node selecionado deve reportar a versão compatível antes dos comandos. Em ambiente
que bloqueia o localhost ou os arquivos temporários do Vitest, a execução precisa de
acesso autorizado ao host; não apontar a suíte a outro banco para contornar a restrição.
Todas as migrations são SQL manuais/aditivas aplicadas no schema sintético, sem
`migrate dev`, `db push` ou alteração de migrations aplicadas.

O teste escreve `.tmp/atividades-usuarios/desempenho.json`, com números, ambiente,
limitações e planos. Os logs locais `desempenho.log` e `integracao-final.log` são ignorados.
O benchmark real inicial passou em **67,82 s**, 1/1 teste, sem skip.

Validação PostgreSQL desta implementação: **14/14** casos de integridade/consulta
(`integracao.test.ts`) e **7/7** casos de ações reais (`negocio-integracao.test.ts`),
sem skips na rodada final de cada arquivo. Inclui rollback, falha forçada do registro,
deduplicação concorrente, autor versus cadastro afetado, identidade histórica,
MCP/iFood, proteção UPDATE/DELETE/TRUNCATE, diagnóstico somente leitura, paginação
50/50/20 com empates e inserção/backfill concorrentes, filtros/cursor e proteção de
detalhes financeiros e recuperação por CLI com simulação, autorização e reprocessamento
idempotente sem exclusão. Os testes de negócio cobrem fornecedor/beneficiário, insumo,
pedido de compra e contagem com autor distinto do responsável.

A rodada final PostgreSQL passou em **6,11 s**, incluindo o diagnóstico de 16 fontes,
preservação dos volumes e estados pendentes/incertos,
recusa, falha e confirmação de iFood Merchant/reconciliação e origem `INTERFACE` para
a aprovação humana no HUB. A seleção de lançamento pelo link da atividade reutiliza
o detalhe de leitura de Movimentações; sua suíte de interface passou **16/16** casos,
incluindo seleção fora do período, ausência de mutações e entidade ausente/inaplicável.

## Smoke da versão compilada

Executado em **10/10/2026 às 22:58, America/Sao_Paulo** (**11/10 às 01:58 UTC**),
com Next **16.3.4** compilado em produção e Node **22.23.3**. Foram aprovados
**14 grupos de verificações HTTP reais**, com três usuários fictícios e fontes
sintéticas no banco exclusivo. O processo recebeu ambiente limpo, sem arquivos
`.env` operacionais ou credenciais de integrações externas.

- Sem sessão: middleware responde 307 para login; token sintético revogado recebe 401.
- Lista autorizada retorna 50 eventos, cursor fornece mais 50 sem repetição e cache
  é `private, no-store`. Calendário inválido, cursor adulterado ou filtros trocados
  recebem 400 no servidor.
- Perfil sem atividades recebe 403. Leitor sem Financeiro recebe lista financeira
  vazia e 404 no detalhe; administrador recebe apenas diferenças permitidas e
  entidade inexistente conserva `link=null`. Segredos sintéticos não aparecem.
- POST, PATCH e DELETE recebem 405: a API permanece somente leitura.
- Login recusado real registra `SISTEMA`/`FALHA`, sem autor comprovado. Login válido
  retorna 303, cookie `Secure`/`HttpOnly` e evento atribuído à identidade validada.
- Logout explícito real retorna 200 no protocolo de Server Action, com
  `x-action-redirect=/login;push`, remoção do cookie e **um evento novo comprovado**
  por comparação antes/depois. Não representa fechamento do navegador.

A conexão HTTP nativa permaneceu em `127.0.0.1:4301`, com `Host` e
`X-Forwarded-Host` iguais ao host permitido e `Origin` contratual nas ações.
Nenhum redirecionamento para domínio público foi seguido e as proteções não foram
relaxadas. O relatório ignorado `.tmp/atividades-usuarios/smoke-http.json` registra
somente resultados e metadados seguros, incluindo o hash da migration SQL final.
O stderr do servidor sintético permaneceu vazio. Somente esse servidor foi encerrado
após verificar PID, binário e argumentos.

Este smoke verifica comportamento HTTP/servidor; não mede SLA, carga concorrente,
integrações externas ou apresentação visual em um navegador. O artefato `.next`
local é exclusivamente sintético e não deve ser reutilizado em produção: a publicação
autorizada deverá compilar novamente as fontes pelo fluxo de deploy do projeto.

## Diagnóstico administrativo e retenção

`scripts/atividades-diagnostico.mjs` não carrega `.env`, inicia transação `READ ONLY`,
usa limite de 30 segundos e não devolve nomes, payloads, credenciais ou identificadores
de pessoas. Exige uma conexão administrativa de leitura explicitamente configurada.

```powershell
node scripts/atividades-diagnostico.mjs --schema public
# Contagem exata e agrupamento por categoria, somente quando necessário:
node scripts/atividades-diagnostico.mjs --schema public --contar
```

Sem `--contar`, usa estimativa `pg_class.reltuples`, dependente de estatísticas atualizadas.
Com `--contar`, informa volume exato, categorias e intervalo histórico. Ambos medem
tabela/TOAST/índices e projetam 1.000/5.000/10.000 eventos diários separadamente de WAL/backups.

O bloco `fontes` mede separadamente as **16 relações de origem**: as 14 auditadas por
trigger, `MovimentacaoEstoque` e `Insumo`. Uma única consulta aos catálogos informa
dados/TOAST, índices e `pg_total_relation_size` por relação, com totais separados da
central. O volume de cada fonte é sempre aproximado por `pg_class.reltuples`, inclusive
com `--contar`; estatísticas inexistentes ou relação ausente aparecem como `null`.
Não há leitura de payloads nem 16 consultas individuais. As projeções por evento
continuam representando somente a tabela central.

A limpeza MCP conserva `McpEvento` referenciado pelas atividades, preservando a
evidência de origem. Isso pode ampliar a retenção dessa fonte em relação à limpeza
anterior; seu tamanho/volume permanece observável no diagnóstico e deve entrar no
dimensionamento das fontes, separado da central e de WAL/backups. Esta entrega não
descarta esses registros nem autoriza expurgo.

As variáveis `ATIVIDADES_RETENCAO_MESES_OPERACIONAL`, `ATIVIDADES_RETENCAO_MESES_ACESSO` e
`ATIVIDADES_RETENCAO_MESES_CRITICA` aceitam inteiros de 1 a 120, padrão 12. São uma proposta
de consulta operacional por categoria, **não um prazo legal ou autorização de descarte**.
`expurgoAtivo=false` e `descarteAutorizado=false`: não existe rotina de expurgo habilitada,
e históricos anteriores permanecem preservados.
