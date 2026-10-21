# Cores dos motivos de perda — 20/10/2026

O gráfico de `/inventario/perdas` distingue as categorias cadastradas, inclusive
quando elas usam o mesmo motivo legado `OUTRO`.

## Causa e correção

O resumo já agrupava os valores pela categoria, mas o gráfico escolhia a cor pelo
motivo legado. Categorias personalizadas apareciam com a mesma cor.

`grafico-motivos-perdas.tsx` usa a chave da categoria e cinco cores tematizadas
existentes do HUB: `primary`, `warning`, `ds-processo-entregue`, `success` e
`destructive`. A legenda usa o mesmo preenchimento da fatia. Separadores ajudam a
identificar as bordas. Acima de cinco motivos, as cores são complementadas por
texturas distintas, sem ocultar categorias nem somar valores em “Outros”.

`PerdasTable` fornece ao resumo o conjunto anterior ao filtro de período. Assim,
mudanças de valores, ordenação e período conservam a identidade das categorias.
Adicionar uma categoria ao conjunto pode redistribuir a paleta; não há persistência
de preferências de cor. Valores, datas, permissões e gravações de perdas não mudam.

## Validação executada

- Node 22.23.3; 24 testes de consumidor aprovados em quatro arquivos de Inventário.
- 11 testes Playwright aprovados na prévia isolada `perdas-motivos.html`.
- Larguras 320, 390, 768 e 1440; temas claro/escuro; oito motivos, zero e vazio.
- Auditor oficial sem problemas nos oito cenários de largura/tema.
- `lint:design`: nenhum desvio novo.

Capturas com dados sintéticos, inspecionadas e **Em revisão visual**:
[desktop claro](evidencias/desktop-claro.png),
[mobile escuro](evidencias/mobile-escuro.png) e
[oito motivos](evidencias/mobile-oito-motivos.png).

Não houve operação em estoque real. As capturas não certificam WCAG nem leitor de
tela. Testes globais e publicação são registrados na entrega conjunta da tarefa.
