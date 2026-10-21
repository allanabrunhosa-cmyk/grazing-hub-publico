# Cadastro e Data da compra — 20/10/2026

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Objetivo e contrato

Solicitação: formatar CPF/CNPJ e CEP; informar Data da compra junto ao pagamento;
copiar nome e telefone da cobrança; permitir veículo próprio por pedido.
O usuário confirmou telefone independente nas cobranças adicionais e telefone geral
na Principal. Confirmou calendário bancário nacional com feriados nos prazos úteis.

- CPF, CNPJ e CEP mostram máscara progressiva. Aceitam colagem com pontuação.
  O estado e os serviços recebem apenas dígitos. Letras e excesso de dígitos são
  recusados sem truncar outro documento. Seleção, cursor e exclusão de separadores
  conservam a edição. O servidor mantém a validação de domínio.
- `IdentidadeCobranca.telefone` é opcional no JSON existente. Adicionais usam número
  próprio. A Principal repete o telefone geral como campo somente leitura.
  `copiarCobrancaParaEntrega` copia endereço postal, nome e telefone da seleção.
  PF usa Nome Completo. PJ Principal usa o contato geral; sem contato, usa razão
  social. PJ adicional usa o destinatário informado ou razão social. Adicional sem
  telefone deixa o contato vazio. A operação altera somente a entrega selecionada
  e só persiste no salvamento explícito.
- `PedidoVenda.dataCompra` é DATE nullable. Entrada e DTO usam `YYYY-MM-DD`.
  Novo pedido inicia com o dia da loja. A criação no servidor aplica esse padrão
  se o cliente da API omitir o campo. Data de entrega continua independente.
  Orçamento manual permite alteração, inclusive com modo financeiro EXTERNO.
  Origem integrada e pedido confirmado bloqueiam alteração no servidor.
- `createdAt` e `confirmadoEm` conservam o instante real. A migration não preenche
  pedidos anteriores. Legado sem data mantém sua regra anterior. Abrir ou salvar
  dados sem alteração não inventa uma data de compra histórica.
- Pedidos novos com Data da compra usam esse dia no relatório comercial e na
  competência dos títulos HUB. Datas explícitas de boleto, captura e repasse
  permanecem fatos separados. Prazo por VENDA usa a compra; por PAGAMENTO exige
  o fato inicial comprovado. O cálculo não registra recebimento automaticamente.
- A escolha explícita de veículo ativo vale para aquela entrega, inclusive com
  slots ausentes ou capacidade diferente da escolha automática. O servidor
  recupera ID e perfil na configuração. Sem escolha explícita, permanece o
  cálculo automático por slots. A troca invalida o recibo anterior e recalcula
  rota/preço. Cobertura e permissões de preço manual permanecem vigentes.

## Implementação

Máscaras: `src/components/use-mascara-digitos.ts`,
`pedidos/identidade-cobranca-form.tsx`, `pedidos/endereco-pedido-form.tsx`.
Contato: `vendas/cliente-cobranca.ts`, `vendas/dominio.ts` e os consumidores
`clientes/campos-cliente.tsx` e `pedidos/editor-pedido.tsx`.
Data: `vendas/pedidos-data-compra.ts`, `pedidos-dominio.ts`, `pedidos.ts`,
`pedidos-gestao.ts`, `bi-consultas.ts`, `pedidos/dados-editor.ts` e formulários
de pagamento. Veículo: `entregas-veiculos.ts`, `entregas-dominio.ts`,
`entregas.ts` e `pedidos/frete-pedido.tsx`.

Migration manual aditiva: `20261020220000_pedidos_data_compra`.
Não há exclusão, regravação de vendas, backfill ou mudança em recebimentos reais.
Backup privado íntegro e plano do destino são obrigatórios antes de aplicar.

## Critérios de conclusão

- [x] Implementar máscaras e telefone próprio sem salvamento ao perder foco.
- [x] Implementar Data da compra e preservar o histórico técnico e legado.
- [x] Implementar veículo ativo por entrega e validar recibos no servidor.
- [x] Concluir testes de domínio, consumidores, integração e calendário.
- [x] Concluir lint, design, tipos, Prisma, build e prévias sintéticas.
- [x] Conferir backup e plano de migration do destino.
- [x] Publicar e verificar estabilidade, migration, configuração e interface.

As etapas pendentes não constituem publicação. Capturas sintéticas não aprovam
visualmente a referência nem homologam serviços externos.

## Validação pré-publicação

Node 22.23.2. ESLint dos arquivos alterados passou. `lint:design` verificou
420 consumidores e não encontrou desvio novo. Typecheck global, Prisma
validate/generate e build webpack passaram. O build concluiu 105 páginas.
O aviso de depreciação de middleware permanece no Next; não impede a compilação.

Smoke da aplicação compilada: 13/13 verificações aprovadas com login real
sintético nos hosts locais HUB/Pedidos. Clientes e Dashboard retornaram 200;
seis páginas/APIs sem sessão redirecionaram ao login. Novo Pedido apresentou o
dia da loja em America/Manaus, editável junto ao pagamento. Confirmado exibiu a
data civil salva, sem edição. O CSV autenticado incluiu a compra anterior ao
cadastro no período correto. Zero erros de cliente e solicitações externas.
App de smoke encerrado, portas 3473/3474/3475 livres.

Integração opt-in em PostgreSQL 17 local: 51 testes de compra/Financeiro/BI e
12 testes de Entregas aprovados, sem skips nessas rodadas. Flags:
`PEDIDOS_BANCO_TESTE`, `BI_BANCO_TESTE` e `ENTREGAS_BANCO_TESTE`.
Banco e pessoas são sintéticos. Os testes validam replay, fuso, data retroativa,
competência, prazos, captura real, bloqueios de origem/confirmado, seleção de
veículo e rejeição de recibo após trocar a decisão.

