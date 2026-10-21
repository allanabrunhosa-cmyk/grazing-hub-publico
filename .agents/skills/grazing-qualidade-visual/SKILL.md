---
name: grazing-qualidade-visual
description: Criar, alterar ou revisar telas, formulários, tabelas e componentes do Grazing HUB usando sua Central de Design, padrões reais e validação visual. Aplicar em tarefas de interface; não em mudanças exclusivamente de servidor ou documentação sem impacto visual.
---

# Qualidade visual do Grazing HUB

Preserve a aparência e o comportamento das telas atuais usadas como referência pelo usuário.
Não redesenhe telas, invente uma biblioteca paralela ou migre consumidores fora do pedido.

## Antes de editar

1. Leia o AGENTS.md aplicável, [índice visual](../../../docs/design-system/README.md)
   e as seções pertinentes do [manual](../../../docs/design-system/padroes.md).
   Consulte o [inventário](../../../docs/design-system/inventario.md) para consumidores e exceções.
2. Encontre uma tela equivalente e sua implementação. Registre componente reutilizado,
   variante, token, agrupamento e consumidor de referência. Se houver referência visual
   indicada pelo usuário, capture o mesmo estado/largura/tema antes da alteração.
3. Confira código e contrato vigente: observações históricas não prevalecem sobre
   os contratos atuais. Capturas antigas e catálogo **Em revisão** não são aprovação humana.
4. Escolha composição com componentes existentes antes de criar um componente. Para uma
   necessidade não atendida, explique a lacuna e acrescente a variante ao componente,
   catálogo tipado, demonstração e testes pertinentes; mantenha-a **Em revisão**.

## Reutilização obrigatória no contexto equivalente

- Controles: `src/components/ui`, `campo-busca.tsx`, `input-com-sufixo`,
  `status-ativo.tsx`, `remover-item.tsx`, `lista-ordenavel.tsx`.
- Ações: `GrupoAcoes`, `BarraAcoes`, `AcoesEdicao` e `EdicaoInline` de
  `src/components/padroes-operacionais.tsx`. Não salve ao perder foco.
- Cores/geometria: `src/lib/design-system/registro.ts`, `buttonVariants` e
  `src/app/globals.css`. Não fixe cores de marca, altura, raio ou margens compensatórias
  em botões por tela. Cores de canal/status de domínio têm contratos próprios.
- Layout: mesma grade entre títulos e linhas; mesma altura/eixo entre campo/seletor/botão;
  reserva uniforme para rótulos longos, mensagens e ações. Use quebra responsiva,
  `min-w-0` e rolagem interna de tabelas conforme o manual.

## Intenção e variantes reais

Siga [a matriz vigente](../../../docs/design-system/padroes.md#qualidade-visual-em-novas-telas).
Confirmação positiva nova usa verde `Button variant="entrada"` (tokens `success`).
Não confunda a cor de confirmação com sucesso já persistido: aguarde a resposta.
Salvar orçamento conserva `variant="salvar"` laranja; navegação conserva identidade da marca.
Excluir/remover usa o X oficial `variant="excluir"` ou `BotaoRemoverItem`, com fundo vermelho pastel fixo e efeito no hover.

Remoções pequenas, como foto ou seleção de formulário, podem usar `BotaoRemoverItem discreto` / `Button variant="excluir-discreto"`: X cinza e fundo transparente. Fechar janela mantém X cinza. A variante está Em revisão visual.

Cancelar edição e fechar pelo botão Cancelar usam a variante neutra `outline`, conforme o pedido mais recente de 13/10/2026.
Confirmação de cancelamento operacional conserva `variant="saida"` e seu texto.
Fechar por X conserva a ação secundária aprovada. Salvar conserva a semântica do domínio.
`AcoesEdicao destacarAlterado` já oferece check verde quando há alteração pendente;
preserve o estado e a reserva geométrica dos consumidores existentes.

## Verificar antes de concluir

1. Execute `npm run lint:design`, os testes do consumidor e os comandos proporcionais
   de `docs/contexto/testes.md`. Contrato/base alterado exige consumidores de outros domínios.
   `npm run test:design` cobre as proteções do Design System sem banco real.
2. Use a prévia Vite isolada correspondente em `testes/visual`; dados e callbacks
   fictícios. Não conecte a prévia a ações, credenciais ou bancos reais.
   Execute `npm run test:visual:contratos` quando o componente fundamental for afetado;
   acrescente teste do consumidor quando a mudança não estiver coberta pela fixture.
   Consulte o [fluxo automatizado](../../../docs/design-system/protecao-visual-automatizada.md).
3. Capture e inspecione em 320/390, 768 e 1440 CSS px quando pertinentes, claro/escuro,
   conteúdo longo e estados normal, pendente/desabilitado, vazio e erro. Confira
   alinhamento, overflow, quebra, texto/ícones, foco e alvos de toque.
4. Execute `auditarInterface(document)` de `scripts/auditar-interface.mjs` na prévia,
   pelo runner de testes/navegador disponível. Registre seus diagnósticos; é uma
   verificação parcial de nomes/rótulos, overflow, agrupamento e alvos.
   Inspecione teclado (Tab/Enter/Escape), foco/retorno em diálogos, mensagens e contraste
   composto. DOM/capturas isolados não certificam WCAG nem leitor de tela.
5. Compare com a referência no mesmo estado/largura/tema. `scripts/comparar-design.mjs`
   compara pixels e nunca atualiza a referência. Toda diferença exige inspeção.
   Não altere o baseline visual ou `desvios-baseline.json` só para obter resultado verde.
   Execute `npm run lint:visual:referencias` e `npm run test:visual:referencias` para gerar
   capturas por seção e comparações. O registro `docs/design-system/referencias-visuais.json`
   começa sem referências aprovadas; catálogo/capturas **Em revisão** não são aprovação.
   O CI compara aprovadas no container fixado e gera actual/expected/diff quando divergem.
   Capturas consultivas não devem ser descritas como comparação aprovada. Não execute
   `--update-snapshots`, não aprove referências nem publique comentário de aprovação
   em nome do responsável. Registre a decisão humana e seu commit exato pelo fluxo.
6. Informe o que foi reutilizado, comandos/resultados, capturas inspecionadas e limites.
   Etapa não executada é pendência explícita. Não declare uma tela visualmente validada
   usando apenas lint, build, jsdom ou capturas de outro commit.

O baseline estático é dívida histórica para adoção gradual, não permissão para copiar
um desvio nem aprovação das telas. Novos nós/ocorrências são bloqueados; correções reduzem
o baseline por revisão explícita, sem renovar a dívida automaticamente.
