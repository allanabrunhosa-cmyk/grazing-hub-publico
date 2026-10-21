# Autonomia fiscal — contrato da Issue #8

Data de referência: **11/10/2026, Brasília**. Branch de trabalho:
`codex/fiscal-autonomia-tributaria`. Base preservada: implementação fiscal e64ffcac
e documentos de proposta da base 02c497c9. Esta alteração substitui a exigência
geral de aprovação da Confirp por fundamentação verificável e aprovação interna
auditável. Não constitui decisão tributária para produto real, homologação fiscal,
aprovação de manifesto ou autorização de transmissão.

[Política do proprietário](AUTONOMIA-FISCAL.md),
[matriz candidata](MATRIZ-PILOTO-PROPOSTA.md),
[roteiro de homologação](HOMOLOGACAO-CENARIOS.md) e [TASKS](TASKS.md) separam
contrato, proposta de classificação, execução futura e evidências dos testes.

## Fundamentação e aprovação são registros distintos

A proposta mantém os dados fiscais já usados pelo construtor. A fundamentação
explica por que esses dados se aplicam ao emitente, produto e operação. A aprovação
interna registra a revisão humana autorizada da versão concreta; não atribui à
aplicação a competência de confirmar juridicamente uma fonte por seu endereço.

| Parte | Dados e critério |
| --- | --- |
| Contexto | UF, regime documentado e confirmado, operação, origem preparada/revendida/kit/especial e natureza técnica do produto; modelo e alvo permanecem na regra |
| Fontes | Tipo, identificador próprio, título, referência específica, URI opcional, data de consulta, trecho aplicável e limites; mais de uma fonte quando necessário |
| Decisão | Justificativa de aplicação ao caso concreto, limites gerais e data de elaboração |
| Confiança por campo | Campo, estado, fontes vinculadas e justificativa própria; fonte genérica isolada não resolve todos os campos |
| Aprovação | Confirmação explícita de aplicação ao caso, usuário central autorizado, data, versão de origem e hashes; emitente, cadastro, vigência, modelo/operação/alvo vinculados |

Tipos de fonte: `NORMA_OFICIAL`, `ORIENTACAO_SEFAZ`, `SOLUCAO_RECEITA`,
`NCM_CLASSIF`, `XML_HISTORICO` e `PARECER_ESPECIALIZADO`. `SUGESTAO_IA` e
`EXEMPLO_API` identificam material de pesquisa insuficiente para aprovar uma regra.
XML histórico é evidência de prática e também não sustenta sozinho a aprovação.
Parecer especializado pode fundamentar uma decisão se for específico e revisado;
não há fornecedor de parecer obrigatório nem aprovação externa automática.

Campos de confiança: emitente, operação, NCM, CFOP, CEST, ICMS, PIS, COFINS, IPI,
FCP, DIFAL, IBS/CBS, benefício, origem, unidade e ST, conforme o tipo de regra.
Os estados são `COMPROVADO`, `PENDENTE`, `REVISAO_ESPECIALIZADA` e
`NAO_APLICAVEL`. Campo exigido ou declarado aplicável precisa estar comprovado.
Não aplicabilidade exige fonte e justificativa; não é preenchida por padrão.
Uma ambiguidade bloqueia a decisão ou item afetado, sem desativar regras
independentes que já estejam completas, vigentes e aprovadas internamente.

O piloto é de saída **interna em SP**. O contexto de UF não prova abrangência
interestadual. Ao vincular o plano, endereço fiscal do destinatário em UF diferente
do fundamento ou CFOP fora da família interna iniciada por 5 gera pendência pontual
de alcance; não se aplica a regra interna
silenciosamente. Uma operação interestadual exige fundamentação específica, nova
versão e extensão do contrato/testes de alcance quando necessária. Esse recorte
não impede concluir a implementação e os testes independentes da Issue #8.
Essa verificação não escolhe um CFOP nem afirma que qualquer código iniciado por 5
é adequado: os demais campos, modelo e fundamento continuam sendo conferidos.

## Fluxo administrativo e autorização

Acesso em `/vendas/fiscal/regras-brasilnfe`, também pelo vínculo **Decisões
tributárias e revisão interna** na administração Brasil NFe. Visualização exige
`vendas.fiscal/visualizar`; mutações exigem
`vendas.fiscal/editar`, com sessão, usuário, versão e permissões centrais
reconferidos no servidor. Não existe perfil novo para autonomia fiscal.

1. Criar proposta de EMPRESA, OPERACAO ou PRODUTO/GRUPO para o modelo escolhido.
   Informar dados reais quando houver configuração confiável; ausência continua
   pendência. A matriz proposta não é importada nem aplicada automaticamente.
2. Registrar fontes, alcance e confiança por campo. Salvar explicitamente;
   usar **Salvar proposta**; digitação, colagem ou perda de foco não aprovam nem
   alteram cadastro externo.
