# Fiscal

Representação fiscal: `FiscalProdutoUnificado` oferece produto preparado, mercadoria e kit explícito.
`salvarFiscalSimples` grava a escolha e os componentes comerciais na estrutura versionada.
A auditoria não classifica um produto como kit pelo nome nem importa sua receita como linhas.
Correções prospectivas preservam documentos e fotografias anteriores. Ver [representação](../features/fiscal-unificado/REPRESENTACAO.md).

## Manutenção unificada — 21/10/2026

A entrada administrativa é `/financeiro/fiscal/configuracoes`. Ela reúne os serviços
existentes de empresa, emissor, certificado, CSC, habilitação e numeração. Cada bloco
preserva sua permissão. Credenciais permanecem mascaradas. A leitura não consulta
o emissor externo nem altera o estado operacional.

Produtos → Fiscal e `/financeiro/fiscal/vinculos` usam a mesma ficha versionada.
Rascunho, revisão de impacto, aplicação e histórico ficam nessa ficha. O botão Salvar
comercial não grava parâmetros fiscais. `VersaoEstruturaFiscal` continua sendo a
fonte do motor; não há tabela nova ou sincronização de JSON comercial.

`tributacao/ficha.ts` seleciona a regra tanto na interface quanto na montagem fiscal.
Grupo cadastrado e modelo são alcances opcionais. A exceção individual prevalece.
Empates continuam bloqueados. Valores e grupos antigos permanecem disponíveis para
comparação; a conciliação exige decisão explícita, sem conversão tributária automática.
Grupos referenciados por versões não podem ser excluídos.

As rotas antigas de empresa, cobertura, numeração e regras redirecionam para as
entradas visíveis. Regras, tabelas, complementos e referências internas podem ser
mantidos e aplicados nas telas novas. Diagnóstico e histórico dos pilotos anteriores
ficam em detalhes de consulta. O restante deste guia registra também marcos anteriores.

Contrato, simulação privada, reversão e evidências:
[Fiscal unificado](../features/fiscal-unificado/README.md).

## Declaração SEM GTIN e preparações nacionais — 21/10/2026

