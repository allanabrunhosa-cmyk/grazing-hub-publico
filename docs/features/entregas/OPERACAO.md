# Operação de Entregas

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Acesse **Vendas & Pedidos → Configurações → Entregas** (`/vendas/area-entrega`). Entregas não integra o menu geral de Usuários e Permissões; a rota antiga redireciona. Configuração pertence à loja única existente.

## Configurar — contrato vigente em 03/10/2026

1. Em **Taxa de entrega**, Origem da rota vem de **Dados da empresa**, selecionada por padrão. Complete o endereço estruturado da empresa ou selecione **Origem personalizada** e informe Nome, CEP, Número e Complemento opcional. O mesmo formulário de endereço usa CEP para preencher Logradouro, Bairro, Cidade e Estado. Consulta postal não salva.
2. Em **Veículos**, cadastre Nome, Perfil de rota (Moto/Carro), Slots mínimos e Slots máximos. Capacidades são inclusivas, inteiras de 0 a 999999; veículos ativos não podem ter faixas sobrepostas. Para cada ocupação deve existir exatamente um veículo aplicável. Não há veículo padrão ou regra por embalagem.
3. Em **Frete**, cadastre limites crescentes em km (três casas no máximo) e preço de cada veículo. Colunas têm largura fixa e ficam à esquerda; no celular a tabela rola internamente. Primeira faixa inclui zero, demais começam acima da anterior; cobertura termina na última faixa. Não há campo separado de distância máxima, mínimos, gratuidade ou exceções.
4. Em **Produtos → Editar → Composição → Slots de entrega**, informe a ocupação por unidade (inteiro 0–999999). Vazio significa pendência; zero indica que não ocupa espaço. Quantidades comerciais e produtos vinculados às opções/complementos multiplicam slots; ocupação fracionária é arredondada para cima somente depois de somar todos os itens, com precisão inteira de seis casas no servidor.
5. Clique **Salvar Entregas** para gravar faixas, capacidades, origem e status. Configure a integração de mapas no servidor e confira uma rota real antes de ativar o automático. A ativação exige origem, capacidades e preços completos. Credenciais não entram no formulário; contratação/habilitação externa exige autorização própria.
6. No **Simulador de frete**, informe somente endereço e veículo; a consulta do CEP preenche os campos postais. Usa configuração salva e o mesmo cálculo do pedido, sem criar venda ou movimento. Altere a configuração somente pelo salvamento explícito.

A conversão preserva os preços anteriores como Moto e aplica a transformação de Carro definida na migration versionada. A tabela comercial observada e seus valores ficam no registro privado. Os preços migrados tornam-se células editáveis; a fórmula não é recalculada ao editar a tabela. Slots e capacidades não informados permanecem pendentes. O cálculo continua inativo até a configuração ficar completa.

## Mapas e condições

