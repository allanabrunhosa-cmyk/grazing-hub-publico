# Matriz fiscal de saída — proposta inicial Grazing (11/10/2026)

**Estado global: RASCUNHO PARA REVISÃO INTERNA.** Não é cadastro tributário aprovado nem autorização de homologação. Aplicação geográfica inicial: **saídas internas no Estado de São Paulo, Brasil**; regime atual **Simples Nacional**; modelos 55/65 conforme destinatário/operacão. Para regime Lucro Presumido pretendido em 2027, abrir versão futura separada, somente após confirmação do enquadramento.

Na Issue #8, esta matriz orienta propostas com fundamentação e aprovação interna.
Nenhuma linha é importada automaticamente, nenhuma regra real foi aprovada pela
execução e nenhum produto recebe classificação a partir desta tabela. O regime
Simples informado para 2026 ainda deve ter sua evidência administrativa vinculada
à regra; a intenção de migração em 2027 não muda a vigência atual.

O Brasil NFe é o provedor tecnológico das notas próprias. Notas recebidas permanecem diretas com a SEFAZ; não importar catálogos fiscais de terceiros.

## Grupos candidatos de negócio (não necessariamente um NCM por grupo)

| Identificador | Operação/produto representativo | CFOP **candidato** em venda interna SP | Fundamentação | Pendências obrigatórias |
| --- | --- | --- | --- | --- |
| F01 — alimento preparado no local | mini sanduíches, bolos/tortas e outras preparações feitas pela Grazing | **5.101** | RC SP 34.039/2026: preparo de alimentos no estabelecimento como produção; também RC 32.784/2025 | NCM item a item por ingredientes/processo/apresentação; origem, CSOSN conforme regime efetivo, PIS/COFINS e demais campos; especificar se as operações realmente correspondem ao entendimento |
| F02 — revenda de terceiros sem ST | produto de terceiros sem qualquer elaboração, não sujeito a ST na operação | **5.102** | RC SP 34.039/2026 | Verificar XML do fornecedor, NCM, CEST quando listado, ICMS/ST aplicável, unidade e destino; se sofrer preparo, avaliar F01 |
| F03 — revenda sob ST | bebida ou produto de terceiro adquirido com ST e vendido como substituído | **5.405** **somente** se confirmada essa condição | RC SP 34.039/2026 | Provar ST/substituído pelo produto/mercadoria e legislação atual, conferir NCM/CEST e documento de entrada |
| F04 — tábuas de frios / kits / cestas montadas | composições de queijo, embutidos, pães, acompanhamento, embalagem e presente | **NÃO DEFINIDO** | Requer distinguir elaboração/preparo de simples agrupamento, regra de apresentação da mercadoria e componentes | Identificar produto comercial versus itens fiscais, composição, preparo, embalagem, NCM(s), regra de itemização e ICMS. Não aplicar automaticamente 5.101 nem NCM genérica do nome da tábua |
| F05 — eventos e serviços associados | montagem no local, serviço de buffet, entrega, locação, equipe, quando vendidos de forma autônoma | **NÃO DEFINIDO** | Fato gerador e natureza da operação devem ser examinados | Separar mercadoria de prestação de serviço e, quando cabível, NFS-e; fora da primeira homologação 55/65 |
| F06 — embalagens/acessórios vendidos isoladamente | caixas e itens de presente cobrados em separado | **NÃO DEFINIDO** | Regra conforme natureza de mercadoria e proveniência | Rever se é parte do preço do produto ou venda autônoma e classificação fiscal |

### Estado da revisão por recorte

| Recorte | Estado desta proposta | Critério para avançar |
| --- | --- | --- |
| F01 | CFOP candidato; classificação do produto pendente | Confirmar preparo real, descrição técnica, NCM e tributos com fonte específica; revisão interna por campo |
| F02 | CFOP candidato condicionado à revenda sem ST e sem elaboração | Evidências do produto e da operação, legislação ST vigente e tributação federal aplicável |
| F03 | Revisão especializada quando ST/substituído não estiver comprovado | Confirmar NCM + descrição + CEST quando cabível + hipótese legal + operação; documento de entrada é evidência complementar |
| F04 | Bloqueado para apresentação fiscal ainda indeterminada | Definir itemização, composição e classificação fundamentadas; não usar NCM única pelo nome do kit |
| F05/F06, interestaduais e especiais | Fora do piloto e bloqueados enquanto sem regra específica | Criar proposta própria com alcance e requisitos demonstrados; não herdar a regra interna SP |

Esses estados são instruções de revisão da proposta documental, não estados
gravados em produtos reais. No HUB, uma ambiguidade material bloqueia a regra ou
o item afetado. As regras independentes, completas e aprovadas internamente podem
continuar a preparação local; isso não habilita transmissão.

No vínculo do plano, destinatário fiscal em UF diferente da fundamentação interna
ou CFOP fora da família interna iniciada por 5 gera pendência de alcance. Essa
restrição não seleciona código nem aprova qualquer CFOP iniciado por 5. Não aplicar
F01/F02/F03 internos a operação interestadual
por semelhança do produto, nem trocar a UF da fonte para vencer a conferência do
emitente. Esse caso exige fundamento próprio, nova versão e contrato/testes de
alcance adequados. A extensão permanece fora do piloto, sem impedir concluir a
Issue #8 ou as preparações internas independentes.

### Regras de segurança

