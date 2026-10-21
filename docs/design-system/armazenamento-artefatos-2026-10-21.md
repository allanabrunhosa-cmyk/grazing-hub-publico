# Armazenamento do GitHub Actions — 21/10/2026

A cota de artefatos impediu o envio após as verificações de qualidade.
A manutenção anterior da [PR #35](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/35)
já removeu **73 artefatos, 3.580.703.351 bytes**. Esta retomada não repete a limpeza.
Ela isola a correção do Actions a partir da main `ff433a50`, sem as mudanças
funcionais reunidas naquela PR. A PR anterior permanece preservada.

## Inventário e preservação

A consulta completa de 21/10/2026 retornou três artefatos em uma página de 100,
com **159.022.467 bytes**. O nome, o prefixo e a origem de cada conjunto foram
conferidos: workflow **Qualidade visual**, `.github/workflows/qualidade-visual.yml`.
As PRs abertas eram #15 e #35. Nenhuma tinha artefato disponível em seu ramo.
Não há candidato adicional seguro à exclusão.

| ID preservado | Execução | Motivo |
| --- | --- | --- |
| 12218765162 | 39314731178 | Último conjunto válido disponível da main |
| 11787576916 | 38342215955 | Origem documental da galeria Em revisão; estados completos ainda necessários |
| 11841174918 | 38454163976 | Incorporação ao conjunto válido da main não comprovada |

O [inventário consolidado](artefatos-limpeza-20261021.json) registra os 73 IDs
excluídos anteriormente e os três preservados, com nomes, datas, tamanhos,
execuções, ramos, commits e critérios. Os logs anteriores e as listagens posteriores
foram reconciliados. Os 76 ZIPs originais e seus hashes continuam em backup privado.
Nenhuma execução, log, release, referência aprovada ou backup foi excluído nesta retomada.

Os 3,58 GB removidos são volume da lista de artefatos. **Não comprovam a cota já
reconhecida pelo GitHub.** Não foi comprovado consumo compartilhado fora deste
repositório. Não houve exclusão em outro workflow ou repositório.

## Conteúdo e retenção

O ZIP preservado da main tem 1.561 arquivos e 63.123.626 bytes descompactados.
Ele contém 870 cópias repetidas de PNGs e 8.759.407 bytes de cache Vite. Há
relatórios HTML/JSON, candidatas canônicas, cópias dos anexos e imagens sintéticas
do comparador. Essa amostra não contém trace nem vídeo. O runner já conserva
traces somente em falhas e screenshots de falhas; não foi alterado.

- **Três dias:** relatórios JSON compactos, com resultado por teste, medições e
  anexos inline. Não carregar o HTML que duplica os anexos.
- **Sete dias:** JSON completo e diagnósticos das suítes com falha, incluindo
  screenshots, contexto e traces disponíveis.
- **14 dias:** candidatas para revisão humana, origem/hash, galeria e diferenças
  consultivas. Esse prazo mantém o processo existente. Evidências selecionadas
  devem ser preservadas em PR/documentação antes da expiração.

Imagens iguais das candidatas compartilham um PNG por SHA-256. Os metadados
mantêm a associação por caso. Diagnósticos não repetem esses PNGs. O upload usa
somente três diretórios explícitos em `pacotes/`; exclui cache Vite, relatórios
HTML repetidos e saídas sintéticas de comparador aprovado. Diferenças consultivas
ficam no pacote de revisão mesmo quando não falham o teste. O nome inclui run e
tentativa para preservar um envio anterior em uma eventual repetição do job.

O resumo do CI registra resultados de Design System e das verificações visuais,
tamanho antes da compressão, retenção e resultado/link de cada upload. Falha no
envio continua bloqueante. Não há promoção automática de referências, alteração
de testes funcionais, permissões ampliadas ou alteração de notificações.

## Validação e limite de integração

A validação usa testes do empacotador, Design System, lint, tipos, sintaxe Node,
parse do YAML e o workflow completo no novo commit. Não é necessário compilar a
aplicação para alterar apenas o armazenamento do CI; não há fonte de runtime,
schema ou dependência modificada. Resultados finais e links ficam na PR para não
criar commits apenas para repetir uma tentativa de upload.

O último envio anterior, no run
[39539316798](https://github.com/allanabrunhosa-cmyk/grazing-hub/actions/runs/39539316798),
falhou por cota às 03:42 UTC de 21/10/2026. O provedor informa recálculo em seis
a 12 horas. Uma nova tentativa no commit desta correção verifica o estado atual;
se for recusada, não repetir em sequência. Somente upload concluído, acessível e
com conteúdo/retenção conferidos comprova a resolução.

Na manutenção inicial, o limite de escopo impediu a integração porque atualizar
main dispara webhook/build no Dokploy. Essa restrição foi substituída pela
autorização expressa da retomada abaixo.

### Retomada e autorização de publicação

O usuário autorizou atualizar e integrar somente a PR #38 e acompanhar o deploy
automático resultante. A autorização depende de testes aprovados, uploads
concluídos e artefatos acessíveis, com conteúdo e expiração conferidos. Seguir
[deploy](../contexto/deploy.md) e [versionamento](../contexto/versionamento.md).
Não integrar a PR #35 nem alterar funções, banco, backups ou limites financeiros.

A limpeza complementar terminou por volta de **02:55 UTC de 21/10/2026**, conforme
os horários dos logs/resultados locais preservados. O prazo de seis a 12 horas
conta da limpeza: aproximadamente **05h55 a 11h55 de 21/10, em Brasília**. Os
horários individuais das exclusões não foram registrados; essa referência é a
conclusão do registro local, não um horário preciso fornecido pela API. Não
reiniciar o prazo a cada tentativa de upload. Uma listagem menor não comprova
liberação da cota nem elimina o consumo já acumulado no ciclo de cobrança.

A base da PR foi conciliada com a main `b2212dee`, sem trazer funcionalidades da
PR #35. Os resultados desta combinação, a cota e a eventual publicação devem
ser registrados na PR, sem criar commits apenas para repetir o upload.

### Incorporação posterior pela PR #35

Após a integração da #38, atualizar a branch da #35 com a main. Resolver os
conflitos de CI preservando a implementação mais completa da #38 nestes arquivos:

- `.github/workflows/qualidade-visual.yml`: resumos, três caminhos, retenção e tentativa.
- `scripts/pacotes-evidencias-visuais.mjs`: JSON integral/minificado, diagnósticos,
  diferenças consultivas, origem e deduplicação.
- `testes/design-system/pacotes-evidencias.test.ts`: dez testes, inclusive CLI e anexos.
- `testes/visual/comparador.playwright.config.ts`: reporter JSON e bloqueios existentes.
- `docs/design-system/protecao-visual-automatizada.md`: política e aprovação humana.

Preservar o inventário consolidado de 21/10. Os registros de 20/10 da #35 ficam
como histórico. Não resolver todos os conflitos com uma preferência global por
branch. As mudanças funcionais da #35 permanecem exclusivas daquela entrega.
