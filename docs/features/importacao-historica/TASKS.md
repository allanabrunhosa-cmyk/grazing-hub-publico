# Execução da importação histórica

- [x] Ler o prompt revisado e o Excel fornecidos.
- [x] Comparar os valores do Google Sheets autenticado e do Excel.
- [x] Preservar fonte imutável, hashes e reconciliação integral em área privada.
- [x] Criar backups das três bases e comprovar restauração sem rede.
- [x] Registrar baseline financeira, de estoque e sequências em área privada.
- [x] Implementar domínio histórico e barreiras operacionais.
- [x] Implementar persistência, consultas segregadas e detalhe somente leitura.
- [x] Concluir integração sintética, revisão, tipos, lint, build e evidência visual.
- [x] Executar simulação completa com os cadastros atuais.
- [x] Publicar a revisão validada necessária.
- [x] Executar importação real no HUB e reexecução.
- [x] Executar cadastro passivo e tags no Atendimento com autorização vigente.
- [x] Conferir saldos, filas, valores, exceções e produzir arquivo restrito com IDs.

Dados pessoais, arquivos da fonte, cópias de banco e saldos não pertencem a este registro.

## Validações e publicação

A revisão funcional `e38c6a7f` passou nos testes históricos, inclusive PostgreSQL
sintético, tipos, lint e build. A revisão publicada é `7a8e874e`. Ela acrescenta
somente a correção da espera assíncrona de um teste fiscal. A suíte fiscal passou
30/30 nessa revisão. O código de produção das duas revisões é idêntico.

A regressão global anterior registrou 5.146 testes aprovados, uma falha fiscal
depois corrigida e 695 testes opt-in ignorados. Essa evidência não equivale a uma
nova execução global completa em `7a8e874e`. A validação visual isolada cobriu oito
capturas, sem erros de JavaScript ou overflow. Não foram criadas referências visuais.

O deploy, a migration aditiva pelo executor oficial, a importação real do HUB e a
reexecução foram executados. As consultas autenticadas publicadas também foram
conferidas. A equivalência de conteúdo CRLF/LF foi comprovada; os checksums de
migrations aplicadas foram preservados. Provas, recibos, hashes e reconciliações
integrais permanecem fora do Git, em armazenamento privado.

A rotina passiva do Atendimento foi executada e reexecutada com recibos duráveis.
As guardas oficiais preservaram contatos conflitantes como exceções. A conferência
comparou registros, comandos e auditorias; não detectou efeitos operacionais do lote.
A referência inicial do Atendimento é posterior ao commit do HUB. Essa janela
anterior foi verificada por datas persistidas, estrutura e logs retidos, com a
limitação explícita de não recuperar exclusões transitórias ou atualizações sem
timestamp. O arquivo restrito registra o escopo dessas provas e os IDs reais.

A reversão foi preparada e testada em dados sintéticos. Ela não foi executada em
produção. O roteiro completo permanece privado; a entrega sanitizada usa placeholders.
Esta atualização documental não altera a revisão funcional publicada.

## Correção cadastral solicitada em 15/10/2026 — em execução

- [x] Inspecionar versões publicadas e preservar mudanças posteriores no Atendimento.
- [x] Confirmar autorização de pesquisa pública restrita a empresas/domínios.
- [x] Confirmar unificação somente por CNPJ comprovado, com múltiplos contatos.
- [x] Corrigir cálculo de gasto/último pedido para incluir histórico ativo.
- [x] Corrigir troca PF/PJ sem descartar nomes pessoais.
- [ ] Concluir provas cadastrais e manifesto privado de empresas/pendências.
- [x] Concluir serviço e CLI auditáveis de correção, prévia e reversão.
- [x] Conferir backups atuais e restauração isolada.
- [ ] Concluir testes sintéticos, revisão, tipos, lint, build e QA.
- [ ] Publicar revisão validada e aplicar correção autorizada.
- [ ] Conferir reexecução, saldos, vínculos, contatos e exceções finais.

Próximo passo: concluir a bateria C, validar o manifesto privado com o executor e
publicar pelo fluxo oficial. Os testes focados cobrem contatos, métricas, grafia
humana, vínculos parciais, aliases e repetição da reversão. A conferência visual
cobriu Histórico e Contatos em 16 estados, sem problemas na auditoria automatizada.
As três bases tiveram restauração isolada conferida. Nenhuma correção real desta
nova etapa foi executada até este registro. As provas devem ser renovadas se vencerem
antes da execução.
