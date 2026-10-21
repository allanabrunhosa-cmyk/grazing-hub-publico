# Etiquetas de validade e impressão térmica

Implementação adaptada do material Kairu `library:impressao-etiquetas`, sem catálogo paralelo e sem movimentação de estoque.

## Interface de Validades — linha visual de 16/10/2026

A arte aprovada de Gestão orienta hierarquia, superfícies leves e estados por cor.
O hero decorativo foi removido do escopo por decisão explícita do usuário.
`validades.css` aplica a composição somente ao módulo; reutiliza Card, Button,
Dialog, Table, Tabs e CampoBusca da Central.

- **Imprimir etiquetas** é o nome da seção no menu e no título. Emissão mantém
  **Responsável → Produto → Etiqueta**, à esquerda de Imprimir/Histórico na mesma
  faixa. Em telas estreitas os números preservam os nomes acessíveis e o título
  do passo atual; a faixa quebra somente quando não cabe.
- Produto usa abas sequenciais **Grupo → Produto → Conservação**. Clicar no grupo
  avança ao produto; selecionar o item avança à conservação. Só a aba atual aparece.
  Cartões individuais e seleção em grupo reutilizam a foto cadastrada; ausência
  ou falha mostra ícone de apoio, mantendo o nome como identificação principal.
  A busca permanece montada desde Grupo: digitar consulta todos os grupos e mostra
  Produto; apagar tudo retorna a Grupo. O foco da busca permanece durante a digitação.
  Mudar grupo/busca limpa a seleção/preparação anterior. Conservação não é dispensada.
- **Lista de produtos**, dentro de Produto, abre no clique. Separa Com cadastro e
  Sem cadastro e mostra Nome, Tipo, Status, Ambiente, Refrigerado e Congelado.
  Cadastro significa ter ao menos um prazo positivo; não significa autorização
  de impressão. Itens inativos/desabilitados continuam consultáveis, sem seleção.
  A lista não cria prazos nem sugere valores para campos vazios.
- Gestão: o card de produto revela seus registros. Um registro isolado abre
  **Ver etiqueta**. Com várias cópias, **Dar baixa** abre a janela de quantidade
  e confirmação. Com uma única cópia restante, registra diretamente no card ou
  no detalhe. O detalhe usa o snapshot e informa a confirmação física separadamente.
  O link Histórico e reimpressão abre o fluxo existente.
- Vencida é crítica, hoje é alerta, amanhã é preventivo e em dia é neutro.
  Contagens consideram cópias, filtros, baixas e o fuso do snapshot.
- Monitoria agrupa pelo ID do Insumo/Preparação, após aplicar filtros. O card
  começa recolhido; o clique revela registros e os seus lotes, datas e responsáveis.
  Nomes iguais com IDs diferentes não se misturam. Sem ID, cada registro permanece
  separado. O atalho de um grupo com várias etiquetas revela a escolha individual;
  não executa baixa em lote. A operação mantém a ação e auditoria existentes.
- Cabeçalho e três etapas usam composição compacta. Indicadores filtram o período;
  Todas remove esse recorte. Busca e ações ficam juntas; ordenação e filtros
  complementares aparecem ao expandir Filtros. Abas quebram linha sem rolagem interna.
- Grade/lista e ordenação por validade, nome ou manipulação não gravam dados.
  Configurações, prazos e histórico usam a mesma composição. Tabelas mantêm
  rolagem interna em telas pequenas; o detalhe tem rolagem contida.
- Fotos são as já cadastradas no Insumo/Preparação. O GET privado de Produção
  exige sessão/permissão e ID delimitado. Ausência ou falha usa ícone, sem inventar
  imagem. A rota do conector continua com sua autenticação própria.

A etapa final chama-se **Etiqueta**. A prévia não repete título/subtítulo acima do
papel. Em desktop com duas colunas (a partir de 1280 CSS px), o SVG preserva a
proporção e se limita à altura real disponível até a base da lateral. ResizeObserver
acompanha largura/mudanças de conteúdo e resize acompanha a janela. O teto visual
permanece 480px; telas menores mantêm a prévia proporcional e rolagem natural.
Esse dimensionamento é apenas de apresentação; não altera milímetros, DPI, fontes
ou ZPL. A foto usa a rota privada já existente, sem carregar fotoData na listagem.

Esta frente não altera ZPL/template 4, conector, Raspberry, Wi-Fi, schema ou fila.
A consulta da lista não substitui Configuração de prazos. Estado de entrega,
comandos e limites de validação em [TASKS](features/pontos-impressao/TASKS.md).

## Operação no Validades — 16/10/2026

