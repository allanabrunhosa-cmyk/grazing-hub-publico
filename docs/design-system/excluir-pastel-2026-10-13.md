# Exclusão pastel — 13/10/2026

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Resultado

`Button excluir` e `BotaoRemoverItem` usam X vermelho e fundo pastel fixo. O hover intensifica o fundo. A composição usa a cor semântica de exclusão e neutros, mantendo o matiz vermelho nos dois temas.

`Button excluir-discreto` / `BotaoRemoverItem discreto` oferecem X cinza e fundo transparente para fotos e pequenas seleções. Aplicado nas fotos de Insumos e Produtos e nas tags do seletor múltiplo. Fechar janelas conserva a ação secundária. Cancelar conserva o vermelho fixo. Confirmações, permissões, auditoria e gravação explícita permanecem iguais.

Componentes, catálogo tipado, demonstração, manual e skill foram atualizados. A variante permanece Em revisão visual. Nenhuma referência foi aprovada ou substituída.

## Validação

- Bateria geral: 3.605 testes passaram; 730 ficaram condicionados ao ambiente. Uma expectativa antiga de `remover-item` falhou após a introdução de `remover-discreto` nas tags. A expectativa foi corrigida sem remover as verificações de acessibilidade, exclusão e não submissão do formulário.
- Reexecução dos componentes e Design System: 157 testes passaram; sete ficaram condicionados ao ambiente. Inclui o consumidor ajustado e a confirmação de exclusão em Insumos.
- Lint, tipos e build passaram. `lint:design`: 375 consumidores; 98 desvios históricos; nenhum novo.
- Prévia com dados fictícios. Botão pastel e X cinza conferidos nos dois temas. Tema escuro capturado em 320/390/768/1440 CSS px, sem overflow horizontal. O diagnóstico DOM não apontou problemas.
- Algumas capturas adicionais do tema claro tiveram timeout no navegador. O fundo e o ícone foram conferidos pelo estilo calculado; não há comparação de pixels aprovada.

## Publicação

Publicado em 13/10/2026 às 21h30 BRT. Revisão funcional ab451e6b4403bd58d61b6bf2e937f1e859d13354. Contêiner 3baab1aff534, imagem sha256:b4961bf43bf52a357b76b0e5d1214b0346b2717314948a0b7b3a5efd5346118d. Tarefa Running estável por mais de dois minutos, zero reinícios. Ambiente SHA-256 0daccabdd419cb72ebd1c31f5b60b13133d0f280c7a795fe7cf058707d88e703 preservado.

Prisma migrate status confirmou banco atualizado. HTTPS respondeu 200. Central de Design autenticada confirmou X vermelho com fundo pastel e foto com X cinza/fundo transparente na demonstração publicada. Nenhuma ação de remover dados foi executada para teste. Sem schema novo ou restauração de banco. Imagem anterior preservada em `grazing-hub-retorno:excluir-pastel-20261013`. Configuração privada preservada em `<BACKUP_PRIVADO>`. O retorno troca código e não restaura banco.

Atendimento possui publicação separada no repositório `atendimento-grazing`. O popup de templates e o som pertencem àquela publicação.
