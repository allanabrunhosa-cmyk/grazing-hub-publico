# Autenticação e permissões

O atendimento é desenvolvido em repositório próprio. O HUB continua dono das contas,
perfis e permissões. A integração existente e os arquivos que permanecem aqui estão
registrados em [Atendimento](atendimento.md). Não duplicar cadastros ou autenticação central.

## Mapa

| Caminho na raiz | Responsabilidade |
| --- | --- |
| `src/lib/session-token.ts` | Token de sessão e atributos do cookie |
| `src/lib/session.ts` | getSession relê identidade, atividade, versão, perfil e exceções |
| `src/lib/password.ts`, `src/lib/auth.ts` | Senha / entrada de conveniência no servidor completo |
| `src/lib/permissoes/catalogo.ts` | Recursos, ações e permissão efetiva |
| `src/lib/permissoes/servidor.ts` | exigirPermissao/podeAcessar |
| `src/app/(protegido)/configuracoes/usuarios` | Gestão de usuários/perfis |
| `src/app/login`, `src/lib/recuperacao-senha` | Login e recuperação |
| `src/lib/hosts.ts`, `src/middleware.ts` | Hosts explícitos, origem e entrada protegida |
| `testes/permissoes/contrato-acoes.json` | Contrato de fronteiras das ações |

## Invariantes

- Middleware verifica token; não substitui a releitura do usuário no servidor.
  Não importar auth/bcrypt no middleware: usar session-token.
- Cookie host-only, HttpOnly, SameSite=Lax, Secure em produção. Mesma conta nos
  hosts, mas login inicial separado. Não ampliar Domain nem conceder SSO implicitamente.
  Validades usa `validades.grazinghub.com.br`; o alias anterior permanece explícito
  para compatibilidade, conforme [contrato de entrada](../etiquetas-subdominio.md).
- Escritas/páginas/endpoints devem exigir permissão no servidor. Ocultar botão não basta.
  Recursos novos são negados por padrão; não usar o flag legado admin como fonte de acesso.
- Sessão é revogada por versão, inativação/exclusão e redefinição de senha.
  Operações críticas releem autorização dentro da transação; conservar guardas compostas.
- Gestão de acessos protege último administrador, impede elevação indireta e audita
  antes/depois sem senhas. Não executar seed administrativo no deploy.
- Atualizar contrato de ações e testes ao adicionar fronteiras; script
  `scripts/aplicar-guardas-acesso.mjs` é auxiliar, não licença para reescrever tudo.
- Recuperação: token de uso único, hash no banco, segredo no fragmento da URL, limitação
  persistente e resposta não enumerável. SMTP privado, sem credenciais em log.
  Envio via after não é fila durável; não prometer entrega sem comprovação.

Atividades por autor: [contrato de auditoria](auditoria-atividades.md). A capacidade
`configuracoes.usuarios.atividades` é somente consulta e negada por padrão.
Autor e usuário afetado são distintos; login sem identidade confirmada não recebe
autor por e-mail informado. Logout explícito não inclui fechar navegador.

Testes: `testes/permissoes`, `testes/login`, `testes/etiquetas/hostname.test.ts`
quando aplicável. Integrações exigem ambiente
local explícito (ACESSOS_BANCO_TESTE / LOGIN_BANCO_TESTE).

## Convite e conta compartilhada

Gestão de usuários cria a conta sem senha informada pelo administrador. O cadastro
grava um hash aleatório desconhecido e `senhaDefinida=false`. Login e sessão recusam
esse estado. O convite usa o serviço de recuperação e nasce na mesma transação do
cadastro. O envio ocorre após o commit e aguarda a aceitação do SMTP. Falha de envio
mantém o usuário pendente, invalida aquele link e informa a falha ao gestor.
`enviarLinkSenhaUsuarioAcesso` permite reenvio com autorização transacional, alcance,
versão, atividade e auditoria. Conta criada inativa exige ativação e envio do link.

`validarNovaSenha` exige 8 caracteres, uma letra maiúscula, um caractere especial e
no máximo 72 bytes. Recuperação e alteração no perfil usam a mesma regra. Concluir
o link define a senha, confirma `emailVerificadoEm`, incrementa a versão da sessão e
consome o token na mesma transação. Contas anteriores conservam senha e acesso;
o valor padrão aditivo de `senhaDefinida` é true. Administradores pendentes não
substituem o último administrador com senha definida.

HUB, Pedidos e Validades usam o mesmo cadastro. Atendimento lê a view privada
`atendimento_integracao.identidade`, limitada às contas com permissão central de
visualizar Atendimento. A migration atualiza a view somente quando ela já existe,
preservando seus grants. A aplicação dedicada provisiona o vínculo técnico no
primeiro login autorizado e preserva vínculos explicitamente revogados. Não copiar
hashes para seu banco nem ampliar cookies entre hosts. Permissões do perfil e
exceções continuam valendo em cada sistema.

A consulta dedicada aceita a chave histórica `crm.visualizar` usada pelo catálogo
do HUB. Se o perfil declara `crm.atendimento` ou existe uma exceção específica de
visualizar, essa decisão prevalece, inclusive quando nega acesso. A view e o
provedor dedicado aplicam a mesma regra. `crm.visualizar` isolado não concede escrita.
O catálogo oferece `crm.editar` para gerir estado e responsável das conversas quando
também há visualização e não existe decisão específica no perfil ou nas exceções.
`src/lib/permissoes/atendimento.ts` define os recursos e as capacidades próprias de
mensagens, notas, etiquetas, contatos, agenda, pipeline, dúvidas, conhecimento, IA,
habilidades, tom, acompanhamento, configurações, modelos, notificações, canais e equipe.
Criar e editar agenda/pipeline são decisões distintas, conferidas com o registro travado.
Habilidades comparam o conjunto dentro da transação; cada inclusão, alteração ou remoção
exige sua ação. Excluir conhecimento revoga a versão ativa e conserva seu histórico.
Leituras negadas são filtradas também no histórico e nas prévias das conversas.

A migration `20261013170000_atendimento_permissoes_granulares` materializa uma vez os
acessos anteriores em perfis e exceções, preserva decisões granulares existentes e
incrementa uma vez a versão das sessões afetadas. Audita somente permissões.
A view privada expõe `permissoesGranulares=true` no mesmo commit dessa transformação.
Antes do sinal, o dedicado mantém compatibilidade para chaves ausentes e respeita vetos
explícitos. Depois do sinal, chaves novas ausentes negam acesso, inclusive em perfis novos.
O provisionamento da view consulta o marcador para não reabrir essa compatibilidade.
Os gates operacionais continuam independentes das concessões. Identidades técnicas
mantêm allowlists próprias. O servidor relê permissões em cada ação da sessão aberta.
A exclusão na lista usa o X e a confirmação existente;
o servidor revoga as sessões e preserva o histórico e o último administrador.

Pedidos segue o mesmo contrato de entrada dedicada de Etiquetas, com identidade e
allowlist de páginas próprias. Consultar [host de Pedidos](../pedidos-subdominio.md) e
`testes/vendas/pedidos-hostname.test.ts` ao alterar hosts, origem ou rotas do gestor.
