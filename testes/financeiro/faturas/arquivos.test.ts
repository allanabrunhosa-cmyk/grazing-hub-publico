import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extrairArquivo, recusarDadosSensiveis } from "@/lib/financeiro/faturas/arquivo";

it.each(["xlsx","xls"] as const)("extrai %s real em memória, sem arquivo de produção",async formato=>{
  const livro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(livro,XLSX.utils.aoa_to_sheet([["Data","Descrição","Valor"],["01/09/2026","COMPRA FICTICIA","20,00"]]),"Fatura");
  const r=await extrairArquivo(XLSX.write(livro,{type:"buffer",bookType:formato}),`fatura.${formato}`);
  expect(r.linhas).toHaveLength(1);expect(r.linhas[0].valor).toBe(2000);
});
it("XLSX com colunas inesperadas exige mapeamento",async()=>{
  const livro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(livro,XLSX.utils.aoa_to_sheet([["X","Y","Z"],["a","b","c"]]),"Fatura");
  await expect(extrairArquivo(XLSX.write(livro,{type:"buffer",bookType:"xlsx"}),"fatura.xlsx")).rejects.toThrow("Colunas");
});
it("não armazena PAN ou CVV detectável e aceita final mascarado",()=>{
  expect(()=>recusarDadosSensiveis("4111 1111 1111 1111")).toThrow("mascarado");
  expect(()=>recusarDadosSensiveis("CVV: 123")).toThrow("mascarado");
  expect(()=>recusarDadosSensiveis("Cartão **** 1234")).not.toThrow();
});
it("PDF pesquisável sintético passa pelo parser real",async()=>{
  const conteudo="BT /F1 12 Tf 50 700 Td (01/09/2026 COMPRA FICTICIA 20,00) Tj ET";
  const objetos=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`];
  let pdf="%PDF-1.4\n";const offsets=[0];objetos.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const r=await extrairArquivo(Buffer.from(pdf),"fatura.pdf");expect(r.linhas).toHaveLength(1);expect(r.linhas[0].valor).toBe(2000);
});
