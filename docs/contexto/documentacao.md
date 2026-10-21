# Manutenção do contexto

## Fontes e consulta

- AGENTS.md roteia; docs/contexto guarda contratos transversais; docs/modulos aponta
  código, regras e testes; guias de feature detalham somente o necessário.
- Padrões visuais vigentes ficam no manual do Design System. Catálogo executável define
  tokens permitidos. Histórico/planos datados não são uma segunda fonte normativa.
- Se documentação e código divergirem, confirme no caminho indicado e registre a
  divergência. Não alterar o produto apenas para fazê-lo caber numa descrição antiga.
- Mapas têm data/base de conferência; busque símbolos por nome, não dependa de linha fixa.
  Meta: AGENTS até 100 linhas, mapas operacionais até 120. Exceção precisa de motivo.
- Consulte seções pelo assunto; só expanda a busca se o caminho documentado não explicar
  o comportamento. Instruções/skills obrigatórias continuam sendo lidas integralmente.

## Descoberta reutilizável

1. Confirmar no código e, quando aplicável, no teste. Hipótese deve ser marcada como tal.
2. Resolver a tarefa atual sem expandir autorização.
3. Registrar no mapa dono do domínio: regra, caminho/símbolo, integração/teste e cuidado.
4. Se transversal, manter a regra em docs/contexto e linkar dos mapas, sem copiá-la.
5. Atualizar/remover a referência antiga que ficou falsa; preservar evidência histórica
   relevante em documento datado claramente não normativo.
6. Na entrega, distinguir implementado, testado localmente, publicado e homologado externamente.

Não registrar logs brutos, senhas, PDFs reais, estados efêmeros de contêiner, hipóteses como
fatos ou toda alteração cosmética nos mapas. Evidências de execução ficam no registro da
feature. Não promover referência visual a aprovada sem decisão humana.

## Features extensas e documentação antiga

Use [SPEC/TASKS](../features/README.md) quando a execução ultrapassar uma tarefa simples.
Reutilize EXECUCAO.md já adotado por um domínio; não manter duas listas de progresso.
Documentos antigos úteis permanecem acessíveis, mas são consultados por seção.
Uma referência obsoleta deve receber aviso específico com destino vigente, não só outro
parágrafo contraditório no fim do arquivo.
