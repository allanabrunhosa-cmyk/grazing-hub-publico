# Execução — cadastro comprador e relatórios

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

- [x] Diagnóstico em leitura: exclusão indevida de históricos com FK explícito no BI.
- [x] Decisão do usuário: preservar destinos reais anteriores e manter os titulares
  sem CNPJ comprovado pendentes. Não inferir CNPJ por endereço compartilhado.
- [x] BI: fonte canônica, busca de clientes e regressões de URL/CSV/permissões.
  Evidência parcial: 112 testes de backend e 11 integrações PostgreSQL aprovados;
  7 testes de interface aprovados. As validações finais abrangem os ajustes seguintes.
- [x] Livro de entregas e cobranças pendentes: domínio e consumidores concluídos.
  Domínio/helpers: 53 testes; Editor: 40; formulário de Clientes: 21; histórico: 19.
  Confirmação bloqueia também o titular pendente derivado do cadastro legado.
- [x] Reconciliação: 38 testes unitários/CLI e 7 integrações PostgreSQL aprovados.
  Incluem transferência de reserva, reversão, auditoria SISTEMA, versões, concorrência,
  transações em leitura e preservação de pedidos/fontes/fiscal. Schema sintético removido.
- [x] Lint dos arquivos alterados, lint:design, typecheck e build webpack aprovados.
  Build final Node 22: 105 páginas. Nenhum baseline visual foi aprovado ou renovado.
- [x] Capturas isoladas de BI, Clientes, Pedidos e histórico inspecionadas. Temas
  claro/escuro, telas pequenas/grandes, seleção, busca, pendente, vazio e erro.
  Auditor sem problemas ativos; controles temporariamente ocultos pelo popup BaseUI
  estão discriminados nos relatórios privados. Referências permanecem Em revisão.
  Registro visual: 0 aprovadas; 10 cenários consultivos passaram sem atualizar baseline.
- [x] Backup privado criado e catálogo do dump verificado no servidor em 20/10/2026.
- [x] Fontes e configuração inicial processadas no próprio servidor. Nenhum cadastro
  real exportado para o ambiente local ou versionado.
- [x] Prévia inicial revisada em leitura: fontes, versões e políticas explícitas,
  sem bloqueios. A prévia final será vinculada ao artefato versionado antes de aplicar.
  A conferência identificou a política histórica de fretes negativos. A nota do cliente
  passou a mostrar total original comprovado e ajustes separados, sem inventar desconto.
  Regressão final BI: 119 backend, 11 PostgreSQL, 14 interface e 4 capturas da nota.
- [x] Aplicação cadastral concluída pela prévia vinculada ao commit, manifesto de
  460 arquivos, backup e aprovação técnica. Uma operação e uma atividade SISTEMA
  registradas. Nome, Principal, versões, opções e pendências conferem com a prévia.
  Todos os destinos reais estão presentes. Nenhum CNPJ foi presumido.
  Fotografias antes/depois confirmam pedidos, fontes, financeiro, fiscal, estoque,
  contatos e demais clientes intactos. Não há duplicidade canônica de e-mail/documento.
- [x] Publicação autorizada concluída em 20/10/2026:
  commit funcional `c4a5163465589ff2afd11ddab41c07faebfadcfe` na main e na branch;
  tarefa `oarxknxf10lg2m57kh55m56a0`, contêiner `2dc94076ee72`, imagem
  `sha256:872e11a207afcab670c622980aa0cbe8b4729a65429d2e6d6af996df4d9a5515`.
  Código conferido em 12 arquivos, migrations atualizadas, 129 segundos estáveis
  e zero reinícios. Configuração fiscal preservada, certificado no banco.
  HTTPS: login 200; BI/Clientes/Pedidos sem sessão retornam 307 para login.
  UI autenticada: busca e filtro do comprador, totais originais/ajustes, cadastro
  único, Principal fixada e última opção de cobrança conferidos sem salvar.
  A nota não representa conciliação financeira; valores e pedidos não foram reescritos.

