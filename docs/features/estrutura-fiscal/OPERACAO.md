# Operação e manutenção fiscal

Atualização de 14/10/2026 em branch de trabalho. A central da empresa, os seletores
oficiais e a emissão manual no pedido estão reconciliados. Código publicado,
homologação externa e habilitação operacional são estados separados.
[Entrega e impedimentos atuais](../fiscal-brasilnfe-m1/OPERACAO-20261014.md).

As quantidades e verificações de 12/10 abaixo permanecem como história. A publicação,
o recibo da carga e o smoke definitivos serão registrados em [TASKS](TASKS.md).
Takeat permanece como emissor do perfil preparado de 2026. Emissão real, autoemissão
e substituição do Takeat dependem de autorização explícita do usuário.

## Situação para a operação

A classificação de NCM foi aplicada e conferida em produção em 12/10/2026, no código
funcional `2ec0123e`. Cobre 129 produtos e 121 complementos ativos, com fontes, confiança,
justificativa, autoria e vigência. Como nenhum produto possui código comercial, utiliza
o ID original para rastreio, sem criar SKU. Há 91 NCMs invariáveis, quatro produtos com
16 cenários e 34 cadastros sem NCM próprio (32 configurações e duas cestas). As cestas
discriminam os componentes, inclusive nove referências internas de insumos/preparações.
Os 17 códigos anteriores permanecem preservados; seis correspondem à identidade de
opções incluídas, que não geram mercadoria fiscal independente.

O campo de situação para emitir é distinto da conclusão do NCM. Nove mercadorias NORMAL têm
regra fundamentada para venda interna SP a consumidor final em Simples 2026. A regra
de um produto não resolve complementos sem tratamento nem operações em outro contexto.
Quatro dessas nove revendas têm GTIN comercial/tributável igual comprovado; cinco ainda
precisam de evidência GTIN ou declaração explícita SEM GTIN para a apresentação vendida.
As exceções operacionais atuais aparecem por item no painel e nos relatórios privados
verificados. As matrizes documentais iniciais permanecem como histórico da implantação;
as quantidades atuais estão em [TASKS](TASKS.md).

A homologação externa é parcial. Identidade/CRT 1, certificado e prévias foram conferidos;
uma transmissão fictícia de NF-e 55 foi rejeitada com 209, IE do emitente inválida, sem
protocolo de autorização. A correção da IE na conta Brasil NFe aguarda autorização
específica. CSC para NFC-e 65 e emissão NFS-e não foram comprovados. Esses limites são
do fluxo afetado e não interrompem a gestão comercial. [Evidências](BRASIL_NFE.md).

## Corrigir produto, regra ou complemento

1. Na aba Fiscal do produto e na central `/financeiro/fiscal/cobertura`, localizar o ID,
   conferir a composição e a evidência de entrada/ficha. Grupo organiza regras;
   não fornece NCM único. Não copiar o NCM de ingrediente para preparação final.
   [Classif/RFB](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif).
2. Criar nova versão com dado corrigido, fonte, justificativa e vigência atual/futura.
   Se faltar característica essencial, manter a pendência objetiva. A origem tributária
   deve corresponder à aquisição da Grazing; não é uma cópia automática da origem do fornecedor.
   Conferir GTIN da apresentação vendida; SEM GTIN exige declaração explícita e evidência.
   Código da embalagem de compra não é herdado por fracionamento ou preparo. A rota antiga
   `/vendas/fiscal/cobertura` somente redireciona para a central atual.
3. Conferir o vínculo do complemento: INCLUIDO para escolha interna gratuita,
   INTEGRADO quando a cobrança pertence ao alimento, MERCADORIA para venda separada,
   APRESENTACAO para apresentação acessória comprovada. MERCADORIA precisa de produto,
   unidade/quantidade e valor próprios; não converter quantidade entre unidades sem prova.
4. Gerar análise de impacto e conferir produtos afetados. Alteração concorrente exige
   atualizar a versão/impacto; o administrador ativo é verificado novamente no servidor.
5. Ativar a versão fundamentada e validar uma nova prévia do contexto afetado. Documentos
   preparados antes da alteração podem exigir outra revisão fiscal; documentos emitidos
   e suas versões/fontes continuam históricos. A revisão contábil posterior usa este
   mesmo procedimento, sem edição de código ou de documentos antigos.

