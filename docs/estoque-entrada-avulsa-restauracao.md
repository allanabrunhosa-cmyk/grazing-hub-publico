# Entrada avulsa em Movimentações — 23/09/2026

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Correção

A reorganização de Estoque em `9744d1b` retirou a navegação horizontal que
continha Entrada de insumo. O formulário e as ações permaneceram existentes,
mas Movimentações não recebeu um atalho substituto.

Restaurado o acesso **Estoque → Movimentações → Entrada avulsa**, inclusive
quando não há movimentos. Reutiliza `/inventario/entrada-avulsa`, o Button
compartilhado e a permissão `inventario.entrada/adicionar` (que também exige
visualização). Administrador, herança e exceções individuais são respeitados.
A página e a Server Action conservam as guardas servidoras existentes.

Nenhuma alteração no formulário, nas modalidades Completa/Simples, itens,
conversões, rateio de custos, pagamento, custo médio, histórico ou persistência.
Nenhuma migration e nenhum lançamento real utilizado para testes.

## Validação local

- `lint:design`, TypeScript e lint dos três TSX alterados passaram.
- Inventário, layout e fronteiras servidoras: 201 testes passaram; 44 testes
  opt-in de integração ficaram desabilitados nessa execução.
- Sete casos novos verificam acesso ao endereço original, inclusive sem
  movimentos, administrador, permissão específica, leitura, ausência de acesso
  e concessão/veto individual. Os filtros e saldos existentes continuam cobertos.
- Imagens da prévia fictícia conferidas no navegador: desktop e iframe de 390px;
  botão visível, sem corte, mantendo filtros e tabela/cartões.
- Tentativa separada de integração da entrada avulsa não executou o cenário:
  PostgreSQL de testes em `127.0.0.1:55439` indisponível (ECONNREFUSED).
  Não confundir testes com mocks aprovados com persistência novamente validada.

## Publicação

Preparar a correção sobre a versão atual de `main`, preservando publicações
concorrentes. Conferir build e versão remota antes do push. Após publicação,
abrir Movimentações e o formulário sem registrar uma entrada real.
Reversão restrita: remover o atalho desta correção; não reverter banco ou outras
funcionalidades publicadas no intervalo.

## Validação final sobre a versão publicada

- Base de publicação: `8a59aad`, sem incorporar a pendência do laboratório da
  Central nem alterações não concluídas de Vendas.
- Prisma validate/generate, lint dos arquivos alterados, `lint:design` e build
  Node 22 passaram (55 páginas, TypeScript incluído). Permanecem avisos de
  middleware legado e dependências do Edge Runtime, fora desta correção.
- Suíte final sequencial: **202 passaram e 43 opt-in foram ignorados**, em 21
  arquivos (19 aprovados, 2 de integração não habilitados).
- Integração de entrada avulsa habilitada e aprovada: cabeçalho, estoque, custo
  médio, despesa e baixa testados com dados sintéticos em schema temporário.
- Incidentes de preparação resolvidos: Prisma ainda não gerado na primeira
  execução isolada; PostgreSQL desligado/em recuperação; dois timeouts de 5s
  durante build paralelo. Geração concluída, banco pronto e repetição sequencial
  passaram sem mudar as asserções nem os limites de tempo.
- Backup privado anterior à publicação em
  `<BACKUP_PRIVADO>`.

## Publicação concluída

- Publicado `0e49f15` (correção `314c818`), sobre `8a59aad`, sem force push.
- Dokploy concluiu o build Docker; novo contêiner `2160cc9183d1` em execução.
- `prisma migrate status`: 64 migrations, schema atualizado; nenhuma migration nova.
- Backup conferido com `pg_restore --list` (não é teste de restauração completa).
  Configuração fiscal preservada sem alterações ou consultas fiscais.
- Conferência autenticada em HTTPS: Movimentações mostra **Entrada avulsa**;
  clique abre `/inventario/entrada-avulsa` com Completa/Simples, fornecedor,
  itens, composição de custos, pagamento e Registrar. Imagens conferidas.
  Nenhum formulário de produção foi preenchido/enviado e nenhum saldo alterado.
- Banco de testes e prévia iniciados nesta tarefa foram encerrados normalmente.
- Registro pós-deploy salvo apenas localmente para não disparar outro deploy
  somente de documentação. A pendência anterior do laboratório não foi publicada
  junto desta correção e continua independente.
