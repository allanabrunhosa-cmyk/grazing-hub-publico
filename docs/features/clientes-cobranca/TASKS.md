# Execução — Clientes e cobrança

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Base: `4bc3cb79`, branch `codex/clientes-cobranca-20261017`. Trabalho isolado; alterações anteriores da raiz preservadas. Disco medido em 13,5 GB livres; dependências existentes compartilhadas por junction, sem instalação.

- [x] Mapear consumidores e definir contrato aditivo no JSON. Sem alteração de schema.
- [x] Implementar domínio, validação e compatibilidade.
- [x] Ajustar Clientes, Pedidos e destinatário fiscal.
- [x] Regredir UI, domínio, permissões e integração em PostgreSQL local.
- [x] Executar lint, lint:design, typecheck e build final.
- [x] Capturar e inspecionar prévias isoladas.
- [x] Atualizar documentação dos contratos de Vendas e Fiscal.
- [ ] Publicar código autorizado e conferir serviço, migrations e smoke.

Próximo passo: concluir regressão ampliada, integrar main atual, executar build e publicar. Validação inicial do runner ficou impedida por EPERM no cache temporário do sandbox; repetir em temporário próprio/execução autorizada. Nenhum teste aprovado por inferência.


## Evidências de desenvolvimento

- Integração opt-in: `PEDIDOS_BANCO_TESTE=1`, `PEDIDOS_AMBIENTE_ISOLADO=1`, PostgreSQL descartável em `127.0.0.1:55468`, banco `teste_clientes_cobranca`. `pedidos-integracao.test.ts` e `clientes-regras-pagamento-integracao.test.ts`: 84 aprovados, zero falhas/skips. Schemas temporários removidos pelos próprios testes. Cobertura inclui titular de terceiro, lista/seleção no snapshot, reabertura, auditoria/versão existentes e edição postal por cliente antigo sem perda de identidade.
- Primeira regressão focada: 324 aprovados e duas falhas no detalhe. Causa corrigida: campos fiscais de formato legado não bloqueiam edição postal; listas auxiliares não são reenviadas. Reexecução de `pedido-detalhe-interface.test.tsx`: 26 aprovados, zero falhas.
- Lint de arquivos alterados e `lint:design` executados. Design: zero desvios novos. Typecheck sem erros após `next typegen`; repetir sobre fonte final integrada antes de publicar.
- Prévia de Clientes: 320, 390, 768 e 1440 px, claro/escuro. Prévia de Pedidos: 390, 768 e 1440 px, claro/escuro. 14 cenários sem erros de página e sem diagnósticos no auditor automático. Capturas inspecionadas de desktop, celular claro/escuro, CNPJ e cópia da cobrança 2. Artefatos privados em `.tmp/clientes-cobranca/`; ações e dados fictícios. Referência permanece Em revisão. Não houve aprovação de baseline nem consulta fiscal real.
- Dependências existentes reutilizadas de `.tmp/clientes-correcao-runtime/node_modules`. Node 22.23.2 disponível no runtime local de Validades. Nenhuma instalação. Banco e servidores desta tarefa serão encerrados no fechamento; a worktree será preservada.


## Candidata integrada e publicação preparada

Código funcional `f89e7ba9`, integrado com a main em `e1191b4f` (base recebida `48bff635`). Sem conflitos funcionais. O contrato de ações inclui as duas consultas de CNPJ e a ação fiscal recebida da main.

- Regressão ampliada em Vendas/Tributação/Fiscal de saída: 3.212 aprovados, 454 ignorados por opt-in, cinco ocorrências. Duas eram expectativas do detalhe já corrigidas. Uma era rótulo antigo Endereço 1 no consumidor geral, corrigido para Principal/Nome Completo. Uma decorreu do módulo em cache antes da inclusão do helper de cópia. A ocorrência de Estrutura Fiscal não apresentou diagnóstico detalhado no JSON. Revalidação de todos os arquivos afetados: 96 aprovados; detalhe: 26 aprovados. Estrutura Fiscal passou sem alterar seu teste, asserções ou timeout. Não contar os opt-ins ignorados como aprovados.
- Após integração: permissões/fronteiras, consultas de CNPJ e contratos BI recebidos da main, 323 aprovados. Opt-in PostgreSQL específico: 84 aprovados, sem ignorados.
- ESLint dos arquivos da feature: zero erros/avisos. `npm run lint:design`: 414 arquivos, 92 desvios históricos, zero novos.
- `tsc --noEmit` sobre a candidata integrada: aprovado. `npm run build` com Node 22.23.2: aprovado; compilação, TypeScript e 105 páginas concluídos. Avisos de middleware obsoleto e APIs Edge em Next/jose registrados no log; sem erro de build.
- Capturas repetidas sobre a fonte integrada: 14 cenários, claro/escuro. Zero erros de página e zero diagnósticos do auditor. Cópia da cobrança 2 comprovada nos seis cenários de Pedidos. Evidência consultiva, Em revisão.
- Smoke do build local: login 200; Clientes, Pedidos, Novo Pedido, Gestor e grupos fiscais canônicos redirecionam para login sem sessão. O alias `/vendas/fiscal` conserva o redirecionamento para `/financeiro/fiscal/grupos`.
- Backup produtivo privado: `<BACKUP_PRIVADO>`. Dump validado por `pg_restore --list`, 1.116 entradas. Imagem/configuração fiscal anterior preservadas; certificado no banco. Sem migration nova nesta feature.
- Disco C após build: 10,9 GB livres. Nenhuma cópia removida ou dependência reinstalada.

