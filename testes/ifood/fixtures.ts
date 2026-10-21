export const merchant = "11111111-1111-4111-8111-111111111111";
export const orderId = "22222222-2222-4222-8222-222222222222";
export function pedidoRemoto() {
  return { id: orderId, displayId: "TESTE-01", isTest: true, category: "FOOD", orderType: "DELIVERY", orderTiming: "IMMEDIATE", createdAt: "2026-10-05T20:00:00Z",
    merchant: { id: merchant, name: "Loja sintética" }, customer: { name: "Cliente de teste", id: "33333333-3333-4333-8333-333333333333" },
    items: [{ id: "44444444-4444-4444-8444-444444444444", name: "Produto de teste", quantity: 2, unit: "UN", unitPrice: 10.1, price: 20.2, optionsPrice: 2, totalPrice: 22.2, observations: "Observação sintética", options: [{ id: "55555555-5555-4555-8555-555555555555", name: "Adicional de teste", quantity: 1, unitPrice: 1, price: 1 }] }],
    total: { subTotal: 22.2, deliveryFee: 3.5, additionalFees: 0, benefits: 0, orderAmount: 25.7 },
    payments: { prepaid: 25.7, pending: 0, methods: [{ value: 25.7, currency: "BRL", method: "CREDIT", type: "ONLINE", prepaid: true, card: { brand: "VISA" } }] },
    delivery: { deliveredBy: "MERCHANT", deliveryDateTime: "2026-10-05T21:00:00Z" },
  };
}
