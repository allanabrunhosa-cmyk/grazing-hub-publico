# Produto preparado e kit explícito — 22/10/2026

A aba Fiscal tem o seletor **Representação na nota**:

- **Preparação · somente o produto**: uma linha do produto final. Ingredientes permanecem na ficha técnica.
- **Mercadoria · somente o produto**: uma linha da mercadoria, com sua classificação própria.
- **Kit · discriminar componentes**: o responsável escolhe mercadorias, quantidades e valores para rateio na mesma tela.

O nome “cesta” ou “kit” não define o tratamento na auditoria. A receita não preenche
os componentes do kit. A escolha explícita e o botão Salvar usam os serviços
versionados existentes, com permissão administrativa, concorrência, vigência e auditoria.

Ao corrigir um agrupador para produto, os campos anteriores do próprio produto são
mostrados para edição. Salvar adota esses valores na estrutura canônica. A emissão
não lê um fallback comercial nem copia NCM ou impostos de ingredientes.

Kits reais mantêm a fotografia dos componentes vendidos. Sua composição deve ser
definida antes de fechar a operação. A correção para preparação muda apenas a versão
vigente: pedido, estoque, financeiro, notas recebidas, documentos, respostas incertas
e snapshots anteriores ficam preservados. Uma futura emissão recalcula sua prévia.

Não há migration ou dependência nova. O motor de expansão já distinguia NORMAL de
KIT_COMPOSTO; a falha investigada estava na representação atribuída ao produto.

## Validação executada

- Node 22.23.3; PostgreSQL 17 local isolado.
- 103 testes iniciais de interface, auditoria, motor e fotografia de kit passaram.
- Dez testes finais de interface passaram, incluindo a manutenção da seção aberta ao adicionar componentes.
- O teste SQL novo verificou a escolha explícita de kit e a correção para uma linha 55/65, com NCM, quantidade, frete e total do produto. Preservou a regra da fruta, o pedido e a tentativa incerta.
- A regressão ampla teve 2.522 testes aprovados, 243 ignorados, duas falhas de teste e uma falha de fixture. Ela não é apresentada como execução integralmente aprovada.
- As três suítes afetadas foram revalidadas: 38 testes passaram. A fixture nova passou a limpar seus próprios documentos; a de FCI passou a usar o helper oficial de integração isolada do Atendimento. O teste de interface de permissões passou novamente sem ampliar o timeout.
- Lint, lint de design (434 arquivos, zero desvios novos), typecheck e build passaram.
- Matriz visual final: 24 cenários em 320/390/768/1440 px, claro/escuro, rede externa bloqueada e auditoria DOM sem problemas. A primeira execução detectou o fechamento da seção ao adicionar um componente; o comportamento foi corrigido e revalidado.

[Kit desktop](evidencias/kit-explicito-1440-claro.png) · [Kit celular](evidencias/kit-explicito-390-claro.png) ·
[Preparação desktop](evidencias/preparacao-item-unico-1440-claro.png) · [Preparação celular](evidencias/preparacao-item-unico-390-claro.png).

Capturas sintéticas **Em revisão**. Nenhum baseline aprovado foi alterado.
O commit remoto, o CI e a conferência da publicação ficam na PR. Nenhuma nota real
é emitida ou cancelada para testar. Backup e eventual correção cadastral solicitada
ficam em registros privados, sem dados reais no repositório público.
