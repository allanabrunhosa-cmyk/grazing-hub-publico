# Execução

- [x] Inspeção: origin/main inicial 9658375a; branch isolada e alterações alheias preservadas.
- [x] Banco aditivo, versões imutáveis e domínio compensatório.
- [x] Backend, autorização na transação, idempotência e adoção de compras legadas.
- [x] Inclusão no topo, histórico/editor e aba individual.
- [x] Testes finais transacionais, domínio, inclusão e permissões: 26 aprovados, Node 22.
  PostgreSQL exclusivo localhost:55451, schemas temporários, somente fixtures.
  Inclui concorrência, repetição, consumo parcial/posterior, saldo livre, reservas,
  custos não apurados, versões, legado e preservação da obrigação financeira.
- [x] Editor/inclusão: 4 testes aprovados; inclusão conserva valores e foco. Cancelar após erro
  confirmado também no Chrome isolado. Timeout de 15 s apenas no teste com várias
  interações; o limite global dos arquivos não foi alterado.
- [x] Lint completo e lint:design (8 bases, 374 consumidores), sem erros.
- [x] Typecheck do projeto completo e build final de produção aprovados após
  endurecimento da precisão decimal e integração fiscal.
- [x] QA: 40 cenários de Entrada/Histórico/Detalhe/Movimentações/Editor, 320/390/768/1440,
  claro/escuro, tokens oficiais, sem erros do navegador ou diagnósticos da auditoria.
  Capturas locais privadas em .tmp/estoque-entradas; imagens representativas inspecionadas.
  Não certifica leitor de tela/WCAG; referência Em revisão humana.
- [x] Documentação dos contratos nos guias de Estoque, Insumos e inventário da Central.
- [x] Regressão global: 345 arquivos aprovados, 43 opt-in ignorados; 3.542 testes
  aprovados e 695 ignorados. Regressão focada: 381 aprovados e 55 opt-in ignorados.
  Main fiscal integrada, incluindo atualização f396f7f9, sem conflitos.
- [x] Atualização fiscal recém-integrada: 40 testes aprovados, incluindo 33 cenários
  PostgreSQL opt-in em teste_estrutura_fiscal na instância exclusiva localhost:55451.
- [x] Todas as 123 migrations aplicadas e status conferido em schema local descartável.
- [x] Build final integrado aprovado.
- [x] Commit/push/PR/merge/deploy e smoke somente leitura das PRs #12 e #13; evidências nas PRs.
- [x] Backup preventivo privado atualizado após publicação fiscal:
  etiquetas-estoque-entradas-20261012-b, dump de 61.533.865 bytes, catálogo com 1.000
  entradas, leitura integral e SHA-256 conferidos; imagem atual fixada para recuperação.
  Certificado fiscal permanece no banco. Nenhuma configuração/secreto publicado.

Validações interrompidas/falhas anteriores não contam como aprovadas. Uma execução
concorrente sofreu baixa memória (menos de 1 GB livre), timeouts de UI e foi encerrada;
a regressão global final usa dois workers, sem build concorrente, timeout de 15 s somente no
comando. O primeiro build detectou a extensão incorreta da importação na prévia,
posteriormente corrigida. A instância PostgreSQL compartilhada foi encerrada durante
uma tentativa final; o opt-in foi refeito na instância exclusiva. O caso de diferença
entre quantidade grande e fração pequena conserva decimal até o banco e testa
0,000000001; custos além da precisão cadastral bloqueiam com rollback integral.

Próximo passo: publicar a revisão final validada e registrar o smoke somente leitura na PR,
sem disparar outro deploy apenas para documentar evidências posteriores.

## Conferência de produção e correção de leitura

PR #12 integrada em 6a9b44a0; migration aplicada, sem pendências, versões imutáveis
e hashes dos serviços críticos conferidos. Configuração fiscal preservada. O smoke
somente leitura detectou rejeição do prefixo legado codificado no endereço do detalhe.
Correção localizada: decodificar uma vez na fronteira HTTP e devolver 404 para formato
inválido; domínio e movimentos permanecem intactos. 16 testes focados, lint, typecheck
e build aprovados. Repetir o smoke completo após a publicação desta correção.

## Correção da experiência no cadastro — 12/10/2026

Solicitante rejeitou o botão no rodapé e pediu acesso ao extrato na janela de edição.
Branch codex/estoque-inclusao-extrato-cadastro-20261012, base 15fee9d4.

- [x] Adicionar item imediatamente abaixo do Item 1, sem sticky/footer, com foco no
  novo produto, inclusão no topo e campos anteriores preservados.
