# Execução — correção de pagamentos e notas aceitas

Base publicada: `a86e9b5d`, remoto `publicacao` (`grazing-hub-publico`).
Branch: `codex/correcao-fatura-manifestacao-publica-20261116`.

- [x] Diagnóstico: seleção de outro cartão era bloqueada na interface e no servidor.
  A duplicata NF-e também guarda cartão, exigindo consistência com seus lançamentos.
- [x] Ambiente isolado baseado na main, preservando alterações da cópia original.
  Dependências existentes reutilizadas; cliente Prisma e tipos de rotas gerados.
- [x] Backend de vínculo de fatura, autorização e auditoria.
- [x] Backend de correção de notas aceitas, concorrência e efeitos integrados.
- [x] Interface de correção com dados atuais e salvamento explícito.
- [ ] Regressões de faturas, NF-e/NFS-e, estoque e cancelamento de compra.
- [ ] Integração com PostgreSQL local e dados sintéticos.
- [x] QA visual isolado e revisão independente.
- [ ] Lint, tipos, build e documentação dos contratos finais.
- [ ] Publicação autorizada, estabilidade e smoke de leitura.

O remoto privado `origin/main` estava parado em 21/10. O trabalho inicial foi
preservado em stash local e reaplicado por diff sobre a base pública de 16/11.
Nenhum histórico privado será enviado ao repositório público.

## Evidências anteriores à publicação

- `npx tsc --noEmit`: aprovado; nova conferência ocorre no build final.
- ESLint dos arquivos alterados: aprovado. `lint:design`: zero desvios novos.
- Contratos Playwright em 390 claro/toque e 1440 claro: **42 aprovados**.
- NF-e e NFS-e: interface inspecionada com dados fictícios em desktop, 390 e
  768 CSS px; NFS-e também em tema escuro. Sem aprovação de baseline de pixels.
- `custos-integracao.test.ts`: **22 aprovados**, incluindo reenvio, pagamentos,
  permissões por efeito, legado, estoque, custo residual e cancelamento vigente.
- `vencimento-integracao.test.ts`: **13 aprovados**, incluindo correção real de
  NFS-e, preservação de IDs, parcela protegida e reestruturação de parcelas.
- Reteste de pagamentos, conciliação e serviço de NF inteira: **41 aprovados**.
- Cenários novos de fatura: **11 aprovados**, com BOLETO/PIX sem cartão e reversão.
  A bateria completa de faturas está em fechamento.
- A primeira bateria de domínio encontrou fixtures antigas incompletas para a
  view do Atendimento, sessão/auditoria e metadados do tratamento local. Foram
  corrigidas somente nas suítes, preservando migrations e asserções do produto.
- Backup privado pré-publicação com arquivo verificado por `pg_restore --list`;
  configuração fiscal e imagem anterior preservadas. Nenhuma migration nova.

Próximo passo: concluir a compilação/revalidação final e publicar a revisão validada.
Nenhuma operação fiscal ou financeira real foi usada como teste.
