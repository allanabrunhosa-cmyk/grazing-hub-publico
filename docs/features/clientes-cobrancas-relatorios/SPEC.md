# Cadastro comprador, cobranças e relatório de clientes

## Objetivo

Reunir as vendas no cadastro comprador canônico. Preservar os titulares de cobrança
e os destinos reais de cada pedido. Permitir a busca de um cliente no Dashboard.

## Contratos

- O relatório usa o ID canônico explícito do cliente. Percorre aliases existentes.
  Exibe Nome Fantasia para PJ e Nome Completo para PF. Não deduz identidade por nome,
  e-mail ou snapshot. Os snapshots comerciais permanecem intactos.
- O filtro `cliente` mantém o ID na URL e no CSV. A busca usa o nome permitido pelo
  acesso a contatos. Sem essa permissão, não expõe nomes nem opções de clientes.
- A seleção do cliente mostra também o total histórico original comprovado e os
  ajustes de frete separados. Uma origem incompleta aparece como “Não apurado”.
  Essa medida não substitui a política comercial vigente de produtos e frete cobrado
  nem representa conciliação financeira. O CSV conserva as colunas anteriores.
- A Principal pertence ao titular das Informações gerais. Cobranças adicionais
  podem ter outros titulares. O limite explícito é 250 opções por cadastro.
- A reconciliação histórica conserva `titularPendente: true` quando a fonte não
  comprova o CNPJ. Essa condição pertence à prova histórica. O livro ativo não
  aceita novas cobranças incompletas. A confirmação do pedido e o destinatário
  da NF-e recusam uma cobrança pendente selecionada.
- `entregaPadrao` conserva o endereço único legado. O livro opcional `enderecos`
  contém destinatário, endereço e `textoOriginal` opcional. `selecionado` aponta a
  preferência; os campos escalares espelham essa opção. Até 250 opções.
- Uma entrega histórica incompleta preserva o texto original visível. Não inventa
  CEP, número ou destinatário. Um pedido novo continua sujeito à validação da entrega.
- Reabrir um pedido conserva seu destino. Sem correspondência única no livro,
  a tela mantém “Endereço deste pedido”. A edição exige escolha ou adição explícita.
- Copiar cobrança usa a cobrança selecionada e altera apenas a entrega escolhida.
- Cada livro aceita apenas uma opção por endereço postal completo. A chave usa
  país, CEP, logradouro, número, complemento, bairro, cidade e UF. Normaliza caixa,
  acentos, espaços e abreviações convencionais. Preserva números e unidades
  distintas. CNPJ, nome, destinatário, contato e texto original não distinguem o
  mesmo endereço. Cobrança e entrega podem compartilhar o mesmo endereço.
- Cobrança e entrega usam o seletor pesquisável oficial. A opção mostra o titular
  e o endereço. Adicionar abre um formulário temporário. Só inclui a opção após
  preencher os campos obrigatórios e verificar duplicidade. Excluir opção
  preenchida exige confirmação. A Principal permanece fixa e não pode ser excluída.
- O servidor confere os campos obrigatórios em todos os caminhos que gravam o
  cadastro, inclusive Pedidos. Rascunhos de pedidos mantêm seu contrato próprio.
  O CPF permanece opcional; Nome Completo de PF é obrigatório.
- Cobranças PJ novas ou alteradas usam a consulta pública do CNPJ para razão
  social e endereço. A consulta ocorre antes da transação. O servidor vincula a
  prova à entrada e à versão do cadastro; falha de consulta impede a gravação.
  BrasilAPI é a primeira opção. Minha Receita, a mesma origem usada pela BrasilAPI,
  atende como alternativa em falha de rede, indisponibilidade ou resposta não JSON.
  Cada tentativa tem limite de oito segundos. Não mistura respostas entre fontes.
  A prova registra qual fonte respondeu.

## Implementação

- BI: `src/lib/vendas/bi-consultas.ts`, `bi-dominio.ts` e
  `src/components/vendas/bi/bi-vendas.tsx`. Critérios de receita em
  [Fontes do BI](../bi-vendas/FONTES.md).
- Cadastro: `dominio.ts`, `cliente-cobranca.ts`, `cliente-entrega.ts`,
  `cliente-pedido.ts`, `pedidos-dominio.ts`, formulário de Clientes e editor de Pedidos.
