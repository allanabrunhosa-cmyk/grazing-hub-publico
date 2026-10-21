# Execução de Entregas

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Cálculo direto, sem confirmação de endereço — 05/10/2026

Solicitação explícita do usuário, com publicação autorizada. Branch isolada
`codex/frete-automatico-20261005`, atualização remota incorporada até `514c1306`.
Checkout principal e alterações alheias preservados. Código funcional `c07adafa`.

- [x] Origem/destino completos enviados como `address` a Routes, com região BR;
  a resolução e a rota acontecem na mesma chamada. Removidas pré-validação pela
  Geocoding API, seleção de candidatos, tokens e confirmação de localização.
- [x] Pedido mantém cálculo automático após 600 ms de pausa e recebe o frete sem
  popup/clique adicional. Simulador usa o mesmo adaptador. Falhas e ausência de rota
  não viram zero; cobertura, slots, recibo comercial e histórico são preservados.
- [x] Reutilizados CampoEntrega, EscolhaEntrega, CurrencyInput, Button, Dialog,
  ResultadoCalculoEntrega e CamposEnderecoEntrega/CamposEnderecoPedido. Nenhuma
  primitiva, token ou padrão novo. Contrato atualizado na Central e na Operação.
- [x] 185 testes de Entregas/Pedidos aprovados em 13 arquivos, incluindo integração
  PostgreSQL opt-in no banco local exclusivo `teste_frete_automatico_20261005`.
  Após integração do remoto, 84 testes de cinco consumidores/telefone aprovados
  (incluem revalidações dos testes de frete). Nenhum pedido real usado.
- [x] Lint dos arquivos alterados, lint:design (8 bases/321 consumidores), typecheck,
  diff e build webpack/Node 22 aprovados. Avisos preexistentes de middleware/Edge
  permanecem fora do escopo.
- [x] Prévia com dados e ações fictícios: limpar Número invalida o resultado;
  preencher Número recalcula sem confirmação e sem abrir diálogo. Desktop
  1440×900 e móvel 390×844, sem excesso horizontal. Evidências
  [desktop](evidencias/20261005-frete-automatico-desktop.png) e
  [móvel](evidencias/20261005-frete-automatico-mobile.png), **Em revisão visual**.
- [x] Smoke da aplicação compilada com banco/sessão fictícios: Entregas, Empresa,
  Produtos e Novo Pedido dedicado 200; acesso sem sessão e rota antiga 307.
- [x] Backup privado `<BACKUP_PRIVADO>`:
  59.525.729 bytes, 844 entradas, índice e leitura integral pg_restore aprovados
  sem executar SQL. SHA256 `13022d1faa0d20141435ab94846da23a3d682b1d964446c968a970c9fea7da2e`.
  Imagem anterior `sha256:c487131f3dbcf33ea16ae5f6e25616a51ae71ff13520275ff7daefc9fc6d792f`,
  fixada em `grazing-hub-reversao-entregas:20261005-frete-automatico`; fonte fiscal banco.

Sem schema/migration, alteração de cadastro comercial ou credenciais. Publicação
e estabilização serão registradas localmente após o envio, sem novo deploy somente
para evidência pós-publicação, conforme o ritual.

## Incremento vigente — 03/10/2026, slots e frete

Branch isolada `codex/entregas-slots-20261003`, base `4c4693a`; checkout original e trabalhos alheios preservados. Publicação autorizada pelo usuário. [Contrato vigente](SPEC.md), [operação](OPERACAO.md).

