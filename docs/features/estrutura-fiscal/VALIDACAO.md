# Evidências da validação fiscal

Validação técnica em 12/10/2026, antes da publicação. Resultados externos e internos
são registrados separadamente. Não houve transmissão de documento fiscal real,
habilitação de autoemissão ou substituição do Takeat.

## Execuções locais

| Execução | Resultado comprovado |
| --- | --- |
| Regressão global, 374 arquivos, 755,57 s | 3.537 testes aprovados; 455 testes opcionais ignorados; nenhuma falha; processo encerrou com código 0 |
| Última revisão do motor/complementos e consumidores fiscais, 9 arquivos | 219 aprovados, nenhum ignorado; inclui 39 testes do motor e integração SQL de pedidos fiscais |
| Auditoria fiscal, gestão de acessos e dashboard em PostgreSQL, 3 arquivos | 26 aprovados, nenhum ignorado |
| Adaptador, leiaute RTC, impostos e destinatário | 97 aprovados, nenhum ignorado; limite unitário, quantidade, IE, metadados e campos incompatíveis bloqueados antes de HTTP fiscal |
| Editor e regras de interface RTC | 9 aprovados; ESLint e lint de design sem novos problemas |
| Compilação final webpack e tipos Next | Aprovada; rotas fiscais canônicas incluídas |

Não somar essas linhas como testes diferentes: há sobreposição entre execuções.
Os 455 casos ignorados na rodada global não são aprovações. As integrações SQL
diretamente afetadas foram executadas com habilitação explícita, em banco fictício
local e schemas exclusivos. As outras integrações opcionais mantêm seus limites.

O último ajuste de complemento foi posterior à leitura do motor pela rodada global;
a verificação de 219 casos e a recompilação foram realizadas depois desse ajuste.
Mercadoria vinculada gratuita exige tratamento comprovado; ausência de ingrediente
sem mercadoria permanece opção de configuração. Preço/quantidade comerciais são preservados.

As quatro falhas de arquivos da primeira rodada foram corrigidas e verificadas:
espera assíncrona de seletor, sessão HTTP sintética nos testes de pedidos/financeiro
e expectativa comercial antiga que sobrescrevia parâmetros fiscais individuais.
Nenhuma asserção de permissão, transação, reserva ou precisão foi removida.

## Segurança, preservação e precisão

- Administrador, usuário ativo, versão da sessão e permissões são relidos no servidor.
  Concorrência/idempotência, impacto desatualizado e rollback da auditoria são cobertos.
- Versões, snapshots, identidade fiscal e protocolos confirmados são preservados.
  Cancelamento fiscal possui protocolo próprio e não equivale a estorno ou cancelamento comercial.
- Takeat é reconferido antes do envio e no processamento da fila. Resultado incerto
  não autoriza reenvio por ausência isolada no provedor.
- A IE fotografada do perfil é confrontada com BuscarEmpresa antes da prévia/envio;
  divergência ou ausência interrompe o endpoint fiscal. Documentos legados sem esse
  campo adicional conservam seus snapshots; nenhuma IE externa foi editada pelo teste.
- Quantidade fiscal: até 11 inteiros e quatro casas efetivas; unitários: até 11
  inteiros e dez casas. Conversão numérica não pode mudar valores silenciosamente.
- IBS/CBS de 2027 são decompostos do preço final, sem acrescê-los novamente ao total.
  Política de rateio e eventual exceção normativa de base ICMS exigem configuração versionada.
  Sem fechamento em centavos, campos comprovados ou homologação do leiaute, o caso fica pendente.
- Arquivos privados, catálogo operacional e credenciais ficaram fora dos arquivos
  preparados no Git; busca dos dois tokens fornecidos não encontrou vazamento.

## Ambiente externo Brasil NFe

Prévias fictícias 55/65 tiveram XML/PDF, valores, GTIN e informações complementares
conferidos. Uma transmissão fictícia de NF-e 55 em homologação recebeu rejeição 209
por IE do emitente; consulta confirmou o resultado, sem protocolo de autorização.
Não houve reenvio ou cancelamento externo. A correção cadastral aguarda autorização
específica; a NFC-e depende também de CSC comprovado.

