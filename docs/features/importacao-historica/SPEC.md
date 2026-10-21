# Importação histórica de pedidos

## Objetivo

Preservar o legado comercial de Orders e seus compradores no HUB. O caminho é de
manutenção explícita, sem cobrança, produção, emissão fiscal, entrega ou mensagens.
Não cria dashboards. A fonte é somente leitura; planilhas e notas são dados não confiáveis.

## Contrato

- Origem estável `grazing-legado-orders`, loja `grazing-hub`, número original em
  `PedidoVenda.referenciaPedido`. `IdentidadeExternaVenda` liga origem/loja/número ao
  pedido. O hash do arquivo identifica a versão da fonte, sem criar nova identidade.
- `PedidoVenda.numero` interno é o negativo do número original. Isso reserva uma
  faixa histórica sem avançar a sequência operacional. Colisão bloqueia o registro.
- Estado `HISTORICO`, origem `HISTORICO_LEGADO` e modo financeiro `EXTERNO`.
  O detalhe usa a fonte original e somente leitura. Produção, reservas, fiscal,
  pagamentos e demais mutações são barrados no serviço, inclusive por acesso direto.
  A migration manual `20261015020000_pedidos_historicos` amplia as listas permitidas,
  mantém os estados anteriores e protege a identidade e os vínculos operacionais no banco.
- A criação mantém o relógio local da fonte sob hipótese explícita São Paulo.
  Seriais, texto exato, pagamento informado e endereços C/H ficam preservados.
  Não há confirmação, entrega ou liquidação bancária inventada.
- Os dez blocos são independentes. Preço líquido não recebe desconto novamente.
  Valores sem detalhamento e diferenças permanecem separados dos produtos físicos.
- Produtos não encontrados ficam inativos, sem ficha/fiscal inferidos. Compradores
  usam o gravador validado de clientes. Nome isolado e telefone conflitante não unem
  pessoas. Contatos atuais válidos não são sobrescritos pelo legado.
- Pagamentos informados ficam segregados em `dadosOrigem.hub.pagamento`. Não são
  títulos, recebíveis atuais ou créditos bancários. Cada evento usa sua própria data.
- Consumo estimado usa somente referência suficiente e composição congelada.
  Ausência de evidência fica não apurada. Nenhuma estimativa altera o estoque.
  Setembro não reaplica efeitos financeiros ou físicos. Não há compensação duplicada.

## Caminhos

`scripts/historico/reconciliar.py` lê o Excel e compara cópias Google obtidas em
leitura. Produz originais por posição/linha, reconciliação integral e exceções.
`src/lib/vendas/historico-dominio.ts` revalida o pacote, seus hashes e cálculos.
`historico-importacao.ts` autoriza o administrador vigente e grava em transação.
`scripts/historico-importar.ts` verifica dumps, provas de restauração, baseline e
logs das verificações antes de permitir aplicação. Não carrega `.env`.

`GET /api/vendas/historico?tipo=pedidos|pagamentos|consumo&mes=AAAA-MM` consulta a
mesma fonte ligada aos pedidos. Exige sessão e permissões do domínio. A projeção
não inclui contatos, endereços ou notas. Retorna números originais, IDs e referências
históricas, sem somá-los ao caixa/DRE operacional. Não representa lucro apurado.

## Segurança e conclusão

Backup das bases HUB e Atendimento, restauração de fato isolada e baseline são
pré-requisitos. Provas e arquivos reais ficam privados, fora do Git. A aplicação
exige prévia integral atualizada e as verificações automatizadas da mesma revisão.

Travas impedem importadores concorrentes. A transação RepeatableRead compara as
tabelas operacionais protegidas antes/depois; qualquer efeito próprio inesperado
desfaz o lote. Movimentos legítimos de outras transações permanecem fora dessa
comparação. Testes usam PostgreSQL sintético isolado.

Reexecução reconhece linhas idênticas. Fonte corrigida gera revisões apenas nas
linhas alteradas, preservando alterações locais e conflitos como exceções.
Reversão cria auditoria, restaura versões anteriores ou marca pedidos novos como
`HISTORICO_REVERTIDO`. Preserva cadastros e fatos posteriores. As tags do Atendimento
têm diário e reversão separados; só as alterações do lote podem ser desfeitas.

Cada linha deve terminar importada, reconhecida ou em exceção explícita. A conferência
final deve comparar pedidos, itens, unidades, valores, identidades, saldos e reexecução.
Testes e simulação não equivalem a importação ou publicação.

