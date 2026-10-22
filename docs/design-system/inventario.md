# Inventário de padrões reais

## Fiscal unificado — 21/10/2026 — Em revisão visual

A ficha e a central reutilizam Card com `vidro-painel`, Button, GrupoAcoes,
CampoBusca, SelecaoFormulario e os seletores oficiais pesquisáveis. Campos adicionais
e histórico usam detalhes expansíveis. Grades viram uma coluna no celular.
Não há dependência, token, variante global ou catálogo fiscal paralelo novo.

EditorVenda permite conteúdo independente do formulário comercial. A aba Fiscal
preserva seu rascunho ao alternar abas e oferece somente suas ações. A validação
comercial não bloqueia o salvamento fiscal. Consumidores anteriores mantêm o
comportamento padrão. Evidências e limites ficam em
[Fiscal unificado](../features/fiscal-unificado/TASKS.md).

## Dashboard PF/PJ e nota fiscal no pedido — 20/10/2026 — Em revisão visual

Pizza com valores textuais e seletor Pedidos/Faturamento reutiliza Card, Alternador
e tokens da distribuição do BI. Ranking de produtos ocupa o antigo espaço de
Oportunidades. Sem componente global ou dependência nova.

Detalhe do pedido preserva Secao, GrupoAcoes e superfícies atuais. Itens e frete
precedem pagamento; Nota fiscal encerra a leitura. Sucesso usa Badge e texto
success. PDF/XML usam Button outline; cancelamento usa Button saida e Dialog
com justificativa obrigatória. Erros persistem com role alert.

Capturas sintéticas e verificações em [BI](../features/bi-vendas/TASKS.md)
e [Pedidos](../features/pedidos/EXECUCAO.md). Foram conferidos 320/390/768/1440
em claro/escuro, teclado e dimensões. A inspeção não promove baseline.

## Validades — superfícies e operação — 16/10/2026 — Em revisão visual

A composição `validades-vidro` está no catálogo tipado e em
`DemonstracaoValidades`, sem APIs ou impressão. O módulo reutiliza os componentes
oficiais, a identidade GV e os tokens de cor, raio, altura, sombra e movimento.
Superfícies translúcidas leves; nenhum hero ilustrado. As cores semânticas
acompanham texto de status. Card acionável e baixa independente evitam botões
aninhados; o detalhe usa Dialog, foco restaurado e rolagem contida. Emissão com
três etapas e consulta agrupada de produtos. Não cria variante global de Button.

A emissão também compõe etapas principais à esquerda e abas da área à direita.
Produto usa Tabs oficiais em sequência Grupo/Produto/Conservação, com CampoBusca
estável fora dos painéis. O cabeçalho do passo contém a seta Button ghost/icon.
Container query reduz a faixa a números com nomes acessíveis quando há pouca
largura; flex-wrap mantém controles legíveis em 320px. A demonstração inclui a
composição, ainda Em revisão. Nenhum primitivo compartilhado foi modificado.

Ajuste de 17/10: cartões de seleção individual/em grupo compartilham FotoProduto
com a Gestão. Foto decorativa ao lado do nome, rota privada, lazy loading e fallback
por ausência/falha; nome acessível do botão preservado. Etapa final Etiqueta,
sem título/subtítulo repetido da prévia. A apresentação do SVG é proporcional e
limitada à altura real da janela no desktop; milímetros/fontes/ZPL não mudam.
Variantes da mesma composição adicionadas ao catálogo, ainda Em revisão.

Ajuste operacional de 16/10: cabeçalho e etapas compactos, agrupamento expansível
por produto e baixa direta de uma única cópia restante. A seleção de registro e a
confirmação permanecem para múltiplas cópias. Abas usam o flex-wrap oficial sem
`overflow:auto`: 1px vertical gerava setas nativas. A auditoria compartilhada passa
a apontar rolagem em botões/abas; tabelas e diálogos conservam rolagem própria.
Demonstração e fixtures incluem expansão, baixa única, espera, erro e sucesso
sintéticos. Nenhuma geometria nova foi imposta ao Button global.

