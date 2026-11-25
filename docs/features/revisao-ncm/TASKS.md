# Revisão de NCM — andamento

Contrato: [SPEC](SPEC.md).

- [x] Banco e domínio — migration aditiva `20261123180000_alerta_revisao_ncm`; motor devolve
  `revisoesNcm` sem bloquear. Evidência: `npx vitest run testes/tributacao` (23/11/2026).
- [x] Backend e autorização — `manterNcmRevisado` exige administrador no servidor, confere
  assinatura e é idempotente. Evidência: `ESTRUTURA_FISCAL_BANCO_TESTE=1` em
  `ncm-aplicabilidade-integracao.test.ts`, PostgreSQL local isolado, 33 aprovados.
- [x] Interface — seção no Painel do Fiscal e aviso no bloco Fiscal do pedido.
  Evidência: `testes/financeiro/revisao-ncm-interface.test.tsx`; `npm run lint:design` sem desvios novos.
- [x] Integrações — e-mail pelo SMTP já configurado. Montagem coberta por teste; **envio real
  não foi exercitado em teste** (sem servidor de e-mail local).
- [x] QA isolado — prévia Vite com dados fictícios em 320/390/768/1440, claro e escuro,
  diálogo, erro e sem permissão; sem overflow; `auditarInterface` sem problemas; teclado
  (Enter abre, Escape fecha e devolve o foco). Capturas consultivas, não são referência aprovada.
  O aviso no pedido foi validado só por teste de componente, sem captura.
- [x] Documentação — este diretório e [Fiscal](../../modulos/fiscal.md).
- [x] Deploy e smoke — 23/11/2026, PR 46: backup verificado, migration aplicada pelo plano aprovado,
  contêiner estável, banco em dia, login e bloqueio sem sessão conferidos. Envio real de e-mail e
  tela em produção dependem de sessão do responsável e não foram exercitados pelo agente.
- [x] Faixa de escolhas da equivalência NCM — 25/11/2026, PR 54: contagem fora da faixa mantém o NCM e
  pede revisão; Manter NCM amplia a faixa. Evidência: `testes/tributacao` com banco local (34 na
  integração) e ensaio somente leitura dos pedidos afetados, aptos e com totais conferidos.

Próximo passo exato: nenhum pendente nesta feature; evoluções do modelo de variações ficam em proposta própria.
