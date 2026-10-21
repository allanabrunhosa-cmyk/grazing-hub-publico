# Auditoria e entrega — contexto modular

Conferência em 23/09/2026; base de código: **2fac409**. Escopo exclusivamente documental.
Trabalho isolado em .worktrees/contexto-modular para não incorporar alterações alheias
do checkout principal. Nenhum dado real, serviço externo ou configuração de produção operado.

## Diagnóstico e decisões

| Encontrado | Tratamento |
| --- | --- |
| AGENTS exigia CONTEXTO inteiro para qualquer tarefa | Roteador por domínio e regras mínimas; leitura seletiva |
| CONTEXTO tinha 1.892 linhas de contratos misturados com execuções | Índice de 18 linhas; contratos extraídos; original integral arquivado |
| README padrão de create-next-app/Vercel não descrevia o deploy real | Entrada do HUB, ambiente local e Docker/Dokploy |
| Financeiro, estoque, fiscal e autenticação redescobertos em relatos longos | Oito mapas com código, regras, relações, integrações e testes |
| Certificado: instrução antiga de reaplicar env/mount vs prioridade atual do banco | Guia de deploy preserva configuração observada; nunca reaplica cegamente |
| Etiquetas: referência antiga a rewrite e contexto dedicado | Mapa registra 307 no mesmo host e cookie host-only conforme middleware |
| Timer confundido com periodicidade das consultas fiscais | Diferenciar despertar a cada cinco minutos da agenda dos serviços |
| PDFs: limitações antigas de datas completas vs parser atual Inter/Itaú | Mapa financeiro aponta guia atual e explicita inferências/conferência |
| README da Central e inventário misturavam proposta e implementação | Índice operacional, proposta preservada e baseline explicitamente histórico |
| Guia arquitetural da Central ainda situava adoção na etapa 5 | Aviso de decisão/plano; progresso no registro existente, sem segunda lista |
| EXECUCAO da Central ligava a anexo não versionado | Referência bibliográfica/hash preservados; ausência explícita, sem link inexistente |
| Validações extensas repetidas sem avaliar impacto | Níveis A/B/C, opt-ins explícitos e exceção documental |
| Conhecimento futuro sem documento dono | Procedimento confirmar → resolver → registrar no domínio; padrão SPEC/TASKS |

Não foi apagado conhecimento válido para reduzir linhas. Textos históricos grandes
continuam consultáveis por busca, mas não integram a leitura obrigatória nem regem a operação.
Relatos de resultados anteriores não foram convertidos em testes desta tarefa.

## Estrutura e cobertura

- [Índice geral](../README.md) e [roteador](../../AGENTS.md).
- Seis guias transversais: arquitetura, banco-de-dados, autenticacao-permissoes,
  deploy, testes e documentacao, nesta pasta.
- Oito mapas: Financeiro, Estoque, Insumos/Preparações, Compras, Vendas,
  Produção/Etiquetas, Fiscal e Cadastros, em docs/modulos.
- [Central de Design](../design-system/README.md): entrada para contratos/componentes,
  inventário e evidências, sem duplicar o manual ou o catálogo executável.
- [Features extensas](../features/README.md): SPEC/TASKS proporcionais, reutilizando
  EXECUCAO quando já existe; não foram criadas features vazias.
- [Histórico](../historico/README.md): conteúdo anterior completo e tabela assunto → mapa.
  Proposta original da Central preservada em [arquivo próprio](../design-system/historico-proposta.md).

O novo AGENTS tem 66 linhas. Exemplo Financeiro: roteador + mapa têm 117 linhas,
contra 1.917 de AGENTS + CONTEXTO antes. São medidas de linhas de entrada, **não medição
de tokens nem promessa de redução total**: UI, integrações e risco podem exigir outros guias.

## Progresso da reestruturação

- [x] Etapa 1: auditar documentos, instruções, código e scripts oficiais.
- [x] Etapas 2–4: índices, roteador e eficiência contextual.
- [x] Etapas 5–7: mapas reais, banco e validação proporcional.
- [x] Etapas 8–9: descoberta reutilizável e contrato para features grandes.
- [x] Etapas 10–11: preservar CONTEXTO e limitar mudanças a Markdown.
- [x] Etapa 12: conferir links, caminhos, fontes preservadas e diff.

## Validação documental executada

- Verificador somente leitura (Node): 43 documentos Markdown, 150 links internos,
  zero destinos/âncoras ausentes. Inclui documentos existentes, não apenas os novos.
- Caminhos operacionais e nomes de arquivos confrontados com a árvore; diretório do
  client Prisma confirmado no generator, sem gerar artefatos só para esta tarefa.
- Conteúdo dos dois arquivos históricos comparado ao original, normalizando apenas
  finais de linha e fim do arquivo: preservação integral após aviso editorial.
- Bloco Next gerado em AGENTS comparado: inalterado. Mapas têm 41–51 linhas;
  seis guias transversais têm 34–61 linhas; AGENTS permanece abaixo de 100.
- Revisão de diff e git diff --check, sem erros de whitespace. Mudanças somente .md;
  nenhum código, dependência, configuração executável ou schema modificado.
- Status do checkout principal reconferido: alterações alheias preservadas.
  Sem testes funcionais, push ou deploy. Não alegamos execução de build/typecheck.

## Limites e pendências reais

- Não revalidamos estado da VPS, DNS/TLS, certificado, serviços fiscais, SMTP ou impressoras.
  Guias distinguem procedimento/código das evidências históricas de produção.
- CRM/RH/Patrimônio não têm operação implementada na base: não inventamos serviços.
- Contrato integral original da Central depende de anexo não versionado. Encontrado
  no checkout principal e hash conferido; não foi incorporado por pertencer ao trabalho
  preexistente. Um clone novo ainda depende do fornecimento desse anexo.
- URLs externas históricas não foram acessadas. Caminhos de artefatos gerados (Prisma)
  e placeholders de features/migrations não são arquivos que este checkout deva conter.
- Nenhum build, teste funcional, migration ou deploy é necessário para este diff documental.
  Não há evidência nova de regressão funcional nem alteração intencional de comportamento.
- Integração desta branch deve ser separada de publicação. **Não enviar main somente
  para entregar documentação**, porque o webhook existente dispara deploy.

## Integração autorizada

Após envio da branch e abertura do PR #1 como rascunho, o usuário autorizou integrar
ao main e concluir as verificações necessárias. O PR continua restrito a Markdown;
não inclui os commits divergentes nem as alterações locais do checkout principal.
Como main aciona Dokploy, preservar configuração e verificar estabilidade/HTTPS após
o merge. Resultados pós-integração ficam no PR e na entrega, sem commit em ciclo de deploy.

Próximo passo desta conferência: concluir o merge autorizado e verificar seus efeitos.
Não há implementação funcional nova nem migration nesta entrega.
