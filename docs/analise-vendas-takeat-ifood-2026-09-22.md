# Vendas — análise Takeat/iFood e revisão do plano

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Data: 22/09/2026. Situação: análise concluída por amostragem; desenvolvimento autorizado posteriormente por responsável autorizado. Acompanhar execução em `docs/execucao-vendas.md`.

## 1. Decisões do negócio

- O iFood é a referência para a organização comercial inicial, e não a estrutura do site.
- Produtos padrão e personalizados serão produtos separados. Não haverá um seletor “padrão/personalizar” dentro do mesmo produto para representar esses cadastros.
- Tamanhos e versões vegetarianas que existem como produtos separados no iFood continuarão separados no HUB. Uma família poderá agrupá-los para relatórios, sem eliminar suas identidades comerciais.
- Decisão final de responsável autorizado após a análise: Extras é opcional e **sem limite máximo**, com o mesmo padrão em todos os produtos. O cadastro de grupos como Extras deve ter edição centralizada e prática. Esta decisão substitui a pendência de revisão de limites registrada na análise inicial.
- Takeat será referência para levantamento fiscal e comparação operacional, não uma fonte fiscal presumidamente correta.
- Esta etapa apenas consultou os sistemas: nenhum produto, preço, limite ou cadastro fiscal foi salvo ou alterado.

## 2. Fontes e alcance

Consulta autenticada às interfaces:

