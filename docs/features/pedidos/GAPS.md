# Pedidos — lacunas, riscos e prioridades

**26/09/2026 — mudança de lançamento:** gateway/competência/emissão no HUB não são bloqueios genéricos do novo modo operacional com financeiro externo. Contratos, testes e bloqueios concretos desta revisão estão em [EXECUCAO](EXECUCAO.md). Permanecem fora do lançamento conectores e política contábil. Reentrada de alimento transformado continua exigindo tratamento específico; cadastro incompleto afeta somente o passo físico correspondente. Os estados abaixo registram marcos anteriores, não autorizam converter pedidos M2.

**Liberação operacional — 25/09/2026:** B05 aprovado pelo usuário; núcleo de reserva/consumo parcial, liberação, retorno do componente recuperado e destino de perda implementado no ambiente isolado. Prontidão cadastral, revisões controladas, referência fiscal externa e bloqueio real no servidor acrescentados. Isso não encerra todos os ajustes físicos: reaproveitamento de produto preparado depende de identificação/condição e mapeamento reais, sem restauração automática de ingredientes; lotes físicos/validade não são representados pelo lote lógico da reserva. Custo por movimentos, política contábil, conectores/sandbox, cadastro real, E01 e Node 22 permanecem pendentes. Matriz T01–T16 e evidências atuais em [EXECUCAO](EXECUCAO.md); o parágrafo seguinte é o ponto anterior.

**Atualização localizada — continuação não fiscal:** agenda, trilha operacional com quantidades parciais, ocorrências e reagendamento; cobertura de composição/custo estimado e consultas gerenciais foram acrescentadas. Consumo/reserva/retorno/perda, custo apurado e ajuste pós-preparo seguem dependentes de B05/B06. G04/M2 e os contratos físicos de M3 não estão encerrados. Integração automática não foi identificada/configurada/homologada. Evidências em [EXECUCAO](EXECUCAO.md).


Base/data e evidências E01–E18: [AUDITORIA](AUDITORIA.md). As linhas abaixo preservam o diagnóstico anterior à implementação. O resultado de M1 e as evidências de teste estão em [EXECUCAO](EXECUCAO.md).

**Estado após M1 isolado e incrementos A–C de M2:** G01–G03 e o aceite comercial de M1 de G04 foram implementados e testados em bancos temporários locais. M2 vinculou títulos, recebimentos diretos/parciais, conciliação, controle de cartão e boleto externo, devolução e crédito nos casos cobertos, conforme [EXECUCAO](EXECUCAO.md). G04 ainda não está encerrado: competência/classificação contábil, configuração do intermediador e homologação operacional permanecem pendentes. A retenção exige validação aplicável. As parcelas comerciais de G05/G07/G08/G09 foram atendidas; as demais parcelas e a validação com cadastros reais permanecem pendentes. Não há liberação de vendas reais.

## Critério de prioridade

- **P0 — integridade do Marco 1:** núcleo comercial indispensável para desenvolver Pedidos; não exige reforma prévia dos módulos. P0 é prioridade técnica, não decisão de negócio ainda aberta.
- **P1 — primeiro uso real:** entrega, recebimentos e integração financeira mínima. Por decisão B02, M1 isolado pode ser validado, mas não lançado como fonte operacional oficial até M2 funcional.
- **P2 — automação completa:** estoque/produção/custo/fiscal. Só bloqueia o lançamento se o negócio exigir esse efeito desde o primeiro pedido.
- **P3 — evolução:** enriquecimentos sem perda dos dados iniciais.

## P0

| ID | Evidência / estado | Lacuna e risco | Correção mínima planejada e aceite |
|---|---|---|---|
| G01 | E01/E03/E05/E16 — AUSENTE | Pedido, itens, preço vendido e escolhas não existem. Cadastro mutável não preserva receita ou quantidade vendida. | Criar núcleo proposto em ARQUITETURA, com FKs, quantidade válida pela unidade, valor preciso, snapshot, total calculado no servidor, versão e evento. Revisão controlada guarda antes/depois sem reescrever versão anterior. Aceite: alterar cadastro depois não altera a venda histórica; revisar pedido preserva as duas versões. |
| G02 | E16 — CONFIRMADO | Exclusão física de produto e substituição dos componentes/preços; futuros itens não podem perder significado ou ser apagados em cascata. | FKs Restrict dos itens ao produto/pedido, impedir exclusão de produto usado e orientar inativação. Snapshot não depende do ID descartável do componente. Aceite: produto usado não pode ser apagado e sua inativação não impede consultar pedido antigo. |
| G03 | E17/E18 — AUSENTE para Pedidos | Falta fronteira autorizada, repetição segura, numeração única, transição serializada e auditoria comercial. Clique/reenvio/concorrência podem duplicar pedido e efeitos. | Capacidades granulares de visualizar, rascunho, confirmar, revisar, desconto, preço manual e cancelar no sistema existente; releitura de sessão/permissão na transação crítica, trava por pedido/versão, chave de operação única com conferência de conteúdo, número único e eventos. Aceite: concorrência/reenvio retorna o mesmo resultado ou conflito, nunca duplica venda; falha desfaz o conjunto. |
| G04 | E08–E12/E15 — PARCIAL | Fontes de receita ainda não ligadas. Importar banco ou emitir nota pode voltar a criar receita de venda já registrada. | Pedido é origem da venda comercial confirmada, sem equivaler automaticamente à receita reconhecida na DRE; títulos financeiros futuros têm origem vinculada, sem somar Pedido + título + banco + nota. M1 identifica integração pendente; M2 cria/vincula cada título uma vez conforme política de competência aprovada. Aceite M1: carteira comercial não se apresenta como DRE; aceite M2: uma venda não gera receita duplicada. |

