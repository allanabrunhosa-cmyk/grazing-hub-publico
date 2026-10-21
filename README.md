# Grazing HUB

Gestão integrada da Grazing Table & Co: Suprimentos, Financeiro, Vendas e Etiquetas.
Aplicação única Next.js/React/TypeScript, Prisma/PostgreSQL; deploy Docker/Dokploy.

## Começar

- Agentes: [AGENTS.md](AGENTS.md).
- Documentação por assunto: [docs/README.md](docs/README.md).
- [Arquitetura](docs/contexto/arquitetura.md), [banco](docs/contexto/banco-de-dados.md),
  [testes](docs/contexto/testes.md), [deploy](docs/contexto/deploy.md).
- [Central de Design](docs/design-system/README.md).

## Desenvolvimento local

Usar Node compatível com Docker (22), npm e uma base PostgreSQL **local de desenvolvimento/teste**.
Configurar DATABASE_URL e AUTH_SECRET privadamente; nunca apontar testes para produção.

1. `npm ci`
2. `npx prisma generate`
3. Conferir URL/base; aplicar migrations locais pelo procedimento documentado.
4. `npm run dev`

Outros scripts oficiais: `npm test`, `npm run lint`, `npm run lint:design`,
`npm run teste:visual`, `npm run build` (webpack).
Não executar todos a cada alteração; selecionar nível A/B/C.
Push em main aciona publicação: não usar como forma de guardar rascunho documental.

## Código público e configuração privada

O código, as regras, o schema, as migrations, o design e os testes podem ser públicos.
Os exemplos de cadastro, preço, frete e preparação fiscal desta versão são sintéticos.
Não use os exemplos como configuração operacional.

Credenciais, certificados, dados pessoais, pedidos, resultados financeiros, exportações,
backups e destinos de cofres ficam fora do Git. Use o ambiente privado do serviço para
segredos. Use o Drive privado da operação para documentos e arquivos originais.
Não coloque links de cofres em issues, PRs ou resumos públicos do Actions.

Esta candidata parte da main atual e incorpora o empacotamento da PR #38. O histórico
anterior permanece privado. Não envie branches antigas ou o histórico original para a
base pública. Transfira trabalho pendente por diff revisado, em uma nova branch e PR.
Isso também se aplica à PR #35, cujas funcionalidades não foram integradas aqui.

O CI usa somente fixtures e runners hospedados. PRs externos não recebem credenciais
de produção nem do Drive. Os relatórios expiram em três dias, os diagnósticos em sete
e as imagens candidatas em 14. A aprovação de referências visuais continua humana.
O resumo de cada execução separa testes, empacotamento e uploads.

A troca da origem de produção e da base ativa exige aprovação e o procedimento de
publicação. Até essa troca, esta branch é uma candidata, sem deploy de produção.
