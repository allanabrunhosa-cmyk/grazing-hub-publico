# Ambiente e publicação do Grazing HUB

Conferência em 16/11/2026, São Paulo. Base: `5ef2000c39ca36d03f6941b366f8260cbde5381f` no público. Comandos conferidos em package.json, Dockerfile, scripts e guias; nenhum deploy foi executado nesta passagem.

## Requisitos e clone

- Claude Code instalado/autenticado na conta escolhida. Sessões, assinatura e conectores do ChatGPT não transferem acessos ao Claude.
- Git, Node.js **22** e npm. Base fixa: Next **16.3.4**, React **19.2.8**, Prisma **7.10.x**; versões efetivas no lockfile. Consulte `node_modules/next/dist/docs/` antes de alterar Next.
- PostgreSQL local isolado; CI usa PostgreSQL **17**. Docker para reproduzir imagem produtiva; Playwright/Chromium para visual; Python 3 para conector/auxiliares quando pertinentes.
- Conferir espaço antes de clone/instalação/build: alertar abaixo de 20 GB decimais; resolver capacidade abaixo de 10 GB antes de operações grandes. Não remover cópias automaticamente.

Em pasta nova, sem sobrepor cópias antigas:

```sh
git clone --branch claude/continuidade-20261116 https://github.com/allanabrunhosa-cmyk/grazing-hub-publico.git grazing-hub-claude
cd grazing-hub-claude
git remote -v
git status --short --branch
git log -5 --oneline
```

No clone novo, `origin` é o público; no checkout antigo é o privado arquivado. Leia `CLAUDE.md`, `AGENTS.md` e regras de subpastas. Não importar história privada. Para enviar branches, configure autenticação Git própria via `gh auth login`, gerenciador de credenciais ou SSH autorizado; nunca token na URL. Para futuras atualizações, `git fetch origin` não troca a branch; revise divergências antes de integrar.

## Ambiente privado local

```powershell
Copy-Item .env.example .env
git check-ignore .env
```

Preencha `.env` ignorado com banco **local de testes** e segredo exclusivo. Prisma importa `dotenv/config`: não depender só de `.env.local`. Não importar dados de produção para desenvolver. `AUTH_SECRET` também cifra certificados/tokens persistidos; **não trocá-lo em produção para instalar o Claude**.

