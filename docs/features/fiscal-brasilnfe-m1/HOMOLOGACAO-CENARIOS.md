# NF-e/NFC-e — cenários mínimos para primeira homologação

Preparado em 11/10/2026 para `codex/fiscal-brasilnfe-m1`. Este roteiro não foi
executado e não autoriza transmissão. A fila, o adaptador operacional, o callback
e a produção permanecem bloqueados. Os testes automatizados usam respostas
sintéticas; essas respostas não são evidência de homologação fiscal.

Atualização da Issue #8 em `codex/fiscal-autonomia-tributaria`: a definição fiscal
usa [fundamentação verificável e aprovação interna](AUTONOMIA-FISCAL-EXECUCAO.md).
Confirp ou outro especialista pode apoiar dúvidas materiais; não há aprovação
externa universal obrigatória. As evidências administrativas datadas abaixo
permanecem históricas e não foram reexecutadas por esta alteração.

## Condições de entrada e responsáveis

| Requisito | Evidência necessária antes da execução | Responsável |
| --- | --- | --- |
| Identidade | CNPJ contratado corresponde ao cadastro e à fotografia; resultado BuscarEmpresa datado e vinculado à configuração atual | HUB/usuário |
| Serviço e ambiente | Evidência identificada do painel/suporte para NF-e/NFC-e ativo e homologação liberada; origem e data registradas | Usuário/Brasil NFe |
| ConsultarServicos | Preservar HTTP200, status numérico1 e erros vazios como pendência da API; não aceitar1 nem repetir a consulta sem evidência nova | Brasil NFe |
| Emitente | Razão social/CNPJ e endereço estruturado completos em Dados da empresa; IE, CRT, município IBGE e demais complementos com fonte e aprovação interna identificadas | Usuário autorizado |
| Certificado | Conferência segura de leitura e validade; relato do usuário informa A1 válido até07/11/2026, sem autorizar copiar ou substituir o certificado | Usuário/Brasil NFe/HUB |
| NFC-e | Presença de CSC e identificador para ambiente2 e UF aplicável, conferida sem registrar os segredos; produção é verificação separada; não bloqueia cenário55 | Usuário/Brasil NFe |
| Matriz fiscal | Fundamentação concreta, alcance e confiança por campo, vigência e revisão interna aprovada por usuário autorizado | Responsável fiscal interno; especialista quando necessário |
| Montagem | Todos os campos/pagamentos/tributos aplicáveis completos; nenhuma pendência local; grupo nunca é fallback automático | HUB/responsável fiscal interno |
| Recuperação | Consulta da própria emissão delimitada por emitente, modelo, ambiente e identificador; principal e histórico conciliáveis, sem reenvio por timeout/ausência | Brasil NFe/HUB |
| Autorização | Manifesto concreto da nota revisado e aprovação humana específica para uma transmissão individual em ambiente2 | Usuário |

Evidência do painel documenta serviço/ambiente, sem fingir que ConsultarServicos
respondeu com sucesso. Cadastro do certificado, serviço ativo e montagem completa
não significam documento autorizado nem homologação concluída. Não exigir
Sincronizar Docs: notas recebidas continuam na integração SEFAZ existente.

## Matriz fiscal fundamentada a revisar internamente

Para cada modelo/operação, identificar a decisão que aprova: natureza/finalidade,
presença/consumidor final, frete/intermediação, origem do destinatário fiscal,
indicador IE, classificação dos produtos (NCM, CEST quando aplicável, origem, CFOP,
CSOSN/CST, PIS/COFINS e outros tributos), unidades/conversão, bases e alíquotas
aplicáveis, códigos de pagamento e textos legais/transporte quando necessários.

Aplicabilidade de ST, FCP, DIFAL, IPI, IBS/CBS e benefícios precisa ser explícita.
Se a decisão exigir um grupo ainda não suportado pelo construtor, implementar e
testar a extensão antes da transmissão. Não preencher false para contornar uma
exigência, escolher códigos dos exemplos públicos ou copiar códigos das fixtures.

Fontes oficiais, notas históricas e pareceres têm papéis distintos. A aprovação
interna registra usuário, data, versão, hash e confirmação de que conferiu o
alcance ao caso concreto. Uma referência digitada não constitui validação jurídica
automática. Incerteza material permanece bloqueada no produto/operação afetado,
com recurso a consulta oficial ou parecer especializado quando necessário.

O primeiro piloto usa saídas **internas em SP**. Destinatário fiscal fora da UF do
fundamento mantém pendência local de alcance; não utilizar a matriz interna para
uma venda interestadual. Tal operação exigirá fundamentação e revisão específicas,
com extensão de contrato/testes quando necessária. Não é requisito para concluir
o código e os testes independentes desta Issue.

## Preparação dos dados e do complemento versionado

1. Usar aplicação real e banco exclusivo de homologação, com sessão e permissões
   centrais. Não copiar pedidos, compradores, recebíveis ou movimentações reais.
   A montagem não cria títulos, baixa pagamentos nem movimenta estoque.
