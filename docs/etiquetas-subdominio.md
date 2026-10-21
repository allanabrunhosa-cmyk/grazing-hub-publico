# Validades: entrada dedicada, mesma aplicação

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Nomenclatura e endereço vigentes (03/10/2026)

- Portal **Grazing Validades**, logo com monograma **GV**, títulos e identidade da
  Central de Design atualizados. Atalho no HUB: **Controle de validades**.
- Host canônico: `validades.grazinghub.com.br`, DNS informado pelo usuário como já
  criado. Cadastrar na mesma aplicação Dokploy, porta 3000, paths `/`, HTTPS com
  Let's Encrypt e `passHostHeader: true`, preservando os domínios existentes.
- Host anterior `etiquetas.grazinghub.com.br` permanece na allowlist explícita:
  GET/HEAD de páginas permitidas encaminham ao host novo preservando path/query;
  POSTs e `/api/etiquetas/conector/*` conservam origem e autorização anteriores.
- Cookies continuam host-only: entrar no novo host usa a mesma conta, com novo login.
  Não alterar Domain nem ampliar a proteção de origem de Server Actions.
- `/producao/etiquetas`, IDs de identidade/tema, APIs, nomes internos e modelos do
  banco continuam compatíveis, sem migration. “Etiqueta” permanece nas operações
  que tratam do documento físico. Browser Print deve autorizar também o novo host.
- Alias local adicional: `validades.localhost`, apenas fora de produção.

As inspeções e resultados datados abaixo são históricos, com a nomenclatura da época.

### Validação da alteração em 03/10/2026

- Base `5a6ace30`; Node 22.23.3, lint global e focado, lint:design, TypeScript e build
  webpack aprovados. Tentativas iniciais com Node 24 sofreram falta de recursos;
  a execução concluída abaixo usa Node 22 com um único worker.
- Recorte Validades/layout/login/permissões/Design/Pedidos-host: 509 testes aprovados,
  44 pulados. Regressão geral: 2034 aprovados, 382 pulados (integrações opt-in).
- 11 verificações HTTP no build local sem banco/contas reais: identidade e login dos
  três portais, logo GV, encaminhamento legado com filtros, host inesperado, módulos
  externos ao portal e origem POST divergente. Ícone PNG GV inspecionado.
- Prévia isolada conferida em navegador: portal laranja com Grazing Validades/GV,
  título Validades e HUB com atalho Controle de validades no novo host.
- DNS A conferido: `validades.grazinghub.com.br` → `179.199.142.19`.
- Publicação **pendente**: o host ainda precisa ser cadastrado pela gestão autenticada
  do Dokploy, com TLS validado. Não atualizar main antes disso, pois os links e o
  encaminhamento legado passarão a depender do novo host. Login assistido aberto pelo
  túnel local `http://127.0.0.1:13000`; não há sessão administrativa ativa.
- Não houve migration, operação de negócio em produção, impressão física ou homologação
  de Browser Print. As integrações puladas não são declaradas aprovadas.

## Arquitetura encontrada e decisão

- Next.js 16.3.4 App Router, Server Components/Actions, Prisma 7/PostgreSQL e aplicação Docker única no Dokploy.
- `/producao/etiquetas` já concentra leitura dos cadastros, configuração, impressão e histórico.
- Sessão JWT HS256 em cookie `grazing_hub_session`; `getSession` relê usuário, situação, versão e perfil no banco em cada requisição. Cookie host-only, HttpOnly, SameSite=Lax, Secure em produção, duração de sete dias.
- `src/middleware.ts` valida hosts públicos explícitos. Desde a revisão autorizada em
  23/09/2026, `/` do subdomínio responde 307 para `/producao/etiquetas` NO MESMO hostname,
  preservando parâmetros. A URL passa a exibir esse caminho. Isso evita o encaminhamento
  interno de Server Actions do rewrite, que falhou com 421 em build local Node 22/24.
  Não foram afrouxadas as guardas de Host, Origin ou sessão. Ver `design-system/VALIDACAO.md`.
