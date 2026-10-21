# Validação — Central de Design e Experiência

Esta execução começa em 22/09/2026. Evidências antigas não são resultados deste trabalho.

## Publicação autorizada — 23/09/2026 (em andamento)

- Usuário autorizou publicação e recomendação de rota canônica no mesmo subdomínio.
  Root 307 preserva query/método; links apontam à rota canônica. Guardas não afrouxadas.
- Roteamento/interface: 56/56 testes passaram antes da integração remota.
- Integradas revisões remotas `f8de6c9` e `8cb5308`. Conflitos em três componentes
  resolvidos combinando ordenação/ficha, canal derivado do preço e impressão (sem Simular)
  com status, ações compartilhadas, cancelamento e conflito de versão da Central.
- Regressão integrada: 58 arquivos passaram, quatro opt-in ignorados; 456 testes passaram,
  19 ignorados, 152,53s. Inclui Vendas, Insumos, design, Etiquetas, layout e permissões;
  integrações DESIGN/VENDAS/ACESSOS/ETIQUETAS habilitadas no banco descartável.
- Prisma validate/generate 7.10, TypeScript e ESLint dos arquivos da entrega passaram.
  lint:design passou com oito bases e 212 consumidores. Primeiro migrate deploy local
  recusou banco sem histórico (P3005); banco sintético foi criado aplicando SQL manual.
  Aplicada nele exclusivamente a nova migration já presente em main; nenhum baseline
  fabricado, nenhum reset. Produção não foi usada nos testes.
- Prévia sintética integrada de Vendas examinada: desconto, cancelamento Escape, edição
  direta, composição ordenável e embalagem fora da ficha preservando custo de R$ 10,25.
- Diagnóstico de produção somente leitura: 63 migrations, todas aplicadas, incluindo
  composição/ficha. Certificado existe no banco; fallback SEFAZ via env/mount já ausente.
- Backup privado no servidor: `/var/backups/grazing-hub/antes-design-20260923T114532Z.dump`,
  11.560.671 bytes; pg_restore --list passou (não é ensaio de restauração integral).
  Imagem anterior preservada com tag `app-copy-auxiliary-microchip-9hhwdm:antes-design-20260923`;
  SHA `09683df8bb7370035e161d6967d9a2b97254b85291ad91e149d4fee014e353e9`.
- Build final Node 22.23.2 passou, 55 páginas, TypeScript incluído; aviso legado de
  middleware depreciado permanece. Smoke HTTP contra esse build passou **7/7** (2,19s
  de testes; 8,94s total): login dos dois hosts, assets, host/origem/módulo bloqueados,
  filtros na raiz e ação real recusando usuário inexistente na rota canônica, inclusive
  após seguir POST 307 da raiz. Não aceita 421 como sucesso nem cria registro.
- Sem diff de schema/migrations, dependências, hosts, session-token, Next config ou Docker
  contra main. Zoom nativo, movimento reduzido real e hardware seguem pendentes.
- Pronto para push/deploy autorizado; resultado de produção será registrado após conferência.

## Proteções permanentes — etapa 7

- AST TypeScript detecta ação compacta duplicada, override de geometria/cor e HEX em
  botões. Lint percorreu oito bases e 211 consumidores TSX; passou após correção.
- O detector encontrou uma omissão real: categorias de Insumos usavam lixeira avulsa
  e autosave no blur. Migradas para EdicaoInline/GrupoAcoes, confirmação de exclusão e
  permissões visuais, mantendo ações servidoras. Nenhum outro onBlur restou nos módulos
  protegidos. Três testes novos de confirmação/falha/permissão passaram.
- Nove testes do incremento passaram: cinco detector, um comparação, três categorias.
- Comparação RGBA de capturas estáveis 28/29: zero pixels diferentes; captura 27 aberta
  contra 28 fechada: 50.121 pixels diferentes, saída 1 esperada. Imagens examinadas,
  popup/foco explicam a diferença. Não são referências aprovadas pelo usuário.
- AGENTS.md aponta aos contratos sem remover regras anteriores. Limites do detector e
  protocolo de comparação registrados em padroes.md e evidencias/README.md.

