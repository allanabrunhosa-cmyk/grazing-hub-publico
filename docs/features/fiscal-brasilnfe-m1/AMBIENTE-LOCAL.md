# Ambiente administrativo — Marco 1.1

Retomada de 14/10/2026: aplicação real da branch fiscal atual na mesma porta3451,
cluster, base e chave persistente. As migrations pendentes da main foram aplicadas
somente na base administrativa conferida. Nenhum reset, clone de produção ou novo
preenchimento de credenciais. `teste_estrutura_fiscal` é uma base vazia adicional
do mesmo cluster local, criada para o contrato exato das integrações v2; os testes
usam schemas sintéticos efêmeros. Não contém cópia operacional.
O controle do Chrome não permitiu nova inspeção autenticada nesta rodada. Capturas
de componentes usam fixtures isoladas e não substituem essa verificação.

Aplicação real da branch `codex/fiscal-brasilnfe-m1`, com login normal do HUB e perfil
central Administrador. Não usa a prévia Vite, mocks, cookies fabricados ou bypass.

URL local: <http://127.0.0.1:3451/configuracoes/integracoes/brasilnfe>.
O navegador preparado já está autenticado. Login: <http://127.0.0.1:3451/login>.
O ambiente somente é acessível neste computador, sem abertura de portas externas.

## Isolamento e persistência

Retomada da Issue11,12/10/2026, branch `codex/fiscal-autonomia-tributaria`:
mesmo cluster/base/chaveDPAPI/credenciais e sessão administrativa existentes.
A única migration pendente era `20261012100000_brasilnfe_autonomia_tributaria`,
aditiva já versionada; aplicada somente em `admin_brasilnfe_m11` após conferir
loopback55449, CNPJ correspondente e ausência de dados operacionais. Nenhum seed,
novo usuário ou reset. PostgreSQL permaneceu no mesmo processo existente.

Servidor da branch atual em `http://127.0.0.1:3451`; `/configuracoes/empresa`
permitiu salvar o endereço comprovado e confirmar persistência pela sessão real.
`/vendas/fiscal/regras-brasilnfe` abriu normalmente e continua sem decisões,
porque os camposCRT/IPI/aprovação ainda faltam. Credenciais fiscais configuradas
na versão9, sem consulta/regravação de valores. A préviaVite4442 foi usada somente
para QA com fixtures e encerrada; não substitui esse ambiente real.

Controle privado deste computador: `.tmp/issue11-revisao/admin.ps1`, ignorado pelo
Git, usa o helper existente e confere o destino antes de servir. `-Etapa conferir`
retorna apenas metadados seguros; `-Etapa servir` recusa porta3451 ocupada e não
aplica migrations/seed nem faz consultas fiscais. Não usar `preparar/iniciar` do
helper antigo indiscriminadamente na nova worktree: seus caminhos privados são
de outro checkout. A chave original não foi copiada, gerada ou modificada.

`scripts/brasilnfe-m11-local.ps1` exige PowerShell Core e Windows. O preparo cria um
cluster PostgreSQL17 próprio, SCRAM-SHA-256, limitado a `127.0.0.1:55449`.
`admin_brasilnfe_m11` contém somente o administrador local, perfis/permissões centrais
e o cadastro mínimo do emitente. `teste_brasilnfe_m11_sintetico` é separado e reservado
para testes fictícios. Não foi clonada nenhuma base operacional.

As migrations existentes, incluindo `20261010090000_brasilnfe_marco1`, foram aplicadas
somente ao destino administrativo conferido. O helper usa `prisma migrate deploy`,
nunca `migrate dev`/`db push`, e recusa destino divergente.

Os arquivos privados ficam em `.tmp/brasilnfe-m11-admin`, ignorados pelo Git, com
ACL limitada ao usuário Windows atual e SYSTEM. `AUTH_SECRET`, senha do banco e
senha administrativa são próprios deste ambiente, gerados uma única vez e
protegidos com DPAPI do usuário Windows. A chave externa ao banco é persistente;
o AES-256-GCM/contexto do HUB continua protegendo as credenciais fiscais no banco.
Não copiar a pasta privada a outro ambiente; não excluir/regenerar suas chaves
enquanto houver credenciais salvas. Rotação requer procedimento de recifragem.

Processos recebem ambiente limpo e apenas as variáveis locais necessárias. O helper
recusa arquivos `.env*` que seriam carregados pela Next em desenvolvimento e impede
o carregamento implícito de `.env` pelo seed. Nenhum segredo de produção foi copiado.
Servidor real: `next dev --webpack -H 127.0.0.1 -p 3451`. A escolha de desenvolvimento
preserva o contrato existente de host/cookies locais; `npm start` deste projeto
escuta `0.0.0.0` e não é o comando deste ambiente.

## Retomar neste computador

Com PowerShell Core, na worktree da branch:

```powershell
# Preparo inicial: executável oficial Node22 isolado, sem instalar globalmente.
./scripts/brasilnfe-m11-local.ps1 -Acao preparar -Node22 '<caminho-absoluto-do-node22.exe>'
# Retoma em segundo plano, sem depender da janela do atendimento.
./scripts/brasilnfe-m11-local.ps1 -Acao iniciar
# Alternativa em primeiro plano, mantendo esta janela aberta.
./scripts/brasilnfe-m11-local.ps1 -Acao servir
# Mostra somente a identificação saneada do ambiente, sem ler as chaves.
./scripts/brasilnfe-m11-local.ps1 -Acao status
```