- A coluna CFOP é **candidata**, não um valor padrão gravado no banco. Selecionar somente após comprovar o tipo de operação e obter aprovação interna.
- Nenhum **NCM** é atribuído por inferência de nome; pesquisar descrição técnica do item no [Classif da Receita](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif), notas legais e soluções publicadas. XML de nota anterior é referência cruzada, não validação legal definitiva.
- CEST depende da correspondência NCM + descrição em lista aplicável; não concluir ST apenas pela presença de CEST.
- Não inferir CSOSN/PIS/COFINS, alíquotas, benefícios, IBS/CBS, serviço, destinatário, natureza/CFOP interestadual, troco/cartões ou unidade tributável a partir de exemplo público. Definir aplicabilidade ou pendência fundamentada.
- Manter dados comerciais, frete, descontos e pagamentos fotografados; não gerar lançamentos financeiros ou de estoque durante preparação fiscal.
- CFOP 5.101 **não determina automaticamente o anexo de tributação pelo Simples** (RC SP 32.784/2025). Controle o regime e a segregação de receitas separadamente.
- Não aplicar o regime especial paulista de ICMS de **4%** automaticamente: Decreto 51.597/2007 com redação de 2025 e RC SP 33.885/2026; é opcional e condicionado, com implicações relevantes para futuro regime normal.
- Fonte e responsável registrados, com versão/validade. Ausência de aprovação externa genérica não pode bloquear a definição interna bem fundamentada, mas campos fiscais ainda não esclarecidos bloqueiam somente o produto/operação afetado.
- Evidência por campo distingue fundamento oficial, prática histórica em XML e sugestão de pesquisa. XML histórico não é prova jurídica autônoma, e referência pública genérica não resolve a aplicação ao produto. Registrar limites e justificar a decisão interna; nenhum estado de confiança é promovido automaticamente.
- Para NCM duvidosa, consultar Classif, notas legais e soluções anteriores; a [consulta formal de classificação](https://www.gov.br/pt-br/servicos/formalizar-consulta-sobre-classificacao-fiscal-de-mercadorias) é recurso disponível quando persistir dúvida. Parecer da Confirp ou de outro especialista é opcional, salvo obrigação específica ou incerteza material que impeça concluir o caso.

## Amostras do catálogo público Grazing para direcionar a revisão

Conferência feita em 11/10/2026 no site público; **não** substitui cadastro operacional atual, composição real, XML anterior ou classificação fiscal validada.

| Produto do catálogo | Candidato de análise | Próxima verificação |
| --- | --- | --- |
| [Sanduíches no mini brioche – 20 un](https://grazingtable.com.br/produto/caixa-de-mini-sanduiches-gourmet-brioche/) | F01: preparo/montagem de sanduíches no estabelecimento | Confirmar produção efetiva, ingredientes e forma de fornecimento; classificar NCM específica do produto completo; melhor candidato inicial para manifesto 55 quando validado |
| [Gran Búfala Rolls](https://grazingtable.com.br/) e espetinhos | F01 ou F04 conforme preparação efetiva | Validar se há produção de alimento novo e se a apresentação é unidade preparada ou kit misto |
| [Grazing para 10](https://grazingtable.com.br/produto/tabua-de-frios-grande-para-10-pessoas-grazing-para-10/) | F04: tábua composta | Levantar itens, montagem e apresentação fiscal; impedir escolha automática de NCM única pelo nome comercial |
| [Mix de Nuts](https://grazingtable.com.br/produto/mix-de-nuts-selecionadas/) | F01/F02/F04 a determinar | Verificar se é mistura preparada no estabelecimento, fracionamento/reacondicionamento ou revenda; composição e NCM |
| Adicionais como queijo, embutidos, patês, pesto, embalagens | F01/F02/F03/F06 conforme item | Distinguir produção própria declarada, revenda e ST; avaliar se vendidos como item independente ou parte da cesta/tábua, e como o complemento aparece no documento fiscal |

Não copiar preços atuais para o manifesto sintético nem assumir que um complemento comercial é obrigatoriamente uma linha fiscal separada.

## Primeiro cenário de homologação 55 proposto

Escolher **um produto realmente preparado** pela Grazing, vendido em operação interna SP; destinatário inteiramente **sintético** (não usar pessoa real); R$ 10,00 conforme roteiro técnico existente. Antes de preparar manifesto, preencher endereço cadastral oficial do emitente, NCM do item pela sua composição e classificação válida, operação/pagamento e todos os campos requeridos; registrar fundamento legal e **aprovação interna autorizada**. Usar habilitação manual exclusiva do documento aprovado quando o requisito técnico de recuperação/retentativa estiver seguro. A aprovação do manifesto 55 pelo usuário é independente de aprovação de 65 ou de cancelamento. Nenhuma transmissão foi autorizada aqui.

## Fontes

Reconferência pública em **11/10/2026, Brasília**. RC 34.039/2026 é orientação em
tese, não lista de classificações do catálogo. O alcance jurídico e as datas de
publicação estão em [AUTONOMIA-FISCAL](AUTONOMIA-FISCAL.md#referências-oficiais-conferidas-não-são-autorização-automática-para-todos-os-produtos).

- [SEFAZ-SP RC 34.039/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC34039_2026.aspx)
- [SEFAZ-SP RC 32.784/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC32784_2025.aspx)
- [SEFAZ-SP RC 33.885/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33885_2026.aspx)
- [Receita — Classif](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif)

## Primeiro recorte F01 pesquisado —12/10/2026

Sanduíches Brie/geleia e Minas/geleia: peso nominal54g/51g conforme ficha e
confirmação do usuário; pão comprado pronto, corte/recheio local, venda resfriada
em celofane/adesivo/bandeja. Proposta fundamentada1905.90.90/5.101, sem aplicação
automática à família de sete sabores. IPI/CEST e regime têm condições próprias.
[Dossiê com fontes e alcance](PILOTO-55-CLASSIFICACAO.md),
[impedimentos do manifesto](PILOTO-55-IMPEDIMENTOS.md).