- O mesmo layout protegido substitui a navegação geral por um menu dedicado (Etiquetas, Gestão de validades e Configurações). O componente `EtiquetasClient`, suas consultas, prévia, ações, ZPL, perfis e histórico são únicos.
- A convenção `middleware.ts` foi preservada nesta mudança incremental. O Next 16 avisa que ela foi renomeada para `proxy.ts`; a migração geral pode ser feita separadamente.
- Nenhuma tabela, banco, sincronização, API paralela ou migration nova.

## Dados e responsável

`Insumo`, inclusive `PRODUTO_INTERMEDIARIO`, continua como cadastro único. Alterações são lidas diretamente do mesmo banco ao abrir/recarregar a tela; não existe replicação, mas também não existe atualização em tempo real por WebSocket de uma tela que permaneça aberta. Trabalhos emitidos preservam snapshots históricos.

RH ainda é uma página de módulo futuro. O cadastro apropriado já usado como responsável em contagens/recebimentos é `Usuario`. A seleção pesquisável reutiliza usuários ativos e não excluídos, expondo apenas ID/nome, sem e-mail ou dados administrativos. Uma pessoa sem conta pode usar a opção explícita **Informar outro nome**; isso não cria usuário nem colaborador.

Ao preparar, o servidor resolve novamente o ID e usa o nome atual cadastrado, ignorando o nome recebido do cliente. Usuário inativo/excluído/inexistente é recusado. O nome fica no snapshot; o ID e a origem USUARIO/MANUAL ficam na auditoria existente. O emissor autenticado continua separado de quem manipulou. Não se deve selecionar uma pessoa apenas porque ela está logada: é necessário indicar quem efetivamente manipulou.

## Autenticação e permissões

Mesma conta, senha, chave de assinatura e banco, sem segundo cadastro. **SSO automático entre domínios não foi ativado:** o primeiro acesso ao subdomínio pede login. Logout encerra a sessão daquele hostname; revogação por versão/inativação vale em todos os hosts na próxima requisição.

Não ampliamos o cookie para `.grazinghub.com.br`: isso enviaria a sessão a outros subdomínios e aumentaria a superfície de comprometimento/injeção de cookies. Compartilhamento depende de inventário e confiança em todos os subdomínios, aprovação específica e estratégia de migração dos cookies host-only existentes. Alternativa futura: troca de código de uso único entre origens explícitas, sem JWT em URL. Nenhuma delas é necessária para esta entrada dedicada.

- Produção/Visualizar: página e histórico.
- Produção/Adicionar (com Visualizar): preparar, iniciar/finalizar envio, exportar, confirmar.
- Administrador ativo do perfil protegido: configuração. O flag legado `Usuario.admin` não substitui o perfil atual retornado por `getSession`.
- Todas as Server Actions continuam validando autorização no servidor. O modo dedicado é apresentação/roteamento, não uma nova fronteira de autorização para IDs de Server Actions. Mesmo uma chamada forjada é sujeita à guarda existente.
- A interface também bloqueia controles de escrita para leitores. Nenhuma permissão é concedida automaticamente.

## Hosts e proteção de origem

Hosts de produção: `grazinghub.com.br`, `www.grazinghub.com.br`, `etiquetas.grazinghub.com.br`. Hosts inesperados ou X-Forwarded-Host diferente de Host retornam 421. Não escolhemos origem de redirect pelo cabeçalho encaminhado do cliente. O Traefik existente usa `passHostHeader: true` e deve continuar assim.

No subdomínio, apenas raiz, caminho original das etiquetas, login/recuperação/redefinição, sem-acesso e assets necessários são servidos. Outros módulos/API retornam 404. Isso não altera permissões no domínio principal. `localhost`, `127.0.0.1`, `etiquetas.localhost` só são aceitos fora de produção.

