# Cadastros

Mapa conferido em 23/09/2026, base 2fac409. Fornecedores/beneficiários, empresa, usuários e perfil.

## Rotas e componentes

Base: `src/app/(protegido)`. Nomes relativos abaixo pertencem a essa base.

- /fornecedores → fornecedores/actions.ts, csv.ts, fornecedores-table.tsx, fornecedor-dialog.tsx, beneficiario-dialog.tsx
- /configuracoes/empresa → configuracoes/actions.ts, dados-loja-form.tsx
- /financeiro/fiscal/configuracoes → numeração e certificado-card.tsx; certificado deixa Dados da empresa. Guarda fiscal na página e permissões `configuracoes.loja` nas ações; edição/exclusão continuam administrativas.
- /configuracoes/usuarios → usuarios/actions.ts, usuarios-permissoes.tsx, matriz-permissoes.tsx na pasta configuracoes
- /perfil → perfil; fotos privadas: src/app/api/usuarios
- /configuracoes/design → Central de Design

## Serviços

- src/components/status-ativo.tsx: estado compartilhado
- src/lib/caixa-alta.ts, documento-brasileiro.ts: normalização
- src/lib/permissoes: regras; src/lib/session.ts: identidade atual

## Banco de dados

Fornecedor diferencia FORNECEDOR/BENEFICIARIO; Usuario/PerfilAcesso/HistoricoAcesso; ConfiguracaoLoja, CertificadoDigital e ConfiguracaoEmail.

## Regras importantes

- Compras/Insumos/Manifesto de produtos usam fornecedores apropriados; Financeiro aceita também beneficiários no mesmo fornecedorId.
- Nome/razão social normalizados; e-mail/site/observações preservados.
- A coluna Insumos, os detalhes e o formulário em `/fornecedores` usam o DTO `FornecedorRow.insumosVinculados`: apenas insumos ativos existentes na união de `insumosPrincipais` e `insumosHomologados` (`InsumoFornecedor`), ordenados por nome e sem duplicar o mesmo insumo no fornecedor. `quantidadeInsumos` deriva dessa lista. As abas mantêm a quantidade de ativos; filtros de status contam o tipo selecionado e a busca antes da aplicação do status.
- Inativar preserva histórico/vínculos; status não regrava formulário inteiro.
- Inativar um insumo oculta seu vínculo e reativar o torna visível novamente; a exclusão física remove `InsumoFornecedor` por cascata. Salvar, alterar status, excluir ou importar insumos revalida `/fornecedores`; a conciliação de NF-e também revalida a tela ao homologar vínculos.
- Cadastro rápido operacional exige permissão específica e não pode enviar o formulário pai. Filtros de consulta não criam cadastros.
- Fornecedores e beneficiários têm uma única edição na coluna Ações da linha principal, à esquerda do X de excluir. Os detalhes expandidos não repetem o botão; formulário, confirmação de exclusão e permissões permanecem nos componentes existentes.
- Usuario é a fonte de responsáveis; RH ainda não é cadastro operacional.
- Não expor segredos em DTO/docs/logs nem executar seed-admin/configurar-email em deploy normal.

## Integrações e cuidados

Não alterar conta/perfil/certificado real para teste. CRM/RH/Patrimônio continuam indisponíveis, sem inventar mapas de serviços inexistentes.

## Testes relevantes

testes/cadastros; testes/permissoes e testes/login para acesso/usuários. Consumidores de Compras/Insumos/Financeiro para seletores.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Referências

[Autenticação](../contexto/autenticacao-permissoes.md), [Design](../design-system/README.md).

## Endereço da empresa como origem de Entregas — 03/10/2026

Dados da empresa reutiliza `CamposEnderecoPedido` com país oculto e complemento opcional; CEP preenche os campos postais e não grava ao perder foco. `ConfiguracaoLoja.enderecoEstruturado` é JSON aditivo validado no servidor; o texto legado permanece disponível até completar o endereço. Salvar exige `configuracoes.loja`, revalidação transacional de sessão/perfil, trava `entregas-config` e auditoria `LOJA`; uma mudança no endereço estruturado incrementa `versaoEntregas` para invalidar recibos. Não alterar certificado ou endereços reais para testar.
