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
- [x] Regressões de faturas, NF-e/NFS-e, estoque e cancelamento de compra.
- [x] Integração com PostgreSQL local e dados sintéticos.
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

## Conferência da primeira publicação e ajuste da consulta

PR #24 integrada em `bf7c2112`, após os quatro checks aprovados. Faturas no CI:
**91/91**. Interface final: **119/119**. Build e lint finais aprovados.
A nova instância entrou e o detalhe de nota aceita abriu **Editar informações**.
Nenhuma correção de documento real foi salva para validar.

A conferência autenticada da fatura revelou candidatos permanentemente bloqueados:
`correspondenciasFaturaAction` usava o helper de escrita, invalidando o layout
financeiro após cada consulta. Isso renovava os dados RSC e reiniciava a própria
leitura. O ajuste remove somente a invalidação da consulta, mantendo permissões,
normalização de erros, proteção contra respostas antigas e invalidação das escritas.

Próximo passo: validar/publicar o ajuste de consulta e confirmar a seleção habilitada
na fatura real, sem confirmar vínculos ou pagamentos.
Nenhuma operação fiscal ou financeira real foi usada como teste.
