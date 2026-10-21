# Auditoria e proteção de qualidade visual — 11/10/2026

Base de implementação: `origin/main` em `fedebea8`; branch própria
`codex/qualidade-visual-20261011`. O checkout principal estava em `codex/cardapio`,
com alterações documentais pendentes; foi preservado. Nenhuma tela, componente
de produto, CSS, token ou regra de negócio foi redesenhado nesta tarefa.

## Diagnóstico comprovado

A Central já tem componentes, tokens fechados, agrupamento, estados e orientações
de alinhamento. A lacuna principal é a cobertura das proteções e a ligação
operacional entre instruções, reutilização e validação visual; não é falta de uma
paleta nova. Não é possível atribuir retrospectivamente cada defeito relatado a
um agente ou commit sem identificar as telas/alterações específicas.

| Evidência no código vigente | Consequência |
| --- | --- |
| `scripts/regras-design.mjs`, `analisarDesign`, reconhecia nomes literais `Button/button` | Importar o Button como outro nome evitava regras de cor/geometria |
| A regra original procurava HEX, não paletas Tailwind ou constantes de classe | Cores locais como `bg-red-500` podiam passar |
| Controles nativos fora de `ui` não eram inventariados | Novas telas podiam duplicar controles sem exigir o padrão oficial |
| Lint tratava apenas `variant=editar/excluir`; Button também detecta texto de remoção | Um botão convertido em X pelo runtime podia escapar da regra de geometria |
| `Button` tem fallback genérico Editar/Excluir | Há nome básico, mas isso não identifica o item numa lista; contexto precisa de verificação |
| `AGENTS.md` encaminhava à documentação, sem uma skill de UI descoberta no repo | Fluxo de reutilização/validação não estava encapsulado por tarefa |
| `grupos.ts` mantém padrões Em revisão; `VALIDACAO.md` não declara aprovação humana | Capturas históricas não são um baseline pixel a pixel aprovado |
| Manual/inventário descreviam `BotaoRemoverItem` como ghost; código usa excluir | Instrução podia induzir uma reconstrução incorreta do componente |

O lint original passou em 8 componentes-base e 354 consumidores, apesar dessas
lacunas. Casos executáveis reproduzem aliases/namespaces, classes constantes,
cores locais e ícones aninhados. As novas proteções encontraram **98 ocorrências
estáticas históricas**, em 355 arquivos TSX inspecionados:

| Regra | Ocorrências |
| --- | ---: |
| Controle nativo fora da base UI | 74 |
| Ação compacta sem contexto explícito | 11 |
| Cor local de botão | 6 |
| Botão de ícone sem nome identificado estaticamente | 6 |
| Confirmar literal sem variante semântica | 1 |

São candidatos à revisão, não 98 defeitos visuais comprovados. Wrappers internos,
exceções legítimas e estados calculados exigem contexto. O baseline registra a
dívida sem reformar as telas aprovadas; não autoriza copiar seus desvios.

## Alterações integradas na branch

- Skill `.agents/skills/grazing-qualidade-visual`, com seleção implícita habilitada,
  fontes reais, consumidor equivalente, matriz de intenção, responsividade,
  estados, teclado/foco e evidências como critérios de conclusão.
- AGENTS.md passa a exigir a skill nas tarefas de interface. O manual continua
  dono dos contratos, sem uma biblioteca ou catálogo paralelo.
- `analisarQualidadeVisual` usa AST, resolução de imports e expressões estáticas
  conservadoras. Mantém `analisarDesign` e suas verificações anteriores.
- `lint:design` executa as duas verificações. Baseline identifica arquivo/regra/
  expressão e quantidade: duplicar ou mudar o desvio falha; linhas deslocadas
  não recriam a dívida. Ocorrências resolvidas exigem retirada da exceção, para
  barrar sua reintrodução. Nenhum comando atualiza o baseline automaticamente.
- Helper DOM `auditarInterface` verifica nomes/rótulos, overflow global,
  alinhamento das ações na mesma linha e alvos em ponteiro grosso. Permite wrap
  e rolagem interna; ignora o input do Base UI totalmente recortado por CSS.
