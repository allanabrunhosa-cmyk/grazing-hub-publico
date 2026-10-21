# Marco 2 — preparação técnica local

Esta preparação foi preservada. Continuação vigente em 11/10/2026:
[implementação técnica](MARCO-2-IMPLEMENTACAO.md) e
[cenários mínimos para aprovação](HOMOLOGACAO-CENARIOS.md). As afirmações abaixo
sobre ausência de armazenamento/interface/métodos operacionais descrevem a entrega
90d7b470; a continuação acrescenta esses componentes sem liberar transmissão.

## Contrato vigente de preparação — autonomia fiscal, Issue #8

Na branch `codex/fiscal-autonomia-tributaria`,
[AUTONOMIA-FISCAL-EXECUCAO](AUTONOMIA-FISCAL-EXECUCAO.md) substitui a exigência
geral de decisão Confirp por fundamentação verificável e aprovação interna
auditável. O inventário técnico e a precisão comercial continuam aplicáveis;
menções à Confirp no registro original abaixo identificam o responsável esperado
naquela entrega, sem instituir requisito externo vigente.

`referenciaFundamentacao` identifica a versão fiscal escolhida para novos
complementos locais. `referenciaConfirp` continua reconhecida pelo construtor
somente por compatibilidade de estrutura com parâmetros antigos; o texto legado
não comprova fundamento nem aprovação interna. A porta de preparação de planos
exige versões atuais, completas, vigentes e internamente aprovadas, com hashes e
revisão reconferidos. Não converter referências antigas em fundamentos fictícios
nem reescrever fotografias/planos históricos para fazê-los passar.

### Inventário vigente e responsabilidade pela decisão

| Grupo do inventário original | Regra vigente para completar a preparação |
| --- | --- |
| Emitente: CNPJ/endereço/IE/CRT/município/país | Dados confiáveis nos cadastros existentes e complementos fundamentados; revisão interna do regime/alcance e correspondência ao emitente |
| Natureza/finalidade/presença/consumidor final, destinatário e transporte | Decisão interna específica por modelo/operação; origem dos dados explícita, sem inferir códigos de canal ou reaproveitar endereço de entrega como fiscal |
| NCM/CEST/origem/CFOP, ICMS e tributos federais | Fundamento por produto/operação e confiança por campo; Classif, norma e orientação específica com limites; XML histórico e exemplos não aprovam sozinhos |
| Aplicabilidade ST/FCP/DIFAL/IPI/IBS-CBS/benefícios, conversão e bases | Não aplicabilidade justificada ou regra comprovada; dúvida material bloqueia só a decisão afetada; extensão do construtor quando o grupo exigido estiver fora do recorte |
| Pagamento/troco/cartão/textos legais/IBPT | Correspondência e aplicabilidade revisadas internamente com fonte e condições; dados específicos do documento explícitos, sem lançar financeiro ou criar autorização de cartão |
| Valores comerciais, frete, descontos, parcelas e arredondamentos | Snapshot, precisão e rateio preservados; decisão fiscal não refaz cálculo nem movimenta estoque/recebíveis |
| Serviço, certificado, CSC, número/série e recuperação | Requisitos técnicos do Brasil NFe separados da aprovação tributária; evidência identificada, sem alterar configuração externa; CSC65 não bloqueia montagem55 |
| Documento/plano/histórico | Permissões centrais, trava, identidade e hashes existentes; resultado local completo mantém `transmissaoPermitida:false` |

O piloto fundamentado é interno em SP: destinatário fiscal em UF diferente do
alcance gera pendência pontual no vínculo do plano, sem herdar a regra interna.
Operação interestadual precisa de fundamento e contrato/testes específicos;
essa extensão não é condição para concluir as partes independentes da Issue #8.

O responsável fiscal interno fundamenta e aprova a aplicação concreta. Consulta
oficial ou parecer da Confirp/outro especialista é recurso para incerteza material
ou obrigação específica, sem aprovação externa universal. Uma intenção de Lucro
Presumido em 2027 não altera o Simples informado para 2026 nem confirma regime futuro.
Cada contexto precisa de confirmação e vigência próprias.

Fonte, versão ou cadastro incompatível, produto alterado, regra expirada,
fundamentação insuficiente e campo pendente impedem o plano correspondente. A
aprovação interna não autoriza emissão. O roteiro vigente é
[HOMOLOGACAO-CENARIOS](HOMOLOGACAO-CENARIOS.md); a matriz continua
[proposta candidata](MATRIZ-PILOTO-PROPOSTA.md), sem códigos aplicados ou regra real
aprovada pela execução. A investigação de ConsultarServicos não foi repetida.

