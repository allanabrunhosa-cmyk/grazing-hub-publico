# Evolução multimódulo — execução e cobertura

## Estado conferido antes da implementação

Worktree: `.worktrees/mcp-financeiro-20261007`, branch
`codex/mcp-multimodulo-20261007`, base `5329866c29fa7c372482884c688cf6f55a5dece7`.
`origin/main`: `a49f33a66b3ad2757df1b02a58bed3e36177e98d`; base sem divergência
funcional, dois commits documentais à frente. Árvore desta frente limpa.
Checkout principal `codex/cardapio` e seus documentos pendentes pertencem a outras
frentes e não são parte desta entrega. Estado de produção citado em TASKS é
evidência da entrega anterior, ainda não reconfirmada nesta evolução.

## Decisões aprovadas

Um servidor e o mesmo endpoint `/api/mcp`; identidade OAuth individual e permissões
centrais atuais, incluindo exceções. Perfis MCP saem do fluxo ativo, referências
históricas permanecem. Escopos financeiros v1 conservam exatamente sua semântica.
Novos módulos/escritas exigem consentimento expresso; administrar MCP não autoriza
negócio. Nenhuma alteração de perfil de funcionário é permitida para testes.

Consultas e ações devem reutilizar serviços/validações das interfaces. Escritas
sensíveis precisam de proposta, revisão humana autenticada no HUB, vínculo ao
conteúdo/identidade/versão/prazo e execução única. A IA não aprova propostas.
Idempotência deve compartilhar a transação do efeito local; resultado externo
incerto não equivale a sucesso. Testes exclusivamente com fixtures isoladas.

Rejeitados: dispatcher público arbitrário, SQL livre, perfil MCP paralelo,
cookie fabricado, concessão pelo proprietário do cliente, permissões congeladas
no token, `confirmado: true`, habilitação retroativa de estoque e alterações de
integrações/infraestrutura como consequência desta entrega.

## Matriz anterior à implementação

**A**: serviço pronto; **B**: exige adaptação/autorização central; **C**: ausente
no HUB; **D**: excluído pelo pedido. Todos os itens A/B abaixo são **planejados**;
esta matriz não comprova implementação, testes, integração ou publicação.
Os caminhos `app/.../actions.ts` referem-se a `src/app/(protegido)`.

