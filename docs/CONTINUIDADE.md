# Continuidade do Grazing HUB

Conferência em 16/11/2026, horário de São Paulo. Passagem de desenvolvimento, sem deploy. Base remota conferida pela API GitHub: `5ef2000c39ca36d03f6941b366f8260cbde5381f`.

## Origem e estado Git

| Referência | Estado comprovado |
| --- | --- |
| `allanabrunhosa-cmyk/grazing-hub` | Privado e arquivado; main `608dc51a98271ce5ae54efc69900c96ed0a1257c` |
| `allanabrunhosa-cmyk/grazing-hub-publico` | Público e ativo; main `5ef2000c39ca36d03f6941b366f8260cbde5381f`; base de desenvolvimento |
| Branch desta preparação | `claude/continuidade-20261116`, baseada somente no histórico público |
| Checkout original local | `codex/cardapio`, HEAD `63f75f4c37996401cba3957cb7c2d4a1dd245faf`; antigo e com mudanças preexistentes preservadas |
| Remotes locais originais | `origin` = privado arquivado; `publicacao` = público. Em clone novo, `origin` terá outro significado |
| Cache local público | `publicacao/main` estava em `bf7c2112`, desatualizada. Não usar esse cache como estado remoto atual |
| Versão produtiva | **Não verificada**: HTTPS pelo terminal falhou por resolução de host; SSH foi negado antes da conexão. Dokploy abriu no navegador, mas exige login. SHA/imagem/tarefa/flags não foram consultados |

O terminal não pôde escrever `.git/FETCH_HEAD` e não resolveu `github.com`. A API permitiu leitura, mas recusou gravação com HTTP 403 por permissão da integração. O envio usa a sessão GitHub autenticada no navegador. O checkout original não foi trocado de branch nem seus remotes foram reconfigurados.

[PUBLICACAO.md](../PUBLICACAO.md) e [ORIGEM-PUBLICA.json](../ORIGEM-PUBLICA.json) documentam a criação do público por snapshot. Não importar objetos/branches privados. Diferenças legítimas devem ser portadas por conteúdo revisado.

