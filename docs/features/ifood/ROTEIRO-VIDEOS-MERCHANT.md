# Merchant — roteiro das três gravações reais

Checklist do chamado **34526571**, fornecido pelo responsável. Preparado em
12/10/2026; ainda não executado nem filmado. Este roteiro não é evidência de homologação.

Aplicativo exclusivo: **TEST(C)**. Client_id público:
`7db7f802-74b3-4496-843f-f67678b673e8`.
Loja exclusiva: merchant TESTE `973d35a2-6069-4dc4-b2a7-581775a372fa`.
Fuso da execução: **America/Sao_Paulo (UTC−03:00)**.

## Antes de gravar

1. Abrir o [Gestor do HUB](https://pedidos.grazinghub.com.br/vendas/pedidos)
   e a configuração iFood existente. No cartão **TESTE**, conferir a loja autorizada
   e seu Merchant ID por **Consultar detalhes da loja**. Não mudar ambiente,
   credenciais, vínculo, recepção, modo de acompanhamento ou configuração financeira.
2. Abrir o Portal do Parceiro **da mesma loja de teste**. Conferir o identificador
   da loja no seletor/configuração. O acesso TESTE ainda não foi comprovado nesta
   retomada. Se a conta mostrar somente a loja real, parar os vídeos 2 e 3:
   não usar essa loja como alternativa nem produzir falsa comprovação.
3. Preparar um gravador de tela que capture a troca entre HUB e Portal. Desabilitar
   notificações e ocultar abas pessoais, perfil, pedidos de clientes, clientSecret,
   tokens e cabeçalhos de autenticação. Não filmar a tela de credenciais do Developer.
   Usar uma nota visível com título do vídeo, client_id acima e **data/hora reais**,
   além do relógio do sistema. Não reutilizar a data de um ensaio anterior.
4. No HUB, clicar **Consultar pausas e horários**. Registrar a hora da consulta e
   **todos** os turnos/pausas, além de **Consultar estado da loja**. Conferir o mesmo
   estado no Portal. Esse é o original a restaurar, mesmo que difira do histórico.
   Solicitar snapshot HTTP privado completo da API antes da escrita quando a execução
   for retomada com assistência; não copiar respostas privadas para o repositório.
5. Referência reconfirmada por cinco GETs oficiais em **12/10, 21h29m41–42s**:
   zero pausas, sete turnos, todos os dias `00:00:00`/1439 minutos (fim 23h59).
   `enabled` não veio na resposta. Nenhuma escrita foi feita. Esta consulta não
   dispensa a leitura imediatamente anterior à gravação.

Em cada vídeo, mostrar o início e o encerramento com data/hora, fuso e client_id.
Manter visíveis as mensagens do HUB e a hora das leituras. **Solicitação registrada**,
**Na fila** e **Aguardando leitura oficial** não comprovam alteração concluída.
Depois de enviar, usar **Consultar pausas e horários** até **Conferida no iFood**,
com a leitura correspondente. Diante de **Conferência pendente** ou erro de rede,
consultar antes de repetir; não reenviar às cegas. **Retomar apenas a conferência**
faz leituras, sem reenviar a escrita, quando o HUB oferecer essa intervenção.

## Vídeo 1 — Informações da loja

Arquivo: `merchant-01-informacoes-AAAAMMDD-HHMM-SP.mp4`.

1. Iniciar a gravação e mostrar a identificação/data/hora descritas acima.
2. No cartão TESTE da configuração iFood, clicar **Consultar lojas autorizadas**.
   Abrir **Loja autorizada**, percorrer todas as opções retornadas e fechar o seletor.
   Apresentar também todos os cartões de lojas já vinculadas no HUB. Não clicar
   **Vincular loja** apenas para demonstrar a listagem.
3. Na loja TEST973, clicar **Consultar detalhes da loja**. Mostrar, com rolagem:
   Merchant ID, nome, razão social, tipo, descrição, status cadastral, criação,
   exclusividade, identificação de teste e ticket médio informado; endereço completo,
   coordenadas, operações e canais/habilitação. Campo ausente deve aparecer como
   **Não informado pelo iFood**; não preencher informações fictícias.
4. Clicar **Consultar estado da loja** e mostrar operações, canais, disponibilidade
   e validações recebidas. Status cadastral e HTTP 200 não substituem disponibilidade.
5. Mostrar hora final e encerrar. Este vídeo é integralmente da operação no HUB;
   não precisa alterar a loja nem apresentar a conta pessoal do Developer.

## Vídeo 2 — Interrupção da loja

Arquivo: `merchant-02-interrupcao-AAAAMMDD-HHMM-SP.mp4`.

1. Iniciar a gravação; mostrar identificação/data/hora, leitura original das pausas
   no HUB e estado correspondente no Portal do Parceiro TESTE.
2. No HUB, em **Pausa de teste**, manter **Duração (minutos; 1 a 60)** em **5**.
   Clicar uma vez em **Pausar loja de teste**. Consultar novamente até a solicitação
   ficar **Conferida no iFood** e a nova pausa constar na lista. O início pode estar
   alguns segundos à frente: aguardar esse instante antes de avaliar disponibilidade.
3. Trocar para o Portal TESTE, atualizar sua tela e mostrar a interrupção/loja pausada
   e o horário. Voltar ao HUB, clicar **Consultar pausas e horários**, mostrar todas
   as pausas ativas e **Consultar estado da loja**. Comparar com o Portal.
4. Na pausa criada neste ensaio, clicar **Encerrar pausa na loja de teste** uma vez.
   Não remover pausas anteriores. Consultar até a remoção ser **Conferida no iFood**
   e a pausa criada desaparecer. Se houver mais de uma pausa, conferir descrição e
   horários para identificar a correta; na execução assistida, correlacionar seu ID.
5. Atualizar o Portal TESTE e mostrar a restauração. Conferir novamente no HUB:
   ausência da pausa do ensaio, demais pausas preservadas e disponibilidade coerente
   com o original/horário atual. Mostrar data/hora final e encerrar a gravação.

Não esperar simplesmente os cinco minutos expirarem para substituir a demonstração
de remoção. Se a pausa expirar antes desse passo, registrar a ocorrência e preparar
novo ensaio completo, reconferindo o original antes dele.

## Vídeo 3 — Horários de funcionamento

Arquivo: `merchant-03-horarios-AAAAMMDD-HHMM-SP.mp4`.

1. Iniciar a gravação; mostrar identificação/data/hora e a semana original completa
   consultada no HUB e no Portal TESTE. Guardar os valores antes de editar.
2. Clicar **Editar horários da loja de teste**. Usar os campos **Dia do turno N**,
   **Início do turno N** e **Duração do turno N (min)**. Configurar:

   | Dia | Início | Duração em minutos | Fim |
   |---|---|---:|---|
   | Sábado | 10:00:00 | 540 | 19:00 |
   | Domingo | 09:00:00 | 180 | 12:00 |
   | Domingo | 13:00:00 | 180 | 16:00 |
   | Domingo | 17:00:00 | 360 | 23:00 |

3. Para o original reconfirmado de sete turnos, modificar apenas os turnos existentes
   de sábado e domingo e usar **Adicionar turno** duas vezes para os demais domingos.
   O resultado terá nove turnos. Preservar segunda a sexta em `00:00:00`/1439.
   Se o original tiver outra composição, conservar integralmente os outros cinco dias
   e registrar a adaptação dos turnos do fim de semana antes de salvar.
4. Conferir o rascunho da semana inteira. Clicar uma vez em **Salvar horários no iFood
   de teste**. Consultar até **Conferida no iFood** e mostrar todos os horários no HUB.
5. Trocar para o Portal TESTE, abrir **Horários de funcionamento** na área de configuração
   da loja e atualizar a leitura. Mostrar sábado e os três turnos de domingo, além da
   preservação dos outros cinco dias. Não editar nada diretamente no Portal.
6. Voltar ao HUB e consultar antes de editar a restauração. Clicar **Editar horários
   da loja de teste** e recuperar **a configuração original completa do passo 1**.
   Para o original de sete turnos, sábado e domingo voltam a `00:00:00`/1439 e os dois
   domingos acrescentados são removidos pelos botões **X — Remover turno N do rascunho**.
   Conferir o dia de cada linha; os índices mudam após uma remoção. Não apagar originais.
7. Salvar; consultar até **Conferida no iFood**. Mostrar os sete turnos originais no HUB,
   as pausas originais e a disponibilidade. Atualizar o Portal e comprovar a semana
   original completa restaurada. Mostrar data/hora final e encerrar.

O PUT substitui a semana completa. Não enviar apenas sábado/domingo. Identificadores
de turnos eventualmente regenerados pelo iFood não alteram a comparação da configuração
(dia, início, duração e habilitação). Se o original tiver turno explicitamente desativado
e o editor bloquear a edição, interromper o ensaio e registrar a dependência: não
converter habilitação para contornar a proteção.

## Export oficial, correlação e preparação no Drive

1. No Developer Portal, abrir **Logs da API → HTTP Requests**, selecionar **TEST(C)**
   e conferir client_id `7db7f802-74b3-4496-843f-f67678b673e8`. Buscar o intervalo real
   completo dos três vídeos, com margem anterior/posterior e fuso registrado. Exportar
   pelo recurso oficial do Portal. Não substituir esse arquivo por logs próprios do HUB.
2. Conferir lista/detalhes/status no vídeo 1; GET/POST/GET/DELETE/GET interruptions e
   status no vídeo 2; GET/PUT/GET opening-hours do teste e da restauração no vídeo 3.
   Preservar códigos HTTP reais, inclusive qualquer falha. Comparar horário, método,
   endpoint, app e loja. GETs preparatórios de 20h30/21h29 devem ficar identificados
   como preparação; não atribuí-los aos vídeos que ainda não aconteceram.
3. Guardar export original em armazenamento privado. Revisar a cópia a anexar e os
   três vídeos antes de compartilhar: excluir segredos, autenticação, perfil pessoal,
   dados de clientes e conteúdo de outras lojas. Não alterar a operação/status/hora
   usada como evidência. Se o export expuser credenciais, sanitizar a cópia e registrar
   o que foi ocultado, preservando o original protegido.
4. Com os três arquivos reais disponíveis, preparar pasta privada no Google Drive e
   cada arquivo separadamente. Registrar os três links individuais e a correlação:

   | Vídeo | Início/fim reais em São Paulo | Linhas/IDs do export oficial | Link individual |
   |---|---|---|---|
   | Informações | A preencher após gravação | A preencher após export | Ainda não existe |
   | Interrupção | A preencher após gravação | A preencher após export | Ainda não existe |
   | Horários e restauração | A preencher após gravação | A preencher após export | Ainda não existe |

5. Solicitar aprovação **depois** da revisão do material para liberar acesso à equipe
   avaliadora e publicar os três links/anexar os logs no **34526571**. Não tornar os
   arquivos públicos nem enviar resposta ao iFood nesta preparação.

## Dependências separadas

- Os três vídeos reais e o export dependem de execução manual no Chrome: o controle
  da sessão autenticada não conseguiu confirmar a URL, e não há recurso de gravação
  real disponível nesta sessão. QA isolada com dados sintéticos não serve de evidência.
- Confirmar acesso ao Portal do Parceiro **TESTE**, antes dos vídeos 2/3. A aprovação
  anterior da loja real não comprova esse acesso e não pode ser usada neste ensaio.
- **34526755:** a pergunta mais recente é desconhecida. Aguardar a leitura do texto
  exato para responder; não inventar retorno nem duplicar pedidos já encaminhados.
- Order/Events permanece aprovado. Merchant aguarda avaliação; este roteiro não
  reinicia homologação, não ativa produção e não altera Takeat, estoque ou autoaceite.
