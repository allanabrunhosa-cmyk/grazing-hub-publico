// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QuadrosPedidos } from "@/app/(protegido)/vendas/pedidos/quadros";
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
afterEach(cleanup);
const p = { id: "p", numero: 1, versao: 2, atendimento: "ENTREGA", referenciaPedido: null, status: "CONFIRMADO", etapa: "PENDENTE", comprador: "Comprador fictício", anteriores: 2, data: "2026-09-27", janela: "08:00–09:00", destinatario: "Destinatário fictício", endereco: "Rua fictícia, 1", observacoes: "Sem cebola", itens: [{ nome: "Kit", quantidade: "2", unidade: "UN", observacoes: "Embalagem separada", escolhas: ["1 × Extra"] }] };
it("quatro dias, quatro etapas, resumo e agrupamento por entrega", () => {
 render(<QuadrosPedidos dados={{ hoje: "2026-09-27", dias: ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"], pedidos: [p, { ...p, id: "p2", numero: 2, etapa: "EM_PREPARO", data: "2026-09-29" }] }} />);
 expect(screen.getAllByRole("region")).toHaveLength(4);
 fireEvent.click(screen.getByRole("button", { name: "Resumo do pedido 1" }));
 expect(within(screen.getByRole("dialog")).getByText("2 × Kit")).toBeTruthy();
 expect(within(screen.getByRole("dialog")).getByText("Observação: Embalagem separada")).toBeTruthy();
 expect(within(screen.getByRole("dialog")).getByText("Sem cebola")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
 fireEvent.click(screen.getByRole("button", { name: "Etapas de produção e entrega" }));
 expect(screen.getAllByRole("region")).toHaveLength(4);
 expect(within(screen.getByRole("region", { name: "Em preparo" })).getByText(/Entrega:.*29/)).toBeTruthy();
});

it("imprime o orçamento com produtos e escapa conteúdo sem confirmar uma venda", () => {
 const write = vi.fn(); const print = vi.fn();
 const open = vi.spyOn(window, "open").mockReturnValue({ document: { write, close: vi.fn() }, focus: vi.fn(), print } as unknown as Window);
 render(<QuadrosPedidos dados={{ hoje: "2026-09-27", dias: ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"], pedidos: [{ ...p, status: "RASCUNHO", observacoes: "<script>alert(1)</script>" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: "Imprimir pedido 1" }));
 expect(write.mock.calls[0][0]).toContain("Em orçamento — não iniciar produção");
 expect(write.mock.calls[0][0]).toContain("width:72mm");
 expect(write.mock.calls[0][0]).toContain('class="numero destaque">#1');
 expect(write.mock.calls[0][0]).toContain('class="entrega destaque">Entrega: 27/09/2026');
 expect(write.mock.calls[0][0]).toContain('class="quantidade destaque">2 UN');
 expect(write.mock.calls[0][0]).toContain('class="observacao destaque"><strong>OBS.:</strong> Embalagem separada');
 expect(write.mock.calls[0][0]).not.toContain("<script>"); expect(write.mock.calls[0][0]).toContain("&lt;script&gt;");
 expect(print).toHaveBeenCalledTimes(1); open.mockRestore();
});