Regressão ampla de Vendas: 140 arquivos e 1.638 testes passaram; 13 arquivos/254 testes
de integração exigem opt-in. Uma asserção carregada durante a última guarda de cobrança
falhou; a revisão final passou nos 27 testes do arquivo afetado e do consumidor servidor.
As integrações BI e reconciliação foram executadas separadamente no banco local isolado.

Migration aplicada pelo executor oficial, plano
`916469ee3fbfcdc4f409f5d786754908996d4051aa493f27fa885bc558de33e9`, SQL
`0c91fc01810da381a1e3226866b304737137ee01c1041861493b2cdef03fe9dc`.
Dump privado íntegro e catálogo verificado. Configuração cadastral e snapshot fiscal
foram separados em arquivos privados distintos; o snapshot fiscal anterior à troca
também confere com a referência preservada da publicação anterior.

Encerramento: cluster PostgreSQL de teste e prévias próprias encerrados; arquivos,
bancos e caches úteis preservados. Check de armazenamento: 30,12 GB livres, nível normal.
A worktree permanece preservada fora da lista explícita de limpeza. Nenhuma referência
visual foi aprovada em nome do responsável. A evidência pós-publicação fica apenas na
branch de trabalho; não exige novo deploy documental.

Concluído. Titulares sem CNPJ comprovado permanecem pendentes por decisão explícita do
usuário. Preencher esses CNPJs é uma etapa cadastral futura; não altera pedidos anteriores.

## Endereços únicos e completos — 20/10/2026

- [x] Decisão do usuário: retirar opções incompletas do cadastro ativo. Preservar
  os dados originais nos pedidos e na auditoria. Não presumir CNPJ ou destino.
- [x] Diagnóstico agregado em leitura. Nenhum cadastro individual foi exportado.
- [x] Novo backup privado verificado no servidor antes da correção.
- [x] Chave postal compartilhada, validação de obrigatórios e prova CNPJ no servidor.
- [x] Seletores equivalentes, inclusão temporária e confirmação antes de excluir.
- [x] Saneamento com prévia, auditoria, versões, idempotência e reversão.
- [x] Testes de domínio, consumidores, PostgreSQL, imagens, lint, tipos e build.
- [x] Publicação estável, saneamento aplicado e conferência em produção.

Validação executada: 112 testes PostgreSQL em base local isolada; 40 testes de
consulta CNPJ/prova/persistência; 29 de saneamento; consumidores de Clientes e
Pedidos aprovados. Rodada ampla: 142 arquivos e 1.721 testes passaram. Nove
asserções antigas presumiam asteriscos em campos opcionais; as fixtures foram
alinhadas ao contrato explícito. O teste de junction exigiu execução fora do
isolamento restrito do Windows. Retestes dos quatro arquivos: 27/27 aprovados.
Os 14 arquivos/258 testes opt-in da rodada ampla não representam validação executada;
as integrações pertinentes foram executadas separadamente.

Imagens: 100 capturas sintéticas nos temas claro/escuro e em 320/390/768/1440 px.
Auditor sem problemas ativos. Os 24 avisos referem-se a controles ocultos pelo popup.
Consulta pendente/erro, leitura, duplicidade, confirmação e teclado conferidos.
Último ajuste de foco: 10/10 regressões aprovadas após a edição final. Nenhuma
referência visual foi promovida. Prévias próprias encerradas.

O diagnóstico real encontrou resposta HTML na BrasilAPI dentro do Node da aplicação.
A alternativa Minha Receita foi comprovada em leitura. A prévia anterior permaneceu
bloqueada e não gravou dados. A prévia final foi confirmada antes de aplicar: 11 cobranças e 99 entregas;
remove seis cobranças incompletas, consolida 11 cobranças repetidas, remove 55 entregas
incompletas, consolida oito entregas repetidas e inclui 11 cópias completas das cobranças.
Os pedidos históricos preservam seus snapshots e não recebem o CNPJ Principal por
fallback. Revisão desse caminho: 90 testes existentes aprovados.

Lint dos arquivos alterados, lint:design e typecheck global aprovados. Build final
webpack com Node 22 aprovado: 105 páginas. O isolamento do Windows impediu a primeira
criação de tipos; a repetição autorizada na própria worktree concluiu a compilação.

