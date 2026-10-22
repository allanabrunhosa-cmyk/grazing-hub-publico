# Interface e validação visual

## Interface vigente na branch de unificação — 21/10/2026

A manutenção operacional passou para Produtos → Fiscal, Fiscal → Vínculos,
Fiscal → Grupos e Fiscal → Configurações. A ficha usa as versões do motor.
Salvamento de rascunho, impacto e aplicação ocorrem na própria tela. As rotas
antigas redirecionam. As funções necessárias de complementos, referências internas,
tabelas e histórico permanecem acessíveis nas novas entradas.

O cadastro comercial anterior não recebe cópias dos novos parâmetros. A comparação
mostra diferenças sem escolher tributos ou vínculos. Consulte o
[contrato de unificação](../fiscal-unificado/README.md) e sua validação.

Os trechos abaixo descrevem a interface anterior e suas evidências históricas.

Implementação de 11/10/2026. Referência visual **Em revisão** até avaliação humana.

## Operação no HUB

- **Produtos → Fiscal** mantém campos individuais, conferência e salvamento
  explícito. Grupo sugere somente parâmetros gerais; NCM e exceções individuais
  prevalecem. O botão Cobertura e versões abre `/financeiro/fiscal/cobertura`.
  `/vendas/fiscal/cobertura` permanece como endereço antigo compatível.
- **Estrutura fiscal → Produtos** mostra catálogo ativo, papéis, grupo, NCM,
  composição, evidências e pendências. Confirmação cadastral não prova prontidão de
  uma operação: a prévia confere regras, perfil e tabelas. Exportar cobertura gera
  CSV com proteção contra interpretação de conteúdo textual como fórmula.
- **Regras e perfis** mantém rascunhos por vigência para estabelecimento, regime,
  operação/destino/destinatário e tratamento de complementos. Administrador
  autorizado salva justificativas/fontes e consulta impacto antes de ativar.
  A análise retorna um hash conferido no servidor; mudanças posteriores exigem
  nova análise. Documentos históricos permanecem preservados.
  Regra com ICMS-ST retido registra evidência opcional da nota de entrada e do
  item correspondente; CEST, isoladamente, não comprova retenção. O campo tem
  limite de 2.000 caracteres e conserva os demais parâmetros durante a edição.
  Classificação individual também registra o GTIN da unidade vendida: Não
  confirmado, Sem GTIN comprovado ou Código GTIN. Código aceita apenas dígitos,
  com 8/12/13/14 posições e limite de 14; o servidor confere o dígito verificador.
  Campo não é obrigatório para salvar o cadastro; ausência de confirmação impede
  somente a emissão afetada. Não há herança de GTIN do grupo fiscal.
- **Notas de fornecedores** usa evidência das entradas vinculadas. Conciliar
  prepara rascunho de classificação; NCM recebido somente é sugerido para revenda
  ou fracionamento, sem copiar para preparação Grazing.
- **Histórico e tabelas** permite nova versão ou carga JSON de linhas oficiais,
  até 450 KB e 20.000 linhas; a prévia mostra as primeiras 100. Arquivo pode ser
  recorte do catálogo. Carga completa exige declaração explícita e fonte oficial;
  vigência, compatibilidade e duplicatas são revalidadas no servidor.
- **Pedido → Fiscal de saída → Calcular prévia fiscal** resolve 55/65 no servidor
  e mostra itens, tributos, justificativas, versões e bloqueios da operação.
  Finalidade do adquirente, indicador de IE e presença são escolhas fiscais
  explícitas, separadas do cadastro comercial. Uma revisão nova exige novo
  contexto; presença 4 fica disponível apenas no modelo 65. CNPJ/IE não inferem
  uso final ou revenda.
  Preparar solicitação utiliza o mesmo modelo selecionado. Prévia não transmite
  documento, ativa autoemissão ou cria faturamento.

Campos numéricos reutilizam Input/restrições da Central: códigos têm dígitos e
comprimento definido, taxas quatro casas, quantidade/rateio seis casas. Remoção de
componente ou linha importada altera apenas rascunho e usa BotaoRemoverItem.

## Conteúdo de Importação e FCI — 14/10/2026

