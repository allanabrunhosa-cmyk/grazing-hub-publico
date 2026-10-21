# Pedidos — caminho incremental econômico

**Atualização de 26/09/2026:** o lançamento operacional com financeiro externo, produção e calendário precede a ativação financeira completa. Sua publicação foi autorizada pelo usuário após validação. O modo EXTERNO não depende da contratação de intermediador nem da ativação de M2; os contratos financeiros existentes permanecem preservados e restritos. Critérios e evidências em [EXECUCAO](EXECUCAO.md). A sequência abaixo é o plano histórico da integração completa.

Situação inicial em 24/09/2026: auditoria e planejamento concluídos. A execução posterior de M1 em ambiente isolado está registrada em [EXECUCAO](EXECUCAO.md). M2 e o gate de primeiro uso real permanecem pendentes.

Base: [AUDITORIA](AUDITORIA.md), [GAPS](GAPS.md), [ARQUITETURA](ARQUITETURA.md). Decisões identificadas por B/E: [DECISOES_PENDENTES](DECISOES_PENDENTES.md).

## Sequência recomendada

```text
Decisões de M1 fechadas
  → M1: pedido comercial e histórico
  → M2: títulos, recebimentos, conciliação e relatórios financeiros
  → gate de primeiro uso real: M1 + M2 funcionais e caminho fiscal E01 confirmado
  → M3: consumo rastreável e custos
  → M4: fiscal de saída
  → M5: canais externos
```

Não completar todas as composições, reconstruir Financeiro, desenvolver site ou contratar arquitetura nova antes do M1. **B02 exige M2 funcional antes de usar Pedidos como fonte operacional oficial para vendas reais**; M1 isolado serve a desenvolvimento e validação. A orientação E01 deve confirmar o caminho fiscal antes de operar; se emissão externa não atender, a parte necessária de M4 passa a condição de lançamento.

## Marco 1 — núcleo de pedido comercial e histórico, sem uso real isolado

**Dependências:** decisões B01–B03/B07/B08 fechadas em [DECISOES_PENDENTES](DECISOES_PENDENTES.md). A política de competência contábil e E01 condicionam uso real/integração posterior, não o início de desenvolvimento do núcleo. Não depende de ficha completa para todo produto. G01–G04 são obrigações do próprio marco, não uma fase de reescrita anterior.

**Incrementos e alterações necessárias:**

1. Núcleo de Pedido/Item/Histórico com FKs, número único, chave de repetição, versão/revisões, valores e snapshots de comprador, destinatário quando distinto, produtos e escolhas; migration futura manual/aditiva conforme [banco](../../contexto/banco-de-dados.md). Registrar origem/canal e integração financeira pendente. Separar criação, confirmação, previsão de atendimento e entrega efetiva; pedido não imediato exige previsão antes da confirmação.
2. Serviço de rascunho, confirmação, revisão controlada de confirmado e cancelamento antes de conclusão/entrega. Validar cliente/produto/canal/configuração/quantidade, calcular preço vigente, exceção manual, desconto e frete no servidor, preservar antes/depois e autor. Produto de base zero com opção obrigatória válida deve atravessar cadastro→consulta→configuração→confirmação; não usar preço simbólico. Proteger produto usado contra exclusão física.
3. Capacidades granulares no sistema de permissões existente: visualizar, rascunho, confirmar, revisar, desconto, preço manual e cancelar, com revalidação no servidor e na transação crítica. Não fixar nomes de cargos.
4. Interface de lista/detalhe/editor com componentes/tokens existentes, entrega/retirada, comprador/destinatário/endereço, imediato/agendado, confirmação e revisão explícitas. Sem salvar edição comercial ao perder foco.
5. Consulta por cliente, produto, canal, datas e situação: carteira de vendas confirmadas, versões e cancelados identificados, sem apresentá-la como DRE. Exibir pendências de composição/custo e integração financeira; confirmação não baixa estoque, recebe pagamento nem emite fiscal.

**Reutilizar:** ClienteVenda, ProdutoVenda, CanalVenda, grupos/opções, `simularConfiguracao`/`resolverConfiguracao` como cálculo auxiliar revalidado, componentes de UI, sessão, permissões e padrão de histórico. Não tratar o simulador como comando de venda nem como validador completo de atividade do produto.

