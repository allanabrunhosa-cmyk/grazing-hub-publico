# Documentação consultável do Grazing HUB

Comece pelo [roteador de trabalho](../AGENTS.md). Não leia este diretório inteiro.
Documentação operacional descreve contratos vigentes; relatórios datados registram evidências,
não autorização para repetir operações. Código e testes confirmam a implementação.

## Escolha pelo trabalho

| Alteração | Consultar |
| --- | --- |
| Entender limites da aplicação | [Arquitetura](contexto/arquitetura.md) |
| Schema, Prisma, transações | [Banco](contexto/banco-de-dados.md) |
| Sessão, host, permissões, recuperação | [Autenticação](contexto/autenticacao-permissoes.md) |
| Auditoria e histórico de atividades por autor | [Auditoria/atividades](contexto/auditoria-atividades.md) |
| Publicação, infraestrutura, reversão | [Deploy](contexto/deploy.md) |
| Atendimento, repositório próprio e integração com o HUB | [Atendimento](contexto/atendimento.md) |
| Git, branches e fechamento de tarefa | [Versionamento](contexto/versionamento.md) |
| Escolher validações | [Testes A/B/C](contexto/testes.md) |
| Registrar descoberta / feature extensa | [Manutenção do contexto](contexto/documentacao.md), [features](features/README.md) |
| Movimentações, extrato, DRE, faturas | [Financeiro](modulos/financeiro.md) |
| Estoque, entrada avulsa, perdas, contagem | [Estoque](modulos/estoque.md) |
| Insumos, preparações, conversões, custo | [Insumos](modulos/insumos.md) |
| Pedidos e recebimentos | [Compras](modulos/compras.md) |
| Catálogo, composição e formas comerciais | [Vendas](modulos/vendas.md) |
| Etiquetas, validades e impressora | [Produção](modulos/producao.md) |
| NF-e, NFS-e, certificados e SEFAZ | [Fiscal](modulos/fiscal.md) |
| Fornecedores, beneficiários, empresa e usuários | [Cadastros](modulos/cadastros.md) |
| MCP remoto, OAuth e consultas financeiras por aplicações | [MCP](features/mcp/SPEC.md), [operação](features/mcp/OPERACAO.md) |
| UI, tokens e Central de Design | [Central de Design](design-system/README.md) |

## Fontes e histórico

- Mapas acima são pontos de entrada curtos, não cópias do código.
- Guias de feature existentes continuam em seus endereços: [faturas](financeiro/cartoes/README.md),
  [Etiquetas](etiquetas.md), [entrada avulsa](estoque-entrada-avulsa-restauracao.md).
- [Pedidos, produção e calendário](features/pedidos/SPEC.md): escopo operacional e evidências em EXECUCAO.
- [Auditoria desta reorganização](contexto/AUDITORIA.md): decisões, lacunas e validações.
- [Histórico original preservado](historico/README.md): consulte por assunto somente para
  investigar decisões antigas. Não é leitura obrigatória.
