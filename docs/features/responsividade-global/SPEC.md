# Responsividade global

## Objetivo e escopo

Conforto em desktop, tablet e celular preservando identidade, navegação, permissões
e fluxos. Ajustes nas bases de navegação, Table, cabeçalho e portais; consumidores
com mínimos artificiais ou tabela HTML própria migram para o contrato comum.
Sem mudanças de banco, migrations ou integrações operacionais. Publicação em
produção autorizada pelo usuário em 09/10, após as validações desta revisão.

## Contrato

- HUB e Validades: lateral expandida conforme o token existente ou recolhida em
  4,5rem. Preferência visual local por usuário, sem modificar sessão. Mobile até
  767px mantém Dialog sobre o conteúdo, sempre com nomes e submenus completos.
- Ícones recolhidos têm nome acessível e Tooltip Base UI em portal (hover/foco).
  Grupos usam Popover lateral com nomes e indicação da rota ativa; Escape retorna
  ao gatilho. ACL e destinos externos permanecem os mesmos.
- Table conserva tipografia e valores, permite quebra nas descrições e contém a
  rolagem. Identificação explícita por índice onde data/tipo/categoria antecedem
  o registro; seleção anterior e identificação fixam juntas com offsets medidos.
  Linhas expandidas/colspan não recebem fixação indevida.
- Somente tabelas com excesso horizontal ganham scrollport delimitado pela área
  visível. Tabelas largas e longas têm rolagem vertical interna, mantendo a barra
  horizontal nativa abaixo dos registros. Essa decisão evita sobrepor linhas,
  paginação ou controles fixos e dispensa duas barras a sincronizar. A barra
  nativa acompanha diretamente a posição real, incluindo toque e teclado.
- ResizeObserver e atualizações dos registros recalculam overflow e colunas;
  janela, zoom móvel e regiões de diálogo recalculam altura. Sem barra global
  concorrente: cada tabela controla sua própria área. Impressão não limita altura.
- O catálogo comercial já reorganiza linhas no celular; esse comportamento
  existente permanece. Não substituir outras tabelas por cards.

## Caminhos

`src/components/layout/{menu-lateral,sidebar,grupo-navegacao,nav-link,module-switcher}.tsx`,
`src/components/ui/{tooltip,table,table-responsiva,dropdown-menu}`,
`src/app/globals.css`, layout protegido e catálogo tipado da Central.
Contratos visuais em [padrões](../../design-system/padroes.md) e
[inventário](../../design-system/inventario.md). Referências novas **Em revisão**.

## Aceite

- Conferir 360, 390, 768, 1024, 1366 e 1920px com ambos os estados da lateral
  onde ela é aplicável; abaixo de 768, conferir abertura/fechamento móvel.
- Insumos, Fornecedores/Contagem, Financeiro, Produtos/Pedidos e Validades:
  textos extensos, tabelas longas, seleção, filtros, ações e formulários.
- Sem rolagem lateral da página, sobreposição da seleção/nome ou perda de ações.
  Conferir teclado, foco e gesto de toque nas ferramentas disponíveis; distinguir
  emulação de toque de teste em aparelho físico.
- Regressão global, consumidores, lint, lint:design, tipos e build. A aprovação
  técnica não significa publicação nem certificação completa de acessibilidade.
