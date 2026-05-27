'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Takahashi Ads</CardTitle>
          <p className="text-sm text-muted-foreground">
            Painel SaaS para configurar seu ambiente de divulgação
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              window.location.href = '/api/auth/discord';
            }}
          >
            Entrar com Discord
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ative sua licença com <code className="rounded bg-muted px-1">/ativar</code> no Discord antes de entrar.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
