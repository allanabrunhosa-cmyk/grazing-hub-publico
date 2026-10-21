# Execução e evidências — iFood

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Merchant — correção da exibição e execução disponível — 12/10/2026

Checklist oficial fornecido pelo responsável, TEST(C)/TEST973 exclusivamente. Reutilizados configuração, Card/Button/tokens, transporte, token, permissões e vínculo existentes. Nova projeção explícita em `merchant-detalhes.ts`, GET em `merchant.ts`, ação protegida e visualização no cartão atual; nenhuma migration ou alteração de pedido, pausa/horários, financeiro, estoque, impressão, fiscal ou autoaceite.

| Cenário / ambiente | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Campos oficiais / unitário e interface isolada | Mostrar todos os campos pertinentes, distinguir ausência/zero/false e disponibilidade | Projeção cadastral/endereço/operações/canais; campos extras não chegam ao navegador; não converte ticket médio nem inventa fuso em createdAt |
| Autorização / servidor e PostgreSQL local | Bloquear leitor, outra conta, vínculo revogado e ambiente não liberado; reler antes da resposta | Guardas reais exercitadas com HTTP simulado; versão da sessão revogada durante GET impede entrega; retorno200 de outra loja é recusado; sem outbox Merchant criada |
| Domínio iFood / banco isolado | Preservar retomada, ACK durável, deduplicação, ações e financeiro | **97/97 em15 arquivos**, Node22, IFOOD_BANCO_TESTE=1, banco local `teste_ifood_piloto_teste`; nenhum skip. Entrypoints em processos separados; não usa carteira operacional. Nova leitura foi posicionada depois do teste de renovação para preservar sua pré-condição; sem relaxar asserções |
| Design / prévia Vite isolada | Componentes/tokens existentes, responsividade e feedback | Lint de tokens/qualidade sem novos desvios; capturas320/390/768/1440 claro/escuro, carregamento/erro/vazio, Tab/Enter e toque390; oito auditorias sem problemas. Dados explicitamente sintéticos, sem servir de vídeo oficial, aprovação visual humana ou certificação de acessibilidade |
| Consumidores / revisão integrada à main15fee9d4 | Preservar permissões, componentes e pedidos manuais | **340 aprovados/7 ignorados** em18 arquivos de Central/permissões/rota de estoque já publicada; os sete opt-ins de banco da Central não são aprovação. **56/56 em3 consumidores** de criação/edição, operação e detalhe de pedidos manuais |
| Gates finais / Node22 | Lint focado, design, typecheck e build webpack | Aprovados; compilação inclui TypeScript/93 páginas. Sandbox inicialmente impediu canonicalização do caminho pelo compilador; execução autorizada concluída, sem alteração de código para contornar. Aviso preexistente middleware permanece fora do escopo |
| Smoke compilado / sem sessão | Login permitido, configuração protegida e origem/host conferidos | **7/7** às21h42m20s São Paulo: login200; gestor/configuração GET e POST de mesma origem307 para login; origem divergente403; host desconhecido/proxy divergente421. Cliente HTTP inicialmente não reproduzia Host/origem do proxy; corrigido apenas o emissor do ensaio, sem mudar middleware ou expectativas de autorização |
| Backup / servidor privado | Preservar configuração/dados antes da correção publicada | Dump de61.545.207bytes, pg_restore --list aprovado, SHA-25688b7e419…26c11 e0600; snapshots dos três serviços e fonte fiscal no banco, sem restauração/consulta fiscal. Diretório `<BACKUP_PRIVADO>` |
| API TEST(C) / leitura real | Reconfirmar original antes de eventual alteração | **12/10,21h29m41–42s São Paulo:** autenticação e cinco GETs200; zero pausas/sete turnos00:00:00/1439, available=true. SHA-256 dos cinco corpos iguais aos de20h30. Snapshot completo privado0700/0600; nenhuma escrita Merchant. Manifesto local ignorado, não é export oficial HTTP Requests |
| Vídeos, Portal TESTE e logs oficiais | Três gravações reais correlacionadas ao export Developer | **Não obtidos.** Sem controle seguro do Chrome/gravação; Portal do Parceiro TESTE ainda não comprovado. [Roteiro operacional](ROTEIRO-VIDEOS-MERCHANT.md) pronto com campos/durações/restauração. Nenhum arquivo/link Drive ou envio/compartilhamento externo |
| Chamado34526755 | Responder somente à pergunta efetivamente recebida | Texto mais recente desconhecido; apenas informação de que aguarda retorno. Sem resposta inventada ou chamado duplicado |

Logs de teste/QA permanecem locais ignorados em `.tmp/ifood-merchant-detalhes`; corpos reais somente no servidor privado. Tentativas iniciais de validação encontraram restrições de cache temporário/conexão local do sandbox; execuções finais usaram cache no worktree e acesso autorizado ao PostgreSQL isolado. Essas tentativas não foram contabilizadas como aprovação.

Estado: lacuna implementada e validada localmente; consultas reais preparatórias concluídas. Filmagem, export/correlação, comprovação pelo Portal e avaliação Merchant continuam pendentes. Order/Events não foi reiniciado; Takeat/loja real e chaves de produção permanecem protegidos. Resultado da revisão/publicação e gates finais será registrado nesta seção ao concluir.

## Evidências Merchant — preparação de 12/10/2026

**Registro anterior à correção de detalhes acima.** A pendência de exibição foi resolvida; as gravações e o export oficial continuam sem execução. O checklist integral é o já fornecido pelo responsável, sem necessidade de reenviar.

Exclusivamente TEST(C)/merchant TEST973, sem alterações em real/Takeat/produção. Client_id `7db7f802-74b3-4496-843f-f67678b673e8`. Em 12/10 às20h30m01–03s America/Sao_Paulo, autenticação e cinco consultas oficiais200; disponibilidadeOK, zero pausas, sete turnos00:00–23:59 (`start=00:00:00`, `duration=1439`, enabledausente preservado). Snapshot HTTP integral privado atual, 0700/0600, hashes conferidos; manifesto sanitizado local ignorado. Nenhum POST/DELETE/PUT Merchant ou alteração de banco/configuração foi executado.

Web mais recente que workers, mas nove arquivos Merchant/transporte/guardas/worker idênticos entre os três, estáveis e sem reinícios. Produção comercial/acompanhamento0. Não houve deploy ou código novo para produzir evidência.

Três vídeos, comprovação no Portal do Parceiro TESTE, export HTTP Requests, correlação da filmagem, links Drive e leitura da resposta específica34526755 **não concluídos**: Computer Use interrompido por URL do Chrome não identificada com segurança, inclusive após o usuário colocar a aba/barra em primeiro plano. Não é problema de login nem validação sintética aceita. Notificação de atualização34526571 conferida por e-mail, mas não traz o checklist completo. A UI de detalhes completos Merchant é lacuna de exibição comprovada, ainda sem ajuste nesta execução; editor existente suporta os turnos pedidos.

