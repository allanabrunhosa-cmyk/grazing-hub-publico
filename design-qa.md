# Fotos na emissão e etapa Etiqueta — 17/10/2026

Estado: publicado e conferido em 17/10/2026, SHA `48bff635`.
Fotos reais carregadas, etapa Etiqueta e prévia inteira verificadas em produção
(1280×720, quadro/lateral bottom 704). Consulta móvel 390px e auditoria sem problemas,
console sem erros. Nenhuma impressão/baixa real. Serviço estável 166s, zero reinícios.
Evidência operacional completa em TASKS.
Integração `c6e4ea92` sobre main `d8c6ea3f`, runtime de Validades inalterado; build
conjunto aprovado. Fonte da correção `ffdb2872`, 423 testes e 37 focados aprovados.
Consumidores de referência: seleção atual e Fotos de Gestão. Reutilizados Button,
Card, FotoProduto e EtiquetaPreview; nenhuma mudança em primitivos ou ZPL.
Composição `validades-vidro` atualizada, Em revisão humana.

- Produto com foto no clique individual e no grupo; nome acessível preservado.
- Ausência/falha mantém ícone; outra URL pode carregar após uma falha anterior.
- Etiqueta substitui Revisão. Título/subtítulo repetidos da prévia removidos.
- SVG proporcional ajustado à altura disponível em desktop. Quadro/lateral em
  bottom 704 na tela 1280×720, sem precisar rolar para ver o papel inteiro.
- 29 cenários consultivos, seis dimensões e dois temas; nenhum diagnóstico na
  auditoria parcial. Mobile/tablet mantêm rolagem natural do formulário.
- 423 testes aprovados, 28 condicionais não executados; 37 finais de consumidor/Central
  aprovados. Lint/design passaram.
  Limite de 2GB afetou typecheck; tentativa final isolada com 4GB aprovada.
- Foto 404 foi simulada na prévia para validar fallback. Não houve acesso a
  banco/API/impressora real. Detalhes em [TASKS](docs/features/pontos-impressao/TASKS.md).

---

# Imprimir etiquetas — subetapas de Produto — 16/10/2026

Estado: publicado e conferido em 17/10/2026, SHA `4bc3cb79`. Build integrado,
438 testes, lint, lint:design e typecheck aprovados. 28 condicionais não executados.
UI autenticada em desktop/390: nome, sequência, busca/foco, limpeza e retornos
conferidos; nenhum trabalho produtivo criado. Console e auditoria sem erros.
Evidência de tarefa/contêiner/backup em [TASKS](docs/features/pontos-impressao/TASKS.md).
Referência: próprio fluxo de Validades, Card/Button/Tabs/CampoBusca oficiais e
composição `validades-vidro`, Em revisão humana. Sem hero ou novo primitivo global.

- Main steps na mesma faixa das áreas Imprimir/Histórico; retorno em seta discreta.
- Grupo, Produto e Conservação ocupam painéis sucessivos. Busca sempre montada;
  digitação muda para Produto, limpeza muda para Grupo, sem perder o foco do campo.
- Cinco estados × quatro larguras (320/390/768/1440) × dois temas = 40 capturas.
  Mais sete cenários de nome longo, erro simulado, leitor e histórico: 47 auditorias
  sem diagnósticos. Imagens consultivas em `.tmp/validades-subetapas-20261016`
  no checkout principal. Nenhuma referência foi aprovada/atualizada automaticamente.
- Inspeção de contato 320/390/768 e originais 1440; sem overflow horizontal ou
  rolagem dentro dos botões/abas. Em 320px o cabeçalho de navegação quebra linha.
  Mobile/tablet preservam rolagem necessária de prévia/formulário na revisão.
- 419 testes de domínio/design/layout aprovados; 28 condicionais não executados.
  Mais 20 focados na revisão final. Após integrar a main fiscal, 438 aprovados,
  zero falhas, 28 condicionais não executados (`5d03a3ce`). Lint, lint:design e
  typecheck aprovados.
  Ajustes identificados e corrigidos: flex-basis do CampoBusca em container vertical,
  foco após desmontar seleção anterior e expectativa aria-disabled do Tabs oficial.
- Nenhuma impressão ou baixa produtiva usada para teste. ZPL e conector inalterados.

---

# Validades — compactação e agrupamento de 16/10/2026

final result: passed

Escopo aprovado: reduzir o topo/etapas, eliminar rolagem nos controles, agrupar
registros do mesmo produto e registrar diretamente a baixa de uma única cópia.
Preservada a direção visual anterior, sem hero e com componentes/tokens do HUB.
Consumidor de referência: emissão/gestão de Validades; variante `validades-vidro`,
ainda **Em revisão humana** na Central.

## Conferência e correções

- Cabeçalho/subtítulo menores, três etapas em faixa horizontal de altura normal,
  seleção de responsáveis compacta e espaçamentos menores. Mantidos os alvos
  oficiais e a navegação para etapas anteriores. Texto secundário do topo é
  ocultado em celular; informações operacionais continuam no conteúdo.
- Indicadores sem descrições repetidas. Busca, Todas, Filtros e Grade/Lista ficam
  juntos. Ordenação aparece em Filtros. Total e produtos aparecem no resumo;
  lotes e registros ficam no grupo aberto. Nenhum dado de etiqueta foi truncado.
- Setas nativas reproduzidas na faixa de abas: `overflow-x:auto` também criava
  overflow vertical de 1px. Removida a regra local; o Tabs oficial quebra linha.
  A auditoria compartilhada detecta esse caso, sem impedir rolagem de tabelas.
- A inspeção de imagens encontrou colisão entre Filtros e Grade no tablet e na
  menor largura. A barra passou a usar flex-wrap pela largura real, com controles
  por ícone em telas estreitas e nomes acessíveis. Refeitas 16 verificações de
  geometria em 320/390/640/768/900/1024/1280/1440 px, claro/escuro: **zero colisões**.
- Card agrupa pelo ID do produto, após os filtros. Não junta homônimos diferentes
  nem registros sem identidade. Cada snapshot conserva prazo/lote/responsável.
  Expansão é independente da baixa. Grupo com várias etiquetas não dispara lote.
- Baixa única dispensa modal; transação, auditoria, autorização e idempotência do
  servidor continuam iguais. Trava síncrona impede clique duplo. Chave da baixa
  direta é preservada ao repetir após erro. Quantidade/confirmação continuam para
  várias cópias. Erro não remove o card; sucesso só é aplicado após a resposta.

## Evidências e limites

Prévia Vite isolada em `http://127.0.0.1:4199/etiquetas.html`. Dados, senhas,
API e impressão reais não foram usados para testar baixa. Artefatos locais
ignorados: `CAMINHO_LOCAL_DO_PROJETO`.

- Matriz com gestão, grupo, detalhe, responsável, produto, revisão, histórico,
  pontos, responsáveis e perfil: 320/390/768/1440 px, claro/escuro.
- `auditorias.json`: 89 cenários consultivos acumulados, zero diagnósticos finais.
  Últimas mudanças somente na barra de filtros foram conferidas novamente em
  `faixas-controles.json` e nas oito imagens `gestao-*.png` correspondentes.