Commits recentes confirmados: `a86e9b5d` (PR #23, lançamentos inteiros), `bf7c2112` (PR #24, faturas/notas aceitas), `dd1d4941` (PR #25, consulta sem revalidação), `b3093abd` (PR #26, busca por valor), `50e57d5a` (PR #27, Configurações) e `5ef2000c` (PR #28, parcelamento de NF-e). Integração no GitHub não comprova implantação.

## Visão, arquitetura e módulos

O HUB centraliza a operação da Grazing Table & Co: compras, insumos, estoque, financeiro, catálogo, pedidos, produção, etiquetas e fiscal. O objetivo é reduzir trabalho manual preservando rastreabilidade. Atendimento possui repositório próprio: `allanabrunhosa-cmyk/atendimento-grazing`.

Next.js App Router, React e TypeScript; PostgreSQL com Prisma/adapter-pg. Páginas servidoras consultam/serializam dados, componentes clientes recebem DTOs e ações/serviços executam mutações autorizadas. HUB, Pedidos e Validades compartilham aplicação, dados e contas; hosts distintos não isolam autorização. Veja [Arquitetura](contexto/arquitetura.md), [Banco](contexto/banco-de-dados.md) e [Acessos](contexto/autenticacao-permissoes.md).

| Módulo | Escopo e fonte |
| --- | --- |
| Financeiro | Lançamentos, DRE, caixa, bancos, extratos, cartões e conciliação: [mapa](modulos/financeiro.md), `src/lib/financeiro` |
| Insumos/estoque | Composição, conversões, entradas, perdas e contagens: [insumos](modulos/insumos.md), [estoque](modulos/estoque.md) |
| Compras | Pedidos de compra e recebimentos: [mapa](modulos/compras.md) |
| Vendas/pedidos | Catálogo, clientes, canais, orçamento, confirmação, pagamentos, crédito, devoluções, entrega e BI: [mapa](modulos/vendas.md), `src/lib/vendas` |
| Fiscal | Documentos recebidos e emissão: [mapa](modulos/fiscal.md), `src/lib/notas-fiscais`, `src/lib/nfse`, `src/lib/fiscal-saida` |
| Produção/Validades | Etiquetas, responsáveis, filas e conector: [mapa](modulos/producao.md) |
| Cadastros/acessos | Fornecedores, categorias, configurações, contas e permissões: [cadastros](modulos/cadastros.md), [acessos](contexto/autenticacao-permissoes.md) |
| Atendimento | Aplicação independente e identidade/permissões centrais: [contrato](contexto/atendimento.md) |

RH e Patrimônio não devem ser apresentados como módulos completos por aparecerem no catálogo. Comece por `src/app/(protegido)`, `src/lib`, `src/components/ui`, `src/components/layout` e `prisma/schema.prisma`; consulte o mapa do domínio antes de expandir a busca.

## Decisões e regras

- Preserve Decimal/centavos, precisão de quantidades, transações, ordem das travas, versões, idempotência, snapshots e auditoria. Ocultar botão não substitui autorização no servidor.
- Conciliação oferece lançamento/parcela completa. Rateio por produto continua interno. Parcelas diferentes permanecem obrigações independentes; não duplicar despesas, recebimentos, liquidações ou estoque ao corrigir cartão/nota aceita.
- Pedido, entrega, competência, vencimento e pagamento são conceitos distintos. **Divergência a reconciliar:** orientação histórica dizia não usar confirmação comercial como competência; o código atual em `src/lib/vendas/pedidos.ts`, contrato `versaoFinanceiro === 1`, usa `dataCompra` quando informada e, no fallback, o dia da confirmação no fuso do pedido. Categoria vem do canal. Não mudar essa regra ou reclassificar histórico nesta passagem.
- Pix, débito, crédito e boleto integram o planejamento comercial. Cadastros financeiro e comercial são separados. Estorno parcial exige motivo; crédito futuro exige saldo elegível e proteção contra gasto duplo. Não presumir integração bancária real.
- Estoque de pedidos distingue reserva, consumo, liberação, retorno e perda. Não ativar automação por memória da conversa. Conferir composição, prontidão e configuração efetiva.
- Migrations são SQL manuais/aditivas. Nunca editar SQL aplicada, usar `migrate dev` ou `db push`. Preservar a exceção estrita de checksum em [migrations públicas](contexto/migrations-publicas.md).
- Edição comercial salva explicitamente. Limitar tamanho/caracteres e validar no servidor; campos numéricos respeitam máscara/precisão do domínio.
- D0 e importação histórica são decisões anteriores, não autorização de relançamento. Consulte [importação](features/importacao-historica/SPEC.md) e confirme execução atual antes de retomar; valores e registros reais ficam privados.

## Preferências e design

Português simples, frases curtas, voz ativa e termos consistentes. Autonomia para tarefas reversíveis dentro do pedido; verificações proporcionais ao risco; problemas acompanhados de solução prática. Preservar trabalho alheio e regras financeiras/de estoque/de permissão. Autorização antiga de deploy não vale para qualquer publicação futura.

Marca oficial: Grazing Table & Co; slogan “Viva um Momento Grazing”. Não redesenhar logotipo, tipografia ou proporções. Identidades: HUB azul, Validades laranja, Pedidos verde e Atendimento roxo. Use [Design System](design-system/README.md), manual, catálogo tipado e componentes oficiais. Referências novas ficam **Em revisão** até aprovação humana. Inspiração visual não autoriza refazer telas aprovadas.

Divergência explícita: as instruções recebidas nesta tarefa pedem X neutro em repouso/vermelho no hover; `AGENTS.md` público descreve vermelho pastel fixo e exceções cinzas. A instrução atual deve orientar a próxima alteração pertinente, mantendo componente oficial, acessibilidade, confirmação e auditoria. Nenhuma UI foi alterada nesta passagem.

## Solicitações recentes

**Verificado** significa implementação presente no remoto fixado em `5ef2000c`, com leitura de código e testes existentes. Não significa teste executado nesta passagem, registro real corrigido ou runtime comprovado.

| Solicitação | Situação | Evidência e limite |
| --- | --- | --- |
| Parcelamento de despesas/NF-e no cartão | **Verificado no código; caso real não verificado** | PR #28 / `5ef2000c`. `src/lib/notas-fiscais/parcelamento-cartao.ts::dividirParcelaCartao`, `parcelas-nota.tsx`, `custos.ts`, `correcao-nota.ts`. Divide total, mantém centavos/identidade/vencimentos. Quantidade não é ordinal. Testes `parcelamento-cartao.test.ts`, `parcelas-interface.test.tsx`, `rateio-parcelas.test.ts` em `testes/notas-fiscais`. Não houve correção automática de registros reais nesta passagem |
| Vínculo com fatura de outro cartão | **Verificado** | PR #24 / `90f41b1a`, `src/lib/financeiro/faturas/servico.ts`. PR #25 / `dd1d4941` também integrada: `correspondenciasFaturaAction` consulta sem revalidar layout. Testes `testes/financeiro/faturas/integracao.test.ts` e `consulta-action.test.ts` |
| Edição de manifestação aceita | **Verificado** | PR #24 e refinamentos #28; `src/lib/notas-fiscais/correcao-nota.ts::corrigirNotaNaTransacao`, `editarNotaAceitaAction`, `src/lib/nfse/correcao.ts`. Motivo, permissões, versão, locks e proteções de títulos/estoque. Testes em `testes/notas-fiscais` e `testes/nfse` |
| Agrupamento por lançamento/NF | **Verificado** | PR #23 / `a86e9b5d`; `src/lib/financeiro/faturas/lancamentos-inteiros.ts`, `validarSelecaoIntegralDeNotasFatura`. Uma opção por parcela inteira; componentes isolados rejeitados. Testes `lancamentos-inteiros.test.ts` e `lancamentos-inteiros-servico.test.ts` |
| Busca por valor | **Verificado nas áreas mapeadas** | PR #26 / `b3093abd`; `src/lib/busca-valor.ts`. Movimentações, Conciliação, lista/itens/candidatos de faturas, NF-e/NFS-e e despesas de entrega. Testes `testes/busca-valor.test.ts` e consumidores. Não afirmar cobertura de telas não inventariadas |
| Configurações → usuários/permissões | **Verificado** | PR #27 / `50e57d5a`; `src/components/layout/acesso-contexto.tsx` entra em `/configuracoes`; página prioriza usuários e resolve destino autorizado no servidor. Testes `testes/layout/entrada-configuracoes.test.tsx` e `brasilnfe-integracoes.test.tsx` |
| PIX ativo aparecer no pedido | **Pendente** | `src/app/(protegido)/vendas/pedidos/dados-editor.ts` ainda filtra PIX por taxas zero e `faixasTaxa` como array vazio no modo financeiro. Ativo não basta. Configuração real da ocorrência não consultada; reproduzir com fixture |
| Justificativa imediata de frete manual | **Pendente** | `src/app/(protegido)/vendas/pedidos/frete-pedido.tsx::alterarFrete` não abre campo/popup; depende de “Detalhes do frete”. Servidor já exige motivo em `src/lib/vendas/entregas.ts`; preservar essa validação |

## Integrações

Nenhuma integração foi comprovada **efetivamente ativa em runtime** nesta passagem. O servidor ficou inacessível; histórico não é atestado atual.

| Integração | Evidência / estado a levar ao Claude |
| --- | --- |
| iFood | Coletor/processador, inbox antes de ACK e acompanhamento segregado implementados. Homologação Order/Events e pendência Merchant são registros históricos. Teste/piloto documentados; loja, flags, Merchant e produção atuais **não verificados** |
| Takeat | Operação real preservada no histórico da convivência; estado externo atual **não verificado**. Não substituir automaticamente |
| SEFAZ recebidas | Certificado, distribuição, manifestação e timer implementados; agenda/certificado/consultas atuais **não verificados**. Não manifestar como smoke |
| Brasil NFe saída | Código suporta emissão manual 55/65 em homologação/produção, com autorização por documento, habilitação durável e guardião. Configuração/uso real **não verificados**; memória antiga de bloqueio universal está superada no código |
| Atendimento/WhatsApp | Repositório dedicado e identidade central; corte definitivo, webhook, workers, IA e operação atual **não verificados** |
| Maps | Cálculo de entrega/BI e chaves servidor/browser; ativação/cotas **não verificadas** |
| Zebra/Raspberry | Fila e conector implementados; Browser Print é alternativa distinta. Equipamento, rede e impressão física **não verificados** |
| SMTP | Recuperação/convites implementados; configuração/entrega atual **não verificadas** |
| MCP | OAuth/PKCE e permissões HUB em `/api/mcp`. Claude exige cliente/callback/consentimento próprios; conexão atual **não verificada**; não copiar token do ChatGPT |
| Drive/backups | Preferência por backup diário no Drive corporativo e saída do R2. Execução, recuperação e desligamento do R2 **não verificados** |
| C6/checkout e demais canais | Intenções históricas; implementação/operação **não verificadas/pendentes** |

## Trabalho local e preservação

Inventário somente leitura: **86 worktrees**, **15 com entradas no status**, **19 commits de branches não alcançados pelas refs remotas locais** e **4 stashes**. Contagens baseadas no cache; equivalência de conteúdo com o público foi examinada separadamente. Cache/log não equivale a código pendente.

Nove caminhos preexistentes na raiz foram preservados: `AGENTS.md`, `docs/contexto/versionamento.md`, `docs/features/pedidos/EXECUCAO.md`, os dois registros em `docs/features/pontos-impressao`, `docs/contexto/CONTINUIDADE.md`, `docs/contexto/armazenamento.md` e os scripts `armazenamento-seguro.psm1`/`manutencao-armazenamento.ps1`. O índice em `docs/contexto/CONTINUIDADE.md` é histórico de outubro; não foi substituído silenciosamente.

| Frente | Encaminhamento |
| --- | --- |
| WIP fiscal na worktree `fiscal-dashboard-publicacao-20261011` | Runtime equivale à branch pública `codex/nfce-xml-retentativa-20261021` / `7b246a45`, normalizados finais de linha. Testes locais são versões antigas; não reaplicar |
| Complementos `e6b9f6d6` | Já portado em `deaef406`, com avanços adicionais. Não importar commit privado |
| CI `16e161a9` e artefatos `144e6099` | Mecanismos já públicos com avanços; relatórios antigos ficam privados |
| Stash `09151a5a`, inclusive não rastreados | Versão anterior de `90f41b1a`; remoto contém melhorias posteriores. Manter stash para rastreabilidade, não reaplicar |
| `2638c7d9` e nove antecessores exclusivos | Preparação histórica do snapshot em `ORIGEM-PUBLICA.json`; não importar objetos |
| `5b1230ca`, `82f7e32d`, `696cf190`, `c9a5bcfe`, `a7d7dcde` | Relatórios históricos com material operacional e captura real; **preservados localmente, envio privado pendente** |
| Documentação suja de seletores, horários, frete, impressão e raiz | Mantida no lugar; contém dados operacionais/referências locais. Não enviada integralmente ao público |
| Stashes `382ce589`, `561c2af5`, `1e692125` | Mantidos; recuperação requer triagem privada |
| `apps/` e `infra/atendimento/` na frente de usuários | Junction de dependências e cache Python; sem nova implementação identificada; não enviar |
| Manutenção `5a2c5661` + dois scripts Windows | Código revisado preservado como **WIP** nesta branch, com sanitização de hostname/caminhos. Detalhes em [preservação de manutenção](CONTINUIDADE_MANUTENCAO.md); não executar contra VPS |

**A transferência integral do acervo privado não está concluída.** O destino privado está arquivado e o público não pode receber os objetos/relatórios. Falta destino Git privado gravável autorizado ou reabertura explícita do arquivo original para o material privado revisado. Não apagar cópias, refs, stashes ou relatórios enquanto houver essa pendência. Scripts/configurações/relatórios originais não foram descartados.

## Próximos passos e validação

1. Abrir a branch pública de continuidade em clone próprio, conforme [ambiente](AMBIENTE_E_PUBLICACAO.md). Não continuar por engano em `codex/cardapio`.
2. Resolver preservação privada pendente e conferir WIP de manutenção antes de encerrar ambientes antigos.
3. Corrigir PIX com fixture dos cadastros comercial/financeiro e suas taxas; preservar regras e permissões.
4. Mostrar justificativa ao mudar frete manual; testar edição, cancelamento, salvamento e servidor.
5. Conferir runtime e caso real do parcelamento em leitura autorizada; correção de dados exige plano próprio.
6. Reconciliar competência e instruções visuais antes de alterar esses contratos.
7. Resolver o bootstrap em banco novo sem editar migrations aplicadas; não declarar setup funcional antes disso.

Esta passagem inspecionou código/refs/API e documentação. Não executou build, migrations, operações financeiras, emissão ou impressão física. Testes de manutenção e revisão de arquivos estão registrados no documento específico; os testes funcionais citados na matriz foram lidos, não reexecutados. Atualizar a branch de passagem não constitui aprovação do WIP para merge ou produção.

Revisão de entrega: links relativos conferidos contra a árvore pública e os arquivos novos; diff documental sem erros de whitespace; parser dos scripts PowerShell sem erros. Foram revisados somente 19 arquivos de saída (quatro Markdown e 15 arquivos de manutenção), sem objetos do histórico privado. Os workflows existentes disparam em PR e/ou push em main; esta preparação não abre PR nem atualiza main.

Encerramento local: nenhum servidor, teste persistente ou instalação foi iniciado; nenhuma cópia/cache foi removida. Espaço livre medido ao final da preparação: aproximadamente 22,79 GB decimais. Ambientes antigos permanecem preservados porque há acervo privado pendente; não registrar seu encerramento como se todo HEAD e trabalho privado já estivessem enviados.

## Conferência no Claude Code — 17/11/2026

Preparação de ambiente, sem deploy e sem alteração de código funcional. Clone próprio em `grazing-hub-claude`, branch `claude/continuidade-20261116`, base `215abe74`; `origin` = público. O checkout antigo em `codex/cardapio` não foi alterado.

**Executado e aprovado neste clone:** `npm ci`, `npx prisma generate`, `npx prisma validate`, `npx next typegen`, `npx tsc --noEmit`, três arquivos de teste focados (59 testes: extrato, busca por valor, parcelamento de cartão) e `npm run dev` com `/login` respondendo 200 em localhost. Não executados: `npm test` completo, `npm run build`, testes com banco (flags opt-in) e migrations.

**Divergências em relação ao registro de 16/11:**

- O terminal do Claude resolve `github.com`, faz `fetch` e alcança a VPS. As falhas de DNS/SSH descritas acima eram do ambiente anterior.
- Envio Git para o público funciona pelo gerenciador de credenciais do Windows. O privado arquivado recusa gravação (403), como esperado.
- SSH com a chave local e host key já conhecida funcionou em leitura: serviço do app `1/1`, tarefa Running, imagem `:latest`. O SHA Git em produção continua **não verificado**; o banco da VPS usa imagem `postgres:16` (CI e local usam 17).
- HTTPS público: `/login` 200; `/api/mcp` 401 sem token; metadados OAuth 200. O MCP está no ar, mas **não há conector do HUB registrado no Claude**.
- Node local é 24.19; o projeto pede 22. As verificações acima passaram em 24, mas o build produtivo roda em 22.
- `gh` e Docker não estão instalados nesta máquina. PR/merge dependem do navegador; a imagem produtiva não pode ser reproduzida localmente.
- O `.env` do clone foi copiado do checkout antigo e aponta para PostgreSQL local (`localhost`). O estado das migrations desse banco não foi conferido; a pendência do bootstrap em banco vazio permanece.
- `docs/CONTINUIDADE.md` e `docs/AMBIENTE_E_PUBLICACAO.md` existem apenas nesta branch, não em `main` nem no checkout antigo.

Pendências funcionais inalteradas: PIX ativo no pedido e justificativa imediata de frete manual.

## Publicação do Pix com taxa — 17/11/2026

A pendência "PIX ativo aparecer no pedido" foi **implementada, testada e publicada**. PR #29, merge `347bc97` (funcional `32f9fc5`). Detalhes da regra em [Financeiro](modulos/financeiro.md).

- Causa confirmada em leitura no destino: forma Pix ativa com taxa fixa, ocultada pelo editor e recusada na confirmação.
- Decisão do responsável: liberar o Pix com taxa e lançar a taxa como despesa financeira no recebimento.
- Backup `etiquetas-pix-taxa-recebimento-20261117-4412b4bf` verificado (leitura integral e checksum); imagem anterior em `grazing-pix-taxa-anterior:20261117`.
- Migration `20261117120000_pedidos_taxa_recebimento_pix` aplicada antes do código pelo executor de plano aprovado, com candidato montado sobre a imagem vigente. Uma pendência, checksum conferido.
- CI do PR: quatro verificações aprovadas. Build Dokploy sem erros; contêiner `0f266a48ef23` Running por mais de 120 s, zero reinícios; schema em dia; arquivos publicados conferidos por hash; configuração fiscal preservada.
- HTTPS: `/login` 200; rotas de Pedidos, Formas de pagamento e Movimentações redirecionam sem sessão; `/api/mcp` 401.

**Não verificado:** tela autenticada em produção e um recebimento real com taxa. Nenhum pedido, pagamento ou lançamento real foi criado para teste.

Operação: a `main` é protegida e exige Pull Request. Sem `gh` no terminal, o PR foi aberto e integrado pelo Chrome do responsável. Pendência funcional restante: justificativa imediata de frete manual.
