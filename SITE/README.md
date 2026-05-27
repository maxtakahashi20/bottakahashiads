# Takahashi Ads — Painel Web SaaS

Painel web multi-tenant integrado ao bot Discord **Takahashi Ads**.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, Shadcn-style UI |
| API | Node.js, Express, JWT, Zod |
| Dados | PostgreSQL (Prisma), Redis (cache) |
| Auth | Discord OAuth2 |
| Bot | discord.js v14 (lê configs do mesmo banco) |

## Estrutura

```
SITE/
  backend/     # API Express (porta 3001)
  frontend/    # Next.js (porta 3000)
```

## Pré-requisitos

1. Banco PostgreSQL com migrations SaaS já aplicadas
2. Rodar migration do painel web:

```bash
# No Supabase SQL Editor:
prisma/migrations/web_panel_saas.sql
```

3. `npx prisma generate` na raiz do projeto bot

4. Redis (opcional, melhora cache; funciona sem Redis)

## Variáveis de ambiente

Adicione no `.env` da raiz:

```env
# Discord OAuth (Portal → OAuth2)
DISCORD_CLIENT_SECRET=seu_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Painel web
WEB_URL=http://localhost:3000
WEB_API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001

JWT_SECRET=uma-chave-secreta-longa-minimo-32-caracteres
INTERNAL_API_KEY=mesma-chave-do-API_KEY_CHANGE_ME
REDIS_URL=redis://127.0.0.1:6379
```

No [Discord Developer Portal](https://discord.com/developers/applications):

- OAuth2 → Redirects: `http://localhost:3000/api/auth/callback`
- Em produção: `https://seu-dominio.com/api/auth/callback`

## Instalação

```powershell
# Na raiz do bot (PowerShell — use ; em vez de &&)
cd "D:\BOT TAKAHASHI ADS"
npm run prisma:generate

cd SITE
npm install

cd frontend
npm install
```

## Desenvolvimento

```powershell
# Terminal 1 — Bot (raiz do projeto)
npm run dev

# Terminal 2 — API
cd SITE\backend
npm run dev

# Terminal 3 — Frontend
cd SITE\frontend
npm run dev
```

> **PowerShell:** o operador `&&` só funciona no PowerShell 7+. Use `;` ou comandos em terminais separados.

Ou na pasta `SITE`:

```bash
npm run dev
```

Acesse: **http://localhost:3000**

## Fluxo do cliente

1. Ativar licença no Discord: `/ativar`
2. Entrar no site: **Entrar com Discord**
3. Configurar embed, delays, branding
4. O bot aplica mudanças em até **60 segundos**

## API (resumo)

| Método | Rota | Auth |
|--------|------|------|
| GET | `/auth/discord` | — |
| GET | `/api/dashboard/overview` | JWT |
| PATCH | `/api/config` | JWT |
| PUT | `/api/embed` | JWT |
| PATCH | `/api/branding` | JWT |
| GET | `/api/internal/tenant/:id/config` | `x-internal-key` |

## Produção

- Deploy frontend (Vercel/Railway) com `NEXT_PUBLIC_API_URL`
- Deploy API com `DATABASE_URL`, `JWT_SECRET`, `DISCORD_CLIENT_SECRET`
- Bot na Discloud com mesmo `DATABASE_URL`
- Rode `web_panel_saas.sql` no Supabase antes do deploy

## Integração bot

- `TenantWebSyncService` — atualiza avatar/nome/status a cada 60s
- `messagePayload.js` — usa `TenantEmbedTemplate` quando `useEmbedMode` ativo
- `TenantConfigService` — invalida cache após sync
