# Tipos de complemento e regra fiscal por tipo

Definição do responsável em 25/11/2026, para encerrar a dúvida "NCM do produto ou NCM da opção".
Domínios: [Vendas](../../modulos/vendas.md) e [Fiscal](../../modulos/fiscal.md).
Andamento: [TASKS](TASKS.md). Histórico da regra de NCM: [revisão de NCM](../revisao-ncm/SPEC.md).

## Regra

| Elemento | Escolha do cliente | Nome na nota | NCM |
| --- | --- | --- | --- |
| Produto | — | produto | do produto (aba Fiscal completa) |
| Variável (tamanho) | uma, opcional | produto + variável | não tem; vale o do produto |
| Complemento **Composição** | mais de um item | produto | não tem; vale o do produto |
| Complemento **Opção** | apenas um item | produto + opção | da opção |
| Complemento **Adicional** | produto ou item a mais | adicional | do adicional, em linha própria |

Exemplo de nome: "Torta artesanal grande palmito" = produto + variável + opção.

## Decisões de 25/11/2026

- **Opção aceita uma única escolha.** Dois sabores no mesmo pedido são dois itens do pedido.
- **Composição nunca muda o NCM.** Os Grazing Espetinhos passam a ter NCM único do produto;
  a escolha do código é do responsável (ver decisões abertas).
- **Todo Adicional sai em linha própria com NCM próprio**, inclusive os Extras.
- **Variável fica para uma etapa seguinte.** Tamanhos continuam como produtos separados.

## Implementado nesta etapa

- `src/lib/vendas/tipos-complemento.ts`: tipos gravados em `GrupoComplementoVenda.tipo`
  (`COMPOSICAO`, `OPCAO`, `COMPLEMENTAR`, `EXTRAS`) e o agrupamento do responsável
  (`COMPLEMENTAR` e `EXTRAS` são **Adicional**). Sem migration: a coluna já é texto.
- `OPCAO`: `validarGrupo` e `limitesEfetivos` (`dominio.ts`) forçam máximo 1 e sem repetição,
  também quando o vínculo do produto tem limite próprio. Composição e Opção são escolhas
  internas (`ehEscolhaInterna`) para receita, estoque e fotografia fiscal.
- Cadastro de complemento (`vendas/catalogo/catalogo-client.tsx`): o **Tipo** é o primeiro campo.
  A nomenclatura "grupo de complementos" saiu da interface: a aba de grupos chama-se
  **Complementos** e a de cadastros individuais, **Itens**.
- Cadastro de produto (`vendas/produtos/produtos-client.tsx`): aba **Receita** (antes Composição);
  seção **Complementos** com a seleção separada por tipo e categoria; sem **Classificação**
  (a tela de produto só cria produto; itens nascem em Complementos) e sem **Unidade comercial**
  (o servidor grava sempre `UN`); **Slots de entrega** depois do tempo de preparo, com a
  explicação de que cada slot corresponde a 1/4 de uma caixa M.
- Aba Fiscal do produto (`components/fiscal/campos-classificacao.tsx`): produto com NCM por
  escolha mostra a lista de NCMs em vez da frase "NCM definido pela composição do produto".

## Como o motor fiscal já atende a regra

O motor não mudou nesta etapa; os três tratamentos já existiam e passam a ter nome no cadastro.

- Composição: NCM do produto (`gruposEquivalentes` ou produto sem configuração), com revisão
  pendente quando aparece sabor novo.
- Opção: `configuracaoNcm.modoFiscal = "UNIDADES_SEPARADAS"`, uma linha por opção com o NCM do
  cenário. Com escolha única não há rateio.
- Adicional: `ComportamentoFiscal.comportamento = "MERCADORIA"`, linha própria com a
  classificação do item. Em produção (leitura de 25/11/2026) os 38 Extras e os 21 itens de
  Bebidas/Empório já estão assim; 20 dos 21 têm NCM.

## Fora desta etapa e decisões abertas

- **NCM do item no cadastro de Opção**: hoje o NCM por opção continua no editor de classificação
  fiscal. Falta o campo no próprio cadastro do complemento, gravando a versão fiscal por baixo.
- **Espetinhos**: escolher o NCM único entre os quatro usados hoje (0406.10.10, 0406.90.30,
  1601.00.00, 2106.90.90). Depende do responsável e do contador.
- **Torta artesanal e Suco integral**: mudar o tipo do complemento de sabores para Opção no
  cadastro. A mudança limita a um sabor por item; não foi feita em produção por esta entrega.
- **Variável**: entidade nova, sem NCM, que altera preço e entra no nome da nota.
- Nome na nota da Opção: hoje "produto — opção". Trocar o separador é decisão de apresentação.

## Riscos

- Mudar um complemento para Opção reduz o limite para 1 em todos os produtos vinculados.
- A classificação fiscal correta de cada produto continua sendo responsabilidade do
  responsável e do contador; o sistema aplica a regra cadastrada.

## Aceite

- `testes/vendas/tipos-complemento.test.ts` e `testes/vendas/interface.test.tsx`.
- Prévia isolada: `testes/visual/vendas.tsx`.
