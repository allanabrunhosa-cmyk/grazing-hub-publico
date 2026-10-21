"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErroBi({ reset }: { reset: () => void }) {
  return <Card><CardHeader><CardTitle>Dashboard</CardTitle></CardHeader>
    <CardContent className="space-y-4"><p role="alert">Não foi possível carregar o Dashboard.</p>
      <Button variant="outline" onClick={reset}>Tentar novamente</Button>
    </CardContent></Card>;
}
