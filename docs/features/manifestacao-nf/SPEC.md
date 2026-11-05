# Manifestação de notas — datas e outras operações

## Objetivo

Permitir vencimento no aceite de NFS-e, recebimento explícito no uso e consumo e
tratamento próprio de NF-e de devolução/retorno ou sem efeito de compra.
Pedido de 04/11/2026: corrigir e publicar. O responsável definiu a devolução como
fato já realizado. Não há agendamento de devolução futura.

## Comportamento

- NFS-e: vencimento opcional no aceite. Data civil válida entre 2000 e 2200.
  O aceite guarda a data e o evento na mesma transação. Não cria despesas.
  O lançamento posterior sugere o vencimento aceito e permite editar parcelas.
- NF-e de compra: data de recebimento obrigatória para todos os itens conciliados,
  inclusive uso e consumo. Somente estoque exige local e gera movimento.
  Recebimento, competência, emissão e vencimentos permanecem independentes.
- Outras operações: escolha explícita no painel. Natureza do XML não decide o
  tratamento automaticamente. Registrar devolução/retorno exige XML completo,
  data efetiva não futura e motivo de 15 a 500 caracteres. Confirma a operação
  pelo serviço SEFAZ existente, sem criar parcelas, despesas ou estoque.
- Ignorar: encerra somente a pendência interna, com motivo. Não transmite evento,
  não recusa nem cancela a nota. XML e histórico continuam disponíveis.
- Reabrir: limpa o tratamento interno e conserva o histórico fiscal. Exige motivo
  e revisão atual. A reabertura não desfaz uma confirmação já registrada na SEFAZ.
- A lista possui filtros próprios para notas ignoradas e devoluções/retornos.
  Esses estados não integram o contador de pendências.

## Persistência e proteção

Migration manual aditiva `20261104120000_manifestacao_datas_tratamento`:
`NotaFiscalServico.dataVencimento`, `NotaFiscalItem.dataRecebimento` e campos de
tratamento/revisão em `NotaFiscalRecebida`. Datas antigas permanecem nulas.
Estoque legado conserva a leitura da data pelo movimento existente.

O controle local é separado de `ManifestacaoNFe`. A mesma coordenação `aceite-nota`
serializa as operações. A autorização é relida no servidor. Revisão, auditoria e
conteúdo impedem alterações concorrentes e repetição de efeitos. Compras que já
geraram efeitos ou foram canceladas não podem ser ocultadas por esse tratamento.
Formulários antigos de compra/recusa não operam sobre uma nota tratada.

Sucesso fiscal e gravação interna são etapas independentes. Uma falha interna
depois da confirmação preserva o evento fiscal e permite concluir sem reenviar.
As falhas continuam visíveis ao operador. Nenhum teste transmite notas reais.

## Interface e arquivos

Referências: `nota-fiscal-dialog.tsx`, `EntradaEstoqueNota` e o campo Primeiro
vencimento de `manifesto-nfs-view.tsx`. Reutiliza Select, Input, Label, Textarea,
Dialog, BadgeNota, GrupoAcoes e Button; confirmações novas usam `entrada`.
As ações quebram em telas estreitas. Novas referências continuam Em revisão.

- `src/lib/nfse/situacao.ts` e `/api/nfse/situacao`: aceite com vencimento.
- `src/lib/notas-fiscais/tratamento-local.ts`: validação compartilhada.
- `notas-fiscais/tratamento-local-actions.ts`: coordenação e auditoria.
- `notas-fiscais/tratamento-outra-operacao.tsx`: controle operacional explícito.
- `notas-fiscais/actions.ts`, `aceitar-nota.ts` e `validar-conciliacao.ts`: recebimento
  obrigatório e bloqueio de formulários antigos.
- `testes/visual/manifestacao-nf*`: componentes reais com serviços e dados sintéticos.

## Critérios de conclusão

Testes de domínio, interface, autorização e PostgreSQL isolado devem comprovar as
datas, idempotência, concorrência e rollback. Conferir os consumidores financeiros,
lint/design, tipos, build e imagens responsivas. Publicação exige backup íntegro,
plano de migrations conferido, CI aprovado, estabilidade e smoke autenticado.

Não alterar competência/parcelas históricas, emitir/cancelar notas de fornecedor,
executar manifestações reais para testar ou restaurar banco sobre operações novas.
O fallback anterior de competência NFS-e sem emissão nem competência é preservado.

Progresso e resultados: [TASKS](TASKS.md).