**Áreas de trabalho futuras:** schema/migration aditiva; `src/lib/vendas`; nova seção dentro de `src/app/(protegido)/vendas`; catálogo/contrato de permissões; guarda de exclusão em `persistencia.ts`; testes de Vendas e consumidores. Ler guias locais do Next antes de escrever código. Não alterar fluxo de compras.

**Testes essenciais:** A (parte comercial), C e G; preço/promocional/opções, base zero configurável e quantidades inteiras/fracionadas conforme unidade; desconto e frete separados; autorização de preço/desconto/revisão/cancelamento; pedido imediato/agendado; snapshots após mudança cadastral e revisão controlada; produto usado protegido; retry/concorrência, token divergente, sessão revogada e rollback; cancelamento antes da entrega e recusa de cancelamento simples após entrega. Caso base zero atravessa persistência→consulta→confirmação, não só fixture. UI com fixtures e imagem isolada.

**Conclusão objetiva:** pedido fictício de homologação com cliente, itens, quantidades, preço, desconto, frete, canal e atendimento pode ser confirmado uma única vez; entra na carteira comercial na confirmação. Revisão mantém versões e cancelamento pré-entrega retira o valor ativo sem apagar trilha. Produto sem ficha continua comercialmente válido com pendência clara. Não há decisão P0 pendente; todos os P0 técnicos precisam estar implementados e validados antes de qualquer uso real.

**Limite até M2:** carteira comercial não é recebimento nem DRE; estado financeiro fica “não integrado” somente durante desenvolvimento/validação. Não liberar M1 isolado para vendas reais oficiais nem criar controle paralelo de sinal/saldo como solução de lançamento.

## Marco 2 — Pedido → Financeiro → recebimentos → conciliação → DRE/caixa

**Estado de execução:** vínculo e recebimentos diretos/parciais, seguidos dos incrementos A–C de pagamentos externos rastreados, devoluções e crédito, foram implementados e testados em ambiente isolado conforme [EXECUCAO](EXECUCAO.md). O aceite integral do marco permanece aberto por competência/classificação contábil, configuração do intermediador e homologação externa, validação aplicável da retenção, E01 e verificação do ambiente de publicação.

**Dependências:** M1; política B04 de meios, parciais imprevistos e devolução/retenção/crédito antes de concluir integração; competência financeiro-contábil apropriada, sem derivá-la automaticamente da confirmação; conta/categorias/formas verificadas em homologação. E01 condiciona o primeiro uso real. A auditoria não atesta dados reais.

**Incrementos e alterações necessárias:**

1. Acrescentar origem comercial/FK/chave de efeito aos lançamentos existentes; criar/vincular um ou mais títulos por pedido, com valores e vencimentos explícitos cuja soma fecha com a obrigação. Sinal 90 e saldo 210 representam pedido 300 sem usar recorrência. Compatibilizar forma comercial e financeira sem duplicar cadastro.
2. Reutilizar baixa por título e derivar recebido, saldo e eventual restituição dos efeitos reais. Pagamento parcial imprevisto exige desdobramento rastreável do saldo pendente antes da baixa, se incluído pela política B04. Captura de cartão e repasse ficam separados se cartões forem liberados.
3. Revisão de valor de pedido com sinal recebido mantém o pagamento histórico e ajusta os títulos pendentes; proteger edição/exclusão/estorno genéricos dos títulos integrados. Por exemplo, 300 com 90 recebidos, revisado para 350, mantém 90 recebidos e saldo 260 conforme condição acordada.
4. Referência ao pedido em consultas e conciliação: localizar/liquidar/relacionar títulos existentes, sem criar segunda receita; associar bruto e taxa líquida corretamente. DRE/caixa continuam consumidores dos lançamentos, segundo política de competência aprovada, sem somar Pedido ou nota fiscal.
5. Cancelamento pré-entrega com títulos pendentes e pagamento anterior preservado; devolução/retenção/crédito conforme B04, com efeitos financeiros separados e auditados. Pedido entregue segue fluxo posterior distinto.

**Reutilizar:** LancamentoFinanceiro, CategoriaFinanceira, ContaBancaria, baixa, MovimentacaoBancaria, TransacaoExtrato/VinculoExtrato/HistoricoConciliacao, DRE e fluxo. Reutilizar o fechamento líquido já existente para receita + taxa. Não reaproveitar recorrência como divisão de venda.

