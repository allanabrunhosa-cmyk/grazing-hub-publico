# Classificação nacional — Em revisão

Capturas consultivas da prévia isolada, com produto e evidências fictícios.
Nenhum dado operacional ou documento real foi usado.

- [Desktop, 1440 px, tema claro](desktop.png).
- [Mobile, 390 px, tema escuro](mobile.png).

O teste `fiscal-origem-nacional.spec.ts` passou nas larguras 320, 390, 768 e
1440 px, nos dois temas. Verificou origem 0, SEM GTIN, ausência do atalho antigo,
presença do atalho apenas sem origem, fechamento por Escape e botão, contenção
e retorno de foco. A auditoria parcial de interface não encontrou problemas.

As imagens foram inspecionadas. O editor mantém seus componentes e sua rolagem
interna. Os campos longos conservam o texto integral no controle. O estado novo
remove somente a oferta da instrução antiga. Não houve aprovação humana de
referência, atualização de baseline ou certificação de acessibilidade.