- Manutenção: `clientes-cobrancas-reconciliacao.ts` e
  `scripts/clientes-cobrancas-reconciliar.ts`. A migration
  `20261020140000_reconciliacao_cobrancas_clientes` acrescenta a entidade técnica à
  whitelist SQL. Preserva os sete tipos anteriores e limita a nova origem à manutenção.
  Não altera registros existentes nem o schema Prisma.

## Reconciliação dirigida

A configuração contém dados privados e fica apenas no servidor, junto ao backup.
O código versionado não contém cadastro real, e-mail, documento ou endereço do cliente.
A operação lê a família canônica e fontes explícitas dos pedidos. Cada transcrição
vincula ID, hash e caminho da fonte. A identidade comprovada usa perfil empresarial
exato ou vínculo histórico auditado; coincidência postal não comprova CNPJ.

A política `MANTER_PENDENTE` registra titulares não comprovados como pendentes.
Uma fonte Shipping real precisa ser preservada. Campos C/H de cobrança não são
tratados como destino real. A cópia de cobrança para o livro de entregas é uma opção
cadastral adicional. Não substitui os destinos anteriores.

A prévia contém versões, fontes, alterações, contagens e token. Aplicação/reversão
exigem artefato imutável conferido, aprovação técnica vinculada ao token, configuração
e backup verificado. O processamento de dados reais fica no próprio servidor.
A transação usa controle de versão e auditoria com ator SISTEMA. Repetir a operação
não duplica dados. A reversão exige o estado aplicado ainda intacto.

O saneamento posterior do livro ativo remove opções incompletas mediante política
explícita `REMOVER`. Reconsulta o CNPJ antes de consolidar cobranças. Dá preferência
à Principal entre duplicatas. Remapeia a seleção ao sobrevivente. Preserva integralmente
pedidos, destinos históricos e fontes originais. Mantém antes/depois e motivos da
remoção na auditoria privada. A Principal incompleta bloqueia a operação.

Uma reserva de documento em alias só pode ser transferida dentro da mesma família,
com titular comprovado e hash/versão conferidos. O documento original do alias fica
preservado na cobrança e na prova técnica. A identidade anterior da raiz permanece
em cobrança comprovada. Os pedidos, fontes originais, valores, estoque e documentos
fiscais não são reescritos.

## Aceite

Conferir agrupamento, comparação, ranking, paginação e CSV com pedidos sintéticos,
incluindo 125 históricos, aliases e homônimo. Testar permissões, falha e concorrência
de consultas. Testar domínio, seleção/edição de entregas, cobrança pendente e recusa
de faturamento. Validar transação, idempotência, reversão e limites em PostgreSQL
isolado. Executar lint, typecheck, build e UI com dados fictícios antes de publicar.
Registrar separadamente a aplicação produtiva e a publicação efetiva.

## Equivalência dos destinos históricos — 20/10/2026

O mesmo imóvel pode aparecer com abreviação, pontuação, título ou número repetido
no logradouro. Essas diferenças não criam uma opção nova. Nome de concessionária,
telefone e código comercial de loja encontrados no texto histórico não comprovam
uma unidade física diferente. O livro ativo deve conter uma opção por destino.

A comparação estrita normaliza apenas variações seguras. Mantém CEP, bairro,
número e unidades físicas. Uma chave local separada sugere equivalências por
país, logradouro, número, cidade e UF; não autoriza união automática. Divergências
de CEP, bairro ou referências comerciais são revisadas com as fontes históricas
e consultas postais. Prédios, blocos, salas e apartamentos distintos permanecem
separados. Um dado auxiliar ausente não comprova uma segunda unidade.

A operação dirigida registra os membros e seus hashes, motivo, sobrevivente e
complemento final. Preserva itens fora dos grupos, Principal, cobranças, destinatário,
contato e a seleção. Alterações ficam limitadas ao livro ativo de entrega. Mantém
antes/depois, mapa dos índices, versão, idempotência e reversão protegida. Pedidos,
valores, destinatários fotografados e fontes originais não são reescritos.

Seletores de cobranças antigas projetam opções postais únicas, conservando os
índices originais e o titular selecionado. Abrir um pedido não grava alterações.
