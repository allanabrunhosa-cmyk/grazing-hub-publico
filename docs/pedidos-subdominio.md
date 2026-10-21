# Pedidos: entrada dedicada na mesma aplicação

`pedidos.grazinghub.com.br` abre o gestor único em `/vendas/pedidos`. A raiz responde
307 para esse caminho no mesmo hostname, preservando busca, filtros e visualização.
O HUB oferece um único atalho externo Gestor de pedidos; Produção de pedidos e
Calendário de pedidos deixam de aparecer como submódulos no menu e na entrada de Vendas.
Selecionar o módulo Vendas permanece em `/vendas` no HUB; não abre o gestor
automaticamente. `entradaModulo` conserva essa entrada mesmo para perfil somente
Pedidos. A página exige no servidor uma seção efetivamente autorizada e mantém
os demais destinos filtrados no menu; somente o clique no atalho externo abre nova aba.
Links/favoritos GET e HEAD de pedidos no HUB também encaminham ao subdomínio depois
da verificação de sessão, mantendo caminho e consulta. Produção/calendário legados
abrem o gestor com `modo=quadros`/`modo=calendario`; POSTs antigos conservam o transporte
no host original para não mudar a origem da Server Action.

## Host, sessão e autorização

- `src/lib/hosts.ts` mantém a lista explícita de hosts e retorna identidade `hub`,
  `etiquetas` ou `pedidos`. `dedicado` cobre os dois subdomínios;
  `interfaceEtiquetasDedicada` permanece exclusiva de Etiquetas.
- `src/middleware.ts` conserva a convenção existente. Não migra para `proxy.ts`
  nesta alteração. Host inesperado ou X-Forwarded-Host divergente recebe 421.
- No host de Pedidos só passam raiz, gestor, novo pedido, detalhe por ID, operação,
  comanda, gestão e prontidão existentes, login/recuperação/redefinição, sem-acesso e assets. Outros módulos,
  APIs e os antigos submódulos de produção/calendário recebem 404. Não usar um prefixo
  irrestrito `/vendas` para ampliar a superfície do host.
  A API máquina-a-máquina do conector de Etiquetas continua sem cookie de pessoa
  somente no host de Etiquetas; a exceção não se estende ao host de Pedidos.
  O detalhe admite `/api/vendas/fotos/<id>` com ID restrito a letras, dígitos,
  hífen e sublinhado, até 100 caracteres. A foto continua privada: sessão e permissão
  são revalidadas no endpoint; acesso por Pedidos exige produto vinculado a item
  vigente. Isso não abre os endpoints de cadastro nem o catálogo inteiro.
  O caminho exato `POST /api/vendas/clientes/identidade` consulta duplicidade no
  preenchimento, com sessão, origem e permissão de Pedidos. Retorna somente flags
  de e-mail/CPF/CNPJ; não cria nem altera cadastros. Nesse host, recusa o contexto
  de Clientes. Os demais caminhos de `/api/vendas/clientes` permanecem bloqueados.
  Gestão preserva sua guarda composta de financeiro; permitir a rota não concede
  essas permissões. No host dedicado, operação e prontidão são favoritos legados
  que retornam ao Gestor depois da guarda de Pedidos, sem consultar produtos/estoque.
  Fora do host dedicado, prontidão conserva suas guardas de produtos/estoque.
- POST exige Origin exato do subdomínio. Não há `allowedOrigins` curinga, rewrite,
  compartilhamento de cookie ou autorização nova. Páginas dedicadas recebem
  no-store/noindex. As Server Actions e páginas continuam exigindo suas permissões
  no servidor, relendo a sessão real; host dedicado não substitui essas guardas.
- Mesma conta e banco; cookie host-only, HttpOnly, SameSite=Lax e Secure em produção.
  O primeiro acesso a Pedidos pede login próprio. Logout encerra a sessão daquele host;
  revogação continua valendo em todas as interfaces na próxima requisição.
- `pedidos.localhost:<porta>` é aceito somente em desenvolvimento, como Etiquetas.

## Identidade e componentes

`data-identidade="pedidos"` no body alcança conteúdo, login e portais. A paleta verde
clara/escura em `src/app/globals.css` mantém tokens de geometria, tipografia, vidro
e componentes do HUB. A variante operacional compacta do host é registrada na Central. Primárias estão no registro fechado da Central, nas chaves
`cor.pedidos.primariaClara` e `cor.pedidos.primariaEscura`; temas publicados anteriores
recebem os valores novos de fábrica ao serem resolvidos. A identidade Pedidos pode
ser experimentada no laboratório isolado da Central sem alterar o tema do editor.

Somente Pedidos usa o shell compacto sem menu lateral ou móvel: LogoMark GP e
TaglineBadge em box separado, header fino com Gestor de Pedidos, aparência e conta/saída
compartilhadas. MenuPedidos permanece componente compatível, mas não compõe esse
layout. HUB/Etiquetas preservam a navegação. Sem-acesso oferece somente retorno ao gestor.
Os estados operacionais mantêm cores distintas da marca: warning para preparo,
success para pronto, `--ds-processo-rota`/`-fundo` para rota e
`--ds-processo-entregue`/`-fundo` para entregues, sempre acompanhados de texto.

## Infraestrutura e validação

