# Fiscal unificado

Objetivo: configurar uma vez na interface visível e utilizar as mesmas versões na prévia e na montagem da nota.

[Escopo e aceite](SPEC.md) · [Execução e evidências](TASKS.md)

## Contrato

- Fonte canônica: `VersaoEstruturaFiscal`. Não há tabela tributária nova.
- Produtos → Fiscal e Financeiro → Fiscal → Vínculos usam a mesma ficha.
- Rascunho, impacto e aplicação ocorrem na mesma tela. Aplicação revalida sessão, administração, versão, vigência, catálogo e hash dentro da transação.
- A ficha e o motor compartilham `tributacao/ficha.ts` e `tributacao/vigencia.ts`.
- A identidade do grupo cadastrado pode constar da versão de classificação e da regra. O código técnico anterior permanece no histórico e no alcance das regras antigas. Nenhum grupo, ID ou parâmetro é convertido automaticamente.
- Exceção individual prevalece sobre o padrão do grupo. Regras de mesma especificidade bloqueiam a operação e exigem decisão. A regra pode ser desabilitada em nova versão, pela própria ficha, para voltar à herança. Os parâmetros anteriores continuam no histórico.
- Modelo opcional na regra delimita 55 ou 65; sua ausência conserva o alcance anterior. Ausência de `habilitada` conserva a regra habilitada. Destino, regime e destinatário continuam explícitos.
- Novas classificações da ficha não escrevem uma cópia fiscal no JSON comercial. Esse JSON permanece somente para comparação com o cadastro anterior. Os fluxos antigos de gravação comercial fiscal recusam novas alterações.
- Configurações agrega empresa, emissor, certificado, CSC, habilitação e numeração. Cada bloco conserva sua permissão e seus serviços. Certificado local compartilhado não comprova validade no emissor nem CSC de ambos os ambientes.
- Nenhuma abertura de página executa consulta externa, muda contador ou habilita emissão.
- Receitas físicas não criam linhas fiscais por si mesmas. Kits documentados e mercadorias separadas conservam suas políticas e fotografias.

## Conciliação e reversão

Não existe migração automática de parâmetros tributários. Campos novos são opcionais em JSON versionado. Versões anteriores continuam válidas e preservam seus hashes.

1. Fazer backup privado verificável do banco antes da integração operacional. O backup deve incluir versões, eventos, produtos, grupos, documentos e tentativas. Credenciais e dados reais ficam fora do Git.
2. Em Fiscal → Vínculos → Conciliação, executar a simulação. Conferir grupo cadastrado, grupo do motor, classificação ausente e diferenças por campo. As regras individuais mostram destino, destinatário e modelo. Para herança, conferir o contexto na ficha, que usa o mesmo seletor do motor.
3. Resolver cada diferença na ficha correspondente. Não usar o cadastro anterior como decisão tributária automática. Salvar rascunho, conferir o impacto e aplicar com vigência atual ou futura.
4. Comparar a ficha com uma prévia recalculada do pedido. Conferir também o documento montado, sem transmiti-lo para teste.
5. Para reverter uma decisão, abrir a versão anterior no histórico e criar uma nova versão prospectiva. Reaplicar pelo mesmo fluxo. Não editar registros ativos, excluir auditorias ou restaurar todo o banco sobre operações posteriores.
6. Falhas na aplicação revertem toda a transação. Concorrência invalida o impacto. Uma resposta perdida exige consultar o histórico antes de repetir a aplicação.

Séries e contadores permanecem nos serviços existentes. Não há reinício de numeração, alteração de CRT, credenciais, certificado, CSC ou estado operacional nesta entrega.

## Validação e andamento

Implementação em `codex/fiscal-unificado-20261021`, baseada na main pública `b3905d3`.
Resultados executados e limitações estão registrados em [TASKS](TASKS.md).
As [capturas sintéticas](evidencias/README.md) incluem desktop, celular e temas claro/escuro.
Prévia visual usa somente fixtures em `testes/visual/fiscal-unificado*`.
Referências novas permanecem **Em revisão** até avaliação humana.

## Simulação privada por comando

Com Node 22 e `DATABASE_URL` configurada fora dos arquivos versionados:

```powershell
node --import tsx scripts/fiscal-unificado-simular.mjs --schema=public --saida=.tmp/fiscal/unificacao
```

O comando usa uma transação `REPEATABLE READ READ ONLY`. Exporta produtos, grupos,
versões e hashes integrais das linhas de documentos para diretório privado permitido.
Não exporta XML de documentos. A saída de console contém somente contagens, hash e
caminho privado. Não existe opção de aplicação automática. O manifesto contém dados
fiscais privados e não pode entrar no repositório público.

O manifesto não substitui `pg_dump` integral. Antes de uma conciliação operacional,
criar backup privado pelo procedimento de publicação, conferir sua integridade e
ensaiar restauração em outro banco isolado. Nenhum backup ou restore de produção foi
executado nesta tarefa. A reversão funcional foi ensaiada por uma nova versão fiscal,
sem apagar a versão anterior ou alterar documentos.

## Limites preservados

- Não há alteração de schema nem migration SQL nova. Os campos opcionais de grupo, modelo e
  habilitação da regra pertencem ao JSON versionado existente. Ausência preserva o alcance anterior.
- A conciliação real permanece explícita. O vínculo cadastral antigo é exibido para
  comparação até o usuário aplicar uma versão com o grupo desejado. Regras técnicas
  anteriores continuam visíveis e não mudam de alcance automaticamente. Retirar seu
  alcance é uma ação explícita após escolher o grupo cadastrado. A revisão de impacto
  considera os produtos do alcance anterior e do novo.
- A aplicação de versões exige administrador, como no serviço anterior. Permissão
  para renomear um grupo não concede permissão para aplicar tributos.
- A prévia da ficha descreve a representação prevista. A prévia do pedido calcula
  quantidades, escolhas, valores, rateio e impostos com o contexto real da operação.
- Limites existentes de DIFAL/FCP, cálculo de ST e demais operações sem suporte
  continuam sendo pendências do motor. Não foram criados campos comerciais que
  aparentem habilitar cálculos ausentes.
- No pedido analisado, as frutas já pertenciam à política documentada do kit.
  A receita de produção não originou essas linhas automaticamente. Não foi encontrada
  evidência de desmembramento indevido. Nenhuma linha ou CSOSN foi alterado para
  contornar validação. Identificadores e provas reais ficam somente no relatório privado.
- A prévia navegável usa fixtures. Ela não autentica usuários reais, não confirma
  certificado no emissor e não homologa uma emissão na SEFAZ.
