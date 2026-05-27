'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LogRow = { action: string; message?: string | null; createdAt: string };

export default function LogsPage() {
  const [audit, setAudit] = useState<LogRow[]>([]);

  useEffect(() => {
    api<{ audit: LogRow[] }>('/api/logs').then((r) => setAudit(r.audit || []));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Logs</h2>
      <Card>
        <CardHeader>
          <CardTitle>Auditoria do ambiente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.map((l, i) => (
            <div key={i} className="rounded border border-border/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(l.createdAt).toLocaleString('pt-BR')}
              </span>
              <span className="mx-2">—</span>
              <strong>{l.action}</strong>
              {l.message && <p className="text-muted-foreground">{l.message}</p>}
            </div>
          ))}
          {!audit.length && <p className="text-muted-foreground">Sem logs ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
