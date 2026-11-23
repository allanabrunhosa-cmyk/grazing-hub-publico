# Asaas e Site — execução

Contrato em [SPEC](SPEC.md). Branch `claude/asaas-site-20261123`, base origin/main 82c4211,
worktree isolada. **Nada foi publicado nem ativado**: sem chaves, webhooks ou worker em produção.

## Etapas

- [x] **Banco e domínio.** Migration aditiva `20261123180000_asaas_site_integracoes` (cinco tabelas
  novas, nenhuma existente alterada) e modelos no schema. `prisma validate`/`generate` aprovados;
  migration aplicada somente em schema temporário local.
- [x] **Backend e autorização.** `src/lib/asaas`, `src/lib/site`, rotas de webhook, liberação exata no
  middleware, fronteira de revisão comercial para origem `SITE` em `editarInformacoesPedidoInterna`.
- [x] **Interface.** Bloco de cobrança no detalhe do pedido; conexões Asaas e Site em Integrações.
  Reutilizados: `Card`, `Badge`, `Button` (`outline`, `entrada`), `Input`, `Label`,
  `SelecaoFormulario`, `BotaoRemoverItem`, `MolduraIntegracoes`/`IconeTom`. Consumidor de referência:
  Integrações › Brasil NFe/Certificado e a seção Pagamento do detalhe. Sem token, cor ou variante nova.
- [x] **Integrações (código).** Worker `npm run integracoes:worker`, incluído no Dockerfile.
- [x] **Testes.** Ver resultados abaixo.
- [x] **QA isolado.** Prévia Vite `testes/visual/integracoes-asaas-site.*` (porta 4263), dados fictícios.
- [x] **Documentação.** SPEC, [OPERACAO](OPERACAO.md), `.env.example`.
- [ ] **Deploy e ativação.** Não realizados. Dependem das pendências abaixo.

## Validações de 23/11/2026 (revisão de trabalho da branch)

| Comando | Resultado |
|---|---|
| `npx vitest run testes/asaas testes/site` | 22 aprovados |
| `npx vitest run testes/integracoes/webhooks-middleware.test.ts` | 1 aprovado |
| `INTEGRACOES_BANCO_TESTE=1 npx vitest run testes/integracoes --maxWorkers=1` (PostgreSQL local, banco de teste, schema temporário removido ao final, HTTP simulado) | 9 aprovados |
| `npx vitest run testes/layout testes/vendas testes/ifood testes/login testes/mcp testes/asaas testes/site testes/integracoes testes/design-system` | 2.637 aprovados, 427 ignorados por flag, 3 falhas em `pedidos-popup-servidor` por simulação de banco sem as tabelas novas; corrigido e o arquivo reexecutado com aprovação. A bateria inteira não foi repetida depois dessa correção. |
| `npx tsc --noEmit` (após `npx next typegen`) | sem erros |
| `npx eslint` nos arquivos alterados | 0 erros; 1 aviso anterior (`<img>` em `seletor.tsx`) |
| `npm run lint:design` | 0 desvios novos (84 históricos) |
| `npm run build` | aprovado; rotas novas presentes |
| `git diff --check` | sem problemas |

Capturas da prévia isolada em [evidencias](evidencias): Integrações › Asaas (1440, claro),
Integrações › Site pausado com teste de conexão (1440, claro), cobrança Pix aberta (375, claro),
formulário de gerar cobrança (375, escuro). Sem overflow horizontal em 375 e 1440; sem erros de
console; gerar cobrança e Pix copia e cola exercitados com ações simuladas. Referência **Em revisão**.

Não executado: `npm test` completo, contratos Playwright, `auditarInterface`, captura em 768 px,
navegação por teclado, smoke com servidor Next real, chamadas reais ao Asaas (nem sandbox) ou ao site.
Sem teste automatizado da recusa de revisão comercial em pedido do site.

## Pendências reais

1. **Credenciais e cadastros externos** (somente o responsável): chave de API e webhook no Asaas;
   chave de leitura e webhooks no WooCommerce. Roteiro em [OPERACAO](OPERACAO.md).
2. **Worker na VPS**: instalar o serviço `integracoes:worker` (modelo `infra/instalar-ifood.py`).
3. **Calibração com pedidos reais**: nome do campo de data/horário de entrega e do identificador do
   Asaas gravado pelo plugin do site. O Testar conexão lista os nomes dos campos.
4. **Decisões de negócio em aberto**:
   - emitir nota fiscal pelo HUB para pedido recebido do site (hoje restrito a origem interna);
   - criar cadastro de cliente automaticamente quando o pedido do site não encontra correspondência;
   - lançar no Financeiro a receita, a taxa e o repasse do Asaas (depende de B04 e do contador);
   - permissão própria para cobrar, em vez de reutilizar a de confirmar pedidos;
   - notificações do Asaas ao cliente (desligadas por padrão).
5. **Projeção em Atividades de usuários**: os fatos estão no histórico do pedido; a inclusão dos
   tipos novos na lista da camada de atividades não foi feita.
6. **Homologação**: sandbox do Asaas ponta a ponta e pedido de teste no site antes de produção.

**Próximo passo exato:** com as chaves do sandbox e a chave de leitura do site no ambiente, rodar
`npm run integracoes:worker -- --uma-vez`, usar Testar conexão nas duas telas e conferir um pedido
de teste do site e uma cobrança Pix de sandbox de ponta a ponta.
