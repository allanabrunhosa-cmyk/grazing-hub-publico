# Manual de padrões

[Voltar à Central de Design](./README.md)

**Status:** contratos prioritários implementados; o registro visual continua **Em revisão**
até aprovação humana. Os contratos da execução integral ao final deste documento
prevalecem sobre as observações históricas de 21/09. Evidências em VALIDACAO.md.

## 1. Princípios

1. Consistência: a mesma intenção utiliza o mesmo componente em qualquer módulo.
2. Operação legível: densidade compacta sem reduzir legibilidade e alvos de interação.
3. Vidro com função: navegação e sobreposições; conteúdo e tabelas têm superfícies estáveis.
4. Estado explícito: cor sempre acompanhada de texto, forma ou ícone quando comunica significado.
5. Ação previsível: foco, abertura, fechamento, seleção e confirmação seguem contratos documentados.
6. Segurança operacional: experimentar aparência nunca envia operações reais.

## 2. Cores, temas e marca

Não nomear uma função visual como “azul”: usar nomes semânticos, como ação principal,
texto secundário, fundo elevado e borda de campo. HUB e Etiquetas substituem as cores
desses papéis, mantendo os mesmos contratos e geometria.

Paletas devem conter pares completos de fundo/texto e estados de interação.
Sucesso, atenção e erro mantêm significado independente da cor da marca.
Variantes financeiras Entrada/Saída existentes são semânticas; não são novas ações
primárias nem autorização para recolorir todos os botões de verde/vermelho.
Confirmações positivas e cancelamentos operacionais novos seguem a matriz de
[qualidade visual](#qualidade-visual-em-novas-telas), reutilizando esses mesmos tokens.

Regras para logos: preservar arquivo oficial, proporção, área de proteção, tamanho
mínimo e versões positiva/negativa aprovadas. Não permitir upload arbitrário de SVG
executável nem redesenho automático da marca pelo editor de cores.

## 3. Tipografia

Manter inicialmente a família nativa atual: SF em plataformas Apple, Segoe UI no
Windows e sans-serif como alternativa. O painel lista somente fontes permitidas;
fontes adicionais exigem avaliação de licença, carregamento e legibilidade.

| Papel | Base inicial / orientação |
| --- | --- |
| Título de página | Token `text-display` existente, responsivo; não duplicar valores por tela |
| Título de seção | Token `text-title` existente, com peso e entrelinha vinculados |
| Corpo e controles | Referência atual de 14px, expressa em rem; ajustar a escala, não o zoom global |
| Rótulos e apoio | Referência atual de 12px; não usar textos minúsculos como solução para falta de espaço |
| Dados de tabela | Inventariar o atual 13px e decidir sua posição na escala de densidade |
| Indicadores | Token `text-stat`; reservar para números-chave, não para todos os totais |
| Códigos | Família monoespaçada apenas onde melhora a conferência |

Escala proposta de pesos: regular 400, médio 500, semibold 600. Negrito não substitui
hierarquia de títulos. Entrelinha, espaçamento de letras e quebra de palavras ficam
vinculados ao papel, evitando pares incompatíveis no editor.

Especificações de insumos ficam abaixo do nome somente nos detalhes e listagens de
Suprimentos. Seletores exibem apenas o nome; Vendas e Controle de validades não
exibem especificações de compra. Descrições de porções são informações de montagem.
Não concatenar descrição ao nome nem criar nomes duplicados para resolver layout.

## 4. Formatação e linguagem

- Campos indisponíveis (`disabled`) e informações não editáveis (`readOnly`) usam
  fundo, borda e texto cinza neutro, sem diminuir a opacidade do valor. O padrão
  compartilhado em `globals.css` vale para HUB, Pedidos e Etiquetas, nos temas claro
  e escuro; os seis tokens `controle.bloqueado*` estão na Central de Design.
  Inclui campos compostos, seletores, multisseleção, checkbox e interruptor.
  Somente leitura continua permitindo foco/cópia e envio; desabilitado conserva
  a indisponibilidade e a semântica de formulário. Não trocar um estado pelo outro
  para obter aparência. Preservar foco visível, erros, valor marcado e mensagens
  que expliquem bloqueios temporários ou de permissão. Referência visual Em revisão.

- Português brasileiro em rótulos e mensagens; preferir “Salvar”, “Cancelar” e verbos objetivos.
- Moeda: apresentação localizada, alinhamento numérico e sinal legível; cálculo e precisão
  continuam no domínio financeiro, fora do editor visual.
- Quantidade: preservar a precisão aceita pelo estoque; não arredondar perdas para caber.
  Quando a unidade for fixa, exibi-la dentro do campo com `InputComSufixo`, sem permitir
  edição da unidade nem apresentá-la como um valor separado abaixo do controle.
- Datas e horas: apresentação consistente sem trocar o fuso ou a regra de validade.
- Campos opcionais e obrigatórios: indicação explícita e consistente, não só asterisco sem explicação.
- Mensagens de erro: dizer o problema e como resolvê-lo, sem apagar dados preenchidos.
- Rótulos de operações fiscais e financeiras não são textos livremente rebatizáveis no painel.

## 5. Layout, dimensões e alinhamento

- Títulos de campos ficam alinhados à esquerda, acompanhando o início do respectivo
  controle/conteúdo. Cabeçalhos de linhas editáveis usam a mesma grade das linhas,
  incluindo a largura reservada para ações e alças; não centralizar títulos sobre
  conteúdo alinhado à esquerda. Aplicar também aos próximos desenvolvimentos.

- Dimensionar a área de conteúdo pela tarefa: formulários e tabelas curtos podem usar
  largura máxima e ficar centralizados, sem esticar os campos para preencher a tela.
  Distribuir espaço conforme o conteúdo de cada campo, conservar os eixos alinhados e
  reorganizar a grade no celular. Aplicar esse critério também aos novos desenvolvimentos.
- Lateral de desktop: `MenuLateral` conserva o token de largura expandida (16rem)
  e oferece a variante recolhida de 4.5rem em HUB e Etiquetas. A preferência fica
  no navegador por usuário; ícones mantêm nomes acessíveis e `Tooltip` por foco/hover.
  Grupos abrem `Popover` em portal, com nomes completos e rota ativa, sem recorte
  pela lateral. Até 767px, `NavegacaoMovel` permanece sobreposta ao conteúdo.
  `CabecalhoMenuLateral` reserva o topo para LogoMark e nome/subtítulo.
  `RodapeMenuLateral` mantém o controle único de recolher/expandir junto à
  assinatura institucional em HUB e Validades. Recolhido, oculta somente a
  assinatura e centraliza o botão. A navegação rola dentro da lateral, mantendo
  o rodapé acessível. O Button icon-sm conserva vidro apenas no hover/foco.
  No menu móvel, o X do diálogo fecha a navegação sem duplicar o controle.
  A prévia de Atendimento aplica a mesma distribuição na sua identidade local.
  A variante mantém a largura lateral e os mínimos de toque oficiais,
  **Em revisão** visual.
- Cabeçalho, margens, espaçamento e pontos de quebra reutilizam a estrutura do sistema.
- Formalizar uma escala baseada em múltiplos de 4px; manter valores existentes na migração inicial.
- Campo, seletor e botão na mesma linha devem compartilhar altura e eixo de alinhamento.
- Em grupos de rótulo + Select, preferir flex/grid com gap. O campo oculto gerado
  pelo Base UI pode receber margens de space-y e deslocar a base do controle visível.
  Conferir os limites dos controles renderizados, como na busca/ordenação de `/porcoes`;
  não compensar o deslocamento com uma margem individual.
- Rótulos e controles de uma mesma linha devem manter seus respectivos eixos alinhados.
  A quebra de um rótulo nunca pode deslocar apenas o campo correspondente. Priorizar
  abreviações claras, larguras adequadas ou reorganização da grade; quando a quebra for
  necessária, reservar a mesma área de rótulo em toda a linha. Não compensar desníveis
  com margens específicas por campo. Conferir a harmonia entre linhas e colunas nas
  larguras responsivas e nos estados com mensagens de apoio/erro antes de publicar.
- Referência atual confortável: 44px; controles compactos existentes precisam de contexto
  e área acionável adequada, sem reduzir automaticamente todos os formulários.
- Densidade confortável/compacta é uma opção explícita de padrão; não um conjunto de remendos locais.
- Grupos têm título quando ajudam a entender a tarefa, não para preencher espaço.
- Tabelas alinham valores à direita e usam algarismos tabulares quando apropriado.
- Telas pequenas reorganizam grupos; evitar rolagem horizontal da página inteira.

Breakpoints e estratégias de tabela são inicialmente regras de código, não sliders livres.
Alterá-los pode mudar comportamento, ordem de leitura e acessibilidade.

## 6. Superfícies, vidro e elevação

Catálogo de superfícies: fundo da aplicação, conteúdo, navegação, painel sobreposto,
lista de seleção, diálogo e aviso. Cada uma documenta cor, borda, raio, sombra e elevação.

Preservar o vidro existente do menu: referência atual de 86% de opacidade e blur de 32px.
O editor deve expor controles com limites e exemplos sobre fundos claros/escuros;
não permitir que o vidro torne texto ilegível. Tabelas e áreas densas não recebem blur por linha.

Ao reduzir transparência ou quando blur não for suportado, usar fundo estável.
No alto contraste, respeitar cores do sistema. Foco deve continuar visível sobre o vidro.
Raios são definidos por função: botão, campo, opção de lista, card, painel e navegação.
Um único raio universal não deve transformar todos os elementos em cápsulas.

## 7. Botões e ações

Preservar as variantes atuais antes de qualquer revisão: principal, contorno,
secundário, discreto, destrutivo, link e variantes semânticas de entrada/saída.
Documentar tamanho normal, compacto, ícone e suas situações de uso.

| Estado | Contrato |
| --- | --- |
| Normal | Intenção identificável, texto e ícone alinhados |
| Hover | Mudança suave de superfície, sem alterar dimensões |
| Foco por teclado | Indicador nítido e não escondido pelo cabeçalho ou pelo painel |
| Pressionado | Resposta discreta; não deslocar gatilhos que posicionam popups |
| Carregando | Impedir duplicação da ação, manter largura e texto compreensível |
| Desabilitado | Indicação visual e semântica, explicação próxima quando necessária |
| Destrutivo | Rótulo claro e confirmação proporcional ao risco |

Não usar efeitos de brilho contínuo, saltos, crescimento ao passar o mouse ou cores
aleatórias por módulo. A referência atual de transição do botão é 150ms.
Redução de movimento prevalece sobre preferências do editor.
Botão só com ícone tem nome acessível; tooltip não substitui esse nome.

## 8. Seleção simples e pesquisável

Seleção simples: poucas opções estáveis, sem campo de busca desnecessário.
Seleção pesquisável: catálogos maiores, nomes longos, grupos ou descrições auxiliares.
Menu de ações não deve ser usado como seletor de valor.

Contrato de abertura:

- Manter foco e semântica gerenciados pelo Base UI; não recriar teclado manualmente.
- Abrir abaixo do campo, alinhada ao início e com afastamento de 4px. `SelectContent` não alinha a opção selecionada ao gatilho: o campo permanece visível e separado da lista. Inverter somente quando o espaço disponível for insuficiente, mantendo a lista fora do campo e limitada à janela.
- Select, Combobox e multisseleção compartilham a superfície oficial: fundo `bg-popover`, borda `border-primary/30`, anel `ring-primary/15`, sombra `shadow-xl`, raio e movimento dos tokens existentes. O acabamento de vidro de menus e diálogos não se aplica às listas de seleção.
- Sugestões em campos de texto livre também usam Combobox, preservando a digitação fora do catálogo quando permitida pelo domínio, o limite de caracteres e o texto ao fechar com Escape. Não usar `datalist` nativo para essas sugestões; Marca/fornecedor de Etiquetas é um consumidor desse contrato.
  Nesse caso, `value` e `inputValue` acompanham o texto livre, inclusive fora das sugestões; tratar um texto válido como seleção nula faz o primitivo apagar a digitação ao fechar ou perder o foco. Esse contrato não permite IDs arbitrários em seletores de cadastros: somente campos que já aceitam texto livre podem adotá-lo.
- A lista acompanha a largura do campo por padrão; a variante ampla é explícita e
  limitada pela janela. Opções longas podem quebrar em duas linhas.
- O item selecionado, o item destacado pelo teclado e o item sob o mouse são estados distintos.
- Agrupar opções quando o domínio já possuir categorias relevantes, com `SelectGroup`/`SelectLabel` ou `ComboboxGroup`/`ComboboxGroupLabel`. O cabeçalho identifica o grupo e não é uma opção selecionável; ocultar grupos vazios na busca. Preservar IDs e categorias do catálogo. Não criar grupos artificiais para listas simples como Pessoa Física/Pessoa Jurídica ou status.
- Não mover a página nem cortar o popup por causa do overflow do formulário.
- No toque, garantir área acionável e acomodar teclado virtual.

Contrato de uso:

- Setas navegam; confirmação seleciona; Escape fecha a lista antes de fechar o diálogo pai.
- Tab mantém sequência previsível; a regra concreta deve seguir o primitivo escolhido e ser testada.
- Busca sem diferenciação de acento quando adequada ao cadastro, preservando IDs.
- Mostrar carregamento, ausência de opções, nenhum resultado e falha como estados diferentes.
- Seletores de insumos exibem somente o nome no campo/opções; especificação fica nos detalhes e listagens, sem aumentar a altura do slot.
- Valor inexistente ou desativado não some silenciosamente de um registro antigo.
- Cadastro rápido é permitido apenas em seletores operacionais e com autorização correspondente;
  não aparece em filtros de consulta. Preservar essa regra já documentada no HUB.

Todos os seletores de valor do sistema usam esses componentes, incluindo filtros e a Central. Para formulários que declaram `<option>` e dependem de `name`, `defaultValue`, `required`, `disabled` ou `FormData`, `SelecaoFormulario` em `ui/select.tsx` adapta as opções para o Select oficial e entrega `onValueChange(valor)`. Não renderizar uma lista nativa paralela, nem copiar o posicionamento por tela. Calendários de `input type="date"` e menus de ações conservam seus contratos próprios.

O padrão oficial de [Combobox da WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
orienta a seleção simples pesquisável. Não presumir que copiar aparência resolve acessibilidade.

## 9. Multisseleção

Reutilizar `MultiselecaoCombobox`, não criar uma implementação separada por tela.
Documentar busca, opções selecionadas, contagem e remoção individual acessível.
Manter a lista aberta durante escolhas sucessivas e preservar seleções ao pesquisar.
A lista segue o contrato da seção 8: abre abaixo do campo, mesmo quando chips ou
linhas escolhidas ficam logo abaixo. Não forçar abertura acima para expor essas linhas.
Inversão continua restrita à falta de espaço; conferir colisões e rolagem no diálogo real.

Lista e chips devem suportar nomes longos, descrições e muitas escolhas. Uma variante
compacta pode mostrar parte dos chips e “+N”, mas precisa oferecer acesso a todos.
“Limpar seleção” deve ser explícito; Escape fecha o popup sem desfazer valores confirmados.

Se houver seleção em lote, usar “Selecionar resultados desta busca”, com escopo e
quantidade claros. Nunca tratar resultados visíveis como todo o banco sem explicação.
Opções desabilitadas não entram em seleção em lote. Remoção não muda o foco de forma imprevisível.

Formulários usam seleção imediata no rascunho do formulário; filtros complexos podem
ter Aplicar/Cancelar, documentados como outra variante. Não misturar os dois modelos.
Combobox APG não especifica sozinho todo o contrato de multisseleção: combinar o primitivo
existente com testes de leitor de tela e o [padrão de listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).

## 10. Diálogos, painéis e foco

- Variantes por finalidade: confirmação curta, formulário, detalhes extensos e painel lateral.
- Título e descrição acessíveis; ordem lógica entre conteúdo, ajuda e ações.
- Foco inicial apropriado à tarefa; ciclo dentro do modal e retorno ao gatilho ao fechar.
- Exibir apenas um popup de formulário, detalhe ou confirmação comum por vez. Ao abrir um diálogo filho, o `Dialog` anterior permanece montado e inerte, mas fica invisível; fechar o filho devolve o painel, o rascunho e o foco. A coordenação ocorre antes da pintura e qualquer popup comum fechado fica imediatamente invisível, evitando sobreposição durante a animação de saída, inclusive ao trocar entre irmãos. Diálogos relacionados devem ser descendentes na árvore React, mesmo quando o conteúdo usa portal, para participar da coordenação central. Não criar irmãos que permaneçam visíveis ao mesmo tempo.
- A única sobreposição modal permitida é o alerta de continuar editando/sair sem salvar. Clique fora, X e Escape fecham o formulário sem edição. Com alterações, `ConfirmacaoDescarteDialogo` usa o AlertDialog oficial em portal fora da área rolável, centralizado na viewport, com título/descrição acessíveis e foco inicial em Continuar editando. O formulário permanece montado e inerte. Clique fora do alerta não descarta; Escape continua a edição. Continuar conserva os valores e devolve o foco sem alterar a rolagem; Sair sem salvar exige escolha explícita.
  Em formulários controlados, `alterado?: boolean` declara se há mudanças em relação
  ao valor salvo, incluindo `Select` e outros campos em portal. Quando informado,
  esse valor prevalece sobre os eventos rastreados automaticamente; `false` permite
  fechar após retornar ao valor salvo. Quando omitido, a detecção e a confirmação
  padrão permanecem iguais. A confirmação continua sendo a do próprio `Dialog`,
  com preservação do formulário ao continuar. Durante uma solicitação pendente,
  o consumidor bloqueia todas as saídas e pode suspender a confirmação de descarte
  com `protegerAlteracoes={false}` somente enquanto esse bloqueio estiver ativo.
- Escape respeita a camada mais interna; não fechar formulário ao sair de um seletor.
- Rolagem interna previsível; rodapé não cobre mensagens de validação ou controles.
- Cadastro rápido dentro de formulário não pode enviar o formulário pai.
- Confirmações fiscais/financeiras e requisitos de permissão não são configuráveis pelo tema.

Referência de interação: [Dialog Modal da WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 11. Tabelas, filtros e feedback

Padronizar cabeçalhos, densidade, altura, zebra opcional, destaque, ordenação,
paginação, totalizadores e ações. Cor de linha não é o único indicador de estado.
`Table` adapta a largura, permite quebra nos textos e conserva valores/botões
legíveis. Quando excede a largura, o scrollport ganha altura delimitada pela área
visível: sua barra nativa permanece acessível sem controles sobre registros ou
paginação, com toque/teclado e sem uma segunda barra sincronizada artificialmente.
ResizeObserver e MutationObserver recalculam ao mudar menu, janela e dados.
O primeiro cabeçalho textual identifica o registro; seleção precedente fica fixa
junto, com offsets medidos no cabeçalho. Declare `identificationColumn` quando a
identificação não for essa primeira coluna, ou `null` para matrizes sem identificação.
Linhas com colspan/rowspan não são fixadas; textos identificadores quebram e ficam
limitados a min(18rem, 38vw). Use os primitives para tabelas novas e existentes.
Variantes de navegação e tabelas responsivas: Em revisão visual na Central.
`Badge` com `whitespace-normal` adapta a altura (mínimo de 1.25rem), evitando
cortar linhas de marcas, categorias e outros rótulos extensos.
Em tabelas editáveis compactas, use colgroup com larguras fixas proporcionais aos
campos e alinhamento à esquerda, preservando espaço livre à direita. Dentro de
fieldset, declare min-w-0: a largura mínima nativa pode expandir o contêiner e
cortar colunas, impedindo a rolagem interna da Table. Confira a rolagem e os
botões em telas estreitas; GrupoAcoes pode quebrar com flex-wrap. Evidência em
[Entregas por slots](../features/entregas/TASKS.md), referência Em revisão.
Seleção de linhas, seleção de página e seleção de todos os resultados são escopos diferentes.
Filtros ativos devem ser identificáveis e removíveis, sem apagar valores do formulário.
Grupos de filtros categóricos por botões mostram contagem em todas as opções,
incluindo Todos e zero, usando `FiltroOpcoesContadas` (`quantidade` obrigatória).
Cada contagem considera a busca e os demais filtros, ignorando a seleção do próprio
grupo e a paginação. Zero continua visível e acionável; trocar o filtro não grava
dados. Esse é o padrão para novos consumidores equivalentes; abas de navegação e
seleções de formulário não são filtros. Clientes, Insumos e Posição de estoque
compartilham o componente. Filtros de status de Clientes usam o mesmo cálculo no Select.
Cabeçalhos de consulta ordenável reutilizam `SortableTableHead` de `ui/table.tsx`: botão
à esquerda, indicador ascendente/descendente e `aria-sort`. O consumidor define coluna,
comparação e direção; ordenar resultados não persiste a ordem comercial do catálogo.

Catálogo de estados: carregando, vazio inicial, busca sem resultados, sucesso, aviso,
erro recuperável, acesso negado e indisponibilidade. Mensagem importante não depende
exclusivamente de toast passageiro. Não mostrar sucesso antes da resposta da operação.

## 12. Acessibilidade e testes manuais

Meta: WCAG 2.2 nível AA, sem declarar conformidade antes de avaliação completa.
Verificar contraste textual de 4,5:1 em texto comum e 3:1 em texto grande, com os
critérios aplicáveis; componentes/estados também exigem contraste não textual quando aplicável.
WCAG 2.2 AA estabelece alvo mínimo de 24×24 CSS px, com exceções; o padrão confortável
do HUB deve continuar priorizando 44px. Testar foco não encoberto e operação por teclado.
Referência: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Verificações: zoom, reflow, claro/escuro, movimento reduzido, contraste elevado,
transparência reduzida, leitor de tela e dispositivos de toque. Contraste sobre vidro
precisa considerar a composição real; uma conta entre duas cores sólidas não basta.
Texto selecionado em campos e conteúdo usa azul derivado de `--brand-blue` sobre
`--card`, com texto em `--foreground`; a seleção deve continuar distinguível do fundo
nos temas claro e escuro. Origem: `src/app/globals.css` (`::selection`).

Checklist automático aprovado não equivale a certificação. Registrar separadamente
“aprovado”, “reprovado”, “não executado” e “não aplicável”, com evidência e versão.
# Contratos da execução integral de 22/09/2026

Prevalecem sobre observações históricas abaixo. A referência visual inicial está no inventário.

- `status-ativo`: switch de cadastro binário, nome acessível estável, valor confirmado,
  trava síncrona contra duplicação, erro persistente e nova tentativa. Domínio e permissão
  permanecem no servidor. Explicar impedimento; confirmação opcional quando o domínio exigir.
- `acoes-compactas`: Button editar/excluir e grupo compartilhado; círculo 36px desktop,
  mínimo 44px em toque, espaço 8px, foco/tooltip/nome. Editar tem semântica própria (ocre),
  distinta de warning. Ações principais conservam texto.
- `salvar-orcamento`: `Button variant="salvar"` usa a semântica de salvamento
  laranja, independente da marca: `--ds-salvar-claro`/`--ds-salvar-escuro`, registrados
  como `acao.salvarClaro`/`acao.salvarEscuro` na Central. Texto branco no claro e
  `--brand-navy` no escuro. A variante oficial é aditiva; não altera `default`,
  confirmação ou cancelamento. Referência **Em revisão**.
- `confirmar-cancelamento`: a confirmação explícita conserva texto e usa
  `Button variant="saida"`, preenchido com `--destructive` em repouso.
  O X vermelho permanece no gatilho/menu de cancelamento, sem substituir
  o texto do confirmador. Confirmação, permissões e auditoria são preservadas.
- `remover-item`: `BotaoRemoverItem` compõe Button `excluir` e X para remover entradas
  do rascunho. Neutro em repouso, vermelho destrutivo no hover, dimensões das ações
  compactas, foco/nome/tooltip e `type=button`. Não representa exclusão de cadastro
  persistido; o formulário confirma a gravação com Salvar/Cancelar. Variante no
  catálogo de Botões e demonstração sintética, **Em revisão** visual.
- `barra-acoes`: título à esquerda, grupo de ações à direita, quebra em telas estreitas.
- `edicao-inline`: adaptador de campo com validador de domínio injetado; confirmar explícito,
  Enter em linha única, Escape cancela, blur não salva, cliques não expandem a linha.
  Não arredondar valores no componente; reserva de controles permanece vazia/preenchida.
  Variante `AcoesEdicao somenteConfirmar`: check único confirma os campos da linha;
  cancelamento por Escape fica no consumidor. Validação, trava contra duplicação,
  erro persistente e sucesso após resposta seguem o mesmo contrato. Vínculos fiscais
  usa essa variante; os consumidores anteriores mantêm check e cancelar.
  `destacarAlterado` reutiliza Button `entrada` (tokens success) enquanto há rascunho
  diferente da base; não representa sucesso já persistido. A coluna conserva apenas
  o botão alinhado à esquerda, com feedback acessível e erro persistente no campo.
  `GrupoAcoes alinhamento="inicio"` usa o contrato CSS compartilhado; o padrão
  continua `fim` nos consumidores anteriores.
  Preço de Produtos usa campo compacto, check adjacente somente quando alterado e
  reserva de largura antes do status. Sair do conjunto campo/check ou Escape restaura
  o preço salvo; focar/clicar no check conserva o rascunho para confirmar. Nunca salvar
  ao perder foco. Resposta pendente mantém a trava e erro preserva nova tentativa.
- `TabsList variant="primary"`: seleção com `bg-primary`/`text-primary-foreground`
  (azul no HUB), usando Base UI e os mesmos tokens, foco e teclado das abas padrão.
  Padrões default/line permanecem disponíveis. Os filtros por botões usam default
  quando selecionados, outline nos demais e `aria-pressed`, como Fornecedores.
- `TabsList variant="buttons"` + `TabsTriggerBotao`: abas Base UI reutilizam
  `buttonVariants` default/outline, altura normal, raio de botão e padding oficiais;
  seleção azul no HUB, teclado e painel associado preservados. Lista sem moldura
  adicional, alinhada à esquerda; demonstração em Navegação e catálogo Em revisão.
- Em Vínculos fiscais, busca e filtros compartilham linha/altura no desktop e quebram
  em telas estreitas. Tabela com colgroup compartilhado mantém largura e alinhamento
  esquerdo entre Produtos/Complementos, independentemente do conteúdo dos cadastros.
- `slot-expansivel`: botão de expansão separado do grupo de ações; região nomeada,
  teclado nativo, nomes longos quebram. Grade conta largura disponível e limita a 4 colunas.
- `ordenacao`: reaproveitar ListaOrdenavel com compatibilidade de imports. A única alça
  visível são os seis pontos; Espaço/setas/Enter/Escape preservam a alternativa pelo teclado.
  Não exibir botões separados de subir/descer em consumidores operacionais ou na Central.
  Caller informa escopo completo; não reordenar silenciosamente subconjunto filtrado/paginado
  como lista inteira.
- `previa-isolada`: mesmos componentes, callbacks sintéticos; tokens somente no documento
  iframe e seus portais. Reset restaura dados fictícios, nunca cadastros reais.
- `publicacao`: registro fechado, revisão/base, autorização real, motivo, idempotência,
  auditoria e restauração que cria versão. Ajustes visuais não mudam regras de negócio.

Estados mínimos documentados no registro: normal, foco por teclado, hover real, desabilitado,
somente leitura, carregando, salvando, sucesso, erro, sem permissão, vazio e conteúdo longo.
Oficial significa contrato implementado/testado; não equivale a aprovação visual humana.
Propostas e exemplos ainda não validados devem permanecer Em revisão.

## Proteção no desenvolvimento

### Navegação agrupada sem página própria

`src/components/layout/grupo-navegacao.tsx` reutiliza a aparência e a expansão da
lateral para agrupamentos que não têm uma página de entrada. Nessa variante, o
título inteiro é um botão de divulgação: não direcionar silenciosamente ao primeiro
filho. Filhos são filtrados por permissão, e um grupo vazio não é apresentado.
O grupo começa recolhido fora de suas rotas e aberto quando contém a página ativa;
permite recolher mesmo nessa página. `aria-expanded`/`aria-controls`, Enter/Espaço,
Escape com retorno de foco e `NavLink` com indicação exata de página são preservados.
Desktop e menu móvel usam o mesmo componente. A variante está no catálogo tipado
de Navegação em `src/lib/design-system/grupos.ts`, **Em revisão** visual.

Cardápio, Configurações e Fiscal de Vendas são consumidores; não substituir os agrupamentos
com página própria da Central ou de Estoque por essa variante.

Vendas & CRM (09/10/2026) reutiliza `ModuleSwitcher`, `NavLink` e o mesmo conteúdo da
lateral no menu móvel. Atendimento aparece imediatamente após Gestor de pedidos,
com ícone de destino externo e nome acessível indicando nova aba. CRM não é um módulo
separado; Clientes e Usuários & Permissões têm uma única entrada cadastral canônica
no HUB. Reorganização não modifica concessões nem cria tokens/variantes.

`npm run lint:design` verifica oito componentes-base e percorre os consumidores TSX em
`src/app` e `src/components`: detecta ícones compactos de editar/excluir fora das variantes,
override local de geometria/cor das ações e HEX local em botões. O analisador usa AST de
TypeScript; não examina números de negócio, XML/ZPL ou texto. Não substitui revisão humana:
wrappers dinâmicos, aliases de Button e classes calculadas podem exigir revisão explícita.
Os testes `desvios.test.ts` demonstram detecções e casos legítimos que não devem falhar.

Alteração de padrão: identifique consumidores no inventário, modifique o componente/token,
teste o domínio e a interface, capture o mesmo cenário/largura/tema e examine as diferenças.
Não atualize todas as referências para silenciar uma regressão. Exceções devem ter ID,
arquivo/alcance, razão e condição de revisão; cores fiscais e dimensões de impressão não
autorizam overrides arbitrários de botões administrativos.

## Visualizações operacionais de Pedidos — 30/09/2026

Consumidor: `src/app/(protegido)/vendas/pedidos/gestor-client.tsx` e `gestor.css`.
Padrão `visualizacoes-operacionais` registrado no catálogo tipado e demonstrado com
estado sintético na Central. Situação **Em revisão** até aprovação visual humana.

- Quadros é o padrão: cinco colunas iguais, na ordem Novo pedido, Em preparo, Pronto para entrega / retirada, A caminho e Entregue; ocupam toda a largura de conteúdo. Cada coluna possui rolagem própria.
  Em telas estreitas, somente o quadro rola horizontalmente; a página mantém reflow.
- `CampoBusca`, filtros `Select`/`Combobox`, `Popover`, `Card`, `Table`, `Button`,
  `BarraAcoes` e `GrupoAcoes` mantêm seus contratos. O popup do Gestor oferece
  somente canal, com seleção imediata; os filtros existentes no serviço/URL continuam
  compatíveis. Filtros não oferecem cadastro rápido.
- Busca e filtros são comuns às três visualizações e ficam na URL. Filtros ativos
  são removíveis; paginação/contagem explicitam o conjunto visível (50 por página).
  Datas no calendário são civis, no fuso da loja; pedidos sem data aparecem separados.
- A abertura padrão consulta a coorte operacional (confirmados não interrompidos
  e recebidos externos iFood), sem corte por idade dos entregues. Filtro explícito
  na URL permanece visível e removível. Orçamentos e encerramentos são consultados
  separadamente, por filtro em Lista; calendário respeita o filtro da consulta.
  Card, evento e linha de orçamento usam o destaque de atenção
  `warning`/`warning-bg` e Badge warning com texto **Em orçamento**; não oferecem
  ações de produção antes da confirmação comercial.
- Slots datados do calendário mostram número e cliente na primeira linha (nome
  completo no title), janela de entrega e TagCanalVenda na segunda. Button/Popover abrem o
  mesmo Card completo usado nos quadros, com destinatário, endereço, status,
  resumo, impressão e ações autorizadas. O painel fecha por Escape ou interação
  externa; o resumo Dialog só abre após o fechamento completo do Popover, sem
  sobreposição e com retorno de foco ao slot. Pedidos sem data mantêm o Card fora
  da grade. As cores de processo/orçamento permanecem no slot e no painel.
- Cores de processo independem da marca: preparo usa warning; pronto, success;
  rota usa `--ds-processo-rota` e seu fundo; entregues usa `--ds-processo-entregue`
  e seu fundo. Texto de status acompanha a cor em quadros, calendário e lista.
- Avançar/retornar usa Button `icon-sm` com nome acessível e tooltip. Trava síncrona,
  salvamento, versão esperada e chave idempotente impedem duplicação. A etapa só
  muda após confirmação do servidor; erro permanece junto do pedido com acesso
  à operação detalhada. Quantidades, composição, estoque e ocorrências continuam
  validados pelo domínio. O retorno é uma etapa, sem apagar histórico/primeira entrega.
- PENDENTE ocupa Novo pedido e EM_PREPARO ocupa Em preparo; iniciar é ação distinta.
  Rascunhos/cancelados/interrompidos não ocupam as colunas operacionais. Perfil sem
  capacidade operacional consulta os mesmos dados sem os controles de mutação.
- A identidade Pedidos troca cores para verde no documento/portais e mantém
  tipografia, tokens e contratos compartilhados. A variante compacta de moldura
  está descrita abaixo; HUB e Etiquetas conservam a estrutura padrão.

### Edição dos limites nos filtros de data

`src/components/filtro-periodo.tsx` conserva um rascunho por limite. A digitação,
inclusive o zero inicial do mês, não dispara consultas ou recálculo do relatório.
Sair do campo ou Enter aplica somente uma data completa/válida ou um vazio intencional.
`validity.badInput` distingue o segmento nativo incompleto do pedido de remover o
limite; nesse caso, o filtro aplicado permanece e o campo informa o que falta.
Datas aceitam o calendário nativo e ano de 0001 a 9999; valor fora desse domínio
não é aplicado. Atalhos e Limpar datas são escolhas explícitas e conservam sua ação.
Mudança externa do período substitui o rascunho sem remontar os campos.
A instrução de aplicação fica visível e os erros têm associação acessível ao limite.
Regressões: `testes/financeiro/controles.test.tsx` e consumidores; conferir a sequência
0 → 9 → Enter e a rolagem real do mouse em prévia isolada. Referência Em revisão.

### Cadastro e saída nos popups de Pedido, sem diálogo sobreposto

O consumidor `vendas/pedidos/@modal/(.)novo/modal-novo-pedido.tsx` compõe
`ModalPedido`, definido em `vendas/pedidos/modal-pedido.tsx`. Novo Pedido e detalhe
reutilizam a mesma proteção por AlertDialog em portal, única sobreposição modal permitida sobre o formulário. O alerta permanece visível independentemente da rolagem. No Novo Pedido,
cadastro rápido ocupa os campos já visíveis; a busca `Combobox` preenche o cadastro e
a ação de limpar reinicia seus campos. Não há criação em popup separado. Seleção preenche os dados e sinaliza com
borda/fundo primary discretos, transição respeitando redução de movimento e status textual.

A proteção de descarte agora é compartilhada em `ConfirmacaoDescarteDialogo`,
usada tanto pelo `Dialog` padrão quanto pelo adaptador `ModalPedido`.
Novo Pedido e detalhe ativam `protegerAlteracoes` no adaptador; seu contexto
registra alterações e salvamentos explícitos por parte do formulário e mantém
o retorno com filtros/paginação. `protegerAlteracoes={false}` no `Dialog`
interno evita detecção duplicada, mantendo a proteção do adaptador.
Seletores continuam como listas de opções do componente oficial. Referência visual
Em revisão até aprovação humana; nenhum token ou variante de componente foi criado.

## Formulário comercial compacto e canais, 01/10/2026

Novo Pedido reutiliza Button, Combobox, Select, Input, CurrencyInput e BadgeDollarSign
no padrão de desconto de Produtos. Títulos text-title ficam fora das superfícies;
linhas de itens compactas conservam nomes acessíveis e observação expandível.
SelecaoCanalVenda usa Button sm, seleção única aria-pressed e tokens tipados
cor.canal.site/ifood/gf/texto; demo canais-venda no catálogo, Em revisão visual.
Cores informadas pelo usuário: Site azul, iFood vermelho, GF roxo; os demais canais
usam seleção primária padrão. A referência não altera contratos comerciais.

No Novo Pedido, veículo e frete compõem uma linha responsiva após os produtos e
antes dos ajustes comerciais. Reutilizam `EscolhaEntrega`/`CampoEntrega`, `Select`,
`CurrencyInput`, `Button` e `Badge` warning para sinalizar diferenças da indicação
com texto e valor de referência. Desde 03/10, o veículo é somente leitura e determinado
por slots dos produtos e capacidade inclusiva do veículo; não há campo de embalagem
por item. Com endereço e produtos preenchidos, o cálculo é automático e preenche o
campo Frete sem confirmação intermediária de localização. Detalhes e justificativas
usam `Dialog` local e `ResultadoCalculoEntrega`, com foco/retorno e salvamento
explícito. Pendência, erro e expiração têm resumo persistente junto à linha;
ausência de cálculo não representa gratuidade. Sem nova primitiva ou token;
composição registrada neste padrão existente, referência visual **Em revisão**.

O cálculo automático e o botão de recalcular ficam disponíveis com produtos/quantidades
e endereço de entrega preenchidos, sem exigir cliente salvo, canal, destinatário,
agenda ou pagamento. Complemento é opcional em cobrança e entrega; o componente
compartilhado `CamposEnderecoPedido` comunica isso no rótulo e não usa `required`.
Pendências indicam os produtos ou o endereço que faltam, sem exigir salvar orçamento
para consultar a rota. Mantêm-se debounce, proteção contra respostas antigas,
confirmação geográfica explícita e detalhes existentes, sem novo padrão visual.

Novo Pedido exibe somente vínculos de grupos com mínimo efetivo maior que zero;
Extras permanecem opcionais. Os grupos são expansíveis e começam abertos para
preenchimento. `SlotComplemento`, compartilhado com `LinhaComplemento` de Produtos,
conserva nome à esquerda e controles compactos alinhados na mesma linha; no pedido,
preço é somente leitura e quantidade é editável. Não expor status/composição do
cadastro como controles comerciais do pedido. `QuantidadeEscolha` compõe Button e
Input oficiais: menos, quantidade inteira, mais no mesmo eixo. Mínimo/máximo são da
soma do grupo; repetição desligada limita cada opção a uma unidade. No máximo,
adições ficam desabilitadas/cinzas, inclusive por digitação; reduzir continua disponível.
Pedido e simulador compartilham o cálculo do saldo do grupo. Novas composições estão
no catálogo tipado, **Em revisão** visual, sem novos tokens ou variantes de base.

Ao confirmar, `MensagemPendenciaFormulario` associa uma mensagem persistente ao
controle com `aria-invalid`/`aria-describedby`, reutiliza o vermelho do Input, abre
detalhes e leva foco/rolagem até a pendência. A aba de cobrança pertinente deve ser
ativada antes; erro geral sem campo identificado também recebe foco/rolagem. Corrigir
remove o destaque. Pré-validação não substitui a autoridade do servidor e não grava
rascunho quando já existe uma pendência conhecida. Pagamento é obrigatório apenas
para confirmação; orçamento conserva o fluxo sem pagamento.
`ConfirmacaoLocalEntrega` reutiliza
os botões e instruções do simulador diretamente junto ao frete quando o provedor
exige validação de origem/destino, sem obrigar a abrir outro diálogo. Não escolher
localização ambígua automaticamente. Sem token ou variante visual nova.

## Gestor compacto, busca e filtros ancorados — 01/10/2026

Referências novas **Em revisão**; componentes registrados no catálogo tipado e
demonstrados sem operações reais em DemonstracaoPadrao (operacional-compacto).

- **DS-PED-COMPACTO-01 — exceção funcional de moldura:** somente o host Pedidos
  usa a largura livre de quadros sem sidebar. LogoMark e subtítulo textual ficam em box
  separado do header fino com o título Gestor de Pedidos. O box reutiliza o vidro
  do menu oficial (gradiente, opacidade 86%, blur 32px, borda e sombra), na paleta
  verde de Pedidos. Ícone usa a cor profunda da paleta, título branco e subtítulo
  cinza claro sem cápsula nos dois temas, conforme referência enviada em 01/10.
  Fallback opaco em transparência reduzida, contraste aumentado ou ausência de blur.
  Aparência e conta/saída
  preservam os componentes oficiais; o menu móvel e os destinos gerais do HUB
  não são transportados para este shell. HUB/Etiquetas continuam na moldura padrão.
- BarraAcoes aceita variante=compacta e className; título h1 fica acessível via
  sr-only porque o shell já apresenta o título visual. GrupoAcoes ocupa a largura
  disponível; busca, Filtros, Select de visualização e ações cabem na mesma linha
  em telas amplas e quebram em telas pequenas. A variante padrão permanece intacta.
- CampoBusca aceita formato=padrao|arredondado, usando --ds-botao-raio no segundo.
  Continua controlado e informa cada digitação/limpeza ao consumidor. A busca
  automática do gestor atualiza a URL após 300ms sem digitação, cancela atualizações antigas,
  preserva filtros/visualização e reinicia a paginação. Limpar não deve ressuscitar
  uma busca pendente; composição IME não dispara busca intermediária. Nenhum filtro
  de consulta salva dados comerciais ao perder foco.
- Popover usa Root/Trigger/Portal/Positioner/Popup do Base UI, abertura por botão,
  sem deslocar o conteúdo. Padrão: alinhamento inicial, largura 15rem (240px),
  altura máxima min(25rem, altura disponível), rolagem vertical e uma coluna de
  grupos separados. Raio, vidro, foco e movimento usam tokens existentes; os
  controles preservam área de toque mínima de 44px em ponteiros amplos; os slots
  popover-trigger/popover-close participam das regras compartilhadas de toque.
- Na variante de formulário complexo, o consumidor mantém filtros aplicados e
  rascunho separados: Aplicar confirma;
  Limpar remove explicitamente; fechar por botão, Escape ou interação externa
  descarta mudanças não aplicadas. Reabrir carrega os filtros vigentes. Busca
  automática continua independente. Select/Combobox aninhados conservam teclado,
  foco, portais e fechamento em ordem; não são substituídos por menu de ações.
- PopoverContent recebe align/className/aria-label; PopoverTitle/Description
  podem fornecer nomes/descritivos. Foco inicial e retorno ao gatilho, Escape e
  interação externa pertencem ao Base UI. O padrão não modal permite manter o
  quadro visível e interativo; modal=true requer fechamento acessível no conteúdo.
- Quadros mantêm cinco colunas iguais com títulos/contagens e bordas visíveis.
  O cartão compacto apresenta cliente, TagCanalVenda, olho e impressora na mesma
  linha e destinatário com Para:. Itens ficam no detalhe/resumo/impressão, sem
  removê-los do snapshot. GrupoAcoes evita propagação da ação para o cartão.
- TagCanalVenda identifica origem comercial, sem semântica de processo: Site
  azul, iFood vermelho e GF roxo (Giuliana Flores). Reutiliza as paletas existentes
  azul/violeta e destructive como cores de identidade; não deduz status dessas cores.
  Correspondência exata após caixa/acentos/espaços: site; ifood/i food/i-food;
  gf/g f/g.f./giuliana flores/giulianaflores. Conhecidos usam Site/iFood/GF, title
  preserva o nome original; desconhecidos mantêm o nome e ficam neutros. Ausência
  usa Sem canal. A largura é limitada e o texto completo permanece no DOM/title.

Padrões: busca-operacional, filtros-ancorados, tags-canais-venda e
barra-operacional-compacta. Nenhum novo token editável; variantes visuais dependem
de aprovação humana. Referência de composição observada no iFood não substitui os
contratos da Central nem altera autorização, snapshots ou transições do domínio.

### Canal imediato e cor do seletor de visualização — 01/10/2026

Padrões filtro-canal-imediato e seletor-visualizacao-operacional **Em revisão**.
O Gestor substitui o formulário complexo de filtros por uma consulta simples de
canal; não oferece status, situação comercial, cliente, produto ou datas nesse popup.
Não modifica os contratos anteriores desses filtros no serviço ou em URLs legadas.

- FiltroCanalVenda reutiliza Popover de 240px, Checkbox, Button e tokens oficiais.
  Uma seleção exclusiva respeita o canalId já existente, sem multisseleção no banco.
  Clicar a linha ou alternar pelo teclado aplica imediatamente; escolher outro canal
  substitui o anterior. Desmarcar o canal ou marcar Todos os canais remove o filtro.
  Popup permanece aberto para conferir o check e fecha pelo gatilho, Escape ou fora.
- É um grupo de controles de consulta com nome Canal, não um menu de ações. Não há
  rascunho, Aplicar ou Limpar. Os modelos imediato e complexo permanecem variantes
  distintas; as regras de confirmação/descarte do formulário complexo não se aplicam
  à consulta simples. Escape não desfaz uma seleção já aplicada.
- Componente controlado por canais/canalId/aoMudar/disabled; nomeCanalSelecionado
  opcional preserva o nome de uma opção ausente. Selecionado fora do catálogo fica
  marcado e removível; sem nome disponível, usa Canal selecionado (indisponível).
  Ausência de opções é informada, sem apagar o canal vigente ou inventar outro ID.
- O consumidor mantém o check imediato durante a atualização da URL, preserva busca,
  modo e agenda e reinicia paginação. Props anteriores não devem apagar a intenção
  mais recente. Não grava pedido, canal ou cadastro; nomes longos quebram no popup.
  Checkbox possui nome por aria-labelledby e ajuda separada, evitando nomes duplicados
  ao estar dentro do label. Foco, teclado e fechamento continuam no Base UI.
- SeletorVisualizacaoOperacional reutiliza Select compacto e aceita somente quadros,
  calendario e lista. valor/aoMudar são controlados; className e disabled opcionais.
  Mantém largura, altura, ícones, dropdown, foco e teclado. Apenas o gatilho recebe
  verde primário claro de Pedidos em Quadros, blue-600 em Calendário e violet-600
  em Lista, com texto branco e hover por mistura de 8% de preto. A classe central
  ds-seletor-visualizacao/data-modo aplica as cores; não muda layout ou cor dos status.
  O gatilho mantém fundo sólido também em repouso e foco: sua variante tem prioridade
  sobre o acabamento de vidro que alcança bg-card. Em alto contraste, fundo, texto
  e borda usam ButtonFace/ButtonText do sistema.
- Identificação do cartão usa text-title/font-semibold para cliente e número e
  text-sm/font-semibold para destinatário. Preserva colunas, ordem, dados e ações,
  com quebra de nomes longos; tipografia segue os tokens existentes da Central.

Demonstração sintética reutiliza os componentes reais sem consultar banco ou ações.
Nenhum novo token editável. Referência visual depende de aprovação humana.

## Campos delimitados e remoção — 01/10/2026

`Input` valida digitação e colagem em `number`, `tel` e modos numéricos; `restricao` permite inteiro, decimal, dígitos ou máscara numérica. `casasDecimais` e `maxLength` explicitam o domínio, sem arredondar o valor. Todo decimal completa automaticamente o zero inicial na digitação/colagem: `,5 → 0,5`, `.5 → 0.5` e, onde o domínio permite negativos, `-,5 → -0,5`. A regra pertence a `Input`/`campos-entrada`, contando o zero no limite e preservando o cursor e todos os dígitos. Novos campos fracionários devem usar `Input` ou `InputComSufixo` com `inputMode="decimal"`, `casasDecimais` e `maxLength`, sem `type="number"` (que sanitiza vírgulas no navegador); lint:design protege este contrato. Inteiros, texto, telefones e CEP mantêm suas regras. Máscaras monetárias e percentuais reutilizam `useFracaoMascarada`: iniciar com vírgula/ponto ou colar uma fração interpreta o decimal explícito; a entrada habitual por centavos continua. O atalho monta a string decimal sem arredondar e rejeita excesso de casas. Sair do campo apenas formata, nunca salva. Máscaras monetárias preservam separadores. O servidor continua validando limites de negócio. Na ausência de limite explícito: números 40, texto 2000, e-mail 254, URL 2048, senha 256; `Textarea` 5000. Novas telas devem indicar limites adequados, sempre também no servidor.

`Button variant="excluir"` e ações rotuladas Remover/Retirar/Excluir exibem somente X, com fundo vermelho pastel fixo e efeito no hover. Preservam nome acessível, tooltip, confirmação, autorização e auditoria. `BotaoRemoverItem` reutiliza essa variante. Botões Cancelar usam a cor neutra da variante `outline`, inclusive em edição e diálogos, com hover neutro em ambos os temas. Fechar por X conserva a semântica de navegação. Outros comandos comerciais mantêm sua semântica. Referências visuais do incremento continuam Em revisão.

Entregas reutiliza esses componentes, Checkbox, StatusAtivo/StatusAtivoSalvavel e seletores oficiais no cadastro simples de embalagens e veículos, sem tokens paralelos.

## Configuração de estoque do Gestor — 01/10/2026, Em revisão

`ConfigurarEstoqueGestor` compõe os padrões existentes, sem nova variante visual,
primitiva ou token. O botão de engrenagem `Button` ghost/icon-sm fica no `GrupoAcoes`,
com nome e tooltip Configurar estoque dos pedidos. Abre um `Dialog` local com título,
descrição, `StatusAtivo` nomeado Movimentar estoque, `Label`/`Select` para Local de
estoque e Salvar explícito. Abrir, editar e fechar não alteram busca, canal,
visualização, paginação ou URL do Gestor.

- O controle inicia com o valor confirmado pelo servidor; ausência de configuração
  no domínio corresponde a desligado. Alternar apenas prepara a edição. O texto
  explica OFF sem reservas/baixas e ON com baixa automática em Pronto/Em rota,
  saldo negativo permitido e ausência de baixa retroativa, conforme contrato do domínio.
- Local não é escolhido automaticamente. Ligado exige uma opção disponível;
  a ajuda explica por que Salvar fica desabilitado. Um ID salvo fora do catálogo
  permanece visível como Local salvo indisponível; desligado permite limpá-lo.
  Opções longas quebram pelo `SelectItem quebrarTexto` oficial.
- Usuários sem `podeAlterar` consultam a configuração com controles bloqueados,
  motivo acessível e Fechar; Salvar é oferecido somente a quem pode alterar.
  A autorização de gravação continua sendo validada pelo servidor.
- O formulário declara `Dialog alterado` pela diferença entre rascunho e valor salvo,
  incluindo alteração somente do local. Escape, botão X, Cancelar e fora preservam
  a confirmação padrão; reabrir restaura o valor confirmado. Erro persistente mantém
  o rascunho. Durante Salvar, trava síncrona evita duplicação, bloqueia fechamento e
  mostra carregamento no controle/botão; sucesso fecha, devolve foco e informa confirmação.
- Uma resposta anterior não reverte o valor confirmado localmente; versão posterior
  atualiza a referência sem sobrescrever uma edição aberta. O rascunho conserva a
  versão com que foi aberto para o servidor tratar conflito. A chave da tentativa
  permanece em uma nova tentativa sem alteração do rascunho.

Os testes usam os componentes reais e dados fictícios. A composição visual e a
extensão de proteção controlada permanecem **Em revisão** até aprovação humana.

## Superfícies de vidro de Pedidos — 01/10/2026

O padrão tipado `pedidos-vidro` aplica-se somente a `data-identidade="pedidos"`,
incluindo login, Cards, tabelas, colunas do Gestor, calendário e Popover. Reutiliza
`vidro.opacidade`/`vidro.desfoque`, borda e sombra; conserva geometria, cores de
processo e controles. Painéis aninhados não acumulam blur; tabelas não desfocam
por linha. Modo escuro usa a mesma opacidade configurável, com base verde.
Transparência reduzida, contraste ampliado, ausência de suporte a backdrop-filter,
alto contraste e impressão têm fundos estáveis. Referência visual **Em revisão**.

Na declaração dupla de desfoque, `-webkit-backdrop-filter` vem antes de
`backdrop-filter`: a otimização de produção precisa preservar a propriedade
padrão usada pelo Chrome. O teste de identidade executa o otimizador real.

### Abas de endereços e cadastro compartilhado

Para endereços múltiplos, reutilizar Tabs/TabsList/TabsTrigger/TabsContent oficiais, com nomes sequenciais, seleção controlada e + (Button size icon-sm/outline com nome acessível) imediatamente após a lista. Painéis keepMounted conservam o rascunho; selecionar não salva. Remoção do endereço ativo usa BotaoRemoverItem e mantém pelo menos um endereço. Consultas pendentes bloqueiam alteração de estrutura/troca; validação abre o primeiro painel inválido. Os títulos das abas não devem encolher nem se sobrepor (TabsTrigger flex-none). A última aba e o + formam uma unidade que quebra junta em telas estreitas dentro do popup, sem exceder sua largura. Implementação compartilhada: `vendas/pedidos/cadastro-cliente-form.tsx`. Clientes e Pedidos usam a mesma largura de diálogo e geometria dos campos compartilhados, sob Informações gerais. Cobrança usa TabsList line (sem moldura preenchida, seleção sublinhada); abas principais do editor de cliente usam TabsList buttons/TabsTriggerBotao com a geometria Button oficial e seleção default/outline. Não criar variantes locais. Referência visual Em revisão; não representa aprovação humana automática.

### Contadores dos filtros de consulta — 07/10/2026
O padrão de quantidades da seção 11 também se aplica às opções categóricas em Select,
Popover e links de consulta. Consultas paginadas calculam a contagem no servidor antes
de skip/take, preservando busca e demais filtros. FiltroOpcoesContadas aceita disabled
para preservar o bloqueio durante uma operação. Resumos gerais mantêm seu escopo
explícito. Abas de navegação e opções de edição permanecem fora desse contrato.
Cobertura e critérios em [Conciliação e contadores](../features/conciliacao-contadores/SPEC.md).

## Gestão de pedidos — Lista, Kanban e detalhe, 09/10/2026

Composições registradas no catálogo tipado: `pedidos-lista-expandida`,
`pedidos-detalhe-vertical` e `resumo-comercial-pedido`. Referências **Em revisão**.
As orientações abaixo atualizam a composição anterior. Salvamento de orçamento
reutiliza a variante oficial aditiva `salvar`; os demais controles mantêm as primitives.

- Lista apresenta nove colunas: Pedido, Criação, Cliente, Canal, Itens,
  Entrega / retirada, Total, Status e Ações. Criação mostra data completa e hora
  no fuso do pedido, respeitando a origem externa quando aplicável.
  A linha não se expande: clicar no pedido abre o detalhe.
  Próximo passo, impressora e menu são ações diretas, com nome/destino acessível.
  Dados comerciais extensos continuam no detalhe, sem uma tabela de 21 colunas.
- Kanban organiza cinco etapas: Novo pedido, Em preparo, Pronto para entrega /
  retirada, A caminho e Entregue. Novo pedido reúne pendentes confirmados e
  recebidos iFood, preservando a autoridade de cada origem. Orçamentos, cancelados
  e demais encerramentos usam filtros em Lista; não formam blocos no quadro.
  Cards compactos mostram número, cliente, destinatário distinto do comprador,
  data completa/janela de entrega, modalidade, quantidade de itens, miniaturas e
  valor. Criação e tempo relativo ficam no detalhe. Quantidades são agrupadas
  pelo ID de produto com Decimal e um selo discreto; não por nome.
  Seleção destaca o card. Próximo passo, impressora e menu ficam nessa ordem
  no cabeçalho do card, sem linha extra ou botão de olho. O próprio card abre o
  detalhe. `SeletorVisualizacaoOperacional` oficial de Quadros/Calendário/Lista
  fica imediatamente à esquerda da busca, inclusive com quebra da barra móvel.
- Status usa `FiltroOpcoesContadas`; servidor conta antes da paginação, respeitando
  busca e filtros externos e ignorando a seleção do próprio grupo. Contagem de
  coluna corresponde aos pedidos visíveis, sem representar toda a carteira.
- `Button` de fluxo usa tamanho de ícone e destino acessível; menus usam
  `DropdownMenu`. `Resumo do pedido` abre o documento comercial; o ícone de
  impressora preserva comanda térmica e aviso de orçamento, sem repetir impressão
  no menu. O menu oferece retorno quando aplicável, depois Resumo do pedido e
  Cancelar pedido por último, após separador, com X oficial. Para pedido local
  confirmado e operador autorizado, a opção permanece visível na etapa atual
  Entregue, desabilitada com explicação. Após retorno autorizado, ela volta a
  ficar disponível mesmo com primeira entrega registrada; o histórico permanece.
  Calendário fecha o Popover
  antes de abrir detalhe ou documento.
- Detalhe usa a variante aditiva `DialogContent painel-direito`, com largura
  de 44 rem, conforme a referência de 20/10/2026. A partir de 1280 px, permanece não modal e libera interação
  com o quadro; abaixo disso ocupa a largura móvel em modo modal. Blocos:
  cliente, entrega com agenda/frete, itens, observações, resumo financeiro,
  pagamento, fiscal e histórico. Os blocos usam Card oficial; o total tem destaque
  próprio e o histórico fica no fim. Referência visual Em revisão.
  Cobrança e composição dos totais são recolhíveis; fotos têm 48 px.
  Agenda, cobrança e destinatário editam inline. Um único Salvar alterações
  envia metadados alterados e motivo com a versão inicial e idempotência. Somente
  seções alteradas são validadas; abrir outra seção sem editá-la não bloqueia
  o envio. Rótulos da agenda ficam acima dos campos, data inclui ano e a grade
  passa de duas colunas para uma no móvel.
  A navegação do fundo passa pelo guard do painel; confirmar descarte preserva
  bloqueios de envio/CEP. Cancelamento fica por último no menu, após separador,
  com X vermelho com fundo pastel fixo e efeito no hover/foco, confirmação e nome/motivo
  obrigatórios. Impressão usa somente o ícone próprio. Não há seção
  redundante de Operação do pedido nem gatilho duplicado de cancelamento no rodapé.
  O formulário antecipa as consequências com Badge warning oficial: preserva
  pagamentos e histórico, explica que não há estorno automático e distingue
  liberação de reservas de materiais já consumidos/preparados. O confirmador
  textual é inteiramente vermelho (`saida`); Salvar orçamento é laranja (`salvar`).
- Fotos de produto usam endpoint autenticado e arquivo existente. Foto vigente é
  referência visual; não substitui nome, composição, preço ou snapshot do pedido.
- A4 comercial usa `ResumoPedido` em Dialog descendente e iframe com scripts
  bloqueados. Botão oficial abre impressão/PDF. Identidade física da Grazing Table
  & Co fica apenas no documento EX-IMP-04, sem alterar cores/tokens do HUB.
- Reflow mantém a rolagem horizontal dentro da tabela/quadro; diálogo e preview
  mantêm rolagem própria. Contraste, teclado e confirmação seguem a Central.


Remoções pequenas, como foto ou seleção de formulário, podem usar `BotaoRemoverItem discreto` / `Button variant="excluir-discreto"`: X cinza e fundo transparente. Fechar janela mantém X cinza. A variante está Em revisão visual.

Em Pontos de impressão, o pedido explícito de 16/10/2026 usa `Button variant="excluir-rotulo"`: X e texto Excluir, cores neutras e vermelho no hover. A opção preserva confirmação e bloqueios. Não altera as exclusões compactas existentes. A demonstração e o catálogo permanecem Em revisão visual.


## Qualidade visual em novas telas

Contrato aditivo de 11/10/2026: preservar os consumidores atuais e reutilizar as
variantes reais. Esta matriz orienta novas ações e as alterações solicitadas, sem
redesenho geral nem mudança da identidade HUB/Validades/Pedidos.

| Intenção/contexto | Componente/variante existente | Critério |
| --- | --- | --- |
| Confirmar positivamente uma operação | `Button entrada` / `entrada-outline` | Verde via `success`, rótulo explícito, sucesso após resposta |
| Confirmar linha com alteração pendente | `AcoesEdicao destacarAlterado` | Check verde com alteração; preservar reserva e bloqueios |
| Salvar orçamento | `Button salvar` | Laranja com tokens próprios; não confundir com confirmação |
| Excluir/remover item ou cadastro | `Button excluir` / `BotaoRemoverItem` | X vermelho com fundo pastel fixo e efeito no hover, nome contextual; preservar confirmação/permissão |
| Confirmar cancelamento operacional | `Button saida` | Vermelho preenchido com texto, consequências e confirmação explícitas |
| Fechar/voltar/cancelar edição local | `ghost` / `outline` / `AcoesEdicao` | Ação secundária conforme consumidor equivalente; não sugere destruição inexistente |
| Navegar/criar/abrir | Variante da identidade existente | Não converter todos os botões em confirmações verdes |

O texto de remoção também pode ser convertido em X por `Button`; examine `textoDaAcao`
e a detecção de `remover` antes de escolher variante/dimensões. `aria-label`/`title`
de editar/excluir identificam o item (por exemplo, “Editar faixa do rascunho”).

Aplicar a [skill](../../.agents/skills/grazing-qualidade-visual/SKILL.md) e registrar
o consumidor equivalente antes de editar. O AGENTS.md roteia para ela; os contratos
continuam neste manual e no código, sem um segundo catálogo de tokens.

`npm run lint:design` preserva as verificações originais e acrescenta AST para
aliases/imports oficiais, controles nativos duplicados, cores locais, geometria
compacta, contexto acessível e confirmação literal sem variante semântica.
Não deduz intenção por regex global em textos de negócio. Variantes calculadas,
wrappers e valores desconhecidos exigem inspeção. `npm run lint:design:relatorio`
expõe a dívida; `npm run test:design` testa os contratos e as próprias proteções.

`desvios-baseline.json` registra apenas a dívida estática da auditoria inicial,
por arquivo/regra/expressão e quantidade. Novas ocorrências e cópias em outro
arquivo falham. Não recriar/ampliar o baseline para fazer passar uma tarefa;
correções retiram entradas por revisão. Entradas resolvidas também falham até sua
retirada, impedindo que dívida já removida volte usando uma exceção antiga.
O baseline não aprova visualmente uma tela.

No navegador isolado, `auditarInterface(document)` de `scripts/auditar-interface.mjs`
diagnostica overflow global, nomes/rótulos, centros das ações da mesma linha e
alvos em ponteiro grosso. Permite quebra do grupo e rolagem interna de tabela.
Execute em cada cenário/largura/tema; o helper é somente leitura e sem dependências.
Resultados de jsdom testam o helper, não medem a aparência do produto.

Inspecionar capturas em 320/390, 768 e 1440 CSS px quando pertinentes, claro/escuro,
conteúdo longo, normal, carregamento/desabilitado, vazio e erro. Mesma referência,
viewport e estado antes/depois; `comparar-design.mjs` nunca altera referências.
Foco, teclado, contraste composto, diálogo e leitor de tela ainda precisam de
avaliação própria. Registrar não executado separadamente de aprovado.
