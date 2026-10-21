# Piloto NF-e 55 — impedimentos e próxima execução segura

Estado em12/10/2026: **preparação local implementada; manifesto fiscal completo
impedido**. Classificação proposta de NCM1905.90.90/CFOP5.101 e fatos:
[PILOTO-55-CLASSIFICACAO](PILOTO-55-CLASSIFICACAO.md).
Não há dependência obrigatória da Confirp. Responsável fiscal interno decide
com fontes verificáveis; consulta oficial/especialista é recurso para dúvida material.

## Lista exata

| Campo / requisito | Evidência disponível | Falta / ação necessária | Responsável |
| --- | --- | --- | --- |
| EMPRESA: CRT vigente |Receita Federal confirmou opção atual Simples, nãoSIMEI, em12/10/2026,19:43:27; IE histórica já comprovada |Falta somente situação estadual de excesso de sublimite para distinguirCRT1/2. CADESP rejeitou acesso após CAPTCHA autorizado, sem resultado. Obter consulta estadual atual/registro oficial de sublimite, sem pedir novamente CNPJ/IE ou presumirCRT1 |Administração / responsável fiscal interno |
| EMPRESA: razão social e endereço no ambiente isolado |**Concluído**: endereço gravado por sessão real em12/10; razão/CNPJ existentes preservados, cadastro postal corresponde ao comprovante; IBGE3550308 comprovado |Não há pendência de endereço local. IE/CRT/código municipal permanecem parâmetros da futura versãoEMPRESA; não duplicar endereço/certificado. Nenhum pedido/cliente ou segredo copiado |Administração / aprovador interno |
| ITEM: alcance dos sabores e GTIN |Receitas e unidade já comprovadas; usuário confirmou em12/10 que caixa20un não possui GTIN próprio |GTIN resolvido como propostaSEM GTIN. Registrar constatação na fundamentaçãoUNIDADE; limitar piloto a Brie/geleia e Minas/geleia, sem aprovar os outros sabores |Operação / aprovador interno |
| ITEM: CEST e ST |Confronto descritivo dos quatroCEST concluído; RC5109/33358, CAT68/Conv142 |Propostas: CEST não aplicável(confiança média), ST não aplicável na saída própria interna ao consumidor(confiança alta). Falta adoção humana expressa da interpretação; consulta dirigida ao alcance de17.062.01 somente se aprovador considerar material a dúvida |Aprovador fiscal interno |
| ITEM: IPI e preenchimento XML |Processo/embalagem sustentam proposta industrial/AnexoII; TIPI0 não afastaIPI doDAS. MOCgrupoO0–1/CGSN59§4 não fixam código específico desse caso |Campos residuais exatos: inclusão/omissão do grupoIPI, CST e cEnq para industrialSimples/saída própria. Não selecionar51/53/99/999 oufalse por inferência. Aprovar representação fundamentada; se grupo exigido, esclarecer contrato/XML do fornecedor |Responsável fiscal interno / Brasil NFe para contrato técnico |
| Montagem: grupo IPI |Construtor atual recusa ipiAplicavel=true ou CST IPI preenchido, com pendência do item |Se a decisão exigir grupo IPI, completar contrato tipado do fornecedor e representação correspondente antes de montar; não trocar true por false para passar. Esta extensão depende do contrato e decisão acima, não de timeout maior |HUB / Brasil NFe |
| ITEM/OPERACAO: demais campos e versões |NCM/CFOP fundamentados; PIS/COFINS49 propostos; CSOSN102 e IBS/CBS2026 condicionados a Simples confirmado |Revisar origem, unidades/fator, ICMS, PIS/COFINS, FCP, DIFAL, benefício, vigência e fontes; selecionar forma de pagamento ativa. Aprovação humana EMPRESA/OPERACAO55/ITEM deve produzir IDs/hashes verdadeiros |Responsável fiscal interno / usuário autorizado |
| Plano/snapshot/manifesto |Leitor seguro implementado e testado; não há documento administrativo de piloto criado |Criar exclusivamente cenário fictício no banco isolado após aprovar os campos; fotografia e plano existentes devem gerar ID, revisão, total e hashes. Agora documentoId/hash/versões são ausentes, não placeholders válidos |HUB / usuário autorizado |
| Serviço e certificado |Painel informado como ativo/liberado; A1 até07/11/2026, evidência histórica11/10. ConsultarServicos HTTP200/status1/erros vazios continua sem significado; certificado com campo de data rejeitado pelo parser |Manter evidência identificada do painel; fornecedor esclarecer status1 e formato DtExpiracao sem reinterpretar sucesso. Renovação futura pelo canal protegido antes do vencimento; não trocar certificado aqui |Brasil NFe / administração |
| Recuperação de resultado incerto |Travas/identidade/consulta próprios implementados com bloqueio de reenvio |Fornecedor confirmar consistência/latência, principal/histórico, não duplicação e recuperação do protocolo de evento perdido. Sem prova, conferência manual e nenhum reenvio |Brasil NFe / HUB |
| Primeira transmissão |Produção e porta técnica bloqueadas; sem aprovação de uma nota concreta |Somente depois de manifesto sem pendências e requisitos externos conferidos, solicitar aprovação específica de uma NF-e55/env2, identificada por ID/hash/revisão/total/versões. Não criar bypass neste incremento |Usuário autorizado |

