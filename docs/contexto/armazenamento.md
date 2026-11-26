# Armazenamento e cópias de trabalho

Contrato para os agentes que trabalham no Grazing HUB. O Claude herda estas regras pela
importação de `AGENTS.md` em `CLAUDE.md`. A prioridade é preservar o funcionamento, o
trabalho pendente, os demais projetos e as ferramentas. Nada aqui autoriza excluir arquivos
pessoais, bancos ou ambientes incertos.

## Antes de consumir espaço

Os limites usam GB decimal: 1 GB = 1.000.000.000 bytes.

- Medir o espaço livre do C: antes de criar uma cópia de trabalho, instalar dependências
  ou executar uma compilação grande. Avaliar o consumo esperado, incluindo caches e temporários.
- Com menos de 20 GB livres, informar a situação e avaliar o espaço necessário antes de prosseguir.
  Esse valor é piso preventivo, não meta de recuperação nem motivo para interromper limpeza segura.
  Com menos de 10 GB, não iniciar operações que possam consumir vários GB até resolver a falta de espaço.
  Se a medição falhar, informar a limitação e obter uma avaliação segura antes dessas operações.
- Preferir reutilizar uma cópia adequada quando não houver conflito de branch, arquivos,
  processos ou tarefas. Evitar cópias desnecessárias; buscar entre três e cinco cópias ativas
  quando compatível com as frentes de trabalho, sem impor remoção ou retenção automática.
- Não alterar o compartilhamento de dependências nem excluir destinos de junctions sem
  verificar todos os consumidores. Preservar os destinos necessários às cópias existentes.

## Organização e conclusão

- Organizar temporários de novas tarefas em uma pasta identificável por tarefa, por exemplo
  `.tmp/<tarefa>/`, já abrangida pelo `.gitignore`, ou em local permitido fora do repositório.
  Não espalhar artefatos na raiz; não versionar logs sensíveis, credenciais ou dados reais.
- Ao concluir uma tarefa, encerrar também seu ambiente pelo procedimento abaixo.
  Informar as cópias preservadas e as pendências.
- Nunca remover cópias automaticamente. Antes de qualquer remoção autorizada, conferir e
  preservar alterações, commits, arquivos ignorados, bancos, backups e configurações,
  além de verificar consumidores e processos em uso. Na dúvida, preservar.
- Não alterar serviços, Windows ou outros projetos. Não esvaziar caches úteis de ambientes ativos.

## Encerramento de ambientes

Ao concluir cada tarefa:

1. Confirmar sua conclusão e a ausência de processos, servidores, builds ou testes dependentes.
   Não encerrar processos automaticamente. Revisar também dependências compartilhadas.
2. Verificar Git, commits, reflogs da cópia e arquivos ignorados ou privados. Preservar trabalho
   relevante fora da cópia. Não fazer commit, descartar alterações ou publicar código apenas para limpar.
3. Confirmar que o HEAD da cópia está contido em um commit publicado no GitHub.
4. Remover a própria worktree somente após revisão específica de todos os arquivos e links,
   com `git worktree remove`, sem força. Se exigir força ou um commit de preservação não
   autorizado, manter a cópia. Não impor o objetivo de três a cinco por exclusões.

Este repositório não traz rotina automática de limpeza. Remoção de caches ou cópias é manual,
caso a caso, com autorização do usuário.

## Proteções em qualquer limpeza

- Não iniciar builds, testes ou instalações durante uma limpeza. Adiar exclusões ao detectar
  build, teste ou processo relevante que não possa ser verificado.
- Validar caminho absoluto e destino final. Não seguir links, junctions, redirecionamentos
  ou OneDrive.
- Preservar itens incertos e informar falhas. Arquivos privados, bancos ou credenciais
  inesperados dentro de um cache bloqueiam sua exclusão.
- Preservar discos virtuais, sessões e configurações das ferramentas e dependências
  compartilhadas. Não acessar a VPS.

Para estado Git e fechamento de tarefas, consultar [Versionamento](versionamento.md).
