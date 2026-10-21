# Complementos

## Organização solicitada em 21/10/2026

- Cada cadastro usa uma classificação: **Produto** (`PRINCIPAL`) permite venda avulsa;
  **Complemento** exige hospedagem em produto. `OPCAO` e múltiplos papéis são somente
  compatibilidade de leitura; prevalece Produto se houver `PRINCIPAL`. Produtos também
  podem ser escolhas de grupos, sem mudar sua classificação. Tipos internos legados
  permanecem preservados, sem escolha de classes na interface.
- Categoria de Produto pertence ao cardápio do site. Categoria de Complemento é opcional,
  tem cor e aparece em coluna própria como tag. Categoria de Grupo organiza somente grupos.
- `CategoriaVenda.escopo/cor` separam as duas primeiras finalidades. A migration manual
  `20261021210000_categorias_complementos` duplica categorias utilizadas por complementos,
  transfere somente esses vínculos e incrementa suas revisões. Preserva nomes, ordem,
  atividade, identidades de produtos/grupos, composição e pedidos históricos. Nome é
  único por escopo. Backup íntegro precede a aplicação produtiva.
- Grupos selecionam produtos e complementos cadastrados. Novas escolhas herdam preço e
  composição por referência. Ajustes no grupo ou no produto não regravam o padrão.
  A precedência continua produto > grupo > cadastro; porções mantêm sua precisão.
- Produtos, Complementos e Grupos têm Disponibilidade com vínculos e estados reais do
  cadastro, inclusive pausas e exclusões locais. Habilitação cadastral não comprova
  sincronização com plataforma externa. Sem operações reais para testar.

Aceite: isolamento de categorias no servidor e na UI; somente duas classificações;
tags coloridas; seleção de Produto em grupo; composição padrão de uma porção e meia
porção em um único produto; disponibilidade correta; autorização/revisão/auditoria
preservadas; migrations e fluxos em base sintética; QA visual isolado; publicação
autorizada pelo usuário somente após validações. Execução corrente na seção
Organização de TASKS.md. As seções abaixo registram a implantação anterior;
preço único e organização atual seguem o contrato de Vendas.

## Objetivo e aceite

Cardápio reúne Produtos e Complementos na navegação de Vendas & Pedidos. Complementos tem lista de cadastros na primeira aba e grupos na segunda. Cadastro simples: nome, foto, categorias, preços Site/iFood (incluindo zero) e composição pelo editor de ingredientes existente, sem FM. Complementos são escolhas dentro de produtos. Cadastros podem existir antes de receber um grupo.

Preço e composição podem ser substituídos no grupo e no vínculo do produto. A linha apresenta nome, preço, status e X; expansão discreta revela composição. Pausa no produto oferece escopo local ou todos os produtos. Alterações do formulário são confirmadas em Salvar, incluindo a pausa global; cancelamento conserva os dados persistidos.

## Arquitetura

ProdutoVenda continua sendo a identidade comercial/fiscal. precoComplemento nullable preserva preços antigos; OpcaoComplementoVenda.composicao e ProdutoGrupoVenda.ajustesOpcoes usam JSON validado de componentes. Ausência de substituição herda o nível anterior. Opções removidas/pausadas conservam identidade e snapshots. Quantidades e porções seguem Vendas/Insumos, dinheiro em centavos e transação/auditoria/versionamento existentes.

Consultas e resolutores de Vendas/Pedidos devem aplicar a mesma precedência vínculo específico > grupo > padrão do complemento. Complementos deixam de aparecer na seleção avulsa de novos itens; contratos históricos são preservados. Sem emissão fiscal, alteração de estoque ou operações reais para testes.

Novo Pedido apresenta apenas grupos com mínimo efetivo positivo, respeitando a substituição no vínculo do produto; Extras nunca são obrigatórios. Grupos abertos/expansíveis usam linhas `SlotComplemento`, compartilhadas com o cadastro, com nome, preço somente leitura e quantidade. Escolhas históricas opcionais permanecem nos snapshots e valores; ocultar o grupo não apaga essas escolhas nem altera a validação do servidor.

Permissões existentes de produtos/catálogo são conferidas no servidor. Pausas globais exigem editar catálogo e revisão de todos os grupos envolvidos; conflito desfaz toda a gravação. Migration SQL aditiva 20261005010000. UI reutiliza Tabs, Table, status-ativo, remover-item e ComposicaoProduto. Referência visual Em revisão até aprovação humana.

## Complementos existentes e tabelas por canal

O editor da opção exibe diretamente os ingredientes; o seletor “Complemento para composição” foi retirado. O vínculo comercial existente permanece interno para identidade, preço por canal e compatibilidade. Uma opção com composição própria também funciona sem esse vínculo; sua quantidade já representa uma escolha.

A lista e o cadastro têm preços Site e iFood em `PrecoProdutoVenda`; `precoComplemento` conserva o padrão Site para compatibilidade. `OpcaoComplementoVenda.usarPrecoPadrao` permite herdar o preço do canal antes das substituições do grupo/produto. Editar o preço desliga a herança; “Usar preço do cadastro” a restaura. A migration aditiva `20261005043000_complementos_preco_canal` inicia a flag desligada para conservar grupos antigos, inclusive escolhas grátis.

Carga inicial autorizada: reunir todos os nomes de opções em cadastros, reutilizando identidades existentes e preservando outros papéis comerciais. Usar insumos correspondentes e uma porção cadastrada quando disponível; sem porção, medidas indicadas no nome ou estimativas iniciais revisáveis. Preços dos Extras vêm do site público Grazing Table; demais itens conservam a referência dos grupos. iFood existente é preservado; valores novos começam pelo Site. A operação administrativa exige acesso SSH autorizado, backup íntegro, revisões atuais, transação, auditoria e chave de idempotência; não movimenta estoque ou financeiro. Manifestos, exportações e backups reais permanecem privados e fora do Git.

## Cardápio e listagem comercial

Cardápio é `GrupoNavegacao`, sem página própria, e reúne as URLs existentes de Produtos/Complementos. Reutiliza permissões, indicação de página ativa e navegação por teclado em desktop/celular; não aparece sem filhos permitidos.

Complementos reutiliza `ProdutosVenda` com escopo de Complemento, duas colunas fixas IFOOD/SITE e editor simples específico. Mantém foto, categorias, preços, desconto e CMV pelo mesmo `PrecoCanal`, com confirmação por check/Enter, cancelamento por X/Escape e sem gravação ao perder foco. Não exibe coluna Giuliana Flores ou impressão de ficha. Outros preços existentes permanecem no cadastro ao editar; CMV sem composição/custo é pendente. Categorias vazias não ocupam a consulta geral de complementos, mas a categoria escolhida pode receber cadastros novos. Não altera o filtro/papel anterior da tela de Produtos.

`FotoCampo` é compartilhado com rótulo do complemento, envio autenticado e remoção pelo X oficial. O arquivo enviado entra no rascunho; Salvar aguarda o envio. Foto/categorias/composição são confirmadas no salvamento do cadastro. O preço original reserva a mesma altura com/sem promoção em `PrecoCanal`, alinhando campos, desconto e CMV nas duas telas. Sem migration, novo recurso de permissão ou alteração de dados produtivos por esta mudança de interface. Referência visual Em revisão.