**Áreas:** fronteira comercial `src/lib/vendas`, ações de baixa/lançamentos/conciliação, consultas financeiras e tipos relacionados, schema aditivo de vínculo, testes de Vendas/Financeiro. Serviços de relatório mudam somente quando a integração/decisão demonstrar necessidade.

**Testes essenciais:** A completo, B, D com e sem sinal, F; 300→90/210 e revisão 300→350 após sinal 90; 100→33,33/33,33/33,34; competência distinta de confirmação, vencimento e pagamento conforme política aprovada; baixas/retries concorrentes; importação repetida; realizado conciliado sem nova baixa; bruto 100−taxa 3=97; divergências recusadas; extrato não duplica título; cancelamento/reembolso parcial conforme B04; mutação avulsa incoerente bloqueada; permissão e rollback. Integrações opt-in apenas em PostgreSQL local isolado.

**Conclusão objetiva:** a venda aparece uma vez na carteira comercial; títulos e DRE refletem a política contábil aprovada sem duplicação. Recebimento aparece uma vez no caixa e pode ser conciliado depois. Recebido, saldo a receber e restituição são discriminados; revisão preserva recebimentos; reembolso mantém entrada original e saída real. Repetir confirmação, revisão, geração, baixa ou conciliação não duplica efeitos. Com M1+M2 funcionais e E01 resolvida, o uso real pode ser avaliado.

## Marco 3 — composição → produção/estoque → consumo → CMV

**Continuação de 24/09/2026:** acompanhamento operacional, agenda, quantidades parciais, ocorrências e cobertura/custo estimado fotografado implementados; consultas gerenciais adicionais disponíveis. B05 impede ativar reserva/consumo/retorno/perda, modo de intermediários e ajuste de itens após preparo; B06 impede CMV contábil. Integrações externas dependem de identificação/contrato/sandbox. Ver evidências e retomada em [EXECUCAO](EXECUCAO.md); não considerar o marco integralmente concluído.


**Dependências:** M1 e contratos de efeito; M2 para integrar qualquer consequência financeira. B05/B06 (consumo/disponibilidade e política de CMV). Começar com um conjunto pequeno de produtos homologados, sem exigir completar o catálogo inteiro.

**Incrementos e alterações necessárias:**

1. Diagnóstico por produto/configuração: aptidão comercial, de consumo e de custo separadas; revisão explícita de composição/unidade/rendimento/local, com snapshots.
2. Execução mínima ligada a item/pedido, movimentos e custo aplicado, com chave única e transação. Preservar quantidades decimais na fronteira do helper; data e autor explícitos.
3. Modo de preparação sem dupla baixa; lote/rendimento apenas onde intermediários forem estocados. Reserva separada se necessária; não movimentar saldo físico ao reservar.
4. Cancelamento após consumo com retorno físico, perda ou reaproveitamento rastreáveis. Indicador de custo estimado versus realizado; decisão e eventual adaptação delimitada para CMV na DRE, impedindo custo duplicado da compra.

**Reutilizar:** Insumo, ComposicaoInsumo, ConversaoInsumo, custo recursivo, SaldoEstoque, MovimentacaoEstoque, `registrarMovimentacao` e padrões auditados de estorno/perda. Ficha/etiqueta não substituem ordem de execução.

**Áreas:** `src/lib/vendas`, `src/lib/estoque`, `src/lib/insumos`, fronteira mínima de produção e inventário, vínculo aditivo no schema. Emissão de etiqueta continua sem baixa implícita.

**Testes essenciais:** C com pendência, D sem consumo, E; composição fixa/variável; ingrediente oculto na ficha continua consumido; insumo repetido e frações pequenas; preparação recursiva/conversão/ciclo; modos direto/intermediário; duas execuções concorrentes; disponibilidade/saldo negativo conforme política; cancelamento repetido; quantidade retornada não maior que consumida; alteração de custo posterior não muda realizado anterior; compra já no CMV seguida de consumo não duplica despesa.

**Conclusão objetiva:** para produtos homologados, cada execução preserva composição/quantidades/local/custo/autor e explica seus movimentos. Reenvio não altera saldo novamente. Preparação e ingredientes não sofrem dupla baixa. CMV desconhecido permanece pendente; produto incompleto continua vendável, com operação manual explicitamente identificada. DRE usa apenas uma política de reconhecimento de custo.

