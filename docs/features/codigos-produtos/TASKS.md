# Execução — códigos dos produtos

- [x] Inventário em leitura: 247 cadastros, todos sem código comercial; UUID era fallback fiscal.
- [x] Padrão definido: classificação, categoria de origem, sequência; estabilidade e não reutilização.
- [x] Domínio, persistência, auditoria, ação administrativa e migração aditiva.
- [x] Cadastro, busca, ficha técnica e consumidores fiscais.
- [x] Node 22: 403 testes de domínio/permissões (26 opt-ins ignorados), 215 fiscais e 58 de interface/ficha.
- [x] PostgreSQL isolado: 48 testes de organização, concorrência, cadastro e importações; nenhum skip.
- [x] Prévia sintética: 8 contextos visuais, 24 capturas, auditoria sem diagnósticos. Referências consultivas.
- [x] Prisma generate/validate e lint dos arquivos alterados.
- [x] Verificação de tipos Node 22 da revisão final; importação da prévia ajustada ao padrão `.mjs`.
- [x] Bateria geral: 597 arquivos; 6894 casos aprovados, 1089 opt-ins desativados e 24 falhas na fixture antiga de importação.
- [x] Fixture antiga adaptada à nova fronteira: reexecução 32/32 aprovada; consumidores próximos 28/28. Nenhuma falha residual conhecida.
- [ ] Build e controles de CI da revisão final.
- [ ] Backup, CI, integração e publicação autorizada.
- [ ] Organização administrativa no HUB e conferência de códigos/persistência.

Nenhuma emissão foi autorizada nesta tarefa. A nota anterior permanece inalterada.

Reexecuções: a primeira execução restrita de testes/visual não iniciou os casos;
a execução com acesso local normal passou. A primeira integração detectou histórico
redundante por ordem de chaves JSONB; comparação estrutural corrigida e R2/R3 passaram.
A fixture histórica recebeu o helper oficial de namespace antes da reexecução aprovada.
Logs e capturas ficam em `.tmp/codigos-produtos-20261111` e `.tmp/codigos-produtos-ui`.
O resultado da publicação e da organização no HUB será anexado à PR desta entrega,
sem provocar outra publicação apenas para registrar a conferência posterior.
