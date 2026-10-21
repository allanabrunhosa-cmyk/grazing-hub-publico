# Cancelar com cor neutra — 13/10/2026

O pedido mais recente substitui o vermelho do botão Cancelar pela cor neutra. O HUB reutiliza `Button variant="outline"`. `data-acao="cancelar"` aplica o mesmo fundo, borda, texto e hover neutros a `DialogClose` e aos consumidores existentes. Os tokens acompanham os temas claro e escuro.

O catálogo tipado e a demonstração de Botões incluem Cancelar edição. A referência visual permanece Em revisão. Excluir conserva o X com fundo pastel. A confirmação de cancelamento operacional conserva a variante do domínio.

## Validação

3.609 testes passaram; 730 testes condicionados ao ambiente não executaram. Lint global, lint de Design System, tipos e build passaram. O verificador visual manteve os 98 desvios históricos, sem desvio novo.

126 contratos de navegador passaram em 320/1440 px com ponteiro fino e 390 px com toque, nos temas claro e escuro. Cobrem os estados normal, longo, salvando, erro e vazio, além de cor, hover, foco, teclado, geometria e isolamento. O laboratório identifica a confirmação operacional por Confirmar cancelamento e verifica Cancelar edição pelo token neutro.

40 cenários de capturas passaram em 320/390/768/1440 px, claro e escuro. As imagens de ações foram inspecionadas nas oito combinações. Cancelar tem texto legível e fundo neutro. A auditoria renderizada não apontou desvios. Capturas locais são consultivas: nenhum baseline foi aprovado ou substituído. O lint de referências passou; o registro permanece sem referência aprovada.

Publicação ainda não executada.