- Em **Imprimir etiquetas**, o botão **Imprimir** usa o ponto padrão ativo, vinculado e com
  impressora selecionada. Com vários pontos disponíveis, o campo **Impressora**
  escolhe o destino. A fila permanece interna; não há segundo botão de envio.
  Sem ponto configurado, o transporte local Browser Print continua disponível.
  Não há troca automática para outra impressora se o ponto falhar.
- O ponto administrado conserva 60 × 60 mm e 203 dpi. O ZPL/template 4 e o conector
  instalado não mudam. Aceitação do envio não comprova saída física.
- **Voltar** é a seta discreta junto ao título do passo: de Produto retorna a
  Responsável; de Etiqueta retorna a Produto. As etapas principais anteriores e
  as subabas habilitadas também permitem voltar. As futuras não pulam seleções
  obrigatórias. Navegação de retorno fica bloqueada durante o envio.
- **Configurações → Pontos de impressão** abre cada ponto recolhido. Clique no
  resumo para ver os detalhes. O X discreto exclui um ponto com confirmação,
  preserva o histórico e revoga seu vínculo/códigos. O padrão e pontos com envios
  pendentes, reservados ou incertos não podem ser excluídos.
- **Ver pontos excluídos → Restaurar cadastro** recupera o registro inativo.
  A credencial antiga continua revogada; um uso futuro exige vínculo novo.
- **Gestão de validades** oferece Vencidas (todos os prazos anteriores ao momento
  da consulta), Vencem hoje e Vencem amanhã. Os cartões contam cópias restantes,
  considerando os filtros e o fuso de cada snapshot. A consulta inicial inclui
  todos os períodos, sem esconder vencimentos de meses anteriores.
- **Dar baixa** registra diretamente quando resta uma única cópia. Com várias
  cópias, **Ver etiqueta → Dar baixa** solicita quantidade e confirmação.
  A confirmação reduz apenas o acompanhamento. Não apaga snapshots, não confirma
  impressão, não movimenta estoque e não registra consumo/descarte. A baixa usa
  Produção/Validades → Editar; o filtro **Baixas registradas** conserva a consulta.
  Envio pendente/reservado bloqueia baixa; baixa já registrada bloqueia nova
  impressão daquele trabalho. Prepare outra etiqueta se houver nova emissão.
- **Configurações → Responsáveis** permite escolher usuários ativos e cadastrar
  pessoas sem conta. O salvamento é explícito e exige administrador e permissão
  de edição de Produção. Isso não cria login nem altera permissões do usuário.
  Os usuários existentes começam disponíveis; nomes históricos não mudam.

Banco: migration manual aditiva `20261016120000_validades_operacao`, com
`Usuario.responsavelEtiquetaHabilitado`, `ResponsavelEtiqueta`,
`TrabalhoEtiqueta.copiasBaixadas` e `PontoImpressao.excluidoEm`. Auditoria e baixa
compartilham a transação; a projeção de atividades usa a fonte canônica existente.
Travas por ponto/trabalho serializam exclusão, reserva e envio concorrente.
A compatibilidade de entradas manuais legadas de responsável é preservada no
servidor; a emissão guiada oferece os cadastros configurados.

## Fonte dos dados

- `Insumo` continua sendo a fonte única de insumos e preparações (`PRODUTO_INTERMEDIARIO`).
- Os campos `etiquetaHabilitada`, `validadeSecoDias`, `validadeRefrigeradoDias`, `validadeCongeladoDias`, `validadeAposAbertoDias`, `conservacaoEtiquetaPadrao` e `versaoConfiguracaoEtiqueta` pertencem ao próprio cadastro.
- O administrador também pode habilitar a etiqueta no final do cadastro de um Insumo ou de uma Preparação. A mesma configuração aparece em Produção → Etiquetas, sem cópia ou sincronização paralela.
- O bloco Etiqueta substitui no formulário os campos antigos `É perecível` e `Validade padrão após o recebimento`. O cadastro apresenta somente Ambiente, Refrigerado e Congelado, todos descritos como prazos após aberto; a embalagem fechada segue a validade do fornecedor. Os campos legados de após aberto e conservação padrão permanecem preservados no banco, mas não são alterados pelo cadastro comum.
- Um trabalho guarda snapshots de nome, unidade e prazo. Esses textos não formam outro cadastro: preservam a etiqueta histórica caso o cadastro original mude depois.
- Nenhum prazo é criado automaticamente. Campo ausente bloqueia a conservação correspondente.
- Dias significam dias de calendário no fuso IANA da loja, preservando o horário local da manipulação.

## Estados e auditoria

