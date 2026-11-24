# Asaas e Site — ativação e operação

Nada funciona sem as variáveis abaixo no ambiente privado (Dokploy). Não registrar valores
reais em documentos, commits ou conversas. Modelo em `.env.example`.

## Asaas

1. No painel do Asaas (comece pelo sandbox), gerar a chave de API e cadastrar
   `ASAAS_SANDBOX_API_KEY`. A chave começa com `$`: conferir que o painel de variáveis não a
   interpreta como referência a outra variável.
2. Criar um token próprio de 32 a 255 caracteres, sem espaços, em `ASAAS_WEBHOOK_TOKEN`.
3. No Asaas, Integrações › Webhooks: endereço `https://grazinghub.com.br/api/integracoes/asaas/webhook`,
   o mesmo token e os eventos de cobrança. Sandbox e produção têm webhooks separados.
4. `ASAAS_ATIVO=1`. Conferir em Configurações › Integrações › Asaas e usar Testar conexão.
5. Produção: `ASAAS_PRODUCAO_API_KEY`, `ASAAS_AMBIENTE=PRODUCAO`, `ASAAS_PRODUCAO_AUTORIZADA=1`
   e o webhook de produção. Cobranças criadas em um ambiente não são operadas no outro.

O Asaas interrompe a fila após 15 falhas seguidas de entrega e guarda eventos por 14 dias.
Fila interrompida é reativada no painel do Asaas; os eventos retidos são reenviados.

## Site (WooCommerce)

1. WooCommerce › Configurações › Avançado › API REST: criar chave **somente leitura** e cadastrar
   `SITE_URL` (https), `SITE_CONSUMER_KEY` e `SITE_CONSUMER_SECRET`.
2. Criar um segredo de 24 caracteres ou mais em `SITE_WEBHOOK_SECRET`.
3. WooCommerce › Avançado › Webhooks: dois webhooks ativos, tópicos Pedido criado e Pedido
   atualizado, endereço `https://grazinghub.com.br/api/integracoes/site/webhook`, o mesmo segredo.
   O WooCommerce desativa o webhook após cerca de cinco falhas seguidas; a coleta periódica do HUB
   cobre o intervalo, mas o webhook precisa ser reativado no site.
4. `SITE_ATIVO=1`. Em Configurações › Integrações › Site: Testar conexão, conferir se a data de
   entrega foi reconhecida, escolher o canal e Ativar recepção.
5. Se a data não for reconhecida, informar o nome do campo listado pelo teste em
   `SITE_META_DATA_ENTREGA` (e o do horário em `SITE_META_JANELA_ENTREGA`), separados por vírgula.

## Worker

Processo `npm run integracoes:worker` na mesma imagem do HUB, com `DATABASE_URL`, `AUTH_SECRET`,
`NODE_ENV` e as variáveis `ASAAS_*` / `SITE_*`, sem portas públicas. Sem ele, avisos ficam
guardados na fila e nada é processado. `--uma-vez` executa um ciclo e encerra. A instalação
como serviço na VPS segue o modelo de `infra/instalar-ifood.py` e ainda não foi automatizada.

## Rotina

- Pedido com pendência do site aparece na seção Pagamento do detalhe; a contagem fica em Integrações › Site.
- Avisos com falha: corrigir a causa e usar Reprocessar avisos.
- Pausar a recepção do site não perde pedidos: ao reativar, a coleta recupera o intervalo.
- `AUTH_SECRET` também protege as fotografias cifradas; trocá-lo torna-as ilegíveis.