As prévias reuniram 75 capturas em 320/390/768/1440, claro/escuro. Auditorias
não encontraram problemas ou transbordamento. Conferência por teclado, colagem,
cursor, telefone, cópia da seleção e alteração da compra preservada após escolher
pagamento. Referências consultivas **Em revisão**:
[data e pagamento](evidencias/20261020-cadastro-compra/data-pagamento.png) e
[cobrança no celular](evidencias/20261020-cadastro-compra/cobranca-celular.png).

Dias úteis seguem a [Resolução CMN 4.880/2020](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4880&tipo=RESOLU%C3%87%C3%83O+CMN)
e o [calendário FEBRABAN](https://feriadosbancarios.febraban.org.br/).
A implementação local confere os 13 feriados bancários de 2026. Cinzas e
24/12 têm expediente especial, sem se tornarem feriados de mercado. O último
útil do ano distingue ausência de atendimento público de feriado financeiro.
20/11 integra a lista nacional desde 2024. A versão fica no snapshot do prazo.

Backup privado criado na VPS em
`<BACKUP_PRIVADO>`.
Dump de 122.558.493 bytes, catálogo `pg_restore --list` com 1.135 itens,
SHA-256 `65be946443ae5408cd4090353f487073e8819f2e35f38fd6b9f28ad6bec63a31`.
Snapshot da imagem/configuração fiscal anterior preservado. Plano somente leitura
conferiu apenas `20261020220000_pedidos_data_compra`, sem compatibilidade especial.
Hash do plano do destino:
`96e5b15a9289904a339f3ff41f9032f497548fc260e0aa28b60ed84c05b9fe6e`.
Nenhuma migration produtiva foi aplicada nesta etapa.

## Regressão final

A rodada geral percorreu 561 arquivos: 6.222 casos aprovados, sete falhas e
1.017 ignorados por opt-in. Cinco falhas eram expectativas antigas de máscara
ou da posição do filtro de data. Foram ajustadas preservando documento sem
pontuação no payload, lista/índice original e fallback histórico com data nula.
O teste histórico passou a conferir resultado não vazio e número original.

O fluxo mensal falhou ao consultar a opção antes de abrir o seletor; as duas
buscas síncronas passaram a aguardar a opção, sem mudar asserções ou timeout.
A falha de ancestral simbólico era `EPERM` do sandbox Windows ao criar a junction,
antes de executar a guarda. Fora do sandbox, os cinco casos passaram com a
guarda intacta. Nenhuma fonte do Financeiro ou da proteção de arquivos mudou.

Repetição conjunta dos seis arquivos: **95/95 aprovados**, sem skips.
Typecheck final, lint dos testes e diff check aprovados. A fonte de produção
permanece a mesma do build e do smoke compilado. Sem duplicar repetições e
incluindo as integrações opt-in afetadas: **6.292 casos aprovados**;
**954 não executados**, ligados aos demais ambientes/opt-ins da suíte.

## Publicação concluída

Commit funcional `5c40b6419ab9fbca5cb5c438505949f8a934de9e`, enviado à main
por avanço normal e conferido diretamente no remoto. A migration foi aplicada
pelo executor oficial, com o plano exato acima e backup reconferido. Não houve
backfill, exclusão ou alteração de pedidos, títulos e pagamentos anteriores.

Nova tarefa `7due4f89t1oi6dhv4vx31s72t`, contêiner `f3ab99177a72`, imagem
`sha256:5dfb902ee4edc3c24d8c55974002ab9053589419876b6b18444a62d2a650d329`.
Início em `2026-10-21T01:41:50Z` (20/10, 22:41 no horário de São Paulo).
Conferência após 168 segundos: running, zero reinícios, 16 arquivos de biblioteca,
schema e SQL com hashes iguais ao commit e `prisma migrate status` atualizado.
Configuração fiscal preservada; certificado continua no banco. Não houve
reaplicação de env/mount, emissão fiscal ou operação financeira externa.

HTTPS: sete verificações aprovadas. Login retornou 200. Clientes, Dashboard,
APIs de relatório/mapa e rotas de Pedidos redirecionaram ao login sem sessão.
Conferência autenticada em aba própria: Novo Pedido mostrou compra em
`2026-10-20`, editável junto à forma de pagamento; CPF e CEP com os padrões de
máscara; telefone da Principal somente leitura; seletor de veículo habilitado
com opção indicada, Carro e Moto. Clientes e Dashboard carregaram sem erro
visível. A conferência produtiva foi somente leitura, sem salvar cadastros ou
pedidos. As abas próprias foram fechadas; as abas do usuário foram preservadas.

Ambiente local encerrado: prévias 4249/4296/4298 e app 3473 sem listeners.
PostgreSQL 17 da tarefa encerrado normalmente, após confirmar PID/diretório e
zero outras conexões; porta 55468 livre. Bancos, backups e arquivos privados
preservados. Disco C com 21.331.046.400 bytes livres após a compilação.
A cópia desta tarefa não consta na lista permitida da manutenção. Sua cópia e
seus caches permanecem preservados, sem ampliar o catálogo ou excluir arquivos.
Rotina `Plan` concluída: 21.312.630.784 bytes livres, zero processos impeditivos
e nenhum candidato tratado. Medição parcial de caches, com quatro falhas de
leitura em cópias fiscais de outras tarefas. Nenhum cache foi excluído.
Evidência pós-publicação segue na branch de trabalho, sem novo deploy documental.
