# Faturas de cartão — execução

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Pedido: arquivo `60f5197a-2dd8-4e1f-908a-cb23396da315/Texto colado.txt`, lido integralmente.
Base: `0d5acae`, branch `codex/cartoes-faturas`, worktree isolado. Alterações preexistentes na raiz preservadas.

## Contrato essencial

Compra é despesa; pagamento da fatura é liquidação, nunca uma segunda despesa.
Reutilizar CartaoCredito, LancamentoFinanceiro, TransacaoExtrato, MovimentacaoBancaria,
Fornecedor, CategoriaFinanceira, CentroCusto, Usuario e permissões existentes.
Não testar com dados de produção. Publicar somente após validação e backup.

## Etapas e evidências

1. Auditoria: em andamento. Next 16/React 19, Prisma 7/pg, SQL manual; autenticação por
   sessão relida no banco. Compras no cartão já ficam PENDENTE; baixa atual é 1:1 e integral.
   Conciliação atual associa um extrato a vários lançamentos de valor líquido exato.
   DRE competência lê os lançamentos; DRE caixa depende da baixa integral; fluxo também.
   Portanto pagamentos parciais precisam de liquidações discriminadas e adaptação explícita
   dos relatórios, sem alterar o comportamento de despesas fora de faturas.
   Não encontrado cliente/provedor de IA em `src`; disponibilidade externa ainda não verificada.
2. Modelagem: em andamento, nenhuma migration aplicada.
3. Banco/migrations: pendente.
4. Domínio: pendente.
5. Importação: pendente.
6. Normalização/matching: pendente.
7. Regras/histórico/IA: pendente.
8. Parcelamentos/créditos: pendente.
9. Conciliação/relatórios: pendente.
10. Fronteiras autenticadas: pendente.
11. Interfaces: pendente.
12. Permissões/auditoria: pendente.
13. Testes: pendente.
14. Correções/regressões: pendente.
15. Typecheck/lint/build: pendente.
16. Ambiente/backup/rollback: pendente.
17. Deploy: pendente.
18. Smoke: pendente.

## Decisões

- Mesma base, sem catálogo/ACL/contabilidade paralelos. Não há multiempresa operacional;
  não inventar empresa/unidade nem atribuir fornecedor pela semelhança sem confirmação.
- Regras geram sugestões com origem/explicação, não baixas nem aceite fiscal automático.
- Campos monetários usam centavos inteiros/Decimal; texto e valor importados imutáveis.
- UI usa primitives e padrões compartilhados, confirmação explícita, sem salvar por blur.
- Nenhuma IA/OCR será declarada funcional sem integração e teste; dados não serão enviados
  a um provedor improvisado. Ausência de provedor não deve bloquear o fluxo determinístico.

## Retomada efetiva — 23/09/2026

O quadro inicial acima era uma fotografia desatualizada; não representa a situação desta retomada.
Base integrada: `1e90951` (Vendas/Design preservados). O trabalho segue isolado da raiz.

- Fases 1–12: schema e migration manual aditiva, serviços transacionais, importadores CSV,
  XLS/XLSX e PDF pesquisável, regras/memórias, normalização, correspondências e vínculo
  com múltiplas despesas, parcelas, créditos negativos, pagamentos múltiplos/parciais,
  reversão, auditoria, permissões e telas foram implementados.
- Relatórios: competência conserva a despesa; caixa usa liquidações proporcionais em
  centavos. Movimento bancário do pagamento não é contado novamente. Pagamento ainda
  não desdobrado aparece em grupo não classificado no caixa, nunca como despesa no DRE.
  A previsão por categoria pode estar incompleta até terminar os vínculos; aviso explícito.
- Sugestões apresentam nomes dos cadastros e preenchem uma confirmação editável.
  Não há IA contratada/configurada: decisão explícita de responsável autorizado por regras e revisão manual.
- Proteções: documento privado autenticado, original imutável, reprocessamento aditivo,
  confirmação versionada, prevenção de baixa genérica de despesa vinculada, detecção
  de PAN/CVV no texto antes da persistência. Enviar somente documentos mascarados.
