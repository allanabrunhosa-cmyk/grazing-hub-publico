# Apresentação do plugin Grazing HUB

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Fonte da versão **1.0.2** enviada à atualização do plugin existente no ChatGPT.
Não é outro MCP, cliente OAuth ou aplicativo. `.app.json` conserva a identidade
registrada; não contém token, segredo ou autorização pessoal. Não instalar como
novo plugin para tentar resolver a imagem, nem recriar a conexão.

`assets/grazing-hub.svg` foi exportado de `src/components/logo.tsx` (LogoMark),
com os tokens HUB de `src/app/globals.css`: navy, branco e azul. PNG 512×512
gerado pelo sharp já instalado, fonte Segoe UI correspondente ao padrão Windows
da Central. Geometria, monograma e barra preservados; sem nova marca ou dependência.

Manifesto portable completo e overlay de compatibilidade preservam autor, nome,
descrições, categoria, capabilities, prompt null e apps. Só foram acrescentadas
referências `logo`/`composerIcon` e alterada a versão; a conversão de formato não
remove declarações. A descrição curta preexistente foi conservada porque o pedido
é apenas a imagem; não reescrever conteúdo ou ampliar capabilities nesta frente.

## Operação verificada em 07/10/2026

1. Abrir o plugin existente, Mais ações → Baixar ZIP do plugin. Inspecionar o
   manifesto e `.app.json`; conferir identidade e estado da conta antes de editar.
2. Empacotar os arquivos desta pasta **exceto este README**, incluindo arquivos
   ocultos e assets. Conferir identidades, campos mantidos e imagem antes do envio.
3. Mais ações → Enviar nova versão → Escolher arquivo. Atualização autorizada pelo
   pedido de logo. Preservar o app ID, conta, público e permissões.
4. Conferir "Nova versão enviada", número da versão e conta após recarregar.
   Conferir também a imagem: sucesso do upload sozinho não comprova sua exibição.

A versão 1.0.1 (overlay legado) foi aceita; download posterior comprovou PNG/SVG e
referências persistidos. A versão 1.0.2 acrescentou o manifesto portable completo,
sem alterar a identidade/conexão, e também foi aceita. Página mostra **1.0.2** e
**Conta de responsável autorizado no Grazing Hub / Primary**. Ainda apresenta ícone genérico após
recarregar. **Troca visual pendente no ChatGPT**, causa não comprovada. Não afirmar
que é apenas cache ou que a logo aparece. Configurações do aplicativo oferecem
nome/descrição e atualização de ferramentas, sem controle de imagem observado.
Plugin Creator retorna que o plugin é app-backed e não editável por sua API;
envio ocorreu pela opção oficial disponível na página do mesmo plugin.

Não houve mudança de servidor, código de produção, OAuth, permissões, banco ou
infraestrutura. Não é necessário novo deploy do HUB para este pacote. Evidência
local ignorada `.tmp-mcp/chatgpt-logo-estado-final.png`; pacote e validações
controlados em `.tmp-mcp/logo-plugin-*` e `.tmp-mcp/grazing-hub-logo-*.zip`.

Referência do formato: [documentação oficial de plugins](https://developers.openai.com/plugins/build/plugins).
