# Publicação limpa

Esta cópia contém código, schema, regras, testes, design e exemplos sintéticos.
O histórico anterior, as conversas e os arquivos operacionais permanecem privados.
Não envie branches antigas ou os objetos do repositório original para esta base.
Transfira alterações pendentes por diff revisado e PR.

A migration de recuperação de cursor contém somente DDL na cópia pública.
A SQL aplicada original e os dados da operação antiga permanecem privados e intactos.
O executor aceita somente o par conhecido de arquivo público e checksum histórico.
Não reexecuta a recuperação nem altera o histórico. Consulte o contrato e os testes em
[SQL público e histórico aplicado](docs/contexto/migrations-publicas.md).
Qualquer divergência fora do par conhecido continua bloqueada.

A adoção em produção exige validar a partida completa, conferir o plano em leitura
e aprovar a troca de origem e o deploy. Esta publicação de código não fez essa troca.

Uma captura antiga de preço ficou no acervo privado enquanto sua origem sintética
não for comprovada. As demais imagens técnicas foram preservadas. A aprovação
humana de referências visuais continua obrigatória.

O teste em banco vazio aplicou as primeiras 140 migrations. A migration
`20261021120000_atendimento_permissoes_hierarquia` encontrou uma falha preexistente
na guarda da view opcional `atendimento_integracao.identidade`. A SQL aplicada
original permanece intacta. A instalação em banco novo sem essa view está pendente.
