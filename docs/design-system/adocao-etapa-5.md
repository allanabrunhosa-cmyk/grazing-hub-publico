# Adoção da Etapa 5

**Status:** concluída em 21/09/2026.
**Objetivo:** conectar as famílias compartilhadas aos tokens publicados, sem redesenhar fluxos ou modificar regras de negócio.

## Famílias adotadas

| Família | Componentes / origem | Tokens aplicados | Alcance |
| --- | --- | --- | --- |
| Identidade e tipografia | globals.css | cores primárias e fonte sans | HUB e Etiquetas, claro e escuro |
| Ações e estado compacto | button.tsx e badge.tsx | altura, altura compacta, raio de botão, movimento | Todos os módulos que usam o componente |
| Campos | input.tsx, textarea.tsx, checkbox.tsx e currency-input.tsx | altura, raio de controle, raio de checkbox, movimento | Formulários compartilhados |
| Seleção | select.tsx, combobox.tsx e multiselecao-combobox.tsx | altura, raio de controle, raio de popup, movimento | Seletores e listas abertas |
| Superfícies | card.tsx, dialog.tsx e dropdown-menu.tsx | raio de cartão, diálogo e popup; vidro; movimento | Cards, modais, menus e popovers |
| Abas | tabs.tsx | raio de aba e movimento | Abas compartilhadas |
| Estrutura | lateral, cabeçalho e menu móvel | largura lateral, vidro e movimento | HUB e Etiquetas |

## Exceções preservadas

| Classe de exceção | Exemplos | Motivo |
| --- | --- | --- |
| Impressão física | ficha técnica, etiquetas, ZPL e prévias térmicas | DPI, fonte e dimensões são contrato com impressora, não interface web |
| Gráficos | pizza de perdas e gráficos financeiros | Cores e geometria comunicam dados e devem ser revisadas com a métrica |
| Layout de domínio | largura de tabelas, colunas de manifestação e inventário | A largura depende dos dados e da operação da tela |
| Semântica de negócio | aceite/recusa fiscal, entrada/saída financeira e status | A cor e o texto representam uma decisão, não apenas acabamento visual |

## Regra de revisão

O comando npm run lint:design protege os componentes-base contra reintrodução de alturas, raios
ou durações locais já cobertos pelo registro. A regra é intencionalmente limitada a esses
arquivos, onde um token tem alcance transversal.

Ao criar ou modificar um componente:

1. usar o componente compartilhado quando o propósito for o mesmo;
2. usar um token registrado quando for alterar geometria, movimento, fonte ou ação primária;
3. documentar a exceção neste arquivo e no PR quando a medida depender de impressão, gráfico
   ou domínio;
4. não transformar exceção em token global sem comparação visual e revisão de acessibilidade.

## Verificações que continuam necessárias

- teclado completo, leitor de tela, alto contraste e zoom/reflow em navegador;
- contraste de todas as combinações permitidas de cor em cada modo;
- fluxos de domínio que usam classes locais fora dos componentes-base;
- impressão térmica e ZPL em hardware.
