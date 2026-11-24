/** Pedido WooCommerce inteiramente sintético, no formato da REST API v3. */
export function pedidoSite(extra: Record<string, unknown> = {}) {
  return {
    id: 4521, number: "4521", status: "processing", currency: "BRL",
    date_created_gmt: "2026-11-24T01:30:00", date_modified_gmt: "2026-11-24T01:35:00", date_paid_gmt: "2026-11-24T01:34:00",
    discount_total: "10.00", shipping_total: "25.00", total_tax: "0.00", total: "315.00",
    customer_note: "Entregar na portaria",
    billing: { first_name: "Pessoa", last_name: "Fictícia", company: "", address_1: "Rua Fictícia", address_2: "Sala 2", city: "São Paulo", state: "SP", postcode: "01000-000", country: "BR", email: "Pessoa@Example.invalid", phone: "(11) 3000-0000", number: "100", neighborhood: "Centro", cpf: "123.456.789-09", cellphone: "(11) 90000-0000", persontype: "F" },
    shipping: { first_name: "Destinatária", last_name: "Sintética", address_1: "Avenida Sintética", address_2: "", city: "São Paulo", state: "SP", postcode: "02000-000", country: "BR", number: "200", neighborhood: "Bairro Teste", phone: "" },
    payment_method: "asaas-pix", payment_method_title: "Pix", transaction_id: "pay_abc123def456",
    meta_data: [{ id: 1, key: "_delivery_date", value: "28/11/2026" }, { id: 2, key: "_delivery_time", value: "14:00 - 16:00" }, { id: 3, key: "__ASAAS_ORDER__", value: "{\"id\":\"pay_abc123def456\"}" }],
    line_items: [
      { id: 11, name: "Mesa de frios sintética", product_id: 900, variation_id: 901, quantity: 2, subtotal: "250.00", total: "240.00", sku: "GT-001", price: 120, meta_data: [{ id: 5, key: "tamanho", value: "grande", display_key: "Tamanho", display_value: "<p>Grande</p>" }, { id: 6, key: "_reduced_stock", value: "2" }] },
      { id: 12, name: "Caixa presente sintética", product_id: 950, variation_id: 0, quantity: 1, subtotal: "50.00", total: "50.00", sku: "", price: 50, meta_data: [] },
    ],
    shipping_lines: [{ id: 21, method_title: "Entrega agendada", method_id: "flat_rate", total: "25.00" }],
    fee_lines: [], coupon_lines: [{ code: "sintetico10", discount: "10.00" }],
    ...extra,
  };
}
