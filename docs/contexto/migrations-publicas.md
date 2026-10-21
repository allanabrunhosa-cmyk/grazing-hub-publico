# SQL público e histórico aplicado

A exportação pública retém o DDL da migration
`20260909210000_sefaz_recuperacao_cursor_656`. A operação única de recuperação de
cursor e seus dados reais permanecem na SQL original privada. Essa operação não é
uma regra automática do produto nem uma semente para instalações novas.

Nenhum arquivo aplicado no repositório original ou registro de banco foi alterado.
A SQL pública e a SQL histórica não são equivalentes: a estrutura foi preservada,
mas a operação sobre dados foi omitida da cópia pública.

O executor versão 3 aceita o registro histórico somente quando três condições
coincidem: nome exato da migration, hash exato do arquivo público conhecido e
checksum histórico original conhecido. Os pares LF/CRLF ficam fixos no código.
Não há variável ou parâmetro para ampliar a lista. Outro nome, conteúdo, checksum,
histórico incompleto ou registro duplicado continua bloqueado.

Uma migration registrada como aplicada não entra nas pendências. O executor não
reexecuta a recuperação nem atualiza `_prisma_migrations`. Uma instalação nova usa
o DDL público e registra seu checksum normal. A aprovação de um plano pendente
continua vinculada ao executor, ao destino e ao histórico.

Antes de adotar a base pública em produção, validar a partida completa do
Dockerfile em base sintética: bootstrap e `prisma migrate deploy`. Conferir o
plano em leitura no destino autorizado. Qualquer divergência fora do par conhecido
exige análise; não editar o banco nem marcar migrations como aplicadas para passar.
