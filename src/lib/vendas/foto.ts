export function mimeFotoVenda(dados: Uint8Array): string | null {
  if (dados.length < 12 || dados.length > 2 * 1024 * 1024) return null;
  if (dados[0] === 0xff && dados[1] === 0xd8 && dados[2] === 0xff) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((n,i) => dados[i] === n)) return "image/png";
  if (String.fromCharCode(...dados.slice(0,4)) === "RIFF" && String.fromCharCode(...dados.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}
