# Códigos comerciais dos produtos

Código alfanumérico de até oito caracteres, exibido no cadastro e na ficha técnica.
O identificador técnico e os documentos anteriores permanecem intactos.

O padrão automático é `P0400001`: P para Produto ou C para Complemento, dois dígitos
da categoria de origem e cinco da sequência. Família 00 indica ausência de categoria.
As famílias seguem a ordem inicial do catálogo. A numeração fica registrada no cadastro
central da empresa. Renomear/reordenar categorias não muda os códigos atribuídos.
Cadastros com várias categorias usam a primeira família já registrada. Códigos curtos
existentes são preservados. Os últimos números não são reutilizados após exclusão.

`ProdutoVenda.codigo` é reutilizado. `ConfiguracaoLoja.codigosProdutos` guarda o mapa e
os últimos números comerciais; não é contador fiscal. A migração SQL é aditiva.
Geração e histórico usam a transação e a trava de cadastros existentes. A organização
em lote exige permissão central de editar Produtos, reconferida no servidor.

Novas prévias fiscais fotografam o código e o vínculo com o produto. Notas autorizadas,
tentativas incertas, snapshots comerciais, tributos, preços, estoque e financeiro não
são reescritos. Não há transmissão nesta tarefa.

Aceite: códigos únicos e estáveis de até oito caracteres; geração concorrente segura;
cadastro/ficha e próximas notas usam o código; persistência e auditoria verificadas;
testes sintéticos isolados e publicação autorizada conferida no HUB.