## Registro histórico da entrega 90d7b470

As seções seguintes conservam o contrato e o inventário da primeira preparação
local. Exigências Confirp e a referência obrigatória descritas nesse registro
foram substituídas pelo contrato vigente acima. Resultados sintéticos históricos
não são reexecução de testes da Issue #8 nem homologação externa.

Implementação iniciada sobre `dcf72307`, em `codex/fiscal-brasilnfe-m1`.
Este incremento conclui montagem e pré-validação locais e prepara o roteiro de
homologação. Não autoriza executar o roteiro nem transmitir documentos.
ConsultarServicos permanece na pendência externa registrada em [CONTRATOS](CONTRATOS.md):
HTTP200, inteiro1, erros vazios; nenhuma nova consulta ou mudança de aceitação.

## Código utilizável e fronteiras

- `payload-local-tipos.ts`: contrato dos complementos fiscais e do corpo da nota.
- `payload-local.ts`: `prepararPayloadLocalBrasilNfe` e
  `serializarPayloadLocalBrasilNfe`, exclusivamente no servidor, sem HTTP/banco.
- `preparacao-local.ts`: `prepararDocumentoBrasilNfeLocal` lê o documento existente
  e `ConfiguracaoLoja` em transação. Reconfere usuário ativo, versão da sessão,
  permissão de consultar pedidos e `vendas.fiscal/editar` no banco; administrador
  legítimo usa a regra central. O atributo admin recebido não concede acesso.
- `mapeamento.ts` conserva seu contrato parcial compatível. A montagem completa
  verifica essa base; não substitui o snapshot por um payload do fornecedor.
- Não há rota nova, botão de envio, armazenamento de parâmetros fiscais, migration
  ou mudança visual. A tela administrativa e suas credenciais continuam existentes.

Uso futuro por consumidor servidor autorizado:

```ts
const resultado = await prepararDocumentoBrasilNfeLocal(
  documentoId, modelo, parametrosFiscais, sessaoAtual,
);
if (!resultado.montagemConcluida) {
  // Apresentar somente as pendências: campo, item/produto, operação e responsável.
  return resultado;
}
const corpoLocal = serializarPayloadLocalBrasilNfe(resultado);
// Usar em conferência técnica local. Não há função de transmissão neste incremento.
```

Os parâmetros são explícitos e vinculados a documentoId, hashPayload, revisão do
pedido e revisão fotografada de cada produto. Uma referência de decisão Confirp é
obrigatória; preencher essa referência não comprova aprovação fiscal externa.
O consumidor deve obter os parâmetros de fonte fiscal aprovada. Não copiar os
valores das fixtures para cadastro real nem completar lacunas com defaults.

O resultado é imutável e tem `transmissaoPermitida:false`, mesmo completo. O
serializador aceita somente o resultado original produzido nessa execução local,
nunca um DTO reconstituído/adulterado. Valores permanecem strings exatas em memória;
o corpo JSON usa tokens numéricos exatos sem conversão dos decimais a Number.
Não gravar ou registrar o corpo: ele pode conter identificação fiscal do cliente.

## Inventário conferido no HUB

Fontes: `servico.ts/prepararFiscalSaida`, `vendas/pedidos.ts/calcular`,
`vendas/dominio.ts/validarFiscal`, modelos `ConfiguracaoLoja`, `ProdutoVenda`,
`ItemPedidoVenda`, `DocumentoFiscalSaida` e `EventoFiscalSaida`.

