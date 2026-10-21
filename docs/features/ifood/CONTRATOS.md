# Contratos iFood — Food

## Projeção dos detalhes Merchant — 12/10/2026

GET `/merchant/v1.0/merchants/{merchantId}`, resposta200. Conferidos os [campos oficiais](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/endpoints) e [operações/canais](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/operations), HTTPv1.0, consulta12/10/2026, sem revisão editorial informada; schema corroborado pelo snapshot privado real TEST(C).

`merchant-detalhes.ts/lerDetalhesMerchant` projeta somente id, name, corporateName, description, averageTicket, exclusive, type, createdAt, test, status, address e operations/salesChannels. Campos adicionais desconhecidos ficam no servidor. ID precisa coincidir com o vínculo consultado; zero/false e ausência são distintos. `createdAt` é apresentado como recebido, sem inventar offset; `averageTicket` mantém a unidade recebida, sem conversão para centavos ou indicação monetária não comprovada. Não produz receita, pagamento ou mudança operacional.

`merchant.ts/consultarDetalhesMerchant` reutiliza o transporte/token e as guardas de conta/loja/ambiente, relendo a autorização após a resposta. A ação exige `configuracoes.loja/editar`, conforme as consultas da configuração atual. Estado cadastral não é disponibilidade; esta segue no GET status existente. Nenhuma nova migration ou permissão global.

## Detalhes e financeiro contextual — 08/10/2026

Conferência adicional: [workflow](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/workflow),
[eventos](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/events),
[endpoints](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/endpoints)
e [Handshake detalhado](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/handshake-platform-guide).
Abas Pedido/Histórico e Dialog contextual não mudam contratos por estado/modalidade,
motivos, alternativas, prazos, impressão, confirmação remota ou reconciliação.

`LojaIfood.financeiroConfig` mapeia métodos do Order para formas ativas do HUB e prazo
previsto da confirmação. Dias úteis excluem fins de semana; feriados não são inferidos.
Configuração versionada/auditada em cadastro, sem liberar transporte ou autoaceite.
Sem vínculo válido, recepção/eventos continuam e a projeção permanece pendente; salvar
configuração reavalia snapshots pendentes em transações locais sem replay remoto.

CAN permanece distinto de CAR; RECUSADA/INCERTA/AGUARDANDO_EVENTO seguem explícitos.
CAN cancela pendentes preservando recebimentos; tratamento de valores recebidos no HUB
é solicitado uma vez e concluído somente com comprovação. Pedido sem pagamento no HUB
não recebe devolução fictícia. Refund do consumidor no provedor não é presumido concluído.
Não há botão financeiro/estorno independente no detalhe. Limites após OPA que altere
títulos já liquidados permanecem pendência explícita de conferência, sem apagar registros.

Consulta: 05–07/10/2026, America/Sao_Paulo. Referência HTTP v1.0, sem número de revisão editorial disponível. Na primeira entrega não havia app autorizado; na retomada de 06/10, autenticação centralizada e merchant TEST foram conferidos pela API. Isso não comprova homologação ou acesso à loja real.

Correção comprovada em 06/10 21:30: o pedido gerado no portal envia **isTest**,
conforme [Order details](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/details).
A primeira implementação usava `test` e a fixture repetia esse erro. Adaptador e
fixture corrigidos; campo ausente/inválido é bloqueado nos dois ambientes. Não
aceitar `test` como autorização implícita. O evento recebido antes da correção
permaneceu persistido e confirmado no ACK, aguardando retomada do processamento.

## Fontes oficiais e divergências

