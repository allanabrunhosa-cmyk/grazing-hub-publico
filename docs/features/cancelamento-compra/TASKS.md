# Execução

- [x] Diagnóstico: duas notas distintas/idênticas; segunda aceita e depois recusada,
  conservando 8 títulos pendentes e 8 entradas; usuário confirmou uma única compra.
- [x] Persistência e domínio transacional, prévia, autorização, idempotência.
- [x] Integração no Financeiro e recusa fiscal/aceite.
- [x] Popup de itens/datas/motivo e QA isolado (Em revisão visual).
- [x] Regressões de domínio, integrações e autorização; nível C.
- [ ] Publicação autorizada, backup/schema, serviço estável e smoke.
- [ ] Correção operacional somente da NF 3333074 e conferência da nota preservada.

Validação de 06/10/2026: Prisma validate/generate; migrations completas em esquemas PostgreSQL temporários; 16 testes de custos/cancelamento e 4 de pagamentos; 22 testes dos popups; 23 testes de relatórios/filtros após integrar main; tipos, lint global, lint:design e build webpack aprovados. A bateria global executou 2243 testes aprovados e 423 opt-ins ignorados; houve uma falha de importação server-only no teste de caixa alta, corrigida pela simulação explícita e revalidada separadamente (1 teste aprovado). Testes ignorados não são aprovação. Node local 24; publicação recompila no Node 22 do Docker.

QA com fixtures: aviso de todos os itens/datas, confirmação bloqueada sem motivo, desktop/celular, recusa com efeitos e rolagem. Referência visual em revisão. Nenhuma consulta fiscal externa ou dado real usado para testar.

Backup obrigatório privado criado e verificado antes da publicação; configuração fiscal no banco preservada. Próximo passo: publicação e correção operacional da NF 3333074. Nenhum dado real alterado até este registro.