Kits/cestas precisam de mercadorias distintas, quantidades e pesos de rateio;
podem usar referências fiscais de insumos/preparações existentes, sem criar SKU comercial.
as linhas recebem descrição e unidade de cada mercadoria. Escolhas de sabor, ausência de
ingrediente ou embalagem padrão não se tornam mercadorias por existir um cadastro de opção.
Os centavos rateados devem fechar com o total do pedido.
Escolhas gratuitas alteram a composição; extras separados seguem o vínculo MERCADORIA.
Sabores de suco e de torta representam unidades separadas e usam seu cenário individual.
Fichas fiscais descrevem o conteúdo final por unidade, sem substituir consumo de estoque.
Se composição, marca ou identificação material mudar, registrar nova versão fundamentada.
No coco, peso bruto e porção comestível ainda exigem conversão operacional documentada;
não transformar automaticamente 0,4 UN do cadastro em 0,1 KG de estoque.
GTIN comercial e tributável devem identificar a apresentação/unidade efetivamente vendida;
o leiaute distingue esses campos. [MOC NF-e/NFC-e](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-i-leiaute-e-rv.pdf).

CEST pode ser obrigatório mesmo sem ST na operação; a presença do código não comprova
retenção anterior. Conferir mercadoria/NCM e vigência paulista, além da prova de aquisição.
[Convênio ICMS 142/2018, cláusula 20](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18),
[CAT 68/2019 consolidada](https://legislacao.fazenda.sp.gov.br/paginas/Portaria-CAT-68-de-2019.aspx).

## Primeira emissão real

1. Concluir a correção cadastral autorizada da IE no provedor e a homologação externa
   do modelo escolhido, incluindo autorização, consulta, arquivos e cancelamento.
   NFC-e 65 exige também CSC válido. Não registrar mock ou prévia com tarja como aprovação.
   Conferir CNPJ, CRT, IE, certificado, ambiente, numeração e série da conta emissora.
2. Selecionar pedido comercial confirmado e operação coberta. Conferir destinatário,
   endereço fiscal/código municipal quando exigidos, modelo, natureza, quantidades,
   descontos, frete, complementos e pagamento. A prévia deve ficar apta sem pendências
   e explicar a regra/versões de cada linha. Não gerar serviço como mercadoria.
3. Conferir no Takeat e no histórico do HUB que a mesma operação não possui documento
   externo, autorizado ou resultado pendente. Definir um único emissor para a operação.
   Apresentar ao usuário a prévia concreta, modelo, pedido e total para obter autorização
   explícita da transmissão real e, se aplicável, da mudança de emissor.
4. Somente após essa autorização e prova da homologação do modelo, habilitar emissão
   manual do ambiente em Configurações → Integrações → Brasil NFe. O registro usa
   versão/emitente, autoria e prova durável. Não ativar o caminho antigo por flags.
   O emissor global do Takeat não é trocado por uma autorização de nota: o pedido
   registra a conferência específica de ausência de documento externo. Não há emissão
   automática nem callback operacional. [Configuração](BRASIL_NFE.md).
5. Preparar uma nova fotografia na data de Brasília da emissão, conferir novamente a
   prévia e solicitar ENVIAR uma vez. O servidor revalida pedido, regras e exclusividade
   imediatamente antes da transmissão. Preparar não transmite; publicar código não
   autoriza esta etapa. [Contrato de envio](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e).
6. Consultar o resultado pelo identificador original. Somente AUTORIZADO com prova fiscal
   permite considerar a nota emitida. Guardar chave, número, série, protocolo, XML e
   documento auxiliar autenticado. A ação não gera novo faturamento no financeiro.

A autorização da primeira emissão não habilita autoemissão nem uma troca geral de emissor.
Essas alterações continuam com escopo próprio. Se for necessário cancelar uma nota autorizada,
solicitar cancelamento fiscal com justificativa e confirmar o protocolo do evento; cancelar
pedido ou estornar pagamento são operações independentes.
[Eventos Brasil NFe](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e).

## Resultados incertos e históricos

| Estado | Ação operacional |
| --- | --- |
| SEM_EMISSOR | Conferir configuração privada do adaptador; a gestão comercial continua disponível. |
| PREPARADO | Conferir a fotografia atual e solicitar envio apenas dentro da autorização correspondente. |
| PROCESSANDO / INCERTO | Consultar o identificador original; não enviar outra revisão para tentar resolver a incerteza. |
| PENDENTE_CONFERENCIA | Conferir no emissor e conciliar a prova fiscal. Não forçar PREPARADO nem criar outro envio. |
| REJEITADO | Corrigir o dado e preparar nova revisão fiscal explícita. A rejeição original continua registrada. |
| AUTORIZADO | Consultar/obter arquivos ou solicitar evento fiscal permitido; não emitir duplicata do pedido. |
| CANCELADO | Preservar autorização e evento de cancelamento. Consulta/timeout/retorno regressivo não reabre a nota. |

Brasil NFe admite múltiplas tentativas com o mesmo identificador; isso não garante envio
idempotente. Após tentativa incerta, NAO_ENCONTRADO mantém quarentena no HUB. Resposta HTTP,
HTML, erro genérico ou ausência isolada não autoriza reenvio. Consulta que encontra nota
cancelada sem comprovar separadamente o protocolo do evento exige conferência externa.
[Contrato de consulta](https://www.brasilnfe.com.br/api/consultas).

Referência, chave, número, série e protocolos confirmados não são sobrescritos por retorno
divergente; o evento é auditado. `protocolo` conserva a autorização e `protocoloCancelamento`
conserva o cancelamento aceito. Dados vazios podem ser enriquecidos sem substituir os confirmados.

## Mudança futura de regime por configuração

1. Manter LP2027 em rascunho enquanto não houver confirmação cadastral do enquadramento.
   Registrar comprovante, estabelecimento e data efetiva; não antecipar aplicação em 2026.
2. Importar versões oficiais vigentes de NCM, CFOP, CST/CSOSN, CEST, CST-IBS/CBS e cClassTrib,
   com compatibilidade por mercadoria/regime/modelo. Definir regras de venda/destino,
   ICMS/ST, CBS/IBS, reduções e segregação com evidências e alíquotas legalmente fixadas.
   A falta de parâmetro mantém a operação afetada pendente; não usar estimativa de CBS/IS.
   [LC 214/2025 atualizada](https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html),
   [Tabelas da reforma/SVRS](https://dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria).
3. Distinguir preparo local, revenda, álcool, ST e serviços; redução de restaurante não
   se estende automaticamente a toda receita. IRPJ/CSLL recebem segregação de receitas
   nas linhas, sem apuração automática de débito ou percentuais de presunção neste motor.
4. Registrar a política comprovada de preço final e composição dos tributos. O bruto
   comercial conserva o preço contratado; líquido do produto exclui os tributos contidos
   e não se confunde com base da operação acrescida de frete/despesas. Em SP, a orientação
   consultada inclui RTC exigível na base ICMS; retirar RTC exige fundamento específico.
   Rateio proporcional para acessórios precisa de versão e justificativa, sem criar
   diferença no pedido. Não transportar débitos PIS/COFINS de 2026 para regras de 2027.
   [RC SP 32.931/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC32931_2025.aspx),
   [RC SP 33.083/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33083_2026.aspx).
   Exceção de base líquida exige cadastro estruturado de UF, início/fim de vigência,
   ato, justificativa e URL oficial vinculada às fontes da versão. O servidor confere
   esses dados na ativação e no cálculo; texto livre ou as duas RCs de base bruta
   não constituem prova de exceção. Não há exceção real cadastrada por estes testes.
5. Homologar e registrar no perfil o leiaute NT2026.008 e os caminhos reais dos cinco
   campos na API: líquido produto, unitário líquido, total líquido produtos, total item
   e total documento. Conferir XML, tributos, frete, descontos e pagamentos; não inferir
   nomes de campos nem somar IBS/CBS outra vez ao total já bruto. Publicação da NT ou
   ambiente futuro não é comprovação do emissor. Esse contrato de 2027 permanece sem
   homologação conclusiva e impede somente a emissão dependente.
   [NT 2026.008 v1.00](https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=3&nomeArquivo=NT_2026.008_v1.00_RTC_ValorLiquidoProduto.pdf).
   O aviso oficial de 05/10 adiou homologação para 26/10/2026 e produção para
   16/11/2026; conferir alterações futuras e capacidade real antes de registrar prova.
   [Cronograma SVRS](https://dfe-portal.svrs.rs.gov.br/Nfce/Avisos/2896).
   Conferir totais com duas casas e unitário líquido com até onze inteiros/dez casas;
   unidade × quantidade admite ±R$0,01. O contrato numérico também deve preservar
   o decimal exatamente; valores não representáveis são bloqueados, sem arredondar
   preço ou quantidade para viabilizar o envio.
6. Não ativar benefício opcional paulista por herança de 2026. O Decreto 51.597 consultado
   exclui Simples e termina em 31/12/2026; verificar prorrogação, elegibilidade e opção
   efetiva antes de qualquer configuração futura. [Decreto consolidado](https://legislacao.fazenda.sp.gov.br/Paginas/dec51597.aspx).
7. Testar contextos com fixtures, gerar impacto e ativar versões com vigência prospectiva
   somente após confirmação. A seleção do servidor aplica o perfil na data efetiva e
   conserva os documentos anteriores. Se a empresa continuar no Simples em 2027, criar
   seu perfil/regras da nova vigência; não prolongar a dispensa de IBS/CBS de 2026.

Correções de NCM, grupos, fontes, tratamentos e parâmetros suportados usam a central versionada.
Integração NFS-e ou cálculo especial não comprovado permanece pendente no respectivo fluxo,
sem simular suporte. Para eventos, separar alimentação e serviço conforme o contrato efetivo.

## Vínculos do cadastro comercial

O cadastro comercial exibe `ProdutoVenda.grupoFiscalId` e `fiscal.ncm`; esses campos
não eram preenchidos pelo bootstrap das versões tributárias. O utilitário administrativo
`scripts/estrutura-fiscal-vinculos.mjs` projeta as classificações ATIVO vigentes no dia
atual de São Paulo, conservando os demais campos e documentos. Produtos e complementos
compartilham o mesmo registro; as opções continuam vinculadas ao produto existente.

O NCM é preenchido somente quando a classificação está CONFIRMADO e o campo está vazio.
Códigos de entrada candidatos permanecem como evidência nas observações, sem preencher
NCM definitivo. O grupo organiza também registros pendentes. KIT_COMPOSTO sem grupo
operacional usa o auxiliar cadastral homônimo, sem NCM ou regra do conjunto. Os dois
auxiliares KIT_COMPOSTO e OPCAO_CONFIGURACAO têm parâmetros vazios; escolhas internas
mantêm seus grupos individuais e não geram linha fiscal independente por esse vínculo.

O padrão é prévia somente leitura, sem carregar `.env` automaticamente:

```text
node scripts/estrutura-fiscal-vinculos.mjs --schema=public --saida=.tmp/fiscal/vinculos-cadastro
```

A aplicação exige conexão explícita do alvo conferido, administrador vigente no banco,
`VINCULOS_FISCAIS_APLICACAO_AUTORIZADA=SIM`, `--aplicar`, `--hash-plano` da prévia,
`--usuario-id` e `--backup-comprovante`. O comprovante privado registra `criadoEm`,
`verificado=true`, `autorizacaoImplantacao=true` e `hashDump` SHA-256, com idade até 24h.
O operador deve conferir a leitura integral e o hash do dump e confrontar cluster,
database e schema da aplicação com os do backup antes da execução. O CLI valida a
declaração do comprovante; não substitui essa verificação do arquivo e do alvo.

A transação revalida o administrador, adquire as travas de acesso/estrutura/cadastro,
confere versões e grava histórico FISCAL/GRUPO_FISCAL com projeção de atividade.
Divergência de NCM/grupo já preenchido, revisão manual ou limite de observações gera
conflito sem sobrescrever o cadastro. Cada mudança incrementa a revisão comercial;
reexecução sem mudança não cria nova revisão ou histórico. Plano e recibo ficam privados.

Correção posterior exige versão tributária prospectiva e análise de impacto na central.
Se houver valor cadastral divergente, conferir e corrigir o vínculo pela interface,
preservando o histórico. Reversão do lote restaura somente os campos fiscais anteriores
por nova alteração auditada, conferindo a revisão atual; não restaura o banco integral
sobre vendas novas. O utilitário não ativa versões futuras nem transmite documentos.

## Parâmetros por lote administrativo

`scripts/estrutura-fiscal-parametros.ts` aplica políticas de grupo, decisões individuais
e versões pelo serviço existente. O escopo é venda interna paulista a consumidor final,
Simples Nacional CRT 1, na data da execução. Não altera perfil, pedidos ou transmissão.
O tipo de operação continua sendo filtro do seletor de CFOP, sem coluna adicional.

Entrada, tabela oficial NCM, plano e recibo ficam em `.tmp/fiscal`, fora do Git.
Usar `--entrada`, `--tabela-ncm`, `--usuario-id`, `--saida` e `--dry-run`.
A simulação executa as validações e reverte integralmente a transação, inclusive auditoria.
A aplicação exige `--apply`, `--hash-plano`, `--backup-comprovante` recente e
`CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA=SIM`. A conexão deve ser explícita.

O serviço reconfere administrador, sessão, perfil efetivo, revisões e estado do catálogo.
Adquire as travas existentes e utiliza as persistências comerciais e fiscais na mesma
transação. Políticas de grupo não são propagadas sobre decisões individuais ou inativos.
NCM já fundamentado não pode ser substituído pelo lote. Regras com ST não comprovada
permanecem como propostas sem ativação. O recibo FISCAL guarda hashes e impede replay
com conteúdo, autor ou estado divergente. A justificativa individual usa o mesmo recurso
de permissão `vendas.fiscal`. Metadados legados do JSONB são preservados.

Na carga de outubro, GTIN está fora do escopo por instrução do responsável. Preservar
valores anteriores e os validadores da emissão. Cadastro conferido não equivale a nota
autorizada ou a todos os pré-requisitos de emissão cumpridos. Origem/FCI e retenção ST
dependem dos fatos de cada produto. Não inventar CI nem estender a declaração específica
da Grazing para 1. Rollback cadastral exige nova alteração auditada com revisão atual;
rollback tributário exige nova versão prospectiva. Não apagar o recibo ou restaurar dump.

### Projeção de auditoria fiscal e Validades

A migration `20261016233000_restaurar_projecao_atividade_fiscal` corrige a substituição
do projetor fiscal de 11/10 pelo projetor de Validades de 16/10. A regressão reproduziu
a recusa de `EventoEstruturaFiscal` com SQLSTATE 22023. A nova função trata a fonte
fiscal validada e delega as demais à implementação de Validades preservada. Não altera
migrations aplicadas, não faz backfill e não copia conteúdo fiscal para atividades.
Regredir criação, impacto, ativação, permissões e `ETIQUETA_BAIXADA` em banco sintético.
O rollback de código pode manter esta correção compatível; não remover o projetor
fiscal nem restaurar a implementação que recusava sua fonte.

## Backup, rollback e monitoramento

Antes de publicar ou aplicar lote, registrar revisão Git, migrations, imagem/configuração
anteriores e backup privado íntegro. O bootstrap usa dry-run padrão, administrador real,
comprovante recente de backup/autorização e conferência de IDs/revisões/preços do catálogo.
Plano é diferente de recibo de aplicação; não versionar dumps, tokens ou o export real.
[Procedimento de publicação](../../contexto/deploy.md).

Rollback de regra/classificação cria versão corrigida prospectiva e nova análise de impacto;
não altera conteúdo de versão antiga, nota, protocolo ou estoque histórico. Rollback de código
exige imagem compatível com as migrations aditivas e dados já gravados. Não restaurar dump
sobre transações novas nem excluir migrations/versões aplicadas. Em contingência, suspender
novos envios pela configuração operacional e preservar a consulta/conciliação dos existentes.

Acompanhar cobertura, exceções por produto, rejeições, documentos incertos, leases pendentes,
divergência de cadastro do emitente, ativação por vigência e duplicidade externa. Conferir
o recibo da carga e o smoke autenticado após publicação. Monitoração não transmite documento,
não repete cancelamento e não modifica iFood, financeiro ou estoque para demonstrar funcionamento.

## Quatro grupos operacionais — 21/10/2026

O cadastro oferece Preparações, Revenda Vinhos e Espumantes, Revenda Cervejas e
Revenda Destilados. Seus modelos seguem, respectivamente, Grazing para 1,
Espumante Casa Valduga Brut 375ml, Leopoldina Pilsner Extra e Licor Bardêra.
O grupo comercial não converte revenda em produção própria. Parâmetros individuais
fundamentados, NCM, composição, kits e opções integradas conservam seu tratamento.
Os códigos técnicos GF01–GF12 permanecem nas versões históricas e no motor.

`lote-grupos-operacionais.ts` reorganiza o catálogo completo, inclusive inativos,
pelos serviços de persistência existentes. Requer administrador real, revisões
atuais, simulação com rollback e hash do estado completo. Arquiva os grupos
anteriores sem excluir IDs. A sincronização de classificações respeita o grupo
operacional já escolhido. As consultas cadastrais oferecem somente grupos ativos.

A declaração expressa do responsável informa ausência de GTIN na apresentação
final. O lote registra SEM GTIN nos cadastros e cria versões prospectivas das
classificações aplicáveis. Não a apresenta como prova do fabricante. Serviços,
kits discriminados e opções sem linha fiscal independente conservam sua natureza.
A assinatura dos NCMs inclui ausência da chave e zeros à esquerda: qualquer
diferença reverte o lote inteiro. Regras tributárias e perfil não são alterados.

O CLI existente `scripts/estrutura-fiscal-parametros.ts` reconhece
`politicaGrupos: QUATRO_GRUPOS`. Usa os mesmos controles de backup privado recente,
autorização explícita, plano, administrador e recibo. Os arquivos reais ficam em
`.tmp/fiscal/quatro-grupos-20261021`, fora do Git. Reexecução no mesmo estado não
duplica alterações; mudança concorrente exige nova simulação.

Para reversão, usar as fotografias privadas de antes/depois e a auditoria do lote.
Restaurar vínculos e modelos pelos serviços cadastrais, com suas revisões atuais.
Se necessário, registrar nova versão de classificação com vigência prospectiva.
Não excluir versões, documentos nem restaurar o dump sobre vendas posteriores.

## Repasse de FCI do fornecedor — 21/10/2026

`fci.repasseFornecedor` distingue transcrição da entrada e apuração própria de CI.
Aplica-se somente a mercadoria NORMAL revendida ou fracionada, sem nova industrialização,
com um único material direto. NCM, natureza e origem permanecem declarados na classificação.
O fundamento é o art. 8º da [Portaria CAT 64/2013](https://legislacao.fazenda.sp.gov.br/Paginas/pcat642013.aspx).

O operador informa o controle real e o insumo. `fci-fornecedor.ts` lê apenas itens já
conciliados para estoque. Confere XML completo de NF-e de produção, protocolo 100, chave,
item, código do fornecedor, NCM, origem e controle FCI único. Não consulta a SEFAZ.
Data de emissão vem do XML. Ausência, divergência, manifestação incompatível ou mais
de 100 entradas bloqueiam a revisão com mensagem local. Entradas posteriores à vigência
não fundamentam a classificação anterior. O HUB não gera um controle FCI.

Ao salvar, o servidor reconstrói a fotografia material e sela os itens, datas e hashes
dos XMLs. Não aceita o selo enviado pelo cliente como prova. Ao ativar, reconfere a
mesma prova. Mudança exige nova versão e análise de impacto. As permissões, transações,
auditoria e imutabilidade existentes continuam obrigatórias. A leitura não altera notas
recebidas, estoque, preços, pedidos nem documentos emitidos.

A decisão conserva `EXIGIDA` e o número transcrito. Os campos de CI própria ficam nulos
e `apuracaoCompleta` fica falso. O motor aceita o repasse comprovado nos modelos 55 e 65.
O snapshot vincula natureza, NCM, origem, materiais e versão; o adaptador também compara
o NCM efetivamente enviado. Somente `Produtos[].nFCI` vai ao provedor. O cartão da
classificação mostra o controle e as entradas conferidas. Revisar exige ação explícita.

Regras podem restringir `produtoId` ao alias canônico `INSUMO:<id>` de uma referência
interna. Somente REGRA admite esse alias. Salvar e ativar exigem insumo ativo e não
excluído. A análise de impacto inclui os kits dependentes. Isso permite corrigir um
componente sem criar SKU nem aplicar uma regra geral a outras mercadorias. O editor
preserva e identifica a referência selecionada pelo nome do insumo.

Testes: `fci-fornecedor-{contrato,servico,integracao}.test.ts`, `motor.test.ts`,
`fci-classificacao-interface.test.tsx` e `fiscal-fci-fornecedor.spec.ts`.
A integração usa apenas PostgreSQL local fictício e `ESTRUTURA_FISCAL_BANCO_TESTE=1`.
As capturas usam dados sintéticos e permanecem Em revisão visual.

### Ajustes de catálogo já aplicados nesta operação

- As classificações previstas no plano privado receberam SEM GTIN, conforme declaração do responsável.
- As preparações próprias usam origem nacional conforme declaração expressa. A versão
  anterior de Grazing para 1 e sua decisão FCI limitada ao modelo 55 permanecem no histórico.
- A receita da porção de coco foi corrigida conforme a evidência privada, com nova receita e classificação. As quantidades originais permanecem privadas. Não houve ajuste de saldo nem movimentação física para testar.
- Lombo Canadense, Copa, Salame, Pastrami e Torta artesanal de Frango receberam o padrão
  tributário das preparações por instrução expressa do responsável, para revisão posterior
  com a contabilidade. NCM, origem e natureza foram preservados. CFOP 5102 corresponde à
  natureza real de revenda/fracionamento; CSOSN 102, sem destaque e ST não aplicável.

Os lotes usam plano privado, backup íntegro, hash aprovado, transação, auditoria e recibo
idempotente. Arquivos reais permanecem privados na VPS. Não houve emissão, cancelamento,
troca de certificado/CSC, habilitação automática ou alteração no fluxo de notas recebidas.

## Descrição XML, pagamento comercial e nova tentativa — 21/10/2026

`brasilnfe/texto-xml.ts` normaliza apenas a representação fiscal de `xProd`. Converte
travessões e aspas tipográficas, compõe acentos em NFC, compacta espaços e limita a
descrição a 120 caracteres. Os montadores de `tributacao/pedidos.ts` e
`brasilnfe/payload-local.ts` usam esse contrato. `validarSnapshotBrasilNfe` recusa
caracteres que continuem incompatíveis com TString e identifica o produto/campo.
Nomes comerciais, fotografias históricas, preços e tributos não são regravados.

O pagamento fiscal usa a forma comercial e o total da venda. Não exige recebimento,
captura, repasse, baixa de título ou quitação. O HUB não integra TEF; no alcance
validado de São Paulo, cartão em NFC-e usa `TipoIntegracao=false` sem nova pergunta
de confirmação. Não inventa adquirente, bandeira ou autorização de cartão.
As demais exigências fiscais e o alcance por UF permanecem no servidor.

Na consulta ao emissor, uma rejeição única `Status=3`, `Emitida=false`, sem protocolo,
com identidade conferida e código interno zero só é recuperável quando o motivo
comprova a falha XML de `xProd`. Somente uma categoria local atravessa o cliente;
`DsStatusResposta`, XML e texto livre externo não vão para eventos ou mensagens.
Código zero isolado, duplicidade, ausência e histórico ambíguo continuam em conferência.
Autorização anterior prevalece; a consulta nunca transmite uma nota.

Uma chave gerada para XML rejeitado não equivale a autorização. Rejeição comprovada
e sem protocolo pode gerar outra revisão/identidade. A tentativa anterior permanece
íntegra. `rejeicao.ts` compartilha esse critério entre preparação, ação direta e UI.
Resultado incerto mantém seletor e botão visíveis; o botão fica desabilitado até
conferir a tentativa existente. Rejeição corrigível libera nova tentativa ou troca
55/65. Autorização, denegação, cancelamento e permissões conservam suas proteções.

Validação usa testes de contrato, PostgreSQL local e HTTP fictício. As capturas da
prévia de Pedidos são consultivas e permanecem **Em revisão visual**. O diagnóstico
de produção consulta somente a tentativa existente; não emite, cancela ou altera
configuração fiscal externa.