## Compras, Notas e entradas — etapa 6

- Cabeçalhos comuns, seleção do modo de compras com aria-pressed, checkbox compartilhado,
  remoção compacta de item/parcela e cadastros rápidos com Button. Estados de recebimento,
  manifesto, cálculos, descontos, conversões e datas continuam no domínio existente.
- Primeira rodada Compras/Notas: 169 passaram, 31 opt-in ignorados; um arquivo falhou
  ao importar Server Actions pelo cadastro aninhado. Corrigido o mock da fronteira de
  Fornecedores, sem mudar guardas. Reteste dirigido: 11/11 passaram.
- Integração isolada: 21 passaram; dez ficaram sem executar porque a fixture antiga
  copiava tabelas públicas e omitia o enum TipoCadastroFornecedor. Passou a criar schema
  completo pelas migrations existentes; reteste 10/10 passou. Nenhuma migration alterada.
- Layout/entradas/Compras após último incremento: 28/28 passaram. Inclui nove testes
  novos de placeholders, acesso negado, entrada Produção e redirects protegidos.
- Captura 26 examinada em 768: formulário de compra e ações; captura 27 em 1280: seletor
  de pagamento dentro da nota, Escape fecha apenas a lista e mantém o diálogo.
  Valores sintéticos. Nenhum aceite/recusa enviado à SEFAZ nem recebimento operacional.
- ESLint dos arquivos alterados deste incremento e TypeScript passaram (23/09).
- Produção antes retornava conteúdo vazio: agora oferece título e link ao módulo único
  de Etiquetas sob a mesma guarda. RH/CRM/Patrimônio mantêm aviso de construção; não
  foram fabricados cadastros. Acesso negado reutiliza variantes comuns em links.

## Financeiro — etapa 6

- Cabeçalhos e ações compactas compartilhados em DRE, fluxo, movimentações, plano,
  contas/cartões e NFS-e. Permissões visuais de cadastros preservam guardas servidoras.
  Cores contábeis e processos não convertidos em status binário.
- Contas/cartões preservam o formulário no erro; diálogo de descarte continua ativo.
  Hierarquia do plano mantém expansão independente, status confirmado e ações agrupadas.
- Suíte Financeiro/NFS-e: 281 passaram, 30 integrações opt-in ignoradas nessa rodada.
  Rodadas isoladas seguintes: conciliação PG 24/24; plano/importação/pessoal 7/7 (seis
  integrações antes ignoradas + um teste unitário); novos formulários bancários 3/3.
- Capturas 24 (erro simulado no cartão, 1440) e 25 (hierarquia, 390) examinadas.
  Nenhuma transação bancária externa, SEFAZ ou dado real. ESLint do incremento passou.
- `/financeiro/contas` e `/financeiro/lancamentos` preservam guardas e redirecionamento
  para Movimentações, sem criar versões visuais duplicadas.

## Inventário — etapa 6

- `vitest run testes/inventario --maxWorkers=1`: 76 passaram; as 44 integrações estavam
  opt-in. Rodadas separadamente com CONTAGEM/ENTRADA_AVULSA/PERDAS_BANCO_TESTE=1 no banco
  exclusivo: 44/44 passaram, schemas aleatórios removidos pelo teardown.
- Conversões + lista de contagens: 21/21 no primeiro reteste. Testes adicionais de
  Enter/Escape, locais e status estão incluídos nos 76 acima. Não salva mais no blur;
  mantida finalização explícita de toda fotografia e recuperação do rascunho.
- ESLint dos consumidores/testes alterados e TypeScript passaram antes da última mudança
  apenas de wrapping do diálogo de locais; repetir no fechamento global.
- Captura 22 (1440) contagem após confirmar 1,125; captura 23 (390) confirmação de local.
  Inspeção encontrou campo comprimido no celular: ações foram para linha própria; reteste
  visual corrigido. Nenhuma exclusão foi executada no navegador.
- Posição/extrato/entrada/perdas/contagens cobertos pelos testes da família. Folha A4,
  quantidades, estornos, concorrência e autorias preservados. Não houve operação real.