- Estados adicionais: lista, filtros/ordenação, vazio, leitor, catálogo e baixa
  única pendente/erro/sucesso. Leitor sem botão de baixa. Enter abre grupo/detalhe;
  Escape fecha e restaura foco no registro. Testes cobrem quantidade e repetição.
- Imagens inspecionadas diretamente e em folhas de contato. A comparação com a
  versão anterior é consultiva; não há referência de pixels aprovada. Nenhum
  baseline foi promovido ou atualizado. `lint:visual:referencias`: zero aprovadas.
- Automação de navegador feita pelo CUA da sessão. Runner Playwright separado
  não foi executado. Emulação de largura não certifica toque físico, leitor de
  tela ou WCAG. Auditoria automática isolada não substituiu a inspeção visual.
- Interrupção por atualização das ferramentas foi tratada reabrindo a prévia.
  Builds intermediários não representam a compilação final desta revisão.

Publicação confirmada no commit `0f553b1a`: nova instância estável, UI autenticada
e HTTPS conferidos. Grupo, detalhe e três etapas abriram; nenhum comando de baixa
ou impressão real foi acionado. Evidências `publicado-*.png` permanecem locais.

Publicação e resultados dos comandos: [execução da frente](docs/features/pontos-impressao/TASKS.md#compactacao-e-agrupamento--16102026).

---

# Validades — linha visual de 16/10/2026

final result: passed

Escopo: Gestão, emissão guiada, Lista de produtos, Ver etiqueta/baixa, histórico,
prazos e configurações. Fonte primária fornecida pelo usuário: **Painel de Gestão
de Validades.png**, 1672 × 942. A referência aprova a direção; a instrução atual
remove explicitamente a imagem decorativa do topo. O layout preserva a identidade
GV e os componentes do HUB. Não houve referência separada anexada para o popup;
o detalhe adapta a mesma linguagem e usa o snapshot real do domínio.

## Comparação e adaptações

Fonte e implementação foram apresentadas juntas na mesma chamada de inspeção de
imagens, incluindo a comparação final após a correção da grade. Viewport 1672 ×
942, DPR aproximado 1; captura de página com área útil de 1656 px por causa da
barra nativa. Comparação integral e recorte dos indicadores, filtros e primeira
fila. Dados sintéticos com oito trabalhos, 14 cópias vencidas, uma hoje e sete
amanhã; não equivalem aos dados de produção.

| Eixo | Conferência e resultado |
| --- | --- |
| Hierarquia | Título/subtítulo claros, três indicadores, filtros e monitoria. A barra superior e a lateral oficiais permanecem; o banner ilustrado não existe. |
| Geometria | Até três colunas amplas; duas ou uma conforme a largura disponível. Espaços, raio, controle e sombras usam tokens existentes. Atalho Dar baixa acrescentado ao rodapé por requisito explícito. |
| Tipografia | Escala/famílias oficiais do HUB, sem fonte externa nova. Produto, status, validade e responsável mantêm prioridade. Metadados têm cor secundária. |
| Cor e superfícies | Fundo claro confortável, vidro leve no cabeçalho e superfícies discretas. Crítico/vermelho, hoje/alerta, amanhã/preventivo e em dia/neutro, acompanhados de texto. Tema escuro usa os tokens existentes. |
| Imagens | Hero removido por decisão do usuário. Produção lê somente fotos já cadastradas via GET privado; fixture mostra o estado sem foto, com ícone semântico. Não foram inventadas fotos para imitar os alimentos da arte. Marca e preview físico existentes preservados. |
| Conteúdo e ações | Card inteiro abre detalhe; baixa independente no card e na janela. Três etapas visíveis e seleção estruturada interna. Lista mostra prazos cadastrados, sem inventar valores. Consulta, vínculo e resultado físico continuam distintos. |

## Interações e responsividade

Navegador integrado controlado exclusivamente por `mcp__cua_repl`, Vite em
`127.0.0.1:4199`, componentes reais e ações simuladas. As 80 auditorias consultivas
salvas não apontaram overflow de documento, falta de nomes ou geometria dos
controles segundo o auditor. A inspeção humana do agente também identificou e
corrigiu cortes não detectados pelo auditor. Larguras 320, 390, 768 e 1440 px,
claro/escuro; comparação adicional na dimensão da fonte. Ponteiro grosso não foi
emulado pela ferramenta; viewport reduzido não é dispositivo físico.

Conferidos: abertura pelo card/atalho, quantidade e confirmação, falha preservando
preenchimento, Esc e retorno do foco ao card, link nativo para Histórico, abas,
ponto recolhido/expandido, responsáveis, perfil, busca/seleção de produto,
conservação, lista agrupada, revisão, grade/lista, filtros, prazos e estados
vazios/consulta. O perfil de consulta não recebe baixa. Nenhuma ação usou dados
reais. Imprimir não foi acionado no navegador; teste de duplicação/fila usa mocks.
Hover/active/loading/disabled reutilizam o contrato do Button; foco real foi
inspecionado. Não há novo motor de animação. Movimento/transparência reduzidos e
alto contraste têm fallback CSS; não foram certificados em hardware assistivo.

## Iterações resolvidas

- P2: barra redundante acima dos indicadores e densidade vertical excessiva.
  Acesso a prazos movido para a monitoria; cabeçalho local compactado.
- P1/P2: busca comprimida e controles de visualização sobrepostos no celular.
  Toolbar reorganizada; indicadores e cards respondem à largura disponível.
- P2: abas administrativas cortadas e campo de responsável estreito. Abas
  reorganizadas em telas pequenas; formulário em grade com largura útil.
- P2: revisão perdeu margens ao receber a nova superfície; corrigido padding e
  hierarquia. Imprimir mantém 48 px de altura no fluxo móvel, sem flex vertical
  reduzir o alvo.
- P2: auto-fit chegou a quatro colunas na dimensão da fonte. Grade limitada a
  três, com redução responsiva; nova captura comparada à fonte.
- P2: aviso Base UI no link de histórico. Link nativo com estilo oficial; abertura
  do histórico e ausência de novo aviso confirmadas no navegador.
- Funcional: smoke identificou que o host barrava a foto. Caminho estrito de GET
  adicionado à allowlist, preservando sessão e autorização; testes negativos.

Nenhum P0/P1/P2 visual remanescente nas evidências finais. O resultado técnico
não aprova automaticamente referências na Central: `validades-vidro` permanece
**Em revisão humana**. Não certifica WCAG, impressão física ou homologação externa.

## Evidências locais

Pasta ignorada (não publicada):
`CAMINHO_LOCAL_DO_PROJETO`.

- `gestao-final-referencia.png`, `gestao-final-foco.png`: comparação final.
- `gestao-final-{320,390,768,1440}-{claro,escuro}.png`: reflow da gestão.
- `detalhe-final-completo.png`, `detalhe-390-final.png`: detalhe/rolagem móvel.
- `baixa-erro-desktop.png`: erro local sem baixa real.
- `produtos-lista-*-*.png`, `revisao-*-*.png`, `historico-*-*.png`: fluxo/listas.
- `pontos-*-*.png`, `responsaveis-*-*.png`, `perfil-*-*.png`: configurações.
- `auditorias.json`: 80 leituras consultivas, sem apontamentos automáticos.

Capturas integrais após cliques podem mostrar a barra sticky na posição da
rolagem atual; são evidências do conteúdo, não da geometria fixa da viewport.
O retângulo real do detalhe em 390 × 900 ficou em x=16, y=45, largura ~343 e
altura 810 px, com rolagem interna. Capturas da viewport/foco complementam esse
limite do full-page. Capturas iniciais rejeitadas permanecem como evidência das
iterações; não confundir `gestao-inicial`/`gestao-revisada` com a versão final.

Validação funcional, comandos, revisão e status Git/publicação:
[execução da frente](docs/features/pontos-impressao/TASKS.md#nova-linha-visual-de-validades--16102026).

---

# Pedidos — revisão de fidelidade, 09/10/2026

final result: passed

Referência primária: imagem anexada `Imagem do ChatGPT 9 de out. de 2026,
14_27_53-2.png`, 1672 × 941. Comparação explícita com a implementação no mesmo
estado (Kanban e pedido selecionado com painel direito), com viewport configurado
em 1672 × 941; o navegador no Windows arredonda a altura interna para 942 px.
Fonte e captura foram abertas lado a lado na revisão do responsável e na revisão
independente. Lista e resumo comercial também foram comparados às respectivas
referências anexadas, preservando componentes, tipografia e tokens do Grazing HUB.

Evidências sintéticas locais em `.tmp/pedidos-fidelidade` (não versionadas):

- `09-final-referencia.png`: cinco colunas, primeira fila alinhada, fotos com
  quantidades, pedido selecionado e painel direito de 488 px.
- `10-final-lista-desktop.png`, `11-final-lista-mobile.png` e
  `12-final-detalhe-mobile.png`: leitura compacta e reflow a 390 px, com rolagem
  contida na tabela e no corpo do painel; cabeçalho e ações continuam acessíveis.
- `13-final-resumo-a4.png`: menu e preview comercial do pedido correspondente.
- `15-final-kanban-escuro.png`: contraste, seleção, badges e conteúdo no tema escuro.
- `16-final-lista-expandida-painel.png`: box horizontal de status/ícones, itens
  naturais e painel do mesmo pedido.
- `17-final-resumo-completo.png`: HTML exato do iframe exibido isoladamente;
  marca, dados PJ, agenda, itens, observações, total e rodapé sem corte.
- `18-final-kanban-painel.png` e `20-final-menu-refinado.png`: nova comparação
  final com a referência e acesso administrativo iFood no menu oficial de 224 px,
  sem linha extra acima do título e sem quebra dos rótulos do menu. A captura 19
  foi substituída por essa largura já existente nas ações do pedido.

| Superfície | Resultado e adaptação permitida |
| --- | --- |
| Tipografia | Família e escala oficiais, hierarquia clara de pedido, cliente, metadados e valores. |
| Espaçamento/layout | Cinco etapas na ordem solicitada; cards compactos, cabeçalhos iguais, painel vertical ancorado à direita; controles reorganizados no celular. |
| Cores | Verde da identidade Pedidos e cores semânticas complementares existentes; seleção e estados distinguíveis nos dois temas. |
| Imagens | Miniaturas nítidas, sem distorção, quantidade discreta; dados/fotos sintéticos só nas fixtures. Pedidos reais usam fotos privadas autorizadas do catálogo. |
| Conteúdo | Ações disponíveis conforme regras e permissões; orçamento/cancelamento por filtro; pagamento sem quitação inventada; produção e resumo comercial separados. |

Iterações resolvidas: painel com altura excedente (P1), desalinhamento dos
cabeçalhos/primeiros cards (P2), ausência do contorno selecionado por especificidade
CSS (P2) e contraste incorreto na prévia escura (P1 do ambiente de teste).
A captura 14 foi rejeitada: o harness colocava identidade no HTML, em vez do BODY
usado em produção. A correção do harness preserva integralmente os tokens reais.
Captura durante animação foi substituída após verificar posição estável do painel.

Nenhum P0/P1/P2 visual remanescente nas evidências finais. Shell, botões, pills,
ícones e X oficial de cancelamento são adaptações deliberadas ao design system.
Não foram copiados branding, contatos ou ações comerciais externas da referência.
A4 conserva o modelo comercial já existente e seu contrato de impressão/PDF.

Aprovação técnica visual não equivale a homologação humana: referências da Central
permanecem **Em revisão**. Testes, build e publicação constam no registro de execução
da feature, com evidências operacionais separadas das demonstrações sintéticas.

## Ajustes operacionais solicitados — 09/10/2026

final result: passed

Nova revisão da branch `codex/pedidos-ajustes-operacionais-20261009`, com sete
capturas adicionais do usuário como fontes: card com ações separadas, topo do
painel, agenda cortada, duas barras de consulta e seletor/menu de visualização.
As fontes foram abertas visualmente antes da preparação da prévia.

As fontes e as capturas da implementação foram abertas e comparadas na revisão.
O card agora reúne próximo status, impressão e menu junto ao número, sem olho nem
ações no rodapé. Exibe entrega futura e destinatária diferente do comprador. O
seletor oficial de visualização fica antes da busca, com apenas uma escolha de
modo. A agenda mantém ano e horário legíveis; no celular, os controles ocupam
linhas completas. A área redundante de operação foi removida do detalhe.

| Superfície | Resultado desta etapa |
| --- | --- |
| Tipografia | Escala e família oficiais preservadas; cliente, destinatário, entrega e valor têm hierarquia clara. |
| Espaçamento/layout | Ações no cabeçalho do card e seletor antes da busca; painel vertical; agenda alinhada no desktop e em uma coluna a 390 px. |
| Cores | Verde do módulo e estados complementares mantidos; X neutro em repouso e vermelho no foco/hover conforme o padrão oficial. |
| Imagens | Mesmas duas fotos sintéticas de teste, quantidades 2/3 legíveis, sem nova imagem de produto ou alteração em cadastro real. |
| Conteúdo | Data/janela de entrega substituem idade/criação no card; destinatário condicional, metadados salvos explicitamente, cancelamento exige nome e motivo. |

Evidências locais em `.tmp/pedidos-ajustes` (não versionadas):

- `01-quadros-desktop.jpg` e `02-painel-desktop.jpg`: card, seletor e topo do
  detalhe; próximos passos/impressão/menu juntos e sem operação duplicada.
- `03-agenda-cobranca-aberta.jpg`, `04-agenda-requisitos.jpg` e
  `05-agenda-salva.jpg`: cobrança aberta e inalterada não bloqueia a agenda;
  alteração de janela exige motivo, habilita Salvar e reflete o sucesso na
  consulta sintética e no detalhe.
- `06-quadros-mobile.jpg`, `07-painel-mobile.jpg` e `08-agenda-mobile.jpg`:
  consulta e painel a 390 × 844 CSS px, sem corte do ano nem sobreposição de
  controles. As capturas usam o reflow real do componente oficial.
- `09-menu-painel-mobile.jpg`, `10-cancelamento-mobile.jpg`,
  `11-menu-card-desktop.jpg`, `12-cancelamento-preenchido.jpg` e
  `13-cancelamento-concluido.jpg`: cancelamento pelo menu, identificação do
  operador autenticado separada do nome digitado, motivo obrigatório e sucesso.
- `14-resumo-preview.jpg`, `16-resumo-completo.jpg` e `18-resumo-rodape.jpg`:
  preview e HTML exato do iframe do pedido #1285, vistos em duas posições de
  rolagem; marca, dados PJ, agenda, itens, observações, total e rodapé preservados.
  Impressão/salvar PDF habilitado. Itens R$ 285,00 + entrega R$ 10,00 + outras
  cobranças R$ 5,00 = total R$ 300,00; não há contatos ou validade inventados.

Dois P2 encontrados e resolvidos durante a revisão: guard de descarte após
cancelamento já concluído e cor verde herdada pelo X focado no menu do card.
Fechar após sucesso foi repetido duas vezes: zero alertas de descarte e zero
diálogo de cancelamento remanescente. Rascunho com motivo preenchido continua
protegido. A regressão automatizada do responsável cobre também erro e
preenchimento pós-venda. Cor medida do item e do SVG focados:
`oklch(0.577 0.245 27.325)`; repouso neutro preservado.

A captura integral do navegador apresentou timeout e artefatos de composição
após alterações temporárias de viewport. Essas imagens não foram usadas como
prova de layout. Captura alternativa suportada registrou topo e rodapé do A4;
conteúdo do DOM e imagem anterior integral aprovada complementam a regressão.
Não houve geração de novo PDF nem impressão física nesta etapa, que preserva o
modelo A4 existente. Alertas de mock NextImage ficam restritos à prévia fictícia.

Nenhum P0/P1/P2 remanescente no escopo visual/funcional desta correção. Evidências
usam apenas fixtures sintéticas; aprovação técnica não equivale a homologação
humana. Referências da Central seguem **Em revisão humana**. Abas próprias foram
fechadas, viewport restaurado e servidor de prévia encerrado após a revisão.

## Lista direta e menu de cancelamento — 09/10/2026

final result: passed

Revisão da branch `codex/pedidos-lista-cancelamento-20261009`. As duas novas fontes
do usuário foram abertas: `codex-clipboard-251fda34-e98c-43d2-b146-f1099ca2dacd.png`
mostra impressão duplicada no menu do card e ausência de cancelamento;
`codex-clipboard-facbb3d6-886f-4d63-a1f6-c1d0c6ce9803.png` mostra expansor e ações
ocultas na Lista. As imagens são evidência visual, sem substituir a autorização
do usuário ou as regras de negócio do servidor.

Fontes e implementação integrada foram abertas juntas para comparação final.
Lista tem nove colunas com criação e canal; próximo passo, impressora e menu são
ações diretas, sem expansão. Menu oferece retorno quando aplicável, Resumo e
Cancelar por último após separador; impressão permanece somente no ícone próprio.
Cancelamento local confirmado aparece para operador autorizado; entregue continua
desabilitado com explicação visível e `aria-describedby` do motivo. Retorno
sintético de Entregue para A caminho preservou o bloqueio histórico no menu da
Lista e no detalhe. Nenhuma regra comercial ou financeira foi flexibilizada.

| Superfície | Evidência e resultado |
| --- | --- |
| Tipografia | Escala oficial preservada; criação com data/hora, cliente, canal e entrega legíveis; motivo de bloqueio em texto auxiliar. |
| Espaçamento/layout | Nove colunas no desktop, três ações diretas por linha elegível, painel vertical; tabela móvel com rolagem contida e diálogo de cancelamento sem corte. |
| Cores | Verde do módulo, cores semânticas dos status/canais e Badge warning oficial no aviso; cancelamento usa X neutro/vermelho conforme o padrão existente. |
| Imagens | Mesmas fotos sintéticas e selos 2/3; imagem comercial A4 e identidade Grazing Table & Co preservadas. |
| Conteúdo | Sem impressão duplicada/expansor; cancelamento último e restrições explícitas; aviso distingue cobranças, pagamentos, histórico, reservas e consumo/preparo. |

Evidências locais em `.tmp/pedidos-lista-cancelamento` (não versionadas):

- `01-lista-desktop.jpg`: nove colunas na ordem documentada, data/hora de criação,
  canal, miniaturas e próximo passo/impressora/menu na linha; zero expansores.
- `03-cancelamento-consequencias-desktop.jpg`: nome/motivo e aviso Antes de
  confirmar, com efeitos financeiros e de estoque descritos antes da ação.
- `04-menu-detalhe.jpg` e `08-menu-card-quadros.jpg`: Resumo seguido de separador
  e Cancelar, sem item redundante de produção; impressão no botão próprio.
- `05-menu-entregue-bloqueado.jpg`, `06-retorno-entrega-historica.jpg` e
  `07-detalhe-entrega-historica.jpg`: entrega registrada, retorno operacional e
  cancelamento ainda desabilitado, com razão textual/acessível nos dois menus.
- `09-resumo-a4-preservado.jpg`: prévia comercial #1287, marca e dados sintéticos;
  impressão/PDF habilitado. DOM do iframe conserva itens 2/3, subtotal R$ 285,00,
  entrega R$ 10,00, outras cobranças R$ 5,00 e total R$ 300,00. Modelo A4 intacto;
  não foi criado PDF nem efetuada impressão física nesta regressão.
- `10-lista-mobile.jpg` e `11-cancelamento-consequencias-mobile.jpg`: nova aba
  própria com viewport medido em 390 × 844 CSS px. Página com clientWidth e
  scrollWidth iguais; tabela rola internamente. Diálogo x=16, y=54, 358 × 736 px,
  clientWidth/scrollWidth 356/356, campos, aviso e confirmador inteiros.

Duas tentativas iniciais de captura mobile falharam após alterar o viewport.
A aba própria estável recuperou as capturas 10/11; imagens anteriores não são
prova desta versão. A escala do navegador pode produzir arquivo raster maior
que o viewport CSS medido. Captura 02 foi desconsiderada por anteceder o paint do
menu; capturas 04/08 mostram o estado estável. Nenhuma imagem com artefato embasa
o resultado. Abas próprias fechadas, viewport restaurado e Vite encerrado.

Nenhum P0/P1/P2 remanescente no escopo desta correção. O catálogo preserva o ID
histórico `pedidos-lista-expandida`; referências seguem **Em revisão humana**.
Prévia usa somente fixtures sintéticas, sem operações em dados reais. Revisão
visual não equivale a publicação; build/smoke são registrados pelo responsável
pela integração após esta revisão.

## Salvamento laranja e cancelamento após retorno — 09/10/2026

final result: passed

Revisão de `codex/pedidos-retorno-cancelamento-20261009`, base `944a0936`.
As três fontes novas foram abertas em pixels: `codex-clipboard-cd799a47-8746-464c-a274-6ce2cf58a8fe.png`
(cor do salvamento), `codex-clipboard-d0f96227-2f7c-4df8-a6ae-e7b5e9f2d845.png`
(bloqueio por entrega histórica no card) e `codex-clipboard-dc01572e-8959-46dd-8ba1-1a150c8f111a.png`
(confirmador sem preenchimento). Dados pessoais das fontes não foram reproduzidos
nas fixtures. A instrução atual substitui o bloqueio histórico registrado na
rodada anterior: só a etapa atual Entregue impede cancelar, mantendo a primeira
entrega e os demais fatos no histórico.

| Superfície | Evidência e resultado |
| --- | --- |
| Tipografia | Rótulos de salvamento e confirmação legíveis, com texto preservado; motivo do bloqueio explica como retornar a etapa. |
| Espaçamento/layout | Lista direta e cards preservados; ações do orçamento quebram para duas linhas no móvel; confirmação usa controle oficial de 44 px. |
| Cores | Salvar orçamento usa `salvar`, medido `rgb(182, 91, 0)` e texto branco no claro. Confirmar cancelamento usa `saida`, preenchido `oklch(0.577 0.245 27.325)` com texto branco, sem X no confirmador. |
| Imagens | Miniaturas sintéticas existentes preservadas, sem novos produtos, fotos reais ou mudanças no modelo A4. |
| Conteúdo | ENTREGUE mantém Cancelar desabilitado; retorno habilita na Lista, no card e no detalhe, mantendo a primeira entrega visível. Nome/motivo e consequências permanecem antes da confirmação. |

Evidências atuais, não versionadas, em `.tmp/pedidos-retorno-cancelamento`:

- `01-lista-desktop.jpg`, `02-entregue-cancelamento-bloqueado.jpg` e
  `03-retorno-cancelamento-habilitado.jpg`: nove colunas e menu com cancelamento
  desabilitado na etapa Entregue, habilitado após retorno para A caminho.
- `04-confirmador-vermelho-desktop.jpg`: nome/motivo sintéticos preenchidos,
  confirmador habilitado e inteiro vermelho. Cancelamento da fixture retornou
  sucesso e o diálogo fechou sem alerta indevido de descarte.
- `05-card-retorno-habilitado.jpg` e `06-painel-historico-cancelamento-habilitado.jpg`:
  retorno no Kanban, opção Cancelar disponível e data da primeira entrega mantida
  no detalhe em A caminho. O simulador não apaga `entregueEm` ao retornar/cancelar.
- `07-orcamento-laranja-desktop.jpg` e `10-orcamento-laranja-mobile.jpg`:
  `EditorPedido` real com orçamento fictício, salvamento laranja distinto de
  Confirmar pedido verde. Salvamento no mock retorna sucesso e fecha o formulário.
- `08-confirmador-vermelho-mobile.jpg`: confirmador e consequências no móvel.
  Viewport medido em 390 × 844 CSS px; orçamento com clientWidth/scrollWidth 390/390,
  diálogo de cancelamento estável x=16, y=40, 339 × 764 px, largura interna 337/337.
  Retorno seguido de cancelamento também concluiu na fixture móvel; fechamento
  teve zero alertas de descarte e zero diálogo de pós-venda remanescente.

A captura móvel do cancelamento enquadrou parcialmente o topo; ela sustenta as
cores e os avisos visíveis, complementados pelas dimensões do DOM estável e pela
captura desktop. A captura 09 repetiu esse enquadramento e não agrega prova.
Não houve nova captura de tema escuro: sua preferência persistida no navegador
prevaleceu sobre `defaultTheme`; não se atribui aprovação visual escura a esta
rodada. Tokens escuros permanecem registrados na Central e nos checks do integrador.

Nenhum P0/P1/P2 remanescente no escopo desta correção desktop/mobile no tema claro.
Referências da Central permanecem **Em revisão humana**. Somente fixtures sintéticas
foram operadas. Abas próprias fechadas, viewport restaurado e Vite encerrado antes
de liberar as verificações finais; publicação e checks finais são do integrador.

---

# QA visual — Dashboard Fiscal

Data: 11/10/2026. Consumidor visual **Em revisão** na Central; este resultado técnico
não substitui aprovação humana da aparência nem homologação fiscal externa.

## Fonte, captura e normalização

- Fonte visual: `%USERPROFILE%/Downloads/Imagem do ChatGPT 11 de out. de 2026, 20_52_07.jpg`, 1000 × 516 pixels.
- Implementação: `docs/features/fiscal-dashboard-financeiro/evidencias/desktop.jpg`,
  1424 × 1421 pixels na captura completa; viewport CSS 1440 × 1000.
- Mobile: `evidencias/mobile.jpg`, viewport CSS 390 × 844; adicional 320 × 740.
- Tablet: `evidencias/tablet-768.jpg` (768 × 900) e `tablet-1024.jpg` (1024 × 900).
- Desktop menor: `evidencias/desktop-1280.jpg` (1280 × 900).
- Estado: emitente fictício, outubro/2026, produção selecionada, tema claro,
  sem banco ou chamadas externas na prévia. Tema escuro capturado separadamente.
- Browser: in-app Browser do Codex, prévia isolada em `127.0.0.1:4448`.
- Captura JPEG em densidade 1; a imagem completa exclui a barra nativa lateral
  (até 16 pixels), sem mudar a densidade do conteúdo. Fonte de referência já é 1×.

Fonte e implementação foram abertas juntas em três comparações, não apenas em
visualizações separadas. Arquivos privados de comparação ficam em
`.tmp/fiscal-dashboard/comparacao-geral.jpg`, `comparacao-cartoes.jpg` e
`comparacao-graficos.jpg`. A moldura do HUB foi excluída somente no comparativo de
conteúdo. Regiões foram normalizadas para a mesma largura de 1000 pixels, sem
reorganizar elementos ou remover os serviços/certificado adicionais solicitados.
A referência do fornecedor não foi copiada para o código ou as imagens públicas da feature.

## Comparação das cinco superfícies

| Superfície | Verificação e resultado |
| --- | --- |
| Fontes e tipografia | Fonte nativa e tokens `text-display`, `text-title`, `text-stat` do HUB. Valores usam algarismos tabulares e escala limitada pelos tokens/largura do cartão. Rótulos, valores e apoio mantêm hierarquia; NF-e/NFC-e e os centavos não ficam cortados nas capturas finais. Fonte geométrica da referência é diferença intencional pela identidade solicitada. |
| Espaçamento e layout | Cabeçalho/emitente à esquerda, filtros à direita, quatro métricas alinhadas, gráfico de linhas e anel em colunas iguais. Margens, gaps e raios oficiais. Altura dos gráficos compactada após comparação. Mobile reordena para uma/duas colunas sem overflow; tabela tem scroll próprio. Serviços/certificado e documentos/pendências ampliam a altura porque são exigências explícitas do pedido. |
| Cores e tokens | Marca e tokens semânticos do HUB, com saídas vermelhas e entradas verdes no gráfico. Receita por modelo distingue marca/neutro. Em escuro, texto dos indicadores verde/vermelho usa navy para legibilidade sobre tokens claros. A paleta, os fundos sólidos e o quarto cartão neutro são diferenças intencionais dos tokens do HUB. |
| Imagens e assets | Não há fotografia/ilustração no alvo além de elementos da interface e marca do fornecedor. Marca do HUB preservada, ícones existentes Lucide, nenhum logo proprietário copiado. Canvas representa dados, com equivalentes textuais; não é substituto de imagem/ilustração do fornecedor. |
| Texto e conteúdo | Métricas mensais, serviços/certificado, ambiente exclusivo, documentos e pendências seguem o pedido. Contagens/status anuais e Total de Clientes da imagem não são inventados no produto. Indisponibilidade, média indefinida e certificado não confirmado têm textos explícitos. Prévia está identificada como sintética. |

## Histórico das iterações

1. **P2 — densidade dos gráficos e mobile.** A primeira captura
   `evidencias/desktop-primeira.jpg` mostrava gráficos excessivamente altos;
   `mobile-primeira.jpg` deixava os quatro indicadores empilhados em tela normal.
   Correção: canvas menor, legenda compacta, consulta flutuante, duas colunas de
   métricas em celular compatível. Evidência final: `desktop.jpg` e `mobile.jpg`.
2. **P2 — rótulo NFC-e e escala dos valores em desktop menor.** A inspeção de 1280 px
   mostrou quebra de NFC-e e pouco controle da escala monetária. Correção: rótulo
   indivisível, remoção do ícone redundante e fonte monetária derivada da largura do
   cartão/tokens. Evidência final substitui a inicial em `desktop-1280.jpg`.
3. **P2 — filtros em 768 px.** A largura fixa de três seletores produziu 4 pixels de
   transbordamento (documento 757 px contra viewport útil 753 px). Correção: layout
   dos seletores pela largura do container. Final: 753/753 px, `tablet-768.jpg`.
4. **P1 — contraste no tema escuro.** Texto claro sobre os tokens claros verde/vermelho
   era inadequado. Correção: navy da marca nos dois indicadores, como os tokens
   semânticos existentes. Captura revisada: `mobile-escuro.jpg`.
5. **P2 — centavos quebrados em 320 px.** Duas colunas estreitas fragmentavam números.
   Correção: uma coluna quando a área útil é menor que 18rem. Final:
   `mobile-320.jpg`, valores íntegros e documento sem overflow.
6. **P2 — contraste do apoio no cartão vermelho claro.** A medição dos fundos na
   captura indicou cerca de 4,01:1 com opacidade textual de 90%. Correção: texto
   opaco, aproximadamente 4,77:1; verde/azul também usam texto opaco. Isso verifica
   esses pares específicos, sem declarar conformidade geral WCAG.
7. **P2 — precedência da grade responsiva.** A combinação de breakpoint da janela
   com container query mantinha duas colunas no desktop em uma recaptura. Correção:
   a grade inteira segue a largura do container, com quatro colunas a partir de
   40rem. As quatro métricas têm a mesma coordenada vertical em 1280/1440 px;
   tablet de 1024 px conserva duas colunas. Capturas finais recapturadas, e o build
   confirmou a classe final nos artefatos compilados.

As evidências finais foram recapturadas após cada correção. Comparação geral e
regiões focadas finais não apresentam diferenças P0/P1/P2 acionáveis. Uma revisão
visual independente confirmou a mesma conclusão.

## Interações e estados observados

- Filtros de mês e ambiente navegados; homologação separada com aviso próprio.
- Gráfico consultado por End/Escape; tabela diária aberta com 31 dias + cabeçalho.
- Menu móvel aberto/fechado e três destinos fiscais presentes após Bancos.
- Tema claro/escuro alternado pela aparência da prévia; canvas acompanha o tema.
- Estados com valores, zero real, ausência de evidência e média sem documentos
  verificados por componente e prévia; nenhum certificado foi tratado como válido.
- Em 320/390/768/1024/1280/1440, `scrollWidth` não excede a largura útil da página.
- Console de uma nova aba final: zero erros/avisos. Avisos Base UI de links da primeira
  captura foram corrigidos com a semântica apropriada do componente oficial.

## Limites e refinamentos

Não se declara reprodução pixel a pixel: o pedido preserva identidade/moldura do
HUB e exige conteúdo diferente do anexo. Não há referência mobile fornecida.
Gráfico diário usa os pontos reais de cada dia, com série ausente interrompida.
Capturas e testes não constituem certificação WCAG, leitor de tela completo ou
homologação de emissão/certificado. Verificação visual continua sujeita à aprovação humana.

## Checklist final

- [x] Fonte e implementação comparadas juntas; regiões de cartões/gráficos examinadas.
- [x] Correções P0/P1/P2 resolvidas e capturadas novamente.
- [x] Cinco superfícies de fidelidade examinadas, com desvios intencionais explícitos.
- [x] Desktop, tablet, mobile estreito, escuro e estados de ausência verificados.
- [x] Interações essenciais e console verificados em browser.

final result: passed

---

# BI de vendas — revisão final, 15/10/2026

Esta seção registra somente o BI de vendas. Os relatórios anteriores foram preservados
integralmente a partir de `7a8e874ecdaf6698ff8fce68fc9a6fac4ab21ec5:design-qa.md`.

## Fonte, ambiente e normalização

- Fonte visual aprovada pelo usuário: `CAMINHO_LOCAL_DO_PROJETO`, 1672×941 pixels.
- Implementação inspecionada: prévia isolada `/bi-vendas.html`, com componentes reais do HUB e dados sintéticos. Não consulta banco nem serviços externos.
- Ambiente: Windows, Chromium pelo Playwright 1.64.0 do projeto, locale pt-BR, fuso America/Sao_Paulo, DPR 1 e movimento reduzido.
- Comparação principal: viewport 1672×941 CSS px e captura 1672×941 pixels. Fonte e implementação aparecem juntas, sem redimensionamento individual, em `.tmp/bi-vendas/comparacao-final.png` (3344×941).
- Recortes de detalhe foram ampliados igualmente em 2×. Não se fez uma normalização que escondesse diferenças de tipografia ou altura.
- A lateral e o cabeçalho reais têm outras dimensões. A origem do conteúdo passa de aproximadamente x=212/y=65 para x=304/y=120. Essa diferença é exigida pelo pedido de preservar o HUB existente.
- Metadados, dimensões e hashes das capturas: `.tmp/bi-vendas/metadados-comparacao-final.json`.

A fonte fornece somente o desktop claro. Notebook, tablet, celular e tema escuro
foram avaliados pela preservação da ordem, dos controles e da legibilidade. Não há
uma referência móvel fornecida para alegar comparação de pixels nesses estados.

## Evidência visual final

| Cenário | Captura de viewport | Página completa |
| --- | --- | --- |
| Desktop largo, 1672×941 | `.tmp/bi-vendas/capturas/bi-1672.png` | `bi-1672-completa.png`, 1672×1069 |
| Notebook, 1280×941 | `.tmp/bi-vendas/capturas/bi-1280.png` | `bi-1280-completa.png`, 1280×1495 |
| Tablet, 768×941 | `.tmp/bi-vendas/capturas/bi-768.png` | `bi-768-completa.png`, 768×2644 |
| Celular, 390×941 | `.tmp/bi-vendas/capturas/bi-390.png` | `bi-390-completa.png`, 390×2643 |
| Celular estreito, 320×941 | `.tmp/bi-vendas/capturas/bi-320.png` | `bi-320-completa.png`, 320×3095 |
| Celular com toque, 390×844 | — | `.tmp/bi-vendas/capturas/bi-390-toque.png`, 390×2818 |
| Escuro, viewport 1672×941 | — | `.tmp/bi-vendas/capturas/bi-escuro.png`, 1672×1068 |
| Vazio, 1672×941 | `.tmp/bi-vendas/capturas/bi-vazio.png` | — |
| Carregamento, 1672×941 | `.tmp/bi-vendas/capturas/bi-carregando.png` | — |

Os nomes abreviados da coluna de página completa pertencem a `.tmp/bi-vendas/capturas/`.
As páginas completas longas não foram comparadas como se coubessem em um viewport.
Foram examinados também seus trechos inferiores, incluindo oportunidades e qualidade.

Comparações ampliadas examinadas, com fonte à esquerda e implementação à direita:

- `.tmp/bi-vendas/comparacao-kpis-final.png`: ícones, valores, descrições e tamanho monetário longo.
- `.tmp/bi-vendas/comparacao-grafico-final.png`: cabeçalho, controles, colunas, escala e altura útil.
- `.tmp/bi-vendas/comparacao-ranking-final.png`: cinco posições, nomes, barras e alinhamento numérico.
- `.tmp/bi-vendas/comparacao-oportunidades-final.png`: três linhas, ações e densidade inferior.
- `.tmp/bi-vendas/comparacao-eixo-390-final.png` e `comparacao-eixo-320-final.png`: antes e depois da correção móvel. Ambas têm o estado anterior à esquerda e o estado corrigido à direita.

## Histórico das correções

### Iteração 1 — composição e densidade

Comparação inicial: `.tmp/bi-vendas/comparacao-inicial.png`. Captura inicial:
`.tmp/bi-vendas/inicial-1672.png`, página completa de 1672×1237.

- [P1, resolvido] Linha principal com cerca de 353 px, contra 255 px na fonte. O seletor mensal ocupava largura excessiva e deslocava os demais controles. Foi limitado e passou a usar a variante compacta oficial.
- [P1, resolvido] Linha inferior com cerca de 309 px, contra 222 px na fonte. A distribuição regional passou a ter quatro linhas compactas com nome, barra e quantidade. Foram removidas reservas verticais sem função.
- [P2, resolvido] Data final truncada no filtro desktop. O período agora usa datas compactas em português e mantém a descrição acessível completa.
- [P2, resolvido] Ranking com barras pequenas e linhas muito espaçadas. A grade reserva mais largura para as barras; as cinco posições mantêm cerca de 30 px por linha no desktop.
- [P2, resolvido] Títulos e indicadores com escala inferior à referência. Os títulos usam o token de seção. Os indicadores mantêm escala próxima da fonte, com redução somente para moedas longas que precisem preservar todos os dígitos.

Evidência após as correções: `.tmp/bi-vendas/comparacao-refinada.png` e comparações finais ampliadas.

### Iteração 2 — cabeçalho, controles e área do gráfico

- [P2, resolvido] Abas móveis se aproximavam até unir visualmente os nomes. Elas agora quebram em duas linhas, sem reduzir a fonte nem sobrepor textos.
- [P2, resolvido] Espaçamento do cabeçalho e das abas acrescentava cerca de 18 px além da diferença exigida pelo cabeçalho real. A reserva foi reduzida no desktop; os alvos de toque permaneceram preservados.
- [P2, resolvido] Botões em cápsula destoavam da referência. O BI usa a variante optativa oficial `formato="campo"`; a geometria padrão dos demais consumidores foi preservada.
- [P2, resolvido] A área útil das colunas estava achatada, com cerca de 108 px. A alternativa textual passou para um Popover oficial no cabeçalho. O canvas tem 184 px e reserva 132 px para o plot, sem reduzir a fonte de 11 px.

A proporção principal é 3:2. A captura final tem seis indicadores de aproximadamente
140 px, contra 145 px na fonte. A linha principal tem cerca de 272 px, contra 255 px;
a diferença restante é pequena e preserva os controles oficiais e a tabela acessível.
O plot de 132 px corresponde à área da fonte ajustada à menor largura disponível no HUB.
A linha inferior fica próxima de 239 px, com conteúdo real de cobertura e confirmação.

Evidência posterior: `.tmp/bi-vendas/comparacao-final.png`, gráfico e ranking ampliados,
mais as cinco capturas responsivas finais.

### Iteração 3 — rótulos do gráfico móvel

- [P2, resolvido] Valores próximos sobre as colunas se sobrepunham no espaço móvel. A quantidade de anotações agora acompanha a largura útil; tooltip e tabela mantêm todos os valores exatos.
- [P2, resolvido] O eixo Y perdia o símbolo monetário à esquerda. A margem passou a usar `measureText` dos cinco rótulos com a mesma fonte de 11 px. A seleção de colunas usa a mesma margem calculada.
- [P2, resolvido] O último valor podia ultrapassar a borda direita. A posição do texto é limitada ao plot.
- [P2, resolvido] Uma barra posterior podia encobrir uma anotação já pintada. As anotações agora são desenhadas após todas as barras. No celular, somente anotações que não colidem com barras vizinhas permanecem visíveis.

Os recortes finais de 390 e 320 px foram abertos após essa última correção.
Não há símbolo monetário cortado, anotações sobrepostas ou valor cortado à direita.
Em 320 px, a anotação do maior valor permanece; os demais valores são consultáveis
na tabela e na navegação por teclado. Todas as colunas continuam visíveis.

Evidência: `.tmp/bi-vendas/foco-mobile-390-corrigido.png`,
`foco-mobile-320-corrigido.png` e as duas comparações de eixo antes/depois.

## Superfícies de fidelidade

**Tipografia.** Família nativa do HUB preservada. Títulos, corpo, rótulos e valores
mantêm hierarquia próxima da referência. O cenário de valor longo testa
`R$ 1.260.981,60` sem cortar dígitos. As abas não se unem no celular. Não se reduziu
a fonte do gráfico para resolver as colisões. Nomes longos do ranking podem ser
abreviados na faixa estreita; permanecem acessíveis pelo nome e pelo detalhamento.

**Espaçamento e layout.** A ordem aprovada foi mantida: cabeçalho, abas, filtros,
seis indicadores, colunas/ranking e três cartões inferiores. O desktop usa 60/40.
O notebook mostra os indicadores em duas linhas. As demais faixas empilham os
blocos sem trocar a ordem. Em 320 px, os indicadores passam a uma coluna para
preservar os valores. Não há rolagem horizontal do documento nas cinco larguras.

**Cores e tokens.** Fundo claro discretamente azulado, cartões brancos, azul como
destaque e títulos navy. Não há roxo de Atendimento. Bordas, sombras, raios e
controles pertencem ao sistema oficial. No escuro, tokens próprios preservam
separação entre superfícies, rótulos e ações. Custos não apurados permanecem em
estado de atenção; não recebem sinal verde por mera presença de um campo.

**Imagens, ícones e ativos.** A lateral, os logos e o cabeçalho são os componentes
reais do HUB. Ícones pertencem à biblioteca existente. Não se adicionaram avatares,
logotipos repetidos, mapa fictício ou pontos inventados. A ausência de coordenadas
confiáveis usa a distribuição regional prevista no pedido, na mesma posição da fonte.

**Texto e conteúdo.** Caminho, título, subtítulo, cinco abas, seis indicadores e
as três oportunidades seguem os rótulos do pedido. O estado sem comparação omite
variações. A margem não apurada e a referência financeira não afirmam validações
inexistentes. Avisos de protótipo não integram a interface operacional. As capturas
usam exclusivamente dados sintéticos para avaliar a interface, sem simular publicação
nem comprovar a cobertura da base real.

## Interações e limites da verificação

A regressão final de escopo também passou em execução isolada: **1/1 contrato**
`abas, consultas de oportunidade, painéis e filtros preservados`. Ao sair de Clientes,
`somenteSemRecompra` é removido; o período e os filtros globais permanecem. O retorno
à consulta de clientes continua funcional. Resultado: `.tmp/bi-vendas/resultados-regressao-escopo.json`.
Essa alteração não mudou a composição visual principal. A prévia foi encerrada após o teste.

As duas correções finais de usabilidade também foram verificadas: **3/3 contratos
aprovados** na rodada focada. O caso existente de abas e painéis passou novamente.
O novo caso de pedidos confirma que abrir a consulta pela página 4 do ranking
reinicia os pedidos na página 1 sem perder canal, período ou aba. O novo caso de
período entre anos confirma os dois anos completos e ausência de recorte em 1672
e 320 px. Resultado: `.tmp/bi-vendas/resultados-regressao-paginacao-periodo.json`.
A tela padrão e suas capturas permanecem iguais. A prévia foi encerrada após o teste.

A terminologia regional foi corrigida e verificada em rodada posterior:
**6/6 contratos aprovados**, com capturas nas cinco larguras e um contrato semântico.
“Com região informada” indica somente a presença de bairro/cidade. Não comprova
geolocalização nem validação do destino. O painel separa “Sem região informada” de
“Destinos não validados”; este último usa entregas menos confirmadas e aproximadas.
O cenário de teste é exclusivamente sintético: seis entregas, quatro com região,
uma confirmada, duas aproximadas, duas sem região e três não validadas. O contrato
confere que esses contadores não se confundem, tanto no card quanto no painel e
na aba Entregas, em 1672, 1280, 768, 390 e 320 px. A evidência do painel é
`.tmp/bi-vendas/capturas/bi-cobertura-regional.png`; o resultado está em
`.tmp/bi-vendas/resultados-regressao-regiao.json`. As capturas principais foram
recapturadas e examinadas após os rótulos novos. A prévia foi encerrada. Não foram
copiados registros ou números da base operacional para a fixture.

A execução completa registrou **12/12 contratos aprovados**: onze cenários da
interface, incluindo cinco larguras, mais um cenário de celular com toque.
Log: `.tmp/bi-vendas/visual-bi-final.log`. Após os últimos ajustes do gráfico,
os **sete contratos afetados passaram novamente**: cinco larguras, tabela/teclado
do gráfico e celular com toque. Resultado dessa rodada preservado no resumo abaixo;
resumo: `.tmp/bi-vendas/visual-bi-eixo-final.log`.

Foram exercitados:

- Abas e filtros na URL; ranking completo e consulta de clientes sem recompra.
- Painéis de pedidos, cobertura e filtros; rejeição de letra no intervalo numérico.
- Falha recuperável com manutenção da seleção confirmada e nova tentativa.
- Exportação oculta e detalhamentos restritos por permissão.
- Abertura da tabela textual do gráfico, Escape e retorno de foco ao gatilho.
- Setas e Enter no canvas, com abertura dos pedidos do intervalo correspondente.
- Proteção contra uma resposta antiga substituir o filtro mais recente.
- Carregamento com seis esqueletos, vazio e tema escuro.
- Toque em Mais filtros e alvos oficiais no contexto móvel com ponteiro grosso.

O auditor oficial `scripts/auditar-interface.mjs` foi executado no DOM renderizado,
após fontes/layout, com anexos JSON. Verificou overflow, aproximação dos nomes e
rótulos, eixos dos grupos de ações e alvos de toque. Não encontrou problemas nos
cenários executados. O contrato do gráfico também verifica que nenhuma pintura
encosta nas bordas laterais do canvas, evitando o recorte observado.

As cinco capturas de geometria monitoraram `pageerror`, sem erros de JavaScript
de página. Isso não equivale a certificar todos os registros do console. A auditoria
não certifica WCAG, contraste composto, leitura por leitor de tela ou todos os níveis
de zoom. Essas avaliações completas não foram executadas nesta revisão.

## Diferenças intencionais e acabamento residual

- Navegação e usuário autenticado reais substituem a lateral e o cabeçalho ilustrativos, conforme pedido expresso. A altura completa ultrapassa os 941 px da referência por causa dessa estrutura preservada.
- O período sem comparação não apresenta as variações demonstrativas da fonte.
- Números e percentuais da referência não foram copiados para produção. A captura de valor longo testa outra dimensão de dado sintético.
- O mapa é substituído por distribuição disponível e aviso, porque não há coordenadas confiáveis.
- Estados de margem, endereços e marco financeiro refletem disponibilidade, sem copiar os sinais verdes ilustrativos.
- [P3] O acabamento das barras é mais plano e o azul é um pouco mais sóbrio que a ilustração. Isso decorre dos tokens oficiais. Não altera a hierarquia nem a leitura.

Não restam achados P0, P1 ou P2 nesta inspeção. As referências visuais oficiais não
foram promovidas nem substituídas. Este resultado diz respeito ao QA visual e aos
contratos descritos; não declara publicação, teste com dados operacionais ou aprovação
humana de uma nova baseline.

- [x] Fonte e implementação examinadas juntas em viewport equivalente.
- [x] Indicadores, gráfico, ranking e oportunidades comparados em recortes ampliados.
- [x] Correções P1/P2 recapturadas e revistas após os ajustes.
- [x] Desktop, notebook, tablet, celular, toque, escuro, vazio e carregamento examinados.
- [x] Contratos de interação, teclado e auditoria parcial do DOM executados.
- [x] Prévia isolada e processos próprios encerrados após a conferência.

final result: passed
