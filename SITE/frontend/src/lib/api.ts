const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function setToken(token: string) {
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  localStorage.removeItem('access_token');
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Erro na API');
  }
  return data as T;
}

export { API_URL };
