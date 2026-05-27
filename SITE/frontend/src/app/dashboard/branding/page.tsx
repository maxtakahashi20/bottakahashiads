'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Branding = {
  botDisplayName?: string | null;
  botAvatarUrl?: string | null;
  botStatusText?: string | null;
  botStatusType?: string;
  botDescription?: string | null;
  primaryColor?: string;
};

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding>({ botStatusType: 'online', primaryColor: '#5865F2' });

  useEffect(() => {
    api<{ branding: Branding | null }>('/api/config').then((r) => {
      if (r.branding) setBranding(r.branding);
    });
  }, []);

  async function save() {
    await api('/api/branding', { method: 'PATCH', body: JSON.stringify(branding) });
    alert('Branding salvo! O bot atualizará nome/avatar/status em até 60s.');
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-3xl font-bold">Branding do bot</h2>
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome exibido</Label>
            <Input
              value={branding.botDisplayName || ''}
              onChange={(e) => setBranding({ ...branding, botDisplayName: e.target.value })}
            />
          </div>
          <div>
            <Label>URL do avatar</Label>
            <Input
              value={branding.botAvatarUrl || ''}
              onChange={(e) => setBranding({ ...branding, botAvatarUrl: e.target.value })}
            />
          </div>
          <div>
            <Label>Status (texto)</Label>
            <Input
              value={branding.botStatusText || ''}
              onChange={(e) => setBranding({ ...branding, botStatusText: e.target.value })}
            />
          </div>
          <div>
            <Label>Tipo de status</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-muted/50 px-3 text-sm"
              value={branding.botStatusType || 'online'}
              onChange={(e) => setBranding({ ...branding, botStatusType: e.target.value })}
            >
              <option value="online">Online</option>
              <option value="idle">Ausente</option>
              <option value="dnd">Não perturbe</option>
              <option value="invisible">Invisível</option>
            </select>
          </div>
          <div>
            <Label>Cor primária (painel)</Label>
            <Input
              value={branding.primaryColor || '#5865F2'}
              onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
            />
          </div>
          <Button onClick={save}>Salvar branding</Button>
        </CardContent>
      </Card>
    </div>
  );
}