- [iFood — Cardápio](https://portal.ifood.com.br/menu/list), loja “Tábua de Frios - Grazing Table & Co”.
- [Takeat — Cardápio](https://dashboard.takeat.app/register/menu), loja “Grazing Table & Co”.
- [Takeat — Vínculos fiscais](https://dashboard.takeat.app/register/fiscal).
- [Takeat — Grupos fiscais](https://dashboard.takeat.app/fiscal/groups).

Foram examinados produtos padrão, personalizados, vegetarianos, produto com quantidade obrigatória, extras, Empório e bebidas. Foram abertos os grupos fiscais de produção e revenda e o formulário de um produto. Não foi feita exportação integral, teste de compra, emissão fiscal, nem validação de APIs de integração. Informações abaixo são observações do cadastro na data da consulta, não garantia sobre o comportamento de todos os produtos.

## 3. Organização comercial observada

Categorias do iFood, na ordem e grafia exibidas:

1. Grazings Mais Queridas
2. Granzing Confraternização
3. Monte a sua Grazing
4. Café da Manhã
5. Sanduiches & Aperitivos
6. Tortas e Folhados
7. Doces
8. Não Alcoólicos
9. Vinhos e Espumantes
10. Cervejas e Licores

Contagens verificadas nas categorias examinadas: Grazings Mais Queridas, 9; Granzing Confraternização, 4; Monte a sua Grazing, 7; Sanduiches & Aperitivos, 11. Não representam uma contagem integral de todo o catálogo.

“Monte a sua Grazing” apresenta as versões para 1, 2 e 3 pessoas, suas respectivas vegetarianas, e a personalizada para 4. Não foi observada uma personalizada vegetariana para 4 nessa categoria; não criar automaticamente uma combinação inexistente.

### Regras de escolha verificadas

Cada célula informa mínimo–máximo de escolhas do grupo. “—” significa que o grupo não está presente no produto analisado.

| Grupo | Padrão para 1 | Personalizada para 1 | Personalizada vegetariana para 1 | Personalizada para 4 |
| --- | --- | --- | --- | --- |
| Embalagem | 1–1 | 1–1 | 1–1 | 1–1 |
| Charcutaria | — | 2–2 | — | 4–4 |
| Queijo | — | 2–2 | 4–4 | 4–4 |
| Antepasto | — | 1–1 | 1–1 | 2–2 |
| Frutas Frescas | — | 1–1 | 1–1 | 2–2 |
| Pães e Cracker | — | 1–1 | 1–1 | 2–2 |
| Pasta | — | 1–1 | 1–1 | 2–2 |
| Extras | 0–99 | 0–99 | 0–100 | 0–3 |
| Empório | 0–99 | 0–99 | 0–99 | 0–99 |
| Bebidas | 0–99 | 0–99 | 0–99 | 0–99 |

Os limites da linha Extras são apenas o estado encontrado na origem. No HUB, a decisão posterior é mínimo zero e máximo ilimitado para todos os produtos que usam Extras. Empório e Bebidas também devem aparecer na prévia de revisão, sem alteração automática.

Na personalizada para 1 foram observadas 6 opções de charcutaria, 8 de queijo, 5 de antepasto, 3 de frutas, 5 de pães/crackers, 7 de pasta, 38 Extras, 6 itens de Empório e 15 bebidas. As escolhas de composição têm preço adicional zero, mas isso não significa custo zero. Empório e Bebidas aparecem como grupos de venda complementar (Cross-sell).

O produto padrão para 1 não possui os grupos de escolha dos ingredientes: tem composição fixa e os grupos Embalagem, Extras, Empório e Bebidas. A versão vegetariana personalizada tem quatro escolhas de queijo e não tem Charcutaria. Portanto, não basta ocultar carnes de uma configuração universal.

### Preço formado por uma escolha obrigatória

“Pães de queijo com crosta parmesão” tem preço-base R$ 100,00 (exemplo sintético) no iFood e grupo obrigatório “Quantidade de pães de queijo”, mínimo 1 e máximo 1:

- 40 unidades: R$ 100,00 (exemplo sintético); código PDV 32.
- 80 unidades: R$ 100,00 (exemplo sintético); código PDV 33.

O produto também tem grupos Empório e Bebidas. Isso exige distinguir quantidade de produtos comprados, quantidade de opções escolhidas e quantidade física de unidades produzidas. A apresentação comercial deve mostrar o menor preço válido da configuração, não anunciar o produto como gratuito.

### Preços por canal

No produto padrão para 1, o iFood mostrou R$ 100,00 (exemplo sintético) com referência R$ 100,00 (exemplo sintético), enquanto o cadastro consultado na Takeat mostrou R$ 100,00 (exemplo sintético). Não assumir equivalência de tabelas, promoções ou preço líquido recebido.

O HUB deve separar preço-base por canal, condições promocionais e valores adicionais das opções. Descontos financiados pela loja ou pelo canal e taxas pertencem à apuração do pedido/financeiro, não devem sobrescrever o cadastro-base.

## 4. Identificação e qualidade dos dados

### Código PDV não é chave global confiável

Foram observados:

- Código 160 em “Caixa padrão”, preço zero, e em “Caviar de Mostarda 210g”, R$ 100,00 (exemplo sintético).
- Código 105 em Caviar como escolha incluída e Caviar 100g como Extra pago.
- Código 120 em Mel incluído e Mel 120g como Extra pago.
- Código 128 em Patê de azeitonas incluído e sua porção adicional.
- Bebidas dos grupos examinados com campo PDV vazio.

Não deduplicar por nome ou código PDV isoladamente. Usar identificador interno estável no HUB e mapeamentos externos com origem, loja, entidade e contexto. Quando houver identificadores nativos disponíveis em uma futura integração/exportação, preservá-los. Importação repetida deve ser idempotente e conflitos devem exigir resolução explícita.

### Porções não podem ser inferidas

O mesmo queijo pode ser ingrediente incluído, extra de 100g e produto de revenda. Compartilhar o insumo não significa compartilhar preço ou quantidade de consumo. Peso total comercial informado no produto não define automaticamente a porção de cada escolha.

Definir quantidades e unidades por vínculo produto/grupo/opção, inclusive quando o tamanho do produto muda. Conversões entre unidade, caixa e peso exigem fator cadastrado; não assumir equivalência.

## 5. Levantamento fiscal da Takeat

Campos vistos no formulário do produto: grupo fiscal, NCM, origem, CSOSN, CFOP, PIS, COFINS e FCP (%). Existe uma aba separada de códigos EAN, com possibilidade de múltiplos códigos. Não foram identificados CEST, IPI ou campos de novos tributos nesse formulário inspecionado; isso não prova que estejam ausentes em toda a plataforma.

Valores armazenados nos dois grupos abertos:

| Campo | Produtos de Produção | Produtos de Revenda |
| --- | --- | --- |
| Origem | 0 — Nacional | 0 — Nacional |
| CSOSN | 102 | 500 |
| CFOP | 5101 | 5405 |
| PIS | 01 | 04 |
| COFINS | 01 | 04 |
| NCM no grupo | Sem preenchimento | Sem preenchimento |

Também existem grupos “Taxa de Serviço iFood”, “Taxa de Serviço” e “Taxa de Delivery”; seus valores não foram examinados. A edição de grupos mostra opção de atualizar produtos/complementos vinculados: uma alteração compartilhada precisa de prévia de impacto no HUB.

Exemplos observados de NCM em produtos: tábuas padrão 04069020; Caprese para 2, 02101900; pães de queijo, 19012000; vinhos examinados, 22042100. Estes são dados encontrados, não classificações homologadas.

Há inconsistências concretas para revisar: Brie aparece com NCM 04069030 em alguns grupos de queijo e 04069010 em “Complementos iFood”; o Extra Brie 100g aparece sem NCM e sem grupo fiscal. Há outras opções sem vínculo fiscal.

Não replicar esses valores indiscriminadamente. A etapa fiscal deve produzir uma lista de pendências para validação contábil por produto/opção e operação. Esta análise não valida enquadramento tributário, regime da empresa ou conformidade de emissão.

Proposta para o HUB: cadastro fiscal com perfil reutilizável, exceções explícitas por produto, vigência, histórico, origem da informação e estado de validação. A seleção de regras por operação deve ficar separada da identidade comercial do produto. A lista final de campos obrigatórios depende do emissor e da validação contábil; não se deve chamar o cadastro de “fiscal completo” apenas por reproduzir o formulário observado.

## 6. Estrutura proposta para o HUB

### Clientes

PF/PJ, nome e nome de exibição, documento quando necessário, contatos, múltiplos endereços, observações operacionais e estado ativo/inativo. Distinguir comprador, destinatário e responsável financeiro, sobretudo para presentes e empresas. Separar origem de aquisição do cliente do canal de cada pedido. Aplicar permissões e evitar unificação automática por nome ou telefone compartilhado. Histórico comercial será alimentado quando houver pedidos; não fabricar indicadores antes disso.

### Produtos e categorias comerciais

Produto com identidade própria, nome, especificação, descrição, foto, categoria ordenável, situação, unidade de venda, rendimento/quantidade comercial e família analítica opcional. Categoria comercial não deve substituir categoria financeira, centro de custo ou grupo fiscal.

Prever vínculos com mais de uma categoria, pois o iFood oferece essa associação; ordem de exibição pertence ao vínculo com a categoria. Publicação, preço e disponibilidade por canal ficam separados do cadastro mestre. Pausar em um canal não equivale a excluir do HUB.

### Grupos e opções

Grupos reutilizáveis, mas com regras no vínculo com cada produto: ordem, mínimo, máximo e opções permitidas. Configurações de repetição e limite por opção devem ser explícitas no HUB; o comportamento efetivo do iFood quanto à repetição da mesma opção não foi confirmado nesta análise.

Separar três usos:

1. Escolha de composição incluída: modifica os componentes e o custo, sem necessariamente aumentar o preço.
2. Adicional pago: aumenta preço e consumo conforme sua porção.
3. Produto complementar: um item de Empório ou bebida vendido junto, podendo também existir de forma avulsa.

Não criar estoque duplicado para um produto vendido avulso e como complemento. No iFood foi observada a possibilidade de adicionar um produto a grupos. O vínculo comercial deve referenciar o cadastro correspondente e sua composição, com proteção contra dependências circulares.

### Composição, produção e custos

Reutilizar os insumos, preparações e conversões explícitas existentes. Composição fixa para o padrão; composição resolvida a partir das escolhas para o personalizado; embalagem como consumo próprio quando aplicável.

Guardar versões de composição e, futuramente, uma cópia dos nomes, preços, escolhas, quantidades e regras aplicadas no pedido. Alterações de cadastro não podem reescrever vendas históricas.

O custo calculado da ficha é custo teórico. Só chamar de CMV realizado quando houver consumo efetivo e critério de custeio definido. Margem após taxas, descontos, frete subsidiado e outras despesas é uma apuração diferente da margem sobre ingredientes.

### Ficha técnica impressa

Reutilizar a linguagem visual da ficha de preparações: identificação, foto, composição, quantidades, rendimento, instruções e observações. Para produtos personalizados, separar ficha-mestre com regras/porções da ficha de produção de uma configuração vendida. Não imprimir todas as alternativas como se fossem consumidas juntas; usar páginas adicionais quando necessário, sem reduzir ilegivelmente o conteúdo.

### Segurança operacional

Permissões separadas para consultar catálogo, cadastrar/editar, alterar preços, manter fiscal, importar e publicar por canal. Mudanças de regra compartilhada devem mostrar os produtos afetados. Registrar autor, data e valores anteriores. Cadastros usados por pedidos devem ser inativados ou versionados, preservando o histórico.

## 7. Aproveitamento do projeto atual

Inspeção local identificou:

- Página de Vendas ainda como módulo em breve, com verificação da permissão `vendas`.
- Estrutura de composição de insumos e custo de preparação com conversões explícitas e proteção contra ciclos.
- Gerador da ficha técnica de preparações em A4 paisagem, aproveitável como referência visual.
- Nenhum cadastro mestre `Cliente` ou `Produto` localizado na busca dos modelos atuais. Campos fiscais de itens de notas recebidas não equivalem ao cadastro fiscal de venda.
- O modelo chamado `CanalPedido` encontrado está ligado ao contexto de fornecedores; não deve ser reaproveitado automaticamente como canal comercial de vendas.

Não foram alterados schema, migrations, ações, telas ou produção nesta etapa.

## 8. Sequência recomendada de execução

1. **Saneamento e inventário completo:** levantar todos os produtos/grupos/opções; revisar limites de Extras; mapear duplicidades, códigos, preços por canal e pendências fiscais. Apresentar prévia de importação com conflitos, sem sobrescrita silenciosa.
2. **Fundação cadastral:** clientes, produtos individualizados, categorias ordenáveis, famílias analíticas, identificação e permissões.
3. **Configuração comercial:** grupos/opções, regras por produto, preço por canal, disponibilidade e simulador de configuração válida.
4. **Composição e ficha:** vincular insumos/preparações e porções; calcular custo teórico da configuração; imprimir ficha-mestre e configuração exemplificada.
5. **Fiscal validado e importação:** implementar campos e regras acordados com contabilidade/emissor; executar importação controlada, com reconciliação das contagens e revisão dos resultados.
6. **Evolução posterior:** pedidos, produção, baixa efetiva de estoque, recebíveis, conciliação, integração com canais e KPIs. A análise das telas não confirma acesso às APIs nem autorização técnica para sincronização automática.

É possível construir a base enquanto se resolvem pendências, mas publicação/importação definitiva não deve transformar dados ainda não revisados em configurações aprovadas.

## 9. Critérios de aceite antes da primeira importação

- Padrão e personalizada permanecem separados, assim como os tamanhos/versões existentes.
- Padrão para 1 não exige escolhas de queijo/charcutaria; personalizada para 1 exige 2 de cada; vegetariana para 1 exige 4 queijos e não apresenta Charcutaria.
- Personalizada para 4 respeita seus próprios limites; alterações em outro produto não os modificam silenciosamente.
- Extras é opcional e ilimitado em todos os produtos vinculados ao grupo compartilhado; não herda os limites 99, 100 ou 3 da origem. “Sem limite” deve ser representado explicitamente, não por um número comercial arbitrário.
- Pães de queijo exige exatamente uma quantidade; 40 e 80 unidades produzem os preços corretos e consumo proporcional à receita cadastrada.
- Escolha incluída de preço zero continua tendo custo; extra com nome semelhante pode ter outra porção.
- Mesmo código PDV em embalagem e caviar não une os cadastros.
- Preços de iFood e Takeat não sobrescrevem um ao outro sem mapeamento de canal.
- Opção ou produto sem dados fiscais exigidos fica identificado como pendente, sem preenchimento presumido.
- Reimportação não duplica registros; dados históricos e vínculos existentes são preservados.
- Ficha de um personalizado não soma todas as alternativas disponíveis.
- Limites por opção/repetição, pesos das porções e disponibilidade são conferidos antes da migração integral; os pontos não confirmados permanecem sinalizados.

## 10. Pendências explícitas

Ainda precisam de decisão ou validação: repetição das escolhas de composição; composição/gramagem de cada tamanho; resolução de códigos e vínculos fiscais conflitantes; inventário completo das categorias não detalhadas; regras fiscais homologadas; cobertura e acesso às integrações. Não foi inspecionado o cadastro de clientes da Takeat nem transferida uma base de clientes. A ausência de limite de Extras já foi decidida e não é mais uma pendência.

A separação padrão/personalizada já está decidida pelo usuário. Não deve voltar como escolha de arquitetura em etapas futuras.
