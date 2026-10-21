# Produção

Mapa conferido em 23/09/2026, base 2fac409. Etiquetas e validades da cozinha na aplicação e banco únicos.

Desde 03/10/2026, a identidade do portal é **Grazing Validades** (monograma GV),
com acesso canônico em `validades.grazinghub.com.br`. O atalho no HUB chama-se
**Controle de validades**. IDs, tokens, APIs e caminho `/producao/etiquetas`
permanecem compatíveis; “etiqueta” continua nomeando o documento físico impresso.
O host anterior encaminha GET/HEAD ao novo endereço com os parâmetros e mantém
POSTs e conector na origem anterior, com as mesmas guardas. Login é host-only.

## Rotas e componentes

Base: `src/app/(protegido)/producao`. Nomes relativos abaixo pertencem a essa base.

- /producao → entrada; /producao/etiquetas → módulo compartilhado
- etiquetas/page.tsx/actions.ts, etiquetas-client.tsx, painel-impressao-guiado.tsx
- etiquetas/etiqueta-preview.tsx, responsavel-etiqueta.tsx, gestao-validades.tsx, preparacao-raspberry.tsx
- etiquetas/validades.css e lista-produtos.tsx: apresentação local e consulta de prazos

## Serviços

- src/lib/etiquetas/layout.ts e zpl.ts: modelo comum em milímetros
- src/lib/etiquetas/datas.ts, validacao.ts, browser-print.ts, gestao-validades.ts, raspberry.ts
- public/browser-print: SDK oficial; src/lib/hosts.ts: hosts/origens

## Banco de dados

Insumo como produto/preparação; Usuários habilitados e ResponsavelEtiqueta sem conta como opções de responsável; nomes são congelados no trabalho. PerfilImpressora, TrabalhoEtiqueta, TentativaEtiqueta e EventoAuditoriaEtiqueta.

## Regras importantes

- Raiz do subdomínio responde 307 para /producao/etiquetas no mesmo host; não restaurar rewrite antigo. Login inicial separado por cookie host-only.
- Fluxo canônico: **Responsável → Produto → Etiqueta**. A seção Imprimir etiquetas usa subabas sequenciais Grupo → Produto → Conservação. A busca global aparece desde Grupo, muda para Produto ao digitar e retorna a Grupo ao limpar. Não restaurar as cinco etapas principais nem dispensar a conservação.
- Emissão não movimenta estoque; gestão consulta snapshots, não consumo/saldo.
- Identificação e busca de produtos usam o nome do insumo; especificações de compra
  são exclusivas de Suprimentos e não aparecem nos cartões, revisão ou configurações.
- Validade no servidor pelo calendário/fuso da loja; validade original limita, nunca estende.
- Prévia e ZPL compartilham 60×40/60×60 e DPI. Preservar estados/idempotência; envio não comprova impressão.
- Conteúdo que não cabe gera `ErroLayoutEtiqueta`: a prévia mostra aviso local e preserva a tela; o servidor continua recusando o ZPL inválido, sem cortar texto. Erros inesperados não são tratados como falta de espaço. Regressão em `testes/etiquetas/etiqueta-preview.test.tsx`; ensaio sintético em `testes/visual/etiqueta-preview.html`.
- Imprimir usa o ponto padrão configurado e o conector existente. Browser Print é o transporte local quando não há ponto disponível. Aceitação pela API/USB não comprova saída física. Histórico da ativação física em `docs/features/pontos-impressao/OPERACAO.md`.
- A composição visual de Validades usa superfícies sutis e tokens oficiais, sem hero decorativo. Cards agrupam pelo ID do produto e revelam os registros ao clicar. O atalho Dar baixa é independente; uma única cópia restante dispensa popup e confirmação extra. Lista de produtos separa cadastro de prazo de habilitação de impressão. Referência da Central `validades-vidro`, Em revisão.
- Seleção individual/em grupo de Imprimir etiquetas e Gestão reutilizam FotoProduto, com ícone quando a foto falta/falha. A prévia da etapa Etiqueta dispensa cabeçalho repetido e se adapta à altura disponível no desktop, sem alterar ZPL.
- Fotos existentes do catálogo usam `/api/etiquetas/produtos/[id]/foto`: caminho estrito no host, sessão relida e Produção/visualizar; cache privado, sem SVG ou imagens externas. Não ampliar `/api/insumos` no host dedicado.
- Baixa de cópias retira etiquetas do acompanhamento; preserva snapshots, auditoria e estoque. Exclusão de ponto é recuperável e revoga a credencial; ponto padrão/fila em curso são protegidos.
- Configurações → Responsáveis seleciona usuários habilitados e cadastra pessoas sem criar acesso ao HUB. Novos usuários começam desabilitados como responsáveis, inclusive administradores. A habilitação é manual; editar o usuário não altera essa escolha. A migration `20261021180000_responsavel_validades_opt_in` muda somente o default e preserva os usuários existentes.
- Produção/visualizar e adicionar; configuração exige administrador. Host dedicado não concede permissão nova.

## Integrações e cuidados

Confirmação física depende de operador/impressora real, nunca de mock.

## Testes relevantes

testes/etiquetas; testes/layout ao mudar menu/host; ETIQUETAS_BANCO_TESTE somente no banco local.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Referências

[Zebra e operação](../etiquetas.md), [subdomínio/SSL](../etiquetas-subdominio.md), [identidade e estação](../etiquetas-identidade-estacao.md).
