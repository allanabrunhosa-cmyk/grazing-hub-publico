# Estrutura fiscal dos produtos

[Execução e cobertura](TASKS.md) · [Validação técnica](VALIDACAO.md) · [Operação](OPERACAO.md).

## Objetivo e limites

Implantar GF01–GF12, classificação individual com evidências, regras por vigência e prévia
integrada a produtos/pedidos. Validação técnica interna permite ativação; revisão contábil
posterior pode propor versões novas, sem condição de aprovação prévia por escritório.
Emissão real, autoemissão e substituição do Takeat exigem autorização explícita do usuário.
iFood, estoque, status comerciais e financeiro conservam seus contratos.

## Auditoria e cobertura

Produção foi consultada somente em leitura em 11/10/2026: 129 produtos ativos, 54 PRINCIPAL,
90 OPCAO/COMPLEMENTO com papéis sobrepostos, 233 insumos, 9 preparações e 121 opções vinculadas.
Havia 277 itens de notas recebidas, 268 com NCM válido e insumo vinculado, nenhum grupo fiscal
ou documento de saída anterior. O catálogo ativo não tinha código comercial nem classificação
fiscal anterior. O ID original é referência interna de rastreio, sem inventar SKU comercial.

A matriz individual privada incorpora 17 confirmações fundamentadas: 11 mercadorias NORMAL
e 6 opções internas. Há 86 mercadorias pendentes de classificação e 32 configurações no total.
Nove mercadorias NORMAL têm também regra de operação comprovada; duas avulsas ainda precisam
comprovar retenção/antecipação de ICMS-ST. Classificação confirmada não é autorização de emissão.
Entre as nove com regra, quatro revendas em embalagem original têm GTIN comercial/tributável
igual comprovado nas notas; cinco ainda precisam identificar GTIN ou declarar explicitamente
SEM GTIN com evidência da apresentação vendida. Não copiar código de embalagem de compra
para produto fracionado/preparado. A ausência desse dado bloqueia a linha fiscal afetada.
[Matriz](MATRIZ.md) e [Cobertura](COBERTURA.md) discriminam critérios e evidências sem publicar
o export real, XMLs, chaves fiscais, formulações ou informações pessoais.

As tábuas foram declaradas montadas, prontas para consumo, com ingredientes cortados e
combinados. A declaração resolve sua apresentação como preparação, sem atribuir NCM genérico.
Formulação/características determinantes permanecem necessárias. Cestas distintas conservam
componentes fiscais individuais. [Classif/RFB](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif),
[RC 31558/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC31558_2025.aspx).

## Arquitetura implementada

| Área | Caminhos e contrato |
| --- | --- |
| Domínio fiscal | `src/lib/tributacao/tipos.ts`, `validacao.ts`, `motor.ts`, `gtin.ts`: contexto, códigos/GTIN, Decimal, vigência, linhas, cálculo e justificativas. |
| Manutenção servidor | `src/lib/tributacao/servico.ts`: administrador vigente, versões, impacto, ativação prospectiva e auditoria. |
| Catálogo | `src/lib/tributacao/catalogo.ts`, `heranca.ts`: matriz, identidade, composição, evidências, herança e cobertura. |
| Pedidos | `src/lib/tributacao/pedidos.ts`: resolve a operação no servidor e produz o documento para o adaptador. |
| Saída durável | `src/lib/fiscal-saida/servico.ts`, `contrato.ts`: fotografia imutável, revisão fiscal, ações, lease, eventos e arquivos. |
| Brasil NFe | `brasil-nfe.ts`, `brasil-nfe-contrato.ts`, `brasil-nfe-destinatario.ts`, `brasil-nfe-impostos.ts`: 55/65, identidade, tradução dos campos já calculados, consulta, prévia e cancelamento. |
| Carga controlada | `scripts/estrutura-fiscal-catalogo.ts`, `estrutura-fiscal-implantacao.ts`: export/plano privado, dry-run padrão, administrador, backup e conferência do catálogo antes de aplicar. |

`VersaoEstruturaFiscal` mantém CLASSIFICACAO/PERFIL/REGRA/TABELA/COMPLEMENTO com conteúdo/hash
imutáveis; eventos conservam impacto e ativação. Migrations SQL são aditivas e manuais.
`GrupoFiscalVenda.codigo` organiza GF01–GF12 sem NCM único nem sobrescrita dos cadastros anteriores.

