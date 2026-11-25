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
| Quantidade de escolhas fora da faixa da equivalência NCM (ex.: análise com 1 sabor, cardápio vendendo 2) — 25/11/2026 | segue, NCM mantido | sim |
| Sabor/opção criado depois da análise em grupo de sabores equivalentes — 25/11/2026 | segue, NCM do produto | sim |
| Ingrediente incluído ou adicional integrado em produto sem configuração por escolha — 25/11/2026 | segue, NCM do produto | sim, só no pedido |
| Escolha de grupo que a configuração não cobre (fora de cenários e equivalências) — 25/11/2026 | segue, NCM resolvido | sim, só no pedido |
| Prova ausente no pedido ou no cadastro (fotografia inexistente) | bloqueia, como antes | — |
| Combinação de opções sem cenário NCM (produto com NCM por sabor) | bloqueia, como antes | — |
| Produto sem NCM próprio para manter | bloqueia | — |

### Variações de sabor e tamanho — 25/11/2026

Regra do responsável: o sabor **não** muda o NCM, salvo exceção cadastrada; tamanho nunca muda.

- **Padrão (sabores equivalentes, `gruposEquivalentes`)**: qualquer opção do grupo usa o NCM do
  produto. Sabor novo no cardápio não bloqueia; aparece no painel como "opção nova sem decisão
  de NCM" e **Manter NCM** o inclui na equivalência (`opcoesAtivasGrupo` em `revisao-ncm-limites.ts`).
- **Exceção (NCM por sabor, `modoFiscal: "UNIDADES_SEPARADAS"`)**: uma linha fiscal por sabor.
  Sabores sem preço próprio dividem o valor da linha pela quantidade escolhida de cada um
  (`ratearFiscal`, centavos pelo maior resto, total preservado). Opções com preço próprio que
  não fecham o total continuam bloqueando. Sabor novo sem cenário continua bloqueando: não há
  NCM do produto para herdar (o cadastro desses produtos não tem NCM base).
- Tamanho é quantidade/preço do mesmo produto e não tem configuração fiscal.

- **Manter NCM**: confirmação explícita no painel. Registra nova versão da classificação com
  os mesmos dados e a composição atual, pelo caminho normal salvar → impacto → ativar, com
  autor, justificativa e mudanças. Exige administrador, conferido no servidor.
- Quando o motivo é a faixa de escolhas, **Manter NCM** também amplia a faixa documentada da
  equivalência para cobrir o limite atual do cardápio (`revisao-ncm-limites.ts`, mesma regra
  `limitesEfetivos` do pedido). Grupo sem máximo no cardápio exige decisão na ficha fiscal.
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
- Os avisos marcados "só no pedido" não aparecem no painel nem têm **Manter NCM**: a decisão
  é registrada na ficha fiscal (equivalência do grupo). Produto com receita fiscal documentada
  por opção exige a porção do sabor novo na ficha; **Manter NCM** recusa e explica.
- Complementos vendidos como mercadoria (bebidas, empório) seguem o tratamento próprio do
  complemento e não entram nesta regra.

## Aceite

- Testes: `testes/tributacao/ncm-configuracao.test.ts`, `revisao-ncm.test.ts`,
  `ncm-aplicabilidade-integracao.test.ts` (banco local) e `testes/financeiro/revisao-ncm-interface.test.tsx`.
- Prévia isolada: `testes/visual/fiscal-dashboard.html?estado=revisao-ncm`
  (`revisao-ncm-erro`, `decidir=nao`, `escuro`).
