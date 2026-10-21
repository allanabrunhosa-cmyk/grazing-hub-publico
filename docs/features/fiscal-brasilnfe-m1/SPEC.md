# Brasil NFe — Marco 1

## Continuação operacional de 14/10/2026

Contrato operacional reconciliado, código e testes locais:
[entrega de 14/10](OPERACAO-20261014.md). Essa entrega não é deploy nem homologação
externa. PERFIL central, classificações e regras v2 governam novos documentos;
os planos e aprovações antigos permanecem vinculados aos pilotos históricos.

O pedido atual amplia a entrega para regime central visível, seletores normativos
pesquisáveis e emissão manual dentro do pedido. Reutilizar o motor fiscal versionado
que já está na main, o catálogo e os snapshots v2. Preservar snapshots v1 e o piloto
incerto de 13/10 como história, sem reenvio ou conversão retroativa.

As versões EMPRESA mantêm a aprovação específica existente. A reconciliação deve
preservar a estrutura VersaoEstruturaFiscal/EventoEstruturaFiscal da main, sem duas
filas ou habilitação automática por flags. Habilitação por ambiente e cada emissão
exigem prova durável, permissões centrais e autorização humana identificada.

Nenhuma nova transmissão foi autorizada em 14/10. A autorização de 13/10 foi
consumida. A preparação desta continuação não autoriza produção, outra nota,
cancelamento, publicação ou migração produtiva por inferência.

