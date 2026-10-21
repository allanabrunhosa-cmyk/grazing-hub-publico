# Execução

Base: `b9d2f0fe`, branch `codex/responsividade-global-20261009`.
Cópia limpa anterior reutilizada; alterações do checkout principal preservadas.
C: tinha 43,86 GB livres no diagnóstico e 42,08 GB antes do build. Dependências
da cópia reutilizada restauradas com npm ci conforme o lockfile, sem atualização
de pacotes. Prisma generate local utilizou URL fictícia, sem banco conectado.

- [x] Diagnóstico: AGENTS, armazenamento, versão Next instalada e Central de Design.
- [x] Mapear componentes e tabelas; navegação e Table compartilhadas, exceções HTML.
- [x] Implementar e regredir navegação recolhida, preferências, foco e submenus.
- [x] Implementar e regredir identificação e scrollport com seleção/linhas expandidas.
- [x] Reconciliar mínimos locais e cabeçalhos/filtros/formulários representativos.
- [x] QA isolado nas seis larguras, teclado e estados de interação disponíveis.
- [x] Lint global/design, tipos, regressão global e build da revisão final.
- [x] Documentar variantes e evidências para integração e publicação autorizadas.

Banco/backend/integrações: não aplicável, sem mudanças de regras ou autorização.
Deploy: autorizado pelo usuário em 09/10/2026 após a implementação. Revisão
validada para integração na main. Estado do runtime, tarefa/contêiner e smoke
pós-deploy serão registrados no fechamento da tarefa, sem um segundo deploy
apenas para publicar evidências.

Validação inicial: navegação + Central, 21 arquivos/110 testes aprovados;
1 arquivo/7 integrações opt-in ignoradas (banco não modificado).

## Evidências da revisão

- Novos contratos: 2 arquivos / 11 testes aprovados (navegação e tabela).
- Lint de todo o código: `npm run lint -- src scripts testes *.ts *.mts *.mjs`,
  aprovado. A execução sem caminhos também leu `.tmp-vite-exclusao/deps`, cache
  antigo ignorado pelo Git, produzindo erros em dependências geradas. Nenhum
  arquivo de código do projeto apresentou erro; o cache não foi removido.
- `npm run lint:design`: aprovado, 8 bases / 348 consumidores TSX.
- `tsc --noEmit`: aprovado. Build oficial webpack: aprovado, 86 páginas geradas.
  Avisos existentes de middleware/proxy e APIs de compressão do jose no Edge.
- Regressão global: 284 arquivos aprovados / 33 ignorados; 2.634 testes aprovados,
  538 ignorados pelas condições dos próprios testes, sem falhas. Opt-ins não
  executados não constituem aprovação de integração externa/banco. Execução
  final direta pelo Vitest com `--maxWorkers=1`, equivalente ao script npm test,
  duração 933,24s. A primeira execução foi interrompida após a falha de seletor,
  reproduzida isoladamente; a bateria final abrange a correção. O teste de
  Clientes foi adaptado para buscar a
  região de detalhes pelo nome; a nova região acessível da tabela não significa
  que os detalhes continuaram abertos. A asserção de fechamento foi preservada.

## QA visual e funcional

Fixtures com dados fictícios, sem banco nem operações reais. Matriz em 360, 390,
768, 1024, 1366 e 1920px; expandido/recolhido a partir de 768px, navegação móvel
sobreposta abaixo desse limite.

| Tela/cenário | Evidência |
| --- | --- |
| Insumos e Fornecedores | Listas longas, textos extensos, todos os campos/ações; formulários nas seis larguras |
| Contagem de estoque | 75 registros, fornecedores e quantidades, alinhamento e rolagem própria |
| Financeiro/DRE | Filtros e menu de exportação abertos no celular, relatório com dados simulados |
| Produtos | Componente real, mantendo a reorganização móvel já existente |
| Validades | Menu dedicado, configurações e 35 registros em Prazos dos produtos |
| Contratos de Table | Duas tabelas com seleção/identificação, 55 linhas cada; editor com colgroup legado |

Sem overflow horizontal da página nas medições da matriz. Seleção/nome fixos
mantiveram offset de 44px; a identificação em 390px ocupou cerca de 148px. Nome
com truncate/nowrap legado teve quebra real de linha, sem esconder o texto.
Rolagem intermediária: 460,8px horizontal / 604,8px vertical; barra da própria
tabela permaneceu na área visível e a segunda tabela conservou posição independente.
Resize, recolhimento e atualização dos dados recalcularam a geometria. A rolagem
da página não aumenta tabelas anteriores nem empurra o foco para fora da tela.