A classificação canônica possui um bloco avançado recolhido para origem 0, 3, 5 ou 8,
ou decisão FCI já registrada. Na origem 0, o gatilho explícito permite analisar
insumos importados sem presumir obrigação, ausência de importação ou dispensa.
Nenhuma decisão é criada apenas por abrir a classificação. O administrador informa exigência, pendência ou
dispensa delimitada por UF e modelo. Nenhum número, CI, valor normativo, UF ou
modelo é preenchido automaticamente. Número de controle aceita somente formato
hexadecimal de 36 posições; não há geração local. CI aceita 0–100 com quatro casas.
Valores normativos aceitam até 12 inteiros e oito casas, sem cálculo pelo pedido.

Fontes, evidências, período e justificativa acompanham o rascunho versionado.
Conferir apuração exige base documentada e fonte oficial HTTPS gov.br. Editar os
dados invalida essa conferência. O servidor confere proporção, faixa de origem,
vigência e alcance da dispensa. Salvar não aprova, gera FCI ou transmite documento.
Decisões antigas ausentes não ganham defaults nem hashes novos silenciosamente.

`testes/vendas/fci-classificacao-interface.test.tsx`: três testes sintéticos
passaram no Node 22. A prévia `testes/visual/fiscal-seletores.html?fci=1` usa somente
estado local. Capturas em 320/390/768/1440 CSS px, nos temas claro e escuro, tiveram
zero problemas no auditor DOM. Foram inspecionados desktop, móvel e dispensa.
Evidências consultivas: [desktop](evidencias/fci-classificacao-1440-light.png) e
[móvel](evidencias/fci-classificacao-390-dark.png). Permanecem **Em revisão**;
não são aprovação humana, conferência de fonte real ou homologação fiscal.

## Evidências sintéticas

`testes/visual/estrutura-fiscal.html` usa catálogo e ações simuladas, sem banco ou
serviço fiscal. Capturas verificadas em Chrome headless local, 1440×1000 e 390×844:

- [Painel desktop](evidencias/painel-desktop.png)
- [Classificação no diálogo](evidencias/classificacao-desktop.png)
- [Análise de impacto](evidencias/impacto-desktop.png)
- [Painel móvel](evidencias/painel-mobile.png)
- [Enquadramento fiscal do pedido](evidencias/pedido-fiscal-desktop.png)
- [Prévia do pedido com pendência específica](evidencias/previa-pedido-desktop.png)
- [Enquadramento do pedido no móvel](evidencias/pedido-fiscal-mobile.png)

Verificação executável: sete imagens, nenhum erro de página; no móvel,
scrollWidth=390 e innerWidth=390, com rolagem interna da tabela. Inspeção das sete
imagens confirmou leitura, encaixe dos modais e uso dos componentes existentes.
Não certifica WCAG, hardware, emissão autorizada ou homologação externa.

### Complemento de 12/10/2026 — regra e evidência de ICMS-ST

Reutilizados `Campo` e `Textarea`, seguindo os fundamentos tributários já
existentes no editor de regras. `EditorVenda`, `GrupoAcoes`, `Button outline`
e tokens da Central permanecem os consumidores de referência, sem nova variante.
A barra de Novo perfil/Nova regra/Tratamento de complemento agora permite quebra
das ações, preservando altura e tamanho dos botões.

Chrome local com dados sintéticos: 18 capturas novas inspecionadas, altura de
1.000 CSS px, após fontes e transições de tema estabilizarem. Matriz:

| Largura CSS | Regras: claro / escuro | Editor ST: claro / escuro |
| --- | --- | --- |
| 320 | [Claro](evidencias/regras-320-light.png) / [Escuro](evidencias/regras-320-dark.png) | [Claro](evidencias/regra-st-320-light.png) / [Escuro](evidencias/regra-st-320-dark.png) |
| 390 | [Claro](evidencias/regras-390-light.png) / [Escuro](evidencias/regras-390-dark.png) | [Claro](evidencias/regra-st-390-light.png) / [Escuro](evidencias/regra-st-390-dark.png) |
| 768 | [Claro](evidencias/regras-768-light.png) / [Escuro](evidencias/regras-768-dark.png) | [Claro](evidencias/regra-st-768-light.png) / [Escuro](evidencias/regra-st-768-dark.png) |
| 1440 | [Claro](evidencias/regras-1440-light.png) / [Escuro](evidencias/regras-1440-dark.png) | [Claro](evidencias/regra-st-1440-light.png) / [Escuro](evidencias/regra-st-1440-dark.png) |

