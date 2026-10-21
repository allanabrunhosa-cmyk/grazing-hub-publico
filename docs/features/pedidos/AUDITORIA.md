# Auditoria de prontidão para Pedidos e Receita

Este documento preserva o retrato da auditoria. As decisões de negócio tomadas depois dela estão em [DECISOES_PENDENTES](DECISOES_PENDENTES.md); [ARQUITETURA](ARQUITETURA.md), [GAPS](GAPS.md) e [ROADMAP](ROADMAP.md) refletem o plano atualizado.

Data: 24/09/2026. Base inspecionada: `465b1cd492b2fc42da01eb96d6db846127ee78ab`, branch `codex/manifesto-nfs-publicacao`.

## Parecer

**Há base suficiente para iniciar o desenvolvimento incremental de Pedidos, mas este checkout ainda não permite registrar pedidos de venda reais com integridade.** Clientes, catálogo, regras de escolhas, preços, composição teórica, lançamentos, baixas e conciliação são reaproveitáveis. Faltam o agregado comercial, itens imutáveis, vínculos de origem, transições e autorização próprias de Pedidos.

Não é necessário reconstruir Produtos ou Financeiro. Composição incompleta não bloqueia uma venda comercial válida: bloqueia afirmar consumo completo ou CMV conhecido. Emissão fiscal de saída não está implementada; a possibilidade de operar com emissão externa deve ser decidida fora do código, sem inferir dispensa fiscal.

P0 neste planejamento significa requisito antes do **primeiro pedido real**, não impedimento para começar a desenvolver. A maioria desses requisitos será construída junto com o núcleo de Pedidos. Estoque automático, custeio realizado e integrações externas ficam em marcos posteriores.

## Método e alcance

Leitura do AGENTS, índice, mapas de Vendas, Cadastros, Financeiro, Estoque, Insumos, Compras e Fiscal e dos contratos de banco, acesso, testes e documentação; depois buscas por símbolos e inspeção dos trechos correspondentes. Compras foi consultado apenas para não confundir `PedidoCompra` e recebimento de fornecedor com venda. Produção foi consultada apenas na fronteira de etiquetas/consumo.

O checkout tinha `docs/execucao-vendas.md` modificado e artefatos de catálogo, scripts, log e `.worktrees/` não rastreados. Foram preservados; não são prova de funcionalidade integrada. A auditoria não inspecionou outras worktrees nem assumiu capacidades da main. Não acessou banco, cadastros pessoais, certificados ou serviços externos. O pedido anexado termina em um título vazio `# 23`; os requisitos completos 1–22 foram considerados.

Classificação de evidência: **CONFIRMADO** = comportamento/estrutura observado no código; **PARCIAL** = parte existe, ligação ou garantia falta; **AUSENTE** = não encontrado no schema e nos caminhos do fluxo pesquisados; **INCERTO** = exige dados ou execução não realizada. Estados da matriz medem utilidade para Pedidos, não qualidade geral do módulo.

## Catálogo de evidências

Links são relativos ao repositório; símbolos e trechos permitem reencontrar a evidência mesmo se linhas mudarem. Referências de teste significam **cobertura declarada inspecionada**, não execução nesta auditoria.

