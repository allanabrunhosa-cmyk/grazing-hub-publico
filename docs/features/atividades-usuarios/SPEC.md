# Atividades por usuário

Implementação de 10/10/2026, baseada em `origin/main` 8911c91e. Validação local
concluída; publicação autorizada pelo usuário após a entrega inicial, seguindo o
[ritual de deploy](../../contexto/deploy.md). Evidências em [TASKS](TASKS.md) e [medição](MEDICAO.md).

## Comportamento e acesso

Configurações → Usuários & Permissões → Gerenciar usuário → Atividades.
Padrão: fatos realizados **pelo autor**, últimos 30 dias civis de São Paulo.
A perspectiva **Alterações no cadastro** filtra o usuário afetado e apresenta o autor real.
Usuários inativos mantêm atividades; excluídos têm consulta separada, somente leitura.
Filtros: período, módulo, ação exata, resultado e origem. 50 eventos por carregamento,
ordem `ocorridoEm DESC, id DESC`, detalhes sob demanda e links autorizados para
entidades existentes com rota de detalhe. Estados de carregamento, vazio, erro e acesso negado.
Referência visual permanece **Em revisão humana**.

Nova capacidade `configuracoes.usuarios.atividades/visualizar` no catálogo existente,
negada por padrão para perfis não concedidos. Administrador oficial continua autorizado.
Lista e detalhes exigem também `configuracoes.usuarios` e a visualização do recurso
de origem. A autorização é reaplicada a cada consulta; financeiro e custos têm
restrições adicionais de conteúdo. Nenhuma API grava/edita/apaga atividades.

## Arquitetura e invariantes

- `AtividadeUsuario`: registro próprio enxuto, fora de Usuario. Autor histórico sem
  FK destrutiva; tipo de ator e iniciador separados, UTC em timestamptz.
- Auditorias existentes são fontes canônicas. Triggers INSERT criam **referência
  única fonte/tabela/id**, sem copiar antes/depois ou payload completo.
- Lacunas usam `registrarAtividade(tx, identidadeValidada, evento)` na mesma transação
  do negócio. Lista fechada de campos, tamanho limitado e nenhum segredo/dado pessoal de terceiros.
- Eventos de sistema/iFood não pertencem ao criador da integração. Iniciador só é
  preservado quando a ação de origem o comprova. Login recusado sem identidade
  confirmada é fato do sistema, sem e-mail/autor suposto.
- Contexto de origem é interno e transaction-local. MCP usa identidade OAuth já validada.
  Fonte sem evidência de canal permanece `NAO_IDENTIFICADA`; não inferir API/interface retroativamente.
- Registro transacional falha junto com a mudança: rollback não deixa falso sucesso.
  A projeção acrescenta essa dependência às fontes, coerente com auditoria obrigatória;
  diagnóstico e recuperação em lotes evitam projeção volátil ou fila em memória.
- Login confirmado exige registro antes de emitir cookie; falha do registro impede
  iniciar sessão. Logout e recusa de acesso continuam seguros se o banco de auditoria
  falhar: tentativa síncrona aguardada, diagnóstico fixo sem payload e sem promise solta.
  Indisponibilidade integral do banco pode impedir evidência desses fatos; não há promessa
  de entrega infalível sem outro armazenamento durável.
- Fechar navegador não é logout. Envio/reimpressão é solicitação; retorno do cliente
  sobre transporte não comprova papel impresso. Somente confirmação explícita do operador
  recebe resultado de confirmação física.
- Índices autor/data/id e afetado/data/id; chave de sequência fixa o limite das páginas,
  cursor assinado vincula todos os filtros. Sem OFFSET, contagem integral ou JOIN de payload
  na listagem. Transações em andamento que já reservaram uma sequência menor podem
  confirmar depois da primeira página; esse limite não representa snapshot MVCC entre requisições.
