# Matriz fiscal individual do catálogo

## Fonte e preservação

Auditoria de produção em 11/10/2026, 22h46, por transação PostgreSQL `REPEATABLE READ READ ONLY`.
Leitura posterior das XMLs já armazenadas extraiu somente campos fiscais dos itens e do próprio
estabelecimento. Nenhuma venda, manifestação, emissão, cadastro comercial ou movimentação foi
operada. O banco local não representa o catálogo de produção.

Os arquivos completos permanecem privados em `.tmp/fiscal`, ignorados pelo Git. Não versionar
cargas de SKUs, formulações, XMLs, chaves fiscais ou dados de pessoas. A matriz identifica produtos
por código comercial quando existente e pelo ID original quando o código estiver ausente.
O ID de rastreio não é apresentado como SKU comercial criado pelo sistema.

## Contrato implementado

`src/lib/tributacao/catalogo.ts` gera uma linha por `ProdutoVenda` ativo, conservando ID/revisão,
papéis, descrição, composição quantitativa, grupo/natureza sugeridos, tratamento, NCM candidato,
origem/CEST cadastrados, situação, evidências e característica ausente. Referências NCM oficiais
incluem descrição, hierarquia legal, início/fim de vigência, fonte e data da conferência.

`scripts/estrutura-fiscal-catalogo.ts` produz JSON/CSV da matriz, classificações propostas e
auditoria das preparações. Não abre conexão ao banco e não grava configurações. Executar na
worktree correta com o export privado autorizado:

```powershell
npx tsx scripts/estrutura-fiscal-catalogo.ts --arquivo=.tmp/fiscal/catalogo-producao-enriquecido-20261011.json --tabela-ncm=.tmp/fiscal/ncm-oficial.json --declaracoes=.tmp/fiscal/declaracoes-operacionais.json
```

Acrescentar `--revisoes=.tmp/fiscal/classificacoes-casos-revisao.json
--saida=.tmp/fiscal/matriz-revisada` gera a matriz final revisada, com os 129 IDs originais e
as 17 confirmações individuais. O exportador confere identidade, unidade e NCM vigente antes
de incorporar a revisão; o retrato automático anterior continua separado.

`scripts/estrutura-fiscal-implantacao.ts` gera um plano de versões e recibos privados. O padrão é
`--dryrun`, sem conexão ao banco. Aplicação exige administrador vigente relido no servidor,
`--aplicar`, comprovante recente de backup verificado e autorização operacional registrada.
`--ativar` é uma opção adicional explícita. O CLI confere IDs/revisões ativos e não sobrescreve
correções feitas fora do lote; perfis e classificações anteriores permanecem históricos.
`--revisoes` incorpora a revisão individual comprovada, `--declaracoes` acrescenta evidência
operacional por ID e `--regras` incorpora regras individuais documentadas. A carga exige
compatibilidade com o perfil, NCM, natureza, grupo e CEST auditados e códigos oficiais importados.
Regras sem fundamento de ST/isenção ou com cálculo pendente continuam em rascunho.

## Dados essenciais ausentes

- NCM de entrada comprova o conteúdo declarado pelo fornecedor, não o enquadramento automático
  do produto preparado. Receita multicomponente e kit não recebem NCM de um único ingrediente.
- Queijos da posição 0406.90 exigem evidência do teor de umidade para distinguir 10/20/30.
  Nome Brie, Gouda, Parmesão ou Minas, isoladamente, não decide o desdobramento.
- Presunto exige corte, presença de osso, cura/salga/secagem e informação de cozimento/preparo
  para distinguir 0210 e 1602. As evidências recebidas não são substituídas pela referência inicial.
- Espumante com entrada 2204.10.10 exige características e método para distinguir tipo champanha
  de outros vinhos espumantes. Nacionalidade e nome comercial, isoladamente, não decidem o código.