- Uma tentativa de suíte com paralelismo padrão terminou sem relatório (exit 1); nova
  execução sequencial passou. Nenhum teste foi desligado para acomodar recursos locais.

### Resultados de Etiquetas

- `ETIQUETAS_BANCO_TESTE=1 vitest run testes/etiquetas --reporter=verbose`: 102 passaram;
  cinco testes HTTP opt-in aguardam o build local. Seis integrações PostgreSQL executadas
  em schema aleatório do banco exclusivo, removido pelo próprio teste ao terminar.
- Abas por teclado/painel, filtros rotulados, guia de emissão, preview, ZPL 203/300/600 dpi,
  idempotência, catálogo único, responsáveis, autorização e Raspberry simulados passaram.
- ESLint dos quatro consumidores alterados e teste de interface: passou.
- Navegador Vite isolado 4199: Raspberry expandiu; salvar retornou erro simulado e manteve
  nome digitado. Captura 21 (1440×1000, página rolada) examinada. Nenhum hardware utilizado.
- TypeScript encontrou cinco opções `exact` inválidas em testes do incremento anterior;
  removidas (nomes string já são exatos no Testing Library). Reteste final pendente.

## Reteste Insumos/Preparações — etapa 6

- Conjunto Insumos/cadastros: 63 passaram, 1 timeout, 12 integrações opt-in ignoradas.
- Timeout em compras-conversoes-interface reproduzido isoladamente; preenchimento
  do nome sintético passou a usar colagem (mesmas asserções e 5 segundos).
- Reteste desse arquivo: 2/2 passaram, 12,59 s total. Teste de dez passos também
  usa colagem dos textos; limites, ordenação e serialização continuam verificados.
- ESLint dos cinco componentes Insumos e dos dois testes: passou.
- Navegador/banco exclusivo: preparação salva com 0,2 kg e 2 fatias, custo R$ 4,00;
  captura 14 examinada. Não houve baixa de estoque nem impressão física.

## Preparação

### Incremento Configurações da etapa 6

- Usuários: status na lista com confirmação; ação usa a transação e as guardas existentes,
  alcance de privilégios, revisão, proteção do último administrador e auditoria. Inativar
  revoga sessões sem alterar perfil, senha ou exceções. Abas usam Tabs compartilhado;
  edição compacta usa lápis; Fechar passa pela proteção de alterações do Dialog.
- Empresa/Perfil: rótulos associados aos campos, cabeçalho compartilhado, erro inline e
  preservação do preenchimento em falha de rede. Não houve alteração de credenciais.
- Integração acesso + interfaces existentes: 18 passaram; três novos testes de interface
  falharam por clicar antes do fim da transição e por faltar Enter na ativação da aba.
  Reteste com espera por controle disponível/ativação explícita: 3/3 passaram (17,24 s).
  Perfil/empresa, depois da extensão: 2/2 (6,64 s). ESLint da família passou.
- Contrato de fronteiras estava sem seis ações antigas de Vendas e a nova ação de status.
  Inventário completado; dois prelúdios puros antes da guarda são comparados literalmente
  (não permite nova operação antes da autorização). 104/104 fronteiras passaram (5,34 s).
- Navegador Next: último administrador recusado, continuou ativo; Escape em edição
  apresenta Sair sem salvar. Edição sintética descartada explicitamente, não gravada.
  Capturas 18–20 examinadas (1440): erro acessível, Empresa e Perfil. Certificado somente
  apresentado sem arquivo/segredo; upload/consulta SEFAZ não exercitados.

### Incremento comercial da etapa 6

- Vendas completo: 101 passaram, 1 falhou por fixture `CREDITO` não aceita pelo CHECK do
  banco; houve também exceção no teste antigo de arrasto (mock de captura na alça, agora
  captura no contêiner). Corrigidas as fixtures para CARTAO_CREDITO e captura no contêiner.
- Reteste integração/arrasto/status/autorização: 41/41, 25,08 s, sem erro não tratado.
- Exclusão: confirmação mantida, trava síncrona e erro de transporte junto à ação;
  reteste status/exclusão 5/5, 9,95 s. ESLint comercial e TypeScript passaram.