- Validação efetiva nesta retomada: 76 testes direcionados passaram (22 integrações
  PostgreSQL locais, domínio, relatórios e regressões de Movimentações/exclusão).
  Prisma validate e TypeScript passaram; lint de design passou (219 consumidores).
  ESLint sem erros; import de tipo não utilizado removido e arquivo revalidado.
  Build de produção webpack concluído, 57 páginas; avisos Edge preexistentes de jose.
- Bateria ampla: 427 aprovados, 71 opt-in ignorados e 1 timeout de UI a 5 segundos.
  Os 3 testes desse arquivo passaram na repetição com limite de 15 segundos por teste.
  Preenchimento usa colagem em vez de renderizar a grade de permissões a cada caractere;
  todas as asserções foram mantidas. O limite global não foi alterado. Os 22 testes de
  integração de faturas ignorados nessa bateria já haviam passado com PostgreSQL local.
  Importadores XLS/XLSX/PDF real e acesso privado ao arquivo também passaram na bateria.
- Prévia Vite `faturas.vite.config.mts`, porta 4235: conferidos visualmente detalhe,
  revisão, sugestão com nomes, preenchimento antes de confirmar e formulário a 390px.
  Dados fictícios e ações simuladas; isto não comprova escrita de produção.
- Backup privado criado na VPS em
  `<BACKUP_PRIVADO>`.
  Preservada imagem anterior e origem fiscal no banco. Nenhuma consulta fiscal enviada.
  Dump com 11.572.721 bytes e índice validado por pg_restore --list (578 entradas).

## Próximo passo exato

responsável autorizado pode testar Financeiro → Cartões e Faturas → Importar fatura. Conferir a prévia
antes de confirmar e revisar/vincular as compras antes de conciliar o pagamento.

## Publicação confirmada — 23/09/2026

- Commit `e7ea9da` enviado por fast-forward para main. Dokploy concluiu o build Docker.
- Migration `20260923180000_faturas_cartao` aplicada; `prisma migrate status` confirmou
  as 65 migrations atualizadas. Contêiner `619ab0ca4986`, tarefa `5rovqggql94l`, sem reinícios.
- Configuração fiscal preservada pelo verificador do projeto; nenhuma consulta à SEFAZ.
- Sessão autenticada: Cartões e Faturas abriu com os cartões existentes; botão Importar
  fatura abriu o formulário, conferido por screenshot. Regras abriu normalmente.
  DRE, Movimentações e Fluxo de Caixa carregaram; resultado anterior do DRE preservado.
- Requisições sem sessão para o módulo, download privado e subdomínio Etiquetas foram
  redirecionadas para login pelo middleware. Nenhum arquivo financeiro foi exposto.
- Não importamos arquivos nem criamos despesas/pagamentos reais para testar produção.
  O teste de escrita e reversão foi feito exclusivamente no PostgreSQL local isolado.
- Monitor de aviso pausado após a confirmação, para não repetir a notificação.
- Pendência técnica preexistente: npm audit aponta quatro avisos altos na cadeia Prisma;
  atualização de dependências exige tarefa própria e testes, sem audit fix --force.
- Este registro pós-deploy é local: não fazer novo push só da evidência para evitar
  outra publicação desnecessária. A versão funcional publicada é `e7ea9da`.

## Limites explícitos

- PDF genérico: texto nativo, datas completas DD/MM/AAAA e valores BR; layouts não reconhecidos
  precisam de exportação CSV/XLSX ou mapeamento. Sem OCR, sem valores/datas inventados.
- Parcelas futuras não são despesas automáticas; o agrupamento usa os itens importados.
- Faturas credoras são registradas como crédito; transferência automática do crédito
  para uma fatura futura não é implementada.
- Integração bancária utiliza extratos existentes e confirmação na camada B da fatura.
- Previsão categorizada e DRE só ficam completos após o desdobramento/revisão.
- Não foi criada uma rotina inexistente de fechamento financeiro: há alertas nas telas
  financeiras. Não declarar homologação de todos os layouts bancários nem de IA.