Complementos têm tratamento INCLUIDO/INTEGRADO/MERCADORIA/APRESENTACAO por vínculo. Mercadoria
separada exige unidade e valor comprovados; divergência de unidade não converte a quantidade
silenciosamente. Kits discriminam nome/unidade/NCM das mercadorias comerciais e rateiam centavos.
Ingredientes de receita não viram linhas de kit automaticamente.

## Documentos e estados

O snapshot `grazing.fiscal-saida` versão 2 registra a prévia, documento calculado, versões/fontes,
pedido, destinatário, valores e parcelas. Payloads v1 históricos permanecem preservados; não
são convertidos em documentos calculados nem enviados como se fossem v2. Revisão fiscal é
independente da revisão comercial. Alteração de regra/data gera outra fotografia; rejeição ou
cancelamento certos permitem uma nova revisão explícita, inclusive com payload comercial igual.

Antes da solicitação e do claim, o servidor confere estado/revisão, Takeat/documento externo e
o cálculo vigente por hash canônico. O hash original do payload histórico não é reescrito.
Autorização ou resultado pendente de outra revisão impede duplicidade. Nenhuma ação fiscal
gera receita financeira, cancela pedido ou movimenta estoque.

AUTORIZADO e CANCELADO conservam identidade e protocolos em consultas, timeouts e retornos
regressivos/divergentes; estes são auditados. `protocolo` é a autorização original e
`protocoloCancelamento` é o evento aceito, nunca um substituto da autorização.

O identificador Brasil NFe não garante idempotência externa. Ausência após tentativa incerta
fica em PENDENTE_CONFERENCIA e bloqueia reenvio. Consulta de cancelamento sem prova específica
do protocolo do evento exige conferência no emissor. [Contrato de consulta](https://www.brasilnfe.com.br/api/consultas),
[Eventos do provedor](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e).

## Regimes e limites tributários

Perfil 2026: Simples Nacional declarado pelo administrador e CRT 1 conferido no provedor,
sem ativar benefício opcional paulista. Perfil LP 2027: rascunho sem confirmação cadastral,
com vigência prevista em 01/01/2027, sem alíquotas CBS/IS estimadas ativadas. O motor exige
regras/tabelas compatíveis e bloqueia a operação que carece de parâmetros; não antecipa o regime.
[LC 214/2025 atualizada](https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html).

IRPJ/CSLL recebem somente segregação de receitas por linha; este motor não executa apuração,
percentuais de presunção, compensação ou cálculo de débito desses tributos. CST/CFOP/CEST e
CBS/IBS não são deduzidos do grupo comercial. O decreto paulista opcional tem vigência consultada
até 31/12/2026 e exclui Simples; prorrogação/elegibilidade em 2027 precisam de nova evidência.
[Decreto 51.597/2007](https://legislacao.fazenda.sp.gov.br/Paginas/dec51597.aspx).

Serviços de eventos permanecem sujeitos à identificação do serviço/município e capacidade
NFS-e efetiva; o adaptador 55/65 não simula emissão de serviço. A existência de API NFS-e
pública não comprova habilitação do estabelecimento. [NFS-e do provedor](https://www.brasilnfe.com.br/api/nfs-e).

## Interface, validação e implantação

Produtos conservam a aba Fiscal; `/financeiro/fiscal/cobertura` centraliza versões, evidências,
regras/perfis, cobertura e impacto; o pedido mostra prévia e gestão fiscal. Salvamento é
explícito, com autorização administrativa no servidor. Padrões visuais e estado da referência
permanecem no documento da interface, sem aprovação visual presumida.
A rota antiga `/vendas/fiscal/cobertura` permanece como redirecionamento específico de compatibilidade.

Homologação externa foi parcial: identidade/CRT, certificado e prévias confirmados; a única
transmissão fictícia de NF-e 55 foi rejeitada com código 209 (IE do emitente inválida), sem
protocolo de autorização. Correção externa da IE aguarda autorização específica; CSC de
homologação para NFC-e 65 e integração NFS-e não foram comprovados. [Evidência e limites](BRASIL_NFE.md).

Aceite exige SQL local isolado, regressão, autorização/segurança, lint/design/tipos/build,
backup verificável, publicação e smoke autenticado. Resultados globais/deploy em andamento
não são considerados concluídos por esta especificação. [Execução](TASKS.md),
[Operação](OPERACAO.md) e [Deploy](../../contexto/deploy.md) registram a sequência.
