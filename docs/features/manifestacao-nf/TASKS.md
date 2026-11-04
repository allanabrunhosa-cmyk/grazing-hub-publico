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
- [ ] Concluir regressão e verificações finais da revisão.
- [x] Matriz visual: 36 testes aprovados; 120 capturas/auditorias sem problemas.
  Após adotar os botões oficiais, os 12 contextos afetados passaram novamente,
  com 24 auditorias sem problemas e capturas inspecionadas.
- [ ] Sincronizar branch e abrir PR.
- [ ] Backup, migrations, CI e deploy autorizado.
- [ ] Conferir estabilidade, HTTPS e UI autenticada sem operações reais.
- [ ] Registrar evidência pós-deploy e encerrar recursos próprios.

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

Próximo passo: concluir a bateria final, revisar o diff e publicar
somente após backup íntegro e conferência do plano de migrations do destino.
