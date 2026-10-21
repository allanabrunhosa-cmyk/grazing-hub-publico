# Homologação individual do emissor

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Preparação executada em 12/10/2026. Produção continua bloqueada.
Nenhuma transmissão fiscal foi executada. As propostas não foram aprovadas pelo agente.

## Acesso e revisão

Ambiente administrativo real: `http://127.0.0.1:3451/financeiro/fiscal/homologacao`.
O banco é `admin_brasilnfe_m11`, em loopback55449. A página fora desse banco mostra
o bloqueio. Todas as actions revalidam sessão e permissões centrais no servidor.

A página contém dois pedidos sintéticos de R$10,00. O preparo reutiliza ProdutoVenda,
FormaPagamentoVenda, PedidoVenda, DocumentoFiscalSaida, EventoFiscalSaida e planos
versionados. Não cria clientes reais, receita, recebível ou movimento de estoque.

1. Revisar os seis perfis EMPRESA, OPERAÇÃO e ITEM, seus fundamentos e limites.
2. Conferir a origem do acabado e registrar a declaração factual somente se comprovada.
3. Aprovar a revisão interna pela sessão administrativa autorizada. O ato preserva
   propostas anteriores e registra autor, instante, conteúdo, fundamento e aprovação.
4. Conferir o manifesto aprovado. O vínculo pode ser concluído novamente se falhar,
   sem repetir a aprovação humana ou alterar o snapshot.
5. Autorizar separadamente uma transmissão55, com documento, ambiente2, hashes e valor.
   Essa autorização ainda não foi concedida. Não clicar em transmissão sem aprovação específica.
6. Após o envio autorizado, conferir chave, número, série, protocolo e resultado persistido.
   Usar **Consultar este documento** e **Obter XML e impressão**. As ações são individuais.
7. Confrontar XML com identidade/ambiente/modelo, total, itens e omissão documental de IPI.
   PDF exige conteúdo PDF; HTML tem validação e download protegido próprios.
8. Só depois preparar a autorização65. Antes, configurar CSC e identificador de
   homologação no canal protegido do fornecedor; não fornecer esses segredos pelo chat.

Não há aprovação de produção nesta entrega. Cancelamento está implementado no
adaptador técnico e coberto por simulações. O piloto não libera cancelamento real.

## Prévia concreta

[Prévia dos dois manifestos](PREVIA-MANIFESTOS-HOMOLOGACAO.json) contém IDs, versões,
hashes reais e pendências do banco isolado. É uma prévia de propostas, não um plano
aprovado nem uma autorização de emissão.

| Modelo | Documento | Ambiente | Valor | Estado |
| --- | --- | --- | --- | --- |
|55|registro-sintetico-2|2|10.00|SEM_EMISSOR; nenhuma tentativa|
|65|registro-sintetico-3|2|10.00|SEM_EMISSOR; nenhuma tentativa|

## Dados e decisões do piloto

Os dois sabores estudados são Brie+geleia e Minas+geleia. A montagem sintética usa
dez unidades de cada sabor. O peso é o das fichas individuais, não a aproximação50g.
O preço10,00 é uma massa fictícia exclusiva de homologação, não o preço comercial.

Propostas: CRT1, IE comprovada, NCM19059090, CFOP5101, CSOSN102, SEMGTIN,
PIS/COFINS49 conforme DAS, CEST/ST não aplicáveis neste recorte. Fontes, vigência e
confiança estão em cada versão. Origem0 continua pendente de conferência explícita
do responsável. Não generalizar para outros sabores, operações, clientes ou produtos.

CRT1 tem prova de opção Simples2026 e PGDAS-D PA07/2026, retificadora de19/08,
com ICMS/ISS no DAS. O extrato disponibilizado em outubro não foi obtido: o link
corporativo teve falha de acesso/download. Não apresentá-lo como consultado.

A representação **OMITIR_SIMPLES** segue a orientação documental do PortalNF-e e
CGSN140, art.59, §4. A aplicabilidade material federal do IPI permanece `null`.
Não inventa CST/cEnq/base/alíquota, não define AnexoI/II do Simples e não retifica
PGDAS histórico. CFOP estadual não determina sozinho o Anexo federal.
Se o fornecedor inserir grupoIPI não aprovado no XML, bloquear a aceitação do
arquivo e conferir manualmente. Autorização já recebida não é apagada nem reenviada.

