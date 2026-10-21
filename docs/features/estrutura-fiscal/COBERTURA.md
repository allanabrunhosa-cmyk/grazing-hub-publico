# Cobertura da auditoria fiscal inicial

## Correção dos vínculos comerciais em 12/10/2026

Após a implantação versionada, foi confirmado que os campos exibidos em Vínculos
fiscais continuavam vazios. A carga corretiva administrativa preencheu os grupos dos
129 registros ativos e 17 NCMs comprovados (11 mercadorias e seis configurações).
Os 39 NCMs de entrada ainda candidatos ficaram apenas nas observações; as 86
mercadorias pendentes conservam a exceção individual e o bloqueio da operação afetada.

Foram mantidos os 12 GF e criados dois auxiliares cadastrais sem parâmetros comuns:
KIT_COMPOSTO e OPCAO_CONFIGURACAO. A cesta mista sem grupo operacional recebeu
KIT_COMPOSTO para organização, conservando a classificação central pendente e sem
NCM único. Os demais registros receberam o GF da sua classificação vigente.

O recibo real confirma 129 alterações, dois auxiliares, 129 históricos FISCAL e
131 atividades vinculadas à auditoria. A conferência seguinte, somente leitura,
indicou zero alterações/conflitos. Hashes confirmaram a preservação de inativos,
preços e demais dados comerciais, opções, composições, vínculos comerciais,
versões tributárias e documentos. A cobertura central continua 11/86/32.
O navegador autenticado confirmou NCM e grupo nas abas Produtos e Complementos.
As contagens dessas abas incluem inativos e papéis sobrepostos; não somar 55 e 118.

Relatório privado atualizado: `.tmp/fiscal/entrega/vinculos-fiscais-produtos-complementos.csv`,
129 linhas, com grupo cadastral, NCM realmente inserido, candidato separado, referência
da versão, evidências e pendências. Nenhum SKU foi inventado. A carga não transmitiu
documentos nem modificou emissão automática. [Procedimento](OPERACAO.md).

O lote foi aplicado em produção em 12/10/2026: 222 versões, 197 ativas, 12 grupos.
O painel e a exportação autenticada confirmam 129 ativos: 11 mercadorias com
classificação confirmada, 86 pendentes e 32 opções de configuração. As 17
classificações confirmadas do estudo incluem seis opções internas; não são 17
mercadorias aptas para emissão. Histórico e primeiro diagnóstico abaixo são preservados.

## Catálogo observado em 11/10/2026

| Medida | Quantidade |
| --- | ---: |
| Produtos comerciais, ativos e inativos | 158 |
| Produtos comerciais ativos, sem duplicar papéis | 129 |
| Ativos com papel PRINCIPAL | 54 |
| Ativos com papel OPCAO/COMPLEMENTO | 90 |
| Ativos sem SKU/código comercial | 129 |
| Ativos com NCM/grupo/conferência no cadastro anterior | 0 |
| Insumos ativos | 233 |
| Preparações próprias ativas | 9 |
| Opções ativas, todas vinculadas a produto | 121 |
| Itens de NF recebida auditados | 277 |
| Itens com NCM válido e insumo vinculado | 268 |
| XMLs com extração tributária sanitizada | 92 |
| Itens com origem no XML / com CEST no XML | 277 / 113 |
| Grupos fiscais / documentos de saída anteriores | 0 / 0 |

PRINCIPAL e OPCAO/COMPLEMENTO são papéis sobrepostos do mesmo registro; as contagens não devem ser
somadas. Nenhum produto ativo estava marcado como REVENDA no tipo comercial: PADRAO não é prova
de produção própria. A origem operacional deve ser resolvida por mercadoria.

## Resultado da matriz privada

| Medida | Quantidade |
| --- | ---: |
| Registros ativos com composição base | 91 |
| Registros ativos sem composição base quantitativa | 38 |
| Registros com NCM de entrada candidato de insumo simples | 56 |
| Candidatos encontrados e vigentes na tabela NCM oficial de 11/10/2026 | 56 |
| Registros usados exclusivamente como opções de configuração | 32 |
| Mercadorias/classificações ainda pendentes | 97 |
| Classificações confirmadas para emissão pela auditoria automática | 0 |

A confirmação não foi deduzida de nomes, preenchimento, existência do código ou ausência de
erro no software. A matriz registra a característica ausente em cada item e conserva notas,
fichas e referências oficiais para validação técnica individual. Esses números são o retrato
inicial; o painel calcula a cobertura das versões vigentes após cada correção/ativação.