Isso é homologação parcial. Autorização, arquivos autorizados e cancelamento externo
ainda não foram homologados. O leiaute RTC futuro não foi comprovado no provedor;
o [aviso ENCAT/SVRS](https://dfe-portal.svrs.rs.gov.br/Nfe/Avisos/3008)
prevê 26/10/2026 em homologação e 16/11/2026 em produção. Testes matemáticos de 2027
usam percentuais e contratos fictícios, sem afirmar alíquotas legais ou suporte externo.

## Registro privado e implantação

Os relatórios completos estão em .tmp/fiscal, ignorada pelo Git:
regressao-global-publicacao.log/json, regressao-global-publicacao-encerramento.json,
regressao-tributacao-ultima.log/json, seguranca-dashboard-publicacao.log/json,
build-ie-final.log, consumidor-ie-final.log e os logs focados do adaptador/editor.
O comprovante de backup registra leitura integral do dump por pg_restore,
sem restauração de dados, e SHA-256 conferido. A imagem anterior possui ID imutável.

Publicação, estabilidade do contêiner, migrations, carga e smoke autenticado foram
confirmados depois destes testes, com recibos privados e código comparado por hashes.
Produção Node 22.23.3 executa f833bcaf; 222 versões/197 ativas, cadastro comercial
idêntico, zero documentos criados. Exportação da interface foi lida integralmente:
129 linhas, nenhuma falha de CSV e os mesmos totais do painel.
Dados operacionais e matriz completa permanecem privados, fora do Git.
[Execução](TASKS.md), [cobertura](COBERTURA.md),
[operação e primeira emissão](OPERACAO.md), [contrato do provedor](BRASIL_NFE.md).

## Vínculos fiscais comerciais — 12/10/2026

- SQL/CLI: 14/14 testes aprovados com `VINCULOS_FISCAIS_BANCO_TESTE=1`, banco
  local fictício `teste_estrutura_fiscal` e schemas efêmeros. Cobrem autorização,
  backup/hash, versões vigentes, candidatos, kits, conflitos, dados desconhecidos,
  precisão exata de inteiros/decimais JSONB, auditoria, rollback e idempotência.
  Caso KIT revalidado após incluir pesoRateio na fixture: 1/1 aprovado.
- Consumidores da tela: 17/17 em `vinculos-fiscais-pagina.test.tsx` e
  `vinculos-fiscais-interface.test.tsx`; fixtures, sem cadastros reais.
- Lint, typecheck e diff-check finais sem erros. Build webpack concluído. A primeira
  tentativa de build foi bloqueada por acesso do sandbox ao caminho das dependências;
  a execução autorizada seguinte concluiu. Não houve mudança em código Next/UI.
- Revisão independente dos contratos corrigiu replay indevido, gravação privada
  posterior ao commit, arredondamento de JSONB desconhecido e NCM único em kit.
  O script final usa patch SQL apenas nos campos permitidos e fotos exatas do JSONB.
- Prévia real de produção sem escrita: 129 alterações, 17 NCMs, dois auxiliares,
  zero conflitos. Recibo confirmou a aplicação e a auditoria; conferência posterior
  somente leitura retornou zero alterações. Dados comerciais, inativos, composições,
  opções, versões e documentos preservados por hashes. Não houve transmissão fiscal.
- Interface autenticada: Produtos mostra três vínculos preenchidos, incluindo
  Alma Negra 22042100/GF10; Complementos mostra 17, incluindo mortadela e salame
  16010000/GF05. Há sobreposição de papéis; são 17 registros únicos com NCM.

Logs privados: `regressao-vinculos-cadastro-final.log/json`,
`regressao-vinculos-kit-final.log`, `consumidores-vinculos.log`, `build-vinculos.log`,
`typecheck-vinculos-revisao-final.log`, `lint-vinculos-final.log`,
`plano-vinculos-producao-resumo.json` e `recibo-vinculos-producao.json`.

## Parâmetros cadastrais — outubro de 2026

Revisão funcional `c8b2ad4e`, integrada à main atual de Validades. O lote administrativo
reutiliza os serviços de persistência, classificação, impacto e ativação. Nenhum cliente
de transmissão é importado pelo CLI. GTIN foi retirado da carga por instrução expressa;
os valores existentes e as guardas de emissão permanecem.

A regressão de domínio e consumidores aprovou 2.110 testes em 98 arquivos. Os quatro
testes novos do lote foram reexecutados após corrigir a fixture para reutilizar GF05
criado pela migration: 4/4 aprovados. Cobrem simulação revertida, sincronização da
classificação, revisão cadastral, auditoria com permissão fiscal, preço preservado,
replay sem escrita, NCM preservado, sessão revogada, concorrência e delegação Validades.
Três suítes gerais de atividades exigem cluster próprio em 55441; a primeira tentativa
usou o cluster fiscal 55449 e foi recusada pelas guardas, sem alterar suas asserções.
Não contabilizar esses hooks recusados como testes aprovados. No cluster próprio,
os 21 testes de integração restantes passaram. O benchmark identificou uma atividade
de migração anterior à carga; sua asserção agora mede o acréscimo exato de 100 mil
fatos, sem apagar a atividade anterior ou afrouxar a quantidade esperada. O teste
passou na nova execução. A metodologia registra a durabilidade efetiva do cluster;
não extrapolar suas latências locais para a produção.

O defeito de projeção foi reproduzido com SQLSTATE 22023. A migration aditiva restaura
a fonte fiscal e conserva o projetor de Validades. O teste fiscal isolado que falhava
passou depois da correção; a regressão fiscal completa também passou. Não houve
alteração em migrations antigas. Lint e typecheck concluíram sem erros. A compilação
webpack da revisão integrada concluiu; avisos existentes de middleware/Edge permanecem.

Logs, matriz, XMLs selecionados, backup e recibos ficam privados em `.tmp/fiscal`.
Este registro de testes não comprova carga, publicação ou homologação externa.