- `PREPARADO`: dados congelados no servidor antes de qualquer envio.
- `ENVIANDO`: tentativa local iniciada.
- `ENVIADO_AO_DISPOSITIVO`: o SDK aceitou o ZPL; ainda não prova saída física.
- `ENVIO_INCERTO`: houve timeout; conferir a impressora antes de reenviar.
- `EXPORTADO`: o arquivo ZPL foi baixado; não significa impressão.
- `FALHA`: envio recusado pelo SDK/dispositivo.
- `CONFIRMADO_PELO_OPERADOR`: uma pessoa confirmou que a etiqueta saiu fisicamente.

Criação usa chave de idempotência. Configurações de validade têm versão e evento de auditoria. Reimpressões/exportações acrescentam tentativas ao mesmo snapshot, sem recalcular a validade.

## Endereço na mídia 60 × 60 mm

O template 3 mantém o endereço completo do cadastro/snapshot e abrevia `Avenida` para
`Av.` apenas na composição. O rodapé usa uma linha de CEP, até duas de logradouro,
número, complemento e bairro, e uma de cidade/UF. O país é preservado quando informado.
O cadastro da empresa não muda. A mídia 60 × 40 mm conserva seu rodapé compacto.

`src/lib/etiquetas/endereco.ts` separa os formatos de endereço atuais e legados.
`src/lib/etiquetas/layout.ts` compõe as linhas usadas pela prévia e pelo ZPL, à esquerda
do logo e acima do rastreio. Conteúdo que excede a área legível continua bloqueado,
sem corte silencioso. Testes: `testes/etiquetas/endereco.test.ts` e
`testes/etiquetas/etiqueta-preview.test.tsx`; prévia isolada:
`testes/visual/etiqueta-preview.html` (`?erro=1` verifica a proteção).

Verificação local em 15/10/2026, na branch `codex/endereco-etiqueta-20261015`,
base `d04d8b0dc988f5dff7142ed395d058837bfc9aa9`: 135 testes de etiquetas aprovados;
13 testes opt-in de banco não executados. ESLint dos arquivos alterados, lint:design,
Prisma generate, Next typegen, tsc --noEmit e build webpack passaram com Node 22.
Capturas isoladas em 320, 390, 768 e 1440 px, claro/escuro, foram conferidas; a auditoria
parcial do DOM não apontou problemas. Isso não valida a leitura do novo rodapé no papel.
O teste físico anterior do conector não usou este layout. Publicação e teste pelo celular
devem ser confirmados separadamente.

## Tamanho do texto na Zebra — template 4

