> PROPOSTA HISTÓRICA — não é especificação integralmente implementada.
> Origem: README do Design System em 2fac409; conteúdo preservado abaixo.
> Consultar [índice vigente](README.md) e código para o estado atual.

# Grazing Design System

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Projeto da Central de Design

**Status:** Etapas 4 e 5 — publicação auditável e adoção dos componentes-base concluídas em 21/09/2026.
Os valores publicados continuam restritos ao registro tipado; as exceções e a regra de revisão
da adoção estão em [adocao-etapa-5.md](./adocao-etapa-5.md).
Base: inspeção do código atual, prévias locais com dados fictícios e preferência de responsável autorizado por editor visual com prévia e publicação controlada.

Um único lugar para consultar, experimentar e manter a linguagem visual do Grazing HUB.
Não é uma landing page comercial nem uma biblioteca de imagens: é uma área interna,
com exemplos dos componentes reais utilizados na operação e configurações versionadas.

### Documentação organizada

- [Manual de padrões: estética, componentes e interações](./padroes.md)
- [Arquitetura do editor, segurança e publicação](./arquitetura.md)
- [Plano de adoção e critérios de entrega](./implantacao.md)
- [Inventário rastreável dos padrões atuais](./inventario.md)
- [Referência inicial e navegação aprovada](./referencia-inicial.md)
- [Adoção dos componentes-base e exceções](./adocao-etapa-5.md)

## 1. Acesso recomendado

**Grazing HUB → Configurações → Central de Design**

Endereço proposto: `https://grazinghub.com.br/configuracoes/design`.
Mesmo projeto, backend, autenticação e banco. Sem domínio, aplicação ou login novos.
O subdomínio de Etiquetas consome o tema publicado, mas não hospeda administração global.
Inicialmente a central inteira fica restrita a administradores ativos, com validação no servidor.
Delegação de consulta/edição/publicação pode ser uma etapa posterior, sem conceder direitos silenciosamente.

### Navegação aprovada

A Central de Design será um item expansível na lateral existente de Configurações. **Fundamentos**,
**Componentes** e **Gestão** aparecerão abaixo dele, na mesma lateral; não haverá segunda coluna lateral.
Ela preserva a largura, a tipografia e o glassmorphism atuais do HUB. O padrão poderá ser reutilizado
em Inventário, mas não autoriza reorganizar outros módulos. A rota e a permissão próprias existem e
são restritas a administradores no servidor; ver [referência inicial](./referencia-inicial.md).

## 2. Organização da central

| Grupo | Conteúdo e controles |
| --- | --- |
| Visão geral | Versão publicada, rascunho atual, atalhos por categoria, pendências verificáveis e mudanças recentes |
| Identidade e temas | HUB azul, Etiquetas laranja, claro/escuro, marca e usos corretos dos logos |
| Cores e estados | Fundos, textos, bordas, ação primária, sucesso, atenção, erro, contraste |
| Tipografia e conteúdo | Famílias permitidas, tamanhos, pesos, entrelinhas, hierarquia, números e mensagens |
| Layout e alinhamento | Largura lateral, cabeçalho, grades, margens, espaçamento, densidade e responsividade |
| Superfícies e efeitos | Glassmorphism, opacidade, blur, bordas, sombras, elevação e animações |
| Botões e ações | Hierarquia, formatos, dimensões, ícones, hover, pressionado, foco, carregamento e bloqueio |
| Campos e formulários | Texto, moeda, quantidade, data, ajuda, obrigatoriedade, validação e erros |
| Seleção e multisseleção | Listas simples, busca, grupos, opções secundárias, chips, limpeza e teclado |
| Navegação e sobreposições | Menus, abas, diálogos, painéis, popovers, tooltips e retorno do foco |
| Dados e feedback | Tabelas, filtros, ordenação, paginação, badges, alertas, vazios e carregamento |
| Padrões de tela | Listagem, cadastro, detalhes, confirmação, fluxo guiado e leitura operacional |
| Acessibilidade e qualidade | Verificações automáticas e checklist manual, sem falsa certificação |
| Versões e publicação | Comparação, aprovação, publicar, restaurar e histórico de autoria |

Cada grupo tem endereço próprio e busca por nome e sinônimos: por exemplo,
“caixa de seleção”, “lista”, “dropdown” e “select” levam ao mesmo assunto.
Conteúdos de exemplos usam dados fictícios identificados; não alteram cadastros reais.

## 3. Como deve ser a página

Usar a estrutura existente do HUB: menu lateral com a mesma largura, cabeçalho e
tipografia atuais. Dentro da lateral de Configurações, Central de Design expande seus grupos;
no celular, a mesma árvore aparece no menu móvel, sem criar uma segunda lateral fixa.

Na página inicial, apresentar busca e índice de categorias, versão vigente e acesso
ao rascunho. Evitar banner publicitário, grandes títulos decorativos ou números de
“qualidade” sem medição real. A identidade é a do produto, não uma marca concorrente.

Na página de cada padrão:

