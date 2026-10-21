// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/app/(protegido)/vendas/actions",()=>({alterarStatusCadastroVendaAction:vi.fn(),alterarSituacaoProdutoVendaAction:vi.fn()}));
vi.mock("@/app/(protegido)/vendas/formas-pagamento/actions",()=>({salvarFormaPagamentoVendaAction:vi.fn()}));
import { FormasPagamentoVenda } from "@/app/(protegido)/vendas/formas-pagamento/formas-pagamento-client";
afterEach(cleanup);
it("taxa percentual aceita ,5 como meio por cento, formata sem salvar e mantém centavos implícitos",async()=>{
 const u=userEvent.setup();render(<FormasPagamentoVenda formas={[]} adicionar editar/>);
 await u.click(screen.getByRole("button",{name:"Nova forma"}));
 const campo=screen.getByRole("textbox",{name:"Taxa percentual"}) as HTMLInputElement;
 await u.type(campo,",5");expect(campo.value).toBe("0,5");
 await u.type(campo,"17");expect(campo.value).toBe("0,51");await u.tab();expect(campo.value).toBe("0,51");
 await u.clear(campo);await u.paste(",5");expect(campo.value).toBe("0,5");await u.tab();expect(campo.value).toBe("0,50");
 await u.clear(campo);await u.type(campo,"125");expect(campo.value).toBe("1,25");
});
