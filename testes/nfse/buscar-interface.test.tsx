// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ atualizar: vi.fn(), sucesso: vi.fn(), erro: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.atualizar }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.sucesso, error: mocks.erro } }));
import { AcaoBarra } from "@/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view";

beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("retorno da busca no manifesto de NFS-e", () => {
  it.each([false, true])("atualiza o resultado exibido após sucesso ou falha: %s", async falha => {
    const mensagem = falha ? "O ADN recusou o acesso." : "Nenhuma nova NFS-e disponível.";
    const buscar = vi.fn().mockResolvedValue({ ok: !falha, json: async () => falha ? { erro: mensagem } : { motivo: mensagem } });
    vi.stubGlobal("fetch", buscar);
    render(<AcaoBarra podeBuscar />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar novas NFS" }));
    await waitFor(() => expect(mocks.atualizar).toHaveBeenCalledOnce());
    expect(falha ? mocks.erro : mocks.sucesso).toHaveBeenCalledWith(mensagem);
    expect(buscar).toHaveBeenCalledExactlyOnceWith("/api/nfse/buscar", { method: "POST" });
  });
  it("mantém a página e orienta conferir o resultado após interrupção da comunicação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<AcaoBarra podeBuscar />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar novas NFS" }));
    await waitFor(() => expect(mocks.erro).toHaveBeenCalledWith(expect.stringContaining("comunicação")));
    expect(mocks.atualizar).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Buscar novas NFS" })).toBeTruthy();
  });
  it("não oferece busca para perfil sem permissão", () => {
    render(<AcaoBarra podeBuscar={false} />);
    expect(screen.queryByRole("button", { name: "Buscar novas NFS" })).toBeNull();
  });
});