Adaptador único em `src/lib/vendas/entregas-mapas.ts`: Google Routes `computeRoutes`, recebendo origem/destino completos como `address` e `regionCode: BR`. Routes resolve os endereços na própria chamada; não há pré-validação pela Geocoding API nem confirmação de candidato. Rota principal sugerida, só ida, `TRAFFIC_UNAWARE`, sem alternativas, retorno, múltiplas paradas ou acréscimos de pedágio. Perfis `DRIVE` e `TWO_WHEELER` distintos; moto é beta e apresenta aviso. Distância e duração são estimativas; não representam medição do entregador, cotação de aplicativo ou prazo combinado. [Contrato oficial de endereços em Routes](https://developers.google.com/maps/documentation/routes/specify_location).

Variáveis privadas: `GOOGLE_MAPS_API_KEY` e `GOOGLE_MAPS_ENTREGAS_ATIVADO=1`. Chave deve restringir APIs e acesso do servidor conforme infraestrutura; habilitação de APIs/faturamento exige autorização própria. SDK visual opcional usa **outra chave**, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, restrita por referenciador e Maps JavaScript API. Esta chave é pública por finalidade e entra no build. Sem ela, o cálculo pode operar sem mapa visual e a tela indica a pendência. Não compartilhar a chave privada com o navegador.

No Dokploy, informe a chave pública opcional como argumento de build `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`; o Dockerfile recebe esse argumento apenas na etapa de compilação. Alterá-la exige novo build. As variáveis privadas pertencem ao ambiente de execução do serviço, nunca aos argumentos de build. A publicação inicial deixa ambas as integrações pendentes, sem contratar nem habilitar faturamento.

Limites técnicos padrão: 300 requisições HTTP/dia por loja e 12/minuto por usuário, incluindo geocodificação, rota e cada tentativa. Ajustáveis por `GOOGLE_MAPS_LIMITE_DIA` e `GOOGLE_MAPS_LIMITE_MINUTO`; configurar quotas e alertas próprios também no provedor. Cada chamada tem timeout de 6 segundos e até duas tentativas para rede/429/5xx; 403 não é repetido. Requisições iguais em andamento compartilham execução; não há cache de resultados concluídos. Falha/limite de uso é indisponibilidade, nunca distância zero, gratuidade ou rejeição de área.

Após preencher produtos/quantidades e endereço completo com número, o pedido calcula e preenche Frete automaticamente, sem exigir clique, confirmação de localização ou precisão ROOFTOP. Pedido e Simulador usam o mesmo adaptador. O CEP e os campos continuam usando o cadastro compartilhado; o Google recebe apenas o endereço, sem nome, telefone ou dados comerciais. Falha do provedor ou ausência de rota permanece visível e não vira frete zero. As descrições em Detalhes são os endereços informados, sem afirmar validação geográfica do imóvel; cálculo não altera cadastro.

Esta primeira configuração automática atende endereços brasileiros. Endereços estrangeiros já admitidos no cadastro continuam disponíveis para operação manual; códigos postais/estados estrangeiros não recebem regras de CEP/UF brasileiras. O SDK visual aguarda o callback de carregamento assíncrono, não apenas o evento de download. O carregador compartilhado `src/components/entregas/google-maps-visual.ts` atende o percurso de Entregas e a distribuição do Dashboard, reutilizando o SDK disponível ou uma única carga em andamento. Ele não consulta endereços nem persiste coordenadas. Os resultados e candidatos exibem os arquivos oficiais de atribuição Google Maps, sem alterações, com contraste para os temas existentes.

**Política de retenção adotada:** coordenadas, descrições geocodificadas, distâncias, duração e polylines não entram no banco, auditoria, rascunho ou recibo. A interface elimina o resultado corrente após 10 minutos. Place IDs de Routes são transitórios; não existem desafios de confirmação de localização. Não há cache persistente de conteúdo Google. Snapshot conserva somente endereço informado pelo operador, origem própria, configuração, decisão comercial, faixa/exceção e preços próprios. Por isso o histórico não apresenta distância/duração passada. Não ampliar essa retenção sem revisar os termos. Mapa visual usa Google Maps, atribuição próxima ao conteúdo; termos e privacidade públicos em `/termos-mapas` e `/privacidade-mapas`.

Fontes oficiais consultadas em 30/09/2026: [políticas Routes](https://developers.google.com/maps/documentation/routes/policies), [condições específicas](https://cloud.google.com/maps-platform/terms/maps-service-terms), [cobertura de moto](https://developers.google.com/maps/documentation/routes/coverage-two-wheeled), [rotas de moto](https://developers.google.com/maps/documentation/routes/route_two_wheel), [preços](https://developers.google.com/maps/billing-and-pricing/pricing). Brasil suporta moto. Referência de tabela global (USD, por 1.000 eventos no primeiro escalão): Routes Essentials e Geocoding US$ 5 com franquia mensal de 10.000 em cada SKU; Routes Enterprise, aplicável a TWO_WHEELER, US$ 15 com franquia de 1.000. Não constitui contratação nem estimativa de gasto; condições da conta/região e futuras alterações precisam ser conferidas antes de habilitar. Lat/lng têm permissão limitada de cache de 30 dias e Place IDs possuem exceção de retenção; a implementação escolhe não persistir conteúdo geográfico.

## Pedido, contingência e custo

Selecione Entrega ou Retirada. Retirada força frete zero e não chama mapas. No Novo Pedido, **Tipo de veículo** e **Frete** ficam em uma linha após os produtos e antes de cupom/desconto/outros custos. Com a configuração automática ativa e endereço/itens completos, o preenchimento calcula o frete após 600 ms de pausa, sem depender de cliente salvo, canal, destinatário, cobrança, agenda ou pagamento. Dados incompletos permanecem pendentes; não aparecem como frete gratuito. Pedidos confirmados conservam seu registro ao abrir. Detalhes, recálculo explícito e justificativas ficam no popup de frete, sem sair do Gestor; abrir o popup não é necessário para calcular.

Desde 20/10/2026, o operador pode escolher um veículo ativo no campo Tipo de veículo.
A escolha vale somente para aquela entrega e permite produtos sem slots ou veículo
diferente da indicação. Voltar à opção indicada restaura a seleção por slots.
A troca invalida o recibo e recalcula perfil de rota e preço. O servidor verifica o
veículo na configuração; não aceita perfil informado pelo navegador.
Alterar cliente, canal, endereço, itens, desconto ou modalidade também invalida o
resultado. O ajuste manual de preço conserva motivo e permissão próprios.
O recibo assinado dura 10 minutos e vincula loja, usuário, cliente, destino, origem,
veículo, escolha e versão. Alterar configuração/origem exige novo cálculo.
O simulador não gera recibo reutilizável em pedido.

Permissões independentes: `vendas.area-entrega` visualizar/editar configurações; `vendas.pedidos.frete.editar` preço manual; `vendas.pedidos.cobertura.editar` aprovação excepcional de região bloqueada/fora da área; `vendas.pedidos.logistica.editar` custos. Todas as gravações revalidam usuário ativo, versão de sessão e perfil no servidor. Administrador do sistema mantém acesso; outros perfis precisam de concessão explícita.

Para contingência, altere o campo **Frete** e informe a justificativa no popup de frete. A linha sinaliza o ajuste e conserva o valor calculado de referência, quando disponível. Com mapas operantes, primeiro calcule cobertura. Sem mapas, ausência de validação fica explícita. No modelo vigente, ajustar preço não libera cobertura e não existe aprovação de exceção: a última faixa de Frete delimita o atendimento. Aprovações anteriores continuam somente no histórico. No modelo vigente não há pedido mínimo ou gratuidade automática. Sem escolha explícita, slots pendentes ou ausência de capacidade aplicável impedem nova confirmação. Escolher veículo ativo permite aquela entrega sem slots completos; preço manual conserva sua permissão. Sem configuração criada, o valor legado continua disponível sem fabricar uma instrução manual justificada.

Confirmados conservam o snapshot mesmo após mudança da tabela. Alterações comerciais posteriores usam **Registrar revisão**; histórico conserva valores anteriores, usuário, horário e justificativas. Registros anteriores à funcionalidade não são recalculados nem invalidados. Sem configuração criada, o frete legado segue disponível; com configuração, novas decisões usam cálculo ou contingência justificada. O prazo/data combinados, estoque, calendário, produção, financeiro e cancelamentos mantêm seus fluxos existentes.

Uma revisão de pedido histórico sem snapshot preserva o frete se cliente, modalidade, endereço, subtotal após descontos e frete permanecerem iguais. A auditoria identifica a origem legada e a ausência de validação automática. Alterar essas entradas exige a nova validação; outros custos existentes continuam compondo o total e não interferem na escolha do veículo por slots ou no preço da matriz de frete.

Em **Custo logístico** de uma entrega confirmada, informe custo estimado e/ou efetivo, prestador opcional do cadastro existente de fornecedores e justificativa; clique **Registrar custo da entrega**. Vazio significa desconhecido; zero só quando informado. “Saldo do frete” = frete cobrado menos custo efetivo; não é lucro líquido. O comando usa versão e chave idempotente, registra antes/depois e não cria conta a pagar ou lançamento.

## Banco e reversão

Migration aditiva `20261001010000_entregas_rota`: configuração/versionamento nullable/default zero, snapshot nullable, custos nullable, FK opcional para Fornecedor e contadores efêmeros de uso. Nenhum pedido é atualizado pela migration. Validada aplicando todas as migrations em PostgreSQL local exclusivo com dados fictícios.

Antes de publicar, seguir [deploy](../../contexto/deploy.md): backup privado verificável, imagem anterior, push fast-forward e estabilização do serviço. Reversão preferencial é código revisado; colunas aditivas podem permanecer. Não apagar custos/histórico nem restaurar dump sobre pedidos novos. Desativar cálculo automático não altera snapshots nem retira o fluxo manual. Situação da publicação e evidências em [TASKS](TASKS.md).

## Compatibilidade e reversão do modelo anterior

`TipoEmbalagemVenda`, vínculo antigo do produto e campos internos de snapshots permanecem para conservar histórico; as interfaces vigentes não os utilizam na seleção de veículo. A lógica anterior é preservada somente para contratos antigos e testes de compatibilidade. Novos pedidos usam `modelo: SLOTS` e capacidade do veículo. Revisões sem mudança da decisão comercial conservam os registros anteriores, inclusive slots por unidade já fotografados, mesmo quando o catálogo mudou.

A migration `20261003120000_entregas_slots_frete` acrescenta `ProdutoVenda.slotsEntrega`, `ConfiguracaoLoja.enderecoEstruturado` e `entregasAntesSlots`, preserva o JSON anterior e converte a matriz com auditoria/versionamento. Não atualiza pedidos históricos. Reverter para código compatível com o schema e o modelo novo; a imagem anterior não compreende a nova matriz de preços, portanto não a recolocar cegamente nem restaurar dump sobre pedidos posteriores.

Para QA local use a prévia sintética `node_modules/vite/bin/vite.js --config testes/visual/vite.entregas-slots.config.mts`, página `http://127.0.0.1:4237/entregas-slots.html`. Dados, CEP e ações são simulados. Para smoke da aplicação compilada use banco exclusivo fictício e sessão sintética; no host dedicado, `pedidos.localhost:<porta>`. [Execução e evidências](TASKS.md).