- A declaração expressa do administrador confirmou as tábuas montadas, prontas para consumo,
  com ingredientes cortados e combinados. Essa evidência resolve a apresentação de preparação
  pronta, sem atribuir NCM genérico nem transformar tábuas em kits. Faltam formulação quantitativa
  e características determinantes para aplicação das RGI/notas legais/NESH ao produto final.
- Origem de fornecedor não é copiada como origem da saída. Aquisição nacional/importada e
  origens divergentes do mesmo insumo exigem identificação do lote/marca efetivamente vendido.
- Cestas precisam de componentes comerciais, quantidades e pesos de rateio. Ingredientes de
  ficha técnica não são transformados automaticamente em linhas fiscais.
- Extras cobrados e embalagem superior exigem tratamento por vínculo. Opção gratuita de grupo
  de composição não cria linha independente; sabor cobrado pode ainda integrar o principal.

Fonte NCM: [Sistema Classif — arquivo oficial](https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json).
Existência e vigência do código são verificadas sem afirmar que a mercadoria satisfaz a descrição.

## Regras individuais documentadas de 2026

A coleção privada contém regras para venda interna paulista a consumidor final em Simples,
sem alíquotas fabricadas. CEST nacional permanece registrado mesmo quando a mercadoria não está
sujeita à ST paulista. [Convênio ICMS 142/2018](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18).

O lote distingue vinho com ST paulista removida em 2026, muçarela de búfala que não corresponde
a requeijão/similar, doce de leite e damasco seco fora da lista estadual. [Portaria SRE 64/2025](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-64-de-2025.aspx),
[CAT 68/2019 consolidada](https://legislacao.fazenda.sp.gov.br/paginas/Portaria-CAT-68-de-2019.aspx),
[RC 6472/2015](https://legislacao.fazenda.sp.gov.br/Paginas/RC6472_2015.aspx).

Uva fresca e tomate vendidos separadamente, sem cocção ou ingrediente estranho e sem destino
industrial, recebem o tratamento de isenção comprovado do artigo 36; CSOSN900 distingue a saída
isenta de imunidade ou faixa de receita. A regra não se estende à tábua nem ao damasco seco.
[RICMS, Anexo I, artigo 36](https://legislacao.fazenda.sp.gov.br/Paginas/an1art036.aspx),
[RC 18963/2019](https://legislacao.fazenda.sp.gov.br/Paginas/RC18963_2019.aspx),
[RC 26409/2022](https://legislacao.fazenda.sp.gov.br/Paginas/RC26409_2022.aspx).

Mortadela possui retenção efetiva evidenciada nas entradas do mesmo insumo (CFOP5401/CST70 e
ICMS-ST destacado). A regra final interna emprega CFOP5405/CSOSN500 e segregação de receita
sem ICMS no DAS. Salame e pastrami mantêm exceção: entradas CST00 sem retenção demonstrada,
apesar da sujeição atual à ST. É necessário comprovar retenção/antecipação e destino da aquisição,
segregando lotes quando necessário. [RC 31904/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC31904_2025.aspx).

Campos de retenção anterior são condicionados ao modelo, indFinal, UF e versão normativa.
Na consulta de 11/10/2026 a SEFAZ-SP mantém N12-81/N12a-50 ativas e N12-82/N12a-60 inativas.
Não se impõe base retida/ICMS efetivo a consumidor final SP por exigência genérica do motor.
[Regras facultativas SEFAZ-SP](https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/Regras-de-validacao.aspx).

PIS/COFINS das regras NF-e seguem a orientação de CST99 sem destaque do Portal Nacional.
Não foi aplicada segregação monofásica aos vinhos da posição 2204: o rol de bebidas frias do artigo 14 não
inclui essa posição. [Portal Nacional NF-e](https://www.nfe.fazenda.gov.br/portal/consulta.aspx/perguntasFrequentes.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=3Ow1nfTBzIo%3D),
[Lei 13.097/2015](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13097.htm).