- [x] Entregas apenas em Configurações de Vendas & Pedidos; rota antiga redireciona.
- [x] Matriz Frete com preço por veículo, cobertura pela última faixa e colunas compactas à esquerda.
- [x] Migration aditiva/auditada: preços existentes → Moto; Carro R$24 até a primeira faixa, +R$3/km acima dela, conforme esclarecimento do usuário; preservação da configuração anterior.
- [x] Origem incorporada em Taxa de entrega; empresa por padrão ou origem personalizada. Endereço da empresa estruturado/aditivo, consulta postal compartilhada, salvamento explícito e invalidação de recibo quando origem muda.
- [x] Produtos com slots por unidade; veículos com capacidades inclusivas. Pedido calcula ocupação e veículo no servidor; simulador somente endereço e veículo.
- [x] Retirada de embalagem/padrão/máximo separado/exceções da configuração vigente; histórico e revisão de pedidos anteriores preservados.
- [x] QA sintético desktop 1440×900 e celular 390×844, CEP simulado e troca Moto → Carro pela ocupação. Fieldset com min-w-0 preserva rolagem interna; Save/Cancelar quebram na largura disponível. Veículo e frete têm eixos/alturas alinhados.
- [x] Validação C e backup privado íntegro.
- [x] Publicação inicial, migration e estabilização produtiva. Conferência final de apresentação histórica revalidada para integração.

### Validação e preparação desta revisão

- Prisma generate/validate aprovados; cadeia de migrations e transformação específica executadas em PostgreSQL exclusivo fictício `teste_entregas_slots_20261003`. Tabela de Moto preservada, Carro calculado, configuração anterior/auditoria/versionamento e slots inicialmente null conferidos.
- Global transversal após correção das dependências de CEP: **257 arquivos aprovados, 21 ignorados; 2205 testes aprovados, 250 skips, zero falhas** (703,25s). Opt-ins executados: ENTREGAS_BANCO_TESTE, PEDIDOS_BANCO_TESTE e VENDAS_BANCO_TESTE; demais integrações não habilitadas. A primeira execução carregou imports antigos e foi interrompida, sem tratá-la como resultado final.
- Consumidores finais: **73 testes** em cinco arquivos de pedido/frete/ações; **190 testes** de endereço da empresa, integração/compatibilidade e fronteiras de permissão; última alteração de cobertura sem exceção revalidada em **52 testes** (quatro arquivos). Revisão de pedido anterior à conversão conserva o snapshot; tentativa de ultrapassar a tabela com aprovação antiga é recusada transacionalmente no modelo novo.
- Lint global aprovado (arquivos temporários ignorados pela opção da CLI); lint:design **8 bases/316 consumidores**, typecheck integral, Prisma validate e build webpack/Node22 finais aprovados. Mantidos avisos preexistentes da convenção middleware/Edge; nenhuma migração de infraestrutura fora do escopo.
- Smoke compilado em loopback/banco/sessão fictícios: Entregas, Dados da empresa, Produtos e Novo Pedido dedicado **200**; Entregas sem sessão **307**; rota antiga autenticada **307** para `/vendas/area-entrega`. Host/Forwarded-Host coerentes com produção, sem relaxar proteção. Nenhuma gravação do smoke.
- Endereço da empresa também conferido no Chrome com fixtures: limites dos campos e grade sem excesso horizontal. Capturas CDP excederam o timeout; não registrar imagem produtiva ou de empresa como aprovada. As imagens abaixo são exclusivamente a prévia local de Entregas/frete/endereço compartilhado; navegador restaurado.
- Backup privado `<BACKUP_PRIVADO>`: **41.659.780 bytes**, **840 entradas**, índice e leitura integral pg_restore sem executar SQL aprovados. SHA256 `f991addced0d2c0e209a5235154202aa177225972907f34032145779f672e08d`. Fonte fiscal banco, configuração capturada sem segredos no código. Imagem anterior `sha256:e8b35369fbc41137ee94139c6e4abe751d2fe6cdeef7d600733d42911e119415`, fixada em `grazing-hub-reversao-entregas:20261003-slots`; não restaurar a imagem antiga cegamente, pois ela não entende a matriz nova.
- Conferência restrita de produção antes do envio: 54 faixas, versão3, automático inativo; chave privada ausente e adaptador Google desabilitado. Nenhuma contratação/ativação externa ou dado real usado para teste.

