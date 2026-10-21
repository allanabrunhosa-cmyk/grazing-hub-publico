# Pedidos — proposta mínima de integração

## Operação simplificada e cancelamento contextual — 08/10/2026

`[id]/conteudo.tsx` usa `detalhe-pedido.tsx` após confirmação; orçamento/declinado mantém
`editor-pedido.tsx`. Revisão comercial abre esse editor com `somenteComercial` em Dialog
descendente e contexto de descarte próprio. Não há parâmetros contábeis no detalhe.
Cancelados usa navegação completa pelo botão e ao fechar um pedido com esse retorno:
no Next16.3, o intercept genérico de IDs captura o caminho estático em navegação suave.
O slot nulo direto preserva a página separada; não tratar "cancelados" como ID comercial.
`pagamento-operacional-pedido.tsx` preserva registro comprovado e correções existentes;
`cancelamento-pedido.tsx` concentra devolução/crédito, boleto tardio e recuperação.

Em `src/lib/vendas/pedidos.ts`, cancelamento e tratamento compartilham a transação.
Chaves dos efeitos são hashes derivados da operação; pagamentos/alocações permanecem
travados. `elegivelCancelamento` é a leitura dos valores disponíveis considerando o
cancelamento; `elegivel` mantém a regra de excedente de revisão durante pedido ativo.
Não usar este último para informar devolução futura ao operador. Boleto recebido após
cancelamento solicita tratamento automaticamente sem reabrir receita comercial.
Retomar revalida alocações e reutiliza o tratamento em FALHA; concluir exige evidência,
conta/data e categoria de devoluções previamente cadastrada no canal.

CAN confirmado solicita ajuste dos valores efetivamente recebidos no HUB para iFood;
pagamento on-line ainda não liquidado não cria saída bancária. Reembolso ao consumidor
é acompanhado pelo provedor. A exceção de autorização local é limitada às operações
financeiras de cancelamento confirmado; edição, cancelamento comercial local e estoque
iFood continuam bloqueados. `financeiro.ts` projeta títulos idempotentes com configuração
prévia, sem inferir baixa, comissão ou repasse. Configuração reavalia snapshots pendentes
sob a mesma trava do processador, em transações por pedido; não chama API remota.

Teste transacional: `testes/vendas/pedidos-financeiro-integracao.test.ts` e
`testes/ifood/integracao.test.ts`. Interface: `pedido-detalhe-interface.test.tsx`,
`pedidos-gestor-interface.test.tsx`, `testes/ifood/interface.test.tsx`; prévias somente
sintéticas em `testes/visual/pedido-detalhe.*` e `testes/visual/ifood.*`.

## Gestor dedicado e correção de etapas — 30/09/2026

- `src/app/(protegido)/vendas/pedidos/gestor-actions.ts` recebe pedido, versão esperada,
  direção `avancar`/`voltar` e chave de operação. Exige consulta de Pedidos na fronteira.
  `mudarStatusGestorPedido`/`executarOperacaoPedido`, em `src/lib/vendas/pedidos.ts`,
  releem usuário, atividade, versão da sessão e capacidade dentro da transação.
- `AVANCAR` resolve a etapa sob a trava do pedido e reutiliza `INICIAR`, `PRONTO`, `SAIR`
  ou `ENTREGAR`. Início/pronto exigem capacidade de produção ou revisão; saída/entrega
  e `VOLTAR` exigem revisão. Uma repetição com a mesma chave/entrada confere também a
  capacidade do comando efetivamente executado, inclusive após mudança de perfil.
  Versão antiga com outra chave e reutilização da chave com outra entrada são recusadas.
- O gestor mostra `PENDENTE` em **Novo pedido**, `EM_PREPARO` em **Em preparo**,
  `PRONTO`, `EM_ENTREGA` e `ENTREGUE` em **Pronto para entrega / retirada**,
  **A caminho** e **Entregue**. Recebidos iFood aparecem em Novo pedido sem
  ganhar comandos locais. Pendentes confirmados ainda exigem início
  explícito. O gestor envia `AVANCAR` com `confirmarIntegralmente: true`, incluído no hash
  idempotente. Marcar Pronto confirma o preparo completo; Em rota confirma a expedição
  completa. A transação valida todos os itens vigentes antes de gravar somente as
  quantidades restantes em eventos `OPERACAO_PREPARAR`/`OPERACAO_EXPEDIR`, com chaves
  derivadas da chave principal, junto do evento da etapa. Todos compartilham uma única
  revisão do pedido. Comandos manuais sem essa confirmação permanecem estritos.
  A política de estoque do Gestor descrita abaixo decide o efeito físico desses
  apontamentos. Permissões, versão e ocorrências permanecem validadas no servidor.
  Retornar e avançar de novo preserva as quantidades já apontadas, sem acrescentar
  fatos duplicados nem reabrir a execução física de um pedido já entregue.
- `VOLTAR` corrige exatamente uma etapa: entregue → em entrega → pronto → em preparo.
  Não retorna a `PENDENTE`, não apaga fatos nem zera quantidades. O evento guarda autor,
  versões e estados anterior/novo. Estoque, reservas, títulos, baixas e documentos não
  são alterados por essa ação.
- `entregueEm` conserva a **primeira entrega registrada**, mesmo quando a etapa atual
  é corrigida. O cancelamento comercial considera a **etapa atual**: `ENTREGUE`
  bloqueia; depois de um retorno operacional autorizado, um pedido local confirmado
  pode ser cancelado pelas permissões e validações existentes, mesmo com primeira
  entrega no histórico. Retornar não libera edição comercial nem reabre a execução
  física dos itens já entregues. Uma nova marcação de entregue mantém a data original
  e registra outro evento no histórico.
  A coluna/etiqueta operacional deve usar `statusOperacional`/`operacional`, não inferir
  a etapa atual apenas pela presença de `entregueEm`.
