# Brasil NFe — contratos públicos e limites do Marco 1

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Emissão manual por documento — 16/10/2026

O bloqueio fixo é substituído por escopo servidor de uma transmissão manual.
Sem sessão, permissão, habilitação vigente e autorização durável da fotografia,
o envio continua negado. O último POST confere documento, modelo, ambiente,
hashes, configuração, usuário e lease sob as mesmas travas da suspensão.
O cliente confere os hashes do corpo e admite um único POST no escopo.
Emissão automática, adaptador legado e callback permanecem desativados.

Homologação e produção têm documentos separados. Produção impede duplicação
entre 55/65. Timeout ou ausência na consulta nunca permitem reenvio automático.
Série/número/lote continuam automáticos no Brasil NFe; o HUB confere a série
padrão 6/55 ou 7/65 e o contador, sem reservar ou calcular outro contador.

A decisão de origem 5/FCI dispensada/SEM GTIN para Grazing para 1 é declaração
expressa do responsável, com versão, composição, alcance, executor e histórico.
Não comprova apuração de CI ou dispensa normativa. Não gera `nFCI` fictício.
Outros parâmetros propostos exigem revisão consolidada pelo usuário.
O teste 55 pode fotografar propostas sem ativá-las para produção.

O nome do destinatário 55 em ambiente 2 usa o literal do MOC 7; CPF/CNPJ e endereço
admitidos são preservados no canal protegido. XML é conferido por identidade,
protocolo, itens, quantidades, valores e ausência de FCI acrescentada pelo provedor.
Nenhuma mensagem de envelope substitui o resultado fiscal.

As seções seguintes preservam os limites e evidências das entregas anteriores.

## Contrato reconciliado — 14/10/2026