| ID | Evidência e conclusão sustentada |
|---|---|
| E01 | [schema](../../../prisma/schema.prisma), models `ClienteVenda` (linha 26), `ProdutoVenda` (52), `PedidoCompra` (966), inventário completo de models; [entrada de Vendas](../../../src/app/(protegido)/vendas/page.tsx). Não há PedidoVenda/itens operacionais de venda; a tela declara que cadastro/simulação não geram efeitos. |
| E02 | [dominio.ts](../../../src/lib/vendas/dominio.ts), `validarCliente` (69); [persistencia.ts](../../../src/lib/vendas/persistencia.ts), `salvarCliente` (24); [migration cadastral](../../../prisma/migrations/20260922010000_cadastros_vendas/migration.sql). ID, PF/PJ, documento normalizado e único opcional, contatos, endereços JSON, versão e histórico. |
| E03 | [schema](../../../prisma/schema.prisma), `ProdutoVenda` até `ComponenteProdutoVenda`; [dominio.ts](../../../src/lib/vendas/dominio.ts), `validarProduto`, `validarGrupo`, `simularConfiguracao`; [persistencia.ts](../../../src/lib/vendas/persistencia.ts), `salvarProduto`/`salvarGrupo`. Relações, precisão, regras e validações comerciais. |
| E04 | [persistencia.ts](../../../src/lib/vendas/persistencia.ts), `salvarPrecoCanal`/`alterarPrecoProduto`; [consultas.ts](../../../src/lib/vendas/consultas.ts), `consultarProdutos`; [migration de canais](../../../prisma/migrations/20260922190000_canais_venda/migration.sql). Disponibilidade derivada de preço-base positivo e canal textual sem FK em PrecoProdutoVenda. |
| E05 | [configuracao.ts](../../../src/lib/vendas/configuracao.ts), `resolverConfiguracao`; [cmv.ts](../../../src/lib/vendas/cmv.ts); [ficha.ts](../../../src/lib/vendas/ficha.ts); [testes de configuração](../../../testes/vendas/configuracao.test.ts). Escolhas efetivas, quantidades decimais, custo pendente distinto de erro comercial; não persistem venda/consumo. Fixture de base zero ativa diverge da persistência/consulta real. |
| E06 | [custo-preparacao.ts](../../../src/lib/insumos/custo-preparacao.ts), `calcularCustosPreparacoes`; [consultas.ts](../../../src/lib/vendas/consultas.ts); [schema](../../../prisma/schema.prisma), `Insumo`, `ComposicaoInsumo`, `ConversaoInsumo`. Preparação é insumo intermediário; custo recursivo por rendimento/conversão; não ordem de produção. |
| E07 | [schema](../../../prisma/schema.prisma), `SaldoEstoque`/`MovimentacaoEstoque`; [registrarMovimentacao.ts](../../../src/lib/estoque/registrarMovimentacao.ts). Saldo e movimento na mesma transação; origem de compra/perda existe, origem de venda/reserva não; custoUnitario somente em entradas. [Posição histórica](../../../src/lib/estoque/posicao.ts) reconstrói quantidades; a [consulta de inventário](../../../src/app/(protegido)/inventario/page.tsx) usa custoMedio atual. Busca `SAIDA_CONSUMO` em src/prisma encontrou enum, rótulo e comentário do helper, sem chamador operacional de consumo. |
| E08 | [schema](../../../prisma/schema.prisma), `LancamentoFinanceiro` (1388), `MovimentacaoBancaria` (1546), `VinculoExtrato` (1601). Receita/pendência e baixa única; contraparte textual, sem cliente/pedido comercial; forma financeira distinta da comercial. |
| E09 | [ações financeiras](../../../src/app/(protegido)/financeiro/lancamentos/actions.ts), `criarLancamentoAction`, `atualizarLancamentoAction`, `excluirLancamentoAction`; [exclusaoLancamento.ts](../../../src/lib/financeiro/exclusaoLancamento.ts). Recorrência repete valor integral e avança competência; não divide total da venda. Edição de pendentes e cancelamento não conhecem uma origem Pedido. |
| E10 | [baixarLancamento.ts](../../../src/lib/financeiro/baixarLancamento.ts), `baixarLancamento`, `estornarBaixaLancamento`. Baixa integral atômica com atualização condicional e movimento único; reversão apaga movimento e reabre pendência, portanto não representa reembolso real. |
| E11 | [conciliação/servico.ts](../../../src/lib/financeiro/conciliacao/servico.ts), `importarExtrato`, `conciliarExtrato`, `desfazerConciliacao`; [sugestoes.ts](../../../src/lib/financeiro/conciliacao/sugestoes.ts); [integração](../../../testes/financeiro/conciliacao/integracao.test.ts), casos 176–243. Importação sem efeito contábil, confirmação, igualdade líquida exata, múltiplos lançamentos inclusive receita + taxa, baixa existente preservada, sem baixa parcial. |
| E12 | [página DRE](../../../src/app/(protegido)/financeiro/page.tsx), [calcularDre.ts](../../../src/lib/financeiro/calcularDre.ts); [página caixa](../../../src/app/(protegido)/financeiro/fluxo-de-caixa/page.tsx), [fluxoCaixa.ts](../../../src/lib/financeiro/fluxoCaixa.ts); [extrato.ts](../../../src/lib/financeiro/extrato.ts), [consulta de movimentações](../../../src/app/(protegido)/financeiro/movimentacoes/page.tsx). DRE e caixa consomem lançamentos; extrato busca movimentos avulsos só com lancamentoId null. |
| E13 | [formas-pagamento.ts](../../../src/lib/vendas/formas-pagamento.ts), `validarFormaPagamentoVenda`/`taxasNaParcela`; [schema](../../../prisma/schema.prisma), `FormaPagamentoVenda` e `FormaPagamento`. Taxas/prazos/faixas cadastrais, sem geração de títulos ou liquidações comerciais. |
| E14 | [dominio.ts](../../../src/lib/vendas/dominio.ts), `CAMPOS_FISCAIS`/`validarFiscal`; [persistencia.ts](../../../src/lib/vendas/persistencia.ts), `salvarFiscalProduto`/`salvarGrupoFiscal`; [schema](../../../prisma/schema.prisma), `ConfiguracaoLoja`, `CertificadoDigital`. Fiscal cadastral e empresa básica; não motor tributário nem emitente de saída completo. |
| E15 | [ações NF-e](../../../src/app/(protegido)/notas-fiscais/actions.ts), trecho 439–508: entrada ESTOQUE e despesa na primeira categoria CMV ativa, se encontrada; [serviço NFS-e](../../../src/lib/nfse/servico.ts), `lancarNfse`: DESPESA vinculada a nota recebida; [schema](../../../prisma/schema.prisma), notas recebidas. Evidência fiscal de entrada e risco de somar CMV de compra com consumo futuro. |
| E16 | [persistencia.ts](../../../src/lib/vendas/persistencia.ts), `historico`, `transacao`, `salvarProduto`, `excluirCadastroVenda` (275); [importacao.ts](../../../src/lib/vendas/importacao.ts). Histórico de cadastros e versões existem; composição/preços são substituídos em edição, produto pode ser excluído fisicamente, identidade externa do produto é removida nessa exclusão. |
| E17 | [actions de Vendas](../../../src/app/(protegido)/vendas/actions.ts); [catálogo de acesso](../../../src/lib/permissoes/catalogo.ts), seção Vendas; [servidor.ts](../../../src/lib/permissoes/servidor.ts); [session.ts](../../../src/lib/session.ts); [autorização](../../../testes/vendas/autorizacao.test.ts). Guardas de servidor para cadastro/fiscal; não há recurso Pedidos. Transação cadastral trava cadastros e confere versão, mas não relê autorização sob essa trava. |
| E18 | [schema](../../../prisma/schema.prisma), `IdentidadeExternaVenda`; [importacao.ts](../../../src/lib/vendas/importacao.ts), `gravarFonte`; [testes de integração](../../../testes/vendas/integracao.test.ts). Origem/loja/entidade/chave únicos, hash e conflito de versão no catálogo; destinoId polimórfico sem FK; não conector de pedidos. |

