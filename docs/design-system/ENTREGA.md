# Central de Design e Experiência — entrega

23/09/2026. **Etapas 0–7 executadas; etapa 8 em fechamento com pendências manuais.**
Desenvolvimento no checkout `codex/manifesto-nfs-publicacao`, base `1b690dc`.
Após a entrega local, o usuário autorizou publicação e a rota canônica recomendada
para Etiquetas. As seções abaixo distinguem a validação inicial e a publicação atual.

## Incremento autorizado de publicação

- Entrada dedicada mantém `etiquetas.grazinghub.com.br`, usando `/producao/etiquetas`
  na barra de endereço. Raiz encaminha com 307, preserva filtros e não afrouxa segurança.
- Melhorias remotas `f8de6c9`/`8cb5308` preservadas, incluindo composição de montagem,
  disponibilidade derivada do preço e seletor de grupos contido no diálogo.
- Regressão integrada: 456 testes passaram; 19 opt-in ignorados. Lint, tipos, Prisma,
  detector de padrões e build Node 22 passaram. HTTP final 7/7: bloqueio técnico resolvido.
  Resultado do deploy será registrado em VALIDACAO após conferir a publicação.
- Não há migration nova comparada ao main de produção: as 63 existentes já aplicadas.
  Backup privado e imagem anterior preservados no servidor; detalhes em VALIDACAO.
- A publicação do código não homologa referências visuais nem altera o tema publicado
  pelo usuário. Zoom 200%, movimento reduzido e hardware seguem na lista manual.

## O que foi implementado

Evolução da aplicação existente, não outra biblioteca/sistema. A Central em
`/configuracoes/design` tem categorias, demonstração real isolada e ajustes contextuais,
20 padrões pesquisáveis, componente/contexto, cenários, reinício e comparação. O menu
mantém os grupos na mesma lateral do HUB. HUB azul e Etiquetas laranja compartilham
geometria, tipografia, vidro e componentes; a prévia não altera o documento da Central.

- Ações compactas editar/excluir, status binário com confirmação, edição inline explícita,
  barras de ações, slots por largura útil e ordenação acessível são compartilhados.
- Cadastros/processos das 38 rotas protegidas foram inventariados por família e migrados
  nos contratos cabíveis; não são 38 fluxos visualmente homologados. Ver inventário.
- Vendas conserva fiscal direto, preços por canal, precisão/porções/composição e fichas.
  Demais famílias preservam suas guardas, dados e estados de processo.
- Registro fechado de tokens; rascunho, revisão, publicação/versões imutáveis, auditoria,
  restauração como nova versão, concorrência, idempotência e validação de contraste.
- Revalidação administrativa no servidor/transação. Layout tem fallback de fábrica;
  clientes avisam quando há versão nova sem recarregar formulário preenchido silenciosamente.
- Detector de desvios, testes de regressão e comparação reproduzível de imagens.

Todos os padrões ficam **Em revisão** até aprovação humana. “Publicar” na Central publica
configuração visual no banco daquele ambiente; não publica código nem valida regras de negócio.
Somente propriedades do registro podem mudar no painel, sem CSS/JavaScript livre.

## Como usar

1. Entre como administrador e abra Configurações → Central de Design.
2. Pesquise a intenção (por exemplo: lápis, editar preço, abrir box, multiseleção).
3. Experimente identidades, estados e propriedades. São dados sintéticos dentro da prévia.
4. Compare com o publicado; salve o rascunho. Revise diferenças, escopo e motivo antes de
   confirmar publicação. Conflito com outra revisão exige revisar e salvar novamente.
5. Para desfazer uma configuração, abra Histórico → Revisar restauração. Isso cria outra
   versão auditada e preserva rascunhos, que precisarão ser reconciliados com a nova base.

## Mapa de alterações

| Área | Fontes principais |
| --- | --- |
| Contratos compartilhados | `src/components/padroes-operacionais.tsx`, `lista-ordenavel.tsx`, `status-ativo.tsx`, `ui/button.tsx`, `ui/checkbox.tsx`, `src/app/globals.css` |
| Central e laboratório | `src/components/design-system/*`, `src/lib/design-system/{grupos,registro,previa,validacao,servico}.ts`, actions existentes de design |
| Vendas | status-cadastro (UI/domínio), persistência, produtos/preço, catálogo, clientes, fiscal, formas de pagamento |
| Demais consumidores | compras, notas-fiscais, financeiro, fornecedores, insumos/preparações, inventário, usuários/empresa/perfil, produção/etiquetas e entradas |
| Proteção | `scripts/{regras-design,verificar-tokens-design,comparar-design}.mjs`, `AGENTS.md`, contratos e testes em `testes/` |
| Evidência | `docs/design-system/{EXECUCAO,VALIDACAO,inventario,padroes}.md`, `evidencias/2026-09-22/`, prévias sintéticas em `testes/visual/` |

`git diff` cobre os rastreados; `git status --short` também lista novos componentes/testes.
O registro inicial em EXECUCAO identifica o trabalho preexistente que não pertence a esta
entrega (catálogo iFood, `.worktrees`, prompt, log e `docs/execucao-vendas.md`). Não incluí-lo
automaticamente num commit desta implementação. Nenhum schema/migration/package foi alterado.