- `test:design` e workflow GitHub Actions executam as proteções e testes sem
  ativar banco real. O workflow não faz deploy nem muda proteção da main.
- Corrigida a descrição ghost/excluir e removida a repetição literal da regra
  de alinhamento. Confirmar positivo novo reutiliza `entrada` verde;
  cancelamento operacional usa `saida` vermelho; fechar edição conserva
  `ghost/outline`; Salvar orçamento preserva `salvar` laranja.

## Conferência visual atual

Navegador do Codex, prévia Vite `design.vite.config.mts`, com fixtures e callbacks
sintéticos. Capturas novas são evidência desta auditoria, **Em revisão**, e não
aprovação automática. Passos observados:

1. Central, desktop de 1440 CSS px: carregamento, catálogo/estado e controles
   existentes inspecionados. Nenhuma alteração de aparência foi proposta.
2. Botões oficiais, temas claro/escuro: editar/excluir medidos em 36 × 36 CSS px,
   centros coincidentes e intervalo de 8px, com nome de item no DOM.
3. Exemplo aplicado em 390 e 320 CSS px: layout reorganiza a linha e mantém
   ações disponíveis; Tab entre editar/excluir mostrou o foco visível.
4. Central em 768 CSS px: moldura/lateral e exemplo inspecionados.

O helper no documento da Central retornou zero diagnósticos em 320/390/768 px.
Os controles da demonstração no iframe foram conferidos por nomes/retângulos e
teclado; o helper do pai não atravessa iframes automaticamente. Redimensionamento
de desktop manteve `pointer: coarse=false`: não equivale a teste de aparelho tátil.

Evidências em [evidencias/2026-10-11-qualidade](evidencias/2026-10-11-qualidade).
As capturas de viewport 05 e 06 mostram as ações sem emendar rolagens. Uma
captura longa com efeitos de cabeçalho fixo foi rejeitada e ficou nos temporários.

## Validações e limites

- Lint focado dos scripts/testes: passou. `lint:design`: 0 novos desvios.
- Suíte Design System: **113 passaram, 7 ignorados**, 15 arquivos passaram e
  um arquivo de integração ignorado. Os opt-ins de banco não foram ativados.
  Ajuste final de compatibilidade do helper com o navegador: **17/17** retestados.
- Baseline/CLI: **3/3** testes finais, incluindo acréscimo, resolução, retirada
  explícita da exceção e bloqueio da reintrodução.
- Typecheck completo: passou. Smoke da compilação: login 200, rota protegida
  sem sessão 307 para login, host desconhecido 421. Requisições somente locais,
  sem seguir o redirecionamento HTTPS para o ambiente real.
- Build webpack: passou, com os avisos de Edge Runtime de `jose` já presentes
  no código não alterado. Usou endereço fictício de banco local; sem dados reais.
- Skill avaliada por outro agente num cenário de faixas de entrega: escolheu
  os componentes e variantes esperados, preservando os cancelamentos contextuais.
- `quick_validate.py` não iniciou por ausência de PyYAML no Python disponível.
  Frontmatter/metadados/links foram verificados com o parser YAML já instalado;
  nenhuma dependência foi instalada por causa da documentação.

As verificações estáticas não resolvem wrappers arbitrários, classes inteiramente
dinâmicas, todas as combinações semânticas ou efeitos do CSS. O job CI roda lint
e testes, não captura screenshots por navegador. A skill exige essa etapa na
tarefa de UI; capturas e inspeção contextual continuam necessárias.

Não houve avaliação completa de todas as telas, leitor de tela, contraste sobre
vidro, dispositivo de toque ou persistência de domínio. Acessibilidade não está
certificada. Sem alteração de runtime, não existe diff visual a aprovar nesta
tarefa; o histórico não foi convertido em referência aprovada nem atualizado
para silenciar um teste. Atualizar main exige o fluxo de integração/publicação
do repositório; esta branch não publica o sistema.

Fontes da integração de skills: [documentação oficial de skills](https://learn.chatgpt.com/docs/build-skills)
e [padrão AGENTS + skills de repositório](https://developers.openai.com/blog/skills-agents-sdk).