## Incremento: PDF como primeiro passo — validação local em 23/09/2026

- Pedido: identificar cabeçalho automaticamente e distinguir um cartão Inter e dois Itaú.
- Integrada a atualização remota `027d3fa`, preservando Vendas. Sem migration nova.
- Implementados cabeçalho conservador, leitura geométrica das duas colunas Itaú, itens
  atuais Inter/Itaú, senha temporária e UI arquivo-primeiro. Reutilizados diálogos, seletor,
  tabela, campos monetários e tokens existentes. Nenhuma variante visual nova.
- Objetivo confirmado: detalhar três saídas bancárias; virtuais/temporários continuam
  na fatura principal. Nenhuma criação automática de cartão, despesa ou pagamento.
- Após senhas fornecidas pelo usuário, os três PDFs foram lidos localmente e páginas
  relevantes renderizadas/conferidas. Extrator real: 11, 37 e 53 itens respectivamente;
  somas exatas dos três totais impressos e zero linhas financeiras não reconhecidas.
  PDFs, senhas e extrações reais não foram copiados para o repositório nem para o banco.
- Total impresso, total informado e soma dos itens precisam concordar no servidor.
  PDF de outro final, alteração do cadastro após prévia e associação sem permissão
  bancária são bloqueados. Associação opcional do final é auditada atomicamente.
- Competência pelo vencimento e ciclo administrativo pela emissão são convenções
  identificadas na tela, não datas literalmente impressas. Ano das compras Itaú é
  inferido pelo ciclo/parcela, com aviso de revisão. Não há OCR ou IA externa.
- Validações: TypeScript, lint de design (219 consumidores), ESLint dos arquivos
  alterados e build webpack (57 páginas) passaram. Integração PostgreSQL isolada:
  29/29, incluindo sete novos cenários. Interface: 5/5 após corrigir rótulo acessível
  do campo monetário. Bateria anterior: 173 passaram, 22 opt-in ignorados e esse teste
  de rótulo falhou; não esconder a falha, corrigida e reexecutada integralmente (5/5).
- Prévia isolada: arquivo-primeiro e formulário preenchido conferidos no navegador,
  dados fictícios e ações simuladas; não comprovam escrita de produção.
- Próximo passo: finalizar verificações, preservar backup/configuração, publicar pelo
  ritual normal e confirmar UI/autenticação em produção sem operações financeiras.
- Fechamento local: Prisma validate passou; bateria final teve 174/174 aprovados e
  29 integrações opt-in ignoradas, já aprovadas separadamente com PostgreSQL local.
  Formulário também conferido a 390px. Backup privado de 11.608.243 bytes em
  `<BACKUP_PRIVADO>`.
- Ação inicial de responsável autorizado: conferir três cadastros principais e seus finais. Não escolher
  automaticamente entre os dois Itaú por nome. Classificações sem regra continuam
  exigindo revisão; não prometer processamento financeiro inteiramente sem confirmação.

## Compensação de cobrança e crédito — 06/10/2026

Contrato aprovado pelo pedido: par de valor exato, sinais opostos, mesma fatura e
mesma data para preservar o líquido diário; seleção e confirmação explícitas.
Detalhes, invariantes e fronteiras: [COMPENSACAO](COMPENSACAO.md).

- [x] Schema/migration manual aditiva e client local validado/gerado.
- [x] Serviço, autorização/versão/travas, idempotência, auditoria e reversão.
- [x] Seleção, confirmação com motivo, filtro/estado e proteção da interface.
- [x] Resumo, pendências, criação dos faltantes e pagamentos integral/parcial/legado.
- [x] Regressão de 14 arquivos: 229 testes aprovados, incluindo integração local
  FATURAS_BANCO_TESTE (76 casos após acrescentar quatro cenários à primeira rodada
  de 72), domínio, UI, relatórios, baixa e Movimentações. Nenhum skip nessa rodada.