Incremento vigente: [autonomia fiscal — Issue #8](AUTONOMIA-FISCAL-EXECUCAO.md),
em `codex/fiscal-autonomia-tributaria`. Substitui a exigência geral de aprovação
Confirp por fundamentação verificável e aprovação interna auditável; não autoriza
emissão nem muda os bloqueios do provedor. As referências Confirp antigas são
histórico, preservado sem falsa conversão em aprovação interna.

Base preservada: [implementação técnica do Marco2](MARCO-2-IMPLEMENTACAO.md),
sobre a preparação local já entregue. [Cenários de homologação](HOMOLOGACAO-CENARIOS.md)
continuam bloqueados até parâmetros aprovados e autorização específica por nota.
Os registros administrativos anteriores permanecem históricos. A nova leitura
autorizada foi somente BuscarEmpresa/VerificarCertificado interno, em 11/10/2026.
ConsultarServicos não foi repetido; inteiro1 continua sem interpretação documentada.

## Objetivo e limites

Continuação da Issue11 sobre `e5865e17`: confirmação oficial da opçãoSimples2026,
constatação de caixa semGTIN, revisão CEST/ST/IPI/PIS/COFINS e proteção compartilhada
do GTIN em aprovação/montagem55/65. Endereço comprovado foi salvo no ambiente
administrativo existente, com sessão central. CRT estadual e representaçãoIPI
continuam pendentes; nenhuma versão fiscal real aprovada ou manifesto fabricado.
Pesquisa atual/limites e roteiro por campo:
[classificação](PILOTO-55-CLASSIFICACAO.md), [impedimentos](PILOTO-55-IMPEDIMENTOS.md).

Configurar com segurança e diagnosticar o conector NF-e/NFC-e contratado, na fila existente de `DocumentoFiscalSaida`/`EventoFiscalSaida`. Este marco entrega base técnica, configuração administrativa e testes. Não homologa nem libera transmissão.

Proibidos: emissão/cancelamento/inutilização externos (inclusive homologação), alteração de séries/números/assinatura/certificado, automação, callback operacional, dados reais em testes, efeitos em estoque/financeiro/notas recebidas, alterações Takeat/iFood, envio a clientes, merge/deploy e migrations produtivas.

O escopo definitivo do Brasil NFe é a emissão NF-e (55)/NFC-e (65) e, em marcos
futuros autorizados, a gestão e consulta das próprias emissões do HUB. Distribuição,
sincronização, manifestação e importação de notas recebidas continuam no módulo
SEFAZ existente, sem alteração. O serviço **Sincronizar Docs** está excluído; não
é requisito administrativo, não será contratado/ativado e não substitui a SEFAZ.

## Arquitetura implementada

Complemento vigente: decisões tributárias versionadas em `/vendas/fiscal/regras-brasilnfe`,
plano imutável separado da fotografia comercial, pré-requisitos administrativos
e métodos técnicos de emissão/consulta/cancelamento/documentos. A porta de operação
continua negando autorização e o registro de provedor permanece null. As SQLs
aditivas foram aplicadas somente ao banco administrativo local exclusivo. A
evidência de serviço ativo no painel não reclassifica o resultado da API como sucesso.

As novas decisões exigem fundamentação fiscal com fontes, justificativa, alcance
por UF/modelo/operação/regime e confiança por campo; proposta, revisão, aprovação
interna e bloqueio são versões auditáveis. A aprovação continua restrita à permissão
central `vendas.fiscal/editar`, com sessão reconferida no servidor e confirmação
explícita. Parecer especializado é uma fonte opcional; fonte histórica isolada ou
sugestão de pesquisa não comprova regra válida. Mudança de produto, emitente,
fundamentação ou vigência impede uso obsoleto do plano. Os hashes, snapshots e
versões históricas são preservados. Contrato detalhado e critérios na
[execução da autonomia](AUTONOMIA-FISCAL-EXECUCAO.md).

- `src/lib/fiscal-saida/brasilnfe`: cliente servidor com origem fixa/consultas permitidas, configuração criptografada, diagnóstico, mapeamento comercial parcial, evidências de consulta e adaptador técnico bloqueado.
- O cadastro `ConfiguracaoLoja` continua sendo a fonte do emitente. Não duplicamos CNPJ/endereço/certificado. `ConfiguracaoBrasilNfe` referencia a loja e registra apenas segredos cifrados, versão e diagnóstico saneado; `EventoConfiguracaoBrasilNfe` audita substituições e consultas sem credenciais ou respostas brutas.
- Reutiliza `src/lib/crypto.ts`: AES-256-GCM, nonce aleatório, chaves derivadas por contexto distinto de `AUTH_SECRET` externo ao banco. A chave precisa permanecer protegida e disponível; sua rotação exige recifrar os segredos existentes, como os demais consumidores. Nunca configurar segredo em variável pública.
- Todas as fronteiras usam `configuracoes.brasilnfe` central (visualizar/editar), com releitura de usuário/perfil/exceções/versão dentro da transação. Permissão nova negada por padrão; sem perfis alternativos.
- Salvamento explícito substitui somente campos informados (ASCII visível sem espaços, até 512); não retorna segredo, não habilita emissão, invalida diagnóstico anterior. Concorrência usa versão otimista e trava administrativa. Diagnóstico tem intervalo de 30 segundos e revalida autorização/emitente/configuração após HTTP, fora da transação.
- `/configuracoes/integracoes/brasilnfe` reutiliza Central; índice Integrações conserva MCP e permite acesso fiscal independente. Credenciais sempre vazias na leitura. Homologação e produção são estados distintos e bloqueados.
- Adaptador operacional permanece ausente (`provedor.ts` retorna null); consulta técnica não gera sucesso/evento fiscal artificial. Snapshot/hash/histórico/lease/recuperação da fila permanecem existentes. `IdentificadorInterno` não prova idempotência externa; principal e histórico precisam ser analisados, sem liberar reenvio por ausência/erro/timeout.

## Histórico da preparação administrativa — Marco 1.1

Esta seção retrata a preparação anterior. O contrato vigente do incremento
administrativo e seus critérios estão na seção seguinte; evidências datadas ficam
em [TASKS](TASKS.md).

Executar a aplicação real da mesma branch em loopback, com banco administrativo
exclusivo e chave própria persistente externa ao banco. Autenticação e permissões
centrais permanecem reais. Somente razão social/CNPJ mínimos, conferidos no painel
autenticado do fornecedor, identificam o emitente esperado; não importar certificados,
pedidos, clientes ou pagamentos. Testes automatizados usam outro banco e dados sintéticos.

Credenciais são fornecidas exclusivamente nos campos protegidos da tela. O agente
não extrai tokens do navegador nem reaproveita segredos de outro ambiente. Diagnóstico
administrativo externo limita-se a BuscarEmpresa e ConsultarServicos, sem consulta de
notas, SEFAZ ou certificado. Identidade, autenticação e serviços são evidências
separadas; a ausência de certificado/CSC e a homologação permanecem pendentes.

Conferir Node22 do Dockerfile e executar verificações nesse runtime. Preparo,
operação e limitações do ambiente: [AMBIENTE-LOCAL](AMBIENTE-LOCAL.md).

## Histórico — diagnóstico de serviços e escopo de saída

Incremento iniciado a partir de `d68558b8`, sem expandir o marco para emissão. A
investigação autorizada utiliza somente BuscarEmpresa e ConsultarServicos, pela
ação administrativa com sessão/permissões centrais. Não extrair credenciais,
expor respostas completas nem executar consultas fiscais para testar conexão.
O incremento seguinte delimita a única projeção de mensagens externas permitida.

O diagnóstico deve registrar resultados independentes de identidade, acesso,
serviços e pré-requisitos. BuscarEmpresa válida e CNPJ correspondente preservam
acesso confirmado quando ConsultarServicos fica indisponível; a situação geral é
parcial, com a consulta e a pendência identificadas. Falha da busca ou divergência
do emitente continuam impedindo a consulta subsequente. Estados antigos permanecem
compatíveis e não são reescritos como validação externa nova.

O transporte deve distinguir HTTP, autenticação recusada, rede/TLS, timeout,
contrato inválido e falha de negócio com categorias/campos locais permitidos.
Diagnóstico persistido e auditoria nunca conservam mensagens, headers, bodies,
cause, traces, paths dinâmicos ou códigos externos sem semântica documentada.
HTTP403 registra acesso recusado; não prova credencial inválida. Correlacionar
somente a tentativa administrativa local. A projeção transitória abaixo não
altera essa lista de persistência nem os critérios de sucesso do cliente.

O catálogo contratual utiliza o item combinado **NF-e/NFC-e**; reconhecer esse
item não equivale a homologar os modelos ou confirmar ambiente/certificado/CSC.
Indisponibilidade da API de serviços não bloqueia salvar configuração, diagnosticar
acesso ou continuar a preparação administrativa. Confirmação pelo painel/suporte,
quando existente, precisa de origem e data identificadas; não fabricar retorno
API nem registrar contratação como serviço ativo comprovado. Essa evidência não
habilita emissão: continuam necessárias definições fiscais fundamentadas, pré-requisitos,
recuperação segura, homologação e autorização do marco correspondente.

A interface deve mostrar consulta, resultado e falha saneada separadamente, com
pré-requisitos conferidos apenas quando efetivamente verificados. Não exigir
Sincronizar Docs, não alterar a SEFAZ/notas recebidas e não criar outro fluxo de
documentos. O rascunho ao fornecedor continua sem envio e foi atualizado com o
diagnóstico granular real de10/10/2026 às20:13 Brasília: empresa confirmada e erro
de negócio HTTP200 em ConsultarServicos. O motivo específico continua pendente.
Contrato público e limites de evidência:
[CONTRATOS](CONTRATOS.md).

## Incremento implementado — motivo transitório de ConsultarServicos

Após o diagnóstico real da versão8, o usuário autorizou extrair, sanear e mostrar
o motivo de ConsultarServicos exclusivamente na sessão administrativa atual.
A implementação e as verificações sintéticas desta revisão estão registradas em
[TASKS](TASKS.md). O build final foi aprovado e o usuário concluiu uma nova consulta
administrativa autenticada, versão9, em10/10/2026 às20:54 Brasília. BuscarEmpresa
confirmou acesso/emitente; ConsultarServicos retornou HTTP200 com status numérico1,
erros vazios e Error ausente. Somente status0 é publicado como sucesso; o significado
de1 permanece pendente do fornecedor. Os resultados históricos não foram usados
como evidência desta nova implementação.

- Reutilizar Validar conexão, sessão/permissões centrais, intervalo e proteção de
  versão/emitente. BuscarEmpresa deve concluir com CNPJ correspondente antes de
  ConsultarServicos. Salvar credenciais continua sem HTTP ou ativação de emissão.
- Projetar somente campos permitidos de erro de ConsultarServicos, com até5 itens,
  código de até48 caracteres e descrição/correção/Error de até300 caracteres.
  A projeção conserva contexto técnico e pode substituir trechos desconhecidos
  ou credenciais literais por `[suprimido]`; conteúdo opaco, codificado, sem contexto
  suficiente ou duvidoso é suprimido inteiro. Credenciais, certificados/CSC, dados
  pessoais e conteúdo bruto permanecem excluídos. Não interpretar o motivo exibido
  automaticamente nem afrouxar o envelope operacional.
- Devolver o detalhe saneado somente no resultado transitório da tentativa para
  a sessão autorizada; renderizar como texto escapado. Não gravar mensagens ou
  códigos observados em banco, evento, log, arquivo, Git ou captura, nem mantê-los
  em armazenamento do navegador ou na leitura posterior da configuração.
  A retenção usa projeção congelada em WeakMap, consumo único e prazo de5 minutos;
  a tela expira/oculta o detalhe e descarta respostas tardias ou de versão diversa.
- Persistir apenas metadados e indicadores derivados de lista permitida; uma
  tentativa substituída ou cujo emitente/credencial mudou não pode devolver
  detalhes obsoletos. Status observado pode ser inteiro seguro de `-999999` a `999999`
  ou boolean, acompanhado de tipo/estado, sem interpretação fiscal. Valor que
  reflete credencial é suprimido. Somente status inteiro0 com erros vazios permite
  sucesso do envelope; false continua falha. Recarregar a tela não recupera o texto.
- Um código observado sem contrato semântico continua desconhecido: sua exibição
  saneada não o inclui na enumeração operacional, não prova autenticação inválida,
  serviço inativo ou qualquer hipótese fiscal, e não converte a falha em sucesso.

Permanecem os três endpoints do cliente e os limites de transmissão deste marco.
Não consultar notas para diagnosticar serviços, não ampliar para Sincronizar Docs
ou SEFAZ recebidas e não enviar mensagens ao fornecedor. O rascunho de suporte
permanece não enviado e foi atualizado com a versão9. Nenhuma outra consulta ou
nova credencial é necessária para registrar essa pendência administrativa.

## Banco

Na preparação local do Marco2 não há alteração de schema/migration. Construtores
55/65 e fronteira servidor com permissões centrais consomem a fotografia existente
e complementos fiscais explícitos em memória. Payload completo não autoriza envio;
o adaptador, processador, produção e callback conservam os bloqueios. Inventário,
recorte suportado e critérios: [MARCO-2-PREPARACAO](MARCO-2-PREPARACAO.md).

SQL manual aditivo `20261010090000_brasilnfe_marco1`; CHECK restringe singleton e homologação, sem coluna de ativação. Aplicação limitada aos bancos locais isolados de testes/diagnóstico administrativo; nenhuma migration produtiva autorizada.

## Critérios de aceite

### Piloto concreto55 — Issue #11,12/10/2026

Pesquisa e proposta delimitadas aos sanduíches Brie/geleia e Minas/geleia, com
fatos do HUB/planilha e declaração do usuário. Nenhuma classificação ou aprovação
é aplicada automaticamente ao produto principal que permite outros sabores.
Fontes e lacunas:[PILOTO-55-CLASSIFICACAO](PILOTO-55-CLASSIFICACAO.md).
Roteiro:[PILOTO-55-IMPEDIMENTOS](PILOTO-55-IMPEDIMENTOS.md).

PIS/COFINS têm tratamento explícito RECOLHIDO_DAS: CRT1/2/4 e CST49/99,
representação informativa conforme provedor, sem tributo inferido. SEM_DESTAQUE
antigo continua compatível. Seleção visual não substitui decisão fiscal aprovada;
parâmetros monetários de destaque extras são recusados.

Leitura servidor de manifesto55 reutiliza plano/fotografia e permissões centrais,
confere versões/datas na mesma transação e retorna somente metadados/provas,
total e hashes. Não cria documentos nem retorna payload pessoal ou habilita envio.
Pedido alterado/não confirmado, histórico durável mesmo com contador zerado,
ação pendente, protocolo, modelo65 ou prova ausente impedem a preparação.
Papéis, alvos e IDs conferem as referências efetivas dos parâmetros aprovados.
Serviço/certificado/recuperação e aprovação da primeira transmissão são conferências
separadas. Manifesto concreto não existe enquanto os impedimentos persistirem.

Configurar, substituir e consultar estado sem expor segredo; rejeitar usuários sem permissão/sessão revogada; explicitar consultas indisponíveis sem UserToken e divergência CNPJ; validar cliente/resposta/timeout/limites; manter produção/processadores/callback bloqueados; testes sintéticos de modelos55/65, identidade estável e histórico incerto; ausência de efeitos nos domínios fora do escopo; lint/design/typecheck/build e QA visual isolada com evidência honesta.

## Marcos seguintes e decisões abertas

**Brasil NFe:** confirmar liberação NF-e/NFC-e para o emitente contratado, obtenção segura Token/UserToken, certificado cadastrado sem troca neste marco, formatos/estados/ordenação e garantias de idempotência/consistência após timeout. A consulta de status SEFAZ usa produção e está excluída. Contratos públicos e ambiguidades: [CONTRATOS](CONTRATOS.md).

**Responsável fiscal interno:** fundamentar e aprovar CRT/IE, natureza/finalidade/destino/presença/consumidor final; por operação/item NCM, CEST quando aplicável, CFOP, origem, CSOSN/CST, bases/alíquotas, tributos federais e regras da reforma, unidades tributáveis, pagamentos e regras específicas NFC-e/CSC. Não inferir códigos a partir de exemplos. Consulta oficial ou parecer especializado, da Confirp ou outro profissional, é recurso para incerteza material ou obrigação específica; não é requisito universal de aprovação.

**Homologação (Marco 2):** revisar pendências, completar parâmetros fiscais e contrato de recuperação segura, aprovar SPEC própria de transmissão em ambiente2 com dados exclusivamente sintéticos, então autorizar execução de homologação. Emissão individual independe de webhook; callback só em etapa futura com autenticação/antirreplay/vínculo comprovados.

**Produção (marco separado):** depende de homologação fiscal comprovada, aprovação operacional, revisão de bloqueios e ritual de deploy/migration; credencial salva/HTTP200/certificado válido não habilitam produção.

Execução, testes e próximo passo: [TASKS](TASKS.md). Guias donos: [Fiscal](../../modulos/fiscal.md), [Banco](../../contexto/banco-de-dados.md), [Permissões](../../contexto/autenticacao-permissoes.md).

## Incremento operacional —12/10/2026

O escopo autorizado evoluiu para homologação individual, com aprovação humana
específica antes de cada transmissão. [Roteiro operacional](HOMOLOGACAO-INDIVIDUAL.md)
define esse recorte. Produção, emissão automática, callback e cancelamento real
do piloto continuam bloqueados. EMPRESA/OPERAÇÃO/ITEM permanecem propostas até
revisão interna auditável. O fluxo manual reutiliza a fila e snapshots existentes;
não registra adaptador global. IPI documental admite representação explícita
OMITIR_SIMPLES com aplicabilidade materialnull. Não define o Anexo federal nem
altera apurações anteriores.

## PR #21 — estrutura publicável com transmissão suspensa

O comentário de 15/10/2026, 00:21 UTC, separa publicação da estrutura de autorização
fiscal. Nesta entrega, `bloqueio-transmissao.ts` retorna false por código. Sessão,
credencial, configuração histórica, variável de ambiente ou autorização de uma
nota não liberam transmissão. Isso vale para os dois modelos e ambientes,
cancelamento, prévia externa, callback e processadores. Consultas documentadas,
pré-validação local e arquivos de documentos próprios continuam separados.

O pedido confirmado mantém o botão **Emitir nota fiscal** e a prévia local. A ação
final mostra **Emissão ainda não liberada**. A prévia funciona sem Token ou perfil
aprovado e informa suas pendências; não cria sucesso simulado nem efeitos comerciais.
Financeiro → Fiscal inclui **Séries e numeração** após Empresa fiscal. A ação manual
consulta apenas `ConsultarNumeracao`; não altera nem reserva contadores. Contrato,
permissões e evidências: [NUMERACAO](NUMERACAO.md).

A rejeição 181 anterior permanece encerrada. Não repetir sua consulta ou transmissão.
Pendências de classificação, CSC e homologação bloqueiam a futura emissão, mas não
a navegação desta estrutura. Publicação depende das verificações, backup íntegro,
plano do destino produtivo e autorização específica. A instrução final do usuário
nesta execução permite publicar a estrutura; não autoriza emissão.

## Habilitação manual por modelo —20/10/2026

O pedido atual habilita o uso manual de55/65 em produção, sem transmissão pelo
agente. NF-e55 preserva homologação própria. NFC-e65 admite decisão administrativa
explícita e auditável, com CSC de produção conferido, enquanto a prova local de
homologação65 não estiver disponível. A decisão não transforma essa pendência em
homologação concluída e não aprova regras dos produtos. [Contrato vigente](CONTRATOS.md#habilitação-manual-da-nfc-e--decisão-administrativa-de-20102026).
Séries55=6 e65=7, contadores do fornecedor e autorização individual continuam
obrigatórios. O próximo55/produção já é2; uma tela com leitura antiga não autoriza
reset nem nova atualização do contador. O resumo distingue habilitação do ambiente
de pendências fiscais da operação. Nenhum bloqueio de duplicidade foi removido.