POSTs do contexto dedicado exigem Origin HTTPS exato, inclusive login. As proteções nativas de origem do Next para Server Actions permanecem; não foi adicionada origem curinga, CORS ou `allowedOrigins`. Não há alteração de CSP global nem liberação de conexão artesanal com localhost. Páginas dedicadas recebem no-store/noindex. Recuperação de senha continua usando a origem canônica configurada no serviço de e-mail, sem derivar link de Host do cliente.

## DNS, Dokploy e SSL

Inspeção em 16/09/2026, antes da ativação:

| Camada | Configuração |
| --- | --- |
| Hostinger DNS | A, nome `etiquetas`, destino `179.199.142.19`, TTL 14400 — já existente e resolvendo |
| Aplicação Dokploy | A mesma `app-copy-auxiliary-microchip-9hhwdm`, não criar outra aplicação |
| Domínio a adicionar | `etiquetas.grazinghub.com.br` |
| Caminho público/interno | `/`, sem remover prefixos nem redirecionar ao domínio principal |
| Porta interna | 3000, HTTP entre Traefik e aplicação |
| HTTPS público | Ativado, redirecionamento HTTP → HTTPS |
| Certificado | Let's Encrypt, mesmo resolver `letsencrypt` dos domínios existentes |
| Host | Preservar com `passHostHeader: true` |
| Variáveis novas | Nenhuma obrigatória |

Os domínios existentes estão em configuração dinâmica gerenciada pelo Dokploy. Adicionar pela tela Domains/API autenticada, não editar o arquivo gerenciado manualmente e não remover as entradas principal/www. Validar emissão real do certificado sem ignorar TLS. O painel tem porta pública 3000 HTTP; para login assistido, foi aberto túnel SSH temporário somente em `127.0.0.1:13000` até `127.0.0.1:3000` da VPS. Não enviar senhas pelo HTTP público.

Ativação da infraestrutura em 16/09/2026: usuário autenticou no painel e o domínio foi
adicionado pela aba Domains da aplicação existente, porta 3000, paths `/`, Strip Path
desligado e Let's Encrypt. Releitura do Traefik confirmou três hosts, mesmo serviço e
`passHostHeader: true`. HTTPS respondeu 307 para login e HTTP respondeu 308 para HTTPS,
sem ignorar certificado. Isso valida infraestrutura, não a publicação do novo layout.

## Zebra Browser Print

Sem mudança no renderer, prévia, DPI, 60×40/60×60, idempotência, tentativas ou estados. O SDK oficial continua pendente de disponibilização. Quando instalado, manter `NEXT_PUBLIC_BROWSER_PRINT_SCRIPT_URL=/browser-print/BrowserPrint.min.js` e autorizar **também** `https://etiquetas.grazinghub.com.br` no aplicativo local. O código JavaScript estará na mesma imagem Docker e será servido em ambos os hosts. Não expor a impressora pela VPS.

## Teste simples para a cozinha (depois de publicar)

1. Abra o novo endereço e entre com sua conta do HUB.
2. Confira o logo laranja e o menu Etiquetas/Gestão de validades; Configurações só para administrador. Dentro de Etiquetas ficam Imprimir/Histórico. Não deve aparecer menu de Financeiro/Compras.
3. Escolha um produto já habilitado e um responsável da lista. Só use prazos aprovados pela operação.
4. Na etapa **Revisão**, confira a prévia, informe quando necessário Medida, Validade original,
   Marca/fornecedor, SIF e Lote, escolha a mídia e clique **Preparar etiqueta**.
5. Clique **Baixar ZPL**, abra Histórico e confira **Arquivo exportado**. Não confirme saída física se nada foi impresso.
6. No HUB principal, abra Produção → Etiquetas e confira o mesmo trabalho. Não é necessário cadastrar o produto de novo.
7. O teste real da Zebra é separado: detectar, enviar uma etiqueta de teste, medir/ler a etiqueta e só então confirmar a saída física.

