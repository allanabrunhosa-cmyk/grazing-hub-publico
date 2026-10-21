/** PDF inteiramente fictício, em memória, para exercer o extrator real. */
export function pdfFicticio(linhas: string[]) {
  const texto = linhas.map((linha, i) => `${i ? "0 -18 Td " : ""}(${linha.replace(/[\\()]/g, "\\$&")}) Tj`).join("\n");
  const conteudo = `BT /F1 12 Tf 50 740 Td ${texto} ET`;
  const objetos = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets: number[] = [];
  objetos.forEach((o,i) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${i+1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
