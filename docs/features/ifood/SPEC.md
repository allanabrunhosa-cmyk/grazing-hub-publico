# iFood no gestor existente

Base: origin/main 840a4ce7. Consulta oficial: 05–06/10/2026 (America/Sao_Paulo).
Execução e evidências: [TASKS](TASKS.md). Contratos: [CONTRATOS](CONTRATOS.md).

## Escopo

Food: Authentication, Merchant, Events e Order. Reutilizar PedidoVenda, itens,
identidades externas, histórico, permissões, financeiro, gestor e comanda.
Sem estoque, autoaceite, emissão fiscal, catálogo remoto, Financial, Analytics ou Review.
Na primeira entrega não havia app/loja. Em 06/10, conta e loja TEST foram conferidas
no portal e na API; cadastro do app PDV em andamento. Nenhuma loja real autorizada.
Takeat permanece como gestor real até emissão fiscal e transição futura autorizada.

## Descoberta e ajustes mínimos

| Requisito | O que já existe | Lacuna comprovada | Ajuste mínimo | Validação |
|---|---|---|---|---|
| Pedido único | PedidoVenda e unique origem/estabelecimento/pedido | Sem adaptador Merchant API | Relação externa persistente e mesma identidade por ambiente/merchant | Concorrência e reentrega no PostgreSQL |
| Autorização | Sessão relida, perfil e crypto AES-GCM | Sem tokens/vínculo iFood | Configuração servidor, tokens cifrados, autorização por sessão e loja | Expiração, revogação e escopo |
| Eventos | Padrão fila durável em fiscal-saida | Sem coletor iFood | Inbox com tarefa no próprio registro antes de ACK, coletor separado do navegador | Falha antes/depois de ACK e reinício |
| Itens e clientes | Snapshots e IdentidadeExternaVenda | Item exige produto; confirmação manual recalcula catálogo | Produto opcional somente no adaptador, snapshot remoto e pendência | Sem vínculo, adicionais e total exato |
| Estados e ações | Status operacional, revisão e histórico | Ações internas não conhecem autoridade remota | Matriz iFood, outbox e confirmação por evento | Atrasos, terminal, proibição e timeout |
| Financeiro | LancamentoFinanceiro, PagamentoExternoPedido, repasses | Pagamento informado não identifica repasse | Ponte na carteira existente, sem baixa automática; divergências ficam pendentes | Títulos únicos, cancelamento preserva baixas |
| Estoque | Chave do gestor desligada por padrão | Caminhos manuais ainda existem | Bloqueio explícito por origem nas fronteiras físicas/comerciais | Zero reservas/movimentos |
| Operação/impressão | Gestor, produção e comanda térmica | Sem dados de sincronização; sem spool automático de pedidos | Painel contextual e origem no gestor; comanda manual existente | UI sintética desktop/celular; impressão física pendente |
| Operação contínua | Scripts e timers em infra | Sem worker iFood | Processo Node com trava persistente e cadência mínima | Fila independe da UI |

## Arquitetura e isolamento

O HUB atual é uma instalação de loja única, ConfiguracaoLoja singleton; não possui
modelo multiempresa. A integração fica vinculada explicitamente a essa conta local.
Credencial do aplicativo é configurada no servidor por ambiente; tokens permanecem
cifrados no banco. Loja externa tem identidade estável através das reconexões.
Não alegar isolamento multitenant que o restante do HUB não implementa.

Polling escolhido; webhook não é necessário para este escopo e não é exposto.
Uma loja por chamada, sem filtros de tipos/grupos que descartariam eventos.
Recepção e processamento são etapas independentes. Eventos desconhecidos são
persistidos e diagnosticados. Nenhum evento desconhecido cria estado novo.

## Aceite

Os treze critérios da solicitação devem ter resultado/evidência em TASKS.
Mocks não comprovam iFood. A ativação exige aplicativo Food/PDV autorizado,
modalidade conferida no portal, Merchant/Events/Order liberados, loja de teste,
coexistência com outros gestores esclarecida e processo de homologação próprio.