- Banco exclusivo e navegador: PIX FICTÍCIO ficou inativo após recarga; consulta de
  inativos recupera o registro, mantendo taxa/prazo. Capturas 15–17 examinadas.
- Captura 15 foi renomeada para 1280 conforme dimensão real; 16/17 são 1440×1000.
- Edição de cliente/fiscal abriu com foco no primeiro campo; fechamento sem alteração
  preservou listagem. Não houve teste de emissão fiscal nem operação financeira.

- Git: branch e revisão registrados em EXECUCAO.md; mudanças preexistentes preservadas.
- Prompt da raiz e anexo têm SHA-256 idêntico; escopo integral lido.
- `vitest.config.ts` não existe: configuração efetiva é `vitest.config.mts`.
- `prisma.config.ts` não existe. Não executar comandos de migração por presunção.
- Testes Vendas usam opt-in `VENDAS_BANCO_TESTE=1`, conexão do ambiente e schema temporário.
  Isso ainda não comprova que o destino/configuração disponível é seguro para esta execução.
- Prévia Vendas usa aliases locais para substituir ações; revisão de dependências pendente.

## Comandos e resultados

| Comando | Resultado na linha de base |
| --- | --- |
| `npm test -- testes/design-system testes/layout testes/vendas testes/cadastros testes/insumos testes/etiquetas` | 238 passaram, 2 falharam, 39 ignorados; 39 arquivos passaram, 2 falharam, 6 ignorados |
| `npx --no-install vitest run testes/insumos/composicao-interface.test.tsx --maxWorkers=1` | 8/8 passaram, 8,56 s; não se repetiu timeout sob execução isolada |
| `npx --no-install tsc --noEmit --incremental false` | código de saída 0 |
| `npm run lint:design` | passou; escopo atual de 8 componentes-base |

Testes unitários executados com DATABASE_URL de porta inválida loopback e flags de integração
removidas do ambiente do processo. Nenhuma conexão com banco operacional.

Falha confirmada da Central: `publicacao-actions.test.ts` simula sessão não admin sem
`permissoes`/`excecoes`, enquanto a action passou a chamar `exigirPermissao`; TypeError antes
da asserção antiga de retorno `{erro}`. Ainda não corrigida; não relaxar guarda para passar.

Banco novo criado com binários PostgreSQL 17 já instalados. `initdb --auth=scram-sha-256`,
`pg_ctl ... -o '-h 127.0.0.1 -p 55439'`, `createdb ... design_system_teste` e consulta somente
nesse destino confirmaram banco/porta e zero tabelas públicas. Credencial própria descartável,
sem reutilização de `.env` operacional. Nenhuma migration do aplicativo aplicada até aqui.

## Limites

Sem homologação de impressora e sem validação de produção.

## Etapas 1 e 2

- Capturas 01–05 produzidas e examinadas em `evidencias/2026-09-22` (dados sintéticos).
- Componentes: novo teste `padroes.test.tsx` cobre pesquisa, ids, ações internas, expansão,
  inline/precisão/Escape/Enter/blur, falha, duplicação, leitura e ordenação por alternativas.
- Sessão de não administrador corrigida no teste existente; agora verifica o redirect
  real do guard e nenhuma chamada ao serviço. Nenhuma autorização foi relaxada.
- Primeira rodada: 87 passaram, 2 timeouts em Vendas, 16 ignorados. Quatro prévias Vite
  abertas consumiam recursos; foram encerradas. Repetição `--maxWorkers=1`: 30/30 passaram
  (Vendas interface + design-system + status), 32,21 s. Limites de tempo preservados.
- ESLint dos arquivos alterados: saída 0. `lint:design`: passou após remover literal de
  raio que a regra existente detectou; círculo fica no contrato compartilhado de ação.
- Browser: inline vazio e preenchido manteve 44px de altura e 1168px de largura na prévia
  ampla; Escape recuperou 149.90. Captura 06 examinada; não substitui a matriz final.
- TypeScript encontrou falta de placeholder obrigatório na demonstração; corrigida.

## Etapa 3

- Central recomposta em categorias / demonstração / propriedades, reaproveitando a gestão
  existente de versões. Registro único com 20 padrões, todos Em revisão (sem fingir aprovação).