## Cadeia encontrada

```text
ClienteVenda + ProdutoVenda + preços/canal + escolhas
                 ↓ regras e simulação existentes
           [PEDIDO E ITENS AUSENTES]
                 ↓ vínculo comercial ausente
LancamentoFinanceiro RECEITA → baixa integral → MovimentacaoBancaria
                 ↕ VinculoExtrato ← TransacaoExtrato importada
                 ↓
        DRE / fluxo de caixa existentes

ProdutoVenda → ComponenteProdutoVenda → Insumo / preparação
                 ↓ custo teórico e ficha existentes
       [CONSUMO/RESERVA/PRODUÇÃO POR VENDA AUSENTES]
                 ↓ helper reutilizável
       MovimentacaoEstoque + SaldoEstoque

Fiscal cadastral existe → [DOCUMENTO/EMISSÃO DE SAÍDA AUSENTES]
```

## Clientes

**CONFIRMADO:** identidade CUID estável; PF/PJ; CPF/CNPJ opcional normalizado e único quando preenchido; um email, um telefone e contato textual; até 20 endereços estruturados com nome, destinatário, CEP, logradouro, número, complemento, bairro, cidade e UF; ativo/versão/histórico (E02).

**PARCIAL:** validação documental verifica quantidade de dígitos, sem dígitos verificadores. Email tem validação sintática simples; telefone é texto. CEP/UF podem ficar vazios, embora logradouro/número/cidade sejam obrigatórios em endereço cadastrado. Não há finalidade entrega/faturamento, inscrição estadual ou identidade fiscal distinta do comprador. Isso não exige CRM: selecionar/copiar endereço e destinatário no Pedido e validar os campos necessários à entrega/fiscal resolve a fronteira.

