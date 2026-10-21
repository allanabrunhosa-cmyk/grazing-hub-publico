# Arquitetura do editor e publicação controlada

[Voltar à Central de Design](./README.md)

**Documento de decisão e plano por etapas.** O texto abaixo conserva a arquitetura proposta
e estados intermediários, não o andamento atual. Consulte o [mapa implementado](README.md)
para caminhos reais e [EXECUCAO](EXECUCAO.md) para progresso. A revisão executável do
[inventário](inventario.md) prevalece sobre referências à adoção futura por módulos.

## 1. Fonte única da verdade

Separar quatro camadas, sem manter valores concorrentes em JSON, CSS e componentes:

| Camada | Responsabilidade | Quem altera |
| --- | --- | --- |
| Registro de propriedades | Tipos, limites, padrão, rótulo, unidade, grupo e dependências de cada propriedade | Código, com teste e deploy |
| Valores versionados | Valores permitidos de um rascunho ou publicação | Administrador no editor |
| Compilação de tema | Converte valores validados em variáveis CSS conhecidas | Serviço determinístico compartilhado |
| Componentes e padrões | Consomem variáveis e implementam acessibilidade/comportamento | Código compartilhado |

O registro gera os controles do editor, a validação do servidor e a documentação dos
tokens. Os padrões de fábrica vivem no registro versionado em código; o banco guarda
alterações permitidas e snapshots completos resolvidos para reprodução histórica.
Não permitir que alguém edite separadamente o CSS gerado e o documento de valores.

Hierarquia de resolução: padrões da versão de schema → valores compartilhados →
cores da identidade → modo claro/escuro → preferências obrigatórias de acessibilidade.
Na Etapa 3, o rascunho existe somente na memória da Central e substitui valores dentro da
prévia, nunca na aplicação operacional.

## 2. Organização sugerida no repositório

```text
src/lib/design-system/
  registro.ts                 definições tipadas e valores iniciais
  validacao.ts                limites, enums e combinações permitidas
  resolver-tema.ts            herança HUB/Etiquetas e claro/escuro
  gerar-css.ts                serialização segura de variáveis conhecidas
  servico.ts                  persistência, concorrência, publicação e restauração
  impacto.ts                  relações entre tokens, componentes e usos conhecidos
src/components/ui/            componentes reais já existentes
src/components/layout/        estrutura compartilhada já existente
src/components/design-system/
  editor-tokens.tsx           controles fechados de prévia e restauração local
  exemplos/                   estados demonstráveis com componentes reais
  previa/                     laboratório isolado e cenários fictícios
src/app/(protegido)/configuracoes/design/
  page.tsx                    visão geral
  [grupo]/page.tsx             seção com URL própria
  actions.ts                  operações autenticadas e autorizadas
docs/design-system/           princípios, contratos e plano de adoção
testes/design-system/         validação, persistência, segurança e interação
```

### Navegação aprovada para a etapa 2

`/configuracoes/design` e suas seções não têm lateral própria. A entrada **Central de Design**
fica expansível na lateral existente de Configurações, com **Fundamentos**, **Componentes** e
**Gestão** como filhos. A expansão mantém foco, indica página ativa e reaparece no menu móvel.
A rota, o recurso `configuracoes.design` e a autorização exclusiva de administrador foram
implementados na Etapa 2 e possuem validação no servidor.

O mesmo componente de navegação poderá ser aplicado a Inventário, preservando as rotas e as
permissões atuais de cada filho. Isso não autoriza reorganizar outros módulos.

O catálogo não deve importar Server Actions de emitir etiquetas, lançar despesas ou
manifestar notas. Demonstrações reutilizam a apresentação e simulam resultados,
com indicação explícita de que são exemplos.

## 3. O que o painel pode editar

Na primeira versão: cores semânticas, famílias de fontes previamente aprovadas,
escala de tamanhos/entrelinhas, raios por função, densidade, espaçamentos, largura
lateral dentro de limites, opacidade, blur, sombras predefinidas e duração de transições.
O padrão inicial deve reproduzir o produto atual, sem redesenho automático.

Exemplos de chaves: `tipografia.corpo.tamanho`, `controle.altura`, `botao.raio`,
`menu.largura`, `popover.afastamento`, `vidro.menu.opacidade`, `movimento.rapido`.
Usar propriedades por função, não nomes vinculados a uma tela de negócio.

O painel NÃO edita:

- JavaScript, HTML, seletores CSS, expressões `calc()`/`url()` ou código arbitrário.
- Regras de teclado/foco, protocolos ARIA ou lógica de seleção.
- Permissões, autenticação, operações fiscais e financeiras.
- Precisão de cálculos, conversões, fuso da loja ou validade dos alimentos.
- Layout físico de ZPL/PDF, DPI ou configurações da impressora.
- URLs externas de fontes/imagens sem procedimento específico de aprovação.

Regras de interação são documentadas e testadas como código. O painel pode selecionar
variantes já implementadas e aprovadas; não cria novos comportamentos sem desenvolvimento.

## 4. Prévia isolada

Recomendação: rota de laboratório protegida, exibida em iframe same-origin, com
componentes reais e dados fictícios. Assim, variáveis de um rascunho não vazam para a
central ou para a operação, e portais de diálogos/listas ficam no documento correto.

Não executar operações de negócio nesse documento. Comunicação do editor com a
prévia transmite somente valores tipados e versão do rascunho. Validar origem exata,
janela emissora e formato das mensagens; não usar origem curinga nem transmitir credenciais.
Rever a CSP real antes da implementação para permitir somente o enquadramento necessário.

