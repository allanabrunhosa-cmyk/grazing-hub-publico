# Triagem individual dos desvios de qualidade visual — 12/10/2026

Base: `a0281b31`, merge da PR 9. Registro histórico de triagem estática, complementar ao
[manual vigente](padroes.md#qualidade-visual-em-novas-telas) e à
[auditoria de 11/10](auditoria-qualidade-visual-2026-10-11.md).
A versão estruturada está em [triagem-desvios-2026-10-12.json](triagem-desvios-2026-10-12.json).

O relatório da base inspecionou 360 arquivos TSX e manteve 98 ocorrências em 56 arquivos,
com 0 novas e 0 resolvidas. As 98 chaves individuais foram recalculadas a partir da
identidade AST e conferidas com o baseline: 98 correspondências, sem divergências.
A fonte e o baseline não diferem da leitura preparatória `f29a07fe`.

## Resultado e alcance

| Classificação | Quantidade | Interpretação |
| --- | ---: | --- |
| Candidatos reais de contrato | 44 | 14 de primeira linha e 30 de reutilização/semântica |
| Falsos positivos confirmados por composição | 3 | O wrapper fornece nome que a análise do nó interno perdeu |
| Exceções candidatas | 51 | Exigem contrato e alcance preciso; não são exceções aprovadas |
| Total | 98 | Inventário individual abaixo |

“Candidato real” confirma evidência de contrato violado ou primitiva equivalente no código;
não prova um defeito de pixels. Não houve screenshots de 98 telas nem certificação de
acessibilidade. Esta triagem não executou aplicação, testes, banco, importação, SEFAZ ou
equipamento; consultou somente fontes e o relatório estático.

As prioridades representam ordem de trabalho, não severidade de incidente:

- **P1:** nomes e contexto acessível. São as 14 ocorrências de primeira linha; preservar
  geometria, aparência e callbacks ao contextualizar os controles.
- **P2:** reutilização, tokens, semântica e geometria. Validar o consumidor e o domínio
  antes de trocar primitivas, estados ou eventos.
- **P3:** calibrar o analisador ou estabelecer um contrato específico. Não apagar dívida,
  aprovar exceções nem migrar o produto automaticamente.

## Lotes recomendados

| Lote | Foco | Ocorrências | Resultado pretendido |
| --- | --- | ---: | --- |
| L1 | Nomes e contexto das ações | 14 | Acrescentar nomes contextuais a editar, excluir, adicionar e menus, preservando aparência e callbacks. |
| L2 | Checkboxes e áreas de texto | 16 | Reutilizar Checkbox e Textarea oficiais onde há equivalência evidente, preservando rascunho e APIs. |
| L3 | Ações comuns, tokens e confirmação | 14 | Consolidar ações comuns, cores e ordenação sem trocar consequências do domínio ou redesenhar consumidores. |
| L4 | Falsos positivos de composição | 3 | Resolver props do wrapper oficial no analisador e retirar apenas entradas efetivamente resolvidas após validação. |
| L5 | Uploads e grupos de radio | 11 | Estabelecer contratos específicos para infraestrutura de upload e grupos exclusivos antes de migração ou exceção. |
| L6 | Apresentação de domínio fiscal | 4 | Revisar a apresentação de aceite/recusa à luz de EX-DOM-01, preservando manifestação e efeitos do domínio. |
| L7 | Implementações nativas compartilhadas | 7 | Confirmar o alcance dos componentes oficiais e registrar contratos específicos, sem tratá-los como cópias por tela. |
| L8 | Cards, linhas, calendário e matriz | 29 | Inventariar a composição especializada e sua geometria antes de extrair variante fiel ou propor exceção. |

Os lotes são propostas de agrupamento, não implementações concluídas. L4 pode ser
calibrado independentemente, desde que o caso sem nome do DSV-057 continue detectado.
Mudanças em wrappers compartilhados exigem validação dos seus consumidores.

## Inventário individual

Os IDs DSV-001 a DSV-098 seguem a ordem do relatório da base. A chave real de cada
entrada, a regra, fontes complementares, próxima ação e validação necessária estão no
JSON. As linhas são da base indicada; em outra revisão, localizar também pelo símbolo
e pela chave AST. A extensão deste registro é necessária para individualizar as 98
ocorrências; ele não substitui os mapas operacionais nem o manual.

| ID | Prioridade | Classificação | Lote | Fonte na base | Regra | Evidência estática |
| --- | --- | --- | --- | --- | --- | --- |
| DSV-001 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/compras/pedido-detalhe-dialog.tsx:144](<../../src/app/(protegido)/compras/pedido-detalhe-dialog.tsx#L144>) | `acao-compacta-sem-contexto` | O Button de edição declara apenas aria-label="Editar"; falta identificar o pedido. |
| DSV-002 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/compras/pedido-dialog.tsx:451](<../../src/app/(protegido)/compras/pedido-dialog.tsx#L451>) | `cor-local-em-botao` | Atualizar página aplica border-amber-500 e bg-white no Button outline; a apresentação local não usa a variante/token equivalente. |
| DSV-003 | P3 | Exceção candidata | L8 | [src/app/(protegido)/compras/pedidos-calendario.tsx:48](<../../src/app/(protegido)/compras/pedidos-calendario.tsx#L48>) | `controle-nativo` | O botão é o item de calendário, com arrasto, cor de status, nome contextual e bloqueios; substituir por Button genérico pode alterar a composição. |
| DSV-004 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/compras/pedidos-calendario.tsx:115](<../../src/app/(protegido)/compras/pedidos-calendario.tsx#L115>) | `controle-nativo` | Novo pedido neste dia é uma ação de ícone comum; o botão nativo tem nome, mas duplica uma primitiva disponível. |
| DSV-005 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/configuracoes/certificado-card.tsx:125](<../../src/app/(protegido)/configuracoes/certificado-card.tsx#L125>) | `acao-compacta-sem-contexto` | O texto Remover é convertido em X pelo Button; o nome não identifica o certificado. |
| DSV-006 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx:58](<../../src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx#L58>) | `controle-nativo` | Os presets Bloquear/Só visualizar/Tudo usam botões nativos com formatação local; avaliar Button equivalente preservando a matriz. |
| DSV-007 | P3 | Exceção candidata | L8 | [src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx:69](<../../src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx#L69>) | `controle-nativo` | O botão implementa seleção coletiva de permissões com role=checkbox e aria-checked=mixed; exige contrato fiel do seletor coletivo. |
| DSV-008 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx:83](<../../src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx#L83>) | `controle-nativo` | Restaurar perfil é uma ação textual comum em botão nativo; existe Button link. |
| DSV-009 | P3 | Exceção candidata | L8 | [src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx:89](<../../src/app/(protegido)/configuracoes/usuarios/matriz-permissoes.tsx#L89>) | `controle-nativo` | O checkbox da matriz distingue permissão herdada, extra e veto, com cores e suporte a forced-colors próprios; preservar os estados antes de adaptar. |
| DSV-010 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/configuracoes/usuarios/usuarios-permissoes.tsx:133](<../../src/app/(protegido)/configuracoes/usuarios/usuarios-permissoes.tsx#L133>) | `controle-nativo` | Usuário ativo é checkbox comum do rascunho, com label; reutilizar Checkbox sem introduzir persistência imediata. |
| DSV-011 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/cartoes/fatura-view.tsx:133](<../../src/app/(protegido)/financeiro/cartoes/fatura-view.tsx#L133>) | `controle-nativo` | A linha selecionável da fatura contém descrição, parcelas, pendências e valor, com nome contextual e aria-pressed. |
| DSV-012 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx:87](<../../src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx#L87>) | `controle-nativo` | O botão expande categoria contábil dentro da célula, com hierarquia e aria-expanded. |
| DSV-013 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx:139](<../../src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx#L139>) | `controle-nativo` | O botão expande grupo contábil, controla a linha e interrompe propagação. |
| DSV-014 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx:372](<../../src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx#L372>) | `acao-compacta-sem-contexto` | O gatilho usa aria-label="Editar"; LancamentoDialog não acrescenta identificação do lançamento. |
| DSV-015 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx:375](<../../src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx#L375>) | `acao-compacta-sem-contexto` | A exclusão compacta tem nome genérico Excluir, sem a descrição do lançamento. |
| DSV-016 | P3 | Exceção candidata | L5 | [src/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog.tsx:60](<../../src/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog.tsx#L60>) | `controle-nativo` | Radio Apenas esta está em fieldset/legend, possui label e name; não há RadioGroup oficial em ui. |
| DSV-017 | P3 | Exceção candidata | L5 | [src/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog.tsx:61](<../../src/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog.tsx#L61>) | `controle-nativo` | Radio Todas as pendentes é mutuamente exclusivo com o ID16; preservar a seleção por name. |
| DSV-018 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/financeiro/lancamentos/lancamento-dialog.tsx:277](<../../src/app/(protegido)/financeiro/lancamentos/lancamento-dialog.tsx#L277>) | `controle-nativo` | Cadastrar fornecedor ou beneficiário usa botão textual nativo; Button link é equivalente. |
| DSV-019 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/lancamentos/lancamentos-table.tsx:174](<../../src/app/(protegido)/financeiro/lancamentos/lancamentos-table.tsx#L174>) | `acao-compacta-sem-contexto` | Editar na tabela usa nome genérico, embora l.descricao esteja disponível. |
| DSV-020 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/lancamentos/lancamentos-table.tsx:177](<../../src/app/(protegido)/financeiro/lancamentos/lancamentos-table.tsx#L177>) | `acao-compacta-sem-contexto` | Excluir na tabela usa nome genérico; o runtime já converte o ícone recebido em X. |
| DSV-021 | P3 | Exceção candidata | L6 | [src/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view.tsx:96](<../../src/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view.tsx#L96>) | `cor-local-em-botao` | Aceitar NFS-e aplica verde local; EX-DOM-01 exige revisar o contrato fiscal antes da consolidação. |
| DSV-022 | P3 | Exceção candidata | L5 | [src/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view.tsx:148](<../../src/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view.tsx#L148>) | `controle-nativo` | O input file de XML está oculto e é acionado por ref.click() a partir de Button oficial; é infraestrutura do seletor. |
| DSV-023 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:175](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L175>) | `controle-nativo` | O botão é uma linha selecionável do extrato, com nome, aria-pressed, status e valor. |
| DSV-024 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:200](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L200>) | `controle-nativo` | Checkbox comum de seleção agrupada usa accent-blue-600; existe Checkbox oficial. |
| DSV-025 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:201](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L201>) | `controle-nativo` | O botão é um cabeçalho multilinear de movimentação, com composição e margem próprias. |
| DSV-026 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:229](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L229>) | `controle-nativo` | O botão é uma linha de composição que abre outro detalhe; reaparece no ID33. |
| DSV-027 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:257](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L257>) | `acao-compacta-sem-contexto` | O texto Excluir vira X compacto, mas mantém nome genérico; falta identificar a movimentação. |
| DSV-028 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:258](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L258>) | `acao-compacta-sem-contexto` | Editar mantém aria-label genérico, sem a descrição do registro. |
| DSV-029 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx:312](<../../src/app/(protegido)/financeiro/movimentacoes/conciliacao-view.tsx#L312>) | `controle-nativo` | Cadastrar fornecedor é um gatilho textual nativo equivalente ao ID18. |
| DSV-030 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog.tsx:77](<../../src/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog.tsx#L77>) | `controle-nativo` | Checkbox de transação do extrato duplica a primitiva e fixa azul; preservar nome e bloqueio de item existente. |
| DSV-031 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog.tsx:80](<../../src/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog.tsx#L80>) | `controle-nativo` | A confirmação binária da conta usa checkbox nativo rotulado; existe Checkbox equivalente. |
| DSV-032 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog.tsx:81](<../../src/app/(protegido)/financeiro/movimentacoes/importar-extrato-dialog.tsx#L81>) | `controle-nativo` | A confirmação de possíveis duplicadas usa checkbox comum; preservar a exigência do domínio. |
| DSV-033 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/movimentacoes/movimentacoes-view.tsx:209](<../../src/app/(protegido)/financeiro/movimentacoes/movimentacoes-view.tsx#L209>) | `controle-nativo` | A linha de composição abre detalhe e coincide com o padrão do ID26. |
| DSV-034 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/movimentacoes/movimentacoes-view.tsx:232](<../../src/app/(protegido)/financeiro/movimentacoes/movimentacoes-view.tsx#L232>) | `acao-compacta-sem-contexto` | Excluir vira X, mas não vincula a descrição da movimentação ao nome acessível. |
| DSV-035 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/financeiro/movimentacoes/movimentacoes-view.tsx:233](<../../src/app/(protegido)/financeiro/movimentacoes/movimentacoes-view.tsx#L233>) | `acao-compacta-sem-contexto` | Editar usa nome genérico; o wrapper de lançamento não o contextualiza. |
| DSV-036 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/plano-de-contas/grupo-card.tsx:229](<../../src/app/(protegido)/financeiro/plano-de-contas/grupo-card.tsx#L229>) | `controle-nativo` | O disclosure da árvore recursiva usa nome/caminho, aria-expanded e aria-controls ligados à lista. |
| DSV-037 | P3 | Exceção candidata | L8 | [src/app/(protegido)/financeiro/plano-de-contas/grupo-card.tsx:291](<../../src/app/(protegido)/financeiro/plano-de-contas/grupo-card.tsx#L291>) | `controle-nativo` | O cabeçalho completo do Card expande grupo, com ordinal, natureza, resumo e chevron. |
| DSV-038 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/fornecedores/creatable-checkbox-list.tsx:76](<../../src/app/(protegido)/fornecedores/creatable-checkbox-list.tsx#L76>) | `acao-compacta-sem-nome` | O Button contém apenas Plus/Loader2, sem texto, aria-label, aria-labelledby ou title. |
| DSV-039 | P3 | Exceção candidata | L8 | [src/app/(protegido)/fornecedores/fornecedor-dialog.tsx:97](<../../src/app/(protegido)/fornecedores/fornecedor-dialog.tsx#L97>) | `controle-nativo` | O card selecionável Fornecedor tem aria-pressed e composição própria; precisa de contrato de seleção por cards. |
| DSV-040 | P3 | Exceção candidata | L8 | [src/app/(protegido)/fornecedores/fornecedor-dialog.tsx:115](<../../src/app/(protegido)/fornecedores/fornecedor-dialog.tsx#L115>) | `controle-nativo` | O card selecionável Beneficiário é o par do ID39; preservar sua geometria e a escolha exclusiva. |
| DSV-041 | P3 | Exceção candidata | L8 | [src/app/(protegido)/fornecedores/fornecedores-table.tsx:184](<../../src/app/(protegido)/fornecedores/fornecedores-table.tsx#L184>) | `controle-nativo` | O expansor de fornecedor possui nome e região associados; faz parte da família de linhas expansíveis. |
| DSV-042 | P3 | Exceção candidata | L5 | [src/app/(protegido)/fornecedores/import-fornecedores-dialog.tsx:101](<../../src/app/(protegido)/fornecedores/import-fornecedores-dialog.tsx#L101>) | `controle-nativo` | Input CSV oculto está dentro do seletor visual de importação; não é um controle visual paralelo. |
| DSV-043 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/insumos/creatable-select.tsx:91](<../../src/app/(protegido)/insumos/creatable-select.tsx#L91>) | `acao-compacta-sem-nome` | O Button de adicionar contém apenas Plus/Loader2 e não fornece nome acessível. |
| DSV-044 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/insumos/creatable-select.tsx:96](<../../src/app/(protegido)/insumos/creatable-select.tsx#L96>) | `controle-nativo` | Adicionar um valor novo usa botão textual nativo; existe ação equivalente em Button. |
| DSV-045 | P3 | Exceção candidata | L5 | [src/app/(protegido)/insumos/foto-dropzone.tsx:89](<../../src/app/(protegido)/insumos/foto-dropzone.tsx#L89>) | `controle-nativo` | O input file sr-only integra o dropzone de foto, com ref, name e restrições próprias. |
| DSV-046 | P3 | Exceção candidata | L5 | [src/app/(protegido)/insumos/import-insumos-dialog.tsx:96](<../../src/app/(protegido)/insumos/import-insumos-dialog.tsx#L96>) | `controle-nativo` | Input CSV oculto está associado ao seletor visual de importação de insumos. |
| DSV-047 | P3 | Exceção candidata | L8 | [src/app/(protegido)/insumos/insumo-form.tsx:160](<../../src/app/(protegido)/insumos/insumo-form.tsx#L160>) | `controle-nativo` | O card de escolha Insumo implementa seleção com composição própria. |
| DSV-048 | P3 | Exceção candidata | L8 | [src/app/(protegido)/insumos/insumo-form.tsx:180](<../../src/app/(protegido)/insumos/insumo-form.tsx#L180>) | `controle-nativo` | O card de escolha Preparação é o par do ID47; preservar a distinção do domínio. |
| DSV-049 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/insumos/insumo-form.tsx:403](<../../src/app/(protegido)/insumos/insumo-form.tsx#L403>) | `controle-nativo` | Cadastrar novo fornecedor é um botão textual nativo fornecido ao gatilho do diálogo. |
| DSV-050 | P3 | Exceção candidata | L8 | [src/app/(protegido)/insumos/insumos-table.tsx:238](<../../src/app/(protegido)/insumos/insumos-table.tsx#L238>) | `controle-nativo` | O botão expande a linha de insumo, com nome/região próprios. |
| DSV-051 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/insumos/insumos-table.tsx:306](<../../src/app/(protegido)/insumos/insumos-table.tsx#L306>) | `acao-compacta-sem-contexto` | Editar usa nome genérico; InsumoDialog apenas renderiza o gatilho recebido. |
| DSV-052 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/insumos/marcas-campo.tsx:33](<../../src/app/(protegido)/insumos/marcas-campo.tsx#L33>) | `controle-nativo` | Remover marca do rascunho usa X de 28px e hover primário, em vez do BotaoRemoverItem e hover destrutivo oficiais. |
| DSV-053 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/inventario/contagem/excluir-contagem-dialog.tsx:63](<../../src/app/(protegido)/inventario/contagem/excluir-contagem-dialog.tsx#L63>) | `controle-nativo` | Checkbox de ciência do estorno usa accent-red-600 local; existe Checkbox oficial. |
| DSV-054 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/inventario/perdas/page.tsx:43](<../../src/app/(protegido)/inventario/perdas/page.tsx#L43>) | `cor-local-em-botao` | Registrar perda aplica bg-red-600, hover vermelho e h-10! no Button; as variantes e dimensões oficiais são sobrescritas. |
| DSV-055 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/inventario/perdas/perdas-table.tsx:89](<../../src/app/(protegido)/inventario/perdas/perdas-table.tsx#L89>) | `controle-nativo` | Cabeçalho de ordenação próprio usa botão nativo; existe SortableTableHead. |
| DSV-056 | P3 | Exceção candidata | L8 | [src/app/(protegido)/inventario/posicao-atual-table.tsx:265](<../../src/app/(protegido)/inventario/posicao-atual-table.tsx#L265>) | `controle-nativo` | O botão expande a linha de posição de estoque, com nome/região associados. |
| DSV-057 | P1 | Candidato real de contrato | L1 | [src/app/(protegido)/inventario/posicao-atual-table.tsx:311](<../../src/app/(protegido)/inventario/posicao-atual-table.tsx#L311>) | `acao-compacta-sem-nome` | MoreVertical não tem nome no Button nem no DropdownMenuTrigger que o renderiza. |
| DSV-058 | P3 | Falso positivo confirmado por composição | L4 | [src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx:424](<../../src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx#L424>) | `acao-compacta-sem-nome` | DialogClose fornece aria-label="Fechar nota" e title nas linhas 421–423 ao Button de render; o analisador inspeciona apenas o nó interno. |
| DSV-059 | P3 | Exceção candidata | L6 | [src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx:747](<../../src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx#L747>) | `cor-local-em-botao` | A recusa de nota conserva vermelho fiscal local; revisar EX-DOM-01 e a manifestação antes de consolidar. |
| DSV-060 | P3 | Exceção candidata | L6 | [src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx:758](<../../src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx#L758>) | `cor-local-em-botao` | O aceite de nota sobrescreve outline com verde local; a semântica fiscal deve ser preservada sob EX-DOM-01. |
| DSV-061 | P3 | Exceção candidata | L6 | [src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx:793](<../../src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx#L793>) | `cor-local-em-botao` | O confirmador de aceite usa verde local; falta mapear a apresentação fiscal ao catálogo sem alterar o consumidor preservado. |
| DSV-062 | P3 | Exceção candidata | L5 | [src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx:822](<../../src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx#L822>) | `controle-nativo` | Radio Não reconheço pertence a fieldset/legend, tem label e name por nota; falta RadioGroup oficial equivalente. |
| DSV-063 | P3 | Exceção candidata | L5 | [src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx:832](<../../src/app/(protegido)/notas-fiscais/nota-fiscal-dialog.tsx#L832>) | `controle-nativo` | Radio Reconheço, mas operação não realizada compartilha grupo, rótulo e bloqueio com o ID62. |
| DSV-064 | P3 | Exceção candidata | L8 | [src/app/(protegido)/perfil/avatar-dropzone.tsx:35](<../../src/app/(protegido)/perfil/avatar-dropzone.tsx#L35>) | `controle-nativo` | O avatar acionável integra a área de upload de foto, com nome e geometria próprios. |
| DSV-065 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/perfil/avatar-dropzone.tsx:58](<../../src/app/(protegido)/perfil/avatar-dropzone.tsx#L58>) | `controle-nativo` | Trocar foto é ação textual comum em botão nativo; Button link é equivalente. |
| DSV-066 | P3 | Exceção candidata | L5 | [src/app/(protegido)/perfil/avatar-dropzone.tsx:67](<../../src/app/(protegido)/perfil/avatar-dropzone.tsx#L67>) | `controle-nativo` | O input file oculto é acionado pelos controles do avatar e conserva formato, bloqueio e callback. |
| DSV-067 | P2 | Candidato real de contrato | L3 | [src/app/(protegido)/producao/etiquetas/etiquetas-client.tsx:171](<../../src/app/(protegido)/producao/etiquetas/etiquetas-client.tsx#L171>) | `confirmacao-sem-semantica` | Confirmar usa secondary; é uma confirmação de saída física e sua semântica deve ser revisada preservando status e permissão. |
| DSV-068 | P3 | Exceção candidata | L8 | [src/app/(protegido)/producao/etiquetas/gestao-validades.tsx:77](<../../src/app/(protegido)/producao/etiquetas/gestao-validades.tsx#L77>) | `controle-nativo` | O card de período contém indicadores, data, seleção e aria-pressed; falta variante fiel. |
| DSV-069 | P3 | Exceção candidata | L8 | [src/app/(protegido)/producao/etiquetas/gestao-validades.tsx:88](<../../src/app/(protegido)/producao/etiquetas/gestao-validades.tsx#L88>) | `controle-nativo` | O card acionável de etiqueta contém composição e status próprios; não substituir por Button genérico. |
| DSV-070 | P3 | Exceção candidata | L8 | [src/app/(protegido)/producao/etiquetas/painel-impressao-guiado.tsx:59](<../../src/app/(protegido)/producao/etiquetas/painel-impressao-guiado.tsx#L59>) | `controle-nativo` | BotaoCard é um seletor especializado do fluxo guiado de impressão, com seleção e altura próprias. |
| DSV-071 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/producao/etiquetas/pontos-impressao.tsx:58](<../../src/app/(protegido)/producao/etiquetas/pontos-impressao.tsx#L58>) | `controle-nativo` | Checkbox Ativo do ponto de impressão duplica a primitiva oficial. |
| DSV-072 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/producao/etiquetas/pontos-impressao.tsx:58](<../../src/app/(protegido)/producao/etiquetas/pontos-impressao.tsx#L58>) | `controle-nativo` | Checkbox Ponto padrão duplica a primitiva oficial, na mesma linha do ID71. |
| DSV-073 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/producao/etiquetas/pontos-impressao.tsx:61](<../../src/app/(protegido)/producao/etiquetas/pontos-impressao.tsx#L61>) | `controle-nativo` | Checkbox de confirmação de Wi-Fi duplica a primitiva; preservar os bloqueios sem operar equipamento ou rede. |
| DSV-074 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/producao/etiquetas/responsavel-etiqueta.tsx:30](<../../src/app/(protegido)/producao/etiquetas/responsavel-etiqueta.tsx#L30>) | `controle-nativo` | Checkbox Informar outro nome controla o rascunho do responsável; existe Checkbox equivalente. |
| DSV-075 | P3 | Exceção candidata | L8 | [src/app/(protegido)/vendas/catalogo/catalogo-client.tsx:45](<../../src/app/(protegido)/vendas/catalogo/catalogo-client.tsx#L45>) | `controle-nativo` | O botão expande grupo na tabela do catálogo, com nome e região associados. |
| DSV-076 | P3 | Exceção candidata | L8 | [src/app/(protegido)/vendas/catalogo/linha-complemento.tsx:14](<../../src/app/(protegido)/vendas/catalogo/linha-complemento.tsx#L14>) | `controle-nativo` | O expansor compacto abre a composição do complemento e participa da grade existente. |
| DSV-077 | P3 | Exceção candidata | L8 | [src/app/(protegido)/vendas/catalogo/linha-complemento.tsx:15](<../../src/app/(protegido)/vendas/catalogo/linha-complemento.tsx#L15>) | `controle-nativo` | O nome do complemento também expande a composição; preservar os dois alvos e a grade. |
| DSV-078 | P3 | Exceção candidata | L8 | [src/app/(protegido)/vendas/clientes/clientes-client.tsx:130](<../../src/app/(protegido)/vendas/clientes/clientes-client.tsx#L130>) | `controle-nativo` | O botão expande detalhes do cliente conforme a família de linhas existente, com nome/região. |
| DSV-079 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/vendas/componentes.tsx:15](<../../src/app/(protegido)/vendas/componentes.tsx#L15>) | `controle-nativo` | O wrapper Check implementa checkbox nativo; há Checkbox oficial, mas a migração precisa preservar a API onChange e seus consumidores. |
| DSV-080 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/vendas/fiscal/fiscal-client.tsx:19](<../../src/app/(protegido)/vendas/fiscal/fiscal-client.tsx#L19>) | `controle-nativo` | Observações fiscais usam textarea nativo com limite; existe Textarea oficial. |
| DSV-081 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/vendas/fiscal/fiscal-produto-editor.tsx:12](<../../src/app/(protegido)/vendas/fiscal/fiscal-produto-editor.tsx#L12>) | `controle-nativo` | Orientação contábil usa textarea nativo com limite; existe Textarea oficial. |
| DSV-082 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/vendas/formas-pagamento/formas-pagamento-client.tsx:102](<../../src/app/(protegido)/vendas/formas-pagamento/formas-pagamento-client.tsx#L102>) | `controle-nativo` | Observações de forma de pagamento usam textarea nativo; preservar limite e mensagens ao reutilizar. |
| DSV-083 | P3 | Exceção candidata | L5 | [src/app/(protegido)/vendas/importacao/importacao-client.tsx:56](<../../src/app/(protegido)/vendas/importacao/importacao-client.tsx#L56>) | `controle-nativo` | O seletor nativo do pacote JSON tem label, accept e bloqueio durante processamento; avaliar contrato de upload. |
| DSV-084 | P3 | Falso positivo confirmado por composição | L4 | [src/app/(protegido)/vendas/pedidos/gestor-client.tsx:158](<../../src/app/(protegido)/vendas/pedidos/gestor-client.tsx#L158>) | `acao-compacta-sem-nome` | DropdownMenuTrigger fornece Mais ações do pedido #... ao Button de render na própria linha 158; o nome existe na composição. |
| DSV-085 | P3 | Falso positivo confirmado por composição | L4 | [src/app/(protegido)/vendas/pedidos/gestor-client.tsx:215](<../../src/app/(protegido)/vendas/pedidos/gestor-client.tsx#L215>) | `acao-compacta-sem-nome` | DropdownMenuTrigger fornece Mais opções de pedidos ao Button de render na linha 215; o nome existe na composição. |
| DSV-086 | P3 | Exceção candidata | L5 | [src/app/(protegido)/vendas/produtos/foto-campo.tsx:11](<../../src/app/(protegido)/vendas/produtos/foto-campo.tsx#L11>) | `controle-nativo` | O input file de foto possui label/aria-label, formatos, limite e pendência; avaliar contrato de upload preservando callbacks. |
| DSV-087 | P3 | Exceção candidata | L8 | [src/app/(protegido)/vendas/produtos/produtos-client.tsx:88](<../../src/app/(protegido)/vendas/produtos/produtos-client.tsx#L88>) | `controle-nativo` | A linha com foto e texto expande produto; tem composição e semântica próprias. |
| DSV-088 | P3 | Exceção candidata | L8 | [src/app/(protegido)/vendas/produtos/produtos-client.tsx:124](<../../src/app/(protegido)/vendas/produtos/produtos-client.tsx#L124>) | `controle-nativo` | O cabeçalho expande grupo vinculado, com alça, nome e conteúdo associados. |
| DSV-089 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/vendas/produtos/produtos-client.tsx:156](<../../src/app/(protegido)/vendas/produtos/produtos-client.tsx#L156>) | `controle-nativo` | Descrição comercial usa textarea nativo; existe Textarea oficial e limite explícito. |
| DSV-090 | P2 | Candidato real de contrato | L2 | [src/app/(protegido)/vendas/produtos/produtos-client.tsx:179](<../../src/app/(protegido)/vendas/produtos/produtos-client.tsx#L179>) | `controle-nativo` | Observações operacionais usam textarea nativo; existe Textarea oficial e limite explícito. |
| DSV-091 | P2 | Candidato real de contrato | L3 | [src/components/cadastro-rapido-insumo-dialog.tsx:67](<../../src/components/cadastro-rapido-insumo-dialog.tsx#L67>) | `controle-nativo` | O gatilho textual de cadastro rápido de insumo usa botão nativo; Button link é equivalente. |
| DSV-092 | P3 | Exceção candidata | L7 | [src/components/campo-busca.tsx:26](<../../src/components/campo-busca.tsx#L26>) | `controle-nativo` | Limpar busca faz parte do CampoBusca oficial, com nome próprio; conferir alvos de toque antes de formalizar o alcance. |
| DSV-093 | P3 | Exceção candidata | L7 | [src/components/campo-senha.tsx:12](<../../src/components/campo-senha.tsx#L12>) | `controle-nativo` | Mostrar/ocultar senha compõe Input e área lateral própria, com nome, estado e controles associados. |
| DSV-094 | P3 | Exceção candidata | L7 | [src/components/design-system/central-design.tsx:54](<../../src/components/design-system/central-design.tsx#L54>) | `controle-nativo` | O seletor de categoria da Central tem seleção, situação e densidade próprios; preservar a navegação do laboratório. |
| DSV-095 | P3 | Exceção candidata | L7 | [src/components/layout/grupo-navegacao.tsx:48](<../../src/components/layout/grupo-navegacao.tsx#L48>) | `controle-nativo` | O botão implementa o expansor do GrupoNavegacao oficial já documentado; não é uma cópia por tela. |
| DSV-096 | P3 | Exceção candidata | L7 | [src/components/layout/module-switcher.tsx:27](<../../src/components/layout/module-switcher.tsx#L27>) | `controle-nativo` | O elemento nativo recebe nome, semântica e estilos do DropdownMenuTrigger do ModuleSwitcher; preservar modo recolhido e portal. |
| DSV-097 | P3 | Exceção candidata | L7 | [src/components/lista-ordenavel.tsx:50](<../../src/components/lista-ordenavel.tsx#L50>) | `controle-nativo` | O botão é a alça da ListaOrdenavel oficial, com captura de ponteiro, teclado e nome próprios. |
| DSV-098 | P3 | Exceção candidata | L7 | [src/components/status-ativo.tsx:14](<../../src/components/status-ativo.tsx#L14>) | `controle-nativo` | O botão é o StatusAtivo oficial, com role=switch, nome, estado, bloqueio, pendência e feedback próprios. |

## Condições para correção, exceção e baseline

1. **Candidatos P1:** verificar o nome contextual renderizado e sua associação ao item.
   Confirmar Tab/Enter/Escape e bloqueios aplicáveis, mantendo aparência e consequências.
2. **Candidatos P2:** preservar label, estados, validação, API, FormData, foco, erros e
   salvamento explícito. Não converter checkbox de rascunho em status persistido.
   `Check` de Vendas exige adaptação e testes dos consumidores da API `onChange`.
3. **Falsos positivos:** provar a propagação de props do wrapper oficial com testes e DOM.
   O DSV-057, que não tem nome em nenhum dos dois níveis, é o contraponto obrigatório.
   Não dispensar todo `render`, wrapper desconhecido ou botão de ícone.
4. **Exceções candidatas:** documentar componente/escopo, razão, contrato, responsável
   pela revisão, condição de reavaliação e evidência necessária. Não liberar uma pasta
   inteira. Radios preservam exclusividade; uploads usam arquivos fictícios; cores fiscais
   dependem de EX-DOM-01; cards/disclosures/arrasto exigem composição fiel.
5. **Validação visual futura:** comparar a referência equivalente no mesmo estado,
   largura e tema, incluindo conteúdo longo, erro, pendência e toque quando aplicável.
   Conferir nomes, alinhamento, alvos, foco e contraste composto; resultados estáticos
   ou de jsdom não substituem essas etapas.
6. **Baseline:** manter a entrada até que o desvio seja corrigido ou um contrato/exceção
   de alcance preciso seja validado. Retirar apenas a ocorrência resolvida por revisão.
   Nunca regenerar/ampliar o arquivo para obter verde nem aprovar uma exceção com base
   apenas nesta classificação.

Nesta entrega foram escritos somente este Markdown e o JSON correspondente.
`desvios-baseline.json`, código de produto e histórico anterior foram preservados.
