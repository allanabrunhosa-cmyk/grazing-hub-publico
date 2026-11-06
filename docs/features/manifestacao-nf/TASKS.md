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

## 06/11/2026 — Destino financeiro da NFS-e

O aceite permite escolher **Gerar despesa** ou **Somente registro fiscal**.
Uma nota aceita sem vínculo financeiro permite corrigir o destino. O servidor
e o banco impedem lançamento quando a nota está marcada como somente fiscal.

Prisma validate/generate, tipos, lint de código e design passaram. A validação
incluiu 49 testes de servidor e rotas, 17 de interface, 10 integrações com
PostgreSQL sintético e 24 cenários Playwright. As 72 auditorias da prévia
terminaram sem apontamentos. As referências continuam Em revisão.

A rodada de regressão registrou 990 aprovações, quatro falhas de tempo e 150
testes ignorados. Os quatro arquivos reexecutados em isolamento passaram nos
43 testes, incluindo os alvos das falhas e o consumidor de NFS-e. As três
verificações da revisão passaram. [CI da PR #13](https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/actions/runs/42269848279)

O backup passou na leitura integral. O plano produtivo confirmou só
`20261106120000_nfse_destino_financeiro`. O executor aplicou a atualização
antes do deploy. A releitura e o Prisma confirmaram zero pendências.

Produção recebeu `edd37595929323ed7b2437607ecf93dc8fa06a39` e permaneceu estável
por pelo menos 131 segundos, sem reinícios. HTTPS e bloqueio sem sessão foram
conferidos no Manifesto de NFS e no Fluxo de Caixa. A conferência autenticada
mostrou as duas opções e o vencimento apenas na opção financeira. O diálogo
foi fechado sem salvar uma nota real. O PostgreSQL sintético e a prévia foram
encerrados. Cópia de trabalho e evidências foram preservadas.
[PR #13](https://github.com/allanabrunhosa-cmyk/grazing-hub-publico/pull/13)