| Campo/grupo necessário | Informação disponível | Lacuna/decisão e responsável |
| --- | --- | --- |
| IdentificadorInterno | id estável do documento de saída; hash e revisão | Brasil NFe: repetição não comprova idempotência; confirmar recuperação de todas as tentativas |
| ModeloDocumento/TipoAmbiente | Construtor recebe55/65 e fixa ambiente2 | Brasil NFe: serviço/ambiente liberados ainda não confirmados; produção bloqueada |
| Emitente: razão social/CNPJ | ConfiguracaoLoja e fotografia existente | HUB: completar cadastro; divergência com fotografia bloqueia a montagem |
| Endereço do emitente | enderecoEstruturado da empresa | HUB: CEP, logradouro, número, bairro, cidade e UF completos; texto legado não substitui estrutura |
| CRT/IE/município IBGE/país | Não estão integralmente no cadastro estruturado | Confirp: complementos explícitos; não duplicar CNPJ/endereço/certificado em outro cadastro |
| Natureza/Finalidade/Presença/ConsumidorFinal | Canal e operação comercial fotografados | Confirp: escolher explicitamente; canal/nomes não determinam códigos; recorte normal nacional |
| CalcularIBPT | Parâmetro explícito local | Confirp/Brasil NFe: conferir aplicabilidade e comportamento; exemplo não é regra fiscal |
| Intermediador/transportador | Dados comerciais de entrega preservados | Confirp: necessidade por operação; intermediador aplicável exige extensão; transporte atual só leva modalidade, demais dados não são inferidos |
| Cliente.CpfCnpj/NmCliente/IE | Comprador/cobrança/entrega fotografados, com campos diferentes | Confirp/HUB: selecionar origem fiscal; não presumir que entrega ou cobrança sejam comprador |
| Cliente.IndicadorIe/Endereco | Alguns dados cadastrais fotografados | Confirp/HUB: indicador explícito e endereço fiscal com IBGE/país; cadastro incompleto gera campo pendente |
| Identificação NFC-e | Destinatário opcional no recorte presencial | Entrega domiciliar exige identificação/endereço; consumidor contribuinte fora deste recorte |
| Produto/CodProdutoServico/NmProduto | id do produto e nome fotografado | HUB: item sem produto vinculado/nome não recebe substituto fictício |
| Quantidade/UnidadeComercial | Item fotografado; banco permite quantidade com6 casas | Confirp/HUB: converter corretamente antes da fotografia; construtor aceita até4 casas sem arredondar6 para4 |
| Preço/acréscimos/complementos | Preço aplicado e acréscimos separados no snapshot | Construtor soma preço+acréscimos uma vez; complementos continuam na fotografia comercial |
| ValorTotal/ValorDesconto do item | Total líquido e desconto já rateado | Reconstrói bruto=líquido+desconto; não redistribui desconto global |
| ValorFrete/ValorOutrasDespesas | Valores globais fotografados | Rateia uma vez nos itens, proporcional ao bruto, com resíduo em centavos na ordem fotografada |
| Subtotal/desconto/total da nota | Valores exatos preservados | Divergência de linhas/totais é pendência HUB; não corrigir valores do pedido |
| NCM/CEST/origem/CFOP/EAN/unidade tributável | ProdutoVenda.fiscal e revisão fotografada | Confirp: classificar/aprovar por produto/operação; grupo é referência, não fallback |
| Aplicabilidade CEST/conversão tributável | Cadastro não comprova decisão/fator | Confirp: booleano e fator positivos explícitos; unidade/quantidade/valor devem conservar bruto |
| CSOSN ou CST ICMS | Classificações no cadastro fiscal | Confirp: compatibilidade com CRT; não permitir ambos simultaneamente |
| ICMS/PIS/COFINS | CSTs disponíveis; bases/alíquotas ausentes no cadastro atual | Confirp: informar tratamento, bases/alíquotas e modalidade quando pertinentes; cálculo usa somente entradas explícitas |
| ST/FCP/DIFAL/IPI/IBS-CBS/benefícios | Cadastro possui classificações/campos parciais | Confirp: aplicabilidade de cada grupo deve ser explícita; quando aplicável, construir extensão antes de concluir payload |
| Aprovação da ficha | fiscalRevisado existe em ProdutoVenda | Snapshotv1 não fotografa esse booleano; não presumir aprovação nem reescrever snapshots antigos |
| Pagamentos.FormaPagamento/IndicadorPagamento | formaId e metadados comerciais; parcelas fotografadas quando existentes | Confirp: correspondência fiscal explícita; nomes, taxas e parcelas financeiras não são códigos fiscais |
| VlPago | Total ou parcelas do snapshot, mediante escolha explícita | Deve fechar com total; nenhuma dedução de taxas financeiras, baixa ou criação de lançamento |
| VlTroco/cartão | Snapshot não comprova valor entregue nem autorização da adquirente | HUB/Confirp: troco positivo bloqueado; cartão exige dados específicos explícitos, sem inventar autorização |
| Cobranca/Fatura/Parcelas | Valores/vencimentos fotografados | NF-e opcional, sem novo rateio; desconto da fatura0 porque total já é líquido; NFC-e fora desse grupo |
| Observações adicionais obrigatórias | observacoes fiscais/comerciais existem, sem regra de uso | Confirp: definir textos legais e origem antes de exigir esses grupos; não fiscalizar automaticamente texto comercial |
| Série/número/lote/código/datas | Não constam como decisão fiscal operacional | Brasil NFe/Confirp: confirmar controle e momento; construtor omite, sem alterar configuração externa |
| Certificado/CSC | Configuração externa e requisitos ainda não conferidos | Brasil NFe/usuário: conferir certificado; CSC/identificador para65 conforme UF/ambiente; não copiar segredos para payload local |
| Resultado/protocolo/documentos/eventos | Contrato da fila, consulta técnica e validadores XML/PDF existentes | Brasil NFe: confirmar contratos reais e sequência/identidade dos eventos antes de normalização operacional |

