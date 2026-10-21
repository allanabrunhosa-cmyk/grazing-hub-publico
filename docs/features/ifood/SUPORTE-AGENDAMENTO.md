# Relato enviado — agendamento de teste

**Retomada em 08/10/2026:** chamado 34526755 continua Em análise, sem orientação técnica nova. Order/Events aprovado não resolveu o bloqueio do cliente: nova tentativa pelo Portal retornou **Falha ao cadastrar e-mail**, sem causa/código. Nenhum contato/credencial foi copiado para este documento.

Às **16h45**, complemento enviado no mesmo chamado, com persistência conferida após reabrir: informar que a falha permanece após aprovação e pedir regularização do cliente, procedimento de SCHEDULED válido e cenários oficiais de parciais/alternativas/benefícios, sem reiniciar homologação nem alterar datas. Nenhum novo pedido foi gerado para repetir o cenário IMMEDIATE. Agendado válido, ensaios especializados e impressão física permanecem pendentes. O roteiro físico está em OPERACAO; a conferência do papel só será solicitada quando houver pedido válido e comanda preparada.

Consulta: 06–07/10/2026, America/Sao_Paulo. Food Order v1.0. **Protocolo 34526755, enviado em 07/10/2026 às 13h28; Em análise.**

Aplicativo em homologação: Grazing HUB, centralizado, PDV. Credencial de teste
TEST (C). Merchant de teste: 973d35a2-6069-4dc4-b2a7-581775a372fa.
Pedido: cc23522d-2544-4dff-9e6f-c56d4cb8c7c1, displayId 2070.

O pedido agendado gerado pelo assistente automático retornou os seguintes campos
em `GET /order/v1.0/orders/{id}`. A consulta posterior reproduziu os mesmos valores:

| Campo | Valor original UTC | Exibição America/Sao_Paulo |
|---|---|---|
| createdAt | 2026-10-07T00:39:44.280Z | 06/10/2026 21:39:44 |
| preparationStartDateTime | 2026-01-22T18:20:24.778Z | 22/01/2026 15:20:24 |
| schedule.deliveryDateTimeStart | 2026-10-07T05:39:44.280Z | 07/10/2026 02:39:44 |
| schedule.deliveryDateTimeEnd | 2026-10-07T06:39:44.280Z | 07/10/2026 03:39:44 |
| delivery.deliveryDateTime | 2026-10-07T05:39:44.280Z | 07/10/2026 02:39:44 |

`orderTiming=SCHEDULED`, `isTest=true`. Normalização e banco preservam o início
de preparo em janeiro. O prazo técnico calculado a partir dele expirou antes da
criação. O HUB não alterou datas nem enviou confirmação fora do prazo. O pedido
recebeu CANCELLED após o encerramento do assistente; não atribuímos causa sem
evidência do fornecedor.

Solicitamos orientação para gerar um pedido **agendado válido** na loja de teste,
com preparo coerente com a criação e a janela. O gerador manual disponível oferece
somente loja e categoria FOOD, sem controle do agendamento. Em nova tentativa,
gerou b2c9d2a2-40a4-4883-9ba7-7830e15e5381 com `orderTiming=IMMEDIATE`,
createdAt/preparationStartDateTime=2026-10-07T02:15:17.731Z. Esse teste comprova
nova recepção, mas não valida agendamento. Não reiniciamos a homologação automática.

Referências consultadas em 06/10/2026:
[referência v1.0](https://developer.ifood.com.br/pt-BR/docs/references),
[detalhes](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/details),
[agendados](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/scheduled-orders).
O exemplo do guia de agendados usa `scheduled`; referência HTTP e resposta efetiva
usam `schedule` e preparationStartDateTime no nível principal. O HUB segue estes
últimos. Nenhum payload privado completo ou credencial está neste relato.

## Envio e resposta

Usuário autorizou especificamente o envio nesta retomada. O relato acima foi
revisado e enviado como texto, sem anexos ou payloads completos, pelo
[chamado 34526755](https://developer.ifood.com.br/pt-BR/developer/tickets/7bad8ada-d833-4ae5-83de-1654955b164a).
Formulário inicialmente Incidente; a triagem automática reclassificou para Dúvidas
ou Informações / Outras / Outras dúvidas e não produziu orientação detalhada.
Escolhida a continuidade para abertura efetiva; Portal confirmou sucesso e protocolo.

Até a leitura do histórico nesta retomada, somente confirmação automática de recebimento,
sem instrução técnica para gerar SCHEDULED válido. Não há novo agendado válido
nem ensaio físico comprovado. Aguardar orientação deste chamado; não reiniciar
Order/Events, alterar datas ou enviar confirmação expirada. O gerador manual foi
reconferido nesta retomada: somente loja e FOOD, sem campos de agendamento,
cancelamento parcial, alternativas ou benefícios. Pedidos IMMEDIATE não são
apresentados como cobertura desses cenários.

Às **14h44 de 07/10**, complemento enviado e conferido neste mesmo chamado:
tentativa de cadastrar o e-mail corporativo reservado aos testes em Pedidos de
teste → Usuário de testes retornou **Falha ao cadastrar e-mail**, sem motivo/código.
O gerador havia associado o pedido ffcde7fc-71d0-4d17-a5b2-3c8542de9f68 ao cliente
padrão noreply@developer.ifood.com.br, sem acesso do cliente ao pedido. Informados
ID TESTE, modalidade IMMEDIATE e encerramento do diagnóstico por CFM/CAN oficiais,
sem títulos/estoque operacional. Solicitada orientação para regularizar o usuário
de testes e gerar SCHEDULED válido, preservando Order/Events. Não transmitidos
e-mails pessoais/corporativos do usuário, documentos, tokens ou payloads completos.
Resposta técnica ainda pendente; cadastro/sessão do cliente não declarados concluídos.
