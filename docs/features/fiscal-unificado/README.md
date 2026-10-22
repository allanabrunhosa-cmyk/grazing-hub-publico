# Fiscal unificado — telas simples

Produtos → Fiscal conserva a grade de campos. Grupos fiscais conserva os cartões e
o editor em janela. Financeiro → Fiscal → Configurações apresenta Empresa, Brasil NFe,
Certificado digital e Configurações da nota.

## Manutenção

- Um botão **Salvar** aplica os dados no motor. Versões, autoria, vigência, auditoria,
  impacto e idempotência são tratados no servidor, na mesma transação.
- Grupos recebem origem ICMS, CSOSN/CST, CFOP, PIS, COFINS e CEST quando aplicável.
  Alíquotas e ST aparecem conforme o tratamento. NCM, GTIN e unidade pertencem ao produto.
- Códigos usam os seletores oficiais da Central. O formulário não cria tabelas ou
  dependências tributárias novas.
- Grupo, produto, complemento e emissão utilizam `VersaoEstruturaFiscal`. O JSON
  comercial anterior fica preservado; não é outra fonte editável de impostos.
- O produto mostra os valores da operação selecionada. Outra UF fica em opção recolhida.
  Exceções individuais prevalecem. Usar impostos/origem do grupo é uma escolha explícita.
- Ausência de `herdarOrigemGrupo` conserva a origem individual histórica. Uma regra
  nova do grupo pode fornecer origem e CEST. Nenhum valor real foi convertido nesta entrega.
- Salvar nome/status do grupo sem alterar impostos não aplica regra tributária nova.
  Ao salvar seus impostos, vínculos comerciais anteriores são adotados por novas
  versões, preservando as classificações e os IDs anteriores.
- Receitas não criam linhas fiscais. Kits discriminados conservam seus componentes.
  Complementos integrados não recebem uma linha independente fictícia.
- NCM calculado por composição não oferece um campo cujo valor seria ignorado.

## Configurações

Empresa mostra identidade, CRT, regime, IE e endereço. A edição fiscal usa o mesmo
motor versionado. Credenciais ficam mascaradas e usam substituição pelos serviços
existentes. Certificado local e CSC da emissora são situações distintas. Séries,
contadores e habilitação mantêm seus serviços e guardas. A abertura da tela não
consulta provedores nem habilita emissão.

## Preservação e publicação

Não há migration SQL ou alteração de schema. CRT 1, NF-e série 6, NFC-e série 7,
contadores, credenciais e documentos não foram alterados. Configurações são prospectivas;
a emissão recalcula a prévia conforme o contexto real. Operações sem suporte do motor
continuam bloqueadas, com o diagnóstico existente.

Antes da publicação, foi criado backup privado na VPS e verificado por hash e catálogo
`pg_restore --list`. Não houve restauração do banco de produção. Reversão funcional usa
nova versão; nunca reescreve notas ou restaura o banco sobre operações posteriores.
O manifesto abaixo continua disponível para comparação privada e não substitui backup.

```powershell
node --import tsx scripts/fiscal-unificado-simular.mjs --schema=public --saida=.tmp/fiscal/unificacao
```

[Resultados](TASKS.md) · [Escopo](SPEC.md) · [Capturas sintéticas](evidencias/README.md).
Dados reais, backup e logs permanecem fora do Git. Referências visuais ficam Em revisão.