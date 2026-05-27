import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Discord retorna para o Next (3000). Repassamos ao backend no servidor
 * para não consumir o `code` duas vezes (evita invalid_grant / oauth_failed).
 */
export async function GET(request: NextRequest) {
  const target = `${API_URL}/auth/callback${request.nextUrl.search}`;

  const res = await fetch(target, { redirect: 'manual' });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (location) return NextResponse.redirect(location);
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'text/plain' }
  });
}