3. Usar **Enviar para revisão → Confirmar revisão**. Conferir fonte, legislação vigente, regime,
   natureza do produto e condição efetiva da operação.
4. Aprovar internamente somente a versão completa, com confirmação específica da
   aplicabilidade. Pendência ou revisão especializada impede aprovação daquela
   decisão. **Aprovar internamente → Confirmar aprovação interna** mostra o
   histórico, as fontes e os campos, com confirmação inicialmente desmarcada.
   **Bloquear decisão → Confirmar bloqueio** ou **Inativar** preservam o histórico.
5. Selecionar versões aprovadas e vigentes para o documento pelo serviço existente.
   Revalidar cadastro e fotografia. Complemento e plano continuam separados dos
   valores comerciais imutáveis; o resultado local não habilita emissão.

Estados de novas decisões: `PROPOSTA`, `EM_REVISAO`, `APROVADA`, `BLOQUEADA` e
`INATIVA`. `RASCUNHO` permanece na leitura histórica do contrato antigo. Cada
transição acrescenta versão; nenhuma edição reescreve uma aprovação anterior.
O histórico distingue **Rascunho legado** e **Aprovada no contrato legado** das
novas decisões. **Nova revisão** abre proposta explícita, sem reclassificar a
aprovação histórica como ato interno atual.

O comando de aprovação recebe `regraId`, `revisao`, `fundamentacaoHash`,
`conteudoHash` e `aplicacaoConferida:true`. A prova de aprovação é criada no
servidor e inclui o aprovador da sessão, a data e o contexto imutável da revisão.
Hash divergente ou versão concorrente é recusado; a aprovação antiga não é
reutilizada ao salvar uma nova proposta.

## Compatibilidade e integridade

`referenciaConfirp`, versões antigas e seus hashes permanecem preservados. Não
criar fundamento fictício para preencher o contrato novo, copiar a referência
antiga para uma aprovação interna inventada ou reclassificar um responsável
histórico como aprovador atual. A interface identifica o legado e sua origem.
Uma nova decisão requer revisão concreta no contrato vigente.
Versão legada aprovada continua visível no histórico, mas não satisfaz a nova
porta de preparação por si só. Planos anteriores não são apagados ou
reescritos; uso que dependa de aprovação legada exige nova proposta e revisão
interna concreta, em vez de promoção silenciosa à fundamentação nova.

Fundamentação, conteúdo e aprovação têm hashes próprios. Autoria e revisão são
vinculadas à sessão central; o cliente não escolhe o usuário aprovador. O vínculo
ao emitente, revisão e classificação do produto, vigência civil e versão fiscal
continua sendo revalidado antes de utilizar `PlanoFiscalBrasilNfe`. Mudança de
produto, emitente ou regra torna o uso obsoleto indisponível; não altera snapshots
ou planos antigos para fazê-los passar. Grupo não é fallback automático.

A estrutura aditiva de banco permite leitura de versões históricas sem transformar
texto legado em fundamento verificável. SQLs anteriores aplicadas permanecem
intactas. Aplicação e resultados da nova migration em banco sintético são
registrados em TASKS; não há migration produtiva autorizada.

| Caminho | Contrato |
| --- | --- |
| `src/lib/fiscal-saida/brasilnfe/fundamentacao-dominio.ts` | Tipos e validação de fontes, URI, alcance e confiança; aprovação estruturalmente fundamentada |
| `src/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio.ts` | Proposta tipada, conteúdo fiscal, vigência e vínculo ao construtor local |
| `src/lib/fiscal-saida/brasilnfe/regras-tributarias.ts` | Sessão central, trava, versões, aprovação interna, histórico e revalidação de plano |
| `src/app/(protegido)/vendas/fiscal/regras-brasilnfe` | Formulário, revisão por campo, resumo, ações administrativas e identificação do legado |
| `prisma/migrations/20261012100000_brasilnfe_autonomia_tributaria/migration.sql` | Colunas aditivas e CHECKs para distinguir fundamento novo de referência histórica; sem UPDATE das versões antigas |

## Proteção dos dados administrativos

Textos e URIs são tratados como dados. Tipo, quantidade, tamanho, identificadores
de fonte e datas são validados no servidor e nos campos de edição. A URI não é
buscada pelo servidor; a fundamentação não importa nem executa HTML remoto.
Credenciais, identificadores pessoais desnecessários, parâmetros de autenticação,
HTML e entradas maliciosas não integram fundamento, auditoria ou documentação.
Fontes oficiais devem ser específicas e acessíveis, sem copiar respostas, tokens,
certificado, CSC ou dados de clientes para o registro.

Na revisão de XML histórico, conservar somente referência administrativa e
descrição técnica saneada; não anexar o documento real, cliente, chave completa,
endereços ou objetos brutos à fundamentação. Não consultar integração de notas
recebidas ou pedidos reais para construir testes deste incremento.

## Inventário do piloto e definições que faltam