Não há evidência de incompatibilidade fundamental do Financeiro nem necessidade de refazê-lo. G04 é proteção de integração a ser construída, não duplicação inevitável já observada em vendas reais.

## P1

| ID | Evidência / estado | Lacuna e impacto | Próxima ação / aceite |
|---|---|---|---|
| G05 | E02 — PARCIAL | Cliente tem estrutura básica, mas documento só confere tamanho; endereços sem finalidade/ID e campos opcionais; duplicatas sem documento possíveis. | Snapshot de comprador/destinatário/endereço de entrega; seleção de cliente antes de criação e conferência de duplicados sem fusão automática. Validar documento quando usado fiscalmente e campos exigidos pela entrega. Aceite: PF/PJ e presente/entrega não sobrescrevem cadastro nem histórico; CPF/CNPJ inválido não é tratado como identidade fiscal validada. |
| G06 | E08–E13 — PARCIAL | Sem vínculo Pedido→títulos, condição comercial, sinal/saldo e reembolso. Recorrência repete valor; edição genérica pode alterar título integrado isoladamente. | Extensão aditiva de origem comercial nos lançamentos; N títulos cuja soma fecha com a obrigação; revisão de valor ajusta saldo pendente sem apagar baixa; proteger editar/cancelar/estornar títulos integrados. Aceite: pedido 300 com sinal 90 e saldo 210, revisado para 350, conserva 90 recebidos e saldo 260, conforme condição acordada, sem duplicação. |
| G07 | E04/E05 — CONFIRMADO | Fixture permite base zero ativa com opção paga; cadastro/consulta desativam canal com base zero. Canal é texto no preço. | Incluir no M1 produto de base zero cujo preço final venha de configuração obrigatória válida, cobrindo cadastro→consulta→configuração→confirmação. Reutilizar CanalVenda com ID no pedido e nome fotografado; compatibilizar preço textual. Aceite: vendável sem preço artificial. |
| G08 | E03/E05/E09/E12 — AUSENTE/PARCIAL | Desconto de pedido, frete, rateio e precisão não têm contrato; totais vindos do navegador e categoria incompatível podem contaminar receita/DRE. | M1 calcula desconto e frete separados em decimal/centavos no servidor, preserva preço original/aplicado e autor de exceção, valida inteiros para venda por unidade e fração apenas pela unidade/regra. Regra única de arredondamento e centavo residual; validar produto/opções/canal. M2 valida categoria financeira e soma dos títulos. Aceite: itens/desconto/frete/títulos fecham exatamente. |
| G09 | E10/E11/E16 — AUSENTE para venda | Cancelar venda, corrigir baixa e devolver dinheiro têm efeitos diferentes. Estornar baixa apaga movimento; não serve para reembolso ocorrido. | M1 cancela comercialmente só antes da conclusão/entrega, com motivo/autor/data e histórico. M2 cancela pendentes e representa devolução/retenção/crédito segundo B04 com origem própria, mantendo recebimento real; protege vínculo conciliado. Pedido entregue requer fluxo posterior distinto. Aceite: sinal e eventual devolução aparecem no caixa nas datas reais, sem apagamento. |

G06 e a parte financeira de G09 são condições para **liberar o primeiro uso real**, não para iniciar o desenvolvimento de M1. Até M2, M1 é somente desenvolvimento/validação sem vendas reais oficiais nem selo “pago” presumido.

## P2

