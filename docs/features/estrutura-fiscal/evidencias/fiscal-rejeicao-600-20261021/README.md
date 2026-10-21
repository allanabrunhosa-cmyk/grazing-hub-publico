# Rejeição 600 e nova tentativa — 21/10/2026

Complementa o canal Site e o botão de repetição publicados no PR #5. A consulta
passa a reconhecer uma rejeição 600 comprovada, preservando todos os requisitos
de identidade, protocolo e histórico. Códigos desconhecidos e duplicidade não
liberam reenvio.

A prévia e o validador final indicam item fiscal, nome do produto e CSOSN
incompatível antes de transmitir uma venda NF-e normal/CRT1 para não contribuinte.
O servidor não altera os códigos aprovados. O alcance da NFC-e permanece separado.
Fonte: [MOC 7, N12a-70](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-i-leiaute-e-rv.pdf).

## Validações

Node 22.23.3. Nenhuma emissão, cancelamento ou alteração cadastral real para teste.

- Regressão fiscal/tributação e interface do pedido: **2.111 aprovados, 271 opt-ins
  ignorados**, 87 arquivos aprovados e 13 ignorados. Execução com `--maxWorkers=1`
  e limite temporário de 15 s, sem alteração do limite global do projeto.
- PostgreSQL local e HTTP fictício: **42 aprovados**. Inclui consulta da rejeição
  600 seguida de nova revisão no modelo 65, sem repetir a identidade incerta ou
  gerar financeiro, estoque ou notas recebidas. A fixture inicialmente tinha série
  divergente da chave; a guarda recusou o resultado. A fixture foi corrigida,
  preservando a validação de identidade. Um teste precisou copiar o payload
  congelado antes de montar seu caso inválido.
- `next typegen`, `tsc --noEmit`, lint e lint:design aprovados. Sem novo desvio de
  design, dependência, schema, credencial ou regra tributária alterada.
- `npm run build` aprovado. A execução local sofreu pressão de memória. A prévia
  visual foi encerrada antes do relatório final e repetida sem build concorrente.

As capturas usam somente dados e ações fictícios. Permanecem **Em revisão visual**.
A verificação não homologa emissão externa nem aprova referências em nome do usuário.

A lista restrita também cobre os códigos de rejeição já traduzidos para cadastro,
NCM, GTIN e CSC. Os casos SQL parametrizados usam chave e numeração distintas.
Duplicidade, denegação, protocolo, histórico divergente e código desconhecido
conservam suas guardas. A ampliação não autoriza reenviar a identidade rejeitada.

- Playwright final, sem build concorrente: **48 aprovados**, 320/390/768/1440 px, claro/escuro. Auditor de interface sem problemas nos cenários verificados.
- Smoke da compilação final: **seis rotas aprovadas**, login 200 e rotas protegidas 307 sem sessão.

[Desktop](desktop.png) · [Celular](mobile.png).