## Validação inicial e limites (histórico; incremento acima prevalece)

Resultados detalhados, falhas e retestes em [VALIDACAO.md](VALIDACAO.md). Banco descartável
exclusivo em loopback; nenhum dado de produção. Testes de SEFAZ/SMTP simulam transportes.

- Prisma validate/generate, TypeScript, ESLint dos arquivos alterados e lint:design passaram.
- Execução ampla: 1.235 passaram; dois timeouts de 5s em Notas. Reteste dos dois e Central:
  20/20; rodada final direcionada 67/67, sete integrações não habilitadas nessa repetição
  já tinham passado na execução ampla. Não esconder o resultado não verde inicial.
- Build final passou. HTTP final: cinco passaram e um falhou. O POST na raiz reescrita
  de Etiquetas recebe 421; o mesmo POST pela rota canônica respeita a sessão e passa.
  Reproduzido em Node 24.19/22.23.2; não liberar publicação com essa falha pendente.
- Matriz examinada em 1440/1280/768/390/320px, claro/escuro, HUB/Etiquetas, conteúdo longo,
  erro, foco, seleção e diálogos; capturas não equivalem a certificação de acessibilidade.
- 200% nativo e preferência real de movimento reduzido permanecem pendências de ambiente:
  a ferramenta disponível não aplicou zoom nem expõe emulação dessa preferência. Não
  substituir essas provas por mudança de largura ou edição artificial do DOM.
- Sem validação de impressora/Zebra/Raspberry, impressão física, Linux/Docker, DNS, TLS ou
  produção. Há avisos preexistentes de middleware depreciado e APIs Node no Edge (Next/jose).
- RH, CRM e Patrimônio continuam como entradas indisponíveis; ZPL/impressão, estados de
  domínio e rolagem interna de tabelas têm exceções delimitadas no inventário.

## Procedimento de publicação — autorizado em 23/09/2026

1. Revisar o diff, as pendências visuais e os arquivos preexistentes. Testar zoom 200%,
   movimento reduzido e teclado no navegador real dos operadores. Homologar referências.
   Resolver primeiro o encaminhamento HTTP com validação completa; não reduzir guardas.
2. Confirmar ambiente alvo/backup e comparar migrations existentes com o banco de destino.
   **Esta tarefa não criou migration**, mas o Dockerfile inicia com `prisma migrate deploy`:
   migrations antigas da branch ainda não publicadas podem ser aplicadas automaticamente.
   Se houver qualquer migration pendente, revisar SQL e fazer backup antes de autorizar.
3. Reproduzir build/testes no ambiente de deploy (Docker usa Node 22; validação local usou
   Node 24). Prisma local requer `--config prisma7.config.ts`; conferir resolução dessa
   configuração no pipeline existente, sem trocar credenciais nem desabilitar verificações.
4. O procedimento de CONTEXTO usa push para `main`, que **dispara o webhook do Dokploy**.
   Não executar push como simples “salvamento”. Separar/revisar o commit da tarefa antes.
5. No deploy autorizado, acompanhar o serviço `app-copy-auxiliary-microchip-9hhwdm` até
   ficar estável. Preservar o certificado cadastrado no banco, fonte prioritária confirmada
   antes do deploy. Não inventar fallback env/mount: ele já estava ausente no contêiner.
   Se necessário no futuro, senha somente pelo secret do Dokploy, nunca em documentação.
6. Conferir migrations, login/guardas, Central, cadastros e ambos os acessos de Etiquetas.
   Não exigir nem realizar operação fiscal/financeira ou impressão física como smoke cego.
   Não há nova variável, domínio, cookie, banco ou cadastro paralelo requerido por esta tarefa.

## Reversão

- **Configuração visual:** restaurar versão pela própria Central, com motivo. É auditada e
  não apaga histórico. Conferir o aviso de atualização e só então aplicar no cliente.
- **Código:** manter a imagem/revisão anterior conhecida do Dokploy e reimplantar aquela
  versão pelo procedimento aprovado. Não usar reset destrutivo nem reverter banco em massa.
- O conteúdo novo usa schema visual 2; o leitor atual aceita 1/2. Código antigo pode cair
  no tema de fábrica diante de conteúdo incompatível: validar isso em homologação antes
  de voltar. Restaurar pelo código novo cria outra versão schema 2, não converte para 1.
  Não reescrever JSON/histórico via SQL improvisado para forçar compatibilidade.
- Se o deploy incluiu migrations preexistentes, rollback de imagem NÃO desfaz schema.
  Avaliar compatibilidade e plano específico; backup não é autorização para apagar dados.

## Retomada da entrega inicial (histórico)

Decisão necessária antes de alterar o roteamento: manter `/` com outra solução segura de
encaminhamento, ou adotar `/producao/etiquetas` no MESMO hostname dedicado, evitando o salto
que falhou no teste. A alternativa canônica tem menor alteração de segurança, mas muda a
URL visível. Não foi implementada sem essa decisão. Não redirecionar ao sistema principal.

Consultar EXECUCAO e a última seção de VALIDACAO. A etapa 8 só poderá ser declarada
integralmente concluída depois do HTTP passar e das verificações de ambiente pendentes.
Nenhuma pendência autoriza produção, push ou acesso a dados operacionais.