- [x] Typecheck, lint focado e lint global aprovados; lint:design aprovado
  (321 consumidores).
- [x] Prévia desktop com dados fictícios: seleção de dois itens, motivo obrigatório,
  confirmação liberada somente após preencher, estado compensado e opção de desfazer.
  Imagens locais: compensacao-confirmacao-previa.jpg e compensacao-itens-previa.jpg,
  fora do repositório. Referência visual Em revisão.
- [x] Build webpack final aprovado; smoke local em /financeiro/cartoes e
  /financeiro/movimentacoes retornou 307 para sessão ausente. Diff conferido.
  Tipos/compilação local usam Node 24.19.0; produção mantém Node 22 no Docker.
- [ ] Publicação não autorizada neste incremento; não atualizar main. Próximo passo
  após validação: commit e push da branch, apresentar resultado para publicação.

### Autorização e revisão final de publicação — 06/10/2026

Usuário autorizou este incremento com “pode”. Revisão funcional `d550d12`.
Regressão geral, com `FATURAS_BANCO_TESTE=1` em schema temporário local:
261 arquivos e 2.283 testes passaram, 29 arquivos / 354 testes opt-in foram
ignorados; houve uma falha no contrato de fronteiras porque as duas ações novas
ainda não estavam registradas. As guardas de servidor já existiam.

Contrato atualizado com argumentos fictícios para compensar e desfazer.
Revalidação de `testes/permissoes`: 7 arquivos / 210 testes aprovados,
1 arquivo / 12 testes de integração opt-in não executados. Nenhuma alteração
no código executável após a bateria financeira de 229 testes, lint, typecheck,
Prisma, build e prévia já registrados. Não houve afrouxamento de asserções.

Backup privado criado e catálogo verificado antes da migration, configuração
fiscal preservada e imagem anterior registrada por identificador imutável.
Publicação e verificações posteriores seguem o ritual de Deploy; evidência
operacional fica fora do Git para não disparar outra publicação documental.

### Correção da confirmação de pagamento parcial — 06/10/2026

- [x] Diagnóstico: fluxo anterior permitia FINALIZAR por uma saída menor e deixava
  saldo parcial, apesar do nome do botão. Não atribuir quitação à classificação.
- [x] INTEGRAL é padrão no servidor; PARCIAL exige intenção explícita. Modos inválidos
  recusados; guardas, precisão, transação, auditoria e controle de versão preservados.
- [x] Aviso de saldo restante + marcação explícita por ID/versão. Botão/dialogo parcial;
  saídas exatas primeiro e orientação de reversão quando a saída escolhida era incorreta.
- [x] Testes novos de interface reproduziram três falhas antes da implementação.
- [x] Regressão financeira + permissões: 21 arquivos, 446 testes aprovados, 1 arquivo /
  12 testes opt-in de integração de acessos não executados. FATURAS_BANCO_TESTE=1
  executado em PostgreSQL localhost, schemas temporários com todas as SQL manuais.
  Primeira rodada teve uma falha de fixture (campo de liquidação inexistente), corrigida
  pelo filtro do pagamento ativo e revalidada; não se afrouxaram asserções.
- [x] Lint focado, lint:design (8 bases / 321 consumidores) e typecheck aprovados.
- [x] Prévia isolada com dados fictícios: aviso, escolha explícita e dialogo conferidos;
  referência permanece Em revisão. Captura do aviso salva fora do Git.
- [x] Build webpack aprovado (Node local 24.19.0; produção Docker usa 22). Smoke
  local da aplicação compilada: Faturas e Movimentações respondem 307 para login sem
  sessão, com Host válido. Nenhuma migration/client novo neste incremento.
- [x] Commit de escopo revisado e branch própria sincronizada, remoto conferido.
- [ ] Publicação exige autorização deste incremento. Nenhum pagamento real alterado;
  orientação de correção pela saída integral disponível é entregue ao usuário.

Contrato do fluxo e cuidados: [README — baixa integral](README.md#baixa-integral-e-pagamento-parcial-explícito--06102026).
