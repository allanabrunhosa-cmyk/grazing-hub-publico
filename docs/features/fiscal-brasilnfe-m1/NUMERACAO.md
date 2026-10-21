# Séries e numeração — administração protegida

Contrato consultado em 14/10/2026: [Empresas — Consultar Numeração](https://www.brasilnfe.com.br/api/empresas) e [Numeração e Séries](https://www.brasilnfe.com.br/conceitos-fiscais/numeracao-e-series).

`POST /services/empresa/ConsultarNumeracao` exige Token e UserToken, sem corpo. O envelope usa `status` booleano próprio; `false` não vira sucesso. A lista `Numeracoes` informa `TipoAmbiente`, `ModeloDocumento`, `Serie`, `Numero` e `Padrao`. O cliente identifica o modelo por inteiro positivo seguro e projeta exclusivamente 55/65. Para esses modelos, exige ambientes 1/2, preserva a série textual e limita o contador a 1..999999999. Série numérica tem até três dígitos. Chaves equivalentes como `1` e `001` não criam dois contadores locais. Dois padrões na mesma combinação são recusados.

Registros identificáveis de outros modelos são contados e descartados **antes** de validar ambiente/série/contador. Não são declarados válidos nem usados operacionalmente. A lista exemplificativa publicada de oito modelos não delimita o projeto: um identificador adicional não pode bloquear NF-e/NFC-e. Modelo ausente, nulo, texto, fracionário, não positivo ou inteiro sem precisão continua sendo erro; nenhuma conversão ou preenchimento é feito. Um registro 55/65 inválido nunca é descartado como outro modelo.

`NUMERACAO_ITEM` agora conserva somente posição iniciada em 1, campo, tipo observado e motivo local. Os três últimos usam enums fixos e posição limitada a 1..1000. Sanitização elimina propriedades extras; valores recebidos, mensagens, respostas, headers, credenciais e objetos de erro não entram no diagnóstico. O histórico sem esses metadados continua legível. Mudança de credenciais/emitente invalida a evidência anterior.

O contador é informativo. Não reserva número e não comprova a última autorização de outros emissores. A leitura não modifica contadores. A atualização administrativa autorizada em15/10 tem contrato próprio, abaixo. O Brasil NFe conserva o controle automático; não há contador concorrente no HUB. Transmissão permanece bloqueada por código.

## Atualização autorizada — 15/10/2026

O proprietário definiu55/série6 e65/série7 em ambos ambientes. Número1 somente em
sequência nova. Os resultados de14/10 abaixo são históricos, não a configuração desejada.

`POST /services/empresa/AtualizarNumeracao`, com Token/UserToken protegidos,
recebe `TipoAmbiente`, `ModeloDocumento`, `Serie`, `Numero` e `Padrao`. O envelope
usa booleano; a resposta deve conter `Numeracao` coerente com o comando.
`Padrao=true` desmarca as outras séries somente naquele modelo/ambiente.
Preservam-se os demais contadores e históricos. Não chamar inutilização.

O serviço exige administrador central, emissão desligada, ausência de documento
em processamento, consulta recente ligada à configuração e UUID idempotente.
Registra início/intenção/resultado em eventos existentes; não cria tabela ou fila.
Confere CNPJ por BuscarEmpresa, lê o catálogo novamente, recusa redução e número
local consumido e exige1 para série nova. Após a alteração, reconfere catálogo e
emitente. Uma configuração já correta não chama o endpoint de escrita.

Timeout ou pós-leitura inválida/divergente ficam PENDENTE_CONFERENCIA. Não há
retry automático nem novo envio pelo mesmo UUID. Consulta manual pode confirmar
o resultado compatível; falta de confirmação não vira recusa ou autorização para
repetir. Somente `status=false` do próprio endpoint comprova recusa de negócio.
O histórico e DTO guardam apenas contadores e diagnósticos estruturados seguros.

As duas fases conferem novamente UUID, estado e prazo da operação. Uma operação
encerrada ou expirada não pode retomar e enviar. A intenção fica confirmada antes
do POST. O único POST mantém as travas administrativas em uma transação de20s;
o limite HTTP permanece10s. Consulta tardia relê o resultado terminal e não o
rebaixa. Confirmação atual exige a mesma configuração e identidade. O histórico
anterior continua visível com contexto ANTERIOR, sem confirmar os contadores atuais.

A tela reutiliza os campos, seletores, ações e tabelas oficiais. Salvar é explícito,
administrativo e não habilita emissão. Origem e data da leitura permanecem visíveis.
Essa administração fica indisponível se uma versão futura habilitar a transmissão,
até existir coordenação durável comum entre os dois fluxos.

## Implementação e permissões

- Tela: `/financeiro/fiscal/numeracao`, com leitura de `financeiro.fiscal.painel`.
- Consulta manual: `configuracoes.brasilnfe` / editar, com guarda central revalidada no servidor. Intervalo de 30 segundos; sem repetição automática.
- Getter para prévia: `obterNumeracaoFiscalBrasilNfe(sessao)`, aceita leitura central fiscal/financeira/integração. Consulta somente o banco.
- Resultado estruturado em `EventoConfiguracaoBrasilNfe`, vinculado à versão da configuração e hash do emitente. Mudança invalida a projeção anterior. Respostas brutas, credenciais e mensagens externas não são persistidas.
- Comparação por CNPJ da chave, modelo, ambiente e série. Documentos autorizados ou posteriormente cancelados continuam consumindo número. Exibe somente a autorização comprovada no HUB. Leitura limitada a 1000 documentos informa sua limitação, sem alegar cobertura externa completa.

Não há migration nem mudança em estoque, financeiro, notas recebidas ou cadastros externos.

## Interface e verificação

Consumidores de referência: Fiscal / configuração da empresa e Dashboard Fiscal. Reutiliza `BarraAcoes`, `GrupoAcoes`, Card, Button, Badge, Table e `FiltroOpcoesContadas`, com tokens oficiais e estados vazios/erro/obsoleto. Não cria variantes visuais.

Suítes sintéticas: `brasilnfe-numeracao-{cliente,dominio,servico,interface}.test.*`. Prévia isolada: `testes/visual/fiscal-numeracao.vite.config.mts`, dados e callbacks fictícios. Evidência visual permanece **Em revisão**, sem aprovação humana presumida. Consulta autenticada deve ser registrada separadamente; testes simulados não confirmam contadores reais.

Validação executada em 14/10/2026 com Node 22.23.3: 58 testes novos de numeração e a regressão `brasilnfe-cliente.test.ts`, total 285 testes aprovados em cinco arquivos. Lint focado e `lint:design` aprovados. Prévia sintética capturada em 320/390/768/1440 CSS px, claro/escuro, além de falha, consulta obsoleta, vazio, botão desabilitado e ausência de permissão: 13 cenários, sem diagnósticos na auditoria DOM. Enter no filtro separou os ambientes. Inspeção direta de desktop, celular e falha corrigiu a mensagem vazia e o rótulo da data. Capturas consultivas: [desktop claro](evidencias/numeracao-1440-light-sintetico.png) e [celular escuro](evidencias/numeracao-390-dark-sintetico.png). Os servidores da prévia foram encerrados após cada execução. Typecheck/build e eventual consulta autenticada pertencem à consolidação final, sem inferência desses resultados.

## Consolidação na aplicação real

A tela foi validada na aplicação Next autenticada, sem mocks, com perfis centrais.
A ação administrativa real executou uma consulta de leitura em 14/10/2026, 21:47:48
Brasília: HTTP200, CONTRATO/NUMERACAO_ITEM; nenhum contador confirmado ou reservado.
Não foi repetida. Registro e rascunho de suporte em [CONTRATOS](CONTRATOS.md).
Tipos, Prisma validate, lint/design e build Node22 passaram na consolidação.
[Captura real da aplicação com banco sintético](evidencias/estrutura-numeracao-real-390.png)
permanece Em revisão; não substitui a resposta do fornecedor.

## Correção posterior à publicação — branch `codex/fiscal-num`

Base `d144b665`, preservada. Sem merge/deploy nesta correção. Documentação oficial
reconferida em 14/10/2026; método, rota, headers e envelope booleano mantidos.

Leituras feitas pelo botão da aplicação administrativa **local**, com sessão e
permissões reais, credenciais protegidas anteriores e emitente correspondente. Não
copiaram segredos nem aprovações para produção. Não são consulta do cache publicado:

| Rodada, em Brasília | Resultado |
| --- | --- |
| 14/10, 23:39:51 | HTTP200; item17, `ModeloDocumento`, `INTEIRO`, `FORA_LISTA`. O cliente recusava a lista inteira por um modelo fora de sua enumeração fixa. Nenhum valor rejeitado foi conservado. |
| 14/10, 23:42:38, após correção e testes | HTTP200, consulta concluída; quatro contadores confirmados para55/65; 16 registros fora do escopo separados. Resultado persistido e conferido após recarga. |

| Modelo | Ambiente | Série | Próximo número informado | Padrão |
| --- | --- | --- | --- | --- |
| NF-e55 | Produção1 | 1 | 1 | Sim |
| NF-e55 | Homologação2 | 1 | 1 | Sim |
| NFC-e65 | Produção1 | 1 | 1 | Sim |
| NFC-e65 | Homologação2 | 1 | 1 | Sim |

Origem dos números: resposta de `ConsultarNumeracao` da Brasil NFe às23:42:38.
Não foram calculados pela última nota local, reservados ou alterados. A tentativa
rejeitada181 continua histórica, sem nova consulta/reenvio e sem protocolo. O retorno
de próximo número1 não autoriza reenvio ou reutilização de uma tentativa antiga.

A versão publicada conserva o parser anterior até uma publicação autorizada desta
correção. Transmissão continua desativada por código para55/65 e ambientes1/2.
Capturas novas são sintéticas e **Em revisão**:
[diagnóstico celular](evidencias/numeracao-contrato-390-dark-sintetico.png) e
[outros modelos](evidencias/numeracao-fora-escopo-1440-light-sintetico.png).
