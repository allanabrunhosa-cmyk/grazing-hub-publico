# Etiquetas: identidade, navegação e estação de impressão

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Escopo e fonte única

O subdomínio usa a mesma composição visual do Grazing HUB: monograma GE à esquerda,
“Grazing Etiquetas” e “by Grazing Table & Co” em duas linhas, com os mesmos tamanhos
e espaçamentos da marca principal. A paleta laranja/terracota segue nas superfícies
claras e na opção escura. A marca aparece no menu e nas telas de login/recuperação. O
atributo do tema é definido no servidor pelo
host já validado, no body, para também alcançar menus e diálogos em portal. O HUB
principal conserva a identidade azul. O arquivo público é explicitamente permitido
no middleware; as regras de sessão, origem, cookies e autorização não mudam.
O título e o ícone da aba do navegador usam “Grazing Etiquetas” e “GE” no subdomínio;
no HUB principal permanecem “Grazing HUB” e “GH”.

O menu lateral usa a mesma estrutura responsiva do HUB. No celular abre em diálogo
e fecha ao escolher um link. Não há seletor para outros módulos no acesso dedicado.
As seções são parâmetros da mesma página (`/?secao=validades`,
`/?secao=configuracoes`), mantendo rewrite, ações e dados únicos:

- **Etiquetas:** impressão e histórico existentes; prévia, ZPL e estados preservados.
- **Gestão de validades:** consulta de `TrabalhoEtiqueta` ordenada por vencimento,
  filtros no servidor e páginas de 25. Cartões contam toda a loja, não só a página.
  Vencida = validade anterior ao instante da consulta; próximas = de agora até 48h
  inclusive; demais = acima de 48h. Datas exibidas no fuso gravado no snapshot.
  A aba Prazos dos produtos reutiliza os campos e a action do cadastro único.
- **Configurações:** fuso, limite de cópias, perfil, modelo, DPI, mídias e preparação
  de conexão. Somente administrador; gravações também conferem no servidor.

A gestão acompanha **etiquetas preparadas**, inclusive sem impressão física. Não é
inventário de lotes, não registra consumo/descarte e não calcula saldo disponível.
O aviso é explícito. Prazos editados no cadastro não recalculam snapshots antigos.
Os resultados são atualizados ao navegar/recarregar, sem atualização contínua.

## Acabamento do menu (revisão visual de 16/09/2026)

O menu dedicado reutiliza `NavLink`, com o mesmo tamanho, espaçamento, ícones,
foco e cantos do HUB. A indicação ativa aceita a seção da query string; o
comportamento padrão por pathname dos outros módulos permanece inalterado.
A largura continua sendo os mesmos 16rem da classe compartilhada `menu-lateral`;
fontes dos links (text-sm/font-medium) e rótulos (text-xs) também são idênticas.
O vidro é a mesma implementação CSS (86% de opacidade, blur de 32px, reflexo e
bordas), variando somente os tokens de cor. Não há mais gradiente opaco próprio.

Na lateral e no menu móvel, o componente de identidade mantém o monograma e os dois
textos alinhados, sem moldura ou recorte de PNG. O mesmo componente é usado no login,
com contraste suficiente para os fundos claro e escuro.
Sem migration, alteração de autenticação, cadastros ou impressão nesta revisão.
Validação local: 241 testes aprovados (44 integrações opt-in não executadas),
TypeScript, lint das alterações e build de produção aprovados. Conferência visual
em desktop e 390×844: logo sem fundo branco, menu compacto e HUB azul preservado.
O build incremental reproduziu a falha WasmHash conhecida; cache preservado em
`node_modules/.cache/next-antes-vidro-etiquetas-20260916` e build limpo aprovado.
Backup preventivo: `<BACKUP_PRIVADO>`.
Após integrar o atalho atualizado da main: 242 testes aprovados e build final
aprovado novamente. Avisos preexistentes de middleware/Edge permanecem.
O ajuste subsequente da main para abrir o atalho em nova aba também foi preservado;
a regressão combinada passou em 243 testes, além de TypeScript e lint do link.

## Raspberry Pi: preparação, não integração ativa

