# Arquitetura

Fonte conferida em 23/09/2026: package.json, Dockerfile e caminhos abaixo.
Versões exatas ficam no lockfile, não devem ser duplicadas em cada mapa.

- Aplicação única Next.js App Router / React / TypeScript. Desenvolvimento com Turbopack;
  build de produção webpack. Node 22 no Docker. Não aplicar convenções de outra versão
  do Next sem consultar o guia local relevante.
- PostgreSQL via Prisma e adapter-pg; [contratos de banco](banco-de-dados.md).
- Páginas servidoras consultam/serializam dados; componentes clientes recebem DTOs.
  Mutações usam Server Actions, normalmente retorno `{ erro }` ou resultado.
  Exceção fiscal: verificar contrato específico de manifestação antes de reutilizar.
- Endpoints de importação fiscal em `src/app/api` reutilizam serviços existentes e
  guardas; não criar API paralela para substituir lógica compartilhada.
- Identidades HUB, Etiquetas e Pedidos compartilham aplicação, usuários, dados e permissões.
  Diferenças de host/layout não constituem isolamento de autorização.

## Onde entrar

| Caminho na raiz | Responsabilidade |
| --- | --- |
| `src/app/(protegido)/layout.tsx` | Sessão, navegação e contexto protegido |
| `src/lib/modules.ts` | Módulos e disponibilidade; Vendas & CRM reúne Pedidos/Clientes/Atendimento; RH/Patrimônio ainda não operacionais |
| `src/components/layout` | Lateral, cabeçalho, navegação móvel |
| `src/components/ui` | Primitivos Base UI e contratos compartilhados |
| `src/lib` | Serviços e cálculos por domínio; ver mapa específico |
| `src/app/api` | Fotos, documentos privados e operações fiscais |
| `src/lib/labels.ts` | Rótulos e identificadores compartilhados |
| `src/lib/hosts.ts`, `src/middleware.ts` | Host/origem/entrada de Etiquetas e Pedidos |
| `src/lib/erro-acao-cliente.ts` | Falha de ação antiga; conferir resultado antes de repetir |

O repositório é a fonte editável. Dokploy constrói imagem a partir de main; editar dentro
do contêiner não é correção persistente. Não pressupor que todos os worktrees estejam
no mesmo commit. Histórico de uma publicação não prova o estado atual da VPS.
