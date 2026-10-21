# Atendimento — repositório e integração

O desenvolvimento do atendimento ocorre no repositório privado
[allanabrunhosa-cmyk/atendimento-grazing](https://github.com/allanabrunhosa-cmyk/atendimento-grazing).
Use o README desse repositório para executar, testar, compilar e publicar.
Não publique novos artefatos a partir de cópias da branch Donatella no HUB.

## Responsabilidades

O atendimento mantém interface, login dedicado, receptor, workers, integrações,
SQL manual, compilação, testes e publicação do serviço existente na VPS.
A compilação usa seus próprios arquivos e dependências. Não exige cópias manuais do HUB.

O HUB mantém cadastros centrais, usuários, perfis, permissões e o atalho de Vendas & CRM.
A operação consulta `atendimento_integracao.identidade` em modo somente leitura.
O servidor continua revalidando atividade, versão de sessão e permissões do usuário.

Preservar no HUB:

- `src/app/(protegido)/vendas/atendimento/page.tsx` e `src/components/atendimento/entrada-crm.tsx`.
- `src/lib/permissoes/atendimento.ts`, o catálogo e os testes da matriz.
- Hosts, sessões, gestão de usuários e cadastros centrais.
- Migrations aplicadas das permissões e a integração de identidade existente.

A main do HUB não continha interface, runtime, workers ou ferramentas exclusivas migradas.
Não houve arquivo exclusivo ativo a excluir. Não integrar a branch inteira da Donatella.
Preservar seu histórico e trabalhos locais ainda não publicados. `sdrgrazing` permanece separado.

## Publicação confirmada em 13/10/2026

Base extraída: `grazing-hub@cb4b19c095702762550ae715900d294f5d3c47f0`, confirmada na VPS.
Histórico relevante: 146 commits de origem, sem reescrever o HUB.
Revisão publicada no repositório novo: `29754f02c54d2ddaa714813a4604a68c7b141352`.
Troca concluída às 16:17:27 BRT. Manifesto registra `atendimento-grazing` como origem.

Validações: instalação independente, Prisma validate/generate, tipos, lint e build;
768 testes do atendimento e seis provas da publicação/retorno, também executadas no Linux.
Não houve mensagem de teste, automação disparada ou SQL aplicado.

O processo existente mantém contêiner, imagem, domínio, número, webhook, bancos,
credenciais e rotina do Drive. A release anterior fica disponível para retorno de código.
Nunca restaurar bancos para reverter essa separação.

O coletor histórico já estava `unhealthy` antes da tarefa. Foi preservado sem reinício.
Essa pendência anterior não foi apresentada como corrigida.
