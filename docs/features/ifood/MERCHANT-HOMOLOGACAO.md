# Merchant — preparação e ticket enviado

## Detalhes completos e roteiro manual — 12/10/2026

Checklist integral recebido do responsável nesta retomada; não é necessário solicitá-lo novamente. A lacuna de exibição foi corrigida na tela existente: **Consultar detalhes da loja** apresenta a projeção dos campos oficiais cadastrais, endereço/coordenadas e operações/canais, com data da consulta e estados de carregamento/ausência/erro. Disponibilidade continua na consulta existente, separada do status cadastral. Autorização de usuário/conta/vínculo é reconferida no servidor antes e depois do GET; dados extras e credenciais não são enviados ao navegador. Não foi criada tela paralela ou alterado o fluxo de pausa/horários.

Em **12/10 às21h29m41–42s, America/Sao_Paulo**, autenticação TEST(C) e cinco GETs oficiais novamente200: zero pausas, sete turnos00:00:00/1439min e available=true. Os cinco corpos são idênticos por SHA-256 ao snapshot20h30; originais privados0700/0600 em `/root/.local/share/grazing-ifood/merchant-snapshots/20261013T002941Z-detalhes`. Nenhum POST/DELETE/PUT Merchant, fila de produção ou dado real foi alterado. Não houve restauração porque não houve escrita; conferir o original imediatamente antes do futuro ensaio e ao final por API e Portal continua obrigatório.

[Roteiro completo das três gravações](ROTEIRO-VIDEOS-MERCHANT.md): telas/botões, turnos e durações, preservação dos outros cinco dias, restauração, export/correlação oficial e preparação privada de links individuais. Nenhum vídeo, export oficial ou link Drive existe ainda. A gravação e o acesso ao Portal do Parceiro TESTE permanecem sem comprovação; não repetidas tentativas de controle do Chrome. Nenhum envio ou compartilhamento externo realizado. O texto exato da pergunta mais recente34526755 segue desconhecido, sem resposta inventada.

## Preparação das três gravações — 12/10/2026

**Histórico anterior à correção acima:** a lacuna de detalhes citada nesta seção foi corrigida nesta retomada; vídeos/export/Portal continuam pendentes. O checklist atual é o já fornecido pelo responsável.

O responsável informou que recebeu o checklist no 34526571 e definiu três vídeos separados: informações/disponibilidade, interrupção e horários (sábado 10–19; domingo 09–12, 13–16 e 17–23), mostrando HUB e Portal do Parceiro TESTE. Esse conteúdo foi recebido na instrução do responsável; **a resposta completa no Portal ainda não foi lida nesta execução**. A notificação oficial de atualização Merchant em 12/10 às 08h07 de São Paulo foi conferida por e-mail; contém apenas o link do chamado, sem checklist ou anexos. Não equiparar essa notificação à leitura do atendimento.

Ambiente conferido, sem mudanças: exclusivamente TEST(C), client_id `7db7f802-74b3-4496-843f-f67678b673e8`, merchant TESTE `973d35a2-6069-4dc4-b2a7-581775a372fa`. Produção comercial e acompanhamento de produção permanecem 0 nos três serviços; credenciais TESTE iguais e arquivos Merchant/guardas/worker conferidos. Nenhuma alteração de loja real, Takeat ou configuração de produção.

**Snapshot original ATUAL preservado em 12/10, 20h30m01–03s, America/Sao_Paulo (23h30 UTC):** autenticação e cinco GETs oficiais retornaram 200 — lista de merchants, detalhes, disponibilidade, interrupções e opening-hours. Disponibilidade OK/available=true, zero pausas e sete turnos originais, um por dia, início 00:00:00/duração1439 minutos. `enabled` ausente foi conservado como ausência; não inventado true/false. Originais completos somente no servidor privado, diretório0700/arquivos0600, hashes conferidos. Manifesto sanitizado local ignorado em `.tmp/ifood-ativacao/merchant-baseline-http-20261012.json`. Nenhum segredo ou header Authorization preservado nos artefatos. Não usar o snapshot histórico de 07/10 para restaurar sem conferir o atual.

