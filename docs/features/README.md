# Contrato para features extensas

Criar docs/features/<nome>/SPEC.md e TASKS.md apenas para feature com múltiplas etapas,
decisões/riscos ou retomadas. Correção localizada não exige essa estrutura.
Se o domínio já mantém EXECUCAO.md, usar esse arquivo como TASKS e linká-lo da SPEC;
não migrar nem duplicar o histórico só para adequar nomes.

## SPEC.md

Incluir objetivo e fora de escopo; comportamento esperado; regras de negócio;
arquitetura decidida e caminhos reais; banco/migrations; UX e componentes;
permissões/integrações; riscos, decisões ainda abertas e critérios de aceite verificáveis.
Referenciar mapas do domínio em vez de copiar regras globais. Distinguir proposta de decisão
implementada. Contrato de produto não constitui autorização para operar produção.

## TASKS.md

Cada etapa tem critério, arquivos/área, dependências, estado e evidência:

- [ ] Banco e domínio (ou justificar não aplicável).
- [ ] Backend e autorização.
- [ ] Interface e componentes.
- [ ] Integrações.
- [ ] Testes focados e regressão proporcional.
- [ ] QA isolado.
- [ ] Documentação dos contratos reutilizáveis.
- [ ] Deploy e smoke, somente se autorizado.

Registrar revisão/comando/resultado, decisões, bloqueios e **próximo passo exato**.
Não marcar concluído por haver código: cumprir o aceite. Skips, simulação e teste físico
pendente devem permanecer explícitos. Retomada lê SPEC + etapa corrente, não todos os logs.
