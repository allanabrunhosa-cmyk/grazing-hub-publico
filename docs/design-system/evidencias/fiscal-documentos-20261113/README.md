# Fiscal: arquivos, períodos e indicadores — 13/11/2026

Estado: **Em revisão**. Todas as capturas usam dados e ações fictícios.
Nenhuma referência aprovada foi substituída.

## Comportamento

O botão de arquivos da lista abre o painel de detalhe existente. O painel oferece
PDF/DANFE, XML e evento de cancelamento conforme a presença local e a permissão
da fonte. Abrir PDF e Baixar XML usam a mesma variante verde oficial.

Autorizações sem XML aparecem em aviso separado, com recuperação explícita.
Não fornecem data, valor ou competência por estimativa. A contagem das notas
comprovadas continua visível. Erro de recuperação permanece na tela e permite
nova tentativa. Escape fecha o painel de leitura mesmo com foco no link XML,
com retorno ao botão de origem.

O filtro padrão distingue Mês completo de Mês anterior. Não há mudança de
cartões, cores locais, tipografia, menu ou fluxo de edição.

## Validação executada

Node 22.23.3. Banco PostgreSQL 17 local exclusivo e emissor HTTP simulado.
Prévia Windows com Chrome local, Playwright 1.64.0, DPR 1 e fuso de Brasília.

| Verificação | Resultado |
| --- | --- |
| Regressão fiscal e consumidores próximos | 1.868 aprovados; 197 opt-ins ignorados nesse comando |
| Integrações pertinentes, executadas separadamente | 98 aprovadas: dashboard 8, saída fiscal 45, emissão/revisão 45 |
| ESLint nos arquivos alterados | 45 arquivos, sem erros |
| Lint de design | 0 desvios novos; 88 históricos preservados |
| Integridade das referências | Nenhuma referência promovida ou alterada |
| Typecheck integral | Aprovado |
| Build de produção com webpack | Aprovado na execução final, com Node 22 |
| Acesso à cópia compilada | 5 verificações aprovadas: login 200; páginas e downloads protegidos redirecionam ao login sem sessão |
| Matriz de navegador do dashboard | 36 casos aprovados |
| Matriz de navegador de Pedidos | 24 casos aprovados |
| Auditoria nas duas matrizes | 96 auditorias sem problemas detectados |
| Recapturas para enquadramento da tela | 12 casos do dashboard e 8 de Pedidos aprovados |

Os 60 casos visuais cobrem 320, 390, 768 e 1440 px nos temas claro/escuro, mais
toque em 320/390 px. As recapturas conservam o enquadramento visível para não
deslocar cabeçalhos fixos em imagens de página inteira. Não se somam novamente
às contagens da matriz.

As 98 integrações incluem 53 casos que estavam desativados no comando principal
e 45 casos adicionais de Vendas. Os outros 144 opt-ins do comando principal não
foram executados. Nenhuma emissão, manifestação ou cancelamento real foi usado
para testar. Não houve alteração de schema, dependências ou tributação.

Os testes verificam emissão=saída no payload55, ausência de dhSaiEnt no65,
vigência e hash, renovação de rascunho envelhecido, preservação de tentativas,
autorização única em cliques concorrentes, XML persistido após falha de PDF,
recuperação posterior, permissões e ausência de escrita ao ler o dashboard.

As primeiras rodadas localizaram massas antigas sem código comercial válido,
uma colisão entre números sintéticos e um bloqueio de Escape no grupo de ações.
As massas foram alinhadas ao cadastro vigente e o consumidor de leitura foi
corrigido. Asserções, limites e migrations aplicadas permaneceram preservados.
Uma revisão independente também levou à proteção contra horário antigo na NFC-e
e à preservação do erro quando o XML continua ausente.

CI e publicação ficam registrados na PR desta entrega. A primeira compilação
local foi impedida ao criar uma pasta de saída. A repetição com permissão local
para os arquivos gerados passou, sem alterar o código.

## Capturas

- [Lista no computador](dashboard-desktop.png)
- [Arquivos no computador](arquivos-desktop.png)
- [Arquivos no celular](arquivos-mobile.png)
- [Recuperação no celular](recuperacao-mobile.png)
- [PDF e XML no pedido — computador](pedido-desktop.png)
- [PDF e XML no pedido — celular](pedido-mobile.png)

[Origem e hashes](origem.json) vinculam as capturas ao código conferido.
Logs extensos, relatórios e backup permanecem privados e fora do repositório.
As imagens e a auditoria parcial não certificam leitor de tela ou hardware.

## Publicação e preservação

A PR registra o commit integrado, a tarefa estável no servidor e os acessos
verificados. Eventual recuperação de arquivo real é uma correção operacional
separada dos testes, limitada à identidade já autorizada. Não emite novamente
nem altera o XML assinado, a fotografia fiscal ou a numeração.

Retorno: reverter o código por PR, sem restaurar banco sobre operações novas.
Backup privado conferido antes da publicação. Nenhuma migration nova.