`PerfilImpressora.planejamentoRaspberry` guarda opcionalmente nome da estação, nome
da fila e conexão USB/rede. É o mesmo perfil do HUB, com auditoria existente. A action
valida os campos; não aceita URL, executa comandos, abre conexões ou recebe credenciais.
Salvar não instala software, emparelha aparelho, envia ZPL nem comprova impressão.
Campo omitido por clientes antigos preserva o planejamento; null remove só a preparação.

A tela mostra **Não conectado · preparação** e os passos pendentes. Browser Print
continua independente e o download ZPL permanece disponível. Para ativar Raspberry:
confirmar modelo/ZPL/DPI, Raspberry Pi OS, USB/rede e fila local; implementar/instalar
conector autenticado com idempotência e resultado incerto; homologar saída física.
Não expor CUPS/9100 ou portas de administração na internet, não salvar tokens no
navegador e não tratar Browser Print como suporte Linux garantido.

Referências oficiais consultadas em 16/09/2026:

- [Zebra Browser Print](https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html): suporte USB/rede de desktop Windows/macOS.
- [Raspberry Pi: impressão com CUPS](https://www.raspberrypi.com/news/printing-at-home-from-your-raspberry-pi/): referência conceitual para estação local; não é homologação desta Zebra.

## Banco e publicação

Migration manual aditiva `20260916210000_preparacao_raspberry_etiquetas`:
coluna JSONB nullable no perfil existente e índice de loja/validade/ID na tabela de
trabalhos. Nenhum catálogo, conta, prazo ou trabalho real é criado. Não altera
snapshots, estoque, permissões, tabelas fiscais ou migrations anteriores.
Backup privado e preservação das envs/mount SEFAZ são obrigatórios antes do deploy.

## Validação desta alteração

- Prisma validate/generate e TypeScript aprovados.
- Regressão Etiquetas/layout/login/permissões/insumos: 243 testes aprovados, incluindo
  seis integrações de Etiquetas em schema temporário exclusivo no PostgreSQL local.
  37 integrações opt-in/HTTP fora desse comando, sem ocultar testes quebrados.
- Após ajuste final da navegação: 14 testes específicos aprovados novamente.
- Integração verifica persistência/remoção/preservação do planejamento no mesmo perfil,
  auditoria, recusa do leitor e ausência de trabalhos/estoque criados pela configuração.
- Navegador: logo, menu, gestão, Raspberry e navegação móvel 390×844 conferidos com dados
  fictícios; sem teste de equipamento e sem alterações de negócio em produção.
- Primeira tentativa do build encontrou a falha de cache WasmHash já observada antes.
  Cache antigo preservado em node_modules/.cache/next-antes-identidade-etiquetas-20260916
  para refazer o build limpo. Aviso existente de middleware deprecated permanece.
- Build de produção limpo aprovado, incluindo a checagem TypeScript do Next. Lint dos
  arquivos alterados aprovado; aviso de navegação interna corrigido com useRouter.
- HTTP real do build local: cinco testes aprovados, cobrindo os dois hosts, identidade
  exclusiva do subdomínio, proteção de sessão/origem, ação real recusando usuário
  inexistente e logo público com a composição visual compartilhada, sem liberar arquivos
  arbitrários.
- Backup desta publicação: `<BACKUP_PRIVADO>`,
  privado na VPS, sem segredos no repositório.
- Main recente `07b9c8f` incorporada sem conflitos, preservando OFX Itaú e precisão
  fracionada do estoque. Regressão ampliada após integração: 322 aprovados, 60 opt-in
  não executados nesse comando. A migration de preparação foi ordenada depois da nova
  migration de precisão da main. Tema escuro também conferido no navegador.

## Teste simples do usuário

1. Entrar no subdomínio e conferir logo/menu laranja. No HUB principal, o azul continua.
2. Em Gestão de validades → Prazos dos produtos, escolher cadastros já existentes e
   informar somente prazos aprovados pela operação, sem cadastrar o produto novamente.
3. Preparar uma etiqueta, revisar prévia e baixar ZPL. Conferir o mesmo histórico no HUB.
4. Em Configurações, salvar modelo/DPI/mídia reais. Se planejar Raspberry, identificar
   estação/fila/conexão; conferir que isso ainda aparece como preparação sem conexão.
5. Validar a impressora fisicamente em etapa separada. Nunca confirmar saída física
   se houve somente download ou simulação.

Não foi publicado comentário de teste no material Kairu. Continuam necessários relato
real, apresentação prévia do comentário e autorização explícita para publicá-lo.
