# Reconciliação do versionamento — 02/10/2026

Registro de execução, sem autorização de publicação. A regra permanente está em
[Versionamento](../contexto/versionamento.md); o ritual operacional permanece em
[Deploy](../contexto/deploy.md).

## Estado e proteção

Checkout inicial: `codex/manifesto-nfs-publicacao`, HEAD `465b1cd492b2fc42da01eb96d6db846127ee78ab`,
cinco commits exclusivos, 63 arquivos rastreados modificados, além de fontes novas
e artefatos operacionais. Após fetch, estava 135 commits atrás de `c10a0a82`.
A main avançou durante a execução até `457c4d189ed9edc822934350cdfd94beafe47d06`;
esta foi a base inicial da reconciliação. Durante o primeiro envio, a main avançou
novamente até `cf42b8d8aba2e5fa873351dd898e152c3e00a6dc` com alterações dos seletores.
Esses commits foram incorporados por merge normal à branch de trabalho, sem
reescrever histórico. Alterações concorrentes já integradas não foram duplicadas.

Foram inventariadas 54 worktrees antes das worktrees próprias desta tarefa.
Backup privado de 1.248 arquivos (280.837.614 bytes), verificado por SHA-256,
e bundles Git verificados preservam as referências, arquivos e estados originais.
Capturas adicionais preservam o checkout no fechamento e documentos concorrentes.
Nenhuma branch antiga, arquivo original de backup ou worktree alheia foi apagado.

## Classificação e reconciliação

- Equivalentes: entrada avulsa, suas migrations, inventário/contagem, integrações
  de insumos, financeiro e vendas já incorporadas à main. Mantidas as versões atuais.
- Válidas ausentes: isolamento da rota do laboratório, seus testes de autorização,
  orientação de alinhamento de rótulos e evidência documental histórica da entrada avulsa.
- Incompletas, históricas ou divergentes: preservadas em branches próprias WIP,
  sem afirmar que estejam prontas para integração. Isso inclui estados de clientes,
  manifesto fiscal, layout e helpers operacionais que não foram executados com dados reais.
- Temporários/gerados: caches, logs, runtime, fotos e exportações de catálogo
  permanecem privados e ignorados. Captura operacional contendo dados reais não foi
  publicada; somente sua documentação foi preservada em branch reconstruída.
  Identificação nominal fixa em dois helpers foi substituída na cópia pública;
  os originais permanecem no backup privado.

Branches de preservação usam `codex/preservacao-20261002-*`: checkout inicial/atual,
validação do manifesto e layout, documentação de clientes/horários/entregas,
clientes concorrente, snapshot de insumos e stashes recuperados. Branches históricas
de etiquetas, cartões, conciliação, design e pedidos são preservadas também.
O antigo tip da main local fica sob nome de preservação; não substitui a main remota.
Branches antigas são candidatas a revisão futura, sem exclusão automática.

## Validação e limites

Ambiente isolado, Node 22, dependências instaladas pelo lockfile, PostgreSQL local
exclusivo e usuários sintéticos. Nenhuma migration ou teste operou dados de produção.

- Lint geral e `lint:design`: aprovados (8 bases e 299 consumidores).
- Prisma validate/generate, geração de tipos e TypeScript: aprovados.
- Todas as 85 migrations versionadas aplicadas a banco local novo: aprovadas.
  O status final confirmou banco atualizado. Uma pasta vazia não versionada,
  remanescente do checkout histórico, foi preservada no backup privado: não era
  uma migration ausente no GitHub. Nenhuma migration aplicada foi editada.
- Build de produção: aprovado; aviso existente de depreciação de middleware registrado.
- Testes focados do laboratório: 5 aprovados; fornecedores: 38; status de listas: 5.
- Smoke local de produção: 5 verificações aprovadas; imagens desktop/mobile inspecionadas.
- Bateria geral: 1.842 testes aprovados, 9 falhas e 302 ignorados; 221 arquivos
  aprovados, 4 com falhas e 20 ignorados. Não constitui validação geral aprovada.
- Reexecução somente dos quatro arquivos com falhas: 58 aprovados e 3 falhas,
  restritas a `testes/inventario/perdas-interface.test.tsx`. Os quatro arquivos e
  suas áreas não foram alterados nesta reconciliação. A reexecução não apaga o
  resultado da bateria geral nem autoriza integração.
- Após incorporar `cf42b8d8`, lint geral, design, tipos, build e smoke (5 verificações)
  passaram novamente. Testes dos seletores/consumidores, laboratório, arquivos com
  falhas anteriores e quatro integrações opt-in locais: 184 aprovados, 3 falhas,
  em 20 arquivos (19 aprovados). Permanecem as mesmas três falhas de perdas;
  não se declara a bateria geral aprovada.

## Sincronização e estado final