- `listarPedidos` fornece o DTO seletivo `PedidoGestor`: versão, atendimento/prazo,
  observações, destinatário/endereços de entrega e cobrança com campos permitidos,
  subtotal, frete, desconto, outros custos e forma de pagamento informada; itens vigentes
  com nomes/complementos fotografados, observações, preços e quantidades preparadas/expedidas. Não
  serializa registros brutos, composição inteira ou campos extras de snapshots. Este DTO
  comercial exige consulta de Pedidos e não substitui o DTO restrito de produção.
- O resumo conserva `compradorSnapshot.nome` dos confirmados e lê o JSON validado de
  rascunhos/declinados, resolvendo apenas nomes/unidades dos catálogos necessários.
  `pedidosAnteriores` mantém a contagem de confirmados do comprador; `dataGestor` usa
  previsão civil ou, para imediato, confirmação/criação no fuso fotografado no pedido.
  Zero nos preços ainda não definidos de rascunho não é um preço confirmado.
- Busca e filtros são compartilhados pelos modos. `etapaGestor` aplica as cinco coortes;
  `operacional` preserva o filtro anterior exato. `incluirSemData` combina período de
  entrega **ou** dia efetivamente ausente em um `AND` independente do `OR` da busca.
  Previsões persistidas conservam `intervaloDatasPedidos`; sem previsão, SQL parametrizado
  consulta somente IDs pela data imediata no fuso de cada pedido ou agenda do rascunho.
  Imediatos/rascunhos datados fora do período não ocupam vagas da página. `apenasEntreguesRecentes`
  limita somente o estado atualmente entregue a sete dias, preservando pedidos retornados
  à operação mesmo com primeira entrega antiga. Estados `DECLINADO`/`ESTORNADO`, horários,
  encerramento manual externo são preservados. A janela física de início de dois dias
  permanece no fluxo manual/com estoque; o Gestor sem estoque permite controlar
  produção antecipada.
  Paginação é
  de 50 pedidos, retorna `quantidadeTotal` e limita a página à última disponível. Calendário
  deve indicar explicitamente o bloco sem data e o escopo paginado.

Testes: `testes/vendas/pedidos-gestor-consulta.test.ts`, `pedidos-gestor-actions.test.ts`,
os cenários do gestor/calendário em `pedidos-integracao.test.ts` e preservação exata de
títulos, caixa e conciliação em `pedidos-financeiro-integracao.test.ts`. O gestor não acrescenta migration;
comandos e estados permanecem nos campos/eventos existentes.
A integração transacional é opt-in: `PEDIDOS_BANCO_TESTE=1` e
`PEDIDOS_AMBIENTE_ISOLADO=1`, com `DATABASE_URL` de uma base fictícia nova
`teste_*` em localhost/127.0.0.1. As suítes M1/M2 criam schemas aleatórios
`teste_pedidos_*` e os removem no `afterAll`; nunca usar a base operacional.
Os cenários integrais cobrem precisão, parcial anterior, lote recusado sem gravação,
revenda, ocorrência, concorrência, repetição/revogação de acesso e retorno de etapa
sem duplicar estoque, financeiro ou a primeira data de entrega.

### Chave de estoque do Gestor — 01/10/2026

- `ConfiguracaoLoja.pedidosLiberacao` recebe política própria de movimentação do
  Gestor, versão otimista e local de origem explícito. Ausência da chave significa
  **desligado**. A gravação preserva os outros campos da configuração, usa trava,
  idempotência e `HistoricoCadastroVenda`; somente administrador ativo, relido no
  banco, pode alterá-la. Não reaproveitar `ativa`, aprovações financeiras ou a lista
  `locais` como chave/local padrão.
- Desligada, a origem confiável `mudarStatusGestorPedido` confirma quantidades
  operacionais sem exigir ficha, reserva ou execução física. Não cria reservas,
  movimentos ou alterações de saldo. APIs de execução física/manual conservam suas
  autorizações e validações; uma opção enviada pelo navegador não pode dispensá-las.
- Ligada, marcar **Pronto** baixa os componentes da montagem; **Em rota** baixa os
  itens de revenda. Usa composição/conversões fotografadas, saldo e livro de estoque
  existentes. Preparação estocada é componente próprio, sem explosão recursiva.
  A quantidade nova e a etapa são gravadas na mesma transação e revisão do pedido,
  com referências físicas e auditoria. Reserva prévia mantém local e fotografia;
  demanda nova usa exclusivamente o local ativo configurado, dentro do escopo de
  `pedidosLiberacao.locais` quando preenchido. Falta de ficha/conversão não autoriza
  inventar demanda.
  `pedidos-fisico-gestor.ts` calcula o complemento por insumo, descontando consumo
  líquido anterior; liberar um componente não repete a baixa de outro já consumido.
  Materiais usam Decimal amplo e a precisão física do banco; a quota comercial da
  nova reserva respeita suas seis casas sem aumentar a quantidade movimentada.
  Travas compartilhadas de insumos e locais mantêm unidade/conversão/atividade
  estáveis até concluir a transação.
- A baixa automática permite saldo negativo, inclusive se a cobertura ficar menor
  que reservas de outros pedidos. Seus registros permanecem intactos. Essa exceção
  pertence ao caminho automático validado no servidor; o gravador comum e os fluxos
  físicos manuais conservam a proteção de reservas. Saída não altera custo médio,
  gera CMV, título, caixa ou emissão fiscal.
