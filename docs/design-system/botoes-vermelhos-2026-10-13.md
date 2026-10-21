# Excluir e cancelar — 13/10/2026

Padrão solicitado pelo usuário: botões de excluir/remover e cancelar ficam vermelhos em repouso, com efeito no hover.

`Button` mantém o X e o nome acessível nas remoções. Cancelar conserva texto ou ícone, tamanho, confirmação e estado desabilitado. `DialogClose` identifica o comando Cancelar. O X de fechar permanece uma ação de navegação. Confirmações comerciais existentes mantêm sua semântica.

O estilo usa `--destructive`. O catálogo da Central, AGENTS e a skill local de qualidade visual foram alinhados. Não há nova variante, token ou aprovação de baseline visual. Referências continuam Em revisão.

Validação:

- 3.605 testes passaram; 730 foram ignorados por suas condições de ambiente.
- A bateria usou dois workers e limite de 15 segundos por caso. Interações longas de formulários passaram isoladamente. Testes de seletores aguardam a montagem assíncrona das opções, mantendo as asserções.
- Lint, lint:design, tipos e build webpack passaram. O guard visual mantém 98 desvios históricos e zero novos.
- Prévia isolada da Central confirmou fundo vermelho fixo, contraste, X oficial e Cancelar em diálogo, sem operações reais.
- Imagem e configuração anteriores foram preservadas em backup privado na VPS. Não há alteração de banco neste incremento.

Publicado em 13/10/2026 pela revisão funcional `5d2177ba4f53b0e3d80a9cc661b286fe13f033cf`. Nova imagem `sha256:9a2b3d1e2303ea5694820f0a78950cc087e28a7c5cc800a5ad1b295550138ce8`. Tarefa em execução desde 19h53 BRT, sem reinícios. HTTPS 200, migrations atualizadas e configuração preservada. A sessão autenticada confirmou o X com fundo vermelho fixo na Central de Design.

O Atendimento recebeu o mesmo padrão pela origem independente `atendimento-grazing`, revisão funcional `26fb2cbabe14e12aa9a324d6b19f7a07aa595d2b`. Este registro pós-publicação permanece na branch de entrega; não gera novo deploy apenas para documentação.
