import { readFileSync } from "fs";
import { Agent } from "https";
import forge from "node-forge";
import { prisma } from "@/lib/prisma";
import { decifrar } from "@/lib/crypto";

// Carrega o certificado digital A1 (.pfx). Fonte preferida: banco de dados
// (CertificadoDigital, cadastrado em Configurações da Loja) — permite trocar o
// certificado sem redeploy. Sem cadastro no banco, cai no fallback de variáveis de
// ambiente (SEFAZ_CERTIFICADO_PATH/SENHA — secret montado pelo Dokploy).

export type CertificadoPem = {
  certPem: string;
  chavePem: string;
  titular: string | null;
  validoAte: Date | null;
};

let certificadoCache: CertificadoPem | null = null;

// Chamado pelas actions de upload/remoção pra um certificado novo valer imediatamente,
// sem precisar reiniciar o processo.
export function invalidarCacheCertificado() {
  certificadoCache = null;
}

// Extrai certificado + chave privada em PEM (e metadados de exibição: titular/validade)
// a partir dos bytes de um .pfx (PKCS#12). Reaproveitado tanto pelo carregamento em
// runtime quanto pela validação no momento do upload (pra dar erro claro se a senha
// estiver errada, e pra mostrar titular/validade na tela, antes de salvar).
export function parsePfx(pfxBuffer: Buffer, senha: string): CertificadoPem {
  const pfxAsn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString("binary")));

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, senha);
  } catch {
    throw new Error("Não foi possível abrir o certificado .pfx. Verifique o arquivo e a senha.");
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certificados = certBags[forge.pki.oids.certBag] ?? [];
  if (certificados.length === 0) {
    throw new Error("Nenhum certificado encontrado dentro do .pfx.");
  }
  const certPem = certificados
    .map((bag) => (bag.cert ? forge.pki.certificateToPem(bag.cert) : null))
    .filter((pem): pem is string => pem !== null)
    .join("\n");

  const primeiroCert = certificados[0]?.cert ?? null;
  const titular = primeiroCert?.subject.getField("CN")?.value ?? null;
  const validoAte = primeiroCert?.validity.notAfter ?? null;

  const keyBagsCriptografada = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBagsSimples = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const chaveBag =
    keyBagsCriptografada[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ?? keyBagsSimples[forge.pki.oids.keyBag]?.[0];
  if (!chaveBag?.key) {
    throw new Error("Nenhuma chave privada encontrada dentro do .pfx.");
  }
  const chavePem = forge.pki.privateKeyToPem(chaveBag.key);

  return { certPem, chavePem, titular, validoAte };
}

async function carregarDoFallbackEnv(): Promise<CertificadoPem> {
  const caminho = process.env.SEFAZ_CERTIFICADO_PATH;
  const senha = process.env.SEFAZ_CERTIFICADO_SENHA;
  if (!caminho) {
    throw new Error(
      "Nenhum certificado cadastrado em Configurações da Loja, e a variável SEFAZ_CERTIFICADO_PATH não está definida."
    );
  }
  if (!senha) {
    throw new Error(
      "Nenhum certificado cadastrado em Configurações da Loja, e a variável SEFAZ_CERTIFICADO_SENHA não está definida."
    );
  }
  return parsePfx(readFileSync(caminho), senha);
}

export async function carregarCertificadoPem(): Promise<CertificadoPem> {
  if (certificadoCache) return certificadoCache;

  const registro = await prisma.certificadoDigital.findUnique({ where: { id: "singleton" } });
  if (registro) {
    const senha = decifrar(registro.senhaCifrada);
    certificadoCache = parsePfx(Buffer.from(registro.arquivoData), senha);
    return certificadoCache;
  }

  certificadoCache = await carregarDoFallbackEnv();
  return certificadoCache;
}

// Agent HTTPS com mTLS (autenticação mútua) pronto pra usar nas chamadas ao webservice da SEFAZ.
export async function criarAgenteMTLS(): Promise<Agent> {
  const { certPem, chavePem } = await carregarCertificadoPem();
  return new Agent({
    cert: certPem,
    key: chavePem,
    // A cadeia de confiança do webservice da SEFAZ é validada contra as CAs padrão do Node
    // (Node já confia nas autoridades certificadoras que emitem esses certificados de servidor).
  });
}

export async function obterCnpjConsulta(): Promise<string> {
  const config = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
  const cnpjBruto = config?.cnpj || process.env.SEFAZ_CNPJ;
  if (!cnpjBruto) {
    throw new Error("CNPJ não configurado (cadastre em Configurações da Loja ou defina SEFAZ_CNPJ).");
  }
  const digitos = cnpjBruto.replace(/\D/g, "");
  if (digitos.length !== 14) throw new Error("O CNPJ configurado precisa ter 14 dígitos.");
  return digitos;
}