O DNS A foi verificado em 30/09/2026 e já aponta para a VPS existente. A implementação
usa a aplicação e banco existentes, sem migration, réplica ou serviço paralelo.
O domínio foi ativado e confirmado pela API oficial em 01/10/2026 (UTC), no mesmo
serviço Dokploy de HUB/Etiquetas, porta 3000, path/internalPath `/`, sem stripPath.
Os roteadores web/websecure preservam Host (`passHostHeader=true`) e usam o resolver
`letsencrypt`. HUB, www e Etiquetas permaneceram configurados no mesmo serviço.

O HTTPS de Pedidos foi verificado com validação de cadeia e hostname, sem aceitar
certificado inseguro: emissor Let's Encrypt, SAN `pedidos.grazinghub.com.br`, TLS 1.3
e validade até 30/12/2026 às 00:55:31 UTC. A verificação da infraestrutura precedeu
a publicação do código; a resposta HTTP 421 da aplicação anterior era esperada,
pois sua lista de hosts ainda não admitia Pedidos. A validação funcional acontece
após a publicação conforme [deploy](contexto/deploy.md).

A ativação utilizou a [API oficial `domain.create`](https://docs.dokploy.com/docs/api/domain),
com a sessão administrativa existente autorizada pelo proprietário somente para
esta publicação; token e segredo de assinatura permaneceram em memória no servidor.
DNS, credenciais e sessões existentes foram preservados.

Validações focadas: testes `testes/vendas/pedidos-hostname.test.ts`,
`testes/layout/pedidos-navegacao.test.tsx`, `testes/design-system/pedidos-identidade.test.ts`,
consumidores próximos de Etiquetas/layout/Design, `lint:design` e lint dos arquivos.
Os testes de contraste verificam os pares sólidos da paleta; não certificam contraste
composto do vidro, acessibilidade completa ou homologação externa.

## Variante compacta — candidata de 01/10/2026

BarraAcoes compacta reúne CampoBusca arredondado, filtros em Popover estreito,
SeletorVisualizacaoOperacional e ações. Busca automática/paginação ficam na URL;
FiltroCanalVenda oferece somente canal com aplicação no clique e check imediato,
sem Aplicar/Limpar. Popup continua aberto até fechamento, sem deslocar o quadro. Os cartões
mantêm cliente, TagCanalVenda, detalhe/impressão e Para: destinatário; os itens
continuam íntegros no detalhe/impressão. DS-PED-COMPACTO-01 e os novos contratos
estão em [padrões da Central](design-system/padroes.md), Em revisão visual.
Sem alteração de host, permissão, banco, domínio/DNS ou infraestrutura nesta variante.

O seletor muda somente a cor do gatilho: Quadros verde, Calendário azul e Lista
violeta. Status mantêm suas cores e as três visualizações mantêm o layout anterior.
Cliente/número/destinatário ganham destaque tipográfico com tokens oficiais.
Consulta de canal não grava dados, altera host ou amplia permissões; valores
selecionados fora do catálogo continuam visíveis e removíveis.

## Popups e retorno ao Gestor

Novo, detalhe comercial, histórico/gestão e comanda reutilizam Dialog da Central,
com rotas interceptadas no slot `@modal`. Acesso direto a essas URLs recompõe o
Gestor ao fundo e abre o mesmo conteúdo em popup; não exige navegar para uma tela
separada. A comanda conserva a prévia de impressão A4/80 mm existente.

`ShellPopupsPedidos`, chamado pelo layout, lê `useSelectedLayoutSegment("modal")`
e informa `PopupDiretoPedido` quando ocultar somente o popup de acesso direto.
Assim, uma troca de Novo para detalhe ou de detalhe para comanda não mantém dois
diálogos, mesmo se a primeira URL foi aberta diretamente. O slot usa `default.tsx`
nulo para acessos diretos e `@modal/page.tsx` nulo para o único retorno permitido,
`/vendas/pedidos`; não depende de heurística de nomes ou de catch-all para fechar.

`rotaPopupPedido` acrescenta o retorno normalizado por `retornoGestorSeguro`.
Somente a URL relativa exata do Gestor é aceita, com filtros da lista existente;
origens externas, outros módulos, fragmentos e parâmetros desconhecidos são
descartados. Modo, busca, canal, data, filtros e paginação são preservados.
Fechar ou descartar usa `replace` com `scroll:false`. Filtros e paginação da gestão
também navegam dentro do popup, mantendo esse retorno.

Novo e detalhe compartilham `ModalPedido` e a proteção inline já usada por Novo
(DS-PED-NOVO-01): sair, inclusive para a comanda, pede descarte no mesmo diálogo;
Continuar conserva o preenchimento. Ocorrências e reagendamento ficam no detalhe
com suas permissões e ações atuais. Motivo e agenda têm proteção separada; salvar
uma ocorrência não marca como salva uma agenda ainda não enviada. Atualização
comercial/financeira conserva esse preenchimento, recebe a versão atual do pedido
e usa nova chave de operação somente quando a versão muda.

Preparação e entrega, Prontidão dos produtos e Configurar Entregas deixam de ser
atalhos da experiência dedicada. Regras e auditoria no servidor continuam no domínio
existente. Conteúdos recusados, indisponíveis e erros de consulta permanecem
fecháveis no popup; sessão e autorização são verificadas antes de qualquer dado.
