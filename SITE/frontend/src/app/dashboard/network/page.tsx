'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Guild = {
  guildId: string;
  partnerGuildName?: string | null;
  adsChannelId?: string | null;
  adsEnabled: boolean;
  delayMinutes: number;
};

export default function NetworkPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);

  useEffect(() => {
    api<{ guilds: Guild[] }>('/api/guilds').then((r) => setGuilds(r.guilds));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Rede / Servidores</h2>
      <p className="text-muted-foreground">
        Gerencie servidores pelo Discord em <code>/painel</code> → Servidores. Aqui você visualiza o
        estado.
      </p>
      <div className="grid gap-4">
        {guilds.map((g) => (
          <Card key={g.guildId}>
            <CardHeader>
              <CardTitle className="text-base">
                {g.partnerGuildName || g.guildId}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Canal: {g.adsChannelId || '—'}</p>
              <p>Ativo: {g.adsEnabled ? 'Sim' : 'Não'}</p>
              <p>Delay: {g.delayMinutes} min</p>
            </CardContent>
          </Card>
        ))}
        {!guilds.length && <p className="text-muted-foreground">Nenhum servidor configurado.</p>}
      </div>
    </div>
  );
}
