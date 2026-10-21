# Tabela de Porções

## Objetivo e comportamento

Criar `/porcoes` em Suprimentos, imediatamente abaixo de Insumos, para cadastrar
porções reutilizáveis por ingrediente. Cada porção tem insumo, quantidade equivalente
na unidade do cadastro e medida estruturada em Qtd. + Un. (por exemplo, 8 + fatias padrão).
Essa medida inteira representa **1 porção**. A imagem fornecida é referência
de conteúdo; seus dados não são importados e suas cores não substituem os tokens do HUB.

A página usa conteúdo centralizado com largura máxima e campos proporcionais. Permite
buscar, criar, editar mediante confirmação explícita e remover pelo X oficial com
confirmação. Os componentes e regras seguem [Design](../../design-system/README.md).

Desde 04/10/2026, criar e editar abrem o mesmo popup a partir das ações da tabela,
mantendo os campos equivalentes. Busca e ordenação A–Z/Z–A de categorias e insumos
não gravam dados. Ordenar categorias abre a lista arrastável oficial, também operável
pelo teclado; Salvar ordem persiste uma sequência exclusiva desta tabela, exigindo
editar em `suprimentos.porcoes`, com revisão, transação e auditoria. Não altera Produtos
ou composições existentes. Apenas o alerta central de descarte se sobrepõe ao popup.
O popup de ordenação inclui apenas categorias com alguma porção não removida, sem
depender da busca. Preserva ordem/versão das demais categorias; servidor exige o conjunto
completo das participantes atuais e recusa uma lista desatualizada.

Em preparações e produtos, a linha segue Ingrediente > Porção > Descrição > Qtd. > Custo.
Porção é o multiplicador numérico livre. Digitar 1, 0,5, 2 ou outra fração positiva
aplica a medida base cadastrada e recalcula Descrição, consumo e custo. Descrição é
somente leitura, sem seletor. Novas referências usam a primeira medida vigente por
`createdAt`/`id`; composições com snapshot preservam a base original. Carregar as bases
não altera automaticamente fichas legadas. Sem medida cadastrada, Qtd. direta permanece
habilitada. Qtd. é o consumo efetivo, com unidade fixa dentro do campo e custo discreto
em coluna própria, sem caixa editável. O nome do ingrediente não tem tipo nem unidade, inclusive durante foco.
Editar Qtd. diretamente limpa referência e descrição, mantendo o valor digitado.
Em produtos, FM é um botão compacto com tooltip e aria-pressed para a ficha de montagem;
alterar só o FM conserva o consumo e exige Salvar. Qtd. manual tem três casas e aceita
,5 completando para 0,5; Porção também. Conversões/histórico preservam precisão exata.
Limpar Porção mantém o consumo convertido. Cadastro exclusivamente na Tabela de Porções.

Cada composição guarda a referência estruturada e o multiplicador em `porcao` (JSON),
a quantidade efetiva em `quantidade` e a medida resultante em `observacaoPorcao`.
Editar/remover uma referência do catálogo não muda fichas salvas. Registros históricos
sem referência mantêm seus textos e quantidades; não inferir uma porção pela composição.

## Arquitetura e controles

- `src/app/(protegido)/porcoes`: página, tabela e ações autorizadas no servidor.
- `src/lib/insumos/porcoes.ts`: contrato e limites compartilhados.
- `src/components/campo-numero-porcoes.tsx` e `insumos/composicao-picker.tsx`:
  multiplicadores livres e base automática compartilhados por Insumos e Vendas.
- `PorcaoInsumo`: quantidade decimal, unidade de origem, nome normalizado, revisão e
  exclusão lógica; histórico de alterações em transação. Migration SQL manual/aditiva.
- Recurso `suprimentos.porcoes` para visualizar/adicionar/editar/excluir; leitura das
  opções também respeita acesso às composições de Insumos/Produtos. Recursos novos
  não concedem acesso automaticamente aos perfis comuns.
- Unidade livre até 100 caracteres, nome derivado até 120; quantidade positiva, até nove casas decimais e menor que
  um bilhão. Não presumir conversão entre unidades. Porções de unidade antiga não são
  aplicadas após mudar o cadastro. Duplicata idêntica não cria outro registro; mesmo
  nome com quantidade diferente exige edição explícita.

## Aceite e limites

Testar cadastro, edição, exclusão, autorização, concorrência, auditoria, precisão e
preservação dos snapshots. Conferir digitação/colagem, seleção, mudança de quantidade,
salvamento explícito, erros e respostas atrasadas; conferir desktop e celular com
dados fictícios. Novas referências visuais permanecem Em revisão humana.

Não inclui cálculo de rendimento a partir do nome, conversão
automática de unidades ou atualização de fichas existentes. Publicação autorizada
pelo usuário nesta conversa, após validação e backup conforme o ritual de deploy.

Mapas: [Insumos](../../modulos/insumos.md), [Vendas](../../modulos/vendas.md),
[Banco](../../contexto/banco-de-dados.md). Etapas e evidências: [TASKS](TASKS.md).

## Evolução de 02/10/2026 — medidas multiplicáveis

Migration aditiva `20261002230000_porcoes_multiplicaveis` separa somente o prefixo
numérico explícito dos nomes antigos (8 fatias padrão → 8 + fatias padrão), conservando
nome, unicidade e quantidade equivalente. Nomes livres continuam como 1 medida.
A multiplicação usa inteiros escalados no cliente/servidor. Resultado com mais de 9
casas, overflow ou perda no transporte numérico é recusado, sem arredondar estoque.
Servidor confere quantidade derivada e unidade; custo e estoque continuam consumindo
a quantidade efetiva existente. Referências visuais permanecem Em revisão humana.
