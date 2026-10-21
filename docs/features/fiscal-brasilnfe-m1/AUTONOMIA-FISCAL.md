# Grazing HUB — autonomia na parametrização fiscal

Contrato da Issue #8, em `codex/fiscal-autonomia-tributaria`, sobre a base fiscal
preservada. O [contrato de execução](AUTONOMIA-FISCAL-EXECUCAO.md) descreve alcance,
compatibilidade histórica e critérios de aprovação. Resultados das verificações
ficam em [TASKS](TASKS.md). A decisão abaixo continua vigente; a seção de
implementação recomendada registra os requisitos que originaram este incremento.

**Decisão do proprietário, 11/10/2026:** a emissão de NF-e/NFC-e pelo Brasil NFe não deve depender de aprovação obrigatória da Confirp. Acionar profissional tributário/contabilidade somente para incertezas materiais ou obrigações específicas. Preservar a responsabilidade da empresa pela classificação correta, a segurança de emissão e o histórico de decisões.

## Problema técnico confirmado na base e64ffcac

A implementação do Marco 2 vinculou cada regra à coluna `referenciaConfirp` e exige `decisaoConfirpConfirmada: true` para aprovar uma versão em `src/lib/fiscal-saida/brasilnfe/regras-tributarias.ts`. A UI exige "Referência da Confirp", e a documentação trata "aprovação Confirp" como porta de entrada para homologação. **Essa exclusividade foi uma escolha do sistema, não um requisito legal geral de emissão.**

**Não contornar a regra preenchendo "Confirp" ficticiamente, nem marcando o checkbox de aprovação externa inexistente.** Substituir o contrato de aprovação de forma honesta e auditável, com migração aditiva e compatibilidade histórica.

## Novo contrato de decisão fiscal

Separar claramente:
1. **Fundamentação**: base legal/técnica efetiva, com tipo da fonte, referência específica, URI se aplicável, data da consulta, descrição da regra e limites de aplicabilidade.
2. **Responsabilidade**: autor da proposta e usuário do HUB com permissão fiscal que revisou/aprovou; revisão explícita, nome, data e hash imutável.
3. **Vigência e alcance**: UF, operação, origem preparada/revendida, modelo 55/65, regime tributário, empresa, natureza do produto, NCM/CEST, CFOP e outros campos só quando comprovados; origem da classificação e condições que alteram a regra.
4. **Estado de confiança**: PROPOSTA, EM_REVISAO, APROVADA ou BLOQUEADA; nunca traduzir "sugestão de IA", "exemplo de API" ou "nota passada" automaticamente em regra validada.

As fontes podem ser:
- `NORMA_OFICIAL` — lei, decreto, convênio ou tabela vigente;
- `ORIENTACAO_SEFAZ` — resposta à consulta publicada, com limites e sem apresentar eficácia vinculante individual que não exista;
- `SOLUCAO_RECEITA` / `NCM_CLASSIF` — classificação da Receita/Sistema Classif;
- `XML_HISTORICO` — nota real emitida anteriormente pelo Takeat, apenas como evidência de prática, **não prova jurídica autônoma de correção**;
- `PARECER_ESPECIALIZADO` — se um dia o usuário optar por consultar Confirp ou outro profissional.

Qualquer regra pode ter mais de uma fonte. Para aprovar internamente, exigir fonte concreta, justificativa, pessoa autorizada e confirmação explícita de que verificou a aplicação ao caso da Grazing. Fonte genérica sem vínculo à operação/produto não habilita a regra. Conservar URL/identificador de fonte e datas com validação contra entradas maliciosas; não buscar HTML remoto no servidor nem expor segredos em logs.

**Não há aprovação automática por IA nem valores fiscais genéricos preenchidos por padrão.** A aprovação interna é administrativa e não substitui obrigação legal, conferência fiscal oficial quando necessária ou homologação externa.

## Implementação recomendada

1. Criar modelo versionado/aditivo para fundamentações (pode ser JSON tipado com integridade e auditoria, ou tabela separada se o projeto exigir). Manter versões antigas e coluna `referenciaConfirp` legada sem apagá-la ou reescrevê-la; migrar leituras do contrato antigo de forma explícita e segura. Não criar falso registro de aprovação.
2. Mudar `RascunhoRegraFiscalBrasilNfe`, validators, `comandoVersao`, ações, DTOs, UI `formulario.tsx`/`regras-client.tsx`, testes e snapshots para `fundamentacaoFiscal`/origem/justificativa e aprovação interna. Remover exigência artificial `decisaoConfirpConfirmada`; exigir confirmação adequada, com trilha de autoria e versão.
3. Não quebrar o vínculo das regras aos snapshots de pedido e produtos: manter `emitenteHash`, `conteudoHash`, vigência, revisão, permissões e bloqueios de reenvio; rever planos de documentos já gerados se alterados.
4. Distinguir consulta com resultado oficial de um XML histórico e de uma sugestão de pesquisa. Guardar classe de confiança por campo relevante (NCM, CFOP, CSOSN/CST, CEST, PIS/COFINS, IBS/CBS); campos com ambiguidade material recebem `REVISÃO_ESPECIALIZADA` e **bloqueiam somente aquela operação/produto**, não todo o HUB.
5. Preparar a matriz mínima separada em (a) venda interna de alimento preparado; (b) revenda simples sem ST; (c) revenda com ST sob condições; (d) kits/tábuas/combos — revisão de apresentação fiscal por operação e produto; (e) venda fora de SP e especiais. Não definir NCM de uma tábua pelo nome comercial ou aplicar CFOP aos kits sem examinar efetiva produção/condição.
6. Separar configuração 2026 no **Simples Nacional** de um possível **Lucro Presumido em 2027**. Intenção de migrar não é comprovação de regime vigente; a troca requer confirmação explícita e revisão das regras tributárias com vigência. Atualizar efeitos da reforma conforme leis/NT vigentes, sem inferir percentuais.
7. Implementar testes: aprovação interna com fonte e responsável; fonte ausente; produto alterado; regra expirada; decisão externa opcional; compatibilidade de versão legada; usuário sem permissão; documentos de 55/65 montados, sem transmissão; não afetar SEFAZ de recebidas/financeiro/estoque.
8. Validar lint, lint:design, typecheck, build e testes pertinentes Node 22, com PostgreSQL descartável; sem deploy. Visual obrigatório da tela administrativa e cadastro de regras, com dados fictícios.

