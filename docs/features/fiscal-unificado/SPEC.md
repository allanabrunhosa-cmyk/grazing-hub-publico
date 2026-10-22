# Fiscal unificado

## Objetivo e limite

Manter os dados fiscais uma vez, em telas visíveis, e consumir as mesmas versões
na prévia e na montagem do documento. O contrato implementado está no
[README](README.md). A execução e suas evidências ficam em [TASKS](TASKS.md).

Não inclui emissão ou cancelamento real, alteração de estoque, financeiro,
Takeat, distribuição SEFAZ ou configuração externa. Não redefine tributos nem
publica automaticamente a branch em produção.

## Decisões e caminhos

- `tributacao/ficha.ts` e `vigencia.ts`: seleção compartilhada, sem decisão em empate.
- `tributacao/manutencao.ts`: rascunho, impacto, aplicação e comparação. Reutiliza
  autorização, versões, locks, validações e auditoria do serviço fiscal existente.
- `financeiro/fiscal/ficha-produto.tsx`: ficha usada também em Produtos → Fiscal.
- `financeiro/fiscal/cadastros-fiscais.tsx`: regras dos grupos cadastrados, referências
  internas, complementos, tabelas e histórico acessíveis no fluxo normal.
- `financeiro/fiscal/configuracoes`: composição dos cadastros existentes. Cada bloco
  conserva sua guarda. Não há armazenamento novo para credenciais ou contadores.
- Campos opcionais em JSON conservam hashes e alcance das versões anteriores.
  Não há migration SQL nova. A conciliação e a reversão seguem o roteiro do README.

## Aceite verificável

1. Alterar e aplicar NCM pela ficha muda a prévia e o documento montado em 55 e 65.
2. Uma exceção individual prevalece. Desabilitá-la por nova versão recupera o padrão
   compatível do grupo. Nenhum parâmetro anterior é apagado.
3. Modelo, destino, destinatário e vigência delimitam o resultado. Aplicar a edição
   mantém o contexto selecionado na ficha.
4. A receita não cria linhas fiscais automaticamente. Kit documentado conserva
   componentes, quantidades e dados próprios, inclusive referências internas.
5. Rascunho, revisão, aplicação e histórico ficam na mesma tela. O botão Salvar
   comercial não grava dados fiscais e não valida a edição fiscal independente.
6. Rotas antigas redirecionam com suas guardas. A central está disponível no menu
   para os acessos históricos pertinentes; cada bloco continua protegido no servidor.
7. Documentos, tentativas e fotografias anteriores permanecem intactos. Alterações
   exigem vigência atual ou futura e futura confirmação recalcula a prévia.
8. A simulação mostra diferenças antes de qualquer conciliação. Nenhum conflito
   tributário é resolvido automaticamente.

## Validação

Testes puros, consumidores, PostgreSQL isolado, navegação, permissões, lint, design,
tipos, build e inspeção visual em desktop e celular. A prévia usa fixtures e bloqueia
rede externa. Capturas novas permanecem Em revisão; não representam aceite da SEFAZ
nem aprovação humana do visual. Resultados e limitações exatos ficam em TASKS.