O primeiro envio publicou atomicamente 22 branches, com 34 commits que não tinham
referência remota no inventário anterior ao envio. Todas as pontas foram conferidas
diretamente por `ls-remote`, seguidas de fetch e confirmação de ausência de commits
dessas branches exclusivamente locais. O fechamento acrescenta o merge da main
concorrente e este registro documental, ambos enviados sem force push.

A pasta principal usa `codex/reconciliacao-github-20261002-final`, com código limpo
e sem arquivos relevantes não rastreados. A cópia anterior está na branch WIP
`codex/preservacao-20261002-checkout-atual`. Duas imagens geradas de seletores foram
copiadas e verificadas no backup privado, com exclusão local do Git. As worktrees
históricas alheias continuam disponíveis; seus estados relevantes possuem cópias
recuperáveis publicadas. Nenhuma branch antiga foi apagada.

A instalação de dependências na raiz encontrou um binário bloqueado pelo Windows.
A pasta foi preservada, sem encerrar processos alheios; a raiz usa uma junction para
as dependências instaladas pelo lockfile na worktree isolada desta tarefa.
Prisma foi gerado também na raiz. Essas dependências e todos os backups são locais
e ignorados; preservar a worktree isolada enquanto a junction estiver em uso.

Ao encerrar a execução inicial, a branch final permaneceu fora da main: havia falhas gerais a resolver/verificar e
atualizar a main dispara publicação automática no Dokploy, sem autorização
permanente de deploy para aquela tarefa. Nenhum deploy foi realizado naquela execução.
Publicação das branches serve à recuperação do código, sem homologação de produção.

## Retomada autorizada — correção das três falhas

O usuário autorizou exclusivamente nesta retomada a integração e o deploy, desde
que todas as validações e pré-condições passassem. Isso não altera a política
permanente de autorização de produção.

Reprodução sem alterações: 11 aprovados e exatamente as três falhas persistentes.
Todas eram testes desatualizados/não determinísticos, anteriores à reconciliação:
as fixtures estavam em 11/09/2026, mas a tela inicia no mês atual até hoje desde
`46f34d90`. Em outubro, o filtro excluía tanto as perdas quanto suas exclusões.

| Falha | Causa confirmada | Correção |
| --- | --- | --- |
| Quantidade fracionada ausente | Registro fora do período, não arredondamento | Relógio explícito no cenário |
| Motivo e autoria ausentes | Registro fora do período, não perda de informação | Mesmo ajuste de relógio |
| Exclusões (1) não encontrado | Data da exclusão fora do período; contador correto em zero | Mesmo ajuste de relógio |

`perdas-interface.test.tsx` simula somente `Date` em 18/09/2026 e restaura o relógio
após cada teste, seguindo o padrão de `painel-perdas.test.tsx`. Todas as asserções
de precisão, autoria, autorização, exclusão e estorno foram mantidas. Nenhum código
de produção, regra de perdas, saldo, consumo, retorno ou transação foi alterado
para corrigir essas falhas. O comportamento já existente foi documentado no guia de estoque.

Durante a validação, a main avançou até `9cc6550f` com mudanças de insumos. A bateria
anterior foi interrompida, sem declarar aprovação; houve merge normal e nova bateria
completa. A revisão de código validada é `bdecddb4021eaaf47bb81110007f793e91997942`.

- Focados de perdas/filtros/resumo: 20 aprovados.
- Inventário, incluindo perdas e estornos no PostgreSQL local: 114 aprovados,
  18 ignorados nessa execução focada.
- Bateria geral final: **1.912 aprovados, zero falhas, 266 ignorados**; 229 arquivos
  aprovados e 19 ignorados. Ignorados não são considerados aprovados.
- Opt-ins locais executados na bateria: `PERDAS_BANCO_TESTE`, `CONTAGEM_BANCO_TESTE`,
  `CONVERSOES_BANCO_TESTE`, `ESPECIFICACAO_BANCO_TESTE`, `MARCAS_BANCO_TESTE` e
  `FORNECEDOR_NOTA_BANCO_TESTE`. Schemas sintéticos isolados, sem operações reais.
- Lint geral, design (8 bases/299 consumidores), tipos, Prisma validate/generate,
  status das 85 migrations locais e build Node 22: aprovados.
- Smoke do build local: 6 verificações aprovadas, incluindo acesso, laboratório
  sem moldura operacional e datas iniciais de perdas; imagens desktop/mobile verificadas.

O procedimento de deploy foi conferido, sem diferença de schema/migrations em
relação à main. Pré-flight confirmou serviços disponíveis e certificado único no
banco, sem fallback fiscal de ambiente/mount. O backup verificável, a integração e
os resultados efetivos de produção serão registrados após sua execução; este
registro prévio de validação não declara publicação realizada.
