# Estrutura fiscal — fontes e decisões técnicas

Consulta somente leitura em **11/10/2026**, America/Sao_Paulo. Fontes primárias;
sem transmissão fiscal, operação de certificado ou alteração de dados reais nesta
auditoria. Classificação individual e homologação externa precisam de evidência.
Revisão contábil posterior não é condição de desenvolvimento ou ativação técnica.
Complemento sobre preço e leiaute RTC conferido em **12/10/2026**; disponibilidade
futura do leiaute oficial não comprova implementação na API do emissor.

## Seletores normativos — 14/10/2026

`src/lib/fiscal/catalogos/2026-10-14` guarda tabelas públicas, versão, fonte,
data de obtenção e SHA-256 do arquivo oficial. `scripts/importar-tabelas-fiscais.mjs`
normaliza arquivos locais obtidos das fontes abaixo. O script não grava cadastros,
regras ou aprovações. Os arquivos originais ficam na pasta temporária ignorada.

| Tabela | Retrato conferido | Cobertura armazenada |
| --- | --- | --- |
| [NCM Classif/Siscomex](https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json) | Vigente em 14/10/2026; Resolução Gecex 926/2026 | 10.516 códigos completos de oito dígitos, atos e vigências. |
| [CFOP Portal NF-e](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=74KmX8poGpM=) | Publicação 04/09/2026 | 619 códigos, datas, descrição e indicador NF-e. |
| [CEST CONFAZ](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18) | Consolidado com Convênio 107/26 | 1.198 registros com histórico e vigências; pesquisa aplica a data e o prefixo NCM. |
| [CST ICMS e CSOSN](https://www.confaz.fazenda.gov.br/legislacao/ajustes/2023/ajuste-sinief-39-23) | Ajuste 39/23 consolidado; exclusões do Ajuste 20/24 | 15 CST e 10 CSOSN. Origem tem nove códigos da Tabela A do SINIEF. |
| [PIS, COFINS e CST IPI](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J%2BI%2Bv4eN00E%3D) | MOC 7.0 e tabelas EFD 4.3.2/3/4 | Códigos completos; saída não oferece códigos exclusivos de crédito/entrada. |
| [Enquadramento IPI](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=zRz9Xc658tM=) | NT 2020.002 v1.01, 19/08/2022 | 132 códigos do anexo; filtro pelos grupos de CST. Existência formal não prova benefício material. |
| [cBenef SP](https://portal.fazenda.sp.gov.br/servicos/nfe/Downloads/Tabela-cBenef-SP-v20260901.xlsx) | 20260901 | 315 registros após excluir os marcados como desativados; restrições de UF, CST e Simples. SEM CBENEF não é oferecido. |
| [IBS/CBS](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=Cd5xq2ZVuEg=) | IT 2025.002 v1.70, 01/10/2026 | 18 CST e 173 classificações, com vigência e indicadores por modelo. |
| [Unidades](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=Q6Iyvm6qKsc=) e [pagamentos](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=uekMIW1ydFM=) | Unidades 05/07/2016; pagamentos 06/03/2026 | 61 unidades padronizadas e 23 pagamentos. Não inferir GTIN ou forma fiscal pelo nome comercial. |

`/api/fiscal/tabelas` exige a permissão central `vendas.fiscal/visualizar` e limita
a pesquisa a 50 opções. O catálogo completo permanece no servidor. A busca aceita
código ou descrição sem acento. A NCM não depende do CRT. Para códigos de ICMS, a
rota resolve o CRT vigente quando o consumidor não possui esse dado confirmado.

Produtos, Grupos, Vínculos e os editores de `VersaoEstruturaFiscal` reutilizam
`SeletorFiscal` e o Combobox da Central. A pesquisa não salva o formulário. Enter
seleciona; o check ou Salvar grava explicitamente. Campos condicionais ficam
recolhidos. Código histórico fora da tabela ou do contexto permanece visível,
com aviso para revisão. O retrato NCM atual não substitui o histórico Classif.

No editor do motor, `RegraFiscal.icms.cst` também representa parâmetros internos
da decisão no Simples. Esse campo conserva o catálogo normativo e o contrato
anterior; não substitui CSOSN no XML. A aplicação por regime, operação, evidência e
capacidade permanece no motor. Selecionar um código não comprova sua aplicabilidade.

Nenhuma tabela é ativada silenciosamente em `VersaoEstruturaFiscal`. O motor
conserva suas versões e a revisão administrativa. `cEnq`, `cBenef`, `cstIbsCbs` e
`cClassTrib` são campos opcionais das propostas Brasil NFe; ausência não insere
defaults ou altera hashes históricos. Campos ou operações ainda sem suporte na
montagem permanecem bloqueados. O grupo não propaga NCM, origem, CEST, unidade ou
GTIN próprios do produto. Não confirmar ausência de GTIN automaticamente.

O controle nativo anterior em `vendas/fiscal/fiscal-client.tsx` foi substituído
pelos seletores e componentes oficiais da Central. A ocorrência
`96a05e34456e94ee7cc8745e237b40e19661e0dfe02af3e7b28c9edd631c792a`
foi removida do baseline porque o desvio foi resolvido. Os controles condicionais
usam o Checkbox oficial. O relatório histórico da triagem permanece preservado.

## Classificação de mercadorias

| Fonte oficial | Conclusão para o HUB |
| --- | --- |
| [RFB — consultas](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/consultas) | Identificar características, ler notas legais e comparar desdobramentos do mesmo nível. Nome comercial sozinho não resolve NCM. |
| [Classif](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif) | NCM, histórico, notas legais/NESH e exportação JSON/XLSX. Conservar data/versão e características da mercadoria. |
| [Siscomex — integração](https://www.gov.br/siscomex/pt-br/sistemas-de-comercio-exterior/integre-seu-sistema) e [NCM JSON](https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json) | Exportação oficial obtida em 11/10/2026 após uma falha inicial de acesso. A cópia privada conserva hierarquia e datas; o bootstrap importa os códigos completos de oito dígitos vigentes e registra a fonte/versionamento. |
| [SC Cosit 98.121/2022](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=66518) | Cesta de Natal de mercadorias distintas não é sortido naquele caso; componentes conservam classificação. O 0000.00.00 da ementa não autoriza criar NCM fictício para o kit. |
| [RC SP 31.558/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC31558_2025.aspx) | Cestas de mercadorias separadas exigem componentes em linhas fiscais, NCM/CFOP/tributos/ST próprios. Resposta aproveita ao consulente e é evidência interpretativa; não é decisão individual sobre a Grazing. |
| [SC Cosit 98.023/2022](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=68581) | Presunto cru curado não desossado foi classificado em 0210.11.00. Não generalizar 1602.41.00 para Parma/Serrano. Exigir osso, cura/cocção, composição e apresentação. |
| [SC Cosit 98.310/2021](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=62579) | Bolachas secas/salgadas sem edulcorantes diferem das adicionadas de edulcorantes: investigar 1905.90.20 versus 1905.31.00 pela formulação. |
| [Siscomex — queijos](https://www.gov.br/siscomex/pt-br/noticias/noticias-siscomex-exportacao/comunicados/exportacao-no-2018-076/) | 0406.90.10/20/30 dependem de umidade, não do nome comercial. Conservar ficha do fabricante e confirmar código na tabela vigente. Forma ralada/fundida pode alterar a classificação. |

Não foi encontrada decisão oficial específica para a tábua Grazing. A distinção
entre preparação alimentar e kit precisa de pesos, receita, preparo/manipulação,
apresentação, finalidade e identificação das mercadorias revendidas intactas.
Não aplicar 2106.90.90 automaticamente. NCM de ingrediente não prova NCM do alimento final.

## Regime e reforma tributária

- [Decreto SP 51.597/2007 consolidado](https://legislacao.fazenda.sp.gov.br/Paginas/dec51597.aspx):
  opção de apuração mensal de ICMS por 4% da receita desde 2025, com condições,
  formalização e vedação de créditos/cumulação. Exclui Simples (art. 1º-A IV)
  e termina em 31/12/2026 (VI). Não é alíquota de item. Não ativar em Simples 2026
  nem presumir renovação/elegibilidade em 2027.
- [RC SP 32.975/2025, publicada 07/07/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC32975_2025.aspx):
  fornecimento preparado e pronto para consumo imediato em eventos externos pode
  ser elegível ao decreto se as demais condições forem atendidas. Isso não resolve
  o NCM das tábuas nem torna todo contrato de evento uma operação alimentar.
- [LC 214/2025 atualizada](https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html):
  art. 348 III c exclui alíquotas de teste nas operações Simples em 2026.
  Em 2027/2028, IBS estadual/municipal são 0,05% cada; CBS usa alíquota legalmente
  fixada menos 0,1 ponto percentual. Bares/restaurantes têm redução de 40%, com
  exceções para revenda sem preparo, álcool e certos contratos empresariais.
  IS requer incidência e alíquotas de lei ordinária; não gerar débito adicional
  somente porque uma bebida alcoólica é revendida.
- [Decreto federal 12.955/2026](https://www2.camara.leg.br/legin/fed/decret/2026/decreto-12955-29-abril-2026-799019-publicacaooriginal-179077-pe.html):
  arts. 396–401 da CBS distinguem preparação local, revenda e álcool. Bebida
  industrializada manipulada com outra não recebe automaticamente benefício de
  restaurante. Gorjeta/intermediação excluíveis exigem segregação e comprovação.
- [Cronograma RFB, atualizado 21/09/2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-da-reforma-tributaria):
  início da obrigação e publicação de leiaute são marcos diferentes; Simples tem
  marco em 01/01/2027.
- [RFB — CGSN 191/2026](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026):
  ME/EPP do Simples que prestem serviços sujeitos a NFS-e usam padrão nacional
  desde 01/11/2026; obrigação distinta do IBS/CBS no regime. Integração municipal
  antiga não comprova cumprimento nacional.

Não foi obtida tabela oficial integral de alíquota CBS 2027 nem lei ordinária de
alíquotas IS aplicável à operação Grazing. Estimativa como 8,8% não pode ser ativada
como percentual confirmado. Perfil 2027 requer vigência, enquadramento cadastral
confirmado e parâmetros completos; nunca se aplica antecipadamente.

## Preço final e leiaute RTC a partir de 2027

| Fonte oficial | Consequência técnica |
| --- | --- |
| [NT 2026.008 v1.00 — valor líquido do produto](https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=3&nomeArquivo=NT_2026.008_v1.00_RTC_ValorLiquidoProduto.pdf) | IBS/CBS contidos no preço não integram a própria base. `vProd` conserva o bruto; `vProdLiq` e `vUnComLiq` retiram todos os tributos contidos. `vProdLiqTot` soma líquidos; `vItem`/`vNFTot` não acrescentam novamente RTC já contido. Líquidos totais usam duas casas e unitário até dez; I11c-20 admite ±R$0,01 em unidade × quantidade. |
| [RC SP 32.931/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC32931_2025.aspx) e [RC SP 33.083/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33083_2026.aspx) | IBS/CBS efetivamente exigíveis compõem a base ICMS paulista, junto aos demais valores da operação. A exceção informativa de 2026 não autoriza retirar RTC da base ICMS em 2027. Base líquida requer fundamento específico; essas respostas são evidência interpretativa, não decisão individual sobre a Grazing. |
| [Aviso SVRS/ENCAT de 05/10/2026](https://dfe-portal.svrs.rs.gov.br/Nfce/Avisos/2896) | NT2025.002 v1.52, NT2026.007 v1.10 e NT2026.008 v1.00 foram adiadas para 26/10/2026 em homologação e 16/11/2026 em produção. Em 12/10 esses marcos ainda são futuros; não constituem homologação do Brasil NFe. |

O helper [preco-rtc.ts](../../../src/lib/tributacao/preco-rtc.ts) resolve exclusivamente
a matemática de preço incluído, com taxas efetivas fornecidas e precisão Decimal isolada.
Mantém o total comercial e a quantidade; bloqueia fórmula inválida ou ausência de
fechamento simultâneo em centavos. Valor líquido do produto e base da operação são
campos distintos. Frete/despesas exigem composição explícita e eventual rateio
proporcional precisa de versão/justificativa comprovadas; a matemática não concede
tratamento tributário. Os percentuais de teste são fictícios.

A exceção de base ICMS líquida requer UF, período, ato, justificativa e fonte oficial
presentes na configuração e nas fontes da versão. O servidor revalida contexto e
vigência antes de ativar/aplicar. As RCs paulistas citadas defendem base bruta e não
comprovam essa exceção. Cadastro de evidência não substitui a leitura técnica do ato.

Publicação da NT, abertura futura do ambiente de homologação e prévia de 2026 não
comprovam suporte de 2027 no Brasil NFe. Não foram homologados o mapeamento dos cinco
campos necessários, o XML futuro, fechamento dos pagamentos ou autorização nesse leiaute.
A falta dessa prova mantém apenas a emissão afetada pendente; não altera documentos
anteriores nem bloqueia a operação válida do Simples em 2026.

## Tabelas e substituição tributária

O [Portal NF-e — informes vigentes](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=hXzemuyNHW4%3D)
listou IT 2025.002 v1.70 de 01/10/2026 (cClassTrib/CST/crédito presumido),
IT 2023.002 v2.10 de 04/09/2026 (CFOP), IT 2024.001 v2.40 de 03/09/2026 (NCM)
e IT 2026.002 v1.00 de 12/05/2026 (alíquotas CBS). A
[SVRS oficial](https://dfe-portal.svrs.rs.gov.br/Cff) também publicou v1.70 e oferece
[consulta cClassTrib](https://dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria).
Índice consultado não equivale a carga integral: importar arquivo/hash/vigência
e indicadores por modelo. Validação por dígitos não comprova compatibilidade.

O [Convênio ICMS 142/2018 consolidado](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18)
requer descrição/NCM/segmento e prevê CEST mesmo sem ST na operação (cláusula
vigésima). CEST não prova imposto retido. A
[Portaria CAT 68/2019 consolidada](https://legislacao.fazenda.sp.gov.br/paginas/Portaria-CAT-68-de-2019.aspx),
alterada pela [SRE 64/2025](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-64-de-2025.aspx),
revogou Anexo X de bebidas alcoólicas desde 01/01/2026 e retirou diversos itens
alimentícios. Cerveja/chope e outras bebidas conservam enquadramentos próprios.
Não copiar a ST de nota antiga para a operação atual.

## Brasil NFe: contrato público e fronteiras reais

- [NF-e/NFC-e](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e):
  POST `/services/fiscal/EnviarNotaFiscal`, 55/65, retorna situação/protocolo.
  Individual não dispara webhook; lote dispara. `IdentificadorInterno` identifica
  operação. Número/série/código omitidos podem ser gerados; resultado incerto exige
  consulta e identidade estável antes de qualquer nova transmissão.
- [Consulta e prévia](https://www.brasilnfe.com.br/api/consultas):
  `ConsultarNotaFiscal` por identificador/ambiente/modelo retorna `Encontrada`,
  `Nota`, `Historico`, `erros`, `status`. Mesmo identificador admite várias
  tentativas: examinar histórico autorizado antes da última rejeição. Isso não
  comprova idempotência externa de envio. `PreVisualizarNotaFiscal`, TipoEnvio=1,
  TipoArquivo=2, gera XML/PDF com tarja, sem SEFAZ/numeração; não é homologação.
- [Eventos](https://www.brasilnfe.com.br/api/eventos-nf-e-nfc-e):
  cancelamento depende de evento/protocolo aceito. Estorno financeiro e cancelamento
  comercial não cancelam nota. CC-e não corrige valores tributários. Prazos precisam
  corresponder às regras estaduais reais, não somente ao exemplo do provedor.
- [Webhooks](https://www.brasilnfe.com.br/webhooks): HMAC-SHA256 dos bytes originais,
  assinatura `sha256=<hex>` e comparação constante; deliveryId estável para
  deduplicação. Timestamp original repete em retries por aproximadamente 1h12;
  janela sugerida ±2h com deduplicação primária. Validar emitente/documento/ambiente.
- [NFS-e](https://www.brasilnfe.com.br/api/nfs-e): envio/consulta/cancelamento
  municipais existem. Capacidade pública geral não comprova cobertura da empresa,
  São Paulo ou padrão nacional exigido em novembro. Exigir contrato/layout/cadastro
  e homologação específicos; não simular NFS-e com adaptador de 55/65.

Na auditoria inicial, o registro de provedores retornava null. A implementação
agora registra o adaptador Brasil NFe quando as configurações exigidas estão presentes.
Prévias externas dos modelos 55/65 foram conferidas; uma transmissão fictícia em
homologação recebeu rejeição 209 por IE do emitente. Isso não é autorização fiscal
nem homologação conclusiva. A capacidade de NFS-e da empresa permanece inativa.
O provedor admite múltiplas tentativas pelo mesmo identificador: uma ausência após
tentativa incerta exige conferência externa e mantém o reenvio bloqueado.
Detalhes e evidências sanitizadas em [BRASIL_NFE.md](BRASIL_NFE.md).

## Exceções precisas e comportamento esperado

| Caso | Dado essencial ausente | Consequência por operação |
| --- | --- | --- |
| Tábua | Receita/pesos/preparo/apresentação/finalidade e itens intactos | Distinguir preparado/kit; bloquear documento afetado sem NCM genérico. |
| Cesta/kit | Componentes, quantidades e rateio | Expandir linhas, fechar centavos e bloquear componente sem classificação. |
| Extra | Integração ao alimento versus mercadoria separada | Escolha incluída altera composição; integrado compõe preço; independente gera linha. Valor zero sozinho não decide. |
| Embalagem | Material, venda separada versus apresentação, retorno/reuso | Mercadoria independente tem classificação; opção de apresentação não cria produto automático. |
| Queijo | Umidade/tipo/forma/fabricante/nota | Validar individualmente; ingrediente não define produto final. |
| Presunto | Cura/cocção/osso/apresentação | Avaliar capítulo 02 versus 16; não generalizar Parma/Serrano. |
| Bebida | Preparo/industrializada/álcool/volume/categoria/nota | GF07–10 distintos; benefício e ST por característica/vigência. |
| Evento | Contrato e valores alimentação/organização/locação/mão de obra/município | Separar fornecimentos reais; não gerar NFS-e por GF12 sozinho. |
| 2027 | Regime confirmado, vigência e alíquotas oficiais | Configuração prospectiva; ausência não bloqueia emissão válida em 2026. |
| Reenvio | Consulta íntegra/histórico/identidade externa | Incerto mantém trava; HTTP genérico não prova ausência. Emissor exclusivo por operação Takeat/Brasil NFe. |

Correção prospectiva cria versão com autoria/motivo/fonte/vigência/análise de impacto.
Documento, XML, protocolo, snapshot e venda histórica permanecem imutáveis.
Validação técnica interna é suficiente para regra fundamentada: sem aprovação
prévia obrigatória pela Confirp.
