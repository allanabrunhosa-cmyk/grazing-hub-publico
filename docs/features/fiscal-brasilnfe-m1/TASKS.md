# Execução — Brasil NFe Marco 1

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Conferência publicada e reabertura da prévia — 16/10/2026

A PR #26 foi publicada em `b492459c`. A única NF-e 55 de homologação autorizada
foi transmitida às 01:25 (Brasília), documento `registro-sintetico-24`,
ambiente 2, série 6, número 1, total R$ 165,00. O retorno inicial HTTP 200
ficou em conferência por `CONTRATO/ENVIO_ENVELOPE`. A consulta do mesmo
identificador recuperou autorização SEFAZ 100, sem retransmissão. XML e PDF
foram obtidos, validados e auditados no HUB. A prova durável e os hashes constam
no histórico protegido e na PR #26. Nenhuma nota produtiva foi enviada pelo agente.

A habilitação manual 55 foi registrada nos dois ambientes após a prova completa.
O modelo 65 permanece sem habilitação e sem homologação própria. As propostas
tributárias de produção continuam pendentes do clique explícito do responsável.

A revisão real após recarregar encontrou perda da presença escolhida em uma
prévia ainda não transmitida. A correção preserva somente a escolha tipada do
mesmo pedido, versão, modelo e ambiente. Uma escolha nova prevalece; os dados
fiscais vigentes são recalculados. Zero e indicador 4 de outro modelo não
comprovam presença para NF-e. Não há aprovação, autorização ou chamada externa
ao reabrir. O teste SQL isolado passou em 20 casos, incluindo sete regressões
novas. Os 1.998 testes da entrega anterior são evidência anterior, não reexecução
desta correção. Os demais controles e a publicação desta correção têm registro
próprio na PR da branch `codex/fiscal-presenca`.

## Conclusão manual 55 — execução de 16/10/2026

Base: main `9cc66e57`, com PR #22 e PR #25 preservadas. Branch `codex/fiscal-manual55`.

- Implementado registro auditado da declaração específica de origem5/FCI/SEM GTIN.
- Implementada revisão consolidada no pedido, sem aprovação na abertura da prévia.
- Implementada autorização contextual e última guarda transacional antes do POST.
- Preservadas fila, identidade, recuperação e separação de ambientes/modelos.
- Implementada conferência do XML contra a montagem e do literal de homologação55.
- Emissão automática, callback e cancelamento continuam desativados.
- Homologação externa e publicação exigem prova própria. Acompanhamento na PR #26
  e no histórico protegido; testes sintéticos não comprovam essas duas etapas.

O responsável autorizou um único novo teste 55, ambiente 2, série 6, total R$ 165,00.
A transmissão produtiva cabe exclusivamente ao clique final do usuário.
CSC de homologação ausente não bloqueia 55 nem libera 65.

Conferência administrativa real: painel Brasil NFe com serviço NF-e/NFC-e ativo,
certificado carregado até 07/11/2026; CSC/id presentes em produção e ausentes em
homologação. Estados registrados pela sessão normal no HUB em 16/10, 00:00 Brasília.
BuscarEmpresa e VerificarCertificado interno consultados às 00:01:23: emitente
correspondente; certificado API ainda rejeitado em `CERTIFICADO_DATA`. A validade
do painel tem origem própria. ConsultarServicos e a tentativa 181 não foram repetidos.

Verificações desta execução, sem promover simulação a homologação externa:

- Fronteira manual: 136 casos em seis suítes, mais 45 integrações da fila.
  A reexecução específica de cliente e ciclo manual cobriu 22 desses casos.
- Revisão consolidada: 12/12 integrações SQL aprovadas em banco sintético.
  Inclui registro real do serviço de declaração e clone prospectivo, sem ativação.
- A revisão SQL identificou o tipo de evento incompatível com o trigger existente.
  Corrigido sem migration: metadados ficam em `RASCUNHO` e `ATIVACAO` canônicos.
  A primeira rodada passou 10/11; a segunda passou 11/11; a terceira acrescentou
  o registrador real e passou 12/12. Não contar as rodadas como casos distintos.
- Serviço da declaração: 20/20 unitários e lint aprovados após essa correção.
  Uma execução anterior abortou no processo filho, antes de executar testes;
  reexecução com um worker e pool de threads passou sem ampliar timeouts.
- Visual sintético: 27 capturas em 320/390/768/1440, claro/escuro, sem problemas
  no auditor ou erros de página. Referências continuam em revisão humana.
- Aplicação Next real e isolada: login central de administrador e leitor,
  seletores, perfil e botão do pedido carregaram; nenhuma API externa chamada.
  A primeira conferência detectou a criação prevista de duas prévias fiscais.
  Conferir identidade e ausência de envio na reexecução, sem ocultar essa escrita.

Fechamento da regressão no Node 22.23.3:

- 1.890 testes aprovados em 98 arquivos e 17 lotes. Os 270 casos ignorados nessa
  rodada exigem opt-ins próprios. Desses, 108 foram executados separadamente:
  revisão SQL13, fila45, homologação15 e numeração35, todos aprovados. Total sem
  duplicar reexecuções: 1.998 aprovados; 162 opt-ins restantes não executados.
- A rodada única abortou no processo nativo do Node, sem falha de asserção.
  Um lote em threads também abortou. O mesmo lote passou com forks: 110/110.
  Não houve aumento de timeout nem atualização de dependências.
- O consumidor antigo de prévia sem gravação foi atualizado para a preparação
  fiscal local autorizada. Preserva pedido, contexto, histórico e zero HTTP.
  A reexecução do lote passou 97/97, incluindo 19 casos desse consumidor.
- Typecheck: quatro erros nas novas massas corrigidos; reexecução aprovada.
  Lint global, lint de design e Prisma validate aprovados. Design: 406 arquivos,
  96 desvios históricos, zero novos. Nenhuma migration foi criada nesta entrega.
- A conferência real encontrou e corrigiu presença presumida em retirada e a
  expressão que confundia presença do comprador com presença do CSC. A regressão
  SQL13 mantém indicador 2 mesmo com CSC ausente; a pendência continua visível.
- QA real R4 aprovada: oito capturas sem problemas, login normal de administrador
  e leitor, presença 2 mantida com CSC pendente e identidades/hashes preservados
  ao repetir o mesmo contexto. Duas novas revisões locais apenas `PREPARADO`,
  sem tentativas, ação ou chamada externa. Pedido e saldos permaneceram iguais.
  Next, navegador e listeners próprios foram encerrados.

