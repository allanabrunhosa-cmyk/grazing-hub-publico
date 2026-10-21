# Validação proporcional ao risco

Os comandos abaixo são executados na raiz do worktree correto. Scripts oficiais estão
em package.json; não criar equivalentes desnecessários. Dependências instaladas e Node
compatível com Docker (22) são pré-requisitos. Nunca instalar/atualizar pacotes só para docs.

Em checkout/exportação limpa, executar `npx next typegen` antes de `npx tsc --noEmit`.
O Next gera `next-env.d.ts` e os tipos de rotas/layout em `.next/types`, ignorados no
Git. A ausência desses arquivos pode produzir erros de `LayoutProps` e imports de
imagens; não corrigir esses erros criando declarações manuais ou relaxando o tsconfig.

## Nível A — desenvolvimento

- Rodar o arquivo de teste que cobre a alteração: `npx vitest run caminho/do/teste`.
  Exemplo real: `npx vitest run testes/financeiro/extrato.test.ts`.
- Lint focado: `npx eslint caminho/do/arquivo.ts`; conferir diff e erros relevantes.
- Typecheck do projeto: `npx tsc --noEmit` quando contratos/tipos mudarem.
  Não passar arquivo isolado ao tsc fingindo validar o tsconfig completo.
- Alteração UI: consultar padrões, `npm run lint:design`, teste do consumidor e imagem
  em prévia isolada. Não repetir regressão geral a cada edição.

## Nível B — conclusão da feature

- Rodar domínio e consumidores próximos conforme o mapa do módulo.
- Integração local para transações, concorrência, precisão, idempotência e autorização.
  Teste ignorado por flag não é teste aprovado. Registrar quais opt-ins foram executados.
- Mudança em UI compartilhada exige consumidores de outros domínios;
  em auth/hosts exige ações, páginas e endpoints; em relatório exige fontes de valores.
- Criar/regredir teste do defeito antes de declarar corrigido; não afrouxar asserções
  para obter verde. Investigar falha anterior antes de atribuí-la ao ambiente.

## Nível C — antes de publicar código

1. Lint: `npm run lint -- <caminhos-alterados>`; global quando a mudança for transversal.
   UI/tokens: também `npm run lint:design`.
2. `npx tsc --noEmit`.
3. Testes do domínio + regressão de integrações afetadas. `npm test` para mudanças
   transversais/risco difuso (autenticação global, schema compartilhado, dependências,
   layout/base UI) ou quando exigido pelo pedido. Uma vez na revisão final, não a cada passo.
4. Prisma validate/generate se schema/client/dependências Prisma afetados;
   migration em banco local isolado antes de produção.
5. `npm run build` (webpack); depois smoke conforme [deploy](deploy.md).
6. Se o código mudar após a bateria, revalidar o impacto novo; não reutilizar evidência
   de outra revisão como se fosse da versão final.

## Integração, visual e relatórios

UI também segue [a proteção automatizada](../design-system/protecao-visual-automatizada.md):
contratos Playwright pertinentes durante desenvolvimento, matriz completa no CI e
capturas por seção. Referências Em revisão são consultivas; apenas imagens aprovadas
no ambiente correspondente bloqueiam comparação de pixels. Não atualizar screenshots
nem baselines automaticamente para obter resultado verde.

- Vitest: `vitest.config.mts`; arquivos podem escolher jsdom por anotação.
- Flags opt-in aparecem no próprio teste, ex.: FATURAS_BANCO_TESTE,
  CONCILIACAO_BANCO_TESTE, VENDAS_BANCO_TESTE, DESIGN_BANCO_TESTE.
  Consultar a flag exata, configurar DATABASE_URL **local de testes** e verificar guardas
  localhost/schema antes de ativar. Não copiar secrets em comandos/logs/documentação.
- A cadeia atual de migrations também espera a view da integração do Atendimento.
  As suítes de Acessos e Etiquetas usam `testes/login/migrations-hub-isoladas.ts`:
  a view oficial fica em namespace exclusivo da fixture; somente a cópia SQL
  executada em teste recebe esse namespace. O helper exige NODE_ENV=test,
  prefixo de schema reservado e search_path correspondente. Os chamadores
  conferem localhost. Cleanup faz ROLLBACK e remove somente sua integração.
  Não alterar migrations já aplicadas nem criar essa fixture no banco real.
- Prévia padrão: `npm run teste:visual`. Outras: configurações em `testes/visual`;
  use somente a configuração do consumidor, com fixtures e ações simuladas.
- Em máquina com pouca memória, `--maxWorkers=1` limita concorrência. Timeout ampliado
  exige diagnóstico e registro; não esconder erro ajustando o limite global.
- Registrar comando, revisão, resultado/contagem, skips e limitações. Logs longos podem
  ficar em arquivo temporário ignorado: retornar resumo/erros e inspecionar trechos.
- Impressão simulada não prova Zebra física; mocks não homologam SEFAZ nem SMTP.

## Exceção proporcional: documentação apenas

Sem alteração de código/schema/configuração executável: validar links, caminhos, instruções,
cobertura da migração e `git diff --check`. Não executar Prisma, banco, build ou regressão
funcional só por editar Markdown. Scripts de documentação exigem seus próprios testes.
Essa dispensa não se aplica quando a documentação acompanha mudança funcional.
