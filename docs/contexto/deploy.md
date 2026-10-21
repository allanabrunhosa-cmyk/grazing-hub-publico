# Publicação e reversão — Dokploy

O atendimento possui origem própria em `allanabrunhosa-cmyk/atendimento-grazing`.
Sua publicação reutiliza o serviço existente da VPS e segue o README daquele repositório.
Consultar [Atendimento](atendimento.md) para responsabilidades, validações e revisão publicada.
O fluxo Dokploy abaixo continua exclusivo do HUB. Não publicar a branch Donatella inteira nele.

Consultar somente quando publicar ou diagnosticar infraestrutura. Nenhuma instrução
aqui amplia a autorização da tarefa: pedido de não publicar prevalece. Mudança apenas
documental não exige deploy; push em main também publica, portanto não o fazer por rotina.

## Fontes e limites

- `Dockerfile`: Node 22, npm ci, prisma generate, build webpack. Na reconciliação
  fiscal de 14/10, a partida verifica o plano de migrations antes de prisma migrate
  deploy e npm start. O código ainda está na branch de trabalho; não foi publicado.
  `next.config.ts` recebe deploymentId gerado no build.
- Produção: grazinghub.com.br; Validades: validades.grazinghub.com.br, mesma aplicação.
  Manter etiquetas.grazinghub.com.br como entrada compatível para favoritos/conectores.
- VPS: 179.199.142.19. Serviço app: app-copy-auxiliary-microchip-9hhwdm.
  Serviço banco: postgres-index-optical-alarm-pzjdxf. Conferir existência antes de operar.
- SSH pelo acesso autorizado, chave privada definida na configuração operacional. Não inventar credenciais,
  imprimir secrets/env completos ou editar manualmente arquivos efêmeros do contêiner.
- Procedimento auxiliar: `scripts/deploy-etiquetas.py` (nome histórico, preserva configuração
  e faz backup). Ler o script antes de executar; identificador novo no formato etiquetas-....

## Sequência

1. Conferir branch/status, diff e base remota; preservar trabalho alheio. Executar nível C
   de [testes](testes.md), documentando falhas/limitações reais.
2. Se houver alteração de banco, obrigatoriamente criar backup privado e verificar sua
   integridade antes da publicação. Salvar imagem/configuração anterior. O modo preparar
   do script cria dump e snapshot fiscal; não reutilizar identificador que já exista.
3. Confirmar a fonte do certificado: `src/lib/sefaz/certificado.ts` prioriza banco.
   Última evidência de 23/09: certificado no banco, sem env/mount de fallback.
   **Não reaplicar env/mount cegamente.** Preservar a configuração realmente encontrada.
   Fallback só quando necessário, com secret real disponível; nunca senha vazia.
4. Commit de escopo revisado e push fast-forward para main apenas quando autorizado.
   Isso dispara webhook/build Docker. Não usar force push nem contornar conflito remoto.
5. Acompanhar Dokploy e `docker service ps`; exigir tarefa nova Running estável
   por aproximadamente 1–2 minutos, sem reinícios. Build aprovado sozinho não basta.
6. Modo restaurar do script reconfere/reaplica somente a configuração fiscal capturada;
   **não restaura banco**. Executar prisma migrate status no contêiner identificado.
7. Conferir UI autenticada e HTTPS das rotas afetadas, bloqueio sem sessão e módulos
   diretamente relacionados. Não manifestar notas, importar dados reais ou pagar para testar.
8. Registrar commit funcional, tarefa/contêiner, resultados, backup e pendências.
   Não gerar outro deploy só para publicar evidência pós-deploy.

### Reconciliação das migrations fiscais — candidata de 14/10

As branches adicionaram `DocumentoFiscalSaida.protocoloCancelamento` em duas SQLs
históricas. Não editar os arquivos nem seus checksums. O executor confere TEXT
nullable e aplica somente a adição equivalente conhecida. Coluna incompatível,
histórico incompleto ou checksum divergente bloqueiam a partida.

Antes de autorizar a publicação, executar `node scripts/migrations-publicacao-fiscal.mjs`
**em leitura**, usando a imagem candidata e a conexão protegida do destino conferido.
O plano informa nomes/checksums e hashes do destino/executor; não devolve credenciais
ou dados fiscais. O hash do banco local não autoriza o banco produtivo.

Após backup íntegro, revisão e aprovação específica da publicação, disponibilizar
`MIGRACOES_FISCAIS_PLANO_APROVADO` com o hash exato desse plano na configuração
privada do serviço. O bootstrap usa lock, reconfere destino/histórico/código e
aplica as migrations pendentes em transações. Registra o checksum original na
história Prisma. Não resolve nem apaga migrations falhadas automaticamente.
Mudança do plano exige outra revisão; não reutilizar hash de outra imagem/alvo.
Sem pendências, o bootstrap não escreve no banco.

Esse procedimento prepara compatibilidade da publicação. Não autoriza emissão,
troca de credenciais/certificado, restore de banco ou aplicação produtiva por rotina.

## Infraestrutura e retorno

- DNS/TLS do subdomínio: [procedimento existente](../etiquetas-subdominio.md).
  Mesma aplicação Dokploy, HTTPS automático; não criar banco ou aplicação duplicados.
- Agenda fiscal: `infra/grazing-buscar-notas.timer` acorda a cada cinco minutos; serviços
  decidem quando há trabalho devido. Não confundir frequência do timer com consulta diária.
  `scripts/buscar-notas.ts --verificar` valida sem consultas fiscais; nunca disparar a rotina
  real como smoke. Instalação/manutenção do timer é operação separada, não automática.
- Reversão depende da compatibilidade de schema e dos dados gravados após a versão.
  Preferir correção/reversão de código revisada; nunca restaurar dump sobre transações novas.
  Em faturas, código anterior ao módulo não conhece liquidações parciais:
  [cuidados específicos](../financeiro/cartoes/README.md).
- A autorização histórica de deploy funcional não autoriza operações fiscais/financeiras,
  mudanças de DNS, credenciais ou outras ações fora do pedido.
