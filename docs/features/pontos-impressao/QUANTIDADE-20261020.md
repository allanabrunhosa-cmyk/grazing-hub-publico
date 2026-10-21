# Quantidade de etiquetas — 20/10/2026

## Comportamento

Validades permite digitar a quantidade de etiquetas e usar os botões de aumentar e
diminuir. O controle aparece na etapa Etiqueta e na seleção de produtos em grupo.
O campo reutiliza `Input`, `Label` e `Button` da Central. Não há componente visual
ou token novo.

- O padrão passa de 10 para 30 cópias por trabalho. Limites maiores já configurados
  permanecem válidos. Configurações continua permitindo um limite de 1 a 50.
- O campo aceita somente inteiros. Digitação e colagem rejeitam letras, frações,
  expoentes, negativos e comprimento excedente. Vazio, zero na etiqueta individual
  e quantidade acima do limite mostram erro e impedem impressão.
- Na seleção em grupo, zero significa produto não selecionado. Cada produto gera
  seu trabalho e continua sujeito ao limite da loja. O total do grupo é a soma das
  cópias dos produtos selecionados, como no fluxo existente.
- Editar ou sair do campo não prepara nem imprime. O botão Imprimir continua
  explícito. O campo fica desabilitado durante o envio.
- A validação no servidor, permissão central, idempotência, auditoria, fila,
  tentativas e confirmação física permanecem no fluxo existente. Um trabalho de
  30 cópias gera `^PQ30,0,1,N`, sem criar 30 registros.

## Migration

`prisma/migrations/20261020170000_validades_trinta_etiquetas/migration.sql` muda o
default de `ConfiguracaoLoja.maximoCopiasEtiqueta` para 30 e eleva somente valores
existentes abaixo de 30. Não altera limites maiores, outras configurações, trabalhos,
snapshots, ZPL, tentativas, filas, estoque ou credenciais.

Aplicar somente pelo ritual de publicação, após backup verificável. Conferir a
contagem e os valores anteriores no backup privado. A reversão de dados deve usar
os valores por loja guardados nesse backup; não reduzir todos os registros para 10.
O código anterior aceita o novo limite e não exige rollback imediato da migration.

## Verificação

- `testes/etiquetas/actions.test.ts`: 30 cópias, ZPL, auditoria, rejeição de valores
  inválidos e preservação de limite maior configurado.
- `testes/etiquetas/operacao-interface.test.tsx`: digitação, colagem, foco, vazio,
  limites, correção por botões, grupo, envio único e bloqueio durante envio.
- `testes/etiquetas/pagina-compartilhada.test.tsx`: fallback de 30 sem loja salva.
- `testes/etiquetas/integracao.test.ts`: migration repetível, defaults, dados
  preservados, preparação de 30 cópias e idempotência no PostgreSQL local opt-in.
- `testes/visual/validades-quantidade.playwright.config.ts`: prévia sintética em
  320, 390, 768 e 1440 px, temas claro/escuro, grupo, quantidade 30 e erro 31.
  A suíte gera capturas e auditoria consultiva do DOM em
  `.tmp/dashboard-operacao-20261020/validades`.

As capturas são consultivas e permanecem Em revisão humana. A simulação não
certifica a saída física de 30 etiquetas. Nenhuma impressão real integra os testes.

### Resultado local

Node 22.23.3. A suíte de Etiquetas passou em 194 testes, com 23 opt-ins inicialmente
ignorados. A integração PostgreSQL local passou nos 16 casos, incluindo os dois
novos. Os sete smokes HTTP passaram após o build conjunto, servido apenas em
localhost e banco fictício. A primeira execução de integração teve um timeout de 5 s no teste antigo
que reaplica todas as migrations; a repetição passou sem alterar o timeout.

O ajuste final dos limites dos botões passou novamente nos 27 testes da interface.
A matriz visual final passou nas oito combinações, com zero diagnóstico na auditoria
parcial do DOM. ESLint focado e lint:design passaram. Lint global, tipos, Prisma
validate/generate e build também passaram na validação conjunta. A publicação fica
registrada em [Dashboard e operação](../bi-vendas/OPERACAO-20261020.md).

Capturas sintéticas inspecionadas:

- [Desktop, 1440 px](evidencias/20261020/quantidade-desktop.png).
- [Celular, 390 px, tema escuro](evidencias/20261020/quantidade-mobile.png).
- [Quantidade inválida, 320 px](evidencias/20261020/quantidade-limite.png).

As capturas longas do celular incluem a barra fixa na posição da rolagem. Isso é
uma composição da captura completa, não uma mudança da navegação de Validades.
