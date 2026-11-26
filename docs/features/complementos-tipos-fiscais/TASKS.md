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

- [ ] Campo de NCM por item no cadastro de complemento do tipo Opção, gravando a classificação
  fiscal versionada (salvar → impacto → ativar) sem passar pelo editor de classificação.
- [ ] Espetinhos com NCM único. **Bloqueio:** o responsável escolhe o código.
- [ ] Torta artesanal e Suco integral como Opção. Feito pelo responsável na tela, ou por
  operação autorizada.
- [ ] Sabor novo em Opção exige NCM antes de vender (hoje bloqueia a nota sem cenário).

## Etapa 3 — Variável

- [ ] Entidade Variável (escolha única, sem NCM, altera preço, entra no nome da nota).
- [ ] Unificação opcional dos produtos por tamanho.

**Próximo passo exato:** etapa 2, primeiro item, depois da decisão do NCM dos Espetinhos.
