# Correção de SEM GTIN e origem nacional

Instruções do responsável em 21/10/2026: nenhum produto vendido possui GTIN;
as preparações próprias usam ingredientes exclusivamente nacionais. A correção
registra esses fatos no cadastro fiscal por novas versões, com vigência atual,
autoria, análise de impacto e ativação. Usa o serviço já publicado no HUB.

## Operação R4 aplicada

- 139 classificações: 130 produtos ativos e nove referências vendidas em kits.
- SEM GTIN nas 139. Antes: 134 ausências, quatro códigos e um SEM GTIN.
- 33 preparações recebem origem 0: 32 sem origem e Grazing para 1, antes com origem 5.
- 11 preparações normais já nacionais conservam a origem 0.
- 40 estados pendentes resolvidos: 32 preparações, dois cabeçalhos de kit e seis referências.
- Nove mensagens GTIN resolvidas foram retiradas; três referências mantêm pendência CEST.
- Dois hashes da fotografia do Pesto na Cesta de Pães e Crackers foram alinhados à
  classificação individual ativa. Quantidades, unidades, escolhas, rateio e tributos iguais.
- 125 classificações confirmadas e 14 pendentes após R4.

A Grazing para 1 (tábua de frios) era o produto com declaração FCI limitada ao modelo 55.
A nova classificação nacional retira a decisão FCI somente da versão nova.
Toda a memória e a declaração anterior permanecem imutáveis. A origem dos
componentes continua obrigatória nos kits; o cabeçalho agregado não recebe uma
origem artificial. O cadastro original dos insumos de compra é preservado.

Prévia transacional e comparação campo a campo passaram antes da aplicação.
O serviço oficial gravou e ativou as novas versões. As 720 versões anteriores e
os campos protegidos das 14 tabelas permaneceram idênticos. A projeção comercial mudou
somente pelos serviços oficiais. O recibo foi gravado. A repetição retornou
`aplicadoAnteriormente`, sem criar versões.

Plano R4: `1a2de944f25cc4fe60a7a99df9bd022ba0e7980bcf6f6692fc74ae119e47a14c`.

## Proteção da instrução anterior

O atalho fixo de 15/10/2026 somente atende versões sem origem definida.
A interface o oculta quando a origem já existe. O servidor rejeita a tentativa
antes de criar rascunho ou evento. Uma nova revisão usa o formulário normal,
com fundamento próprio. A proteção impede reintroduzir a declaração antiga
de origem 5 e alcance 55 sobre a classificação nacional atual.

Reutilizados: EditorVenda, Dialog, seletores fiscais, Button e tokens existentes.
Não há dependência, variante, migration ou mudança do fluxo de emissão.

## Pendências que exigem informação distinta

O complemento de CEST foi aplicado depois da R4 e após conferir a main
`50f87012`. A tabela parcial conserva suas sete linhas e acrescenta dois códigos:
Cream Cheese `1702405` / NCM `04061090`; Presunto Cru `1708701` / NCM `02101900`.
As duas referências foram confirmadas. Seus demais campos e fotografias ficaram
idênticos. A fonte é o [Convênio ICMS 142/18, Anexo XVII, itens 24.5 e 87.1](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18).

Plano CEST: `d37a3b99b96dfc11a30ec7c4a4fff564db9ec1875827dbc79a6790cc24bbcdbf`.
Somente três versões novas: tabela parcial e duas classificações. As 859 versões
anteriores, os 2.522 eventos anteriores, a R4 e as 13 tabelas protegidas ficaram
preservados. O recibo durável e a idempotência passaram. Os quatro diagnósticos
locais das duas referências nos modelos 55/65 ficaram aptos. Isso não é uma
autorização da SEFAZ nem emissão externa.

Totais finais: **139 SEM GTIN; 127 confirmadas e 12 pendentes**.

