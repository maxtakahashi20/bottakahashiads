'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmbedPreview } from '@/components/dashboard/embed-preview';

type Embed = {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  bannerUrl?: string | null;
  thumbnailUrl?: string | null;
  footerText?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  useEmbedMode?: boolean;
};

export default function EmbedPage() {
  const [embed, setEmbed] = useState<Embed>({ color: 0x5865f2 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ embed: Embed | null }>('/api/embed').then((r) => {
      if (r.embed) setEmbed(r.embed);
    });
  }, []);

  async function save() {
    await api('/api/embed', { method: 'PUT', body: JSON.stringify(embed) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const colorHex = embed.color != null ? embed.color.toString(16).padStart(6, '0') : '5865f2';

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Embed Builder</h2>
        <Card>
          <CardHeader>
            <CardTitle>Personalizar mensagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={embed.title || ''}
                onChange={(e) => setEmbed({ ...embed, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
                value={embed.description || ''}
                onChange={(e) => setEmbed({ ...embed, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Cor (#hex sem #)</Label>
              <Input
                value={colorHex}
                onChange={(e) =>
                  setEmbed({ ...embed, color: parseInt(e.target.value.replace('#', ''), 16) || 0x5865f2 })
                }
              />
            </div>
            <div>
              <Label>Banner URL</Label>
              <Input
                value={embed.bannerUrl || ''}
                onChange={(e) => setEmbed({ ...embed, bannerUrl: e.target.value })}
              />
            </div>
            <div>
              <Label>Footer</Label>
              <Input
                value={embed.footerText || ''}
                onChange={(e) => setEmbed({ ...embed, footerText: e.target.value })}
              />
            </div>
            <div>
              <Label>Botão — label</Label>
              <Input
                value={embed.buttonLabel || ''}
                onChange={(e) => setEmbed({ ...embed, buttonLabel: e.target.value })}
              />
            </div>
            <div>
              <Label>Botão — URL</Label>
              <Input
                value={embed.buttonUrl || ''}
                onChange={(e) => setEmbed({ ...embed, buttonUrl: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={embed.useEmbedMode || false}
                onChange={(e) => setEmbed({ ...embed, useEmbedMode: e.target.checked })}
              />
              Usar modo embed (em vez de texto simples)
            </label>
            <Button onClick={save}>{saved ? 'Salvo!' : 'Salvar embed'}</Button>
          </CardContent>
        </Card>
      </div>
      <div>
        <h3 className="mb-4 text-lg font-semibold">Preview em tempo real</h3>
        <EmbedPreview {...embed} />
      </div>
    </div>
  );
}
