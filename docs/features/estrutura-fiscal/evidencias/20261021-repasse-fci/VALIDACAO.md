# Validação local — 21/10/2026

Node 22.23.3. Dependências existentes. Dados fictícios e PostgreSQL local isolado.
Não houve emissão, cancelamento nem consulta ao provedor/SEFAZ.

| Verificação | Resultado executado |
| --- | --- |
| Domínios tributação/saída e consumidores próximos | 2.006 aprovados, cinco falhas, 266 opt-ins ignorados |
| Repetição isolada dos três arquivos com falha | 107/107 aprovados, sem alterar prazos |
| Integração SQL final | 31/31 aprovados |
| Tipos | `next typegen` e `tsc --noEmit` aprovados |
| Compilação | `next build --webpack` aprovado |
| Lint dos arquivos alterados | Aprovado |
| Lint de design | 421 arquivos, 92 desvios históricos, nenhum novo |
| Visual isolado | 16 cenários aprovados: quatro larguras, dois temas, origem e repasse |
| Navegação na compilação local | Seis rotas exigiram sessão; host desconhecido recusado |

A execução completa teve quatro estouros de 5s e uma falha de interação após um
deles. A execução isolada dos mesmos arquivos passou com os limites originais:
`brasilnfe-numeracao-interface`, `brasilnfe-regras-interface` e `brasilnfe-operacoes`.
Não houve alteração de teste para ocultar as falhas. Os 2.011 casos únicos ficaram
cobertos pelas duas execuções. A execução completa, isoladamente, não foi verde.

A integração final ativou `ESTRUTURA_FISCAL_BANCO_TESTE=1` e
`PARAMETROS_FISCAIS_BANCO_TESTE=1` no banco `teste_estrutura_fiscal`, em localhost.
Os schemas temporários foram removidos pelos testes. Os demais opt-ins não foram
executados e não são apresentados como aprovados.

As provas cobrem origem, materiais, NCM, controle divergente, XML inválido,
ambiente/modelo/protocolo, data civil, documentos futuros, manifestação incompatível,
reconstrução do selo, imutabilidade, concorrência de versões, auditoria, permissões,
sessão revogada, regra individual da referência e impacto restrito ao kit dependente.

A revisão automática bloqueou uma consulta complementar à configuração privada de
NFC-e. A consulta não foi executada nem repetida por outra ferramenta. A aptidão
atual da configuração externa e uma autorização fiscal real permanecem sem confirmação.
Certificado, CSC e credenciais não foram alterados. A publicação não é homologação externa.
