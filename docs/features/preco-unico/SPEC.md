# Preço único e canais informativos

Publicação autorizada em 05/10/2026. Execução: [Vendas](../../execucao-vendas.md).

- Produto e complemento têm um preço comercial, em centavos, sem tabela, promoção
  ou disponibilidade por canal. Consolidação aprovada: valor vigente do Site,
  incluindo promoção; na ausência de Site, valor disponível no cadastro.
- Canal identifica a origem do pedido e segmenta consultas/relatórios. Não altera
  preço, escolhas ou disponibilidade. Confirmação financeira
  HUB usava categoria explícita da condição financeira (substituído em 05/10/2026:
  a categoria de receita volta a ser a do canal; ver [Pedidos](../pedidos/SPEC.md)); mudança de canal conserva
  os títulos existentes. Datas/valores/snapshots de vendas anteriores não mudam.
  Revisão de canal, observações, embalagem ou encargos conserva o preço histórico
  dos itens comercialmente inalterados; embalagem nova exige cadastro ativo.
- Preços de escolhas grátis/incluídas e ajustes de composição existentes continuam
  sem dependência de canal. Herança do preço do complemento usa o preço único.
- Migration SQL aditiva introduz `ProdutoVenda.preco`, preenche deterministicamente,
  audita antes/depois e incrementa revisão. Tabela/campos anteriores ficam apenas
  como arquivo legado para reversão; nenhum fluxo de preço vigente lê ou grava neles.
  Exclusão autorizada de produto remove seus preços legados para respeitar as relações.
  Reversão para código que usa preços por canal exige reconciliar previamente edições
  feitas no preço único após a publicação. Não restaurar dump sobre transações novas.
- Cadastro, edição inline, importação, simulador, catálogo de pedidos, confirmação,
  revisão, orçamento, CMV e snapshots novos usam o contrato único. Ação antiga por
  canal e interface correspondente são retiradas. Autorização, revisão, precisão,
  salvamento explícito, auditoria e idempotência permanecem no servidor.

Aceite: mesmos produtos/valores/escolhas para quaisquer canais; alteração de canal
sem reprecificação ou reclassificação financeira; preservação de pedidos históricos;
validação de migration em PostgreSQL isolado, testes de contratos/consumidores e
regressão completa, lint/design/tipos/build/smoke, imagens fictícias e verificação
autenticada depois da publicação. Backup privado íntegro e imagem anterior antes
do deploy. Sem transações operacionais reais para testar.
