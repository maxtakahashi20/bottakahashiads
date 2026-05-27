'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { getToken } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
