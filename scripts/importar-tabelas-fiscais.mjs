/** Importação LOCAL de arquivos oficiais. Não consulta contas nem altera cadastros ou regras. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import XLSX from "xlsx";
import { JSDOM } from "jsdom";
import { PDFParse } from "pdf-parse";

const entrada = path.resolve(process.argv[2] ?? ".tmp/tabelas-fiscais-20261014");
const destino = path.resolve("src/lib/fiscal/catalogos/2026-10-14");
const dia = "2026-10-14";
const texto = v => String(v ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]/g, " ").replace(/\s+/g, " ").trim();
const data = v => {
  if (!v) return null;
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`; }
  const m = String(v).match(/(\d{2})[/.](\d{2})[/.](\d{4}|\d{2})\b/); return m ? `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2]}-${m[1]}` : null;
};
const ler = nome => fs.readFileSync(path.join(entrada, nome));
const planilha = (nome, aba) => { const w = XLSX.read(ler(nome)); return XLSX.utils.sheet_to_json(w.Sheets[aba ?? w.SheetNames[0]], { header: 1, defval: null }); };
fs.mkdirSync(destino, { recursive: true });
const resumo = [];
function gravar(id, nome, fonte, versao, registros) {
  if (!registros.length || registros.some(r => !r.codigo || !r.descricao || /[<>\u0000-\u001f]/.test(r.descricao))) throw new Error(`Tabela inválida: ${id}`);
  const sha256Origem = createHash("sha256").update(ler(nome)).digest("hex");
  const tabela = { id, versao, obtidoEm: dia, fonte, sha256Origem, registros };
  fs.writeFileSync(path.join(destino, `${id}.json`), JSON.stringify(tabela) + "\n");
  resumo.push({ id, versao, quantidade: registros.length, sha256Origem });
}

const ncm = JSON.parse(ler("ncm-oficial.json").toString("utf8"));
const hierarquia = ncm.Nomenclaturas.map(r => ({ ...r, codigo: r.Codigo.replace(/\./g, ""), descricao: texto(r.Descricao) }));
// Capítulo não descreve necessariamente a mercadoria específica. A posição e os
// desdobramentos identificam a folha e evitam que "café" encontre todo o capítulo 09.
const pais = hierarquia.filter(r => r.codigo.length > 2 && r.codigo.length < 8);
gravar("ncm", "ncm-oficial.json", "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json", `${ncm.Data_Ultima_Atualizacao_NCM} · ${ncm.Ato}`, hierarquia.filter(r => /^\d{8}$/.test(r.codigo)).map(r => ({
  codigo: r.codigo, descricao: [...pais.filter(p => r.codigo.startsWith(p.codigo)).map(p => p.descricao), r.descricao].join(" / "),
  inicio: data(r.Data_Inicio), fim: data(r.Data_Fim), ato: `${r.Tipo_Ato_Ini} ${r.Numero_Ato_Ini}/${r.Ano_Ato_Ini}`,
})));

gravar("cfop", "cfop.xlsx", "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=74KmX8poGpM=", "2026-09-04", planilha("cfop.xlsx").slice(1).filter(r => /^\d{4}$/.test(String(r[0]))).map(r => ({ codigo: String(r[0]), descricao: texto(r[12]), detalhe: texto(r[13]), inicio: data(r[1]), fim: data(r[2]), nfe: r[3] === 1, devolucao: r[6] === 1 })));

const doc = new JSDOM(ler("cest-oficial.html").toString("utf8")).window.document;
const cest = [];
for (const tr of doc.querySelectorAll("tr")) {
 const col = [...tr.querySelectorAll(":scope > td")].map(td => texto(td.textContent));
 const ci = col.findIndex(c => /^\d{2}\.\d{3}\.\d{2}$/.test(c));
 if (ci < 0 || !col[ci + 1] || !/\d{2}/.test(col[ci + 1]) || !col[ci + 2] || /revogado/i.test(col[ci + 2])) continue;
 const remissao = texto(tr.previousElementSibling?.textContent ?? "");
 const antigo = !!tr.querySelector('[class^="A9-"]');
 const fim = /efeitos até/i.test(remissao) ? data(remissao) : null;
 if (antigo && !fim) continue; // Histórico sem vigência demonstrável não vira opção atual.
 const inicio = !antigo && /efeitos a partir/i.test(remissao) ? data(remissao) : "2019-01-01";
 cest.push({ codigo: col[ci].replace(/\./g, ""), descricao: col[ci + 2], ncms: (col[ci + 1].match(/\d{4}(?:\.\d{1,2}){0,2}|\d{2}/g) ?? []).map(n => n.replace(/\./g, "")), inicio, fim });
}
const cestUnicos = [...new Map(cest.map(r => [`${r.codigo}:${r.inicio}:${r.fim ?? ""}:${r.descricao}`, r])).values()];
gravar("cest", "cest-oficial.html", "https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18", "Consolidado em 2026-10-14 · inclui Convênio 107/26", cestUnicos);

const icmsDoc = new JSDOM(ler("icms-oficial.html").toString("utf8")).window.document;
const tabelasIcms = [...icmsDoc.querySelectorAll("table")].map(t => [...t.querySelectorAll("tr")].map(tr => [...tr.querySelectorAll("td")].map(td => texto(td.textContent))));
const extrairCodigos = (tamanho, marcador) => tabelasIcms.find(rs => rs.some(r => r[0] === marcador))?.filter(r => new RegExp(`^\\d{${tamanho}}$`).test(r[0])).map(r => ({ codigo: r[0], descricao: r[1].split("Classificam-se")[0].trim(), inicio: "2023-12-01", fim: null })) ?? [];
gravar("cstIcms", "icms-oficial.html", "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2023/ajuste-sinief-39-23", "Ajuste SINIEF 39/23 consolidado · sem códigos revogados por 20/24", extrairCodigos(2, "00"));
gravar("csosn", "icms-oficial.html", "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2023/ajuste-sinief-39-23", "Ajuste SINIEF 39/23 · Anexo III-A", extrairCodigos(3, "101"));

const parser = new PDFParse({ data: ler("ipi.pdf") });
const resultado = await parser.getText(); await parser.destroy();
const textoIpi = resultado.text.slice(resultado.text.indexOf("001 Imunidade"));
const enquadramentos = [...textoIpi.matchAll(/(?:^|\n)(\d{3})\s+(Imunidade|Suspensão|Isenção|Redução|Outros)\s+([\s\S]*?)(?=\n\d{3}\s+(?:Imunidade|Suspensão|Isenção|Redução|Outros)|$)/g)].map(m => ({ codigo: m[1], descricao: texto(m[3].replace(/Nota Fiscal[^\n]*|NT 2020[^\n]*|Página \d+[^\n]*|-- \d+ of \d+ --|Cód\. Grupo CST Descrição Enquadramento Legal do IPI/g, "")), grupo: m[2], inicio: null, fim: null }));
gravar("cEnq", "ipi.pdf", "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=zRz9Xc658tM=", "NT 2020.002 v1.01 · 2022-08-19", enquadramentos);

const [cabBenef, ...linhasBenef] = planilha("cbenef.xlsx");
gravar("cBenef", "cbenef.xlsx", "https://portal.fazenda.sp.gov.br/servicos/nfe/Downloads/Tabela-cBenef-SP-v20260901.xlsx", "SP 20260901", linhasBenef.filter(r => /^SP\d{6}$/.test(r[0]) && !/desativad|vigência encerrada/i.test(texto(r[19]))).map(r => ({ codigo: r[0], descricao: texto(r[18]), detalhe: texto([r[17], r[19]].filter(Boolean).join(" · ")), uf: "SP", simples: r[1] === "SIM", csts: cabBenef.flatMap((c, i) => /^CST \d{2}$/.test(c) && r[i] === "SIM" ? [c.slice(-2)] : []), inicio: null, fim: null })));

const [cabIbs, ...linhasIbs] = planilha("ibs-cbs.xlsx", "cClass 2026-09-01");
const ibs = (nome, r) => r[cabIbs.indexOf(nome)];
gravar("cClassTrib", "ibs-cbs.xlsx", "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=Cd5xq2ZVuEg=", "IT 2025.002 v1.70 · 2026-10-01", linhasIbs.filter(r => /^\d{6}$/.test(String(ibs("cClassTrib", r)))).map(r => ({ codigo: String(ibs("cClassTrib", r)), descricao: texto(ibs("Nome cClassTrib", r)), detalhe: texto(ibs("Descrição cClassTrib", r)), cst: String(ibs("CST-IBS/CBS", r)), inicio: data(ibs("dIniVig", r)), fim: data(ibs("dFimVig", r)), nfe: ibs("indNFe", r) === 1, nfce: ibs("indNFCe", r) === 1 })));

const [, ...linhasCst] = planilha("ibs-cbs.xlsx", "CST 2026-09-01");
gravar("cstIbsCbs", "ibs-cbs.xlsx", "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=Cd5xq2ZVuEg=", "IT 2025.002 v1.70 · 2026-10-01", linhasCst.filter(r => /^\d{3}$/.test(String(r[0]))).map(r => ({ codigo: String(r[0]), descricao: texto(r[1]), inicio: null, fim: null })));

const un = planilha("unidades.xlsx");
gravar("unidadeTributavel", "unidades.xlsx", "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=Q6Iyvm6qKsc=", "Tabela padrão de unidades comerciais · 2016-07-05", un.filter(r => /^[A-Z0-9]{1,10}$/.test(String(r[0])) && r[1]).map(r => ({ codigo: String(r[0]), descricao: texto(r[1]), inicio: null, fim: null })));

gravar("pagamento", "pagamento.xlsx", "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=uekMIW1ydFM=", "2026-03-06", planilha("pagamento.xlsx").slice(1).filter(r => /^\d{1,2}$/.test(String(r[0]))).map(r => ({ codigo: String(r[0]).padStart(2, "0"), descricao: texto(r[1]), inicio: null, fim: null })));
console.log(JSON.stringify(resumo, null, 2));
