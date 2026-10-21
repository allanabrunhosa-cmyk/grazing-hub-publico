# Identidade de clientes por e-mail e documentos

## Objetivo e aceite

Solicitação de 19/10/2026: agrupar cadastros com o mesmo e-mail, impedir repetição de e-mail/CPF/CNPJ em Clientes e Pedidos e corrigir o preenchimento pelo CNPJ.

- E-mail é a busca principal e fica antes dos nomes. Novos cadastros interativos/MCP exigem e-mail. Legados sem e-mail permanecem editáveis; importação histórica auditada pode conservar ausência sem inventar um endereço.
- Identidade normaliza caixa/espaços do e-mail. Não remove pontos nem sufixos de provedores. CPF/CNPJ normaliza pontuação, com o contrato numérico existente.
- Um e-mail ou documento primário pertence a uma única raiz, incluindo cadastros inativos. Documentos de cobranças adicionais identificam terceiros e podem se repetir em pedidos/clientes diferentes.
- Criar duplicado informa o conflito e pede a seleção do cadastro existente. Não sobrescreve nem reaproveita silenciosamente dados de outro titular.
- A consolidação conserva origens como aliases inativos, sem exclusões. Agrupa por identidade exata, sem aproximar nomes, telefones ou domínios. Pedidos conservam snapshots, valores e títulos; o vínculo cadastral e a referência no rascunho acompanham a raiz.
- Contatos e fontes conservam suas origens. A consulta cadastral agrega contatos dos aliases. Importação e iFood resolvem fontes antigas pela raiz vigente.
- Busca em Clientes e Pedidos inclui identificadores primários reservados dos aliases. A seleção e a gravação usam o ID e os dados atuais da raiz. E-mails/documentos alternativos são somente dados de pesquisa; não enviam a relação ou endereços brutos das origens.

## Banco e operação

Migration SQL manual/aditiva, com auditoria anterior/posterior e proteção de concorrência no banco. A operação escolhe uma raiz existente por regra determinística: PJ com documento, pedidos operacionais, preenchimento e antiguidade. Outros titulares e endereços permanecem nas origens e nas cobranças adicionais. Principal conserva o titular da raiz; endereço não comprovado não é inventado.

A consolidação aborta se membros tiverem movimentos de crédito, excederem vinte cobranças, houver ciclo/vínculo incompatível ou colisão que exija transferir um documento reservado em alias. A primeira avaliação produtiva somente leitura encontrou nove grupos, 167 raízes, 229 registros com aliases, 217 pedidos históricos, quatro operacionais e zero movimentos de crédito. Apenas dois endereços estavam preenchidos. Há treze raízes sem e-mail, preservadas como legado.

A raiz permanece ativa se qualquer membro consolidado estava ativo. O limite de crédito e o prazo de boleto usam o menor valor não nulo; formas permitidas usam a interseção das listas restritas. Não somar limites nem ampliar permissões financeiras. Grupos que não precisam de consolidação conservam suas regras.

Guarda no servidor, trava vendas-cadastros, restrições/triggers e serialização de escritas protegem também importadores e chamadas concorrentes. Não reativar aliases. Não alterar a unicidade global anterior da coluna documento.

Antes de operar produção: backup íntegro e plano do executor vinculado ao hash exato do SQL/destino. Relatório agregado, sem dados pessoais em logs. A auditoria identifica a automação da solicitação; não representa outro usuário. Reversão exige conferir versões e as restrições novas; dump não é restaurado sobre transações posteriores.

## CNPJ e interface

Reutiliza IdentidadeCobrancaForm, CadastroClientePedido, Input, Combobox e tokens existentes. A colagem aceita máscara antes de normalizar os quatorze dígitos. Razão social comprovada e campos postais disponíveis são aproveitados; resposta parcial avisa e mantém campos ausentes vazios. Respostas obsoletas e avisos de outro titular são descartados. Sem salvamento ao perder foco.

Validações essenciais: identidade normalizada, concorrência/RR, aliases/inativos, cruzamento entre e-mail/documento, importação repetida, snapshots/valores preservados, limites/rollback da consolidação e CNPJ completo/parcial/erro/colagem em ambos os consumidores. Referências visuais novas permanecem Em revisão.
