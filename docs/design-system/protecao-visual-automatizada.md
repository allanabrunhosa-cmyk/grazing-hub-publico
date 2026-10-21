# Proteção visual automatizada

## Alcance e referência

O padrão continua sendo a implementação existente do HUB. `testes/visual/qualidade.tsx`
importa componentes reais, CSS e tokens vigentes, a demonstração de filtros da Central,
a lateral e o cabeçalho reais. Não é tela de produto nem proposta de redesign.
Todos os dados, callbacks, navegação e ações de sessão são fictícios; não há banco,
Next em execução, credenciais ou operações financeiras/fiscais na suíte de navegador.

A fronteira Next/Image reutiliza `testes/visual/imagem-simulada.tsx` nas prévias
`qualidade.vite.config.mts` e `vite.config.mts`, como nos consumidores de Pedidos.
Isso permite importar a demonstração de fotos sem depender do runtime Next no Vite.
Os componentes, CSS, imagens locais e guardas de isolamento continuam reais.

A fixture cobre Button (incluindo link), Input, Select, Textarea, Table, Dialog,
GrupoAcoes, AcoesEdicao, EdicaoInline, BotaoRemoverItem e filtros contados.
Os testes fundamentais não substituem testes das telas consumidoras. Ao editar uma
tela, reutilize a prévia correspondente, acrescente seu cenário e registre o que foi
efetivamente inspecionado. Não declare cobertura de todas as telas por este laboratório.

## Execução

Node 22 e `@playwright/test` 1.64.0 fixado no lockfile. Instalação inicial do navegador:
`npx playwright install chromium`. No ambiente de CI ele já vem na imagem fixada.

- `npm run lint:design`: regras de reutilização, tokens e dívida estática.
- `npm run test:design`: testes do analisador, contratos e aprovação de referências.
- `npm run lint:visual:referencias`: integridade/origem/decisão humana das imagens.
- `npm run test:visual:contratos`: geometria, nomes, estados, teclado e isolamento.
- `npm run test:visual:referencias`: captura candidatas e compara imagens registradas.
- `npm run test:visual:comparador`: prova em arquivos temporários que uma regressão gera
  diff, imagem inválida falha e expectativa ausente não é criada automaticamente.

Para diagnóstico local focado, use por exemplo
`npm run test:visual:contratos -- --project=chromium-390-claro-toque`.
O servidor usa apenas `127.0.0.1:4238`, é iniciado/encerrado pela suíte e não reutiliza
servidor preexistente. As fontes são as do CSS atual; o escopo Tailwind restringe a
varredura aos componentes/fixture sem modificar o CSS de produção.

Matriz: 320, 390, 768 e 1440 CSS px × claro/escuro, mais 320 e 390 × claro/escuro
com contexto de toque. O teste confirma `(pointer: coarse)`, em vez de inferi-lo pela
largura. DPR 1, locale pt-BR, fuso America/Sao_Paulo, movimento reduzido, animações
desabilitadas na captura, valores constantes e prontidão de fontes/layout.
Estados: normal, texto longo, salvando/desabilitado, erro e vazio.

## Bloqueios e evidências

O workflow `qualidade-visual.yml` separa o lint/testes de Design System do job
`Contratos de interface e referências aprovadas`. Falha mecânica ou comparação de
referência aprovada falha o job; não existe `continue-on-error` para esses contratos.
Os relatórios registram as medições e os limites, sem alegar certificação de WCAG.

As verificações incluem overflow global e rolagem interna de tabela, alturas/eixos,
ações compactas e alvos de toque, variantes oficiais por tokens, nomes/rótulos,
controles cortados/encobertos e interseções no formulário, ações e diálogo,
foco/Tab/Enter/Escape do diálogo, retorno de foco, edição sem salvar no blur,
preservação do valor em erro, bloqueio de envio duplicado e ausência de consultas
externas/erros de página. A inspeção visual humana continua necessária para
legibilidade, hierarquia, contraste composto e sobreposições fora dos casos medidos.

