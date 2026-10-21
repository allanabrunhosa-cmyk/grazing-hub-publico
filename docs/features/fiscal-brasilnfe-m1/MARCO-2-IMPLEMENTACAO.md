# Marco 2 — implementação técnica e preparação da homologação

Registro da entrega técnica em 11/10/2026, na branch `codex/fiscal-brasilnfe-m1`.
Evolui a [preparação local anterior](MARCO-2-PREPARACAO.md), preservando suas
fotografias, hashes, fila e evidências históricas. Não autoriza transmitir a
primeira nota. [Contratos](CONTRATOS.md), [tarefas](TASKS.md) e
[cenários mínimos](HOMOLOGACAO-CENARIOS.md) distinguem implementação, simulação e
conferência autenticada.

Atualização de contrato na Issue #8, branch `codex/fiscal-autonomia-tributaria`:
[fundamentação e aprovação interna](AUTONOMIA-FISCAL-EXECUCAO.md) substituem a
aprovação externa obrigatória. As conferências administrativas e as aplicações de
SQL descritas neste registro são históricas; não comprovam nova consulta ou nova
migration nesta execução. O roteiro e as pendências vigentes abaixo usam o novo
contrato de decisão, sem reescrever as versões antigas.

## Histórico dos pré-requisitos conferidos em 11/10/2026

| Conferência | Evidência e origem | Resultado nessa conferência |
| --- | --- | --- |
| Serviço NF-e/NFC-e | Painel Brasil NFe autenticado, observado em11/10/2026 | Ativo no painel; não é sucesso de ConsultarServicos |
| Certificado A1 | Painel autenticado, observado em11/10/2026 | Cadastrado, com validade exibida até07/11/2026; nenhum arquivo ou senha copiado |
| Liberação de homologação pelo fornecedor | Declaração do usuário em11/10/2026 | Informada pelo usuário; não é resposta da API nem autorização de emissão |
| Autenticação/emitente | BuscarEmpresa na rodada administrativa de leitura abaixo | CNPJ corresponde ao esperado; cadastro esperado preservado |
| IE/CRT externos | Projeção restrita da mesma BuscarEmpresa | Presença confirmada; isso não comprova regularidade fiscal ou aprovação Confirp |
| Endereço externo | Projeção restrita da mesma BuscarEmpresa | Incompleto para os campos exigidos pelo diagnóstico |
| Endereço local | Conferência somente leitura de ConfiguracaoLoja no banco administrativo isolado | enderecoEstruturado ausente; completar Dados da empresa |
| Certificado pela API | VerificarCertificado com Interno:true | HTTP200; resposta rejeitada em CERTIFICADO_DATA; validade não confirmada pela API |
| CSC/identificador65 | Presença dos campos no painel autenticado, observada por DOM booleano | Ambos ausentes em homologação e produção; nenhum valor de segredo capturado |
| Decisões tributárias | Banco administrativo exclusivo | Zero regras registradas; nenhuma aprovação Confirp presumida |
| Homologação fiscal | Nenhuma nota transmitida | Não realizada |
| Produção | Bloqueios no servidor e registro de provedor | Bloqueada |

Uma única ação do usuário **Conferir certificado e CSC** iniciou a rodada em
**11/10/2026 às21:09:38.913 de Brasília**, equivalente a
**2026-10-12T00:09:38.913Z**. A rodada executou somente BuscarEmpresa e
VerificarCertificado interno. Não consultou notas, períodos ou status da SEFAZ.
Não executou ConsultarServicos nem enviou arquivo de certificado.

