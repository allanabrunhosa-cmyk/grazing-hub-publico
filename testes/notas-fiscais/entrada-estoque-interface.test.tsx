// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EntradaEstoqueNota } from '@/app/(protegido)/notas-fiscais/entrada-estoque-nota';
afterEach(cleanup);
it('permite informar uma data independente do local e sinaliza datas futuras', () => {
  const alterar = vi.fn();
  render(<EntradaEstoqueNota locais={[{id:'local',nome:'Estoque principal'}]} localId="local" onLocalChange={vi.fn()} dataEntrada="9999-01-01" onDataChange={alterar} />);
  const campo = screen.getByLabelText('Data de entrada no estoque');
  expect(screen.getByRole('alert').textContent).toContain('não pode ser futura');
  fireEvent.change(campo,{target:{value:'2024-02-29'}});
  expect(alterar).toHaveBeenCalledWith('2024-02-29');
});

it('exige recebimento para uso e consumo sem pedir local de estoque', () => {
  render(<EntradaEstoqueNota locais={[]} localId="" onLocalChange={vi.fn()} dataEntrada="" onDataChange={vi.fn()} mostrarLocal={false} mostrarErros />);
  expect(screen.getByLabelText('Data de recebimento dos produtos').getAttribute('required')).toBe('');
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('data de recebimento');
  expect(screen.queryByText(/Cadastre um local/)).toBeNull();
});
