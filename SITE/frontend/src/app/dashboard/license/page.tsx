'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LicensePage() {
  const [data, setData] = useState<{
    tenant: { status: string };
    active?: { endsAt: string; license?: { duration: string } };
    subscriptions: Array<{ endsAt: string; status: string }>;
  } | null>(null);

  useEffect(() => {
    api('/api/license').then(setData);
  }, []);

  if (!data) return <p>Carregando...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Licença</h2>
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Ambiente: <strong>{data.tenant.status}</strong>
          </p>
          {data.active && (
            <p>
              Expira em: <strong>{new Date(data.active.endsAt).toLocaleString('pt-BR')}</strong>
            </p>
          )}
          <p className="text-muted-foreground">
            Renove com <code>/renovar</code> no Discord ou peça uma nova licença.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