- 17 testes de design-system passaram, inclusive busca, contrato de mensagem e prévia sem
  actions. ESLint e TypeScript passaram; avisos de imports não usados foram corrigidos.
- Browser: erro sintético manteve status ativo e mostrou mensagem; sucesso confirmou inativo;
  reiniciar recuperou o exemplo. Abrir edição de um slot não expandiu; expansão independente
  mostrou porções. Janela permaneceu no iframe.
- Token de ação 2.75rem resultou em 44px na prévia; documento da Central continuou com
  2.25rem e tema light enquanto iframe usava Etiquetas escuro.
- Corrigida corrida entre onLoad e inicialização React: laboratório anuncia pronto antes
  da configuração; agora busca por abrir box mostra o slot correto mesmo após recarregar.
- Viewport do navegador aplica-se à aba selecionada. Medidas efetivas verificadas: 1440px
  (documento 1425px, colunas 176 / 624,8 / 256px) e 390px (documento 375px, coluna única).
  Os nomes das capturas iniciais 02/04/05 com sufixo 1440 não comprovam essa largura:
  foram feitas em abas não selecionadas, com viewport padrão 1280. Não contar como matriz 1440.
- Capturas 07 e 10 examinadas; capturas full-page apresentam emendas de scroll do navegador.
  Usar também DOM e medidas reais, não aprovar comparação pixel a pixel desses arquivos.

## Etapa 4

- `DESIGN_BANCO_TESTE=1 ... vitest run testes/design-system --maxWorkers=1`: 27/27 testes,
  6 arquivos, 19,64 s. Destino verificado 127.0.0.1:55439/design_system_teste e schema
  aleatório próprio; migrations existentes aplicadas somente nele. Schema removido no fim.
- Sete integrações reais: rascunho não altera publicado; herança entre publicações;
  restauração cria nova versão e auditoria; concorrência tem um vencedor; idempotência
  não duplica nem aceita payload diferente; permissão administrativa revalidada na transação;
  base antiga recusada e revisão explícita; entradas/contraste/combinações rejeitadas;
  schema futuro cai em fábrica e não restaura. (Alguns testes exercitam vários desses casos.)
- Interface de publicação agora mostra antes/depois e escopo, preserva chave em repetição
  incerta, informa rascunho com base antiga e mantém seu conteúdo após restauração.
- Consumidor: teste confirmou consulta no-store ao foco, aviso de atualização sem descartar
  formulário e tolerância a falha de rede. API exige sessão e responde no-store.
- ESLint e TypeScript: saída 0. Nenhuma migration nova; schema de conteúdo das novas
  versões é 2, leitor aceita 1 e 2; incompatível usa fábrica no layout.

## Etapa 5 e correção complementar da 4

- Design + cancelamento: 29/29, 23,01 s. Guarda administrativa alinhada ao perfil da sessão;
  fixtures provam que o booleano legado não concede nem remove autoridade.
- Vendas + composição: 104/104, 71,12 s, 18 arquivos; PostgreSQL exclusivo e schemas temporários.
  Aviso pg sobre consultas concorrentes existe nos testes; não houve falha.
- Padrões depois da correção de arrasto: 8/8, 14,18 s. Captura agora pertence ao contêiner
  estável, não à alça movida; arrasto real retestado e terminou com aria-pressed=false.
- Aplicação Next local 4300, não Vite: login fictício; preço persistiu 120,00 após reload;
  ativação e inativação confirmadas; filtro Todos manteve seleção; ordem B/A persistiu;
  fiscal abriu campos e grupo diretamente. Grupo inativo manteve opções/vínculos e expansão.
- ESLint do piloto e TypeScript saíram 0. Import do script de preparo foi corrigido após
  TS5097; não foi ignorado. Next informou depreciação middleware→proxy preexistente; não
  executar codemod de autenticação como parte da migração visual.
- Capturas 11/12 examinadas. Não são aprovação humana de referências pixel a pixel.

## Etapa 6 — incrementos

- Fornecedores/Beneficiários: 14/14 testes, 20,52 s; ESLint passou. Barra comum, exclusão
  circular e consulta sem alteração indevida. Captura 13 examinada; formulário e abas testados.