| Material | Preparação comprovada | Estado real |
|---|---|---|
| Vídeo1 | Lista/detalhes/status oficiais consultados; listagem e disponibilidade existem na interface | Não gravado. A UI não tem ação explícita de exibir os detalhes completos; GET no coletor descarta o corpo. Conferir o checklist e acrescentar somente a leitura/exibição faltante se necessária. Portal do Parceiro TESTE ainda não confirmado |
| Vídeo2 | Pausas originais vazias e fluxo existente de fila/GET/remoção revisado | Não executado nem gravado nesta etapa. Criar somente pausa TESTE, aguardar confirmação/início, mostrar Portal TESTE e remover apenas o ID criado; preservar eventual pausa original que surja antes da execução |
| Vídeo3 | Editor suporta sábado10:00/duração540 e domingos09:00/180,13:00/180,17:00/360 | Não executado nem gravado. PUT substitui a semana completa: conservar os outros cinco dias, conferir API/Portal e restaurar todos os sete turnos originais. Original atual permite restauração no editor |
| Logs Developer | Client_id e intervalo das consultas preparatórias registrados | Exportação de HTTP Requests no Portal não realizada. Manifesto próprio não substitui o export oficial nem correlação com filmagem |
| Drive/envio | Destino pretendido e aprovação para compartilhar permanecem separados | Nenhum vídeo/link criado, arquivo enviado ou permissão de compartilhamento alterada. Não enviar material ao iFood sem aprovação |
| Chamado34526755 | Histórico anterior disponível; responsável informou analista aguardando retorno | Última resposta específica ainda não lida. Não preparar resposta especulativa nem repetir perguntas possivelmente já respondidas |

**Bloqueio de interface:** Computer Use foi interrompido por não conseguir determinar com segurança a URL atual do Chrome. O responsável já estava logado e deixou o chamado/barra de endereço em primeiro plano; a tentativa de retomada também foi interrompida. Nenhuma ação comercial foi executada. Não é um pedido de novo login nem prova de falha do HUB. Os recursos expostos não ofereceram gravação de vídeo; a gravação e o export ainda dependem de controle de navegador disponível ou execução manual. Capturas/fixtures não serão usados como vídeos reais.

Nenhuma pausa/horário foi alterado nesta execução; restauração não foi acionada. A conferência final comparativa na API e no Portal do Parceiro continua obrigatória depois dos futuros ensaios. Preparação, consulta real à API, filmagem e homologação são estados distintos.

**Atualização conferida em 08/10/2026:** Order e Events do app grazing-hub estão Aprovado no Portal (conclusão exibida 08/10; comunicação informada pelo responsável em 07/10). Aplicativo próprio Parcialmente homologado, credenciais definitivas disponíveis e preparadas de forma privada/inativa; nenhum merchant autorizado. Isso não encerra este chamado Merchant.