### Conferência produtiva e ajuste final

A implantação inicial de `ecbd2cc` ficou Running estável, sem reinícios: 94 migrations atualizadas, versão de Entregas 4 e modelo SLOTS. A leitura restrita confirmou a preservação da tabela anterior e a auditoria da transformação. Faixas e preços observados ficaram no registro privado. Capacidades, slots e endereço estruturado continuaram pendentes; Maps permaneceu desabilitado. Navegação autenticada no Chrome confirmou o menu em Vendas, colunas compactas e campos de veículos alinhados em altura44. Nenhuma escrita do smoke.

A última conferência corrige apenas apresentação histórica: pedido anterior com veículo escolhido explicitamente mostra o veículo registrado; pedido por slots mostra a ocupação do snapshot, mesmo que o catálogo atual difira. **53 testes em três arquivos**, lint focado, lint:design e build webpack/TypeScript aprovados após esta correção, sem novo schema/migration. A estabilização da revisão final será registrada após o envio, sem outro deploy apenas documental.

### Evidências visuais (somente dados fictícios; Em revisão)

[Frete desktop](evidencias/20261003-slots-frete-desktop.png) · [Frete móvel](evidencias/20261003-slots-frete-mobile.png) · [Veículos desktop](evidencias/20261003-slots-veiculos-desktop.png) · [Veículos móvel](evidencias/20261003-slots-veiculos-mobile.png) · [Simulador desktop](evidencias/20261003-slots-simulador-desktop.png) · [Simulador móvel](evidencias/20261003-slots-simulador-mobile.png).

A prévia usa componentes reais e ações/CEP sintéticos em `testes/visual/vite.entregas-slots.config.mts`. Nenhuma consulta Google, cliente ou pedido real usado. Capacidades, slots de produtos e endereço estruturado inicial permanecem pendentes de definição operacional; a publicação do software não ativa automaticamente mapas nem inventa esses valores.

## Histórico de incrementos anteriores

## Incremento solicitado em 01/10 — em execução

- [x] Proteção de caracteres/tamanho nos campos oficiais e limite em km; remover/excluir com X e hover vermelho em todos os consumidores.
- [x] A leitura autorizada do site foi registrada no arquivo privado. `frete-site-atual.json` conserva apenas um exemplo sintético do formato, sem credenciais. O WordPress não foi alterado.
- [x] Cadastro simples de embalagens em Composição de Produtos e seleção por item de pedido; veículos nomeados com perfil real de carro/moto e regras automáticas por embalagem/prioridade.
- [x] Testes, migration isolada e QA desktop/móvel.
- [ ] Importação auditada das regras autorizadas e publicação.

Base incorporada até `0fd0396`, checkout isolado `codex/entregas`; preservar formulário compacto, canais e pagamento comercial recém-publicados. Tipo de embalagem não implica consumo de estoque nem cadastro obrigatório de transportadora. Pedido sem regra aplicável usa o veículo padrão; prioridade resolve pedidos com caixas diferentes, sem presumir perfis de rota equivalentes. Implementação aditiva concluída; próximo: finalizar QA, incorporar o remoto, publicar e gravar a cópia comercial autorizada.

### Validação deste incremento

