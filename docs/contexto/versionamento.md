# Versionamento e sincronização com o GitHub

O GitHub é a fonte de verdade do código versionado do Grazing HUB. Ao concluir uma
tarefa de desenvolvimento validada, o agente deve criar commits coerentes e enviar
a branch correspondente ao GitHub, evitando deixar trabalho relevante exclusivamente local.

A `main` deve representar código integrado e validado. Alterações incompletas devem
permanecer em branches próprias, também publicadas no GitHub e identificadas como
trabalho em andamento. Publicar uma branch de preservação não significa validar seu
conteúdo para integração ou produção; registrar as pendências reais.

Antes de iniciar nova tarefa, sincronizar referências remotas (`git fetch origin`) e
verificar branch, status, upstream, commits não enviados e divergências relevantes com
a `origin/main`. Preservar alterações existentes e conferir outras worktrees quando
o trabalho depender delas. Não acumular silenciosamente grandes conjuntos de arquivos
modificados ou commits exclusivamente locais entre tarefas.

Push de branch de trabalho faz parte do fechamento normal de uma tarefa validada e
não precisa de nova autorização a cada execução, desde que não envolva segredos,
arquivos indevidos, force push ou efeitos operacionais externos. Revisar o escopo de
cada commit, respeitar os [testes A/B/C](testes.md) e confirmar diretamente no remoto
que a branch e os commits enviados existem. Falha de envio deve ser informada como
pendência; commit apenas local não encerra a sincronização.

Merge/push na `main` deve respeitar as validações e o fluxo de integração do projeto.
Não duplicar mudanças equivalentes já incorporadas. Reconciliar em branch própria
baseada na `main` atual, preservando o trabalho anterior em branches recuperáveis.
Não usar reset destrutivo, clean, force push na `main` nem apagar branches antigas
durante a reconciliação. Identificar branches obsoletas para limpeza futura.

Publicação/deploy em produção não deve ser confundida com simples sincronização Git.
Neste projeto, atualizar a `main` dispara webhook/build no Dokploy. Isso exige as
validações e a autorização aplicável do [ritual de deploy](deploy.md); autorização
histórica de uma publicação não é autorização permanente para a próxima. Sem essa
autorização, manter a branch atualizada no GitHub e pronta para integração, informando
o que falta para atualizar a `main`, sem publicar em produção.

Backups privados, bancos de teste, caches, logs, credenciais e cargas/exportações de
dados reais ficam fora do código versionado. Preservá-los quando necessário, sem
enviá-los ao GitHub ou confundir sua existência com trabalho de código pendente.
