# Nova tentativa fiscal após rejeição XML

Capturas de prévia local com pedido, cliente, chave, valores e respostas fictícios.
Referências consultivas **Em revisão visual**. Nenhum documento real foi emitido ou cancelado.

- [Desktop, 1440 px](desktop.png).
- [Celular, 390 px](mobile.png).

A tela preserva o seletor NF-e/NFC-e e o botão Emitir após falhas. Um resultado incerto
mantém o envio bloqueado até consultar a tentativa existente. A consulta que comprova
rejeição permite uma nova revisão e troca de modelo, sem reescrever o documento rejeitado.

## Validação

Node 22.23.3. PostgreSQL local e HTTP sintéticos. Nenhuma conexão com banco real nos testes.

- Integração fiscal: 38/38 aprovados, incluindo cartão sem recebimento, consulta da
  rejeição de xProd, troca de modelo, preservação do registro anterior, concorrência e permissões.
- Interface visual: 40/40 aprovados em 320, 390, 768 e 1440 px, temas claro e escuro.
  Inclui seletor, botão durante erro, nova tentativa após consulta e limites de largura.
- Lint e lint:design aprovados; nenhuma nova ocorrência do Design System.
- Tipos das rotas e `tsc --noEmit`: aprovados.
- Regressão fiscal/tributação/consumidor de Pedidos: 99 arquivos, 2.052 testes aprovados,
  três falhas e 267 opt-ins ignorados na execução ampla. Os dois arquivos afetados foram
  repetidos: 87/88 aprovados. O teste restante de GTIN passou isoladamente com as mesmas
  asserções e prazo local de 15 s: 5,99 s sem instrumentação. A medição anterior chegou a
  10,82 s; o limite original de 5 s era insuficiente nesta máquina. Nenhum prazo global,
  asserção ou código desse formulário foi alterado. Os 38 casos de banco acima foram
  executados separadamente, com o opt-in habilitado.
- Compilação oficial e smoke: resultados finais na [PR #3](https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/pull/3).
  A rodada usa a mesma árvore funcional e configuração fictícia.

A falha de preparação do primeiro banco sintético foi corrigida com o carregador de
migrations isoladas já adotado pelo projeto. Uma execução sem acesso local foi bloqueada
pelo ambiente; a execução com acesso ao banco de testes concluiu os 38 casos.

## Limites

Os testes não comprovam autorização pela SEFAZ. A tentativa pendente de produção deve
ser consultada após a publicação para registrar a rejeição pelo fluxo oficial. A consulta
não envia nota. Código zero isolado, duplicidade e histórico ambíguo continuam bloqueados.
