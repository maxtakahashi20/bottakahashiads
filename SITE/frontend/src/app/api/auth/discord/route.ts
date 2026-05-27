import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Redireciona para OAuth no backend Express */
export function GET() {
  return NextResponse.redirect(`${API_URL}/auth/discord`);
}