O inventário distingue formato local de validade fiscal: não verifica existência
tributária de NCM/CFOP, inscrição na SEFAZ, certificado ou aprovação de cadastro.
Campos pessoais usados no documento não entram em logs, fixtures reais ou evidências.

## Recorte implementado e precisão

Venda normal nacional55/65 com ICMS sem destaque (CSOSN102/103/300/400 ou CST40/41),
ou ICMS tributado CST00 com base/alíquota/modalidade explícitas. PIS/COFINS sem
destaque04–09 ou percentual01/02 com entradas explícitas. São famílias de montagem,
não escolhas automáticas para os produtos reais. Taxação distinta, exportação,
intermediação, troco não fotografado e grupos fiscais adicionais são bloqueados
com pendências específicas. A Confirp pode indicar que o recorte não atende uma
operação; isso exige extensão testada, sem declarar não aplicabilidade fictícia.

Limites:990 itens/regras,100 correspondências de pagamento e120 parcelas/pagamentos;
quantidade comercial/tributável até11 dígitos inteiros e4 decimais; valores comerciais
até12 inteiros e2 decimais; fator até10 inteiros/6 decimais; valor unitário tributável
até11 inteiros/10 decimais e unitário comercial até11 inteiros/2 decimais;
percentuais até4 decimais e entre0 e100. Valores calculados também são limitados.
Decimal usa precisão60 própria, sem mudar configuração global.
Rateios truncam cada parcela em centavos e distribuem somente o resíduo; demais
fechamentos usam HALF_UP. Conversão que não conserva bruto é recusada.

Pagamento TOTAL usa a forma fotografada e o total; PARCELAS usa cada valor preservado.
São alternativas, nunca a soma das duas fontes. O registro da modalidade de frete
não comprova a suficiência de dados de transportador/veículo/volumes; conferir esses
campos por operação antes de homologar. Textos legais adicionais e a revisão fiscal
aprovada são requisitos de entrada separados da montagem técnica deste recorte.

