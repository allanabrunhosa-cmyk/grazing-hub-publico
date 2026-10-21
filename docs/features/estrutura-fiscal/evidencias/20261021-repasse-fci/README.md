# Repasse de FCI — Em revisão visual

Capturas da prévia isolada. Produtos, documentos, controles e provas são fictícios.

- [Desktop, 1440 px, tema claro](desktop.png).
- [Mobile, 390 px, tema escuro](mobile.png).

`fiscal-fci-fornecedor.spec.ts` passou em 320, 390, 768 e 1440 px, nos dois temas.
Verificou controle, compatibilidade 55/65, ausência de campos de CI própria,
contenção horizontal e revisão explícita. A regressão de origem nacional também
passou nas oito combinações de largura e tema.

O cartão reutiliza Card, Badge e Button do HUB. A edição mantém a rolagem interna
e as ações do formulário existente. As imagens foram inspecionadas. Não houve
aprovação humana de baseline nem homologação externa de emissão.