- A política/versão aplicada fica fotografada no evento. Ligar a chave não executa
  etapas históricas feitas sem estoque: só quantidades novas do estágio aplicável
  geram baixa. Voltar não estorna material; reavançar não baixa duas vezes. Repetir a
  mesma chave retorna a operação original, mesmo após mudança de configuração.
  Fatos do Gestor sem efeito material não comprovam execução nas APIs manuais.
  A identidade da operação agora distingue a origem Gestor; uma tentativa de uma
  página anterior à publicação pode pedir recarga por chave incompatível, sem
  repetir movimentações já concluídas.
- A configuração abre em popup local no Gestor, sem alterar modo, busca, canal ou
  paginação. Salvar/Cancelar são explícitos, com proteção de alterações; consulta
  não habilita escrita para quem não é administrador.

## Modo operacional externo — 26/09/2026

- `PedidoVenda.modoFinanceiro`: migration atribui `HUB` somente para preservar legado; serviço de criação usa `EXTERNO` por padrão. Ações públicas não recebem seletor de modo. Não há conversão, backfill ou troca por mudança de configuração.
- `pedidos-liberacao.ts` decide capacidade por pedido persistido: modo externo permite operação autenticada e recusa capacidades financeiras inclusive em chamadas diretas; `PEDIDOS_OPERACAO_EXTERNA=0` suspende suas escritas. M2 conserva a proteção anterior. Referência origem/estabelecimento/código tem unicidade no banco, trava e histórico.
- Fuso da loja é fotografado no pedido. Data civil/janela são independentes dos instantes efetivos. Calendário usa `listarPedidos`; produção projeta somente dados necessários à cozinha. Revisão resumida e comanda não enviam snapshots financeiros/pessoais ao cliente da cozinha.
- Reserva/consumo manuais usam os serviços anteriores. Local ativo escolhido explicitamente por usuário autorizado; quando `pedidosLiberacao.locais` delimita escopo, ele é respeitado. Falta de ficha/saldo não afeta consulta, agenda ou comanda. A chave do Gestor acrescenta a baixa automática com local configurado e saldo negativo descrita acima; não cria local, saldo fictício ou CMV automático.
- `vendas.pedidos.producao`: visualizar/editar preparo; materiais exigem adicionalmente `inventario/editar`. Revisão comercial, reagendamento e expedição continuam nas permissões anteriores. Impressão solicitada no navegador não prova impressão física.

## Contratos implementados na liberação operacional — 25/09/2026

- `pedidos-fisico.ts` reutiliza `SaldoEstoque`/`MovimentacaoEstoque` através do gravador compartilhado. `ReservaPedido` é alocação por item/versionamento, componente, local e lote lógico de execução, não outro estoque. Restrições SQL conservam quantidades e limites de retorno/perda; histórico do Pedido conserva autor, comando, referência do movimento e idempotência.
- Ordem das travas: acesso, operação, Pedido, estoque compartilhado. O gravador de outros módulos usa a mesma trava de estoque e não invade reservas. A configuração atual é loja única, sem dimensão empresa/unidade nos modelos de estoque; não alegar isolamento multitenant inexistente. Local ativo deve estar explicitamente incluído no ensaio/configuração.
- Quantidade da ficha e conversões ficam fotografadas na primeira reserva; liberações seguintes do mesmo item usam a fotografia. Preparação estocada é consumida como componente próprio, sem explosão dos ingredientes. Lote lógico não comprova rastreabilidade de lote físico/validade. Custo apurado permanece desconhecido sem método aprovado; movimentos físicos não criam CMV financeiro.
- Antes de consumo/preparo, revisão pode liberar reservas e versionar instruções. Após execução, desconto/frete e adição de novos itens preservam os existentes; retorno/perda são explícitos. Redução/substituição de instruções executadas exige ocorrência e tratamento, sem sobrescrita. Fotografia de custo que não cobre os itens revisados não aparece como estimativa global completa.
- `pedidos-liberacao.ts` bloqueia mutações reais no servidor enquanto os contratos externos estão incompletos. Ensaio exige flag explícita + banco local `teste_*`; nem administrador nem aprovação documental isolada contornam o bloqueio operacional. `ConfiguracaoLoja.pedidosLiberacao` não foi preenchida com aprovação real. Histórico continua consultável.
- `pedidos-politica.ts` contém a matriz preenchível de eventos e validação de completude; não aprova competência/classificação. `pedidos-documento-externo.ts` registra referência exata de emissor/documento no histórico com chave única, sem emitir nota ou criar receita. Autenticidade e E01 são externos.

**Proposta conceitual, não implementada.** Fundamentos e limitações: [AUDITORIA](AUDITORIA.md). Prioridades: [GAPS](GAPS.md). Decisões de M1 fechadas e pendências posteriores: [DECISOES_PENDENTES](DECISOES_PENDENTES.md).

## Responsabilidades e fontes de verdade

| Responsabilidade | Fonte existente ou proposta | Limite |
|---|---|---|
| Identidade de cliente | ClienteVenda existente | Dados atuais não substituem snapshot da venda |
| Catálogo/preço sugerido/configuração | ProdutoVenda, preços, grupos e opções existentes | Recalcular no servidor ao confirmar, não recalcular pedido antigo ao consultar |
| Fato comercial e carteira de vendas confirmadas | PedidoVenda + ItemPedidoVenda propostos | Confirmação faz nascer a venda comercial; esse total não é, por si, receita reconhecida na DRE |
| Recebíveis e efeitos no DRE | LancamentoFinanceiro existente com origem comercial aditiva | Não criar tabela paralela de contas a receber nem somar total do pedido no DRE |
| Dinheiro efetivamente movimentado | Baixa existente + MovimentacaoBancaria | Importação de extrato sozinha não é outra receita |
| Evidência bancária | TransacaoExtrato + VinculoExtrato existentes | Mesmo título não pode ser vinculado a duas transações |
| Consumo e saldo | MovimentacaoEstoque + SaldoEstoque existentes | Execução proposta liga movimento ao pedido; catálogo não movimenta estoque |
| Fiscal de saída | Documento separado, a desenvolver no M4 | Pedido fornece dados e recebe referência/status; não contém motor tributário |