Erro de validação também inspecionado em [390 escuro](evidencias/regra-st-erro-390-dark.png)
e [1440 claro](evidencias/regra-st-erro-1440-light.png), com CFOP e evidência
preservados. `auditarInterface(document)` retornou zero problemas nos 18 cenários
verificados após a correção. Antes dela, a barra de ações excedia o documento em
236/166/76 px nas larguras 320/390/768; a rolagem das tabelas permanece interna.

Teclado verificado no navegador: Tab da evidência vai para Segregação da receita;
Enter em Salvar apresenta a validação sem perder valores; Escape exige decisão
sobre o rascunho; Continuar editando preserva os campos; descartar devolve o foco
para Nova regra. Limpar somente a evidência mantém o CFOP e deixa o campo opcional.

Limites desta passagem: navegador desktop com viewport redimensionado, sem
emulação de ponteiro grosso ou leitor de tela. Gravação pendente e comparação de
pixels com referência aprovada equivalente não foram executadas nesta ampliação.
O editor ST é uma referência nova **Em revisão**; nenhum baseline foi atualizado.

### GTIN e confirmação do editor fiscal

O editor fiscal reutiliza `Button entrada` para confirmar o rascunho, via opção
tipada de `EditorVenda`; os demais consumidores conservam a variante atual.
`SelecaoFormulario` e `Input` com restrição de dígitos compõem o GTIN. Alternar
ausência/código conserva o valor digitado; nova versão preserva os dados históricos.

Nos formulários fiscais de produtos e grupos, os campos omitem notas de catálogo,
contagens, fontes normativas e orientações estáticas abaixo dos controles, conforme
pedido de 21/10/2026. Os seletores mantêm código e descrição nas opções. Erros de
consulta, avisos de vigência/contexto e regime não confirmado continuam visíveis.
O seletor compartilhado conserva as descrições por padrão nos demais consumidores.
Nenhum parâmetro fiscal ou contrato de salvamento muda com essa simplificação.

Capturas adicionais inspecionadas: [390 claro](evidencias/classificacao-gtin-390-light.png),
[390 escuro](evidencias/classificacao-gtin-390-dark.png),
[1440 claro](evidencias/classificacao-gtin-1440-light.png) e
[1440 escuro](evidencias/classificacao-gtin-1440-dark.png). Auditoria retornou zero
problemas nos quatro cenários; Tab do código leva ao campo de evidências. Os
limites e o estado **Em revisão** das capturas anteriores continuam aplicáveis.

### Configuração prospectiva do leiaute e do preço de 2027

O perfil que exige regra IBS/CBS oferece uma seção avançada opcional para mapear
o leiaute NT 2026.008 no provedor. O rascunho começa com cinco caminhos vazios e
confirmação de homologação desmarcada. Caminhos aceitam até 80 caracteres e três
segmentos alfanuméricos iniciados por letra, separados por ponto; digitação e
colagem rejeitam espaços, símbolos e segmentos adicionais. Não há nomes de API
presumidos. A confirmação fica indisponível até os cinco caminhos estarem
completos e a evidência ter ao menos 15 caracteres. Alterar um caminho ou a
evidência exige confirmar novamente. Alternar a seção conserva os campos do
rascunho e desmarca a confirmação ao reabrir.

Essa declaração administrativa não chama o provedor nem autoriza emissão.
CRT, enquadramento cadastral, operações permitidas e autorização para emitir
continuam com verificações separadas no servidor. A evidência deve demonstrar
campos documentados e conferidos no XML de homologação do provedor; cronograma
de publicação de uma nota técnica não demonstra essa capacidade.

Na regra, **Configurar decomposição do preço em 2027** é opcional durante a
edição. Quando selecionado, inicia com base ICMS bruta e operação sem acréscimos.
A orientação paulista é indicada pelas RC 32931/2025 e RC 33083/2026. Escolher
base líquida de IBS/CBS exige registro estruturado da norma específica: UF,
início/fim de vigência, URL oficial, identificação do ato e fundamento para a
operação. Os campos começam vazios e são preservados ao alternar a base ou
desligar/reabrir a política. A URL rejeita espaços e caracteres incompatíveis
na digitação/colagem e é incluída, sem duplicação, nas fontes enviadas ao salvar
a nova versão. A prévia e a ativação conferem no servidor a fonte e a vigência
da exceção; as duas respostas paulistas citadas não justificam base líquida.
Rateio proporcional
aos valores brutos exige fundamento registrado. A prévia confere a política
antes de permitir a operação; não se exige esse preenchimento no cadastro de
produto ou no perfil padrão do Simples em 2026. A interface distingue o preço
final do pedido, a base IBS/CBS que exclui os próprios tributos e o valor líquido
do produto. Mudanças são gravadas em nova versão prospectiva.