Documento nulo permite duplicatas legítimas ou acidentais. Nome/email/telefone não são identidade única; a busca atual é por nome/documento/email (página de clientes). Reutilizar cliente existente e oferecer conferência de possíveis duplicados; nunca fundir automaticamente. A cardinalidade cliente→vários pedidos é compatível com o ID, mas a FK inversa ainda não existe. Não há motivo para criar um segundo cadastro de clientes.

## Produtos e capacidades distintas

**CONFIRMADO:** ID, código opcional único, categorias ordenadas, status, papéis Principal/Opção/Complemento, tipos Padrão/Personalizado/Revenda, unidade comercial textual, preços por canal, promoção, grupos com limites, opções com preço e multiplicador, componentes em unidade de controle do insumo, ficha e fiscal separado (E03–E06, E14). Variações já podem ser produtos separados ou escolhas; não existe um motor de descontos de pedido.

| Capacidade | Estado encontrado |
|---|---|
| A. Vender | PARCIAL: catálogo suficiente para selecionar/configurar; falta persistência da venda. Confirmar produto ativo no servidor: `resolverConfiguracao` não é uma autorização nem confere por si o ativo do produto principal. |
| B. Calcular receita | PARCIAL: preço de configuração em centavos; faltam quantidade da linha, descontos/frete, total persistido e regra de reconhecimento. |
| C. Quantidade vendida | AUSENTE: não há item vendido; contagem de opções ou gramagem não equivale a quantidade comercial. |
| D. CMV estimado | CONFIRMADO para composições com unidades, custos e rendimentos suficientes; retorna null/pendências se incompleto. Usa custos atuais, não custo histórico realizado. |
| E. Movimentar estoque | PARCIAL: relação até insumos e helper existem; nenhum produto possui fluxo automático de baixa por venda neste checkout. |
| F. Emitir documento fiscal | PARCIAL no cadastro; emissão AUSENTE. `fiscalRevisado` só valida presença/formato de campos, não adequação tributária. |

**Divergência concreta:** a fixture de configuração aceita preço-base zero com opção obrigatória paga, mas `validarProduto`, `salvarPrecoCanal` e `consultarProdutos` derivam ativo de base > 0 (E04–E05). O teste isolado não comprova que esse produto possa ser configurado a partir do catálogo persistido. O plano histórico contém esse caso, enquanto a regra cadastral atual exige base positiva. Deve-se alinhar a política antes de incluir essa classe na primeira versão, sem inventar base simbólica nem alterar preços reais.

