import { expect, it } from "vitest";
import { lerDetalhesMerchant } from "@/lib/ifood/merchant-detalhes";
const id = "11111111-1111-4111-8111-111111111111";
it("projeta todos os campos pertinentes sem expor dados extras ou inventar valores", () => {
  const r = lerDetalhesMerchant({ id, name: "Loja sintética", corporateName: "Empresa sintética", description: "Descrição", type: "RESTAURANT", status: "AVAILABLE", test: "TEST", createdAt: "2026-10-12T10:30:00", averageTicket: 0, exclusive: false,
    clientSecret: "nao-retornar", address: { street: "Rua sintética", number: 0, city: "Cidade", state: "SP", district: "Bairro", postalCode: "00000-000", country: "BR", latitude: 0, longitude: -46.3, token: "nao-retornar" },
    operations: [{ name: "DELIVERY", internalData: "nao-retornar", salesChannels: [{ name: "MARKETPLACE", enabled: false, accessToken: "nao-retornar" }, { name: "NOVO_CANAL" }] }],
  }, id);
  expect(r).toMatchObject({ id, nome: "Loja sintética", razaoSocial: "Empresa sintética", ticketMedio: 0, exclusivo: false, criadoEm: "2026-10-12T10:30:00", teste: "TEST", endereco: { numero: "0", latitude: 0, complemento: null }, operacoes: [{ nome: "DELIVERY", canais: [{ nome: "MARKETPLACE", habilitado: false }, { nome: "NOVO_CANAL", habilitado: null }] }] });
  expect(JSON.stringify(r)).not.toContain("nao-retornar");
});
it("preserva ausências e rejeita resposta de outra loja ou listas inválidas", () => {
  expect(lerDetalhesMerchant({ id }, id)).toMatchObject({ nome: null, endereco: null, operacoes: [], ticketMedio: null, exclusivo: null, teste: null });
  expect(() => lerDetalhesMerchant({ id: "22222222-2222-4222-8222-222222222222" }, id)).toThrow(/outra loja/);
  expect(() => lerDetalhesMerchant({ id, operations: {} }, id)).toThrow(/contrato/);
  expect(() => lerDetalhesMerchant({ id, operations: Array(101).fill({}) }, id)).toThrow(/contrato/);
});
