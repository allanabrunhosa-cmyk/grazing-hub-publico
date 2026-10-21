# Pedidos e Receita — planejamento

## Detalhes após confirmação — 08/10/2026

Escopo autorizado: simplificar pedidos HUB/iFood confirmados, cancelamento contextual,
parcelamento comercial, ações do Gestor e consulta separada de cancelados. Publicação
final autorizada pelo usuário, condicionada à validação e ao ritual existente.

Pedido abre diretamente pelo olho. Abas Pedido/Histórico; informações somente leitura,
itens/complementos, comprador/destinatário, entrega, pagamento e próxima ação visíveis.
Editar e reagendar usam modais e salvamento explícito conforme as permissões. Quantidades,
ocorrências e destinações existentes permanecem em Atendimento; pendências ficam visíveis.
Gerar NF desabilitado, com “Emissão fiscal ainda não disponível”; nenhuma emissão.

Cancelar exige motivo e identifica o usuário autenticado. A mesma transação cancela o
saldo pendente, solicita devolução do pago elegível ou concede crédito escolhido,
restaura crédito utilizado e preserva pagamentos/auditoria. Retenção exige justificativa,
política e comunicação. Nenhuma devolução fictícia de pedido não pago. Solicitação,
processamento, falha e conclusão com comprovação permanecem distintos; retomar usa o mesmo ID.

Configuração financeira pertence ao cadastro: receita/devoluções no canal; vínculos e
prazo previsto na loja iFood. Recepção externa preservada sem configuração; pendências
são reavaliadas ao salvar o cadastro, sem POST remoto. Eventos oficiais e serviços
existentes permanecem fontes de verdade. Nenhuma alteração de autoaceite, estoque ou flags.

Cancelados saem do Gestor padrão. Botão junto ao filtro abre `/vendas/pedidos/cancelados`,
com data de criação crescente e desempate por número. Histórico não reabre venda.
Cartão apresenta quantidade, valor da parcela e total, identificando ajustes de centavos.
Salvar orçamento usa variante central laranja `atencao`, reutilizando tokens existentes.

Migration aditiva: `20261008010000_pedidos_fluxo_contextual` (categoria de devoluções do
canal e configuração/versionamento financeiro da loja iFood). Sem backfill, reclassificação
ou operação real de teste. Critérios e evidências no [registro único](EXECUCAO.md).

## Regra comercial vigente — 05/10/2026

Produto e complemento têm preço único. Canal identifica a origem, segmenta relatórios e define a categoria de receita dos novos pedidos; não altera preço nem disponibilidade. Atualização do usuário em 05/10/2026: a confirmação de pedidos HUB novos não tem condição financeira; categoria vem do canal (Canais de venda), parcelas do pagamento informado e competência é automática na confirmação. Canal sem categoria bloqueia a confirmação com orientação; trocar a categoria do canal não reclassifica títulos existentes. Revisões preservam a negociação/composição dos itens inalterados e os títulos existentes. [Contrato e migração](../preco-unico/SPEC.md); [registro desta execução](../../execucao-vendas.md). Esta regra substitui as referências históricas a preço/categoria por canal.

## Missão vigente — fechamento operacional e financeiro, 02/10/2026

A instrução desta missão substitui as restrições históricas de lançamento abaixo.
Implementar e validar na interface a cadeia Pedido → Financeiro → Produção →
Expedição → Entrega/Retirada, revisões, cancelamento, pós-venda, devolução e crédito.
Novos pedidos devem usar o financeiro interno, sem exigir adquirente ou emissor;
pedidos existentes, inclusive orçamentos EXTERNO, preservam modo e efeitos.
Estoque automático deve estar completo/testado ON em banco fictício e permanecer
OFF em produção. Preparações estocadas exigem produção física própria, sem dupla
baixa de ingredientes. Plug fiscal de saída separado das notas recebidas, durável,
testável, sem emissor configurado ou emissão real nesta missão.

Reutilizar serviços, relatórios, permissões e Central existentes. Não executar
operações reais para testes, backfill financeiro, retenções presumidas, nem criar
categorias/classificações fictícias. Etiquetas, relatórios novos, canais automáticos
e homologação/emissão fiscal real ficam fora do escopo.