## Financeiro, recebíveis e não duplicação

**CONFIRMADO:** uma conta a receber é representável por `LancamentoFinanceiro(tipo=RECEITA,status=PENDENTE)` com valor, competência, vencimento, categoria e contraparte textual. A baixa integral grava data/conta e um movimento bancário na mesma transação. Não há entidade autônoma de recebimento parcial de título; o vínculo de extrato é único por lançamento (E08–E11).

**PARCIAL:** sinal e saldo podem ser dois títulos distintos cuja soma é o total, com competência comercial preservada e vencimentos próprios. A recorrência atual **repete** o mesmo valor e avança competência, portanto não deve receber o total do pedido como se o dividisse em parcelas (E09). FormaPagamentoVenda tem taxas/prazos e faixas, mas não é a FK `formaPagamentoId` financeira (E13).

Conciliação identifica transação importada por conta/chave; sugestões usam valor, data e contraparte, com ambiguidade explícita. O servidor exige confirmação e soma assinada exata. Exemplo conceitual: receita 100 e taxa 3 conciliam entrada 97 sem transformar receita em 97. Pode criar lançamento novo; sem origem comercial, nada garante que esse novo lançamento não replique uma venda já representada por outro título. Isso é risco de integração, não duplicação inevitável da arquitetura.

DRE competência usa dataCompetencia e exclui cancelados; DRE caixa usa somente baixados/dataPagamento. Fluxo usa pagamento para realizados e vencimento para pendentes. Os relatórios somam valores de lançamentos; não consultam produtos, pedidos ou notas como fontes adicionais. A consulta de extrato não soma novamente movimentos vinculados a lançamentos (E12).

**Proposta:** Pedido será a fonte do fato comercial, títulos vinculados serão sua representação no Financeiro, banco será evidência de liquidação e nota de saída será evidência fiscal. Nunca somar as quatro representações. Detalhes e tratamento de reembolsos em [ARQUITETURA](ARQUITETURA.md).

**Atenção ao CMV:** aceite NF-e de itens destinados a estoque já pode criar DESPESA no grupo CMV na compra (E15). Acrescentar outra despesa CMV no consumo duplicaria custos. O CMV de composição deve inicialmente ser indicador comercial separado; mudança de reconhecimento no DRE exige decisão e adaptação delimitada no Marco 3.

## Estoque, insumos e preparações

**CONFIRMADO:** composição fixa e opções escolhidas resolvem quantidades por Insumo; preparação é `PRODUTO_INTERMEDIARIO`, com composição e rendimento recursivos para custo. Saldo é por insumo/local; produto comercial não tem saldo próprio. `registrarMovimentacao` atualiza saldo e cria movimento atomicamente, aceita transação externa e data efetiva opcional gravada em createdAt. Movimentos de saída não preservam custo unitário (E06–E07).

**AUSENTE:** reserva por pedido, ordem/lote de produção, consumo operacional por venda, FK/idempotência de origem Pedido e CMV histórico de saída. `SAIDA_CONSUMO` no enum é capacidade estrutural, não fluxo implementado. Etiqueta e ficha não geram estoque. O helper permite saldo negativo; a política de disponibilidade e concorrência deve pertencer ao serviço que efetivará consumo.

Baixar ingredientes da preparação e também a preparação consumida na venda causaria dupla baixa. Deve-se escolher um modo explícito por preparação: consumir estoque do intermediário produzido ou explodir ingredientes para produção sob encomenda. Custo recursivo não define esse modo automaticamente.

| Classe do pedido | Condição mínima | Composição ausente |
|---|---|---|
| Comercialmente válido | Cliente, item/configuração disponível, quantidade, preço/total, canal e snapshots | Pode confirmar |
| Estoque rastreável | Composição resolvida preservada, unidade, local, estratégia de preparação, origem única e evento de consumo | Pendência explícita; não lançar baixa incompleta como completa |
| CMV calculável | Composição/rendimento/custos suficientes e referência temporal | CMV desconhecido, nunca zero |

