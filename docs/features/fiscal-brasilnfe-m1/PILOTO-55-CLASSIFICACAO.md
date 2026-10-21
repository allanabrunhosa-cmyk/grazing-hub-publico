# Piloto NF-e 55 — sanduíches no mini brioche

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Preparação da [Issue #11](https://github.com/allanabrunhosa-cmyk/grazing-hub/issues/11),
em 12/10/2026, Brasília. Branch `codex/fiscal-autonomia-tributaria`, base preservada
`e04b5690`. **Proposta fundamentada; nenhuma aprovação fiscal real registrada e
nenhum manifesto concluído.** O resultado executável e os impedimentos são
distintos da pesquisa tributária. Não há emissão, preview ou nova consulta Brasil NFe.

Continuação de `e5865e17`, em12/10/2026: opção vigente no Simples confirmada pela
Receita; GTIN da caixa confirmado inexistente pelo usuário. CRT1/2 ainda não
decidido, porque a consulta estadual foi bloqueada. A análise adicional de
CEST/ST, IPI e PIS/COFINS está na seção final, sem substituir evidências históricas
por consultas supostamente reexecutadas.

## Fatos e origem

Leitura autorizada e restrita do HUB, sem escrita: `/vendas/produtos`,
`/insumos` e `/configuracoes/empresa`. Produto principal
“Sanduiches no mini brioche — 20un”, unidade comercial UN, ativo, composição
ainda não cadastrada. O grupo de sabores exige duas escolhas entre sete opções.
Não usar o mesmo enquadramento automaticamente para sabores com carne.

Fonte da receita:
GTC — CMV e FT Produtos (vínculo preservado no dossiê privado),
última modificação informada pelo Drive em 02/10/2026, 16:19:38.921Z.
Leitura somente de `PP - Sanduiches Mini Brioches!A1:U65` e
`Sanduiches no mini brioche 20un!A1:X38`; não exportamos a planilha,
custos, clientes ou pedidos. As linhas14–20 e57–65 dão:

| Receita individual | Pão | Queijo | Geleia | Peso nominal pela receita |
| --- | --- | --- | --- | --- |
| Brie + frutas vermelhas |25g |Brie15g |14g |54g |
| Minas padrão + manga/maracujá |25g |Minas12g |14g |51g |

A ficha da caixa usa50g aproximados por sanduíche. O usuário confirmou nesta
conversa, em12/10/2026, que devemos usar os pesos das fichas individuais.
Não alteramos a planilha. Proposta de cenário:20un,10 de cada sabor, peso nominal
de alimento1.050g. Isso não é pesagem de lote, peso bruto ou tara.

O HUB identifica o Mini Brioche como insumo comprado por unidade, marca/fornecedor
Casa do Padeiro e conservação do insumo congelada. A ficha comercial “Mini Brioche
2und (100g)” não prova peso do pão individual: sua composição apenas indica2un.
Não inferimos50g por pão desse nome.

Declaração direta do usuário: pão chega pronto; a Grazing corta e recheia; vende
o produto resfriado, em celofane com adesivo e bandeja. A bandeja descartável serve
para servir os sanduíches. O adesivo identifica o sabor e fecha a embalagem.
Ingredientes principais informados do pão: farinha de trigo, água, margarina,
ovo, açúcar, fermento biológico e sal. Essa declaração é fonte factual identificada,
não ficha laboratorial nem composição percentual certificada. A planilha descreve
BOPP20×25cm; a declaração atual prevalece como celofane, sem presumir polímero.

## Enquadramento proposto por campo

| Campo | Proposta / estado | Fundamentação e limite |
| --- | --- | --- |
| NCM |**1905.90.90**, proposta fundamentada dos dois sabores |RGI1/6 e RGC1, NESH19.05 e tabela TIPI. Produto final de padaria com queijo/fruta; não é classificação copiada do pão |
| CFOP |**5.101**, saída própria interna SP |Preparo de sanduíche caracteriza transformação para ICMS paulista; RC27.352/2023, item11. Não5.102 por o pão ser comprado |
| Origem |Propor0, nacional, para produto preparado no Brasil |Registrar o processo local e confirmar alcance no cadastro; não inferir origem fiscal de mercadorias apenas revendidas |
| Unidade comercial/tributável |ProporUN por caixa20un, fator1 |Uma caixa comercial corresponde a uma unidade tributável do mesmo produto. Peso não converte automaticamente a quantidade para KG |
| EAN/GTIN |**SEM GTIN**, declaração factual confirmada nesta continuação |Usuário confirmou em12/10/2026 que a caixa20un não possui GTIN próprio. Não copiar o código do pão; vincular essa constatação ao fundamento UNIDADE e ao recorte aprovado |
| ICMS |CSOSN102 candidato, sem destaque |Somente opção efetiva Simples/CRT1, saída própria interna a consumidor final, sem ST, crédito ou benefício aplicável. Regime/IE precisam de prova atual |
| PIS/COFINS |**CST49 proposto**, recolhimento ordinário no DAS |PDF oficial EFD-Contribuições3024, pergunta102, efetivamente lido.99 histórico não é equivalente automático; analisar produto acabado, sem herdar benefícios dos ingredientes |
| CEST |Proposta fundamentada de **não aplicabilidade**, confiança média |Confronto descritivo específico com17.062.00/01 e17.031.00/01 e RC5109. A aprovação interna precisa adotar expressamente essa interpretação; não é decisão automática pela NCM |
| ST |Propor não incidência nesta saída própria interna de sanduíche ao consumidor |RC5.109/2015 e confronto com CAT68/2019 vigente. Não herdar ST dos ingredientes; CEST é decisão independente |
| IPI |TIPI1905.90.90:0%; **tratamento e grupo XML pendentes** |Embalagem de apresentação é hipótese bem sustentada pelos fatos; não usar art.5º,I do RIPI sem demonstrar sua exclusão. Alíquota zero não significa IPI inaplicável |
| FCP/DIFAL |Propor ausência no recorte interno SP/Simples, sujeita à confirmação do regime/operação |Não generalizar a outro regime, saída interestadual ou mercadoria especial. Não preencher FCP0 por falta de decisão |
| IBS/CBS |Propor não aplicabilidade no recorte Simples de2026 |LC214/2025, art.348,III,c. Vigência máxima31/12/2026; mudança de regime ou2027 exige revisão |
| Benefício fiscal |Nenhum benefício escolhido |Não presumir redução, cesta básica, monofásico ou código de benefício. Revisão interna deve confirmar a operação ordinária |

### Aplicação classificatória da NCM

RGI1: o produto final permanece preparação de padaria com pão assado de
trigo/fermento e recheio de queijo/fruta, admitidos na NESH19.05. Não é massa
crua19.01 nem preparação cárnea; os dois sabores não acionam o limite de componentes
cárneos das notas dos capítulos16/19/21. Queijo não é carne para essa exclusão.
21.06 é residual e não substitui uma posição específica.

RGI6: não é pão crocante knäckebrot, pão de especiarias, biscoito, wafer/waffle
ou torrada; segue1905.90. RGC1: brioche individual recheado não é pão de forma
1905.90.10 nem bolacha/biscoito1905.90.20; segue1905.90.90. A participação do pão
abaixo de50% e a ausência de novo forno na Grazing não excluem a posição.
Não exigimos solução de consulta idêntica como requisito universal.
[NESH RFB](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/nesh-2022.pdf),
[TIPI RFB](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/documentos-e-arquivos/tipi.pdf).

Foram lidas as regras nas páginas físicas11/18 e a NESH19.05 nas255/256 do PDF
oficial. A TIPI, página62, informa0% na linha1905.90.90 e Ex01 “Pão do tipo comum”
também0%; não aplicamos esse Ex01 ao sanduíche. A SC98.424/2017 trata de pão
vazio para posterior recheio e não foi usada como classificação direta deste produto.

### CEST/ST e IPI: dúvidas delimitadas

O Convênio142/18 exige correspondência entre NCM e **descrição**.17.062.00
descreve outros pães;17.062.01 contém “outros produtos de panificação”;
17.031.00/01 descrevem salgadinhos. A RC5.109 distingue sanduíche preparado da
descrição antiga de panificação, mas não decide diretamente o CEST nacional atual.
A CAT68 mantém itens58/59; a revogação dos salgadinhos29/30 em2026 não elimina
eventual CEST. Resolver explicitamente o alcance descritivo ao produto final.
CEST pode ser obrigatório mesmo sem ST; não marcar conferido apenas porque
a saída própria não tem ST.
[Convênio142/18, cláusulas7ª e20ª, AnexoXVII](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18),
[RC5.109](https://legislacao.fazenda.sp.gov.br/Paginas/RC5109_2015.aspx),
[CAT68 vigente](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-CAT-68-de-2019.aspx).

O RIPI art.5º,I condiciona a exclusão à ausência de embalagem de apresentação.
A bandeja serve ao consumidor e integra a unidade normalmente vendida; isso não
comprova o transporte nas condições cumulativas do art.6º,§1º. O adesivo não
demonstra publicidade. A ressalva do§2º exige finalidade **exclusivamente**
técnica/legal de todo o acondicionamento; não há fundamento técnico identificado
que demonstre essa exclusividade, sobretudo da bandeja usada para servir.
A proposta deve considerar apresentação e rever o enquadramento industrial/
Anexo do Simples. A alíquota TIPI0 não resolve CST/enquadramento ou obrigatoriedade
do grupo IPI na NF-e do Simples. Não inferir51/99/999 nem dispensar o grupo pela
alíquota zero.
[RIPI arts.2º,4º–6º](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm),
[RC32.784/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC32784_2025.aspx).

### Demais fontes e alcance temporal

Pesquisa oficial conferida em12/10/2026; interpretação proposta, não aprovação
humana nem eficácia individual de resposta dirigida a outro contribuinte.

- [RC27.352/2023](https://legislacao.fazenda.sp.gov.br/Paginas/RC27352_2023.aspx),
  publicada06/04/2023, itens8–12: CFOP5.101 e distinção ICMS/industrialização federal.
- [LC123, arts.13 e23](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm):
  regime unificado e condições do crédito. Não fundamenta assumir CRT efetivo.
- [FAQ EFD-Contribuições, questão101](https://sped.rfb.gov.br/estatico/A6/44AEB1BBD8AB6403004C3DA1F7F8B1C27E8DE8/Perguntas%20e%20Respostas%20EFD%20Contribui%C3%A7%C3%B5es.pdf):
  CST49 na NF-e55 ordinária de optante Simples. Conteúdo observado no índice
  oficial; abertura integral do PDF falhou nesta pesquisa. Orientação NF-e histórica
  usa99; esta diferença precisa constar na justificativa interna.
- [Brasil NFe PIS/COFINS](https://www.brasilnfe.com.br/conceitos-fiscais/pis-cofins):
  aceita49/99 em saídas e representa base zero para CRT1/2/4. É contrato técnico,
  não autoridade para escolher enquadramento tributário.
- [LC214, art.348](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm):
  exclusão das alíquotas transitórias2026 para optantes Simples.
- [Cronograma RFB](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-da-reforma-tributaria):
  publicação18/09/2026, atualização21/09/2026; documentos do Simples a partir de2027.
- [IBGE São Paulo](https://servicodados.ibge.gov.br/api/v1/localidades/municipios/3550308):
  JSON oficial confirmou3550308, São Paulo/SP, UF35. Isso confirma o código do
  município informado no HUB, não o endereço fiscal do estabelecimento.

## Aprovação e resultado local

### Comprovantes cadastrais localizados no fechamento

Leitura restrita do Drive corporativo, sem alterar/compartilhar arquivos:
cartão CNPJ (evidência preservada no registro privado),
emitido pela RFB em15/02/2023,13:31:09 Brasília, confirma o CNPJ esperado e
razão social Empresa exclusivamente fictícia de exemplo. Endereço:
Av. Dr. Cardoso de Melo973, Vila Olímpia, CEP04548-004, São Paulo/SP,
sem complemento informado; corresponde aos campos atuais lidos no HUB.
Nome de unidade do HUB é nome comercial, não prova de razão social por si só.

Comprovante de inscrição estadual (evidência preservada no registro privado),
mesmo CNPJ/razão/endereço, contém **IE126.602.764.118** (normalizada000000000000),
regime de apuração SIMPLES NACIONAL e situação Ativo. A página informa data da
situação20/08/2019; **não apresenta data de consulta/emissão identificável**.
O arquivo foi modificado em22/05/2023,15:08:08Z; isso é metadado do arquivo,
não data de validação fiscal. PDF de uma página, renderizado e conferido visualmente.

IE e cadastro foram encontrados, não precisam ser inventados nem novamente
solicitados como desconhecidos. Falta confirmar a atualidade do enquadramento
para2026 e CRT específico, inclusive eventual excesso de sublimite; o comprovante
histórico não prova sozinho CRT atual1/2. Credenciamento NF-e informado no papel
também não substitui liberação do fornecedor ou homologação.
E-mail/telefone do cartão e documentos completos não foram versionados, copiados
para fixtures ou registrados no banco. Não houve consulta autenticada Brasil NFe.

A proposta é revisão técnica identificada por este documento e suas fontes.
Não há aprovador/versão APROVADA real, nem hashes/IDs reais fabricados.
Não registramos EMPRESA/OPERACAO/ITEM incompletos na aplicação: os contratos atuais
exigem IE/CRT, parâmetros e aplicabilidade explícitos mesmo ao salvar proposta.
Preencher false, SEM_DESTAQUE ou dados fictícios para permitir esse salvamento
seria indevido. A fundamentação material em revisão impede aprovação.

A tela existente `/vendas/fiscal/regras-brasilnfe` continua o canal de proposta,
revisão e aprovação pelo usuário autorizado. Cadastros reais foram somente lidos.
Após resolver os campos abaixo, usar regras separadas EMPRESA, OPERACAO55 e ITEM,
fundamentação por campo, vigência, autor e aprovação humana vinculada aos hashes.

Código adicional desta entrega:
`RECOLHIDO_DAS` distingue PIS/COFINS no DAS de isenção/SEM_DESTAQUE;
CST49/99 e CRT1/2/4 exigem seleção explícita. Nenhum código fiscal foi aplicado
ao produto real. A representação zero do fornecedor é informativa, não uma
alíquota tributária inventada. O construtor conserva snapshot, total, frete,
descontos e pagamentos.

`obterManifestoLocalNfe55BrasilNfe`, somente servidor, reutiliza leitura
transacional autorizada do PlanoFiscal existente. Entrega modelo55/ambiente2,
identidade, revisão, total exato, hash comercial/fiscal e provas das versões.
Não retorna cliente/endereço/pagamentos/payload completo nem cria documento/plano.
Sem plano ou montagem válida devolve pendência; fotografia alterada, tentativa
anterior, histórico de processamento mesmo com contador zerado, ação pendente,
protocolo, estado incompatível, versão inválida ou outro modelo bloqueiam a preparação.
Papéis/alvos e IDs das provas correspondem às versões efetivamente usadas nos
parâmetros, sob a trava fiscal existente. Aprovação de
transmissão e conferência serviço/certificado/recuperação permanecem separadas.

**Não existe manifesto real concluído neste incremento.** Não criamos pedido,
cliente, recebível ou documento real/sintético administrativo para preencher
lacunas. Os únicos documentos completos são fixtures da suíte sintética, sem
reutilização das receitas, preços ou empresa reais. Lista de impedimentos e
roteiro: [PILOTO-55-IMPEDIMENTOS](PILOTO-55-IMPEDIMENTOS.md).

## Revisão adicional da Issue11 — continuação de e5865e17

### Regime vigente, sem inferir o CRT

Consulta oficial [Optantes — Receita Federal](https://www8.receita.fazenda.gov.br/SimplesNacional/aplicacoes.aspx?id=21),
executada pelo navegador, somente leitura, para o CNPJ já comprovado. Data mostrada
pela fonte: **12/10/2026,19:43:27 Brasília**. Identidade corresponde à razão/CNPJ
esperados. Resultado: **optante pelo Simples Nacional desde20/08/2019**, **não
enquadrado no SIMEI**; expansão das informações não mostrou períodos anteriores
nem eventos futuros. Essa é evidência nova de2026, distinta do comprovante2023.

Ela não informa excesso de sublimite estadual. A
[consulta pública CADESP](https://www.cadesp.fazenda.sp.gov.br/Pages/Cadastro/Consultas/ConsultaPublica/ConsultaPublica.aspx)
foi aberta com a IE já comprovada. Após autorização específica do usuário, CAPTCHA
e consulta, a página apresentou rejeição de acesso pelo portal, sem resultado
cadastral. Registro local da falha em12/10/2026,19:48:13 Brasília, após a rejeição;
horário próprio do resultado não disponível. Sem repetição,
contorno da proteção ou login estadual. Não atribuir essa falha ao cadastro.

Logo **CRT permanece null na preparação**, com uma pendência estrita: comprovar
se o estabelecimento recolhe ICMS dentro do Simples ou fora dele por excesso de
sublimite, com vigência em2026. Consulta estadual atual ou registro oficial do
PGDAS-D/sublimite resolve essa diferença; não é necessário pedir novamente CNPJ,
IE, receita do produto ou credenciais Brasil NFe. O
[serviço estadual de sublimite](https://www3.fazenda.sp.gov.br/sublimitesn)
exige acesso do contribuinte/contabilista. Não solicitar senha no chat.
CSOSN102 continua condicionado aCRT1; não aprovar sua aplicação comoCRT2.

### Unidade final e GTIN

Declaração direta do usuário em12/10/2026: **“A caixa não possui GTIN próprio”**.
Assim a proposta do piloto é EAN **SEM GTIN**, unidade comercial/tributávelUN por
caixa20un, fator1. A declaração diz respeito à caixa de saída, não ao insumo.
Conserva origem identificada no fundamento UNIDADE; aprovação permanece humana.
Não foi consultada a GS1 nem gravado cadastro operacional em produção.

A extensão técnica valida8/12/13/14 dígitos, dígito de controle e rejeita código
todo zero; preserva zeros iniciais e strings. Ausência nunca vira SEM GTIN.
Validade sintática não comprova atribuição nem unidade do código. Referências:
[GS1 — especificações gerais](https://ref.gs1.org/standards/genspecs/),
[NF-e — BT2017.003v2.10, P21-20/9402](https://hom.nfe.fazenda.gov.br/arearestrita/inicial/exibirArquivo.aspx?conteudo=R%2FhwsHascS0%3D).
Novas aprovações ITEM/GRUPO sem decisão válida são recusadas no servidor em
`classificacoes.ean`; propostas e versões históricas continuam legíveis,
sem alteração de hashes. Aplicação/montagem de informação antiga inválida bloqueia.

### CEST e ST do sanduíche acabado

Proposta específica dos dois sabores sem carne: **ST não aplicável nesta saída
própria interna SP a consumidor final**, confiança alta; **CEST não aplicável ao
produto acabado**, confiança média. Fundamento não é simplesmente “não háST”.

- **17.062.00 — outros pães:** a saída é novo sanduíche montado, não revenda do
  brioche. O código do pão adquirido não se transfere ao produto acabado.
- **17.062.01 — outros produtos de panificação, incluindo pizzas:** a
  [RC5109/2015](https://legislacao.fazenda.sp.gov.br/Paginas/RC5109_2015.aspx),
  itens4–11, exclui expressamente o sanduíche preparado dessa descrição de
  panificação. A redação atual inclui pizzas, sem incluir automaticamente toda
  preparação baseada em pão. Limite da analogia: o consulente também fabricava
  o pão; a Grazing compra-o pronto. A RC não é resposta individual à Grazing.
- **17.031.00/01 — salgadinhos:** tamanho mini, sabor salgado e farinha não
  demonstram a categoria. A RC5109 também excluiu as outras hipóteses alimentícias
  então listadas. Revogação paulista desses itens desde01/01/2026 não extingue
  os códigos nacionais nem resolve, sozinha, o CEST do sanduíche.

[Convênio142/18, cláusulas7ª§1º/20ª](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18)
exige NCM **e descrição**, com CEST de produto listado mesmo semST.
[CAT68 vigente](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-CAT-68-de-2019.aspx),
AnexoXVI58/59, conserva17.062.00/01;
[RC33358/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33358_2026.aspx),
itens14–17, trata de mini pão, reforçando a condição cumulativa, sem decidir
sanduíches. [Art313-W](https://legislacao.fazenda.sp.gov.br/Paginas/art313w.aspx)
vincula retenção às operações subsequentes; no recorte próprio/consumidor não há
saída comercial subsequente. Não herdarST de ingredientes.

O responsável interno pode adotar essa interpretação fundamentada. Se considerar
material a dúvida restante, a consulta dirigida é somente o alcance da expressão
de17.062.01 ao sanduíche frio montado com pão pronto comprado/queijo/geleia.
Não impor parecer obrigatório nem escolher CEST provisório para permitir montagem.

### PIS/COFINS do acabado e grupo IPI

O [PDF oficial EFD-Contribuições, arquivo3024](http://sped.rfb.gov.br/arquivo/download/3024)
foi efetivamente lido nesta continuação:60 páginas,791.364bytes, HTTP200/PDF,
SHA256 `2bc1dfe299777ac198b2808de437617d628afd6a16f453f88a4ae25935fb31a4`.
**Pergunta102, páginas físicas51–52** recomenda49 em NF-e55 de vendas com
recolhimento único no Simples; distingue monofásico/ST dePIS/COFINS/exportação.
Na edição estática antes indicada, a questão era101; não afirmar que o arquivo
3024 é uma edição2026, pois não foi identificada data suficiente. A falha anterior
de leitura está preservada no histórico, não descreve esta nova leitura.

Proposta **PIS49/COFINS49/RECOLHIDO_DAS** para o sanduíche acabado ordinário.
O regime federal2026 agora está confirmado. Não transportar tratamento do queijo,
pão ou geleia, nem confundir ICMS-ST com PIS/COFINS05.99 em exemplo antigo não
autoriza tratar os dois códigos como equivalentes ou aplicar automaticamente.

Para IPI, embalagem/processo sustentam proposta industrial/AnexoII, sujeita à
aprovação interna. [RIPI arts.4º–6º/177–179](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm),
[LC123 arts.13/18/23/24](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm),
[SC Cosit2/2018, itens5–6](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=47376)
distinguem alíquota zero deNT: TIPI0% não afasta automaticamente o AnexoII/IPI do
DAS. A SC trata de gelo, usada apenas para esse critério geral. Não pressupor
exclusão de industrialização pelo art.5º,I diante da embalagem de apresentação.

[MOC7.0, AnexoI, grupoO](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J+I+v4eN00E%3D)
tem ocorrência0–1 do IPI, condicionada ao item sujeito ao imposto;
[NT2020.002](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=usCYB1coPQw%3D)
distingue IPITrib00/49/50/99 deIPINT01/02/03/04/05/51/52/53/54/55.
Conteúdo relevante observado no índice oficial; abertura direta protegida,
sem declarar leitura integral desses arquivos. A
[ResCGSN140 compilada, art59§4](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278&visao=compilado)
disciplina documento sem destaque/crédito, mas não determina sozinha omissão,
CST99 ou enquadramento999 para esse caso.

**Lacuna precisa: política de inclusão/omissão do grupo IPI, CST e cEnq para
industrial Simples com recolhimento no DAS e saída própria do acabado.** Nenhuma
fonte atual consultada determinou automaticamente51/53/99/999 nesse recorte.
O FAQ antigo do Portal NF-e não substitui essa decisão atual. O contrato público
[Brasil NFe](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e) mostraCodEnquadramento,
CodSituacaoTributaria,Aliquota e campos de devolução, semBaseCalculo no exemplo.
A [página conceitual IPI do provedor](https://www.brasilnfe.com.br/conceitos-fiscais/ipi-cst)
tem divergências com o MOC sobre CST00/49 e obrigatoriedade universal; não é
fundamento fiscal para copiar códigos ou incluir IPINT automaticamente.

Manter o bloqueio local deIPI não suportado. Antes de estendê-lo, o responsável
fiscal deve decidir a representação e o fornecedor esclarecer o XML/contrato
correspondente, sem emitir para testar. Não trocar `ipiAplicavel` porfalse.
As regras reais completas e o manifesto ainda dependem deCRT, dessa decisão,
aprovação humana e fotografia/plano sintéticos. Nenhuma aprovação foi fabricada.

### Cadastro administrativo completado, sem proposta fiscal fictícia

Aplicação real da branch retomada em `http://127.0.0.1:3451`, no mesmo banco
`admin_brasilnfe_m11`/loopback55449, chaveDPAPI persistente e sessão administrativa
central existente. Não houve novo usuário, senha, seed, banco ou cópia operacional.
Antes de aplicar a migration **já versionada**
`20261012100000_brasilnfe_autonomia_tributaria`, conferimos destino exato, CNPJ
correspondente, ausência de notas recebidas/estoque/financeiro e a pendência única
dessa SQL aditiva. Aplicação somente local, sem reescrever versões.

Em `/configuracoes/empresa`, CEP/número comprovados completaram o endereço postal
correspondente ao cartão CNPJ. Salvamento explícito pela ação existente, com
permissões/transação/auditoria; recarregar confirmou persistência. Nome/CNPJ
existentes, telefone/e-mail vazios e certificadoSEFAZ permaneceram preservados.
A grafia postal “Avenida Doutor Cardoso de Melo” corresponde à abreviação do
comprovante, no mesmo número973/CEP00000000/VilaOlímpia/SãoPaulo/SP.

Auditoria `HistoricoCadastroVenda`, entidadeLOJA/singleton, usuário administrativo
local confirmado. Data textual do banco: **2026-10-12 23:06:49.005**, fuso declarado
**America/Sao_Paulo**. Horários são os registros de cada fonte; não foram ajustados
relógios ou datas. Nenhum conteúdo bruto da auditoria ou segredo foi exportado.
Configuração BrasilNFe permanece **HOMOLOGACAO, versão9**, Token eUserToken
configurados; seus valores não foram lidos nem substituídos. Nenhuma ação de
diagnóstico externo foi executada. Evidências históricas continuam históricas;
uma prova dependente do cadastro precisa ser revalidada antes de uso futuro.

A tela real `/vendas/fiscal/regras-brasilnfe` abriu com a mesma sessão e informou
**nenhuma decisão registrada**. Continua assim: CRT e representaçãoIPI ainda
impedem conteúdo fiscal completo. Não preencherfalse ou código inventado para
salvar proposta, não converter pesquisa em aprovação humana. A validação visual
do campoGTIN usou prévia separada, com ações/dados sintéticos, e não essa sessão
para simular aprovação. Cadastro mínimo concluído não é manifesto nem homologação.

## Atualização operacional de12/10/2026

As evidências anteriores são históricas. O estado atual e os campos residuais estão
em [Homologação individual](HOMOLOGACAO-INDIVIDUAL.md) e na
[prévia real dos manifestos](PREVIA-MANIFESTOS-HOMOLOGACAO.json).

CRT1 tem proposta fundamentada em Simples2026 e PGDAS-D PA07/2026, sem impedimento
ICMS/ISS noDAS. Extrato disponibilizado em outubro não foi obtido; não consta como
validado. Origem0 exige conferência factual e aprovação interna explícitas.
NCM19059090/CFOP5101/SEMGTIN/CEST-ST não aplicáveis/PIS-COFINS49 têm propostas
versionadas para os dois sabores. Não estender a outros produtos ou apurações.

IPI documental: OMITIR_SIMPLES, com aplicabilidade federalnull. Não inventaCST,
cEnq, base ou alíquota. Não decideAnexoI/II nem reclassifica PGDAS passado. O XML
recebido deve corresponder à representação aprovada; divergência exige conferência.

Endereço postal externo confirmado no painel; IE corrigida com autorização
específica e releitura. A API omiteUF; evidência diretaSP permanece separada.
Certificado no painel vence07/11/2026; consulta de data ainda incompatível.
ConsultarServicos/status1 não foi repetido.65 precisa deCSC/id no fornecedor.

Nenhuma aprovação tributária humana foi forjada. Nenhuma nota foi transmitida.
O próximo ato é a revisão interna consolidada das seis propostas; depois,
autorização específica do documento55/ambiente2/R$10,00 com seus hashes.