| Módulo / ação | Classe | Serviço existente | Permissão central atual | L/E | Efeitos | Confirmação | Testes a executar |
|---|---|---|---|---|---|---|---|
| Conexão: identidade/capacidades próprias | B | mcp/servidor; session; permissoes/catalogo | identidade OAuth + central vigente | L | nenhum | não | token/identidade/escopos |
| Financeiro: DRE, caixa, saldos, lançamentos, contas, plano | A | mcp/financeiro; financeiro/fontes-relatorios, calcularDre, fluxoCaixa, saldos-iniciais | recursos de catalogo MCP v1 | L | nenhum financeiro | não | igualdade fontes, restrições, transporte |
| Financeiro: criar/editar/classificar/vencimento/excluir lançamento | B | app/financeiro/lancamentos/actions; financeiro/exclusaoLancamento | financeiro.movimentacoes adicionar/editar/excluir | E | títulos e eventual reversão de compra | exclusão/lote | financeiro, compras, fiscal |
| Financeiro: baixar/estornar | B | financeiro/baixarLancamento; app/financeiro/contas/actions | financeiro.baixas editar; separar estorno centralmente | E | movimentação bancária interna | sim | baixas, concorrência, aprovação |
| Financeiro: importar/conciliar/desfazer extrato | B | financeiro/conciliacao/servico | financeiro.conciliacao adicionar/editar/excluir | E | extrato/vínculos/baixas | conciliar/desfazer/lote | conciliacao + banco |
| Financeiro: faturas/classificar/vincular/ajustar/compensar/pagar/reverter/cancelar | B | financeiro/faturas/servico e consultas | faturas; cartoes-pagamentos; cartoes-regras | L/E | despesas, pagamentos e compensações internas | efeitos financeiros/lote | faturas + banco |
| Financeiro: contas/cartões/plano/regras de classificação | B | app/financeiro/bancario, plano-de-contas; faturas/regras | bancario/plano/cartoes-regras por ação | L/E | cadastros, classificação e saldo inicial | exclusão/saldo/lote | bancario/plano/faturas |
| Clientes: localizar/detalhar/cadastrar/editar/inativar/histórico | A | vendas/persistencia; clientes-consulta; status-cadastro | vendas.clientes visualizar/adicionar/editar; pedidos para histórico | L/E | cadastro/versionamento/auditoria | cadastro simples não | vendas/clientes |
| Fornecedores/beneficiários: localizar/cadastrar/editar/inativar/excluir | B | app/fornecedores/actions; status-cadastros-actions | fornecedores por ação | L/E | cadastro e vínculos | excluir | cadastros |
| Insumos/preparações: consulta/ficha/cadastro/conversões/composição/inativar/excluir | B | app/insumos/actions; insumos/ficha-tecnica, exclusao-servidor | insumos por ação; custo exige autorização central específica | L/E | composição/conversões; exclusão lógica conserva histórico | excluir/lote | insumos + estoque |
| Porções: consulta/cadastro/ordenação/remoção | A | insumos/porcoes; app/porcoes/actions | suprimentos.porcoes por ação | L/E | medidas versionadas | remover/lote | porcoes |
| Produtos/categorias/complementos: consultar/cadastrar/editar/disponibilidade/preço/composição/ordenação | A | vendas/persistencia, dominio, complementos, ordem | vendas.produtos/catalogo por ação; custos separados | L/E | cadastro/versionamento/snapshots futuros | lote/exclusão | vendas |
| Cadastro fiscal de produtos (sem emissão) | A | vendas/fiscal; app/vendas/actions | vendas.fiscal visualizar/editar | L/E | cadastro e revisão fiscal | lote | vendas/fiscal |
| Vendas: formas de pagamento/canais/horários/regras comerciais/entregas/simulação | B | vendas/formas-pagamento, horarios, entregas; actions correspondentes | recursos centrais correspondentes | L/E | cadastros comerciais, nenhuma ativação externa | lote | vendas/entregas |
| Pedidos: lista/detalhe/histórico/agenda/prontidão/produção | A | vendas/pedidos, pedidos-agenda, pedidos-gestao, pedidos-prontidao | pedidos/producao/financeiro/inventario conforme campos | L | nenhum | não | pedidos + restrição de campos |
| Pedidos: criar/salvar rascunho/confirmar/revisar/reagendar/cancelar/entregar | A | vendas/pedidos, pedidos-agenda | pedidos adicionar; confirmar/revisar/cancelar editar | E | snapshots, revisões, financeiro e flag estoque vigente | cancelar/impactos financeiros | pedidos-integracao |
| Pedidos: recebimentos/cartão/boleto/repasse/correções/devoluções/crédito/custos entrega | B | vendas/pedidos, entregas-custos | financeiro.baixas/movimentacoes; pedidos.logistica/revisar | E | registros internos; não executa banco real | sim | pedidos financeiro/reversões |
| Pedidos: etapas físicas/materiais/destinação/ocorrências | A | vendas/pedidos-fisico, pedidos-destino, pedidos-operacao-dominio | pedidos.producao + inventario conforme operação | E | reservas/saída/retorno/perda se flag permite | ajustes/perda/cancelamento | pedidos OFF/ON isolado |
| Compras: consultar/criar/editar/reagendar/receber/reabrir/cancelar/excluir | B | app/compras/actions; reagendar-pedido | compras por ação; compras.receber editar | L/E | chegada não cria estoque/financeiro | cancelar/excluir/reabrir | compras-banco |
| Estoque: posição/extrato/reservas/inventários/perdas | A | estoque/posicao, extrato, consultar-perdas; inventario actions | inventario/contagem/perdas visualizar | L | nenhum; contagem cega oculta saldo | não | estoque/perdas/contagem |
| Estoque: entrada simples/completa/contagem/finalizar/cancelar/perda/reversão/produção manual/locais | B | estoque/registrarMovimentacao, cancelar-contagem; inventario actions | entrada adicionar; contagem/perdas/inventario por ação | E | saldo/custo; completa também obrigação financeira | efeitos de estoque/reversões | estoque + financeiro + reservas |
| Validades: consultar/criar trabalho/imprimir/reimprimir/encerrar/cancelar | B | etiquetas/gestao-validades; app/producao/etiquetas/actions | producao visualizar/adicionar; granularidade central para imprimir/cancelar | L/E | trabalho/snapshot; impressão tem efeito externo | impressão/reimpressão/cancelar | etiquetas + conector simulado |
| Pontos de impressão: consultar estado operacional | B | etiquetas/pontos-impressao | producao visualizar | L | nenhum | não | pontos/etiquetas |
| Importações assistidas de cadastros/faturas/extratos | B | importadores atuais de cada domínio | adicionar/editar específicos | E | lote de registros; limite de volume | sim | importação + atomicidade |
| NF-e/NFS-e recebidas: consultas de registros já disponíveis | B | notas/nfse consultas locais | notas/financeiro.nfse visualizar | L | nenhum; omitir segredos/documentos pessoais | não | fiscal consultas |
| Fiscal externo: emitir/transmitir/manifestar/baixar/importar SEFAZ | D | plug fiscal/nfe/nfse | não expor | — | comunicação fiscal real proibida | — | negar descoberta/chamada |
| iFood/Takeat: reconfigurar ambiente/credenciais/ativar/autoaceitar/canal externo | D | integrações existentes | não expor | — | restrição explícita; preservar operação e flags | — | negar ferramentas/flags intactas |
| Usuários/perfis/OAuth/segredos/infraestrutura/tema | D | administração central/MCP/design | não expor no MCP | — | segurança e administração excluídas | — | catálogo negativo |
| CRM plataforma/WhatsApp/RH/Patrimônio/checklist autônomo | C | APP_MODULES crm/rh/patrimonio active=false; nenhum fluxo operacional localizado | — | — | não implementar plataforma nova | — | inventário de rotas |
| Etiquetas futuras de identificação de pedidos | C | sem contrato operacional implementado | — | — | escopo vigente é validade | — | inventário |