## Marco 4 — preparar e integrar fiscal de saída

**Dependências:** M1, valores/pagamentos coerentes, decisões externas E01–E03 e B01; M3 não é requisito universal para emitir. Se exigido para o primeiro lançamento, antecipar o caminho fiscal apropriado sem antecipar automação desnecessária de estoque.

**Incrementos e alterações necessárias:** cadastro de emitente/destinatário necessário ao provedor; revisão fiscal dos produtos para as operações reais; documento de saída ligado ao pedido, snapshot de emissão, chaves/tentativas/status/eventos; envio/consulta/cancelamento segundo contrato do fornecedor; referência externa durante transição se aceita.

**Reutilizar:** dados fiscais de ProdutoVenda/GrupoFiscalVenda como entrada revisável, empresa, certificado/acesso quando compatíveis e valores do pedido. Não reutilizar nota de entrada como documento de saída nem assumir que consulta SEFAZ/NFS-e já emite.

**Testes essenciais:** valor/quantidade/unidade/desconto/frete fechando documento; comprador distinto de destinatário; dados faltantes sem valores fabricados; reenvio idempotente; retorno incerto seguido de consulta; autorizado/rejeitado/cancelado; múltiplos documentos se exigidos; alteração cadastral posterior não muda documento; fiscal não gera segunda receita/baixa/consumo. Homologação externa documentada separadamente de mocks.

**Conclusão objetiva:** documento autorizado em homologação e, quando houver autorização de publicação/operação, fluxo real conferido; chave/protocolo e XML correspondem ao pedido e são rastreáveis. Pendência externa permanece pendente, sem “emitido” por sucesso HTTP. Nenhuma regra tributária é escolhida pelo desenvolvedor sem fundamento aprovado.

## Marco 5 — canais externos

**Dependências:** núcleo M1 estável, eventos financeiros M2 e política fiscal aplicável; M3 apenas para canais com compromisso automatizado de estoque. Contratos/acesso/mapeamento externos E04.

**Incrementos e alterações necessárias:** começar por um canal; identidade única origem/loja/pedidoExterno/evento; recibo de processamento/retry mínimo e payload relevante protegido; adaptação ao mesmo comando de criação/alteração comercial; mapa de produtos/opções/canais; tratamento de pagamento, subsídios/descontos e taxas; cancelamentos fora de ordem e reconciliação de estados.

**Reutilizar:** núcleo de Pedido, snapshots, comandos idempotentes e padrões de IdentidadeExternaVenda/importação. O modelo polimórfico de catálogo pode inspirar/reutilizar convenções, mas precisa de contrato explícito para pedidos/eventos; nenhuma sincronização é obtida só cadastrando a identidade.

**Testes essenciais:** mesmo pedido/evento reentregue; duas lojas com mesma chave; eventos fora de ordem; opção não mapeada; divergência de preço sem sobrescrever catálogo; cancelamento após consumo/pagamento; indisponibilidade/retry; total bruto/desconto subsidiado/taxa/líquido e homologação do canal.

**Conclusão objetiva:** um pedido externo entra uma vez no mesmo histórico, aparece nos mesmos relatórios e produz efeitos pelas mesmas regras da venda interna. Falhas ficam recuperáveis e rastreáveis; o site é cliente dessa estrutura, não segundo domínio de vendas.

## Validação e publicação futuras

Durante implementação, nível A focado; na conclusão de cada domínio, B com integrações e consumidores afetados. Antes de publicar código, C conforme [testes](../../contexto/testes.md) e ritual de deploy, somente em tarefa autorizada. UI exige lint:design, consumidores e imagens isoladas. Migrations manuais/aditivas, nunca migrate dev/db push. Registrar skips e resultados reais no registro de execução.

Esta atualização documental registra as decisões B01–B03/B07/B08 e fecha o gate de decisões para iniciar implementação de M1; não implementa, testa ou publica Pedidos. Próxima ordem técnica: M1 (G01–G04 e parcelas comerciais de G05/G07/G08/G09), depois M2 (G06, parcela financeira de G09 e integração), então avaliação do primeiro uso real com B04, política contábil e E01 resolvidas. M3–M5 permanecem posteriores conforme dependências.