2. Identificar os produtos/grupos cujo cadastro fiscal foi efetivamente aprovado
   para cada cenário. Para a massa comercial, nome/descrição, destinatário, entrega,
   observações e identificadores de teste são sintéticos. O emitente é a empresa
   contratada; seu CNPJ/IE/endereço não recebem substitutos fictícios.
3. Em Configurações → Integrações → Brasil NFe → Regras tributárias, registrar
   perfis EMPRESA, OPERACAO e PRODUTO/GRUPO para o modelo escolhido. Informar a
   fundamentação específica, justificativa, alcance, confiança por campo, vigência
   civil e conteúdo revisado. Salvar proposta, revisar e aprovar internamente por
   usuário autorizado. Não usar código de fixture nem criar fonte fictícia.
4. Usar formas de pagamento existentes e ativas do HUB com correspondência fiscal
   aprovada. Não inferir o código fiscal pelo nome/tipo, deduzir taxas do total ou
   criar uma forma fictícia na aplicação para vencer a validação. Os testes de
   código continuam utilizando formas exclusivamente sintéticas no banco de teste.
5. Fotografar o pedido sintético pelo plug existente. Guardar `documentoId`,
   `hashPayload` e revisão. A fotografia comercial v1 não é reescrita. Criar apenas
   o complemento fiscal separado: selecionar explicitamente versões aprovadas de
   empresa, operação e de cada item; preencher endereço fiscal e bases por item
   quando exigidos. Bases monetárias não são inferidas nem perfil reutilizável.
6. Executar `vincularRegrasDocumentoBrasilNfe` por consumidor servidor autorizado.
   Sem pendências, essa função congela `PlanoFiscalBrasilNfe` e os vínculos às
   versões, com modelo, hash/revisão, responsável e data. Ela não enfileira nem
   transmite. Campos ausentes geram pendências por item/produto/operação.
7. Revalidar o plano por `obterComplementosAprovadosDocumentoBrasilNfe` imediatamente
   antes de preparar o manifesto. Vigência vencida, revisão obsoleta, produto não
   revisado, forma inativa ou alteração do emitente invalidam o uso. O histórico
   permanece preservado. Não enviar os parâmetros completos a logs ou evidências:
   o complemento pode conter endereço fiscal e autorização de cartão.

Não há neste roteiro botão ou habilitador de transmissão. Uso de produto/grupo
aprovado exige equivalência com as classificações fotografadas; o complemento
nunca altera silenciosamente o NCM/CFOP/tributos da fotografia para fazê-la passar.

## Cenário55 — uma NF-e individual

| Parte | Massa comercial proposta | Configuração fiscal obrigatória |
| --- | --- | --- |
| Operação | Uma venda sintética interna em SP, normal, sem intermediação se a decisão aprovada assim determinar | Perfil EMPRESA/OPERACAO55 aprovado, compatível com o recorte e com a operação fotografada |
| Item | Um item de teste, quantidade1, preço comercial10,00, acréscimos0,00, desconto0,00 | Produto/grupo fundamentado e aprovado internamente; unidade e conversão explícitas; classificações idênticas à fotografia |
| Fechamento | Subtotal10,00, frete0,00, outros custos0,00, total10,00 | Tributos/bases aprovados que mantenham o fechamento; se houver parcela adicional legal, ajustar e revisar o cenário comercial antes da fotografia |
| Destinatário | Destinatário sintético identificado, nome e endereço em SP próprios de homologação | Documento de teste aceito em homologação, indicador IE e endereço completo, inclusive IBGE; UF deve corresponder ao alcance interno aprovado; não usar CPF/CNPJ de cliente real nem inventar identificador que viole validações |
| Pagamento | FonteTOTAL, valor preservado10,00, sem troco neste recorte | Uma forma ativa existente, código/indicador aprovados; dados de cartão somente se essa forma exigir |

Os valores acima são apenas massa comercial sintética proposta. Não constituem
decisão de base de cálculo ou alíquota. Nenhum código tributário foi escolhido
para esse cenário. O responsável interno precisa revisar os campos fiscais; o
fornecedor precisa esclarecer requisitos técnicos do destinatário de teste.
Somente depois poderá existir um manifesto concreto aprovável.

## Cenário65 — uma NFC-e individual

| Parte | Massa comercial proposta | Configuração fiscal obrigatória |
| --- | --- | --- |
| Operação | Venda presencial sintética interna em SP, normal, consumidor final | Perfil EMPRESA/OPERACAO65 aprovado; presença/finalidade explícitas e CFOP permitido para o modelo |
| Item | Um item de teste, quantidade2, preço comercial5,00, acréscimos0,00, desconto0,00 | Produto/grupo com decisão interna fundamentada específica para65; unidade/conversão e classificações fotografadas |
| Fechamento | Subtotal10,00, frete0,00, outros custos0,00, total10,00 | Bases/alíquotas/tributos fundamentados e aprovados internamente; sem substituir obrigação fiscal por zero fictício |
| Destinatário | Consumidor sintético; ausência de identificação somente se a operação aprovada e as regras aplicáveis permitirem | Política do perfil65 explícita; entrega domiciliar fica para cenário adicional identificado, sem inferir CPF/endereço |
| Pagamento | FonteTOTAL, valor preservado10,00, sem troco neste recorte | Forma ativa e correspondência fiscal aprovadas, sem somar novamente parcelas ou taxas financeiras |
| Segurança | Ambiente2 | CSC/identificador presentes quando aplicáveis, sem incluir os segredos no manifesto ou payload local |