Modos de inspeção: desktop, tablet, celular; HUB/Etiquetas; claro/escuro;
normal/hover/foco/desabilitado/erro/carregando. Preferências reduzidas precisam de
teste real no navegador, além de representações de estados na interface.

A comparação antes/depois usa a versão publicada e o rascunho atual. Não reproduzir
um screenshot estático no lugar de um componente interativo.

## 5. Persistência proposta

Reutilizar o PostgreSQL e Prisma do HUB. A configuração atual da loja é singleton;
não inventar uma arquitetura multiempresa nem um banco separado.

Modelos conceituais a detalhar em migration manual:

- **EstadoDesign:** vínculo com `ConfiguracaoLoja`, versão publicada e revisão de concorrência.
- **RascunhoDesign:** autor, versão de origem, valores validados, revisão e datas.
- **VersaoDesign:** snapshot imutável, versão do schema, motivo, autor e data da publicação.
- **EventoDesign:** criação/edição de rascunho, publicação, restauração e conflitos relevantes,
  sem senhas, cookies ou cópias de dados operacionais.

Identidades HUB/Etiquetas fazem parte do mesmo snapshot, permitindo publicar uma
combinação coerente. Não manter dois históricos independentes sem necessidade.
As novas tabelas são configuração e auditoria de design, não duplicação de cadastros.

## 6. Fluxo de publicação

```text
Versão publicada
      ↓ criar cópia editável
Rascunho → prévia → validações → comparação → confirmação
      ↓ transação atômica
Nova versão publicada → atualização do tema → histórico
      ↓ restaurar com confirmação
Nova versão baseada em snapshot anterior (sem apagar histórico)
```

Cada salvamento envia a revisão esperada. Dois administradores não sobrescrevem
silenciosamente o mesmo rascunho. Se a versão publicada mudou, mostrar conflito e
exigir reconciliação antes de publicar.

Publicação deve validar novamente sessão, autorização, revisão, schema, limites e
requisitos automáticos. Na mesma transação, criar snapshot imutável, atualizar o
ponteiro ativo e registrar auditoria. Chave de idempotência impede publicações
duplicadas em duplo clique ou repetição após timeout.

O diálogo de confirmação informa: versão de origem, identidades afetadas, componentes
conectados, diferenças, alertas e motivo. Exibir “Publicar para todos”, nunca “Salvar”
para uma ação que muda a operação inteira.

## 7. Aplicação da versão publicada

Ler e aplicar o tema antes da primeira renderização, evitando um flash da identidade
errada. Manter o mecanismo atual claro/escuro do `next-themes`; não criar uma segunda
preferência de aparência concorrente.

Variáveis de identidade devem estar em raiz/body para alcançar portais, como já ocorre
com Etiquetas. A ordem de CSS deve ser explícita: estilos base, valores publicados,
tema/mode, preferências de acessibilidade que não podem ser enfraquecidas pelo editor.

Definir cache pela revisão publicada e invalidar após publicação. Uma aba aberta
detecta revisão ao voltar ao foco ou por consulta periódica leve e mostra “Novo padrão
visual disponível”. Aplicar sem recarregar dados operacionais nem desmontar formulários.
Se houver edição ou interação modal em curso, permitir adiar até um momento seguro.
Não prometer atualização instantânea de todas as abas sem implementar esse mecanismo.

Na falha de leitura do tema, usar padrões de fábrica compatíveis e registrar a falha.
Um tema inválido não pode impedir login ou acesso à recuperação. Deve existir uma
forma administrativa protegida de abrir a central com o tema de fábrica e restaurar
a última versão válida; não um parâmetro público que amplie permissões.

## 8. Segurança e validação

- Autorização no servidor em leitura de rascunho, gravação, publicação e restauração.
- Na primeira entrega, exigir administrador ativo conforme a autenticação existente.
- Não alterar cookies, ampliar Domain, criar SSO ou abrir CORS para construir o editor.
- Revalidar o usuário atual; não confiar em um campo `admin` recebido do navegador.
- Rejeitar propriedades desconhecidas, números não finitos, unidades livres,
  strings maliciosas, valores fora dos limites e snapshots de schema incompatível.
- Gerar apenas variáveis CSS conhecidas com serialização estrita; nunca inserir CSS bruto do banco.
- Limites de tamanho para payload, rascunho, histórico e importação de preset.
- Restauração passa pela mesma autorização e validação de publicação.
- Auditoria obtém autoria da conta conectada, não de campo editável.
- Preview não deve expor rascunhos a usuários operacionais nem consumir dados reais por padrão.

Verificações automáticas de contraste devem trabalhar com cores resolvidas, incluindo
alpha e superfícies de referência. Casos que dependem de fundos variáveis permanecem
marcados para revisão manual. Não chamar um tema de acessível só por passar em um cálculo.

## 9. Publicação visual não é deploy

**Sem deploy:** mudar valores já suportados e validados, publicando uma versão de tema.

**Com código/testes/deploy:** criar componente, novo tipo de token, interação, fonte
externa, mudança de estratégia responsiva, permissão ou formato de dados.

Essa distinção garante autonomia para ajustes de aparência sem transformar o editor
em uma forma insegura de executar código em produção.

## 10. Impressão e documentos

O tema da interface não altera milímetros, DPI, modelo ZPL, código de barras, validade,
assinatura de etiqueta ou paginação de documentos. Padrões de impressão podem constar
do catálogo para consulta, mas têm validação e publicação específicas.
Nenhum teste de tema comprova impressão física.
