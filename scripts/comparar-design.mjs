import { pathToFileURL } from "node:url";

export function compararPixels(a, b) {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) {
    return { iguais: false, motivo: "Dimensões diferentes; recapture no mesmo viewport." };
  }
  let diferentes = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) diferentes++;
  }
  const total = a.width * a.height;
  return { iguais: diferentes === 0, largura: a.width, altura: a.height, pixelsDiferentes: diferentes, total, percentual: total ? 100 * diferentes / total : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [antes, depois] = process.argv.slice(2);
  if (!antes || !depois) throw new Error("Uso: node scripts/comparar-design.mjs antes.png depois.png. Nunca atualiza referências.");
  // Sharp já é fornecido pelo Next instalado. Nenhuma dependência nova ou serviço externo.
  const { default: sharp } = await import("sharp");
  async function ler(arquivo) {
    const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
  const resultado = compararPixels(await ler(antes), await ler(depois));
  console.log(JSON.stringify(resultado, null, 2));
  if (!resultado.iguais) { console.error("Diferença exige inspeção; não é aprovação nem atualização automática."); process.exitCode = 1; }
}