Em 15/10/2026, as fotos do operador mostraram letras condensadas, embora divisórias,
logo e posições ocupassem a mídia corretamente. A fonte 0 do ZPL é proporcional;
o parâmetro de largura de `^A0` não equivale ao avanço médio reservado na prévia.
Referências: [espaçamento da Zebra](https://docs.zebra.com/content/tcm/us/en/printers/software/zpl-pg/fonts-and-barcodes/proportional-and-fixed-spacing.html)
e [dimensionamento de fontes escaláveis](https://docs.zebra.com/content/tcm/us/en/printers/software/zpl-pg/fonts-and-barcodes/scalable-versus-bitmapped-fonts.html).

`src/lib/etiquetas/fonte-zpl.ts` converte a largura composta para a célula da fonte 0,
considerando os caracteres de cada linha. As métricas ASCII foram medidas em uma
grade fictícia com `^CI27`, `^A0N,40,40`, dez repetições e marcador final no
[renderizador Labelary](https://labelary.com/service.html). Nenhum dado real foi enviado.
As métricas são locais; produção não depende de API externa, fonte instalada ou novo
conector. A composição recusa texto que excede a largura mínima da fonte. O template 4
preserva dimensões, datas, endereço em linhas, logo, cópias e fila/idempotência.

Verificação da correção: `vitest run testes/etiquetas --maxWorkers=1`, 142 testes
aprovados e 13 opt-ins de banco não executados; ESLint focado, lint:design e
`tsc --noEmit` e build webpack aprovados com Node 22. Simulações do ZPL anterior/corrigido, com todos
os campos e nome com letras largas, foram inspecionadas. A simulação reproduziu o
defeito e a correção de proporção; não certifica a saída física nem igualdade de pixels
entre Arial da prévia e a fonte nativa. Conferir uma etiqueta nova após publicar.

## Pré-requisitos do Browser Print

1. Confirmar no equipamento a linguagem ZPL, a resolução e as mídias disponíveis. O perfil inicial usa 203 dpi (60×40 mm = 480×320 pontos; 60×60 mm = 480×480 pontos), e o renderer converte milímetros pela resolução configurada.
2. Instalar o Zebra Browser Print no computador que está fisicamente conectado à impressora e selecionar uma impressora padrão.
3. Usar um navegador compatível. A documentação consultada em 16/09/2026 lista Windows 11 ou macOS com Chrome estável, Edge ou Safari; USB/rede são suportados nos computadores Windows e macOS.
4. Obter a biblioteca JavaScript oficial na página da Zebra e conferir a versão antes de publicar. A versão homologada no projeto fica hospedada no próprio domínio em `public/browser-print/BrowserPrint.min.js`.
5. Manter no build a configuração:

   ```env
   NEXT_PUBLIC_BROWSER_PRINT_SCRIPT_URL=/browser-print/BrowserPrint.min.js
   ```

6. Autorizar o domínio do Grazing HUB no Browser Print quando o aplicativo local solicitar.

O servidor/VPS não acessa a USB da cozinha. A aplicação usa somente o objeto `window.BrowserPrint` exposto pelo SDK oficial. Não há POST artesanal para localhost, desativação de TLS ou porta de impressão exposta na internet.

Referências oficiais consultadas:

- [Suporte do Zebra Browser Print](https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html)
- [Demonstração e requisitos do Browser Print](https://techdocs.zebra.com/link-os/latest/demos/browser-print/)

## Instalação no projeto

A migration é manual, conforme o padrão do Grazing HUB:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Depois, apague `.next` e reinicie `npm run dev` para evitar que o Next mantenha um Prisma Client antigo.

## Roteiro de teste

### Sem impressora

1. Entrar como administrador e abrir Produção → Etiquetas → Configurar.
2. Cadastrar o fuso, limite de cópias e perfil real da impressora.
3. Habilitar um insumo e uma preparação já existentes; informar prazos aprovados pela operação.
4. Em Imprimir, preparar uma etiqueta 60×40 com quantidade, lote contendo `^XZ` e nome com acentos.
5. Conferir que datas, responsável, produto e conservação são iguais na prévia e no histórico.
6. Baixar o ZPL. Confirmar no histórico o estado “Arquivo exportado”, sem tratá-lo como impresso.
7. Repetir em 60×60 e testar nome comprido.
8. Tentar produto sem prazo, quantidade `1kg`, quantidade negativa, zero cópias e valor acima do limite.
9. Clicar duas vezes/repetir a solicitação e confirmar que a chave retorna um único trabalho.

### Com impressora

1. Instalar e abrir o Browser Print no computador da cozinha.
2. Detectar a impressora padrão e enviar uma etiqueta identificada como teste, com dados fictícios.
3. Fazer uma única impressão em 60×40 e outra em 60×60.
4. Medir margens, legibilidade, corte e posicionamento na mídia real.
5. Só clicar em “Confirmar saída física” depois de conferir a etiqueta impressa.
6. Simular uma falha segura (por exemplo, impressora desligada) e confirmar que o formulário e o ZPL são preservados.
7. Em timeout, não reenviar automaticamente; conferir primeiro se a etiqueta saiu.

## Limites conhecidos

- O equipamento físico não faz parte do repositório e o teste físico continua pendente até ser executado no computador da cozinha.
- O ZPL usa a fonte básica da impressora e normaliza acentos para ASCII (`maçã` → `maca`) para evitar caracteres ilegíveis em perfis ainda não homologados. Uma fonte Unicode só deve ser ativada depois de validada no modelo real.
- O histórico é paginado no servidor em grupos de 25 trabalhos e possui índice por loja e data.
- A aplicação atual possui uma única loja (`ConfiguracaoLoja` singleton). Os vínculos com loja foram mantidos nos trabalhos e perfis para impedir IDs arbitrários e facilitar uma expansão futura.

## Verificação antes da primeira publicação

- Integrado à versão atual da `main`, mantendo as permissões por perfil. Produção/Visualizar
  permite consulta; Produção/Adicionar permite emissão, exportação e confirmação. Configurar
  continua restrito a administradores ativos. Não foram concedidas permissões novas à equipe.
- Testes de regras e fronteiras de autorização: 109 aprovados. Integração PostgreSQL local
  isolada: 3 aprovados, incluindo aplicação de todas as migrations, idempotência concorrente,
  preservação do cadastro único, histórico e ausência de movimentos de estoque.
- Textos e quebras da prévia e do ZPL usam a mesma composição, sem corte silencioso. A fonte
  do navegador é aproximada: o teste físico de legibilidade e mídia continua necessário.
- Nenhum produto real foi habilitado e nenhum prazo real foi preenchido pelo agente.
- `scripts/deploy-etiquetas.py` preserva a configuração fiscal e um backup pré-migration na
  própria VPS. Não restaura o banco automaticamente nem faz consultas à SEFAZ.