**INCERTO:** quais IDs reais estão aptos e quantos produtos têm composição/custo completos. Não foi lido banco nem inferida cobertura a partir de pacotes de importação. O critério acima permite uma futura consulta de diagnóstico autorizada; não é uma lista de produtos homologados. Mesmo composição completa não torna automática a baixa hoje.

## Fiscal e integridade

Fiscal de produto inclui NCM, CEST, origem, CFOP, CSOSN/CST, PIS/COFINS/IPI, FCP, EAN e unidade tributável, agrupados em modelos fiscais copiáveis. Empresa tem nome/CNPJ/endereço livre/contatos e fuso; certificado é infraestrutura existente. Não há cadastro estruturado completo do emitente de saída nem política tributária por operação comprovada. NF-e/NFS-e existentes são de entrada/consulta e podem produzir despesas, não receita comercial de saída (E14–E15).

**DECISÃO EXTERNA NECESSÁRIA:** documento adequado, operação/regime, códigos e tributos aplicáveis, momento de emissão, credenciais e fornecedor. Nenhuma regra tributária foi inferida. Pedido deve oferecer identidades, destinatário/endereço, itens/unidades/quantidades, valores/descontos/frete, datas e vínculo estável; o documento fiscal preservará o retrato efetivamente emitido.

Integridade atual: FKs protegem categoria/grupo/produto/insumo em vários vínculos; documento/código e identidades externas têm unicidade. Há históricos cadastrais antes/depois e versões. Porém `salvarProduto` recria preços/componentes/vínculos e `excluirCadastroVenda` remove fisicamente produto e dependências quando não é opção de outro grupo. `versao` não é tabela imutável de composição. ID de preço/componente não deve ser a única memória de item vendido (E16).

Guardas de servidor e sessão ativa existem para Vendas/Fiscal; ainda faltam ações/permissões específicas de Pedidos e seus efeitos. Não reutilizar cegamente a transação cadastral como guarda de confirmação: ela serializa cadastros, não relê autorização depois da espera (E17). Identidades externas são do catálogo, sem recebimento de eventos de venda (E18).

Dinheiro cadastral é Decimal(12,2), financeiro Decimal(14,2), configuração usa centavos; composição resolve quantidades com aritmética decimal exata. Há conversões para number nos custos, relatórios e entrada do helper de estoque, e parseFloat no formulário financeiro. Definir limites/rateio/arredondamento na fronteira de Pedido; não presumir precisão ponta a ponta só pelo tipo SQL. A DRE agrupa pela categoria, portanto o gerador de títulos deve validar tipo/categoria compatíveis.

## Simulações conceituais obrigatórias

Exemplos fictícios, sem execução, cadastro ou transação de demonstração.

