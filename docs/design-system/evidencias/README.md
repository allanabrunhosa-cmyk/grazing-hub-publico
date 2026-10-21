# Evidências locais — em revisão

As imagens de `2026-09-22/` pertencem à execução iniciada em 22/09 e continuada em 23/09.
Dados sintéticos; não há dados de produção nem aprovação visual humana implícita.
Captura 35 foi feita em 23/09 após integrar as revisões de Vendas: composição ordenável,
visibilidade na ficha e custo preservado, viewport 1280×720. Continua em revisão.
Descrição de cada cenário e limites em `../VALIDACAO.md`. Capturas são viewport,
exceto quando o registro do cenário informar captura longa. Preserve originais.

## Comparação reproduzível

1. Abra a mesma prévia local, com dados fixos, largura, altura, tema e estado idênticos.
2. Espere a interface estabilizar e capture com o navegador autorizado. Não altere os
   pixels, o DOM ou imagens de referência para mascarar diferenças.
3. Execute `node scripts/comparar-design.mjs antes.png depois.png`. O comando só lê
   arquivos, compara RGBA e retorna erro quando há diferença ou dimensão incompatível.
4. Examine ambas as imagens. Registre causa/intenção da diferença. Só substitua uma
   referência aprovada após revisão explícita; nunca atualize em lote para passar.

Prova executada: 28 versus 29, mesma nota fictícia, 1280×900, 0 de 1.152.000 pixels
diferentes (exit 0). 27 versus 28, lista aberta versus fechada, 50.121 pixels diferentes,
4,35078125% (exit 1 esperado). Ambas examinadas: popup e foco mudam, campos/parcelas
permanecem alinhados. Essa prova valida o comparador, não certifica todos os fluxos.

Sharp é a dependência já instalada com Next; nenhuma plataforma ou pacote foi instalado.
Comparação exata exige mesmo ambiente/fontes/DPI: diferenças entre máquinas precisam de
inspeção, não de tolerância aumentada silenciosamente. Leitor de tela e impressão física
não são demonstrados por imagens.
