# Permissões por operação do Atendimento

## Objetivo

Separar consulta, criação, edição e remoção das operações existentes. A matriz terá
um grupo Atendimento, com recursos e descrições claras. A entrada em Vendas e a
rota dedicada continuam usando `crm`. Não criar exclusão de conversas ou mensagens.

## Contrato decidido

`src/lib/permissoes/atendimento.ts` é a fonte comum do catálogo e das capabilities.
Conversas usa `consultar`/`atender` para consulta e gestão de estado/responsável.
Enviar mensagem/anexo e salvar rascunho usa `mensagens.adicionar`. Notas usam
Adicionar; etiquetas usam Editar. Agenda, pipeline e dúvidas separam criação/edição.
Conhecimento separa propor, revisar/substituir e revogar. Excluir revoga a versão
vigente, sem apagar histórico. Habilidades permitem adicionar, alterar e remover
definições pelo endpoint que substitui o conjunto, com comparação dentro da transação.
IA, Tom e acompanhamento possuem consulta/edição próprias. Canais, equipe e
notificações de pedidos possuem somente consulta neste sistema.

## Hierarquia do Atendimento — atualização de 21/10/2026

A matriz organiza Atendimento → Seção → Recurso → Ação. A mudança fica restrita
ao Atendimento. Os demais módulos conservam sua estrutura. As seções são Pipeline,
Chat, Agenda, Templates, Automações, Conhecimento, Agente & IA, Tom de voz,
Meta WhatsApp, Atividades e Configurações.

Cada recurso oferece somente operações existentes. Contatos separa adicionar e
editar. Novas conversas separa a preparação e a criação pelo contato salvo.
Alertas de follow-up e atalhos de texto usam visualizar, adicionar, editar e excluir.
Templates separa o cadastro da sincronização com a Meta e do envio de mensagens.
Atividades próprias e atividades da equipe possuem consultas distintas.
Excluir alerta cancela o agendamento e preserva o histórico. Mensagens, conversas,
contatos, compromissos e negócios não recebem exclusão sem operação correspondente.

O catálogo passa a ter 24 recursos e 57 capacidades. O agrupamento não concede
herança. Uma ação exige visualizar o mesmo recurso, além dos requisitos do fluxo.
A gestão de contatos, atalhos, templates e alertas usa suas ações próprias.
Assumir ou encerrar uma conversa continua exigindo editar Conversas e fila.

A migration manual `20261021120000_atendimento_permissoes_hierarquia` materializa
as ações desmembradas a partir dos requisitos efetivos anteriores. Ela normaliza
`crm` a partir do acesso efetivo legado, inclusive o alias `crm.atendimento`.
O alias permanece no banco. Depois de `permissoesHierarquia=true`, o servidor usa
`crm` como acesso canônico. Antes do marcador, mantém a resolução histórica.
As permissões e exceções dos demais módulos permanecem intactas.

A nova migração preserva `sessaoVersao`. Atualiza `updatedAt` nos cadastros
alterados para impedir gravação por formulários antigos. Planeja e compara os acessos
antes de gravar, registra auditoria técnica e impede reaplicação equivalente.
Uma decisão antecipada conflitante ou uma view fora do contrato aborta a transação.
O servidor do Atendimento deve ser publicado com compatibilidade antes da migração.
Não alterar a autoridade dos envios humanos ou o estado de ativação da Donatella.

Login exige `consultar`. Leituras granulares negadas não podem aparecer em prévias,
histórico, notas, anexos, configurações ou consultas auxiliares. UI não consulta áreas
negadas e usa somente capabilities resolvidas no servidor. Ocultar controles não
substitui a autorização transacional, o lock, a versão e a idempotência.

## Compatibilidade e banco

Migration manual aditiva materializa direitos efetivos legados em perfis/exceções.
Decisões granulares já existentes, inclusive [] e false, prevalecem. Fonte: a consulta
legada concede leituras; atendimento legado concede mensagens/notas/etiquetas/agenda/
pipeline/dúvidas; configuração/conhecimento legados concedem suas operações antigas.
Perfil Administrador continua autorizado por sistema, sem exceções.

Registrar antes/depois somente de permissões em HistoricoAcesso, com autor técnico,
e projetar por referência como SISTEMA, sem atribuir o fato a um usuário inexistente,
e um evento global idempotente. A versão de sessão é incrementada uma vez por usuário
afetado. A execução inteira usa transação e o lock de gestão de acessos. Backup privado
verificado é obrigatório antes da produção. Nenhuma senha/hash/e-mail entra na auditoria.

A view privada passa a expor `permissoesGranulares=true` somente no commit da migração.
O dedicado suporta equivalência transitória apenas antes desse sinal, respeitando
qualquer decisão granular explícita. Depois do sinal, ausência de chave nova nega
acesso, inclusive para perfis criados posteriormente. Isso permite publicar código
compatível antes da migração sem interromper o atendimento durante o rollout.

Identidades IA/Woo mantêm allowlists próprias e gates atuais. Não ativar operação,
inferência, voz, Woo, canais, credenciais ou envios para testar. Testes usam fixtures e
bancos locais; validação publicada é por leitura e artefatos, sem alterações reais de ACL.

## Aceite

- Adicionar não altera registro existente. Editar não cria registros novos.
- Exclusão de conhecimento/habilidade respeita capacidade própria e preserva histórico.
- Negar uma leitura impede sua exposição em dados e controles relacionados.
- Negar uma ação impede a mutação direta, com rollback e auditoria correta.
- Vetos explícitos vencem compatibilidade. Revogação vale na próxima ação da sessão.
- Migração/reexecução não amplia direitos nem duplica auditoria ou versões.
- Navegação, gates, identidade compartilhada e publicação concorrente são preservados.

Execução e evidências: [TASKS](TASKS.md).