### Fontes e procedimentos

Catálogo operacional: `src/lib/modules.ts`; autorização: `src/lib/permissoes/catalogo.ts`
e `servidor.ts`; identidade: `src/lib/session.ts`. Ações enumeradas com
`rg -n '^export (async function|function|type|const)|^async function' 'src/app/(protegido)' -g '*actions.ts'`.
Guias dos módulos e regras Next instaladas consultados antes das alterações.

Referências oficiais conferidas nesta execução: [OAuth](https://developers.openai.com/plugins/build/auth),
[servidor](https://developers.openai.com/plugins/build/mcp-server),
[ferramentas](https://developers.openai.com/plugins/plan/tools),
[segurança](https://developers.openai.com/plugins/guides/security-privacy),
[atualização da conexão](https://developers.openai.com/plugins/deploy/connect-chatgpt).
Anotações não autorizam operações. Após deploy, atualizar metadados no ChatGPT e
concluir pessoalmente ampliação do consentimento; publicação não comprova esse fluxo.

## Implementação encontrada — validada em isolamento, pronta para deploy v2

Worktree e branch acima. Checkpoints publicados: `0275a43b`, merge `255add88`,
`042c0683` e `c58076da`; base remota e produção reconfirmadas em `8ea9d0e9` em 08/10.
A main ainda não contém a evolução v2. Quatro correções de fixtures e a evidência final
serão publicadas na branch antes da integração autorizada. A matriz inicial é o inventário anterior
ao código; a tabela abaixo descreve adaptadores efetivamente registrados.

### Cobertura implementada

Registro canônico: `src/lib/mcp/registro-negocio.ts` e seus registros específicos;
adaptadores `negocio.ts`, `pedidos-acoes.ts`, `suprimentos.ts`, `cadastros.ts`,
`financeiro-acoes.ts`, `producao.ts`, `canais-fiscal.ts` e `complementar.ts`.
O catálogo de gestão deriva desse registro. São 231 funções v2, além das seis
consultas financeiras v1 conservadas. Quantidade não substitui teste de negócio.

| Frente | Consultas implementadas | Ações implementadas |
|---|---|---|
| Conexão | Identidade e capacidades próprias | Nenhuma administração pelo MCP |
| Financeiro | DRE, caixa, saldos, títulos, contas e plano v1; extrato e centros de custo | Lançamentos, classificação/vencimentos, baixa/estorno/exclusão, contas/saldo inicial, categorias, importação/conciliação/reversão |
| Cartões/faturas | Cartões, faturas/itens e regras | Cadastro, importação, classificação/vínculos, correções, compensação, pagamento interno, reversão/cancelamento e regras |
| Clientes/fornecedores/beneficiários | Localização e cadastros permitidos | Criar/editar/disponibilidade, vínculos/condições e exclusões admitidas |
| Produtos/catálogo/complementos | Cadastros, ficha, custo/CMV com permissão própria | Cadastro/edição/preço/composição/disponibilidade, categorias/grupos, ordenação e exclusão |
| Insumos/preparações/porções | Fichas, medidas, marcas/categorias | Cadastro/conversões/composição, porções/ordenação, disponibilidade e exclusão lógica |
| Compras | Pedidos e recebimentos | Criar/editar/reagendar/receber/reabrir/cancelar/excluir, sem criar estoque/financeiro indevidamente |
| Estoque/contagens/perdas | Posição, extrato, reservas, contagem cega e perdas | Entradas manuais, contagens/finalização/cancelamento, perdas/estornos, preparação manual e locais |
| Pedidos | Lista/detalhe/histórico/agenda/prontidão, etapas/material permitido | Rascunho, confirmação/revisão/reagendamento/cancelamento, expedição/entrega/ocorrências/nova tentativa; material, retorno/perda, fatos financeiros e logística reversa nativos |
| Entregas/comercial | Janelas, slots, condições, canais, embalagens | Cadastros/janelas/slots, regras/condições, importação comercial e custos/vínculos de entrega; nenhuma ativação externa |
| Produção/validades | Trabalhos, impressoras/pontos e programação | Produção manual; trabalhos de validade, encerramento/cancelamento e impressão/reimpressão em fila com revisão humana |
| iFood operacional já habilitado | Estado local e proposta de negociação permitida | Aceite/etapas/entrega/cancelamento/negociação do fluxo existente em fila protegida; nunca ativar integração, ambiente ou autoaceite |
| Fiscal | NF-e/NFS-e já recebidas e cadastro fiscal local | Somente cadastro/revisão fiscal comercial; nenhuma emissão/transmissão/manifestação externa |

C/D da matriz inicial permanecem excluídos por inexistência ou restrição explícita.
Takeat conserva sua operação atual: não há escrita remota Takeat aplicável localizada.
Checklist operacional existente é a prontidão do pedido; não existe plataforma de
checklists/atendimento/WhatsApp independente. Etiquetas expostas são de validade,
não etiquetas futuras de identidade do pedido. Impressão continua limitada ao
formato suportado pelo serviço nativo, sem prometer homologação de hardware.

### Autorização, migração e proteção

`contexto-execucao.ts`, `permissoes/servidor.ts` e `mcp/servidor.ts` resolvem usuário,
perfil central e exceções atuais a cada chamada. Não há fallback de administrador,
perfil editável no MCP ou permissão congelada no token. `politica.ts` intersecta
token, consentimento, conexão, recursos centrais e restrições. OAuth público `none`,
PKCE S256, issuer/resource, callback exato, revogação e expiração de uma hora
mantidos; sem refresh, DCR/CIMD ou contas de serviço fictícios.

SQL aditivo `20261008010000_mcp_permissoes_centrais` a `20261008017000_*` preserva vínculos
históricos de perfis e congela seu alcance consentido, sem ampliar seis escopos v1,
versões, callbacks ou tokens. Referência histórica nullable não autoriza o modelo v2.
Granularidade nova fica no cadastro central: estornos, custos, cancelamento/reabertura
de compras, impressão/validades, exclusões comerciais e categorias de perdas.
Migrações copiam uma vez a semântica anterior e exceções explícitas; perfis novos
negam por padrão. Não alterar perfis reais de funcionários para testar.

Escritas em `operacoes.ts`: transação serializable compartilhada, idempotência
vinculada a identidade/conexão/operação/conteúdo, versões e referências atuais.
Operações sensíveis usam savepoint revertido dos serviços nativos, proposta de
15 minutos e revisão própria autenticada `/mcp/revisao/[id]`. Somente ação humana
com sessão/CSRF aprova; execução revalida consentimento, perfil, registros, flags e
assinatura dos efeitos. IDs novos/relógios técnicos são normalizados; datas de
negócio e valores permanecem vinculados. Datas automáticas de crédito interno
são normalizadas apenas nas operações nativas sem data fornecida pelo usuário.
Filas de impressão/iFood revalidam acesso antes de reservar/enviar; envio já em
curso não pode ser recolhido. Resultado pendente não é entrega externa concluída.

Consultas usam transação somente leitura; limites de tamanho, volume, paginação,
período e duração no catálogo/contratos. Nenhuma cache é compartilhada entre
identidades. Logs técnicos contêm ação, identidade/cliente, resultado, duração,
correlação e IDs, sem tokens/respostas completas. Retenção técnica: 90 dias, limpeza
limitada por lote; previews expiram em 15 minutos e recibos protegem repetições.
Chave nova inclui data UTC atual/anterior; chave antiga não pode recriar efeito
depois da retenção. Atualizações parciais preservam omissões e vínculos nativos.

### Evidências e pendências em 08/10

- Checkpoint `042c0683`: MCP/assinatura 264 aprovados, zero falhas; 203 sucessos
  de negócio e 28 ainda pendentes naquele momento. Não reutilizar como revisão final.
- Rodada `multi-bu.txt`, posterior ao checkpoint: 275 aprovados / uma falha
  na fixture de uma segunda negociação iFood sem nova revisão. Corrigida a fixture
  para representar nova disputa, preservando o bloqueio nativo de duplicação.
  Relatório de cobertura confirmou cenários positivos para as 231 funções v2.
- `multi-bw.txt`: 10 aprovados / zero falhas / 266 não selecionados, cobrindo a
  correção iFood, cadastros parciais, sete contratos de assinatura e filtro visual.
- Tipos `tipos-bv.txt` passaram; alterações seguintes exigem nova validação.
  Design da rodada final passou (8 bases/345 consumidores). Prisma validate passou.
- Bateria geral `geral-bx.txt`: 3.124 aprovados, 12 falhas, 22 ignorados.
  Quatro mocks antigos de autorização retornavam `undefined` em vez da sessão
  sintética já usada nas respectivas fixtures; a nova proteção central de custos
  passou a consumir essa sessão. Corrigidos apenas os mocks, sem remover asserções
  nem enfraquecer regras. Login precisava de `AUTH_SECRET` sintético; exclusão de
  insumos e design precisavam dos bancos exclusivos exigidos pelos seus guards.
  Reexecuções focadas: 55 aprovados, zero falhas (custos 16, conversões/
  especificação/marcas/login 24, exclusão 8, design 7).
- Bateria final `geral-cf.txt`: **3.158 aprovados / zero falhas / zero ignorados**,
  314 arquivos aprovados, início 03:20:34 BRT, duração 1.229,81 segundos.
  Todos os opt-ins e transporte HTTP de etiquetas habilitados. Revisão funcional
  `c58076da` mais quatro fixtures corrigidas, sem alteração adicional de código
  de produção. O relatório confirmou sucessos de negócio para todas as 231
  funções v2; não substituir a bateria por essa contagem.
- Lint completo/tipos finais `lint-ch.txt`/`tipos-ch.txt`, design (8 bases/345 consumidores) e Prisma validate
  aprovados. Build de produção webpack `build-cd.txt` aprovado, 86 páginas;
  aviso preexistente de APIs CompressionStream/DecompressionStream no bundle
  Edge do JOSE, sem erro de compilação ou falha dos testes de autenticação.
- Next completo em loopback `127.0.0.1:3107`: `smoke-ce.txt`, 14 verificações
  aprovadas, OAuth/PKCE S256, SDK real, ferramenta autorizada, bloqueio de escrita
  sem escopo e revogação na chamada seguinte. Consentimento sintético isolado,
  sem autenticar em nome do usuário nem validar ChatGPT/produção.
- Banco vazio isolado `mcp_migracoes_teste`: `prisma migrate deploy` aplicou as
  117 migrations; `migrate status` confirmou atualização, ambos aprovados.
- Backup privado pré-publicação `etiquetas-20261008-mcp-v2-0300`: dump
  59.775.723 bytes, diretório 0700/arquivos 0600, leitura integral por pg_restore
  para `/dev/null` aprovada. Imagem/configuração anteriores preservadas; fonte
  real do certificado é banco. Nenhuma restauração de banco efetuada.
  Renovado às 03:37 BRT: `etiquetas-20261008-mcp-v2-final`, 59.774.982 bytes,
  com a mesma verificação integral/permissões privadas/imagem preservada aprovada.
- UI isolada Vite `mcp.html`: quatro abas sem perfil paralelo, campos travados
  acinzentados, perfil/consentimento distintos, catálogo com busca/filtros, detalhes
  móveis e teclado (Escape devolve foco, setas/Enter nas abas). Sem overflow da
  página na conferência móvel. Capturas locais em `.tmp-mcp/visual-*-movel.png`.
  Dados fictícios; essa prévia não comprova a página Next de produção.
- Produção reconfirmada somente leitura: `8ea9d0e9`, container `68d602493c06`,
  zero reinícios, fontes MCP/permissões/schema iguais ao Git. Único cliente e
  conexão anteriores ativos, seis escopos financeiros somente leitura, mesma
  versão/callback/restrições. Última consulta financeira registrada em 07/10.
  `pedidosLiberacao` continua null; não foi ativada integração Pedido–Estoque.

Comandos reais, na raiz deste worktree com Node 22 compatível com Docker:

```powershell
# URLs somente de PostgreSQL descartável local, nunca copiar credenciais reais.
$env:DATABASE_URL='postgresql://mcp_config_teste@127.0.0.1:55449/teste_mcp_teste'
$env:MCP_BANCO_TESTE='1'
node node_modules/vitest/vitest.mjs run testes/mcp --maxWorkers=1
node node_modules/next/dist/bin/next typegen
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src testes scripts *.mjs *.mts *.ts
node scripts/verificar-tokens-design.mjs
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
node node_modules/vitest/vitest.mjs run --maxWorkers=1
npm run build
# Next completo local em :3107; AUTH_SECRET sintético igual entre processo e smoke.
$env:MCP_SMOKE_URL='http://127.0.0.1:3107'
node --conditions=react-server --import tsx testes/mcp/smoke-http.mts
```

Suítes de banco criam schemas próprios e aplicam SQL manualmente. Na bateria geral,
habilitados opt-ins documentados de compras, login, contagem, iFood, design, perdas,
conversões/especificação/entrada avulsa, planos de contas, marcas/exclusão de insumos,
faturas, MCP, datas, acessos, SEFAZ simulada, notas/conciliação, etiquetas, pedidos,
entregas e vendas. `PEDIDOS_AMBIENTE_ISOLADO=1` exige DB local `teste_*_teste`.
Porções usa `PORCOES_DATABASE_URL` do banco `porcoes_teste`; fotos usa
`FOTOS_INSUMOS_DATABASE_URL` de `insumos_fotos_teste`; exclusão usa
`EXCLUSAO_INSUMOS_DATABASE_URL` de `insumos_exclusao_teste`. Design usa seu próprio
cluster, `DESIGN_DATABASE_URL` local em :55432/design_system_teste, usuário
`design_teste`. Nenhuma dessas URLs contém segredo real. `AUTH_SECRET` sintético
é obrigatório no processo geral/login e no Next. Habilitar também
`ETIQUETAS_HTTP_TESTE=1` com Next isolado ativo. Não usar flags em produção.
SDK real em socket loopback :45447, Next smoke :3107,
Vite :4247. `AUTH_SECRET` da fixture é sintético. Impressora/iFood/SEFAZ de teste
interceptados; nenhuma ação comercial real faz parte da validação.

Pré-condições aprovadas: bateria geral completa, lint/tipos/design/build/Prisma,
smoke Next/OAuth, migrations em base vazia, revisão de diff e backup integral.
Fetch/ls-remote às 03:35 BRT confirmou main `8ea9d0e9`, branch zero commits atrás,
sem arquivos de ambiente, dump, chave privada, cache ou temporário no diff.
Ainda obrigatório: integração autorizada, deploy estável/migrations e smoke
autenticado de produção. A evidência pós-deploy será enviada somente à branch
para não disparar outra publicação puramente documental.
Rollback v1 exige suspender MCP antes de voltar código; não remover migrations
aditivas nem restaurar dump sobre transações novas. Não reativar perfis legados.
Procedimento de publicação em `docs/contexto/deploy.md`; SSH autorizado por chave
local `grazinghub_vps`, script `scripts/deploy-etiquetas.py`, nunca imprimir env/secrets.

Após publicação, ChatGPT requer Refresh na conexão existente, nova conversa e
consentimento pessoal para novos escopos. Não recriar cliente/callback nem remover
a conexão antiga; servidor publicado não amplia automaticamente seu consentimento.
OAuth real e consulta pelo ChatGPT ainda dependem do usuário. Não declarar homologado
de ponta a ponta apenas com testes locais, diagnóstico ou catálogo atualizado.