O responsável confirmou ausência de GTIN nos produtos vendidos e ingredientes
exclusivamente nacionais nas preparações próprias. A correção usa novas versões
auditadas pelo serviço existente. A classificação nacional da Grazing para 1
substitui prospectivamente a decisão FCI anterior, que permanece no histórico.
O motor mantém as validações 55/65 por operação e os dados explícitos de cada
componente. Fluxo, provas e pendências:
[contrato fiscal](../features/estrutura-fiscal/BRASIL_NFE.md#sem-gtin-e-preparações-nacionais--21102026)
e [operação](../features/estrutura-fiscal/OPERACAO-SEM-GTIN-20261021.md).

## Emissão no pedido e cancelamento individual — 20/10/2026

Incremento na branch `codex/dashboard-emissao-pedidos-20261020`, ainda sem
publicação ou operação fiscal externa. O pedido usa NFC-e65 como opção inicial e
permite NF-e55. A preparação de novos documentos declara consumo final no
servidor. A finalidade técnica continua normal (`Finalidade: 1`). Fotografias
anteriores conservam sua finalidade e seu indicador.

Sem IE, o fluxo de consumo final mantém o indicador9 (não contribuinte).
Ausência de IE não comprova isenção de inscrição (indicador2). IE preenchida
mantém as validações de contribuinte; a NFC-e pode exigir troca para NF-e.
O detalhe e as fontes estão no [contrato fiscal](../features/estrutura-fiscal/BRASIL_NFE.md#pedido-e-cancelamento-manual--20102026).

`brasilnfe/cancelamento.ts` adiciona a ação individual com confirmação,
justificativa, permissões revalidadas e auditoria. O contexto autoriza somente
CANCELAR para a chave, protocolo, modelo e ambiente confirmados. A fila automática
continua sem emissor. Não há migration nem alteração de certificado/CSC.

A recusa de prazo preserva AUTORIZADO e informa o código501. Resultado incerto
preserva AUTORIZADO com `cancelamentoPendente=true`. Os arquivos e os valores
autorizados permanecem disponíveis até o XML do evento comprovar CANCELADO.
`cancelamentoSolicitado` deriva da auditoria e bloqueia repetição após recarregar.
Sem protocolo recuperável, é necessária conferência externa. O cancelamento não
altera pedido, recebimento, estoque ou notas recebidas.

Testes: `brasilnfe-cancelamento-dominio`, `brasilnfe-transmissao-contextual`,
`brasilnfe-operacoes`, `brasilnfe-revisao-emissao-integracao` e
`testes/vendas/fiscal-saida-integracao`. Integrações usam banco local e HTTP
sintéticos; não comprovam aceite real da SEFAZ.

## Contexto anterior

Mapa atualizado em 16/10/2026 na branch fiscal de trabalho. Base publicada e suas
quantidades continuam registradas nos documentos de implantação. NF-e de produtos
e NFS-e de serviços têm fronteiras externas explícitas.

Incremento reconciliado: `brasilnfe/operacional.ts` resolve envio manual por sessão,
documento e ambiente habilitado. `provedor.ts` sem contexto continua null. A fila,
identidade, locks, revisões e eventos são únicos. PERFIL central em
`/financeiro/fiscal/empresa` define CRT explícito com vigência e ativação auditada;
a Visão Geral somente projeta esse cadastro. A central de classificações/regras é
`/financeiro/fiscal/cobertura`; propostas M1 antigas servem ao histórico dos pilotos.
O botão Emitir nota fiscal pertence ao pedido confirmado. Produção exige prova de
homologação por modelo e aprovação específica; flags antigas não liberam esse fluxo.
[Contrato atual](../features/estrutura-fiscal/BRASIL_NFE.md) e
[validação desta entrega](../features/fiscal-brasilnfe-m1/OPERACAO-20261014.md).

Os trechos de marcos anteriores abaixo descrevem seus limites na respectiva data.

Em 16/10, `brasilnfe/bloqueio-transmissao.ts` passa a usar escopo manual por
documento e hashes. `operacional.ts` registra a autorização e relê suspensão,
permissões, configuração e revisão sob trava antes do único POST. Sem contexto,
o adaptador automático permanece ausente; callback e cancelamento seguem fechados.
A declaração específica de origem/FCI da Grazing para 1 é distinta da apuração e
da aprovação dos demais parâmetros. Contrato vigente no início de
[CONTRATOS](../features/fiscal-brasilnfe-m1/CONTRATOS.md).
A prévia prepara uma fotografia fiscal local por contexto, sem transmissão ou
efeito comercial. Retirada não comprova presença: o canal exige escolha explícita,
exceto indicador 4 da entrega NFC-e. Pendência CSC não altera esse campo.

## Rotas e componentes

Base: `src/app/(protegido)`. Nomes relativos abaixo pertencem a essa base.

- /notas-fiscais → notas-fiscais/page.tsx, nota-fiscal-dialog.tsx, actions.ts, aceitar-nota.ts
- /financeiro/manifesto-nfs → financeiro/manifesto-nfs
- /financeiro/fiscal → financeiro/fiscal/page.tsx e painel-fiscal.tsx; agregação
  autorizada em `src/lib/fiscal-dashboard`, sem consulta externa ou escrita fiscal.
- /financeiro/fiscal/grupos e /financeiro/fiscal/vinculos → cadastros existentes,
  guardas históricas `vendas.fiscal`. Rotas antigas de Vendas redirecionam.
- Endpoints estáveis: src/app/api/notas-fiscais e src/app/api/nfse

## Serviços

- src/lib/sefaz: sincronizar.ts, distribuicao.ts, evento.ts, manifestar.ts, soap.ts, custosNFe.ts, certificado.ts
- src/lib/nfse: parse.ts, dps.ts, municipal-sp.ts, agenda.ts, busca-agendada.ts
- scripts/buscar-notas.ts e infra/grazing-buscar-notas.timer: agenda de ambas

## Banco de dados

NotaFiscalRecebida → itens/duplicatas/vínculos; ManifestacaoNFe; InsumoCodigoFornecedor; SefazDistribuicaoEstado/LoteRecebido/DocumentoRecebido/Lacuna. NotaFiscalServico → EventoNfse e vínculos; NfseDistribuicaoEstado.

## Regras importantes

- Certificado no banco tem prioridade; env/mount são fallback, nunca reaplicação cega.
- NF-e: validação integral antes do aceite. Sucesso fiscal e gravação local são etapas distintas; não reenviar cegamente resposta incerta.
- SOAP de eventos document/literal bare; 573 não vira protocolo inventado. Mock/HTTP 200 não é aceite real.
- Preservar cooldown/quota por CNPJ, diário e trava. nsuConsulta é retomada externa, ultNSU é cobertura local: não igualar manualmente em 656.
- Timer a cada cinco minutos; descoberta diária às 03h15 Brasília/retomadas segundo agenda. NFS-e tem agenda própria.
- 404 NFS-e só é ausência com contrato JSON de ausência, lote vazio e sem erros; HTML/403/timeout não viram sucesso.
- DPS nacional não é RPS municipal; fallback SP só nas condições validadas. Não fabricar XML nacional nem ignorar identidade/tomador.
- Aceite/recusa NFS-e é interno, diferente do evento externo NF-e.
- Custo NF-e fecha com vNF. Tributos embutidos não são somados de novo; vICMSDeson só deduz com indDeduzDeson=1. Rateio em centavos.
- Destino ESTOQUE gera movimento, USO_E_CONSUMO só despesa; entrada tem data explícita e vínculos idempotentes.
- Recorte NFS-e desde 10/09/2026 admite exceção manual; não reabrir todo histórico em lote.

## Integrações e cuidados

Corretores são operações assistidas, não deploy/teste. Não repetir aceite, consulta real, importação ou correção de produção para demonstrar funcionamento. Evidências históricas não comprovam situação externa atual.

## Testes relevantes

testes/sefaz, testes/notas-fiscais e testes/nfse por fluxo. Custo/conciliação requer Financeiro/Estoque. Opt-ins no arquivo; --verificar da agenda não consulta serviços fiscais.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Saída fiscal de produtos e pedidos

### Classificação fundamentada e carga pelo serviço

O registro de provedores em `provedor.ts` retorna null no Marco 1 Brasil NFe. Portanto,
produção mostra **Emissor não configurado** e não enfileira envios. Simulador existe
apenas em `testes/vendas/fiscal-saida-integracao.test.ts`. Não ativar flags fictícias.

Brasil NFe contratado: configuração administrativa em
`/configuracoes/integracoes/brasilnfe`, com permissão central
`configuracoes.brasilnfe`. `src/lib/fiscal-saida/brasilnfe` guarda Token/UserToken
cifrados pelo mecanismo existente com contextos separados, reutiliza o emitente de
`ConfiguracaoLoja` e retorna somente presença das credenciais. Validar conexão usa
apenas BuscarEmpresa/ConsultarServicos; sem UserToken ambas ficam indisponíveis.
Configuração salva/acesso autenticado não comprovam homologação. Produção,
transmissão, callback e registro operacional seguem bloqueados no servidor.
Consulta técnica considera Nota+Historico, delimita identidade/emitente/ambiente/modelo
e nunca libera reenvio: IdentificadorInterno não comprova idempotência externa.
Planos55/65 mantêm snapshot/Decimal e pendências tributárias; nenhum tributo é inferido.
Contratos, migration aditiva, testes e pendências: [Marco1](../features/fiscal-brasilnfe-m1/SPEC.md).

GTIN da unidade final é decisão explícita, não código herdado do insumo/grupo.
`brasilnfe/gtin.ts` valida texto, comprimento, dígito de controle e rejeita todos
zeros sem converter ausência em SEM GTIN. Novas aprovações de item/grupo exigem
essa decisão; parser/hashes das versões históricas permanecem preservados e a
montagem55/65 bloqueia dado ausente/inválido por item. Checkdigit não comprova
atribuição à unidade; constatação faz parte da fundamentaçãoUNIDADE e aprovação
humana. Pesquisa do acabado e limites: [Piloto55](../features/fiscal-brasilnfe-m1/PILOTO-55-CLASSIFICACAO.md).

Preparação local55/65: `brasilnfe/payload-local.ts` monta venda normal com parâmetros
fiscais explícitos, preserva desconto fotografado e rateia frete/outros custos uma vez.
`brasilnfe/preparacao-local.ts` exige sessão central e `vendas.fiscal/editar`; somente
leitura, sem emissor/fila operacional. Resultado completo continua com transmissão
bloqueada. Precisão, recorte, lacunas e roteiro: [Marco2 local](../features/fiscal-brasilnfe-m1/MARCO-2-PREPARACAO.md).

Continuação técnica: decisões por empresa/operação/produto/grupo em
`/vendas/fiscal/regras-brasilnfe`, com proposta/revisão/aprovação interna/bloqueio
explícitos, vigência civil, autor e versões imutáveis. A fundamentação registra
fontes identificadas, contexto e confiança por campo; XML histórico, IA e exemplo
de API não bastam para aprovar. A aprovação exige `vendas.fiscal/editar`, confirmação
humana, hashes do conteúdo/fundamento/emitente/cadastro e responsável identificado.
Mudança no cadastro ou alcance invalida a aplicação da prova. Referências Confirp
e aprovações antigas são conservadas como legado, sem conversão ou liberação
silenciosa; novas versões não dependem de parecer obrigatório da Confirp.
Pendências bloqueiam a decisão do produto/operação selecionado. Contrato vigente:
[Autonomia fiscal](../features/fiscal-brasilnfe-m1/AUTONOMIA-FISCAL.md).
`PlanoFiscalBrasilNfe`
congela complemento fiscal e versões por documento; não reescreve o snapshot nem
cria fila/financeiro/estoque. A leitura revalida emitente, revisão, vigência e forma
de pagamento ativa. `porta-tecnica.ts` liga esse plano às provas da fila, mas nega
transmissão. `adaptador.ts` implementa os ciclos por contrato de endpoint, com
ordem local durável de observação e protocolos separados; resultado incerto exige
consulta/conferência, sem reenvio. Registro operacional e callback seguem ausentes.
XML, PDF, HTML65 sanitizado e XML de cancelamento têm formatos/rotas protegidos
distintos. HTML do fornecedor exige conferência real do subconjunto aceito.

Na administração, **Conferir certificado e CSC** lê somente BuscarEmpresa e
VerificarCertificado interno, com credenciais existentes no servidor e intervalo
de30s. Guarda somente presença de campos, identidade correspondente, datas/HTTP e
metadados locais de falha. Evidência do painel tem origem/data separadas; status1
de ConsultarServicos não é sucesso. Expiração tem acompanhamento local em Brasília,
sem consulta automática. Código, pendências e roteiro vigente:
[Marco2 técnico](../features/fiscal-brasilnfe-m1/MARCO-2-IMPLEMENTACAO.md).

Para conectar um fornecedor em outra entrega:
`ClassificacaoFiscal` admite aplicabilidade APLICAVEL/NAO_APLICAVEL e `analiseNcm`
com fundamento documental/pesquisa, confiança, descrição, data, justificativa, fontes
e `pendenciasNcm`. Conclusão do NCM é separada da aptidão da operação: origem,
GTIN, regime e regras pendentes continuam impedindo emissão. BAIXA admite NCM nulo;
N/A em configuração exige vínculos exclusivamente integrados e ausência de venda principal.

Ativar a versão vigente sincroniza somente grupo, NCM concluído e rastreabilidade no
cadastro pela mesma transação, com histórico FISCAL/atividade. Versão futura não altera
o cadastro atual. NCM antigo de configuração N/A permanece como identidade documentada.
Atualizações usam patch JSONB e fotografias SQL em texto para preservar chaves desconhecidas
e números exatos; edição comercial não substitui a metadata gerada pelo servidor.

`configuracaoNcm` define seletores exatos de opções e, opcionalmente, quantidades exatas.
Equivalências documentadas abrangem opções explícitas por grupo e limites de contagem,
sem enumerar todas as combinações nem calcular classificação por peso. O servidor sela
composição/unidade/quantidades; a prévia compara receita analisada, pedido fechado e cadastro
atual. Mudança de ingrediente bloqueia o ramo afetado. Nome, preço e foto não alteram
a identidade física. `modoFiscal=UNIDADES_SEPARADAS` exige prova de mercadoria individual
por opção e discrimina quantidade/valor fotografados; base não discriminada exige revisão.
APRESENTACAO integra valor, versão e justificativa ao principal, mas não é ingrediente alimentar
no seletor NCM. Embalagem vendida como mercadoria independente mantém classificação própria.

`receita-material.ts` sela também a composição transitiva das preparações, com ingredientes,
quantidades exatas, unidades, rendimento, modo de preparo e identidade material (marca/GTIN).
Normal e referência interna têm fotografia técnica própria gerada ao salvar; cenários mantêm
o selo por ramo. Pedidos novos guardam hashes materiais no snapshot fechado. Receita histórica
sem essa prova não é atualizada automaticamente para parecer confirmada. Ciclo, profundidade
excessiva ou identidade divergente impedem somente a prévia fiscal afetada. Preço, nome, foto,
custos e auditoria do insumo não entram no selo. O hash do lote inclui ComposicaoInsumo;
manutenção/propagação do grupo fiscal preserva também JSONB exato do grupo e seus cadastros.

A sincronização da classificação mantém as observações anteriores integralmente. Quando a
última nota automática já contém exatamente a mesma fundamentação, uma revisão de pendências
não repete esse texto: atualiza a referência da versão e registra novo histórico/eventos.
Fundamentação diferente continua gerando nota nova sujeita ao limite de 2000 caracteres;
excesso reverte a ativação inteira, sem truncar notas. Regressão no banco fictício local:
`testes/tributacao/ncm-aplicabilidade-integracao.test.ts`.

`baseSemIngredientesComprovada` somente declara ausência de ingredientes fixos fundamentada
na classificação configurada. Pedidos novos registram quais escolhas possuem composição física
comprovada; essa prova fiscal é separada de `estadoComposicao` do estoque, que permanece intacto.
Principal com composição fixa não admite a declaração. Uma base omitida não é presumida vazia,
e snapshots antigos sem prova própria não recebem confirmação retroativa. A prévia fotografa
somente os ramos escolhidos; salvar/ativar continua verificando todos os ramos abrangidos.

`receitaFiscalDocumentada` admite ficha de preparação própria externa ao cadastro de estoque:
ingredientes finais fixos e por uma escolha, identificados por insumo/unidade/quantidade, com
fontes e justificativa. Quantidade física admite nove casas exatas; quantidade comercial, kit e
limites do provedor mantêm suas precisões próprias. Não altera receitas, consumo ou preços/status.
Unidade/porção final podem diferir do estoque quando documentadas; o motor não inventa conversão.
O servidor sela a receita documentada, a identidade física do cadastro de origem e os materiais
transitivos. Pedido novo guarda fotografia fiscal própria da ficha vigente, por unidade fiscal;
contagem escolhida e quantidade do pedido são aplicadas uma vez. Pedido antigo sem essa prova ou
ramo cuja fórmula/cadastro mudou exige conferência localizada, sem reconstrução pela ficha atual.

KIT_COMPOSTO admite mercadorias comerciais configuradas e referência interna `INSUMO:<id>`
de insumo/preparação existente, com classificação própria, descrição, unidade, quantidade,
conversão documentada e peso de rateio. Não cria SKU nem estoque. Descrição versionada do
componente entra no documento, e o rateio conserva o total comercial. Referência interna
inativa, unidade alterada ou fórmula não comprovada bloqueia somente a operação afetada.

`fotografia-kit.ts` mantém política de componentes, quantidades, escolhas e pesos de rateio no
snapshot do pedido novo. A prévia exige política compatível e usa receitas fotografadas originais,
preservando o desempate de centavos do pedido. Alteração prospectiva do conteúdo/rateio bloqueia
o pedido afetado; ausência de prova histórica não é preenchida pela classificação atual. A versão
original é proveniência, não regra vigente aplicada ao cálculo. Kits aninhados sem contrato próprio
permanecem pendentes. Fotografias privadas de KIT/ficha fiscal são removidas do DTO comercial de
`obterPedido`, inclusive em históricos; a manutenção fiscal autorizada continua na sua camada.
Rollback dessas configurações usa nova versão fundamentada e prospectiva; não editar snapshots.
NCM base conclusivo invariável em todos os ramos/equivalências preenche `fiscal.ncm` do cadastro
real na ativação atual; seletores e fotografias permanecem obrigatórios. Cenários com NCMs
diferentes, prova baixa ou ausência de conclusão não recebem um código único artificial.
Regressão: `fotografia-kit.test.ts`, `ncm-configuracao.test.ts` e
`ncm-aplicabilidade-integracao.test.ts` (PostgreSQL local fictício, opt-in).

`src/lib/tributacao/lote-classificacao.ts` usa as variantes `salvarVersaoFiscalNaTransacao`,
`analisarImpactoFiscalNaTransacao` e `ativarVersaoFiscalNaTransacao`; os wrappers da interface
continuam funcionando. O lote autentica administrador/sessão reais dentro da transação,
adquire travas de acesso/estrutura/cadastro e confere hash exato do catálogo/versões/tabela.
Prévia executa todas as validações e reverte a transação integral; aplicação grava versões,
sincronização, auditoria e recibo conjuntamente. Reexecução exige mesma autoria/conteúdo
e estado posterior exato; divergência exige nova revisão prospectiva, sem apagar histórico.

`scripts/estrutura-fiscal-classificacao-catalogo.ts` aceita entrada privada
`{loteId,vigenciaInicio,registros:[{tipo,chave,versaoBase,dados,justificativa,fontes}]}`.
Admite CLASSIFICACAO/COMPLEMENTO/TABELA NCM, sem alterar perfil/regras, e confere todos
os códigos no arquivo integral oficial vigente. Preserva NCM anteriormente confirmado;
mudança individual desse código exige revisão própria. Flags: `--entrada=`, `--tabela-ncm=`,
`--usuario-id=`, `--saida=`; `--dry-run` é padrão. `--apply` exige `--hash-plano=`,
`--backup-comprovante=` e `CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA=SIM`.
Planos/recibos usam comparação JSON canônica: ordem de chaves retornada pelo JSONB não provoca
falso conflito de replay; conteúdo e ordem de componentes permanecem conferidos. Teste SQL
positivo executa o CLI completo com CLASSIF/CMV/COMPLEMENTO/INSUMO/KIT/TABELA, dry-run revertido,
aplicação atômica e repetição sem novas versões/efeitos, exclusivamente no banco local fictício.
Executar com Node e condições `react-server`/carregador `tsx`, conexão explícita e sem
imprimir credenciais. Arquivos permanecem em `.tmp/fiscal`, protegidos e fora do Git.

O comprovante de backup exige verificação/autorização, SHA-256 e criação há até24h;
o operador confere o dump real e a identidade cluster/database/schema do alvo antes da CLI.
Plano é gravado antes da aplicação; falha posterior do arquivo de recibo informa aplicação
confirmada na auditoria, sem sugerir reenvio. Rollback usa nova versão prospectiva/alteração
auditada; não restaura dump sobre vendas novas, exclui versões ou reescreve documentos.
Nenhuma dessas operações transmite documento ou habilita autoemissão.

Testes de domínio: `testes/tributacao/ncm-aplicabilidade*`, `ncm-configuracao`,
`referencia-interna*` e `classificacao-catalogo-cli`; integrações SQL usam somente
`teste_estrutura_fiscal` local e schemas efêmeros. O caso comercial de alias inativo
permite somente COMPOSICAO com composição própria explícita; mercadoria avulsa e herança
de produto inativo continuam bloqueadas (`testes/vendas/pedidos-integracao.test.ts`).

`src/lib/tributacao/{tipos,validacao,motor,gtin,servico,pedidos,catalogo,heranca}.ts`
resolve classificações, grupos GF01–GF12, contexto/vigência, códigos, GTIN, Decimal,
complementos e kits no servidor. `VersaoEstruturaFiscal` e eventos guardam conteúdo/hash,
fontes, autoria, impacto e ativação prospectiva; revisão contábil posterior usa versões novas.
A central é `/financeiro/fiscal/cobertura`; `/vendas/fiscal/cobertura` tem redirect específico.
Produtos mantêm aba Fiscal; o pedido apresenta prévia, justificativas e histórico.
129 ativos sem código usam ID original: 17 classificações (11 NORMAL/6 configurações), nove com
regra, quatro com GTIN e cinco sem prova GTIN/SEM GTIN. Aptidão não significa homologação.

`src/lib/fiscal-saida/{servico,contrato,provedor}.ts` mantém DocumentoFiscalSaida e eventos
separados das notas recebidas. Snapshot `grazing.fiscal-saida` v2 contém pedido, destinatário,
parcelas, prévia/documento calculado e versões; v1 histórico não é reescrito nem enviado como v2.
Revisão fiscal é independente da comercial; rejeição/cancelamento certos permitem nova preparação.
Autorizado ou resultado incerto/pendente impede duplicidade de outra revisão.
Antes de solicitar e transmitir, conferir estado/revisão, documento externo Takeat e cálculo
vigente por hash canônico; payload/hash originais continuam preservados. Não gera faturamento.

O adaptador real `brasil-nfe.ts` é registrado condicionalmente com configuração privada;
`brasil-nfe-contrato.ts`, `brasil-nfe-destinatario.ts` e `brasil-nfe-impostos.ts` traduzem
55/65 sem delegar cálculo ao provedor. GTIN ausente bloqueia a linha; SEM GTIN é declaração
explícita, nunca fallback automático. Não herdar GTIN da embalagem de compra para fracionado.
Perfil 2026 preparado mantém Takeat; envio/cancelamento reais e troca de emissor exigem
autorização explícita e guardas do servidor. Autoemissão permanece fora da autorização atual.

Brasil NFe não garante idempotência de envio por identificador: NAO_ENCONTRADO após tentativa
incerta vai para PENDENTE_CONFERENCIA. Lease vencido retoma consulta; não reenviar cegamente.
AUTORIZADO/CANCELADO resistem a consulta, timeout e retorno regressivo/divergente, auditado.
Identidade confirmada não é substituída; campos vazios podem ser enriquecidos. `protocolo` é
autorização; `protocoloCancelamento` é evento aceito. Cancelamento comercial/estorno não cancela nota.
[Consulta](https://www.brasilnfe.com.br/api/consultas), [eventos](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e).

Homologação parcial: identidade/CRT 1, certificado e prévias; fixture 55 rejeitada com 209 por IE
inválida, sem autorização. Correção externa da IE aguarda autorização; CSC 65 e NFS-e pendentes.
LP 2027 é rascunho; IRPJ/CSLL somente segregam receitas, sem apurar débito. Distribuição/aceite
NFS-e não comprovam emissão. [Operação](../features/estrutura-fiscal/OPERACAO.md),
[Brasil NFe](../features/estrutura-fiscal/BRASIL_NFE.md), [SPEC](../features/estrutura-fiscal/SPEC.md).

`scripts/processar-fiscal-saida.ts`: até 20 unidades/chamada, sem agenda/autoemissão habilitadas.
XML/PDF protegidos no banco; download exige sessão/permissão. Smoke não transmite notas reais.
Testes: `testes/tributacao`, `testes/vendas/brasil-nfe-*`, `fiscal-saida-integracao.test.ts`.
Opt-in usa banco local fictício/schema isolado; publicação/carga/homologação exigem [evidência](../features/estrutura-fiscal/TASKS.md).

## Referências

[Dashboard Fiscal](../features/fiscal-dashboard-financeiro/README.md): fontes oficiais,
competência, ambientes separados, pendências e limites de reconciliação. O painel
exige `financeiro.fiscal.painel`; Despesas usa somente leitura do diário SEFAZ
e das NFS-e existentes do tomador, separadas por ambiente e data de emissão.
O período reutiliza `FiltroPeriodo` do DRE. As abas de Últimos documentos incluem
NF entrada, NFC entrada, NF saída e NFS entrada. `/financeiro/fiscal/configuracoes`
reúne numeração e certificado; `/numeracao` redireciona. Empresa/classificação/regras/
homologação saem do menu, com rotas e controles da emissão preservados. Certificado
mantém permissões `configuracoes.loja` e exigência de administrador para edição/exclusão.
Total/data ausentes não viram estimativas do pedido ou timestamp interno.
A configuração da emissão é uma fonte opcional, detectada por
`src/lib/fiscal-dashboard/configuracao-opcional.ts`, sem dependência de model
Prisma ou migration Brasil NFe na publicação isolada do dashboard.

[Deploy e certificado](../contexto/deploy.md), [Financeiro](financeiro.md), [Estoque](estoque.md), [histórico](../historico/README.md).

## Categoria de cada item de estoque

O aceite e `confirmarConciliacaoNotaAction` resolvem a categoria financeira no insumo
por `resolverCategoriaCompraInsumo`, com padrão CMV para cadastros sem classificação.
Cada parcela conserva o rateio existente e recebe a mesma categoria resolvida; o item
da nota guarda essa categoria como referência da conciliação. Categorias inativas,
excluídas ou de receita não são aceitas. Uso e consumo permite também despesas em CMV;
sua categoria é escolhida diretamente no item, sem entrada em estoque. Não executar
manifestação real para validar classificação. Regressão: `testes/insumos/categoria-financeira.test.ts`,
`testes/notas-fiscais/aceite.test.ts` e `custos-integracao.test.ts` (schema temporário).

## Aceite, recusa e reversão local

Somente Aceitar nota permite a integração; `confirmarConciliacaoNotaAction` exige confirmação registrada e bloqueia compras já canceladas. A recusa de nota ainda pendente não gera estoque nem financeiro. Se existirem efeitos locais, `manifestarAction` exige a prévia do cancelamento integral; a coordenação fiscal não retém travas de linhas durante o envio. O resultado externo persiste independentemente da reversão: uma falha local pode ser retomada com o evento registrado, sem reenvio. Cancelar a compra pelo Financeiro não cancela a NF-e do fornecedor. Detalhes em [Cancelamento de compra](../features/cancelamento-compra/SPEC.md).

## Destinatário pela cobrança do pedido — 17/10/2026

Pedidos novos fotografam a identidade do titular na cobrança selecionada, inclusive quando difere do cliente comprador. `cliente-cobranca.ts`, `tributacao/pedidos.ts` e `brasil-nfe-destinatario.ts` usam CPF/CNPJ, nome/razão social e IE desse snapshot, sem completar lacunas com documentos do comprador. Inscrição Municipal permanece disponível na cobrança e no payload, sem inventar um campo externo do provedor. Snapshots antigos sem identidade própria mantêm a leitura compatível. Editar um pedido incrementa a revisão e não reescreve documentos fiscais já preparados ou autorizados. Não houve transmissão fiscal real para validar esta mudança.


## Manutenção simples — 22/10/2026

O fluxo operacional mantém as telas anteriores e um botão Salvar. `tributacao/edicao-simples.ts` aplica versões e audita na transação; `campos-simples.ts` projeta os valores efetivos. Grupos não possuem NCM. Origem herdada exige escolha explícita, e a ausência do campo novo preserva a origem individual. Renomear/inativar grupo sem alterar impostos não aplica regra nova. Produtos/complementos integrados e kits conservam a representação existente. Os quatro blocos de Configurações compõem os serviços anteriores, com suas permissões. Ver [contrato atual](../features/fiscal-unificado/README.md); descrições anteriores do editor técnico não representam o fluxo normal.
