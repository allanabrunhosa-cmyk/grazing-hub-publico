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

Remoção de cópias é sempre manual, caso a caso, com autorização do usuário. A rotina abaixo
nunca remove cópias, dependências, arquivos privados, bancos ou backups.

## Rotina local de medição e manutenção

`scripts/manutencao-armazenamento.ps1` (com o módulo `scripts/armazenamento-seguro.psm1`)
mede o espaço livre do C: e os caches de uma lista explícita. Funciona no Windows PowerShell 5.1
e no PowerShell 7. O padrão apenas mede; nada é apagado sem `Apply`, que exige autorização
explícita do usuário a cada uso.

### Configuração por máquina

O repositório não guarda caminhos locais. Cada máquina define:

- **Raiz do repositório**: deduzida do local do script (pasta acima de `scripts/`; em uma
  cópia dentro de `.worktrees/`, o checkout principal que a contém).
- **Diretório de estado**: pasta fora do repositório, no C:, informada por `-StateDirectory`
  ou pela variável de ambiente `GRAZING_HUB_ARMAZENAMENTO_ESTADO`. Sem ela, ou apontando
  para dentro do repositório, a rotina recusa a execução. Contém:
  - `manutencao-lista-permitida.json`: catálogo criado e revisado à mão. Não é versionado.
  - `manutencao-estado.json`: registro da última medição, alertas, resultados resumidos e
    encerramentos, limitado a 64 KB. Não guarda conteúdo de arquivos nem credenciais.

Formato do catálogo, com caminhos absolutos canônicos:

```json
{
  "schemaVersion": 1,
  "environments": ["<raiz>", "<raiz>\\.worktrees\\<copia>"],
  "caches": [
    { "path": "<raiz>\\.next\\cache", "category": "next-cache", "ownerRoot": "<raiz>" },
    { "path": "<raiz>\\.next\\dev\\cache", "category": "next-dev-cache", "ownerRoot": "<raiz>" }
  ]
}
```

Categorias aceitas: `next-cache`, `next-dev-cache`, `app-cache` e `npm-cacache`. Somente as
duas primeiras podem ser tratadas por `Apply`; as demais são apenas medidas. Não ampliar o
catálogo por inferência: cópia nova ou caminho novo exige revisão do usuário.

### Modos

```powershell
./scripts/manutencao-armazenamento.ps1 -Mode Check
./scripts/manutencao-armazenamento.ps1 -Mode Monitor
./scripts/manutencao-armazenamento.ps1 -Mode Plan
```

| Modo | O que faz | Altera algo? |
| --- | --- | --- |
| `Check` | Informa espaço livre, nível e se operação pesada é permitida. | Não |
| `Monitor` (padrão) | Mede os caches do catálogo e emite alertas. | Só o registro de estado |
| `Plan` | Como `Monitor`, e lista os caches que `Apply` trataria. | Só o registro de estado |
| `Apply` | Remove `.next/cache` e `.next/dev/cache` de ambientes encerrados, sem mudanças posteriores. | Apaga caches |
| `Close` | Registra um ambiente do catálogo como encerrado, com tarefa e commit publicado. | Só o registro de estado |
| `Open` | Retira o ambiente do registro de encerrados antes de reutilizá-lo. | Só o registro de estado |

`Close` exige `-EnvironmentPath`, `-TaskReference` e `-PreservedCommit` (SHA de 40 caracteres
que seja ponta de uma branch no GitHub e contenha o HEAD da cópia), árvore limpa e nenhum
processo usando a cópia. `Open` exige `-EnvironmentPath`. Depois de `Open`, executar `Check`.
Tamanho lógico não equivale a espaço físico.

### Alertas

- Espaço livre abaixo de 20 GB (aviso) ou de 10 GB (crítico).
- Caches do catálogo acima de 10 GB.
- Falha nova de medição. Medições parciais são mínimos conhecidos: não servem para declarar
  normalização nem substituem uma medição completa.
- Avisos de capacidade se repetem após piora acumulada de 2 GB ou entrada em nível crítico.
  Sem mudança relevante, a rotina permanece silenciosa.

### Proteções da rotina

- Trava exclusiva: duas execuções não se sobrepõem. Não iniciar builds, testes ou instalações
  durante `Apply`.
- Caminhos são validados por inteiro: absolutos, canônicos, no C:, sem links, junctions ou
  redirecionamentos, com conferência de identidade nativa. A leitura é limitada a dois minutos por cache.
- Antes de apagar, a rotina confere novamente identidade, tamanho, data, Git, processos e
  arquivos abertos. Mudança após o encerramento indica possível retomada: o cache é preservado.
- Build, teste ou processo que não possa ser verificado adia a exclusão.

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