| ID | Evidência / estado | Lacuna e impacto | Próxima ação / aceite |
|---|---|---|---|
| G10 | E05–E07 — PARCIAL | Composição, escolhas, preparo e conversões são atuais; não há snapshot operacional de consumo. Cobertura real do catálogo é INCERTA. | Fotografar composição resolvida quando conhecida; ausência explícita. No M3, registrar a versão/revisão operacional usada antes do primeiro consumo. Aceite: composição alterada depois não muda consumo anterior nem preenche custo antigo silenciosamente. |
| G11 | E07 — AUSENTE | Não há reserva, origem de venda, consumo efetivo idempotente ou política de saldo negativo. Quantidade entra no helper como number. | Vínculo mínimo de execução→movimentos com chave única por efeito; trava e política de disponibilidade; preservar decimal até a escrita. Reserva apenas se B05 a exigir. Aceite: repetir/concorrer não baixa duas vezes e unidade/precisão/local estão rastreáveis. |
| G12 | E06/E07 — AUSENTE | Preparação tem custo teórico, mas não produção de lote/consumo/rendimento realizado. Explodir e consumir intermediário pode duplicar baixa. | Adotar modo de consumo explícito por preparação e registro mínimo de produção quando houver estoque intermediário. Aceite: ingredientes saem uma vez na produção e preparação uma vez na venda; modo direto só baixa ingredientes. |
| G13 | E07/E12/E15 — PARCIAL | Saída não guarda custo; posição usa custo atual; compra NF-e já pode alimentar CMV da DRE. CMV vendido seria desconhecido ou duplicado. | Preservar custo estimado no item e custo realizado na execução; manter indicador separado da DRE até decidir B06. Aceite: entrada de custo posterior não reescreve margem passada; teste compra→consumo não duplica despesa. |
| G14 | E14/E15 — PARCIAL/AUSENTE | Emitente incompleto, fiscal cadastral sem validação tributária, documento/conector de saída ausentes. | Decisões externas E01–E03; completar dados e integrar documento separado no M4. Aceite: documento ligado ao Pedido, tentativas seguras, snapshot de emissão e autorização real em ambiente apropriado; HTTP/mock não homologa. |

P2 não transforma composição/fiscal incompleto em venda gratuita, custo zero ou estoque automaticamente consistente. A condição fiscal de operação é decisão externa e pode antecipar parte do M4, sem exigir implementar emissão nesta tarefa.

## P3

| ID | Evidência / estado | Evolução | Condição para adiar sem retrabalho |
|---|---|---|---|
| G15 | E01/E18 — AUSENTE | Site, marketplaces, ingestão de pedidos/eventos, painel de tentativas | Núcleo recebe origem e chave de repetição; preservar IDs e contrato único. Construir conectores somente no M5. |
| G16 | E01/E02 — AUSENTE/PARCIAL | CRM, famílias de produtos, múltiplos contatos sofisticados, campanhas e KPIs avançados | IDs e snapshots históricos suficientes desde M1; consulta básica por cliente/produto/canal já no primeiro marco. |

## Tratamento dos riscos solicitados

| Risco | Situação auditada e destino |
|---|---|
| Cliente duplicado | Documento opcional único; outros atributos não únicos. G05, sem deduplicação automática. |
| Receita duplicada | Fontes financeiras existentes são consistentes com vínculo; origem de venda falta. G04/G06. |
| Estoque duplicado | Não há venda→baixa hoje; helper sem chave comercial e modos de preparação indefinidos. G11/G12. |
| FKs/obrigatoriedade | Preço→canal é texto; identidades/histórico têm IDs polimórficos; não confundir ausência deliberada nesses logs com proteção de Pedido. Novos itens/pedido/títulos precisam FKs reais. G01/G06/G07. |
| Dinheiro/arredondamento | Decimal SQL não elimina parseFloat/number no domínio. G01/G08/G13; manter custo pendente distinto de zero. |
| Exclusão histórica | Produto é apagável; componentes/preços são recriados. G02/G10. |
| Auditoria/permissão | Padrão de cadastro existe, de pedido não; transação cadastral não substitui revalidação crítica. G03. |
| Idempotência | Importação de catálogo/extrato tem mecanismos; criação manual de lançamento não fornece chave comercial. G03/G04/G06. |
| Estados inconsistentes | Sem dimensões de Pedido; não inferir entregue de pago ou autorizado de revisado. G01/G06/G09/G14. |
| Identificadores externos | Identidade de catálogo existe; não é recibo de evento de venda. G15. |

## Ordem de resolução

Para concluir M1: G01–G04 e partes comerciais de G05/G07/G08/G09, conforme decisões B01–B03/B07/B08. Para liberar primeira venda real: M2 com G06 e parte financeira de G09, política B04 e competência contábil apropriada; confirmar também E01 para o caminho fiscal. Antes de prometer estoque/CMV automatizados: G10–G13. Conectores fiscal e de canais: G14/G15 conforme marcos e exigências externas. **Não há decisão P0 de M1 pendente; há implementação P0 pendente.**
