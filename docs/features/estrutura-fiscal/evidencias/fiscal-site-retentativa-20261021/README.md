# Canal Site e novas tentativas fiscais — 21/10/2026

Dados, valores, clientes e documentos das imagens são fictícios. Capturas consultivas,
**Em revisão visual**. Não constituem aprovação de referência ou homologação SEFAZ.

- [Desktop: botão disponível na conferência de resultado](desktop.png).
- [Celular: campos fiscais ausentes por item](mobile.png).

## Comportamento

- O canal Site fotografado no pedido define Internet automaticamente para NF-e.
  NFC-e de entrega conserva seu indicador específico. Outros canais não são inferidos.
- Emitir permanece disponível após erro. Um clique posterior consulta a tentativa
  anterior quando necessário. Só uma rejeição comprovada libera outra revisão/envio.
- Autorização recuperada pela consulta mostra sucesso e documentos sem outra emissão.
  Incerteza, ausência e duplicidade não causam reenvio cego.
- Mensagens de cadastro indicam posição/nome do item e cada campo ausente, incluindo
  NCM e Origem ICMS. Não exigem quitação ou confirmação de cartão para emissão.
- Controles e superfícies reutilizam o detalhe de Pedidos, Button entrada,
  SelecaoFormulario, Card, Badge, GrupoAcoes e os tokens existentes. Sem dependências novas.

## Validação executada

Node 22.23.3. Ambiente local separado de produção, PostgreSQL e transporte fiscal fictícios.

- Regressão: `vitest run testes/fiscal-saida testes/tributacao testes/vendas/emitir-nota-pedido-interface.test.tsx --maxWorkers=1 --testTimeout=15000 --reporter=dot`.
  **2.071 aprovados; 267 ignorados por condições opt-in; 86 arquivos aprovados e 13 ignorados.**
  O limite temporário de 15 s considera a contenção já diagnosticada nesta máquina;
  não altera timeouts ou asserções no código do projeto.
- Integração afetada: `BRASILNFE_BANCO_TESTE=1`, conexão exclusiva localhost/teste,
  `brasilnfe-revisao-emissao-integracao.test.ts`: **38 aprovados**. Inclui Site/Internet
  sem confirmação, rejeição XML consultada no próprio clique, troca 65/55, concorrência,
  permissões e ausência de efeitos financeiros/estoque/notas recebidas.
- Playwright: `pedido-emissao.playwright.config.ts`: **40 aprovados**, 320/390/768/1440 px,
  claro/escuro. Rede externa bloqueada, auditor de interface sem problemas nos cenários
  verificados. Teclado, alinhamento, campos longos, erros e novas tentativas conferidos.
- Lint dos arquivos alterados: aprovado. `lint:design`: 423 arquivos, 422 consumidores,
  92 desvios históricos e nenhum novo. Nenhum baseline alterado ou aprovado pelo agente.
- `next typegen`, geração local do cliente Prisma vigente e `tsc --noEmit`: aprovados.
  A primeira checagem apontou cliente gerado anterior às mudanças de categorias da main;
  gerar o cliente atualizado resolveu os erros sem mudar código fora do pedido.

A primeira execução visual tinha a expectativa antiga de mensagem de NCM. Ela foi
atualizada para exigir item, NCM e Origem ICMS. A repetição completa passou. Um teste
de interface precisou aguardar o término da ação antes de verificar o botão habilitado.
As guardas de transmissão foram verificadas no servidor e na integração SQL.

Compilação de produção (`npm run build`, webpack): aprovada. Smoke local compilado: seis rotas aprovadas, com login 200 e páginas protegidas 307 sem sessão. A publicação e a conferência autenticada são verificadas no fechamento.
Nenhuma nota real foi emitida ou cancelada para testar. Não foram alterados certificados,
CSC, credenciais, habilitações externas, regras tributárias ou cadastros reais.