Capturas focadas adicionais, verificadas com dados sintéticos e sem serviço
fiscal: perfil em [390 claro](evidencias/leiaute-rtc-390-light.png) e
[1440 escuro](evidencias/leiaute-rtc-1440-dark.png); preço em
[390 claro](evidencias/preco-rtc-390-light.png) e
[1440 escuro](evidencias/preco-rtc-1440-dark.png).
`auditarInterface(document)` retornou zero problemas nesses quatro cenários.
Escape exigiu decisão sobre o rascunho; descartar permitiu abrir uma nova regra.
Os limites de navegador desktop redimensionado e o estado **Em revisão**
continuam aplicáveis. Nenhum baseline foi atualizado.

Exceção normativa inspecionada em [390 claro](evidencias/excecao-icms-390-light.png)
e [1440 escuro](evidencias/excecao-icms-1440-dark.png), com campos vazios e nenhuma
norma presumida. Auditoria retornou zero problemas nos dois cenários. Tab da
fonte leva à identificação do ato; Escape exige decisão sobre o rascunho.

## Testes executados

- `npm run lint:design`: passou (358 consumidores no momento da execução).
- Cinco consumidores de interface, sequenciais e com timeout de 20 segundos:
  `estrutura-fiscal-interface`, `vinculos-fiscais-interface`,
  `vinculos-fiscais-pagina`, `fiscal-saida-interface` e `interface`: **55/55**.
- IBGE opcional/CEP e consumidores `municipio-fiscal`, `pedidos-endereco-interface`,
  `clientes-cadastro`, `clientes-campos-interface`, `fiscal-saida-interface`:
  **36/36**, incluindo prévia bloqueada sem preparação/transmissão.
- Após incluir contexto fiscal explícito por revisão, `fiscal-saida-interface`:
  **6/6**, cobrindo ausência de inferência por comprador e presença exclusiva 65.
  Caso adicional de herança em `vinculos-fiscais-interface`: **1/1**, garantindo
  preservação de NCM/CFOP/origem individuais; outros casos ficaram fora desse filtro.
- Correção dos seletores tipados e campo de evidência ST, com quebra responsiva:
  `fiscal-saida-interface` e `estrutura-fiscal-interface`, **9/9**. ESLint dos três
  consumidores alterados passou; `lint:design` passou com 364 arquivos, 98 desvios
  históricos e nenhum novo desvio.
- Fechamento GTIN: `estrutura-fiscal-interface`, **6/6** após corrigir o nome
  acessível do grupo no novo teste. Cobertura de comprimentos e restrição de
  dígitos, opções explícitas, preservação ao alternar/grupo e falha de gravação.
  `interface`, consumidor comercial do editor compartilhado, **33/33** na
  primeira bateria; seus casos não foram alterados. ESLint dos sete arquivos
  afetados passou; `lint:design` passou com 365 arquivos, 98 desvios históricos
  e nenhum novo desvio.
- Configuração prospectiva RTC: `estrutura-fiscal-interface`, **9/9**, incluindo
  caminhos vazios, limites de digitação/colagem, confirmação condicionada à
  evidência, preservação do rascunho, ausência de exigência no Simples de 2026 e
  fonte normativa estruturada para base ICMS líquida. A execução focada após
  acrescentar UF/vigência/ato/fonte/fundamento também passou **9/9**, incluindo
  proteção da URL, preservação ao alternar e inclusão da fonte no envio da nova
  versão. ESLint dos dois
  arquivos alterados passou; `lint:design` passou com 364 consumidores TSX,
  365 arquivos, 98 desvios históricos e nenhum novo desvio.

Logs extensos ficam em arquivos temporários ignorados. A primeira execução em
paralelo teve timeouts locais; a execução sequencial acima passou. Build, testes
de integração com banco, segurança e homologação têm evidências próprias na
execução principal da feature.
