# Capturas para revisão — Fiscal unificado

**Em revisão.** Dados, empresa, certificado, produtos e números são sintéticos.
Nenhuma captura comprova conexão externa ou autorização da SEFAZ. Não há informações
reais de clientes, receitas, credenciais ou documentos neste diretório.

Os componentes de produção são renderizados pela prévia isolada
`testes/visual/fiscal-unificado.tsx`. As ações usam estado fictício em memória e
as requisições externas são bloqueadas. A suíte confere quatro larguras e dois temas.
Estas imagens selecionam 1.440 px e 390 px para uma única revisão consolidada.

| Tela | Desktop | Celular |
| --- | --- | --- |
| Produto: campos fiscais | [Claro](produto-1440-claro.png) · [Escuro](produto-1440-escuro.png) | [Claro](produto-390-claro.png) · [Escuro](produto-390-escuro.png) |
| Grupos: cartões e editor | [Claro](grupos-1440-claro.png) | [Claro](grupos-390-claro.png) |
| Vínculos: tabela anterior | [Claro](vinculos-1440-claro.png) | [Claro](vinculos-390-claro.png) |
| Configurações centralizadas | [Claro](configuracoes-1440-claro.png) | [Claro](configuracoes-390-claro.png) |
| Salvamento na própria tela | [Claro](aplicacao-1440-claro.png) | [Claro](aplicacao-390-claro.png) |
| Kit com linhas explícitas por componente | [Claro](kit-1440-claro.png) | [Claro](kit-390-claro.png) |

Detalhes: [Empresa no celular](secao-empresa-390.png),
[certificado no desktop](secao-certificado-1440.png) e
[séries e numeração no celular](secao-numeracao-390.png).
São capturas diretas do navegador, sem edição de pixels. A altura da janela é maior
nos detalhes para evitar sobreposição do cabeçalho fixo. A numeração mostrada é fictícia.

As telas retomam os campos, cartões e tabela existentes. Salvar aplica a configuração
na própria tela; não há etapa de rascunho ou segunda aprovação na operação normal.

As evidências não foram promovidas a referência aprovada do Design System.
O histórico e os resultados exatos estão em [TASKS](../TASKS.md).
