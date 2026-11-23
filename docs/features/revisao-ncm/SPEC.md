# Revisão de NCM por alteração de composição

Decisão do responsável em 23/11/2026: o NCM do produto final só muda com a permissão dele,
e ele quer ser avisado quando uma alteração de ingrediente pedir revisão de NCM.
Regras do domínio: [Fiscal](../../modulos/fiscal.md). Andamento: [TASKS](TASKS.md).

## Objetivo e fora de escopo

- Alteração de composição **não bloqueia** mais a emissão: a nota sai com o NCM vigente.
- O produto fica com **revisão de NCM pendente** até o administrador decidir manter ou alterar.
- Avisos: Painel do Fiscal, bloco Fiscal do pedido e e-mail aos administradores.
- Fora de escopo: sugerir NCM, alterar NCM automaticamente, mudar o formato do selo gravado,
  kits (`KIT_COMPOSTO`), complemento `MERCADORIA` com equivalência física e FCI, que seguem como estavam.

## Comportamento

| Situação | Emissão | Revisão pendente |
| --- | --- | --- |
| Marca, marcas homologadas, EAN ou especificação de insumo simples | segue | não |
| Ingrediente incluído, retirado ou trocado; quantidade/unidade/modo de preparo | segue, NCM mantido | sim |
| Receita de preparação alterada (inclui marca de ingrediente dentro dela) | segue, NCM mantido | sim |
| Prova ausente no pedido ou no cadastro (fotografia inexistente) | bloqueia, como antes | — |
| Combinação de opções sem cenário NCM | bloqueia, como antes | — |

- **Manter NCM**: confirmação explícita no painel. Registra nova versão da classificação com
  os mesmos dados e a composição atual, pelo caminho normal salvar → impacto → ativar, com
  autor, justificativa e mudanças. Exige administrador, conferido no servidor.
- **Alterar NCM**: abre a ficha fiscal do produto (`/financeiro/fiscal/vinculos?produto=`).
- E-mail: enviado uma vez por estado de composição (assinatura). Só é registrado como
  avisado depois de aceito pelo servidor de e-mail; sem e-mail configurado, tenta de novo.

## Arquitetura e caminhos

- `src/lib/tributacao/ncm-configuracao.ts`: `resolverNcmConfiguracao` devolve `revisoes`
  (não impeditivas) para divergência de composição; `bloquear` fica para prova ausente.
- `src/lib/tributacao/motor.ts`: `PreviaTributacao.revisoesNcm` e justificativa na linha.
- `src/lib/tributacao/revisao-ncm-dominio.ts`: diferenças de materiais e assinatura sem marca.
- `src/lib/tributacao/revisao-ncm.ts`: lista pendências (classificação vigente × cadastro
  atual), `manterNcmRevisado`, pendências de um pedido e registro de avisos.
- `src/lib/tributacao/revisao-ncm-alerta.ts`: e-mail aos administradores ativos com e-mail
  verificado; `revisao-ncm-agenda.ts`: conferência adiada (5 s) após gravar insumo,
  produto ou grupo de opções, sem bloquear nem falhar a gravação.
- Interface: `financeiro/fiscal/revisao-ncm-pendente.tsx` (referência: "Notas autorizadas com
  arquivos a recuperar" do mesmo painel) e aviso em `vendas/pedidos/emitir-nota-pedido.tsx`.

## Banco

Migration aditiva `20261123180000_alerta_revisao_ncm`: tabela `AlertaRevisaoNcm`
(assinatura única, versão, produto, mudanças, destinatários). `EventoEstruturaFiscal` não
serve: a projeção de atividades só aceita RASCUNHO/IMPACTO/ATIVACAO.

## Riscos e limites conhecidos

- Enquanto a revisão está pendente, notas saem com o NCM anterior. É a regra decidida; o
  risco fiscal é do responsável, que é avisado nos três canais.
- A conferência do painel percorre todas as classificações vigentes a cada abertura.
- Gravações fora dos três pontos com gatilho (por exemplo importação em lote) só geram
  e-mail na próxima abertura do painel ou gravação com gatilho.
- Pedido antigo, fechado antes de uma mudança já confirmada, emite com o NCM vigente sem aviso.

## Aceite

- Testes: `testes/tributacao/ncm-configuracao.test.ts`, `revisao-ncm.test.ts`,
  `ncm-aplicabilidade-integracao.test.ts` (banco local) e `testes/financeiro/revisao-ncm-interface.test.tsx`.
- Prévia isolada: `testes/visual/fiscal-dashboard.html?estado=revisao-ncm`
  (`revisao-ncm-erro`, `decidir=nao`, `escuro`).