Fontes oficiais: [Portal NF-e — perguntas frequentes](https://www.nfe.fazenda.gov.br/Portal/perguntasFrequentes.aspx?tipoConteudo=S%2FEAGUrzRyk%3D),
[CGSN140/2018](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278),
[RC32784/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC32784_2025.aspx).
O dossiê completo anterior permanece em [Classificação](PILOTO-55-CLASSIFICACAO.md).

## Evidência do fornecedor

Painel autenticado observado diretamente em12/10:

- CNPJ corresponde à Grazing; NF-e/NFC-e aparece ativo.
- Endereço postal completo: Av.DoutorCardosodeMelo973, VilaOlímpia, SãoPaulo/SP,
  CEP00000000. Complemento vazio não é uma ausência obrigatória.
- Regime selecionado: Simples Nacional; excesso de sublimite desmarcado.
- A IE estava12602764118. O usuário autorizou exclusivamente a correção para
  000000000000. O valor persistido foi confirmado ao reabrir o cadastro.
- Certificado carregado, vencimento07/11/2026. Acompanhamento local indica26dias
  em12/10; não há agendamento nem substituição de certificado.
- CSC e identificador ausentes nos dois ambientes. Isso limita65, não55.
- Liberação de homologação é informação do usuário, registrada separadamente.

Leituras autenticadas desta execução:

|Horário Brasília,12/10|Resultado seguro|
|---|---|
|22:00|BuscarEmpresa correspondente; certificadoHTTP200 fora do contrato de data; CSC ausente|
|23:08:55|Após correção daIE, BuscarEmpresa rejeitado no parser; motivo não registrado nessa rodada|
|23:11:08|BuscarEmpresaHTTP200, campoEndereco.Cep incompatível|
|23:13:39|Após normalização restrita doCEP, empresa correspondente; somenteUF ausente na representação; certificadoHTTP200, data fora do contrato|
|23:21|Registro local de evidência direta: serviço ativo, validade07/11, UFSP, CSC ausente; sem chamadaAPI|

O parser aceita somente CEP com oito dígitos ou as máscaras completas00.000-000
e00000-000. Não limpa caracteres arbitrários. A UF omitida pelaAPI pode ser
conferida por evidência **direta** do painel, válida por sete dias, vinculada ao
mesmo cadastro/configuração. O servidor compara essaUF com o cadastro antes de
enviar e recusa divergência. Isso não altera nem declara completa a respostaAPI.
Ausências de outros campos, falha da consulta e relato indireto não recebem essa exceção.

ConsultarServicos **não foi repetido**. A evidência anteriorHTTP200/statusnumérico1,
erros vazios, continua sem significado documentado. A assinatura do painel é outra
evidência; não transforma esse1 em sucesso.

## Segurança e recuperação

Capacidade manual exclusivamente servidor, instâncias marcadas porWeakSet, base
isolada e IDs dos próprios cenários sintéticos. O adaptador global continua não
operacional. Processador automático e callback permanecem bloqueados.

Autorização e consumo são eventos duráveis únicos, vinculados a usuário, configuração,
emitente, modelo, snapshot, plano, parâmetros e payload fiscal. O consumo é salvo
antes do HTTP, sob a trava e lease existentes. Concorrência não cria segundo envio.

Antes do envio, BuscarEmpresa confere CNPJ, IE, CRT e endereço efetivos.65 também
confere presença deCSC/id. Não repete o catálogo de serviços.
Timeout, resposta inválida, processamento pendente ou resultado ambíguo ficam sob
conferência manual, com ação e próxima tentativa automáticas removidas. Consulta
vazia nunca autoriza reenvio. IdentificadorInterno não comprova idempotência externa.

## Pedidos e painel

A reconciliação seletiva preserva `origin/codex/fiscal-dashboard-financeiro`478b30b2.
O painel permanece somente leitura, sem alterar distribuiçãoSEFAZ ou notas recebidas.
Regras têm rota canônica `/financeiro/fiscal/regras-brasilnfe`; rotas antigas têm
redirecionamento explícito. Pedidos mantêm snapshots, histórico e permissões.
O novo fluxo não altera estoque, financeiro, Takeat ou iFood. Não houve merge.

Implementação: `homologacao.ts`, `capacidade-homologacao.ts`, `piloto-local.ts`,
`proposta-piloto.ts`, `revisao-piloto.ts`, `xml-homologacao.ts`, página administrativa
e consumidores existentes. Validações e rodadas estão em [TASKS](TASKS.md).

## Estado após a revisão interna

Aprovação dos seis perfis registrada em12/10/2026,23:40Brasília, pela sessão
administrativa. Não é aprovação de transmissão. O
[manifesto55 aprovado localmente](MANIFESTO-NFE55-HOMOLOGACAO.json) substitui a
prévia para a autorização da primeira nota. A prévia foi preservada como histórico.
Documento55:registro-sintetico-2; ambiente2; R$10,00; sempendências locais.
65 continua dependente deCSC/id. Nenhuma transmissão ou liberação produtiva executada.

## Primeira tentativa autorizada — 13/10/2026

O usuário autorizou especificamente uma NF-e 55 de R$ 10,00, ambiente 2,
documento `registro-sintetico-2`. A ação foi executada uma vez pela tela real,
com sessão central. Autorização e consumo duráveis foram registrados às
00:08:17 e 00:08:18 (Brasília). O snapshot, plano, versões e hashes do manifesto
aprovado permanecem preservados. Esse manifesto é a evidência anterior à tentativa.

O processamento terminou `PENDENTE_CONFERENCIA`. Chave, número, série e protocolo
não foram confirmados. O tratamento antigo perdeu os metadados da falha original;
portanto, não se pode afirmar seu HTTP, causa ou autorização/rejeição pela SEFAZ.
O consumo anterior ao HTTP comprova uma tentativa controlada, não uma nota emitida.
Nenhum reenvio foi realizado.

Leituras posteriores, exclusivamente pelo mesmo identificador/modelo/ambiente:

| Horário de Brasília | Resultado comprovado |
| --- | --- |
| 00:09:51 | Recuperação não confirmada; tratamento antigo sem metadados HTTP. |
| 00:23:25 | Após corrigir a propagação: HTTP 200, categoria NEGOCIO, etapa NOTA_ENVELOPE. |
| 00:28:06 | Após completar os indicadores: HTTP 200, `status` numérico 1; indicador STATUS_NUMERICO_NAO_ZERO; `erros` vazio; `Error` ausente; nenhum campo suprimido. |

As duas reexecuções foram motivadas por correções concretas na perda de metadados.
Não houve repetição automática. O cliente continua exigindo o sucesso 0 documentado
para o **envelope** de ConsultarNotaFiscal. Isso é diferente de `Nota.Status = 1`
(nota autorizada). Não há interpretação global de status nem conversão do erro em sucesso.
Fonte: [contrato oficial da consulta](https://www.brasilnfe.com.br/api/consultas).

O retorno não forneceu explicação pelo campo Error ou lista de erros. Falta
esclarecer o significado do status 1 do envelope e confirmar o resultado desse
identificador no fornecedor, incluindo suas tentativas. A aba do painel foi
identificada, mas seu controle ficou indisponível; nenhuma conferência da nota
no painel foi concluída. Ver [rascunho específico ao suporte](CONTRATOS.md#recuperação-da-primeira-nf-e-55--13102026).

O HUB mantém a autorização consumida, nenhum envio automático, nenhuma ação na
fila e nenhum reenvio liberado. XML e impressão não foram solicitados, pois falta
autorização fiscal comprovada. Homologação ainda **não concluída**. A NFC-e não
foi transmitida; continua dependente de CSC/id e autorização específica. Produção
permanece bloqueada. Não houve cancelamento ou efeito em notas recebidas, estoque
ou financeiro.

## Recuperação da tentativa, sem retransmissão — 14/10/2026

O registro de 13/10 acima conserva a implementação e evidência daquela data.
A incompatibilidade do envelope foi corrigida conforme o comentário técnico da
[PR #21](https://github.com/allanabrunhosa-cmyk/grazing-hub/pull/21#issuecomment-6178047797)
e o contrato atual de ConsultarNotaFiscal. Somente este endpoint aceita status 1
processado; 0 é compatibilidade estrita com o exemplo publicado. Erro ou resposta
ambígua nunca são autorização fiscal.

Após testes sintéticos, uma única consulta ao identificador original, modelo 55,
ambiente 2, em 14/10 às **20:46:32 Brasília**, retornou HTTP 200, envelope 1,
Encontrada true, Nota.Status 3, Emitida false, CodStatusResposta 181 e histórico
vazio. Chave do próprio emitente validada; número **1**, série **1**, sem protocolo.
A fonte oficial confirma rejeição por CNPJ do destinatário não cadastrado na RFB.
Contrato, PDF oficial e hashes estão em [CONTRATOS](CONTRATOS.md#correção-de-consultarnotafiscal-e-recuperação-comprovada--14102026).

Às **20:54:17**, a mesma evidência foi reconciliada localmente pela fila existente,
sob autorização central, trava, deduplicação e auditoria. Estado **REJEITADO**,
uma tentativa, chave/número/série preservados, sem ação ou reenvio agendado.
Não houve outra consulta nem transmissão. XML, impressão e protocolo de autorização
não existem como documentos autorizados comprovados; os downloads não foram chamados.
A homologação **ainda não está concluída**.

Próxima tentativa: corrigir somente o destinatário sintético com cadastro admitido
na homologação, preparar revisão/manifesto pelos serviços existentes e obter nova
autorização específica antes da transmissão. Não alterar a fotografia antiga nem
reutilizar sua autorização consumida. Não substituir documento fictício por CPF
real sem fundamento e autorização. A validação cadastral integra o teste; não deve
ser desligada para obter sucesso.

Na leitura das **20:47:10**, CSC e identificador de NFC-e estavam ausentes nos dois
ambientes. Sua configuração usa o canal protegido do fornecedor. A ausência impede
NFC-e; não transforma a venda em outra operação nem dispensa a homologação 55.
Produção, automação e callback continuam bloqueados. Nenhum cancelamento, merge,
deploy ou migration produtiva foi executado.