- [Authentication](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/authentication/intro): token com expiração dinâmica; modalidades dependem do app. Permissão alterada pode levar até dez minutos e exige token atualizado.
- [Referência de API](https://developer.ifood.com.br/pt-BR/docs/references): parâmetros HTTP consultados no Swagger renderizado, operações Authentication, Merchant, Events e Order.
- [Polling](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/polling-overview): cadência de 30 segundos; persistência antes do ACK.
- [Códigos de eventos](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/order-events): códigos curtos e completos; PRS é preparo Food. SPS/SPE são separação Groceries e não viram preparo Food.
- [Workflow](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/workflow) e [agendados](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/scheduled-orders): confirmação até oito minutos de createdAt para imediato; até oito minutos de preparationStartDateTime para agendado; não iniciar preparo antecipado.
- [Negociação](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/order/handshake-platform): metadados de disputa e expiração; Amount.value de negociação é string em **centavos**, diferentemente do pedido.
- [Política de homologação](https://developer.ifood.com.br/en-US/docs/getting-started/homologation/categories), [Events](https://developer.ifood.com.br/en-US/docs/food/guides/modules/events/homologation) e [cadastro](https://developer.ifood.com.br/en-US/docs/getting-started/first-steps/create-app): consultados também no índice oficial quando o portal português apresentou bloqueio automatizado. Nenhuma proteção foi contornada.

Portal autenticado em 06/10: o assistente de homologação informa Order/Events e
Analytics Food no fluxo automatizado, demais módulos por ticket. Analytics permanece
fora do escopo. Aplicativos TEST não aparecem como elegíveis; é necessário cadastrar
um PDV em desenvolvimento. Não iniciar ticket ou declarar aprovação sem evidência.

Divergências encontradas e tratamento:

| Divergência | Decisão verificável |
|---|---|
| Workflow exemplifica order/v1.0/orders:polling, envelope events e IDs/códigos ilustrativos | Usar Events v1.0 da referência: array e eventos PLC/PLACED etc. Não copiar exemplos ilustrativos como contrato |
| Introdução e referência mencionam validades distintas de token | Usar exclusivamente expiresIn da resposta; não fixar três/seis horas |
| Guia exemplifica corpo deliveredBy em dispatch | Referência v1.0 não declara corpo: POST sem corpo |
| merchantId ausente no exemplo da referência Events | Uma única loja no filtro x-polling-merchants fornece contexto; se merchantId vier, deve coincidir |
| Guia Handshake detalhado exige reason/detailReason condicional; referência accept omite body | Seguir o contrato condicional explícito do guia de implementação, incluindo seus exemplos HTTP; motivo deve estar em acceptCancellationReasons. Aceite simples segue sem body. Implementado/testado localmente; aceite condicional real ainda não ensaiado |
| Visão geral usa /alternative; referência declara /alternatives/{alternativeId} | Adotar POST plural da referência v1.0 com ID oferecido pelo evento |
| Guia agendado exemplifica scheduled; referência/details e pedido real usam schedule | Adotar schedule.deliveryDateTimeStart/End e preparationStartDateTime separados; não inferir horário exato da janela |
| Guia Merchant descreve array de horários; referência e resposta real usam objeto | Adotar {storeId,shifts}; PUT substitui os turnos completos, com verificação posterior por GET |
| Eventos ilustrativos de Order usam nomes incompatíveis com tabela Events | Usar pares exatos da tabela Events. Par desconhecido é diagnosticado sem transição |

## Autenticação e Merchant

Base fixa: https://merchant-api.ifood.com.br. Sem redirects. Segredos apenas no servidor.

| Operação | Contrato adotado |
|---|---|
| POST /authentication/v1.0/oauth/userCode | application/x-www-form-urlencoded, clientId; retorna userCode, authorizationCodeVerifier, verificationUrl e expiresIn |
| POST /authentication/v1.0/oauth/token | formulário: grantType, clientId, clientSecret; authorization_code acrescenta authorizationCode e authorizationCodeVerifier; refresh_token acrescenta refreshToken; centralizado usa client_credentials |
| GET /merchant/v1.0/merchants | Bearer; page começa em 1; size=100; array id/name; verificar listagem efetiva |
| GET /merchant/v1.0/merchants/{id} | Revalidar autorização no coletor; 401/403 bloqueiam loja |
| GET /merchant/v1.0/merchants/{id}/status | Consulta explícita autorizada: operação, canal, available e state; HTTP 200 não comprova disponibilidade. Estado desconhecido permanece indicado como desconhecido |

Consulta complementar em 06/10/2026: [Merchant — endpoints](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/endpoints) e [operações](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/operations), v1.0. O roteiro autenticado de homologação exige evidência de conectividade e estado da loja; configuração do HUB oferece essa consulta sem alterar horário ou disponibilidade.

Distribuído liga solicitação aleatória, usuário, versão da sessão, hash do cookie de sessão, integração e prazo ao verificador cifrado. O cookie não é enviado ao iFood nem armazenado em texto. Outra sessão não consegue concluir a solicitação; logout/revogação exige novo vínculo.

## Eventos

GET /events/v1.0/events:polling, Authorization: Bearer, x-polling-merchants: UUID. Referência limita até 100 merchants; usamos um. Sem filtros de grupos/tipos/categorias: filtros podem confirmar automaticamente eventos omitidos. 200 array, 204 sem eventos. Polling documentado com limite de 6.000 requisições/minuto; o HUB trabalha com cadência por loja de pelo menos 30 s, não usa o teto como meta. Validar limites efetivos do app no teste autorizado.

POST /events/v1.0/events/acknowledgment: JSON [{id: UUID}], até 10.000 IDs, retorno 202. ACK só após commit da inbox/tarefa. ACK perdido pode ser repetido. Eventos sem orderId também são retidos e diagnosticados. ACK não confirma a venda.

**Divergência documental conferida em 09/10/2026:** a prosa de Acknowledgment no [guia Polling](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/polling-overview) e o [checklist Order/Events](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/homologation) limitam a chamada a **2.000 IDs**, mas a seção de API da mesma página, incluindo a resposta 413, e a referência HTTP v1.0 informam **10.000**. O coletor envia conservadoramente até **2.000 por ciclo**, retomando o restante durável no próximo; guarda defensiva do transporte continua 10.000. Essa escolha satisfaz ambos os limites sem afirmar qual texto prevalece. PostgreSQL isolado/HTTP simulado comprovou lotes [2.000,1] para 2.001 IDs, sem duplicação nem ACK de evento não persistido. Não usar lote acima de 2.000 sem resolver a divergência.

Lease por loja de 120 s, SKIP LOCKED e verificação de posse após a consulta; cada request limita a espera a dez segundos. Dois processos separados evitam que impressão/processamento atrase o coletor. Data de fila comparada em UTC, inclusive quando PostgreSQL usa America/Sao_Paulo.

### Piloto temporário por loja — contrato preparado em 09/10/2026

Consulta oficial no Chrome em **08–09/10/2026**, America/Sao_Paulo; referência HTTP v1.0, sem revisão editorial informada. Em 09/10, a seção **Múltiplos devices ou aplicativos** do [guia Polling em português](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/polling-overview) confirmou que o device é único por aplicativo, baseado nas credenciais, e controla o ACK independentemente. Aplicativos distintos podem consumir a mesma loja e devem refletir eventos de outros consumidores. A associação entre aplicação/credenciais e device deixou de ser uma lacuna documental; dois tokens do mesmo aplicativo não constituem, por si, dois aplicativos independentes. A convivência concreta com o Takeat ainda exige validação, sem confundir contrato publicado com ensaio realizado.

A [política de homologação](https://developer.ifood.com.br/en-US/docs/getting-started/homologation/categories) restringe módulos operacionais em aplicativos **exclusivamente consultivos**, com exceções Financial/Analytics. O grazing-hub permanece um PDV operacional já homologado em Order/Events; o modo temporário é por loja e não remove suas funções operacionais. Não extrapolar essa regra para uma exigência de nova homologação de qualquer piloto. Foi pedido esclarecimento sobre sua aplicabilidade específica, junto à proteção da presença, no chamado de Dúvidas/Informações **34526755**, em **09/10 às 14h07**, com envio e persistência conferidos. Merchant 34526571 permanece reservado à homologação desse módulo, conforme orientação do suporte. [Registro do complemento enviado](MERCHANT-HOMOLOGACAO.md#complemento-preparado--piloto-temporário-de-acompanhamento--09102026).

[Polling](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/polling-overview) mantém cadência de 30 s e filtro `x-polling-merchants`; sua orientação de `excludeHeartbeat=true` destina-se a integradoras logísticas. Não presumir aplicação ao PDV nem acrescentar esse parâmetro. [Presença](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/presence) documenta heartbeat pelo polling 200/204, inclusive vazio, e pelo webhook. Parar polling não garante retirada imediata da presença. **Inferência operacional:** o estado agregado do merchant não comprova que o Takeat esteja conectado, pois o próprio HUB pode sustentar presença. Janela interna limita a duração desse risco; não comprova proteção da disponibilidade do sistema principal. A solução permitida depende da orientação oficial antes da ativação.

| Limite interno preparado | Regra |
|---|---|
| Modo por loja | `LojaIfood.modoOperacao=ACOMPANHAMENTO`, exibido como **Acompanhamento — Takeat**. Preparar mantém a recepção pausada; não converte vínculo com pedidos operacionais anteriores. |
| Identidade e duração | Aplicativos/credenciais independentes seguem o contrato de device/ACK publicado; conferir as identidades efetivas e testar a convivência. Referências sobre enquadramento/presença e janela futura de **1–120 minutos** são controles internos preparados, não novas exigências de homologação declaradas pelo iFood. |
| Recepção real separada | `IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO=0` e `IFOOD_ACOMPANHAMENTO_MERCHANT_ID` vazio por padrão. O usuário autorizou nesta execução a recepção real somente em **Acompanhamento — Takeat**, após validar suas condições; isso não autoriza comandos. A liberação é restrita ao ID exato da única loja permitida no servidor; preparar outra loja na UI não libera sua recepção. `IFOOD_PRODUCAO_AUTORIZADA=0` continua bloqueando operação comercial real. Autorização do usuário não comprova ativação nem resolve, sozinha, a proteção da presença. |
| Transporte e persistência | Preservar autenticação, GET por loja e ACK de eventos já persistidos, sem filtros que descartem eventos de outro aplicativo. Cada evento é a tarefa durável; deduplicação por loja/evento e loja/pedido externo permanece. ACK não confirma comercialmente o pedido. |
| Pedido existente e histórico | Criar o mesmo `PedidoVenda` do gestor atual, com `PedidoIfood.acompanhamento` fixado na entrada. A restrição permanece no histórico mesmo após pausa/expiração ou mudança futura da configuração. Ambiente e `isTest` continuam seguindo o contrato recebido; pedido real nunca vira pedido de teste. |
| Comandos e efeitos | Bloquear comandos Order/negociação/Merchant e efeitos locais de financeiro, estoque, fiscal e impressão operacional em serviços comuns, transporte e workers, inclusive para administrador/API/MCP. Eventos do sistema principal podem atualizar estados, itens e valores para consulta, sem produzir esses efeitos. |
| Pausa e expiração | Janela vencida impede novo polling; coletor pausa apenas o vínculo do HUB. Pausa preserva inbox, pedidos, auditoria e pendências; não escreve disponibilidade, não encerra a integração Takeat e não apaga eventos para zerar indicadores. Retomada requer janela/liberação válidas. |

Estado desta preparação: credenciais definitivas inativas, loja real sem ativação, produção comercial bloqueada, estoque e autoaceite desligados. Este contrato descreve os limites preparados; resultados de testes e revisão ficam em TASKS.md, sem confundir testes locais com coexistência comprovada no iFood ou aprovação do piloto. Financial/Analytics e desenvolvimento fiscal permanecem fora do escopo.

## Estados e matriz de ações

Conferência DDCR em 07/10/2026: os três avisos originais e o quarto recebido no
diagnóstico #9 têm o par exato
`DDCR / DELIVERY_DROP_CODE_REQUESTED`, metadados vazios e pedidos Food com
entrega MERCHANT. Significa solicitação de validação por código de entrega na
[documentação Logistics](https://developer.ifood.com.br/es-CO/docs/food/guides/modules/logistics/best-practices-troubleshooting).
Essa página exige arrivedAtDestination e endpoint Logistics, que não fazem parte
deste fluxo Food. [Shipping externo](https://developer.ifood.com.br/en-US/docs/food/guides/modules/shipping/outside)
descreve metadata.CODE para comunicar código ao cliente em pedidos POS; não é
o contrato desses pedidos salesChannel=IFOOD. Não inventar código nem importar
essas ações. Referência Events/Order v1.0 renderizada no Portal e os guias
Events/order-events e Order/events foram conferidos; não estabelecem tratamento
DDCR aplicável ao fluxo Food atual. Falta orientação específica do fornecedor
antes de acrescentar regra operacional. Eventos continuam diagnosticados, com
ACK persistido e sem mudança de estado; identificação/impacto em TASKS.md.

Todos os comandos exigem autorização ativa, ambiente liberado, permissão relida e revisão vigente. Não pode existir outro comando pendente/incerto. Estados desconhecidos não viram novo. CAN é terminal; CON não reabre o pedido. CAN posterior pode registrar cancelamento após conclusão.

| Evento remoto | Estado no HUB | Ações disponíveis e condições |
|---|---|---|
| PLC / PLACED | RECEBIDO_EXTERNO / PENDENTE | confirm dentro do prazo; requestCancellation com motivo oficial |
| CFM / CONFIRMED | CONFIRMADO / PENDENTE | startPreparation e readyToPickup respeitando início de preparo; cancelamento |
| PRS / PREPARATION_STARTED | CONFIRMADO / EM_PREPARO | readyToPickup; cancelamento |
| RTP / READY_TO_PICKUP | CONFIRMADO / PRONTO | dispatch somente DELIVERY/MERCHANT; cancelamento; nunca marcar entregue |
| DSP / DISPATCHED | CONFIRMADO / EM_ENTREGA | verifyDeliveryCode somente DELIVERY/MERCHANT; cancelamento se API oferecer motivo |
| CON / CONCLUDED | CONFIRMADO / ENTREGUE | Sem comandos operacionais comuns; tratar eventual disputa |
| CAN / CANCELLED | CANCELADO / INTERROMPIDO | Sem reabertura; ajuste financeiro se já houve baixa/repasse |
| CAR / CANCELLATION_REQUESTED | Preserva etapa | Registro de solicitação, não cancelamento efetivo |
| CARF / CANCELLATION_REQUEST_FAILED | Preserva etapa | Recusa o comando de cancelamento pendente |
| HSD / HANDSHAKE_DISPUTE | Preserva etapa, nova revisão | Aceite/recusa total ou parcial com itens identificados; motivos e alternativas oferecidos, prazo vigente. Metadados privados cifrados |
| HSS / HANDSHAKE_SETTLEMENT | Preserva etapa | Correlacionar disputa/alternativa/resultado. Total depende CAN; parcial mantém revisão pendente até OPA atualizar detalhes; proposta monetária exige ajuste financeiro rastreável |
| OPA / ORDER_PATCHED | Atualiza o mesmo pedido e versiona itens | GET oficial novamente; snapshots anterior/atual cifrados, itens vigentes únicos; títulos/baixas preservados e divergência financeira sinalizada |
| Outro par, SPS/SPE ou evento sem pedido | Não altera pedido | Diagnóstico durável |

| Ação | Método/corpo | Aceite HTTP e confirmação |
|---|---|---|
| confirm, startPreparation, readyToPickup, dispatch | POST /order/v1.0/orders/{id}/{acao}, sem body | 202 aceita processamento; esperar CFM, PRS, RTP, DSP respectivamente |
| Motivos | GET /order/v1.0/orders/{id}/cancellationReasons | 200 array cancelCodeId/description; 204 sem motivos |
| requestCancellation | POST mesmo prefixo, JSON cancellationCode e reason; reconferir motivo imediatamente antes do envio | 202; esperar CAN ou CARF/negociação |
| verifyDeliveryCode | POST mesmo prefixo, JSON code com quatro dígitos | 200 success=true; não concluir localmente antes de CON |
| acceptDispute | POST /order/v1.0/disputes/{id}/accept, sem body no caso simples; reason e detailReason (até 250) quando motivos são oferecidos | 201; esperar HSS correlacionado, não inferir CAN |
| rejectDispute | POST /order/v1.0/disputes/{id}/reject com reason | 201; esperar HSS correlacionado |
| alternativeDispute | POST /order/v1.0/disputes/{id}/alternatives/{alternativeId}; type e metadata.amount ou additionalTimeInMinutes/reason | 201; esperar HSS com ID/tipo da alternativa selecionada |

Permissões: confirmar → vendas.pedidos.confirmar; preparo/pronto → vendas.pedidos.producao; despacho/código → vendas.pedidos.revisar; cancelamento/negociação → vendas.pedidos.cancelar. Configuração/retomada exige administrador relido no banco.

401 recupera token uma vez sob trava; 403 bloqueia autorização. 429 respeita Retry-After e limita tentativas. GET/eventos usam retentativa progressiva limitada; POST com timeout/5xx fica INCERTA: não reenviar automaticamente. Rejeição definitiva permite nova revisão. Não existe endpoint genérico de entrega inventado. Confirmação automática permanece ausente/desligada.

## Valores e identidade

Order: subTotal, deliveryFee, additionalFees, benefits, orderAmount, methods.value, cash.changeFor, unitPrice, optionsPrice, totalPrice e opções são valores decimais em BRL. Converter para Decimal uma vez; não multiplicar por 100. Quantidades têm até seis casas. Não aplicar preço/frete/promoção local. Preservar payload cifrado e campos operacionais nos snapshots existentes.

Negociações com Amount.value são strings de centavos inteiros BRL, convertidos com BigInt uma única vez. Alternativas REFUND/BENEFIT limitam valor ao maxAmount recebido; ADDITIONAL_TIME usa allowedsAdditionalTimeInMinutes e allowedsAdditionalTimeReasons exatamente como o contrato oficial. Casos desconhecidos são preservados sem botão.

Benefícios usam sponsorshipValues.name/value (MERCHANT ou IFOOD). Todas as additionalFees pertencem à receita do iFood; liabilities.name/percentage identifica quem arca com a taxa, não seu beneficiário. Os totais do pedido permanecem intactos. Obrigação online no financeiro existente: pagamento do cliente − additionalFees + patrocínio IFOOD, agregado em um recebível do provedor quando há taxa. MERCHANT não acrescenta recebível. Sem taxa, preservam-se métodos e subsídio separado. Frete cobrado com entrega IFOOD, taxa com cobrança mista/offline, patrocinador desconhecido ou composição divergente suspendem projeção até evidência suficiente. Sem comissão, líquido de repasse ou baixa bancária presumidos. Títulos/baixas anteriores permanecem, com pendência de ajuste após mudança.

Unicidade: ambiente+merchant estável; loja+evento; loja+pedido externo; PedidoVenda por origem/estabelecimento/pedido; comando por pedido+ação+revisão e chave/hash. IdentidadeExternaVenda usa origem IFOOD e loja AMBIENTE:merchant. Não associa por nome, externalCode não autorizado ou similaridade; cliente ausente não gera cadastro fictício.

## Complementos conferidos em 06–07/10/2026

Fontes: [agendados](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/scheduled-orders), [detalhes](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/details), [Handshake detalhado](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/handshake-platform-guide), [Handshake](https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/handshake-platform), [Merchant homologação](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/homologacao) e referência v1.0. O guia detalhado resolve os campos condicionais que o Swagger omite; essa leitura não substitui teste remoto desses casos.

Agendamento conserva no snapshot cifrado UTC: início do preparo, instante delivery/takeout/dineIn/indoor, início e fim de schedule. O calendário usa o dia local do início da janela como referência interna; a janela completa aparece em listagem/detalhes/comanda. Sem fim, mostrar “A partir de”, nunca uma hora exata inventada. Pedido manual mantém hora única. Confirmar não inicia preparo. Prazo de confirmação: criação +8 min nos imediatos; início de preparo +8 min nos agendados. Preparo anterior à criação ou janela invertida bloqueiam comandos operacionais até correção oficial, sem mudar payload.

Recuperação Order: somente evento oficial já persistido, posterior ao envio e correlacionado, comprova ação. GET de detalhes não é histórico/estado atual. INCERTA não recebe replay; conferência humana registra situação/referência e preserva a incerteza. Não foi comprovado endpoint Food para recuperar histórico de eventos já reconhecidos.

Merchant: GET/POST interruptions (POST JSON id/description/start/end em relógio civil da loja, 201), DELETE interruptions/{id} (204), GET/PUT opening-hours (PUT objeto storeId/shifts com dayOfWeek/start HH:mm:ss/duration inteiro em minutos, 201). Depois de escrever, GET oficial deve provar o efeito. Duração local: 1–1440 min/turno, até 28 turnos (limite do HUB); pausa de teste 1–60 min (limite do HUB). Sobreposição é validada inclusive entre dias/semana. Escritas ficam restritas à loja TESTE ativa nesta etapa.

### Correção comprovada no primeiro ensaio Merchant — 07/10

[Workflow Merchant](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/workflow) informa que Interruptions usa o fuso configurado da loja e ignora o offset do payload. Diferente de Order/Events, não interpretar os valores civis sem offset como UTC. Exemplo real sanitizado: solicitação inicial 03:23:10.850Z retornou 03:23:10.85 sem offset, com UUID gerado pelo provedor diferente do enviado, e loja continuou disponível porque a pausa ficou futura no relógio local. Esse ensaio identificou defeito; não conta como fechamento imediato aprovado.

Correção: transformar os instantes de solicitação para o relógio civil do fuso operacional configurado, congelar o corpo uma vez e comparar datas civis estritamente validadas, sem conversão pela timezone do processo/navegador. Aceitar fração ISO até três casas preservando precisão; rejeitar data impossível. Guardar o ID retornado no 201 e conferir o mesmo recurso por GET. Se houver timeout antes do ID, somente uma pausa nova em relação à consulta anterior, com descrição e início/fim exatos, comprova efeito; zero ou múltiplas correspondências permanecem incertas. Jamais tratar o id enviado como idempotência garantida do provedor. O validador de instantes Order/Events não foi afrouxado. Conferir que o fuso do HUB corresponde ao configurado no merchant antes de uso real; GET details não informa esse campo.