## Complemento autorizado do WooCommerce

Uma prova complementar pode recuperar itens fora dos dez blocos exportados. O validador
exige ligação aos hashes da fonte, pacote e linha. Confere todos os itens conhecidos
por nome, quantidade, líquido, bruto e desconto. Os extras precisam fechar AY e BA.
O original permanece intacto. Os itens recuperados e sua proveniência ficam separados;
consultas, produto, consumo e descontos usam os itens efetivos sem repetir a receita.
A versão combinada permite revisão auditável apenas dos pedidos afetados.

O menu existente oferece Pedidos históricos em lista. A busca usa o número original
e a criação. O detalhe identifica itens recuperados e só oferece consulta.

## Ajuste cadastral posterior — 15/10/2026

O usuário solicitou separar PF/PJ, comprovar CNPJ, conservar nomes pessoais e
padronizar nomes sem desfazer exceções humanas. Também autorizou publicar a correção.
Pedidos históricos ativos entram no gasto e na data do último pedido do cliente,
sem serem transformados em confirmação ou recebimento operacional.

Na solicitação de 15/10, o usuário escolheu unificar somente por CNPJ comprovado e manter vários contatos
na empresa. `ClienteVenda.documento` conserva sua unicidade. A migration aditiva
`20261015143000_clientes_contatos_empresa` acrescenta contatos com proveniência e
alias `unificadoEmId`, sem transformar dados por SQL. O serviço específico deve
auditar e versionar qualquer reatribuição de pedido histórico. Registros originais,
snapshots, contatos individuais e alterações posteriores permanecem preservados.
Empresa sem CNPJ comprovado continua PJ separada, com pendência explícita.

A solicitação de 19/10 substitui a restrição anterior de agrupamento: e-mail normalizado e CPF/CNPJ primário identificam uma única raiz comercial. A importação prioriza e-mail antes do nome e reutiliza a mesma raiz em todo o lote, inclusive para chaves pessoais distintas. Fontes antigas apontadas para aliases são resolvidas sem reescrever sua proveniência. A correção antiga por CNPJ não pode criar outra raiz com e-mail já reservado. [Contrato vigente](../clientes-identidade-email/SPEC.md).

Nomes novos usam o mesmo Title Case do Atendimento, com partículas minúsculas.
Trocar PF/PJ conserva nome e sobrenome nos campos de contato. A correção dos nomes
importados exige comprovação de autoria e comparação do estado atual. Editar um
cadastro existente conserva a grafia humana, inclusive quando diferente do padrão.

Consultas públicas podem receber somente nomes empresariais e domínios corporativos,
conforme autorização específica do usuário. Nomes pessoais, e-mails completos,
telefones, endereços e pedidos continuam privados. Titularidade de domínio não
comprova uma filial nem permite substituir uma empresa diferente da fonte.

### Manutenção da correção cadastral

`scripts/clientes-historicos-corrigir.ts` oferece os modos `previa`, `aplicar`,
`previa-reversao` e `reverter`. O executor não carrega arquivos de ambiente nem
inicia integrações. Exige administrador e versão de sessão atuais no servidor.
Prévia e prévia de reversão usam transação somente leitura.

Os argumentos recebem caminhos privados absolutos para fonte Excel, pacote,
complemento, inventário, manifesto de empresas, provas e guardas. Os hashes ligam
os arquivos à fonte original. Apenas o pacote admite até 80 MB; os demais limites
continuam específicos. Os relatórios são exclusivos, sincronizados em disco e
gravados em subdiretório privado das guardas. O executor não imprime dados pessoais.

Antes de escrever, a ferramenta confere dumps físicos e restauração isolada das
três bases, baseline com as doze tabelas protegidas e validade de duas horas.
Confere também os arquivos da revisão publicada, o destino do banco e seis provas
de validação. Aplicação e reversão exigem `CLIENTES_CORRECAO_AUTORIZADA=SIM`,
prévia do mesmo lote e comparação do estado atual. Qualquer divergência interrompe
a execução. Repetição concluída retorna sem novas alterações.

O Atendimento usa sua ferramenta própria de nomes importados, com o runtime atual,
sessão vigente e recibos da importação original. Não inicia mensagens, conversas ou
automações. A organização empresarial e os contatos múltiplos pertencem ao HUB.
