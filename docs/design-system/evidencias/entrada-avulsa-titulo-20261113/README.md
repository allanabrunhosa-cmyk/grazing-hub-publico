# Entrada avulsa: fornecedor e produtos — 13/11/2026

O título financeiro passa a ser `FORNECEDOR — PRODUTO 1, PRODUTO 2`.
Entradas antigas recebem o mesmo título na consulta, sem atualização em lote.
A versão vigente da entrada define os produtos após uma correção.

Consumidor de referência: painel de correspondências de `financeiro/cartoes/fatura-view.tsx`,
o mesmo da captura fornecida. Mantidos Checkbox, Input, tipografia, quebra de texto,
cores e geometria atuais. Nenhuma variante ou token novo. `fontes.json` identifica
os arquivos usados nas capturas por SHA-256. Dados e ações são fictícios.

Capturas inspecionadas, **Em revisão**, sem aprovação automática de referência:

- [Desktop claro](1440-claro-fino.png) · [Desktop escuro](1440-escuro-fino.png).
- [Celular claro](390-claro-toque.png) · [Celular escuro](390-escuro-toque.png).

Validação no Node 22.23.3:

- Testes focados: 18 aprovados, incluídos na bateria do domínio.
- `vitest run testes/inventario testes/financeiro --maxWorkers=1`: 695 aprovados,
  um timeout de 5 segundos no formulário já existente e 196 opt-ins ignorados.
  O arquivo do formulário foi repetido isoladamente: cinco testes aprovados,
  sem ampliar timeout nem mudar asserções. Total distinto do domínio: 696 aprovados.
- `ENTRADA_AVULSA_BANCO_TESTE=1 FATURAS_BANCO_TESTE=1`: 119 testes aprovados
  no PostgreSQL local fictício. Estes cobrem parte dos opt-ins acima; os outros
  77 não foram executados. Incluída leitura SQL do título antigo, sem regravação.
  A fixture de Faturas reutiliza o isolamento oficial da integração do Atendimento.
- ESLint dos arquivos alterados, `lint:design`, `lint:visual:referencias`,
  `next typegen`, `tsc --noEmit` e `npm run build`: aprovados.
- Playwright: 12 aprovados, em 320/390/768/1440 px, claro/escuro e toque nos celulares.
  Busca por produto, seleção por teclado, texto completo, ausência do prefixo,
  isolamento de rede e 12 auditorias DOM sem problemas. Capturas consultivas;
  não há referência aprovada para comparação de pixels.
- Smoke da compilação: login 200 e cinco rotas protegidas com redirecionamento
  307 para login sem sessão. Servidor local e banco fictício encerrados.

Os primeiros ensaios Playwright identificaram espera desnecessária pelo evento
`load` e um seletor de teste com papel `textbox` em vez de `searchbox`. Corrigidos
no teste antes da execução final. A fixture de navegação também emite um aviso
React preexistente sobre `scroll`; não houve exceção de página ou acesso externo.

Não houve alteração de schema, dependências, valores, parcelas, datas, pagamentos,
estoque ou históricos operacionais. Nenhum lançamento real foi criado para testar.