| Área | Variáveis / mecanismo | Onde configurar |
| --- | --- | --- |
| Banco/sessão | `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `NODE_ENV` | `.env` local; ambiente privado do serviço no Dokploy. Acesso fornecido pelo responsável sem copiar valores para Git/prompts |
| Build | `NEXT_DEPLOYMENT_ID`; `.next-deployment-id` gerado | Build/Next. UUID de deployment **não é SHA Git** |
| E-mail | `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORTA`, `EMAIL_SMTP_USUARIO`, `EMAIL_SMTP_SENHA`, `EMAIL_REMETENTE` | Provedor autorizado e configuração privada |
| SEFAZ recebidas | `SEFAZ_CERTIFICADO_PATH`, `SEFAZ_CERTIFICADO_SENHA`, `SEFAZ_CNPJ` | Fallback privado. `src/lib/sefaz/certificado.ts` prioriza banco. Não reaplicar env/mount por memória antiga; não versionar `.pfx` |
| Maps servidor | `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_ENTREGAS_ATIVADO`, `GOOGLE_MAPS_LIMITE_DIA`, `GOOGLE_MAPS_LIMITE_MINUTO` | Ambiente privado e projeto Google Cloud autorizado |
| Maps browser | `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Argumento de build; chave restrita por domínio/API. Nunca usar a chave de servidor |
| iFood | `IFOOD_ATIVO`, `IFOOD_PRODUCAO_AUTORIZADA`, `IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO`, `IFOOD_ACOMPANHAMENTO_MERCHANT_ID`, `IFOOD_TESTE_CLIENT_ID`, `IFOOD_TESTE_CLIENT_SECRET`, `IFOOD_PRODUCAO_CLIENT_ID`, `IFOOD_PRODUCAO_CLIENT_SECRET` | Portal iFood e ambiente privado dos serviços. Setup local mantém integrações desativadas; teste não autoriza loja real |
| MCP | `MCP_ORIGEM`, banco/auth e registro OAuth/PKCE | Configurações → Integrações → MCP. Cliente/callback próprios do Claude, consentimento e permissões HUB. Não reutilizar token ChatGPT |
| Etiquetas | `ETIQUETAS_WIFI_KEY`, `NEXT_PUBLIC_BROWSER_PRINT_SCRIPT_URL` | Segredo privado e script público oficial quando aplicável; pareamento Raspberry pela UI |
| Brasil NFe saída | Configuração cifrada na tela protegida. Scripts específicos podem usar `BRASIL_NFE_AMBIENTE`, `BRASIL_NFE_TOKEN`, `BRASIL_NFE_USER_TOKEN` | Responsável/provedor e painel privado. Variáveis de script não substituem automaticamente configuração persistente |
| Migrations | `MIGRACOES_FISCAIS_PLANO_APROVADO` | Destino privado, após revisão do plano exato |
| Backup | `GRAZING_BACKUP_ROOT` | Diretório absoluto privado na VPS, fora do checkout/Git |
| Administrador fictício | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOME` | Apenas base local isolada. `prisma/seed-admin.ts` faz upsert, promove administrador e altera senha/sessão; não executar em produção como setup |
| Manutenção Windows WIP | `GRAZING_STORAGE_STATE_DIRECTORY` | Diretório privado previamente revisado, contendo catálogo/estado existentes. Não criar/ampliar allowlist automaticamente; ver [preservação](CONTINUIDADE_MANUTENCAO.md) |

## Instalar, executar e testar

```sh
npm ci
npx prisma generate
npx prisma validate
npm run dev
```

Desenvolvimento usa Turbopack; build de produção usa webpack. Não atualizar dependências só para abrir o projeto. Timers e integrações externas não precisam ser ativados para usar fixtures de UI.

**Banco novo tem pendência conhecida:** `PUBLICACAO.md` registra falha na migration `20261021120000_atendimento_permissoes_hierarquia` sem a view opcional `atendimento_integracao.identidade`. Não foi comprovado bootstrap completo em banco vazio. Resolver por procedimento compatível/aditivo, sem editar SQL aplicada. O helper `testes/login/migrations-hub-isoladas.ts` prepara namespace exclusivo de teste; não criar essa fixture em produção.

Após conferir destino **local isolado**, o comando de aplicação é `npx prisma migrate deploy`. Nunca `migrate dev` ou `db push`. Não executar seed administrativo sem verificar que é base local fictícia.

Comandos reais; escolher conforme [níveis A/B/C](contexto/testes.md):

```sh
# Focado: exemplo existente
npx vitest run testes/financeiro/extrato.test.ts
# Domínios recentes
npm test -- testes/notas-fiscais testes/financeiro/faturas --maxWorkers=1
# Lint: adaptar os caminhos ao escopo
npm run lint -- src/lib/busca-valor.ts
# Checkout limpo precisa gerar tipos de rotas primeiro
npx next typegen
npx tsc --noEmit
# UI e prévia sintética
npm run lint:design
npm run test:design
npm run lint:visual:referencias
npm run test:visual:contratos
npm run teste:visual
# Bateria ampla somente quando o risco exigir
npm test
# Compilação produtiva e execução local compilada
npm run build
npm start
```

Leia a flag exata no teste. Exemplos: `FATURAS_BANCO_TESTE`, `CUSTOS_NOTA_BANCO_TESTE`, `NOTAS_PAGAMENTOS_BANCO_TESTE`, `CONCILIACAO_BANCO_TESTE`, `VENDAS_BANCO_TESTE`, `DESIGN_BANCO_TESTE`, `ACESSOS_BANCO_TESTE`, `LOGIN_BANCO_TESTE`. Ativar somente com PostgreSQL localhost dedicado e guardas conferidas. Teste ignorado não é teste aprovado.

Playwright precisa do navegador: `npx playwright install chromium`; Linux CI usa `npx playwright install --with-deps chromium`. Capturas novas ficam Em revisão. Não atualizar baselines para obter verde. Documentação pura valida links/comandos/diff, sem build/banco desnecessário.

## Publicar futuramente — não executar nesta passagem

[Deploy](contexto/deploy.md) é o ritual canônico. Confirmar autorização, origem/branch efetiva no Dokploy, revisão exata, estado do serviço, plano de migrations e retorno. Atualizar `main` pode disparar produção automaticamente.

1. Validar código final em nível C proporcional. Preservar imagem/configuração anterior. Se banco afetado, criar backup privado e comprovar integridade; existência de arquivo não basta.
2. Ler o plano usando imagem candidata e conexão privada do destino: `node scripts/migrations-publicacao-fiscal.mjs`. Sem `--bootstrap` é leitura. Aprovar o hash exato em `MIGRACOES_FISCAIS_PLANO_APROVADO` só após revisão/autorização; não reutilizar hash de outro banco/imagem.
3. Na VPS, com `GRAZING_BACKUP_ROOT` configurado, script revisado e identificador inédito, a sintaxe existente é:

   ```sh
   python3 - preparar etiquetas-identificador-unico < scripts/deploy-etiquetas.py
   ```

4. Integrar a branch validada pelo fluxo GitHub. Para fast-forward explicitamente aprovado, em `main` local limpo/atualizado: `git merge --ff-only BRANCH_VALIDADA` e `git push origin main`. Se divergir, revisar integração; não forçar. O placeholder não autoriza integrar esta branch WIP.
5. Acompanhar Dokploy. Dockerfile: `npm ci`, `npx prisma generate`, `npm run build`. Partida real:

   ```sh
   node scripts/migrations-publicacao-fiscal.mjs --bootstrap && npx prisma migrate deploy && npm run start
   ```

6. Exigir tarefa nova Running estável e sem reinícios; conferir migrations/HTTPS/UI em leitura. Identificar alvos atuais antes de substituir placeholders:

   ```sh
   docker service inspect SERVICO_CONFIRMADO --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
   docker service ps SERVICO_CONFIRMADO --no-trunc
   docker exec CONTAINER_CONFIRMADO npx prisma migrate status
   ```

7. Se necessário, o auxiliar abaixo reconcilia **somente configuração fiscal capturada**, sem retornar código nem restaurar banco:

   ```sh
   python3 - restaurar etiquetas-identificador-unico < scripts/deploy-etiquetas.py
   ```

8. Registrar commit/runtime/estabilidade/limites, sem segredos ou dados reais. Não emitir nota, pagar, conciliar, importar dados ou imprimir para smoke. Não disparar deploy só para registrar evidência pós-publicação.

## Retornar à versão anterior

Nenhum SHA produtivo anterior foi comprovado nesta passagem. Retorno usa **imagem anterior capturada e validada**, não um SHA inventado ou o deployment ID do Next.

Verificar compatibilidade do código anterior com schema/dados posteriores. Liquidações parciais de cartões e acompanhamento iFood podem ser incompatíveis com versões antigas. Não restaurar dump sobre transações novas por rotina. Migrations aditivas podem permanecer.

Com autorização e imagem compatível confirmada, selecionar o deployment anterior no Dokploy ou usar atualização controlada:

```sh
docker service update --image IMAGEM_ANTERIOR_CONFIRMADA SERVICO_CONFIRMADO
docker service ps SERVICO_CONFIRMADO --no-trunc
```

Repetir estabilidade/migrations/smoke em leitura. Alinhar a fonte Git/Dokploy por correção/reversão revisada, evitando republicação acidental. Não usar reset destrutivo, push forçado ou `docker service rollback` sem conferir o que será restaurado. Incompatibilidade pede correção aditiva; restore de banco exige plano próprio.

## Acessos ainda necessários no Claude

| Acesso | Ação necessária |
| --- | --- |
| GitHub | Autenticar Git do Claude para branches. Conector desta sessão não comprova credenciais do terminal do Claude |
| Acervo privado | Conta com leitura; destino privado gravável ou reabertura explícita do arquivado para itens privados revisados |
| Ambiente local | Node 22, dependências, banco sintético e `.env`; resolver pendência do banco vazio antes de declarar setup completo |
| VPS/Dokploy | Conectividade e chave SSH autorizada com host key validada, ou sessão Dokploy. DNS/HTTPS pelo terminal falhou e SSH foi negado; Dokploy abriu no navegador, mas exige login. Chave existente não comprova acesso |
| Aplicações | Conta existente com permissões adequadas por host; cookies são host-only. Não criar administrador produtivo via seed |
| Integrações | Conceder somente o necessário à tarefa via painel/cofre privado. MCP exige cliente/consentimento próprios do Claude |

Nenhum acesso produtivo é necessário para ler os documentos e iniciar análise. Registrar ausência de acesso sem declarar deploy, homologação ou correção de dados reais.