Contrato público conferido em10/10/2026:
[NF-e/NFC-e Brasil NFe](https://www.brasilnfe.com.br/api/nf-e-e-nfc-e).
Nomes dos campos são os publicados; objetos aninhados não possuem toda obrigatoriedade
explicada. Confirmar o corpo exato na homologação autorizada, sem inferir regras dos
exemplos. Referência de famílias/precisão:
[MOC7 — leiaute NF-e/NFC-e](https://hom.nfe.fazenda.gov.br/PORTAL/exibirArquivo.aspx?conteudo=DQFCIFUzszw%3D),
com notas técnicas vigentes a conferir com a Confirp. Não houve chamada de pré-visualização.
Os limites de quantidade/unitário também foram confrontados com a
[NT2016.002 — leiaute publicado no Portal NF-e](https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?AspxAutoDetectCookieSupport=1&conteudo=tQNDQOeNeyI%3D).
Isso verifica o recorte local de precisão, sem afirmar validação contra todos os
schemas/notas técnicas vigentes nem dispensar conferência fiscal antes de transmitir.

## Ciclos sintéticos preparados

`testes/vendas/fiscal-saida-integracao.test.ts` fotografa pedido/produto fictícios
no banco exclusivo e usa a fila real com adaptador apenas da suíte. Para55 e65:
montagem, autorização normalizada, XML identificado, cancelamento normalizado,
rejeição sem repetição, timeout concorrente e consulta de recuperação com autorização
no histórico. Reutiliza identidade/hash, leases, histórico e precisão do protocolo.
Os eventos/sequências do simulador são dados de teste; não são extraídos nem
presumidos do contrato Brasil NFe. O adaptador da aplicação continua não operacional.

Os validadores existentes cobrem XML/PDF, arquivos incompatíveis e HTML de NFC-e
recusado como PDF. As consultas sintéticas distinguem status do envelope e de cada
nota; ausência/erro/timeout não liberam reenvio. Nenhum status foi reinterpretado
para ConsultarServicos. Não foi criado parser genérico de transmissão/cancelamento.

## Requisitos para executar homologação — todos pendentes de conferência real

1. **Serviço:** esclarecer o inteiro1 de ConsultarServicos e confirmar vínculo
   NF-e/NFC-e/ambiente com evidência identificada do fornecedor. Não exigir Sincronizar
   Docs. Evidência de painel/suporte pode documentar contratação, sem fingir resposta API
   nem liberar emissão por bypass.
2. **Emitente:** cadastro estruturado completo, CNPJ correspondente, IE/CRT/município
   e demais complementos aprovados; parâmetros vinculados à fotografia usada.
3. **Certificado/CSC:** certificado cadastrado válido e CSC/identificador quando
   aplicável à NFC-e. Conferência segura externa, sem alteração por este incremento.
4. **Fiscal:** decisão Confirp por operação/produto, revisão aprovada, textos legais,
   tributos aplicáveis, conversões, pagamento/troco e transporte. Estender o construtor
   para os grupos realmente exigidos antes de transmitir essa operação.
5. **Recuperação:** contrato comprovado para resultado incerto, múltiplas tentativas,
   consistência/latência da consulta e eventos ordenados. IdentificadorInterno sozinho
   não garante não duplicação. Reconciliar principal e histórico; ausência nunca basta.
6. **Autorização:** SPEC de homologação revisada, massa exclusivamente sintética e
   autorização humana específica para transmissão. Produção continua em marco separado.

## Roteiro mínimo proposto — ainda não executado

| Passo | NF-e55 | NFC-e65 | Evidência/condição de parada |
| --- | --- | --- | --- |
| Montagem local | Destinatário identificado; venda normal; pagamento e tributos explícitos | Presencial e entrega domiciliar com identificação; CFOP compatível | Zero pendências técnicas, fotografia/hash estáveis; requisitos acima conferidos separadamente |
| Primeira transmissão autorizada | Individual em ambiente2 | Individual em ambiente2 e CSC aplicável | Parar em qualquer resultado incerto; não depender de webhook |
| Resultado | Conferir autorização, chave, número/série/protocolo e valores | Mesmas verificações no modelo65 | HTTP200 não é autorização; status analisado por endpoint/campo; resultado ambíguo não vira sucesso |
| Rejeição controlada | Cenário sintético acordado | Cenário sintético acordado | Registrar rejeição sem efeitos comerciais; correção cria revisão adequada, sem substituir fotografia antiga |
| Recuperação | Timeout simulado localmente + consulta delimitada da própria tentativa | Mesmo cenário e mesmo identificador estável | Confrontar principal/histórico; não causar timeout real por emissão repetida; sem prova, manter conferência e bloquear reenvio |
| Documentos | XML da identidade/protocolo e PDF estrutural | XML e formato DANFE efetivo | HTML não é PDF; forma alternativa exige contrato compatível antes de guardar |
| Cancelamento autorizado | Motivo, prazo e protocolo reais de homologação | Regra/prazo aplicáveis ao modelo65 | Normalização de eventos comprovada; pedido/financeiro/estoque preservados |
| Fechamento | Revisar evidências e divergências com fornecedor/Confirp | Mesma revisão | Sem ativar produção, fila recorrente ou callback automaticamente |

Próximo passo exato: obter a resposta ao rascunho já existente em CONTRATOS e a matriz
fiscal interna com fundamentação verificável, completar o emitente por canal administrativo autorizado e
parametrizar um cenário sintético para cada modelo. Conferir novamente somente a
montagem local. A primeira transmissão depende de fechar os requisitos e aprovar
explicitamente a SPEC de homologação; este roteiro não concede essa autorização.

### Piloto55 pesquisado — Issue #11

Continuação de `e5865e17`: GTIN da caixa inexistente confirmado pelo usuário,
SEM GTIN explícito e validação comum sem fallback; nova aprovação ITEM/GRUPO e
montagem55/65 recusam dado ausente/inválido. Endereço local completado pela sessão
real; Receita confirmou opçãoSimples2026. CRT estadual/IPI/aprovação de versões
permanecem pendentes. Pesquisa adicional, fontes e campos residuais no
[dossiê](PILOTO-55-CLASSIFICACAO.md) e [impedimentos](PILOTO-55-IMPEDIMENTOS.md).

A proposta concreta Brie/geleia + Minas/geleia e os pesos/processo confirmados
estão em [PILOTO-55-CLASSIFICACAO](PILOTO-55-CLASSIFICACAO.md). NCM1905.90.90
e CFOP5.101 estão fundamentados para esse recorte; CEST/IPI, IE/CRT e aprovação
internas ainda impedem o manifesto. PIS/COFINS no DAS e leitor seguro de manifesto
foram implementados sem transmissão. [Lista exata e roteiro](PILOTO-55-IMPEDIMENTOS.md).
Não presumir IPI inaplicável para atravessar o recorte inicial sem grupo IPI.