Reutilizar aplicação, PostgreSQL/Prisma, sessão e serviços. Não há necessidade demonstrada de microserviço, broker, novo catálogo ou nova biblioteca. Não reutilizar PedidoCompra, CanalPedido de fornecedores, NotaFiscalRecebida ou NotaFiscalServico de entrada como venda/nota de saída.

## Modelo comercial mínimo — Marco 1

### PedidoVenda

| Campo/grupo | Necessidade e restrição |
|---|---|
| id, numero | ID interno estável e número legível único; sequência transacional/constraint, nunca max+1 sem serialização |
| clienteId | FK ClienteVenda; obrigatório ao confirmar no escopo solicitado. Relação 1 cliente→N pedidos. Rascunho pode estar incompleto |
| canalId, canalNomeSnapshot | FK CanalVenda; ID não substitui o nome histórico. Compatibilizar com o preço atualmente indexado por texto |
| origem, chaveOperacao | Origem interna inicial e chave única de criação/reenvio; mesma chave com outro conteúdo gera conflito. Identidade externa origem/loja/chave pode ser acrescentada no M5 sem alterar IDs comerciais |
| criadoEm, confirmadoEm, previsaoAtendimento, entregueEm | Separar criação, confirmação, compromisso de entrega/retirada e realização. Atendimento imediato e agendado são distintos; pedido não imediato exige data ou janela prevista antes da confirmação |
| dataCompetencia | Competência financeiro-contábil separada da confirmação e das datas de pagamento/entrega; pode permanecer não definida no núcleo comercial até haver política aprovada. Sua aplicação ao DRE depende da orientação pendente para M2 |
| statusComercial, statusOperacional | Duas dimensões persistidas com transições permitidas; estados financeiros/fiscais são derivados dos registros respectivos |
| atendimento | ENTREGA/RETIRADA; snapshot de destinatário/contato; endereço obrigatório apenas para entrega |
| compradorSnapshot | Nome, tipo, documento informado e contato usado; dados fiscais de destinatário distintos quando necessários. Não inventar documento ausente |
| subtotal, desconto, frete, total | Decimais em escala monetária, apurados a partir dos itens. Desconto global com rateio rastreável; não copiar total confiado ao navegador |
| observacoes, responsavelId | Texto operacional e FK Usuario; autor da operação não vem do formulário. Diferenciar responsável operacional do usuário que gravou |
| versao, createdAt, updatedAt | Concorrência otimista, datas técnicas; evento de confirmação/cancelamento preserva data e autor específicos |

Não incluir campos especulativos de CRM, campanhas, roteirização ou marketplace. Dados pessoais nos snapshots ficam restritos às permissões da venda, sem logs de payloads completos.

### ItemPedidoVenda

| Campo/grupo | Necessidade e restrição |
|---|---|
| id, pedidoId, produtoId, ordem | FKs obrigatórias para item confirmado; Restrict para produto usado e preservação lógica do pedido |
| quantidade, unidadeSnapshot | Quantidade comercial positiva: inteira para venda por unidade; fracionada somente se unidade/regra do produto permitir. Não confundir com repetições de opção ou quantidade física de ingrediente |
| nome/codigo/tipo/versaoProdutoSnapshot | Preservar o que foi vendido; categoria(s) em snapshot quando usadas na análise histórica de vendas |
| precoOriginal, precoAplicado, acrescimos, desconto, totalLinha | Preservar preço vigente do canal e preço efetivamente aplicado, incluindo exceção manual autorizada, autor/data e motivo quando o padrão comportar. Não depender de PrecoProdutoVenda mutável |
| escolhasSnapshot | JSON validado pelo domínio: IDs de grupo/opção/produto vinculado, nomes, repetições, multiplicador, unidade, preço aplicado e limites usados. Uma tabela extra só se consultas/efeitos concretos exigirem; JSON simples basta para M1 |
| composicaoSnapshot, estadoComposicao | Ingredientes/unidades/quantidades resolvidos quando disponíveis; ausência explícita quando não cadastrada. Não usar ID de componente recriado como única referência histórica |
| custoEstimadoSnapshot, estadoCusto | Opcional, com data/base/pendências. Nunca custo zero por ausência. No M1 não é lançamento de CMV |

Confirmar cria uma versão comercial histórica. Rascunho pode consultar catálogo atual e atualizar com aviso. Pedido confirmado ainda não concluído/entregue admite revisão controlada: antes/depois de itens, configurações, valores e snapshots, autor, data, versão e motivo quando aplicável. O estado atual reflete a última revisão, mas nenhuma versão anterior é sobrescrita silenciosamente. Em M2, revisão de valor ajusta títulos pendentes sem apagar recebimentos já realizados; mudanças incompatíveis com efeitos executados exigem fluxo compensatório ou recusa explícita. Pedido entregue não volta a rascunho nem é simplesmente cancelado.

### HistóricoPedidoVenda

Registro mínimo específico do agregado: id, pedidoId com FK, tipo de evento, chaveOperacao única no escopo, autorId/autorNome, data, motivo quando aplicável, versão anterior/nova e alteração relevante. Uma revisão guarda antes/depois de itens, escolhas, snapshots e totais suficientes para reconstruir a mudança comercial. Cancelamento guarda motivo, responsável e horário sem excluir o pedido. Reutilizar o padrão de antes/depois de HistoricoCadastroVenda, mas manter FK de Pedido e não usar o log cadastral polimórfico como substituto do agregado. Sem event sourcing geral: as tabelas de estado continuam a fonte operacional.

