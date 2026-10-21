# Validação e publicação

## Revisão validada em 07/10/2026
- Funcional: b0737324, integrado com origin/main 436c6d23 por 0e686cac, sem conflitos.
- Branch: codex/conciliacao-contadores-filtros; alterações da checkout original preservadas.
- npm ci com o lock integrado; Prisma Client 7.10.0 regenerado e prisma validate aprovado.
- npm test -- --maxWorkers=2: 273 arquivos aprovados, 33 ignorados; 2.348 testes aprovados, 504 opt-ins ignorados, nenhuma falha; 433,26 segundos.
- npm run lint, npm run lint:design e npx tsc --noEmit aprovados; design: 8 bases e 335 consumidores TSX.
- Integração anterior à atualização da main: 140/142 inicialmente aprovados; dois casos interrompidos pelo limite de setup de 10 segundos, com duplicidade da fixture no caso seguinte. Reexecução focada sem alterar limites aprovou os três casos envolvidos.
- Na revisão integrada, FATURAS_BANCO_TESTE=1 e PEDIDOS_BANCO_TESTE=1, usando apenas DATABASE_URL local com schemas temporários: quatro casos de consultas de faturas/itens/saídas e contagem de clientes/canais aprovados; 138 casos fora do filtro. A bateria anterior e a reexecução cobriram os 142 casos.
- As três expectativas antigas de rótulos/limite de validades encontradas na primeira regressão foram corrigidas e aprovadas na bateria final. Asserções de contagem e remoção da paginação silenciosa permanecem explícitas.

## Interface
- Prévia isolada com fixtures fictícias de NF-e e conciliação, nos tamanhos de computador e celular.
- NF-e: Todas, Aceitas, Pendentes e Recusadas incluem quantidade, inclusive zero; seleção preserva os totais do próprio grupo. Busca/período e alterações da lista cobertos por testes dos consumidores.
- Conciliação: transação em 01/09/2026 e vencimento em 25/08/2026; a candidata aparece fora do período e o botão de confirmação continua explícito. Nenhuma confirmação real executada.
- Capturas inspecionadas; nenhuma rolagem horizontal da página no celular. Console sem erro JavaScript; apenas favicon ausente na prévia.
- Evidências locais: filtros-quantidades-desktop.png, filtros-quantidades-mobile.png, conciliacao-sete-dias-desktop.png e conciliacao-sete-dias-ampla.png na pasta privada de visualizações desta conversa.
- O controle CUA estava indisponível por falha de inicialização; a prévia foi verificada pelo conector Playwright. Smoke de produção registra separadamente leitura autenticada e acesso sem sessão.

## Preservação
- Backup privado: etiquetas-contadores-conciliacao-20261007-1530, na VPS; 59.757.482 bytes, 934 objetos, permissões 0600, verificado por pg_restore --list.
- Imagem anterior preservada: sha256:51769f26ef9cfdee097dc5d85e4be9a7063e9c25e4ea6fd2dd17737bc0d2a519.
- Certificado fiscal no banco; sem env/mount de fallback. Nenhuma consulta externa à SEFAZ e nenhuma operação financeira/fiscal/estoque real para testar.

## Build e produção
- npm run build (webpack) aprovado: compilação, tipos, 85 páginas estáticas e rotas dinâmicas concluídos. Aviso já existente de migração futura de middleware para proxy; sem erro de build.
- Validação local com Node 24.19.0; build Docker e runtime Node 22 serão conferidos no deploy.
- Publicação e smoke a registrar após a nova tarefa Running.
