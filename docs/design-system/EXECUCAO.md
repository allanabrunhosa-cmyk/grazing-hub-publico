# Execução — Central de Design e Experiência

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Retomada da proteção visual — 13/10/2026

PR #10 sincronizada com `main` `78d72240`, sem conflitos e sem diff próprio em runtime,
schema ou migrations. A autorização desta retomada permite integrar/publicar somente
com validações aprovadas e sem bloqueios. A proteção da main não pôde ser aplicada:
o GitHub respondeu 403 e exigiu GitHub Pro para o repositório privado. Não alterar
plano, visibilidade ou contornar o impedimento. Integração/publicação permanecem pendentes.

O [CI Linux de origem](https://github.com/allanabrunhosa-cmyk/grazing-hub/actions/runs/38342215955)
passou: 252 contratos, 60 capturas e seis provas do comparador. A
[galeria Linux](evidencias/2026-10-13-linux-candidatas/README.md) preserva 12 PNGs
sem transformação, com IDs, hashes e metadados. Todas as candidatas estão Em revisão;
nenhuma referência foi aprovada e o baseline dos 98 desvios permanece intacto.
Resultados finais de lint, bateria completa, tipos, build/smoke e CI estão nos checks
e na descrição da [PR #10](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/10).

## Consolidação e proteção visual — 12/10/2026

PR #9 integrada em `a0281b31` e publicada com tarefa estável, migrations em dia,
configuração fiscal preservada e Central/HTTPS conferidos sem gravações.
A segunda etapa usa branch e PR próprias, sem autorização de merge/deploy.
Contrato operacional e aprovação de referências: [proteção automatizada](protecao-visual-automatizada.md).
Triagem histórica: [98 ocorrências individualizadas](triagem-desvios-2026-10-12.md).
Validações e evidências desta execução ficam no [relatório de entrega](validacao-protecao-visual-2026-10-12.md);
capturas novas continuam Em revisão, sem alterar progresso histórico abaixo.

## Ajuste solicitado — seletores ancorados, 02/10/2026

- Pedido: aplicar em todo o sistema listas abaixo do campo, sem confundir opção destacada com selecionada; preservar grupos de categoria quando pertinentes.
- Reutilizados Select, Combobox e MultiselecaoCombobox, tokens e agrupamentos existentes. Abertura abaixo/início, distância de 4px, superfície comum e inversão apenas por falta de espaço, sempre fora do gatilho. Nenhuma variante visual ou token novo.
- Criado o adaptador reutilizável SelecaoFormulario, documentado no inventário/padrões, para migrar 64 selects nativos em 22 arquivos preservando valores, nomes, formulários, validação, estados bloqueados e regras. A última sugestão datalist (Marca/fornecedor de Etiquetas) passou para Combobox, mantendo texto livre, limite, Escape e perda de foco.
- Central atualizada com exemplos simples/múltiplos agrupados e selecionados; referência permanece Em revisão. Auditoria não encontrou select/datalist nativos nem abertura superior explícita em src.
- Validação visual isolada: desktop 800px, celular 390px, seleção prévia e múltipla; lista separada por 4px, sem transbordamento horizontal. Em janela curta, colisão inverte sem sobrepor o campo. Nenhuma operação ou dado real utilizado.
- Verificações: lint global, lint final dos consumidores, TypeScript, lint:design (8 bases/299 consumidores), compilação Next e HTTP protegido. Regressão global: 1825 aprovados, 324 integrações de banco não executadas e 5 falhas; duas interações legadas/assíncronas foram corrigidas e o reteste de 4 arquivos passou (23 casos). Restam 3 falhas preexistentes de Perdas com dados de setembro fora do filtro de outubro, fora deste escopo. Etiquetas: 15/15, incluindo sugestão, texto livre, Escape e blur.
- Integração preservou as atualizações remotas de fornecedores e testes de status (base 457c4d18), além de três registros documentais locais anteriores excluídos deste commit.
- Publicação autorizada pelo usuário. Backup privado etiquetas-seletores-20261002-a conferido por catálogo/restauração para saída descartada: 26527768 bytes, SHA-256 3f00bc1a704419b3856c6f7d1e632f96f0c909e65c9c90f9b69c40c03666fb20. Sem migration ou alteração de banco. Deploy e estabilidade serão registrados localmente após publicação, sem novo deploy documental.

## Ajuste solicitado — abas e saída de popups, 02/10/2026

- Base publicada: `b8d0b3b6`. Trabalho isolado em `codex/clientes-abas-descarte`;
  alterações preexistentes de outros registros de execução foram preservadas.
- Clientes/Pedidos compartilham o título **Informações gerais** e as abas de cobrança
  `TabsList variant="line"`, com `+` em `Button icon-sm`. O editor de Cliente reutiliza
  `TabsList variant="buttons"` e `TabsTriggerBotao` para as abas principais maiores.
- Pedido do usuário: apenas o alerta de continuar editando/sair sem salvar pode
  sobrepor outro popup. O `Dialog` central suspende painéis anteriores sem desmontar
  dados, coordena filhos antes da pintura e oculta qualquer popup comum imediatamente
  ao fechar, inclusive em transições entre irmãos em Movimentações/Conciliação.
  Fluxo de caixa, usuários e simulador tiveram somente a composição React ajustada
  para participar dessa coordenação, sem alteração de regras comerciais ou de acesso.
- `ConfirmacaoDescarteDialogo` reutiliza o AlertDialog oficial em portal fora da
  área rolável, com foco inicial em Continuar editando, retorno sem deslocar o scroll,
  Escape para continuar e descarte exclusivamente por escolha explícita.
- Nenhum token ou variante visual novo. Contrato reutilizável documentado em
  `padroes.md` e `inventario.md`; referência visual permanece **Em revisão**.
- Prévia com dados fictícios: Clientes e Pedido conferidos em desktop e 390 × 844;
  alerta visível no centro após rolar, preenchimento/foco preservados ao continuar,
  seis abas de endereço sem overflow horizontal e seleção identificável.
- Validações: ESLint dos arquivos alterados, TypeScript e lint:design (8 bases,
  299 consumidores) passaram. Coordenação final: 82/82 em seis arquivos, incluindo
  alerta, foco, frete, Gestor, usuários e fluxo de caixa. Regressão global: 1.802
  passaram, 324 integrações opt-in ignoradas e cinco falhas anteriores em dois
  arquivos não alterados. `status-listas.test.tsx` procura placeholder antigo já
  divergente do HEAD; `perdas-interface.test.tsx` usa fixtures de setembro fora do
  filtro mensal de outubro. Não afrouxar comportamento do produto para essas fixtures.
- Publicação autorizada pelo usuário, sem migration. Backup privado
  `etiquetas-clientes-abas-descarte-20261002-a`, catálogo/conteúdo íntegros, SHA-256
  `a7795ea9013cdf2734ca568e7d655ae476b7501988b87b78e8b6247696f297c4`.
  Imagem anterior preservada em `grazing-clientes-anterior:20261002-abas-01` e
  configuração fiscal conferida. Compilação Next completa passou; smoke da aplicação
  compilada em loopback, usando os hosts previstos pelo projeto: login 200 e três
  rotas de Clientes/Pedidos protegidas com 307. Host local direto recusado com 421,
  conforme a restrição de hosts de produção. Resultado operacional após o deploy
  será registrado neste bloco.
- Checagem final ampliou a invisibilidade de fechamento para todos os popups comuns,
  cobrindo irmãos em Movimentações/Conciliação. Revalidação: 111 testes focados em oito
  consumidores; uma corrida na montagem do Select foi corrigida aguardando a opção
  acessível, mantendo todas as asserções; reteste desse arquivo 11/11. ESLint,
  lint:design e nova compilação Next/TypeScript passaram. Prévia financeira existente,
  com entrada específica e mocks temporários sem Prisma/fiscal/ações reais: grupo →
  detalhe → confirmação mostrou somente um painel em ambos os fluxos. Nenhuma operação
  financeira confirmada. Clientes publicado também conferido em novo formulário vazio,
  incluindo título, abas, foco e alerta após rolar; nenhum cadastro foi salvo.
- Backup da transição `etiquetas-clientes-abas-descarte-20261002-b`, íntegro, SHA-256
  `e12abffb6383586d950c7c13c7938e71ff7874efc6f31fc4c0eab5fb39490451`;
  imagem anterior `grazing-clientes-anterior:20261002-abas-02`. Configuração fiscal
  preservada e reconferida por leitura, sem atualização manual do serviço.
- Atualização paralela do calendário `9f8895e9` preservada por rebase da correção.
  Versão combinada: 55/55 testes de calendário, Dialog e estoque do Gestor; ESLint,
  lint:design e nova compilação completa Next/TypeScript passaram. Também conferido
  Novo Pedido publicado em formulário vazio: título, cobrança, alerta central após
  rolar, foco inicial e rolagem preservada ao continuar; nenhum pedido foi salvo.
- Backup final privado `etiquetas-clientes-abas-descarte-20261002-c`, íntegro,
  SHA-256 `6a0f7e9fe0e2671e63837c2c4e85c1fe6537ead32184ecb88bb6296983d1c03f`;
  imagem anterior `grazing-clientes-anterior:20261002-abas-03`, task
  `s1xq56nyok9lljea6gr5f4n8x`. Conferência fiscal exclusivamente por leitura.

## Autoridade e retomada

Escopo integral original: `PROMPT_MESTRE_DESIGN_SYSTEM_GRAZING_HUB.txt`.
Na execução inicial, esse anexo local da raiz equivalia a PROMPT_MESTRE.md.
**Nota documental de 23/09:** o anexo não integra a base versionada 2fac409; um checkout
novo não o recebe. Antes de retomar trabalho que dependa do contrato integral, localizar
o anexo autorizado e conferir o hash abaixo; não reconstruí-lo a partir deste resumo.
O arquivo local foi encontrado no checkout principal e seu hash foi reconferido nesta
reestruturação; permanece não rastreado e não foi incorporado ao commit documental.
SHA-256 conferido contra o anexo: `01910A41AAE57A6E4298547C632C7A3E3671283B5209BE97CAC4B72DA93FB6A4`.
Autorização inicial: desenvolvimento e testes isolados, sem produção.
**23/09/2026: usuário autorizou publicação e ações recomendadas**, incluindo a rota
canônica de Etiquetas no mesmo subdomínio. Testes seguem isolados; sem ações comerciais
em produção, afrouxamento de segurança ou migrações destrutivas.
A sequência 0–8 deste escopo substitui a numeração do plano inicial de 21/09.

## Linha de base — 22/09/2026

- Raiz: `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado\Downloads\grazing-hub`.
- Branch: `codex/manifesto-nfs-publicacao`.
- Revisão-base: `1b690dc0d8fea3aaee576d90c93509eadc1eb3ee`.
- Alteração rastreada preexistente: `docs/execucao-vendas.md` (+11 linhas).
- Não rastreados preexistentes: `.tmp-stage4-build.log`, `.worktrees/`, prompt mestre,
  arquivos `docs/catalogo/*ifood-2026-09-22*` e scripts de coleta/preparação/vínculo do catálogo.
  Não apagar, incluir em commit, executar importação ou reverter esses arquivos.
- Tarefa SOL 6 consultada: ociosa; nenhuma outra tarefa ativa no repositório foi identificada.
- Windows/PowerShell; npm/package-lock; Next 16.3.4, React 19.2.8, Prisma 7.10,
  Tailwind 4, Base UI, Vitest 4, Vite 8. Dependências já instaladas.
- Central existente: `/configuracoes/design`, seções `[grupo]` e `laboratorio`.
- Código existente inclui registro de tokens, serviço de versões, publicação e restauração.
  Narrativas de conclusão anteriores não substituem validação nesta execução.
- Vendas possui prévia com componentes reais e aliases de ações sintéticas:
  `testes/visual/vendas.vite.config.mts`, porta proposta 4218.
- Navegador interno disponível, sem abas; ainda não foram capturadas telas nesta execução.

## Documentos canônicos

| Pedido | Arquivo adotado |
| --- | --- |
| Prompt mestre | arquivo integral na raiz, vinculado acima |
| Execução | este arquivo |
| Inventário | `inventario.md` existente (a atualizar) |
| Contratos | `padroes.md` existente (a atualizar) |
| Validação | `VALIDACAO.md` |
| Entrega | `ENTREGA.md` ao entregar |

## Etapas

| Etapa | Estado | Implementado / validado |
| --- | --- | --- |
| 0 Preparação segura | concluída | linha de base executada; banco novo vazio e prévia sintética confirmados |
| 1 Auditoria e contratos | concluída | famílias de 38 rotas inventariadas, 5 capturas examinadas, contratos e exceções registrados |
| 2 Componentes compartilhados | concluída | padrões e registro implementados; testes, ESLint, tokens e tipos passaram; geometria inline conferida |
| 3 Central interativa | concluída | 17 testes passaram; desktop/celular, isolamento, busca, reset, falha e slot conferidos |
| 4 Persistência e versões | concluída | 27 testes passaram, incluindo 7 no PostgreSQL; tipos e lint passaram; sem migration nova |
| 5 Piloto Vendas | concluída | 104 testes Vendas/composição; 8 padrões; fluxo local real, arrasto corrigido, tipos/lint passaram |
| 6 Outras famílias | concluída | 38 rotas protegidas contabilizadas; famílias migradas e testadas; exceções de domínio/entrada delimitadas no inventário |
| 7 Proteções | concluída | detector encontrou desvio real corrigido; 9 testes passaram; comparação exata demonstrada; AGENTS e contratos atualizados |
| 8 Validação integral | técnica aprovada, pendências manuais | regressão integrada 456 passou/19 ignorados, HTTP 7/7, build Node 22/tipos/lint passaram; zoom nativo/movimento reduzido ainda sem prova real |

## Decisões

- Implementação inicial sequencial no checkout atual, sem agentes ou stash. Publicação
  autorizada inclui integração de main, após commit local que preserva a entrega.
- As três colunas solicitadas no prompt atual prevalecem sobre a imagem conceitual antiga;
  reaproveitar o shell e ajustar à largura útil real.
- Não executar integração apenas porque o hostname do banco é localhost: verificar isolamento
  e origem de credenciais antes de qualquer teste de persistência.
- Não recriar recursos de Vendas já implementados; confrontar código e comportamento.

## Publicação autorizada — 23/09/2026

- Implementado: raiz 307 para rota canônica no mesmo subdomínio; links atualizados sem
  mudar cookies, origem ou permissões. 56 testes direcionados passaram.
- Integradas as duas revisões de main; regras recentes de Vendas preservadas e combinadas
  com ações comuns. Regressão 456 passou/19 ignorados; Prisma/tipos/lint passaram.
- Produção: 63 migrations já aplicadas, certificado no banco, backup privado e imagem
  de reversão preservados. Sem migrations novas. Detalhes em VALIDACAO.
- Build Node 22 passou (55 páginas); HTTP 7/7 passou, erro 421 corrigido sem relaxar guardas.
- Próximo: finalizar commit de integração e push fast-forward de HEAD para main,
  acompanhar Dokploy e conferir interfaces sem gravações. Não declarar homologação manual.
- Zoom nativo 200%, preferências assistivas e impressão física continuam pendências
  explícitas de verificação; não serão tratados como aprovados por esta autorização.

## Ponto de retomada anterior (histórico)

Etapas 0–7 implementadas e verificadas conforme evidências. Etapa 8 NÃO concluída:
build final passou, suíte ampla 1.235 aprovações + dois timeouts (ret testes 20/20),
rodada final direcionada 67/67, integrações de Insumos 12/12. HTTP final 5/6: POST na
raiz reescrita de Etiquetas falha 421; na rota canônica passa. Reproduzido nos runtimes
Node 24.19 e 22.23.2, com diagnóstico fetch/Host. Não afrouxar hosts/CSRF para passar.
Próximo exato: decidir entre preservar a URL raiz com solução de encaminhamento segura
ou usar a rota canônica NO MESMO subdomínio. A segunda opção evita o encaminhamento que
falhou, mas muda a URL visível e requer decisão explícita antes de alterar roteamento.
Depois repetir HTTP completo, tipos/lint/build e conferir zoom nativo 200%/movimento
reduzido num navegador que exponha essas preferências. Diagnóstico em VALIDACAO.
Ficha técnica visual conferida (34); entrega/publicação/reversão em ENTREGA. Sem produção/push.
Auditoria inicial em
inventario.md e contratos em padroes.md. Banco de testes exclusivo
em `127.0.0.1:55439/design_system_teste`, usuário `design_teste`, cluster
`node_modules/.cache/design-system-pg`, senha descartável em `.env.design-test-password`
(ignorada pelo Git). PostgreSQL existente não foi alterado. Prévia Vendas: 4218.
Alternativa isolada para a missão de Pedidos: quando 55439 estiver ocupado por
outro ambiente, `DESIGN_DATABASE_URL` pode apontar explicitamente para
`127.0.0.1:55432/design_system_teste`, usuário exclusivo `design_teste`, no
cluster descartável da missão. A suíte verifica banco, usuário e porta, cria
apenas schema aleatório e o remove ao terminar. Não altera o banco público da
prévia, não reutiliza o cluster alheio nem executa a preparação visual novamente.
Migrations existentes aplicadas apenas no cluster descartável; nenhuma produção/publicação.
Aplicação completa utilizada em `http://127.0.0.1:4300`, com AUTH_SECRET exclusivo e
integrações externas desconfiguradas no processo. Preparação reproduzível:
`testes/visual/preparar-banco-design.mts` recusa destino diferente e banco não vazio.
Usuário e dados são fictícios. Não executar novamente sobre o banco já preparado.

Encerramento local: servidores completos 4300/3107 e prévias auxiliares encerrados.
Apenas a Central sintética Vite em 4220 foi deixada para revisão, sem Server Actions
operacionais. Cluster descartável preservado para retomar testes; não contém produção.
Node 22.23.2 usado via cache npm, sem alteração de package.json/lock. Último ESLint dos
testes HTTP, TypeScript e `git diff --check` passaram. Nada commitado/enviado/publicado.

### Incremento do piloto

- Serviço de design revalida perfil ADMINISTRADOR, como getSession; não usa booleano legado.
  Integração inclui divergência proposital entre perfil e campo legado: 29/29 passaram.
- Vendas/composição: 104/104, incluindo gravação de quantidade/porção sem estoque e conflitos.
- Preço: Escape/cancelar, falha preservada, Enter, revisão de outro canal sem perder edição.
- Navegador Next real: login exigido; preço 100→120 confirmado após recarga; status A
  inativo/ativo; filtro Todos preservado após atualização; fiscal direto; ordem persistida
  por controles Subir/Descer. Teclado e arrasto exercitados; perda de captura da alça ao
  mover o DOM encontrada e corrigida capturando no contêiner estável; reteste visual passou.
- Grupo inativado manteve duas opções e dois vínculos; edição preservou expansão existente.
- Capturas 11/12 examinadas. Em 11, texto de expansão longo apertava o botão; abreviação
  visível Ver detalhes/Recolher mantém nome completo no aria-label.
- ESLint do piloto e TypeScript passaram; teste dedicado de ponteiro: 8/8 padrões.
- Ordem da etapa 6 definida por risco: cadastros simples → insumos/preparações → demais
  Vendas → configurações → Etiquetas → processos de estoque/financeiro/compras → entradas.

### Incremento da etapa 0

- Node 24.19.0 / npm 11.17.0. Instalações existentes reutilizadas.
- Vitest inicialmente recusado por spawn EPERM; execução com aprovação de subprocessos
  funcionou sem alterar configurações de segurança.
- Linha de base: 238 testes passaram, 2 falharam, 39 ignorados (integração opt-in).
- Falha Central: fixture não administrador sem mapas de permissões; testar guarda real na etapa 2/4.
- Timeout composição: 8/8 passaram isoladamente, sem ampliar limite de 5 segundos.
- TypeScript e lint:design passaram. Nenhum resultado funcional inferido desses comandos.
- Criado cluster separado com autenticação SCRAM e bind loopback; consulta confirmou banco
  correto, porta 55439 e zero tabelas públicas. Sem uso de credenciais/dados de produção.


## Atalho decimal global — 02/10/2026

Base ec77ee64; continuidade na branch codex/titulos-campos-esquerda.

- [x] Input completa o zero ao digitar/colar ,5 ou .5; valida o valor completo,
  preserva seleção/cursor e precisão. Composição reutiliza o comportamento central.
- [x] Máscaras monetária/percentual usam useFracaoMascarada para o decimal explícito;
  mantêm a digitação habitual em centavos e o sinal separado. Sem arredondar o atalho,
  respeitando somente leitura, tamanho e duas casas. Blur formata sem salvar.
- [x] Rendimento/limites de estoque, quantidades de opções e produtos fracionários do
  pedido usam o decimal textual. Total estimado do pedido entende vírgula.
- [x] Servidor de Insumos interpreta vírgula/ponto completos, incluindo ,5; rejeita
  texto inválido e excesso da precisão existente Decimal(12,3)/(12,4) antes de gravar.
  Não altera schema, transações, permissões, auditoria ou movimentos de estoque.
- [x] Contrato futuro nos padrões e lint:design, com teste da proteção contra
  type=number fracionário. Inteiros/texto/CEP/telefone mantêm seus domínios.
- [x] Prévia isolada decimal-padrao.html: digitação real ,5 produz 0,5 kg, 0,50 reais
  enviados como 0.50 e 0,5%. Captura privada decimal-padrao-previa.jpg. Em revisão visual.
- [x] Verificações iniciais: 44 casos focados e 17 de consumidores aprovados;
  lint global do código mantido (exclui só src/generated), lint:design, typegen e tsc.
- [x] Regressão transversal: npm test -- --maxWorkers=1, 234 arquivos/1995 casos
  aprovados em 613,71 s; 24 arquivos/313 casos de outros opt-ins ignorados.
  PORCOES_BANCO_TESTE e VENDAS_BANCO_TESTE executados em PostgreSQL descartável
  local, incluindo persistência de rendimento/limites ,5 como 0.5 e zero movimentos.
  Aviso existente de pg sobre query simultânea; nenhum timeout ampliado.
  Ajuste final permite iniciar ,5 sobre 0,00 sem apagar a máscara: 79 casos de dez
  consumidores aprovados em 125,82 s. Asserção de não salvar rascunho fortalecida
  depois: caso isolado aprovado (outros 15 filtrados), sem alterar código funcional.
- [x] Lint global (somente src/generated excluído), lint:design e typegen aprovados;
  lint dos consumidores alterados/tsc e build webpack finais aprovados. Compilação
  final 47 s. Avisos existentes middleware/proxy e jose/Edge. Diff conferido.
  O atalho monta decimais por texto; não usa conversão/arredondamento na máscara.
- [x] Backup privado etiquetas-decimal-padrao-20261002-01 verificado com índice e
  leitura integral por pg_restore; imagem anterior congelada. Configuração fiscal
  apenas conferida; não reaplicada.
- [ ] Publicação estável e smoke autenticado, sem gravação de dados reais.

## Campos não editáveis em cinza — 03/10/2026

- Padrão compartilhado em `globals.css` e seis tokens `controle.bloqueado*` na
  Central: HUB, Pedidos e Etiquetas, claro/escuro. Preserva máscaras, valores,
  permissão, foco/cópia e envio de somente leitura; desabilitados continuam
  indisponíveis. Seletores, multisseleção e controles booleanos reutilizam o estado.
- O seletor de visualização mantém suas cores quando disponível e fica cinza
  quando bloqueado. Tokens permanecem nos blocos canônicos dos temas.
- Demonstração da Central usa `readOnly` real para consulta. Referência Em revisão.
- Reconciliação preservou `2c876113` da main (atualização explícita de clientes
  ao salvar orçamento). Prévia do editor confirma e-mail/DDI cinza e nome editável.
- [x] Revisão funcional `d1fc2ae1`: bateria geral, 246 arquivos/2.034 testes
  aprovados, zero falhas; 27 arquivos/382 casos opt-in ignorados.
- [x] Revisão integrada: 98 arquivos/792 testes aprovados, zero falhas;
  9 arquivos/155 casos opt-in ignorados. Vendas, Design, componentes e Etiquetas.
  Horários aguarda a opção assíncrona com `findByRole`, mantendo as asserções e
  limites originais; não altera regras de agenda. Execuções iniciais com falta de
  recursos foram refeitas no Node 22; falhas de organização/prioridade CSS corrigidas.
- [x] Lint global do código versionado (cache privado e Prisma gerado excluídos),
  `lint:design`, tipos e build webpack integrados. Avisos existentes de middleware
  e jose/Edge; nenhuma mudança em schema ou migrations.
- [x] 98 verificações visuais, três marcas/dois temas, desktop/celular, dados
  sintéticos. Smoke do build: login e três bloqueios sem sessão aprovados.
- [x] Backup privado `etiquetas-campos-bloqueados-20261003-final` verificado por
  `pg_restore -l` e SHA-256; imagem anterior e configuração fiscal preservadas.
- O código acinzentado foi integrado em `a3178662`. A atualização concorrente
  `0ff6e438` (portal Grazing Validades) foi preservada. O smoke encontrou erro
  preexistente de hidratação da Central: histórico/auditoria usavam o fuso do
  ambiente. Exibição agora explícita em `America/Sao_Paulo`, sem alterar registros.
  Teste sintético reproduziu a divergência UTC/loja antes da correção.
- [x] Correção da Central: 101 testes aprovados, zero falhas; 7 casos opt-in
  ignorados. Lint global, design, tipos e build webpack aprovados nesta revisão.
  Backup adicional `etiquetas-campos-bloqueados-20261003-hidratacao` verificado;
  imagem corrente congelada e configuração fiscal preservada.
- [ ] Integração na main, estabilidade do serviço, migrations status e smoke HTTPS
  autenticado sem gravações. Autorização de publicação específica desta tarefa.