CSS local: `src/app/(protegido)/producao/etiquetas/validades.css`. Controles de
opção migraram para Button oficial; somente a dívida resolvida correspondente
foi retirada do baseline. Transparência reduzida, movimento reduzido e alto
contraste têm fallback. Referência permanece **Em revisão humana**. Auditoria
consultiva não certifica WCAG nem impressão física. [Comparação e evidências](../../design-qa.md#validades--linha-visual-de-16102026).


## Listagem de Produtos e Complementos — Em revisão visual

`produtos/produtos-client.tsx` separa Preço, Status e Ações. `StatusCadastroVenda`
fica na penúltima coluna; `GrupoAcoes` conserva impressão, edição e exclusão
existentes na última coluna, no mesmo eixo. `Button ghost` recebe a expansão
com `ChevronRight` antes da foto, conforme Insumos/Fornecedores, nome contextual,
`aria-expanded` e `aria-controls`. Foto de 80 px preservada; padding vertical
reduzido. Sem variante/token novo. A exceção de botão nativo desta expansão foi
retirada do baseline após a adoção do controle oficial.

Prévia isolada de Vendas: 320/390/768/1440 px, claro/escuro, ponteiro grosso
nas duas menores larguras, dados fictícios, expansão por Enter, colspan 4 e
ações de toque com pelo menos 44 px. Auditoria executada nos 16 cenários sem
diagnósticos. Em 1440 px, linha de produto de 156,5 para 106,5 px; complemento
de 113 para 107 px. Tablet conserva largura mínima e rolagem interna; celular
mantém status/ações na mesma faixa. Capturas Windows consultivas em
`.tmp/produtos-status-acoes`, sem referência oficial aprovada ou certificação
de contraste/leitor de tela. Validação: lint focado, `lint:design`, typecheck e
build webpack aprovados; build e 40 testes de consumidores confirmados com
Node 22.23.3. Regressão de Vendas com Node 24: 960 testes aprovados, 173 ignorados
(incluindo opt-ins de banco) e um timeout em GTIN; reteste isolado sem alterar
prazos aprovou os nove testes desse arquivo. Nenhuma gravação em dados reais.
Publicação em produção pendente: VPS sem resposta por SSH e HTTPS, sem confirmação
de tarefa/container ou smoke autenticado. Banco/schema/migrations inalterados.

Entradas avulsas/histórico e aba individual de Movimentações, 12/10/2026:
Adicionar item fica no fluxo, logo abaixo do Item 1; campos compactos numa linha
em desktop/tablet, com unidade fixa em Qtd. `InsumoDialog` também reutiliza as abas
e `MovimentacoesItem`, preservando o formulário montado ao consultar o extrato.
reutilizam EntradaAvulsaForm, InsumosTable, BarraAcoes/GrupoAcoes, Tabs buttons,
Table/SortableTableHead, Dialog com descarte controlado, Input/InputComSufixo,
CurrencyInput, SelecaoFormulario, InsumoCombobox e BotaoRemoverItem. Confirmação
positiva usa Button entrada; navegação conserva a marca. Sem variante/token novo.
Prévia sintética `testes/visual/estoque-entradas.vite.config.mts`, com tokens oficiais,
larguras 320/390/768/1440 e temas claro/escuro. Referência **Em revisão humana**;
auditoria automática e capturas isoladas não certificam WCAG.

## Estrutura fiscal de produtos — 11/10/2026 — Em revisão visual

`/vendas/fiscal/cobertura` reúne produtos ativos, evidências de fornecedores,
versões, perfis, regras, importação de tabelas e análise de impacto antes da ativação.
Reutiliza Card/Table/SortableTableHead, TabsList buttons, FiltroOpcoesContadas,
CampoBusca, EditorVenda e Input com restrições/precisão; remoções de rascunho usam
BotaoRemoverItem. Não introduz token ou variante. A aba Fiscal de Produtos e os
vínculos preservam NCM e parâmetros individuais ao sugerir dados do grupo.

Pedidos usa Dialog/Table para prévia tributária, calculada no servidor por modelo,
sem transmitir nota. Documentos anteriores mantêm snapshots e eventos próprios.
Fontes e evidências sintéticas: [interface e QA](../features/estrutura-fiscal/INTERFACE.md).
Imagens desktop/modal/impacto/mobile em `docs/features/estrutura-fiscal/evidencias`.
Referência permanece **Em revisão**; testes automatizados não certificam WCAG,
homologação externa ou aprovação visual humana.



## Dashboard Fiscal — 11/10/2026 — Em revisão visual

`/financeiro/fiscal` reutiliza Card, Select, Badge, Button e Table; menu/cabeçalho
do HUB preservados. Quatro métricas compactas e gráficos de movimento/donut em
colunas iguais seguem a composição da captura fornecida, com fontes/tokens do HUB.
No celular, métricas em uma ou duas colunas e gráficos em uma; tabela mantém scroll próprio.
Canvas tem leitura por teclado e equivalente textual, com lacunas explícitas.
Não adiciona dependências ou variantes globais. Filtros são exclusivos por ambiente.

Consumidores: `testes/financeiro/fiscal-dashboard-interface.test.tsx`, testes
`fiscal-dashboard` e `layout/fiscal-*`; prévia `testes/visual/fiscal-dashboard.vite.config.mts`.
[Capturas e limites](../features/fiscal-dashboard-financeiro/README.md) e
[comparação visual](../../design-qa.md). Referência permanece **Em revisão**;
evidência sintética não comprova certificado, SEFAZ ou homologação externa.

## Responsividade global — 09/10/2026 — Em revisão visual

- `MenuLateral`, `NavLink`, `GrupoNavegacao` e `ModuleSwitcher`: preferência
  por usuário, lateral de ícones, rótulos por foco/hover e submenus em portal.
  `NavegacaoMovel` conserva a sobreposição até 767px.
  `CabecalhoMenuLateral` reserva o topo à marca; `RodapeMenuLateral` reúne
  assinatura e botão de recolher/expandir em HUB e Validades. O botão permanece
  visível no estado recolhido e quando a navegação precisa rolar. Conteúdo móvel
  reutiliza a marca sem duplicar o controle desktop. A prévia separada de
  Atendimento aplica o controle no rodapé; Pedidos conserva seu layout.
- `ui/table` e `ui/table-responsiva`: identificação sem confundir seleção,
  offsets compartilhados, altura visível com barra nativa, quebra de textos e
  recálculo por tamanho/dados. Colunas específicas em Lançamentos, Importação
  de cartões, Movimentações e Porções declaram a identificação semanticamente.
- Tabelas HTML de Produtos, Etiquetas, Importação e Central migradas para os
  mesmos primitives; Insumos/Fornecedores dispensam mínimos excessivos e
  mantêm todas as informações e ações disponíveis.
- A prévia `testes/visual/responsividade.vite.config.mts` reúne tabelas longas,
  seleção, formulários, filtros, navegação HUB/Validades e dados fictícios.
  Matriz e resultados: `docs/features/responsividade-global/TASKS.md`.

## Pedidos confirmados — 08/10/2026 — Em revisão visual

Pedido/Histórico reutilizam Tabs, Button, Badge, TagCanalVenda e GrupoAcoes. Dialog
descendente para revisão, agenda e cancelamento; informações somente leitura usam
texto/listas, sem campos desabilitados. Atendimento conserva operações existentes,
com pendências visíveis na aba principal. Gestor usa próximo status textual e Voltar ghost.

Variante `Button.atencao` registrada em `grupos.ts` e demonstrada na Central: Salvar
orçamento, laranja com os tokens já existentes `--ds-etiquetas-primaria-clara/escura`.
Não altera dimensões, descarte, remoção ou política de salvamento. Capturas sintéticas
desktop/celular no [registro de Pedidos](../features/pedidos/EXECUCAO.md); aprovação
visual humana permanece pendente, sem confundir QA com essa aprovação.

## Pedido e preço de Produtos — 07/10/2026 — Em revisão visual

`QuantidadeEscolha` reutiliza Button/Input no Pedido e no simulador; soma e repetição
do grupo determinam as adições permitidas. `MensagemPendenciaFormulario` reutiliza
o estado inválido e mensagens persistentes, abre detalhes e conduz foco/rolagem.
Ambos têm entradas/demonstrações no catálogo tipado, sem novo token de base.
Preço de Produtos reutiliza CurrencyInput/AcoesEdicao somenteConfirmar, com campo
menor, check adjacente apenas na edição e espaço reservado antes do status.
Contrato no [manual](padroes.md); validação em [Execução de Vendas](../execucao-vendas.md).

## Brasil NFe — Marco 1 — 10/10/2026 — Em revisão visual

`/configuracoes/integracoes` preserva o cartão MCP e apresenta Brasil NFe conforme a
permissão central de cada integração. `/configuracoes/integracoes/brasilnfe` reutiliza
`BarraAcoes`, `GrupoAcoes`, `Card`, `Label`, `Input`, `Button` e `Badge`, sem variantes
ou tokens novos. Os campos de credenciais ficam vazios na leitura e aceitam apenas
substituições; o salvamento é explícito e a validação consulta a configuração já
salva. Emitente vem de Dados da empresa, sem segundo cadastro. Ambiente, acesso,
pré-requisitos, homologação pendente e produção bloqueada têm textos próprios.

Consumidores: `testes/fiscal-saida/brasilnfe-interface.test.tsx` e
`testes/layout/brasilnfe-integracoes.test.tsx`. Prévia isolada:
`testes/visual/brasilnfe.html` / `brasilnfe.vite.config.mts`, somente empresa fictícia e
ações simuladas. Capturas examinadas em 1366 e 390 pixels, temas claro/escuro e perfil
somente leitura: `testes/visual/evidencias/brasilnfe-m1-desktop.png`,
`brasilnfe-m1-mobile.png`, `brasilnfe-m1-diagnostico-escuro.png` e
`brasilnfe-m1-leitura.png`. Sem rolagem horizontal da página nesses tamanhos; console
sem erros na prévia. Evidência visual não comprova autorização fiscal externa nem
homologação. Referência permanece **Em revisão** até aprovação humana.

## Complementos — 04/10/2026 — Em revisão visual

Correção de 05/10: grupo aberto no produto usa toda a largura abaixo do cabeçalho. Linha compartilhada por Produtos/Grupos mantém nome/preço/status/X no mesmo eixo, com respiro compacto e rolagem interna quando necessário. Expansão acessível por teclado preserva os campos em edição; composição continua abaixo. Prévia fictícia inclui Charcutarias com seis escolhas para conferir o caso relatado.

Abas e lista em `vendas/catalogo` reutilizam Tabs buttons, CampoBusca, Select, Table/SortableTableHead, StatusCadastroVenda e GrupoAcoes. Editor simples reutiliza ComposicaoProduto/ComposicaoPicker sem FM. Linha de opção mantém nome/preço/status/X e expansão discreta como Clientes/Fornecedores; composição abaixo usa a grade compartilhada Ingrediente/Porção/Descrição/Qtd./Custo. Remoção de rascunho usa BotaoRemoverItem, com salvamento explícito. Pausa de produto abre Dialog descendente para escolher alcance e mantém foco/rascunho; gravação ocorre em Salvar. Sem nova variante/token/primitiva. Prévia sintética de Vendas inclui fontes de Insumos para renderizar os pontos de quebra reais do editor compartilhado.

## Tabela de Porções — popups e ordenação — 04/10/2026 — Em revisão visual

`porcoes/porcoes-table.tsx` mantém a leitura da tabela na tela principal; Nova porção
e Editar usam o mesmo Dialog, campos delimitados e proteção central de descarte.
`BarraAcoes`, `CampoBusca`, `SelecaoFormulario`, `SortableTableHead`, Table e Button
existentes organizam ações, busca e ordenação A–Z/Z–A de categorias/insumos.
`porcoes/ordem-categorias.tsx` reutiliza Dialog e `ListaOrdenavel` com salvamento
explícito, conforme a ordenação de Produtos. Nenhum novo token, variante ou padrão.
O escopo completo da lista é formado pelas categorias com porções não removidas;
busca da tabela não reduz esse conjunto. Criar/remover porções atualiza a lista.
Contrato de persistência no [guia de Insumos](../modulos/insumos.md#tabela-de-porções).
Prévia com dados fictícios em desktop/celular; referência Em revisão humana.

## Ficha técnica de produto em uma folha — 04/10/2026 — Em revisão visual

EX-IMP-03: documento físico de Produtos em A4 paisagem, margens de 8 mm e área
de conteúdo de 281 × 193 mm (reserva de 1 mm na altura). `src/lib/vendas/ficha.ts`
preserva a identidade física existente e `ficha-a4.ts` ajusta a escala sem truncar
conteúdo. Prévia responde à largura da tela; impressão recalcula para o papel.
Coluna da foto de 90 mm com categorias, preparo e observações abaixo. Tabela separa
Ingrediente/Categoria/Porção/Qtd.; nome em 13 pt, categoria em 8 pt/cor secundária.
Dialog, Button e foco existentes são preservados, sem token/variante nova.
Seis PDFs sintéticos conferidos em Chromium/Poppler: uma página, orientação,
último ingrediente/escolha, observação e rodapé presentes. Não homologa driver
ou impressora física; fichas excessivamente extensas reduzem o tamanho da fonte.

## Composição — 04/10/2026 — Em revisão visual

`ComposicaoPicker`, compartilhado por Insumos e Produtos, prioriza a largura do
ingrediente na grade existente. Inclusão, cabeçalho e linhas usam as mesmas colunas;
Porção, Descrição e Custo ficam compactos, preservando Qtd. e seu sufixo. Nomes
exibem até duas linhas, com texto completo no título. Margens laterais usam 8px,
nome/FM têm respiro de 12px e Custo reserva menos espaço até o X. A ação compacta
fica centralizada em área com a altura dos campos, usando o token oficial; sua
altura menor não desloca o centro vertical em relação aos controles da linha.
Reutiliza `IdentificacaoInsumo`,
`CampoNumeroPorcoes`, `InputComSufixo`, `ListaOrdenavel` e Button, sem novo token,
variante ou padrão. Contrato no [guia de Insumos](../modulos/insumos.md#tabela-de-porções).
Prévia isolada com dados fictícios conferida em desktop e celular; referência
permanece Em revisão até aprovação humana.

## Comanda térmica de Pedidos — 03/10/2026 — Em revisão visual

`src/lib/vendas/impressao-pedido.ts` centraliza o HTML de impressão do Gestor,
Quadros e produção/resumo operacional. Bobina de 80 mm com área útil de 72 mm,
margens de 4 mm e altura definida pelo driver; sem impor A4 à impressão térmica.
Número, data/janela, quantidade e observações usam preto sólido e texto branco,
com print-color-adjust exact. Itens/complementos quebram textos longos, observações
preservam linhas e o documento não limita a quantidade de itens.

EX-IMP-02: geometria física e fonte monoespaçada da comanda HTML de Pedidos,
limitadas ao documento de impressão; não alteram botões/tokens administrativos.
Reutiliza Button default/outline e aria-pressed na escolha de formato, Dialog e
feedback de impressão existentes. Produção inicia em 80 mm e mantém A4 opcional;
conserva revisão, restrição de dados pessoais/financeiros e avisos de não preparar.
No driver, escolher papel de 80 mm, escala 100% e desativar cabeçalhos/rodapés.
Revisar com teste físico quando o equipamento estiver disponível; prévia não
comprova impressão, corte ou compatibilidade com cada driver. Referência Em revisão.

## Seleção simples e múltipla — 02/10/2026 — Em revisão visual

Contrato vigente para todos os campos de seleção e multisseleção: `SelectContent`
e `ComboboxContent` abrem abaixo do campo, alinhados ao início, afastados 4px e
sem colocar a opção sobre o gatilho. Inversão automática somente por falta de
espaço, com limites da janela. Ambos usam `bg-popover`, borda/anel primários,
`shadow-xl`, raio e movimento oficiais; o vidro permanece nos menus e diálogos.

`SelecaoFormulario`, em `src/components/ui/select.tsx`, adapta opções declaradas
para o Select compartilhado. Reutilizável nos antigos formulários nativos, conserva
`name`, `id`, `form`, `defaultValue`, `required`, `disabled`, nomes acessíveis e envio
por formulário; callbacks recebem o valor em `onValueChange`. Não duplica popup
nem altera validações, IDs ou salvamento. Consumidores: Central, Usuários,
Financeiro/Fiscal, Vendas/Pedidos, Insumos e Etiquetas, inclusive o sinal monetário.

Agrupamento reutiliza Group/GroupLabel: categorias financeiras por Grupo DRE e
natureza, produtos de Pedido por categoria comercial e complementos por categoria
do grupo. `MultiselecaoCombobox` conserva busca, chips e IDs; não força abertura
acima quando houver linhas selecionadas abaixo. PF/PJ, status e demais listas
simples continuam sem categorias artificiais.

A demonstração `selecao` em `demonstracao-padrao.tsx` apresenta seleção simples
agrupada, multisseleção agrupada e valores já marcados. O catálogo
`src/lib/design-system/grupos.ts` registra o contrato e os limites. Reutiliza
componentes e tokens existentes, sem variante visual nova; validações e evidência
de implantação constam no registro de execução. As fotografias históricas abaixo
descrevem a época da coleta e não substituem este contrato vigente.

## Clientes — 01/10/2026 — Em revisão

`/vendas/clientes` reutiliza busca, filtros imediatos com contagem, status, ordenação, paginação de 25 e expansão abaixo da linha de Insumos. Compõe `CampoBusca`, `FiltroOpcoesContadas`, `Card`, `Table`/`SortableTableHead`, `StatusCadastroVenda`/`status-ativo`, `GrupoAcoes`, `Tabs`, `EditorVenda`/`Dialog`, `MultiselecaoCombobox` e `CurrencyInput`, com proteção do rascunho e salvamento explícito.

Por solicitação explícita do usuário, os conteúdos de Clientes ficam à esquerda, inclusive quantidades e moedas na listagem e no histórico. É uma exceção ao alinhamento numérico geral do manual; reutiliza `Table` e `GrupoAcoes alinhamento="inicio"`, conserva algarismos tabulares e não altera outros consumidores.

O cadastro compartilhado com Pedidos usa Nome Completo em PF e Nome Fantasia em PJ. Cobrança usa os rótulos completos Inscrição Estadual e Inscrição Municipal, na grade responsiva de IdentidadeCobrancaForm. Data de nasc. conserva seu título completo no controle. A regra permanente de harmonia entre rótulos, linhas e colunas está na seção 5 do [manual](padroes.md#5-layout-dimensões-e-alinhamento); não há nova variante de campo.

Cadastro compõe os campos comerciais `CamposClientePedido` e `CamposEnderecoPedido`; consulta CEP e travas são compartilhadas, com autorização própria por módulo. Histórico tem carregamento, erro recuperável, vazio e link protegido ao detalhe. Não há novo padrão visual, token ou variante. Contrato no [guia de Vendas](../modulos/vendas.md#clientes--cadastro-consultas-e-condições-comerciais); prévia sintética `testes/visual/clientes.html`. Referência permanece Em revisão até aprovação humana.

`TipoClientePedido` reutiliza `Select` Base UI com Pessoa Física/Pessoa Jurídica, seleção inicial vazia e bloqueio semântico dos demais campos até a escolha. Em Novo pedido fica ao lado da busca `Combobox`; em Novo cliente antecede os dados. PF apresenta nome/sobrenome/CPF; PJ apresenta nome fantasia/razão social/CNPJ/I.E. e nomes do contato. Telefone, e-mail e data usam a mesma grade responsiva; em telas grandes ocupam 4, 5 e 3 das 12 colunas, respectivamente, dando mais espaço ao e-mail sem comprimir o telefone completo. `CampoTelefone` compõe `Input type="tel"` com a restrição oficial de máscara numérica, `maxLength` 20 e máscara `+55 (DD) NNNNN-NNNN`, sem variante nova; o crédito do cliente ao fim de Informações gerais é texto `text-xs text-muted-foreground` com `role="status"`. Referência Em revisão. Reutiliza os contratos de seleção, campos desabilitados e alinhamento; nenhum padrão novo.

## Financeiro / Cartões e Faturas — 23/09/2026

`/financeiro/cartoes`, `/faturas/[id]` e `/regras` reutilizam BarraAcoes, GrupoAcoes,
Button, Card, Table, Dialog, Checkbox, CurrencyInput, combobox Base UI e o seletor
financeiro existente. Nenhuma variante visual nova ou CSS por tela foi criado.
Confirmar classificação e pagamentos é explícito, nunca por blur. Prévia sintética
`testes/visual/faturas.html`: detalhe, sugestão e modal examinados em desktop e modal
a 390px. Referência visual em revisão; sem aprovação automática ou transações reais.

## Revisão executável — 22/09/2026

### Incremento: Configurações e Fiscal de Vendas

- `GrupoNavegacao` reutiliza a lateral expansível na variante sem página própria;
  Configurações agrupa pagamento, horários de entrega e área; Fiscal agrupa grupos
  e vínculos. O mesmo conteúdo é usado no menu móvel, filtrado por permissões.
- `/vendas/fiscal/vinculos` reutiliza `TabsList buttons`, `Input`, `Table`, `SortableTableHead`,
  `AcoesEdicao somenteConfirmar`, `CabecalhoVendas`, `Vazio` e, à época da coleta, seleção nativa de Vendas (substituída por `SelecaoFormulario` no contrato de 02/10).
  NCM/grupo são editados na linha, com check explícito verde quando há alteração
  pendente, sem texto na coluna Salvar; feedback acessível e erros junto do campo.
  Busca/filtros na mesma linha; colgroup fixo e alinhamento esquerdo nas duas abas.
  Abas usam TabsTriggerBotao e buttonVariants oficiais, sem moldura adicional.
  Produto/Categoria ordenam a consulta por cabeçalhos e aria-sort existentes;
  não há novo padrão visual nem alteração da ordem comercial do catálogo.
  Fotos seguem Produtos; categoria fica em coluna própria. Filtros por botões
  Todos/Preenchido/Pendentes seguem Fornecedores, com seleção primária e aria-pressed.
  A autorização e a validação fiscal continuam nos serviços de Vendas.
- Referência visual desta variante permanece **Em revisão** até aprovação humana.

### Consumidor: horários de entrega — 30/09/2026, Em revisão visual

`/vendas/horarios` compõe `BarraAcoes`, `GrupoAcoes`, `Card`, `Input`, `Label`,
`Checkbox` e `Select` existentes. Sete cards horizontais reorganizam controles em
telas estreitas; fechamento/cópia/exceções editam o rascunho, com Salvar/Cancelar
explícitos e feedback persistente. Não foi criada variante de controle ou token.
`HorarioEntregaCampo` reutiliza o mesmo Select em Pedidos e reagendamento; valor
histórico indisponível continua visível. Prévia isolada:
`testes/visual/horarios.html` / `horarios.vite.config.mts`, com dados e ações fictícios.
Referência visual permanece Em revisão até aprovação humana.

Incremento de simplificação: exceções por data aparecem primeiro; cada dia tem um
único Select para fechado/personalizar/copiar e horários em linhas ordenáveis por
`ListaOrdenavel`, com cabeçalhos únicos e Select compacto de largura fixa (80px).
`BotaoRemoverItem` reutiliza Button `excluir`, X e os tokens das ações compactas; nova
variante registrada no catálogo de Botões, com hover destrutivo. A origem da cópia
é preservada no JSON; editar/adicionar/remover/reordenar uma faixa torna o dia
personalizado. As chaves estáveis de arraste existem somente no rascunho da UI.

Esta seção prevalece sobre a fotografia histórica abaixo. Evidências desta execução em
`evidencias/2026-09-22`: Produtos (01), Central (02), Complementos (03), Insumos (04),
Etiquetas (05), capturadas e examinadas com dados sintéticos. Insumos estava no modo
escuro; as demais no claro. A prévia da Central foi corrigida para não renderizar o
shell recursivamente no iframe. Capturas longas do navegador possuem emendas de rolagem;
não servem como aprovação pixel a pixel. Auditoria visual inicial, não validação final.

| Rotas/família | Componente e comportamento atual | Divergência / alvo | Prioridade e validação | Migração |
| --- | --- | --- | --- | --- |
| `/configuracoes/design`, `/[grupo]`, `/laboratorio` | CentralDesign, EditorTokens, LaboratorioDesign; iframe, tokens e versões existentes | cartões e ajustes acima do exemplo; adotar três colunas, registro e cenários operáveis | P0; isolamento, pesquisa, teclado, versões | validada etapas 3/4 |
| `/vendas/produtos` | ProdutosVenda, PrecoCanal, composição, ficha; canais lado a lado | preço confirma mas não oferece cancelamento; status já existe; ações/edição compartilhadas | P0; cancelamento, conflito, filtros, fiscal direto, porção | validada etapa 5 |
| `/vendas/catalogo` | CatalogoVenda, ListaOrdenavel; grupos expansíveis | status passivo, grade baseada em viewport; usar status persistente, slots por largura útil | P0; cliques internos, 4/3/2/1 colunas, ordem teclado | validada etapa 5 |
| `/vendas/clientes`, `/formas-pagamento`, `/fiscal` | ClientesVenda, FormasPagamentoVenda, GruposFiscais | status apenas no formulário; ação compacta compartilhada, preservar restrições | P1; permissão, versão, ativo/inativo | validada no incremento da etapa 6 |
| `/vendas`, `/vendas/importacao` | visão geral, ImportacaoCatalogo | consumir bases; importação não é cadastro binário | P1; sem importação externa nos testes | validada no incremento da etapa 6 |
| `/fornecedores` | tabela/dialog, StatusAtivoSalvavel | compartilhar ações e feedback, não duplicar status existente | P1; clique interno, filtros e erro | validada no incremento da etapa 6 |
| `/insumos` (inclui Preparações) | InsumosTable/InsumoDialog; filtros, composição e conversões | status já compartilhado; ações, campos e composição sem alterar cálculo | P0; conversões, porções, ficha, formulário | validada no incremento da etapa 6 |
| `/compras`, `/notas-fiscais` | tabelas/dialogs, pedidos e manifesto | estados de processo não viram switch; componentes base | P1; aceite/recusa preservados, integração externa desligada | validada no incremento da etapa 6 |
| `/inventario`, `/movimentacoes`, `/perdas`, `/entrada-avulsa`, `/contagem`, `/contagem/[id]` | tabelas e formulários de movimentação/contagem | base compartilhada; estoque não é estado binário; navegação agrupada já existente | P1; cálculos, foco, filtros, sem movimento real | validada no incremento da etapa 6 |
| `/financeiro`, `/plano-de-contas`, `/bancario`, `/contas`, `/manifesto-nfs`, `/lancamentos`, `/movimentacoes`, `/fluxo-de-caixa` | cadastros e processos financeiros; algumas rotas redirecionam | status só nos cadastros; preservar cores entrada/saída, gráficos e regras fiscais | P1; autorização, parcelas, redirects | validada no incremento da etapa 6 |
| `/configuracoes`, `/usuarios`, `/empresa`, `/perfil` | configurações, usuários e perfil | controles compartilhados, não converter autorização em preferência visual | P1; guardas, formulário e erro | validada no incremento da etapa 6 |
| `/producao`, `/producao/etiquetas` + host dedicado | EtiquetasModulo, MenuEtiquetas, fluxo de emissão | mesma estrutura e tokens; preservar estados/auditoria/BrowserPrint/ZPL | P0; identidade laranja, mesmas dimensões, sem hardware | validada no incremento da etapa 6 |
| `/rh`, `/crm`, `/patrimonio`, `/sem-acesso` | páginas de entrada/indisponibilidade e acesso | não inventar cadastros; revisar bases/estado vazio | P2; navegação e leitura | validada no incremento da etapa 6 |

Escopo: 38 arquivos page.tsx encontrados por `rg`, agrupados acima; segmentos entre
barras herdam o prefixo da família. Não são 38 fluxos já testados. O inventário histórico
abaixo contém fontes e diferenças adicionais; sua evidência de 21/09 não é teste desta execução.

### Migração verificada nesta execução

- Central, Produtos e Complementos: etapas 3–5 validadas; detalhes e limites em VALIDACAO.md.
- Fornecedores/Beneficiários: barra e grupo de ações compartilhados, exclusão compacta,
  status e ações respeitando acesso visual (servidor mantém as guardas). 14 testes de
  cadastros passaram; edição abriu sem expandir linha, abas alternaram com dados fictícios;
  captura 13 examinada; ESLint passou. Importação externa não executada.
- Insumos/Preparações: ações compactas e barra compartilhadas, permissões visuais,
  seleção com token comum, ações de composição e passos acessíveis; corrigido p contendo
  div no resumo. Captura 14: composição 0,2 kg/2 fatias salva, custo R$ 4,00 no banco
  fictício. 63 testes passaram no conjunto; o único timeout restante passou isoladamente
  (2/2) após trocar digitação letra a letra do nome fictício por colagem. Nenhuma asserção
  nem limite foi removido. As 12 integrações opt-in passaram na validação final de 23/09.

- Comerciais (Clientes, Grupos fiscais, Formas de pagamento): status comum com permissão,
  versão e auditoria; ações compactas agrupadas. Persistência preserva endereços, fiscal e
  taxas. Capturas 15 (1280), 16/17 (1440) examinadas; PIX fictício inativado e confirmado
  após recarga. Edição de cliente/fiscal abriu diretamente. 41 testes direcionados + 5
  testes de status/exclusão passaram, além dos demais testes comerciais da execução ampla.
  Visão geral mantém navegação por permissão; Importação conserva prévia, confirmação e
  conflito (testes existentes passaram); nenhum acesso a plataforma externa.
- Configurações/Empresa/Perfil: status de usuário com confirmação e guardas preservadas;
  abas, ações e cabeçalhos comuns; rótulos e falhas de formulário corrigidos. Integração
  de acesso, componentes, 104 fronteiras e capturas 18–20 descritos em VALIDACAO.md.
  `/configuracoes` continua redirecionando por acesso; certificado não foi enviado nem
  substituído. Preferências visuais não concedem permissões.

- Financeiro: 281 testes gerais + 24 integrações de conciliação + sete de plano + três
  novos de formulários; capturas 24/25, detalhes em VALIDACAO.md.
- Compras/Notas: 169 testes gerais, reteste 11/11, 31 integrações; contratos específicos
  preservados. Capturas 26/27 e correções das fixtures descritas em VALIDACAO.md.
- Entradas/indisponibilidade: nove testes novos de guardas/links/estrutura e suíte de
  navegação passaram. Produção deixa de ser vazia e aponta ao módulo único de Etiquetas.

### Exceções de domínio

Inventário: seis rotas revisadas, layout/locais/entrada/contagens/perdas migrados nos
contratos cabíveis. Posição e extrato mantêm bases já compartilhadas e cálculos; testes
de filtros/detalhes cobertos. 76 testes + 44 integrações, capturas 22/23 e limites em
VALIDACAO.md. Locais e contagem confirmam explicitamente; categorias usam status comum.

Etapas 6 / Etiquetas: abas Base UI com teclado/painel associado, checkboxes e seleção
nativa compartilhados; botão Imprimir usa primário da identidade, sem vermelho avulso;
filtros de validade rotulados. 102 testes passaram (incluindo seis integrações PG),
cinco HTTP de build local aguardam etapa 8. Captura 21 examinada; formulário preserva
entrada ao receber erro simulado. Nada enviado a impressora/Raspberry. ESLint passou.

- EX-ENT-01: RH e Patrimônio não possuem cadastros implementados; usam o mesmo
  ModuleComingSoon com cabeçalho/Card compartilhados. Testados título, guarda e ausência
  de formulário fictício. Revisar quando houver implementação funcional desses módulos.
  CRM foi incorporado a Vendas & CRM em 09/10/2026; `/crm` é compatibilidade protegida
  para `/vendas/atendimento`. Navegação usa componentes existentes e nenhuma variante nova.
- EX-IMP-01: ZPL/dimensões físicas/fonte de impressão em Etiquetas. Revisar somente com
  requisito de impressão e teste de hardware, nunca para acomodar layout administrativo.
- EX-DOM-01: cores de entrada/saída/SEFAZ e estados de processo em Financeiro/Notas.
  Revisão exige contrato do domínio; não dependem da cor primária da marca.
- EX-TAB-01: rolagem horizontal interna de tabelas com canais/colunas contábeis. Não é
  autorização para overflow do documento. Revisar em cada viewport da etapa 8.

## Fotografia histórica — etapa 1

O restante deste inventário descreve a inspeção inicial de 21/09/2026. Afirmações como
"ainda não existe" e propostas de migração abaixo não descrevem necessariamente o código
atual; consultar a revisão executável acima e o [índice operacional](README.md).

**Etapa:** 1 — referência inicial.
**Data da inspeção:** 21/09/2026.
**Escopo:** código do checkout atual e prévias locais com dados fictícios. Não houve mudança de interface, autenticação, permissões, dados ou infraestrutura.

## Como ler as evidências

| Marca | Significado |
| --- | --- |
| **Observado no código** | Arquivo e seletor/componente foram lidos nesta etapa. |
| **Verificado visualmente** | Prévia local aberta nesta etapa, com dados fictícios. |
| **Testado** | Comportamento exercitado nesta etapa. Só aparece quando houve interação deliberada. |
| **Proposto** | Decisão para etapa posterior; não existe no produto atual. |

Não há percentuais de cobertura: o repositório ainda tem estilos locais e não há um denominador de componentes já conectados a uma Central de Design.

## Fundamentos

| Padrão | Evidência e valores observados | Uso, diferenças e riscos |
| --- | --- | --- |
| HUB claro | **Observado no código:** `src/app/globals.css`, `:root`: `--background #f2f4f8`, `--foreground #0b1d37`, `--primary #0865d5`, `--ring #2d7ff6`, `--radius 1rem`; marca `#0b1d37`, `#2d7ff6`, `#e6f0ff`. | Compartilhado via variáveis CSS. Consumido pelos componentes `ui/*` e pelo layout. **Verificado visualmente:** `testes/visual/layout.html`, em 127.0.0.1:4173, mostrou navegação azul-marinho, ação azul e superfície clara. |
| HUB escuro | **Observado no código:** `src/app/globals.css`, `.dark`: fundo `#101722`, card/popover `#1b2534`, primário `#83b7ff`, borda `oklch(1 0 0 / 10%)`; `src/app/layout.tsx` usa `next-themes` com `attribute="class"`, `defaultTheme="system"` e `enableSystem`. | Compartilhado, mas há cores diretas locais em módulos. **Pendente:** inspeção visual e contraste composto no navegador. |
| Etiquetas claro | **Observado no código:** `src/app/globals.css`, `[data-identidade="etiquetas"]`: marca `#39291f`, cor de destaque `#cc4c13`, primário `#b9430c`, fundo `#faf6f1`, borda `#e8dcd0`. `src/app/layout.tsx` define o atributo pelo host. | Mesma estrutura e componentes do HUB; somente variáveis de identidade. **Verificado visualmente:** `testes/visual/etiquetas.html` mostrou lateral marrom/laranja e ação ativa laranja. |
| Etiquetas escuro | **Observado no código:** `.dark [data-identidade="etiquetas"]`: fundo `#201913`, card/popover `#2e241e`, primário `#ffab78`, `--vidro-fundo rgb(46 36 30 / 94%)`. | Difere nas cores, não em escala tipográfica nem largura lateral. **Pendente:** inspeção visual e contraste composto. |
| Tipografia | **Observado no código:** `@theme inline` em `src/app/globals.css`: sans `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; mono `ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace`; título usa a mesma sans. `text-stat`: `clamp(1.75rem, 2.5vw, 2.25rem)`, linha `2.75rem`, peso `600`; `text-display`: `clamp(1.6rem, 2.3vw, 2rem)`, linha `1.2`, peso `600`; `text-title`: `1.125rem/1.5rem/600`; `text-label`: `.75rem/1rem/500`, espaçamento `.04em`. | Compartilhado. Controles usam `text-sm`; tabela usa `text-[13px]` e chips de multisseleção usam `text-[10px]`: exceções locais a preservar antes de tokenizar. |
| Superfície e vidro | **Observado na etapa 1:** `.vidro-painel` usa `--vidro-fundo`, borda `--vidro-borda`, `blur(24px) saturate(140%)`; `.menu-lateral` mede `16rem`, raio `1.5rem` e o acabamento final usa `blur(32px) saturate(160%)`. Claro: menu `rgb(11 29 55 / 86%)`; Etiquetas muda a base para `rgb(98 40 16 / 86%)`. | Na coleta, layout, diálogos, dropdown e Select compartilhavam vidro; Combobox possuía superfície própria. Desde 02/10, Select e Combobox compartilham a superfície de seleção descrita no contrato vigente acima. Menus e diálogos mantêm vidro. |
| Sombra e raio | **Observado no código:** `--radius 1rem`; raios derivados `0.6×`, `0.8×`, `1×`, `1.4×`, `1.8×`, `2.2×`, `2.6×`; sombras `--shadow-xs` até `--shadow-lg` e `--shadow-panel` em `src/app/globals.css`. | Tokens globais, mas há raios e sombras locais (`rounded-[4px]` em checkbox; `shadow-xl` em diálogo/combobox). Inventariar antes de substituir. |

## Estrutura, layout e responsividade

| Padrão | Evidência e valores observados | Uso, diferenças e riscos |
| --- | --- | --- |
| Moldura principal | **Observado no código:** `.estrutura-sistema` é flex, `gap: 1rem`, `padding: 1rem`; `.painel-sistema` tem `min-width: 0`; `.conteudo-sistema` tem `padding: 2rem 1rem`. `src/app/(protegido)/layout.tsx` usa essa moldura, `Sidebar` ou `MenuEtiquetas`, `Header` e `main#conteudo-principal`. | Compartilhado entre HUB e Etiquetas dedicadas. **Verificado visualmente:** ambas as prévias confirmaram lateral, cabeçalho e conteúdo na mesma composição. |
| Lateral e cabeçalho | **Observado no código:** `.menu-lateral` é sticky, `top: 1rem`, largura `16rem`, altura `calc(100dvh - 2rem)`; `.cabecalho-sistema` é sticky, `min-height: 4.5rem`, `padding: .75rem 1.5rem`, raio `1.5rem`. | Compartilhado. O menu dedicado usa `MenuEtiquetas` e adiciona `menu-etiquetas`; não cria uma segunda coluna. |
| Móvel e toque | **Observado no código:** até `767px` a lateral desktop é oculta, a estrutura usa `.5rem`, cabeçalho `4rem` e conteúdo `1.5rem .5rem`; inputs/textarea/combobox vão a `1rem`. `@media (pointer: coarse)` aplica mínimo `2.75rem` a botões, gatilhos e itens de lista. `src/components/layout/navegacao-movel.tsx` é a contrapartida móvel do menu. | Compartilhado. **Pendente:** reflow real de tabelas extensas e de uma futura navegação expansível. `Table` usa `overflow-x-auto` de propósito no contêiner, portanto não é prova de que cada tela evita rolagem horizontal. |
| Inventário local | **Observado no código:** `src/app/(protegido)/inventario/layout.tsx` inclui `InventarioNav`; `inventario-nav.tsx` apresenta cinco links em `flex flex-wrap gap-1.5`. | É uma navegação horizontal local, não um grupo expansível na lateral. Esta divergência é importante para a decisão aprovada de etapa futura. |

## Componentes de interação

| Família | Origem, valores e comportamento observados | Onde aparece / diferenças / risco |
| --- | --- | --- |
| Botões | **Observado no código:** `src/components/ui/button.tsx`, Base UI + CVA. Variantes `default`, `outline`, `secondary`, `ghost`, `destructive`, `entrada`, `entrada-outline`, `saida`, `saida-outline`, `link`. Base: `rounded-full`, `text-sm`, peso `600`, transição `150ms`; tamanhos: `h-11`, `h-8`, `h-6` e ícones `11/8/6`. | Compartilhado e importado em telas de suprimentos, financeiro, inventário, configurações e etiquetas. Exceção: `nota-fiscal-dialog.tsx` usa classes `red-700`/`emerald-700` para ações de manifesto. Centralizar sem mapear essas ações fiscais poderia trocar semântica visual já acordada. |
| Campo de texto e moeda | **Observado no código:** `ui/input.tsx` usa `h-11`, `rounded-md`, `px-4`, `py-2.5`, `text-sm`, peso médio, `bg-card`; estado inválido usa borda/anel destrutivo. `ui/currency-input.tsx` e `ui/input-com-sufixo.tsx` são extensões locais; `filtro-periodo.tsx` é composição de período. | Base compartilhada; extensões devem reutilizar o contrato visual de `Input`. **Pendente:** inventário de todos os campos específicos de domínio e erros de máscara. |
| Checkbox | **Observado no código:** `ui/checkbox.tsx`, Base UI, quadrado `size-4`, raio `4px`, indicador `3.5`, foco `ring-3`; pseudoárea de interação `after:-inset-x-3 after:-inset-y-2`. | Compartilhado. A medida visual é menor que a área de toque declarada; verificar em dispositivo real e leitor de tela antes de alterar. |
| Select simples | **Observado na etapa 1:** `ui/select.tsx`, Base UI. Gatilho padrão `h-11`, compacto `h-8`, `rounded-md`; conteúdo portalizado, `sideOffset=4`, largura do gatilho ou `ampla` (`min(36rem, var(--available-width))`); itens têm opção `quebrarTexto`. | A coleta registrou vidro e alinhamento ao item. Contrato vigente de 02/10: popup abaixo/início, sem alinhamento ao item e com a mesma superfície de Combobox. Os testes descritos nesta fotografia histórica não são a validação atual. |
| Combobox | **Observado na etapa 1:** `ui/combobox.tsx`, Base UI; input `h-11`, ícone de busca e chevron; popup com largura da âncora, `min-w-48`, `sideOffset=4`, anel primário e `shadow-xl`; vazio padrão “Nenhum resultado encontrado.” | `categoria-financeira-combobox.tsx`, `insumo-combobox.tsx`, `fornecedor-combobox.tsx` especializam dados e largura. A diferença histórica de superfície em relação ao Select foi substituída pelo contrato comum de 02/10. |
| Multisseleção | **Observado no código:** `src/components/multiselecao-combobox.tsx`; reutiliza o combobox com `multiple`, preserva IDs, busca insensível a acento, não altera valores com `escape-key`, mostra chips com `BotaoRemoverItem` e status textual. | Compartilhado em formulários de fornecedores/insumos, regras de Clientes e categorias de Produtos. Categorias inativas vinculadas permanecem identificadas; escolhas alteram só o rascunho. Exceções: descrição de chip `text-[10px]`, `max-h-64`. **Pendente:** muitas escolhas em leitor de tela. |
| Filtros categóricos com contagem | `src/components/filtro-opcoes-contadas.tsx`, referência `filtros-contados` na Central, **Em revisão**. Opções exigem quantidade, usam Button e `aria-pressed`; busca e demais filtros participam da contagem antes da paginação. | Clientes PF/PJ/Todos, tipos de Insumos e Posição de estoque. Zero permanece acionável; não usar como escolha de formulário. |
| Diálogo | **Observado no código:** `ui/dialog.tsx`, Base UI. Conteúdo padrão `max-w-[calc(100%-2rem)]`, em `sm` `max-w-sm`, raio `xl`, vidro, overlay com blur; botão X é `icon-sm`. A proteção contra descarte observa `input`, `change` e controles e abre AlertDialog “Sair sem salvar?” em portal centralizado fora da rolagem. | Compartilhado em cadastros e fluxos. Há tamanhos por tela (`sm:max-w-4xl`, `sm:max-w-3xl` etc.). Não transformar tudo em um único tamanho. |
| Menu | **Observado no código:** `ui/dropdown-menu.tsx`, Base UI; popup portalizado, largura da âncora, mínimo `8rem`, `sideOffset=4`, vidro, `rounded-lg`, itens `text-sm`; suporta submenus, checkbox e rádio. | Compartilhado por seletor de módulos, aparência e conta. **Verificado visualmente:** gatilhos de aparência e conta estão presentes nas duas prévias; não houve abertura nesta etapa. |
| Abas | **Observado no código:** `ui/tabs.tsx`, Base UI; lista padrão `h-10`, `rounded-lg`, preenchimento `3px`; variante `line`; gatilhos `text-sm`, ativo com superfície ou linha de `.5`. `globals.css` permite rolagem horizontal da lista. | Compartilhado. Inventário usa botões como subnavegação, enquanto Etiquetas usa Tabs; são padrões distintos hoje. |
| Tabela | **Observado no código:** `ui/table.tsx`: contêiner `overflow-x-auto`, fonte `13px`, cabeçalho `h-9`, células `px-3 py-3`, números tabulares globais, `SortableTableHead` define `aria-sort`. | Compartilhado. Tabelas de Etiquetas têm `min-w-[900px]` local; alguns módulos definem seus próprios vazios e ações. Manter a rolagem no contêiner e revisar cada largura antes de criar regra global. |
| Badge e status | **Observado no código:** `ui/badge.tsx`, `h-5`, `text-xs`, variantes semânticas (`success`, `warning`, `destructive`, etc.). `src/components/status-ativo.tsx` usa esmeralda diretamente; outros módulos também usam amber/emerald/red locais. | Parcialmente compartilhado. Risco: cores de estado duplicadas fora das variáveis `success`, `warning`, `destructive`. |
| Feedback | **Observado no código:** `ui/sonner.tsx` recebe tema do `next-themes`, usa tokens de popover/borda/raio e ícones para sucesso, informação, aviso, erro e carregamento. `role="alert"` é usado em formulários e `aria-live="polite"` em, por exemplo, `inventario/posicao-atual-table.tsx` e `perdas/perda-dialog.tsx`. | Toasts são recorrentes, mas não únicos: erros inline e estados vazios são locais. Não há catálogo central de mensagens ou de empty states. |

## Acessibilidade e interação

| Aspecto | Evidência observada | Verificação pendente ou risco |
| --- | --- | --- |
| Foco | **Observado no código:** `globals.css` aplica `:focus-visible` com `outline: 2px solid var(--ring)` e offset `3px`; controles compartilhados adicionam anéis próprios. | **Pendente:** foco não encoberto em diálogo, dropdown, lateral e cabeçalho sticky. |
| Teclado | **Observado no código:** primitives vêm de `@base-ui/react`; `Select`, `Combobox`, `Dialog`, menu e Tabs preservam seus primitives. Multisseleção ignora `escape-key` na mudança de valor. | **Não testado:** Tab, setas, Enter, Escape por camadas, retorno de foco e submenu. Não inferir conformidade só da biblioteca. |
| Estrutura semântica | **Observado no código:** atalho “Ir para o conteúdo”, `main#conteudo-principal`, `aria-current="page"` em links, rótulos para ícones de menu/fechar, `aria-sort` em coluna ordenável. | **Verificado visualmente:** o atalho e a estrutura principal estão no DOM da prévia do HUB. **Pendente:** nomes acessíveis de todas as ações apenas com ícone. |
| Preferências | **Observado no código:** `prefers-reduced-transparency`, `prefers-contrast`, fallback sem `backdrop-filter`, `prefers-reduced-motion` e `forced-colors` em `globals.css`. | **Não testado:** cada mídia no navegador, alto contraste do sistema, zoom/reflow e leitor de tela. |

## Divergências, duplicações e pendências priorizadas

1. **Alta — registrar os tokens sem alterar o resultado:** botões, input, select, combobox, multisseleção, diálogo e a estrutura compartilhada já têm fontes definidas; ainda misturam valores em CSS global, CVA e classes locais.
2. **Alta — preservar as exceções semânticas:** aceite/recusa no manifesto e estados financeiros usam cores locais fortes; mapeá-los como variante/uso de domínio antes de qualquer consolidação.
3. **Alta — não assumir autorização para a Central:** o catálogo não contém `configuracoes.design` e a rota `/configuracoes/design` não existe. A etapa 2 deve decidir e implementar permissão própria no servidor; não reutilizar silenciosamente `configuracoes.usuarios`.
4. **Histórico — diferenciar popovers:** na coleta, Select/dropdown usavam vidro e Combobox possuía borda/anel/sombra próprios. Em 02/10, a família de seleção adotou a superfície comum de Combobox; menus e diálogos conservam vidro.
5. **Média — validar acessibilidade em navegador:** foco, teclado, contraste composto sobre vidro, movimento/transparência reduzidos, alto contraste, zoom e leitor de tela continuam pendentes.
6. **Média — consolidar feedback gradualmente:** `Sonner` é compartilhado, mas erros, vazios e cores de status são locais. Não trocar textos nem regras de negócio nesta centralização.
7. **Baixa — revisar tamanhos locais de leitura:** `10px`, `11px`, `13px`, tabelas de `900px` e diálogos largos devem ser classificados por finalidade, não substituídos em lote.

## Arquivos que a Etapa 2 deve usar

- Estrutura e temas: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(protegido)/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/menu-etiquetas.tsx`, `src/components/layout/cabecalho-conteudo.tsx`, `src/components/layout/navegacao-movel.tsx` e `src/components/layout/seletor-aparencia.tsx`.
- Controles reais: `src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `combobox.tsx`, `checkbox.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `table.tsx`, `badge.tsx`, `sonner.tsx` e `src/components/multiselecao-combobox.tsx`.
- Navegação e acesso: `src/lib/modules.ts`, `src/lib/permissoes/catalogo.ts`, `src/lib/permissoes/servidor.ts`, `src/components/layout/acesso-contexto.tsx`.
- Cenários fictícios para conferir aparência sem operações: `testes/visual/layout.*`, `testes/visual/etiquetas.*`, `testes/visual/vite.config.mts`.

## Gestor de pedidos dedicado — 30/09/2026

| Consumidor | Componentes e contratos | Situação |
| --- | --- | --- |
| `pedidos.grazinghub.com.br/vendas/pedidos` | CampoBusca arredondado, Select/Combobox, Popover, TagCanalVenda, Card, Table, Button icon-sm e BarraAcoes compacta/GrupoAcoes; quatro etapas e calendário/lista; shell compacto verde sem lateral (DS-PED-COMPACTO-01) | padrão visualizacoes-operacionais **Em revisão**; prévia `testes/visual/gestor.*` com dados fictícios |

Cores de processo e comportamento sequencial estão em [padrões](padroes.md).
A primeira entrega, estoque e financeiro não são desfeitos ao retornar etapa.

## Novo Pedido e detalhe — cadastro e proteção de descarte, Em revisão visual

Consumidores: `editor-pedido.tsx`, `novo-cliente-pedido.tsx`,
`endereco-pedido-form.tsx`, `@modal/(.)novo/modal-novo-pedido.tsx`,
`modal-pedido.tsx` (`ModalPedido`) e `[id]/conteudo.tsx` em
`src/app/(protegido)/vendas/pedidos`. Reutiliza Dialog, Button ghost/icon, Input,
Select, Combobox, CurrencyInput, Textarea, Campo e HorarioEntregaCampo. Quatro
seções no Novo Pedido, cadastro sempre visível, grade responsiva e indicação de
preenchimento sem novos tokens. `ConfirmacaoDescarteDialogo` é reutilizada por `Dialog` e `ModalPedido`
em Novo Pedido e detalhe: alerta de saída em portal fixo fora da área rolável,
única sobreposição modal autorizada; conserva formulário, rascunho e foco. O contexto
registra alterações e salvamentos explícitos por parte; os demais `Dialog` usam a mesma confirmação. Filhos comuns ocultam o pai sem desmontá-lo;
fluxo de caixa, usuários e simulador compõem os filhos na árvore do editor. Contrato atualizado em 02/10/2026;
referência visual permanece **Em revisão**.

## Formulário comercial compacto e canais, 01/10/2026

Novo Pedido reutiliza Button, Combobox, Select, Input, CurrencyInput e BadgeDollarSign
no padrão de desconto de Produtos. Títulos text-title ficam fora das superfícies;
linhas de itens compactas conservam nomes acessíveis e observação expandível.
Veículo e frete usam `EscolhaEntrega`/`CampoEntrega`, `Select`, `CurrencyInput` e
`Badge` warning em uma linha após os produtos, com detalhes/justificativas no
`Dialog` local e pendências persistentes. Sem embalagem editável no pedido,
nova primitiva ou token; composição no padrão existente, **Em revisão** visual.
SelecaoCanalVenda usa Button sm, seleção única aria-pressed e tokens tipados
cor.canal.site/ifood/gf/texto; demo canais-venda no catálogo, Em revisão visual.
Cores informadas pelo usuário: Site azul, iFood vermelho, GF roxo; os demais canais
usam seleção primária padrão. A referência não altera contratos comerciais.

## Controles do Gestor compacto — 01/10/2026, Em revisão visual

| Padrão | Fonte e contrato | Consumidor |
| --- | --- | --- |
| busca-operacional | campo-busca.tsx; formato tipado padrao/arredondado, limpar acessível; atraso/URL pertencem ao consumidor | Gestor de pedidos |
| filtros-ancorados | ui/popover.tsx; Base UI, portal/foco/Escape, 240px, até 400px; variantes simples imediata e complexa com Aplicar/Limpar | FiltroCanalVenda e formulários complexos |
| tags-canais-venda | tag-canal-venda.tsx sobre Badge; Site/iFood/GF, aliases exatos, original no title, desconhecidos neutros | Cartão do Gestor |
| barra-operacional-compacta | padroes-operacionais.tsx; variante compacta, h1 acessível, busca e ações na linha com quebra responsiva | Gestor e demonstração sintética |

Shell: layout protegido e CabecalhoConteudo exclusivos de data-identidade=pedidos;
HUB/Etiquetas preservam a moldura anterior. Padrões demonstrados em
src/components/design-system/demonstracao-padrao.tsx; sem dados reais, busca ao
banco, envio de impressão ou ações comerciais. Registro não equivale a validação
visual humana ou implantação; evidências ficam no registro da execução.

## Canal imediato e seletor de visualização — 01/10/2026, Em revisão

| Padrão | Componente e contrato | Consumidor |
| --- | --- | --- |
| filtro-canal-imediato | filtro-canal-venda.tsx; Popover/Checkbox, um canal, clique imediato, check persistente, Todos/desmarcar remove, preserva selecionado fora do catálogo | Gestor e demonstração sintética |
| seletor-visualizacao-operacional | seletor-visualizacao-operacional.tsx; Select compacto fechado, só cor do gatilho verde/azul/violeta; status/layout preservados | Gestor e demonstração sintética |

O popup do Gestor não contém status, situação, cliente, produto, datas ou botões
Aplicar/Limpar. Contrato complexo continua separado. Identificação de cliente/número
usa text-title/font-semibold; destinatário text-sm/font-semibold, sem novos tokens.
Teste real de FiltroCanalVenda cobre cliques da linha, exclusividade, remoção, teclado,
Escape/foco/outside, catálogo vazio, selecionado ausente e desabilitado, com dados fictícios.

## Configuração de estoque do Gestor — 01/10/2026, Em revisão

| Padrão reutilizado | Contrato/componente | Consumidor |
| --- | --- | --- |
| Ação compacta | Button ghost/icon-sm, engrenagem com nome/tooltip, GrupoAcoes | configurar-estoque-gestor.tsx no Gestor |
| Status ativo de formulário | StatusAtivo nomeado, rascunho local e Salvar explícito, bloqueio com motivo acessível | Movimentar estoque |
| Seleção oficial | Label/Select/SelectItem quebrarTexto, escolha explícita, opção salva indisponível preservada | Local de estoque |
| Diálogo com proteção | Dialog alterado opcional para campos controlados/em portal; omitido mantém detecção padrão e mesma confirmação | Popup de estoque, teste do Dialog |

Sem nova variante visual ou token. Permissão vem da consulta do servidor; não há
salvamento ao alternar ou perder foco. Fechamento durante gravação é bloqueado,
erro conserva rascunho e sucesso restaura foco. Busca/canal/modo/URL permanecem.
Testes reais em testes/componentes/dialog.test.tsx e
testes/vendas/pedidos-gestor-estoque-interface.test.tsx cobrem proteção explícita e
padrão, local obrigatório/indisponível, permissões, trava, erro, nova tentativa e
respostas atrasadas. Conteúdo servidor e integração do Gestor têm consumidores
focados próprios; a prévia usa somente fixtures sintéticas.

Clientes / Pedidos — cadastro sincronizado: `vendas/pedidos/cadastro-cliente-form.tsx` compõe os mesmos CamposClientePedido, CamposEnderecoPedido, Campo/Input/Select/Combobox, cartões e Dialog de largura de pedido. Cobrança e Entrega usam Combobox com busca e rótulos completos de titular/destinatário e endereço. O Button icon-sm oficial + abre formulário temporário; a inclusão exige os campos obrigatórios e endereço postal único no respectivo livro. Itens preenchidos usam confirmação em Dialog antes da remoção pelo X oficial; Principal é indeletável. Abas principais do editor usam buttons/TabsTriggerBotao. Nenhum token ou variante novo. Composição reutilizável documentada em padrões; referência visual **Em revisão**.

Em Novo Pedido/orçamento, o cadastro selecionado permite editar dados gerais com
permissão de edição de Clientes; `CamposClientePedido.emailSomenteLeitura` mantém
apenas o e-mail travado pela identidade do cliente. Reutiliza Input readOnly e title
explicativo, Select e a mesma grade, sem padrão visual novo. Dados, cobrança e entrega
padrão efetivamente alterados só são gravados junto do salvamento explícito; seleção,
troca de aba ou perda de foco não salvam. Sem permissão, o cadastro permanece em
leitura. Contrato transacional e proteção de snapshots no guia de Vendas.

## Entregas por slots — composição existente, 03/10/2026

`EntregasForm` em `/vendas/area-entrega` e `VeiculosEntregaEditor` reutilizam Tabs, Card, Table, Select, Input, CurrencyInput, StatusAtivo e BotaoRemoverItem. Matriz de frete e capacidades usam colunas fixas compactas alinhadas à esquerda; fieldsets têm `min-w-0` para preservar a rolagem interna da Table. GrupoAcoes permite quebra dos botões na largura disponível. `CamposEnderecoPedido` é compartilhado por Origem, Simulador e Dados da empresa, com `mostrarPais=false`; `complementoObrigatorio=false` é o padrão compartilhado também por Clientes e Novo Pedido. Veículo do novo pedido é somente leitura e ocupa a mesma linha responsiva do frete. Sem nova primitiva/token/padrão; referência **Em revisão**. Prévia sintética: `testes/visual/vite.entregas-slots.config.mts`, `entregas-slots.html`, ações simuladas; [evidências](../features/entregas/TASKS.md).

## Cardápio e Complementos — 05/10/2026, Em revisão visual

Novo Pedido compartilha `SlotComplemento` de `catalogo/linha-complemento.tsx` com o cadastro de Produtos: nome à esquerda, preço e quantidade compactos, somente grupos de mínimo efetivo positivo. A confirmação geográfica usa `ConfirmacaoLocalEntrega` de `components/entregas/resultado-entrega.tsx` junto ao frete, também usada pelo simulador. Sem nova primitiva/token. Prévia: `pedidos.html?frete&confirmar-endereco`; ações de mapas simuladas.

Cardápio reutiliza `GrupoNavegacao` para Produtos/Complementos, com permissões e teclado na lateral/menu móvel. Complementos reutiliza `ProdutosVenda`, `PrecoProduto` com preço único/CMV e coluna Categoria em tags `Badge`; sem ficha impressa. As tags internas usam as variantes existentes default/success/warning/destructive, com nome visível e cor configurável. Cadastro simples usa `FotoCampo`, MultiselecaoCombobox, CurrencyInput e ComposicaoProduto sem FM; remoção de foto usa BotaoRemoverItem. Produtos, Complementos e Grupos têm Disponibilidade; os dois últimos usam Tabs oficiais. O grupo seleciona cadastros pelo MultiselecaoCombobox e mantém categorias de grupos próprias. Sem token/variante novo. Prévia sintética: `vendas.html?secao=catalogo&cardapio=1&rota=/vendas/catalogo`; contratos do consumidor em `testes/visual/complementos.spec.ts`. Referência Em revisão; [execução](../features/complementos/TASKS.md).

## Atividades por usuário — 10/10/2026 — Em revisão visual

`configuracoes/usuarios/atividades-usuario.tsx` compõe Tabs do cadastro existente,
Card, Input, SelecaoFormulario, Badge, Table, Button e GrupoAcoes oficiais. Filtros
e consultas são explícitos; o histórico é carregado apenas para o usuário selecionado,
fora do formulário de cadastro. A consulta de excluídos abre somente atividades.
Sem token ou variante nova. Prévia sintética `testes/visual/usuarios-atividades.html`:
1440, 768, 390 e 320 px, lista/detalhes e usuário excluído; referência permanece
**Em revisão humana**. Evidências e limites em [execução](../features/atividades-usuarios/TASKS.md).

## Resumo comercial A4 de Pedidos — 09/10/2026 — Em revisão visual

**EX-IMP-04**: `src/lib/vendas/resumo-pedido-a4.ts`, adaptador `resumo-pedido.ts`,
consulta `consultar-resumo-pedido.ts` e preview `vendas/pedidos/resumo-pedido.tsx`.
Documento A4 retrato com marca oficial Grazing Table & Co, azul escuro, dourado
suave e papel creme restritos ao HTML físico. Tipografia serifada de títulos e
medidas em mm são exceção de documento impresso, não variantes dos controles HUB.

Separado da comanda térmica EX-IMP-02 e da impressão de produção. Dados de PJ,
agenda, itens, complementos, quantidades, valores, observações e total vêm do
cálculo comercial do orçamento ou do snapshot confirmado. Não inventa validade,
contatos da empresa, quitação ou efeitos fiscais. Preview reutiliza Dialog/Buttons;
HTML escapa conteúdo livre e o iframe bloqueia scripts. Tabela admite múltiplas
páginas com cabeçalho repetido. Escolha de papel/escala no driver pode sobrepor o
formato; captura/PDF local não comprova impressão física. Referência Em revisão.

## Histórico de entradas avulsas — 12/10/2026 — Em revisão visual

`inventario/entradas/entradas-historico.tsx` compõe Table, Badge e ações oficiais
editar/excluir. Cinco colunas: data, fornecedor, itens/quantidade, total e status.
Número junto à data; edição pelo Dialog reutilizado do detalhe, sem navegar após salvar.
Acesso pelo History em Button de ícone no formulário; sem item lateral próprio.
Editor: Produto/Local/Qtd/Fator/Valor em linha a partir de tablet; unidade no sufixo,
Adicionar item após Item 1 e reorganização no celular. Exclusão usa X oficial e
confirmação com motivo, explicando impedimentos. Não há variante ou token novo.
Prévia sintética `testes/visual/estoque-entradas.html`: lista, editor e confirmação
em 320/390/768/1440, claro/escuro. Referência permanece Em revisão humana.

## Fiscal — 16/10/2026 — Em revisão visual

Fiscal, revisão de 16/10/2026: `financeiro/fiscal/painel-fiscal.tsx` também reutiliza
`FiltroPeriodo` do DRE, com as mesmas datas, atalhos e confirmação ao sair/Enter.
Cartões, Tabs, Table, Button e `vidro-painel` são as bases existentes. Numeração e
certificado usam as mesmas bases em `/financeiro/fiscal/configuracoes`. A prévia
`testes/visual/fiscal-layout.tsx` inclui a lateral e o cabeçalho reais com dados
sintéticos. As novas capturas permanecem **Em revisão**, sem aprovação de baseline.

## Filtros compactos do histórico de estoque — 12/10/2026 — Em revisão visual

Consumidor `inventario/entradas/entradas-historico.tsx` reutiliza CampoBusca e
FiltroPeriodo, com altura compacta e eixos alinhados. Referência: barra de consulta
em `inventario/movimentacoes/movimentacoes-table.tsx`. GrupoAcoes mantém Entrada
avulsa e History de ícone juntos nessa barra. O formulário interno não tem History.
A coluna Ações usa apenas editar/excluir oficiais, sem badge de registro. Estados
encerrados conservam bloqueio e explicação. Nenhuma variante ou token novo.
Prévia `estoque-entradas.html`: histórico normal/vazio/erro, barra de movimentações
e entrada; 40 estados em 320/390/768/1440, claro/escuro, auditados e inspecionados.

## BI de vendas — 15/10/2026 — Em revisão visual

Referência de produto aprovada: imagem anexada ao pedido de 15/10/2026. Essa decisão
não promove automaticamente uma baseline Linux da suíte visual.
Consumidor `src/components/vendas/bi/bi-vendas.tsx`; comparação com Painel Fiscal.
Composição de Card sm, Button, GrupoAcoes, Tabs line, SelecaoFormulario, Popover,
Tooltip, Table responsiva e Dialog painel-direito. Contrato tipado `bi-vendas` na
Central; a demonstração completa usa a prévia isolada `testes/visual/bi-vendas.html`.

Os seis indicadores usam a mesma consulta da série, ranking e exportação.
Gráfico canvas possui valores textuais e seleção por teclado. A distribuição
geográfica não usa pontos fictícios ou cobrança como destino. O painel de cobertura
expõe fontes, lacunas e definições. O Button recebe o formato optativo `campo`,
registrado e demonstrado na Central. Ele reutiliza `controle.raio` para aproximar
os controles da referência; o formato padrão e as ações compactas permanecem iguais.
Nenhum token novo. A moldura real
do HUB é preservada. Evidências e resultado da inspeção em
`docs/features/bi-vendas/TASKS.md` e no `design-qa.md` da raiz.

## Dashboard de vendas e fiscal — 17/10/2026, Em revisão visual

Faturamento comercial e fiscal reutilizam success; Despesas fiscais warning e
Canceladas destructive. Superfícies e números comunicam a mesma semântica dos
rótulos; o gráfico fiscal e suas legendas acompanham as cores. Nenhum token novo.
Últimos documentos reutiliza Button outline icon-sm com Eye, nome acessível,
permissão da origem e Dialog painel-direito. A prévia fiscal simula a consulta local.
Evidências e limitações em docs/features/bi-vendas/TASKS.md. Não promove baseline.


## Clientes — titular por cobrança, 17/10/2026 — Em revisão

`IdentidadeCobrancaForm` compõe Campo, Input, SelecaoFormulario e Button oficiais. Clientes, Novo Pedido e detalhe do pedido reutilizam os campos. Principal/Cobrança N e Entrega N usam o mesmo seletor buscável; o painel escolhido mostra identidade e dados postais. Principal conserva identidade fixada às Informações gerais. Inclusão temporária e confirmação de remoção reutilizam Dialog, GrupoAcoes e BotaoRemoverItem. Asteriscos acompanham os campos obrigatórios; o destino avulso do rascunho permanece permissivo. Editor de cliente salvo oferece Pedidos com o histórico existente. Sem nova variante ou token. Referências e capturas sintéticas em [execução](../features/clientes-cobranca/TASKS.md); não promovidas a baseline aprovado.


## Fiscal simples — 22/10/2026 — Em revisão

Produtos preserva a grade de CamposClassificacaoFiscal. Grupos preserva os cartões e EditorVenda, sem NCM. Vínculos preserva a tabela com abas de produtos/complementos. Configurações conserva quatro blocos. Salvar usa serviços versionados no servidor, sem etapas de rascunho/revisão na tela. Sem variante ou token novo. Evidências e limitações em [Fiscal unificado](../features/fiscal-unificado/TASKS.md). Capturas anteriores não foram promovidas.