Integração com a atualização `9eb030a9`: merge sem conflitos funcionais, preservando
dashboard e emissão fiscal. Consumidores da interface: 68/68 aprovados. Fiscal/BI:
272 testes aprovados; um arquivo sofreu timeout durante build concorrente e passou
58/58 na repetição isolada, com o limite original. A revisão encontrou divergência
na prévia fiscal: nome/documento vinham do comprador, enquanto a emissão usava a
cobrança selecionada. O DTO agora usa a mesma identidade da emissão e escolhe o
nome pelo tipo. Regressões PJ/PF e titular ausente passaram: 51/51, sem transmissão,
escrita ou alteração de snapshots. Lint focado aprovado.

Publicação e saneamento concluídos em 20/10/2026. Commit funcional
`192be8cb0ac08a43a62bd613286cb62d275ddb70` confirmado na main e na branch.
Build webpack final após o ajuste fiscal: 105 páginas e TypeScript aprovados.
Tarefa `kg6gdlep94l80x36b4kn8pija`, contêiner `eb79ca5e9d4d`, imagem
`sha256:3d797502d3702381c401e0810b32b98f41c4bf5e607ebade5f678b84a4403c2b`.
Código conferido em 13 arquivos; migrations atualizadas, 132 segundos estáveis
e zero reinícios. Configuração fiscal preservada; certificado permanece no banco.

Backup privado íntegro: `etiquetas-clientes-enderecos-20261020-1230`,
122.321.145 bytes, 1.135 itens de catálogo. SHA256
`2afa1e4ef7655e8064f230c04c12af5d819669181e01d23ddaa0b87003916647`.
Prévia vinculada ao manifesto de 467 arquivos e à revisão publicada. Aplicação
conferida com uma auditoria e uma atividade SISTEMA. Reversão protegida disponível;
nenhuma reversão foi executada.

Resultado da execução: cobranças e entregas foram saneadas conforme a prévia privada.
conferem integralmente com a prévia. Não há opções incompletas ou repetidas.
Não há e-mails ou documentos duplicados entre os cadastros canônicos. Identidade
e Principal preservadas. Os pedidos e seu total original permanecem intactos; as contagens e os valores reais estão no registro privado. Fingerprints antes/depois confirmam pedidos, fontes, fiscal,
financeiro, estoque, contatos e demais clientes sem alterações.

HTTPS: login 200; BI/Clientes/Pedidos sem sessão retornam 307 para login.
UI autenticada: um cadastro na busca, Principal sem edição e seletores com
11 cobranças e 99 entregas. Conferência somente em leitura; modal fechado sem
salvar. Inclusão, obrigatórios, duplicidade, exclusão e foco foram testados com
dados sintéticos. Nenhuma emissão ou cancelamento fiscal foi realizado.

Evidência posterior à publicação segue apenas na branch, sem outro deploy.
Cluster PostgreSQL e prévias próprios encerrados. Worktree, arquivos privados,
banco de teste e caches úteis preservados; nenhuma cópia foi removida.
Encerramento conferido: portas próprias sem escuta, PID do banco ausente e
arquivos do banco preservados. C: com 29,64 GB livres. A worktree está fora da
lista permitida de limpeza; o catálogo não foi ampliado e nenhum cache foi excluído.

## Destinos equivalentes na base histórica — 20/10/2026

- [x] Diagnóstico de todos os livros ativos e dos livros de cobrança dos pedidos.
- [x] Revisão dirigida das diferenças de complemento, abreviação, título e CEP.
- [x] Novo backup privado íntegro antes desta correção.
- [x] Comparação segura e projeção das opções históricas sem alterar snapshots.
- [x] Operação dirigida por grupos e hashes, com auditoria e reversão.
- [x] Testes de domínio, consumidores, PostgreSQL, imagens, lint, tipos e build.
- [x] Publicação estável, aplicação e conferência em produção.

