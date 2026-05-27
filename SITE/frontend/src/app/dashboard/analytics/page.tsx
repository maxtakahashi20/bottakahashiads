'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api<{ data: Record<string, unknown> }>('/api/analytics').then((r) => setData(r.data));
  }, []);

  if (!data) return <p>Carregando...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Analytics</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data).map(([k, v]) =>
          typeof v !== 'object' ? (
            <Card key={k}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize text-muted-foreground">{k}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{String(v)}</p>
              </CardContent>
            </Card>
          ) : null
        )}
      </div>
    </div>
  );
}
