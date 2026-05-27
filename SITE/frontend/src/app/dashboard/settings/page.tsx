'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Settings = {
  botRunning: boolean;
  globalMessage?: string | null;
  globalInviteUrl?: string | null;
  messagesPerCycle: number;
  delayMsgMinSec: number;
  delayMsgMaxSec: number;
  delayGuildMinSec: number;
  delayGuildMaxSec: number;
  minCycleMinutes: number;
  networkEnabled: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api<{ settings: Settings }>('/api/config').then((r) => setSettings(r.settings));
  }, []);

  async function save() {
    if (!settings) return;
    await api('/api/config', { method: 'PATCH', body: JSON.stringify(settings) });
    alert('Configurações salvas! O bot aplicará em até 60s.');
  }

  if (!settings) return <p>Carregando...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-3xl font-bold">Configurações</h2>
      <Card>
        <CardHeader>
          <CardTitle>Geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.botRunning}
              onChange={(e) => setSettings({ ...settings, botRunning: e.target.checked })}
            />
            Bot ligado
          </label>
          <div>
            <Label>Mensagem global</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
              value={settings.globalMessage || ''}
              onChange={(e) => setSettings({ ...settings, globalMessage: e.target.value })}
            />
          </div>
          <div>
            <Label>Convite / link</Label>
            <Input
              value={settings.globalInviteUrl || ''}
              onChange={(e) => setSettings({ ...settings, globalInviteUrl: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delays e ciclos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Msgs por ciclo</Label>
            <Input
              type="number"
              value={settings.messagesPerCycle}
              onChange={(e) =>
                setSettings({ ...settings, messagesPerCycle: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Ciclo mínimo (min)</Label>
            <Input
              type="number"
              value={settings.minCycleMinutes}
              onChange={(e) =>
                setSettings({ ...settings, minCycleMinutes: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Delay msg min (s)</Label>
            <Input
              type="number"
              value={settings.delayMsgMinSec}
              onChange={(e) =>
                setSettings({ ...settings, delayMsgMinSec: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Delay msg max (s)</Label>
            <Input
              type="number"
              value={settings.delayMsgMaxSec}
              onChange={(e) =>
                setSettings({ ...settings, delayMsgMaxSec: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Delay servidor min (s)</Label>
            <Input
              type="number"
              value={settings.delayGuildMinSec}
              onChange={(e) =>
                setSettings({ ...settings, delayGuildMinSec: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Delay servidor max (s)</Label>
            <Input
              type="number"
              value={settings.delayGuildMaxSec}
              onChange={(e) =>
                setSettings({ ...settings, delayGuildMaxSec: Number(e.target.value) })
              }
            />
          </div>
        </CardContent>
      </Card>
      <Button onClick={save}>Salvar configurações</Button>
    </div>
  );
}
