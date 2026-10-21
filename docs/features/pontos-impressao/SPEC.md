# Pontos de impressão das Etiquetas

## Objetivo

Permitir que um usuário autorizado do Grazing Etiquetas envie um trabalho ZPL existente a uma Zebra USB ligada a uma Raspberry, sem depender do navegador da cozinha. A situação do conector e da impressora deve ser observável separadamente. Esta especificação não autoriza implantação em produção nem instalação no equipamento.

## Limites do produto atual

O banco atual possui `ConfiguracaoLoja` com identificador `singleton` e não possui cadastro de unidades independentes. O ponto, o código de vínculo, a credencial e a fila são escopados por `lojaId`. Não há seleção de outra empresa ou unidade nesta versão; ampliar para várias unidades requer uma identidade de unidade no domínio e testes próprios.

## Fluxo e regras

1. Administrador cria ponto com nome, ícone e estado; no máximo um padrão ativo por loja.
2. Administrador emite código aleatório de uso único, com validade curta. Apenas o instalador local recebe esse código, digitado interativamente. Código e credencial são persistidos no servidor somente como hash. Tentativas de vínculo são limitadas por origem e pelo código.
3. Conector troca o código por credencial própria. O recebimento de comunicação é registrado com horário do servidor. Menos de 90 segundos é recente; depois disso, a conexão é atrasada. Impressora detectada é uma informação distinta.
4. O conector consulta trabalhos de saída, reserva um por impressora, grava um diário local antes de qualquer escrita USB e confirma resultado. Uma reserva expirada vira resultado incerto, sem reenvio automático. A escrita USB não prova saída física.
5. O operador prepara a etiqueta pelas regras existentes, escolhe um ponto ativo e envia. Reimpressão exige ação explícita e nova chave. O trabalho original e seu ZPL permanecem imutáveis.
6. O perfil de Wi-Fi atual não é tocado. A interface mostra estado e redes 2,4 GHz detectadas. Futura alteração remota exige confirmação de presença local, segredo cifrado e efêmero no servidor, perfil novo, temporizador de reversão e prova de HTTPS vinculada à interface Wi-Fi. Nenhuma alteração de rede integra a execução atual.

## Arquitetura

- Banco: modelos aditivos em `prisma/schema.prisma` e SQL manual em `prisma/migrations/`.
- Site: ações administrativas sob sessão e permissão de Produção; API de conector sob token do dispositivo, sem sessão humana. Apenas o host dedicado de Etiquetas recebe essa API.
- Conector: processo local de saída HTTPS; somente ZPL fornecido pela fila autenticada, sem execução de comandos arbitrários do servidor. Serviço systemd instalado posteriormente com autorização e conta `grazing-print`. A única elevação prevista é o helper delimitado de mudança futura de Wi-Fi.
- UX: seção de configuração e fluxo de impressão existentes em `src/app/(protegido)/producao/etiquetas/`.

## Aceite

- Testes cobrem vínculo único, expiração, revogação, escopo por loja, heartbeat, fila atômica, resultado incerto e reimpressão explícita.
- Simulação não conta como impressão real. Aceite físico posterior: celular com computador desligado, inspeção da etiqueta 60×60 e recuperação acompanhada após falhas.