## Totais e descontos

Para cada linha, preço unitário configurado = base aplicada + adicionais das escolhas. Total de itens = soma dos totais de linha após quantidade e descontos de linha. Total do pedido = itens − desconto global + frete. Frete e descontos permanecem discriminados, inclusive em futuros dados fiscais; sua classificação financeira depende da política aprovada.

Usar Decimal/centavos com escala e limites definidos; arredondar na fronteira monetária documentada. Quantidades podem ter mais casas que dinheiro. Rateios mantêm soma exata e distribuem resíduos de centavos de modo determinístico. Não arredondar cada ingrediente para centavos antes de calcular custo, nem usar number para converter quantidades muito pequenas até o movimento. Taxas de recebimento não sobrescrevem preço do item.

M1 inclui desconto explícito e frete separado, sem cupons ou promoções por período nem teto comercial inventado. Desconto e alteração manual de preço exigem permissões próprias; preço manual é exceção rastreada. Produtos de preço-base zero entram quando escolha obrigatória válida compõe o preço final, sem preço simbólico: a disponibilidade deve funcionar de cadastro/consulta até confirmação. Não presumir liberdade de vender produto inativo. A validação comercial não exige CMV nem fiscalRevisado para gravar pedido; a permissão de emitir fiscal possui sua validação própria.

### Permissões de Pedido

Usar o sistema existente, sem cargos fixos nem perfis paralelos. Capacidades separadas: visualizar, criar/editar rascunho, confirmar, revisar confirmado, conceder desconto, alterar preço manualmente e cancelar. Confirmar pedido comum depende da capacidade de confirmar; administração pode receber todas. Cada comando revalida autorização no servidor, inclusive na transação crítica. Atribuição aos usuários/perfis usa o mecanismo existente.

## Integração financeira — Marco 2

### Vínculo e geração de títulos

Extensão mínima de LancamentoFinanceiro: FK opcional `pedidoVendaId` para preservar origens legadas, identificador estável de parcela/efeito e natureza da origem comercial (recebível, taxa, devolução/compensação). Unicidade por pedido + chave de efeito. Campos exatos são definidos na implementação, mas a garantia deve estar no banco. Cada efeito novo de Pedido exige esse vínculo; não usar observacoes/descricao/recorrenciaGrupoId como chave de idempotência.

Cada condição de recebimento gera um ou mais lançamentos RECEITA com valor e vencimento explícitos. Para 300 com sinal 90 e saldo 210, criar 90 e 210; não chamar a recorrência com 300 duas vezes. Parcelas da mesma venda seguem a política de competência aprovada para essa venda, mesmo com vencimentos diferentes; confirmação comercial e recebimento de adiantamento não definem sozinhos receita reconhecida na DRE. A regra contábil permanece pendente para M2.

Reutilizar FormaPagamentoVenda como identidade comercial, com snapshot de prazo, taxas e faixas efetivamente usadas no acordo/título. A FK financeira existente aponta para FormaPagamento: manter um mapeamento explícito se necessário à UI legada, ou acrescentar vínculo comercial próprio sem misturar IDs. Não copiar cegamente nomes como identidade. Não criar outro cadastro de formas.

A geração/vinculação deve ser transacional e idempotente. Não haverá operação oficial de pedidos reais somente com M1, portanto controle manual paralelo de sinal/saldo não é estratégia de lançamento. Se houver lançamento legado a vincular, conferir valor/competência/estado antes de gerar outro; diferenças exigem revisão, nunca fusão por nome. Títulos ligados a pedido não podem sofrer edição/cancelamento genérico sem atualização do agregado e auditoria. Revisão do pedido com sinal recebido preserva a baixa e ajusta somente a obrigação remanescente; por exemplo, 300 com 90 recebidos, revisado para 350, mantém 90 recebidos e passa a dever 260, sujeitos às demais condições acordadas.

### Recebimento e conciliação

Reutilizar `baixarLancamento` para cada título integral, sob serviço autorizado e transação do domínio. Não criar um segundo registro de receita na baixa. Sinal/saldo previamente definidos não precisam de liquidação parcial genérica. Se ocorrer valor parcial não previsto, reprogramar/splitar somente o saldo pendente com trilha e soma preservada, antes da baixa, ou restringir esse caso até a função existir; não fingir que o helper já suporta parcial.

Estado financeiro do pedido deriva da soma de títulos válidos, baixas e devoluções vinculadas. Durante desenvolvimento isolado de M1, informar “financeiro não integrado” em vez de assumir em aberto/pago; não liberar esse estado como operação oficial de vendas reais. No M2, distinguir saldo a receber de restituição devida. Cartão pode ter pagamento do cliente confirmado antes do repasse bancário: se for incluído, guardar evento/comprovante da captura e recebedor/intermediário, sem baixar a conta bancária da loja antecipadamente. Isso requer B04.

Conciliação existente permite vários títulos por uma transação e receita + despesa de taxa. Exemplo: bruto 100, taxa 3, entrada 97; gravar receita 100 e taxa 3, conciliar o conjunto. Não adicionar ainda outra receita 97. Associação automática futura usa IDs externos quando houver; sugestão por data/valor/nome continua exigindo confirmação.

Desfazer conciliação simples preserva baixa. Corrigir baixa equivocada pode usar estorno técnico existente com auditoria apropriada. **Devolver dinheiro realmente recebido exige preservar entrada e criar saída vinculada**, não apagar movimento original.

### DRE, caixa e cancelamento

