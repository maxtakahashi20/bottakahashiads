'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Palette,
  Key,
  Network,
  ScrollText,
  LogOut
} from 'lucide-react';
import { clearToken } from '@/lib/api';

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
  { href: '/dashboard/embed', label: 'Embed Builder', icon: Palette },
  { href: '/dashboard/branding', label: 'Branding', icon: Settings },
  { href: '/dashboard/license', label: 'Licença', icon: Key },
  { href: '/dashboard/network', label: 'Rede', icon: Network },
  { href: '/dashboard/logs', label: 'Logs', icon: ScrollText }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card/50 p-4">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Takahashi Ads
        </p>
        <h1 className="text-xl font-bold">Painel SaaS</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          clearToken();
          window.location.href = '/login';
        }}
        className="mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </aside>
  );
}
