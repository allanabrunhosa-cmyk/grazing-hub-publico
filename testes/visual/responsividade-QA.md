# Prévia de responsividade

Somente dados fictícios e ações simuladas; não conecta ao banco.
Executar `vite --config testes/visual/responsividade.vite.config.mts`.
Abrir `http://127.0.0.1:4227/responsividade.html?rota=/insumos`.

Rotas de cenário: `/insumos`, `/fornecedores`, `/inventario/contagem`,
`/financeiro`, `/contratos`, `/producao/etiquetas`.
`/contratos` possui duas tabelas longas independentes, com seleção antes do nome,
e um editor com colgroup legado e texto originalmente truncado.

Validades usa também `responsividade-etiquetas.html`, com configurações e
Prazos dos produtos. Produtos utiliza a prévia existente de Vendas com
`?rota=/vendas/produtos`. Todos os dados dessas prévias são fictícios.

Matriz: 360, 390, 768, 1024, 1366 e 1920px; altura 844px (celular) / 900px (demais).
Desktop: expandir/recolher a lateral, recarregar e conferir preferência.
Mobile: abrir/fechar a navegação sobreposta; não reservar espaço lateral.
Conferir filtros, formulário de Insumo/Fornecedor, submenus, conta e tema,
rolagem horizontal/vertical, seleção, identificação fixa e paginação.
As ações de salvar/excluir são simuladas. Não validar regras de negócio aqui.
