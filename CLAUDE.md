@AGENTS.md

# Continuidade no Claude Code

- Trabalhe em português simples e direto. Execute tarefas reversíveis dentro do pedido; peça decisão para impacto relevante ou ampliação de escopo.
- Comece por `docs/CONTINUIDADE.md`. Consulte `docs/AMBIENTE_E_PUBLICACAO.md` para ambiente e acessos. Código e evidência atual prevalecem sobre relatos antigos de execução.
- Antes de editar, confira origem, branch, status e regras `AGENTS.md`/`CLAUDE.md` nas subpastas e seus ancestrais. A importação da raiz não substitui essas instruções.
- Base ativa: `allanabrunhosa-cmyk/grazing-hub-publico`. O privado `grazing-hub` está arquivado. Não envie seu histórico ou branches ao público; porte somente conteúdo revisado, conforme `PUBLICACAO.md`.
- Preserve alterações alheias, branches e stashes. Nunca use push forçado, limpeza destrutiva ou descarte para resolver divergências.
- Faça verificações proporcionais ao risco. Documentação pura não exige build/banco. Financeiro, estoque e permissões exigem testes dos contratos afetados, incluindo transações, precisão e idempotência.
- Preserve snapshots, auditoria, datas de negócio e autorização no servidor. Não teste com operações ou dados reais. Não altere migrations aplicadas.
- Respeite o design aprovado e os componentes/tokens oficiais. Não aprove referências em nome do usuário. A orientação atual recebida para remover/excluir é X neutro em repouso e vermelho no hover; a divergência com a base pública está registrada na continuidade. Não redesenhe telas por conta desta passagem.
- Antes de cópias, instalações ou builds grandes, confira espaço: alertar abaixo de 20 GB decimais; resolver capacidade abaixo de 10 GB antes de consumir vários GB. Não remover cópias automaticamente nem ampliar a lista de limpeza autorizada.
- Senhas, tokens, certificados, dados de clientes, valores reais, backups e logs privados ficam fora do Git e dos prompts. Configure acessos por mecanismos privados. Não troque `AUTH_SECRET` produtivo para instalar o Claude.
- Esta passagem autoriza preservação em branch, sem deploy. Não atualize `main`, não acione Dokploy e não altere serviços. Scripts de manutenção preservados como WIP não estão autorizados a operar a VPS.
- Ao encerrar, registre resultado, verificações realmente executadas e pendências. Distingua código presente, teste aprovado, produção e homologação externa.
