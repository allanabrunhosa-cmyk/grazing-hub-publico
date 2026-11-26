# Tipos de complemento e regra fiscal — andamento

Contrato: [SPEC](SPEC.md).

## Etapa 1 — nomenclatura, tipos e tela de produto (25/11/2026)

- [x] Banco e domínio: tipo `OPCAO` com escolha única; unidade sempre `UN`. Sem migration.
- [x] Backend e autorização: validação no servidor (`validarGrupo`, `limitesEfetivos`, `validarProduto`).
- [x] Interface: Tipo primeiro no complemento; Receita; Complementos por tipo e categoria;
  sem Classificação e sem Unidade comercial; Slots após tempo de preparo; NCMs por escolha na aba Fiscal.
- [x] Integrações: MCP aceita o tipo `OPCAO`.
- [x] Testes focados: `tipos-complemento.test.ts`, `interface.test.tsx`.
- [ ] Referências visuais: permanecem Em revisão até aprovação humana.

## Etapa 2 — NCM no cadastro e ajustes de produtos

- [x] Campo de NCM por item no cadastro de complemento do tipo Opção, gravando a classificação
  fiscal versionada (26/11/2026). Testes: `ncm-aplicabilidade-integracao.test.ts` e
  `vendas/integracao.test.ts` com banco local. Corrige também a restrição do banco que recusava
  o tipo Opção.
- [ ] Sincronizar também ao vincular o complemento a um produto (hoje só ao salvar o complemento).
- [x] Espetinhos com NCM único 2106.90.90 (25/11/2026). Ensaio e aplicação com prévia de 5
  pedidos reais: mesmas linhas e valores, sem pendências nem revisões.
- [x] Torta artesanal e Suco integral como Opção (26/11/2026, operação autorizada).
- [x] Sabor novo em Opção sem NCM: aviso ao salvar e nota bloqueada para esse item.

## Etapa 3 — Variável

- [ ] Entidade Variável (escolha única, sem NCM, altera preço, entra no nome da nota).
- [ ] Unificação opcional dos produtos por tamanho.

**Próximo passo exato:** etapa 3 (Variável), quando o responsável decidir.
