// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {InsumoCombobox} from "@/app/(protegido)/inventario/insumo-combobox";
vi.mock("@/components/cadastro-rapido-insumo-dialog",()=>({CadastroRapidoInsumoDialog:()=>null}));
afterEach(cleanup);
it("campo e opções exibem só nome, mantendo altura padrão",()=>{render(<InsumoCombobox insumos={[{id:"i",nome:"Farinha",especificacao:"Tipo 1 W300",unidade:"KG",custoMedio:0}]} value="i" onChange={vi.fn()}/>);expect(screen.queryByText("Tipo 1 W300")).toBeNull();const campo=screen.getByRole("combobox");expect(campo.className).not.toContain("h-14");fireEvent.focus(campo);expect(campo).toHaveProperty("value","Farinha");});