| Cenário | O que já é representável | Onde quebra | Menor desenvolvimento |
|---|---|---|---|
| A — produto simples 100, pago integralmente | Cliente/produto/preço; receita 100; baixa integral e extrato | Não há item vendido nem relação cliente→pedido→título | M1 persiste venda/snapshot; M2 gera ou vincula um único título e baixa uma vez. DRE 100 e caixa 100, nunca 200. |
| B — encomenda 300, sinal 90 + saldo 210 | Dois lançamentos com vencimentos distintos podem ser baixados separadamente | Sem saldo do pedido, parcela comercial, competência de entrega ou agregação; recorrência repetiria valor | Criar dois títulos vinculados 90/210, soma 300; competência definida pelo fato comercial, não pelo vencimento. Registrar sinal recebido e saldo aberto; política de encomendas B01. |
| C — produto sem composição, preço 150 | Configuração comercial e pendência de custo | Pedido não existe; estoque/CMV não podem ser inferidos | Confirmar venda com total 150 e CMV/consumo pendentes. Preservar essa ausência histórica; futura ficha não retroage silenciosamente. |
| D — cancelamento antes de produção | Financeiro cancela pendente; pode corrigir baixa equivocada | Sem cancelamento comercial e coordenação; sinal real não é erro de baixa | Evento com motivo; cancelar títulos não recebidos, liberar reserva se houver. Se houve sinal, manter recebimento e registrar obrigação/reembolso conforme decisão, sem apagar evidência bancária. |
| E — cancelamento após consumo | Movimentos/perdas/ajustes existem isolados | Sem origem da venda, custo histórico e reversão coordenada | Cancelar comercialmente; tratar valor a devolver; preservar consumo realizado. Só devolver ao saldo o que fisicamente retornar; perda/reaproveitamento explícitos e estorno vinculado único. M3. |
| F — pagamento aparece depois no banco | Importação sem efeito; concilia pendente ou realizado; receitas e taxas podem formar líquido | Sem vínculo comercial pode-se criar nova receita por engano; datas/contas divergentes impedem vínculo de realizado | Buscar/vincular título existente; conciliar uma vez. Data de arquivo posterior não muda data do recebimento. Divergência real exige correção auditada, não segundo lançamento. |
| G — preço muda após venda 100→120 | Cadastro versiona e audita alteração | Histórico de venda não existe; leitura dinâmica passaria a 120 | Item confirmado conserva preço 100, opções, nome e total. Próxima venda usa 120. Edição de composição/cliente/fiscal também não altera snapshot. |

## Matriz de prontidão

PRONTO é reutilizável no recorte indicado; PARCIAL exige completar contrato; AUSENTE não implementado; NÃO BLOQUEANTE pode esperar para venda comercial. Prioridades são detalhadas em [GAPS](GAPS.md); P2 fiscal/estoque pode tornar-se condição de um lançamento que exija esses efeitos.

| Área | Estado | Evidência | Gap | Impacto em Pedidos | Prioridade | Próxima ação |
|---|---|---|---|---|---|---|
| Clientes | PARCIAL | E02 | Snapshot de comprador/destinatário; qualidade de documento | Identidade histórica e entrega | P1 | Reutilizar ClienteVenda e validar snapshot por finalidade |
| Produtos | PRONTO | E03 | FK de item vendido e proteção de exclusão | Seleção pronta; histórico requer núcleo | P0 | G01–G02 |
| Preços | PARCIAL | E03–E05 | Preço vendido, desconto, quantidade e base zero | Total e disponibilidade | P0/P1 | Total servidor + G07 |
| Canais | PARCIAL | E04 | Preço usa texto sem FK; origem de pedido não existe | Evitar confundir canal com identidade externa | P1 | CanalVenda no pedido, nome em snapshot |
| Complementos | PARCIAL | E03–E05 | Escolhas vendidas sem persistência | Quantidades/preços e consumo configurado | P0 | Snapshot de escolhas no item |
| Composição | NÃO BLOQUEANTE | E05 | Composição histórica/aptidão real não verificadas | Venda possível; consumo/CMV pendentes | P2 | G10–G13 |
| Insumos | PRONTO | E06 | Não há origem comercial de consumo | Cadastro/unidades reutilizáveis | P2 | Adaptar fronteira de consumo |
| Preparações | PARCIAL | E06–E07 | Produção/rendimento realizado e modo de baixa | Evitar dupla baixa | P2 | B05 + M3 |
| Estoque | PARCIAL | E07 | Reserva, vínculo e consumo por venda ausentes | Não prometer disponibilidade/baixa automática | P2 | M3 |
| Financeiro | PARCIAL | E08–E10 | Origem comercial, proteção das mutações, devoluções | Coerência de títulos e pedido | P1 | M2; G04/G06 |
| Contas a receber | PARCIAL | E08–E10/E13 | Sinal/parcelas comerciais; sem baixa parcial | Saldo e recebimentos corretos | P1 | Títulos separados, soma preservada |
| Conciliação | PRONTO | E11 | Identificação de venda ainda ausente | Reutilizar sem criar receita duplicada | P1 | Exibir origem e selecionar títulos existentes |
| DRE | PARCIAL | E12/E15 | Competência da venda e CMV de compra versus consumo | Receita e margem confiáveis | P1/P2 | B01/B06; não somar custo duas vezes |
| Fluxo de Caixa | PRONTO | E12 | Depende de títulos/baixas corretos | Projeção e realizado reutilizáveis | P1 | Alimentar títulos do M2 |
| Fiscal de produto | PARCIAL | E14 | Revisão tributária real e snapshot aplicado | Não comprova emissão | P2 | E01–E03 em decisões |
| Fiscal de saída | AUSENTE | E01/E14/E15 | Documento, estados, conector e emitente completo | Emissão externa ou M4 conforme decisão | P2 condicionado | M4 + decisão externa antes de operação |
| Permissões | PARCIAL | E17 | Recursos e ações de Pedidos ausentes | Escrita/efeitos precisam autorização | P0 | G03 |
| Auditoria/histórico | PARCIAL | E16 | Eventos e snapshots de venda ausentes | Venda não pode depender de cadastro mutável | P0 | G01–G03 |
| Infraestrutura necessária a Pedidos | PARCIAL | E01/E08/E17/E18 | Núcleo transacional e chaves de repetição | Base PostgreSQL/Prisma/sessão reutilizável | P0 | M1; sem novo serviço |
| Relatórios comerciais/KPIs | AUSENTE | E01/E12 | Itens, cliente, canal e totais vendidos | Histórico comercial ainda não produzido | P1/P3 | Consulta básica M1; análises avançadas depois |