## Verificação técnica

- `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit`.
- ESLint nos arquivos alterados.
- `npx vitest run testes/etiquetas testes/permissoes testes/login testes/layout testes/insumos --maxWorkers=2`.
- Integrações locais com `ETIQUETAS_BANCO_TESTE=1`, `ACESSOS_BANCO_TESTE=1` e `LOGIN_BANCO_TESTE=1`, schemas temporários exclusivos no localhost.
- Build: `npm run build`. Se o cache anterior falhar após geração do Prisma, guardar/remover somente `.next` e repetir conforme CONTEXTO.md.
- Smoke HTTP real: iniciar `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3107`, depois `ETIQUETAS_HTTP_TESTE=1 npx vitest run testes/etiquetas/http.test.ts`, com DATABASE_URL e AUTH_SECRET do banco descartável em ambos os processos. Não cria registros. O teste confirma redirect 307 da raiz, segue o POST à rota canônica e verifica recusa servidora de usuário inexistente; não usa mais rewrite.
- Prévia sem banco/impressora: `npx vite --config testes/visual/etiquetas.vite.config.mts`, `http://127.0.0.1:4199/etiquetas.html`; `?leitor` e `?principal` exercitam os outros contextos com os mesmos componentes.
- Publicação segue CONTEXTO.md: backup/configuração fiscal privada antes de push, build Dokploy, preservação/restauração de mount/env SEFAZ, migrations e estabilidade, verificação visual. Não consultar SEFAZ para testar deploy.
- Validar HTTPS do domínio principal, caminho antigo e raiz do subdomínio após deploy. Impressão física e SSO não podem ser declarados validados.

Comentários no material Kairu continuam separados: somente após relato real de teste, prévia do comentário e autorização explícita; nenhuma nota ou resultado é presumido.

## Resultados locais antes do deploy (16/09/2026)

- Base integrada: `origin/main` em `4a292fa`, incluindo as alterações recentes dos cadastros.
- Prisma validate/generate, TypeScript, lint dos arquivos alterados e build webpack: aprovados.
  A primeira tentativa do build falhou internamente em WasmHash; guardar o cache `.next`
  anterior e refazer eliminou a falha. O build final após integrar a main também passou.
- Recorte Etiquetas/permissões/login/layout/insumos: 226 aprovados; 38 integrações opt-in
  não executadas nesse comando. Em execução separada, 27 integrações de Etiquetas/acessos/
  recuperação passaram em schemas temporários locais; nenhuma operação fiscal ou e-mail real.
- Smoke HTTP do Next de produção local: 4 aprovados, inclusive POST de Server Action na raiz
  reescrita recusando usuário inexistente. O transporte do teste usa node:http para preservar Host.
- Regressão completa: 749 aprovados, 146 pulados (integrações opt-in), um teste falho e uma
  suíte que não carrega. Ambos reproduzidos numa cópia intacta da main `4a292fa`:
  - `testes/notas-fiscais/dialog.test.tsx:190`: getByRole("alert") é ambíguo porque há os alertas
    de data de entrada e de itens incompletos simultaneamente.
  - `testes/notas-fiscais/fornecedor-interface.test.tsx`: importação de server-only no ambiente
    cliente do teste, antes de executar os dois casos.
  Não foram corrigidos/ocultados nesta tarefa e não são regressões do subdomínio.
- Navegador: layout dedicado, ausência de menus gerais, busca de responsável, bloqueios de
  leitura, 60×40, 60×60, SDK ausente e download ZPL conferidos com dados fictícios. Tablet
  768×1024 conferido. Nenhuma impressão física afirmada.
- Infraestrutura do subdomínio já validada por HTTPS; backup/configuração fiscal privado
  desta publicação em `<BACKUP_PRIVADO>` na VPS.
