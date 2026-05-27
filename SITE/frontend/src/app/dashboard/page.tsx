'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Overview = {
  ok: boolean;
  tenant: { displayName?: string; status: string };
  overview: {
    totalAds: number;
    totalDeliveries: number;
    totalFailures: number;
    activeServers: number;
    successRate: number;
  };
  settings: { botRunning: boolean; totalCycles: number };
};

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>('/api/dashboard/overview').then(setData).catch(console.error);
  }, []);

  if (!data) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  const o = data.overview;
  const stats = [
    { label: 'Anúncios', value: o.totalAds },
    { label: 'Enviados', value: o.totalDeliveries },
    { label: 'Falhas', value: o.totalFailures },
    { label: 'Servidores', value: o.activeServers },
    { label: 'Taxa sucesso', value: `${o.successRate}%` },
    { label: 'Ciclos', value: data.settings?.totalCycles ?? 0 }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Overview</h2>
        <p className="text-muted-foreground">
          {data.tenant.displayName || 'Seu ambiente'} —{' '}
          {data.settings.botRunning ? '🟢 Bot ligado' : '⏸ Bot pausado'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