CSC e identificador de NFC-e continuam pendências do modelo65 e **não bloqueiam
a preparação de NF-e55**. Não exigir Sincronizar Docs. Nada desta lista altera
a integração SEFAZ de notas recebidas.

## Cenário comercial planejado, ainda sem documento fiscal

Um produto de teste exclusivo da combinação, dentro das mesmas estruturas de
ProdutoVenda/PedidoVenda/DocumentoFiscalSaida; não duplicar produto operacional
nem atribuir a todos os sabores reais a classificação dos dois sabores pesquisados.
Referência técnica:20 sanduíches,10 de cada receita. Nome do item de homologação,
comprador/destinatário e endereço de teste devem ser exclusivamente fictícios,
compatíveis com o padrão documentado de homologação. Não usar dados de cliente
ou pedido real, nem presumir que CPF/CNPJ zero da fixture seja aceito pela SEFAZ.

Recorte planejado: venda própria interna SP a consumidor final não contribuinte,
presencial, sem intermediador ou transporte, pagamento à vista. É cenário
fictício de homologação, não descrição de pedido real nem parâmetro autoaplicado.
Escolha comercial de baixo risco para o cenário futuro:1UN de caixa fictícia a
R$10,00, desconto/frete/outros0, pagamento de teste à vistaR$10,00 e troco0.
O preço é arbitrário **somente do cenário sintético**, não preço/custo do HUB.
A forma fiscal depende de mapeamento explícito para cadastro ativo aprovado;
não foi criado recebível ou lançamento. Subtotal10,00 - desconto0 + frete0 +
outros0 = total planejado10,00. O total efetivo do manifesto virá do snapshot,
sem repetir rateios ou cálculos financeiros.

O arquivo [PILOTO-55-PREPARACAO](PILOTO-55-PREPARACAO.json) é um roteiro estruturado
**IMPEDIDO**, não payload fiscal, fixture automatizada ou manifesto aprovado.
Mantém campos não comprovados como null e lista os documentos finais ausentes.

## Ordem exata para avançar

1. Reutilizar a nova confirmação oficial de opção no Simples em2026 e os comprovantes
   cadastrais. Conferir somente a situação estadual de sublimite paraCRT1/2.
   IE, razão e endereço estão extraídos no dossiê; caixa semGTIN confirmada.
   O cadastro mínimo local já foi completado com autenticação/permissões centrais
   e segredos existentes; nenhum novo token.
2. Adotar/revisar internamente a proposta CEST/ST já fundamentada e decidir os
   três campos residuais IPI. Aprovar NCM/CFOP/PIS49/COFINS49 e demais tributos do recorte.
   Se IPI exigir extensão, concluir essa montagem com testes sintéticos primeiro.
3. Na tela `/vendas/fiscal/regras-brasilnfe` da branch, registrar/revisar EMPRESA,
   OPERACAO55 e ITEM com vigência2026 (IBS/CBS não além31/12), fontes, alcance,
   grau de certeza e aprovação humana pelo usuário autorizado. Não repetir
   consultas externas para preencher a proposta.
4. Montar um único pedido/documento fictício no banco de validação, usando o
   cenário acima e as classificações **já aprovadas**. Reutilizar snapshot/hash,
   validação comercial, filas/travas e seleção explícita das versões. Não ativar
   processador ou transmissão.
5. Vincular o complemento por `vincularRegrasDocumentoBrasilNfe` e ler
   `obterManifestoLocalNfe55BrasilNfe` com sessão normal e permissões de fiscal/
   pedidos. Apenas consumo servidor. O resultado deve ser PREPARADO_LOCALMENTE,
   sem pendências, total10,00 efetivamente fotografado e provas vigentes.
6. Confrontar serviço, emitente, certificado e recuperação externa separadamente.
   A1 vence em07/11/2026 segundo a evidência histórica; não emitir com certificado
   expirado. O leitor local não marca esses requisitos como conferidos.