DRE e fluxo continuam lendo LancamentoFinanceiro; não passam a somar Pedido ou NotaFiscal. A ponte valida categoria ativa e compatível com RECEITA/DESPESA, além da data de competência. Relatório comercial lê Pedido/Item e usa nomes claros: valor vendido, cancelado, recebido e saldo devido são métricas distintas.

Cancelamento comercial de pedido local confirmado é bloqueado na etapa atual `ENTREGUE`, com motivo textual na interface. Um retorno operacional autorizado para a etapa anterior permite novamente cancelar, mesmo preservando `entregueEm` como primeira entrega. O servidor decide pela etapa sob a trava, com versão, idempotência, motivo, responsável e autor autenticado; retornar e cancelar não apagam a entrega ou sua auditoria. Venda cancelada com recebimento anterior mantém o histórico financeiro. Cancelar títulos ainda pendentes; representar devolução, retenção ou crédito conforme política B04 e origem única. A categoria/competência de reversão depende da política contábil e de B04, sem reescrever recebimento histórico. Um recebimento real não some do caixa porque a venda foi cancelada. Reembolso parcial não é “pago integralmente” nem “cancelamento de baixa”.

A referência técnica da restauração automática de crédito divide a chave interna
em blocos de até oito caracteres separados por `/`. Isso evita que uma chave
numérica ou UUID seja confundida com cartão pelo validador de referências;
a proteção contra dados de cartão, a chave idempotente e o hash original permanecem
intactos. A integração financeira cobre essa chave numérica de forma determinística,
após entrega e retorno, comprovando restauração única e ausência de caixa adicional.

CMV estimado não gera despesa no M2. O aceite de NF-e de compra já pode lançar grupo CMV; no M3 decidir se o indicador de consumo permanece analítico ou se há transição de reconhecimento no DRE. Não aplicar os dois cumulativamente.

### Contratos adicionais de M2 informados em 24/09/2026

Pedidos opera somente como delivery. As formas disponíveis ao Pedido são Pix, boleto com vencimento definido por cobrança, cartão de débito on-line em uma parcela e cartão de crédito on-line em uma a quatro parcelas; cadastros de outras formas no Financeiro permanecem. O número de parcelas da compra não define a quantidade de repasses. Para cartão, registrar transação externa e evidência de captura separadas do repasse: captura extingue a obrigação do cliente no valor capturado, mas não movimenta a conta bancária da loja. Bruto, taxa do estabelecimento, líquido e datas de previsão/realização são fatos distintos; desconhecido permanece ausente. Repasse não gera segunda venda. Sem configuração comprovada de intermediador, a automação externa permanece pendente.

Título interno de boleto, emissão externa e pagamento confirmado são estados diferentes. Referência e documento do emissor são guardados quando disponíveis; mudança do título interno não declara atualização do boleto externo. Vencimento não acompanha automaticamente a data de entrega. Pagamento tardio de cobrança cancelada é exceção, sem reativar o Pedido.

Cancelamento comercial preserva o recebimento original e não transfere dinheiro automaticamente. Tratamento autorizado usa exclusivamente valores efetivamente pagos/capturados ainda elegíveis: devolução integral; devolução parcial com valor devolvido e retido separados, motivo, responsável e referência da política/comunicação; ou crédito escolhido pelo cliente. Solicitação reserva valor e não equivale a conclusão; conclusão exige evidência externa. O valor reservado não pode ser concedido também como crédito. Retenção não deriva automaticamente de taxa do intermediador nem se torna nova venda. Validação aplicável à retenção continua pendente para operação real.

Crédito pertence ao comprador/pagador, vinculado ao Pedido, pagamento e tratamento que o originaram. Um extrato de movimentos registra concessão, aplicação, liberação/reversão e ajuste autorizado; o saldo não é campo livre. Crédito não é desconto, receita nova nem entrada/saída de caixa na conversão. Aplicação integral ou parcial é atômica com confirmação de novo Pedido, reduz apenas a obrigação restante, preserva o valor comercial e pode combinar com pagamento complementar. Reversão restaura apenas o valor explicitamente liberado pelo tratamento autorizado, uma vez. Não há validade automática, transferência entre clientes, venda de créditos ou fidelidade.

A política de competência e a classificação de devolução/retenção continuam abertas. O registro técnico de fatos e reservas não aprova seu reflexo na DRE. No ambiente isolado, efeitos que entram na DRE exigem categoria e data explícitas, usadas apenas como valores sintéticos de teste; sua operação real permanece bloqueada até política aprovada, sem categoria genérica nem data provisória presumida.

## Estoque e produção — Marco 3

Acompanhamento operacional usa estado próprio e eventos imutáveis no histórico do Pedido: início, quantidades preparadas/expedidas por item versionado, pronto, saída, entrega, ocorrências/resoluções e reagendamento. Cada comando exige autorização de revisão, versão e chave idempotente; a entrega exige saída registrada. Início guarda instruções e itens da versão executada. Após início, revisão comercial de itens fica bloqueada até contrato de ajuste físico; reagendamento explícito continua possível e não toca efeitos financeiros/físicos. Cancelamento interrompe a operação e preserva quantidades; não repõe estoque. Ocorrências podem ser abertas/resolvidas após entrega sem apagar o fato entregue. Esses eventos não são movimentos de estoque.

Fluxo mínimo: item confirmado → composição resolvida/snapshot → execução operacional explícita → movimentos de consumo → saldo. Uma execução registra pedido/item, local, quantidades, autor/data, snapshot usado, chave de repetição e movimentos resultantes; custo realizado precisa ser preservado nela ou em extensão específica de saída, porque custoUnitario atual só registra entradas.

Composição ausente não invalida pedido. Criar pendência operacional/custo; não declarar baixa completa com apenas os ingredientes conhecidos. Cadastro posterior pode criar revisão operacional explícita antes do consumo, sem modificar o snapshot comercial original ou recalcular margem passada silenciosamente.

