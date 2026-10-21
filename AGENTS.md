<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Grazing HUB — roteador de trabalho

## Regras globais

- Trabalhar em português. Preservar alterações alheias; conferir branch/status antes de editar.
- Não alterar comportamento fora do pedido, nem operar dados reais para testar.
- Autorização deve existir no servidor; manter precisão, transações, auditoria e idempotência.
- Migrations são SQL manuais/aditivas; nunca migrate dev, db push ou editar migrations aplicadas.
- UI reutiliza componentes/tokens existentes; edição comercial não salva ao perder foco.
- Ao criar, alterar ou revisar UI, use [$grazing-qualidade-visual](.agents/skills/grazing-qualidade-visual/SKILL.md) antes de editar; indique o consumidor de referência e conclua com lint:design, testes e evidência visual isolada. Preserve telas aprovadas; siga a matriz de intenções do manual, sem cores locais por tela.
- UI executa os contratos Playwright pertinentes e registra capturas conforme [proteção visual](docs/design-system/protecao-visual-automatizada.md). Comparações só bloqueiam com referência aprovada no ambiente correspondente; não atualizar screenshots/baselines para passar testes nem aprovar referências em nome do usuário.
- Campos devem limitar tamanho e caracteres conforme o domínio, incluindo digitação/colagem e validação no servidor. Campos numéricos não aceitam letras; reutilizar a proteção da Central e declarar precisão/máscara quando necessária.
- Toda ação de remover/excluir usa apenas o ícone X, vermelho pastel fixo com efeito no hover, com nome acessível. Fechar janelas e remover fotos ou pequenos itens podem usar apenas X cinza. Reutilizar o botão oficial; preservar confirmação, permissões e auditoria da operação.
- Não publicar segredos, dados pessoais reais ou logs sensíveis. Não inventar resultado de teste.

## Contexto mínimo

Escolha **somente** os guias relacionados. CONTEXTO.md é índice, não leitura prévia obrigatória.

| Se a tarefa altera… | Leia |
| --- | --- |
| Movimentações, DRE, caixa, cartões, extrato | [Financeiro](docs/modulos/financeiro.md) |
| Estoque, perdas, contagem, entrada avulsa | [Estoque](docs/modulos/estoque.md) |
| Insumos, preparações e conversões | [Insumos](docs/modulos/insumos.md) |
| Pedidos e recebimentos | [Compras](docs/modulos/compras.md) |
| Catálogo e composição comercial | [Vendas](docs/modulos/vendas.md) |
| Etiquetas, validades e impressora | [Produção](docs/modulos/producao.md) |
| NF-e/NFS-e, custos fiscais, SEFAZ | [Fiscal](docs/modulos/fiscal.md) |
| Fornecedores, beneficiários e Configurações | [Cadastros](docs/modulos/cadastros.md) |
| Sessão, host, acesso ou usuários | [Autenticação/permissões](docs/contexto/autenticacao-permissoes.md) |
| Prisma, schema, transação ou migration | [Banco](docs/contexto/banco-de-dados.md) |
| Interface ou Central de Design | [Índice visual](docs/design-system/README.md), seções pertinentes de padrões/inventário |
| Infraestrutura ou publicação | [Deploy](docs/contexto/deploy.md) |
| Git, branches, sincronização ou fechamento de tarefa | [Versionamento](docs/contexto/versionamento.md) |
| Estrutura transversal desconhecida | [Arquitetura](docs/contexto/arquitetura.md) |

## Fluxo e eficiência

1. Siga [Versionamento](docs/contexto/versionamento.md), confira estado Git e guia do domínio; use os caminhos do mapa.
2. Faça busca localizada com rg. Arquivo grande: títulos/símbolo e trecho pertinente primeiro.
   Expanda somente diante de evidência; não leia todos os módulos para uma mudança localizada.
3. Não releia conteúdo já suficientemente analisado sem mudança, lacuna ou dúvida concreta.
   Instruções/skills de leitura integral continuam obrigatórias.
4. Prefira saída resumida. Guarde log extenso em arquivo temporário apropriado, sem secrets;
   inspecione resumo/erros. Não despeje logs/minificados/schema completos no contexto.
5. Implemente incrementalmente, sem tarefas concorrentes nos mesmos arquivos.
6. Valide pelo [nível adequado](docs/contexto/testes.md): A focado durante desenvolvimento;
   B domínio/integrações ao concluir; C bateria necessária, lint, typecheck, build e smoke
   antes de publicar código. Não repetir regressão global após cada pequena alteração.
   Mudanças documentais puras validam documentação/diff, sem build ou banco desnecessários.
7. UI: lint:design, testes dos consumidores e imagens em ambiente isolado. Reutilizar ui,
   status-ativo, padroes-operacionais e lista-ordenavel; variante nova vai ao catálogo tipado.
   Referências novas permanecem Em revisão até aprovação humana.
8. Descoberta arquitetural reutilizável: confirme no código/testes e atualize o documento
   dono do assunto, com caminhos e cuidados; não replique regras nem histórico em AGENTS.
9. Feature extensa usa [SPEC/TASKS](docs/features/README.md) ou registro equivalente existente.
   Retomada da Central: [EXECUCAO](docs/design-system/EXECUCAO.md). Não duplicar progresso.
10. Entregue resultado, validações e pendências reais. Não confundir simulação, deploy e
    homologação externa. Consulte o ritual antes de publicar; pedido de não publicar prevalece.

[Índice completo](docs/README.md) · [Manutenção da documentação](docs/contexto/documentacao.md).
