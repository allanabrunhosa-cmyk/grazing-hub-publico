# Plano de adoção e critérios de entrega

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

[Voltar à Central de Design](./README.md)

**Status:** Etapas 1 a 5 foram concluídas em código em 21/09/2026.

## Etapa 1 — Inventário e referência inicial

Mapear componentes, variantes, tokens existentes e estilos locais nos módulos.
Registrar uma versão inicial que reproduza a interface atual, incluindo HUB/Etiquetas
e claro/escuro. Não aproveitar essa migração para redesenhar todas as telas.

Classificar cada padrão como observado, documentado, conectado ao editor, testado ou
pendente. “Documentado” não significa que todos os seus usos já estejam centralizados.
Não exibir percentual de cobertura sem denominador e inventário rastreável.

Referências de código já inspecionadas:

- `src/app/globals.css`
- `src/app/layout.tsx` e `src/app/(protegido)/layout.tsx`
- `src/components/ui/button.tsx`, `select.tsx`, `combobox.tsx`, `dialog.tsx`
- `src/components/multiselecao-combobox.tsx`
- `src/lib/permissoes/catalogo.ts` e `servidor.ts`
- `prisma/schema.prisma`: `ConfiguracaoLoja` singleton

Entregas desta etapa:

- `docs/design-system/inventario.md`: origem, valores observados, usos, divergências, riscos e pendências.
- `docs/design-system/referencia-inicial.md`: aparência de fábrica e navegação aprovada, sem alterar a interface.
- Prévia local do HUB e de Etiquetas conferida com dados fictícios; temas escuros, teclado, contraste composto e leitor de tela permanecem pendentes de validação explícita.

Decisão de navegação aprovada para a etapa 2: **Central de Design** será um item expansível na
lateral existente de Configurações, com **Fundamentos**, **Componentes** e **Gestão** abaixo dele.
Não haverá segunda lateral. O padrão poderá ser reutilizado em Inventário para seus cinco links
existentes, mantendo as permissões específicas. A rota `/configuracoes/design` e a permissão
`configuracoes.design` ainda não existem; não reutilizar permissões atuais sem implementação e
teste no servidor.

## Etapa 2 — Central navegável e laboratório

**Status: implementada em código; sem valores editáveis, persistência ou publicação.**

Adicionar rota administrativa, entrada em Configurações, índice, busca e páginas por
grupo. Exemplos importam os componentes operacionais e usam dados fictícios.
Implementar comparação, troca de tema da prévia e estados dos componentes.

Implementação entregue:

- Rotas protegidas de administrador em `/configuracoes/design`, com páginas próprias para
  Fundamentos, Componentes e Gestão; a rota `/laboratorio` é o documento same-origin usado
  exclusivamente pelos iframes.
- Entrada expansível na lateral de Configurações, reaproveitada no menu móvel. O nome abre a
  visão geral; o controle adjacente expande/recolhe os filhos, informa `aria-expanded` e aceita
  Escape para recolher. A página ativa é indicada no item correspondente.
- Busca local por nome e termos, referência versus pendência e prévia com identidade HUB ou
  Etiquetas, modo claro/escuro e estados normal, foco, desabilitado, erro e carregando.
- Comparação entre a referência HUB clara e o experimento. A comunicação com o iframe valida
  origem exata, janela emissora e formato da mensagem; não transmite credenciais nem dados reais.

Não foram criados Server Actions, tabelas, migrations, tokens editáveis, rascunhos ou publicação.
O recurso `configuracoes.design` não entra nos perfis nem em exceções: a autorização é exclusiva
do campo administrativo verificado no servidor.

Critério: usuário encontra um padrão por nome, interage com os exemplos e entende
o que é publicado versus experimental. Nenhuma demonstração grava operações reais.

## Etapa 3 — Tokens editáveis sem regressão

**Status: implementada em código; sem persistência nem publicação.**

Criar registro tipado, validação e compilação de variáveis. Migrar primeiro botões,
inputs, seleção simples, combobox, multisseleção, diálogos e layout compartilhado.
Preservar a API dos componentes existentes e a aparência da configuração de fábrica.

Adicionar controles visuais limitados e restauração por campo/grupo.
Manter os padrões de comportamento no código, não em CSS livre no painel.

Critério: alterar um token de laboratório modifica todos os exemplos conectados;
o sistema operacional permanece igual enquanto o rascunho não for publicado.

Implementação entregue:

- Registro tipado e fechado em `src/lib/design-system/registro.ts`, com valores de fábrica,
  grupos, rótulos e opções permitidas.
- Validação estrita, resolução e serialização determinística em `validacao.ts`,
  `resolver-tema.ts` e `gerar-css.ts`; não existe entrada de CSS livre.
- Botões, inputs, textarea, seleção simples, combobox, multisseleção, diálogos e largura
  lateral passaram a consumir as variáveis de fábrica, preservando suas APIs públicas.
- O editor permite somente escolhas registradas e restauração por campo ou grupo. A mensagem
  same-origin aplica os valores apenas no iframe de laboratório, inclusive nos portais.
- Testes unitários cobrem defaults, limites, serialização e restauração. A verificação visual
  completa de todos os modos e preferências ainda pertence ao roteiro manual.

## Etapa 4 — Rascunhos, versões e publicação

**Status: implementada em código, com migration manual aditiva.**

