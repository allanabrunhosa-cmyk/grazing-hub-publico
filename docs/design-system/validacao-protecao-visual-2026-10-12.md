# Entrega da proteção visual — 12/10/2026

## PR #9 e publicação

[PR #9](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/9) revisada e integrada
pelo endpoint normal, com head esperado `f29a07fe`, após incorporar `main` `bcf62152`
sem conflitos. Nenhuma alteração alheia da pasta principal foi incorporada.
Merge funcional: [`a0281b31`](https://github.com/allanabrunhosa-cmyk/grazing-hub/commit/a0281b310dfbe22438e1ad15686c7fcedd1d23db).
[CI da PR](https://github.com/allanabrunhosa-cmyk/grazing-hub/actions/runs/38197027213)
e [CI da main](https://github.com/allanabrunhosa-cmyk/grazing-hub/actions/runs/38197912579)
aprovados. Lint completo/design, typecheck, build webpack e smoke local aprovados;
497 testes pertinentes passaram e 26 integrações sem opt-in foram ignoradas.

O webhook publicou essa revisão. Tarefa `xmnkepr8zgizmgm2xtn4fuhkc`, contêiner
`923ce8a51e3e`, iniciou às 03:05:06 UTC (00:05:06 de Brasília) e ficou Running
por mais de dois minutos, sem reinícios. Imagem imutável:
`sha256:dabf44636b4a9b20bb69d5749ab4d731d510aba54c1ad93c8b314b95b2c47ae8`.
Imagem/configuração anterior preservadas em snapshot privado no servidor.
Sem diff de schema/migrations e sem operações em dados de negócio.

No contêiner publicado, `prisma migrate status` retornou schema atualizado e nenhuma
migration pendente. A configuração fiscal capturada permaneceu igual. HTTPS: login
200 e Central sem sessão 307 para login. Central autenticada inspecionada antes/depois:
versão 1, sem ajustes pendentes, iframe sintético e controles de publicação intactos.
As imagens de produção permaneceram privadas; não foram usadas como baseline.
Não houve homologação de operações fiscais/financeiras reais.

A leitura de trechos de logs de produção foi rejeitada pela revisão automática de
aprovação por risco de conteúdo sensível. A publicação foi acompanhada por indicadores
booleanos, metadados, identificação/estabilidade da tarefa, migrations, HTTPS e UI.

## PR própria de testes

[PR #10](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/10), branch
`codex/protecao-visual-automatizada-20261012`, baseada na main publicada.
**Sem autorização de merge/deploy desta segunda etapa.**

- Fixture Vite com componentes/CSS/tokens reais, dados constantes e ações fictícias.
- 12 projetos: 320/390/768/1440 × claro/escuro e 320/390 × claro/escuro com contexto
  de toque emulado (`pointer:coarse` confirmado), DPR 1, locale/fuso fixados e fontes prontas.
- Contratos de altura/eixo, alvos de toque, nomes, variantes/tokens, overflow global,
  tabela rolável, cortes/encobrimento/interseções em controles/formulário/modal,
  teclado/foco, envio único, erro preservado e edição sem salvar no blur.
- Capturas por seção com SHA-256, revisão, ambiente e estados normal/longo/salvando/
  erro/vazio. Artefatos guardam screenshot/diagnóstico/trace, inclusive em falha.
- Guard de integridade/proveniência e decisão humana para adicionar/substituir/remover
  referências aprovadas. Comparações Em revisão são consultivas; erros operacionais
  continuam bloqueantes. Nenhum teste atualiza ou aprova referências automaticamente.
- Autoteste prova diff real, expectativa temporária preservada, PNG inválido e ausência
  de referência sem criação automática. Arquivos deliberados ficam somente em `.tmp`.
- Skill, AGENTS, índice, testes e execução da Central integrados ao fluxo.

O [contrato operacional](protecao-visual-automatizada.md) descreve comandos, alcance,
aprovação e CI. O status final de cada revisão e seus artefatos estão nos checks da PR.
O job Linux usa imagem/digest fixados e pacote Playwright 1.64.0 no lockfile.

## Validação e diagnóstico

Na consolidação local, 252 contratos de navegador e 60 casos de captura passaram;
207 testes de Design System/layout passaram, com 7 casos de banco sem opt-in ignorados.
Lint global/design, typecheck, build webpack e smoke passaram. O guard final passou
em seus 7 testes focados; o comparador passou em 6 casos de prova em dois contextos.
Os 252 contratos também passaram na primeira execução Linux da PR.
Após ocultar somente a instrumentação do contador da fixture, 14 checks focados e
12 capturas normais passaram; não houve mudança em produto.

Falhas iniciais foram corrigidas com evidência, sem relaxar contratos:

- Cinco leituras imediatas de foco pegavam o guard antes do rAF do Base UI. O teste agora
  aceita apenas esse guard oficial como transitório, exige foco final no conteúdo e
  mantém falha persistente se observar controle externo. 96 Tabs nos 12 contextos,
  nove guards transitórios, zero escapes reais na verificação focada.
- A prova de comparação detectou o template sem `{ext}`. O caminho e o tipo de snapshot
  foram corrigidos conforme a API instalada, preservando `updateSnapshots: none`.
- O primeiro CI recusou `git rev-parse` por ownership no contêiner. As capturas CI usam
  a revisão imutável informada pelo checkout do Actions; não alteram a proteção do Git.
- Revisão independente ajustou aprovação também no push main, distinção entre erro
  operacional/diff consultivo e separação entre estado da candidata e da referência.
- A inspeção da fixture em 768 px identificou um botão além da coluna reservada. Só o
  laboratório passou a usar duas colunas em md e três em xl, sequência já presente no
  repositório. O detector agora acusa controle fora da grade mesmo sem overflow oculto;
  alinhamento usa a linha real da grade, sem deduzir alinhamento a partir do próprio Y.
  Os 96 checks pertinentes passaram nos 12 contextos após esse reforço.

Avisos preexistentes de Next/middleware e jose/Edge apareceram no build. Não são falhas
ignoradas. Esta tarefa não alterou essas bibliotecas, migrations ou regras de negócio.

## O que foi efetivamente inspecionado

UI autenticada de produção: Central de Design, lateral/cabeçalho, seleção de padrões,
cenário normal de status no iframe e estado de publicação, sem gravação.
Na fixture: Button/Link, Input, Select, Textarea, Table, Dialog, GrupoAcoes, BarraAcoes,
AcoesEdicao, EdicaoInline, BotaoRemoverItem, filtros contados da Central e moldura real.
Há captura de modal aberto, lateral no desktop e controles nos quatro tamanhos.

[Galeria local Em revisão](evidencias/2026-10-12-protecao-visual/README.md): 11 imagens
selecionadas, com origem/hashes. É evidência Windows de uma árvore com alterações ainda
pendentes na captura; não representa baseline Linux nem aprovação de telas. A proposta
de referência para CI deve ser selecionada dos artefatos Linux da revisão aprovada.

Não foram inspecionadas visualmente 98 telas. A [triagem](triagem-desvios-2026-10-12.md)
analisou fontes: 44 candidatos de contrato (14 P1/30 P2), 3 falsos positivos por wrapper
e 51 exceções candidatas, com 98 chaves, 56 arquivos e oito lotes. Baseline idêntico;
nenhuma correção histórica, nova exceção aprovada ou descarte automático foi aplicado.

## Pendências deliberadas

Zero referências visuais humanas aprovadas no registro. Geometria/interação/reutilização
são bloqueantes no job; comparação de pixels só bloqueia após aprovação no ambiente
correspondente. Catálogo e imagens históricas Em revisão não foram promovidos.
Ativar required checks nas regras de main após aceitar a PR #10: a consulta atual
informa `protected: false`. CI vermelho sozinho não impede merge sem essa regra.

A fixture protege componentes fundamentais; telas consumidoras precisam de cenários
próprios quando forem alteradas. Cortes intencionais de tabela e casos fora do escopo
da medição exigem inspeção visual. Contraste composto, leitor de tela e acessibilidade
integral não foram certificados. Testes de banco/hardware/serviços externos permanecem
fora do ambiente fictício. Aprovar referências e executar os oito lotes são próximos
passos de revisão, sem merge/deploy automático da segunda PR.
