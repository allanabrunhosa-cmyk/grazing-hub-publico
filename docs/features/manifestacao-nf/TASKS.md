# Execução — Manifestação de notas

## 04/11/2026

Base pública `0947ed344975dd39e3c15c2421b29d642362b176`.
Branch `codex/manifestacao-nf-datas-20261104`. Cópia pública limpa reutilizada;
alterações alheias da pasta principal foram preservadas. Sem novas dependências.
Contrato: [SPEC](SPEC.md).

- [x] Banco e domínio: migration aditiva, datas civis e validação compartilhada.
- [x] Backend: vencimento NFS-e, devolução, ignorar, reabrir e recebimento obrigatório.
- [x] Interface: padrão existente, filtros próprios e confirmação explícita.
- [x] Integrações sintéticas: 31 testes PostgreSQL aprovados em três arquivos.
- [x] Concluir a validação da revisão e registrar os resultados da regressão.
- [x] Matriz visual: 36 testes aprovados; 120 capturas/auditorias sem problemas.
  Após adotar os botões oficiais, os 12 contextos afetados passaram novamente,
  com 24 auditorias sem problemas e capturas inspecionadas.
- [x] Sincronizar a branch e integrar a [PR #10](https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/pull/10).
- [x] Verificar backup, plano, CI e publicação autorizada.
- [x] Conferir estabilidade, HTTPS e interface autenticada sem gravar notas.
- [x] Registrar evidência após a publicação e fechar as abas de verificação.

Validação inicial: 40 testes NFS-e, 100 de servidor NF-e e 30 de interface passaram.
Prisma validate/generate e typecheck passaram. As primeiras tentativas de processos
e conexão local tiveram bloqueios da sandbox. O ambiente autorizado usa apenas
PostgreSQL local e schemas efêmeros. Não houve testes de gravação em dados reais.

A primeira integração não executou os cenários porque faltava a view sintética do
Atendimento. Os três arquivos reutilizam `testes/vendas/dependencia-atendimento.ts`;
as migrations históricas permanecem intactas. A reexecução aprovou os 31 cenários,
incluindo data sem backfill, concorrência, revisão, rollback, evento fiscal
preservado e retomada sem reenvio. Competência e vencimentos conhecidos foram
conferidos. O fallback legado de competência ausente não foi alterado.

As capturas iniciais encontraram overflow na chave fiscal e no nome do fornecedor,
além do corte à esquerda dos botões de outras operações. Os consumidores foram
corrigidos com quebra de texto e GrupoAcoes responsivo. As asserções foram mantidas
e ampliadas para os limites dos botões. Erros de data são limpos ao editar o campo.
Referências visuais permanecem Em revisão; capturas consultivas não são aprovação.

O lint identificou quatro exceções antigas no diálogo de NF-e. Os controles
foram corrigidos: nome acessível direto no botão Fechar e variantes oficiais
entrada/saída nos botões de aceite/recusa. Somente as quatro entradas resolvidas
foram retiradas do baseline estático; nenhuma exceção ou aprovação foi criada.
Qualidade visual: 435 arquivos, 88 desvios históricos e zero desvios novos.

Backup privado criado antes da publicação, com índice e leitura integral aprovados.
A imagem e a configuração anteriores foram preservadas. O destino e os comprovantes
operacionais permanecem privados.

## 05/11/2026

A revisão funcional `bd5e5cf` passou em 636 testes de NF-e, NFS-e e permissões.
Outros 46 ficaram de fora dessa seleção. A regressão geral original teve 6.753
aprovações, 20 falhas e 1.074 testes ignorados. Os alvos das falhas passaram
com as mesmas asserções nas reexecuções de Permissões e de Vendas. A seleção
de Vendas aprovou 81 testes.

Validades entrou em produção pela PR #11 antes da publicação fiscal. A revisão
sincronizada `56b1e69` passou em 941 testes locais de NF-e, NFS-e, permissões
e Validades. Outros 97 ficaram de fora dessa seleção. O CI passou nas três
verificações. [CI da revisão integrada](https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/actions/runs/42034021498)

O backup da versão em execução passou na leitura integral. O novo plano
identificou só `20261104120000_manifestacao_datas_tratamento`. O executor
aplicou a migration pelo canal seguro antes do deploy, conforme o
[procedimento fiscal](../fiscal-brasilnfe-m1/OPERACAO-20261014.md).
A releitura confirmou o mesmo destino e zero pendências.

Produção recebeu `f89cdec37aecc1588dc9d6e8544fbbe0837d63f1`, com o mesmo conteúdo
da revisão sincronizada. A nova tarefa ficou estável por 129 segundos, sem
reinícios. Prisma confirmou o histórico atualizado. A configuração fiscal
foi conferida. Os comprovantes operacionais ficam no backup privado.

O login respondeu por HTTPS. As rotas de NF-e, NFS-e e Validades exigiram
sessão. Na interface autenticada, foram conferidos os filtros da NF-e, as
etapas de devolução e de ignorar, e o vencimento no aceite de NFS-e.
O fluxo de recebimento em uso e consumo foi validado em ambiente isolado.
A conferência em produção terminou sem gravar notas ou enviar eventos fiscais.