Teclado: toggle, tooltip de foco, submenus Estoque/Bancos, Escape com retorno ao
gatilho e rolagem por setas/PageDown. Hover do tooltip tem teste automatizado.
Recarregar preservou a preferência recolhida. Formulários e filtros foram abertos,
sem salvar/excluir dados. Capturas locais em `responsividade-global/` na pasta
privada de visualizações desta tarefa; instruções reproduzíveis em
[QA](../../../testes/visual/responsividade-QA.md).

Limite: as ferramentas disponíveis controlam largura/altura, sem emulação de
toque; não houve teste em aparelho físico. Gestos nativos são preservados pelo
scrollport, mas a interação física por toque permanece pendente. Referências
novas na Central continuam Em revisão até aprovação humana.

## Preparação da publicação

Backup privado `etiquetas-responsividade-20261009-1510`, 60.018.245 bytes,
945 objetos conferidos com pg_restore --list; configuração fiscal preservada,
certificado no banco. Imagem anterior preservada pela tag
`grazinghub-responsividade-anterior:20261009-1510`. Nenhuma restauração de banco,
consulta fiscal ou mudança de configuração operacional.

## Ajuste do controle da lateral — 09/10/2026

Base atualizada: `71a0c3cd`, branch `codex/menu-recolher-vidro-20261009`.
O estado `aria-expanded` do Button ghost mantinha o fundo claro mesmo sem
interação. O controle da lateral agora tem fundo transparente em repouso e
reutiliza `sidebar-accent`/`sidebar-accent-foreground` no hover e foco visível,
como as seções da navegação. Escopo restrito a `.menu-lateral-controle`, sem
alterar as demais ações ghost ou o contrato de expansão/preferência.

Regressão visual isolada: antes, `rgb(244, 246, 248)` com hover/foco falsos;
depois, transparente tanto expandido quanto recolhido. Hover real nos dois
estados e foco pelo teclado: `rgba(255, 255, 255, 0.1)`, ícone branco e anel
de foco oficial preservado. Conferidos HUB/Validades, claro/escuro, 768/1366px;
em 390px a lateral permanece oculta. Capturas privadas em `menu-recolher-vidro/`.

Navegação + Central: 23 arquivos / 121 testes aprovados; 1 arquivo / 7 testes
opt-in ignorados. `lint:design`: 8 bases / 349 consumidores. Lint global do
código aprovado. Os tipos locais do Prisma foram regenerados com URL fictícia
para o schema já integrado na base atual, sem conexão ou alteração de banco.
`tsc --noEmit` e build oficial webpack aprovados, 86 páginas geradas. O primeiro
typecheck detectou o cliente gerado da base anterior; a regeneração local
resolveu as incompatibilidades e a verificação final passou. A regressão deste
ajuste visual ficou restrita aos consumidores de navegação/Central, pois não
houve alteração de geometria, estado, regras ou componentes-base.

Publicação deste ajuste autorizada explicitamente pelo usuário. Imagem anterior
preservada por `grazinghub-menu-vidro-anterior:20261009`; configuração fiscal
capturada privadamente na VPS em `etiquetas-menu-vidro-20261009`, sem alteração
operacional ou restauração de dados.

## Cabeçalho alinhado da lateral — 09/10/2026

Base `c7dced62`, branch `codex/cabecalho-menu-unificado-20261009`. O componente
compartilhado `CabecalhoMenuLateral` reúne marca, nome e controle de recolhimento
na mesma linha do HUB e de Validades. O controle conserva o Button ghost, tooltip,
foco, efeito de vidro e preferência por usuário. O menu móvel mantém a marca e
seu fechamento próprio, sem um segundo botão de recolhimento. Atendimento e
Pedidos permanecem fora do escopo, conforme esclarecimento do usuário.

QA isolada com dados fictícios: HUB/Validades em 768, 1024, 1366 e 1920px,
expandido/recolhido, sem sobreposição, desnível ou rolagem horizontal da página.
Logo e botão têm o mesmo centro vertical; nomes e assinatura cabem no cabeçalho
expandido. Menu móvel conferido em 360px (HUB) e 390px (Validades), sem controle
duplicado. Capturas claras/escuras e matriz geométrica privadas em
`cabecalho-menu-unificado/`. Alvos de toque existentes são preservados; sem
ensaio em aparelho físico.

Os três arquivos focados de navegação passaram (17 testes). O teste de cadastro
rápido de categoria em Vendas excedeu 5s no Windows, também na base original
sem esta alteração. A tentativa local ampliada foi interrompida; houve ainda
restrição de escrita no cache temporário do sandbox. A regressão final usa
Docker Linux isolado na VPS, sem rede, portas ou banco e com o limite padrão
dos testes; nenhuma asserção ou configuração global foi relaxada.