7. Apresentar o manifesto gerado ao usuário e pedir autorização de **uma única**
   primeira transmissão55/ambiente2. Sem aprovação, nenhuma transmissão.
   NFC-e65/cancelamento/produção exigem autorizações e critérios próprios.

Se houver mudança de item, sabores, cadastro, parâmetros, vigência ou versões,
parar e revisar. Tentativa anterior, timeout ou ausência na consulta não liberam
reenvio. O serviço de manifesto local não autoriza emissão nem remove bloqueios.

## Proposta de complemento ao suporte — não enviado

> Para a futura NF-e55 de optante Simples com alimento preparado embalado para
> venda ao consumidor, precisamos confirmar o contrato de Produtos.Imposto.IPI:
> campos/tipos de CST, código de enquadramento, base, alíquota/valor e condição de
> inclusão/omissão para CRT1 e alíquota TIPI zero. Forneçam exemplo exclusivamente
> sintético e referência técnica atual; não alterem conta, certificado ou numeração.
>
> Persistem as perguntas já registradas: status1/erros vazios de ConsultarServicos
> não equivale ao sucesso0 documentado; formato DtExpiracao do certificado interno;
> consistência/recuperação das próprias tentativas e protocolo de cancelamento
> quando a resposta se perde. Não emitimos nem repetimos essas consultas.

Este complemento não pede aconselhamento tributário obrigatório ao provedor nem
atribui defeito sem evidência. Rascunho principal e datas históricas permanecem
em [CONTRATOS](CONTRATOS.md).

## Complemento delimitado pela revisão adicional — não enviado

> Para industrial optanteSimples, produto próprio19059090, modelo55/ambiente2,
> sem destaque/crédito deIPI e recolhimento peloDAS: a API aceita omissão do grupoIPI
> quando essa for a decisão fiscal fundamentada? Quando a decisão aprovada exigir
> representação explícita, quais campos do JSON geram IPITrib/IPINT e cEnq? O
> exemplo público apresentaCodEnquadramento,CodSituacaoTributaria,Aliquota e campos
> de devolução, semBaseCalculo. Precisamos de contrato e XML exclusivamente
> sintéticos, sem transmissão, para confrontar a representação aprovada com oMOC.
> A página conceitual parece divergir doMOC ao descrever CST00 e49 eIPI universal
> para55; pedimos esclarecer o contrato, não escolher o enquadramento tributário.

Se o responsável interno solicitar interpretação oficial, a pergunta fiscal é:
grupoIPI/códigoCST/cEnq na NF-e55 de industrialSimples por saída própria de
sanduíche montado/embalado, com recolhimentoIPI noDAS. A receita e embalagem já
estão descritas no dossiê; não pedir os mesmos fatos novamente. Um parecer
especializado é opção para essa dúvida, sem aprovador obrigatório externo.

## Atualização operacional de12/10/2026

O histórico acima foi preservado. O estado atual está no
[roteiro operacional](HOMOLOGACAO-INDIVIDUAL.md). A
[prévia concreta](PREVIA-MANIFESTOS-HOMOLOGACAO.json) contém as versões e hashes.

|Campo/ato residual|Responsável|Bloqueio efetivo|
|---|---|---|
|ORIGEM do acabado e aplicação dos seis perfis|Responsável interno autorizado|Aprovação tributária dos dois pilotos|
|Ato específico:55/ambiente2/documentocmv5yyb33000gy0epogt1ch6t/R$10,00|Usuário autorizado, após revisão completa|Primeira transmissão55|
|CSC e identificador em homologação|Usuário no canal protegido BrasilNFe|Somente transmissão65; não bloqueia55|
|ConsultarServicosstatus1 sem significado eDtExpiracao fora do contrato|SuporteBrasilNFe|Confirmação dessas consultas; evidências do painel são separadas|
|ExtratoPGDAS disponibilizado em outubro, acesso não concluído|Responsável interno/canal corporativo legítimo|Atualização da prova; não consta como consultado|
|Homologação comprovada55/65 e liberação produtiva|Usuário, após resultados e roteiro verificados|Produção/automação/deploy; nenhum ato autorizado nesta entrega|

IE corrigida com autorização específica. Endereço postal confirmado no painel.
A omissãoUF pelaAPI é tratada por evidência direta vinculada e temporariamente
válida; não por resposta simulada ou substituição indiscriminada de campos.
IPI documental recebeu proposta explícitaOMITIR_SIMPLES, sem decisão deAnexo
federal, alteração de apuração anterior ou códigos tributários inventados.
