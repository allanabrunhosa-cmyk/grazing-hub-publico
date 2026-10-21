import { describe, expect, it } from "vitest";
import { argumentosClassificacao, conferirAplicacaoClassificacao, conferirComprovanteClassificacao, serializarArtefatoClassificacao } from "../../scripts/estrutura-fiscal-classificacao-catalogo";
const args = ["--entrada=.tmp/fiscal/entrada-ficticia.json", "--tabela-ncm=.tmp/fiscal/ncm-ficticia.json", "--usuario-id=administrador-ficticio"];
describe("CLI da classificação por serviços, sem conexão externa", () => {
  it("artefatos de replay admitem ordem JSONB diferente e detectam mudança de conteúdo/ordem de componentes", () => {
    const antes = { hashPlano: "a".repeat(64), registros: [{ chave: "produto-ficticio", dados: { ncm: "08061000", quantidade: "0.056666667" } }], resumo: { referenciasInternas: 1, classificacoes: 3 } };
    const banco = { resumo: { classificacoes: 3, referenciasInternas: 1 }, registros: [{ dados: { quantidade: "0.056666667", ncm: "08061000" }, chave: "produto-ficticio" }], hashPlano: "a".repeat(64) };
    expect(serializarArtefatoClassificacao(banco)).toBe(serializarArtefatoClassificacao(antes));
    banco.registros[0].dados.quantidade = "0.056666668"; expect(serializarArtefatoClassificacao(banco)).not.toBe(serializarArtefatoClassificacao(antes));
    expect(serializarArtefatoClassificacao({ componentes: ["a","b"] })).not.toBe(serializarArtefatoClassificacao({ componentes: ["b","a"] }));
  });
  it("prévia é padrão e administrador explícito é obrigatório", () => { expect(argumentosClassificacao(args).aplicar).toBe(false); expect(() => argumentosClassificacao(args.slice(0, 2))).toThrow("administrador real"); });
  it("recusa aplicação sem autorização/hash/backup e flags contraditórias", async () => {
    expect(() => argumentosClassificacao([...args, "--apply", "--dry-run"])).toThrow("distintas");
    await expect(conferirAplicacaoClassificacao(argumentosClassificacao([...args, "--apply"]), { NODE_ENV: "test" })).rejects.toThrow("autorização explícita");
  });
  it("backup exige prova verificada/autorizada, SHA e idade de até24h sem aceitar data futura", () => {
    const agora = Date.parse("2026-10-12T12:00:00Z"), b = { verificado: true, autorizacaoImplantacao: true, hashDump: "a".repeat(64), criadoEm: "2026-10-12T11:00:00Z" };
    expect(() => conferirComprovanteClassificacao(b, agora)).not.toThrow();
    for (const extra of [{ verificado: false }, { autorizacaoImplantacao: false }, { hashDump: "invalido" }, { criadoEm: "2026-10-11T10:00:00Z" }, { criadoEm: "2026-10-13T10:00:00Z" }]) expect(() => conferirComprovanteClassificacao({ ...b, ...extra }, agora)).toThrow();
  });
});