Documento de impressão65 pode ter formato diferente do55. Guardar XML validado e
a representação efetivamente recebida: PDF estrutural ou HTML tratado pelo
contrato seguro da aplicação. Nunca renomear HTML como PDF.

## Manifesto concreto e aprovação da primeira transmissão

Para **cada nota separadamente**, registrar em evidência administrativa saneada:
modelo, ambiente2, identificador estável, hash/revisão comercial, total10,00 (ou
total revisado antes da fotografia), versões e hashes das fundamentações selecionadas,
vigências, autor e aprovador responsáveis, pré-validação sem pendências, evidência de serviço,
certificado/CSC e estratégia de recuperação. Não anexar tokens, certificado,
CSC, XML/payload contendo dados pessoais ou resposta bruta do fornecedor.

A aprovação deve identificar esse manifesto e autorizar **uma única emissão
individual em homologação**. Aprovação genérica do projeto, cadastro de credenciais,
serviço ativo ou liberação do fornecedor não substituem essa autorização.
NFC-e65 depende de sua própria aprovação; sucesso da NF-e55 não autoriza seu envio.

Após a aprovação futura, preparar execução assistida com escopo limitado à nota
aprovada, ambiente2 e modelo. Manter produção, callback e agendamentos bloqueados;
não registrar globalmente um emissor operacional para executar esse roteiro.
Enquanto o bloqueio técnico estiver vigente, não criar flags, scripts de bypass
ou chamadas diretas ao cliente para transmitir.

## Execução futura e condições de parada

1. Conferir novamente sessão/permissões, identidade, vigência e manifesto; se algo
   mudou, parar e reapresentar a revisão para aprovação.
2. Transmitir somente o documento individual aprovado. Preservar identificador,
   hash, trava e histórico da fila; `EnviarEmail:false`. Não depender de webhook.
3. Analisar autorização por campos do endpoint de emissão, não pelo HTTP isolado
   nem pela regra de status de ConsultarServicos. Conferir chave/modelo/ambiente,
   emitente, número/série e protocolo sem perder precisão.
4. Rejeição não vira sucesso. Registrar código seguro e pendência; não corrigir
   a fotografia nem reenviar automaticamente. Outra revisão exige nova conferência.
5. Timeout, falha de transporte, resposta inválida ou resultado ambíguo exigem
   recuperação da própria tentativa. Confrontar principal e histórico por
   identificador/emitente/modelo/ambiente. Ausência não comprova inexistência e não
   permite reenvio. Sem recuperação inequívoca, encaminhar à conferência manual.
6. Em autorização, validar XML/identidade/protocolo e documento de impressão no
   formato correto; preservar eventos/documentos. Não enviar nada a clientes.
7. Cancelamento fiscal fica para autorização específica posterior, com motivo,
   prazo, identidade e protocolo próprios. A aprovação da emissão não autoriza
   cancelamento. Nenhum pedido, recebível ou estoque é modificado por esse evento.
8. Revisar as evidências pelo responsável interno e Brasil NFe; recorrer a consulta
   oficial/especialista para dúvida material. Homologação de um cenário não libera
   automaticamente outros perfis, modelos, produção ou automação.

## Situação desta preparação

Dois cenários comerciais estão descritos e o código local suporta montagem,
pré-validação e complemento versionado. Os parâmetros tributários concretos e
documentos de teste aceitos não foram inventados. A falta dessas definições impede
um manifesto fiscal concluído e a transmissão, mas não a conclusão do código e
dos testes sintéticos independentes.

Nenhuma emissão, cancelamento, preview, consulta histórica ou nova execução de
ConsultarServicos foi realizada para elaborar este documento. Não houve mudança
de certificado, CSC, assinatura, série ou numeração; merge, deploy e migration
produtiva continuam fora deste incremento.

## Concretização do cenário55 — Issue #11,12/10/2026

Usar o recorte de dois sabores e o cenário comercial exclusivamente fictício
delimitados em [PILOTO-55-IMPEDIMENTOS](PILOTO-55-IMPEDIMENTOS.md).
Não aplicar a classificação aos demais sabores, copiar preços/cliente/pedido real,
ou interpretar os documentos sintéticos da suíte como massa homologada pela SEFAZ.

O leitor servidor de manifesto55 retorna metadados somente de plano existente,
vigente e aprovado, com conferência de identidade/revisão/provas na mesma transação.
Não cria esse plano nem confirma serviço/certificado. Os campos ID/hash/versões
reais ainda estão ausentes nesta preparação; nenhum manifesto completo é anunciado.
Após resolver os impedimentos, obter o manifesto e pedir a aprovação específica
prevista neste roteiro. A preparação não autoriza primeira transmissão.
