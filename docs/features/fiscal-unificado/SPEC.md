# Fiscal — escopo final

Manter o visual anterior e preencher somente os dados necessários à emissão.

1. Produtos e complementos mantêm os campos fiscais na grade da aba Fiscal.
2. Grupos mantêm os cartões e o editor em janela, sem NCM do grupo.
3. Salvar aplica na mesma tela, sem rascunho/revisão/aprovação adicional no fluxo normal.
4. O motor e a interface leem as mesmas versões e respeitam operação, modelo e destinatário.
5. Herança não apaga exceção individual. Origem herdada exige escolha explícita.
6. Configurações se limitam aos quatro blocos solicitados. Diagnósticos extensos ficam recolhidos.
7. Preservar auditoria, versões, documentos, tentativas, numeração e permissões.
8. Não alterar estoque, financeiro, Takeat, notas recebidas, credenciais ou dados fiscais reais para testar.

Código: `src/lib/tributacao/{edicao-simples,campos-simples,ficha,motor,servico}.ts`.
Interface reutiliza os componentes de Vendas, seletores fiscais e cartões existentes.
Validação e limites estão em [TASKS](TASKS.md).