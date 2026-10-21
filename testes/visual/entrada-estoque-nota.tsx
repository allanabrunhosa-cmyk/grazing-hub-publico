import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EntradaEstoqueNota } from '@/app/(protegido)/notas-fiscais/entrada-estoque-nota';
import { diaEntradaEstoque } from '@/lib/notas-fiscais/data-entrada';
import '@/app/globals.css';
function Previa() {
  const [data,setData]=useState(diaEntradaEstoque());
  const [local,setLocal]=useState('local');
  return <main className="mx-auto max-w-4xl space-y-4 p-4"><h1 className="text-lg font-semibold">Entrada da nota no estoque</h1><p className="text-sm text-muted-foreground">Prévia com dados fictícios.</p><EntradaEstoqueNota locais={[{id:'local',nome:'Estoque principal'}]} localId={local} onLocalChange={setLocal} dataEntrada={data} onDataChange={setData}/></main>;
}
createRoot(document.getElementById('root')!).render(<Previa/>);