Commits/push na branch e integração/deploy final foram autorizados pelo usuário,
condicionados à aprovação dos critérios técnicos/visuais, isolamento, preservação
histórica e ritual de publicação. Decisões materiais ausentes devem ser respondidas
antes do trabalho dependente. Registro único, fases, evidências e retomada:
[EXECUCAO](EXECUCAO.md#missão-de-fechamento-operacional-e-financeiro--02102026).

Aceite: cumprir fases 0–9 da instrução da missão, incluindo ciclos autenticados com
persistência fictícia, regressões opt-in e revisão integrada final, backup íntegro,
deploy comprovado e smoke sem operações reais. Código/documentação isolados não
comprovam missão concluída; detalhes fiscais externos permanecem explicitamente fora.

**Calendário compacto, atualizado em 02/10/2026:** slots datados exibem número e
cliente na linha 1, horário de entrega e canal na linha 2. O clique abre o cartão completo em Popover oficial,
preservando impressão, resumo, destinatário e ações já autorizadas. O resumo
abre após o fechamento do painel; Quadros, Lista e regras comerciais permanecem.

**Escopo vigente em 26/09/2026:** a feature de operação/produção/agenda substitui os bloqueios globais abaixo para novos pedidos em `EXTERNO`. Confirmação comercial, agenda, produção, comanda A4/80 mm e entrega funcionam sem gerar efeitos financeiros/fiscais; Takeat mantém o processo externo. Pedidos anteriores continuam `HUB`. Contabilidade, adquirentes e integrações automáticas ficam fora deste lançamento. Regras físicas B05 preservadas; pendência cadastral bloqueia somente a execução física afetada. Aceite e publicação da revisão estão em [EXECUCAO](EXECUCAO.md); textos anteriores abaixo são históricos.

**Liberação operacional, 24–25/09/2026:** F1–F7 incorporados ao [registro de execução](EXECUCAO.md), com matriz de aceite e transição/recuperação. B05 aprovado na conversa; locais/saldos e ativação não aprovados. Reserva difere de movimento, consumo é explícito e parcial, revenda sai na expedição e perda do material retirado não provoca outra saída. Revisões preservam o executado. Liberação real exige política contábil, cadastros, integração, E01 e homologação do ambiente; não substituir essas condições por flags preenchidas pelo agente.

**Escopo complementar autorizado em 24/09/2026:** operação delivery com agenda/preparação/expedição/entrega/ocorrências; quantidades e instruções preservadas; composição/custo analítico sem inventar consumo ou CMV; integrações somente com fornecedor/canal efetivamente identificado e sandbox; histórico/consultas separando venda, caixa, repasse, crédito e devolução. Fiscal continua fora da implementação. Avanço e bloqueios estão em [EXECUCAO](EXECUCAO.md).


Situação: auditoria documental e decisões de negócio concluídas em 24/09/2026. A implementação isolada de M1 está registrada em [EXECUCAO](EXECUCAO.md); este documento preserva o escopo da auditoria original e não autoriza uso real. O primeiro uso depende de M2 funcional e da confirmação do caminho fiscal externo.

## Objetivo e limites

Determinar a prontidão do checkout para pedidos de venda e definir o menor caminho até receita, recebimentos, estoque, CMV e fiscal confiáveis. Não implementar Pedidos, alterar código/schema, executar migrations, operar dados reais ou publicar.

Esta área segue a convenção de [features](../README.md). Não havia planejamento operacional equivalente: a [análise de Vendas](../../analise-vendas-takeat-ifood-2026-09-22.md) e a [execução de Vendas](../../execucao-vendas.md) tratam da fundação comercial. Esta última continua sendo o registro de execução do domínio; não foi criado TASKS paralelo nem alterado seu conteúdo local em andamento.

## Leitura e retomada

| Documento | Responsabilidade |
|---|---|
| [AUDITORIA](AUDITORIA.md) | Estado encontrado, evidências, matriz, cenários A–G e limites da verificação |
| [GAPS](GAPS.md) | Problemas e lacunas com prioridade, condição de bloqueio e aceite |
| [ARQUITETURA](ARQUITETURA.md) | Proposta mínima, fontes de verdade, snapshots, estados e efeitos |
| [ROADMAP](ROADMAP.md) | Cinco marcos, dependências, reutilização, testes e conclusão objetiva |
| [DECISOES_PENDENTES](DECISOES_PENDENTES.md) | Decisões de M1 fechadas e pendências de M2/marcos posteriores ou externas |

Mapas vigentes: [Vendas](../../modulos/vendas.md), [Financeiro](../../modulos/financeiro.md), [Estoque](../../modulos/estoque.md), [Insumos](../../modulos/insumos.md), [Fiscal](../../modulos/fiscal.md), [Acesso](../../contexto/autenticacao-permissoes.md).

## Critério de aceite desta tarefa

Cobrir a cadeia comercial e suas interfaces, separar capacidade de vender de estoque/CMV/fiscal, registrar evidências do código, simular A–G conceitualmente e entregar os cinco documentos sem mudanças funcionais. Não declarar dados produtivos completos, testes funcionais aprovados ou homologação externa com base em inspeção estática.

Próximo passo proposto: em tarefa própria, implementar e validar M1 segundo os contratos P0 e a interface comercial do [roadmap](ROADMAP.md); depois integrar M2 antes de liberar pedidos reais. As decisões de M1 estão em [DECISOES_PENDENTES](DECISOES_PENDENTES.md); políticas B04, competência contábil e caminho fiscal E01 continuam como gates posteriores para o primeiro uso real.


### Gestor de pedidos — ajuste de 27/09/2026

Decisões do usuário: dois quadros com quatro colunas cada. Primeiro: hoje e próximos três dias, por data de entrega; segundo: Em preparo, Pronto, Em rota e Entregue. Preparo com até dois dias de antecedência; Em preparo/Pronto agrupados por entrega. Cartões mostram comprador, pedidos anteriores, endereço, destinatário diferente e impressão; clique abre resumo. Calendário semanal/mensal preservado. Orçamentos podem ser declinados. Estornado é declaração manual autorizada da devolução externa, com motivo/referência e histórico, fora da fila ativa; não executa transferência nem altera o Financeiro legado. Integração bancária futura.

Horários de funcionamento: grade de 60 minutos (padrão) ou 30 minutos e períodos por dia da semana, salvos explicitamente. Sem configuração não se presume horário comercial; a seleção oferece a grade diária. Configuração salva restringe novas agendas; dias sem períodos ficam fechados. Agendas históricas inalteradas são preservadas. Área de entrega permanece vazia, sem geometria/regras presumidas. Remover Visão geral, nomear Gestor de pedidos e manter Grupos fiscais por último.

### Novo Pedido — organização do formulário, 30/09/2026

Cliente, Cobrança, Entrega e Pedido são as quatro seções do mesmo popup. Campos do
cliente ficam visíveis desde a abertura; seleção preenche cadastro/cobrança com
indicação discreta. Cadastro novo é salvo junto do orçamento/pedido, atomicamente,
com a permissão existente; dados de cliente selecionado são de consulta, e alteração
do cadastro continua em Clientes. Cobrança e entrega conservam snapshots por pedido.
No Brasil, Logradouro/Bairro/Cidade/UF são somente leitura e preenchidos por CEP;
número/complemento são manuais. Fora do Brasil, o endereço é manual obrigatório,
conforme resposta do usuário. Falha na consulta exige corrigir/tentar novamente.

Não há botão de criar cliente; limpar a busca apaga o cadastro e os endereços
preenchidos. Proteção
de saída fica inline no mesmo popup. Origem externa, estabelecimento externo, código
externo e Prazo não são controles visíveis; referências históricas
permanecem preservadas. Modo substitui Atendimento, com Entrega (padrão) e Retirada.
Retirada oculta País até UF, não exige endereço de entrega e o envia nulo ao salvar,
preservando a cobrança. Copiar endereço de cobrança altera somente esse endereço,
com feedback discreto; não há seleção de endereço cadastrado nesse fluxo.
Nome/Sobrenome/Telefone são os rótulos do destinatário. A data de entrega determina
AGENDADO quando preenchida e IMEDIATO quando ausente. Horários configurados e
validações existentes são preservados. Grades responsivas dimensionam identificação,
telefone, CEP, número e UF de acordo com o conteúdo, mantendo altura/alinhamento
dos componentes oficiais. Qtd. usa unidade fixa dentro do InputComSufixo.
Clique externo, X e Escape fecham sem edição ou pedem descarte no próprio painel;
o Dialog compartilhado aplica a mesma proteção aos consumidores comuns.
Cupom permanece indisponível. Sem nova migration.

### Gestor — formulário comercial compacto, 01/10/2026

O Gestor deve abrir com pedidos de todas as situações, incluindo orçamentos e
confirmados. Orçamentos aparecem em seção destacada acima das quatro etapas dos
Quadros e usam a cor semântica de atenção (laranja) também no Calendário e na
Lista, sempre com o rótulo **Em orçamento**. Não recebem ações de produção antes
de confirmar. Filtros explícitos de situação são visíveis e removíveis; não há
corte implícito de entregues por idade. Paginação, busca e período do calendário
continuam delimitando o conjunto exibido.

Títulos externos às superfícies: Dados Cadastrais, Cobrança, Entrega e Pedido.
Busca Cliente com limpar; campos cadastrais selecionados são de consulta. País
usa lista pesquisável ISO 3166-1, preservando nomes históricos. CPF/CNPJ aceitam
apenas dígitos e os comprimentos existentes; e-mail opcional exige formato válido.
Cliente novo exige a permissão de cadastro no servidor e é salvo na mesma transação
do orçamento, com auditoria e idempotência. Não há cadastro separado no popup.

Canal por botões: Site azul, iFood vermelho e Giuliana Flores roxo, exibido GF,
conforme decisão do usuário. ID/nome cadastrado e canais adicionais são preservados.
Adicionar produto fica depois da última linha; preço compacto fica somente leitura
até a tag de desconto, respeitando a permissão de preço manual existente.
Salvar orçamento/Confirmar pedido mantêm as operações e estados existentes.

Forma de pagamento usa cadastros ativos permitidos de Vendas. Cartão de crédito
respeita limite configurado até quatro parcelas; débito/Pix, uma. Boleto respeita
parcelamento cadastrado e vencimento explícito por parcela, obrigatório ao confirmar.
Não derivar vencimentos da entrega, simular atualização de emissor ou gerar cobrança.
Snapshot comercial guarda ID, nome, tipo, versão, parcelas e vencimentos; revisão
inalterada mantém condições históricas mesmo após inativação/renomeação. Alteração
da condição exige cadastro ativo atual. Registros antigos sem snapshot permanecem
compatíveis, sem atribuição fictícia de fornecedor ou forma. Modo HUB e seus títulos
financeiros continuam com contrato próprio; estes campos não geram movimentos.

## Cadastro e cobrança sincronizados (01/10/2026)

Contrato vigente e permanente em [Vendas](../../modulos/vendas.md#contrato-permanente-de-clientes-e-pedidos): cadastro compartilhado com Clientes, múltiplas cobranças em abas, endereço selecionado preservado na gravação/confirmação, dados padrão de entrega sem data/horário/modo no cadastro e confirmação condicionada a pagamento explícito. Orçamento permanece permitido sem pagamento. Snapshots históricos e limites do financeiro externo permanecem preservados.


## Emissão direta no pedido — 21/10/2026

O campo **Modelo da nota** oferece NFC-e (65), padrão, e NF-e (55). O botão
**Emitir** deve preparar, validar e solicitar uma única autorização em produção,
sem abrir outro painel, prévia, checkbox ou confirmação de emissão. A action recebe
apenas pedido, revisão, modelo e contexto operacional explícito. O servidor relê
os dados, fixa o ambiente produtivo e conserva as guardas de acesso, hashes,
numeração, configuração, versões fiscais ativas e duplicidade entre modelos.
O clique não aprova rascunhos de classificação ou regras globais.

O cartão Fiscal conserva os estados de processamento, sucesso, rejeição e
resultado incerto. Sucesso depende de AUTORIZADO, não apenas do retorno da action.
PDF/XML e cancelamento usam os documentos já vinculados. Cancelamento continua
com justificativa e confirmação próprias. Erros identificam motivo, produto/campo
quando disponível e um atalho permitido para correção. Não expor XML, credenciais,
resposta livre externa ou dados de outros pedidos nas mensagens.

Falta de contexto fiscal deve ser corrigível no próprio cartão quando aplicável:
presença efetiva do comprador e declaração explícita de cartão não integrado.
Não presumir venda presencial, quitação, adquirente ou autorização. Cartão NFC-e
não integrado está restrito ao contrato validado para SP, com TipoIntegracao=false;
a decisão fica no snapshot. NF-e conserva seu contrato de pagamento existente.

Perda da resposta exige consulta por pedido antes de qualquer tentativa nova.
Resultado incerto, processamento, autorização, denegação ou identidade incompatível
impedem nova transmissão. Rejeição certa sem chave/protocolo/cancelamento pendente
pode produzir outra revisão imutável, após revalidação do servidor e sem apagar
a rejeição anterior. Os cadastros precisam conter GTIN ou declaração SEM GTIN,
classificação, regra e demais dados efetivamente exigidos. Não converter ausência
em aprovação nem ampliar declarações FCI de modelo 55 para 65 automaticamente.