Build, CI final, publicação e única homologação externa têm resultados separados
na [PR #26](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/26) e no histórico
protegido. Não executar outro deploy apenas para versionar recibos posteriores.
Logs e imagens ficam privados em `.tmp`; não contêm credenciais ou XML real no Git.

## Fechamento operacional — 14/10/2026

[Entrega, acesso e impedimentos por campo](OPERACAO-20261014.md). Base `ca039045`
preservada; checkpoint local `6912bf3a`; main `30e933ff` reconciliada na branch
`codex/fiscal-autonomia-tributaria`, sem merge na main ou publicação produtiva.
Worktrees de Cardápio e dashboard preservadas. Nenhuma dependência foi instalada
ou atualizada. Node 22.23.3, PostgreSQL local exclusivo, chave/credenciais persistentes.

Implementados: PERFIL central com CRT explícito e histórico; projeção no Fiscal;
catálogo oficial versionado e seletores pesquisáveis; emissão manual 55/65 em um
painel dentro do pedido; habilitação durável por ambiente; consulta/arquivos;
FCI opcional versionada, apuração e mapeamento `Produtos[].nFCI`. Cancelamento
técnico conserva sua aprovação específica; autorizar envio não o habilita.
Fila, identidade, hashes, snapshots v1/v2, auditoria, locks e recuperação únicos.
Código sem sessão permanece sem adaptador automático. Nenhum perfil real foi
aprovado pelo agente; propostas privadas prontas, com pendências explícitas.

Verificações executadas, sem contar reexecuções como casos independentes:

| Rodada | Resultado | Evidência e limite |
| --- | --- | --- |
| Global inicial após reconciliação | 4.843 aprovados, 5 falhas, 561 ignorados; 12 arquivos com falha | Cinco suites recusaram corretamente outro nome de banco; fixtures de consumidores precisavam de atualização; teste longo excedeu 5 s. Não aumentar timeout. |
| Banco v2 no destino exigido | 72/72, cinco arquivos | Base vazia `teste_estrutura_fiscal`, schemas UUID; não enfraquecer o contrato do destino. |
| Global r2 | 4.968 aprovados, 1 timeout, 492 ignorados; 414 arquivos aprovados, 1 falhou, 36 ignorados | 451 arquivos, 1.219,71 s. Único timeout: monolito de preço2027. Opt-ins não ligados permanecem identificados como ignorados. |
| Reexecução dos consumidores finais | 340/340, 11 arquivos | Teste longo dividido sem perder asserções; cada teste mantém limite 5 s. Inclui FCI, 244 fronteiras, navegação, página autorizada, scripts e banco de migrations. |
| CLI após exigir destino explícito | 15/15 | Sem fallback PGHOST, erros censurados e nenhuma execução implícita. Reexecução específica posterior, não outra bateria global. |
| Executor de migrations | 35 unitários + 8 integrações aprovados | Schemas sintéticos local55449; checksums Prisma/LF/CRLF, destino/executor, rollback, reaplicação e protocolo de 30 dígitos. Rodadas se sobrepõem aos 340. |
| Backend FCI | 161/161 | Motor/payload/XML e bloqueios. Respostas exclusivamente sintéticas. |
| UI FCI final | 3/3 | Origem0 permite análise explícita sem decisão/obrigação automática; formulário recolhido. |
| Contratos visuais centrais | 20/20 | Componentes, geometria e interação em ambiente sintético. |
| Pedido | 8/8 Playwright | 320/390/768/1440, claro/escuro; auditor DOM sem problemas; somente fixtures. |
| Dashboard | 8/8 Playwright na reexecução | Primeira rodada falhou por expectativa de Link da fixture. Corrigida expectativa; auditor sem problemas. |
| Habilitação / FCI | 9 capturas / 8 combinações conferidas | Desktop/móvel/temas; nenhum problema no auditor; referências Em revisão. |
| Lint final | Aprovado | Código, scripts, testes e configurações; exit0. |
| Lint de design final | Aprovado | 8 bases, 394 consumidores TSX; 395 arquivos, 96 desvios históricos, zero novos. Uma exceção resolvida foi retirada com justificativa. |
| Typecheck final | Aprovado | Rodada inicial detectou fixture null versus opcional; build detectou argumento default incompatível com PageProps. Corrigidos os dois; typegen, tsc e reexecução após reinício passaram. |
| Prisma validate | Aprovado | Sem edição de SQL aplicada, migrate dev ou db push. |
| Build final | Aprovado | 99/99 páginas; 37,1 s compilação, 13,1 s tipos. Primeiro build interrompido pelos dois erros acima; reexecução real registrada separadamente. |
| Smoke administrativo | Aprovado em leitura | Rotas reais responderam HTTP307 sem sessão; listener somente127.0.0.1:3451. Login central exigido. Nova sessão autenticada não foi inspecionada pelo agente. |

Logs extensos privados em `.tmp/autonomia-fiscal`, fora do Git. Avisos conhecidos:
middleware/proxy Next; pgquery concorrente em alguns setups; BaseUI/Link em mocks.
Não representam homologação fiscal. Nenhuma referência visual foi aprovada pelo agente.

A conferência final do banco administrativo constatou emitente correspondente,
migrations pendentes vazias, ambienteHOMOLOGACAO, configuração versão9, Token e
UserToken presentes, seis regras históricas e ausência de dados operacionais alheios.
Aplicação real reiniciada na URL existente; nenhuma chave ou credencial substituída.
As SQLs pendentes importadas da main foram aplicadas somente nesse banco isolado.

Consulta legítima de produção limitou-se à leitura do pedido solicitado, produto,
regras e documentos de aquisição. Dados pessoais/massa real não foram copiados
para testes/Git. Declaração específica SEMGTIN recebida e incorporada à preparação
privada. A proposta não é ativação. Origem/CI/FCI continuam com lacunas identificadas;
nenhum campo ausente foi preenchido como origem0 ou número FCI gerado.

Nenhuma chamada fiscal autenticada nova foi feita. A tentativa de 13/10 e o status1
continuam históricos, sem reenvio ou mudança da regra de aceitação. Não houve
emissão, cancelamento, consulta de serviços, alteração externa cadastral/certificado/
CSC/série/numeração, fila/callback automático, mensagem a terceiro ou efeito nas
notas recebidas SEFAZ, Takeat, iFood, estoque ou financeiro.

Publicação futura exige backup e aprovação do plano de migrations vinculado ao
destino/imagem. A rotina foi testada localmente; não foi executada em produção.
Ativação/primeiro documento produtivo não foram solicitados porque a homologação
e os requisitos materiais da operação ainda não estão comprovados.

Base: `origin/main` `8911c91e`; branch `codex/fiscal-brasilnfe-m1`; worktree isolado. Alterações alheias na cópia principal preservadas. C:24,8GB livres antes da cópia; dependências existentes por junction, sem instalação.

## Checklist histórico — entrega original do Marco1

Retrata a entrega original. Credenciais e diagnóstico reais do Marco1.1 estão
registrados adiante, com autenticação/identidade confirmadas e serviços pendentes.

- [x] Preparação: AGENTS, versionamento, fiscal, cadastros, permissões, banco, testes, Central e docs locais Next consultados; referências remotas sincronizadas.
- [x] SPEC/limites e marcos seguintes registrados, sem expandir painel/fluxos comerciais.
- [x] Contratos públicos pesquisados nos quatro URLs oficiais. Consultas POST de leitura limitadas; API de emissão não chamada.
- [x] Banco/domínio: migration aditiva, validar/gerar client e testar em PostgreSQL isolado.
- [x] Backend/autorização: criptografia, substituição, DTO seguro, concorrência, diagnóstico e auditoria.
- [x] UI: Central, configuração fiscal em Integrações, preservar MCP, testes consumidores.
- [x] Adaptador: tipos55/65, plano parcial+pendências, principal/histórico, arquivos, métodos bloqueados.
- [x] Testes domínio/integração, permissões, regressão proporcional.
- [x] Lint, lint:design, typecheck, build e smoke isolados.
- [x] QA visual sintética desktop/mobile/escuro; referência Em revisão humana.
- [x] Documentação final, revisão do diff e versionamento na branch isolada.
- [ ] Validação autenticada API: depende de credenciais disponibilizadas por canal seguro. Login no painel não equivale à autenticação do cliente HTTP.
- [ ] Homologação fiscal: marco posterior, transmissão proibida nesta execução.
- [ ] Produção/deploy/merge: não autorizados neste marco.

## Evidência externa separada

10/10/2026: sessão Chrome aberta pelo usuário foi conferida somente na visão geral. Painel exibe empresa selecionada e mensagens **nenhum serviço ativo** / **sem certificado digital**. Contratação informada pelo usuário permanece válida como contexto; há pendência de conferir liberação/vínculo com Brasil NFe. Não foram copiados tokens, alteradas configurações externas, enviadas mensagens nem chamadas APIs fiscais autenticadas. Nenhum dado pessoal ou CNPJ real é registrado neste documento.

## Próximo passo da entrega histórica do Marco 1

Em ambiente administrativo de teste, aplicar a migration aditiva e usar a chave externa de criptografia já prevista pelo HUB. Acessar **Configurações → Integrações → Brasil NFe**, com `configuracoes.brasilnfe` visualizar/editar; fornecer Token/UserToken nos campos protegidos e executar **Validar conexão** (apenas BuscarEmpresa/ConsultarServicos). Conferir com Brasil NFe a liberação do emitente/certificado e obter da Confirp os parâmetros listados na SPEC. Depois elaborar/autorizar Marco 2 para homologação sintética, após fechar o contrato de recuperação/idempotência; não liberar transmissão por diagnóstico positivo. Aplicação da migration em produção depende de autorização posterior e não ocorreu neste marco.

## Validações desta revisão

Revisão de 10/10/2026, na branch isolada baseada em `8911c91e`. Nenhuma dependência foi instalada e nenhuma variável operacional foi copiada para testar. Foram reutilizadas dependências completas já existentes em outra worktree; as primeiras execuções com a junction antiga falharam por dependências/cache incompletos, e não contam como aprovação. `TEMP`/`TMP` das verificações foram direcionados à pasta ignorada local. Runtime disponível: Node24.19.0; produção documentada usa Node22, cuja repetição permanece para o ritual de integração posterior.

| Verificação | Evidência e resultado |
| --- | --- |
| Prisma | `npx prisma validate --config prisma7.config.ts` e `npx prisma generate --config prisma7.config.ts`: aprovados. `npx prisma migrate deploy --config prisma7.config.ts`: migrations aplicadas com sucesso apenas em PostgreSQL17 descartável, `127.0.0.1:55448/teste_brasilnfe_m1`. Sem `migrate dev`/`db push`. |
| Domínio e consumidores | `npx vitest run testes/fiscal-saida testes/vendas/fiscal-saida-integracao.test.ts testes/vendas/fiscal-saida-interface.test.tsx testes/permissoes testes/layout/brasilnfe-integracoes.test.tsx --maxWorkers=1`: **19 arquivos/372 testes aprovados**, 1 arquivo/12 testes opt-in de gestão de acessos ignorados nessa rodada. `BRASILNFE_BANCO_TESTE=1` e `PEDIDOS_BANCO_TESTE=1` executaram os testes de banco, todos com schemas isolados e dados fictícios. |
| Permissões de banco | `npx vitest run testes/permissoes/integracao.test.ts --maxWorkers=1`, com `ACESSOS_BANCO_TESTE=1`: **12/12 aprovados**, schema descartável no mesmo banco fictício. Os 12 skips da rodada anterior foram efetivamente executados aqui. |
| Regressão geral | `npm test -- --maxWorkers=1`, 342 arquivos, com `BRASILNFE_BANCO_TESTE=1`/`PEDIDOS_BANCO_TESTE=1`: **310 arquivos/3.046 testes aprovados**, 31 arquivos/460 testes ignorados, 1 suíte interrompida por faltar a flag adicional `PEDIDOS_AMBIENTE_ISOLADO=1`. Confirmado o banco descartável, `npx vitest run testes/vendas/clientes-regras-pagamento-integracao.test.ts --maxWorkers=1` com as duas flags de Pedidos: **10/10 aprovados**. Nenhuma falha restante nas suítes executadas; os 12 skips de Acessos também foram cobertos na execução separada acima. Demais opt-ins de banco não foram ativados e não contam como aprovação. Não houve alteração de guardas/timeouts. Aviso de depreciação do pg por consultas concorrentes nos testes existentes. |
| Lint | `npm run lint --` nos caminhos alterados e consumidores fiscais: aprovado, inclusive após ajustes da revisão. |
| Central | `npm run lint:design`: aprovado, 8 bases/355 consumidores TSX. |
| Tipos | `npx next typegen` e `npx tsc --noEmit`: aprovados. Typecheck repetido após os ajustes finais de consulta/arquivos: aprovado. |
| Build | `npm run build`: aprovado e repetido com sucesso após os ajustes finais. Avisos preexistentes sobre middleware e CompressionStream/DecompressionStream no bundle Edge de jose; sem erro de compilação. Usou somente banco local e chave fictícia de build. |
| Smoke HTTP | Build final servido em `127.0.0.1:3449`, usuários/cadastro fictícios: **6 verificações aprovadas**, repetidas após o segundo build (sessão obrigatória, permissão, leitura sem edição de segredos, índice fiscal preservando MCP, callback503, ausência de registros/efeitos fiscais/estoque/financeiro/notas recebidas). Servidor encerrado após conferir. |
| Visual | Prévia Vite isolada com fixtures sintéticas: desktop1366, mobile390, diagnóstico escuro e leitura sem edição, sem overflow/erros de console. Imagens em `testes/visual/evidencias/brasilnfe-m1-*.png`; referência continua **Em revisão** na Central, sem aprovação humana presumida. |

Mocks de HTTP pertencem exclusivamente à suíte; prévia visual usa ações fictícias e não acessa a aplicação operacional. Não houve chamada autenticada à API Brasil NFe, SEFAZ, emissão/cancelamento/inutilização, envio a clientes ou uso de pedidos reais. Revisão independente motivou testes adicionais: PDF exige leitura estrutural (HTML com marcadores PDF é rejeitado); número/série da nota principal e do histórico devem concordar com a chave, preservando precisão como strings. Revisão independente do backend não encontrou bloqueador concreto e confirmou proteção de segredos, permissão dentro da transação, save sem HTTP e descarte de diagnósticos desatualizados. O adaptador continua sem registro operacional e nenhum método incompleto retorna sucesso simulado.

PostgreSQL descartável e servidores locais foram encerrados após as verificações. Banco, caches e logs permanecem ignorados e fora do commit. Sincronização restrita à branch de trabalho; nenhum merge, deploy ou alteração da `main`.

## Continuação — Marco 1.1

Retomada em 10/10/2026 a partir de `bcd01efc563db5b466099f80496ce9a4515c2641`,
mesma branch/worktree. `fetch origin` confirmou a base remota `8911c91e`; sem commits
posteriores ou alterações existentes nesta worktree. Alterações alheias na cópia
principal `codex/cardapio` preservadas, sem reset/merge/rebase. AGENTS, SPEC,
CONTRATOS/TASKS e guias pertinentes relidos; documentação local Next16.3.4 conferida
para ambiente/CLI. Armazenamento conferido antes das operações: C:23,44GB livres;
runtime oficial isolado ocupa aproximadamente135MB, sem instalar dependências.

- [x] Aplicação **real** da branch em loopback, com autenticação/perfil central
  Administrador pelo login normal, sem mocks/bypass. URL efetivamente aberta no Chrome:
  <http://127.0.0.1:3451/configuracoes/integracoes/brasilnfe>.
- [x] PostgreSQL17 exclusivo em loopback55449; banco administrativo
  `admin_brasilnfe_m11`, banco automatizado separado `teste_brasilnfe_m11_sintetico`.
  Destino conferido antes de aplicar todas as migrations existentes, incluindo a
  aditiva do Marco1, somente na base administrativa nova. Nenhuma base clonada.
- [x] Chave própria externa ao banco, persistente em DPAPI do usuário Windows,
  arquivos privados com ACL restrita. Nenhum AUTH_SECRET/segredo produtivo copiado.
- [x] Retomada real do preparo aprovada após corrigir a escrita ACL do Windows:
  mesma chave persistente (arquivo cifrado inalterado), migrations já aplicadas,
  administrador central existente preservado sem reseed/alteração de sessão.
- [x] Somente razão social/CNPJ mínimos do emitente, conferidos no painel autenticado
  Brasil NFe, cadastrados administrativamente. Nenhum certificado/endereço/pedido/
  cliente/pagamento copiado. Identidade esperada não ajustada a uma resposta da API.
- [x] Tela real conferida com sessão, permissão e leitura dos estados: credenciais
  ausentes, campos vazios, Salvar/Validar conexão bloqueados, produção bloqueada.
  Evidência saneada em `testes/visual/evidencias/brasilnfe-m11-real-credenciais-vazias.png`.
- [x] Contratos de BuscarEmpresa/ConsultarServicos reconfirmados no site oficial.
  Sem mudança no cliente; ambiguidades registradas em CONTRATOS.
- [x] Compatibilidade major Node22 conferida no Dockerfile e documentação vigente.
  Runtime oficial Node22.23.3 Windows x64 isolado, checksum oficial verificado;
  runtime global/dependências/ambiente produtivo inalterados.
- [x] Usuário preencheu **Token da empresa** e **UserToken** somente na tela local
  protegida. Não foram solicitados/extraídos valores por chat, terminal ou arquivo.
- [x] Salvamento/releitura real confirmados pela tela com ambos Configurado e inputs
  vazios, e pela auditoria CREDENCIAIS_SUBSTITUIDAS. Nenhum token fictício foi inserido
  na base administrativa. Salvar continua sem HTTP fiscal ou ativação.
- [x] Diagnóstico externo real iniciado pela ação administrativa na sessão do usuário.
  A investigação de formato e o resultado efetivo estão na seção abaixo; execução
  com credenciais não significa autenticação confirmada ou homologação.
- [ ] Homologação fiscal/certificado/CSC: não executados/verificados.
- [ ] Marco2: fechar requisitos externos/fiscais e autorizar SPEC própria antes de
  qualquer transmissão; fila, adaptador operacional e callback permanecem bloqueados.

### Verificações no runtime-alvo

Executadas com o `node.exe` oficial22.23.3, ambiente limpo e banco **sintético separado**,
sem chave administrativa ou tokens fiscais. Falhas iniciais por restrições locais
da sandbox (acesso loopback/cache SWC) não contam como aprovação; execuções completas
foram repetidas com o acesso local necessário, sem alterar guardas.

| Verificação | Resultado efetivo |
| --- | --- |
| Prisma | `node node_modules/prisma/build/index.js validate --config prisma7.config.ts`: aprovado |
| Domínio, permissões, login e hosts | `node node_modules/vitest/vitest.mjs run testes/fiscal-saida testes/vendas/fiscal-saida-interface.test.tsx testes/vendas/fiscal-saida-integracao.test.ts testes/permissoes testes/layout/brasilnfe-integracoes.test.tsx testes/login testes/etiquetas/hostname.test.ts testes/vendas/pedidos-hostname.test.ts --maxWorkers=1`: **27 arquivos/529 testes aprovados**, zero ignorados,123,13s |
| Flags de banco | `BRASILNFE_BANCO_TESTE=1`, `PEDIDOS_BANCO_TESTE=1`, `PEDIDOS_AMBIENTE_ISOLADO=1`, `ACESSOS_BANCO_TESTE=1`, `LOGIN_BANCO_TESTE=1`; somente `teste_brasilnfe_m11_sintetico`, schemas/dados fictícios |
| Lint | `node node_modules/eslint/bin/eslint.js` no conector fiscal, rotas/callback, Integrações, catálogo central de permissões, crypto, sidebar, índice Configurações e testes fiscais/consumidores: aprovado, sem avisos |
| Central | `node scripts/verificar-tokens-design.mjs`: aprovado,8 bases/355 consumidores |
| Tipos | `node node_modules/next/dist/bin/next typegen` e `node node_modules/typescript/bin/tsc --noEmit`: aprovados |
| Build | `node node_modules/next/dist/bin/next build --webpack`: **aprovado**,195,92s,88/88 páginas; aviso preexistente sobre convenção middleware deprecada. Output de desenvolvimento separado em `.next/dev`, conforme docs locais Next; tela administrativa preservada |
| UI real | Login normal e leitura da tela Brasil NFe aprovados no servidor administrativo real. Sem credenciais salvas, sem chamadas Brasil NFe. Inputs protegidos/vazios; estado pendente real e bloqueios visíveis |
| Helper local | Parse/status/runner Node22 aprovados; processo filho não recebe NODE_OPTIONS/DATABASE_URL/AUTH_SECRET/PGPASSWORD implícitos. ACL de pasta/arquivo sintéticos e reaplicação aprovadas em processo PowerShell fresco. `preparar` real repetido com exit0, chave cifrada inalterada e administrador existente preservado. As duas tentativas anteriores falharam por Set-Acl/SeSecurityPrivilege e propriedade estendida de ACL ausente; foram corrigidas com APIs .NET Owner/DACL/GetAccessRules, sem ignorar validação |
| Rede/arquivos | Aplicação3451 e PostgreSQL55449 conferidos exclusivamente em127.0.0.1. `.tmp`/chaves/metadados/cadastro privado do emitente confirmados ignorados pelo Git. Revisão independente do helper não encontrou bloqueador concreto; sem HTTP fiscal no bootstrap/servidor |

Mocks/respostas simuladas pertencem exclusivamente aos529 testes, não à aplicação
administrativa. O painel autenticado externo apenas forneceu a identidade esperada
e continua exibindo nenhum serviço ativo/sem certificado. Isso não confirma falha
da API nem situação contratual; confrontar depois das consultas autorizadas.

### Pendências e próximo passo exato na preparação inicial

O ambiente local e a tela autenticada ficam disponíveis para preenchimento protegido.
Informar **Token da empresa** e **UserToken**, clicar **Salvar** e avisar apenas que
foi salvo, sem enviar valores. Então executar uma vez **Validar conexão**, limitada
a BuscarEmpresa/ConsultarServicos, comparar CNPJ sem alterar o esperado e registrar
separadamente acesso/identidade/serviços. Certificado/CSC e homologação seguem pendentes.

Brasil NFe: conferir vínculo da contratação e acesso API55/65 por ambiente, orientar
certificado/CSC e esclarecer não duplicação/recuperação após timeout/múltiplas
tentativas. Rascunho condicional para revisão do usuário em CONTRATOS, **não enviado**.
Confirp: matriz já existente em SPEC, organizada em CONTRATOS por regras gerais da
operação, classificação/tributos/unidades dos itens, pagamentos e regras NFC-e.
Nenhuma definição ausente interrompe este diagnóstico administrativo de leitura.

Nenhuma transmissão, emissão (inclusive homologação), cancelamento, inutilização,
evento fiscal externo, consulta histórica/SEFAZ, alteração de certificado/CSC/série/
numeração ou envio a terceiros foi executado. Produção bloqueada; sem registro de
emissor operacional, ativação da fila/callback, merge, deploy ou migration produtiva.
Sem alteração em Takeat/iFood/financeiro/estoque/notas recebidas.

### Correção de acesso local —10/10/2026

Usuário relatou URL indisponível. Conferência inicial: não havia listener3451 nem
55449. Motivo específico do encerramento não comprovado; a entrega anterior não
constitui prova de disponibilidade contínua após encerrar o atendimento.

- [x] Retomado preparo existente, mesma chave e administrador central preservado,
  sem novo banco, cópia operacional ou alteração de credenciais.
- [x] Acrescentado modo manual `iniciar` ao helper: lançador local oculto WMI,
  ambiente limitado, SID do usuário DPAPI conferido, wrapper protegido sem segredos,
  nenhuma tarefa/serviço/recorrência/inicialização no boot. Porta ocupada falha
  explicitamente; nenhuma parada automática de processo desconhecido.
- [x] AST do helper e wrapper fictício aprovados; revisão independente somente
  leitura sem bloqueador concreto. Nenhuma alteração na aplicação/cliente fiscal.
- [x] Encerrados somente Next local identificado e cluster exclusivo verificado,
  para reiniciar ambos pelo lançador independente. Dados não apagados.
- [x] `iniciar` real aprovado com exit0; proprietário e dois listeners em loopback
  confirmados por nova chamada após o comando terminar. HEAD de `/login` retornou
  HTTP200, sem body/cookies/autenticação fabricada ou acesso à página protegida.
- [x] Usuário confirmou a abertura da aba já autenticada no Chrome. Automação da
  página no navegador interno foi recusada pela política do navegador; não houve
  tentativa em outra superfície nem contorno. Não registrar nova QA visual como feita.

Nenhum Token/UserToken foi extraído do navegador, nenhuma consulta autenticada
Brasil NFe ou transmissão foi executada. Banco de teste sintético e ambiente
produtivo intocados nesta correção. Verificações Node22/529 testes do Marco1.1
continuam como evidência anterior: não foram repetidos build/lint/typecheck, pois
a correção se limita ao lançador PowerShell e documentação. Próximo passo fiscal
continua o preenchimento protegido e as duas consultas administrativas autorizadas.

### Diagnóstico real e compatibilidade da resposta —10/10/2026

O usuário confirmou acesso, salvamento e executou Validar conexão pela sessão real
no Chrome. As capturas iniciais fornecidas mostram campos vazios e estados saneados;
não foram copiadas para o Git. A única captura final segura versionada é identificada
adiante. Conferência do banco administrativo somente em transação
de leitura, sem selecionar tokens/cifras, respostas brutas ou dados de pedidos.

- [x] Diagnósticos iniciais versões2/3: FALHOU, acesso não confirmado; BuscarEmpresa
  rejeitada como RESPOSTA_INVALIDA. ConsultarServicos não foi chamada.
- [x] Acrescentada identificação de etapa com enum/rótulos locais fixos. Nunca inclui
  valor, header, corpo, mensagem, path dinâmico ou cause externos; erro continua
  falhando e diagnósticos antigos permanecem compatíveis. Revisão independente
  somente leitura sem bloqueadores.
- [x] Repetições manuais autorizadas pela mesma tela localizaram CNPJ (versão4,
  19:03 Brasília) e máscara brasileira completa (versão5,19:06). Nenhum valor do CNPJ
  retornado foi armazenado/impresso/versionado; cadastro esperado preservado.
- [x] Correção limitada à normalização da máscara exata `00.000.000/0000-00` para
  texto de14 dígitos. Zeros preservados; números, CPF, espaços, máscaras incompletas,
  caracteres extras e posições incorretas continuam rejeitados. Não há limpeza
  genérica nem relaxamento dos demais tipos, erros ou campos fiscais.
- [x] Contagens saneadas após os diagnósticos iniciais: pedidos, documentos/eventos
  fiscais de saída, movimentações de estoque/bancárias, histórico financeiro,
  notas recebidas/de serviço e documentos recebidos SEFAZ =0.

#### Resultado externo após correção

Em10/10/2026 às19:10:32 Brasília (22:10:32 UTC), configuração versão6:

| Verificação real | Resultado |
| --- | --- |
| Credenciais | Ambas Configurado; inputs vazios; nenhuma substituição adicional |
| BuscarEmpresa | Retorno válido, acessoAutenticado=true |
| Identidade | CNPJ correspondente ao esperado. O código só iniciou ConsultarServicos após essa igualdade, preservando cadastro/hash do emitente |
| ConsultarServicos | Tentada, falha EXTERNO; listada como única consulta indisponível. Sem causa/body/headers externos conservados |
| NF-e55 / NFC-e65 | Serviços não confirmados; ausência de serviços ativos não comprovada |
| Situação geral | FALHOU com acesso confirmado, preRequisitosConferidos=false; validação completa não alegada |
| Certificado/CSC | Não verificados/alterados; nenhum endpoint de certificado executado |
| Homologação/produção | Homologação não realizada; produção e transmissões bloqueadas |

Auditoria: uma substituição de credenciais (versão1), cinco DIAGNOSTICO (versões2–6),
último com acesso=true e somente ConsultarServicos indisponível. Todas as repetições
foram manuais pela tela; nenhuma retentativa automática, chamada fiscal via terminal
ou sessão fabricada. Não foi lida qualquer credencial fiscal. As contagens locais
listadas acima continuaram todas0 após a última consulta.

Evidência real fornecida pelo usuário, sem alteração dos pixels:
`testes/visual/evidencias/brasilnfe-m11-real-diagnostico-incompleto.png`. Mostra estado
geral Falhou, acesso Confirmado e consulta indisponível. Nenhum token, CNPJ/razão
social, certificado, trace, HAR ou vídeo consta nessa imagem. Validação visual
assistida pelo usuário; não alegar automação de navegador que foi recusada.

#### Pendências finais e entrada do Marco2

Sem novo preenchimento de Token/UserToken. O usuário deve revisar o rascunho do
fornecedor em CONTRATOS. Brasil NFe deve esclarecer ConsultarServicos e conferir
vínculo da contratação/acesso API55/65 por ambiente, certificado/CSC e contrato de
não duplicação/recuperação após timeout. Confirp deve definir CRT/IE e a matriz
tributária da SPEC. Cadastro local precisa de endereço confiável antes de emissão.

Depois do esclarecimento do fornecedor, repetir somente a ação administrativa de
leitura para confirmar os serviços; não repetir emissões para testar conexão.
Entrada do Marco2: serviços/pré-requisitos conferidos, matriz Confirp aprovada,
contrato de recuperação seguro, SPEC própria com massa sintética e autorização
explícita para homologação. Este resultado não autoriza emissão automaticamente.

Nenhuma transmissão de documento, emissão, cancelamento, inutilização, evento fiscal,
consulta histórica/SEFAZ, alteração de certificado/CSC/série/numeração, registro de
emissor, fila/callback operacional, mensagem a terceiros, merge/deploy ou migration
produtiva ocorreu. Testes continuaram sintéticos e em banco separado.

#### Verificação da revisão final

Primeira bateria ampla descartada: iniciou antes de terminar o refinamento de
classificação do CNPJ. O processo manteve o cliente anterior em memória, enquanto
o arquivo de teste já esperava etapas novas:20 falhas (diff mostrou EMPRESA_CNPJ
anterior em vez das novas etapas). Houve ainda dois timeouts de5000ms em imports
das fronteiras de permissões. Essa rodada resultou em25 arquivos aprovados/2
reprovados,605 testes aprovados/22 reprovados; não constitui aprovação. Nenhum limite
global foi ampliado e nenhuma asserção foi afrouxada. O build seguinte não chegou
a executar porque o runner interrompeu no exit1.

Após estabilizar o código, as verificações finais usam Node22.23.3, ambiente limpo,
chave fictícia e somente banco `teste_brasilnfe_m11_sintetico`. A aplicação real
permanece em outro banco e não usa os mocks da suíte. Lint focado dos quatro arquivos
TS/testes alterados e typecheck completos aprovados; lint de design aprovado
(8 bases/355 consumidores). Teste focado do cliente:154 aprovados,814ms; configuração
em banco sintético:14 aprovados,23,29s.

Bateria ampla estável:27 arquivos,639 casos;637 aprovados e2 timeouts repetidos
nos mesmos imports de permissões (aprovarMcpAction/obterResumoCancelamentoNotaAction),
199,72s. Todos os testes fiscais e de credenciais passaram. A classificação nova
não voltou a falhar. Sem edição de código/limite de testes durante essa rodada;
Build não executado nesse encadeamento devido ao exit1.

Os dois casos repetiram o timeout em execução isolada com limite original5000ms
(2 reprovados/210 filtrados,22,78s). Medição diagnóstica somente desses casos com
`--testTimeout=30000` (nenhum arquivo/configuração alterado) concluiu em14,18s;
aprovarMcpAction levou5418ms e obterResumoCancelamentoNotaAction1595ms. Carga envolve
todos os adaptadores MCP no primeiro import e JSZip/SEFAZ/assinatura no segundo;
nenhuma chamada externa ou acesso ao banco precedeu as guardas. Esse limite ampliado
não conta como aprovação. Repetição seguinte com limite **original5000ms**:
**2 aprovados**,11,69s (3439ms/874ms). Resultado funcional recuperado, sem mudar
asserções, aumentar timeout global ou alterar comportamento desses módulos.

Arquivo completo `testes/permissoes/fronteiras.test.ts` repetido separadamente no
Node22 limpo, sem DATABASE_URL/chave administrativa/API/banco: **212/212 aprovados**,
15,23s, timeout original5000ms (4034ms/1088ms nos dois imports). Assim, os casos de
permissão foram recuperados com as asserções originais. Não reclassificar a bateria
637/639 como rodada inteiramente verde; registrar ambas as evidências.

Build independente da revisão final: `next build --webpack`, no Node22.23.3,
**exit0**, compilação em59s, TypeScript em30,8s e88/88 páginas geradas. Finalizado
em10/10/2026 às19:23 Brasília. Usou somente banco sintético e chave fictícia,
sem credenciais Brasil NFe nem chamadas autenticadas. Aviso preexistente da
convenção middleware permanece; não foi alterado fora do escopo. Não houve
alteração funcional após essas verificações. A imagem Linux produtiva não foi
construída nem publicada.

Comandos efetivos (binários locais existentes, sob Node22): lint com ESLint dos
quatro arquivos TS/testes alterados; `tsc --noEmit`; `node scripts/verificar-tokens-design.mjs`;
`vitest run testes/fiscal-saida testes/vendas/fiscal-saida-interface.test.tsx testes/vendas/fiscal-saida-integracao.test.ts testes/permissoes testes/layout/brasilnfe-integracoes.test.tsx testes/login testes/etiquetas/hostname.test.ts testes/vendas/pedidos-hostname.test.ts --maxWorkers=1`;
recuperação `vitest run testes/permissoes/fronteiras.test.ts --maxWorkers=1`;
e `next build --webpack`. Nenhum teste ignorado foi contabilizado como aprovação;
rodadas filtradas/limite diagnóstico estão distinguidas acima. Logs permanecem
na pasta privada ignorada do ambiente, sem versionar credenciais ou banco.

## Continuação: ConsultarServicos e estados administrativos — 10/10/2026

Retomada em `d68558b8`, branch `codex/fiscal-brasilnfe-m1` limpa e igual ao remoto
após fetch. Trabalhos paralelos na cópia principal preservados. Reutilizados porta
3451, PostgreSQL exclusivo em55449, chave DPAPI persistente e credenciais já salvas;
nenhuma recriação, nova migration, cópia de dados ou substituição de segredo.
Node22.23.3 confirmado; C:34,01GB livres no início e33,83GB antes da regressão.

### Escopo e correções

- [x] Contrato oficial reconferido: POST `/services/empresa/ConsultarServicos`,
  Token e UserToken, sem body; `Nome`/`Ativo`, status0 e erros vazios. Serviço
  combinado `NF-e/NFC-e` reconhecido. Não exigir Sincronizar Docs ou outros serviços.
- [x] Metadados estritamente permitidos para transporte, timeout, HTTP numérico,
  não JSON, JSON inválido, campos incompatíveis e negócio JSON; HTTP401 separado
  de403. Códigos externos não documentados não são conservados. Sem body, headers,
  cookies, cause, mensagens livres, certificado ou CSC em diagnóstico/auditoria.
- [x] Estado `Conectado — verificação de serviços pendente` quando BuscarEmpresa
  conclui com emitente correspondente e somente ConsultarServicos falha. Detalhes
  e datas por consulta permanecem visíveis; autenticação, emitente, emissão no
  catálogo, pré-requisitos, homologação e produção têm estados distintos.
- [x] Cada tentativa gera evidências novas; consulta falha não reaproveita serviço
  ativo de tentativa anterior. Credencial substituída ou hash do emitente alterado
  invalida o diagnóstico. Legado conserva apenas a autenticação datada que possuía,
  sem inventar correspondência/serviços ou reclassificar erro antigo como sucesso.
- [x] Ativo/inativo explícitos separados de não confirmado; catálogo ausente ou
  contraditório continua não confirmado. Serviços alheios inativos não bloqueiam
  este projeto. Ativo no catálogo não comprova habilitação por ambiente.
- [x] ConsultarServicos é diagnóstico administrativo, separado do processamento
  de notas. Evidência identificada de painel/suporte pode esclarecer contratação,
  sem fingir retorno da API ou liberar emissão. ConsultarNotaFiscal permanece
  restrita às próprias emissões futuras; integração SEFAZ de recebidas intocada.

### Validação sintética desta revisão

Node22 oficial existente, ambiente limpo, somente dados fictícios. Banco de teste
`teste_brasilnfe_m11_sintetico`, distinto do administrativo; opt-ins BRASILNFE_BANCO_TESTE,
PEDIDOS_BANCO_TESTE/PEDIDOS_AMBIENTE_ISOLADO conforme os arquivos. Sem consultar a API
externa nem usar pedidos reais. Nenhum timeout de teste foi ampliado.

| Verificação | Resultado |
| --- | --- |
| Cliente HTTP | 219/219, 1,16s, sem ignorados |
| Configuração + catálogo + integração isolada | 49/49 em2 arquivos, 19,27s |
| Interface + índice Integrações | 24/24 em2 arquivos, 39,33s |
| Lint focado | Cliente/tipos/diagnóstico/configuração/UI/testes aprovados |
| Lint de design | Aprovado, 8 bases/355 consumidores |
| Typecheck completo | `tsc --noEmit`, exit0 |
| Regressão fiscal e consumidores | 355/355 em14 arquivos, 78,79s, sem ignorados; exit0 |
| Build webpack | `next build --webpack`, exit0; compilação, TypeScript e geração de 88 páginas concluídas |

Reexecuções registradas separadamente: a primeira unidade de catálogo teve11
aprovados/4 falhas por montagem incorreta de `it.each` (array distribuído em
argumentos). Corrigida somente a massa/parametrização; classificação não foi
afrouxada. A rodada de49 acima já contém os15 testes de unidade corrigidos.
A primeira coleta da interface falhou por EPERM no cache temporário da sandbox,
sem executar casos; cache de testes em pasta isolada permitiu a rodada24/24.
O build usou Node22.23.3 no Windows e somente configuração sintética isolada;
a imagem Linux `node:22-slim` do Dockerfile não foi construída nesta revisão.
Aviso preexistente de migração middleware/proxy não impediu a compilação.

QA visual adicional exclusivamente sintética no IAB, preview4439, dados marcados
fictícios e campos de credenciais vazios. Desktop e mobile390px inspecionados;
scrollWidth=clientWidth=390, sem corte/rolagem horizontal. Evidências:
`testes/visual/evidencias/brasilnfe-servicos-pendentes-sintetico-desktop.jpg` e
`brasilnfe-servicos-pendentes-sintetico-mobile.jpg`. Não substituem diagnóstico
autenticado nem homologação; referência visual permanece Em revisão humana.

### Nova consulta autenticada — concluída pelo usuário às 20:13 Brasília

O usuário confirmou a execução pelo botão existente na sessão administrativa e
enviou captura saneada da tela real. O agente conferiu somente os campos permitidos
do diagnóstico persistido, em leitura local com transação somente leitura. Nenhuma
sessão foi fabricada, credencial extraída ou consulta externa repetida pelo terminal.
A leitura anterior da versão7 às19:28:28 Brasília era legada e não permitia inferir
HTTP/causa; foi substituída pela execução real abaixo, sobre o código `9f6f8475`.

| Evidência real da versão8 — 10/10/2026 | Resultado |
| --- | --- |
| Início do diagnóstico | 20:13:57.296 Brasília / 23:13:57.296 UTC |
| BuscarEmpresa | Concluída às20:13:58.064 Brasília / 23:13:58.064 UTC |
| Autenticação e emitente | Acesso confirmado e CNPJ correspondente ao cadastro esperado; cadastro não alterado |
| ConsultarServicos | Falhou às20:13:58.139 Brasília / 23:13:58.139 UTC |
| Endpoint | POST `https://api.brasilnfe.com.br/services/empresa/ConsultarServicos` |
| Metadados permitidos | HTTP200; categoria `NEGOCIO`; etapa `SERVICOS_ENVELOPE` |
| Status/código do fornecedor | Não retidos (`null`); não há código de falha documentado na lista permitida. Isso não significa que a resposta não continha código |
| NF-e e NFC-e | `NAO_CONFIRMADO`; falha de consulta não equivale a serviço inativo |
| Estado geral | `CONECTADO_SERVICOS_PENDENTES`; confirmação da empresa preservada nesta mesma tentativa |
| Pré-requisitos, homologação e produção | Pré-requisitos pendentes, homologação não realizada, produção bloqueada |

A falha observada é um indicador negativo no envelope de uma resposta JSON que
chegou via HTTP200, antes da leitura do catálogo. Não foi timeout, falha de
transporte ou HTTP401/403 nesta tentativa. O registro não distingue qual indicador
de negócio veio nem seu motivo específico; não permite concluir token incorreto,
assinatura ausente ou serviço inativo. Rota, método, headers e ausência de body
continuam compatíveis com o contrato público já conferido. Nenhuma incompatibilidade
adicional do cliente foi comprovada. O rascunho de suporte em CONTRATOS foi atualizado
com horário, endpoint e metadados reais, sem envio.

Conferência visual da captura do usuário: a tela real apresenta o estado esperado,
as verificações separadas e a falha específica com HTTP200. Isso é evidência
administrativa autenticada, distinta das imagens e respostas sintéticas da suíte;
não equivale a homologação fiscal ou aprovação humana da referência visual.

No fechamento, aplicação local respondeu HTTP200 à navegação sem sessão, com
autenticação central mantida. Esse teste de disponibilidade não autentica a API
Brasil NFe. Aplicação3451 e PostgreSQL55449 permanecem vinculados somente a
127.0.0.1. Credenciais configuradas foram preservadas. O complemento da evidência
alterou apenas documentação: diff/documentação conferidos; testes e build não
reexecutados sem mudança de código. Permanecem os resultados de355 testes, lint,
lint de design, typecheck e build Node22.23.3 da revisão `9f6f8475` acima.

Nenhuma emissão, transmissão de documento, alteração externa, envio a terceiros,
fila/callback, merge/deploy ou migration produtiva autorizada por esta continuação.
Confirp/certificado/CSC não condicionam estas correções administrativas.

## Incremento implementado: motivo transitório de ConsultarServicos — 10/10/2026

Retomada sobre `dc238386`, branch `codex/fiscal-brasilnfe-m1`. O usuário autorizou
extrair e sanear o motivo da consulta exclusivamente para a sessão administrativa
atual. Não autoriza conservar texto externo, resposta bruta, credencial ou código
observado em banco/auditoria/log/Git/captura, nem enviar mensagem ao fornecedor.
As evidências e baterias anteriores permanecem históricas; não validam as novas
alterações. Detalhes e critérios vigentes: [SPEC](SPEC.md) e [CONTRATOS](CONTRATOS.md).
Durante a execução, `origin/main` avançou de `8911c91e` para
`fedebea82ceb81dcce1df51a92f661e065af0240` por trabalho paralelo. Nenhuma alteração
foi mesclada nesta branch e a main não foi modificada. Antes do fechamento,
`origin/codex/fiscal-brasilnfe-m1` ainda estava em `dc238386`; commit/sincronização
deste incremento serão registrados pelo executor, sem merge ou deploy.

### Escopo autorizado e critérios

- [x] Rechecagem pública de Empresas: `erros` object[], com codigo/descricao/correcao
  strings somente no exemplo; tipos individuais/required/nulabilidade não declarados.
  Token/UserToken obrigatórios e status inteiro0=sucesso. Não houve API autenticada
  nesta conferência documental, leitura de credenciais ou acesso ao banco pelo autor.
- [x] SPEC/CONTRATOS substituem a proibição normativa absoluta de mensagens pela
  exceção transitória estrita, preservando a proibição de persistência e o histórico.
- [x] Cliente: projeção permitida só de ConsultarServicos, saneamento, limites e
  supressão de formatos inesperados/segredos/dados pessoais; sem aceitar código
  desconhecido como causa validada ou sucesso operacional.
- [x] Backend: detalhe somente no resultado da ação autorizada, com proteção de
  versão/emitente/credencial e sem gravação em diagnóstico/evento/log. DTO de leitura
  e auditoria permanecem restritos a metadados/indicadores derivados permitidos.
- [x] Interface: texto escapado transitório, sem armazenamento do navegador,
  sem mensagem recuperada ao atualizar a página e sem captura com texto real.
- [x] Testes sintéticos: permissões, credencial refletida, dados pessoais/HTML,
  campos inesperados, limites, concorrência, ausência de persistência e bloqueios.
- [x] Verificação visual somente sintética, sem texto externo real em capturas.
- [x] Regressão final, lint, lint de design, typecheck e build no Node22.23.3 aprovados.
- [x] Nova ação administrativa real após verificações locais; registrar apenas
  resultado/indicadores seguros. Não supor qual mensagem veio na versão8.

### Resultados desta nova implementação

| Verificação | Resultado deste incremento |
| --- | --- |
| Testes focados do cliente/saneamento | 314/314:219 cliente +95 detalhes; massas fictícias e fetch simulado somente na suíte |
| Backend, concorrência e ausência de persistência | 57/57:15 unidades de configuração +38 integrações PostgreSQL +4 actions; detalhe ausente no banco, DTO de leitura e auditoria; reautorização/versão/emitente conferidos |
| Interface | 50/50:41 casos da tela +9 do índice Integrações |
| Lint focado | 14 arquivos TS alterados conferidos em3 grupos (5 cliente/saneamento,4 UI e5 backend/actions/testes); todos aprovados sem warnings; nenhum scan global de lint executado |
| Lint de design | Aprovado,8 bases/355 consumidores |
| Typecheck final | Node22.23.3, `tsc --noEmit`, exit0 |
| Regressão final | 696/696 em17 arquivos, 54,37s, Node22.23.3; fiscal-saida, consumidores fiscais de Vendas, layout Brasil NFe e permissões (regras/sessão/fronteiras) |
| Build final | Node22.23.3, Next16.3.4, webpack; exit0, compilação36,5s, TypeScript13,5s e geração de páginas concluída |
| QA visual | Desktop/mobile no IAB com dados integralmente sintéticos; detalhes exibidos e ocultados pelo X oficial |
| Revisão independente da segurança do desenho | Sem bloqueador remanescente após correções; somente leitura de cliente/projeção/metadados/backend/actions/UI |
| Nova consulta administrativa autenticada | Concluída pelo usuário, versão9; BuscarEmpresa confirmada e ConsultarServicos não confirmada por status numérico1, conforme evidência abaixo |

Reexecuções desta etapa, sem omissão: a primeira bateria backend de57 aprovou56
e falhou1 porque a projeção excessivamente restritiva suprimiu contexto técnico
esperado. Após o refinamento, outra rodada56/57 identificou o UserToken puro
refletido contendo o Token como substring. Corrigidos o reconhecimento do valor
integral e a ordem de supressão, com testes específicos; a bateria final314 e a
regressão696 acima incluem a correção. A primeira coleta de typecheck terminou
exit2 em testes intermediários com tipos readonly; a rodada final Node22 terminou
exit0. Nenhum desses resultados intermediários equivale ao resultado final.

O build mostrou somente o aviso legado de middleware depreciado. A imagem Linux
do Dockerfile não foi construída; build Windows/Node22 não comprova build Linux.

A projeção final conserva contexto técnico com `[suprimido]` em trechos removidos
quando seguro; mensagens opacas/codificadas ou sem contexto suficiente ficam
suprimidas inteiras. Códigos compostos exigem segmentos técnicos ou prefixos
alfanuméricos curtos com dígitos; demais segmentos são suprimidos. Um código
observado permitido continua sem semântica
operacional. Limites:5 itens,48 caracteres no código,300 nos textos, números
inteiros seguros com valor absoluto até999999 e consumo único por até5 minutos.
Valores de status têm tipo/estado coerentes; false continua falha, não status0.

Evidências visuais sintéticas:
`testes/visual/evidencias/brasilnfe-motivo-transitorio-sintetico-desktop.jpg` e
`brasilnfe-motivo-transitorio-sintetico-mobile.jpg`. Viewport mobile390px;
documento clientWidth=scrollWidth=375px, sem overflow horizontal. O X oficial
ocultou a região de detalhes. Não há mensagem de fornecedor real nessas imagens;
a referência visual permanece Em revisão humana.

### Nova consulta real deste incremento — versão9 concluída pelo usuário

O usuário executou uma única vez Validar conexão na própria sessão administrativa
e confirmou a ação. A aba autenticada não estava acessível à automação; não foram
extraídos tokens nem contornada a sessão. A captura fornecida pelo usuário mostrou
somente rótulos/estados nesse detalhe: Error ausente, quantidade de erros0, itens0,
ERROR ausente e nenhum campo suprimido. A imagem real não foi copiada para o Git.
Leitura SQL local estruturada e somente leitura conferiu metadados permitidos da
versão9. Não houve nova chamada externa pelo terminal ou acesso à resposta bruta.
A versão8 permanece histórica, sem reconstrução do motivo daquela tentativa.

| Evidência real da versão9 — 10/10/2026 | Resultado |
| --- | --- |
| Início | 20:54:22.671 Brasília / 23:54:22.671 UTC |
| BuscarEmpresa | Concluída às20:54:23.522 Brasília / 23:54:23.522 UTC |
| Acesso/emitente | Ambos confirmados nesta tentativa; cadastro e credenciais preservados |
| ConsultarServicos | Falhou às20:54:23.574 Brasília / 23:54:23.574 UTC |
| HTTP/categoria/etapa | HTTP200 / NEGOCIO / SERVICOS_ENVELOPE |
| Status/indicador | Inteiro1; tipo NUMERO; estado NUMERO_NAO_ZERO; indicador STATUS_NUMERICO_NAO_ZERO |
| Ausência/supressão | camposAusentes=[ERROR]; camposSuprimidos=[]; detalhe com Error ausente e zero erros/itens |
| NF-e/NFC-e | NAO_CONFIRMADO; sem concluir inatividade/contratação ausente |
| Estado geral | CONECTADO_SERVICOS_PENDENTES; confirmação da empresa preservada nesta tentativa |
| Texto transitório | Nenhuma descricao/codigo/correcao disponível na lista vazia; ausência não causada pelo saneamento; nenhum texto externo gravado |
| Homologação/produção | Homologação não realizada e produção bloqueada |

A diferença observada está isolada: status numérico1 contraria o critério0=sucesso
publicado para ConsultarServicos. O significado de1 ainda depende do Brasil NFe;
não foi convertido em sucesso nem tratado como motivo fiscal conhecido. Não houve
relaxamento do parser, retry, nova credencial ou outra consulta. O rascunho de suporte
em [CONTRATOS](CONTRATOS.md) foi atualizado com essa evidência e permanece não enviado.

As verificações locais deste incremento estão encerradas. O próximo passo é o
usuário revisar o rascunho e obter do fornecedor o contrato/significado do status1,
o vínculo e os serviços NF-e/NFC-e habilitados, sem exigir Sincronizar Docs. Não é
necessário fornecer token novamente nem executar outra consulta nesta etapa.
Documentação e entrega registram somente indicadores seguros e pendências; não
copiar texto externo para Git/log/banco/captura.
Confirp, certificado e CSC não impedem esta investigação administrativa. Nenhuma
emissão/transmissão, consulta fiscal real, alteração externa, Sincronizar Docs,
SEFAZ recebidas, merge/deploy ou migration produtiva integra este incremento.

## Marco 2 — preparação técnica local (10/10/2026)

Base preservada: `dcf72307`; branch `codex/fiscal-brasilnfe-m1`, árvore inicialmente
limpa e referências remotas conferidas. Nenhum reset/merge/rebase; demais worktrees
preservadas. Ambiente administrativo, banco, chave persistente e credenciais não
foram recriados/substituídos. Espaço conferido:31,50GiB antes da implementação e
31,40GiB antes das compilações. Runtime isolado22.23.3; Dockerfile usa22-slim.

- [x] Inventário por campo/fonte/lacuna/decisão: [MARCO-2-PREPARACAO](MARCO-2-PREPARACAO.md).
- [x] Construtores/prevalidação55/65 e serializador exato, sem HTTP;
  `payload-local.ts` e `payload-local-tipos.ts`. Pendências têm campo, item/produto,
  modelo/operação e responsável. Resultado completo mantém transmissãofalse.
- [x] Fronteira servidor `preparacao-local.ts`: sessão/permissões centrais reais,
  releitura em transação, somente leitura de fotografia/emitente. Sem dependência
  da liberação operacional de Pedidos para conferência fiscal local.
- [x] Snapshot/hash/revisão, desconto já rateado, valores comerciais, conversão e
  fechamento em centavos preservados. Nenhum lançamento/rateio financeiro criado.
- [x] Ciclos sintéticos55/65: montagem, autorização/rejeição normalizadas, resultado
  incerto, travas/concorrência, recuperação com histórico, XML e cancelamento.
  Simulador somente na suíte; integração aplica SQL somente em schema temporário
  do banco exclusivo `teste_brasilnfe_m11_sintetico`, sem copiar dados reais.
- [x] Roteiro mínimo55/65, requisitos separados e ponto de entrada de homologação.
- [x] Documentação de arquitetura/contratos atualizada, sem duplicar investigação.
- [x] Interface preservada: nenhuma alteração TSX/rota/componente ou captura nova.
  Consumidores fiscais existentes executados; referência visual anterior não é
  apresentada como nova validação. URL protegida existente respondeu307 sem sessão.
- [ ] Transmissão/homologação real: não autorizada/não executada. Bloqueios descritos
  abaixo não impedem a conclusão do recorte local implementado.

### Verificações desta entrega, separadas das evidências anteriores

Comandos executados no worktree, pelo runtime oficial Node22 isolado. Logs privados
ignorados, sem tokens, respostas brutas ou dados reais. Flags `PEDIDOS_BANCO_TESTE=1`,
`PEDIDOS_AMBIENTE_ISOLADO=1`, `BRASILNFE_BANCO_TESTE=1` somente na regressão com banco
exclusivo. Build/typecheck/smoke usam variáveis sintéticas, sem banco administrativo.

| Rodada | Comando/área | Resultado observado |
| --- | --- | --- |
| A1 —21:35 | vitest run testes/fiscal-saida/brasilnfe-payload-local.test.ts --maxWorkers=1 | 34 testes aprovados |
| B1 —21:36 | vitest run testes/vendas/fiscal-saida-integracao.test.ts --maxWorkers=1 | 12 testes aprovados no banco sintético |
| A1 — estática | eslint dos6 arquivos TS novos/alterados; tsc --noEmit | Lint aprovado; typecheck identificou ambiente union no contexto do simulador XML; corrigido para homologação explícita |
| B2 —21:39 | vitest run testes/fiscal-saida testes/vendas/fiscal-saida-integracao.test.ts testes/vendas/fiscal-saida-interface.test.tsx --maxWorkers=1 | 504 testes/14 arquivos aprovados; zero skips; inclui36 testes de payload e12 da fila |
| C2 | eslint dos6 arquivos; node scripts/verificar-tokens-design.mjs; tsc --noEmit; next build --webpack | Todos aprovados; design8 bases/355 consumidores TSX |
| A3 —21:44 | vitest do payload após conferir limites de quantidade/unitário contra leiaute | 38 testes aprovados; dois novos casos de limite inteiro, sem truncar dados |
| C3 | eslint dos2 arquivos afetados pelo ajuste final; tsc --noEmit; next build --webpack | Todos aprovados; build gerou88 páginas estáticas e rotas protegidas |
| Smoke C3 | node --conditions=react-server --import tsx, módulos reais com fixtures sintéticas55/65 e fetch vedado | Aprovado; montagem local e JSON exato; transmissãofalse; sem HTTP |

B2 precede o último ajuste de limites inteiros: a cobertura afetada foi reexecutada
em A3, sem reapresentar a regressão inteira como nova rodada. C3 verifica a versão
final; alteração documental posterior não exige recompilação. A imagem Linux do
Docker não foi construída: Windows/Node22 não comprova execução Linux produtiva.
Smoke local HTTP somente no endereço administrativo, sem sessão e sem acionar
Validar conexão. Não houve preview do fornecedor, consulta de nota ou consulta
administrativa autenticada neste incremento. Evidência da versão9 continua histórica.

### Bloqueios e próximo passo

ConsultarServicos permanece não confirmado por inteiro1/HTTP200/erros vazios;
rascunho de suporte preservado e não enviado. Não houve nova instrumentação,
aceitação de1, consulta ou pedido de credenciais. Emitente completo, certificado/CSC,
aprovação fiscal da Confirp e contrato de recuperação/ordenação continuam pendentes.
Nenhuma ausência foi substituída por código, alíquota ou cadastro fictício na aplicação.

Recorte normal nacional implementado; quando aplicáveis, ST/FCP/DIFAL/IPI/IBS-CBS,
benefícios, exportação/intermediação e troco/transportador/textos legais exigem dados
e/ou extensão específica. Não confundir montagem completa com aprovação tributária.
O adaptador existente não foi registrado; métodos operacionais continuam falhando,
callback não autentica eventos e o processador não possui emissor operacional.

Próximo passo: obter esclarecimento/vínculo dos serviços Brasil NFe pelo rascunho
existente, receber matriz fiscal da Confirp, completar emitente e parametrizar massa
sintética por modelo. Após fechar recuperação segura e pré-requisitos, revisar e
autorizar SPEC própria para a primeira homologação. Nenhuma transmissão, alteração
externa, fila recorrente/callback, merge/deploy ou migration produtiva foi executada.
Notas recebidas SEFAZ, estoque, financeiro, Takeat e iFood permanecem fora do escopo.


## Continuação — implementação técnica do Marco2 (11/10/2026)

Base preservada:90d7b470, branch codex/fiscal-brasilnfe-m1, tree inicialmente limpa.
Fetch feito antes da edição; diferenças com main e trabalhos das demais worktrees
foram preservados, sem merge/rebase/reset. Ambiente, chave DPAPI, credenciais e
sessão administrativa reutilizados. Runtime vigente Docker22-slim; verificações
locais executadas em Node22.23.3/Windows, sem atualizar dependências.

### Implementação concluída, sem liberação operacional

- [x] Métodos técnicos55/65: envio individual, resultado/autorização/rejeição/denegação,
  consulta da própria emissão, recuperação, documentos e cancelamento protocolado.
- [x] Plano fiscal imutável e decisões Confirp versionadas, com vigência/responsável,
  referências e aprovação explícita; produtos/grupos/formas existentes.
- [x] Ponte servidor com sessão/permissões reais, vínculo de fotografia e plano;
  autorização operacional sempre negada, provedor null e callback bloqueado.
- [x] Ordem de observação local durável; deduplicação, lease, reobservação, protocolos
  separados e cancelamento incerto com conferência manual. Não libera reenvio.
- [x] XML/PDF/HTML65/evento separados; precisão preservada e downloads protegidos.
  HTML estático aceito tem recorte limitado; conferir leiaute real na homologação.
- [x] Administração dos pré-requisitos: leitura empresa/certificado, presença CSC,
  origem/data do painel, acompanhamento civil de validade; nenhum segredo no DTO.
- [x] Três migrations SQL aditivas aplicadas somente no admin local exclusivo;
  suites com schemas descartáveis em outro banco, sem clone de produção.
- [x] Dois cenários comerciais sintéticos documentados em HOMOLOGACAO-CENARIOS.md;
  parâmetros fiscais e manifesto concreto continuam pendentes da Confirp.

### Evidência autenticada distinta das simulações

Painel Brasil NFe autenticado observado em11/10/2026: NF-e/NFC-e ativo, A1 com
validade07/11/2026; quatro campos de CSC/identificador ausentes. Homologação liberada
é declaração do usuário. Essa evidência está documentada, ainda não gravada pelo
formulário local de registro do painel. Sem extração de valores secretos/certificado.

Uma única rodada manual, por sessão/permissões normais, iniciada pelo usuário em
11/10/2026 21:09:38.913 Brasília (2026-10-12T00:09:38.913Z): BuscarEmpresa confirmou
emitente; presença de IE/CRT, endereço externo incompleto. VerificarCertificado
Interno:true recebeu HTTP200 e falhou em CERTIFICADO_DATA. Não guardamos o valor
recebido nem sabemos seu formato real; API de certificado permanece não confirmada.
CSC/identificador ausentes nos dois ambientes. Endereço estruturado HUB ausente,
zero regras registradas. ConsultarServicos de10/10/2026 permanece histórico e
int1 desconhecido, sem repetição ou alteração de aceitação.

A captura saneada fornecida pelo usuário confirmou a apresentação real dos
pré-requisitos. O controle do Chrome falhou em leituras da aba; não criamos bypass
para agir com sua sessão. Inspeção visual dos componentes em desktop1280×720 e
mobile390×844 foi concluída no navegador interno, com dados exclusivamente
sintéticos: lista, criação vazia, classificação sem defaults, rolagem interna,
proteção de descarte e pré-requisitos. Evidências JPEG em evidencias/ são da suíte
visual sintética; não comprovam autenticação, cadastro fiscal ou homologação.
A prévia inicial falhou por redirect ausente no stub de navegação; corrigido
somente em testes/visual, sem mudar Next da aplicação. Não usar a prévia como
substituta do ambiente administrativo real.

### Rodadas de verificação desta execução

| Rodada | Resultado real | Observação |
| --- | --- | --- |
| Desenvolvimento dos agentes | Regras42; operações/ponte312; UI/actions22 aprovados | Exclusivamente sintéticos; não somar como testes inéditos da bateria final |
| A1 integração |36 aprovados/1 falhou | Mock de erro sem categoria; fixture corrigida para o contrato seguro, sem flexibilização |
| A2 foco |27/27 aprovados | Fila16, pré-requisitos banco7, UI4 |
| B1 domínio/permissões |895 aprovados/11 falharam;1 hook falhou;25 arquivos | Rótulo alterado com consumidores antigos e timeouts durante build concorrente; registrados sem aumentar prazos |
| B2 reexecução separada |908 aprovados/3 falharam;25 arquivos/911 casos | MCP cold import excedeu5s; duas massas terminais precisavam ajuste; expôs CHECK sem DENEGADO |
| B3 fila/permissões |239 aprovados/1 falhou;2 arquivos/240 casos | Fronteiras219 aprovadas com prazos originais; denegação ainda recusada pelo CHECK antigo |
| B4 SQL/integrações |43/43 aprovados;3 arquivos | Fila21 +regras14 +pré-requisitos8; novo CHECKaditivo e assert explícito de DENEGADO |
| C1 build |Aprovado | Antes das últimas correções da fila; sem banco real ou credenciais fiscais |
| C2 lint/design/typecheck/Prisma validate |Aprovados | Lint0, design8bases/359consumidores; schema válido; sem atualizar dependências |

Consolidação:911 testes distintos dos25 arquivos tiveram execução final aprovada
entre B2, B3 e B4. Não houve uma única rodada911/911; reexecuções estão separadas
acima. Erro MCP de importação não motivou alteração de MCP ou timeout. Novos casos
verificam também versão/sessão, vigência, forma ativa, concorrência de evidência,
vencimento civil e ausência de efeitos em estoque/financeiro/notas recebidas.

Build C2 do estado final aprovado em Node22.23.3: compilação55s, typecheck25,2s e
geracao89/89 páginas concluídos. Aviso preexistente de middleware/proxy permanece
fora do escopo; não mudou APIs/dependências. Prisma validate também aprovado.
Docker/Linux não foram executados: build local Windows não comprova runtime Linux.
Diff check aprovado. Branch preservada para versionamento/push, sem merge/deploy.
Logs saneados ficam no diretório privado não versionado do ambiente local.

### Próximo passo e limites mantidos

Seguir MARCO-2-IMPLEMENTACAO.md e HOMOLOGACAO-CENARIOS.md: obter contrato do fornecedor
para DtExpiracao/status1/recuperação e evento, completar emitente e CSC no canal
adequado e receber matriz Confirp. Registrar decisões efetivamente aprovadas,
vincular versões ao snapshot sintético e apresentar manifesto55 sem pendências
para autorização específica da primeira transmissão;65 exige aprovação própria.
Ainda não há manifesto fiscal completo porque nenhuma classificação foi inventada.

Nenhuma emissão, cancelamento, inutilização, preview ou evento fiscal externo;
sem mudança externa de certificado, CSC, assinatura, séries ou numeração. Produção,
registro operacional, fila automática e callback seguem bloqueados. Sem merge,
deploy ou migration produtiva; SEFAZ de recebidas, estoque, financeiro, Takeat e
iFood preservados. Rascunho ao fornecedor atualizado, não enviado.

## Issue #8 — autonomia tributária, 11/10/2026

Branch `codex/fiscal-autonomia-tributaria`, base `02c497c9`. Trabalho em checkout
isolado; branch fiscal anterior, trabalhos de cardápio/dashboard, ambiente
administrativo, dados, credenciais e chave persistente preservados. Contrato:
[AUTONOMIA-FISCAL-EXECUCAO](AUTONOMIA-FISCAL-EXECUCAO.md).

### Implementação

- [x] Novas propostas usam fundamentação tipada, fontes específicas, datas,
  justificativa, limites, UF, origem, operação e regime efetivamente confirmado.
  Confirp deixa de ser requisito exclusivo; parecer especializado é opcional.
- [x] Confiança por campo: comprovado, pendente, revisão especializada ou não
  aplicável com justificativa. Fonte genérica, XML histórico, IA e exemplo de API
  isolados não aprovam; incerteza bloqueia a decisão afetada.
- [x] Proposta, revisão, aprovação interna e bloqueio acrescentam versões.
  Permissão central revalidada no servidor, confirmação humana e prova imutável
  com responsável/nome/data, conteúdo/fundamento/emitente/cadastro/alcance/vigência.
- [x] Cadastro, revisão, vigência ou contexto alterados não reaproveitam prova.
  Regra de grupo não aprova implicitamente o produto. Piloto limitado à saída
  interna na mesma UF e CFOP da família5; outro alcance exige extensão específica.
- [x] Legado Confirp permanece legível e imutável, sem conversão em nova aprovação.
  Planos antigos conservam vínculos; nova preparação exige versão interna válida.
- [x] Modelos55/65 reutilizam montagem, snapshots, precisão e rateios comerciais;
  referência da nova versão não é serializada ao fornecedor nem habilita emissão.
- [x] Formulário e revisão seguem a Central: salvamento explícito, descarte,
  remoção de fonte pelo X oficial, limites de campos e URL como texto não executável.
  Parágrafos recebem normalização canônica; HTML, segredos, controles proibidos
  e CPF/CNPJ em textos ou caminho/fragmento de URL são recusados.
- [x] SQL manual aditivo `20261012100000_brasilnfe_autonomia_tributaria` preparado
  e exercitado em schemas sintéticos. Sem UPDATE de versões antigas. Sem aplicação
  no banco administrativo existente ou em produção nesta execução.
- [x] Matriz F01/F02/F03/F04 e roteiro55/65 atualizados com fontes oficiais e
  condições; NCM, tributos e regime futuro não são inventados ou autoaplicados.

### Evidências e rodadas

Runtime Node22.23.3/Windows, equivalente à versão principal22-slim do Dockerfile;
dependências existentes reutilizadas, sem atualização. Logs privados não versionados.
Não reexecutamos o diagnóstico autenticado. As evidências do painel, certificado,
CSC e status1 de ConsultarServicos acima continuam históricas, com suas limitações.

| Rodada | Resultado observado | Recorte |
| --- | --- | --- |
| A1 montagem |53/53 aprovados,4 arquivos | Payload local55/65, referência interna/legada, mapeamento e pré-requisitos |
| A2 regras |80 aprovados;21 não executados | Sandbox impediu conexão local EACCES; não é aprovação dos casos de banco |
| B1 domínio |901 aprovados;2 timeouts;89 não executados;29 arquivos | Quatro suites de banco sem escuta local ECONNREFUSED; dois imports de fronteira atingiram5s; nenhuma flexibilização de prazos |
| B2 integrações |89/89 aprovados,4 arquivos | Cluster existente retomado sem recriação; schemas descartáveis no banco `teste_brasilnfe_m11_sintetico`, incluindo22 casos de regras e21 de fila |
| B3 reexecução |371 aprovados;1 timeout;6 arquivos/372 casos | Domínio/UI/ações e22 casos de regras finais aprovados; import inicial de `aprovarMcpAction` excedeu5s novamente |
| B4 fronteira isolada |1 aprovado;220 fora do filtro | Apenas `aprovarMcpAction`, em3,356s; sem alterar MCP, prazo ou contrato de permissão |
| B5 negativos finais |51/51 aprovados,1 arquivo | Rejeição exige erro do domínio fora do catch; não captura a falha da própria asserção como falso sucesso |
| Revisão incremental |93 unitários e36 UI/actions aprovados pelos agentes | Regressões de parágrafos, CPF/CNPJ nas URLs, colagem/limites e transições; sobrepõem casos anteriores |
| C1 lint/design |Aprovados | ESLint do projeto; design8 bases/362 consumidores |
| C1 tipos/Prisma |Typecheck apontou1 erro na fixture; Prisma válido | JSON potencialmente nulo na construção de legado sintético; corrigido pelo validador existente com conferência de hash, sem relaxar o domínio |
| C2 tipos/build |Typecheck aprovado; build impedido pelo sandbox | Compilador nativo não conseguiu canonicalizar o checkout no Windows; nenhuma alteração de aplicação para contornar |
| C3 build |Aprovado | Node22.23.3, compilação94s, TypeScript64s, páginas89/89; variáveis exclusivamente sintéticas e banco inacessível |
| C4 fechamento |Lint29 arquivos alterados e typecheck aprovados | Após fortalecer as asserções negativas; aplicação permanece igual à compilada emC3 |

Consolidação:1.008 casos distintos dos29 arquivos tiveram execução aprovada entre
B1/B2/B3/B4/B5, incluindo os novos13 casos unitários e3 de interface. Não houve rodada
única1.008/1.008. Nenhuma alteração de prazo ou teste de fronteira para mascarar
falha; os casos de banco inicialmente não executados passaram na rodadaB2.
Typecheck final, schema Prisma, lint/design e build aprovados. Avisos de
middleware/proxy e APIs Node na cadeia preexistente de `jose/session-token` em Edge
permanecem fora do escopo; sem mudança de autenticação/dependências para silenciá-los.
Build Windows/Node22 não comprova execução Docker/Linux, que não foi realizada.
Diff staged aprovado; capturas inspecionadas e checkout fiscal anterior limpo.

Interface inspecionada com componentes reais e ações somente sintéticas, sem
banco/autorização fiscal real: desktop1280×720 e mobile390×844. Conferidos resumo
antes da aprovação, confirmação desmarcada com botão desabilitado, proposta sem
defaults, inclusão de fonte, parágrafos e proteção de descarte. Capturas JPEG em
`evidencias/autonomia-*.jpg` são exclusivamente sintéticas. O sandbox inicialmente
impediu acesso ao servidor visual; a prévia foi retomada apenas em loopback e
encerrada após a inspeção. Não substitui homologação externa ou prova de cadastro.

### Condição de entrada para a homologação

Responsável fiscal interno precisa concluir e revisar fontes/classificações
concretas para EMPRESA, OPERACAO55 e um produto F01. A aprovação interna não é
classificação automática nem atesta juridicamente o texto de uma fonte. Completar
emitente, evidência do serviço/ambiente, certificado/data e recuperação segura de
resultado incerto; CSC é requisito65 quando aplicável. Montar manifesto sintético
55 sem pendências e solicitar autorização específica da primeira emissão.

Nenhuma consulta Brasil NFe, preview, transmissão, cancelamento ou alteração externa
nesta Issue. Produção, registro operacional, fila automática e callback continuam
bloqueados. SEFAZ de recebidas, estoque, financeiro, Takeat e iFood intocados.
Sem merge, deploy ou migration produtiva; regra real não registrada/aprovada.

## Issue #11 — primeiro piloto55,12/10/2026

Branch `codex/fiscal-autonomia-tributaria`, base `e04b5690` preservada, checkout
existente e trabalhos paralelos intocados. Referências remotas reconferidas;
nenhuma integração com main ou dashboard. Espaço inicialmente14,44GiB; dependências
e caches reutilizados, sem instalação/limpeza. Antes do build final25,36GiB livres.

- [x] Issue, AGENTS, guias e documentação existentes conferidos. Só leitura
  pertinente do catálogo/insumo/empresa e de duas abas da planilha; nenhum pedido,
  cliente, certificado, token ou documento real convertido em fixture.
- [x] Fatos confirmados pelo usuário: pesos54g/51g; pão pronto/corte/recheio;
  venda resfriada em celofane/adesivo/bandeja de servir; ingredientes principais.
  NCM1905.90.90 e CFOP5.101 fundamentados como proposta limitada aos dois sabores.
  [Dossiê e fontes](PILOTO-55-CLASSIFICACAO.md).
- [x] Tratamento explícito PIS/COFINS RECOLHIDO_DAS implementado com CST49/99 e
  CRT1/2/4, representação zero informativa e rejeição de parâmetros incompatíveis.
  Nenhum CST/taxa/regime preenchido automaticamente; SEM_DESTAQUE antigo preservado.
- [x] Leitor servidor do manifesto55 implementado: plano/snapshot existentes,
  sessão/permissões centrais, versões vigentes, provas/IDs/alvos, total e hashes,
  sem payload pessoal, criação de plano/documento ou habilitação de emissão.
- [x] Revisão técnica identificou contador reiniciável e vínculos apenas por nome;
  corrigidos com histórico/estado duráveis sob trava fiscal e referência efetiva
  de cada versão. Regressões negativas adicionadas e verificadas.
- [x] Interface da opção DAS inspecionada em prévia isolada com componentes reais,
  dados fictícios e ações simuladas. Desktop1280×720/mobile390×844; CSTs vazios,
  opção explícita, sem base/alíquota de destaque ou salvamento. Chrome desconectou;
  inspeção concluída no navegador do app. Capturas saneadas:
  `evidencias/piloto-55-das-desktop.png` e `piloto-55-das-mobile.png`.
- [x] Roteiro futuro exclusivamente fictício, preço planejado10,00 e20un com dois
  sabores, sem gerar hash/ID/aprovação fictícios. JSON tem estado IMPEDIDO e não
  é payload/manifesto completo. [Impedimentos e responsáveis](PILOTO-55-IMPEDIMENTOS.md).
- [x] Cartão CNPJ RFB15/02/2023 corrobora razão/endereço atuais do HUB; comprovante
  cadastral do Drive contém IE126.602.764.118 e Simples histórico. PDF escaneado
  renderizado com Poppler e inspecionado; página não informa data de consulta,
  arquivo modificado em2023. Não usado como prova automática de regime atual.
- [ ] Atualidade do regime/CRT e aplicação do cadastro mínimo no ambiente isolado, CEST/IPI/XML, GTIN e
  revisão dos demais campos; aprovação humana EMPRESA/OPERACAO55/ITEM.
- [ ] Fotografia/plano administrativos sintéticos e manifesto concreto sem
  pendências; só depois pedir autorização específica da primeira transmissão.

### Rodadas desta Issue (não substituem evidências anteriores)

Node22.23.3/Windows, versão principal22 do Dockerfile. Execução direta dos binários
locais dos scripts reais do projeto: Vitest, ESLint, verificador de design,
TypeScript e Next `build --webpack`. Banco exclusivamente
`teste_brasilnfe_m11_sintetico`, guardas loopback/nome, schemas descartáveis e
SQL manual das migrations existentes. Sem `migrate dev`, `db push`, migration
administrativa/produtiva ou alteração de schema. Logs privados ignorados.

| Rodada | Resultado | Escopo / observação |
| --- | --- | --- |
| A0 inicialização |Runner não iniciou; nenhum teste |Variável do executável ausente na chamada, corrigida antes de rodar |
| DAS-A1 domínio |120/120,2 arquivos |77 montagem e43 regras; reexecução após guardas de parâmetros extras também120/120 |
| DAS-A1 UI |27/27 |Primeira revisão da opção/consumidores; evidência preservada |
| Manifesto-A1 |8 aprovados,1 falhou |Hook da fixture devolvia função de mock como cleanup; corrigido, sem alterar aplicação |
| Manifesto-A2 |9/9 |Reexecução focada do hook corrigido |
| Banco-B2 |24 aprovados,1 falhou |Asserção de revisão constante2 incorreta após várias versões; substituída por comparação exata da versão/IDs/hashes aprovados |
| Domínio-B3 |Interrompida; sem resumo final |Registro parcial e timeout5,8s do novo caso UI; não conta como bateria concluída |
| Núcleo-B4 |152 aprovados,46 não executados,7 arquivos |Cinco suites unitárias passaram; duas suites de banco não iniciaram por ECONNREFUSED. Nenhum caso de banco contabilizado como aprovado |
| Banco-B5 |46/46,2 arquivos |Cluster existente retomado;25 regras e21 fila/concorrência/reenvio, com banco sintético |
| Manifesto-B6 |35/35,2 arquivos |10 unitários e25 de regras, após conferir papéis dos itens |
| DAS-A2 UI |29/29 |Caso longo separado em PIS, COFINS e ICMS; interações reais do Select, sem aumentar timeout |
| C2 lint/design/tipos |Aprovados |12 arquivos no lint; design8 bases/362 consumidores; typecheck completo |
| C3 build |Aprovado |Revisão antes do reforço final: compilação49s, tipos24,2s,89/89 páginas |
| Manifesto-B7 |65/65,3 arquivos |15 manifesto,32 regras/banco e18 porta; inclui histórico incerto com contador zero, produção, ação/lease/protocolo/pedido e alvos/IDs divergentes |
| C4 lint/tipos |Aprovados |Quatro arquivos do reforço final; typecheck completo sem erros |
| C5 build final |Aprovado |Node22, compilação69s, tipos22,2s,89/89 páginas. Sem banco acessível/segredos reais |
| C6 smoke local |Aprovado |Aplicação compilada só em loopback: host local rejeitado421 pela política produtiva; com Host HUB permitido e sem cookies, login200 e ambas rotas fiscais307 para login; redirecionamentos não seguidos |
| DAS-B8 persistência |34/34,1 arquivo |Reexecução dos32 casos de regras e2 novos55/65: proposta/aprovação/plano/JSON DAS persistidos, valores/histórico preservados, sem HTTP ou efeitos alheios |
| C7 fixture final |Aprovados |Lint da integração e typecheck completo após adicionar os2 casos de persistência; código da aplicação permanece igual ao compilado emC5 |
| Documentação |Aprovada |JSON IMPEDIDO válido, referências locais/diff conferidos, capturas inspecionadas |
| Cadastro-D1 leitura |Comprovantes encontrados |Só campos necessários; CNPJ corresponde, razão/endereço/IE extraídos; sem IE/CRT fictícios e sem inferir vigência2026 do documento histórico. Sem novo código/teste ou API fiscal |

Consolidação proporcional: **242 casos distintos dos8 arquivos afetados/próximos**
tiveram execução aprovada entre Núcleo-B4, Banco-B5, Manifesto-B7, DAS-A2 e DAS-B8.
Não houve uma rodada global242/242 nem regressão global do repositório. Casos
interrompidos/não executados são identificados separadamente. O único aviso da
compilação final foi a convenção preexistente middleware/proxy; não houve mudança
de hosts, autenticação ou dependências para silenciá-lo. Docker/Linux não executado.

Smoke não comprova sessão administrativa, gravação de regras reais ou homologação
externa. Servidor efêmero encerrado; prévia também encerrada após QA. Banco/chave/
credenciais existentes preservados. Nenhuma nova validação BuscarEmpresa,
ConsultarServicos ou certificado; estados históricos continuam com datas próprias.
Produção, callback, registro operacional e fila automática bloqueados. Nenhuma
emissão/preview/cancelamento; notas recebidas, estoque, financeiro, Takeat/iFood
intocados. Sem merge/deploy; nenhuma regra ou aprovação fiscal real fabricada.

## Issue11 — revisão adicional sobre e5865e17,12/10/2026

- [x] AGENTS/guias/Issue11 e revisão adicional do corpo da issue lidos; comentários
  retornaram lista vazia. Branch limpa na retomada, `e5865e17` e históricos
  preservados; fetch conferiu0/0 com upstream e divergência15/14 commain, sem
  reconciliar. Root/dashboard e demais worktrees intocados. C:26,60GB decimais
  aproximadamente antes do trabalho,26,54GB antes da compilação, sem instalação
  ou limpeza. Dependências eNode22.23.3 existentes reutilizados.
- [x] Receitas/processo/embalagem já comprovados reutilizados, sem repetir perguntas.
  Consulta oficial OptantesRFB: **12/10,19:43:27 Brasília**, identidade correspondente,
  Simples desde20/08/2019, nãoSIMEI, sem períodos anteriores/eventos futuros.
  CAPTCHA CADESP autorizado especificamente pelo usuário; portal rejeitou acesso
  sem resultado cadastral. CRT1/2 não presumido. Nenhuma repetição/contorno.
- [x] Usuário confirmou que **a caixa20un não possuiGTIN próprio**. PropostaSEM GTIN
  vinculada à unidade final; não copiar código do pão/grupo. Novo util comum
  valida strings,8/12/13/14 dígitos, dígito de controle, rejeita todoszeros e
  preserva zeros iniciais. Checkdigit não comprova atribuição.
- [x] Servidor recusa nova aprovaçãoITEM/GRUPO em `classificacoes.ean` quando
  ausente/inválido. Proposta, parser/hashes históricos, permissões/travas e ato
  humano explícito preservados. Montagem55/65 gera pendência por item e não
  fornece payload transmissível nessa condição. Digitação/colagem/limite14 naUI.
- [x] CEST/ST dos dois sabores analisados separadamente. Proposta nãoCEST com
  confiança média e nãoST da saída própria interna ao consumidor com confiança
  alta, fundamentadas em descrições/RC5109/33358/Conv142/CAT68. Falta adoção humana
  expressa, sem CEST provisório ou parecer obrigatório genérico.
- [x] PDF oficial RFB3024 efetivamente lido, questão102,páginas51–52, hash identificado:
  PIS49/COFINS49 propostos para recolhimento ordinárioDAS do acabado. Não estender
  tratamento de ingredientes ou confundirICMS-ST comPIS05. Diferença paraFAQ
  histórico99 registrada. Sem afirmar data de edição2026 não comprovada.
- [x] IPI analisado por RIPI/MOC/NT/CGSN/LC123: embalagem/processo sustentam proposta
  industrial/AnexoII;0%TIPI não excluiIPI/DAS. Lacuna reduzida a política de grupo,
  CST e cEnq. Não copiar51/53/99/999 nem implementarBaseCalculo inexistente no
  exemploAPI. Rascunho técnico delimitado atualizado, **não enviado**.
- [x] Aplicação real da branch retomada no mesmo banco/chave/sessão. Migration
  já versionada da autonomia aplicada somente à base administrativa exclusiva,
  depois de conferir destino/CNPJ/dados operacionais ausentes/pendência única.
  Nenhuma nova migration criada, nenhum seed, usuário ou segredo alterado.
- [x] Endereço mínimo comprovado salvo via `/configuracoes/empresa`, ação central
  real, e confirmado após recarregar. `HistoricoCadastroVenda/LOJA` presente, ator
  administrativo local. Data registrada no banco12/10,23:06:49.005, fuso declarado
  America/Sao_Paulo; horários preservados por fonte. Razão/CNPJ existentes,
  telefone/e-mail vazios, certificadoSEFAZ e tokens preservados. Configuração
  BrasilNFeHOMOLOGACAO/versão9 com ambos segredos configurados, sem ler valores.
- [x] Tela real `/vendas/fiscal/regras-brasilnfe` abriu pela sessão administrativa
  central; permanece com zero decisões. Não fabricamos regra/aprovação/plano ou
  massa administrativa com códigos incompletos. Prévia afetada foi adicional,
  com fixtures/componentes reais, desktop eviewportCSS390×844; GTINSEM GTIN
  explicitamente digitado, demais parâmetros vazios, sem salvar. Imagens fictícias:
  `evidencias/piloto-55-gtin-desktop.png` e `piloto-55-gtin-mobile.png`, Em revisão.
- [ ] Situação estadual de sublimite2026 →CRT1/2; políticaIPI/CST/cEnq com decisão
  interna e contrato correspondente; adoção humana das demais propostas/versões.
- [ ] Após completar/aprovar regras, fotografia/plano fictícios e manifesto com
  IDs/revisão/versões/hashes reais. JSON continuaIMPEDIDO, sem preencher IDs/hash
  com placeholders. Primeira transmissão continua exigindo autorização própria.

### Novas rodadas — sem atribuir reexecução aos registros anteriores

Node22.23.3/Windows, maior22 do Dockerfile; semDocker/Linux/dependências novas.
Teste de banco somente `teste_brasilnfe_m11_sintetico` emloopback55449, schemas
UUID descartáveis eSQL das migrations existentes. Administração é base separada,
sem massa operacional clonada; nenhum teste usa empresa/produto real.
Logs privados em `.tmp/autonomia-fiscal/issue11-r2-*`, não versionados.

| Rodada | Resultado | Escopo |
| --- | --- | --- |
| GTIN-A1 |177/177,4 arquivos |Primeira extensão; antes da proteção específica todoszeros |
| GTIN-A2 |183/183,4 arquivos |85 montagem,46 domínio,9 mapeamento,43 util; inclui zeros |
| UI-A1 |30/30,1 arquivo |29 consumidores existentes+GTIN;52,05s de suite, sem aumentar timeout |
| Banco-B1 |33 aprovados;59 não executados,4 arquivos |Manifesto15/porta18 passaram; regras/fila não iniciaram porEACCESloopback no contexto restrito. Não conta como banco aprovado |
| Banco-B2 |59/59,2 arquivos |Reexecução com acesso ao banco local permitido; regras38/fila21, semHTTP/efeitos alheios; quatro novos casosGTINproduto/grupo preservam proposta/hash/versão |
| Domínio-B3 |221/221,7 arquivos |Montagem85/domínio46/porta18/autonomia5/manifesto15/mapeamento9/util43 |
| Fallback-B4 |94/94,2 arquivos |Após reforçar fixtures comGTINválido no grupo, comprovando que não é copiado;85 montagem/9 mapeamento |
| C1 |Lint/design/typecheck aprovados |12 arquivos no lint;8 bases/362 consumidores no design;tsc completo |
| Build-C2 |Não compilou |Contexto restrito Windows negoucanonicalizaçãojsc.baseUrl/oserror5, antes de processarapp; sem ocultar falha |
| Build-C3 |Aprovado |ReexecuçãoNode22/ambiente limpo sem banco acessível: compilação33,5s/tipos14,6s/89 de89 páginas; aviso preexistente middleware/proxy |
| C4 |Lint focado/typecheck aprovados |Após reforço das duas fixtures; compilaçãoC3 já incorporou esse reforço; código aplicativo não mudou depois |
| Visual/administrativo |Concluídos com limites distintos |Prévia fictíciaGTIN; sessão real/endereço salvo/releitura e página de regras real. Não simular aprovação no banco administrativo |

**310 casos distintos de10 arquivos** concluíram aprovados entre UI-A1,
Banco-B2 eDomínio-B3, com o reforço das mesmas fixtures reexecutado emFallback-B4.
Não houve uma rodada única310/310 ou regressão global do repositório. Falhas de
acesso das rodadas iniciais constam separadamente. Código revisto por agente
independente; nenhuma flexibilização de contrato fiscal ou timeout.

Nenhuma consulta BuscarEmpresa/ConsultarServicos/certificado ouSEFAZ realizada
neste incremento. ConsultarServicosstatus1 conserva a pendência histórica. Sem
preview, emissão, cancelamento, alteração externa de assinatura/certificado/CSC/
séries/numeração, registro operacional, callback, fila automática, merge/deploy
ou migration produtiva. Estoque/financeiro/notas recebidas/Takeat/iFood/dashboard
intocados. Servidor administrativo mantido somente emloopback3451; prévia encerrada.

## Missão operacional —12/10/2026, sobre92d04eb7

**Implementado e preparado; transmissão ainda não autorizada.** Roteiro e fontes:
[Homologação individual](HOMOLOGACAO-INDIVIDUAL.md). As provas anteriores acima
não foram apresentadas como reexecutadas.

- [x] Preservar a branch e conferir referências remotas; semmerge/rebase/destruição.
- [x] Reconciliar seletivamente o painel478b30b2, preservando sua branch de origem.
- [x] Montagem55/65: representação documentalIPI explícita, sem definir aplicabilidade
  material federal ou Anexo doSimples; observações legais; literal do primeiro item65
  emhomologação, mantendo descrição comercial/snapshot.
- [x] Seis propostas fundamentadas no banco administrativo, com vigência, fontes,
  confiança, versões/hashes reais; dois pedidos/documentos exclusivamente sintéticos.
- [x] Revisão interna consolidada: ato explícito, origem conferida, transação, autoria,
  versões preservadas, marcadores cadastrais auditados; semaprovação pelo agente.
- [x] Capacidade manual servidor: base/identidade restritas, permissões reais, filas,
  leases e eventos duráveis existentes, consumo anterior aoHTTP, concorrência segura.
- [x] Consulta individual, recuperação semreenvio, autorização/rejeição, arquivos
  protegidos e validaçãoXML/total/itens/IPI. Cancelamento técnico simulado; real bloqueado.
- [x] Painel fornecedor lido; IE corrigida com autorização específica e confirmada.
  Endereço completo/Simples/serviço ativo/certificado07/11 observados semler segredos.
- [x] Ajustar CEP mascarado deBuscarEmpresa com validação restrita/regressão; preservar
  confirmação datada quando uma tentativa posterior falha; exibir metadados seguros.
- [x] SepararUF ausente naAPI de evidência direta do painel, limitada a sete dias,
  vinculada à configuração/cadastro e comparada antes do envio. Nenhum outros campos
  recebem preenchimento presumido. CertificadoAPI incompatível continua explícito.
- [x] Produção/processador automático/callback bloqueados; nenhuma transmissão fiscal.
- [ ] Usuário revisar fontes/aplicação e confirmar origem do acabado; aprovar seis perfis.
- [ ] Aprovação específica de umaNF-e55, ambiente2, documentocmv5yyb33000gy0epogt1ch6t,
  valor10.00, versões e hashes aprovados; só então primeira transmissão.
- [ ] NFC-e65: configurarCSC/id no canal protegido e aprovar sua transmissão separada.
- [ ] Homologação comprovada, plano operacional e aprovação específica de produção.

### Verificações realmente executadas —Node22.23.3

|Rodada|Resultado|Observação|
|---|---|---|
|A1|105/105,4arquivos|Fundamentação, regras, representaçãoIPI e entrada manual|
|B1|103aprovados,1falha,5nãoexecutados|FixtureXML semnamespace; domínio protegido rejeitou corretamente; dashboardDB semflag|
|B2|18/18,3arquivos|Corrigida fixture; banco manual/pré-requisitos/dashboard; flagisolada habilitada|
|Bdomínios|873aprovados,2falhas,89DBnãoexecutados,39arquivos|Duas expectativas visuais antigas; DB não contado como aprovado|
|Bconsumidores|31/31,5arquivos|Expectativas atualizadas; rotas, navegação, pedidos, pré-requisitos e entrada|
|Bajustes|235/235,7arquivos|IPI, fundamentos, documentos inválidos preservando autorização e interface|
|Finalfoco|245/245,6arquivos|Cliente, montagem55/65, XML, pré-requisitos e interface manual|
|Finalbanco|18/18,3arquivos|Transporte exclusivamente simulado; concorrência/travas e nenhum efeito alheio|
|Acorreção|20/20,4arquivos|Campos ausentes permitidos, XML e consumidores|
|CEP|231/231,2arquivos|227cliente+4interface; máscaras completas e entradas inválidas|
|Bpreservação|13aprovados,1falha|Fixture de erro semcategoriaHTTP não representava o contrato de metadados; corrigida somente a fixture|
|UFdomínio/UI|241/241,4arquivos|UF direta/temporária, fontes, cliente e bloqueios|
|BUF|13aprovados,1timeout|Teste de concorrência excedeu5s durantebuild; timeout não aumentado|
|Bserial final|14/14,2arquivos|Reexecução apósbuild: pré-requisitos9+homologação5; concorrência e recuperação passaram|
|UI final|9/9,2arquivos|Data civil não perdida ao editar outro campo; ações explícitas55/65 e nenhuma autosalvagem|
|Lint de código|Aprovado|src/scripts/testes e configurações; lint final do diff também aprovado|
|Lint de design|Aprovado|Comando realverificar-tokens-design.mjs;8bases/370consumidores|
|Typecheck|Aprovado|Após ajustes; build também verificou tipos. Última rodada incremental registrada separadamente|
|Prisma validate|Aprovado|Schema existente; nenhum novoSQL/migrate dev/dbpush|
|Build|Aprovado|Node22, ambiente limpo semDB acessível;94/94páginas;2,7mincompilação+2,7mintipos|
|Visual real|Conferido|Sessão central local, estados, hashes, propostas e bloqueios; semmocks na aplicação|

A tentativa inicial delint`.` foi interrompida após incluir temporários gerados;
lint com escopo de código passou. Uma tentativa usou nome inexistente do script
visual e falhou; o comando real passou. Typecheck apontouxmlpossiblyundefined;
corrigido por guarda explícita e reexecutado. Não ocultar essas rodadas nem somar
contagens como casos distintos. Avisos preexistentes: middleware/proxyNext e pgquery
concorrente no setup de testes; não houve atualização de dependências.

Banco administrativo conferido: credenciais presentes/versão9 preservadas,
zero notas recebidas/estoque/financeiro, migrations existentes aplicadas.
[Prévia dos manifestos](PREVIA-MANIFESTOS-HOMOLOGACAO.json): duas montagens completas,
zero aprovações humanas e nenhuma transmissão na data de geração. Os estados
vivos podem evoluir somente por atos específicos do usuário, auditados noHUB.

ConsultarServicos/status1 não foi repetido. As leituras empresariais/certificado e
suas reexecuções após correções concretas estão discriminadas no roteiro. Nenhuma
alteração externa de certificado,CSC,séries,numeração/assinatura. Semdeploy/main/
migrationprodutiva. IntegraçãoSEFAZ,Takeat,iFood e efeitos financeiros/estoque preservados.

Fechamento das verificações: lint final do diff e design aprovados; UI final9/9;
Prismavalidate ebuild94/94 aprovados. Typecheck após o reinício apontou truncamento/
conteúdo residual em`.next/dev/types/validator.ts`, gerado peloNext. O arquivo foi
regenerado pelo mesmo gerador de rotas doNext instalado, sem editar fontes ou
interromper a sessão de revisão. Reexecução final de`tsc --noEmit`: aprovada.
Não se tratava de erro fiscal nem foi removida uma verificação de tipos.

## Revisão humana e coerência do painel —13/10/2026

A sessão administrativa registrou a aprovação interna dos seis perfis em12/10,
23:40Brasília. O agente apenas leu essa evidência. EMPRESA/OPERAÇÃO estão na versão2;
ITEM na versão4, incluindo declaração factual de origem e prova de aprovação.
As propostas anteriores permanecem no histórico. A autorização fiscal externa
continua pendente: nenhum eventoHOMOLOGACAO_AUTORIZADA ou consumo registrado.

[Manifesto NF-e55 aprovado localmente](MANIFESTO-NFE55-HOMOLOGACAO.json):
documentocmv5yyb33000gy0epogt1ch6t, ambiente2, total10.00; sempendências locais;
plano, snapshot, parâmetros, versões, fundamentos e aprovações têm hashes reais.
É leitura do plano existente; não cria aprovação nem transmite. A prévia anterior
permanece como evidência histórica, não como estado atual.

Na validação visual, o Dashboard mostrava somente o diagnósticoAPI anterior.
A projeção foi corrigida para exibir também evidência do painel vinculada ao mesmo
emitente/configuração e limitada a sete dias. ServiçoAPI e certificadoAPI não foram
promovidos a sucesso. Painel, API e ambiente selecionado permanecem separados.
Nenhum dado bruto, credencial ou texto externo é devolvido na projeção.

Reexecuções dessa correção, Node22:49/49testes em3arquivos (dados29,servidor12,
interface8), lint focado, lint:design8bases/370consumidores, typecheck ebuild aprovados.
Build repetido após a alteração:94/94páginas;75scompilação/47stipos. Interface real
conferida com sessão e banco isolados. Semnovas consultas externas ou alterações
nas integrações de notas recebidas, financeiro ou estoque.

## Primeira tentativa real de homologação e recuperação — 13/10/2026

Autorização específica recebida para documento `registro-sintetico-2`, NF-e 55,
ambiente 2, R$ 10,00. Uma ação de transmissão executada na tela real, com sessão e
permissões normais. Um evento de autorização e um consumo durável. Resultado
`PENDENTE_CONFERENCIA`; sem chave ou protocolo confirmado. Não é homologação concluída.
O manifesto e as seis aprovações internas anteriores foram preservados.

Foram executadas três consultas manuais desse documento: inicial, após corrigir
a perda de metadados e após completar os indicadores do envelope. A última,
00:28:06 (Brasília), comprovou HTTP 200/status numérico 1/erros vazio/Error ausente,
sem supressões. Aceitação 0 permanece conforme contrato. Não repetir sem evidência
nova do fornecedor. ConsultarServicos não foi repetido.

Implementados propagação de metadados seguros, auditoria da falha na composição
manual e apresentação datada na tela. Mensagens, cause, headers e respostas brutas
nunca são gravados. Nenhum dado bruto de BuscarEmpresa foi extraído. Campos e
regras de emissão não foram flexibilizados. Rascunho específico ao suporte preparado
em CONTRATOS, sem envio.

Validação desta alteração, Node 22.23.3:

- Rodada focada inicial: 28/28 em adaptador, consulta e interface.
- Banco sintético inicial: 4/6; o caso concorrente excedeu 5 s enquanto rodavam
  outras verificações. A nova asserção pegou o evento anterior sob data fictícia
  idêntica. Corrigidos desempate do histórico e relógio/massa do caso. Nenhum timeout
  aumentado. Reexecução independente: 6/6.
- Versão final: 316/316 em 5 arquivos (cliente 227, operações 57, adaptador 14,
  consulta 13, interface 5). Respostas externas são simuladas somente na suíte.
- Banco final: 6/6 em schema UUID exclusivo da base sintética. Cobertura de
  concorrência, autoria, transporte, HTTP 403, resposta malformada, arquivos,
  consulta vazia, bloqueio de reenvio e ausência de efeitos alheios.
- Build final aprovado, 94/94 páginas; 73 s de compilação e 44 s de tipos.
- Fechamento: lint do diff, lint:design (8 bases/370 consumidores),
  `tsc --noEmit`, Prisma validate e `git diff --check` aprovados. Nenhuma
  dependência, schema ou migration foi alterada. Aviso de middleware/proxy
  preexistente no build; não é falha fiscal.

Interface real conferida com sessão central e banco administrativo isolado. Evidência
visual saneada em `.tmp/issue11-revisao/nfe55-resultado-incerto-20261013.png`, ignorada
no Git. A tentativa de leitura do próprio resultado no painel ficou indisponível
por falha do controle da aba. Nenhuma conclusão do painel foi inventada.

Contagens finais: seis versões aprovadas, uma autorização, um consumo, nenhuma
nota recebida, movimentação de estoque ou lançamento financeiro nessa base.
NF-e 55 sem ação agendada; NFC-e 65 sem tentativa e bloqueada por CSC/id.
Sem cancelamento, reenvio, produção, fila automática, callback, merge, deploy ou
migration produtiva. A branch paralela do dashboard não foi alterada.

## PR #21 — recuperação comprovada e venda nº 14 — 14/10/2026

Base preservada `98205dcb`, incluindo `ca039045` e a reconciliação anterior. O
[comentário técnico](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/21#issuecomment-6178047797)
foi executado. Não houve nova frente de desenvolvimento ou mudança no dashboard.

- [x] Corrigir o envelope exclusivo de ConsultarNotaFiscal: status 1 processado;
  0 somente com estrutura coerente; 2/erro/contradição recusados. Preservar o valor
  observado e separar de Nota.Status. BR0008 não autoriza reenvio.
- [x] Validar principal/histórico, identidade, ambiente, modelo, chave, número,
  série, protocolo e código SEFAZ. Preservar resultados confirmados e precisão.
- [x] Reconhecer rejeição única comprovada na recuperação. 181 tem fonte primária
  oficial. Múltiplas tentativas, código desconhecido ou contradição ficam em conferência.
- [x] Consultar uma única vez o piloto antigo, sem retransmitir: 20:46:32 Brasília,
  HTTP 200, envelope 1, Nota.Status 3, código 181, Emitida false, histórico vazio.
- [x] Reconciliar localmente a mesma evidência pela fila existente: 20:54:17,
  REJEITADO, número 1, série 1, chave conservada, sem protocolo/arquivos autorizados,
  uma tentativa e nenhum reenvio. Não houve nova consulta nessa reconciliação.
- [x] Conferir CSC em leitura autenticada separada: 20:47:10. CSC/identificador
  ausentes em ambos os ambientes. Empresa correspondente; certificado API ainda
  fora do contrato de data. Evidência do painel até 07/11 permanece separada.
- [x] Revisar origem/FCI exclusivamente da Grazing para 1. Damasco/azeitona
  importados impedem presumir origem 0. Salame origem 5 é nacional no novo CI.
  Não dispensar FCI por venda interna, Simples ou CI inferior a 40% isoladamente.
- [x] Conferir vínculos da venda nº 14 em leitura delimitada. Não há documento
  fiscal ou referência externa no HUB; isso não confirma inexistência no Takeat.
- [ ] Corrigir destinatário do cenário de homologação rejeitado, preparar nova
  revisão e obter autorização específica antes de outra transmissão.
- [ ] Apurar VI/VS do período aplicável, completar origem das embalagens e obter
  controle FCI legítimo, quando aplicável. Aprovar as versões por ato interno real.
- [ ] Conferir a venda no Takeat por acesso legítimo e vincular eventual documento.
  O controle da aba não respondeu; não foi usado endpoint fiscal não documentado.
- [ ] Cadastrar CSC/id no canal protegido antes de homologar NFC-e.
- [ ] Comprovar homologação autorizada e então solicitar publicação/ativação e
  emissão produtiva específicas. Não há solicitação prematura de aprovação real.

### Verificações desta correção

Node **22.23.3**. Nenhuma dependência/schema/migration alterada. Respostas simuladas
somente nos testes; nenhum pedido real foi usado como massa. Evidências privadas
estão ignoradas no Git e não contêm respostas brutas do fornecedor.

| Execução | Resultado |
| --- | --- |
| Primeira regressão do contrato: cliente/consulta/adaptador/operações | 438/438; 6 arquivos |
| Integração inicial do envelope com a fila | 10/10; schema sintético UUID |
| Correção da rejeição 181: unitários | 109/109; 3 arquivos, incluindo 20 casos novos de recuperação |
| Integração da rejeição/reconciliação sem rede | 11/11; deduplicação, autoria, travas, sem reenvio ou efeitos alheios |
| Domínio fiscal final e interfaces consumidoras | **1.082/1.082; 42 arquivos; nenhum skip**; banco sintético/schema descartável |
| Lint do patch final / typecheck completo | Aprovados; typecheck repetido após o build, antes de reiniciar o servidor local |
| Lint de design | 8 bases/394 consumidores; 395 arquivos auditados; zero desvios novos |
| Prisma validate | Aprovado; sem migration executada |
| Build webpack Node 22 | Aprovado; 99/99 páginas; cache existente; servidor local próprio pausado e restaurado; sem acesso à produção |

As reexecuções se sobrepõem; não somar contagens como casos distintos. O processo
inicial da suíte final não foi iniciado por expiração da revisão automática de
permissão. A repetição única foi executada e aprovada. O primeiro preparo do build
encontrou o filho já encerrado pelo processo pai; a parada foi tornada tolerante a
essa condição, sem encerrar outros processos. O build seguinte terminou com êxito.
Não houve aumento de timeout. Avisos preexistentes: middleware/proxy Next e consulta
concorrente no setup pg. Capturas/contratos visuais da entrega anterior não foram
apresentados como reexecutados; este patch não altera componentes visuais.

Resultado externo: **rejeição comprovada; homologação não concluída**. Não chamar
download de documentos autorizados sem protocolo. ConsultarServicos não foi repetido.
PRODUÇÃO, fila automática e callback continuam bloqueados. Sem alteração de notas
recebidas SEFAZ, Takeat, iFood, estoque, financeiro, certificado ou numeração externa.

## PR #21 — Porta A: estrutura antes da emissão — 14/10/2026

O [comentário vigente](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/21#issuecomment-6181437342)
substitui a ativação fiscal nesta execução. A versão publica somente a estrutura.
A instrução final do usuário permite publicação ao concluir; não autoriza emissão.
O bloqueio abaixo prevalece sobre habilitações/autorização históricas desta página.

- [x] Bloqueio fixo por código dos modelos 55/65 em produção e homologação.
  Cobre ações individuais, adaptadores atuais/legados, fronteira HTTP, fila,
  processador automático, cancelamento, prévia externa e callback. Não há flag
  de ambiente/credencial que libere transmissão. Consulta e arquivos são separados.
- [x] Prévia do pedido confirmado com itens/valores reais da fotografia, tributação
  secundária, pendências e numeração local. Funciona sem Config/Token/PERFIL aprovados.
  A ação final mostra **Emissão ainda não liberada**. Pedido em rascunho não a oferece.
- [x] Corrigir leitura de pré-requisitos do perfil fiscal comum: usa estados locais
  restritos, sem conceder administração da integração, credenciais ou consulta externa.
- [x] Corrigir os atalhos do host dedicado de Pedidos para a origem confiável do HUB.
  Não ampliar hosts/cookies/perfis. Arquivos XML permanecem no caminho permitido.
- [x] Habilitação e pilotos respeitam o gate false, mesmo com registros antigos.
  Aprovação fiscal local e histórico permanecem separados de autorização de envio.
- [x] Séries e numeração após Empresa fiscal, consulta administrativa manual, limites,
  intervalo e auditoria vinculada à configuração/emitente. Próximo número não reservado.
- [x] Conferir seletores existentes na aplicação real: produto, complemento e grupo;
  NCM/CFOP/PIS/COFINS por busca; seleção NCM pelo teclado. Nenhuma classificação salva.
- [x] Desativar logging automático de argumentos de Server Functions e de console do
  navegador no Next dev, conforme o guia instalado da versão 16.3.4. Sem log de credenciais.
- [x] Preservar a rejeição 181 encerrada da tentativa anterior. Não repetir a consulta,
  ConsultarServicos ou transmissão. Nenhuma autorização de emissão solicitada.

### Aplicação real e evidência visual

Next real, Node 22, sessão/senha e permissões centrais, banco
`teste_pr21_estrutura_ui_20261014` no PostgreSQL loopback55449. Banco criado vazio;
132 migrations SQL aplicadas somente nele, pelo reconciliador existente. Sem clone
produtivo, sem credenciais Brasil NFe ou dados comerciais reais. Chave exclusiva
persistente/DPAPI/DACL; nenhuma chave original do ambiente administrativo foi alterada.

Administrador, perfil comum autorizado e perfil restrito foram conferidos. O restrito
não vê o botão do pedido e as rotas fiscais administrativas retornam `/sem-acesso`.
O perfil fiscal sem permissão da integração lê numeração local, sem botão de consulta
externa. A prévia alterna 55/65 e mantém a ação desabilitada; Escape devolve o foco.

30 capturas/estados em 320/390/768/1440, claro/escuro conforme a matriz; auditoria DOM
sem problemas. Telas: Visão geral, Empresa fiscal, Séries e numeração, Grupos, Regras,
Classificação, Brasil NFe, Homologação, Produto, Complemento e Pedido. Três capturas
adicionais mostram a busca local/teclado dos editores. Não há mocks na aplicação.
Resultados simulados de autorização/documentos permanecem exclusivamente nas suítes.
Capturas consultivas **Em revisão**, sem aprovação humana presumida:
[Pedido desktop](evidencias/estrutura-pedido-real-1440.png),
[Pedido celular](evidencias/estrutura-pedido-real-390.png),
[Grupo/seletores](evidencias/estrutura-grupo-real-390.png),
[Numeração celular](evidencias/estrutura-numeracao-real-390.png).

Conferência final no banco: zero lançamentos financeiros, estoque, notas recebidas,
tentativas de envio e eventos ENVIAR. Pedido sintético mantém versão 2, CONFIRMADO e
R$ 10,00. Classificação do produto continua vazia/não revisada. Callback real local
responde HTTP 503. O ambiente administrativo original e suas credenciais foram preservados.

### Consulta autenticada separada

`ConsultarNumeracao`, ação real com administrador local e credenciais previamente
salvas: 14/10, **21:47:48 Brasília**, HTTP200, CONTRATO/NUMERACAO_ITEM. Contadores não
confirmados. Resposta bruta descartada; nenhum número presumido/reservado. Não repetir
por rotina. Fonte, limitação e rascunho específico ao suporte em [CONTRATOS](CONTRATOS.md).

### Verificações e reexecuções — Porta A

Node **22.23.3**, dependências preservadas. Logs privados ignorados no Git.

| Verificação | Resultado executado |
| --- | --- |
| Matriz fiscal, tributação, permissões, dashboard e consumidores | 2.009 testes aprovados; cinco suítes recusaram o banco escolhido no setup, conservando suas guardas; 69 casos não executados nessa rodada |
| Cinco suítes restantes no banco exigido `teste_estrutura_fiscal` | **72/72**, sem skip; três casos já pertenciam à matriz. O recorte total de 2.078 casos ficou coberto entre as duas rodadas |
| Correção do getter de prévia / perfil comum / ciclo futuro sintético | **12/12**, sem rede; ambos os modelos, revogação e ausência de permissão |
| Navegação entre hosts e consumidores finais | **68/68**, além de 17/17 do consumidor de Integrações; contagens sobrepostas com a matriz, não somar |
| Fixture da guarda fixa | **11/11** após declarar `producaoAutorizada:false` no caso de consulta; apenas correção do tipo da fixture |
| Numeração isolada / regressão do cliente | 285/285, cinco arquivos; 58 casos novos de numeração |
| Prévia visual sintética | Numeração: 13 cenários; Pedido: 8/8 Playwright; auditoria sem problemas |
| QA na aplicação real | 30 capturas/estados + 15 buscas/teclado nos três editores; administrador/autorizado/restrito; sem mocks, envio, aprovação ou efeitos comerciais |
| ESLint completo final / lint:design | Aprovados; 8 bases/396 consumidores; 397 arquivos, zero desvios novos (96 históricos) |
| Typecheck completo final | Aprovado; build também conferiu tipos |
| Prisma validate | Aprovado; nenhuma migration produtiva nesta verificação |
| Build webpack Node22 | **Aprovado, 100/100 páginas**, 54 s compilação e 92 s de tipos |
| Ausência de efeitos no QA | Financeiro/estoque/recebidas/tentativas/eventos ENVIAR = 0; classificação não salva; pedido preservado; callback HTTP503 |

As primeiras rodadas ficaram registradas separadamente: contrato da nova ação faltava
no inventário central de testes; consumidores antigos ainda esperavam habilitação;
um caso de interface excedeu 5 s sob carga. Foram corrigidos contrato/consumidores;
a reexecução focada passou sem aumentar timeout. As cinco suítes de estrutura exigem
outro banco sintético pelo contrato; executá-las nele resolveu o setup sem afrouxar
as guardas. A primeira verificação de tipos foi interrompida para reduzir concorrência
de memória. A segunda identificou apenas campo obrigatório ausente numa fixture;
a terceira e o build passaram. Nenhum desses estados foi apresentado como aprovação.

Os roteiros de browser foram corrigidos para usar o host local dedicado, abrir o
editor pelo botão correto e aguardar a conclusão real das ações. O perfil restrito
foi concluído numa rodada separada. O login com JavaScript responde200 e o formulário
nativo303; ambos exigiram acesso autenticado verificado nas rotas. Não houve cookie
fabricado, captura da senha, HAR/trace ou saída de headers/credenciais. Warning
preexistente middleware/proxy e de query concorrente no setup pg não foram ocultados.

O ambiente administrativo original foi restaurado na porta3451 com seu banco/chave.
Nenhuma emissão, consulta da tentativa encerrada ou ConsultarServicos foi realizada
nesta Porta A. A publicação da estrutura não comprova homologação fiscal.

### Reconciliação final para publicação da estrutura

A reconciliação `b1cbdbc1` preserva integralmente `6eb2909e` da main e seus nove
arquivos de Fluxo de Caixa. Nenhuma worktree paralela foi alterada. O código fiscal
`0184c928` passou nos dois controles remotos da PR: design e contratos de interface.

Na versão reconciliada, o recorte Financeiro/consumidores teve 67 aprovações e uma
falha de interface sob carga simultânea de build. A reexecução isolada do mesmo
arquivo passou **4/4**, sem alteração de fonte nem aumento de timeout. O build
reconciliado passou **100/100 páginas**, com tipos conferidos (70 s de compilação,
24 s de tipos). ESLint completo e lint:design passaram novamente: zero desvios novos.
Esses resultados são adicionais; não representam reexecução da matriz fiscal inteira.

Backup imediato de publicação validado na VPS, sem clone local: custom dump de
115.418.168 bytes, `pg_restore --list` válido, imagem/configuração anteriores
preservadas. Caminho e hash em [OPERAÇÃO](OPERACAO-20261014.md). A autorização final
do usuário permite publicar a estrutura. Não autoriza emissão, consulta repetida,
ativação automática ou alteração dos segredos externos.

## Configuração após PR21 — `codex/fiscal-num` — 14–15/10/2026

- [x] Retomar main `d144b665`, preservar a PR integrada e alterações paralelas.
  Branch curta nova; nenhuma mudança na main/publicação nesta execução.
- [x] Diagnóstico restrito de `NUMERACAO_ITEM`: posição, campo, tipo e motivo local.
  Sem valores/respostas/segredos. Testes de reflexão de credenciais e whitelist.
- [x] Comprovar causa em leitura real: item17, ModeloDocumento inteiro fora da
  lista fixa; HTTP200. Separar outros modelos identificáveis antes dos campos55/65.
  Não converter tipos ou preencher campos ausentes. Nova leitura concluiu; quatro
  contadores série1/próximo1/padrão. Rodadas e origem em [Numeração](NUMERACAO.md).
- [x] Preservar resultado por configuração/emitente, histórico antigo e invalidação.
  Registros de outros modelos têm contagem própria, sem afirmar validação deles.
- [x] Conferir interface publicada com sessão Administrador, somente leitura.
  Usuário preencheu credenciais na tela protegida. Recarregamento confirmou presença
  e campos vazios. Nenhum segredo local ou aprovação foi transferido.
- [x] Executar uma conferência publicada de empresa/certificado/CSC às23:39:25.
  Emitente corresponde, endereço completo; CSC/id ausentes em ambos ambientes.
  CertificadoAPI HTTP200/CERTIFICADO_DATA, sem validade confirmada. Painel observado
  separadamente: NF-e/NFC-e ativo e A1 até07/11/2026. Não repetir ConsultarServicos.
- [x] Conferir Visão Geral em homologação após recarga completa: Acesso verificado.
  A divergência de aba antiga não se reproduziu no documento recarregado nem na
  função publicada. Separadamente, regressão sintética comprovou sensibilidade à
  ordem de propriedades no resumidor; projeção explícita corrigida sem mudar hashes
  persistidos, validade, ambiente, permissões ou gate. Não atribuir o caso produtivo
  a essa correção sem evidência.
- [x] Conferir pedido, metadados das versões e município em transação somente leitura. Identificadores e valores observados permanecem privados.
  Cálculo local existente55/65 em memória; fetch bloqueado, zero chamadas externas.
  Sem abrir preparação, criar snapshot/documento ou alterar o pedido. Versão5,
  R$139,00 + freteR$26,00 = R$165,00. Hashes das versões e eventos conferidos.
  Resultado detalhado seguro fica privado; pendências em [OPERAÇÃO](OPERACAO-20261014.md).
- [x] Preservar rejeição181, gatefalse55/65 em ambos ambientes, SEFAZ recebidas,
  Takeat, estoque e financeiro. Nenhuma transmissão ou aprovação humana presumida.

### Verificações desta correção

Node22.23.3; dependências existentes. Testes automatizados exclusivamente sintéticos.
Resultados iniciais e reexecuções não são homologação externa:

- Numeração/diagnóstico:64/64 antes da leitura; regressão cliente227/227.
- Após correção:123/123 em cinco arquivos de cliente/domínio/serviço/UI/diagnóstico.
- Configuração/pré-requisitos/guardas/detalhes:145/145 em quatro arquivos, incluindo
  integrações com schemas efêmeros no banco local sintético. Sem skips nessa rodada.
- Resumo de integração/dashboard:31/31. Regressão nova falhou antes e passou depois.
- Visual:16 estados de diagnóstico/outros modelos,320/390/768/1440,claro/escuro;
  auditoria zero problemas. Evidências sintéticas Em revisão. Sessões publicadas
  foram lidas sem capturas de dados reais.
- ESLint completo e lint:design aprovados;397 arquivos,96 desvios históricos,zero novos.

A primeira execução de testes não iniciou casos por EPERM no cache do sandbox.
Foi repetida com cache próprio, sem alterar testes/timeouts. O primeiro typecheck
identificou estreitamento estático necessário em Numero/Padrao; guards de runtime
foram preservados. A reexecução final passou **123/123** casos de numeração; typecheck
completo passou na segunda rodada. Build webpack Node22 aprovado,100/100 páginas e
tipos conferidos. ESLint completo mais lint focado dos últimos ajustes aprovados.
Nenhum timeout foi aumentado. Nenhuma migration foi necessária nesta correção.

Após o build, a aplicação administrativa local foi reiniciada no mesmo ambiente.
A sessão central confirmou quatro linhas e 16 itens fora do escopo. A recarga
preservou o resultado concluído. Essa conferência não chamou a API nem gerou captura.
O relatório Takeat de 14/10 ficou vazio após uma recarga; a verificação da venda
permanece inconclusiva. Não confundir tela vazia com ausência de documento.

## Continuação de 15/10 — configuração e prévia sem transmissão

- [x] CSC/identificador conferidos em canal protegido: produção configurados;
  homologação ausentes. Série padrão55/produção6/próximo1 confirmada no painel;
  65/produção7/próximo1 registrada como diferença, sem alterar nenhum contador.
  Evidência manual de serviço/certificado/presença CSC salva às01:53:49 e conferida
  após recarga, com origem identificada e sem substituir o diagnóstico da API.
- [x] Salvar pela sessão normal três rascunhos prospectivos no HUB: PERFILv3
  CRT1/BRASIL_NFE, CLASSIFICACAO G1v3 SEM GTIN ainda PENDENTE e REGRA específicav1.
  Fontes/versões anteriores preservadas; hashes reais conferidos em leitura.
  Não simular aprovação interna nem converter rascunhos em configuração vigente.
- [x] Corrigir o editor para partir do perfil ativo/vigente, preservando o futuro.
- [x] Separar aprovação administrativa do PERFIL da liberação produtiva. Não ligar
  flags nem modificar a Takeat. Bloqueio fixo de transmissão permanece false.
- [x] Recuperar a conferência fiscal local do pedido confirmado, com serviço de
  prévia existente, sem preparar documento/fila. Corrigir retorno de foco do diálogo.
  A seção não duplica histórico nem afirma ausência de documentos da seção principal.
- [x] Resolver IBGE ausente por cidade/UF fotografadas e tabela oficial local,
  sem consulta de CEP ou substituição de código explícito inválido/contraditório.
- [x] Conferir pedido14/v5/R$ 100,00 (exemplo sintético), metadados das versões e município3550308 em
  transação produtiva somente leitura. Sem API fiscal e sem efeitos comerciais.
- [x] Delimitar o alerta de identidade: conferência readonly às02:03:13 comprovou
  v3 compatível com pedido/cadastro atuais em principal e materiais; v2 diverge.
  Resolvedor puro em memória retornou zero pendências de identidade com v3, sem
  aprovar a proposta, reescrever snapshot ou resolver origem/FCI por inferência.
- [x] Manter XML antigo da NFC-e opcional. Documento material residual e alcance
  da revisão de origem/FCI em [Operação](OPERACAO-20261014.md), sem reiniciar o dossiê.

### Verificações novas desta continuação

Node22.23.3, dependências reaproveitadas, banco de testes exclusivamente local:

- Estrutura/versões/autorização/auditoria: **14/14**, incluindo aprovação de PERFIL
  Brasil NFe sem flag produtiva e prova de não liberação de rede/adaptador/gate.
- Consolidação de domínio/UI: **102/102**, sete arquivos. Após ajuste de foco,
  consumidores próximos **46/46**, três arquivos; 40 casos se sobrepõem à rodada
  anterior. A revisão final acrescentou um caso contra mensagem falsa de ausência
  de documentos; reexecução **47/47** aprovada. Total distinto destas suítes e
  integração: **123**.
- Depois de corrigir uma opção tipada do teste, Detalhe do pedido **26/26** de novo.
  Typegen e typecheck completo aprovados; a primeira rodada de typecheck encontrou
  somente `exact` indevido em ByRoleOptions no teste novo, corrigido sem relaxar busca.
- ESLint completo e focado aprovados. `lint:design`:397 arquivos,96 desvios históricos,
  zero novos. Prisma validate aprovado; sem mudança de schema ou migration nova.
- Build webpack aprovado:100/100 páginas. Aviso histórico middleware/proxy preservado.
- Após o último ajuste de apresentação, typegen, typecheck completo e build foram
  executados novamente e aprovados. Nenhum timeout ou configuração foi afrouxado.
- Aplicação Next real com banco sintético exclusivo, login normal: perfil vigente
  SN/CRT1/Brasil NFe preservou propostaLP2027; prévias55/65 somente leitura passaram.
  Oito capturas390/1440, claro/escuro, auditoriasDOM sem problemas; Escape retorna
  ao gatilho. Documentos7→7; financeiro/estoque/recebidas0→0. Não é homologação fiscal.
  Evidências **Em revisão**: [perfil](evidencias/perfil-vigente-1440-light-sintetico.png)
  e [prévia](evidencias/previa-local-65-390-dark-sintetico.png).
  Nova QA real confirmou também a ausência da mensagem e do histórico duplicados;
  as oito capturas foram atualizadas e os mesmos contadores permaneceram estáveis.

Regressões iniciais registradas separadamente: bloqueio do perfil reproduzido antes
da correção; a fixture LP assumia singleton sem versões e foi ajustada à base real
do teste. Destinatário teve5 falhas antes/14 casos aprovados depois. A primeira QA
achou perda de foco; correção e nova QA completa passaram. Sondas no sandbox não
comprovaram ausência do PostgreSQL; não confundir recusa de rede com banco inexistente.

Servidor QA3452 encerrado; ambiente administrativo3451 restaurado com banco/chave
anteriores. Nenhuma cópia, segredo, banco ou cache foi removido. Main e trabalhos
paralelos permanecem preservados. A revisão automática recusou a mesclagem de
origin/main na própria branch por interpretar o limite anterior sem merge de forma
ampla. Não houve contorno, merge, deploy ou transmissão. Publicação da estrutura
e qualquer emissão continuam atos separados, dependentes das autorizações aplicáveis.

## Publicação autorizada — 15/10/2026

- [x] Reconciliar main7a8e874e na própria branch, preservando commits e trabalhos paralelos.
- [x] Registrar decisão definitiva55/série6 e65/série7 nos dois ambientes; remover
  a divergência antiga e encerrar pendência Takeat pela declaração do proprietário.
- [x] Criar backup privado íntegro na VPS e fixar imagem de reversão. Plano do
  candidato conferido no destino produtivo somente em leitura: zero migrations pendentes.
- [x] Reproduzir descarte de IBGE:2 falhas/11 aprovações antes da ligação ao serviço;
  após correção,15/15 com consumidor do formulário, lint focado aprovado. Prisma gerado.
- [ ] Concluir administração de numeração e prévia sem escrita ao abrir o pedido.
- [ ] Executar controles finais Node22 e CI, integrar PR22 e acompanhar publicação.
- [ ] Conferir configuração/contador/CSC/perfil/prévia/permissões pela aplicação publicada.

Nenhuma emissão, cancelamento, inutilização ou consulta da tentativa181 é autorizada.
O pedido14 conserva versão e valores. A única memória material faltante é a
apuração CI/FCI identificada do período aplicável, detalhada em [Operação](OPERACAO-20261014.md).

## Retomada da habilitação manual —20/10/2026

- [x] Preservar main, PRs integradas e trabalhos paralelos; branch curta sobre main.
- [x] Consultar o contador pela aplicação autenticada:55/produção/série6/próximo2.
  A tela anterior exibia cache16/10; nenhuma escrita ou reset de numeração ocorreu.
- [x] Conferir CSC pelo canal protegido:produção presente;homologação ausente.
- [x] Implementar decisão administrativa65/produção, com autoria, executor, selo e
  CSC recente, sem declarar homologação nem aprovar tributos;55 mantém prova própria.
- [x] Corrigir estados visuais por modelo e negar fallback a habilitação antiga
  quando o registro mais recente estiver inválido, também no Dashboard.
- [x] Testes sintéticos iniciais:108 focados,115 de regressão e16 SQL aprovados.
  A primeira rodada SQL não executou por banco local parado; após iniciar o mesmo
  cluster exclusivo, a reexecução passou. Nenhum teste usou banco produtivo.
- [x] Reconciliar o seletor da PR34/main d38beca6 sem sobrescrevê-lo.
- [x] Regressão final Node22.23.3:233 testes unitários/consumidores aprovados,
  além dos16 SQL anteriores. Client Prisma local gerado para o schema atual.
  Typecheck final aprovado após corrigir a opção tipada do teste e o import da
  configuração Vite; não foram relaxadas validações nem alterado o schema.
- [x] QA isolada:8 cenários320/390/768/1440, claro/escuro, teclado e auditoriaDOM
  sem problemas. A primeira partida da prévia falhou por diretório de trabalho;
  corrigida e reexecutada, sem aumentar timeout. Capturas inspecionadas de320/390/1440.
  Referências **Em revisão**: [desktop](evidencias/habilitacao65-1440-claro-sintetico.png)
  e [celular escuro](evidencias/habilitacao65-320-escuro-sintetico.png).
- [x] Typecheck completo, lint global e Prisma validate aprovados. Lint de design:
  421 arquivos,92 desvios históricos,zero novos. Sem migration ou atualização de dependências.
- Build, controles CI e publicação/conferência da revisão final ficam registrados
  na [PR36](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/36), com o SHA
  efetivamente validado. Não reutilizar resultado de uma revisão como prova de outra.

Pedido16 conserva pendências próprias: origem da cesta, GTIN das apresentações,
CEST de fracionados, regra do lombo defumado, fechamento das linhas, presença fiscal
e dados fiscais do cartão. Não copiar decisões da Grazing para1 para essa cesta.
Nenhuma transmissão, consulta da tentativa181 ou alteração de contador foi realizada.

## Correção de cartão no fluxo NF-e55 —21/10/2026

O bloqueio universal de cartão na prévia v2 era excessivo para55. A
[NT2025.001v1.03, YA04-10](https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?conteudo=NvuzQGYd6E8%3D)
mantém a exigência do grupo card nesse modelo para implementação futura.
O fluxo55 preserva FormaPagamento03/04 e o valor fotografado, sem inventar
integração, credenciadora ou autorização. O modelo65 mantém sua pendência.
A montagem v2 real valida os pagamentos e os totais. O legado permanece preservado.

As pendências materiais da Cesta continuam específicas da mercadoria. O alerta
de soma pode resultar das linhas bloqueadas; não exige alterar preços comerciais.
Rodadas de testes, SHA publicado e conferência real desta correção serão registrados
na PR correspondente, sem atribuir reexecução às evidências da PR36.
