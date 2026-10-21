# Execução da estrutura fiscal

Continuação de 14/10/2026 na branch `codex/fiscal-autonomia-tributaria`, reconciliada
com main `30e933ff`: PERFIL central/CRT explícito, seletores oficiais, emissão manual
no pedido e FCI versionada. Não reescrever as cargas/ativações históricas abaixo.
[Entrega atual](../fiscal-brasilnfe-m1/OPERACAO-20261014.md) e
[testes/reexecuções](../fiscal-brasilnfe-m1/TASKS.md#fechamento-operacional--14102026).
Código e verificações locais não comprovam homologação externa nem publicação.

Conferência documental em 12/10/2026. Branch `codex/fiscal-produtos-completa-20261011`;
Produção funcional atual `2ec0123e`; a implantação inicial `f833bcaf` permanece registrada
nas etapas históricas abaixo. Emissão real, autoemissão e
substituição do Takeat dependentes de autorização explícita. Este registro não declara
deploy ou homologação completos enquanto a evidência correspondente estiver pendente.

## Etapas e evidências

- [x] Auditoria de produção somente em leitura: matriz privada dos 129 produtos ativos,
  233 insumos e 9 preparações, notas/campos fiscais sanitizados. Nenhuma venda alterada.
- [x] Tabela NCM oficial baixada e códigos/evidências conferidos. Doze grupos GF01–GF12
  sem NCM único; revisão individual separa preparado, revenda, fracionado, kit e configuração.
- [x] SQL aditivo/versionamento, motor servidor, perfis, complementos, precisão Decimal,
  prévia e snapshot v2 implementados; migrations aplicadas em schema local fictício isolado.
- [x] Adaptador real Brasil NFe 55/65 registrado condicionalmente, com tradução de tributos,
  consulta, prévia, identidade, arquivos, cancelamento e quarentena de resultado incerto.
- [x] Painel e edição prospectiva com impacto e autorização administrativa implementados.
  Rota canônica `/financeiro/fiscal/cobertura`; rota antiga de Vendas redireciona especificamente.
  A situação da revisão visual permanece em INTERFACE.md, sem aprovação presumida.
- [x] Registros próprios de regressão final: 33 testes do motor, 15 do catálogo e
  23 de saída fiscal integrada aprovados; lint focal e diff check aprovados.
  PostgreSQL local `teste_estrutura_fiscal`, schema aleatório removido após cada execução,
  fixtures/adaptadores fictícios. Opt-in `PEDIDOS_BANCO_TESTE=1`; sem operação de produção.
- [x] Regressões específicas confirmadas: regras novas na mesma data detectadas no envio
  e claim; snapshot/hash preservados; revisão fiscal nova após rejeição certa; identidade
  e protocolos imutáveis; cancelamento incerto; duplicidade Takeat inclusive após solicitação.
- [x] Homologação externa parcial realizada com credenciais privadas: identidade/CRT 1,
  certificado e prévias; uma transmissão fictícia NF-e 55 em homologação recebeu rejeição 209.
  Consulta confirmou rejeição, sem protocolo; não houve transmissão real ou reenvio.
- [ ] Corrigir IE externa e repetir homologação autorizada: alteração do cadastro da conta
  aguarda autorização específica do usuário. NFC-e 65 depende também de CSC comprovado.
- [x] Regressão global: 3.537 aprovados, 455 opcionais ignorados, nenhuma falha.
  Última revisão fiscal: 219/219; auditoria/acessos/dashboard SQL: 26/26. Lint,
  tipos, webpack e imagens isoladas aprovados tecnicamente. [Validação](VALIDACAO.md).
- [x] Revisão final e backup produtivo verificado por leitura integral/SHA-256;
  imagem anterior preservada por ID imutável. Nenhuma restauração comercial efetuada.
- [x] Publicação funcional f833bcaf em 12/10/2026; Docker Node 22, migrations
  atualizadas, código conferido por hashes, tarefa estável e smoke HTTPS/autenticado.
- [x] Lote aplicado e conferido em produção: 222 versões, 197 ativas, 12 grupos e
  616 eventos. Hashes integrais de produtos/opções e quantidade de documentos preservados.
- [ ] Homologar o ciclo externo de autorização/consulta/arquivos/cancelamento; mocks e
  prévia com tarja não comprovam autorização fiscal. Serviço NFS-e continua pendente.

Logs locais privados: `.tmp/fiscal/regressao-motor-catalogo-final.log` e
`regressao-saida-final.log`. Falhas intermediárias da comparação JSONB e da ordem das
guardas foram corrigidas no serviço, sem afrouxar asserções; os logs intermediários
permanecem separados. A primeira execução sem DATABASE_URL parou antes dos testes.
A execução válida usou `node --env-file=.env node_modules/vitest/vitest.mjs run` com
o guard de banco local. Testes opt-in ignorados não são contados como aprovados.

## Cobertura e lote preparado

| Medida | Quantidade/estado |
| --- | --- |
| Produtos ativos sem código comercial | 129; ID original usado somente para rastreio |
| Classificações confirmadas | 17: 11 NORMAL e 6 OPCAO_CONFIGURACAO |
| Mercadorias pendentes de classificação | 86 |
| Configurações no total | 32 |
| Mercadorias NORMAL com regra comprovada | 9; duas avulsas ainda com exceção de ST |
| Dessas nove: GTIN comprovado / evidência GTIN pendente | 4 / 5; emissão ainda depende da homologação/configuração |
| Regras individuais ativáveis / gerais rascunho | 13 / 3; quatro ativáveis referem-se a opções internas |
| Complementos INCLUIDO ativáveis / MERCADORIA rascunho | 48 / 21 |
| Complementos ainda sem tratamento individual | 52 |
| Versões implantadas / ativas | 222 / 197, recibo real conferido em produção |
| Perfil 2026 / perfil 2027 | Simples com Takeat / LP rascunho sem confirmação |

Tábuas têm apresentação pronta para consumo declarada; o NCM final depende das
características/formulação. Não foi atribuído código genérico. Cestas, queijos por umidade,
presunto por cura/corte/osso e espumantes por método conservam exceções objetivas.
Classificação confirmada é diferente de regra aplicável e de emissor homologado.
Quatro revendas intactas tiveram cEAN/cEANTrib, unidades e quantidades conferidos em dois
XMLs por SELECT somente em leitura. GTIN iguais foram registrados com proveniência; os
13 outros cadastros confirmados não receberam GTIN inferido nem SEM GTIN automático.
[Matriz](MATRIZ.md), [Cobertura](COBERTURA.md), [fontes](REFERENCIAS.md).

O plano prospectivo foi recalculado para 12/10/2026; declarações históricas conservam a
data 11/10. A aplicação deve usar vigência atual/futura e reconferir o catálogo/backup,
sem tratar um dry-run antigo como recibo de implantação.

## Publicação comprovada e próximos dados necessários

Produção executa o commit f833bcaf3b2e59f78f364744bc7dd6ff1c49b0e4, Node 22.23.3,
contêiner 46b755d0c726, tarefa 1kh1kky52yxvkk8hc1ivxd8qg. Dokploy concluiu o
deployment mrY-RUuYZ3LOMSVjeuXsG às 05:13:04 UTC de 12/10/2026; início da tarefa
05:13:06 UTC, sem reinícios nas conferências posteriores. Dez arquivos funcionais
foram comparados com os blobs do commit; prisma migrate status confirmou schema atualizado.
As três migrations manuais/aditivas foram aplicadas. Backup integral foi lido por
pg_restore sem restauração e comparado por SHA-256; imagem anterior preservada por ID.

Antes da carga, o banco da aplicação e o banco auditado foram confrontados por
identificador do cluster, database e schema, sem revelar conexão/credenciais.
Dry-run remoto coincidiu com o lote local; administrador vigente foi relido no
servidor. Recibo registra todos os 222 itens e as 197 ativações. Produtos e opções
permanecem idênticos à auditoria; documentos de saída continuam em zero.
Não houve transmissão real, autoemissão, troca do Takeat ou operação financeira/estoque.

O navegador autenticado confirmou 129 ativos, 11 mercadorias classificadas,
86 mercadorias pendentes e 32 configurações. Perfil 2026 está ativo; LP2027 permanece
rascunho. Exportação real da interface produziu CSV íntegro com os mesmos totais;
matriz privada completa reúne 27 colunas, fontes, parâmetros e IDs de versões,
sem inventar SKU. As três rotas protegidas verificadas redirecionam ao login sem sessão.

As evidências posteriores à publicação ficam nesta branch de trabalho, para não
provocar novo deploy documental; o commit funcional acima é a fonte da produção.
Para homologação externa, concluir a pendência de IE no provedor após autorização
específica e obter CSC 65 quando esse modelo for habilitado. Nenhum escritório contábil
é condição de aprovação. [Operação](OPERACAO.md), [Brasil NFe](BRASIL_NFE.md),
[ritual de publicação](../../contexto/deploy.md).

## Correção aplicada: NCM e grupo no cadastro comercial

Em 12/10/2026, o usuário apontou a ausência dos vínculos efetivos de produtos e
complementos. Foi confirmado em produção: 129 ativos, zero grupos/NCM nos campos
comerciais, apesar das classificações versionadas já implantadas.

- [x] Criar utilitário administrativo conservador, com prévia, autorização no banco,
  backup recente, hash do plano, locks, controle de revisão e auditoria transacional.
- [x] Validar preservação exata do JSONB, conflitos manuais, vigência, kits,
  rollback integral, idempotência e falhas de artefato privado.
- [x] Aplicar 129 vínculos de grupo, 17 NCMs confirmados e duas classificações auxiliares.
- [x] Conferir 129 históricos FISCAL, 131 atividades, hashes de preservação e prévia
  posterior com zero alterações/conflitos.
- [x] Confirmar NCM/grupo na interface autenticada de Produtos e Complementos e
  exportar relatório privado de 129 registros.

Código executado: `scripts/estrutura-fiscal-vinculos.mjs`, SHA-256
`e4266be71a0399be2a6cd1094e9fcf99bdf01de66081d1d584ee750c66ce8ed5`.
Plano aplicado: `a842bd29c9cd7cacdbae0de8d82f2d7b2d78a79db79455357e4a1a667389214e`.
Backup privado novo: `etiquetas-fiscal-vinculos-20261012-001`, 60.576.205 bytes,
leitura integral/listagem por pg_restore verificadas, SHA-256
`421b358b7cc45a3d9a73c90e7f1fdb210c9be5e1a787393c599bd68e7dc4d3e4`.
Cluster/database/schema da aplicação e do backup foram confrontados antes da carga.

O contêiner foi atualizado por publicação paralela do ajuste de validade do certificado
(`9658375a`), preservada nesta operação. A carga ocorreu em `ba22bba2ed89`; tarefa
`ovu851n1p0lncw3yszyw9g36h` estável, sem reinícios, homologação Brasil NFe e produção
desabilitada. Esta correção de cadastros não publicou nova imagem nem alterou migrations.
Os comprovantes ficam na pasta privada do backup e em `.tmp/fiscal`; não integram o Git.

Permanecem as exceções fiscais individuais já descritas: 86 mercadorias precisam de
classificação conclusiva; 39 códigos candidatos não foram promovidos a NCM final.
Escolhas de configuração não se tornam mercadorias independentes por ter NCM cadastral.

## Classificação individual definitiva — publicada e conferida, 12/10/2026

- [x] Reconciliar banco e relatório: 129 produtos ativos, sendo 97 mercadorias e
  32 configurações; os 17 NCMs anteriores incluem seis identidades de configurações,
  restando 11 mercadorias anteriormente classificadas e 86 mercadorias pendentes.
- [x] Consultar novamente as 92 notas armazenadas (277 itens), em transação somente
  leitura, e a tabela NCM oficial vigente em 12/10/2026.
- [x] Acessar a planilha CMV indicada pelo responsável e ler fichas quantitativas,
  processos de preparo, apresentação e componentes das cestas. A fonte foi consultada
  sem alteração; receitas e evidências privadas permanecem em `.tmp/fiscal`.
- [x] Registrar declarações operacionais sobre castanhas torradas, suco de uva com
  maçã, reaquecimento das tortas e ausência de carne no palmito. Os 30% de frango
  declarados como estimativa não constituem percentual medido.
- [x] Concluir matriz individual, inclusive análises fundamentadas, divergências
  documentais, configurações sem NCM e componentes internos dos kits.
- [x] Finalizar metadados de aplicabilidade/confiança, sincronização auditável,
  cenários por escolhas e referências fiscais internas sem criar SKU comercial.
- [x] Concluir manutenção e leitura dos fundamentos na interface, verificações
  de integração/segurança/regressão, build e validação visual isolada.
- [x] Simular carga pelos serviços existentes, criar e verificar backup novo,
  publicar código, aplicar versões prospectivas e conferir 100% do catálogo em produção.

O candidato reúne 129 classificações comerciais e 121 tratamentos de complementos,
com 91 NCMs invariáveis, quatro produtos com 16 cenários e 34 itens sem NCM próprio
(32 configurações e duas cestas discriminadas por componente). Os 17 códigos
anteriores são preservados. Nove referências internas classificam componentes de
cestas sem inventar SKU; três grupos comerciais recebem correção fundamentada.
Há 60 análises de confiança alta e 69 média nos produtos ativos, sem classificação
de confiança baixa promovida a código final. A faixa de frango da torta é uma premissa
declarada pelo responsável, não percentual medido ou comprovação do fabricante.

Vinte e nove composições finais da CMV e sete apresentações inteiramente nas escolhas
documentam os preparados. Não substituem consumo de estoque nem fabricam fotografias
para pedidos históricos. Escolhas equivalentes têm limites quantitativos; frascos e
tortas separados conservam linhas próprias e o total comercial. Extras são mercadorias
separadas conforme declaração operacional. Alterações materiais posteriores invalidam
somente as comprovações afetadas. [Contrato do módulo](../../modulos/fiscal.md).

A conciliação imediatamente anterior à publicação identificou novas entradas e uma
mudança de unidade do insumo coco. O NCM da polpa continua fundamentado; a conversão
entre peso bruto do coco e porção comestível permanece explicitamente pendente no
cadastro afetado, sem fator de estoque inferido. Uma opção de Nuts com composição e
preço próprios aponta para alias inativo: o serviço comercial existente removerá
somente essa referência redundante, preservando porção, preço e demais alternativas.

Testes locais do domínio abrangem autorização, rollback, aplicação e replay, precisão
JSONB, snapshots históricos, cenários, kits e integração de pedidos, com dados
fictícios. A revisão final do servidor aprovou 102 testes em cinco arquivos, incluindo
30 integrações SQL; a interface aprovou 30 testes em três arquivos e o CLI Nuts 12.
Na bateria global: 3.511 aprovados, 682 opcionais ignorados e cinco falhas iniciais.
A verificação direcionada do código integrado aprovou 91 testes, com oito opcionais
ignorados e nenhuma falha, incluindo os cinco casos anteriores e o módulo do certificado.
Os resultados iniciais não foram apagados; não houve afrouxamento de asserções.
Lint focal, tipos, tokens visuais, webpack e imagens isoladas passaram.

Backup privado `etiquetas-fiscal-classificacao-20261012-002` criado em 12/10/2026,
verificado por leitura integral e listagem do dump, com imagem anterior por ID imutável.
Os planos, receitas, XMLs, comprovantes e relatórios de dados reais permanecem privados.

Código funcional `2ec0123e1e5df942ba8142e247285e0e9bbed839`, integrado à correção
de certificado `9658375a`, confirmado na main e na branch fiscal. Dokploy concluiu
`ZQkmcHpxPGe-86XuGh-0e` em 12/10/2026 às 17:32:30 no horário de Brasília.
Tarefa `lkbh3rl6ezr6zd22rv4kxcote`, contêiner `2fbbe32357d2`, início às 17:32:35,
sem reinícios nas duas conferências espaçadas. Dezessete hashes de execução coincidem
com o commit; migrations atualizadas e configuração do certificado preservada.

A correção Nuts passou por prévia revertida, aplicação e replay sem nova alteração.
O lote fiscal passou por prévia integral revertida e aplicação transacional dos
260 registros. Hash aprovado `28ec0a031538664d23cc387765fc34ef8af31ffd00a13c6836016451237c5283`.
Replay conferiu o mesmo recibo, sem novas versões. Leitura posterior confrontou
todos os 260 dados ativos com a entrada normalizada e os IDs/hashes do recibo:
129 produtos, 121 complementos, nove referências internas, 29 fichas, 16 cenários,
17 NCMs anteriores preservados e três grupos corrigidos, sem erro de auditoria.

Os 80 novos campos NCM invariáveis somam-se aos 11 de mercadorias anteriores.
Quatro produtos discriminam NCM por escolha; 34 registros não têm NCM próprio.
Os seis códigos legados de opções conservam sua identidade comercial sem gerar
linha fiscal independente. Cinquenta e nove complementos são mercadorias separadas;
48 escolhas incluídas e 14 configurações integradas seguem a preparação principal.
NCM completo não significa aptidão irrestrita para emitir: origem, GTIN, retenção/ST,
contexto tributário e homologação permanecem guardas próprias da operação.

O navegador autenticado confirmou NCM/grupo e fontes na tela de vínculos, incluindo
Provolone porção versus opção incluída e os dois sabores da torta. O painel mostrou
129 ativos, 34 casos de NCM não aplicável e quatro conforme escolha. As duas rotas
publicadas redirecionam ao login sem sessão. Os CSVs privados conferidos contêm
154 linhas de produtos/cenários/referências e 121 linhas de complementos.

Pedidos anteriores (12) e lançamentos anteriores (699) conservaram seus hashes;
documentos/eventos fiscais de saída permaneceram em zero. Não houve transmissão real,
autoemissão, troca do Takeat, reativação de aliases ou mudança antecipada de regime.
Brasil NFe continua em homologação com produção desautorizada. Evidências posteriores
ficam nesta branch, sem gerar deploy documental adicional.

### Revisão dos avisos operacionais — 12/10/2026

A auditoria posterior encontrou 47 avisos resolvidos pelos pareceres e vínculos novos,
em 40 classificações. Sua retirada usa lote prospectivo separado, preservando NCM,
grupo, estado, origem, parâmetros e fotografias; avisos reais permanecem.
O serviço repetia a mesma fundamentação nas observações do produto e impediria sete
revisões pelo limite de 2000 caracteres. A sincronização passa a conservar o texto
existente quando a última nota automática é idêntica, mantendo nova versão, referência
e auditoria. Notas diferentes continuam limitadas, sem truncamento.

Validação desta correção: 105 testes fiscais aprovados, incluindo 33 de integração
no PostgreSQL local fictício; lint focado, typecheck e build webpack aprovados.
O teste de CLI atingiu o limite de cinco segundos na primeira rodada concorrente;
as rodadas sequenciais passaram sem alterar limite ou asserções. Backup privado003
verificado por SHA-256 e leitura integral antes da publicação; nenhuma restauração.
Correção funcional `f396f7f9` publicada em produção; Dokploy
`BP5f_1HKW8ySiyzQsWXud` concluído às 18:52:49 de Brasília. Nova tarefa estável,
sem reinícios, 17 hashes de execução conferidos, migrations atualizadas e configuração
fiscal preservada. Brasil NFe continua em homologação, com produção desautorizada.

O lote separado passou por prévia revertida, aplicação transacional e replay sem novas
versões. Leitura posterior confirmou as 40 CLASS3 e as 47 remoções exatas; preservou
integralmente as 482 versões anteriores, todos os NCMs, grupos, parâmetros, receitas
e observações do cadastro. Os recibos original e da revisão foram conferidos
separadamente. Permanecem 260 vínculos vigentes e 522 versões totais.
Os 12 pedidos e 699 lançamentos anteriores conservaram hashes, sem documentos/eventos
fiscais de saída novos. A conferência autenticada confirmou os vínculos e a retirada
dos avisos antigos, mantendo as pendências reais de origem e conversão do coco.
CSV de produtos atualizado pelas versões finais: 154 linhas; complementos: 121 linhas,
sem mudança nos vínculos. Evidências/dados reais permanecem privados fora do Git.