- Insumos/Preparações: ações/status e cabeçalho compartilhados; remoção de ingrediente usa
  Button excluir, sem mudar quantidades/custos. Corrigido div dentro de p no resumo expandido
  após aviso real de hidratação. Captura 14 examinada; formulário salvou 0,2 kg / 2 fatias,
  custo da composição e unitário R$ 4,00 confirmados no resumo após resposta do servidor.
- Primeira suíte com Next compilando: 59 passaram, 5 timeouts (5000ms), 12 integrações opt-in
  ignoradas. Next/Vites encerrados para repetir sem elevar limites. Resultado do reteste
  registrado a seguir; não interpretar a primeira rodada como verde.

### Fechamento dos incrementos da etapa 6

- Insumos: 63 passaram no conjunto; um timeout residual passou no reteste (2/2), com
  colagem do nome fictício no lugar de digitação letra a letra; sem retirar asserções.
  Conversões, especificações e marcas: 12/12 integrações no PostgreSQL exclusivo.
- Demais Vendas: 41 testes direcionados e cinco de status/exclusão; capturas 15–17.
- Configurações: guardas e 104 fronteiras, bloqueio do último administrador, erros que
  preservam formulário; capturas 18–20. Nenhum certificado nem e-mail real utilizado.
- Etiquetas: 102 testes incluindo seis integrações; cinco HTTP separados para o build.
  Captura 21: erro sintético de configuração preserva formulário/Raspberry. Não há hardware.
- Inventário: 76 testes de interface/domínio e 44 integrações. Capturas 22/23: quantidade
  explícita 1.125 e locais a 390px. Ações passam à linha seguinte sem espremer o campo.
- Financeiro: 281 testes gerais; três novos de formulário, 24 integrações de conciliação
  e sete testes de plano de contas. Captura 24 mantém dados após falha simulada; 25 mostra
  hierarquia expandida a 390px. Não houve transação financeira real.
- Compras/Notas: primeira rodada 169 passaram e 31 opt-in ignorados; uma suíte de UI
  importava server-only pelo dialog aninhado de fornecedor. Mock restrito à fronteira de
  actions corrigiu a fixture; reteste direcionado 11/11. Integrações: 21 passaram, dez
  bloqueadas por enum ausente na fixture que copiava tabelas. Fixture passou a aplicar
  migrations existentes em schema UUID exclusivo; os dez testes passaram. Nada em produção.
- Entradas: nove testes de guardas, títulos, links e redirects. RH/CRM/Patrimônio continuam
  indisponíveis (EX-ENT-01), sem inventar CRUD. Produção aponta ao módulo existente.
- Capturas 26 (768px) e 27/28 (1280px): diálogo de compra/nota, lista de pagamento aberta,
  Escape fecha somente a lista e retorna foco ao gatilho. ESLint e tipos dos incrementos passaram.

## Etapa 7

- Detector AST estende lint:design a consumidores, aliases lucide, ações compactas e cor
  arbitrária. Encontrou lixeira avulsa e edição onBlur em Categorias de Insumos: corrigidas
  com confirmação explícita, erro preservado e permissões. Não foi criada exceção para passar.
- Nove testes novos passaram: cinco do detector, três de categorias e um do comparador.
- `npm run lint:design`: oito bases e 211 consumidores TSX passaram. Limitações de aliases
  dinâmicos/wrappers documentadas; não é garantia universal de ausência de estilos locais.
- Comparador de capturas provado com igualdade e diferença esperada; procedimento no
  README de evidências. Nenhuma imagem foi declarada aprovada pelo usuário.

## Etapa 8 — resultados até 23/09/2026

- Prisma validate e generate com `--config prisma7.config.ts`: saída 0, cliente 7.10.0.
  Schema/migrations sem mudanças desta tarefa. Banco exclusivo `127.0.0.1:55439`.