- Prisma generate/validate e migrations aplicadas no banco exclusivo `teste_entregas_20261001`; migration nova `20261001110000_entregas_embalagens_veiculos`. Nenhuma alteração de registros históricos.
- 43 testes focais iniciais aprovados. Revalidação final de consumidores: **229 aprovados, 7 skips** em 16 arquivos (um opt-in Design não habilitado). Inclui dinheiro/colagem, campos, UI, autorização e integração PostgreSQL de embalagens/veículos/recibo/revisão. Provedor simulado apenas nos testes; produção permanece sem credencial e nenhuma rota real validada.
- Global transversal: **1630 aprovados, 247 skips, 9 falhas**. Três regressões introduzidas (CPF, colagem R$, prelúdio da guarda) corrigidas e revalidadas; timeout de importação fria `aceitarNotaAction` passou na repetição isolada sem aumentar limite/desativar guarda. Duas falhas de Insumos continuam preexistentes. Três falhas de Perdas reproduzidas usando Input/Button originais de HEAD: fixtures de setembro não aparecem no filtro padrão de outubro. Não alterar esse módulo fora do escopo.
- Lint global, lint:design (274 consumidores), typecheck e build webpack aprovados; referências visuais continuam Em revisão.
- Navegador no banco fictício: cadastrar embalagem/veículo/regra → salvar composição do produto → simular seleção CARRO sem inventar distância → criar/confirmar pedido manual R$108 → revisar observações preservando frete/embalagem/veículo → consultar histórico v2→v3. Desktop e 390×844 sem excesso horizontal; [desktop](evidencias/20261001-embalagem-veiculo-desktop.png), [móvel](evidencias/20261001-embalagem-veiculo-mobile.png). Viewport restaurado. Nenhum pedido real criado.
- Backup privado `<BACKUP_PRIVADO>`: 13.122.778 bytes, 792 entradas, leitura completa pg_restore OK, SHA256 `4419d33ef43ba7c32ca1f8cf8c9d74dbdc58eda827b3c865ac96ef266deb71a9`. Fonte fiscal banco, ambiente/mount preservados. Imagem anterior `sha256:894e56ee996550a407aed658a9ce999fa3967f8333e9c49f51da244aa085b925`, tag local imutável `grazing-hub-reversao-entregas:20261001-caixas`.

- [x] Fase 0: contexto, Git e SPEC. Base `93ed64a`, checkout `.worktrees/entregas`; Pedidos publicado já contém snapshots, Decimal, revisão e Fornecedor reutilizável.
- [x] Fase 1: configuração versionada, permissões independentes e migration aditiva aplicada em PostgreSQL fictício exclusivo.
- [x] Fase 2: Google Routes/Geocoding, quotas atômicas, timeout/repetição, conteúdo geográfico transitório. Produção sem chave e adaptador desabilitado; integração real pendente.
- [x] Fase 3: motor único, centavos/Decimal, precedência e recibo assinado de 10 minutos vinculado às entradas.
- [x] Fase 4: configuração, exceções e simulador com primitives oficiais, salvamento explícito. Referência visual Em revisão.
- [x] Fase 5: confirmação/revisão existentes, retirada, contingência e custo nullable auditado; sem novos efeitos financeiros.
- [x] Fase 6: testes A/B/C e navegador isolado desktop/mobile; integração real Google pendente de credencial.
- [x] Fase 7: documentação, backup verificado, commit/push/Dokploy, migration e smoke autenticado sem escrita real. Software publicado; integração Google permanece pendente.

## Evidência até a revisão final

- Remoto incorporado até `53dfbd8`. Preservados Gestor dedicado, cliente inline, avisos de alterações, país, outros custos/cobrança, Horários ordenáveis e edição fiscal com componentes oficiais. Checkout original não editado.
- QA local autenticado, banco `teste_entregas_20261001`, somente fixtures: configurar origem/moto/limite/faixa/exceção CEP com zero inicial → simular pendência → confirmar pedido manual (100 + 8) → registrar custos (estimado 7, efetivo 6) → revisar frete para 9 → consultar antes/depois. Retirada simulada com zero sem mapas. Nenhum dado real usado.
- Desktop 1440×900 e móvel 390×844; sobreposição de abas corrigida. [Desktop](evidencias/desktop.png), [móvel](evidencias/mobile.png). Viewport restaurado. Não constitui homologação de leitor de tela ou Google real.
- Bateria global inicial: 1377 aprovados, 247 skips, 8 falhas. Cinco regressões de revisão legada corrigidas e revalidadas (integrações Pedidos M1/M2 aprovadas). Duas falhas preexistentes de Insumos procuram placeholder `Buscar insumo...`, mas a base `93ed64a` já usa `Insumo, marca, categoria ou fornecedor...`; arquivos não alterados. Parser PDF real excedeu 5s em importação fria (5,57s); repetição isolada com limite de 15s aprovada, sem alterar testes/configuração global.
- Lotes focais: 209 testes mais 27 consumidores/navegação/integração aprovados antes dos merges; 308 testes e revalidação de três arquivos/32 casos após integração e correção da revisão legada. Preparação SQL passou ao mesmo limite de 90s de Pedidos após exceder 30s sob concorrência, sem mudar asserções; ensaio final levou 45s. SDK assíncrono, país estrangeiro, outros custos e snapshot histórico cobertos. Prisma validate/generate e cadeia SQL aprovados. Provedor exercitado com mocks restritos aos testes; nenhuma rota Google real validada.