Novos documentos usam o motor v2, PERFIL com CRT explícito e classificação/regra
ativa com hash, fonte e prova de aprovação. Planos M1 permanecem históricos.
Emissão manual resolve o adaptador pela sessão/documento e habilitação durável
do ambiente; chamada sem contexto mantém null. Não registrar o adaptador antigo
por flags nem criar outra fila. Contrato e impedimentos:
[operação atual](OPERACAO-20261014.md),
[FCI e payload](../estrutura-fiscal/BRASIL_NFE.md#conteúdo-de-importação-e-fci--14102026).

O contrato HTTP não mudou para aceitar status1. Não houve nova consulta
ConsultarServicos/ConsultarNotaFiscal ou outra chamada autenticada nesta execução.
O rascunho específico de recuperação abaixo permanece **não enviado**.
Cancelamento técnico mantém aprovação própria; aprovação de envio não o libera.

Contrato vigente de decisão fiscal na Issue #8:
[AUTONOMIA-FISCAL-EXECUCAO](AUTONOMIA-FISCAL-EXECUCAO.md). A aprovação externa
obrigatória foi substituída por fundamentação verificável e aprovação interna
auditável. Menções à Confirp como requisito obrigatório nas seções históricas
abaixo descrevem o contrato antigo; não são instruções vigentes. Não apagar,
reescrever ou promover suas versões históricas à nova aprovação.

Essa mudança não altera contratos HTTP, critérios por endpoint, recuperação,
documentos, resultado incerto ou bloqueios do provedor. A pendência de status1
de ConsultarServicos continua intacta.
As fontes normativas públicas foram lidas para pesquisa; nenhuma chamada
autenticada ao Brasil NFe foi executada pela Issue #8.

Marco1 original: conferência documental em 10/10/2026. Somente páginas públicas foram lidas; nenhuma
consulta autenticada, transmissão, alteração cadastral ou homologação fiscal foi
executada. Os exemplos da suíte são sintéticos e não comprovam situação externa.

## Fontes oficiais utilizadas

- [Autenticação](https://www.brasilnfe.com.br/autentication).
- [Empresas — API 2.0](https://www.brasilnfe.com.br/api/empresas).
- [NF-e e NFC-e — API 2.0](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e).
- [Consultas — API 2.0](https://www.brasilnfe.com.br/api/consultas).
- [CSOSN versus CST](https://www.brasilnfe.com.br/conceitos-fiscais/csosn-vs-cst).
- [Numeração e séries](https://www.brasilnfe.com.br/conceitos-fiscais/numeracao-e-series).

## Autenticação e consultas de diagnóstico

A autenticação geral usa o header `Token` da empresa. A seção Empresas exige também
`UserToken` do usuário; eles têm papéis distintos. São enviados somente pelo servidor.
O conteúdo JSON usa `Content-Type: application/json`.

Os endpoints de leitura documentados usam **POST**, sem alteração da conta. Não há
GET equivalente publicado nos quatro URLs consultados. A origem fixa é
`https://api.brasilnfe.com.br`.

| Endpoint autorizado no cliente | Headers | Body | Resposta aproveitada |
| --- | --- | --- | --- |
| `/services/empresa/BuscarEmpresa` | Token e UserToken | Ausente | CNPJ string; CRT inteiro 1–4; razão social, fantasia, IE e endereço; flags de CSC de homologação |
| `/services/empresa/ConsultarServicos` | Token e UserToken | Ausente | Servicos: lista de Nome string/Ativo boolean; status inteiro 0; erros vazios; presença de avisos |
| `/services/fiscal/ConsultarNotaFiscal` | Token | IdentificadorInterno, TipoAmbiente 2, ModeloDocumento 55/65, RetornarArquivos false | Encontrada boolean; Nota; Historico; status 0; erros vazios; presença de avisos |

`BuscarEmpresa` devolve um objeto direto, inclusive `Token` e configurações que podem
conter outras senhas/CSCs. O cliente extrai exclusivamente uma lista explícita de
campos e flags; não retorna nem persiste a resposta completa. CNPJ de resposta deve
ser confrontado no diagnóstico com o cadastro da empresa do HUB. A ausência do
UserToken torna as duas consultas de Empresas indisponíveis antes de qualquer HTTP.

`VerificarCertificado` é documentado como POST da seção Empresas, com
`Interno:true` para conferir o certificado cadastrado. A documentação mistura
descrições legadas de status com o schema boolean e exemplos de sucesso com erro
preenchido. O Marco 1 não implementa essa chamada nem envia senha/arquivo. Certificado
e pré-requisitos fiscais continuam pendentes, independentemente do acesso autenticado.

## Consulta estável de resultado e histórico

`IdentificadorInterno` recebe o `documentoId` imutável do HUB. O cliente sempre envia
ambiente 2 e modelo explícito, e a empresa é delimitada pelo Token. Não usa ambiente
ou modelo 0 (qualquer), nem consulta número/série como substituto dessa identidade.

O contrato de Consulta Nota Fiscal admite várias tentativas com o mesmo identificador:
`Nota` contém a mais recente, `Historico` contém as demais. São conferidos os dois
conjuntos. A lista permitida conserva modelo, identificador, ambiente, status,
Emitida, chave, número, série, protocolo, código de resposta e datas; elimina arquivos,
destinatário, descrições, erros e avisos brutos. Número e protocolo são strings; literais
inteiros int64 do JSON são preservados antes da conversão do documento.

Envelope parcial, escopo divergente, timeout, falha de autenticação, erros de serviço
e JSON inválido falham explicitamente. `Encontrada:false` exige contrato válido,
sucesso e ausência de Nota/Historico. Isso é evidência de consulta e **não autoriza
reenvio**: o contrato público não comprova unicidade externa, consistência após timeout,
sequência monotônica de eventos nem atomicidade consulta/emissão.

`ConsultarStatusSefaz` consulta sempre produção segundo a documentação, por isso não
integra a lista permitida. O Marco 1 não consulta notas recebidas nem períodos reais.

## Emissão futura: base tipada e decisões fiscais

Complemento implementado posteriormente: [montagem e pré-validação locais do Marco2](MARCO-2-PREPARACAO.md).
Esta implementação não acrescenta endpoints ao cliente nem altera a aceitação de
ConsultarServicos. Status são interpretados pelo endpoint/campo: envelope de consulta,
situação da nota e futuro ReturnNF.Ok/CodStatusRespostaSefaz não são uma regra global.
Ainda não há normalização operacional de transmissão/cancelamento Brasil NFe: os
ciclos da suíte usam respostas normalizadas sintéticas, sem inventar sequência externa.

`EnviarNotaFiscal` é o POST de transmissão individual dos modelos 55 e 65 e usa Token;
a rota individual não dispara webhook. Esse endpoint não existe no cliente permitido
do Marco 1. O envelope futuro inclui ambiente/modelo, identificador, natureza,
finalidade, presença, consumidor final, destinatário, produtos, pagamentos e campos
condicionais. A página não marca toda obrigatoriedade dos objetos aninhados; exemplos
não substituem confirmação do contrato com o fornecedor.

Frete/desconto globais substituem valores dos itens no processamento do fornecedor;
evitar duplicação do rateio. `ValorTotal` é total esperado para validação. `EnviarEmail`
deve permanecer false. Série, número e lote omitidos permitem controle automático
externo; a escolha de controle pertence ao próximo marco e não é alterada aqui.

Confirp deve definir, por produto e operação: NCM, aplicabilidade de CEST, CFOP,
origem, CSOSN/CST, alíquotas, bases, ST/FCP/DIFAL quando pertinentes, PIS/COFINS/IPI,
IBS/CBS quando exigidos, unidade tributável/conversão, regras de frete/desconto,
pagamentos, natureza, finalidade, presença e consumidor final. O CRT confirmado
determina CSOSN para 1/4 ou CST para 2/3. Não adotar códigos ou alíquotas dos exemplos.

## Proteções implementadas no transporte

`src/lib/fiscal-saida/brasilnfe/cliente.ts` importa `server-only`. Não aceita origem,
endpoint ou método arbitrários: expõe somente as três consultas da tabela. Não possui
emissão, cancelamento, inutilização, atualização de certificado, cadastro, assinatura,
numeração ou agendamento. Não importa banco, estoque, financeiro ou notas recebidas.

- HTTPS fixo, redirects rejeitados e cache desabilitado.
- Prazo de 10 segundos incluindo a leitura, menor que o lease local de 120 segundos.
- Limite real de 1 MiB, além da conferência de Content-Length.
- Exigência de HTTP 200, JSON UTF-8 válido e tipos/formatos explícitos.
- Produção bloqueada na entrada da consulta por documento e nas respostas.
- Nenhuma retentativa automática: falha permanece incerta.
- Credenciais em campos privados da classe, sem serialização pública.
- Falhas com códigos e mensagens locais fixos, sem body/headers/cause externa.
  A projeção restrita de mensagens saneadas de ConsultarServicos no incremento
  abaixo é transitória; não integra persistência, auditoria ou sucesso operacional.
- Avisos indicados apenas por flag; nenhuma mensagem bruta do fornecedor é devolvida.
- Transporte e prazo injetáveis exclusivamente no ambiente da suíte de testes.

Salvar configuração não chama este cliente. Validar conexão é uma ação administrativa
separada com autorização no servidor. Acesso autenticado não confirma pré-requisitos,
homologação fiscal ou liberação de produção.

## Arquivos: base local ainda sem download operacional

`arquivos.ts` valida Base64 estrito e limites de XML2MiB/PDF10MiB. XML exige
`nfeProc` no namespace oficial, autorização100/150 e coerência entre chave,
emitente, modelo, ambiente, protocolo, número e série. Não afirma verificar a
assinatura criptográfica da SEFAZ. PDF exige marcadores e leitura estrutural pelo
PDF.js já existente no HUB, sem execução de JavaScript, com até100 páginas e
prazo15s. HTML, inclusive disfarçado com marcadores PDF, é rejeitado; HTML de NFC-e
não é salvo como PDF. A fila não baixa nem armazena documentos neste marco, pois
`obterDocumentos` permanece explicitamente bloqueado no adaptador.

## Pendências para habilitar homologação em outro marco

1. Disponibilizar Token e UserToken por meio seguro e executar somente o diagnóstico
   administrativo de leitura. Registrar separadamente identidade, acesso, serviços
   contratados e requisitos ainda não conferidos.
2. Confirmar certificado/CSC e contrato integral com o Brasil NFe, sem substituir
   certificado, modificar assinatura ou alterar séries/numeração neste marco.
3. Obter confirmação do fornecedor sobre idempotência, múltiplas tentativas,
   consistência de consulta após timeout, estados e recuperação de resultado incerto.
4. Receber e validar as definições tributárias da Confirp com massa sintética aprovada.
5. Definir normalização de sequência/evento e validação dos arquivos reais. Autenticação
   e contrato do callback permanecem pendentes; emissão individual não depende dele.
6. Autorizar explicitamente o próximo marco antes de qualquer transmissão de
   homologação. Liberação de produção exige etapa posterior própria.

## Evidência da suíte

`testes/fiscal-saida/brasilnfe-cliente.test.ts` usa somente transportes simulados.
Em 10/10/2026, 45 testes passaram com `npx vitest run
testes/fiscal-saida/brasilnfe-cliente.test.ts --maxWorkers=1`; lint dos arquivos do
cliente/tipos/teste passou. No Windows, o TEMP da sandbox inicialmente impediu rename
do cache de transformação; a execução concluída usou TEMP/TMP em `.tmp-vitest-cliente`
ignorado dentro do worktree. Não houve consulta fiscal externa nessa verificação.

## Histórico de reconfirmação e diagnóstico administrativo — Marco 1.1

Esta seção conserva a evidência anterior, até a configuração versão6. O contrato
vigente de serviços e o escopo autorizado estão na seção seguinte; novos resultados
externos devem ser registrados separadamente em [TASKS](TASKS.md).

Em 10/10/2026, a página oficial [Empresas](https://www.brasilnfe.com.br/api/empresas)
foi conferida novamente. BuscarEmpresa/ConsultarServicos continuam documentados
como POST com Token e UserToken, sem body. Objeto direto de empresa e serviços
Nome/Ativo são compatíveis com o cliente existente; nenhuma flexibilização de
validação foi necessária na conferência documental.

Na conferência inicial, os nomes do catálogo não foram identificados na seção
Ativar Assinatura. Essa interpretação foi revista na rechecagem vigente abaixo.
`Ativo` não distingue habilitação por ambiente. O nome retornado não comprova
habilitação do modelo55/65 em homologação. Exemplos de status0 com erros preenchidos
não são sucesso confiável: o cliente continua exigindo erros vazios.

Aplicação real local e banco administrativo exclusivo preparados conforme
[AMBIENTE-LOCAL](AMBIENTE-LOCAL.md). Na preparação inicial, Token e UserToken ainda
não haviam sido fornecidos. **Diagnóstico ainda não realizado naquele momento**: autenticação,
correspondência do emitente retornado e serviços55/65 não confirmados. A visão geral
autenticada do painel foi somente fonte da identidade esperada; suas mensagens
“nenhum serviço ativo” e “sem certificado digital” não substituem as duas consultas.
Certificado/CSC não verificados; homologação fiscal não realizada; produção bloqueada.

#### Continuação com credenciais e formato observado

O usuário salvou ambas as credenciais exclusivamente na aplicação real local e
acionou Validar conexão na sua sessão administrativa. O cliente rejeitou inicialmente
BuscarEmpresa por formato de CNPJ. A indicação por enum fixa, sem nenhum valor
externo, confirmou em10/10/2026 às19:06 Brasília a máscara completa
`00.000.000/0000-00`. A documentação publica string com14 dígitos; a API real também
devolveu essa máscara. Só essa forma exata é normalizada para a identidade canônica,
preservando zeros e a comparação com o cadastro esperado inalterado. Não aceitar
CNPJ numérico, CPF, espaços ou pontuação arbitrária; CRT e demais formatos continuam
sujeitos às validações originais. Nenhuma resposta bruta foi conservada.

O diagnóstico inicial falhou de forma segura: acesso não confirmado e serviços não
consultados. Após a correção, o usuário repetiu a ação em10/10/2026 às19:10:32 Brasília
(versão6). BuscarEmpresa retornou dados válidos e o CNPJ canônico coincidiu com o
esperado: somente essa igualdade permite iniciar ConsultarServicos no código.
ConsultarServicos foi tentada e falhou como EXTERNO; a causa específica não foi
conservada e não deve ser inferida como ausência de serviços/credencial inválida.

| Evidência externa real | Resultado separado |
| --- | --- |
| Configuração | Token e UserToken configurados, inputs vazios na leitura |
| Autenticação | Confirmada exclusivamente pelo retorno válido de BuscarEmpresa |
| Emitente | CNPJ correspondente ao esperado, cadastro local inalterado |
| Serviços NF-e55 e NFC-e65 | Não confirmados: ConsultarServicos indisponível |
| Pré-requisitos | Não conferidos; endereço local incompleto; CRT/IE/regras fiscais pendentes |
| Certificado/CSC | Não verificados neste diagnóstico; nenhum certificado/CSC alterado |
| Homologação fiscal | Não realizada |
| Produção/transmissão | Bloqueadas |

Na versão6, o diagnóstico agregado registrou FALHOU com acessoAutenticado=true:
BuscarEmpresa concluiu e ConsultarServicos falhou. A continuação vigente substitui
essa apresentação por CONECTADO_SERVICOS_PENDENTES para novas tentativas
equivalentes, preservando as evidências por consulta. A autenticação histórica não
comprova serviços ativos nem validação completa. O painel indicar “nenhum serviço
ativo” e a API de serviços falhar não comprovam a situação da contratação.
Evidência final e auditoria saneada: [TASKS](TASKS.md).

### Pendências externas organizadas

| Responsável | Evidência/definição necessária | Efeito neste marco |
| --- | --- | --- |
| Usuário | Token e UserToken já salvos; revisar solicitação ao fornecedor e complementar cadastro quando houver fonte confiável | Não é necessário reenviar/expor as credenciais; não há impedimento de autenticação em BuscarEmpresa |
| Brasil NFe | Explicar falha de ConsultarServicos após BuscarEmpresa válido e emitente correspondente; confirmar endpoint/contrato/catálogo de serviços | Não inferir “nenhum serviço ativo” nem forçar sucesso em resposta incerta |
| Brasil NFe | Conferir vínculo da contratação com o emitente e habilitação API55/65 por ambiente; explicar nomes/escopo dos serviços | Não inferir habilitação pela contratação ou por Ativo isolado |
| Brasil NFe | Orientar certificado/CSC pendentes, sem alteração externa neste marco | Pré-requisitos e homologação permanecem pendentes |
| Brasil NFe | Garantia de não duplicação, múltiplas tentativas, consistência após timeout e recuperação de resultado incerto | Adaptador operacional e qualquer reenvio permanecem bloqueados |
| Confirp | CRT/IE e regras gerais por operação; classificação/tributos/unidades por produto; pagamentos e particularidades NFC-e | Matriz fiscal da SPEC deve ser formalmente definida antes da homologação |

Não há necessidade de definição tributária para executar BuscarEmpresa/ConsultarServicos.
Não foram inventados códigos ou alíquotas. A entrada do Marco2 exige essas definições,
contrato de recuperação seguro, massa sintética e autorização explícita de homologação.

### Rascunho histórico ao fornecedor — não enviado

Preparado após conferir autenticação e identidade; a consulta de serviços não concluiu.
**Não enviado**; não pede ativação, assinatura, contratação ou cobrança. Nenhuma
credencial/identidade real é incluída no texto versionado.
O texto permanece histórico e aguarda o diagnóstico granular da continuação
vigente antes da revisão final pelo usuário; não há autorização de envio externo.

> Olá, equipe Brasil NFe. A contratação de NF-e e NFC-e foi concluída, mas o painel
> da empresa selecionada informa que não há serviço ativo. Nosso diagnóstico
> exclusivamente de leitura, em 10/10/2026 às 19:10 Brasília, concluiu BuscarEmpresa
> com autenticação e CNPJ correspondentes ao emitente esperado. ConsultarServicos
> não pôde concluir; nenhuma resposta bruta foi armazenada. Solicitamos esclarecer
> essa falha e confirmar o contrato do endpoint POST /services/empresa/ConsultarServicos,
> incluindo nomes e significado do catálogo de serviços. Pedimos também conferir o
> vínculo da contratação com o emitente e confirmar acesso à API para os modelos
> 55 e 65, indicando os ambientes habilitados e a identificação desses serviços em
> ConsultarServicos. Precisamos também de orientação sobre certificado e CSC ainda
> pendentes, sem alterar essas configurações agora. Para a futura homologação,
> pedimos esclarecer a garantia de não duplicação por IdentificadorInterno, o
> tratamento de múltiplas tentativas e a recuperação segura após timeout, incluindo
> consistência de ConsultarNotaFiscal e leitura da nota principal/histórico.
> Nenhuma emissão ou alteração externa foi executada nesta etapa.

## Contrato vigente de ConsultarServicos — rechecagem pública em 10/10/2026

Fonte: [Empresas — Consultar Servicos e Ativar Assinatura](https://www.brasilnfe.com.br/api/empresas).
Na extração consultada, Consultar Servicos ocupa linhas1852–1918; o parâmetro
Servicos de Ativar Assinatura, linhas1622–1626. Não foi chamada a API autenticada
nesta conferência documental.

| Elemento documentado | Contrato utilizado |
| --- | --- |
| Rota/método | POST `https://api.brasilnfe.com.br/services/empresa/ConsultarServicos` |
| Cabeçalhos | Token da empresa, UserToken do usuário; Content-Type JSON conforme visão geral |
| Corpo | Ausente; não há Request Body publicado e o exemplo não envia dados |
| Resposta | Servicos com Nome string/Ativo boolean; avisos string[]; erros object[] com codigo/descricao/correcao |
| Sucesso | status inteiro0 e erros vazios; avisos não bloqueantes |
| Catálogo pertinente | Nome combinado **NF-e/NFC-e**, distinto de **Sincronizar Docs** |

ConsultarServicos vincula Nome ao catálogo de Ativar/Cancelar Assinatura. O
fornecedor publica o item combinado; não há dois contratos independentes a inferir
por regex. Ativo não contém ambiente. O exemplo mistura status0 com erros
ilustrativos; erros preenchidos continuam impedindo considerar sucesso.

Não há enum de códigos de autenticação/negócio publicado para esse método. Não
inferir credencial inválida de HTTP403 ou de texto livre. Status desconhecido,
JSON/estrutura inválidos e falhas HTTP/rede/TLS/timeout exigem classificação local
saneada, sem persistir o corpo, a mensagem, a causa ou códigos arbitrários recebidos.
A autorização transitória delimitada adiante não muda esse contrato de persistência.

Na base `d68558b8`, `cliente.ts` já enviava rota/método/headers/corpo compatíveis,
mas vários insucessos convergiam para EXTERNO. `configuracao.ts` reconhecia nomes
por regex e tratava a falha de serviços como situação geral FALHOU mesmo com Busca
confirmada. O incremento exige resultados separados e diagnóstico parcial quando
somente serviços ficam indisponíveis; isso não transforma falha em sucesso.

O escopo definitivo é emissão NF-e/NFC-e e suas próprias emissões futuras.
Sincronizar Docs, sincronização/distribuição/manifestação/importação de recebidas
ficam fora da integração; a SEFAZ existente permanece intacta. A API de serviços
indisponível não impede continuar a preparação administrativa. Confirmação pelo
painel/suporte, quando obtida, deve identificar origem/data sem ser apresentada
como retorno API validado. Nenhuma dessas fontes remove requisitos Confirp,
certificado/CSC, recuperação segura ou bloqueios de transmissão/homologação/produção.

Os resultados históricos das versões6/7 não informavam a causa específica. A nova
ação administrativa foi executada pelo usuário e conferida pelo registro saneado
da versão8, sobre o código `9f6f8475`: BuscarEmpresa concluiu com acesso e emitente
confirmados às20:13:58.064 Brasília; ConsultarServicos falhou às20:13:58.139 Brasília
de10/10/2026 (23:13:58.139 UTC), com HTTP200, categoria `NEGOCIO`, etapa
`SERVICOS_ENVELOPE`. Status/código externos não foram retidos pela lista permitida;
não afirmar que estavam ausentes na resposta. Evidência detalhada: [TASKS](TASKS.md).

O JSON chegou e foi interpretado como objeto, mas seu envelope apresentou um
indicador negativo antes da validação do catálogo. A categoria pode decorrer de
`Error` não vazio, `erros` preenchido, `status=false` ou status inteiro diferente
de0; o registro saneado não conserva qual deles ocorreu. Os dois padrões
`Error`/`status=false` são recusas conservadoras do cliente, não ampliação do
contrato de sucesso publicado para ConsultarServicos. Não atribuir a falha a
transporte, timeout, HTTP401/403, token inválido ou assinatura inativa. O motivo
de negócio exato e o contrato dos códigos seguros ainda dependem de esclarecimento
do fornecedor; não foi demonstrada incompatibilidade adicional do cliente.

### Rascunho da tentativa versão8 — não enviado

Texto atualizado com a tentativa autenticada, para revisão do usuário. Não solicita
ativação, cobrança, assinatura, alteração de configuração ou compartilhamento de
credenciais/respostas brutas.

> Olá, equipe Brasil NFe. Contratamos NF-e e NFC-e e estamos preparando
> exclusivamente a emissão desses documentos. Em 10/10/2026 às 20:13:58 de Brasília
> (23:13:58 UTC), BuscarEmpresa confirmou autenticação e CNPJ do emitente esperado.
> Na sequência, POST https://api.brasilnfe.com.br/services/empresa/ConsultarServicos,
> com os cabeçalhos Token e UserToken e sem corpo, retornou HTTP200 com indicador
> de erro de negócio no envelope JSON. Nosso diagnóstico registrou categoria local
> NEGOCIO e etapa SERVICOS_ENVELOPE às20:13:58.139; o catálogo NF-e/NFC-e não foi
> confirmado. Por segurança, não conservamos corpo bruto, mensagens externas ou
> códigos sem enumeração documentada. Podem localizar essa requisição e esclarecer
> o motivo da recusa? Solicitamos o contrato dos códigos de falha e confirmar se há
> permissão adicional para essa operação, o vínculo da contratação com o emitente,
> o acesso à API nos ambientes disponíveis e a identificação do serviço combinado
> “NF-e/NFC-e”. Não estamos afirmando token incorreto ou assinatura inativa. Não
> utilizaremos Sincronizar Docs. Nenhuma emissão, ativação de serviço ou alteração
> externa foi executada ou solicitada nesta etapa.

## Incremento implementado — extração restrita do motivo

O usuário autorizou projeção transitória e saneada dos erros de ConsultarServicos
para sua sessão administrativa. A implementação, os testes focados e a regressão
sintética foram concluídos e o build final foi aprovado. A versão9, registrada
abaixo, acrescenta a nova consulta autenticada. A evidência real da versão8 acima é histórica: o texto
e o código específicos não foram conservados naquela tentativa, e a autorização
nova não permite reconstruí-los nem inventar resultado externo.

### Tipos públicos e lacunas rechecados

Fonte novamente consultada: [Empresas — Consultar Servicos](https://www.brasilnfe.com.br/api/empresas),
extração pública de10/10/2026, linhas1887–1914. A página publica `erros` como
`object[]`, menciona os filhos `codigo`, `descricao`, `correcao` e exemplifica os
três com strings. Não declara tipos individuais, marcação `required`, nulabilidade
ou enumeração desses filhos. Strings presentes são, portanto, uma política local
de extração segura; campos ausentes ou de outros tipos não devem ser convertidos
em texto arbitrário nem usados para aceitar o contrato operacional. A projeção
também pode mostrar código numérico limitado como valor observado sem semântica
validada; isso é política local, não ampliação do contrato de sucesso do fornecedor.

A capitalização dessa resposta é `erros`, `avisos`, `status`; `Error` com maiúscula
e `status` boolean aparecem nos esquemas de outros métodos da seção Empresas,
sem publicação como contrato de ConsultarServicos. Seu reconhecimento continua
apenas como sinal negativo conservador. Os headers Token/UserToken têm exigência
explícita; para o status inteiro, somente0 é documentado como sucesso.

### Regra de projeção e persistência

- Extrair somente os campos permitidos, por nome exato, da consulta de serviços.
  Eventual fallback de `Error` deve identificar essa origem e manter a falha;
  não retornar envelope, mensagens de outras consultas ou propriedades extras.
- Sanear antes de devolver ao cliente: até5 erros, código de até48 caracteres,
  texto de até300 caracteres. Código/status numéricos exigem inteiro seguro com
  valor absoluto até999999. Campos acima dos limites são suprimidos inteiros.
  Credenciais, certificado/CSC, dados pessoais, HTML/scripts e conteúdo opaco ou
  codificado não atravessam a projeção; variantes de credenciais conhecidas também
  são conferidas. Uma frase técnica pode conservar contexto com `[suprimido]` em
  trechos removidos; os campos parcialmente saneados recebem indicador de supressão.
  Cadeias compostas de código exigem segmentos técnicos ou prefixo numérico curto,
  sem incluir palavras desconhecidas como nomes ou segredos arbitrários.
- Devolver o detalhe somente pelo resultado da ação administrativa autorizada,
  vinculado à tentativa atual. A tela mostra texto escapado e não o recupera de
  DTO de leitura, banco, evento, log, arquivo ou armazenamento do navegador.
  WeakMap servidor guarda só a projeção congelada, com consumo único e TTL5 minutos;
  a tela usa o mesmo limite e invalida por nova ação, credencial editada, perda de
  permissão, versão externa ou saída da página. Não coletar mensagem em falhas de
  transporte/HTTP/parser, BuscarEmpresa ou ConsultarNotaFiscal.
- Persistir apenas indicadores derivados fixos e metadados da lista permitida.
  Não persistir `codigo`, `descricao`, `correcao` ou `Error` observados, nem incluí-los
  em captura, Git, comentário ou documentação da operação real. Status de
  processamento observado é metadado separado de `codigo`: valor limitado,
  tipo/estado coerentes e supressão de credencial refletida, sem semântica validada.
- Separar **código observado sem semântica validada** de **código operacional
  documentado**. Exibir um código desconhecido saneado não cria enum de aceitação,
  não identifica sozinho a causa e não altera acesso, contratação ou homologação.

Continua obrigatório validar o envelope antes do catálogo; erros preenchidos,
status diferente de0 ou resposta inválida não autorizam sucesso/reenvio. Status
boolean false é observado como falha conservadora, nunca convertido em inteiro0.
O detalhe saneado pode acompanhar um envelope inválido, mantendo sua rejeição.
Os limites de produção/transmissão, os domínios fora do escopo e o rascunho não enviado
permanecem inalterados. A consulta real da versão9 abaixo foi executada pelo usuário,
após as verificações locais. Esta conferência pública não fez chamada autenticada.

### Evidência real da versão9 — diferença isolada no status

O usuário confirmou um único clique em Validar conexão. A tela transitória mostrou
Error ausente, quantidade de erros0, itens0 e nenhum campo suprimido. Conferência
SQL local somente leitura dos metadados permitidos registrou:

| Evidência de10/10/2026 | Resultado |
| --- | --- |
| Início | 20:54:22.671 Brasília / 23:54:22.671 UTC |
| BuscarEmpresa | Concluída às20:54:23.522 Brasília / 23:54:23.522 UTC |
| Acesso/emitente | Confirmados nesta mesma tentativa; cadastro e credenciais preservados |
| ConsultarServicos | Falhou às20:54:23.574 Brasília / 23:54:23.574 UTC |
| Metadados | HTTP200; categoria NEGOCIO; etapa SERVICOS_ENVELOPE |
| Status observado | Inteiro1; tipo NUMERO; estado NUMERO_NAO_ZERO; indicador STATUS_NUMERICO_NAO_ZERO |
| Campos | Ausente ERROR; nenhum campo suprimido; lista de erros vazia no detalhe transitório |
| NF-e/NFC-e | Não confirmados; sem inferir serviço inativo, token incorreto ou assinatura ausente |

A causa observada da rejeição local está isolada: status numérico1, enquanto o
contrato publicado define0 como sucesso. Não há descricao/codigo/correcao para
extrair de uma lista de erros vazia; sua falta não decorreu do saneamento. O significado
de1 não é documentado e não foi presumido como sucesso ou falha fiscal específica.
Não relaxar o parser, reinterpretar1 como0, repetir a consulta ou solicitar novos
tokens para contornar a pendência. A evidência veio da ação administrativa, da tela
vista pelo usuário e de metadados SQL permitidos, sem conservar resposta bruta.
Nenhuma imagem real desta tentativa foi copiada para o Git.

### Rascunho vigente ao fornecedor — não enviado

Substitui o rascunho histórico da versão8 para revisão do usuário. Nenhuma mensagem
foi enviada, nenhuma credencial/identidade real foi incluída e nenhuma alteração
externa está solicitada.

> Olá, equipe Brasil NFe. Contratamos NF-e e NFC-e e estamos preparando a emissão
> desses documentos no HUB. Em10/10/2026, BuscarEmpresa confirmou autenticação e
> CNPJ do emitente esperado às20:54:23.522 de Brasília (23:54:23.522 UTC).
> Na sequência, POST https://api.brasilnfe.com.br/services/empresa/ConsultarServicos,
> com Token/UserToken e sem corpo, retornou HTTP200 às20:54:23.574 de Brasília
> (23:54:23.574 UTC). O status observado foi inteiro1; a lista de erros estava vazia
> e Error ausente, sem conteúdo suprimido no detalhe. A documentação define0 como
> sucesso, e nosso cliente manteve a consulta de serviços não confirmada.
> Qual é o significado de1 nesse método? Esse retorno corresponde a qual situação,
> e qual é o contrato completo dos status/erros de ConsultarServicos? Solicitamos
> confirmar o vínculo da contratação com o emitente, permissões da API e identificação
> do serviço combinado NF-e/NFC-e, incluindo os ambientes habilitados. Sincronizar
> Docs está fora deste projeto; a integração de notas recebidas permanece na SEFAZ
> existente. Pedimos orientação sobre os pré-requisitos de certificado/CSC, sem
> substituir ou alterar sua configuração nesta etapa. Para a futura homologação,
> precisamos esclarecer garantias de não duplicação por IdentificadorInterno,
> múltiplas tentativas e recuperação após resultado incerto/timeout, com consistência
> de ConsultarNotaFiscal e leitura da nota principal/histórico. Nenhuma emissão,
> transmissão ou alteração externa foi executada ou está solicitada agora.

## Base técnica preservada — implementação do Marco 2 em11/10/2026

Esta seção complementa a evidência histórica acima. Não altera a interpretação
de ConsultarServicos nem apresenta testes sintéticos como homologação.
Implementação e estados reais detalhados em
[MARCO-2-IMPLEMENTACAO](MARCO-2-IMPLEMENTACAO.md); primeira execução depende dos
[cenários e autorização específica](HOMOLOGACAO-CENARIOS.md).

### Operações implementadas, ainda bloqueadas na aplicação

| Método | Escopo implementado | Aceitação local e proteção |
| --- | --- | --- |
| EnviarNotaFiscal | POST individual55/65, Token, corpo do construtor aprovado, ambiente2, EnviarEmail:false | ReturnNF.Ok, ambiente, cStat100/150 e identidade/protocolo coerentes; erro/ambiguidade não são sucesso |
| ConsultarNotaFiscal | Própria emissão por IdentificadorInterno, ambiente2 e modelo; principal+histórico | Contrato exclusivo corrigido em 14/10: envelope1 processado; 0 compatível somente com estrutura coerente do exemplo publicado; 2/erro/contradição falham. BR0008 com Encontrada:false mantém conferência; nunca autoriza reenvio. Envelope não é Nota.Status. |
| ObterArquivoNotaFiscal | Chave da própria nota autorizada; FileType1/2, TipoDocumentoFiscal1 | Resposta escalar Base64 estrita; XML vinculado, PDF estrutural ou HTML65 no recorte estático seguro |
| CancelarNotaFiscal | Chave/protocolo autorizados, justificativa, ambiente2, tipo0 | Status do evento1 e cStat135 não bastam sem protocolo/identidade do XML; evento incerto não é repetido |
| ObterArquivoEvento | Chave própria, NuProtocolo do evento e TipoArquivo1 | Conferir procEventoNFe, evento110111, emitente, ambiente, chave, sequência e protocolo |
| VerificarCertificado | Token+UserToken; body somente Interno:true | status booleantrue, Error vazio, Expirado boolean e DtExpiracao na forma documentada; sem senha/arquivo ou alteração externa |

Fontes públicas reconferidas:
[NF-e/NFC-e](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e),
[Consultas](https://www.brasilnfe.com.br/api/consultas),
[Eventos](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e) e
[Empresas](https://www.brasilnfe.com.br/api/empresas).
Os exemplos de certificado/cancelamento contradizem seus próprios campos de erro;
o cliente não usa essas contradições para ampliar a aceitação. A confirmação
concreta do fornecedor ainda é necessária nos pontos identificados.

Os estados são interpretados por endpoint e campo. Denegação e duplicidade não
são rejeições comuns que liberam outra emissão. Ordem LOCAL_OBSERVACAO é atribuída
sob a trava/lease da fila e não finge sequência externa. Protocolo de cancelamento
fica separado do protocolo de autorização. Resultado incerto vai à conferência
manual; porta técnica de autorização e registro operacional seguem bloqueados.

### Evidência autenticada de11/10/2026 — certificado e CSC

O painel autenticado mostrou NF-e/NFC-e ativo e certificado A1 válido até07/11/2026.
CSC e identificador estavam ausentes nos dois ambientes, conforme presença de
campos observada por DOM booleano; nenhum valor foi capturado. A liberação de
homologação foi informada pelo usuário, sem alegar retorno da API.

Uma única ação administrativa **Conferir certificado e CSC** iniciou a rodada
às21:09:38.913 de Brasília / **2026-10-12T00:09:38.913Z**:

| Consulta/estado | Resultado saneado |
| --- | --- |
| BuscarEmpresa | Emitente correspondente; IE/CRT presentes; endereço externo incompleto |
| VerificarCertificado Interno:true | HTTP200; categoria CONTRATO; campo CERTIFICADO_DATA; data não confirmada |
| Valor rejeitado de DtExpiracao | Não conservado; tipo/formato real não inferidos |
| Cadastro local | Endereço estruturado ausente; identidade esperada preservada |
| Regras Confirp | Zero regras no banco administrativo; nenhuma aprovação presumida |
| ConsultarServicos | Não executado nesta rodada; HTTP200/status inteiro1/erros vazios de10/10/2026 preservados como pendência histórica |
| Homologação/emissão | Nenhuma transmissão; produção e execução operacional bloqueadas |

A declaração de validade do painel não substitui uma resposta válida do método
de certificado. Não alterar o certificado para fazer uma data passar nem aceitar
um formato presumido. A próxima leitura depende de esclarecimento do contrato
ou correção comprovada, sem repetição automática.

### Rascunho vigente ao fornecedor — implementação do Marco 2, não enviado

Substitui a solicitação histórica para revisão do usuário. Não contém CNPJ real,
credenciais, payload ou resposta bruta e não solicita ativação/alteração externa.

> Olá, equipe Brasil NFe. O serviço NF-e/NFC-e consta ativo no painel autenticado
> e o certificado A1 consta válido até07/11/2026, conforme conferência em11/10/2026.
> O usuário informou a liberação de homologação. Ainda não transmitimos documentos.
>
> Em uma ação administrativa de leitura iniciada em11/10/2026 às21:09:38.913 de
> Brasília (2026-10-12T00:09:38.913Z), BuscarEmpresa confirmou o emitente esperado.
> Na sequência, POST /services/empresa/VerificarCertificado com body Interno:true
> retornou HTTP200, mas a resposta não passou na validação do campo DtExpiracao.
> A documentação publica string date, e o cliente exige uma data civil válida no
> formato YYYY-MM-DD. Não conservamos o valor recebido nem inferimos sua forma.
> Qual é o contrato efetivo desse campo no certificado interno? Poderiam confirmar
> tipo/formato e fornecer um exemplo sintético compatível, sem dados ou segredos?
>
> Permanece a pendência de10/10/2026: ConsultarServicos retornou HTTP200, status
> inteiro1 e erros vazios, enquanto a documentação define0 como sucesso. Não
> repetimos a consulta nem consideramos1 equivalente a0. Qual é o significado de1
> nesse método? O serviço ativo do painel é mantido como evidência independente.
>
> Para a futura homologação, precisamos do caminho de recuperação de NuProtocolo
> do cancelamento quando sua resposta se perde. ObterArquivoEvento exige esse
> protocolo, e ConsultarNotaFiscal não documenta sua descoberta. Como recuperar
> o evento da própria emissão sem repetir cancelamento? Solicitamos também as
> garantias de consistência/latência, múltiplas tentativas e não duplicação por
> IdentificadorInterno. Timeout ou ausência não serão usados para autorizar reenvio.
>
> CSC/identificador não constam preenchidos nos dois ambientes. Pedimos orientação
> sobre os requisitos para NFC-e na UF/ambiente aplicáveis, sem gerar, substituir ou
> expor segredos. Sincronizar Docs não integra este projeto: notas recebidas seguem
> na integração SEFAZ existente. Não executar alterações externas por esta mensagem.

## Piloto55 — representação local e dúvidas materiais,12/10/2026

Continuação de `e5865e17`: [revisão adicional do piloto](PILOTO-55-CLASSIFICACAO.md#revisão-adicional-da-issue11--continuação-de-e5865e17).
Opção federalSimples2026 comprovada, caixa semGTIN declarada e endereço mínimo
salvo somente no banco administrativo isolado. CRT1/2 ainda depende da situação
estadual de sublimite; não foi escolhido automaticamente. CEST/ST ePIS/COFINS49
têm propostas específicas fundamentadas, sem aprovação humana fabricada.

GTIN tem validação comum de comprimentos/dígito/zeros, conservando strings e
declaração explícitaSEM GTIN. Ausência não vira código. Nova aprovaçãoITEM/GRUPO
recusa `classificacoes.ean` inválido, dentro da transação/autorização existentes;
propostas/versões históricas e hashes preservados. Montagem aplica a proteção
também aos modelos55/65 e não copia o código do grupo/insumo. A constatação de
atribuição à unidade final continua no fundamentoUNIDADE, separada de checkdigit.

IPI permanece bloqueado: preenchimento do grupo, CST e cEnq do industrialSimples
precisam de decisão fiscal específica e representação técnica correspondente.
Não inferir51/53/99/999, nem usarTIPI0 comoIPI inaplicável. ExemploAPI não documenta
BaseCalculoIPI; página conceitual diverge doMOC. Complemento estrito do rascunho
ao fornecedor em [impedimentos](PILOTO-55-IMPEDIMENTOS.md), não enviado.

Nenhuma nova chamada BrasilNFe, preview ou transmissão. HTTP200/status1 histórico
deConsultarServicos não foi repetido/reinterpretado. Certificado/CSC/recuperação
continuam com evidências e pendências próprias; CSC65 não impede preparação55.

PIS/COFINS RECOLHIDO_DAS é seleção explícita em regra fiscal, distinta da hipótese
SEM_DESTAQUE. Conforme [conceitos do Brasil NFe](https://www.brasilnfe.com.br/conceitos-fiscais/pis-cofins),
saídas admitem49/99 e CRT1/2/4 recebem base zero informativa. O cliente local
representa BaseCalculo0.00/Aliquota0.0000 sem calcular contribuição ou presumir
isenção. Perfil não admite bases/alíquotas extras; CRT3/código incompatível bloqueia.
49 ou99 depende da fundamentação, não de default. Contrato JSON numérico exato,
snapshot, rateios e total comercial foram preservados. Nenhum endpoint foi chamado.

O manifesto servidor permite55/ambiente2 e prova versões do plano existente;
hash fiscal deriva do serializador validado, e o retorno exclui dados pessoais,
payload/parametrização completa. A evidência vem da mesma transação autorizada,
com data, revisão e hashes, sob a trava fiscal existente. Contador zerado não
prova primeira emissão: status/pedido, ações, sequências, protocolos, lease e
histórico durável são confrontados. IDs/alvos das provas correspondem às versões
usadas nos parâmetros. Não contém confirmação externa ou autorização de envio.

IPI zero na TIPI não prova dispensa do grupo IPI. Contrato/preenchimento para o
piloto permanece aberto; o construtor recusa IPI aplicável sem suporte em vez
de omiti-lo. [Impedimentos e complemento ao suporte](PILOTO-55-IMPEDIMENTOS.md)
separam contrato técnico de decisão tributária. Rascunhos não enviados.
ConsultarServicos/status1, DtExpiracao e recuperação continuam evidências
históricas acima; sem nova rodada ou flexibilização neste incremento.

## Incremento operacional —12/10/2026

[Roteiro e evidências atuais](HOMOLOGACAO-INDIVIDUAL.md). ConsultarServicos não foi
repetido nem reinterpretado. O painel confirmou serviço ativo, endereço postal
completo e certificado carregado até07/11/2026. Somente a correção daIE, autorizada
pelo usuário, foi salva externamente.

BuscarEmpresa passou a retornarCEP mascarado após salvar o cadastro. O cliente
aceita oito dígitos ou máscaras completas00.000-000/00000-000. Não limpa conteúdo
arbitrário. A leitura posterior confirmouCNPJ e demais campos, mas omitiuUf.
A omissão permanece visível. Observação direta daUF no painel é evidência separada,
vinculada ao cadastro/configuração, limitada a sete dias. Antes do envio, o servidor
confereCNPJ/IE/CRT/endereço e essaUF; divergência ou falta de outros campos bloqueia.
Não altera o cadastro para aceitar uma divergência nem declara completa a respostaAPI.

VerificarCertificadoInterno voltouHTTP200 comDtExpiracao fora do contrato`string date`.
Nenhum valor bruto foi registrado. A validade do painel tem origem distinta.
CSC/id continuam ausentes. Isso limita65; não bloqueia a montagem55.

EnviarNotaFiscal exige capacidade manual, base isolada, autorização específica,
regras aprovadas, validação local e consumo durável soblease. Status são tratados
por endpoint. Timeout/resposta inválida/consulta vazia não liberam reenvio.
Documentos têm validação de identidade, formato, total, itens e representaçãoIPI.
Protocolos já obtidos permanecem preservados mesmo se um arquivo for recusado.

## Recuperação da primeira NF-e 55 — 13/10/2026

Uma tentativa específica foi autorizada e executada pela sessão administrativa;
não se obteve autorização fiscal comprovada. O resultado permanece incerto.
Datas e leituras estão em [HOMOLOGACAO-INDIVIDUAL](HOMOLOGACAO-INDIVIDUAL.md).

Correção técnica: o adaptador conserva `diagnosticoSeguro` do cliente durante a
consulta. A composição manual grava `HOMOLOGACAO_FALHA_TECNICA` sob a trava da
fila, somente com operação e metadados permitidos. O evento conserva HTTP numérico,
categoria, etapa e indicadores locais. O envelope de ConsultarNotaFiscal passa a
projetar apenas tipo/valor limitado de status, indicadores de erro, campos ausentes
e suprimidos. Credenciais refletidas no status são suprimidas. Nenhum texto livre,
erro/cause, header, resposta, item de erro ou dado de BuscarEmpresa é conservado.
A aceitação operacional da resposta não mudou.

A tela mostra horário, operação, categoria, HTTP, etapa e status observado. O
resultado incerto e o bloqueio de reenvio continuam explícitos. O registro antigo
não é preenchido retroativamente com dados da nova consulta.

### Rascunho ao Brasil NFe — não enviado

> Temos NF-e/NFC-e contratado, serviço ativo no painel e homologação liberada.
> Em 13/10/2026, às 00:08 (Brasília), executamos uma única tentativa NF-e 55,
> ambiente 2, total R$ 10,00, IdentificadorInterno registro-sintetico-2.
> O resultado ficou incerto. Não reenviamos e não podemos recuperar o HTTP da
> resposta original, cujo tratamento local descartou os metadados.
>
> A recuperação usa POST /services/fiscal/ConsultarNotaFiscal, Token no servidor,
> IdentificadorInterno acima, TipoAmbiente 2, ModeloDocumento 55 e
> RetornarArquivos false. Às 00:28:06 (Brasília), retornou HTTP 200, status numérico
> 1 no envelope, erros vazio e Error ausente. A documentação define status 0 como
> sucesso. Não confundimos esse campo com Nota.Status 1 e não aceitamos o retorno
> como autorização ou inexistência.
>
> Precisamos do significado desse status do envelope e da confirmação do resultado
> efetivo da tentativa, incluindo histórico, número/série, chave, protocolo e
> eventual rejeição. Se autorizada, indiquem como recuperar esse resultado e os
> arquivos pelo contrato documentado. Não transmitam outra nota nem alterem
> certificado, CSC, assinatura, séries ou numeração por esta solicitação.

Este pedido trata das próprias emissões NF-e/NFC-e. Não pede Sincronizar Docs,
distribuição de notas recebidas, ativação de serviços adicionais ou cobrança.

## Correção de ConsultarNotaFiscal e recuperação comprovada — 14/10/2026

O rascunho de 13/10 acima é histórico e foi superado nesta operação. A leitura
atual da [documentação oficial](https://www.brasilnfe.com.br/api/consultas)
define `status:1` como consulta processada e `status:2` como erro da requisição.
O exemplo JSON ainda usa `status:0`. O cliente agora tem um validador exclusivo
deste endpoint: aceita 1 e conserva 0 apenas com estrutura integral coerente.
Não altera ConsultarServicos, envio ou cancelamento. `Error`, códigos de erro
desconhecidos, campos inválidos e contradições continuam falhando.

`status:1`, `Encontrada:false`, `BR0008`, Nota nula e histórico vazio significam
consulta sem localização. Não provam inexistência nem autorizam reenvio. Principal
e todas as tentativas são delimitados pelo identificador estável, emitente, modelo
e ambiente. Nota autorizada exige situação fiscal, código SEFAZ, identidade e
protocolo coerentes; o envelope sozinho não satisfaz esses requisitos.

Após testes Node 22, foi executada uma consulta autenticada do piloto original:

| Campo | Resultado observado em 14/10, 20:46:32 Brasília |
| --- | --- |
| Rota | `POST /services/fiscal/ConsultarNotaFiscal` |
| Documento / escopo | `registro-sintetico-2`; modelo 55; ambiente 2; RetornarArquivos false |
| HTTP / envelope | 200 / status numérico 1 |
| Localização | Encontrada true; principal única; histórico vazio |
| Resultado fiscal | Nota.Status 3; Emitida false; CodStatusResposta 181 |
| Identidade | Chave validada para o emitente/modelo; número 1; série 1; protocolo ausente |
| Autorização | Não comprovada; nenhuma autorização no histórico |

A [NT 2026.007 v1.10, fonte oficial SVRS](https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=3&nomeArquivo=NT2026.007_v1.10%20-%20Emiss%C3%A3o%20NF-e%20sem%20IE%20e%20RV%20LCC.pdf),
página 10, regra 12E02-10, define 181 como rejeição por CNPJ do destinatário não
cadastrado na Receita Federal. PDF lido às 20:52:11; 775.351 bytes; SHA256
`4a9d9de64504f4091c55e3e8a2d499116d4bac1a2009a874a7b9ce26d9fe8b10`.
O [aviso ENCAT](https://dfe-portal.svrs.rs.gov.br/NFE/Avisos/2098) posterga a v1.10;
isso não elimina a rejeição anterior nem permite contornar o cadastro com um
documento inventado. Não foi atribuída falha ao fornecedor.

A projeção tipada já validada foi reconciliada **localmente**, às 20:54:17, pela
fila e auditoria existentes. O estado ficou REJEITADO, com chave/número/série
conservados, uma tentativa e nenhuma ação agendada. Não houve segunda consulta
nem retransmissão. SHA256 da evidência privada da consulta:
`b346b9b2fd85f11134df1cabd83bfd57327a47ad1211cfbc8f06fdb558f9aca4`.
Não há XML autorizado, DANFE válido ou protocolo a recuperar. Esses downloads
não foram chamados. A autorização de transmissão anterior permanece consumida.

O acesso usou a senha administrativa local já protegida, verificação real de senha,
JWT validado e reconferência das permissões centrais. A execução chamou o mesmo
serviço servidor da ação administrativa. Não usou cookies extraídos, sessão OAuth
fabricada, bypass de perfil ou simulador. Uma proteção privada limitou a saída
externa ao endpoint, identidade e quantidade da consulta. A reconciliação bloqueou
toda saída externa. Segredos e respostas brutas não foram conservados.

Uma leitura independente, 20:47:10, executou somente BuscarEmpresa e
VerificarCertificado interno: HTTP 200, empresa correspondente, IE/CRT presentes,
CSC e identificador ausentes em homologação e produção. O certificado API segue
não confirmado por formato de data fora do contrato. A validade até 07/11/2026
e UF SP continuam evidências separadas do painel anterior; não foram alteradas.
ConsultarServicos não foi repetido e seu status 1 continua sem aceitação automática.

### Rascunho atualizado ao Brasil NFe — não enviado

> A consulta exclusiva do piloto NF-e 55, ambiente 2, identificador
> registro-sintetico-2, em 14/10/2026 às 20:46:32 Brasília, foi processada
> (HTTP 200/envelope 1). Localizou uma tentativa: situação 3, não emitida, código
> 181, número 1, série 1, sem protocolo ou histórico adicional. Não houve reenvio.
> Precisamos da orientação documentada sobre o destinatário de teste admitido na
> homologação de São Paulo e a revisão correta dessa tentativa rejeitada. Não
> transmitam outra nota, alterem numeração ou troquem certificado/credenciais.
> A consulta de empresa também informa ausência de CSC e identificador nos dois
> ambientes; precisamos da orientação sobre o canal protegido para seu cadastro.

Uma nova emissão só poderá ocorrer com cenário corrigido, identidade/revisão
fiscal correta e nova autorização específica. Produção permanece bloqueada.

## ConsultarNumeracao — PR #21, 14/10/2026

Fonte: https://www.brasilnfe.com.br/api/empresas#consultar-numeracao, consultada em
14/10. `POST /services/empresa/ConsultarNumeracao`, sem corpo, com Token e UserToken
somente no servidor. `status` é booleano exclusivo deste endpoint. `Numeracoes`
contém ambiente, modelo, série textual, próximo número inteiro e padrão booleano.
O parser não converte status 1 em sucesso. Não chama AtualizarNumeracao.

Consulta manual autenticada na aplicação real: **14/10/2026, 21:47:48 Brasília**.
HTTP **200**, classificação **CONTRATO**, etapa **NUMERACAO_ITEM**. Nenhuma linha foi
aceita. A resposta bruta não foi armazenada. O subcampo incompatível não pode ser
reconstruído retrospectivamente a partir desse registro. A consulta não comprova
inatividade, ausência de série ou próximo número. Não foi repetida.

O código confere configuração e identidade antes e depois da chamada. A auditoria
conserva apenas versão, hash da identidade, data e metadados seguros. Alteração de
emitente/credenciais invalida a leitura. A comparação local usa somente chave,
modelo, ambiente, série, número e protocolo comprovados. Ausência de documentos
locais não confirma ausência de emissão no Takeat/SEFAZ. O próximo número não está
reservado e pode ser consumido por outro emissor após a consulta.

### Complemento ao rascunho de suporte — não enviado

> Em 14/10/2026, 21:47:48 Brasília, POST /services/empresa/ConsultarNumeracao
> retornou HTTP 200. O envelope foi lido, mas um item de Numeracoes não correspondeu
> ao contrato publicado de TipoAmbiente, ModeloDocumento, Serie, Numero ou Padrao,
> ou à unicidade da combinação/padrão. Não conservamos resposta bruta nem alteramos
> contadores. Solicitamos confirmação do contrato efetivo desses campos e das séries
> dos modelos 55/65 em cada ambiente. Não alterar séries, numeração, assinatura,
> certificado ou CSC. Esta pergunta é separada de ConsultarServicos/status 1 e da
> tentativa de homologação já rejeitada por código 181.
## Correção posterior de ConsultarNumeracao

Em14/10/2026, na branch `codex/fiscal-num`, a instrumentação restrita identificou
HTTP200, posição17, campoModeloDocumento, tipoINTEIRO, motivoFORA_LISTA. A enumeração
fechada de modelos do cliente impedia a leitura de55/65 por um registro adicional
fora do escopo. A correção separa identificadores inteiros positivos de outros
modelos antes dos campos específicos; não valida seus contadores nem converte
registros55/65 inválidos em sucesso. Os rascunhos anteriores sobre a causa genérica
de NUMERACAO_ITEM ficam históricos, não são nova solicitação ao fornecedor.

Nova leitura administrativa local, após testes, concluída às23:42:38: quatro
contadores55/65,produção/homologação,série1,próximo1,padrão;16 registros de outros
modelos descartados. Sem AtualizarNumeracao, reserva ou transmissão. Detalhes de
origem, validade e persistência em [Numeração](NUMERACAO.md).

## Habilitação manual da NFC-e — decisão administrativa de 20/10/2026

O responsável pediu a habilitação dos modelos55/65 em produção e informou antes
que a indisponibilidade do CSC de homologação não deve impedir o uso manual.
O HUB passa a admitir, exclusivamente para65/produção, decisão administrativa
explícita sem prova de homologação local. Isso não declara o emissor homologado,
não comprova credenciamento cadastral e não aprova tributação de produtos.

O registro usa o evento append-only de habilitação existente. Conserva versão,
hash do emitente, modelo/ambiente, data da consulta do CSC, responsável da sessão,
executor e modo de registro. Conteúdo fixo tem selo SHA256. Não guarda CSC, Token,
resposta bruta ou mensagens externas. O servidor exige sessão administrativa e
permissões fiscais, consulta de empresa/CSC bem-sucedida de até30min, identidade
correspondente, serviço e certificado conferidos. Falha de consulta não renova
a data de uma evidência antiga. Registro inválido não reativa habilitação anterior.

NF-e55 mantém a prova própria de homologação. Uma habilitação conjunta conserva
os dois modelos no mesmo registro. Cada nota continua exigindo revisão, autorização
individual, hashes, fila/travas, conferência do emitente/CSC e contador do ambiente.
Configurar ou publicar não transmite. Automação e callback continuam desligados.
Decisões de produto restritas ao55 não são ampliadas para65 por esta habilitação.

Fontes oficiais consultadas em20/10: [SRE40/2024, arts.2/4](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-40-de-2024.aspx)
e [Ajuste SINIEF19/16](https://www.confaz.fazenda.gov.br/legislacao/ajustes/2016/AJ_019_16).
O credenciamento é do estabelecimento; não foi identificado rito de certificação
individual deste software. O MOC7.0, §4.3.7, orienta o uso do ambiente de homologação
antes da produção. A validação externa do modelo65 no HUB permanece pendente.

Leituras novas na aplicação publicada: ConsultarNumeracao em20/10,23:36:46BRT
confirmou55/produção/série6/próximo2. Não houve AtualizarNumeracao. Conferência
protegida às23:38:36 confirmou emitente e presença de CSC/identificador de produção;
homologação permaneceu ausente. O certificado conserva evidência de painel válida
até07/11/2026; o parser da consulta interna ainda não confirma seu campo de data.
Esses resultados são separados dos testes sintéticos e não são emissão de nota.