Diagnóstico processado somente no servidor. O livro de entrega ainda conservava
referências comerciais como complemento e CEPs divergentes. A comparação literal
anterior não bastava para reconhecer o mesmo imóvel. Dez CEPs conflitantes foram
consultados em leitura. A revisão separou 22 grupos equivalentes, com 44 opções
redundantes, de um grupo com prédios A/B que deve permanecer distinto. Previsão
de 99 para 55 entregas; não representa aplicação concluída.

Testes executados: 58 de comparação e consumidores diretos, 77 de projeção e
consumidores da interface, 41 unitários da operação/CLI, quatro integrações em
PostgreSQL isolado e 15 de cadastro/persistência. A primeira rodada PG detectou
uma expectativa incompleta de array na fixture; corrigida a expectativa, 4/4
passaram sem alterar a implementação. A revisão detectou risco no parser de
unidades ordinais/listas. A correção preserva andares distintos e bloqueia
formatos ambíguos; regressões finais aprovadas.

Typecheck global aprovado. Lint:design sem desvios novos. Capturas sintéticas:
16 imagens em 320/390/768/1440 px, claro/escuro, menu aberto e após Escape.
Auditor com zero problemas ativos ou ocultos. Titular, documento e índice
fotografados preservados; nenhum callback de edição ao abrir. Referências
permanecem Em revisão. Prévia própria encerrada.

Concluído em 20/10/2026. Build final Node 22/webpack: 105 páginas e TypeScript
aprovados. Lint final dos 11 arquivos de código/teste aprovado. Commit funcional
`ef1161efc69c46cabb43404e8faa6722d780669b` confirmado na main e na branch.
Tarefa `w2k5en4dprdgi51dzbak7s22p`, contêiner `7bbe946dbe73`, imagem
`sha256:beaa7f93733aa5f34c397ca275d9325168ff6ec878e48c158b9e2d14cdb7fd2f`.
Seis arquivos de servidor conferidos, migrations atualizadas, 154 segundos estáveis
e zero reinícios. Configuração fiscal preservada; certificado permanece no banco.
O runner contém o bundle da interface, sem os fontes `src/app`; a interface foi
conferida pelo navegador autenticado e pela prévia sintética.

Backup privado `etiquetas-clientes-equivalencias-20261020`: 122.355.657 bytes,
1.135 itens de catálogo. SHA256
`2818e8f94e2b235dcf329b1fbec6672f48e129acbe8c8ff12ccdc352fe48082e`.
Prévia imutável de 470 arquivos, revisão publicada e plano de 22 grupos conferidos.
Aplicação concluída: 99→55 entregas, 44 opções absorvidas e 14 complementos
ajustados. Uma auditoria e uma atividade SISTEMA registradas. Reversão protegida
disponível; nenhuma reversão executada.

As 3 (exemplo sintético) cobranças, a Principal, o destinatário selecionado e os itens fora dos
grupos permanecem preservados. O único grupo local restante tem prédios A/B
distintos, com suas opções originais. A conferência do exemplo solicitado encontrou
uma única opção. Fingerprints antes/depois confirmam a preservação dos pedidos e de seu total original, cujos valores ficam no registro privado, auditorias anteriores
e demais clientes sem alterações. Não há opções incompletas ou repetidas nem
e-mails/documentos duplicados entre os cadastros canônicos.

Varredura adicional das cobranças ativas e dos livros de cobrança dos pedidos e
rascunhos: nenhum outro grupo equivalente. UI autenticada: livro com 55 entregas
em Clientes e Novo Pedido; busca pelo exemplo retorna uma opção em ambas as telas.
Conferência sem salvar cadastro ou pedido. HTTPS: login 200 e BI/Clientes/Pedidos
sem sessão retornam 307 para login. Nenhuma emissão ou operação financeira realizada.

Encerramento: prévias próprias e cluster de teste parados; portas sem escuta,
PID do banco ausente, arquivos de teste preservados. C: com 29,70 GB livres.
Worktree fora da lista permitida de limpeza; arquivos privados, bancos e caches
úteis preservados. Nenhuma cópia removida. Evidências posteriores seguem somente
na branch, sem outro deploy documental.