Validação final após os merges: typecheck integral aprovado; nove arquivos de consumidores/edição fiscal/Entregas passaram com 54 testes. Depois do cliente inline, seis arquivos com 57 cenários foram revalidados, incluindo sete casos do formulário novo (expectativa atualizada para o seletor de entrega/retirada exigido por Entregas). Lint global e lint dos últimos arquivos alterados aprovados; design 8 bases/267 consumidores; build Webpack/Node 22 final aprovado, incluindo TypeScript e 74 páginas estáticas. Smoke da aplicação compilada com sessão fictícia: Entregas, Novo Pedido dedicado, pedido com custo/histórico e termos 200; Entregas sem sessão 307. Cabeçalhos Host/Forwarded-Host coerentes com o proxy; sem reduzir proteções. Docker recebe somente a chave pública opcional na etapa de build; nenhuma credencial foi criada/configurada.

## Publicação concluída — 01/10/2026

- Commit implantado: `c3cddd1fbcd1b9d661ad55150d9d6b898c2cf518`, enviado por fast-forward a `main`, com remoto incorporado até `53dfbd8`. Checkout original preservado. Evidência pós-deploy registrada localmente, sem novo push apenas documental, conforme o ritual de publicação.
- Backup imediatamente anterior ao envio: `<BACKUP_PRIVADO>`, 13.010.643 bytes e 787 entradas. Índice e leitura integral por `pg_restore --file=/dev/null` aprovados, sem executar SQL. SHA-256 `cd013e184609de2fb4b047b9d3ce3b5bfa4bf7c3f3329c7c403f585d7833cbf2`. Imagem anterior fixada em `grazing-hub-reversao-entregas:20261001-envio`, ID `sha256:ad2f125cf1683d0faf7be58d1ee16fe087452b9a387e9e0eb644dc6c9d50ffbe`. Backups anteriores privados preservados; não restaurar sobre transações posteriores.
- Dokploy: build aprovado; tarefa `kfqos0pyi3r8w7bkyu1kabr4m`, contêiner `53c405f8fbaf`, imagem `sha256:690e226d724464499b67ddeb2a105ed114848f13a0420188aa8f9acf583d2f3d`, início `2026-10-01T04:10:46Z`. Confirmada Running por mais de três minutos, zero reinícios e zero sinais de erro recentes. Instância antiga substituída. Configuração fiscal conferida e preservada integralmente pelo auxiliar existente, sem consulta externa.
- `prisma migrate status`: 80 migrations, banco atualizado. `20261001010000_entregas_rota` concluída, sem pendências; página de Entregas presente no build. Flags de teste ausentes em produção.
- Smoke HTTPS: Entregas/Pedidos sem sessão redirecionam ao login; com sessão, Entregas, lista, Novo Pedido e detalhe existente com custo/histórico retornam 200. Termos e privacidade públicos 200. Contagens de pedidos, histórico de cadastro e uso de mapas iguais antes/depois: nenhuma escrita do smoke.
- Navegador autenticado: cinco abas de Entregas, faixas/exceções vazias e regras opcionais desativadas; integração explicitamente pendente, cálculo automático inativo. Novo Pedido preserva cliente inline, outros custos e o vínculo ao HUB; seletor Entrega/Retirada disponível, retirada mostra frete zero sem mapas. Nenhum cliente, pedido, custo ou configuração produtiva gravado. Conferida navegação móvel a 390×844 e viewport restaurado. Captura PNG de produção excedeu o timeout do navegador; evidências visuais anexadas acima continuam sendo exclusivamente locais/fictícias.
- Pendências operacionais: chave privada Google e habilitação do adaptador ausentes; chave pública visual opcional depende do build. Nenhuma contratação, cobrança externa ou credencial criada. Veículo, limite, faixas e regras comerciais precisam ser definidos pelo operador. Rota real ainda não validada. [Configuração e operação](OPERACAO.md).