| Recorte | O que pode ser preparado localmente | O que impede aprovação concreta |
| --- | --- | --- |
| F01, preparado no estabelecimento, saída interna SP | Proposta de operação com CFOP candidato da orientação oficial | Processo/ingredientes/apresentação do produto, NCM, tributos e correspondência concreta ainda precisam de evidência; destinatário fiscal fora da UF não herda a regra |
| F02, revenda sem ST e sem elaboração | Proposta distinta da produção própria | Comprovação de revenda, exclusão fundamentada de ST, classificação e demais tributos |
| F03, revenda na condição de substituído | Proposta condicionada, sem herdar regra de F02 | Hipótese legal e condição ST por produto/operação; dúvida material mantém revisão especializada |
| F04, kits/tábuas/cestas | Inventário técnico da composição e apresentação | Regra de itemização e classificação ainda indeterminadas; nome comercial não resolve NCM nem CFOP |
| Eventos, acessórios, interestaduais ou especiais | Proposta própria quando o fato concreto for conhecido | Fora do primeiro piloto; não utilizar a regra interna SP para liberar outro recorte; interestadual requer fonte e contrato de alcance específicos |

As fontes públicas reconferidas estão em
[AUTONOMIA-FISCAL](AUTONOMIA-FISCAL.md#referências-oficiais-conferidas-não-são-autorização-automática-para-todos-os-produtos).
Não foram aprovados NCM, CEST, CSOSN/CST, bases, alíquotas, benefícios ou parâmetros
IBS/CBS para a empresa por esta investigação. O catálogo público serve somente
para escolher o que revisar; não substitui composição e produção efetivas.

Simples Nacional em 2026 e eventual Lucro Presumido em 2027 são contextos
separados, com confirmação documental e vigências próprias. Intenção de migração,
CNAE ou notícia sobre prazos do Simples/IBS/CBS não comprovam regime futuro.
Não ativar regime especial, inferir alíquota de item ou calcular segregação de
receita neste trabalho.

## Quando recorrer a consulta oficial ou especialista

Escalonar conflito entre fontes, classificação NCM ainda insegura após pesquisa
Classif/soluções, itemização de kit não esclarecida, ST/monofásico/benefícios ou
segregação complexa, transição de regime e obrigação formal específica. A dúvida
é registrada por campo e regra, com o que falta demonstrar. Confirp, outro
profissional ou consulta oficial competente são recursos; não existe exigência
genérica de parecer para cada campo já fundamentado e revisado internamente.

Esse critério não dispensa obrigações legais específicas nem transforma aprovação
administrativa em garantia de enquadramento. O caso sem fundamento suficiente
continua bloqueado até uma decisão verificável e uma nova revisão autorizada.

## Próximo passo exato para a primeira homologação

1. O responsável fiscal interno escolhe um item F01 efetivamente preparado e
   conclui a descrição técnica e as fontes específicas, sem inventar NCM ou tributos.
2. Completar emitente e regras EMPRESA, OPERACAO55 e ITEM; registrar proposta,
   revisar e aprovar internamente as versões vigentes. Um responsável autorizado
   vincula as versões ao pedido exclusivamente sintético do cenário55.
3. Montar o manifesto local sem pendências, com identidade, hashes, vigências,
   fundamentos e aprovação registrados. Preservar total e rateios comerciais.
4. Resolver os pré-requisitos técnicos independentes: certificado/data, evidência
   de serviço e ambiente e recuperação segura de resultado incerto. CSC pertence
   à NFC-e65 quando aplicável; sua ausência não impede concluir o manifesto55.
5. Submeter esse manifesto para aprovação específica de **uma NF-e em ambiente2**.
   A implementação desta Issue não concede essa autorização nem registra o
   adaptador operacional. NFC-e65 e cancelamento terão autorizações próprias.

O [roteiro por modelo](HOMOLOGACAO-CENARIOS.md) continua sem execução. Produção,
fila automática, callback e transmissão permanecem bloqueados. Não houve emissão,
cancelamento, consulta de serviços, alteração externa de credenciais/certificado/
CSC/série/numeração, merge, deploy ou mudança nas integrações SEFAZ de recebidas,
Takeat, iFood, estoque e financeiro por esta documentação.

## Critérios verificáveis e evidências

O aceite exige aprovação interna com fonte e responsável; rejeição de fundamento
ausente, fonte insuficiente ou campo pendente; parecer externo opcional; versão
legada identificada sem reescrita; permissão negada no servidor; invalidação por
produto/emitente/vigência; montagem55/65 sintética preservando hashes e valores;
ausência de ativação/transmissão e de efeitos nos demais módulos; campos e URI
protegidos; interface conforme Central de Design. Resultados reais dos testes,
runtime, lint/design, typecheck, build e inspeção visual são registrados em
[TASKS](TASKS.md), distinguindo simulação de qualquer conferência externa anterior.
