'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Falha ao validar login com Discord. Confira Client ID + Secret no mesmo app.',
  invalid_client: 'Client ID ou Client Secret incorretos no .env da raiz.',
  invalid_grant:
    'Código OAuth inválido ou expirado. Tente de novo ou confira o Redirect URI no Portal.',
  no_code: 'Discord não retornou código. Tente novamente.',
  no_tenant:
    'Nenhum ambiente encontrado. Ative com /ativar no Discord antes de entrar no site.',
  server: 'Erro interno no servidor. Veja o terminal da API.'
};

function LoginContent() {
  const params = useSearchParams();
  const error = params.get('error');
  const desc = params.get('desc');

  const message =
    (error && ERROR_MESSAGES[error]) ||
    (desc ? decodeURIComponent(desc) : null) ||
    (error ? `Erro: ${error}` : null);

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
          {message && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {message}
            </div>
          )}
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
            Ative sua licença com <code className="rounded bg-muted px-1">/ativar</code> no Discord
            antes de entrar.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted-foreground">Carregando...</p>}>
      <LoginContent />
    </Suspense>
  );
}