Não iniciar outro servidor na mesma porta. O preparo não recebe Token/UserToken e
não executa consultas fiscais. Administrador inicial usa o seed central; senha
aleatória protegida permanece privada. A sessão desta entrega foi obtida pelo
formulário normal de login, conferindo senha e perfil no servidor.

`iniciar` exige ambiente previamente preparado e recusa a porta3451 ocupada.
Cria um lançador Windows local oculto via WMI, com ambiente limitado, mesmo usuário
DPAPI conferido e wrapper privado que executa status/preparar/servir. O wrapper e
os argumentos não contêm segredos. PID/URL ficam no registro privado
`processo-local.json`. Não instala serviço, agendamento ou inicialização após reboot;
é uma execução manual independente. Conferir disponibilidade depois da partida,
pois o retorno do lançador não significa que a Next terminou de iniciar.

Na retomada de10/10/2026, após o usuário relatar falha no acesso, ambos os listeners
estavam ausentes. A causa específica do encerramento anterior não foi comprovada.
Foi substituído o lançamento temporário por `iniciar`, preservando banco/chave/admin.
Depois de terminar o comando lançador, chamadas separadas confirmaram o proprietário
e os listeners3451/55449 somente em127.0.0.1; HEAD do login retornou HTTP200.
Essa verificação é do servidor, sem ler página protegida, cookies ou credenciais.
A automação do navegador interno recusou a abertura da página nesta retomada;
nenhuma superfície alternativa foi automatizada para contornar a recusa.
O usuário confirmou posteriormente a abertura no Chrome e forneceu evidências
da tela real, com salvamento e diagnóstico executados pela própria sessão.

## Credenciais e diagnóstico

Preencher **Token da empresa** e **UserToken** exclusivamente na tela acima e clicar
**Salvar**. Não enviar credenciais pelo chat, terminal, arquivo, captura, vídeo,
trace ou HAR. A leitura exibe somente Configurado/Não configurado e mantém inputs
vazios. Salvar não chama a API e não ativa emissão.

Depois de salvos, executar **Validar conexão** uma vez. Consultas permitidas neste
marco: BuscarEmpresa e ConsultarServicos. Conferir o CNPJ retornado com o emitente
esperado; não editar o esperado para corrigir divergência. Não conservar respostas
brutas, pois BuscarEmpresa pode devolver credenciais. Registrar exclusivamente
estados saneados. Nenhuma nota histórica, período real, SEFAZ, certificado ou CSC
é consultado; nenhum documento é transmitido.

Em10/10/2026, ambas as credenciais foram salvas pelo usuário e permaneceram indicadas
como Configurado na releitura com inputs vazios. Diagnósticos reais identificaram
uma máscara de CNPJ na resposta. O cliente foi ajustado somente para normalizar
a máscara completa, sem alterar o emitente esperado. Estados, verificações e
pendências efetivas estão em [TASKS](TASKS.md); não inferir autenticação pela gravação.
Depois da correção, BuscarEmpresa confirmou acesso/CNPJ correspondente. ConsultarServicos
foi tentada e ficou indisponível: serviços55/65 não confirmados, diagnóstico geral
Falhou e pré-requisitos pendentes. Não repetir a consulta até esclarecer com o
fornecedor; não tentar emissão como diagnóstico.

O cadastro mínimo usa somente razão social/CNPJ conferidos na visão geral autenticada
do Brasil NFe. Endereço, IE, CRT e parâmetros tributários continuam pendentes e não
impedem esse diagnóstico administrativo de leitura. Não registrar CNPJ real em
fixtures, documentação ou imagens versionadas.

## Runtime e evidências

Dockerfile vigente usa `node:22-slim`; documentação de produção também indica Node22.
Foi utilizado Node22.23.3 oficial para Windows x64, sem atualizar dependências ou
runtime global. ZIP conferido pelo SHA-256 publicado pelo Node.js:
`2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71`.
[Distribuição oficial e checksums](https://nodejs.org/dist/v22.23.3/SHASUMS256.txt).
Isso verifica a versão major alvo no Windows; não afirma ter construído/executado
a imagem Linux produtiva. Resultados efetivos: [TASKS](TASKS.md).

Imagem versionada `testes/visual/evidencias/brasilnfe-m11-real-credenciais-vazias.png`
mostra somente a seção de credenciais vazias da aplicação real. Não há tokens, dados
do emitente, traces, HAR ou vídeo nas evidências. Central preservada; a referência
visual continua Em revisão humana.
`testes/visual/evidencias/brasilnfe-m11-real-diagnostico-incompleto.png` é a captura
final enviada pelo usuário na sessão real, com acesso confirmado e serviços
indisponíveis. Copiada sem alteração, sem credenciais ou identidade real visível.

Produção, transmissão, adaptador operacional, fila e callback permanecem bloqueados.
Acesso autenticado administrativo não é homologação fiscal nem condição suficiente
para emissão. Entrada do Marco2 exige fechar as pendências do fornecedor/Confirp e
autorizar uma SPEC própria de homologação sintética.