Uma revisão técnica individual posterior identificou 17 registros com identidade, NCM e origem
suficientemente fundamentados por composição e notas do mesmo produto. A proposta privada
`classificacoes-casos-revisao.json` conserva cada justificativa e os dados essenciais ausentes nos
39 outros candidatos de entrada. O bootstrap só incorpora essa revisão mediante `--revisoes`.
Isso confirma a identidade fiscal individual; operação/ST e capacidade do emissor continuam
verificações próprias. A aquisição interna de mercadoria estrangeira tem origem de revenda
avaliada sob a perspectiva da Grazing. [SEFAZ-SP, RC 30043/2024](https://legislacao.fazenda.sp.gov.br/Paginas/RC30043_2024.aspx).

A revisão técnica documentada produziu o seguinte lote, ainda distinto de implantação e de
homologação externa:

| Medida | Quantidade |
| --- | ---: |
| Classificações individuais confirmadas | 17 |
| Confirmadas: mercadoria NORMAL / opção interna | 11 / 6 |
| Mercadorias ainda pendentes de classificação | 86 |
| Opções de configuração, confirmadas ou pendentes | 32 |
| Classificações com CEST nacional comprovado | 12 |
| Declarações operacionais de preparações GF01 | 26 |
| Regras individuais SN 2026 tecnicamente ativáveis | 13 |
| Regras ativáveis: mercadoria NORMAL / opção interna | 9 / 4 |
| Exceções ST de salame/pastrami: NORMAL / configuração | 2 / 2 |
| Regras gerais em rascunho | 3 |
| Perfil 2026 ativável / 2027 rascunho | 1 / 1 |
| Complementos INCLUIDO ativáveis / MERCADORIA rascunho | 48 / 21 |
| Complementos que ainda exigem definição individual | 52 |
| Registros no plano / tecnicamente ativáveis | 222 / 197 |

Classificação confirmada não significa emissão liberada. Dois produtos avulsos classificados
ainda precisam comprovar retenção ou antecipação na operação. Tampouco a regra de uma opção
interna gera uma linha fiscal independente quando ela integra uma preparação. O plano conserva
Takeat, não habilita autoemissão e não transmite documentos.

Grupos sugeridos apenas para organização: GF01 26, GF02 7, GF03 4, GF04 8, GF05 59,
GF06 8, GF07 1, GF09 2, GF10 13; uma cesta exige definição de grupo conforme a composição.
GF08, GF11 e GF12 permanecem disponíveis para cadastros/operações que correspondam a esses grupos.

O perfil-base do próprio estabelecimento foi conferido por correspondência de CNPJ com o cadastro
e consenso de IE/UF/código municipal em 40 XMLs recentes. A evidência permanece privada.
Regime 2026 decorre da declaração expressa do administrador nesta solicitação. A preparação de
Lucro Presumido 2027 permanece em rascunho, sem confirmação ou ativação antecipada.

## Validação e limites

Os testes sintéticos de `testes/tributacao/catalogo.test.ts` cobrem identidade, inativos, evidência
de entrada, receita versus NCM de ingrediente, configuração gratuita/cobrada, extras, kits,
origem, conflito de NCM, descrição hierárquica e vigência. Não operam dados reais.
Lint focado e execução do exportador privado foram conferidos; a segunda é auditoria, não
homologação externa. A bateria integrada, segurança, build, publicação e homologação do provedor
devem ser registradas na execução da feature conforme os resultados efetivamente obtidos.

Em 11/10/2026, 15 testes do catálogo e 11 testes de `estrutura-integracao.test.ts` passaram.
A integração foi executada no PostgreSQL local `teste_estrutura_fiscal`, com todas as migrations
em schema temporário próprio, removido ao concluir. Verificou sessão revogada, administrador,
concorrência/revisão, idempotência, impacto desatualizado, vigência futura, LP sem confirmação,
imutabilidade de dados/hash/exclusão e preservação de eventos, cadastro legado e snapshot anterior.
Uma fixture de permissões usava formato incorreto na primeira execução; foi corrigida e a
execução final passou integralmente. Nenhum teste usou dados reais.
Uma execução focal encontrou bloqueio de cache temporário pelo sandbox antes de coletar testes;
a execução autorizada seguinte concluiu os 15 casos. Lint focal dos cinco arquivos do catálogo,
bootstrap e testes concluiu sem erros. O dry-run de 222 registros preservou 0 documentos transmitidos.

O bootstrap preserva Takeat e não transmite documentos, cancela notas, muda status comercial,
cria faturamento ou habilita autoemissão. Revisão posterior pode corrigir configuração versionada
sem reescrever documentos históricos; não há condição de aprovação por escritório contábil.