- Suíte integral opt-in: 169 arquivos, 1.235 testes passaram, dois falharam por timeout
  de 5000ms, cinco HTTP ignorados por dependerem do servidor do build; 593,59s.
  Falhas: custos/descontos do aceite e justificativa da recusa em `notas-fiscais/dialog`.
  Ambos passaram no reteste isolado (20/20 incluindo Central, 14,55s). Nenhuma alteração
  nesses dois testes, asserções ou timeout. Não relatar a primeira execução como verde.
- ESLint de todos os TS/TSX/MJS alterados/criados da tarefa, lint:design e TypeScript:
  saída 0 após os ajustes finais de cabeçalho, checkbox, busca e rótulo de seleção.
- Primeiro build de produção LOCAL: saída 0, 55 páginas geradas. Avisos de middleware
  depreciado e dependências Next/jose usando APIs Node no Edge preservados e registrados.
- Captura 30: 320px, documento 305px, sem overflow global. 31: Etiquetas escuro/conteúdo
  longo isolado dentro do HUB claro. 32: 768px, documento 753px, pesquisa/seleção de Queijos,
  Escape preservou seleção e foco. A opção do seletor aparecia como código `producao`:
  cadastro de rótulos corrigido e conferido como Produção em 33 (1440px/documento1425px).
- Captura 33 também mostra comparação, versão e pendências no cabeçalho final.
- Zoom nativo: Ctrl+plus e Ctrl+equal não alteraram innerWidth=1280 nem DPR≈1 no navegador
  interno. Logo **200% não validado**; 320px não é prova de zoom. Emulação de preferência
  reduced-motion não está exposta nesta ferramenta: regra CSS foi inspecionada, mas falta
  conferir com preferência real do sistema. Não declarar certificação de acessibilidade.

### Fechamento local e impedimento real

- Rodada direcionada final (design + dialog de notas + compras + etiquetas): 67 passaram,
  sete integrações de design opt-in não habilitadas nessa repetição (já passaram na ampla).
  Build final após ajustes de busca/rótulo: saída 0, 55 páginas; servidor iniciou em loopback.
- Captura 34: ficha real do produto sintético, 1440px; composição fixa 0,1 KG de queijo,
  categoria, 12 minutos e alternativas separadas. Prévia examinada; não acionada impressão.
- HTTP inicial Node 24.19: quatro passaram, raiz POST retornou 421 em vez de ação/redireção.
  Runtime Node 22.23.2 obtido exclusivamente no cache npm, sem mudar package/lock; reproduziu
  a mesma falha. Não concluir que Node 22 por si só resolve o problema.
- Em Node 22 também houve timeout na comparação profunda de PNG (1.275.430 bytes).
  Substituição por Buffer.equals preserva igualdade byte a byte, sem aumentar timeout:
  esse caso passou; a rodada de cinco testes caiu de 7,31s para 0,316s, mantendo o 421.
- Teste adicional usa a mesma action/token inexistente na rota canônica. Resultado final:
  **cinco passaram, um falhou, seis no total**, 1,77s. POST `/producao/etiquetas` retorna a
  recusa de sessão esperada; POST `/` continua falhando antes, no encaminhamento.
- Diagnóstico loopback nos dois runtimes: fetch para servidor local com Host público e
  X-Forwarded-Host público chegou com Host `127.0.0.1:porta` e forwarded público. A guarda
  existente rejeita essa divergência. Next action-handler encaminha entre workers usando
  fetch para initURL. Evidência compatível com a falha; não é teste do proxy/produção.
- `git diff --exit-code` confirmou middleware, hosts, session-token, página raiz,
  next.config e Dockerfile intactos nesta tarefa. O teste não foi removido/ignorado nem
  passou a aceitar 421 como sucesso. Não alegar uma regressão em produção sem testá-la.
- **Etapa 8 bloqueada.** Opção a avaliar: entrada canônica no mesmo subdomínio evita esse
  salto entre workers, preserva guards/banco/backend, mas muda a URL visível. Preservar `/`
  exigiria outra solução de encaminhamento validada. Nenhuma dessas alterações foi feita;
  nunca liberar Host arbitrário, confiar cegamente em forwarded, ou desabilitar CSRF.
- Último ESLint do teste HTTP, TypeScript e diff --check passaram após a extensão do
  cenário canônico. Nenhuma alteração de código de execução após o build final.
