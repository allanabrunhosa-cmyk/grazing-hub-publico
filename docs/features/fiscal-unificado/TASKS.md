# Execução

- [x] Conferir main pública e preservar checkout de outro trabalho.
- [x] Identificar separação entre JSON comercial e versões usadas na emissão.
- [x] Implementar seleção compartilhada de regras e grupos cadastrados opcionais.
- [x] Integrar a ficha canônica à aba Fiscal e à entrada Fiscal → Vínculos.
- [x] Salvar rascunho, revisar impacto e aplicar na mesma tela, com autorização transacional.
- [x] Agregar configurações existentes sem duplicar credenciais ou contadores.
- [x] Investigar por leitura a origem das linhas da cesta no pedido indicado; preservar política documentada e snapshots. Evidência real fica somente no ambiente privado.
- [x] Concluir funções complementares e histórico legado acessível.
- [x] Concluir simulação, prova de preservação e roteiro de backup/reversão.
- [x] Executar integrações SQL com a fixture completa das migrations atuais.
- [x] Executar regressões, permissões, lint, design, tipos, build e smoke, com os resultados abaixo.
- [x] Fazer revisão visual consolidada em desktop/celular, com capturas sintéticas.
- [x] Preparar branch própria e descrição da PR, sem merge nem deploy.

Não houve emissão, cancelamento ou escrita em dados reais nesta tarefa.
Envio da branch e abertura da PR não representam publicação em produção ou homologação externa.

## Validação executada

Node 22.23.3. PostgreSQL 17 isolado, com provedores fiscais sintéticos. Nenhum teste
transmitiu nota ou acessou certificado real. Logs extensos permanecem no diretório
privado `.tmp/fiscal-unificado`, fora do Git.

| Verificação | Resultado e limite |
| --- | --- |
| Regressão geral | 6.672 testes passaram; 1.056 foram ignorados por seus contratos optativos. Uma suíte não carregou por mock antigo de `server-only`; foi corrigida e seus cinco testes passaram na revalidação. A execução geral original terminou com erro e não é apresentada como aprovação integral. |
| Integrações SQL pertinentes | 101 testes passaram: estrutura 17, aplicabilidade NCM 33, referência interna 6 e saída fiscal 45. Cobrem montagem 55/65, herança, exceção, vigência, auditoria, concorrência, reversão prospectiva e preservação integral de documento incerto. Esses testes incluem casos ignorados na regressão geral; as contagens não devem ser somadas. |
| Adaptador Brasil NFe | 52 testes passaram. A integração SQL detectou acesso obrigatório indevido ao destinatário de NFC-e anônima. A correção mantém a identificação obrigatória nos contextos existentes de NF-e e entrega. Os 45 testes SQL de saída foram repetidos e passaram após a correção. |
| Ficha e composição da central | 12 testes passaram na revalidação final: sete de interface canônica e cinco de permissões da central. |
| Kit e interface da estrutura | 20 testes passaram, incluindo campos condicionais e manutenção independente do formulário comercial. |
| Seletores NCM | Sete testes passaram. |
| Lint | Verificação global e revalidação dos arquivos finais passaram, sem erros. |
| Lint de design | Passou: 432 arquivos, 92 desvios históricos e zero novos. Nenhum baseline foi promovido. |
| Proteções do Design System | 146 testes passaram; sete permaneceram ignorados conforme o contrato existente. Registro de referências passou, sem referências promovidas. |
| Typecheck e build | Passaram na versão final, com banco isolado e credencial de sessão fictícia. |
| Smoke da compilação | Nove verificações passaram: login, proteção das rotas fiscais, redirecionamento antigo e proteção do catálogo. Conexão apenas no loopback; redirecionamentos externos não foram seguidos. Não substitui teste autenticado em produção. |
| Referências oficiais da Central | 60 testes de captura passaram. O registro continua sem referências aprovadas; não houve comparação com baseline aprovado nem promoção automática. |
| Interface navegável | 48 testes Playwright passaram: 320, 390, 768 e 1.440 px, claro/escuro. Incluem rascunho, revisão, aplicação, kits, nomes acessíveis, foco, teclado, ausência de overflow e bloqueio de rede externa. |

Os demais testes optativos que exigem serviços ou bancos específicos não foram
habilitados nesta tarefa. Os registros da proteção visual oficial passaram. A revisão humana do visual
continua pendente.

## Revisão visual consolidada

As [capturas de desktop e celular](evidencias/README.md) usam os componentes reais
com dados sintéticos. A inspeção conferiu produto, grupo, configuração, certificado,
numeração, kit e aplicação na mesma tela. Os ajustes finais corrigiram o foco após
carregamento da ficha, os rótulos fiscais efetivos e o enquadramento das capturas.
Referências permanecem **Em revisão**. A auditoria DOM é parcial e não certifica WCAG.

Prévia local: `http://127.0.0.1:4269/fiscal-unificado.html?rota=/financeiro/fiscal/vinculos`.
Para iniciar novamente, usar Node 22:

```powershell
node node_modules/vite/bin/vite.js --config testes/visual/fiscal-unificado.vite.config.mts
```

## Conciliação e liberação operacional

- A simulação privada foi executada por leitura. As diferenças de grupo técnico,
  vínculo cadastral e valores foram preservadas. Diferença não significa erro
  tributário. Nenhum conflito recebeu escolha automática.
- A investigação do pedido indicado encontrou as frutas na política documentada
  do kit e na fotografia fiscal anterior. Não houve troca de CSOSN ou remoção de
  linha para contornar validação. A prova com dados reais fica somente no ambiente privado.
- O ensaio SQL comparou hashes de documentos e realizou reversão por nova versão.
  Backup integral e restauração do banco real não foram executados. São requisitos
  anteriores à conciliação operacional, conforme o [roteiro](README.md#conciliação-e-reversão).
- CRT 1, séries 6/7, contadores, credenciais e estado operacional não foram alterados.
- A PR deve ser integrada somente após a revisão consolidada. Nenhum merge na main
  ou deploy em produção faz parte desta entrega.
