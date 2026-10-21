# Clientes e titulares de cobrança

## Objetivo e aceite

Solicitação de 17/10/2026: unificar nomes, cadastrar múltiplos titulares/endereço de cobrança e refletir a seleção em Pedidos, Entrega e Fiscal.

- Informações gerais identifica PF por Nome Completo e PJ por Nome Fantasia.
- Ajuste de 19/10/2026: Informações gerais define o CPF/CNPJ e os nomes canônicos. A Principal repete essa identidade com o vínculo fixado. Razão social e inscrições PJ são editadas nos dados gerais; endereços postais permanecem na cobrança. Somente Cobrança 2…20 pode ter titular e tipo diferentes.
- Principal é a primeira aba e não pode ser removida. Demais abas são Cobrança 2…20.
- CNPJ precede razão social e consulta endereço completo, sem salvar no blur.
- Copiar cobrança usa a aba selecionada e copia somente endereço.
- Cadastro existente oferece aba Pedidos, com as permissões atuais.
- Pedido conserva titular, endereço, lista e índice no snapshot. Fiscal usa essa identidade integralmente. Formatos antigos conservam o comprador original como fallback.
- Dados reais e documentos fiscais anteriores não são regravados para testar.

## Implementação

Identidade aditiva no JSON `ClienteVenda.enderecos` e `PedidoVenda.cobrancaSnapshot`: tipo, nomeCompleto, documento, razaoSocial, inscricaoEstadual e inscricaoMunicipal. Não requer migration. Colunas fiscais legadas são preservadas para consumidores antigos e não restringem terceiros cadastrados somente na cobrança.

`cliente-cobranca.ts` concentra compatibilidade e escolha fiscal. Componentes compartilhados em `vendas/pedidos` atendem Clientes e Pedidos. Consulta pública do CNPJ via BrasilAPI, autenticada por ações próprias de cada módulo. Campos ausentes na fonte não são inventados.

Componentes de referência: CadastroClientePedido, CobrancaClientePedido, CamposEnderecoPedido, Campo/Input/Select, Tabs line/buttons, BotaoRemoverItem e EditorVenda. Sem nova variante ou token. Referência visual Em revisão.

Execução e evidências em [TASKS](TASKS.md).

## Principal vinculada — 19/10/2026

A Principal não permite trocar tipo, documento ou nomes diretamente. O botão de vínculo permanece fixado e indisponível. Endereço postal pode ser alterado. Os dados gerais alimentam a Principal no cadastro e em novos pedidos/orçamentos. A consulta de CNPJ dos dados gerais preenche o endereço da Principal e bloqueia gravação durante a resposta.

O servidor reconcilia o primeiro endereço com a identidade geral antes da persistência. Documentos guardados apenas no JSON pela versão anterior são recuperados quando o tipo coincide e o cadastro não tem documento geral. Cobranças adicionais conservam seus próprios titulares. Em pedidos, o servidor obtém a identidade da Principal do cadastro salvo, não do titular enviado pelo navegador.

Pedidos confirmados conservam sua fotografia. Edição postal da Principal mantém a identidade histórica; não consulta o cadastro atual para substituí-la. Formatos antigos sem índice não permitem presumir qual aba originou a cobrança. Sem migration ou regravação em lote.
