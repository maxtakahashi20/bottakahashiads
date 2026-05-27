/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      { source: '/api/auth/discord', destination: `${api}/auth/discord` },
      { source: '/api/auth/callback', destination: `${api}/auth/callback` }
    ];
  }
};

export default nextConfig;
