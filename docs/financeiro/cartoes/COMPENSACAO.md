# Compensação de itens da fatura — 06/10/2026

## Objetivo e aceite

Permitir selecionar uma cobrança positiva e um crédito negativo da mesma fatura,
na mesma data da compra, com valores exatamente opostos em centavos. O usuário
confirma com motivo; os dois itens permanecem visíveis como Compensados, sem criar
receita, despesa, baixa ou movimento bancário para esse par. O líquido do par é zero
no mesmo dia e o total original da fatura continua sendo conferido.

Não há compensação automática, entre faturas/datas diferentes, entre vários itens,
nem compensação parcial. Lançamentos existentes não são cancelados ou excluídos.
O crédito não precisa ter categoria ou descrição idêntica à cobrança: a associação
é explícita, feita pelo usuário. A classificação existente é preservada, mas o par
não exige classificação para dispensar os lançamentos.

## Persistência, autorização e reversão

- `ItemFaturaCartao.compensadoComId` referencia reciprocamente o outro item.
  FK restritiva, índice único e CHECK contra autovínculo são aditivos na migration
  `20261006100000_compensacao_itens_fatura`; não transformam dados históricos.
- `servico.ts::compensarItensFatura` relê sessão/ACL de edição de Faturas, trava
  acesso/cartões/fatura e versão. Fatura paga também exige edição de Baixas.
  Recusa itens ignorados, vinculados, já compensados ou cobrança usada por outro
  estorno ativo. Item fora da fatura, diferença de data, zero e centavos diferentes
  não podem ser confirmados. Repete a compensação já íntegra sem novo evento quando
  chamada com a versão atual; repetição concorrente com versão vencida é rejeitada.
- `compensacao.ts` compartilha a elegibilidade com a UI e confere ambos os lados
  antes de dispensar lançamentos. Referência unilateral, valor/data diferente ou
  lançamento/duplicidade no par bloqueiam a finalização. A classe de erro fica em
  `erros.ts`, reexportada por `dominio.ts`, sem levar `node:crypto` ao navegador.
- Compensar e desfazer gravam os dois lados atomicamente e registram autor, motivo,
  IDs, data e valores em `HistoricoCartao`. Desfazer reabre ambas para revisão,
  preservando valores, classificação, documentos, pagamentos e movimentos existentes.

## Integrações e interface

`resumir`, pendências de cadastro/vínculo e contagem de itens por classificar tratam
um par íntegro como resolvido. `conciliarFatura` e `concluirDespesasFatura` pulam o
par ao criar faltantes. O total continua somando os itens originais; liquidações e
relatórios usam somente lançamentos reais restantes. Uma fatura composta apenas
por um par de total zero fica Conciliada, sem inventar pagamento bancário.

A UI reutiliza Checkbox, GrupoAcoes, Button, Badge e ConfirmacaoFatura existentes:
selecionar as duas linhas → **Compensar selecionados** → motivo → Confirmar.
Há filtro Compensados e **Desfazer compensação** no detalhe. O par fica protegido
contra classificação, ajustes de valor, ignorar e vínculo até desfazer.
Referência visual **Em revisão**; não acrescenta variantes ou tokens.

## Validação e publicação

Fixtures são fictícias e ações da prévia são simuladas. Integração aplica as SQL
manuais somente em schema temporário de PostgreSQL localhost com guarda explícita.
Regressões: `testes/financeiro/faturas/compensacao.test.ts`,
`compensacao-interface.test.tsx` e `integracao.test.ts`, mais consumidores financeiros.
Resultados e próximo passo ficam em [EXECUCAO](EXECUCAO.md).

A autorização deste incremento é para criar a opção. Não houve operação real nem
publicação. Após autorização específica, seguir o ritual de Deploy: backup privado
verificável antes da migration, preservação fiscal, build, tarefa estável, migration
status e UI autenticada de leitura. Não compensar itens reais como teste de deploy.

Antes de haver compensações reais, a coluna aditiva é compatível com a aplicação
anterior. Depois do uso, versões anteriores não reconhecem o vínculo e podem voltar
a exigir lançamentos para o par. Preservar histórico e preferir correção de código;
não restaurar dump sobre transações novas nem retornar cegamente à versão antiga.
