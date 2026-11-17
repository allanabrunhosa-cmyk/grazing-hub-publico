# Preservação de manutenção — WIP

Esta branch preserva trabalho ainda local, sem instalar, ativar timers, limpar arquivos ou alterar serviços. Não integra automaticamente esse trabalho à main. Origem: código de `5a2c56611ad590d589eea2a8b44f9b1690f1b2a9` e dois scripts Windows não rastreados no checkout original.

## Arquivos revisados

| Grupo | Arquivos |
| --- | --- |
| VPS | `infra/grazing-publication-lock.sh`, `infra/grazing-storage-maintenance.py`, `infra/install-grazing-storage.py`, `infra/grazing-storage-config.json`, `infra/test_grazing_storage.py` |
| Unidades/timers | `infra/grazing-storage-cache.service`, `infra/grazing-storage-cache.timer`, `infra/grazing-storage-images.service`, `infra/grazing-storage-images.timer`, `infra/grazing-storage-monitor.service`, `infra/grazing-storage-monitor.timer` |
| Imagens | `scripts/compactar-fotos-sem-perdas.py`, `scripts/test_compactar_fotos.py` |
| Windows | `scripts/manutencao-armazenamento.ps1`, `scripts/armazenamento-seguro.psm1` |

## Sanitização e limites

- Hostname operacional substituído por `CONFIGURAR_HOST_APROVADO`; a guarda bloqueia ambiente não correspondente.
- Caminhos Windows privados removidos. O diretório de estado depende de `GRAZING_STORAGE_STATE_DIRECTORY`, explicitamente configurado, com validação de presença/igualdade. A raiz do projeto é derivada do script e validada.
- Nenhum catálogo privado, estado de manutenção, inventário operacional, backup, credencial, dado de cliente ou relatório antigo acompanha o código.
- Os 12 arquivos sem sanitização conservam os bytes extraídos do commit de origem. Os três alterados são config JSON e os dois scripts Windows. Originais intactos.
- **O instalador VPS ativa timers e substitui dois crons. Não executá-lo como parte da passagem ou de um setup genérico.** Exige revisão operacional própria.
- O contrato local exige lista explícita de limpeza, validação de caminhos/links, processos e preservação. A nova variável não autoriza criar/ampliar essa lista ou escolher diretório arbitrário.

## Validação executada e pendente

Leitura integral dos 15 arquivos antes de envio. Parser PowerShell das duas cópias sanitizadas: **zero erros**. Nenhum módulo foi importado para operar o ambiente. Testes Python foram lidos, mas **não executados**: runtime Python real indisponível, variável `CODEX_PRIMARY_RUNTIME_PYTHON` ausente e alias local inacessível.

Antes de uso: executar testes puros em ambiente isolado; testar caminhos, links/junctions, processos, catálogo, permissões, concorrência e falhas. Conferir dependências do compactador e política de manutenção. Aprovação de preservação não aprova instalação, limpeza nem alteração da VPS.

Documentos operacionais privados que acompanhavam a implementação permanecem locais e exigem destino privado gravável para conclusão do acervo. Não publicar esses relatórios para preencher a lacuna.