Regressão final `npm test -- --maxWorkers=1` no Docker: 292 arquivos aprovados,
35 ignorados; 2.682 testes aprovados e 561 ignorados pelas guardas dos próprios
testes, sem falhas, em 736,79s. Opt-ins de banco/integração externa não foram
ativados. Os dois arquivos de interface de Vendas passaram integralmente
(55 testes) no limite padrão, confirmando a diferença de execução local.

Lint global aprovado; `lint:design` aprovado (8 bases / 350 consumidores TSX).
`next typegen` e `tsc --noEmit` aprovados no mesmo Docker. A primeira verificação
isolada de tipos encontrou somente arquivos automáticos ausentes na exportação
limpa (`LayoutProps` e tipos de imagens); o comando oficial `next typegen` os
gerou, sem alterar declarações manuais ou o tsconfig. O pré-requisito reutilizável
foi registrado no guia de testes.
Build oficial webpack aprovado, 86 páginas geradas. Permanecem os avisos
existentes sobre middleware/proxy e compressão do jose no runtime Edge.

Publicação autorizada explicitamente. Imagem anterior preservada por
`grazinghub-cabecalho-menu-anterior:20261009`; snapshot fiscal privado em
`etiquetas-cabecalho-menu-20261009`, sem alteração operacional ou restauração.

## Controle único no rodapé — 09/10/2026

Solicitação posterior substitui a posição no cabeçalho e inclui a prévia separada
de Atendimento. Base HUB `ddf83c3441abb24fc7c0636e1ff7f09067a6b8fe`, branch
`codex/menu-recolher-rodape-20261009`; trabalhos do checkout principal preservados.
C: tinha 23,83 GiB livres; worktrees e dependências existentes reutilizadas.
A cópia adicional do Atendimento é isolada e reutiliza dependências por junção,
sem instalar pacotes ou integrar a branch extensa de migração à main.

`CabecalhoMenuLateral` conserva somente a marca; `RodapeMenuLateral` reúne a
assinatura e o Button oficial em HUB/Validades. Somente a assinatura se oculta
no modo recolhido. Navegação com rolagem interna mantém o controle acessível em
telas baixas; preferência por usuário, tooltip, teclado e vidro no hover/foco
preservados. O menu móvel usa seu X existente sem duplicar o recolhimento.
Central de Design (padrões, inventário e referência tipada) acompanha o contrato.

QA isolada dos três sites em 360, 390, 768, 1024, 1366 e 1920px; menus amplos
e recolhidos nas larguras desktop/tablet, sobreposição e fechamento nas móveis.
Um controle no rodapé, nenhum junto à marca, sem rolagem horizontal da página.
Em altura 420px, navegação longa rolou e o botão permaneceu dentro da tela.
Teclado conserva foco, alternância e vidro (repouso transparente, foco branco
com 10% de opacidade). Capturas privadas em `menu-recolher-rodape/`; sem ensaio
em aparelho físico. Conteúdo fictício nas prévias, sem operação em dados reais.

Regressão global do HUB no Docker Node 22 sem rede/banco: 294 arquivos e 2.724
testes aprovados, 35 arquivos/561 testes opt-in ignorados; uma falha inicial no
teste de seleção de local de estoque do Gestor, ao buscar a opção acessível.
Repetição do arquivo completo e três consumidores de navegação: quatro arquivos,
28 testes aprovados na mesma revisão, com limites e asserções originais. Nenhum
código de Pedidos ou teste foi alterado para obter esse resultado.
Lint global, lint de design, Next typegen, TypeScript e build oficial webpack
aprovados. Publicação do HUB/Validades autorizada explicitamente. Imagem anterior
preservada em `grazinghub-menu-rodape-anterior:20261009`; configuração completa e
fiscal em diretório privado `etiquetas-menu-rodape-20261009`, sem restauração ou
alteração operacional. Conferência pós-deploy será registrada separadamente,
sem outra publicação apenas para adicionar evidência.

Atendimento: `ff910d0402ac8ebee2bc30c88e64f9a09633642f`, branch própria
`codex/atendimento-menu-rodape-20261009`. Prévia publicada por troca atômica
somente de HTML/assets, anterior preservado, sem reiniciar serviços.
72 testes dos consumidores, lint/design, tipos e build aprovados; resolução
única de React no processo de testes eliminou mistura de runtimes instalados,
sem alterar dependências distribuídas, limites ou asserções. HTTPS autenticado
confirmou controle no rodapé e alternância por teclado. Consulta/coletor/banco
de homologação/prévia saudáveis e com partidas/reinícios preservados na troca;
entrada anônima de `/preview` permanece redirecionando para a consulta (303).
Detalhes no registro proprietário `docs/features/donatella-crm/PREVIA-INTERATIVA.md`
da branch de Atendimento; isso não encerra sua migração operacional.
