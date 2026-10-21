# Brasil NFe — contrato de saída e operação segura

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## SEM GTIN e preparações nacionais — 21/10/2026

O responsável declarou que nenhum produto vendido possui GTIN e que as
preparações próprias usam ingredientes exclusivamente nacionais. A correção usa
o serviço existente de versões, impacto e ativação. Registra SEM GTIN na unidade
final vendida e origem 0 nas preparações próprias, com vigência atual e autoria.
Revendas e fracionados conservam suas origens. O GTIN dos insumos de compra é
preservado. A emissão continua exigindo a classificação ativa e seus dados
explícitos; ausência de código não recebe fallback automático.

Na Grazing para 1 (tábua de frios), a classificação anterior tinha origem 5 e uma
declaração administrativa FCI limitada ao modelo 55. A nova classificação nacional
retira essa decisão FCI somente da versão nova. A declaração e sua memória
anterior permanecem no histórico. O motor existente admite a classificação
nacional nos modelos 55/65, respeitando as condições da operação.

Fontes: [MOC 7, Anexo I, I03/I12](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J+I+v4eN00E%3D)
para SEM GTIN e [RC 33527/2026, itens 10/11](https://legislacao.fazenda.sp.gov.br/Paginas/RC33527_2026.aspx)
para o tratamento descrito de fabricação exclusivamente nacional. A informação
material vem da declaração do responsável. A consulta normativa não comprova a
composição do HUB nem substitui seus documentos.

O teste SQL `estrutura-integracao` reproduz a classificação antiga com FCI 55,
salva nova versão nacional/SEM GTIN, exige impacto/ativação e preserva o histórico.
Planos, aplicação e pendências reais estão no
[registro operacional](OPERACAO-SEM-GTIN-20261021.md).

## NFC-e com cartão não integrado — 21/10/2026

O contexto fiscal aceita `pagamentoCartaoNaoIntegrado:true` somente como
confirmação explícita do operador. Ausência não confirma integração nem dispensa
os dados. Valores `false`, `null`, texto ou número são recusados no domínio.

No modelo65, para emitente de SP e pagamento03/04, a confirmação acrescenta
`TipoIntegracao:false` ao pagamento. O snapshot registra a decisão para a
revalidação anterior ao envio. O sistema não inventa adquirente, bandeira ou
código de autorização. A confirmação não altera o pedido, a captura, o
recebimento nem o valor pago. NF-e55 e outros meios conservam seu contrato.
Outra UF exige validação própria e permanece bloqueada neste fluxo.

A [NT2025.001 v1.03, regras YA04/YA05](https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?conteudo=NvuzQGYd6E8%3D)
mantém o tipo de integração no grupo de pagamentos. O CNPJ da instituição e a
autorização são exigidos no pagamento integrado. O leiaute admite pagamento não
integrado (`tpIntegra=2`), com os demais campos opcionais. A
[SEFAZ-SP](https://portal.fazenda.sp.gov.br/servicos/nfce/Paginas/Regras-de-validacao.aspx)
publica as regras YA04-10, YA04a-20 e YA05-10 como inativas. Isso não comprova o
aceite de uma nota específica.

O schema público de [NF-e/NFC-e do Brasil NFe](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e),
conferido em21/10/2026, define `TipoIntegracao` como booleano que informa se o
pagamento usa automação/TEF. Portanto `false` declara pagamento não integrado.
O objeto não exige credenciadora, bandeira ou autorização para essa declaração.
O serializador preserva o booleano; não o converte em número nem texto.

Testes sintéticos em `testes/tributacao/revisao-consolidada-pedidos.test.ts`
cobrem confirmação, recusa de valores inválidos, limites de modelo/UF/meio e
preservação dos demais impedimentos. Não houve emissão real. GTIN ausente,
regras fiscais faltantes e declarações FCI fora do alcance continuam pendências
por produto; a habilitação65 não aprova esses dados.

## Pedido e cancelamento manual — 20/10/2026

Implementação na branch `codex/dashboard-emissao-pedidos-20261020`. Este registro
descreve o código e os testes isolados. Não comprova publicação ou cancelamento
externo. Os registros datados abaixo permanecem históricos.

- O pedido oferece NFC-e65 e permite escolher NF-e55 na emissão.
- Novas preparações usam `consumidorFinal:true` no servidor. `Finalidade:1`
  continua a representar emissão normal. Não confundir finalidade de emissão
  com consumo final. Documentos preservados não são recalculados nem reescritos.
- Sem IE, consumo final usa indicador9. O sistema não converte ausência de
  cadastro em isenção de inscrição. A regra para contribuinte permanece válida.
- A preparação mostra os impedimentos antes do envio. A transmissão ainda exige
  confirmação individual, hashes, revisão vigente e ambiente habilitado.

A [NT2025.001](https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?conteudo=NvuzQGYd6E8%3D)
distingue contribuinte normal (1), contribuinte isento de inscrição (2) e não
contribuinte (9). A [orientação da Receita RS sobre consumidor final](https://atendimento.receita.rs.gov.br/como-deve-ser-preenchido-o-campo-de-indicador-de-operacao-com-consumidor-final-campo-indfinal)
define o indicador de consumo final. Não criar bloqueio de NFC-e apenas por CNPJ:
a [SEFAZ-SP, RC33736/2026, item10.2](https://legislacao.fazenda.sp.gov.br/Paginas/RC33736_2026.aspx)
registra a revogação do Ajuste11/2025 pelo Ajuste12/2026. Permanecem as condições
fiscais da operação e a habilitação específica do modelo.

`cancelarNotaPedidoBrasilNfeAction` recebe `documentoId`, `modelo`, `ambiente`,
`chaveFiscal`, `protocolo`, `justificativa` (15 a255 caracteres) e
`confirmarCancelamento:true`. Exige `vendas.fiscal/editar`, acesso de revisão do
pedido e permissão administrativa da integração. Não altera dados externos de
configuração. O backend revalida as permissões persistidas, a autorização
original e a configuração atual antes da única chamada.

`brasilnfe/cancelamento.ts` cria uma autorização auditada por documento.
`bloqueio-transmissao.ts` limita o contexto à operação CANCELAR. Esse contexto
não permite ENVIAR, outro documento ou outro ambiente. A última fronteira HTTP
revalida sessão, configuração, emitente, chave, protocolo, justificativa, hash,
lease e autorização. As travas seguem acesso → fiscal → configuração.
O adaptador geral continua sem cancelamento livre e a fila automática continua
sem emissor.

O evento só confirma CANCELADO após validar XML, chave, ambiente, evento110111,
código135 e protocolo. A autorização original fica preservada. Recusa explícita
de prazo (Status3/código501, sem protocolo/XML de evento) mantém AUTORIZADO e
informa o motivo. Timeout ou evento inconclusivo mantém AUTORIZADO com
`cancelamentoPendente:true`; faturamento e arquivos da autorização não somem.
`cancelamentoSolicitado` vem do evento de autorização e impede nova tentativa,
inclusive após recarregar. A interface apresenta a pendência.

A [API de eventos do fornecedor](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e)
documenta o status do evento e os arquivos. O [MOC 7, Visão Geral](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=LrBx7WT9PuA%3D)
identifica o código501 como recusa de prazo. O HUB não calcula prazo com
`createdAt` nem declara sucesso por HTTP200. A mensagem utiliza códigos
permitidos e texto local; respostas brutas não atravessam a interface.

Limites: não há recuperação automática do protocolo perdido nem nova tentativa
automática. Sem protocolo do evento, é necessária conferência externa. A
autorização de cancelamento já registrada também bloqueia repetição após falha
antes do transporte. Cancelar a nota não cancela o pedido nem estorna pagamento.
Os testes usam exclusivamente banco local e respostas simuladas.

## Estado e fronteiras

Contrato reconciliado em 14/10/2026, na branch de trabalho, sem publicação.
`provedor.ts` resolve o adaptador manual em `brasilnfe/operacional.ts` somente com
sessão, documento e habilitação durável do ambiente. Sem contexto retorna null.
O cliente `brasilnfe/cliente.ts` conserva a aceitação estrita por endpoint. O
serializador v2 em `brasil-nfe-contrato.ts` reutiliza o cálculo fotografado.
`brasil-nfe.ts` permanece como implementação histórica, sem registro operacional.
Não habilitar seu caminho antigo por variáveis de ambiente.

O motor único usa PERFIL, CLASSIFICACAO e REGRA de `VersaoEstruturaFiscal`, com
vigência, hash e evento de ativação conferidos. O piloto antigo mantém suas versões
EMPRESA/OPERAÇÃO/ITEM e snapshots v1. Não converter esse histórico retroativamente.
Emissão manual não ativa automação, não modifica status comerciais e não cria
lançamentos financeiros. Produção continua bloqueada nesta entrega.

As evidências de 11 e 12/10 abaixo são históricas. A IE foi corrigida em 13/10,
por autorização específica. A tentativa posterior ficou em conferência em 13/10;
uma única consulta em 14/10 comprovou rejeição 181, sem protocolo. O resultado foi
reconciliado localmente pela fila, sem nova consulta ou retransmissão.
O [registro operacional de 14/10](../fiscal-brasilnfe-m1/OPERACAO-20261014.md)
separa essas evidências dos testes e das partes ainda não homologadas.

O código anterior possuía o plug durável, não um adaptador Brasil NFe. A consulta
oficial da API confirmou transmissão síncrona, consulta, prévia e cancelamento.
Os testes HTTP são sintéticos e não comprovam homologação externa, certificado,
CSC, configuração da conta ou autorização de uma nota na SEFAZ.

Em 11/10/2026 foi realizada uma rodada externa controlada, com as credenciais
privadas fornecidas por responsável autorizado: identidade/CRT 1 confirmados, certificado válido,
prévia NF-e 55 com XML/PDF e uma única transmissão **em homologação**, de fixture
fictícia independente de pedidos e bancos operacionais. A SEFAZ respondeu
**rejeição 209 — IE do emitente inválida**; a consulta do mesmo identificador
confirmou rejeição e ausência de protocolo. Não houve autorização fiscal,
transmissão em produção ou reenvio. Corrigir o cadastro do emitente e repetir a
homologação mediante escopo autorizado permanece necessário. CSC de homologação
da NFC-e e serviço NFS-e não estavam habilitados nesta verificação.

A causa cadastral foi isolada em 12/10/2026 por consultas: a IE atual do provedor
possui 11 dígitos, enquanto a fonte conferida em documentos recebidos possui 12,
passa nos dois dígitos verificadores de São Paulo e corresponde ao CNPJ do token
e do certificado. Backup privado e payload completo foram preparados; somente
`IE` difere. A revisão automática de aprovação bloqueou a edição externa por
exigir autorização explícita para a mutação desse cadastro fiscal compartilhado.
Nenhuma alteração cadastral foi executada. Após autorização, usar cópia de uma
consulta fresca, conferir todos os campos no retorno e não repetir uma edição
com resultado incerto. O contrato oficial de `EditarEmpresa` exige objeto
completo; não há garantia documentada de PATCH parcial.

Novos snapshots fotografam `emitenteIE` a partir do perfil vigente. Antes de
pré-visualizar ou enviar, o adaptador confere CNPJ/CRT e o campo `IE` retornado
por `BuscarEmpresa`, removendo somente pontuação e espaços. IE ausente,
divergente ou fora do formato de dois a 14 dígitos bloqueia a operação antes
de qualquer endpoint fiscal, sem alterar o cadastro do provedor. A comparação
conserva zeros iniciais e não simula validação dos dígitos verificadores.
Snapshots legados sem `emitenteIE` mantêm seu comportamento anterior e não
recebem dados cadastrais retroativamente.

## Configuração administrativa vigente

Credenciais permanecem cifradas em `ConfiguracaoBrasilNfe`, com chave externa ao
banco e campos vazios na leitura. A origem cadastral é `ConfiguracaoLoja`; não há
outro cadastro da empresa. O CRT explícito pertence ao PERFIL central aprovado
com vigência. Optar pelo Simples, isoladamente, não preenche CRT 1.

Na correção de15/10, selecionar Brasil NFe no PERFIL é configuração do HUB,
aprovada pelo fluxo administrativo de impacto/auditoria. Não exige a antiga flag
`BRASIL_NFE_PRODUCAO_AUTORIZADA` nem altera a integração paralela Takeat. A escolha
não habilita transmissão: `bloqueio-transmissao.ts` continua negando envio em todos
os modelos/ambientes. Configuração tributária e autorização de uma nota são atos
distintos. Rascunhos salvos e fontes estão em [Operação](../fiscal-brasilnfe-m1/OPERACAO-20261014.md).

O destinatário pode resolver código IBGE ausente pela correspondência única de
cidade+UF fotografadas na tabela oficial local, sem CEP ou cadastro atual. Código
explícito inválido, aliases contraditórios ou divergência comprovada continuam
bloqueados. A prévia não modifica o endereço do pedido.

O cadastro da empresa também preserva/resolve o IBGE por município e UF já
declarados, sem CEP externo. O serviço normal de Dados da empresa grava o código
com permissão, trava, histórico LOJA e invalidação de versão existentes. Código
explícito incompatível não é substituído silenciosamente.

A organização autorizada em15/10 é NF-e55/série6 e NFC-e65/série7 em ambos
ambientes. A administração tem pré/pós-consulta, UUID durável, trava e proteção
contra redução. Não cria contador local nem reserva número. A alteração cadastral
não abre transmissão. [Contrato de numeração](../fiscal-brasilnfe-m1/NUMERACAO.md).

`/configuracoes/integracoes/brasilnfe` registra a habilitação manual por modelo e
ambiente em eventos append-only. Salvar credenciais ou validar conexão não habilita
emissão. Alteração de identidade/configuração invalida a habilitação anterior.
Produção exige homologação do mesmo emitente/modelo: autorização, XML, impressão
e consulta posterior confirmada com chave e protocolo correspondentes. A habilitação
do ambiente não autoriza uma nota; cada envio exige confirmação específica no pedido.
Callbacks e processadores sem sessão permanecem sem adaptador operacional.

As variáveis abaixo descrevem o caminho histórico, preservado para compatibilidade.
Não são o mecanismo de ativação do fluxo reconciliado e não contornam suas guardas:

| Variável | Contrato |
| --- | --- |
| `BRASIL_NFE_ATIVO` | `1` registra o adaptador; ausente mantém sem emissor. |
| `BRASIL_NFE_TOKEN` | Token da empresa, enviado no header `Token`. |
| `BRASIL_NFE_USER_TOKEN` | Token do usuário, usado somente para validar a empresa. |
| `BRASIL_NFE_CNPJ` | CNPJ de 14 dígitos do estabelecimento confirmado. |
| `BRASIL_NFE_AMBIENTE` | `HOMOLOGACAO` ou `PRODUCAO`, sem fallback implícito. |
| `BRASIL_NFE_CONSULTA_IDENTIFICADOR_VALIDADA` | `1` após validar o contrato de consulta com o provedor. |
| `BRASIL_NFE_HOMOLOGACAO_REFERENCIA` | Referência interna da evidência da homologação técnica realizada. |
| `BRASIL_NFE_PRODUCAO_AUTORIZADA` | Ausente/desligada bloqueia envio e cancelamento reais, antes da rede. Somente ativar após autorização explícita para transmissão real. |

Não preencher a referência de homologação com um teste mock. O registro técnico
deve demonstrar os retornos contratados para ausência, autorização, rejeição,
resultado incerto, identidade da empresa, arquivos e cancelamento. Credenciais
ausentes mantêm o sistema comercial disponível e o emissor desabilitado.

O cliente vigente usa endpoints fixos em `https://api.brasilnfe.com.br/services/`,
sem redirects, com prazo máximo de dez segundos. Limites: 1 MiB para consultas,
18 MiB para envio, 14 MiB para arquivos da nota e 3 MiB para evento/cancelamento.
Não há endpoint de lote ou webhook operacional. HTTP 200 e status 1 de envelope
não equivalem a autorização. Ausência, timeout ou falha de consulta não autorizam
reenvio de uma tentativa incerta.

## Snapshot calculado

`tributacao` deve conter `apto: true`, `pendencias: []`, `emitenteCnpj`, `crt`
numérico e `documento` conforme `brasil-nfe-contrato.ts`. O adaptador não procura
NCM em cadastros atuais, não aplica alíquotas, não escolhe um regime e não aceita
um `CodTributacao` automático do provedor como substituto do motor.

O documento inclui modelo/ambiente, natureza, finalidade normal, indicador de
presença, consumidor final, mercadorias discriminadas, valores e pagamentos.
NF-e e NFC-e com entrega exigem identificação/endereço do destinatário. NCM,
origem, CFOP, CST/CSOSN e campos dos tributos já devem estar resolvidos no servidor.
O adaptador confirma `CNPJ` e `CRT` em `BuscarEmpresa` antes de transmitir/prévia;
uma divergência impede a operação afetada.

`brasil-nfe-destinatario.ts` traduz comprador e cobrança fotografados. Para PJ,
usa a razão social fiscal; para contribuinte, exige IE. Indicadores isento e não
contribuinte não recebem uma IE fictícia. Código IBGE deve existir em
`codigoMunicipio` ou `codigoIbge` no endereço fiscal e ser compatível com a UF;
o helper não consulta endereço atual nem deduz município de um CEP.
`testes/vendas/brasil-nfe-destinatario.test.ts` cobre esses limites com fixtures.

GTIN fica fotografado na linha fiscal. `EAN` recebe o código comprovado ou
`SEM GTIN`; o adaptador usa `gtinValido` para validar comprimento e dígito,
mantendo zeros iniciais como texto. Validação matemática não comprova identidade
da embalagem nem cadastro CCG. Prévia externa fictícia dos modelos 55 e 65 em
12/10/2026 demonstrou que o campo API `EAN` gera ambos `cEAN` e `cEANTrib` quando
unidade e quantidade comercial/tributável são iguais. O código de exemplo GS1
foi utilizado apenas na fixture; não classifica nenhum produto real. Conversão
de unidades fica bloqueada até ter contrato, evidências e GTINs específicos,
sem adicionar uma propriedade `EANTrib` não documentada ao payload.

`brasil-nfe-impostos.ts` traduz os impostos calculados sem perder metadados.
CST ICMS 20 envia `RedICMS` original juntamente com a base já calculada. Para
CST IBS/CBS 200, a API recebe alíquotas **nominais** e percentuais de redução;
ela gera `pAliqEfet` no XML. Prévia externa sintética comprovou que enviar a
alíquota já efetiva junto com redução aplica desconto novamente. Os valores
usados nessa prova são fixtures matemáticas e não parâmetros legais de 2027.
Metadados originais ausentes impedem transmissão, sem reconstruir alíquota a
partir de um valor efetivo arredondado.

O total do documento deve corresponder ao pedido fotografado, e as linhas devem
fechar com o mesmo total. O cadastro comercial conserva até seis casas, mas
`qCom`/`qTrib` devem ser representáveis com até 11 inteiros e quatro casas
efetivas; zeros de preenchimento são aceitos sem mudar a fotografia. Precisão
excedente bloqueia a operação, sem arredondar a quantidade. Preços fiscais
aceitam até 11 inteiros e dez casas, com conferência de representação exata
na fronteira numérica; valores finais aceitam centavos. A conversão para número JSON
ocorre somente na fronteira da API após cálculo com Decimal. O código não
arredonda entradas comerciais nem cria preço para itens sem evidência.

Antes do envio, `tributacao.previa.contexto.data` deve corresponder ao dia atual
de Brasília. Uma fotografia de outro dia exige uma nova revisão fiscal; não
reutilizar automaticamente regras anteriores à virada de regime/vigência nem
reescrever o documento antigo. Consulta e pré-visualização históricas permanecem
disponíveis. A revisão fiscal é independente da revisão comercial do pedido.

## Duplicidade, consulta e cancelamento

`IdentificadorInterno` recebe o `documentoId` imutável. Antes de um envio, o
adaptador histórico, sem registro operacional, consulta esse identificador no ambiente definido. Somente aceita
ausência quando `status=0`, `erros=[]`, `Historico=[]`, `Encontrada=false` e
`Nota=null`. A homologação confirmou também o retorno `status=1`, único erro
`BR0008` e mensagem exata com eco do identificador consultado, mantendo
`Encontrada=false`, nenhuma nota e histórico vazio. Esta exceção exige todos
esses campos; outros erros continuam inconclusivos. Falha HTTP, HTML, JSON
parcial, timeout, duplicidade ou denegação
não comprovam ausência. Um documento encontrado e autorizado é devolvido sem
nova transmissão. Histórico com várias tentativas exige conferência.

No cliente operacional vigente `brasilnfe/cliente.ts`, ConsultarNotaFiscal possui
validador exclusivo: status 1 significa consulta processada; 0 só é aceito com
estrutura coerente do exemplo oficial. Status 2, erros desconhecidos e contradições
falham. Status 1 com BR0008/Encontrada false é ausência na consulta, sem prova de
inexistência atômica ou autorização de reenvio. Principal e histórico são validados
por emitente, modelo, ambiente e identidade estável. Rejeição única comprovada
conserva chave/número/série; múltiplas tentativas exigem conferência. Envelope não
é situação fiscal nem protocolo SEFAZ. Ver o
[contrato e recuperação de 14/10](../fiscal-brasilnfe-m1/CONTRATOS.md#correção-de-consultarnotafiscal-e-recuperação-comprovada--14102026).

A documentação admite múltiplas tentativas com o mesmo identificador; portanto
o campo não garante idempotência externa. Preservar a trava, o lease, a consulta
após resultado incerto e a confirmação explícita para reenvio do plug durável.
A sequência é uma observação local crescente dentro do lease, baseada em
`ultimaSequencia+1`, e não uma sequência emitida pela Brasil NFe. Os estados
finais continuam protegidos contra regressões pela máquina de estados local.

Cancelamento usa `CancelarNotaFiscal`, com justificativa e autorização anterior
confirmadas. O resultado só é confirmado com status do evento, código SEFAZ
compatível e protocolo do evento. `protocolo` conserva a autorização;
`protocoloEvento` registra o cancelamento, sem apagar a prova original.
Cancelamento comercial e estorno financeiro continuam independentes.

**Limitação objetiva da consulta de cancelamento:** o contrato publicado de
`ConsultarNotaFiscal` não distingue inequivocamente o protocolo da autorização
do protocolo do evento de cancelamento. Se um cancelamento perder sua resposta,
a consulta que encontra nota cancelada exige conferência do evento no emissor;
não inventa protocolo, não reenvia o evento cegamente e não altera o pedido.

## Prévia, arquivos e serviços

`PreVisualizarNotaFiscal` recebe `TipoEnvio=1`, `TipoArquivo=2`, tarja sem valor
fiscal e lote `notaFiscal.nFInfos`. Não transmite à SEFAZ nem substitui uma
autorização. Sua chamada confirma a identidade da empresa e utiliza o documento
calculado no servidor. Disponibilizar bytes retornados somente em download
autenticado; nunca usar URLs públicas como prova fiscal.

Prévia externa em 12/10/2026 comprovou, para 55 e 65, `Observacao` em
`infAdic.infCpl` e `ObservacaoFisco` em `infAdic.infAdFisco`. Usar `Observacao`
para as informações complementares exigidas pela regra fundamentada, inclusive
a menção ao art. 274 quando aplicável. O provedor normaliza a pontuação final
e pode acrescentar informação do perfil; o XML não conserva igualdade literal
com o campo de entrada. Essas prévias estavam no ambiente 2, sem protocolo
de autorização, e não habilitam emissão NFC-e sem CSC comprovado.

O adaptador aceita XML até 2 MiB e PDF até 10 MiB, verifica Base64, assinatura
PDF e rejeita declarações de entidades no XML. A API documenta que o auxiliar de
NFC-e pode retornar HTML na consulta: esse conteúdo não é renomeado como PDF e
precisa de tratamento específico antes de disponibilizar tal representação.
XML/documentos já guardados no HUB continuam preservados após cancelamento.

A API oficial oferece NFS-e, mas isso não demonstra atendimento ao município,
serviço, inscrição municipal, credenciais e contrato da empresa. Este adaptador
não simula NFS-e: uma linha de serviço bloqueia apenas sua operação fiscal até
haver integração e enquadramento municipal comprovados.

## Referências e validação

- [Transmissão NF-e/NFC-e](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e).
- [Consulta, pré-visualização e arquivos](https://www.brasilnfe.com.br/api/consultas).
- [Eventos e cancelamento](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e).
- [Empresa e identidade do token](https://www.brasilnfe.com.br/api/empresas).
- [NFS-e do provedor](https://www.brasilnfe.com.br/api/nfs-e).
- [Cálculo do dígito GTIN e exemplo GS1](https://www.gs1.org/services/how-calculate-check-digit-manually).

Referências consultadas em 11 e 12/10/2026. Os testes em
`testes/vendas/brasil-nfe-adaptador.test.ts` exercitam o contrato HTTP com fixtures
fictícias: nenhum pedido, pagamento, consulta fiscal ou documento real é usado.
Registrar no fechamento o resultado da revisão final, separando estes testes
da homologação fiscal externa.

## Leiaute RTC e emissão a partir de 2027

A [NT 2026.008 v1.00](https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=3&nomeArquivo=NT_2026.008_v1.00_RTC_ValorLiquidoProduto.pdf)
introduz `vUnComLiq`, `vProdLiq` e `vProdLiqTot`. A NT distingue o valor sem
tributos do preço bruto; a partir de 2027, IBS/CBS/IS contidos em `vProd` não
devem ser somados novamente ao total. As regras I11c-20 e W01a-20 conferem,
respectivamente, líquido unitário × quantidade (tolerância de R$ 0,01) e soma
dos líquidos dos itens. A obrigatoriedade de I11c-10 consta como implementação
futura: o HUB não a apresenta como obrigação já vigente em 2026. O
[aviso ENCAT de 05/10/2026](https://dfe-portal.svrs.rs.gov.br/Nfe/Avisos/3008)
postergou os ambientes da NT para 26/10/2026 e 16/11/2026.

O perfil versionado mantém cinco caminhos comprovados da API: líquido do
produto, líquido unitário, total bruto do item, total líquido dos produtos e
total do documento. `tributacao.rtc2027` fotografa esse leiaute e os valores;
`validarSnapshotBrasilNfe` chama `validarLayoutRtc` para conferir cada campo,
quantidade e total antes de qualquer chamada externa. Metadados sem data
canônica, antecipados em 2026, sem evidência de homologação ou divergentes do
documento são bloqueados. Os caminhos configurados não podem sobrescrever
campos comerciais/tributários existentes na aplicação do leiaute.

**Impedimento atual do Lucro Presumido em 2027:** ainda não há homologação
externa comprovando os cinco campos da API Brasil NFe e o XML correspondente
ao novo leiaute. `ValorTotal` documentado pelo provedor valida `vNF`; isso não
prova suporte aos novos campos. O perfil mantém a transição desativada até
configuração/evidência técnica e confirmação cadastral do regime. Não há nomes
novos presumidos no payload real nem teste futuro transmitido nesta etapa.
Os caminhos `FixtureRtc` e percentuais dos testes são apenas dados sintéticos;
não constituem contrato do provedor ou alíquotas legais. Revalidar também a
[NT RTC vigente](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=6WfrpZYE4Ik%3D)
e os respectivos schemas antes da homologação dessa transição.

## Conteúdo de importação e FCI — 14/10/2026

A documentação pública de [EnviarNotaFiscal](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e)
inclui `Produtos[].nFCI` no exemplo do objeto. O
[MOC 7.0, Anexo I](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J+I+v4eN00E%3D),
campo I70, define o controle com 36 caracteres hexadecimais maiúsculos e hífens.
O conector usa esse nome exato. Não presume `NumeroFCI`, não gera UUID na aplicação
e não chama geração ou transmissão de FCI.

`CLASSIFICACAO.fci` armazena uma decisão opcional na versão histórica existente.
Conserva período, VI, VS, CI, completude da apuração, fontes, evidências e
fundamentação. Um número exige comprovante; uma dispensa exige fundamento e
alcance por UF e modelo. A aprovação permanece interna, explícita e auditada.
Ausência do campo não acrescenta chaves aos dados históricos nem altera seus hashes.

`tributacao/fci.ts` valida formato, limites, proporção documentada VI/VS e faixa
de CI para origens 3, 5 e 8. Não usa custo parcial ou preço do pedido como VS
normativo. A linha fiscal fotografa a decisão e a versão; somente o número
aprovado entra em `Produtos[].nFCI`. Falta de apuração, controle ou alcance
bloqueia a operação afetada. O payload legado do piloto não contorna essa exigência.
O XML recebido deve conservar o controle no produto e item fotografados antes de
ser guardado. Essa conferência não consulta o cadastro externo de FCI.

Os artigos 5º e 8º da [Portaria CAT 64/2013](https://legislacao.fazenda.sp.gov.br/Paginas/pcat642013.aspx)
e a [RC 33527/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33527_2026.aspx)
exigem conferir a condição material também em operações internas paulistas.
Optar pelo Simples ou produzir no Brasil, isoladamente, não comprova origem 0
nem dispensa de FCI. O HUB não reclassifica apurações anteriores.

Os testes `testes/tributacao/fci.test.ts` e os consumidores do motor/payload
usam valores, controles e mercadorias fictícios. Essa extensão teve validação
local; não constitui envio de FCI nem homologação externa de documento fiscal.