O HTTP200 de VerificarCertificado foi classificado como falha de contrato no
campo de data. Não foi conservado o valor recebido, e seu formato real permanece
desconhecido. Não presumir máscara, data/hora, tipo numérico ou outra forma para
relaxar a validação. A confirmação do painel permanece identificada separadamente;
ela não transforma a resposta da API em sucesso. Esclarecimento solicitado no
[rascunho vigente ao fornecedor](CONTRATOS.md#rascunho-vigente-ao-fornecedor--implementação-do-marco-2-não-enviado).

A conferência do painel foi observada e documentada neste registro, mas ainda não
foi salva no formulário local **Registrar conferência do painel**. A captura real
enviada pelo usuário conserva corretamente “Evidência ainda não registrada”.
Não foi inserida uma confirmação simulada no banco para mudar essa apresentação.

A evidência de ConsultarServicos de10/10/2026 permanece histórica: rodada iniciada
em2026-10-10T23:54:22.671Z, HTTP200, status inteiro1, erros vazios. Seu significado
continua sem documentação. A consulta não foi repetida; sua regra de aceitação
continua exigindo o sucesso documentado, sem considerar1 equivalente a0.

## Código implementado e bloqueio de execução

| Parte | Implementação e comportamento |
| --- | --- |
| Transporte | cliente.ts expõe operações específicas de envio individual, consulta da própria nota, arquivos e cancelamento; origem HTTPS fixa, prazo limitado, leitura com limites e projeções tipadas |
| Montagem | payload-local.ts continua montando55/65 sobre o snapshot comercial imutável, com decimais exatos e pendências por campo/item/produto/operação |
| Adaptador | adaptador.ts implementa enviar, consultar, cancelar e obterDocumentos, reutilizando o contrato AdaptadorFiscalSaida; autenticarRetorno continua retornando null |
| Normalização | resposta-fiscal.ts interpreta os campos de cada endpoint, mantém rejeição, denegação e pendência distintas; erro/HTTP200/código desconhecido não viram autorização |
| Porta de aplicação | porta-tecnica.ts revalida sessão, permissões, documento, fotografia e plano aprovado; autorizar permanece bloqueada nesta entrega |
| Fila e auditoria | servico.ts reutiliza DocumentoFiscalSaida/EventoFiscalSaida, identidade estável, trava e lease; não cria segunda fila nem refaz cálculos comerciais |
| Documentos | arquivos.ts valida XML da nota e do cancelamento, PDF estrutural e HTML65 no recorte estático; protocolos e identificadores continuam textuais |
| Administração fiscal | regras-tributarias.ts e regras-tributarias-dominio.ts guardam decisões e complemento separado, sem reescrever fotografia ou lançar efeitos comerciais |
| Pré-requisitos | pre-requisitos.ts e pre-requisitos-dominio.ts projetam presença, data e metadados seguros; não armazenam respostas brutas ou conteúdo dos segredos |

O registro `obterAdaptadorFiscalSaida()` continua sem emissor operacional. A porta
técnica da aplicação recusa autorização de operações externas. Não há chave de
ambiente, campo da tela ou credencial salva que habilite essa transmissão.
Implementar os métodos não equivale a autorizar sua utilização no ambiente real.
As chamadas operacionais são exercitadas apenas por transportes e portas
sintéticos da suíte.

`LOCAL_OBSERVACAO` distingue a ordem interna da fila de qualquer sequência do
fornecedor. O adaptador identifica o resultado por hash da projeção permitida.
Sob a trava existente, o serviço atribui ordem local; uma leitura posterior sob
lease pode registrar reobservação do mesmo resultado sem inventar sequência
externa. Duplicatas, leases antigos e estados terminais continuam protegidos.
A sequência de um evento de cancelamento não é utilizada como ordem global.

## Recuperação, cancelamento e documentos

- A consulta considera a nota principal e o histórico, sempre pelo identificador
  estável, emitente, ambiente2 e modelo55/65. Não usa a distribuição de notas recebidas.
- Timeout, ausência, HTTP de erro, contrato incompatível ou várias evidências
  contraditórias mantêm conferência manual. O adaptador não devolve ausência como
  autorização de reenvio; IdentificadorInterno não comprova idempotência externa.
- Cancelamento incerto bloqueia nova solicitação de cancelamento. Se houver
  protocolo de evento observado, recuperar e validar somente esse evento. Sem
  protocolo, encaminhar ao fornecedor/conferência manual; não transmitir novamente.
- Protocolo de autorização da nota e protocolo de cancelamento ficam separados.
  O evento não sobrescreve a identidade necessária para conferir o XML original.
- XML de cancelamento exige vínculo à chave, emitente, ambiente, evento110111,
  sequência e protocolo; a resposta de cancelamento processada isoladamente não
  dispensa essa prova. Código100 do exemplo não é aceito como cancelamento.
- HTML65 não é PDF. O recorte aceito é HTML/XHTML bem formado e estático, com
  identidade identificável e sem conteúdo ativo, URLs executáveis ou recursos
  externos. Outros leiautes são recusados. A primeira homologação deve verificar
  a representação real; não se afirma compatibilidade com qualquer HTML.
- Download de XML/PDF/HTML/evento usa a rota de saída existente, sessão e permissão
  central. HTML é anexo com política de isolamento; conteúdo não entra no DTO de
  listagem nem na auditoria, que conserva hashes e metadados.

## Administração vigente das decisões fiscais

Acesso: **Configurações → Integrações → Brasil NFe → Decisões tributárias e
revisão interna**, em `/vendas/fiscal/regras-brasilnfe`.
A tela requer `vendas.fiscal/visualizar`; gravação, aprovação e inativação requerem
`editar`, reconferido no serviço. Utiliza produtos/grupos/formas existentes,
componentes oficiais e salvamento explícito.

Na entrega original, cada decisão exigia referência Confirp e confirmação de
decisão externa. Esse contrato é histórico. A Issue #8 exige fundamentação fiscal,
justificativa, alcance e confiança por campo, com proposta, revisão, aprovação
interna ou bloqueio explícitos. Usuário autorizado confirma que conferiu a aplicação
ao caso concreto; autoria, data e hash permanecem auditáveis. Inativar acrescenta
versão, preservando as anteriores. Campo ausente permanece pendente e Sim/Não exige
escolha explícita. Fontes e pareceres não têm aprovação automática.

EMPRESA reutiliza CNPJ/nome/endereço da loja e acrescenta os complementos fiscais.
OPERACAO identifica política de destinatário, natureza/presença e correspondência
de pagamentos. ITEM relaciona classificação do produto/grupo com tratamento,
conversão e aplicabilidade de tributos. Aprovação exige correspondência com o
cadastro fiscal revisado. Uma regra de grupo não substitui silenciosamente o
conteúdo fiscal fotografado do produto.

`vincularRegrasDocumentoBrasilNfe` seleciona versões aprovadas e vigentes, coleta
bases/endereço/autorização de cartão específicos e congela `PlanoFiscalBrasilNfe`
se a montagem fechar. `obterComplementosAprovadosDocumentoBrasilNfe` reconfere
cadastros, vigência, emitente e fotografia. Produto sem revisão, forma inexistente
ou inativa, referência incompatível ou alteração de cadastro impedem uso.
Essas funções não enfileiram emissão, baixam recebíveis ou movimentam estoque.

Nenhuma regra real foi registrada na entrega original nem aprovada por esta
mudança de contrato. O responsável interno ainda precisa fundamentar decisões e
classificações concretas para os dois modelos, incluindo
vigência, tributos aplicáveis, bases/alíquotas, transporte, pagamentos e textos
legais. Grupos fiscais adicionais exigidos devem ter extensão testada antes de
concluir o manifesto. Não escolher códigos das fixtures nem declarar um tributo
inaplicável para vencer um bloqueio.

## Ambiente preservado e evidência técnica

O ambiente administrativo real local, seu banco exclusivo, credenciais cifradas,
chave persistente protegida por DPAPI e sessão existente foram preservados.
Não foi clonada a base produtiva nem copiado seu certificado ou AUTH_SECRET.

As migrations SQL aditivas
`20261011090000_brasilnfe_regras_tributarias`,
`20261011100000_brasilnfe_preparacao_operacional` e
`20261011110000_brasilnfe_denegacao` foram aplicadas à aplicação
administrativa somente no banco isolado. O banco dos testes sintéticos é separado; testes não
usam pedidos ou clientes reais. Não houve migrate dev, db push ou migration
produtiva.
O último SQL amplia o CHECK de estados mantendo os valores anteriores; foi
necessário para persistir DENEGADO, sem editar a migration já aplicada.

Suítes sintéticas cobrem transporte, montagem, estados por endpoint, arquivos,
permissões, versões, concorrência, recuperação, cancelamento e consumidores da
interface. Resultados e reexecuções da bateria final, lint, lint de design,
typecheck, build e inspeção visual são registrados em [TASKS](TASKS.md), sem usar
evidências da entrega anterior como se tivessem sido reexecutadas.

O acompanhamento do vencimento é calculado localmente em data civil de Brasília,
com aviso de renovação até30 dias antes e estado expirado quando a data passou.
Preserva a origem e a data da conferência histórica; não instala agendamento nem
consulta automática ao fornecedor.

## Pendências e próximo passo exato

| Responsável | Pendência concreta | Condição de conclusão |
| --- | --- | --- |
| Brasil NFe | Formato efetivo e contrato de DtExpiracao em VerificarCertificado Interno:true | Orientação documentada que permita corrigir incompatibilidade comprovada; repetir leitura somente após essa evidência |
| Brasil NFe | Significado de status inteiro1 de ConsultarServicos | Contrato explicado; serviço ativo do painel permanece evidência independente |
| Brasil NFe | Recuperar NuProtocolo do cancelamento quando o retorno original se perde; consistência/latência e múltiplas tentativas | Caminho comprovado de recuperação; sem ele, manter conferência manual e bloqueio de repetição |
| Usuário autorizado | Endereço local e dados fiscais completos do emitente; endereço externo incompleto | Fonte confiável, cadastro estruturado e complementos revisados; CNPJ esperado não alterado para aceitar divergência |
| Usuário/Brasil NFe | CSC/identificador65 ausentes nos dois ambientes na conferência histórica | Configuração necessária definida por UF/ambiente e conferida por presença; não é bloqueio do modelo55 |
| Responsável fiscal interno | Matriz concreta ainda sem aprovação real | Fontes específicas, alcance, confiança por campo, versões vigentes e aprovação interna identificada; consulta oficial/especialista para dúvida material |
| HUB/responsável interno/Brasil NFe | Leiaute real de documentos e contratos ambíguos | Conferência na homologação especificamente autorizada, com parada segura em incompatibilidade |

Próximo passo: revisar o [rascunho ao fornecedor](CONTRATOS.md#rascunho-vigente-ao-fornecedor--implementação-do-marco-2-não-enviado),
revisar a [matriz candidata](MATRIZ-PILOTO-PROPOSTA.md), completar os cadastros
faltantes e registrar fundamentações específicas com aprovação interna autorizada.
Preparar, sem transmitir, um manifesto para cada cenário do
[roteiro NF-e/NFC-e](HOMOLOGACAO-CENARIOS.md), com montagem sem pendências,
identidade/hash/revisão e versões fiscais explicitamente selecionadas.

Somente depois desses requisitos, solicitar aprovação específica de **uma NF-e55
individual em ambiente2**. A NFC-e65 exige seus próprios requisitos e aprovação;
sucesso55 não autoriza envio65. Cancelamento também precisa de autorização própria.
Liberação de homologação pelo fornecedor não concede nenhuma dessas autorizações.

Nenhuma emissão, cancelamento, inutilização, preview fiscal ou evento externo foi
executado. Sem alteração de certificado, CSC, assinatura, série ou numeração;
sem fila automática, callback, merge, deploy ou produção. Integração SEFAZ das
notas recebidas, estoque, financeiro, Takeat e iFood permanecem fora deste escopo.
