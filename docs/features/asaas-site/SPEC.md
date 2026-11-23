# Asaas e Site (WooCommerce) no HUB

Solicitação de 23/11/2026: conectar o HUB às APIs do Asaas e do Site. Escopo escolhido
pelo usuário no mesmo dia: **cobrar pelo pedido** no Asaas, **receber os pedidos do site**
e considerar que **o checkout do site já cobra pelo Asaas**. Base: origin/main 82c4211.
Execução, validações e pendências em [TASKS](TASKS.md). Ativação em [OPERACAO](OPERACAO.md).

Fora desta entrega: importar recebimentos/repasses para o Financeiro, espelhar clientes no
Asaas, publicar cardápio/preços no site e devolver status do HUB ao site.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Efeito financeiro | Cobrança e pagamento são **evidência no pedido** (`CobrancaAsaas` + histórico). Nenhum título, baixa ou movimento bancário é criado. | Pedidos nascem em modo financeiro `EXTERNO`; competência, taxa e conta de repasse seguem pendentes (B04 de [Pedidos](../pedidos/DECISOES_PENDENTES.md)). |
| Autoridade do pedido do site | O site define itens, valores e status comercial. No HUB, revisão comercial é recusada; data, destinatário, cobrança, operação e cancelamento local continuam disponíveis. | O roadmap M5 trata o site como cliente do núcleo de Pedidos; revisão local seria sobrescrita. |
| Conteúdo do aviso do site | O webhook só aponta o pedido; o conteúdo é relido pela API autenticada. | O corpo do aviso não é fonte confiável nem precisa ser guardado. |
| Pedidos antigos | A primeira ativação marca o ponto de partida; nada anterior é importado. | O histórico já foi tratado pela importação histórica. |
| Quem cobra | `vendas.pedidos.confirmar` gera e cancela cobrança. Configurar integrações é exclusivo de administrador. | Sem nova permissão nem migration de perfis nesta entrega. |
| Ativação | Tudo desligado sem variáveis explícitas; Asaas aponta para sandbox até `ASAAS_AMBIENTE=PRODUCAO` + autorização própria. | Mesmo padrão do iFood e do emissor fiscal. |

## Arquitetura

- `src/lib/asaas`: `dominio` (contrato, status, ordem de eventos, titular), `cliente` (HTTP de
  destino fixo), `configuracao` (chaves e travas), `cobrancas` (gerar, cancelar, Pix,
  reconciliação), `eventos` (webhook e processador), `painel` (situação para Integrações).
- `src/lib/site`: `adaptador` (pedido WooCommerce → Pedido), `cliente` (GET somente leitura),
  `processamento` (webhook, coleta periódica, processador), `configuracao` (canal, ativação, teste).
- Entradas: `POST /api/integracoes/asaas/webhook` (header `asaas-access-token`) e
  `POST /api/integracoes/site/webhook` (HMAC-SHA256 dos bytes originais). O middleware libera
  apenas esses dois caminhos no host do HUB; cada rota autentica e responde só depois de persistir.
- Worker único `npm run integracoes:worker` (`scripts/processar-integracoes.ts`): coleta do site,
  filas `EventoSite`/`EventoAsaas` e reconciliação de cobranças incertas. Filas duráveis no banco,
  `FOR UPDATE SKIP LOCKED`, travas consultivas por pedido/cobrança e novas tentativas com espera crescente.
- Banco (migration aditiva `20261123180000_asaas_site_integracoes`): `CobrancaAsaas`, `EventoAsaas`,
  `IntegracaoSite`, `EventoSite`, `PedidoSite`. Payloads e fotografias ficam cifrados (AES-GCM,
  contextos `grazing-hub-asaas-v1` e `grazing-hub-site-v1`).
- Interface: bloco de cobrança na seção Pagamento do detalhe do pedido
  (`vendas/pedidos/cobranca-asaas.tsx`) e conexões Asaas e Site em Configurações › Integrações.

## Contratos do Asaas

- Uma cobrança em aberto por pedido criada pelo HUB: validação no serviço e índice parcial
  `CobrancaAsaas_aberta_por_pedido`. Valor = total do pedido confirmado, origem `INTERNO`.
- A linha local nasce `ENVIANDO` antes da chamada externa. Resposta sem conclusão vira `INCERTA`
  e bloqueia nova cobrança até a conferência pela referência única `hub:<número>:<id>`
  (consulta periódica ou o próprio webhook). Erro definitivo vira `FALHOU` e libera nova tentativa.
- Titular: cobrança escolhida no pedido, senão comprador; CPF/CNPJ obrigatório. O cliente é
  procurado por CPF/CNPJ antes de ser criado; notificações do Asaas ao cliente ficam desligadas
  salvo `ASAAS_NOTIFICAR_CLIENTE=1`.
- Eventos: idempotência pelo `id` do evento; evento mais antigo não desfaz situação mais recente;
  status desconhecido é preservado sem mudar a cobrança. Cobrança sem pedido aguarda até 2 h
  (`SEM_VINCULO` depois disso) e volta à fila quando o pedido do site chega.
- Cobrança do checkout do site é vinculada pelo identificador gravado no pedido do site ou pela
  referência numérica igual ao pedido, **e** valor igual ao total; sem as duas coisas não há vínculo.
- QR Code Pix é consultado sob demanda e não é guardado. Somente links `*.asaas.com` em HTTPS são exibidos.

## Contratos do Site

- Identidade única `SITE` / host / id do pedido (`PedidoVenda.referencia*` + `PedidoSite`).
- Status: `pending`, `on-hold`, `failed` → `RECEBIDO_EXTERNO`; `processing`, `completed` →
  `CONFIRMADO`; `cancelled`, `refunded`, `trash` → `CANCELADO`. Status não mapeado vira pendência.
  Rascunhos de checkout e pedidos cancelados antes de chegar não são importados.
- Cancelamento vindo do site só interrompe o pedido que ainda não entrou em produção; depois disso
  vira pendência para tratamento no HUB. Itens alterados após o início da produção não substituem os anteriores.
- Totais: subtotal dos itens − descontos (cupom e taxas negativas) + frete + outras taxas e impostos
  = total; divergência vira pendência, nunca ajuste.
- Cliente: vínculo a cadastro existente por CPF/CNPJ ou e-mail único; sem correspondência o pedido
  fica só com a fotografia. Produto: `IdentidadeExternaVenda` (`SITE`, host, `PRODUTO`, id do produto
  ou variação), senão SKU igual ao código do produto no HUB.
- Data e horário de entrega vêm de metadados configuráveis (`SITE_META_DATA_ENTREGA`,
  `SITE_META_JANELA_ENTREGA`); formato ou campo não reconhecido vira pendência. Reagendamento feito
  no HUB prevalece enquanto o site não informar data.
- `dataCompra` não é preenchida: o banco a reserva a rascunhos internos.

## Limites conhecidos

- Emissão fiscal pelo HUB continua restrita a pedidos de origem interna; pedido do site exige
  decisão própria antes de emitir nota por aqui (ver TASKS).
- Estorno e reembolso são feitos no Asaas/site; o HUB apenas reflete a situação.
- Nomes de campos do plugin do Asaas e de entrega no WooCommerce não foram conferidos em pedidos
  reais: a leitura cobre os formatos usuais e o teste de conexão lista os nomes encontrados.
- Simulação HTTP e sandbox não equivalem a homologação em produção.