- Aplicação de empresa única: identidade de sessão não possui tenancy. `lojaId`
  é preservado nas fontes que o possuem; não inventar isolamento multitenant.

## Banco, manutenção e privacidade

Migration SQL manual/aditiva `20261010090000_atividades_usuarios`.
Não altera migrations aplicadas, não apaga fontes e não faz backfill em massa durante deploy.
UPDATE/DELETE/TRUNCATE são bloqueados por triggers. Manutenção exige papel separado
`grazing_atividades_manutencao` e intenção explícita; a migration não concede esse papel.
Administrador do próprio banco pode alterar proteção: não se promete inviolabilidade.
Recuperação lê apenas fontes reais em lotes, deduplica reprocessamentos e preserva IDs.

Proposta de consulta operacional de 12 meses é configurável por categoria e apresentada
no diagnóstico; não restringe o período consultável nem autoriza descarte/prazo legal.
Expurgo fica desativado. Diagnóstico mede dados/índices/volume e
projeções; WAL e backups permanecem separados. Não adicionar infraestrutura externa.

Reversão: parar a versão nova antes de voltar código, preservar AtividadeUsuario e fontes;
triggers podem permanecer registrando versões antigas. Se for necessário interromper
projeção, remover somente triggers `atividades_projetar_insert` das fontes em janela
autorizada, preservando a função/tabela e registrar intervalo. Recuperação posterior
reprojeta fontes reais desse intervalo. Nunca DROP/TRUNCATE do histórico para reverter.
Em reversão prolongada, manter a proteção `NOT EXISTS` da limpeza de `McpEvento`
em `src/lib/mcp/servidor.ts`: versões anteriores apagam fontes após 90 dias. O rolling
imediato sem backfill não chega a esse corte, mas manter somente a central não conserva
as referências de origem indefinidamente quando o código antigo volta a limpar fontes.

## Preparação para publicação autorizada

1. Confirmar autorização explícita desta entrega e o ritual de deploy do projeto;
   conferir revisão da branch, janela de banco e salvaguardas operacionais existentes.
2. Aplicar o SQL aditivo manual antes de iniciar o código novo. Não executar `migrate dev`,
   `db push` ou recuperação histórica durante a publicação. As 14 fontes recebem triggers
   de INSERT; escolher janela que comporte os locks breves de criação dessas triggers.
3. Conferir o papel real de execução: precisa de SELECT/INSERT em `AtividadeUsuario` e
   uso da sequência, além dos acessos já existentes às fontes. Se migration e aplicação
   usam papéis separados, conceder somente esses privilégios ao papel identificado;
   não adivinhar seu nome nem conceder manutenção à aplicação. Validar a proteção de
   UPDATE/DELETE/TRUNCATE antes da liberação.
4. Gerar cliente e compilar a revisão validada; publicar pelo fluxo autorizado.
   Conceder a nova capacidade somente aos perfis aprovados; administrador oficial
   mantém o acesso pelo contrato atual.
5. Verificar leitura autorizada/negada, início de cobertura, registro transacional e
   diagnóstico de volume com o procedimento operacional aprovado. Testes de escrita
   permanecem em ambiente sintético; não fazer negócio real para validar a feature.
6. Diante de reversão, seguir o procedimento de preservação acima. Backfill, ampliação
   de perfis e qualquer manutenção/descarte exigem sua autorização própria.

O fechamento inicial não executou esses passos em produção. A autorização posterior
permite executá-los; confirmar o resultado efetivo no registro da publicação.

## Aceite

Autoria/afetado, proteção lista/detalhes/API, minimização, rollback, deduplicação,
inatividade/exclusão, origem MCP/automação, concorrência/filtros/paginação e falhas.
100 mil eventos sintéticos, PostgreSQL tamanho efetivo/WAL e latências equivalentes.
Regressão, lint, lint:design, tipos, Prisma, build e imagens responsivas isoladas.
Nenhuma integração, estoque automático, emissão, pagamento ou comunicação é ativada.