## Correção: cálculo com produtos e endereço — 05/10/2026

- Causa reproduzida no servidor: a ação de frete chamava `calcularPedido`, aplicando exigências de confirmação/cadastro e rejeitando complemento vazio. A interface também exigia cliente salvo, canal e destinatário.
- Ação autenticada agora usa a projeção e consulta somente leitura de `pedidos-frete.ts`. Preço, escolhas e slots vêm do catálogo; sem consulta de CMV/composição, agenda, cobrança ou pagamento. A confirmação conserva suas regras. Entrega pode ser preenchida antes da escolha do tipo de cliente; dados cadastrais continuam condicionados ao tipo.
- Complemento opcional em cobrança e entrega, em Clientes/Novo Pedido e validações do servidor. Componente compartilhado mantém máscara de CEP, autopreenchimento, bloqueios brasileiros e limite de 160 caracteres.
- Recibo sem cliente pode acompanhar seu posterior cadastro/seleção sem nova rota, com usuário/endereço/subtotal/logística/versão iguais. Recibo de cliente identificado continua recusado para outro; adulteração, vencimento e alterações continuam rejeitados.
- Validação A/B: 220 execuções aprovadas em lotes focados (inclui repetição de 30 casos após liberar a entrega e tornar complemento opcional). Onze casos de integração PostgreSQL passaram no banco local exclusivo `teste_frete_minimo_20261005_utf8`, com schema descartável e provedor fictício. Inclui calcular sem cadastro/pagamento, completar orçamento e confirmar com os dois complementos vazios. Primeiro ensaio do banco interrompido pela codificação WIN1252 do template local; novo banco UTF-8 resolveu sem alterar migrations.
- UI desktop 1280×1100 e móvel 390×844, sem extravasar a largura da página; frete fictício R$22 calculado automaticamente sem cadastro, canal, destinatário, agenda ou escolha obrigatória concluída. [Desktop](evidencias/20261005-frete-minimo-desktop.png), [móvel](evidencias/20261005-frete-minimo-mobile.png). Reutilizados CamposEnderecoPedido, CampoEntrega, EscolhaEntrega, Input, CurrencyInput e Button; nenhum padrão novo. Referências visuais Em revisão; viewport restaurado.
- Lint do código publicável e configurações aprovado; lint:design: 8 bases/320 consumidores. Lint sem escopo alcançou cópias e auxiliares `.tmp*` ignorados; estes não fazem parte da publicação e foram excluídos da verificação do código publicável. Nenhum erro de fonte foi ocultado.
- Backup privado `etiquetas-frete-produtos-endereco-20261005-a`: 59.522.285 bytes, catálogo e conteúdo integral pg_restore conferidos; SHA256 `9993f8990b40c367cfad070c48cee293f7cd957def9560dbf1b31f9454e5eea0`. Sem alteração de schema e sem operar dados reais para testar.
- Nível C: typecheck integral e build webpack/Node 22 aprovados. Smoke da versão compilada: login 200; Novo Pedido, Clientes, Entregas, Produtos e Central protegidos com 307 para login. Sem nova migration. Publicação autorizada; estabilização pós-deploy será registrada separadamente.