[Preparação, estados reais e cuidados de restauração](MERCHANT-HOMOLOGACAO.md#preparação-das-três-gravações--12102026). Nenhum vídeo ou material enviado ao iFood/Drive, nenhum compartilhamento externo autorizado. Snapshot atual preservado; não declarar restauração/validação pelo Portal de ensaios que não ocorreram.

## Recebimento real exclusivamente em acompanhamento — execução de 09/10/2026

**Autorização atual:** corrigir, validar, publicar, configurar credenciais próprias, solicitar/confirmar a loja real identificada e ativar somente Acompanhamento — Takeat após as validações. Substitui os limites documentais de preparação anteriores; mantém todos os bloqueios técnicos e produção comercial=0. A Takeat permanece responsável por operação, impressão e fiscal.

| Cenário / ambiente | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Revisão conjunta / publicação | Preservar melhorias recentes sem downgrade | Ajustes iFood publicados em 71a0c3cdee3edd13b3b67940edba4da6f23fda4b; primeiro alinhamento bc61ca5316c0 estável/zero reinícios. Main depois avançou a a236899ba824e6b6372ecd31bc537cead35f4565 por outra frente: nove linhas CSS da lateral e seu registro, sem alteração de backend/migrations. Preservada e incorporada na branch (c449d525). Dokploy suglzHpqTq-bCa3Eu5Yet done às18:13:17Z; os três serviços alinhados à imagem sha256:dc0a0e7a4a8716b064b4e2e427acfc9d94fc94abb27acd194691794e692adaf4. Alterações locais da raiz preservadas |
| Janela / banco e interface isolados | Duração de 1–120 minutos no servidor; retry não prolonga | Correção mínima de limite inferior e chave de nova preparação. 15/15 focados (13 banco, dois consumidores); retry incerto conserva chave, sucesso libera nova tentativa |
| ACK / PostgreSQL isolado e HTTP simulado | Lotes compatíveis com guia e checklist; commit anterior ao ACK | Coletor limitado a 2.000; guarda HTTP de 10.000 preservada. 2.001 eventos duráveis produzem lotes [2.000,1] em ciclos distintos, sem ID estranho/duplicado. 26/26 integração passaram. Massa usa metadata cifrada sintética compartilhada para evitar 2.001 derivações de chave no preparo; não afrouxadas asserções |
| Regressão conjunta / isolado | Preservar gestor, ações/permissões, efeitos e retomada | 2.849 testes / 293 arquivos aprovados; 344 testes / 27 arquivos ignorados. Node 22, execução serial, banco local teste_ifood_piloto_teste, flags IFOOD/PEDIDOS/MCP ativadas. Duração 1.029,03s, sem falhas; avisos de compatibilidade pg. Bateria carregada antes do ajuste ACK, coberto depois pelo focused 26/26 |
| Gates C / revisão conjunta | Validar antes da promoção | Lint global, lint:design (8 bases/349 consumidores), Prisma validate/generate7.10.0, TSC completo, build webpack Node22 e diff passaram. Build: 86 páginas; aviso conhecido middleware/proxy, sem erro. Smoke compilado: login200, gestor sem sessão307, host desconhecido/divergente421; preview próprio encerrado. Nenhum teste financeiro no banco operacional |
| Backup / servidor privado | Dump íntegro e configuração preservada antes da migration | <BACKUP_PRIVADO> dump 60.019.046 bytes, 0600, SHA256 6c865cd1fd7e08943400055e4116fedd60bc243f1d6fa0ddf000de06b2083d18, pg_restore --list exit0. Snapshots privados dos três serviços, sem exposição de Env |
| Coexistência / contrato oficial | Resolver relação aplicativo/device sem presumir nova homologação | Guia PTBR Polling consultado no Chrome confirma device por app/credenciais, ACK independente e eventos de outros consumidores. Prova documental não equivale a ensaio real entre aplicativos |
| Chamados / Portal | Complementar questão específica sem duplicar | 34526755: comentários enviados às 14h07 (enquadramento/presença) e 14h49 (qual usuário/fluxo aprova o merchant TESTE para o app próprio). 34526571: resposta enviada às 14h44, identificando este mesmo protocolo original, interesse no agendamento, formato das evidências e divergência de permissão Merchant. Persistência conferida após reabrir cada chamado; ambos Em análise. Order/Events aprovados preservados |
| Loja real / Portal | Identificar sem suposição ou tocar Takeat | CNPJ empresarial retornou Tábua de Frios - Grazing Table & Co, merchant 7e3dff3e-1519-440f-b722-89746bc6c596, nome correspondente na Takeat. App HUB próprio 706fa43c…; solicitados somente ORDER/EVENTS para real e teste, após aceite específico do responsável. Real aprovada pessoalmente pelo usuário e exibida Ativo; teste ainda Aguardando Ativação |
| Credenciais / API somente leitura | Token e permissões efetivas antes de receber | Próprias persistidas na fonte privada Dokploy e propagadas aos três serviços; arquivo TESTE e suas variáveis íntegros. Ambas flags de produção=0, whitelist restrita ao merchant real identificado. Após aprovação real e mais de dez minutos, token novo200/expiresIn21599, listagem200 vazia e detalhes403. Authentication oficial exige permissão merchant para a listagem; causa do403 não presumida. Nenhum polling real, comando ou vínculo forçado |
| Takeat / somente leitura | Evidência independente, sem alteração | Painel acessível, pedidos iFood recentes; Portal do Parceiro mostra Takeat e Takeat Produção Ativo. “Conectado0/2” da Takeat refere-se a WhatsApp. Não prova conexão iFood atual; nenhum pedido/configuração/integrador removido ou alterado |
| Migration / configuração após publicação | Estrutura compatível e configurações anteriores conservadas | 20261008018000_ifood_acompanhamento aplicada às 17:41:38Z, checksum idêntico a71a, seis colunas presentes. 17 arquivos runtime conferem com a revisão. Env anterior, rede, comandos e mounts conservados nos três serviços, exceto adições privadas iFood autorizadas. Configuração fiscal comparada somente por leitura; um certificado no banco, sem conteúdo/senha ou chamada externa |
| Configuração autenticada no HUB / PRODUCAO | Preparar sem substituir TESTE nem ativar recepção | UI existente salvou CENTRALIZADO, ativo=false; consulta autorizada obteve token válido, mas lista de lojas vazia, seletor sem opções e Vincular loja desabilitado. Banco às17:56:12Z: duas integrações separadas, TESTE ativa/uma loja autorizada, PRODUCAO inativa/zero lojas. Evidência privada configuracao-producao-inativa-dialogo.png |
| Filas após reinício / servidor | Preservar pedidos/ACK/ações e ausência de efeitos TESTE | 27 PROCESSADO +5 DESCONHECIDO, todos ACK, zero PENDENTE/FALHOU; 11 ações CONFIRMADA, nenhuma incerta/pendente. Oito pedidos TESTE: zero títulos, pagamentos externos, tratamentos financeiros, créditos aplicados, documentos fiscais e reservas. movimentarEstoque=false; autoaceite sem rotina/flag ativada |
| UI / ambientes sintético e servidor | Validar campos, teclado, responsividade e configuração privada | Configuração sintética desktop/celular sem transbordamento; campo rejeitou2a, aceitou2; Tab alcançou preparação. Pedido sintético de acompanhamento sem comandos/comanda e fiscal indisponível. [Captura desktop da duração](evidencias/configuracao-janela-desktop-20261009.png); novas capturas de celular/pedido falharam no navegador, sem inferir falha funcional. UI autenticada publicada salvou PRODUCAO e consultou permissões sem mostrar segredos |
| Ensaio entre aplicativos / iFood TESTE | ACK independente e atualização externa oficiais antes de receber real | Ainda NÃO executado: app próprio tem TESTE Aguardando Ativação; Portal do Parceiro acessível mostra somente a loja real. Solicitação específica enviada no34526755. Dois tokens do TEST(C) não substituem dois aplicativos; não usar fila real nem converter o vínculo TESTE com histórico operacional para forçar o ensaio |
| Janela e primeiro pedido real | Ativar somente após os gates e comparar pedido natural | NÃO iniciados. Nenhuma loja PRODUCAO vinculada no HUB, flag específica de acompanhamento=0, nenhum primeiro pedido real observado. Não registrar “recepção ativada” ou “recebimento comprovado” |
| HTTPS após publicação / sem sessão | Entrada acessível e gestor protegido | pedidos.grazinghub.com.br/login HTTP 200; /vendas/pedidos HTTP 307. Configuração autenticada conferida na mesma aplicação publicada; nenhuma operação sobre pedido real |
| Sucessora visual / sem regressão do worker | Preservar a publicação alheia e validar a revisão conjunta | a236 contém exatamente o backend iFood de71a: 17 hashes runtime e checksum de migration conferidos novamente. A frente visual registrou121 testes de navegação/Central, lint/design/TSC/build aprovados em seu TASKS; essa bateria não foi apresentada como reexecução pela frente iFood. Configurações privadas, rede, comandos, mounts, flags0 e filas conservados ao alinhar a nova imagem |
| Estabilidade final / servidor | Mesma imagem efetiva e retomada sem alteração de configurações | Às 18:16:42Z, web 8e87ee6e224a estável por202s; coletor702f4b969fe2/processador97ce1191c9e6 por112s, todos Running/zero reinícios e imagem dc0a0e7a4a87. Comparação com snapshots pré-publicação confirmou Env anterior, rede, comandos e mounts; preservados fonte fiscal banco e ambas chaves reais0 |

Logs locais ignorados em .tmp/ifood-ativacao e .tmp/ifood-piloto; runtime-leitura-71a.json/runtime-final-71a.json/runtime-final-a236.json, capturas privadas sanitizadas de solicitações, complementos e configuração pausada. Nenhum payload completo de pedido real versionado. Prévia e PostgreSQL de testes próprios encerrados, arquivos preservados. Registro pós-publicação somente na branch: não disparar outro deploy documental.

**Estado final: implementação publicada e validada localmente; recepção real NÃO ativada, sem janela ou primeiro pedido comprovado.** A autorização pessoal no Portal foi concluída. Restam liberação efetiva das leituras da loja pela API (34526571), aprovação do mesmo merchant TESTE para as duas credenciais e ensaio remoto, além de procedimento comprovado de presença/enquadramento (34526755). Nenhuma exigência de nova homologação foi inventada. A rotina administrativa restaurar foi rejeitada pela revisão automática por poder alterar configuração fiscal fora do escopo; substituída pela comparação somente de leitura, que confirmou preservação integral e dispensou restauração. Nenhuma proteção foi contornada.

## Histórico: piloto temporário preparado — primeira etapa de 09/10/2026, America/Sao_Paulo

**Implementado em branch, inativo e ainda não testado com o iFood nesse modo.** Reutilizada a revisão conjunta b9d2f0fe, incorporada anteriormente nesta branch (base d27713c3). Não houve deploy, vínculo de loja real, consumo da fila real, troca de credenciais ou alteração da Takeat. Order/Events aprovados anteriormente; isso não aprova o enquadramento consultivo temporário nem encerra Merchant.

| Requisito | Reutilizado | Lacuna comprovada / ajuste mínimo | Validação e limite |
|---|---|---|---|
| Eventos e registro único | Coletor, inbox durável, ACK, processador, PedidoVenda/PedidoIfood e histórico | Modo por LojaIfood, janela UTC e marcador permanente no pedido; filtro de recepção separado; lock da loja sem pular evento concorrente | PostgreSQL local, HTTP sintético: gravação antes do ACK, recuperação de ACK falho, duplicidades paralelas e eventos externos convergem no mesmo pedido |
| Somente acompanhamento | Autenticação, leituras e ACK existentes | Bloqueios de ações iFood/Merchant no serviço e transporte; correspondência estrita loja/filtro de polling; nova autorização de recepção real por uma única loja | Administrador, server action/API, MCP e filas de ações sintéticas não enviam comandos. Identificadores públicos diferentes e token próprio validados em simulação; independência das filas/devices ainda requer prova oficial |
| Sem efeitos operacionais | Gestor, financeiro, estoque, produção e rotas de comanda existentes | Financeiro EXTERNO, zero projeções/títulos/baixas; guardas de edição, custos, fiscal e ambas rotas de impressão; sem criar tarefa operacional | Testes em banco descartável, incluindo tentativa de baixar título sintético e fila fiscal inválida. Nenhum título operacional ou emissão real. Estoque e autoaceite permanecem desligados |
| Identidade e atualização | Estados remotos, itens/snapshots cifrados e linha do tempo | Rótulo Acompanhamento — Takeat no gestor, detalhes e MCP; preserva isTest recebido. HSS parcial não se encerra por OPA sem mudança comprovada | Interface sintética de produção não mostra TESTE, comanda ou comandos; eventos de confirmação/preparo/cancelamento de outro aplicativo e atrasados exercitados localmente |
| Reinício e pausa | Entrypoint real Node, filas e tentativas persistidas | Recepção/processamento respeitam janela e gates; pedidos marcados continuam protegidos após pausa | Quatro casos de retomada passaram em filhos Node separados, PostgreSQL/HTTP simulados e sem navegador. Identidade de inicialização própria evita falsa falha por reutilização de PID no Windows |
| Presença e enquadramento | Polling oficial e homologação Order/Events preservados | Fail closed: gates desligados, merchant exato, janela supervisionada até 120 min e referências de orientação; sem excludeHeartbeat | Essa proteção limita ativação/duração; NÃO comprova queda da presença da Takeat durante a janela. Resposta oficial e ensaio de coexistência são condições anteriores à ativação |

### Evidências e verificações

- Bateria ampla inicial: 2.802 casos passaram; falhas de concorrência corrigidas e repetidas. Dois conjuntos exigiam nome de banco teste_*; usados depois no banco local teste_ifood_piloto_teste, sem afrouxar suas proteções. Testes desabilitados por opt-in de outros domínios não são aprovação.
- Fechamento focado: 64 cenários únicos aprovados em execuções coordenadas — piloto 11/11 (inclui HSS/OPA sem mudança e filtro de polling), integração iFood 25/25, interface 7/7, pedidos manuais/regras de pagamento 10/10, fiscal sintético 7/7 e retomada 4/4. Somente HTTP/dados sintéticos; todos os efeitos financeiros foram conferidos em banco local isolado.
- Retomada: 4/4 após corrigir somente a evidência de identidade do filho; nenhuma regra do servidor ou asserção comercial foi afrouxada.
- Prisma validate/generate, typecheck, lint e lint:design aprovados (8 bases; 347 consumidores TSX). Lint excluiu somente artefatos locais .cache/.tmp e o cluster temporário; nenhum arquivo de código da revisão foi excluído. Build webpack com Node 22/Next 16.3.4 aprovado, incluindo TypeScript. Aviso preexistente jose/DecompressionStream no Edge permanece fora do escopo. Smoke local compilado: login 200, gestor sem sessão 307, host desconhecido 421, cabeçalhos de proxy coerentes. Nenhum deploy foi executado.
- UI em ambiente sintético: desktop (1707 px) e celular (434 px efetivos), sem transbordamento horizontal. Campos filtram caracteres, navegação por Tab, preparação com feedback e recepção bloqueada. Artefatos: [pedido desktop](evidencias/acompanhamento-desktop-20261009.png), [pedido celular](evidencias/acompanhamento-celular-20261009.png), [configuração desktop](evidencias/configuracao-acompanhamento-desktop-20261009.png), [configuração celular](evidencias/configuracao-acompanhamento-celular-20261009.png). Não são capturas de produção nem aprovação humana de novo padrão.
- Logs brutos sintéticos ficam localmente em .tmp/ifood-piloto (ignorado no Git); diagnósticos operacionais conservam acesso/retenção já descritos em OPERACAO, sem publicar payloads privados.

### Dependências externas e próxima ativação

1. [Complemento preparado, não enviado](MERCHANT-HOMOLOGACAO.md) ao chamado 34526571: esclarecer PDV consultivo temporário, devices/ACK independentes e proteção oficial de presença. Envio exige autorização específica; nenhum chamado duplicado ou reinício.
2. Ensaio oficial com loja de teste dedicada, sem histórico operacional prévio no HUB, e aplicativo principal independente: confirmação/atualização externa, deduplicação, coexistência e perda de presença. Vínculos com pedidos operacionais anteriores não são convertidos para acompanhamento. Mocks não concluem essa etapa.
3. Somente após as respostas e o ensaio: autorização expressa para receber dados reais de uma loja numa janela supervisionada. Isso não autoriza comandos, títulos, emissão ou transição da Takeat. Credenciais definitivas continuam inativas e IFOOD_PRODUCAO_AUTORIZADA=0.
4. [Operação/ativação/desativação somente do piloto](OPERACAO.md): aplicar migration aditiva e publicar mesma revisão nos três serviços apenas no fluxo autorizado futuro; nenhuma publicação operacional nesta preparação. Emissão fiscal e cenários pendentes do chamado 34526755 seguem separados.


## Fechamento interno e alinhamento — 08/10/2026, America/Sao_Paulo

**Aplicação, coletor e processador alinhados à revisão funcional `b9d2f0fe13b2f1802acca491550241eb789bfa44`.** A publicação CRM já em andamento terminou normalmente; não foi reiniciada nem revertida. A branch iFood incorporou a main em `07dd2524` e validou o código conjunto. Nenhuma alteração funcional, migration ou nova interface foi necessária: acrescentados somente testes de retomada em processos reais e este registro. Não houve novo deploy web para documentação/testes.

| Cenário / ambiente | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Revisão conjunta / servidor | Mesma revisão validada, sem downgrade ou perda de outras frentes | Deployment oficial b9d2f0fe concluído em 08/10 20:38:52.363Z. Web e workers executam `sha256:cae7c40cf5e5d71d85a632cfe5af7bfb4cf78571e0f6aef98ad49340c527496c`. 393 arquivos de servidor, configuração e migrations coincidem com a revisão local validada: manifesto SHA256 `6772864d4300f8d0de6169e1dea85fe32ddfbba4dfaaa9b90377a7604ec5d743`. Prisma: 117 migrations, schema atualizado |
| Alinhamento / reinício real dos serviços | Atualizar somente workers, conservar filas/configuração e estabilizar | Instalador existente verificou Env/rede antes de aplicar. Novos contêineres coletor `7cffe6ab47af` e processador `448ab86a470a`, início 09/10 01:06:23Z (=08/10 22:06:23 SP), Running e zero reinícios após mais de seis minutos. Web `d46b013f8839` preservada. Env, rede e comandos iguais aos snapshots privados; integridade TESTE/definitivas igual, arquivos 0600 |
| Recepção sem interface / isolado | Processo servidor persiste antes de ACK e retoma após falha | Novo `retomada-worker.test.ts`: entrypoint verdadeiro em filhos Node separados, PostgreSQL isolado e HTTP simulado. ACK exige evento já persistido; 503 e novo processo retomam; eventos repetidos/diferentes não duplicam pedido, itens ou histórico. Nenhum navegador participa desse ensaio |
| Confirmação / iFood TESTE | Receber PLC, enviar uma vez e concluir somente por CFM posterior | Pedido #12, externo `9b9c92e0-938d-4827-a0eb-d653a04d3aa4`, interno `registro-sintetico-25`, IMMEDIATE. PLC recebido 09/10 01:10:07.889Z, ACK 01:10:08.327Z; pedido criado 01:10:09.222Z pelos workers antes de abrir sua tela. Envio confirm 01:10:58.989Z, uma tentativa; CFM oficial 01:10:59.403Z, recebido/ACK 01:11:09Z. UI Confirmado, ação CONFIRMADA. Outros gestores/abas do usuário não foram fechados: este ensaio remoto não é comprovação de Chrome inteiramente fechado |
| Cancelamento / iFood TESTE | Aguardar CAN, sem conclusão local antecipada ou reenvio | Motivo oficial 501, justificativa de encerramento do teste. Envio requestCancellation 01:12:12.772Z, uma tentativa; CAN oficial 01:12:13.937Z, recebido 01:12:40.656Z e ACK 01:12:40.885Z. Pedido CANCELLED/CANCELADO, versão 4, ambas ações CONFIRMADA; zero títulos e reservas. Captura privada da comanda #12 mostra aviso NÃO PREPARAR; não foi impressa fisicamente |
| Conteúdo / iFood TESTE | Preservar valores, adicionais, horários e origem | #12 total R$27, dois itens/quatro complementos, Visa R$17 e Master R$10, entrega pela loja; preparo 08/10 22:10:06 e entrega 22:55:06 SP. Vínculos pendentes mantidos, sem cadastro inventado. É imediato: não prova janela/agendado nem subsídio |
| Permissões no envio / isolado | Sessão/usuário/permissão vigentes no momento do POST | Suítes iFood e seis casos MCP focados passaram, incluindo revogação entre enfileirar e executar e efeito pendente sem autorização antiga. Não se alterou permissão de usuário real para testar |
| Resultado incerto e atraso / isolado | Não reenviar nem declarar sucesso sem evento correlacionado | Filho Node encerrado durante POST após ENVIANDO durável; novo processo converte em INCERTA sem segundo POST e CFM posterior resolve. CFM antigo não confirma outbox; testes existentes preservam terminal diante de evento atrasado/desconhecido. Só relógios de retentativa/ação sintéticos antecipados; datas de pedidos oficiais intactas |
| Financeiro / banco local isolado | Precisão, subsídios/taxas, cancelamento e baixas preservadas | Suítes financeiras de pedidos/iFood executadas em `grazing_ifood_teste`, localhost:55441, schemas descartáveis. Nenhuma credencial operacional. Ensaio remoto #12 e todos os oito pedidos importados TESTE sem títulos/reservas na carteira operacional |
| Eventos desconhecidos / servidor | Preservar diagnóstico sem forçar estado ou zerar contador | Quatro DDCR históricos conservados; #12 trouxe mais um DDCR oficial, também ACK/persistido e DESCONHECIDO. Não afeta confirmação/cancelamento. Limite contratual registrado em CONTRATOS; nenhuma mudança de estado inventada |
| Saúde final / servidor | Retomar polling, conservar histórico e não deixar ações ambíguas | Em 09/10 01:20:32.120Z (=08/10 22:20:32 SP), polling 01:20:17.143Z e último recebimento 01:12:40.661Z, ativa/autorizada e sem erro. Oito pedidos/oito externos únicos, todos CANCELLED; 27 PROCESSADO/cinco DESCONHECIDO, zero sem ACK e 11 ações CONFIRMADA. Zero títulos/reservas TESTE |
| Papel / relato do usuário | Conferência física separada de tela/PDF | #9 imediato, versão 4, canceled, formato selecionado 80 mm, dois itens/quatro complementos e aviso PEDIDO CANCELADO — NÃO PREPARAR. Após “Vou imprimir e informar o resultado”, usuário informou “tudo certo”. **Conferência física aprovada pelo relato**, sem foto/modelo da impressora informado. Agendado válido e seu papel continuam pendentes; não implementada impressão automática |

Validações finais não sobrepostas: sete arquivos de domínio/consumidores **144 testes**, quatro arquivos de interface/Merchant/configuração **14**, MCP **seis** (258 ignorados pelo filtro), novo entrypoint **três**: **167 aprovados** em 13 arquivos. Opt-ins IFOOD_BANCO_TESTE, PEDIDOS_BANCO_TESTE e MCP_BANCO_TESTE ativados exclusivamente em banco local de teste. ESLint focado, lint:design (8 bases/346 consumidores), typecheck completo, Prisma validate/generate e build webpack aprovados. Primeiro build encontrou ENOSPC; removido apenas cache .next deste worktree e reexecução aprovada. Smoke compilado: login 200, rotas protegidas 307 sem sessão e host desconhecido 421; Host/X-Forwarded-Host coerentes exigidos pelo projeto. Sem regressão global repetida, pois não houve mudança transversal funcional.

Logs locais ignorados: `.tmp-ifood-{integracoes,mcp,interface,retomada-final,typecheck-final,build-final}-20261008.log`. Fixture `worker-http.fixture.mts` bloqueia saída de rede fora do cenário e usa credenciais sintéticas. Snapshots privados pré-alinhamento em `<BACKUP_PRIVADO>`; nenhum dump de operação restaurado nem fila removida. Captura sintética/privada `ifood-comanda12-recibo-final.jpg` no espaço desta sessão, não no Git.

**Limites restantes:** agendado válido, negociações parciais/alternativas e benefícios remotos continuam dependentes do cliente/cenário oficial no chamado 34526755; Merchant não foi declarado aprovado (34526571). Order/Events aprovado foi preservado e conferido novamente no Portal, sem nova homologação/ticket. Fiscal: levantamento e decisões E01–E03 em OPERACAO; nenhum emissor escolhido nesta tarefa. Takeat/loja real intocados, credenciais definitivas inativas, produção=0, estoque/autoaceite desligados. Estes resultados fecham as verificações internas enumeradas, não todos os cenários externos nem entrada em produção.

## Preparação pós-homologação — 08/10/2026

Retomada sobre 095fff71 na branch de integração, sem alterações funcionais. Estado atual comparado com origin/main 8c627a2d; trabalho de outras frentes preservado. Portal Chrome autenticado, sem nova entrada/segredo solicitado ao usuário.

| Cenário / ambiente | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Aprovação formal, Portal | Confirmar app e módulos individualmente | Grazing HUB / grazing-hub, app 706fa43c-5642-4477-8805-a956eb38a267, PDV centralizado, Parcialmente homologado. Homologação EVENTS, ORDER Aprovado, início 06/10 e conclusão exibida 08/10. O usuário informou comunicação em 07/10; datas preservadas como fontes distintas. Não reiniciado o processo |
| Merchant 34526571 | Conferir resposta própria, sem inferir aprovação do e-mail geral | Em análise. Suporte em 08/10 às 12h26 pediu esclarecer o apoio necessário. Às 16h40, respondido: avaliação/liberação específica dos oito endpoints já comprovados, ou orientação de agendamento/evidência adicional. Persistência conferida após reabrir o chamado; sem novo ticket ou pedido de acesso real |
| Credenciais definitivas, servidor privado | Separar app próprio do TEST(C), sem ativação | Client Credentials disponível; valores transferidos cifrados para producao.json 0600, diretório 0700. Arquivo TESTE íntegro antes/depois; chaves/env dos serviços não alterados. Definitivas não injetadas no runtime, sem token definitivo/listagem de lojas. Temporários cifrados e chave de transferência removidos. Nenhum segredo em evidência |
| Permissões do aplicativo próprio | Não solicitar loja real | Portal informa nenhum merchant autorizado. Módulos selecionados nos detalhes: order/events/merchant; apenas Order/Events têm aprovação formal visível |
| Cliente de teste, Portal | Verificar se aprovação desbloqueou o cadastro | Revalidação do e-mail exclusivo previamente reservado ainda retornou Falha ao cadastrar e-mail, sem código/motivo. Conta de consumo real e conta do restaurante preservadas. Nenhum pedido adicional gerado só para repetir IMMEDIATE |
| Agendamento 34526755 | Identificar procedimento oficial para retomar testes | Sem resposta técnica nova. Complemento enviado em 08/10 às 16h45 e conferido após reabrir: erro persiste após aprovação, pedir regularização do cliente, SCHEDULED válido e cenários de parciais/alternativas/benefícios, sem reinício da homologação. Sem contatos, segredos ou payloads completos |
| Saúde TESTE, leitura do servidor | Fila durável saudável e nenhum efeito operacional de teste | Às 19:44:16.753Z, último polling 19:43:51.261Z, último evento 07/10 17:39:33.968Z; autorizada/ativa, sete pedidos/sete IDs internos, todos CANCELLED, 24 PROCESSADO/quatro DDCR DESCONHECIDO. Zero sem ACK, ações pendentes, títulos e reservas de teste. Estoque=false, produção=0 nos três serviços. Sem evento novo: comprova continuidade do coletor, não novo ensaio de pedido |
| Versões em execução | Identificar pré-condição de ensaio conjunto | Web sha256:3d3896d1ca202b6b56ee46bf67878738b7f84f94b271bbfd3e84e389b72a958e; ambos workers sha256:fad3f8fa9a7f38678ae5fcad4e45a0219d69805d2adbbfc42606d1d4cb73972f (b304a6a9). A web mudou por outra publicação; seu commit não foi inferido da imagem. Alinhamento à revisão validada é requisito antes do próximo ensaio completo, especialmente MCP/financeiro; não promovido código de outra frente nesta preparação |
| Parciais, alternativas, benefícios e agendado válido | Comprovar eventos/dados oficiais | Não executados novamente: cliente permanece bloqueado e suporte não forneceu geração de SCHEDULED válido. Implementação e testes isolados anteriores não substituem essa evidência |
| Financeiro / impressão física | Isolamento do banco e comprovação em papel | Nenhum teste financeiro operacional ou impressão efetuado. Resultados isolados de 07/10 preservados como históricos da respectiva revisão; não atribuídos à main nova. Roteiro físico aguarda pedido válido; usuário será chamado somente na conferência do papel |
| Fiscal / transição | Identificar lacunas sem implementar nem tocar Takeat | Estrutura fiscal existente comparada com main; provedor.ts retorna null, sem emissor externo. Plano de pré-condições, corte, primeiros pedidos e retorno em OPERACAO. Exige emissão validada e autorização expressa futura |

Capturas da aprovação e dos complementos guardadas somente no espaço privado da sessão; resumo sanitizado versionado. A aprovação é formal para Order/Events, os oito requisitos Merchant têm ensaio remoto histórico, e os demais cenários continuam pendentes. Nenhuma migration, nova implementação/UI, build ou deploy nesta preparação. Validação documental: diff, caminhos/links e ausência de segredos/dados pessoais. Credenciais preparadas não significam produção ativa. Kairu indisponível; nenhum checklist externo alterado.

## Retomada de fechamento — 07/10/2026, a partir de b304a6a9

**Enviados pelo Portal oficial, autorizados pelo usuário:** Merchant **34526571**,
07/10 13h24; agendamento **34526755**, 13h28, America/Sao_Paulo. Ambos Em análise.
Merchant recebeu triagem às 13h25; resposta com identificação empresarial já
cadastrada, escopo somente Merchant e primeira solicitação publicada às 13h33.
Às 13h35, suporte confirmou triagem recebida, encaminhamento à equipe técnica e
bloqueio da homologação até cadastro finalizado e aprovado. O responsável atualizou
o perfil diretamente no Portal; conferência posterior mostrou Organização com dados
salvos, sem Passo 1 de 2/formulário pendente, e perfil Profissional na aba Usuário.
Às **14h13**, regularização informada neste mesmo chamado e conferida no histórico,
solicitando confirmação cadastral e continuidade do agendamento Merchant. Não há
aprovação Merchant comprovada. Dados pessoais/captura do perfil não enviados.
Agendamento só recebeu confirmação
automática, sem orientação técnica até a leitura desta retomada. Links e resumos
sanitizados em MERCHANT-HOMOLOGACAO.md e SUPORTE-AGENDAMENTO.md. Sem anexos,
credenciais, CPF, contatos de clientes ou payloads completos enviados.

### Três eventos preservados: DDCR / DELIVERY_DROP_CODE_REQUESTED

| Evento externo / ocorrido UTC | Pedido externo / interno | Impacto observado |
|---|---|---|
| 3e2cac09-c5d5-4102-b7f1-8621c0fbf35b / 2026-10-07T00:40:52.409Z | 0eb3d21d-df4a-4ac3-b7e1-a75451c5447c (#8950) / registro-sintetico-26 | ACK 00:41:06.812Z; sem transição; pedido atualmente CANCELLED |
| 853a8e1f-1112-498f-9475-a64bc36a8029 / 2026-10-07T00:41:13.218Z | f6f29116-efdf-4f3d-805c-cb2fdde2cc5e (#5535) / registro-sintetico-27 | ACK 00:41:37.532Z; sem transição; pedido atualmente CANCELLED |
| 3241c27a-3647-41a3-9d15-7e1a02fadb91 / 2026-10-07T00:42:11.830Z | b0ebecea-ec7b-43c1-8fda-7bd4eb2f4926 (#4629) / registro-sintetico-28 | ACK 00:42:38.768Z; sem transição; pedido atualmente CANCELLED |

Todos isTest=true, salesChannel=IFOOD, DELIVERY/MERCHANT, metadata={}. Significado:
aviso de solicitação de código para validação da entrega, documentado em Logistics;
Shipping POS tem outro uso com metadata.CODE. Não implica entregue, preparo ou
cancelamento. Referência Food e guias reconferidos não comprovam obrigação de nova
ação Food para esse aviso: mantidos os três DESCONHECIDO, sem descartar, reprocessar
às cegas, liberar ação por inferência ou forçar contador a zero. O comando Food
verifyDeliveryCode existente permanece com seus guards. Fontes/limite em CONTRATOS.

O pedido de diagnóstico #9 recebeu um **quarto aviso do mesmo tipo**: evento
e27a9a8f-d5d1-4ffd-984d-e56cf19b3bef, ocorrido em 2026-10-07T17:29:25.160Z,
ACK 17:29:54.982Z, pedido externo ffcde7fc-71d0-4d17-a5b2-3c8542de9f68 /
interno registro-sintetico-29. Metadados vazios, DELIVERY/MERCHANT, isTest=true;
permanece DESCONHECIDO e o pedido posteriormente CANCELLED por CAN oficial.
Aviso chegou no lote que continha CFM, sem causar nova transição ou efeito.
Os três originais e este novo registro permanecem rastreáveis; contador não zerado.

| Cenário / ambiente | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Gerador oficial, TESTE | Identificar controles de agendamento/negociações/benefícios | Somente loja e categoria FOOD. Nenhum novo cenário especializado gerado; Order/Events não reiniciado |
| Cliente oficial de teste | Cliente distinto do usuário real, autenticado no site/app de pedidos, para provocar HSD e alternativas | Perfil Developer atualizado/conferido. Gerador associou #9 ao cliente padrão noreply@developer.ifood.com.br. Tentativa de cadastrar o e-mail corporativo reservado a testes retornou **Falha ao cadastrar e-mail**, sem causa/código na UI; não confirmada. Entrada do cliente também não concluída. Não reutilizamos conta de consumo real ou cadastro do restaurante. Dependência acrescentada no chamado 34526755 às 14h44 |
| Financeiro e negociações, PostgreSQL local isolado + HTTP simulado | Preservar totais/baixas, deduplicar efeitos, tratar parcial/alternativas e incerteza | **31 testes aprovados** (24 PostgreSQL + 7 negociação/valores), 32,17 s. `npm exec vitest -- run testes/ifood/integracao.test.ts testes/ifood/negociacao-valores.test.ts --maxWorkers=1`, IFOOD_BANCO_TESTE=1, localhost:55441/teste_ifood. Schema exclusivo criado/removido pela suíte; sem banco operacional |
| Preparação do banco local | Testar com isolamento real disponível | Primeira execução impedida por spawn EPERM; fora do sandbox detectou PostgreSQL parado (ECONNREFUSED, 24 não executados). Instância local existente retomada; execução final acima aprovada. Não afrouxadas asserções/limites nem alterado código |
| Parcial / composição financeira, local | Cancelamento parcial não cancelar pedido inteiro nem sobrescrever baixa | Subsídio IFOOD 3,00 + pagamento 21,70 − taxa 1,00 = título único 23,70; geração repetida não duplica. HSS parcial espera OPA com mudança real de detalhes. Baixa 23,70 preservada após novo total 11,60; ajuste pendente, sem repasse bancário ou reserva |
| Parcial / alternativas / patrocínio, iFood real | Evento e detalhes oficiais com cenário solicitado | **Não realizado nesta retomada**: sessão do cliente no site/app de pedidos ainda não disponível; gerador sem controles. Seis snapshots existentes têm benefits=0 e additionalFees=1; não comprovam subsídio real. Aguardam acesso do cliente e cenário efetivamente oferecido pelo fornecedor |
| Operação independente do navegador, TESTE | Polling/ACK/fila ativos sem aba HUB | 16:49:54.432Z: último polling 16:49:49.699Z; seis pedidos/seis IDs internos únicos, 21 PROCESSADO e os três DDCR, zero sem ACK/FALHOU/PENDENTE. Sete ações Order e seis Merchant CONFIRMADA; zero títulos e reservas de teste |
| Saúde após atualização do cadastro, TESTE | Workers permanecem ativos sem tela HUB e sem efeitos operacionais de teste | 17:22:17.098Z: último polling 17:21:47.082Z; loja autorizada/ativa, seis pedidos/seis IDs únicos, 21 PROCESSADO/três DESCONHECIDO, zero sem ACK, títulos e reservas de teste. Produção=0. Sem novo pedido: esta leitura comprova saúde do coletor, não novo cenário remoto |
| Novo diagnóstico #9, iFood TESTE | Conferir cliente vinculado, recepção sem tela e ações oficiais sem efeitos operacionais | Gerador FOOD criou ffcde7fc-71d0-4d17-a5b2-3c8542de9f68 (#1944 remoto/#9 interno), IMMEDIATE/isTest=true, criação e preparo 17:26:46.365Z, sem schedule. HUB estava about:blank; PLC persistido 17:26:51.665Z, ACK 17:26:51.904Z, único PedidoVenda registro-sintetico-29. Confirm enviado pela UI 17:29:24.290Z dentro do prazo 17:34:46.365Z; CFM recebido/ACK 17:29:54.782Z/17:29:54.982Z. Não solicitado início de preparo. Encerramento do diagnóstico pelo motivo oficial Problemas de sistema na loja, com justificativa explícita de pedido sintético/cliente padrão: requestCancellation enviado 17:39:01.071Z, CAN recebido/ACK 17:39:33.960Z/17:39:34.247Z. Ambas ações CONFIRMADA; CANCELLED observado 17:44:09.884Z; zero título e reserva desse pedido |
| Tempo limite na automação de confirmação, TESTE | Não repetir ação potencialmente enviada sem conferir | Primeira tentativa no navegador excedeu tempo; banco conferido às 17:29:15.552Z com ações=[] e PLACED. Nova tentativa pela UI só após ausência comprovada; uma única ação confirm existente e CFM oficial. Não foi timeout da Merchant API nem prova de recuperação remota ambígua |
| Valores de #9 / financeiro local isolado | Conservar total oficial, separar receita da taxa, deduplicar título e tratar cancelamento | Campos comerciais sanitizados reais: dois itens, quatro adicionais no combo, subtotal 21,00 + entrega 5,00 + taxa IFOOD 1,00 = 27,00, sem benefícios; pagamentos online Visa 17,00/Master 10,00. Adaptação sem pendências. Ensaio específico APROVADO no localhost:55441/teste_ifood: geração duas vezes produziu um título PENDENTE 26,00, uma captura sem repasse; cancelamento isolado produziu CANCELADO, zero reservas. Autor/canal/forma/vencimento sintéticos, schema exclusivo removido e instância privada encerrada. Não houve título na carteira operacional; isso não comprova subsídio ou parcial real |
| Versão/chaves, servidor | Conservar b304a6a9 e restrições | Aplicação/coletor/processador Running, mesma imagem sha256:fad3f8fa9a7f38678ae5fcad4e45a0219d69805d2adbbfc42606d1d4cb73972f. Produção=0 nos três; pedidosLiberacao=null no singleton implica movimentarEstoque=false pela política existente. Autoaceite ausente/desligado; Takeat e loja real não operados |
| Saúde final da continuidade, TESTE | Preservar unicidade, ACK e isolamento operacional | 17:56:01.280Z: último polling 17:55:49.331Z, loja autorizada/ativa, sete pedidos/sete IDs internos, 24 PROCESSADO/quatro DDCR DESCONHECIDO; zero sem ACK, títulos e reservas de teste; produção=0. Nenhuma falha ou pendência de processamento; os avisos desconhecidos continuam preservados |
| Agendado válido / impressão física | Datas oficiais coerentes, confirmação/preparo/janela e papel conferidos | **Pendentes** do SCHEDULED válido; protocolo 34526755 aguarda orientação. Roteiro físico preparado em OPERACAO; não enviado trabalho de impressão nem comprovado papel |

Sem falha de código comprovada nesta retomada: nenhuma alteração funcional, migration
ou nova publicação de aplicação. Atualização documental será sincronizada na branch
de integração; versão em execução continua **b304a6a9**. Gates desta alteração
documental: revisão do diff/links/ausência de dados pessoais; nenhum build/deploy
desnecessário. Kairu indisponível; nenhum checklist externo marcado concluído.

Sincronização documental: os dois primeiros pushes às 16:58:34Z/16:58:55Z falharam
no GitHub. Retentativa concluída nesta continuidade, com HEAD remoto **fffcc6d7**
conferido na branch; commits 8660633/fffcc6d7 preservados. Atualização cadastral,
falha do cliente e ensaio #9 enviados no commit **70bb5ddb**, HEAD remoto conferido.
Durante o fechamento, main avançou externamente para **436c6d23** (alterações MCP),
preservada sem merge/reversão nesta tarefa. Nova consulta da aplicação e dos dois
workers confirmou mesma imagem de b304a6a9 em execução, todos running/produção=0;
nenhum novo deploy iFood. Esta continuidade permanece na branch documental.

O ensaio adicional de #9 usou somente campos comerciais selecionados (sem customer,
endereço, telefone, observações pessoais ou credenciais), em arquivos `.tmp*`
privados/ignorados pelo Git. Asserções de total, itens/adicionais, obrigação, estado,
unicidade e zero reservas executadas com Node 22/tsx e schema exclusivo. Nenhuma
alteração funcional ou de teste versionado; a evidência pública é o resumo acima.

Próximos passos exatos: aguardar confirmação cadastral/agendamento no mesmo ticket
Merchant (regularização já comunicada); orientação sobre falha no cadastro/vínculo
do cliente no 34526755; após vínculo efetivo, autenticar cliente em ifood.com.br;
provocar HSD parcial e alternativas oficialmente oferecidas e pedido com patrocínio,
conferindo efeitos somente no banco isolado; obter SCHEDULED válido pelo procedimento
do suporte; então validar janela/calendário/comanda e solicitar conferência física.
Orientação específica DDCR Food permanece necessária para mudar seu tratamento.

## Fechamento publicado — 07/10/2026, 00h58 (America/Sao_Paulo)

Registro histórico anterior aos envios de 13h24/13h28. Situação vigente dos tickets,
cadastro e dependências está na retomada acima.

**Versão funcional publicada: b304a6a94dee52b5f31c7a5e2b19369d93578831**, contendo 13eb532a e a correção de relógio civil Merchant. Main e branch remotas conferidas. Dokploy concluído; tarefas estáveis aplicação 3cgs678f8b9a, coletor jvba9omms3my e processador 0xt92q1z5pll, mesma imagem sha256:fad3f8fa9a7f38678ae5fcad4e45a0219d69805d2adbbfc42606d1d4cb73972f. 106 migrations em dia. Backup privado anterior íntegro; configuração fiscal preservada, sem consultas/emissão. Evidência posterior será enviada apenas na branch documental, sem outro deploy.

| Cenário / ambiente | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Merchant, loja TESTE, GET paginado | 200 e loja autorizada na página | page=1, size=10; 200 e loja presente |
| Sem token / token fictício, TESTE | 401 em ambos | 401 / 401 pelo cliente HTTP do HUB, sem alterar token válido |
| Pausa inicial incerta após atualização/reinício de workers | Recuperar somente por GET, sem POST repetido | CONFERIR auditado; mesma tarefa CONFIRMADA com uma leitura, enquanto a aba HUB estava about:blank; pausa futura removida depois |
| Nova pausa com relógio local, TESTE | 201, recurso correlacionado e indisponibilidade efetiva | GET: 00:46:51.325–00:51:51.325, ID retornado correlacionado; tarefa CONFIRMADA; status CLOSED/available=false, unavailabilities CLOSED, is-connected/opening-hours OK |
| Pausa sobreposta / horários sobrepostos, TESTE | 409 / 400 e preservar configuração | 409 / 400; pausa única e horários anteriores preservados. Nenhum teste de carga para 429/5xx |
| Encerrar pausa, TESTE | 204, recurso ausente e reabertura | GET pausas vazio; tarefa CONFIRMADA; status OK/available=true |
| PUT múltiplos turnos, TESTE | 201, dois turnos de segunda e outros seis dias preservados | GET 200: oito turnos; segunda 00:00/120 e 09:00/120, demais dias 00:00/1439; tarefa CONFIRMADA. Não inferir horas diferentes das efetivamente registradas |
| Restauração, TESTE, tela descarregada | 201, sete turnos originais e nenhuma pausa | GET 200, sete dias únicos, 00:00/1439, nenhum turno explicitamente desativado; zero pausas; tarefa CONFIRMADA e status OK/available=true |
| Recepção / efeitos, TESTE | Unicidade e nenhum título/reserva operacional | Consulta 00:55:46: seis pedidos / seis IDs internos únicos; zero sem ACK, FALHOU, títulos ou reservas; três DESCONHECIDO preservados para diagnóstico, sem transição inventada |
| Chaves / convivência | Produção e estoque desligados; Takeat intacto | IFOOD_PRODUCAO_AUTORIZADA=0 nos três serviços; movimentarEstoque=false; autoaceite não implementado/ativado; nenhuma ação na loja real |

Gates locais e banco isolado estão detalhados abaixo: regressão completa 2.339 aprovados / 447 ignorados, impacto final 258 aprovados (24 PostgreSQL), seis testes dos consumidores após separar formatador do cliente, lint/design/tipos/build/smoke aprovados. Prévia isolada confirma edição por teclado de hora 17:31:00 preservada após renderização e alteração de duração; rascunho não salva ao perder foco. A automação fill do campo nativo time não disparou alteração React; por isso o ensaio remoto registra 00:00 e 09:00, sem alegar 09:00/14:00. Não identificado defeito de edição por teclado.

Evidências reais por API, estado persistido e DOM autenticado; tentativa de captura atual no Chrome indisponível por tempo limite. Não substituir por imagem sintética apresentada como real. Imagens da prévia são sintéticas e o relatório Order/Events anterior é captura real sanitizada.

**Dependências reais:** agendado válido (origem já devolveu preparo em janeiro, gerador manual só criou IMMEDIATE), negociações parciais/alternativas/motivos condicionais com cliente de teste e eventos oficiais, patrocínio financeiro real/casos sem alocação informada, impressão física/pareamento e liberação das credenciais próprias do app Em revisão. Merchant testado, mas ticket preparado e não enviado; depende de autorização específica e avaliação do iFood. Relatório Order/Events 100%/Concluído preservado, sem reinício. Kairu indisponível. [Checklist/ticket Merchant](MERCHANT-HOMOLOGACAO.md) e [relato de agendamento](SUPORTE-AGENDAMENTO.md).

## Publicação inicial e correção do ensaio Merchant — 07/10

13eb532a publicado; Dokploy concluído, aplicação 7w53pty5ut42 e workers jf79auyrc108 / 5m513wyxm48m na mesma imagem a5ead0f4. 106 migrations em dia, fiscal preservado sem consulta/emissão, TESTE=1 e produção=0.

Primeiro POST de pausa revelou diferença de contrato: retorno civil sem offset e ID gerado pelo iFood. A pausa foi criada futura; loja permaneceu aberta. Tarefa persistida ficou incerta, sem replay, e a tela do HUB foi retirada enquanto o worker continuou tentando apenas leituras. Correção localizada de Merchant: relógio civil do fuso configurado e confirmação por ID oficial/consulta anterior. Order/Events continua com instantes UTC estritos. 258 testes de impacto passaram; versão corretiva e novo ensaio real ainda pendentes.

## Retomada de 06–07/10 — lacunas operacionais

Reutilizados: PedidoVenda/itens/histórico, gestor/calendário/comanda, componentes da Central, tokens/vínculos/inbox/outbox Order, workers e carteira financeira. Uma tabela aditiva foi necessária para operações Merchant que pertencem à loja, sem criar pedido fictício.

| Requisito | Lacuna comprovada | Ajuste mínimo | Validação / limite |
|---|---|---|---|
| Horários agendados | Janela virava horário único; API de #6 traz preparo de janeiro | Snapshot cifrado conserva campos; projeção independente em telas/comanda, referência interna pelo início da janela | UTC/fuso/virada/pré-confirmação locais; GET original e novo reais preservados; agendado válido ainda depende do iFood |
| Negociações | Só total simples; alternativas e motivos condicionais bloqueados | Contrato detalhado de aceite/recusa/parcial/REFUND/BENEFIT/ADDITIONAL_TIME; correlação HSS e OPA | Banco isolado; não declarar parcial aplicado com OPA sem novos detalhes; negociações reais pendentes |
| Valores | Taxas/benefícios sempre impediam projeção | Responsáveis reconciliados; obrigação online exclui receita iFood e inclui subsídio informado | Banco isolado preserva baixa e não cria repasse; taxa real de #7 conferida; alocações sem dados permanecem pendentes |
| Ação sem evento | Sem retomada de prova persistida/intervenção | Recuperação por evento oficial correlacionado; conferência auditada sem sucesso/replay | Reinício, ausência de prova, permissão e dedup locais; GET detalhes não é prova de estado |
| Merchant | Sem pausas/turnos nem tarefas independentes do navegador | Painel dentro da configuração; fila durável, GET posterior e limite de conferências | Leituras e escritas reais concluídas em 07/10 (201/204, GET, fechamento/reabertura e restauração); timeout e bloqueio de produção locais |

Agendamento #6: API original e nova consulta reproduzem criação em outubro, preparo em janeiro e janela de outubro. Causa externa no campo de origem comprovada; [relato sanitizado](SUPORTE-AGENDAMENTO.md) preparado, não enviado. Gerador manual do portal não oferece agendamento e criou #8 IMMEDIATE. Não contou como agendado válido, não recebeu data adulterada nem confirmação fora do prazo.

Consulta restrita da VPS em 07/10: seis pedidos TESTE únicos, zero eventos sem ACK, falhas, títulos operacionais ou reservas de teste; IFOOD_PRODUCAO_AUTORIZADA=0. Takeat e loja real preservados. A recepção de #8 ocorreu pelos workers sem operação da tela.

Portal em 07/10: Order/Events **Concluído**, relatório **100% de sucesso / seis itens / seis sucessos / zero falhas**. Aplicativo Grazing HUB continua **Em revisão**; não declarar liberação para produção. Processo submetido preservado, sem reinício. [Imagem sanitizada do relatório](evidencias/order-events-relatorio-20261007.jpg).

Gates da revisão: 58 testes focados inicialmente; 260 testes de impacto (iFood, fronteiras de permissões e impressão) passaram. Regressão completa sequencial: **271 arquivos aprovados, 31 ignorados; 2.339 testes aprovados e 447 ignorados; 826,14 s**. Flags de outros bancos não foram ativadas; IFOOD_BANCO_TESTE=1 executou o PostgreSQL isolado. A execução inicial concorrente foi interrompida após timeouts por carga; o guia permite maxWorkers=1, sem alteração de limites/asserções. Aviso conhecido de pg sobre client.query concorrente; sem erro funcional. Correção posterior restrita de OPA sem detalhes novos exige a verificação de impacto registrada abaixo, sem reutilizar evidência anterior como revisão final.

Prévia isolada: desktop 1366×900 e celular 390×844, sem excesso horizontal, janela atravessando dia, edição só com salvar, Escape/teclado, colagem numérica e X acessível. Testes cobrem loading, erro de rede, permissão e envios repetidos. Imagens [agendamento desktop](evidencias/agendamento-desktop-20261007.jpg), [celular](evidencias/agendamento-celular-20261007.jpg), [Merchant desktop](evidencias/merchant-desktop-20261007.jpg) e [celular](evidencias/merchant-celular-20261007.jpg) usam somente dados sintéticos.

Lint focado, tipos e design passaram; compilação intermediária e smoke: login 200, configuração/pedidos sem sessão 307, host desconhecido 421. Revisão posterior de OPA sem detalhes novos: cenário financeiro isolado passou, e os 24 testes de PostgreSQL passaram novamente em 29,25 s, sem aumentar limites. Janelas incompletas: 21 testes de domínio/interface passaram, preservando inclusive fim isolado sem inventar início. Compilação final passou; publicada conforme registro de fechamento acima. Backup privado etiquetas-ifood-lacunas-20261007 criado na VPS; pg_restore --list conferido inteiramente no servidor. Sem exportação do dump ou consulta fiscal.

[Merchant: checklist e rascunho de ticket](MERCHANT-HOMOLOGACAO.md), sem envio. Credencial própria do app, agendado válido, casos de negociação com cliente de teste e avaliação Merchant permanecem dependências externas. Kairu indisponível; nenhum checklist externo alterado. Não houve operação de teste em carteira real, cardápio, módulo Financial ou emissão fiscal.

## Entrega incremental publicada — 06/10/2026, 22h04

Código bb1148c6 em main e branch de trabalho. Dokploy concluído, tarefa
`e7tp35yy3scw` Running; workers atualizados para a mesma imagem
(`mk43j74v97mq` coletor / `eqpnn6ysgkt9` processador). 105 migrations em dia,
configuração fiscal preservada, sem consulta/emissão fiscal. Produção iFood continua
bloqueada (IFOOD_PRODUCAO_AUTORIZADA=0), teste habilitado. Takeat inalterado.

| Cenário com loja de teste | Esperado | Observado / evidência sanitizada |
|---|---|---|
| Recepção e confirmação | Um pedido interno e CFM posterior à ação | #4, #5, #7 confirmados; imagem privada de confirmação |
| Cancelamento | Consultar motivo oficial, aguardar CAN | #4: motivo 501, CAN aplicado 21h51; imagem de cancelamento |
| Preparo, pronto e despacho | PRS → RTP → DSP, sem concluir prematuramente | #7: eventos 21h56, 21h57 e 21h59; imagem de despacho |
| Conclusão automática | CON recebido altera etapa existente | #7: CON aplicado 22h01; imagem de conclusão |
| ACK/efeitos | Eventos reconhecidos; teste não cria títulos/reservas | Consulta 22h01: 5 pedidos únicos, 0 sem ACK, 0 falhas, 0 títulos, 0 reservas; estoque desligado |
| Agendado inconsistente | Preservar informação e impedir aceite fora do prazo | #6: preparo anterior à criação; não confirmado, pendência externa de teste válido |
| Reinício/retomada | Reprocessar evento persistido, sem pedido duplicado | #3 recuperado após correção isTest e atualização de workers |
| Interface local | Identificação e destaque, sem liberar produção antes do aceite | 71 testes/5 arquivos; integração adicional 18 testes; desktop 1366 e celular 390 em fixtures |

Lint, tipos, design e build passaram. Smoke da compilação com Host autorizado:
login 200, configuração sem sessão 307. Host desconhecido corretamente retorna 421.
Correção da fixture visual incluiu o stub de consulta do estado da loja.

As cinco etapas do portal foram concluídas, com capturas sanitizadas enviadas.
Portal informa: homologação finalizada e dados em análise; resultado por email.
O relatório ainda mostra essa mensagem. **Não declarar aprovado/homologado** até
resultado explícito. Evidência privada: `.tmp-ifood-homologacao-em-analise.jpg`.
Order/Events submetidos; Merchant exige processo separado, ainda não solicitado.
Nenhum ticket enviado. Kairu indisponível; nenhum checklist externo alterado.

Após finalizar o roteiro, foram recebidos CAN para #5, #6 e #7 (22h03), inclusive
após CON de #7. HUB preservou ambos no histórico e refletiu o evento posterior.
Não confundir o estado final cancelado com falha na conclusão anteriormente
comprovada. Não foi enviada nova ação de cancelamento pelo HUB para esses pedidos.

Próximos passos externos: aguardar análise Order/Events e verificar credenciais do
app Grazing HUB após liberação; solicitar homologação Merchant separada quando
autorizado; repetir agendamento com horários válidos. Fluxos de negociação parcial,
benefícios/taxas e reconciliação sem evento continuam limitados conforme OPERACAO.
Sem ativação real antes de completar operação/fiscal e transição autorizada de Takeat.

## Testes com a loja autorizada — 06/10/2026, 21h39–21h54

- Conectividade comprovada no portal e Merchant/status disponível. Etapas de
  recepção/confirmação e cancelamento receberam evidências sanitizadas; roteiro
  avançou para despacho. Isso ainda não constitui aprovação final.
- Pedido inicial #3: falha `test` versus `isTest` corrigida em c7677ab3. A retomada
  processou PLC/CAR/CAN já persistidos e com ACK, convergindo em um único pedido
  cancelado. O cancelamento automático aconteceu enquanto a correção era publicada.
- Roteiro gerou #4–#7. #4, #5 e #7 tiveram CFM oficial após confirmação no HUB.
  #4 recebeu CAN em 21h51 após consulta dos motivos oficiais e solicitação pelo HUB.
- #6 agendado: createdAt=2026-10-07T00:39:44.280Z, mas
  preparationStartDateTime=2026-01-22T18:20:24.778Z. Dado recebido inconsistente;
  confirmação bloqueada pelo prazo. Não alterar datas nem afrouxar o contrato
  para satisfazer a homologação. Pendência externa a conferir com iFood.
- Lacunas visuais comprovadas corrigidas: RECEBIDO_EXTERNO deixa a seção de
  interrompidos e ganha destaque antes das etapas existentes; detalhe mostra
  displayId e alerta para horário agendado anterior à criação. Não libera produção.
- Validação incremental: 71 testes em 5 arquivos, lint/tipos/design/build passaram;
  teste adicional do DTO/horário executado com PostgreSQL local isolado. Prévias
  sintéticas desktop e celular verificadas, reaproveitando componentes existentes.
- Evidências privadas ficam em `.tmp-ifood-evidencia-confirmacao.jpg` e
  `.tmp-ifood-evidencia-cancelamento.jpg`, fora do Git, sem contato/endereço.
  Takeat e produção iFood continuam preservados/bloqueados, respectivamente.

## Retomada de 06/10/2026 à noite

- Publicação de teste b951e272: migrations aplicadas, configuração fiscal
  preservada e serviço estável. Primeiro start recuou automaticamente porque o
  Dokploy não tinha as variáveis básicas presentes no serviço. Configuração
  persistente recomposta a partir do serviço existente, sem divulgar valores;
  teste habilitado e produção iFood bloqueada.
- Workers coletor/processador ativos, loja TEST vinculada ao canal IFOOD existente,
  polling observado em 06/10 21:26:50, sem erro. Takeat/loja real inalterados.
- Roteiro oficial revelou necessidade de estado operacional da loja. Consulta
  Merchant /status implementada com autorização e resposta minimizada; navegação
  da configuração corrigida usando o diálogo e as rotas existentes do gestor.
- Após esses ajustes: 43 testes em 4 arquivos passaram, lint/tipos/design/build
  passaram. Etapa de conectividade iniciada no portal; aprovação não presumida.

- Usuário confirmou Takeat na loja real e determinou mantê-lo até o HUB ter emissão
  fiscal validada e uma transição posterior autorizada. Agora: testes e homologação
  de recebimento/gestão, sem consumir pedidos reais.
- Portal: apps TEST centralizado/distribuído e loja TEST Restaurante existentes;
  autenticação real do centralizado e listagem Merchant passaram na VPS.
- Credenciais de teste transferidas criptografadas, chave privada somente no
  servidor, configuração privada no Dokploy; nenhum segredo no Git/chat.
- Cadastro de Grazing HUB centralizado/PDV autorizado, assim como aceite dos termos
  e armazenamento privado das credenciais. Order, Events e Merchant selecionados.
  Cadastro concluído no portal, não listado, em desenvolvimento. Credenciais do
  app PDV ficam indisponíveis até homologação; usar app TEST(C) nesta etapa.
  Fluxo automático permite Order/Events; Merchant aparece desabilitado e exige
  ticket posterior. Nenhum ticket enviado.
- Branch conciliada com main 2b65d06b, preservando contratos de permissões de ambos
  os lados. Dependências instaladas conforme lockfile em diretório isolado.
- Regressão: **272 arquivos / 2.414 testes passaram**, 27 arquivos / 342 testes
  ignorados por configuração, zero falhas; Node 22, PostgreSQL isolado, 777,05 s.
  A tentativa anterior com dependências compartilhadas desatualizadas foi
  interrompida; tipos/build foram repetidos após npm ci e passaram.
- ESLint, TypeScript, lint:design e build webpack passaram. Reexecução final:
  5 arquivos / 47 testes passaram em 20,81 s (21:01). Smoke da versão compilada:
  login 200 e gestor/configuração 307 para login sem sessão, porta local 3156.
- Adicionado instalador dos dois workers na infraestrutura Docker existente,
  atualização periódica somente de leitura e bloqueio de títulos de teste na
  carteira operacional. Estoque continua sem efeitos.
- Backup privado pré-migration criado e verificado com pg_restore --list na VPS,
  identificação operacional etiquetas-ifood-teste-20261006.
- Estado atual: autenticação/merchant testados com iFood; fluxo de pedido,
  implantação e homologação ainda precisam de evidência posterior. Nenhuma
  aprovação é presumida a partir dos testes locais.

## Histórico da primeira entrega (madrugada de 06/10)

Atualizado em 06/10/2026, America/Sao_Paulo. Branch de trabalho
`codex/ifood-integracao-20261005`, baseada em `origin/main 840a4ce7`.
**Validado localmente; não testado com o iFood, não homologado, não ativado em produção.**
Existem lacunas de contrato/implementação registradas em [Operação](OPERACAO.md).
Não considerar esta branch pronta para homologação ou integração na main.

## Execução local

- [x] Descoberta focada e tabela de lacunas em [SPEC](SPEC.md).
- [x] Worktree separada; alterações prévias do usuário preservadas.
- [x] Fontes oficiais, contratos e divergências documentados em [Contratos](CONTRATOS.md).
- [x] Três migrations aditivas aplicadas somente em PostgreSQL 17 isolado, sem dados reais.
- [x] Tokens, vínculo, permissões, inbox, coletor, processador e outbox.
- [x] Adaptação ao PedidoVenda, estados, ações básicas e ponte para o financeiro existente.
- [x] Configuração e detalhes dentro do gestor; QA visual isolado desktop/celular.
- [x] Testes e verificações abaixo; configuração sem segredos e roteiro operacional.
- [ ] Resolver casos de negociação parcial/alternativas/motivos obrigatórios de aceite.
- [ ] Validar composição financeira com benefícios/taxas e recuperação sem evento posterior.
- [ ] Criar aplicativo e loja de teste; conferir modalidade e permissões efetivas.
- [ ] Repetir cenários com iFood e realizar homologação de cada módulo aplicável.
- [ ] Produção: nenhuma ativação realizada ou autorizada.

Kairu não está disponível entre as ferramentas. Nenhum checklist externo foi alterado,
ticket aberto ou material privado da formação publicado.

## Ambiente e resultados

Node 22.23.3, Next 16.3.4, PostgreSQL 17 em porta local 55441, banco
`teste_ifood`, schemas de teste descartáveis, fixtures sintéticas.
HTTP do fornecedor foi simulado nos testes. Nenhum teste usou credencial, cliente,
endereço, telefone ou pedido real. Logs extensos e banco ficam ignorados pelo Git.

| Verificação | Resultado observado | Evidência reproduzível |
|---|---|---|
| iFood, execução final | 3 arquivos, **30 testes passaram** | `testes/ifood/{dominio,integracao,interface}.test.*`; 06/10 00:18, 18,83 s |
| Regressão ampla | 260 arquivos passaram, 26 ignorados, 3 falharam; 2.298 testes passaram, 321 ignorados e 4 falharam | Execução completa em Node 22, 662,52 s; falhas descritas abaixo |
| Reexecução dos consumidores corrigidos, permissões e integrações | **270 testes passaram**, 12 ignorados; 13 arquivos passaram, 1 ignorado | 06/10 00:10, 52,18 s; inclui as três suítes antes falhas |
| Aceite focado após ajustes | 5 arquivos, 72 testes passaram | iFood, gestor e popup; execução anterior à última ampliação dos testes iFood |
| Comanda térmica existente | **3 testes passaram** | `testes/vendas/pedidos-impressao-termica.test.tsx`; 06/10 00:24 |
| ESLint dos arquivos alterados e TypeScript | Passaram | Sem erros na execução final |
| Central de Design | Passou | `lint:design`: 8 bases, 324 consumidores TSX |
| Prisma | Schema válido; migrations aplicadas no banco isolado | `prisma validate`, `prisma migrate deploy`, geração do cliente |
| Build | Passou em Node 22 | Build Next com webpack; aviso existente de middleware/proxy |
| Inicialização da versão compilada | Login 200; gestor e configuração 307 para login sem sessão | Processo local na porta 3156, Host reconhecido, sem seguir redirecionamento externo |
| Worker desligado | Encerra informando integração desativada | Execução com `IFOOD_ATIVO=0` |
| Navegador isolado | Desktop e celular inspecionados; sem overflow horizontal em 390 px | Imagens abaixo; componentes reais com serviços simulados |

Na regressão ampla, três assertivas do gestor precisavam localizar o componente
dentro do novo contêiner, o popup manual precisava simular a consulta iFood como
ausente e a suíte de clientes exigia a chave `PEDIDOS_AMBIENTE_ISOLADO=1`.
Esses pontos foram corrigidos e as suítes afetadas passaram na reexecução.
Não foi repetida toda a regressão após essas correções. Os totais de execuções
se sobrepõem e **não** devem ser somados. Testes ignorados não são aprovação.
Há aviso de depreciação de consultas concorrentes do driver pg; não houve falha
nos testes de concorrência com o driver atual.

Para repetir, usar apenas banco descartável de teste, Node 22 e variáveis locais:
`IFOOD_BANCO_TESTE=1`, `PEDIDOS_BANCO_TESTE=1`,
`PEDIDOS_AMBIENTE_ISOLADO=1` e `DATABASE_URL` apontando para esse banco.
Executar `vitest run testes/ifood --maxWorkers=1`. Para os consumidores,
incluir as suítes de pedidos e permissões pertinentes. Nunca apontar estas
chaves para banco de operação.

## Critérios de aceite

| Cenário | Esperado | Observado e evidência sanitizada | Limite |
|---|---|---|---|
| 1. Manuais e outros canais | Preservar gestor, validações, preço e financeiro | Consumidores, popup, permissões e regressão passaram após correções dos mocks | Sem ensaio em dados reais |
| 2. Pedido interno único | Usar PedidoVenda existente | Eventos paralelos/diferentes convergem para um pedido; ORDER_PATCHED conserva identidade | HTTP simulado |
| 3. Tokens e acesso | Expiração dinâmica, sessão/loja e segredo protegido | Renovação concorrente única, verificador ligado à sessão, DTO sem segredo, revogação bloqueada | Instalação é conta única; app real pendente |
| 4. Persistência antes de ACK | Não perder evento em falha de banco/worker | Falha real de constraint impede ACK; nova coleta recupera; tarefa retoma após ACK perdido/503 | PostgreSQL real isolado, HTTP simulado |
| 5. Idempotência | Não duplicar pedido/efeito | Unicidades e transações sob concorrência; títulos e itens vigentes não duplicados | Não ensaiado entre réplicas de produção |
| 6. Conteúdo e valores | Preservar itens, adicionais, descontos, pagamentos e horários | Decimal e snapshots; fixture com total 25,70; sem preços atuais do catálogo | Pedido oficial e composição com benefícios/taxas pendentes |
| 7. Vínculos e cliente | Receber sem inventar cadastro | Produto ausente permanece pendente; cliente mascarado não cria duplicata | Pareamento de loja de teste pendente |
| 8. Estados/modalidades | Não reabrir terminal nem antecipar agendado | Atraso/desconhecido, modalidade LOCAL/RETIRADA/ENTREGA, preparo e prazo testados | Eventos efetivos iFood pendentes |
| 9. Ações e falhas | Revalidar permissão, bloquear proibidas, não repetir ambígua | 401/403/429/503, timeout, revisão e sessão testados; evento resolve ação incerta | Recuperação sem evento ainda pendente |
| 10. Cancelamentos | Aguardar confirmação remota e preservar baixas | 202 aguarda CAN; aceite aguarda HSS com disputeId correto; baixa existente preservada | Negociações avançadas bloqueadas; sem teste real |
| 11. Estoque | Zero efeito físico | Nenhuma reserva/movimento nos testes; fronteiras manuais bloqueadas por origem | Chave mantida desligada |
| 12. Operação/impressão | Funcionar sem navegador e não duplicar efeitos | Workers separados, inbox persistida; nenhum efeito de impressão na reentrega; comanda existente passou | Não existia spool automático; impressão física/rastreabilidade pendentes |
| 13. Design | Componentes oficiais, responsividade, teclado e feedback | lint:design, três testes de interface, desktop/celular, teclado e erro de rede | Referência visual permanece Em revisão para aprovação humana |

Os testes de interface conferem limite do código numérico, bloqueio de envio
repetido, preservação da chave após falha de rede e ausência de ações para leitor.
No navegador, foram inspecionados configuração vazia/preenchida, carregamento,
feedback de falha e formulário de cancelamento. A prévia usa fixtures sintéticas
e não substitui um fluxo autenticado integrado à loja de teste.

## Evidências visuais sintéticas

- [Pedido — desktop](evidencias/pedido-desktop.jpg)
- [Pedido — celular](evidencias/pedido-mobile.jpg)
- [Configuração — desktop](evidencias/configuracao-desktop.jpg)
- [Configuração — celular](evidencias/configuracao-mobile.jpg)

Prévia reproduzível: configuração Vite `testes/visual/ifood.vite.config.mts`,
página `ifood.html`. É somente instrumento de QA; não faz parte da navegação
de produção. Próximos passos e rollback estão em [Operação](OPERACAO.md).
- Fechamento da correção Merchant: 258 testes de impacto (incluindo 24 em banco isolado) e mais 6 testes dos consumidores após separar o formatador do cliente; lint, lint:design, TypeScript e build webpack aprovados. O primeiro build identificou importação de dependência de servidor pela interface; corrigida com formatador puro e recompilação aprovada.
- Prévia isolada em 390 × 844: fuso visível, largura do conteúdo 375 px sem transbordamento. Evidência `evidencias/merchant-fuso-celular-20261007.jpg` exclusivamente sintética. Smoke compilado: login 200, páginas protegidas sem sessão 307 e host desconhecido 421. Order/Events continua exigindo instantes UTC/offset; a regra civil é exclusiva de Interruptions.