## Índice de prontidão sem percentual

**Pronto para reutilizar:** ClienteVenda e ProdutoVenda como identidades; catálogos/grupos; validações de escolhas; unidades/insumos; cálculo teórico com pendências; histórico cadastral como padrão; lançamentos/baixa integral; conciliação; relatórios financeiros; sessão e catálogo de acesso.

**Requer pequeno ajuste localizado:** origem de Pedido nos títulos e proteção das suas mutações; consulta de canais com ID; guarda de exclusão de produto usado; consistência de disponibilidade para configuração com base zero; validação de dados escolhidos para entrega. Reembolso e consumo não são meros campos: exigem os contratos descritos no roadmap.

**Precisa ser desenvolvido:** Pedido/itens/snapshots/eventos, total/descontos, confirmação/cancelamento idempotentes, tela e consultas comerciais, geração de recebíveis comerciais, devoluções vinculadas, consumo/produção/reserva se adotada, custo histórico e fiscal de saída.

**Depende de decisão de negócio:** competência e encomendas, condições do lançamento em M1, descontos/preços livres, pagamento e cancelamento, momento/modo de consumo e disponibilidade; ver decisões B01–B06.

**Depende de terceiro/contador:** modelo/obrigatoriedade e operação fiscal de saída, revisão fiscal e provedor; canais externos só no M5. Nada disso justifica inventar dados ou atrasar a construção do núcleo comercial.

## Validação e limitações

Inspeção estática de schema, migrations pertinentes, serviços, actions e testes do recorte. Validação documental: 9 arquivos e 117 referências locais conferidas, sem destinos ausentes ou caracteres inválidos; `git diff --check` sem erros. A conferência própria incluiu os arquivos novos ainda não rastreados. Não foram executados testes funcionais, integração opt-in, build, Prisma, banco ou smoke: a mudança é exclusivamente documental, conforme [exceção de testes](../../contexto/testes.md). Nenhum resultado histórico de teste foi reapresentado como execução desta tarefa.

A presença dos testes de Vendas e conciliação evidencia contratos previstos; sua aprovação atual, migrations aplicadas, dados preenchidos, capacidade operacional de produção e homologação externa permanecem INCERTOS. Não há certificação de produção, inventário nominal de produtos aptos ou reauditoria geral do Financeiro.
