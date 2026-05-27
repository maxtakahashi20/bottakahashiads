import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Discord redireciona para /api/auth/callback — repassa query (code) ao backend.
 */
export function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return NextResponse.redirect(`${API_URL}/auth/callback${search}`);
}
