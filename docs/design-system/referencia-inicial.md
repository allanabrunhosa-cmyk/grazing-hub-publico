# Referência inicial fiel ao produto atual

**Estado:** base documental da Etapa 1; não é implementação nem redesenho.

## Referência a preservar

| Elemento | Referência inicial |
| --- | --- |
| Estrutura | `.estrutura-sistema`: lateral à esquerda, painel principal, cabeçalho sticky e conteúdo com fundo estável. |
| Lateral | `16rem` no desktop; raio `1.5rem`; vidro escuro com `blur(32px) saturate(160%)`; escondida abaixo de `768px`, quando `NavegacaoMovel` assume. |
| Cabeçalho | Sticky, mínimo de `4.5rem`, raio `1.5rem`, vidro com `blur(24px) saturate(140%)`; em móvel, mínimo de `4rem`. |
| Tipografia | Fonte nativa do sistema, escala `text-stat`, `text-display`, `text-title` e `text-label` registrada em `globals.css`; não introduzir Poppins nem outra fonte nesta etapa. |
| HUB | Azul-marinho/azul, conforme `:root`; claro e escuro definidos pelas variáveis existentes. |
| Etiquetas | Laranja/marrom, por `[data-identidade="etiquetas"]`; conserva a mesma estrutura, largura lateral, tipografia e geometria do HUB. |
| Vidro | Aplicado à navegação, cabeçalho e sobreposições; tabelas e blocos densos continuam sobre superfícies estáveis. Preferências de contraste/transparência reduzem o efeito. |

**Verificado visualmente:** a prévia local do HUB (`layout.html`) e a de Etiquetas (`etiquetas.html`) exibiram essa mesma moldura, tipografia de sistema, cabeçalho e lateral; os dados eram fictícios e nenhuma ação de negócio foi acionada.

## Navegação aprovada para a Central de Design

### Decisão

**Proposto para a Etapa 2:** a Central de Design será um item expansível na lateral existente de **Configurações**. Seus filhos serão **Fundamentos**, **Componentes** e **Gestão**. Não haverá segunda coluna lateral.

O item deve manter o mesmo `NavLink` da lateral atual: altura mínima de `2.75rem`, ícone, texto, estado ativo e foco. A expansão adiciona somente uma lista filha indentada dentro da mesma lateral de `16rem`; não altera cabeçalho, tipografia, vidro, marca ou o conteúdo operacional.

| Nó proposto | Caminho | Estado de rota e permissão atuais |
| --- | --- | --- |
| Central de Design | `/configuracoes/design` | **Proposto.** Não existe em `src/app/(protegido)/configuracoes/` nem no `CATALOGO`. |
| Fundamentos | `/configuracoes/design/fundamentos` | **Proposto.** Agrupa temas, cores, tipografia, layout, superfícies e acessibilidade. |
| Componentes | `/configuracoes/design/componentes` | **Proposto.** Agrupa controles reais, navegação, dados e feedback. |
| Gestão | `/configuracoes/design/gestao` | **Proposto.** Agrupa rascunhos, versões, revisão e publicação, quando existirem. |

**Vínculo de autorização ainda pendente:** hoje Configurações só expõe `configuracoes.usuarios` e `configuracoes.loja` em `src/lib/permissoes/catalogo.ts`; a página índice redireciona entre elas. A Etapa 2 precisa criar e exigir, no servidor, um recurso próprio (`configuracoes.design`) para administradores ativos. Não é seguro ligar a Central a uma dessas permissões existentes só porque aparece no mesmo módulo.

### Comportamento proposto

- **Expandir/recolher:** clique, Enter ou Espaço no item Central de Design alterna apenas sua lista filha. O item se mantém visível e informa `aria-expanded`.
- **Página ativa:** a página filha ativa recebe `aria-current="page"`; o item pai fica com estado visual ativo quando qualquer rota descendente estiver aberta.
- **Teclado:** Tab percorre pai e links filhos na ordem visível; Enter/Espaço alterna o pai; Escape recolhe a lista quando o foco estiver nela e volta ao pai. A implementação deve respeitar o componente primitivo escolhido e ter teste de foco.
- **Móvel:** reutiliza `NavegacaoMovel`; a árvore aparece no mesmo painel móvel, sem lateral secundária fixa. Recolhimento, foco e página ativa seguem o desktop.
- **Retorno de rota:** ao chegar diretamente em uma rota filha, seu grupo abre antes da renderização interativa, evitando que a página ativa fique oculta.

## Reutilização aprovada: Inventário

**Proposto, sem reorganizar módulos nesta etapa:** o mesmo padrão de item expansível pode substituir, em uma etapa futura, a navegação horizontal local de Inventário. A árvore é:

| Filho | Rota existente | Permissão atualmente exigida |
| --- | --- | --- |
| Inventário | `/inventario` | `inventario` |
| Movimentações | `/inventario/movimentacoes` | `inventario` |
| Contagem de Estoque | `/inventario/contagem` | `inventario.contagem` |
| Entrada de Insumos | `/inventario/entrada-avulsa` | `inventario.entrada` |
| Perdas | `/inventario/perdas` | `inventario.perdas` |

Essas rotas e verificações vêm de `src/app/(protegido)/inventario/**/page.tsx`, `src/app/(protegido)/inventario/inventario-nav.tsx` e `src/lib/permissoes/catalogo.ts`. A visibilidade de cada filho deve continuar passando por `podeRota`; não basta mostrar o pai por ter acesso a uma seção irmã. A lógica atual da lateral já faz fallback do item raiz para a primeira rota de Inventário autorizada; a futura árvore deve preservar essa regra.

Outros grupos ou reordenações de módulos são apenas sugestões de avaliação futura. Esta referência não autoriza mudar a arquitetura de módulos, menus ou permissões fora de Central de Design e do padrão reutilizável de Inventário.

## Limites da referência

- A aparência é a configuração de fábrica: valores observados em `src/app/globals.css` e componentes atuais.
- Não há token editável, laboratório, rota, nova permissão, persistência, publicação ou histórico nesta etapa.
- Claro/escuro e as duas identidades foram registrados pelo código; as prévias verificadas visualmente nesta etapa estavam em modo claro.
- Impressão, ZPL, regras fiscais, financeiras, de estoque e autenticação permanecem fora desta referência.

## Ponto de partida da Etapa 2

1. Criar somente a navegação/rotas protegidas e o laboratório com dados fictícios, sem ligar a publicação global.
2. Usar diretamente os componentes e arquivos enumerados em [inventario.md](./inventario.md#arquivos-que-a-etapa-2-deve-usar); não criar cópias de Button, Select, Combobox, Dialog ou Multisseleção.
3. Definir `configuracoes.design` e os testes de autorização no servidor antes de exibir qualquer link a não administradores.
4. Reproduzir primeiro HUB/Etiquetas claro/escuro com os valores observados; só então expor controles de rascunho.
5. Transformar os comportamentos de teclado, contraste, foco e reflow pendentes em cenários verificáveis, sem declarar conformidade antecipadamente.
