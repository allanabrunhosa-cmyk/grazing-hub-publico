# Design System — índice operacional

Contratos vigentes e implementação compartilhada; referências visuais novas continuam
Em revisão até aprovação humana. Não é necessário ler todos os relatórios para editar UI.

## Escolha a seção

| Tarefa | Referência |
| --- | --- |
| Qualquer UI | [Princípios e contratos](padroes.md); ler seções pertinentes à alteração |
| Botões/edição/status/ordenação | Contratos da execução integral ao fim de padroes.md |
| Cores, tipografia, vidro, geometria | Seções 2–7 do manual e tokens no registro tipado |
| Seleção/multisseleção/diálogos | Seções 8–10 do manual |
| Tabela/filtros/acessibilidade | Seções 11–12 do manual |
| Consumidores e exceções | [Inventário](inventario.md), revisão executável; baseline antigo é histórico |
| Comanda térmica de Pedidos | [Inventário](inventario.md#comanda-térmica-de-pedidos--03102026--em-revisão-visual), EX-IMP-02, documento físico compartilhado |
| Persistência/publicação visual | Código abaixo e [arquitetura](arquitetura.md), distinguindo proposta histórica |
| Retomar trabalho extenso | [EXECUCAO](EXECUCAO.md) e [entrega](ENTREGA.md) |
| Evidência específica | [VALIDACAO](VALIDACAO.md), buscar pelo assunto/data, não reler integralmente |
| Plano/referência inicial | [Implantação](implantacao.md), [referência](referencia-inicial.md), [proposta original](historico-proposta.md) |

## Mapa implementado

- /configuracoes/design e /configuracoes/design/[grupo] → src/app/(protegido)/configuracoes/design.
- Laboratório: src/app/(laboratorio)/configuracoes/design/laboratorio/page.tsx;
  exige permissão e administrador; renderiza src/components/design-system/laboratorio-design.tsx.
  O grupo (laboratorio) evita herdar a moldura operacional; URL e guardas são preservadas.
- src/lib/design-system: registro.ts (catálogo fechado), tipos.ts, validacao.ts,
  servico.ts (rascunhos/versões), gerar-css.ts, resolver-tema.ts, previa.ts e grupos.ts.
- src/components/ui (incluindo Popover), campo-busca.tsx, tag-canal-venda.tsx,
  filtro-canal-venda.tsx e seletor-visualizacao-operacional.tsx,
  status-ativo.tsx, padroes-operacionais.tsx, lista-ordenavel.tsx e remover-item.tsx:
  contratos reutilizados, sem geometria/cores arbitrárias por tela.
- src/app/globals.css e layout.tsx aplicam tokens; HUB azul, Validades laranja e Pedidos verde
  compartilham tokens de dimensões/tipografia e portais; Pedidos usa a variante
  operacional compacta documentada, Em revisão visual.
- Models: ConfiguracaoDesign, RascunhoDesign, VersaoDesign e EventoDesign.
  Administrador ativo, revisão/base, motivo, idempotência e auditoria no servidor.
  Restaurar cria versão, não apaga histórico. Publicar tema não é deploy de código.

## Validar

Tarefas de UI usam a [skill de qualidade visual](../../.agents/skills/grazing-qualidade-visual/SKILL.md)
e a [matriz de intenções/checks](padroes.md#qualidade-visual-em-novas-telas).
Diagnóstico e limites desta adoção: [auditoria de 11/10](auditoria-qualidade-visual-2026-10-11.md).
Proteção executável: [Playwright, referências e aprovação](protecao-visual-automatizada.md).
Dívida histórica: [triagem individual dos 98 registros](triagem-desvios-2026-10-12.md).
Consolidação/publicação e evidências: [entrega de 12/10](validacao-protecao-visual-2026-10-12.md).
Revisão humana inicial: [galeria Linux de 13/10, 12 candidatas Em revisão](evidencias/2026-10-13-linux-candidatas/README.md).

`npm run lint:design` + testes do consumidor; testes/design-system quando base/token
mudar e testes/layout quando navegação mudar. Integração: DESIGN_BANCO_TESTE local.
Imagens com dados/ações fictícios; sem certificar acessibilidade ou hardware por inferência.
[Regras gerais de validação](../contexto/testes.md).

Consumidor Entregas: `src/components/entregas` compõe campos, seleção e resultado com primitives oficiais; `/vendas/area-entrega` usa Tabs, Card, Table, Dialog, StatusAtivo e barras oficiais, com salvamento explícito. Não acrescenta tokens ou variantes. Referência visual **Em revisão**; evidências e limites em [execução](../features/entregas/TASKS.md).