O chamado **34526571 permanece Em análise**. Em 08/10 às 12h26, suporte pediu detalhar a dificuldade/apoio necessário. Às **16h40**, resposta enviada e persistência conferida após reabrir o Portal: solicitação de avaliação/liberação formal especificamente Merchant, com as evidências dos oito endpoints já na descrição, ou orientação para agendamento e evidência adicional. Não relatada falha inexistente de API; não reiniciado Order/Events nem solicitado acesso à loja real. Aguardar decisão específica do módulo. [Configuração e plano pós-homologação](OPERACAO.md#preparação-pós-homologação--08102026).

**Nova conferência em 09/10/2026:** Merchant continua Em análise. Às **10h53**, o suporte informou não localizar as evidências e pediu a referência do chamado original e confirmação do interesse em agendamento. Também delimitou este chamado à homologação Merchant e orientou tratar outros assuntos no canal adequado. Não houve nova aprovação do módulo. Por isso, as dúvidas sobre acompanhamento temporário foram enviadas no chamado existente de Dúvidas/Informações **34526755**, sem duplicar ticket ou reiniciar Order/Events; registro abaixo.

**Complemento Merchant enviado e conferido em 09/10 às 14h44, America/Sao_Paulo:** no próprio chamado **34526571**, informamos que ele é a solicitação original de homologação Merchant, confirmamos interesse no agendamento e pedimos o formato/canal adequado para reapresentar as evidências dos oito endpoints já relatadas na descrição. Não foi aberto outro chamado Merchant.

O mesmo complemento relatou a verificação atual com as credenciais do aplicativo próprio aprovado em Order/Events: autorização da loja exibida como **Ativo** no Portal, emissão de token com HTTP **200**, `GET /merchant/v1.0/merchants?page=1&size=100` com HTTP **200** e lista vazia, e `GET /merchant/v1.0/merchants/{merchantId}` com HTTP **403**. Solicitamos orientação sobre a permissão para essas leituras Merchant. Autenticação, autorização exibida no Portal e acesso efetivo aos endpoints são evidências distintas; os retornos não demonstram uma causa única para o 403 nem aprovação Merchant. Este registro não reproduz credenciais ou identificação da loja real. Aguardamos resposta técnica e confirmação do agendamento; Order/Events não foi reiniciado.

Consulta oficial: 06–07/10/2026, referência HTTP v1.0 e [checklist Merchant](https://developer.ifood.com.br/en-US/docs/food/guides/modules/merchant/homologacao). Sem revisão editorial publicada. **Ticket 34526571 enviado em 07/10/2026, 13h24, America/Sao_Paulo; Em análise.** Este registro não significa aprovação do módulo.

Aplicativo: Grazing HUB, categoria PDV, centralizado, não listado. Testes usam o app oficial TEST(C) e exclusivamente o merchant TESTE `973d35a2-6069-4dc4-b2a7-581775a372fa`. Confirmar credencial/permissão própria do aplicativo ao ser liberada. **Cadastro profissional atualizado pelo responsável e conferido em 07/10:** Organização exibe dados salvos, sem Passo 1 de 2 ou formulário pendente; Usuário informa perfil Profissional. Regularização comunicada ao suporte às 14h13. Isso não comprova aprovação cadastral pela equipe nem homologação Merchant. Order/Events permanece no processo submetido, sem reinício.

| Requisito aplicável | Reutilização / ajuste mínimo | Evidência real / próxima validação |
|---|---|---|
| GET merchants com paginação | Cliente/token e vínculo existentes; page/size | Real em 07/10: page=1/size=10, 200, loja de teste presente; erro de paginação por HTTP simulado |
| GET merchant details | Verificação de autorização no coletor existente | Consulta real válida; dados privados não publicados |
| GET status e validações | Consulta existente ampliada para is-connected/opening-hours | Real em 07/10: OK/available=true antes e depois; durante pausa CLOSED/available=false e validação unavailabilities CLOSED |
| GET interruptions | Painel existente de configuração | Real: 200, lista vazia antes/depois e recurso com ID gerado pelo iFood durante o ensaio |
| POST interruptions | Nova tarefa durável com relógio local da loja, autorização e deduplicação | Real em 07/10: 201, GET correlacionado, pausa 00:46:51.325–00:51:51.325 local e estado CLOSED. Sobreposição rejeitada com 409 |
| DELETE interruption | Mesma tarefa, ID reconferido e GET posterior | Real em 07/10: 204, ausência por GET e estado OK na reabertura; pausa futura inicial também removida |
| GET opening-hours | Resposta oficial {storeId,shifts} preservada | Real: 200; sete dias, início 00:00:00, duração 1439 min |
| PUT opening-hours / múltiplos turnos | Rascunho explícito, validação de sobreposição, fila e GET posterior | Real em 07/10: 201 e GET 200, oito turnos com dois na segunda; 400 em sobreposição. Restauração por PUT/GET: sete dias, início 00:00:00, duração 1439; tarefas confirmadas |
| Tratamento de falhas | Tokens e guards existentes; tarefas ambíguas conferem sem replay | Real em 07/10: GET status sem token e com token fictício retornaram 401. 403/429/timeout e reinício validados localmente; não provocar indisponibilidade real para simular limites |
| Segurança / operação sem navegador | Segredos no servidor; admin/conta/loja relidos; worker supervisionado | Recepção real de #8 sem ação da tela; recuperação/restore Merchant com aba descarregada e workers reiniciados; zero título/reserva operacional de teste |

PreparationTime, check-in e módulos de catálogo não fazem parte deste escopo; os oito endpoints acima são os requisitos aplicáveis publicados no checklist Merchant consultado. Confirmação de categoria/módulos pelo iFood pode trazer exigências adicionais; não presumir dispensa.

## Fechamento dos ensaios remotos — 07/10/2026

Versão b304a6a9 publicada na aplicação e nos dois workers. Oito endpoints aplicáveis exercitados na loja de teste; 201/204 conferidos por GET posterior, status CLOSED durante pausa e OK após remoção, 401/400/409 negativos reais. PUT devolve turnos sem enabled em algumas respostas; ausência não equivale a false. Sete turnos originais restaurados, sem pausas ou ações pendentes. O primeiro ensaio identificou horário futuro/ID divergente; a correção foi retestada antes deste fechamento. Detalhes, esperados e observados em TASKS.md. 403/429/5xx/timeout permanecem evidências locais, não ocorrências provocadas no iFood.

## Preparação utilizada no envio

Assunto: Solicitação de homologação do módulo Merchant — Grazing HUB / PDV centralizado

Solicitamos avaliação do módulo Merchant para o aplicativo Grazing HUB, PDV centralizado e não listado. O sistema reutiliza seu gestor de pedidos e sua infraestrutura de execução em segundo plano. A integração permanece restrita à loja de teste. A operação real continua no Takeat, sem consumo de sua fila ou ações pelo HUB.

Implementamos listagem paginada, detalhes e estado/validações do merchant, consulta/criação/remoção de interrupções e consulta/atualização dos turnos completos. Escritas passam por autorização no servidor, tarefa persistida e confirmação por leitura oficial posterior. Timeout não provoca reenvio automático. Mantemos ambientes separados e credenciais privadas no servidor.

O envio incluiu os resultados remotos da tabela diretamente no texto, com IDs de app/merchant de teste, versão e horários; não houve anexos. Os cenários 403/429/5xx/timeout foram identificados como locais. Nenhum token, segredo, endereço ou contato foi incluído. O relatório Order/Events submetido mostra 100% em seis itens; solicitamos avaliação independente de Merchant, sem reiniciar aquele processo.

Favor informar exigências complementares aplicáveis ao PDV e o procedimento seguro de fornecimento de acesso de avaliação, se necessário. Credenciais só serão fornecidas pelo canal privado oficial indicado, jamais neste documento ou repositório.

## Protocolo, resposta e continuidade

- Ensaios POST/DELETE/PUT concluídos na versão b304a6a9; sete turnos originais restaurados e zero pausas. Evidências API/DOM e tarefas em TASKS.md; captura daqueles ensaios indisponível por tempo limite. O envio atual dos tickets tem captura privada.
- [Chamado 34526571 no Portal oficial](https://developer.ifood.com.br/pt-BR/developer/tickets/a25a5956-8d73-4bdb-a4f3-a692281ded45). Usuário autorizou especificamente o envio nesta retomada. Formulário Homologação, somente Merchant selecionado; Order/Events desabilitados pelo próprio Portal. Desenvolvimento Merchant declarado concluído para os oito requisitos aplicáveis; cenários operacionais ainda pendentes explicitados no texto.
- Portal confirmou envio e protocolo; status Em análise. Em 13h25, suporte solicitou nome da integradora, CNPJ da organização, confirmação de escopo Merchant e eventual ticket anterior. Isso é triagem, não aprovação nem dispensa de requisitos.
- Em 13h33, resposta publicada e conferida no histórico: empresa já vinculada à conta, CNPJ empresarial já cadastrado, somente Merchant e primeira solicitação Merchant nesta conta. Valores cadastrais e identificação pessoal não são reproduzidos neste registro. Informamos também Passo 1 de 2 e pedimos orientação sobre eventual impedimento/regularização.
- Em 13h35, suporte confirmou recebimento das informações obrigatórias, encaminhamento à equipe técnica e **bloqueio da homologação enquanto o cadastro profissional não estiver finalizado e aprovado**. Indicou concluir etapas pendentes em Organização, incluindo validações/documentos quando exigidos, e aguardar aprovação. Orientação registrada sem tratá-la como aprovação Merchant.
- O responsável informou a conclusão do cadastro diretamente no Portal. Nova consulta e a aba indicada pelo usuário confirmaram Organização com dados salvos, sem etapa/formulário pendente, e perfil Profissional em Usuário. Não copiamos dados pessoais ou captura do perfil para o repositório/suporte.
- Às **14h13**, comentário enviado e conferido no histórico deste mesmo chamado: cadastro regularizado; solicitar confirmação da aprovação cadastral e continuidade do agendamento/avaliação exclusivamente Merchant. Order/Events preservado, sem reinício; Takeat e loja real mantidos. Aguardar resposta e liberação/permissões próprias do aplicativo. Nenhuma nova credencial ou acesso de avaliação foi criado/compartilhado.
- Captura do resultado existe somente no espaço privado da sessão: contém o nome do usuário no cabeçalho. Evidência versionada é este resumo sanitizado e os protocolos; não publicar captura com perfil pessoal.
- Kairu indisponível nesta sessão; nenhum checklist de formação alterado ou declarado concluído.

## Complemento preparado — piloto temporário de acompanhamento — 09/10/2026

**Histórico do preparo e destino final:** o rascunho inicial propunha usar 34526571 e não chegou a ser enviado nesse chamado. Após a orientação do suporte para preservar ali somente a homologação Merchant, o complemento foi refinado e **enviado em 09/10/2026 às 14h07, America/Sao_Paulo**, no [chamado existente 34526755 — Dúvidas/Informações](https://developer.ifood.com.br/pt-BR/developer/tickets/7bad8ada-d833-4ae5-83de-1654955b164a). Envio e persistência conferidos no Portal. Não foi aberto chamado duplicado nem reiniciada a homologação aprovada.

Fontes oficiais lidas no Chrome em 08–09/10/2026, sem revisão editorial informada: [FAQ](https://developer.ifood.com.br/pt-BR/support/faq/), [polling](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/polling-overview), [presença](https://developer.ifood.com.br/pt-BR/docs/food/guides/modules/events/presence) e [política de homologação](https://developer.ifood.com.br/en-US/docs/getting-started/homologation/categories). A seção de múltiplos aplicativos do guia Polling em português confirmou device único por aplicativo baseado nas credenciais, ACK independente e atualização por eventos de outros consumidores. A pergunta inicial sobre essa associação foi superada pela referência oficial; não permanece como bloqueio documental. Isso não comprova que a convivência específica com o Takeat tenha sido ensaiada.

### Escopo e dúvidas efetivamente enviados

O complemento identifica grazing-hub como PDV operacional, com funções mantidas e Order/Events já aprovados, usando temporariamente **Acompanhamento — Takeat** por loja. O HUB recebe/persiste eventos, envia ACK e consulta detalhes; o Takeat mantém as ações operacionais. Não se trata de um novo aplicativo exclusivamente consultivo. O usuário autorizou a recepção real nesse modo após validação, sem autorizar comandos ou a substituição do Takeat.

1. **Aplicabilidade da regra consultiva:** esclarecer se a restrição publicada para aplicativos exclusivamente consultivos abrange essa etapa temporária de um PDV operacional já homologado. A consulta preserva a homologação existente; não presume nova avaliação obrigatória nem proibição do piloto.
2. **Proteção da presença e teste:** esclarecer como receber eventos sem o polling do HUB mascarar a indisponibilidade do sistema principal; se `excludeHeartbeat=true`, documentado para integradoras logísticas, se aplica ao PDV; e qual procedimento/cenário validar com aplicativos independentes em loja de teste, sem interromper ou alterar o Takeat real.

O envio contém somente contexto operacional e perguntas técnicas, sem credenciais, dados de clientes ou captura do perfil. A aprovação de Order/Events permanece válida no registro; Merchant continua em análise. A autorização do usuário é distinta da comprovação técnica de coexistência e presença. O complemento não declara recepção real ativada nem teste concluído.

### Registro de envio e resposta

- Envio: **realizado e verificado em 09/10 às 14h07** no chamado **34526755**, tipo Dúvidas/Informações. O destino 34526571 foi apenas a proposta inicial, não utilizada para esse complemento.
- **Novo complemento enviado e verificado em 09/10 às 14h49**, no mesmo **34526755**: solicitamos qual usuário/fluxo deve autorizar a loja TESTE já utilizada pelo TEST(C) para o aplicativo próprio grazing-hub, aprovado em Order/Events. A solicitação dessa loja de teste permanece pendente, enquanto a conta acessível no Portal do Parceiro apresenta somente a loja real, cuja autorização consta como Ativo. O relato também contextualiza a lista Merchant vazia e o 403 nas leituras descritas acima, sem atribuir causa única. A finalidade é viabilizar o ensaio com duas aplicações independentes na loja de teste; não foi solicitada nova homologação.
- Após recarregar cada chamado, a persistência foi conferida separadamente: complemento Merchant das **14h44 no 34526571**; perguntas das **14h07** e complemento TESTE das **14h49 no 34526755**. Capturas de ambos foram gravadas e verificadas somente no espaço privado da sessão, sem inclusão neste repositório.
- Respostas técnicas aos complementos das 14h07 e 14h49: **pendentes**. Não atribuir aos envios aprovação Merchant, autorização efetiva da loja de teste ao segundo app, dispensa/exigência de homologação adicional ou coexistência comprovada. O acompanhamento Merchant permanece no protocolo 34526571.