## Referências oficiais conferidas (não são autorização automática para todos os produtos)

- [SEFAZ-SP Resposta à Consulta 34.039/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC34039_2026.aspx), publicada em 17/08/2026: orientação em tese, com distinção entre preparo, revenda sem ST e revenda como substituído. Os CFOP candidatos e suas condições estão na [matriz proposta](MATRIZ-PILOTO-PROPOSTA.md); não classificam automaticamente cada produto Grazing.
- [SEFAZ-SP Resposta à Consulta 32.784/2025](https://legislacao.fazenda.sp.gov.br/Paginas/RC32784_2025.aspx), publicada em 17/11/2025: diferencia a transformação para ICMS paulista da hipótese federal de não industrialização. Anexo I exige correspondência à hipótese; CFOP não prova o anexo. A resposta declarou ineficaz a pergunta genérica sobre reforma tributária, portanto não fundamenta configuração IBS/CBS.
- Receita Federal Sistema Classif: pesquisar NCM, notas legais, soluções de consulta e tabela vigente. https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif
- Receita Federal consulta formal de classificação NCM, quando a dúvida persistir: https://www.gov.br/pt-br/servicos/formalizar-consulta-sobre-classificacao-fiscal-de-mercadorias
- [SEFAZ-SP resposta 33.885/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33885_2026.aspx), publicada em 08/10/2026: o **4% desde 01/01/2025** refere-se à apuração sobre receita bruta no regime especial do Decreto 51.597/2007, com alteração pelo Decreto 69.314/2025. É opcional e condicionado; não é alíquota padrão de item nem efeito automático do CNAE. Conferir eventual aplicação ao regime futuro, sem ativá-la por suposição.
- Receita Federal 29/09/2026: mudanças de opções Simples/IBS-CBS 2027. A migração pretendida para Lucro Presumido não pode ser presumida pelo HUB: https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/setembro/simples-nacional-2027-entenda-os-novos-prazos-e-faca-sua-escolha-com-consciencia-e-tranquilidade/

As páginas oficiais foram reconferidas em **11/10/2026, Brasília**, exclusivamente
por leitura pública. Classif e consulta formal não fornecem uma classificação
individual pronta para o catálogo. A notícia de 2027 distingue opção do Simples
e opção de apuração regular IBS/CBS; não comprova Lucro Presumido da empresa.
Respostas à consulta publicadas aproveitam ao consulente nos termos da legislação;
seu uso como orientação exige demonstrar semelhança factual e vigência, sem atribuir
à Grazing eficácia individual não comprovada.

## Consultoria externa: critério de escalonamento, não requisito universal

**Somente escalar** quando houver conflito real entre fontes oficiais, inexistência de classificação NCM segura mesmo após Classif/soluções de consulta, kit/composição sem definição legal clara, ICMS-ST/monofásico/benefícios e segregação de receitas complexos, efeitos de troca de regime em 2027, ou exigência legal formal cuja execução caiba a responsável habilitado. A consulta pode ser dirigida também à Receita/SEFAZ, conforme competência, e não obrigatoriamente à Confirp.

A empresa aprova sua própria política com fontes e assume a responsabilidade correspondente. Diante de caso de alto impacto sem fundamento suficiente, manter só a operação afetada bloqueada. **Não registrar nem emitir notas em homologação ou produção neste trabalho**.

## Relação com outros trabalhos

- Origem: commit e64ffcac, branch fiscal original `codex/fiscal-brasilnfe-m1`.
- Dashboard independente em `codex/fiscal-dashboard-financeiro`; reconciliar somente quando tudo estiver testado, sem sobrepor.
- Próximo objetivo: formar 1 regra EMPRESA, 1 OPERACAO 55 e 1 ITEM de piloto fundamentadas e aprovadas internamente, montar manifesto 55 **sem pendências**, pedir autorização específica para **uma** emissão de homologação em ambiente 2.
- Endereço estruturado do emitente, certificado/validade técnica e recuperação segura de resultado incerto continuam em avaliação, sem inventar dados. CSC da NFC-e é pendência de 65, não deve bloquear o cenário 55.
- Permissões centrais, snapshots e valores comerciais imutáveis permanecem; notas recebidas via SEFAZ, Takeat, financeiro e estoque intocados.