Capturas são feitas por seção; o painel do diálogo é registrado aberto e a lateral
somente nos contextos em que o produto a mostra. Cada imagem tem hash e metadados de
commit, viewport, tema, ponteiro, fonte e navegador. Falhas retêm screenshot e trace.
Os relatórios ficam em `.tmp/qualidade-visual-automatizada/{contratos,referencias,comparador}`.
No CI, `scripts/pacotes-evidencias-visuais.mjs` prepara somente os caminhos explícitos
em `pacotes/`: relatórios JSON compactos por **três dias**, diagnósticos das suítes
com falha por **sete dias** e capturas para aprovação humana por **14 dias**.
Os JSONs preservam medições e anexos inline. Diagnósticos incluem resultados,
screenshots e traces úteis. A revisão inclui candidatas, origem/hash, galeria e
diferenças consultivas, mesmo quando o teste passa. PNGs idênticos das candidatas
compartilham um arquivo por hash. Cache Vite, HTMLs com anexos repetidos e traces
de testes aprovados ficam fora dos pacotes. Os bloqueios e as permissões continuam.
O resumo do CI distingue testes, empacotamento ausente e resultado do upload;
informa tamanho antes da compressão, retenção e links dos envios concluídos.
Preserve evidências selecionadas na PR/documentação antes de expirar, sem
informações reais de clientes ou contas. Uma revisão pendente não autoriza a
limpeza manual de sua única evidência disponível.

## Referências e aprovação humana

O registro `referencias-visuais.json` começa com **zero imagens aprovadas**.
As capturas históricas e os padrões da Central **Em revisão** não foram promovidos.
Nesta adoção, geometria/interação/reutilização são bloqueantes; comparações de pixels
aguardam aprovação. Não há promessa de identidade pixel a pixel sem esse baseline.

O ambiente visual oficial é Linux amd64 no container
`mcr.microsoft.com/playwright:v1.64.0-noble`, fixado por digest no workflow.
Uma captura Windows local é evidência de inspeção; não substitui uma referência Linux.
Use imagens produzidas no CI nesse ambiente para criar a proposta de referência.

1. Inspecione as capturas candidatas do commit e compare com o consumidor atual indicado
   pelo usuário, no mesmo estado/tema/largura. Escolha apenas os casos efetivamente aprovados.
2. Em PR específica ou atualização deliberada da PR, copie as imagens selecionadas para
   `docs/design-system/referencias-visuais/<projeto>/<caso>/<secao>.png` e registre origem,
   SHA-256, ambiente e estado **Em revisão**. Não recapture para disfarçar uma diferença.
3. O responsável decide a aprovação. Para promover, substituir ou retirar uma referência
   **Aprovada**, registre autor/data/link da decisão e, após revisar o head final da PR,
   o responsável humano publica nela: `APROVO REFERÊNCIAS VISUAIS <SHA completo do head>`.
   Reexecute o CI após a decisão. A consulta de aprovação é somente leitura; nenhum
   script ou agente publica esse comentário automaticamente. Novo commit invalida a decisão.
   No push para main o guard reconfirma a PR integrada e a decisão de seu head;
   promoção direta sem essa PR rastreável falha a validação.
4. O guard compara o registro com a base da PR, verifica imagem/hash/proveniência e exige
   o comentário do responsável para toda mudança de referências aprovadas, inclusive remoção.
   Candidatas continuam consultivas: suas diferenças são anotadas e anexadas; não bloqueiam
   por aparência. Integridade, isolamento e erros de execução continuam bloqueantes.

Playwright usa `updateSnapshots: none`; o runner/config recusam atualização automática.
O autoteste do comparador escreve expectativas somente em `.tmp`, a partir da fixture,
para provar falhas deliberadas; nunca escreve na pasta de referências oficiais.
Imagem aprovada ausente, seção aprovada que desaparece, ambiente incompatível no CI ou
diferença em referência aprovada falham. O comparador produz actual/expected/diff.
Não existe comando de regenerar/aprovar baseline para fazer a suíte passar.

Jobs que falham ficam vermelhos no CI. A `main` consultada durante a consolidação não
tinha proteção de branch; para tornar checks obrigatórios ao merge, o responsável precisa
ativar os nomes dos jobs nas regras do repositório após aceitar esta PR. Esta implementação
não contorna aprovações nem altera configurações do GitHub.

## Dívida histórica

A [triagem individual](triagem-desvios-2026-10-12.md) conserva os 98 IDs e o baseline.
Não confunda ocorrência AST com defeito visual comprovado. Corrija em lotes pequenos,
com testes do consumidor e evidência visual. Retire a entrada somente após a correção
validada ou ajuste testado do analisador; não conceda exceção de pasta inteira.