- [x] Insumo/Local/Qtd/Fator/Valor numa linha em desktop/tablet; unidade cadastrada
  fixa no sufixo de Qtd, sem campo separado; reorganização responsiva no celular.
- [x] Aba Movimentações no InsumoDialog real de insumos e preparações. Reutiliza
  consulta, permissões e componente atuais; formulário keepMounted, sem salvar na troca.
- [x] Regressão: 328 testes aprovados, 109 integrações opt-in ignoradas, 47 arquivos
  aprovados e 9 ignorados. Testes dos dois consumidores: 4 aprovados.
- [x] Prévia dos componentes reais: 40 estados, 320/390/768/1440, claro/escuro,
  sem erro de navegador, overflow externo ou problemas da auditoria após corrigir
  o rótulo do rendimento da preparação. Conferidos foco, rascunho e descarte.
- [x] Lint/design/typecheck/build finais aprovados, sem novos desvios de design.
- [x] Backup atualizado verificado: etiquetas-estoque-fluxo-cadastro-20261012,
  61.545.207 bytes, catálogo com 1.025 entradas, leitura completa/SHA-256 conferidos;
  imagem anterior em execução preservada.
- [x] PR #14 integrada/publicada e smoke somente leitura aprovado; evidências na PR para evitar
  outra publicação apenas documental.

Nenhuma regra de saldo, serviço transacional, tabela ou migration foi alterada.
Referência visual Em revisão humana; não certifica WCAG/leitor de tela.

## Histórico, popup e exclusão — 12/10/2026

Branch codex/estoque-historico-popup-20261012, base fe398ca1.

- [x] Histórico como ícone; seção de entradas removida da barra lateral.
- [x] Numeração permanente do legado e preservação na adoção; migration aditiva.
- [x] Colunas solicitadas, data/hora de lançamento decrescente e popup preenchido.
- [x] Exclusão por compensação atual, permissões, versão, idempotência e auditoria.
- [x] Cancelamento de títulos pendentes na mesma transação; pagamentos/vínculos e
  saldo insuficiente bloqueiam sem alteração parcial.
- [x] Bateria final: 25 cenários PostgreSQL do Estoque, 1 migration com legado
  preenchido e 6 consumidores do popup aprovados. 124 migrations no banco descartável.
- [x] Regressão ampliada: 126 arquivos aprovados, 14 opt-in ignorados; 1.255 testes
  aprovados e 225 ignorados. Um teste do seletor financeiro falhou na execução
  concorrente; os 6 casos do arquivo passaram isolados sem alteração desse módulo.
  Integração de custos/cancelamento de compras foi ativada no PostgreSQL local.
- [x] Prévia real: 32 estados em 320/390/768/1440, claro/escuro; zero erros do
  navegador, overflow externo ou problemas de auditoria. Referência Em revisão humana.
- [x] Backup etiquetas-estoque-historico-popup-20261012 verificado: 61.545.446 bytes,
  catálogo com 1.025 entradas, leitura integral/SHA-256 e imagem em execução preservada.
- [x] Lint completo, lint:design (zero novos desvios), Prisma validate/generate,
  typecheck e build final aprovados. Popup ampliado após inspeção das imagens;
  auditoria/capturas e consumidores repetidos com aprovação. Endereço legado validado.
- [ ] Commit/push/PR/merge/deploy e conferência somente leitura; evidências na PR.

## Simplificação final do histórico — 12/10/2026

Branch codex/estoque-historico-filtros-20261012, base ddfc9d2d.

- [x] Histórico de ícone junto de Entrada avulsa em Movimentações; removido do formulário.
- [x] Busca geral + período oficiais, linha compacta e adaptação ao celular.
- [x] Pesquisa geral no servidor antes da paginação; termos combinados sem acentos.
- [x] Coluna Ações, apenas editar/excluir; bloqueios de registros encerrados preservados.
- [x] 40 cenários visuais, sem erro/overflow/problemas da auditoria; imagens inspecionadas.
- [x] Backup etiquetas-estoque-filtros-20261012: 61.552.047 bytes, 1.032 entradas no
  catálogo, leitura integral/SHA-256 e imagem atual preservados; fiscal intacto.
- [x] Regressão: 247 testes aprovados, 43 opt-in ignorados. Um caso com várias
  interações atingiu 5 s; os 6 testes focados passaram isolados com limite de 15 s
  somente no comando, sem mudar as asserções. Consulta PostgreSQL opt-in ativada.
- [x] Lint dos consumidores, lint:design (0 novos desvios) e typecheck aprovados.
- [ ] Build, PR/merge/deploy e smoke somente leitura; evidências finais na PR.

Ajuste de consulta e interface. Sem migration ou alteração das regras de escrita/saldo.
