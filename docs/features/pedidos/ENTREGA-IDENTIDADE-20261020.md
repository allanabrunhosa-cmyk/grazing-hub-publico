# Entrega e aviso de identidade duplicada

## Objetivo

Organizar Nome Completo e Telefone antes da agenda de entrega no Pedido.
Exibir Data e Horário juntos na linha seguinte, com quebra no celular.
Avisar durante o preenchimento quando e-mail, CPF ou CNPJ já pertence a outro
cadastro, em Clientes e Pedido.

## Contratos

- Reutilizar campos, grade, controles e tokens existentes. Nenhuma variante nova.
- Preservar os eventos da agenda, inclusive limpar o horário ao trocar a data.
- Consultar duplicidade somente com autorização no servidor. Retornar apenas os
  campos em conflito, sem expor dados de outro cliente.
- Reutilizar normalização, raízes e aliases da unicidade cadastral. Edição do
  próprio cliente conserva a identidade. Cobranças adicionais representam
  terceiros e não participam da unicidade da identidade principal.
- Descartar respostas antigas durante digitação. Preservar campos e rascunho.
- Manter validação definitiva, transação e restrições de unicidade ao salvar.
- Não alterar banco, dados históricos ou cadastros reais para testar.

## Critérios de conclusão

- [x] Implementar grade de entrega e aviso antecipado.
- [ ] Aprovar testes focados, permissões, lint, design, tipos e build.
- [ ] Inspecionar prévia sintética responsiva em temas claro e escuro.
- [ ] Publicar e conferir HTTPS, interface autenticada e estabilidade do serviço.

## Referência visual

Composição atual de `editor-pedido.tsx`: `CamposDestinatarioCliente`,
`Campo`, `Input`, `CampoTelefone` e `HorarioEntregaCampo` oficiais. Grade com
`gap-3` e pontos de quebra existentes. A referência fornecida pelo usuário
orienta a reorganização. Capturas sintéticas permanecem consultivas, Em revisão.

## Implementação e limites

Nome e Telefone precedem a grade própria de Data e Horário. A partir de `sm`, a
agenda ocupa duas colunas; no celular, os campos seguem a ordem de leitura.
`items-start` alinha os controles mesmo com a ajuda do Horário. Seu Select conserva
o limite interno da coluna com `min-w-0`.

O aviso consulta o servidor após 350 ms ou ao sair do campo completo. O POST de
leitura independe da consulta externa de CNPJ, exige sessão/origem/permissão por
contexto, limita o corpo a 2 KB e retorna apenas flags, sem cache. O hook cancela
consultas anteriores e limita a espera a oito segundos. Falha é informada junto
ao campo e não representa confirmação de disponibilidade.

Prévia isolada: 12 cenários de Entrega, 16 de identidade, um de falha e quatro
focais do transporte HTTP final aprovados. Temas claro/escuro; larguras
320/390/768/933/1440 quando pertinentes. Auditoria sem problemas ativos, sem
overflow ou erros de página. Tab, seleção de horário e Escape conferidos.
Raiz inspecionou imagens da agenda em 320/933/1440 e dos avisos PF/PJ. Ambiente
da prévia encerrado, porta 4299 livre. Sem operação ou dado real nas capturas.

C: tinha 21,24 GB livres no início e 12,06 GB na avaliação anterior à compilação.
Foi informado o alerta abaixo de 20 GB. A compilação existente ocupa 1,30 GB.
Sem instalação, nova cópia ou remoção de arquivos; verificações pesadas serão
sequenciais para limitar o consumo temporário. Bancos e backups preservados.
