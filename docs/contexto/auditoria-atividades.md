# Auditoria e consulta de atividades

Contrato transversal, implementação de 10/10/2026. Escopo/cobertura e evidências
na [feature](../features/atividades-usuarios/SPEC.md).

## Fonte obrigatória para funcionalidades novas

1. Exigir autorização central no servidor e derivar ator de sessão/identidade validada;
   nunca aceitar autor do navegador. Sistema/integração e iniciador são identidades distintas.
2. Havendo auditoria canônica de domínio, reutilizá-la. Adicionar projeção por referência
   à whitelist SQL da camada compartilhada, com recurso e resultado corretos.
   Não copiar seu payload para AtividadeUsuario nem construir segunda auditoria do mesmo fato.
3. Sem fonte existente, registrar com `src/lib/atividades/registro.ts` **na mesma
   transação** da mudança. Resumo fixo e diferenças relevantes de campos permitidos.
   Fonte de evento deve ser ponto de negócio compartilhado, não clique/navegação.
   Rotinas fora de request ou contexto MCP validado devem fornecer `atorAtividade`
   técnico explícito aos gravadores de estoque/baixa financeira; não capturar falha
   de sessão para atribuir a operação a sistema ou ao autor legado por conveniência.
4. Chave de deduplicação identifica um **efeito** real; correlação agrupa efeitos
   legítimos distintos. Não deduplicar por usuário/data/ação de forma aproximada.
5. Registrar resultado realmente comprovado. Solicitação externa não significa conclusão;
   falha/tentativa independente não recebe sucesso da transação revertida.
6. Preservar contratos, locks e política de falha. Nova evidência obrigatória falha
   junto da mudança; exceções de segurança (logout/negação) precisam comportamento
   documentado e diagnóstico sem payload. Nunca usar promise solta ou fila só em memória.
7. DTO é lista fechada: não retornar JSON de fonte, segredos, e-mails/telefones,
   certificados, corpos de requests, anexos ou pagamento completo. Permissão do histórico
   não concede acesso ao módulo; consulta e detalhes filtram recurso no servidor.
8. Testar autoria/afetado, autorização direta, privacidade, rollback, concorrência,
   dedup e origem. Atualizar matriz da feature quando ampliar cobertura.

## Caminhos

- `prisma/schema.prisma`: AtividadeUsuario; migration manual aditiva da feature.
- `src/lib/atividades`: registro, consulta, filtros/cursor, privacidade, autenticação, DTO.
- `src/app/api/usuarios/[id]/atividades`: GET somente leitura, respostas privadas no-store.
- `src/app/(protegido)/configuracoes/usuarios`: consumidor da Central, sem pré-carregar atividades.
- `scripts/atividades-diagnostico.mjs`: tamanho, volume e projeção administrativa.
- `scripts/atividades-recuperar.mjs`: simulação padrão e recuperação autorizada por fonte.
- `testes/atividades`: unitários, UI, integração SQL/negócio e medição sintética.

Estrutura fiscal versionada usa `EventoEstruturaFiscal` como fonte canônica desde
`20261011233000_atividade_estrutura_fiscal`. A projeção transacional cobre rascunho,
impacto e ativação local, com recurso `vendas.fiscal`, autoria da sessão validada e
dedup por fonte/id. Consulta retorna somente metadados imutáveis da versão; não lê
payload, fontes nem justificativas. Cobertura, teste local e reversão específica na
[matriz de atividades](../features/atividades-usuarios/TASKS.md).

## Operação autorizada

Scripts exigem DATABASE_URL explícita e não carregam .env. Não imprimir credenciais.

```text
node scripts/atividades-diagnostico.mjs --schema public --contar
node scripts/atividades-recuperar.mjs --fonte HistoricoAcesso --schema public --limite 5000
```

O segundo comando apenas simula. Aplicação exige autorização operacional, variável
`ATIVIDADES_RECUPERACAO_AUTORIZADA=SIM` e `--aplicar`. Lotes de até 500 registros,
15s por statement, limite por execução e `--apos` com cursor retornado para continuar.
Repetir lote é seguro por fonte/id. Retomar não reconstrói fatos sem autoria confiável.
Carga histórica exige janela e diagnóstico (a projeção ampliou custo da carga em massa
no benchmark); não executá-la automaticamente no startup/deploy.

Retenção: `ATIVIDADES_RETENCAO_MESES_OPERACIONAL`, `_ACESSO`, `_CRITICA`, padrão 12.
Esses valores apresentam a proposta operacional no diagnóstico, sem restringir o período
consultável; **expurgo desativado** e nenhuma fonte
existente é apagada. Eventos MCP projetados são preservados pela limpeza técnica existente.
Ver [medição](../features/atividades-usuarios/MEDICAO.md) para dados, índices, WAL e backups.
