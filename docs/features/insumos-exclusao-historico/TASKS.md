# Execução

- [x] Definir exclusão lógica, revisão do popup e preservação de fotografias históricas.
- [x] Implementar banco, domínio, autorização e concorrência.
- [x] Conferir prioridade de fornecedor/marca e interface da contagem.
- [x] Integrar guardas de catálogo e continuidade dos pedidos existentes.
- [x] Validar migration e exclusão em PostgreSQL isolado com fixtures.
- [x] Executar regressões afetadas, lint, design, tipos e build.
- [x] Conferir imagens isoladas e atualizar os mapas dos domínios.
- [ ] Publicar e conferir estabilidade, migrations e UI sem exclusão real.

Base: `f2603b00`, checkout `codex/insumos-exclusao-historico-20261006`.
`vitest run` de exclusão PostgreSQL e consumidores: 6 arquivos/46 testes aprovados,
incluindo 7 integrações opt-in realmente executadas. Banco `insumos_exclusao_teste`,
schema temporário e contêiner descartável; nenhum dado operacional utilizado.
Comprovação: remoção relacional/JSON, precisão de nove casas na auditoria, repetição,
permissão revogada, composição concorrente, prevenção de reativação e preservação de
compra, perda, movimento, contagem e fotografia de venda, com reserva/consumo após excluir.
Prévia do popup e contagem conferidas com dados fictícios; referência **Em revisão**.
Imagens privadas em `.cache/insumos-exclusao-20261006/` (não versionadas).

Validação final:

- PostgreSQL em Docker descartável na VPS: `exclusao-integracao.test.ts` e
  `pedidos-integracao.test.ts`, **68/68 aprovados** (8 de exclusão + 60 de pedidos),
  com os limites originais de tempo. Fotografias executadas pelos caminhos manual e
  automático, rollback integral simulado e preparação antiga impedida de reinserir ingrediente.
- O ensaio inicial de pedidos pelo túnel produziu timeouts de 5s e falhas em cascata;
  reexecutado próximo ao PostgreSQL descartável, sem alterar implementação nem limites.
- Regressão global: 257 arquivos/2183 testes aprovados e 30 arquivos/417 testes opt-in
  ignorados; um timeout no parser de PDF sob carga. O arquivo foi repetido isoladamente:
  **5/5 aprovados**, inclusive o parser em 309ms, sem ampliar timeout.
- Insumos/consumidores finais: 26 arquivos/229 testes aprovados, 5 arquivos/41 opt-ins
  ignorados; as duas falhas de fixtures da exclusão foram corrigidas e cobertas pelos
  68 testes Docker acima. Últimos consumidores das guardas/posição histórica: 4 arquivos,
  **34/34 aprovados**.
- Prisma validate/generate, lint dos arquivos alterados/novos, lint:design, tsc e build
  webpack aprovados. Build final sem conexão operacional (24,7s de compilação).
- Backup privado `etiquetas-insumos-exclusao-20261006-a`: leitura integral `pg_restore`
  sem conexão a banco, 59.515.815 bytes e SHA-256 registrado na VPS. Imagem anterior e
  configuração fiscal preservadas; certificado tem fonte no banco.

Etapa corrente: publicação autorizada. Próximo passo: push fast-forward, acompanhar
nova tarefa estável por 90s, conferir migrations e UI autenticada sem exclusão real.