Próximo passo: push fast-forward autorizado para main, acompanhar Dokploy e conferir serviço estável, migrations, HTTPS e leitura autenticada. Nenhuma emissão fiscal real faz parte do smoke.

## Correção da Principal — 19/10/2026

Base `6a1ffb2f`; branch `codex/clientes-principal-vinculado-20261019`. Cópia anterior limpa reutilizada, sem instalar dependências. C: tinha 31,2 GB decimais livres no início. Alterações alheias da raiz preservadas.

- [x] Vincular identidade da Principal às Informações gerais. Botão fixado, tipo desabilitado e campos de identidade somente leitura. Endereço postal editável; cobranças adicionais independentes.
- [x] Reutilizar CadastroClientePedido, IdentidadeCobrancaForm, Campo/Input/SelecaoFormulario, Button outline/icon-sm e tokens de bloqueio. Mesmos consumidores Clientes/Novo Pedido. Sem variante nova.
- [x] Aplicar vínculo no servidor: cadastro, novo pedido, orçamento, confirmação e cobrança avulsa moderna. Preservar identidade histórica ao editar endereço da Principal confirmada e impedir sua remoção.
- [x] Recuperar documento legado guardado somente no JSON; preservar colunas legadas PF e a igualdade de nomes após formatação de cadastro novo. Limpeza explícita de CPF não restaura o documento anterior.
- [x] Testes de integração isolados: 94 casos únicos, sem skips. A primeira rodada teve falha real de inscrição legada PF; corrigida, com reexecução do arquivo: 10 aprovados. PostgreSQL local encerrado, sem schemas temporários restantes.
- [x] Regressões específicas de interface: 11 Clientes; 19 da listagem/cadastro (um caso reexecutado isoladamente após oscilação de tempo). Novo caso de Pedido cobre Principal de rascunho divergente do cadastro. Testes próprios de servidor: 10 aprovados.
- [x] Visual isolado: 14 cenários Clientes/Pedidos, 320/390/768/1440 conforme consumidor, claro/escuro; 98 capturas, auditorias sem problemas e zero erros de página. CPF/PJ, consulta CNPJ fictícia, Pin/tipo fixados, endereço editável, terceiros e teclado conferidos. Referências Em revisão. Servidores encerrados.
- [x] Backup produtivo privado preparado e íntegro: `<BACKUP_PRIVADO>`; dump de 121.846.252 bytes, 1.101 entradas em pg_restore --list. Configuração/imagem anterior preservadas. Sem migration nesta correção.
- [x] Lint final sem erros. lint:design: zero desvios novos (415 arquivos, 92 históricos). Typecheck aprovado. Build final Node 22 aprovado, compilação, TypeScript e páginas concluídos. Aviso existente de middleware obsoleto; sem erro de build.
- [x] Smoke local do build: login 200; Clientes, Novo Pedido e grupos fiscais 307 para login sem sessão, com Host preservado conforme contrato. Requisições localhost sem Host público retornam 421 por desenho. Servidor local encerrado.
- [x] Revalidação final focada: 48 testes de domínio, servidor e detalhe aprovados. Reexecução com timeout de 15 s na chamada por carga concorrente; sem alterar configuração, asserções ou limite padrão do projeto.
- [x] Fechada revalidação das ocorrências da bateria ampliada: 3.239 aprovados, 454 ignorados por opt-in e quatro ocorrências. A rodada começou antes da última correção de limpeza de CPF; o caso passou na revalidação final de 48 testes. Teste de CPF do editor ajustado ao escopo das Informações gerais, sem mudar asserções de dígitos/e-mail. Pedidos: 28 aprovados; Gestor: 58 aprovados na reexecução padrão. Estrutura Fiscal: 13 aprovados. Os três arquivos passaram juntos: 99 testes, timeout padrão. Os dois STACK_TRACE_ERROR genéricos não reapareceram, sem mudar fontes, asserções ou limites. Os 454 opt-ins ignorados na bateria ampla não contam como aprovados; as integrações aplicáveis foram executadas separadamente.
- [ ] Publicar a versão validada e conferir serviço, migrations, HTTPS e interface na sessão existente.

Logs e capturas locais ignorados: `.tmp/principal-vinculado`. Nenhum cadastro real foi alterado para testar.
