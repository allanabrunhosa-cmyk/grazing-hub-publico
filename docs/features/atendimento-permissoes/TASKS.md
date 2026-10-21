# Execução — permissões por operação

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Reorganização em três níveis — 21/10/2026

- [x] Mapear o escopo atual do Atendimento no repositório próprio.
- [x] Definir 24 recursos, 57 capacidades e 11 seções.
- [x] Organizar a matriz em módulo, seção e recurso, com ações aplicáveis.
- [x] Separar contatos, novas conversas, alertas, atalhos, templates e atividades.
- [x] Manter a compatibilidade antes do marcador e a autorização exata depois dele.
- [x] Concluir prova PostgreSQL da migração e das operações.
- [x] Concluir verificações finais dos dois repositórios.
- [ ] Publicar Atendimento compatível, migration central e matriz do HUB.
- [ ] Conferir equivalência de acessos, sessões, demais módulos e estado operacional.
- [ ] Registrar revisões e resultados reais da publicação.

Prévia isolada da matriz: 24 contratos Playwright aprovados, nos temas claro
e escuro e larguras 320, 390, 768 e 1440. Auditoria da interface sem diagnósticos.
As capturas são consultivas. Não houve atualização ou aprovação de baseline.

Prova PostgreSQL exclusiva concluída: seis cenários, 31 identidades fictícias,
57 capacidades e 5.301 comparações. Foram verificados os hashes agregados dos
acessos, sessões, identidades, demais módulos e autoridade da view. As 66
verificações das operações também passaram, com três chamadas Meta simuladas
e nenhum envio externo. O banco fictício foi encerrado e preservado.
A revisão independente identificou uma reabertura sem Editar pelo endpoint do
contato. O ramo e o replay foram corrigidos. Uma nova prova exclusiva passou
em 75 verificações, sem envios externos e sem duplicar comando ou auditoria.

Atendimento: tipos, lint, verificação dos consumidores visuais e build Node 22
aprovados. A bateria passou em 1.743 testes distintos, com um opt-in ignorado.
A primeira execução teve oito falhas de interface. Após corrigir uma fixture
sem a nova permissão de atalhos e liberar memória, os quatro arquivos afetados
passaram em execução serial (121 testes). Não houve aumento de timeout.

O plano de publicação produtivo contém somente a migration desta tarefa.
O backup privado foi conferido por hash e por 1.138 entradas legíveis.
SQL candidata: `edb164dcf7164943a721c8216ca112051b93b60b5b3f124ebc3f71c6d6fc3378`.

HUB: tipos e build webpack Node 22 aprovados, com 106 páginas geradas.
Os 22 testes finais de interface e os 24 contratos visuais passaram após carregar
os recursos somente ao expandir a seção. As 60 verificações das referências
existentes passaram. Lint e lint de design não apontaram novos desvios.
A suite de permissões/design mantém uma falha anterior: duas ações fiscais de
`emissao-actions.ts` não constam em `contrato-acoes.json`. Ambos os arquivos
permanecem idênticos à base `c278a92f`. Os 13 timeouts da primeira execução
foram revalidados nos quatro arquivos de interface, sem aumentar o limite.

Atendimento compatível publicado em `8bb15d93f15ecf509d636887a0616e1642122a3d`.
A primeira tentativa de aplicar parou antes da troca por uma trava do backup
automático. A mesma candidata foi retomada após o backup terminar.
Saúde aprovada; contêiner, imagem, configuração e Compose preservados.
Envios humanos seguem habilitados na autoridade VPS. A IA permanece desligada,
com configuração versão 8. Login e proteção sem sessão foram conferidos por HTTPS.

Migration central aplicada às 16:19:32 UTC de 21/10. O marcador é único.
Os hashes de capacidades efetivas, sessões, identidades, demais módulos e
autoridade da view permaneceram iguais. Nenhum perfil real foi usado para testes.

## Execução anterior

O registro abaixo descreve a execução anterior de 13/10.

- [x] Mapear operações reais e limites: repositório, handler, agente e telas dedicadas.
- [x] Definir contrato comum de recursos/capabilities e compatibilidade de rollout.
- [x] Migration central: materialização, sessão, auditoria e flag na view privada.
- [ ] Backend: guardas de leitura/escrita, classificação de upsert e atores técnicos.
- [x] HUB: catálogo e grupo derivado da matriz sem alterar navegação.
- [x] Dedicado: parser, consultas condicionais, controles granulares e habilidades.
- [x] Integrar a atualização visual paralela da tarefa dona antes da publicação completa.
- [ ] Testes locais: negativas, rollback, idempotência, concorrência e equivalência legada.
- [ ] Lint/design, tipos, build, referências e capturas isoladas.
- [ ] Backup, publicação coordenada, migration/status e smoke HTTPS/protegido.
- [ ] Registrar revisões, hashes, estabilidade e limitações reais.

HUB: 18 recursos e 38 capacidades. Grupo Atendimento separado na apresentação;
rota e navegação conservam `crm` em Vendas. Testes focados: 24 aprovados. Integração
de perfis/exceções e anti-elevação: 24 aprovados. Lint focado e lint:design aprovados,
sem mudança de baseline. Capturas finais: 32 em 320/390/768/1440, claro/escuro,
com auditoria sem diagnósticos. Inspeção manual cobriu os dois temas e as larguras.
Referências visuais oficiais: 60 cenários aprovados; nenhuma referência humana foi
promovida. Essas capturas são consultivas, não aprovação de pixels por responsável.

Backups privados verificados antes da publicação: central em
`<BACKUP_PRIVADO>`, dump com
1047 entradas legíveis; certificado permanece no banco. Atendimento em
`<BACKUP_PRIVADO>`, release e
configuração conferidas. Manifesto anterior após visual paralelo:
`04644a4a8929ab878808a424bff1d78af04aef0ba0aa96f873fdfa2e6031e249`.

Migração: 3 testes SQL opt-in aprovados, com 27 fixtures e 38 capacidades por fixture.
Cobertura de exceções, []/false, sessão, auditoria técnica, grants/security barrier,
readiness e idempotência. Cadeia de 127 migrations aplicada em base local nova exclusiva;
marcador único e projeção real SISTEMA confirmados. Base de ensaio removida ao concluir.

UI dedicada: 102 testes aprovados. Após ajuste de truncamento do cabeçalho móvel,
3 regressões focadas aprovadas. Lint/design/tipos aprovados. Capturas finais de Skills,
chat, autoria IA, ícones e confirmação nos dois temas e quatro larguras; auditoria sem
diagnósticos, Escape e retorno de foco aprovados. Visual paralelo de `83b9abd5` integrado.
Compilação dedicada Node 22 aprovada, 7 arquivos web verificados e snapshot de 213
fontes imutável. Runtime candidato:
`9ceba99269133e18a27bd6fc2e52d56be2187bfa5afc1165aeb0166949dac694`.

Bateria geral HUB: 356 arquivos aprovados, 46 ignorados por opt-in/escopo e 1 com
dois timeouts de 5s em `estrutura-fiscal-interface.test.tsx`: 3600 testes aprovados,
727 ignorados e 2 timeouts. O arquivo fiscal permanece sem alteração. São os mesmos
casos registrados na revisão anterior. Diagnóstico isolado com limite de 15s por caso:
9/9 aprovados. Nenhum teste, asserção ou timeout global foi alterado para essa execução.

Em andamento: concluir validação de backend e compilação/tipos HUB, depois publicar.