1. **Regra:** finalidade, quando usar e quando não usar.
2. **Exemplos reais:** componentes interativos com todas as variantes relevantes.
3. **Editor:** controles nomeados em português, unidades e limites compreensíveis.
4. **Estados:** normal, foco, hover, ativo, selecionado, desabilitado, carregando e erro.
5. **Onde se aplica:** componentes conectados e telas verificadas; pendências separadas.
6. **Acessibilidade:** resultados automáticos e testes manuais ainda necessários.
7. **Histórico:** o que mudou, por quem, quando e por quê.

Em desktop, editor e prévia ficam lado a lado. Em telas menores, ficam em abas.
Uma barra persistente identifica **Rascunho — não publicado**, versão de origem,
estado do salvamento, Desfazer, Restaurar este campo e Revisar publicação.

## 4. Experiência de edição

Exemplo: responsável autorizado quer reduzir o arredondamento dos botões.

1. Abre Botões e ações → Formato.
2. Altera o controle visual de arredondamento, dentro de limites seguros.
3. Vê imediatamente botões, formulário e tabela de demonstração com o novo formato.
4. Compara HUB/Etiquetas e claro/escuro sem alterar sua preferência pessoal de aparência.
5. A central mostra os componentes conectados à mudança e as verificações pendentes.
6. Salva um rascunho. O restante da operação continua na versão publicada.
7. Em Revisar publicação, confere diferenças e informa o motivo.
8. Confirma **Publicar para todos**. A nova versão passa a valer sem editar cada tela.
9. Se necessário, restaura uma versão anterior pelo histórico, com nova confirmação.

Salvar rascunho nunca equivale a publicar. Restaurar um campo não restaura o sistema.
“Publicar tema” é diferente de fazer deploy de código; ver limites em Arquitetura.

## 5. Uma base, duas identidades

| Compartilhado entre HUB e Etiquetas | Específico do tema |
| --- | --- |
| Fonte, escala de tamanhos e pesos | Paleta azul ou laranja |
| Largura lateral e estrutura responsiva | Logo e título da identidade |
| Alturas, alinhamentos e espaçamento | Cores das superfícies e seus estados |
| Formato e comportamento dos controles | Pares de cores de claro/escuro |
| Teclado, foco e acessibilidade | Usos aprovados da marca |

Por padrão, editar estrutura/tipografia afeta os dois contextos. A tela deve informar
isso antes de publicar. Editar a cor do tema HUB não transforma Etiquetas em azul.
Não criar exceções de dimensões por marca: a igualdade de largura e fontes foi pedida expressamente.

## 6. O que a inspeção encontrou

Inventário inicial, não uma auditoria visual completa nem declaração de conformidade. A relação
rastreável entre código, prévias verificadas e pendências está em [inventario.md](./inventario.md):

- `src/app/globals.css` já contém cores semânticas, escala tipográfica, temas,
  superfícies de vidro e alternativas de movimento/transparência/contraste.
- `src/components/ui/` reúne os controles compartilhados, apoiados em Base UI.
- Botões, campos, seleção, combobox, multisseleção, diálogos e a lateral consomem
  tokens de fábrica tipados. O editor os aplica apenas ao iframe do laboratório.
- Seleção simples usa superfície de vidro; combobox usa fundo de popover e
  tratamento próprio de borda/sombra. Isso pede uma decisão visual comum documentada.
- `MultiselecaoCombobox` já preserva IDs, pesquisa sem acento e mostra chips removíveis.
  Aproveitar essa implementação; não criar multisseleção paralela só para a central.
- `Dialog` já protege alterações não salvas. Preservar esse comportamento.
- Existem medidas locais como 10px em descrições de chips e 13px em tabelas.
  Inventariar usos e migrar gradualmente, sem uma substituição global cega.
- `ConfiguracaoLoja` é singleton; não foi encontrado um registro de versões de design
  nos trechos de schema inspecionados. O editor persistente exige estrutura própria de configuração.
- A fonte atual no código é a nativa do sistema. Há referência antiga a Poppins na
  documentação; consolidar o manual a partir do código e das decisões atuais.

## 7. Decisões recomendadas

- Central dentro do sistema, não landing page pública.
- Componentes reais na documentação, não réplicas de demonstração.
- Editor visual de propriedades permitidas, sem campo livre de CSS/JavaScript.
- Prévia isolada com dados fictícios; rascunhos nunca chegam aos operadores.
- Publicação versionada, transacional e reversível.
- Manter o desenho atual como versão inicial, antes de refiná-lo.
- Unificar primeiro a base; só prometer atualização global para componentes já conectados.
- Não alterar permissões de negócio, cálculos, dados fiscais nem impressão física por um tema.

## 8. Limite da entrega atual

Esta etapa entrega consulta, busca, demonstrações isoladas, registro fechado de tokens,
validação, compilação determinística e rascunho persistente. Cada publicação requer motivo,
revisão atual e confirmação, cria uma versão imutável e registra auditoria. Os componentes do
laboratório recebem somente dados fictícios; a operação recebe apenas a versão publicada.

O próximo marco é adotar a base gradualmente nos módulos restantes, sem ampliar os valores
aceitos pelo registro sem código, teste e deploy; ver [plano de adoção](./implantacao.md).