Parcela independente implementada em `pedidos-composicao.ts`: necessidades da composição comercial fotografada, conversões explícitas de Insumos e estimativa da ficha pelo serviço `calcularCustosPreparacoes`. Início operacional guarda fotografia da estimativa, data e conversões no evento, sem nova despesa/baixa. Estimativa ausente fica nula; custo apurado e disponibilidade prometida continuam nulos enquanto B05 não define a execução física. Nenhuma explosão recursiva de custo gera movimento físico.

`pedidos-gestao.ts` consulta as fontes em transação RepeatableRead. Pagina pedidos e agrupamentos independentemente; agrupamentos percorrem toda a coorte selecionada em lotes. Usa somente itens vigentes de confirmados ativos, snapshots e unidade; conjunto de categorias evita múltipla atribuição do valor. Financeiro acumulado até a consulta acompanha também cancelados e discrimina captura, repasse, taxas, crédito e devolução; o filtro é de confirmação/previsão, não de caixa. Não calcula margem com custo incompleto nem altera DRE. As páginas exigem permissões no servidor; operação usa a capacidade existente de revisar Pedidos.

Preparações têm dois modos possíveis, definidos em B05:

- Estoque de intermediário: produção baixa ingredientes e entrada registra rendimento real do intermediário; venda baixa intermediário. Não explodir novamente ingredientes na venda.
- Preparo sob encomenda sem estoque intermediário: venda/produção baixa ingredientes resolvidos uma única vez. Não gerar simultaneamente baixa do intermediário.

Não escolher o modo pelo simples tipo PRODUTO_INTERMEDIARIO. Exigir política/unidades/conversões/rendimento e proteção contra ciclos no momento da execução.

Se adotada reserva, ela é compromisso separado do saldo físico: confirmar reserva, consumir libera/resgata reserva, cancelar libera restante. Nenhum enum de saída serve como “reserva”. Reserva não é indispensável ao M1 e só deve ganhar estrutura no M3 se a operação exigir disponibilidade prometida.

Cancelamento depois de consumo não repõe tudo automaticamente. Registrar retorno físico recuperável, reaproveitamento ou perda conforme realidade, com referência ao movimento original e limite de quantidade estornável; cada estorno tem identidade única. Perda e consumo não podem contabilizar duas saídas para a mesma quantidade já retirada sem contrapartida apropriada.

## Fiscal — Marco 4

Pedido fornece snapshot do comprador/destinatário, endereço estruturado necessário, itens/códigos/unidades/quantidades, preços/adicionais/descontos/frete/rateios, datas, forma de pagamento e identificadores estáveis. Dados fiscais cadastrais podem ser referência de preparação, mas o documento guarda snapshot do emitente, destinatário, regras/tributos efetivamente aplicados e XML/protocolo retornado.

Criar documento de saída separado com FK de Pedido e identidade externa única, tentativas/eventos e estado próprio; admitir mais de um documento por pedido quando a operação definida exigir, sem assumir 1:1. Uma autorização, rejeição ou cancelamento fiscal não cria venda/baixa/consumo novamente. Em resultado externo incerto, consultar identidade antes de reenviar. Não antecipar campos tributários sem fornecedor/contador.

Até lá, se a emissão ocorrer em outro sistema, uma referência de documento externo pode ser registrada com origem e evidência, sem marcar como homologada uma integração inexistente. O aceite operacional dessa alternativa depende de E01 em decisões.

## Referência, snapshot e versão

| Informação | Referência dinâmica | Snapshot mínimo | Versionamento necessário |
|---|---|---|---|
| Cliente | ID para próximas compras | Nome/tipo/documento informado/contato usado | Evento se corrigir dados da venda, sem alterar cadastro retroativamente |
| Entrega | Endereços atuais só para selecionar | Destinatário, contato e endereço completo escolhido | Alteração operacional auditada antes/depois |
| Produto | ID, atividade e cadastro atual para nova venda | Nome/código/unidade/categorias relevantes e preço aplicado | Versão de cadastro como proveniência, nunca substituto da cópia |
| Complementos | IDs para rastrear escolhas | Nome, preço, quantidades/multiplicadores, limites usados | Revisão do item se alteração após confirmação for suportada |
| Composição | IDs de insumos | Quantidades/unidades resolvidas ou pendência explícita | Snapshot operacional antes de executar; não exige tabela universal de versões de catálogo |
| Custo | Custo atual para estimativa nova | Valor/base/data estimados e custo realizado no consumo | Correção explícita, não recomputação silenciosa |
| Pagamento | Forma comercial atual como sugestão | Condições/taxas/vencimentos acordados | Evento de renegociação; preservar parcelas já recebidas |
| Fiscal | Produto/grupo atual antes de emitir | Documento guarda configuração realmente aplicada | Eventos/tentativas/documentos substitutos; não alterar autorização histórica |

## Estados e efeitos

Nomes abaixo são proposta mínima, não enums implementados.

| Dimensão | Estados suficientes | Fonte / efeito |
|---|---|---|
| Comercial | RASCUNHO, CONFIRMADO, CANCELADO | Persistida; confirmação registra a venda e sua versão inicial; revisão controlada conserva versões anteriores. Cancelamento só antes da conclusão/entrega. ORÇAMENTO pode ser evolução |
| Operacional | PENDENTE, EM_PREPARO, PRONTO, ENTREGUE, INTERROMPIDO | Persistida; início de preparo não confirma pagamento. Usar somente estados que tenham ação operacional |
| Financeira | NÃO_INTEGRADO; ABERTO, PARCIAL, QUITADO, RESTITUIÇÃO_PENDENTE, REEMBOLSADO | Derivada de títulos/recebimentos/devoluções; detalhar reembolso parcial por valores, sem um booleano pago |
| Fiscal | NÃO_INTEGRADO/NÃO_APLICÁVEL quando definido externamente; PENDENTE, PROCESSANDO, AUTORIZADO, REJEITADO, CANCELADO | Derivada dos documentos, nunca de fiscalRevisado do produto |

