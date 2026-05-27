'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';

export default function AuthSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      router.replace('/dashboard');
    } else {
      router.replace('/login?error=no_token');
    }
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Autenticando...</p>
    </main>
  );
}