Migration manual aditiva para configuração/auditoria de design; backup antes de
aplicá-la em produção. Não modificar cadastros, dados fiscais ou migrations existentes.
Implementar concorrência, idempotência, revisão, publicação, cache e restauração.

Critério: administrador consegue editar, salvar rascunho, revisar, publicar e restaurar.
Um usuário sem autorização não consegue fazê-lo por chamada direta ao servidor.
Publicação tem autoria e motivo; falha ou timeout não deixa uma versão parcialmente aplicada.

Implementação entregue:

- Migration `20260921200000_design_system_versoes` cria configuração única, rascunho compartilhado,
  snapshots imutáveis e eventos de auditoria, sem migrar valores operacionais.
- As Server Actions relêem a sessão administrativa, validam todos os valores no servidor e usam
  trava transacional, revisão otimista e chave de idempotência para publicação/restauração.
- A página mostra versão operacional, rascunho, motivo obrigatório, histórico e restauração como
  nova versão. Salvar rascunho não modifica operadores; publicar revalida o layout raiz.
- A versão publicada é emitida no HTML inicial e uma aba aberta apenas oferece atualização ao
  detectar revisão nova ao foco ou na verificação periódica. Não desmonta formulários em curso.

## Etapa 5 — Adoção nos módulos

Revisar Suprimentos, Financeiro, Produção/Etiquetas e Configurações por famílias de
componentes. Trocar medidas locais somente após comparar propósito e comportamento.
Criar regra de revisão/lint para impedir novos valores soltos em controles já cobertos,
com exceções explícitas para impressão, gráficos e layouts de domínio quando necessárias.

**Concluída em 21/09/2026.** A adoção transversal está registrada em
[adocao-etapa-5.md](./adocao-etapa-5.md): componentes-base vinculados, exceções explícitas
e a regra npm run lint:design. O padrão é global apenas para as famílias compartilhadas ali
listadas; impressão, gráficos e layouts de domínio continuam locais até revisão própria.

## Matriz mínima de testes

| Área | Verificação |
| --- | --- |
| Tokens | Defaults preservados, tipos/limites, herança de marca e modo, rejeição de valores inválidos |
| CSS | Serialização determinística, nenhuma injeção/URL externa, ordem correta e portais |
| Editor | Desfazer, restaurar campo/grupo, rascunho sujo, erro de salvamento e saída com alterações |
| Publicação | Confirmação, motivo, autorização, transação, idempotência, concorrência e auditoria |
| Restauração | Nova versão auditada, compatibilidade de schema e recuperação com tema de fábrica |
| Temas | HUB azul e Etiquetas laranja; dimensões/tipografia iguais em ambos |
| Campos | Rótulos, ajuda/erro associados, foco, dados preservados, alinhamento e tamanhos |
| Seletores | Abertura, colisão, pesquisa, itens longos, vazio/erro, seleção, teclado e foco |
| Multisseleção | IDs estáveis, preservação durante busca, chips, remoção, muitas opções e Escape |
| Diálogos | Ordem do foco, Escape por camada, retorno, proteção contra descarte e submit aninhado |
| Acessibilidade | Contraste, teclado, leitor de tela, zoom/reflow, alto contraste e preferências reduzidas |
| Negócio | Não muda valores, precisão, autenticação, permissões, estoque ou regras fiscais |
| Impressão | Tema não altera prévia física/ZPL/DPI; hardware continua uma homologação separada |
| Operação | Sem rascunho vazando; atualização não apaga formulário nem desmonta interação em curso |

Comparar capturas com viewport, tema, estado e dados de teste iguais. Testes de DOM
não comprovam acabamento visual; screenshots não comprovam operação por teclado.
Verificações automatizadas não substituem testes manuais de leitor de tela.

## Validação antes de publicar código

Seguir o [ritual de deploy vigente](../contexto/deploy.md): migration manual quando aplicável,
Prisma validate/generate, TypeScript, lint dos arquivos alterados, testes relacionados,
build de produção, backup e preservação das configurações fiscais necessárias ao deploy.
Confirmar o estado atual da infraestrutura nessa etapa, sem repetir comandos antigos cegamente.

O checkout da inspeção inicial tinha mudanças paralelas em NFS-e e CONTEXTO.md.
Em cada retomada, conferir o status atual e preservar mudanças alheias; não presumir
que aquele estado histórico permanece nem incluí-las no commit da central por acidente.

## Critérios de aceite para responsável autorizado

1. Consigo entrar pela área Configurações sem outro login.
2. Encontro Botões, Tipografia, Seleção e Multisseleção em grupos claros.
3. Altero um valor visual sem escrever código e vejo uma prévia antes de publicar.
4. A prévia mostra componentes reais, inclusive listas abertas e diálogos.
5. HUB e Etiquetas mantêm suas cores, mas compartilham tamanhos e estrutura.
6. Salvar rascunho não muda a tela dos operadores.
7. Antes de publicar, vejo alcance e diferenças da alteração.
8. Posso restaurar uma versão anterior sem perder o histórico.
9. A operação, os cadastros, a impressão e os cálculos não mudam com o tema.
10. A central informa honestamente quais componentes já obedecem ao padrão e quais faltam migrar.

## Fora da entrega atual

Não houve teste de hardware nem auditoria visual completa. Componentes e telas que usam estilos
locais fora das famílias adotadas continuam exigindo revisão por fluxo. Não publicar notas de
teste no Kairu sem relato real, prévia do comentário e autorização específica do usuário.
