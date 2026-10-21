# Permissões do Atendimento — 21/10/2026

Capturas consultivas **Em revisão**. Não são referências aprovadas.

A prévia usa a matriz real, os tokens atuais, `Button`, `Checkbox` e `GrupoAcoes` oficiais. Os perfis, as permissões e os callbacks são fictícios. Não há acesso a contas, APIs ou bancos.

O contrato visual passou em 24 testes: 320, 390, 768 e 1440 CSS px, nos temas claro e escuro. Foram capturados os estados de perfil, personalização, bloqueio durante salvamento, vazio e erro. A execução não registrou chamadas externas, erros de página ou problemas no auditor oficial de interface.

As seis imagens desta pasta foram inspecionadas. Elas mostram a hierarquia módulo → seção → recurso, as quatro colunas alinhadas, as operações indisponíveis, os vetos personalizados e os controles bloqueados. Os grupos recolhem por teclado; a edição por espaço, a seleção em lote por seção e a restauração do perfil foram testadas. Recolher e reabrir uma seção preserva as alterações. Os controles dos recursos são montados somente na seção aberta.

`evidencias.json` registra dimensões, hashes e fontes do working tree. A base Git é apenas a origem anterior à mudança. Os hashes identificam a implementação capturada. A prévia não substitui a conferência publicada, a aprovação humana, o ambiente Linux oficial ou uma avaliação completa de acessibilidade.

Comando do consumidor: `npx playwright test --config testes/visual/permissoes-atendimento.playwright.config.ts`.
