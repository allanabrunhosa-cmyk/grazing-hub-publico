# Configuração privada do piloto fiscal

O código público não contém o cadastro empresarial do piloto. O ambiente privado deve fornecer o binding abaixo antes de usar esse fluxo.

| Variável | Formato |
| --- | --- |
| `GRAZING_PILOTO_FISCAL_CNPJ` | CNPJ explícito, com 14 dígitos, sem máscara |
| `GRAZING_PILOTO_FISCAL_IE` | Inscrição estadual explícita, com 2 a 14 dígitos |
| `GRAZING_PILOTO_FISCAL_COD_MUNICIPIO` | Código oficial do município, com 7 dígitos |

A leitura ocorre somente quando o piloto precisa do cadastro. Ausência ou formato inválido interrompe o fluxo com o nome da variável. A mensagem não informa o valor recebido. Os demais módulos não carregam esse binding na importação.

Os testes usam apenas um cadastro fictício explícito. Os JSONs de preparação e manifesto publicados são exemplos sintéticos. Eles conservam o formato documental e não constituem prova, configuração ou aprovação da operação real.

Essa mudança não configura produção. A aplicação de valores privados exige revisão do dossiê correto e aprovação operacional específica. O binding não autoriza transmissão, não troca ambiente, não aprova regras tributárias e não contorna as permissões e confirmações existentes.

Antes de utilizar o piloto, executar os testes de configuração e consumidores fiscais. Conferir o binding e o dossiê no canal privado, sem registrar os valores em comandos, logs ou documentação pública.
