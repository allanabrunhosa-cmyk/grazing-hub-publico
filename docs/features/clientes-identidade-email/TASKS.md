# Execução — Identidade de clientes por e-mail

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Base 6ed6a18e; branch codex/clientes-identidade-email-20261019. Cópia limpa anterior reutilizada. Alterações alheias da raiz preservadas. C:31,0GB livres; dependências existentes, sem instalação.

- [x] Diagnosticar duplicidades em produção somente por contagens agregadas.
- [x] Reproduzir CNPJ mascarado truncado e aviso obsoleto; corrigir formulário e retorno parcial. CNPJ:41 testes, lint e lint:design aprovados. Visual:20 cenários/48 capturas, sem problemas/erros, dados fictícios.
- [x] Implementar normalização e guarda no servidor. Testes iniciais:20 aprovados, incluindo ausência legada, conflito cruzado e reservas de aliases.
- [x] Concluir migration/auditoria/concorrência em PostgreSQL isolado: 17 testes sem skips. Guarda de crédito mesmo com saldo zero, rollback integral, reservas de aliases e RR40001 verificados. SQL SHA256 038d0e15dcd5e3a3ee0d87abce6167d7a3dc3aae7894671b6b40666f2d4be754.
- [x] Concluir busca por e-mail e consumidores de aliases. Interface: 65 testes; histórico/iFood/MCP: 53 testes, incluindo 15 PG. Integrações Vendas/Pedidos/financeiro/regras: 139 testes aprovados após adequar fixtures de e-mails antes repetidos e ativar guarda explícita de ambiente isolado. Nova gravação concorrente pelo serviço preserva titular e auditoria.
- [x] Concluir regressão, lint, tipos, build e evidências visuais finais. Bateria completa: 537 arquivos, 5.835 testes aprovados e 976 opt-ins ignorados; 22 falhas em seis arquivos, tratadas abaixo. Os opt-ins afetados foram executados separadamente: 171 testes PostgreSQL aprovados (139 comerciais/financeiros, 15 histórico e 17 SQL).
- [x] Preparar backup íntegro e plano produtivo exato, somente leitura. Backup <BACKUP_PRIVADO> 121.847.128 bytes, 1.116 linhas em pg_restore --list. Nove grupos/167 raízes/229 registros com aliases; 206 pedidos históricos a religar, zero operacionais a mover. Todas as guardas retornaram zero; mapa SHA256 0f1203b7005893bfe22c52ac2b7e92a7cc70d7414963ff489c3f3382a437fd32. Plano oficial: 7da0772c12ded5f93ab9d2616dae19e352d5211d823d5862e4e229f191d638d1; destinoHash 33f34521d3e38b05752a5ef7adb6e2889e312fe5b741f20ef01bdb18d493ce14. Aplicação ainda pendente.
- [ ] Publicar e conferir serviço estável, HTTPS e interface na sessão existente.

Artefatos privados em .tmp/clientes-email e .tmp/cnpj-preenchimento. Nenhum dado real foi usado como massa de teste. A operação produtiva de consolidação ainda não foi executada.

UI final: 12 cenários/20 capturas em .tmp/clientes-identidade-email-20261019, 320/390/768/1440 px, claro/escuro, teclado, foco, erro e campos protegidos; zero problemas do auditor e zero pageerrors. A verificação no navegador encontrou e corrigiu perda da primeira colagem por monitoramento de eventos na fase de captura. Prévias encerradas. Referências Em revisão, sem aprovação humana de baseline.

Retestes finais: consulta/sincronização/pagamento comercial 37/37; regras de pagamento 22/22; interface geral 33/33; consumidores de busca 70/70; consulta do editor 2/2; consultas/popup/gestor 63/63. As falhas de criação sem e-mail foram resolvidas nas fixtures, mantendo o contrato obrigatório e a edição legada. A bateria longa carregou uma versão do módulo anterior à exportação do helper de aliases; nova execução dos consumidores e PG histórico sobre a fonte estável passou.

Estrutura fiscal não sofreu alteração. Arquivo completo no limite padrão: 12/13 aprovados; caso 187 excedeu 5 s também isolado. A ação é mockada e o catálogo é local, sem espera de servidor. Diagnóstico autorizado apenas nesse caso, com CLI --testTimeout=10000: todas as asserções passaram em 5.375 ms. Nenhuma fonte, teste, asserção ou timeout global foi alterado nessa área. Os dois timeouts iniciais ficaram esclarecidos (caso 165 passou no limite padrão).

Lint global e dos complementos aprovado; lint:design com zero novos/92 históricos. Typecheck completo e build final Node22/webpack aprovados, 105 páginas. Smoke final: login200; Clientes/Pedidos/Novo redirecionam307 ao login sem sessão. Advertências históricas de Middleware/BaseUI permanecem fora do escopo. PostgreSQL55468 e prévias4311/4293/4294 encerrados; bancos, arquivos e dependências preservados.

A busca inclui e-mails e documentos primários dos aliases, sem substituir os campos gerais nem enviar metadados de busca na gravação. Filtros do Gestor/Histórico mostram somente raízes. A projeção de Pedidos exclui a relação e os endereços brutos dos aliases.