Confirmar não significa receber, consumir ou emitir automaticamente. Os efeitos habilitados são comandos explícitos, atômicos no banco e com chave própria. Cancelar com efeitos já executados exige compensação, não apagar linhas. Entregue não implica quitado; quitado não implica entregue; fiscal rejeitado não elimina a venda.

Não usar quatro campos editáveis independentes sem invariantes: comercial/operacional possuem transições; financeiro/fiscal refletem os registros reais. Travas, versão e autoria devem proteger operações concorrentes, seguindo os contratos existentes de banco e acesso.

## Canal iFood — implementação local (06/10/2026)

`src/lib/ifood` adapta Order ao mesmo PedidoVenda, com inbox/outbox duráveis e tokens cifrados. ItemPedidoVenda.produtoId é opcional para preservar pedidos remotos sem pareamento; o fluxo manual continua exigindo produto. RECEBIDO_EXTERNO não é confirmação comercial. As fronteiras de pedidos impedem edição manual, estoque, fiscal e crédito/devolução local para origem IFOOD. Títulos/recebimentos permanecem no financeiro existente. Integração desligada e sem homologação: contratos, limitações e evidências em [iFood](../ifood/SPEC.md) e [operação](../ifood/OPERACAO.md).

## Gestão de pedidos — edição segura e resumo comercial, 09/10/2026

`src/lib/vendas/pedidos-edicao.ts` delimita a edição de informações: agenda,
cobrança/faturamento e destinatário, sem mudança comercial. Observações dos
itens e instruções de produção continuam imutáveis após confirmação.
`editarInformacoesPedido` em `pedidos.ts` relê autorização e revisão sob transação,
valida domínio e registra fato/auditoria com chave idempotente. Estados comerciais
ou operação concluída não impedem esses metadados; primeira entrega é preservada.
Pedido externo iFood conserva a autoridade da integração.

`revisarPedido` recusa mudanças de cliente/canal/atendimento, entrega com impacto de
frete, pagamento, itens, preços/composição, quantidades, descontos, frete e outros custos
de pedidos confirmados. A UI deixa claro cancelar e criar um novo pedido. Orçamento
continua usando cálculo e salvamento explícitos; revisões históricas não são apagadas.
Cancelamento, recebimento e pós-venda mantêm seus serviços e autorizações próprios.
O menu de cancelamento abre `CancelamentoPedido` controlado, solicitando nome e
motivo. A action valida ambos no servidor; o nome informado é contexto do evento
`CANCELADO.depois.responsavelInformado` e do hash idempotente, nunca substitui a sessão
autenticada. Integrações técnicas anteriores continuam aceitando a assinatura sem
esse contexto; efeitos financeiros, reservas e autoridade iFood são preservados.
`?cancelar=1` é somente intenção de abertura da UI: o servidor confere permissão e
estado. A chave do detalhe inclui essa intenção após a guarda de navegação permitir
troca; não inclui a versão do pedido, para não descartar alterações ao atualizar.

`consultar-resumo-pedido.ts` é leitura autorizada. Confirmados usam snapshots/itens
vigentes sem consulta de preços atuais; orçamento usa `calcularPedido` sem confirmar,
reservar estoque ou gerar títulos. Valores unitários e subtotal derivam de Decimal
com complementos; `resumo-pedido.ts` apenas adapta/formata dados. Documento A4 e
comanda têm geradores e ações distintas. `listarPedidos.contagensStatus` conta antes
da paginação e ignora os filtros do grupo de status, preservando os demais filtros.

Fotos de Pedidos continuam privadas: acesso Produtos/Fiscal existente ou permissão
Pedidos com produto vinculado a item vigente de pedido. Isso não autoriza acesso ao
catálogo comercial nem reescreve snapshots. Fotos atuais têm uso apenas visual.


## Refinamento de fidelidade — 09/10/2026

O Gestor consulta `status: operacionais` por padrão; o filtro é aplicado antes de
count/skip/take: confirmados não interrompidos ou recebidos iFood. A consulta global
`listarPedidos` conserva seu padrão anterior para outros consumidores. Orçamentos e
encerramentos continuam acessíveis por filtro próprio. Contagens de status ignoram
a seleção do grupo, mas respeitam busca, canal, cliente, produto e período.

O DTO acrescenta somente identidade/foto atual do produto, `criadoEmExterno` iFood
validado e `consultadoEm`. Fotos aceitam apenas a rota privada do catálogo. Preços,
composição e valores continuam fotografados; um produto sem foto exibe fallback
acessível. Agrupamento visual usa ID e Decimal, sem alterar itens comerciais.

`modal-pedido.tsx` coordena detalhe lateral não modal no desktop e modal no móvel.
`navegarComPedidoAberto` submete troca de pedido, filtros e navegação à proteção
de descarte; envio/CEP pendentes bloqueiam saída. `detalhe-pedido.tsx` conserva
metadados staged e envia uma única revisão explícita com motivo. Uma resposta
concorrente não atualiza silenciosamente a versão original de uma edição aberta.
Resumo comercial descendente consulta snapshots salvos e conserva staged no pai.
Validação de formulários abertos limita-se às seções que compõem o envio. Cobrança
inalterada/incompleta não bloqueia salvar agenda alterada. O detalhe não carrega
apontamentos, ocorrências ou reservas só para a seção removida de Operação do pedido;
serviços e rotas dedicadas de produção conservam seus contratos.