| Item | Informação pendente |
| --- | --- |
| Lombo Canadense 100 g; Copa 100 g; Salame 100 g; Pastrami 100 g | Comprovação de retenção/regularização de ST |
| Torta artesanal 1,2 kg da Torta no Quintal, opção Frango | Comprovação de retenção/regularização de ST |
| Lombo Defumado, referência de kit | CEST e compatibilidade da classificação com a mercadoria |
| Coco 100 g | Conversão da receita de 0,4 UN do insumo para KG e rendimento da porção |
| Brie; Gouda; Parmesão; Presunto cru; Minas Padrão | Opções de configuração; não representam mercadoria independente |

São 12 classificações pendentes após o complemento. A aptidão do pedido também depende dos
componentes, das regras vigentes, do destinatário e do contexto da operação.
SEM GTIN e origem nacional não comprovam ST, CEST ou rendimento físico.

## Validação e preservação

Node 22.23.3 e PostgreSQL 17 local: 17 testes SQL passaram na revisão final.
Incluem a correção prospectiva de uma classificação com FCI 55 para nacional/SEM
GTIN, permissões, autoria, impacto, ativação e preservação integral da versão
anterior. Nenhum documento foi transmitido. Não houve efeitos em financeiro,
estoque ou notas recebidas. O schema sintético foi removido e o cluster encerrado.

A regressão final passou com 1.915 testes e 252 ignorados por opções específicas
de integração. Os 17 testes SQL acima foram executados com os opt-ins locais.
Lint focado e lint de design passaram: 92 desvios históricos, nenhum novo.
Os 34 testes focados da proteção também passaram.

O Playwright passou em oito combinações: 320, 390, 768 e 1440 px, claro/escuro.
A auditoria parcial não encontrou problemas. Teclado, contenção e retorno de
foco passaram. [Capturas inspecionadas, Em revisão](evidencias/20261021-nacional/README.md).
Não houve aprovação de baseline ou certificação de acessibilidade.

Tipos, build webpack e smoke finais passaram no Node 22.23.3. A validação usa
ambiente local sem credenciais produtivas. A tentativa de tipos com limite de
heap de 1,5 GB atingiu esse limite; a repetição com 3 GB passou. A compilação
completa também passou. O smoke conferiu seis rotas protegidas sem sessão e
recusa de host desconhecido, somente por GET, com banco sintético inacessível.
O aviso de depreciação de middleware é preexistente e não foi alterado.

Backup privado `etiquetas-sem-gtin-modelos-20261021`, criado antes da operação.
Integridade verificada por listagem e extração completa com `pg_restore`, sem
restauração de dados. Imagem anterior e configuração fiscal preservadas na VPS.
Planos e recibos reais permanecem privados. O serviço registra cada versão,
impacto, ativação, sincronização comercial e recibo idempotente no banco.

O backup novo `etiquetas-cest-referencias-20261021-002` foi verificado após a
partida atual e antes do CEST: 123.182.290 bytes, SHA256
`4167905fd8349f06073c408145301500b7d75d88d13cd0a739ee30aabfd3a8e6`.
Não houve alteração de certificado, CSC, credenciais, emissão automática ou
integração de notas recebidas. Os XMLs ligados ao Lombo Defumado contêm nFCI
do fornecedor; essa informação não é a declaração antiga de Grazing para 1.

A main avançou para `50f87012` durante a conclusão. A branch incorporou essa
atualização. O Dokploy publicou o mesmo commit duas vezes. As travas suspenderam
as tentativas nos contêineres substituídos. A prévia foi refeita no contêiner atual
antes da aplicação. Nenhum artefato real foi exportado para outro destino.

Antes da publicação: certificado único no banco, nenhum fallback fiscal por
env ou mount; integração única preservada. O planejador produtivo confirmou
140 migrations aplicadas, nenhuma pendente e nenhuma falhada. O deploy final
não contém migration. Conferir a partida e as rotas depois da publicação,
sem usar emissão ou cancelamento real como teste.
