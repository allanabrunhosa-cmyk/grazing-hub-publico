import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { prepararPacotesVisuais, resumoEvidenciasVisuais, RETENCOES_VISUAIS } from "../../scripts/pacotes-evidencias-visuais.mjs";
const temporarios: string[] = [];
const ok = {registro:"success",contratos:"success",referencias:"success",comparador:"success"};
const gravar = (p: string, valor: string | Buffer) => { mkdirSync(dirname(p),{recursive:true});writeFileSync(p,valor); };
function fixture() {
  const raiz=mkdtempSync(join(tmpdir(),"teste-pacotes-visuais-"));temporarios.push(raiz);
  for(const suite of ["contratos","referencias","comparador"]) gravar(join(raiz,suite,"relatorio/resultados.json"),JSON.stringify({stats:{expected:2,unexpected:0,duration:123},suites:[]}));
  const bytes=Buffer.from("imagem sintética somente para testar a cópia por hash");
  const sha256=createHash("sha256").update(bytes).digest("hex");
  for(const caso of ["normal","erro"]) {
    const base=join(raiz,"referencias/resultados",caso,"candidatas");
    gravar(join(base,"controles.png"),bytes);
    gravar(join(base,"origem.json"),JSON.stringify({projeto:"sintético",caso,imagens:[{secao:"controles",sha256,estado:"Em revisão"}]}));
  }
  gravar(join(raiz,"vite/deps/cache.js"),"cache não deve ser publicado");
  gravar(join(raiz,"referencias/relatorio/data/duplicada.png"),bytes);
  gravar(join(raiz,"contratos/resultados/aprovado/trace.zip"),"trace aprovado não deve ser guardado");
  return {raiz,sha256};
}
afterEach(()=>{ for(const p of temporarios.splice(0)) {
  if(dirname(p)!==resolve(tmpdir()) || !basename(p).startsWith("teste-pacotes-visuais-")) throw Error("Diretório de teste inesperado.");
  rmSync(p,{recursive:true,force:true});
} });
describe("pacotes das evidências visuais",()=>{
  it("conserva origem/hash, deduplica a imagem entre casos e exclui cache/HTML/traces aprovados",()=>{
    const {raiz,sha256}=fixture(); const r=prepararPacotesVisuais(raiz,ok,{commit:"a".repeat(40)});
    expect(r.imagensUnicas).toBe(1);expect(r.casos).toBe(2);
    expect(readdirSync(join(raiz,"pacotes/revisao/imagens"))).toEqual([sha256+".png"]);
    expect(r.pacotes.diagnosticos.arquivos).toBe(0);
    expect(existsSync(join(raiz,"pacotes/vite"))).toBe(false);
    expect(readFileSync(join(raiz,"pacotes/revisao/origens/normal/candidatas/origem.json"),"utf8")).toContain(sha256);
    expect(JSON.parse(readFileSync(join(raiz,"pacotes/relatorios/resumo.json"),"utf8")).suites.comparador.estatisticas.expected).toBe(2);
    expect(RETENCOES_VISUAIS).toEqual({relatorios:3,diagnosticos:7,revisao:14});
  });
  it("retém trace, contexto e diferenças da suíte que falhou, sem incluir outras suítes",()=>{
    const {raiz}=fixture();
    gravar(join(raiz,"referencias/resultados/falhou/trace.zip"),"trace de falha");
    gravar(join(raiz,"referencias/resultados/falhou/error-context.md"),"contexto de falha");
    gravar(join(raiz,"referencias/resultados/falhou/diff.png"),"diferença");
    const r=prepararPacotesVisuais(raiz,{...ok,referencias:"failure"});
    expect(r.pacotes.diagnosticos.arquivos).toBe(5);
    expect(readFileSync(join(raiz,"pacotes/diagnosticos/referencias/falhou/trace.zip"),"utf8")).toBe("trace de falha");
    expect(existsSync(join(raiz,"pacotes/diagnosticos/contratos"))).toBe(false);
    expect(existsSync(join(raiz,"pacotes/diagnosticos/referencias/normal/candidatas"))).toBe(false);
  });
  it("conserva os relatórios completos minificados e os anexos JSON inline",()=>{
    const {raiz}=fixture();
    const medidas={controles:2,problemas:[],limites:{altura:44,tolerancia:1}};
    const relatorio={
      stats:{expected:1,unexpected:0,duration:123},
      suites:[{title:"geometria",specs:[{title:"controles sem cortes",tests:[{
        projectName:"chromium-sintetico",results:[{
          status:"passed",duration:123,annotations:[{type:"medição",description:"dados sintéticos"}],
          attachments:[{name:"geometria",contentType:"application/json",body:Buffer.from(JSON.stringify(medidas)).toString("base64")}],
        }],
      }]}]}],
    };
    gravar(join(raiz,"contratos/relatorio/resultados.json"),JSON.stringify(relatorio,null,2));
    prepararPacotesVisuais(raiz,ok);
    const texto=readFileSync(join(raiz,"pacotes/relatorios/contratos/resultados.json"),"utf8");
    const salvo=JSON.parse(texto);
    expect(texto).not.toContain("\n");
    expect(salvo).toEqual(relatorio);
    expect(JSON.parse(Buffer.from(salvo.suites[0].specs[0].tests[0].results[0].attachments[0].body,"base64").toString("utf8"))).toEqual(medidas);
    for(const suite of ["referencias","comparador"]) expect(existsSync(join(raiz,"pacotes/relatorios",suite,"resultados.json"))).toBe(true);
  });
  it("mantém o relatório e os anexos inline da falha por sete dias, sem repetir PNGs de candidatas",()=>{
    const {raiz,sha256}=fixture();
    const contexto={erros:["falha sintética de isolamento"],externos:[]};
    const relatorio={stats:{expected:0,unexpected:1},suites:[{title:"referências",specs:[{title:"captura com falha",tests:[{
      projectName:"chromium-sintetico",results:[{status:"failed",errors:[{message:"falha sintética"}],attachments:[{
        name:"isolamento",contentType:"application/json",body:Buffer.from(JSON.stringify(contexto)).toString("base64"),
      }]}],
    }]}]}]};
    gravar(join(raiz,"referencias/relatorio/resultados.json"),JSON.stringify(relatorio,null,2));
    gravar(join(raiz,"referencias/resultados/falhou/attachments/candidata-copiada.png"),readFileSync(join(raiz,"referencias/resultados/normal/candidatas/controles.png")));
    gravar(join(raiz,"referencias/resultados/falhou/test-failed-1.png"),"captura de falha distinta da candidata");
    const r=prepararPacotesVisuais(raiz,{...ok,referencias:"failure"});
    expect(r.pacotes.diagnosticos.dias).toBe(7);
    expect(JSON.parse(readFileSync(join(raiz,"pacotes/diagnosticos/referencias/resultados.json"),"utf8"))).toEqual(relatorio);
    expect(existsSync(join(raiz,"pacotes/diagnosticos/referencias/falhou/attachments/candidata-copiada.png"))).toBe(false);
    expect(readFileSync(join(raiz,"pacotes/diagnosticos/referencias/falhou/test-failed-1.png"),"utf8")).toBe("captura de falha distinta da candidata");
    expect(existsSync(join(raiz,"pacotes/revisao/imagens",sha256+".png"))).toBe(true);
    expect(existsSync(join(raiz,"pacotes/diagnosticos/contratos/resultados.json"))).toBe(false);
  });
  it("preserva actual, expected e diff consultivos de referências aprovadas pelo teste",()=>{
    const {raiz}=fixture();
    for(const tipo of ["actual","expected","diff"]) {
      gravar(join(raiz,"referencias/resultados/normal/controles-"+tipo+".png"),"comparação consultiva "+tipo);
      gravar(join(raiz,"comparador/resultados/prova/controles-"+tipo+".png"),"comparação sintética "+tipo);
    }
    const r=prepararPacotesVisuais(raiz,ok);
    for(const tipo of ["actual","expected","diff"]) expect(readFileSync(join(raiz,"pacotes/revisao/comparacoes/normal/controles-"+tipo+".png"),"utf8")).toBe("comparação consultiva "+tipo);
    expect(r.pacotes.revisao.dias).toBe(14);
    expect(r.pacotes.diagnosticos.arquivos).toBe(0);
    expect(existsSync(join(raiz,"pacotes/revisao/comparacoes/prova"))).toBe(false);
    expect(existsSync(join(raiz,"pacotes/revisao/comparador"))).toBe(false);
  });
  it("recusa hash incorreto, captura obrigatória ausente e sucesso sem relatório",()=>{
    const a=fixture();gravar(join(a.raiz,"referencias/resultados/normal/candidatas/controles.png"),"adulterada");
    expect(()=>prepararPacotesVisuais(a.raiz,ok)).toThrow("Hash da captura divergente");
    const b=fixture();rmSync(join(b.raiz,"referencias/resultados"),{recursive:true});
    expect(()=>prepararPacotesVisuais(b.raiz,ok)).toThrow("Capturas obrigatórias ausentes");
    const c=fixture();rmSync(join(c.raiz,"contratos/relatorio/resultados.json"));
    expect(()=>prepararPacotesVisuais(c.raiz,ok)).toThrow("Relatório obrigatório ausente");
  });
  it("registra falha anterior sem inventar diagnósticos e recusa etapa obrigatória omitida",()=>{
    const {raiz}=fixture();const resultados={...ok,contratos:"skipped",referencias:"skipped",comparador:"skipped"};
    expect(()=>prepararPacotesVisuais(raiz,resultados)).toThrow("Verificação obrigatória não executada");
    const r=prepararPacotesVisuais(raiz,resultados,{resultadoAnterior:"failure"});
    expect(r.pacotes.diagnosticos.arquivos).toBe(1);
    expect(readFileSync(join(raiz,"pacotes/diagnosticos/manifesto.json"),"utf8")).toContain("antes de gerar diagnósticos");
  });
  it("distingue testes aprovados de envio recusado no resumo da execução",()=>{
    const {raiz}=fixture();const r=prepararPacotesVisuais(raiz,ok);
    const texto=resumoEvidenciasVisuais(r,ok,{relatorios:{resultado:"failure"},revisao:{resultado:"success",url:"https://github.com/exemplo/artifacts/123"}});
    expect(texto).toContain("| contratos | success |");expect(texto).toMatch(/relatorios.*3 dias.*failure/);
    expect(texto).toContain("[success](https://github.com/exemplo/artifacts/123)");
    expect(texto).toContain("mantém a execução em falha");
  });
  it("escreve saídas e resumo da CLI com quebras de linha reais em ambiente isolado",()=>{
    const {raiz}=fixture();
    const cwd=mkdtempSync(join(tmpdir(),"teste-pacotes-visuais-cli-"));temporarios.push(cwd);
    cpSync(raiz,join(cwd,".tmp/qualidade-visual-automatizada"),{recursive:true});
    const saidas=join(cwd,"github-output.txt"),resumo=join(cwd,"github-step-summary.md");
    const script=resolve("scripts/pacotes-evidencias-visuais.mjs");
    const env={...process.env,GITHUB_OUTPUT:saidas,GITHUB_STEP_SUMMARY:resumo,EVIDENCIAS_VERIFICACOES:JSON.stringify(ok),GITHUB_SHA:"a".repeat(40),GITHUB_RUN_ID:"123",GRAZING_AMBIENTE_VISUAL:"sintetico"};
    const preparar=spawnSync(process.execPath,[script,"preparar"],{cwd,encoding:"utf8",env});
    expect(preparar.error).toBeUndefined();
    expect(preparar.status,preparar.stderr).toBe(0);
    expect(readFileSync(saidas,"utf8")).toBe("tem_diagnosticos=false\ntem_revisao=true\n");
    const uploads={relatorios:{resultado:"success",url:"https://github.com/exemplo/artifacts/123"},diagnosticos:{resultado:"skipped"},revisao:{resultado:"failure"}};
    const resumir=spawnSync(process.execPath,[script,"resumir"],{cwd,encoding:"utf8",env:{...env,EVIDENCIAS_UPLOADS:JSON.stringify(uploads)}});
    expect(resumir.error).toBeUndefined();
    expect(resumir.status,resumir.stderr).toBe(0);
    const texto=readFileSync(resumo,"utf8");
    expect(texto).toContain("## Evidências visuais\n\n| Verificação | Resultado |\n");
    expect(texto).toContain("\n| contratos | success |\n");
    expect(texto).toMatch(/\n\| relatorios \| \d+ arquivos · \d+ bytes \| 3 dias \| \[success\]\(https:\/\/github.com\/exemplo\/artifacts\/123\) \|\n/);
    expect(texto).toMatch(/\n\| revisao \| \d+ arquivos · \d+ bytes \| 14 dias \| failure \|\n/);
    expect(texto).not.toContain("\\n");
  });
  it("mantém os bloqueios e publica somente os três caminhos explícitos do workflow",()=>{
    const y=readFileSync(resolve(".github/workflows/qualidade-visual.yml"),"utf8").replace(/\r\n/g,"\n");
    for(const comando of ["lint:visual:referencias","test:visual:contratos","test:visual:referencias","test:visual:comparador"]) expect(y).toContain(comando);
    expect(y).not.toContain("continue-on-error");expect(y).not.toContain("|| true");
    expect(y.match(/uses: actions\/upload-artifact@v4/g)).toHaveLength(3);
    for(const [nome,dias] of Object.entries(RETENCOES_VISUAIS)) expect(y).toContain(`path: .tmp/qualidade-visual-automatizada/pacotes/${nome}\n          retention-days: ${dias}`);
    expect(y).toContain("contents: read");expect(y).toContain("pull-requests: read");expect(y).not.toContain("actions: write");
  });
});
