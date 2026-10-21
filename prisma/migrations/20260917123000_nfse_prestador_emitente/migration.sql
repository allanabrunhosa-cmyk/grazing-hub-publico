-- O leiaute nacional coloca o nome completo no bloco <emit>. A primeira versão
-- priorizava <prest> (dentro do DPS), que trazia apenas CNPJ e inscrição municipal.
UPDATE "NotaFiscalServico"
SET
  "prestadorNome" = COALESCE("prestadorNome", substring("xml" FROM '(?s)<emit[^>]*>.*?<xNome>([^<]+)</xNome>')),
  "prestadorCnpj" = COALESCE("prestadorCnpj", substring("xml" FROM '(?s)<emit[^>]*>.*?<CNPJ>([^<]+)</CNPJ>')),
  "prestadorDados" = COALESCE(
    "prestadorDados",
    jsonb_build_object(
      'nome', substring("xml" FROM '(?s)<emit[^>]*>.*?<xNome>([^<]+)</xNome>'),
      'cnpj', substring("xml" FROM '(?s)<emit[^>]*>.*?<CNPJ>([^<]+)</CNPJ>'),
      'cpf', NULL,
      'inscricaoMunicipal', substring("xml" FROM '(?s)<emit[^>]*>.*?<IM>([^<]+)</IM>'),
      'email', NULL,
      'telefone', NULL,
      'endereco', jsonb_build_object(
        'logradouro', substring("xml" FROM '(?s)<emit[^>]*>.*?<enderNac[^>]*>.*?<xLgr>([^<]+)</xLgr>'),
        'numero', substring("xml" FROM '(?s)<emit[^>]*>.*?<enderNac[^>]*>.*?<nro>([^<]+)</nro>'),
        'complemento', NULL,
        'bairro', substring("xml" FROM '(?s)<emit[^>]*>.*?<enderNac[^>]*>.*?<xBairro>([^<]+)</xBairro>'),
        'municipio', NULL,
        'codigoMunicipio', substring("xml" FROM '(?s)<emit[^>]*>.*?<enderNac[^>]*>.*?<cMun>([^<]+)</cMun>'),
        'uf', substring("xml" FROM '(?s)<emit[^>]*>.*?<enderNac[^>]*>.*?<UF>([^<]+)</UF>'),
        'cep', substring("xml" FROM '(?s)<emit[^>]*>.*?<enderNac[^>]*>.*?<CEP>([^<]+)</CEP>')
      )
    )
  )
WHERE "prestadorNome" IS NULL
  AND "xml" IS NOT NULL
  AND "xml" LIKE '%<emit%';
