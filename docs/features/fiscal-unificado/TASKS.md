# Execução — simplificação de 22/10/2026

- [x] Restaurar cartões, tabela e formulário de campos das telas anteriores.
- [x] Grupos sem NCM, GTIN ou unidade; apenas impostos e campos condicionais necessários.
- [x] Salvar aplica no motor na mesma transação. Versões e auditoria ficam nos bastidores.
- [x] Preservar exceções, contextos, séries 6/7, CRT 1, documentos e tentativas.
- [x] Configurações em quatro blocos, com credenciais mascaradas e diagnóstico recolhido.
- [x] Verificar por leitura a fonte do certificado e criar backup privado antes da publicação.
- [x] Preparar a atualização da PR existente para a publicação solicitada.

## Verificações

Node 22.23.3 e PostgreSQL 17 local isolado. Nenhuma nota real foi emitida ou cancelada.

| Verificação | Resultado |
| --- | --- |
| SQL | 101 cenários pertinentes passaram cumulativamente: estrutura 17, NCM 33, referência interna 6 e saída fiscal 45. O caso de salvamento direto foi ampliado e revalidado após corrigir a fixture de endereço/tabela e o campo opcional de ST. |
| Salvamento e vínculos | 26 testes passaram na revalidação: oito do formulário simples e 18 da tabela anterior. |
| Permissões e domínio | Execução focada inicial: 471 passaram e 26 optativos foram ignorados; houve uma falha de teste de seletor, corrigida e revalidada. Não se apresenta essa execução original como aprovação integral. |
| Demais consumidores | 68 passaram; a suíte de vínculos que não carregava foi isolada dos serviços do servidor e seus 18 testes passaram depois. Contagens se sobrepõem e não devem ser somadas. |
| Lint e design | Passaram. Design: 433 arquivos, 92 desvios históricos e zero novos. Nenhum baseline aprovado foi alterado. |
| Smoke | Nove verificações da compilação local passaram, sem sessão e sem redirecionamento externo. |
| Typecheck e build | Passaram na compilação final. A tentativa inicial recebeu EPERM na pasta temporária; a compilação com acesso normal ao workspace passou. |
| Visual | 40 cenários passaram na matriz principal. Os oito de fechamento do editor foram revalidados com o X oficial e retorno de foco. Larguras 320/390/768/1440, claro/escuro, dados fictícios e rede externa bloqueada. |

A regressão geral da entrega anterior está no histórico do commit `40d553f`.
Ela não foi repetida integralmente para esta correção. As demais integrações optativas
que exigem serviços externos não foram habilitadas.

## Revisão visual e limites

[Capturas atuais](evidencias/README.md). Inspeção consolidada de produto, grupo,
vínculos e quatro blocos de configurações. Reutiliza EditorVenda, CamposClassificacaoFiscal,
seletores, tabela e cartões existentes. Sem nova variante ou dependência.

Escape não fechou o editor na prévia. Esse gesto não foi considerado aprovado.
O X e o retorno de foco passaram nos oito contextos. O diálogo compartilhado da Central
não foi alterado nesta tarefa. A auditoria DOM é parcial e não certifica WCAG.

A prévia usa somente fixtures. Não comprova certificado externo, CSC ou autorização SEFAZ.
A nova interface não altera o enquadramento nem amplia os cálculos suportados pelo motor.

## Dados e publicação

A comparação real permanece privada. Nenhuma diferença tributária foi escolhida ou
aplicada automaticamente. As frutas do pedido investigado pertenciam à política do kit;
nenhuma linha ou CSOSN foi alterado para contornar validação.

Backup integral privado criado na VPS, com hash e catálogo de restauração verificados.
Nenhum restore do banco real foi executado. Séries, contadores, certificado, CSC e
credenciais não foram alterados. Não há schema ou migration nova.

O commit remoto, a execução do CI e a confirmação da publicação ficam registrados na PR
e no relatório de entrega. Não se confunde preparação, teste isolado e publicação.